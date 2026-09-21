// Run with: node --test tests/source-records.cjs
// The source store must work without a DOM, a server, or durable browser storage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash, webcrypto } = require('node:crypto');
const { TextDecoder, TextEncoder } = require('node:util');
const api = require('../src/source-records.js');

const FIXED_TIME = '2026-09-21T10:00:00.000Z';
const NEXT_TIME = '2026-09-21T11:00:00.000Z';
const SAMPLE_IDS = ['sample-policy-v1', 'sample-department-table-v1', 'sample-reply-v1'];
const CONFLICT_IDS = ['sample-conflict-screen-v1', 'sample-conflict-logs-v1'];
const makeStore = (extra = {}) => api.createStore({ now: () => FIXED_TIME, ...extra });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function file(name, body, declaredSize) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  return {
    name,
    size: declaredSize ?? bytes.length,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}
function newest(draft) {
  return [...draft.versions].sort((a, b) => b.version - a.version)[0];
}
function attemptMutation(mutate) {
  // Frozen returned values are also safe; callers must never change store state.
  try { mutate(); } catch (error) { if (!(error instanceof TypeError)) throw error; }
}

test('exports the same public API for CommonJS and direct browser scripts', () => {
  for (const name of ['createStore', 'mount', 'sampleCatalog', 'conflictCatalog', 'citationsFor']) {
    assert.equal(typeof api[name], 'function', name);
  }
  const context = vm.createContext({ window: {}, TextDecoder, TextEncoder, crypto: webcrypto });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/source-records.js'), 'utf8'), context);
  for (const name of ['createStore', 'mount', 'sampleCatalog', 'conflictCatalog', 'citationsFor']) {
    assert.equal(typeof context.window.KnowHowSourceRecords[name], 'function', name);
  }
});

test('catalog offers three readable originals without silently collecting them', () => {
  const store = makeStore();
  assert.deepEqual(store.listRecords(), []);
  assert.deepEqual(store.listDrafts(), []);
  const catalog = api.sampleCatalog();
  assert.deepEqual(catalog.map(record => record.id).sort(), [...SAMPLE_IDS].sort());
  for (const record of catalog) {
    assert.equal(record.sample, true);
    assert.ok(record.rawText.trim(), record.id);
    assert.ok(record.title);
    assert.ok(record.filename);
    assert.ok(record.source.kind);
    assert.ok(record.source.label);
    assert.ok(record.lines.length > 0);
    assert.ok(record.paragraphs.length > 0);
    assert.deepEqual(record.lines.map(line => line.number), record.lines.map((_, index) => index + 1));
    for (const paragraph of record.paragraphs) {
      assert.ok(paragraph.id);
      assert.ok(paragraph.startLine >= 1 && paragraph.endLine <= record.lines.length);
      assert.equal(paragraph.text, record.lines.slice(paragraph.startLine - 1, paragraph.endLine).map(line => line.text).join('\n'));
    }
  }
  assert.deepEqual(store.listRecords(), [], 'previewing the catalog is not collection');
});

test('sample collection preserves hashes, source labels, timestamps, and IDs on repeat', async () => {
  let now = FIXED_TIME;
  const store = makeStore({ now: () => now });
  const first = await store.collectSamples();
  assert.equal(first.length, 3);
  for (const record of first) {
    assert.equal(record.collectedAt, FIXED_TIME);
    assert.equal(record.sha256, sha256(Buffer.from(record.rawText, 'utf8')));
    assert.equal(record.sample, true);
    assert.ok(record.source.label);
  }
  now = NEXT_TIME;
  const second = await store.collectSamples();
  assert.deepEqual(second, first, 'repeated collection must not rewrite provenance');
  assert.equal(store.listRecords().length, 3);
});

