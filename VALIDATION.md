# UI 검증 기록 — 2026-09-21

## 현재 후속 검증 · 동시 정정 후 최신 조건 보존

- **수정 전 실제 재현**: v1에서 작성한 정정이 다른 정정 v2와 충돌(409)한 뒤, 새로고침하면 옛 입력이 v2 기준으로 다시 제출되어 다른 정정 조건을 지웠다. 동시 작성자는 격리된 실제 API 호출로 명시적으로 재현했으며 실제 직원의 작업이 아니다.
- **수정**: 정정 입력의 문서ID와 작성 기준 버전을 고정한다. 새로고침·문서 전환 후에도 본문/변경 이유/댓글 선택/기준 버전을 유지하며, 현재 문서와 다르면 저장을 차단한다. 최신 본문 대조 후 명시적으로 이어쓰기를 선택해야 기준 버전이 갱신된다. 이어쓰기는 서버 저장을 하지 않는다.
- **실제 로컬 UI/API 58bd1d6**: v1 입력 → 별도 정정 v2 → 409 → 새로고침 후 저장 차단 → 명시적 이어쓰기 → 두 조건을 함께 작성한 v3 → 사람 검토 v4/별도 완료 → 동일 문서의 v4 원문 조회. 원본 source 불변, 두 정정 조건 유지, 댓글 반영 확인. HTTP 22응답 중 의도한 충돌409 1건/정상200 21건, JS오류0, 모델0, 320px 넘침0.
- 회귀9개 PASS: company-revision-version, company-identity, company-human-review, company-live, company-mapping, company-navigation, company-sharing, company-sharing-transport, demo-isolation. 새 검사는 표준·방문자 경로의 반복 충돌, 문서별 입력 보관, 잘못된 문서 입력 차단, 방문자 출처 불변과 자동 검토/AI 없음도 확인한다. 반복 충돌/방문자 경계는 VM 모의 검사이며 실제 브라우저와 구분한다.
- 독립 검토도 실제 DOM/모의 API에서 두 번 연속 충돌, 이어쓰기 시 저장 없음, 저장 후 새 입력의 버전 재바인딩을 확인했다. 관련3개 회귀는 위9개의 부분집합이다. 새 회귀는 발견하지 못했으며 운영 API·모델을 호출하지 않았다.
- 허브 `01_현재_아이디에이션/evidence/revision-version/`에 수정 전/후 응답, 재현 스크립트와 PC/320px 화면을 보존했다. 이 수정은 자동 병합이나 사람이 대조 내용을 정확히 읽었음을 보장하지 않는다. 사용자에게 충돌을 알리고 의도 없는 기준 버전 변경을 방지한다. 새 회귀 검사 초기 실행의 비활성 harness를 activate하도록 수정했으며 제품 결함과 구분한다.
- 로컬 검증이며 공개 배포·실제 모델 생성 검증은 하지 않았다. 이전 실제 AI 5PASS/3FAIL과 미완료 항목은 유지한다.

## 직전 검증 · 같은 원본의 기존 KB 재사용과 문서 선택

- **실제 결함 재현**: 초기 GS타워/GS차지비/01에서 문서v2와 댓글을 만든 뒤 전체 검색에서 같은01을 고르면 문서를 못 찾았다. 내장/검색 station_key는 다르지만 원본행·17개 필드·dataset/run/SHA·충전소명/주소/운영사가 같았다. 검색 색인 키를 문서 정체성으로 사용하던 문제다.
- **수정**: 같은 원본 지문·행·문자열 공공ID·충전소명/주소/운영사·담당부서로 연결한다. 다른 snapshot·운영사·부서·01/1은 합치지 않는다. 범위/색인 메타와 정정 가능한 내부ID·버전은 고정 식별자로 사용하지 않는다. 기존 source·본문·댓글·문서ID를 변경하지 않는다.
- 조회/저장 전 검사/재진입에 같은 문서 선택 함수를 사용한다. 후보가 하나면 그 문서의 최신 버전을 다시 읽고, 여러 개면 적용 기간·검토 상태·검토 결론·문서ID·전체 본문을 비교해 명시적으로 고른다. 배열의 첫 문서나 가장 큰 버전 번호를 자동 선택하지 않는다. 기존 문서를 임의로 병합·삭제하지 않는다.
- 독립 검토가 문서 전환 중 A의 입력이 B에 남는 문제를 찾아 수정했다. 댓글·검토·정정 입력은 문서ID별 메모리에 보관/복원하며, 중복 발견으로 저장하지 못한 새 초안과 적용 기간도 후보 선택·목록 새로고침 후 유지한다. 실제 브라우저에서 B의 미저장 댓글/정정이 A에 나타나지 않고 B 복귀 시 복원됨을 확인했다. 새 초안 충돌 보존과 humanDraft는 별도 VM 검사다.
- 문서 선택과 최신 새로고침은 응답의 문서ID와 원본 정체성을 함께 검증한다. 잘못된 동일대상 타문서 응답·삭제 응답·늦은 다른 문맥 응답은 거절한다. 잘못된 응답의 방어는 모의 검사이며 정상 API에서 그런 응답이 발생했다고 주장하지 않는다.
- **실제 로컬 브라우저/API58bd1d6**: 초기01의 사람검토v2/댓글 → 전체검색01의 같은v2 → 근거조회/새로고침 → 격리 API로 두 번째 정책을 명시적으로 준비 → 후보2개 표시 → 각 문서 선택/원문비교 → 원래v2 근거조회. 지식HTTP35응답 모두200, source/댓글/v2 유지, JS오류0, 모델0, 320px넘침0. UI가 만든 문서1개+검사용 API 직접 등록1개이며 자동 중복 방지를 서버 원자성 보장으로 설명하지 않는다.
- 관련회귀16개 통과 후 입력격리/ID검사 변경의 영향8개 재통과. 마지막 표시 변경은 identity/human-review 및 실제 브라우저로 확인했다. 횟수를 합산하지 않는다.
- 허브 `01_현재_아이디에이션/evidence/company-identity/`에 수정 전 재현, 단일문서 재사용, 최종 중복선택/입력격리, 화면, 재현코드를 보관했다. 검사 harness의 Fetch status 속성 오용과 새로고침 후 검토자 역할 선택 누락을 수정한 이전 실행도 보존했다. API 응답은 수정하지 않았다.
- 실제520,460행 보존 원문과 합성 부서표·사람 검토 시연이다. 새입수520,973행·실제내부 대응·실제조직 승인·AI 의미 품질·공개배포와 구분한다. 서버AI 준비 전 배포하지 않으며 기존 실AI5PASS/3FAIL은 유지한다.

