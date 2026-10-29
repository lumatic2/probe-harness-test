// pages/schedule.js — ⑥ 일정 격자 #/schedule: 행 = 자원, 열 = 시간 슬롯, 막대 = 일정. 충돌은 옅은 주황 + 진한 주황 글자·테두리(urgent 배지와 같은 규칙).
// 막대를 끌어 옮기거나 폼으로 시간·자원을 고치면 충돌을 바로 다시 계산하고, 충돌이 없을 때만 「확정」으로 /api/schedule-<도메인> 에 저장한다.
// 보기: 일정이 하루에 몰리면 「일」(시 단위 열), 여러 날이면 「주」(일 단위 열) — 설정 schedule.scale 이 auto 일 때. 모든 막대에 라벨이 있고 넘치면 말줄임.
// 계산은 전부 ../../domains/schedule.mjs (설정: domain.json 의 schedule) — 이 파일은 그리기와 상태 바꾸기만 한다. shadcn 판(pages/schedule.tsx)과 같은 동작.
import { esc, linkTo, limitLine, distinct, shortTs, nowTs, badge } from '../util.js';
import {
  confirmPayload, dayList, daysWithItems, fromInput, hourInfo, hourRange, layoutRows, pickScale, scheduleModel, shifted, slotInfo, toInput, toMs, toTs, validRange,
} from '../../domains/schedule.mjs';
import { card, empty, segment } from './parts.js';

const LANE_H = 28;

export const bodyPrimary = true; // 본문에 검정 주 버튼(확정)이 있어 상단 행동 버튼은 테두리 버튼
export const enabled = (ctx) => !!ctx.d.schedule;
export const meta = (ctx) => ({
  name: ctx.d.schedule?.title ?? '일정 격자',
  action: { label: '목록으로', href: (s) => linkTo('list', s) },
});

// ---- 상태 (화면 밖에서도 쓰는 순수 함수) ----
export function createState(data) {
  const ctx = data.ctx, cfg = ctx.d.schedule;
  const info = slotInfo(cfg);
  const first = scheduleModel(ctx, {});
  const confirmed = data.stores?.schedule ?? {};
  const withItems = daysWithItems(first.sched, info);
  return {
    ctx, cfg, info, snap: cfg.snapMinutes ?? 60, confirmed, edits: confirmed.edits ?? {},
    scale: pickScale(cfg.scale, first.sched, info),
    day: withItems.includes(ctx.today) ? ctx.today : withItems[0] ?? dayList(info)[0]?.day ?? '',
    selected: '', draft: { resource: '', start: '', end: '' }, formErr: '', msg: '', saving: false,
  };
}
export const modelOf = (S, edits = S.edits) => scheduleModel(S.ctx, edits);
export const dirty = (S) => JSON.stringify(S.edits) !== JSON.stringify(S.confirmed.edits ?? {});
export const canConfirm = (S) => !S.saving && modelOf(S).conflicts.length === 0 && (dirty(S) || !S.confirmed.ts);
export const payloadOf = (S, ts) => confirmPayload(modelOf(S), S.edits, ts);
export function pickDay(S, day) { S.day = day; S.scale = 'hour'; }
export const itemOf = (S, model) => model.sched.find((x) => x.id === S.selected) ?? model.unassigned.find((x) => x.id === S.selected);

// 고르면 폼 초깃값을 그 건의 현재 값으로 (시간이 없으면 격자 첫날 9~12시)
export function selectItem(S, id) {
  S.selected = id;
  const item = itemOf(S, modelOf(S));
  S.formErr = '';
  if (!item) return;
  const free = !item.start || !item.end;
  S.draft = {
    resource: item.resource || distinct(S.ctx, S.cfg.resource)[0] || '',
    start: toInput(free ? toTs(S.info.t0 + 9 * 3600000) : item.start),
    end: toInput(free ? toTs(S.info.t0 + 12 * 3600000) : item.end),
  };
}

// 고친 값을 반영. 시작·종료가 둘 다 있는데 종료가 시작보다 앞서면 거절하고 글자를 돌려준다(반영 안 함)
export function applyEdit(S, id, patch) {
  if ('start' in patch && 'end' in patch && !validRange(patch.start, patch.end)) return '종료는 시작보다 뒤여야 합니다.';
  S.edits = { ...S.edits, [id]: { ...S.edits[id], ...patch } };
  return '';
}

