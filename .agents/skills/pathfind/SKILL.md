---
name: pathfind
description: "만들 일을 실제 작업 순서대로 4~7단계로 나누고, 단계마다 이미 있는 것(오픈소스·무료 에셋·튜토리얼·블로그·참고 사례)을 실제 검색 결과의 URL 로 찾아 \"가져다 써도 됨\"/\"섞어야 함\"/\"직접 해야 함\"/\"선례를 못 찾음\"으로 갈라…"
---

# pathfind — 만들기 전에 이미 있는 바퀴를 찾는다

대회판 pathfind — 정한 방향을 4~7단계로 나누고, 단계마다 이미 있는 바퀴를 실제 검색 결과로 찾는다. 절차·판정값·`render.py` 는 원본(공개 레포 `lumatic2/pathfind-web`)과 같다.

## 대상인지 먼저 가른다

핵심 신호는 **만들 대상 + "뭐부터 / 이미 있나 / 비슷한 게 있나"** 가 함께 있는 것이다.

- 대상: "타워디펜스 웹 게임 — 타워 4~5종, 웨이브, 타일맵", "개인용 노션 대체를 만들려는데 비슷한 오픈소스부터", "2D 플랫폼 게임용 무료 타일 에셋·튜토리얼 먼저".
- 대상 아님: 만들 대상이 없는 상담·취향 고르기·단순 사실 확인·"이 코드 대신 짜줘" 같은 실행 요청. 이때는 이 스킬이 무엇을 하는지 한 줄과 "XXX 를 만들려는데 뭐부터 찾아봐야 할지"처럼 다시 말하는 법 한 줄만 주고 멈춘다.
- 대상은 있는데 디테일이 짧으면 **되묻지 않는다.** 기본값을 스스로 정해 끝까지 가고, 정한 가정은 마지막 「조정 안내」에 적는다 — 한 번에 결과를 보고 고치는 편이 질문 왕복보다 빠르다.

## 절차

### 1. 단계 분해

- 4~7단계. 작은 일은 4, 큰 일은 7.
- 실제로 손이 가는 순서로 나눈다(방향 정하기 → 설계 → 구현 → 검증 → 배포 같은 식). 단계 제목에 "조사·리서치·오픈소스 찾기" 같은 채널 명사를 넣지 않는다 — 채널은 findings 의 `kind` 다(`render.py` 가 막는다).
- 제목은 한글 24자 이내. `desc` 는 짧은 독립 문장 2~3개(템플릿이 '다.' 단위로 잘라 불릿으로 보여준다).
- 모든 단계에 `tasks` 2~3개(순서·할 일 한 줄·왜 한 줄).

### 2. 단계마다 실제로 검색한다

- 웹 검색 도구(Codex 내장 웹 검색)를 단계마다 **최소 1회, 많아야 2회** 실제로 부른다. 검색어 하나에 그 단계 목적을 담는다.
- findings 의 `url`·`evidence` 는 **이번 검색 결과에 실제로 있던 것만** 옮긴다. `evidence` 는 검색 도구가 돌려준 텍스트의 한 문장을 그대로 — 거기서 다시 요약·번역·의역하지 않는다. `query` 는 실제로 넣은 검색어 그대로.
- 도구 자체의 URL 은 결과에 없고 그 도구를 소개한 글만 있으면, 소개 글 URL 을 `url` 로 쓰고 `note` 에 그 사실을 적는다.
- 결과에서 못 찾은 단계는 `findings: []` + `"선례를 못 찾음"`. 이것도 정상 결과다 — 그 단계가 정말 새로 만들 바퀴라는 판정이다. 억지로 채우지 않는다.
- `search_calls` 는 이번 실행의 실제 검색 호출 수를 센 값이다.

### 3. JSON 으로 정리해 `render.py` 를 한 번 돌린다

파일 생성은 산문으로 하지 않는다. 아래 스키마의 JSON 하나를 stdin 으로 넘기면 연구노트와 흐름도가 함께 나온다. 스크립트는 표준 라이브러리만 쓴다.