## 직전 검증 · 선택 충전기의 부서별 연결 근거

로컬 UI와 실제 API `58bd1d6`의 격리 서버18778을 연결했다. 공개 배포와 실제 AI 평가는 진행하지 않았다.

- 기존 화면은 처음 준비한01의 연결만 읽었다. 이제 검색한 대상의 부서 KB를 명시적으로 열 때 기존 workflow/inquiry API에서 해당 행의 연결표를 조회한다. 부서·충전소·행·공공 ID·원문 필드/출처 지문을 대조하고, 부서별 ID·테이블·필드·연결 기준을 한 구조로 정리해 표시/본문/저장에 재사용한다. 초기 보존 예시01은 기존 원본을 보존한다.
- 실제 GS타워/GS차지비/02에서 앱은 `app_development_chargers.app_charger_id` → `DEMO-APP-80fc20c9c26c64aa`, 장비는 `device_development_chargers.device_charger_id` → `DEMO-DEVICE-80fc20c9c26c64aa`였다. 두 문서는 별도 ID로 저장됐다. 같은 주소/공공02의 GS칼텍스는 연결표가 없으며 임의 ID를 쓰지 않는다.
- 장비 문서v1→사람 검토v2→댓글 반영v3→원문 조회→전사 승인→앱 부서가 같은v3을 조회할 때 테이블·필드·부서 ID·원본 행과 출처가 유지됐다. 실제 source는1,879/4,000 UTF-8바이트이며 댓글/사람 검토로 변경되지 않았다. 새로고침에서도 같은 선택과 문서를 유지했다.
- 기존 KB를 열 때 새 매핑으로 본문이나 출처를 덮어쓰지 않는다. 사람이 부서 ID를 정정하면 현재 source의 이전 mapping_reference를 제거하고 이전 버전에는 보존한다. 조회 실패와 연결표 없음은 구분하며, 실제 조회 실패를 내장 예시로 대체하지 않는다. 늦은 응답·JSON 실패도 변경된 선택에 반영하지 않는다.
- 독립 검토에서 KB 모음→문서 탭으로 이동하면 연결 조회 전에 초안을 만들 수 있던 경로를 발견해 수정했다. 카탈로그 조회만으로 초안을 만들 수 없고 선택 대상 KB/연결 조회를 먼저 거쳐야 한다.
- 관련 UI 회귀18개 통과, 마지막 탐색 경로 수정 후 영향4개 재통과. 실제 브라우저의 KB+연결조회 응답50건 모두200, JS오류0, 모델요청0, 320px 넘침0이다. API 계약 독립 감사8검사와 공개 원본에 연결한 합성50행 정합성은 별도 근거다.
- 허브 근거 `01_현재_아이디에이션/evidence/department-mapping/`: API 계약, 실제 브라우저 HTTP/화면, 재현 스크립트. 첫 실행의 비동기 응답기록 수집 경합은 prior-harness-event-race에 보존하고 명시적 해당 응답 대기로 수정했다. 제품은 그 실행에서도 미연결을 올바르게 표시했다.
- 자료 범위는2026-09-18 공개 보존 원문520,460행과 명시적인 시연용 부서 연결표다. 실제 내부 시스템 대응·현재 충전 상태·실제 조직 승인·AI 의미 품질을 입증하지 않는다. 이전5PASS/3FAIL과 배포 준비 제약은 유지한다.

## 직전 검증 · 기본 충전 업무의 대상과 출처 유지

최신 로컬 회사 경로를 API `58bd1d6`의 새 격리 HTTP 서버와 연결했다. 공개 배포는 아직 진행하지 않았다. 아래 `2ee1b3b`의 입수 방문자 경로와 구분하는 후속 검증이다.

