/* Browser contract regression with a synthetic in-memory API. No model or external API calls. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const cases=[];
async function main(){
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'text/html');if(req.url==='/')res.end('<!doctype html><meta charset="utf-8"><div id="error" role="alert"></div><main id="review"></main>');else{const file=path.join(root,req.url);res.end(fs.existsSync(file)?fs.readFileSync(file):'');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.addStyleTag({path:path.join(root,'src/support-kb-review.css')});await page.addStyleTag({path:path.join(root,'src/support-workspace.css')});await page.addScriptTag({path:path.join(root,'src/support-kb-review.js')});
  await page.evaluate(async()=>{
   const candidate={id:'KHC-fixture',kb_id:'INTAKE-001',kb_version:2,field:'symptoms',value:'충전 시작 불가\n원문 줄바꿈',status:'pending',source:{kind:'manual_input'},author:'합성 상담사',created_at:'2026-09-22T00:00:00Z'};
   const originalDraft={resolution:'new',standard_id:'',title:'충전 시작 불가',aliases:[candidate.value],definition:'',conditions:[],required_info:[],department_links:[],evidence:[{id:'original-candidate',kind:'candidate',reference:candidate.id,excerpt:candidate.value,verification:'confirmed',source_resolved:true,snapshot:candidate}],unconfirmed:['동일 원인 여부 미확인'],change_reason:'',effective_at:''};
   const review={id:'KRV-fixture',candidate_id:candidate.id,original_candidate:candidate,draft:originalDraft,status:'in_review',revision:1,base_version:0,comments:[],history:[]};
   const inbox=[{id:'notify-fixture',candidate_id:candidate.id,candidate,kb_id:candidate.kb_id,kb_version:2,field:'symptoms',read_at:null,requested_by:'합성 상담사',requested_at:candidate.created_at}];
   window.fixture={review,requests:[],failAi:false,proposal:null,inbox};let busy=false;
   const copy=x=>JSON.parse(JSON.stringify(x));
   const request=async(action,payload={})=>{fixture.requests.push({action,payload:copy(payload)});if(payload.revision&&payload.revision!==review.revision)throw Object.assign(Error('검토 충돌'),{status:409});
    if(action==='knowledge-publications')return {documents:[],standards:[]};
    if(action==='knowledge-review')return {review:copy(review),standards:[],previous_publication:null};
    if(action==='knowledge-review-save'){review.draft=copy(payload.draft);review.revision++;return {review:copy(review)};}
    if(action==='knowledge-review-comment'){review.comments.push({id:'comment-1',message:payload.message,author:'합성 관리자'});review.revision++;return {review:copy(review)};}
    if(action==='knowledge-review-ai-draft'){if(fixture.failAi)throw Object.assign(Error('실제 AI 사용이 꺼져 있습니다.'),{status:503});fixture.proposal={id:'proposal-fixture',base_revision:review.revision,provider:'synthetic-contract-fixture',model:'fixture-no-real-call',created_at:'2026-09-22T01:00:00Z',sources:[{id:'original-candidate',reference:candidate.id}],draft:{...copy(review.draft),definition:'합성 API가 제안한 뜻',conditions:['시작 요청 이후'],required_info:['요청 ID'],change_reason:'증상 정의',effective_at:'2026-09-22T00:00:00Z'}};return {review:copy(review),proposal:copy(fixture.proposal),is_mock:false,ai_generated:true};}
    if(action==='knowledge-review-ai-apply'){review.draft=copy(fixture.proposal.draft);review.revision++;return {review:copy(review)};}
    if(action==='knowledge-review-status'){review.status=payload.status;review.revision++;return {review:copy(review)};}
    if(action==='knowledge-review-publish'){review.status='published';review.standard_id='STD-fixture';review.published_version=1;review.revision++;return {review:copy(review),publication:{id:'STD-fixture',draft:copy(review.draft),version:1}};}
    throw Error('Unexpected fixture action '+action);
   };
   const render=()=>{document.querySelector('#review').innerHTML=controller.render({requests:inbox,unreadCount:1,busy});controller.bind(document.querySelector('#review'));};
   const perform=async fn=>{if(busy)return;busy=true;document.querySelector('#error').textContent='';render();try{await fn();}catch(e){document.querySelector('#error').textContent=e.message;}finally{busy=false;render();}};
   const controller=KnowHowSupportReview.createController({request,perform,render,refreshKnowledge:async()=>{},getSession:()=> 'synthetic-session',storageKey:'synthetic-review'});window.harness=controller;await controller.load();render();
  });
  await page.locator('[data-kb-open]').click();await page.locator('[name=definition]').fill('관리자가 이미 쓴 뜻');
  await page.evaluate(()=>fixture.failAi=true);await page.locator('[data-kb-ai-generate]').click();await page.waitForFunction(()=>document.querySelector('#error').textContent.includes('꺼져'));
  assert.equal(await page.locator('[name=definition]').inputValue(),'관리자가 이미 쓴 뜻');assert.equal(await page.locator('[data-kb-ai-apply]').count(),0);cases.push('AI failure preserves entered draft and never fabricates a proposal');
  await page.evaluate(()=>fixture.failAi=false);await page.locator('[data-kb-ai-generate]').click();await page.locator('[data-kb-ai-apply]').waitFor();
  assert.equal(await page.locator('[name=definition]').inputValue(),'관리자가 이미 쓴 뜻');assert.match(await page.locator('.kb-review-ai-proposal').innerText(),/합성 API가 제안한 뜻/);assert.equal(await page.evaluate(()=>fixture.requests.filter(r=>r.action==='knowledge-review-publish').length),0);
  const generation=await page.evaluate(()=>fixture.requests.filter(r=>r.action==='knowledge-review-ai-draft'));assert.equal(generation[0].payload.request_id,generation[1].payload.request_id);cases.push('AI proposal remains separate; retry reuses request id; no automatic publication');
  await page.locator('[data-kb-ai-apply]').click();await page.waitForFunction(()=>document.querySelector('[name=definition]').value==='합성 API가 제안한 뜻');
  await page.locator('[data-kb-ai-restore]').click();assert.equal(await page.locator('[name=definition]').inputValue(),'관리자가 이미 쓴 뜻');cases.push('Explicit apply edits draft and previous entered draft can be restored');
  await page.locator('[name=conditions]').fill('충전 시작 요청 직후');await page.locator('[name=required_info]').fill('요청 ID\n발생 시각');await page.locator('[name=change_reason]').fill('검토 완료');await page.locator('[name=effective_at]').fill('2026-09-22T09:00');
  await page.locator('[data-kb-preview]').click();await page.locator('#kb-publish-dialog[open]').waitFor();assert.match(await page.locator('#kb-publish-dialog').innerText(),/발행 전 변경점/);await page.keyboard.press('Escape');assert.equal(await page.locator('#kb-publish-dialog').count(),0);assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-kb-preview')),true);cases.push('Publication modal shows changes; Escape closes and restores focus');
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);cases.push('390px review layout does not overflow horizontally');
  await page.locator('[data-kb-preview]').click();await page.locator('[data-kb-publish]').click();await page.waitForFunction(()=>fixture.review.status==='published');assert.equal(await page.locator('[name=definition]').isDisabled(),true);assert.equal(await page.locator('[data-kb-revise]').count(),1);cases.push('Only explicit publication locks immutable review and offers correction');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,scope:'synthetic API browser contracts; no actual model call',cases},null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
