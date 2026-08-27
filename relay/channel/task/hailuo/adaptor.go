package hailuo

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"

	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/utils"
)

// https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create
// https://platform.minimaxi.com/docs/api-reference/video-generation-v2-query
// Legacy V1: https://platform.minimaxi.com/docs/api-reference/video-generation-t2v
type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) resolveBaseURL(info *relaycommon.RelayInfo) string {
	model := strings.TrimSpace(info.UpstreamModelName)
	if model == "" {
		model = strings.TrimSpace(info.OriginModelName)
	}
	return resolveMiniMaxVideoBaseURL(a.baseURL, model)
}

func resolveMiniMaxVideoBaseURL(baseURL, model string) string {
	base := strings.TrimSpace(baseURL)
	// MiniMax-H3 V2 docs: https://api.minimaxi.com — legacy MiniMax chat default is api.minimax.chat.
	if IsVideoGenerationV2(model) && (base == "" || base == "https://api.minimax.chat") {
		return "https://api.minimaxi.com"
	}
	if base != "" {
		return base
	}
	return "https://api.minimax.chat"
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *taskdto.TaskError) {
	// MiniMax V2 uses content[].text instead of top-level prompt; inject it for
	// downstream logging/billing when present, but do not require top-level prompt.
	if err := injectPromptFromMiniMaxContent(c); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate, relaycommon.WithoutRequiredPrompt())
}

// injectPromptFromMiniMaxContent copies content[].text into top-level prompt when
// the client omits prompt (official MiniMax V2 shape).
func injectPromptFromMiniMaxContent(c *gin.Context) error {
	var raw map[string]interface{}
	if err := common.UnmarshalBodyReusable(c, &raw); err != nil {
		return err
	}
	if prompt, _ := raw["prompt"].(string); strings.TrimSpace(prompt) != "" {
		return nil
	}

	text := textFromContentField(raw["content"])
	if text == "" {
		if meta, ok := raw["metadata"].(map[string]interface{}); ok {
			text = textFromContentField(meta["content"])
		}
	}
	if text == "" {
		return nil
	}

	raw["prompt"] = text
	jsonData, err := common.Marshal(raw)
	if err != nil {
		return err
	}
	common.CleanupBodyStorage(c)
	c.Request.Body = io.NopCloser(bytes.NewBuffer(jsonData))
	c.Set(common.KeyRequestBody, jsonData)
	return nil
}

func textFromContentField(content any) string {
	items, ok := content.([]interface{})
	if !ok {
		return ""
	}
	for _, raw := range items {
		item, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		typeName, _ := item["type"].(string)
		if typeName != "text" {
			continue
		}
		if text, ok := item["text"].(string); ok && strings.TrimSpace(text) != "" {
			return strings.TrimSpace(text)
		}
	}
	return ""
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseURL := a.resolveBaseURL(info)
	if IsVideoGenerationV2(info.UpstreamModelName) {
		return fmt.Sprintf("%s%s", baseURL, TextToVideoEndpointV2), nil
	}
	return fmt.Sprintf("%s%s", baseURL, TextToVideoEndpoint), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	v, exists := c.Get("task_request")
	if !exists {
		return nil, fmt.Errorf("request not found in context")
	}
	req, ok := v.(relaycommon.TaskSubmitReq)
	if !ok {
		return nil, fmt.Errorf("invalid request type in context")
	}

	var data []byte
	var err error
	if IsVideoGenerationV2(info.UpstreamModelName) {
		body, convertErr := a.convertToV2RequestPayload(&req, info)
		if convertErr != nil {
			return nil, errors.Wrap(convertErr, "convert v2 request payload failed")
		}
		data, err = common.Marshal(body)
	} else {
		body, convertErr := a.convertToRequestPayload(&req, info)
		if convertErr != nil {
			return nil, errors.Wrap(convertErr, "convert request payload failed")
		}
		data, err = common.Marshal(body)
	}
	if err != nil {
		return nil, err
	}

	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *taskdto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	if IsVideoGenerationV2(info.UpstreamModelName) {
		return a.doV2Response(c, resp.StatusCode, responseBody, info)
	}
	return a.doV1Response(c, responseBody, info)
}

