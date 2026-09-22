/* One workspace navigation; task results own the main viewport. */
(function(root){'use strict';
 const titles=['왜 부서마다 답이 다를까?','기준을 지식으로 남기기','조건과 예외 보완하기','다음 업무에 재사용하기','팀에서 함께 쓸 지식'];
 const general=root.KnowHowGeneralKnowledge?.createController();
 const support=root.KnowHowSupport?.createController();
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
  $('#page').innerHTML=root.KnowHowHome.render();
 }
 function focusPage(){root.scrollTo?.(0,0);const h=$('#page h1');if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}}
 function navigation(mode){
  $('#platform-navigation').innerHTML=`<a href="#home" ${mode==='home'?'aria-current="page"':''}><span class="navigation-icon" aria-hidden="true">⌂</span>시작하기</a><a href="#support" ${['support','company','general'].includes(mode)?'aria-current="page"':''}><span class="navigation-icon" aria-hidden="true">▤</span>지식 플랫폼</a><a href="#data" ${mode==='data'?'aria-current="page"':''}><span class="navigation-icon" aria-hidden="true">▦</span>데이터 플랫폼</a>`;
  const cases=$('#knowledge-cases');cases.hidden=!['support','company','general'].includes(mode);
  cases.innerHTML=`<a href="#support" ${['support','company'].includes(mode)?'aria-current="page"':''}>충전 민원</a><a href="#general-1" ${mode==='general'?'aria-current="page"':''}>매출·고객·환불</a>`;
  $('#current-location').textContent={home:'시작하기',support:'지식 플랫폼 / 충전 민원',company:'지식 플랫폼 / 충전 업무',general:'지식 플랫폼 / 매출·고객·환불',data:'데이터 플랫폼'}[mode];
 }
 function render(){
  const hash=location.hash,mode=hash.startsWith('#support')?'support':hash.startsWith('#data')?'data':hash.startsWith('#general-')?'general':hash.startsWith('#scenario-')?'company':'home';
  menu(false);if(current==='general')general?.destroy();if(current==='data')data?.destroy();if(current==='support')support?.destroy();if(mode!=='company')sampleDemo.deactivate();current=mode;
  document.body.dataset.platform=mode;$('#message').textContent='';$('aside').hidden=false;$('#connection').hidden=false;$('.brand').href='#home';navigation(mode);
  const nav=$('aside nav');nav.hidden=false;nav.onclick=null;
  $('.workspace-info').hidden=mode==='home'||mode==='data';
  if(mode==='home'){nav.innerHTML='';$('.workspace').innerHTML='';$('.aside-note').textContent='찾은 근거가 다음 사람의 답이 됩니다.';home();focusPage();return}
  if(mode==='support'){
   $('#session').hidden=true;$('#connection').textContent='공개 DB 보존 자료와 시연용 부서 KB를 사용합니다. 역할 선택은 실제 직원 인증이 아니며, 티켓은 이 체험 공간에만 저장됩니다. 체험은 8시간 후 만료됩니다.';
   $('.workspace').innerHTML='충전 민원 업무';$('.aside-note').textContent='찾기 → 전달 → 부서별 확인 → 답글';
   nav.innerHTML=[['#support','민원 접수'],['#support-tickets','보낸 티켓·답글'],['#support-app','앱개발팀 받은 티켓'],['#support-device','충전기개발팀 받은 티켓'],['#support-kb','부서별 업무 KB']].map(([href,label],i)=>`<a class="scenario-link ${(hash.split('?')[0]===href||(href==='#support'&&hash==='#support-compose'))?'active':''}" href="${href}"><span>0${i+1}</span>${label}</a>`).join('');
   support?.mount($('#page'));focusPage();return;
  }
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
