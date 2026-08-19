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

/**
 * Workflow node definitions for the Experience Hub (ComfyUI-style playground).
 *
 * These node schemas mirror the reference ComfyUI custom nodes so the canvas can
 * render ComfyUI-like nodes with typed input/output ports and inline widgets.
 * The definitions are self-contained (no external ComfyUI dependency).
 *
 * The set covers a full workflow: input/loader nodes (Load Image, Text),
 * the three API function nodes from the reference `ModeHub_nanobanana` pack
 * (Gemini Image, Image to Prompt, Sora Video), and output/preview nodes
 * (Preview Image, Save Image, Preview Video, Show Text).
 */

/** Port data types, following ComfyUI's typed-socket convention. */
export type PortType = 'IMAGE' | 'VIDEO' | 'STRING'

export type NodePort = {
  /** Stable key used as the ReactFlow handle id. */
  id: string
  /** i18n key for the port label. */
  label: string
  type: PortType
}

/** Inline widget kinds rendered inside a node body. */
export type WidgetKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'boolean'
  | 'upload'
  | 'preview-image'
  | 'preview-text'
  /** Dynamic select populated from the user's models (/api/user/models). */
  | 'model-select'
  /** Dynamic select populated from the user's model groups (/api/user/self/groups). */
  | 'group-select'
  /** Model-aware image size / aspect-ratio controls (mirrors /photo). */
  | 'image-params'

export type NodeWidget = {
  /** Field key, unique within a node. */
  key: string
  /** i18n key for the widget label. */
  label: string
  kind: WidgetKind
  /** Default value applied when a node is created. */
  defaultValue: string | number | boolean
  /** Options for `select` widgets (value is used as-is, label is i18n key). */
  options?: { value: string; label: string }[]
  /** Bounds for `number` widgets. */
  min?: number
  max?: number
  step?: number
  /** Placeholder i18n key for text widgets. */
  placeholder?: string
  /**
   * Conditional visibility: the widget is only shown when the sibling widget
   * `showWhen.key` currently equals `showWhen.equals`.
   */
  showWhen?: { key: string; equals: string }
}

export type WorkflowNodeKind =
  | 'start'
  | 'end'
  | 'load-image'
  | 'load-video'
  | 'text-input'
  | 'primitive-int'
  | 'primitive-float'
  | 'primitive-boolean'
  | 'gemini-image'
  | 'image-to-prompt'
  | 'sora-video'
  | 'generate-image'
  | 'edit-image'
  | 'describe-image'
  | 'generate-video'
  | 'resize-image'
  | 'crop-image'
  | 'invert-image'
  | 'flip-image'
  | 'blend-image'
  | 'concat-text'
  | 'replace-text'
  | 'preview-image'
  | 'preview-video'
  | 'show-text'

/** Menu grouping for the node palette / right-click menu. */
export type NodeCategory =
  | 'Flow'
  | 'Loaders'
  | 'Primitives'
  | 'Generate'
  | 'Google-Gemini'
  | 'OpenAI-Sora'
  | 'Image'
  | 'Text'
  | 'Output'

export type WorkflowNodeDef = {
  kind: WorkflowNodeKind
  /** i18n key for the node title shown in the header. */
  title: string
  /** i18n key for the node subtitle/category (also used for palette grouping). */
  category: NodeCategory
  inputs: NodePort[]
  outputs: NodePort[]
  widgets: NodeWidget[]
  /** Accent color for the node header, keyed to its category. */
  accent: string
}

/** Category accent colors, ComfyUI-style. */
export const CATEGORY_ACCENT: Record<NodeCategory, string> = {
  Flow: '#4fae7a',
  Loaders: '#9b8cdd',
  Primitives: '#8796b2',
  Generate: '#719fdb',
  'Google-Gemini': '#708ed6',
  'OpenAI-Sora': '#8a7bd0',
  Image: '#78addd',
  Text: '#b58bd3',
  Output: '#a88bd6',
}

