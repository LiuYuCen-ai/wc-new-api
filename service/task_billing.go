package service

import (
	"context"
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/QuantumNous/new-api/utils"
	"github.com/gin-gonic/gin"
)

// LogTaskConsumption 记录任务消费日志和统计信息（仅记录，不涉及实际扣费）。
// 实际扣费已由 BillingSession（PreConsumeBilling + SettleBilling）完成。
func LogTaskConsumption(c *gin.Context, info *relaycommon.RelayInfo) {
	tokenName := c.GetString("token_name")
	logContent := fmt.Sprintf("操作 %s", info.Action)
	// 本次实际计价的单价（按秒：美元/秒；按 token：美元/百万 token）：
	// 基准单价 × 视频输入倍率。日志正文与结构化字段都按该口径记录，
	// 避免把「无视频档单价」误当成实扣单价（例如 2K 有视频档 4 × 1.25 = 5）。
	appliedUnitPrice := info.PriceData.ModelPrice
	if ratio, ok := info.PriceData.OtherRatios()[constant.TaskOtherRatioVideoInput]; ok && ratio > 0 {
		appliedUnitPrice *= ratio
	}
	// 支持任务仅按次计费
	if common.StringsContains(constant.TaskPricePatches, info.OriginModelName) {
		logContent = fmt.Sprintf("%s，按次计费", logContent)
	} else {
		if otherRatios := info.PriceData.OtherRatios(); len(otherRatios) > 0 {
			var contents []string
			// 命中的分辨率档位单独前置展示，便于与 seconds / mega_tokens 等参数区分。
			if info.PriceData.Resolution != "" {
				contents = append(contents, fmt.Sprintf("分辨率: %s", info.PriceData.Resolution))
			}
			if info.PriceData.BillingUnit != "" && appliedUnitPrice > 0 {
				if info.PriceData.BillingUnit == billing_setting.ResolutionUnitMillionTokens {
					contents = append(contents, fmt.Sprintf("实扣单价: $%g/1M tokens", appliedUnitPrice))
				} else {
					contents = append(contents, fmt.Sprintf("实扣单价: $%g/秒", appliedUnitPrice))
				}
			}
			prechargeRatio := 0.0
			for key, ra := range otherRatios {
				if key == constant.TaskOtherRatioPrecharge {
					// 预扣估算量单独记录，避免与真实计费倍率混在一起。
					prechargeRatio = ra
					continue
				}
				if 1.0 != ra {
					contents = append(contents, fmt.Sprintf("%s: %.2f", key, ra))
				}
			}
			if prechargeRatio > 0 && common.QuotaPerUnit > 0 {
				estimatedTokens := int(math.Round(prechargeRatio * common.QuotaPerUnit / 2))
				contents = append(contents, fmt.Sprintf("预扣按估算 %d tokens", estimatedTokens))
			}
			if len(contents) > 0 {
				logContent = fmt.Sprintf("%s, 计算参数：%s", logContent, strings.Join(contents, ", "))
			}
		}
	}
	other := make(map[string]interface{})
	other["is_task"] = true
	// 优先记录客户端真实请求路径（适配中间件重写前的路径）。
	if p := common.OriginalRequestPath(c); p != "" {
		other["request_path"] = p
	} else {
		other["request_path"] = c.Request.URL.Path
	}
	other["model_price"] = info.PriceData.ModelPrice
	if info.PriceData.ModelRatio > 0 {
		other["model_ratio"] = info.PriceData.ModelRatio
	}
	other["group_ratio"] = info.PriceData.GroupRatioInfo.GroupRatio
	if info.PriceData.Resolution != "" {
		other["resolution"] = info.PriceData.Resolution
	}
	if info.PriceData.BillingUnit != "" {
		other["billing_unit"] = info.PriceData.BillingUnit
		if ratio, ok := info.PriceData.OtherRatios()[utils.ResolutionTokensRatioKey]; ok && ratio > 0 {
			other["est_video_tokens"] = int(math.Round(ratio * billing_setting.VideoTokensPerMillion))
		}
		if appliedUnitPrice > 0 {
			other["applied_unit_price"] = appliedUnitPrice
		}
	}
	if info.PriceData.GroupRatioInfo.HasSpecialRatio {
		other["user_group_ratio"] = info.PriceData.GroupRatioInfo.GroupSpecialRatio
	}
	// 视频输入计费配置：按 token 计费时记录「本次命中分辨率」的两档单价（与实扣口径一致），
	// 其余情况回退到模型级的全局两档单价。
	if prices := resolutionTokenTierPricesForLog(info.OriginModelName, info.PriceData.Resolution); len(prices) > 0 {
		other["video_input_price"] = prices
		if utils.RequestHasVideoInput(c) {
			other["video_input_tier"] = "video"
		} else {
			other["video_input_tier"] = "no_video"
		}
	} else if noVideo, video, ok := billing_setting.GetVideoInputPriceOverride(info.OriginModelName); ok {
		prices := make(map[string]float64, 2)
		if noVideo > 0 {
			prices["no_video"] = noVideo
		}
		if video > 0 {
			prices["video"] = video
		}
		other["video_input_price"] = prices
		if utils.RequestHasVideoInput(c) {
			other["video_input_tier"] = "video"
		} else {
			other["video_input_tier"] = "no_video"
		}
	}
	if info.IsModelMapped {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = info.UpstreamModelName
	}
	attachQuotaSaturation(c, info, other)
	model.RecordConsumeLog(c, info.UserId, model.RecordConsumeLogParams{
		ChannelId: info.ChannelId,
		ModelName: info.OriginModelName,
		TokenName: tokenName,
		Quota:     info.PriceData.Quota,
		Content:   logContent,
		TokenId:   info.TokenId,
		Group:     info.UsingGroup,
		Other:     other,
	})
	model.UpdateUserUsedQuotaAndRequestCount(info.UserId, info.PriceData.Quota)
	model.UpdateChannelUsedQuota(info.ChannelId, info.PriceData.Quota)
}

