import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'

import {
  loadPersistedVideoJobs,
  pendingVideoJobsToHistoryItems,
  removePersistedVideoJob,
  upsertPersistedVideoJob,
} from './video-generation-session'
import type { VideoParams } from '../types'

const memory = new Map<string, string>()

const storage = {
  getItem(key: string) {
    return memory.get(key) ?? null
  },
  setItem(key: string, value: string) {
    memory.set(key, value)
  },
  removeItem(key: string) {
    memory.delete(key)
  },
}

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { sessionStorage: storage },
})
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: storage,
})

const params: VideoParams = {
  model: 'MiniMax-H3',
  prompt: 'a rainy street',
  duration: '6',
  aspectRatio: '16:9',
  resolution: '768P',
}

afterEach(() => {
  memory.clear()
})

describe('video generation session', () => {
  test('keeps a pending job so leaving the page can resume it', () => {
    upsertPersistedVideoJob({
      id: 'job-1',
      userId: 1,
      taskId: 'task_public',
      params,
      status: 'processing',
      startedAt: Date.now(),
    })

    const jobs = loadPersistedVideoJobs(1)
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0]?.taskId, 'task_public')
    assert.equal(loadPersistedVideoJobs(2).length, 0)

    removePersistedVideoJob('job-1')
    assert.equal(loadPersistedVideoJobs(1).length, 0)
  })

  test('keeps multiple in-flight jobs so another video can start before the first finishes', () => {
    const startedAt = Date.now()
    upsertPersistedVideoJob({
      id: 'job-1',
      userId: 1,
      taskId: 'task_one',
      params,
      status: 'processing',
      startedAt,
    })
    upsertPersistedVideoJob({
      id: 'job-2',
      userId: 1,
      taskId: 'task_two',
      params: { ...params, prompt: 'a lantern rising' },
      status: 'queued',
      startedAt: startedAt + 1,
    })

    const jobs = loadPersistedVideoJobs(1)
    assert.equal(jobs.length, 2)
    assert.deepEqual(
      jobs.map((job) => job.id).sort(),
      ['job-1', 'job-2']
    )
  })

  test('puts newer generating cards ahead of older ones in the gallery', () => {
    const items = pendingVideoJobsToHistoryItems([
      {
        id: 'job-old',
        userId: 1,
        taskId: 'task_old',
        params,
        status: 'processing',
        startedAt: 100,
      },
      {
        id: 'job-new',
        userId: 1,
        taskId: 'task_new',
        params: { ...params, prompt: 'a lantern rising' },
        status: 'queued',
        startedAt: 200,
      },
    ])

    assert.deepEqual(
      items.map((item) => item.id),
      ['job-new', 'job-old']
    )
    assert.equal(items[0]?.prompt, 'a lantern rising')
    assert.equal(items[1]?.prompt, 'a rainy street')
  })
})
