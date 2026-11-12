import type { AtlasEdge, AtlasNode } from '../model.ts';
import { GRAPH_NODE_GEOMETRY } from './graphGeometry.ts';

export interface EdgeLabelBox { x: number; y: number; width: number; height: number }
const LABEL_WIDTH = 216;
const CLEARANCE = 4;
const overlaps = (a: EdgeLabelBox, b: EdgeLabelBox) => a.x < b.x + b.width + CLEARANCE
  && a.x + a.width + CLEARANCE > b.x && a.y < b.y + b.height + CLEARANCE && a.y + a.height + CLEARANCE > b.y;

export function getExpandedLabelBounds(nodeBounds: EdgeLabelBox, labels: EdgeLabelBox[]): EdgeLabelBox | null {
  let left = nodeBounds.x, top = nodeBounds.y;
  let right = left + nodeBounds.width, bottom = top + nodeBounds.height;
  for (const label of labels) {
    left = Math.min(left, label.x); top = Math.min(top, label.y);
    right = Math.max(right, label.x + label.width); bottom = Math.max(bottom, label.y + label.height);
  }
  if (left === nodeBounds.x && top === nodeBounds.y && right === nodeBounds.x + nodeBounds.width
    && bottom === nodeBounds.y + nodeBounds.height) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// Allocate all visible edges, not just highlighted ones: entering a label must
// never move it as node preview changes to edge preview.
export function getEdgeLabelPositions(nodes: AtlasNode[], edges: AtlasEdge[], positions: Map<string, { x: number; y: number }>): Map<string, EdgeLabelBox> {
  const result = new Map<string, EdgeLabelBox>();
  const nodeBoxes = nodes.flatMap(node => {
    const point = positions.get(node.id);
    return point ? [{ ...point, width: GRAPH_NODE_GEOMETRY.width, height: GRAPH_NODE_GEOMETRY.height }] : [];
  });
  if (!nodeBoxes.length) return result;
  const placed: { edge: AtlasEdge; box: EdgeLabelBox }[] = [];
  const bounds = {
    left: Math.min(...nodeBoxes.map(box => box.x)), right: Math.max(...nodeBoxes.map(box => box.x + box.width)),
    top: Math.min(...nodeBoxes.map(box => box.y)), bottom: Math.max(...nodeBoxes.map(box => box.y + box.height)),
  };
  const length = (edge: AtlasEdge) => {
    const source = positions.get(edge.source), target = positions.get(edge.target);
    return source && target ? (source.x - target.x) ** 2 + (source.y - target.y) ** 2 : Infinity;
  };
  for (const edge of [...edges].sort((a, b) => length(a) - length(b) || a.id.localeCompare(b.id))) {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) continue;
    // Only incident edges can show labels together for a highlighted node.
    const occupied: EdgeLabelBox[] = [...nodeBoxes, ...placed.filter(item =>
      item.edge.source === edge.source || item.edge.target === edge.source
      || item.edge.source === edge.target || item.edge.target === edge.target).map(item => item.box)];
    const anchor = { x: (source.x + GRAPH_NODE_GEOMETRY.width + target.x) / 2,
      y: (source.y + target.y + GRAPH_NODE_GEOMETRY.height) / 2 };
    const textWidth = [...edge.label].reduce((sum, character) => sum + (character.charCodeAt(0) < 128 ? 8 : 14), 0);
    const height = Math.max(1, Math.ceil(textWidth / 174)) * 22 + 18;
    const xValues = new Set([anchor.x - LABEL_WIDTH / 2, bounds.left, bounds.right - LABEL_WIDTH]);
    const yValues = new Set([anchor.y - height / 2]);
    for (const box of occupied) {
      xValues.add(box.x - LABEL_WIDTH - CLEARANCE);
      xValues.add(box.x + box.width + CLEARANCE);
      xValues.add(box.x + (box.width - LABEL_WIDTH) / 2);
      yValues.add(box.y - height - CLEARANCE);
      yValues.add(box.y + box.height + CLEARANCE);
    }
    const candidates = [...xValues].flatMap(x => [...yValues].map(y => {
      const box = { x, y, width: LABEL_WIDTH, height };
      const distance = (x + LABEL_WIDTH / 2 - anchor.x) ** 2 + (y + height / 2 - anchor.y) ** 2;
      const outside = x < bounds.left || x + LABEL_WIDTH > bounds.right || y < bounds.top || y + height > bounds.bottom;
      return { box, score: distance + (outside ? 1_000_000_000 : 0) };
    })).sort((a, b) => a.score - b.score);
    const chosen = candidates.find(candidate => !occupied.some(box => overlaps(candidate.box, box)))?.box;
    if (chosen) { result.set(edge.id, chosen); placed.push({ edge, box: chosen }); }
  }
  return result;
}
