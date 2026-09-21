// Security regression: public sample transport cannot carry an organization session.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map();
const element=k=>{if(!elements.has(k))elements.set(k,{department:{},classList:{toggle(){}},querySelectorAll:()=>[]});return elements.get(k)};
const storage=new Map([['org-records','must remain untouched']]);
const context=vm.createContext({console,URL,AbortSignal,setTimeout,crypto:require('node:crypto').webcrypto,window:{KNOWHOW_CONFIG:{apiBase:'https://api.example/knowhow'}},document:{querySelector:element,querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},fetch:null});
vm.runInContext(fs.readFileSync('src/app.js','utf8'),context);
// Expose closure methods only inside this test context.
vm.runInContext(fs.readFileSync('src/demo.js','utf8').replace('return {activate,deactivate,isActive:()=>active}','return {activate,deactivate,isActive:()=>active,request,read,write,applySaved,getState:()=>state}'),context);
const exec=s=>vm.runInContext(s,context);
(async()=>{
 exec("token='organization-secret';user={org:'private',name:'private'};sampleDemo.activate()");
 assert.equal(exec('token'),'');assert.equal(exec('user'),null);
 let capture;
 context.fetch=async(url,options)=>{capture={url,options};return {ok:true,json:async()=>({stations:[]})}};
 await exec("sampleDemo.request('search',{q:'GS타워'})");
 assert.equal(capture.url,'https://api.example/knowhow/demo/workflow/search');assert.equal(capture.options.credentials,'omit');assert.equal(capture.options.headers.Authorization,undefined);
 exec("sampleDemo.write([{id:'sample',versions:[{version:2,state:'정정',content:'corrected'}]}])");
 assert.equal(storage.get('org-records'),'must remain untouched');assert.equal(exec('sampleDemo.read()[0].versions[0].version'),2);
 exec("sampleDemo.applySaved({id:'sample',versions:[{version:2,state:'정정',content:'corrected'}],inquiry:{synthetic_mapping:[{app_charger_id:'old'}]}})");
 assert.ok(exec('sampleDemo.getState().inquiry.draft').startsWith('corrected\n\n이번 후속 문의:'));assert.equal(exec('sampleDemo.getState().inquiry.synthetic_mapping.length'),0);
 let release;context.fetch=()=>new Promise(r=>release=r);
 const pending=exec("sampleDemo.request('search',{q:'GS타워'}).catch(e=>e.constructor.name)");exec('sampleDemo.deactivate()');release({ok:true,json:async()=>({stations:['late']})});assert.equal(await pending,'StaleSessionError');
 console.log('PASS: no organization token/cookies, isolated browser storage, latest corrected body, stale mode response discarded');
})().catch(e=>{console.error(e);process.exitCode=1});