// ---------------------------------------------------------------------------
// 异步任务计费辅助函数
// ---------------------------------------------------------------------------

// resolutionTokenTierPricesForLog 返回本次命中分辨率的两档单价（元/百万 token）。
// 仅「按 token」计费且该分辨率显式配置了单价时返回，用于日志按实扣口径展示；
// 按秒计费返回 nil（按秒只有一条 resolution_price 单价，没有视频输入两档）。
func resolutionTokenTierPricesForLog(modelName, resolution string) map[string]float64 {
	if billing_setting.GetResolutionUnit(modelName) != billing_setting.ResolutionUnitMillionTokens {
		return nil
	}
	tier, ok := billing_setting.GetResolutionTokenTier(modelName, resolution)
	if !ok || (tier.NoVideo <= 0 && tier.Video <= 0) {
		return nil
	}
	prices := make(map[string]float64, 2)
	if tier.NoVideo > 0 {
		prices["no_video"] = tier.NoVideo
	}
	if tier.Video > 0 {
		prices["video"] = tier.Video
	}
	return prices
}

// resolveTokenKey 通过 TokenId 运行时获取令牌 Key（用于 Redis 缓存操作）。
// 如果令牌已被删除或查询失败，返回空字符串。
func resolveTokenKey(ctx context.Context, tokenId int, taskID string) string {
	token, err := model.GetTokenById(tokenId)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("获取令牌 key 失败 (tokenId=%d, task=%s): %s", tokenId, taskID, err.Error()))
		return ""
	}
	return token.Key
}

// taskIsSubscription 判断任务是否通过订阅计费。
func taskIsSubscription(task *model.Task) bool {
	return task.PrivateData.BillingSource == BillingSourceSubscription && task.PrivateData.SubscriptionId > 0
}

// taskAdjustFunding 调整任务的资金来源（钱包或订阅），delta > 0 表示扣费，delta < 0 表示退还。
func taskAdjustFunding(task *model.Task, delta int) error {
	if taskIsSubscription(task) {
		return model.PostConsumeUserSubscriptionDelta(task.PrivateData.SubscriptionId, int64(delta))
	}
	if delta > 0 {
		return model.DecreaseUserQuota(task.UserId, delta, false)
	}
	return model.IncreaseUserQuota(task.UserId, -delta, false)
}