// ---- 그리기 ----
export function viewOf(S, model) {
  return S.scale === 'hour' ? hourInfo(S.day, ...hourRange(model.sched, S.day)) : S.info;
}
const layoutOf = (model, view) => layoutRows(model.sched, view, view.unit === 'day' ? 0.9 / view.count : 0);

export function gridHtml(S, model) {
  const cfg = S.cfg;
  const view = viewOf(S, model);
  const rows = layoutOf(model, view);
  const cols = `grid-template-columns:repeat(${view.count},minmax(0,1fr))`;
  const todayIdx = view.unit === 'day' ? (toMs(`${S.ctx.today}T00:00:00`) - view.t0) / view.slotMs : -1;
  const head = view.slots.map((s, i) => `<div class="sh-sg-slot${i === Math.floor(todayIdx) ? ' sh-sg-today-slot' : ''}">${view.unit === 'hour' ? `${esc(s.label)}시` : esc(s.label)}${s.sub ? `<span>${esc(s.sub)}</span>` : ''}</div>`).join('');
  const lines = view.slots.map(() => '<div></div>').join('');
  const body = rows.length ? rows.map((r) => `<div class="sh-sg-row" data-resource="${esc(r.resource)}">
<div class="sh-sg-label" title="${esc(r.resource)}">${esc(r.resource)}</div>
<div class="sh-sg-track" style="height:${r.lanes * LANE_H + 8}px"><div class="sh-sg-cols" style="${cols}">${lines}</div>${todayIdx >= 0 && todayIdx < view.count ? `<div class="sh-sg-today" style="left:${(todayIdx / view.count) * 100}%"></div>` : ''}${r.items.map((x) => {
    const rules = x.conflict ? x.rules.map((i) => cfg.rules[i].label).join(', ') : '';
    return `<button type="button" class="sh-bar" data-bar="${esc(x.id)}" data-conflict="${x.conflict}"${S.selected === x.id ? ' data-selected="true"' : ''} aria-label="${esc(`${x.id} ${x.label} ${shortTs(x.start)}~${shortTs(x.end)}${x.conflict ? ' 충돌' : ''}`)}" title="${esc(`${x.id} · ${x.label}\n${shortTs(x.start)} ~ ${shortTs(x.end)}${rules ? `\n충돌: ${rules}` : ''}`)}" style="left:${x.left * 100}%;width:max(${x.width * 100}%,10px);top:${4 + x.lane * LANE_H}px"><span class="sh-bar-label">${esc(x.label)}</span></button>`;
  }).join('')}</div></div>`).join('') : empty(S.scale === 'hour' ? '이 날 올릴 일정이 없습니다.' : '이 기간에 올릴 일정이 없습니다.');
  return `<div class="sh-sg" data-schedule-grid data-scale="${S.scale}"><div class="sh-sg-in">
<div class="sh-sg-row sh-sg-head"><div class="sh-sg-label">${esc(cfg.resourceLabel ?? '자원')}</div><div class="sh-sg-slots" style="${cols}">${head}</div></div>
${body}</div></div>`;
}

