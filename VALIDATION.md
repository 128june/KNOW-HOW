# UI 검증 기록 — 2026-09-21

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
