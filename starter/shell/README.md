# 셸 — 과제 화면을 얹는 껍데기

빌드 없는 앱 프레임 하나(상단 바 · 공통 필터 · 왼쪽 메뉴 · 본문 · 하단 「이 화면의 한계」)와, 미리 만든 **위젯 18개 · 페이지 6개 + 설정으로 켜는 5개**. 당일엔 과제에 맞는 것만 골라 데이터를 연결한다. 디자인은 `vendor/skhynix/design.css` 한 곳의 토큰만 쓴다(여기서 색을 새로 만들지 않는다).

## 실행

```bash
node starter/shell/serve.mjs          # 0.0.0.0:3000, PORT=4000 node … 로 포트 변경
```

웹 IDE 의 **Browser** 도구에 `PORT=3000`, `URL=/` 를 준다. 의존성 설치 없음(Node 내장 모듈만).

화면 확인용 주소(해시):

| 주소 | 화면 |
|---|---|
| `/?domain=education#/dashboard?period=7d&group=설비엔지니어` | 대시보드 (`?domain=` 으로 alarm·education·inspection 을 고른다) |
| `/#/list` | 목록 (`&view=board` 로 보드 보기) |
| `/#/item/ALM-0399` | 상세 |
| `/#/form` | 입력·판정 |
| `/#/report` | 리포트 |
| `/#/widgets` | 위젯 18종 카탈로그 |
| `/?domain=inspection#/schedule` | 일정 격자 (설정에 `schedule` 이 있는 도메인만) |
| `/?domain=documents#/review` | 문서 검토 (`review`) |
| `/?domain=interview#/assist` | AI 피드백 (`assist`) |
| `/#/import` | CSV 올리기 (`import`) — 열 맞추기·검증·바꾸기/덧붙이기·되돌리기, 시험 파일은 `domains/alarm/import-samples/` |
| `/#/settings` | 기준값 설정 (`params`) — 규칙 값 저장·가정 비교, 계약 `starter/PARAMS.md` |

## 페이지 6개 + 설정으로 켜는 5개 — `pages/`

| 페이지 | 파일 | 언제 쓰나 |
|---|---|---|
| 대시보드 | `dashboard.js` | 현황·추세·구성·이상치를 한 화면에, 위젯을 누르면 목록·상세로 |
| 목록 | `list.js` | 정렬·검색·필터·상위 N 강조·여러 건 선택, 보드 보기 |
| 상세 | `item.js` | 한 건의 정보 + 근거(원 데이터 행·계산 규칙) + 변경 이력 |
| 입력·판정 | `form.js` | 값 입력, 승인/반려 + 사유 필수, 저장 즉시 반영 |
| 리포트 | `report.js` | 분석 요약 + 한계 문단 + 메모 복사·내려받기 + 조건 A/B 비교 |
| 위젯 모음 | `widgets.js` | 당일 어떤 위젯을 쓸지 고를 때 보는 카탈로그 |
| 일정 격자 | `schedule.js` | 자원×시간 격자, 충돌 표시, 끌기·폼 수정, 충돌 없을 때만 확정 저장, 일/주 전환 (도메인 설정 `schedule`) |
| 문서 검토 | `review.js` | 신뢰도·불확실 목록, 본문, 다중 태그, 사유 저장 (`review`) |
| AI 피드백 | `assist.js` | 질문·답변(녹음 선택)·고정 라벨 판정+근거 하이라이트+「AI 제안」 (`assist`) |
| CSV 올리기 | `import.js` | 사용자가 가진 CSV 를 열 맞추기·검증 뒤 바꾸기/덧붙이기, 되돌리기 (`import`) |
| 기준값 설정 | `settings.js` | 규칙 기준값을 화면에서 바꾸고 저장, 바꾸기 전/후 가정 비교 (`params`) |

