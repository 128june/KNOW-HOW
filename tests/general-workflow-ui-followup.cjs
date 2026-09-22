/* Isolated UI regression checks; the fixture uses browser storage, no API or model calls. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.GENERAL_UI_URL||'http://127.0.0.1:18968';
const evidence=process.env.GENERAL_UI_EVIDENCE||'/tmp/general-ui-followup';
async function main(){
 fs.mkdirSync(evidence,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const page=await context.newPage(),errors=[],unexpected=[];
 page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==new URL(base).origin){unexpected.push(url.origin);return route.abort()}return route.continue()});
 await page.goto(base+'/#general-3');await page.locator('.gw-result').waitFor();
 assert.match(await page.locator('.gw-storage').innerText(),/브라우저 저장/);
 const pending=id=>page.locator(`[data-refund-id="${id}"] li`).evaluateAll(nodes=>nodes.map(node=>node.classList.contains('is-pending')));
 assert.deepEqual(await pending('R1'),[false,true,true,false],'v1 R1 operation/processor meanings remain unconfirmed');
 // Scenario 1: native modality, document scroll lock, exact source/row opener after full render.
 const source=page.locator('.gw-evidence [data-gw-action="source"]').first();
 const ref=await source.getAttribute('data-ref');
 await source.click();assert.equal(await page.locator('.gw-dialog').evaluate(el=>el.matches(':modal')),true);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden');
 const before=await page.evaluate(()=>scrollY);
 await page.mouse.move(3,3);await page.mouse.wheel(0,600);await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>scrollY),before,'background wheel must not scroll the page');
 assert.equal(await page.evaluate(()=>{document.querySelector('#gw-question').focus();return Boolean(document.activeElement.closest('.gw-dialog'))}),true,'native modal keeps background inert');
 for(let n=0;n<12;n++)await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest('.gw-dialog'))),true,'keyboard stays in dialog');
 await page.keyboard.press('Escape');await page.locator('.gw-dialog').waitFor({state:'detached'});
 assert.equal(await page.evaluate(ref=>{const active=document.activeElement;return Boolean(active.closest('.gw-evidence'))&&active.dataset.ref===ref},ref),true,'Escape restores exact source region and reference');
 assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('gw-modal-open')),false);
 const excludedRow=page.locator('.gw-excluded [data-gw-action="row"][data-row="PX"]');await excludedRow.click();
 await page.locator('.gw-dialog footer [data-gw-action="close"]').click();
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.row==='PX'&&Boolean(document.activeElement.closest('.gw-excluded'))),true,'button close restores PX opener rather than first ask');
 // Scenario 2: review draft and exact nested opener survive source/back/Escape.
 await page.locator('.gw-result-actions [data-gw-action="ask"]').click();
 await page.getByRole('button',{name:'부서 확인 요청 등록',exact:true}).click();
 const review=page.locator('[data-gw-action="review"]').first();await review.waitFor();const comment=await review.getAttribute('data-id');
 await review.click();
 const decision='검토 메모: 원결제 P1·환불 R1·100,000원과 10/3 완료시각을 대조했습니다.';
 await page.locator('.gw-dialog select[name="role"]').selectOption('서비스운영팀 결제운영 담당');
 await page.locator('.gw-dialog textarea[name="decision"]').fill(decision);
 await page.locator('.gw-dialog [name="evidence_checked"]').check();
 await page.locator('.gw-dialog [data-gw-action="source"]').click();
 await page.getByRole('button',{name:'담당 확인으로 돌아가기'}).click();
 assert.equal(await page.locator('.gw-dialog select[name="role"]').inputValue(),'서비스운영팀 결제운영 담당');
 assert.equal(await page.locator('.gw-dialog textarea[name="decision"]').inputValue(),decision);
 assert.equal(await page.locator('.gw-dialog [name="evidence_checked"]').isChecked(),true);
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.ref),'OPS-01:v2:3','back restores clicked source button');
 await page.keyboard.press('Enter');await page.locator('.gw-source-body').waitFor();await page.keyboard.press('Escape');
 assert.equal(await page.locator('.gw-dialog textarea[name="decision"]').inputValue(),decision);
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.ref),'OPS-01:v2:3');
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(id=>document.activeElement.dataset.gwAction==='review'&&document.activeElement.dataset.id===id,comment),true,'outer Escape restores exact review request');
 // Submit a verified review and ensure pending events stay pending after publication.
 await review.click();await page.locator('.gw-dialog select[name="role"]').selectOption('서비스운영팀 결제운영 담당');
 await page.locator('.gw-dialog [name="evidence_checked"]').check();await page.getByRole('button',{name:'담당 확인 기록 저장'}).click();
 await page.getByRole('button',{name:'확인된 기준을 KB v2로 발행'}).click();
 await page.getByRole('button',{name:'다음 담당자의 10월 질문으로 확인'}).click();
 await page.locator('.gw-answer-summary').filter({hasText:'100,000'}).waitFor();
 assert.deepEqual(await pending('R1'),[false,false,false,false],'v2 confirmed R1 evidence is complete');
 assert.deepEqual(await pending('R2'),[false,true,true,true],'v2 R2 operation, PG and settlement remain pending');
 assert.match(await page.locator('[data-refund-id="R2"]').innerText(),/결제사 접수 대기/);
 await page.locator('[data-refund-id="R2"]').screenshot({path:evidence+'/r2-pending-v2.png'});
 // Scenario 3: mobile native modal size/scroll, route unmount releases modal and lock.
 await page.setViewportSize({width:390,height:844});
 await page.locator('.gw-basis [data-gw-action="source"]').first().click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const rect=await page.locator('.gw-dialog').boundingBox();assert(rect.x>=0&&rect.x+rect.width<=390&&rect.y>=0&&rect.y+rect.height<=844);
 await page.screenshot({path:evidence+'/source-dialog-mobile.png'});
 await page.evaluate(()=>location.hash='#general-2');await page.locator('.gw-relationship-map').waitFor();
 assert.equal(await page.locator('.gw-dialog').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('gw-modal-open')),false,'unmount removes scroll lock');
 assert.equal(await page.evaluate(()=>{document.querySelector('#gw-question').focus();return document.activeElement.id==='gw-question'}),true,'unmount releases native inertness');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 const report={passed:true,checks:['R1 v1 / R1 v2 / R2 v2 evidence states','native inertness, background scroll lock, exact source and row return','review role/decision/checkbox and source/back/Escape focus preservation','mobile dialog fit and route-unmount unlock'],pageErrors:errors,externalRequests:unexpected};
 fs.writeFileSync(evidence+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
}
main().catch(error=>{console.error(error);process.exitCode=1});
