// Rendering contracts for real graph records; no API/model requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');
const context = vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/data-lineage-ui.js'),'utf8'),context);
const ui = context.window.KnowHowDataLineageUI;
const graph = {nodes:[],edges:[]};
test('empty graph makes no nodes or completion claims and does not imply a session',()=>{
 const html=ui.markup({graph,connected:false});
 assert.match(html,/아직 연결된 자료 공간이 없습니다/);
 assert.doesNotMatch(html,/data-lineage-node=|data-state="succeeded"/);
});
test('KB identifier remains document identity, distinct from linked dataset identity',()=>{
 const node={id:'knowledge:doc',type:'knowledge',label:'가이드',status:'draft',dataset_id:'mart',document_id:'doc',document:{id:'doc',version:1,department:'data',source:{dataset_id:'mart'}}};
 const html=ui.nodeDetail({nodes:[node],edges:[]},node);
 assert.match(html,/<dt>식별자<\/dt><dd>doc<\/dd>/);
 assert.match(html,/<dt>원본 데이터 ID<\/dt><dd>mart<\/dd>/);
 assert.match(html,/data-document-id="doc"/);
});
test('job identifier is the run even when it has an output dataset',()=>{
 const node={id:'job:run',type:'job',label:'가공',status:'succeeded',job_id:'run',dataset_id:'clean',output_dataset_id:'clean',before_rows:1,after_rows:0,job:{id:'run',kind:'transform',total_rows:1,processed_rows:1}};
 const html=ui.nodeDetail(graph,node);
 assert.match(html,/<dt>식별자<\/dt><dd>run<\/dd>/);
 assert.match(html,/1 → 0행/);
 assert.match(html,/data-dataset-id="clean"/);
});
test('failure with no published result does not gain an output action or completed badge',()=>{
 const html=ui.nodeDetail(graph,{id:'job:failed',type:'job',job_id:'failed',label:'실패',status:'failed',job:{id:'failed',error:'실제 오류'}});
 assert.match(html,/실제 오류|게시한 결과 데이터가 없습니다/);
 assert.doesNotMatch(html,/data-state="succeeded"|처리 결과 보기/);
});
test('ACL hidden policy references are not described as human-only or absent application',()=>{
 const node={id:'job:run',type:'job',label:'가공',status:'succeeded',job:{id:'run',kind:'transform'},privacy_audit:{decisions:[{column:'email',action:'mask',policy_refs:[]}],policies:[],policy_references_hidden:true}};
 const html=ui.nodeDetail(graph,node);
 assert.match(html,/조회할 수 없는 정책 연결/);
 assert.doesNotMatch(html,/연결된 정책 없음 · 사람이 선택한 처리|기록된 정책 문서 연결이 없습니다/);
});
test('labels, identifiers and rules cannot introduce executable markup',()=>{
 const value='<img src=x onerror=alert(1)>';
 const node={id:value,type:'dataset',stage:'intake',label:value,status:'succeeded',dataset_id:value,dataset:{rules:{rename:value},row_count:1}};
 const html=ui.markup({connected:true,graph:{nodes:[node],edges:[]},id:value});
 assert.doesNotMatch(html,/<img/);
 assert.match(html,/&lt;img/);
 assert.match(html,/사용 기록 없음/);
 assert.match(html,/아직 생성된 마트가 없습니다/);
});
test('a bounded graph never treats omitted use or mart records as globally absent',()=>{
 const node={id:'dataset:raw',dataset_id:'raw',type:'dataset',stage:'intake',label:'원본',status:'succeeded',dataset:{id:'raw',row_count:1}};
 const html=ui.markup({connected:true,graph:{nodes:[node],edges:[],truncated:true},id:node.id});
 assert.match(html,/현재 표시 범위에 사용 기록 없음/);
 assert.match(html,/현재 표시 범위에 생성된 마트가 없습니다/);
 assert.match(html,/표시 한도에 도달/);
 assert.doesNotMatch(html,/아직 생성된 마트가 없습니다/);
});