test('conflict catalog supplies two uncollected originals about the same target and period', () => {
  const store = makeStore();
  const conflicts = api.conflictCatalog();
  assert.deepEqual(conflicts.map(record => record.id), CONFLICT_IDS);
  assert.deepEqual(api.sampleCatalog().map(record => record.id), SAMPLE_IDS, 'conflict examples must not change the original three-document catalog');
  for (const record of conflicts) {
    assert.equal(record.sample, true);
    assert.equal(record.collectedAt, null);
    assert.equal(record.sha256, null);
    assert.ok(record.source.label.includes('가상') || record.source.label.includes('체험'));
    assert.deepEqual(record.citation, { recordId: record.id, startLine: 4, endLine: 8, label: record.title });
    const excerpt = record.lines.slice(3, 8).map(line => line.text).join('\n');
    assert.match(excerpt, /GS타워.*01.*앱개발팀/);
    assert.match(excerpt, /2026-09-01.*2026-12-31/);
    assert.match(excerpt, /확인되지 않음/);
  }
  assert.match(conflicts[0].rawText, /오류 화면만 제출/);
  assert.match(conflicts[1].rawText, /요청 시각과 오류코드를 반드시 제출/);
  assert.deepEqual(store.listRecords(), []);
  assert.deepEqual(store.listDrafts(), []);
  const before = api.conflictCatalog();
  attemptMutation(() => { conflicts[0].rawText = 'changed'; });
  attemptMutation(() => { conflicts[0].citation.startLine = 999; });
  assert.deepEqual(api.conflictCatalog(), before);
});

test('selected conflict collection and default collection preserve each first intake independently', async () => {
  let now = FIXED_TIME;
  const store = makeStore({ now: () => now });
  const firstConflict = await store.collectSample(CONFLICT_IDS[0]);
  assert.deepEqual(store.listRecords().map(record => record.id), [CONFLICT_IDS[0]]);
  now = NEXT_TIME;
  const defaults = await store.collectSamples();
  assert.deepEqual(defaults.map(record => record.id), SAMPLE_IDS);
  assert.equal(store.listRecords().length, 4);
  assert.ok(defaults.every(record => record.collectedAt === NEXT_TIME));
  now = '2026-09-21T12:00:00.000Z';
  const [secondConflict, duplicate] = await Promise.all([store.collectSample(CONFLICT_IDS[1]), store.collectSample(CONFLICT_IDS[1])]);
  assert.deepEqual(secondConflict, duplicate, 'concurrent intake must preserve a single original');
  assert.equal(store.listRecords().length, 5);
  for (const record of [firstConflict, secondConflict]) {
    assert.equal(record.sha256, sha256(Buffer.from(record.rawText, 'utf8')));
    const excerpt = store.resolveCitation(record.citation);
    assert.ok(excerpt.text.includes('문의 기준:'));
    assert.equal(excerpt.record.sha256, record.sha256);
  }
  const before = store.listRecords();
  now = '2026-09-22T10:00:00.000Z';
  await store.collectSample(CONFLICT_IDS[0]);
  await store.collectSample(CONFLICT_IDS[1]);
  await store.collectSample(SAMPLE_IDS[0]);
  assert.deepEqual(await store.collectSamples(), defaults);
  assert.deepEqual(store.listRecords(), before, 'repeat intake must preserve each first timestamp and original');
});

test('stores have separate in-memory records and drafts', async () => {
  const first = makeStore();
  const second = makeStore();
  await first.collectSamples();
  await first.importFile(file('private.md', '# My local note'));
  assert.deepEqual(second.listRecords(), []);
  assert.deepEqual(second.listDrafts(), []);
});

