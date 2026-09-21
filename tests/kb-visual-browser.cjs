// Local rendering/interaction fixture only. No public mutation or provider calls.
// NODE_PATH=<bundled node_modules> node tests/kb-visual-browser.cjs
// KB_VISUAL_EVIDENCE_DIR optionally overrides tests/evidence/kb-visual-refactor.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright');
const fixture = require('./fixtures/kb-review-history.json');
const root = path.resolve(__dirname, '..');
const evidenceDir = process.env.KB_VISUAL_EVIDENCE_DIR || path.join(root, 'tests/evidence/kb-visual-refactor');
const baseline = '00807e345e7a07dcc9750cc2550d7e9b11e8b85f';
const phase = process.env.KB_VISUAL_PHASE || 'both';
assert.ok(['before','after','both'].includes(phase), 'KB_VISUAL_PHASE is before, after or both');
const clone = value => JSON.parse(JSON.stringify(value));
const title = '업무일 검증 충전소 · 충전기 연결 검토'; // Reconstructed display metadata; not a captured report field.
const reason = '사람 검토 기록: 확인되지 않아 사용 보류';
const enrich = value => ({...clone(value),title,department:'device',visibility:'department',valid_from:null,valid_to:null,reason:value.version===1?'최초 등록':reason});
const v1 = enrich(fixture.v1);
const pending = enrich(fixture.pending);
const complete = enrich(fixture.complete);
const shared = enrich(fixture.shared);
for(const doc of [pending,complete,shared]) doc.history=[{...clone(v1)},{version:2,state:doc.state,reason,content:doc.content,source:doc.source}];
const stale={...clone(shared),version:3,state:'draft',company_status:'stale',shared_version:2,reason:'로컬 fixture: 새 버전 검토 전',comments:[...clone(shared.comments),{id:'fixture-unresolved',version:3,body:'로컬 fixture: 새 버전에서 적용 조건을 다시 확인해 주세요.',pending_version:null,resolved_version:null}]};
stale.history=[clone(v1),clone(complete),{version:3,state:'draft',reason:stale.reason,content:stale.content,source:stale.source}];
const awaitingShare={...clone(complete),company_status:'requested'};
const empty={...clone(v1),content:'',source:{},history:[],comments:[]};
const longId='fixture-document-'+('LONG_IDENTIFIER_WITHOUT_SPACES_'.repeat(10));
const longDoc={...clone(pending),id:longId,title:'로컬 시각 검증: '+('긴 정책 제목과 부서별 적용 조건을 읽는 방법 '.repeat(8)),comments:[...clone(pending.comments),...Array.from({length:5},(_,i)=>({id:'fixture-comment-'+i,version:2,body:'로컬 시각 검증 댓글 '+(i+1)+': '+('조건과 근거를 확인해야 합니다. '.repeat(5)),pending_version:null,resolved_version:i===4?2:null}))],source:{...clone(pending.source),label:'로컬 긴 출처 확인 '+longId}};
// Exact policy fields recorded by an earlier isolated local API integration test.
// Its content is an explicitly synthetic workspace operating policy; no new API request.
const policyReport = require('./evidence/data-intake-live/report.json');
const recordedPolicy = clone(policyReport.observations.review.policies[0]);
assert.equal(recordedPolicy.source.kind,'data-platform-privacy-policy');
const context={context_id:complete.source.context_id,dataset_id:complete.source.dataset_id,department:'device',station:{name:'업무일 검증 충전소',address:'서울 강남구 검증 주소',operator:'검증 운영기관'},records:[{row_number:1,public_charger_id:'01'}],source:clone(fixture.contextSource),capabilities:clone(complete.capabilities)};
let activeDocument=clone(complete);
const requests=[],blockedRequests=[],browserErrors=[],cases=[],layouts=[],screenshots=[];
const sourceCache=new Map();
const sourceAssets={before:{},after:{}};
function sourceFile(file,kind){
  const key=kind+file;if(kind==='before'&&sourceCache.has(key))return sourceCache.get(key);
  let value=kind==='before'?execFileSync('git',['show',baseline+':src/'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,'src',file),'utf8');
  sourceAssets[kind][file]=createHash('sha256').update(value).digest('hex');
  if(file==='config.js')value="window.KNOWHOW_CONFIG={apiBase:location.origin+'/knowhow',dataApiBase:location.origin+'/data-platform',aiRequestsPaused:true};";
  if(file==='demo.js'){
    const marker='return {activate,deactivate,isActive:()=>active,openVisitorContext};';
    assert.ok(value.includes(marker),'test exposure insertion marker must match');
    value=value.replace(marker,`return {activate,deactivate,isActive:()=>active,openVisitorContext,__fixture(next){Object.assign(state,next);history.replaceState(null,'','#scenario-'+state.tab+'-live');render();return state},__state:()=>state};`);
    value+='\nwindow.__kbFixture=sampleDemo;';
  }
  if(kind==='before')sourceCache.set(key,value);return value;
}
function json(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
async function serve(req,res){
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/data-platform/')){
    const parts=[];for await(const part of req)parts.push(part);const raw=Buffer.concat(parts).toString();const body=raw?JSON.parse(raw):{};
    requests.push({method:req.method,path:url.pathname,body});
    assert.notEqual(body.generate,true,'fixture must never request AI generation');
    if(url.pathname.endsWith('/station-contexts/resolve'))return json(res,context);
    if(url.pathname.endsWith('/kb/catalog'))return json(res,{documents:body.scope==='company'?(activeDocument.company_status==='approved'?[activeDocument]:[]):body.department===activeDocument.department?[activeDocument]:[],capabilities:context.capabilities});
    if(url.pathname.endsWith('/kb/document'))return json(res,{...activeDocument,capabilities:context.capabilities});
    if(url.pathname.endsWith('/kb/compare-versions'))return json(res,{before:body.from_version===1?v1:complete,after:activeDocument});
    if(url.pathname.endsWith('/kb/chat'))return json(res,{...clone(fixture.chat),evidence:fixture.chat.evidence.map(e=>({...e,title,department:'device',text:e.content}))});
    throw Error('Unexpected local API route: '+url.pathname);
  }
  if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
  const match=url.pathname.match(/^\/(before|after)\/(.*)$/);if(!match){res.writeHead(404);return res.end();}
  const kind=match[1],file=match[2]||'index.html';
  assert.ok(!file.includes('..')&&/^[a-z0-9-]+\.(?:html|js|css)$/.test(file),'only known source assets');
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(sourceFile(file,kind));
}
async function main(){
  fs.mkdirSync(evidenceDir,{recursive:true});
  const server=http.createServer((req,res)=>serve(req,res).catch(error=>{browserErrors.push(error.message);json(res,{error:error.message},500)}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  assert.ok(fs.existsSync('/Applications/Google Chrome.app'),'actual Google Chrome required');
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',error=>browserErrors.push(error.message));
  await page.route('**/*',route=>{if(!route.request().url().startsWith(origin+'/')){blockedRequests.push(route.request().url());return route.abort();}return route.continue();});
  async function load(kind){await page.goto(origin+'/'+kind+'/index.html#scenario-1-live');await page.waitForFunction(()=>window.__kbFixture);await page.evaluate(({origin,context})=>KnowHowCompany.openVisitorContext({apiBase:origin+'/data-platform',visitorBearer:'local-fixture-only',contextId:context.context_id}),{origin,context});await page.waitForFunction(()=>location.hash==='#scenario-1-live');}
  async function scene(doc,tab=3,contextDocument=doc){activeDocument=clone(doc);await page.evaluate(({doc,v1,tab,contextDocument})=>window.__kbFixture.__fixture({tab,document:contextDocument,documents:[doc],loaded:true,role:'reviewer',comparison:doc.version>1?{before:v1,after:doc}:null,comparisonError:'',error:'',notice:'',humanDraft:null,revisionDraft:null,busy:false}),{doc:clone(doc),v1,tab,contextDocument:clone(contextDocument)});await page.evaluate(()=>scrollTo(0,0));}
  async function capture(name,width){
    await page.setViewportSize({width,height:width===1440?1000:width===320?740:844});
    await page.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});
    const layout=await page.evaluate(()=>{
      const rect=node=>node?.getBoundingClientRect().toJSON()||null;
      const summary=document.querySelector('.company-current-summary'),review=document.querySelector('.company-document .company-review-summary');
      const judgment=review&&[...review.querySelectorAll('p')].find(node=>node.textContent.startsWith('현재 판단'));
      return {width:innerWidth,viewport_height:innerHeight,height:document.documentElement.scrollHeight,header_height:document.querySelector('.app-header').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-innerWidth,sidebar_present:!!document.querySelector('#workspace-navigation'),sidebar_bounds:rect(document.querySelector('#workspace-navigation')),summary:summary?.innerText||null,summary_bounds:rect(summary),review_bounds:rect(review),judgment:judgment?.innerText||null,judgment_bounds:rect(judgment)};
    });
    layouts.push({scene:name,...layout});if(name.startsWith('after-'))assert.equal(layout.overflow,0,name+' overflow');assert.equal(layout.header_height,width>760?48:56,name+' header height');assert.equal(layout.sidebar_present,true);
    if(width<=760)assert.ok(layout.sidebar_bounds.right<=0,'closed mobile drawer must finish transition before capture');
    
    if(name==='after-review-v2'){assert.ok(layout.summary_bounds.bottom<=layout.viewport_height,'current version/review/sharing status visible in first viewport');assert.ok(layout.judgment_bounds?.bottom<=layout.viewport_height,'current use-hold judgment visible in first viewport');}
    const filename=name+'-'+width+'.png';await page.screenshot({path:path.join(evidenceDir,filename),fullPage:true,animations:'disabled'});screenshots.push(filename);if(/-(review-v2|org-shared-detail-v2|general-policy)$/.test(name)){const fold=name+'-'+width+'-firstfold.png';await page.screenshot({path:path.join(evidenceDir,fold),animations:'disabled'});screenshots.push(fold);}
  }
  async function appCompany(doc){await scene(doc,5);await page.locator('[data-org-control="department"]').selectOption('app');await page.locator('[data-org-scope="company"]').click();await page.locator('.org-document').waitFor();}
  async function keyboardOpen(selector){const details=page.locator(selector).first();assert.equal(await details.getAttribute('open'),null,selector+' starts closed');await details.locator(':scope > summary').focus();await page.keyboard.press('Enter');assert.equal(await details.evaluate(e=>e.open),true,selector+' opens by keyboard');return details;}
  async function orgDetails(doc,department='device',contextDocument=doc){
    await scene(doc,5,contextDocument);
    await page.locator('[data-org-control="department"]').selectOption(department);
    await page.locator('[data-org-scope="department"]').click();
    await page.locator('.org-document').waitFor();
    await page.locator('[data-org-action="document"]').first().click();
    await page.locator('.org-document-detail').waitFor();
  }
  async function verifyCurrentOriginal(doc){
    const full=await keyboardOpen('details.company-full-document');
    assert.equal(await full.locator('pre').first().textContent(),doc.content,'complete current bytes remain readable');
    await full.locator(':scope > summary').press('Enter');
  }
  async function checkPhase(kind){
    await load(kind);await scene(complete);
    for(const width of [1440,390,320])await capture(kind+'-review-v2',width);
    assert.match(await page.locator('.company-current-summary').innerText(),/v2/);
    assert.match(await page.locator('.company-document .company-review-summary').innerText(),/보류/);
    assert.match(await page.locator('.company-current-summary').innerText(),/검토 완료/);
    assert.match(await page.locator('.company-current-summary').innerText(),/미해결[\s\S]*0|0[\s\S]*미해결/);
    await verifyCurrentOriginal(complete);
    const resolved=await keyboardOpen('.company-resolved-comments');
    assert.ok((await resolved.innerText()).includes(complete.comments[0].body),'resolved comment retains full body');
    await resolved.locator(':scope > summary').press('Enter');
    const history=page.locator('.company-history details.company-version').filter({has:page.locator('summary',{hasText:'정정 전 · v1'})});
    assert.equal(await history.getAttribute('open'),null);
    await history.locator('summary').focus();await page.keyboard.press('Enter');
    assert.equal(await history.locator('pre').textContent(),v1.content,'complete v1 body remains readable by keyboard');
    cases.push(kind+': confirmed hold v2 retains separate human review status, current/old exact bodies, and resolved comment through keyboard disclosures.');

    await scene(pending);await capture(kind+'-review-pending-v2',320);
    const pendingSummary=await page.locator('.company-current-summary').innerText();
    assert.match(await page.locator('.company-document .company-review-summary').innerText(),/보류/);
    assert.match(pendingSummary,/검토.*전|완료.*전|완료.*필요|미완료/);
    assert.match(pendingSummary,/미해결[\s\S]*1|1[\s\S]*미해결/);
    assert.equal(await page.locator('[data-company-action="complete-human-review"]').count(),1);

    await scene(stale);await capture(kind+'-current-v3-shared-v2',320);
    const staleSummary=await page.locator('.company-current-summary').innerText();
    assert.match(staleSummary,/v3/);assert.match(staleSummary,/v2/);
    assert.match(staleSummary,/재승인|다시.*승인|최신.*미공유/);
    assert.match(staleSummary,/미해결[\s\S]*1|1[\s\S]*미해결/);
    await scene(awaitingShare);await capture(kind+'-sharing-pending-v2',390);
    assert.match(await page.locator('.company-current-summary').innerText(),/승인 대기|승인 요청|공유 대기/);
    await scene(v1);await capture(kind+'-unreviewed-v1',320);
    assert.match(await page.locator('.company-document').innerText(),/미확인|확인.*전|검토.*전/);
    await scene(empty);await capture(kind+'-empty-body',320);
    assert.ok(!(await page.locator('.company-document').innerText()).includes('[object Object]'));
    await scene(longDoc);for(const width of [1440,390,320])await capture(kind+'-long-id-comments',width);
    assert.ok((await page.locator('.company-document').textContent()).includes(longId),'exact long ID retained');
    for(const comment of longDoc.comments.filter(c=>!c.resolved_version))assert.ok((await page.locator('.company-document').innerText()).includes(comment.body),'each open comment readable');
    await keyboardOpen('details.company-full-document');
    await capture(kind+'-long-id-original-open',320);
    cases.push(kind+': pending review, current v3 versus approved v2, sharing requested, unreviewed, empty body, long title/ID and six comments rendered.');

    await appCompany(shared);for(const width of [1440,390,320])await capture(kind+'-org-shared-list-v2',width);
    const orgCard=await page.locator('.org-document').first().innerText();
    assert.match(orgCard,/v2/);assert.match(orgCard,/공유/);assert.match(orgCard,/보류/);
    await page.locator('[data-org-action="document"]').first().click();await page.locator('.org-document-detail').waitFor();
    for(const width of [1440,390,320])await capture(kind+'-org-shared-detail-v2',width);
    const currentText=await page.locator('#company-shared-library').innerText();assert.match(currentText,/v2/);
    const orgFull=page.locator('.org-document-detail details').filter({has:page.locator(':scope > summary',{hasText:'전체 본문·출처'})}).first();
    assert.equal(await orgFull.getAttribute('open'),null);await orgFull.locator(':scope > summary').focus();await page.keyboard.press('Enter');
    assert.equal(await orgFull.locator(':scope > pre').textContent(),shared.content,'shared detail exact current body');
    const provenance=orgFull.locator('details').first();await provenance.locator(':scope > summary').focus();await page.keyboard.press('Enter');
    assert.ok((await provenance.innerText()).includes(shared.source.original_sha256),'source SHA-256 preserved');
    const orgOld=page.locator('.org-history-entry details').filter({has:page.locator('summary',{hasText:'v1'})});
    assert.equal(await orgOld.getAttribute('open'),null);await orgOld.locator(':scope > summary').focus();await page.keyboard.press('Enter');
    assert.equal(await orgOld.locator('pre').textContent(),v1.content,'shared detail exact old body');
    await capture(kind+'-org-shared-open-source-history',320);
    await page.locator('[data-org-action="ask-document"]').first().click();
    await page.locator('[data-org-form="chat"] [name="question"]').fill('내부 장비 ID를 확인하기 전에 무엇을 보류해야 하나요?');
    await page.locator('[data-org-form="chat"] [data-evidence-only]').click();await page.locator('.org-turn').waitFor();
    await capture(kind+'-org-evidence-v2',320);
    assert.match(await page.locator('.org-turn').innerText(),/보류/);
    assert.ok(requests.some(r=>r.path.endsWith('/chat')&&r.body.department==='app'&&r.body.include_company===true&&r.body.generate===false));
    cases.push(kind+': app department opens approved company scope and exact same v2 source/history, then explicitly requests local document evidence with generate=false.');

    await orgDetails(longDoc);await capture(kind+'-org-long-id-detail',320);
    assert.ok((await page.locator('.org-document-detail').textContent()).includes(longId));
    const longOriginal=page.locator('.org-document-detail details').filter({has:page.locator(':scope > summary',{hasText:'전체 본문·출처'})}).first();
    await longOriginal.locator(':scope > summary').focus();await page.keyboard.press('Enter');
    await longOriginal.locator('details > summary').first().focus();await page.keyboard.press('Enter');
    await capture(kind+'-org-long-id-source-open',320);
    assert.ok((await longOriginal.innerText()).includes(longId),'long ID visibly readable in open source detail');
    await orgDetails(recordedPolicy,'data',complete);
    const policyDetail=page.locator('.org-document-detail');
    assert.match(await policyDetail.innerText(),/정책 버전 확인 완료/);
    assert.match(await policyDetail.innerText(),/종료일 미지정/);
    assert.ok(!(await policyDetail.innerText()).includes('내부 ID'),'policy does not inherit charger review requirements');
    for(const width of [1440,390,320])await capture(kind+'-recorded-privacy-policy',width);
    const policyOriginal=policyDetail.locator('details').filter({has:page.locator(':scope > summary',{hasText:'전체 본문·출처'})}).first();
    await policyOriginal.locator(':scope > summary').focus();await page.keyboard.press('Enter');
    assert.equal(await policyOriginal.locator(':scope > pre').textContent(),recordedPolicy.content,'recorded actual local API policy bytes remain readable');
    await capture(kind+'-recorded-privacy-policy-original',320);
    cases.push(kind+': exact previously recorded local API privacy-policy response uses shared adapter with its own policy review state and unspecified end date, without charger ID requirements or new API calls.');
    await page.goto(origin+'/'+kind+'/index.html#general-2');
    await page.locator('#general-save').waitFor();
    for(const width of [1440,390,320])await capture(kind+'-general-policy',width);
    assert.match(await page.locator('#page').innerText(),/가상/);
    const generalOriginal=page.locator('#page details').filter({has:page.locator(':scope > summary',{hasText:'원문·확인 근거·정정 이력'})}).first();
    await generalOriginal.locator(':scope > summary').focus();await page.keyboard.press('Enter');
    assert.match(await generalOriginal.innerText(),/payments.paid_at/);
    await capture(kind+'-general-policy-source',320);
    await page.setViewportSize({width:320,height:844});await page.locator('#navigation-toggle').click();
    assert.equal(await page.locator('#navigation-toggle').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');
    assert.equal(await page.locator('#navigation-toggle').getAttribute('aria-expanded'),'false');
    cases.push(kind+': general fictional policy and original data remain reachable by keyboard; mobile Escape closes compact navigation.');
  }
  try{
    if(phase!=='after')await checkPhase('before');
    if(phase!=='before')await checkPhase('after');
    assert.deepEqual(blockedRequests,[],'No external request even attempted');assert.deepEqual(browserErrors,[],'No browser runtime errors');
    assert.equal(requests.some(r=>/\/(revise|review|promote|request-promotion|revoke|comment|data-draft)$/.test(r.path)),false,'fixture uses no mutation endpoints');
    const report={passed:true,phase,scope:'Isolated actual local Chrome fixture rendering/interaction; not production API, live model, embedding, or deployment verification. Long title/ID, extra comments and empty-body scenarios are synthetic rendering inputs.',baseline,checked_at:new Date().toISOString(),fixture:fixture.provenance,privacy_policy_fixture:{source:'tests/evidence/data-intake-live/report.json#/observations/review/policies/0',scope:policyReport.scope,exact_record:recordedPolicy},browser:await browser.version(),source_asset_sha256:sourceAssets,model_calls:0,real_api_calls:0,embedding_calls:0,public_mutations:0,cases,layouts,screenshots,local_fixture_requests:requests,blocked_requests:blockedRequests,browser_errors:browserErrors};
    fs.writeFileSync(path.join(evidenceDir,'browser-report-'+phase+'.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({passed:true,phase,cases,layouts:layouts.map(({scene,width,height,header_height,overflow})=>({scene,width,height,header_height,overflow}))},null,2));
  }catch(error){await page.screenshot({path:path.join(evidenceDir,'browser-failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(evidenceDir,'browser-failure.json'),JSON.stringify({error:error.stack,cases,layouts,requests,blockedRequests,browserErrors},null,2)+'\n');throw error;}
  finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1});
