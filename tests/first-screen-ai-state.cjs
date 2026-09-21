'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Exercise rendered states directly: no API response fixtures, requests or model calls.
const harness=fs.readFileSync('tests/company-live.cjs','utf8').split('(async()=>{')[0]
 .replace('request,render};','request,render,reuseView,setLiveForRender:value=>{live=value}};');
const {setup,selection}=new Function('require',harness+'\nreturn {setup,selection};')(require);
const {api,c}=setup();let calls=0;
c.fetch=()=>{calls++;throw Error('State-only rendering must not issue a request');};
const document={id:'render-only-document',title:'상태 검사 전용 문서',department:'device',version:2,content:'렌더 검사 입력입니다. 실제 조회 결과가 아닙니다.',source:{},comments:[]};
const generationModes=[null,{knowledge_generation:false,inquiry_generation:false},{knowledge_generation:true,inquiry_generation:true}];
let count=0;
for(const capabilities of generationModes){
 api.setLiveForRender(capabilities?{context:selection,capabilities}:null);
 for(const paused of [true,false,undefined]){
  c.window.KNOWHOW_CONFIG.aiRequestsPaused=paused;
  for(const state of ['confirmed','draft','rejected']){
   api.state.document={...document,state};
   const html=api.reuseView().match(/<form id="company-ask"[\s\S]*?<\/form>/)[0];
   const sourceButton=html.match(/<button data-generate="false"[^>]*>/)[0];
   const generationButton=html.match(/<button class="primary" data-generate="true"[^>]*>/)?.[0];
   const pending=state!=='confirmed',stopped=paused!==false;
   assert.equal(sourceButton.includes('disabled'),pending,'review requirement is independent of AI pause');
   assert.equal(html.includes('AI 답변 생성 중지'),stopped,'pause=false must remove the stopped notice');
   assert.equal(html.includes('AI 답변 생성 중지 · 원문 근거 조회 가능'),stopped&&!pending,'do not promise current access when review blocks it');
   assert.equal(html.includes('<p>현재 버전의 검토 완료 후 원문 근거 조회 가능</p>'),pending,'review blocker remains a separate notice');
   if(stopped)assert(!html.includes('별도 생성 버튼'),'paused view must not invite generation');
   if(generationButton)assert.equal(generationButton.includes('disabled'),pending||stopped);
   else assert(capabilities&&!capabilities.knowledge_generation&&!capabilities.inquiry_generation,'unsupported live generation stays hidden');
   count++;
  }
 }
}
// State changes must remove a stale pause notice without navigation or an API request.
api.setLiveForRender(null);api.state.document={...document,state:'confirmed'};
c.window.KNOWHOW_CONFIG.aiRequestsPaused=true;assert(api.reuseView().includes('AI 답변 생성 중지'));
c.window.KNOWHOW_CONFIG.aiRequestsPaused=false;assert(!api.reuseView().includes('AI 답변 생성 중지'));
assert.equal(calls,0);
console.log(`PASS: ${count} question render states; paused/unpaused and review blockers stay distinct, original button gates preserved, zero network/model calls`);

// Home uses the same pause default and removes the notice when generation resumes.
const shell=fs.readFileSync('src/platform-shell.js','utf8');
const homeSource=shell.slice(shell.indexOf(' function home(){'),shell.indexOf(' function focusPage()'));
const homeHost={innerHTML:''},homeRoot={KNOWHOW_CONFIG:{}};
const homeContext=vm.createContext({root:homeRoot,$:selector=>{assert.equal(selector,'#page');return homeHost},fetch:()=>{throw Error('Home render must not request anything')}});
vm.runInContext(homeSource,homeContext);
for(const pause of [undefined,true,false,true,false]){
 homeRoot.KNOWHOW_CONFIG.aiRequestsPaused=pause;vm.runInContext('home()',homeContext);
 assert.equal(homeHost.innerHTML.includes('AI 답변 생성 중지'),pause!==false);
 assert(homeHost.innerHTML.includes('현재 버전 검토 완료 후'),'home access remains conditional on document review');
}
console.log('PASS: home pause default and both-direction toggles; review condition retained without requests');
