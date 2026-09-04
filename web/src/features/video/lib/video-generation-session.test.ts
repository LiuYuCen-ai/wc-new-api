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
import { afterEach, describe, test } from 'node:test'

import {
  loadPersistedVideoJobs,
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
})
