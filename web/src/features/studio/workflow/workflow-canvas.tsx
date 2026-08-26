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
 * ComfyUI-style workflow canvas for the Studio.
 *
 * Wraps ReactFlow with a ComfyUI-like look: dotted grid background, draggable
 * typed-socket nodes, an "add node" palette grouped by category, and a Run
 * button that executes the graph through `runWorkflow`.
 */
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnectEnd,
} from '@xyflow/react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Image as ImageIcon,
  Info,
  Loader2,
  PanelRightOpen,
  Play,
  Plus,
  Trash2,
  Workflow,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import '@xyflow/react/dist/style.css'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import {
  CATEGORY_ACCENT,
  NODE_CATEGORY_ORDER,
  WORKFLOW_NODE_DEFS,
  WORKFLOW_NODE_LIST,
  buildDefaultValues,
  type NodeCategory,
  type WorkflowNodeKind,
} from './node-defs'
import { WorkflowNode, type WorkflowNodeData } from './workflow-node'
import { runWorkflow, type RunEdge, type RunNode } from './workflow-runner'

type WorkflowRfNode = Node<WorkflowNodeData>

const nodeTypes: NodeTypes = { workflow: WorkflowNode }

let nodeSeq = 0
const nextNodeId = () =>
  `n${Date.now().toString(36)}${(nodeSeq++).toString(36)}`

type LogEntry =
  | { type: 'info' | 'success' | 'error'; time: number; message: string }
  | { type: 'image'; time: number; message: string; imageUrl: string }

const fmtTime = (ts: number) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

/** Seed graph: two parallel Text -> Generate Image -> Preview Image chains. */
function createInitialGraph(onChange: WorkflowNodeData['onChange']): {
  nodes: WorkflowRfNode[]
  edges: Edge[]
} {
  const isCompact = typeof window !== 'undefined' && window.innerWidth < 760

  const mk = (
    kind: WorkflowNodeKind,
    x: number,
    y: number,
    extra?: Record<string, string | number | boolean>
  ): WorkflowRfNode => ({
    id: nextNodeId(),
    type: 'workflow',
    position: { x, y },
    data: {
      kind,
      values: { ...buildDefaultValues(kind), ...extra },
      onChange,
    },
  })

  if (isCompact) {
    // Compact: single chain
    const t = mk('text-input', 40, 40)
    const g = mk('generate-image', 40, 330)
    const p = mk('preview-image', 40, 820, { preview: '/studio-demo-front.png' })
    return {
      nodes: [t, g, p],
      edges: [
        { id: `e-${t.id}-${g.id}`, source: t.id, sourceHandle: 'text', target: g.id, targetHandle: 'prompt', animated: true },
        { id: `e-${g.id}-${p.id}`, source: g.id, sourceHandle: 'image', target: p.id, targetHandle: 'images', animated: true },
      ],
    }
  }

  // Desktop: one start node fanning out into two parallel chains
  const s = mk('start', -260, 230)

  // Chain A — 正面图
  const tA = mk('text-input', 40, 80, { text: '一套白色背景的正面全身服装照' })
  const gA = mk('generate-image', 360, 40)
  const pA = mk('preview-image', 720, 80, { preview: '/studio-demo-front.png' })

  // Chain B — 侧面图
  const tB = mk('text-input', 40, 390, { text: '一套白色背景的侧面全身服装照' })
  const gB = mk('generate-image', 360, 350)
  const pB = mk('preview-image', 720, 390, { preview: '/studio-demo-side.png' })

  const edges: Edge[] = [
    { id: `e-${s.id}-${tA.id}`, source: s.id, sourceHandle: 'text', target: tA.id, targetHandle: 'text', animated: true },
    { id: `e-${s.id}-${tB.id}`, source: s.id, sourceHandle: 'text', target: tB.id, targetHandle: 'text', animated: true },
    { id: `e-${tA.id}-${gA.id}`, source: tA.id, sourceHandle: 'text', target: gA.id, targetHandle: 'prompt', animated: true },
    { id: `e-${gA.id}-${pA.id}`, source: gA.id, sourceHandle: 'image', target: pA.id, targetHandle: 'images', animated: true },
    { id: `e-${tB.id}-${gB.id}`, source: tB.id, sourceHandle: 'text', target: gB.id, targetHandle: 'prompt', animated: true },
    { id: `e-${gB.id}-${pB.id}`, source: gB.id, sourceHandle: 'image', target: pB.id, targetHandle: 'images', animated: true },
  ]

  return { nodes: [s, tA, gA, pA, tB, gB, pB], edges }
}

