package doubao

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/samber/lo"
)

// ============================
// Request / Response structures
// ============================

type ContentItem struct {
	Type     string    `json:"type,omitempty"`
	Text     string    `json:"text,omitempty"`
	ImageURL *MediaURL `json:"image_url,omitempty"`
	VideoURL *MediaURL `json:"video_url,omitempty"`
	AudioURL *MediaURL `json:"audio_url,omitempty"`
	Role     string    `json:"role,omitempty"`
}

type MediaURL struct {
	URL string `json:"url,omitempty"`
}

type requestPayload struct {
	Model                 string         `json:"model"`
	Content               []ContentItem  `json:"content,omitempty"`
	CallbackURL           string         `json:"callback_url,omitempty"`
	ReturnLastFrame       *dto.BoolValue `json:"return_last_frame,omitempty"`
	ServiceTier           string         `json:"service_tier,omitempty"`
	ExecutionExpiresAfter *dto.IntValue  `json:"execution_expires_after,omitempty"`
	GenerateAudio         *dto.BoolValue `json:"generate_audio,omitempty"`
	Draft                 *dto.BoolValue `json:"draft,omitempty"`
	Tools                 []struct {
		Type string `json:"type,omitempty"`
	} `json:"tools,omitempty"`
	SafetyIdentifier string         `json:"safety_identifier,omitempty"`
	Priority         *dto.IntValue  `json:"priority,omitempty"`
	Resolution       string         `json:"resolution,omitempty"`
	Ratio            string         `json:"ratio,omitempty"`
	Duration         *dto.IntValue  `json:"duration,omitempty"`
	Frames           *dto.IntValue  `json:"frames,omitempty"`
	Seed             *dto.IntValue  `json:"seed,omitempty"`
	CameraFixed      *dto.BoolValue `json:"camera_fixed,omitempty"`
	Watermark        *dto.BoolValue `json:"watermark,omitempty"`
}

type responsePayload struct {
	ID string `json:"id"` // task_id
}

