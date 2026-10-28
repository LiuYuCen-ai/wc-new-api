package utils

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestEstimateResolutionSecondsUsesRequestDuration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingMode(t, "video-model", "resolution")

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Resolution: "1080p",
		Duration:   8,
	})

	require.Equal(t, map[string]float64{"seconds": 8}, EstimateResolutionSeconds(ctx, "video-model", 5))
}

func TestEstimateResolutionSecondsFallsBackToOfficialSeconds(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingMode(t, "video-model", "resolution")

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Resolution: "720p"})

	require.Equal(t, map[string]float64{"seconds": 6}, EstimateResolutionSeconds(ctx, "video-model", 6))
}

func TestEstimateResolutionSecondsSkippedWhenNotResolutionMode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Duration: 8})

	require.Nil(t, EstimateResolutionSeconds(ctx, "video-model", 5))
}

func TestResolutionSecondsReadsSecondsField(t *testing.T) {
	require.Equal(t, 10, ResolutionSeconds(relaycommon.TaskSubmitReq{Seconds: "10"}, 5))
	require.Equal(t, 5, ResolutionSeconds(relaycommon.TaskSubmitReq{}, 5))
}

// 按秒计费对所有视频模型生效：即使适配器没有返回任何估算倍率，
// 也要按请求时长（或默认 5 秒）乘上去。
func TestResolutionBillingRatiosDefaultsToSecondsForEveryVideoModel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingSetting(t, map[string]string{
		"billing_setting.billing_mode": `{"video-model":"resolution"}`,
	})

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Resolution: "1080p"})

	ratios := ResolutionBillingRatios(ctx, "video-model", nil)
	require.Equal(t, map[string]float64{"seconds": 5}, ratios)
}

func TestResolutionBillingRatiosConvertsSecondsToMegaTokens(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingSetting(t, map[string]string{
		"billing_setting.billing_mode":    `{"video-model":"resolution"}`,
		"billing_setting.resolution_unit": `{"video-model":"million_tokens"}`,
	})

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Resolution: "720p",
		Duration:   5,
		Metadata:   map[string]any{"ratio": "16:9"},
	})

	ratios := ResolutionBillingRatios(ctx, "video-model", map[string]float64{"seconds": 5})
	// 720P 16:9 × 5s → 1280×720×24×5/1024 = 108,000 tokens → 0.108 × 预扣缓冲
	require.InDelta(t, 0.108*VideoTokenPrechargeBuffer, ratios[ResolutionTokensRatioKey], 1e-9)
	require.NotContains(t, ratios, ResolutionSecondsRatioKey)
}

func TestResolutionBillingRatiosKeepsAdaptorMultipliers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingSetting(t, map[string]string{
		"billing_setting.billing_mode":    `{"video-model":"resolution"}`,
		"billing_setting.resolution_unit": `{"video-model":"million_tokens"}`,
	})

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Resolution: "720p", Duration: 10})

	ratios := ResolutionBillingRatios(ctx, "video-model", map[string]float64{
		"seconds":     10,
		"video_input": 0.6,
	})
	require.InDelta(t, 0.6, ratios["video_input"], 1e-9)
	// 10s 720P → 216,000 tokens → 0.216 after the pre-charge buffer
	require.InDelta(t, 0.216*VideoTokenPrechargeBuffer, ratios[ResolutionTokensRatioKey], 1e-9)
	require.NotContains(t, ratios, ResolutionSecondsRatioKey)
}

// seedance 等自带 token 预估（precharge）的适配器保持原有计费逻辑：
// 即使模型被配置为「分辨率 + 按百万 token」，也不套用前端单价。
func TestResolutionBillingRatiosKeepsAdaptorOwnedTokenBilling(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingSetting(t, map[string]string{
		"billing_setting.billing_mode":     `{"video-model":"resolution"}`,
		"billing_setting.resolution_unit":  `{"video-model":"million_tokens"}`,
		"billing_setting.resolution_price": `{"video-model":{"720P":0.08}}`,
	})

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Resolution: "720p", Duration: 5})

	adaptorRatios := map[string]float64{
		"video_input":                    1.2,
		constant.TaskOtherRatioPrecharge: 118.8,
	}

	require.True(t, AdaptorOwnsTokenBilling(adaptorRatios))
	require.Equal(t, adaptorRatios, ResolutionBillingRatios(ctx, "video-model", adaptorRatios))
	require.False(t, AdaptorOwnsTokenBilling(map[string]float64{"seconds": 5}))
}

func TestResolutionBillingRatiosPassthroughForOtherBillingModes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Duration: 8})

	in := map[string]float64{"seconds": 8}
	require.Equal(t, in, ResolutionBillingRatios(ctx, "unknown-model", in))
}

func loadBillingMode(t *testing.T, model, mode string) {
	t.Helper()
	loadBillingSetting(t, map[string]string{
		"billing_setting.billing_mode": `{"` + model + `":"` + mode + `"}`,
	})
}

func loadBillingSetting(t *testing.T, values map[string]string) {
	t.Helper()
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(values))
}
