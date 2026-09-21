// Offline preview of the production company answer renderer using a preserved response.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tests/company-live.cjs','utf8').split('(async()=>{')[0].replace('request,render};','request,render,answerMarkup};');
const {setup}=new Function('require',harness+'\nreturn {setup};')(require);
const {c,api}=setup();let calls=0;c.fetch=()=>{calls++;throw Error('Offline preview only')};
vm.runInContext(fs.readFileSync('src/organization-kb.js','utf8'),c);
const response=require('./fixtures/inquiry-actual-response.json');
api.state.answer=response;api.state.answerQuestion=response.history[0].question;api.state.answerMode='inquiry';
const markup=api.answerMarkup();assert(markup.includes('inquiry-handoff'));assert(markup.includes('서울특별시 강남구 논현로 508'));
const out=process.argv[2]||'/tmp/knowhow-inquiry-handoff-preview';fs.mkdirSync(out,{recursive:true});
for(const name of ['style.css','shell.css','organization-kb.js'])fs.copyFileSync('src/'+name,path.join(out,name));
let html=fs.readFileSync('src/index.html','utf8').replace(/<script\b[\s\S]*?<\/script>/g,'').replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="connect-src \'none\'">').replace('<link rel="stylesheet" href="./data-platform.css">','');
html=html.replace('<section id="page" tabindex="-1"></section>',`<section id="page" tabindex="-1" class="company-workflow"><p class="notice">로컬 검증 · 보존된 실제 응답 재생 · 새 AI/API 호출 없음</p>${markup}<label>로컬 복사 검증<textarea id="copy-check" aria-label="로컬 복사 검증" rows="3"></textarea></label></section>`).replace('<div id="platform-navigation" class="platform-navigation" aria-label="플랫폼 선택"></div>','<div id="platform-navigation" class="platform-navigation" aria-label="플랫폼 선택"><a href="#home">시작하기</a><a href="#scenario-4" aria-current="page">지식 플랫폼</a><a href="#data">데이터 플랫폼</a></div>').replace('</body>','<script src="organization-kb.js"></script><script>window.KnowHowOrganizationUI.bindInquiryCopy(document);</script></body>');
fs.writeFileSync(path.join(out,'index.html'),html);fs.writeFileSync(path.join(out,'expected-copy.txt'),c.window.KnowHowOrganizationUI.inquiryHandoff(response).text);
assert.equal(calls,0);console.log('PASS: actual company renderer includes handoff; offline preview '+out+'; network/model/embedding 0');
