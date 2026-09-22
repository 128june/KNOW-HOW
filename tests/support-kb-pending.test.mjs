import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/support-kb-pending.js', import.meta.url), 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(source, context);
const { renderCandidates, renderBadge } = context.window.KnowHowSupportPending;
const candidate = {
  id: 'candidate-1', kb_id: 'INTAKE-001', kb_version: 1,
  field: 'error_code', value: '연결 요청 후 E-NEW 표시', status: 'pending',
  status_label: '확정 전', source: { kind: 'manual_input', label: '직접 입력' },
  created_at: '2026-09-22T05:00:00+00:00', author: '상담사 · 시연 역할', role: 'counselor'
};

test('pending content retains visible status, source and exact KB version', () => {
  const html = renderCandidates([candidate]);
  assert.match(html, /aria-label="확정 전 KB 추가 내용"/);
  assert.match(html, /data-pending-status="pending">확정 전/);
  assert.match(html, /담당자 확인 전인 내용/);
  assert.match(html, /직접 입력 · 내용 확인 전/);
  assert.match(html, /INTAKE-001 · v1/);
  assert.match(html, /상담사 · 시연 역할/);
  assert.match(html, /연결 요청 후 E-NEW 표시/);
  assert.doesNotMatch(html, /<button|확정됨|실제 오류표/);
});

test('confirmed, absent and unknown statuses never become pending candidates', () => {
  const html = renderCandidates([
    { ...candidate, status: 'confirmed', value: 'CONFIRMED' },
    { ...candidate, status: 'published', value: 'PUBLISHED' },
    { ...candidate, status: undefined, value: 'MISSING' },
    { ...candidate, status: 'unexpected', value: 'UNKNOWN' }
  ]);
  assert.match(html, /표시할 확정 전 내용이 없습니다/);
  assert.doesNotMatch(html, /CONFIRMED|PUBLISHED|MISSING|UNKNOWN|data-pending-id/);
});

test('KB, immutable version and field filters keep neighboring candidates apart', () => {
  const html = renderCandidates([
    candidate,
    { ...candidate, id: 'other-kb', kb_id: 'APP-001', value: 'OTHER_KB' },
    { ...candidate, id: 'other-version', kb_version: 2, value: 'OTHER_VERSION' },
    { ...candidate, id: 'other-field', field: 'symptom', value: 'OTHER_FIELD' }
  ], { kbId: 'INTAKE-001', kbVersion: 1, field: 'error_code' });
  assert.match(html, /data-pending-id="candidate-1"/);
  assert.doesNotMatch(html, /OTHER_KB|OTHER_VERSION|OTHER_FIELD/);
  assert.match(html, /<span>1건<\/span>/);
});

test('selectable records expose only candidate ids and never a promotion action', () => {
  const html = renderCandidates([candidate], { selectable: true, busy: true });
  assert.match(html, /<button type="button"[^>]*data-pending-candidate="candidate-1"[^>]* disabled>확정 전 내용 선택<\/button>/);
  assert.doesNotMatch(html, /data-action=|confirm|promote|publish|onclick/);
  assert.doesNotMatch(renderCandidates([candidate], { selectable: true }), / disabled/);
});

test('all candidate text and attribute values remain escaped', () => {
  const attack = '<img src=x onerror="alert(1)"> & \'content\'';
  const html = renderCandidates([{ ...candidate, id: attack, kb_id: attack, field: attack,
    value: attack, author: attack, source: { kind: 'ticket', ticket_id: attack }
  }], { selectable: true });
  assert.doesNotMatch(html, /<img|onerror="alert/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; &#39;content&#39;/);
});

test('a supplied status label or source label cannot claim candidate confirmation', () => {
  const html = renderCandidates([{ ...candidate, status_label: '검증 완료', source: { kind: 'manual_input', label: '실제 오류표' } }]);
  assert.match(html, /확정 전/);
  assert.match(html, /직접 입력 · 내용 확인 전/);
  assert.doesNotMatch(html, /검증 완료|실제 오류표/);
  assert.equal(renderBadge(), '<span class="support-kb-pending-badge" data-pending-status="pending">확정 전</span>');
});

test('invalid records cannot produce blank cards, inferred versions or action targets', () => {
  const records = [null, false, 'entry', {},
    { ...candidate, id: '' }, { ...candidate, kb_id: ' ' },
    { ...candidate, kb_version: '1' }, { ...candidate, kb_version: 0 },
    { ...candidate, kb_version: 1.5 }, { ...candidate, field: null },
    { ...candidate, value: {} }, { ...candidate, value: '\n  ' }
  ];
  const html = renderCandidates(records, { selectable: true });
  assert.match(html, /표시할 확정 전 내용이 없습니다/);
  assert.doesNotMatch(html, /data-pending-id|<button/);
  assert.doesNotThrow(() => renderCandidates(null, null));
});

test('missing provenance and invalid dates remain visibly unavailable', () => {
  const html = renderCandidates([{ ...candidate, source: null, created_at: 'not-a-date', author: null }]);
  assert.match(html, /출처 미제공 · 내용 확인 전/);
  assert.match(html, /등록 시각 미제공/);
  assert.match(html, /<dt>등록자<\/dt><dd>미제공/);
  assert.doesNotMatch(html, /Invalid Date|undefined|null|직접 입력/);
});

test('ticket provenance and compact output preserve unverified status and references', () => {
  const html = renderCandidates([{ ...candidate, source: { kind: 'ticket', ticket_id: 'KH-EXAMPLE' } }], { compact: true });
  assert.match(html, /support-kb-pending is-compact/);
  assert.match(html, /티켓에서 추가 · KH-EXAMPLE · 내용 확인 전/);
  assert.match(html, /INTAKE-001 · v1/);
  assert.match(html, /data-pending-status="pending">확정 전/);
});

test('rendering is pure and requires no network, browser storage or DOM', () => {
  const frozen = Object.freeze({ ...candidate, source: Object.freeze({ ...candidate.source }) });
  const records = Object.freeze([frozen]);
  const before = JSON.stringify(records);
  assert.equal(renderCandidates(records), renderCandidates(records));
  assert.equal(JSON.stringify(records), before);
  assert.deepEqual(Object.keys(context.window), ['KnowHowSupportPending']);
});
