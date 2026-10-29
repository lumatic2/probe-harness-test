> **사전 체험 테스트용 사본 — 본 키트는 lumatic2/probe-harness**
>
> 세팅 한 문장: `GitHub 의 lumatic2/probe-harness-test 레포를 이 폴더에 클론하고 README 대로 세팅해줘`
>
> `sample-task/` 는 사전 체험용 견본 과제다 — 실제 과제 파일이 작업 공간에 없을 때만 이걸 과제로 쓴다. 작업 공간 루트에 `README.md` 가 없으면, 아래 「세팅」 2번의 `setup.sh` 를 돌리기 **전에** `cp -r probe-harness-test/sample-task/. .` 로 견본을 작업 공간 루트에 복사한다(setup.sh 가 클론 폴더를 지우므로 먼저 옮겨야 한다). 루트에 이미 과제 `README.md` 가 있으면 견본은 쓰지 않는다. 이 사본은 클론 폴더 이름이 `probe-harness-test/` 이므로 아래 명령의 `probe-harness/` 는 `probe-harness-test/` 로 읽는다.





# probe-harness

SK하이닉스 AI 해커톤 2026 **2차 예선**(2026-10-31 토, Cofa Probe 웹 IDE, 제공 Codex 만 사용) 응시자가 쓰는 작업 하네스.

## 이 README 를 읽은 에이전트에게 — 지금 상황

- 사용자는 지금 **시험 중**이다. 10:00 에 과제 타이머가 시작됐고 과제 풀이는 최대 180분, 이어 후속 서술형(6문항 × 5분, AI 금지)이 있다. 14:00 강제 종료.
- **너는 오케스트레이터다.** 계획·분해·공유 문서·검수·커밋·실무자 DM 초안을 맡는다. 구현은 사용자가 새 탭에 띄우는 구현 세션이 한다.
- 작업 공간(사용자가 Codex 를 연 폴더, 보통 `~/workspace`) 루트의 `README.md` 는 **과제 원문**이다. 이 레포의 README(지금 이 글)와 다르다. 세팅은 과제 원문을 덮지 않는다.
- 공통 정본은 세팅 뒤 작업 공간에 생기는 `AGENTS.md`(모든 탭 공통)이고, 오케의 신호 규칙은 `roles/오케.md` 다. 대회 규칙·채점 요약은 `guides/CONTEST-BRIEF.md`.

## 세팅 — 이 레포를 클론하라는 요청을 받았으면 (사용자 문구와 무관)

1. 클론 위치는 **작업 공간 안의 `probe-harness/`** 다. 다른 곳에 클론했으면 아래 명령에 작업 공간 경로를 인자로 넘긴다.
2. 작업 공간에서 실행한다:
   ```bash
   bash probe-harness/setup.sh
   ```
   과제가 준 README·데이터는 덮지 않는다. 과제가 준 `AGENTS.md` 가 있으면 우리 `AGENTS.md` 맨 끝 「과제 환경이 준 원래 지침」 절로 옮긴다. recon(`docs/RECON.txt`)·복원 검증·`scaffold` 커밋·클론 폴더 삭제까지 한다.
3. setup.sh 가 **세팅 완료 보고 ①~④ 를 직접 출력한다**(깐 것 · 환경 · 과제 파일 목록 · 시간 앵커). `AGENTS.md` 전체와 `roles/오케.md` 전체(오케의 신호 규칙)와 `guides/CONTEST-BRIEF.md` 를 읽은 뒤 그 4줄을 그대로 사용자에게 전하고, 모델·effort 한 줄만 덧붙인다. RECON 을 따로 요약하거나 다른 문서를 만들지 않는다.
4. **과제 원문(`README.md`)은 아직 읽지 않는다.** 사용자는 세팅이 도는 동안 과제를 직접 읽고 있다. 사용자가 「과제 브리핑해줘」라고 치면 그때 읽고 과제 브리핑 6항목을 낸다(`roles/오케.md` 「사용자 신호」). 마지막 줄은 `다음 입력(오케): 과제 브리핑해줘`.

## 구조

`AGENTS.md`(정본) · `guides/KICKOFF.md`(시작 순서·승계 프롬프트) · `guides/CONTEST-BRIEF.md`(대회 규칙) · `roles/`(오케·DM·평가·리서치·보안·제출 점검·설명) · `setup.sh` · `.agents/skills/` · `guides/` · `docs/` · `starter/` · `tools/` · `vendor/` · `verify.sh`

