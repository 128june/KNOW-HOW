# KNOW:HOW

한 사람이 확인한 업무 지식과 판단 근거를 다음 사람이 다시 찾아 묻지 않고 활용하도록 돕는 플랫폼입니다. 이 저장소는 GitHub Pages용 UI이며, 입수·저장·권한·버전·AI 처리는 별도 [ctrl-j API 저장소](https://github.com/128june/ctrl-j)가 담당합니다.

## 사용 흐름

1. **연결**: 지역·주소로 충전소를 찾거나 실제 Excel·CSV·웹 표를 가져옵니다. 원본 파일, 선택한 행, 출처, 담당 부서를 같은 KB 문서와 연결합니다.
2. **활용과 검토**: 선택한 문서의 근거를 조회하고, 명시적으로 요청할 때 AI 설명이나 문의 초안을 받습니다. 담당자는 확인 근거·적용 조건·미확인 사항·다음 행동을 기록합니다.
3. **현재 기준 확인**: 문서 버전과 검토 결론을 먼저 읽고 필요하면 전체 원문을 펼칩니다. '사용 보류'라는 검토 결론도 그대로 전달합니다.
4. **관리와 재사용**: 댓글 → 같은 문서의 새 초안 → 별도 검토 완료 → 별도 전사 공유 승인으로 진행합니다. 다른 부서는 승인된 버전만 명시적으로 포함하여 조회합니다. 정정 후에는 재승인이 필요합니다.

검색한 충전기의 부서 KB를 열면 API가 제공하는 부서별 ID·조회 테이블·원본 행의 연결을 함께 확인합니다. 새 초안에는 이 연결 근거를 남기고, 이미 저장된 KB는 새 조회 결과로 덮어쓰지 않습니다. 연결표가 없으면 내부 ID는 확인 필요로 남깁니다. 같은 원본을 첫 화면과 검색에서 다시 선택해도 원본 지문·행·부서를 기준으로 기존 KB를 이어갑니다. 연결된 문서가 여러 개면 적용 기간·검토 결론·본문을 비교해 직접 선택합니다.

공개 충전기 ID만으로 내부 시스템 ID를 추정하지 않습니다. 실제 공개 원문, 준비한 부서 사례, 사용자가 남긴 판단의 출처와 확인 범위를 구분합니다. 공개 역할 선택은 격리된 체험 절차이며 실제 조직 계정의 권한을 부여하지 않습니다.

## 화면 구성

| 화면 | 경로 | 하는 일 |
| --- | --- | --- |
| 시작하기 | `#home` | 문제, 해결 흐름, 시작할 업무 선택 |
| 충전 업무 | `#scenario-1` ~ `#scenario-5` | 대상 찾기 → 부서 문서 → 댓글·검토 → 다음 사람 조회 → 부서·전사 KB |
| 범용 업무 | `#general-1` ~ `#general-5` | 매출 집계 기준, 고객 식별 기준, 환불 수수료 예외의 확인·정정·재사용 |
| 자료 가져오기 | `#data` | Excel/CSV 파일, 다운로드 URL, HTML 표, 공개 Google Sheets 입수 |
| 민감정보 처리 | `#data-privacy` | 정책 근거·AI 제안 또는 직접 선택한 처리 방법 검토·실행 |
| 적용 정책과 결과 | `#data-policies` | 정책 문서·버전과 실제 처리 결과, 처리 이력 확인 |

기존 `#data-datasets`와 `#data-mart`는 각각 민감정보 처리와 정책 화면으로 연결됩니다. `#scenario-*-live`는 입수 화면에서 넘긴 메모리 문맥이 필요하므로 주소만 복사하거나 새로고침하면 원본 선택부터 다시 진행합니다.

## 로컬 실행

Python 3.10+로 정적 파일을 빌드합니다. API는 별도로 실행해야 합니다.

```sh
python3 tools/build.py
```

로컬 API를 실행한 후 생성된 `dist/config.js`에 **공개 연결 주소만** 지정합니다. 예를 들어 API origin이 `http://127.0.0.1:8081`이면 다음과 같습니다.

```js
window.KNOWHOW_CONFIG = {
  apiBase: 'http://127.0.0.1:8081/knowhow',
  aiRequestsPaused: true
};
```

```sh
python3 -m http.server 8080 --directory dist
```

API에서 UI origin `http://127.0.0.1:8080`을 CORS에 허용하고 방문자 데이터 기능을 활성화해야 합니다. `/data-platform` 주소는 같은 API origin에서 계산됩니다. `dist/config.js` 변경은 다음 빌드에서 교체됩니다. 인증 정보와 API 키를 UI 설정이나 Git에 넣지 않습니다.

공개 데모에 조직 로그인은 필요하지 않습니다. 파일 입수는 명시적인 사용자 동작으로 방문자 공간을 만들며 토큰은 탭 메모리에만 둡니다. 새로고침하면 이 연결이 사라집니다. 준비된 회사·범용 사례의 기기 저장 및 서버 세션은 방문자 파일 입수와 별도 경로이며, 이를 동일한 영속성으로 설명하지 않습니다. 실제 조직 API의 인증·접근 제어는 유지합니다.

## GitHub Pages 배포

`main` push 또는 `workflow_dispatch`로 [Pages workflow](.github/workflows/pages.yml)를 실행합니다. Settings → Pages의 Source는 GitHub Actions를 사용합니다. Repository variable `KNOWHOW_API_BASE`는 HTTPS API origin 또는 `/knowhow` 주소입니다. 서버 CORS에는 Pages origin `https://128june.github.io`를 등록합니다.

Repository variable `KNOWHOW_AI_PAUSED`는 기본 `true`입니다. CLI 인증·모델·실제 응답을 검증한 뒤 `false`로 설정하고 다시 빌드하면 명시적인 AI 요청 버튼을 사용할 수 있습니다. 중지 중에도 원문·정책 조회와 직접 선택한 데이터 처리는 유지됩니다. 이 값은 브라우저의 요청 제어이며, 서버의 인증·생성 허용·사용량 제한을 대체하지 않습니다. 로컬 빌드도 같은 환경변수를 사용하고 잘못된 값은 빌드 오류로 처리합니다.

새로 입수한 자료의 기본 업무 적용일은 한국시간 오늘입니다. 날짜를 바꾸어도 선택 문서와 질문은 유지하고 이전 날짜의 대화는 새 조회에 사용하지 않습니다. 준비된 시나리오는 화면에 표시된 기본 날짜를 사용합니다. 적용일은 현재 버전의 유효기간을 확인하는 기준이며 과거 버전을 복원하는 기능은 아닙니다.

빌드는 [명시적 허용 목록](tools/build.py)의 정적 파일만 복사하고 자산 내용 해시를 URL에 붙입니다. DB·로그·인증 파일은 포함하지 않습니다. 상대 경로와 hash 탐색을 사용하므로 `/KNOW-HOW/` 하위 배포를 지원합니다.

**2026-09-21 마지막 확인 기준, 최신 로컬 개편은 미배포입니다.** [현재 공개 UI](https://128june.github.io/KNOW-HOW/)의 마지막 확인된 성공은 `984f9c7` / Actions run `35590759427`입니다. 로컬 기능을 공개 완료로 간주하지 않습니다. 새 UI는 조율된 API 릴리스와 함께 검증해야 합니다.

AI 실행 설정은 서버가 담당합니다. 현재 승인 방향은 명시적인 `LLM_PROVIDER=codex_cli`이며, 승인 모델과 프로젝트 전용 서버 로그인이 준비되기 전 배포하지 않습니다. 기존 번호 키로 자동 전환하지 않습니다. 서버의 `docs/knowhow-codex-cli.md`를 기준으로 하고, 이 저장소의 과거 [키 전달 기록](docs/OPENAI_SETUP.md)은 현재 실행 절차로 사용하지 않습니다. CLI만으로 새 임베딩을 만들 수 없으므로 새 벡터 검색 지원은 아직 완료되지 않았습니다.

## 코드와 검증

| 파일 | 책임 |
| --- | --- |
| `src/platform-shell.js`, `src/shell.css` | 공통 탐색·첫 화면·레이아웃 |
| `src/demo.js` | 충전 대상과 같은 문서의 검토·정정·재사용 |
| `src/organization-kb.js` | 부서·전사 모음과 명시적 문서 질의 |
| `src/data-platform.js`, `src/data-review-ui.js` | 실제 입수와 처리·정책 검토 |
| `src/data-explorer.js`, `src/data-handoff-ui.js` | 서버 조건 조회와 선택 행의 KB 연결 |
| `src/general-knowledge.js`, `src/source-records.js` | 범용 사례와 원문 기록 |

입수·정책·방문자 경계는 [UI/API 연결 문서](docs/DATA_PLATFORM_UI_INTAKE.md), 원문 모듈은 [원문 기록 문서](docs/source-records.md), 현재 검증 범위와 이전 실행은 [검증 기록](VALIDATION.md)을 참고하세요.

```sh
node tests/company-identity.cjs
node tests/company-mapping.cjs
node tests/company-selection.cjs
node tests/company-provenance.cjs
node tests/company-human-review.cjs
node tests/company-navigation.cjs
node tests/company-sharing.cjs
node tests/data-intake-state.cjs
node tests/data-review-ui.cjs
```

이 회귀 스크립트의 모의 전송 검사와 실제 브라우저/API 검사는 별도입니다. 실제 모델의 판단 품질, 실제 직원의 이해도, 시간 절감 효과는 로컬 회귀 통과만으로 입증되지 않습니다.