각 페이지는 `meta`(메뉴 이름·질문 한 줄·상단 주 행동 버튼) 와 `render(state, data) → HTML 문자열`, 선택적 `bind(root, ctx)` 를 export 한다. 새 페이지는 `pages/` 에 파일을 추가하고 `app.js` 의 `PAGES`·`NAV` 에 한 줄 넣는다. 안 쓰는 페이지는 `NAV` 에서 뺀다.

## 위젯 18개 — `widgets.js`

모두 DOM 없이 HTML 문자열을 돌려주는 순수 함수라 `node --test` 로 검증된다. 입력 모양 표는 파일 맨 위 주석에 있다.

| 번호 | 위젯 | 언제 쓰나 |
|---|---|---|
| W1 | 지표 줄 | 맨 위 핵심 숫자 3~5개, 전 기간 대비 개선/악화 |
| W2 | 추세 선·면 | 시간에 따른 변화, 목표선·이상 구간 |
| W3 | 범주 가로 막대 | 어디가 가장 큰가(상위 N + 나머지) |
| W4 | 100% 누적 막대 | 구성비(도넛 대신) |
| W5 | 히트맵 | 요일×시간 등 두 기준으로 몰리는 곳 |
| W6 | 목표 대비 진척 | 목표까지 남은 양·기한 |
| W7 | 퍼널 | 단계별 건수·전환율·이탈 |
| W8 | 순위·판단 큐 표 | 먼저 볼 건 정렬, 행 펼침으로 근거 |
| W9 | 이상치·알림 목록 | 지금 문제인 건, 심각도·시각·바로가기 |
| W10 | 상태 보드 | 대기·진행·완료 칸반, 열별 건수 |
| W11 | 일정 타임라인 | 언제 무엇이 겹치나, 오늘 선 |
| W12 | 최근 활동 | 누가 무엇을 바꿨나 |
| W13 | 배치도 | 장비·구역 격자 위 상태(색 + 글자) |
| W14 | 관리도 | 시간 순 값이 기준선·상하한 밖으로 나간 점(주황), 점을 누르면 그 날짜 목록 |
| W15 | 분포 | 값이 어디에 몰렸나 — 히스토그램 + 중앙값·p90 선, 그룹별 작은 그래프 |
| W16 | 매트릭스 | 범주 두 열 × 집계 값, 칸을 누르면 목록 |
| W17 | AI 대화창 | 지금 보는 화면의 데이터를 AI 에게 묻고 답을 받을 때 — 대화는 페이지를 옮겨도 남고(sessionStorage), 설정 `chat` 이 있으면 헤더 버튼 옆 패널로도 열린다(동작 `chat.js`, 공통 로직 `../domains/chat.mjs`) |
| W18 | 녹음·전사 | 사용자가 말로 입력해야 할 때(인터뷰 답변, 점검 메모) — 녹음 또는 오디오 파일을 글로 바꿔 입력란에 넣는다(`recorder.js`, 서버 `POST /api/transcribe`, 키 없으면 모의 전사) |

도넛·3D·그라데이션·카운트업·캐러셀은 쓰지 않는다. 강조색은 하나(`--skh-data-accent`), 의미는 색만이 아니라 글자로도 적는다.

## 새 과제 데이터 연결

원칙: **판정·집계는 `src/` 코드 + 테스트가 하고, 셸은 그 결과 JSON 을 그리기만 한다.**

열·상태·지표·안내문 같은 도메인 설정은 `starter/domains/<이름>/domain.json`, 데이터는 같은 폴더의 `sample.json` 에 있고 화면 코드는 그것만 읽는다. 바꾸는 순서는 `starter/DOMAIN.md`(열 정의 → 설정 맞추기 → `node starter/domains/csv-to-sample.mjs <이름> 과제.csv` → 검증).

