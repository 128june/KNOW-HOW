const fs=require('node:fs'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tests/company-live.cjs','utf8').split('(async()=>{')[0].replace('request,render};','request,render,loadMapping,mappingReference,draftSource,initialContent,resetContext,currentId,emptyDocument,saveDraft};');
const {setup,response}=new Function('require',harness+'\nreturn {setup,response};')(require);
const clone=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const {api,c}=setup('#scenario-1');api.activate();
 const fixture=c.window.KNOWHOW_EXAMPLE;
 assert.equal(api.mappingReference().field,'app_charger_id');
 api.state.source.original_sha256='changed';assert.equal(api.mappingReference(),null,'embedded mapping requires same source fingerprint');api.state.source=clone(fixture.source);
 const station={...clone(api.state.station),station_key:'server-station-key'};
 const selected=clone(fixture.chargers.find(c=>c.charger_id==='02'));
 Object.assign(api.state,{station,chargers:[selected],recordKey:selected.record_key});api.resetContext();
 const mapping={...clone(fixture.inquiries.app.synthetic_mapping[0]),record_key:selected.record_key,public_charger_id:'02',app_charger_id:'DEMO-APP-80fc20c9c26c64aa',device_charger_id:'DEMO-DEVICE-80fc20c9c26c64aa'};
 api.state.loaded=true;assert(!api.emptyDocument().includes('data-company-action="compose"'),'catalog-first navigation does not skip selected mapping lookup');await assert.rejects(()=>api.saveDraft({content:'no lookup'}),/부서 KB를 먼저/);
 const result=()=>({department:api.state.department,station:clone(station),chargers:[clone(selected)],source:clone(api.state.source),context:{station_key:station.station_key,record_keys:[selected.record_key]},synthetic_mapping:[clone(mapping)]});
 let calls=[],alter=x=>x;
 c.fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});assert(url.endsWith('/workflow/inquiry'));assert.deepEqual(body,{station_key:station.station_key,record_keys:[selected.record_key],department:api.state.department});return response(alter(result()))};
 assert.equal(api.mappingReference(),null,'unqueried02 is not inferred from01');
 await api.loadMapping();assert.equal(api.mappingReference().value,mapping.app_charger_id);assert(api.emptyDocument().includes('data-company-action="compose"'));assert.equal(api.mappingReference().table,'app_development_chargers');
 assert.match(api.initialContent(),/조회 필드: app_charger_id/);assert(!api.initialContent().includes(mapping.device_charger_id));assert.equal(api.draftSource().mapping_reference.source_record_key,selected.record_key);
 assert(Buffer.byteLength(JSON.stringify(api.draftSource()))<=4000);
 api.state.department='device';api.resetContext();assert.equal(api.mappingReference(),null,'department switch clears previous ID');await api.loadMapping();assert.equal(api.mappingReference().value,mapping.device_charger_id);assert.match(api.initialContent(),/device_development_chargers/);assert(!api.initialContent().includes(mapping.app_charger_id));
 for(const mutate of [
  r=>r.department='app',r=>r.context.record_keys=['wrong-row'],r=>r.station.station_key='another-station',
  r=>r.chargers[0].fields['운영기관']='다른 운영사',r=>r.chargers[0].source.rowid++,r=>r.source.original_sha256='different',
  r=>r.synthetic_mapping[0].record_key='wrong-row',r=>r.synthetic_mapping[0].public_charger_id='01',r=>r.synthetic_mapping[0].synthetic=false,
  r=>r.synthetic_mapping.push(clone(mapping)),r=>r.synthetic_mapping[0].device_charger_id='',
 ]){alter=r=>{mutate(r);return r};await api.loadMapping();assert.equal(api.mappingReference(),null);assert(api.state.mappingError,'mismatched result remains visibly failed');assert.equal(api.draftSource().department_identifier,'')}
 alter=r=>{r.synthetic_mapping=[];return r};await api.loadMapping();assert.equal(api.state.mappingError,'');assert.equal(api.mappingReference(),null,'valid absent mapping remains unknown');assert(!api.initialContent().includes('DEMO-'));
 // A real failed lookup cannot silently replace evidence with the embedded01 example.
 Object.assign(api.state,{chargers:clone(fixture.chargers),recordKey:fixture.selected_record_key});api.resetContext();assert(api.mappingReference());
 c.fetch=async()=>{throw Error('offline')};await api.loadMapping();assert.equal(api.mappingReference(),null);assert.match(api.state.mappingError,/서버/);
 // Existing KB source wins and is never refreshed implicitly with a different mapping.
 const doc={id:'saved',department:'device',version:2,history:[],source:{kind:'company_charger_knowledge',station,record_key:api.state.recordKey,department_identifier:'HUMAN-REVIEWED-ID'}};
 c.fetch=async(url)=>{if(url.endsWith('/session'))return response({session_id:'local-test'});if(url.endsWith('/catalog'))return response({documents:[doc]});if(url.endsWith('/document'))return response(doc);throw Error('existing KB must not request new mapping')};
 await api.openSelected();assert.equal(api.currentId(),'HUMAN-REVIEWED-ID');assert.deepEqual(clone(api.state.document.source),doc.source);
 // Context changes discard late API mappings, including failures.
 api.resetContext();let release;c.fetch=()=>new Promise(resolve=>release=resolve);const pending=api.loadMapping();api.resetContext();release(response(result()));await assert.rejects(()=>pending,e=>e.constructor.name==='Obsolete');assert.equal(api.state.mapping,null);assert.equal(api.state.mappingLoaded,false);
 let rejectBody,notifyBody;const bodyStarted=new Promise(resolve=>{notifyBody=resolve});c.fetch=async()=>({ok:true,json:()=>new Promise((resolve,reject)=>{rejectBody=reject;notifyBody()})});const bad=api.loadMapping();await bodyStarted;api.resetContext();rejectBody(Error('bad JSON'));await assert.rejects(()=>bad,e=>e.constructor.name==='Obsolete');assert.equal(api.state.mappingError,'');
 assert(calls.every(c=>c.body.generate===undefined));
 console.log('PASS: selected app/device ID and schema, exact row/source guards, missing vs failed lookup, no fallback after error, existing KB preserved, stale response discarded, no AI');
})().catch(error=>{console.error(error);process.exitCode=1});
