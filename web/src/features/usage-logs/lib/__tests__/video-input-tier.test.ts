import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { LogOtherData } from '../../types'
import { resolveVideoInputTier } from '../video-input-tier'

const prices = { no_video: 2, video: 3 }

describe('resolveVideoInputTier', () => {
  test('prefers the tier recorded by the backend', () => {
    assert.equal(
      resolveVideoInputTier({
        video_input_price: prices,
        video_input_tier: 'video',
      }),
      'video'
    )
    assert.equal(
      resolveVideoInputTier({
        video_input_price: prices,
        video_input_tier: 'no_video',
      }),
      'no_video'
    )
  })

  test('derives the tier from the applied video_input ratio for old logs', () => {
    // 结算/退款日志缺 video_input_tier，但带着生效倍率：1.5 = 3 / 2 → 有视频档。
    assert.equal(
      resolveVideoInputTier({ video_input_price: prices, video_input: 1.5 }),
      'video'
    )
    assert.equal(
      resolveVideoInputTier({ video_input_price: prices, video_input: 1 }),
      'no_video'
    )
  })

  test('falls back to the configured price when nothing else is known', () => {
    assert.equal(
      resolveVideoInputTier({ video_input_price: prices }),
      'no_video'
    )
    assert.equal(
      resolveVideoInputTier({ video_input_price: { video: 3 } }),
      'video'
    )
  })

  test('returns null when no tier pricing is configured', () => {
    assert.equal(resolveVideoInputTier({}), null)
    assert.equal(resolveVideoInputTier(null), null)
    assert.equal(
      resolveVideoInputTier({ video_input_price: { no_video: 0, video: 0 } }),
      null
    )
  })
})

// 类型守卫：确保测试用的字段名与日志 other 结构一致。
const sample: LogOtherData = { video_input: 1.5, video_input_price: prices }
void sample
