/* Entry and routing for knowledge scenarios and server-backed data work. */
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
 // Scenario buttons update history directly, and same-route links emit no hashchange.
 $('aside').addEventListener('click',event=>{
  if(!menuOpen||!event.target.closest('a[href^="#"],button[data-scenario]'))return;
  menu(false);root.queueMicrotask(focusPage);
 });
 function home(){document.querySelector('#page').innerHTML=`<section class="intro-hero"><div class="eyebrow">KNOW:HOW</div><h1>매번 사람을 찾아 묻던 업무,<br>이제 팀의 지식으로 해결하세요.</h1><p class="intro-lead">흩어진 업무 문서와 담당자의 답변을 모아,<br>필요한 기준을 출처와 함께 찾고 다음 사람도 다시 사용할 수 있게 합니다.</p><div class="actions"><a class="button primary" href="#scenario-1">충전 업무 사례로 시작하기 →</a><a class="button" href="#general-1">다른 회사 활용 보기</a></div><p class="muted">같은 매출인데 왜 금액이 다를까요? 계정 3개는 고객 3명일까요? 범용 사례에서는 보고 목적에 맞는 정의와 환불 예외를 확인하고, 근거를 남겨 다음 담당자가 같은 판단에 재사용합니다.</p></section><section class="intro-section"><span class="eyebrow">01 · 어떤 문제인가요?</span><h2>답을 알아도, 다음 사람이 다시 찾습니다.</h2><div class="triple"><article class="card"><h3>같은 말, 다른 번호</h3><p>같은 ‘충전기 ID’인데 부서마다 다른 번호를 씁니다.</p></article><article class="card"><h3>문서는 있는데, 기준은 불명확</h3><p>지금 쓰는 기준인지, 누구에게 확인할지 알기 어렵습니다.</p></article><article class="card"><h3>답은 개인 대화에 남음</h3><p>한 사람이 확인한 내용을 다음 사람이 다시 묻습니다.</p></article></div></section><section class="intro-section"><span class="eyebrow">02 · 어떻게 해결하나요?</span><h2>확인한 내용과 근거를 함께 남깁니다.</h2><ol class="intro-steps"><li><strong>기록을 모읍니다</strong><p>흩어진 문서와 답변을 모읍니다.</p></li><li><strong>근거를 찾습니다</strong><p>업무에 맞는 내용과 출처를 확인합니다.</p></li><li><strong>담당자가 확인합니다</strong><p>바뀐 기준은 이유와 새 버전을 남깁니다.</p></li><li><strong>다음 사람이 씁니다</strong><p>확인된 지식을 부서와 회사가 재사용합니다.</p></li></ol></section><section class="intro-section"><span class="eyebrow">03 · 무엇을 해볼 수 있나요?</span><div class="grid"><article class="card path-card"><h2>업무 질문하기</h2><p>충전 업무 예시 질문으로 정정된 기준의 재사용을 체험합니다. 직접 질문하는 공유 지식 기능도 이어서 열 수 있습니다.</p><a class="button" href="#scenario-4">예시 질문으로 재사용 체험 →</a></article><article class="card path-card"><h2>확인한 내용 남기기</h2><p>담당자 답변을 출처와 함께 지식으로 남깁니다.</p><a class="button" href="#scenario-2">답변을 지식으로 저장하기 →</a></article><article class="card path-card"><h2>부서·전사 지식 찾아보기</h2><p>정책, 데이터의 의미, 업무 가이드를 읽습니다.</p><a class="button" href="#scenario-5">지식 모음 열기 →</a></article><article class="card path-card"><h2>데이터 정리하기</h2><p>파일을 모으고 가공해 업무용 집계표를 만듭니다.</p><a class="button" href="#data">자료 가져오기부터 시작 →</a></article></div></section><p class="muted intro-note">가상 자료로 체험합니다. 실제 회사 정보는 입력하지 마세요.</p>`;}
 function focusPage(){root.scrollTo?.(0,0);const h=document.querySelector('#page h1');if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}}
 function navigation(mode){
  $('#platform-navigation').innerHTML=`<a href="#home" ${mode==='home'?'aria-current="page"':''}><span class="navigation-icon" aria-hidden="true">⌂</span>시작하기</a><a href="#scenario-1" ${['company','general'].includes(mode)?'aria-current="page"':''}><span class="navigation-icon" aria-hidden="true">▤</span>지식 플랫폼</a><a href="#data" ${mode==='data'?'aria-current="page"':''}><span class="navigation-icon" aria-hidden="true">▦</span>데이터 플랫폼</a>`;
  const cases=$('#knowledge-cases');cases.hidden=!['company','general'].includes(mode);
  cases.innerHTML=`<a href="#scenario-1" ${mode==='company'?'aria-current="page"':''}>충전 업무</a><a href="#general-1" ${mode==='general'?'aria-current="page"':''}>매출·고객·환불</a>`;
  $('#current-location').textContent={home:'시작하기',company:'지식 플랫폼 / 충전 업무',general:'지식 플랫폼 / 매출·고객·환불',data:'데이터 플랫폼'}[mode];
 }
 function render(){const hash=location.hash,mode=hash.startsWith('#data')?'data':hash.startsWith('#general-')?'general':hash.startsWith('#scenario-')?'company':'home';
  menu(false);if(current==='general')general?.destroy();if(current==='data')data?.destroy();if(mode!=='company')sampleDemo.deactivate();current=mode;
  document.body.dataset.platform=mode;document.querySelector('#message').textContent='';document.querySelector('#connection').hidden=mode==='home'||mode==='data';document.querySelector('aside').hidden=false;document.querySelector('.workspace-info').hidden=mode==='home'||mode==='data';document.querySelector('.brand').href='#home';
  navigation(mode);
  if(mode==='home'){document.querySelector('aside nav').innerHTML='';document.querySelector('.workspace').innerHTML='';document.querySelector('.aside-note').textContent='찾은 근거가 다음 사람의 답이 됩니다.';home();focusPage();return}
  if(mode==='company'){sampleDemo.activate();focusPage();return}
  if(mode==='general'){const tab=Math.max(1,Math.min(5,Number(hash.slice(9))||1));document.querySelector('#connection').textContent='매출·고객 집계 기준과 환불 예외의 가상 사례입니다. 먼저 이 기기에 임시 저장하고, 공유할 초안을 등록한 뒤 담당자 확인을 거칩니다.';document.querySelector('.workspace').innerHTML='GENERAL KNOWLEDGE<strong>범용 기업 활용</strong>';document.querySelector('.aside-note').innerHTML='왜 다른가 → 기준 확인 → 예외 보완 → 다시 쓰기';const nav=document.querySelector('aside nav');nav.onclick=null;nav.innerHTML=titles.map((t,i)=>`<a class="scenario-link ${tab===i+1?'active':''}" href="#general-${i+1}" ${tab===i+1?'aria-current="page"':''}><span>0${i+1}</span>${t}</a>`).join('');general?.mount(document.querySelector('#page'),tab);focusPage();return}
  document.querySelector('.workspace').innerHTML='DATA PLATFORM<strong>데이터 정리하기</strong>';document.querySelector('.aside-note').textContent='자료 가져오기 → 정리하기 → 집계표 보기';const nav=document.querySelector('aside nav');nav.onclick=null;nav.innerHTML=[['#data','1. 자료 가져오기'],['#data-datasets','2. 규칙으로 정리하기'],['#data-mart','3. 업무용 집계표 보기']].map(([href,label])=>`<a class="scenario-link ${hash===href?'active':''}" href="${href}" ${hash===href?'aria-current="page"':''}>${label}</a>`).join('');if(!data)data=root.KnowHowDataPlatform?.createController();if(data)data.mount(document.querySelector('#page'),{section:hash==='#data-mart'?'mart':hash==='#data-datasets'?'datasets':'jobs'});else document.querySelector('#page').innerHTML='<h1>데이터를 업무에 맞게 정리하기</h1><p>입수·가공·마트 기능을 연결하고 있습니다.</p>';focusPage();const anchor=document.querySelector(hash==='#data-mart'?'#data-mart':hash==='#data-datasets'?'#data-transform':'#data-ingest');if(anchor&&hash!=='#data')anchor.closest('details')?.scrollIntoView({block:'start'});
 }
 root.addEventListener('hashchange',render);render();
})(window);
