package utils

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// 预扣倍率按官方 token 公式估算整段视频：MiniMax 2K = 2048×1080，
// 5 秒 ≈ 259,200 tokens，乘预扣缓冲后换算成相对基准倍率的乘数。
func TestTaskPrechargeRatioEstimatesWholeClip(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Resolution: "2K",
		Duration:   5,
		Metadata:   map[string]interface{}{"ratio": "16:9"},
	})

	ratio := TaskPrechargeRatio(ctx, "MiniMax-H3")
	expected := 259200 * VideoTokenPrechargeBuffer * 2 / common.QuotaPerUnit
	require.InDelta(t, expected, ratio, 1e-9)

	// 预扣额度 = 基准额度(ratio/2 × QuotaPerUnit) × 预扣倍率，即整段视频的估算额度。
	baseQuota := 1.0 / 2 * common.QuotaPerUnit // ModelRatio = 1 ⇔ $2/M
	require.InDelta(t, 259200*VideoTokenPrechargeBuffer, baseQuota*ratio, 1)
}

// 带视频输入时按输出时长再叠加输入时长估算（上游按输入时长计费）。
func TestTaskPrechargeRatioAddsVideoInputDuration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Resolution: "2K",
		Duration:   5,
		Metadata: map[string]interface{}{
			"ratio": "16:9",
			"content": []interface{}{
				map[string]interface{}{
					"type":      "video_url",
					"video_url": map[string]interface{}{"url": "https://example.com/a.mp4"},
				},
			},
		},
	})

	ratio := TaskPrechargeRatio(ctx, "MiniMax-H3")
	expected := 259200 * 2 * VideoTokenPrechargeBuffer * 2 / common.QuotaPerUnit
	require.InDelta(t, expected, ratio, 1e-9)
}

// 时长缺失时用默认 5 秒；分辨率缺失时用默认档位（不能返回 0 而退回固定预扣）。
func TestTaskPrechargeRatioFallsBackToDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{})

	require.Positive(t, TaskPrechargeRatio(ctx, "MiniMax-H3"))
}

func TestIsVideoTaskAction(t *testing.T) {
	require.True(t, IsVideoTaskAction("generate"))
	require.True(t, IsVideoTaskAction("textGenerate"))
	require.False(t, IsVideoTaskAction("MUSIC"))
	require.False(t, IsVideoTaskAction(""))
}
