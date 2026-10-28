package doubao

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/billing_setting"
)

var ModelList = []string{
	"doubao-seedance-1-0-pro-250528",
	"doubao-seedance-1-0-lite-t2v",
	"doubao-seedance-1-0-lite-i2v",
	"doubao-seedance-1-5-pro-251215",
	"doubao-seedance-2-0",
	"doubao-seedance-2-0-fast",
	"doubao-seedance-2-0-mini",
	"doubao-seedance-2-5",
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2-0-fast-260128",
	"doubao-seedance-2-0-mini-260615",
	"doubao-seedance-2-5-260628",
}

var ChannelName = "doubao-video"

// videoPriceKey 价格表的键：输出分辨率档（is1080p/is4k 均为 false 即 480p/720p 基准档）、输入是否含视频。
type videoPriceKey struct {
	is1080p  bool
	is4k     bool
	hasVideo bool
}

// videoPriceTable 各模型在不同 (输出分辨率档, 是否含视频输入) 下的单价（元/百万 token）。
// 价格来自火山方舟官网刊例价；零值键 {480p/720p, 不含视频} 为基准价，
// 对应 defaultModelRatio（￥/千 token × RMB）；计费时取 实际单价/基准价 作为 OtherRatio，
// 再与分组倍率相乘。
var videoPriceTable = map[string]map[videoPriceKey]float64{
	"doubao-seedance-2-0": {
		{hasVideo: false}:                46.0,
		{hasVideo: true}:                 28.0,
		{is1080p: true, hasVideo: false}: 51.0,
		{is1080p: true, hasVideo: true}:  31.0,
		{is4k: true, hasVideo: false}:    26.0,
		{is4k: true, hasVideo: true}:     16.0,
	},
	"doubao-seedance-2-0-fast": {
		{hasVideo: false}: 37.0,
		{hasVideo: true}:  22.0,
	},
	"doubao-seedance-2-0-mini": {
		{hasVideo: false}: 23.0,
		{hasVideo: true}:  14.0,
	},
	"doubao-seedance-2-5": {
		{hasVideo: false}: 70.0,
		{hasVideo: true}:  42.0,
	},
}

// resolveVideoPriceModel 将调用名归一到价格表主键（不含日期后缀的规范名）。
func resolveVideoPriceModel(modelName string) string {
	name := strings.ToLower(strings.TrimSpace(modelName))
	name = strings.ReplaceAll(name, ".", "-")
	switch {
	case strings.Contains(name, "seedance-2-5"):
		return "doubao-seedance-2-5"
	case strings.Contains(name, "seedance-2-0-mini"):
		return "doubao-seedance-2-0-mini"
	case strings.Contains(name, "seedance-2-0-fast"):
		return "doubao-seedance-2-0-fast"
	case strings.Contains(name, "seedance-2-0"):
		return "doubao-seedance-2-0"
	default:
		return modelName
	}
}

// officialVideoPrice 查询官方价格表（不含管理端覆盖配置）。
// 返回该 (模型, 输出分辨率档, 是否含视频输入) 的刊例单价；
// 模型不在价格表或该组合未配置时返回 false（调用方按基准价计费）。
func officialVideoPrice(modelName, resolution string, hasVideo bool) (float64, bool) {
	prices, ok := videoPriceTable[resolveVideoPriceModel(modelName)]
	if !ok {
		return 0, false
	}
	canon := billing_setting.NormalizeResolution(resolution)
	price, ok := prices[videoPriceKey{
		is1080p:  canon == "1080P",
		is4k:     canon == "4K",
		hasVideo: hasVideo,
	}]
	if !ok {
		return 0, false
	}
	return price, true
}

// officialBasePrice 返回官方价格表中该模型的基准价（480p/720p、无视频输入）。
func officialBasePrice(modelName string) (float64, bool) {
	prices, ok := videoPriceTable[resolveVideoPriceModel(modelName)]
	if !ok {
		return 0, false
	}
	base := prices[videoPriceKey{}]
	if base <= 0 {
		return 0, false
	}
	return base, true
}

// seedanceConfigPrices 返回管理端在 billing_setting.video_input_price 中
// 配置的单价；优先精确匹配调用名，其次回退规范名。
func seedanceConfigPrices(modelName string) (noVideo, video float64, ok bool) {
	noVideo, video, ok = billing_setting.GetVideoInputPriceOverride(modelName)
	if ok {
		return
	}
	return billing_setting.GetVideoInputPriceOverride(resolveVideoPriceModel(modelName))
}

// GetVideoInputRatio 返回指定模型在给定输出分辨率/是否含视频输入下，相对基准价的计费倍率。
// 管理端配置（billing_setting.video_input_price）优先，未配置的档位回退官方价格表：
//   - no_video 替换官方基准档（480p/720p）无视频输入单价，其它分辨率档保持官方相对折扣；
//   - video 替换官方基准档有视频输入单价，其它分辨率档同样保持官方相对折扣。
//
// 两个返回值表示该模型是否可按视频输入计费，倍率为 1.0 时调用方可忽略该 OtherRatio。
func GetVideoInputRatio(modelName, resolution string, hasVideo bool) (float64, bool) {
	base, hasBase := officialBasePrice(modelName)
	noVideoCfg, videoCfg, hasCfg := seedanceConfigPrices(modelName)
	if !hasBase && !hasCfg {
		return 0, false
	}

	// 基准价：配置的无视频输入单价优先，其次官方基准价。
	basePrice := base
	if hasCfg && noVideoCfg > 0 {
		basePrice = noVideoCfg
	}
	if basePrice <= 0 {
		// 只配了有视频输入单价而没有可用的基准价，无法得出倍率，按基准价计费。
		return 1.0, true
	}

	price := basePrice
	if hasVideo {
		videoPrice := 0.0
		if hasCfg && videoCfg > 0 {
			videoPrice = videoCfg
			// 分辨率档保持官方相对折扣（如 2.0 的 4K 16/28）。
			if officialBase, ok := officialVideoPrice(modelName, billing_setting.DefaultResolution, true); ok && officialBase > 0 {
				if officialRes, ok := officialVideoPrice(modelName, resolution, true); ok {
					videoPrice = videoPrice * officialRes / officialBase
				}
			}
		} else if p, ok := officialVideoPrice(modelName, resolution, true); ok {
			videoPrice = p
		} else {
			// 官方未配置该组合（如 fast/mini/2.5 无 1080p/4k，上游会自行报错）按基准价计费。
			videoPrice = basePrice
		}
		price = videoPrice
	} else if hasBase {
		// 无视频输入：按官方分辨率曲线缩放（配置只替换基准档）。
		if p, ok := officialVideoPrice(modelName, resolution, false); ok {
			price = basePrice * p / base
		}
	}
	return price / basePrice, true
}