/* -------------------------------------------------------------------------- */
/* Flow boundary nodes (run markers)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Start — marks the beginning of a chain. Each connected sub-graph is executed
 * as an independent chain, and all chains run in parallel. This node has no
 * effect on data; it only acts as an explicit run boundary marker.
 */
const startNode: WorkflowNodeDef = {
  kind: 'start',
  title: 'Start',
  category: 'Flow',
  accent: CATEGORY_ACCENT.Flow,
  inputs: [],
  outputs: [
    { id: 'text', label: 'Text', type: 'STRING' },
    { id: 'image', label: 'Image', type: 'IMAGE' },
    { id: 'video', label: 'Video', type: 'VIDEO' },
  ],
  widgets: [],
}

/** End — marks the end of a chain. Run boundary marker only. */
const endNode: WorkflowNodeDef = {
  kind: 'end',
  title: 'End',
  category: 'Flow',
  accent: CATEGORY_ACCENT.Flow,
  inputs: [
    { id: 'text', label: 'Text', type: 'STRING' },
    { id: 'image', label: 'Image', type: 'IMAGE' },
    { id: 'video', label: 'Video', type: 'VIDEO' },
  ],
  outputs: [],
  widgets: [],
}

/* -------------------------------------------------------------------------- */
/* Input / loader nodes                                                       */
/* -------------------------------------------------------------------------- */

/** Load Image — the canonical ComfyUI input node providing an IMAGE. */
const loadImageNode: WorkflowNodeDef = {
  kind: 'load-image',
  title: 'Load Image',
  category: 'Loaders',
  accent: CATEGORY_ACCENT.Loaders,
  inputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  outputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  widgets: [{ key: 'image', label: 'Image', kind: 'upload', defaultValue: '' }],
}

/** Text — a primitive STRING source node. */
const textInputNode: WorkflowNodeDef = {
  kind: 'text-input',
  title: 'Text',
  category: 'Loaders',
  accent: CATEGORY_ACCENT.Loaders,
  inputs: [{ id: 'text', label: 'Text', type: 'STRING' }],
  outputs: [{ id: 'text', label: 'Text', type: 'STRING' }],
  widgets: [
    {
      key: 'text',
      label: 'Text',
      kind: 'textarea',
      defaultValue: '',
      placeholder: 'Enter text',
    },
  ],
}

