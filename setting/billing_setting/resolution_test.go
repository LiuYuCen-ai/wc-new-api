package billing_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeResolution(t *testing.T) {
	t.Parallel()

	tests := []struct {
		raw  string
		want string
	}{
		{raw: "", want: "720P"},
		{raw: "720P", want: "720P"},
		{raw: "720p", want: "720P"},
		{raw: "720", want: "720P"},
		{raw: "768p", want: "768P"},
		{raw: "1080P", want: "1080P"},
		{raw: "2K", want: "2K"},
		{raw: "4k", want: "4K"},
		{raw: "1920x1080", want: "1080P"},
		{raw: "1280*720", want: "720P"},
		{raw: "custom-hdr", want: "custom-hdr"},
	}

	for _, tt := range tests {
		t.Run(tt.raw, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.want, NormalizeResolution(tt.raw))
		})
	}
}

func TestFormatResolutionCasing(t *testing.T) {
	t.Parallel()
	assert.Equal(t, "720p", FormatResolutionLower("720P"))
	assert.Equal(t, "2k", FormatResolutionLower("2K"))
	assert.Equal(t, "720P", FormatResolutionUpper("720p"))
	assert.Equal(t, "2K", FormatResolutionUpper("2k"))
}

func TestGetResolutionPriceFallsBackTo720P(t *testing.T) {
	saved := billingSetting.ResolutionPrice
	t.Cleanup(func() {
		billingSetting.ResolutionPrice = saved
	})

	billingSetting.ResolutionPrice = map[string]map[string]float64{
		"MiniMax-H3": {
			"720p":  0.01,
			"1080P": 0.02,
			"4K":    0.08,
		},
	}

	price, ok := GetResolutionPrice("MiniMax-H3", "1080p")
	require.True(t, ok)
	assert.Equal(t, 0.02, price)

	price, ok = GetResolutionPrice("MiniMax-H3", "768p")
	require.True(t, ok)
	assert.Equal(t, 0.01, price)

	_, ok = GetResolutionPrice("missing-model", "720P")
	assert.False(t, ok)

	prices := GetResolutionPrices("MiniMax-H3")
	require.Equal(t, map[string]float64{
		"720P":  0.01,
		"1080P": 0.02,
		"4K":    0.08,
	}, prices)
}
