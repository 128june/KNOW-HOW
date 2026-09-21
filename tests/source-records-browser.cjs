// Browser checks use only synthetic local fixtures; no organization API or AI calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const evidenceDir = process.env.SOURCE_RECORDS_EVIDENCE_DIR || path.join(root, 'tests', 'evidence', 'source-records');
  fs.mkdirSync(evidenceDir, {recursive:true});
  const server = http.createServer((req, res) => {
    if (req.url === '/source-records.js' || req.url === '/style.css') {
      res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css');
      res.end(fs.readFileSync(path.join(root, 'src', req.url.slice(1))));
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><title>원문 보존 브라우저 검증</title><main style="max-width:960px;margin:auto;padding:16px"><div id="sources"></div></main><script src="/source-records.js"></script><script>
      localStorage.setItem('knowhow.scenarios.v1', 'existing-scenario-sentinel');
      window.sourceStore = KnowHowSourceRecords.createStore();
      window.sourceView = KnowHowSourceRecords.mount(document.querySelector('#sources'), {store:sourceStore,department:'app'});
      window.networkAttempts = [];
      window.fetch = (...args) => {networkAttempts.push('fetch'); throw Error('Unexpected network');};
      window.XMLHttpRequest = class {constructor(){networkAttempts.push('xhr');throw Error('Unexpected network');}};
    </script></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {browser = await chromium.launch({headless:true, ...(fs.existsSync('/Applications/Google Chrome.app') ? {channel:'chrome'} : {})});}
  catch (error) {await new Promise(resolve => server.close(resolve)); throw error;}
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(await page.evaluate(() => sourceStore.listRecords().length), 0);
    await page.getByRole('button', {name:'업무 정책 원문 · 미리보기',exact:true}).click();
    assert.match(await page.locator('.source-record-detail').innerText(), /아직 입수하지 않음/);
    assert.equal(await page.evaluate(() => sourceStore.listRecords().length), 0, 'preview must not collect');
    await page.getByRole('button', {name:'샘플 원문 3종 입수하기',exact:true}).click();
    await page.getByRole('button', {name:'샘플 3종 입수됨 · 원문 다시 보기',exact:true}).waitFor();
    assert.equal(await page.evaluate(() => sourceStore.listRecords().length), 3);
    await page.evaluate(() => sourceView.openCitation(KnowHowSourceRecords.citationsFor({department:'device',category:'data'})[1]));
    assert.deepEqual(await page.locator('.source-line-selected').evaluateAll(nodes => nodes.map(node => Number(node.dataset.sourceLine))), [14,15,16,17]);
    assert.match(await page.locator('.source-record-detail').innerText(), /문단 4 · 14–17줄/);
    await page.evaluate(() => sourceView.openCitation(KnowHowSourceRecords.conflictCatalog()[0].citation));
    assert.match(await page.locator('.source-record-detail').innerText(), /오류 화면만 제출합니다/);
    await page.getByRole('button', {name:'이 샘플 원문 입수하기',exact:true}).click();
    assert.equal(await page.evaluate(() => sourceStore.listRecords().length), 4);
    await page.evaluate(() => sourceView.openCitation(KnowHowSourceRecords.conflictCatalog()[1].citation));
    assert.match(await page.locator('.source-record-detail').innerText(), /요청 시각과 오류코드를 반드시 제출합니다/);

    const rawText = '\uFEFF# 가상 검증 메모\r\n\r\n<script>window.sourceXss=true</script>\r\n담당자 확인 전 초안입니다.\r\n';
    const buffer = Buffer.from(rawText, 'utf8');
    await page.locator('input[type=file]').setInputFiles({name:'browser-check.md',mimeType:'text/markdown',buffer});
    await page.getByRole('button', {name:'선택한 파일을 읽고 초안 남기기',exact:true}).click();
    await page.locator('.source-record-draft').waitFor();
    const before = await page.evaluate(() => sourceStore.listRecords().find(record => !record.sample));
    assert.equal(before.rawText, rawText);
    assert.equal(before.sha256, require('node:crypto').createHash('sha256').update(buffer).digest('hex'));
    assert.equal(await page.evaluate(() => window.sourceXss), undefined);
    assert.equal(await page.locator('.source-record-raw').textContent(), rawText.replace(/\r\n/g, '\n'), 'HTML display normalizes newlines only; stored original remains exact');
    await page.locator('[data-source-form=revise] textarea').fill('원문을 검토한 별도 초안 v2');
    await page.locator('[data-source-form=revise] input').fill('검증을 위한 별도 초안 정정');
    await page.getByRole('button', {name:'새 초안 버전으로 남기기',exact:true}).click();
    await page.getByText('미확인 초안 · v2', {exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(id => sourceStore.getRecord(id), before.id), before);
    assert.equal(await page.evaluate(() => sourceStore.listDrafts()[0].versions.length), 2);
    await page.getByRole('button', {name:'초안의 원문 · 1–5줄',exact:true}).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name:'원본 파일 저장',exact:true}).click()]);
    assert.deepEqual(fs.readFileSync(await download.path()), buffer);
    await page.screenshot({path:path.join(evidenceDir, 'desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(evidenceDir, 'mobile.png'),fullPage:true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile page must not overflow');
    assert.equal(await page.evaluate(() => localStorage.getItem('knowhow.scenarios.v1')), 'existing-scenario-sentinel');
    assert.deepEqual(await page.evaluate(() => networkAttempts), []);
    assert.deepEqual(errors, []);
    await page.reload();
    assert.equal(await page.evaluate(() => sourceStore.listRecords().length), 0);
    assert.equal(await page.evaluate(() => sourceStore.listDrafts().length), 0);
    const report = {passed:true, checkedAt:new Date().toISOString(), cases:['explicit sample collection', 'uncollected source preview', 'department citation lines', 'both conflicting originals', 'browser TXT/MD import', 'BOM/CRLF exact hash and original download', 'HTML stays literal', 'separate draft correction', 'original unchanged', 'desktop/mobile rendering', 'no mobile overflow', 'no fetch/XHR', 'existing scenario storage unchanged', 'refresh clears memory'], screenshots:['desktop.png','mobile.png']};
    fs.writeFileSync(path.join(evidenceDir,'report.json'), JSON.stringify(report,null,2) + '\n');
    console.log(JSON.stringify(report,null,2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => {console.error(error);process.exitCode = 1;});
