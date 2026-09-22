import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/support-kb-pending.js', import.meta.url), 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(source, context);
const { renderCandidates, renderBadge, renderReviewRequests } = context.window.KnowHowSupportPending;
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
  assert.match(html, /기존 KB 본문과 별도로 보관됩니다/);
  assert.doesNotMatch(html, /기존 확정 기준/);
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

const reviewRequest = {
  id: 'request-1', candidate_id: candidate.id, kb_id: candidate.kb_id,
  kb_version: candidate.kb_version, field: candidate.field,
  status: 'requested', status_label: '확정 요청', channel: 'in_app', recipient_role: 'kb_admin',
  requested_at: '2026-09-22T06:00:00+00:00', requested_by: '요청한 상담사',
  read_at: null, read_by: null, candidate
};

test('unread requests retain candidate provenance and offer only a read receipt', () => {
  const html = renderReviewRequests([reviewRequest]);
  assert.match(html, /aria-label="KB 관리자 확정 요청함"/);
  assert.match(html, /표시된 요청 1건/);
  assert.match(html, /표시된 요청 중 안 읽음 1건/);
  assert.match(html, /data-review-status="requested">확정 요청/);
  assert.match(html, /안 읽음 · 확정 전/);
  assert.match(html, /후보를 확정·승인·게시하지 않습니다/);
  assert.match(html, /<dt>요청자<\/dt><dd>요청한 상담사/);
  assert.match(html, /<dt>요청 시각<\/dt><dd>2026/);
  assert.match(html, /data-pending-id="candidate-1"/);
  assert.match(html, /직접 입력 · 내용 확인 전/);
  assert.match(html, /INTAKE-001 · v1/);
  assert.match(html, /<button type="button"[^>]*data-review-read="request-1"[^>]*>읽음 표시<\/button>/);
  assert.equal((html.match(/<button/g) || []).length, 1);
  assert.doesNotMatch(html, /data-pending-candidate=|data-action=|data-review-(approve|reject|publish)=/);
});

test('read receipts preserve pending status and show the recorded reader and time', () => {
  const html = renderReviewRequests([{ ...reviewRequest, read_at: '2026-09-22T07:30:00+00:00', read_by: '읽은 관리자' }]);
  assert.match(html, /관리자가 읽음 · 확정 전/);
  assert.match(html, /<dt>읽은 관리자<\/dt><dd>읽은 관리자/);
  assert.match(html, /<dt>읽은 시각<\/dt><dd>2026/);
  assert.match(html, /표시된 요청 중 안 읽음 0건/);
  assert.match(html, /data-pending-status="pending">확정 전/);
  assert.doesNotMatch(html, /<button|확정 완료|승인됨|게시됨/);
});

test('the inbox excludes other channels, recipients, statuses and mismatched snapshots', () => {
  const invalid = [null, {},
    { ...reviewRequest, status: 'approved' },
    { ...reviewRequest, status: undefined },
    { ...reviewRequest, channel: 'email' },
    { ...reviewRequest, recipient_role: 'counselor' },
    { ...reviewRequest, candidate_id: 'different-candidate' },
    { ...reviewRequest, kb_id: 'APP-001' },
    { ...reviewRequest, kb_version: 2 },
    { ...reviewRequest, field: 'symptom' },
    { ...reviewRequest, candidate: { ...candidate, status: 'confirmed' } },
    { ...reviewRequest, candidate: { ...candidate, value: '' } },
    { ...reviewRequest, id: ' ' },
    { ...reviewRequest, read_at: false }
  ];
  const html = renderReviewRequests(invalid);
  assert.match(html, /표시할 확정 요청이 없습니다/);
  assert.match(html, /표시된 요청 0건/);
  assert.doesNotMatch(html, /data-review-request=|data-pending-id=|<button/);
});

test('busy state disables read receipts while optional counts remain explicit', () => {
  const html = renderReviewRequests([reviewRequest], { busy: true, unreadCount: 7 });
  assert.match(html, /표시된 요청 1건/);
  assert.match(html, /전체 안 읽음 7건/);
  assert.match(html, /data-review-read="request-1"[^>]* disabled>읽음 표시/);
  for (const unreadCount of [-1, '7', NaN, 0.5]) {
    assert.match(renderReviewRequests([reviewRequest], { unreadCount }), /표시된 요청 중 안 읽음 1건/);
  }
});

test('request ids, senders and read-receipt actors cannot inject markup or confirmation', () => {
  const attack = '<img src=x onerror="alert(1)">';
  const unread = renderReviewRequests([{ ...reviewRequest, id: attack, requested_by: attack, status_label: '승인 완료' }]);
  const read = renderReviewRequests([{ ...reviewRequest, requested_by: attack, read_by: attack, read_at: '2026-09-22T07:30:00Z' }]);
  for (const html of [unread, read]) {
    assert.doesNotMatch(html, /<img|onerror="alert|승인 완료/);
    assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.match(html, /data-review-status="requested">확정 요청/);
    assert.match(html, /data-pending-status="pending">확정 전/);
  }
});

test('absent read timestamps stay unread and missing request metadata is not invented', () => {
  const html = renderReviewRequests([{ ...reviewRequest, requested_by: null, requested_at: 'bad-date', read_at: undefined, read_by: 'stale reader' }]);
  assert.match(html, /안 읽음 · 확정 전/);
  assert.match(html, /요청 시각 미제공/);
  assert.match(html, /<dt>요청자<\/dt><dd>미제공/);
  assert.match(html, /data-review-read="request-1"/);
  assert.doesNotMatch(html, /stale reader|Invalid Date/);
});

test('inbox rendering accepts empty input and never changes request or candidate records', () => {
  assert.match(renderReviewRequests(null, null), /표시할 확정 요청이 없습니다/);
  const frozen = Object.freeze({ ...reviewRequest, candidate: Object.freeze({ ...candidate }) });
  const records = Object.freeze([frozen]);
  const before = JSON.stringify(records);
  assert.equal(renderReviewRequests(records), renderReviewRequests(records));
  assert.equal(JSON.stringify(records), before);
  assert.deepEqual(Object.keys(context.window), ['KnowHowSupportPending']);
});
