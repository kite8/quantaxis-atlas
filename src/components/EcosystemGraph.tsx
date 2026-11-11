import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Background, BackgroundVariant, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import { ArrowUpRight, BookOpen, LayoutGrid, Minus, Network, Plus } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { EDGE_LABELS, ROUTE_COLORS, SOURCE_COLORS, SOURCE_LABELS, matches, type AtlasData, type AtlasNode, type EdgeKind } from '../model';
import { GRAPH_NODE_GEOMETRY } from './graphGeometry';
import { NodeRelations } from './NodeRelations';
import { getFocusNodeId, getGraphScope } from './relationshipModel';
import './graph.css';

interface Props {
  data: AtlasData;
  routeId: string | null;
  search: string;
  sourceFilter: string;
  selectedNodeId: string | null;
  onFocusNode: (id: string) => void;
  onOpenNode: (id: string) => void;
  onOpenEdge: (id: string) => void;
  onResetFilters: () => void;
  onBack?: () => void;
}
type GraphNodeData = { node: AtlasNode; layerLabel: string; dimmed: boolean; connected: boolean; open: (id: string) => void };
type GraphNode = Node<GraphNodeData, 'atlas'>;
const EDGE_STYLES: Record<EdgeKind, { color: string; dash?: string }> = {
  calls: { color: '#278776' }, data: { color: '#527bc0' },
  protocol: { color: '#aa7e38', dash: '9 4' }, concept: { color: '#9274b3', dash: '3 5' },
  lineage: { color: '#899096', dash: '12 4 2 4' }, unresolved: { color: '#aa7878', dash: '5 6' },
};

const AtlasGraphNode = memo(function AtlasGraphNode({ data, selected }: NodeProps<GraphNode>) {
  return <div className={`atlas-flow-card${selected ? ' is-selected' : ''}${data.connected ? ' is-connected' : ''}${data.dimmed ? ' is-dimmed' : ''}`} style={{ width: GRAPH_NODE_GEOMETRY.width, height: GRAPH_NODE_GEOMETRY.height, '--node-color': SOURCE_COLORS[data.node.status.source] } as CSSProperties}>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <button className="atlas-node-button nodrag nopan" onClick={event => { event.stopPropagation(); data.open(data.node.id); }} aria-pressed={selected} aria-label={`${data.node.label}，${SOURCE_LABELS[data.node.status.source]}，选中并高亮关系`}>
      <span className="atlas-node-eyebrow">{data.layerLabel}</span>
      <strong>{data.node.label}</strong>
      <span className="atlas-node-role">{data.node.role}</span>
      <span className="atlas-node-status"><i />{SOURCE_LABELS[data.node.status.source]}<span>{selected ? '已选中' : '点选'}</span></span>
    </button>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </div>;
});
const NODE_TYPES = { atlas: AtlasGraphNode };

