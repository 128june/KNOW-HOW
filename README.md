# KNOW:HOW UI

장소 질문 → 주소·운영사로 충전소 후보 선택 → 공개 충전기 ID 확인 → 개발팀 문의 초안으로 이어지는 정적 UI입니다. 선택한 충전소·충전기 맥락은 후속 질문과 업무 기록 검색에 유지합니다. 문의 초안은 자동 전송하지 않습니다. 충전소 조회는 실제 공개 데이터 보관본이며 실시간 상태나 내부 장비 매핑을 보장하지 않습니다. 기록 입수의 예시는 가상 자료입니다. mock API나 자동 로그인은 없습니다.

## 실행 및 빌드

Python 3.10+ 외 추가 빌드 의존성은 없습니다.

```sh
python3 -m http.server 8080 --directory src
python3 tools/build.py
python3 -m http.server 8080 --directory dist
```

로그인 대화상자에 실제 API 주소(origin 또는 /knowhow 경로)를 입력하거나 배포 전에 공개 환경변수 `KNOWHOW_API_BASE=https://실제API호스트`를 지정해 빌드합니다. 주소가 없으면 미연결 상태로 시작합니다. API 담당 문서에 따라 production 계정을 준비하고 `KNOWHOW_ALLOWED_ORIGINS`에 UI origin을 정확히 등록하세요. 개발 시 localhost HTTP만 허용합니다. API 토큰은 메모리에만 저장하며 새로고침하면 다시 로그인해야 합니다.

## GitHub Pages

main push 또는 workflow_dispatch로 `.github/workflows/pages.yml` 실행. 저장소 Settings → Pages → Source를 GitHub Actions로 설정합니다. 실제 API 주소 확보 후 repository variable `KNOWHOW_API_BASE`를 등록하고 workflow를 다시 실행합니다. API CORS에는 Pages origin을 경로 없이 지정합니다.

빌드 결과는 HTML/CSS/JS/config.js/.nojekyll 5개만 허용합니다. 비밀·DB·로그를 복사하지 않습니다. 모든 자산은 상대 경로를 쓰며 페이지 이동은 서버 경로를 변경하지 않아 `/KNOW-HOW/` 하위 경로 새로고침에 대응합니다.

## 연결 계약과 범위

- 로그인 `/api/login {name,password,auth:'bearer'}` → 메모리 토큰. `credentials:omit` + Authorization 헤더.
- `/api/me`, `/api/logout`, `/api/docs`, `/api/docs/{id}`.
- `/api/upload {name,content,scope}`: MD/TXT/CSV, UTF-8 256KiB.
- `/api/upload/xlsx {name,content_base64,scope}`: XLSX 2MiB. 원본 보존, 시트·셀 출처 표시 및 인증 다운로드. 서버 Excel 의존성이 필요합니다.
- `/api/ask {question,context,as_of,generate}`: 정확 질문·맥락·기간에 맞는 담당자 답변 또는 관련 근거. 자유 질문 일반화는 보장하지 않습니다.
- `/comments {body,version}` / `/revise {version,content,state,reason,resolve_comments,rule?}`.
- 401 세션 초기화, 403/409/413 서버 메시지, 연결 실패 재시도 안내. 정정 409 시 입력은 유지됩니다.
- 모델 미설정·AI 초안·상충·미확인을 확인된 담당자 답변과 구분합니다.
- production의 비활성 환경부 탐색·자동 충전기 비교 메뉴는 제공하지 않습니다. 충전기 대조는 등록한 가상 원문에서 확인합니다.

실제 게시/검증 상태는 VALIDATION.md를 참조하세요.

## 장소 기반 업무 API

인증 후 POST `/api/workflow/search {q,limit,offset}` → 후보/실제 검색어, `/api/workflow/chargers {station_key,limit,offset}` → 공개 충전기 원문, `/api/workflow/inquiry {station_key,record_keys,question}` → 문의 초안/원문 확인 정보/미확인 정보. station_key와 record_key는 조회 맥락 키이며 내부 장비 ID가 아닙니다. 스냅샷 미설정 503은 오류로 표시하고 후보를 만들어내지 않습니다.

## 부서별 KB

환경부 충전기 ID는 문자열 그대로 검색하며 장소조건과 AND로 결합합니다. 문의부서는 앱개발팀을 기본으로 하고 충전기개발팀 ID와 구분합니다. 모든 가상매핑은 샘플 표시를 유지합니다. 명시적인 KB 저장은 기본private/초안이며 서버 request_id로 재시도 중복을 방지합니다. 부서별KB모음은 서버의 부서/검색어/상태/페이지 필터를 사용합니다. 저장된KB 재사용 시 최신버전·상태를 표시하고, 본문 정정으로 무효화된 구조화ID는 현재관계로 제시하지 않습니다.

### Guided public experience (current)
The first visit opens a service introduction: the problem, four steps to solve it, and four actions. Top navigation separates knowledge and data work. Existing `#scenario-1` through `#scenario-5` links remain valid for charging workflows; `#general-1` through `#general-5` use separate leave-policy, customer-metric and onboarding documents.

Company examples persist under `knowhow.scenarios.v1`; general examples use `knowhow.general.v1`. Prepared examples do not overwrite corrections. Organization demo sessions use separate `company`/`general` sample packs. Reading browser examples does not transmit them. Explicit registration sends the selected latest body to an unreviewed server draft; matching general fixtures create a new version of the existing server document, preventing obsolete seed duplicates.

Shared knowledge is organized by reading, asking, or writing. GPT generation only runs when the user explicitly requests it. Navigation does not generate answers. Public role selection simulates a workflow and is not proof of real-account authorization.

### Data platform
`#data` opens sample ingestion; `#data-datasets` opens preparation and previews; `#data-mart` opens server aggregation. The API base is derived as `/data-platform` from the configured API origin. Public samples are shared fictional datasets with server-defined retention and limits. Preview and quality pages request 50 rows at a time. Processing, deduplication, masking and aggregation execute on the server. UI polling updates progress without replacing editing forms.

The deployed data API is an adaptation, not all features of the earlier local platform: external API/web/database connectors and physical partition browsing are currently unavailable. Public file uploads are not offered. Local million-row benchmark results are explicitly distinguished from public-server performance.

### Original records and citations
KB source buttons open the original sample document at its cited lines. Original policy/schema/reply samples are collected only by an explicit action, with timestamp and SHA-256. Local TXT/MD notes can become unreviewed drafts without server or AI transmission; draft corrections do not modify original bytes. These original-record workspaces use tab memory and disappear on reload, independently of the scenario KB's persistent browser storage. See [source records](docs/source-records.md).
