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
} from '@xyflow/react'
import {
  ChevronRight,
  CircleDot,
  Loader2,
  Play,
  Plus,
  Trash2,
  Workflow,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
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

  const addNode = useCallback(
    (kind: WorkflowNodeKind) => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      const center = rect
        ? screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          })
        : { x: 200, y: 200 }
      const node: WorkflowRfNode = {
        id: nextNodeId(),
        type: 'workflow',
        position: { x: center.x - 128, y: center.y - 80 },
        data: {
          kind,
          values: buildDefaultValues(kind),
          onChange: handleWidgetChange,
        },
      }
      setNodes((prev) => [...prev, node])
    },
    [handleWidgetChange, screenToFlowPosition, setNodes]
  )

  const clearCanvas = useCallback(() => {
    setNodes([])
    setEdges([])
    setRunStatus({})
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

    try {
      const results = await runWorkflow(runNodes, runEdges, (nodeId, status) =>
        setRunStatus((prev) => ({ ...prev, [nodeId]: status }))
      )
      for (const r of results) {
        if (r.preview === undefined) continue
        const node = nodes.find((n) => n.id === r.nodeId)
        if (!node) continue
        const key = node.data.kind === 'show-text' ? 'text' : 'preview'
        writePreview(r.nodeId, key, r.preview)
      }
    } catch {
      // Node-level errors are surfaced via runStatus badges on each node.
    } finally {
      setRunning(false)
    }
  }, [edges, nodes, running, writePreview])

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

  return (
    <div ref={wrapperRef} className='workflow-canvas relative h-full w-full'>
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

      <div className='workflow-run-dock absolute top-4 right-5 z-10'>
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

      <ReactFlow
        className='studio-reactflow'
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
