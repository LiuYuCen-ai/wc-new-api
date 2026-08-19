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
 * Workflow execution engine for the ComfyUI-style Studio canvas.
 *
 * Nodes are executed in topological order following the edges. Each node reads
 * its resolved input values (from upstream node outputs) plus its inline widget
 * values, calls the matching backend, and writes its output values so that
 * downstream nodes can consume them.
 *
 * Function nodes mirror the reference `ModeHub_nanobanana` ComfyUI pack:
 *  - gemini-image     -> Gemini image generation (site relay images API)
 *  - image-to-prompt  -> Gemini vision describe (node base_url/api_key, OpenAI compatible)
 *  - sora-video       -> Sora text/image to video (node base_url/api_key, /v1/videos async)
 */

import {
  describeStudioImage,
  editStudioImage,
  generateStudioImage,
  generateStudioVideo,
  studioImageToSrc,
} from '../api'
import type { WorkflowNodeKind } from './node-defs'

/** A serialized node the runner understands (decoupled from ReactFlow types). */
export type RunNode = {
  id: string
  kind: WorkflowNodeKind
  values: Record<string, string | number | boolean>
}

/** A serialized connection: fromNode.fromPort -> toNode.toPort. */
export type RunEdge = {
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

/** Per-port produced value, keyed by `${nodeId}:${portId}`. */
type PortValues = Map<string, string>

/** Reported back to the UI as each node finishes. */
export type NodeRunResult = {
  nodeId: string
  /** Preview payload written to the node body (image data-url / text). */
  preview?: string
  error?: string
}

export type RunProgress = (nodeId: string, status: 'running' | 'done' | 'error') => void

const portKey = (nodeId: string, portId: string) => `${nodeId}:${portId}`

/** Kahn topological sort; throws on cycles. */
function topoSort(nodes: RunNode[], edges: RunEdge[]): RunNode[] {
  const indegree = new Map<string, number>()
  const byId = new Map<string, RunNode>()
  for (const n of nodes) {
    indegree.set(n.id, 0)
    byId.set(n.id, n)
  }
  for (const e of edges) {
    if (byId.has(e.target)) {
      indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1)
    }
  }
  const queue = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0)
  const ordered: RunNode[] = []
  while (queue.length > 0) {
    const node = queue.shift() as RunNode
    ordered.push(node)
    for (const e of edges) {
      if (e.source !== node.id) continue
      const next = indegree.get(e.target)
      if (next === undefined) continue
      const dec = next - 1
      indegree.set(e.target, dec)
      if (dec === 0) {
        const target = byId.get(e.target)
        if (target) queue.push(target)
      }
    }
  }
  if (ordered.length !== nodes.length) {
    throw new Error('workflow-has-cycle')
  }
  return ordered
}

/** Resolve the value feeding a given input port, or undefined if unconnected. */
function resolveInput(
  nodeId: string,
  portId: string,
  edges: RunEdge[],
  ports: PortValues
): string | undefined {
  const edge = edges.find((e) => e.target === nodeId && e.targetHandle === portId)
  if (!edge) return undefined
  return ports.get(portKey(edge.source, edge.sourceHandle))
}

const str = (v: unknown): string =>
  v === undefined || v === null ? '' : String(v)

/** Pick the effective model name honoring the ComfyUI "Custom Input" convention. */
function effectiveModel(
  values: Record<string, string | number | boolean>,
  fallback: string
): string {
  const selected = str(values.model_name)
  if (selected === 'custom') {
    const custom = str(values.custom_model_name).trim()
    return custom || fallback
  }
  return selected || fallback
}

async function runGeminiImage(
  values: Record<string, string | number | boolean>
): Promise<string> {
  const prompt = str(values.prompt).trim()
  if (!prompt) throw new Error('prompt-required')
  const model = effectiveModel(values, 'gemini-3-pro-image-preview')
  const sizeMap: Record<string, string> = {
    '1K': '1024x1024',
    '2K': '2048x2048',
    '4K': '4096x4096',
  }
  const size = sizeMap[str(values.imageSize)] ?? '1024x1024'
  const images = await generateStudioImage({ model, prompt, size })
  return studioImageToSrc(images[0])
}

