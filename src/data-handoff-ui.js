/* Explicit server-row selection for a department handoff. No fetches or token storage. */
(function (root) {
  'use strict';

  /*
   * request(path, { method: 'POST', body }) is provided by the parent. It owns
   * the visitor route prefix and authentication; this module never sees them.
   * mount(target, { dataset, initialQuery }) never requests data automatically.
   * Search: POST /datasets/:id/station-search { q, offset: 0, limit: 20 }.
   * Confirm: POST /datasets/:id/station-contexts { row_numbers, department }.
   * The complete, validated server response is passed unchanged to onHandoff.
   */
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const text = value => value == null || value === '' ? '미제공' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const count = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('ko-KR') : '미제공';
  const departments = { app: '앱 부서', device: '디바이스 부서' };
  const validRow = value => Number.isSafeInteger(value) && value >= 0;

  function createController({ request, onHandoff } = {}) {
    if (typeof request !== 'function' || typeof onHandoff !== 'function') throw new TypeError('자료 요청과 부서 연결 함수를 설정해 주세요.');
    let host = null;
    let epoch = 0;
    const state = { dataset: null, query: 'GS타워', page: null, selected: [], department: '', busy: false, pending: '', open: false, error: '', notice: '' };
    const current = (ticket, datasetId) => !!host && epoch === ticket && String(state.dataset?.id) === datasetId;
    const path = suffix => '/datasets/' + encodeURIComponent(state.dataset.id) + suffix;

    function capture() {
      if (!host) return;
      const query = host.querySelector('[data-handoff-query]');
      if (query) state.query = query.value;
      const department = host.querySelector('[data-handoff-department]');
      if (department) state.department = department.value;
      const details = host.querySelector('[data-handoff-panel]');
      if (details) state.open = details.open;
    }
    function focus(selector) { host?.querySelector(selector)?.focus({ preventScroll: true }); }
    function sourceMarkup() {
      const source = state.page?.source;
      if (!source) return '';
      const label = typeof source === 'string' ? source : source.original_url || source.url || source.name;
      return label ? `<p class="data-handoff-source">서버가 확인한 출처 · ${esc(label)}</p>` : '<p class="data-handoff-source">검색한 원본의 출처 기록을 함께 전달합니다.</p>';
    }
    function rowMarkup(row) {
      const chosen = state.selected.includes(row.row_number);
      const station = row.station || {};
      const fields = row.fields && typeof row.fields === 'object' ? Object.entries(row.fields) : [];
      return `<article class="data-handoff-row${chosen ? ' is-selected' : ''}">
        <label class="data-handoff-choice"><input type="checkbox" data-handoff-row="${row.row_number}" ${chosen ? 'checked' : ''} ${state.busy || (!chosen && state.selected.length >= 3) ? 'disabled' : ''}><span><strong>${esc(text(station.name))}</strong><small>원본 ${count(row.row_number)}행</small></span></label>
        <dl class="data-handoff-fields"><div><dt>주소</dt><dd>${esc(text(station.address))}</dd></div><div><dt>운영기관</dt><dd>${esc(text(station.operator))}</dd></div><div><dt>공개 충전기 ID</dt><dd>${esc(text(row.public_charger_id))}</dd></div></dl>
        ${fields.length ? `<details class="data-handoff-raw"><summary>원본 행 보기</summary><dl class="data-handoff-fields">${fields.map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(text(value))}</dd></div>`).join('')}</dl></details>` : ''}
      </article>`;
    }
    function render() {
      if (!host) return;
      const rows = state.page?.rows || [];
      const enabled = !!state.dataset?.id;
      host.innerHTML = `<details class="data-handoff" data-handoff-panel ${state.open ? 'open' : ''}>
        <summary>선택한 충전기를 부서 확인으로 이어가기</summary>
        <div class="data-handoff-content"><p>원본에서 충전기를 찾아 최대 3개 행을 선택하고 확인할 부서를 지정하세요.</p>
          ${enabled ? `<p class="data-handoff-dataset">선택한 자료 · ${esc(state.dataset.name || '입수한 충전기 자료')}</p>` : '<p class="data-handoff-empty">저장된 충전기 자료를 먼저 선택하세요.</p>'}
          <form data-handoff-search class="data-handoff-search"><label>충전소명·주소·운영기관 검색<input data-handoff-query name="q" type="search" value="${esc(state.query)}" maxlength="200" placeholder="예: GS타워" required ${state.busy || !enabled ? 'disabled' : ''}></label><button type="submit" class="primary" ${state.busy || !enabled ? 'disabled' : ''}>충전기 검색</button></form>
          <p class="data-handoff-notice" role="status" data-handoff-status tabindex="-1">${state.busy ? state.pending === 'search' ? '저장된 원본에서 충전기를 찾고 있습니다…' : '선택한 원본 행과 전달 정보를 서버에서 확인하고 있습니다…' : esc(state.notice)}</p>
          <p class="notice data-handoff-error" role="alert" data-handoff-error ${state.error ? '' : 'hidden'}>${esc(state.error)}</p>
          ${state.page ? `<div class="data-handoff-results"><h3>검색 결과 · 전체 ${count(state.page.total)}건</h3>${rows.length ? `<p class="muted">${count(rows.length)}개 행 표시${state.page.total > rows.length ? ' · 찾는 충전기가 없으면 검색어를 구체적으로 입력하세요.' : ''}</p><p class="muted">공개 충전기 ID이며 내부 충전기 ID는 미확인입니다.</p><div class="data-handoff-list">${rows.map(rowMarkup).join('')}</div>` : '<p class="data-handoff-empty">조건에 맞는 충전기가 없습니다. 충전소명이나 주소를 바꿔 다시 검색하세요.</p>'}${sourceMarkup()}</div>` : ''}
          ${rows.length ? `<div class="data-handoff-confirm"><p data-handoff-selected>${count(state.selected.length)} / 3개 행 선택</p><label>확인할 부서<select data-handoff-department ${state.busy ? 'disabled' : ''}><option value="">부서를 선택하세요</option>${Object.entries(departments).map(([value, name]) => `<option value="${value}" ${state.department === value ? 'selected' : ''}>${name}</option>`).join('')}</select></label><button type="button" class="primary" data-handoff-submit ${state.busy || !state.selected.length || !departments[state.department] ? 'disabled' : ''}>선택한 충전기로 부서 확인 이어가기</button><p class="muted">서버가 원본 행을 확인한 뒤 선택한 부서 화면으로 이어갑니다.</p></div>` : ''}
        </div>
      </details>`;
      bind();
    }
    function bind() {
      const details = host.querySelector('[data-handoff-panel]');
      if (details) details.ontoggle = () => { if (host?.contains(details)) state.open = details.open; };
      const query = host.querySelector('[data-handoff-query]');
      if (query) query.oninput = () => { state.query = query.value; };
      const form = host.querySelector('[data-handoff-search]');
      if (form) form.onsubmit = event => { event.preventDefault(); void search(); };
      host.querySelectorAll('[data-handoff-row]').forEach(input => {
        input.onchange = () => {
          if (state.busy) return;
          capture();
          const row = Number(input.dataset.handoffRow);
          if (!state.page?.rows.some(item => item.row_number === row)) return;
          if (input.checked && !state.selected.includes(row)) {
            if (state.selected.length >= 3) state.error = '최대 3개 행까지 선택할 수 있습니다.';
            else { state.selected.push(row); state.error = ''; }
          } else if (!input.checked) { state.selected = state.selected.filter(value => value !== row); state.error = ''; }
          state.notice = state.selected.length === 3 ? '3개 행을 선택했습니다. 다른 행을 고르려면 먼저 선택을 해제하세요.' : `${state.selected.length}개 행을 선택했습니다.`;
          render(); focus(`[data-handoff-row="${row}"]`);
        };
      });
      const department = host.querySelector('[data-handoff-department]');
      if (department) department.onchange = () => { if (state.busy) return; capture(); state.error = ''; render(); focus('[data-handoff-department]'); };
      const submit = host.querySelector('[data-handoff-submit]');
      if (submit) submit.onclick = () => { void handoff(); };
    }
    async function search() {
      if (!host || state.busy) return;
      capture();
      const q = state.query.trim();
      if (!state.dataset?.id || !q || q.length > 200) {
        state.error = !state.dataset?.id ? '저장된 자료를 먼저 선택하세요.' : '검색어를 1~200자로 입력해 주세요.';
        render(); focus('[data-handoff-query]'); return;
      }
      const ticket = epoch, datasetId = String(state.dataset.id);
      Object.assign(state, { busy: true, pending: 'search', error: '', notice: '', page: null, selected: [], open: true });
      render();
      try {
        const response = await request(path('/station-search'), { method: 'POST', body: { q, offset: 0, limit: 20 } });
        if (!current(ticket, datasetId)) return;
        if (!response || !Array.isArray(response.rows) || response.rows.length > 20 || !Number.isSafeInteger(response.total) || response.total < response.rows.length || !response.source || response.rows.some(row => !row || !validRow(row.row_number)) || new Set(response.rows.map(row => row.row_number)).size !== response.rows.length) throw Error('검색 결과의 원본 행과 출처를 확인하지 못했습니다. 다시 검색해 주세요.');
        state.page = response;
        state.notice = `${response.rows.length}개 원본 행을 확인했습니다.`;
      } catch (error) {
        if (current(ticket, datasetId)) state.error = error?.message || '충전기를 검색하지 못했습니다. 다시 시도해 주세요.';
      } finally {
        if (current(ticket, datasetId)) { state.busy = false; state.pending = ''; render(); focus(state.error ? '[data-handoff-query]' : '[data-handoff-status]'); }
      }
    }
    async function handoff() {
      if (!host || state.busy) return;
      capture();
      const selected = [...state.selected], department = state.department;
      if (!state.dataset?.id || selected.length < 1 || selected.length > 3 || !departments[department] || selected.some(row => !state.page?.rows.some(item => item.row_number === row))) {
        state.error = '검색 결과에서 1~3개 행과 확인할 부서를 선택하세요.'; render(); focus('[data-handoff-error]'); return;
      }
      const ticket = epoch, datasetId = String(state.dataset.id);
      Object.assign(state, { busy: true, pending: 'handoff', error: '', notice: '', open: true }); render();
      try {
        const response = await request(path('/station-contexts'), { method: 'POST', body: { row_numbers: selected, department } });
        if (!current(ticket, datasetId)) return;
        const expiry = typeof response?.expires_at === 'number' ? (response.expires_at < 1e12 ? response.expires_at * 1000 : response.expires_at) : Date.parse(response?.expires_at);
        if (!response || typeof response.context_id !== 'string' || !response.context_id || String(response.dataset_id) !== datasetId || response.department !== department || !response.station || !Array.isArray(response.records) || response.records.length !== selected.length || !response.source || !Number.isFinite(expiry) || expiry <= Date.now()) throw Error('서버의 부서 전달 확인 결과가 올바르지 않거나 만료되었습니다. 다시 시도해 주세요.');
        if (response.records.some(record => !validRow(record?.row_number)) || new Set(response.records.map(record => record.row_number)).size !== selected.length || response.records.some(record => !selected.includes(record.row_number))) throw Error('서버가 확인한 원본 행이 선택한 행과 다릅니다. 다시 검색해 주세요.');
        await onHandoff(response);
        if (current(ticket, datasetId)) state.notice = '서버가 확인한 충전기 자료를 부서 확인 화면에 전달했습니다.';
      } catch (error) {
        if (current(ticket, datasetId)) state.error = error?.message || '부서 확인으로 이어가지 못했습니다. 다시 시도해 주세요.';
      } finally {
        if (current(ticket, datasetId)) { state.busy = false; state.pending = ''; render(); focus(state.error ? '[data-handoff-submit]' : '[data-handoff-status]'); }
      }
    }
    return {
      mount(target, { dataset, initialQuery } = {}) {
        capture(); epoch++; host = target;
        if (String(state.dataset?.id) !== String(dataset?.id)) Object.assign(state, { query: initialQuery == null || initialQuery === '' ? 'GS타워' : String(initialQuery), page: null, selected: [], department: '', open: false, error: '', notice: '' });
        state.dataset = dataset || null; state.busy = false; state.pending = ''; render();
      },
      unmount() { capture(); epoch++; host = null; state.busy = false; state.pending = ''; },
      getState: () => ({ ...state, selected: [...state.selected] })
    };
  }
  root.KnowHowDataHandoffUI = Object.freeze({ createController });
})(window);
