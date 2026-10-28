package billing_setting

import (
	"fmt"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/samber/lo"
)

const (
	BillingModeRatio      = "ratio"
	BillingModeTieredExpr = "tiered_expr"
	BillingModeResolution = "resolution"
	BillingModeField      = "billing_mode"
	BillingExprField      = "billing_expr"
	ResolutionPriceField  = "resolution_price"
	ResolutionUnitField   = "resolution_unit"
	// VideoInputPriceField 管理端配置视频输入计费（对全部视频模型生效）的配置键。
	VideoInputPriceField = "video_input_price"
	DefaultResolution    = "720P"

	// VideoInputNoVideoKey 无视频输入单价（元/百万 token）。
	VideoInputNoVideoKey = "no_video"
	// VideoInputVideoKey 有视频输入单价（元/百万 token）。
	VideoInputVideoKey = "video"

	// ResolutionUnitSecond bills the resolution unit price per second of video.
	ResolutionUnitSecond = "second"
	// ResolutionUnitMillionTokens bills the resolution unit price per 1M video
	// tokens. Tokens are estimated at pre-charge time and reconciled with the
	// token usage reported by upstream once the task completes.
	ResolutionUnitMillionTokens = "million_tokens"
)

// ResolutionTierPrice 某分辨率的「无视频 / 有视频」两档单价（元/百万 token）。
type ResolutionTierPrice struct {
	NoVideo float64 `json:"no_video"`
	Video   float64 `json:"video"`
}

// VideoInputPricing 模型级视频输入计费配置（元/百万 token）。
// Resolutions 为可选的逐分辨率两档单价：仅「按百万 token」的分辨率计费模型生效，
// 命中时该分辨率的无视频档按 no_video 计费、有视频档按 video 计费；
// 与 resolution_price（按秒单价表）相互独立，切换计费单位不会互相覆盖。
type VideoInputPricing struct {
	NoVideo     float64                        `json:"no_video"`
	Video       float64                        `json:"video"`
	Resolutions map[string]ResolutionTierPrice `json:"resolutions,omitempty"`
}

// BillingSetting is managed by config.GlobalConfig.Register.
// DB keys: billing_setting.billing_mode, billing_setting.billing_expr,
// billing_setting.resolution_price, billing_setting.resolution_unit,
// billing_setting.video_input_price
type BillingSetting struct {
	BillingMode     map[string]string             `json:"billing_mode"`
	BillingExpr     map[string]string             `json:"billing_expr"`
	ResolutionPrice map[string]map[string]float64 `json:"resolution_price"`
	ResolutionUnit  map[string]string             `json:"resolution_unit"`
	// VideoInputPrice 模型名 → {no_video, video, resolutions}（元/百万 token），对全部视频模型生效。
	// 未配置的模型不应用视频输入计费；seedance 档位回退 task/doubao 官方刊例价。
	VideoInputPrice map[string]VideoInputPricing `json:"video_input_price"`
}

var billingSetting = BillingSetting{
	BillingMode:     make(map[string]string),
	BillingExpr:     make(map[string]string),
	ResolutionPrice: make(map[string]map[string]float64),
	ResolutionUnit:  make(map[string]string),
	VideoInputPrice: make(map[string]VideoInputPricing),
}

func init() {
	config.GlobalConfig.Register("billing_setting", &billingSetting)
}

// ---------------------------------------------------------------------------
// Read accessors (hot path, must be fast)
// ---------------------------------------------------------------------------

func GetBillingMode(model string) string {
	if mode, ok := billingSetting.BillingMode[model]; ok {
		return mode
	}
	return BillingModeRatio
}

func GetBillingExpr(model string) (string, bool) {
	expr, ok := billingSetting.BillingExpr[model]
	return expr, ok
}

func GetBillingModeCopy() map[string]string {
	return lo.Assign(billingSetting.BillingMode)
}

