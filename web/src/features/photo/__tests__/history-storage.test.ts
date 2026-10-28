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