async function runImageToPrompt(
  values: Record<string, string | number | boolean>,
  refImage: string | undefined
): Promise<string> {
  const baseUrl = str(values.base_url).trim().replace(/\/$/, '')
  const apiKey = str(values.api_key).trim()
  if (!apiKey) throw new Error('api-key-required')
  const model = effectiveModel(values, 'gemini-2.5-flash')
  const role = str(values.role) || 'You are a helpful assistant'
  const instruction = str(values.prompt) || 'describe the image'
  const temperature = Number(values.temperature ?? 0.6)

  const content: Record<string, unknown>[] = [{ type: 'text', text: instruction }]
  if (refImage) {
    content.push({ type: 'image_url', image_url: { url: refImage } })
  }
  const body = {
    model,
    messages: [
      { role: 'system', content: role },
      { role: 'user', content },
    ],
    temperature,
    max_tokens: 2048,
  }
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`http-${res.status}`)
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return data.choices?.[0]?.message?.content ?? ''
}

async function runSoraVideo(
  values: Record<string, string | number | boolean>
): Promise<string> {
  const baseUrl = str(values.base_url).trim().replace(/\/$/, '')
  const apiKey = str(values.api_key).trim()
  if (!apiKey) throw new Error('api-key-required')
  const prompt = str(values.prompt).trim()
  if (!prompt) throw new Error('prompt-required')
  const model = effectiveModel(values, 'sora-2')

  const form = new FormData()
  form.append('model', model)
  form.append('prompt', prompt)
  form.append('size', str(values.size) || '720x1280')
  form.append('seconds', str(values.seconds) || '10')
  form.append('watermark', String(Boolean(values.watermark)))
  form.append('private', String(Boolean(values.private)))
  const seed = Number(values.seed ?? -1)
  if (seed >= 0) form.append('seed', String(seed))

  const submit = await fetch(`${baseUrl}/v1/videos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!submit.ok) throw new Error(`http-${submit.status}`)
  const submitData = (await submit.json()) as Record<string, unknown>
  const directUrl =
    (submitData.video_url as string) || (submitData.url as string) || ''
  if (directUrl) return directUrl
  const taskId =
    (submitData.id as string) ||
    (submitData.task_id as string) ||
    ((submitData.data as Record<string, unknown>)?.id as string)
  if (!taskId) throw new Error('no-task-id')

  // Poll task status until completed (bounded).
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise((r) => setTimeout(r, 10000))
    const status = await fetch(`${baseUrl}/v1/videos/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })
    if (!status.ok) continue
    const statusData = (await status.json()) as Record<string, unknown>
    const state = str(statusData.status)
    if (state === 'completed') {
      const url =
        (statusData.video_url as string) ||
        (statusData.url as string) ||
        `${baseUrl}/v1/videos/${taskId}/content`
      return url
    }
    if (state === 'failed' || state === 'error') {
      throw new Error('task-failed')
    }
  }
  throw new Error('task-timeout')
}

/* -------------------------------------------------------------------------- */
/* Generic generation nodes (model-agnostic)                                  */
/* -------------------------------------------------------------------------- */

/** True when the node runs in "default" mode (site relay, session auth). */
function isDefaultSource(
  values: Record<string, string | number | boolean>
): boolean {
  return str(values.source || 'default') !== 'custom'
}

/** The effective model name: `model` (relay picker) in default, else `custom_model`. */
function providerModel(
  values: Record<string, string | number | boolean>
): string {
  return isDefaultSource(values)
    ? str(values.model).trim()
    : str(values.custom_model).trim()
}

/** The selected model group (分组) for default (relay) mode; empty otherwise. */
function providerGroup(
  values: Record<string, string | number | boolean>
): string {
  return isDefaultSource(values) ? str(values.group).trim() : ''
}

