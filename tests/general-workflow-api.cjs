/* Real isolated HTTP API + the shipped client core/store/catalog. No response mocks. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../src/general-workflow-core.js');
const base='http://127.0.0.1:18963/knowhow';
function client(search=''){
 const memory=new Map(),location={search,href:'http://127.0.0.1:18962/'+search+'#general-3'};
 const window={KnowHowGeneralWorkflowCore:core,KNOWHOW_CONFIG:{generalApiBase:base},fetch,location,history:{replaceState(){}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}};
 const context=vm.createContext({window,URL,URLSearchParams,AbortSignal});
 for(const name of ['general-workflow-store','kb-catalog'])vm.runInContext(fs.readFileSync('src/'+name+'.js','utf8'),context);
 const store=window.KnowHowGeneralWorkflowStore.createStore();
 const catalog=window.KnowHowKBCatalog.createProvider({general:{ready:()=>store.sync(),docs:()=>store.docs()}});
 return {store,catalog};
}
async function main(){
 const a=client();await a.store.ready();
 const b=client('?general_workspace='+a.store.workspaceId());await b.store.ready();
 const q={topic:'refund',purpose:'customer',contract_ids:['C1','C2'],period:'october',refund_id:'all',question:'10월 환불 완료액은?'};
 const old=await a.store.answer(q);assert.equal(old.metrics.find(m=>m.key==='completed_refund').value,null);
 const oldJson=JSON.stringify(old);
 await a.store.command('comment',{document_id:'KB-REV-01',target_row_id:'PX',body:'PX의 계약 연결 증빙이 필요합니다.'});
 const request=await a.store.command('comment',{document_id:'KB-REF-01',target_row_id:'R1',body:'운영 DONE이 고객 환불 완료인지 확인해 주세요.'});
 assert.equal(a.store.state().refundVersion,1);
 await b.store.sync();
 const review=await b.store.command('review',{comment_id:request.result.id,role:'서비스운영팀 결제운영 담당',evidence_ref:'OPS-01:v2:3',decision:'원결제 P1·R1·금액·10/3 완료시각과 정의 확인. 9/1 이후 동일 연동에 적용.'});
 assert.equal(b.store.state().refundVersion,1,'review must not publish');
 await b.store.command('publish',{review_id:review.result.id});
 const updated=await a.store.answer(q);assert.equal(updated.metrics.find(m=>m.key==='completed_refund').value,100000);
 assert.equal(a.store.state().comments.find(c=>c.target_row_id==='PX').status,'pending');
 assert.equal(JSON.stringify(a.store.state().answers.find(x=>x.id===old.id)),oldJson,'historical answer preserved across sessions');
 const revenue=await a.store.answer({...q,topic:'revenue',purpose:'payment'});
 assert.equal(revenue.metrics.find(m=>m.key==='net_payment').value,-100000);
 assert.equal(revenue.metrics.find(m=>m.key==='cash').value,94000);
 assert.equal(revenue.metrics.find(m=>m.key==='recognized').value,null);
 const september=await a.store.answer({...q,topic:'revenue',purpose:'payment',period:'september'});
 assert.deepEqual(['signed','paid','recognized','cash'].map(k=>september.metrics.find(m=>m.key===k).value),[500000,500000,100000,291000]);
 const customer=await a.store.answer({...q,topic:'customer',purpose:'entities'});
 assert.deepEqual(Array.from(customer.metrics,m=>m.value),[4,2,2,1]);
 const latest=await a.catalog.detail('general:KB-REF-01');
 const prior=await a.catalog.detail('general:KB-REF-01',1);
 assert.equal(latest.version,2);assert.equal(prior.version,1);
 assert.equal(latest.content,a.store.docs().find(d=>d.id==='KB-REF-01').versions[0].content);
 assert.ok(prior.content.includes('미확인'));
 // Reopened client has its own storage and loads the published server revision.
 const c=client('?general_workspace='+a.store.workspaceId());await c.store.ready();assert.equal(c.store.state().refundVersion,2);
 await assert.rejects(b.store.command('comment',{document_id:'KB-REV-01',target_row_id:'PX',body:'stale concurrent command'}));
 console.log('PASS real API: two sessions, comment/review/publish separation, selective resolution, immutable history, September amounts, customer units, October dependencies, lineage v1/v2, persisted reopen, stale revision rejection');
 console.log('DEMO '+a.store.shareUrl());
}
main().catch(e=>{console.error(e);process.exitCode=1});
