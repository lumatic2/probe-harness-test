// pages/widgets.js — 위젯 카탈로그(#/widgets): 위젯 16종을 번호·이름과 함께 모두 보여 준다. 당일 어떤 위젯을 쓸지 고르는 용도.
import { WIDGETS, panel } from '../widgets.js';
import { buildInputs, esc, limitLine, parseHash } from '../util.js';
import { chatConfig, chatContext } from '../../domains/chat.mjs';
import { mountChat } from '../chat.js';
import { bindRecorder } from '../recorder.js';

export const meta = () => ({
  name: '위젯 모음',
  action: { label: '대시보드로', href: () => '#/dashboard' },
});

const chatInput = (ctx) => chatConfig(ctx.d) ?? { title: 'AI에게 묻기', suggestions: [] };

// W17 카드: 도메인 설정의 chat 이 없어도 카탈로그에서는 동작한다(첫 질문 칩만 없음). 대화는 옆 패널과 같은 보관소를 쓴다.
export function bind(view, { data }) {
  const root = view.querySelector('[data-chat-root]');
  if (root) mountChat(root, { name: data.ctx.d.name, getContext: () => chatContext(data.ctx, parseHash(location.hash)), config: chatInput(data.ctx) });
  // W18 녹음·전사 견본을 동작하게 한다
  view.querySelectorAll('[data-recorder]').forEach((el) => bindRecorder(el));
}

export function render(state, data) {
  const inputs = buildInputs(data.ctx, state);
  const index = `<div class="skh-table-scroll"><table class="skh-table"><thead><tr><th scope="col">번호</th><th scope="col">이름</th><th scope="col">언제 쓰나</th></tr></thead><tbody>${WIDGETS.map((w) => `<tr><td>${w.no}</td><td>${esc(w.name)}</td><td>${esc(w.when)}</td></tr>`).join('')}</tbody></table></div>`;
  const cards = WIDGETS.map((w) => `<div class="${['W1', 'W8', 'W10', 'W12', 'W13', 'W17'].includes(w.no) ? 'sh-span-12' : 'sh-span-6'}">${panel({ no: w.no, title: `${w.no} ${w.name}`, question: w.when, html: w.key === 'w17' ? `<div data-chat-root>${w.fn(chatInput(data.ctx))}</div>` : w.fn(inputs[w.key]) })}</div>`).join('');
  return `<h2>위젯 모음</h2><p class="skh-muted">같은 가상 데이터로 그린 견본입니다. 기간·그룹 필터는 모두에 반영됩니다. 이 화면에서는 표 정렬이 동작하지 않습니다(목록 화면에서 동작).</p>${index}<div class="sh-grid">${cards}</div>${limitLine(data.ctx, '견본 화면이며 실제 과제 데이터가 아님')}`;
}
