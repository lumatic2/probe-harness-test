"""problem_check.py — 문제 정의서(docs/PROBLEM.md)의 기계 점검 (표준 라이브러리만).

사용: python3 tools/problem_check.py [docs/PROBLEM.md]
종료코드: 0 기계 항목 통과 · 1 미충족 있음
세는 것: ① 빈 절 ② 출처 태그 없는 내용 줄 ③ [짐작] 이 남은 절 ④ 1절(일의 흐름)의 [?] ⑤ 15절 미확인 행 수 ⑥ 확정 시각.
판단 항목(실무자 동의·기준선·모퉁이 너머 등)은 guides/INTERVIEW.md 「문제 확정 관문」이 정한다 — 이 도구는 그 앞의 기계 점검이다.
"""
import re
import sys
from pathlib import Path

TAG = re.compile(r"\[(README|데이터|답변|사용자|짐작)[^\]]*\]")
GUESS = "[짐작]"


def sections(text):
    parts = re.split(r"^## ", text, flags=re.M)[1:]
    out = []
    for p in parts:
        head, _, body = p.partition("\n")
        out.append((head.strip(), body))
    return out


def content_lines(body):
    raw = body.splitlines()
    for n, line in enumerate(raw):
        s = line.strip()
        nxt = raw[n + 1].strip() if n + 1 < len(raw) else ""
        if s.startswith("|") and nxt.startswith("|---"):
            continue  # 표 머리줄
        if not s or s.startswith(("채우는 지침", ">", "|---")):
            continue
        if s in ("-", "|"):
            continue
        if s.startswith("|"):
            cells = [c.strip() for c in s.strip("|").split("|")]
            if not any(cells[1:]):
                continue  # 빈 행(첫 칸 ID 만 있는 양식 행 포함)
        if re.fullmatch(r"~~.*~~", s.lstrip("- ")):
            continue
        yield s


def main(path):
    text = Path(path).read_text(encoding="utf-8")
    secs = sections(text)
    if len(secs) < 16:
        print(f"절이 {len(secs)}개 — 양식(0~15절)과 다르다")
        return 1
    problems = []
    for head, body in secs:
        lines = list(content_lines(body))
        no = head.split(".")[0]
        if not lines:
            problems.append(f"빈 절: {head}")
            continue
        untagged = [l for l in lines if not TAG.search(l) and no not in ("0", "15")]  # 0절은 요약, 15절은 미확인 목록
        if untagged:
            problems.append(f"출처 태그 없음: {head} — {len(untagged)}줄 (첫 줄: {untagged[0][:50]})")
        g = sum(l.count(GUESS) for l in lines)
        if g and no == "13":
            print(f"참고 — 리스크의 [짐작] {g}개(예측이라 허용, 확인되면 태그를 바꾼다)")
        elif g:
            problems.append(f"[짐작] 남음: {head} — {g}개")
        if no == "1":
            q = sum(l.count("[?]") for l in lines)
            if q:
                problems.append(f"흐름의 모르는 구간 [?]: {q}개")
        if no == "15":
            print(f"미확인 행: {len(lines)}개 — 「답이 오면 바뀌는 것」이 MUST·성공 기준이면 관문 미충족")
    if re.search(r"확정 시각: \(\s*\)", text):
        print("확정 시각: 비어 있음(「문제 확정」 때 적는다)")
    for p in problems:
        print("✖ " + p)
    print("기계 점검: " + ("통과" if not problems else f"미충족 {len(problems)}건"))
    return 0 if not problems else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "docs/PROBLEM.md"))
