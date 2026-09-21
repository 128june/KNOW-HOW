// UI transport/render fixture only: API responses below are substituted, not Worker evidence.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const repo=path.resolve(__dirname,'..');
const output=process.env.POLICY_UI_EVIDENCE_DIR||'/tmp/knowhow-policy-ui';
const schema=[{name:'phone',type:'string'},{name:'memo',type:'string'}];
const raw={id:'raw-policy-fixture',name:'두 행의 연락처 CSV · UI 응답 대체 검사',layer:'raw',kind:'ingest',row_count:2,schema,original_file:'fixture.csv',source_sha256:'a'.repeat(64)};
const clean={...raw,id:'clean-policy-fixture',kind:'transform',layer:'clean',rules:{privacy_review_id:'review-policy-fixture',privacy_department:'app'}};
const original='연락처 처리 정책\n\nphone 열은 외부 공유 결과에서 가린다.\n  원본은 보존하고, 처리 이유를 기록한다.  \n문의 부서: 앱 개발 부서 <확인 필요>\n'+('정책의 적용 범위와 확인 책임을 사람이 검토합니다.\n'.repeat(30));
const fixture={calls:[],docs:[],result:false,review:null,decisions:[],deny:false};
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:fs.existsSync('/Applications/Google Chrome.app')?{channel:'chrome'}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('https://fixture.invalid/**',async route=>{
   const req=route.request(),url=new URL(req.url()),body=req.postDataJSON()||{};fixture.calls.push({path:url.pathname,query:Object.fromEntries(url.searchParams),method:req.method(),body,authorization:req.headers().authorization});
   assert.equal(req.headers().authorization,'Bearer fixture-private-token');
   let status=200,value;const action=url.pathname.split('/').at(-1),doc=fixture.docs.find(d=>d.id===body.id);
   if(url.pathname.includes('/kb/')){
    if(action==='catalog')value={documents:fixture.docs.filter(d=>d.department===body.department)};
    else if(action==='save'){assert.equal(body.visibility,'department');const saved={...body,id:'b'.repeat(32),version:1,state:'draft',company_status:'none',sha256:crypto.createHash('sha256').update(body.content).digest('hex')};fixture.docs.push(saved);value={id:saved.id,version:1,state:'draft'};}
    else if(action==='document')value=doc;
    else if(action==='revise'){assert.equal(body.version,doc.version);Object.assign(doc,body,{version:doc.version+1,state:'draft',company_status:'stale'});value=doc;}
    else {assert.equal(body.version,doc.version);assert.ok(body.reason);if(action==='review'){assert.equal(body.state,'confirmed');doc.state='confirmed'}if(action==='request-promotion')doc.company_status='requested';if(action==='promote'){assert.equal(doc.company_status,'requested');doc.company_status='approved'}if(action==='revoke')doc.company_status='revoked';value=doc;}
   }else if(action==='privacy-review'){
    assert.equal(body.generate,false);assert.equal(body.seed_demo,undefined);
    const policies=fixture.docs.filter(d=>d.state==='confirmed'&&(d.department===body.department||body.include_company&&d.company_status==='approved')).map(d=>({...d,scope:d.department===body.department?'department':'company'}));
    fixture.review={review_id:'review-policy-fixture',dataset_id:raw.id,row_count:2,ai_generated:false,department:body.department,policies,proposals:schema.map(c=>({column:c.name,action:'keep',policy_refs:[],reason:'직접 선택 필요'})),profile:schema.map(c=>({column:c.name,data_type:'string',types:[],row_count:2}))};
    value={id:'review-job',kind:'privacy_review',state:'succeeded',result:{review_id:fixture.review.review_id}};
   }else if(url.pathname.includes('/privacy-reviews/')){assert.equal(url.searchParams.get('department'),fixture.review.department);value=fixture.review;}
   else if(action==='privacy-apply'){
    assert.equal(body.department,fixture.review.department);assert.equal(body.review_id,fixture.review.review_id);fixture.decisions=body.decisions;
    if(fixture.deny){status=409;value={error:'정책 버전이 변경되었습니다. 정책을 다시 검색하세요.'};}
    else{fixture.result=true;value={id:'transform-job',kind:'transform',state:'succeeded',dataset_id:clean.id,total_rows:2,processed_rows:2};}
   }else if(action==='jobs')value={jobs:[]};
   else if(action==='datasets')value={datasets:fixture.result?[raw,clean]:[raw]};
   else if(action==='preview'){const processed=url.pathname.includes(clean.id);value={dataset:processed?clean:raw,schema,rows:[{phone:processed?'***':'010-1234-5678',memo:'첫 행'},{phone:processed?'***':'010-9876-5432',memo:'둘째 행'}],total:2};}
   else if(action==='privacy-result'){assert.equal(url.searchParams.get('department'),'app');const applications=fixture.decisions.map(d=>({...d,decision:d.policy_refs.length?'human_policy_selection':'human_changed',affected_count:d.action==='mask'?2:0,matched_cells:2}));value={source_sha256:raw.source_sha256,applications,policies:fixture.review.policies.map(p=>({...p,applications:applications.filter(d=>d.policy_refs.some(ref=>ref.id===p.id))})),before:{row_count:2},after:{row_count:2},applied_at:Date.now()/1000};}
   else throw Error('Unexpected fixture request '+url.pathname);
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
  });
  const html=fs.readFileSync(path.join(repo,'src/index.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
  await page.setContent(html);await page.evaluate(()=>{document.body.dataset.platform='data';window.KNOWHOW_CONFIG={dataApiBase:'https://fixture.invalid/data-platform'};if(!crypto.randomUUID)crypto.randomUUID=()=>String(Date.now());});
  for(const name of ['style.css','shell.css','data-platform.css'])await page.addStyleTag({path:path.join(repo,'src',name)});
  for(const name of ['data-review-ui.js','data-platform.js'])await page.addScriptTag({path:path.join(repo,'src',name)});
  await page.evaluate(raw=>{window.controller=KnowHowDataPlatform.createController();Object.assign(controller.getState(),{session:{access_token:'fixture-private-token'},capabilities:{features:{}},dataset:raw,preview:{dataset:raw,schema:raw.schema,rows:[{phone:'010-1234-5678',memo:'첫 행'},{phone:'010-9876-5432',memo:'둘째 행'}],total:2}});controller.mount(document.querySelector('#page'),{section:'policies'});},raw);
  const idle=()=>page.waitForFunction(()=>!controller.getState().busy);
  const mount=section=>page.evaluate(section=>{controller.destroy();controller.mount(document.querySelector('#page'),{section});},section);
  async function mutate(action){await page.locator('#data-policy-review [name=reason]').fill(action==='review'?'현재 원문·적용일·처리 대상 열 확인':'같은 방문자 조직 공유 범위 확인');await page.locator('#data-policy-review [name=confirmed]').check();await page.locator('[data-policy-mutation='+action+']').click();await idle();}
  async function lookup(){await page.locator('[data-data-action=policy-search]').click();await page.waitForFunction(()=>!controller.getState().busy&&!!controller.getState().proposal);}
  async function verifyPolicyCard(){
   const card=page.locator('[data-policy-document]').first(),body=card.locator('.data-policy-evidence p'),technical=card.locator('.data-policy-technical'),summary=technical.locator('summary');
   assert.equal(await body.isVisible(),true,'the complete policy is visible without expanding anything');
   assert.equal(await body.textContent(),original,'all original characters remain unchanged');
   const hash=crypto.createHash('sha256').update(await body.textContent()).digest('hex');
   assert.equal(hash,fixture.docs[0].sha256);
   assert.equal(await technical.evaluate(element=>element.open),false);
   assert.equal(await technical.locator('dd').first().isVisible(),false);
   await summary.focus();await summary.press('Enter');
   assert.equal(await technical.evaluate(element=>element.open),true);
   assert.deepEqual(await technical.locator('dd').allTextContents(),[fixture.docs[0].id,hash]);
   await summary.press('Enter');assert.equal(await technical.evaluate(element=>element.open),false);
  }
  const measurements=[];
  async function measure(label){for(const width of [1440,390,320]){await page.setViewportSize({width,height:1050});const m=await page.evaluate(()=>({width:innerWidth,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),header:document.querySelector('.app-header').getBoundingClientRect().height,originalFont:getComputedStyle(document.querySelector('.data-policy-evidence p')||document.body).fontSize}));assert.equal(m.overflow,0,label+' '+width+' overflow');assert.equal(m.header,width>760?48:56);measurements.push({label,...m});await page.screenshot({path:path.join(output,label+'-'+width+'.png'),fullPage:true});}await page.setViewportSize({width:1440,height:1050});}
  await page.locator('[data-policy-department]').selectOption('app');await lookup();assert.equal(await page.locator('[data-policy-document]').count(),0);assert.match(await page.locator('.data-policy-review').innerText(),/현재 범위에 유효하고 검토 완료된 정책 문서가 없습니다/);
  await page.locator('button[data-policy-action=new]').last().click();await idle();
  await page.locator('#data-policy-save [name=title]').fill('연락처 처리 정책');await page.locator('#data-policy-save [name=content]').fill(original);await page.locator('#data-policy-save [name=reference]').fill('내부 연락처 공유 기준 제3조 · 사람이 제공한 원문');await page.locator('#data-policy-save [name=valid_from]').fill('2026-09-01');await page.locator('#data-policy-save button').click();await idle();
  assert.equal(fixture.docs[0].state,'draft');assert.equal(fixture.docs[0].content,original);assert.equal(fixture.docs[0].source.reference,'내부 연락처 공유 기준 제3조 · 사람이 제공한 원문');assert.equal(fixture.calls.filter(c=>c.path.endsWith('/review')).length,0);assert.equal(await page.locator('[data-policy-mutation=promote]').isDisabled(),true);
  await measure('policy-draft');await mutate('review');assert.equal(fixture.docs[0].state,'confirmed');assert.equal(fixture.docs[0].company_status,'none');
  await mutate('request-promotion');assert.equal(fixture.docs[0].company_status,'requested');await mutate('promote');assert.equal(fixture.docs[0].company_status,'approved');
  await page.locator('[data-policy-department]').selectOption('device');await lookup();assert.equal(await page.locator('[data-policy-document]').count(),0);await page.locator('[data-policy-company]').check();assert.equal(await page.evaluate(()=>controller.getState().proposal),null);await lookup();assert.equal(await page.locator('[data-policy-document]').count(),1);assert.match(await page.locator('[data-policy-document]').innerText(),/승인된 전사 범위/);
  await page.locator('[data-policy-department]').selectOption('app');await page.locator('[data-policy-company]').uncheck();await lookup();await verifyPolicyCard();await measure('policy-found');
  await mount('privacy');assert.equal(await page.locator('[name=policy_ref]:checked').count(),0);const phone=page.locator('[data-rule-column=phone]');await phone.locator('[name=action]').selectOption('mask');await phone.locator('[name=policy_ref]').check();assert.equal(await phone.locator('[name=decision_reason]').getAttribute('required'),'');await phone.locator('[name=decision_reason]').fill('phone은 연락처이므로 원문의 외부 공유 가림 기준을 적용');await measure('policy-decisions');
  fixture.deny=true;await page.locator('#data-transform button[type=submit]').click();await idle();assert.match(await page.locator('[data-data-error]').innerText(),/정책 버전이 변경/);assert.equal(await phone.locator('[name=policy_ref]').isChecked(),true);assert.equal(await phone.locator('[name=decision_reason]').inputValue(),'phone은 연락처이므로 원문의 외부 공유 가림 기준을 적용');
  fixture.deny=false;await page.locator('#data-transform button[type=submit]').click();await page.waitForFunction(()=>controller.getState().dataset.id==='clean-policy-fixture'&&!controller.getState().busy);assert.equal(fixture.decisions[0].policy_refs[0].id,fixture.docs[0].id);assert.equal(fixture.decisions[0].policy_refs[0].version,1);assert.deepEqual(fixture.decisions[1].policy_refs,[]);
  await mount('policies');assert.match(await page.locator('.data-policy-application').innerText(),/정책 1개 적용/);assert.match(await page.locator('.data-policy-application').innerText(),/phone은 연락처/);assert.match(await page.locator('.data-policy-application').innerText(),new RegExp(raw.source_sha256));await verifyPolicyCard();await measure('policy-result');
  assert.equal(errors.length,0,errors.join('\n'));assert.ok(fixture.calls.every(c=>!c.body.generate));
  const report={passed:true,scope:'API-response-substituted UI transport/render fixture; not actual API/Worker validation',apiResponsesSubstituted:true,aiCalls:0,externalMutations:0,cases:['draft preserves exact original','review/request/approve explicit steps','department exclusion and company opt-in','whole original visible by default before and after application','technical ID/SHA hidden by default, Enter opens and closes exact values','rendered original SHA matches fixture source metadata','per-column manual selection reason','409 preserves entered decisions','saved result reason and source SHA','1440/390/320 full-shell layout'],policySHA256:fixture.docs[0].sha256,measurements,errors,requestCount:fixture.calls.length};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS policy UI fixture: '+output);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
