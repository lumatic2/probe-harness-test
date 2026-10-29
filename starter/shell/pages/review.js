// pages/review.js — ⑦ 문서 검토 #/review: 왼쪽 목록(신뢰도 낮은 순 · 불확실 필터 · 신뢰도 필터 · 검색), 오른쪽 본문 미리보기 + 분류 태그(여러 개) 편집 + 판정 사유 저장.
// 저장은 /api/review-<도메인> 에 {문서ID: {tags, reason, status, ts, who}} 전체를 쓴다. 원 데이터는 바뀌지 않는다.
// 계산은 ../../domains/review.mjs (설정: domain.json 의 review) — 이 파일은 그리기와 상태 바꾸기만 한다. shadcn 판(pages/review.tsx)과 같은 동작.
import { esc, linkTo, limitLine, display, idOf, titleOf, colLabel, nowTs, badge, tone } from '../util.js';
import { addTag, isUncertain, makeRecord, removeTag, reviewCounts, reviewList, tagChoices, tagsOf, validateReview } from '../../domains/review.mjs';
import { card, empty, segment } from './parts.js';

export const bodyPrimary = true; // 본문 폼에 검정 주 버튼(저장)이 있어 상단 행동 버튼은 테두리 버튼
export const enabled = (ctx) => !!ctx.d.review;
export const meta = (ctx) => ({
  name: ctx.d.review?.title ?? '문서 검토',
  action: { label: '목록으로', href: (s) => linkTo('list', s) },
});

// ---- 상태 ----
export function createState(data) {
  const ctx = data.ctx;
  const S = { ctx, cfg: ctx.d.review, saved: data.stores?.review ?? {}, filter: 'uncertain', minConf: '', q: '', selected: '', tags: [], reason: '', errs: {}, msg: '', saving: false };
  const first = listOf(S)[0];
  if (first) selectDoc(S, String(idOf(ctx, first)));
  return S;
}
export const listOf = (S) => reviewList(S.ctx, S.saved, { filter: S.filter, minConf: S.minConf === '' ? null : Number(S.minConf), q: S.q });
export const setFilter = (S, v) => { S.filter = v; };
export const setMinConf = (S, v) => { S.minConf = String(v); };
export const rowOf = (S, id) => S.ctx.rows.find((r) => String(idOf(S.ctx, r)) === id);
export function selectDoc(S, id) {
  const r = rowOf(S, id);
  S.selected = id;
  S.tags = S.saved[id]?.tags ?? (r ? tagsOf(S.cfg, r) : []);
  S.reason = S.saved[id]?.reason ?? '';
  S.errs = {}; S.msg = '';
}
export const setTags = (S, tags) => { S.tags = tags; };
export const setReason = (S, v) => { S.reason = v; };
export const addTagTo = (S, t) => { S.tags = addTag(S.tags, t); };
export const removeTagFrom = (S, t) => { S.tags = removeTag(S.tags, t); };
// 검증 + 저장 기록 만들기. 오류가 있으면 saved 없음
export function buildSave(S, ts) {
  const errs = validateReview(S.cfg, S.tags, S.reason);
  if (Object.keys(errs).length) return { errs };
  return { errs, saved: { ...S.saved, [S.selected]: makeRecord(S.cfg, S.tags, S.reason, ts) } };
}

// ---- 그리기 ----
function listBody(S) {
  const cfg = S.cfg, ctx = S.ctx;
  const list = listOf(S);
  if (!list.length) return `<tr><td colspan="${cfg.listCols.length + 1}" class="sh-none">조건에 맞는 문서가 없습니다.</td></tr>`;
  return list.map((r) => {
    const id = String(idOf(ctx, r));
    return `<tr data-doc="${esc(id)}"${S.selected === id ? ' data-state="selected"' : ''}>${cfg.listCols.map((k, i) => `<td class="${i === 0 ? 'sh-col-id' : ''}">${esc(display(ctx, k, r[k]))}</td>`).join('')}<td class="skh-num">${esc(r[cfg.confCol])}%</td></tr>`;
  }).join('');
}

