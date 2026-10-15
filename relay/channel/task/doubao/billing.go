package doubao

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
)

const (
	seedanceFPS              = 24
	seedanceDefaultDuration  = 5
	seedancePrechargeBuffer  = 1.1
	seedance2MaxClipSeconds  = 15
	seedance25MaxClipSeconds = 30
	seedance2MaxVideos       = 3
)

func seedanceMaxClipSeconds(modelName string) int {
	if resolveVideoPriceModel(modelName) == "doubao-seedance-2-5" {
		return seedance25MaxClipSeconds
	}
	return seedance2MaxClipSeconds
}

// seedanceMaxVideoInputSeconds 视频输入时长无法从 URL 可靠解析，预扣一律按该模型允许的上限。
func seedanceMaxVideoInputSeconds(modelName string, videoCount int) int {
	maxClip := seedanceMaxClipSeconds(modelName)
	if resolveVideoPriceModel(modelName) == "doubao-seedance-2-5" {
		return maxClip
	}
	if videoCount < 1 {
		videoCount = 1
	}
	if videoCount > seedance2MaxVideos {
		videoCount = seedance2MaxVideos
	}
	return videoCount * maxClip
}

// estimateSeedanceTokens 按火山方舟计费口径估算 token：
// (outputSeconds + videoInputSeconds) × width × height × 24fps / 1024。
func estimateSeedanceTokens(outputSec, videoInputSec int, resolution, ratio string) int {
	if outputSec <= 0 {
		outputSec = seedanceDefaultDuration
	}
	if outputSec > relaycommon.MaxTaskDurationSeconds {
		outputSec = relaycommon.MaxTaskDurationSeconds
	}
	if videoInputSec < 0 {
		videoInputSec = 0
	}
	if videoInputSec > relaycommon.MaxTaskDurationSeconds {
		videoInputSec = relaycommon.MaxTaskDurationSeconds
	}
	billedSec := outputSec + videoInputSec
	w, h := seedanceOutputSize(resolution, ratio)
	tokens := int(int64(w) * int64(h) * int64(seedanceFPS) * int64(billedSec) / 1024)
	if tokens < 1 {
		tokens = 1
	}
	return tokens
}

func seedanceOutputSize(resolution, ratio string) (width, height int) {
	height = 720
	switch billing_setting.NormalizeResolution(resolution) {
	case "480P":
		height = 480
	case "1080P":
		height = 1080
	case "4K":
		height = 2160
	}
	aw, ah := parseAspectRatio(ratio)
	width = height * aw / ah
	if width%2 != 0 {
		width++
	}
	if width < 2 {
		width = 2
	}
	return width, height
}

func parseAspectRatio(ratio string) (w, h int) {
	ratio = strings.TrimSpace(strings.ReplaceAll(strings.ToLower(ratio), " ", ""))
	if ratio == "" || ratio == "adaptive" {
		return 16, 9
	}
	parts := strings.Split(ratio, ":")
	if len(parts) != 2 {
		return 16, 9
	}
	w, errW := strconv.Atoi(parts[0])
	h, errH := strconv.Atoi(parts[1])
	if errW != nil || errH != nil || w <= 0 || h <= 0 {
		return 16, 9
	}
	return w, h
}

// seedancePrechargeRatio 把 ModelPriceHelperPerCall 的预扣基数
// (modelRatio/2 * QuotaPerUnit) 放大到「估算 token × 1.1 × modelRatio」。
func seedancePrechargeRatio(estimatedTokens int) float64 {
	if estimatedTokens <= 0 {
		return 0
	}
	return float64(estimatedTokens) * (seedancePrechargeBuffer * 2) / common.QuotaPerUnit
}

func seedanceRequestedDuration(req relaycommon.TaskSubmitReq, modelName string) int {
	sec := req.Duration
	if sec == 0 {
		if parsed, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil {
			sec = parsed
		}
	}
	if sec == 0 {
		sec = metadataInt(req.Metadata, "duration")
	}
	if sec < 0 {
		return seedanceMaxClipSeconds(modelName)
	}
	if sec > relaycommon.MaxTaskDurationSeconds {
		return relaycommon.MaxTaskDurationSeconds
	}
	if sec == 0 {
		return seedanceDefaultDuration
	}
	return sec
}

func metadataString(metadata map[string]interface{}, key string) string {
	if metadata == nil {
		return ""
	}
	v, ok := metadata[key]
	if !ok {
		return ""
	}
	s, _ := v.(string)
	return s
}

func metadataInt(metadata map[string]interface{}, key string) int {
	if metadata == nil {
		return 0
	}
	v, ok := metadata[key]
	if !ok {
		return 0
	}
	switch n := v.(type) {
	case int:
		return n
	case int32:
		return int(n)
	case int64:
		return int(n)
	case float64:
		return int(n)
	case string:
		parsed, _ := strconv.Atoi(strings.TrimSpace(n))
		return parsed
	default:
		return 0
	}
}

func seedanceEstimateBilling(req relaycommon.TaskSubmitReq, originModel, upstreamModel string) map[string]float64 {
	modelName := originModel
	resolution := metadataString(req.Metadata, "resolution")
	hasVideo := hasVideoInMetadata(req.Metadata)
	videoRatio, ok := GetVideoInputRatio(modelName, resolution, hasVideo)
	if !ok {
		modelName = upstreamModel
		videoRatio, ok = GetVideoInputRatio(modelName, resolution, hasVideo)
	}
	if !ok {
		return nil
	}

	ratios := map[string]float64{}
	if videoRatio != 1.0 {
		ratios["video_input"] = videoRatio
	}

	aspect := metadataString(req.Metadata, "ratio")
	if aspect == "" {
		aspect = metadataString(req.Metadata, "aspect_ratio")
	}
	outputSec := seedanceRequestedDuration(req, modelName)
	videoInputSec := 0
	if hasVideo {
		videoInputSec = seedanceMaxVideoInputSeconds(modelName, countVideosInMetadata(req.Metadata))
	}
	tokens := estimateSeedanceTokens(outputSec, videoInputSec, resolution, aspect)
	if precharge := seedancePrechargeRatio(tokens); precharge > 0 {
		ratios[constant.TaskOtherRatioPrecharge] = precharge
	}
	if len(ratios) == 0 {
		return nil
	}
	return ratios
}
