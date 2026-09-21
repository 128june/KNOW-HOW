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
  assert.match(markup, /<strong>가리기<\/strong><span>영향 2행<\/span>/);
  assert.match(markup, /<dt>검출 셀<\/dt><dd>1<\/dd>/);
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

test('Policy source browsing and authoring require an available API and never seed examples', () => {
  const initial = ui.privacyMarkup({ dataset, preview });
  assert.match(initial, /data-data-action="privacy-propose" disabled/);
  const markup = ui.policyMarkup({ dataset, policies: [policy] });
  assert.match(markup, /data-data-action="policy-search" disabled/);
  assert.doesNotMatch(markup, /data-data-action="policy-example"/);
  assert.match(markup, /data-policy-action="new" disabled/);
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

test('Current candidates require explicit checkbox selection and a human reason', () => {
  const rendered = ui.privacyMarkup({ dataset, proposal: {...proposal, policies:[policy]} });
  assert.match(rendered, /name="policy_ref" value="policy-1" data-policy-version="4"/);
  assert.doesNotMatch(rendered, /name="policy_ref"[^>]*checked/);
  assert.match(rendered, /name="decision_reason"/);
  const empty = ui.policyMarkup({ dataset, policies: [], policySearchEnabled:true });
  assert.match(empty,/현재 범위에 유효하고 검토 완료된 정책 문서가 없습니다/);
  assert.match(empty,/정책 작성 열기/);
  assert.doesNotMatch(empty,/data-policy-company[^>]*checked/);
});
test('Review and company approval are explicit separate current-version actions', () => {
  const kb = {editor:{...policy,state:'draft',company_status:'none'},draft:{title:'<b>policy</b>',content:'<script>no</script>',valid_from:'2026-09-22'}};
  let rendered=ui.policyWorkspaceMarkup({kb,enabled:true});
  assert.match(rendered,/현재 버전 검토 완료/);
  assert.match(rendered,/data-policy-mutation="promote" disabled/);
  assert.match(rendered,/저장된 현재 원문·버전·적용일을 직접 읽고 확인/);
  assert.doesNotMatch(rendered,/<b>policy|<script>no/);
  kb.editor.state='confirmed';kb.editor.company_status='requested';
  rendered=ui.policyWorkspaceMarkup({kb,enabled:true});
  assert.match(rendered,/data-policy-mutation="promote" >요청된 전사 공유 승인/);
});
test('Completed evidence keeps human reason and source SHA visible', () => {
  const markup=ui.policyMarkup({dataset,application:{...completed,source_sha256:'source-sha-test',applications:[{...decision,decision:'human_policy_selection',reason:'연락처 외부 공개 방지'}]}});
  assert.match(markup,/사람이 정책 선택/);assert.match(markup,/연락처 외부 공개 방지/);assert.match(markup,/source-sha-test/);
});

test('Unavailable historical policy shows immutable identity without inventing current text', () => {
  const entry={...decision,reason:'적용 당시 원문을 확인함'};
  const markup=ui.policyMarkup({dataset,application:{...completed,policies:[{id:'revoked-policy',version:3,availability:'unavailable',sha256:'policy-content-sha',content:'',applications:[entry]}]}});
  assert.match(markup,/정책 revoked-policy/);assert.match(markup,/적용 당시 근거 · 현재 원문 사용 불가/);assert.match(markup,/policy-content-sha/);
});
test('Policy effective dates remain business dates without a fabricated time', () => {
  const markup=ui.policyMarkup({dataset,policies:[{...policy,valid_from:'2026-09-22',valid_to:'2026-12-31',source:{reference:'담당자가 제공한 정책 제3조'}}]});
  assert.match(markup,/2026-09-22 ~ 2026-12-31/);assert.doesNotMatch(markup,/오전 9/);assert.match(markup,/담당자가 제공한 정책 제3조/);
});

test('Changed decisions precede all retained unchanged fields and a collapsed source checksum', () => {
  const kept=Array.from({length:16},(_,i)=>({column:'유지 열 '+i,action:'keep',affected_count:0,matched_cells:0,policy_refs:[],reason:'',decision:'review_applied'}));
  const changed={...decision,column:'비고',action:'mask',affected_count:2,reason:'원문 조건과 예외를 사람이 확인했습니다.'};
  const markup=ui.policyMarkup({dataset,application:{...completed,source_sha256:'exact-original-sha',applications:[...kept,changed]}});
  const priority=markup.match(/<div class="data-application-priority">([\s\S]*?)<details class="data-application-unchanged">/)[1];
  assert.match(priority,/data-application-column="비고"/);assert.doesNotMatch(priority,/data-application-column="유지 열/);
  assert.match(priority,/연락처 처리 정책 · v4/);assert.match(priority,/원문 조건과 예외를 사람이 확인했습니다/);
  assert.match(markup,/<details class="data-application-unchanged"><summary>유지한 나머지 16개 열/);
  for(const entry of kept)assert.match(markup,new RegExp('data-application-column="'+entry.column+'"'));
  assert.match(markup,/<details class="data-application-source"><summary>입수 원문 출처·검증 정보/);
  assert.ok(markup.indexOf('data-application-priority')<markup.indexOf('exact-original-sha'));
});

test('A policy-backed keep decision remains prominent with its exact zero count', () => {
  const keep={...decision,action:'keep',affected_count:0,reason:'이 목적에는 원문 유지가 필요함을 확인'};
  const markup=ui.policyMarkup({dataset,application:{...completed,applications:[keep]}});
  assert.match(markup,/data-application-priority/);assert.match(markup,/<strong>유지<\/strong><span>영향 0행<\/span>/);
  assert.doesNotMatch(markup,/data-application-unchanged/);
});

test('Missing affected counts are never inferred from total processed rows', () => {
  const missing={...decision,action:'mask',affected_count:null};
  const markup=ui.policyMarkup({dataset,application:{...completed,processed_rows:999,applications:[missing]}});
  const priority=markup.match(/<article class="data-application-entry"[\s\S]*?<\/article>/)[0];
  assert.match(priority,/영향 행 미제공/);assert.doesNotMatch(priority,/999행/);
  assert.doesNotMatch(ui.policyMarkup({dataset,application:{...completed,state:'running',applications:[missing]}}),/data-application-priority/);
});

console.log(`PASS: ${cases.length} data review UI contract cases\n${cases.map(name => '- ' + name).join('\n')}`);
