const fs=require('node:fs'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tests/company-live.cjs','utf8').split('(async()=>{')[0].replace('request,render};','request,render,sharedAdapter};');
const {setup,selection,response,credential}=new Function('require',harness+'\nreturn {setup,selection,response,credential};')(require);
(async()=>{
 const {api,c,storage,nodes}=setup();const before=JSON.stringify([...storage]);const calls=[];
 c.fetch=async(url,options)=>{const body=JSON.parse(options.body||'{}');calls.push({url,body,headers:options.headers});if(url.endsWith('/station-contexts/resolve'))return response({...selection,capabilities:{workspace_sharing:true}});return response({documents:[],capabilities:{workspace_sharing:true}})};
 await api.openVisitorContext({apiBase:'http://127.0.0.1:18773/data-platform',visitorBearer:credential,contextId:selection.context_id});
 const adapter=api.sharedAdapter();await adapter.request('catalog',{department:'app',scope:'company'});assert.equal(calls.at(-1).body.department,'app');assert.equal(api.state.department,'device','browsing another department cannot replace selected source ownership');assert.equal(calls.at(-1).headers.Authorization,'Bearer '+credential);assert.equal(calls.at(-1).body.org,undefined);assert.equal(calls.at(-1).body.session_id,undefined);
 await adapter.request('chat',{department:'app',document_id:'a'.repeat(32),include_company:true,question:'Shared current document',generate:false});assert.equal(calls.at(-1).body.include_company,true);assert.equal(calls.at(-1).body.department,'app');assert.equal(api.state.department,'device');
 const count=calls.length;await assert.rejects(()=>adapter.request('promote',{id:'a'.repeat(32),version:1,department:'app'}),/원문 부서/);await assert.rejects(()=>adapter.request('save',{department:'device'}));assert.equal(calls.length,count);assert.equal(JSON.stringify([...storage]),before);assert.ok(!JSON.stringify(adapter.context).includes(credential));
 c.fetch=async()=>response({error:'Forbidden'},403);await assert.rejects(()=>adapter.request('document',{department:'app',id:'a'.repeat(32),include_company:true}));assert.ok(nodes.get('#page').innerHTML.includes('입수한 자료에서 다시 선택'));assert.ok(!nodes.get('#page').innerHTML.includes('Fresh selected station'));
 api.deactivate();await assert.rejects(()=>adapter.request('catalog',{department:'device',scope:'company'}));assert.equal(calls.length,count);
 console.log('PASS: shared company adapter keeps visitor memory transport, explicit read department/company scope, immutable source owner, no independent session/save, stale adapter blocked');
})().catch(e=>{console.error(e);process.exitCode=1});
