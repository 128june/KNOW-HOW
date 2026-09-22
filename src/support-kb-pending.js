/* Pure candidate rendering. The support controller owns API, session and events. */
(function (root) {
  'use strict';

  /*
   * renderCandidates(candidates, { kbId, kbVersion, field, selectable, compact, busy })
   * returns a separate pending section. It accepts records shaped as:
   * { id, kb_id, kb_version, field, value, status: 'pending',
   *   source: { kind: 'manual_input' | 'ticket', ticket_id? }, created_at, author, role }.
   * Only valid, explicitly pending records matching the supplied filters appear.
   * The caller passes records from its current session/organization and binds
   * button[data-pending-candidate] to the original record's id. Selecting a
   * candidate fills an input; it never confirms or publishes knowledge.
   * No API calls, persistence, document mutation or inferred status occurs here.
   */

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const labels = {
    symptom: '민원 증상', symptoms: '민원 증상',
    error_code: '오류 코드·문구', errors: '오류 코드·문구',
    app_context: '앱 버전·OS·실패한 동작', app_os: '운영체제',
    app_versions: '앱 버전', app_actions: '실패한 동작',
    device_context: '충전기 화면·표시 상태', device_states: '충전기 화면·표시 상태'
  };
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const fieldLabel = field => Object.hasOwn(labels, field) ? labels[field] : field;
  const validCandidate = candidate => candidate && typeof candidate === 'object'
    && candidate.status === 'pending'
    && ['id', 'kb_id', 'field', 'value'].every(key => text(candidate[key]))
    && Number.isSafeInteger(candidate.kb_version) && candidate.kb_version > 0;

  function renderBadge() {
    return '<span class="support-kb-pending-badge" data-pending-status="pending">확정 전</span>';
  }

  function sourceText(candidate) {
    if (candidate.source?.kind === 'manual_input') return '직접 입력 · 내용 확인 전';
    if (candidate.source?.kind === 'ticket') {
      return `티켓에서 추가${text(candidate.source.ticket_id) ? ' · ' + candidate.source.ticket_id : ''} · 내용 확인 전`;
    }
    return '출처 미제공 · 내용 확인 전';
  }

  function createdText(value) {
    if (!text(value)) return '등록 시각 미제공';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '등록 시각 미제공';
    return parsed.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
  }

  function renderCandidate(candidate, options) {
    const label = fieldLabel(candidate.field);
    return `<li class="support-kb-pending-item"><article class="support-kb-pending-card" data-pending-id="${esc(candidate.id)}">
      <div class="support-kb-pending-card-heading">${renderBadge()}<h4>${esc(label)}</h4></div>
      <p class="support-kb-pending-value">${esc(candidate.value)}</p>
      <dl class="support-kb-pending-meta">
        <div><dt>연결된 KB</dt><dd>${esc(candidate.kb_id)} · v${esc(candidate.kb_version)}</dd></div>
        <div><dt>출처</dt><dd>${esc(sourceText(candidate))}</dd></div>
        <div><dt>등록자</dt><dd>${esc(text(candidate.author) ? candidate.author : '미제공')}</dd></div>
        <div><dt>등록 시각</dt><dd>${esc(createdText(candidate.created_at))}</dd></div>
      </dl>
      ${options.selectable === true ? `<button type="button" class="support-kb-pending-select" data-pending-candidate="${esc(candidate.id)}" aria-label="${esc(label + ': ' + candidate.value + ' · 확정 전 내용 선택')}"${options.busy === true ? ' disabled' : ''}>확정 전 내용 선택</button>` : ''}
    </article></li>`;
  }

  function renderCandidates(candidates, options = {}) {
    options = options && typeof options === 'object' ? options : {};
    const rows = (Array.isArray(candidates) ? candidates : []).filter(candidate => validCandidate(candidate)
      && (options.kbId == null || candidate.kb_id === options.kbId)
      && (options.kbVersion == null || candidate.kb_version === options.kbVersion)
      && (options.field == null || candidate.field === options.field));
    return `<section class="support-kb-pending${options.compact === true ? ' is-compact' : ''}" aria-label="확정 전 KB 추가 내용">
      <div class="support-kb-pending-heading"><h3>확정 전 추가 내용</h3><span>${rows.length}건</span></div>
      <p class="support-kb-pending-notice">담당자 확인 전인 내용입니다. 기존 KB 본문과 별도로 보관됩니다.</p>
      ${rows.length ? `<ul class="support-kb-pending-list">${rows.map(candidate => renderCandidate(candidate, options)).join('')}</ul>` : '<p class="support-kb-pending-empty">표시할 확정 전 내용이 없습니다.</p>'}
    </section>`;
  }

  root.KnowHowSupportPending = Object.freeze({ renderCandidates, renderBadge });
})(window);
