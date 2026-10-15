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
  cacheVideoHistory,
  excludeRemovedVideoHistory,
  hasMoreTaskPages,
  isVideoGenerationTask,
  mergeVideoHistory,
  remoteContainsVideoWork,
  syncVideoHistoryFromRemote,
  toVideoHistoryItem,
  videoPlaybackUrl,
  videoTaskDeleteIds,
} from './video-history'
import type { VideoHistoryItem } from '../types'

describe('isVideoGenerationTask', () => {
  test('keeps video generate tasks and skips Suno', () => {
    assert.equal(
      isVideoGenerationTask({
        platform: '2',
        action: 'textGenerate',
        task_id: 'task_1',
      }),
      true
    )
    assert.equal(
      isVideoGenerationTask({
        platform: 'suno',
        action: 'MUSIC',
        task_id: 'task_2',
      }),
      false
    )
  })

  test('keeps Seedance models even without an action', () => {
    assert.equal(
      isVideoGenerationTask({
        task_id: 'task_3',
        properties: { origin_model_name: 'doubao-seedance-1-0-pro' },
      }),
      true
    )
  })

  test('keeps MiniMax-H3 records from the task log even without an action', () => {
    assert.equal(
      isVideoGenerationTask({
        task_id: 'task_h3',
        properties: { origin_model_name: 'MiniMax-H3' },
      }),
      true
    )
  })
})

describe('toVideoHistoryItem', () => {
  test('maps the current user task into a gallery item', () => {
    const item = toVideoHistoryItem({
      task_id: 'task_abc',
      action: 'textGenerate',
      status: 'SUCCESS',
      result_url: 'https://cdn.example.com/a.mp4',
      created_at: 1_700_000_000,
      properties: {
        origin_model_name: 'sora-2',
        input: JSON.stringify({ prompt: 'a cat walking', duration: 5 }),
      },
      data: { prompt: 'a cat walking', metadata: { ratio: '9:16', duration: 5 } },
    })

    assert.deepEqual(item, {
      id: 'task_abc',
      requestId: 'task_abc',
      deleteIds: ['task_abc'],
      status: 'done',
      url: 'https://cdn.example.com/a.mp4',
      prompt: 'a cat walking',
      model: 'sora-2',
      duration: '5',
      aspectRatio: '9:16',
      resolution: '',
      createdAt: 1_700_000_000_000,
    })
  })

  test('keeps a custom aspect ratio from task metadata', () => {
    const item = toVideoHistoryItem({
      task_id: 'task_custom_ratio',
      action: 'generate',
      status: 'SUCCESS',
      result_url: 'https://cdn.example.com/a.mp4',
      created_at: 1_700_000_000,
      properties: { origin_model_name: 'MiniMax-H3' },
      data: { metadata: { ratio: '4:5' } },
    })
    assert.equal(item?.aspectRatio, '4:5')
  })

  test('reads reference video and audio URLs from metadata', () => {
    const item = toVideoHistoryItem({
      task_id: 'task_ref_media',
      action: 'generate',
      status: 'SUCCESS',
      result_url: 'https://cdn.example.com/a.mp4',
      created_at: 1_700_000_000,
      properties: { origin_model_name: 'MiniMax-H3' },
      data: {
        metadata: {
          reference_image: 'https://example.com/ref.png',
          video_url: 'https://example.com/ref.mp4',
          audio_url: 'https://example.com/ref.mp3',
        },
      },
    })
    assert.deepEqual(item?.referenceImageUrls, ['https://example.com/ref.png'])
    assert.deepEqual(item?.referenceVideoUrls, ['https://example.com/ref.mp4'])
    assert.equal(item?.referenceAudioUrl, 'https://example.com/ref.mp3')
  })

  test('reads multiple reference image and video URLs from metadata', () => {
    const item = toVideoHistoryItem({
      task_id: 'task_ref_media_many',
      action: 'generate',
      status: 'SUCCESS',
      result_url: 'https://cdn.example.com/a.mp4',
      created_at: 1_700_000_000,
      properties: { origin_model_name: 'MiniMax-H3' },
      data: {
        metadata: {
          reference_images: [
            'https://example.com/a.png',
            'https://example.com/b.png',
          ],
          video_urls: [
            'https://example.com/a.mp4',
            'https://example.com/b.mp4',
          ],
        },
      },
    })
    assert.deepEqual(item?.referenceImageUrls, [
      'https://example.com/a.png',
      'https://example.com/b.png',
    ])
    assert.deepEqual(item?.referenceVideoUrls, [
      'https://example.com/a.mp4',
      'https://example.com/b.mp4',
    ])
  })

  test('keeps nested payload ids so delete can target the database row', () => {
    const item = toVideoHistoryItem({
      id: 8,
      task_id: 'task_public',
      action: 'generate',
      status: 'SUCCESS',
      result_url: 'https://cdn.example.com/a.mp4',
      created_at: 1_700_000_000,
      data: {
        task: { id: 'task_nested', duration: 5, ratio: '16:9' },
      },
    })

    assert.equal(item?.id, 'task_public')
    assert.equal(item?.recordId, '8')
    assert.deepEqual(item?.deleteIds, ['task_public', '8', 'task_nested'])
  })

  test('reads a plain prompt stored on the task input', () => {
    const item = toVideoHistoryItem({
      task_id: 'task_prompt',
      action: 'generate',
      status: 'SUCCESS',
      result_url: 'https://cdn.example.com/a.mp4',
      created_at: 1_700_000_000,
      properties: {
        origin_model_name: 'MiniMax-H3',
        input: 'a lantern rising over an old town',
      },
    })
    assert.equal(item?.prompt, 'a lantern rising over an old town')
  })

  test('uses the content proxy when the task succeeded without a URL', () => {
    assert.equal(
      videoPlaybackUrl({
        task_id: 'task_no_url',
        status: 'SUCCESS',
      }),
      '/v1/videos/task_no_url/content'
    )
  })
})

