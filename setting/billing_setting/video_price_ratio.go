package billing_setting

import (
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// GetVideoInputModelRatio 由管理员配置的视频输入单价推导模型基准倍率。
//
// 配置单价以系统当前展示币种计价（管理端输入多少就是多少），因此：
//   - USD / TOKENS 展示：单价即美元价，倍率 = 单价 / 2；
//   - CNY 展示：倍率 = 单价 / USDExchangeRate / 2；
//   - CUSTOM 展示：倍率 = 单价 / 自定义汇率 / 2。
//
// 回来值的语义与 ModelRatio 一致：1 表示 $2/百万 token。取无视频输入单价作为
// 基准（有视频输入通过 video_input 倍率叠加），无视频价未配置时回退有视频价。
// 未配置时 ok=false，由调用方沿用 ModelRatio 表。
func GetVideoInputModelRatio(model string) (float64, bool) {
	noVideo, video, ok := GetVideoInputPriceOverride(model)
	if !ok {
		return 0, false
	}
	price := noVideo
	if price <= 0 {
		price = video
	}
	if price <= 0 {
		return 0, false
	}
	rate := operation_setting.GetUsdToCurrencyRate(operation_setting.USDExchangeRate)
	if rate <= 0 {
		rate = 1
	}
	return price / rate / 2, true
}
