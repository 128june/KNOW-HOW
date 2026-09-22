/* Prepared, deterministic scenario calculations. No model call or identity authentication. */
(function (root) {
 'use strict';
 const fixture = root.KnowHowGeneralWorkflowFixture || (typeof require === 'function' ? require('./general-workflow-fixture.js') : null);
 if (!fixture) throw Error('업무 사례 원본을 먼저 불러오세요.');
 const clone = value => JSON.parse(JSON.stringify(value));
 const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
 const uniq = values => [...new Set(values)];
 const ref = (document_id, version, section) => ({document_id, version, section:String(section)});
 const now = () => new Date().toISOString();
 function fail(message, code='invalid_request', status=400) { const error = Error(message); error.code=code; error.status=status; throw error; }
 function initialState() { return {revision:0,refundVersion:1,comments:[],reviews:[],answers:[],publications:[]}; }
 function checkState(state) {
  if (!state || ![1,2].includes(state.refundVersion) || !Number.isInteger(state.revision) || state.revision<0 || !['comments','reviews','answers'].every(key=>Array.isArray(state[key]))) fail('업무 저장 상태가 올바르지 않습니다.');
 }
 function docs(state) {
  checkState(state);
  return fixture.knowledge_documents.map(document => ({
   ...clone(document), department:document.id==='KB-REV-01'?'finance':document.id==='KB-CUST-01'?'data':'operations', prepared:true,
   filename:'부서문서-원본묶음.md', basis:'확인된 계약·계정·결제·환불 관계와 합성 스냅샷 SNAP-01',
   comments:clone(state.comments.filter(comment=>comment.document_id===document.id)),
   versions:document.versions.filter(version=>document.id!=='KB-REF-01'||version.version<=state.refundVersion).map(version=>({
    ...clone(version), content:version.rules.join('\n\n')+'\n\n원문 근거\n'+version.source_refs.map(source=>source.document_id+' v'+source.version+' §'+source.section).join('\n'),
    validFrom:version.valid_from,validTo:'2026-11-30',valid_to_exclusive:version.valid_to_exclusive,
    status:'published_in_scenario',source_refs:clone(version.source_refs),
    ...(version.version===2?{review_id:(state.publications||[]).find(p=>p.document_id===document.id&&p.version===2)?.review_id||null,resolved_comment_ids:(state.publications||[]).filter(p=>p.document_id===document.id&&p.version===2).map(p=>p.comment_id),published_at:(state.publications||[]).find(p=>p.document_id===document.id&&p.version===2)?.created_at||null}:{}),
    reason:version.version===2?'확인한 상태 정의와 완료 증빙 조건을 반영':'최초 준비된 업무 기준'
   })).sort((a,b)=>b.version-a.version)
  }));
 }
 function source(documentId,version,section) {
  const document=fixture.source_documents.find(doc=>doc.id===documentId&&doc.version===Number(version));
  if (!document) fail('요청한 원문 버전이 없습니다.','not_found',404);
  if (section && !document.section_contents[String(section)]) fail('요청한 원문 절이 없습니다.','not_found',404);
  return clone(section?{...document,content:document.section_contents[String(section)]}:document);
 }
 const aliases={revenue:{contract:'signed',signed:'signed',payment:'net_payment',paid:'paid',recognition:'recognized',recognized:'recognized',deposit:'cash',cash:'cash'},customer:{accounts:'login',login:'login',buyers:'buyer',buyer:'buyer',entities:'legal',legal:'legal',billing:'billing'},refund:{customer:'completed_refund',refund:'requested',settlement:'settled',completed_refund:'completed_refund'}};
 function normalizeQuery(input) {
  if (!input||!aliases[input.topic]) fail('매출·고객·환불 중 업무를 선택하세요.');
  const period=input.period|| (input.topic==='revenue'?'september':'october');
  if (!['september','october'].includes(period)) fail('준비된 사례의 9월 또는 10월을 선택하세요.');
  const contract_ids=uniq(input.contract_ids||['C1','C2']).sort();
  if (!contract_ids.length||contract_ids.some(id=>!fixture.contracts.some(contract=>contract.id===id))) fail('확인된 계약 C1 또는 C2를 선택하세요.');
  const purpose=input.purpose||'';
  if (purpose&&!aliases[input.topic][purpose]&&purpose!=='compare') fail('이 업무에서 지원하는 보고 목적을 선택하세요.');
  const refund_id=input.refund_id||'all';
  if (!['all','R1','R2'].includes(refund_id)) fail('준비된 환불 R1 또는 R2를 선택하세요.');
  if(typeof input.question!=='undefined'&&(typeof input.question!=='string'||input.question.length>1000))fail('질문은 1,000자 이내로 입력하세요.');
  return {topic:input.topic,question:input.question||'',purpose,contract_ids,period,refund_id};
 }
 function refundStatus(row,state) {
  if(state.refundVersion===1) return 'completion_unconfirmed';
  if(row.processor_code==='PENDING'||!row.processor_completed_at) return 'pending';
  const payment=fixture.payments.find(p=>p.id===row.payment_id);
  if(row.processor_code==='SUCCEEDED'&&row.id&&payment&&row.processor_event_id&&Number.isFinite(row.processor_completed_amount)&&row.processor_completed_amount>0&&row.processor_completed_amount===row.requested_amount&&row.processor_completed_amount<=payment.amount) return 'completed';
  return 'completion_unconfirmed';
 }
 function answer(state,input) {
  checkState(state);
  const query=normalizeQuery(input), october=query.period==='october', start=october?'2026-10-01':'2026-09-01', end=october?'2026-10-08':'2026-10-01', asOf=october?'2026-10-07':'2026-09-30';
  const inPeriod=date=>Boolean(date&&date>=start&&date<end);
  const contracts=fixture.contracts.filter(c=>query.contract_ids.includes(c.id));
  const payments=fixture.payments.filter(p=>query.contract_ids.includes(p.contract_id)&&p.status==='succeeded'&&!p.is_test);
  const paymentIds=payments.map(p=>p.id);
  const refunds=fixture.refunds.filter(r=>paymentIds.includes(r.payment_id)&&(query.topic!=='refund'||query.refund_id==='all'||query.refund_id===r.id));
  if(query.topic==='refund'&&query.refund_id!=='all'&&!refunds.length) fail('선택한 환불 '+query.refund_id+'은 선택한 계약에 연결되지 않습니다. 환불에 연결된 계약을 선택하세요.','refund_scope_mismatch');
  const refundIds=refunds.map(r=>r.id);
  const settlements=fixture.settlements.filter(s=>s.ref_type==='payment'?paymentIds.includes(s.ref_id):refundIds.includes(s.ref_id));
  const periodPayments=payments.filter(p=>inPeriod(p.paid_at));
  const requested=refunds.filter(r=>inPeriod(r.requested_at));
  const completed=refunds.filter(r=>refundStatus(r,state)==='completed'&&inPeriod(r.processor_completed_at));
  const periodSettlements=settlements.filter(s=>inPeriod(s.settled_at));
  const completedAmount=state.refundVersion===1?null:sum(completed,'processor_completed_amount');
  const paidAmount=sum(periodPayments,'amount');
  const metrics=[],rows=[],excluded=[];
  const metric=(key,label,value,unit,definition,items,sources)=>metrics.push({key,label,value,unit,definition,row_ids:items.map(item=>item.id),source_refs:sources});
  const row=(item,kind,label,sources,extra={})=>({ ...clone(item),kind,label,source_refs:sources,...extra });
  const opsRef=ref('OPS-01',state.refundVersion,3);
  const unlinked=fixture.payments.filter(p=>!p.contract_id).map(p=>row(p,'payment','연결 미확인 결제',[ref('SAL-01',1,3)],{reason:'표시명만 같고 계약번호·배분 근거가 없어 대상 계약에서 제외',settlement_unknown:true,net_cash:null}));
  excluded.push(...unlinked);
  if(query.topic==='revenue') {
   const signed=contracts.filter(c=>inPeriod(c.signed_at));
   const recognized=fixture.recognized_service.filter(n=>query.contract_ids.includes(n.contract_id)&&inPeriod(n.confirmed_at));
   metric('signed','영업 최초 수주',sum(signed,'original_amount'),'원','최초 서명월의 원계약 서비스 대가. 후속 취소는 별도 변경 실적',signed,[ref('SAL-01',1,1)]);
   metric('paid','성공 결제',paidAmount,'원','기간 내 성공 결제 ID별 금액. 수수료 차감 전',periodPayments,[ref('OPS-01',1,1)]);
   metric('recognized','재무 제공 실적',october?null:sum(recognized,'amount'),'원',october?'10/7 부분 자료로 10월 전체 제공 실적을 확정할 수 없음':'9월 제공 완료가 확인된 금액. 10월 시작 계약 제외',recognized,[ref('FIN-01',1,1)]);
   metric('cash','실제 입금 순액',sum(periodSettlements,'net_cash'),'원','실제 입금일의 수수료 차감 후 현금에서 해당 기간 정산 차감 반영',periodSettlements,[ref('FIN-01',1,2)]);
   metric('completed_refund','완료 환불',completedAmount,'원',state.refundVersion===1?'상태 의미 미확인. 미확인 금액을 0원으로 확정하지 않음':'원결제·금액·완료시각이 확인된 성공 환불의 완료월 기준',completed,[opsRef]);
   metric('net_payment','결제 운영 순액',completedAmount===null?null:paidAmount-completedAmount,'원','동일 기간 성공 결제 − 완료가 확인된 환불. 실제 입금과 다른 지표',[...periodPayments,...completed],[ref('OPS-01',1,1),opsRef]);
   rows.push(...contracts.map(c=>row(c,'contract','원계약',[c.source_ref])),...payments.map(p=>row(p,'payment','성공 결제',[ref('OPS-01',1,1)])),...refunds.map(r=>row(r,'refund','환불 사건',[opsRef],{status:refundStatus(r,state)})),...fixture.recognized_service.filter(n=>query.contract_ids.includes(n.contract_id)).map(n=>row(n,'recognized','제공 확인분',[n.source_ref])),...settlements.map(s=>row(s,'settlement','현금 정산',[ref('FIN-01',1,2)])));
   if(!october) {
    const future=contracts.map(c=>({id:c.id,amount:c.original_amount-fixture.recognized_service.filter(n=>n.contract_id===c.id&&n.confirmed_at<end).reduce((n,r)=>n+r.amount,0)}));
    metric('future_service','결제와 제공 실적 차이',paidAmount-sum(recognized,'amount'),'원','9월 말 원계약 기준 이후 제공 예정분 '+future.map(c=>c.id+' '+c.amount.toLocaleString('ko-KR')+'원').join(' + '),contracts,[ref('SAL-01',1,1),ref('FIN-01',1,1)]);
    metric('cash_timing_difference','결제와 입금 차이',paidAmount-sum(periodSettlements,'net_cash'),'원','해당 기간 수수료와 다음 기간 입금 대상 결제로 발생한 차이',[...periodPayments,...periodSettlements],[ref('FIN-01',1,2)]);
   }
  } else if(query.topic==='customer') {
   const memberships=fixture.account_memberships.filter(a=>query.contract_ids.includes(a.contract_id)&&inPeriod(a.login_at)&&a.login_at>=a.valid_from&&a.login_at<a.valid_to_exclusive);
   const signed=contracts.filter(c=>c.signed_at<=asOf);
   const active=signed.filter(c=>asOf>=c.service_start&&asOf<c.service_end_exclusive);
   metric('login','로그인 계정',october?uniq(memberships.map(a=>a.account_id)).length:null,'개',october?'10/1~10/7 로그인했고 사건시점에 이용 권한이 유효한 계정 ID 수. 사람 수 아님':'9월 로그인 자료가 제공되지 않아 계정 수 확인 불가',memberships,[ref('OPS-01',1,2)]);
   metric('buyer','구매자 계정',uniq(signed.map(c=>c.buyer_account_id)).length,'개','기준일까지 계약에 기록된 주문 주체 계정의 중복 제거',signed,[ref('SAL-01',1,2)]);
   metric('legal','서비스 중 계약 법인',uniq(active.map(c=>c.legal_entity_id)).length,'곳',asOf+'에 서비스가 유효한 계약의 법인 ID 수',active,[ref('SAL-01',1,2)]);
   metric('billing','청구 고객',uniq(signed.map(c=>c.billing_customer_id)).length,'곳','기준일까지 계약의 청구 대상 ID 수. 동일 청구처를 이유로 법인 합치지 않음',signed,[ref('SAL-01',1,2),ref('FIN-01',1,3)]);
   rows.push(...signed.map(c=>row(c,'contract','계약·법인·청구 관계',[ref('SAL-01',1,2)])),...memberships.map(a=>row(a,'account','유효 권한·로그인 계정',[ref('OPS-01',1,2)])));
  } else {
   const deductions=periodSettlements.filter(s=>s.ref_type==='refund');
   metric('requested','기간 내 환불 요청',sum(requested,'requested_amount'),'원','환불 요청일과 요청금액. 요청액은 완료액과 별도',requested,[ref('OPS-01',1,3)]);
   metric('completed_refund','기간 내 완료 환불',completedAmount,'원',state.refundVersion===1?'DONE·SUCCEEDED 의미 미확인으로 고객 환불 완료 안내 보류':'원결제·환불 ID·완료금액·완료시각을 대조한 성공 건만 완료',completed,[opsRef]);
   metric('settled','기간 내 정산 차감',sum(deductions,'refund_deduction'),'원','재무 정산표의 실제 차감일 기준. 고객 환불 완료 판단을 대신하지 않음',deductions,[ref('FIN-01',1,2)]);
   rows.push(...refunds.map(r=>row(r,'refund',r.id+' 환불 사건',[opsRef],{status:refundStatus(r,state),explanation:state.refundVersion===1?'코드 정의 확인 전: 완료 여부 보류':refundStatus(r,state)==='completed'?'운영 DONE은 결제사 접수. '+r.processor_completed_at+' 고객 환불 완료 확인':'PENDING 또는 완료 증빙 미확인: 완료액에서 제외'})),...settlements.filter(s=>s.ref_type==='refund').map(s=>row(s,'settlement','환불 정산 차감',[ref('FIN-01',1,2)])));
  }
  refunds.filter(r=>refundStatus(r,state)!=='completed').forEach(r=>excluded.push(row(r,'refund','완료액에서 제외 또는 보류',[opsRef],{reason:refundStatus(r,state)==='pending'?'PENDING이며 완료시각 없음':'상태 코드의 업무 의미 미확인',status:refundStatus(r,state)})));
  const key=aliases[query.topic][query.purpose], chosen=metrics.find(m=>m.key===key), topicLabel={revenue:'매출',customer:'고객',refund:'환불'}[query.topic];
  const scope=contracts.map(c=>c.id).join('·'), periodLabel=october?'10월 7일까지':'9월';
  let summary=chosen?(chosen.value===null?chosen.label+': 현재 근거로 확정할 수 없습니다. '+chosen.definition:chosen.label+': '+chosen.value.toLocaleString('ko-KR')+chosen.unit+'입니다. '+chosen.definition):'업무 목적을 선택하면 사용할 지표를 표시합니다. 같은 대상의 값도 정의·집계 단위·시점이 달라집니다.';
  if(query.topic==='revenue'&&query.purpose==='payment'&&state.refundVersion===1)summary='성공 결제: '+paidAmount.toLocaleString('ko-KR')+'원입니다. 환불 완료 정의가 미확인이라 차감할 완료 환불액과 결제 운영 보고 순액은 확정할 수 없습니다. 성공 결제액은 수수료 차감 전 금액입니다.';
  if(query.topic==='refund'&&state.refundVersion===1)summary='고객 환불 완료 안내는 보류하세요. 요청과 정산 기록은 있으나 DONE·SUCCEEDED의 업무 의미가 아직 확인되지 않았습니다.';
  if(query.topic==='refund'&&state.refundVersion===2&&refunds.some(r=>r.id==='R1'))summary+=' R1은 10/2 결제사 접수, 10/3 고객 환불 완료, 10/6 정산 차감으로 구분합니다.';
  const knowledge=query.topic==='revenue'?[{id:'KB-REV-01',version:1},{id:'KB-REF-01',version:state.refundVersion}]:[{id:query.topic==='customer'?'KB-CUST-01':'KB-REF-01',version:query.topic==='customer'?1:state.refundVersion}];
  const relevantIds=new Set([...query.contract_ids,...rows.map(r=>r.id),...payments.map(r=>r.id),...refundIds,'PX']);
  const relationships=fixture.link_records.filter(l=>relevantIds.has(l.from)||relevantIds.has(l.to)).map(l=>({id:l.id,version:l.version}));
  return {id:'ANS-'+(state.answers.length+1),query,title:periodLabel+' '+scope+' '+topicLabel+' 업무 결과',summary,metrics,rows,excluded,basis:{snapshot_id:fixture.provenance.snapshot_id,knowledge,relationships},created_at:now(),as_of:asOf,period_start:start,period_end_exclusive:end,prepared:true,synthetic:true,mode:'prepared_deterministic',selected_metric:key||null};
 }
 function command(state,action,payload={},expectedRevision) {
  checkState(state);
  if(!Number.isInteger(expectedRevision)||expectedRevision!==state.revision)fail('다른 화면에서 상태가 바뀌었습니다. 최신 상태를 다시 읽으세요.','revision_conflict',409);
  const next=clone(state); next.publications=next.publications||[]; let result;
  if(action==='comment') {
   const document=docs(state).find(doc=>doc.id===payload.document_id);
   const allowedRows={'KB-REV-01':['C1','C2','P1','P2','PX','N1','S1','S2','S3'],'KB-CUST-01':['C1','C2','U1','U2','U3','U4','E1','E2','B1','PX'],'KB-REF-01':['R1','R2']};
   if(!document||!allowedRows[document.id].includes(payload.target_row_id))fail('확인할 KB와 원본 행을 선택하세요.');
   if(typeof payload.body!=='string'||!payload.body.trim()||payload.body.trim().length>2000)fail('확인 요청은 1~2,000자로 입력하세요.');
   result={id:'CM-'+(next.comments.length+1),document_id:document.id,version:document.versions[0].version,target_row_id:payload.target_row_id,body:payload.body.trim(),status:'pending',created_at:now()};
   next.comments.push(result);
  } else if(action==='review') {
   const comment=next.comments.find(comment=>comment.id===payload.comment_id);
   if(!comment||comment.status!=='pending')fail('대기 중인 확인 요청을 선택하세요.');
   if(comment.document_id!=='KB-REF-01'||comment.target_row_id!=='R1'||comment.version!==1||state.refundVersion!==1)fail('이 준비된 담당 확인은 KB-REF-01 v1의 R1 상태 정의에만 적용됩니다.');
   if(payload.role!==fixture.correction.review.actor_role||payload.evidence_ref!=='OPS-01:v2:3')fail('담당 역할과 OPS-01 v2 §3의 확인 근거가 필요합니다.');
   if(typeof payload.decision!=='string'||!payload.decision.trim()||payload.decision.length>2000)fail('확인 결정과 적용 범위를 입력하세요.');
   result={id:'RV-'+(next.reviews.length+1),comment_id:comment.id,role:payload.role,evidence_ref:payload.evidence_ref,decision:payload.decision.trim(),status:'confirmed',created_at:now(),real_person:false,evidence_rows:['R1','P1'],applicability:fixture.correction.review.applicability};
   next.reviews.push(result);comment.status='reviewed';comment.review_id=result.id;
  } else if(action==='publish') {
   const review=next.reviews.find(review=>review.id===payload.review_id),comment=review&&next.comments.find(comment=>comment.id===review.comment_id);
   if(!review||review.status!=='confirmed'||!comment||comment.status!=='reviewed'||comment.document_id!=='KB-REF-01'||comment.target_row_id!=='R1'||next.refundVersion!==1)fail('확인된 R1 요청만 새 기준으로 발행할 수 있습니다.');
   next.refundVersion=2;review.status='published';review.published_version=2;comment.status='published';comment.published_version=2;
   result={id:'PUB-'+(next.publications.length+1),document_id:'KB-REF-01',version:2,review_id:review.id,comment_id:comment.id,created_at:now()}; next.publications.push(result);
  } else if(action==='answer') {
   if(!payload.answer||!payload.answer.query)fail('저장할 업무 질문 결과가 없습니다.');
   const calculated=answer(state,payload.answer.query);
   for(const field of ['metrics','rows','excluded','basis'])if(JSON.stringify(calculated[field])!==JSON.stringify(payload.answer[field]))fail('현재 원본과 기준으로 계산한 결과만 저장할 수 있습니다.','stale_answer',409);
   result={...calculated,id:'ANS-'+(next.answers.length+1),created_at:now()};next.answers.push(result);
  } else fail('지원하지 않는 업무 명령입니다.');
  next.revision+=1; return {state:next,result:clone(result)};
 }
 const api={fixture,initialState,docs,source,answer,command};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.KnowHowGeneralWorkflowCore=api;
})(typeof window!=='undefined'?window:globalThis);
