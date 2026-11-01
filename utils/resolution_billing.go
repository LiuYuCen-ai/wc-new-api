package utils

import (
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/gin-gonic/gin"
)

const (
	// ResolutionSecondsRatioKey is the OtherRatio holding the billed seconds.
	ResolutionSecondsRatioKey = "seconds"
	// ResolutionTokensRatioKey is the OtherRatio holding the billed tokens in
	// millions (tokens / 1M), so it can multiply the "$ per 1M tokens" price.
	ResolutionTokensRatioKey = "mega_tokens"
	// VideoTokenPrechargeBuffer inflates the token estimate at pre-charge time;
	// the delta is refunded once the upstream token usage is known. 1.5 is
	// calibrated from real settlements: upstream bills ~1.33× the official
	// token formula at 2K and ~1.64× at 720P with video input, so 1.1 left
	// ~2/3 of the final charge unpaid at pre-charge time.
	VideoTokenPrechargeBuffer = 1.5
)

// EstimateResolutionSeconds returns OtherRatios for billing_mode=resolution.
// The unit price is selected by resolution in ModelPriceHelperPerCall;
// this helper only multiplies by seconds. officialSeconds is the provider's
// documented default duration when the request omits duration/seconds.
func EstimateResolutionSeconds(c *gin.Context, modelName string, officialSeconds int) map[string]float64 {
	if billing_setting.GetBillingMode(modelName) != billing_setting.BillingModeResolution {
		return nil
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		req = relaycommon.TaskSubmitReq{}
	}
	return map[string]float64{
		ResolutionSecondsRatioKey: float64(ResolutionSeconds(req, officialSeconds)),
	}
}

// ResolutionSeconds reads duration from the task request and falls back to
// the provider's official default. The value is capped at MaxTaskDurationSeconds.
func ResolutionSeconds(req relaycommon.TaskSubmitReq, officialSeconds int) int {
	return relaycommon.TaskBillingSeconds(req, officialSeconds)
}

// AdaptorOwnsTokenBilling reports whether the adaptor computed its own token
// precharge (Seedance style, "precharge" ratio). It is only meaningful for
// ratio-mode billing: in resolution mode the adaptor must not own the
// multiplier, because its precharge is calibrated against a different base
// (modelRatio/2 × QuotaPerUnit) than the resolution unit price (单价 × QuotaPerUnit).
func AdaptorOwnsTokenBilling(adaptorRatios map[string]float64) bool {
	_, ok := adaptorRatios[constant.TaskOtherRatioPrecharge]
	return ok
}

// IsVideoTaskAction reports whether a task action is a video generation action.
// 音乐（MUSIC/LYRICS）与图片等任务使用各自的大写 action，不受按 token 预扣估算影响。
func IsVideoTaskAction(action string) bool {
	switch action {
	case constant.TaskActionGenerate,
		constant.TaskActionTextGenerate,
		constant.TaskActionFirstTailGenerate,
		constant.TaskActionReferenceGenerate,
		constant.TaskActionRemix:
		return true
	}
	return false
}

// TaskPrechargeRatio 返回「按 token 计费」视频任务的提交预扣倍率（precharge）。
//
// 预扣额度 = 模型倍率 × 估算 token × 缓冲，其中估算 token 采用上游官方公式
// （时长 × 输出像素 × 24fps / 1024；带视频输入时按输出时长再叠加输入时长），
// 因此预扣额度随分辨率、时长、档位一起变化，不再是与请求无关的固定值。
// 任务完成后按上游返回的真实 token 做差额结算（多退少补）。
func TaskPrechargeRatio(c *gin.Context, modelName string) float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return 0
	}
	seconds := relaycommon.TaskBillingSeconds(req, 0)
	if seconds <= 0 {
		return 0
	}
	resolution := relaycommon.TaskBillingResolution(req)
	aspect := relaycommon.TaskBillingAspectRatio(req)
	tokens := billing_setting.EstimateVideoTokensForModel(modelName, resolution, aspect, float64(seconds))
	if RequestHasVideoInput(c) {
		// 输入视频时长无法从 URL 解析，按请求的输出时长保守估算（上游按输入时长计费）。
		tokens += billing_setting.EstimateVideoTokensForModel(modelName, resolution, aspect, float64(seconds))
	}
	if tokens <= 0 || common.QuotaPerUnit <= 0 {
		return 0
	}
	// 基准额度是「模型倍率 / 2 × QuotaPerUnit」，故预扣倍率需乘 2 才是整段视频的额度。
	return float64(tokens) * VideoTokenPrechargeBuffer * 2 / common.QuotaPerUnit
}

