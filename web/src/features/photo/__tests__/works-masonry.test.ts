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
  coverFocusPosition,
  feedCoverAspectCss,
  feedCoverWeight,
  masonryColumnCountForWidth,
  masonryItemWeight,
  mediaAspectRatioCss,
  packMasonryColumns,
  photoCoverAspectFromSnapshot,
} from '../lib/works-masonry'

describe('packMasonryColumns', () => {
  test('places the next item into the currently shortest column', () => {
    const packed = packMasonryColumns(
      [
        { id: 'portrait', weight: 2 },
        { id: 'landscape', weight: 1 },
        { id: 'square', weight: 1 },
      ],
      2,
      (item) => item.weight
    )

    assert.deepEqual(
      packed.map((column) => column.map((item) => item.id)),
      [['portrait'], ['landscape', 'square']]
    )
  })
})

describe('media aspect helpers', () => {
  test('keeps portrait covers taller than landscape covers', () => {
    assert.equal(mediaAspectRatioCss('9:16'), '9 / 16')
    assert.ok(masonryItemWeight('9:16') > masonryItemWeight('16:9'))
  })

  test('crops extreme video covers so feed cards stay readable', () => {
    assert.equal(feedCoverAspectCss('16:9'), '4 / 3')
    assert.equal(feedCoverAspectCss('9:16'), '3 / 4')
    assert.equal(feedCoverAspectCss('1:1'), '1 / 1')
    assert.ok(feedCoverWeight('9:16') > feedCoverWeight('16:9'))
  })

  test('uses more columns on wider screens', () => {
    assert.equal(masonryColumnCountForWidth(390), 2)
    assert.equal(masonryColumnCountForWidth(640), 2)
    assert.equal(masonryColumnCountForWidth(800), 3)
    assert.equal(masonryColumnCountForWidth(1024), 4)
    assert.equal(masonryColumnCountForWidth(1232), 4)
    assert.equal(masonryColumnCountForWidth(1400), 5)
  })

  test('reads a photo cover ratio from the generation snapshot', () => {
    assert.equal(
      photoCoverAspectFromSnapshot({ aspectRatio: '9:16' }),
      '9:16'
    )
    assert.equal(
      photoCoverAspectFromSnapshot({ customWidth: 2048, customHeight: 1152 }),
      '2048 / 1152'
    )
    assert.equal(photoCoverAspectFromSnapshot(null), '3 / 4')
  })

  test('gives each cover a different crop origin', () => {
    assert.notEqual(coverFocusPosition('task-a'), coverFocusPosition('task-b'))
  })
})
