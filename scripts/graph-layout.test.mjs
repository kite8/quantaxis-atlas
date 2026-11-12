import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getGraphPositions, resizeViewport } from '../src/components/graphLayout.ts';
import { GRAPH_NODE_GEOMETRY } from '../src/components/graphGeometry.ts';
import { getGraphScope } from '../src/components/relationshipModel.ts';

const data = JSON.parse(readFileSync(new URL('../public/data/atlas.json', import.meta.url), 'utf8'));
const { width, height } = GRAPH_NODE_GEOMETRY;
function assertCompleteNonoverlapping(nodes, positions) {
  assert.equal(positions.size, nodes.length);
  for (const node of nodes) {
    const point = positions.get(node.id);
    assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y), node.id);
  }
  const points = [...positions];
  for (let a = 0; a < points.length; a++) {
    for (let b = a + 1; b < points.length; b++) {
      const [firstId, first] = points[a];
      const [secondId, second] = points[b];
      const overlaps = first.x < second.x + width && first.x + width > second.x
        && first.y < second.y + height && first.y + height > second.y;
      assert.equal(overlaps, false, `${firstId} overlaps ${secondId}`);
    }
  }
}
function extent(positions) {
  return { width: Math.max(...[...positions.values()].map(point => point.x + width)),
    height: Math.max(...[...positions.values()].map(point => point.y + height)) };
}

for (const layout of ['horizontal', 'vertical']) {
  test(`${layout}: all 59 nodes and overview nodes have unique nonoverlapping positions`, () => {
    for (const nodes of [data.nodes, data.nodes.filter(node => node.overview)]) {
      assertCompleteNonoverlapping(nodes, getGraphPositions(nodes, data.layers, undefined, layout));
    }
  });
  for (const route of data.routes) {
    test(`${layout}: ${route.id} assigns every route node without overlap`, () => {
      const scope = getGraphScope(data, route.id);
      assertCompleteNonoverlapping(scope.nodes, getGraphPositions(scope.nodes, data.layers, route, layout));
    });
  }
}

test('filtered route nodes retain teaching order and compact into horizontal or vertical columns', () => {
  const route = data.routes.find(item => item.id === 'research');
  const nodes = ['analysis', 'py-factor', 'indicator', 'data', 'fetch'].map(id => data.nodes.find(node => node.id === id));
  const horizontal = getGraphPositions(nodes, data.layers, route, 'horizontal');
  const vertical = getGraphPositions(nodes, data.layers, route, 'vertical');
  assert.deepEqual([...horizontal.keys()], ['fetch', 'data', 'indicator', 'py-factor', 'analysis']);
  assert.deepEqual([...vertical.keys()], [...horizontal.keys()]);
  assert.deepEqual(horizontal.get('fetch'), { x: 0, y: 0 });
  assert.deepEqual(horizontal.get('py-factor'), { x: 3 * (width + 64), y: 0 });
  assert.deepEqual(horizontal.get('analysis'), { x: 0, y: height + 52 });
  assert.deepEqual(vertical.get('indicator'), { x: 0, y: height + 52 });
  assert.deepEqual(vertical.get('analysis'), { x: 0, y: 2 * (height + 52) });
});

test('vertical layout is narrower and taller for complete overview and a multirow route', () => {
  const route = data.routes.find(item => item.id === 'realtime');
  for (const scope of [{ nodes: data.nodes.filter(node => node.overview), route: undefined }, getGraphScope(data, route.id)]) {
    const horizontal = extent(getGraphPositions(scope.nodes, data.layers, scope.route, 'horizontal'));
    const vertical = extent(getGraphPositions(scope.nodes, data.layers, scope.route, 'vertical'));
    assert.ok(vertical.width < horizontal.width);
    assert.ok(vertical.height > horizontal.height);
  }
});

test('node interaction metadata and fresh object identities cannot move the layout', () => {
  const changedNodes = data.nodes.map(node => ({ ...node, selected: true, hovered: true, role: `${node.role} refreshed` }));
  for (const layout of ['horizontal', 'vertical']) {
    assert.deepEqual(getGraphPositions(changedNodes, data.layers, undefined, layout), getGraphPositions(data.nodes, data.layers, undefined, layout));
  }
});

test('empty inputs and unknown layer nodes are positioned safely', () => {
  assert.equal(getGraphPositions([], data.layers, undefined, 'vertical').size, 0);
  const nodes = [...data.nodes, { ...data.nodes[0], id: 'new-layer-node', layer: 'new-layer' }];
  assertCompleteNonoverlapping(nodes, getGraphPositions(nodes, data.layers, undefined, 'horizontal'));
});

const graphCenter = (viewport, size) => ({ x: (size.width / 2 - viewport.x) / viewport.zoom,
  y: (size.height / 2 - viewport.y) / viewport.zoom });
function assertNearPoint(actual, expected) {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-9);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-9);
}

test('resizing keeps the same graph coordinate at center at every zoom without mutating inputs', () => {
  const previous = Object.freeze({ width: 390, height: 620 });
  const next = Object.freeze({ width: 844, height: 390 });
  for (const zoom of [0.12, 0.65, 1, 1.8]) {
    const viewport = Object.freeze({ x: -140, y: 73, zoom });
    const result = resizeViewport(viewport, previous, next);
    assertNearPoint(graphCenter(result, next), graphCenter(viewport, previous));
    assert.equal(result.zoom, zoom);
    assert.deepEqual(viewport, { x: -140, y: 73, zoom });
  }
});

test('repeated portrait and landscape changes preserve zoom and return to the original viewport', () => {
  const portrait = { width: 390, height: 620 };
  const landscape = { width: 844, height: 390 };
  const original = { x: -44.5, y: 19.25, zoom: 0.73 };
  let viewport = original;
  for (let index = 0; index < 20; index++) {
    viewport = resizeViewport(viewport, portrait, landscape);
    viewport = resizeViewport(viewport, landscape, portrait);
  }
  assertNearPoint(viewport, original);
  assert.equal(viewport.zoom, original.zoom);
});

test('zero or invalid container dimensions and invalid viewports return the original viewport', () => {
  const viewport = Object.freeze({ x: 10, y: -20, zoom: 0.8 });
  const valid = { width: 390, height: 620 };
  for (const value of [0, -1, NaN, Infinity]) {
    for (const size of [{ width: value, height: 620 }, { width: 390, height: value }]) {
      assert.strictEqual(resizeViewport(viewport, size, valid), viewport);
      assert.strictEqual(resizeViewport(viewport, valid, size), viewport);
    }
  }
  for (const invalid of [{ ...viewport, zoom: 0 }, { ...viewport, zoom: -1 }, { ...viewport, zoom: NaN }, { ...viewport, x: Infinity }, { ...viewport, y: NaN }]) {
    assert.strictEqual(resizeViewport(invalid, valid, valid), invalid);
  }
});
