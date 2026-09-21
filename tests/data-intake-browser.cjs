// Local fixture integration only: no external source download, paid generation, or organization API.
// Run with Playwright available in NODE_PATH. The fixture returns server-confirmed bytes/rows.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const evidenceDir = process.env.DATA_INTAKE_EVIDENCE_DIR || path.join(root, 'tests/evidence/data-intake');
const cases = [];
let fixture;
const schema = [{name:'id',type:'integer'},{name:'충전소명',type:'string'},{name:'주소',type:'string'},{name:'연락처',type:'string'}];
const original = Buffer.from('id,충전소명,주소,연락처\n1,GS타워,서울 강남구 논현로,010-0000-0000\n');
const source = {original_url:'https://ev.or.kr/nportal/monitor/evMapExcel.do',resolved_url:'https://ev.or.kr/nportal/monitor/evMapExcel.do',fetched_at:'2026-09-21T04:20:00Z',source_bytes:4096,source_sha256:'a'.repeat(64)};
const rows = Array.from({length:120},(_,index)=>({id:index+1,충전소명:index===0?'GS타워':`충전소 ${index+1}`,주소:index<60?'서울 강남구 논현로':'서울 송파구 올림픽로',연락처:'010-0000-0000'}));
function setup(mode='file') {fixture={mode,requests:[],jobs:{},datasets:[],discoveryReady:false,ingestReady:false,transformReady:false,sessionCount:0,serial:0,uploaded:null};}
function dataset(id='raw-fixture') {return {id,name:id==='clean-fixture'?'충전기 목록 · 처리 결과':'환경부 충전기 목록 (로컬 fixture)',kind:id==='clean-fixture'?'transform':'ingest',layer:id==='clean-fixture'?'conformed':'raw',row_count:120,schema,original_file:'fixture-chargers.csv',source_sha256:source.source_sha256,created_at:source.fetched_at,metadata:{source},source,partition_count:2,logical_key:'fixture-chargers',version:1};}
function job(kind) {const j={id:`${kind}-${++fixture.serial}`,kind,state:'running',stage:kind==='source'?'download':'parse',processed_bytes:2048,total_bytes:null,processed_rows:0,total_rows:null,created_at:source.fetched_at};fixture.jobs[j.id]=j;return j;}
function respond(res,value,status=200) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
function jobResponse(j) {
  if(j.state==='cancelled')return j;
  if(j.kind==='source'&&fixture.discoveryReady){
    if(fixture.mode==='failed-job'){Object.assign(j,{state:'failed',error:'원본 서버가 다운로드를 거부했습니다. (fixture)',stage:'download'});return j;}
    const html=['html','empty-html'].includes(fixture.mode);
    Object.assign(j,{state:'succeeded',stage:'complete',processed_bytes:4096,result:{source_id:'source-fixture',format:html?'html':'csv',source,tables:html&&fixture.mode!=='empty-html'?[{index:0,caption:'충전기 목록',columns:schema.map(c=>c.name),preview:rows.slice(0,2),estimated_rows:120},{index:1,caption:'안내 표',columns:['항목','내용'],preview:[{항목:'공개',내용:'안내 문구'}],estimated_rows:1}]:[]}});
  }
  if(j.kind==='ingest'&&fixture.ingestReady){const d=dataset();fixture.datasets=[d];Object.assign(j,{state:'succeeded',stage:'completed',processed_bytes:4096,processed_rows:120,total_rows:120,dataset_id:d.id,result:{dataset_id:d.id}});}
  if(j.kind==='transform'&&fixture.transformReady){const d=dataset('clean-fixture');fixture.datasets.push(d);Object.assign(j,{state:'succeeded',stage:'completed',processed_rows:120,total_rows:120,dataset_id:d.id,result:{dataset_id:d.id}});}
  return j;
}
function preview(id,offset=0,limit=50,search='') {let items=rows;if(id==='clean-fixture')items=rows.map(r=>({...r,연락처:'***'}));if(search)items=items.filter(r=>Object.values(r).some(v=>String(v).includes(search)));return {dataset:dataset(id),schema,rows:items.slice(offset,offset+limit),total:items.length,offset,limit};}
async function serve(req,res) {
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/data-platform/')){
    const chunks=[];for await(const part of req)chunks.push(part);const raw=Buffer.concat(chunks);let body=null;
    if(raw.length&&req.headers['content-type']?.includes('json'))body=JSON.parse(raw.toString());
    fixture.requests.push({method:req.method,path:url.pathname,query:Object.fromEntries(url.searchParams),authorization:req.headers.authorization||null,body,bytes:raw.length});
    const route=url.pathname.replace('/data-platform','');
    if(route==='/capabilities')return respond(res,{features:{conditional_query:true,physical_partitioning:true,logical_versions:true},limits:{demo_max_rows:10000}});
    if(route==='/visitor/sessions')return respond(res,{access_token:`fixture-session-${++fixture.sessionCount}`,token_type:'Bearer',expires_at:'2026-09-22T04:20:00Z',expires_in:86400});
    if(route.startsWith('/visitor/')&&!/^Bearer fixture-session-\d+$/.test(req.headers.authorization||''))return respond(res,{error:'방문자 인증 누락 (fixture)'},401);
    if(route==='/visitor/sources'){
      if(fixture.mode==='http-error')return respond(res,{error:'공개 주소에서 원본을 읽지 못했습니다. (fixture)'},422);
      source.original_url=body.url;source.resolved_url=body.url;return respond(res,job('source'),202);
    }
    if(route==='/visitor/sources/source-fixture/ingest')return respond(res,job('ingest'),202);
    if(route==='/visitor/uploads'){fixture.uploaded=raw;return respond(res,job('ingest'),202);}
    if(/^\/(visitor|demo)\/jobs$/.test(route)&&req.method==='GET')return respond(res,{jobs:Object.values(fixture.jobs)});
    if(/^\/(visitor|demo)\/datasets$/.test(route))return respond(res,{datasets:route.startsWith('/demo/')?[]:fixture.datasets});
    const match=route.match(/^\/visitor\/jobs\/([^/]+)(\/cancel)?$/);
    if(match){const j=fixture.jobs[match[1]];if(match[2])Object.assign(j,{state:'cancelled'});return respond(res,jobResponse(j));}
    const data=route.match(/^\/visitor\/datasets\/([^/]+)\/(preview|query|original|export|quality|lineage|partitions|transform)$/);
    if(data){const [,id,action]=data;
      if(action==='preview'||action==='query')return respond(res,preview(id,Number(body?.offset??url.searchParams.get('offset')??0),Number(body?.limit??url.searchParams.get('limit')??50),body?.search||''));
      if(action==='original'||action==='export'){res.writeHead(200,{'Content-Type':'text/csv','Content-Disposition':'attachment; filename=fixture.csv'});return res.end(original);}
      if(action==='partitions')return respond(res,{partition_count:2,partition_rows:60,parts:[{row_start:1,row_end:60,row_count:60,bytes:2048},{row_start:61,row_end:120,row_count:60,bytes:2048}]});
      if(action==='quality')return respond(res,{schema,rows:[],total:0});
      if(action==='lineage')return respond(res,{nodes:[dataset()]});
      if(action==='transform')return respond(res,job('transform'),202);
    }
    if(route.includes('/logical-datasets/')){
      if(route.endsWith('/versions'))return respond(res,{versions:[dataset()],total:1});
      if(route.endsWith('/latest'))return respond(res,dataset());
      if(route.endsWith('/partition-settings'))return respond(res,{partition_rows:6000,version:1});
    }
    return respond(res,{error:`Unexpected fixture route ${req.method} ${route}`},404);
  }
  if(['/style.css','/data-platform.css','/data-review-ui.js','/data-explorer.js','/data-platform.js'].includes(url.pathname)){
    res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(root,'src',url.pathname.slice(1))));return;
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>자료 입수 UI · 로컬 fixture 검증</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/data-platform.css"><body data-platform="data"><main><p class="notice">브라우저 통합 검증용 로컬 fixture · 실제 외부 다운로드 증거가 아닙니다.</p><nav class="fixture-stage-nav" aria-label="테스트 단계 이동"><a href="#data">자료 가져오기</a><a href="#data-privacy">민감정보 처리</a><a href="#data-policies">적용 정책과 결과</a></nav><div id="data-host"></div></main><script>window.KNOWHOW_CONFIG={dataApiBase:location.origin+'/data-platform'};</script><script src="/data-review-ui.js"></script><script src="/data-explorer.js"></script><script src="/data-platform.js"></script><script>window.controller=KnowHowDataPlatform.createController();function mount(){controller.mount(document.querySelector('#data-host'),{section:({'#data-privacy':'privacy','#data-policies':'policies'})[location.hash]||'intake'});}mount();addEventListener('hashchange',()=>{controller.destroy();mount();});</script></body></html>`);
}

