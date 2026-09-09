package hailuo

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertToV2RequestPayloadTextToVideo(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := &relaycommon.TaskSubmitReq{
		Prompt:     "a boy plays basketball by the sea",
		Resolution: "2k",
		Duration:   8,
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: ModelMiniMaxH3},
	}

	body, err := adaptor.convertToV2RequestPayload(req, info)
	require.NoError(t, err)
	require.NotNil(t, body)
	assert.Equal(t, ModelMiniMaxH3, body.Model)
	assert.Equal(t, Resolution2K, body.Resolution)
	assert.Equal(t, 8, body.Duration)
	assert.Equal(t, DefaultRatioH3, body.Ratio)
	require.Len(t, body.Content, 1)
	assert.Equal(t, "text", body.Content[0].Type)
	assert.Equal(t, "a boy plays basketball by the sea", body.Content[0].Text)
}

func TestConvertToV2RequestPayloadUsesSubmittedRatio(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := &relaycommon.TaskSubmitReq{
		Prompt:     "a boy plays basketball by the sea",
		Resolution: "768p",
		Duration:   6,
		Ratio:      "9:16",
		Metadata: map[string]interface{}{
			"ratio": "4:5",
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: ModelMiniMaxH3},
	}

	body, err := adaptor.convertToV2RequestPayload(req, info)
	require.NoError(t, err)
	assert.Equal(t, "4:5", body.Ratio)
}

func TestConvertToV2RequestPayloadUsesTopLevelRatio(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := &relaycommon.TaskSubmitReq{
		Prompt: "a lantern rising over an old town",
		Ratio:  "21:9",
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: ModelMiniMaxH3},
	}

	body, err := adaptor.convertToV2RequestPayload(req, info)
	require.NoError(t, err)
	assert.Equal(t, "21:9", body.Ratio)
}

func TestConvertToV2RequestPayloadImageToVideo(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := &relaycommon.TaskSubmitReq{
		Prompt: "pull focus to the people in the background",
		Images: []string{
			"https://example.com/first.png",
			"https://example.com/last.png",
		},
		Resolution: "768p",
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: ModelMiniMaxH3},
	}

	body, err := adaptor.convertToV2RequestPayload(req, info)
	require.NoError(t, err)
	assert.Equal(t, Resolution768P, body.Resolution)
	assert.Equal(t, DefaultDurationH3, body.Duration)
	assert.Equal(t, "adaptive", body.Ratio)
	require.Len(t, body.Content, 3)
	assert.Equal(t, "text", body.Content[0].Type)
	assert.Equal(t, "image_url", body.Content[1].Type)
	assert.Equal(t, "first_frame", body.Content[1].Role)
	assert.Equal(t, "https://example.com/first.png", body.Content[1].ImageURL.URL)
	assert.Equal(t, "last_frame", body.Content[2].Role)
}

func TestConvertToV2RequestPayloadReferenceVideoAndAudio(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := &relaycommon.TaskSubmitReq{
		Prompt: "character speaks with the reference timbre",
		Metadata: map[string]interface{}{
			"reference_image": "https://example.com/ref.png",
			"video_url":       "https://example.com/ref.mp4",
			"audio_url":       "https://example.com/ref.mp3",
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: ModelMiniMaxH3},
	}

	body, err := adaptor.convertToV2RequestPayload(req, info)
	require.NoError(t, err)
	assert.Equal(t, "adaptive", body.Ratio)
	require.Len(t, body.Content, 4)
	assert.Equal(t, "reference_image", body.Content[1].Role)
	assert.Equal(t, "https://example.com/ref.png", body.Content[1].ImageURL.URL)
	assert.Equal(t, "video_url", body.Content[2].Type)
	assert.Equal(t, "reference_video", body.Content[2].Role)
	assert.Equal(t, "https://example.com/ref.mp4", body.Content[2].VideoURL.URL)
	assert.Equal(t, "audio_url", body.Content[3].Type)
	assert.Equal(t, "reference_audio", body.Content[3].Role)
	assert.Equal(t, "https://example.com/ref.mp3", body.Content[3].AudioURL.URL)
}

func TestConvertToV2RequestPayloadMultipleReferenceImagesAndVideos(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := &relaycommon.TaskSubmitReq{
		Prompt: "keep the same character across clips",
		Metadata: map[string]interface{}{
			"reference_images": []interface{}{
				"https://example.com/a.png",
				"https://example.com/b.png",
			},
			"video_urls": []interface{}{
				"https://example.com/a.mp4",
				"https://example.com/b.mp4",
			},
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: ModelMiniMaxH3},
	}

	body, err := adaptor.convertToV2RequestPayload(req, info)
	require.NoError(t, err)
	require.Len(t, body.Content, 5)
	assert.Equal(t, "reference_image", body.Content[1].Role)
	assert.Equal(t, "https://example.com/a.png", body.Content[1].ImageURL.URL)
	assert.Equal(t, "reference_image", body.Content[2].Role)
	assert.Equal(t, "https://example.com/b.png", body.Content[2].ImageURL.URL)
	assert.Equal(t, "reference_video", body.Content[3].Role)
	assert.Equal(t, "https://example.com/a.mp4", body.Content[3].VideoURL.URL)
	assert.Equal(t, "reference_video", body.Content[4].Role)
	assert.Equal(t, "https://example.com/b.mp4", body.Content[4].VideoURL.URL)
}

func TestConvertToV2RequestPayloadUsesImageAsReferenceWhenVideoPresent(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := &relaycommon.TaskSubmitReq{
		Prompt: "follow the motion in the clip",
		Image:  "https://example.com/first.png",
		Metadata: map[string]interface{}{
			"video_url": "https://example.com/ref.mp4",
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: ModelMiniMaxH3},
	}

	body, err := adaptor.convertToV2RequestPayload(req, info)
	require.NoError(t, err)
	require.Len(t, body.Content, 3)
	assert.Equal(t, "reference_image", body.Content[1].Role)
	assert.Equal(t, "reference_video", body.Content[2].Role)
}

