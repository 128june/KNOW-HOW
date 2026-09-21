/* Contract fixtures only: no network, embeddings or generation are performed. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tests/company-live.cjs','utf8').split('(async()=>{')[0].replace('request,render};','request,render,sharedAdapter};');
const {setup,selection,response,credential}=new Function('require',harness+'\nreturn {setup,selection,response,credential};')(require);
const ready={status:'ready',backend:'qdrant-local',model:'text-embedding-3-small',dimension:1536};
const doc={id:'e'.repeat(32),title:'Synthetic confirmed policy',department:'device',version:3,state:'confirmed',content:'Synthetic current evidence',source:{kind:'data-platform-guide'}};
const enabled={semantic_search_configured:true,embedding_provider:'openai_api',requires_document_confirmation:false,requires_confirmed_evidence:true,workspace_sharing:true};

// Bind the production form/controls to small DOM stand-ins, as in the other
// local UI scripts. These tests invoke the real event handlers.
function hostFixture(){
 let markup='',form=null,controls=[],date=null;
 return {
  scrollIntoView(){},
  get innerHTML(){return markup},
  set innerHTML(value){
   markup=value;
   controls=[{dataset:{orgControl:'department'},value:'device'},{dataset:{orgControl:'company'},checked:false}];
   if(!value.includes('data-org-form="chat"')){form=null;return}
   const question={value:''},exact={value:''};date={value:value.match(/name="as_of" value="([^"]*)"/)?.[1]||'2026-09-22'};
   form={dataset:{orgForm:'chat',forceAi:'true'},question,exact_id:exact,as_of:date,
    querySelector(selector){return selector==='[name=question]'?question:selector==='[name=exact_id]'?exact:null}};
  },
  querySelector(selector){return selector==='[data-org-form=chat]'?form:selector==='[data-org-form=chat] [name=as_of]'?date:null},
  querySelectorAll(selector){return selector==='[data-org-form]'&&form?[form]:selector==='[data-org-control]'?controls:[]},
  get form(){return form},get controls(){return controls},get date(){return date},
 };
}

(async()=>{
 const {api,c,storage}=setup();c.window.KNOWHOW_CONFIG.aiRequestsPaused=true;
 const stored=JSON.stringify([...storage]),calls=[];let capabilities={},responseOverride=null;
 c.fetch=async(url,options)=>{
  const body=JSON.parse(options.body||'{}');calls.push({url,body});
  assert.equal(options.headers.Authorization,'Bearer '+credential);
  assert.equal(body.org,undefined);assert.equal(body.session_id,undefined);
  if(url.endsWith('/station-contexts/resolve'))return response({...selection,capabilities});
  if(url.endsWith('/catalog'))return response({documents:[doc],capabilities,vector:{status:'not_queried'}});
  if(url.endsWith('/chat')){
   const match=body.document_id?'document':body.exact_id?'exact':body.question.startsWith('방금')?'conversation':'vector';
   return response(responseOverride||{conversation_id:'fixture-conversation',evidence:[{...doc,match}],ai_generated:false,
    vector:match==='vector'?ready:{status:match+'_only',backend:'qdrant-local'}});
  }
  throw Error('Unexpected fixture path '+url);
 };
 await api.openVisitorContext({apiBase:'http://127.0.0.1:18773/data-platform',visitorBearer:credential,contextId:selection.context_id});
 const adapter=api.sharedAdapter();
 assert.equal(adapter.requiresDocument,true);assert.equal(adapter.canSearchSemantically(),false);
 vm.runInContext(fs.readFileSync('src/organization-kb.js','utf8').replace('return {askDocument,','return {responseMarkup,askDocument,'),c);
 const controller=c.window.KnowHowOrganizationUI.createController({adapter,allowInquiry:true}),host=hostFixture();
 controller.mount(host,{mode:'library'});controller.focusAI();
 const initial=calls.length;
 assert.ok(host.innerHTML.includes('의미 검색 사용 불가'));
 assert.equal(calls.length,initial,'opening the question panel never submits a query');
 async function settle(){await new Promise(setImmediate);assert.equal(controller.getState().busy,false)}
 async function submit(question,{generate=false,exact=''}={}){
  host.form.question.value=question;host.form.exact_id.value=exact;
  host.form.onsubmit({preventDefault(){},submitter:{dataset:generate?{explicitGenerate:'true'}:{evidenceOnly:'true'}}});
  await settle();
 }
 await submit('Unconfigured source lookup');assert.equal(calls.at(-1).body.cache_only,true);
 for(const invalid of [{requires_document_confirmation:false},
                       {semantic_search_configured:true,embedding_provider:'disabled',requires_document_confirmation:false},
                       {semantic_search_configured:'true',embedding_provider:'openai_api',requires_document_confirmation:false}]){
  capabilities=invalid;await controller.catalog();
  assert.equal(adapter.requiresDocument,true);assert.equal(adapter.canSearchSemantically(),false);
 }
 capabilities=enabled;await controller.catalog();
 assert.equal(adapter.requiresDocument,false,'getter follows freshly received capability');
 assert.equal(adapter.canSearchSemantically(),true);assert.equal(adapter.canGenerate('knowledge'),false);
 controller.focusAI();assert.ok(host.innerHTML.includes('의미 검색 가능'));
 const beforeNavigation=calls.length;
 host.date.value='2026-09-23';host.date.onchange();controller.setAnswerMode('inquiry');
 assert.equal(calls.length,beforeNavigation,'date/mode changes never submit a query');
 host.controls[0].value='data';host.controls[0].onchange();await settle();
 assert.equal(calls.length,beforeNavigation+1);assert.ok(calls.at(-1).url.endsWith('/catalog'));
 assert.equal(calls.at(-1).body.cache_only,undefined,'department change requests only its catalog');
 await submit('Explicit semantic evidence');
 assert.equal(calls.at(-1).body.cache_only,false);assert.equal(calls.at(-1).body.generate,false);
 assert.equal(calls.at(-1).body.document_id,undefined);assert.equal(calls.at(-1).body.include_company,false);
 assert.equal(calls.at(-1).body.department,'data');assert.ok(host.innerHTML.includes('의미 검색 완료'));
 await submit('방금 근거 다시');assert.equal(calls.at(-1).body.conversation_id,'fixture-conversation');
 assert.ok(host.innerHTML.includes('앞선 대화의 근거 재조회'));
 host.controls[1].checked=true;host.controls[1].onchange();await settle();
 await submit('Explicit company evidence');assert.equal(calls.at(-1).body.include_company,true);
 assert.equal(calls.at(-1).body.conversation_id,undefined,'company opt-in starts a separate conversation');
 await submit('Exact lookup',{exact:'SYNTHETIC-001'});
 assert.equal(calls.at(-1).body.cache_only,true);assert.equal(calls.at(-1).body.exact_id,'SYNTHETIC-001');
 assert.ok(host.innerHTML.includes('정확한 ID 조회'));
 const beforeSelection=calls.length;controller.askDocument(doc);assert.equal(calls.length,beforeSelection);
 await submit('Selected current document');assert.equal(calls.at(-1).body.cache_only,true);
 assert.equal(calls.at(-1).body.document_id,doc.id);assert.ok(host.innerHTML.includes('선택 문서 조회'));
 controller.changeScope({department:'data',includeCompany:false});controller.focusAI();
 capabilities={...enabled,knowledge_generation:true,inquiry_generation:true};await controller.catalog();controller.focusAI();
 const beforePaused=calls.length;await submit('Paused explicit generation',{generate:true});
 assert.equal(calls.length,beforePaused);assert.ok(controller.getState().error.includes('생성 요청할 수 없습니다'));
 c.window.KNOWHOW_CONFIG.aiRequestsPaused=false;
 await submit('Explicit generated answer without document',{generate:true});
 assert.equal(calls.at(-1).body.generate,true);assert.equal(calls.at(-1).body.document_id,undefined);
 assert.equal(calls.at(-1).body.cache_only,false);
 capabilities={};await controller.catalog();controller.focusAI();
 assert.equal(adapter.requiresDocument,true);assert.equal(adapter.canSearchSemantically(),false);
 await submit('Capability revoked');assert.equal(calls.at(-1).body.cache_only,true);
 await adapter.request('chat',{department:'data',question:'Cannot force embeddings',cache_only:false,generate:false});
 assert.equal(calls.at(-1).body.cache_only,true,'adapter fails closed after capability revocation');
 capabilities=enabled;await controller.catalog();controller.focusAI();
 responseOverride={ai_generated:false,evidence:[],vector:{status:'daily_budget',backend:'qdrant-local'}};
 const beforeFailure=calls.length;await submit('Quota exhausted');assert.equal(calls.length,beforeFailure+1);
 assert.ok(host.innerHTML.includes('의미 검색을 완료하지 못했습니다'));
 for(const vector of [{status:'ready',backend:'mock',model:'test-only',dimension:1536},
                      {status:'ready',backend:'sql',model:'text-embedding-3-small',dimension:1536},
                      {status:'ready',backend:'qdrant-local',model:'test-only',dimension:1536}]){
  const rendered=controller.responseMarkup({ai_generated:false,evidence:[{...doc,match:'vector'}],vector});
  assert.equal(rendered.includes('의미 검색 완료'),false,'mock or SQL results must not claim semantic retrieval');
 }
 assert.equal(JSON.stringify([...storage]),stored,'capabilities and requests never persist visitor credentials');
 console.log('PASS: visitor capability defaults/revocation, real bound submit opt-in, paused generation, no automatic search, department/company/conversation scope, exact/document fast paths, honest retrieval labels, no retry; all transport mocked');
})().catch(error=>{console.error(error);process.exitCode=1});
