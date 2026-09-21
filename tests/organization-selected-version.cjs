const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=fs.readFileSync('src/organization-kb.js','utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
let realNetworkCalls=0;
function setup({conflictAction=null}={}){
 const current={id:'document-a',title:'Detailed v3 title',department:'device',version:3,state:'confirmed',company_status:'requested',shared_version:1,content:'Detailed v3 body',comments:[],history:[]};
 const catalog={...current,title:'Stale catalog v2 title',version:2,content:'Stale catalog v2 body'};
 const unrelated={...current,id:'document-b',title:'Unrelated catalog v7 title',version:7,content:'Other document body'};
 const calls=[],reviews=[];
 const context=vm.createContext({window:{KNOWHOW_CONFIG:{aiRequestsPaused:true}},TextEncoder,AbortSignal,fetch(){realNetworkCalls++;throw Error('Network must never be used in this local fixture')}});
 vm.runInContext(source,context);
 const adapter={context:{session:'local-fixture',org:'local-fixture',department:'device',departments:['device'],documents:[catalog,unrelated],loaded:true},notice:'Local render fixture',canShare:()=>true,canShareDocument:()=>true,canGenerate:()=>false,generationReason:()=> 'Local fixture, no AI',openReview:d=>reviews.push(clone(d)),request:async(action,payload)=>{
  calls.push({action,payload:clone(payload)});
  if(action==='document')return clone(payload.id===current.id?current:unrelated);
  if(action==='catalog')return {documents:clone([catalog,unrelated])};
  if(action===conflictAction)throw Error('현재 서버는 v4입니다. 문서 버전이 바뀌었습니다. 목록을 새로고침하세요.');
  if(['request-promotion','promote','revoke'].includes(action))return clone(current);
  throw Error('Unexpected local action '+action);
 }};
 const controller=context.window.KnowHowOrganizationUI.createController({adapter});
 let markup='',buttons=[];
 const host={
  get innerHTML(){return markup},
  set innerHTML(value){markup=value;buttons=[...value.matchAll(/<button\b([^>]*)>/g)].map(match=>{const attrs=match[1],dataset={};for(const attr of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g))dataset[attr[1].replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=attr[2];return {dataset,disabled:/(?:^|\s)disabled(?:\s|$)/.test(attrs),onclick:null}})},
  querySelector(){return null},
  querySelectorAll(selector){return selector==='[data-org-action]'?buttons.filter(button=>button.dataset.orgAction):[]}
 };
 controller.mount(host,{mode:'library'});
 async function click(action,id){const button=buttons.find(button=>button.dataset.orgAction===action&&(id===undefined||button.dataset.docId===id));assert.ok(button,`Visible ${action} button for ${id??'no document'}`);assert.equal(button.disabled,false,`${action} must be enabled in this fixture`);assert.equal(typeof button.onclick,'function','Use the real bound click handler');await button.onclick();await new Promise(setImmediate);assert.equal(controller.getState().busy,false,'click has finished its async task');}
 async function openCurrent(){await click('document',current.id);assert.equal(controller.getState().documents.find(d=>d.id===current.id).version,2,'catalog remains stale');assert.equal(controller.getState().selected.version,3,'document handler loaded fresh detail');assert.ok(host.innerHTML.includes('Detailed v3 title'));}
 return {controller,host,calls,reviews,current,catalog,unrelated,click,openCurrent};
}
const cases=[];
for(const action of ['request-promotion','promote','revoke'])cases.push([`${action} uses selected v3 over catalog v2`,async()=>{const x=setup();await x.openCurrent();await x.click(action,x.current.id);const request=x.calls.find(call=>call.action===action);assert.ok(request);assert.equal(request.payload.id,x.current.id);assert.equal(request.payload.version,3,'the button visible in v3 detail must submit v3');assert.equal(x.calls.filter(call=>call.action===action).length,1)}]);
cases.push(['ask-document uses selected detail title',async()=>{const x=setup();await x.openCurrent();await x.click('ask-document',x.current.id);assert.equal(x.controller.getState().questionDocument.id,x.current.id);assert.equal(x.controller.getState().questionDocument.title,x.current.title);assert.equal(x.calls.filter(call=>call.action==='chat').length,0,'selection never runs a query or generation')}]);
cases.push(['openReview receives selected v3 document',async()=>{const x=setup();await x.openCurrent();await x.click('review',x.current.id);assert.equal(x.reviews.length,1);assert.equal(x.reviews[0].id,x.current.id);assert.equal(x.reviews[0].version,3);assert.equal(x.reviews[0].content,x.current.content);assert.equal(x.calls.filter(call=>call.action==='review').length,0)}]);
cases.push(['unrelated mutation uses its catalog v7 document',async()=>{const x=setup();await x.openCurrent();await x.click('request-promotion',x.unrelated.id);const request=x.calls.find(call=>call.action==='request-promotion');assert.equal(request.payload.id,x.unrelated.id);assert.equal(request.payload.version,7)}]);
cases.push(['unrelated question and review ignore selected document',async()=>{const x=setup();await x.openCurrent();await x.click('review',x.unrelated.id);assert.equal(x.reviews[0].id,x.unrelated.id);assert.equal(x.reviews[0].version,7);await x.click('ask-document',x.unrelated.id);assert.equal(x.controller.getState().questionDocument.id,x.unrelated.id);assert.equal(x.controller.getState().questionDocument.title,x.unrelated.title)}]);
cases.push(['closing detail restores catalog fallback',async()=>{const x=setup();await x.openCurrent();await x.click('close-document');assert.equal(x.controller.getState().selected,null);await x.click('request-promotion',x.catalog.id);const request=x.calls.find(call=>call.action==='request-promotion');assert.equal(request.payload.id,x.catalog.id);assert.equal(request.payload.version,2)}]);
for(const action of ['request-promotion','promote','revoke'])cases.push([`${action} conflict sends only v3 and preserves detail/error`,async()=>{const x=setup({conflictAction:action});await x.openCurrent();const start=x.calls.length;await x.click(action,x.current.id);const after=x.calls.slice(start);assert.equal(after.length,1,'conflict must not reload, retry or perform another action');assert.equal(after[0].action,action);assert.equal(after[0].payload.version,3,'conflict must originate from the visible v3, never catalog v2 or inferred server v4');assert.equal(x.controller.getState().selected.version,3);assert.ok(x.controller.getState().error.includes('문서 버전이 바뀌었습니다.'));assert.ok(x.host.innerHTML.includes('Detailed v3 title'));assert.ok(x.host.innerHTML.includes('role="alert"'));assert.equal(x.calls.filter(call=>call.payload.version===4).length,0)}]);
(async()=>{
 let failures=0;
 for(const [name,run] of cases){try{await run();console.log('PASS: '+name)}catch(error){failures++;console.error('FAIL: '+name+' — '+error.message)}}
 assert.equal(realNetworkCalls,0);
 console.log(JSON.stringify({passed:cases.length-failures,failed:failures,real_network_calls:realNetworkCalls,model_calls:0,embedding_calls:0,public_mutations:0,source_sha256:crypto.createHash('sha256').update(source).digest('hex'),test_sha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')}));
 if(failures)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
