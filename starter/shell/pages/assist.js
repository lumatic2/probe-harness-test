// pages/assist.js — ⑧ AI 피드백 #/assist: 질문 → 답변(글, 선택으로 녹음) → 피드백.
// 판정은 규칙 코드가 정하는 고정 라벨(같은 답변이면 같은 판정)이고 근거 문장에 걸린 표현을 굵게 보여 준다. AI 는 「개선 제안」 한 문단만 쓴다(/api/assist).
// 서버에 키가 있으면 OpenAI, 없거나 실패하면 「모의 응답」 — 어느 쪽인지 화면에 표시한다. 판정 계산은 ../../domains/assist.mjs (설정: domain.json 의 assist).
// shadcn 판(pages/assist.tsx)과 같은 동작.
import { esc, linkTo, limitLine, display, idOf, colLabel, badge } from '../util.js';
import { judgeAnswer, segments } from '../../domains/assist.mjs';
import { card, empty } from './parts.js';
import { recorderHtml, bindRecorder } from '../recorder.js';

export const bodyPrimary = true; // 본문에 검정 주 버튼(피드백 받기)이 있어 상단 행동 버튼은 테두리 버튼
export const enabled = (ctx) => !!ctx.d.assist;
export const meta = (ctx) => ({
  name: ctx.d.assist?.title ?? 'AI 피드백',
  action: { label: '목록으로', href: (s) => linkTo('list', s) },
});

const REASON = { timeout: '시간 초과', network: '연결 실패', empty: '빈 응답' };
const reasonText = (r) => (!r || r === 'no-key' ? '' : String(r).startsWith('http-') ? `응답 오류 ${String(r).slice(5)}` : REASON[r] ?? r);

// ---- 상태 ----
export function createState(data) {
  const ctx = data.ctx;
  return { ctx, cfg: ctx.d.assist, set: '', qid: String(idOf(ctx, ctx.rows[0])), answer: '', result: null };
}
export const listOf = (S) => S.ctx.rows.filter((r) => !S.set || r[S.cfg.setCol] === S.set);
export const rowOf = (S) => S.ctx.rows.find((r) => String(idOf(S.ctx, r)) === S.qid) ?? S.ctx.rows[0];
export const resultFor = (cfg, row, answer) => ({ answer, judgement: judgeAnswer(cfg, row, answer) });

// ---- 그리기 ----
export function feedbackHtml(cfg, result) {
  if (!result?.judgement) return empty('아직 피드백이 없습니다.');
  const j = result.judgement, ai = result.ai;
  const sentences = j.sentences.length ? `<div class="sh-field"><span class="sh-lab">답변 문장</span><p class="sh-evidence-text" data-evidence>${j.sentences.map((s) => `<span${s.terms.length ? ' data-hit="true" class="sh-hit"' : ''}>${segments(s.text, s.terms).map((p) => (p.mark ? `<strong>${esc(p.text)}</strong>` : esc(p.text))).join('')}</span>`).join(' ')}</p></div>` : '';
  let suggestion = '';
  if (ai) {
    const mock = ai.state === 'done' && ai.source === 'mock';
    suggestion = `<div class="sh-field" data-suggestion><div class="sh-inline"><span class="sh-lab">개선 제안</span>${badge('AI 제안', 'plain')}${mock ? '<span class="skh-badge skh-badge--normal" data-mock>모의 응답</span>' : ''}</div>
${ai.state === 'loading' ? '<p class="skh-muted">AI 제안을 불러오는 중…</p>' : ''}${ai.state === 'done' ? `<p>${esc(ai.text)}</p>` : ''}${mock && reasonText(ai.reason) ? `<p class="skh-muted">OpenAI 호출 실패(${esc(reasonText(ai.reason))}) — 모의 응답으로 대신함</p>` : ''}${ai.state === 'error' ? `<p class="skh-error" role="alert">${esc(ai.message)}</p>` : ''}</div>`;
  }
  return `<div class="sh-fb" data-feedback="${esc(j.code)}">
<div class="sh-field"><div class="sh-inline"><span class="sh-lab">판정</span>${badge(j.label, j.code === 'risk' ? 'urgent' : j.code === 'short' ? 'warn' : 'plain')}</div><p data-judge-message>${esc(j.message)}</p></div>
${sentences}${suggestion}</div>`;
}