**출력 위치**: `docs/research/pathfind/`. 경로는 작업 디렉터리 기준 상대경로로만 쓴다(밖으로 나가면 스크립트가 거부한다).

```bash
python3 .agents/skills/pathfind/scripts/render.py < pathfind-input.json
```

JSON 을 임시 파일로 썼다면 실행 뒤 지운다. 성공하면 stdout 에 이렇게 찍힌다:

```
검색 호출 횟수: <n>
연구노트: ./docs/research/pathfind/<주제>.md — <n>바이트
흐름도 설계도: ./docs/research/pathfind/<주제>.html — <n>바이트
```

실패하면 stderr 의 `ERROR:` 메시지대로 JSON 을 고쳐 다시 돌린다. stdout 없이 "작성 완료"라고 쓰지 않는다 — 바이트 값은 실행해야만 생기는 값이다.

**스키마** (값은 문자열 그대로만 — 비슷한 말로 바꾸면 거부된다):

```
topic: string
out_md: string            # 예: docs/research/pathfind/타워디펜스-웹.md
out_html: string          # 예: docs/research/pathfind/타워디펜스-웹.html
search_calls: integer ≥1
steps: [                  # 비어 있으면 안 됨
  no: number|string
  title: string
  desc: string            # 문장 2~3개
  icon: string            # 선택 — 아래 표
  verdict: "가져다 써도 됨" | "직접 해야 함" | "섞어야 함" | "선례를 못 찾음"
  verdictReason: string   # 선택 — 한 줄 근거
  tasks: [ {order, task, why} ]   # 2~3개
  findings: [
    kind: "오픈소스" | "무료 에셋" | "튜토리얼·블로그" | "참고 사례"
    name, query, evidence, note, url   # 다섯 다 필수 — query·evidence·url 은 비어도 exit 2
  ]
]
```

**icon**: 기획 `compass`·`target` / 설계 `pencil-ruler`·`layout-dashboard` / 구현 `code-xml` / 데이터 `database` / 서버·API `server`·`cpu`·`wifi` / 모바일 `smartphone` / 게임 `gamepad-2` / 디자인·에셋 `palette`·`image` / 영상·음성 `video`·`film`·`mic`·`headphones` / 글·문서 `pen-line`·`file-text`·`book-open` / 사람·운영 `users`·`message-square`·`bot` / 알림·일정 `bell`·`calendar` / 결제 `credit-card`·`shopping-cart` / 지도 `map`·`globe` / 보안 `shield` / 검증 `flask-conical`·`search-check` / 배포 `rocket`·`package` / 도구·유지보수 `settings`·`wrench` / 지표 `chart-bar`. 표에 없으면 기본 아이콘.

### 4. 알린다

두 파일의 경로만 사용자에게 준다. 연구노트 md 는 열지 않는다. 흐름도 html 은 사용자가 탐색기에서 연다.

## 응답

1. **저장 결과** — `render.py` stdout 그대로.
2. **채팅 요약** — 단계별 한 줄 + 판정, 핵심 링크 몇 개(전체는 연구노트). 마지막 줄: "직접 해야 함"·"선례를 못 찾음" 단계가 어디인지 — 그게 이번 일에서 정말 새로 만들 바퀴다.
3. **조정 안내** — 스스로 정한 기본값·가정(단계 수, 짧은 입력을 채운 추정, 단계당 검색 횟수). 사용자가 "이건 이렇게"라고 하면 그 부분만 다시 돈다.

## Known Pitfalls

| 함정 | 처방 |
|---|---|
| 단계 제목에 "오픈소스 조사"·"레퍼런스 찾기" 같은 채널 명사 | `render.py` 가 거부한다 — 채널은 `kind`, 제목은 실제 작업(설계·구현·검증…) |
| 기억으로 URL·evidence 를 채움 | 이번 검색 결과에 없던 것은 빼고, 다 빠지면 `"선례를 못 찾음"` |
| `out_md` 를 절대경로·`../` 로 지정 | 작업 디렉터리 밖이라 거부 — 상대경로로 |