- **실제 결함 재현·수정**: `GS타워 + 공공 ID 02` 검색 뒤 후보 선택 시 첫 행 `01`로 바뀌던 문제를 실제 브라우저에서 재현했다. 검색 ID와 일치하는 행을 선택하며, 아직 불러오지 않았거나 원문에 없는 ID는 다른 충전기로 대체하지 않는다. 선택 없는 상태에서는 KB 조회를 시작할 수 없다.
- **페이지와 새로고침**: 더 많은 충전기는 명시적인 다음 목록으로 조회한다. 원문 출처가 바뀌거나 같은 행을 반복 반환하면 합치지 않는다. 보류 중 검색 ID, 선택한 행과 검색어를 복원하며 사용자가 직접 바꾼 선택은 목록 확장으로 바꾸지 않는다.
- **표시 수정**: 표준 회사 KB의 `public_source`에 보관된 원문 URL·수집 시각·SHA·데이터셋과 원본 행·충전소·공공 ID·담당 부서를 카드·상세·조회 근거에 표시한다. 본문이 없는 이력 메타데이터는 검토 기록이 없다는 증거로 사용하지 않는다. 기존 방문자·일반 문서 출처 형식은 보존한다.
- **실제 브라우저 경로 1**: GS타워02 → 충전기개발팀 문서v1 → 사용 보류 검토v2 → 댓글 반영v3 → 단계4의 같은v3 원문 → 전사 승인 → 앱 부서의 같은v3/출처 조회. 이후 새로고침으로02/device/v3가 유지됐고, 소유 부서를app으로 바꾸면 별도 앱 문의 초안이었다. 지식 API 응답43건200, JS오류0, 모델 요청0, 320px 넘침0이다.
- **실제 브라우저 경로 2**: 개포래미안포레스트/LG유플러스 볼트업의51행에서 공공ID51은 첫50행에 없었다. 선택은 비어 있고 KB 버튼은 비활성화됐다. 사용자가 다음 페이지를 불러온 후 정확한51의 원본 행을 선택했다. API offset0/50, KB 요청0, 모델 요청0이다.
- 이 두 경로의 자료는 **2026-09-18 보존 스냅샷520,460행**이다. 새 환경부 다운로드520,973행의 증거로 바꾸지 않는다. 실제 내부 ID 대응, 실제 조직 승인, 생성 의미 품질이나 공개 배포를 통과했다고 주장하지 않는다.
- 새 company-selection/company-provenance를 포함한 관련 회귀17개가 통과했다. 날짜·공유·출처·세션 경계 회귀를 포함하며 전체 API 시험을 재실행한 것은 아니다. 세부 실행과 최초 결함·검사 harness 수정 이력은 허브 작업공간 `01_현재_아이디에이션/evidence/standard-company/`에 보존했다.

## 이전 통합 상태 · 제품 UI 2ee1b3b

제품 UI `2ee1b3b` + API `58bd1d6`의 **로컬** 통합 결과다. 두 저장소의 새 개편은 아직 push·배포하지 않았다. 마지막 확인된 공개 Pages 성공은 `984f9c7` / run `35590759427`; API 배포 성공 기록은 `420a244` / run `35592881124`다. 기존 공개 health 응답만으로 실행 중 API SHA를 독립 확정하지는 못했다.

- 실제 로컬 브라우저/API에서 합성 17열·2행 CSV 입수 → 새 가이드 v1 → 사람의 사용 보류 검토 v2 → 별도 완료 → 별도 전사 승인 → 앱 부서의 같은 v2 조회를 확인했다. 이어 댓글 반영 v3는 검토만으로 공유되지 않고, 재승인 후 다른 부서에서 v3 원문을 조회했다. 원본 source는 동일하고 검토 기록은 한 번만 존재했다.
- 현재 버전의 사람 검토가 없는 과거 confirmed 문서는 '검토 기록 미등록'으로 표시한다. 사용 보류·적용 조건·미확인 사항을 공유 후에도 보존한다. 이 UI 절차는 실제 회사 승인이나 직접 API 권한 강화의 증거가 아니다.
- 해시/뒤로 이동에서 모음의 이전 빈 목록이 남던 오류를 수정했다. 부서·전사 모음의 원문 조회 결과는 사람의 결론·근거·조건·다음 행동을 먼저 표시하며 전체 원문은 하나의 펼침에서 확인한다.
- 320px 가로 넘침 0, 단계2의 다음 행동이 첫 900px 안에 노출됐다. 새로고침 뒤 방문자 토큰·원문 복원 0, local/session storage는 비어 있었다. 이 영속성 검사는 방문자 입수 경로에 한한다.
- 20개 UI 회귀 스크립트가 통과했다: company-navigation, company-human-review, company-sharing, company-sharing-transport, company-live, demo-isolation, organization-kb, inquiry-mode, general-examples, general-readable, data-knowledge-bridge, platform-workflows, workflow-context, evidence-scope, source-records, session-race, kb-save, data-explorer, data-intake-state, data-review-ui.
- 별도 독립 QA는 UI `6bb06bb`와 기존 로컬 API에서 검토 작성·완료·공유 분리와 미확인 유지의 대표 경로를 확인했다. 허브의 이후 탐색/원문 표시 수정과 동일한 실행으로 합산하지 않는다.
- 실제 환경부 새 다운로드의 520,973행 검증은 [별도 입수 보고](tests/evidence/data-ev-live/report.json)다. 위 2행 파일의 동일 문서 검증과 서로 대체하지 않는다.
- 이 통합 회차의 실제 생성·임베딩 호출은 0이다. 이전 실제 AI 문의 평가의 **5 PASS / 3 FAIL**은 여전히 남아 있다. 승인 모델·프로젝트 전용 OAuth 준비와 공개 전체 검증, 새 임베딩 지원, 실제 사용자 이해도·효과 검증은 미완료다.

허브의 상세 증거는 프로젝트 작업공간 `01_현재_아이디에이션/evidence/root-human-review/`와 `company-human-review-6bb06bb-independent.md`에 보존되어 있다. 공개 저장소에 이 허브 경로가 있다고 가정하지 않는다. 아래 기록은 각 당시의 코드·환경·표본에 한정된 이력이며 현재 기능이나 공개 배포 상태를 덮어쓰지 않는다.

## 산출물과 게시 상태

- 전용 체크아웃: `/Users/hr/Desktop/jy.cheong/KNOW-HOW`.
- 최초 구현 `b4376e3`; Excel 및 세션 경계 보완 `bea4410`.
- 원격 저장소는 빈 상태로 clone 성공. `GIT_TERMINAL_PROMPT=0 git push -u origin main`은 `could not read Username for 'https://github.com': terminal prompts disabled`로 실패.
- 후속: GitHub CLI 인증 후 git push 성공. Pages Source=workflow 구성, run 35567580357 성공. 실제 공개 UI https://128june.github.io/KNOW-HOW/ 에서 새로고침 및 모바일390px(가로 넘침 없음) 확인. 공개 API 연결 검증은 여전히 미완료.
- API 담당 확인: 사용자 제공 ctrl-j.xyz는 기존 포털이며 `/api/me`가 KNOW:HOW JSON 대신 기존 로그인 HTML로 이동함. 설정에 자동 반영하지 않음.

