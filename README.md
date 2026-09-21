# KNOW:HOW UI

업무 질문 → 원문·버전 확인 → 댓글 확인 요청 → 담당자 확인·정정 → 다른 구성원 재사용을 위한 정적 UI입니다. 화면에 제공하는 CNUM/modem_id/BID/SID/CID 사례는 가상 예시이며 실제 회사 정책이 아닙니다. mock API나 자동 로그인은 없습니다.

## 실행 및 빌드

Python 3.10+ 외 추가 빌드 의존성은 없습니다.

```sh
python3 -m http.server 8080 --directory src
python3 tools/build.py
python3 -m http.server 8080 --directory dist
```

로그인 대화상자에 실제 API origin을 입력하거나 배포 전에 공개 환경변수 `KNOWHOW_API_BASE=https://실제API호스트`를 지정해 빌드합니다. 주소가 없으면 미연결 상태로 시작합니다. API 담당 문서에 따라 production 계정을 준비하고 `KNOWHOW_ALLOWED_ORIGINS`에 UI origin을 정확히 등록하세요. 개발 시 localhost HTTP만 허용합니다. API 토큰은 메모리에만 저장하며 새로고침하면 다시 로그인해야 합니다.

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
