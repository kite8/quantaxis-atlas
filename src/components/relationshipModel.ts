import type { AtlasData, AtlasEdge, AtlasNode, Route } from '../model.ts';

export interface NodeRelation {
  edge: AtlasEdge;
  neighbor: AtlasNode;
}

export function getNodeRelations(nodes: AtlasNode[], edges: AtlasEdge[], nodeId: string | null): {
  node: AtlasNode | null;
  incoming: NodeRelation[];
  outgoing: NodeRelation[];
} {
  const nodeIndex = new Map(nodes.map(node => [node.id, node]));
  const node = nodeId === null ? null : nodeIndex.get(nodeId) ?? null;
  const incoming: NodeRelation[] = [];
  const outgoing: NodeRelation[] = [];
  if (!node) return { node, incoming, outgoing };

  for (const edge of edges) {
    const source = nodeIndex.get(edge.source);
    const target = nodeIndex.get(edge.target);
    if (!source || !target) continue;
    if (edge.target === node.id) incoming.push({ edge, neighbor: source });
    if (edge.source === node.id) outgoing.push({ edge, neighbor: target });
  }
  return { node, incoming, outgoing };
}

export function getGraphScope(data: AtlasData, routeId: string | null): {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  route: Route | undefined;
} {
  const route = data.routes.find(item => item.id === routeId);
  const routeNodes = route ? new Set(route.nodeIds) : null;
  const routeEdges = route ? new Set(route.edgeIds) : null;
  const nodes = data.nodes.filter(node => !routeNodes || routeNodes.has(node.id));
  const nodeIds = new Set(nodes.map(node => node.id));
  const edges = data.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    && (!routeEdges || routeEdges.has(edge.id)));
  return { nodes, edges, route };
}

export function getFocusNodeId(nodes: AtlasNode[], _edges: AtlasEdge[], preferred: string | null, route?: Route): string | null {
  const nodeIds = new Set(nodes.map(node => node.id));
  if (preferred !== null && nodeIds.has(preferred)) return preferred;
  const step = route?.steps.find(item => nodeIds.has(item.nodeId));
  if (step) return step.nodeId;
  if (nodeIds.has('data')) return 'data';
  return nodes[0]?.id ?? null;
}