async function main(){
  fs.mkdirSync(evidenceDir,{recursive:true});
  setup();const server=http.createServer((req,res)=>serve(req,res).catch(error=>{console.error(error);respond(res,{error:error.message},500);}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,...(fs.existsSync('/Applications/Google Chrome.app')?{channel:'chrome'}:{})});
  const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
  const browserErrors=[];const externalRequests=[];page.on('pageerror',error=>browserErrors.push(error.message));
  await page.route('**/*',route=>{if(!route.request().url().startsWith(base)){externalRequests.push(route.request().url());return route.abort();}return route.continue();});
  const waitForState=predicate=>page.waitForFunction(predicate,null,{timeout:12000});
  const idle=()=>waitForState(()=>!controller.getState().busy);
  const noOverflow=async(label)=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label);
  const reload=async(mode)=>{setup(mode);await page.goto(base);await idle();};
  const completeIngest=async()=>{fixture.ingestReady=true;await waitForState(()=>controller.getState().dataset?.id==='raw-fixture');await idle();};
  const sourceButton=()=>page.locator('[data-data-action=ev-source]');
  const formSubmit=()=>page.locator('#data-intake button');
  try{
    await page.goto(base);await idle();assert.deepEqual(fixture.requests,[],'mount must not fetch data, create session, or call AI');cases.push('Mount performs no fetch, session creation, source collection, or AI call');
    await sourceButton().click();await waitForState(()=>controller.getState().job?.kind==='source');
    assert.equal(await page.locator('progress').getAttribute('value'),null,'unknown total must remain indeterminate');
    assert.match(await page.locator('.data-live-job').innerText(),/2,048 B/);assert.doesNotMatch(await page.locator('.data-live-job').innerText(),/\d+%/);
    await page.screenshot({path:path.join(evidenceDir,'download-indeterminate.png'),fullPage:true});
    fixture.discoveryReady=true;await waitForState(()=>controller.getState().job?.kind==='ingest');
    const evIngest=fixture.requests.find(r=>r.path.endsWith('/sources/source-fixture/ingest'));assert.deepEqual(evIngest.body.options,{preset:'charger'});
    assert.equal(await page.locator('#data-preview').count(),0,'RAW results must wait for ingest success');
    await completeIngest();assert.match(await page.locator('#data-preview').innerText(),/120/);assert.match(await page.locator('#data-preview').innerText(),/GS타워/);
    await page.locator('#data-preview summary').first().click();assert.match(await page.locator('.data-source-meta').innerText(),/ev\.or\.kr/);assert.match(await page.locator('.data-source-meta').innerText(),/4,096 B/);
    assert.equal(await page.locator('#data-preview tbody tr').count(),50,'preview is bounded to 50 rows');
    await page.screenshot({path:path.join(evidenceDir,'desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await noOverflow('mobile RAW screen must not overflow');await page.screenshot({path:path.join(evidenceDir,'mobile.png'),fullPage:true});
    await page.setViewportSize({width:1280,height:900});
    await page.getByRole('button',{name:'다음 50행',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-query-count]')?.textContent.includes('51–100'));
    await page.getByLabel('전체 열에서 찾기').fill('GS타워');await page.getByRole('button',{name:'조건 적용해 조회',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-query-count]')?.textContent.includes('전체 1행'));
    let [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'조건에 맞는 전체 1행 CSV 내려받기',exact:true}).click()]);assert.deepEqual(fs.readFileSync(await download.path()),original);
    [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'보존된 원본 파일 내려받기',exact:true}).click()]);assert.deepEqual(fs.readFileSync(await download.path()),original);
    const exported=fixture.requests.find(r=>r.path.endsWith('/export'));assert.equal(exported.body.search,'GS타워');
    for(const request of fixture.requests.filter(r=>r.path.includes('/visitor/')&&!r.path.endsWith('/sessions')))assert.match(request.authorization,/^Bearer fixture-session-/);
    cases.push('EV CTA discovery → charger preset ingest → success-only RAW preview with actual fixture bytes, rows and source metadata','Unknown total shows indeterminate progress without invented percentage','50-row pagination, full-text query, original download and query export preserve visitor Authorization');
    await page.locator('.fixture-stage-nav a[href="#data-privacy"]').click();await page.locator('#data-transform').waitFor();
    assert.equal(await page.locator('.data-review-result .is-complete').count(),0,'previous intake success must not claim privacy processing is complete');
    assert.equal(fixture.requests.filter(r=>/\/(privacy[^/]*|reviews?|polic[^/]*)(\/|$)/.test(r.path)).length,0,'visiting review must not request AI');
    await page.locator('[data-rule-column="연락처"] [name=action]').selectOption('mask');
    await page.getByRole('button',{name:'선택한 규칙으로 처리 실행',exact:true}).click();await waitForState(()=>controller.getState().job?.kind==='transform');
    const transform=fixture.requests.find(r=>r.path.endsWith('/transform'));assert.equal(transform.body.rules.find(r=>r.column==='연락처').action,'mask');assert.equal(transform.body.privacy_mode,'explicit');
    fixture.transformReady=true;await waitForState(()=>controller.getState().dataset?.id==='clean-fixture');await idle();assert.match(await page.locator('.data-review-result').innerText(),/010-0000-0000/);assert.match(await page.locator('.data-review-result').innerText(),/\*\*\*/);
    await page.setViewportSize({width:390,height:844});await noOverflow('mobile privacy screen must not overflow');await page.screenshot({path:path.join(evidenceDir,'privacy-mobile.png'),fullPage:true});
    cases.push('Manual privacy choices submit explicit rules only on apply, transform completion displays real fixture before/after');
    await page.locator('.fixture-stage-nav a[href="#data-policies"]').click();assert.match(await page.locator('.data-policy-review').innerText(),/정책 적용 없음/);await noOverflow('mobile policy screen must not overflow');
    await page.setViewportSize({width:1280,height:900});await page.locator('.fixture-stage-nav a[href="#data"]').click();await page.locator('.data-synthetic > summary').click();await page.getByRole('button',{name:'공유 합성 예제 공간 열기',exact:true}).click();await idle();
    assert.equal(await page.locator('#data-preview').count(),0,'real files must disappear in demo scope');assert.equal(fixture.requests.filter(r=>r.path.includes('/demo/')).every(r=>r.authorization===null),true,'visitor bearer must never enter synthetic scope');
    cases.push('Policy screen does not claim an application before confirmed result; real datasets are isolated from shared synthetic scope');

    await reload('html');await page.getByRole('button',{name:'웹 페이지의 표',exact:true}).click();await page.getByLabel('원본 URL',{exact:true}).fill('https://example.com/table');await formSubmit().click();fixture.discoveryReady=true;await waitForState(()=>controller.getState().source?.format==='html');
    assert.equal(fixture.requests.filter(r=>r.path.endsWith('/ingest')).length,0);assert.equal(await page.getByRole('button',{name:'선택한 표를 RAW에 저장',exact:true}).isDisabled(),true);
    await page.locator('[data-data-table="0"]').check();await page.getByRole('button',{name:'선택한 표를 RAW에 저장',exact:true}).click();await waitForState(()=>controller.getState().job?.kind==='ingest');assert.equal(fixture.requests.find(r=>r.path.endsWith('/ingest')).body.table_index,0);await completeIngest();cases.push('HTML discovery lists tables and waits for explicit table selection before ingestion');

    await reload('upload');await page.locator('input[type=file]').setInputFiles({name:'내 파일.csv',mimeType:'text/csv',buffer:original});await formSubmit().click();await waitForState(()=>controller.getState().job?.kind==='ingest');assert.deepEqual(fixture.uploaded,original);assert.equal(fixture.requests.some(r=>r.path.endsWith('/sources')),false);await completeIngest();cases.push('Upload sends exact file bytes to authenticated visitor endpoint');

    await reload('sheets');await page.getByRole('button',{name:'공개 Google Sheets',exact:true}).click();await page.getByLabel('원본 URL',{exact:true}).fill('https://docs.google.com/spreadsheets/d/fixture/edit');await formSubmit().click();await waitForState(()=>controller.getState().job?.kind==='source');assert.equal(fixture.requests.find(r=>r.path.endsWith('/sources')).body.kind,'sheets');
    await page.getByRole('button',{name:'이 작업 취소',exact:true}).click();await idle();assert.equal(await page.locator('.data-status').textContent(),'취소됨');cases.push('Public Sheets uses sheets source kind; cancellation is server-confirmed');

    await reload('empty-html');await page.getByRole('button',{name:'웹 페이지의 표',exact:true}).click();await page.getByLabel('원본 URL',{exact:true}).fill('https://example.com/empty');await formSubmit().click();fixture.discoveryReady=true;await page.getByText('이 페이지에서 입수할 HTML 표를 찾지 못했습니다. 다른 URL을 입력해 주세요.',{exact:true}).waitFor();assert.equal(fixture.requests.some(r=>r.path.endsWith('/ingest')),false);assert.equal(await page.locator('#data-preview').count(),0);cases.push('Empty HTML discovery does not ingest or claim RAW completion');

    await reload('failed-job');await sourceButton().click();fixture.discoveryReady=true;await waitForState(()=>controller.getState().job?.state==='failed');await page.getByRole('button',{name:'같은 출처 다시 가져오기',exact:true}).waitFor();assert.equal(await page.locator('#data-preview').count(),0);await page.setViewportSize({width:390,height:844});await noOverflow('mobile failure screen must not overflow');await page.screenshot({path:path.join(evidenceDir,'error.png'),fullPage:true});
    fixture.discoveryReady=false;await page.getByRole('button',{name:'같은 출처 다시 가져오기',exact:true}).click();await waitForState(()=>controller.getState().job?.state==='running');assert.equal(fixture.requests.filter(r=>r.path.endsWith('/sources')).length,2);cases.push('Failed jobs show error and explicit retry; no saved dataset appears');
    await reload('http-error');await sourceButton().click();await page.locator('[data-data-error]:not([hidden])').waitFor();assert.match(await page.locator('[data-data-error]').innerText(),/공개 주소에서 원본/);assert.equal(await page.locator('#data-preview').count(),0);cases.push('HTTP source failure is visible and never presented as completed intake');
    assert.deepEqual(browserErrors,[]);assert.deepEqual(externalRequests,[]);
    const report={passed:true,checkedAt:new Date().toISOString(),scope:'Local fixture browser integration; not evidence of external downloading or production API behavior.',cases,screenshots:['download-indeterminate.png','desktop.png','mobile.png','privacy-mobile.png','error.png'],externalRequests,browserErrors};
    for(const stale of ['failure.png','failure.json']){const file=path.join(evidenceDir,stale);if(fs.existsSync(file))fs.unlinkSync(file);}
    fs.writeFileSync(path.join(evidenceDir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  }catch(error){await page.screenshot({path:path.join(evidenceDir,'failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(evidenceDir,'failure.json'),JSON.stringify({error:error.stack,cases,requests:fixture.requests,browserErrors},null,2)+'\n');throw error;}
  finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
