// Controller regressions with an in-memory API. No external requests or AI calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const src = path.join(__dirname, '..', 'src');
const schema = [{ name: 'phone', type: 'string' }];
const dataset = id => ({ id, name: id, schema, layer: 'raw', row_count: 1 });
const preview = (id, value) => ({ dataset: dataset(id), schema, rows: [{ phone: value }], total: 1 });
const ok = value => ({ ok: true, status: 200, json: async () => value });

function fixture() {
  const calls = [];
  let reply = async url => ok(preview(url.split('/datasets/')[1]?.split('/')[0] || 'raw-B', 'B_RAW'));
  const context = vm.createContext({
    window: { KNOWHOW_CONFIG: { dataApiBase: 'https://fixture.invalid/data-platform' } },
    AbortSignal, URLSearchParams,
    crypto: { randomUUID: () => 'fixture-key' },
    setTimeout: () => 1, clearTimeout: () => {},
    document: { hidden: false }, location: { hash: '' },
    fetch: async (url, options) => { calls.push({ url, options }); return reply(url, options); }
  });
  vm.runInContext(fs.readFileSync(path.join(src, 'data-review-ui.js'), 'utf8'), context);
  const source = fs.readFileSync(path.join(src, 'data-platform.js'), 'utf8');
  assert.ok(source.includes('getState:()=>state,request'), 'test instrumentation point is available');
  vm.runInContext(source.replace('getState:()=>state,request',
    'getState:()=>state,request,selectDataset,startSource,review,resetScope,finishJob'), context);
  const controller = context.window.KnowHowDataPlatform.createController();
  controller.getState().session = { access_token: 'private-visitor-token' };
  const host = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  return { controller, state: controller.getState(), host, calls, setReply: value => { reply = value; } };
}

function completedTransform(state) {
  const job = { id: 'transform-A', kind: 'transform', state: 'succeeded', dataset_id: 'clean-A' };
  Object.assign(state, {
    dataset: dataset('clean-A'), preview: preview('clean-A', 'A_MASKED'),
    job, jobFlow: 'transform', transformInput: { dataset: dataset('raw-A') },
    reviewResult: { before: preview('raw-A', 'A_RAW'), after: preview('clean-A', 'A_MASKED'), job, state: 'succeeded' },
    quality: { dataset: dataset('clean-A'), rows: [{ phone: 'A_ERROR' }] },
    lineage: { nodes: [dataset('raw-A')] }
  });
}

test('selecting another dataset cannot show the previous transform or its before/after rows', async () => {
  const f = fixture();
  completedTransform(f.state);
  await f.controller.selectDataset('raw-B');
  f.controller.mount(f.host, { section: 'privacy' });
  assert.equal(f.state.dataset.id, 'raw-B');
  assert.equal(f.state.reviewResult, null);
  assert.doesNotMatch(f.host.innerHTML, /A_RAW|A_MASKED/);
  assert.match(f.host.innerHTML, /B_RAW/);
  assert.equal(f.state.quality, null);
  assert.equal(f.state.lineage, null);
  f.controller.destroy();
});

test('a failed dataset preview never pairs the new dataset with the old rows', async () => {
  const f = fixture();
  f.state.dataset = dataset('raw-A');
  f.state.preview = preview('raw-A', 'A_RAW');
  f.state.datasets = [dataset('raw-A'), dataset('raw-B')];
  f.setReply(async () => ({ ok: false, status: 503, json: async () => ({ error: 'preview unavailable' }) }));
  await assert.rejects(f.controller.selectDataset('raw-B'), /preview unavailable/);
  assert.ok(!f.state.preview || f.state.preview.dataset.id === f.state.dataset?.id,
    'a failed request must clear the preview or retain its matching selected dataset');
  f.controller.mount(f.host, { section: 'intake' });
  if (f.state.dataset?.id === 'raw-B') assert.doesNotMatch(f.host.innerHTML, /A_RAW/);
  f.controller.destroy();
});

test('a new URL intake discards all previous transform comparisons', async () => {
  const f = fixture();
  completedTransform(f.state);
  f.state.capabilities = { features: {} };
  f.setReply(async url => ok(url.includes('/jobs?') ? { jobs: [] }
    : url.includes('/datasets?') ? { datasets: [] }
    : { id: 'new-source', kind: 'source', state: 'running', stage: 'download' }));
  await f.controller.startSource('https://public.invalid/data.csv', 'file');
  assert.equal(f.state.dataset, null);
  assert.equal(f.state.preview, null);
  assert.equal(f.state.reviewResult, null);
  assert.equal(f.state.transformInput, null);
  assert.equal(f.state.jobFlow, 'discover');
  assert.ok(f.calls.every(call => call.url.includes('/visitor/') && call.options.headers.Authorization === 'Bearer private-visitor-token'));
});

