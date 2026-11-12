import type { AtlasNode, Layer, Route } from '../model.ts';
import { GRAPH_NODE_GEOMETRY } from './graphGeometry.ts';

const ROUTE_COLUMN_GAP = 64;
const ROUTE_ROW_GAP = 52;
const NODE_GAP = 30;
const GROUP_COLUMN_GAP = 28;
const GROUP_ROW_GAP = 62;

export function getGraphPositions(
  nodes: AtlasNode[],
  layers: Layer[],
  route: Route | undefined,
  layout: 'horizontal' | 'vertical',
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const { width, height } = GRAPH_NODE_GEOMETRY;
  if (route) {
    const nodeIds = new Set(nodes.map(node => node.id));
    const orderedIds = [...new Set([...route.steps.map(step => step.nodeId), ...route.nodeIds, ...nodeIds])];
    const columns = layout === 'horizontal' ? 4 : 2;
    orderedIds.filter(id => nodeIds.has(id)).forEach((id, index) => {
      positions.set(id, { x: (index % columns) * (width + ROUTE_COLUMN_GAP), y: Math.floor(index / columns) * (height + ROUTE_ROW_GAP) });
    });
    return positions;
  }

  const groups = layers.map(layer => nodes.filter(node => node.layer === layer.id)).filter(group => group.length);
  const knownLayers = new Set(layers.map(layer => layer.id));
  const ungrouped = nodes.filter(node => !knownLayers.has(node.layer));
  if (ungrouped.length) groups.push(ungrouped);
  const groupsPerRow = layout === 'horizontal' ? 3 : 1;
  const columnWidth = width + NODE_GAP;
  const rowHeight = height + NODE_GAP;
  let rowY = 0;
  for (let start = 0; start < groups.length; start += groupsPerRow) {
    const rowGroups = groups.slice(start, start + groupsPerRow);
    rowGroups.forEach((group, column) => group.forEach((node, index) => {
      positions.set(node.id, {
        x: column * (columnWidth * 2 + GROUP_COLUMN_GAP) + (index % 2) * columnWidth,
        y: rowY + Math.floor(index / 2) * rowHeight,
      });
    }));
    rowY += Math.max(...rowGroups.map(group => Math.ceil(group.length / 2))) * rowHeight + GROUP_ROW_GAP;
  }
  return positions;
}

export function resizeViewport(
  viewport: { x: number; y: number; zoom: number },
  previous: { width: number; height: number },
  next: { width: number; height: number },
): { x: number; y: number; zoom: number } {
  const dimensions = [previous.width, previous.height, next.width, next.height];
  if (dimensions.some(value => !Number.isFinite(value) || value <= 0)
    || !Number.isFinite(viewport.x) || !Number.isFinite(viewport.y)
    || !Number.isFinite(viewport.zoom) || viewport.zoom <= 0) return viewport;
  return {
    x: viewport.x + (next.width - previous.width) / 2,
    y: viewport.y + (next.height - previous.height) / 2,
    zoom: viewport.zoom,
  };
}
