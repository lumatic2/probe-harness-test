// pages/parts.js — 일정 격자·문서 검토·AI 피드백 세 페이지가 같이 쓰는 작은 부품 (HTML 문자열)
import { esc } from '../util.js';

// 카드: 왼쪽 제목+한 줄 설명, 오른쪽 도구(버튼). widgets.js 의 panel 과 같은 껍데기 모양.
export const card = ({ title, sub = '', tools = '', html = '', attrs = '' }) => `<section class="skh-panel sh-card sh-widget"${attrs ? ` ${attrs}` : ''}>
<div class="skh-panel-head"><div class="sh-head-text"><h2>${esc(title)}</h2>${sub ? `<p class="sh-question">${esc(sub)}</p>` : ''}</div>${tools ? `<div class="sh-head-tools">${tools}</div>` : ''}</div>
${html}</section>`;

// 빈 상태: 점선 상자 없이 카드 안 회색 글자만
export const empty = (msg) => `<p class="sh-none">${esc(msg)}</p>`;

// 붙은 버튼 묶음 (선택 = aria-pressed). items: [[값, 글자, 추가 속성]]
export const segment = (label, attr, items, current) => `<div class="sh-seg-group" role="group" aria-label="${esc(label)}">${items.map(([v, text]) => `<button type="button" ${attr}="${esc(v)}" aria-pressed="${v === current}">${esc(text)}</button>`).join('')}</div>`;
