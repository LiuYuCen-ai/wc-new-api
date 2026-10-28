package billing_setting

import (
	"math"
	"strconv"
	"strings"
)

const (
	// VideoTokenFPS is the frame rate used by provider token formulas
	// (Seedance / 火山方舟 use 24fps).
	VideoTokenFPS = 24
	// VideoTokensPerMillion is the divisor for "$ per 1M tokens" unit prices.
	VideoTokensPerMillion = 1_000_000.0
	// videoTokenPixelDivisor keeps the provider formula: w*h*fps*seconds/1024.
	videoTokenPixelDivisor = 1024.0
	// videoDefaultAspectW/H is the fallback aspect ratio (16:9).
	videoDefaultAspectW = 16
	videoDefaultAspectH = 9
	// videoMaxResolutionHeight bounds user-supplied resolution labels so the
	// token estimate can never become an unbounded multiplier.
	videoMaxResolutionHeight = 4320
	// videoMaxAspect bounds the width/height ratio (21:9 ≈ 2.33); anything more
	// extreme falls back to 16:9.
	videoMaxAspect = 4.0
)

// resolutionHeights maps canonical resolution labels to their output height.
// Width follows the requested aspect ratio (16:9 by default).
var resolutionHeights = map[string]int{
	"360P":  360,
	"480P":  480,
	"512P":  512,
	"540P":  540,
	"720P":  720,
	"768P":  768,
	"1K":    1080,
	"1080P": 1080,
	"2K":    1440,
	"4K":    2160,
}

// EstimateVideoTokens estimates the billable video tokens with the provider
// formula used by Seedance:
//
//	tokens = seconds × width × height × 24fps / 1024
//
// Resolution selects the output height, aspect picks the width (16:9 when the
// value is empty or unparsable). The result is always >= 1 so it can be used as
// a multiplier.
func EstimateVideoTokens(resolution string, aspect string, seconds float64) int {
	return EstimateVideoTokensForModel("", resolution, aspect, seconds)
}

// modelResolutionAreas 记录上游按「固定像素面积」计费的模型分辨率口径。
// MiniMax（Hailuo / H3）把 "2K" 计为 2048×1080（DCI 2K，约 2.2MP），
// 若沿用通用高度表（2K → 1440p，16:9 即 2560×1440）会高估约 1.7 倍。
var modelResolutionAreas = []struct {
	match func(string) bool
	areas map[string]int
}{
	{
		match: isMiniMaxVideoModel,
		areas: map[string]int{
			"360P":  640 * 360,
			"480P":  864 * 480,
			"512P":  912 * 512,
			"540P":  960 * 540,
			"720P":  1280 * 720,
			"768P":  1366 * 768,
			"1K":    1920 * 1080,
			"1080P": 1920 * 1080,
			"2K":    2048 * 1080,
			"4K":    3840 * 2160,
		},
	},
}

func isMiniMaxVideoModel(modelName string) bool {
	name := strings.ToLower(strings.TrimSpace(modelName))
	return strings.HasPrefix(name, "minimax") || strings.HasPrefix(name, "hailuo")
}

// EstimateVideoTokensForModel 是 EstimateVideoTokens 的「感知模型」版本：
// 命中 modelResolutionAreas 的模型按该上游的像素口径估算，其余走通用高度表。
// 仅用于提交时的预扣估算，最终结算以上游返回的真实 token 为准。
func EstimateVideoTokensForModel(modelName, resolution, aspect string, seconds float64) int {
	if seconds <= 0 || math.IsNaN(seconds) || math.IsInf(seconds, 0) {
		return 0
	}
	area := videoPixelAreaForModel(modelName, resolution, aspect)
	if area <= 0 {
		return 0
	}
	tokens := int64(math.Round(seconds * float64(area) * VideoTokenFPS / videoTokenPixelDivisor))
	if tokens < 1 {
		tokens = 1
	}
	return int(tokens)
}

func videoPixelAreaForModel(modelName, resolution, aspect string) int {
	label := NormalizeResolution(resolution)
	for _, entry := range modelResolutionAreas {
		if !entry.match(modelName) {
			continue
		}
		if area, ok := entry.areas[label]; ok && area > 0 {
			return area
		}
	}
	width, height := videoOutputSize(label, aspect)
	return width * height
}

// VideoTokensForSeconds is the float form used by the billing multiplier.
func VideoTokensForSeconds(resolution string, aspect string, seconds float64) float64 {
	return float64(EstimateVideoTokens(resolution, aspect, seconds))
}

// videoOutputSize resolves width/height for a resolution label plus an aspect
// ratio such as "16:9", "9:16", "1:1" or "adaptive".
func videoOutputSize(resolution string, aspect string) (width int, height int) {
	height = resolutionHeight(resolution)
	aw, ah := parseAspectRatio(aspect)
	width = int(math.Round(float64(height) * float64(aw) / float64(ah)))
	if width%2 != 0 {
		width++
	}
	if width < 2 {
		width = 2
	}
	return width, height
}

func resolutionHeight(resolution string) int {
	label := NormalizeResolution(resolution)
	if h, ok := resolutionHeights[label]; ok {
		return h
	}
	// Non-standard labels such as "900P": fall back to the numeric prefix,
	// bounded so a crafted label cannot inflate the token multiplier.
	digits := strings.TrimSuffix(strings.ToUpper(label), "P")
	if h, err := strconv.Atoi(digits); err == nil && h > 0 {
		return min(h, videoMaxResolutionHeight)
	}
	return resolutionHeights[DefaultResolution]
}

func parseAspectRatio(aspect string) (int, int) {
	value := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(aspect), " ", ""))
	if value == "" || value == "adaptive" || value == "auto" {
		return videoDefaultAspectW, videoDefaultAspectH
	}
	parts := strings.Split(value, ":")
	if len(parts) != 2 {
		return videoDefaultAspectW, videoDefaultAspectH
	}
	w, errW := strconv.Atoi(parts[0])
	h, errH := strconv.Atoi(parts[1])
	if errW != nil || errH != nil || w <= 0 || h <= 0 {
		return videoDefaultAspectW, videoDefaultAspectH
	}
	ratio := float64(w) / float64(h)
	if ratio > videoMaxAspect || ratio < 1/videoMaxAspect {
		return videoDefaultAspectW, videoDefaultAspectH
	}
	return w, h
}
