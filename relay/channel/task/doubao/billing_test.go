package doubao

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEstimateSeedanceTokens720p5sMatchesOfficialFormula(t *testing.T) {
	t.Parallel()
	// 1280×720×24fps×5s / 1024 = 108000
	assert.Equal(t, 108000, estimateSeedanceTokens(5, 0, "720p", "16:9"))
}

func TestEstimateSeedanceTokensUsesMaxVideoInputDuration(t *testing.T) {
	t.Parallel()
	outputOnly := estimateSeedanceTokens(5, 0, "720p", "16:9")
	// 2.0 mini 单段视频输入按时长上限 15s 预扣，而不是按输出 5s 估算
	withMaxInput := estimateSeedanceTokens(5, seedanceMaxVideoInputSeconds("doubao-seedance-2-0-mini", 1), "720p", "16:9")
	assert.Equal(t, outputOnly+outputOnly*15/5, withMaxInput)
}

func TestSeedanceMaxVideoInputSecondsUsesSeriesCap(t *testing.T) {
	t.Parallel()
	assert.Equal(t, 15, seedanceMaxVideoInputSeconds("doubao-seedance-2-0-mini", 1))
	assert.Equal(t, 45, seedanceMaxVideoInputSeconds("doubao-seedance-2-0-fast", 3))
	assert.Equal(t, 45, seedanceMaxVideoInputSeconds("doubao-seedance-2-0", 9))
	assert.Equal(t, 30, seedanceMaxVideoInputSeconds("doubao-seedance-2-5", 1))
	assert.Equal(t, 30, seedanceMaxVideoInputSeconds("doubao-seedance-2-5", 10))
}

func TestSeedancePrechargeRatioIs1_1TimesTokenEstimateAgainstPerCallBase(t *testing.T) {
	t.Parallel()
	tokens := 108000
	precharge := seedancePrechargeRatio(tokens)
	// ModelPriceHelperPerCall 基数 = modelRatio/2 * QuotaPerUnit
	// 目标预扣 = tokens * 1.1 * modelRatio  => precharge = tokens * 2.2 / QuotaPerUnit
	assert.InDelta(t, float64(tokens)*2.2/common.QuotaPerUnit, precharge, 1e-12)
}

func TestSeedanceEstimateBillingAddsPrechargeAndVideoInput(t *testing.T) {
	t.Parallel()
	req := relaycommon.TaskSubmitReq{
		Duration: 5,
		Metadata: map[string]interface{}{
			"resolution": "720p",
			"ratio":      "16:9",
			"content": []interface{}{
				map[string]interface{}{"type": "video_url", "video_url": map[string]interface{}{"url": "https://example.com/a.mp4"}},
			},
		},
	}
	ratios := seedanceEstimateBilling(req, "doubao-seedance-2-0-mini", "")
	require.NotEmpty(t, ratios)
	assert.InDelta(t, 14.0/23.0, ratios["video_input"], 1e-9)
	tokens := estimateSeedanceTokens(5, seedanceMaxVideoInputSeconds("doubao-seedance-2-0-mini", 1), "720p", "16:9")
	assert.InDelta(t, seedancePrechargeRatio(tokens), ratios[constant.TaskOtherRatioPrecharge], 1e-12)
}

func TestSeedanceEstimateBillingNoVideoStillPrecharges(t *testing.T) {
	t.Parallel()
	req := relaycommon.TaskSubmitReq{
		Duration: 5,
		Metadata: map[string]interface{}{"resolution": "720p", "ratio": "16:9"},
	}
	ratios := seedanceEstimateBilling(req, "doubao-seedance-2-0", "")
	require.NotEmpty(t, ratios)
	_, hasVideoInput := ratios["video_input"]
	assert.False(t, hasVideoInput)
	tokens := estimateSeedanceTokens(5, 0, "720p", "16:9")
	assert.InDelta(t, seedancePrechargeRatio(tokens), ratios[constant.TaskOtherRatioPrecharge], 1e-12)
}

