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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  getModeLabel,
  getPriceSummary,
} from '../model-pricing-snapshots'
import {
  defaultResolutionPrice,
  normalizeResolutionLabel,
  resolutionPricesFromRows,
  rowsFromResolutionPrices,
} from '../resolution-pricing'

describe('normalizeResolutionLabel', () => {
  test('normalizes common video labels to uppercase provider-style keys', () => {
    assert.equal(normalizeResolutionLabel('720P'), '720P')
    assert.equal(normalizeResolutionLabel('720p'), '720P')
    assert.equal(normalizeResolutionLabel('1080'), '1080P')
    assert.equal(normalizeResolutionLabel('4k'), '4K')
    assert.equal(normalizeResolutionLabel('2K'), '2K')
    assert.equal(normalizeResolutionLabel('1920x1080'), '1080P')
    assert.equal(normalizeResolutionLabel('768p'), '768P')
    assert.equal(normalizeResolutionLabel('480p'), '480P')
  })
})

describe('resolutionPricesFromRows', () => {
  test('returns a price map when every row has a unique resolution and non-negative price', () => {
    const prices = resolutionPricesFromRows([
      { id: '1', resolution: '720p', price: '0.01' },
      { id: '2', resolution: '4k', price: '0.08' },
      { id: '3', resolution: '768p', price: '0.03' },
    ])

    assert.equal(prices?.['720P'], 0.01)
    assert.equal(prices?.['4K'], 0.08)
    assert.equal(prices?.['768P'], 0.03)
    assert.equal(defaultResolutionPrice(prices ?? {}), 0.01)
    assert.deepEqual(
      resolutionPricesFromRows([{ id: '4', resolution: '720P', price: '0' }]),
      { '720P': 0 }
    )
  })

  test('returns null when a resolution is duplicated or the price is invalid', () => {
    assert.equal(
      resolutionPricesFromRows([
        { id: '1', resolution: '720p', price: '0.01' },
        { id: '2', resolution: '720P', price: '0.02' },
      ]),
      null
    )
    assert.equal(
      resolutionPricesFromRows([{ id: '1', resolution: '720p', price: '' }]),
      null
    )
  })

  test('round-trips a stored price map into editor rows with canonical casing', () => {
    const rows = rowsFromResolutionPrices({
      '720p': 0.01,
      '1080p': 0.02,
      '2k': 0.05,
      '768p': 0.03,
    })
    assert.deepEqual(
      rows.map((row) => row.resolution),
      ['720P', '1080P', '2K', '768P']
    )
    assert.deepEqual(resolutionPricesFromRows(rows), {
      '720P': 0.01,
      '1080P': 0.02,
      '2K': 0.05,
      '768P': 0.03,
    })
  })
})

describe('resolution pricing snapshots', () => {
  test('summarizes the first resolution price and remaining count', () => {
    const summary = getPriceSummary(
      {
        name: 'MiniMax-H3',
        billingMode: 'resolution',
        resolutionPrices: { '720P': 0.01, '1080P': 0.02 },
        hasConflict: false,
      },
      (key) => key
    )

    assert.equal(getModeLabel('resolution'), 'By resolution')
    assert.equal(summary, '720P $0.01 · 2 resolutions')
  })
})
