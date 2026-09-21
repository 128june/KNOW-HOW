/* Policy display only, with synthetic records and zero network/mutations. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tests/company-live.cjs','utf8').split('(async()=>{')[0].replace('request,render};','request,render,documentSummary,documentStatus,reviewSummary,humanReview,sharedAdapter};');
const {setup}=new Function('require',harness+'\nreturn {setup};')(require);
const {api,c}=setup();let calls=0;
c.fetch=()=>{calls++;throw Error('No network is permitted')};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const policy={id:'p'.repeat(32),title:'Synthetic privacy policy',department:'app',version:3,
 state:'confirmed',company_status:'approved',shared_version:3,comments:[],
 source:{kind:'data-platform-privacy-policy',title:'User-recorded policy'},
 reason:'검토자가 적용 범위와 예외를 확인했습니다.\n  공백과 <사유> & 원문을 보존합니다.',
 valid_from:'2026-09-22',valid_to:'',
 content:'이메일 원문은 내부 집계에 포함하지 않습니다.\n예외는 별도 확인합니다.\n\n  원문 들여쓰기 & <내용> 보존.\n마지막 원문 행',history:[]};
const initial=JSON.stringify(policy);
assert.equal(api.humanReview(policy).current,false,'policy display never fabricates a charger human-review block');
assert.equal(api.documentStatus(policy),'정책 버전 확인 완료');
assert.equal(api.documentStatus(policy,true),'정책 버전 확인 완료');
const summary=api.reviewSummary(policy);
assert.ok(summary.includes('정책 v3 · 정책 버전 확인 완료'));
assert.ok(summary.includes(escape(policy.reason)),'multiline reason and whitespace are preserved exactly');
assert.ok(summary.includes('기록된 적용 시작</dt><dd>2026-09-22'));
assert.ok(summary.includes('기록된 적용 종료</dt><dd>종료일 미지정'));
assert.ok(summary.includes('실제 회사의 내부 정책 승인 여부는 별도 확인'));
assert.ok(summary.includes('href="#data-policies"'));
assert.ok(!summary.includes('내부 ID')&&!summary.includes('검토 기록 미등록'));
assert.ok(!summary.includes('2026-12-31')&&!summary.includes('무기한'));
assert.ok(api.reviewSummary(policy,true).includes(escape(policy.reason)),'returned policy evidence uses its own recorded review');
assert.ok(api.documentSummary(policy).includes('정책 원문 첫 문단'));
assert.ok(!api.documentSummary(policy).includes('검토 요약 미등록'));
for(const [state,label] of [['draft','정책 초안 · 확인 전'],['rejected','정책 검토 반려'],[undefined,'정책 상태 미제공']]){
 const changed={...policy,state};
 assert.equal(api.documentStatus(changed),label);
 assert.ok(!api.reviewSummary(changed).includes('정책 버전 확인 완료'),'company approval or reason cannot replace version state');
}
const missing={...policy,version:null,reason:'',valid_from:null,valid_to:undefined};
const absent=api.reviewSummary(missing);
assert.ok(absent.includes('버전 미제공')&&absent.includes('기록 사유 미제공'));
assert.ok(absent.includes('시작일 미지정')&&absent.includes('종료일 미지정'));
const finite=api.reviewSummary({...policy,valid_from:'2020-01-01',valid_to:'2021-02-03'});
assert.ok(finite.includes('2020-01-01')&&finite.includes('2021-02-03'));
assert.ok(!finite.includes('현재 유효'),'recorded confirmation does not assert current validity');
// The branch must depend on the exact source kind, never title, reason or
// company approval. Charging review requirements remain unchanged.
for(const source of [undefined,{kind:'company_charger_knowledge'},{kind:'data-platform-guide'},
                      {kind:'data-platform-privacy-policy-untrusted'}]){
 const other={...policy,source};
 assert.ok(api.documentStatus(other).includes('검토 기록 미등록'));
 assert.ok(api.reviewSummary(other).includes('내부 ID 대응'));
}
vm.runInContext(fs.readFileSync('src/organization-kb.js','utf8'),c);
api.state.documents=[policy];api.state.loaded=true;
const adapter=api.sharedAdapter();
assert.equal(adapter.canShareDocument(policy),false,'display must not loosen charger sharing requirements');
assert.equal(adapter.canReviewDocument(policy),false,'policy management is not moved into the charging editor');
const controller=c.window.KnowHowOrganizationUI.createController({adapter});
const host={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
controller.getState().scope='company';controller.mount(host,{mode:'library'});
assert.ok(host.innerHTML.includes('v3 · 정책 버전 확인 완료'));
assert.ok(host.innerHTML.includes('v3 · 전사 공유 승인'));
assert.ok(host.innerHTML.includes(escape(policy.content)),'complete original policy remains unchanged in collapsed body');
assert.ok(host.innerHTML.includes(escape(policy.reason)));
assert.ok(!host.innerHTML.includes('내부 ID')&&!host.innerHTML.includes('검토 기록 미등록'));
controller.getState().selected=policy;controller.mount(host,{mode:'library'});
assert.ok(host.innerHTML.includes('org-document-detail'));
assert.ok(host.innerHTML.includes(escape(policy.content))&&host.innerHTML.includes('종료일 미지정'));
controller.getState().documents=[{...policy,shared_version:1,company_status:'stale'}];
controller.getState().selected=null;controller.mount(host,{mode:'library'});
assert.ok(host.innerHTML.includes('v3 · 정책 버전 확인 완료')&&host.innerHTML.includes('v1 · 재승인 필요'));
assert.equal(JSON.stringify(policy),initial,'rendering cannot mutate server records');
assert.equal(calls,0);
console.log('PASS: exact policy kind display, recorded state/version/reason/dates, unspecified end date, escaped immutable full original, current/shared version distinction, existing charger mutation gates unchanged, zero network');
