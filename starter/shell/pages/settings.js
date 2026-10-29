// pages/settings.js — ⑨ 기준값 설정 #/settings: 규칙 파라미터(domain.json 의 params)를 바꾸고, 저장 전에 「지금 기준 → 바꾼 기준」 결과를 옆에서 비교한다.
// 저장은 /api/settings-<도메인> 에 {values, history} 한 덩어리(사유 한 줄 필수). 저장하지 않으면 다른 화면에는 아무 영향이 없다.
// 계산은 전부 ../../domains/core.mjs (paramValues · makeSettingsRecord · whatIf) — shadcn 판(pages/settings.tsx)과 같은 동작.
import { esc, linkTo, limitLine, fmt, sign, nowTs, makeCtx, paramDefs, paramValues, paramError, paramText, optionValue, makeSettingsRecord, whatIf } from '../util.js';
import { card, empty } from './parts.js';

export const bodyPrimary = true; // 본문에 검정 주 버튼(저장)이 있어 상단 행동 버튼은 테두리 버튼
export const enabled = (ctx) => paramDefs(ctx.raw).length > 0;
export const meta = () => ({
  name: '기준값 설정',
  action: { label: '대시보드로', href: (s) => linkTo('dashboard', s) },
});

const optLabel = (o) => (o !== null && typeof o === 'object' ? o.label ?? o.v : o);
const pu = (u) => (u === '%' ? '%p' : u);
const cellVal = (m, v) => (v === null || v === undefined ? '–' : `${fmt(v, m.decimals)}${m.unit === '개' ? '' : m.unit}`);
const targetText = (t, met, unit) => (t === null ? '–' : `${fmt(t, 1).replace(/\.0$/, '')}${unit} ${met === null ? '' : met ? '달성' : '미달'}`.trim());

// ---- 그리기 ----
export function paramRow(def, value, defaultText) {
  const k = esc(def.key);
  let control;
  if (def.type === 'bool') control = `<label class="sh-switch"><input type="checkbox" role="switch" id="p-${k}" data-param-in="${k}"${value ? ' checked' : ''}><span class="sh-switch-track" aria-hidden="true"></span><span class="sh-switch-text">${value ? '켬' : '끔'}</span></label>`;
  else if (def.type === 'enum') control = `<select class="sh-input" id="p-${k}" data-param-in="${k}">${def.options.map((o) => `<option value="${esc(optionValue(o))}"${optionValue(o) === value ? ' selected' : ''}>${esc(optLabel(o))}</option>`).join('')}</select>`;
  else control = `<span class="sh-num-in"><input class="sh-input" id="p-${k}" type="number" inputmode="decimal" data-param-in="${k}" value="${esc(value)}" min="${def.min ?? ''}" max="${def.max ?? ''}" step="${def.step ?? 1}" aria-describedby="perr-${k}">${def.unit ? `<span class="sh-unit">${esc(def.unit)}</span>` : ''}</span>`;
  return `<div class="sh-param" data-param="${k}">
<div class="sh-param-head"><label for="p-${k}">${esc(def.label)}</label><span class="sh-lab">${esc(def.affects || '')} · 기본 ${esc(defaultText)}</span></div>
${control}<span class="skh-error" id="perr-${k}" role="alert"></span></div>`;
}

