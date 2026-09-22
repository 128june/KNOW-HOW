/* One workspace navigation; task results own the main viewport. */
(function(root){'use strict';
 const titles=['왜 부서마다 답이 다를까?','기준을 지식으로 남기기','조건과 예외 보완하기','다음 업무에 재사용하기','팀에서 함께 쓸 지식'];
 const general=root.KnowHowGeneralKnowledge?.createController();
 const $=selector=>document.querySelector(selector);
 let data=null,current='',menuOpen=false,desktopCollapsed=false;
 const mobile=root.matchMedia?.('(max-width: 760px)');
 const toggle=$('#navigation-toggle'),sidebar=$('#workspace-navigation');
 function syncNavigation(restoreFocus=false){
  const isMobile=Boolean(mobile?.matches),expanded=isMobile?menuOpen:!desktopCollapsed;
  // Move focus before hiding the drawer; resizing must not strand it in inert content.
  $('#main-content').inert=isMobile&&menuOpen;
  if(restoreFocus||(!expanded&&sidebar.contains(document.activeElement)))toggle.focus({preventScroll:true});
  sidebar.inert=!expanded;
  document.body.classList.toggle('navigation-open',isMobile&&menuOpen);
  document.body.classList.toggle('navigation-collapsed',!isMobile&&desktopCollapsed);
  const label=isMobile?(expanded?'작업 메뉴 닫기':'작업 메뉴 열기'):(expanded?'작업 메뉴 접기':'작업 메뉴 펼치기');
  toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',label);toggle.title=label;
  $('#navigation-scrim').hidden=!(isMobile&&menuOpen);
 }
 // Route changes close only the mobile drawer, keeping the desktop choice intact.
 function menu(open,restoreFocus=false){
  menuOpen=Boolean(open&&mobile?.matches);syncNavigation(restoreFocus);
  if(menuOpen)sidebar.querySelector('a[href]')?.focus({preventScroll:true});
 }
 toggle.onclick=()=>{
  if(mobile?.matches)menu(!menuOpen,true);
  else{desktopCollapsed=!desktopCollapsed;syncNavigation(true)}
 };
 $('#navigation-scrim').onclick=()=>menu(false,true);
 $('.skip-link').onclick=event=>{event.preventDefault();menu(false);$('#page').focus()};
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented)return;
  if(!mobile?.matches){
   if(event.key==='Escape'&&!desktopCollapsed&&(sidebar.contains(document.activeElement)||document.activeElement===toggle)){
    event.preventDefault();desktopCollapsed=true;syncNavigation(true);
   }
   return;
  }
  if(!menuOpen)return;
  if(event.key==='Escape'){event.preventDefault();menu(false,true);return}
  if(event.key!=='Tab')return;
  const controls=[toggle,...sidebar.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),summary,select:not([disabled]),[tabindex="0"]')].filter(node=>node.getClientRects().length&&!node.closest('[inert]')&&getComputedStyle(node).visibility!=='hidden');
  const index=controls.indexOf(document.activeElement);
  const next=index<0?(event.shiftKey?controls.length-1:0):(index+(event.shiftKey?-1:1)+controls.length)%controls.length;
  // Tab may need to scroll a short drawer to reveal its next control.
  event.preventDefault();controls[next]?.focus({preventScroll:next===0});
 });
 mobile?.addEventListener('change',()=>menu(false));
 // Scenario buttons update history directly, and same-route links emit no hashchange.
 sidebar.addEventListener('click',event=>{
  if(!menuOpen||!event.target.closest('a[href^="#"],button[data-scenario]'))return;
  menu(false);root.queueMicrotask(focusPage);
 });
 function home(){
  const paused=root.KNOWHOW_CONFIG?.aiRequestsPaused!==false;
  $('#page').innerHTML=`<section class="home-intro"><div class="eyebrow">같은 업무를 다시 묻지 않도록</div><h1>확인한 업무 답을,<br>함께 쓰는 기준으로.</h1><p class="home-lead">부서 문서와 사람의 확인 내용을 연결해,<br> 다음 사람이 근거를 보고 판단할 수 있게 합니다.</p><div class="home-result"><span>남는 업무 기록 · 구성 예시</span><p><strong>업무 답 · 원문 근거 · 적용 조건 · 검토 기록</strong></p><small>실제 기준은 문서를 열어 확인합니다.</small></div><div class="home-start"><a class="button primary" href="#scenario-4">충전 업무 근거 찾기 <span aria-hidden="true">→</span></a><span class="home-entry-note">부서 문서를 열어 근거 확인</span></div><p class="home-ai-status">${paused?'AI 답변 생성 중지 · 원문 근거 조회 가능':'원문 근거부터 조회 · AI 답변은 요청할 때 생성'}<small>문서의 현재 버전 검토 완료 후 조회할 수 있습니다.</small></p></section><section class="home-path" aria-label="목적별 시작하기"><article><span>01 · 다른 업무의 기준</span><h2><a class="home-secondary" href="#general-4">매출·고객·환불 근거 찾기 →</a></h2><p>준비된 업무 예시의 근거와 적용 조건을 살펴봅니다.</p></article><article><span>02 · 모아둔 지식</span><h2><a class="home-secondary" href="#scenario-5">부서 지식 모음 보기 →</a></h2><p>문서를 찾아 버전과 검토 상태를 확인합니다.</p></article><article><span>03 · 지식의 전체 구조</span><h2><a class="home-secondary" href="#data">KB 리니지 보기 →</a></h2><p>업무별 KB의 연결 구조를 보고 각 문서의 내용을 확인합니다.</p></article></section>`;
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
  $('.workspace').innerHTML='지식 구조';$('.aside-note').textContent='KB 전체 구조 → 문서 내용 확인';
  nav.innerHTML='<a class="scenario-link active" href="#data" aria-current="page"><span>01</span>KB 리니지</a>';
  if(!data&&root.KnowHowKBLineage&&root.KnowHowKBCatalog)data=root.KnowHowKBLineage.createController({provider:root.KnowHowKBCatalog.createProvider({general})});
  if(data)data.mount($('#page'));else $('#page').innerHTML='<h1>KB 리니지</h1><p role="alert">KB 화면을 불러오지 못했습니다. 새로고침해 주세요.</p>';
  focusPage();
 }
 root.addEventListener('hashchange',render);render();
})(window);
