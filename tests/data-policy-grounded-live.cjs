// Actual candidate UI -> loopback HTTP API -> durable Worker. No API response fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.POLICY_LIVE_EVIDENCE || path.join(root, 'tests/evidence/policy-grounded-live');
const api = process.env.POLICY_LIVE_API || 'http://127.0.0.1:18789/data-platform';
assert.equal(new URL(api).hostname, '127.0.0.1', 'This test may only mutate a loopback API');
const origin = 'http://127.0.0.1:18919';
const csv = Buffer.from('id,email,부서\n01,first@example.invalid,앱\n02,second@example.invalid,데이터\n');
const body = '내부 집계에 제공할 연락처 자료의 이메일 열은 mask 처리한다.\n예외: 담당자가 원문 연락이 필요한 목적을 확인한 경우 별도로 판단한다.\n일반 부서명과 행 식별자는 집계 연결을 위해 유지한다.';
const reason = '내부 부서별 집계에 이메일 원문이 필요하지 않으며 원문 연락 목적 예외에 해당하지 않음을 확인했습니다.';
const report = {scope:'Actual source UI and loopback HTTP API/Worker; no API response replacement', syntheticInputValues:true, seedDemoUsed:false, traffic:[], externalRequests:[], layouts:[], observations:{}, errors:[]};
async function main(){
 fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'input.csv'),csv);
 const server=http.createServer((req,res)=>{
  const file=new URL(req.url,origin).pathname;
  if(file==='/config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.KNOWHOW_CONFIG='+JSON.stringify({apiBase:api.replace('/data-platform','/knowhow'),dataApiBase:api,aiRequestsPaused:true})+';');return;}
  const relative=file==='/'?'index.html':file.slice(1);
  if(relative.includes('..')||!fs.existsSync(path.join(root,'src',relative))){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(root,'src',relative)));
 });
 await new Promise(resolve=>server.listen(18919,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){report.externalRequests.push(route.request().url());return route.abort();}return route.continue();});
 const page=await context.newPage();
 await page.addInitScript(()=>{
  let original;
  Object.defineProperty(window,'KnowHowDataPlatform',{configurable:true,get(){return original;},set(value){
   original=value;const create=value.createController;value.createController=function(...args){const result=create(...args);window.policyController=result;return result;};
  }});
 });
 const responseTasks=[];
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('response',response=>{
  const url=new URL(response.url());if(!response.url().startsWith(api))return;
  responseTasks.push((async()=>{let sent=null,received=null;try{sent=response.request().postDataJSON();}catch{}try{received=await response.json();}catch{}
   if(url.pathname.endsWith('/sessions'))received={session_created:response.status()===201};
   report.traffic.push({method:response.request().method(),path:url.pathname+url.search,status:response.status(),body:sent,result:received});
  })());
 });
 const state=()=>page.evaluate(()=>{const s=policyController.getState();return {dataset:s.dataset,proposal:s.proposal,application:s.application,preview:s.preview,error:s.error,policyKB:s.policyKB,department:s.department,includeCompany:s.includeCompany};});
 const idle=()=>page.waitForFunction(()=>!policyController.getState().busy);
 const check=async()=>{await idle();assert.equal((await state()).error,'');};
 const nav=async hash=>{await page.evaluate(hash=>{location.hash=hash},hash);await page.waitForFunction(hash=>location.hash===hash,hash);await check();};
 const search=async()=>{await page.locator('[data-data-action=policy-search]').click();await page.waitForFunction(()=>policyController.getState().proposal||policyController.getState().error||policyController.getState().job?.state==='failed');await check();return (await state()).proposal;};
 const mutation=async action=>{await page.locator('#data-policy-review [name=reason]').fill('원문 조건과 적용일을 직접 확인한 사람의 '+action+' 결정');await page.locator('#data-policy-review [name=confirmed]').check();await page.locator('[data-policy-mutation="'+action+'"]').click();await check();};
 const capture=async label=>{for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});const metrics=await page.evaluate(()=>({width:innerWidth,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),header:document.querySelector('.app-header').getBoundingClientRect().height}));assert.equal(metrics.overflow,0);assert.equal(metrics.header,width===1440?48:56);report.layouts.push({label,...metrics});await page.screenshot({path:path.join(output,`${label}-${width}.png`),fullPage:true});if(label==='policy-source')await page.locator('.data-policy-document').first().screenshot({path:path.join(output,`${label}-card-${width}.png`)});}await page.setViewportSize({width:1440,height:1000});};
 try{
  await page.goto(origin+'/#data');await page.locator('[name=source_file]').setInputFiles({name:'human-policy-input.csv',mimeType:'text/csv',buffer:csv});
  await page.locator('#data-intake button[type=submit],#data-intake button.primary').first().click();
  await page.waitForFunction(()=>policyController.getState().dataset?.row_count===2||policyController.getState().error);await check();
  const raw=(await state()).dataset;assert.equal(raw.source_sha256,crypto.createHash('sha256').update(csv).digest('hex'));
  report.observations.raw=raw;
  await nav('#data-policies');assert.equal((await search()).policies.length,0);report.observations.emptyPolicyCount=0;
  await capture('empty');
  await page.locator('[data-policy-department]').selectOption('app');
  await page.locator('[data-policy-action=new]').first().click();await check();
  await page.locator('#data-policy-save [name=title]').fill('내부 집계용 개인정보 처리 정책');
  await page.locator('#data-policy-save [name=content]').fill(body);
  await page.locator('#data-policy-save [name=reference]').fill('업무 담당자가 제공한 내부 집계 운영 기준 · 검증용 원문');
  await page.locator('#data-policy-save button[type=submit]').click();await check();
  assert.equal((await state()).policyKB.editor.state,'draft');
  assert.equal((await search()).policies.length,0);
  await mutation('review');
  const sameDepartment=await search();assert.equal(sameDepartment.policies.length,1);assert.equal(sameDepartment.policies[0].content,body);assert.equal(sameDepartment.policies[0].source.reference,'업무 담당자가 제공한 내부 집계 운영 기준 · 검증용 원문');report.observations.sameDepartmentPolicies=sameDepartment.policies;
  await mutation('request-promotion');assert.equal((await state()).policyKB.editor.company_status,'requested');
  await mutation('promote');assert.equal((await state()).policyKB.editor.company_status,'approved');
  await page.locator('[data-policy-department]').selectOption('data');
  assert.equal((await search()).policies.length,0);
  await page.locator('[data-policy-company]').check();
  const review=await search();assert.equal(review.policies.length,1);assert.equal(review.policies[0].scope,'company');
  assert.ok(review.proposals.every(p=>p.policy_refs.length===0));report.observations.policies=review.policies;report.observations.reviewId=review.review_id;
  const card=page.locator('.data-policy-document').first(),originalBody=card.locator('.data-policy-evidence p'),technical=card.locator('.data-policy-technical'),technicalSummary=technical.locator('summary');
  assert.equal(await originalBody.isVisible(),true);assert.equal(await originalBody.textContent(),body);
  assert.equal(crypto.createHash('sha256').update(await originalBody.textContent()).digest('hex'),review.policies[0].sha256);
  assert.equal(await technical.evaluate(element=>element.open),false);assert.equal(await technical.locator('dd').first().isVisible(),false);
  await technicalSummary.focus();await technicalSummary.press('Enter');assert.equal(await technical.evaluate(element=>element.open),true);
  assert.deepEqual(await technical.locator('dd').allTextContents(),[review.policies[0].id,review.policies[0].sha256]);
  await technicalSummary.press('Enter');assert.equal(await technical.evaluate(element=>element.open),false);
  await capture('policy-source');
  await page.locator('[data-data-action=policy-review-rules]').click();await page.locator('#data-transform').waitFor();
  const email=page.locator('[data-rule-column=email]');await email.locator('[name=action]').selectOption('mask');await email.locator('[name=policy_ref]').check();await email.locator('[name=decision_reason]').fill(reason);
  await capture('human-decision');
  await page.locator('#data-transform button[type=submit]').click();
  await page.waitForFunction(()=>policyController.getState().application?.dataset_id||policyController.getState().error||policyController.getState().job?.state==='failed');await check();
  const result=await state();assert.equal(result.dataset.row_count,2);assert.notEqual(result.dataset.id,raw.id);
  const applied=result.application.applications.find(row=>row.column==='email');assert.equal(applied.reason,reason);assert.deepEqual(applied.policy_refs,[{id:review.policies[0].id,version:1}]);assert.ok(result.preview.rows.every(row=>!row.email.includes('@')));
  report.observations.selectedRefs=applied.policy_refs;report.observations.application=result.application;report.observations.after=result.preview;
  await nav('#data-policies');assert.match(await page.locator('.data-policy-application').innerText(),/정책 1개 적용/);
  await capture('applied-result');
  const token=await page.evaluate(()=>policyController.getState().session.access_token);
  const original=await context.request.get(api+`/visitor/datasets/${raw.id}/original`,{headers:{Authorization:'Bearer '+token}});assert.deepEqual(await original.body(),csv);
  report.observations.originalSHA=crypto.createHash('sha256').update(await original.body()).digest('hex');
  const guards=await context.request.get(api.replace('/data-platform','/test/provider-calls'));report.providerCalls=await guards.json();assert.ok(Object.values(report.providerCalls).every(n=>n===0));
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);await Promise.all(responseTasks);assert.ok(report.traffic.every(r=>r.body?.generate!==true));report.passed=true;
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,policyCount:review.policies.length,rows:2,layouts:report.layouts,providerCalls:report.providerCalls,report:path.join(output,'report.json')},null,2));
 }catch(error){await Promise.all(responseTasks);report.error=error.stack;report.lastState=await state().catch(()=>null);fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify(report,null,2)+'\n');await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error;}
 finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
