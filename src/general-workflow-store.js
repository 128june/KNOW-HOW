/* One source of state for results and the KB catalog. No inference calls. */
(function(root){'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 function createStore(options={}){
  const core=root.KnowHowGeneralWorkflowCore;
  const apiBase=(options.apiBase??root.KNOWHOW_CONFIG?.generalApiBase??'').replace(/\/$/,'');
  const key='knowhow.general.workflow.v1', workspaceKey=key+':workspace:'+apiBase;
  let current=core.initialState(),workspace='',loading=null,loaded=false;
  const listeners=new Set();
  function notify(){listeners.forEach(fn=>fn(clone(current)))}
  function valid(value){if(!value||!Number.isInteger(value.revision)||![1,2].includes(value.refundVersion)||!['comments','reviews','answers'].every(k=>Array.isArray(value[k])))throw Error('업무 기록 형식을 확인하지 못했습니다. 기존 기록을 덮어쓰지 않습니다.');return value;}
  function localRead(){const raw=root.localStorage.getItem(key);if(!raw)return core.initialState();try{return valid(JSON.parse(raw))}catch{throw Error('저장된 업무 기록을 읽지 못했습니다. 기존 기록을 덮어쓰지 않습니다.')}}
  async function request(path,body){
   let response;try{response=await root.fetch(apiBase+'/demo/general/'+path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)})}catch{throw Error('업무 API에 연결하지 못했습니다. 다시 읽기를 눌러 확인하세요.');}
   const result=await response.json().catch(()=>null);
   if(!response.ok){if(response.status===409&&result?.detail?.state){current=valid(result.detail.state);notify();}throw Error(result?.detail?.message||result?.detail?.error||result?.error||(response.status===409?'다른 담당자가 기록을 변경했습니다. 최신 내용을 확인하고 다시 실행하세요.':'업무 API 조회 실패 (HTTP '+response.status+')'));}
   if(!result?.state)throw Error('업무 API의 기록 응답을 확인하지 못했습니다.');return result;
  }
  async function ready(){if(loaded)return clone(current);if(loading)return loading;loading=(async()=>{
   if(apiBase){workspace=new URLSearchParams(root.location?.search||'').get('general_workspace')||root.localStorage.getItem(workspaceKey)||'';const result=await request('session',workspace?{workspace_id:workspace}:{});workspace=result.workspace_id;current=valid(result.state);root.localStorage.setItem(workspaceKey,workspace)}else current=localRead();
   loaded=true;return clone(current);
  })().finally(()=>{loading=null});return loading;}
  async function sync(){await ready();if(apiBase){current=valid((await request('state',{workspace_id:workspace})).state)}else current=localRead();notify();return clone(current)}
  async function command(action,payload){await ready();let result;
   if(apiBase){const response=await request('command',{workspace_id:workspace,expected_revision:current.revision,action,payload});current=valid(response.state);result=response.result;}
   else {const saved=localRead();if(saved.revision!==current.revision){current=saved;notify();throw Error('다른 탭에서 기록을 변경했습니다. 최신 내용을 확인하고 다시 실행하세요.')}const response=core.command(current,action,payload,current.revision);const next=valid(response.state);root.localStorage.setItem(key,JSON.stringify(next));current=next;result=response.result;}
   notify();return {state:clone(current),result:clone(result??null)};
  }
  async function answer(query){await sync();const prepared=core.answer(current,query);await command('answer',{answer:prepared});return clone(current.answers.find(a=>a.id===prepared.id)||current.answers[current.answers.length-1]||prepared)}
  async function newWorkspace(){if(apiBase){const response=await request('session',{});workspace=response.workspace_id;current=valid(response.state);root.localStorage.setItem(workspaceKey,workspace);const url=new URL(root.location.href);url.searchParams.delete('general_workspace');root.history?.replaceState(null,'',url);}else{const next=core.initialState();root.localStorage.setItem(key,JSON.stringify(next));current=next;}loaded=true;notify();return clone(current)}
  function docs(){return core.docs(current).map(d=>({...d,originLabel:apiBase?'공유 체험 API':'이 브라우저 기록',stateLabel:apiBase?'같은 체험 링크에서 재사용 · 실제 조직 승인 아님':'이 브라우저에 저장 · 실제 조직 공유 아님',storageMode:apiBase?'api':'browser'}))}
  return {ready,sync,command,answer,newWorkspace,docs,state:()=>clone(current),workspaceId:()=>workspace,shareUrl:()=>{if(!apiBase||!workspace)return '';const url=new URL(root.location.href);url.searchParams.set('general_workspace',workspace);url.hash='general-3';return url.href},storageLabel:()=>apiBase?'공유 체험 API · 같은 링크의 담당 역할이 재사용':'이 브라우저 저장 · 다른 기기에는 공유되지 않음',subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn)}};
 }
 root.KnowHowGeneralWorkflowStore={createStore};
})(window);