// taskAdjustTokenQuota 调整任务的令牌额度，delta > 0 表示扣费，delta < 0 表示退还。
// 需要通过 resolveTokenKey 运行时获取 key（不从 PrivateData 中读取）。
func taskAdjustTokenQuota(ctx context.Context, task *model.Task, delta int) {
	if task.PrivateData.TokenId <= 0 || delta == 0 {
		return
	}
	tokenKey := resolveTokenKey(ctx, task.PrivateData.TokenId, task.TaskID)
	if tokenKey == "" {
		return
	}
	var err error
	if delta > 0 {
		err = model.DecreaseTokenQuota(task.PrivateData.TokenId, tokenKey, delta)
	} else {
		err = model.IncreaseTokenQuota(task.PrivateData.TokenId, tokenKey, -delta)
	}
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("调整令牌额度失败 (delta=%d, task=%s): %s", delta, task.TaskID, err.Error()))
	}
}

// taskBillingOther 从 task 的 BillingContext 构建日志 Other 字段。
func taskBillingOther(task *model.Task) map[string]interface{} {
	other := make(map[string]interface{})
	if bc := task.PrivateData.BillingContext; bc != nil {
		other["model_price"] = bc.ModelPrice
		if bc.ModelRatio > 0 {
			other["model_ratio"] = bc.ModelRatio
		}
		other["group_ratio"] = bc.GroupRatio
		if bc.Resolution != "" {
			other["resolution"] = bc.Resolution
		}
		if bc.BillingUnit != "" {
			other["billing_unit"] = bc.BillingUnit
		}
		if priceData := taskBillingContextPriceData(bc); priceData != nil {
			for k, v := range priceData.OtherRatios() {
				other[k] = v
			}
		}
		// 本次实际计价单价（基准单价 × 视频输入倍率），与预扣日志口径一致。
		if bc.BillingUnit != "" && bc.ModelPrice > 0 {
			appliedUnitPrice := bc.ModelPrice
			if ratio, ok := bc.OtherRatios[constant.TaskOtherRatioVideoInput]; ok && ratio > 0 {
				appliedUnitPrice *= ratio
			}
			other["applied_unit_price"] = appliedUnitPrice
		}
	}
	// 结算/退款日志同样带上视频输入计费配置，保持展示口径一致：
	// 按 token 计费优先取本次命中分辨率的两档单价，其余回退模型级全局两档单价。
	modelName := taskModelName(task)
	resolution := ""
	if bc := task.PrivateData.BillingContext; bc != nil {
		resolution = bc.Resolution
	}
	if prices := resolutionTokenTierPricesForLog(modelName, resolution); len(prices) > 0 {
		other["video_input_price"] = prices
		if tier := taskVideoInputTier(task, prices["no_video"], prices["video"]); tier != "" {
			other["video_input_tier"] = tier
		}
	} else if noVideo, video, ok := billing_setting.GetVideoInputPriceOverride(modelName); ok {
		prices := make(map[string]float64, 2)
		if noVideo > 0 {
			prices["no_video"] = noVideo
		}
		if video > 0 {
			prices["video"] = video
		}
		other["video_input_price"] = prices
		if tier := taskVideoInputTier(task, noVideo, video); tier != "" {
			other["video_input_tier"] = tier
		}
	}
	props := task.Properties
	if props.UpstreamModelName != "" && props.UpstreamModelName != props.OriginModelName {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = props.UpstreamModelName
	}
	return other
}

// taskVideoInputTier 返回本次任务命中的视频输入档位（video / no_video）。
// 优先使用提交时记录在 BillingContext 的档位；老任务没有该字段时，
// 用生效的 video_input 倍率（有视频价 / 无视频价）反推，保证结算日志与预扣日志口径一致。
func taskVideoInputTier(task *model.Task, noVideo, video float64) string {
	bc := task.PrivateData.BillingContext
	if bc != nil {
		if bc.VideoInputTier != "" {
			return bc.VideoInputTier
		}
		if noVideo > 0 && video > 0 {
			if ratio, ok := bc.OtherRatios[constant.TaskOtherRatioVideoInput]; ok && ratio > 0 {
				if math.Abs(ratio-video/noVideo) < 1e-4 {
					return "video"
				}
				if math.Abs(ratio-1) < 1e-4 {
					return "no_video"
				}
			}
		}
	}
	if noVideo > 0 {
		return "no_video"
	}
	if video > 0 {
		return "video"
	}
	return ""
}

