/* Shared KB source reader and explicit, server-authorized charging KB management. */
(function(root){'use strict';
 const departments={counselor:'상담사',app:'앱개발팀',device:'충전기개발팀',finance:'재무팀',data:'데이터팀',operations:'고객운영팀'};
 const labels={support:'충전 민원 대응',general:'매출·고객·환불'};
 const clone=value=>JSON.parse(JSON.stringify(value));
 function createProvider({general}={}){
  const apiBase=(root.KNOWHOW_CONFIG?.apiBase||'https://api.ctrl-j.xyz/knowhow').replace(/\/$/,'');
  const sessionKey='knowhow.support.session:'+apiBase;
  const generalController=general||root.KnowHowGeneralKnowledge?.createController();
  let session=null,connecting=null;
  async function request(action,body){
   if(!['session','knowledge','knowledge-publication','knowledge-query','knowledge-document','knowledge-management','knowledge-document-save','knowledge-document-state','knowledge-publication-state','knowledge-review-standard'].includes(action))throw Error('지원하지 않는 KB 요청입니다.');
   let response;
   try{response=await root.fetch(apiBase+'/demo/support/'+action,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});}
   catch{throw Error('상담사 업무 KB 서버에 연결하지 못했습니다.');}
   const result=await response.json().catch(()=>null);
   if(!response.ok){
    if(response.status===401){session=null;try{root.sessionStorage.removeItem(sessionKey)}catch{}}
    const error=Error((result?.error||'충전 민원 KB 요청을 완료하지 못했습니다.')+' (HTTP '+response.status+').'+(response.status===409?' 작성 내용은 유지됩니다. 최신 버전을 확인한 뒤 다시 수정하세요.':''));error.status=response.status;throw error;
   }
   if(!result||typeof result!=='object')throw Error('상담사 업무 KB 응답 형식을 확인하지 못했습니다.');
   return result;
  }
  async function connect(){
   try{session=root.sessionStorage.getItem(sessionKey)||session}catch{}
   if(session)return session;
   if(!connecting)connecting=request('session',{}).then(result=>{
    if(typeof result.session_id!=='string'||!result.session_id)throw Error('상담사 KB 조회 세션을 확인하지 못했습니다.');
    session=result.session_id;try{root.sessionStorage.setItem(sessionKey,session)}catch{};return session;
   }).finally(()=>{connecting=null});
   return connecting;
  }
  function supportDocument(doc){
   if(!doc||typeof doc.id!=='string'||!doc.id||typeof doc.title!=='string'||!Array.isArray(doc.sections)||!doc.sections.length||doc.sections.some(s=>typeof s.title!=='string'||typeof s.text!=='string'))throw Error('상담사 KB의 문서 본문을 확인하지 못했습니다.');
   const content=[doc.purpose||'',...doc.sections.map(s=>s.title+'\n'+s.text)].filter(Boolean).join('\n\n');
   return {...clone(doc),key:'support:'+doc.id,collection:'support',collectionLabel:labels.support,departmentLabel:doc.standard_id?'충전 업무 표준':departments[doc.department]||doc.department||'부서 미지정',originLabel:doc.standard_id?'관리자 발행 KB':'서버 저장 KB',kindLabel:doc.standard_id?'이 업무 공간의 검토·발행 기록':'시연용 업무 기준',stateLabel:doc.status_label||doc.status||'검토 상태 미제공',content,validFrom:doc.valid_from||doc.effective_at||null,validTo:doc.valid_to||null,versions:doc.versions||doc.history||[],history:doc.history||[],comments:doc.comments||[],source:doc.source||null};
  }
  async function supportDocuments(){
   let snapshot;
   if(typeof root.KnowHowSupport?.readKnowledgeSnapshot==='function')snapshot=await root.KnowHowSupport.readKnowledgeSnapshot();
   else if(typeof root.KnowHowSupport?.readKnowledge==='function')snapshot={documents:await root.KnowHowSupport.readKnowledge()};
   else snapshot=await request('knowledge',{session_id:await connect(),role:'counselor'});
   if(!Array.isArray(snapshot.documents))throw Error('상담사 업무 KB 목록 형식을 확인하지 못했습니다.');
   const docs=snapshot.documents.map(doc=>({...supportDocument(doc),withdrawnStandardIds:clone(snapshot.withdrawn_standard_ids||[]),managementState:clone(snapshot.document_states?.[doc.id]||null)}));
   if(new Set(docs.map(doc=>doc.key)).size!==docs.length)throw Error('상담사 KB 응답에 중복 문서가 있습니다.');
   const order={counselor:0,app:1,device:2};
   return docs.sort((a,b)=>(order[a.department]??3)-(order[b.department]??3));
  }
  async function generalDocuments(){
   await generalController?.ready?.();
   if(!generalController?.docs)throw Error('매출·고객·환불 KB를 읽는 기능을 불러오지 못했습니다.');
   const docs=generalController.docs();
   if(!Array.isArray(docs)||!docs.length)throw Error('매출·고객·환불 KB 목록에 문서가 없습니다.');
   return docs.map(doc=>{
    const current=doc.versions?.[0];
    if(typeof doc.id!=='string'||!current||typeof current.content!=='string'||!current.content.trim())throw Error('이 기기의 KB 본문 또는 버전 형식을 확인하지 못했습니다.');
    return {...clone(doc),key:'general:'+doc.id,collection:'general',collectionLabel:labels.general,departmentLabel:doc.owner||departments[doc.department]||doc.department||'부서 미지정',originLabel:doc.originLabel||(doc.prepared?'준비된 예시':'이 기기 기록'),kindLabel:'가상 업무 기준',stateLabel:doc.stateLabel||(doc.prepared?'준비된 기준 · 이 기기 저장 전':'이 기기 저장 · 팀 공유 상태 별도 확인'),content:current.content,version:current.version,validFrom:current.validFrom||null,validTo:current.validTo||null,source:{kind:doc.storageMode==='api'?'general_workflow_api':'general_browser_knowledge',source_refs:current.source_refs||[],fixture_id:doc.id,synthetic:true,filename:doc.filename||null,basis:doc.basis||null,raw:doc.raw??null,schema:doc.schema||null,guide:doc.guide||null},versions:clone(doc.versions),history:clone(doc.versions),comments:clone(doc.comments||[])};
   });
  }
  async function load(){
   const results=await Promise.allSettled([supportDocuments(),Promise.resolve().then(generalDocuments)]);
   const documents=[],notices=[],collections=[];
   ['support','general'].forEach((id,index)=>{
    const result=results[index];
    if(result.status==='fulfilled'){
     documents.push(...result.value);collections.push({id,label:labels[id],status:'ready',count:result.value.length});
    }else{
     const error=result.reason?.message||'KB 목록을 읽지 못했습니다.';
     collections.push({id,label:labels[id],status:'error',count:0,error});notices.push(labels[id]+': '+error);
    }
   });
   return {documents,collections,notices};
  }
  async function detail(key,version){
   if(typeof key!=='string')throw Error('선택한 KB 식별자를 확인하세요.');
   let documents;
   if(key.startsWith('support:'))documents=await supportDocuments();
   else if(key.startsWith('general:'))documents=await generalDocuments();
   else throw Error('지원하지 않는 KB입니다.');
   let document=documents.find(doc=>doc.key===key);
   if(!document&&key.startsWith('support:')&&Number.isSafeInteger(Number(version))&&Number(version)>0){
    const scope={session_id:await connect(),role:'counselor',version:Number(version)};
    let result;
    try{result=await request('knowledge-publication',{...scope,standard_id:key.slice(8)});}
    catch(error){if(error.status!==404)throw error;result=await request('knowledge-document',{...scope,document_id:key.slice(8)});}
    document={...supportDocument({...result.document,versions:result.history||[]}),isHistorical:true,managementState:result.state||null};
   }
   if(!document)throw Error('선택한 KB가 최신 목록에 없습니다. 목록을 새로고침해 주세요.');
   if(document.standard_id&&!document.isHistorical){
    const result=await request('knowledge-publication',{session_id:await connect(),role:'counselor',standard_id:document.standard_id});
    document={...supportDocument({...result.document,versions:result.history||[]}),withdrawnStandardIds:document.withdrawnStandardIds,managementState:result.state||null};
   }
   if(document.collection==='support'&&!document.standard_id&&document.source_version&&!document.isHistorical){
    const result=await request('knowledge-document',{session_id:await connect(),role:'counselor',document_id:document.id});
    document={...supportDocument({...result.document,versions:result.history||[]}),withdrawnStandardIds:document.withdrawnStandardIds,managementState:result.state||null};
   }
   if(version!==undefined){const v=document.versions.find(v=>v.version===Number(version));if(!v)throw Error('요청한 KB 버전이 보존되어 있지 않습니다.');return {...document,...clone(v),key:document.key,collection:document.collection,versions:document.versions,history:document.history,content:v.content||v.sections?.map(s=>s.title+'\n'+s.text).join('\n\n')||'',version:v.version,sections:v.sections||[],source_refs:v.source_refs||[],validFrom:v.validFrom||v.valid_from||v.effective_at||null,validTo:v.validTo||v.valid_to||null,isHistorical:!!document.isHistorical||Number(v.version)!==Number(document.version)};}
   return document;
  }
  async function query(key,question,asOf,generate=false){
   if(typeof key!=='string'||!key.startsWith('support:'))throw Error('발행한 충전 KB를 선택하세요.');
   const sessionId=await connect();
   return request('knowledge-query',{session_id:sessionId,role:'counselor',document_id:key.slice(8),question,as_of:asOf,generate});
  }
  async function admin(action,payload={}){return request(action,{...payload,session_id:await connect(),role:'kb_admin'});}
  const management=()=>admin('knowledge-management');
  const saveDocument=payload=>admin('knowledge-document-save',payload);
  const setDocumentState=payload=>admin('knowledge-document-state',payload);
  const setStandardState=payload=>admin('knowledge-publication-state',payload);
  const openStandardReview=payload=>admin('knowledge-review-standard',payload);
  return {load,detail,query,management,saveDocument,setDocumentState,setStandardState,openStandardReview};
 }
 root.KnowHowKBCatalog={createProvider};
})(window);
