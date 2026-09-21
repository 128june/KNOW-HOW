const fs=require('node:fs'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tests/company-live.cjs','utf8').split('(async()=>{')[0].replace('request,render};','request,render,draftSource,refreshDocument,revisionIsStale,rebaseRevision,correctView,selectDocument};');
const {setup,response,selection,credential}=new Function('require',harness+'\nreturn {setup,response,selection,credential};')(require);
const clone=x=>JSON.parse(JSON.stringify(x));

(async()=>{
 for(const visitor of [false,true]){
  const {api,c,nodes}=setup('#scenario-3');let doc,calls=[];
  c.fetch=async(url,options)=>{
   const b=JSON.parse(options.body||'{}'),action=url.split('/').at(-1);calls.push({action,b});
   if(action==='resolve')return response(selection);
   if(action==='document')return response(doc);
   if(action==='compare-versions')return response({before:doc.history[0],after:doc.history.at(-1)});
   if(action==='revise'){
    if(b.version!==doc.version)return response({error:'현재 버전을 다시 확인하세요.'},409);
    if(visitor){assert.equal(b.source,undefined);assert.equal(b.identifiers,undefined)}
    doc={...doc,version:doc.version+1,state:'draft',content:b.content,source:b.source||doc.source};
    doc.history.push({version:doc.version,state:'draft',content:doc.content});return response(doc);
   }
   throw Error(action);
  };
  if(visitor)await api.openVisitorContext({apiBase:'http://127.0.0.1:18778/data-platform',visitorBearer:credential,contextId:selection.context_id});
  else {api.activate();api.state.session='revision-test'}
  const source=visitor?{kind:'data-platform-guide',context_id:selection.context_id,dataset_id:selection.dataset_id}:clone(api.draftSource());
  doc={id:'e'.repeat(32),department:visitor?'device':'app',title:'Current policy',version:1,state:'confirmed',source,content:'Original policy',comments:[{id:'comment1',body:'Include incident time',resolved_version:null}],history:[{version:1,state:'confirmed',content:'Original policy'}]};
  api.state.document=clone(doc);api.state.role='reviewer';
  const input={id:doc.id,version:1,content:'Original policy\nLocal condition',reason:'Add condition',department_identifier:source.department_identifier||'',resolve_comment_ids:['comment1']};
  doc={...doc,version:2,content:'Original policy\nConcurrent condition',state:'draft'};doc.history.push({version:2,state:'draft',content:doc.content});
  await assert.rejects(()=>api.reviseDocument(input),/버전/);assert.equal(api.state.revisionDraft.version,1);assert.equal(api.state.document.version,1);
  await api.refreshDocument();assert.equal(api.state.document.version,2);assert(api.revisionIsStale());assert.equal(api.state.revisionDraft.content,input.content);assert.deepEqual(clone(api.state.revisionDraft.resolve_comment_ids),['comment1']);
  assert.match(api.correctView(),/data-company-action="rebase-revision"[^>]*type="button"/);assert.match(api.correctView(),/value="comment1" checked/);assert.match(api.correctView(),/class="primary" disabled>정정본/);
  let count=calls.length;await assert.rejects(()=>api.reviseDocument(input),/기준 버전/);assert.equal(calls.length,count,'stale known input blocked before HTTP');
  // Navigation preserves the source version, not the newly fetched version.
  api.selectDocument({id:'other',version:9});assert.equal(api.state.revisionDraft,null);api.selectDocument(clone(doc));assert.equal(api.state.revisionDraft.version,1);assert(api.revisionIsStale());
  api.rebaseRevision();assert.equal(calls.length,count,'explicit rebase is local');assert.equal(api.state.revisionDraft.version,2);assert.equal(api.state.revisionDraft.content,input.content);assert(!api.revisionIsStale());
  // Another author can change the server again after explicit rebase.
  doc={...doc,version:3,content:doc.content+'\nAnother concurrent condition'};doc.history.push({version:3,state:'draft',content:doc.content});
  await assert.rejects(()=>api.reviseDocument({...api.state.revisionDraft}),/버전/);assert.equal(api.state.revisionDraft.version,2);
  await api.refreshDocument();assert(api.revisionIsStale());assert.equal(api.state.revisionDraft.version,2);api.rebaseRevision();
  await api.reviseDocument({...api.state.revisionDraft,content:doc.content+'\nLocal condition'});
  assert.equal(doc.version,4);assert(doc.content.includes('Concurrent condition'));assert(doc.content.includes('Another concurrent condition'));assert(doc.content.includes('Local condition'));assert.deepEqual(clone(doc.source),source);assert.equal(doc.state,'draft');assert.equal(api.state.revisionDraft,null);
  assert.equal(calls.filter(x=>x.action==='revise').length,3,'two conflicts and one successful write');assert.equal(calls.filter(x=>['chat','review','promote'].includes(x.action)).length,0);
  api.state.revisionDraft={...input,id:'wrong'};count=calls.length;assert.throws(()=>api.rebaseRevision(),/현재 문서/);await assert.rejects(()=>api.reviseDocument({...api.state.revisionDraft}),/기준 버전/);assert.equal(calls.length,count);
  assert(!JSON.stringify(api.state).includes(credential));
 }
 console.log('PASS: standard and visitor drafts bind document/version; 409 and refresh retain input; stale write blocked before HTTP; explicit local rebase; repeat conflict; per-document navigation; source retained; no automatic review or AI');
})().catch(e=>{console.error(e);process.exitCode=1});
