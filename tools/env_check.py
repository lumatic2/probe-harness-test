"""env_check.py — 코드가 읽는 환경 변수 ↔ README 「환경 변수」 표 대조 (표준 라이브러리만).

사용: python3 tools/env_check.py [작업 공간 경로] [README 경로]
종료코드: 0 코드가 읽는 변수가 전부 표에 있음 · 1 표에 빠진 변수 있음
코드에서 모으는 것: process.env.X · process.env["X"] · import.meta.env.VITE_X · os.environ["X"] · os.environ.get("X") · os.getenv("X")
표에서 모으는 것: README 의 「환경 변수」 절 표 첫 칸에 백틱으로 쓴 이름. 표에만 있는 것은 「남음」으로 알리되 막지 않는다.
코파톤 실측: README 표에서 변수 하나(OPENAI_API_KEY)가 빠져 부분 충족 — M3 오케 자체 점검 · M5 제출 점검에서 돌린다.
"""
import os
import re
import sys
from pathlib import Path

SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".venv", "venv", "__pycache__", ".next", "coverage", "docs", "tests", "test", ".agents", "guides", "roles", "tools"}
CODE_EXT = {".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".sh"}
BUILTIN = {"NODE_ENV", "MODE", "DEV", "PROD", "SSR", "BASE_URL", "HOME", "PATH", "PWD", "USER", "SHELL", "TMPDIR", "TEMP", "CI"}  # 런타임·OS 가 주는 것 — 사용자가 설정하는 변수가 아니다
NAME = r"[A-Z][A-Z0-9_]*"
PATTERNS = [
    re.compile(rf"process\.env\.({NAME})"),
    re.compile(rf"process\.env\[\s*[\"']({NAME})[\"']\s*\]"),
    re.compile(rf"import\.meta\.env\.({NAME})"),
    re.compile(rf"os\.environ\[\s*[\"']({NAME})[\"']\s*\]"),
    re.compile(rf"os\.environ\.get\(\s*[\"']({NAME})[\"']"),
    re.compile(rf"os\.getenv\(\s*[\"']({NAME})[\"']"),
]


def is_test_file(name: str) -> bool:
    return bool(re.search(r"(\.test\.|\.spec\.|^test_|_test\.)", name))


def code_vars(root: Path) -> dict:
    found = {}
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            if Path(fn).suffix not in CODE_EXT or is_test_file(fn):
                continue
            path = Path(dp) / fn
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            for i, line in enumerate(text.splitlines(), 1):
                for pat in PATTERNS:
                    for m in pat.finditer(line):
                        if m.group(1) not in BUILTIN:
                            found.setdefault(m.group(1), []).append(f"{path.relative_to(root).as_posix()}:{i}")
    return found


def readme_vars(readme: Path) -> set:
    if not readme.exists():
        return set()
    text = readme.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"^#+ [^\n]*환경 변수[^\n]*$(.*?)(?=^#+ |\Z)", text, re.S | re.M)
    names = set()
    for line in (m.group(1) if m else "").splitlines():
        if line.lstrip().startswith("|"):
            cells = line.strip().strip("|").split("|")
            names.update(re.findall(rf"`({NAME})`", cells[0]))
    return names


def main(argv) -> int:
    root = Path(argv[1]) if len(argv) > 1 else Path.cwd()
    readme = Path(argv[2]) if len(argv) > 2 else root / "README.md"
    if not readme.exists():
        print(f"README 없음: {readme}")
        return 1
    code = code_vars(root)
    table = readme_vars(readme)
    missing = sorted(set(code) - table)
    extra = sorted(table - set(code))
    for v in missing:
        print(f"빠짐: {v} — README 환경 변수 표에 없음 (코드: {', '.join(code[v][:3])})")
    for v in extra:
        print(f"남음: {v} — 표에는 있으나 코드가 읽지 않음 (낡은 행이면 지운다)")
    print(f"env_check: 코드 {len(code)}개 · 표 {len(table)}개 · 빠짐 {len(missing)} · 남음 {len(extra)}")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