type responseTask struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Status  string `json:"status"`
	Content struct {
		VideoURL string `json:"video_url"`
	} `json:"content"`
	Seed            int    `json:"seed"`
	Resolution      string `json:"resolution"`
	Duration        int    `json:"duration"`
	Ratio           string `json:"ratio"`
	FramesPerSecond int    `json:"framespersecond"`
	ServiceTier     string `json:"service_tier"`
	Tools           []struct {
		Type string `json:"type"`
	} `json:"tools"`
	Usage struct {
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
		ToolUsage        struct {
			WebSearch int `json:"web_search"`
		} `json:"tool_usage"`
	} `json:"usage"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
	CreatedAt int64 `json:"created_at"`
	UpdatedAt int64 `json:"updated_at"`
}

// ============================
// Adaptor implementation
// ============================

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

// ValidateRequestAndSetAction parses body, validates fields and sets default action.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *taskdto.TaskError) {
	// Accept only POST /v1/video/generations as "generate" action.
	if taskErr = relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate, relaycommon.WithoutRequiredPrompt()); taskErr != nil {
		return taskErr
	}
	// 方舟原生协议把文本放在 content 数组里，通用解析会丢掉，这里补回快照。
	if taskErr = normalizeSeedanceRequest(c); taskErr != nil {
		return taskErr
	}
	return nil
}

// seedanceNativeFields 是方舟原生提交协议里不在通用 TaskSubmitReq 中的字段。
// 客户端按官方格式提交（顶层 content / ratio / duration / watermark ...）时，
// 这些字段必须搬进 metadata，否则 convertToRequestPayload 不会透传，
// 计费估算也拿不到分辨率、比例和视频素材。
var seedanceNativeFields = []string{
	"content",
	"ratio",
	"aspect_ratio",
	"resolution",
	"duration",
	"watermark",
	"generate_audio",
	"execution_expires_after",
	"seed",
	"camera_fixed",
	"return_last_frame",
	"draft",
	"callback_url",
	"service_tier",
	"priority",
	"frames",
	"safety_identifier",
	"tools",
}

// normalizeSeedanceRequest 把客户端按方舟原生协议提交的字段并入请求快照：
//   - content 里的 text 段落回填到 prompt（否则上游报 "prompt is required"）；
//   - content 及其它原生字段搬进 metadata，供请求体构造与计费估算使用。
func normalizeSeedanceRequest(c *gin.Context) *taskdto.TaskError {
	raw, err := readSeedanceRawBody(c)
	if err != nil || len(raw) == 0 {
		return nil
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	if req.Metadata == nil {
		req.Metadata = make(map[string]interface{}, len(seedanceNativeFields))
	}
	for _, field := range seedanceNativeFields {
		value, ok := raw[field]
		if !ok || value == nil {
			continue
		}
		if _, exists := req.Metadata[field]; exists {
			continue
		}
		req.Metadata[field] = value
	}

	if strings.TrimSpace(req.Prompt) == "" {
		// 客户端给的是 content 数组时，prompt 就是里面的 text 段落。
		req.Prompt = seedancePromptFromContent(raw["content"])
	} else if _, exists := req.Metadata["content"]; !exists {
		// 顶层给了 prompt、content 里没有文本，补一条让上游拿到完整指令。
		req.Metadata["content"] = []interface{}{
			map[string]interface{}{"type": "text", "text": req.Prompt},
		}
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return service.TaskErrorWrapper(fmt.Errorf("prompt is required"), "invalid_request", http.StatusBadRequest)
	}

	// 原生字段同步回通用字段，时长/分辨率/比例参与校验与计费。
	if req.Resolution == "" {
		if v, ok := raw["resolution"].(string); ok {
			req.Resolution = v
		}
	}
	if req.Ratio == "" {
		if v, ok := raw["ratio"].(string); ok {
			req.Ratio = v
		}
	}
	if req.Duration <= 0 && req.Seconds == "" {
		if v, ok := raw["duration"]; ok {
			req.Duration = int(metadataNumber(v))
		}
	}
	relaycommon.StoreTaskRequest(c, req)
	return nil
}

func readSeedanceRawBody(c *gin.Context) (map[string]interface{}, error) {
	storage, err := common.GetRequestBody(c)
	if err != nil {
		return nil, err
	}
	reader, ok := storage.(io.ReadSeeker)
	if !ok {
		return nil, fmt.Errorf("request body is not readable")
	}
	if _, err := reader.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return nil, nil
	}
	var body map[string]interface{}
	if err := common.Unmarshal(data, &body); err != nil {
		return nil, err
	}
	return body, nil
}

// seedancePromptFromContent 取出 content 数组里的文本段落（按出现顺序拼接）。
func seedancePromptFromContent(content interface{}) string {
	items, ok := content.([]interface{})
	if !ok {
		return ""
	}
	texts := make([]string, 0, len(items))
	for _, item := range items {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if itemType, _ := itemMap["type"].(string); itemType != "" && itemType != "text" {
			continue
		}
		text, _ := itemMap["text"].(string)
		if strings.TrimSpace(text) == "" {
			continue
		}
		texts = append(texts, text)
	}
	return strings.Join(texts, "\n")
}

func metadataNumber(value interface{}) float64 {
	switch v := value.(type) {
	case float64:
		return v
	case int:
		return float64(v)
	case string:
		if parsed, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil {
			return parsed
		}
	}
	return 0
}

// BuildRequestURL constructs the upstream URL.
func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/api/v3/contents/generations/tasks", a.baseURL), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

// EstimateBilling 按官网口径估算 token。
//   - ratio 计价（未配置分辨率单价）：返回 precharge，预扣 1.1 倍估算 token；
//   - 分辨率「按百万 token」计价：返回 mega_tokens（估算 token / 1M × 缓冲），
//     因为该模式的预扣基数是「单价 × QuotaPerUnit」，与 ratio 基数不同量纲。
//
// 两种情况都含视频输入时长，并叠加 video_input 单价倍率；
// 结算阶段按上游实际 token 多退少补时会忽略 precharge / mega_tokens。
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	return seedanceEstimateBilling(req, info.OriginModelName, info.UpstreamModelName)
}

// hasVideoInMetadata 直接检查 metadata 的 content 数组是否包含 video_url 条目，
// 避免构建完整的上游 requestPayload。
func hasVideoInMetadata(metadata map[string]interface{}) bool {
	return countVideosInMetadata(metadata) > 0
}

func countVideosInMetadata(metadata map[string]interface{}) int {
	if metadata == nil {
		return 0
	}
	contentRaw, ok := metadata["content"]
	if !ok {
		return 0
	}
	contentSlice, ok := contentRaw.([]interface{})
	if !ok {
		return 0
	}
	count := 0
	for _, item := range contentSlice {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if itemMap["type"] == "video_url" {
			count++
			continue
		}
		if _, has := itemMap["video_url"]; has {
			count++
		}
	}
	return count
}

// BuildRequestBody converts request into Doubao specific format.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	body, err := a.convertToRequestPayload(&req)
	if err != nil {
		return nil, errors.Wrap(err, "convert request payload failed")
	}
	if info.IsModelMapped {
		body.Model = info.UpstreamModelName
	} else {
		info.UpstreamModelName = body.Model
	}
	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

// DoRequest delegates to common helper.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response, returns taskID etc.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *taskdto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	// Parse Doubao response
	var dResp responsePayload
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if dResp.ID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	// 按上游原始格式返回（seedance 官方提交响应为 {"id": "cgt-..."}），
	// 只把 id 换成对外的公有 task id，其余字段保持上游原样。
	payload := make(map[string]interface{}, 4)
	if err := common.Unmarshal(responseBody, &payload); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}
	payload["id"] = info.PublicTaskID

	c.JSON(http.StatusOK, payload)
	return dResp.ID, responseBody, nil
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/api/v3/contents/generations/tasks/%s", baseUrl, taskID)

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
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

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq) (*requestPayload, error) {
	r := requestPayload{
		Model:   req.Model,
		Content: []ContentItem{},
	}

	// Add images if present
	if req.HasImage() {
		for _, imgURL := range req.Images {
			r.Content = append(r.Content, ContentItem{
				Type: "image_url",
				ImageURL: &MediaURL{
					URL: imgURL,
				},
			})
		}
	}

	metadata := req.Metadata
	if err := taskcommon.UnmarshalMetadata(metadata, &r); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}

	if sec, _ := strconv.Atoi(req.Seconds); sec > 0 {
		r.Duration = lo.ToPtr(dto.IntValue(sec))
	}

	r.Content = lo.Reject(r.Content, func(c ContentItem, _ int) bool { return c.Type == "text" })
	// 文本放首位，与方舟官方示例一致；部分上游按 content[0] 取 prompt。
	r.Content = append([]ContentItem{{
		Type: "text",
		Text: req.Prompt,
	}}, r.Content...)

	return &r, nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	resTask := responseTask{}
	if err := common.Unmarshal(respBody, &resTask); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}

	// Map Doubao status to internal status
	switch resTask.Status {
	case "pending", "queued":
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = "10%"
	case "processing", "running":
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "50%"
	case "succeeded":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = resTask.Content.VideoURL
		// 解析 usage 信息用于按倍率计费
		taskResult.CompletionTokens = resTask.Usage.CompletionTokens
		taskResult.TotalTokens = resTask.Usage.TotalTokens
		// 上游返回真实 token 用量，可直接用于按百万 token 结算
		taskResult.TokensFromUsage = taskResult.TotalTokens > 0 || taskResult.CompletionTokens > 0
		if taskResult.TotalTokens <= 0 {
			taskResult.TotalTokens = taskResult.CompletionTokens
		}
	case "failed":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = resTask.Error.Message
	default:
		// Unknown status, treat as processing
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
	}

	return &taskResult, nil
}

// ConvertToOpenAIVideo 查询接口也按上游原始格式返回：直接透出轮询时保存的上游
// 报文（status / content.video_url / usage / error 都是上游自己的字段），
// 只把 id 换成本地公开任务 ID，并补上 model 为客户请求的模型名。
// 提交后尚未轮询到结果时上游报文只有 {"id": ...}，这里按本地状态兜底，
// 避免客户端拿不到 status。
func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	payload := make(map[string]interface{}, 8)
	if len(originTask.Data) > 0 {
		if err := common.Unmarshal(originTask.Data, &payload); err != nil {
			return nil, errors.Wrap(err, "unmarshal doubao task data failed")
		}
	}

	payload["id"] = originTask.TaskID
	if modelName := originTask.Properties.OriginModelName; modelName != "" {
		payload["model"] = modelName
	}
	if status, _ := payload["status"].(string); strings.TrimSpace(status) == "" {
		payload["status"] = doubaoStatusOf(originTask.Status)
	}
	if originTask.Status == model.TaskStatusFailure {
		if _, hasError := payload["error"]; !hasError && strings.TrimSpace(originTask.FailReason) != "" {
			payload["error"] = map[string]interface{}{
				"code":    "TaskFailed",
				"message": originTask.FailReason,
			}
		}
	}

	return common.Marshal(payload)
}

// doubaoStatusOf 把本地状态映射回上游口径（queued / running / succeeded / failed）。
func doubaoStatusOf(status model.TaskStatus) string {
	switch status {
	case model.TaskStatusSuccess:
		return "succeeded"
	case model.TaskStatusFailure:
		return "failed"
	case model.TaskStatusInProgress:
		return "running"
	default:
		return "queued"
	}
}
