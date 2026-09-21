const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
const element = key => {if(!elements.has(key))elements.set(key,{textContent:'',innerHTML:'',classList:{toggle(){}},querySelectorAll:()=>[]});return elements.get(key)};
const context = vm.createContext({console,URL,AbortSignal,setTimeout,window:{KNOWHOW_CONFIG:{}},document:{querySelector:element,querySelectorAll:()=>[]},fetch:null});
vm.runInContext(fs.readFileSync('src/app.js','utf8'),context);
const exec = code=>vm.runInContext(code,context);

const station={station_key:'opaque-station',name:'가상 장소',address:'가상 주소',operator:'가상 운영사',row_count:2};
const charger={record_key:'opaque-row',charger_id:'01',type:'가상 형식',source:{rowid:8}};
context.testStation=station;context.testCharger=charger;
exec("workflow.station=testStation;workflow.chargers=[testCharger];workflow.keys=['opaque-row'];workflow.question='내부 장비와 어떻게 연결하나요?';page='ask'");
let posted;
context.fetch=async(url,options)=>{posted=JSON.parse(options.body);return {ok:true,json:async()=>({draft:'가상 초안',context:{station_key:station.station_key,record_keys:['opaque-row']}})}};
(async()=>{
 await exec('createInquiry()');
 assert.deepEqual(posted,{station_key:'opaque-station',record_keys:['opaque-row'],question:'내부 장비와 어떻게 연결하나요?'});
 const contextText=exec('workflowContext()');for(const part of ['가상 장소','가상 주소','가상 운영사','01','미확인'])assert.ok(contextText.includes(part));
 let release;context.fetch=()=>new Promise(r=>release=r);
 const old=exec('createInquiry()');exec('workflow.revision++;workflow.inquiry=null');release({ok:true,json:async()=>({draft:'stale'})});await old;assert.equal(exec('workflow.inquiry'),null);
 exec('clearWorkflow()');assert.equal(exec('workflow.station'),null);assert.equal(exec('workflow.keys.length'),0);
 console.log('PASS: selected station/rows retained in follow-up, unverified mapping explicit, stale response discarded, account reset');
})().catch(e=>{console.error(e);process.exitCode=1});
