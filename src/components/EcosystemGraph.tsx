import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Background, BackgroundVariant, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import { ArrowUpRight, BookOpen, LayoutGrid, Minus, Network, Plus } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { EDGE_LABELS, ROUTE_COLORS, SOURCE_COLORS, SOURCE_LABELS, matches, type AtlasData, type AtlasNode, type EdgeKind } from '../model';
import { GRAPH_NODE_GEOMETRY } from './graphGeometry';
import { NodeRelations } from './NodeRelations';
import { CanvasStage, type CanvasLayout } from './CanvasStage';
import { canPreviewPointer, resolveGraphHighlight, type GraphPreview } from './graphInteraction';
import { getGraphPositions, resizeViewport } from './graphLayout';
import { getFocusNodeId, getGraphScope } from './relationshipModel';
import './graph.css';

interface Props {
  data: AtlasData;
  routeId: string | null;
  search: string;
  sourceFilter: string;
  selectedNodeId: string | null;
  detailOpen: boolean;
  onFocusNode: (id: string) => void;
  onOpenNode: (id: string) => void;
  onOpenEdge: (id: string) => void;
  onResetFilters: () => void;
  onBack?: () => void;
}
type GraphNodeData = { node: AtlasNode; layerLabel: string; dimmed: boolean; connected: boolean; previewed: boolean; open: (id: string) => void };
type GraphNode = Node<GraphNodeData, 'atlas'>;
const EDGE_STYLES: Record<EdgeKind, { color: string; dash?: string }> = {
  calls: { color: '#278776' }, data: { color: '#527bc0' },
  protocol: { color: '#aa7e38', dash: '9 4' }, concept: { color: '#9274b3', dash: '3 5' },
  lineage: { color: '#899096', dash: '12 4 2 4' }, unresolved: { color: '#aa7878', dash: '5 6' },
};

const AtlasGraphNode = memo(function AtlasGraphNode({ data, selected }: NodeProps<GraphNode>) {
  return <div className={`atlas-flow-card${selected ? ' is-selected' : ''}${data.connected ? ' is-connected' : ''}${data.previewed ? ' is-previewed' : ''}${data.dimmed ? ' is-dimmed' : ''}`} style={{ width: GRAPH_NODE_GEOMETRY.width, height: GRAPH_NODE_GEOMETRY.height, '--node-color': SOURCE_COLORS[data.node.status.source] } as CSSProperties}>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <button className="atlas-node-button nodrag nopan" onClick={event => { event.stopPropagation(); data.open(data.node.id); }} aria-pressed={selected} aria-label={`${data.node.label}，${SOURCE_LABELS[data.node.status.source]}，选中并高亮关系`}>
      <span className="atlas-node-eyebrow">{data.layerLabel}</span>
      <strong>{data.node.label}</strong>
      <span className="atlas-node-role">{data.node.role}</span>
      <span className="atlas-node-status"><i />{SOURCE_LABELS[data.node.status.source]}<span>{selected ? '已选中' : data.previewed ? '预览中' : '点选'}</span></span>
    </button>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </div>;
});
const NODE_TYPES = { atlas: AtlasGraphNode };

