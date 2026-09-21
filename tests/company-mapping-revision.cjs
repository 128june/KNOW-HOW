const fs=require('node:fs'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tests/company-live.cjs','utf8').split('(async()=>{')[0].replace('request,render};','request,render,resetContext,draftSource,currentId,checkDocumentMapping,stageMappingRevision,mappingRevisionPane,selectDocument,refreshDocument,rebaseRevision};');
const {setup,response,selection,credential}=new Function('require',harness+'\nreturn {setup,response,selection,credential};')(require),clone=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 for(const department of ['app','device']){
  const {api,c}=setup('#scenario-3');api.activate();api.state.session='mapping-test';
  const fixture=c.window.KNOWHOW_EXAMPLE,charger=clone(fixture.chargers.find(x=>x.charger_id==='02'));
  Object.assign(api.state,{department,station:{...clone(fixture.station),station_key:'full-index-key'},chargers:[charger],recordKey:charger.record_key});api.resetContext();api.state.role='reviewer';
  const originalSource={...clone(api.draftSource()),mapping_status:'unconfirmed',department_identifier:''};delete originalSource.mapping_reference;
  let doc={id:'old-document',department,version:1,state:'confirmed',content:'Original policy\nOriginal reviewed condition',source:originalSource,comments:[],history:[]};
  api.state.document=clone(doc);let calls=[],mode='found';
  const mapping={...clone(fixture.inquiries[department].synthetic_mapping[0]),record_key:charger.record_key,public_charger_id:'02',app_charger_id:'DEMO-APP-02',device_charger_id:'DEMO-DEVICE-02'};
  c.fetch=async(url,options)=>{
   const body=JSON.parse(options.body),action=url.split('/').at(-1);calls.push({action,body});
   if(action==='inquiry'){
    if(mode==='failure')return response({error:'Unavailable'},503);
    return response({department,station:clone(api.state.station),chargers:[clone(charger)],source:clone(api.state.source),context:{station_key:api.state.station.station_key,record_keys:[charger.record_key]},synthetic_mapping:mode==='absent'?[]:[clone(mapping)]});
   }
   if(action==='document')return response(doc);
   if(action==='revise'){
    if(body.version!==doc.version)return response({error:'현재 버전을 다시 확인하세요.'},409);
    doc={...doc,version:doc.version+1,state:'draft',content:body.content,source:body.source};return response(doc);
   }
   throw Error(action);
  };
  const initial=JSON.stringify(doc);api.state.role='member';await assert.rejects(()=>api.checkDocumentMapping(),/담당자/);assert.equal(calls.length,0);api.state.role='reviewer';
  await api.checkDocumentMapping();assert.equal(JSON.stringify(doc),initial);assert.equal(api.currentId(),'');assert.equal(calls.filter(x=>x.action==='revise').length,0);
  const id=mapping[department==='app'?'app_charger_id':'device_charger_id'];assert(api.mappingRevisionPane(doc).includes(id));
  api.state.revisionDraft={id:doc.id,version:1,content:doc.content+'\nUnsent human condition',reason:'Keep this reason',resolve_comment_ids:['comment1']};
  api.stageMappingRevision();const staged=clone(api.state.revisionDraft);assert.equal(staged.department_identifier,id);assert(staged.content.startsWith(doc.content+'\nUnsent human condition'));assert(staged.content.includes(id));assert(staged.content.includes(charger.record_key));assert.equal(staged.reason,'Keep this reason');assert.deepEqual(staged.resolve_comment_ids,['comment1']);assert.equal(JSON.stringify(doc),initial);assert.equal(calls.filter(x=>x.action==='revise').length,0);
  api.stageMappingRevision();assert.equal(api.state.revisionDraft.content,staged.content,'repeat staging does not duplicate same evidence');
  api.selectDocument({id:'another',version:1});assert.equal(api.state.mappingCheck,null);assert.equal(api.state.revisionDraft,null);api.selectDocument(clone(doc));assert.deepEqual(clone(api.state.revisionDraft),staged);
  let count=calls.length;await assert.rejects(()=>api.reviseDocument({...staged,department_identifier:'OTHER-ID'}),/준비/);assert.equal(calls.length,count);api.state.revisionDraft=clone(staged);
  doc={...doc,version:2,content:doc.content+'\nConcurrent condition'};await api.refreshDocument();await assert.rejects(()=>api.reviseDocument({...api.state.revisionDraft}),/기준 버전/);
  api.rebaseRevision();await api.reviseDocument({...api.state.revisionDraft,content:doc.content+'\n'+staged.content.slice(staged.content.indexOf('[정정에 사용할'))});
  assert.equal(doc.id,'old-document');assert.equal(doc.version,3);assert.equal(doc.state,'draft');assert.equal(doc.source.department_identifier,id);assert.equal(doc.source.mapping_status,'synthetic_fixture');assert.equal(doc.source.mapping_reference.value,id);assert.equal(doc.source.mapping_reference.source_record_key,charger.record_key);assert.deepEqual(clone(doc.source.public_source),originalSource.public_source);assert.deepEqual(clone(doc.source.station),originalSource.station);assert.equal(doc.source.record_key,originalSource.record_key);assert(!Object.hasOwn(calls.findLast(x=>x.action==='revise').body,'mapping_reference'),'reference is source metadata, not unknown API field');assert.equal(api.state.mappingCheck,null);
  await api.checkDocumentMapping();assert(!api.mappingRevisionPane(doc).includes('data-company-action="stage-mapping"'));assert.throws(()=>api.stageMappingRevision(),/이미/);
  mode='absent';await api.checkDocumentMapping();assert.equal(api.state.mappingCheck.reference,null);assert.throws(()=>api.stageMappingRevision(),/먼저 대조/);assert.equal(doc.source.department_identifier,id);
  mode='failure';await api.checkDocumentMapping();assert(api.mappingRevisionPane(doc).includes('확인하지 못했습니다'));assert.throws(()=>api.stageMappingRevision(),/먼저 대조/);assert.equal(doc.source.department_identifier,id);
  assert(!calls.some(x=>['save','review','chat','promote'].includes(x.action)));
 }
 // An in-flight lookup cannot put evidence on another document.
 const x=setup('#scenario-3');x.api.activate();x.api.state.role='reviewer';x.api.state.session='late';x.api.state.station.station_key='full-index';x.api.state.document={id:'first',version:1,department:'app',source:clone(x.api.draftSource())};
 let release;x.c.fetch=()=>new Promise(resolve=>release=resolve);const pending=x.api.checkDocumentMapping();x.api.selectDocument({id:'second',version:1});release(response({error:'failed'},503));await assert.rejects(()=>pending,e=>e.constructor.name==='Obsolete');assert.equal(x.api.state.mappingCheck,null);
 const live=setup();live.c.fetch=async()=>response(selection);await live.api.openVisitorContext({apiBase:'http://127.0.0.1:18778/data-platform',visitorBearer:credential,contextId:selection.context_id});live.api.state.role='reviewer';assert.equal(live.api.mappingRevisionPane({}), '');await assert.rejects(()=>live.api.checkDocumentMapping(),/담당자/);assert.throws(()=>live.api.stageMappingRevision(),/먼저 대조/);
 console.log('PASS: explicit read-only mapping comparison; existing KB preserved; staged evidence/body/reason/comment retained; doc switch and version conflict; same-document source revision; unchanged/missing/failed mapping does not write; visitor path remains immutable; no review/share/AI');
})().catch(e=>{console.error(e);process.exitCode=1});