func taskBillingContextPriceData(bc *model.TaskBillingContext) *types.PriceData {
	if bc == nil || len(bc.OtherRatios) == 0 {
		return nil
	}
	priceData := &types.PriceData{}
	if !priceData.ReplaceOtherRatios(bc.OtherRatios) {
		return nil
	}
	return priceData
}

// taskModelName 从 BillingContext 或 Properties 中获取模型名称。
func taskModelName(task *model.Task) string {
	if bc := task.PrivateData.BillingContext; bc != nil && bc.OriginModelName != "" {
		return bc.OriginModelName
	}
	return task.Properties.OriginModelName
}

// RefundTaskQuota 统一的任务失败退款逻辑。
// 当异步任务失败时，将预扣的 quota 退还给用户（支持钱包和订阅），并退还令牌额度。
// 返回资金来源是否已成功退还；失败时保留 quota，供显式重试或人工对账。
func RefundTaskQuota(ctx context.Context, task *model.Task, reason string) bool {
	quota := task.Quota
	if quota == 0 {
		return true
	}

	// 1. 退还资金来源（钱包或订阅）
	if err := taskAdjustFunding(task, -quota); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("退还资金来源失败 task %s: %s", task.TaskID, err.Error()))
		return false
	}

	// 2. 退还令牌额度
	taskAdjustTokenQuota(ctx, task, -quota)

	// 3. 记录日志
	other := taskBillingOther(task)
	other["task_id"] = task.TaskID
	other["reason"] = reason
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   model.LogTypeRefund,
		Content:   "",
		ChannelId: task.ChannelId,
		ModelName: taskModelName(task),
		Quota:     quota,
		TokenId:   task.PrivateData.TokenId,
		Group:     task.Group,
		Other:     other,
	})

	// 4. 资金退款完成后再清除持久化标记。
	// 回写失败必须显式告警，避免漏掉潜在的重复退款风险。
	task.Quota = 0
	if err := task.UpdateQuota(); err != nil {
		logger.LogError(ctx, fmt.Sprintf("退款成功但清除 task quota 失败 task %s: %s", task.TaskID, err.Error()))
	}
	return true
}

// RecalculateTaskQuota 通用的异步差额结算。
// actualQuota 是任务完成后的实际应扣额度，与预扣额度 (task.Quota) 做差额结算。
// reason 用于日志记录（例如 "token重算" 或 "adaptor调整"）。
// clamps 可选：若计算 actualQuota 时发生额度饱和，将其记入日志 admin_info（仅管理员可见）。
func RecalculateTaskQuota(ctx context.Context, task *model.Task, actualQuota int, reason string, clamps ...*common.QuotaClamp) {
	recalculateTaskQuota(ctx, task, actualQuota, reason, nil, clamps...)
}

