package doubao

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
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