test('a terminal discovery can recover after its result refresh temporarily fails', async () => {
  const f = fixture();
  f.state.job = { id: 'discovery-A', state: 'succeeded', result: {
    source_id: 'source-A', format: 'html', tables: [{ index: 0, caption: 'Actual source table' }]
  } };
  f.state.jobFlow = 'discover';
  f.setReply(async () => ({ ok: false, status: 503, json: async () => ({ error: 'temporary failure' }) }));
  await assert.rejects(f.controller.finishJob(), /temporary failure/);
  assert.equal(f.state.source, null);
  f.setReply(async url => ok(url.includes('/jobs?') ? { jobs: [] } : { datasets: [] }));
  await f.controller.finishJob();
  assert.equal(f.state.source?.source_id, 'source-A');
  assert.equal(f.state.source?.tables.length, 1);
  assert.equal(f.state.dataset, null, 'discovery recovery cannot claim RAW storage');
  assert.equal(f.calls.filter(call => call.options.method === 'POST').length, 0,
    'HTML still requires the visitor to select a source table');
});

test('AI review sends only the explicit command, never source rows or original column contents', async () => {
  const f = fixture();
  f.state.dataset = dataset('raw-A');
  f.state.preview = preview('raw-A', 'PRIVATE_RAW_VALUE');
  f.setReply(async () => ok({ id: 'review-A', kind: 'privacy_review', state: 'queued' }));
  await f.controller.review(true);
  assert.equal(f.calls.length, 1);
  const call = f.calls[0];
  assert.equal(call.url, 'https://fixture.invalid/data-platform/visitor/datasets/raw-A/privacy-review');
  assert.equal(call.options.headers.Authorization, 'Bearer private-visitor-token');
  assert.deepEqual(JSON.parse(call.options.body), { generate: true });
  assert.doesNotMatch(call.options.body, /PRIVATE_RAW_VALUE|phone/);
});

test('switching to shared samples clears private display state and never sends the visitor token there', async () => {
  const f = fixture();
  completedTransform(f.state);
  f.state.datasets = [f.state.dataset];
  f.controller.resetScope('demo');
  await f.controller.request('/demo/datasets');
  assert.equal(f.calls[0].options.headers.Authorization, undefined);
  assert.equal(f.state.dataset, null);
  assert.equal(f.state.preview, null);
  assert.equal(f.state.reviewResult, null);
  assert.equal(f.state.datasets.length, 0);
  f.controller.resetScope('visitor');
  await f.controller.request('/visitor/datasets');
  assert.equal(f.calls[1].options.headers.Authorization, 'Bearer private-visitor-token');
});

test('queued discovery renders before any dataset identity or source metadata exists', () => {
  const f = fixture();
  Object.assign(f.state, { job: {id:'source-queued',kind:'source_discovery',state:'queued',dataset_id:null,result:null}, jobFlow:'discover' });
  assert.doesNotThrow(() => f.controller.mount(f.host, {section:'intake'}));
  assert.match(f.host.innerHTML, /DB 저장 확인/);
  assert.doesNotMatch(f.host.innerHTML, /DB 저장 완료/);
  f.controller.destroy();
});

test('a succeeded intake job cannot show verified RAW completion without original metadata', async () => {
  const f = fixture();
  Object.assign(f.state, {job:{id:'bad-raw',state:'succeeded',dataset_id:'raw-A'},jobFlow:'ingest'});
  f.setReply(async url => ok(url.includes('/jobs?') ? {jobs:[]} : url.includes('/datasets?') ? {datasets:[]} : preview('raw-A','A_RAW')));
  await assert.rejects(f.controller.finishJob(), /원본 보존 정보/);
  f.controller.mount(f.host,{section:'intake'});
  assert.equal(f.state.rawDataset,null);
  assert.equal(f.state.dataset,null);
  assert.doesNotMatch(f.host.innerHTML,/DB 저장 완료|A_RAW/);
  assert.match(f.host.innerHTML,/저장 결과 확인 중/);
  f.controller.destroy();
});

test('review completion resolves its pointer under current permissions instead of cached job text', async () => {
  const f=fixture();
  Object.assign(f.state,{job:{id:'review-job',state:'succeeded',result:{review_id:'r1',policies:[{content:'STALE_POLICY'}]}},jobFlow:'review'});
  f.setReply(async url=>ok(url.includes('/jobs?')?{jobs:[]}:url.includes('/datasets?')?{datasets:[]}:{review_id:'r1',proposals:[],policies:[{content:'CURRENT_POLICY'}]}));
  await f.controller.finishJob();
  assert.ok(f.calls.some(c=>c.url.endsWith('/privacy-reviews/r1')));
  assert.equal(f.state.policies[0].content,'CURRENT_POLICY');
  assert.doesNotMatch(JSON.stringify(f.state.proposal),/STALE_POLICY/);
});
