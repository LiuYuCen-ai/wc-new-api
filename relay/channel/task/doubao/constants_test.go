package doubao

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetVideoInputRatioOfficialPrices(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		model      string
		resolution string
		hasVideo   bool
		wantRatio  float64
		wantOK     bool
	}{
		{
			name:      "mini 基准档无视频输入倍率为 1",
			model:     "doubao-seedance-2-0-mini-260615",
			wantRatio: 1.0,
			wantOK:    true,
		},
		{
			name:      "mini 含视频输入按官网 14/23 计费",
			model:     "doubao-seedance-2-0-mini-260615",
			hasVideo:  true,
			wantRatio: 14.0 / 23.0,
			wantOK:    true,
		},
		{
			name:      "doubao-seedance-2-0-mini 含视频输入按官网 14/23 计费",
			model:     "doubao-seedance-2-0-mini",
			hasVideo:  true,
			wantRatio: 14.0 / 23.0,
			wantOK:    true,
		},
		{
			name:      "doubao-seedance-2-0-fast 含视频输入按官网 22/37 计费",
			model:     "doubao-seedance-2-0-fast",
			hasVideo:  true,
			wantRatio: 22.0 / 37.0,
			wantOK:    true,
		},
		{
			name:       "doubao-seedance-2-0 1080p 无视频按官网 51/46 计费",
			model:      "doubao-seedance-2-0",
			resolution: "1080p",
			wantRatio:  51.0 / 46.0,
			wantOK:     true,
		},
		{
			name:       "doubao-seedance-2-0 1080P 大写同样按官网 51/46 计费",
			model:      "doubao-seedance-2-0",
			resolution: "1080P",
			wantRatio:  51.0 / 46.0,
			wantOK:     true,
		},
		{
			name:       "doubao-seedance-2-0 4K 按官网 26/46 计费",
			model:      "doubao-seedance-2-0",
			resolution: "4K",
			wantRatio:  26.0 / 46.0,
			wantOK:     true,
		},
		{
			name:      "doubao-seedance-2-0 含视频输入按官网 28/46 计费",
			model:     "doubao-seedance-2-0",
			hasVideo:  true,
			wantRatio: 28.0 / 46.0,
			wantOK:    true,
		},
		{
			name:      "doubao-seedance-2-5 含视频输入按官网 42/70 计费",
			model:     "doubao-seedance-2-5",
			hasVideo:  true,
			wantRatio: 42.0 / 70.0,
			wantOK:    true,
		},
		{
			name:      "fast 基准档无视频输入倍率为 1",
			model:     "doubao-seedance-2-0-fast-260128",
			wantRatio: 1.0,
			wantOK:    true,
		},
		{
			name:      "fast 含视频输入按官网 22/37 计费",
			model:     "doubao-seedance-2-0-fast-260128",
			hasVideo:  true,
			wantRatio: 22.0 / 37.0,
			wantOK:    true,
		},
		{
			name:      "fast 别名命中同一价格表",
			model:     "doubao-seedance-2.0-fast",
			hasVideo:  true,
			wantRatio: 22.0 / 37.0,
			wantOK:    true,
		},
		{
			name:       "mini 未配置的 1080p 回落基准价",
			model:      "doubao-seedance-2-0-mini-260615",
			resolution: "1080p",
			wantRatio:  1.0,
			wantOK:     true,
		},
		{
			name:       "2.5 未配置的 4k 回落基准价",
			model:      "doubao-seedance-2-5-260628",
			resolution: "4k",
			hasVideo:   true,
			wantRatio:  1.0,
			wantOK:     true,
		},
		{
			name:   "未知模型不启用价格表",
			model:  "doubao-seedance-1-0-pro-250528",
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, ok := GetVideoInputRatio(tt.model, tt.resolution, tt.hasVideo)
			require.Equal(t, tt.wantOK, ok)
			if !tt.wantOK {
				return
			}
			assert.InDelta(t, tt.wantRatio, got, 1e-9)
		})
	}
}

func TestResolveVideoPriceModelCanonicalShortNames(t *testing.T) {
	t.Parallel()
	assert.Equal(t, "doubao-seedance-2-0-mini", resolveVideoPriceModel("doubao-seedance-2-0-mini"))
	assert.Equal(t, "doubao-seedance-2-0-mini", resolveVideoPriceModel("doubao-seedance-2-0-mini-260615"))
	assert.Equal(t, "doubao-seedance-2-0-fast", resolveVideoPriceModel("doubao-seedance-2-0-fast"))
	assert.Equal(t, "doubao-seedance-2-0-fast", resolveVideoPriceModel("doubao-seedance-2-0-fast-260128"))
	assert.Equal(t, "doubao-seedance-2-0", resolveVideoPriceModel("doubao-seedance-2-0"))
	assert.Equal(t, "doubao-seedance-2-0", resolveVideoPriceModel("doubao-seedance-2-0-260128"))
	assert.Equal(t, "doubao-seedance-2-5", resolveVideoPriceModel("doubao-seedance-2-5"))
	assert.Equal(t, "doubao-seedance-2-5", resolveVideoPriceModel("doubao-seedance-2-5-260628"))
}

func TestModelListContainsCanonicalSeedanceNames(t *testing.T) {
	t.Parallel()
	got := make(map[string]struct{}, len(ModelList))
	for _, name := range ModelList {
		got[name] = struct{}{}
	}
	for _, name := range []string{
		"doubao-seedance-2-0",
		"doubao-seedance-2-0-fast",
		"doubao-seedance-2-0-mini",
		"doubao-seedance-2-5",
	} {
		_, ok := got[name]
		assert.True(t, ok, "ModelList missing %s", name)
	}
}