func (a *TaskAdaptor) doV1Response(c *gin.Context, responseBody []byte, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *taskdto.TaskError) {
	var hResp VideoResponse
	if err := common.Unmarshal(responseBody, &hResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if hResp.BaseResp.StatusCode != StatusSuccess {
		taskErr = service.TaskErrorWrapper(
			fmt.Errorf("hailuo api error: %s", hResp.BaseResp.StatusMsg),
			strconv.Itoa(hResp.BaseResp.StatusCode),
			http.StatusBadRequest,
		)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return hResp.TaskID, responseBody, nil
}

func (a *TaskAdaptor) doV2Response(c *gin.Context, statusCode int, responseBody []byte, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *taskdto.TaskError) {
	if statusCode < 200 || statusCode >= 300 {
		msg, code := parseV2Error(responseBody, statusCode)
		taskErr = service.TaskErrorWrapper(fmt.Errorf("hailuo v2 api error: %s", msg), code, statusCode)
		return
	}

	if msg, code := parseV2Error(responseBody, statusCode); code != "" && code != strconv.Itoa(statusCode) {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("hailuo v2 api error: %s", msg), code, statusCode)
		return
	}

	upstreamTaskID, err := parseV2CreateTaskID(responseBody)
	if err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}
	if upstreamTaskID == "" {
		taskErr = service.TaskErrorWrapper(
			fmt.Errorf("task_id is empty (upstream body: %s)", responseBody),
			"invalid_response",
			http.StatusInternalServerError,
		)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return upstreamTaskID, responseBody, nil
}

// parseV2CreateTaskID accepts official create payloads ({task_id}) and
// query-style payloads ({task:{id}}) returned by some gateways.
func parseV2CreateTaskID(responseBody []byte) (string, error) {
	var flat VideoGenerationV2Response
	if err := common.Unmarshal(responseBody, &flat); err != nil {
		return "", err
	}
	if flat.TaskID != "" {
		return flat.TaskID, nil
	}

	var wrapped QueryTaskV2Response
	if err := common.Unmarshal(responseBody, &wrapped); err != nil {
		return "", err
	}
	if wrapped.Task != nil && wrapped.Task.ID != "" {
		return wrapped.Task.ID, nil
	}
	return "", nil
}

func parseV2Error(responseBody []byte, statusCode int) (message, code string) {
	var errBody OAIErrorBody
	if err := common.Unmarshal(responseBody, &errBody); err == nil && errBody.Error != nil {
		message = errBody.Error.Message
		code = errBody.Error.Type
		if code == "" {
			code = errBody.Error.HTTPCode
		}
	}
	if message == "" {
		message = strings.TrimSpace(string(responseBody))
	}
	if message == "" {
		message = http.StatusText(statusCode)
	}
	if code == "" {
		code = strconv.Itoa(statusCode)
	}
	return message, code
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	modelName, _ := body["model"].(string)
	if strings.TrimSpace(modelName) == "" {
		modelName, _ = body["origin_model"].(string)
	}
	baseUrl = resolveMiniMaxVideoBaseURL(baseUrl, modelName)
	uri := fmt.Sprintf("%s%s?task_id=%s", baseUrl, QueryTaskEndpoint, taskID)
	if IsVideoGenerationV2(modelName) {
		uri = fmt.Sprintf("%s%s/%s", baseUrl, QueryTaskEndpointV2, taskID)
	}

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

// EstimateBilling multiplies the resolution unit price by video seconds.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	return utils.EstimateResolutionSeconds(c, info.OriginModelName, officialDuration(info.OriginModelName))
}

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (*VideoRequest, error) {
	modelConfig := GetModelConfig(info.UpstreamModelName)
	duration := utils.ResolutionSeconds(*req, officialDuration(info.UpstreamModelName))
	resolution := modelConfig.DefaultResolution
	if req.Resolution != "" {
		resolution = strings.ToUpper(req.Resolution)
	} else if req.Size != "" {
		resolution = a.parseResolutionFromSize(req.Size, modelConfig)
	}

	videoRequest := &VideoRequest{
		Model:      info.UpstreamModelName,
		Prompt:     req.Prompt,
		Duration:   &duration,
		Resolution: resolution,
	}
	if err := req.UnmarshalMetadata(&videoRequest); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata to video request failed")
	}

	return videoRequest, nil
}

