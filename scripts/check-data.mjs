import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const data = JSON.parse(await readFile(new URL('../public/data/atlas.json', import.meta.url), 'utf8'));
const keys = ['layers', 'nodes', 'edges', 'routes', 'repos', 'events', 'pdfCapabilities', 'evidence'];
const maps = Object.fromEntries(keys.map(key => {
  assert(Array.isArray(data[key]) && data[key].length, `${key}: empty collection`);
  const map = new Map(data[key].map(item => [item.id, item]));
  assert.equal(map.size, data[key].length, `${key}: duplicate ID`);
  return [key, map];
}));
function refs(item, field, target) {
  for (const id of item[field] ?? []) assert(maps[target].has(id), `${item.id}: unknown ${field} ${id}`);
}
for (const key of ['nodes', 'edges', 'routes', 'repos', 'events', 'pdfCapabilities']) {
  for (const item of data[key]) {
    assert(item.evidenceIds?.length, `${item.id}: evidence required`);
    refs(item, 'evidenceIds', 'evidence');
  }
}
for (const node of data.nodes) {
  assert(maps.layers.has(node.layer), `${node.id}: unknown layer`);
  refs(node, 'repoIds', 'repos');
}
for (const edge of data.edges) {
  assert(maps.nodes.has(edge.source) && maps.nodes.has(edge.target), `${edge.id}: missing endpoint`);
  refs(edge, 'routeIds', 'routes');
}
for (const route of data.routes) {
  refs(route, 'nodeIds', 'nodes');
  refs(route, 'edgeIds', 'edges');
  for (const id of route.edgeIds) {
    const edge = maps.edges.get(id);
    assert(route.nodeIds.includes(edge.source) && route.nodeIds.includes(edge.target), `${route.id}: endpoint outside route`);
  }
}
for (const key of ['repos', 'events', 'pdfCapabilities']) {
  for (const item of data[key]) refs(item, 'nodeIds', 'nodes');
}
for (const item of data.events) refs(item, 'repoIds', 'repos');
for (const item of data.repos) assert(/^[a-f0-9]{40}$/.test(item.commit), `${item.id}: full commit SHA required`);
for (const item of data.evidence) {
  if (item.availability === 'not_published') {
    assert.equal(item.url, null, `${item.id}: unpublished materials must not expose a URL`);
    continue;
  }
  assert(item.url, `${item.id}: public evidence requires a URL`);
  const url = new URL(item.url);
  assert(url.protocol === 'https:' && ['github.com', 'api.github.com'].includes(url.hostname), `${item.id}: unexpected evidence host`);
  if (['source', 'commit'].includes(item.type)) {
    assert(/\/(?:blob|tree|commit|git\/trees|git\/blobs|commits)\/[a-f0-9]{40}(?:\/|\?|#|$)/.test(item.url), `${item.id}: evidence is not pinned`);
  }
}
const serialized = JSON.stringify(data);
const privateMarkers = [
  /chatgpt\.com\/library|oai-library:|libfile_|account_id=personal/i,
  /\b[A-Z]:[\\/]|\/(?:Users|home|workspace)\//i,
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/,
  /github_pat_|gh[pousr]_[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]+|-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
for (const marker of privateMarkers) assert(!marker.test(serialized), 'Public data contains a private marker');
assert(!data.evidence.some(item => item.type === 'user_quote'), 'Private conversations are excluded from public data');
console.log(JSON.stringify({status: 'passed', counts: Object.fromEntries(keys.map(key => [key, data[key].length])), publicEvidence: data.evidence.filter(item => item.availability === 'public').length}, null, 2));