export function EcosystemGraph({ data, routeId, search, sourceFilter, selectedNodeId, detailOpen, onFocusNode, onOpenNode, onOpenEdge, onResetFilters, onBack }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<ReactFlowInstance<GraphNode, Edge> | null>(null);
  const [mode, setMode] = useState<'relations' | 'canvas' | 'cards'>('relations');
  const [canvasLayout, setCanvasLayout] = useState<CanvasLayout>(() => window.matchMedia('(max-width: 600px) and (orientation: portrait)').matches ? 'vertical' : 'horizontal');
  const [hoverCapable, setHoverCapable] = useState(() => window.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches);
  const [preview, setPreview] = useState<GraphPreview>(null);
  const previousLayout = useRef(canvasLayout);
  const [zoom, setZoom] = useState(100);
  const scope = useMemo(() => getGraphScope(data, routeId), [data, routeId]);
  const route = scope.route;
  const focusId = getFocusNodeId(scope.nodes, scope.edges, selectedNodeId, route);
  const currentNode = scope.nodes.find(node => node.id === focusId);
  const routeColor = route ? ROUTE_COLORS[route.id] : undefined;
  const nodeIndex = useMemo(() => new Map(data.nodes.map(node => [node.id, node])), [data.nodes]);
  const hasFilters = !!search.trim() || sourceFilter !== 'all';
  const candidates = useMemo(() => scope.nodes.filter(node => (sourceFilter === 'all' || node.status.source === sourceFilter)
    && matches(node, search)), [scope.nodes, search, sourceFilter]);
  const visible = useMemo(() => {
    const nodes = mode === 'canvas' && !route && !hasFilters
      ? candidates.filter(node => node.overview || node.id === focusId) : candidates;
    const nodeIds = new Set(nodes.map(node => node.id));
    const edges = scope.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
    return { nodes, edges };
  }, [candidates, scope.edges, mode, route, hasFilters, focusId]);
  const visibleKey = visible.nodes.map(node => node.id).join('|') + '/' + visible.edges.map(edge => edge.id).join('|');
  const highlight = useMemo(() => resolveGraphHighlight(visible.nodes, visible.edges, focusId, preview, hoverCapable), [visible, focusId, preview, hoverCapable]);
  const connected = highlight.connectedIds;
  const focusedNode = highlight.nodeId;
  const layout = useMemo(() => getGraphPositions(visible.nodes, data.layers, route, canvasLayout), [visible.nodes, data.layers, route, canvasLayout]);

  useEffect(() => {
    const media = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const change = () => { setHoverCapable(media.matches); setPreview(null); };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const clearPreview = useCallback(() => setPreview(null), []);
  const previewPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!canPreviewPointer(event, hoverCapable)) { clearPreview(); return; }
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest<HTMLElement>('.react-flow__node[data-id], .react-flow__edge[data-id]');
    const id = item?.dataset.id;
    const next: GraphPreview = item && id ? { kind: item.classList.contains('react-flow__node') ? 'node' : 'edge', id } : null;
    setPreview(previous => previous?.kind === next?.kind && previous?.id === next?.id ? previous : next);
  };

  const fit = useCallback(() => {
    const flow = flowRef.current;
    if (!flow) return;
    void flow.fitView({ padding: 0.08, minZoom: 0.12, maxZoom: 1, duration: 0 }).then(() => {
      if (flowRef.current === flow) setZoom(Math.round(flow.getZoom() * 100));
    });
  }, []);
  useEffect(() => {
    if (mode !== 'canvas') return;
    clearPreview();
    const frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [mode, visibleKey, fit, clearPreview]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (mode !== 'canvas' || !canvas) return;
    let previousSize = { width: canvas.clientWidth, height: canvas.clientHeight };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nextSize = { width: canvas.clientWidth, height: canvas.clientHeight };
        const flow = flowRef.current;
        if (flow && (previousSize.width !== nextSize.width || previousSize.height !== nextSize.height)) {
          void flow.setViewport(resizeViewport(flow.getViewport(), previousSize, nextSize), { duration: 0 });
        }
        previousSize = nextSize;
      });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(canvas);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [mode]);
  useEffect(() => {
    if (previousLayout.current === canvasLayout) return;
    previousLayout.current = canvasLayout;
    clearPreview();
    if (mode !== 'canvas') return;
    const frame = requestAnimationFrame(() => {
      const position = focusId ? layout.get(focusId) : undefined;
      const flow = flowRef.current;
      if (position && flow) void flow.setCenter(position.x + GRAPH_NODE_GEOMETRY.width / 2,
        position.y + GRAPH_NODE_GEOMETRY.height / 2, { zoom: flow.getZoom(), duration: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [canvasLayout, mode, focusId, layout, clearPreview]);

  const selectNode = useCallback((id: string) => { clearPreview(); onFocusNode(id); }, [clearPreview, onFocusNode]);
  const readRelations = (id: string) => {
    selectNode(id);
    setMode('relations');
    requestAnimationFrame(() => hostRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  };
  const selectEdge = onOpenEdge;
  const readAtFullSize = () => {
    const flow = flowRef.current;
    if (!flow) return;
    const node = flow.getNode(focusId ?? '') ?? flow.getNodes()[0];
    if (node) void flow.setCenter(node.position.x + GRAPH_NODE_GEOMETRY.width / 2,
      node.position.y + GRAPH_NODE_GEOMETRY.height / 2, { zoom: 1, duration: 0 });
  };
  const flowNodes: GraphNode[] = useMemo(() => visible.nodes.map(node => ({
    ...GRAPH_NODE_GEOMETRY,
    id: node.id, type: 'atlas', position: layout.get(node.id) ?? { x: 0, y: 0 },
    selected: node.id === focusId, draggable: false,
    ariaLabel: node.label, focusable: false,
    data: { node, layerLabel: data.layers.find(layer => layer.id === node.layer)?.label ?? node.layer,
      dimmed: connected.size > 0 && !connected.has(node.id), connected: connected.has(node.id), previewed: hoverCapable && preview?.kind === 'node' && preview.id === node.id, open: selectNode },
  })), [visible.nodes, layout, focusId, data.layers, connected, selectNode, hoverCapable, preview]);
  const flowEdges: Edge[] = useMemo(() => visible.edges.map(edge => {
    const active = edge.id === highlight.edgeId || edge.source === focusedNode || edge.target === focusedNode;
    const style = EDGE_STYLES[edge.kind];
    const color = active ? routeColor ?? style.color : style.color;
    return { id: edge.id, source: edge.source, target: edge.target, type: 'default',
      focusable: true, interactionWidth: 24,
      domAttributes: { onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectEdge(edge.id); } } },
      ariaLabel: `${nodeIndex.get(edge.source)?.label} → ${nodeIndex.get(edge.target)?.label}：${EDGE_LABELS[edge.kind]}，${edge.label}`,
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 15, height: 15 },
      style: { stroke: color, strokeWidth: active ? 2.7 : 1.5, strokeDasharray: style.dash, opacity: connected.size && !active ? 0.18 : 0.8 },
      label: active ? edge.label : undefined,
      labelStyle: { fill: 'var(--ink)', fontSize: 14 }, labelBgStyle: { fill: 'var(--surface)' }, labelBgPadding: [7, 4] as [number, number],
    };
  }), [visible.edges, focusedNode, highlight.edgeId, routeColor, nodeIndex, connected, selectEdge]);
  const cardGroups = route ? [{ id: route.id, label: '沿研究路径阅读', description: '以下顺序用于讲解；实际关系以关系列表和图中连线为准。', nodes: [...new Set([...route.steps.map(step => step.nodeId), ...route.nodeIds])].flatMap(id => { const node = visible.nodes.find(item => item.id === id); return node ? [node] : []; }) }]
    : data.layers.map(layer => ({ ...layer, nodes: visible.nodes.filter(node => node.layer === layer.id) })).filter(group => group.nodes.length);

  return <div className="ecosystem-graph" ref={hostRef} style={{ '--route-color': routeColor ?? 'var(--accent)' } as CSSProperties}>
    <div className="atlas-graph-toolbar">
      <div className="atlas-graph-heading"><span className="atlas-live-dot" /><strong>{route ? route.short : '生态组件与关系'}</strong><span className="atlas-graph-count" aria-live="polite">{mode === 'relations' ? scope.nodes.length : visible.nodes.length} 个组件 · {mode === 'relations' ? scope.edges.length : visible.edges.length} 条关系</span></div>
      <div className="atlas-view-switch" role="group" aria-label="图谱展示方式">
        <button type="button" aria-pressed={mode === 'relations'} onClick={() => setMode('relations')}><BookOpen size={17} aria-hidden="true" />关系阅读</button>
        <button type="button" aria-pressed={mode === 'canvas'} onClick={() => setMode('canvas')}><Network size={17} aria-hidden="true" />全景画布</button>
        <button type="button" aria-pressed={mode === 'cards'} onClick={() => setMode('cards')}><LayoutGrid size={17} aria-hidden="true" />组件目录</button>
      </div>
    </div>
    {mode === 'relations' ? <NodeRelations data={data} nodes={scope.nodes} edges={scope.edges} candidates={candidates}
      selectedNodeId={focusId} scopeLabel={route ? route.short : '全部组件'} hasFilters={hasFilters}
      onSelectNode={selectNode} onOpenNode={onOpenNode} onOpenEdge={onOpenEdge} onResetFilters={onResetFilters}
      onBack={onBack} />
      : visible.nodes.length === 0 ? <div className="atlas-empty"><span aria-hidden="true">⌕</span><h3>没有符合条件的组件</h3><p>试试其他关键词，或将源码状态切换为「所有来源状态」。当前路线也会限定搜索范围。</p><button className="button secondary" onClick={onResetFilters}>清除筛选</button></div>
      : mode === 'canvas' ? <>
        <p className="atlas-canvas-note">{hoverCapable ? '悬停预览关联，点击锁定组件；画布内滚轮上滑放大、下滑缩小。' : '点选组件后保持高亮，拖动平移、双指缩放；可进入专注画布切换横竖屏。'}{!route && !hasFilters ? `当前为总览组件；全部 ${scope.nodes.length} 个组件可在关系阅读和组件目录中查看。` : '画布只展示当前筛选范围内的组件与连线。'}</p>
        <CanvasStage layout={canvasLayout} onLayoutChange={setCanvasLayout} detailOpen={detailOpen}>
        <div className="atlas-canvas" ref={canvasRef} aria-label="可缩放的生态关系图" onPointerMove={previewPointer} onPointerOver={previewPointer} onPointerLeave={clearPreview} onPointerDown={clearPreview} onPointerCancel={clearPreview}>
          <ReactFlow<GraphNode, Edge>
            nodes={flowNodes} edges={flowEdges} nodeTypes={NODE_TYPES}
            onInit={instance => { flowRef.current = instance; requestAnimationFrame(fit); }}
            onViewportChange={viewport => setZoom(Math.round(viewport.zoom * 100))}
            onNodeClick={(_, node) => selectNode(node.id)}
            onEdgeClick={(_, edge) => selectEdge(edge.id)}
            nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
            minZoom={0.12} maxZoom={1.8} fitView fitViewOptions={{ padding: 0.08, maxZoom: 1 }}
            deleteKeyCode={null} panOnScroll={false} zoomOnScroll zoomOnPinch
            preventScrolling attributionPosition="bottom-right"
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--line)" />
          </ReactFlow>
          <div className="atlas-canvas-controls" role="group" aria-label="画布缩放">
            <button aria-label="放大图谱" onClick={() => void flowRef.current?.zoomIn({ duration: 0 })}><Plus size={16} aria-hidden="true" /></button>
            <span aria-live="off">{zoom}%</span>
            <button aria-label="缩小图谱" onClick={() => void flowRef.current?.zoomOut({ duration: 0 })}><Minus size={16} aria-hidden="true" /></button>
            <button className="atlas-fit-button" onClick={readAtFullSize}>100% 字号</button>
            <button className="atlas-fit-button" onClick={fit}>适应画布</button>
          </div>
          <div className="atlas-canvas-hint">{hoverCapable ? '悬停预览 · 点击锁定 · 滚轮缩放 · 拖动平移' : '点选锁定 · 拖动平移 · 双指缩放'}</div>
        </div>
        {currentNode && <div className="atlas-canvas-selection"><div><span>当前组件</span><strong>{currentNode.label}</strong><p>{visible.nodes.some(node => node.id === focusId)
          ? `${visible.edges.filter(edge => edge.source === focusId || edge.target === focusId).length} 条关系在画布中可见；完整关联可进入关系阅读。`
          : '当前组件不在画布筛选结果中，仍保留你的阅读位置。'}</p></div><div className="atlas-canvas-selection-actions"><button onClick={() => readRelations(currentNode.id)}><BookOpen size={17} aria-hidden="true" />阅读该组件的关系</button><button onClick={() => onOpenNode(currentNode.id)}>组件详情<ArrowUpRight size={17} aria-hidden="true" /></button></div></div>}
        </CanvasStage>
      </> : <div className="atlas-card-view">
        <p className="atlas-card-note">按职责与研究路线查找组件。选择一张卡片，进入该组件的关系阅读；关系数量按当前路线范围统计。</p>
        {cardGroups.map(group => <section key={group.id} className="atlas-card-group">
          <div className="atlas-layer-heading"><span className="atlas-layer-mark" /><h3>{group.label}</h3><span>{group.nodes.length}</span></div>
          <p className="atlas-layer-description">{group.description}</p>
          <div className="atlas-card-grid">{group.nodes.map((node, index) => {
            const relationCount = scope.edges.filter(edge => edge.source === node.id || edge.target === node.id).length;
            return <button key={node.id} className={`atlas-readable-card${focusId === node.id ? ' is-selected' : ''}`} style={{ '--node-color': SOURCE_COLORS[node.status.source] } as CSSProperties} onClick={() => readRelations(node.id)}>
              <span className="atlas-readable-top"><span className="atlas-source-label"><i />{SOURCE_LABELS[node.status.source]}</span>{route ? <span className="atlas-step-number">{String(index + 1).padStart(2, '0')}</span> : <span aria-hidden="true">↗</span>}</span>
              <strong>{node.label}</strong><span className="atlas-readable-role">{node.role}</span>
              <span className="atlas-readable-bottom">{relationCount} 条范围内关系<span>阅读关系 →</span></span>
            </button>;
          })}</div>
        </section>)}
      </div>}
    {mode !== 'relations' && <div className="atlas-graph-legend" aria-label="关系类型图例"><span className="atlas-legend-title">关系图例</span>{(Object.keys(EDGE_STYLES) as EdgeKind[]).map(kind => <span key={kind}><svg width="26" height="10" aria-hidden="true"><line x1="0" y1="5" x2="26" y2="5" stroke={EDGE_STYLES[kind].color} strokeWidth="2" strokeDasharray={EDGE_STYLES[kind].dash} /></svg>{EDGE_LABELS[kind]}</span>)}<p>概念对应与历史传承不代表运行时调用。</p></div>}
    {mode !== 'relations' && visible.edges.length > 0 ? <details className="atlas-relationship-list">
      <summary>查看当前 {visible.edges.length} 条关系 <span>方向、类型与证据</span></summary>
      <div>{visible.edges.map(edge => <button key={edge.id} onClick={() => selectEdge(edge.id)}>
        <span className="atlas-relation-type" style={{ color: EDGE_STYLES[edge.kind].color }}>{EDGE_LABELS[edge.kind]}</span>
        <span className="atlas-relation-endpoints">{nodeIndex.get(edge.source)?.label}<span aria-hidden="true"> → </span>{nodeIndex.get(edge.target)?.label}</span>
        <span className="atlas-relation-caption">{edge.label}<span aria-hidden="true"> ↗</span></span>
      </button>)}</div>
    </details> : null}
  </div>;
}
