'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/kb-catalog.js'), 'utf8');
const generalSource = fs.readFileSync(path.join(__dirname, '../src/general-knowledge.js'), 'utf8');
const base = 'https://kb.test/knowhow';
const sessionKey = 'knowhow.support.session:' + base;
const copy = value => JSON.parse(JSON.stringify(value));
function supportDoc(department = 'counselor', version = 1) {
  return {
    id: {counselor:'CS-001',app:'APP-001',device:'DEVICE-001'}[department] || 'OTHER-001',
    department, title:'같은 원문 KB', version,
    purpose:'확인한 사실만 사용한다.', status:'시연용 업무 기준 · 실제 부서 검토 전',
    source:'support-kb-v1.json', hash:String(version).repeat(64),
    sections:[{id:'original',title:'원문 절',text:'본문의 줄바꿈\n<조건>과 따옴표 "원문"을 보존한다.'}],
    checklist:['original'], intake_fields:[{key:'context',label:'발생 시각',placeholder:'미확인 허용'}],
    reply_hint:'원문에 없는 조치를 만들지 않는다.'
  };
}
function harness({shared,fetchReply,saved={},general=true} = {}) {
  const calls=[], values=new Map(Object.entries(saved));
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  const root={KNOWHOW_CONFIG:{apiBase:base},localStorage:storage,sessionStorage:storage};
  if(shared) root.KnowHowSupport={readKnowledge:shared};
  root.fetch=async (url,options)=>{
    const call={url,method:options.method,body:JSON.parse(options.body)};calls.push(call);
    // Reject all side-effect endpoints except the explicitly allowed support reader session.
    assert.match(url,/\/demo\/support\/(session|knowledge)$/);
    assert.equal(options.method,'POST');
    assert.equal(options.credentials,'omit');
    const reply=fetchReply ? await fetchReply(call) : {body:url.endsWith('/session')?{session_id:'test-reader'}:{documents:[supportDoc()]}};
    return {ok:(reply.status||200)<400,status:reply.status||200,json:async()=>reply.body};
  };
  const context=vm.createContext({window:root,localStorage:storage,AbortSignal});
  if(general)vm.runInContext(generalSource,context);
  vm.runInContext(source,context);
  return {root,calls,storage,provider:root.KnowHowKBCatalog.createProvider()};
}

test('shared support reader is preferred and preserves the original KB, with counselor first', async()=>{
  const original=[supportDoc('app'),supportDoc('unknown'),supportDoc('device'),supportDoc('counselor')];
  let reads=0;
  const {provider,calls}=harness({shared:async()=>{reads++;return original;}});
  const result=await provider.load();
  const documents=result.documents.filter(d=>d.collection==='support');
  assert.deepEqual(copy(documents.map(d=>d.department)),['counselor','app','device','unknown']);
  assert.equal(reads,1);assert.equal(calls.length,0);
  const doc=documents[0], raw=original.find(d=>d.department==='counselor');
  for(const key of ['sections','purpose','hash','version','source','checklist','intake_fields','reply_hint'])assert.deepEqual(copy(doc[key]),copy(raw[key]));
  assert.ok(doc.content.includes(raw.sections[0].text));
  assert.equal(doc.stateLabel,raw.status);
  assert.equal(doc.originLabel,'서버 저장 KB');
  doc.sections[0].text='consumer edit';
  assert.equal(raw.sections[0].text,'본문의 줄바꿈\n<조건>과 따옴표 "원문"을 보존한다.');
});

test('detail reads the same support document again and reflects its latest version and hash',async()=>{
  let current=supportDoc(), reads=0;
  const {provider}=harness({shared:async()=>{reads++;return [current];}});
  await provider.load();
  current=supportDoc('counselor',2);current.sections[0].text='담당자가 정정한 최신 본문';
  const detail=await provider.detail('support:CS-001');
  assert.equal(reads,2);assert.equal(detail.version,2);assert.equal(detail.hash,'2'.repeat(64));
  assert.equal(detail.sections[0].text,current.sections[0].text);
  assert.ok(detail.content.includes(current.sections[0].text));
});

