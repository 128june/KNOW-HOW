// Local rendering/interaction fixture only. No public mutation or provider calls.
// NODE_PATH=<bundled node_modules> node tests/kb-review-history-browser.cjs
// KB_REVIEW_EVIDENCE_DIR optionally overrides tests/evidence/kb-review-history.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright');
const fixture = require('./fixtures/kb-review-history.json');
const root = path.resolve(__dirname, '..');
const evidenceDir = process.env.KB_REVIEW_EVIDENCE_DIR || path.join(root, 'tests/evidence/kb-review-history');
const baseline = '44e105d8c99e1bde5c2ea161cce12df719efb507';
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
    if(url.pathname.endsWith('/kb/catalog'))return json(res,{documents:body.department==='device'||body.scope==='company'?[activeDocument]:[],capabilities:context.capabilities});
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
  async function scene(doc,tab=3){activeDocument=clone(doc);await page.evaluate(({doc,v1,tab})=>window.__kbFixture.__fixture({tab,document:doc,documents:[doc],loaded:true,role:'reviewer',comparison:doc.version>1?{before:v1,after:doc}:null,comparisonError:'',error:'',notice:'',humanDraft:null,revisionDraft:null,busy:false}),{doc:clone(doc),v1,tab});await page.evaluate(()=>scrollTo(0,0));}
  async function capture(name,width){
    await page.setViewportSize({width,height:width===1440?1000:width===320?740:844});
    await page.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});
    const layout=await page.evaluate(()=>{
      const rect=node=>node?.getBoundingClientRect().toJSON()||null;
      const summary=document.querySelector('.company-current-summary'),review=document.querySelector('.company-document .company-review-summary');
      const judgment=review&&[...review.querySelectorAll('p')].find(node=>node.textContent.startsWith('현재 판단'));
      return {width:innerWidth,viewport_height:innerHeight,height:document.documentElement.scrollHeight,header_height:document.querySelector('.app-header').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-innerWidth,sidebar_present:!!document.querySelector('#workspace-navigation'),sidebar_bounds:rect(document.querySelector('#workspace-navigation')),summary:summary?.innerText||null,summary_bounds:rect(summary),review_bounds:rect(review),judgment:judgment?.innerText||null,judgment_bounds:rect(judgment)};
    });
    layouts.push({scene:name,...layout});assert.equal(layout.overflow,0,name+' overflow');assert.equal(layout.header_height,width>760?48:56,name+' header height');assert.equal(layout.sidebar_present,true);
    if(width<=760)assert.ok(layout.sidebar_bounds.right<=0,'closed mobile drawer must finish transition before capture');
    if(name==='after-comment-reviewed-v2'){assert.ok(layout.summary_bounds.bottom<=layout.viewport_height,'current status visible in first viewport');assert.ok(layout.judgment_bounds.bottom<=layout.viewport_height,'current judgment visible in first viewport');}
    const filename=name+'-'+width+'.png';await page.screenshot({path:path.join(evidenceDir,filename),fullPage:true,animations:'disabled'});screenshots.push(filename);if(width===320&&name==='after-comment-reviewed-v2'){const fold='after-comment-reviewed-v2-320-firstfold.png';await page.screenshot({path:path.join(evidenceDir,fold),animations:'disabled'});screenshots.push(fold);}
  }
  async function appCompany(doc){await scene(doc,5);await page.locator('[data-org-control="department"]').selectOption('app');await page.locator('[data-org-scope="company"]').click();await page.locator('.org-document').waitFor();}
  async function keyboardOpen(selector){const details=page.locator(selector).first();assert.equal(await details.getAttribute('open'),null,selector+' starts closed');await details.locator(':scope > summary').focus();await page.keyboard.press('Enter');assert.equal(await details.evaluate(e=>e.open),true,selector+' opens by keyboard');return details;}
  try{
    await load('before');await scene(complete);for(const width of [1440,390,320])await capture('before-comment-reviewed-v2',width);
    if(process.env.KB_BROWSER_BASELINE_ONLY==='1')return;
    await appCompany(shared);for(const width of [1440,390,320])await capture('before-app-shared-v2',width);
    await load('after');await scene(complete);for(const width of [1440,390,320])await capture('after-comment-reviewed-v2',width);
    assert.match(await page.locator('.company-current-summary').innerText(),/v2/);
    assert.match(await page.locator('.company-document .company-review-summary').innerText(),/보류/);
    assert.match(await page.locator('.company-current-summary').innerText(),/검토 완료/);
    assert.match(await page.locator('.company-current-summary').innerText(),/미해결[\s\S]*0|0[\s\S]*미해결/);
    const full=await keyboardOpen('details.company-full-document');assert.equal(await full.locator('pre').first().textContent(),complete.content,'complete current bytes remain readable');await full.locator(':scope > summary').press('Enter');
    const resolved=await keyboardOpen('.company-resolved-comments');assert.ok((await resolved.innerText()).includes(complete.comments[0].body),'resolved comment retained with full body');await resolved.locator(':scope > summary').press('Enter');
    const history=page.locator('.company-history details.company-version').filter({has:page.locator('summary',{hasText:'정정 전 · v1'})});assert.equal(await history.getAttribute('open'),null);await history.locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await history.locator('pre').textContent(),v1.content,'complete v1 body remains readable by keyboard');
    cases.push('Completed unknown v2 distinguishes use-hold judgment from human review completion; unresolved count is zero; exact full current and old bodies available through keyboard details.');
    await scene(pending);await capture('after-review-pending-v2',320);const pendingSummary=await page.locator('.company-current-summary').innerText();assert.match(await page.locator('.company-document .company-review-summary').innerText(),/보류/);assert.match(pendingSummary,/검토.*전|완료.*전|완료.*필요|미완료/);assert.match(pendingSummary,/미해결[\s\S]*1|1[\s\S]*미해결/);assert.equal(await page.locator('[data-company-action="complete-human-review"]').count(),1);cases.push('Pending v2 retains hold conclusion and one unresolved/pending comment while presenting an explicit separate completion action.');
    await scene(stale);await capture('after-current-v3-shared-v2',320);const staleSummary=await page.locator('.company-current-summary').innerText();assert.match(staleSummary,/v3/);assert.match(staleSummary,/v2/);assert.match(staleSummary,/재승인|다시.*승인|최신.*미공유/);assert.match(staleSummary,/미해결[\s\S]*1|1[\s\S]*미해결/);cases.push('Synthetic v3/current versus v2/shared stale case separates version numbers and surfaces unresolved comments without treating old review as current.');
    await appCompany(shared);
    for(const width of [1440,390,320])await capture('after-app-shared-v2',width);
    const orgCard=await page.locator('.org-document').first().innerText();assert.match(orgCard,/v2/);assert.match(orgCard,/공유/);assert.match(orgCard,/보류/);
    await page.locator('[data-org-action="document"]').first().click();await page.locator('.org-document-details,.org-turn').last().waitFor();
    const currentText=await page.locator('#company-shared-library').innerText();assert.match(currentText,/v2/);
    const orgFull=page.locator('.org-document-detail > details').filter({has:page.locator(':scope > summary',{hasText:'전체 본문·출처'})});assert.equal(await orgFull.getAttribute('open'),null);await orgFull.locator(':scope > summary').focus();await page.keyboard.press('Enter');assert.equal(await orgFull.locator(':scope > pre').textContent(),shared.content,'shared detail exact current body');
    const provenance=orgFull.locator('details').first();await provenance.locator(':scope > summary').focus();await page.keyboard.press('Enter');assert.ok((await provenance.innerText()).includes(shared.source.original_sha256),'source SHA-256 preserved');
    const orgOld=page.locator('.org-history-entry details').filter({has:page.locator('summary',{hasText:'v1'})});assert.equal(await orgOld.getAttribute('open'),null);await orgOld.locator(':scope > summary').focus();await page.keyboard.press('Enter');assert.equal(await orgOld.locator('pre').textContent(),v1.content,'shared detail exact old body');
    await page.locator('[data-org-action="ask-document"]').first().click();await page.locator('[data-org-form="chat"] [name="question"]').fill('내부 장비 ID를 확인하기 전에 무엇을 보류해야 하나요?');await page.locator('[data-org-form="chat"] [data-evidence-only]').click();await page.locator('.org-turn').waitFor();
    for(const width of [1440,390,320])await capture('after-app-shared-evidence-v2',width);
    assert.match(await page.locator('.org-turn').innerText(),/보류/);assert.ok(requests.some(r=>r.path.endsWith('/chat')&&r.body.department==='app'&&r.body.include_company===true&&r.body.generate===false));cases.push('App department explicitly opens approved company scope, reads shared v2, and requests exact document evidence with generate=false using local responses.');
    await page.setViewportSize({width:320,height:844});await page.locator('#navigation-toggle').click();assert.equal(await page.locator('#navigation-toggle').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#navigation-toggle').getAttribute('aria-expanded'),'false');cases.push('Mobile sidebar keyboard Escape closes the retained navigation; desktop/mobile header remains 48/56px with zero overflow at 1440/390/320.');
    assert.deepEqual(blockedRequests,[],'No external request even attempted');assert.deepEqual(browserErrors,[],'No browser runtime errors');
    assert.equal(requests.some(r=>/\/(revise|review|promote|request-promotion|revoke|comment|data-draft)$/.test(r.path)),false,'fixture uses no mutation endpoints');
    const report={passed:true,scope:'Isolated local Chrome fixture rendering/interaction; not production API, live model, embedding, or deployment verification.',baseline,checked_at:new Date().toISOString(),fixture:fixture.provenance,browser:await browser.version(),source_asset_sha256:sourceAssets,model_calls:0,real_api_calls:0,embedding_calls:0,public_mutations:0,cases,layouts,screenshots,local_fixture_requests:requests,blocked_requests:blockedRequests,browser_errors:browserErrors};fs.writeFileSync(path.join(evidenceDir,'browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,cases,layouts:layouts.map(({scene,width,height,header_height,overflow,summary_bounds,judgment_bounds})=>({scene,width,height,header_height,overflow,summary_bottom:summary_bounds?.bottom,judgment_bottom:judgment_bounds?.bottom}))},null,2));
  }catch(error){await page.screenshot({path:path.join(evidenceDir,'browser-failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(evidenceDir,'browser-failure.json'),JSON.stringify({error:error.stack,cases,layouts,requests,blockedRequests,browserErrors},null,2)+'\n');throw error;}
  finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1});
