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

import { resolvePhotoSize, SEEDREAM_MODEL_IDS } from '../constants'
import {
  getPhotoSizeOptionsForModel,
  getVideoResolutionOptionsForModel,
  pickPhotoModels,
  pickVideoModels,
  resolvePhotoCallKind,
  snapPhotoSize,
} from '../lib/photo-models'
import { applyPhotoGeometry, isUpstreamSensitiveError } from '../lib/photo-utils'
import type { PhotoParams } from '../types'

const baseParams: PhotoParams = {
  model: SEEDREAM_MODEL_IDS.PRO,
  prompt: 'a cat',
  n: 1,
  size: '2048x2048',
  resolution: '2K',
  aspectRatio: '1:1',
  imageSize: '2K',
  customWidth: 2048,
  customHeight: 2048,
  imageUrlEnabled: false,
  imageDataUrls: [],
}

describe('pickPhotoModels', () => {
  test('prefers image-generation endpoint models and keeps custom ids', () => {
    const pricingByName = new Map([
      [
        'gpt-4o',
        {
          model_name: 'gpt-4o',
          supported_endpoint_types: ['openai'],
        },
      ],
      [
        SEEDREAM_MODEL_IDS.PRO,
        {
          model_name: SEEDREAM_MODEL_IDS.PRO,
          supported_endpoint_types: ['image-generation'],
        },
      ],
    ])
    const models = pickPhotoModels(
      ['gpt-4o', SEEDREAM_MODEL_IDS.PRO],
      pricingByName,
      ['my-custom-image']
    )
    assert.deepEqual(
      models.map((model) => model.id),
      [SEEDREAM_MODEL_IDS.PRO, 'my-custom-image']
    )
  })

  test('falls back to image-like names when endpoints are missing', () => {
    const models = pickPhotoModels(
      ['gpt-4o', 'doubao-seedream-4-0-250828', 'gemini-3-pro-image'],
      new Map(),
      []
    )
    assert.deepEqual(
      models.map((model) => model.id),
      ['doubao-seedream-4-0-250828', 'gemini-3-pro-image']
    )
  })

  test('does not list chat-only models when no image models are available', () => {
    const models = pickPhotoModels(['gpt-4o', 'claude-3'], new Map(), [
      'my-custom-image',
    ])
    assert.deepEqual(
      models.map((model) => model.id),
      ['my-custom-image']
    )
  })
})

describe('pickVideoModels', () => {
  test('keeps Hailuo video models and skips MiniMax chat models', () => {
    const models = pickVideoModels(
      ['MiniMax-M1', 'MiniMax-Hailuo-2.3', 'gpt-4o'],
      new Map(),
      []
    )
    assert.deepEqual(
      models.map((model) => model.id),
      ['MiniMax-Hailuo-2.3']
    )
  })
})

describe('resolvePhotoCallKind', () => {
  test('sends Gemini native image models through chat completions', () => {
    assert.equal(
      resolvePhotoCallKind('gemini-2.5-flash-image', ['gemini']),
      'gemini-chat'
    )
  })

  test('sends Imagen and Seedream through the images API', () => {
    assert.equal(
      resolvePhotoCallKind('imagen-4.0-generate-001', ['image-generation']),
      'image-generation'
    )
    assert.equal(
      resolvePhotoCallKind('doubao-seedream-5-0-pro-260628', [
        'image-generation',
      ]),
      'image-generation'
    )
  })
})

describe('getPhotoSizeOptionsForModel', () => {
  test('uses resolution_price keys when the model has them', () => {
    const options = getPhotoSizeOptionsForModel('MiniMax-image', {
      resolution_price: { '1k': 0.01, '2k': 0.02 },
    })
    assert.deepEqual(
      options.map((item) => item.value),
      ['1K', '2K', 'custom']
    )
  })

  test('limits Gemini image models without 4K in the name to 1K and 2K', () => {
    const options = getPhotoSizeOptionsForModel('gemini-3-pro-image')
    assert.deepEqual(
      options.map((item) => item.value),
      ['1K', '2K', 'custom']
    )
  })
})

describe('getVideoResolutionOptionsForModel', () => {
  test('uses billed resolutions and omits custom', () => {
    const options = getVideoResolutionOptionsForModel('MiniMax-H3', {
      resolution_price: { '720p': 0.01, '1080p': 0.02, '4k': 0.08 },
    })
    assert.deepEqual(
      options.map((item) => item.value),
      ['720P', '1080P', '4K']
    )
  })
})

describe('snapPhotoSize', () => {
  test('keeps the current size when it is still available', () => {
    assert.equal(
      snapPhotoSize('4K', [
        { value: '1K', hint: '' },
        { value: '4K', hint: '' },
      ]),
      '4K'
    )
  })

  test('falls back to 2K or the first non-custom size', () => {
    assert.equal(
      snapPhotoSize('4K', [
        { value: '1K', hint: '' },
        { value: '2K', hint: '' },
        { value: 'custom', hint: '' },
      ]),
      '2K'
    )
  })
})

