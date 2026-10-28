import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  isResolutionBillingLog,
  isResolutionTokenBilling,
  resolveAppliedUnitPrice,
  resolveBilledVideoTokens,
  resolveResolutionTierPrices,
  resolveResolutionVideoInputTier,
} from '../resolution-billing'

describe('resolution billing log helpers', () => {
  test('detects resolution billing by billing_unit', () => {
    assert.equal(isResolutionBillingLog({ billing_unit: 'second' }), true)
    assert.equal(
      isResolutionBillingLog({ billing_unit: 'million_tokens' }),
      true
    )
    // 按次计费的日志没有 billing_unit，不能走按分辨率分支。
    assert.equal(isResolutionBillingLog({ model_price: 4 }), false)
    assert.equal(isResolutionBillingLog(null), false)
  })

  test('only million_tokens is token billing', () => {
    assert.equal(isResolutionTokenBilling({ billing_unit: 'million_tokens' }), true)
    assert.equal(isResolutionTokenBilling({ billing_unit: 'second' }), false)
  })

  test('uses applied_unit_price when the backend recorded it', () => {
    assert.equal(
      resolveAppliedUnitPrice({
        billing_unit: 'million_tokens',
        model_price: 4,
        video_input: 1.25,
        applied_unit_price: 5,
      }),
      5
    )
  })

  test('derives the with-video price for old logs without applied_unit_price', () => {
    // 2K 档：无视频 $4/M，有视频 $5/M → 倍率 1.25。
    assert.equal(
      resolveAppliedUnitPrice({
        billing_unit: 'million_tokens',
        model_price: 4,
        video_input: 1.25,
      }),
      5
    )
    assert.equal(
      resolveAppliedUnitPrice({
        billing_unit: 'million_tokens',
        model_price: 4,
        video_input: 1,
      }),
      4
    )
    // 按秒没有视频输入倍率，单价就是 resolution_price。
    assert.equal(
      resolveAppliedUnitPrice({
        billing_unit: 'second',
        model_price: 0.5,
        video_input: 1.25,
      }),
      0.5
    )
  })

  test('reports actual tokens for settled logs and estimated ones for pre-charge', () => {
    assert.deepEqual(
      resolveBilledVideoTokens({
        billing_unit: 'million_tokens',
        actual_video_tokens: 573578,
        est_video_tokens: 475200,
      }),
      { tokens: 573578, estimated: false }
    )
    assert.deepEqual(
      resolveBilledVideoTokens({
        billing_unit: 'million_tokens',
        est_video_tokens: 475200,
      }),
      { tokens: 475200, estimated: true }
    )
    assert.equal(resolveBilledVideoTokens({ billing_unit: 'second' }), null)
  })

  test('resolves the per-resolution tier prices of the hit resolution', () => {
    assert.deepEqual(
      resolveResolutionTierPrices({
        billing_unit: 'million_tokens',
        video_input_price: { no_video: 4, video: 5 },
        video_input_tier: 'video',
      }),
      { noVideo: 4, video: 5 }
    )
    // 缺 video_input_price 时按命中单价 + 档位还原，避免把有视频档显示成无视频档。
    assert.deepEqual(
      resolveResolutionTierPrices({
        billing_unit: 'million_tokens',
        model_price: 4,
        video_input: 1.25,
        video_input_tier: 'video',
      }),
      { noVideo: null, video: 5 }
    )
  })

  test('video input tier is only meaningful for token billing', () => {
    assert.equal(
      resolveResolutionVideoInputTier({
        billing_unit: 'million_tokens',
        video_input_price: { no_video: 4, video: 5 },
        video_input_tier: 'video',
      }),
      'video'
    )
    assert.equal(
      resolveResolutionVideoInputTier({
        billing_unit: 'second',
        video_input_price: { no_video: 4, video: 5 },
        video_input_tier: 'video',
      }),
      null
    )
  })
})
