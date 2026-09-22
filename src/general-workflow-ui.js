/* Shared contracts, distinct departmental meanings. All records are synthetic. */
(function(root){'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr=value=>Array.isArray(value)?value:[];
const money=value=>value==null?'확인 필요':Number(value).toLocaleString('ko-KR');
const topics={revenue:{label:'매출',question:'온솔 두 계약의 9월 매출은 왜 부서마다 다른가요?',intro:'같은 거래, 네 가지 보고 기준',description:'수주·결제·제공·입금의 날짜와 금액을 나란히 확인합니다.',purposes:[['contract','영업 수주 보고'],['payment','결제 운영 보고'],['recognition','재무 제공 실적'],['deposit','입금 대사']]},customer:{label:'고객',question:'온솔 고객은 계정 4개, 법인 2곳, 청구처 1곳 중 무엇으로 세나요?',intro:'이름보다 관계, 업무에 맞는 집계 단위',description:'계정에서 계약 법인, 청구처까지 연결을 따라갑니다.',purposes:[['accounts','서비스 이용 분석'],['buyers','구매 계정 분석'],['entities','계약 고객 현황'],['billing','청구 대상 관리']]},refund:{label:'환불',question:'R1이 처리 완료라는데 고객에게 환불 완료로 안내해도 되나요?',intro:'처리 완료와 환불 완료 사이',description:'요청·운영 처리·결제사 완료·정산 반영을 구분합니다.',purposes:[['customer','고객에게 완료 안내'],['completed_refund','완료 환불액 집계'],['settlement','정산 차감 확인']]}};
const docIds={revenue:'KB-REV-01',customer:'KB-CUST-01',refund:'KB-REF-01'};
const refKey=ref=>typeof ref==='string'?ref:`${ref.document_id||ref.id}:v${ref.version||1}:${ref.section||''}`;
const refLabel=ref=>typeof ref==='string'?ref.replace(':v',' v').replace(/:(\d+)$/,' §$1'):`${ref.document_id||ref.id} v${ref.version||1}${ref.section?' §'+ref.section:''}`;
const parseRef=value=>{const parts=String(value).split(':');return{document_id:parts[0],version:Number((parts[1]||'1').replace('v','')),section:parts[2]||''}};
const date=value=>value?String(value).slice(5,10).replace('-','/'):'기록 없음';
const fieldLabels={id:'행 ID',kind:'종류',label:'대상',contract_id:'계약',legal_entity_id:'계약 법인',billing_customer_id:'청구 고객',buyer_account_id:'구매 계정',account_id:'서비스 계정',payment_id:'원결제',signed_at:'계약 서명일',original_amount:'원계약 금액',monthly_amount:'월 서비스 대가',paid_at:'결제일',amount:'금액',status:'상태',is_test:'테스트 여부',requested_at:'요청일',requested_amount:'요청 금액',operation_code:'운영 상태',operation_at:'운영 처리일',processor_code:'결제사 상태',processor_event_id:'결제사 사건 ID',processor_completed_at:'결제사 완료일',processor_completed_amount:'결제사 완료 금액',settled_at:'정산 반영일',net_cash:'현금 반영액',fee_amount:'수수료',gross_amount:'결제 원액',ref_id:'참조 대상',ref_type:'참조 종류',refund_deduction:'환불 차감액',service_start:'제공 시작일',service_end_exclusive:'제공 종료일 (미포함)',target_service_start:'환불 대상 시작일',target_service_end_exclusive:'환불 대상 종료일 (미포함)',recognized_month:'제공 실적 월',confirmed_at:'제공 확인일',valid_from:'연결 시작일',valid_to_exclusive:'연결 종료일 (미포함)',login_at:'로그인일',display_name:'표시명',explanation:'적용 설명',reason:'제외 사유'};
function createController({store}){
 let host=null,unsubscribe=null,busy=false,notice='',failure='',activeAnswer=null,selectedMetric='',modal=null,renderedModal=null,focusAfterRender=null,loadingNotice='',focusResultAfterRender=false,focusFailureAfterRender=false;
 let query={topic:'revenue',question:topics.revenue.question,purpose:'',contract_ids:['C1','C2'],period:'september',refund_id:'R1'};
 let commentDraft='운영 화면의 DONE은 결제사 접수라는 설명을 들었습니다. 고객 환불 완료는 어떤 근거로 확인하나요?';
 const fixture=()=>root.KnowHowGeneralWorkflowCore?.fixture||{};
 const state=()=>store.state()||{};
 const docs=()=>store.docs();
 const currentKnowledge=()=>arr(activeAnswer?.basis?.knowledge);
 const isOld=()=>currentKnowledge().some(k=>k.id==='KB-REF-01'&&Number(k.version)<Number(state().refundVersion||1));
 const btn=(action,text,extra='',cls='')=>`<button type="button" class="gw-button ${cls}" data-gw-action="${action}" ${extra}>${text}</button>`;
 const refs=(items)=>arr(items).map(r=>btn('source',esc(refLabel(r)),`data-ref="${esc(refKey(r))}"`,'gw-source')).join('');
 function render(){
  if(!host)return;
  captureDialogView();
  host.querySelector('.gw-dialog[open]')?.close();
  const info=topics[query.topic],s=state(),history=arr(s.answers).slice().reverse();
  host.innerHTML=`<section class="gw-app" aria-label="매출·고객·환불 업무 연결"><header class="gw-header"><div><span class="gw-eyebrow">연결된 업무 지식 · 온솔 사례</span><h1>부서마다 다른 숫자,<br class="gw-mobile-break"> 이번 업무의 기준 찾기</h1><p>같은 계약의 정보를 연결하고, 확인한 기준을 다음 업무에 남깁니다.</p></div><div class="gw-storage"><span class="gw-dot"></span>${esc(store.storageLabel())}<button type="button" class="gw-icon-button" data-gw-action="sync" aria-label="저장소에서 최신 상태 가져오기">↻</button></div></header>
   <div class="gw-sample-note">합성 문서·거래로 실행하는 사례 조회 <span>모델 호출 없음 · 기준 데이터 2026.10.07</span></div>
   <nav class="gw-tabs" aria-label="업무 영역">${Object.entries(topics).map(([key,t],i)=>`<button type="button" data-gw-action="topic" data-topic="${key}" aria-pressed="${query.topic===key}" class="${query.topic===key?'is-active':''}"><span>0${i+1}</span>${t.label}<small>${['금액과 귀속 시점','대상과 집계 단위','완료와 반영 시점'][i]}</small></button>`).join('')}</nav>
   <section class="gw-question-panel"><div class="gw-section-heading"><div><h2>${info.intro}</h2><p>${info.description}</p></div><span class="gw-kb-indicator">${docIds[query.topic]} · v${query.topic==='refund'?s.refundVersion||1:1}</span></div>
    <form data-gw-form="question" aria-busy="${busy}"><label class="gw-question-label" for="gw-question">업무 질문</label><div class="gw-question-input"><input id="gw-question" aria-describedby="gw-question-help" name="question" value="${esc(query.question)}" required maxlength="300" placeholder="같은 사례에 대해 확인할 질문을 입력하세요"><button class="gw-button gw-primary" type="submit" ${busy?'disabled':''}>${busy?'조회 중…':'기준과 결과 보기'} <span aria-hidden="true">↗</span></button></div>
     <p id="gw-question-help" class="gw-question-help">입력한 질문을 기록하고, 선택한 대상·목적·기간으로 계산합니다.</p><div class="gw-filters"><fieldset><legend>업무 대상</legend><label><input type="checkbox" name="contract" value="C1" ${query.contract_ids.includes('C1')?'checked':''}>온솔제품 <small>C1</small></label><label><input type="checkbox" name="contract" value="C2" ${query.contract_ids.includes('C2')?'checked':''}>온솔연구 <small>C2</small></label></fieldset><label>보고 목적<select name="purpose"><option value="">목적별 비교 먼저 보기</option>${info.purposes.map(([value,label])=>`<option value="${value}" ${query.purpose===value?'selected':''}>${label}</option>`).join('')}</select></label><label>기준 기간<select name="period"><option value="september" ${query.period==='september'?'selected':''}>9월 · 9/1~9/30</option><option value="october" ${query.period==='october'?'selected':''}>10월 · 10/1~10/7 현재</option></select></label>${query.topic==='refund'?`<label>환불 건<select name="refund_id"><option value="R1" ${query.refund_id==='R1'?'selected':''}>R1 · C1 / 100,000원</option><option value="R2" ${query.refund_id==='R2'?'selected':''}>R2 · C2 / 50,000원</option><option value="all" ${query.refund_id==='all'?'selected':''}>선택 계약의 모든 환불</option></select></label>`:''}</div>
    </form></section>
   ${loadingNotice?`<div class="gw-loading" role="status">${esc(loadingNotice)}</div>`:''}${failure?`<div class="gw-notice gw-error" role="alert" tabindex="-1">${esc(failure)}</div>`:''}${notice?`<div class="gw-notice" role="status" ${notice.startsWith('조회 완료')?`data-answer-id="${esc(activeAnswer?.id)}"`:''}>${esc(notice)}</div>`:''}
   ${activeAnswer?answerMarkup(activeAnswer):`<div class="gw-empty">질문과 대상에 맞춰 데이터를 조회하고 있습니다.</div>`}
   <section class="gw-bottom-grid"><div class="gw-history"><div class="gw-section-heading"><div><span class="gw-eyebrow">다음 업무에 재사용</span><h2>질문과 당시 근거</h2></div><span class="gw-count">${history.length}</span></div><p class="gw-muted">새 기준이 발행돼도 저장한 답의 숫자와 버전은 유지됩니다.</p><div class="gw-history-list">${history.length?history.slice(0,8).map(a=>`<button type="button" data-gw-action="history" data-id="${esc(a.id)}" class="${a.id===activeAnswer?.id?'is-active':''}"><span>${esc(a.query?.question||a.title)}</span><small>${esc(topics[a.query?.topic]?.label||'업무')} · ${a.query?.period==='september'?'9월':'10월 현재'} · ${arr(a.basis?.knowledge).map(k=>esc(k.id+' v'+k.version)).join(' / ')}</small></button>`).join(''):'<p class="gw-muted">조회한 결과가 이곳에 쌓입니다.</p>'}</div></div>${workflowMarkup()}</section>
   <footer class="gw-footer"><span>서로 다른 정의를 보존하고, 확인된 식별자와 관계로 연결합니다.</span><div>${store.shareUrl?.()?btn('share','같은 작업공간 링크 복사','', 'gw-text-button'):''}${btn('new','새 사례 작업공간','', 'gw-text-button')}</div></footer>
   ${modal?modalMarkup():''}</section>`;
  bind();
  restoreDialogView();
  if(focusFailureAfterRender){const error=host.querySelector(modal?'.gw-dialog .gw-error':'.gw-error');error?.focus({preventScroll:true});error?.scrollIntoView({block:'nearest'});focusFailureAfterRender=false}
  if(focusResultAfterRender&&!modal){const heading=host.querySelector('.gw-result h2');heading?.focus({preventScroll:true});heading?.scrollIntoView({block:'start',behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});focusResultAfterRender=false}
 }
 function answerMarkup(a){
  const metrics=arr(a.metrics);if(!metrics.some(m=>m.key===selectedMetric))selectedMetric=a.selected_metric||metrics[0]?.key||'';
  const selected=metrics.find(m=>m.key===selectedMetric),shownRows=selected?arr(a.rows).filter(r=>arr(selected.row_ids).includes(r.id)):arr(a.rows);
  return `<section class="gw-result" aria-label="업무 조회 결과"><div class="gw-result-top"><div><span class="gw-eyebrow">${a.query?.purpose?'선택한 업무에 쓸 결과':'정의를 먼저 비교해 보세요'}</span><h2 tabindex="-1">${esc(a.title||'업무 기준 조회 결과')}</h2><p class="gw-answer-summary">${esc(Array.isArray(a.summary)?a.summary.join(' '):a.summary||'')}</p></div><div class="gw-result-actions">${btn('copy','결과 복사')}${btn('ask','기준 확인 요청','', 'gw-secondary')}</div></div>
   <div class="gw-answer-meta"><span>${esc(arr(a.query?.contract_ids).join(' + '))}</span><span>${a.query?.period==='september'?'2026.09.01–09.30':'2026.10.01–10.07 현재'}</span><span>${esc(a.basis?.snapshot_id||'SNAP-01')}</span><span>근거 버전 고정</span></div>
   ${isOld()?`<div class="gw-version-update"><div><strong>이 답 이후에 확인된 기준이 있습니다.</strong><span>당시 답은 보존했습니다. 현재 기준으로 새 답을 만들 수 있습니다.</span></div>${btn('rerun','현재 기준으로 다시 계산','', 'gw-secondary')}</div>`:''}
   <div class="gw-metrics">${metrics.map(m=>`<button type="button" data-gw-action="metric" data-key="${esc(m.key)}" class="gw-metric ${m.key===selectedMetric?'is-selected':''}" aria-pressed="${m.key===selectedMetric}"><span>${esc(m.label)}</span><strong>${money(m.value)}<small>${m.value==null?'':esc(m.unit||'')}</small></strong><p>${esc(m.definition)}</p><em>집계 행과 근거 보기 <span aria-hidden="true">↗</span></em></button>`).join('')}</div>
   ${a.query?.topic==='customer'?customerMarkup(a):a.query?.topic==='refund'?refundMarkup(a):revenueMarkup(a)}
   ${arr(a.excluded).length?`<div class="gw-excluded"><span class="gw-warning-icon" aria-hidden="true">!</span><div><strong>확인되지 않았거나 적용 범위에서 제외된 항목 ${a.excluded.length}건</strong>${a.excluded.map(r=>`<p><button type="button" data-gw-action="row" data-row="${esc(r.id)}">${esc(r.id)}</button> ${esc(r.reason||r.explanation||'현재 선택 조건에 포함되지 않습니다.')}${r.amount!=null?' · '+money(r.amount)+'원':''}</p>`).join('')}</div></div>`:''}
   <div class="gw-evidence"><div class="gw-section-heading"><div><h3>${esc(selected?.label||'결과')}의 계산 근거</h3><p>${esc(selected?.definition||'집계에 사용한 행과 원본 문서입니다.')}</p></div>${refs(selected?.source_refs)}</div><div class="gw-records">${shownRows.length?shownRows.map(row=>`<button type="button" class="gw-record" data-gw-action="row" data-row="${esc(row.id)}"><span class="gw-record-id">${esc(row.id)}</span><span>${esc(row.label||row.contract_id||row.account_id||row.payment_id||row.ref_id||row.kind||'원본 기록')}</span><small>${esc(row.explanation||row.status||row.processor_code||row.paid_at||row.settled_at||'원본 기록 확인')}</small><b>${row.amount!=null?money(row.amount)+'원':row.original_amount!=null?money(row.original_amount)+'원':'↗'}</b></button>`).join(''):'<p class="gw-muted">이 조건에 포함된 확정 기록이 없습니다. 지표의 확인 여부와 자료 기간을 함께 확인하세요.</p>'}</div></div>
   <div class="gw-basis"><span>사용한 업무 KB</span>${refs(currentKnowledge())}<button type="button" data-gw-action="links" class="gw-link-button">대상 연결 근거 ${arr(a.basis?.relationships).length}건 ↗</button></div>
  </section>`;
 }
 function revenueMarkup(a){
  if(a.query?.period!=='september')return `<p class="gw-inline-context">10월 자료는 10/7까지 수집됐습니다. 월 전체 서비스 제공 실적과 현재까지 확인된 입금·환불을 구분하세요.</p>`;
  const values=Object.fromEntries(arr(a.metrics).map(m=>[m.key,m.value]));
  return `<div class="gw-comparison-note"><span>숫자가 다른 이유</span><p>결제와 제공 실적의 차이 <strong>${values.paid!=null&&values.recognized!=null?money(values.paid-values.recognized)+'원':'확인 필요'}</strong>은 제공 기간을, 결제와 입금의 차이 <strong>${values.paid!=null&&values.cash!=null?money(values.paid-values.cash)+'원':'확인 필요'}</strong>은 입금 시점과 수수료를 함께 봅니다.</p></div>`;
 }
 function customerMarkup(a){
  const f=fixture(),contracts=arr(f.contracts).filter(c=>arr(a.query?.contract_ids).includes(c.id));
  return `<div class="gw-relationship-map"><div class="gw-map-head"><h3>계정에서 청구처까지, 연결을 따라가면</h3><span>서로 다른 법인을 같은 청구처로 합치지 않습니다.</span></div>${contracts.map(c=>{const entity=arr(f.entities).find(e=>e.id===c.legal_entity_id),billing=arr(f.entities).find(e=>e.id===c.billing_customer_id);return `<div class="gw-relation-chain"><div><small>서비스 계정</small><strong>${arr(f.account_memberships).filter(m=>m.contract_id===c.id).map(m=>esc(m.account_id)).join(' · ')}</strong><span>구매 주체 ${esc(c.buyer_account_id)}</span></div><span class="gw-arrow">→</span><div><small>계약</small><strong>${esc(c.id)}</strong><span>${date(c.service_start)} 서비스 시작</span></div><span class="gw-arrow">→</span><div><small>계약 법인</small><strong>${esc(entity?.label||c.legal_entity_id)}</strong><span>${esc(c.legal_entity_id)}</span></div><span class="gw-arrow">→</span><div><small>청구 고객</small><strong>${esc(billing?.label||c.billing_customer_id)}</strong><span>${esc(c.billing_customer_id)}</span></div></div>`}).join('')}</div>`;
 }
 function refundMarkup(a){
  const f=fixture(),payments=arr(f.payments),version=arr(a.basis?.knowledge).find(k=>k.id==='KB-REF-01')?.version||1;
  const chosen=arr(f.refunds).filter(r=>arr(a.query?.contract_ids).includes(payments.find(p=>p.id===r.payment_id)?.contract_id)&&(a.query?.refund_id==='all'||r.id===a.query?.refund_id));
  return `<div class="gw-timelines">${chosen.map(r=>{
   const settlement=arr(f.settlements).find(s=>s.ref_id===r.id&&s.ref_type==='refund');
   const verdict=arr(a.rows).find(row=>row.id===r.id&&row.kind==='refund')?.status;
   const requested=Boolean(r.requested_at)&&Number.isFinite(r.requested_amount)&&r.requested_amount>0;
   const operationConfirmed=version>=2&&r.operation_code==='DONE'&&Boolean(r.operation_at);
   const completed=verdict==='completed';
   const settled=Boolean(settlement?.settled_at)&&Number.isFinite(settlement?.refund_deduction)&&settlement.refund_deduction>0;
   const stage=(confirmed,body)=>`<li class="${confirmed?'':'is-pending'}">${body}</li>`;
   return `<div class="gw-timeline" data-refund-id="${esc(r.id)}"><div class="gw-timeline-title"><strong>${esc(r.id)} · ${money(r.requested_amount)}원</strong><span>전체 사건 이력 · 원결제 ${esc(r.payment_id)} · ${version>=2?'확인된 코드 정의 적용':'코드 의미 확인 필요'}</span></div><ol>${stage(requested,`<small>${date(r.requested_at)}</small><strong>환불 요청</strong><span>${requested?money(r.requested_amount)+'원 접수':'요청 기록 확인 필요'}</span>`)}${stage(operationConfirmed,`<small>${date(r.operation_at)}</small><strong>${esc(r.operation_code)}</strong><span>${operationConfirmed?'결제사 접수 완료':r.operation_code==='REQUESTED'?'결제사 접수 대기':'운영 코드 의미 확인 필요'}</span>`)}${stage(completed,`<small>${date(r.processor_completed_at)}</small><strong>${esc(r.processor_code)}</strong><span>${completed?'원결제·금액·시각 확인':r.processor_code==='PENDING'?'처리 대기 · 완료액에서 제외':version<2?'의미 확인 전 안내 보류':'완료 증빙 확인 필요'}</span>`)}${stage(settled,`<small>${date(settlement?.settled_at)}</small><strong>정산 차감</strong><span>${settled?money(settlement.refund_deduction)+'원 반영':settlement?'차감 근거 확인 필요':'차감 기록 없음'}</span>`)}</ol></div>`}).join('')}</div>`;
 }
 function workflowMarkup(){
  const s=state(),comments=arr(s.comments),reviews=arr(s.reviews);
  return `<div class="gw-workflow"><div class="gw-section-heading"><div><span class="gw-eyebrow">부서에 확인하고 지식으로 남기기</span><h2>확인 요청과 담당 회신</h2></div><span class="gw-count">${comments.length}</span></div><p class="gw-muted">댓글 → 담당 확인 → KB 발행 후 다음 조회에 반영됩니다.</p><div class="gw-request-list">${comments.length?comments.slice().reverse().map(c=>{const review=reviews.find(r=>r.comment_id===c.id),published=c.status==='published'||Boolean(c.resolved_version||c.resolvedVersion||c.published_version||review?.published_version||review?.publishedVersion||review?.status==='published');return `<article class="gw-request"><div class="gw-request-meta"><span class="gw-status ${published?'is-done':review?'is-reviewed':''}">${published?'KB 반영 완료':review?'담당 확인 · 발행 대기':'부서 확인 대기'}</span><small>${esc(c.document_id||'KB-REF-01')} · ${esc(c.target_row_id||'R1')}</small></div><p>${esc(c.body)}</p>${review?`<small class="gw-review-text">${esc(review.role)} · ${esc(review.decision)}</small>`:''}<div class="gw-request-actions">${!review&&c.document_id==='KB-REF-01'&&c.target_row_id==='R1'&&Number(s.refundVersion||1)===1?btn('review','담당 부서 확인','data-id="'+esc(c.id)+'"','gw-secondary'):''}${review&&!published?btn('publish','확인된 기준을 KB v2로 발행','data-id="'+esc(review.id)+'"','gw-primary'):''}${published?btn('next','다음 담당자의 10월 질문으로 확인','', 'gw-secondary'):''}</div></article>`}).join(''):`<div class="gw-request-empty"><span aria-hidden="true">↗</span><p>기준이 모호한 지점에서<br>담당 부서에 근거를 요청하세요.</p>${btn('ask','확인 요청 작성')}</div>`}</div></div>`;
 }
 function modalMarkup(){
  let content='',title='',subtitle='';
  if(modal.type==='source'){
   const ref=parseRef(modal.ref),source=arr(fixture().source_documents).find(d=>d.id===ref.document_id&&Number(d.version)===ref.version),kb=arr(docs()).find(d=>d.id===ref.document_id),version=arr(kb?.versions).find(v=>Number(v.version)===ref.version),doc=source||kb;
   title=doc?.title||ref.document_id;subtitle=refLabel(ref)+' · '+(doc?.owner||'문서 근거');
   const text=source?(ref.section?source.section_contents?.[ref.section]:source.content):(version?.content||arr(version?.rules).join('\n'));
   content=`${ref.document_id==='OPS-01'&&ref.version===2&&Number(state().refundVersion||1)<2?'<div class="gw-notice">담당 검토용 후속 원문입니다. KB 발행 전에는 현재 답의 기준으로 사용되지 않습니다.</div>':''}${text?`<div class="gw-source-body">${esc(text)}</div>`:'<div class="gw-notice gw-error">이 버전의 원문을 찾지 못했습니다. 최신 문서로 대신 표시하지 않습니다.</div>'}${version?`<div class="gw-source-dates">적용 기간 ${esc(version.validFrom||version.valid_from||'미기록')} ~ ${esc(version.validTo||version.valid_to_exclusive||'미기록')}</div><div class="gw-modal-refs">${refs(version.source_refs)}</div>`:''}`;
  }else if(modal.type==='row'){
   const row=[...arr(activeAnswer?.rows),...arr(activeAnswer?.excluded),...['contracts','payments','refunds','settlements','recognized_service','account_memberships'].flatMap(key=>arr(fixture()[key]))].find(r=>r.id===modal.id);
   title='집계에 연결된 원본 행';subtitle=modal.id;
   content=row?`<dl class="gw-detail-list">${Object.entries(row).filter(([key,value])=>value==null||typeof value!=='object').map(([key,value])=>`<dt>${esc(fieldLabels[key]||key)}</dt><dd>${esc(value==null?'기록 없음':typeof value==='boolean'?(value?'예':'아니오'):value)}</dd>`).join('')}</dl><div class="gw-modal-refs">${refs(row.source_refs||(row.source_ref?[row.source_ref]:[]))}</div>`:'<p>원본 행을 찾지 못했습니다.</p>';
  }else if(modal.type==='links'){
   title='같은 업무 대상임을 확인한 연결';subtitle='식별자 · 관계 · 유효 기간 · 출처';
   const ids=arr(activeAnswer?.basis?.relationships).map(r=>typeof r==='string'?r:r.id),links=arr(fixture().link_records).filter(l=>ids.includes(l.id));
   content=`<p class="gw-muted">같은 이름을 연결 근거로 쓰지 않습니다. 각 관계는 독립된 확인 상태와 기간을 갖습니다.</p><div class="gw-link-records">${links.map(l=>`<article><strong>${esc(l.from)} → ${esc(l.to||'연결 미확인')}</strong><span>${esc({contracted_with:'계약 체결 법인',billed_to:'청구 대상',ordered_by:'주문 주체',authorized_for:'이용 권한',pays_for:'계약의 결제',refund_of:'원결제의 환불',cash_reflects:'현금 반영',service_of:'계약의 제공 실적'}[l.relation]||l.relation)}</span><p>${esc(l.reason||l.owner||'')} · ${esc(l.valid_from||'미확인')} ~ ${esc(l.valid_to_exclusive||'종료 미지정')}</p>${refs(l.source_ref?[l.source_ref]:[])}</article>`).join('')||'<p>이 답에 고정된 연결 기록이 없습니다.</p>'}</div>`;
  }else if(modal.type==='comment'){
   title='해당 부서에 기준 확인 요청';subtitle='현재 답의 문서·버전·거래를 함께 남깁니다.';
   content=`<form data-gw-form="comment"><div class="gw-form-row"><label>확인할 업무 KB<select name="document_id">${Object.entries(docIds).map(([t,id])=>`<option value="${id}" ${query.topic===t?'selected':''}>${topics[t].label} · ${id}</option>`).join('')}</select></label><label>대상 거래 / 행<input name="target_row_id" required maxlength="40" value="${query.topic==='refund'?query.refund_id==='all'?'R1':query.refund_id:query.topic==='revenue'?'PX':'C1'}"></label></div><label class="gw-block-label">확인이 필요한 내용<textarea name="body" rows="5" required maxlength="1500">${esc(query.topic==='refund'?commentDraft:query.topic==='revenue'?'PX 결제의 계약번호와 배분 근거를 확인해 주세요. 표시명만으로 C1·C2에 포함하지 않았습니다.':'서비스 계정·계약 법인·청구처의 유효한 연결 근거와 적용 기간을 확인해 주세요.')}</textarea></label><p class="gw-muted">등록은 확인 요청입니다. 답의 계산 기준은 발행 전까지 유지됩니다.</p><button type="submit" class="gw-button gw-primary" ${busy?'disabled':''}>부서 확인 요청 등록</button></form>`;
  }else if(modal.type==='review'){
   title='서비스운영팀의 확인과 회신';subtitle='역할을 선택해 수행하는 모의 담당 확인 · 실제 신원 인증 없음';
   const comment=arr(state().comments).find(c=>c.id===modal.id);
   content=`<blockquote>${esc(comment?.body)}</blockquote><div class="gw-review-diff"><div><small>현재 KB v1</small><p>완료 코드의 의미가 미확인되어 고객 환불 완료 판정을 보류합니다.</p></div><span aria-hidden="true">→</span><div><small>확인할 변경</small><p>접수와 완료를 구분하고, 원결제·금액·완료시각이 갖춰진 성공 건만 완료로 판단합니다.</p></div></div><form data-gw-form="review"><label class="gw-block-label">확인 역할 (모의)<select name="role"><option value="">확인할 담당 역할 선택</option><option value="서비스운영팀 결제운영 담당">서비스운영팀 결제운영 담당</option></select></label><div class="gw-evidence-confirm"><strong>확인 근거</strong>${btn('source','OPS-01 v2 §3 원문 읽기','data-ref="OPS-01:v2:3"','gw-source')}<p>이 사례의 동일 결제사 연동에 2026.09.01부터 적용하는 것으로 설정된 원문입니다.</p></div><label class="gw-block-label">담당 회신<textarea name="decision" rows="4" required>DONE은 결제사 접수 완료입니다. SUCCEEDED와 원결제, 고유 환불 ID, 완료 금액·시각이 일치하는 건만 고객 환불 완료로 확인합니다. R2 PENDING은 완료액에서 제외합니다.</textarea></label><label class="gw-check"><input name="evidence_checked" type="checkbox" required>원문과 대상 기록을 대조했습니다 (모의 확인).</label><button type="submit" class="gw-button gw-primary" ${busy?'disabled':''}>담당 확인 기록 저장</button></form>`;
  }else if(modal.type==='new'){
   title='새 사례 작업공간 시작';subtitle='새 작업공간에서 KB v1부터 흐름을 다시 확인합니다.';
   content=`<p>${store.workspaceId?.()?'현재 작업공간의 기록은 기존 공유 링크에 유지됩니다.':'이 브라우저의 현재 사례 기록이 초기화됩니다.'} 새 작업공간에는 확인 요청이나 발행 이력이 없습니다.</p>${btn('new-confirm','새 작업공간 만들기','','gw-primary')}`;
  }
  return `<dialog class="gw-dialog" aria-modal="true" aria-labelledby="gw-dialog-title"><header><div><span class="gw-eyebrow">${esc(subtitle)}</span><h2 id="gw-dialog-title">${esc(title)}</h2></div><button type="button" class="gw-icon-button" data-gw-action="close" aria-label="상세 닫기">×</button></header><div class="gw-dialog-content">${failure?`<div class="gw-notice gw-error" role="alert" tabindex="-1">${esc(failure)}</div>`:''}${content}</div><footer>${modal.previous?btn('back',modal.previous.type==='review'?'담당 확인으로 돌아가기':'이전 상세로 돌아가기'):btn('close','닫기')}</footer></dialog>`;
 }
 async function execute(fn,options={}){if(busy)return;busy=true;failure='';notice='';loadingNotice=options.question?'조회 중 · 선택한 대상·목적·기간으로 기준과 결과를 확인하고 있습니다.':'요청을 처리하고 있습니다.';render();try{await fn()}catch(error){failure=error?.message||'요청을 처리하지 못했습니다. 입력과 연결을 확인하세요.';focusFailureAfterRender=true}finally{busy=false;loadingNotice='';render()}}
 function readQuery(form){const data=new FormData(form),contractIds=data.getAll('contract');if(!contractIds.length)throw Error('업무 대상을 한 개 이상 선택하세요.');return{...query,question:String(data.get('question')||'').trim(),purpose:String(data.get('purpose')||''),contract_ids:contractIds,period:String(data.get('period')||'september'),refund_id:String(data.get('refund_id')||query.refund_id)}}
 function signalTopic(){root.dispatchEvent?.(new CustomEvent('knowhow:general-topic',{detail:{topic:query.topic,tab:{revenue:1,customer:2,refund:3}[query.topic]}}))}
 async function ask(nextQuery,announce=false){query=nextQuery;activeAnswer=await store.answer(query);selectedMetric='';notice='';modal=null;signalTopic();if(announce){const purpose=topics[query.topic].purposes.find(([value])=>value===query.purpose)?.[1]||'목적별 비교';notice=`조회 완료 · ${new Date(activeAnswer.created_at||Date.now()).toLocaleTimeString('ko-KR')} · ${query.contract_ids.join(' + ')} / ${query.period==='september'?'9월':'10월 7일까지'} / ${purpose}. 새 조회 결과를 저장했습니다.`;focusResultAfterRender=true}}
 // Renders replace the host, so remember controls by stable attributes and occurrence.
 const focusableSelector='button,input,select,textarea,a[href],[tabindex]';
 const focusSignature=node=>JSON.stringify([node.tagName,...['data-gw-action','data-id','data-row','data-ref','data-key','data-topic','name','type','href'].map(attr=>node.getAttribute(attr))]);
 function describeFocus(node){
  if(!host?.contains(node)||!node.matches(focusableSelector))return null;
  const inDialog=Boolean(node.closest('.gw-dialog')),scope=inDialog?node.closest('.gw-dialog'):host,key=focusSignature(node);
  const matches=[...scope.querySelectorAll(focusableSelector)].filter(control=>Boolean(control.closest('.gw-dialog'))===inDialog&&focusSignature(control)===key);
  return{inDialog,key,index:matches.indexOf(node)};
 }
 function restoreFocus(descriptor){
  if(!descriptor)return false;
  const scope=descriptor.inDialog?host.querySelector('.gw-dialog'):host;
  const target=[...(scope?.querySelectorAll(focusableSelector)||[])].filter(control=>Boolean(control.closest('.gw-dialog'))===descriptor.inDialog&&focusSignature(control)===descriptor.key)[descriptor.index];
  target?.focus({preventScroll:true});return Boolean(target);
 }
 function captureDialogView(){
  const dialog=host?.querySelector('.gw-dialog');if(!dialog||!renderedModal)return;
  renderedModal.focus=describeFocus(host.ownerDocument.activeElement)||renderedModal.focus;
  renderedModal.scroll=dialog.querySelector('.gw-dialog-content')?.scrollTop||0;
  renderedModal.fields=[...dialog.querySelectorAll('input[name],select[name],textarea[name]')].map(control=>({name:control.name,value:control.value,checked:control.checked}));
 }
 function restoreDialogView(){
  const document=host.ownerDocument,dialog=host.querySelector('.gw-dialog');
  document.documentElement.classList.toggle('gw-modal-open',Boolean(modal));
  renderedModal=modal;
  if(dialog&&modal){
   for(const field of modal.fields||[]){const control=[...dialog.querySelectorAll('[name]')].find(node=>node.name===field.name);if(control){control.value=field.value;if(control.type==='checkbox')control.checked=field.checked}}
   dialog.showModal();
   dialog.querySelector('.gw-dialog-content').scrollTop=modal.scroll||0;
   if(!restoreFocus(focusAfterRender||modal.focus))dialog.querySelector('[data-gw-action="close"]')?.focus({preventScroll:true});
  }else if(focusAfterRender){restoreFocus(focusAfterRender)}
  focusAfterRender=null;
 }
 function openModal(next,opener){
  failure='';next.opener=describeFocus(opener||host?.ownerDocument.activeElement);next.previous=modal;modal=next;render();
 }
 function closeModal(){
  if(!modal)return;focusAfterRender=modal.opener;modal=modal.previous||null;render();
 }
 function finishModal(){
  let outer=modal;while(outer?.previous)outer=outer.previous;focusAfterRender=outer?.opener;modal=null;
 }
 function bind(){
  const main=host.querySelector('.gw-app');if(!main)return;
  main.addEventListener('click',event=>{const target=event.target.closest('[data-gw-action]');if(!target)return;const action=target.dataset.gwAction;
   if(action==='close'||action==='back'){closeModal();return}
   if(action==='source'){openModal({type:'source',ref:target.dataset.ref},target);return}
   if(action==='row'){openModal({type:'row',id:target.dataset.row},target);return}if(action==='links'){openModal({type:'links'},target);return}
   if(action==='metric'){selectedMetric=target.dataset.key;render();return}
   if(action==='ask'){openModal({type:'comment'},target);return}if(action==='review'){openModal({type:'review',id:target.dataset.id},target);return}
   if(action==='new'){openModal({type:'new'},target);return}
   if(action==='history'){const found=arr(state().answers).find(a=>a.id===target.dataset.id);if(found){activeAnswer=found;query={...found.query};signalTopic();selectedMetric='';notice='저장 당시의 데이터와 기준 버전으로 보여줍니다.';render()}return}
   execute(async()=>{
    if(action==='topic'){const topic=target.dataset.topic;await ask({...query,topic,question:topics[topic].question,purpose:'',period:topic==='revenue'?'september':'october',refund_id:'R1'})}
    else if(action==='rerun'){await ask({...activeAnswer.query},true)}
    else if(action==='next'){await ask({topic:'refund',question:'다음 보고 담당자입니다. 10월 환불 완료액은 얼마인가요?',purpose:'completed_refund',contract_ids:['C1','C2'],period:'october',refund_id:'all'});notice='현재 발행된 기준으로 새 질문을 조회했습니다. 과거 답은 질문 이력에 보존됩니다.'}
    else if(action==='publish'){await store.command('publish',{review_id:target.dataset.id});notice='확인한 의견을 KB v2로 발행했습니다. 현재 열린 과거 답은 유지됩니다. 다음 질문에서 새 기준을 확인하세요.'}
    else if(action==='sync'){await store.sync();notice='저장소의 최신 상태를 가져왔습니다. 열린 답의 당시 버전은 유지됩니다.'}
    else if(action==='new-confirm'){await store.newWorkspace();activeAnswer=null;modal=null;await ask({topic:'revenue',question:topics.revenue.question,purpose:'',contract_ids:['C1','C2'],period:'september',refund_id:'R1'});notice='새 사례 작업공간을 시작했습니다.'}
    else if(action==='share'){await navigator.clipboard.writeText(store.shareUrl());notice='같은 작업공간의 체험 링크를 복사했습니다. 다른 브라우저에서도 이 링크로 발행된 기준과 회신을 확인할 수 있습니다.'}
    else if(action==='copy'){const a=activeAnswer;await navigator.clipboard.writeText([a.title,a.summary,...arr(a.metrics).map(m=>`${m.label}: ${money(m.value)}${m.value==null?'':m.unit||''} — ${m.definition}`),'대상: '+arr(a.query?.contract_ids).join(', '),'기간: '+(a.query?.period==='september'?'2026.09.01~09.30':'2026.10.01~10.07 현재'),...arr(a.excluded).map(r=>`제외 ${r.id}: ${r.reason||r.explanation||''}`),'근거: '+arr(a.basis?.knowledge).map(refLabel).join(', '),'합성 자료 기반 사례 결과'].join('\n'));notice='대상·기간·예외·근거 버전을 포함한 결과를 복사했습니다.'}
   });
  });
  main.addEventListener('submit',event=>{
   const form=event.target.closest('[data-gw-form]');if(!form)return;event.preventDefault();if(busy)return;
   const type=form.dataset.gwForm;let payload;
   // Snapshot controls before execute() renders immediate progress feedback.
   try{
    const data=new FormData(form);
    if(type==='question')payload=readQuery(form);
    if(type==='comment')payload={document_id:String(data.get('document_id')),target_row_id:String(data.get('target_row_id')).trim(),body:String(data.get('body')).trim()};
    if(type==='review'){if(!data.get('role'))throw Error('모의 담당 역할을 선택하세요.');if(!data.get('evidence_checked'))throw Error('원문 대조 여부를 확인하세요.');payload={comment_id:modal.id,role:String(data.get('role')),evidence_ref:'OPS-01:v2:3',decision:String(data.get('decision')).trim()}}
   }catch(error){failure=error.message;focusFailureAfterRender=true;render();return}
   if(type==='question')query={...payload};
   execute(async()=>{
    if(type==='question')await ask(payload,true);
    if(type==='comment'){await store.command('comment',payload);finishModal();notice='확인 요청을 남겼습니다. 현재 답과 기준은 유지됩니다.'}
    if(type==='review'){await store.command('review',payload);finishModal();notice='담당 확인을 기록했습니다. KB 발행 후 새 질문에 적용됩니다.'}
   },{question:type==='question'});
  });
  const dialog=main.querySelector('.gw-dialog');
  dialog?.addEventListener('cancel',event=>{event.preventDefault();closeModal()});
  dialog?.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const controls=[...dialog.querySelectorAll(focusableSelector)].filter(node=>!node.disabled&&node.tabIndex>=0),first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}});
 }
 async function mount(element,tab){host=element;const requestedTopic={1:'revenue',2:'customer',3:'refund'}[tab];if(requestedTopic&&requestedTopic!==query.topic){query={...query,topic:requestedTopic,question:topics[requestedTopic].question,purpose:'',period:requestedTopic==='revenue'?'september':'october',refund_id:'R1'};activeAnswer=null}render();try{await store.ready();unsubscribe=store.subscribe?.(()=>{if(!busy)render()});if(!activeAnswer){busy=true;await ask(query);busy=false}render()}catch(error){busy=false;failure=error.message;render()}}
 function unmount(){unsubscribe?.();unsubscribe=null;host?.querySelector('.gw-dialog[open]')?.close();host?.ownerDocument.documentElement.classList.remove('gw-modal-open');modal=null;renderedModal=null;focusAfterRender=null;if(host)host.innerHTML='';host=null}
 return{mount,unmount,docs};
}
root.KnowHowGeneralWorkflowUI={createController};
})(typeof window!=='undefined'?window:globalThis);
