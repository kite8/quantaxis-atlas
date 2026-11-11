export type SourceState = 'public' | 'partial' | 'unresolved' | 'concept' | 'external';
export type EdgeKind = 'calls' | 'data' | 'protocol' | 'concept' | 'lineage' | 'unresolved';
export interface Layer { id: string; label: string; description: string }
export interface AtlasNode {
  id: string; label: string; kind: string; repoIds: string[]; layer: string;
  role: string; why: string; implementation: string[]; boundaries: string[];
  status: {source: SourceState; implementation: string; wiring: string; era: string};
  evidenceIds: string[]; topics: string[]; overview: boolean;
}
export interface AtlasEdge {
  id: string; source: string; target: string; kind: EdgeKind; label: string;
  description: string; evidenceIds: string[]; routeIds: string[];
}
export interface Route {
  id: string; title: string; short: string; question: string; summary: string;
  nodeIds: string[]; edgeIds: string[];
  steps: {nodeId: string; label: string; why: string}[];
  limitations: string[]; evidenceIds: string[];
}
export interface Repository {
  id: string; name: string; commit: string; url: string; role: string; scope: string;
  era: string; publicState: SourceState; headChecked: boolean; limitations: string[];
  nodeIds: string[]; evidenceIds: string[];
}
export interface HistoryEvent {
  id: string; date: string; year: number; title: string; summary: string; meaning: string;
  limitations: string[]; repoIds: string[]; nodeIds: string[]; evidenceIds: string[];
  commit?: string; authorDate?: string; type: string;
}
export interface Capability {
  id: string; title: string; pages: number[]; summary: string; nodeIds: string[];
  publicFinding: string; gaps: string[]; classification: string; evidenceIds: string[];
}
export interface Evidence {
  id: string; title: string; url?: string | null; type: string;
  repoId?: string; commit?: string; path?: string; note?: string;
  availability?: 'public' | 'not_published';
}
export interface AtlasData {
  schemaVersion: string;
  meta: {title: string; subtitle: string; asOf: string; guideVersion: number;
    researchScope: string; limitations: string[]; reportLinks: {label: string; url?: string | null}[];
    pdf: {title: string; url?: string | null; pages: number};
    publicationNote?: string; counts?: Record<string, number>};
  layers: Layer[]; routes: Route[]; nodes: AtlasNode[]; edges: AtlasEdge[];
  repos: Repository[]; events: HistoryEvent[]; pdfCapabilities: Capability[];
  evidence: Evidence[]; glossary: {term: string; meaning: string}[];
}
export const SOURCE_LABELS: Record<SourceState, string> = {
  public: '源码公开', partial: '部分公开', unresolved: '未取得源码',
  concept: '概念范围', external: '第三方边界',
};
export const SOURCE_COLORS: Record<SourceState, string> = {
  public: '#16806a', partial: '#b87c16', unresolved: '#747e90', concept: '#8563b8', external: '#357da7',
};
export const EDGE_LABELS: Record<EdgeKind, string> = {
  calls: '实现调用', data: '数据流', protocol: '协议交互', concept: '概念对应', lineage: '历史传承', unresolved: '未解析依赖',
};
export const IMPLEMENTATION_LABELS: Record<string, string> = {
  implemented:'存在实现', partial:'部分实现', placeholder:'存在占位', unknown:'尚未确认', concept:'概念范围',
};
export const WIRING_LABELS: Record<string, string> = {
  entry:'存在入口', library:'库接口', mixed:'混合装配', external:'外部依赖', unknown:'尚未确认', concept:'概念对应',
};
export const ROUTE_COLORS: Record<string, string> = {
  research:'#4267bd', realtime:'#168477', exchange:'#b57140', storage:'#7965b7', factor:'#4c8d6a', 'exchange-data':'#4a829b',
};
export const REPOSITORY_URL = 'https://github.com/kite8/quantaxis-atlas';
export const matches = (value: unknown, query: string) => !query.trim() || JSON.stringify(value).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