describe('mergeVideoHistory', () => {
  test('prefers remote playback URLs and keeps local prompt details', () => {
    const remote: VideoHistoryItem[] = [
      {
        id: 'task_1',
        requestId: 'task_1',
        status: 'done',
        url: 'https://cdn.example.com/remote.mp4',
        prompt: '',
        model: 'sora-2',
        duration: '',
        aspectRatio: '16:9',
        resolution: '720P',
        createdAt: 200,
      },
    ]
    const local: VideoHistoryItem[] = [
      {
        id: 'task_1',
        requestId: 'task_1',
        status: 'done',
        url: 'https://cdn.example.com/local.mp4',
        prompt: 'a rainy street',
        model: 'sora-2',
        duration: '6',
        aspectRatio: '9:16',
        resolution: '1080P',
        createdAt: 100,
      },
      {
        id: 'local-only',
        requestId: 'local-only',
        status: 'done',
        url: 'https://cdn.example.com/local-only.mp4',
        prompt: 'kept locally',
        model: 'sora-2',
        duration: '4',
        aspectRatio: '16:9',
        resolution: '720P',
        createdAt: 300,
      },
    ]

    const merged = mergeVideoHistory(remote, local)
    assert.equal(merged[0]?.requestId, 'local-only')
    assert.equal(merged[1]?.url, 'https://cdn.example.com/remote.mp4')
    assert.equal(merged[1]?.prompt, 'a rainy street')
    assert.equal(merged[1]?.duration, '6')
  })

  test('collapses a local nested id onto the same remote work', () => {
    const remote: VideoHistoryItem[] = [
      {
        id: 'task_public',
        requestId: 'task_public',
        deleteIds: ['task_public', 'task_nested'],
        status: 'done',
        url: 'https://cdn.example.com/same.mp4',
        prompt: '',
        model: 'MiniMax-H3',
        duration: '5',
        aspectRatio: '16:9',
        resolution: '768P',
        createdAt: 200,
      },
    ]
    const local: VideoHistoryItem[] = [
      {
        id: 'task_nested',
        requestId: 'task_nested',
        status: 'done',
        url: 'https://cdn.example.com/same.mp4',
        prompt: 'a rainy street',
        model: 'MiniMax-H3',
        duration: '5',
        aspectRatio: '16:9',
        resolution: '768P',
        createdAt: 100,
      },
    ]

    const merged = mergeVideoHistory(remote, local)
    assert.equal(merged.length, 1)
    assert.equal(merged[0]?.requestId, 'task_public')
    assert.equal(merged[0]?.prompt, 'a rainy street')
  })

  test('keeps cached local works while a later task-log page is still loading', () => {
    const remote = Array.from({ length: 8 }, (_, index) => ({
      id: `task_${index}`,
      requestId: `task_${index}`,
      status: 'done' as const,
      url: `https://cdn.example.com/${index}.mp4`,
      prompt: `clip ${index}`,
      model: 'MiniMax-H3',
      duration: '5',
      aspectRatio: '16:9' as const,
      resolution: '720P',
      createdAt: 2000 - index,
    }))
    const local = Array.from({ length: 12 }, (_, index) => ({
      id: `local_${index}`,
      requestId: `local_${index}`,
      status: 'done' as const,
      url: `https://cdn.example.com/local-${index}.mp4`,
      prompt: `local ${index}`,
      model: 'MiniMax-H3',
      duration: '5',
      aspectRatio: '16:9' as const,
      resolution: '720P',
      createdAt: 100 - index,
    }))

    assert.equal(mergeVideoHistory(remote, local).length, 20)
  })

  test('keeps the full task log timeline instead of capping at 50 works', () => {
    const remote = Array.from({ length: 51 }, (_, index) => ({
      id: `task_${index}`,
      requestId: `task_${index}`,
      status: 'done' as const,
      url: `https://cdn.example.com/${index}.mp4`,
      prompt: `clip ${index}`,
      model: 'MiniMax-H3',
      duration: '5',
      aspectRatio: '16:9' as const,
      resolution: '720P',
      createdAt: 1000 - index,
    }))
    assert.equal(mergeVideoHistory(remote, []).length, 51)
  })
})

