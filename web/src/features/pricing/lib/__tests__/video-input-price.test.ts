import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { PricingModel } from '../../types'
import {
  formatVideoInputGroupPrice,
  getVideoInputPriceEntries,
  isVideoInputPricingModel,
} from '../price'

function tokenModel(patch: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'doubao-seedance-2-0',
    quota_type: 0,
    model_ratio: 23,
    completion_ratio: 1,
    enable_groups: ['default'],
    video_input_price: { no_video: 46, video: 28 },
    ...patch,
  }
}

describe('getVideoInputPriceEntries', () => {
  test('returns both tiers in order for token-billed models', () => {
    assert.deepEqual(
      getVideoInputPriceEntries(tokenModel()).map((entry) => entry.key),
      ['no_video', 'video']
    )
  })

  test('skips unset or invalid tiers', () => {
    assert.deepEqual(
      getVideoInputPriceEntries(
        tokenModel({ video_input_price: { no_video: 46, video: 0 } })
      ).map((entry) => entry.key),
      ['no_video']
    )
    assert.deepEqual(
      getVideoInputPriceEntries(
        tokenModel({
          video_input_price: { no_video: Number.NaN, video: -1 },
        })
      ),
      []
    )
  })

  test('ignores per-request models', () => {
    assert.deepEqual(
      getVideoInputPriceEntries(tokenModel({ quota_type: 1 })),
      []
    )
  })
})

describe('isVideoInputPricingModel', () => {
  test('requires configured tiers and token billing', () => {
    assert.equal(isVideoInputPricingModel(tokenModel()), true)
    assert.equal(
      isVideoInputPricingModel(tokenModel({ video_input_price: undefined })),
      false
    )
    assert.equal(
      isVideoInputPricingModel(tokenModel({ quota_type: 1 })),
      false
    )
  })
})

describe('formatVideoInputGroupPrice', () => {
  test('formats CNY unit price via USD round-trip and group ratio', () => {
    assert.equal(
      formatVideoInputGroupPrice(46, 'default', false, 1, 1, {
        default: 1,
      }),
      '$46'
    )
    assert.equal(
      formatVideoInputGroupPrice(28, 'vip', false, 1, 1, { vip: 2 }),
      '$56'
    )
  })
})