// recalculateTaskQuota 差额结算的实现，extra 为额外写入日志的字段
// （例如按 token 结算时的真实 tokens），保证日志能还原实际计费口径。
func recalculateTaskQuota(ctx context.Context, task *model.Task, actualQuota int, reason string, extra map[string]interface{}, clamps ...*common.QuotaClamp) {
	if actualQuota <= 0 {
		return
	}
	preConsumedQuota := task.Quota
	quotaDelta := actualQuota - preConsumedQuota

	if quotaDelta == 0 {
		logger.LogInfo(ctx, fmt.Sprintf("任务 %s 预扣费准确（%s，%s）",
			task.TaskID, logger.LogQuota(actualQuota), reason))
		return
	}

	logger.LogInfo(ctx, fmt.Sprintf("任务 %s 差额结算：delta=%s（实际：%s，预扣：%s，%s）",
		task.TaskID,
		logger.LogQuota(quotaDelta),
		logger.LogQuota(actualQuota),
		logger.LogQuota(preConsumedQuota),
		reason,
	))

	// 调整资金来源
	if err := taskAdjustFunding(task, quotaDelta); err != nil {
		logger.LogError(ctx, fmt.Sprintf("差额结算资金调整失败 task %s: %s", task.TaskID, err.Error()))
		return
	}

	// 调整令牌额度
	taskAdjustTokenQuota(ctx, task, quotaDelta)

	task.Quota = actualQuota
	if err := task.UpdateQuota(); err != nil {
		logger.LogError(ctx, fmt.Sprintf("差额结算回写 quota 失败 task %s: %s", task.TaskID, err.Error()))
	}

	var logType int
	var logQuota int
	if quotaDelta > 0 {
		logType = model.LogTypeConsume
		logQuota = quotaDelta
		model.UpdateUserUsedQuotaAndRequestCount(task.UserId, quotaDelta)
		model.UpdateChannelUsedQuota(task.ChannelId, quotaDelta)
	} else {
		logType = model.LogTypeRefund
		logQuota = -quotaDelta
	}
	other := taskBillingOther(task)
	other["task_id"] = task.TaskID
	other["pre_consumed_quota"] = preConsumedQuota
	other["actual_quota"] = actualQuota
	for k, v := range extra {
		other[k] = v
	}
	for _, clamp := range clamps {
		attachQuotaSaturationToOther(other, clamp)
	}
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   logType,
		Content:   reason,
		ChannelId: task.ChannelId,
		ModelName: taskModelName(task),
		Quota:     logQuota,
		TokenId:   task.PrivateData.TokenId,
		Group:     task.Group,
		Other:     other,
		NodeName:  task.PrivateData.NodeName,
	})
}

// RecalculateTaskQuotaByVideoTokens 按百万 token 计费的视频模型差额结算。
// 预扣时用「时长 × 宽 × 高 × 24fps / 1024」估算 token 并乘 1.1 缓冲；
// 任务完成后用上游返回的真实 token 重新计算实际额度，多退少补。
//
// 公式：quota = 单价(美元/百万token) × tokens / 1M × QuotaPerUnit × 分组倍率 × 其他倍率
func RecalculateTaskQuotaByVideoTokens(ctx context.Context, task *model.Task, totalTokens int) {
	if task == nil || totalTokens <= 0 {
		return
	}

	modelName := taskModelName(task)
	bc := task.PrivateData.BillingContext

	// 单价优先取当前配置（按 unit 选择按秒 / 按 token 的独立单价表），否则回退到快照单价。
	var unitPrice float64
	resolution := ""
	if bc != nil {
		resolution = bc.Resolution
	}
	if price, ok := billing_setting.GetResolutionUnitPrice(modelName, resolution); ok {
		unitPrice = price
	} else if bc != nil {
		unitPrice = bc.ModelPrice
	}
	if unitPrice <= 0 {
		logger.LogWarn(ctx, fmt.Sprintf("任务 %s 按 token 结算缺少单价配置，保留预扣额度", task.TaskID))
		return
	}

	groupRatio := 0.0
	if bc != nil {
		groupRatio = bc.GroupRatio
	}
	if groupRatio <= 0 {
		groupRatio = taskGroupRatio(task)
	}

	// 其他倍率（如 video_input）；mega_tokens / precharge 属于估算参数，不参与结算。
	otherMultiplier := 1.0
	if priceData := taskBillingContextPriceData(bc); priceData != nil {
		for key, ratio := range priceData.OtherRatios() {
			if key == constant.TaskOtherRatioPrecharge ||
				key == utils.ResolutionTokensRatioKey ||
				key == utils.ResolutionSecondsRatioKey ||
				ratio == 1.0 {
				continue
			}
			otherMultiplier *= ratio
		}
	}

	cost := unitPrice * float64(totalTokens) / billing_setting.VideoTokensPerMillion
	actualQuota, clamp := common.QuotaFromFloatChecked(cost * common.QuotaPerUnit * groupRatio * otherMultiplier)
	// 日志正文用「实扣单价」（基准单价 × 视频输入等倍率），避免只写基准单价造成误解。
	appliedUnitPrice := unitPrice * otherMultiplier
	reason := fmt.Sprintf("token重算：tokens=%d, 实扣单价=$%g/1M, resolution=%s, groupRatio=%.2f, otherMultiplier=%.4f",
		totalTokens, appliedUnitPrice, resolution, groupRatio, otherMultiplier)
	// 把上游返回的真实 tokens 与实际计价单价写进日志，前端「Tokens / 单价」列才能显示实扣口径。
	recalculateTaskQuota(ctx, task, actualQuota, reason, map[string]interface{}{
		"actual_video_tokens": totalTokens,
		"applied_unit_price":  appliedUnitPrice,
	}, clamp)
}

