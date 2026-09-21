/* Pure rendering helpers. This module never reads data or calls an AI/API. */
(function (root) {
  'use strict';

  /*
   * Parent controller contract:
   * privacyMarkup({ dataset, preview, proposal, job, result, busy,
   *   proposalEnabled = false, proposalUnavailableReason })
   * - dataset.schema / preview.schema / preview.columns: strings or { name, type }.
   * - proposal: { review_id, dataset_id, fingerprint, row_count, profile,
   *   proposals: [{ column, column_id, action, reason, policy_refs: [{ id,
   *   version }], affected_count }], policies, status: 'review_required',
   *   ai_generated, provider, model, policy_redaction_notice }. Legacy rules/summary are also supported.
   *   Passing a proposal only fills editable choices; it never means applied.
   * - result: { state, before: preview, after: preview, input_rows,
   *   processed_rows, affected_rows, output_rows, error_rows, job, error }.
   *   A result is displayed only when its job.state is succeeded. A current
   *   non-transform job never counts as successful privacy processing.
   * - Form #data-transform keeps the existing rule contract. Every rule row has
   *   data-rule-column; fields are action, type, rename. Form-level fields are
   *   trim, dedup (only if an id column exists), and on_error. With review_id,
   *   only action is editable; type/rename are hidden compatibility fields.
   *   The parent submits privacy-apply { department, review_id, decisions: [{column,action,policy_refs,reason}] }.
   * policyMarkup({ dataset, proposal, policies, application, busy,
   *   policySearchEnabled = false, policyApplyEnabled = false,
   *   policySearchUnavailableReason, policyApplyUnavailableReason })
   * - policies: array or { documents/items/policies: [], error, status }.
   *   Each document: { id, title, version, department, state, content, source,
   *   valid_from, valid_to, synthetic }. Optional review_status, evidence,
   *   reason, applied_effect and url are also supported.
   * - application: { state/status, policies, applications, processed_rows,
   *   affected_rows, dataset_id, applied_at, error }. Completion indicates a
   *   completed transform, not policy application. A policy is applied only
   *   when that document's applications array contains actual decisions.
   * - Policies remain source evidence; explicit rule choices and reasons are submitted separately.
   * Actions: privacy-propose, policy-search, policy-example,
   *   policy-review-rules, cancel, go-intake.
   * The parent owns API availability, event binding, polling, form state, and
   * stale-response protection. API actions are disabled by default. The parent
   * only enables them when the server supports their actual operation.
   */

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const actions = [['keep', '유지'], ['mask', '가리기'], ['hash', '가명값 변환'], ['drop', '제외']];
  const types = [['string', '문자'], ['integer', '정수'], ['number', '숫자'], ['date', '날짜']];
  const stateNames = {
    queued: '대기 중', pending: '대기 중', running: '처리 중', processing: '처리 중',
    succeeded: '완료', completed: '완료', applied: '적용 완료', failed: '실패',
    cancelled: '취소됨', canceled: '취소됨', proposed: '검토 제안', draft: '검토 전',
    approved: '검토 완료', reviewed: '검토 완료', verified: '검토 완료', confirmed: '담당자 확인',
    unreviewed: '검토 전', review_required: '사람 검토 필요', active: '유효',
    confirmed: '검토 완료', published: '게시됨', rejected: '반려', expired: '만료', unavailable: '사용 불가'
  };
  const list = value => Array.isArray(value) ? value : [];
  const valueText = value => value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const departmentName = department => ({ app: '앱개발팀', device: '충전기개발팀', data: '데이터팀', operations: '고객운영팀', finance: '재무팀', hr: '인사운영팀' }[department] || valueText(department));
  const count = value => value !== '' && value != null && Number.isFinite(Number(value))
    ? Number(value).toLocaleString('ko-KR') : '미제공';
  const statusName = value => stateNames[value] || value || '미확인';
  const isRunning = job => ['queued', 'pending', 'running', 'processing'].includes(job?.state || job?.status);
  const isComplete = job => ['succeeded', 'completed', 'applied'].includes(job?.state || job?.status);
  const documents = value => Array.isArray(value) ? value : list(value?.documents || value?.policies || value?.items);
  const policyId = value => value?.id ?? value?.document_id ?? value?.policy_id ?? '';
  const timeText = value => {
    if (value == null || value === '') return '미제공';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ko-KR');
  };
  function schemaColumns(dataset, preview) {
    const schema = dataset?.schema || preview?.schema || preview?.columns || Object.keys(preview?.rows?.[0] || {});
    return list(schema).map(column => typeof column === 'string' ? { name: column, type: 'string' } : column)
      .filter(column => column && typeof column.name === 'string');
  }
  function normalizedType(value) {
    const name = String(value || '').toLowerCase();
    if (['integer', 'int', 'int64', 'bigint'].includes(name)) return 'integer';
    if (['number', 'numeric', 'real', 'float', 'float64', 'double', 'decimal'].includes(name)) return 'number';
    if (['date', 'datetime', 'timestamp'].includes(name)) return 'date';
    return 'string';
  }
  function badge(dataset) {
    const sample = dataset?.kind === 'synthetic' || dataset?.synthetic === true || dataset?.is_sample === true || dataset?.source?.type === 'synthetic';
    return `<span class="data-review-badge${sample ? ' is-sample' : ''}">${sample ? '보조 샘플 자료' : '선택한 자료'}</span>`;
  }
  function selectedDataset(dataset) {
    return `<div class="data-review-dataset">${badge(dataset)}<strong>${esc(dataset.name || dataset.title || '이름 없는 자료')}</strong><span>${count(dataset.row_count ?? dataset.total_rows)}행</span></div>`;
  }
  function notice(error) {
    return error ? `<p class="notice data-review-error" role="alert">${esc(valueText(error))}</p>` : '';
  }
  function previewTable(preview, title) {
    if (!preview) return `<section class="data-review-preview"><h4>${esc(title)}</h4><p class="muted">실제 미리보기를 아직 불러오지 않았습니다.</p></section>`;
    const rows = list(preview.rows).slice(0, 5);
    const columns = schemaColumns(null, preview);
    return `<section class="data-review-preview"><h4>${esc(title)}</h4>
      <p class="muted">${count(rows.length)}행 미리보기${preview.total != null || preview.total_rows != null ? ` · 전체 ${count(preview.total ?? preview.total_rows)}행` : ''}</p>
      <div class="table-scroll" tabindex="0" role="region" aria-label="${esc(title)} 표">
        <table class="readable-table"><thead><tr>${columns.map(column => `<th scope="col">${esc(column.name)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(row => `<tr>${columns.map((column, index) => `<td>${esc(valueText(Array.isArray(row) ? row[index] : row[column.name]))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${Math.max(1, columns.length)}">표시할 행이 없습니다.</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;
  }
  function reviewRules(columns, proposal, busy) {
    const candidates = documents(proposal?.policies);
    if (!columns.length) return '<p class="empty">열 정보를 불러오면 처리 방법을 선택할 수 있습니다.</p>';
    const proposed = list(proposal?.proposals || proposal?.rules);
    const profiles = list(proposal?.profile);
    const reviewed = !!proposal?.review_id;
    return `<form id="data-transform" class="data-review-form"${reviewed ? ` data-review-id="${esc(proposal.review_id)}"` : ''}>
      <div class="table-scroll" tabindex="0" role="region" aria-label="열별 민감정보 처리 선택">
        <table class="readable-table data-review-rules${reviewed ? ' is-reviewed' : ''}"><thead><tr><th scope="col">열과 검토 근거</th><th scope="col">보호 방법</th>${reviewed ? '' : '<th scope="col">자료형</th><th scope="col">결과 열 이름</th>'}</tr></thead>
          <tbody>${columns.map(column => {
            const profile = profiles.find(item => item.column === column.name || (column.column_id && item.column_id === column.column_id)) || {};
            const rule = proposed.find(item => item.column === column.name || (profile.column_id && item.column_id === profile.column_id)) || {};
            const action = actions.some(([key]) => key === rule.action) ? rule.action : 'keep';
            const type = normalizedType(rule.type || column.type || profile.data_type);
            const ids = list(rule.policy_ids || rule.policy_document_ids);
            const references = list(rule.policy_refs);
            const signals = list(profile.types);
            return `<tr data-rule-column="${esc(column.name)}"><th scope="row"><strong>${esc(column.name)}</strong>
                ${rule.classification ? `<span class="data-review-classification">${esc(valueText(rule.classification))}</span>` : ''}
                <small>${esc(rule.reason || '직접 처리 방법을 선택하세요.')}</small>
                ${signals.length ? `<small>검토 신호: ${signals.map(value => esc(valueText(value))).join(', ')}</small>` : ''}
                ${rule.affected_count != null ? `<small>제안 영향 범위: ${count(rule.affected_count)}행</small>` : ''}
                ${references.length ? `<small>근거 정책: ${references.map(reference => `${esc(reference.id)}${reference.version != null ? ` · v${esc(reference.version)}` : ''}`).join(', ')}</small>` : ids.length ? `<small>근거 정책: ${ids.map(id => esc(valueText(id))).join(', ')}</small>` : ''}
              </th><td><select name="action" aria-label="${esc(column.name)} 보호 방법" ${busy ? 'disabled' : ''}>${actions.map(([key, label]) => `<option value="${key}" ${key === action ? 'selected' : ''}>${label}</option>`).join('')}</select>${reviewed ? `<input type="hidden" name="type" value="${esc(type)}"><input type="hidden" name="rename" value=""><fieldset class="data-rule-evidence"><legend>사람이 선택한 정책 근거</legend>${candidates.length ? candidates.map(policy => `<label class="check"><input type="checkbox" name="policy_ref" value="${esc(policyId(policy))}" data-policy-version="${esc(policy.version)}" ${busy ? 'disabled' : ''}><span>${esc(policy.title)} · v${esc(policy.version)}<small>${esc(policy.department)} · ${policy.scope === 'company' ? '승인된 전사 범위' : '부서 범위'}</small></span></label>`).join('') : '<p class="muted">선택 가능한 정책이 없습니다. 정책 화면에서 작성·검토 후 다시 조회하세요.</p>'}<label>이 정책을 선택한 이유<textarea name="decision_reason" maxlength="1000" rows="3" aria-label="${esc(column.name)} 정책 선택 이유" placeholder="이 열에 이 정책과 처리 방법을 적용하는 이유" ${busy ? 'disabled' : ''}></textarea></label><small>정책을 선택하면 이유가 필요합니다. 선택하지 않으면 정책 근거 없는 직접 결정으로 기록됩니다.</small></fieldset>` : ''}</td>
              ${reviewed ? '' : `<td><select name="type" aria-label="${esc(column.name)} 자료형" ${busy ? 'disabled' : ''}>${types.map(([key, label]) => `<option value="${key}" ${key === type ? 'selected' : ''}>${label}</option>`).join('')}</select></td><td><input name="rename" value="${esc(rule.rename || '')}" aria-label="${esc(column.name)} 결과 열 이름" placeholder="기존 이름 유지" ${busy ? 'disabled' : ''}></td>`}</tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      ${reviewed ? '' : `<details class="data-review-options"><summary>추가 처리 옵션</summary>
        <label class="check"><input name="trim" type="checkbox" checked ${busy ? 'disabled' : ''}>앞뒤 공백 제거</label>
        ${columns.some(column => column.name === 'id') ? `<label class="check"><input name="dedup" type="checkbox" ${busy ? 'disabled' : ''}>id가 같은 중복 행 제거</label>` : ''}
        <label>변환할 수 없는 행<select name="on_error" ${busy ? 'disabled' : ''}><option value="quarantine">오류 기록에 남기고 나머지 처리</option><option value="reject">전체 실패 처리</option></select></label>
      </details>`}
      <p class="muted">가명값 변환은 같은 값을 같은 대체값으로 바꿉니다. 선택한 규칙을 전체 행에 적용하고 원본을 보존합니다.</p>
      <button type="submit" class="primary" ${busy ? 'disabled' : ''}>${reviewed ? '선택한 민감정보 처리 확정' : '선택한 규칙으로 처리 실행'}</button>
    </form>`;
  }
  function transformResult(job, result, preview, busy) {
    const currentJob = job && (!job.kind || job.kind === 'transform') ? job : null;
    const execution = currentJob || result?.job;
    if (!execution) return `<section class="card data-review-result"><h3>처리 전후와 실행 결과</h3><p class="empty">처리를 실행하면 진행 상태와 실제 결과가 표시됩니다.</p>${previewTable(preview, '처리 전 원본')}</section>`;
    const state = execution.state || execution.status;
    const succeeded = execution.state === 'succeeded';
    const verifiedResult = succeeded && result?.job?.state === 'succeeded' && (!currentJob?.id || !result.job.id || currentJob.id === result.job.id) ? result : null;
    const fraction = execution.progress ?? (execution.total_rows > 0 ? 100 * execution.processed_rows / execution.total_rows : null);
    const progress = fraction != null && Number.isFinite(Number(fraction)) ? Math.min(100, Math.max(0, Number(fraction))) : null;
    const resultId = verifiedResult?.dataset_id || verifiedResult?.after?.dataset?.id || (succeeded ? execution.dataset_id : null);
    return `<section class="card data-review-result"><div class="row"><h3>처리 전후와 실행 결과</h3><span class="data-review-badge ${succeeded ? 'is-complete' : ''}">${esc(statusName(state))}</span></div>
      <div class="data-review-metrics"><div><span>처리 대상 행</span><strong>${count(verifiedResult?.input_rows ?? execution.total_rows)}</strong></div><div><span>처리한 행</span><strong>${count(execution.processed_rows ?? verifiedResult?.processed_rows)}</strong></div><div><span>결과 행</span><strong>${count(verifiedResult?.output_rows ?? verifiedResult?.after?.total ?? verifiedResult?.after?.total_rows)}</strong></div><div><span>오류 행</span><strong>${count(verifiedResult?.error_rows ?? execution.error_rows)}</strong></div></div>
      ${verifiedResult?.affected_rows != null ? `<p>변경된 행 ${count(verifiedResult.affected_rows)}행</p>` : ''}
      ${isRunning(execution) ? `<div role="status">${progress == null ? '<p>전체 진행률을 계산하는 중입니다.</p>' : `<progress max="100" value="${progress}" aria-label="민감정보 처리 진행률">${progress}%</progress><p>${progress}% · 전체 ${count(execution.total_rows)}행</p>`}</div><button type="button" data-data-action="cancel" ${busy ? 'disabled' : ''}>이 작업 취소</button>` : ''}
      ${notice(execution.error || result?.error)}
      ${state === 'cancelled' || state === 'canceled' ? '<p>작업이 취소되었습니다. 저장된 결과 여부는 작업 기록에서 확인하세요.</p>' : ''}
      <div class="data-review-comparison">${previewTable(verifiedResult?.before || preview, '처리 전 원본')}${previewTable(verifiedResult?.after, '처리 후 결과')}</div>
      ${succeeded && resultId ? `<button type="button" data-data-dataset="${esc(resultId)}">처리 결과 전체 보기</button>` : ''}
    </section>`;
  }
  function privacyMarkup({ dataset, preview, proposal, job, result, busy = false, proposalEnabled = false, proposalUnavailableReason = '', unavailableReason = '' } = {}) {
    if (!dataset) return '<section class="card data-review"><h2>2. 민감정보 처리</h2><p class="empty">자료 가져오기를 완료한 뒤 처리할 자료를 선택하세요.</p><button type="button" data-data-action="go-intake">자료 가져오기로 이동</button></section>';
    const disabled = busy || isRunning(job);
    const unavailable = !proposalEnabled || dataset.review_available === false;
    const columns = schemaColumns(dataset, preview);
    const reviewColumns = columns.length ? columns : list(proposal?.profile).map(column => ({ name: column.column, type: column.data_type, column_id: column.column_id })).filter(column => typeof column.name === 'string');
    return `<div class="data-review">
      <section class="card"><h2>2. 민감정보 처리</h2>${selectedDataset(dataset)}<p>검토 제안을 참고해 열별 처리 방법을 선택하세요.</p><p><a href="#data-policies">부서·전사 정책을 조회하고 사람이 근거 선택하기 →</a></p>
        <div class="data-review-ai"><div><h3>AI 검토 제안</h3><p>버튼을 누르면 익명화된 데이터 프로파일과 정책을 바탕으로 검토합니다. 개인정보 원문은 AI에 보내지 않습니다.</p></div><button type="button" data-data-action="privacy-propose" ${disabled || unavailable ? 'disabled' : ''}>AI로 처리 방법 검토</button></div>
        ${unavailable ? `<p class="muted">${esc(proposalUnavailableReason || unavailableReason || 'AI 검토 연결을 아직 사용할 수 없습니다. 아래에서 처리 방법을 직접 선택할 수 있습니다.')}</p>` : ''}
        ${proposal ? `<div class="data-review-proposal"><span class="data-review-badge">${proposal.ai_generated === true ? 'AI 검토 제안' : proposal.ai_generated === false ? '규칙 기반 검토 제안' : '검토 제안'} · 적용 전</span>${proposal.summary ? `<p>${esc(valueText(proposal.summary))}</p>` : ''}${proposal.policy_redaction_notice ? `<p class="notice data-review-transmission">${esc(valueText(proposal.policy_redaction_notice))}</p>` : ''}${proposal.provider || proposal.model ? `<p class="muted">응답 제공: ${esc(valueText(proposal.provider || '미제공'))} · 모델 ${esc(valueText(proposal.model || '미제공'))}</p>` : ''}<p>사람 검토 필요${proposal.row_count != null ? ` · 검토 대상 ${count(proposal.row_count)}행` : ''}</p><p class="muted">아래 선택값을 확인하고 처리 실행을 눌러야 데이터에 적용됩니다.</p>${list(proposal.warnings).length ? `<ul>${list(proposal.warnings).map(warning => `<li>${esc(valueText(warning))}</li>`).join('')}</ul>` : ''}${notice(proposal.error)}</div>` : '<p class="muted">아직 AI 검토를 요청하지 않았습니다. 직접 규칙을 선택해도 됩니다.</p>'}
      </section>
      <section class="card"><h3>열별 처리 방법 선택</h3>${reviewRules(reviewColumns, proposal, disabled)}</section>
      ${transformResult(job, result, preview, busy)}
    </div>`;
  }
  function policyCard(policy, { applied = false, completed = false, busy = false, index = 0, proposal } = {}) {
    applied = applied && list(policy.applications).length > 0;
    const id = policyId(policy);
    const evidence = policy.content ?? policy.evidence ?? policy.excerpt ?? policy.reason;
    const fullEvidence = valueText(evidence);
    const relatedRules = !applied && !completed ? list(proposal?.proposals || proposal?.rules).filter(rule => list(rule.policy_refs).some(reference => String(reference.id) === String(id) && (reference.version == null || policy.version == null || String(reference.version) === String(policy.version)))) : [];
    const effect = completed && !applied ? null : policy.applied_effect ?? policy.effect ?? policy.application_effect;
    const source = policy.source;
    const sourceUrl = policy.url || (typeof source === 'string' ? source : source?.url);
    const url = typeof sourceUrl === 'string' && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : '';
    const sourceName = typeof source === 'string' ? source : source?.reference || source?.title || source?.name || source?.type;
    const unavailable = policy.availability === 'unavailable';
    const department = policy.department ?? policy.owner_department ?? '미제공';
    const departmentLabel = departmentName(department);
    return `<article class="data-policy-document" data-policy-document="${esc(id)}">
      <div class="row"><h3>${esc(policy.title || policy.name || (unavailable ? `정책 ${id}` : `정책 문서 ${index + 1}`))}</h3><span class="data-review-badge ${applied ? 'is-complete' : ''}">${applied ? '확정 적용' : completed ? '검색 근거 · 미적용' : '검색 근거 · 적용 전'}</span></div>
      ${unavailable ? '<p class="notice">적용 당시 근거 · 현재 원문 사용 불가</p>' : ''}${policy.synthetic === true ? '<p><span class="data-review-badge is-sample">체험용 샘플 정책</span></p>' : ''}
      <div class="data-policy-summary"><p><strong>v${esc(policy.version ?? policy.document_version ?? '미제공')}</strong> · ${esc(departmentLabel)}</p><p>${esc(statusName(policy.review_status ?? policy.review_state ?? policy.state))} · ${policy.scope === 'company' ? '승인된 전사 범위' : '부서 범위'}</p><p>적용 ${policy.valid_from || policy.valid_to ? `${policy.valid_from ? esc(timeText(policy.valid_from)) : '시작일 미제공'} ~ ${policy.valid_to ? esc(timeText(policy.valid_to)) : '종료일 미제공'}` : '시작·종료일 미등록'}</p></div>
      ${evidence ? `<div class="data-policy-evidence"><h4>정책 원문</h4><p>${esc(fullEvidence)}</p></div>` : `<p class="muted">${esc(unavailable ? policy.notice || '현재 권한·버전·검토 상태에서 원문을 사용할 수 없습니다. 적용 당시 정책 번호와 버전, 처리 이유는 기록에 보존됩니다.' : '이 문서의 판단 근거가 제공되지 않았습니다.')}</p>`}
      ${sourceName || url ? `<div class="data-policy-source"><h4>출처</h4>${sourceName ? `<p>${esc(sourceName)}</p>` : ''}${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">정책 원문 보기</a>` : ''}</div>` : ''}
      ${policy.reason && policy.reason !== evidence ? `<p>${esc(valueText(policy.reason))}</p>` : ''}
      ${effect ? `<div class="data-policy-effect"><h4>${applied ? '데이터에 적용된 내용' : '제안된 처리 내용'}</h4><p>${esc(valueText(effect))}</p></div>` : applied ? `<div class="data-policy-effect"><h4>데이터에 적용된 내용</h4><ul>${list(policy.applications).map(entry => `<li>${esc(entry.column)} · ${esc(actions.find(([key]) => key === entry.action)?.[1] || entry.action)} · ${count(entry.affected_count)}행</li>`).join('')}</ul></div>` : relatedRules.length ? `<div class="data-policy-effect"><h4>제안된 처리 내용</h4><ul>${relatedRules.map(rule => `<li><strong>${esc(rule.column)}</strong> · ${esc(actions.find(([key]) => key === rule.action)?.[1] || rule.action)}${rule.affected_count != null ? ` · 영향 범위 ${count(rule.affected_count)}행` : ''}${rule.reason ? `<p>${esc(rule.reason)}</p>` : ''}</li>`).join('')}</ul></div>` : `<p class="muted">${completed ? '이 처리에 적용된 정책 기록이 없습니다.' : '이 정책은 아직 데이터에 적용되지 않았습니다.'}</p>`}
      ${list(policy.columns || policy.target_columns).length ? `<p class="muted">대상 열: ${list(policy.columns || policy.target_columns).map(column => esc(valueText(column))).join(', ')}</p>` : ''}
      <details class="data-policy-technical"><summary>문서 식별·검증 정보</summary><dl class="data-policy-meta"><div><dt>문서 ID</dt><dd>${esc(id || '미제공')}</dd></div>${policy.sha256 ? `<div><dt>정책 SHA-256</dt><dd>${esc(policy.sha256)}</dd></div>` : ''}</dl></details>
    </article>`;
  }
  function applicationRowsMarkup(entries, policies = []) {
    if (!entries.length) return '<p class="muted">열별 처리 결정 기록이 제공되지 않았습니다.</p>';
    const priority = entries.filter(entry => entry.action !== 'keep' || list(entry.policy_refs).length > 0);
    const unchanged = entries.filter(entry => entry.action === 'keep' && list(entry.policy_refs).length === 0);
    const actionName = entry => actions.find(([key]) => key === entry.action)?.[1] || entry.action || '미제공';
    const decisionName = entry => ['human_selected','human_policy_selection'].includes(entry.decision) ? '사람이 정책 선택' : entry.decision === 'human_changed' ? '사람이 제안 변경' : entry.decision === 'review_applied' ? '검토 제안 채택' : entry.decision || '미제공';
    const refsMarkup = entry => list(entry.policy_refs).length ? list(entry.policy_refs).map(reference => `${esc(reference.id)}${reference.version != null ? ` · v${esc(reference.version)}` : ''}`).join(', ') : '연결된 정책 없음';
    return `<h4>열별 실제 처리 결정</h4>${priority.length ? `<div class="data-application-priority">${priority.map(entry => `<article class="data-application-entry" data-application-column="${esc(entry.column)}"><h4>${esc(entry.column)}</h4><p class="data-application-action"><strong>${esc(actionName(entry))}</strong><span>${entry.affected_count != null ? `영향 ${count(entry.affected_count)}행` : '영향 행 미제공'}</span></p><dl class="data-application-reason"><dt>선택한 정책</dt><dd>${list(entry.policy_refs).length ? list(entry.policy_refs).map(reference => {const policy = policies.find(item => String(policyId(item)) === String(reference.id) && String(item.version) === String(reference.version));return `${esc(policy?.title || policy?.name || '적용 당시 정책')}${reference.version != null ? ` · v${esc(reference.version)}` : ''}`;}).join('<br>') : '연결된 정책 없음'}</dd><dt>사람이 남긴 이유</dt><dd>${esc(entry.reason || '기록 없음')}</dd></dl><details class="data-application-decision"><summary>결정·검출·정책 참조 정보</summary><dl class="data-policy-meta"><div><dt>사람의 결정</dt><dd>${esc(decisionName(entry))}</dd></div><div><dt>검출 셀</dt><dd>${count(entry.matched_cells)}</dd></div><div><dt>정책 참조</dt><dd>${refsMarkup(entry)}</dd></div></dl></details></article>`).join('')}</div>` : '<p class="muted">보호 처리하거나 정책을 연결한 열이 없습니다.</p>'}
      ${unchanged.length ? `<details class="data-application-unchanged"><summary>유지한 나머지 ${count(unchanged.length)}개 열 · 전체 결정 보기</summary><div class="table-scroll data-application-table" tabindex="0" role="region" aria-label="유지한 열의 전체 처리 결정 표"><table class="readable-table"><thead><tr><th scope="col">열</th><th scope="col">실행한 처리</th><th scope="col">영향 행</th><th scope="col">검출 셀</th><th scope="col">사람의 결정</th><th scope="col">연결된 정책</th><th scope="col">사람이 남긴 이유</th></tr></thead><tbody>${unchanged.map(entry => `<tr data-application-column="${esc(entry.column)}"><th scope="row">${esc(entry.column)}</th><td>${esc(actionName(entry))}</td><td>${count(entry.affected_count)}</td><td>${count(entry.matched_cells)}</td><td>${esc(decisionName(entry))}</td><td>${refsMarkup(entry)}</td><td>${esc(entry.reason || '기록 없음')}</td></tr>`).join('')}</tbody></table></div></details>` : ''}`;
  }
  const departments = [['data', '데이터 부서'], ['app', '앱 개발 부서'], ['device', '기기 개발 부서']];
  function policyScopeMarkup({ department = 'data', includeCompany = false, busy = false } = {}) {
    return `<div class="data-policy-scope"><label>기준 부서<select data-policy-department ${busy ? 'disabled' : ''}>${departments.map(([id, name]) => `<option value="${id}" ${department === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label><label class="check"><input type="checkbox" data-policy-company ${includeCompany ? 'checked' : ''} ${busy ? 'disabled' : ''}>같은 방문자 조직에서 승인된 전사 정책도 포함</label></div><p class="muted">기본은 선택한 부서입니다. 현재 버전의 검토 완료·유효한 정책을 조회하며, 전사 정책은 명시적으로 포함한 경우에만 조회합니다.</p>`;
  }
  function policyWorkspaceMarkup({ kb = {}, department = 'data', busy = false, enabled = false } = {}) {
    const locked = busy || !enabled, editor = kb.editor, draft = kb.draft || {}, selected = editor?.id;
    const docs = documents(kb.documents).filter(d => d.source?.kind === 'data-platform-privacy-policy');
    return `<section class="card data-policy-workspace" id="data-policy-authoring"><h3>우리 부서 정책 작성·검토</h3><p>같은 방문자 조직의 지식 저장소에 원문을 남깁니다. 이 공간의 확인·전사 공유는 실제 회사의 승인이나 관리자 권한을 뜻하지 않습니다.</p><div class="actions"><button type="button" data-policy-action="catalog" ${locked ? 'disabled' : ''}>부서 정책 목록 새로고침</button><button type="button" data-policy-action="new" ${locked ? 'disabled' : ''}>새 정책 작성</button></div>
      ${kb.loaded ? `<ul class="data-policy-catalog">${docs.map(doc => `<li><button type="button" data-policy-action="open" data-policy-id="${esc(doc.id)}" ${locked ? 'disabled' : ''}><strong>${esc(doc.title)}</strong><span>v${esc(doc.version)} · ${esc(statusName(doc.state))} · ${esc(({none:'전사 공유 안 함', requested:'전사 공유 요청됨',approved:'전사 공유 승인',revoked:'전사 공유 철회',stale:'새 버전 재검토 필요'})[doc.company_status] || doc.company_status || '')}</span></button></li>`).join('') || '<li class="empty">등록된 부서 정책이 없습니다. 새 정책 작성에서 원문과 적용일을 입력하세요.</li>'}</ul>` : '<p class="muted">목록 새로고침으로 작성 중인 정책과 검토 상태를 확인할 수 있습니다.</p>'}
      ${editor ? `<div class="data-policy-editor"><h4>${selected ? `선택한 정책 · v${esc(editor.version)}` : '새 정책 초안'}</h4>${selected ? `<p>현재 상태: ${esc(statusName(editor.state))} · 담당 부서 ${esc(departmentName(editor.department))} · 전사 공유 ${esc(({none:'안 함',requested:'요청됨',approved:'승인됨',revoked:'철회됨',stale:'재검토 필요'})[editor.company_status] || editor.company_status || '안 함')}</p><div class="data-policy-evidence"><h4>저장된 현재 원문</h4><p>${esc(editor.content)}</p></div>` : ''}
        <form id="data-policy-save"><label>정책 제목<input name="title" maxlength="200" value="${esc(draft.title || '')}" required ${locked ? 'disabled' : ''}></label><label>정책 원문<textarea name="content" rows="8" required ${locked ? 'disabled' : ''}>${esc(draft.content || '')}</textarea><small>UTF-8 7,000바이트 이내. 적용할 대상 열과 처리 기준을 원문 그대로 적어 주세요.</small></label><label>정책 출처 (선택)<input name="reference" maxlength="1000" value="${esc(draft.reference || '')}" placeholder="원문 URL, 사내 규정 문서 번호, 작성 근거" ${locked ? 'disabled' : ''}></label><div class="data-policy-dates"><label>적용 시작일<input type="date" name="valid_from" value="${esc(draft.valid_from || '')}" required ${locked ? 'disabled' : ''}></label><label>적용 종료일 (선택)<input type="date" name="valid_to" value="${esc(draft.valid_to || '')}" ${locked ? 'disabled' : ''}></label></div>${selected ? '<p class="muted">수정하면 새 초안 버전으로 저장됩니다. 검토와 전사 공유를 다시 확인해야 합니다.</p>' : '<p class="muted">저장만으로 검토 완료나 전사 공유가 되지 않습니다.</p>'}<button type="submit" ${locked ? 'disabled' : ''}>${selected ? '수정 내용을 새 초안 버전으로 저장' : '정책 초안 저장'}</button></form>
        ${selected ? `<form id="data-policy-review"><h4>현재 v${esc(editor.version)} 원문에 대한 사람의 확인</h4><label>검토·공유 사유<textarea name="reason" rows="3" maxlength="1000" required ${locked ? 'disabled' : ''}>${esc(kb.reason || '')}</textarea></label><label class="check"><input type="checkbox" name="confirmed" required ${locked ? 'disabled' : ''}>저장된 현재 원문·버전·적용일을 직접 읽고 확인했습니다.</label><div class="actions"><button type="submit" data-policy-mutation="review" ${locked ? 'disabled' : ''}>현재 버전 검토 완료</button><button type="submit" data-policy-mutation="request-promotion" ${locked || editor.state !== 'confirmed' || editor.company_status === 'approved' ? 'disabled' : ''}>현재 버전 전사 공유 요청</button><button type="submit" data-policy-mutation="promote" ${locked || editor.state !== 'confirmed' || editor.company_status !== 'requested' ? 'disabled' : ''}>요청된 전사 공유 승인</button><button type="submit" data-policy-mutation="revoke" ${locked || !['approved','requested','stale'].includes(editor.company_status) ? 'disabled' : ''}>전사 공유 철회</button></div></form>` : ''}</div>` : ''}</section>`;
  }
  function policyMarkup({ dataset, proposal, policies, application, busy = false, policySearchEnabled = false, policyApplyEnabled = false, policySearchUnavailableReason = '', policyApplyUnavailableReason = '', unavailableReason = '', department = 'data', includeCompany = false, kb = {} } = {}) {
    if (!dataset) return '<section class="card data-review"><h2>3. 적용 정책과 결과</h2><p class="empty">자료를 선택하면 관련 정책과 적용 결과를 확인할 수 있습니다.</p><button type="button" data-data-action="go-intake">자료 가져오기로 이동</button></section>';
    const candidatePolicies = documents(policies);
    const completed = isComplete(application);
    const resultPolicies = completed ? documents(application) : [];
    const appliedPolicies = resultPolicies.filter(policy => list(policy.applications).length > 0);
    const unappliedPolicies = resultPolicies.filter(policy => list(policy.applications).length === 0);
    const entries = completed ? list(application?.applications) : [];
    const searchUnavailable = !policySearchEnabled || dataset.policy_available === false;
    const applicationState = application?.state || application?.status;
    return `<div class="data-review data-policy-review">
      <section class="card"><h2>3. 적용 정책과 결과</h2>${selectedDataset(dataset)}<p>관련 정책을 찾아 검토하고, 실제로 적용된 정책과 결과를 확인하세요.</p>
        ${policyScopeMarkup({ department, includeCompany, busy: busy || searchUnavailable })}<div class="actions"><button type="button" data-data-action="policy-search" ${busy || searchUnavailable ? 'disabled' : ''}>관련 정책 문서 찾기</button></div>
        ${searchUnavailable ? `<p class="muted">${esc(policySearchUnavailableReason || unavailableReason || '정책 검색 연결을 아직 사용할 수 없습니다.')}</p>` : ''}
        ${notice(policies?.error)}
      </section>
      ${completed ? '' : `<section class="card"><div class="row"><h3>관련 정책 문서</h3><span class="data-review-badge">${count(candidatePolicies.length)}개 · 검토 대상</span></div>
        ${candidatePolicies.length ? `<p class="muted">검색된 정책은 열별 처리 방법을 판단하는 근거입니다. 민감정보 처리 단계에서 보호 방법을 확인하고 실행하세요.</p><div class="data-policy-list">${candidatePolicies.map((policy, index) => policyCard(policy, { busy, index, proposal })).join('')}</div><div class="actions"><button type="button" class="primary" data-data-action="policy-review-rules" ${busy ? 'disabled' : ''}>처리 방법 선택하러 가기</button></div>` : `<p class="empty">${policies ? '현재 범위에 유효하고 검토 완료된 정책 문서가 없습니다.' : '정책 문서를 찾으면 제목, 원문, 버전, 담당부서와 적용일이 표시됩니다.'}</p><p>아래 ‘우리 부서 정책 작성·검토’에서 초안을 저장하고 사람이 검토를 완료한 뒤 다시 검색하세요.</p><button type="button" data-policy-action="new" ${busy || searchUnavailable ? 'disabled' : ''}>정책 작성 열기</button>`}
      </section>`}
      ${policyWorkspaceMarkup({ kb, department, busy, enabled: policySearchEnabled })}
      <section class="card data-policy-application"><div class="row"><h3>처리 결정과 정책 적용 기록</h3><span class="data-review-badge ${completed ? 'is-complete' : ''}">${completed ? `처리 완료 · ${appliedPolicies.length ? `정책 ${count(appliedPolicies.length)}개 적용` : '정책 적용 없음'}` : application ? esc(statusName(applicationState)) : '아직 처리하지 않음'}</span></div>
        ${notice(application?.error)}
        ${completed ? `<p>전체 ${count(application.processed_rows)}행 처리${application.affected_rows != null ? ` · 변경 ${count(application.affected_rows)}행` : ''}${application.applied_at ? ` · ${esc(timeText(application.applied_at))}` : ''}</p>${applicationRowsMarkup(entries, resultPolicies)}${application.source_sha256 ? `<details class="data-application-source"><summary>입수 원문 출처·검증 정보</summary><dl class="data-source-meta"><dt>입수 원문 SHA-256</dt><dd>${esc(application.source_sha256)}</dd></dl></details>` : ''}${appliedPolicies.length ? `<h4>실제 적용된 정책</h4><div class="data-policy-list">${appliedPolicies.map((policy, index) => policyCard(policy, { applied: true, completed: true, index })).join('')}</div>` : '<p class="muted">선택한 처리 방법으로 작업을 완료했습니다. 실제 적용 기록에 연결된 정책 문서는 없습니다.</p>'}${unappliedPolicies.length ? `<h4>검색 근거 · 미적용 정책</h4><p class="muted">검토 과정에서 조회한 문서이며, 이번 처리 결정에 적용된 기록은 없습니다.</p><div class="data-policy-list">${unappliedPolicies.map((policy, index) => policyCard(policy, { completed: true, index })).join('')}</div>` : ''}${application.dataset_id ? `<button type="button" data-data-dataset="${esc(application.dataset_id)}">처리 결과 보기</button>` : ''}` : `<p>${isRunning(application) ? `선택한 처리 규칙을 실행 중입니다. 현재 ${count(application.processed_rows)}행을 처리했습니다.` : '실제 처리가 완료되면 열별 결정과 연결된 정책, 데이터 변경 내용이 여기에 기록됩니다.'}</p>`}
      </section>
    </div>`;
  }

  root.KnowHowDataReviewUI = Object.freeze({ privacyMarkup, policyMarkup, policyWorkspaceMarkup, esc, schemaColumns });
})(window);
