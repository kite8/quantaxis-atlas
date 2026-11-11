import { useEffect, useRef } from 'react';
import { ArrowUpRight, BookOpen, GitBranch, Link2, X } from 'lucide-react';
import { SOURCE_LABELS, IMPLEMENTATION_LABELS, WIRING_LABELS, EDGE_LABELS } from '../model';
import type { AtlasData } from '../model';
import { dateLabel } from './dateLabel';
export type Selection = { type: 'node' | 'repo' | 'event' | 'capability' | 'edge' | 'route'; id: string };
export function EvidenceList({ data, ids }: { data: AtlasData; ids: string[] }) {
  const evidence = ids.map(id => data.evidence.find(e => e.id === id)).filter(e => !!e);
  return <div className="evidence-list">{evidence.length ? evidence.map(e => <div className="evidence-item" key={e!.id}>
    <BookOpen size={15} aria-hidden="true"/><div>{e!.availability !== 'not_published' && e!.url ? <a href={e!.url} target="_blank" rel="noopener noreferrer">{e!.title}<ArrowUpRight size={13}/></a> : <><span>{e!.title}</span><small className="unpublished">原始资料未公开</small></>}
    {e!.commit && <code title={e!.commit}>{e!.commit}</code>}{e!.path && <small>{e!.path}</small>}{e!.note && <small>{e!.note}</small>}
  </div></div>) : <p className="muted">暂未关联可核查证据。</p>}</div>;
}
function TextList({ items }: { items: string[] }) { return <ul className="detail-list">{items.map((item,i) => <li key={i}>{item}</li>)}</ul>; }
export function DetailPanel({ data, selection, onClose, onSelect }: {data: AtlasData; selection: Selection; onClose: () => void; onSelect: (selection: Selection) => void}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const key = (event: KeyboardEvent) => {
      if(event.key === 'Escape') { event.preventDefault(); onClose(); }
      if(event.key === 'Tab') {
        const elements = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]') || []).filter(e=>e.getClientRects().length);
        const first = elements[0], last = elements[elements.length-1];
        if(event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) {event.preventDefault();last?.focus();}
        else if(!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
      }
    };
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow='hidden'; document.addEventListener('keydown',key);
    return () => {document.body.style.overflow=bodyOverflow;document.removeEventListener('keydown',key);previous?.focus();};
  }, [onClose]);
  const node = selection.type==='node' ? data.nodes.find(n=>n.id===selection.id) : undefined;
  const repo = selection.type==='repo' ? data.repos.find(n=>n.id===selection.id) : undefined;
  const event = selection.type==='event' ? data.events.find(n=>n.id===selection.id) : undefined;
  const capability = selection.type==='capability' ? data.pdfCapabilities.find(n=>n.id===selection.id) : undefined;
  const edge = selection.type==='edge' ? data.edges.find(n=>n.id===selection.id) : undefined;
  const route = selection.type==='route' ? data.routes.find(n=>n.id===selection.id) : undefined;
  const item = node || repo || event || capability || edge || route;
  const title = node?.label || repo?.name || event?.title || capability?.title || edge?.label || route?.title || '未找到条目';
  const labels = {node:'生态组件',repo:'项目仓库',event:'演进事件',capability:'PDF 能力拼图',edge:'组件关联',route:'研究路线'};
  const relatedNodes = repo?.nodeIds || event?.nodeIds || capability?.nodeIds || route?.nodeIds || (edge ? [edge.source,edge.target]: []);
  return <div className="detail-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={panel} className="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title">
    <div className="detail-heading"><span className="eyebrow">{labels[selection.type]}</span><button ref={close} className="icon-button" aria-label="关闭详情" onClick={onClose}><X size={20}/></button></div>
    <h2 id="detail-title">{title}</h2>
    {!item && <p>此链接对应的条目不在当前研究数据中。</p>}
    {node && <><p className="detail-lead">{node.role}</p><div className="status-axes"><div><small>源码可用性</small><strong>{SOURCE_LABELS[node.status.source]}</strong></div><div><small>实现程度</small><strong>{IMPLEMENTATION_LABELS[node.status.implementation] || node.status.implementation}</strong></div><div><small>装配方式</small><strong>{WIRING_LABELS[node.status.wiring] || node.status.wiring}</strong></div></div><section><h3>为何独立成组件</h3><p>{node.why}</p></section><section><h3>公开实现</h3><TextList items={node.implementation}/></section><section><h3>边界与限制</h3><TextList items={node.boundaries}/></section><section><h3>关联仓库</h3><div className="related-links">{node.repoIds.map(id=><button key={id} onClick={()=>onSelect({type:'repo',id})}><GitBranch size={15}/>{data.repos.find(r=>r.id===id)?.name || id}<ArrowUpRight size={14}/></button>)}</div></section><section><h3>组件关系</h3><div className="related-links">{data.edges.filter(e=>e.source===node.id||e.target===node.id).map(e=><button key={e.id} onClick={()=>onSelect({type:'edge',id:e.id})}><Link2 size={15}/><span>{data.nodes.find(n=>n.id===e.source)?.label} → {data.nodes.find(n=>n.id===e.target)?.label}<small>{EDGE_LABELS[e.kind]} · {e.label}</small></span></button>)}</div></section></>}
    {repo && <><p className="detail-lead">{repo.role}</p><div className="tag-row"><span className={`source-badge source-${repo.publicState}`}>{SOURCE_LABELS[repo.publicState]}</span><span className="tag">{repo.headChecked?'已核查研究基准提交':'研究范围内核查'}</span></div><section><h3>研究范围</h3><p>{repo.scope}</p><p className="muted">{repo.era}</p></section><section><h3>固定提交</h3><code className="commit-block">{repo.commit}</code>{repo.url && <a className="text-link" href={repo.url} target="_blank" rel="noopener noreferrer">查看公开仓库<ArrowUpRight size={14}/></a>}</section><section><h3>阅读边界</h3><TextList items={repo.limitations}/></section></>}
    {event && <><time className="event-time" dateTime={event.date}>{dateLabel(event.date)}</time><p className="detail-lead">{event.summary}</p><section><h3>这次变化意味着什么</h3><p>{event.meaning}</p></section>{event.authorDate && <section><h3>原始作者时间与时区</h3><code className="commit-block">{event.authorDate}</code></section>}{event.commit && <section><h3>对应提交</h3><code className="commit-block">{event.commit}</code></section>}<section><h3>解释边界</h3><TextList items={event.limitations}/></section><p className="notice">演进脉络是有证据支撑的选定事件，不代表各年度的完整代码快照。</p></>}
    {capability && <><p className="detail-lead">{capability.summary}</p><div className="tag-row"><span className="tag">{capability.classification}</span><span className="tag">PDF · {capability.pages.length ? capability.pages.map(p=>`p.${p}`).join(' / '):'页码待核查'}</span></div><section><h3>公开代码落点</h3><p>{capability.publicFinding}</p></section><section><h3>尚缺的拼图</h3><TextList items={capability.gaps}/></section><p className="notice">PDF 页码用于定位原始资料中的能力描述，不等同于源码验证。原始资料未公开时，请以关联公开代码与固定提交为核查入口。</p></>}
    {edge && <><div className="tag-row"><span className="tag">{EDGE_LABELS[edge.kind]}</span></div><p className="detail-lead">{edge.description}</p><p className="notice">关联类型分别表达实现调用、数据、协议、概念或历史关系；连线本身不表示端到端功能已经运行。</p></>}
    {route && <><p className="detail-lead">{route.question}</p><p>{route.summary}</p><section><h3>阅读步骤</h3><ol className="detail-list">{route.steps.map((s,i)=><li key={i}><strong>{s.label}</strong><p>{s.why}</p></li>)}</ol></section><section><h3>路线边界</h3><TextList items={route.limitations}/></section></>}
    {!!relatedNodes.length && <section><h3>关联组件</h3><div className="related-links">{relatedNodes.map(id=><button key={id} onClick={()=>onSelect({type:'node',id})}><span>{data.nodes.find(n=>n.id===id)?.label || id}</span><ArrowUpRight size={14}/></button>)}</div></section>}
    {item && <section className="evidence-section"><h3>固定证据 <span>{item.evidenceIds.length}</span></h3><EvidenceList data={data} ids={item.evidenceIds}/></section>}
    <div className="detail-end">QUANTAXIS ATLAS · 证据优先，边界清晰</div>
  </div></div>;
}
