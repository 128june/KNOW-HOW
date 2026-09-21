# KNOW:HOW OpenAI 서버 설정

> **과거 키 전달 구성 기록입니다. 현재 실행·배포 절차로 사용하지 마세요.** 2026-09-21 새 로컬 서버는 `APP_RUNTIME` / `LLM_PROVIDER`를 명시하는 계약으로 바뀌었고, 승인된 전환 방향은 `codex_cli`입니다. 승인 모델과 프로젝트 전용 서버 로그인이 준비되기 전에는 배포하지 않으며 기존 `_1`/`_2` 키로 자동 전환하지 않습니다. 현재 절차는 ctrl-j 저장소의 `docs/knowhow-codex-cli.md`를 따릅니다. 아래의 provider 기본값·배포 큐·키 동기화·미검증 상태는 작성 당시 이력입니다. 최신 공개/로컬 범위는 [검증 기록](../VALIDATION.md)을 확인하세요.

OpenAI 키는 이 공개 Pages 사이트에서 사용하지 않습니다. 인증된 요청은 `https://api.ctrl-j.xyz/knowhow`의 private `128june/ctrl-j` 서버에서 처리합니다. [OpenAI 공식 문서](https://developers.openai.com/api/docs/quickstart)는 서버 환경변수로 API 키를 제공하는 방법을 안내합니다.

## 확인한 배포 구조

2026-09-21 확인 기준, KNOW-HOW에는 self-hosted runner가 없고 ctrl-j에는 온라인 macOS/X64 runner가 있습니다. KNOW-HOW Actions Secrets는 ctrl-j Actions에서 자동으로 읽을 수 없습니다. 기존 ctrl-j 배포는 `~/secrets/ctrl-j.env`를 복원한 뒤 Docker Compose로 실행합니다.

추가한 전달 경로는 다음과 같습니다.

1. KNOW-HOW repository Secrets의 `OPENAI_API_KEY_1`, `OPENAI_API_KEY_2`, …를 수동 동기화 워크플로가 읽습니다.
2. 워크플로에 명시한 `OPENAI_API_KEY_1`부터 `OPENAI_API_KEY_20`까지만 숫자순으로 모읍니다. `2` 다음은 `10`이며 사전순이 아닙니다. 번호 중간이 비어도 됩니다. 최대 20개, 묶음 40,000바이트 한도입니다. 다른 repository Secrets 전체를 내보내거나 읽지 않습니다.
3. GitHub CLI가 대상 저장소의 공개키로 암호화하여 ctrl-j repository Secret `KNOWHOW_OPENAI_KEYS_JSON` 하나를 갱신합니다. 내용은 `{"OPENAI_API_KEY_1":"…","OPENAI_API_KEY_2":"…"}` 구조입니다. 값은 표준 입력으로만 전달하며 파일이나 명령 인자로 전달하지 않습니다. [GitHub CLI 암호화 동작](https://cli.github.com/manual/gh_secret_set).
4. ctrl-j의 `deploy.yml`을 `main`에서 실행 요청합니다. 대상 배포가 해당 Secret을 API 컨테이너의 환경변수 `KNOWHOW_OPENAI_KEYS_JSON`으로 전달합니다.

단일 묶음 교체이므로 원본에서 삭제한 키는 다음 동기화와 성공한 재배포 후 서버에서도 사라집니다. Secret 등록 자체는 서버 재배포를 실행하지 않습니다. Pages 배포도 키를 동기화하지 않습니다.

## 사용자가 한 번 설정할 항목

### KNOW-HOW repository Secrets

[KNOW-HOW Actions Secrets](https://github.com/128june/KNOW-HOW/settings/secrets/actions)에 다음을 등록합니다.

| 이름 | 값 |
|---|---|
| `OPENAI_API_KEY_1` | 첫 번째 OpenAI 프로젝트 API 키 |
| `OPENAI_API_KEY_2`, `OPENAI_API_KEY_3`, …, `OPENAI_API_KEY_20` | 사용할 권한이 있는 예비 키. 필요한 만큼만 등록 |

키에는 공백이나 줄바꿈을 넣지 않습니다. 서버와 동일하게 영문/숫자/밑줄/하이픈 8–512자만 허용합니다. `OPENAI_API_KEY_01`, `OPENAI_API_KEY_0`, `OPENAI_API_KEY_21`처럼 명시한 1–20번 슬롯 밖의 이름은 이 워크플로가 읽지 않습니다. 다른 Secret은 서버 키 묶음에 포함하지 않습니다.

### 전달 권한과 보호 환경

1. GitHub의 **Settings → Developer settings → Personal access tokens → Fine-grained tokens**에서 전용 토큰을 발급합니다. Resource owner는 `128june`, Repository access는 **Only select repositories → ctrl-j**로 제한합니다. 만료일을 지정합니다.
2. Repository permissions는 **Secrets: Read and write**, **Actions: Read and write**를 지정합니다. Metadata read 권한은 GitHub가 기본으로 부여합니다. Contents write, Workflows write, 전체 저장소 접근 권한은 필요하지 않습니다. [Secret 갱신 권한](https://docs.github.com/en/rest/actions/secrets#create-or-update-a-repository-secret), [배포 실행 요청 권한](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event).
3. [KNOW-HOW Environments](https://github.com/128june/KNOW-HOW/settings/environments)에 `backend-secrets`를 만들고 Deployment branches를 **Selected branches and tags → main branch only**로 제한합니다. 운영 승인자가 있다면 Required reviewers도 지정합니다.
4. 이 **environment Secret**에 `KNOWHOW_BACKEND_SYNC_TOKEN` 이름으로 전용 토큰을 저장합니다. 토큰 값을 코드, 채팅, 로그에 붙여 넣지 않습니다.

일반 `GITHUB_TOKEN`은 다른 private 저장소의 Secret을 갱신할 수 없습니다. 전용 토큰을 아직 등록하지 않았다면 동기화가 설정 부족 오류로 종료되며 서버를 변경하지 않습니다. 위 환경 보호 규칙은 GitHub 설정에서 적용해야 합니다. 워크플로 파일이 환경 보호 규칙을 자동 생성하지는 않습니다.

워크플로는 `main`의 수동 실행에서만 Secret을 사용합니다. push/PR에서는 가짜 값으로 테스트만 실행하며 Secret이나 운영 runner에 접근하지 않습니다. 공개 저장소의 write 권한자와 `main` 변경 권한자는 Secret을 사용하는 코드를 바꿀 수 있으므로 workflow 변경 권한을 신뢰하는 관리자에게 제한하세요. 허용된 20개 키 슬롯과 전달 토큰을 해당 단계의 환경변수에 개별 매핑합니다. 전체 Secrets를 JSON으로 내보내는 방식은 사용하지 않습니다. `backend-secrets`에 OpenAI 키와 같은 이름을 중복 등록하면 repository Secret을 덮어쓸 수 있으므로 중복 등록하지 않습니다.

## 동기화와 재배포

1. 먼저 ctrl-j OpenAI provider와 배포 전달 변경이 `main`에 배포되어 있어야 합니다.
2. KNOW-HOW **Actions → Sync OpenAI secrets to backend → Run workflow**에서 branch `main`, operation `sync`로 실행합니다.
3. 성공 메시지는 **암호화 Secret 갱신과 배포 실행 요청 성공**을 뜻합니다. [ctrl-j Actions](https://github.com/128june/ctrl-j/actions/workflows/deploy.yml)에서 실제 배포가 성공했는지 별도로 확인합니다. 배포 실패 시 기존 컨테이너가 계속 이전 키를 사용할 수 있습니다.
4. 키 변경/추가/삭제 후에도 이 워크플로를 다시 실행합니다. Secret은 등록만으로 서버에 반영되지 않습니다. GitHub가 새 Secret을 반영한 뒤 실행된 새 배포가 필요합니다.
5. 모든 키를 제거하려면 operation `disable`로 실행합니다. 서버 묶음을 `{}`로 갱신한 뒤 재배포합니다. 일반 `sync`에서 키가 하나도 없으면 실수로 운영 키를 지우지 않고 중단합니다. `disable`은 원본 Secrets 자체를 삭제하거나 OpenAI에서 키를 폐기하지는 않습니다.

Secret 갱신 후 배포 실행 요청에 실패하면 실패 메시지에 부분 완료가 표시됩니다. 이 경우 ctrl-j `Deploy to Self-Hosted Mac Mini` 워크플로를 `main`에서 직접 실행하면 됩니다. 전용 토큰 만료/권한 변경 시 `KNOWHOW_BACKEND_SYNC_TOKEN`을 교체합니다.

ctrl-j 배포는 workflow 전체를 하나의 동시성 그룹으로 묶고 최신 실행이 이전 실행을 취소하도록 설정합니다. 반드시 **가장 최신 배포의 성공과 health**를 확인하세요. 새 배포가 실패하거나 취소되면 이전 컨테이너의 키가 남을 수 있습니다. 즉시 키 폐기가 필요하면 OpenAI 관리 화면에서도 해당 키를 폐기해야 합니다.

## 서버 운영 설정과 한도

서버 키 전달과 provider 활성화는 별도 설정입니다. [ctrl-j Actions Variables](https://github.com/128june/ctrl-j/settings/variables/actions)에 repository variable `KNOWHOW_AI_PROVIDER=openai`를 등록해 명시적으로 활성화합니다. 미등록 기본값은 `local`입니다. `KNOWHOW_OPENAI_KEYS_JSON` 묶음은 직접 설정한 `OPENAI_API_KEY_N` 환경변수보다 우선합니다. 키가 없으면 모델 미설정 상태를 정직하게 표시합니다. 키 묶음과 토큰을 `KNOWHOW_API_BASE`, Pages `config.js`, 프런트 환경변수, Docker build args에 넣지 않습니다.

서버의 모델/비용/프로젝트별 failover repository variables는 [ctrl-j OpenAI 설정 문서](https://github.com/128june/ctrl-j/blob/main/docs/knowhow-openai.md)의 기본값과 배포 매핑을 따릅니다(저장소 접근 권한 필요). 공개 무인증 sample/demo는 이 경로로 OpenAI를 활성화하지 않습니다. 한 프로젝트에서 만든 키 여러 개는 같은 프로젝트 사용 한도를 공유하므로 키만 바꿔 해결할 수 없습니다. 예비 프로젝트가 허용되었는지 서버 설정에 명시하지 않으면 quota 오류에서 다른 프로젝트로 넘어가지 않습니다.

전용 전달 토큰을 만들지 않는 대안으로, ctrl-j repository Secret `KNOWHOW_OPENAI_KEYS_JSON`에 번호 키 이름과 값을 담은 JSON 객체를 직접 등록할 수 있습니다. `KNOWHOW_AI_PROVIDER=openai` repository variable을 설정한 뒤 ctrl-j `deploy.yml`을 `main`에서 실행합니다. 이 경우 KNOW-HOW Secrets와 자동 동기화되지 않으므로 이후 키 변경도 ctrl-j에서 직접 관리해야 합니다.

## 검증 범위

실제 키/전달 토큰이 아직 제공되지 않아 Secret 전송, OpenAI 실제 호출, 비용 청구는 검증하지 않았습니다. 실행 준비를 위한 모의 테스트는 번호순 정렬, 허용된 키만 추출, 입력/수량/크기 제한, main 수동 실행 제한, 키 없는 실행 보존, 명시적 비활성화, 전송 실패 시 배포 금지, 부분 완료 안내, 하위 환경변수 격리, 응답/키 비로그, 정적 빌드에서 키 제외를 확인합니다.

```sh
python3 -B -m unittest discover -s tools/tests -p 'test_openai_secret_sync.py'
```

이 테스트는 실제 GitHub Secret이나 OpenAI를 호출하지 않습니다. 정적 빌드는 테스트용 임시 디렉터리에서 가짜 키 표식을 넣어 실행하고 산출물에 해당 표식이 없는지 확인합니다.