func (a *TaskAdaptor) convertToV2RequestPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (*VideoGenerationV2Request, error) {
	modelConfig := GetModelConfig(info.UpstreamModelName)
	duration := utils.ResolutionSeconds(*req, officialDuration(info.UpstreamModelName))
	resolution := normalizeV2Resolution(req.Resolution, req.Size, modelConfig)

	videoRequest := &VideoGenerationV2Request{
		Model:      info.UpstreamModelName,
		Resolution: resolution,
		Duration:   duration,
	}

	if err := taskcommon.UnmarshalMetadata(req.Metadata, videoRequest); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata to v2 video request failed")
	}

	videoRequest.Model = info.UpstreamModelName
	if videoRequest.Duration <= 0 {
		videoRequest.Duration = duration
	}
	if videoRequest.Resolution == "" {
		videoRequest.Resolution = resolution
	} else {
		videoRequest.Resolution = normalizeV2Resolution(videoRequest.Resolution, "", modelConfig)
	}

	if len(videoRequest.Content) == 0 {
		content, err := buildV2Content(req)
		if err != nil {
			return nil, err
		}
		videoRequest.Content = content
	}

	if !hasNonEmptyText(videoRequest.Content) {
		return nil, fmt.Errorf("content must include a non-empty text item (prompt is required)")
	}

	hasMedia := hasV2MediaInput(videoRequest.Content)
	if videoRequest.Ratio == "" {
		if hasMedia {
			videoRequest.Ratio = "adaptive"
		} else if modelConfig.DefaultRatio != "" {
			videoRequest.Ratio = modelConfig.DefaultRatio
		} else {
			videoRequest.Ratio = DefaultRatioH3
		}
	}
	if !hasMedia && strings.EqualFold(videoRequest.Ratio, "adaptive") {
		videoRequest.Ratio = DefaultRatioH3
	}

	return videoRequest, nil
}

func buildV2Content(req *relaycommon.TaskSubmitReq) ([]ContentItem, error) {
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		return nil, fmt.Errorf("prompt is required")
	}

	content := []ContentItem{{
		Type: "text",
		Text: prompt,
	}}

	firstFrame := metadataString(req.Metadata, "first_frame_image")
	lastFrame := metadataString(req.Metadata, "last_frame_image")
	if firstFrame == "" && len(req.Images) > 0 {
		firstFrame = strings.TrimSpace(req.Images[0])
	}
	if lastFrame == "" && len(req.Images) > 1 {
		lastFrame = strings.TrimSpace(req.Images[1])
	}
	if firstFrame == "" && strings.TrimSpace(req.Image) != "" {
		firstFrame = strings.TrimSpace(req.Image)
	}
	if firstFrame == "" && strings.TrimSpace(req.InputReference) != "" {
		firstFrame = strings.TrimSpace(req.InputReference)
	}

	if firstFrame != "" {
		content = append(content, ContentItem{
			Type:     "image_url",
			ImageURL: &MediaURL{URL: firstFrame},
			Role:     "first_frame",
		})
	}
	if lastFrame != "" {
		content = append(content, ContentItem{
			Type:     "image_url",
			ImageURL: &MediaURL{URL: lastFrame},
			Role:     "last_frame",
		})
	}

	return content, nil
}

func hasNonEmptyText(content []ContentItem) bool {
	for _, item := range content {
		if item.Type == "text" && strings.TrimSpace(item.Text) != "" {
			return true
		}
	}
	return false
}

func hasV2MediaInput(content []ContentItem) bool {
	for _, item := range content {
		switch item.Type {
		case "image_url", "video_url", "audio_url":
			return true
		}
		if item.ImageURL != nil || item.VideoURL != nil || item.AudioURL != nil {
			return true
		}
	}
	return false
}

