const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Small event/markup host: the bridge owns these elements; org UI/HTTP is mocked.
class Host {
 constructor(){this.listeners=new Map();this._html='';this.elements=new Map();this.dataset={}}
 set innerHTML(html){
  this._html=html;this.elements=new Map();
  for(const match of html.matchAll(/data-knowledge-(region|action)="([^"]+)"/g)){
   const element=new Host();if(match[1]==='action')element.dataset.knowledgeAction=match[2];
   this.elements.set(`[data-knowledge-${match[1]}="${match[2]}"]`,element);
  }
 }
 get innerHTML(){return this._html}
 querySelector(selector){return this.elements.get(selector)||null}
 querySelectorAll(selector){return [...this.elements.entries()].filter(([key])=>key.startsWith(selector.slice(0,-1)+'=')).map(([,element])=>element)}
 addEventListener(event,handler){this.listeners.set(event,handler)}
 removeEventListener(event,handler){if(this.listeners.get(event)===handler)this.listeners.delete(event)}
 dispatch(event,target){this.listeners.get(event)?.({target})}
}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};
function fixture(){
 const calls=[],opens=[],mounts=[],changes=[];
 const orgState={session:null,org:'alpha',department:'operations',includeCompany:false};
 let handler=async action=>action==='data-manifest'?{status:'active',manifest:{dataset_id:'data-1',source_sha256:'verified-sha',schema:[{name:'amount',type:'number'}]}}:{id:'doc-1',version:1,state:'draft',identifier:'DATA-GUIDE-1'};
 const org={
  getState:()=>orgState,
  changeScope(value){Object.assign(orgState,value);changes.push(value)},
  async connect(){calls.push({action:'session'});orgState.session='opaque-kb-session'},
  mount(target,options){mounts.push(options.mode);target.innerHTML='Existing organization UI';return ()=>mounts.push('unmount')},
  async request(action,payload){calls.push({action,payload,org:orgState.org,department:orgState.department});return handler(action,payload)},
  async openDocument(id){opens.push(id)}
 };
 const context=vm.createContext({window:{KnowHowOrganizationUI:{createController(options){calls.push({action:'factory',options});return org}}}});
 vm.runInContext(fs.readFileSync('src/data-knowledge-bridge.js','utf8'),context);
 const controller=context.window.KnowHowDataKnowledgeBridge.createController({apiBase:'https://example.test/knowhow',dataApiBase:'https://example.test/data-platform'});
 const host=new Host();
 const click=async action=>{
  const button=host.querySelector(`[data-knowledge-action="${action}"]`)||host.querySelector('[data-knowledge-region="actions"]')?.querySelector(`[data-knowledge-action="${action}"]`);
  assert.ok(button,`button ${action} exists`);return button.onclick();
 };
 return {controller,host,calls,opens,mounts,changes,orgState,click,setHandler(value){handler=value}};
}

