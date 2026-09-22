/* Canonical synthetic scenario, reused from the reviewed 2026-09-22 proposal. */
(function(root){'use strict';
 const fixture = {
  "schema_version": 1,
  "provenance": {
    "synthetic": true,
    "purpose": "검토용 설계 자료. 제품 데이터·실제 회사 정책·승인 기록 아님",
    "timezone": "Asia/Seoul",
    "currency": "KRW",
    "amount_basis": "합성 서비스 대가, 세금 생략. 결제는 수수료 전, 현금은 수수료 후",
    "snapshot_id": "SNAP-01",
    "snapshot_at": "2026-10-07T16:00:00+09:00",
    "query_before_revision_at": "2026-10-07T16:05:00+09:00",
    "query_at": "2026-10-07T18:00:00+09:00",
    "interval_convention": "start_inclusive_end_exclusive",
    "source_file": "부서문서-원본묶음.md",
    "real_organization_reviewed": false
  },
  "source_documents": [
    {
      "id": "SAL-01",
      "version": 1,
      "title": "영업의 계약 실적과 고객 연결 기준",
      "owner": "영업운영팀",
      "sections": [
        "1",
        "2",
        "3"
      ],
      "content": "SAL-01 v1 · 영업의 계약 실적과 고객 연결 기준\n\n출처 형태: 영업운영팀 계약 관리 문서와 계약 대장. 책임 부서: 영업운영팀. 시연 기록상 2026-09-30 확인. 원계약 최초 서명 실적과 후속 변경 실적을 분리한다.\n\n### §1. 월간 수주 실적\n\n월간 수주 실적은 그 달 처음 서명한 계약의 서비스 대가를 계약 단위로 합한다. 견적·미서명·테스트 계약은 제외한다. 결제일이나 은행 입금일로 최초 서명월을 옮기지 않는다. 이후 취소·감액은 변경 이력에 따로 기록한다. 이 수주 실적은 현재 잔여 계약가치나 해당 월 제공 실적을 뜻하지 않는다.\n\n계약 C1은 9월 1일 300,000원, C2는 9월 29일 200,000원에 처음 서명했다. 따라서 두 계약의 9월 최초 수주금액은 500,000원이다. 현재 남은 계약가치를 묻는 경우에는 별도 변경 대장을 확인해야 한다.\n\n### §2. 계약 상대, 주문 주체, 청구 고객\n\n계약 고객 현황은 기준시점에 서비스가 유효한 계약의 법인 식별자를 중복 제거한다. 구매자 계정은 주문을 제출한 계정이다. 청구 고객은 청구서를 받는 주체다. 세 역할을 같은 고객번호로 강제 치환하지 않는다.\n\n| 계약대장 행 | 계약 | 계약 상대 | 주문 주체 | 청구 고객 | 관계 근거 |\n|---|---|---|---|---|---|\n| C1 | C1 | E1 · 온솔제품 | U1 | B1 · 온솔본사 | 계약 C1의 계약 상대·청구 지정란 |\n| C2 | C2 | E2 · 온솔연구 | U3 | B1 · 온솔본사 | 계약 C2의 계약 상대·청구 지정란 |\n\n위 두 계약의 서비스 기간은 각각 9/1~12/1, 10/1~12/1이다. 계약 상대·청구처·주문 주체 관계는 각각 서명일인 9/1, 9/29부터 유효하다. 서비스 이용 권한은 서비스 시작일부터 유효하므로 두 시점을 혼동하지 않는다. 향후 청구처 변경은 유효 기간이 있는 새 관계로 남긴다. 계열사 이름이나 청구처가 같다는 이유로 E1·E2를 하나의 법인으로 합치지 않는다.\n\n### §3. 연결이 없는 기록\n\n결제 자료의 계약번호를 계약 대장과 대조한다. 계약번호가 없거나 두 계약 이상을 가리키면 영업운영팀이 주문 근거를 확인한다. `PX`는 결제 표시명 ‘온솔’만 있으므로 C1·C2 어느 쪽에도 연결하지 않는다. 추후 배분 근거를 받기 전까지 50,000원을 두 계약 실적에 더하지 않는다.",
      "section_contents": {
        "1": "§1. 월간 수주 실적\n월간 수주 실적은 그 달 처음 서명한 계약의 서비스 대가를 계약 단위로 합한다. 견적·미서명·테스트 계약은 제외한다. 결제일이나 은행 입금일로 최초 서명월을 옮기지 않는다. 이후 취소·감액은 변경 이력에 따로 기록한다. 이 수주 실적은 현재 잔여 계약가치나 해당 월 제공 실적을 뜻하지 않는다.\n\n계약 C1은 9월 1일 300,000원, C2는 9월 29일 200,000원에 처음 서명했다. 따라서 두 계약의 9월 최초 수주금액은 500,000원이다. 현재 남은 계약가치를 묻는 경우에는 별도 변경 대장을 확인해야 한다.",
        "2": "§2. 계약 상대, 주문 주체, 청구 고객\n계약 고객 현황은 기준시점에 서비스가 유효한 계약의 법인 식별자를 중복 제거한다. 구매자 계정은 주문을 제출한 계정이다. 청구 고객은 청구서를 받는 주체다. 세 역할을 같은 고객번호로 강제 치환하지 않는다.\n\n| 계약대장 행 | 계약 | 계약 상대 | 주문 주체 | 청구 고객 | 관계 근거 |\n|---|---|---|---|---|---|\n| C1 | C1 | E1 · 온솔제품 | U1 | B1 · 온솔본사 | 계약 C1의 계약 상대·청구 지정란 |\n| C2 | C2 | E2 · 온솔연구 | U3 | B1 · 온솔본사 | 계약 C2의 계약 상대·청구 지정란 |\n\n위 두 계약의 서비스 기간은 각각 9/1~12/1, 10/1~12/1이다. 계약 상대·청구처·주문 주체 관계는 각각 서명일인 9/1, 9/29부터 유효하다. 서비스 이용 권한은 서비스 시작일부터 유효하므로 두 시점을 혼동하지 않는다. 향후 청구처 변경은 유효 기간이 있는 새 관계로 남긴다. 계열사 이름이나 청구처가 같다는 이유로 E1·E2를 하나의 법인으로 합치지 않는다.",
        "3": "§3. 연결이 없는 기록\n결제 자료의 계약번호를 계약 대장과 대조한다. 계약번호가 없거나 두 계약 이상을 가리키면 영업운영팀이 주문 근거를 확인한다. `PX`는 결제 표시명 ‘온솔’만 있으므로 C1·C2 어느 쪽에도 연결하지 않는다. 추후 배분 근거를 받기 전까지 50,000원을 두 계약 실적에 더하지 않는다."
      },
      "validFrom": "2026-09-01",
      "validTo": "2026-11-30",
      "valid_to_exclusive": "2026-12-01"
    },
    {
      "id": "OPS-01",
      "version": 1,
      "title": "결제·이용 계정·환불 운영 기록",
      "owner": "서비스운영팀",
      "sections": [
        "1",
        "2",
        "3"
      ],
      "content": "OPS-01 v1 · 결제·이용 계정·환불 운영 기록\n\n출처 형태: 서비스운영팀 운영 문서와 이벤트 내보내기. 책임 부서: 서비스운영팀. 최초판은 2026-09-30 기준. 아래 §1~§3은 정책 원문이고, 뒤의 ‘10/7 데이터 부록’은 별도 스냅샷이다. 정책 v1이 이후 사건을 포함하고 있었다는 뜻이 아니다.\n\n### §1. 결제 운영 보고\n\n결제 운영 보고는 기간 내 성공 결제액을 결제 ID별로 합하고, 같은 기간에 완료가 확인된 환불액을 환불 ID별로 차감한다. 요청·실패·테스트 결제는 성공 결제액에 포함하지 않는다. 결제액은 결제사 수수료 차감 전이며, 결제사 입금액과 구분한다.\n\n대상 계약이 지정되면 해당 계약으로 확인된 결제만 포함한다. P1은 C1의 300,000원, P2는 C2의 200,000원이다. PX는 성공 결제 50,000원이지만 계약 연결이 없어 ‘온솔 두 계약’ 보고에서 제외한다. 따라서 전체 내보내기의 성공 결제 550,000원과 두 계약의 결제 500,000원을 구분한다.\n\n### §2. 서비스 계정과 활동\n\n서비스 계정은 로그인과 이용 권한의 단위다. 계정 개수만으로 사람이나 법인 수를 알 수 없다. 이용 계정 지표는 질문에서 지정한 기간에 로그인 기록이 있고, 해당 사건시점에 계약 이용 권한이 유효한 계정 ID를 중복 제거한다.\n\n하나의 계정에 권한 이력이 여러 줄이어도 계정 수는 중복 계산하지 않는다. 금액 집계에 계정 행을 펼쳐 붙이지 않는다.\n\n### §3. 환불 요청과 미확인 상태 코드\n\n환불 요청액과 완료액은 별도다. 요청시각·요청금액·대상 서비스 기간을 보존하고, 원결제 참조와 실제 완료 증빙을 별도로 확인한다. 미래 서비스 취소는 이미 제공된 달의 실적을 삭제했다는 뜻이 아니다.\n\n운영 코드 `DONE`과 결제사 코드 `SUCCEEDED`에 대한 업무 의미·증빙 조건은 문서에 확정되지 않았다. 이름을 번역해 완료라고 판단하지 않는다. 운영 처리시각이나 재무의 정산 차감만으로 고객 환불 완료시점을 대신하지 않는다. 결제운영 담당자에게 코드 의미·완료 증빙·적용 시스템을 확인한다.\n\n### 자료 부록: 10/7 데이터 스냅샷 · 정책 v1 원문과 별도\n\n아래 행들은 2026-10-07 16:00에 확보한 데이터다. 정책 v1의 9/30 작성 시점에는 없던 사건을 포함한다. v1을 적용한 첫 질문은 10/7 16:05, 보완 v2 발행은 17:00, 후속 질문은 18:00으로 설정한다. 두 질문에 같은 스냅샷을 사용하므로 결과 차이는 추가 거래 유입이 아니라 확인된 상태 정의에서 생긴다.\n\n| 권한 행 | 계정 | 계약 | 유효 기간 | 스냅샷에 포함된 10월 로그인 |\n|---|---|---|---|---|\n| A1 | U1 | C1 | 9/1~12/1 | 10/4 |\n| A2 | U2 | C1 | 9/1~12/1 | 10/5 |\n| A3 | U3 | C2 | 10/1~12/1 | 10/2 |\n| A4 | U4 | C2 | 10/1~12/1 | 10/3 |\n\nR1은 9/28에 C1의 11월 서비스 대가 100,000원 환불을 요청했다. 운영 기록은 10/2 `DONE`, 결제사 이벤트는 10/3 `SUCCEEDED`·P1·100,000원이다. 이 스냅샷을 v1으로 읽으면 상태 정의가 미확인이다. R2는 10/5에 C2의 11월 일부 서비스 대가 50,000원을 요청했고, `PENDING`이며 완료시각이 없다.",
      "section_contents": {
        "1": "§1. 결제 운영 보고\n결제 운영 보고는 기간 내 성공 결제액을 결제 ID별로 합하고, 같은 기간에 완료가 확인된 환불액을 환불 ID별로 차감한다. 요청·실패·테스트 결제는 성공 결제액에 포함하지 않는다. 결제액은 결제사 수수료 차감 전이며, 결제사 입금액과 구분한다.\n\n대상 계약이 지정되면 해당 계약으로 확인된 결제만 포함한다. P1은 C1의 300,000원, P2는 C2의 200,000원이다. PX는 성공 결제 50,000원이지만 계약 연결이 없어 ‘온솔 두 계약’ 보고에서 제외한다. 따라서 전체 내보내기의 성공 결제 550,000원과 두 계약의 결제 500,000원을 구분한다.",
        "2": "§2. 서비스 계정과 활동\n서비스 계정은 로그인과 이용 권한의 단위다. 계정 개수만으로 사람이나 법인 수를 알 수 없다. 이용 계정 지표는 질문에서 지정한 기간에 로그인 기록이 있고, 해당 사건시점에 계약 이용 권한이 유효한 계정 ID를 중복 제거한다.\n\n하나의 계정에 권한 이력이 여러 줄이어도 계정 수는 중복 계산하지 않는다. 금액 집계에 계정 행을 펼쳐 붙이지 않는다.",
        "3": "§3. 환불 요청과 미확인 상태 코드\n환불 요청액과 완료액은 별도다. 요청시각·요청금액·대상 서비스 기간을 보존하고, 원결제 참조와 실제 완료 증빙을 별도로 확인한다. 미래 서비스 취소는 이미 제공된 달의 실적을 삭제했다는 뜻이 아니다.\n\n운영 코드 `DONE`과 결제사 코드 `SUCCEEDED`에 대한 업무 의미·증빙 조건은 문서에 확정되지 않았다. 이름을 번역해 완료라고 판단하지 않는다. 운영 처리시각이나 재무의 정산 차감만으로 고객 환불 완료시점을 대신하지 않는다. 결제운영 담당자에게 코드 의미·완료 증빙·적용 시스템을 확인한다."
      },
      "validFrom": "2026-09-01",
      "validTo": "2026-11-30",
      "valid_to_exclusive": "2026-12-01"
    },
    {
      "id": "OPS-01",
      "version": 2,
      "title": "결제·이용 계정·환불 운영 기록",
      "owner": "서비스운영팀",
      "sections": [
        "1",
        "2",
        "3"
      ],
      "changed_sections": [
        "3"
      ],
      "inherited_sections_from_version_1": [
        "1",
        "2"
      ],
      "published_at_in_scenario": "2026-10-07T17:00:00+09:00",
      "content": "§1. 결제 운영 보고\n결제 운영 보고는 기간 내 성공 결제액을 결제 ID별로 합하고, 같은 기간에 완료가 확인된 환불액을 환불 ID별로 차감한다. 요청·실패·테스트 결제는 성공 결제액에 포함하지 않는다. 결제액은 결제사 수수료 차감 전이며, 결제사 입금액과 구분한다.\n\n대상 계약이 지정되면 해당 계약으로 확인된 결제만 포함한다. P1은 C1의 300,000원, P2는 C2의 200,000원이다. PX는 성공 결제 50,000원이지만 계약 연결이 없어 ‘온솔 두 계약’ 보고에서 제외한다. 따라서 전체 내보내기의 성공 결제 550,000원과 두 계약의 결제 500,000원을 구분한다.\n\n§2. 서비스 계정과 활동\n서비스 계정은 로그인과 이용 권한의 단위다. 계정 개수만으로 사람이나 법인 수를 알 수 없다. 이용 계정 지표는 질문에서 지정한 기간에 로그인 기록이 있고, 해당 사건시점에 계약 이용 권한이 유효한 계정 ID를 중복 제거한다.\n\n하나의 계정에 권한 이력이 여러 줄이어도 계정 수는 중복 계산하지 않는다. 금액 집계에 계정 행을 펼쳐 붙이지 않는다.\n\n§3. 환불 완료 코드와 확인 조건\n- 운영 코드 `DONE`은 결제사에 환불 처리를 접수했다는 뜻이다. 고객 환불 완료로 사용하지 않는다.\n- 이 연동의 결제사 이벤트 `SUCCEEDED`는 환불 완료를 뜻한다. 원결제 참조, 고유 환불 ID, 실제 완료금액, 완료시각을 함께 확인해야 한다. 같은 ID의 재전송 이벤트를 중복 차감하지 않는다.\n- `PENDING`이나 완료시각 없는 요청은 완료액에서 제외한다. 금액·원결제가 충돌하면 해당 건은 확인 필요로 남긴다.\n- 완료 이벤트는 환불 완료월, 정산 차감은 재무의 실제 차감월에 반영한다. 요청월을 완료월로 대신하지 않는다.\n- 이 정의는 9/1 이후 같은 결제사 연동에 적용됨을 담당자가 확인한 것으로 설정한다. 다른 결제사·기간에 자동 확대하지 않는다.\n\n시연 확인 근거 `RV-OPS-2`: R1의 원결제 P1·100,000원·10/3 완료시각 및 코드 정의를 대조. 결과: R1은 10/3 완료, R2는 대기. 이 근거가 `KB-REF-01 v2` 발행 사유가 된다. 과거 답은 보존하고 재계산 여부를 따로 기록한다.",
      "section_contents": {
        "1": "§1. 결제 운영 보고\n결제 운영 보고는 기간 내 성공 결제액을 결제 ID별로 합하고, 같은 기간에 완료가 확인된 환불액을 환불 ID별로 차감한다. 요청·실패·테스트 결제는 성공 결제액에 포함하지 않는다. 결제액은 결제사 수수료 차감 전이며, 결제사 입금액과 구분한다.\n\n대상 계약이 지정되면 해당 계약으로 확인된 결제만 포함한다. P1은 C1의 300,000원, P2는 C2의 200,000원이다. PX는 성공 결제 50,000원이지만 계약 연결이 없어 ‘온솔 두 계약’ 보고에서 제외한다. 따라서 전체 내보내기의 성공 결제 550,000원과 두 계약의 결제 500,000원을 구분한다.",
        "2": "§2. 서비스 계정과 활동\n서비스 계정은 로그인과 이용 권한의 단위다. 계정 개수만으로 사람이나 법인 수를 알 수 없다. 이용 계정 지표는 질문에서 지정한 기간에 로그인 기록이 있고, 해당 사건시점에 계약 이용 권한이 유효한 계정 ID를 중복 제거한다.\n\n하나의 계정에 권한 이력이 여러 줄이어도 계정 수는 중복 계산하지 않는다. 금액 집계에 계정 행을 펼쳐 붙이지 않는다.",
        "3": "§3. 환불 완료 코드와 확인 조건\n- 운영 코드 `DONE`은 결제사에 환불 처리를 접수했다는 뜻이다. 고객 환불 완료로 사용하지 않는다.\n- 이 연동의 결제사 이벤트 `SUCCEEDED`는 환불 완료를 뜻한다. 원결제 참조, 고유 환불 ID, 실제 완료금액, 완료시각을 함께 확인해야 한다. 같은 ID의 재전송 이벤트를 중복 차감하지 않는다.\n- `PENDING`이나 완료시각 없는 요청은 완료액에서 제외한다. 금액·원결제가 충돌하면 해당 건은 확인 필요로 남긴다.\n- 완료 이벤트는 환불 완료월, 정산 차감은 재무의 실제 차감월에 반영한다. 요청월을 완료월로 대신하지 않는다.\n- 이 정의는 9/1 이후 같은 결제사 연동에 적용됨을 담당자가 확인한 것으로 설정한다. 다른 결제사·기간에 자동 확대하지 않는다.\n\n시연 확인 근거 `RV-OPS-2`: R1의 원결제 P1·100,000원·10/3 완료시각 및 코드 정의를 대조. 결과: R1은 10/3 완료, R2는 대기. 이 근거가 `KB-REF-01 v2` 발행 사유가 된다. 과거 답은 보존하고 재계산 여부를 따로 기록한다."
      },
      "validFrom": "2026-09-01",
      "validTo": "2026-11-30",
      "valid_to_exclusive": "2026-12-01"
    },
    {
      "id": "FIN-01",
      "version": 1,
      "title": "제공 실적과 현금 정산 대사",
      "owner": "재무팀",
      "sections": [
        "1",
        "2",
        "3"
      ],
      "content": "FIN-01 v1 · 제공 실적과 현금 정산 대사\n\n출처 형태: 재무팀 월별 제공 실적표·결제사 정산 대사표. 책임 부서: 재무팀. 시연 기록상 2026-10-07 확인. 아래 규칙은 두 정액 계약에 한한 합의된 업무 정의이며 일반적인 회계 처리 기준을 주장하지 않는다.\n\n### §1. 서비스 제공 실적\n\n이 사례에서는 각 월 제공이 완료되고 확인된 서비스 대가를 해당 월 제공 실적으로 기록한다. C1·C2의 월 서비스 대가는 100,000원이다. 입금 또는 계약 서명만으로 제공 완료를 판단하지 않는다.\n\nN1은 C1의 9월 제공 완료 확인분 100,000원이다. C2는 10월 서비스 시작이므로 9월 제공 실적은 0원이다. 10월 7일 스냅샷에 10월 제공 완료 확인분은 없으므로 **10월 전체 실적을 0원으로 확정하거나 200,000원으로 예상 확정하지 않는다.**\n\nR1의 대상은 11월 미제공분이다. 이 사례에서는 그 환불로 9월 제공 확인분 N1을 지우지 않는다. 다른 환불 사유·부분 제공·특약은 별도 확인한다.\n\n### §2. 입금과 환불 정산\n\n입금 대사는 실제 입금일과 수수료 차감 후 금액을 사용한다. 지급 예정일은 실제 입금일이 아니다. 환불 차감은 정산표에 반영된 날의 금액으로 대사한다.\n\n| 정산 행 | 참조 | 실제 반영일 | 금액 | 구성 |\n|---|---|---|---:|---|\n| S1 | P1 | 9/3 | +291,000 | 결제 300,000 − 수수료 9,000 |\n| S2 | P2 | 10/2 | +194,000 | 결제 200,000 − 수수료 6,000 |\n| S3 | R1 | 10/6 | −100,000 | 환불 정산 차감. 이 사례에서는 수수료 조정 없음 |\n\n세 행은 서로 독립된 현금 반영 기록이다. S2가 이미 R1 환불을 차감한 순액이라는 가정으로 중복 차감하지 않는다. 10월 7일까지 누적 현금은 385,000원 = 결제 500,000 − 수수료 15,000 − 환불 100,000이다.\n\nPX의 정산 행은 제공되지 않았다. 이를 입금 0원 또는 입금 완료로 판단하지 않는다. 위 현금 대사는 확인된 두 계약에 한한다.\n\n### §3. 고객과 담당 확인 범위\n\n청구 고객 B1이 두 계약의 청구를 받더라도 계약 법인 E1·E2를 합치지 않는다. 청구 대상 수는 B1 하나, 서비스 중인 계약 법인은 E1·E2 둘로 설명한다. 재무는 정산 행과 청구 관계를 확인하며 서비스 계정의 실제 사용이나 결제사 완료 코드 의미는 운영 담당자의 근거를 참조한다.",
      "section_contents": {
        "1": "§1. 서비스 제공 실적\n이 사례에서는 각 월 제공이 완료되고 확인된 서비스 대가를 해당 월 제공 실적으로 기록한다. C1·C2의 월 서비스 대가는 100,000원이다. 입금 또는 계약 서명만으로 제공 완료를 판단하지 않는다.\n\nN1은 C1의 9월 제공 완료 확인분 100,000원이다. C2는 10월 서비스 시작이므로 9월 제공 실적은 0원이다. 10월 7일 스냅샷에 10월 제공 완료 확인분은 없으므로 **10월 전체 실적을 0원으로 확정하거나 200,000원으로 예상 확정하지 않는다.**\n\nR1의 대상은 11월 미제공분이다. 이 사례에서는 그 환불로 9월 제공 확인분 N1을 지우지 않는다. 다른 환불 사유·부분 제공·특약은 별도 확인한다.",
        "2": "§2. 입금과 환불 정산\n입금 대사는 실제 입금일과 수수료 차감 후 금액을 사용한다. 지급 예정일은 실제 입금일이 아니다. 환불 차감은 정산표에 반영된 날의 금액으로 대사한다.\n\n| 정산 행 | 참조 | 실제 반영일 | 금액 | 구성 |\n|---|---|---|---:|---|\n| S1 | P1 | 9/3 | +291,000 | 결제 300,000 − 수수료 9,000 |\n| S2 | P2 | 10/2 | +194,000 | 결제 200,000 − 수수료 6,000 |\n| S3 | R1 | 10/6 | −100,000 | 환불 정산 차감. 이 사례에서는 수수료 조정 없음 |\n\n세 행은 서로 독립된 현금 반영 기록이다. S2가 이미 R1 환불을 차감한 순액이라는 가정으로 중복 차감하지 않는다. 10월 7일까지 누적 현금은 385,000원 = 결제 500,000 − 수수료 15,000 − 환불 100,000이다.\n\nPX의 정산 행은 제공되지 않았다. 이를 입금 0원 또는 입금 완료로 판단하지 않는다. 위 현금 대사는 확인된 두 계약에 한한다.",
        "3": "§3. 고객과 담당 확인 범위\n청구 고객 B1이 두 계약의 청구를 받더라도 계약 법인 E1·E2를 합치지 않는다. 청구 대상 수는 B1 하나, 서비스 중인 계약 법인은 E1·E2 둘로 설명한다. 재무는 정산 행과 청구 관계를 확인하며 서비스 계정의 실제 사용이나 결제사 완료 코드 의미는 운영 담당자의 근거를 참조한다."
      },
      "validFrom": "2026-09-01",
      "validTo": "2026-11-30",
      "valid_to_exclusive": "2026-12-01"
    }
  ],
  "entities": [
    {
      "id": "E1",
      "label": "온솔제품",
      "kind": "contract_legal_entity"
    },
    {
      "id": "E2",
      "label": "온솔연구",
      "kind": "contract_legal_entity"
    },
    {
      "id": "B1",
      "label": "온솔본사",
      "kind": "billing_customer"
    }
  ],
  "contracts": [
    {
      "id": "C1",
      "legal_entity_id": "E1",
      "billing_customer_id": "B1",
      "buyer_account_id": "U1",
      "signed_at": "2026-09-01",
      "original_amount": 300000,
      "service_start": "2026-09-01",
      "service_end_exclusive": "2026-12-01",
      "monthly_amount": 100000,
      "source_ref": {
        "document_id": "SAL-01",
        "version": 1,
        "section": "1"
      }
    },
    {
      "id": "C2",
      "legal_entity_id": "E2",
      "billing_customer_id": "B1",
      "buyer_account_id": "U3",
      "signed_at": "2026-09-29",
      "original_amount": 200000,
      "service_start": "2026-10-01",
      "service_end_exclusive": "2026-12-01",
      "monthly_amount": 100000,
      "source_ref": {
        "document_id": "SAL-01",
        "version": 1,
        "section": "1"
      }
    }
  ],
  "account_memberships": [
    {
      "id": "A1",
      "account_id": "U1",
      "contract_id": "C1",
      "valid_from": "2026-09-01",
      "valid_to_exclusive": "2026-12-01",
      "login_at": "2026-10-04"
    },
    {
      "id": "A2",
      "account_id": "U2",
      "contract_id": "C1",
      "valid_from": "2026-09-01",
      "valid_to_exclusive": "2026-12-01",
      "login_at": "2026-10-05"
    },
    {
      "id": "A3",
      "account_id": "U3",
      "contract_id": "C2",
      "valid_from": "2026-10-01",
      "valid_to_exclusive": "2026-12-01",
      "login_at": "2026-10-02"
    },
    {
      "id": "A4",
      "account_id": "U4",
      "contract_id": "C2",
      "valid_from": "2026-10-01",
      "valid_to_exclusive": "2026-12-01",
      "login_at": "2026-10-03"
    }
  ],
  "payments": [
    {
      "id": "P1",
      "contract_id": "C1",
      "paid_at": "2026-09-01",
      "amount": 300000,
      "status": "succeeded",
      "is_test": false
    },
    {
      "id": "P2",
      "contract_id": "C2",
      "paid_at": "2026-09-30",
      "amount": 200000,
      "status": "succeeded",
      "is_test": false
    },
    {
      "id": "PX",
      "contract_id": null,
      "billing_customer_id": null,
      "display_name": "온솔",
      "paid_at": "2026-09-30",
      "amount": 50000,
      "status": "succeeded",
      "is_test": false
    }
  ],
  "refunds": [
    {
      "id": "R1",
      "payment_id": "P1",
      "requested_at": "2026-09-28",
      "requested_amount": 100000,
      "target_service_start": "2026-11-01",
      "target_service_end_exclusive": "2026-12-01",
      "operation_code": "DONE",
      "operation_at": "2026-10-02",
      "processor_code": "SUCCEEDED",
      "processor_event_id": "EV1",
      "processor_completed_at": "2026-10-03",
      "processor_completed_amount": 100000
    },
    {
      "id": "R2",
      "payment_id": "P2",
      "requested_at": "2026-10-05",
      "requested_amount": 50000,
      "target_service_start": "2026-11-01",
      "target_service_end_exclusive": "2026-12-01",
      "operation_code": "REQUESTED",
      "operation_at": "2026-10-05",
      "processor_code": "PENDING",
      "processor_event_id": "EV2",
      "processor_completed_at": null,
      "processor_completed_amount": null
    }
  ],
  "settlements": [
    {
      "id": "S1",
      "ref_type": "payment",
      "ref_id": "P1",
      "settled_at": "2026-09-03",
      "gross_amount": 300000,
      "fee_amount": 9000,
      "net_cash": 291000
    },
    {
      "id": "S2",
      "ref_type": "payment",
      "ref_id": "P2",
      "settled_at": "2026-10-02",
      "gross_amount": 200000,
      "fee_amount": 6000,
      "net_cash": 194000
    },
    {
      "id": "S3",
      "ref_type": "refund",
      "ref_id": "R1",
      "settled_at": "2026-10-06",
      "refund_deduction": 100000,
      "fee_adjustment": 0,
      "net_cash": -100000
    }
  ],
  "recognized_service": [
    {
      "id": "N1",
      "contract_id": "C1",
      "service_start": "2026-09-01",
      "service_end_exclusive": "2026-10-01",
      "confirmed_at": "2026-09-30",
      "recognized_month": "2026-09",
      "amount": 100000,
      "source_ref": {
        "document_id": "FIN-01",
        "version": 1,
        "section": "1"
      }
    }
  ],
  "link_records": [
    {
      "id": "L-C1-contracted_with",
      "version": 1,
      "relation": "contracted_with",
      "from": "C1",
      "to": "E1",
      "valid_from": "2026-09-01",
      "valid_to_exclusive": "2026-12-01",
      "cardinality": "many_to_one",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "SAL-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "C1"
      ],
      "owner": "영업운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-C1-billed_to",
      "version": 1,
      "relation": "billed_to",
      "from": "C1",
      "to": "B1",
      "valid_from": "2026-09-01",
      "valid_to_exclusive": "2026-12-01",
      "cardinality": "many_to_one",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "SAL-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "C1"
      ],
      "owner": "영업운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-C1-ordered_by",
      "version": 1,
      "relation": "ordered_by",
      "from": "C1",
      "to": "U1",
      "valid_from": "2026-09-01",
      "valid_to_exclusive": "2026-12-01",
      "cardinality": "many_to_one",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "SAL-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "C1"
      ],
      "owner": "영업운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-C2-contracted_with",
      "version": 1,
      "relation": "contracted_with",
      "from": "C2",
      "to": "E2",
      "valid_from": "2026-09-29",
      "valid_to_exclusive": "2026-12-01",
      "cardinality": "many_to_one",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "SAL-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "C2"
      ],
      "owner": "영업운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-C2-billed_to",
      "version": 1,
      "relation": "billed_to",
      "from": "C2",
      "to": "B1",
      "valid_from": "2026-09-29",
      "valid_to_exclusive": "2026-12-01",
      "cardinality": "many_to_one",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "SAL-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "C2"
      ],
      "owner": "영업운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-C2-ordered_by",
      "version": 1,
      "relation": "ordered_by",
      "from": "C2",
      "to": "U3",
      "valid_from": "2026-09-29",
      "valid_to_exclusive": "2026-12-01",
      "cardinality": "many_to_one",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "SAL-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "C2"
      ],
      "owner": "영업운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-A1",
      "version": 1,
      "relation": "authorized_for",
      "from": "U1",
      "to": "C1",
      "valid_from": "2026-09-01",
      "valid_to_exclusive": "2026-12-01",
      "cardinality": "many_to_many_temporal",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "OPS-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "A1"
      ],
      "owner": "서비스운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-A2",
      "version": 1,
      "relation": "authorized_for",
      "from": "U2",
      "to": "C1",
      "valid_from": "2026-09-01",
      "valid_to_exclusive": "2026-12-01",
      "cardinality": "many_to_many_temporal",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "OPS-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "A2"
      ],
      "owner": "서비스운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-A3",
      "version": 1,
      "relation": "authorized_for",
      "from": "U3",
      "to": "C2",
      "valid_from": "2026-10-01",
      "valid_to_exclusive": "2026-12-01",
      "cardinality": "many_to_many_temporal",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "OPS-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "A3"
      ],
      "owner": "서비스운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-A4",
      "version": 1,
      "relation": "authorized_for",
      "from": "U4",
      "to": "C2",
      "valid_from": "2026-10-01",
      "valid_to_exclusive": "2026-12-01",
      "cardinality": "many_to_many_temporal",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "OPS-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "A4"
      ],
      "owner": "서비스운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-P1",
      "version": 1,
      "relation": "pays_for",
      "from": "P1",
      "to": "C1",
      "valid_from": "2026-09-01",
      "valid_to_exclusive": null,
      "cardinality": "many_to_one_in_this_case",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "OPS-01",
        "version": 1,
        "section": "1"
      },
      "evidence_rows": [
        "P1",
        "C1"
      ],
      "owner": "서비스운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-P2",
      "version": 1,
      "relation": "pays_for",
      "from": "P2",
      "to": "C2",
      "valid_from": "2026-09-30",
      "valid_to_exclusive": null,
      "cardinality": "many_to_one_in_this_case",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "OPS-01",
        "version": 1,
        "section": "1"
      },
      "evidence_rows": [
        "P2",
        "C2"
      ],
      "owner": "서비스운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-R1",
      "version": 1,
      "relation": "refund_of",
      "from": "R1",
      "to": "P1",
      "valid_from": "2026-09-28",
      "valid_to_exclusive": null,
      "cardinality": "many_to_one",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "OPS-01",
        "version": 1,
        "section": "3"
      },
      "evidence_rows": [
        "R1",
        "P1"
      ],
      "owner": "서비스운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-R2",
      "version": 1,
      "relation": "refund_of",
      "from": "R2",
      "to": "P2",
      "valid_from": "2026-10-05",
      "valid_to_exclusive": null,
      "cardinality": "many_to_one",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "OPS-01",
        "version": 1,
        "section": "3"
      },
      "evidence_rows": [
        "R2",
        "P2"
      ],
      "owner": "서비스운영팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-S1",
      "version": 1,
      "relation": "cash_reflects",
      "from": "S1",
      "to": "P1",
      "valid_from": "2026-09-03",
      "valid_to_exclusive": null,
      "cardinality": "many_to_one",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "FIN-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "S1",
        "P1"
      ],
      "owner": "재무팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-S2",
      "version": 1,
      "relation": "cash_reflects",
      "from": "S2",
      "to": "P2",
      "valid_from": "2026-10-02",
      "valid_to_exclusive": null,
      "cardinality": "many_to_one",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "FIN-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "S2",
        "P2"
      ],
      "owner": "재무팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-S3",
      "version": 1,
      "relation": "cash_reflects",
      "from": "S3",
      "to": "R1",
      "valid_from": "2026-10-06",
      "valid_to_exclusive": null,
      "cardinality": "many_to_one",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "FIN-01",
        "version": 1,
        "section": "2"
      },
      "evidence_rows": [
        "S3",
        "R1"
      ],
      "owner": "재무팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-N1",
      "version": 1,
      "relation": "service_of",
      "from": "N1",
      "to": "C1",
      "valid_from": "2026-09-01",
      "valid_to_exclusive": "2026-10-01",
      "cardinality": "many_to_one",
      "state": "confirmed_in_scenario",
      "source_ref": {
        "document_id": "FIN-01",
        "version": 1,
        "section": "1"
      },
      "evidence_rows": [
        "N1",
        "C1"
      ],
      "owner": "재무팀",
      "reviewed_at_in_scenario": "2026-10-07T15:00:00+09:00"
    },
    {
      "id": "L-PX",
      "version": 1,
      "relation": "pays_for",
      "from": "PX",
      "to": null,
      "valid_from": null,
      "valid_to_exclusive": null,
      "state": "unconfirmed",
      "reason": "계약번호와 배분 근거 없음. 표시명만 같음",
      "owner": "영업운영팀",
      "source_ref": {
        "document_id": "SAL-01",
        "version": 1,
        "section": "3"
      },
      "evidence_rows": [
        "PX"
      ]
    }
  ],
  "knowledge_documents": [
    {
      "id": "KB-REV-01",
      "title": "보고 목적에 맞는 금액과 기간 선택",
      "topic": "매출",
      "owner": "사업운영",
      "versions": [
        {
          "version": 1,
          "status": "published_in_scenario",
          "valid_from": "2026-09-01",
          "valid_to_exclusive": "2026-12-01",
          "rules": [
            "질문에서 수주·결제·제공·입금 중 목적을 고른다.",
            "해당 목적의 날짜와 금액을 사용하며 확인된 계약만 포함한다.",
            "완료 환불 차감은 적용 가능한 KB-REF-01 버전을 함께 고정한다.",
            "10월 부분 자료로 10월 전체 제공 실적을 확정하지 않는다."
          ],
          "source_refs": [
            {
              "document_id": "SAL-01",
              "version": 1,
              "section": "1"
            },
            {
              "document_id": "SAL-01",
              "version": 1,
              "section": "3"
            },
            {
              "document_id": "OPS-01",
              "version": 1,
              "section": "1"
            },
            {
              "document_id": "FIN-01",
              "version": 1,
              "section": "1"
            },
            {
              "document_id": "FIN-01",
              "version": 1,
              "section": "2"
            }
          ],
          "dependency": "KB-REF-01: 계산 실행 시 적용 버전을 answer_basis에 고정"
        }
      ]
    },
    {
      "id": "KB-CUST-01",
      "title": "누구를 고객으로 세는지 선택",
      "topic": "고객",
      "owner": "고객분석",
      "versions": [
        {
          "version": 1,
          "status": "published_in_scenario",
          "valid_from": "2026-09-01",
          "valid_to_exclusive": "2026-12-01",
          "rules": [
            "로그인 계정·구매자 계정·계약 법인·청구 고객의 단위를 구분한다.",
            "사건시점에 유효한 관계를 사용한다.",
            "동일 청구처나 이름을 근거로 법인을 합치지 않는다.",
            "미확인 연결을 제외하고 범위·미확인 수를 함께 표시한다."
          ],
          "source_refs": [
            {
              "document_id": "SAL-01",
              "version": 1,
              "section": "2"
            },
            {
              "document_id": "OPS-01",
              "version": 1,
              "section": "2"
            },
            {
              "document_id": "FIN-01",
              "version": 1,
              "section": "3"
            }
          ]
        }
      ]
    },
    {
      "id": "KB-REF-01",
      "title": "고객 환불과 정산 반영 구분",
      "topic": "환불",
      "owner": "서비스운영팀",
      "versions": [
        {
          "version": 1,
          "status": "published_in_scenario",
          "valid_from": "2026-09-01",
          "valid_to_exclusive": "2026-12-01",
          "rules": [
            "요청·운영 처리·결제사 환불·정산 차감을 구분한다.",
            "DONE과 SUCCEEDED의 업무 의미가 미확인이라 고객 환불 완료 판정을 보류한다.",
            "미확인 완료액을 0원으로 단정하지 않는다."
          ],
          "source_refs": [
            {
              "document_id": "OPS-01",
              "version": 1,
              "section": "3"
            },
            {
              "document_id": "FIN-01",
              "version": 1,
              "section": "1"
            },
            {
              "document_id": "FIN-01",
              "version": 1,
              "section": "2"
            }
          ]
        },
        {
          "version": 2,
          "status": "published_in_scenario",
          "valid_from": "2026-09-01",
          "valid_to_exclusive": "2026-12-01",
          "published_at_in_scenario": "2026-10-07T17:00:00+09:00",
          "rules": [
            "DONE은 결제사 접수 완료다.",
            "SUCCEEDED이며 원결제·고유 환불ID·완료금액·완료시각이 확인된 건만 고객 환불 완료로 본다.",
            "PENDING은 완료액에서 제외한다.",
            "완료월과 정산 차감월을 별도로 보고한다.",
            "다른 결제사·기간에는 이 정의를 자동 적용하지 않는다."
          ],
          "source_refs": [
            {
              "document_id": "OPS-01",
              "version": 2,
              "section": "3"
            },
            {
              "document_id": "FIN-01",
              "version": 1,
              "section": "1"
            },
            {
              "document_id": "FIN-01",
              "version": 1,
              "section": "2"
            }
          ],
          "review_id": "RV-OPS-2",
          "resolved_comment_ids": [
            "CM1"
          ]
        }
      ]
    }
  ],
  "correction": {
    "comment": {
      "id": "CM1",
      "document_id": "KB-REF-01",
      "version": 1,
      "target_row_id": "R1",
      "body": "운영 화면의 완료가 결제사 접수라는 설명을 들었습니다. 고객 환불 완료는 무엇으로 확인하나요?"
    },
    "review": {
      "id": "RV-OPS-2",
      "actor_role": "서비스운영팀 결제운영 담당",
      "real_person": false,
      "confirmed_at_in_scenario": "2026-10-07T17:00:00+09:00",
      "source_ref": {
        "document_id": "OPS-01",
        "version": 2,
        "section": "3"
      },
      "evidence_rows": [
        "R1",
        "P1"
      ],
      "applicability": "2026-09-01 이후 같은 연동",
      "decision": "상태 정의와 완료 증빙 조건을 KB-REF-01 v2에 반영"
    },
    "effects": {
      "comment_only": "답변 기준 유지",
      "after_publish": "다음 조회부터 적용 가능한 v2 사용",
      "historical_answer": "v1과 그 근거를 보존"
    }
  },
  "expected_results": {
    "scope": {
      "contract_ids": [
        "C1",
        "C2"
      ],
      "excluded_payment_ids": [
        "PX"
      ],
      "snapshot_id": "SNAP-01"
    },
    "september": {
      "signed_original_amount": 500000,
      "paid_amount": 500000,
      "recognized_service_amount": 100000,
      "net_cash": 291000,
      "completed_refund_amount_v2": 0
    },
    "customer_at_2026_10_07": {
      "login_period": [
        "2026-10-01",
        "2026-10-08"
      ],
      "active_login_accounts": 4,
      "buyer_accounts": 2,
      "active_contract_legal_entities": 2,
      "billing_customers": 1
    },
    "refund_same_snapshot": {
      "using_v1": {
        "R1": "completion_unconfirmed",
        "completion_amount": null
      },
      "using_v2": {
        "R1": "completed",
        "R1_completed_at": "2026-10-03",
        "R2": "pending",
        "completion_amount": 100000
      }
    },
    "october_to_snapshot": {
      "paid_amount": 0,
      "completed_refund_amount_v2": 100000,
      "net_payment_amount_v2": -100000,
      "net_cash": 94000,
      "full_month_recognized_service_amount": null
    },
    "reconciliation": {
      "known_contract_payments": 500000,
      "fees": 15000,
      "completed_refund": 100000,
      "cumulative_cash": 385000
    },
    "unlinked": {
      "payment_id": "PX",
      "amount": 50000,
      "candidate_display_name": "온솔",
      "contract_id": null,
      "settlement_unknown": true
    },
    "answer_basis": {
      "snapshot_id": "SNAP-01",
      "revenue": [
        {
          "id": "KB-REV-01",
          "version": 1
        },
        {
          "id": "KB-REF-01",
          "version": 2
        }
      ],
      "customer": [
        {
          "id": "KB-CUST-01",
          "version": 1
        }
      ],
      "refund_after": [
        {
          "id": "KB-REF-01",
          "version": 2
        }
      ],
      "refund_before": [
        {
          "id": "KB-REF-01",
          "version": 1
        }
      ],
      "relationship_versions": [
        {
          "id": "L-C1-contracted_with",
          "version": 1
        },
        {
          "id": "L-C1-billed_to",
          "version": 1
        },
        {
          "id": "L-C1-ordered_by",
          "version": 1
        },
        {
          "id": "L-C2-contracted_with",
          "version": 1
        },
        {
          "id": "L-C2-billed_to",
          "version": 1
        },
        {
          "id": "L-C2-ordered_by",
          "version": 1
        },
        {
          "id": "L-A1",
          "version": 1
        },
        {
          "id": "L-A2",
          "version": 1
        },
        {
          "id": "L-A3",
          "version": 1
        },
        {
          "id": "L-A4",
          "version": 1
        },
        {
          "id": "L-P1",
          "version": 1
        },
        {
          "id": "L-P2",
          "version": 1
        },
        {
          "id": "L-R1",
          "version": 1
        },
        {
          "id": "L-R2",
          "version": 1
        },
        {
          "id": "L-S1",
          "version": 1
        },
        {
          "id": "L-S2",
          "version": 1
        },
        {
          "id": "L-S3",
          "version": 1
        },
        {
          "id": "L-N1",
          "version": 1
        },
        {
          "id": "L-PX",
          "version": 1
        }
      ]
    }
  },
  "source_bundle_content": "# 검토용 부서 문서 3종\n\n개인정보 없는 합성 회사·계약·정책이다. 실제 조직 문서나 승인 결과가 아니다. 문서 안의 ‘담당자 확인’은 제안된 시연에서의 역할과 사건을 정의한다. 실제 확인을 받았다는 뜻이 아니다. [구성안](./구성안.md)의 원문 근거이며, 행 데이터는 [예시데이터.json](./예시데이터.json)에 있다.\n\n세 문서의 공통 범위는 원화 정액 업무용 서비스, 계약 C1·C2다. 서비스 대가만 포함하고 세금은 생략한다. 금액은 원, 시각은 한국시간이다. 정책 유효 범위는 2026-09-01 이상 2026-12-01 미만이다. 사례 조회 시점은 2026-10-07 18:00이다. 원문 최초판을 교체하지 않고 OPS-01의 보완판을 함께 제시한다.\n\n## SAL-01 v1 · 영업의 계약 실적과 고객 연결 기준\n\n출처 형태: 영업운영팀 계약 관리 문서와 계약 대장. 책임 부서: 영업운영팀. 시연 기록상 2026-09-30 확인. 원계약 최초 서명 실적과 후속 변경 실적을 분리한다.\n\n### §1. 월간 수주 실적\n\n월간 수주 실적은 그 달 처음 서명한 계약의 서비스 대가를 계약 단위로 합한다. 견적·미서명·테스트 계약은 제외한다. 결제일이나 은행 입금일로 최초 서명월을 옮기지 않는다. 이후 취소·감액은 변경 이력에 따로 기록한다. 이 수주 실적은 현재 잔여 계약가치나 해당 월 제공 실적을 뜻하지 않는다.\n\n계약 C1은 9월 1일 300,000원, C2는 9월 29일 200,000원에 처음 서명했다. 따라서 두 계약의 9월 최초 수주금액은 500,000원이다. 현재 남은 계약가치를 묻는 경우에는 별도 변경 대장을 확인해야 한다.\n\n### §2. 계약 상대, 주문 주체, 청구 고객\n\n계약 고객 현황은 기준시점에 서비스가 유효한 계약의 법인 식별자를 중복 제거한다. 구매자 계정은 주문을 제출한 계정이다. 청구 고객은 청구서를 받는 주체다. 세 역할을 같은 고객번호로 강제 치환하지 않는다.\n\n| 계약대장 행 | 계약 | 계약 상대 | 주문 주체 | 청구 고객 | 관계 근거 |\n|---|---|---|---|---|---|\n| C1 | C1 | E1 · 온솔제품 | U1 | B1 · 온솔본사 | 계약 C1의 계약 상대·청구 지정란 |\n| C2 | C2 | E2 · 온솔연구 | U3 | B1 · 온솔본사 | 계약 C2의 계약 상대·청구 지정란 |\n\n위 두 계약의 서비스 기간은 각각 9/1~12/1, 10/1~12/1이다. 계약 상대·청구처·주문 주체 관계는 각각 서명일인 9/1, 9/29부터 유효하다. 서비스 이용 권한은 서비스 시작일부터 유효하므로 두 시점을 혼동하지 않는다. 향후 청구처 변경은 유효 기간이 있는 새 관계로 남긴다. 계열사 이름이나 청구처가 같다는 이유로 E1·E2를 하나의 법인으로 합치지 않는다.\n\n### §3. 연결이 없는 기록\n\n결제 자료의 계약번호를 계약 대장과 대조한다. 계약번호가 없거나 두 계약 이상을 가리키면 영업운영팀이 주문 근거를 확인한다. `PX`는 결제 표시명 ‘온솔’만 있으므로 C1·C2 어느 쪽에도 연결하지 않는다. 추후 배분 근거를 받기 전까지 50,000원을 두 계약 실적에 더하지 않는다.\n\n## OPS-01 v1 · 결제·이용 계정·환불 운영 기록\n\n출처 형태: 서비스운영팀 운영 문서와 이벤트 내보내기. 책임 부서: 서비스운영팀. 최초판은 2026-09-30 기준. 아래 §1~§3은 정책 원문이고, 뒤의 ‘10/7 데이터 부록’은 별도 스냅샷이다. 정책 v1이 이후 사건을 포함하고 있었다는 뜻이 아니다.\n\n### §1. 결제 운영 보고\n\n결제 운영 보고는 기간 내 성공 결제액을 결제 ID별로 합하고, 같은 기간에 완료가 확인된 환불액을 환불 ID별로 차감한다. 요청·실패·테스트 결제는 성공 결제액에 포함하지 않는다. 결제액은 결제사 수수료 차감 전이며, 결제사 입금액과 구분한다.\n\n대상 계약이 지정되면 해당 계약으로 확인된 결제만 포함한다. P1은 C1의 300,000원, P2는 C2의 200,000원이다. PX는 성공 결제 50,000원이지만 계약 연결이 없어 ‘온솔 두 계약’ 보고에서 제외한다. 따라서 전체 내보내기의 성공 결제 550,000원과 두 계약의 결제 500,000원을 구분한다.\n\n### §2. 서비스 계정과 활동\n\n서비스 계정은 로그인과 이용 권한의 단위다. 계정 개수만으로 사람이나 법인 수를 알 수 없다. 이용 계정 지표는 질문에서 지정한 기간에 로그인 기록이 있고, 해당 사건시점에 계약 이용 권한이 유효한 계정 ID를 중복 제거한다.\n\n하나의 계정에 권한 이력이 여러 줄이어도 계정 수는 중복 계산하지 않는다. 금액 집계에 계정 행을 펼쳐 붙이지 않는다.\n\n### §3. 환불 요청과 미확인 상태 코드\n\n환불 요청액과 완료액은 별도다. 요청시각·요청금액·대상 서비스 기간을 보존하고, 원결제 참조와 실제 완료 증빙을 별도로 확인한다. 미래 서비스 취소는 이미 제공된 달의 실적을 삭제했다는 뜻이 아니다.\n\n운영 코드 `DONE`과 결제사 코드 `SUCCEEDED`에 대한 업무 의미·증빙 조건은 문서에 확정되지 않았다. 이름을 번역해 완료라고 판단하지 않는다. 운영 처리시각이나 재무의 정산 차감만으로 고객 환불 완료시점을 대신하지 않는다. 결제운영 담당자에게 코드 의미·완료 증빙·적용 시스템을 확인한다.\n\n### 자료 부록: 10/7 데이터 스냅샷 · 정책 v1 원문과 별도\n\n아래 행들은 2026-10-07 16:00에 확보한 데이터다. 정책 v1의 9/30 작성 시점에는 없던 사건을 포함한다. v1을 적용한 첫 질문은 10/7 16:05, 보완 v2 발행은 17:00, 후속 질문은 18:00으로 설정한다. 두 질문에 같은 스냅샷을 사용하므로 결과 차이는 추가 거래 유입이 아니라 확인된 상태 정의에서 생긴다.\n\n| 권한 행 | 계정 | 계약 | 유효 기간 | 스냅샷에 포함된 10월 로그인 |\n|---|---|---|---|---|\n| A1 | U1 | C1 | 9/1~12/1 | 10/4 |\n| A2 | U2 | C1 | 9/1~12/1 | 10/5 |\n| A3 | U3 | C2 | 10/1~12/1 | 10/2 |\n| A4 | U4 | C2 | 10/1~12/1 | 10/3 |\n\nR1은 9/28에 C1의 11월 서비스 대가 100,000원 환불을 요청했다. 운영 기록은 10/2 `DONE`, 결제사 이벤트는 10/3 `SUCCEEDED`·P1·100,000원이다. 이 스냅샷을 v1으로 읽으면 상태 정의가 미확인이다. R2는 10/5에 C2의 11월 일부 서비스 대가 50,000원을 요청했고, `PENDING`이며 완료시각이 없다.\n\n## OPS-01 v2 · §3 보완 기록\n\n같은 문서의 보완판이다. 시연상 확인·발행 시각: 2026-10-07 17:00. 확인 역할: 서비스운영팀 결제운영 담당. §1·§2는 v1과 같고 §3에 다음 판단 규칙을 추가한다. 실제 외부 결제사 사양이 아닌 이 사례 안에서 합의한 정의다.\n\n### §3. 환불 완료 코드와 확인 조건\n\n- 운영 코드 `DONE`은 결제사에 환불 처리를 접수했다는 뜻이다. 고객 환불 완료로 사용하지 않는다.\n- 이 연동의 결제사 이벤트 `SUCCEEDED`는 환불 완료를 뜻한다. 원결제 참조, 고유 환불 ID, 실제 완료금액, 완료시각을 함께 확인해야 한다. 같은 ID의 재전송 이벤트를 중복 차감하지 않는다.\n- `PENDING`이나 완료시각 없는 요청은 완료액에서 제외한다. 금액·원결제가 충돌하면 해당 건은 확인 필요로 남긴다.\n- 완료 이벤트는 환불 완료월, 정산 차감은 재무의 실제 차감월에 반영한다. 요청월을 완료월로 대신하지 않는다.\n- 이 정의는 9/1 이후 같은 결제사 연동에 적용됨을 담당자가 확인한 것으로 설정한다. 다른 결제사·기간에 자동 확대하지 않는다.\n\n시연 확인 근거 `RV-OPS-2`: R1의 원결제 P1·100,000원·10/3 완료시각 및 코드 정의를 대조. 결과: R1은 10/3 완료, R2는 대기. 이 근거가 `KB-REF-01 v2` 발행 사유가 된다. 과거 답은 보존하고 재계산 여부를 따로 기록한다.\n\n## FIN-01 v1 · 제공 실적과 현금 정산 대사\n\n출처 형태: 재무팀 월별 제공 실적표·결제사 정산 대사표. 책임 부서: 재무팀. 시연 기록상 2026-10-07 확인. 아래 규칙은 두 정액 계약에 한한 합의된 업무 정의이며 일반적인 회계 처리 기준을 주장하지 않는다.\n\n### §1. 서비스 제공 실적\n\n이 사례에서는 각 월 제공이 완료되고 확인된 서비스 대가를 해당 월 제공 실적으로 기록한다. C1·C2의 월 서비스 대가는 100,000원이다. 입금 또는 계약 서명만으로 제공 완료를 판단하지 않는다.\n\nN1은 C1의 9월 제공 완료 확인분 100,000원이다. C2는 10월 서비스 시작이므로 9월 제공 실적은 0원이다. 10월 7일 스냅샷에 10월 제공 완료 확인분은 없으므로 **10월 전체 실적을 0원으로 확정하거나 200,000원으로 예상 확정하지 않는다.**\n\nR1의 대상은 11월 미제공분이다. 이 사례에서는 그 환불로 9월 제공 확인분 N1을 지우지 않는다. 다른 환불 사유·부분 제공·특약은 별도 확인한다.\n\n### §2. 입금과 환불 정산\n\n입금 대사는 실제 입금일과 수수료 차감 후 금액을 사용한다. 지급 예정일은 실제 입금일이 아니다. 환불 차감은 정산표에 반영된 날의 금액으로 대사한다.\n\n| 정산 행 | 참조 | 실제 반영일 | 금액 | 구성 |\n|---|---|---|---:|---|\n| S1 | P1 | 9/3 | +291,000 | 결제 300,000 − 수수료 9,000 |\n| S2 | P2 | 10/2 | +194,000 | 결제 200,000 − 수수료 6,000 |\n| S3 | R1 | 10/6 | −100,000 | 환불 정산 차감. 이 사례에서는 수수료 조정 없음 |\n\n세 행은 서로 독립된 현금 반영 기록이다. S2가 이미 R1 환불을 차감한 순액이라는 가정으로 중복 차감하지 않는다. 10월 7일까지 누적 현금은 385,000원 = 결제 500,000 − 수수료 15,000 − 환불 100,000이다.\n\nPX의 정산 행은 제공되지 않았다. 이를 입금 0원 또는 입금 완료로 판단하지 않는다. 위 현금 대사는 확인된 두 계약에 한한다.\n\n### §3. 고객과 담당 확인 범위\n\n청구 고객 B1이 두 계약의 청구를 받더라도 계약 법인 E1·E2를 합치지 않는다. 청구 대상 수는 B1 하나, 서비스 중인 계약 법인은 E1·E2 둘로 설명한다. 재무는 정산 행과 청구 관계를 확인하며 서비스 계정의 실제 사용이나 결제사 완료 코드 의미는 운영 담당자의 근거를 참조한다.\n\n## 이 원문을 사용하는 KB\n\n| KB | 판단 책임과 출처 |\n|---|---|\n| KB-REV-01 v1 · 보고 목적에 맞는 금액과 기간 선택 | 사업운영이 보고 목적 정리. 정의별 책임은 영업·운영·재무에 유지. SAL §1·§3, OPS §1, FIN §1·§2. 완료 환불 계산은 적용 가능한 KB-REF 버전도 명시 |\n| KB-CUST-01 v1 · 누구를 고객으로 세는지 선택 | 고객분석이 목적별 결과 정리. SAL §2, OPS §2, FIN §3과 유효한 관계 기록 사용 |\n| KB-REF-01 v1→v2 · 고객 환불과 정산 반영 구분 | 운영이 환불 완료 의미 확인, 재무가 차감 근거 확인. OPS §3 v1→v2, FIN §1·§2. v1의 미확인 상태를 v2에서 조건부 완료 판정으로 보완 |\n\n사업운영·고객분석의 편집 책임은 타 부서의 정의를 임의 승인할 권한과 다르다. 시연용 확인 상태는 실제 조직 검토 완료 상태와 구분해 표시한다.\n"
};
 if(typeof module!=='undefined'&&module.exports)module.exports=fixture;
 root.KnowHowGeneralWorkflowFixture=fixture;
})(typeof window!=='undefined'?window:globalThis);
