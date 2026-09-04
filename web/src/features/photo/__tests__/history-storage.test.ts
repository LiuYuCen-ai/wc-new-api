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
  excludeHiddenPhotoHistory,
  uniqueHiddenIds,
} from '../lib/photo-history-hidden'

describe('deleted photo works', () => {
  test('refreshing a remote list does not bring a deleted work back', () => {
    const visible = excludeHiddenPhotoHistory(
      [
        { id: 'hist-deleted', prompt: 'gone' },
        { id: 'hist-kept', prompt: 'kept' },
      ],
      ['hist-deleted']
    )

    assert.deepEqual(
      visible.map((item) => item.id),
      ['hist-kept']
    )
  })

  test('empty hidden ids keep the original gallery order', () => {
    const items = [
      { id: 'hist-1', prompt: 'one' },
      { id: 'hist-2', prompt: 'two' },
    ]

    assert.equal(excludeHiddenPhotoHistory(items, []), items)
  })

  test('hidden id lists stay unique and keep the newest entries', () => {
    assert.deepEqual(uniqueHiddenIds(['a', 'b', 'a', 'c'], 2), ['b', 'c'])
  })
})