async function runGenerateImage(
  values: Record<string, string | number | boolean>,
  prompt: string
): Promise<string> {
  const model = providerModel(values)
  if (!model) throw new Error('model-required')
  const finalPrompt = prompt.trim()
  if (!finalPrompt) throw new Error('prompt-required')
  const size = str(values.size) || 'auto'

  if (isDefaultSource(values)) {
    const images = await generateStudioImage({
      model,
      prompt: finalPrompt,
      size,
      aspectRatio: str(values.aspect_ratio) || undefined,
      imageSize: str(values.imageSize) || undefined,
      group: providerGroup(values),
    })
    return studioImageToSrc(images[0])
  }

  const baseUrl = str(values.base_url).trim().replace(/\/$/, '')
  const apiKey = str(values.api_key).trim()
  if (!apiKey) throw new Error('api-key-required')
  const body: Record<string, unknown> = {
    model,
    prompt: finalPrompt,
    n: 1,
    response_format: 'b64_json',
  }
  if (size !== 'auto') body.size = size
  const res = await fetch(`${baseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`http-${res.status}`)
  return firstImageFromOpenAIResponse(await res.json())
}

async function runEditImage(
  values: Record<string, string | number | boolean>,
  refs: string[],
  prompt: string
): Promise<string> {
  const model = providerModel(values)
  if (!model) throw new Error('model-required')
  const finalPrompt = prompt.trim()
  if (!finalPrompt) throw new Error('prompt-required')
  if (refs.length === 0) throw new Error('image-required')
  const size = str(values.size) || 'auto'

  if (isDefaultSource(values)) {
    const images = await editStudioImage({
      model,
      prompt: finalPrompt,
      images: refs,
      size,
      aspectRatio: str(values.aspect_ratio) || undefined,
      imageSize: str(values.imageSize) || undefined,
      group: providerGroup(values),
    })
    return studioImageToSrc(images[0])
  }

  const baseUrl = str(values.base_url).trim().replace(/\/$/, '')
  const apiKey = str(values.api_key).trim()
  if (!apiKey) throw new Error('api-key-required')
  const body: Record<string, unknown> = {
    model,
    prompt: finalPrompt,
    n: 1,
    response_format: 'b64_json',
    image: refs.length === 1 ? refs[0] : refs,
  }
  if (size !== 'auto') body.size = size
  const res = await fetch(`${baseUrl}/v1/images/edits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`http-${res.status}`)
  return firstImageFromOpenAIResponse(await res.json())
}