// ResolutionBillingRatios converts whatever the adaptor estimated into the
// multiplier required by the model's resolution billing unit. It is applied
// centrally in RelayTaskSubmit so the behaviour is identical for every video
// model, even adaptors that do not implement EstimateBilling.
//
//   - unit=second          → {"seconds": n}
//   - unit=million_tokens  → {"mega_tokens": n / 1M × VideoTokenPrechargeBuffer}
//     （适配器已给出 mega_tokens 时直接沿用，保留其更精确的 token 估算）
//
// Non-time related adaptor ratios (for example "video_input") are preserved;
// the submit-only "precharge" ratio is dropped because it is calibrated against
// the ratio-mode pre-charge base, not the resolution unit price.
func ResolutionBillingRatios(c *gin.Context, modelName string, adaptorRatios map[string]float64) map[string]float64 {
	if billing_setting.GetBillingMode(modelName) != billing_setting.BillingModeResolution {
		return adaptorRatios
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		req = relaycommon.TaskSubmitReq{}
	}

	seconds := 0
	if raw, ok := adaptorRatios[ResolutionSecondsRatioKey]; ok && raw > 0 && !math.IsInf(raw, 0) {
		seconds = int(math.Round(raw))
	}
	if seconds <= 0 {
		seconds = relaycommon.TaskBillingSeconds(req, 0)
	}

	ratios := make(map[string]float64, len(adaptorRatios)+1)
	for key, value := range adaptorRatios {
		switch key {
		case ResolutionSecondsRatioKey, ResolutionTokensRatioKey, constant.TaskOtherRatioPrecharge:
			// Replaced below; submit-only precharge must not be combined with
			// the resolution unit multiplier.
			continue
		case "resolution", "size":
			// The resolution price table already differentiates output size, so
			// adaptor-level resolution/size multipliers would double charge.
			continue
		}
		ratios[key] = value
	}

	if billing_setting.IsResolutionTokenBilling(modelName) {
		// 适配器若已按自己的 token 口径估算了 mega_tokens（例如 seedance 会把
		// 视频输入时长也算进去），直接沿用；否则按官方公式兜底估算。
		if adaptorTokens, ok := adaptorRatios[ResolutionTokensRatioKey]; ok && adaptorTokens > 0 {
			ratios[ResolutionTokensRatioKey] = adaptorTokens
		} else {
			ratios[ResolutionTokensRatioKey] = VideoTokensRatio(
				relaycommon.TaskBillingResolution(req),
				relaycommon.TaskBillingAspectRatio(req),
				seconds,
				VideoTokenPrechargeBuffer,
			)
		}
	} else {
		ratios[ResolutionSecondsRatioKey] = float64(seconds)
	}
	return ratios
}

// VideoTokensRatio returns tokens / 1M scaled by buffer, i.e. the multiplier
// applied to a "$ per 1M tokens" unit price.
func VideoTokensRatio(resolution string, aspect string, seconds int, buffer float64) float64 {
	if seconds <= 0 {
		return 0
	}
	tokens := billing_setting.EstimateVideoTokens(resolution, aspect, float64(seconds))
	if tokens <= 0 {
		return 0
	}
	if buffer <= 0 {
		buffer = 1
	}
	return float64(tokens) / billing_setting.VideoTokensPerMillion * buffer
}
