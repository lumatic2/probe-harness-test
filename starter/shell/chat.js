// chat.js — W17 AI 대화창의 동작(브라우저 전용). 모양은 widgets.js 의 chatWidget, 공통 로직(전송 키·보관·서버 호출)은 ../domains/chat.mjs.
// mountChat(root, {name, getContext, config, paragraphs?}) — root 안에 대화창을 그리고(이미 그려져 있으면 그대로 연결) 전송·칩·대화 지우기를 묶는다.
//  name = 도메인 이름(대화 보관 키), getContext() = 보낼 때마다 부르는 화면 요약(chatContext), config = {title, suggestions}, paragraphs = 근거 문서 문단(domain.json chat.docs 일 때 docs.mjs buildParagraphs 결과 — 보낼 때 질문과 가까운 문단을 골라 서버에 싣고, 답 아래에 근거 칩을 단다).
// 대화는 sessionStorage 에 남아 페이지를 옮겨도 이어진다. 전송 중 페이지가 바뀌어도 답은 보관소에 쓰이고, 다음에 열 때 보인다.
import { appendMessage, askChat, clearMessages, isSendKey, readMessages, storageKey } from '../domains/chat.mjs';
import { chatMessagesHtml, chatWidget } from './widgets.js';
import { esc } from './util.js';

export function mountChat(root, { name, getContext, config, storage = sessionStorage, paragraphs }) {
  const key = storageKey(name);
  if (!root.querySelector('[data-chat]')) root.innerHTML = chatWidget({ title: config.title, suggestions: config.suggestions });
  const q = (sel) => root.querySelector(sel);
  const input = q('[data-chat-input]');
  const list = q('[data-chat-list]');
  const send = q('[data-chat-send]');
  const chips = q('[data-chat-chips]');
  let pending = false, error = '';

  function paint() {
    const msgs = readMessages(storage.getItem(key));
    list.innerHTML = chatMessagesHtml(msgs, { pending, error });
    list.scrollTop = list.scrollHeight;
    send.disabled = pending;
    chips.hidden = msgs.length > 0 || pending;
    if (!msgs.length && !pending) chips.innerHTML = config.suggestions.map((t) => `<button type="button" class="sh-btn sh-chip" data-chat-suggest="${esc(t)}">${esc(t)}</button>`).join('');
  }

  async function submit(raw) {
    const content = String(raw ?? '').trim();
    if (!content || pending) return;
    error = '';
    const asked = appendMessage(storage, key, { role: 'user', content });
    input.value = '';
    pending = true;
    paint();
    try {
      appendMessage(storage, key, await askChat({ messages: asked, context: getContext(), paragraphs }));
    } catch (e) {
      error = `답변을 불러오지 못했습니다(${e.message}).`;
    }
    pending = false;
    paint();
  }

  q('[data-chat]').addEventListener('click', (e) => { // 이 대화창 요소에만 건다 — 같은 root 에 다시 mount 해도 겹치지 않는다
    const chip = e.target.closest('[data-chat-suggest]');
    if (chip) { submit(chip.dataset.chatSuggest); return; }
    if (e.target.closest('[data-chat-clear]')) { clearMessages(storage, key); error = ''; paint(); input.focus(); }
  });
  q('[data-chat-form]').addEventListener('submit', (e) => { e.preventDefault(); submit(input.value); });
  input.addEventListener('keydown', (e) => {
    if (!isSendKey(e)) return; // Shift+Enter 줄바꿈, 한글 조합 중 Enter(확정) 는 전송하지 않는다
    e.preventDefault();
    submit(input.value);
  });
  paint();
}
