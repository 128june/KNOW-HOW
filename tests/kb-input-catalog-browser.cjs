'use strict';
// Same canonical reader -> KB map -> full input catalogs. Isolated browser fixture, no model calls.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const copy=x=>JSON.parse(JSON.stringify(x));
const fields=['symptoms','errors','app_os','app_versions','app_actions','device_states'];
const guide={id:'INTAKE-001',title:'민원 입력 원문 목록',department:'counselor',version:2,purpose:'고객이 확인한 값만 선택',status:'시연용 입력 기준 · 실제 검토 전',source:'synthetic-input-fixture.json',hash:'a'.repeat(64),sections:[{id:'scope',title:'입력 안내',text:'원문의 확인 범위를 보존한다.'}],catalogs:Object.fromEntries(fields.map((field,i)=>[field,[{id:field+'-original',label:'원문 표제 '+i,value:'원문 값 '+i+'\n<확인> & "보존"',description:'설명 '+i,ask:'확인할 원문 '+i,input_mode:'select',demo:true,...(i===0?{related:[{catalog:'errors',id:'errors-original'}]}:{})},{id:field+'-unknown',label:'미확인',value:'',input_mode:'unknown'},{id:field+'-custom',label:'직접 입력',value:'',input_mode:'custom'}]])),catalog_meta:Object.fromEntries(fields.map(field=>[field,{title:field+' 원문 항목',description:field+' 범위',ask:field+' 확인 질문'}])),comparison:{label:'비교용 연결',meaning:'comparison_only',description:'원문의 연결은 동일 원인 확정을 뜻하지 않습니다.',auto_select:false}};
async function main(){
 const server=http.createServer((req,res)=>{const file=req.url.split('?')[0];if(file==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><main id="map"></main>');}if(!['/src/kb-lineage.js','/src/kb-catalog.js','/src/kb-lineage.css','/src/style.css','/src/shell.css'].includes(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(root,file)));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(!r.request().url().startsWith(origin)){external.push(r.request().url());return r.abort();}return r.continue();});
 try{
  await page.goto(origin);await page.addStyleTag({url:origin+'/src/style.css'});await page.addStyleTag({url:origin+'/src/shell.css'});await page.addStyleTag({url:origin+'/src/kb-lineage.css'});
  await page.evaluate(guide=>{window.original=guide;window.docs=[structuredClone(guide)];window.KnowHowSupport={readKnowledge:async()=>structuredClone(window.docs)};window.KNOWHOW_CONFIG={apiBase:location.origin+'/knowhow'};},copy(guide));
  await page.addScriptTag({url:origin+'/src/kb-catalog.js'});await page.addScriptTag({url:origin+'/src/kb-lineage.js'});
  await page.evaluate(()=>{window.provider=KnowHowKBCatalog.createProvider({general:{ready:async()=>{},docs:()=>[{id:'excluded-general',versions:[{version:1,content:'범위 제외'}]}]}});KnowHowKBLineage.createController({provider}).mount(document.querySelector('#map'));});
  await page.locator('[data-kb-key="support:INTAKE-001"]').click();await page.locator('#kb-detail-title').waitFor();
  assert.equal(await page.locator('[data-kb-catalog]').count(),6);
  for(const [field,options] of Object.entries(guide.catalogs)){
   const group=page.locator('[data-kb-catalog="'+field+'"]');
   // Disclosures remain keyboard accessible and can be opened to read every original row.
   if(await group.evaluate(el=>el.tagName==='DETAILS'&&!el.open))await group.locator(':scope > summary').press('Enter');
   const text=await group.textContent();assert.ok(text.includes(guide.catalog_meta[field].title));
   for(const option of options){const row=group.locator('[data-kb-catalog-option="'+option.id+'"]');assert.equal(await row.count(),1);const raw=await row.textContent();for(const key of ['id','label','value','description','ask'])if(option[key])assert.ok(raw.includes(option[key]),field+' '+key+' preserves original text');}
  }
  assert.equal(await page.locator('#kb-reading-panel script').count(),0);
  assert.deepEqual(await page.evaluate(()=>docs[0]),guide,'rendering must not modify canonical source');
  const mapped=await page.evaluate(()=>provider.detail('support:INTAKE-001'));
  assert.deepEqual(mapped.catalogs,guide.catalogs);assert.deepEqual(mapped.catalog_meta,guide.catalog_meta);assert.equal(mapped.hash,guide.hash);
  assert.ok((await page.locator('#kb-reading-panel').textContent()).includes(guide.source));
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const comparison=await page.locator('.kb-catalog-comparison').evaluate(el=>({position:getComputedStyle(el).position,visibility:getComputedStyle(el).visibility,height:el.getBoundingClientRect().height}));assert.equal(comparison.position,'static');assert.equal(comparison.visibility,'visible');assert.ok(comparison.height<350,'comparison must not inherit full-height navigation styles');if(process.env.KB_CATALOG_EVIDENCE_DIR){fs.mkdirSync(process.env.KB_CATALOG_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.KB_CATALOG_EVIDENCE_DIR,'catalog-'+width+'.png'),fullPage:true});}}
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{docs[0].version=3;docs[0].hash='b'.repeat(64);docs[0].catalogs.symptoms[0].value='정정된 원문 v3';});
  await page.locator('[data-kb-refresh]').click();await page.locator('[data-kb-key="support:INTAKE-001"]').click();await page.locator('#kb-detail-title').waitFor();
  assert.ok((await page.locator('[data-kb-catalog-option="symptoms-original"]').textContent()).includes('정정된 원문 v3'));
  assert.match(await page.locator('.kb-detail-heading').textContent(),/v3/);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log(JSON.stringify({passed:true,catalog_fields:6,original_options:18,checks:['same canonical source and hash','all option IDs and complete text','HTML and newline preservation','refresh to new version','desktop/mobile overflow','zero external or model calls']}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
