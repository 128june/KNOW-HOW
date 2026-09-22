// Isolated browser regression: synthetic API fixtures, ephemeral localhost server,
// headless Chrome and src assets only. No user session, dist build or external API.
// NODE_PATH=<bundled node_modules> <bundled node> tests/support-compose-browser.cjs
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cases = [];
const browserErrors = [];
const externalRequests = [];
const evidenceDir = process.env.SUPPORT_COMPOSE_EVIDENCE_DIR;
const catalogTitles = {symptoms:'민원 증상',errors:'오류 코드·문구',app_os:'OS',app_versions:'앱 버전',app_actions:'실패한 동작',device_states:'장비 화면·표시'};
const catalogFields = {symptoms:'symptom',errors:'error_code',app_os:'app_context',app_versions:'app_context',app_actions:'app_context',device_states:'device_context'};
const option = (id,value,label,extra={}) => ({id,value,label,description:`로컬 fixture 설명: ${label}`,ask:'고객에게 실제 표시를 확인하세요.',input_mode:'select',...extra});
function documents() {
  const base = (id,department,title) => ({id,department,title,version:1,status:'로컬 브라우저 검증 fixture',purpose:'자동 회귀 검증용 합성 KB. 실제 회사 자료가 아님.',sections:[{id:'route',title:'전달 기준',text:'확인한 증상을 담당 부서에 전달합니다.'},{id:'intake',title:'접수 기준',text:'확인한 내용만 기록합니다.'}]});
  const app = {...base('APP-001','app','합성 앱 부서 KB'),intake_fields:[{key:'app_context',label:'앱 버전·OS와 실패한 동작',placeholder:'고객에게 확인한 앱 정보'}],checklist:['route'],reply_hint:'확인한 앱 정보만 회신합니다.'};
  const device = {...base('DEVICE-001','device','합성 장비 부서 KB'),intake_fields:[{key:'device_context',label:'충전기 화면·표시 상태',placeholder:'고객에게 확인한 표시 상태'}],checklist:['route'],reply_hint:'확인한 장비 정보만 회신합니다.'};
  const guide = {...base('INTAKE-001','counselor-guide','합성 민원 입력 KB'),catalogs:{
    symptoms:[option('fixture-symptom','FIXTURE 충전 진행 멈춤','합성 증상 항목')],
    errors:[option('fixture-error','FIXTURE-ERROR-77','합성 오류 문구 <표시>',{demo:true})],
    app_os:[option('fixture-os','FixtureOS','합성 OS')],
    app_versions:[option('fixture-version','DEMO Fixture 7.7','시연용 버전 · 실제 배포 버전 아님',{demo:true})],
    app_actions:[option('fixture-action','FIXTURE 시작 요청 실패','합성 시작 동작')],
    device_states:[option('fixture-device','FIXTURE 화면 확인 중','합성 장비 표시 상태')]
  }};
  guide.catalog_meta = Object.fromEntries(Object.keys(guide.catalogs).map(key=>[key,{title:catalogTitles[key],field:catalogFields[key],max_length:key==='symptoms'?1600:key==='errors'?200:700,section_id:key,description:'로컬 fixture 항목을 실제 회사의 기준으로 사용하지 않습니다.',ask:'고객에게 확인하세요.',selection:'single',allow_custom:true,unknown_id:'unknown',custom_id:'other'}]));
  for (const [key,rows] of Object.entries(guide.catalogs)) {
    rows.push(option('unknown','미확인','고객에게 확인하지 못함',{input_mode:'unknown'}),option('other','기타 직접 입력','목록에 없는 실제 값',{input_mode:'custom'}));
    guide.sections.push({id:key,title:catalogTitles[key],text:'시연용 목록이며 직접 입력할 수 있습니다.'});
  }
  return [base('CS-001','counselor','합성 상담사 KB'),app,device,guide].sort((a,b)=>a.id.localeCompare(b.id));
}
const station = {station_key:'fixture-station-a',name:'로컬 검증 충전소',address:'서울특별시 검증구 테스트로 22',operator:'Fixture A',row_count:2};
const charger = {record_key:'fixture-row-01',charger_id:'01',type:'DC콤보',location:'검증 주차장',status:'수집 당시 미확인',fields:{'충전용량':'200kW','이용가능시간':'확인 필요','이용자 제한':'확인 필요'}};
const target = {station,charger,facts:{station_name:station.name,charger_id:'01',address:station.address,operator:station.operator,capacity:'200kW',speed:'급속',connector:'DC콤보',location:charger.location,hours:'미제공',access:'미제공',manufacturer:'미제공',current_status:'수집 당시 미확인'},source:{collected_at:'2026-09-22T00:00:00Z',original_sha256:'fixture-source'}};
const emptyIncident = () => ({symptom:'',occurred_at:'',error_code:'',app_context:'',device_context:'',recipients:['app','device']});
let fixture;
function setup(overrides={}) {fixture={documents:documents(),requests:[],candidates:[],candidateOwners:{},reviewRequests:[],sessionSerial:0,tickets:[],createFailures:[],candidateFailures:[],changeOnPrepare:false,holdCandidate:false,releaseCandidate:null,...overrides};}
function snapshot(body) {
  const incident=Object.fromEntries(['symptom','occurred_at','error_code','app_context','device_context'].map(key=>[key,(body[key]||'').trim()]));
  const knowledge=fixture.documents.filter(d=>['counselor',...body.recipients].includes(d.department)||(d.id==='INTAKE-001'&&['symptom','error_code','app_context','device_context'].some(key=>incident[key])));
  const preview={target:clone(target),incident,recipients:[...body.recipients].sort(),knowledge:clone(knowledge)};
  return {...preview,preview_hash:digest(preview)};
}
function respond(res,value,status=200) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
async function serve(req,res) {
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/knowhow/demo/support/')) {
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=JSON.parse(Buffer.concat(chunks).toString()||'{}');
    const action=url.pathname.split('/').at(-1);
    fixture.requests.push({action,body:clone(body)});
    if(action==='session')return respond(res,{session_id:`fixture-session-${++fixture.sessionSerial}`});
    if(action==='knowledge')return respond(res,{documents:fixture.documents.map(d=>({...clone(d),hash:digest(d)})),candidates:clone(fixture.candidates.filter(c=>!fixture.candidateOwners[c.id]||fixture.candidateOwners[c.id]===body.session_id))});
    if(action==='context')return respond(res,clone(target));
    if(action==='search') {
      const all=[station,{...station,station_key:'fixture-station-b',name:'다른 합성 충전소',operator:'Fixture B'}];
      const selected=body.operator?all.filter(s=>s.operator===body.operator):all;
      return respond(res,{stations:selected,total:selected.length,unfiltered_total:2,has_more:false,operators:[{name:'Fixture A',total:1},{name:'Fixture B',total:1}]});
    }
    if(action==='chargers')return respond(res,{station,chargers:[charger,{...charger,record_key:'fixture-row-02',charger_id:'02'}],has_more:false});
    if(action==='prepare') {
      if(fixture.changeOnPrepare){fixture.changeOnPrepare=false;fixture.documents.find(d=>d.id==='INTAKE-001').version++;}
      return respond(res,snapshot(body));
    }
    if(action==='create') {
      const fail=fixture.createFailures.shift();
      if(fail){if(fail===409)fixture.documents.find(d=>d.id==='INTAKE-001').version++;return respond(res,{error:`Fixture ${fail}: 티켓 접수 재시도`},fail);}
      const preview=snapshot(body);
      if(preview.preview_hash!==body.preview_hash)return respond(res,{error:'Fixture snapshot changed'},409);
      const existing=fixture.tickets.find(t=>t.request_id===body.request_id);
      if(existing)return respond(res,existing);
      const ticket={...preview,id:`KH-FIXTURE-${fixture.tickets.length+1}`,request_id:body.request_id,created_at:'2026-09-22T01:30:00Z',status:'open',replies:[],revision:1,departments:Object.fromEntries(body.recipients.map(r=>[r,'received']))};
      fixture.tickets.push(ticket);return respond(res,ticket);
    }
    if(action==='tickets')return respond(res,{tickets:fixture.tickets});
    if(action==='ticket')return respond(res,fixture.tickets.find(t=>t.id===body.ticket_id));
    if(action==='knowledge-review-requests') {
      const visible=fixture.reviewRequests.filter(r=>fixture.candidateOwners[r.candidate_id]===body.session_id);
      return respond(res,{requests:visible.map(r=>({...clone(r),candidate:clone(fixture.candidates.find(c=>c.id===r.candidate_id))})),unread_count:visible.filter(r=>!r.read_at).length});
    }
    if(action==='knowledge-review-read') {
      const review=fixture.reviewRequests.find(r=>r.id===body.review_request_id&&fixture.candidateOwners[r.candidate_id]===body.session_id);
      if(!review)return respond(res,{error:'Review request not in this fixture session'},404);
      if(!review.read_at){review.read_at='2026-09-22T02:00:00Z';review.read_by='로컬 검증 KB 관리자';}
      return respond(res,{review_request:clone(review)});
    }
    if(action==='knowledge-candidate') {
      if(fixture.holdCandidate)await new Promise(resolve=>{fixture.releaseCandidate=resolve;fixture.onCandidateHeld?.();});
      const fail=fixture.candidateFailures.shift();if(fail){if(fail===409)fixture.documents.find(d=>d.id==='INTAKE-001').version++;return respond(res,{error:`Fixture ${fail}: KB 후보 등록 재시도`},fail);}
      const existing=fixture.candidates.find(c=>c.field===body.field&&c.value===body.value&&(!fixture.candidateOwners[c.id]||fixture.candidateOwners[c.id]===body.session_id));
      if(existing)return respond(res,{candidate:existing,created:false,review_request:fixture.reviewRequests.find(r=>r.candidate_id===existing.id)});
      const candidate={id:`candidate-${fixture.candidates.length+1}`,status:'pending',status_label:'확정 전',field:body.field,value:body.value,kb_id:body.kb_id,kb_version:body.kb_version||1,source:{kind:'manual_input'},author:'로컬 검증 상담사',created_at:'2026-09-22T01:30:00Z'};
      const review={id:`review-${candidate.id}`,candidate_id:candidate.id,kb_id:candidate.kb_id,kb_version:candidate.kb_version,field:candidate.field,status:'requested',status_label:'확정 요청',channel:'in_app',recipient_role:'kb_admin',requested_at:candidate.created_at,requested_by:'로컬 검증 상담사',read_at:null,read_by:null};
      fixture.candidateOwners[candidate.id]=body.session_id;fixture.candidates.push(candidate);fixture.reviewRequests.push(review);return respond(res,{candidate,created:true,...(!fixture.omitReviewReceipt?{review_request:clone(review)}:{})});
    }
    return respond(res,{error:`Unexpected fixture action ${action}`},404);
  }
  if(['/style.css','/support-workspace.css','/support-workspace.js','/support-kb-pending.js','/support-kb-pending.css'].includes(url.pathname)) {
    res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');
    return res.end(fs.readFileSync(path.join(root,'src',url.pathname.slice(1))));
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>민원 작성 · 격리 fixture 검증</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/support-workspace.css"><link rel="stylesheet" href="/support-kb-pending.css"><body><main id="support-host"></main><script>window.KNOWHOW_CONFIG={apiBase:location.origin+'/knowhow'};</script><script src="/support-kb-pending.js"></script><script src="/support-workspace.js"></script><script>const controller=KnowHowSupport.createController();const mount=()=>controller.mount(document.querySelector('#support-host'));mount();addEventListener('hashchange',()=>{controller.destroy();mount();});</script></body></html>`);
}

