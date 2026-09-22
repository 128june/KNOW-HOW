/* A shared KB map with explicit administrator revision and withdrawal controls. */
(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const teams = {counselor:'상담사', app:'앱개발팀', device:'충전기개발팀', finance:'재무팀', data:'데이터팀', operations:'고객운영팀'};
  const fallbackCollections = [{id:'support',label:'충전 민원 대응'}, {id:'general',label:'매출·고객·환불'}];
  function createController({provider} = {}) {
    let host = null, epoch = 0, selectionEpoch = 0;
    const state = {documents:[], collections:fallbackCollections, notices:[], selected:null, requestedVersion:undefined, detail:null, loading:false, detailLoading:false, error:'', detailError:'', modalOpen:false, management:null, adminMode:'', adminTarget:null, adminError:'', adminBusy:false, actionNotice:''};
    const department = d => d.departmentLabel || teams[d.department] || d.department || '담당 부서 미등록';
    const version = d => d.version == null ? '버전 미등록' : 'v' + d.version;
    const documentKind = d => d.collection !== 'support' ? d.kindLabel || d.originLabel || '미등록' : d.standard_id || d.publication_status === 'published' ? '관리자 발행 KB' : Object.keys(d.catalogs || {}).length ? '민원 입력 목록' : '부서별 업무 참고 자료';
    function node(d) {
      return `<li><button class="kb-map-node" ${state.loading ? 'disabled' : ''} data-kb-key="${esc(d.key)}" aria-haspopup="dialog" aria-expanded="${state.modalOpen && d.key === state.selected}" aria-controls="kb-detail-modal"><span class="kb-node-team">${esc(department(d))}<span aria-hidden="true">↗</span></span><strong>${esc(d.title)}</strong><span class="kb-node-meta">${esc(d.id)} <span>· ${esc(version(d))}</span></span><span class="kb-node-origin">${esc(d.collection === 'support' ? documentKind(d) : d.originLabel || d.kindLabel || '')}</span></button></li>`;
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
      return `<details class="kb-detail-record"><summary>출처와 기록 정보</summary><dl class="kb-detail-meta"><div><dt>문서 구분</dt><dd>${esc(documentKind(d))}</dd></div>${d.validFrom || d.validTo ? `<div><dt>적용 기간</dt><dd>${esc(d.validFrom || '시작일 미등록')} ~ ${esc(d.validTo || '종료일 미등록')}</dd></div>` : ''}${d.hash ? `<div><dt>원문 해시</dt><dd><code>${esc(d.hash)}</code></dd></div>` : ''}</dl>${raw ? `<pre>${esc(raw)}</pre>` : '<p>출처 정보가 등록되지 않았습니다.</p>'}</details>`;
    }
    function standardId(d, field, row) { return `STD-${d.id}-${field}-${row.id}`; }
    function catalogManagement(d, field, row) {
      if ((row.input_mode || 'select') !== 'select') return '';
      const id = standardId(d, field, row), removed = d.withdrawnStandardIds?.includes(id);
      const current = state.management?.standards?.find(s => s.id === id);
      return `${removed ? '<p class="kb-history-notice">현재 입력 목록에서 삭제됨 · 아래 원문은 보존됩니다.</p>' : current?.published ? '<p class="kb-history-notice">정정한 발행 KB가 현재 입력에 적용됩니다.</p>' : ''}${state.management && !d.isHistorical ? `<div class="kb-admin-actions">${removed ? '<a href="#support-kb-admin">관리자 검토함에서 복구</a>' : `<button data-kb-standard-edit="${esc(id)}">이 항목 수정</button><button data-kb-standard-delete="${esc(id)}">이 항목 삭제</button>`}</div>` : ''}`;
    }
    function versionPicker(d) {
      if (d.standard_id || !d.source_version || !d.versions?.length) return '';
      return `<section class="kb-publication-info">${d.isHistorical ? '<p class="kb-history-notice">보존된 이전 원문입니다. 수정하려면 최신 버전을 선택하세요.</p>' : ''}<label>보존된 원문 버전<select data-kb-version>${d.versions.map(v => `<option value="${esc(v.version)}" ${v.version === d.version ? 'selected' : ''}>v${esc(v.version)} · ${esc(v.change_reason || '기본 원문')}</option>`).join('')}</select></label></section>`;
    }
    function adminMarkup(d) {
      if (d.collection !== 'support' || !provider.management || d.isHistorical) return '';
      let content = '';
      if (!state.management) content = '<button data-kb-admin-enter>관리자 수정·삭제</button>';
      else if (state.adminMode === 'edit') content = `<form data-kb-document-form><fieldset><legend>KB 내용 수정 · ${esc(d.id)} · ${esc(version(d))}</legend><p>저장하면 이 업무 공간에 새 버전이 적용됩니다. 이전 원문과 접수 기록은 보존됩니다.${d.catalogs ? ' 입력 선택 항목은 아래 목록의 ‘이 항목 수정’에서 관리하세요.' : ''}</p><label>제목<input name="title" required maxlength="500" value="${esc(d.title)}"></label><label>문서 목적<textarea name="purpose" required maxlength="5000" rows="3">${esc(d.purpose || '')}</textarea></label>${d.sections.map((s,i) => `<div class="kb-admin-section"><p>항목 ${i+1} · ${esc(s.id)}</p><label>항목 제목<input name="section_title_${i}" required maxlength="500" value="${esc(s.title)}"></label><label>본문<textarea name="section_text_${i}" required maxlength="15000" rows="5">${esc(s.text)}</textarea></label></div>`).join('')}<label>수정 이유<textarea name="reason" required maxlength="2000" rows="2" placeholder="어떤 내용을 왜 바꾸는지 입력하세요."></textarea></label><div class="kb-admin-actions"><button class="primary" type="submit">새 버전 저장</button><button type="button" data-kb-admin-cancel>취소</button></div></fieldset></form>`;
      else if (state.adminMode === 'delete') {
        const t = state.adminTarget;
        content = `<form data-kb-delete-form><fieldset><legend>${t.kind === 'document' ? 'KB 문서 삭제' : '입력 항목·발행 KB 삭제'}</legend><p><strong>${esc(t.title)}</strong><br>${esc(t.id)} · ${t.version ? 'v'+esc(t.version) : '기본 입력 항목'}</p><p>${t.kind === 'document' ? '이 문서와 연결된 입력 항목·발행 KB를' : '이 항목을'} 현재 업무 공간의 목록과 검색에서 제외합니다. 이전 원문·접수 기록은 보존되며 관리자 검토함에서 복구할 수 있습니다.</p><label>삭제 이유<textarea name="reason" required maxlength="2000" rows="2" placeholder="삭제하는 이유를 입력하세요."></textarea></label><div class="kb-admin-actions"><button class="kb-admin-danger" type="submit">삭제 확인</button><button type="button" data-kb-admin-cancel>취소</button></div></fieldset></form>`;
      } else content = `<p>이 업무 공간의 KB를 관리합니다. 변경 내용은 충전 민원 화면에도 적용됩니다.</p><div class="kb-admin-actions"><button data-kb-document-edit>${d.standard_id ? '수정 검토 열기' : '내용 수정'}</button><button data-kb-document-delete>이 KB 삭제</button><a href="#support-kb-admin">검토함·삭제 기록</a></div>${d.catalogs ? '<p>입력 선택 항목은 아래 원문 목록을 펼쳐 항목별로 수정·삭제하세요.</p>' : ''}`;
      return `<section class="kb-admin-panel" aria-label="KB 관리자 기능">${content}<p data-kb-admin-status role="status" aria-live="polite">${esc(state.adminError || '')}</p></section>`;
    }
    function bindAdmin(panel) {
      const d = state.detail;
      if (!d) return;
      const ticket = selectionEpoch, mount = epoch;
      const current = () => ticket === selectionEpoch && mount === epoch && state.modalOpen;
      const showAdmin = () => {
        const old = panel.querySelector('.kb-admin-panel');
        if (old) old.outerHTML = adminMarkup(d);
        bindAdmin(panel);
        panel.querySelector('.kb-admin-panel')?.scrollIntoView({block:'start'});
      };
      const run = async (task, done) => {
        if (state.adminBusy) return;
        state.adminBusy = true;
        const scope = panel.querySelector('.kb-admin-panel');
        scope?.querySelectorAll('button,fieldset').forEach(el => el.disabled = true);
        const status = scope?.querySelector('[data-kb-admin-status]');
        if (status) status.textContent = '요청을 처리하고 있습니다…';
        try {
          const result = await task();
          if (current()) await done(result);
        } catch (error) {
          if (current()) {state.adminError = error.message || '변경을 저장하지 못했습니다.'; if (status) status.textContent = state.adminError;}
        } finally {
          if (current()) {state.adminBusy = false; scope?.querySelectorAll('button,fieldset').forEach(el => el.disabled = false);}
        }
      };
      panel.querySelector('[data-kb-admin-enter]')?.addEventListener('click', () => run(() => provider.management(), result => {const latest=(d.standard_id ? result.publications : result.documents)?.find(item => item.id === d.id); if(!latest || latest.version !== d.version) throw Error('KB가 변경되었습니다. 상세를 다시 열어 최신 내용을 확인하세요.'); state.management = result; state.adminError = ''; state.adminBusy = false; renderDetail();}));
      panel.querySelector('[data-kb-admin-cancel]')?.addEventListener('click', () => {state.adminMode = ''; state.adminError = ''; showAdmin();});
      const review = id => {
        const target = state.management?.standards?.find(s => s.id === id);
        if (!target) return;
        run(() => provider.openStandardReview({standard_id:id,expected_version:target.version}), result => {
          if (!result.review?.id) throw Error('수정 검토 정보를 확인하지 못했습니다.');
          closeModal(false); root.location.hash = '#support-kb-admin?review='+encodeURIComponent(result.review.id);
        });
      };
      const remove = (kind, id) => {
        if (state.adminBusy) return;
        const target = (kind === 'document' ? state.management?.documents : state.management?.standards)?.find(item => item.id === id);
        if (!target) return;
        const status = (kind === 'document' ? state.management.document_states : state.management.states)?.[id];
        state.adminTarget = {kind,id,title:target.title,version:target.version,revision:status?.revision || 0};
        state.adminMode = 'delete'; state.adminError = ''; showAdmin();
      };
      panel.querySelector('[data-kb-document-edit]')?.addEventListener('click', () => {
        if (d.standard_id) return review(d.standard_id);
        state.adminMode = 'edit'; state.adminError = ''; showAdmin();
      });
      panel.querySelector('[data-kb-document-delete]')?.addEventListener('click', () => remove(d.standard_id ? 'standard' : 'document', d.standard_id || d.id));
      // Assign handlers so switching the form does not accumulate catalog listeners.
      panel.querySelectorAll('[data-kb-standard-edit]').forEach(b => b.onclick = () => review(b.dataset.kbStandardEdit));
      panel.querySelectorAll('[data-kb-standard-delete]').forEach(b => b.onclick = () => remove('standard',b.dataset.kbStandardDelete));
      panel.querySelector('[data-kb-document-form]')?.addEventListener('submit', event => {
        event.preventDefault(); const form = event.currentTarget;
        const payload = {document_id:d.id,expected_version:d.version,source_version:d.source_version || d.version,title:form.elements.title.value.trim(),purpose:form.elements.purpose.value.trim(),sections:d.sections.map((s,i) => ({id:s.id,title:form.elements['section_title_'+i].value.trim(),text:form.elements['section_text_'+i].value.trim()})),checklist:d.checklist || [],reason:form.elements.reason.value.trim()};
        run(() => provider.saveDocument(payload), async () => {await select(d.key);});
      });
      panel.querySelector('[data-kb-delete-form]')?.addEventListener('submit', event => {
        event.preventDefault(); const target = state.adminTarget;
        const payload = {expected_version:target.version,expected_state_revision:target.revision,withdrawn:true,reason:event.currentTarget.elements.reason.value.trim()};
        if (target.kind === 'document') payload.document_id = target.id; else payload.standard_id = target.id;
        run(() => target.kind === 'document' ? provider.setDocumentState(payload) : provider.setStandardState(payload), async () => {
          state.actionNotice = `${target.title} 삭제 완료. 현재 목록에서 제외했으며 관리자 검토함에서 복구할 수 있습니다.`;
          await load({});
        });
      });
    }
    function inputCatalogs(d) {
      if (d.collection !== 'support' || !d.catalogs) return '';
      const groups = Object.entries(d.catalogs).filter(([,rows]) => Array.isArray(rows));
      if (!groups.length) return '';
      const modes = {select:'선택 항목',unknown:'미확인으로 두기',custom:'직접 입력 안내'};
      const comparison = d.comparison || {};
      const relatedItem = ref => {
        const row = d.catalogs[ref.catalog]?.find(item => item.id === ref.id);
        const title = d.catalog_meta?.[ref.catalog]?.title || ref.catalog;
        return `<li><span>${esc(title)} · ${esc(row?.label || row?.value || ref.id)}</span><small>${esc(ref.catalog)} / ${esc(ref.id)}</small></li>`;
      };
      return `<section class="kb-input-catalogs"><h3>민원 입력 목록 원문</h3><p>민원 입력을 위한 기준 목록 원문입니다. 관리자 발행으로 정정한 항목은 해당 발행 KB의 최신 적용 버전을 확인하세요. 이 문서의 ID·버전·출처는 아래 기록에 보존됩니다.</p>${comparison.description ? `<div class="kb-catalog-comparison"><strong>${esc(comparison.label || '항목 간 연결 안내')}</strong><p class="kb-full-text">${esc(comparison.description)}</p>${comparison.auto_select === false ? '<p>연결된 항목은 자동으로 선택되지 않습니다.</p>' : ''}</div>` : ''}${groups.map(([key,rows]) => {
        const meta = d.catalog_meta?.[key] || {};
        return `<details class="kb-input-catalog" data-kb-catalog="${esc(key)}"><summary><span>${esc(meta.title || key)}</span><small>선택 ${rows.filter(row => (row.input_mode || 'select') === 'select').length}개 · 전체 ${rows.length}개</small></summary><div class="kb-input-catalog-body">${meta.description ? `<p class="kb-full-text">${esc(meta.description)}</p>` : ''}${meta.ask ? `<p class="kb-full-text"><strong>확인할 질문</strong><br>${esc(meta.ask)}</p>` : ''}${meta.custom_prompt ? `<p class="kb-full-text"><strong>직접 입력할 때</strong><br>${esc(meta.custom_prompt)}</p>` : ''}<p class="kb-catalog-rule">목록 ID: ${esc(key)}${meta.section_id ? ` · 원문 절: ${esc(meta.section_id)}` : ''}${meta.selection === 'single' ? ' · 한 항목 선택' : ''}${meta.max_length ? ` · 최대 ${esc(meta.max_length)}자` : ''}${meta.allow_custom === true ? ' · 직접 입력 가능' : ''}</p><div class="kb-catalog-options">${rows.map(row => `<article class="kb-catalog-option" data-kb-catalog-option="${esc(row.id)}"><div class="kb-catalog-option-heading"><span>${esc(modes[row.input_mode] || row.input_mode || modes.select)}</span>${row.demo ? '<span class="kb-catalog-demo">시연용</span>' : ''}</div><h4 class="kb-full-text">${esc(row.label || row.value || row.id)}</h4><p class="kb-catalog-option-id">항목 ID: ${esc(row.id)}</p>${row.value !== undefined ? `<dl class="kb-catalog-value"><dt>입력값 원문</dt><dd class="kb-full-text">${row.value === '' ? '<span class="kb-catalog-empty-value">비어 있음 · 직접 입력할 내용에 따름</span>' : esc(row.value)}</dd></dl>` : ''}${row.description ? `<p class="kb-full-text">${esc(row.description)}</p>` : ''}${row.ask ? `<p class="kb-full-text"><strong>확인할 질문</strong><br>${esc(row.ask)}</p>` : ''}${catalogManagement(d,key,row)}${row.related?.length ? `<div class="kb-catalog-related"><strong>${esc(comparison.label || '함께 확인할 항목')}</strong><ul>${row.related.map(relatedItem).join('')}</ul></div>` : ''}</article>`).join('')}</div></div></details>`;
      }).join('')}</section>`;
    }
    function publishedDetails(d) {
      if (!d.standard_id) return '';
      const rows = d.versions || d.history || [];
      const evidence = d.evidence || d.source?.evidence || [];
      return `<section class="kb-publication-info"><h3>발행과 적용 기록</h3>${d.isHistorical?'<p class="kb-history-notice">보존된 원문입니다. 현재 업무에는 최신 버전의 적용 조건을 확인하세요.</p>':''}<dl class="kb-detail-meta"><div><dt>표준 ID</dt><dd>${esc(d.standard_id)}</dd></div><div><dt>적용 시작</dt><dd>${esc(d.effective_at || d.validFrom || '미등록')}</dd></div><div><dt>확인자</dt><dd>${esc(d.confirmed_by || d.published_by || '미등록')}</dd></div><div><dt>발행 시각</dt><dd>${esc(d.published_at || '미등록')}</dd></div><div><dt>수정 이유</dt><dd>${esc(d.change_reason || d.reason || '미등록')}</dd></div></dl>${rows.length?`<label>보존된 원문 버전<select data-kb-version>${rows.map(v=>`<option value="${esc(v.version)}" ${Number(v.version)===Number(d.version)?'selected':''}>v${esc(v.version)} · ${esc(v.change_reason || v.reason || v.published_at || '')}</option>`).join('')}</select></label>`:''}${evidence.length?`<details class="kb-detail-record"><summary>발행 시 검토한 근거 ${evidence.length}개</summary>${evidence.map(e=>`<article><h4>${esc(e.reference || e.id)} · ${e.verification==='confirmed'?'검토 확인':'미확인'}</h4><p class="kb-full-text">${esc(e.excerpt || '')}</p>${e.snapshot?`<details><summary>당시 보존한 원문</summary><pre>${esc(JSON.stringify(e.snapshot,null,2))}</pre></details>`:''}</article>`).join('')}</details>`:''}</section>${!d.isHistorical&&provider.query?`<form class="kb-evidence-query" data-kb-query><h3>이 KB에서 근거 찾기</h3><p>발행 원문과 적용 조건을 조회합니다. 모델 호출은 하지 않습니다.</p><label>확인할 내용<textarea name="question" required maxlength="1000" rows="2" placeholder="예: 시작 요청 실패와 연결하려면 무엇을 확인해야 하나요?"></textarea></label><label>적용일<input name="as_of" type="date" value="${new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'})}" required></label><button class="primary">원문 근거 조회</button><div data-kb-query-result role="status" aria-live="polite"></div></form>`:''}`;
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
      return `<div class="kb-detail-heading"><p>${esc(department(d))} <span>· ${esc(d.id)} · ${esc(version(d))}</span></p><h2 id="kb-detail-title">${esc(d.title)}</h2><span class="kb-detail-state">${esc(d.stateLabel || d.status || '검토 상태 미등록')}</span></div><div class="kb-detail-content">${adminMarkup(d)}${versionPicker(d)}${d.purpose ? `<p class="kb-detail-purpose">${esc(d.purpose)}</p>` : ''}${inputCatalogs(d)}${sections.length ? sections.map((s,i) => `<section class="kb-content-section"><h3><span>${String(i+1).padStart(2,'0')}</span>${esc(s.title)}</h3><p class="kb-full-text">${esc(s.text)}</p>${d.checklist?.includes(s.id) ? '<span class="kb-check-item">개발자 확인 항목</span>' : ''}</section>`).join('') : `<section class="kb-content-section"><h3>전체 내용</h3><p class="kb-full-text">${esc(d.content || '본문이 제공되지 않았습니다.')}</p></section>`}${d.intake_fields?.length ? `<section class="kb-content-section"><h3>접수 시 필요한 정보</h3>${d.intake_fields.map(f => `<p><strong>${esc(f.label)}</strong><br>${esc(f.placeholder || '')}</p>`).join('')}</section>` : ''}${d.reply_hint ? `<section class="kb-content-section"><h3>회신 작성 안내</h3><p>${esc(d.reply_hint)}</p></section>` : ''}${d.collection==='general'?`<p><a class="button" href="#general-${d.id==='KB-CUST-01'?2:d.id==='KB-REF-01'?3:1}">이 기준으로 업무 질문 보기 →</a></p>`:''}${publishedDetails(d)}${source(d)}${history(d)}</div>`;
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
      bindAdmin(panel);
      panel.querySelector('[data-kb-retry]')?.addEventListener('click', () => select(state.selected, state.requestedVersion));
      panel.querySelector('[data-kb-version]')?.addEventListener('change', event => select(state.selected, Number(event.target.value)));
      panel.querySelector('[data-kb-query]')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form=event.currentTarget, button=form.querySelector('button'), output=form.querySelector('[data-kb-query-result]');
        const ticket=selectionEpoch, mount=epoch, key=state.selected;
        button.disabled=true; output.textContent='발행 원문을 조회하고 있습니다…';
        try {
          const result=await provider.query(key,form.elements.question.value.trim(),form.elements.as_of.value,false);
          if(ticket!==selectionEpoch||mount!==epoch||!state.modalOpen)return;
          output.innerHTML=`<p>${esc(result.notice || result.answer || '발행된 원문에서 찾은 근거입니다.')}</p><p class="kb-query-mode">원문 근거 조회 · 모델 호출 없음</p>${(result.evidence||[]).map(e=>`<article><strong>${esc(e.title || e.name || e.doc_id || e.id)} · v${esc(e.version)}</strong><p class="kb-full-text">${esc(e.text || e.content || '')}</p><small>${esc(e.location || '')}</small></article>`).join('')||'<p>적용일과 질문에 맞는 원문 근거가 없습니다.</p>'}`;
        } catch(error) {if(ticket===selectionEpoch&&mount===epoch)output.textContent=error.message||'근거 조회에 실패했습니다.';}
        finally {if(ticket===selectionEpoch&&mount===epoch)button.disabled=false;}
      });
    }
    function render() {
      if (!host) return;
      host.innerHTML = `<section class="kb-lineage"><div class="kb-page-heading"><div><div class="kb-eyebrow">KNOWLEDGE MAP</div><h1>KB 리니지</h1><p>업무별 KB를 살펴보고, 문서를 눌러 상세 팝업을 열어보세요.</p></div><button class="kb-refresh" data-kb-refresh ${state.loading ? 'disabled' : ''}>${state.loading ? '불러오는 중…' : '새로고침'}</button></div><p class="kb-scope-note">충전 민원과 같은 업무 공간의 KB입니다. 발행 KB는 현재 적용 중인 최신 버전이며, 민원 입력 목록과 부서별 업무 참고 자료도 함께 표시합니다. 확정 전 후보는 <a href="#support-kb-admin">KB 관리자 검토함</a>에서 따로 확인하세요. 충전 KB 상세의 ‘관리자 수정·삭제’에서 내용을 관리할 수 있습니다.</p>${state.actionNotice ? `<p class="kb-map-warning" role="status">${esc(state.actionNotice)} <a href="#support-kb-admin">삭제 기록·복구</a></p>` : ''}${state.error ? `<p class="kb-map-warning" role="alert">${esc(state.error)}</p>` : ''}<div class="kb-lineage-layout"><div class="kb-map-panel" aria-label="전체 KB 구조"><div class="kb-map-caption"><span>전체 구조</span><small>연결선: 업무에 속한 KB</small></div><div class="kb-map-canvas">${graph()}</div>${state.notices.length ? `<div class="kb-map-notices">${state.notices.map(n => `<p>${esc(typeof n === 'string' ? n : n.message || n.text || '')}</p>`).join('')}</div>` : ''}</div></div><dialog class="kb-detail-modal" id="kb-detail-modal" aria-label="KB 상세"><div class="kb-modal-frame"><div class="kb-detail-topline"><span>KB 상세</span><button class="kb-modal-close" data-kb-close aria-label="KB 상세 닫기" autofocus><span aria-hidden="true">×</span> 닫기</button></div><div class="kb-reading-panel" id="kb-reading-panel"></div><span class="kb-sr-only" role="status" data-kb-selection-status></span></div></dialog></section>`;
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
    async function select(key, requestedVersion) {
      if (!key || !host) return;
      const ticket = ++selectionEpoch, mount = epoch;
      state.management = null; state.adminMode = ''; state.adminTarget = null; state.adminError = ''; state.adminBusy = false;
      state.selected = key; state.requestedVersion = requestedVersion; state.detail = null; state.detailLoading = true; state.detailError = ''; state.modalOpen = true;
      updateSelection();
      renderDetail();
      const dialog = host.querySelector('#kb-detail-modal');
      const title = state.documents.find(d => d.key === key)?.title || 'KB';
      dialog.setAttribute('aria-label', title + ' 상세');
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('kb-modal-open');
      host.querySelector('[data-kb-close]').focus({preventScroll:true});
      try {
        const listed = state.documents.find(doc => doc.key === key);
        const d = await provider.detail(key, requestedVersion ?? (key.startsWith('general:') ? listed?.version : undefined));
        if (ticket !== selectionEpoch || mount !== epoch || !host || !state.modalOpen) return;
        if (!d || d.key !== key) throw Error('선택한 KB와 조회된 문서가 다릅니다. 목록을 새로고침해 주세요.');
        state.detail = d;
        if (!requestedVersion) state.documents = state.documents.map(old => old.key === key ? d : old);
        // Refresh this card without replacing the dialog or its focused controls.
        if (!requestedVersion) selectedButton()?.closest('li').replaceWith(document.createRange().createContextualFragment(node(d)));
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
    async function load(event) {
      const restoreRefreshFocus = event?.currentTarget?.matches('[data-kb-refresh]');
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
      if (restoreRefreshFocus) host.querySelector('[data-kb-refresh]')?.focus({preventScroll:true});
      const params = new URLSearchParams(root.location.hash.split('?')[1]||'');
      const linked = params.get('kb'), archivedVersion = Number(params.get('version'));
      if (!event && linked && (state.documents.some(d=>d.key==='support:'+linked) || Number.isSafeInteger(archivedVersion) && archivedVersion>0)) select('support:'+linked, archivedVersion>0 ? archivedVersion : undefined);
    }
    return {mount(target) {host=target; load();}, destroy() {closeModal(false); epoch++; selectionEpoch++; host=null;}};
  }
  root.KnowHowKBLineage = {createController};
})(window);
