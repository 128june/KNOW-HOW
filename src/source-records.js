/* Public source records: browser memory only. No network, credentials, or scenario storage. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KnowHowSourceRecords = api;
})(typeof window === 'undefined' ? undefined : window, function () {
  'use strict';
  const MAX_BYTES = 64 * 1024;
  const MAX_LINES = 2000;
  const copy = value => JSON.parse(JSON.stringify(value));
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const categories = {policy:'업무 정책', data:'부서별 데이터 구조', guide:'문서·업무 가이드'};
  const SAMPLE_SPECS = [
    {
      id:'sample-policy-v1', title:'충전기 문의 전 확인할 기준', filename:'sample-policy.md', category:'policy',
      source:{kind:'bundled-sample', label:'체험에 포함된 가상 정책 메모 · 외부 서비스 연결 없음'},
      rawText:[
        '# 충전기 문의 전 확인할 기준',
        '샘플 문서입니다. 실제 조직의 정책이나 승인 기록이 아닙니다.',
        '',
        '## 대상과 확인 순서',
        'GS타워(서울특별시 강남구 논현로 508), 운영사 GS차지비, 환경부 충전기 ID 01을 함께 대조합니다.',
        '환경부 충전기 ID 01만으로 전국의 장비나 내부 시스템 대상을 특정하지 않습니다.',
        '',
        '## 문의하는 사람과 받을 부서',
        '앱 오류를 확인한 구성원은 앱개발팀에 문의합니다. 앱개발팀 샘플 ID와 오류 화면을 함께 전달합니다.',
        '장비 이상을 확인한 구성원은 충전기개발팀에 문의합니다. 충전기개발팀 샘플 ID, 장비 로그와 발생 증상을 함께 전달합니다.',
        '',
        '## 예외와 적용 기간',
        '주소·운영사·공개 ID가 일치하지 않거나 실제 운영 매핑을 확인하지 못하면 문의 대상을 확정하지 않고 담당자 확인을 요청합니다.',
        '예시 적용 기간은 2026-09-01부터 2026-12-31까지입니다. 기간 밖에서는 기준을 다시 확인합니다.',
        '기준이 바뀌면 원문은 그대로 두고, 변경 이유와 근거를 적은 별도 지식 버전을 남깁니다.'
      ].join('\n')
    },
    {
      id:'sample-department-table-v1', title:'부서마다 다른 충전기 ID 읽기', filename:'sample-department-table.md', category:'data',
      source:{kind:'bundled-sample', label:'체험에 포함된 가상 부서 테이블 설명 · 실제 회사 스키마 아님'},
      rawText:[
        '# 부서마다 다른 충전기 ID 읽기',
        '샘플 문서입니다. 아래 테이블, 내부 ID와 대응 관계는 가상 설명용이며 실제 개발 DB에서 조회한 결과가 아닙니다.',
        '',
        '## 공통으로 대조할 공개 정보',
        '장소: GS타워 / 주소: 서울특별시 강남구 논현로 508 / 운영사: GS차지비 / 환경부 충전기 ID: 01',
        '공개 원문 추적키: 178075ad71a94a8f86f182e809d859db:2b949940462649e981395c05ccffec0a:part-000001.sqlite:20183',
        '이 추적키는 보관본의 행을 가리킵니다. 내부 장비 ID나 검증된 연결 관계를 뜻하지 않습니다.',
        '',
        '## 앱개발팀의 테이블',
        'app_development_chargers는 앱에서 조회할 충전기 대상을 설명하는 가상 테이블입니다.',
        'app_charger_id는 앱개발팀 문의에 쓰는 식별자입니다. 샘플값은 DEMO-APP-d9c51dac6e274c75입니다.',
        '공개 ID 01과 같은 문자열이 아니며, 위 장소·운영사·원본 행을 함께 전달해 대응 관계를 확인합니다.',
        '',
        '## 충전기개발팀의 테이블',
        'device_development_chargers는 장비 쪽에서 조회할 대상을 설명하는 가상 테이블입니다.',
        'device_charger_id는 충전기개발팀 문의에 쓰는 식별자입니다. 샘플값은 DEMO-DEVICE-d9c51dac6e274c75입니다.',
        '앱개발팀 ID와 충전기개발팀 ID는 서로 바꿔 쓰지 않습니다. 실제 스키마와 연결 조건은 담당자 확인이 필요합니다.'
      ].join('\n')
    },
    {
      id:'sample-reply-v1', title:'GS타워 01 문의에 대한 가상 담당자 회신', filename:'sample-owner-reply.txt', category:'guide',
      source:{kind:'bundled-sample', label:'체험용으로 작성한 가상 담당자 회신 · 실제 메신저에서 수집하지 않음'},
      rawText:[
        'GS타워 01 문의에 대한 가상 담당자 회신',
        '샘플 대화 기록입니다. 실제 사람의 답변이나 메신저·노션 연결 결과가 아닙니다.',
        '',
        '구성원 민지의 질문',
        'GS타워 충전기 01에서 문제가 생기면 어느 부서에 어떤 정보로 문의하나요?',
        '',
        '가상 앱개발팀 담당자 지훈의 회신',
        '앱개발팀은 앱개발팀이 사용하는 샘플 충전기 ID DEMO-APP-d9c51dac6e274c75를 기준으로 확인합니다. 환경부 충전기 ID 01, GS타워 주소와 운영사를 함께 대조한 뒤 앱 오류 화면을 전달하세요. 실제 운영 시스템의 대응 관계는 별도 확인이 필요합니다.',
        '',
        '가상 충전기개발팀 담당자 서연의 회신',
        '충전기개발팀은 충전기개발팀이 사용하는 샘플 충전기 ID DEMO-DEVICE-d9c51dac6e274c75를 기준으로 확인합니다. 환경부 충전기 ID 01, GS타워 주소와 운영사를 함께 대조한 뒤 장비 로그와 발생 증상을 전달하세요. 실제 장비 대응 관계는 별도 확인이 필요합니다.',
        '',
        '지식으로 남길 때의 주의',
        '이 회신은 v1 예시를 설명합니다. 이후 정정한 지식의 근거가 자동으로 되는 것은 아닙니다.',
        '회신 원문과 수집 시각은 보존하고, 지식 정정은 이유를 적어 별도 버전으로 남깁니다.'
      ].join('\n')
    }
  ];
  const CONFLICT_SPECS = [
    {id:'sample-conflict-screen-v1', title:'화면만 전달하는 가상 문의 기준 A', rule:'앱 오류 문의에는 오류 화면만 제출합니다.'},
    {id:'sample-conflict-logs-v1', title:'요청 시각과 오류코드를 요구하는 가상 문의 기준 B', rule:'앱 오류 문의에는 요청 시각과 오류코드를 반드시 제출합니다.'}
  ].map(spec => ({id:spec.id, title:spec.title, filename:spec.id + '.md', category:'policy', source:{kind:'bundled-sample', label:'체험용으로 작성한 상충 문서 · 실제 조직 기준 아님'}, rawText:[
    '# ' + spec.title,
    '샘플 문서입니다. 충돌하는 근거를 비교하기 위한 가상 문서이며 실제 정책이나 승인 기록이 아닙니다.',
    '',
    '대상: GS타워 / 환경부 충전기 ID 01 / 앱개발팀',
    '예시 적용 기간: 2026-09-01 ~ 2026-12-31',
    '문의 기준: ' + spec.rule,
    '확인 상태: 가상 문서 간 상충 · 어느 쪽이 최신인지 또는 우선하는지 확인되지 않음',
    '다른 문서의 같은 대상·같은 기간 기준과 비교하고 담당자의 확인을 요청합니다.'
  ].join('\n')}));

  function structure(rawText) {
    // rawText remains byte-for-byte decodable; the index alone splits line endings.
    const lines = rawText.split(/\r\n|\n|\r/).map((text, i) => ({number:i + 1, text}));
    const paragraphs = [];
    let start = null;
    for (let i = 0; i <= lines.length; i++) {
      if (i < lines.length && lines[i].text.trim()) { if (start === null) start = i; }
      else if (start !== null) {
        paragraphs.push({id:'p' + (paragraphs.length + 1), startLine:start + 1, endLine:i, text:lines.slice(start, i).map(line => line.text).join('\n')});
        start = null;
      }
    }
    return {lines, paragraphs};
  }
  function sampleCatalog() {
    return SAMPLE_SPECS.map(spec => ({...copy(spec), sample:true, collectedAt:null, sha256:null, ...structure(spec.rawText)}));
  }
  function conflictCatalog() {
    return CONFLICT_SPECS.map(spec => ({...copy(spec), sample:true, collectedAt:null, sha256:null, ...structure(spec.rawText), citation:{recordId:spec.id, startLine:4, endLine:8, label:spec.title}}));
  }
  const previewCatalog = () => [...sampleCatalog(), ...conflictCatalog()];
  function citationsFor({department = 'app', category = 'guide', version = 1} = {}) {
    if (!['app', 'device'].includes(department) || !Object.prototype.hasOwnProperty.call(categories, category)) throw Error('부서와 지식 분류를 확인하세요.');
    const refs = category === 'policy'
      ? [{recordId:'sample-policy-v1', startLine:4, endLine:15, label:'정책 메모 · 대상·절차·예외·적용 기간'}]
      : category === 'data'
        ? [{recordId:'sample-department-table-v1', startLine:4, endLine:7, label:'공개 원문과 대조할 맥락'}, {recordId:'sample-department-table-v1', startLine:department === 'app' ? 9 : 14, endLine:department === 'app' ? 12 : 17, label:'부서 테이블과 ID의 의미'}]
        : [{recordId:'sample-reply-v1', startLine:department === 'app' ? 7 : 10, endLine:department === 'app' ? 8 : 11, label:'가상 담당자 회신'}, {recordId:'sample-policy-v1', startLine:12, endLine:15, label:'적용 범위와 정정 원칙'}];
    return refs.map(ref => ({...ref, sample:true, initialVersion:1, historical:version > 1, label:ref.label + (version > 1 ? ' · 초기 예시 출처, 현재 정정 근거 아님' : '')}));
  }
  async function sha256(bytes) {
    const webcrypto = globalThis.crypto || (typeof require === 'function' ? require('node:crypto').webcrypto : null);
    if (!webcrypto?.subtle) throw Error('SHA-256을 계산할 수 없습니다. HTTPS 또는 localhost에서 열어주세요.');
    return Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function range(record, startLine = 1, endLine = record.lines.length) {
    if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine || endLine > record.lines.length) throw Error('원문에 있는 줄번호 범위를 입력하세요.');
    return {recordId:record.id, startLine, endLine, text:record.lines.slice(startLine - 1, endLine).map(line => line.text).join('\n'), paragraphIds:record.paragraphs.filter(p => p.startLine <= endLine && p.endLine >= startLine).map(p => p.id)};
  }
  function nonempty(value, label, max = MAX_BYTES) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(label + '을(를) 입력하고 길이를 확인하세요.');
    return value;
  }
  function createStore({now = () => new Date().toISOString(), onChange} = {}) {
    const records = new Map(), originals = new Map(), drafts = new Map(), listeners = new Set();
    let sequence = 0, collecting = null;
    if (onChange) listeners.add(onChange);
    const snapshot = () => copy({records:[...records.values()], drafts:[...drafts.values()]});
    const changed = () => { for (const listener of listeners) listener(snapshot()); };
    const required = id => {const record = records.get(id); if (!record) throw Error('먼저 원문을 입수하세요.'); return record;};
    function createDraft(input) {
      const record = required(input.recordId), citation = range(record, input.startLine, input.endLine);
      const category = input.category || record.category || 'guide';
      if (!Object.prototype.hasOwnProperty.call(categories, category)) throw Error('지식 분류를 확인하세요.');
      const draft = {id:'source-draft-' + (++sequence), recordId:record.id, title:nonempty(input.title || record.title, '제목', 300), category, sample:record.sample, citations:[{recordId:record.id, startLine:citation.startLine, endLine:citation.endLine}], versions:[{version:1, content:nonempty(input.content === undefined ? citation.text : input.content, '초안 본문'), reason:'원문에서 만든 미확인 초안', createdAt:now(), state:'draft'}]};
      drafts.set(draft.id, draft); changed(); return copy(draft);
    }
    const api = {
      listRecords:() => copy([...records.values()]),
      getRecord:id => records.has(id) ? copy(records.get(id)) : null,
      listDrafts:() => copy([...drafts.values()]),
      getDraft:id => drafts.has(id) ? copy(drafts.get(id)) : null,
      subscribe(listener) {listeners.add(listener); return () => listeners.delete(listener);},
      async collectSample(id) {
        if (records.has(id)) return copy(records.get(id));
        const spec = previewCatalog().find(record => record.id === id);
        if (!spec) throw Error('준비된 샘플 원문을 찾을 수 없습니다.');
        const bytes = new TextEncoder().encode(spec.rawText), hash = await sha256(bytes);
        // Another explicit collection may have completed while hashing.
        if (records.has(id)) return copy(records.get(id));
        const record = {...spec, sha256:hash, byteLength:bytes.length, collectedAt:now()};
        records.set(id, record); originals.set(id, bytes); changed(); return copy(record);
      },
      async collectSamples() {
        if (collecting) return copy(await collecting);
        collecting = (async () => {
          const pending = [];
          for (const spec of sampleCatalog()) {
            if (records.has(spec.id)) continue;
            const bytes = new TextEncoder().encode(spec.rawText);
            pending.push({record:{...spec, sha256:await sha256(bytes), byteLength:bytes.length}, bytes});
          }
          const collectedAt = now();
          for (const {record, bytes} of pending) {if (!records.has(record.id)) {record.collectedAt = collectedAt; records.set(record.id, record); originals.set(record.id, bytes);}}
          if (pending.length) changed();
          return SAMPLE_SPECS.map(spec => copy(records.get(spec.id)));
        })();
        try {return copy(await collecting);} finally {collecting = null;}
      },
      async importFile(file) {
        if (!file || typeof file.name !== 'string' || !/\.(txt|md)$/i.test(file.name)) throw Error('UTF-8 TXT 또는 MD 파일을 선택하세요.');
        if (file.name.length > 255 || !Number.isFinite(file.size) || file.size > MAX_BYTES || file.size < 1) throw Error('파일은 1바이트부터 64 KiB까지 읽을 수 있습니다.');
        if (typeof file.arrayBuffer !== 'function') throw Error('파일을 읽을 수 없습니다. 다시 선택하세요.');
        const bytes = new Uint8Array(await file.arrayBuffer()).slice();
        if (bytes.length > MAX_BYTES || bytes.length < 1) throw Error('파일은 1바이트부터 64 KiB까지 읽을 수 있습니다.');
        let rawText;
        try {rawText = new TextDecoder('utf-8', {fatal:true, ignoreBOM:true}).decode(bytes);} catch {throw Error('UTF-8 텍스트를 읽지 못했습니다. 파일 인코딩을 확인하세요.');}
        if (!rawText.trim() || rawText.includes('\0')) throw Error('내용이 있는 UTF-8 텍스트 메모를 선택하세요.');
        const indexed = structure(rawText);
        if (indexed.lines.length > MAX_LINES) throw Error('짧은 메모는 최대 2,000줄까지 읽을 수 있습니다.');
        const hash = await sha256(bytes);
        const existing = [...records.values()].find(record => !record.sample && record.filename === file.name && record.sha256 === hash);
        if (existing) return copy(existing);
        const record = {id:'local-source-' + (++sequence), title:file.name, filename:file.name, category:'guide', rawText, ...indexed, sha256:hash, byteLength:bytes.length, collectedAt:now(), sample:false, source:{kind:'local-file', label:'사용자가 선택한 로컬 파일 ' + file.name + ' · 이 탭에서만 읽음'}};
        records.set(record.id, record); originals.set(record.id, bytes);
        createDraft({recordId:record.id});
        return copy(record);
      },
      createDraft,
      reviseDraft(id, {content, reason}) {
        const draft = drafts.get(id);
        if (!draft) throw Error('초안을 찾지 못했습니다.');
        const version = {version:draft.versions[0].version + 1, content:nonempty(content, '초안 본문'), reason:nonempty(reason, '정정 이유', 1000), createdAt:now(), state:'draft'};
        draft.versions.unshift(version); changed(); return copy(draft);
      },
      resolveCitation(ref) {
        const record = required(ref.recordId);
        return {...range(record, ref.startLine, ref.endLine), record:copy(record)};
      },
      originalBytes(id) {required(id); return originals.get(id).slice();},
      clear() {records.clear(); originals.clear(); drafts.clear(); changed();}
    };
    return api;
  }

  function renderSourceLink(ref, label) {
    return `<button type="button" class="source-record-citation" data-source-citation="${escape(JSON.stringify(ref))}">${escape(label || ref.label || '원문 ' + ref.startLine + '–' + ref.endLine + '줄 보기')}</button>`;
  }
  function bindCitationLinks(container, {onOpen} = {}) {
    const handler = event => {
      const button = event.target.closest('[data-source-citation]');
      if (!button || !container.contains(button)) return;
      try {if (onOpen) onOpen(JSON.parse(button.dataset.sourceCitation));} catch { /* Invalid external citation is not followed. */ }
    };
    container.addEventListener('click', handler);
    return () => container.removeEventListener('click', handler);
  }
  const mounts = new WeakMap();
  function mount(container, {store = createStore(), department = 'app'} = {}) {
    if (!container || typeof container.querySelector !== 'function') throw Error('원문 기록을 표시할 영역이 필요합니다.');
    if (mounts.has(container)) mounts.get(container).destroy();
    let selected = null, selectedDraft = null, notice = '', error = '', busy = false, destroyed = false;
    const query = selector => container.querySelector(selector);
    const formatTime = value => value ? new Date(value).toLocaleString('ko-KR') + ' · ' + value : '아직 입수하지 않음';
    function sourceView(record) {
      const ref = selected || {recordId:record.id, startLine:1, endLine:record.lines.length};
      const resolved = range(record, ref.startLine, ref.endLine);
      const collected = Boolean(record.collectedAt);
      const allDrafts = store.listDrafts().filter(draft => draft.recordId === record.id);
      return `<section class="source-record-detail" tabindex="-1" aria-label="선택한 원문"><div class="row"><h3>${escape(record.title)}</h3><span class="badge ${record.sample ? 'warn' : ''}">${record.sample ? '가상 샘플' : '내 파일 · 미확인'}</span></div><p>${collected ? '입수한 원문 · 수정할 수 없음' : '준비된 원문 미리보기 · 아직 입수하지 않음'}</p>${ref.historical ? '<p class="notice">초기 v1 예시의 출처입니다. 정정된 최신 지식의 근거로 자동 적용하지 않습니다.</p>' : ''}<dl class="source-record-meta"><dt>출처</dt><dd>${escape(record.source.label)}</dd><dt>파일명</dt><dd>${escape(record.filename)}</dd><dt>이 탭의 입수 시각</dt><dd>${escape(formatTime(record.collectedAt))}</dd><dt>원문 SHA-256</dt><dd style="overflow-wrap:anywhere">${record.sha256 || '명시적으로 입수한 뒤 원문 바이트에서 계산합니다.'}</dd></dl><p>참조 위치: ${resolved.paragraphIds.map(id => escape(id.replace('p', '문단 '))).join(', ')} · ${resolved.startLine}–${resolved.endLine}줄</p><div class="source-record-lines" role="region" aria-label="줄번호가 있는 원문" tabindex="0">${record.lines.map(line => `<div data-source-line="${line.number}"${line.number >= resolved.startLine && line.number <= resolved.endLine ? ' class="source-line-selected"' : ''} style="display:flex;gap:12px;${line.number >= resolved.startLine && line.number <= resolved.endLine ? 'background:#eff6ff;' : ''}"><span aria-label="${line.number}줄" style="flex:0 0 3ch;user-select:none;color:#64748b">${line.number}</span><span style="white-space:pre-wrap;overflow-wrap:anywhere;min-width:0">${escape(line.text) || ' '}</span></div>`).join('')}</div><details><summary>줄번호 없는 원문 그대로 보기</summary><pre class="source source-record-raw" style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(record.rawText)}</pre></details><div class="actions">${collected ? `<button type="button" data-source-action="create-draft">이 원문으로 KB 초안 남기기</button><button type="button" data-source-action="download">원본 파일 저장</button>` : '<button type="button" data-source-action="collect-selected">이 샘플 원문 입수하기</button><p class="muted">입수 버튼으로 출처와 입수 시각을 기록한 뒤 초안을 남길 수 있습니다.</p>'}</div>${allDrafts.length ? `<p>이 원문에서 만든 초안</p><div class="actions">${allDrafts.map(d => `<button type="button" data-source-draft="${escape(d.id)}">${escape(d.title)} · v${d.versions[0].version} · 미확인 초안</button>`).join('')}</div>` : ''}</section>`;
    }
    function draftView(draft) {
      const current = draft.versions[0];
      return `<section class="source-record-draft"><h3>원문에서 남긴 KB 초안</h3><p><span class="badge warn">${draft.sample ? '가상 샘플 · ' : ''}미확인 초안 · v${current.version}</span> · ${escape(categories[draft.category])}</p><p>담당자의 확인이나 조직 KB 저장을 뜻하지 않습니다. 원문은 유지하고 초안만 새 버전으로 정정합니다.</p><div class="actions">${draft.citations.map(ref => renderSourceLink(ref, '초안의 원문 · ' + ref.startLine + '–' + ref.endLine + '줄')).join('')}</div><form data-source-form="revise"><label>초안 본문<textarea name="content" rows="7" required maxlength="65536">${escape(current.content)}</textarea></label><label>정정 이유<input name="reason" required maxlength="1000" placeholder="어떤 내용을 왜 바꾸는지 적어 주세요"></label><button class="primary">새 초안 버전으로 남기기</button></form><details><summary>초안 버전 이력 · ${draft.versions.length}개</summary>${draft.versions.map(v => `<article><h4>v${v.version} · 미확인 초안</h4><p>${escape(v.reason)} · ${escape(formatTime(v.createdAt))}</p><pre class="source" style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(v.content)}</pre></article>`).join('')}</details></section>`;
    }
    function render() {
      if (destroyed) return;
      const records = store.listRecords(), samples = sampleCatalog(), locals = records.filter(record => !record.sample);
      const record = selected ? store.getRecord(selected.recordId) || previewCatalog().find(item => item.id === selected.recordId) : null;
      const draft = selectedDraft ? store.getDraft(selectedDraft) : null;
      container.innerHTML = `<section class="card source-records"><h2>원문 기록에서 지식으로</h2><p>정책 메모 → 부서 테이블 설명 → 담당자 회신을 읽고, KB가 어느 원문과 문단에서 왔는지 확인하세요.</p><p class="muted">가상 샘플 3종이 포함되어 있습니다. 실제 노션·메신저·개발 DB에 연결하지 않습니다.</p><div class="actions">${samples.map(sample => `<button type="button" data-source-record="${sample.id}">${escape(categories[sample.category])} 원문 · ${store.getRecord(sample.id) ? '입수됨' : '미리보기'}</button>`).join('')}</div><div class="actions"><button type="button" class="primary" data-source-action="collect" ${busy ? 'disabled' : ''}>${SAMPLE_SPECS.every(item => store.getRecord(item.id)) ? '샘플 3종 입수됨 · 원문 다시 보기' : '샘플 원문 3종 입수하기'}</button></div><p>입수는 이 버튼을 누를 때 실행됩니다. 기록된 시각은 이 탭에 가져온 시각이며 문서의 업무 적용일과 다릅니다.</p><form data-source-form="import"><h3>내 짧은 메모 읽기</h3><label>UTF-8 TXT 또는 MD · 최대 64 KiB, 2,000줄<input type="file" name="source-file" accept=".txt,.md,text/plain,text/markdown" required></label><button ${busy ? 'disabled' : ''}>선택한 파일을 읽고 초안 남기기</button></form><p class="notice">내 파일의 원문·파일명·입수 시각·SHA-256·줄번호와 초안은 이 탭 메모리에만 있습니다. 서버·AI로 전송하지 않습니다. 새로고침하거나 탭을 닫으면 사라집니다.</p>${locals.length ? `<h3>이 탭에서 읽은 파일 · ${locals.length}개</h3><div class="actions">${locals.map(item => `<button type="button" data-source-record="${escape(item.id)}">${escape(item.filename)} · 미확인</button>`).join('')}</div>` : ''}<p role="status" aria-live="polite">${escape(notice)}</p>${error ? `<p role="alert">${escape(error)}</p>` : ''}${record ? sourceView(record) : '<p class="muted">원문을 선택하면 문단과 줄번호를 함께 볼 수 있습니다.</p>'}${draft ? draftView(draft) : ''}${records.length ? '<button type="button" data-source-action="clear">이 탭의 원문과 초안 비우기</button>' : ''}</section>`;
    }
    function select(ref) {
      const record = store.getRecord(ref.recordId) || previewCatalog().find(item => item.id === ref.recordId);
      if (!record) throw Error('해당 원문을 찾을 수 없습니다.');
      range(record, ref.startLine, ref.endLine);
      selected = {...ref}; error = ''; render();
      const detail = query('.source-record-detail');
      if (detail) {detail.focus({preventScroll:true}); detail.scrollIntoView({block:'nearest'});}
      return Boolean(record.collectedAt);
    }
    async function run(action) {
      if (busy) return;
      busy = true; error = ''; notice = '';
      container.querySelectorAll('button').forEach(button => {button.disabled = true;});
      try {await action();} catch (failure) {error = failure.message || '원문을 읽지 못했습니다.';} finally {busy = false; render();}
    }
    async function click(event) {
      const button = event.target.closest('button');
      if (!button || !container.contains(button)) return;
      if (button.dataset.sourceCitation) {try {select(JSON.parse(button.dataset.sourceCitation));} catch (failure) {error = failure.message; render();} return;}
      if (button.dataset.sourceRecord) {selectedDraft = store.listDrafts().find(d => d.recordId === button.dataset.sourceRecord)?.id || null; select({recordId:button.dataset.sourceRecord}); return;}
      if (button.dataset.sourceDraft) {selectedDraft = button.dataset.sourceDraft; render(); return;}
      const action = button.dataset.sourceAction;
      if (action === 'collect') await run(async () => {await store.collectSamples(); selected = selected || citationsFor({department, category:'guide'})[0]; notice = '가상 원문 3종의 출처·입수 시각·SHA-256을 이 탭에 남겼습니다.';});
      if (action === 'collect-selected') await run(async () => {await store.collectSample(selected.recordId); notice = '선택한 가상 원문의 출처·입수 시각·SHA-256을 이 탭에 남겼습니다.';});
      if (action === 'create-draft') await run(() => {const record = store.getRecord(selected.recordId); const citation = range(record, selected.startLine, selected.endLine); const draft = store.createDraft({recordId:record.id, startLine:citation.startLine, endLine:citation.endLine, content:citation.text}); selectedDraft = draft.id; notice = '원문 출처를 연결한 미확인 초안을 남겼습니다.';});
      if (action === 'download') await run(() => {const record = store.getRecord(selected.recordId), url = URL.createObjectURL(new Blob([store.originalBytes(record.id)], {type:'application/octet-stream'})); const link = container.ownerDocument.createElement('a'); link.href = url; link.download = record.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notice = '입수한 원본 바이트로 파일 저장을 요청했습니다.';});
      if (action === 'clear') {store.clear(); selected = null; selectedDraft = null; notice = '이 탭의 원문과 초안을 비웠습니다.'; error = ''; render();}
    }
    async function submit(event) {
      const form = event.target;
      if (!form.dataset.sourceForm) return;
      event.preventDefault();
      if (form.dataset.sourceForm === 'import') {const file = form.querySelector('input[type=file]').files[0]; await run(async () => {const record = await store.importFile(file); selected = {recordId:record.id}; selectedDraft = store.listDrafts().find(draft => draft.recordId === record.id)?.id; notice = '파일을 이 탭에서 읽고, 원문을 보존한 미확인 초안으로 남겼습니다.';});}
      if (form.dataset.sourceForm === 'revise') {const content = form.elements.namedItem('content').value, reason = form.elements.namedItem('reason').value; await run(() => {store.reviseDraft(selectedDraft, {content, reason}); notice = '원문을 유지하고 별도 초안 버전을 남겼습니다.';});}
    }
    container.addEventListener('click', click);
    container.addEventListener('submit', submit);
    const view = {openCitation:select, render, store, destroy() {destroyed = true; container.removeEventListener('click', click); container.removeEventListener('submit', submit); mounts.delete(container);}};
    mounts.set(container, view); render(); return view;
  }
  return Object.freeze({createStore, sampleCatalog, conflictCatalog, citationsFor, renderSourceLink, bindCitationLinks, mount, MAX_BYTES, MAX_LINES});
});