/** Load Video — provides a VIDEO from a URL or an uploaded file. */
const loadVideoNode: WorkflowNodeDef = {
  kind: 'load-video',
  title: 'Load Video',
  category: 'Loaders',
  accent: CATEGORY_ACCENT.Loaders,
  inputs: [{ id: 'video', label: 'Video', type: 'VIDEO' }],
  outputs: [{ id: 'video', label: 'Video', type: 'VIDEO' }],
  widgets: [
    {
      key: 'video',
      label: 'Video URL',
      kind: 'text',
      defaultValue: '',
      placeholder: 'Enter a video URL',
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* Primitive value nodes                                                      */
/* -------------------------------------------------------------------------- */

/** Int — a primitive integer source, emitted as STRING for wiring. */
const primitiveIntNode: WorkflowNodeDef = {
  kind: 'primitive-int',
  title: 'Int',
  category: 'Primitives',
  accent: CATEGORY_ACCENT.Primitives,
  inputs: [{ id: 'value', label: 'Value', type: 'STRING' }],
  outputs: [{ id: 'value', label: 'Value', type: 'STRING' }],
  widgets: [
    { key: 'value', label: 'Value', kind: 'number', defaultValue: 0, step: 1 },
  ],
}

/** Float — a primitive float source, emitted as STRING for wiring. */
const primitiveFloatNode: WorkflowNodeDef = {
  kind: 'primitive-float',
  title: 'Float',
  category: 'Primitives',
  accent: CATEGORY_ACCENT.Primitives,
  inputs: [{ id: 'value', label: 'Value', type: 'STRING' }],
  outputs: [{ id: 'value', label: 'Value', type: 'STRING' }],
  widgets: [
    {
      key: 'value',
      label: 'Value',
      kind: 'number',
      defaultValue: 0,
      step: 0.01,
    },
  ],
}

/** Boolean — a primitive boolean source, emitted as STRING for wiring. */
const primitiveBooleanNode: WorkflowNodeDef = {
  kind: 'primitive-boolean',
  title: 'Boolean',
  category: 'Primitives',
  accent: CATEGORY_ACCENT.Primitives,
  inputs: [{ id: 'value', label: 'Value', type: 'STRING' }],
  outputs: [{ id: 'value', label: 'Value', type: 'STRING' }],
  widgets: [
    { key: 'value', label: 'Value', kind: 'boolean', defaultValue: false },
  ],
}

/* -------------------------------------------------------------------------- */
/* Function nodes (mirror ModeHub_nanobanana)                                 */
/* -------------------------------------------------------------------------- */

/**
 * Gemini image generation node — text/image to image.
 * Mirrors the reference `GeminiImageGenerator` node (full parameter set).
 */
const geminiImageNode: WorkflowNodeDef = {
  kind: 'gemini-image',
  title: 'Gemini Image',
  category: 'Generate',
  accent: CATEGORY_ACCENT.Generate,
  inputs: [
    { id: 'image1', label: 'Reference Image 1', type: 'IMAGE' },
    { id: 'image2', label: 'Reference Image 2', type: 'IMAGE' },
    { id: 'image3', label: 'Reference Image 3', type: 'IMAGE' },
    { id: 'image4', label: 'Reference Image 4', type: 'IMAGE' },
  ],
  outputs: [
    { id: 'image', label: 'Image', type: 'IMAGE' },
    { id: 'api_respond', label: 'API Respond', type: 'STRING' },
  ],
  widgets: [
    {
      key: 'prompt',
      label: 'Prompt',
      kind: 'textarea',
      defaultValue: '',
      placeholder: 'Describe the image you want to generate',
    },
    {
      key: 'api_key',
      label: 'API Key',
      kind: 'text',
      defaultValue: '',
      placeholder: 'Enter your API key',
    },
    {
      key: 'base_url',
      label: 'Base URL',
      kind: 'text',
      defaultValue: 'https://api.easyart.cc',
      placeholder: 'Enter your Base URL',
    },
    {
      key: 'model_name',
      label: 'Model',
      kind: 'select',
      defaultValue: 'gemini-3-pro-image-preview',
      options: [
        {
          value: 'gemini-3-pro-image-preview',
          label: 'gemini-3-pro-image-preview',
        },
        { value: 'custom', label: 'Custom Input' },
      ],
    },
    {
      key: 'custom_model_name',
      label: 'Custom Model Name',
      kind: 'text',
      defaultValue: '',
      placeholder: 'Enter a custom model name',
    },
    {
      key: 'imageSize',
      label: 'Image Size',
      kind: 'select',
      defaultValue: '1K',
      options: [
        { value: '1K', label: '1K' },
        { value: '2K', label: '2K' },
        { value: '4K', label: '4K' },
      ],
    },
    {
      key: 'aspect_ratio',
      label: 'Aspect Ratio',
      kind: 'select',
      defaultValue: 'Free',
      options: [
        { value: 'Free', label: 'Free' },
        { value: 'Landscape', label: 'Landscape' },
        { value: 'Portrait', label: 'Portrait' },
        { value: 'Square', label: 'Square' },
      ],
    },
    {
      key: 'temperature',
      label: 'Temperature',
      kind: 'number',
      defaultValue: 0.7,
      min: 0,
      max: 2,
      step: 0.1,
    },
    {
      key: 'seed',
      label: 'Seed',
      kind: 'number',
      defaultValue: -1,
      min: -1,
      max: 2147483647,
      step: 1,
    },
  ],
}

/**
 * Image/Video to prompt node — reverse-engineers a prompt from media.
 * Mirrors the reference `GeminiImageToPrompt` node (full parameter set).
 */
const imageToPromptNode: WorkflowNodeDef = {
  kind: 'image-to-prompt',
  title: 'Image to Prompt',
  category: 'Generate',
  accent: CATEGORY_ACCENT.Generate,
  inputs: [
    { id: 'ref_image', label: 'Reference Image', type: 'IMAGE' },
    { id: 'video', label: 'Video', type: 'VIDEO' },
  ],
  outputs: [
    { id: 'prompt', label: 'Prompt', type: 'STRING' },
    { id: 'api_respond', label: 'API Respond', type: 'STRING' },
  ],
  widgets: [
    {
      key: 'api_key',
      label: 'API Key',
      kind: 'text',
      defaultValue: '',
      placeholder: 'Enter your API key',
    },
    {
      key: 'base_url',
      label: 'Base URL',
      kind: 'text',
      defaultValue: 'https://api.easyart.cc',
      placeholder: 'Enter your Base URL',
    },
    {
      key: 'model_name',
      label: 'Model',
      kind: 'select',
      defaultValue: 'gemini-2.5-flash',
      options: [
        { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
        { value: 'gemini-3-pro-preview', label: 'gemini-3-pro-preview' },
        { value: 'custom', label: 'Custom Input' },
      ],
    },
    {
      key: 'custom_model_name',
      label: 'Custom Model Name',
      kind: 'text',
      defaultValue: '',
      placeholder: 'Enter a custom model name',
    },
    {
      key: 'role',
      label: 'System Role',
      kind: 'textarea',
      defaultValue: 'You are a helpful assistant',
      placeholder: 'You are a helpful assistant',
    },
    {
      key: 'prompt',
      label: 'Instruction',
      kind: 'textarea',
      defaultValue: 'describe the image',
      placeholder: 'describe the image',
    },
    {
      key: 'temperature',
      label: 'Temperature',
      kind: 'number',
      defaultValue: 0.6,
      min: 0,
      max: 2,
      step: 0.1,
    },
    {
      key: 'seed',
      label: 'Seed',
      kind: 'number',
      defaultValue: 100,
      min: -1,
      max: 2147483647,
      step: 1,
    },
  ],
}

/**
 * Sora prompt-to-video node — text to video.
 * Mirrors the reference `soraPromptToVideo` node (full parameter set).
 */
const soraVideoNode: WorkflowNodeDef = {
  kind: 'sora-video',
  title: 'Sora Video',
  category: 'OpenAI-Sora',
  accent: CATEGORY_ACCENT['OpenAI-Sora'],
  inputs: [{ id: 'input_reference', label: 'Reference Image', type: 'IMAGE' }],
  outputs: [
    { id: 'video', label: 'Video', type: 'VIDEO' },
    { id: 'api_respond', label: 'API Respond', type: 'STRING' },
  ],
  widgets: [
    {
      key: 'prompt',
      label: 'Prompt',
      kind: 'textarea',
      defaultValue: '',
      placeholder: 'Describe the video you want to generate',
    },
    {
      key: 'api_key',
      label: 'API Key',
      kind: 'text',
      defaultValue: '',
      placeholder: 'Enter your API key',
    },
    {
      key: 'base_url',
      label: 'Base URL',
      kind: 'text',
      defaultValue: 'https://api.easyart.cc',
      placeholder: 'Enter your Base URL',
    },
    {
      key: 'model_name',
      label: 'Model',
      kind: 'select',
      defaultValue: 'sora-2',
      options: [
        { value: 'sora-2', label: 'sora-2' },
        { value: 'sora-2-pro', label: 'sora-2-pro' },
        { value: 'custom', label: 'Custom Input' },
      ],
    },
    {
      key: 'custom_model_name',
      label: 'Custom Model Name',
      kind: 'text',
      defaultValue: '',
      placeholder: 'Enter a custom model name',
    },
    {
      key: 'size',
      label: 'Size',
      kind: 'select',
      defaultValue: '720x1280',
      options: [
        { value: '1280x720', label: '1280x720' },
        { value: '720x1280', label: '720x1280' },
      ],
    },
    {
      key: 'seconds',
      label: 'Duration',
      kind: 'select',
      defaultValue: '10',
      options: [
        { value: '10', label: '10s' },
        { value: '15', label: '15s' },
        { value: '25', label: '25s' },
      ],
    },
    {
      key: 'watermark',
      label: 'Watermark',
      kind: 'boolean',
      defaultValue: false,
    },
    {
      key: 'private',
      label: 'Private',
      kind: 'boolean',
      defaultValue: false,
    },
    {
      key: 'seed',
      label: 'Seed',
      kind: 'number',
      defaultValue: -1,
      min: -1,
      max: 2147483647,
      step: 1,
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* Generic generation nodes (model-agnostic, via site relay / node API)       */
/* -------------------------------------------------------------------------- */

/**
 * Shared "provider" widgets for Generate nodes. A `source` toggle switches
 * between two modes:
 *  - `default`: call the platform via the logged-in session relay (`/pg/...`),
 *    deducting quota from the current user. Exposes a token + model picker.
 *  - `custom`: call an arbitrary OpenAI-compatible endpoint with a custom
 *    base URL / API key / model name.
 */
function providerWidgets(): NodeWidget[] {
  return [
    {
      key: 'source',
      label: 'Provider',
      kind: 'select',
      defaultValue: 'default',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'custom', label: 'Custom' },
      ],
    },
    {
      key: 'group',
      label: 'Model Group',
      kind: 'group-select',
      defaultValue: '',
      showWhen: { key: 'source', equals: 'default' },
    },
    {
      key: 'model',
      label: 'Model',
      kind: 'model-select',
      defaultValue: '',
      showWhen: { key: 'source', equals: 'default' },
    },
    {
      key: 'base_url',
      label: 'Base URL',
      kind: 'text',
      defaultValue: 'https://api.easyart.cc',
      placeholder: 'Enter your Base URL',
      showWhen: { key: 'source', equals: 'custom' },
    },
    {
      key: 'api_key',
      label: 'API Key',
      kind: 'text',
      defaultValue: '',
      placeholder: 'Enter your API key',
      showWhen: { key: 'source', equals: 'custom' },
    },
    {
      key: 'custom_model',
      label: 'Model',
      kind: 'text',
      defaultValue: 'gpt-image-1',
      placeholder: 'Enter the model name',
      showWhen: { key: 'source', equals: 'custom' },
    },
  ]
}

/** Provider widgets tuned for vision (describe) nodes: custom model defaults to a chat model. */
function providerWidgetsForVision(): NodeWidget[] {
  return providerWidgets().map((w) =>
    w.key === 'custom_model' ? { ...w, defaultValue: 'gpt-4o' } : w
  )
}

/** Provider widgets tuned for video nodes: custom model defaults to a video model. */
function providerWidgetsForVideo(): NodeWidget[] {
  return providerWidgets().map((w) =>
    w.key === 'custom_model' ? { ...w, defaultValue: 'sora-2' } : w
  )
}

/**
 * Image-generation parameters shared by the Generate Image and Edit Image
 * nodes. The size / image-size / aspect-ratio controls are model-aware
 * (rendered by the `image-params` widget, matching the /photo playground);
 * temperature and seed follow the Gemini Image node.
 */
function imageGenExtraWidgets(): NodeWidget[] {
  return [
    {
      key: 'imageParams',
      label: 'Size',
      kind: 'image-params',
      defaultValue: '',
    },
    {
      key: 'temperature',
      label: 'Temperature',
      kind: 'number',
      defaultValue: 0.7,
      min: 0,
      max: 2,
      step: 0.1,
    },
    {
      key: 'seed',
      label: 'Seed',
      kind: 'number',
      defaultValue: -1,
      min: -1,
      max: 2147483647,
      step: 1,
    },
  ]
}

/** Generate Image — text-to-image with any relay-configured model. */
const generateImageNode: WorkflowNodeDef = {
  kind: 'generate-image',
  title: 'Generate Image',
  category: 'Generate',
  accent: CATEGORY_ACCENT.Generate,
  inputs: [{ id: 'prompt', label: 'Prompt', type: 'STRING' }],
  outputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  widgets: [...providerWidgets(), ...imageGenExtraWidgets()],
}

/** Edit Image — image + text to image (image-to-image) via relay edits API. */
const editImageNode: WorkflowNodeDef = {
  kind: 'edit-image',
  title: 'Edit Image',
  category: 'Generate',
  accent: CATEGORY_ACCENT.Generate,
  inputs: [
    { id: 'image1', label: 'Reference Image 1', type: 'IMAGE' },
    { id: 'image2', label: 'Reference Image 2', type: 'IMAGE' },
    { id: 'prompt', label: 'Prompt', type: 'STRING' },
  ],
  outputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  widgets: [...providerWidgets(), ...imageGenExtraWidgets()],
}

/** Describe Image — image-to-text using any vision chat model. */
const describeImageNode: WorkflowNodeDef = {
  kind: 'describe-image',
  title: 'Describe Image',
  category: 'Generate',
  accent: CATEGORY_ACCENT.Generate,
  inputs: [{ id: 'ref_image', label: 'Reference Image', type: 'IMAGE' }],
  outputs: [{ id: 'text', label: 'Text', type: 'STRING' }],
  widgets: [
    ...providerWidgetsForVision(),
    {
      key: 'prompt',
      label: 'Instruction',
      kind: 'textarea',
      defaultValue: 'Describe this image in detail.',
      placeholder: 'Describe this image in detail.',
    },
    {
      key: 'temperature',
      label: 'Temperature',
      kind: 'number',
      defaultValue: 0.6,
      min: 0,
      max: 2,
      step: 0.1,
    },
  ],
}

/** Generate Video — text/image to video via relay (default) or node base_url (custom). */
const generateVideoNode: WorkflowNodeDef = {
  kind: 'generate-video',
  title: 'Generate Video',
  category: 'Generate',
  accent: CATEGORY_ACCENT.Generate,
  inputs: [
    { id: 'input_reference', label: 'Reference Image', type: 'IMAGE' },
    { id: 'prompt', label: 'Prompt', type: 'STRING' },
  ],
  outputs: [{ id: 'video', label: 'Video', type: 'VIDEO' }],
  widgets: [
    ...providerWidgetsForVideo(),
    {
      key: 'size',
      label: 'Size',
      kind: 'select',
      defaultValue: '720x1280',
      options: [
        { value: '1280x720', label: '1280x720' },
        { value: '720x1280', label: '720x1280' },
      ],
    },
    {
      key: 'seconds',
      label: 'Duration',
      kind: 'select',
      defaultValue: '10',
      options: [
        { value: '5', label: '5s' },
        { value: '10', label: '10s' },
        { value: '15', label: '15s' },
      ],
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* Image processing nodes (run in-browser via canvas)                         */
/* -------------------------------------------------------------------------- */

/** Resize Image — scale an IMAGE to a target width/height. */
const resizeImageNode: WorkflowNodeDef = {
  kind: 'resize-image',
  title: 'Resize Image',
  category: 'Image',
  accent: CATEGORY_ACCENT.Image,
  inputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  outputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  widgets: [
    {
      key: 'width',
      label: 'Width',
      kind: 'number',
      defaultValue: 1024,
      min: 1,
      max: 8192,
      step: 1,
    },
    {
      key: 'height',
      label: 'Height',
      kind: 'number',
      defaultValue: 1024,
      min: 1,
      max: 8192,
      step: 1,
    },
    {
      key: 'keep_ratio',
      label: 'Keep Aspect Ratio',
      kind: 'boolean',
      defaultValue: true,
    },
  ],
}

/** Crop Image — crop a rectangular region from an IMAGE. */
const cropImageNode: WorkflowNodeDef = {
  kind: 'crop-image',
  title: 'Crop Image',
  category: 'Image',
  accent: CATEGORY_ACCENT.Image,
  inputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  outputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  widgets: [
    { key: 'x', label: 'X', kind: 'number', defaultValue: 0, min: 0, step: 1 },
    { key: 'y', label: 'Y', kind: 'number', defaultValue: 0, min: 0, step: 1 },
    {
      key: 'width',
      label: 'Width',
      kind: 'number',
      defaultValue: 512,
      min: 1,
      max: 8192,
      step: 1,
    },
    {
      key: 'height',
      label: 'Height',
      kind: 'number',
      defaultValue: 512,
      min: 1,
      max: 8192,
      step: 1,
    },
  ],
}

/** Invert Image — invert the RGB colors of an IMAGE. */
const invertImageNode: WorkflowNodeDef = {
  kind: 'invert-image',
  title: 'Invert Image',
  category: 'Image',
  accent: CATEGORY_ACCENT.Image,
  inputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  outputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  widgets: [],
}

/** Flip Image — flip an IMAGE horizontally or vertically. */
const flipImageNode: WorkflowNodeDef = {
  kind: 'flip-image',
  title: 'Flip Image',
  category: 'Image',
  accent: CATEGORY_ACCENT.Image,
  inputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  outputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  widgets: [
    {
      key: 'direction',
      label: 'Direction',
      kind: 'select',
      defaultValue: 'horizontal',
      options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
      ],
    },
  ],
}

/** Image Blend — blend two IMAGEs together with an opacity factor. */
const blendImageNode: WorkflowNodeDef = {
  kind: 'blend-image',
  title: 'Image Blend',
  category: 'Image',
  accent: CATEGORY_ACCENT.Image,
  inputs: [
    { id: 'image1', label: 'Image 1', type: 'IMAGE' },
    { id: 'image2', label: 'Image 2', type: 'IMAGE' },
  ],
  outputs: [{ id: 'image', label: 'Image', type: 'IMAGE' }],
  widgets: [
    {
      key: 'opacity',
      label: 'Opacity',
      kind: 'number',
      defaultValue: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* Text processing nodes                                                      */
/* -------------------------------------------------------------------------- */

/** Concat Text — join two STRINGs with a separator. */
const concatTextNode: WorkflowNodeDef = {
  kind: 'concat-text',
  title: 'Concat Text',
  category: 'Text',
  accent: CATEGORY_ACCENT.Text,
  inputs: [
    { id: 'text1', label: 'Text 1', type: 'STRING' },
    { id: 'text2', label: 'Text 2', type: 'STRING' },
  ],
  outputs: [{ id: 'text', label: 'Text', type: 'STRING' }],
  widgets: [
    {
      key: 'separator',
      label: 'Separator',
      kind: 'text',
      defaultValue: ' ',
      placeholder: 'Separator',
    },
  ],
}

/** Text Replace — replace a substring in a STRING. */
const replaceTextNode: WorkflowNodeDef = {
  kind: 'replace-text',
  title: 'Text Replace',
  category: 'Text',
  accent: CATEGORY_ACCENT.Text,
  inputs: [{ id: 'text', label: 'Text', type: 'STRING' }],
  outputs: [{ id: 'text', label: 'Text', type: 'STRING' }],
  widgets: [
    {
      key: 'find',
      label: 'Find',
      kind: 'text',
      defaultValue: '',
      placeholder: 'Find',
    },
    {
      key: 'replace',
      label: 'Replace With',
      kind: 'text',
      defaultValue: '',
      placeholder: 'Replace with',
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* Output / preview nodes                                                      */
/* -------------------------------------------------------------------------- */

/** Preview Image — terminal node showing an IMAGE result. */
const previewImageNode: WorkflowNodeDef = {
  kind: 'preview-image',
  title: 'Preview Image',
  category: 'Output',
  accent: CATEGORY_ACCENT.Output,
  inputs: [{ id: 'images', label: 'Image', type: 'IMAGE' }],
  outputs: [],
  widgets: [
    {
      key: 'preview',
      label: 'Preview',
      kind: 'preview-image',
      defaultValue: '',
    },
  ],
}

/** Preview Video — terminal node showing a VIDEO result. */
const previewVideoNode: WorkflowNodeDef = {
  kind: 'preview-video',
  title: 'Preview Video',
  category: 'Output',
  accent: CATEGORY_ACCENT.Output,
  inputs: [{ id: 'video', label: 'Video', type: 'VIDEO' }],
  outputs: [],
  widgets: [
    {
      key: 'preview',
      label: 'Preview',
      kind: 'preview-image',
      defaultValue: '',
    },
  ],
}

/** Show Text — terminal node displaying a STRING result. */
const showTextNode: WorkflowNodeDef = {
  kind: 'show-text',
  title: 'Show Text',
  category: 'Output',
  accent: CATEGORY_ACCENT.Output,
  inputs: [{ id: 'text', label: 'Text', type: 'STRING' }],
  outputs: [],
  widgets: [
    { key: 'text', label: 'Text', kind: 'preview-text', defaultValue: '' },
  ],
}

export const WORKFLOW_NODE_DEFS: Record<WorkflowNodeKind, WorkflowNodeDef> = {
  start: startNode,
  end: endNode,
  'load-image': loadImageNode,
  'load-video': loadVideoNode,
  'text-input': textInputNode,
  'primitive-int': primitiveIntNode,
  'primitive-float': primitiveFloatNode,
  'primitive-boolean': primitiveBooleanNode,
  'gemini-image': geminiImageNode,
  'image-to-prompt': imageToPromptNode,
  'sora-video': soraVideoNode,
  'generate-image': generateImageNode,
  'edit-image': editImageNode,
  'describe-image': describeImageNode,
  'generate-video': generateVideoNode,
  'resize-image': resizeImageNode,
  'crop-image': cropImageNode,
  'invert-image': invertImageNode,
  'flip-image': flipImageNode,
  'blend-image': blendImageNode,
  'concat-text': concatTextNode,
  'replace-text': replaceTextNode,
  'preview-image': previewImageNode,
  'preview-video': previewVideoNode,
  'show-text': showTextNode,
}

/** Ordered list used to populate the "add node" menu (grouped by category). */
export const WORKFLOW_NODE_LIST: WorkflowNodeDef[] = [
  startNode,
  endNode,
  loadImageNode,
  loadVideoNode,
  textInputNode,
  primitiveIntNode,
  primitiveFloatNode,
  primitiveBooleanNode,
  generateImageNode,
  editImageNode,
  describeImageNode,
  generateVideoNode,
  geminiImageNode,
  imageToPromptNode,
  soraVideoNode,
  resizeImageNode,
  cropImageNode,
  invertImageNode,
  flipImageNode,
  blendImageNode,
  concatTextNode,
  replaceTextNode,
  previewImageNode,
  previewVideoNode,
  showTextNode,
]

/** Category display order for the grouped palette. */
export const NODE_CATEGORY_ORDER: NodeCategory[] = [
  'Flow',
  'Loaders',
  'Primitives',
  'Generate',
  'OpenAI-Sora',
  'Image',
  'Text',
  'Output',
]

/** Build the default widget-value map for a freshly created node. */
export function buildDefaultValues(
  kind: WorkflowNodeKind
): Record<string, string | number | boolean> {
  const def = WORKFLOW_NODE_DEFS[kind]
  const values: Record<string, string | number | boolean> = {}
  for (const widget of def.widgets) {
    values[widget.key] = widget.defaultValue
  }
  return values
}
