// Pure rendering contract checks. No server, browser, key, or AI calls are made.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/data-review-ui.js'), 'utf8'), context);
const ui = context.window.KnowHowDataReviewUI;
const cases = [];
function test(name, callback) { callback(); cases.push(name); }
const dataset = { id: 'raw-1', name: '고객 연락처', row_count: 3, schema: [{ name: 'email', type: 'string' }] };
const preview = { columns: ['email'], rows: [{ email: 'before-value' }], total: 3 };
const after = { columns: ['email'], rows: [{ email: 'after-value' }], total: 3 };
const policy = { id: 'policy-1', version: 4, title: '연락처 처리 정책', content: '연락처 보호 규칙', department: '개인정보보호팀', state: 'approved', source: '조직 KB', synthetic: true };
const proposal = {
  review_id: 'review-1', row_count: 3, status: 'review_required', ai_generated: false,
  profile: [{ column: 'email', column_id: 'c0', data_type: 'string', types: ['email'], matches: 3, nonempty_count: 3, row_count: 3 }],
  proposals: [{ column: 'email', column_id: 'c0', action: 'hash', reason: '연락처 보호', policy_refs: [{ id: 'policy-1', version: 4 }], affected_count: 3 }]
};
const decision = { column: 'email', action: 'hash', affected_count: 3, matched_cells: 3, decision: 'review_applied', policy_refs: [{ id: 'policy-1', version: 4 }] };
const completed = { state: 'succeeded', dataset_id: 'result-1', processed_rows: 3, applications: [decision], policies: [{ ...policy, applications: [decision] }] };
const privacyResult = { state: 'succeeded', before: preview, after, input_rows: 3, processed_rows: 3, output_rows: 3, job: { id: 'job-1', kind: 'transform', state: 'succeeded', processed_rows: 3, total_rows: 3, dataset_id: 'result-1' } };
const policyCards = markup => [...markup.matchAll(/<article class="data-policy-document"[^>]*>[\s\S]*?<\/article>/g)].map(match => match[0]);

test('Completed transform with empty policy applications does not claim policy application', () => {
  const markup = ui.policyMarkup({ dataset, proposal, policies: [policy], application: { ...completed, policies: [{ ...policy, applications: [], applied_effect: '' }], applications: [{ ...decision, policy_refs: [] }] } });
  assert.match(markup, /처리 완료 · 정책 적용 없음/);
  assert.match(markup, /검색 근거 · 미적용 정책/);
  assert.equal(policyCards(markup).length, 1, 'completed results must not duplicate candidate and result documents');
  assert.match(policyCards(markup)[0], /검색 근거 · 미적용/);
  assert.doesNotMatch(policyCards(markup)[0], /확정 적용|is-complete/);
  assert.match(markup, /연결된 정책 없음/);
  assert.doesNotMatch(markup, /정책 적용 결과 보기/);
});

test('Human changes remain visible with no policy reference or confirmation', () => {
  const human = { ...decision, action: 'mask', affected_count: 2, matched_cells: 1, decision: 'human_changed', policy_refs: [] };
  const markup = ui.policyMarkup({ dataset, application: { ...completed, policies: [{ ...policy, applications: [] }], applications: [human] } });
  assert.match(markup, /열별 실제 처리 결정/);
  assert.match(markup, /사람이 제안 변경/);
  assert.match(markup, /<td>가리기<\/td><td>2<\/td><td>1<\/td>/);
  assert.match(markup, /연결된 정책 없음/);
  assert.doesNotMatch(markup, /확정 적용/);
});

test('Only documents with actual application entries receive confirmation', () => {
  const unused = { ...policy, id: 'policy-unused', title: '미사용 정책', applications: [], applied_effect: '제안일 뿐인 효과' };
  const markup = ui.policyMarkup({ dataset, application: { ...completed, policies: [completed.policies[0], unused] } });
  assert.match(markup, /처리 완료 · 정책 1개 적용/);
  const cards = policyCards(markup);
  assert.equal(cards.length, 2);
  assert.equal(cards.filter(card => card.includes('확정 적용')).length, 1);
  assert.match(cards.find(card => card.includes('data-policy-document="policy-1"')), /확정 적용/);
  assert.match(cards.find(card => card.includes('data-policy-document="policy-unused"')), /검색 근거 · 미적용/);
  assert.doesNotMatch(cards.find(card => card.includes('data-policy-document="policy-unused"')), /제안일 뿐인 효과|데이터에 적용된 내용/);
  assert.match(markup, /검토 제안 채택/);
  assert.match(markup, /policy-1 · v4/);
});

