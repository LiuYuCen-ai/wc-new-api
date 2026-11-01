package doubao

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 客户端按方舟原生协议提交的请求体：文本和素材都在 content 数组里。
const seedanceNativeBody = `{
  "model": "doubao-seedance-2-0",
  "content": [
    {"type": "text", "text": "一只猫在海边奔跑，电影感，夕阳，720p"},
    {
      "type": "image_url",
      "image_url": {"url": "https://cdn.translate.alibaba.com/r/wanx-demo-1.png"},
      "role": "reference_image"
    }
  ],
  "ratio": "16:9",
  "duration": 4,
  "resolution": "720p",
  "execution_expires_after": 3600,
  "watermark": false,
  "generate_audio": false
}`

func newSeedanceNativeContext(t *testing.T, body string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	storage, err := common.CreateBodyStorage([]byte(body))
	require.NoError(t, err)
	c.Set(common.KeyBodyStorage, storage)
	c.Request = httptest.NewRequest("POST", "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

// content 里的 text 段落必须回填成 prompt，原生顶层字段必须进 metadata，
// 否则上游收到空 prompt 直接失败（prompt is required）。
func TestNormalizeSeedanceRequestKeepsNativeContent(t *testing.T) {
	c := newSeedanceNativeContext(t, seedanceNativeBody)
	// 通用解析 TaskSubmitReq 拿不到 content，只有 model 这类字段
	relaycommon.StoreTaskRequest(c, relaycommon.TaskSubmitReq{Model: "doubao-seedance-2-0"})

	require.Nil(t, normalizeSeedanceRequest(c))

	req, err := relaycommon.GetTaskRequest(c)
	require.NoError(t, err)
	assert.Equal(t, "一只猫在海边奔跑，电影感，夕阳，720p", req.Prompt)
	assert.Equal(t, "720p", req.Resolution)
	assert.Equal(t, "16:9", req.Ratio)
	assert.Equal(t, 4, req.Duration)

	// 计费估算要看得到分辨率与比例，并把 content 里的素材算进去
	ratios := seedanceEstimateBilling(req, "doubao-seedance-2-0", "")
	require.NotEmpty(t, ratios)
	_, hasVideoInput := ratios[constant.TaskOtherRatioVideoInput]
	assert.False(t, hasVideoInput, "参考图不是视频输入，不应叠加 video_input 倍率")
	assert.NotContains(t, ratios, constant.TaskOtherRatioVideoInput)

	// 上游请求体：prompt 以 text 段落回填，其他原生字段原样透传
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}, TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	info.OriginModelName = "doubao-seedance-2-0"
	info.UpstreamModelName = "seedance-2.0"
	info.IsModelMapped = true

	reader, err := (&TaskAdaptor{}).BuildRequestBody(c, info)
	require.NoError(t, err)
	data, err := io.ReadAll(reader)
	require.NoError(t, err)

	var payload map[string]interface{}
	require.NoError(t, json.Unmarshal(data, &payload))
	assert.Equal(t, "seedance-2.0", payload["model"])
	assert.Equal(t, "16:9", payload["ratio"])
	assert.Equal(t, "720p", payload["resolution"])
	assert.Equal(t, float64(4), payload["duration"])
	assert.Equal(t, float64(3600), payload["execution_expires_after"])
	assert.Equal(t, false, payload["watermark"])
	assert.Equal(t, false, payload["generate_audio"])

	content, ok := payload["content"].([]interface{})
	require.True(t, ok)
	require.Len(t, content, 2)
	textItem, _ := content[0].(map[string]interface{})
	assert.Equal(t, "text", textItem["type"])
	assert.Equal(t, "一只猫在海边奔跑，电影感，夕阳，720p", textItem["text"])
	imageItem, _ := content[1].(map[string]interface{})
	assert.Equal(t, "image_url", imageItem["type"])
	assert.Equal(t, "reference_image", imageItem["role"])
}

// 顶层给 prompt、content 只放素材时，也要把 prompt 补成 text 段落发给上游。
func TestNormalizeSeedanceRequestAddsPromptAsTextItem(t *testing.T) {
	body := `{
  "model": "doubao-seedance-2-0",
  "prompt": "海浪拍岸",
  "content": [
    {"type": "image_url", "image_url": {"url": "https://example.com/a.png"}}
  ],
  "resolution": "1080p"
}`
	c := newSeedanceNativeContext(t, body)
	relaycommon.StoreTaskRequest(c, relaycommon.TaskSubmitReq{Model: "doubao-seedance-2-0", Prompt: "海浪拍岸"})

	require.Nil(t, normalizeSeedanceRequest(c))

	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}, TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	info.OriginModelName = "doubao-seedance-2-0"
	reader, err := (&TaskAdaptor{}).BuildRequestBody(c, info)
	require.NoError(t, err)
	data, err := io.ReadAll(reader)
	require.NoError(t, err)

	var payload map[string]interface{}
	require.NoError(t, json.Unmarshal(data, &payload))
	content, ok := payload["content"].([]interface{})
	require.True(t, ok)
	require.Len(t, content, 2)
	textItem, _ := content[0].(map[string]interface{})
	assert.Equal(t, "text", textItem["type"])
	assert.Equal(t, "海浪拍岸", textItem["text"])
	imageItem, _ := content[1].(map[string]interface{})
	assert.Equal(t, "image_url", imageItem["type"])
}

// 既没有 prompt 也没有 text 段落时，本地直接报错，不要让上游建一个必然失败的任务。
func TestNormalizeSeedanceRequestRejectsMissingPrompt(t *testing.T) {
	body := `{"model":"doubao-seedance-2-0","content":[{"type":"image_url","image_url":{"url":"https://example.com/a.png"}}]}`
	c := newSeedanceNativeContext(t, body)
	relaycommon.StoreTaskRequest(c, relaycommon.TaskSubmitReq{Model: "doubao-seedance-2-0"})

	taskErr := normalizeSeedanceRequest(c)
	require.NotNil(t, taskErr)
	assert.Contains(t, strings.ToLower(taskErr.Message), "prompt")
}
