# REFERENCES — 조립용 후보 (처음부터 만들지 않는다)

> 원본 조사: 준비 레포 `docs/research/2026-10-26-조립용-OSS-후보.md` (접근 2026-10-26, 레지스트리·공식 README 확인, 이 샌드박스에서는 미실행).
> 쓰기 전에 `bash tools/recon.sh` 의 인터넷 결과를 본다. 무엇을 골랐는지·왜인지는 `decision` 스킬로 한 줄.

## 인터넷이 막혔으면 (먼저)

- 반입 파일: 킷 밖 `vendor/` 를 같이 올렸다면 `vendor/` 에 Simple.css · Chart.js 4.6.1 · Grid.js 6.2.0(+mermaid.css) · PapaParse 5.7.0 이 있다 → `<script src="vendor/…">`.
- 표준 라이브러리 대체: 서버 `node:http`(→ `starter/shell/serve.mjs`) / `http.server` · CSV `starter/shell/csv.mjs` / `csv.DictReader`(→ `starter/data/table.py`) · 집계 `Map`·`reduce` / `collections.Counter`·`sqlite3` · LLM 호출 `fetch` / `urllib.request` · 테스트 `node --test` / `unittest` · 화면 확인 `starter/shell/smoke.mjs` · 차트 SVG 문자열 직접 생성.
- LLM API 가 막히면 규칙 기반 폴백 응답을 결과로 낸다(결정론 코어). LLM 호출부는 함수 하나로 격리해 테스트에서 목으로 바꾼다.

## 인터넷이 되면 — 유형별 1순위

| 필요 | 1순위 | 로드·설치 | 함정 |
|---|---|---|---|
| 디자인 키트 | SK하이닉스 design.css (사본) | `<link rel="stylesheet" href="vendor/skhynix/design.css">` | 반입 파일 `vendor/skhynix/design.css`(+DESIGN.md·components.html). `<main class="skh-dashboard">` 로 감싼다 |
| CSS | Simple.css 2.3.7 (MIT) | `https://cdn.jsdelivr.net/npm/simpledotcss@2.3.7/simple.min.css` | 패키지명 `simpledotcss`. Pico CSS 는 유지 종료 |
| 차트 | Chart.js 4.6.1 (MIT) | `https://cdn.jsdelivr.net/npm/chart.js@4.6.1/dist/chart.umd.min.js` | canvas 라 그림은 테스트 불가 → 차트 데이터 JSON 을 따로 테스트 |
| 표 | Grid.js 6.2.0 (MIT) | `https://cdn.jsdelivr.net/npm/gridjs@6.2.0/dist/gridjs.umd.js` + `theme/mermaid.min.css` | 수만 행엔 부적합 |
| 상호작용 | Alpine.js 3.17.5 또는 htmx 2.0.11 | jsDelivr | 둘 중 하나만 |
| API (Node) | Hono 4.13.14 | `npm i hono @hono/node-server` | `app.request()` 로 서버 없이 테스트 |
| API (Python) | FastAPI 0.162.0 | `pip install --user fastapi uvicorn httpx` | 파이썬 ≥3.10 |
| 데이터 (Python) | pandas 3.1.0 | `pip install --user pandas` | 파이썬 ≥3.11. 아니면 `starter/data/table.py` |
| 데이터 (JS) | PapaParse 5.7.0 · SheetJS(xlsx) | `npm i papaparse` · `https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz` | npm `xlsx` 0.18.5 는 구버전. CP949 CSV 주의 |
| LLM | openai SDK — Node 7.43.0 / Python 3.37.0 | `npm i openai zod` / `pip install --user openai pydantic` | 모델·키·`OPENAI_BASE_URL` 은 대회 안내대로. 출력은 스키마 검증 후 사용 |
| 테스트 | `node --test` · pytest 9.1.1 · cheerio(HTML 검증) | 내장 / `pip install --user pytest` / `npm i -D cheerio` | Playwright 는 브라우저 다운로드가 필요해 마지막 수단 |

## 공개 스킬 런타임 반입 (분석형 과제일 때만)
- `git clone --depth 1 https://github.com/openai/plugins.git /tmp/plugins` 뒤 `data-analytics` 플러그인의 `validate-data`·`analyze-data-quality` 스킬 SKILL.md 를 **읽어서** 절차만 따른다.
- 복사·커밋 금지 — plugin.json 이 `license: Proprietary` 라 우리 레포에 넣지 않는다(근거 `docs/research/2026-10-27-공개-스킬-MCP-후보.md`).
- 빌드형이면 이 절을 쓰지 않는다. 도구를 켰으면 DECISIONS 에 이유 한 줄.
