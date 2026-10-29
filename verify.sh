#!/usr/bin/env bash
# verify.sh — 검증 실행 + 기록. 같은 커맨드로 재통과하는 것이 원칙이다.
# 사용: ./verify.sh "<검증 커맨드>"   예) ./verify.sh "python3 -m unittest discover -s starter/data -v" / ./verify.sh "node --test starter/*.test.mjs"
# 기록: docs/VERIFICATION.md 에 시각·커맨드·결과를 append.
# 종료코드 3값: 0 PASS · 1 FAIL(위반) · 2 NOVERIFY(아무것도 검증 안 됨 — 테스트 0개·커맨드 없음).
#   「통과」가 사실은 아무것도 안 돌린 결과일 수 있다. 0개 실행은 통과로 치지 않는다.
set -u
CMD="${1:-}"
if [ -z "$CMD" ]; then
  echo "사용법: ./verify.sh \"<검증 커맨드>\"" >&2
  exit 2
fi
LOG_DIR="docs"
LOG="$LOG_DIR/VERIFICATION.md"
mkdir -p "$LOG_DIR"
[ -f "$LOG" ] || printf '# VERIFICATION — 검증 실행 기록\n\n| 시각 | 커맨드 | 결과 |\n|---|---|---|\n' > "$LOG"
TS="$(date '+%H:%M:%S')"
OUT="$(bash -c "$CMD" 2>&1)"
RC=$?
# 테스트 0개 신호 (unittest · pytest · node --test)
if echo "$OUT" | grep -Eq '^Ran 0 tests|collected 0 items|no tests ran|^# tests 0$|^ℹ tests 0$'; then
  RES="NOVERIFY"; RC=2
elif [ $RC -eq 0 ]; then RES="PASS"
else RES="FAIL($RC)"; RC=1
fi
printf '| %s | `%s` | **%s** |\n' "$TS" "$CMD" "$RES" >> "$LOG"
echo "$OUT" | tail -n 20
echo "── verify: $RES ($TS) → $LOG"
exit $RC