func metadataString(metadata map[string]interface{}, key string) string {
	if metadata == nil {
		return ""
	}
	value, ok := metadata[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}

func normalizeV2Resolution(resolution, size string, modelConfig ModelConfig) string {
	raw := strings.TrimSpace(resolution)
	if raw == "" {
		raw = size
	}
	if raw == "" {
		return modelConfig.DefaultResolution
	}

	normalized := billing_setting.NormalizeResolution(raw)
	switch normalized {
	case "2K":
		return Resolution2K
	case "768P":
		return Resolution768P
	}

	upper := strings.ToUpper(strings.TrimSpace(raw))
	switch upper {
	case Resolution2K:
		return Resolution2K
	case Resolution768P, "768":
		return Resolution768P
	}

	if strings.Contains(strings.ToLower(raw), "2k") {
		return Resolution2K
	}
	if strings.Contains(raw, "768") {
		return Resolution768P
	}
	return modelConfig.DefaultResolution
}

func (a *TaskAdaptor) parseResolutionFromSize(size string, modelConfig ModelConfig) string {
	switch {
	case strings.Contains(size, "1080"):
		return Resolution1080P
	case strings.Contains(size, "768"):
		return Resolution768P
	case strings.Contains(size, "720"):
		return Resolution720P
	case strings.Contains(size, "512"):
		return Resolution512P
	default:
		return modelConfig.DefaultResolution
	}
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	if isV2QueryResponse(respBody) {
		return a.parseV2TaskResult(respBody)
	}
	return a.parseV1TaskResult(respBody)
}

func isV2QueryResponse(respBody []byte) bool {
	var probe struct {
		Task *VideoTaskV2 `json:"task"`
	}
	if err := common.Unmarshal(respBody, &probe); err != nil {
		return false
	}
	return probe.Task != nil
}

func (a *TaskAdaptor) parseV1TaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	resTask := QueryTaskResponse{}
	if err := common.Unmarshal(respBody, &resTask); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{}

	if resTask.BaseResp.StatusCode == StatusSuccess {
		taskResult.Code = 0
	} else {
		taskResult.Code = resTask.BaseResp.StatusCode
		taskResult.Reason = resTask.BaseResp.StatusMsg
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
	}

	switch resTask.Status {
	case TaskStatusPreparing, TaskStatusQueueing, TaskStatusProcessing:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
		if resTask.Status == TaskStatusProcessing {
			taskResult.Progress = "50%"
		}
	case TaskStatusSuccess:
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = a.buildVideoURL(resTask.TaskID, resTask.FileID)
	case TaskStatusFailed:
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		if taskResult.Reason == "" {
			taskResult.Reason = "task failed"
		}
	default:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) parseV2TaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var res QueryTaskV2Response
	if err := common.Unmarshal(respBody, &res); err != nil {
		return nil, errors.Wrap(err, "unmarshal v2 task result failed")
	}
	if res.Task == nil {
		return nil, fmt.Errorf("v2 task result missing task object")
	}

	taskResult := relaycommon.TaskInfo{
		TaskID: res.Task.ID,
	}
	switch res.Task.Status {
	case TaskStatusV2Queued:
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = taskcommon.ProgressQueued
	case TaskStatusV2Running:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "50%"
	case TaskStatusV2Succeeded:
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = taskcommon.ProgressComplete
		if res.Task.Content != nil {
			taskResult.Url = res.Task.Content.URL
		}
	case TaskStatusV2Failed, TaskStatusV2Cancelled:
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = taskcommon.ProgressComplete
		if res.Task.Error != nil {
			taskResult.Reason = res.Task.Error.Message
			if code, err := strconv.Atoi(res.Task.Error.Code); err == nil {
				taskResult.Code = code
			}
		}
		if taskResult.Reason == "" {
			if res.Task.Status == TaskStatusV2Cancelled {
				taskResult.Reason = "task cancelled"
			} else {
				taskResult.Reason = "task failed"
			}
		}
	default:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = taskcommon.ProgressInProgress
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	if isV2QueryResponse(originTask.Data) {
		var v2Resp QueryTaskV2Response
		if err := common.Unmarshal(originTask.Data, &v2Resp); err != nil {
			return nil, errors.Wrap(err, "unmarshal hailuo v2 task data failed")
		}
		openAIVideo := originTask.ToOpenAIVideo()
		if v2Resp.Task != nil && v2Resp.Task.Error != nil {
			openAIVideo.Error = &dto.OpenAIVideoError{
				Message: v2Resp.Task.Error.Message,
				Code:    v2Resp.Task.Error.Code,
			}
		}
		jsonData, err := common.Marshal(openAIVideo)
		if err != nil {
			return nil, errors.Wrap(err, "marshal openai video failed")
		}
		return jsonData, nil
	}

	var hailuoResp QueryTaskResponse
	if err := common.Unmarshal(originTask.Data, &hailuoResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal hailuo task data failed")
	}

	openAIVideo := originTask.ToOpenAIVideo()
	if hailuoResp.BaseResp.StatusCode != StatusSuccess {
		openAIVideo.Error = &dto.OpenAIVideoError{
			Message: hailuoResp.BaseResp.StatusMsg,
			Code:    strconv.Itoa(hailuoResp.BaseResp.StatusCode),
		}
	}

	jsonData, err := common.Marshal(openAIVideo)
	if err != nil {
		return nil, errors.Wrap(err, "marshal openai video failed")
	}

	return jsonData, nil
}

func (a *TaskAdaptor) buildVideoURL(_, fileID string) string {
	if a.apiKey == "" || a.baseURL == "" {
		return ""
	}

	url := fmt.Sprintf("%s/v1/files/retrieve?file_id=%s", a.baseURL, fileID)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return ""
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)

	resp, err := service.GetHttpClient().Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}

	var retrieveResp RetrieveFileResponse
	if err := common.Unmarshal(responseBody, &retrieveResp); err != nil {
		return ""
	}

	if retrieveResp.BaseResp.StatusCode != StatusSuccess {
		return ""
	}

	return retrieveResp.File.DownloadURL
}