func TestSeedanceRequestedDurationAutoUsesSeriesMax(t *testing.T) {
	t.Parallel()
	req := relaycommon.TaskSubmitReq{Duration: -1}
	assert.Equal(t, 30, seedanceRequestedDuration(req, "doubao-seedance-2-5"))
	assert.Equal(t, 15, seedanceRequestedDuration(req, "doubao-seedance-2-0-mini"))
}

func TestGetVideoInputRatioFallsBackToOfficialTable(t *testing.T) {
	t.Parallel()
	ratio, ok := GetVideoInputRatio("doubao-seedance-2-0", "720p", true)
	require.True(t, ok)
	assert.InDelta(t, 28.0/46.0, ratio, 1e-9)

	ratio, ok = GetVideoInputRatio("doubao-seedance-2-0", "1080p", false)
	require.True(t, ok)
	assert.InDelta(t, 51.0/46.0, ratio, 1e-9)
}

func TestGetVideoInputRatioUsesConfiguredPrices(t *testing.T) {
	saved := billing_setting.GetVideoInputPriceCopy()
	t.Cleanup(func() {
		billing_setting.ReplaceVideoInputPrice(saved)
	})
	billing_setting.ReplaceVideoInputPrice(map[string]billing_setting.VideoInputPricing{
		"doubao-seedance-2-0": {NoVideo: 40, Video: 20},
	})

	// 配置优先：基准档 video_input = 20/40，与官方一致。
	ratio, ok := GetVideoInputRatio("doubao-seedance-2-0", "720p", true)
	require.True(t, ok)
	assert.InDelta(t, 0.5, ratio, 1e-9)

	// 1080p 保持官方相对折扣（31/28）：20 × 31/28 / 40。
	ratio, ok = GetVideoInputRatio("doubao-seedance-2-0", "1080p", true)
	require.True(t, ok)
	assert.InDelta(t, 20.0*31.0/28.0/40.0, ratio, 1e-9)

	// 无视频输入基准档倍率为 1（配置即基准价）。
	ratio, ok = GetVideoInputRatio("doubao-seedance-2-0", "720p", false)
	require.True(t, ok)
	assert.InDelta(t, 1.0, ratio, 1e-9)
}

func TestSeedanceEstimateBillingAppliesConfiguredOverride(t *testing.T) {
	saved := billing_setting.GetVideoInputPriceCopy()
	t.Cleanup(func() {
		billing_setting.ReplaceVideoInputPrice(saved)
	})
	billing_setting.ReplaceVideoInputPrice(map[string]billing_setting.VideoInputPricing{
		"doubao-seedance-2-0": {NoVideo: 40, Video: 20},
	})

	req := relaycommon.TaskSubmitReq{
		Duration: 5,
		Metadata: map[string]interface{}{"resolution": "720p", "ratio": "16:9"},
	}
	// 基准价由 ModelRatio 直接表达配置的无视频单价，预扣只带 precharge。
	ratios := seedanceEstimateBilling(req, "doubao-seedance-2-0", "")
	require.NotEmpty(t, ratios)
	_, hasBasePrice := ratios[constant.TaskOtherRatioBasePrice]
	assert.False(t, hasBasePrice)
	_, hasVideoInput := ratios[constant.TaskOtherRatioVideoInput]
	assert.False(t, hasVideoInput)

	withVideo := req
	withVideo.Metadata = map[string]interface{}{
		"resolution": "720p",
		"ratio":      "16:9",
		"content": []interface{}{
			map[string]interface{}{"type": "video_url", "video_url": map[string]interface{}{"url": "https://example.com/a.mp4"}},
		},
	}
	videoRatios := seedanceEstimateBilling(withVideo, "doubao-seedance-2-0", "")
	assert.InDelta(t, 0.5, videoRatios[constant.TaskOtherRatioVideoInput], 1e-9)
	_, hasBasePrice = videoRatios[constant.TaskOtherRatioBasePrice]
	assert.False(t, hasBasePrice)
}
