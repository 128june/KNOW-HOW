import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Run the production request function with controlled HTTP responses, without
// exposing a testing API in the shipped browser controller.
const source=readFileSync(new URL('../src/support-workspace.js',import.meta.url),'utf8');
const requestSource=source.slice(source.indexOf('  async function request('),source.indexOf('  function unreadBadge('));
async function failure(action,body){
 const state={session:'synthetic-session',role:'kb_admin',expired:false};
 const context=vm.createContext({state,epoch:0,base:'https://synthetic.invalid',AbortSignal,fetch:async()=>({ok:false,status:503,json:async()=>body})});
 vm.runInContext(`class Obsolete extends Error {}\n${requestSource}\nglobalThis.invoke=request;`,context);
 try{await context.invoke(action);assert.fail('Expected failed HTTP response');}catch(error){return {message:error.message,status:error.status,state};}
}
test('AI invalid_response explains that existing input needs no re-entry',async()=>{
 const result=await failure('knowledge-review-ai-draft',{error:'AI 응답을 사용할 수 없습니다. 원문 근거를 확인하세요.',error_code:'invalid_response'});
 assert.equal(result.message,'AI 연결 또는 응답을 확인하지 못했습니다. 작성한 내용은 보존되어 있으니 다시 입력하지 않아도 됩니다.');
 assert.equal(result.status,503);assert.equal(result.state.expired,false);
});
test('specific AI timeout/input-limit messages remain unchanged',async()=>{
 for(const error_code of ['timeout','input_limit']){
  const error=`구체 안내: ${error_code}`;
  assert.equal((await failure('knowledge-review-ai-draft',{error,error_code})).message,error);
 }
});
test('other request errors are not relabeled as AI connection failures',async()=>{
 const error='기존 발행 오류 안내';
 assert.equal((await failure('knowledge-review-publish',{error,error_code:'invalid_response'})).message,error);
});
