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
export type VideoParams = {
  model: string
  prompt: string
  duration: string
  aspectRatio: '16:9' | '9:16' | '1:1'
  resolution: '720P' | '1080P'
  referenceImageUrl?: string
}

export type VideoTaskStatus =
  | 'queued'
  | 'processing'
  | 'running'
  | 'done'
  | 'succeeded'
  | 'failed'

export type VideoGenerationResult = {
  requestId: string
  status: VideoTaskStatus
  url?: string
  error?: string
}

export type VideoHistoryItem = {
  id: string
  requestId: string
  status: VideoTaskStatus
  url?: string
  error?: string
  prompt: string
  model: string
  duration: string
  aspectRatio: '16:9' | '9:16' | '1:1'
  resolution: '720P' | '1080P'
  referenceImageUrl?: string
  createdAt: number
}
