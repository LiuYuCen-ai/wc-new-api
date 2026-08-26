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
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  ArrowDownToLine,
  Braces,
  Eye,
  GripHorizontal,
  ImageIcon,
  Maximize2,
  Type,
  Upload,
  WandSparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { getStudioGroups, getStudioModels, type StudioGroup } from '../api'
import { imageParamSpec } from '../image-params'
import {
  WORKFLOW_NODE_DEFS,
  type NodePort,
  type NodeCategory,
  type NodeWidget,
  type PortType,
  type WorkflowNodeKind,
} from './node-defs'

/** Cached lookups shared by every node instance (fetched at most once). */
const modelsByGroup = new Map<string, Promise<string[]>>()
function loadUserModels(group: string): Promise<string[]> {
  const key = group || ''
  let cached = modelsByGroup.get(key)
  if (!cached) {
    cached = getStudioModels(key).catch(() => [])
    modelsByGroup.set(key, cached)
  }
  return cached
}

let groupsPromise: Promise<StudioGroup[]> | null = null
function loadUserGroups(): Promise<StudioGroup[]> {
  if (!groupsPromise) {
    groupsPromise = getStudioGroups().catch(() => [])
  }
  return groupsPromise
}

function useUserModels(group: string, enabled: boolean): string[] {
  const [models, setModels] = useState<string[]>([])
  useEffect(() => {
    if (!enabled) {
      setModels([])
      return
    }
    let active = true
    void loadUserModels(group).then((list) => {
      if (active) setModels(list)
    })
    return () => {
      active = false
    }
  }, [group, enabled])
  return models
}

function useUserGroups(enabled: boolean): StudioGroup[] {
  const [groups, setGroups] = useState<StudioGroup[]>([])
  useEffect(() => {
    if (!enabled) return
    let active = true
    void loadUserGroups().then((list) => {
      if (active) setGroups(list)
    })
    return () => {
      active = false
    }
  }, [enabled])
  return groups
}

export type WorkflowNodeData = {
  kind: WorkflowNodeKind
  values: Record<string, string | number | boolean>
  /** Called when an inline widget value changes. */
  onChange?: (
    nodeId: string,
    key: string,
    value: string | number | boolean
  ) => void
}

/** ComfyUI-style socket colors keyed by port data type. */
const PORT_COLOR: Record<PortType, string> = {
  IMAGE: '#78aee3',
  VIDEO: '#bf8ac8',
  STRING: '#aa9ade',
}

function NodeCategoryGlyph({ category }: { category: NodeCategory }) {
  if (category === 'Loaders') return <ArrowDownToLine aria-hidden='true' />
  if (category === 'Primitives') return <Braces aria-hidden='true' />
  if (category === 'Image') return <ImageIcon aria-hidden='true' />
  if (category === 'Text') return <Type aria-hidden='true' />
  if (category === 'Output') return <Eye aria-hidden='true' />
  return <WandSparkles aria-hidden='true' />
}

function PortRow({
  port,
  side,
  nodeType,
}: {
  port: NodePort
  side: 'target' | 'source'
  nodeType: 'target' | 'source'
}) {
  const { t } = useTranslation()
  const isLeft = side === 'target'
  return (
    <div
      className={cn(
        'workflow-port-row relative flex h-7 items-center gap-1.5 text-[11px]',
        isLeft ? 'justify-start' : 'justify-end'
      )}
    >
      <Handle
        id={port.id}
        type={nodeType}
        position={isLeft ? Position.Left : Position.Right}
        style={{
          top: '50%',
          ...(isLeft ? { left: -12 } : { right: -12 }),
          width: 11,
          height: 11,
          background: PORT_COLOR[port.type],
          border: '2px solid rgba(255,255,255,0.95)',
          boxShadow: `0 0 0 1px ${PORT_COLOR[port.type]}66, 0 2px 7px ${PORT_COLOR[port.type]}42`,
        }}
      />
      <span className='workflow-port-label'>{t(port.label)}</span>
    </div>
  )
}

function downloadMedia(src: string, ext: string) {
  const a = document.createElement('a')
  a.href = src
  a.download = `output.${ext}`
  a.click()
}

