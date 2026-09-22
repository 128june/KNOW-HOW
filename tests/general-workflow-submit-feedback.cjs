/* Real browser, actual core/store/UI, and a controllable local-only store transport. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.GENERAL_UI_URL||'http://127.0.0.1:18968';
const evidence=process.env.GENERAL_SUBMIT_EVIDENCE||'/tmp/general-workflow-submit-feedback';
async function main(){
 fs.mkdirSync(evidence,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const page=await context.newPage(),pageErrors=[],unexpected=[];
 page.on('pageerror',error=>pageErrors.push(error.message));
 const harness=base+'/__submit-feedback-test';
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==new URL(base).origin){unexpected.push(url.origin);return route.abort();}
  if(url.pathname==='/__submit-feedback-test')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local submit feedback regression</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/general-workflow.css"><script>window.KNOWHOW_CONFIG={generalApiBase:""};</script><script src="/general-workflow-fixture.js"></script><script src="/general-workflow-core.js"></script><script src="/general-workflow-store.js"></script><script src="/general-workflow-ui.js"></script><body><main id="submit-feedback-root"></main></body></html>'});
  if(!['/style.css','/general-workflow.css','/general-workflow-fixture.js','/general-workflow-core.js','/general-workflow-store.js','/general-workflow-ui.js','/favicon.ico'].includes(url.pathname)){unexpected.push(url.pathname);return route.abort();}
  return route.continue();
 });
 try{
  await page.goto(harness);
  await page.evaluate(async()=>{
   localStorage.clear();
   const real=window.KnowHowGeneralWorkflowStore.createStore({apiBase:''});
   const control=window.submitFeedbackControl={mode:'normal',calls:[],release:null,reject:null};
   const store={...real,answer:async query=>{
    control.calls.push(JSON.parse(JSON.stringify(query)));
    const mode=control.mode;control.mode='normal';
    if(mode==='delay')await new Promise((resolve,reject)=>{control.release=resolve;control.reject=reject;});
    if(mode==='failure')throw Error('검증용 저장소 조회 실패: 다시 조회해 주세요.');
    return real.answer(query);
   }};
   window.submitFeedbackStore=real;
   window.submitFeedbackController=window.KnowHowGeneralWorkflowUI.createController({store});
   await window.submitFeedbackController.mount(document.querySelector('#submit-feedback-root'),1);
  });
  const form=page.locator('[data-gw-form="question"]');
  const submit=()=>form.locator('button[type="submit"]');
  const current=()=>page.evaluate(()=>window.submitFeedbackStore.state().answers.at(-1));
  const calls=()=>page.evaluate(()=>window.submitFeedbackControl.calls.length);
  await page.locator('.gw-result').waitFor();
  const initial=await current();assert.equal(initial.query.purpose,'');
  // Changing the actual form must survive the immediate loading rerender.
  await form.locator('[name="purpose"]').selectOption('contract');
  await form.locator('[name="question"]').fill('선택한 두 계약의 9월 수주 보고 금액은?');
  await submit().click();
  await page.locator('.gw-answer-summary').filter({hasText:'영업 최초 수주: 500,000원'}).waitFor();
  const changed=await current();assert.equal(changed.query.purpose,'contract');assert.equal(changed.selected_metric,'signed');
  assert.equal(changed.query.question,'선택한 두 계약의 9월 수주 보고 금액은?');
  assert.equal(await page.locator('.gw-metric.is-selected').getAttribute('data-key'),'signed');
  assert.equal(await page.locator('.gw-result h2').getAttribute('tabindex'),'-1');
  assert.equal(await page.locator('.gw-result h2').evaluate(node=>node===document.activeElement),true);
  // Identical input still creates and announces a new recorded result.
  await submit().click();
  await page.waitForFunction(previous=>window.submitFeedbackStore.state().answers.at(-1).id!==previous,changed.id);
  const repeated=await current();assert.notEqual(repeated.id,changed.id);assert.deepEqual(repeated.query,changed.query);assert.deepEqual(repeated.metrics,changed.metrics);
  const completed=page.locator('.gw-notice[role="status"]').filter({hasText:'조회 완료'});
  await completed.waitFor();assert.match(await completed.innerText(),new RegExp(repeated.id));assert.match(await completed.innerText(),/\d{2}:\d{2}:\d{2}/);
  assert.equal(await page.locator('.gw-history-list button.is-active').getAttribute('data-id'),repeated.id);
  assert.equal(await page.locator('.gw-result h2').evaluate(node=>node===document.activeElement),true);
  // Keep a real promise pending so the loading state is observable, then release it.
  await page.evaluate(()=>{window.submitFeedbackControl.mode='delay';});
  await form.locator('[name="purpose"]').selectOption('deposit');
  const callCount=await calls();await submit().click();
  await page.locator('.gw-loading[role="status"]').waitFor();
  assert.match(await page.locator('.gw-loading').innerText(),/조회 중/);
  assert.equal(await form.getAttribute('aria-busy'),'true');assert.equal(await submit().isDisabled(),true);assert.match(await submit().innerText(),/조회 중/);
  assert.equal((await current()).id,repeated.id,'pending operation does not pretend the prior answer changed');
  await page.screenshot({path:evidence+'/loading.png',fullPage:true});
  // Even a synthetic repeated submit while busy must not dispatch a second request.
  await form.evaluate(node=>node.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(await calls(),callCount+1);
  await page.evaluate(()=>{window.submitFeedbackControl.release();window.submitFeedbackControl.release=null;});
  await page.locator('.gw-answer-summary').filter({hasText:'실제 입금 순액: 291,000원'}).waitFor();
  await page.locator('.gw-loading').waitFor({state:'detached'});
  assert.equal(await form.getAttribute('aria-busy'),'false');assert.equal(await submit().isDisabled(),false);
  assert.equal((await current()).query.purpose,'deposit');
  assert.equal(await page.locator('.gw-result h2').evaluate(node=>node===document.activeElement),true);
  // A store failure preserves the last saved answer and focuses the visible explanation.
  const beforeFailure=await current(),historyBefore=await page.locator('.gw-history-list button').count();
  await page.evaluate(()=>{window.submitFeedbackControl.mode='failure';});
  await form.locator('[name="purpose"]').selectOption('recognition');
  await submit().click();
  const error=page.locator('.gw-error[role="alert"]').filter({hasText:'검증용 저장소 조회 실패'});await error.waitFor();
  assert.equal(await error.getAttribute('tabindex'),'-1');assert.equal(await error.evaluate(node=>node===document.activeElement),true);
  assert.equal((await current()).id,beforeFailure.id);assert.equal(await page.locator('.gw-history-list button').count(),historyBefore);
  assert.equal(await form.getAttribute('aria-busy'),'false');assert.equal(await submit().isDisabled(),false);
  assert.equal(await page.locator('.gw-loading').count(),0);
  assert.equal(await page.locator('.gw-notice[role="status"]').filter({hasText:'조회 완료'}).count(),0,'failure must not leave a stale completion announcement');
  await error.screenshot({path:evidence+'/error.png'});
  await submit().click();await page.locator('.gw-answer-summary').filter({hasText:'재무 제공 실적: 100,000원'}).waitFor();
  assert.equal(await page.locator('.gw-error').count(),0);assert.equal(await page.locator('.gw-result h2').evaluate(node=>node===document.activeElement),true);
  assert.deepEqual(pageErrors,[]);assert.deepEqual(unexpected,[]);
  const report={passed:true,checks:['changed purpose and input preserved through render','same query announces a new answer ID and completion time','slow answer visibly busy and duplicate submission blocked','failure focuses an alert and preserves history; retry succeeds'],pageErrors,unexpectedRequests:unexpected};
  fs.writeFileSync(evidence+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await context.close();await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
