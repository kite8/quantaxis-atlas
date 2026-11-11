import { useEffect, useId, useRef } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, CircleHelp, GitBranch, Search } from 'lucide-react';
import type { AtlasData, AtlasEdge, AtlasNode } from '../model';
import { EDGE_LABELS, SOURCE_LABELS } from '../model';
import { getNodeRelations } from './relationshipModel';
import './node-relations.css';

interface NodeRelationsProps {
  data: AtlasData;
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  candidates: AtlasNode[];
  selectedNodeId: string | null;
  scopeLabel: string;
  hasFilters: boolean;
  onSelectNode: (id: string) => void;
  onOpenNode: (id: string) => void;
  onOpenEdge: (id: string) => void;
  onResetFilters: () => void;
  onBack?: () => void;
}

const RELATION_NOTES: Record<AtlasEdge['kind'], string> = {
  calls: '实现调用关系，以该条证据确认调用范围。',
  data: '记录中的数据流方向，不代表完整流水线已运行。',
  protocol: '协议层面的交互关联。',
  concept: '概念对应，不表示存在实际调用。',
  lineage: '历史传承，不表示当前存在运行时调用。',
  unresolved: '依赖关联仍有未解析或未核实的部分。',
};

export function NodeRelations({ data, nodes, edges, candidates, selectedNodeId, scopeLabel, hasFilters, onSelectNode, onOpenNode, onOpenEdge, onResetFilters, onBack }: NodeRelationsProps) {
  const prefix = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingNavigation = useRef(false);
  const previousSelection = useRef(selectedNodeId);
  const { node, incoming, outgoing } = getNodeRelations(nodes, edges, selectedNodeId);
  const isOutsideCandidates = !!node && !candidates.some(candidate => candidate.id === node.id);
  const candidateIds = new Set(candidates.map(candidate => candidate.id));
  const remainingNodes = hasFilters ? nodes.filter(candidate => !candidateIds.has(candidate.id) && candidate.id !== node?.id) : [];

  const moveToCurrent = () => {
    const heading = headingRef.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    (heading.closest('section') ?? heading).scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  useEffect(() => {
    if (pendingNavigation.current && previousSelection.current !== selectedNodeId) {
      pendingNavigation.current = false;
      moveToCurrent();
    }
    previousSelection.current = selectedNodeId;
  }, [selectedNodeId]);
  const select = (id: string) => {
    if (id === selectedNodeId) { moveToCurrent(); return; }
    pendingNavigation.current = true;
    onSelectNode(id);
  };
  const back = () => {
    if (!onBack) return;
    pendingNavigation.current = true;
    onBack();
  };

  const renderRelations = (direction: 'incoming' | 'outgoing') => {
    const relations = direction === 'incoming' ? incoming : outgoing;
    const title = direction === 'incoming' ? '指向当前组件' : '从当前组件指出';
    return <section className="node-relations-direction" id={`${prefix}-${direction}`} aria-labelledby={`${prefix}-${direction}-title`}>
      <div className="node-relations-direction-heading"><h3 id={`${prefix}-${direction}-title`}>{title}</h3><span>{relations.length} 条</span></div>
      {!relations.length ? <p className="node-relations-empty-direction">当前阅读范围内没有{direction === 'incoming' ? '指入' : '指出'}关系。</p> : <ul className="node-relations-list">{relations.map(({ edge, neighbor }) => <li className="node-relation" key={edge.id}>
        <div className="node-relation-meta"><span className={`node-relation-kind node-relation-kind-${edge.kind}`}>{EDGE_LABELS[edge.kind]}</span><button type="button" className="node-relation-evidence" onClick={() => onOpenEdge(edge.id)} aria-label={`查看关系证据：${edge.label}，${direction === 'incoming' ? neighbor.label + ' 指向 ' + node?.label : node?.label + ' 指向 ' + neighbor.label}`}>关系证据<ArrowUpRight size={16} aria-hidden="true"/></button></div>
        <p className="node-relation-endpoints">{direction === 'incoming' ? <><span>{neighbor.label}</span><ArrowRight size={16} aria-hidden="true"/><strong>{node?.label}</strong></> : <><strong>{node?.label}</strong><ArrowRight size={16} aria-hidden="true"/><span>{neighbor.label}</span></>}</p>
        <h4>{edge.label}</h4><p className="node-relation-description">{edge.description}</p>
        <p className="node-relation-note">{RELATION_NOTES[edge.kind]}</p>
        <button type="button" className="node-relation-neighbor" onClick={() => select(neighbor.id)} aria-label={`设为当前组件：${neighbor.label}`}><span><strong>{neighbor.label}</strong><span className="node-relation-neighbor-role">{neighbor.role}</span><span className="node-relation-neighbor-action">设为当前组件</span></span><ArrowRight size={20} aria-hidden="true"/></button>
      </li>)}</ul>}
    </section>;
  };

  return <div className="node-relations">
    <div className="node-relations-intro"><div><span className="node-relations-kicker">关系阅读</span><h2>选一个组件，沿关系继续阅读。</h2></div><p>当前范围：<strong>{scopeLabel}</strong> · {nodes.length} 个组件 · {edges.length} 条关系。搜索与来源筛选只定位阅读起点，不隐藏当前范围内的关联。</p></div>
    <div className="node-relations-picker"><label htmlFor={`${prefix}-select`}>当前阅读组件</label><div className="node-relations-select"><select id={`${prefix}-select`} value={node?.id ?? ''} onChange={event => select(event.target.value)}><option value="" disabled>选择一个组件</option>{isOutsideCandidates && <optgroup label="当前选择"><option value={node.id}>{node.label}（不在筛选结果中）</option></optgroup>}<optgroup label={hasFilters ? `符合筛选的起点 · ${candidates.length}` : `当前范围 · ${candidates.length}`}>{candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</optgroup>{remainingNodes.length > 0 && <optgroup label="范围内其他组件">{remainingNodes.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</optgroup>}</select><ChevronDown size={18} aria-hidden="true"/></div>{hasFilters && <button type="button" className="node-relations-reset" onClick={onResetFilters}>清除筛选</button>}</div>
    {hasFilters && <div className="node-relations-filter-note"><Search size={16} aria-hidden="true"/><p>{candidates.length ? `找到 ${candidates.length} 个阅读起点。` : '没有符合筛选的阅读起点，可清除筛选或选择范围内其他组件。'}{isOutsideCandidates && '当前组件不在筛选结果中，已保留当前选择及其关系。'}</p></div>}
    {node ? <>
      <section className="node-relations-current" aria-labelledby={`${prefix}-current`}><div className="node-relations-current-top"><span className="node-relations-kicker">当前组件</span><span className="node-relations-source">{SOURCE_LABELS[node.status.source]}</span></div><h2 ref={headingRef} id={`${prefix}-current`} tabIndex={-1}>{node.label}</h2><p className="node-relations-role">{node.role}</p><p className="node-relations-layer"><GitBranch size={16} aria-hidden="true"/>{data.layers.find(layer => layer.id === node.layer)?.label || node.layer}</p><div className="node-relations-current-actions"><button type="button" className="node-relations-open" onClick={() => onOpenNode(node.id)}>查看组件详情<ArrowUpRight size={18} aria-hidden="true"/></button>{onBack && <button type="button" className="node-relations-back" onClick={back}><ArrowLeft size={17} aria-hidden="true"/>返回上个组件</button>}</div></section>
      <div className="node-relations-direction-nav" aria-label="跳转到关系方向"><a href={`#${prefix}-incoming`} onClick={event => {event.preventDefault();document.getElementById(`${prefix}-incoming`)?.scrollIntoView({block:'start',behavior:'auto'});}}>指入关系 <strong>{incoming.length}</strong><ArrowDown size={15} aria-hidden="true"/></a><a href={`#${prefix}-outgoing`} onClick={event => {event.preventDefault();document.getElementById(`${prefix}-outgoing`)?.scrollIntoView({block:'start',behavior:'auto'});}}>指出关系 <strong>{outgoing.length}</strong><ArrowDown size={15} aria-hidden="true"/></a></div>
      <p className="node-relations-direction-note"><CircleHelp size={17} aria-hidden="true"/>方向表示记录中的起点与终点；概念对应、历史传承与实际调用分别标记。</p><div className="node-relations-columns">{renderRelations('incoming')}{renderRelations('outgoing')}</div>
    </> : <div className="node-relations-no-selection"><Search size={26} aria-hidden="true"/><h3>选择一个组件开始阅读</h3><p>{nodes.length ? '使用上方选择框定位组件，再沿指入或指出关系逐步探索。' : '当前范围没有可供阅读的组件，请选择其他研究路线。'}</p></div>}
  </div>;
}