function PreviewMedia({ value }: { value: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  if (!value) {
    return (
      <>
        <ImageIcon className='size-5' />
        <span>{t('Output preview')}</span>
      </>
    )
  }

  const isVideo =
    value.startsWith('data:video') || /\.(mp4|webm|mov)(\?|$)/i.test(value)

  if (isVideo) {
    return (
      <div className='relative h-full w-full'>
        <video src={value} controls className='h-full w-full object-contain' />
        <button
          type='button'
          title={t('Download')}
          className='nodrag absolute right-1 bottom-1 flex size-6 cursor-pointer items-center justify-center rounded bg-black/40 text-white hover:bg-black/70'
          onClick={() => downloadMedia(value, 'mp4')}
        >
          <ArrowDownToLine className='size-3.5' />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className='relative h-full w-full'>
        <img
          src={value}
          alt=''
          className='h-full w-full cursor-zoom-in object-contain'
          onClick={() => setOpen(true)}
        />
        <div className='nodrag absolute right-1 bottom-1 flex gap-1'>
          <button
            type='button'
            title={t('Zoom in')}
            className='flex size-6 cursor-pointer items-center justify-center rounded bg-black/40 text-white hover:bg-black/70'
            onClick={() => setOpen(true)}
          >
            <Maximize2 className='size-3.5' />
          </button>
          <button
            type='button'
            title={t('Download')}
            className='flex size-6 cursor-pointer items-center justify-center rounded bg-black/40 text-white hover:bg-black/70'
            onClick={() => downloadMedia(value, 'png')}
          >
            <ArrowDownToLine className='size-3.5' />
          </button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className='flex max-h-[90vh] max-w-[90vw] items-center justify-center bg-black/90 p-2'
        >
          <img
            src={value}
            alt=''
            className='max-h-[85vh] max-w-[85vw] object-contain'
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Shared styled dropdown built on the Base UI Select. Unlike a native
 * <select>, both the trigger and the popup list are fully themed, giving every
 * node dropdown a consistent, compact appearance.
 */
function StyledSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (next: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(String(next ?? ''))}
    >
      <SelectTrigger
        size='sm'
        className='workflow-field workflow-select nodrag h-8 w-full min-w-0 truncate text-xs'
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        className='z-[9999] max-h-72 min-w-[160px] text-xs'
        side='bottom'
        sideOffset={4}
        align='start'
        alignItemWithTrigger={false}
      >
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className='text-xs'>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Model group picker (分组), mirroring the playground group selector. */
function GroupSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const { t } = useTranslation()
  const groups = useUserGroups(true)
  const options = groups.map((g) => ({
    value: g.value,
    label: g.desc ? `${g.label} · ${g.desc}` : g.label,
  }))
  return (
    <StyledSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={t('Select a group')}
    />
  )
}

/** Model picker populated from the models available in the selected group. */
function ModelSelect({
  group,
  value,
  onChange,
}: {
  group: string
  value: string
  onChange: (next: string) => void
}) {
  const { t } = useTranslation()
  const models = useUserModels(group, true)
  // Clear a stale selection when the chosen group no longer offers this model.
  useEffect(() => {
    if (value && models.length > 0 && !models.includes(value)) {
      onChange('')
    }
  }, [models, value, onChange])
  return (
    <StyledSelect
      value={value}
      onChange={onChange}
      options={models.map((m) => ({ value: m, label: m }))}
      placeholder={t('Select a model')}
    />
  )
}

/**
 * Model-aware image parameters. Depending on the selected model, this renders:
 * - gpt-image-2: a single pixel-size dropdown (with ratio hints);
 * - Gemini image models: an image-size tier dropdown + an aspect-ratio dropdown;
 * - any other model: a generic size dropdown.
 * The chosen values are written to sibling keys `size` / `imageSize` /
 * `aspect_ratio` so the runner can forward them upstream.
 */
function ImageParams({
  nodeId,
  model,
  values,
  onChange,
}: {
  nodeId: string
  model: string
  values: Record<string, string | number | boolean>
  onChange?: WorkflowNodeData['onChange']
}) {
  const { t } = useTranslation()
  const spec = imageParamSpec(model)
  const commit = (key: string, next: string) => onChange?.(nodeId, key, next)

  // Keep the stored selections valid for the current model's option set.
  useEffect(() => {
    if (spec.mode === 'gemini') {
      const sizes = spec.imageSizeOptions.map((o) => o.value)
      const ratios = spec.aspectRatioOptions.map((o) => o.value)
      if (sizes.length && !sizes.includes(String(values.imageSize ?? ''))) {
        commit('imageSize', sizes.includes('1K') ? '1K' : sizes[0])
      }
      if (
        ratios.length &&
        !ratios.includes(String(values.aspect_ratio ?? ''))
      ) {
        commit('aspect_ratio', ratios[0])
      }
    } else {
      const sizes = spec.sizeOptions.map((o) => o.value)
      if (sizes.length && !sizes.includes(String(values.size ?? ''))) {
        commit('size', sizes[0])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.mode, model])

  if (spec.mode === 'gemini') {
    return (
      <div className='flex flex-col gap-2.5'>
        <label className='flex flex-col gap-1'>
          <span className={LABEL_CLASS}>{t('Image Size')}</span>
          <StyledSelect
            value={String(values.imageSize ?? '1K')}
            onChange={(next) => commit('imageSize', next)}
            options={spec.imageSizeOptions}
          />
        </label>
        <label className='flex flex-col gap-1'>
          <span className={LABEL_CLASS}>{t('Aspect Ratio')}</span>
          <StyledSelect
            value={String(values.aspect_ratio ?? '')}
            onChange={(next) => commit('aspect_ratio', next)}
            options={spec.aspectRatioOptions}
            placeholder={t('Aspect Ratio')}
          />
        </label>
      </div>
    )
  }

  return (
    <label className='flex flex-col gap-1'>
      <span className={LABEL_CLASS}>{t('Size')}</span>
      <StyledSelect
        value={String(values.size ?? 'auto')}
        onChange={(next) => commit('size', next)}
        options={spec.sizeOptions.map((o) => ({
          value: o.value,
          label: t(o.label),
        }))}
      />
    </label>
  )
}

const LABEL_CLASS =
  'workflow-field-label text-[10px] font-medium tracking-wide uppercase'

function Widget({
  nodeId,
  widget,
  value,
  nodeValues,
  onChange,
}: {
  nodeId: string
  widget: NodeWidget
  value: string | number | boolean
  nodeValues: Record<string, string | number | boolean>
  onChange?: WorkflowNodeData['onChange']
}) {
  const { t } = useTranslation()
  const commit = (next: string | number | boolean) =>
    onChange?.(nodeId, widget.key, next)

  // Model-aware image params render their own labelled sub-controls.
  if (widget.kind === 'image-params') {
    const isCustom = String(nodeValues.source ?? 'default') === 'custom'
    const model = isCustom
      ? String(nodeValues.custom_model ?? '')
      : String(nodeValues.model ?? '')
    return (
      <ImageParams
        nodeId={nodeId}
        model={model}
        values={nodeValues}
        onChange={onChange}
      />
    )
  }

  return (
    <label className='workflow-widget flex flex-col gap-1.5'>
      <span className='workflow-field-label text-[10px] font-medium tracking-wide uppercase'>
        {t(widget.label)}
      </span>
      {widget.kind === 'textarea' && (
        <textarea
          className='workflow-field nodrag min-h-[64px] resize-y px-2.5 py-2 text-xs outline-none'
          value={String(value ?? '')}
          placeholder={widget.placeholder ? t(widget.placeholder) : undefined}
          onChange={(e) => commit(e.target.value)}
        />
      )}
      {widget.kind === 'text' && (
        <input
          className='workflow-field nodrag h-8 px-2.5 text-xs outline-none'
          value={String(value ?? '')}
          placeholder={widget.placeholder ? t(widget.placeholder) : undefined}
          onChange={(e) => commit(e.target.value)}
        />
      )}
      {widget.kind === 'number' && (
        <input
          type='number'
          className='workflow-field nodrag h-8 px-2.5 text-xs outline-none'
          value={Number(value ?? 0)}
          min={widget.min}
          max={widget.max}
          step={widget.step}
          onChange={(e) => commit(Number(e.target.value))}
        />
      )}
      {widget.kind === 'select' && (
        <StyledSelect
          value={String(value ?? '')}
          onChange={commit}
          options={(widget.options ?? []).map((opt) => ({
            value: opt.value,
            label: t(opt.label),
          }))}
        />
      )}
      {widget.kind === 'group-select' && (
        <GroupSelect value={String(value ?? '')} onChange={commit} />
      )}
      {widget.kind === 'model-select' && (
        <ModelSelect
          group={String(nodeValues.group ?? '')}
          value={String(value ?? '')}
          onChange={commit}
        />
      )}
      {widget.kind === 'boolean' && (
        <div className='workflow-switch-row nodrag flex h-8 items-center'>
          <Switch
            checked={Boolean(value)}
            onCheckedChange={(checked) => commit(checked)}
          />
        </div>
      )}
      {widget.kind === 'upload' && (
        <label className='workflow-upload nodrag relative flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden text-[10px]'>
          {String(value ?? '') ? (
            <img
              src={String(value)}
              alt=''
              className='absolute inset-0 h-full w-full object-cover'
            />
          ) : (
            <>
              <Upload className='size-4' />
              <span>{t('Click to upload')}</span>
            </>
          )}
          <input
            type='file'
            accept='image/*'
            className='hidden'
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.addEventListener('load', () =>
                commit(String(reader.result ?? ''))
              )
              reader.readAsDataURL(file)
            }}
          />
        </label>
      )}
      {widget.kind === 'preview-image' && (
        <div className='workflow-preview nodrag flex h-28 flex-col items-center justify-center gap-1.5 overflow-hidden text-[10px]'>
          <PreviewMedia value={String(value ?? '')} />
        </div>
      )}
      {widget.kind === 'preview-text' && (
        <div className='workflow-preview-text nodrag min-h-[58px] px-2.5 py-2 text-[11px] whitespace-pre-wrap'>
          {String(value ?? '') || t('Output preview')}
        </div>
      )}
    </label>
  )
}

/**
 * A single ComfyUI-style workflow node: header, left input ports, right output
 * ports, and an inline widget stack in the body.
 */
export function WorkflowNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nodeData = data as WorkflowNodeData
  const def = WORKFLOW_NODE_DEFS[nodeData.kind]

  return (
    <div
      style={{ '--node-accent': def.accent } as React.CSSProperties}
      className={cn('workflow-node w-[286px]', selected && 'is-selected')}
    >
      <span className='workflow-node-accent' aria-hidden='true' />
      <div className='workflow-node-header flex items-center justify-between gap-3 px-3.5 py-3'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <span className='workflow-node-icon'>
            <NodeCategoryGlyph category={def.category} />
          </span>
          <div className='min-w-0'>
            <p className='workflow-node-title truncate text-[13px] font-semibold'>
              {t(def.title)}
            </p>
            <p className='workflow-node-category truncate text-[9px] font-medium uppercase'>
              {t(def.category)}
            </p>
          </div>
        </div>
        <div className='workflow-node-grip' aria-hidden='true'>
          <span>{id.slice(-2).toUpperCase()}</span>
          <GripHorizontal className='size-3.5' />
        </div>
      </div>

      {/* Port rows: inputs on the left, outputs on the right. */}
      <div className='workflow-node-ports relative px-3.5 pt-2'>
        <div className='flex justify-between'>
          <div className='flex flex-col'>
            {def.inputs.map((port) => (
              <PortRow
                key={port.id}
                port={port}
                side='target'
                nodeType='target'
              />
            ))}
          </div>
          <div className='flex flex-col'>
            {def.outputs.map((port) => (
              <PortRow
                key={port.id}
                port={port}
                side='source'
                nodeType='source'
              />
            ))}
          </div>
        </div>
      </div>

      <div className='workflow-node-widgets flex flex-col gap-3 px-3.5 pt-1.5 pb-3.5'>
        {def.widgets
          .filter(
            (widget) =>
              !widget.showWhen ||
              String(nodeData.values[widget.showWhen.key] ?? '') ===
                widget.showWhen.equals
          )
          .map((widget) => (
            <Widget
              key={widget.key}
              nodeId={id}
              widget={widget}
              value={nodeData.values[widget.key]}
              nodeValues={nodeData.values}
              onChange={nodeData.onChange}
            />
          ))}
      </div>
    </div>
  )
}
