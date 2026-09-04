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
  buildVideoSubmitBody,
  resolveVideoModelFamily,
  snapVideoDuration,
  snapVideoResolution,
} from './video-request'
import type { VideoParams } from '../types'

const baseParams: VideoParams = {
  model: 'MiniMax-Hailuo-2.3',
  prompt: 'a cat walking',
  duration: '15',
  aspectRatio: '16:9',
  resolution: '720P',
}

describe('resolveVideoModelFamily', () => {
  test('classifies official video model names', () => {
    assert.equal(resolveVideoModelFamily('sora-2'), 'sora')
    assert.equal(resolveVideoModelFamily('MiniMax-Hailuo-2.3'), 'minimax')
    assert.equal(resolveVideoModelFamily('doubao-seedance-1-0-pro'), 'seedance')
    assert.equal(resolveVideoModelFamily('kling-v2-5-turbo'), 'kling')
  })
})

describe('snapVideoDuration', () => {
  test('snaps Hailuo duration onto 6 or 10 seconds', () => {
    assert.equal(snapVideoDuration('MiniMax-Hailuo-2.3', 15), 10)
    assert.equal(snapVideoDuration('MiniMax-Hailuo-2.3', 5), 6)
  })
})

describe('buildVideoSubmitBody', () => {
  test('sends MiniMax official fields instead of OpenAI size', () => {
    const body = buildVideoSubmitBody(baseParams, 15)
    assert.equal(body.duration, 10)
    assert.equal(body.resolution, '768P')
    assert.equal(body.size, undefined)
    assert.equal(body.prompt, 'a cat walking')
  })

  test('sends Seedance ratio through metadata', () => {
    const body = buildVideoSubmitBody(
      {
        ...baseParams,
        model: 'doubao-seedance-1-0-pro',
        aspectRatio: '9:16',
        resolution: '1080P',
      },
      5
    )
    assert.equal(body.seconds, '5')
    assert.deepEqual(body.metadata, {
      ratio: '9:16',
      resolution: '1080P',
      duration: 5,
    })
  })

  test('sends Sora pixel size', () => {
    const body = buildVideoSubmitBody(
      { ...baseParams, model: 'sora-2', aspectRatio: '16:9' },
      4
    )
    assert.equal(body.size, '1280x720')
    assert.equal(body.seconds, '4')
  })
})

describe('snapVideoResolution', () => {
  test('maps 720P onto MiniMax 768P', () => {
    assert.equal(snapVideoResolution('MiniMax-Hailuo-2.3', '720P'), '768P')
  })
})