function listCard(S) {
  const cfg = S.cfg, ctx = S.ctx;
  const counts = reviewCounts(ctx, S.saved);
  const tabs = segment('목록 보기', 'data-filter', [['all', `전체 ${counts.all}`], ['uncertain', `불확실 ${counts.uncertain}`], ['done', `${cfg.doneValue} ${counts.done}`]], S.filter);
  const conf = `<select class="sh-input" data-min-conf aria-label="신뢰도 필터"><option value=""${S.minConf === '' ? ' selected' : ''}>신뢰도 전체</option>${[50, 70, 90].map((n) => `<option value="${n}"${S.minConf === String(n) ? ' selected' : ''}>신뢰도 ${n}% 이상</option>`).join('')}</select>`;
  const html = `<div class="sh-sched-tools">${tabs}${conf}</div>
<input class="sh-input sh-full" type="search" data-q aria-label="검색" placeholder="${esc(ctx.d.entity.searchHint)}" value="${esc(S.q)}">
<div class="sh-listbox sh-compact" data-review-list><table class="skh-table"><thead><tr>${cfg.listCols.map((k) => `<th scope="col">${esc(colLabel(ctx, k))}</th>`).join('')}<th scope="col" class="skh-num">신뢰도</th></tr></thead><tbody data-list-body>${listBody(S)}</tbody></table></div>`;
  return card({ title: '문서 목록', sub: `${listOf(S).length}건 · 신뢰도 낮은 순`, html, attrs: 'data-list-card' });
}

function detailCard(S) {
  const cfg = S.cfg, ctx = S.ctx;
  const row = rowOf(S, S.selected);
  if (!row) return card({ title: '문서', html: empty('선택한 문서가 없습니다.') });
  const m = { ...row, [cfg.tagsCol]: S.saved[S.selected]?.tags ?? row[cfg.tagsCol], [cfg.statusCol]: S.saved[S.selected]?.status ?? row[cfg.statusCol] };
  const conf = Number(m[cfg.confCol]);
  const sub = [idOf(ctx, m), ...cfg.metaCols.map((k) => display(ctx, k, m[k]))].join(' · ');
  const choices = tagChoices(cfg, S.tags);
  const rec = S.saved[S.selected];
  const html = `<form class="sh-subform sh-subform--wide" data-review-form novalidate>
<div class="sh-memo sh-body-text" data-review-body>${esc(m[cfg.bodyCol])}</div>
<div class="sh-field"><span class="sh-lab">신뢰도</span><div class="sh-conf"><div class="sh-meter" role="img" aria-label="신뢰도 ${conf}%"><span style="width:${Math.max(0, Math.min(100, conf))}%"></span></div><span data-conf>${conf}%</span>${isUncertain(cfg, m) ? badge('불확실', 'urgent') : ''}${badge(m[cfg.statusCol], tone(ctx, cfg.statusCol, m[cfg.statusCol]))}</div></div>
<div class="sh-field"><span class="sh-lab">${esc(colLabel(ctx, cfg.tagsCol))}</span>
<div class="sh-tags" data-tags>${S.tags.map((t) => `<span class="sh-chip" data-tag="${esc(t)}">${esc(t)}<button type="button" class="sh-chip-x" data-remove-tag="${esc(t)}" aria-label="${esc(t)} 분류 삭제">×</button></span>`).join('')}${S.tags.length ? '' : '<span class="skh-muted">분류 없음</span>'}
<select class="sh-input" data-add-tag aria-label="분류 추가"><option value="">분류 추가</option>${choices.map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
<p class="skh-error" role="alert" data-err="tags">${esc(S.errs.tags || '')}</p></div>
<div class="sh-field"><label for="r-reason">${esc(cfg.reasonLabel)}</label><textarea class="sh-input sh-full" id="r-reason" rows="3" data-reason${S.errs.reason ? ' aria-invalid="true"' : ''}>${esc(S.reason)}</textarea>
<p class="skh-error" role="alert" data-err="reason">${esc(S.errs.reason || '')}</p></div>
<div class="sh-actions"><button type="submit" class="sh-primary"${S.saving ? ' disabled' : ''}>${esc(S.saving ? '저장 중…' : cfg.saveLabel)}</button>${rec ? `<span class="skh-muted" data-saved>저장됨 ${esc(String(rec.ts).slice(5, 16).replace('T', ' '))} · ${esc(rec.who)}</span>` : ''}<span class="sh-sched-msg" role="status" data-msg>${esc(S.msg)}</span></div></form>`;
  return card({ title: titleOf(ctx, m), sub, html });
}