test('browser collection, import, and correction work without network or durable storage', async () => {
  const calls = [];
  const forbidden = name => () => { calls.push(name); throw new Error(`Unexpected ${name}`); };
  const storage = { getItem: forbidden('storage read'), setItem: forbidden('storage write'), removeItem: forbidden('storage removal') };
  const context = vm.createContext({
    window: { localStorage: storage, sessionStorage: storage },
    localStorage: storage,
    sessionStorage: storage,
    fetch: forbidden('fetch'),
    XMLHttpRequest: forbidden('XMLHttpRequest'),
    TextDecoder,
    TextEncoder,
    crypto: webcrypto,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/source-records.js'), 'utf8'), context);
  const browserStore = context.window.KnowHowSourceRecords.createStore({ now: () => FIXED_TIME });
  await browserStore.collectSamples();
  const record = await browserStore.importFile(file('browser-only.txt', '브라우저에만 남는 메모'));
  const draft = browserStore.listDrafts().find(item => item.recordId === record.id);
  browserStore.reviseDraft(draft.id, { content: '재확인할 메모', reason: '개인 초안 보완' });
  assert.equal(browserStore.getRecord(record.id).rawText, '브라우저에만 남는 메모');
  assert.equal(newest(browserStore.getDraft(draft.id)).content, '재확인할 메모');
  assert.deepEqual(calls, []);
});

test('TXT/MD import preserves source bytes, BOM, CRLF, filename, and collection time', async () => {
  const store = makeStore();
  const rawText = '\uFEFF# 원문 제목\r\n첫 번째 내용\r\n\r\n마지막 내용\r\n';
  const bytes = Buffer.from(rawText, 'utf8');
  const record = await store.importFile(file('담당자 메모.MD', bytes));
  assert.equal(record.rawText, rawText);
  assert.equal(record.filename, '담당자 메모.MD');
  assert.equal(record.sha256, sha256(bytes), 'hash the bytes before decoding or newline handling');
  assert.equal(record.collectedAt, FIXED_TIME);
  assert.equal(record.sample, false);
  assert.ok(record.source.kind);
  assert.ok(record.source.label.includes('담당자 메모.MD'));
  assert.equal(store.getRecord(record.id).rawText, rawText);
  assert.equal(record.lines[1].number, 2);
  assert.equal(record.lines[1].text, '첫 번째 내용');
  assert.equal(record.lines[3].text, '마지막 내용');
});

test('reimporting identical filename and bytes preserves the record and corrected draft', async () => {
  let now = FIXED_TIME;
  const store = makeStore({ now: () => now });
  const bytes = Buffer.from('\uFEFF원문\r\n바이트를 그대로 보존\r\n', 'utf8');
  const original = await store.importFile(file('same.md', bytes));
  const draft = store.listDrafts()[0];
  now = NEXT_TIME;
  store.reviseDraft(draft.id, { content: '재확인할 별도 초안', reason: '원문과 구분해 작성' });
  const corrected = store.getDraft(draft.id);
  assert.deepEqual(await store.importFile(file('same.md', bytes)), original);
  assert.equal(store.listRecords().length, 1);
  assert.deepEqual(store.listDrafts(), [corrected], 'duplicate intake must not overwrite or create a draft');
  const exported = store.originalBytes(original.id);
  assert.deepEqual(Buffer.from(exported), bytes);
  exported.fill(0);
  assert.deepEqual(Buffer.from(store.originalBytes(original.id)), bytes, 'the download byte array must be a defensive copy');
  assert.equal(store.getRecord(original.id).sha256, sha256(bytes));
  const renamed = await store.importFile(file('renamed.md', bytes));
  assert.notEqual(renamed.id, original.id, 'different filenames preserve distinct provenance');
  const changed = await store.importFile(file('same.md', '변경된 원문'));
  assert.notEqual(changed.id, original.id, 'changed source bytes must not replace an existing original');
  assert.deepEqual(store.getRecord(original.id), original);
  assert.deepEqual(store.getDraft(draft.id), corrected);
});

test('a local import creates an unapproved draft linked to its original', async () => {
  const store = makeStore();
  const record = await store.importFile(file('note.txt', '첫째 줄\n둘째 줄'));
  const drafts = store.listDrafts();
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].recordId, record.id);
  assert.ok(drafts[0].citations.length > 0);
  assert.equal(newest(drafts[0]).state, 'draft');
  assert.equal(newest(drafts[0]).content, record.rawText);
  for (const citation of drafts[0].citations) {
    assert.equal(citation.recordId, record.id);
    assert.ok(store.resolveCitation(citation).text);
  }
});

test('line citations resolve the requested source excerpt and its provenance', async () => {
  const store = makeStore();
  const record = await store.importFile(file('lines.txt', '제목\r\n\r\n검토할 내용\r\n담당자 확인\r\n'));
  const resolved = store.resolveCitation({ recordId: record.id, startLine: 3, endLine: 4 });
  assert.equal(resolved.recordId, record.id);
  assert.equal(resolved.startLine, 3);
  assert.equal(resolved.endLine, 4);
  assert.equal(resolved.text, '검토할 내용\n담당자 확인');
  assert.ok(resolved.paragraphIds.length > 0);
  assert.equal(resolved.record.sha256, record.sha256);
  assert.equal(resolved.record.rawText, record.rawText);
});

