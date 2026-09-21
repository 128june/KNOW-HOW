// Initial markup only: no API response fixtures, jobs, model calls, or browser layout claims.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const repo = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(repo, 'src/data-platform.js'), 'utf8');

function renderInitialIntake(script, aiRequestsPaused = true) {
  const calls = { fetch: 0, timers: 0 };
  const host = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const context = vm.createContext({
    window: { KNOWHOW_CONFIG: { aiRequestsPaused } },
    fetch() { calls.fetch++; throw Error('Initial rendering must not request API data'); },
    setTimeout() { calls.timers++; throw Error('Initial rendering must not schedule a job'); },
    clearTimeout() {}
  });
  vm.runInContext(script, context);
  const controller = context.window.KnowHowDataPlatform.createController();
  controller.mount(host, { section: 'intake' });
  return { html: host.innerHTML, state: controller.getState(), calls };
}

test('initial intake keeps the file action and does not start a session, request, or job', () => {
  for (const paused of [true, false]) {
    const rendered = renderInitialIntake(source, paused);
    assert.equal(rendered.state.method, 'file');
    assert.equal(rendered.state.session, null);
    assert.equal(rendered.state.dataset, null);
    assert.equal(rendered.state.job, null);
    assert.deepEqual(rendered.calls, { fetch: 0, timers: 0 });
    assert.match(rendered.html, /data-data-method="file" aria-pressed="true"/);
    assert.match(rendered.html, /name="source_file" type="file"/);
    assert.match(rendered.html, /data-data-action="ev-source"/);
  }
});
