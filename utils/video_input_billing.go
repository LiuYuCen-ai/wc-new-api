package utils

import (
	"encoding/json"

	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/gin-gonic/gin"
)

// videoInputKeys 请求参数中出现这些键（小写比对）且值非空时，视为带视频输入。
// 覆盖各渠道差异：doubao metadata.content[].video_url、hailuo metadata.video_urls、
// ali/vidu 顶层 video_url、kling video_id 等。
var videoInputKeys = map[string]bool{
	"video":           true,
	"videos":          true,
	"video_url":       true,
	"video_urls":      true,
	"video_id":        true,
	"video_ids":       true,
	"input_video":     true,
	"reference_video": true,
}

// videoInputTypeKeys content 数组条目的 type 为这些值时视为视频输入
// （OpenAI 风格多模态内容：{"type":"video_url","video_url":{...}}）。
var videoInputTypeKeys = map[string]bool{
	"video_url":   true,
	"input_video": true,
	"video":       true,
}

// videoFileExtensions 视频文件后缀（小写）。请求体中任意字符串值以这些后缀
// 结尾（去掉查询参数/锚点后）即视为带视频输入，兜底覆盖未使用视频字段
// 命名的渠道（如 file_url、media、attachments 等）。
var videoFileExtensions = []string{
	".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".flv",
	".wmv", ".mpg", ".mpeg", ".mpe", ".m2v", ".3gp", ".3g2", ".ogv",
}

// ApplyVideoInputPricing 将管理端配置的视频输入计费（billing_setting.video_input_price）
// 应用到任务提交的估算倍率上，对全部视频模型生效：
//   - 请求带视频输入：video_input = 配置 video 单价 / no_video 单价，
//     与基准单价相乘后即按配置的有视频输入单价计费；
//   - 「按百万 token」的分辨率计费：分辨率单价本身即无视频输入基准价，
//     有视频输入档按两档配置单价的倍率缩放；未配置分辨率的模型走 ratio 计费，
//     无视频单价通过 ModelRatio（基准输入价）生效；
//   - 其余计费模式（按次 / 按秒 / ratio）：只应用 video_input 倍率作为视频输入加价。
//
// 适配器自带 token 预估计费（seedance，含 precharge）的模型已在 EstimateBilling
// 内应用过同一配置，此处跳过以免重复叠加。未配置的模型原样返回。
func ApplyVideoInputPricing(c *gin.Context, modelName string, ratios map[string]float64) map[string]float64 {
	if _, owned := ratios[constant.TaskOtherRatioPrecharge]; owned {
		return ratios
	}
	noVideo, video, ok := billing_setting.GetVideoInputPriceOverride(modelName)
	if !ok {
		return ratios
	}
	if ratios == nil {
		ratios = make(map[string]float64, 2)
	}
	hasVideo := RequestHasVideoInput(c)
	resolution := taskRequestResolution(c)
	applyVideoInputRatios(ratios, modelName, noVideo, video, hasVideo, resolution)
	return ratios
}

// applyVideoInputRatios 按「无视频输入 / 有视频输入」两档配置改写估算倍率。
// 「按百万 token」的分辨率计费使用独立的逐分辨率两档表
// （video_input_price.resolutions，与按秒的 resolution_price 互不影响）：
//   - 命中逐分辨率两档表：基准单价即该档 no_video，有视频时
//     video_input = 该档 video / no_video，直接按各自单价计费；
//   - 未命中：回退全局两档单价的倍率 video / noVideo。
func applyVideoInputRatios(ratios map[string]float64, modelName string, noVideo, video float64, hasVideo bool, resolution string) {
	if hasVideo {
		if billing_setting.IsResolutionTokenBilling(modelName) {
			if unitPrice, ok := billing_setting.GetResolutionUnitPrice(modelName, resolution); ok && unitPrice > 0 {
				if videoPrice, ok := billing_setting.GetResolutionVideoPrice(modelName, resolution); ok && videoPrice > 0 {
					ratios[constant.TaskOtherRatioVideoInput] = videoPrice / unitPrice
					return
				}
			}
		}
		if noVideo > 0 && video > 0 && video != noVideo {
			ratios[constant.TaskOtherRatioVideoInput] = video / noVideo
		}
	}
}

func taskRequestResolution(c *gin.Context) string {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return ""
	}
	return relaycommon.TaskBillingResolution(req)
}

// RequestHasVideoInput 检测用户提交的任务请求参数是否带视频输入。
// 优先递归扫描原始请求体（覆盖各渠道不同的视频字段命名，并追加
// 视频文件后缀兜底判断），原始体不可用或非 JSON 时回退解析后的 metadata。
func RequestHasVideoInput(c *gin.Context) bool {
	if c != nil && c.Request != nil {
		if storage, err := common.GetBodyStorage(c); err == nil {
			if data, readErr := storage.Bytes(); readErr == nil && len(data) > 0 {
				return jsonHasVideoInput(data)
			}
		}
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return false
	}
	return scanVideoInput(req.Metadata)
}

func jsonHasVideoInput(data []byte) bool {
	var payload any
	if err := json.Unmarshal(data, &payload); err != nil {
		return false
	}
	return scanVideoInput(payload)
}

// scanVideoInput 递归扫描任意 JSON 结构：
//   - 命中视频输入键（值非空）或内容条目 type 为视频，即返回 true；
//   - 追加判断：任意字符串值带视频文件后缀（.mp4/.mov/.webm 等，
//     忽略查询参数与锚点）也视为带视频输入，兜底覆盖未用视频字段命名的渠道。
func scanVideoInput(node any) bool {
	switch v := node.(type) {
	case map[string]any:
		for key, value := range v {
			lower := strings.ToLower(key)
			if videoInputKeys[lower] && hasVideoValue(value) {
				return true
			}
			if lower == "type" {
				if s, ok := value.(string); ok && videoInputTypeKeys[s] {
					return true
				}
			}
			if scanVideoInput(value) {
				return true
			}
		}
	case []any:
		for _, item := range v {
			if scanVideoInput(item) {
				return true
			}
		}
	case string:
		return hasVideoFileExtension(v)
	}
	return false
}

// hasVideoFileExtension 判断字符串是否以视频文件后缀结尾。
// 先去掉查询参数与锚点，避免 `a.mp4?token=1` 被误判为其它后缀。
func hasVideoFileExtension(s string) bool {
	lower := strings.ToLower(s)
	if i := strings.IndexAny(lower, "?#"); i >= 0 {
		lower = lower[:i]
	}
	for _, ext := range videoFileExtensions {
		if strings.HasSuffix(lower, ext) {
			return true
		}
	}
	return false
}

func hasVideoValue(value any) bool {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v) != ""
	case []any:
		return len(v) > 0
	case map[string]any:
		return len(v) > 0
	default:
		return false
	}
}