function conflictsHtml(S, model) {
  if (!model.conflicts.length) return empty('충돌이 없습니다.');
  return `<div class="skh-table-scroll sh-compact"><table class="skh-table" data-conflicts><thead><tr><th scope="col">규칙</th><th scope="col">대상</th><th scope="col">겹친 일정</th></tr></thead><tbody>${model.conflicts.map((c, i) => `<tr data-conflict-row="${i}" data-pick="${esc(c.ids[0])}"${c.ids.includes(S.selected) ? ' data-state="selected"' : ''}><td>${badge(c.label, 'urgent')}</td><td>${esc(c.key)}</td><td class="skh-muted">${esc(c.ids.slice(0, 3).join(' · '))}${c.ids.length > 3 ? ` 외 ${c.ids.length - 3}건` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

function formHtml(S, model) {
  const item = itemOf(S, model);
  if (!item) return empty('선택한 일정이 없습니다.');
  const cfg = S.cfg, d = S.draft;
  return `<form class="sh-subform" data-sched-form novalidate>
<div class="sh-field"><label for="s-res">${esc(cfg.resourceLabel ?? '자원')}</label><select class="sh-input" id="s-res" name="resource">${distinct(S.ctx, cfg.resource).map((r) => `<option${r === d.resource ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
<div class="sh-field"><label for="s-start">시작</label><input class="sh-input" id="s-start" name="start" type="datetime-local" value="${esc(d.start)}"></div>
<div class="sh-field"><label for="s-end">종료</label><input class="sh-input" id="s-end" name="end" type="datetime-local" value="${esc(d.end)}"${S.formErr ? ' aria-invalid="true"' : ''}></div>
<p class="skh-error" role="alert" data-form-err>${esc(S.formErr)}</p>
<div><button type="submit" class="sh-btn" data-apply>적용</button></div></form>`;
}

function unassignedHtml(S, model) {
  const cfg = S.cfg;
  if (!model.unassigned.length) return empty('미배정 일정이 없습니다.');
  return `<div class="skh-table-scroll sh-compact"><table class="skh-table" data-unassigned><thead><tr><th scope="col">ID</th><th scope="col">일정</th><th scope="col">${esc(cfg.resourceLabel ?? '자원')}</th></tr></thead><tbody>${model.unassigned.map((u) => `<tr data-unassigned-row="${esc(u.id)}" data-pick="${esc(u.id)}"${S.selected === u.id ? ' data-state="selected"' : ''}><td>${esc(u.id)}</td><td>${esc(u.label)}</td><td>${esc(u.resource)}</td></tr>`).join('')}</tbody></table></div>`;
}

export function pageHtml(S) {
  const cfg = S.cfg, ctx = S.ctx;
  const model = modelOf(S);
  const item = itemOf(S, model);
  const days = dayList(S.info);
  const sub = `${model.count}건 · 충돌 ${model.conflicts.length}건 · ${cfg.unassignedTitle ?? '미배정'} ${model.unassigned.length}건${S.confirmed.ts ? ` · 확정본 ${shortTs(S.confirmed.ts)}` : ''}`;
  const tools = `<button type="button" class="sh-btn" data-undo${dirty(S) ? '' : ' disabled'}>되돌리기</button><button type="button" class="sh-primary" data-confirm${canConfirm(S) ? '' : ' disabled'}>${esc(S.saving ? '저장 중…' : cfg.confirmLabel ?? '확정')}</button>`;
  const control = `<div class="sh-sched-tools" data-schedule-tools>${segment('보기 단위', 'data-scale-btn', [['hour', '일'], ['day', '주']], S.scale)}<select class="sh-input" data-day-select aria-label="날짜">${days.map((d) => `<option value="${esc(d.day)}"${d.day === S.day ? ' selected' : ''}>${esc(d.label)}</option>`).join('')}</select><span class="sh-sched-msg" role="status" data-msg>${esc(S.msg)}</span></div>`;
  return `${card({ title: cfg.title, sub, tools, html: `${control}${gridHtml(S, model)}` })}
<div class="sh-grid">
<div class="sh-span-4">${card({ title: '충돌 목록', sub: model.conflicts.length ? `${model.conflicts.length}건` : '', html: conflictsHtml(S, model) })}</div>
<div class="sh-span-4">${card({ title: '선택한 일정 수정', sub: item ? `${item.id} · ${item.label}` : '', html: formHtml(S, model) })}</div>
<div class="sh-span-4">${card({ title: cfg.unassignedTitle ?? '미배정', sub: `${model.unassigned.length}건`, html: unassignedHtml(S, model) })}</div>
</div>
${limitLine(ctx, '확정한 일정은 이 컴퓨터에만 저장되며 충돌이 없을 때만 확정할 수 있음')}`;
}

let cur = null;
export function render(state, data) {
  cur = createState(data);
  return `<div class="sh-sched" data-sched>${pageHtml(cur)}</div>`;
}

// ---- 동작 ----
export function bind(root) {
  const S = cur;
  const host = root.querySelector('[data-sched]');
  const paint = () => { host.innerHTML = pageHtml(S); };
  let drag = null;

  host.addEventListener('click', async (e) => {
    const t = e.target;
    const seg = t.closest('[data-scale-btn]');
    if (seg) { S.scale = seg.dataset.scaleBtn; S.msg = ''; paint(); return; }
    const pick = t.closest('[data-pick]');
    if (pick) { selectItem(S, pick.dataset.pick); paint(); return; }
    const bar = t.closest('[data-bar]');
    if (bar && e.detail === 0) { selectItem(S, bar.dataset.bar); paint(); return; } // 키보드로 고름 (마우스는 pointerup 에서)
    if (t.closest('[data-undo]')) { S.edits = S.confirmed.edits ?? {}; S.selected = ''; S.msg = ''; paint(); return; }
    if (t.closest('[data-confirm]')) {
      const body = payloadOf(S, nowTs());
      if (!body) { S.msg = `충돌 ${modelOf(S).conflicts.length}건이 남아 있어 확정할 수 없습니다.`; paint(); return; }
      S.saving = true; paint();
      try {
        const res = await fetch(`/api/schedule-${root.dataset.name || cur.ctx.d.name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(String(res.status));
        S.confirmed = body;
        S.msg = `일정을 확정했습니다 · ${body.count}건 · ${body.ts.slice(11)}`;
      } catch (err) {
        S.msg = `저장하지 못했습니다 (${err.message}). 서버에 연결되어 있지 않을 수 있습니다.`;
      }
      S.saving = false; paint();
    }
  });
  host.addEventListener('change', (e) => {
    if (e.target.matches('[data-day-select]')) { pickDay(S, e.target.value); S.msg = ''; paint(); }
  });
  host.addEventListener('input', (e) => {
    const f = e.target.closest('[data-sched-form]');
    if (f && e.target.name) S.draft[e.target.name] = e.target.value;
  });
  host.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-sched-form]')) return;
    e.preventDefault();
    const model = modelOf(S);
    const item = itemOf(S, model);
    if (!item) return;
    const err = applyEdit(S, item.id, { resource: S.draft.resource, start: fromInput(S.draft.start), end: fromInput(S.draft.end) });
    S.formErr = err; S.msg = '';
    paint();
  });

  // 막대 끌기: 놓기 전에도 옮긴 값으로 충돌을 다시 계산해 막대 색만 바꾼다(요소를 다시 만들면 끌기가 끊긴다). 놓으면 반영하고 다시 그린다.
  host.addEventListener('pointerdown', (e) => {
    const bar = e.target.closest('[data-bar]');
    if (!bar || e.button !== 0) return;
    const model = modelOf(S);
    const x = model.sched.find((v) => v.id === bar.dataset.bar);
    if (!x) return;
    bar.setPointerCapture(e.pointerId);
    host.querySelectorAll('[data-bar][data-selected]').forEach((b) => b.removeAttribute('data-selected'));
    bar.dataset.selected = 'true';
    const view = viewOf(S, model);
    const track = bar.closest('.sh-sg-track');
    drag = { id: x.id, start: x.start, end: x.end, x0: e.clientX, w: track.getBoundingClientRect().width || 1, totalMin: (view.t1 - view.t0) / 60000, minutes: 0, bar };
  });
  host.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const raw = ((e.clientX - drag.x0) / drag.w) * drag.totalMin;
    drag.minutes = Math.round(raw / S.snap) * S.snap;
    drag.bar.style.transform = `translateX(${(drag.minutes / drag.totalMin) * drag.w}px)`;
    const live = modelOf(S, { ...S.edits, [drag.id]: { ...S.edits[drag.id], ...shifted(drag, drag.minutes, S.snap) } });
    const flagged = new Set(live.conflictIds);
    host.querySelectorAll('[data-bar]').forEach((b) => { b.dataset.conflict = String(flagged.has(b.dataset.bar)); });
  });
  const finish = (cancel) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (cancel) { selectItem(S, S.selected); paint(); return; }
    selectItem(S, d.id);
    if (d.minutes !== 0) { applyEdit(S, d.id, shifted(d, d.minutes, S.snap)); selectItem(S, d.id); S.msg = ''; }
    paint();
  };
  host.addEventListener('pointerup', () => finish(false));
  host.addEventListener('pointercancel', () => finish(true));
}
