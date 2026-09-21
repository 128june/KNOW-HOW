/* Fictional definitions and exceptions. Personal drafts never imply team publication. */
(function(root){'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const readableContent=v=>String(v??'').includes('\n')?esc(v):esc(v).replace(/\. /g,'.<br>').replace(/; /g,';<br>');
 const seeds=[
  {
    "id": "general-revenue-v2",
    "title": "매출 집계: 결제일과 정산일",
    "department": "finance",
    "identifier": "DEMO-REVENUE-002",
    "filename": "sample-revenue-basis-v2.md",
    "scenario_version": 2,
    "content": "정책과 DB는 가상이며, 실제 회계기준이 아닙니다.\n2026-09-01~12-31에 적용합니다. 다른 기간이나 계약에 소급 적용하지 않습니다.\n운영매출은 payments.paid_at의 한국시간 월로 집계합니다.\nsettlements.settled_at은 입금 대사에만 씁니다. 9월 30일 결제하고 10월 2일 정산하면 9월 매출입니다.\n취소·테스트 건은 제외합니다.\n부분 환불액은 refunds.completed_at의 월에 차감합니다.\n재무팀은 기준과 계약 예외를 확정합니다. 데이터팀은 집계식을 관리합니다.\n근거는 REV-2026-09 §2·4입니다.\n2026-09-21의 확인은 가상이며, 실제 승인이 아닙니다.",
    "correction": "정책과 DB는 가상이며, 실제 회계기준이 아닙니다.\n2026-09-01~12-31에 적용합니다. 다른 기간이나 계약에 소급 적용하지 않습니다.\n운영매출은 payments.paid_at의 한국시간 월로 집계합니다.\nsettlements.settled_at은 입금 대사에만 씁니다. 9월 30일 결제하고 10월 2일 정산하면 9월 매출입니다.\n취소·테스트 건은 제외합니다.\n전액·부분 환불은 refunds.completed_at의 월에 실제 환불액을 차감합니다. 미완료 환불은 제외합니다.\n9월 결제 10만원을 10월에 전액 환불하면 9월 매출은 유지하고, 10월 매출에서 10만원을 뺍니다.\n재무팀은 기준과 계약 예외를 확정합니다. 데이터팀은 집계식을 관리합니다.\n근거는 REV-2026-09 §2·4입니다.\n2026-09-21의 확인은 가상이며, 실제 승인이 아닙니다.",
    "owner": "재무팀",
    "category": "매출 집계 기준",
    "question": "9월 30일 결제한 주문이 10월 2일 입금됐습니다. 어느 달 매출인가요?",
    "problem": "영업 보고서는 9월, 정산 보고서는 10월에 같은 주문을 담습니다. 새 보고서를 만들 때마다 어느 숫자를 써야 하는지 재무팀에 다시 묻습니다.",
    "gap": "결제일과 정산일 열은 있지만, 보고 목적에 따라 어떤 날짜와 금액을 써야 하는지는 거래 행만으로 알 수 없습니다.",
    "finding": "운영매출은 결제일, 입금 대사는 정산일을 씁니다. 두 보고서의 금액이 다르다고 곧바로 오류는 아닙니다.",
    "example": "가상 주문 R-101: 9월 30일 결제 100,000원 → 10월 2일 수수료 공제 후 입금 97,000원. 9월 운영매출은 100,000원, 10월 입금 대사는 97,000원입니다.",
    "raw": "payments: R-101 / paid_at=2026-09-30 / amount=100000 / status=paid\nsettlements: R-101 / settled_at=2026-10-02 / net_amount=97000\n두 행에는 보고 목적과 환불 귀속 기준이 적혀 있지 않습니다.",
    "basis": "가상 운영매출 정의서 REV-2026-09 §2·§4, 재무팀 지표 구분 회신(2026-09-21)",
    "correctionBasis": "가상 정의서 REV-2026-09 §4 보완 회신(2026-09-21)",
    "correctionExtra": "보완 조건: 부분 환불뿐 아니라 전액 환불도 환불 완료월에 실제 환불액을 차감합니다. 접수만 된 미완료 환불은 차감하지 않습니다. 9월 결제 100,000원을 10월 3일 전액 환불했다면 9월 결제 기록은 유지하고 10월 운영매출에서 100,000원을 차감합니다.",
    "reason": "정의서에 부분 환불만 적혀 있어 전액 환불과 미완료 환불을 어느 달에 반영할지 다시 문의하게 됩니다.",
    "reuseQuestion": "다음 달 보고 담당자입니다. 9월 결제를 10월에 전액 환불하면 9월 실적을 지우나요?",
    "reuseOutcome": "다음 담당자는 운영매출 보고에는 결제·환불 완료월, 입금 대사에는 정산일을 선택합니다. 서로 다른 숫자의 이유를 설명하고 필요한 대사만 같은 조건으로 수행합니다.",
    "schema": "payments.paid_at: 운영매출의 결제 귀속 시각\npayments.amount: 결제 금액\nsettlements.settled_at / net_amount: 입금 대사 시각과 실입금액\nrefunds.completed_at / amount: 환불 완료 시각과 차감액",
    "guide": "보고 목적 확인 → 적용 기간·계약 확인 → 해당 날짜·금액 선택 → 환불 완료 여부 반영 → 기준 버전과 출처를 보고서에 함께 남기기"
  },
  {
    "id": "general-customer-identity-v2",
    "title": "고객 중복 집계: 계정·법인·고객키",
    "department": "data",
    "identifier": "DEMO-CUSTOMER-002",
    "filename": "sample-customer-identity-v2.md",
    "scenario_version": 2,
    "content": "정책과 DB는 가상입니다.\n2026-09-01~12-31에 적용합니다. 다른 기간이나 계약에는 적용하지 않습니다.\n해당 월에 결제를 완료한 고객의 수를 셉니다. 기준일에 유효한 identity_map.canonical_customer_key를 중복 없이 집계합니다.\naccount_id는 로그인 계정, legal_entity_id는 계약 법인입니다. 둘 다 고객 수를 세는 키가 아닙니다.\n같은 고객키의 여러 계정은 1명으로 셉니다. 같은 법인도 고객키가 다르면 별도로 셉니다.\n고객키 연결이 없거나 상충하면 미확정으로 따로 표시합니다. 임의로 합치지 않습니다.\n테스트·취소 건은 제외합니다.\n데이터팀은 고객키 연결을 맡고, 고객운영팀은 동일 고객인지 확인합니다.\n근거는 CUST-2026-09 §1·3입니다.\n2026-09-21의 확인은 가상이며, 실제 승인이 아닙니다.",
    "correction": "정책과 DB는 가상입니다.\n2026-09-01~12-31에 적용합니다. 다른 기간이나 계약에는 적용하지 않습니다.\n해당 월에 결제를 완료한 고객의 수를 셉니다. 기준일에 유효한 identity_map.canonical_customer_key를 중복 없이 집계합니다.\naccount_id는 로그인 계정, legal_entity_id는 계약 법인입니다. 둘 다 고객 수를 세는 키가 아닙니다.\n같은 고객키의 여러 계정은 1명으로 셉니다. 같은 법인도 고객키가 다르면 별도로 셉니다.\n과거 수치를 다시 계산할 때는 당시 연결표를 씁니다. 최신 고객키로 바꾸지 않습니다.\n법인명이나 이메일만으로 합치지 않습니다.\n고객키 연결이 없거나 상충하거나 근거가 없으면 미확정으로 따로 표시합니다.\n테스트·취소 건은 제외합니다.\n데이터팀은 고객키 연결을 맡고, 고객운영팀은 동일 고객인지 확인합니다.\n근거는 CUST-2026-09 §1·3입니다.\n2026-09-21의 확인은 가상이며, 실제 승인이 아닙니다.",
    "owner": "데이터팀",
    "category": "고객 중복 집계 기준",
    "question": "계정은 3개이고 계약 법인은 1곳입니다. 유료 고객 수는 몇 명으로 세나요?",
    "problem": "서비스팀은 계정 수, 계약 담당자는 법인 수를 말합니다. 같은 고객 지표를 만들 때마다 무엇을 중복 제거할지 데이터팀에 다시 묻습니다.",
    "gap": "계정 ID·법인 ID·고객키가 모두 있어도, 고객 지표의 단위와 어떤 시점의 연결표를 쓸지는 열 이름만으로 알 수 없습니다.",
    "finding": "유료 고객 수는 기준일에 유효한 고객키로 중복을 제거합니다. 로그인 계정 수와 계약 법인 수는 별도 지표입니다.",
    "example": "가상 계정 A1·A2는 고객키 K1, A3는 K2이며 세 계정의 법인은 모두 L1입니다. 해당 월 결제가 확인됐다면 계정 3개·법인 1곳·유료 고객 2명입니다.",
    "raw": "account_id / legal_entity_id / canonical_customer_key\nA1 / L1 / K1\nA2 / L1 / K1\nA3 / L1 / K2\n지표명만 ‘고객 수’이면 무엇을 세는지 확정할 수 없습니다.",
    "basis": "가상 고객 지표 사전 CUST-2026-09 §1·§3, 데이터팀 연결표 확인 회신(2026-09-21)",
    "correctionBasis": "가상 연결표 이력 기준 CUST-2026-09 §3 보완 회신(2026-09-21)",
    "correctionExtra": "보완 조건: 과거 보고서를 다시 계산할 때도 그 보고서의 기준일에 유효했던 연결표를 사용합니다. 오늘의 최신 고객키로 과거 고객 수를 덮어쓰지 않습니다. 법인명이나 이메일이 같다는 이유만으로 계정을 합치지 않으며, 연결 근거가 없으면 미확정으로 남깁니다.",
    "reason": "고객키가 나중에 통합됐을 때 과거 보고서까지 최신 연결표로 바꿔도 되는지 설명이 없어 고객 수가 달라질 수 있습니다.",
    "reuseQuestion": "다음 분석 담당자입니다. 10월에 고객키가 합쳐졌는데 9월 고객 수도 1명으로 다시 계산하나요?",
    "reuseOutcome": "다음 분석자는 고객 수에는 고객키, 계정 수에는 계정 ID, 거래 법인 수에는 법인 ID를 선택합니다. 과거 보고서는 그 기준일의 연결표로 재현합니다.",
    "schema": "accounts.account_id: 로그인 계정\naccounts.legal_entity_id: 계약 법인\nidentity_map.canonical_customer_key: 확인된 고객 집계키\nidentity_map.valid_from / valid_to: 연결표의 적용 기간\npayments.paid_at / status: 해당 월 결제 여부",
    "guide": "보고서 기준일 고정 → 해당 월 유료 결제 확인 → 그 기준일의 연결표 선택 → 확인된 고객키 중복 제거 → 미매핑·상충은 별도 표시"
  },
  {
    "id": "general-refund-fee-v2",
    "title": "환불 수수료 부담: 적용 조건과 시점",
    "department": "operations",
    "identifier": "DEMO-REFUND-002",
    "filename": "sample-refund-fee-v2.md",
    "scenario_version": 2,
    "content": "정책과 DB는 가상이며, 실제 약관이 아닙니다.\n2026-09-01~12-31에 적용합니다. 소급 적용하거나 다른 계약에 적용하지 않습니다.\n환불 접수 시각(refunds.requested_at)의 계약과 확인된 사유로 판단합니다.\n회사 귀책이나 중복 결제는 회사가 부담합니다.\n고객 변심은 고객 부담 조항이 있을 때만 고객이 부담합니다.\n조항이나 귀책이 확정되지 않으면 확인이 필요합니다.\nPG 수수료 면제가 확인되면 0원입니다.\n고객운영팀은 사유와 접수 시각을 확인합니다. 재무팀은 계약 예외와 면제 증빙을 확정합니다.\nrefund_reason은 귀책이나 면제의 증빙이 아닙니다.\n근거는 REF-2026-09 §2·5입니다.\n2026-09-21의 확인은 가상이며, 실제 승인이 아닙니다.",
    "correction": "정책과 DB는 가상이며, 실제 약관이 아닙니다.\n2026-09-01~12-31에 적용합니다. 소급 적용하거나 다른 계약에 적용하지 않습니다.\n환불 접수 시각(refunds.requested_at)의 계약과 확인된 사유로 판단합니다.\n회사 귀책이나 중복 결제는 회사가 부담합니다.\n고객 변심은 고객 부담 조항이 있을 때만 고객이 부담합니다.\n조항이나 귀책이 확정되지 않으면 확인이 필요합니다.\n면제 신청은 확정이 아닙니다.\n재무팀이 증빙으로 확정한 면제액만 빼고, 남은 금액은 기존 부담 기준을 따릅니다.\n전액 면제면 0원입니다. 고객 부담 3,000원 중 1,000원이 면제되면 2,000원입니다.\n고객운영팀은 사유와 접수 시각을 확인합니다. 재무팀은 계약 예외와 면제 증빙을 확정합니다.\nrefund_reason은 귀책이나 면제의 증빙이 아닙니다.\n근거는 REF-2026-09 §2·5입니다.\n2026-09-21의 확인은 가상이며, 실제 승인이 아닙니다.",
    "owner": "고객운영팀",
    "category": "환불 수수료 예외",
    "question": "같은 환불인데 어떤 고객에게는 수수료를 받지 않는 이유가 뭔가요?",
    "problem": "한 담당자는 고객 변심이라 고객 부담이라고 하고, 다른 담당자는 결제대행사가 면제하므로 0원이라고 합니다. 다음 요청에서도 누가 맞는지 다시 묻게 됩니다.",
    "gap": "환불 사유와 금액만으로는 적용 계약, 귀책 확인 상태, 수수료 면제 증빙을 알 수 없습니다.",
    "finding": "접수 당시 계약과 확인된 귀책으로 부담 주체를 정하고, 확정된 면제 증빙으로 실제 부담액을 판단합니다. 환불 사유 코드만으로 결론 내리지 않습니다.",
    "example": "가상 환불 F-201: 고객 변심·고객 부담 조항 있음·수수료 3,000원. 전액 면제가 확정되면 0원입니다. 면제 신청만 한 상태라면 0원으로 안내할 근거가 없습니다.",
    "raw": "refunds: F-201 / requested_at=2026-09-21 / refund_reason=고객 변심\n계약: 고객 부담 조항 있음\n면제 요청: 접수됨 / 확정 증빙 없음\n‘면제 요청됨’과 ‘면제 확정됨’은 같은 상태가 아닙니다.",
    "basis": "가상 환불 조건표 REF-2026-09 §2·§5, 고객운영팀·재무팀 조건 확인 회신(2026-09-21)",
    "correctionBasis": "가상 부분 면제·확정 증빙 기준 REF-2026-09 §5 보완 회신(2026-09-21)",
    "correctionExtra": "보완 조건: 면제 신청만으로는 면제 확정으로 보지 않습니다. 재무팀이 증빙과 확정 면제액을 확인한 뒤 반영합니다. 부분 면제는 확정된 면제액만 차감하고 남은 수수료에 기존 부담 기준을 적용합니다. 고객 부담 조항이 있는 변심 환불의 수수료 3,000원 중 1,000원만 면제됐다면 고객 부담액은 2,000원입니다.",
    "reason": "면제 신청과 확정, 전액 면제와 부분 면제를 구분하지 않으면 모든 요청을 0원으로 안내할 수 있습니다.",
    "reuseQuestion": "다음 환불 담당자입니다. 고객 변심 환불의 수수료 3,000원 중 1,000원만 면제됐는데 전액 무료인가요?",
    "reuseOutcome": "다음 환불 담당자는 이번 계약·사유와 확정 면제 증빙으로 남은 부담액을 안내합니다. 이미 확인한 규칙은 재사용하고 근거가 없는 예외만 담당 부서에 묻습니다.",
    "schema": "refunds.requested_at: 적용 계약을 고르는 접수 시점\nrefunds.refund_reason: 확인이 필요한 사유\ncontracts.customer_fee_clause: 고객 부담 조항\nfee_waiver.status / confirmed_amount: 면제 확정 여부와 금액\nfee_waiver.evidence_id: 재무팀이 확인한 증빙",
    "guide": "접수 시점의 계약 확인 → 귀책과 부담 조항 확인 → 면제 확정 증빙·금액 확인 → 남은 수수료에 부담 기준 적용 → 미확정 예외만 담당 부서에 확인"
  }
];

 function createController(){
  const storage='knowhow.general.v2',legacyStorage='knowhow.general.v1';let host=null,tab=1,selected=seeds[0].id,notice='',unmount=null;
  const organization=root.KnowHowOrganizationUI?.createController({apiBase:root.KNOWHOW_CONFIG?.apiBase,samplePack:'general',allowInquiry:true});
  function read(key){let saved;try{saved=JSON.parse(localStorage.getItem(key)||'[]')}catch{throw Error('이 기기에 저장한 기록을 읽지 못했습니다. 기존 내용을 덮어쓰지 않습니다.')}if(!Array.isArray(saved))throw Error('저장된 기록 형식을 확인하세요.');return saved}
  function docs(){const saved=read(storage);return seeds.map(s=>{const d=saved.find(x=>x.id===s.id);if(d&&(!Array.isArray(d.versions)||!d.versions.length||typeof d.versions[0].content!=='string'))throw Error('문서 버전 형식을 확인하세요.');return d||{...s,prepared:true,comments:[],versions:[{version:1,content:s.content,reason:'담당 부서의 기준과 근거를 확인한 가상 예시',validFrom:'2026-09-01',validTo:'2026-12-31'}]}})}
  const current=()=>docs().find(d=>d.id===selected)||docs()[0];
  function save(d,expected){const saved=read(storage),previous=saved.find(x=>x.id===d.id);if(expected!==undefined&&(previous?.versions[0]?.version||1)!==expected)throw Error('다른 탭에서 기준이 정정됐습니다. 최신 내용을 다시 열어 주세요.');localStorage.setItem(storage,JSON.stringify([...saved.filter(x=>x.id!==d.id),{...d,prepared:false}]));}
  function archived(){let records;try{records=read(legacyStorage)}catch{return '<details><summary>이전에 저장한 사례</summary><p>이전 기록 형식을 읽지 못했습니다. 저장된 원본은 변경하지 않았습니다.</p></details>'}if(!records.length)return '';return `<details><summary>이전에 이 기기에 저장한 사례 ${records.length}개</summary><p>새 사례와 별도로 보관합니다. 기존 기록을 삭제하거나 새 내용으로 바꾸지 않았습니다.</p>${records.map(d=>`<article><h3>${esc(d.title||d.id)}</h3><p>이 기기에 저장한 이전 사례 · 아직 팀 공유를 뜻하지 않음</p>${(d.versions||[]).map(v=>`<h4>v${esc(v.version)}</h4><pre class="source">${readableContent(v.content)}</pre>`).join('')}</article>`).join('')}</details>`}
  function source(d){
   const first=d.versions.find(v=>v.version===1),earliest=first||d.versions[d.versions.length-1];
   const originalContent=first?.content??d.content??earliest.content;
   const hasOriginal=!!first||typeof d.content==='string';
   return `<details class="kb-document-sources"><summary>원문·확인 근거·정정 이력</summary>
    <p class="muted">모든 규칙·수치·자료는 가상 예시입니다.</p>
    <dl class="kb-document-meta"><div><dt>원본 파일</dt><dd>${esc(d.filename||'저장된 파일명 없음')}</dd></div>${d.basis?`<div><dt>사례의 확인 근거</dt><dd>${esc(d.basis)}</dd></div>`:''}</dl>
    <h3>처음 받은 자료</h3><pre class="source kb-original">${esc(d.raw??'처음 받은 자료가 이 기록에 저장되어 있지 않습니다.')}</pre>
    <h3>${hasOriginal?'담당 부서가 확인한 최초 기준':'보관된 가장 이른 기준'}</h3><pre class="source kb-original">${readableContent(originalContent)}</pre>
    <h3>정정 이력</h3><p class="muted">최신 본문은 v${esc(d.versions[0].version)}입니다. ${hasOriginal?'저장된 최초 원문은 그대로 유지합니다.':'최초 기준은 이 기록에 남아 있지 않습니다.'}</p>
    ${d.versions.map(v=>`<details class="kb-document-version"><summary>v${esc(v.version)}${v===d.versions[0]?' · 현재 버전':''} · ${esc(v.reason)}</summary><pre class="source kb-original">${readableContent(v.content)}</pre></details>`).join('')}
   </details>`
  }
  function body(d){const v=d.versions[0];return `<article class="kb-document">
   <div class="kb-document-heading"><p class="kb-document-kicker">${esc(d.category)} · 가상 사례</p><h2>${esc(d.title)}</h2></div>
   <dl class="kb-document-meta"><div><dt>기준 부서</dt><dd>${esc(d.owner)}</dd></div><div><dt>현재 버전</dt><dd>v${esc(v.version)}</dd></div><div><dt>적용 기간</dt><dd>${esc(v.validFrom)} ~ ${esc(v.validTo)}</dd></div><div><dt>저장·공유 상태</dt><dd>${d.prepared?'준비된 기준 · 아직 이 기기에 저장하지 않음':'이 기기에 저장됨 · 팀 공유 상태는 별도 확인'}</dd></div></dl>
   <div class="kb-document-excerpt"><p class="kb-document-kicker">준비된 가상 사례의 핵심</p><p>${esc(d.finding)}</p><p class="muted">사례 설명입니다. 현재 버전의 본문은 아래에서 확인하세요.</p></div>
   <details class="kb-document-current" open><summary>적용 조건·예외·출처가 담긴 지식 본문 · v${esc(v.version)}</summary><pre class="source kb-original">${readableContent(v.content)}</pre></details>
   ${v.version>1?`<p class="muted">보완한 이유: ${esc(v.reason)}</p>`:''}${source(d)}
  </article>`}
  function transfer(d){return `<p class="muted">이 기기의 최신 v${d.versions[0].version} 본문으로 공유할 초안을 준비합니다. 등록 뒤 담당자 확인을 마쳐야 팀에서 조회할 수 있습니다. 실제 팀이 아닌 가상 조직 체험입니다.</p><button data-general-transfer="${esc(d.id)}">팀과 공유할 초안 만들기</button>`}
  function render(){if(!host)return;unmount?.();unmount=null;const d=current(),v=d.versions[0];let html='';
   if(tab===1)html=`<section class="card"><h2>${esc(d.question)}</h2><p>${esc(d.problem)}</p><h3>자료는 있는데 무엇을 모르나요?</h3><pre class="source">${esc(d.raw)}</pre><p>${esc(d.gap)}</p><h3>담당 부서에 확인할 내용</h3><p><strong>${esc(d.owner)}</strong>에 이번 업무의 목적·적용일과 함께 기준을 확인합니다.</p><pre class="source">${esc(d.question)}
업무 적용일: 2026-09-21</pre><button data-general-next="2" class="primary">확인한 기준과 근거 보기 →</button></section>`;
   if(tab===2)html=`<section class="card"><h2>한번 확인한 기준을 다음 업무에서도 쓰려면</h2><p>${esc(d.example)}</p>${body(d)}<h3>무엇을 지식으로 남기나요?</h3><p>${esc(d.finding)} 적용 조건·예외·출처·담당 부서·확인일을 함께 남깁니다.</p><p>어떤 상황에 적용하는 기준인지 근거와 함께 남겨, 다음에 담당자를 다시 찾기 전에 확인할 수 있습니다.</p><button id="general-save" class="primary">${d.prepared?'확인한 기준을 지식으로 남기기':'저장한 기준 확인하기'}</button><p class="muted">이 저장은 이 기기에만 반영됩니다. 팀에서 조회할 수 있는지는 공유 영역의 담당자 확인 상태로 구분합니다.</p>${!d.prepared?'<button data-general-share>팀과 공유할 초안 만들기</button>':''}</section><button data-general-next="3">빠진 조건이 있다면? →</button>`;
   if(tab===3)html=`<section class="card">${body(d)}<h3>다시 문의하게 된 빠진 조건</h3><p>${esc(d.reason)}</p>${d.comments.map(c=>`<p>${esc(c.body)} · ${c.resolved?'v'+c.resolved+'에 반영':'확인 대기'}</p>`).join('')}<form id="general-comment"><label>담당 부서에 확인할 조건<textarea name="body" required maxlength="1000">${esc(d.reason)}</textarea></label><button>빠진 조건에 의견 남기기</button></form></section><section class="card"><h2>확인한 조건을 새 버전에 보완</h2><p>${esc(d.correctionExtra)}</p><p>보완 근거: ${esc(d.correctionBasis)} · 가상 담당자 확인 예시</p><form id="general-revise"><label>새 버전의 지식 본문<textarea name="content" required rows="8" maxlength="7000">${esc(v.content)}</textarea></label><button type="button" id="general-example">확인한 보완 조건 넣기</button><label>왜 보완했나요?<input name="reason" required maxlength="1000"></label><button class="primary">보완한 기준을 새 버전으로 저장</button></form><p class="muted">이 기기의 정정 체험입니다. 공유할 때는 새 초안을 등록하고 담당자 확인을 다시 받아야 합니다.</p><button data-general-next="4" class="primary">다음 담당자가 어떻게 쓰는지 보기 →</button></section>`;
   if(tab===4)html=`<section class="card"><h2>담당자를 다시 찾기 전에 기준부터 확인</h2><p>${esc(d.reuseOutcome)}</p><form id="general-question"><label>다음 담당자의 질문<textarea name="question" required maxlength="1000">${esc(d.reuseQuestion)}</textarea></label><label>업무 적용일<input type="date" name="as_of" value="2026-09-21" required></label><button class="primary">${d.prepared?'준비된 예시 기준과 적용 조건 확인':'이 기기에 저장한 기준 확인'}</button></form><div id="general-answer" role="region" aria-label="최신 문서 조회 결과" aria-live="polite" tabindex="-1"></div><button data-general-next="5">팀에서 함께 볼 지식 준비 →</button><p class="muted">선택한 문서의 최신 본문을 보여주는 체험입니다. 입력한 질문에 답이 있는지 AI가 판정하거나 새 답변을 만드는 단계는 아닙니다.</p></section>`;
   if(tab===5)html=`<section class="card">${body(d)}<details><summary>기준에 연결된 데이터 열과 확인 순서</summary><h3>데이터 열의 의미</h3><pre class="source">${esc(d.schema)}</pre><h3>다음 업무에서 확인할 순서</h3><p>${esc(d.guide)}</p></details>${transfer(d)}</section><div id="general-org"></div>`;
   host.innerHTML=`<div class="eyebrow">GENERAL KNOWLEDGE · 0${tab}</div><h1>${['왜 부서마다 답이 다를까?','확인한 기준을 지식으로 남기기','빠진 조건과 예외 보완하기','다음 업무에 기준 재사용하기','팀에서 함께 쓸 지식 준비하기'][tab-1]}</h1><p>매출·고객 수·환불의 서로 다른 기준을 확인하고 다음 판단에 다시 씁니다. 모든 정책·수치·회사는 가상입니다.</p><div class="category-tabs">${seeds.map(s=>`<button data-general-doc="${s.id}" aria-pressed="${selected===s.id}">${esc(s.title)}</button>`).join('')}</div><p role="status">${esc(notice)}</p>${html}${archived()}`;
   if(tab===5&&organization){if(organization.getState().department!==d.department)organization.changeScope({department:d.department,includeCompany:false,scope:'department'});unmount=organization.mount(host.querySelector('#general-org'),{mode:'library'})}
   host.querySelectorAll('[data-general-doc]').forEach(b=>b.onclick=()=>{selected=b.dataset.generalDoc;notice='';render()});host.querySelectorAll('[data-general-next]').forEach(b=>b.onclick=()=>{location.hash='general-'+b.dataset.generalNext});
   const saveButton=host.querySelector('#general-save');if(saveButton)saveButton.onclick=()=>act(()=>{if(d.prepared){save(d,v.version);notice='이 기기에 기준을 저장했습니다. 아직 팀에 공유되지 않았습니다.'}else{tab=5;location.hash='general-5'}});
   const shareButton=host.querySelector('[data-general-share]');if(shareButton)shareButton.onclick=()=>{tab=5;location.hash='general-5';render();prepare(d)};
   const comment=host.querySelector('#general-comment');if(comment)comment.onsubmit=e=>{e.preventDefault();act(()=>{d.comments.push({body:comment.elements.body.value,resolved:null});save(d,v.version);notice='확인할 의견을 이 기기에 남겼습니다. 기준 본문은 아직 바뀌지 않았습니다.'})};
   const revise=host.querySelector('#general-revise');if(revise){host.querySelector('#general-example').onclick=()=>{revise.elements.content.value=d.correction;revise.elements.reason.value=d.reason};revise.onsubmit=e=>{e.preventDefault();act(()=>{const fresh=current();if(fresh.versions[0].version!==v.version)throw Error('다른 탭에서 정정되었습니다. 최신 문서를 다시 열어주세요.');const version=v.version+1;d.versions.unshift({...v,version,content:revise.elements.content.value,reason:revise.elements.reason.value});d.comments.forEach(c=>{if(!c.resolved)c.resolved=version});save(d,v.version);notice='이 기기에 새 버전을 저장했습니다. 팀에 공유하려면 초안 등록과 담당자 확인이 필요합니다.'})}}
   const question=host.querySelector('#general-question');if(question)question.onsubmit=e=>{e.preventDefault();const latest=current(),ver=latest.versions[0],date=question.elements.as_of.value;host.querySelector('#general-answer').innerHTML=date<ver.validFrom||date>ver.validTo?'<p class="notice">적용 기간 밖의 기준입니다. 담당 부서에 확인해 주세요.</p>':`<h3>선택한 기준 v${ver.version} · AI 생성 안 함</h3><p>${esc(question.elements.question.value)}</p><pre class="source">${readableContent(ver.content)}</pre><p>확인할 순서: ${esc(latest.guide)}</p><p class="muted">필요한 조건이 없다면 추정하지 말고 담당 부서에 확인해 새 버전으로 남기세요.</p>`;host.querySelector('#general-answer').focus()};
   host.querySelectorAll('[data-general-transfer]').forEach(b=>b.onclick=()=>prepare(docs().find(x=>x.id===b.dataset.generalTransfer)));
  }
  function prepare(x){const latest=x.versions[0];organization?.prepareDraft({id:x.id,title:x.title,department:x.department,version:latest.version,content:latest.content,validFrom:latest.validFrom,validTo:latest.validTo,source:{kind:'general_browser_knowledge',fixture_id:x.id,scenario_version:2,filename:x.filename,browser_version:latest.version,synthetic:true}})}
  function act(fn){try{fn()}catch(e){notice=e.message}render()}
  return {mount(target,index){host=target;tab=index;render()},destroy(){unmount?.();unmount=null;host=null},docs};
 }
 root.KnowHowGeneralKnowledge={createController,seeds};
})(window);
