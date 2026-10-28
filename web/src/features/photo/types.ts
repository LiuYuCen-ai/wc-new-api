export type PhotoModel = {
  id: string
  label: string
  description?: string
  endpointTypes?: string[]
}

export type PhotoAspectRatio =
  | '1:1'
  | '16:9'
  | '9:16'
  | '4:3'
  | '3:4'
  | '3:2'
  | '2:3'
  | '21:9'

export type PhotoImageSize = string

export type PhotoSizeOption = {
  value: string
  hint: string
}

export type PhotoParams = {
  model: string
  prompt: string
  n: number | ''
  size: string
  resolution: PhotoImageSize
  aspectRatio: PhotoAspectRatio
  imageSize: PhotoImageSize
  customWidth: number
  customHeight: number
  imageUrlEnabled: boolean
  imageDataUrls: { name: string; dataUrl: string }[]
  endpointTypes?: string[]
}

export type PhotoResult = {
  id?: string
  url?: string
  b64?: string
  mimeType?: string
  revisedPrompt?: string
}

export type PhotoGenerationSnapshot = Pick<
  PhotoParams,
  | 'size'
  | 'resolution'
  | 'aspectRatio'
  | 'imageSize'
  | 'customWidth'
  | 'customHeight'
>
