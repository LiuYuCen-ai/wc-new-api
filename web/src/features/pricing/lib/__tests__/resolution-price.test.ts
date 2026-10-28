import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { PricingModel } from '../../types'
import {
  formatResolutionGroupPrice,
  getResolutionPriceEntries,
  isResolutionPricingModel,
} from '../price'

function resolutionModel(
  patch: Partial<PricingModel> = {}
): PricingModel {
  return {
    id: 1,
    model_name: 'MiniMax-H3',
    quota_type: 1,
    model_ratio: 0,
    completion_ratio: 1,
    model_price: 0.5,
    enable_groups: ['default'],
    billing_mode: 'resolution',
    resolution_price: {
      '4K': 2,
      '720P': 0.5,
      '1080P': 1,
    },
    ...patch,
  }
}

describe('getResolutionPriceEntries', () => {
  test('returns configured resolutions in display order', () => {
    assert.deepEqual(
      getResolutionPriceEntries(
        resolutionModel({
          resolution_price: {
            Custom: 3,
            '4K': 2,
            '720P': 0.5,
          },
        })
      ).map((entry) => entry.resolution),
      ['720P', '4K', 'Custom']
    )
  })

  test('skips invalid prices and empty labels', () => {
    assert.deepEqual(
      getResolutionPriceEntries(
        resolutionModel({
          resolution_price: {
            '720P': 0.5,
            '': 1,
            '1080P': Number.NaN,
            '4K': -1,
          },
        })
      ),
      [{ resolution: '720P', price: 0.5 }]
    )
  })
})

describe('isResolutionPricingModel', () => {
  test('requires billing_mode resolution and at least one priced resolution', () => {
    assert.equal(isResolutionPricingModel(resolutionModel()), true)
    assert.equal(
      isResolutionPricingModel(
        resolutionModel({ billing_mode: undefined, resolution_price: { '720P': 0.5 } })
      ),
      false
    )
    assert.equal(
      isResolutionPricingModel(
        resolutionModel({ resolution_price: {} })
      ),
      false
    )
  })
})

describe('formatResolutionGroupPrice', () => {
  test('multiplies the configured USD price by the group ratio', () => {
    assert.equal(
      formatResolutionGroupPrice(0.5, 'default', false, 1, 1, {
        default: 1,
      }),
      '$0.5'
    )
    assert.equal(
      formatResolutionGroupPrice(0.5, 'vip', false, 1, 1, {
        vip: 2,
      }),
      '$1'
    )
  })
})