1. `src/` 에서 과제 입력(CSV 등)을 읽어 집계·판정하는 코드는 따로 만들고(테스트 먼저), 화면에 올릴 행은 `sample.json` 의 `rows` 로 만든다.
2. 어느 도메인을 띄울지: 주소 `?domain=<이름>` 이 `starter/domains/active.json` 의 `active` 보다 먼저다.
3. 저장이 필요한 값은 `/api/<이름>` 을 쓴다: `GET` 은 `data/store/<이름>.json` 이 있으면 그것, 없으면 `data/<이름>.json`(입력·판정은 `decisions-<도메인>` 이름으로 저장되고 처음엔 `starter/domains/<도메인>/decisions.json` 이 씨앗); `POST`·`PUT` 은 JSON(1MB 이하)을 `data/store/<이름>.json` 에 쓴다. 이름은 소문자·숫자·하이픈.
4. 가짜 데이터가 필요하면 `node starter/domains/gen-sample.mjs [도메인]`(고정 시드, 같은 결과). 제출 전에 견본 가상 데이터(`domains/` 아래 9개 견본 중 안 쓰는 것)와 안 쓰는 페이지·위젯 호출을 정리한다.
5. 목록의 표 공통 기능 — CSV 내보내기(현재 필터, UTF-8 BOM) · D-day 열(기한 초과 = 긴급 배지) · 선택 건 안내문 일괄 생성(미리보기·복사·내려받기) — 은 설정(`roles.deadline` · `notice`)만 있으면 어느 도메인에서나 나온다.

## 검증

```bash
node --test starter/shell/csv.test.mjs starter/shell/smoke.test.mjs
```

`node --test starter/shell/` 처럼 디렉터리째 지정하지 않는다(`serve.mjs` 까지 테스트로 돈다). 과제 로직 테스트는 `csv.test.mjs` 와 같은 형태(`node:test` + `assert`)로 추가한다.

## 맥 키 기준

복사 ⌘C · 붙여넣기 ⌘V · 서버 중지는 터미널에서 control+C. 화면의 「복사」 버튼은 메모를 클립보드에 넣는다(붙여넣기는 ⌘V).

## 폴더

```
serve.mjs   서버(정적 파일 + /vendor + /api)     index.html  앱 프레임
app.js      해시 라우터                           shell.css   배치(토큰만)
widgets.js  위젯 18종                             util.js     화면 보조(공통 계산은 ../domains/core.mjs)
pages/      페이지 11종                           ../domains/ 도메인 설정·샘플 9종 · core.mjs · gen-sample.mjs
csv.mjs     CSV 파서                              smoke.mjs   화면 문자열 확인 CLI
```

## AI 피드백 서버

`POST /api/assist` 는 `serve.mjs` 가 받는다. `OPENAI_API_KEY`(+`OPENAI_MODEL`)가 서버 프로세스 환경변수에 있으면 OpenAI 를 부르고, 없거나 실패·시간 초과(8초)면 모의 응답(화면에 「모의 응답」). 키는 브라우저로 나가지 않는다. 예: `OPENAI_API_KEY=… node starter/shell/serve.mjs`. 어댑터 `assist-api.mjs` 는 shadcn 판 `overlay/server/assist.mjs` 와 같은 입출력 계약의 사본이다.

## AI 대화창 서버

`POST /api/chat` 도 `serve.mjs` 가 받는다(입력 `{messages:[{role,content}], context?}`, 길이 상한·형식이 틀리면 400). 키 규칙은 위 AI 피드백과 같다 — `OPENAI_API_KEY` 가 있으면 OpenAI(시스템 프롬프트 = 「화면 데이터에 근거해 한국어로 짧게, 근거가 없으면 모른다」), 없거나 실패·시간 초과(10초)면 같은 입력에 같은 답을 주는 모의 응답(`mock:true`, 화면에 「모의 응답」). 키는 응답·로그·브라우저에 나가지 않는다. 어댑터 `chat-api.mjs` 는 shadcn 판 `overlay/server/chat.mjs` 의 사본이다. 근거 문서(`chat.docs`)는 입력에 `docs:true, passages:[{doc,n,text}]`(5개까지) 가 더해지고 응답에 `refs:[{doc,n}]` 가 붙는다 — 문단 고르기는 화면이 하고(`../domains/docs.mjs`), 셸은 `GET /api/docs-<도메인>` 으로 문서를 받는다.
