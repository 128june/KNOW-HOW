/* One workspace navigation; task results own the main viewport. */
(function(root){'use strict';
 const titles=['왜 부서마다 답이 다를까?','기준을 지식으로 남기기','조건과 예외 보완하기','다음 업무에 재사용하기','팀에서 함께 쓸 지식'];
 const general=root.KnowHowGeneralKnowledge?.createController();
 const $=selector=>document.querySelector(selector);
 let data=null,current='',menuOpen=false;
 const mobile=root.matchMedia?.('(max-width: 760px)');
 function menu(open,restoreFocus=false){
  menuOpen=Boolean(open&&mobile?.matches);document.body.classList.toggle('navigation-open',menuOpen);
  $('#navigation-toggle').setAttribute('aria-expanded',String(menuOpen));$('#navigation-toggle').setAttribute('aria-label',menuOpen?'메뉴 닫기':'메뉴 열기');
  $('#navigation-scrim').hidden=!menuOpen;$('#main-content').inert=menuOpen;
  if(menuOpen)$('aside a')?.focus();else if(restoreFocus)$('#navigation-toggle').focus();
 }
 $('#navigation-toggle').onclick=()=>menu(!menuOpen,true);
 $('#navigation-scrim').onclick=()=>menu(false,true);
 $('.skip-link').onclick=event=>{event.preventDefault();menu(false);$('#page').focus()};
 document.addEventListener('keydown',event=>{
  if(!menuOpen)return;
  if(event.key==='Escape'){event.preventDefault();menu(false,true);return}
  if(event.key!=='Tab')return;
  const controls=[$('#navigation-toggle'),...$('aside').querySelectorAll('a[href],button:not([disabled]),summary,select')].filter(node=>node.getClientRects().length);
  const index=controls.indexOf(document.activeElement),next=(index+(event.shiftKey?-1:1)+controls.length)%controls.length;
  event.preventDefault();controls[next]?.focus();
 });
 mobile?.addEventListener('change',()=>menu(false));
 function home(){
  $('#page').innerHTML=`<section class="home-intro"><div class="eyebrow">한 번 확인한 답, 함께 쓰는 지식</div><h1>부서마다 다른 정보를 연결해,<br>함께 쓰는 기준으로.</h1><p class="home-lead">같은 ‘충전기 ID’인데 부서마다 다른 번호를 쓰나요?<br>문서와 데이터의 관계를 확인하고, AI가 참고할 근거와 담당자의 판단을 함께 남깁니다.</p><div class="home-start"><a class="button primary" href="#scenario-1">충전 업무에서 직접 확인하기 <span aria-hidden="true">→</span></a><a class="home-secondary" href="#general-1">매출·고객·환불 업무로 보기</a></div></section><section class="home-path" aria-label="KNOW:HOW 사용 흐름"><article><span>01 · 연결</span><h2>어떤 근거로 연결됐나요?</h2><p>부서의 ID·정책·문서를 출처와 관계로 묶습니다.</p></article><article><span>02 · AI 활용과 검토</span><h2>어떤 지식을 참고했나요?</h2><p>질문에 쓰인 문서와 추가 확인할 내용을 살펴봅니다.</p></article><article><span>03 · 한눈에 확인</span><h2>지금 쓸 기준은 무엇인가요?</h2><p>연결된 정보, 적용 조건과 확인 상태를 함께 봅니다.</p></article><article><span>04 · 관리</span><h2>기준이 바뀌면 어떻게 되나요?</h2><p>댓글·담당자 확인·새 버전을 다음 업무에 반영합니다.</p></article></section><section class="home-data"><div><div class="eyebrow">데이터 플랫폼</div><h2>근거가 되는 자료도 직접 가져옵니다.</h2><p>웹 표와 엑셀을 가져와 저장하고, 어떤 정책으로 처리했는지 확인합니다.</p></div><a class="button" href="#data">실제 자료 가져오기 <span aria-hidden="true">↗</span></a></section>`;
 }
 function focusPage(){root.scrollTo?.(0,0);const h=$('#page h1');if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}}
 function navigation(mode){
  $('#platform-navigation').innerHTML=`<a href="#home" ${mode==='home'?'aria-current="page"':''}><span class="navigation-icon" aria-hidden="true">⌂</span>시작하기</a><a href="#scenario-1" ${['company','general'].includes(mode)?'aria-current="page"':''}><span class="navigation-icon" aria-hidden="true">▤</span>지식 플랫폼</a><a href="#data" ${mode==='data'?'aria-current="page"':''}><span class="navigation-icon" aria-hidden="true">▦</span>데이터 플랫폼</a>`;
  const cases=$('#knowledge-cases');cases.hidden=!['company','general'].includes(mode);
  cases.innerHTML=`<a href="#scenario-1" ${mode==='company'?'aria-current="page"':''}>충전 업무</a><a href="#general-1" ${mode==='general'?'aria-current="page"':''}>매출·고객·환불</a>`;
  $('#current-location').textContent={home:'시작하기',company:'지식 플랫폼 / 충전 업무',general:'지식 플랫폼 / 매출·고객·환불',data:'데이터 플랫폼'}[mode];
 }
 function render(){
  const hash=location.hash,mode=hash.startsWith('#data')?'data':hash.startsWith('#general-')?'general':hash.startsWith('#scenario-')?'company':'home';
  menu(false);if(current==='general')general?.destroy();if(current==='data')data?.destroy();if(mode!=='company')sampleDemo.deactivate();current=mode;
  document.body.dataset.platform=mode;$('#message').textContent='';$('aside').hidden=false;$('#connection').hidden=false;$('.brand').href='#home';navigation(mode);
  const nav=$('aside nav');nav.hidden=false;nav.onclick=null;
  $('.workspace-info').hidden=mode==='home'||mode==='data';
  if(mode==='home'){nav.innerHTML='';$('.workspace').innerHTML='';$('.aside-note').textContent='찾은 근거가 다음 사람의 답이 됩니다.';home();focusPage();return}
  if(mode==='company'){sampleDemo.activate();$('.brand').href='#home';focusPage();return}
  if(mode==='general'){
   const tab=Math.max(1,Math.min(5,Number(hash.slice(9))||1));$('#connection').textContent='매출·고객 집계 기준과 환불 예외를 다루는 데모 작업공간입니다. 이 기기의 임시 기록과 담당자 확인을 마친 공유 지식을 구분합니다.';
   $('.workspace').innerHTML='업무 흐름';$('.aside-note').textContent='근거 확인 → 예외 보완 → 다음 업무에 재사용';
   nav.innerHTML=titles.map((t,i)=>`<a class="scenario-link ${tab===i+1?'active':''}" href="#general-${i+1}" ${tab===i+1?'aria-current="page"':''}><span>0${i+1}</span>${t}</a>`).join('');general?.mount($('#page'),tab);focusPage();return;
  }
  const section=['#data-privacy','#data-datasets'].includes(hash)?'privacy':['#data-policies','#data-mart'].includes(hash)?'policies':'jobs';
  $('.workspace').innerHTML='작업 흐름';$('.aside-note').textContent='가져온 자료와 적용한 정책을 함께 확인합니다.';
  nav.innerHTML=[['#data','자료 가져오기','jobs'],['#data-privacy','민감정보 처리','privacy'],['#data-policies','적용 정책과 결과','policies']].map(([href,label,key],i)=>`<a class="scenario-link ${section===key?'active':''}" href="${href}" ${section===key?'aria-current="page"':''}><span>0${i+1}</span>${label}</a>`).join('');
  if(!data)data=root.KnowHowDataPlatform?.createController();
  if(data)data.mount($('#page'),{section});else $('#page').innerHTML='<h1>자료 가져오기</h1><p role="alert">데이터 화면을 불러오지 못했습니다. 새로고침해 주세요.</p>';
  focusPage();
 }
 root.addEventListener('hashchange',render);render();
})(window);
