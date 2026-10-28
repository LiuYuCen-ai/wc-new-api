import type { LogOtherData } from '../types'

export type VideoInputTier = 'no_video' | 'video'

/**
 * 本次计费命中的视频输入档位（无视频 / 有视频）。
 *
 * 新日志由后端直接写入 `video_input_tier`；结算、退款这类由任务快照回写的日志
 * 在旧数据里缺该字段，此时用本次生效的 `video_input` 倍率（有视频价 / 无视频价）
 * 反推档位，避免同一笔任务「预扣行显示 $3/M、结算行显示 $2/M」的口径不一致。
 */
export function resolveVideoInputTier(
  other: LogOtherData | null | undefined
): VideoInputTier | null {
  const prices = other?.video_input_price
  if (!other || !prices) return null

  const noVideo = prices.no_video ?? 0
  const video = prices.video ?? 0
  if (noVideo <= 0 && video <= 0) return null

  if (other.video_input_tier === 'video') return 'video'
  if (other.video_input_tier === 'no_video') return 'no_video'

  const ratio = other.video_input
  if (ratio != null && Number.isFinite(ratio) && noVideo > 0 && video > 0) {
    if (Math.abs(ratio - video / noVideo) < 1e-4) return 'video'
    if (Math.abs(ratio - 1) < 1e-4) return 'no_video'
  }

  return noVideo > 0 ? 'no_video' : 'video'
}