// GetResolutionUnit returns the billing unit for a resolution-priced model.
// Defaults to per-second billing when unset.
func GetResolutionUnit(model string) string {
	if unit, ok := billingSetting.ResolutionUnit[model]; ok {
		if unit == ResolutionUnitMillionTokens {
			return ResolutionUnitMillionTokens
		}
		if unit == ResolutionUnitSecond {
			return ResolutionUnitSecond
		}
	}
	return ResolutionUnitSecond
}

// IsResolutionTokenBilling reports whether the model is billed per 1M video
// tokens instead of per second.
func IsResolutionTokenBilling(model string) bool {
	return GetBillingMode(model) == BillingModeResolution &&
		GetResolutionUnit(model) == ResolutionUnitMillionTokens
}

func GetResolutionUnitCopy() map[string]string {
	return lo.Assign(billingSetting.ResolutionUnit)
}

func GetBillingExprCopy() map[string]string {
	return lo.Assign(billingSetting.BillingExpr)
}

func GetPricingSyncData(base map[string]any) map[string]any {
	extra := make(map[string]any, 4)
	if modes := GetBillingModeCopy(); len(modes) > 0 {
		extra[BillingModeField] = modes
	}
	if exprs := GetBillingExprCopy(); len(exprs) > 0 {
		extra[BillingExprField] = exprs
	}
	if prices := GetResolutionPriceCopy(); len(prices) > 0 {
		extra[ResolutionPriceField] = prices
	}
	if units := GetResolutionUnitCopy(); len(units) > 0 {
		extra[ResolutionUnitField] = units
	}
	if prices := GetVideoInputPriceCopy(); len(prices) > 0 {
		extra[VideoInputPriceField] = prices
	}
	return lo.Assign(base, extra)
}

// ---------------------------------------------------------------------------
// Video input pricing overrides (all video models)
// ---------------------------------------------------------------------------

// GetVideoInputPriceCopy 返回视频输入计费覆盖配置的副本（含逐分辨率两档价）。
func GetVideoInputPriceCopy() map[string]VideoInputPricing {
	out := make(map[string]VideoInputPricing, len(billingSetting.VideoInputPrice))
	for model, prices := range billingSetting.VideoInputPrice {
		copied := VideoInputPricing{NoVideo: prices.NoVideo, Video: prices.Video}
		if len(prices.Resolutions) > 0 {
			copied.Resolutions = make(map[string]ResolutionTierPrice, len(prices.Resolutions))
			for res, tier := range prices.Resolutions {
				copied.Resolutions[res] = tier
			}
		}
		out[model] = copied
	}
	return out
}

// GetVideoInputPriceOverride 返回指定模型的管理员配置单价（元/百万 token）。
// 任一档位未配置或 <= 0 时返回 0，由调用方回退官方价格表（仅 seedance 有官方表）；
// ok 表示该模型存在至少一个有效配置值。
func GetVideoInputPriceOverride(model string) (noVideo, video float64, ok bool) {
	prices := billingSetting.VideoInputPrice[model]
	return prices.NoVideo, prices.Video, prices.NoVideo > 0 || prices.Video > 0
}

// HasResolutionTokenPrices 报告模型是否配置了逐分辨率两档单价（按 token 计费专用表）。
func HasResolutionTokenPrices(model string) bool {
	return len(billingSetting.VideoInputPrice[model].Resolutions) > 0
}

// GetResolutionTokenPrices 返回指定模型的逐分辨率两档单价表（键已归一化）。
func GetResolutionTokenPrices(model string) map[string]ResolutionTierPrice {
	resolutions := billingSetting.VideoInputPrice[model].Resolutions
	if len(resolutions) == 0 {
		return nil
	}
	out := make(map[string]ResolutionTierPrice, len(resolutions))
	for key, tier := range resolutions {
		canon := NormalizeResolution(key)
		if _, exists := out[canon]; exists {
			continue
		}
		out[canon] = tier
	}
	return out
}

