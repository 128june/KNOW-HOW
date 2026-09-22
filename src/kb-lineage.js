/* A read-only map of the same KB documents used by the knowledge workspace. */
(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const teams = {counselor:'상담사', app:'앱개발팀', device:'충전기개발팀', finance:'재무팀', data:'데이터팀', operations:'고객운영팀'};
  const fallbackCollections = [{id:'support',label:'충전 민원 대응'}, {id:'general',label:'매출·고객·환불'}];
  function createController({provider} = {}) {
    let host = null, epoch = 0, selectionEpoch = 0;
    const state = {documents:[], collections:fallbackCollections, notices:[], selected:null, detail:null, loading:false, detailLoading:false, error:'', detailError:'', modalOpen:false};
    const department = d => d.departmentLabel || teams[d.department] || d.department || '담당 부서 미등록';
    const version = d => d.version == null ? '버전 미등록' : 'v' + d.version;
    function node(d) {
      return `<li><button class="kb-map-node" data-kb-key="${esc(d.key)}" aria-haspopup="dialog" aria-expanded="${state.modalOpen && d.key === state.selected}" aria-controls="kb-detail-modal"><span class="kb-node-team">${esc(department(d))}<span aria-hidden="true">↗</span></span><strong>${esc(d.title)}</strong><span class="kb-node-meta">${esc(d.id)} <span>· ${esc(version(d))}</span></span><span class="kb-node-origin">${esc(d.originLabel || d.kindLabel || '')}</span></button></li>`;
    }
    function graph() {
      const collections = state.collections.length ? state.collections : fallbackCollections;
      return `<div class="kb-map-root"><span class="kb-root-symbol" aria-hidden="true">K</span><span><strong>지식 플랫폼</strong><small>${state.loading ? 'KB 불러오는 중' : state.documents.length + '개 KB · ' + collections.length + '개 업무'}</small></span></div><div class="kb-map-branches">${collections.map((c,i) => {
        const docs = state.documents.filter(d => d.collection === c.id);
        return `<section class="kb-map-collection" aria-label="${esc(c.label)}"><h2><span>0${i+1}</span>${esc(c.label)}<small>${docs.length}</small></h2><ul class="kb-map-documents">${docs.map(node).join('')}</ul>${!docs.length ? `<p class="kb-map-empty">${esc(state.loading ? 'KB 목록을 읽고 있습니다.' : c.error || '표시할 KB가 없습니다.')}</p>` : ''}</section>`;
      }).join('')}</div>`;
    }
    function source(d) {
      const s = d.source;
      const raw = typeof s === 'string' ? s : s ? JSON.stringify(s,null,2) : '';
      return `<details class="kb-detail-record"><summary>출처와 기록 정보</summary><dl class="kb-detail-meta"><div><dt>문서 구분</dt><dd>${esc(d.kindLabel || d.originLabel || '미등록')}</dd></div>${d.validFrom || d.validTo ? `<div><dt>적용 기간</dt><dd>${esc(d.validFrom || '시작일 미등록')} ~ ${esc(d.validTo || '종료일 미등록')}</dd></div>` : ''}${d.hash ? `<div><dt>원문 해시</dt><dd><code>${esc(d.hash)}</code></dd></div>` : ''}</dl>${raw ? `<pre>${esc(raw)}</pre>` : '<p>출처 정보가 등록되지 않았습니다.</p>'}</details>`;
    }
    function history(d) {
      const rows = d.versions || d.history || [];
      const comments = d.comments || [];
      if (!rows.length && !comments.length) return '';
      return `<details class="kb-detail-record"><summary>버전 기록${rows.length ? ' ' + rows.length + '개' : ''} · 의견 ${comments.length}개</summary>${rows.map(v => `<article><h4>${esc(version(v))}</h4>${v.reason ? `<p>${esc(v.reason)}</p>` : ''}${typeof v.content === 'string' ? `<p class="kb-full-text">${esc(v.content)}</p>` : ''}</article>`).join('')}${comments.map(c => `<article><p class="kb-full-text">${esc(c.body || c.content || '')}</p><small>${c.resolved_version || c.resolved ? '반영 버전 v' + esc(c.resolved_version || c.resolved) : '반영 버전 미등록'}</small></article>`).join('')}</details>`;
    }
    function detailMarkup() {
      if (state.detailLoading) return '<div class="kb-detail-placeholder" role="status">선택한 KB 원문을 읽고 있습니다.</div>';
      if (state.detailError) return `<div class="kb-detail-placeholder"><p role="alert">${esc(state.detailError)}</p><button data-kb-retry>상세 다시 읽기</button></div>`;
      const d = state.detail;
      if (!d) return '<div class="kb-detail-placeholder"><span aria-hidden="true">↖</span><h2>KB를 선택하세요</h2><p>리니지에서 문서를 누르면<br>내용과 출처를 여기서 볼 수 있습니다.</p></div>';
      const sections = Array.isArray(d.sections) ? d.sections : [];
      return `<div class="kb-detail-heading"><p>${esc(department(d))} <span>· ${esc(d.id)} · ${esc(version(d))}</span></p><h2 id="kb-detail-title">${esc(d.title)}</h2><span class="kb-detail-state">${esc(d.stateLabel || d.status || '검토 상태 미등록')}</span></div><div class="kb-detail-content">${d.purpose ? `<p class="kb-detail-purpose">${esc(d.purpose)}</p>` : ''}${sections.length ? sections.map((s,i) => `<section class="kb-content-section"><h3><span>${String(i+1).padStart(2,'0')}</span>${esc(s.title)}</h3><p class="kb-full-text">${esc(s.text)}</p>${d.checklist?.includes(s.id) ? '<span class="kb-check-item">개발자 확인 항목</span>' : ''}</section>`).join('') : `<section class="kb-content-section"><h3>전체 내용</h3><p class="kb-full-text">${esc(d.content || '본문이 제공되지 않았습니다.')}</p></section>`}${d.intake_fields?.length ? `<section class="kb-content-section"><h3>접수 시 필요한 정보</h3>${d.intake_fields.map(f => `<p><strong>${esc(f.label)}</strong><br>${esc(f.placeholder || '')}</p>`).join('')}</section>` : ''}${d.reply_hint ? `<section class="kb-content-section"><h3>회신 작성 안내</h3><p>${esc(d.reply_hint)}</p></section>` : ''}${source(d)}${history(d)}</div>`;
    }
    function selectedButton() {
      return [...(host?.querySelectorAll('[data-kb-key]') || [])].find(b => b.dataset.kbKey === state.selected);
    }
    function updateSelection() {
      host?.querySelectorAll('[data-kb-key]').forEach(b => b.setAttribute('aria-expanded', String(state.modalOpen && b.dataset.kbKey === state.selected)));
    }
    function closeModal(restoreFocus = true) {
      const wasOpen = state.modalOpen;
      selectionEpoch++;
      state.modalOpen = false; state.detailLoading = false;
      const dialog = host?.querySelector('#kb-detail-modal');
      if (dialog?.open) dialog.close();
      document.body.classList.remove('kb-modal-open');
      updateSelection();
      if (restoreFocus && wasOpen) selectedButton()?.focus({preventScroll:true});
    }
    function renderDetail() {
      const panel = host?.querySelector('#kb-reading-panel');
      if (!panel) return;
      panel.innerHTML = detailMarkup();
      panel.scrollTop = 0;
      panel.setAttribute('aria-busy', String(state.detailLoading));
      panel.querySelector('[data-kb-retry]')?.addEventListener('click', () => select(state.selected));
    }
    function render() {
      if (!host) return;
      host.innerHTML = `<section class="kb-lineage"><div class="kb-page-heading"><div><div class="kb-eyebrow">KNOWLEDGE MAP</div><h1>KB 리니지</h1><p>업무별 KB를 살펴보고, 문서를 눌러 상세 팝업을 열어보세요.</p></div><button class="kb-refresh" data-kb-refresh ${state.loading ? 'disabled' : ''}>${state.loading ? '불러오는 중…' : '새로고침'}</button></div>${state.error ? `<p class="kb-map-warning" role="alert">${esc(state.error)}</p>` : ''}<div class="kb-lineage-layout"><div class="kb-map-panel" aria-label="전체 KB 구조"><div class="kb-map-caption"><span>전체 구조</span><small>연결선: 업무에 속한 KB</small></div><div class="kb-map-canvas">${graph()}</div>${state.notices.length ? `<div class="kb-map-notices">${state.notices.map(n => `<p>${esc(typeof n === 'string' ? n : n.message || n.text || '')}</p>`).join('')}</div>` : ''}</div></div><dialog class="kb-detail-modal" id="kb-detail-modal" aria-label="KB 상세"><div class="kb-modal-frame"><div class="kb-detail-topline"><span>KB 상세</span><button class="kb-modal-close" data-kb-close aria-label="KB 상세 닫기" autofocus><span aria-hidden="true">×</span> 닫기</button></div><div class="kb-reading-panel" id="kb-reading-panel"></div><span class="kb-sr-only" role="status" data-kb-selection-status></span></div></dialog></section>`;
      host.querySelector('[data-kb-refresh]').onclick = load;
      host.querySelectorAll('[data-kb-key]').forEach(b => b.onclick = () => select(b.dataset.kbKey));
      const dialog = host.querySelector('#kb-detail-modal');
      host.querySelector('[data-kb-close]').onclick = () => closeModal();
      dialog.addEventListener('cancel', event => {event.preventDefault(); closeModal();});
      dialog.addEventListener('close', () => {if (host?.querySelector('#kb-detail-modal') === dialog && !dialog.open && state.modalOpen) closeModal();});
      dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const controls = [...dialog.querySelectorAll('button:not([disabled]),a[href],summary,input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]')].filter(el => el.tabIndex >= 0 && el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) {event.preventDefault(); return;}
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
      });
      let backdropPointer = false;
      dialog.addEventListener('pointerdown', event => {backdropPointer = event.target === dialog;});
      dialog.addEventListener('click', event => {
        if (backdropPointer && event.target === dialog) closeModal();
        backdropPointer = false;
      });
    }
    async function select(key) {
      if (!key || !host) return;
      const ticket = ++selectionEpoch, mount = epoch;
      state.selected = key; state.detail = null; state.detailLoading = true; state.detailError = ''; state.modalOpen = true;
      updateSelection();
      renderDetail();
      const dialog = host.querySelector('#kb-detail-modal');
      const title = state.documents.find(d => d.key === key)?.title || 'KB';
      dialog.setAttribute('aria-label', title + ' 상세');
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('kb-modal-open');
      host.querySelector('[data-kb-close]').focus({preventScroll:true});
      try {
        const d = await provider.detail(key);
        if (ticket !== selectionEpoch || mount !== epoch || !host || !state.modalOpen) return;
        if (!d || d.key !== key) throw Error('선택한 KB와 조회된 문서가 다릅니다. 목록을 새로고침해 주세요.');
        state.detail = d;
        state.documents = state.documents.map(old => old.key === key ? d : old);
        // Refresh this card without replacing the dialog or its focused controls.
        selectedButton()?.closest('li').replaceWith(document.createRange().createContextualFragment(node(d)));
        if (selectedButton()) selectedButton().onclick = () => select(key);
      } catch (error) {
        if (ticket !== selectionEpoch || mount !== epoch || !host || !state.modalOpen) return;
        state.detailError = error.message || 'KB 상세를 불러오지 못했습니다.';
      }
      if (ticket !== selectionEpoch || mount !== epoch || !host || !state.modalOpen) return;
      state.detailLoading = false;
      renderDetail();
      host.querySelector('[data-kb-selection-status]').textContent = state.detail ? state.detail.title + ' 상세가 열렸습니다.' : state.detailError;
    }
    async function load() {
      closeModal(false);
      const mount = ++epoch;
      selectionEpoch++;
      state.loading = true; state.error = ''; state.detail = null; state.detailLoading = false; state.detailError = ''; render();
      try {
        const result = await provider.load();
        if (mount !== epoch || !host) return;
        state.documents = result.documents || []; state.collections = result.collections || fallbackCollections; state.notices = result.notices || [];
        if (!state.documents.some(d => d.key === state.selected)) state.selected = null;
      } catch(error) {
        if (mount !== epoch || !host) return;
        state.documents = []; state.selected = null; state.error = error.message || 'KB 목록을 불러오지 못했습니다.';
      }
      if (mount !== epoch || !host) return;
      state.loading = false; render();
    }
    return {mount(target) {host=target; load();}, destroy() {closeModal(false); epoch++; selectionEpoch++; host=null;}};
  }
  root.KnowHowKBLineage = {createController};
})(window);
