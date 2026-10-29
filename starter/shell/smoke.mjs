// smoke.mjs — 브라우저 없이 화면을 스크립트로 확인한다 (의존성 0, Node 18+ fetch)
// 사용: node smoke.mjs <URL> "<있어야 할 문자열>" ["<문자열2>" ...]
//   예) node starter/shell/smoke.mjs http://localhost:5173/ "오늘 처리할 건" "근거"
// 종료코드: 0 전부 확인 · 1 응답 실패 또는 문자열 없음 · 2 사용법 오류
// 왜: 수동 확인(서버 재기동 → 눈으로 보기) 반복이 코파톤 최대 시간 소모 구간이었다. 수동 확인은 마지막 1회만.
// 한계: 서버가 내려준 HTML·JSON 문자열만 본다. 브라우저에서 JS 가 그린 결과는 못 본다 —
//       그 로직은 순수 함수로 빼서 node --test 로 검증한다.
export async function smoke(url, expects) {
  const res = await fetch(url);
  const body = await res.text();
  const missing = expects.filter((s) => !body.includes(s));
  return { status: res.status, ok: res.ok && missing.length === 0, missing };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('smoke.mjs')) {
  const [url, ...expects] = process.argv.slice(2);
  if (!url) { console.error('사용: node smoke.mjs <URL> "<문자열>" ...'); process.exit(2); }
  try {
    const r = await smoke(url, expects);
    console.log(`${url} → ${r.status}${r.missing.length ? ` · 없음: ${r.missing.join(', ')}` : ` · 확인 ${expects.length}개`}`);
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.log(`${url} → 연결 실패: ${e.message}`);
    process.exit(1);
  }
}
