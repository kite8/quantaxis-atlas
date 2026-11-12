import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getEdgeLabelPositions, getExpandedLabelBounds } from '../src/components/edgeLabelLayout.ts';
import { getGraphPositions } from '../src/components/graphLayout.ts';
import { getGraphScope } from '../src/components/relationshipModel.ts';
import { GRAPH_NODE_GEOMETRY } from '../src/components/graphGeometry.ts';

const data = JSON.parse(readFileSync(new URL('../public/data/atlas.json', import.meta.url), 'utf8'));
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

for (const orientation of ['horizontal', 'vertical']) {
  test(`${orientation}: visible labels avoid nodes, simultaneous labels and the fitted graph boundary`, () => {
    for (const routeId of [null, ...data.routes.map(route => route.id)]) {
      const scope = getGraphScope(data, routeId);
      const nodes = routeId ? scope.nodes : scope.nodes.filter(node => node.overview);
      const edges = scope.edges.filter(edge => nodes.some(node => node.id === edge.source) && nodes.some(node => node.id === edge.target));
      const positions = getGraphPositions(nodes, data.layers, scope.route, orientation);
      const labels = getEdgeLabelPositions(nodes, edges, positions);
      const boxes = [...positions.values()].map(point => ({ ...point, width: GRAPH_NODE_GEOMETRY.width, height: GRAPH_NODE_GEOMETRY.height }));
      const right = Math.max(...boxes.map(box => box.x + box.width));
      const bottom = Math.max(...boxes.map(box => box.y + box.height));
      assert.equal(labels.size, edges.length, routeId);
      assert.equal(getExpandedLabelBounds({ x: 0, y: 0, width: right, height: bottom }, [...labels.values()]), null, 'normal scope retains node-only fitView');
      for (const edge of edges) {
        const label = labels.get(edge.id);
        assert.ok(label.x >= 0 && label.y >= 0 && label.x + label.width <= right && label.y + label.height <= bottom, `${routeId}: ${edge.id} stays inside the existing fit bounds`);
        assert.ok(boxes.every(box => !overlaps(label, box)), `${routeId}: ${edge.id} cannot cover node content`);
      }
      for (const node of nodes) {
        const active = edges.filter(edge => edge.source === node.id || edge.target === node.id);
        for (let a = 0; a < active.length; a++) for (let b = a + 1; b < active.length; b++) {
          assert.equal(overlaps(labels.get(active[a].id), labels.get(active[b].id)), false, `${routeId}: labels shown together for ${node.id}`);
        }
      }
    }
  });
}

test('the reported QASU and QAFetch labels use the first-row whitespace without moving cards', () => {
  const scope = getGraphScope(data, 'research');
  const positions = getGraphPositions(scope.nodes, data.layers, scope.route, 'horizontal');
  const before = new Map(positions);
  const labels = getEdgeLabelPositions(scope.nodes, scope.edges, positions);
  const firstRowBottom = positions.get('fetch').y + GRAPH_NODE_GEOMETRY.height;
  const nextRowTop = positions.get('indicator').y;
  for (const id of ['e-save-fetch-calls', 'e-fetch-data-data']) {
    const label = labels.get(id);
    assert.ok(label.y >= firstRowBottom && label.y + label.height <= nextRowTop, id);
  }
  assert.deepEqual(positions, before);
});

test('filtering the real QASU to QAFetch relation expands fit bounds to include its external label', () => {
  const nodes = data.nodes.filter(node => node.id === 'save' || node.id === 'fetch');
  const edges = data.edges.filter(edge => edge.source === 'save' && edge.target === 'fetch');
  assert.equal(edges.length, 1);
  const positions = getGraphPositions(nodes, data.layers, undefined, 'horizontal');
  const labels = getEdgeLabelPositions(nodes, edges, positions);
  const nodeBounds = { x: 0, y: 0, width: Math.max(...[...positions.values()].map(point => point.x + GRAPH_NODE_GEOMETRY.width)), height: GRAPH_NODE_GEOMETRY.height };
  const expanded = getExpandedLabelBounds(nodeBounds, [...labels.values()]);
  assert.ok(expanded, 'same-row nodes have no internal band tall enough for the complete label');
  for (const rectangle of [nodeBounds, ...labels.values()]) {
    assert.ok(expanded.x <= rectangle.x && expanded.y <= rectangle.y);
    assert.ok(expanded.x + expanded.width >= rectangle.x + rectangle.width);
    assert.ok(expanded.y + expanded.height >= rectangle.y + rectangle.height);
  }
  assert.equal(nodeBounds.height, GRAPH_NODE_GEOMETRY.height, 'does not change node geometry');
});