/** Extract the first image (data-url) from an OpenAI-style images response. */
function firstImageFromOpenAIResponse(data: unknown): string {
  const list = (data as { data?: unknown[] })?.data ?? []
  const first = Array.isArray(list) ? list[0] : undefined
  const item = first as { b64_json?: string; url?: string } | undefined
  if (item?.url) return item.url
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`
  throw new Error('empty-image-result')
}

async function runDescribeImage(
  values: Record<string, string | number | boolean>,
  refImage: string | undefined
): Promise<string> {
  const model = providerModel(values) || 'gpt-4o'
  const instruction = str(values.prompt) || 'Describe this image in detail.'
  const temperature = Number(values.temperature ?? 0.6)

  if (isDefaultSource(values)) {
    return describeStudioImage({
      model,
      prompt: instruction,
      image: refImage,
      temperature,
      group: providerGroup(values),
    })
  }

  const baseUrl = str(values.base_url).trim().replace(/\/$/, '')
  const apiKey = str(values.api_key).trim()
  if (!apiKey) throw new Error('api-key-required')
  const content: Record<string, unknown>[] = [{ type: 'text', text: instruction }]
  if (refImage) {
    content.push({ type: 'image_url', image_url: { url: refImage } })
  }
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      temperature,
      max_tokens: 2048,
    }),
  })
  if (!res.ok) throw new Error(`http-${res.status}`)
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return data.choices?.[0]?.message?.content ?? ''
}

async function runGenerateVideo(
  values: Record<string, string | number | boolean>,
  prompt: string,
  refImage: string | undefined
): Promise<string> {
  const model = providerModel(values)
  if (!model) throw new Error('model-required')
  const finalPrompt = prompt.trim()
  if (!finalPrompt) throw new Error('prompt-required')
  const size = str(values.size) || '720x1280'
  const seconds = str(values.seconds) || '10'

  if (isDefaultSource(values)) {
    return generateStudioVideo({
      model,
      prompt: finalPrompt,
      size,
      seconds,
      image: refImage,
      group: providerGroup(values),
    })
  }

  const baseUrl = str(values.base_url).trim().replace(/\/$/, '')
  const apiKey = str(values.api_key).trim()
  if (!apiKey) throw new Error('api-key-required')

  const form = new FormData()
  form.append('model', model)
  form.append('prompt', finalPrompt)
  form.append('size', size)
  form.append('seconds', seconds)
  if (refImage) form.append('input_reference', refImage)

  const submit = await fetch(`${baseUrl}/v1/videos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!submit.ok) throw new Error(`http-${submit.status}`)
  const submitData = (await submit.json()) as Record<string, unknown>
  const directUrl =
    (submitData.video_url as string) || (submitData.url as string) || ''
  if (directUrl) return directUrl
  const taskId =
    (submitData.id as string) ||
    (submitData.task_id as string) ||
    ((submitData.data as Record<string, unknown>)?.id as string)
  if (!taskId) throw new Error('no-task-id')

  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise((r) => setTimeout(r, 10000))
    const status = await fetch(`${baseUrl}/v1/videos/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })
    if (!status.ok) continue
    const statusData = (await status.json()) as Record<string, unknown>
    const state = str(statusData.status)
    if (state === 'completed') {
      return (
        (statusData.video_url as string) ||
        (statusData.url as string) ||
        `${baseUrl}/v1/videos/${taskId}/content`
      )
    }
    if (state === 'failed' || state === 'error') {
      throw new Error('task-failed')
    }
  }
  throw new Error('task-timeout')
}

/* -------------------------------------------------------------------------- */
/* In-browser canvas image processing helpers                                 */
/* -------------------------------------------------------------------------- */

/** Decode a data-url / URL string into an HTMLImageElement. */
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', () => reject(new Error('image-load-failed')))
    img.src = src
  })
}

/** Create a 2D canvas context of the given size. */
function makeCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
} {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas-unsupported')
  return { canvas, ctx }
}

async function runResizeImage(
  values: Record<string, string | number | boolean>,
  src: string
): Promise<string> {
  if (!src) throw new Error('image-required')
  const img = await loadImageElement(src)
  const width = Number(values.width ?? img.width)
  let height = Number(values.height ?? img.height)
  if (values.keep_ratio) {
    const ratio = img.width / img.height
    height = Math.round(width / ratio)
  }
  const { canvas, ctx } = makeCanvas(width, height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

async function runCropImage(
  values: Record<string, string | number | boolean>,
  src: string
): Promise<string> {
  if (!src) throw new Error('image-required')
  const img = await loadImageElement(src)
  const x = Math.max(0, Number(values.x ?? 0))
  const y = Math.max(0, Number(values.y ?? 0))
  const width = Math.max(1, Number(values.width ?? img.width))
  const height = Math.max(1, Number(values.height ?? img.height))
  const { canvas, ctx } = makeCanvas(width, height)
  ctx.drawImage(img, x, y, width, height, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

async function runInvertImage(src: string): Promise<string> {
  if (!src) throw new Error('image-required')
  const img = await loadImageElement(src)
  const { canvas, ctx } = makeCanvas(img.width, img.height)
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    px[i] = 255 - px[i]
    px[i + 1] = 255 - px[i + 1]
    px[i + 2] = 255 - px[i + 2]
  }
  ctx.putImageData(data, 0, 0)
  return canvas.toDataURL('image/png')
}

async function runFlipImage(
  values: Record<string, string | number | boolean>,
  src: string
): Promise<string> {
  if (!src) throw new Error('image-required')
  const img = await loadImageElement(src)
  const horizontal = str(values.direction) !== 'vertical'
  const { canvas, ctx } = makeCanvas(img.width, img.height)
  ctx.translate(horizontal ? canvas.width : 0, horizontal ? 0 : canvas.height)
  ctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1)
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/png')
}

async function runBlendImage(
  values: Record<string, string | number | boolean>,
  src1: string,
  src2: string
): Promise<string> {
  if (!src1 || !src2) throw new Error('image-required')
  const [img1, img2] = await Promise.all([
    loadImageElement(src1),
    loadImageElement(src2),
  ])
  const { canvas, ctx } = makeCanvas(img1.width, img1.height)
  ctx.drawImage(img1, 0, 0)
  const opacity = Math.min(1, Math.max(0, Number(values.opacity ?? 0.5)))
  ctx.globalAlpha = opacity
  ctx.drawImage(img2, 0, 0, canvas.width, canvas.height)
  ctx.globalAlpha = 1
  return canvas.toDataURL('image/png')
}

/**
 * Split nodes into independent chains (connected sub-graphs, treating edges as
 * undirected) and execute every chain in parallel. Each chain runs its own
 * nodes serially in topological order. A failure in one chain does not cancel
 * the others; the first error is surfaced after all chains settle.
 */
export async function runWorkflow(
  nodes: RunNode[],
  edges: RunEdge[],
  onProgress: RunProgress
): Promise<NodeRunResult[]> {
  const chains = splitIntoChains(nodes, edges)
  const settled = await Promise.all(
    chains.map((chain) => runChain(chain.nodes, chain.edges, onProgress))
  )

  const results: NodeRunResult[] = []
  let firstError: string | undefined
  for (const chain of settled) {
    results.push(...chain.results)
    if (!firstError && chain.error) firstError = chain.error
  }
  if (firstError) throw new Error(firstError)
  return results
}

/** A single connected sub-graph with its own node/edge subset. */
type Chain = { nodes: RunNode[]; edges: RunEdge[] }

/** Group nodes into connected components (edges treated as undirected). */
function splitIntoChains(nodes: RunNode[], edges: RunEdge[]): Chain[] {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let root = x
    while (parent.get(root) !== root) root = parent.get(root) as string
    let cur = x
    while (cur !== root) {
      const next = parent.get(cur) as string
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const n of nodes) parent.set(n.id, n.id)
  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const e of edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) union(e.source, e.target)
  }

  const groups = new Map<string, Chain>()
  for (const n of nodes) {
    const root = find(n.id)
    let chain = groups.get(root)
    if (!chain) {
      chain = { nodes: [], edges: [] }
      groups.set(root, chain)
    }
    chain.nodes.push(n)
  }
  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue
    groups.get(find(e.source))?.edges.push(e)
  }
  return [...groups.values()]
}

/** Result of running a single chain (never throws; records the first error). */
type ChainRun = { results: NodeRunResult[]; error?: string }

/**
 * Execute one chain: its nodes serially in topological order. Calls
 * `onProgress` around each node and returns the per-node results.
 */
async function runChain(
  nodes: RunNode[],
  edges: RunEdge[],
  onProgress: RunProgress
): Promise<ChainRun> {
  const ordered = topoSort(nodes, edges)
  const ports: PortValues = new Map()
  const results: NodeRunResult[] = []

  for (const node of ordered) {
    onProgress(node.id, 'running')
    try {
      switch (node.kind) {
        case 'start':
        case 'end': {
          // Boundary markers only. Forward any upstream data port value so
          // nodes downstream of a Start (or upstream of an End) can still
          // read their data through it.
          for (const portId of ['text', 'image', 'video']) {
            const upstream = resolveInput(node.id, portId, edges, ports)
            if (upstream !== undefined) {
              ports.set(portKey(node.id, portId), upstream)
            }
          }
          break
        }
        case 'load-image': {
          const upstream = resolveInput(node.id, 'image', edges, ports)
          ports.set(portKey(node.id, 'image'), upstream ?? str(node.values.image))
          break
        }
        case 'text-input': {
          const upstream = resolveInput(node.id, 'text', edges, ports)
          ports.set(portKey(node.id, 'text'), upstream ?? str(node.values.text))
          break
        }
        case 'load-video': {
          const upstream = resolveInput(node.id, 'video', edges, ports)
          ports.set(portKey(node.id, 'video'), upstream ?? str(node.values.video))
          break
        }
        case 'primitive-int': {
          const upstream = resolveInput(node.id, 'value', edges, ports)
          const n = Math.trunc(Number(upstream ?? node.values.value ?? 0))
          ports.set(portKey(node.id, 'value'), String(n))
          break
        }
        case 'primitive-float': {
          const upstream = resolveInput(node.id, 'value', edges, ports)
          ports.set(portKey(node.id, 'value'), String(Number(upstream ?? node.values.value ?? 0)))
          break
        }
        case 'primitive-boolean': {
          const upstream = resolveInput(node.id, 'value', edges, ports)
          ports.set(portKey(node.id, 'value'), String(Boolean(upstream ?? node.values.value)))
          break
        }
        case 'gemini-image': {
          const src = await runGeminiImage(node.values)
          ports.set(portKey(node.id, 'image'), src)
          ports.set(portKey(node.id, 'api_respond'), 'ok')
          break
        }
        case 'image-to-prompt': {
          const refImage = resolveInput(node.id, 'ref_image', edges, ports)
          const prompt = await runImageToPrompt(node.values, refImage)
          ports.set(portKey(node.id, 'prompt'), prompt)
          ports.set(portKey(node.id, 'api_respond'), prompt)
          break
        }
        case 'sora-video': {
          const url = await runSoraVideo(node.values)
          ports.set(portKey(node.id, 'video'), url)
          ports.set(portKey(node.id, 'api_respond'), 'ok')
          break
        }
        case 'generate-image': {
          const prompt = resolveInput(node.id, 'prompt', edges, ports) ?? ''
          ports.set(
            portKey(node.id, 'image'),
            await runGenerateImage(node.values, prompt)
          )
          break
        }
        case 'edit-image': {
          const prompt = resolveInput(node.id, 'prompt', edges, ports) ?? ''
          const refs = [
            resolveInput(node.id, 'image1', edges, ports) ?? '',
            resolveInput(node.id, 'image2', edges, ports) ?? '',
          ].filter((s) => s.length > 0)
          ports.set(
            portKey(node.id, 'image'),
            await runEditImage(node.values, refs, prompt)
          )
          break
        }
        case 'describe-image': {
          const refImage = resolveInput(node.id, 'ref_image', edges, ports)
          ports.set(
            portKey(node.id, 'text'),
            await runDescribeImage(node.values, refImage)
          )
          break
        }
        case 'generate-video': {
          const prompt = resolveInput(node.id, 'prompt', edges, ports) ?? ''
          const refImage = resolveInput(node.id, 'input_reference', edges, ports)
          ports.set(
            portKey(node.id, 'video'),
            await runGenerateVideo(node.values, prompt, refImage)
          )
          break
        }
        case 'resize-image': {
          const src = resolveInput(node.id, 'image', edges, ports) ?? ''
          ports.set(portKey(node.id, 'image'), await runResizeImage(node.values, src))
          break
        }
        case 'crop-image': {
          const src = resolveInput(node.id, 'image', edges, ports) ?? ''
          ports.set(portKey(node.id, 'image'), await runCropImage(node.values, src))
          break
        }
        case 'invert-image': {
          const src = resolveInput(node.id, 'image', edges, ports) ?? ''
          ports.set(portKey(node.id, 'image'), await runInvertImage(src))
          break
        }
        case 'flip-image': {
          const src = resolveInput(node.id, 'image', edges, ports) ?? ''
          ports.set(portKey(node.id, 'image'), await runFlipImage(node.values, src))
          break
        }
        case 'blend-image': {
          const src1 = resolveInput(node.id, 'image1', edges, ports) ?? ''
          const src2 = resolveInput(node.id, 'image2', edges, ports) ?? ''
          ports.set(portKey(node.id, 'image'), await runBlendImage(node.values, src1, src2))
          break
        }
        case 'concat-text': {
          const t1 = resolveInput(node.id, 'text1', edges, ports) ?? ''
          const t2 = resolveInput(node.id, 'text2', edges, ports) ?? ''
          ports.set(portKey(node.id, 'text'), `${t1}${str(node.values.separator)}${t2}`)
          break
        }
        case 'replace-text': {
          const text = resolveInput(node.id, 'text', edges, ports) ?? ''
          const find = str(node.values.find)
          const replaced = find
            ? text.split(find).join(str(node.values.replace))
            : text
          ports.set(portKey(node.id, 'text'), replaced)
          break
        }
        case 'preview-image': {
          const src = resolveInput(node.id, 'images', edges, ports) ?? ''
          results.push({ nodeId: node.id, preview: src })
          break
        }
        case 'preview-video': {
          const src = resolveInput(node.id, 'video', edges, ports) ?? ''
          results.push({ nodeId: node.id, preview: src })
          break
        }
        case 'show-text': {
          const text = resolveInput(node.id, 'text', edges, ports) ?? ''
          results.push({ nodeId: node.id, preview: text })
          break
        }
      }
      onProgress(node.id, 'done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'node-failed'
      results.push({ nodeId: node.id, error: message })
      onProgress(node.id, 'error')
      // Stop this chain, but let other parallel chains keep running.
      return { results, error: message }
    }
  }

  return { results }
}
