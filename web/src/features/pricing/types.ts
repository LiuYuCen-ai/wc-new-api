// ----------------------------------------------------------------------------
// Pricing Types
// ----------------------------------------------------------------------------

export type PricingVendor = {
  id: number
  name: string
  icon?: string
  description?: string
}

export type PricingModel = {
  id: number
  model_name: string
  description?: string
  icon?: string
  vendor_id?: number
  vendor_name?: string
  vendor_icon?: string
  vendor_description?: string
  quota_type: number
  model_ratio: number
  completion_ratio: number
  model_price?: number
  cache_ratio?: number | null
  create_cache_ratio?: number | null
  image_ratio?: number | null
  audio_ratio?: number | null
  audio_completion_ratio?: number | null
  enable_groups: string[]
  tags?: string
  supported_endpoint_types?: string[]
  key?: string
  group_ratio?: Record<string, number>
  /** Billing mode (e.g. "tiered_expr" or "resolution") used to flag dynamic pricing */
  billing_mode?: string
  /** Raw expression describing dynamic / tiered billing */
  billing_expr?: string
  /** USD unit prices keyed by resolution when billing_mode is resolution */
  resolution_price?: Record<string, number>
  /** Billing unit for resolution_price: "second" | "million_tokens" */
  resolution_unit?: string
  /**
   * CNY unit prices per 1M tokens keyed by video input:
   * {no_video: 无视频输入, video: 有视频输入}。
   */
  video_input_price?: Record<string, number>
  /**
   * 逐分辨率「有视频输入单价」覆盖（元/百万 token），
   * 仅按百万 token 分辨率计费的模型生效；未配置时无此字段。
   */
  video_input_resolutions?: Record<string, number>
  /** Pricing version returned by backend, useful for cache busting */
  pricing_version?: string
  /**
   * Optional model metadata fields reserved for backend-provided catalog data.
   * Keep them data-driven; do not synthesize display values on the client.
   */
  context_length?: number
  max_output_tokens?: number
  knowledge_cutoff?: string
  release_date?: string
  parameter_count?: string
  input_modalities?: Modality[]
  output_modalities?: Modality[]
  capabilities?: ModelCapability[]
}

/** Input/output modalities supported by a model. */
export type Modality = 'text' | 'image' | 'audio' | 'video' | 'file'

/** Functional capabilities a model exposes. */
export type ModelCapability =
  | 'function_calling'
  | 'streaming'
  | 'vision'
  | 'json_mode'
  | 'structured_output'
  | 'reasoning'
  | 'tools'
  | 'system_prompt'
  | 'web_search'
  | 'code_interpreter'
  | 'caching'
  | 'embeddings'

export type PricingData = {
  success: boolean
  message?: string
  data: PricingModel[]
  vendors: PricingVendor[]
  group_ratio: Record<string, number>
  usable_group: Record<string, { desc: string; ratio: number }>
  supported_endpoint: Record<string, string>
  auto_groups: string[]
}

export type TokenUnit = 'M' | 'K'
export type PriceType =
  | 'input'
  | 'output'
  | 'cache'
  | 'create_cache'
  | 'image'
  | 'audio_input'
  | 'audio_output'
export type QuotaType = 0 | 1 // 0: token-based, 1: per-request