## 실제 브라우저 + 실제 로컬 production API

가상 테스트 계정/가상 자료만 사용. mock 응답 없음. API 소스는 공유 `03_KNOWHOW`, DB는 공개 저장소 밖 `/tmp/knowhow-ui-validation`.

- UI origin `http://127.0.0.1:18752`, API origin `http://127.0.0.1:18751`.
- PC: Bearer 로그인 → `/api/me` → MD 가상 예시 업로드 201 → 초안 v1 → 버전 지정 댓글 → admin 확인 원문 v2 + 재사용 답변/기간 + 댓글 처리 → 로그아웃 200.
- 모바일 390×844: 다른 member 로그인 → 같은 질문·맥락·적용일 검색 → 확인된 답변, v2, 원문 2행, 담당자, 적용 기간 표시 → 원문 이동. 담당자 정정 UI 숨김. document scrollWidth=390, viewport=390.
- 상충: 같은 질문/맥락/기간으로 서로 다른 등록 답변 2개 준비 후 브라우저 질문. `상충`, `확정 답변으로 사용하지 마세요`, 두 원문 근거 표시.
- 미확인: CNUM/modem_id 연결 조건 질문 시 `미확인`과 관련 근거, 담당자 확인 필요 표시.
- AI 요청: 실제 모델 미설정 응답을 `모델 미설정`, 생성 답변 없음으로 표시.
- XLSX: 테스트 fixture records.xlsx 선택 → 업로드. 의존성 미설치 API의 503 오류 표시 후 설치된 venv로 재시작하고 같은 입력 재시도 성공(201). 원문에 고객 안내/개발 통신 시트의 셀 위치, 원본 크기/SHA-256 표시.
- XLSX 검색: `xlsxmarker` → records.xlsx v1, 고객 안내!B2, 추출문 4행 표시.
- XLSX 다운로드: UI 인증 fetch와 API OPTIONS204/GET200 확인. in-app browser의 download 이벤트가 timeout되어 최종 파일 저장 완료 검증은 미완료. 다운로드 완료라고 보고하지 않음.
- 최종 빌드 5파일을 별도 정적 루트에 배치하여 `/KNOW-HOW/`에서 로그인/검색 및 새로고침 성공. 새로고침 후 API 미연결(메모리 세션 초기화) 표시. 상대 경로 CSS/JS 로드 성공.

## 회귀 검증

`node tests/session-race.cjs` 통과. 의도적으로 늦춘 fetch 응답 및 JSON parse가 세션 세대 변경 후 자료에 적용되지 않음. 새 API 로그인 요청에 이전 Bearer 헤더 없음. 네트워크 시험을 대신하는 테스트가 아니라 비동기 세션 회귀 방지용 VM 테스트임.

`node --check src/app.js` 통과. `python3 tools/build.py` 통과, 산출물 index.html/style.css/app.js/config.js/.nojekyll. DB·로그·비밀 없음.

## 남은 인수 범위

1. GitHub push와 Pages 게시 완료. 브라우저 파일 업로드는 사용하지 않음.
2. ctrl-j 기존 배포/인증/라우팅에 KNOW:HOW 계약을 통합한 실제 HTTPS API 확보.
3. KNOWHOW_API_BASE와 정확 CORS origin 설정 후 실제 Pages↔클라우드 로그인·조회·정정·로그아웃 검증.
4. 브라우저 파일 저장 완료까지 원본 다운로드 검증.
5. 실제 모델 품질, 자유로운 바꿔 말하기 일반화, 실제 업무 시간/추가 문의 절감은 미검증.

현재 로컬 미리보기: `http://127.0.0.1:18752/KNOW-HOW/`. 임시 서버가 실행 중일 때만 이용 가능하며 공개 게시 주소가 아님.

## 공개 API 연결 설정 후속

2026-09-21 15:25 KST. 허브에서 https://api.ctrl-j.xyz/knowhow/health 정상, Pages origin OPTIONS204 및 /api/me401 JSON+CORS 확인. repository variable KNOWHOW_API_BASE를 해당 base로 설정. UI는 로그인 전 API 연결 대상을 표시한다. 승인된 실제 CTRL-J 계정 로그인 이후 공개 환경 전체 E2E는 아직 미검증이다.

## 장소 → 충전기 → 개발팀 문의 흐름

2026-09-21 로컬 UI18762/API18761(별도 가상 승인계정) + 실제 2026-09-18 공개 데이터520460행으로 브라우저 검증. “GS타워에 있는 충전소명 뭐야?” → 실제 검색어 GS타워, 주소/운영사 3후보. GS차지비 논현로508 선택 → 공개ID01,02,10~14 총7개 표시. 01선택 → 명칭/주소/운영사/원본ID/출처/수집시점/내부매핑미확인 문의초안. 후속 통신로그질문에도 동일 대상 유지. 관련업무기록검색에도 맥락 전달. 모바일390px 긴 원본키 넘침을 수정한 뒤 scrollWidth390 확인. 사용자 기존 공개 로그인탭은 조작하지 않음.

`tests/workflow-context.cjs`는 선택맥락 payload/미확인명시/늦은응답폐기/계정전환초기화를 검증하며, API mock 기반 UI 회귀시험임. 실제 데이터 결과의 근거는 위 별도 로컬 API 브라우저 시험임. 공개환경 승인계정과 데이터입수 후 전체검증은 별도 필요.

