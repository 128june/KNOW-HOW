// Browser contract fixtures only. No external sources, account credentials, or AI calls.
// Run with Playwright available in NODE_PATH; Chrome is used on macOS when installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const evidenceDir = process.env.DATA_HANDOFF_EVIDENCE_DIR || path.join(os.tmpdir(), 'know-how-data-handoff');
const dataset = { id: 'ev-fixture', name: '충전기 원본 · 로컬 테스트 자료' };
const source = { original_url: 'https://example.test/public-chargers.xlsx', fetched_at: '2026-09-21T00:00:00Z', source_sha256: 'server-fixture' };
const rows = [1, 2, 3, 4].map(number => ({ row_number: number, station: { name: `GS타워 ${number}`, address: '서울특별시 강남구 논현로 508', operator: '공개 운영기관' }, public_charger_id: `PUBLIC-${number}`, fields: { 원본충전소명: `GS타워 ${number}`, 원본행: number } }));
const completedCases = [];

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : fs.existsSync('/Applications/Google Chrome.app') ? { channel: 'chrome' } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    await page.setContent('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><main class="data-workspace"><p>부서 연결 UI 로컬 fixture 검증</p><div id="handoff-host"></div></main></body></html>');
    await page.addStyleTag({ path: path.join(root, 'src/style.css') });
    await page.addStyleTag({ path: path.join(root, 'src/data-platform.css') });
    await page.addStyleTag({ content: 'body{margin:0;padding:20px}.data-workspace{margin:auto}' });
    await page.addScriptTag({ path: path.join(root, 'src/data-handoff-ui.js') });

    async function reset(options = {}) {
      await page.evaluate(({ dataset, initialQuery }) => {
        window.handoffController?.unmount();
        window.calls = []; window.replies = []; window.pending = {}; window.handoffs = []; window.forwardedExactly = false;
        window.handoffController = window.KnowHowDataHandoffUI.createController({
          request: async (route, options) => {
            window.calls.push({ route, options });
            const reply = window.replies.shift();
            if (!reply) throw Error('테스트 응답이 없습니다.');
            if (reply.kind === 'error') throw Error(reply.message);
            if (reply.kind === 'defer') return new Promise(resolve => { window.pending[reply.key] = resolve; });
            if (route.endsWith('/station-contexts')) window.lastServerContext = reply.value;
            return reply.value;
          },
          onHandoff: context => { window.forwardedExactly = context === window.lastServerContext; window.handoffs.push(context); }
        });
        window.handoffController.mount(document.querySelector('#handoff-host'), { dataset, initialQuery });
      }, { dataset: options.dataset || dataset, initialQuery: options.initialQuery });
    }
    const queue = value => page.evaluate(value => { window.replies.push({ value }); }, value);
    const idle = () => page.waitForFunction(() => !window.handoffController.getState().busy);
    async function open() { if (!await page.locator('[data-handoff-panel]').evaluate(element => element.open)) await page.locator('[data-handoff-panel]>summary').click(); }
    async function search(resultRows = rows, query = 'GS타워') {
      await open(); await queue({ rows: resultRows, source, total: resultRows.length });
      await page.locator('[data-handoff-query]').fill(query);
      await page.locator('[data-handoff-search] button').click(); await idle();
    }
    async function select(rowNumbers = [1], department = 'app') {
      for (const row of rowNumbers) await page.locator(`[data-handoff-row="${row}"]`).check();
      await page.locator('[data-handoff-department]').selectOption(department);
    }
    const contextValue = (rowNumbers = [1], department = 'app') => ({ context_id: 'server-context-fixture', dataset_id: dataset.id, department, station: rows[0].station, records: rows.filter(row => rowNumbers.includes(row.row_number)), source, expires_at: Date.now() + 600000 });

    await reset();
    assert.equal(await page.locator('[data-handoff-query]').inputValue(), 'GS타워');
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await open(); await page.locator('[data-handoff-query]').fill('강남');
    assert.equal(await page.evaluate(() => window.calls.length), 0, 'mount, opening and typing must never fetch');
    await reset({ initialQuery: '서울 GS타워' });
    assert.equal(await page.locator('[data-handoff-query]').inputValue(), '서울 GS타워');
    completedCases.push('No automatic requests; explicit initial query');

    await search();
    assert.deepEqual(await page.evaluate(() => window.calls[0]), { route: '/datasets/ev-fixture/station-search', options: { method: 'POST', body: { q: 'GS타워', offset: 0, limit: 20 } } });
    assert.equal(await page.locator('.data-handoff-row').count(), 4);
    assert.match(await page.locator('.data-handoff-row').first().innerText(), /GS타워 1/);
    assert.match(await page.locator('.data-handoff-row').first().innerText(), /서울특별시 강남구/);
    assert.match(await page.locator('.data-handoff-row').first().innerText(), /공개 운영기관/);
    assert.match(await page.locator('.data-handoff-row').first().innerText(), /PUBLIC-1/);
    assert.match(await page.locator('.data-handoff-results').innerText(), /내부 충전기 ID는 미확인/);
    assert.equal(await page.locator('[data-handoff-submit]').isDisabled(), true);
    await select([1, 2, 3], 'device');
    assert.equal(await page.locator('[data-handoff-row="4"]').isDisabled(), true);
    assert.equal(await page.evaluate(() => window.calls.length), 1, 'selection and department choices must not request');
    await page.locator('[data-handoff-row="4"]').evaluate(element => { element.checked = true; element.dispatchEvent(new Event('change', { bubbles: true })); });
    assert.deepEqual(await page.evaluate(() => window.handoffController.getState().selected), [1, 2, 3]);
    assert.match(await page.locator('[data-handoff-error]').innerText(), /최대 3개/);
    await page.locator('[data-handoff-row="3"]').uncheck();
    assert.equal(await page.locator('[data-handoff-row="4"]').isDisabled(), false);
    await page.locator('[data-handoff-row="3"]').check();
    completedCases.push('Server search rows and public IDs; maximum three selections and explicit department');

    const verifiedContext = contextValue([1, 2, 3], 'device');
    await queue(verifiedContext); await page.locator('[data-handoff-submit]').click(); await idle();
    assert.deepEqual(await page.evaluate(() => window.calls[1]), { route: '/datasets/ev-fixture/station-contexts', options: { method: 'POST', body: { row_numbers: [1, 2, 3], department: 'device' } } });
    assert.equal(await page.evaluate(() => window.forwardedExactly), true, 'pass the exact server context object, without building a client claim');
    assert.deepEqual(await page.evaluate(() => window.handoffs), [verifiedContext]);
    completedCases.push('Context request includes only row numbers and department; exact verified response forwarded');

    await reset(); await search([]);
    assert.match(await page.locator('.data-handoff-empty').innerText(), /조건에 맞는 충전기가 없습니다/);
    assert.equal(await page.locator('[data-handoff-submit]').count(), 0);
    assert.equal(await page.evaluate(() => window.handoffs.length), 0);
    completedCases.push('Zero results have no selectable or handoff action');

    await reset(); await open();
    await page.evaluate(() => window.replies.push({ kind: 'error', message: '원본 자료의 보관 기간이 끝났습니다.' }));
    await page.locator('[data-handoff-search] button').click(); await idle();
    assert.match(await page.locator('[data-handoff-error]').innerText(), /보관 기간이 끝났습니다/);
    assert.equal(await page.locator('[data-handoff-query]').inputValue(), 'GS타워');
    assert.equal(await page.locator('[data-handoff-search] button').isDisabled(), false);
    await search(); await select();
    await page.evaluate(() => window.replies.push({ kind: 'error', message: '같은 충전소의 행을 선택해 주세요.' }));
    await page.locator('[data-handoff-submit]').click(); await idle();
    assert.match(await page.locator('[data-handoff-error]').innerText(), /같은 충전소/);
    assert.equal(await page.evaluate(() => window.handoffs.length), 0);
    assert.equal(await page.locator('[data-handoff-submit]').isDisabled(), false);
    completedCases.push('Search and handoff errors are visible and retryable');

    for (const invalid of [
      { dataset_id: 'different-dataset' }, { department: 'device' }, { expires_at: 1 },
      { context_id: '' }, { source: null }, { records: [rows[3]] }
    ]) {
      await reset(); await search(); await select();
      await queue({ ...contextValue(), ...invalid }); await page.locator('[data-handoff-submit]').click(); await idle();
      assert.equal(await page.evaluate(() => window.handoffs.length), 0);
      assert.equal(await page.locator('[data-handoff-error]').isVisible(), true);
    }
    completedCases.push('Mismatched, expired, missing-source and wrong-row contexts never reach the callback');

    await reset(); await open();
    await page.evaluate(() => window.replies.push({ kind: 'defer', key: 'old-search' }));
    await page.locator('[data-handoff-search] button').click();
    await page.waitForFunction(() => !!window.pending['old-search']);
    await page.evaluate(({ rows, source }) => {
      window.handoffController.unmount();
      window.handoffController.mount(document.querySelector('#handoff-host'), { dataset: { id: 'new-dataset', name: '새 자료' }, initialQuery: '새 검색' });
      window.pending['old-search']({ rows, source, total: rows.length });
    }, { rows, source });
    await idle();
    assert.equal(await page.locator('.data-handoff-row').count(), 0);
    assert.equal(await page.locator('[data-handoff-query]').inputValue(), '새 검색');
    assert.equal(await page.evaluate(() => window.handoffController.getState().page), null);
    completedCases.push('Stale search after unmount and dataset change cannot overwrite the current view');

    await reset(); await search(); await select();
    await page.evaluate(() => window.replies.push({ kind: 'defer', key: 'old-context' }));
    await page.locator('[data-handoff-submit]').click();
    await page.waitForFunction(() => !!window.pending['old-context']);
    await page.evaluate(context => {
      window.handoffController.unmount();
      window.handoffController.mount(document.querySelector('#handoff-host'), { dataset: { id: 'new-dataset', name: '새 자료' } });
      window.pending['old-context'](context);
    }, contextValue());
    await idle();
    assert.equal(await page.evaluate(() => window.handoffs.length), 0);
    assert.equal(await page.evaluate(() => window.handoffController.getState().dataset.id), 'new-dataset');
    completedCases.push('Stale context response cannot trigger a department handoff');

    await reset(); await open();
    await queue({ rows: [{ ...rows[0], row_number: 'client-row' }], source, total: 1 });
    await page.locator('[data-handoff-search] button').click(); await idle();
    assert.equal(await page.locator('.data-handoff-row').count(), 0);
    assert.match(await page.locator('[data-handoff-error]').innerText(), /원본 행과 출처/);
    completedCases.push('Invalid server row numbers cannot become selectable records');

    const hostile = '<img src=x onerror="window.handoffInjected=true">';
    await reset();
    const longRows = [{ ...rows[0], station: { name: hostile + '매우긴충전소명'.repeat(12), address: '서울특별시강남구'.repeat(20), operator: hostile }, public_charger_id: 'PUBLIC-'.repeat(30), fields: { [hostile]: hostile } }];
    await search(longRows); await page.locator('.data-handoff-raw>summary').click();
    assert.equal(await page.locator('.data-handoff-row img').count(), 0);
    assert.equal(await page.evaluate(() => !!window.handoffInjected), false);
    fs.mkdirSync(evidenceDir, { recursive: true });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, cards: [...document.querySelectorAll('.data-handoff-row')].map(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })) }));
      assert.equal(layout.document, layout.viewport, `no page overflow at ${width}px`);
      assert.ok(layout.cards.every(card => card.left >= 0 && card.right <= width));
      await page.screenshot({ path: path.join(evidenceDir, `handoff-${width}.png`), fullPage: true });
    }
    completedCases.push('Escaped server fields and source-safe display; no overflow at 1280px or 390px');
    console.log(`PASS: ${completedCases.length} data handoff UI cases\n${completedCases.map(name => '- ' + name).join('\n')}\nEvidence: ${evidenceDir}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
