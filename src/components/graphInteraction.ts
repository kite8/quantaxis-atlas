import type { AtlasEdge, AtlasNode } from '../model.ts';

export type GraphPreview = { kind: 'node' | 'edge'; id: string } | null;

export function resolveGraphHighlight(
  nodes: AtlasNode[],
  edges: AtlasEdge[],
  pinnedNodeId: string | null,
  preview: GraphPreview,
  allowHover: boolean,
): { nodeId: string | null; edgeId: string | null; connectedIds: Set<string> } {
  const nodeIds = new Set(nodes.map(node => node.id));
  const validEdges = edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  let nodeId = pinnedNodeId !== null && nodeIds.has(pinnedNodeId) ? pinnedNodeId : null;

  if (allowHover && preview) {
    if (preview.kind === 'edge') {
      const edge = validEdges.find(item => item.id === preview.id);
      if (edge) return { nodeId: null, edgeId: edge.id, connectedIds: new Set([edge.source, edge.target]) };
    } else if (nodeIds.has(preview.id)) {
      nodeId = preview.id;
    }
  }

  const connectedIds = new Set<string>();
  if (nodeId !== null) {
    connectedIds.add(nodeId);
    for (const edge of validEdges) {
      if (edge.source === nodeId || edge.target === nodeId) {
        connectedIds.add(edge.source);
        connectedIds.add(edge.target);
      }
    }
  }
  return { nodeId, edgeId: null, connectedIds };
}

export function canPreviewPointer(event: { pointerType?: string; buttons: number }, hoverCapable: boolean): boolean {
  return hoverCapable && event.pointerType === 'mouse' && event.buttons === 0;
}