## 공개 ID → 앱개발팀 → 명시적 KB 저장 (2026-09-21 15:55–16:00 KST)

구현 소스 커밋 916deed. 별도 로컬 UI18762/API18761, 가상 승인계정 reviewer, 실제 520460행 과거 공개자료 및 가상 부서DB로 검증. 운영 사용자의 로그인 대기 탭은 조작하지 않았다.

- 환경부 ID `01` 단독 검색은 94569후보, 장소 GS타워 AND조건은3후보. 자동으로 하나를 확정하지 않음.
- GS차지비/논현로508 → 공개01 선택 → 앱 ID `DEMO-APP-d9c51dac6e274c75`, 충전기개발 ID `DEMO-DEVICE-d9c51dac6e274c75` 별도 표시. 샘플 DB·실제 매핑 아님 명시. 앱 우선 문의 가이드/조회 요청 초안 제공.
- 사용자가 조직공유를 선택하고 KB로 저장 클릭 → KB#1 v1초안 성공 → 상세 원문/출처/별도ID/샘플표시 확인. 저장만으로 검증완료 표시하지 않음.
- 댓글 작성 → 담당자 본문에 가상 로그 가이드 추가, 정정 v2+댓글처리 → 부서별KB 앱목록에서 v2정정 재조회.
- 동일 선택대상으로 후속 문의 → reused KB#1/v2/정정 표시와 최신 본문(요청시각·앱오류코드 추가) 재사용. 이전 구조화 ID는 현재카드에서 숨기고 상세이력으로 분리.
- 모바일390x844의 재사용 문의와 부서별KB 모음에서 scrollWidth390 확인. 화면 캡처는 이 UI 작업 대화의 브라우저 검증 결과에 포함.
- VM회귀 kb-save/workflow-context/session-race/evidence-scope 통과. 동일request_id+body재시도, 저장성공중복방지, 선택변경늦은저장폐기, 부서ID분리 검증.
- 운영의50행subset은 dataset_scope=sample_subset일 때 모든출처영역(문의/KB목록/상세)에서 일부자료·미수록후보를 경고. 로컬전체3후보와 운영샘플1후보를 같은 범위로 보고하지 않음.

공개환경 실제승인계정으로 인증후 전체흐름은 별도 미검증이며 위 결과는 실제로컬API 인수임.

## Public sample experience — 2026-09-21
- Address-first UI deployed in `a329929`, Pages run `35571510008` succeeded.
- Dedicated sample UI uses only anonymous `/demo/workflow/search`, `/chargers`, `/inquiry` with `credentials: omit` and no Authorization header. Entering sample mode clears in-memory organization session and workflow state; mode changes discard late responses.
- Browser-only KB namespace `knowhow.public-sample-kb.v1`; no anonymous server write. Save, department filter, detail, correction history, and latest-body reuse are available without login. Corrections suppress old structured ID cards; subsequent questions are explicitly appended.
- Real browser local test against actual sample API `127.0.0.1:18763`: address chip → GS타워 → 7 chargers → ID 01 → distinct app/device IDs → browser KB v1 → corrected v2 → reload → saved list → same-target inquiry reuses v2 corrected text. No organization login used.
- Regression suites: session-race, evidence-scope, workflow-context, kb-save, demo-isolation passed. The last test checks no organization token/cookies, isolated storage, latest corrected body, and stale mode response rejection.
- Public sample remains a 50-row subset, not nationwide search. Browser storage is specific to the browser/site; clearing browser data removes sample KB. Existing organization API still requires authentication.

### Deployed browser acceptance (public site)
- UI commit `4a6d1f8`; successful Pages run `35571833391`.
- Actual URL: https://128june.github.io/KNOW-HOW/ . Used a separate new browser tab (tab 9); did not operate the user's existing login tab or enter organization credentials.
- Clicked sample experience → GS타워 + public ID 01 → GS차지비 station at 논현로 508 → all 7 chargers displayed → selected 01 → app inquiry with distinct synthetic app/device identifiers.
- Saved browser KB v1, appended `[공개 체험 검증] 문의 시 앱 오류코드와 요청 시각을 전달합니다.`, saved corrected v2, then navigated/reloaded the public site.
- Re-entered sample mode: department filter device returned 0 and app returned 1 saved KB. Reopened and requested the same target again.
- DOM assertions: corrected marker present = true; `이번 후속 문의:` present = true; reused v2 / 정정 present = true; organization navigation hidden = true; horizontal overflow = false at tested desktop viewport.
- This is actual deployed anonymous UI/API/browser-storage acceptance, not an authenticated organization-account test. The fixture has 50 public-source rows and synthetic department IDs. Browser KB is confined to this site/browser storage and is not organization KB.

## Scenario-first public experience — 2026-09-21
- Five direct-entry scenarios replace the public login-first flow. Public header has no login/API-connection control. Protected organization endpoints are unchanged.
- `demo-example.js` contains a captured response from the anonymous 50-row public fixture: GS타워, seven chargers, selected public ID 01, and distinct app/device guides. Department IDs and responder examples are explicitly fictional.
- Every scenario has a prepared example. Merely entering a tab does not save it. Browser-only namespace `knowhow.scenarios.v1` preserves saved replies, comments, correction reasons, versions and latest-body reuse. Earlier sample storage is untouched.
- Scenario 2 saves a separate fictional responder reply with context, evidence and example applicability dates, not a generated inquiry draft promoted to confirmation.
- Scenario 3 links a member's unreviewed comment to a reviewer-role correction, reason and resolved version. Scenario 4 reuses the full latest body while preserving the new question; dates outside the example applicability range are excluded from current answers.
- KB collection has policy, department-data-structure and documented-guide categories; readable summary cards lead to detail. Data fields have human explanations and sample values; raw tracking keys and history are collapsed. Corrections suppress old structured ID values.
- Local actual-browser checks: all five hash URLs load independently with five navigation tabs, no login dialog, hidden session control. Reply save → comment → fictional reviewer → correction v2 → other-member question returns corrected text and preserves new question. Reload retains correction; 2027-01-01 applicability excludes the answer. Desktop KB screenshot visually inspected.
- Five regression suites pass, including expanded demo-isolation tests for unsaved seeds, comments not granting confirmation, correction linkage, persistence and expired applicability.

