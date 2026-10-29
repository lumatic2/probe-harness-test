// util.js — 셸 공용 순수 함수 (DOM 없음, Node 에서 테스트 가능)
// 집계·라우팅·위젯 입력 만들기는 전부 ../domains/core.mjs 에 있고(셸과 shadcn 앱이 같이 쓴다), 여기서는 그대로 내보낸다.
// 과제 데이터로 바꿀 때: 이 파일이 아니라 domains/<이름>/domain.json 을 고친다 (starter/DOMAIN.md).
import { esc, DOMAIN_NAME_RE, settingsNote } from '../domains/core.mjs';

export * from '../domains/core.mjs';
export { buildReportWorkbook, buildXlsx, downloadXlsx, filterParts, xlsxFileName } from '../domains/xlsx.mjs';

// 칸의 어조(tone) → design.css 의 배지 이름. urgent = 옅은 주황 배지, warn = 회색 바탕, plain = 테두리, muted = 회색 글자
export const TONE_BADGE = { urgent: 'danger', warn: 'warning', plain: 'info', muted: 'normal' };
export const badge = (text, tone) => (text ? `<span class="skh-badge skh-badge--${TONE_BADGE[tone] || 'normal'}">${esc(text)}</span>` : '');

// 어느 도메인을 띄울지: 주소의 ?domain=이름 → 없으면 domains/active.json 의 active
export function pickDomainName(search, active) {
  const m = /(?:^|[?&])domain=([^&]*)/.exec(String(search || ''));
  const want = m ? decodeURIComponent(m[1]) : '';
  return DOMAIN_NAME_RE.test(want) ? want : active;
}

// 모든 페이지 하단의 「이 화면의 한계」 한 줄
export function limitLine(ctx, extra = '') {
  const more = [extra, settingsNote(ctx)].filter(Boolean).join(' · '); // 저장된 기준값이 기본값과 다르면 「기준값 사용자 설정 적용」 한 줄이 붙는다
  return `<p class="skh-footnote" data-limit>이 화면의 한계: ${esc(ctx.d.app.limit)}${more ? ' · ' + esc(more) : ''}</p>`;
}

// 저장 시각 글자 'YYYY-MM-DDTHH:MM:SS' (브라우저 시계, 시간대 없음 — 일정 격자·문서 검토의 저장 기록용)
export function nowTs(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
