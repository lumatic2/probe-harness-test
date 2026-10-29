#!/usr/bin/env bash
# shadcn 기반 한국어 운영 화면(바닐라 셸과 같은 기능: 페이지 6 · 위젯 18 · 도메인 설정 9종 + 켜는 페이지 5종: 일정 격자 #/schedule · 문서 검토 #/review · AI 기능 #/assist · CSV 올리기 #/import · 기준값 설정 #/settings — 도메인 설정에 해당 키가 있을 때만 · 헤더 버튼 옆 패널 AI 대화창 W17 — 설정에 chat 이 있을 때만)을 한 번에 세운다. 당일 화면의 기본 — npm 이 막히면 starter/shell 로.
# 사용: (작업 공간 루트에서) bash starter/shadcn/make.sh [폴더=web]   → 끝나면 cd web && npx vite   (0.0.0.0:3000, strictPort)
# 순서: vite 뼈대 → npm install → tailwind → 별칭 → shadcn init(+토큰 확인·1회 재시도) → dashboard-01 + 필요한 부품 → overlay/ + 도메인 복사 → SK 테마 → tsc + vite build
# 도메인 고르기: VITE_DOMAIN=education npx vite build (또는 주소 ?domain=education). 바꾸는 순서는 starter/DOMAIN.md
# overlay/server/ = /api/assist · /api/chat 의 AI 어댑터(OPENAI_API_KEY 가 있으면 OpenAI, 없으면 모의 응답) — vite.config.ts 가 불러 쓴다.
# overlay/ = 우리 소스만(키트엔 node_modules 를 못 넣는다). 앱 루트 기준 경로로 들어 있고 그대로 복사된다.
# 실측은 docs/prep/ 와 README 참고. 10분 안에 안 끝나면 멈추고 셸로 돌아간다. macOS 기본 bash 3.2 에서도 돈다.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="${1:-web}"
t0=$(date +%s); step() { echo "▶ [$(( $(date +%s)-t0 ))s] $*"; }
[ -d "$HERE/overlay/src" ] || { echo "overlay/ 가 없습니다: $HERE/overlay"; exit 1; }
step "Vite + React + TS 뼈대"; npm create vite@latest "$DIR" -- --template react-ts --no-interactive >/dev/null
cd "$DIR"
step "npm install"; npm install --no-audit --no-fund >/dev/null
step "Tailwind"; npm install --no-audit --no-fund tailwindcss @tailwindcss/vite >/dev/null; npm install --no-audit --no-fund -D @types/node >/dev/null
cp "$HERE/overlay/vite.config.ts" vite.config.ts
echo '@import "tailwindcss";' > src/index.css
node -e '
const fs=require("fs");
for (const f of ["tsconfig.json","tsconfig.app.json"]) {
  const d=JSON.parse(fs.readFileSync(f,"utf8").replace(/\/\*[\s\S]*?\*\//g,""));
  d.compilerOptions=Object.assign(d.compilerOptions||{},{paths:{"@/*":["./src/*"]}});
  // 도메인 설정(JSON)에서 온 값은 모양이 설정마다 달라 any — 콜백 인자 타입 표기를 강제하지 않는다(나머지 strict 는 그대로)
  if (f==="tsconfig.app.json") d.compilerOptions.noImplicitAny=false;
  fs.writeFileSync(f,JSON.stringify(d,null,2));
}'
# init 이 가끔(네트워크 흔들림) src/index.css 에 색 토큰(--primary 등)을 못 쓰고 끝난다(10-29 실측: 동시 실행 중 4번에 3번) → 토큰을 확인하고 없으면 init 부터 한 번 다시, 그래도 없으면 동봉 index.base.css.
install_ui() {
  npx -y shadcn@latest init -y "$@" -b radix -p nova --no-monorepo </dev/null >/dev/null
  # 부품은 한 번의 add 에 이름을 나열한다(dashboard-01 이 sidebar·sheet·select·table·tabs·chart·sonner·toggle-group·badge·checkbox 등을 함께 가져온다).
  npx -y shadcn@latest add dashboard-01 radio-group textarea progress alert switch collapsible -y </dev/null >/dev/null
}
has_tokens() { local t; for t in --background --foreground --primary --border --ring; do grep -q -- "$t:" src/index.css || { echo "  index.css 에 $t 없음"; return 1; }; done; }
step "shadcn init (preset nova, 비대화형) + dashboard-01 + 부품(radio-group textarea progress alert switch collapsible)"
install_ui
if ! has_tokens; then step "색 토큰이 없음 — shadcn init 을 한 번 다시 합니다"; install_ui --force; fi
# 그래도 없으면 키트에 동봉한 index.css(같은 레시피가 성공했을 때 만든 것 — 라이트·Pretendard 처리까지 된 본)로 갈아 끼운다. 부품 파일은 있어야 한다.
if ! has_tokens; then
  [ -f src/lib/utils.ts ] && [ -f src/components/ui/sidebar.tsx ] || { echo "shadcn init/add 가 부품을 만들지 못했습니다(네트워크). 다시 실행하거나 starter/shell 로 가세요."; exit 1; }
  step "색 토큰을 키트 동봉본(index.base.css)으로 채웁니다"; cp "$HERE/index.base.css" src/index.css; has_tokens || exit 1
fi
step "우리 소스(overlay) 덮어쓰기"; cp -R "$HERE/overlay/." .
# 도메인 설정·샘플 데이터·공통 계산 = starter/domains (바닐라 셸과 같은 파일). 생성기는 앱에 필요 없다. 어느 도메인을 띄울지는 VITE_DOMAIN 또는 src/domain/active.json.
mkdir -p src/domain; cp -R "$HERE/../domains/." src/domain/; rm -f src/domain/gen-sample.mjs src/domain/csv-to-sample.mjs src/domain/*.test.mjs src/domain/*/gen.mjs
rm -rf src/domain/*/import-samples   # CSV 올리기 시험용 파일(domains/alarm/import-samples)은 앱에 싣지 않는다
# Select 는 트리거 아래로 열려야 한다(원본 기본 item-aligned 는 트리거를 덮는다) — 기본 위치만 popper 로, 나머지 모양은 원본 그대로
sed -i.bak 's/position = "item-aligned"/position = "popper"/' src/components/ui/select.tsx && rm -f src/components/ui/select.tsx.bak
grep -q 'position = "popper"' src/components/ui/select.tsx || { echo "select.tsx 의 기본 위치를 popper 로 바꾸지 못했습니다"; exit 1; }
# 폰트 = Pretendard 고정(키트 동봉 woff2, 외부 CDN 없음). vendor/fonts 는 키트 원본에선 harness 위, 미러(공개 레포)에선 레포 루트 — 위로 올라가며 찾는다.
FONT=""; d="$HERE"
while [ "$d" != "/" ] && [ "$d" != "." ]; do [ -f "$d/vendor/fonts/PretendardVariable.woff2" ] && { FONT="$d/vendor/fonts/PretendardVariable.woff2"; break; }; d="$(dirname "$d")"; done
[ -n "$FONT" ] || { echo "vendor/fonts/PretendardVariable.woff2 를 찾지 못했습니다"; exit 1; }
mkdir -p src/assets; cp "$FONT" src/assets/PretendardVariable.woff2
# 라이트 모드만 — shadcn init 이 넣은 .dark 블록·dark 변형 선언을 지운다
node - <<'JS'
const fs = require("fs"); let s = fs.readFileSync("src/index.css", "utf8");
s = s.replace(/@custom-variant dark[^\n]*\n/g, "");
// 폰트: shadcn nova 의 Geist(@fontsource) 대신 Pretendard — @theme inline 의 리터럴을 바꿔야 font-sans 유틸리티가 따라온다
s = s.replace(/@import "@fontsource-variable\/geist";\n/, "");
s = s.replace(/--font-sans:\s*'Geist Variable', sans-serif;/, '--font-sans: "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;');
const i = s.search(/\n\.dark\s*\{/);
if (i >= 0) { let k = s.indexOf("{", i), n = 0; for (; k < s.length; k++) { if (s[k] === "{") n++; else if (s[k] === "}") { n--; if (!n) break; } } s = s.slice(0, i) + s.slice(k + 1); }
fs.writeFileSync("src/index.css", s);
JS
cat "$HERE/sk-theme.css" >> src/index.css
step "타입 검사 + 빌드"; npx tsc -b; npx vite build >/dev/null
step "끝 — cd $DIR && npx vite   (또는 npx vite preview) · Browser: PORT=3000, URL=/"
