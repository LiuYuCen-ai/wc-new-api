package relay

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newMiniMaxV2Task(data string) *model.Task {
	task := &model.Task{
		ID:         2,
		CreatedAt:  1792739384,
		UpdatedAt:  1792739540,
		TaskID:     "task_W16nDNjUrJkWMQWYSG9x3r22NyDG8uxx",
		Status:     model.TaskStatusInProgress,
		SubmitTime: 1792739384,
		Properties: model.Properties{
			OriginModelName:   "MiniMax-H3",
			UpstreamModelName: "MiniMax-H3",
		},
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "455419582214568",
		},
	}
	if data != "" {
		task.Data = json.RawMessage(data)
	}
	return task
}

func TestMiniMaxV2FetchRespBodyUsesOfficialEnvelope(t *testing.T) {
	task := newMiniMaxV2Task(`{"task":{"id":"455419582214568","model":"MiniMax-H3","status":"running","created_at":1792739384,"updated_at":1792739445,"duration":5,"resolution":"2K","ratio":"16:9","task_type":"generation","usage":{}}}`)

	body, err := miniMaxV2FetchRespBody(task)
	require.NoError(t, err)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(body, &payload))
	require.Contains(t, payload, "task")
	// 官方格式不带 code/data 包装
	assert.NotContains(t, payload, "code")
	assert.NotContains(t, payload, "data")

	got, ok := payload["task"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "455419582214568", got["id"])
	assert.Equal(t, "MiniMax-H3", got["model"])
	assert.Equal(t, "running", got["status"])
	assert.Equal(t, "2K", got["resolution"])
	assert.Equal(t, "16:9", got["ratio"])
	assert.Equal(t, "generation", got["task_type"])
	assert.EqualValues(t, 5, got["duration"])
}

func TestMiniMaxV2FetchRespBodyRefreshesStatusAndIdentity(t *testing.T) {
	// 快照还是 running，但库内已成功：状态必须以库内为准，并补上结果地址。
	task := newMiniMaxV2Task(`{"task":{"id":"stale","status":"running","usage":{"total_tokens":108000}}}`)
	task.Status = model.TaskStatusSuccess
	task.PrivateData.ResultURL = "https://cdn.example.com/out.mp4"

	body, err := miniMaxV2FetchRespBody(task)
	require.NoError(t, err)

	var payload struct {
		Task struct {
			ID      string         `json:"id"`
			Status  string         `json:"status"`
			Content map[string]any `json:"content"`
			Usage   map[string]any `json:"usage"`
		} `json:"task"`
	}
	require.NoError(t, json.Unmarshal(body, &payload))
	assert.Equal(t, "455419582214568", payload.Task.ID)
	assert.Equal(t, "succeeded", payload.Task.Status)
	assert.Equal(t, "https://cdn.example.com/out.mp4", payload.Task.Content["url"])
	assert.EqualValues(t, 108000, payload.Task.Usage["total_tokens"])
}

func TestMiniMaxV2FetchRespBodyWithoutSnapshot(t *testing.T) {
	task := newMiniMaxV2Task("")
	task.Status = model.TaskStatusFailure
	task.FailReason = "content rejected"

	body, err := miniMaxV2FetchRespBody(task)
	require.NoError(t, err)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(body, &payload))
	got, ok := payload["task"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "failed", got["status"])
	assert.Equal(t, "455419582214568", got["id"])
	usage, ok := got["usage"].(map[string]any)
	require.True(t, ok, "usage must be an empty object, not omitted")
	assert.Empty(t, usage)
	errInfo, ok := got["error"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "content rejected", errInfo["message"])
}
