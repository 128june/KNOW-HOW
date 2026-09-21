// Actual local API/Worker/SQLite integration. No API response substitutions.
// CSV/policy values are explicit test input; no model, CLI or embedding calls.
// Start data-lineage-local-api.py first. Set NODE_PATH to Playwright's directory.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const apiBase=(process.env.DATA_LINEAGE_API_BASE||'http://127.0.0.1:18773/data-platform').replace(/\/$/,'');
const origin=process.env.DATA_LINEAGE_ORIGIN||'http://127.0.0.1:18923';
const output=process.env.DATA_LINEAGE_EVIDENCE_DIR||'/tmp/knowhow-data-lineage-live';
const csv=Buffer.from('id,email,region\r\n1,first@example.invalid,서울\r\n2,second@example.invalid,부산\r\n3,third@example.invalid,서울\r\n');
const policyText='내부 지역별 집계 자료에서 email 열은 mask 처리한다. id와 region은 집계 연결을 위해 유지한다. 원본 파일은 별도로 보존한다.';
const cases=[],traffic=[],errors=[],measurements=[],observations={},blockedRequests=[],loadedScripts=new Set(),credentials=[];
const redact=value=>credentials.reduce((text,secret)=>text.split(secret).join('[credential omitted]'),String(value)).replace(/Bearer [A-Za-z0-9._~-]+/g,'[authorization omitted]').replace(/(\"access_token\"\s*:\s*)\"[^\"]+\"/g,'$1\"[credential omitted]\"');

function harness(){
 const html=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
 // Preserve every production script and its order. This separate deferred test
 // hook only retains a reference to the controller created by the actual shell.
 const shell='<script defer src="./platform-shell.js"></script>';
 assert.ok(html.includes(shell),'Expected actual shell entry point');
 return html.replace(shell,'<script defer src="./lineage-test-hook.js"></script>'+shell);
}

async function main(){
 fs.mkdirSync(output,{recursive:true});
 assert.equal(new URL(apiBase).hostname,'127.0.0.1');assert.equal(new URL(origin).hostname,'127.0.0.1');
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,origin).pathname.slice(1);
  if(name==='config.js'){res.setHeader('Content-Type','text/javascript');loadedScripts.add(name);res.end('window.KNOWHOW_CONFIG='+JSON.stringify({dataApiBase:apiBase,apiBase:apiBase.replace(/\/data-platform$/,'/knowhow'),aiRequestsPaused:true})+';');return;}
  if(name==='lineage-test-hook.js'){res.setHeader('Content-Type','text/javascript');res.end('(function(){const original=KnowHowDataPlatform.createController;KnowHowDataPlatform.createController=function(){window.controller=original.apply(this,arguments);return window.controller};})();');return;}
  if(/^[a-z-]+\.(css|js)$/.test(name)&&fs.existsSync(path.join(root,'src',name))){if(name.endsWith('.js'))loadedScripts.add(name);res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(root,'src',name)));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(harness());
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(new URL(origin).port),'127.0.0.1',resolve)});
 const browser=await chromium.launch({headless:true,...process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:fs.existsSync('/Applications/Google Chrome.app')?{channel:'chrome'}:{}});
 const context=await browser.newContext({viewport:{width:1280,height:960},acceptDownloads:true});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());let body;
  try{if(request.headers()['content-type']?.includes('application/json'))body=request.postDataJSON()}catch{}
  const allowed=url.origin===origin||request.url().startsWith(apiBase+'/');
  if(!allowed||body?.generate===true){blockedRequests.push({method:request.method(),origin:url.origin,path:url.pathname,reason:body?.generate===true?'generation-forbidden':'non-local-data-request'});await route.abort('blockedbyclient');return;}
  await route.continue();
 });
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 const requests=new Map();
 page.on('request',request=>{
  if(!request.url().startsWith(apiBase+'/'))return;
  let body;try{if(request.headers()['content-type']?.includes('application/json'))body=request.postDataJSON()}catch{}
  assert.notEqual(body?.generate,true,'Paid generation is forbidden');
  const url=new URL(request.url()),record={method:request.method(),path:url.pathname,query:Object.fromEntries(url.searchParams),authorizationPresent:!!request.headers().authorization,...body?{body}:{}};
  traffic.push(record);requests.set(request,record);
 });
 page.on('response',response=>{const record=requests.get(response.request());if(record)record.status=response.status()});
 const api=async(method,suffix,{token,body,bytes,status=200}={})=>{
  assert.notEqual(body?.generate,true);const response=await context.request.fetch(apiBase+'/visitor/'+suffix,{method,headers:{Origin:origin,...token?{Authorization:'Bearer '+token}:{},...bytes?{'Content-Type':'application/octet-stream'}:{}},...bytes?{data:bytes}:body!==undefined?{data:body}:{}});
  traffic.push({method,path:'/data-platform/visitor/'+suffix,authorizationPresent:!!token,status:response.status(),...body?{body}:{}});
  const responseText=await response.text();let result;try{result=JSON.parse(responseText)}catch{throw Error('Expected JSON from local API '+suffix)}if(result.access_token)credentials.push(result.access_token);assert.equal(response.status(),status,method+' '+suffix+' '+redact(responseText));return result;
 };
 const finish=async(job,token,expected='succeeded')=>{
  const deadline=Date.now()+45000;
  while(Date.now()<deadline){const result=await api('GET','jobs/'+job.id,{token});if(['succeeded','failed','cancelled'].includes(result.state)){assert.equal(result.state,expected,JSON.stringify(result));return result;}await new Promise(resolve=>setTimeout(resolve,100));}
  throw Error('Worker timeout: '+job.id);
 };
 const idle=()=>page.waitForFunction(()=>window.controller&&!controller.getState().busy,null,{timeout:45000});
 const state=()=>page.evaluate(()=>{const s=controller.getState();return {dataset:s.dataset,rawDataset:s.rawDataset,preview:s.preview,job:s.job,error:s.error,proposal:s.proposal,application:s.application,lineageGraph:s.lineageGraph,lineageSelected:s.lineageSelected}});
 const navigate=async(hash)=>{await page.evaluate(hash=>location.hash=hash,hash);await idle()};
 const graphReady=()=>page.waitForFunction(()=>controller.getState().lineageGraph&&!controller.getState().busy,null,{timeout:45000});
 const screenshot=async(label)=>{for(const width of [1280,390]){await page.setViewportSize({width,height:width===390?844:960});if(width===390)await page.waitForFunction(()=>getComputedStyle(document.querySelector('aside')).visibility==='hidden');const m=await page.evaluate(()=>({width:innerWidth,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),header:document.querySelector('.app-header').getBoundingClientRect().height}));assert.equal(m.overflow,0,label+' '+width+' overflow');assert.equal(m.header,width===390?56:48);measurements.push({label,...m});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,label+'-'+width+'.png'),fullPage:true,animations:'disabled'});}await page.setViewportSize({width:1280,height:960})};
 const select=async id=>{const button=page.locator('[data-lineage-node='+JSON.stringify(id)+']');await button.focus();await button.press('Enter');await page.locator('#data-lineage-detail').waitFor();return page.locator('#data-lineage-detail').innerText()};
 try{
  const health=await context.request.get(apiBase+'/health');assert.equal(health.status(),200);assert.equal((await health.json()).worker_alive,true);
  await page.goto(origin+'/#data-lineage');await idle();
  assert.equal(traffic.length,0,'Opening lineage without a session must not create data or a visitor');
  assert.equal(await page.locator('[data-lineage-node]').count(),0);
  assert.match(await page.locator('#page').innerText(),/자료|방문자|가져오기/);
  await screenshot('lineage-empty');cases.push('New lineage tab has no invented stages/data and creates no session or API work');

  await navigate('#data');
  await page.locator('[data-data-method=file]').click();
  const options=page.locator('.data-intake-options');if(await options.count()&&!await options.evaluate(el=>el.open))await options.locator('summary').first().click();
  await page.locator('[name=source_file]').setInputFiles({name:'lineage-actual-input.csv',mimeType:'text/csv',buffer:csv});await page.locator('#data-intake button[type=submit],#data-intake button').last().click();
  await page.waitForFunction(()=>controller.getState().rawDataset?.id&&controller.getState().preview?.rows||controller.getState().error||controller.getState().job?.state==='failed',null,{timeout:45000});await idle();
  const uploaded=await state();assert.equal(uploaded.error,'');assert.equal(uploaded.dataset.row_count,3);assert.equal(uploaded.dataset.source_sha256,crypto.createHash('sha256').update(csv).digest('hex'));assert.equal(uploaded.preview.rows[0].email,'first@example.invalid');
  const rawId=uploaded.dataset.id,token=await page.evaluate(()=>controller.getState().session.access_token);credentials.push(token);
  observations.raw={dataset_id:rawId,row_count:uploaded.dataset.row_count,source_sha256:uploaded.dataset.source_sha256,job_id:uploaded.job.id};
  cases.push('Browser CSV upload persists exact source SHA, original values and three real RAW rows');
  await navigate('#data-lineage');await graphReady();const rawGraph=(await state()).lineageGraph;assert.equal(rawGraph.nodes.some(n=>n.stage==='mart'||n.stage==='use'),false);await screenshot('lineage-intake-only');

  let policy=await api('POST','kb/save',{token,body:{department:'data',title:'리니지 검증용 이메일 처리 기준',content:policyText,source:{kind:'data-platform-privacy-policy',reference:'검증 담당자가 입력한 원문'},visibility:'department'}});
  policy=await api('POST','kb/review',{token,body:{department:'data',id:policy.id,version:policy.version,state:'confirmed',reason:'이메일 가림과 원본 보존 조건을 직접 확인했습니다.'}});
  await navigate('#data-policies');await page.locator('[data-data-action=policy-search]').click();
  await page.waitForFunction(()=>controller.getState().proposal?.review_id||controller.getState().error,null,{timeout:45000});await idle();
  const review=(await state()).proposal;assert.equal(review.ai_generated,false);assert.equal(review.policies[0].id,policy.id);
  await navigate('#data-privacy');
  const email=page.locator('[data-rule-column=email]');await email.locator('[name=action]').selectOption('mask');await email.locator('[name=policy_ref]').check();await email.locator('[name=decision_reason]').fill('내부 지역 집계에 이메일 원문은 필요하지 않아 확인한 정책 버전을 적용합니다.');
  await page.locator('#data-transform button[type=submit]').click();
  await page.waitForFunction(()=>controller.getState().application?.dataset_id||controller.getState().error||controller.getState().job?.state==='failed',null,{timeout:45000});await idle();
  const processed=await state();assert.equal(processed.error,'');assert.notEqual(processed.dataset.id,rawId);assert.equal(processed.dataset.row_count,3);assert.ok(processed.preview.rows.every(r=>!r.email.includes('@')));assert.equal(processed.preview.rows[0].region,'서울');
  const resultId=processed.dataset.id;observations.processed={dataset_id:resultId,row_count:3,job_id:processed.job.id,review_id:review.review_id,policy_id:policy.id,policy_version:policy.version};
  cases.push('User-selected email mask executes in actual Worker with exact confirmed policy id/version; original remains preserved');

  await navigate('#data-lineage');await graphReady();let graph=(await state()).lineageGraph;
  assert.ok(graph.nodes.some(n=>n.dataset_id===rawId));assert.ok(graph.nodes.some(n=>n.dataset_id===resultId));assert.ok(graph.edges.some(e=>e.source==='dataset:'+rawId||e.target==='dataset:'+resultId));
  assert.equal(graph.nodes.some(n=>n.dataset?.layer==='mart'),false);assert.equal(graph.nodes.some(n=>n.type==='knowledge'),false);assert.equal(graph.coverage.query_history,'not_recorded');
  await screenshot('lineage-before-mart-and-use');cases.push('Persisted RAW and processing nodes connect; absent mart/KB/query history remains explicitly absent');

  const mart=await finish(await api('POST','datasets/'+resultId+'/mart',{token,body:{name:'리니지 검증 지역별 집계',group_by:['region'],metrics:[{column:'*',op:'count',name:'record_count'}]},status:202}),token);assert.ok(mart.dataset_id);
  const draft=await api('POST','kb/data-draft',{token,body:{department:'data',dataset_id:mart.dataset_id}});assert.equal(draft.state,'draft');
  const document=await api('POST','kb/review',{token,body:{department:'data',id:draft.id,version:draft.version,state:'confirmed',reason:'실제 가공결과의 행수와 출처를 확인했습니다.'}});
  const answer=await api('POST','kb/chat',{token,body:{department:'data',question:'이 가공 데이터의 처리 기준과 출처를 확인합니다.',exact_id:'DATASET-'+mart.dataset_id,generate:false}});assert.ok(answer.evidence.some(e=>e.id===document.id));
  const failed=await finish(await api('POST','datasets/'+resultId+'/mart',{token,body:{name:'리니지 검증 실패 집계',group_by:['missing_column'],metrics:[{column:'*',op:'count',name:'record_count'}]},status:202}),token,'failed');assert.equal(failed.dataset_id,null);
  observations.knowledge={document_id:document.id,version:document.version,evidence_ids:answer.evidence.map(e=>e.id)};observations.mart={dataset_id:mart.dataset_id,job_id:mart.id};observations.failure={job_id:failed.id,state:failed.state,error:failed.error,dataset_id:failed.dataset_id};

  await navigate('#data');await navigate('#data-lineage');await graphReady();graph=(await state()).lineageGraph;
  assert.ok(graph.nodes.some(n=>n.type==='knowledge'&&n.document_id===document.id));assert.ok(graph.nodes.some(n=>n.type==='usage'));assert.ok(graph.nodes.some(n=>n.dataset_id===mart.dataset_id));assert.ok(graph.nodes.some(n=>n.job_id===failed.id&&n.status==='failed'));
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));for(const edge of graph.edges){assert.ok(byId.has(edge.source));assert.ok(byId.has(edge.target))}
  const reachable=new Set(['dataset:'+rawId]);for(let i=0;i<graph.nodes.length;i++)for(const e of graph.edges)if(reachable.has(e.source))reachable.add(e.target);
  assert.ok(reachable.has('dataset:'+resultId));assert.ok(reachable.has('dataset:'+mart.dataset_id));assert.ok(reachable.has('knowledge:'+document.id));assert.ok(graph.nodes.some(n=>n.type==='usage'&&reachable.has(n.id)));
  const detail=await select('dataset:'+resultId);assert.ok(detail.includes(resultId));assert.match(detail,/3/);assert.ok(detail.includes(rawId));assert.ok(detail.includes(policy.id));assert.match(detail,/v1/);await screenshot('lineage-connected');
  const failedDetail=await select('job:'+failed.id);assert.match(failedDetail,/실패/);await screenshot('lineage-failure');
  await select('knowledge:'+document.id);assert.ok((await page.locator('#data-lineage-detail').innerText()).includes(document.id));
  const knowledgeAction=page.locator('[data-lineage-action=knowledge]');await knowledgeAction.click();await idle();assert.ok((await page.locator('#data-lineage-document').innerText()).includes(document.id));await screenshot('lineage-kb-document');await page.locator('[data-lineage-action=close-document]').click();await idle();
  await select('dataset:'+resultId);await page.locator('[data-lineage-action=dataset][data-dataset-id='+JSON.stringify(resultId)+']').click();await idle();assert.equal((await state()).dataset.id,resultId);assert.equal(new URL(page.url()).hash,'#data');
  await navigate('#data-lineage');await graphReady();await select('dataset:'+rawId);await page.locator('[data-lineage-action=dataset][data-dataset-id='+JSON.stringify(rawId)+']').click();await idle();assert.equal((await state()).preview.rows[0].email,'first@example.invalid');
  await navigate('#data-lineage');await graphReady();await page.locator('[data-lineage-department]').selectOption('app');await graphReady();assert.equal((await state()).lineageGraph.nodes.some(n=>n.type==='knowledge'||n.type==='usage'),false);await page.locator('[data-lineage-department]').selectOption('data');await graphReady();assert.ok((await state()).lineageGraph.nodes.some(n=>n.document_id===document.id));
  const first=page.locator('[data-lineage-node]').first();await first.focus();await first.press('End');assert.equal(await page.locator('[data-lineage-node]').last().getAttribute('aria-pressed'),'true');await page.locator('[data-lineage-node]').last().press('Home');assert.equal(await page.locator('[data-lineage-node]').first().getAttribute('aria-pressed'),'true');
  cases.push('Real RAW → processed dataset → grouped mart → KB provenance draft → confirmed document → non-generating evidence chat connects through directed persisted edges');
  cases.push('Real mart Worker success and invalid-column Worker failure appear with distinct outcomes; failed job has no result dataset');
  cases.push('Enter/Home/End select nodes, dataset actions open real RAW/result previews, KB action opens real document, department filter excludes other-department knowledge; detail exposes identifiers, row counts and source; compact full shell has zero overflow at 1280 and 390 pixels');

  const other=await api('POST','sessions',{body:{},status:201}),otherToken=other.access_token;
  const empty=await api('GET','lineage?department=data&include_company=false',{token:otherToken});assert.deepEqual(empty.nodes,[]);assert.deepEqual(empty.edges,[]);assert.equal(JSON.stringify(empty).includes(rawId),false);
  await api('GET','lineage?dataset_id='+rawId,{token:otherToken,status:404});await api('GET','datasets/'+resultId+'/preview',{token:otherToken,status:404});await api('POST','kb/document',{token:otherToken,body:{department:'data',id:document.id},status:404});
  const otherPage=await context.newPage();await otherPage.goto(origin+'/#data-lineage');await otherPage.evaluate(session=>{Object.assign(controller.getState(),{session});controller.destroy();controller.mount(document.querySelector('#page'),{section:'lineage'})},other);await otherPage.waitForFunction(()=>controller.getState().lineageGraph&&!controller.getState().busy);assert.equal(await otherPage.locator('[data-lineage-node]').count(),0);assert.equal((await otherPage.locator('#page').innerText()).includes(rawId),false);await otherPage.close();
  cases.push('Second visitor gets an empty graph and cannot read first visitor lineage filter, result preview or KB document (404)');
  const guards=await (await context.request.get(apiBase.replace(/\/data-platform$/,'')+'/test/provider-calls')).json();assert.ok(Object.values(guards).every(value=>value===0));assert.deepEqual(errors,[]);
  observations.graph=graph;
  const expectedScripts=[...fs.readFileSync(path.join(root,'src/index.html'),'utf8').matchAll(/<script[^>]+src="\.\/([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual([...loadedScripts].sort(),expectedScripts.sort(),'Every actual page script is served');assert.deepEqual(blockedRequests,[],'Full page must make no external or generation requests');
  cases.push('Every actual index script loads in production order; only local public config and a separate controller-reference hook differ; no external requests attempted');
  const report=JSON.stringify({passed:true,scope:'Actual full src/index.html and all production scripts with local public configuration and test-only controller-reference hook; real HTTP Router/Worker/SQLite; no API response substitutions',synthetic_input_values:true,apiResponsesSubstituted:false,fullPageScripts:true,loadedScripts:[...loadedScripts],providerCalls:guards,blockedRequests,cases,measurements,observations,traffic,errors},null,2)+'\n';
  assert.equal(report.includes(token),false,'First visitor token must not appear in evidence');assert.equal(report.includes(otherToken),false,'Second visitor token must not appear in evidence');assert.doesNotMatch(report,/access_token|Bearer /,'No credential field or authorization value is retained');
  fs.writeFileSync(path.join(output,'report.json'),report);
  console.log('PASS actual lineage API/browser integration: '+output);
 }catch(error){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(output,'failure.json'),redact(JSON.stringify({error:error.message,stack:error.stack,cases,measurements,observations,traffic,errors,blockedRequests},null,2))+'\n');throw error}
 finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(redact(error.stack||error.message));process.exitCode=1});