test('a draft without explicit content uses only its cited lines and preserves the original bytes', async () => {
  const store = makeStore();
  const rawText = '\uFEFF# 원문 제목\r\n선택한 첫 줄\r\n선택한 둘째 줄\r\n인용하지 않은 줄\r\n';
  const bytes = Buffer.from(rawText, 'utf8');
  const record = await store.importFile(file('subset.md', bytes));
  const citation = { recordId: record.id, startLine: 2, endLine: 3 };
  const draft = store.createDraft(citation);
  assert.deepEqual(draft.citations, [citation]);
  assert.equal(newest(draft).content, '선택한 첫 줄\n선택한 둘째 줄');
  assert.equal(newest(draft).content, store.resolveCitation(draft.citations[0]).text);
  const explicit = store.createDraft({ ...citation, content: '따로 작성한 지식 초안' });
  assert.deepEqual(explicit.citations, [citation]);
  assert.equal(newest(explicit).content, '따로 작성한 지식 초안');
  assert.deepEqual(store.getRecord(record.id), record);
  assert.equal(store.getRecord(record.id).rawText, rawText);
  assert.equal(store.getRecord(record.id).sha256, sha256(bytes));
  assert.deepEqual(Buffer.from(store.originalBytes(record.id)), bytes);
});

test('all department/category KB citations resolve to collected sample lines', async () => {
  const store = makeStore();
  await store.collectSamples();
  for (const department of ['app', 'device']) {
    for (const category of ['policy', 'data', 'guide']) {
      for (const version of [1, 2]) {
        const citations = api.citationsFor({ department, category, version });
        assert.ok(Array.isArray(citations) && citations.length > 0, `${department}/${category}/v${version}`);
        for (const citation of citations) {
          assert.ok(SAMPLE_IDS.includes(citation.recordId));
          const resolved = store.resolveCitation(citation);
          assert.ok(resolved.text.trim());
          assert.ok(resolved.paragraphIds.length > 0);
        }
      }
    }
  }
});

test('knowledge corrections append a draft version and never edit original records', async () => {
  let now = FIXED_TIME;
  const store = makeStore({ now: () => now });
  const source = await store.importFile(file('decision.txt', '원문 제목\n첫 판단\n참고 맥락'));
  const original = store.getRecord(source.id);
  const draft = store.createDraft({ recordId: source.id, title: '검토 중인 지식', category: 'policy', content: '첫 판단', startLine: 2, endLine: 2 });
  const first = structuredClone(newest(draft));
  now = NEXT_TIME;
  store.reviseDraft(draft.id, { content: '수정한 판단', reason: '담당자 재확인' });
  const revised = store.getDraft(draft.id);
  assert.equal(revised.versions.length, 2);
  assert.deepEqual(revised.versions.find(version => version.version === first.version), first);
  assert.equal(newest(revised).version, first.version + 1);
  assert.equal(newest(revised).content, '수정한 판단');
  assert.equal(newest(revised).reason, '담당자 재확인');
  assert.equal(newest(revised).createdAt, NEXT_TIME);
  assert.equal(newest(revised).state, 'draft');
  assert.deepEqual(store.getRecord(source.id), original);
  assert.equal(store.resolveCitation(revised.citations[0]).text, '첫 판단');
});

test('invalid references, classification, and blank corrections leave records and drafts intact', async () => {
  const store = makeStore();
  const record = await store.importFile(file('validation.txt', '첫 줄\n둘째 줄'));
  const draft = store.listDrafts()[0];
  const recordsBefore = store.listRecords();
  const draftsBefore = store.listDrafts();
  const invalidRanges = [
    { startLine: 0, endLine: 1 },
    { startLine: 2, endLine: 1 },
    { startLine: 1, endLine: 3 },
    { startLine: 1.5, endLine: 2 },
    { startLine: '1', endLine: 2 },
  ];
  for (const range of invalidRanges) {
    assert.throws(() => store.resolveCitation({ recordId: record.id, ...range }));
    assert.throws(() => store.createDraft({ recordId: record.id, ...range }));
  }
  for (const category of ['unknown', 'toString', 'constructor', '__proto__']) {
    assert.throws(() => api.citationsFor({ department: 'app', category }), `category ${category}`);
    assert.throws(() => store.createDraft({ recordId: record.id, category }), `draft category ${category}`);
  }
  assert.throws(() => api.citationsFor({ department: 'unknown', category: 'guide' }));
  assert.throws(() => store.resolveCitation({ recordId: 'missing', startLine: 1, endLine: 1 }));
  assert.throws(() => store.createDraft({ recordId: record.id, content: ' \n ' }));
  assert.throws(() => store.createDraft({ recordId: record.id, title: ' \n ' }));
  assert.throws(() => store.reviseDraft(draft.id, { content: '새 내용', reason: ' \n ' }));
  assert.throws(() => store.reviseDraft(draft.id, { content: ' \n ', reason: '이유' }));
  await assert.rejects(store.collectSample('missing-sample'));
  assert.deepEqual(store.listRecords(), recordsBefore);
  assert.deepEqual(store.listDrafts(), draftsBefore);
});