### Deployed five-scenario and mobile acceptance
- Commit `cf699d8`, successful Pages run `35573668226`.
- Separate public tab 11, 390×844 viewport: all five direct hash URLs showed five scenario buttons, no open login dialog, and document width 390px. No page-level horizontal overflow.
- Scenario 2 fictional reply save → scenario 3 unreviewed comment → reviewer-role switch → correction v2 → comment resolved to v2 all succeeded. Scenario 4 opened via keyboard Enter, preserved a new question, returned the newly corrected request-time/error-code sentence, and retained v2 after reload.
- Scenario 5 app filter returned its single department example; data-structure detail displayed field meanings and sample values, with the table scrolling inside its container. Mobile screenshots of data detail and latest-answer reuse were visually inspected; desktop collection was also visually inspected.
- Screenshots are recorded inline in the browser tool transcript. Existing user login tabs were not operated.

### Explicit AI request UI
- Scenario 4 keeps full browser KB reuse separate from AI output. AI is requested only by an explicit submit; tab entry, navigation and refresh never call the endpoint.
- Modes distinguish server fixture v1, server-approved fictional correction v2, and unreviewed browser input. Server v2 is explicitly not the user's arbitrary local correction. Long local text is never silently truncated.
- Mock checks cover true-generation labels, not-configured messaging, HTML escaping, no auth headers, pending-request duplicate suppression, and discarding a late response after context changes. No paid calls were made by UI verification; API task owns the agreed two live verification calls.

### Live AI outcome and honest rendering
- API task performed exactly two paid calls (v1/v2) against API commit `c0385a6`; both returned `ai_generated: true` from `gpt-5.4-nano`. UI verification made zero additional paid calls.
- Both answers used their corresponding sample ID and v2 excluded the old app ID, but semantic task quality FAILED: the model confused the charger ID used by a department with an ID identifying the department, and declined to compose an inquiry. Connection/generation success must not be reported as successful task completion.
- Minimal recorded real responses are in `tests/fixtures/ai-live-responses.json`. Offline renderer regression verifies actual-generation labels plus an explicit cannot-establish-answer warning for `model_answerable: false`. Human-readable evidence summaries are preferred over raw JSON.
- UI identifier labels clarify “충전기 ID used by the department.” Server prompt/evidence wording is being refined independently; no paid retest is claimed.

### Evidence limits and explicit conflict scenarios
- Scenario 4 now offers explicit supported, missing-information and conflicting-guidance examples. These are selected scenarios, not claimed semantic inference from keywords.
- Missing live fault causes / real JOIN conditions show cannot-determine guidance and required department checks, without presenting the KB body as an answer. Conflict shows both same-target/same-period fictional documents and refuses to choose one as authoritative.
- Edited free questions show a reference-source heading and explicitly state that relevance/answerability were not automatically determined. Missing/conflict scenarios disable AI requests; this requires zero paid calls.
- Local actual-browser assertions passed for missing/no-answer, both conflict sources/no arbitrary choice, disabled AI, and free-question relevance disclosure. Existing latest corrected source reuse is retained.
- AI evidence groups preserve server `citation_number`; sparse [1,4] is never renumbered, and multiple source rows with the same number remain one citation group. Older recorded responses without numbers are labeled as such. Offline regression covers both.
- Recorded real AI response was replayed through a local mock HTTP server and actual browser: generated-label=true, cannot-establish-answer-warning=true, recorded refusal text shown=true. This did not call an AI provider.

### Source-record integration
- Source module `19bcd9c` is mounted once per current page in a collapsible panel across KB scenarios 2–5; its shared memory store survives tab changes. Remounts destroy old view/listener bindings.
- KB source links resolve the appropriate department/category/version to exact source lines. v2+ links explicitly identify original v1 examples as historical sources, not automatically valid correction evidence. Conflict A/B links resolve their own original documents.
- Actual CUA browser: v2 reply citation opened the panel and selected lines 7–8; initial-source warning displayed. Explicit collection produced a 64-character SHA-256 and collection timestamp. Editing its separate draft to v2 left the original text and SHA-256 unchanged.
- Actual CUA file chooser: synthetic `/tmp/knowhow-synthetic-source-note.md` imported locally; filename, unchanged original text, unreviewed draft v1, and memory-only notice all verified. No AI request was made. Source records and these drafts intentionally disappear on refresh; scenario KB remains in its separate browser storage.
- Source-module owner reports 18 unit tests and isolated browser checks; detailed evidence and scope are in `docs/source-records.md` and `tests/evidence/source-records/`.
- Fixed conflict/department context: switching away from app while the app-specific conflict example is selected resets to the supported example for the selected department. Regression confirms conflicting app documents do not remain under the device department.


## Organization KB interface

- Added isolated public demo session controls, department-default search, explicit same-organization company inclusion, and conversation separation by session, organization, department, search scope, and applicability date.
- Source-linked drafts support explicit server registration, review, promotion request, company approval, and revision. Public roles are simulations, not authentication.
- Tab 5 includes an explicit “AI에 질문하기” action with `generate: true`; navigation does not trigger AI requests. Manual AI availability follows the build configuration after the key2-only server deployment was verified.
- `tests/organization-kb.cjs` and `tests/demo-isolation.cjs` pass. Organization tests mock transport; they verify request boundaries and state handling, not semantic search or generation quality. Production static build succeeds. No paid generation or embedding calls were made for these checks.


