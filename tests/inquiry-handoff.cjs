const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const fixture=require('./fixtures/inquiry-actual-response.json');
const clone=x=>JSON.parse(JSON.stringify(x));
let network=0,copied='';
const ctx=vm.createContext({window:{navigator:{clipboard:{writeText:async text=>{copied=text}}}},TextEncoder,AbortSignal,fetch(){network++;throw Error('No network allowed')}});
vm.runInContext(fs.readFileSync('src/organization-kb.js','utf8').replace('return {askDocument,','return {inquiryHandoff,responseMarkup,askDocument,'),ctx);
const c=ctx.window.KnowHowOrganizationUI.createController({allowInquiry:true});
const h=c.inquiryHandoff(fixture);
assert.equal(h.valid,true);
// Supplied incident details must never acquire a claim that those values are absent.
const provided=clone(fixture);provided.answer+=' 오류 발생 시각: 2026-09-22 09:10 / 오류 코드: E42';
provided.ai.answer=provided.answer;
const providedHandoff=c.inquiryHandoff(provided);
assert.equal(providedHandoff.valid,true);
assert.ok(providedHandoff.text.startsWith(provided.answer+'\n\n'));
assert.deepEqual(providedHandoff.fields,h.fields);
assert.deepEqual(providedHandoff.technical,h.technical);
assert.ok(!providedHandoff.text.includes('값이 없'));
assert.ok(!providedHandoff.text.includes('첨부되지 않았'));
assert.ok(providedHandoff.text.includes('이 복사 기능은 파일을 첨부하지 않습니다.'));

assert.ok(h.text.startsWith(fixture.answer+'\n\n'),'AI answer remains byte-for-byte unchanged');
for(const v of ['GS타워','공공 충전기 ID: 01','DEMO-APP-d9c51dac6e274c75','서울특별시 강남구 논현로 508','GS차지비','part-000001.sqlite:20183','https://ev.or.kr/nportal/monitor/evMapExcel.do','v2','app_development_chargers','app_charger_id','오류가 있다면 오류 화면·발생 시각·오류 코드를 확인해 함께 전달하세요.','이 복사 기능은 파일을 첨부하지 않습니다.'])assert.ok(h.text.includes(v),v);
assert.ok(c.responseMarkup(fixture,'inquiry',true).includes('data-copy-inquiry'));
assert.ok(!c.responseMarkup(fixture,'knowledge',true).includes('data-copy-inquiry'));
assert.ok(!c.responseMarkup({...fixture,ai_generated:false},'inquiry',true).includes('data-copy-inquiry'));
for(const mutate of [x=>x.document_id='other',x=>x.ai.evidence[0].version=3,x=>x.evidence[0].department='device',x=>x.evidence[0].org='beta',x=>x.ai.evidence.push(clone(x.ai.evidence[0])),x=>x.evidence.push(clone(x.evidence[0])),x=>x.evidence[0].source.station.address='unrelated address',x=>delete x.ai.evidence]){
 const x=clone(fixture);mutate(x);const r=c.inquiryHandoff(x);assert.equal(r.valid,false);assert.equal(r.fields.length,0);assert.ok(!r.text.includes('주소: 서울특별시'));assert.ok(r.text.includes('확인 필요'));
}
const unrelated=clone(fixture);unrelated.evidence.unshift({...clone(fixture.evidence[0]),id:'other',source:{station:{address:'WRONG'}}});assert.equal(c.inquiryHandoff(unrelated).valid,true);assert.ok(!c.inquiryHandoff(unrelated).text.includes('WRONG'));
for(const edit of [s=>delete s.station.address,s=>delete s.station.operator,s=>delete s.public_source.source_url,s=>s.mapping_reference.value='wrong',s=>s.mapping_reference.source_record_key='other-row',s=>s.mapping_reference.department='device']){
 const x=clone(fixture);edit(x.ai.evidence[0].source);x.evidence[0].source=clone(x.ai.evidence[0].source);const r=c.inquiryHandoff(x);assert.ok(r.text.includes('확인 필요'));assert.ok(!r.text.includes('wrong'));assert.ok(!r.text.includes('other-row'));
}
const unsafe=clone(fixture);unsafe.ai.evidence[0].source.station.name='<img src=x onerror=alert(1)>';unsafe.evidence[0].source=clone(unsafe.ai.evidence[0].source);const html=c.responseMarkup(unsafe,'inquiry',true);assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
let handler,selected=false;const status={textContent:''},fallback={open:false},field={value:h.text,focus(){},select(){selected=true}};
const panel={querySelector:s=>s==='textarea'?field:s==='[data-copy-status]'?status:fallback};
const button={closest:()=>panel,set onclick(fn){handler=fn}};
const host={innerHTML:'',querySelector:()=>null,querySelectorAll:s=>s==='[data-copy-inquiry]'?[button]:[]};
c.mount(host,{mode:'library'});
(async()=>{await handler();assert.equal(copied,h.text);assert.ok(status.textContent.includes('복사했습니다'));ctx.window.navigator.clipboard.writeText=async()=>{throw Error('denied')};await handler();assert.equal(fallback.open,true);assert.equal(selected,true);assert.ok(status.textContent.includes('직접 복사'));assert.equal(network,0);console.log('PASS: preserved actual response, exact doc/version/source matching, no cross-document/department mixing, missing fields, mapping mismatch, escaping, copy success/fallback; network/model/embedding calls 0')})().catch(e=>{console.error(e);process.exitCode=1});
