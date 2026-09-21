const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
const element = key => {if(!elements.has(key))elements.set(key,{textContent:'',innerHTML:'',classList:{toggle(){}},querySelectorAll:()=>[]});return elements.get(key)};
const context = vm.createContext({console,URL,AbortSignal,setTimeout,window:{KNOWHOW_CONFIG:{}},document:{querySelector:element,querySelectorAll:()=>[]},fetch:null});
vm.runInContext(fs.readFileSync('src/app.js','utf8'),context);
const exec = code=>vm.runInContext(code,context);

const historical={id:9,version:2,line:4,name:'이력 자료',text:'과거 기준',state:'확인',applicability:'history_only',applicability_reasons:['적용 기간 밖'],rule:{context:'고객 안내',valid_from:'2026-01-01',valid_to:'2026-01-31'},reviewer:'담당자',reason:'기간 확인'};
context.sample={evidence:[historical],historical_evidence:[{...historical,location:'다른 표시'}]};
let html=exec('renderEvidence(sample)');
assert.equal((html.match(/data-open=/g)||[]).length,1);
for(const text of ['현재 적용 불가','적용 기간 밖','고객 안내','2026-01-31','담당자'])assert.ok(html.includes(text));
context.sample={evidence:[],historical_evidence:[historical]};
assert.ok(exec('renderEvidence(sample)').includes('이력 자료'));
context.sample={evidence:[{...historical,applicability:'applicable',applicability_reasons:[],text:'<script>bad</script>'}]};
html=exec('renderEvidence(sample)');assert.ok(html.includes('요청 범위에 적용 가능'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('history-evidence'));
console.log('PASS: historical-only generation evidence, deduplication, applicability metadata and escaping');
