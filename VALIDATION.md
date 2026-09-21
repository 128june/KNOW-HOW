# UI 검증 기록 — 2026-09-21

## 산출물과 게시 상태

- 전용 체크아웃: `/Users/hr/Desktop/jy.cheong/KNOW-HOW`.
- 최초 구현 `b4376e3`; Excel 및 세션 경계 보완 `bea4410`.
- 원격 저장소는 빈 상태로 clone 성공. `GIT_TERMINAL_PROMPT=0 git push -u origin main`은 `could not read Username for 'https://github.com': terminal prompts disabled`로 실패.
- 실제 Pages 게시 URL 없음. workflow 실행·Pages 설정·HTTPS 공개 API 통합 검증 미완료.
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

1. GitHub 쓰기 인증 확보 후 main push, Pages Source=GitHub Actions 및 워크플로 실행.
2. ctrl-j 기존 배포/인증/라우팅에 KNOW:HOW 계약을 통합한 실제 HTTPS API 확보.
3. KNOWHOW_API_BASE와 정확 CORS origin 설정 후 실제 Pages↔클라우드 로그인·조회·정정·로그아웃 검증.
4. 브라우저 파일 저장 완료까지 원본 다운로드 검증.
5. 실제 모델 품질, 자유로운 바꿔 말하기 일반화, 실제 업무 시간/추가 문의 절감은 미검증.

현재 로컬 미리보기: `http://127.0.0.1:18752/KNOW-HOW/`. 임시 서버가 실행 중일 때만 이용 가능하며 공개 게시 주소가 아님.