// taskGroupRatio 解析任务使用的分组倍率（BillingContext 缺失时的兜底）。
func taskGroupRatio(task *model.Task) float64 {
	group := task.Group
	if group == "" {
		user, err := model.GetUserById(task.UserId, false)
		if err == nil {
			group = user.Group
		}
	}
	if group == "" {
		return 0
	}
	if userGroupRatio, ok := ratio_setting.GetGroupGroupRatio(group, group); ok {
		return userGroupRatio
	}
	return ratio_setting.GetGroupRatio(group)
}

// RecalculateTaskQuotaByTokens 根据实际 token 消耗重新计费（异步差额结算）。
// 当任务成功且返回了 totalTokens 时，根据模型倍率和分组倍率重新计算实际扣费额度，
// 与预扣费的差额进行补扣或退还。支持钱包和订阅计费来源。
func RecalculateTaskQuotaByTokens(ctx context.Context, task *model.Task, totalTokens int) {
	if totalTokens <= 0 {
		return
	}

	modelName := taskModelName(task)

	// 获取模型价格和倍率
	modelRatio, hasRatioSetting, _ := ratio_setting.GetModelRatio(modelName)
	// 管理端配置了视频输入单价时，基准倍率由该单价推导（按展示币种，不做二次换算），
	// 与提交预扣、前端展示价格保持一致。
	if ratio, ok := billing_setting.GetVideoInputModelRatio(modelName); ok {
		modelRatio = ratio
		hasRatioSetting = true
	}
	// 只有配置了倍率(非固定价格)时才按 token 重新计费
	if !hasRatioSetting || modelRatio <= 0 {
		return
	}

	// 获取用户和组的倍率信息
	group := task.Group
	if group == "" {
		user, err := model.GetUserById(task.UserId, false)
		if err == nil {
			group = user.Group
		}
	}
	if group == "" {
		return
	}

	groupRatio := ratio_setting.GetGroupRatio(group)
	userGroupRatio, hasUserGroupRatio := ratio_setting.GetGroupGroupRatio(group, group)

	var finalGroupRatio float64
	if hasUserGroupRatio {
		finalGroupRatio = userGroupRatio
	} else {
		finalGroupRatio = groupRatio
	}

	// 计算 OtherRatios 乘积（视频折扣、时长等）。提交预扣用的 precharge 不参与结算。
	otherMultiplier := 1.0
	if priceData := taskBillingContextPriceData(task.PrivateData.BillingContext); priceData != nil {
		for key, ra := range priceData.OtherRatios() {
			if key == constant.TaskOtherRatioPrecharge || ra == 1.0 {
				continue
			}
			otherMultiplier *= ra
		}
	}

	// 计算实际应扣费额度: totalTokens * modelRatio * groupRatio * otherMultiplier（饱和转换，防止溢出成负数）
	actualQuota, clamp := common.QuotaFromFloatChecked(float64(totalTokens) * modelRatio * finalGroupRatio * otherMultiplier)

	reason := fmt.Sprintf("token重算：tokens=%d, modelRatio=%.2f, groupRatio=%.2f, otherMultiplier=%.4f", totalTokens, modelRatio, finalGroupRatio, otherMultiplier)
	RecalculateTaskQuota(ctx, task, actualQuota, reason, clamp)
}