test('general detail reads the actual browser store again and preserves a local correction',async()=>{
  const {provider,storage,root}=harness({shared:async()=>[supportDoc()]});
  const initial=await provider.load();
  const prepared=initial.documents.find(d=>d.collection==='general');
  assert.equal(prepared.originLabel,'준비된 예시');
  const raw=root.KnowHowGeneralKnowledge.createController().docs().find(d=>d.id===prepared.id);
  raw.prepared=false;raw.versions.unshift({...raw.versions[0],version:2,content:'이 브라우저에서 정정한 기준',reason:'적용 조건 보완'});
  raw.comments=[{body:'예외를 확인했음',resolved:2}];
  storage.setItem('knowhow.general.v2',JSON.stringify([raw]));
  const detail=await provider.detail(prepared.key);
  assert.equal(detail.version,2);assert.equal(detail.content,'이 브라우저에서 정정한 기준');
  assert.equal(detail.originLabel,'이 기기 기록');assert.equal(detail.versions.length,2);
  assert.equal(detail.comments[0].resolved,2);assert.equal(detail.source.raw,raw.raw);
});

test('a failed support read keeps general KBs and an explicit collection error',async()=>{
  const {provider,calls}=harness({shared:async()=>{throw Error('원문 API 연결 실패');}});
  const result=await provider.load();
  assert.equal(result.documents.length,3);
  assert.ok(result.documents.every(d=>d.collection==='general'));
  assert.equal(result.collections[0].status,'error');assert.equal(result.collections[0].count,0);
  assert.match(result.notices[0],/충전 민원 대응.*원문 API 연결 실패/);
  assert.equal(calls.length,0,'a shared-reader failure must not create another session or fabricate content');
  await assert.rejects(provider.detail('support:CS-001'),/원문 API 연결 실패/);
});

test('malformed local records do not hide valid support KBs',async()=>{
  const {provider}=harness({shared:async()=>[supportDoc()],saved:{'knowhow.general.v2':'invalid JSON'}});
  const result=await provider.load();
  assert.equal(result.documents.length,1);assert.equal(result.documents[0].collection,'support');
  assert.equal(result.collections[1].status,'error');assert.match(result.notices[0],/기기에 저장한 기록을 읽지 못했습니다/);
});

test('missing or malformed support documents report the cause without a static fallback',async()=>{
  let documents=[supportDoc()];
  const {provider}=harness({shared:async()=>documents});
  await provider.load();
  documents=[supportDoc('app')];
  await assert.rejects(provider.detail('support:CS-001'),/최신 목록에 없습니다/);
  await assert.rejects(provider.detail('general:missing'),/최신 목록에 없습니다/);
  await assert.rejects(provider.detail('unknown:CS-001'),/지원하지 않는 KB/);
  documents=[];
  let result=await provider.load();assert.equal(result.collections[0].status,'error');assert.match(result.notices[0],/문서가 없습니다/);
  documents=[{...supportDoc(),sections:[]}];
  result=await provider.load();assert.equal(result.collections[0].status,'error');assert.match(result.notices[0],/본문을 확인하지 못했습니다/);
});

test('standalone reader reuses the support UI session and calls only knowledge',async()=>{
  const {provider,calls}=harness({saved:{[sessionKey]:'existing-support-session'}});
  await provider.load();await provider.detail('support:CS-001');
  assert.equal(calls.length,2);
  for(const call of calls){assert.equal(call.url,base+'/demo/support/knowledge');assert.deepEqual(call.body,{session_id:'existing-support-session',role:'counselor'});}
});

test('standalone concurrent loads share one reader session, then read KBs only',async()=>{
  const {provider,calls,storage}=harness();
  await Promise.all([provider.load(),provider.load()]);await provider.detail('support:CS-001');
  assert.equal(calls.filter(c=>c.url.endsWith('/session')).length,1);
  assert.equal(calls.filter(c=>c.url.endsWith('/knowledge')).length,3);
  assert.equal(storage.getItem(sessionKey),'test-reader');
  assert.deepEqual(calls.find(c=>c.url.endsWith('/session')).body,{});
  assert.ok(calls.every(c=>!/(\/demo\/kb\/|chat|generate|embedding|ticket|create|save)/.test(c.url)));
});

test('HTTP failure remains an explicit partial result and is never retried as a write',async()=>{
  const {provider,calls}=harness({saved:{[sessionKey]:'expired-reader'},fetchReply:async()=>({status:401,body:{error:'expired'}})});
  const result=await provider.load();assert.equal(result.collections[0].status,'error');
  assert.match(result.notices[0],/HTTP 401/);assert.equal(calls.length,1);
  assert.equal(calls[0].url,base+'/demo/support/knowledge');
});