export function compareHtml(r) {
  if (!r.changed.length) return empty('바꾼 값이 없습니다.');
  const rows = r.metrics.map((m) => {
    const d = m.diff;
    const diffText = d === null ? '–' : d === 0 ? '0' : `${sign(d, m.decimals)}${m.unit === '개' ? '' : pu(m.unit)}`;
    const tgt = m.targetBefore === null ? '–' : m.targetBefore === m.targetAfter && m.metBefore === m.metAfter ? targetText(m.targetAfter, m.metAfter, m.unit) : `${targetText(m.targetBefore, m.metBefore, m.unit)} → ${targetText(m.targetAfter, m.metAfter, m.unit)}`;
    return `<tr data-metric="${esc(m.key)}"><th scope="row">${esc(m.label)}</th><td class="skh-num">${esc(cellVal(m, m.before))}</td><td class="skh-num">${esc(cellVal(m, m.after))}</td><td class="skh-num" data-diff>${esc(diffText)}</td><td>${esc(tgt)}</td></tr>`;
  }).join('');
  const table = `<div class="skh-table-scroll"><table class="skh-table"><thead><tr><th scope="col">지표</th><th scope="col" class="skh-num">지금 기준</th><th scope="col" class="skh-num">바꾼 기준</th><th scope="col" class="skh-num">차이</th><th scope="col">목표</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  let flips = '';
  if (r.flips.has) {
    const moves = r.flips.moves.map((m) => `${esc(m.from)} → ${esc(m.to)} ${fmt(m.n)}건`).join(' · ');
    const list = r.flips.rows.length
      ? `<div class="skh-table-scroll"><table class="skh-table"><thead><tr><th scope="col">판정이 바뀌는 행</th><th scope="col">지금</th><th scope="col">바꾼 기준</th></tr></thead><tbody>${r.flips.rows.map((x) => `<tr><td><a href="#/item/${encodeURIComponent(x.id)}">${esc(x.title)}</a></td><td>${esc(x.before)}</td><td>${esc(x.after)}</td></tr>`).join('')}</tbody></table></div>`
      : '';
    flips = `<div class="sh-flip" data-flips><p class="sh-flip-head"><strong data-flip-count>판정이 바뀌는 행 ${fmt(r.flips.count)}건</strong>${moves ? ` <span class="skh-muted">${moves}</span>` : ''}</p>${r.flips.count ? list : ''}${r.flips.count > r.flips.rows.length ? `<p class="skh-muted">상위 ${r.flips.rows.length}건만 표시</p>` : ''}</div>`;
  }
  return table + flips;
}

export function historyHtml(history) {
  if (!history.length) return empty('저장된 변경이 없습니다.');
  const rows = [...history].reverse().map((h) => `<tr><td class="sh-col-id">${esc(h.ts)}</td><td>${esc(h.label)}</td><td>${esc(h.from)} → ${esc(h.to)}</td><td>${esc(h.reason)}</td></tr>`).join('');
  return `<div class="skh-table-scroll"><table class="skh-table" data-history><thead><tr><th scope="col">시각</th><th scope="col">항목</th><th scope="col">이전 → 이후</th><th scope="col">사유</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

let cur = null;
export function render(state, data) {
  const ctx = data.ctx;
  const defs = paramDefs(ctx.raw);
  const defaults = paramValues(ctx.raw, {});
  cur = { ctx, defs, defaults, draft: { ...ctx.settings } };
  const r = whatIf(ctx, cur.draft);
  const flash = data.flash || '';
  data.flash = '';
  return `<div data-settings><div class="sh-grid">
<div class="sh-span-5">${card({
    title: '기준값',
    html: `<form class="sh-subform sh-subform--wide" novalidate data-settings-form>${defs.map((p) => paramRow(p, ctx.settings[p.key], paramText(p, defaults[p.key]))).join('')}
<div class="sh-field"><label for="s-reason">사유</label><input class="sh-input sh-full" id="s-reason" data-reason maxlength="120" placeholder="사유 한 줄 (필수)" aria-describedby="serr-reason"><span class="skh-error" id="serr-reason" role="alert"></span></div>
<div class="sh-actions"><button type="submit" class="sh-primary" data-save>저장</button><button type="button" class="sh-btn" data-reset>기본값으로 되돌리기</button><span class="sh-sched-msg" data-saved role="status">${esc(flash)}</span></div></form>`,
  })}</div>
<div class="sh-span-7">${card({ title: '가정 바꿔 보기', sub: `${r.basis} · 지금 기준 → 바꾼 기준`, html: `<div data-compare>${compareHtml(r)}</div>` })}</div>
<div class="sh-span-12">${card({ title: '변경 이력', html: `<div data-history-slot>${historyHtml(data.settings.history)}</div>` })}</div>
</div>${limitLine(ctx)}</div>`;
}

export function bind(root, bctx) {
  const S = cur;
  const data = bctx.data;
  const host = root.querySelector('[data-settings]');
  const form = host.querySelector('[data-settings-form]');
  const compare = host.querySelector('[data-compare]');
  const reason = host.querySelector('[data-reason]');
  const savedMsg = host.querySelector('[data-saved]');
  const read = (def, el) => (def.type === 'bool' ? el.checked : def.type === 'enum' ? el.value : el.value.trim() === '' ? NaN : Number(el.value));
  const showErrors = () => {
    for (const def of S.defs) {
      const m = paramError(def, S.draft[def.key]);
      const err = host.querySelector(`#perr-${def.key}`);
      const el = host.querySelector(`#p-${def.key}`);
      err.textContent = m;
      el.setAttribute('aria-invalid', m ? 'true' : 'false');
    }
  };
  const preview = () => { compare.innerHTML = compareHtml(whatIf(S.ctx, S.draft)); };
  const setInputs = (values) => {
    for (const def of S.defs) {
      const el = host.querySelector(`#p-${def.key}`);
      if (def.type === 'bool') { el.checked = !!values[def.key]; el.nextElementSibling.nextElementSibling.textContent = values[def.key] ? '켬' : '끔'; } else el.value = values[def.key];
    }
  };
  const onInput = (e) => {
    const el = e.target.closest('[data-param-in]');
    if (!el) return;
    const def = S.defs.find((p) => p.key === el.dataset.paramIn);
    S.draft[def.key] = read(def, el);
    if (def.type === 'bool') el.nextElementSibling.nextElementSibling.textContent = el.checked ? '켬' : '끔';
    savedMsg.textContent = '';
    showErrors();
    preview();
  };
  form.addEventListener('input', onInput);
  form.addEventListener('change', onInput);
  host.querySelector('[data-reset]').addEventListener('click', () => { S.draft = { ...S.defaults }; setInputs(S.draft); savedMsg.textContent = ''; showErrors(); preview(); });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const rec = makeSettingsRecord(S.ctx.raw, data.settings, S.draft, reason.value, nowTs().slice(0, 16).replace('T', ' '));
    showErrors();
    const e = rec.errors || {};
    host.querySelector('#serr-reason').textContent = e._reason || e._ || '';
    reason.setAttribute('aria-invalid', e._reason || e._ ? 'true' : 'false');
    if (rec.errors) { host.querySelector(e._reason || e._ ? '#s-reason' : `#p-${Object.keys(e)[0]}`)?.focus(); return; }
    try {
      const res = await fetch(`/api/${data.settingsApi}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec.saved) });
      if (!res.ok) throw new Error(String(res.status));
      data.settings = rec.saved;
      data.ctx = makeCtx(S.ctx.raw, S.ctx.s, rec.saved.values);
      data.flash = `저장됨 ✓ ${rec.entries[0].ts.slice(11)}`;
      bctx.go(location.hash); // 같은 주소를 다시 그려 새 기준값으로 목록·대시보드 계산과 하단 한계 줄을 맞춘다
    } catch (err) {
      savedMsg.textContent = `저장하지 못했습니다 (${err.message}). 서버가 켜져 있는지 확인하세요.`;
    }
  });
}