function listCard(S) {
  const cfg = S.cfg, ctx = S.ctx;
  const sets = [...new Set(ctx.rows.map((r) => String(r[cfg.setCol])))];
  const list = listOf(S);
  const html = `<select class="sh-input sh-full" data-set aria-label="${esc(colLabel(ctx, cfg.setCol))}"><option value="">${esc(colLabel(ctx, cfg.setCol))} 전체</option>${sets.map((s) => `<option${S.set === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
<div class="sh-listbox sh-compact" data-question-list><table class="skh-table"><thead><tr><th scope="col">${esc(ctx.d.entity.idLabel)}</th><th scope="col">${esc(colLabel(ctx, cfg.questionCol))}</th></tr></thead><tbody>${list.map((r) => {
    const id = String(idOf(ctx, r));
    return `<tr data-q="${esc(id)}"${id === S.qid ? ' data-state="selected"' : ''}><td class="sh-col-id">${esc(id)}</td><td>${esc(r[cfg.questionCol])}</td></tr>`;
  }).join('')}</tbody></table></div>`;
  return card({ title: '질문 목록', sub: `${list.length}${ctx.d.entity.unit}`, html });
}

function answerCard(S) {
  const cfg = S.cfg, ctx = S.ctx, row = rowOf(S);
  const html = `<div class="sh-subform sh-subform--wide">
<textarea class="sh-input sh-full" aria-label="답변" rows="8" placeholder="${esc(cfg.placeholder)}" data-answer>${esc(S.answer)}</textarea>
<div data-record>${recorderHtml({ text: false })}</div>
<div class="sh-actions"><button type="button" class="sh-primary" data-submit${S.answer.trim() ? '' : ' disabled'}>${esc(cfg.startLabel)}</button><span class="skh-muted" data-count>${S.answer.trim().length}자</span></div></div>`;
  return card({ title: row[cfg.questionCol], sub: `${idOf(ctx, row)} · ${display(ctx, cfg.setCol, row[cfg.setCol])}${cfg.limitCol ? ` · 권장 ${row[cfg.limitCol]}초` : ''}`, html });
}

export function pageHtml(S) {
  return `<div class="sh-grid">
<div class="sh-span-3">${listCard(S)}</div>
<div class="sh-span-5" data-answer-card>${answerCard(S)}</div>
<div class="sh-span-4">${card({ title: '피드백', html: `<div data-feedback-slot>${feedbackHtml(S.cfg, S.result)}</div>` })}</div>
</div>${limitLine(S.ctx, '녹음은 「텍스트로 바꾸기」를 눌렀을 때만 전사 서버로 보내고 저장하지 않음')}`;
}

let cur = null;
export function render(state, data) {
  cur = createState(data);
  return `<div class="sh-assist" data-assist>${pageHtml(cur)}</div>`;
}

// ---- 동작 ----
export function bind(root) {
  const S = cur;
  const host = root.querySelector('[data-assist]');
  let seq = 0;
  const paint = () => { host.innerHTML = pageHtml(S); };
  // 녹음·전사(W18)는 전사가 끝나면 답변 칸에 글을 넣는다 — 사용자가 고친 뒤 기존 피드백 흐름
  const paintAnswer = () => {
    host.querySelector('[data-answer-card]').innerHTML = answerCard(S);
    bindRecorder(host.querySelector('[data-recorder]'), { onText: (text) => {
      const ta = host.querySelector('[data-answer]');
      S.answer = text;
      ta.value = text;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    } });
  };
  const paintFeedback = () => { host.querySelector('[data-feedback-slot]').innerHTML = feedbackHtml(S.cfg, S.result); };
  paintAnswer(); // 녹음 영역에 동작을 붙인다

  const submit = async () => {
    const row = rowOf(S);
    const base = resultFor(S.cfg, row, S.answer);
    const my = ++seq;
    S.result = { ...base, qid: S.qid, ai: { state: 'loading' } };
    paintFeedback();
    try {
      const res = await fetch('/api/assist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: row[S.cfg.questionCol], answer: S.answer, code: base.judgement.code, terms: base.judgement.terms, sentences: base.judgement.sentences.filter((s) => s.terms.length).map((s) => s.text), minChars: S.cfg.minChars }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      if (my === seq) S.result = { ...S.result, ai: { state: 'done', text: j.suggestion, source: j.source, reason: j.reason } };
    } catch (e) {
      if (my === seq) S.result = { ...S.result, ai: { state: 'error', message: `개선 제안을 불러오지 못했습니다(${e.message}). 판정은 그대로 유효합니다.` } };
    }
    if (my === seq) paintFeedback();
  };

  host.addEventListener('click', (e) => {
    const t = e.target;
    const q = t.closest('[data-q]');
    if (q) { S.qid = q.dataset.q; S.answer = ''; S.result = null; seq++; paint(); paintAnswer(); return; }
    if (t.closest('[data-submit]')) submit();
  });
  host.addEventListener('change', (e) => {
    if (e.target.matches('[data-set]')) { S.set = e.target.value; paint(); paintAnswer(); }
  });
  host.addEventListener('input', (e) => {
    if (!e.target.matches('[data-answer]')) return;
    S.answer = e.target.value;
    host.querySelector('[data-submit]').disabled = !S.answer.trim();
    host.querySelector('[data-count]').textContent = `${S.answer.trim().length}자`;
  });
}
