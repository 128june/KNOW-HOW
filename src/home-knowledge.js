/* Home explains the knowledge model; rendering never queries or mutates a workspace. */
(function(root){'use strict';
 function render(){return `
 <div class="kh-home">
  <section class="kh-home-intro" aria-labelledby="kh-home-title">
   <p class="kh-home-kicker">조직의 정보가 서로 통하는 곳</p>
   <h1 id="kh-home-title">조직마다 다른 말과 기준을,<br>함께 쓰는 지식으로 연결합니다.</h1>
   <p class="kh-home-lead">엑셀·노션·메신저·개인 메모에서 찾은 정보, 다른 부서에서도 같은 뜻일까요?<br> 이름과 의미의 차이를 보존하고 <strong>출처·적용 조건·확인 담당자</strong>를 연결해 공통 지식 기반(KB)으로 남깁니다.</p>
   <p class="kh-home-loop">AI는 근거로 답하고, 담당자는 확인·정정해 다음 업무에 남깁니다.</p>
   <div class="kh-home-actions"><a class="button primary" href="#data">연결된 KB와 원문 살펴보기 <span aria-hidden="true">→</span></a></div>
  </section>

  <section class="kh-home-example" aria-labelledby="kh-home-example-title">
   <div class="kh-home-section-head"><div><p class="kh-home-kicker">연결의 예 · 충전 업무</p><h2 id="kh-home-example-title">같은 ‘충전기 ID’,<br class="kh-home-mobile-break"> 부서마다 찾는 기준이 다릅니다.</h2></div><span class="kh-home-source-note">공개 장비 원문 + 시연용 부서 기준</span></div>
   <div class="kh-home-example-grid">
    <div class="kh-home-connection">
     <h3><span class="kh-home-step">01</span> 부서별 의미와 관계를 연결</h3>
     <dl class="kh-home-meanings">
      <div><dt>공개 정보 <strong>충전기 ID ‘01’</strong></dt><dd>충전소 안에서 장비를 구분</dd></div>
      <div><dt>앱개발팀 <strong>앱 충전기 ID</strong></dt><dd>앱의 요청·오류를 조회</dd></div>
      <div><dt>충전기개발팀 <strong>장비 ID</strong></dt><dd>장비·통신 로그를 조회</dd></div>
     </dl>
     <div class="kh-home-kb">
      <span class="kh-home-join" aria-hidden="true">↓</span><strong>GS타워 · GS차지비 · 공개 ID 01</strong>
      <p>서울 강남구 논현로 508의 원본 행을 함께 대조하고, 부서별 ID 대응 관계와 확인할 내용을 KB로 남깁니다.</p>
      <ul aria-label="지식에 함께 남기는 맥락"><li>원문 출처</li><li>대상·부서</li><li>적용 기간</li><li>담당자·확인 상태</li><li>버전</li></ul>
     </div>
     <a class="kh-home-link" href="#scenario-1" aria-describedby="kh-home-id-note">준비된 ID 대조·초안 작성 체험 <span aria-hidden="true">→</span></a>
     <p class="kh-home-answer-note" id="kh-home-id-note">연결된 부서 문서가 없으면 확인할 내용을 초안으로 남기는 체험입니다.</p>
    </div>
    <div class="kh-home-answer">
     <h3><span class="kh-home-step">02</span> 연결된 KB를 AI가 답변의 근거로</h3>
     <p class="kh-home-answer-intro">질문의 대상·부서·적용 시점에 맞는 근거를 읽고, 답과 함께 확인할 내용을 보여줍니다.</p>
     <div class="kh-home-answer-preview">
      <span class="kh-home-preview-label">결과를 읽는 방법 · 예시</span>
      <p class="kh-home-question">“이 충전기의 앱 오류는 어떤 정보로 문의하나요?”</p>
      <p class="kh-home-conclusion">공개 ID ‘01’과 장소·운영사를 전달하고,<br>앱개발팀의 식별자와 대응하는지 확인합니다.</p>
      <dl class="kh-home-evidence">
       <div><dt>근거</dt><dd>공개 장비 원문 · 부서 ID 설명 · 문의 기준</dd></div>
       <div><dt>확인 필요</dt><dd>실제 내부 ID의 대응 관계와 현재 적용 여부</dd></div>
       <div><dt>다음 확인</dt><dd>앱개발팀에 오류 화면과 발생 맥락 전달</dd></div>
      </dl>
     </div>
     <p class="kh-home-answer-note">근거가 없거나 서로 다르면 미확인·상충으로 구분하고, 담당자의 검토로 이어갑니다.</p>
    </div>
   </div>
  </section>

  <section class="kh-home-review" aria-labelledby="kh-home-review-title">
   <div class="kh-home-section-head"><div><p class="kh-home-kicker">확인한 내용을 조직의 지식으로</p><h2 id="kh-home-review-title">한 사람의 확인이, 다음 부서의 출발점이 됩니다.</h2></div><a class="kh-home-link" href="#general-3">환불 기준 확인·정정 체험 <span aria-hidden="true">→</span></a></div>
   <ol class="kh-home-review-flow">
    <li><span>01 · 사용자 댓글</span><strong>빠진 조건을 묻고</strong><p>“이 기준은 어떤 상황까지 적용하나요?”</p></li>
    <li><span>02 · 담당자 검토</span><strong>근거와 조건을 보완</strong><p>확인 결과·예외·정정 이유를 기록합니다.</p></li>
    <li><span>03 · 버전과 공유</span><strong>변경과 승인 상태를 확인</strong><p>이력을 남기고 공유할 버전을 구분합니다.</p></li>
    <li><span>04 · 다음 업무</span><strong>확인된 기준을 다시 활용</strong><p>새로운 질문에서도 적용 조건과 함께 읽습니다.</p></li>
   </ol>
  </section>

  <section class="kh-home-apply" aria-labelledby="kh-home-apply-title">
   <div class="kh-home-section-head"><div><p class="kh-home-kicker">다른 업무에도 같은 연결 방식</p><h2 id="kh-home-apply-title">부서 사이에서 막혔던 업무로 시작하세요.</h2></div></div>
   <div class="kh-home-entries">
    <article><span class="kh-home-entry-label">대표 적용 사례 · 충전 업무</span><h3>정보 확인에서 부서 간 회신까지</h3><p>상담사·앱개발팀·충전기개발팀이 각자의 KB로 확인하고 같은 티켓에 답합니다.</p><div class="kh-home-entry-links"><a class="kh-home-link" href="#support">민원 업무 체험 <span aria-hidden="true">→</span></a><a class="kh-home-link" href="#support-kb">부서별 업무 KB</a></div></article>
    <article><span class="kh-home-entry-label">확장 사례 · 매출·고객·환불</span><h3>같은 숫자와 용어, 다른 판단 기준</h3><p>매출의 수주·결제·제공 실적·입금, 고객의 계정·계약 법인·청구처, 환불의 요청·결제사 완료·정산 차감을 같은 가상 계약 사례로 연결합니다.</p><div class="kh-home-entry-links"><a class="kh-home-link" href="#general-1">업무 기준 비교하기 <span aria-hidden="true">→</span></a></div></article>
   </div>
  </section>
 </div>`;}
 root.KnowHowHome={render};
})(window);