describe('resolvePhotoSize', () => {
  test('maps 2K square to 2048x2048', () => {
    assert.equal(resolvePhotoSize('2K', '1:1'), '2048x2048')
  })

  test('maps 1K portrait 9:16 to 720x1280', () => {
    assert.equal(resolvePhotoSize('1K', '9:16'), '720x1280')
  })

  test('maps 4K widescreen to a 4096 long-edge size', () => {
    assert.equal(resolvePhotoSize('4K', '16:9'), '4096x2304')
  })

  test('maps custom dimensions to a clamped WxH size', () => {
    assert.equal(
      resolvePhotoSize('custom', '16:9', { width: 1920, height: 1080 }),
      '1920x1080'
    )
  })

  test('clamps custom dimensions into the Seedream range', () => {
    assert.equal(
      resolvePhotoSize('custom', '1:1', { width: 100, height: 8000 }),
      '512x4096'
    )
  })

  test('passes through explicit pixel sizes', () => {
    assert.equal(resolvePhotoSize('1024x1024', '1:1'), '1024x1024')
  })
})

describe('applyPhotoGeometry', () => {
  test('keeps size in sync when aspect ratio changes', () => {
    const next = applyPhotoGeometry(baseParams, { aspectRatio: '9:16' })
    assert.equal(next.aspectRatio, '9:16')
    assert.equal(next.imageSize, '2K')
    assert.equal(next.resolution, '2K')
    assert.equal(next.size, '1440x2560')
  })

  test('keeps size in sync when image size changes', () => {
    const next = applyPhotoGeometry(baseParams, { imageSize: '1K' })
    assert.equal(next.imageSize, '1K')
    assert.equal(next.resolution, '1K')
    assert.equal(next.size, '1024x1024')
  })

  test('ignores unsupported legacy Gemini ratios', () => {
    const next = applyPhotoGeometry(baseParams, {
      aspectRatio: '4:5' as PhotoParams['aspectRatio'],
    })
    assert.equal(next.aspectRatio, '1:1')
    assert.equal(next.size, '2048x2048')
  })

  test('seeds custom size from the current preset pixels', () => {
    const next = applyPhotoGeometry(
      { ...baseParams, aspectRatio: '16:9', size: '2560x1440' },
      { imageSize: 'custom' }
    )
    assert.equal(next.imageSize, 'custom')
    assert.equal(next.resolution, 'custom')
    assert.equal(next.customWidth, 2560)
    assert.equal(next.customHeight, 1440)
    assert.equal(next.size, '2560x1440')
  })

  test('keeps aspect ratio when only custom width changes', () => {
    const next = applyPhotoGeometry(
      {
        ...baseParams,
        imageSize: 'custom',
        resolution: 'custom',
        aspectRatio: '16:9',
        customWidth: 1920,
        customHeight: 1080,
        size: '1920x1080',
      },
      { customWidth: 1280 }
    )
    assert.equal(next.customWidth, 1280)
    assert.equal(next.customHeight, 720)
    assert.equal(next.size, '1280x720')
  })

  test('keeps both custom dimensions when width and height are set together', () => {
    const next = applyPhotoGeometry(
      {
        ...baseParams,
        imageSize: 'custom',
        resolution: 'custom',
        size: '1920x1080',
        customWidth: 1920,
        customHeight: 1080,
      },
      { customWidth: 1024, customHeight: 1536 }
    )
    assert.equal(next.customWidth, 1024)
    assert.equal(next.customHeight, 1536)
    assert.equal(next.size, '1024x1536')
  })

  test('refits custom size to a new aspect ratio using the long edge', () => {
    const next = applyPhotoGeometry(
      {
        ...baseParams,
        imageSize: 'custom',
        resolution: 'custom',
        aspectRatio: '16:9',
        customWidth: 1920,
        customHeight: 1080,
        size: '1920x1080',
      },
      { aspectRatio: '9:16' }
    )
    assert.equal(next.aspectRatio, '9:16')
    assert.equal(next.customWidth, 1080)
    assert.equal(next.customHeight, 1920)
    assert.equal(next.size, '1080x1920')
  })
})

describe('isUpstreamSensitiveError', () => {
  test('matches MiniMax / Seedream safety-filter messages', () => {
    assert.equal(
      isUpstreamSensitiveError('input new_sensitive, input text sensitive'),
      true
    )
    assert.equal(isUpstreamSensitiveError('InputTextSensitiveContent'), true)
    assert.equal(isUpstreamSensitiveError('quota exceeded'), false)
  })
})
