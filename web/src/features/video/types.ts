export type VideoParams = {
  model: string
  prompt: string
  duration: string
  aspectRatio: string
  resolution: string
  referenceImageUrl?: string
  referenceImageUrls?: string[]
  referenceVideoUrl?: string
  referenceVideoUrls?: string[]
  referenceAudioUrl?: string
  endpointTypes?: string[]
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
  recordId?: string
  deleteIds?: string[]
  status: VideoTaskStatus
  url?: string
  error?: string
  prompt: string
  model: string
  duration: string
  aspectRatio: string
  resolution: string
  referenceImageUrl?: string
  referenceImageUrls?: string[]
  referenceVideoUrl?: string
  referenceVideoUrls?: string[]
  referenceAudioUrl?: string
  createdAt: number
}