describe('cacheVideoHistory', () => {
  test('keeps only a session-sized prefix for storage', () => {
    const remote = Array.from({ length: 51 }, (_, index) => ({
      id: `task_${index}`,
      requestId: `task_${index}`,
      status: 'done' as const,
      url: `https://cdn.example.com/${index}.mp4`,
      prompt: `clip ${index}`,
      model: 'MiniMax-H3',
      duration: '5',
      aspectRatio: '16:9' as const,
      resolution: '720P',
      createdAt: 1000 - index,
    }))
    assert.equal(cacheVideoHistory(remote).length, 50)
    assert.equal(cacheVideoHistory(remote)[0]?.id, 'task_0')
  })
})

describe('hasMoreTaskPages', () => {
  test('reads past the first task log page across the full timeline', () => {
    assert.equal(hasMoreTaskPages(1, 50, 50), false)
    assert.equal(hasMoreTaskPages(1, 50, 51), true)
    assert.equal(hasMoreTaskPages(2, 50, 51), false)
    assert.equal(hasMoreTaskPages(0, 50, 100), false)
  })
})

describe('excludeRemovedVideoHistory', () => {
  test('drops items whose requestId or id was removed', () => {
    const items: VideoHistoryItem[] = [
      {
        id: 'task_keep',
        requestId: 'task_keep',
        status: 'done',
        url: 'https://cdn.example.com/keep.mp4',
        prompt: 'keep',
        model: 'sora-2',
        duration: '6',
        aspectRatio: '16:9',
        resolution: '720P',
        createdAt: 200,
      },
      {
        id: 'task_gone',
        requestId: 'task_gone',
        status: 'done',
        url: 'https://cdn.example.com/gone.mp4',
        prompt: 'gone',
        model: 'sora-2',
        duration: '6',
        aspectRatio: '16:9',
        resolution: '720P',
        createdAt: 100,
      },
    ]

    const remaining = excludeRemovedVideoHistory(items, ['task_gone'])
    assert.equal(remaining.length, 1)
    assert.equal(remaining[0]?.requestId, 'task_keep')
  })
})

describe('syncVideoHistoryFromRemote', () => {
  test('drops local works the server no longer returns', () => {
    const remote: VideoHistoryItem[] = [
      {
        id: 'task_keep',
        requestId: 'task_keep',
        status: 'done',
        url: 'https://cdn.example.com/keep.mp4',
        prompt: 'keep',
        model: 'sora-2',
        duration: '6',
        aspectRatio: '16:9',
        resolution: '720P',
        createdAt: 200,
      },
    ]
    const local: VideoHistoryItem[] = [
      ...remote,
      {
        id: 'task_deleted',
        requestId: 'task_deleted',
        status: 'done',
        url: 'https://cdn.example.com/deleted.mp4',
        prompt: 'deleted',
        model: 'sora-2',
        duration: '6',
        aspectRatio: '16:9',
        resolution: '720P',
        createdAt: 1,
      },
    ]

    const synced = syncVideoHistoryFromRemote(remote, local, 3 * 60 * 1000)
    assert.equal(synced.length, 1)
    assert.equal(synced[0]?.requestId, 'task_keep')
  })

  test('keeps a just-generated local work until the server catches up', () => {
    const now = 50_000
    const local: VideoHistoryItem[] = [
      {
        id: 'task_new',
        requestId: 'task_new',
        status: 'done',
        url: 'https://cdn.example.com/new.mp4',
        prompt: 'new',
        model: 'sora-2',
        duration: '6',
        aspectRatio: '16:9',
        resolution: '720P',
        createdAt: now,
      },
    ]

    const synced = syncVideoHistoryFromRemote([], local, now)
    assert.equal(synced[0]?.requestId, 'task_new')
  })
})

describe('videoTaskDeleteIds', () => {
  test('includes nested and numeric aliases', () => {
    assert.deepEqual(
      videoTaskDeleteIds({
        id: 'task_public',
        requestId: 'task_public',
        recordId: '8',
        deleteIds: ['task_nested'],
        status: 'done',
        prompt: 'gone',
        model: 'MiniMax-H3',
        duration: '5',
        aspectRatio: '16:9',
        resolution: '768P',
        createdAt: 1,
      }),
      ['task_public', '8', 'task_nested']
    )
  })
})

describe('remoteContainsVideoWork', () => {
  test('matches a gallery card to the server row even when ids differ', () => {
    const remote: VideoHistoryItem[] = [
      {
        id: 'task_public',
        requestId: 'task_public',
        deleteIds: ['task_public', 'task_nested'],
        status: 'done',
        url: 'https://cdn.example.com/same.mp4',
        prompt: 'gone',
        model: 'MiniMax-H3',
        duration: '5',
        aspectRatio: '16:9',
        resolution: '768P',
        createdAt: 1,
      },
    ]

    assert.equal(
      remoteContainsVideoWork(remote, {
        id: 'task_nested',
        requestId: 'task_nested',
        url: 'https://cdn.example.com/same.mp4',
      }),
      true
    )
    assert.equal(
      remoteContainsVideoWork(remote, {
        id: 'task_other',
        requestId: 'task_other',
        url: 'https://cdn.example.com/other.mp4',
      }),
      false
    )
  })
})
