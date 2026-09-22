/* Exercise the real deterministic engine through browser storage and isolated tab contexts. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const core=require('../src/general-workflow-core.js');
const storeSource=fs.readFileSync(path.join(__dirname,'../src/general-workflow-store.js'),'utf8');
const KEY='knowhow.general.workflow.v1';
const LEGACY_KEY='knowhow.general.v2';
const json=value=>JSON.parse(JSON.stringify(value));
function storage(seed={}) {
 const values=new Map(Object.entries(seed)),writes=[];
 let writeError=null;
 return {values,writes,failWrites(error){writeError=error;},getItem(key){return values.has(key)?values.get(key):null;},setItem(key,value){if(writeError)throw writeError;values.set(key,String(value));writes.push({key,value:String(value)});}};
}
function tab(localStorage) {
 const window={KnowHowGeneralWorkflowCore:core,localStorage,location:{search:'',href:'http://localhost/general#general-3'},KNOWHOW_CONFIG:{generalApiBase:''},fetch(){throw Error('Local mode must not make a network request');}};
 vm.runInNewContext(storeSource,{window,URL,URLSearchParams,AbortSignal});
 return window.KnowHowGeneralWorkflowStore.createStore();
}
const question={topic:'refund',purpose:'customer',contract_ids:['C1','C2'],period:'october',refund_id:'all',question:'고객 환불 완료 안내를 할 수 있나요?'};
const completed=result=>result.metrics.find(metric=>metric.key==='completed_refund').value;
const requestBody={document_id:'KB-REF-01',target_row_id:'R1',body:'DONE과 고객 환불 완료의 차이와 증빙을 확인해 주세요.'};
async function main(){
 const legacy='{"legacy_documents":[{"id":"existing","content":"기존 사용자 기록 보존"}]}';
 const disk=storage({[LEGACY_KEY]:legacy,'unrelated.app.setting':'retained'});
 const first=tab(disk),second=tab(disk);
 await first.ready();await second.ready();
 assert.equal(disk.writes.length,0,'opening a fresh store does not overwrite anything');
 assert.equal(first.state().revision,0);assert.equal(first.workspaceId(),'');assert.equal(first.shareUrl(),'');
 assert.match(first.storageLabel(),/다른 기기에는 공유되지 않음/);
 const initialDocs=first.docs();assert.equal(initialDocs.length,3);assert.equal(initialDocs.find(d=>d.id==='KB-REF-01').versions.length,1);
 const emissions=[];const unsubscribe=second.subscribe(state=>{emissions.push(json(state));state.refundVersion=999;});
 const before=await first.answer(question);assert.equal(completed(before),null);
 const historicalJSON=JSON.stringify(before);
 assert.equal(first.state().answers.length,1);
 await assert.rejects(second.command('comment',requestBody),/다른 탭/);
 assert.equal(second.state().revision,first.state().revision,'stale tab refreshes state without committing its action');
 assert.equal(second.state().comments.length,0);assert.equal(second.state().refundVersion,1,'listener receives detached state');
 assert.equal(emissions.length,1);unsubscribe();
 const unresolved=await second.command('comment',{document_id:'KB-REV-01',target_row_id:'PX',body:'표시명 외에 주문·계약 증빙을 확인해 주세요.'});
 const request=await second.command('comment',requestBody);
 assert.equal(second.state().refundVersion,1);assert.equal(core.answer(second.state(),question).metrics.find(m=>m.key==='completed_refund').value,null);
 const review=await second.command('review',{comment_id:request.result.id,role:'서비스운영팀 결제운영 담당',evidence_ref:'OPS-01:v2:3',decision:'원결제 P1, 고유 환불 R1, 100,000원과 10/3 완료시각을 확인. 9/1 이후 같은 연동에 적용.'});
 assert.equal(second.state().refundVersion,1,'review alone does not change the effective KB');
 assert.equal(second.docs().find(d=>d.id==='KB-REF-01').versions.length,1);
 await second.command('publish',{review_id:review.result.id});
 const actual=second.state();assert.equal(actual.refundVersion,2);
 assert.equal(actual.comments.find(c=>c.id===unresolved.result.id).status,'pending');
 assert.equal(actual.comments.find(c=>c.id===request.result.id).status,'published');
 assert.equal(actual.comments.find(c=>c.id===request.result.id).published_version,2);
 assert.equal(JSON.stringify(actual.answers[0]),historicalJSON,'publishing does not alter a recorded v1 answer');
 assert.equal(actual.publications.length,1);
 const published=second.docs().find(d=>d.id==='KB-REF-01');assert.deepEqual(Array.from(published.versions,v=>v.version),[2,1]);
 assert.equal(published.versions[0].review_id,review.result.id);assert.deepEqual(Array.from(published.versions[0].resolved_comment_ids),[request.result.id]);
 const after=await first.answer(question);assert.equal(completed(after),100000,'answer automatically refreshes the effective KB');
 assert.equal(after.basis.knowledge[0].version,2);assert.equal(first.state().answers.length,2);
 const reloaded=tab(disk);await reloaded.ready();assert.deepEqual(json(reloaded.state()),json(first.state()),'reopening restores every publication and historical answer');
 const detached=reloaded.state();detached.answers[0].summary='forged';detached.comments.length=0;
 assert.equal(JSON.stringify(reloaded.state().answers[0]),historicalJSON);assert.equal(reloaded.state().comments.length,2);
 const snapshot=JSON.stringify(reloaded.state());await assert.rejects(reloaded.command('publish',{review_id:review.result.id}));assert.equal(JSON.stringify(reloaded.state()),snapshot);
 const revenue=await reloaded.answer({topic:'revenue',purpose:'payment',period:'september',contract_ids:['C1','C2'],question:'9월 결제액은?'});
 assert.match(revenue.summary,/성공 결제은 500,000원|성공 결제는 500,000원/);assert.match(revenue.summary,/수수료 차감 전/);
 assert.equal(disk.values.get(LEGACY_KEY),legacy,'legacy knowledge remains byte-for-byte unchanged');assert.equal(disk.values.get('unrelated.app.setting'),'retained');
 assert.ok(disk.writes.every(write=>write.key===KEY),'new module writes only its own key');
 for(const corrupt of ['{broken json',JSON.stringify({revision:0,refundVersion:1,comments:null,reviews:[],answers:[]})]) {
  const broken=storage({[KEY]:corrupt,[LEGACY_KEY]:legacy});const reader=tab(broken);
  await assert.rejects(reader.ready(),/덮어쓰지 않습니다/);
  await assert.rejects(reader.sync(),/덮어쓰지 않습니다/);
  await assert.rejects(reader.command('comment',requestBody),/덮어쓰지 않습니다/);
  assert.equal(broken.values.get(KEY),corrupt);assert.equal(broken.values.get(LEGACY_KEY),legacy);assert.equal(broken.writes.length,0,'corrupt saved state is preserved for recovery');
 }
 const laterCorruption=storage();const running=tab(laterCorruption);await running.ready();
 laterCorruption.values.set(KEY,'corrupted-after-ready');
 await assert.rejects(running.command('comment',requestBody),/덮어쓰지 않습니다/);
 assert.equal(running.state().revision,0);assert.equal(laterCorruption.values.get(KEY),'corrupted-after-ready');assert.equal(laterCorruption.writes.length,0);
 // A quota or browser security failure must not apply an unpersisted revision.
 const unavailable=storage();const guarded=tab(unavailable);await guarded.ready();
 const pristine=JSON.stringify(guarded.state());unavailable.failWrites(Error('quota exhausted'));
 await assert.rejects(guarded.command('comment',requestBody),/quota exhausted/);
 assert.equal(JSON.stringify(guarded.state()),pristine,'failed storage write must not advance in-memory state');
 assert.equal(unavailable.getItem(KEY),null);
 unavailable.failWrites(null);await guarded.command('comment',requestBody);assert.equal(guarded.state().revision,1);
 const persisted=JSON.stringify(guarded.state());unavailable.failWrites(Error('storage disabled'));
 await assert.rejects(guarded.newWorkspace(),/storage disabled/);assert.equal(JSON.stringify(guarded.state()),persisted,'failed reset must preserve current state');
 assert.equal(unavailable.getItem(KEY),persisted);
 unavailable.failWrites(null);
 const checked=await guarded.command('review',{comment_id:guarded.state().comments[0].id,role:'서비스운영팀 결제운영 담당',evidence_ref:'OPS-01:v2:3',decision:'R1 원결제·금액·완료시각을 확인했습니다.'});
 const beforePublication=JSON.stringify(guarded.state());let failedNotifications=0;const stop=guarded.subscribe(()=>failedNotifications++);
 unavailable.failWrites(Error('quota exhausted'));
 await assert.rejects(guarded.command('publish',{review_id:checked.result.id}),/quota exhausted/);
 assert.equal(JSON.stringify(guarded.state()),beforePublication);assert.equal(unavailable.getItem(KEY),beforePublication);
 assert.equal(guarded.state().refundVersion,1,'failed publication must not activate v2');
 assert.equal(guarded.docs().find(d=>d.id==='KB-REF-01').versions[0].version,1);
 assert.equal(failedNotifications,0,'failed persistence must not broadcast a committed state');
 unavailable.failWrites(null);await guarded.command('publish',{review_id:checked.result.id});assert.equal(guarded.state().refundVersion,2);assert.equal(failedNotifications,1);stop();
 console.log('PASS general workflow browser store: local E2E, isolated keys, reload, immutable history, stale tabs, detached snapshots, corrupt records preserved, storage-failure atomicity');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