function CanvasInner() {
  const { t } = useTranslation()
  const { screenToFlowPosition } = useReactFlow()
  const wrapperRef = useRef<HTMLDivElement>(null)

  const [running, setRunning] = useState(false)
  const [runStatus, setRunStatus] = useState<
    Record<string, 'running' | 'done' | 'error'>
  >({})
  const [logOpen, setLogOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  // Quick-add menu (drop-connection on empty canvas)
  const [quickAdd, setQuickAdd] = useState<{
    x: number
    y: number
    flowPos: { x: number; y: number }
  } | null>(null)
  const pendingConnectionRef = useRef<{ source: string; sourceHandle: string | null } | null>(null)

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry])
  }, [])

  // Ref indirection so the node onChange closure always sees current setNodes.
  const setNodesRef = useRef<
    ReturnType<typeof useNodesState<WorkflowRfNode>>[1] | null
  >(null)

  const handleWidgetChange = useCallback<
    NonNullable<WorkflowNodeData['onChange']>
  >((nodeId, key, value) => {
    setNodesRef.current?.((prev) =>
      prev.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: { ...n.data, values: { ...n.data.values, [key]: value } },
            }
          : n
      )
    )
  }, [])

  const seedGraph = useMemo(
    () => createInitialGraph(handleWidgetChange),
    [handleWidgetChange]
  )
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowRfNode>(
    seedGraph.nodes
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(seedGraph.edges)
  setNodesRef.current = setNodes

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds))
    },
    [setEdges]
  )

  // Feature 2: drop connection on empty space -> show quick-add menu
  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      if (connectionState?.isValid) return
      const conn = connectionState?.fromHandle
        ? {
            source: connectionState.fromNode?.id ?? null,
            sourceHandle: connectionState.fromHandle?.id ?? null,
          }
        : null
      pendingConnectionRef.current = conn

      const clientX =
        'clientX' in event ? event.clientX : event.touches[0].clientX
      const clientY =
        'clientY' in event ? event.clientY : event.touches[0].clientY
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY })
      setQuickAdd({ x: clientX, y: clientY, flowPos })
    },
    [screenToFlowPosition]
  )

  const addNode = useCallback(
    (kind: WorkflowNodeKind, atFlowPos?: { x: number; y: number }) => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      const center = atFlowPos ?? (rect
        ? screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          })
        : { x: 200, y: 200 })
      const node: WorkflowRfNode = {
        id: nextNodeId(),
        type: 'workflow',
        position: { x: center.x - 128, y: center.y - 40 },
        data: {
          kind,
          values: buildDefaultValues(kind),
          onChange: handleWidgetChange,
        },
      }
      setNodes((prev) => [...prev, node])

      // Auto-connect if dropped from a handle
      const conn = pendingConnectionRef.current
      pendingConnectionRef.current = null
      if (conn?.source) {
        const def = WORKFLOW_NODE_DEFS[kind]
        const firstInput = def.inputs[0]
        if (firstInput) {
          setEdges((eds) =>
            addEdge(
              {
                source: conn.source!,
                sourceHandle: conn.sourceHandle ?? null,
                target: node.id,
                targetHandle: firstInput.id,
                animated: true,
              },
              eds
            )
          )
        }
      }
      setQuickAdd(null)
    },
    [handleWidgetChange, screenToFlowPosition, setEdges, setNodes]
  )

  const clearCanvas = useCallback(() => {
    setNodes([])
    setEdges([])
    setRunStatus({})
    setLogs([])
  }, [setEdges, setNodes])

  const writePreview = useCallback(
    (nodeId: string, key: string, value: string) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: { ...n.data, values: { ...n.data.values, [key]: value } },
              }
            : n
        )
      )
    },
    [setNodes]
  )

  const onRun = useCallback(async () => {
    if (running) return
    setRunning(true)
    setRunStatus({})
    setLogs([])
    setLogOpen(true)
    addLog({ type: 'info', time: Date.now(), message: t('Workflow started') })

    const runNodes: RunNode[] = nodes.map((n) => ({
      id: n.id,
      kind: n.data.kind,
      values: n.data.values,
    }))
    const runEdges: RunEdge[] = edges.map((e) => ({
      source: e.source,
      sourceHandle: e.sourceHandle ?? '',
      target: e.target,
      targetHandle: e.targetHandle ?? '',
    }))

    const nodeLabel = (id: string) => {
      const n = nodes.find((nd) => nd.id === id)
      return n ? t(WORKFLOW_NODE_DEFS[n.data.kind].title) : id
    }

    try {
      const results = await runWorkflow(runNodes, runEdges, (nodeId, status) => {
        setRunStatus((prev) => ({ ...prev, [nodeId]: status }))
        if (status === 'running') {
          addLog({ type: 'info', time: Date.now(), message: `▶ ${nodeLabel(nodeId)}` })
        } else if (status === 'done') {
          addLog({ type: 'success', time: Date.now(), message: `✓ ${nodeLabel(nodeId)}` })
        } else if (status === 'error') {
          addLog({ type: 'error', time: Date.now(), message: `✗ ${nodeLabel(nodeId)}` })
        }
      })
      for (const r of results) {
        if (r.error) {
          addLog({ type: 'error', time: Date.now(), message: `${nodeLabel(r.nodeId)}: ${r.error}` })
        }
        if (r.preview === undefined) continue
        const node = nodes.find((n) => n.id === r.nodeId)
        if (!node) continue
        const key = node.data.kind === 'show-text' ? 'text' : 'preview'
        writePreview(r.nodeId, key, r.preview)
        if (r.preview.startsWith('data:image') || r.preview.startsWith('/') || r.preview.startsWith('http')) {
          addLog({ type: 'image', time: Date.now(), message: nodeLabel(r.nodeId), imageUrl: r.preview })
        } else if (r.preview) {
          addLog({ type: 'success', time: Date.now(), message: `${nodeLabel(r.nodeId)}: ${r.preview.slice(0, 120)}` })
        }
      }
      addLog({ type: 'success', time: Date.now(), message: t('Workflow finished') })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addLog({ type: 'error', time: Date.now(), message: msg })
    } finally {
      setRunning(false)
    }
  }, [addLog, edges, nodes, running, t, writePreview])

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logOpen) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, logOpen])

  const groupedNodes = useMemo(() => {
    const groups = new Map<NodeCategory, typeof WORKFLOW_NODE_LIST>()
    for (const cat of NODE_CATEGORY_ORDER) groups.set(cat, [])
    for (const def of WORKFLOW_NODE_LIST) {
      groups.get(def.category)?.push(def)
    }
    return groups
  }, [])

  // Reflect run status as a subtle ring on each node.
  const displayNodes = useMemo(
    () =>
      nodes.map((n) => {
        const status = runStatus[n.id]
        return {
          ...n,
          className: cn(
            status === 'running' && 'workflow-node-running',
            status === 'done' && 'workflow-node-done',
            status === 'error' && 'workflow-node-error'
          ),
        }
      }),
    [nodes, runStatus]
  )

  const NodeMenu = (
    <div className='pointer-events-none'>
      {NODE_CATEGORY_ORDER.map((cat, idx) => {
        const defs = groupedNodes.get(cat) ?? []
        if (defs.length === 0) return null
        return (
          <div key={cat}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className='flex items-center gap-1.5'>
                <span
                  className='size-2 rounded-full'
                  style={{ background: CATEGORY_ACCENT[cat] }}
                />
                {t(cat)}
              </DropdownMenuLabel>
              {defs.map((def) => (
                <DropdownMenuItem
                  key={def.kind}
                  className='pointer-events-auto'
                  onSelect={() => addNode(def.kind)}
                >
                  {t(def.title)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </div>
        )
      })}
    </div>
  )

  return (
    <div ref={wrapperRef} className='workflow-canvas relative h-full w-full'>
      {/* Toolbar */}
      <div className='workflow-toolbar absolute top-4 left-5 z-10 flex items-center gap-1.5'>
        <div className='workflow-toolbar-context' aria-hidden='true'>
          <Workflow className='size-3.5' />
          <span>FLOW</span>
          <ChevronRight className='size-3 opacity-40' />
          <strong>{String(nodes.length).padStart(2, '0')}</strong>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size='sm'
                variant='secondary'
                className='workflow-add-button gap-1.5'
              />
            }
          >
            <Plus className='size-4' />
            {t('Add node')}
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-56'>
            {NODE_CATEGORY_ORDER.map((cat, idx) => {
              const defs = groupedNodes.get(cat) ?? []
              if (defs.length === 0) return null
              return (
                <div key={cat}>
                  {idx > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className='flex items-center gap-1.5'>
                      <span
                        className='size-2 rounded-full'
                        style={{ background: CATEGORY_ACCENT[cat] }}
                      />
                      {t(cat)}
                    </DropdownMenuLabel>
                    {defs.map((def) => (
                      <DropdownMenuItem
                        key={def.kind}
                        onSelect={() => addNode(def.kind)}
                      >
                        {t(def.title)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </div>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size='sm'
          variant='ghost'
          className='workflow-clear-button gap-1.5'
          onClick={clearCanvas}
          disabled={running}
        >
          <Trash2 className='size-4' />
          {t('Clear')}
        </Button>
      </div>

      {/* Run dock */}
      <div className='workflow-run-dock absolute top-4 right-5 z-10 flex items-center gap-2'>
        <button
          type='button'
          title={t('Logs')}
          onClick={() => setLogOpen((v) => !v)}
          className={cn(
            'workflow-log-toggle flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
            logOpen
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-transparent bg-white/70 text-slate-500 hover:bg-white hover:text-slate-700'
          )}
        >
          <PanelRightOpen className='size-3.5' />
          {t('Logs')}
          {logs.some((l) => l.type === 'error') && (
            <span className='size-1.5 rounded-full bg-red-500' />
          )}
        </button>
        <div className='workflow-run-meta'>
          <CircleDot className='size-3' aria-hidden='true' />
          <span>{edges.length} LINKS</span>
        </div>
        <Button
          size='sm'
          className='workflow-run-button gap-1.5'
          onClick={onRun}
          disabled={running}
        >
          {running ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <Play className='size-4' />
          )}
          {running ? t('Running...') : t('Run workflow')}
        </Button>
      </div>

      {/* Feature 1: Log panel */}
      {logOpen && (
        <div className='workflow-log-panel absolute top-14 right-5 bottom-12 z-20 flex w-72 flex-col rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm'>
          <div className='flex items-center justify-between border-b border-slate-100 px-3 py-2'>
            <span className='text-xs font-semibold text-slate-600 uppercase tracking-wide'>{t('Run logs')}</span>
            <button
              type='button'
              onClick={() => setLogOpen(false)}
              className='rounded p-0.5 text-slate-400 hover:text-slate-700'
            >
              <X className='size-3.5' />
            </button>
          </div>
          <div className='flex-1 overflow-y-auto p-2 space-y-1'>
            {logs.length === 0 && (
              <p className='py-6 text-center text-[11px] text-slate-400'>{t('No logs yet. Run the workflow.')}</p>
            )}
            {logs.map((entry, i) => (
              <div key={i} className='text-[11px]'>
                {entry.type === 'image' ? (
                  <div className='rounded-lg overflow-hidden border border-slate-100'>
                    <div className='flex items-center gap-1 bg-slate-50 px-2 py-1'>
                      <ImageIcon className='size-3 text-emerald-500' />
                      <span className='font-medium text-slate-600'>{entry.message}</span>
                      <span className='ml-auto text-slate-400'>{fmtTime(entry.time)}</span>
                    </div>
                    <img src={entry.imageUrl} alt='' className='w-full object-contain max-h-48' />
                  </div>
                ) : (
                  <div className={cn(
                    'flex items-start gap-1.5 rounded px-2 py-1',
                    entry.type === 'error' && 'bg-red-50',
                    entry.type === 'success' && 'bg-emerald-50',
                    entry.type === 'info' && 'bg-slate-50',
                  )}>
                    {entry.type === 'error' && <AlertCircle className='mt-0.5 size-3 shrink-0 text-red-500' />}
                    {entry.type === 'success' && <CheckCircle2 className='mt-0.5 size-3 shrink-0 text-emerald-500' />}
                    {entry.type === 'info' && <Info className='mt-0.5 size-3 shrink-0 text-slate-400' />}
                    <span className={cn(
                      'flex-1 break-all',
                      entry.type === 'error' && 'text-red-700',
                      entry.type === 'success' && 'text-emerald-700',
                      entry.type === 'info' && 'text-slate-500',
                    )}>{entry.message}</span>
                    <span className='shrink-0 text-slate-300'>{fmtTime(entry.time)}</span>
                  </div>
                )}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
          {logs.length > 0 && (
            <div className='border-t border-slate-100 px-3 py-1.5'>
              <button
                type='button'
                onClick={() => setLogs([])}
                className='text-[11px] text-slate-400 hover:text-slate-600'
              >
                {t('Clear logs')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Feature 2: Quick-add popup on connection drop */}
      {quickAdd && (
        <div
          className='fixed z-[9999] w-52 rounded-xl border border-slate-200 bg-white shadow-xl'
          style={{ left: quickAdd.x + 8, top: quickAdd.y - 8 }}
          onMouseLeave={() => {
            pendingConnectionRef.current = null
            setQuickAdd(null)
          }}
        >
          <div className='border-b border-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center justify-between'>
            {t('Add node')}
            <button
              type='button'
              onClick={() => { pendingConnectionRef.current = null; setQuickAdd(null) }}
              className='text-slate-400 hover:text-slate-600'
            >
              <X className='size-3' />
            </button>
          </div>
          <div className='max-h-72 overflow-y-auto p-1'>
            {NODE_CATEGORY_ORDER.map((cat, idx) => {
              const defs = groupedNodes.get(cat) ?? []
              if (defs.length === 0) return null
              return (
                <div key={cat}>
                  {idx > 0 && <div className='my-1 border-t border-slate-100' />}
                  <div className='px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5'>
                    <span className='size-1.5 rounded-full' style={{ background: CATEGORY_ACCENT[cat] }} />
                    {t(cat)}
                  </div>
                  {defs.map((def) => (
                    <button
                      key={def.kind}
                      type='button'
                      className='w-full rounded px-2 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                      onMouseDown={(e) => { e.preventDefault(); addNode(def.kind, quickAdd!.flowPos) }}
                    >
                      {t(def.title)}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ReactFlow
        className='studio-reactflow'
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onPaneClick={() => { pendingConnectionRef.current = null; setQuickAdd(null) }}
        // Feature 3: select edge then Delete/Backspace to delete
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        fitViewOptions={{ padding: 0.22, maxZoom: 1.05 }}
        minZoom={0.35}
        maxZoom={1.65}
        proOptions={{ hideAttribution: true }}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: '#8795df', strokeWidth: 2 }}
        defaultEdgeOptions={{
          animated: true,
          type: 'bezier',
          style: { stroke: '#8795df', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#8795df',
            width: 14,
            height: 14,
          },
        }}
      >
        <Background
          id='studio-major-grid'
          variant={BackgroundVariant.Lines}
          gap={96}
          size={1}
          color='rgba(111, 124, 181, 0.08)'
          bgColor='#f3f6fc'
        />
        <Background
          id='studio-dot-grid'
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.15}
          color='rgba(121, 132, 188, 0.2)'
        />
        <Controls
          position='bottom-left'
          showInteractive={false}
          className='workflow-controls'
        />
        <MiniMap
          position='bottom-right'
          className='workflow-minimap'
          maskColor='rgba(235, 239, 250, 0.74)'
          nodeColor={(node) =>
            WORKFLOW_NODE_DEFS[(node.data as WorkflowNodeData).kind].accent
          }
          pannable
          zoomable
        />
      </ReactFlow>
      <div className='workflow-coordinate-label' aria-hidden='true'>
        <span>INFINITE CANVAS</span>
        <i />
        <span>
          {nodes.length}N / {edges.length}E
        </span>
      </div>
    </div>
  )
}

/** Public entry: provides the ReactFlow context required by `useReactFlow`. */
export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