// GetResolutionTokenTier 返回指定模型在指定分辨率的两档单价（归一化匹配）。
// 仅使用显式配置的分辨率键，不做 720P 回退——分辨率与单价必须一一对应。
func GetResolutionTokenTier(model, resolution string) (ResolutionTierPrice, bool) {
	resolutions := billingSetting.VideoInputPrice[model].Resolutions
	if len(resolutions) == 0 || resolution == "" {
		return ResolutionTierPrice{}, false
	}
	want := NormalizeResolution(resolution)
	if tier, ok := resolutions[want]; ok {
		return tier, true
	}
	for key, tier := range resolutions {
		if NormalizeResolution(key) == want {
			return tier, true
		}
	}
	return ResolutionTierPrice{}, false
}

// GetResolutionVideoPrice 返回指定模型在指定分辨率的「有视频输入单价」（元/百万 token）。
func GetResolutionVideoPrice(model, resolution string) (float64, bool) {
	tier, ok := GetResolutionTokenTier(model, resolution)
	if !ok || tier.Video <= 0 {
		return 0, false
	}
	return tier.Video, true
}

// GetResolutionTokenNoVideoPricesCopy 返回逐分辨率「无视频输入单价」副本（键已归一化）。
func GetResolutionTokenNoVideoPricesCopy(model string) map[string]float64 {
	tiers := GetResolutionTokenPrices(model)
	if len(tiers) == 0 {
		return nil
	}
	out := make(map[string]float64, len(tiers))
	for res, tier := range tiers {
		out[res] = tier.NoVideo
	}
	return out
}

// GetResolutionVideoPricesCopy 返回逐分辨率「有视频输入单价」副本（键已归一化）。
func GetResolutionVideoPricesCopy(model string) map[string]float64 {
	tiers := GetResolutionTokenPrices(model)
	if len(tiers) == 0 {
		return nil
	}
	out := make(map[string]float64, len(tiers))
	for res, tier := range tiers {
		if tier.Video > 0 {
			out[res] = tier.Video
		}
	}
	return out
}

// GetResolutionUnitPrice 返回模型在指定分辨率用于计费的基准单价：
//   - 按百万 token：逐分辨率两档表（video_input_price.resolutions）的 no_video；
//   - 按秒：resolution_price 表（USD/秒）。
//
// 两张表相互独立，切换计费单位不会互相覆盖或误用。
func GetResolutionUnitPrice(model, resolution string) (float64, bool) {
	if GetResolutionUnit(model) == ResolutionUnitMillionTokens {
		tier, ok := GetResolutionTokenTier(model, resolution)
		if !ok || tier.NoVideo <= 0 {
			return 0, false
		}
		return tier.NoVideo, true
	}
	return GetResolutionPrice(model, resolution)
}

// ReplaceVideoInputPrice 整体替换视频输入价格覆盖配置（选项更新与测试使用）。
func ReplaceVideoInputPrice(prices map[string]VideoInputPricing) {
	billingSetting.VideoInputPrice = prices
}

// ---------------------------------------------------------------------------
// Smoke test (called externally for validation before save)
// ---------------------------------------------------------------------------

func SmokeTestExpr(exprStr string) error {
	return smokeTestExpr(exprStr)
}

func smokeTestExpr(exprStr string) error {
	vectors := []billingexpr.TokenParams{
		{P: 0, C: 0, Len: 0},
		{P: 1000, C: 1000, Len: 1000},
		{P: 100000, C: 100000, Len: 100000},
		{P: 1000000, C: 1000000, Len: 1000000},
	}
	requests := []billingexpr.RequestInput{
		{},
		{
			Headers: map[string]string{
				"anthropic-beta": "fast-mode-2026-02-01",
			},
			Body: []byte(`{"service_tier":"fast","stream_options":{"include_usage":true},"messages":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}`),
		},
	}

	for _, v := range vectors {
		for _, request := range requests {
			result, _, err := billingexpr.RunExprWithRequest(exprStr, v, request)
			if err != nil {
				return fmt.Errorf("vector {p=%g, c=%g}: run failed: %w", v.P, v.C, err)
			}
			if result < 0 {
				return fmt.Errorf("vector {p=%g, c=%g}: result %f < 0", v.P, v.C, result)
			}
		}
	}
	return nil
}
