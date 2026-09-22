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
   * renderReviewRequests(requests, { unreadCount, busy }) returns an in-app
   * KB administrator inbox. Each requested record must contain its matching
   * pending candidate. The caller owns access control and binds
   * button[data-review-read] to an explicit read-receipt operation only.
   * unreadCount, when supplied, is the server's count in the current scope.
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

  function createdText(value, unavailable = '등록 시각 미제공') {
    if (!text(value)) return unavailable;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return unavailable;
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

  function validReviewRequest(request) {
    return request && typeof request === 'object' && text(request.id)
      && request.status === 'requested' && request.channel === 'in_app'
      && request.recipient_role === 'kb_admin' && validCandidate(request.candidate)
      && request.candidate_id === request.candidate.id
      && request.kb_id === request.candidate.kb_id
      && request.kb_version === request.candidate.kb_version
      && request.field === request.candidate.field
      && (request.read_at == null || text(request.read_at));
  }

  function renderReviewRequest(request, options) {
    const read = request.read_at != null;
    return `<li class="support-kb-pending-item"><article class="support-kb-review-card" data-review-request="${esc(request.id)}">
      <div class="support-kb-pending-card-heading"><h4>KB 관리자에게 확정 요청</h4><span class="support-kb-pending-badge" data-review-status="requested">확정 요청</span><span class="support-kb-review-read-state">${read ? '관리자가 읽음 · 확정 전' : '안 읽음 · 확정 전'}</span></div>
      <dl class="support-kb-pending-meta">
        <div><dt>요청자</dt><dd>${esc(text(request.requested_by) ? request.requested_by : '미제공')}</dd></div>
        <div><dt>요청 시각</dt><dd>${esc(createdText(request.requested_at, '요청 시각 미제공'))}</dd></div>
        ${read ? `<div><dt>읽은 관리자</dt><dd>${esc(text(request.read_by) ? request.read_by : '미제공')}</dd></div><div><dt>읽은 시각</dt><dd>${esc(createdText(request.read_at, '읽음 시각 미제공'))}</dd></div>` : ''}
      </dl>
      <ul class="support-kb-pending-list support-kb-review-candidate">${renderCandidate(request.candidate, {})}</ul>
      ${read ? '' : `<button type="button" class="support-kb-pending-select" data-review-read="${esc(request.id)}" aria-label="${esc(fieldLabel(request.field) + ': ' + request.candidate.value + ' · 확정 요청 읽음 표시')}"${options.busy === true ? ' disabled' : ''}>읽음 표시</button>`}
    </article></li>`;
  }

  function renderReviewRequests(requests, options = {}) {
    options = options && typeof options === 'object' ? options : {};
    const rows = (Array.isArray(requests) ? requests : []).filter(validReviewRequest);
    const visibleUnread = rows.filter(request => request.read_at == null).length;
    const hasUnreadCount = Number.isSafeInteger(options.unreadCount) && options.unreadCount >= 0;
    const unread = hasUnreadCount ? options.unreadCount : visibleUnread;
    return `<section class="support-kb-pending support-kb-review-inbox" aria-label="KB 관리자 확정 요청함">
      <div class="support-kb-pending-heading"><h3>KB 관리자 확정 요청함</h3><span>표시된 요청 ${rows.length}건</span><span>${hasUnreadCount ? '전체' : '표시된 요청 중'} 안 읽음 ${unread}건</span></div>
      <p class="support-kb-pending-notice">앱 안에서 받은 확정 요청입니다. 읽음 표시는 열람 여부만 기록하며 후보를 확정·승인·게시하지 않습니다.</p>
      ${rows.length ? `<ul class="support-kb-pending-list">${rows.map(request => renderReviewRequest(request, options)).join('')}</ul>` : '<p class="support-kb-pending-empty">표시할 확정 요청이 없습니다.</p>'}
    </section>`;
  }

  root.KnowHowSupportPending = Object.freeze({ renderCandidates, renderBadge, renderReviewRequests });
})(window);
