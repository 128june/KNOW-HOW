const fs=require('node:fs'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tests/company-live.cjs','utf8').split('(async()=>{')[0];
const {setup,selection,response,credential}=new Function('require',harness+'\nreturn {setup,selection,response,credential};')(require);

(async()=>{
 const {api,c,storage}=setup();
 const originalStorage=JSON.stringify([...storage]),calls=[];
 let release;
 c.fetch=async(url,options)=>{
  calls.push(url);
  if(url.endsWith('/station-contexts/resolve'))return response({...selection,capabilities:{workspace_sharing:true}});
  assert(url.endsWith('/kb/catalog'));
  return new Promise(resolve=>{release=version=>resolve(response({documents:[{id:'e'.repeat(32),version,department:'device',content:'Latest document',source:{kind:'data-platform-guide',context_id:selection.context_id,dataset_id:selection.dataset_id}}],capabilities:{workspace_sharing:true}}))});
 };
 await api.openVisitorContext({apiBase:'http://127.0.0.1:18777/data-platform',visitorBearer:credential,contextId:selection.context_id});
 api.state.loaded=true;api.state.documents=[]; // Catalog predates newly saved KB.
 c.location.hash='#scenario-5-live';
 const first=api.activate();
 api.activate(); // Multiple hash listeners must not issue another request.
 await Promise.resolve();
 assert.equal(calls.filter(url=>url.endsWith('/kb/catalog')).length,1);
 release(2);await first;
 assert.equal(api.state.documents[0].version,2);
 c.location.hash='#scenario-2-live';api.activate();
 c.location.hash='#scenario-5-live';const second=api.activate();
 await Promise.resolve();
 release(3);await second;
 assert.equal(api.state.documents[0].version,3);
 assert.equal(calls.filter(url=>url.endsWith('/kb/catalog')).length,2);
 assert(!calls.some(url=>/\/(session|save|review|chat)$/.test(url)));
 assert.equal(JSON.stringify([...storage]),originalStorage);
 console.log('PASS: hash/back-style collection entry refreshes current visitor documents and deduplicates simultaneous activation');
})().catch(error=>{console.error(error);process.exitCode=1});
