#!/usr/bin/env bash
# setup.sh — 클론한 하네스를 작업 공간에 합친다. 에이전트가 README 「세팅」 절대로 실행한다.
# 사용: (작업 공간에서) bash probe-harness/setup.sh [작업공간]
#   작업공간 기본값 = 현재 폴더. 클론 폴더 안에서 실행했으면 그 부모.
# 규칙: 과제가 준 파일은 덮어쓰지 않는다. AGENTS.md 만 예외 — 우리 것 + 원래 내용을 맨 끝 절에 붙인다.
set -eu
SRC="$(cd "$(dirname "$0")" && pwd)"
TGT="${1:-$PWD}"
TGT="$(cd "$TGT" && pwd)"
[ "$TGT" = "$SRC" ] && TGT="$(dirname "$SRC")"
[ "$TGT" = "$SRC" ] && { echo "작업 공간과 클론 폴더가 같다 — 인자로 작업 공간을 넘겨라" >&2; exit 1; }
cd "$TGT"

# 0. 과제 파일 목록 — 병합 전에 찍어 둔다(클론 폴더·.git 제외, 이름·크기만)
TASK_FILES="$(find . -mindepth 1 -maxdepth 2 -not -path './.git*' -not -path "./$(basename "$SRC")*" -type f -printf '%P(%s B) ' 2>/dev/null | head -c 600)"

KEPT=""
merge() {  # $1 = SRC 기준 상대 경로
  local rel="$1"
  if [ -d "$SRC/$rel" ]; then
    mkdir -p "$rel"
    local c; for c in "$SRC/$rel"/* "$SRC/$rel"/.[!.]*; do if [ -e "$c" ]; then merge "$rel/$(basename "$c")"; fi; done
  elif [ -e "$rel" ] && [ -s "$rel" ]; then
    KEPT="$KEPT $rel"
  else
    cp "$SRC/$rel" "$rel"
  fi
}

# 1. AGENTS.md — 과제가 준 내용이 있으면 우리 것 뒤에 붙인다
if [ -s AGENTS.md ] && ! cmp -s AGENTS.md "$SRC/AGENTS.md"; then
  ORIG="$(cat AGENTS.md)"
  { cat "$SRC/AGENTS.md"; printf '\n## 과제 환경이 준 원래 지침 (충돌하면 이쪽이 우선)\n\n%s\n' "$ORIG"; } > AGENTS.md
  echo "AGENTS.md: 과제 원래 지침을 맨 끝 절에 붙였다"
else
  cp "$SRC/AGENTS.md" AGENTS.md
fi

# 2. 나머지 — README.md(과제 원문 자리)·.git·이 스크립트는 건너뛴다
for c in "$SRC"/* "$SRC"/.[!.]*; do
  [ -e "$c" ] || continue
  b="$(basename "$c")"
  case "$b" in .git|README.md|setup.sh|AGENTS.md) continue;; esac
  merge "$b"
done
if [ -n "$KEPT" ]; then echo "보존(과제 파일, 안 덮음):$KEPT"; fi
chmod +x verify.sh tools/recon.sh

# 3. 정찰·복원 검증
bash tools/recon.sh > docs/RECON.txt 2>&1 || true
PY="$(command -v python3 || command -v python || true)"
V=""
if [ -n "$PY" ]; then if ./verify.sh "$PY -m unittest discover -s starter/data" >/dev/null 2>&1; then V="$V python:PASS"; else V="$V python:FAIL"; fi; fi
if command -v node >/dev/null 2>&1; then if ./verify.sh "node --test starter/shell/csv.test.mjs starter/shell/smoke.test.mjs" >/dev/null 2>&1; then V="$V node:PASS"; else V="$V node:FAIL"; fi; fi

# 3b. 시간 앵커 — 과제 타이머는 10:00 KST 시작·180분이라 종료 13:00 고정. 화면과 다르면 PROBE_END=HH:MM 으로 다시 돌리거나 오케가 고친다.
END="${PROBE_END:-13:00}"
EM=$(( 10#${END%%:*} * 60 + 10#${END##*:} ))
at() { local m=$(( EM - $1 )); printf '%02d:%02d' $(( m / 60 )) $(( m % 60 )); }
ANCHOR="종료 $END KST · 세팅·브리핑 끝 $(at 165) · 문제 확정 $(at 135) · 방향 결정·PLAN $(at 115) · 설계 확정·브리프 $(at 95) · 구현 끝 $(at 50) · 신규 기능 금지 $(at 25) · 예상 문제 $(at 20) · 사용자 읽기 $(at 10) · 확정 $(at 5) — 안내, 지키는 선은 신규 기능 금지·확정"
if [ -f docs/PLAN.md ]; then
  PYW="$(command -v python3 || command -v python || true)"
  [ -n "$PYW" ] && "$PYW" - "$ANCHOR" <<'PY'
import sys, re
p = 'docs/PLAN.md'; s = open(p, encoding='utf-8').read()
s = re.sub(r'(## 시간 앵커\n)[^\n|]*\n', lambda m: m.group(1) + sys.argv[1] + ' (setup.sh 계산)\n', s, count=1)
open(p, 'w', encoding='utf-8').write(s)
PY
fi
# 4. 클론 폴더 정리 → git 첫 커밋 (git 신원이 없으면 이 저장소에만 익명 신원)
# 지우는 것은 작업 공간 안의 「클론」(.git 있음)뿐 — 정본 harness/ 같은 원본 폴더에서 돌렸으면 남긴다
if [ -d "$SRC/.git" ]; then
  case "$SRC" in "$TGT"/*) rm -rf "$SRC" ;; *) echo "클론 폴더가 작업 공간 밖이라 남겨 둔다: $SRC" ;; esac
else
  echo "클론이 아닌 폴더라 남겨 둔다: $SRC"
fi
[ -d .git ] || git init -q
git config user.name >/dev/null 2>&1 || git config user.name "probe"
git config user.email >/dev/null 2>&1 || git config user.email "probe@localhost"
git add -A 2>/dev/null
git commit -q -m "scaffold: 하네스 세팅" -m "probe-harness clone 후 setup.sh" || echo "커밋 없음(변경 없음)"

N="$(find .agents/skills -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"

NOW="$(TZ=KST-9 date +%H:%M)"

# 6. 환경 한 줄 — RECON 을 에이전트가 요약하지 않아도 되게
ENV_LINE="$(python3 --version 2>/dev/null || python --version 2>/dev/null || echo 'python 없음') · node $(node --version 2>/dev/null || echo 없음) · $(codex --version 2>/dev/null || echo 'codex ?') · 인터넷 $(grep -o 'pypi [0-9]*' docs/RECON.txt | head -1 || echo '?')"

cat <<REPORT
세팅 완료 보고 (setup.sh 가 만든 문장 — 에이전트는 그대로 전한다)
① 깐 것: 스킬 ${N}개 · 복원 검증${V:- (언어 없음)} · scaffold $(git rev-parse --short HEAD)
② 환경: ${ENV_LINE} (자세히 docs/RECON.txt)
③ 과제 파일: ${TASK_FILES:-(없음 — 과제 파일 위치를 사용자에게 묻는다)}
④ 시간(지금 ${NOW}): ${ANCHOR}
다음(에이전트): AGENTS.md 전체와 guides/CONTEST-BRIEF.md 를 읽고, 위 보고 ①~④ 를 그대로 사용자에게 전하라. 덧붙일 것은 모델·effort 한 줄뿐. 과제 README 는 읽지 않고 다른 문서도 만들지 않는다. 마지막 줄: 「다음 입력(오케): 과제 브리핑해줘」
REPORT