func TestConvertToV2RequestPayloadRejectsEmptyPrompt(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := &relaycommon.TaskSubmitReq{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: ModelMiniMaxH3},
	}

	_, err := adaptor.convertToV2RequestPayload(req, info)
	require.Error(t, err)
}

func TestBuildRequestURLUsesV2ForH3(t *testing.T) {
	adaptor := &TaskAdaptor{baseURL: "https://api.minimaxi.com"}
	url, err := adaptor.BuildRequestURL(&relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: ModelMiniMaxH3},
	})
	require.NoError(t, err)
	assert.Equal(t, "https://api.minimaxi.com"+TextToVideoEndpointV2, url)

	url, err = adaptor.BuildRequestURL(&relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "MiniMax-Hailuo-02"},
	})
	require.NoError(t, err)
	assert.Equal(t, "https://api.minimaxi.com"+TextToVideoEndpoint, url)
}

func TestBuildRequestURLRewritesLegacyMiniMaxChatHostForH3(t *testing.T) {
	adaptor := &TaskAdaptor{baseURL: "https://api.minimax.chat"}
	url, err := adaptor.BuildRequestURL(&relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: ModelMiniMaxH3},
	})
	require.NoError(t, err)
	assert.Equal(t, "https://api.minimaxi.com"+TextToVideoEndpointV2, url)
}

func TestParseV2CreateTaskIDAcceptsFlatAndWrappedPayloads(t *testing.T) {
	taskID, err := parseV2CreateTaskID([]byte(`{"task_id":"424010985738629"}`))
	require.NoError(t, err)
	assert.Equal(t, "424010985738629", taskID)

	taskID, err = parseV2CreateTaskID([]byte(`{"task":{"id":"424010985738629","status":"queued"}}`))
	require.NoError(t, err)
	assert.Equal(t, "424010985738629", taskID)
}

func TestResolveMiniMaxVideoBaseURL(t *testing.T) {
	assert.Equal(t, "https://api.minimaxi.com", resolveMiniMaxVideoBaseURL("https://api.minimax.chat", ModelMiniMaxH3))
	assert.Equal(t, "https://api.minimax.chat", resolveMiniMaxVideoBaseURL("https://api.minimax.chat", "MiniMax-Hailuo-02"))
	assert.Equal(t, "https://custom.example.com", resolveMiniMaxVideoBaseURL("https://custom.example.com", ModelMiniMaxH3))
}

func TestFetchTaskUsesV2PathForH3(t *testing.T) {
	assert.True(t, IsVideoGenerationV2(ModelMiniMaxH3))
	assert.False(t, IsVideoGenerationV2("MiniMax-Hailuo-02"))

	taskID := "424010985738629"
	uri := "https://api.minimaxi.com" + QueryTaskEndpoint + "?task_id=" + taskID
	if IsVideoGenerationV2(ModelMiniMaxH3) {
		uri = "https://api.minimaxi.com" + QueryTaskEndpointV2 + "/" + taskID
	}
	assert.Equal(t, "https://api.minimaxi.com/v2/query/video_generation/424010985738629", uri)
}

func TestParseV2TaskResultSucceeded(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"task": {
			"id": "424010985738629",
			"model": "MiniMax-H3",
			"status": "succeeded",
			"content": {"url": "https://cdn.example.com/out.mp4"},
			"resolution": "2K",
			"duration": 5
		}
	}`)

	info, err := adaptor.ParseTaskResult(body)
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusSuccess), info.Status)
	assert.Equal(t, "100%", info.Progress)
	assert.Equal(t, "https://cdn.example.com/out.mp4", info.Url)
}

func TestParseV2TaskResultFailed(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"task": {
			"id": "424010985738630",
			"status": "failed",
			"error": {"code": "1026", "message": "sensitive content"}
		}
	}`)

	info, err := adaptor.ParseTaskResult(body)
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusFailure), info.Status)
	assert.Equal(t, "sensitive content", info.Reason)
	assert.Equal(t, 1026, info.Code)
}

func TestParseV1TaskResultStillWorks(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"task_id": "106916112212032",
		"status": "Processing",
		"base_resp": {"status_code": 0, "status_msg": "success"}
	}`)

	info, err := adaptor.ParseTaskResult(body)
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusInProgress), info.Status)
	assert.Equal(t, "50%", info.Progress)
}

func TestParseV2Error(t *testing.T) {
	msg, code := parseV2Error([]byte(`{
		"type": "error",
		"error": {
			"type": "bad_request_error",
			"message": "invalid params (2013)",
			"http_code": "400"
		}
	}`), http.StatusBadRequest)
	assert.Equal(t, "invalid params (2013)", msg)
	assert.Equal(t, "bad_request_error", code)
}

func TestOfficialDurationForH3(t *testing.T) {
	assert.Equal(t, DefaultDurationH3, officialDuration(ModelMiniMaxH3))
	assert.Equal(t, 6, officialDuration("MiniMax-Hailuo-02"))
}

func TestInjectPromptFromMiniMaxContentFillsTopLevelPrompt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	payload := []byte(`{
		"model":"MiniMax-H3",
		"content":[{"type":"text","text":"史诗级太空歌剧"}],
		"resolution":"768P",
		"duration":5
	}`)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v2/video_generation", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	require.NoError(t, injectPromptFromMiniMaxContent(ctx))

	var req map[string]interface{}
	require.NoError(t, common.UnmarshalBodyReusable(ctx, &req))
	assert.Equal(t, "史诗级太空歌剧", req["prompt"])
}