(async()=>{
 const f=fixture();
 const cleanup=f.controller.mount(f.host,{dataset:{id:'data-1',name:'<script>private-name</script>',rows:[{email:'private@example.test'}],schema:[{sample:'never-send'}]}});
 assert.equal(f.calls.length,1,'mount only instantiates organization UI, with no transport');
 assert.equal(f.calls[0].options.samplePack,'general');
 assert.equal(f.orgState.department,'data');assert.equal(f.orgState.includeCompany,false);
 assert.ok(f.host.innerHTML.includes('이 데이터의 의미를 지식으로 남기기'));
 assert.ok(!f.host.innerHTML.includes('private@example.test'));
 await f.click('reveal');assert.equal(f.calls.length,1,'revealing scope does not connect or save');
 assert.match(f.host.innerHTML,/데이터 공개 범위와 KB 세션은 별개/);assert.match(f.host.innerHTML,/만료/);
 await f.click('connect');assert.equal(f.calls.at(-1).action,'session');assert.equal(f.mounts.at(-1),'library');
 await f.click('draft');
 const request=f.calls.find(c=>c.action==='data-draft');assert.deepEqual(JSON.parse(JSON.stringify(request.payload)),{dataset_id:'data-1',visibility:'department'});
 assert.equal(request.department,'data');assert.deepEqual(f.opens,['doc-1']);
 assert.equal(f.controller.getState().draft.identifier,'DATA-GUIDE-1');
 assert.match(f.host.querySelector('[data-knowledge-region="actions"]').innerHTML,/DATA-GUIDE-1/);
 const beforeQuery=f.calls.length;await f.click('query');assert.equal(f.mounts.at(-1),'chat');assert.equal(f.calls.length,beforeQuery,'opening questions must not query or generate');
 await f.click('manifest');assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1).payload)),{id:'doc-1'});assert.equal(f.controller.getState().manifest.status,'active');
 f.setHandler(async()=>{throw Error('데이터 출처가 만료되었습니다.')});await f.click('manifest');assert.equal(f.controller.getState().manifest,null,'failed revalidation must discard previously displayed metadata');assert.match(f.controller.getState().error,/만료/);
 assert.equal(f.calls.some(c=>['save','review','promote','chat','embedding'].includes(c.action)),false,'bridge never automatically reviews, promotes, queries or embeds');

 // Selecting another organization immediately removes the old organization document handle.
 f.orgState.org='beta';f.host.dispatch('change',{dataset:{orgControl:'org'}});
 assert.equal(f.controller.getState().draft,null);assert.equal(f.controller.getState().manifest,null);
 assert.doesNotMatch(f.host.querySelector('[data-knowledge-region="actions"]').innerHTML,/DATA-GUIDE-1/);
 f.setHandler(async()=>{throw Error('현재 조직에서 이 데이터에 접근할 수 없습니다.')});await f.click('draft');
 assert.match(f.controller.getState().error,/접근할 수 없습니다/);assert.equal(f.opens.length,1);
 assert.equal(f.controller.getState().draft,null,'denied source cannot become a local draft');

 // Late success for a previously selected dataset cannot open that document in the new view.
 const pending=deferred();f.setHandler(()=>pending.promise);const late=f.click('draft');
 const nextCleanup=f.controller.mount(f.host,{dataset:{id:'data-2'}});cleanup();
 pending.resolve({id:'stale-document',version:1,state:'draft',identifier:'STALE'});await late;
 assert.equal(f.controller.getState().datasetId,'data-2');assert.equal(f.controller.getState().draft,null);assert.equal(f.opens.includes('stale-document'),false);assert.equal(f.controller.getState().busy,false);
 await f.click('reveal');assert.ok(f.host.querySelector('[data-knowledge-region="actions"]'),'old cleanup cannot clear new mount');

 // A scope change while a request is in flight also suppresses the old response.
 const scoped=deferred();f.setHandler(()=>scoped.promise);const scopedLate=f.click('draft');
 f.orgState.department='hr';f.host.dispatch('change',{dataset:{orgControl:'department'}});
 scoped.resolve({id:'wrong-department-document',version:1,state:'draft',identifier:'WRONG'});await scopedLate;
 assert.equal(f.controller.getState().draft,null);assert.equal(f.opens.includes('wrong-department-document'),false);

 // Escape server labels and reject responses that skip the mandatory draft state.
 f.setHandler(async()=>({id:'confirmed-document',state:'confirmed',version:1}));await f.click('draft');
 assert.equal(f.controller.getState().draft,null);assert.match(f.controller.getState().error,/미확인 초안 응답/);
 f.setHandler(async()=>({id:'doc-safe',state:'draft',version:2,identifier:'<img src=x onerror=alert(1)>'}));await f.click('draft');
 assert.match(f.host.querySelector('[data-knowledge-region="actions"]').innerHTML,/&lt;img/);
 assert.doesNotMatch(f.host.querySelector('[data-knowledge-region="actions"]').innerHTML,/<img/);
 nextCleanup();assert.equal(f.host.listeners.size,0,'cleanup removes the delegated scope listener');

 // Run the real organization controller against a mock HTTP provider as a contract check.
 const http=[],document={id:'integrated-doc',version:1,state:'draft',department:'data',content:'Metadata guide',title:'Data guide',identifier:'DATA-INTEGRATED'};
 const integrated=vm.createContext({window:{KNOWHOW_CONFIG:{aiRequestsPaused:true}},AbortSignal,TextEncoder,fetch:async(url,options)=>{
  const payload=JSON.parse(options.body);http.push({url,payload});
  const response=url.endsWith('/session')?{session_id:'integration-session',organizations:['alpha','beta'],departments:['operations','data','hr']}:url.endsWith('/catalog')?{documents:[document]}:url.endsWith('/data-draft')?document:url.endsWith('/document')?document:{};
  return {ok:true,json:async()=>response};
 }});
 for(const path of ['src/organization-kb.js','src/data-knowledge-bridge.js'])vm.runInContext(fs.readFileSync(path,'utf8'),integrated);
 const realBridge=integrated.window.KnowHowDataKnowledgeBridge.createController({apiBase:'https://mock.test/knowhow'}),realHost=new Host();
 realBridge.mount(realHost,{dataset:{id:'integrated-dataset'}});assert.equal(http.length,0);
 realHost.querySelector('[data-knowledge-action="reveal"]').onclick();
 await realHost.querySelector('[data-knowledge-region="actions"]').querySelector('[data-knowledge-action="connect"]').onclick();
 await realHost.querySelector('[data-knowledge-region="actions"]').querySelector('[data-knowledge-action="draft"]').onclick();
 assert.deepEqual(http.map(call=>call.url.split('/').at(-1)),['session','catalog','data-draft','catalog','document']);
 assert.equal(http[2].payload.session_id,'integration-session');assert.equal(http[2].payload.org,'alpha');assert.equal(http[2].payload.department,'data');assert.equal(http[2].payload.sample_pack,'general');assert.equal(http[2].payload.visibility,'department');
 assert.equal(realBridge.getState().draft.id,'integrated-doc');assert.equal(http.some(call=>call.payload.generate),false);
 realBridge.destroy();
 console.log('PASS: explicit metadata draft flow; no automatic API, review, AI or promotion; denial; dataset/scope response isolation; escaped identifiers');
})().catch(error=>{console.error(error);process.exitCode=1});
