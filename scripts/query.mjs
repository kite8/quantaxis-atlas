import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../public/data/atlas.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const option = flag => args.includes(flag) ? (args[args.indexOf(flag) + 1] ?? '') : null;
const selected = {};
const fields = {'--node':'nodes', '--repo':'repos', '--route':'routes', '--event':'events'};
const match = (item, q) => JSON.stringify(item).toLocaleLowerCase().includes(q.toLocaleLowerCase());
for (const [flag, key] of Object.entries(fields)) {
  const query = option(flag);
  if (query !== null) selected[key] = data[key].filter(item => match(item, query));
}
const search = option('--search');
if (search !== null) for (const key of ['nodes','edges','routes','repos','events','pdfCapabilities']) selected[key] = data[key].filter(item => match(item, search));
if (args.includes('--gaps')) {
  selected.nodes = data.nodes.filter(item => ['unresolved','partial','concept','external'].includes(item.status.source) || ['partial','placeholder','unknown'].includes(item.status.implementation));
  selected.pdfCapabilities = data.pdfCapabilities.filter(item => item.gaps.length);
}
if (!Object.keys(selected).length) {
  selected.meta = data.meta;
  selected.counts = Object.fromEntries(['nodes','edges','routes','repos','events','pdfCapabilities','evidence'].map(key => [key, data[key].length]));
  selected.routes = data.routes.map(({id,title,question}) => ({id,title,question}));
}
if (args.includes('--with-evidence')) {
  const ids = new Set(Object.values(selected).flatMap(items => Array.isArray(items) ? items.flatMap(item => item.evidenceIds ?? []) : []));
  selected.evidence = data.evidence.filter(item => ids.has(item.id));
}
console.log(JSON.stringify(selected, null, 2));
