package utils

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestScanVideoInputDetectsChannelVariants(t *testing.T) {
	cases := []struct {
		name    string
		payload string
		want    bool
	}{
		{"doubao metadata content", `{"model":"m","metadata":{"content":[{"type":"video_url","video_url":{"url":"https://x/v.mp4"}}]}}`, true},
		{"hailuo video_urls", `{"metadata":{"video_urls":["https://x/v.mp4"]}}`, true},
		{"ali top-level video_url", `{"prompt":"p","video_url":"https://x/v.mp4"}`, true},
		{"video_id", `{"prompt":"p","video_id":"v1"}`, true},
		{"input_video content type", `{"content":[{"type":"input_video","input_video":{"url":"u"}}]}`, true},
		{"sora remix keeps no video input", `{"prompt":"p","remixed_from_video_id":"vid_1"}`, false},
		{"image only", `{"image":"https://x/i.png","prompt":"p"}`, false},
		{"empty video_url", `{"video_url":""}`, false},
		{"no video keys", `{"prompt":"a cat","resolution":"720p"}`, false},
		// 追加判断：任意字符串值带视频文件后缀即视为带视频输入。
		{"generic key with video file", `{"file_url":"https://x/clip.mov"}`, true},
		{"nested media webm", `{"input":{"media":"a.webm"}}`, true},
		{"query string suffix", `{"media":"https://x/v.mp4?token=1&t=2"}`, true},
		{"uppercase extension", `{"attachments":["HTTPS://X/V.MP4"]}`, true},
		{"non-video extension", `{"file":"https://x/a.png"}`, false},
		{"extension mention without path", `{"prompt":"export an mp4 clip"}`, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, jsonHasVideoInput([]byte(tc.payload)))
		})
	}
}

func newVideoInputTestContext(t *testing.T, req relaycommon.TaskSubmitReq) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", req)
	return ctx
}

// 按百万 token 的分辨率计费：逐分辨率两档表（video_input_price.resolutions）
// 提供基准单价，请求带视频输入时按全局两档单价的倍率缩放。
func TestApplyVideoInputRatiosResolutionTokenBilling(t *testing.T) {
	loadBillingSetting(t, map[string]string{
		"billing_setting.billing_mode":      `{"vm":"resolution"}`,
		"billing_setting.resolution_unit":   `{"vm":"million_tokens"}`,
		"billing_setting.video_input_price": `{"vm":{"no_video":0.46,"video":0.28,"resolutions":{"720P":{"no_video":0.08}}}}`,
	})

	ratios := map[string]float64{}
	applyVideoInputRatios(ratios, "vm", 0.46, 0.28, false, "720P")
	assert.Empty(t, ratios)

	ratios = map[string]float64{}
	applyVideoInputRatios(ratios, "vm", 0.46, 0.28, true, "720P")
	assert.NotContains(t, ratios, constant.TaskOtherRatioBasePrice)
	require.InDelta(t, 0.28/0.46, ratios[constant.TaskOtherRatioVideoInput], 1e-9)
}

// 逐分辨率两档表命中时，有视频档直接按 该档 video / no_video 计费，
// 不再用全局两档倍率；与按秒的 resolution_price 表互不影响。
func TestApplyVideoInputRatiosPerResolutionVideoPrice(t *testing.T) {
	loadBillingSetting(t, map[string]string{
		"billing_setting.billing_mode":      `{"vm":"resolution"}`,
		"billing_setting.resolution_unit":   `{"vm":"million_tokens"}`,
		"billing_setting.resolution_price":  `{"vm":{"720P":0.5}}`,
		"billing_setting.video_input_price": `{"vm":{"no_video":0.46,"video":0.28,"resolutions":{"720P":{"no_video":0.08,"video":0.05},"4K":{"no_video":0.26,"video":0.15}}}}`,
	})

	// 4K 命中两档表：倍率 = 0.15 / 0.26（基准价取该档 no_video）。
	ratios := map[string]float64{}
	applyVideoInputRatios(ratios, "vm", 0.46, 0.28, true, "4k")
	require.InDelta(t, 0.15/0.26, ratios[constant.TaskOtherRatioVideoInput], 1e-9)

	// 720P 命中两档表：倍率 = 0.05 / 0.08（不使用按秒表 0.5）。
	ratios = map[string]float64{}
	applyVideoInputRatios(ratios, "vm", 0.46, 0.28, true, "720P")
	require.InDelta(t, 0.05/0.08, ratios[constant.TaskOtherRatioVideoInput], 1e-9)

	// 无视频输入不受逐分辨率有视频价影响（基准价即分辨率单价，无倍率）。
	ratios = map[string]float64{}
	applyVideoInputRatios(ratios, "vm", 0.46, 0.28, false, "4K")
	assert.Empty(t, ratios)
}

// 非按百万 token 计费（按秒 / 按次 / ratio）不做基准价缩放，仅应用视频输入倍率。
func TestApplyVideoInputRatiosOtherBillingModes(t *testing.T) {
	loadBillingSetting(t, map[string]string{
		"billing_setting.billing_mode":      `{"vm":"resolution"}`,
		"billing_setting.resolution_unit":   `{"vm":"second"}`,
		"billing_setting.video_input_price": `{"vm":{"no_video":0.46,"video":0.28}}`,
	})

	ratios := map[string]float64{}
	applyVideoInputRatios(ratios, "vm", 0.46, 0.28, false, "720P")
	assert.Empty(t, ratios)

	ratios = map[string]float64{}
	applyVideoInputRatios(ratios, "vm", 0.46, 0.28, true, "720P")
	assert.NotContains(t, ratios, constant.TaskOtherRatioBasePrice)
	require.InDelta(t, 0.28/0.46, ratios[constant.TaskOtherRatioVideoInput], 1e-9)
}

// 未配置的模型原样返回；配置了 video 档但请求不带视频时不产生倍率。
func TestApplyVideoInputPricingGate(t *testing.T) {
	loadBillingSetting(t, map[string]string{
		"billing_setting.video_input_price": `{"vm":{"no_video":0.46,"video":0.28}}`,
	})

	ctx := newVideoInputTestContext(t, relaycommon.TaskSubmitReq{})

	// 未配置模型：原样返回（nil 保持 nil）。
	require.Nil(t, ApplyVideoInputPricing(ctx, "other-model", nil))

	// 配置模型但无视频输入：无倍率。
	ratios := ApplyVideoInputPricing(ctx, "vm", nil)
	assert.Empty(t, ratios)

	// metadata 带视频输入：产生 video_input 倍率。
	ctx = newVideoInputTestContext(t, relaycommon.TaskSubmitReq{
		Metadata: map[string]any{"video_urls": []any{"https://x/v.mp4"}},
	})
	ratios = ApplyVideoInputPricing(ctx, "vm", nil)
	require.InDelta(t, 0.28/0.46, ratios[constant.TaskOtherRatioVideoInput], 1e-9)
}

// seedance 等自带 token 计费（precharge）的适配器已应用过配置，跳过避免重复叠加。
func TestApplyVideoInputPricingSkipsAdaptorOwnedBilling(t *testing.T) {
	loadBillingSetting(t, map[string]string{
		"billing_setting.video_input_price": `{"vm":{"no_video":0.46,"video":0.28}}`,
	})

	ctx := newVideoInputTestContext(t, relaycommon.TaskSubmitReq{
		Metadata: map[string]any{"video_urls": []any{"https://x/v.mp4"}},
	})
	in := map[string]float64{constant.TaskOtherRatioPrecharge: 118.8}
	require.Equal(t, in, ApplyVideoInputPricing(ctx, "vm", in))
}