## Guided entry, general knowledge and data workflow (local, 2026-09-21)

- Service introduction renders problem → four-step solution → four actions; existing five company scenario links and the tab 5 AI entry remain. Mobile CUA at 390px confirmed visible entry CTAs and document width 390px.
- General CUA: leave policy v1 → comment → v2 (5 business days) → next-member latest-text reference → explicit transfer into the hr server draft. The matching fixture became one server document at v2, not an additional conflicting v1 document. General preview uses real SQLite/Qdrant with mocked embedding transport and blocked generation.
- General and company sample packs have separate controllers, sessions, documents and browser storage. General policy/data/onboarding examples have distinct questions, department names, definitions and guides.
- CUA verified that changing the applicability date to 2026-09-22 preserves an unsent question. Cross-organization/department changes clear it. Purpose tabs limit shared-knowledge screen density.
- Data CUA against the actual local API on port 18768: synthetic energy 1,000 rows → server preview 50 rows → numeric conversion + HMAC → 999 rows and 1 error → group/count/sum mart 4 rows → lineage 1,000/999/4. A further 4-row transform verified editing text survives progress polling to completion. No large UI benchmark was run.
- Backend owner reports a separate local engine benchmark of 1,000,000 CSV rows (85,854,381 bytes); the UI labels it as macOS development-environment evidence, not public-server capacity or latency.
- New platform workflow tests cover distinct general storage/latest versions/immutable originals, zero automatic data jobs, bounded server pagination and stale-request rejection. Existing session, evidence, workflow, save, scenario, organization and 19 source-record tests passed.
- No paid generation or embedding calls were made for this UI validation. GPT semantic quality remains outside these checks. Public deployment verification follows the local checks.


### Data-to-knowledge and selected-document query
- Combined local API CUA: 100-row dataset → metadata guide draft → exact-ID query excludes it before review → review → one guide evidence result. No raw personal rows were copied into the guide. The opened stale draft detail closed after review, and current status appeared in the catalog.
- Company CUA: the displayed GS app v1 was explicitly registered and reviewed, then selected with “이 문서에 질문하기”. “근거만 먼저 확인” submitted `document_id` and `generate:false` and returned exactly that document. No arbitrary evaluation identifier or QA seed was used. The submitted clean-browser body is derived directly from the product helper in `tests/fixtures/company-transfer-v1.json`.
- Public read-only CUA confirmed general hr catalog alignment and the already-created 4-row data mart with 1,000 → 990 → 4 lineage. This UI verification created no production data jobs and made no generation requests.
- The bridge and selected-document contract require the coordinated API release; local proof must not be described as public end-to-end proof before that release. Observations are recorded in `tests/evidence/frontend-workflows/observations.json`.

## 2026-09-21 C/D 조회 UI 연결 (Git 배포)

- `data-explorer.js`: 서버 검색, AND 열 조건(최대 16), 자료형에 맞춘 값, 정렬(최대 3), 50행 페이지, 선택 파티션. 입력 중 조건과 마지막 성공한 조건을 분리하여 페이지 이동/CSV가 같은 결과를 사용한다. 숫자 모양 RAW 문자열은 문자순임을 표와 정렬 안내에 표시한다.
- CSV는 서버 스트림 링크로 조건 전체를 내려받으며 offset/limit을 전달하지 않는다. 현재 표시 행 수와 전체 일치 행 수를 구분한다. 브라우저에서 전체 자료를 모아 처리하지 않는다.
- 저장 묶음, 단계별 완료 버전/latest, 다음 실행 분할 설정을 API에 연결했다. 설정 저장은 낙관적 version을 포함하며 기존 자료를 재분할하거나 작업을 생성하지 않는다. 공개 공유 설정임을 표시한다.
- 외부 파일/API/DB 연결은 관리자 허용 목록 기능으로 설명하며 공개 로그인/실행 기능을 추가하지 않았다. 실제 DB 접속 검증은 미완료다. download/extract는 바이트로 표시하며 total_bytes가 없으면 진행률을 만들지 않는다.
- 로컬 실제 API `127.0.0.1:18768`, fixture `543d261313294ef09b6454cbe0406ca1` 재사용. CUA에서 서울 조건+RAW id 내림차순 전체301/표50, 다음51–100행, 두 번째 묶음51행, manifest1000+203, 완료이력v1/latest, 다음 실행2000저장→기존분할불변→1000복원 확인. 전체 검색 서울301행, 완료 버전 없는 단계의 한국어 오류와 기존 결과 유지 확인. 320px에서 가로 넘침0 및 조건 입력 배치 확인.
- `tests/data-explorer.cjs`: 숫자/문자 비교값, null조건, 정렬중복거절, CSV에 페이지제한없음, 적용조건 유지, dataset 전환 늦은응답 배제, 바이트 진행률 검사 PASS.
- `tests/data-explorer-http.cjs`: 실제 서버301행 CSV의 ID 전체목록 및 합180901, 페이지50행/offset50, 파티션1000+203, latest/versions/settings 검증 PASS. 환경변수로 배포 API와 기존 fixture를 지정할 수 있다. 임시 공개 fixture는 24시간 후 만료될 수 있다.
- 기존 `platform-workflows.cjs`, `data-knowledge-bridge.cjs` PASS. 이 UI 작업은 새 처리 job0 / 유료 AI 호출0. 실제 외부 커넥터 접속, GPT 생성 품질, 100만행 성능을 이 결과로 보증하지 않는다.