export function EcosystemGraph({ data, routeId, search, sourceFilter, selectedNodeId, onFocusNode, onOpenNode, onOpenEdge, onResetFilters, onBack }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<ReactFlowInstance<GraphNode, Edge> | null>(null);
  const [mode, setMode] = useState<'relations' | 'canvas' | 'cards'>('relations');
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

  const fit = useCallback(() => {
    const flow = flowRef.current;
    if (!flow) return;
    void flow.fitView({ padding: 0.08, minZoom: 0.12, maxZoom: 1, duration: 0 }).then(() => {
      if (flowRef.current === flow) setZoom(Math.round(flow.getZoom() * 100));
    });
  }, []);
  useEffect(() => {
    if (mode !== 'canvas' || !canvasRef.current) return;
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    observer.observe(canvasRef.current);
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [mode, visibleKey, fit]);

  const selectNode = onFocusNode;
  const readRelations = (id: string) => {
    selectNode(id);
    setMode('relations');
    requestAnimationFrame(() => hostRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  };
  const selectEdge = onOpenEdge;
  const focusedNode = focusId;
  const readAtFullSize = () => {
    const flow = flowRef.current;
    if (!flow) return;
    const node = flow.getNode(focusId ?? '') ?? flow.getNodes()[0];
    if (node) void flow.setCenter(node.position.x + GRAPH_NODE_GEOMETRY.width / 2,
      node.position.y + GRAPH_NODE_GEOMETRY.height / 2, { zoom: 1, duration: 0 });
  };
  const connected = useMemo(() => {
    const ids = new Set<string>();
    if (focusedNode && visible.nodes.some(node => node.id === focusedNode)) {
      ids.add(focusedNode);
      visible.edges.forEach(edge => { if (edge.source === focusedNode || edge.target === focusedNode) { ids.add(edge.source); ids.add(edge.target); } });
    }
    return ids;
  }, [focusedNode, visible]);
  const layout = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    if (route) {
      const orderedIds = [...new Set([...route.steps.map(step => step.nodeId), ...route.nodeIds])];
      orderedIds.filter(id => visible.nodes.some(node => node.id === id)).forEach((id, index) => {
        positions.set(id, { x: (index % 4) * (GRAPH_NODE_GEOMETRY.width + 64), y: Math.floor(index / 4) * (GRAPH_NODE_GEOMETRY.height + 52) });
      });
    } else {
      const groups = data.layers.map(layer => visible.nodes.filter(node => node.layer === layer.id)).filter(nodes => nodes.length);
      let rowY = 0;
      for (let groupRow = 0; groupRow < Math.ceil(groups.length / 3); groupRow++) {
        const rowGroups = groups.slice(groupRow * 3, groupRow * 3 + 3);
        const columnWidth = GRAPH_NODE_GEOMETRY.width + 30;
        const rowHeight = GRAPH_NODE_GEOMETRY.height + 30;
        rowGroups.forEach((nodes, column) => nodes.forEach((node, index) => positions.set(node.id, { x: column * (columnWidth * 2 + 28) + (index % 2) * columnWidth, y: rowY + Math.floor(index / 2) * rowHeight })));
        rowY += Math.max(...rowGroups.map(nodes => Math.ceil(nodes.length / 2))) * rowHeight + 62;
      }
    }
    return positions;
  }, [data.layers, visible.nodes, route]);
  const flowNodes: GraphNode[] = useMemo(() => visible.nodes.map(node => ({
    ...GRAPH_NODE_GEOMETRY,
    id: node.id, type: 'atlas', position: layout.get(node.id) ?? { x: 0, y: 0 },
    selected: node.id === focusId, draggable: false,
    ariaLabel: node.label, focusable: false,
    data: { node, layerLabel: data.layers.find(layer => layer.id === node.layer)?.label ?? node.layer,
      dimmed: connected.size > 0 && !connected.has(node.id), connected: connected.has(node.id), open: selectNode },
  })), [visible.nodes, layout, focusId, data.layers, connected, selectNode]);
  const flowEdges: Edge[] = useMemo(() => visible.edges.map(edge => {
    const active = edge.source === focusedNode || edge.target === focusedNode;
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
  }), [visible.edges, focusedNode, routeColor, nodeIndex, connected, selectEdge]);
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
        <p className="atlas-canvas-note">点选组件后保持高亮，再通过下方按钮阅读完整关系。{!route && !hasFilters ? `当前为总览组件；全部 ${scope.nodes.length} 个组件可在关系阅读和组件目录中查看。` : '画布只展示当前筛选范围内的组件与连线。'}</p>
        <div className="atlas-canvas" ref={canvasRef} aria-label="可缩放的生态关系图">
          <ReactFlow<GraphNode, Edge>
            nodes={flowNodes} edges={flowEdges} nodeTypes={NODE_TYPES}
            onInit={instance => { flowRef.current = instance; requestAnimationFrame(fit); }}
            onViewportChange={viewport => setZoom(Math.round(viewport.zoom * 100))}
            onNodeClick={(_, node) => selectNode(node.id)}
            onEdgeClick={(_, edge) => selectEdge(edge.id)}
            nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
            minZoom={0.12} maxZoom={1.8} fitView fitViewOptions={{ padding: 0.08, maxZoom: 1 }}
            deleteKeyCode={null} panOnScroll={false} zoomOnScroll={false} zoomOnPinch
            preventScrolling={false} attributionPosition="bottom-right"
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
          <div className="atlas-canvas-hint">拖动平移 · 双指缩放 · 点选后保持高亮</div>
        </div>
        {currentNode && <div className="atlas-canvas-selection"><div><span>当前组件</span><strong>{currentNode.label}</strong><p>{visible.nodes.some(node => node.id === focusId)
          ? `${visible.edges.filter(edge => edge.source === focusId || edge.target === focusId).length} 条关系在画布中可见；完整关联可进入关系阅读。`
          : '当前组件不在画布筛选结果中，仍保留你的阅读位置。'}</p></div><div className="atlas-canvas-selection-actions"><button onClick={() => readRelations(currentNode.id)}><BookOpen size={17} aria-hidden="true" />阅读该组件的关系</button><button onClick={() => onOpenNode(currentNode.id)}>组件详情<ArrowUpRight size={17} aria-hidden="true" /></button></div></div>}
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