test('generate:false review with no references remains a transform without applied policies', () => {
  const localProposal = { ...proposal, proposals: proposal.proposals.map(rule => ({ ...rule, policy_refs: [] })) };
  const markup = ui.policyMarkup({ dataset, proposal: localProposal, policies: [policy], application: { ...completed, policies: [{ ...policy, applications: [] }], applications: [{ ...decision, policy_refs: [] }] } });
  assert.match(ui.privacyMarkup({ dataset, proposal: localProposal }), /규칙 기반 검토 제안/);
  assert.doesNotMatch(markup, /확정 적용/);
  assert.match(markup, /정책 적용 없음/);
});

test('Before and after results require a succeeded result job', () => {
  const good = ui.privacyMarkup({ dataset, preview, result: privacyResult });
  assert.match(good, /before-value/);
  assert.match(good, /after-value/);
  assert.match(good, /data-data-dataset="result-1"/);
  for (const state of ['running', 'failed', 'cancelled']) {
    const markup = ui.privacyMarkup({ dataset, preview, result: { ...privacyResult, job: { ...privacyResult.job, state } } });
    assert.doesNotMatch(markup, /after-value|is-complete/);
  }
  assert.doesNotMatch(ui.privacyMarkup({ dataset, preview, result: { state: 'succeeded', after } }), /after-value|is-complete/);
  assert.doesNotMatch(ui.privacyMarkup({ dataset, preview, job: { kind: 'ingest', state: 'succeeded' } }), /is-complete/);
  assert.doesNotMatch(ui.privacyMarkup({ dataset, preview, result: privacyResult, job: { id: 'new-job', kind: 'transform', state: 'running' } }), /after-value|is-complete/);
});

test('A review exposes only supported protection decisions and preserves legacy capture fields', () => {
  const markup = ui.privacyMarkup({ dataset, preview, proposal });
  const form = markup.match(/<form id="data-transform"[\s\S]*?<\/form>/)[0];
  assert.match(form, /data-review-id="review-1"/);
  assert.match(form, /value="hash" selected/);
  assert.match(form, /name="action"/);
  assert.doesNotMatch(form, /<select name="type"|name="trim"|name="dedup"|name="on_error"/);
  assert.match(form, /<input type="hidden" name="type"/);
  assert.match(form, /<input type="hidden" name="rename"/);
  assert.match(form, /policy-1 · v4/);
  assert.match(form, /제안 영향 범위: 3행/);
  assert.match(ui.privacyMarkup({ dataset, preview }), /<select name="type"/);
});

test('Policy sources remain read-only and unavailable API actions are disabled by default', () => {
  const initial = ui.privacyMarkup({ dataset, preview });
  assert.match(initial, /data-data-action="privacy-propose" disabled/);
  const markup = ui.policyMarkup({ dataset, policies: [policy] });
  assert.match(markup, /data-data-action="policy-search" disabled/);
  assert.match(markup, /data-data-action="policy-example" disabled/);
  assert.match(markup, /data-data-action="policy-review-rules"/);
  assert.doesNotMatch(markup, /name="policy_id"|data-data-action="policy-apply"/);
  assert.doesNotMatch(ui.policyMarkup({ dataset, proposal: { policies: [{ id: 'made-up', title: 'model-only-policy' }] } }), /model-only-policy/);
});

test('Dynamic values in rows, sources, decisions and policy evidence are escaped', () => {
  const attack = '<img src=x onerror="alert(1)">';
  const markup = ui.privacyMarkup({ dataset: { ...dataset, name: attack, schema: [{ name: attack, type: 'string' }] }, preview: { columns: [attack], rows: [[attack]] }, proposal: { ...proposal, review_id: attack, proposals: [{ column: attack, action: 'keep', reason: attack, policy_refs: [{ id: attack, version: attack }] }], provider: attack, model: attack } });
  assert.doesNotMatch(markup, /<img/);
  assert.match(markup, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  const output = ui.policyMarkup({ dataset, application: { ...completed, policies: [{ ...policy, title: attack, content: attack, source: { url: 'javascript:alert(1)', title: attack }, applications: [] }], applications: [{ ...decision, column: attack, decision: attack, policy_refs: [{ id: attack, version: attack }] }] } });
  assert.doesNotMatch(output, /<img|href="javascript:/);
  assert.match(output, /&lt;img/);
});

console.log(`PASS: ${cases.length} data review UI contract cases\n${cases.map(name => '- ' + name).join('\n')}`);