async function main() {
  setup();
  const server=http.createServer((req,res)=>serve(req,res).catch(error=>{console.error(error);respond(res,{error:error.message},500);}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,...(fs.existsSync('/Applications/Google Chrome.app')?{channel:'chrome'}:{})});
  const contexts=[];
  async function open(incident=null,route='compose') {
    const context=await browser.newContext({viewport:{width:1360,height:950},timezoneId:'America/Los_Angeles'});contexts.push(context);
    const page=await context.newPage();page.on('pageerror',e=>browserErrors.push(e.message));
    await page.route('**/*',r=>{if(!r.request().url().startsWith(base)){externalRequests.push(r.request().url());return r.abort();}return r.continue();});
    if(incident)await page.addInitScript(({base,incident})=>{const key='knowhow.support.session:'+base+'/knowhow';if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'fixture-session');sessionStorage.setItem(key+':draft',JSON.stringify({session:'fixture-session',selection:{station_key:'fixture-station-a',record_key:'fixture-row-01'},incident,previewOpen:true}));}},{base,incident});
    await page.goto(base+'/#support'+(route==='search'?'':'-'+route));
    await page.locator(route==='search'?'#support-search':'#support-intake').waitFor();
    if(route!=='search')await page.locator('#support-intake button[type=submit]').waitFor({state:'visible'});
    return page;
  }
  const preview = page => page.locator('#support-preview-content');
  const field = (page,name) => page.locator(`#support-intake [name="${name}"]`);
  const choose = async(page,key,index=0) => {await page.locator(`[data-open-catalog="${key}"]`).click();await page.locator('#support-catalog-dialog[open]').waitFor();await page.locator(`[data-catalog-choice="${index}"]`).click();};
  const sent = async page => {await page.waitForURL(/#support-tickets\?ticket=/);await page.locator('#support-reply').waitFor();};
  const submit = page => page.locator('#support-intake button[type=submit]').click();
  const requests = action => fixture.requests.filter(r=>r.action===action);
  const screenshot = async(page,name) => {if(evidenceDir){fs.mkdirSync(evidenceDir,{recursive:true});await page.screenshot({path:path.join(evidenceDir,name+'.png'),fullPage:true});}};
  try {
    // Run both independent regressions before failing, so a broken first path
    // cannot hide the session-recovery failure in the second path.
    const regressionFailures=[];
    const regression=async(name,check)=>{try{await check();cases.push(name);}catch(error){regressionFailures.push(new Error(name,{cause:error}));}};
    await regression('Multiline error candidates retain exact text and pending status through edits, modal reopen, reload and ticket submission',async()=>{
      setup();const multiline=await open({...emptyIncident(),symptom:'여러 줄 오류 원문 확인',app_context:'기존 앱 메모'});
      const errorText='E-RAW-401\n첫 번째 안내 문구\n다시 연결해 주세요.';
      await multiline.locator('[data-open-catalog="errors"]').click();await multiline.locator('[name=catalog_value]').fill(errorText);
      await multiline.locator('#support-catalog-custom button[type=submit]').click();
      await multiline.locator('.support-catalog-message').filter({hasText:'확정 요청을 남겼습니다'}).waitFor();
      assert.equal(requests('knowledge-candidate')[0].body.value,errorText);assert.equal(fixture.candidates[0].value,errorText);
      await multiline.keyboard.press('Escape');
      const assertMultiline=async stage=>{
        assert.equal(await field(multiline,'error_code').inputValue(),errorText,`${stage}: error text must retain every newline`);
        const pending=multiline.locator('[data-pending-for="error_code"]');
        assert.equal(await pending.locator('[data-pending-status="pending"]').count(),1,`${stage}: selected candidate must remain visibly pending`);
        assert.equal(await pending.locator('strong').textContent(),errorText);
        assert.ok((await preview(multiline).textContent()).includes(errorText),`${stage}: preview must retain the original error text`);
      };
      await assertMultiline('after registration');
      await field(multiline,'symptom').fill('다른 입력란에서 보완한 민원 증상');await assertMultiline('after editing another field');
      await multiline.locator('[data-open-catalog="errors"]').click();
      assert.equal(await multiline.locator('#support-catalog-dialog .support-kb-pending-value').textContent(),errorText);
      await multiline.keyboard.press('Escape');await assertMultiline('after reopening the KB dialog');
      await multiline.reload();await multiline.locator('#support-intake > fieldset:not([disabled])').waitFor();
      await assertMultiline('after reload');assert.equal(await field(multiline,'symptom').inputValue(),'다른 입력란에서 보완한 민원 증상');
      await submit(multiline);await sent(multiline);
      assert.equal(requests('create')[0].body.error_code,errorText);assert.equal(fixture.tickets[0].incident.error_code,errorText);
    });
    await regression('A candidate 401 immediately exposes session recovery and preserves incident and custom draft while resetting the request id',async()=>{
      setup({candidateFailures:[401]});
      const incident={...emptyIncident(),symptom:'만료 전에 작성한 민원',occurred_at:'2026-09-22T10:30:00+09:00',error_code:'기존 오류 원문',app_context:'기존 앱 정보',device_context:'기존 장비 표시'};
      const expiredCandidate=await open(incident),incidentKeys=['symptom','occurred_at','error_code','app_context','device_context'];
      const originalInputs=Object.fromEntries(await Promise.all(incidentKeys.map(async key=>[key,await field(expiredCandidate,key).inputValue()])));
      const customValue='NEW-AFTER-EXPIRED-31';
      await expiredCandidate.locator('[data-open-catalog="errors"]').click();await expiredCandidate.locator('[name=catalog_value]').fill(customValue);
      await expiredCandidate.locator('#support-catalog-custom button[type=submit]').click();
      await expiredCandidate.waitForFunction(()=>document.body.textContent.includes('Fixture 401')&&!document.querySelector('[name=catalog_value]')?.disabled);
      assert.equal(await expiredCandidate.locator('#support-catalog-dialog[open]').count(),0,'candidate 401 must dismiss the dialog so global session recovery is reachable');
      const recovery=expiredCandidate.locator('[data-action="new-session"]');
      assert.equal(await recovery.isVisible(),true,'new-session recovery must appear without another navigation or submit');
      assert.match(await expiredCandidate.getByRole('alert').innerText(),/Fixture 401/);
      assert.equal(await expiredCandidate.getByText('작성 중인 내용은 화면에 유지됩니다. 새 체험에서는 이전 티켓에 접근할 수 없습니다.',{exact:true}).isVisible(),true);
      for(const key of incidentKeys)assert.equal(await field(expiredCandidate,key).inputValue(),originalInputs[key],`before renewal: preserve ${key}`);
      assert.equal(fixture.candidates.length,0);assert.equal(fixture.reviewRequests.length,0);
      const failedRequest=clone(requests('knowledge-candidate')[0].body);
      await recovery.click();await expiredCandidate.locator('#support-intake > fieldset:not([disabled])').waitFor();
      const renewedSession=requests('knowledge').at(-1).body.session_id;
      assert.notEqual(renewedSession,failedRequest.session_id);assert.equal(await recovery.count(),0);
      for(const key of incidentKeys)assert.equal(await field(expiredCandidate,key).inputValue(),originalInputs[key],`after renewal: preserve ${key}`);
      await expiredCandidate.locator('[data-open-catalog="errors"]').click();
      assert.equal(await expiredCandidate.locator('[name=catalog_value]').inputValue(),customValue,'renewal must retain the unsubmitted custom text');
      assert.equal(await expiredCandidate.locator('[data-pending-candidate]').count(),0);
      await expiredCandidate.locator('#support-catalog-custom button[type=submit]').click();
      await expiredCandidate.locator('.support-catalog-message').filter({hasText:'확정 요청을 남겼습니다'}).waitFor();
      const retriedRequest=requests('knowledge-candidate')[1].body;
      assert.equal(requests('knowledge-candidate').length,2);assert.equal(retriedRequest.session_id,renewedSession);
      assert.notEqual(retriedRequest.request_id,failedRequest.request_id,'a renewed session must not reuse the expired request id');
      assert.equal(retriedRequest.value,customValue);assert.equal(fixture.candidates.length,1);assert.equal(fixture.reviewRequests.length,1);
      assert.equal(fixture.candidateOwners[fixture.candidates[0].id],renewedSession);
      await expiredCandidate.keyboard.press('Escape');assert.equal(await field(expiredCandidate,'error_code').inputValue(),customValue);
      assert.equal(await field(expiredCandidate,'symptom').inputValue(),incident.symptom);
    });
    if(regressionFailures.length)throw new AggregateError(regressionFailures,'Input KB recovery regressions failed');

    setup();const search=await open(null,'search');
    await search.locator('[name=q]').fill('로컬 검증');await search.locator('#support-search button').first().click();await search.locator('[data-station="0"]').waitFor();
    await search.locator('[data-operator]').selectOption(JSON.stringify('Fixture B'));
    await search.waitForFunction(()=>document.querySelectorAll('[data-station]').length===1&&document.querySelector('.support-stations')?.textContent.includes('Fixture B'));
    assert.equal(requests('search').at(-1).body.operator,'Fixture B');
    await search.locator('[data-operator]').selectOption('');await search.waitForFunction(()=>document.querySelectorAll('[data-station]').length===2);
    await search.locator('[data-station="0"]').click();await search.locator('#support-charger-dialog[open] [data-charger]').first().waitFor();await search.keyboard.press('Escape');
    assert.equal(await search.locator('#support-charger-dialog[open]').count(),0);assert.equal(await search.locator('[data-station="0"]').evaluate(el=>el===document.activeElement),true);
    await search.locator('[data-station="0"]').click();await search.locator('[data-charger="fixture-row-01"]').click();await search.locator('#support-intake').waitFor();assert.equal(new URL(search.url()).hash,'#support-compose');
    cases.push('Operator filter/clear, charger modal Escape focus return and charger-to-composer navigation');

    setup();const page=await open({...emptyIncident(),symptom:'고객이 말한 기존 증상',app_context:'기존 앱 메모',device_context:'기존 장비 메모'});
    assert.equal(await field(page,'occurred_at').getAttribute('type'),'datetime-local');assert.equal(await field(page,'occurred_at').inputValue(),'');
    await field(page,'occurred_at').fill('2026-09-22T10:30');assert.match(await preview(page).innerText(),/10:30/);
    await field(page,'error_code').fill('목록 밖 실제 표시');assert.match(await preview(page).innerText(),/목록 밖 실제 표시/);
    await page.locator('[data-open-catalog="errors"]').click();await page.locator('#support-catalog-dialog[open]').waitFor();
    assert.match(await page.locator('#support-catalog-dialog').innerText(),/FIXTURE-ERROR-77/);assert.match(await page.locator('#support-catalog-dialog').innerText(),/합성 오류 문구 <표시>/);
    assert.match(await page.locator('#support-catalog-dialog').innerText(),/로컬 fixture 설명/);assert.equal(await page.locator('#support-catalog-dialog 표시').count(),0);
    await page.keyboard.press('Escape');assert.equal(await field(page,'error_code').inputValue(),'목록 밖 실제 표시');assert.equal(await page.locator('[data-open-catalog="errors"]').evaluate(el=>el===document.activeElement),true);
    await choose(page,'errors');assert.equal(await field(page,'error_code').inputValue(),'FIXTURE-ERROR-77');assert.match(await preview(page).innerText(),/FIXTURE-ERROR-77/);
    await choose(page,'symptoms');assert.match(await field(page,'symptom').inputValue(),/FIXTURE 충전 진행 멈춤/);assert.match(await field(page,'symptom').inputValue(),/고객이 말한 기존 증상/);
    await choose(page,'app_os');assert.equal(await page.locator('#support-catalog-dialog[open]').count(),1);
    await page.locator('[data-catalog-tab="app_versions"]').click();await page.locator('[data-catalog-choice="0"]').click();
    await page.locator('[data-catalog-tab="app_actions"]').click();await page.locator('[data-catalog-choice="0"]').click();
    assert.match(await preview(page).innerText(),/FixtureOS/);assert.match(await preview(page).innerText(),/DEMO Fixture 7\.7/);assert.match(await preview(page).innerText(),/FIXTURE 시작 요청 실패/);assert.match(await field(page,'app_context').inputValue(),/기존 앱 메모/);
    await page.locator('[data-close-catalog]').last().click();assert.equal(await page.locator('[data-open-catalog="app_os"]').evaluate(el=>el===document.activeElement),true);
    await choose(page,'device_states');assert.match(await preview(page).innerText(),/FIXTURE 화면 확인 중/);assert.match(await field(page,'device_context').inputValue(),/기존 장비 메모/);
    const saved=Object.fromEntries(await Promise.all(['symptom','occurred_at','error_code','app_context','device_context'].map(async key=>[key,await field(page,key).inputValue()])));
    await page.locator('[name=recipient][value=device]').uncheck();assert.equal(await field(page,'device_context').isVisible(),false);await page.locator('[name=recipient][value=device]').check();assert.equal(await field(page,'device_context').inputValue(),saved.device_context);
    await page.locator('#support-ticket-preview>summary').click();await page.locator('.support-compose-layout.is-preview-collapsed').waitFor();await page.reload();await field(page,'symptom').waitFor();
    for(const [key,value] of Object.entries(saved))assert.equal(await field(page,key).inputValue(),value,`${key} survives same-tab reload`);
    assert.equal(await page.locator('#support-ticket-preview').getAttribute('open'),null);await page.locator('#support-ticket-preview>summary').click();
    assert.match(await preview(page).innerText(),/INTAKE-001/);
    await screenshot(page,'desktop-compose');await page.locator('[data-open-catalog="errors"]').click();await screenshot(page,'desktop-catalog');await page.keyboard.press('Escape');
    await page.setViewportSize({width:390,height:844});await page.locator('[data-open-catalog="errors"]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile page fits viewport');
    assert.equal(await page.locator('#support-catalog-dialog').evaluate(el=>el.getBoundingClientRect().left>=0&&el.getBoundingClientRect().right<=innerWidth),true,'mobile modal fits viewport');
    await screenshot(page,'mobile-catalog');
    await page.keyboard.press('Escape');await page.setViewportSize({width:1360,height:950});
    cases.push('API catalog values/descriptions escape markup; singular/app selections update preview; keyboard close and draft inputs survive reload and recipient visibility changes','Korean wall time stays 10:30 in America/Los_Angeles browser; empty time stays unknown; mobile modal fits viewport');

    fixture.createFailures=[500];await submit(page);await page.getByRole('alert').filter({hasText:'Fixture 500'}).waitFor();
    assert.equal(requests('prepare').length,1);assert.equal(requests('create').length,1);const firstCreate=requests('create')[0].body;
    await submit(page);await sent(page);assert.equal(requests('prepare').length,1);assert.equal(requests('create')[1].body.request_id,firstCreate.request_id);assert.equal(fixture.tickets.length,1);
    assert.equal(fixture.tickets[0].incident.occurred_at,'2026-09-22T10:30:00+09:00');assert.equal(fixture.tickets[0].knowledge.some(d=>d.id==='INTAKE-001'),true);
    cases.push('Matching KB snapshot sends once; transient create failure retries the identical request id and preview without duplicate ticket');

    setup({changeOnPrepare:true});const changed=await open({...emptyIncident(),symptom:'KB 갱신 시 입력 보존',error_code:'고객 원문'});
    await submit(changed);await changed.getByRole('alert').filter({hasText:'KB가 갱신되었습니다'}).waitFor();assert.equal(requests('create').length,0);assert.equal(await field(changed,'symptom').inputValue(),'KB 갱신 시 입력 보존');
    assert.match(await preview(changed).innerText(),/INTAKE-001 · v2/);await submit(changed);await sent(changed);assert.equal(fixture.tickets[0].knowledge.find(d=>d.id==='INTAKE-001').version,2);
    cases.push('KB update at prepare requires renewed preview confirmation before creating the ticket');

    setup({createFailures:[409]});const conflict=await open({...emptyIncident(),symptom:'409 충돌 후 근거 재확인',error_code:'실제 원문'});
    await submit(conflict);await conflict.getByRole('alert').filter({hasText:'Fixture 409'}).waitFor();await submit(conflict);
    await conflict.getByRole('alert').filter({hasText:'KB가 갱신되었습니다'}).waitFor();assert.equal(requests('prepare').length,2);assert.equal(requests('create').length,1);
    await submit(conflict);await sent(conflict);assert.equal(fixture.tickets.length,1);assert.notEqual(requests('create')[0].body.request_id,requests('create')[1].body.request_id);
    cases.push('409 invalidates stale prepare and request id, fetches latest KB, then requires preview confirmation');

    setup();const legacy=await open({...emptyIncident(),symptom:'기존 발생 시각',occurred_at:'어제 저녁 8시쯤'});
    assert.equal(await field(legacy,'occurred_at').inputValue(),'');assert.match(await preview(legacy).innerText(),/어제 저녁 8시쯤/);
    await legacy.reload();await legacy.locator('[data-clear-occurred]').waitFor();assert.match(await preview(legacy).innerText(),/어제 저녁 8시쯤/);
    await legacy.locator('[data-clear-occurred]').click();assert.doesNotMatch(await preview(legacy).innerText(),/어제 저녁 8시쯤/);
    await field(legacy,'occurred_at').fill('2026-09-22T10:30');assert.match(await preview(legacy).innerText(),/2026-09-22 10:30 \(한국 시간\)/);
    cases.push('Legacy free-text time remains visible after reload and changes only through explicit clearing or new date/time selection');

    setup();const preciseTime='2026-09-22T10:30:45+09:00';const precise=await open({...emptyIncident(),symptom:'복원된 상세 발생 시각',occurred_at:preciseTime});
    assert.equal(await field(precise,'occurred_at').inputValue(),'2026-09-22T10:30');assert.match(await preview(precise).innerText(),/10:30:45/);
    await field(precise,'symptom').fill('발생 시각은 그대로 둔 증상 보완');await precise.locator('[data-open-catalog="errors"]').click();await precise.keyboard.press('Escape');await submit(precise);await sent(precise);
    assert.equal(requests('prepare')[0].body.occurred_at,preciseTime);assert.equal(requests('create')[0].body.occurred_at,preciseTime);assert.equal(fixture.tickets[0].incident.occurred_at,preciseTime);
    cases.push('Restored ISO seconds stay visible and exact in ticket payload when editing another field or opening a catalog');

    setup();const custom=await open({...emptyIncident(),symptom:'직접 확인한 목록 밖 값',app_context:'수기 앱 정보 보존'});
    await custom.locator('[data-open-catalog="errors"]').click();await custom.locator('[name=catalog_value]').fill('CUSTOM-ACTUAL-77');
    await custom.locator('[data-use-custom]').click();assert.equal(requests('knowledge-candidate').length,0);assert.equal(fixture.reviewRequests.length,0);assert.equal(await field(custom,'error_code').inputValue(),'CUSTOM-ACTUAL-77');
    await custom.locator('[data-open-catalog="errors"]').click();await custom.locator('[name=catalog_value]').fill('CUSTOM-KB-88');await custom.locator('#support-catalog-custom button[type=submit]').click();
    await custom.waitForFunction(()=>document.querySelector('#support-intake [name=error_code]')?.value==='CUSTOM-KB-88');
    assert.equal(requests('knowledge-candidate').length,1);assert.equal(requests('knowledge-candidate')[0].body.kb_id,'INTAKE-001');assert.equal(requests('knowledge-candidate')[0].body.field,'errors');assert.equal(requests('knowledge-candidate')[0].body.value,'CUSTOM-KB-88');assert.ok(requests('knowledge-candidate')[0].body.request_id);
    assert.equal(await custom.locator('#support-catalog-dialog[open]').count(),1);assert.match(await custom.locator('.support-catalog-message').innerText(),/확정 요청을 남겼습니다/);assert.equal(await custom.locator('[data-pending-for="error_code"] .support-review-receipt').count(),1);assert.equal(fixture.reviewRequests.length,1);
    if(await custom.locator('#support-catalog-dialog[open]').count())await custom.keyboard.press('Escape');
    await custom.locator('[data-open-catalog="errors"]').click();assert.match(await custom.locator('#support-catalog-dialog').innerText(),/CUSTOM-KB-88/);assert.match(await custom.locator('#support-catalog-dialog').innerText(),/확정 전/);
    const pendingStyle=await custom.locator('#support-catalog-dialog').evaluate(dialog=>{const el=[...dialog.querySelectorAll('*')].find(e=>e.textContent.includes('CUSTOM-KB-88')&&getComputedStyle(e).borderTopStyle==='dashed');return el?{border:getComputedStyle(el).borderTopStyle,background:getComputedStyle(el).backgroundColor}:null;});
    assert.ok(pendingStyle,'pending candidate has a dashed border');assert.notEqual(pendingStyle.background,'rgba(0, 0, 0, 0)');
    const [red,green,blue]=pendingStyle.background.match(/[\d.]+/g).map(Number);assert.ok(red>green&&green>blue&&blue>180,'pending candidate has a pale orange background');
    await custom.locator('.support-kb-pending-card').last().scrollIntoViewIfNeeded();await screenshot(custom,'pending-catalog');
    await custom.keyboard.press('Escape');await choose(custom,'app_os');await custom.locator('[data-catalog-choice="1"]').click();
    assert.equal(await field(custom,'app_context').inputValue(),'수기 앱 정보 보존');await custom.keyboard.press('Escape');
    await custom.reload();await custom.locator('[data-open-catalog="errors"]').click();assert.match(await custom.locator('#support-catalog-dialog').innerText(),/CUSTOM-KB-88/);assert.match(await custom.locator('#support-catalog-dialog').innerText(),/확정 전/);
    assert.deepEqual(fixture.documents.find(d=>d.id==='INTAKE-001').catalogs.errors.map(o=>o.id),['fixture-error','unknown','other']);
    cases.push('Direct value can stay in one ticket or register a pending KB candidate; candidate stays separate from immutable catalogs and survives reload with dashed box','Unknown app option removes its tracked contribution while preserving existing free text');

    setup({candidateFailures:[500]});const retryCandidate=await open({...emptyIncident(),symptom:'후보 등록 재시도'});
    await retryCandidate.locator('[data-open-catalog="errors"]').click();await retryCandidate.locator('[name=catalog_value]').fill('CUSTOM-RETRY-99');await retryCandidate.locator('#support-catalog-custom button[type=submit]').click();
    await retryCandidate.locator('.support-catalog-message').filter({hasText:'Fixture 500'}).waitFor();assert.equal(await retryCandidate.locator('[name=catalog_value]').inputValue(),'CUSTOM-RETRY-99');
    await retryCandidate.locator('#support-catalog-custom button[type=submit]').click();await retryCandidate.waitForFunction(()=>document.querySelector('#support-intake [name=error_code]')?.value==='CUSTOM-RETRY-99');
    assert.equal(requests('knowledge-candidate').length,2);assert.equal(requests('knowledge-candidate')[0].body.request_id,requests('knowledge-candidate')[1].body.request_id);assert.equal(fixture.candidates.length,1);
    cases.push('Candidate registration failure preserves direct value and reuses its idempotency key on retry');

    setup({candidateFailures:[409]});const candidateConflict=await open({...emptyIncident(),symptom:'후보 등록 시 KB 갱신'});
    await candidateConflict.locator('[data-open-catalog="errors"]').click();await candidateConflict.locator('[name=catalog_value]').fill('CUSTOM-UPDATED-11');await candidateConflict.locator('#support-catalog-custom button[type=submit]').click();
    await candidateConflict.locator('.support-catalog-message').filter({hasText:'Fixture 409'}).waitFor();assert.equal(await candidateConflict.locator('[name=catalog_value]').inputValue(),'CUSTOM-UPDATED-11');
    await candidateConflict.locator('#support-catalog-custom button[type=submit]').click();await candidateConflict.waitForFunction(()=>document.querySelector('#support-intake [name=error_code]')?.value==='CUSTOM-UPDATED-11');
    assert.equal(requests('knowledge-candidate').length,2);assert.equal(requests('knowledge-candidate')[0].body.kb_version,1);assert.equal(requests('knowledge-candidate')[1].body.kb_version,2);assert.notEqual(requests('knowledge-candidate')[0].body.request_id,requests('knowledge-candidate')[1].body.request_id);assert.equal(fixture.candidates.length,1);assert.equal(fixture.candidates[0].kb_version,2);
    cases.push('Candidate 409 refreshes the KB version, preserves the value and retries with a new idempotency key');

    setup();const longContext='수'.repeat(695);const maxLength=await open({...emptyIncident(),symptom:'작성 한도 보존',app_context:longContext});
    await choose(maxLength,'app_os');assert.equal(await maxLength.locator('#support-catalog-dialog[open]').count(),1);assert.equal(await field(maxLength,'app_context').inputValue(),longContext);assert.match(await maxLength.locator('.support-catalog-message').innerText(),/700/);await maxLength.keyboard.press('Escape');
    cases.push('Catalog selection exceeding the combined input limit preserves all existing text and keeps the choice dialog open');

    setup({holdCandidate:true});const delayed=await open({...emptyIncident(),symptom:'늦은 후보 응답',error_code:'닫기 전 오류 원문'});
    await delayed.locator('[data-open-catalog="errors"]').click();await delayed.locator('[name=catalog_value]').fill('CUSTOM-LATE-10');await delayed.locator('#support-catalog-custom button[type=submit]').click();
    await delayed.locator('[name=catalog_value]:disabled').waitFor();await delayed.keyboard.press('Escape');await field(delayed,'error_code').fill('닫은 뒤 고객이 정정한 원문');
    assert.equal(typeof fixture.releaseCandidate,'function');fixture.releaseCandidate();
    await delayed.locator('[data-open-catalog="errors"]').click();await delayed.locator('[data-pending-candidate]').waitFor();
    assert.equal(await field(delayed,'error_code').inputValue(),'닫은 뒤 고객이 정정한 원문');assert.equal(fixture.candidates[0].value,'CUSTOM-LATE-10');
    cases.push('Closing a modal during registration keeps the pending candidate but a late response cannot overwrite subsequent ticket edits');

    setup({createFailures:[500],holdCandidate:true});const candidateOnly=await open({...emptyIncident(),symptom:'후보만 등록한 뒤 같은 티켓 재시도',error_code:'변경 없는 고객 오류 원문'});
    await submit(candidateOnly);await candidateOnly.getByRole('alert').filter({hasText:'Fixture 500'}).waitFor();
    const retainedCreate=clone(requests('create')[0].body);assert.equal(requests('prepare').length,1);
    const candidateHeld=new Promise(resolve=>{fixture.onCandidateHeld=resolve;});
    await candidateOnly.locator('[data-open-catalog="errors"]').click();await candidateOnly.locator('[name=catalog_value]').fill('CANDIDATE-ONLY-12');await candidateOnly.locator('#support-catalog-custom button[type=submit]').click();await candidateHeld;
    await candidateOnly.keyboard.press('Escape');fixture.releaseCandidate();
    await candidateOnly.locator('[data-open-catalog="errors"]').click();await candidateOnly.locator('[data-pending-candidate]').waitFor();await candidateOnly.keyboard.press('Escape');
    assert.equal(fixture.candidates.length,1);assert.equal(fixture.candidates[0].value,'CANDIDATE-ONLY-12');assert.equal(await field(candidateOnly,'error_code').inputValue(),retainedCreate.error_code);
    assert.doesNotMatch(await preview(candidateOnly).innerText(),/CANDIDATE-ONLY-12/);await submit(candidateOnly);await sent(candidateOnly);
    assert.equal(requests('prepare').length,1,'candidate-only registration must retain the prepared ticket snapshot');assert.equal(requests('create').length,2);assert.deepEqual(requests('create')[1].body,retainedCreate,'retry retains the original incident, preview hash and request id');assert.equal(fixture.tickets.length,1);
    cases.push('Registering a candidate after closing its modal preserves an unchanged ticket prepare snapshot and exact idempotent create retry');

    setup({createFailures:[401],holdCandidate:true});const renewed=await open({...emptyIncident(),symptom:'새 체험으로 이전 응답 격리',error_code:'고객 원문 유지'});
    const oldCandidateHeld=new Promise(resolve=>{fixture.onCandidateHeld=resolve;});
    await renewed.locator('[data-open-catalog="errors"]').click();await renewed.locator('[name=catalog_value]').fill('OLD-SESSION-CANDIDATE-13');await renewed.locator('#support-catalog-custom button[type=submit]').click();await oldCandidateHeld;await renewed.keyboard.press('Escape');
    await submit(renewed);await renewed.getByRole('alert').filter({hasText:'Fixture 401'}).waitFor();await renewed.locator('[data-action="new-session"]').click();await renewed.locator('#support-intake > fieldset:not([disabled])').waitFor();
    const oldSession=requests('knowledge-candidate')[0].body.session_id,newSession=requests('knowledge').at(-1).body.session_id;assert.notEqual(newSession,oldSession);
    await renewed.locator('[data-open-catalog="errors"]').click();assert.equal(await renewed.locator('[name=catalog_value]').isEnabled(),true);assert.equal(await renewed.locator('[data-pending-candidate]').count(),0);
    const oldResponse=renewed.waitForResponse(r=>r.url().endsWith('/knowledge-candidate'));fixture.releaseCandidate();await (await oldResponse).finished();await renewed.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(fixture.candidates.length,1);assert.equal(fixture.candidateOwners[fixture.candidates[0].id],oldSession);assert.equal(await renewed.locator('[data-pending-candidate]').count(),0);assert.doesNotMatch(await renewed.locator('#support-catalog-dialog').innerText(),/OLD-SESSION-CANDIDATE-13/);assert.equal(await field(renewed,'error_code').inputValue(),'고객 원문 유지');
    fixture.holdCandidate=false;await renewed.locator('[name=catalog_value]').fill('NEW-SESSION-CANDIDATE-14');await renewed.locator('#support-catalog-custom button[type=submit]').click();await renewed.waitForFunction(()=>document.querySelector('#support-intake [name=error_code]')?.value==='NEW-SESSION-CANDIDATE-14');
    assert.equal(requests('knowledge-candidate')[1].body.session_id,newSession);await renewed.reload();await renewed.locator('[data-open-catalog="errors"]').click();assert.equal(await renewed.locator('[data-pending-candidate]').count(),1);assert.match(await renewed.locator('#support-catalog-dialog').innerText(),/NEW-SESSION-CANDIDATE-14/);assert.doesNotMatch(await renewed.locator('#support-catalog-dialog').innerText(),/OLD-SESSION-CANDIDATE-13/);
    cases.push('A candidate response from an expired session cannot populate the renewed session; its candidate controls reset and new candidates remain session-scoped');

    setup();const handwritten=await open({...emptyIncident(),symptom:'수기 오류 미확인 처리',error_code:'수기로 확인한 실제 오류'});
    await choose(handwritten,'errors',1);assert.equal(await field(handwritten,'error_code').inputValue(),'수기로 확인한 실제 오류');
    cases.push('Unknown error option preserves untracked handwritten error text');

    const versionDocs=documents();versionDocs.find(d=>d.id==='INTAKE-001').version=2;
    const candidateBase={status:'pending',status_label:'확정 전',field:'errors',kb_id:'INTAKE-001',source:{kind:'manual_input'},created_at:'2026-09-22T01:30:00Z'};
    setup({documents:versionDocs,candidates:[{...candidateBase,id:'old-candidate',kb_version:1,value:'OLD-VERSION-CANDIDATE'},{...candidateBase,id:'confirmed-candidate',status:'confirmed',kb_version:2,value:'CONFIRMED-CANDIDATE'},{...candidateBase,id:'current-candidate',kb_version:2,value:'CURRENT-VERSION-CANDIDATE'}]});
    const versions=await open({...emptyIncident(),symptom:'후보 버전과 상태 경계'});await versions.locator('[data-open-catalog="errors"]').click();
    assert.equal(await versions.locator('#support-catalog-dialog [data-pending-candidate="current-candidate"]').count(),1);assert.equal(await versions.locator('#support-catalog-dialog [data-pending-candidate="old-candidate"]').count(),0);assert.equal(await versions.locator('#support-catalog-dialog [data-pending-id="confirmed-candidate"]').count(),0);
    await versions.keyboard.press('Escape');await versions.goto(base+'/#support-kb');await versions.locator('[data-pending-id="old-candidate"]').waitFor();
    assert.equal(await versions.locator('[data-pending-id="confirmed-candidate"]').count(),0);assert.equal(await versions.locator('[data-pending-candidate]').count(),0);
    cases.push('Shared pending renderer selects only current-version pending candidates while KB view preserves older pending history and omits nonpending records');

    const orderedCandidates=Object.keys(catalogFields).flatMap(key=>[
      {...candidateBase,id:`${key}-older`,field:key,kb_version:1,value:`OLDER-${key}`,created_at:'2026-09-22T00:00:00Z'},
      {...candidateBase,id:`${key}-newer`,field:key,kb_version:1,value:`NEWER-${key}`,created_at:'2026-09-22T01:00:00Z'}
    ]);
    setup({candidates:orderedCandidates});const ordered=await open({...emptyIncident(),symptom:'KB 목록 순서 확인',app_context:'기존 앱 메모',device_context:'기존 장비 메모'});
    for(const launcher of await ordered.locator('[data-open-catalog]').all())assert.match(await launcher.innerText(),/민원 KB 목록/);
    const openOrderedCatalog=async key=>{const direct=ordered.locator(`[data-open-catalog="${key}"]`);if(await direct.count())await direct.click();else{await ordered.locator('[data-open-catalog="app_os"]').click();await ordered.locator(`[data-catalog-tab="${key}"]`).click();}await ordered.locator('#support-catalog-dialog[open]').waitFor();};
    for(const key of Object.keys(catalogFields)) {
      await openOrderedCatalog(key);
      const modalOrder=await ordered.locator('#support-catalog-dialog').evaluate(dialog=>{const form=dialog.querySelector('#support-catalog-custom'),pending=dialog.querySelector('.support-catalog-pending'),choices=dialog.querySelector('.support-catalog-options');return {dom:!!(form.compareDocumentPosition(pending)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(pending.compareDocumentPosition(choices)&Node.DOCUMENT_POSITION_FOLLOWING),visual:form.getBoundingClientRect().top<pending.getBoundingClientRect().top&&pending.getBoundingClientRect().top<choices.getBoundingClientRect().top};});
      assert.deepEqual(modalOrder,{dom:true,visual:true},`${key}: add form, pending candidates, source choices`);
      assert.deepEqual(await ordered.locator('#support-catalog-dialog [data-pending-candidate]').evaluateAll(items=>items.map(el=>el.dataset.pendingCandidate)),[`${key}-newer`,`${key}-older`],`${key}: newest pending item first despite oldest-first API array`);
      if(key==='app_versions')await screenshot(ordered,'app-catalog');
      const addedValue=`NEW-FIRST-${key}`;await ordered.locator('[name=catalog_value]').fill(addedValue);await ordered.locator('#support-catalog-custom button[type=submit]').click();
      await ordered.waitForFunction(({field,value})=>document.querySelector(`#support-intake [name="${field}"]`)?.value.includes(value),{field:catalogFields[key],value:addedValue});
      const addedCandidate=fixture.candidates.at(-1);assert.equal(addedCandidate.field,key);assert.equal(addedCandidate.value,addedValue);
      if(await ordered.locator('#support-catalog-dialog[open]').count())await ordered.keyboard.press('Escape');await openOrderedCatalog(key);
      assert.deepEqual(await ordered.locator('#support-catalog-dialog [data-pending-candidate]').evaluateAll(items=>items.map(el=>el.dataset.pendingCandidate)),[addedCandidate.id,`${key}-newer`,`${key}-older`],`${key}: newly registered candidate appears at top`);
      await ordered.locator('[data-catalog-choice="0"]').click();const sourceValue=fixture.documents.find(d=>d.id==='INTAKE-001').catalogs[key][0].value;assert.ok((await field(ordered,catalogFields[key]).inputValue()).includes(sourceValue),`${key}: existing source option still applies`);
      if(await ordered.locator('#support-catalog-dialog[open]').count())await ordered.keyboard.press('Escape');
    }
    assert.equal(requests('knowledge-candidate').length,6);assert.match(await field(ordered,'app_context').inputValue(),/기존 앱 메모/);assert.match(await field(ordered,'device_context').inputValue(),/기존 장비 메모/);
    cases.push('All six KB catalogs put the add form before newest-first pending candidates and source options; newly added values appear first while existing choices and notes still work');

    setup();const reviewPage=await open({...emptyIncident(),symptom:'관리자 확정 요청 읽음 확인'});const unchangedKnowledge=clone(fixture.documents);
    await reviewPage.locator('[data-open-catalog="errors"]').click();await reviewPage.locator('[name=catalog_value]').fill('REVIEW-INBOX-21');await reviewPage.locator('#support-catalog-custom button[type=submit]').click();await reviewPage.waitForFunction(()=>document.querySelector('#support-intake [name=error_code]')?.value==='REVIEW-INBOX-21');
    assert.match(await reviewPage.locator('.support-catalog-message').innerText(),/확정 요청을 남겼습니다/);const reviewId=fixture.reviewRequests[0].id;await reviewPage.keyboard.press('Escape');
    await reviewPage.goto(base+'/#support-kb-admin');await reviewPage.locator(`[data-review-request="${reviewId}"]`).waitFor();assert.equal(requests('knowledge-review-requests').at(-1).body.role,'kb_admin');
    assert.match(await reviewPage.locator('.support-review-inbox').innerText(),/안 읽음 1건/);assert.match(await reviewPage.locator(`[data-review-request="${reviewId}"]`).innerText(),/REVIEW-INBOX-21/);await screenshot(reviewPage,'admin-unread');
    await reviewPage.locator(`[data-review-read="${reviewId}"]`).click();await reviewPage.locator(`[data-review-request="${reviewId}"]`).getByText('관리자가 읽음 · 확정 전',{exact:true}).waitFor();
    assert.equal(requests('knowledge-review-read').length,1);assert.equal(requests('knowledge-review-read')[0].body.review_request_id,reviewId);assert.equal(requests('knowledge-review-read')[0].body.role,'kb_admin');assert.match(await reviewPage.locator('.support-review-inbox').innerText(),/안 읽음 0건/);assert.equal(fixture.reviewRequests[0].status,'requested');assert.equal(fixture.candidates[0].status,'pending');assert.deepEqual(fixture.documents,unchangedKnowledge);await screenshot(reviewPage,'admin-read');
    await reviewPage.reload();await reviewPage.locator(`[data-review-request="${reviewId}"]`).getByText('관리자가 읽음 · 확정 전',{exact:true}).waitFor();assert.equal(await reviewPage.locator('[data-review-read]').count(),0);

    setup({omitReviewReceipt:true});const unconfirmedReceipt=await open({...emptyIncident(),symptom:'서버 영수증 없는 요청 상태'});
    await unconfirmedReceipt.locator('[data-open-catalog="errors"]').click();await unconfirmedReceipt.locator('[name=catalog_value]').fill('RECEIPT-UNCONFIRMED-22');await unconfirmedReceipt.locator('#support-catalog-custom button[type=submit]').click();await unconfirmedReceipt.waitForFunction(()=>document.querySelector('#support-intake [name=error_code]')?.value==='RECEIPT-UNCONFIRMED-22');
    assert.match(await unconfirmedReceipt.locator('.support-catalog-message').innerText(),/확정 요청 상태는 아직 확인되지 않았습니다/);assert.doesNotMatch(await unconfirmedReceipt.locator('.support-catalog-message').innerText(),/확정 요청을 남겼습니다/);assert.equal(await unconfirmedReceipt.locator('.support-review-receipt').count(),0);
    cases.push('In-app admin inbox persists read status without approving candidates; candidate registration claims notification only with a matching server receipt, while ticket-only input creates no request');
    assert.deepEqual(browserErrors,[]);assert.deepEqual(externalRequests,[]);
    console.log(JSON.stringify({passed:true,scope:'Isolated synthetic support API/browser regression, not live API or company data validation',cases,browserErrors,externalRequests},null,2));
  } finally {fixture.releaseCandidate?.();for(const context of contexts)await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
