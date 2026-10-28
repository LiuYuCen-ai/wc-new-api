package billing_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetVideoInputModelRatioFollowsDisplayCurrency(t *testing.T) {
	savedPrices := GetVideoInputPriceCopy()
	savedDisplay := operation_setting.GetGeneralSetting().QuotaDisplayType
	savedRate := operation_setting.USDExchangeRate
	t.Cleanup(func() {
		ReplaceVideoInputPrice(savedPrices)
		operation_setting.GetGeneralSetting().QuotaDisplayType = savedDisplay
		operation_setting.USDExchangeRate = savedRate
	})

	ReplaceVideoInputPrice(map[string]VideoInputPricing{
		"MiniMax-H3": {NoVideo: 2, Video: 3},
	})
	operation_setting.USDExchangeRate = 7.3

	// 美元展示：配置 2 即 $2/百万 token，倍率 = 2/2 = 1，不做汇率换算。
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	ratio, ok := GetVideoInputModelRatio("MiniMax-H3")
	require.True(t, ok)
	assert.InDelta(t, 1.0, ratio, 1e-9)

	// 人民币展示：配置 2 即 ¥2/百万 token，按汇率折算为美元后减半。
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeCNY
	ratio, ok = GetVideoInputModelRatio("MiniMax-H3")
	require.True(t, ok)
	assert.InDelta(t, 2.0/7.3/2, ratio, 1e-9)

	// 未配置的模型不推导，交由调用方沿用 ModelRatio。
	_, ok = GetVideoInputModelRatio("gpt-4o")
	assert.False(t, ok)
}

func TestGetVideoInputModelRatioFallsBackToVideoPrice(t *testing.T) {
	savedPrices := GetVideoInputPriceCopy()
	savedDisplay := operation_setting.GetGeneralSetting().QuotaDisplayType
	t.Cleanup(func() {
		ReplaceVideoInputPrice(savedPrices)
		operation_setting.GetGeneralSetting().QuotaDisplayType = savedDisplay
	})

	ReplaceVideoInputPrice(map[string]VideoInputPricing{
		"doubao-seedance-2-0": {Video: 8},
	})
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD

	ratio, ok := GetVideoInputModelRatio("doubao-seedance-2-0")
	require.True(t, ok)
	assert.InDelta(t, 4.0, ratio, 1e-9)
}
