/* Metadata-only data → knowledge bridge. The server owns provenance and access checks. */
(function(root){'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function createController({apiBase,dataApiBase}={}){
  // dataApiBase is intentionally not used to read rows or manufacture a source record.
  const organization=root.KnowHowOrganizationKB||root.KnowHowOrganizationUI;
  if(!organization)throw Error('조직 KB 화면을 먼저 불러와 주세요.');
  const orgUI=organization.createController({apiBase,samplePack:'general'});
  orgUI.changeScope({department:'data',includeCompany:false});
  let host=null,orgHost=null,unmountOrg=null,epoch=0,draftIdentity=null;
  const state={datasetId:null,expanded:false,busy:false,error:'',notice:'',draft:null,manifest:null,view:'library'};
  const context=()=>{const s=orgUI.getState();return [epoch,state.datasetId,s.session,s.org,s.department].join('|')};
  const identity=()=>{const s=orgUI.getState();return JSON.stringify([s.session,s.org,s.department])};
  const current=value=>host&&context()===value;
  function detachOrg(){if(unmountOrg)unmountOrg();unmountOrg=null;orgHost=null}
  function mountOrg(){
   const target=host?.querySelector('[data-knowledge-region="organization"]');
   if(!target||!orgUI.getState().session)return;
   if(orgHost===target)return;
   detachOrg();orgHost=target;unmountOrg=orgUI.mount(target,{mode:state.view});
  }
  function actions(){
   const target=host?.querySelector('[data-knowledge-region="actions"]');if(!target)return;
   if(state.draft&&draftIdentity!==identity()){state.draft=null;state.manifest=null;state.notice='';state.error=''}
   const connected=!!orgUI.getState().session,disabled=state.busy?'disabled':'';
   target.innerHTML=`${!connected?`<button class="primary" data-knowledge-action="connect" ${disabled}>${state.busy?'연결 중…':'조직 KB 세션 연결'}</button>`:`<p class="muted">아래 가상 조직·부서를 선택한 뒤 초안을 만드세요. 저장 범위는 선택한 부서이며, 담당자 확인 전에는 질의 근거로 사용되지 않습니다.</p><button class="primary" data-knowledge-action="draft" ${disabled}>${state.busy?'처리 중…':'선택한 부서에 데이터 가이드 초안 만들기'}</button>`}${state.draft?`<p class="notice">초안으로 저장한 문서 v${esc(state.draft.version)}입니다. 현재 확인 상태는 아래 문서에서 확인하세요. 전사 공유는 별도 승인 절차입니다.</p><p>이 지식의 조회 ID: <code>${esc(state.draft.identifier||state.draft.id)}</code></p><div class="actions"><button data-knowledge-action="review" ${disabled}>저장한 초안 검토하기</button><button data-knowledge-action="query" ${disabled}>조직 KB에서 질문하기</button><button data-knowledge-action="manifest" ${disabled}>서버가 검증한 데이터 출처 보기</button></div>${state.view==='chat'?'<p class="muted">저장한 문서를 질문 대상으로 선택했습니다. 담당자 확인을 마친 현재 버전을 조회하며, 기본 조회는 AI 생성 없이 근거를 표시합니다.</p>':''}`:''}<p role="status">${esc(state.notice)}</p>${state.error?`<p role="alert" class="scope-reason">${esc(state.error)}</p>`:''}${state.manifest?`<details open><summary>서버 출처 확인 · ${esc(state.manifest.status||'확인됨')}</summary><pre class="source">${esc(JSON.stringify(state.manifest.manifest||{},null,2))}</pre></details>`:''}`;
   target.querySelectorAll('[data-knowledge-action]').forEach(button=>button.onclick=()=>run(button.dataset.knowledgeAction));
  }
  function render(){
   if(!host)return;detachOrg();
   if(!state.datasetId){host.innerHTML='';return}
   host.innerHTML=`<section class="card data-knowledge-bridge"><h2>데이터 구조·업무 가이드</h2><p>데이터의 열 구조, 처리 규칙과 원본부터의 연결을 조직 지식으로 남깁니다.</p>${!state.expanded?'<button class="primary" data-knowledge-action="reveal">이 데이터의 의미를 지식으로 남기기</button>':`<p class="notice">공개 체험의 가상 데이터를 선택한 가상 조직·KB 세션의 가이드 초안으로 연결합니다. 데이터 공개 범위와 KB 세션은 별개이며, 이 연결은 서버가 확인합니다. 실제 조직의 로그인 자료로 연결되지 않습니다.</p><p class="muted">샘플 값과 원본 개인행은 보내지 않습니다. 서버가 허용한 스키마·가공 규칙·원본 식별자·해시·생성 시각·계보만 출처로 보존합니다. 출처가 만료되거나 접근할 수 없으면 확인·공유·질의 근거에서 제외됩니다.</p><div data-knowledge-region="actions"></div><div data-knowledge-region="organization"></div>`}</section>`;
   const reveal=host.querySelector('[data-knowledge-action="reveal"]');if(reveal)reveal.onclick=()=>{state.expanded=true;render()};
   actions();mountOrg();
  }
  async function run(action){
   if(state.busy||!host)return;
   if(action==='query'){if(state.draft&&draftIdentity===identity()){state.view='chat';detachOrg();mountOrg();orgUI.askDocument({id:state.draft.id,title:state.draft.title||'데이터 구조·업무 가이드',department:orgUI.getState().department})}actions();return}
   const generation=epoch,datasetId=state.datasetId,initialContext=context();
   state.busy=true;state.error='';state.notice='';if(action==='manifest')state.manifest=null;actions();
   try{
    if(action==='connect'){
     await orgUI.connect();
     if(generation!==epoch||datasetId!==state.datasetId||!host)return;
     mountOrg();state.notice='조직 KB 세션을 연결했습니다. 아래에서 저장할 가상 조직·부서를 확인하세요.';
    }else{
     if(!orgUI.getState().session)throw Error('조직 KB 세션을 먼저 연결해 주세요.');
     if(action==='draft'){
      const result=await orgUI.request('data-draft',{dataset_id:datasetId,visibility:'department'});
      if(!current(initialContext))return;
      if(!result.id||result.state!=='draft')throw Error('미확인 초안 응답을 확인할 수 없습니다.');
      state.draft={id:result.id,title:result.title,version:result.version,identifier:result.identifier};draftIdentity=identity();state.manifest=null;state.view='library';
      detachOrg();mountOrg();actions();await orgUI.openDocument(result.id);
     }else if(action==='review'&&state.draft){state.view='library';detachOrg();mountOrg();await orgUI.openDocument(state.draft.id)}
     else if(action==='manifest'&&state.draft){const result=await orgUI.request('data-manifest',{id:state.draft.id});if(current(initialContext))state.manifest=result}
    }
   }catch(error){if(generation===epoch&&host&&(action==='connect'||current(initialContext))&&error?.constructor?.name!=='ObsoleteContext')state.error=error.message||'요청을 완료하지 못했습니다.'}
   finally{if(generation===epoch&&host){state.busy=false;actions()}}
  }
  function scopeChanged(event){if(event.target?.dataset?.orgControl)actions()}
  function destroy(){epoch++;detachOrg();host?.removeEventListener('change',scopeChanged);host=null;state.busy=false}
  return {
   mount(target,{dataset}={}){
    epoch++;detachOrg();host?.removeEventListener('change',scopeChanged);host=target;host.addEventListener('change',scopeChanged);state.busy=false;state.error='';state.notice='';
    const id=dataset?.id==null?null:String(dataset.id);
    if(id!==state.datasetId){state.datasetId=id;state.expanded=false;state.draft=null;state.manifest=null;state.view='library';orgUI.changeScope({includeCompany:false,scope:'department',questionDocument:null,purpose:'read'})}
    render();const mountedEpoch=epoch;return ()=>{if(epoch===mountedEpoch)destroy()};
   },destroy,getState:()=>({...state})
  };
 }
 root.KnowHowDataKnowledgeBridge={createController};
})(window);