test('returned records, citations, and draft histories cannot mutate internal state', async () => {
  const store = makeStore();
  const record = await store.importFile(file('immutable.txt', '원본\n두 번째 줄'));
  const draft = store.listDrafts()[0];
  const originalRecord = store.getRecord(record.id);
  const originalDraft = store.getDraft(draft.id);
  const objects = [record, store.getRecord(record.id), store.listRecords()[0], store.resolveCitation({ recordId: record.id, startLine: 1, endLine: 1 }).record];
  for (const copy of objects) {
    attemptMutation(() => { copy.rawText = 'tampered'; });
    attemptMutation(() => { copy.source.label = 'tampered'; });
    attemptMutation(() => { copy.lines[0].text = 'tampered'; });
    attemptMutation(() => { copy.paragraphs[0].text = 'tampered'; });
  }
  for (const copy of [draft, store.getDraft(draft.id), store.listDrafts()[0]]) {
    attemptMutation(() => { copy.versions[0].content = 'tampered'; });
    attemptMutation(() => { copy.citations[0].recordId = 'missing'; });
  }
  assert.deepEqual(store.getRecord(record.id), originalRecord);
  assert.deepEqual(store.getDraft(draft.id), originalDraft);
  const catalog = api.sampleCatalog();
  const catalogText = catalog[0].rawText;
  attemptMutation(() => { catalog[0].rawText = 'tampered'; });
  assert.equal(api.sampleCatalog()[0].rawText, catalogText);
});

test('unsupported extensions, empty notes, invalid UTF-8, and oversized files are rejected atomically', async () => {
  const store = makeStore();
  const invalid = [
    file('note.html', '<h1>not a TXT or MD file</h1>'),
    file('note', 'extension required'),
    file('empty.txt', ''),
    file('spaces.md', '\uFEFF \r\n\t'),
    file('invalid.txt', Buffer.from([0xc3, 0x28])),
    file('oversized.txt', 'x'.repeat(64 * 1024 + 1)),
    file('dishonest-size.md', 'x'.repeat(64 * 1024 + 1), 1),
  ];
  for (const candidate of invalid) {
    await assert.rejects(store.importFile(candidate), undefined, candidate.name);
    assert.deepEqual(store.listRecords(), [], `${candidate.name} must not leave partial records`);
    assert.deepEqual(store.listDrafts(), [], `${candidate.name} must not leave partial drafts`);
  }
});

test('the 64 KiB import limit applies to bytes and accepts exactly the limit', async () => {
  const store = makeStore();
  const boundary = Buffer.from('x'.repeat(64 * 1024));
  const record = await store.importFile(file('boundary.txt', boundary));
  assert.equal(record.sha256, sha256(boundary));
  assert.equal(record.rawText.length, 64 * 1024);
  await assert.rejects(store.importFile(file('utf8-overflow.md', '한'.repeat(22 * 1024))));
  assert.equal(store.listRecords().length, 1);
});

test('HTML-like imported text stays literal in the original and draft content', async () => {
  const store = makeStore();
  const rawText = '<script>globalThis.sourceInjection = true</script>\n<img src=x onerror=alert(1)>\n& < > "';
  const record = await store.importFile(file('unsafe-markup.md', rawText));
  assert.equal(record.rawText, rawText);
  assert.equal(record.sha256, sha256(Buffer.from(rawText)));
  assert.equal(newest(store.listDrafts()[0]).content, rawText);
  assert.equal(globalThis.sourceInjection, undefined);
});
