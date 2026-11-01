package doubao

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 查询接口按上游原始格式返回：content / usage / status 都是上游字段，
// 只有 id 换成本地公开任务 ID，model 保持客户请求的模型名。
func TestConvertToOpenAIVideoReturnsUpstreamPayload(t *testing.T) {
	upstream := `{
"content": {"video_url": "https://example.com/a.mp4"},
"created_at": 1793350578,
"duration": 5,
"framespersecond": 24,
"id": "cgt-20261030165617-oqer7",
"model": "seedance-2.0",
"ratio": "16:9",
"resolution": "720p",
"status": "succeeded",
"usage": {"completion_tokens": 108900, "total_tokens": 108900},
"updated_at": 1793350734
}`
	task := &model.Task{
		TaskID: "task_aISkokTNyTehO4jQe01RCQ1up1saaHym",
		Status: model.TaskStatusSuccess,
		Data:   []byte(upstream),
	}
	task.Properties.OriginModelName = "doubao-seedance-2-0"

	data, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)
	require.NoError(t, err)

	var payload map[string]interface{}
	require.NoError(t, json.Unmarshal(data, &payload))

	assert.Equal(t, "task_aISkokTNyTehO4jQe01RCQ1up1saaHym", payload["id"])
	assert.Equal(t, "doubao-seedance-2-0", payload["model"])
	assert.Equal(t, "succeeded", payload["status"])
	assert.Equal(t, "16:9", payload["ratio"])
	content, ok := payload["content"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "https://example.com/a.mp4", content["video_url"])
	usage, ok := payload["usage"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(108900), usage["completion_tokens"])
	// 不再出现 OpenAI video 的 object / progress / metadata.url 包装
	assert.NotContains(t, payload, "object")
	assert.NotContains(t, payload, "progress")
	assert.NotContains(t, payload, "metadata")
}

// 刚提交、还没轮询到结果时上游报文只有 {"id": ...}，要按本地状态兜底 status。
func TestConvertToOpenAIVideoFallsBackToLocalStatus(t *testing.T) {
	task := &model.Task{
		TaskID: "task_queued",
		Status: model.TaskStatusQueued,
		Data:   []byte(`{"id":"cgt-20261030165617-oqer7"}`),
	}
	task.Properties.OriginModelName = "doubao-seedance-2-0"

	data, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)
	require.NoError(t, err)

	var payload map[string]interface{}
	require.NoError(t, json.Unmarshal(data, &payload))
	assert.Equal(t, "task_queued", payload["id"])
	assert.Equal(t, "queued", payload["status"])
}

// 上游没有回报文（例如超时被判失败）时，用本地失败原因补一个上游风格的 error。
func TestConvertToOpenAIVideoBuildsFailureError(t *testing.T) {
	task := &model.Task{
		TaskID:     "task_failed",
		Status:     model.TaskStatusFailure,
		FailReason: `{"error":{"code":"invalid_request","message":"prompt is required"}}`,
	}
	task.Properties.OriginModelName = "doubao-seedance-2-0"

	data, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)
	require.NoError(t, err)

	var payload map[string]interface{}
	require.NoError(t, json.Unmarshal(data, &payload))
	assert.Equal(t, "failed", payload["status"])
	errObj, ok := payload["error"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "TaskFailed", errObj["code"])
	assert.Contains(t, errObj["message"], "prompt is required")
}
