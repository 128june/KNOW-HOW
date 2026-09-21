// Real local API integration: every /data-platform response comes from API_BASE.
// No API response stubs. Test CSV/XLSX values and explicitly seeded policies are synthetic.
// No generate:true request is permitted, and no provider key is accessed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname,'..');
const apiBase = (process.env.DATA_INTAKE_LIVE_API_BASE || 'http://127.0.0.1:18771/data-platform').replace(/\/$/,'');
const evidenceDir = process.env.DATA_INTAKE_LIVE_EVIDENCE_DIR || path.join(root,'tests/evidence/data-intake-live');
const htmlURL = 'https://www.w3schools.com/html/html_tables.asp';
const csv = Buffer.from('id,email,phone,region\r\n1,demo1@example.test,010-0000-0001,서울\r\n2,demo2@example.test,010-0000-0002,부산\r\n3,demo3@example.test,010-0000-0003,제주\r\n','utf8');
const traffic=[];
const cases=[];
const observations={};
const browserErrors=[];
const consoleErrors=[];
const blockedGeneration=[];

function harnessHTML(){return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>실제 API 자료 입수 검증</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/data-platform.css"><body data-platform="data"><main><p class="notice">실제 로컬 API 통합 검증 · 응답 stub 없음 · 업로드 값과 예제 정책은 검증용 가상자료 · AI 생성 호출 없음</p><nav class="live-stage-nav" aria-label="검증 단계 이동"><a href="#data">자료 가져오기</a><a href="#data-privacy">민감정보 처리</a><a href="#data-policies">적용 정책과 결과</a></nav><div id="data-host"></div></main><script>window.KNOWHOW_CONFIG={dataApiBase:${JSON.stringify(apiBase)}};</script><script src="/data-review-ui.js"></script><script src="/data-explorer.js"></script><script src="/data-platform.js"></script><script>window.controller=KnowHowDataPlatform.createController();function mount(){controller.mount(document.querySelector('#data-host'),{section:({'#data-privacy':'privacy','#data-policies':'policies'})[location.hash]||'intake'});}mount();addEventListener('hashchange',()=>{controller.destroy();mount();});</script></body></html>`;}
function publicState(value){return {dataset:value.dataset,preview:value.preview,job:value.job,source:value.source,proposal:value.proposal,application:value.application,reviewResult:value.reviewResult,error:value.error,notice:value.notice};}

async function main(){
  fs.mkdirSync(evidenceDir,{recursive:true});fs.writeFileSync(path.join(evidenceDir,'uploaded-test.csv'),csv);
  const xlsxPath=path.join(evidenceDir,'uploaded-test.xlsx');
  const python=process.env.DATA_INTAKE_TEST_PYTHON||'/Users/hr/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
  execFileSync(python,['-c',`import sys
from openpyxl import Workbook
from openpyxl.styles import Font
book = Workbook()
sheet = book.active
sheet.title = '검증용 가상자료'
sheet.append(['id', 'station_name', 'region', 'ports'])
sheet.append([1, '검증용 가상 충전소 A', '서울', 2])
sheet.append([2, '검증용 가상 충전소 B', '부산', 4])
for cell in sheet[1]:
    cell.font = Font(bold=True)
sheet.freeze_panes = 'A2'
book.properties.title = '실제 Excel 업로드 검증용 가상자료'
book.properties.description = '두 행의 가상 값을 사용한 실제 XLSX 업로드 및 원본 보존 검증'
book.save(sys.argv[1])
`,xlsxPath]);
  const xlsx=fs.readFileSync(xlsxPath),xlsxSHA=crypto.createHash('sha256').update(xlsx).digest('hex');
  const base=process.env.DATA_INTAKE_LIVE_ORIGIN||'http://127.0.0.1:18902';
  const harnessURL=new URL(base);assert.equal(harnessURL.hostname,'127.0.0.1');
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,base).pathname;
    if(['/style.css','/data-platform.css','/data-review-ui.js','/data-explorer.js','/data-platform.js'].includes(pathname)){res.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(root,'src',pathname.slice(1))));return;}
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(harnessHTML());
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(harnessURL.port),'127.0.0.1',resolve);});

  const browser=await chromium.launch({headless:true,...fs.existsSync('/Applications/Google Chrome.app')?{channel:'chrome'}:{}});
  const context=await browser.newContext({viewport:{width:1280,height:960},acceptDownloads:true});
  const page=await context.newPage();page.on('pageerror',error=>browserErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  // Static resources use the actual local HTTP origin; API traffic is never routed or stubbed.
  const requestRecords=new Map();
  page.on('request',request=>{
    if(!request.url().startsWith(apiBase+'/'))return;
    const url=new URL(request.url()),body=request.postDataBuffer();let json=null;
    if(body?.length&&request.headers()['content-type']?.includes('application/json'))json=JSON.parse(body.toString());
    if(json?.generate===true)blockedGeneration.push(url.pathname);
    const record={method:request.method(),path:url.pathname,query:Object.fromEntries(url.searchParams),authorizationPresent:!!request.headers().authorization,origin:request.headers().origin,requestBytes:body?.length??null,...json?{body:json}:{}};
    traffic.push(record);requestRecords.set(request,record);
  });
  page.on('requestfailed',request=>{const record=requestRecords.get(request);if(record)record.error=request.failure()?.errorText;});
  page.on('response',response=>{const record=requestRecords.get(response.request());if(record){record.status=response.status();record.allowOrigin=response.headers()['access-control-allow-origin'];}});
  const api=async(requestContext,method,suffix,{token,body}={})=>{
    const url=new URL(apiBase+suffix);const response=await requestContext.fetch(url.href,{method,headers:{Origin:base,...token?{Authorization:'Bearer '+token}:{}},...body!==undefined?{data:body}:{}});
    traffic.push({method,path:url.pathname,query:Object.fromEntries(url.searchParams),authorizationPresent:!!token,origin:base,status:response.status(),...body!==undefined?{body}:{}});return response;
  };

  const state=()=>page.evaluate(()=>{const s=controller.getState();return {dataset:s.dataset,preview:s.preview,job:s.job,source:s.source,proposal:s.proposal,application:s.application,reviewResult:s.reviewResult,error:s.error,notice:s.notice,busy:s.busy};});
  const wait=predicate=>page.waitForFunction(predicate,null,{timeout:600000});
  const idle=()=>wait(()=>!controller.getState().busy);
  const navigate=async(hash)=>{await page.locator(`.live-stage-nav a[href="${hash}"]`).click();await idle();};
  const openOptions=async()=>{if(!await page.locator('.data-intake-options').evaluate(el=>el.open))await page.locator('.data-intake-options > summary').click();};
  const progressTimer=setInterval(async()=>{try{const s=await state();if(s.job)console.log(JSON.stringify({event:'server-progress',job_id:s.job.id,state:s.job.state,stage:s.job.stage,processed_bytes:s.job.processed_bytes,processed_rows:s.job.processed_rows}));}catch{}},30000);
  const assertOkay=async()=>{const s=await state();assert.equal(s.error,'');assert.notEqual(s.job?.state,'failed',JSON.stringify(s.job?.error));return s;};
  try{
    await page.goto(base);assert.equal(traffic.length,0,'mount must not create session, intake, or AI request');cases.push('Fresh mount performs no API work');
    await page.locator('[data-data-method=html]').click();await page.locator('[name=source_url]').fill(htmlURL);await page.locator('#data-intake button').click();
    await wait(()=>controller.getState().source?.source_id||controller.getState().error||controller.getState().job?.state==='failed');
    const discovered=await assertOkay();assert.equal(discovered.source.format,'html');assert.ok(discovered.source.tables.length>0);assert.ok(discovered.source.source.source_bytes>0);assert.equal(traffic.filter(r=>r.path.endsWith('/ingest')).length,0);
    const chosen=discovered.source.tables.find(t=>t.columns.includes('Company'))||discovered.source.tables[0];
    console.log('Actual HTML discovery completed: '+discovered.source.source.source_bytes+' bytes, '+discovered.source.tables.length+' tables.');
    observations.htmlDiscovery={source_id:discovered.source.source_id,source:discovered.source.source,tables:discovered.source.tables.map(t=>({index:t.index,caption:t.caption,columns:t.columns,estimated_rows:t.estimated_rows})),selectedTable:chosen.index};
    await page.locator(`[data-data-table="${chosen.index}"]`).check();await page.locator('[data-data-action=ingest-table]').click();
    await wait(()=>controller.getState().rawDataset?.id&&controller.getState().preview?.rows||controller.getState().error||controller.getState().job?.state==='failed');
    const html=await assertOkay();assert.ok(html.dataset.row_count>0);assert.ok(html.dataset.original_file);assert.ok(html.dataset.source_sha256);assert.ok(html.preview.rows.length>0);
    console.log('Actual HTML RAW DB completed: '+html.dataset.row_count+' rows.');
    observations.htmlDataset=publicState(html);await page.locator('#data-preview summary').first().click();await page.screenshot({path:path.join(evidenceDir,'html-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(evidenceDir,'html-mobile.png'),fullPage:true});await page.setViewportSize({width:1280,height:960});
    cases.push('Public W3Schools HTML downloaded by live API, tables discovered, explicit table selection persisted RAW rows with source time/hash');

    await openOptions();await page.locator('[data-data-method=file]').click();await openOptions();await page.locator('[name=source_file]').setInputFiles({name:'live-excel-test.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:xlsx});await page.locator('#data-intake button').click();
    await wait(()=>controller.getState().rawDataset?.id&&controller.getState().preview?.rows&&controller.getState().dataset?.name==='live-excel-test.xlsx'||controller.getState().error||controller.getState().job?.state==='failed');
    const excel=await assertOkay();assert.equal(excel.dataset.row_count,2);assert.equal(excel.dataset.schema.length,4);assert.equal(excel.dataset.source_sha256,xlsxSHA);assert.equal(excel.dataset.source_bytes,xlsx.length);
    assert.deepEqual(excel.preview.rows.map(r=>({id:Number(r.id),station_name:r.station_name,region:r.region,ports:Number(r.ports)})),[{id:1,station_name:'검증용 가상 충전소 A',region:'서울',ports:2},{id:2,station_name:'검증용 가상 충전소 B',region:'부산',ports:4}]);
    assert.equal(traffic.some(r=>r.path.endsWith('/uploads')&&r.query.format==='xlsx'&&r.query.name==='live-excel-test.xlsx'&&r.authorizationPresent&&r.status===202),true);
    await page.locator('#data-preview summary').first().click();const [excelDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-data-action=original]').click()]);const excelOriginal=fs.readFileSync(await excelDownload.path());assert.deepEqual(excelOriginal,xlsx);const downloadedXlsxSHA=crypto.createHash('sha256').update(excelOriginal).digest('hex');assert.equal(downloadedXlsxSHA,xlsxSHA);fs.writeFileSync(path.join(evidenceDir,'downloaded-original.xlsx'),excelOriginal);
    observations.xlsxUpload={...publicState(excel),input_bytes:xlsx.length,input_sha256:xlsxSHA,downloaded_original_sha256:downloadedXlsxSHA,synthetic_test_values:true};await page.screenshot({path:path.join(evidenceDir,'xlsx-upload-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(evidenceDir,'xlsx-upload-mobile.png'),fullPage:true});await page.setViewportSize({width:1280,height:960});
    console.log('Actual XLSX upload completed: '+excel.dataset.row_count+' rows, '+xlsx.length+' bytes, input/server/download SHA identical.');cases.push('Actual 2-row XLSX workbook uploaded via browser file input; authenticated format=xlsx request parsed 4 columns into RAW DB, original server SHA and downloaded workbook bytes match exactly');

    await openOptions();await page.locator('[data-data-method=file]').click();await openOptions();await page.locator('[name=source_file]').setInputFiles({name:'live-privacy-test.csv',mimeType:'text/csv',buffer:csv});await page.locator('#data-intake button').click();
    await wait(()=>controller.getState().rawDataset?.id&&controller.getState().preview?.rows&&controller.getState().dataset?.name==='live-privacy-test.csv'||controller.getState().error||controller.getState().job?.state==='failed');
    const uploaded=await assertOkay();assert.equal(uploaded.dataset.row_count,3);assert.equal(uploaded.dataset.source_sha256,crypto.createHash('sha256').update(csv).digest('hex'));assert.equal(uploaded.preview.rows[0].email,'demo1@example.test');
    console.log('Actual CSV upload completed: '+uploaded.dataset.row_count+' rows, matching original SHA.');
    observations.uploadDataset=publicState(uploaded);const rawId=uploaded.dataset.id;const token=await page.evaluate(()=>controller.getState().session.access_token);
    await page.locator('#data-preview summary').first().click();const [originalDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-data-action=original]').click()]);assert.deepEqual(fs.readFileSync(await originalDownload.path()),csv);
    cases.push('Exact CSV bytes uploaded into actual RAW DB; 3 parsed rows and server SHA match original; original download byte-for-byte identical');

    await navigate('#data-policies');await page.locator('[data-data-action=policy-example]').click();
    await wait(()=>controller.getState().proposal?.review_id||controller.getState().error||controller.getState().job?.state==='failed');
    const reviewed=await assertOkay();assert.equal(reviewed.proposal.ai_generated,false);assert.ok(reviewed.proposal.policies.length>0);assert.ok(reviewed.proposal.policies.every(p=>p.synthetic===true));assert.equal(reviewed.proposal.status,'review_required');
    console.log('Actual policy review completed with generate:false: '+reviewed.proposal.policies.length+' stored sample policies.');
    observations.review=reviewed.proposal;const reviewId=reviewed.proposal.review_id;
    const reviewRequest=traffic.find(r=>r.path.endsWith('/privacy-review'));assert.deepEqual(reviewRequest.body,{generate:false,seed_demo:true});assert.equal(reviewRequest.status,202);
    assert.match(await page.locator('.data-policy-review').innerText(),/합성|예제/);assert.match(await page.locator('.data-policy-application').innerText(),/아직 (적용|처리)하지 않음/);await page.screenshot({path:path.join(evidenceDir,'policy-before-apply.png'),fullPage:true});
    await page.locator('[data-data-action=policy-review-rules]').click();await page.locator('#data-transform').waitFor();
    for(const column of ['id','email','phone','region'])await page.locator(`[data-rule-column="${column}"] [name=action]`).selectOption(['email','phone'].includes(column)?'mask':'keep');
    await page.locator('#data-transform button[type=submit]').click();
    await wait(()=>controller.getState().application?.dataset_id||controller.getState().error||controller.getState().job?.state==='failed');
    const transformed=await assertOkay();assert.equal(transformed.dataset.row_count,3);assert.notEqual(transformed.dataset.id,rawId);assert.ok(transformed.preview.rows.every((r,i)=>r.email!==uploaded.preview.rows[i].email&&r.phone!==uploaded.preview.rows[i].phone));assert.equal(transformed.preview.rows[0].region,'서울');assert.ok(transformed.application.policies.length>0);
    console.log('Actual privacy transform completed: '+transformed.dataset.row_count+' rows.');
    observations.transformed=publicState(transformed);const resultId=transformed.dataset.id;assert.equal(traffic.some(r=>r.path.endsWith('/privacy-apply')&&r.body.review_id===reviewId),true);assert.equal(traffic.some(r=>r.path.endsWith('/privacy-result')&&r.query.review_id===reviewId),true);
    await page.screenshot({path:path.join(evidenceDir,'privacy-applied.png'),fullPage:true});await navigate('#data-policies');assert.match(await page.locator('.data-policy-application').innerText(),/처리 완료 · 정책 적용 없음/);await page.screenshot({path:path.join(evidenceDir,'policy-processing-result.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(evidenceDir,'policy-mobile.png'),fullPage:true});await page.setViewportSize({width:1280,height:960});
    cases.push('Explicit sample-policy action seeds real visitor KB documents, generate:false durable review returns synthetic evidence, human masks execute through privacy-apply and durable privacy-result; unlinked policy documents stay search evidence, never confirmed application');

    const [exportDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-explorer-action=export]').click()]);const exported=fs.readFileSync(await exportDownload.path());fs.writeFileSync(path.join(evidenceDir,'processed-export.csv'),exported);assert.ok(exported.length>0);assert.equal(exported.includes(Buffer.from('demo1@example.test')),false);assert.equal(exported.includes(Buffer.from('010-0000-0001')),false);
    const originalPreview=await api(context.request,'GET',`/visitor/datasets/${rawId}/preview`,{token});assert.equal(originalPreview.status(),200);assert.equal((await originalPreview.json()).rows[0].email,'demo1@example.test');
    cases.push('Authenticated processed CSV export contains masked values while original RAW DB remains unchanged');

    const other=await browser.newContext();const second=await api(other.request,'POST','/visitor/sessions',{body:{}});assert.equal(second.status(),201);const secondToken=(await second.json()).access_token;
    const isolation=[];for(const suffix of [`datasets/${rawId}/preview`,`datasets/${rawId}/original`,`datasets/${resultId}/privacy-result?review_id=${reviewId}`]){const response=await api(other.request,'GET',`/visitor/${suffix}`,{token:secondToken});isolation.push({route:suffix,status:response.status()});assert.equal(response.status(),404);}
    const listing=await api(other.request,'GET','/visitor/datasets',{token:secondToken});const listed=await listing.json();assert.equal(JSON.stringify(listed).includes(rawId),false);observations.isolation=isolation;await other.close();
    cases.push('Second visitor cannot list, preview, download original, or retrieve privacy result belonging to first visitor (404)');

    await navigate('#data');await openOptions();await page.locator('[data-data-method=url]').click();await openOptions();await page.locator('[name=source_url]').fill('http://127.0.0.1/unavailable.csv');await page.locator('#data-intake button').click();
    await wait(()=>controller.getState().error||controller.getState().job?.state==='failed');const failed=await state();assert.equal(failed.dataset,null);assert.ok(failed.error||failed.job.error);observations.rejectedSource={url:'http://127.0.0.1/unavailable.csv',error:failed.error,job:failed.job};
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(evidenceDir,'error-mobile.png'),fullPage:true});cases.push('Non-public source is rejected by actual API and mobile UI shows failure without RAW result');
    assert.deepEqual(blockedGeneration,[]);assert.deepEqual(browserErrors,[]);
    assert.ok(traffic.filter(r=>r.path.includes('/visitor/')&&!r.path.endsWith('/sessions')&&r.method!=='OPTIONS').every(r=>r.authorizationPresent));
    const report={passed:true,checkedAt:new Date().toISOString(),apiBase,harnessOrigin:base,scope:'Real local API and DB integration; public HTML was actually downloaded. Uploaded CSV/XLSX values and explicitly seeded KB policies are synthetic test data. Static harness served by a real local HTTP server at an allowed Origin; API requests go directly to real API with CORS and Authorization. No API response stubs or generate:true requests.',cases,screenshots:["html-desktop.png","html-mobile.png","xlsx-upload-desktop.png","xlsx-upload-mobile.png","policy-before-apply.png","privacy-applied.png","policy-processing-result.png","policy-mobile.png","error-mobile.png"],observations,traffic,browserErrors,consoleErrors,blockedGeneration};
    for(const stale of ['failure.json','failure.png']){const file=path.join(evidenceDir,stale);if(fs.existsSync(file))fs.unlinkSync(file);}
    fs.writeFileSync(path.join(evidenceDir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,cases,htmlRows:html.dataset.row_count,htmlSourceBytes:discovered.source.source.source_bytes,xlsxRows:excel.dataset.row_count,xlsxBytes:xlsx.length,xlsxSHA,uploadedRows:uploaded.dataset.row_count,processedRows:transformed.dataset.row_count,policies:reviewed.proposal.policies.length,report:path.join(evidenceDir,'report.json')},null,2));
  }catch(error){await page.screenshot({path:path.join(evidenceDir,'failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(evidenceDir,'failure.json'),JSON.stringify({error:error.stack,cases,observations,traffic,browserErrors,consoleErrors,blockedGeneration,state:await state().catch(()=>null)},null,2)+'\n');throw error;}
  finally{clearInterval(progressTimer);await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