## 2026-09-21 범용 사례 재설계와 저장·공유 표현

- 대표 사례를 매출 집계(결제일/정산일), 고객 중복(계정/법인/고객키), 환불 수수료(계약/귀책/면제)로 교체했다. 서로 다른 업무 목적의 지표는 모두 유효할 수 있으며, 재사용은 목적에 맞는 정의·기준일·키를 선택하고 차이를 설명하는 과정이다.
- 소개·좌측 단계·질문·자료·확인 근거·정정·재사용·조직 문서의 계약을 일치시켰다. `tests/fixtures/general-examples-v2.json`과 UI seed 동등성을 검사한다. 시나리오 세트는 v2, 각 최초 문서는 v1이며 보완 후 문서 v2가 된다. 새 부서는 finance/data/operations이고 fixture ID도 새로 부여했다.
- `knowhow.general.v2`에 새 기록을 저장한다. 기존 v1 저장 키는 읽기만 하며 보관 목록에서 이전 버전을 확인할 수 있다. 동시 정정 검사를 유지하고 다른 사례 저장 시 기존 정정 이력을 보존한다.
- CTA는 ‘확인한 기준을 지식으로 남기기’, 저장 직후에는 ‘이 기기에 기준을 저장했습니다. 아직 팀에 공유되지 않았습니다.’로 변경했다. 별도 ‘팀과 공유할 초안 만들기’는 등록 양식을 준비하며 자동 전송·검토·공유를 하지 않는다. 이후 지속 배지는 기기 저장과 별도의 공유 상태를 구분하고 실제 담당자 확인 상태는 서버 영역에서 표시한다. 충전 회사 사례의 CTA만 정리했으며 원문·비교용 fixture는 바꾸지 않았다.
- 공개 샘플 서버로 보내는 본문에 schema/guide를 중복 첨부하지 않는다. 수정하지 않은 일반 예시의 filename과 중복되는 source label만 생략하며, 사용자가 편집한 출처 설명은 보존한다. API 담당자가 실제 조직→provider 모의 요청으로 6개 초기/정정 예시의 입력 경계를 검사했다(유료 호출 없음). 모의 검사는 생성 품질 평가가 아니다.
- 로컬 실제 API `127.0.0.1:58096`과 CUA에서 3사례 모두 정정 v2 → 공유 초안 → 기존 seed의 서버 v2 미확인 초안 → 담당자 확인 → document_id + generate:false로 정확한 v2 근거를 확인했다. 확인 전 질문 버튼 비활성, 회사 데이터와 이전 저장 기록 유지, 320px 가로 넘침 없음. 공급자 전송은 로컬에서 mock/disabled였고 유료 호출0, 데이터 처리 job0.
- `general-examples.cjs`, `organization-kb.cjs`, `platform-workflows.cjs`, `demo-isolation.cjs`, `data-knowledge-bridge.cjs` 통과. 실제 GPT 설명 품질은 이 검증에 포함하지 않는다.

## 문의 초안 모드 UI — 로컬 검증, 배포 전

- ⑤ 회사·범용 질문 양식에서 기본 ‘기준 설명 받기’와 ‘담당자에게 보낼 문의 초안’을 명시적으로 선택한다. 기존 일반 질문 화면과 데이터 지식 연결은 문의 모드에 opt-in하지 않는다.
- `answer_mode=knowledge|inquiry`를 chat에 전달한다. 모드 변경은 요청을 보내지 않으며 작성 중 질문, 문서, 부서, 전사 포함, 적용일을 유지한다. 대화 키와 각 응답에 요청 당시 모드를 저장한다. 대기 중 선택은 비활성화하며, 늦게 도착한 이전 모드의 결과와 연결 오류도 epoch로 배제한다. 기존 대화 기록은 보존한다.
- generate:false 원문 조회와 선택문서 범위를 유지한다. 문의 성공 시 API의 초안 문장을 고치지 않고 표시하며, 생성 실패는 원문 근거로 구분한다. 내부 trace/schema/error_reason은 표시하지 않는다. 모의 응답에는 실제 모델 호출이 없다는 별도 배지를 표시한다.
- `tests/inquiry-mode.cjs`는 전환 요청0, 질문·범위 보존, 모드별 conversation 분리, 단일 명시 요청, 반환 초안의 수행자/행동 문구 그대로 표시, 실패 안내·trace 미노출, 일반 질문/bridge 유지, 늦은 성공·실패 배제를 검사한다. 기존 organization-kb, data-knowledge-bridge, demo-isolation, general-examples 회귀도 통과했다.
- 실제 로컬 HTTP `127.0.0.1:58096`와 CUA를 연결했다. API 담당자가 provider request_once와 임베딩을 완전 모의 처리하여 외부 모델 HTTP가 차단된 서버에서만 실행했다. 무료 문서 조회, 모의 문의 성공, 원문 구간 불일치 모의 실패, 원문 fallback, 모드별 기록 복원 및 320px overflow0을 확인했다.
- 최초 모의 응답은 검토 지시문이어서 사용 가능한 문의 형식으로 인정하지 않았다. 모의 응답을 ‘앱 화면이 멈추는 경우 문의자가 요청 시각과 오류코드를 앱개발팀에 전달하는 절차가 맞는지 확인 부탁드립니다.[1]’로 바꾼 뒤 문장·주체·전달 정보가 그대로 표시됨을 확인했다. 이 확인은 UI 출력 계약의 검사이며 실제 모델의 의미 정확성 통과가 아니다.
- 이 작업의 실제 모델 호출0/임베딩0/새 데이터 처리 job0. 로컬 커밋까지만 진행하며 API 최종 성공 인계 전에는 push하지 않는다. 실제 문의 생성 품질은 별도 검증이 남아 있다.
