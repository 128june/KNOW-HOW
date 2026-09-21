const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
const element = key => {if(!elements.has(key))elements.set(key,{textContent:'',innerHTML:'',classList:{toggle(){}},querySelectorAll:()=>[]});return elements.get(key)};
const context = vm.createContext({console,URL,AbortSignal,setTimeout,window:{KNOWHOW_CONFIG:{}},document:{querySelector:element,querySelectorAll:()=>[]},fetch:null});
vm.runInContext(fs.readFileSync('src/app.js','utf8'),context);
const exec = code=>vm.runInContext(code,context);

context.crypto={randomUUID:()=> 'request-once'};
exec("workflow.inquirySelection={station_key:'station',record_keys:['row'],department:'app',question:'앱 문의'};page='ask'");
element('#kb-scope').value='private';let calls=[];
context.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));throw new TypeError('lost response')};
(async()=>{
 await exec('saveWorkflowKB()');
 context.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({id:72,state:'초안',replayed:true})}};
 await exec('saveWorkflowKB()');await exec('saveWorkflowKB()');
 assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].request_id,'request-once');assert.equal(exec('workflow.savedId'),72);
 assert.ok(exec("sourceMarkup({dataset_scope: 'sample_subset',row_count:50})").includes("sample_subset") === false);
 assert.ok(exec("sourceMarkup({dataset_scope: 'sample_subset',row_count:50})").includes("50"));
 const markup=exec("mappingMarkup([{public_charger_id:'01',app_charger_id:'APP-01',device_charger_id:'DEV-01'}])");
 for(const text of ['샘플 DB 기준','앱개발팀이 사용하는 충전기 ID','충전기개발팀이 사용하는 충전기 ID','APP-01','DEV-01'])assert.ok(markup.includes(text));
 exec("workflow.savedId=null;workflow.saveRequest=null");let release;context.fetch=()=>new Promise(r=>release=r);
 const pending=exec('saveWorkflowKB()');exec('workflow.inquirySelection=null');release({ok:true,json:async()=>({id:73,state:'초안'})});await pending;assert.equal(exec('workflow.savedId'),null);
 console.log('PASS: retry uses identical idempotent body; saved guide cannot double-save; department IDs distinct; changed selection ignores late save');
})().catch(e=>{console.error(e);process.exitCode=1});
