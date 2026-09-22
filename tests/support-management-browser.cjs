/* Reversible admin delete/edit contracts in a browser; synthetic API, no model. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><div id="error"></div><main id="review"></main>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 await page.addStyleTag({path:path.join(root,'src/support-kb-review.css')});await page.addStyleTag({path:path.join(root,'src/support-workspace.css')});await page.addScriptTag({path:path.join(root,'src/support-kb-review.js')});
 await page.evaluate(async()=>{
 const copy=x=>JSON.parse(JSON.stringify(x));const candidate={id:'KHC-raw',kb_id:'INTAKE-001',kb_version:2,field:'symptoms',value:'최초 원문',author:'상담사'};
 const review={id:'KRV-test',candidate_id:candidate.id,original_candidate:copy(candidate),status:'in_review',revision:1,base_version:0,comments:[],history:[],draft:{title:'정리할 표현',definition:'처음 초안',resolution:'new',standard_id:'',aliases:[candidate.value],conditions:[],required_info:[],department_links:[],evidence:[],unconfirmed:[],change_reason:'',effective_at:''}};
 const standard={id:'STD-INTAKE-001-symptoms-start',standard_id:'STD-INTAKE-001-symptoms-start',title:'기본 시작 증상',definition:'기본 뜻',version:0,source_version:2,kb_id:'INTAKE-001',field:'symptoms',published:false};
 const documents=[{id:'APP-001',title:'앱 안내',version:1}],documentStates={'APP-001':{revision:1,withdrawn:true,reason:'검토 중'}};
 const inbox=[{candidate_id:candidate.id,candidate,kb_id:'INTAKE-001',kb_version:2,field:'symptoms',review:{id:review.id,status:review.status,revision:review.revision},read_at:null}];
 window.fixture={review,candidate,standard,states:{},documentStates,calls:[],refreshes:0,conflict:false};let busy=false;
 const request=async(action,payload={})=>{fixture.calls.push({action,payload:copy(payload)});if(action==='knowledge-management')return {reviews:[copy(review)],standards:[copy(standard)],documents,publications:[],states:copy(fixture.states),document_states:copy(documentStates)};
 if(action==='knowledge-review')return {review:copy(review),standards:[copy(standard)]};
 if(action==='knowledge-review-save'){assertRevision(payload);review.draft=copy(payload.draft);review.revision++;return {review:copy(review)};}
 if(action==='knowledge-review-archive'){assertRevision(payload);review.status=payload.archived?'archived':'in_review';review.revision++;return {review:copy(review)};}
 if(action==='knowledge-publication-state'){if(fixture.conflict)throw Object.assign(Error('삭제 상태가 변경되었습니다. 새로고침하세요.'),{status:409});fixture.states[standard.id]={revision:payload.expected_state_revision+1,withdrawn:payload.withdrawn,reason:payload.reason};return {state:copy(fixture.states[standard.id])};}
 if(action==='knowledge-document-state'){documentStates[payload.document_id]={revision:2,withdrawn:payload.withdrawn,reason:payload.reason};return {state:copy(documentStates[payload.document_id])};}
 if(action==='knowledge-review-standard'){return {review:{...copy(review),id:'KRV-STD',status:'in_review',candidate_id:null,original_candidate:null,standard_id:standard.id,kb_id:standard.kb_id,field:standard.field,correction:true,draft:{...copy(review.draft),resolution:'link',standard_id:standard.id,title:standard.title}},standards:[copy(standard)]};}
 throw Error('Unexpected '+action);};
 function assertRevision(p){if(p.revision!==review.revision)throw Object.assign(Error('충돌'),{status:409});}
 const render=()=>{document.querySelector('#review').innerHTML=controller.render({requests:inbox,unreadCount:review.status==='archived'?0:1,busy});controller.bind(document.querySelector('#review'));};
 const perform=async fn=>{if(busy)return;busy=true;render();try{await fn();}catch(e){document.querySelector('#error').textContent=e.message;}finally{busy=false;render();}};
 const controller=KnowHowSupportReview.createController({request,perform,render,refreshKnowledge:async()=>{fixture.refreshes++;},getSession:()=> 'test-session',storageKey:'test-draft',onReviewChange:r=>{inbox[0].review={id:r.id,status:r.status,revision:r.revision};}});window.controller=controller;await controller.load();render();
 });
 const cases=[];
 await page.locator('[data-kb-open]').click();await page.locator('[name=definition]').fill('관리자 수정 내용');await page.locator('[data-kb-manage="review"]').click();
 assert.match(await page.locator('#kb-management-dialog').innerText(),/KRV-test/);assert.match(await page.locator('#kb-management-dialog').innerText(),/과거 원문/);await page.locator('[data-kb-management-reason]').fill('중복 후보');await page.locator('[data-kb-confirm-management]').click();
 await page.waitForFunction(()=>fixture.review.status==='archived');assert.equal(await page.locator('[name=definition]').inputValue(),'관리자 수정 내용');assert.equal(await page.locator('[name=definition]').isDisabled(),true);assert.equal(await page.evaluate(()=>fixture.candidate.value),'최초 원문');assert.equal(await page.evaluate(()=>sessionStorage.getItem('test-draft')),null);
 assert.deepEqual(await page.evaluate(()=>fixture.calls.filter(c=>c.action==='knowledge-review-archive')[0].payload),{review_id:'KRV-test',revision:2,archived:true,reason:'중복 후보'});cases.push('Deletion saves edited draft, requires reason, locks archived review, keeps original, clears resume');
 await page.locator('[data-kb-manage="review"]').click();await page.locator('[data-kb-confirm-management]').click();await page.waitForFunction(()=>document.querySelector('#kb-management-dialog').textContent.includes('사유를 입력'));
 assert.equal(await page.evaluate(()=>fixture.review.status),'archived');await page.locator('[data-kb-management-reason]').fill('보완 후 재검토');await page.locator('[data-kb-confirm-management]').click();await page.waitForFunction(()=>fixture.review.status==='in_review');assert.equal(await page.locator('[name=definition]').isDisabled(),false);cases.push('Restore requires reason and retains saved draft');
 await page.locator('[data-kb-back]').click();await page.locator('summary').filter({hasText:'기본 입력 항목'}).click();await page.locator('[data-kb-manage="standard"]').click();await page.locator('[data-kb-management-reason]').fill('폐기된 입력값');await page.locator('[data-kb-confirm-management]').click();await page.waitForFunction(()=>fixture.states[fixture.standard.id]?.withdrawn);
 assert.equal(await page.locator('[data-kb-standard-edit]').count(),0);await page.locator('summary').filter({hasText:'삭제한 입력 항목'}).click();await page.locator('[data-kb-manage="standard"]').click();await page.locator('[data-kb-management-reason]').fill('복구 검토');await page.evaluate(()=>fixture.conflict=true);await page.locator('[data-kb-confirm-management]').click();await page.waitForFunction(()=>document.querySelector('#kb-management-dialog').textContent.includes('새로고침'));assert.equal(await page.locator('[data-kb-management-reason]').inputValue(),'복구 검토');assert.equal(await page.evaluate(()=>fixture.states[fixture.standard.id].withdrawn),true);await page.keyboard.press('Escape');cases.push('Standard withdrawal uses stable ID/version/state revision; stale response keeps reason and state');
 await page.locator('[data-kb-manage="document"]').click();await page.locator('[data-kb-management-reason]').fill('업무 기준 복구');await page.locator('[data-kb-confirm-management]').click();await page.waitForFunction(()=>!fixture.documentStates['APP-001'].withdrawn);assert.equal(await page.locator('[data-kb-manage="document"]').count(),0);cases.push('Deleted base documents expose restoration in admin list');
 await page.evaluate(async()=>{fixture.states={};fixture.conflict=false;await controller.load();controller.setFilter('all');});await page.locator('[data-kb-filter]').selectOption('all');await page.locator('summary').filter({hasText:'기본 입력 항목'}).click();await page.locator('[data-kb-standard-edit]').click();await page.locator('[name=title]').waitFor();assert.equal(await page.locator('[name=title]').inputValue(),'기본 시작 증상');assert.equal(await page.locator('[name=resolution]').inputValue(),'link');cases.push('Base standard opens workspace correction with null original candidate safely');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);cases.push('Mobile management/editor has no horizontal overflow or runtime errors');
 console.log(JSON.stringify({passed:true,cases},null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
