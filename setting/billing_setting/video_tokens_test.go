package billing_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/require"
)

func TestEstimateVideoTokensMatchesProviderFormula(t *testing.T) {
	// 火山方舟/Seedance：tokens = 时长 × 宽 × 高 × 24fps / 1024
	require.Equal(t, 108000, EstimateVideoTokens("720P", "16:9", 5))
	require.Equal(t, 486000, EstimateVideoTokens("1080P", "16:9", 10))
	// 1:1 时宽 = 高
	require.Equal(t, 60750, EstimateVideoTokens("720P", "1:1", 5))
	// 竖屏 9:16 → 406×720（宽度取偶数）
	require.Equal(t, 34256, EstimateVideoTokens("720P", "9:16", 5))
}

func TestEstimateVideoTokensDefaultsAndGuards(t *testing.T) {
	// 未知比例回退 16:9；未知分辨率回退 720P
	require.Equal(t, EstimateVideoTokens("720P", "16:9", 5), EstimateVideoTokens("720P", "adaptive", 5))
	require.Equal(t, EstimateVideoTokens("720P", "16:9", 5), EstimateVideoTokens("", "", 5))
	// 非标准标签按数字高度解析：900P → 1600×900
	require.Equal(t, 168750, EstimateVideoTokens("900P", "16:9", 5))
	// 非法时长返回 0
	require.Equal(t, 0, EstimateVideoTokens("720P", "16:9", 0))
	require.Equal(t, 0, EstimateVideoTokens("720P", "16:9", -1))
}

func TestGetResolutionUnitDefaultsToSecond(t *testing.T) {
	require.Equal(t, ResolutionUnitSecond, GetResolutionUnit("unconfigured-model"))
	require.False(t, IsResolutionTokenBilling("unconfigured-model"))
}

func TestResolutionUnitRoundTripsThroughConfig(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":     `{"video-model":"resolution"}`,
		"billing_setting.resolution_unit":  `{"video-model":"million_tokens"}`,
		"billing_setting.resolution_price": `{"video-model":{"720P":0.08}}`,
	}))

	require.Equal(t, ResolutionUnitMillionTokens, GetResolutionUnit("video-model"))
	require.True(t, IsResolutionTokenBilling("video-model"))

	price, ok := GetResolutionPrice("video-model", "720p")
	require.True(t, ok)
	require.Equal(t, 0.08, price)

	// 配置项必须能通过 /api/option/ 暴露给前端
	exported := config.GlobalConfig.ExportAllConfigs()
	require.Equal(t, `{"video-model":"million_tokens"}`, exported["billing_setting."+ResolutionUnitField])
}

// MiniMax 的 "2K" 按 2048×1080 计费，与通用高度表（2K → 1440p）不同。
func TestEstimateVideoTokensForModelUsesProviderArea(t *testing.T) {
	require.Equal(t, 259200, EstimateVideoTokensForModel("MiniMax-H3", "2K", "16:9", 5))
	require.Equal(t, 259200, EstimateVideoTokensForModel("MiniMax-H3-Max", "2K", "9:16", 5))
	require.Equal(t, 122940, EstimateVideoTokensForModel("MiniMax-H3", "768P", "16:9", 5))
	// 480P（864×480）与 1K（上游独立档位，1920×1080）也要按上游像素口径估算。
	require.Equal(t, 48600, EstimateVideoTokensForModel("MiniMax-H3", "480P", "16:9", 5))
	require.Equal(t, 243000, EstimateVideoTokensForModel("MiniMax-H3", "1K", "16:9", 5))

	// 通用模型仍按高度表推算。
	require.Equal(t, 432000, EstimateVideoTokens("2K", "16:9", 5))
	require.Equal(t, 432000, EstimateVideoTokensForModel("doubao-seedance-2-0", "2K", "16:9", 5))
	require.Equal(t, 243000, EstimateVideoTokens("1K", "16:9", 5))
}
