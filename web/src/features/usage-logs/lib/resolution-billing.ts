/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { LogOtherData } from '../types'

import { resolveVideoInputTier, type VideoInputTier } from './video-input-tier'

export const RESOLUTION_UNIT_SECOND = 'second'
export const RESOLUTION_UNIT_MILLION_TOKENS = 'million_tokens'

/**
 * 是否为「按分辨率」计费日志（按秒 / 按 token）。
 *
 * 这类日志的 `model_price` 是分辨率单价而不是按次单价，不能沿用「每次调用」的展示口径。
 * 后端只在按分辨率计费时写入 `billing_unit`，因此以该字段作为判定依据。
 */
export function isResolutionBillingLog(
  other: LogOtherData | null | undefined
): boolean {
  const unit = other?.billing_unit
  return unit === RESOLUTION_UNIT_SECOND || unit === RESOLUTION_UNIT_MILLION_TOKENS
}

/** 按 token 计费（百万视频 token）。 */
export function isResolutionTokenBilling(
  other: LogOtherData | null | undefined
): boolean {
  return other?.billing_unit === RESOLUTION_UNIT_MILLION_TOKENS
}

/**
 * 本次实际计价的单价：
 *   - 按秒：美元/秒；
 *   - 按 token：美元/百万 token，命中「有视频输入」档时为该档单价。
 *
 * 后端新日志直接给出 `applied_unit_price`；旧日志用 `model_price` × `video_input`
 * 倍率还原，保证「预扣行 / 结算行」显示同一个实扣单价。
 */
export function resolveAppliedUnitPrice(
  other: LogOtherData | null | undefined
): number | null {
  if (!other) return null
  const applied = other.applied_unit_price
  if (applied != null && Number.isFinite(applied) && applied > 0) {
    return applied
  }
  const base = other.model_price ?? 0
  if (!Number.isFinite(base) || base <= 0) return null
  if (isResolutionTokenBilling(other)) {
    const ratio = other.video_input
    if (ratio != null && Number.isFinite(ratio) && ratio > 0) {
      return base * ratio
    }
  }
  return base
}

/** 本次计费命中的视频输入档位（仅按 token 计费有意义）。 */
export function resolveResolutionVideoInputTier(
  other: LogOtherData | null | undefined
): VideoInputTier | null {
  if (!isResolutionTokenBilling(other)) return null
  // 后端显式记录的档位优先于按单价推算（缺 video_input_price 时也能判定）。
  if (other?.video_input_tier === 'video') return 'video'
  if (other?.video_input_tier === 'no_video') return 'no_video'
  return resolveVideoInputTier(other)
}

/**
 * 本次计费的实际 token 数：结算日志取上游返回的真实 token，预扣日志取估算 token。
 * 返回值带 `estimated` 标记，供界面区分「≈ 估算」与「真实值」。
 */
export function resolveBilledVideoTokens(
  other: LogOtherData | null | undefined
): { tokens: number; estimated: boolean } | null {
  if (!other || !isResolutionTokenBilling(other)) return null
  const actual = other.actual_video_tokens
  if (actual != null && Number.isFinite(actual) && actual > 0) {
    return { tokens: actual, estimated: false }
  }
  const estimate = other.est_video_tokens
  if (estimate != null && Number.isFinite(estimate) && estimate > 0) {
    return { tokens: estimate, estimated: true }
  }
  return null
}

/**
 * 按 token 计费的两档单价（本次命中分辨率）。
 * 优先取日志里的 `video_input_price`（新日志为逐分辨率两档价），
 * 缺失时回退到「本次命中单价 + 全局倍率」推算，避免展示成别的档位。
 */
export function resolveResolutionTierPrices(
  other: LogOtherData | null | undefined
): { noVideo: number | null; video: number | null } {
  if (!other) return { noVideo: null, video: null }
  const prices = other.video_input_price
  const noVideo = prices?.no_video ?? null
  const video = prices?.video ?? null
  if ((noVideo ?? 0) > 0 || (video ?? 0) > 0) {
    return {
      noVideo: (noVideo ?? 0) > 0 ? noVideo : null,
      video: (video ?? 0) > 0 ? video : null,
    }
  }
  const applied = resolveAppliedUnitPrice(other)
  if (applied == null) return { noVideo: null, video: null }
  const tier = resolveResolutionVideoInputTier(other)
  if (tier === 'video') {
    return { noVideo: null, video: applied }
  }
  return { noVideo: applied, video: null }
}