export function pageHtml(S) {
  return `<div class="sh-grid"><div class="sh-span-5">${listCard(S)}</div><div class="sh-span-7">${detailCard(S)}</div></div>${limitLine(S.ctx, '분류와 판정 사유는 이 컴퓨터에만 저장되며 원본 데이터는 바뀌지 않음')}`;
}

let cur = null;
export function render(state, data) {
  cur = createState(data);
  return `<div class="sh-review" data-review>${pageHtml(cur)}</div>`;
}

// ---- 동작 ----
export function bind(root) {
  const S = cur;
  const host = root.querySelector('[data-review]');
  const paint = () => { host.innerHTML = pageHtml(S); };
  const fill = () => { // 검색 글자만 바뀔 때: 입력 칸을 다시 만들지 않고 목록만 갱신
    host.querySelector('[data-list-body]').innerHTML = listBody(S);
    host.querySelector('[data-list-card] .sh-question').textContent = `${listOf(S).length}건 · 신뢰도 낮은 순`;
  };
  const clearErr = (k) => {
    delete S.errs[k];
    const p = host.querySelector(`[data-err="${k}"]`);
    if (p) p.textContent = '';
    if (k === 'reason') host.querySelector('[data-reason]')?.removeAttribute('aria-invalid');
  };

  host.addEventListener('click', (e) => {
    const t = e.target;
    const f = t.closest('[data-filter]');
    if (f) { setFilter(S, f.dataset.filter); paint(); return; }
    const row = t.closest('[data-doc]');
    if (row) { selectDoc(S, row.dataset.doc); paint(); return; }
    const x = t.closest('[data-remove-tag]');
    if (x) { removeTagFrom(S, x.dataset.removeTag); paint(); }
  });
  host.addEventListener('change', (e) => {
    if (e.target.matches('[data-min-conf]')) { setMinConf(S, e.target.value); paint(); return; }
    if (e.target.matches('[data-add-tag]') && e.target.value) { addTagTo(S, e.target.value); clearErr('tags'); paint(); }
  });
  host.addEventListener('input', (e) => {
    if (e.target.matches('[data-q]')) { S.q = e.target.value; fill(); return; }
    if (e.target.matches('[data-reason]')) { setReason(S, e.target.value); if (e.target.value.trim()) clearErr('reason'); }
  });
  host.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-review-form]')) return;
    e.preventDefault();
    const out = buildSave(S, nowTs());
    S.errs = out.errs;
    if (!out.saved) { S.msg = ''; paint(); return; }
    S.saving = true; S.msg = ''; paint();
    try {
      const res = await fetch(`/api/review-${S.ctx.d.name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out.saved) });
      if (!res.ok) throw new Error(String(res.status));
      S.saved = out.saved;
      S.msg = `저장됨 · ${S.selected} · ${S.tags.join(', ')}`;
    } catch (err) {
      S.msg = `저장하지 못했습니다 (${err.message}). 서버에 연결되어 있지 않을 수 있습니다.`;
    }
    S.saving = false; paint();
  });
}
