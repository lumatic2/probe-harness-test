// pages/form.js — ④ 입력·판정: 대상 고르기 + 설정(domain.json form.fields)의 입력칸. 검증 실패는 aria-invalid + 메시지, 저장은 POST /api/decisions-<도메인>.
// 주소: #/form 또는 #/form/<ID>. validate 는 core.mjs 의 순수 함수라 node --test 로 검증한다.
import { esc, linkTo, limitLine, validate, makeDecision, formOpenRows, idOf, titleOf } from '../util.js';
import { historyTable } from './item.js';

export const meta = () => ({
  name: '입력·판정',
  action: { label: '목록으로', href: (s) => linkTo('list', s) },
});

const field = (name, label, control) => `<div class="sh-field"><label for="f-${name}">${esc(label)}</label>${control}<span class="skh-error" id="err-${name}" role="alert"></span></div>`;

function control(f) {
  if (f.type === 'radio') return `<fieldset class="sh-field"><legend>${esc(f.label)}</legend>${f.options.map((o) => `<label><input type="radio" name="${esc(f.key)}" value="${esc(o)}"> ${esc(o)}</label>`).join(' ')}<span class="skh-error" id="err-${esc(f.key)}" role="alert"></span></fieldset>`;
  if (f.type === 'textarea') return field(f.key, f.label, `<textarea id="f-${esc(f.key)}" name="${esc(f.key)}" rows="3" aria-describedby="err-${esc(f.key)}"></textarea>`);
  const type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
  return field(f.key, f.label, `<input id="f-${esc(f.key)}" name="${esc(f.key)}" type="${type}"${f.type === 'number' ? ` min="${f.min ?? 0}" step="1"` : ''} aria-describedby="err-${esc(f.key)}">`);
}

export function render(state, data) {
  const { ctx, decisions } = data;
  const f = ctx.d.form;
  const options = formOpenRows(ctx, state).map((a) => `<option value="${esc(idOf(ctx, a))}" label="${esc(titleOf(ctx, a))}">`).join('');
  return `<h2>${esc(f.title)}</h2><p class="skh-muted">${esc(f.intro)}</p>
<form class="sh-form" novalidate>
${field('ref', f.refLabel, `<input id="f-ref" name="ref" list="f-ref-list" value="${esc(state.id || '')}" aria-describedby="err-ref" autocomplete="off"><datalist id="f-ref-list">${options}</datalist>`)}
${f.fields.map(control).join('\n')}
<div><button type="submit" class="sh-primary">저장</button> <span id="sh-saved" role="status"></span></div>
</form>
<h2>${esc(f.historyTitle)}</h2><div id="sh-history">${historyTable(ctx, decisions, true)}</div>
${limitLine(ctx, '저장은 이 컴퓨터의 data/store 에만 기록되며 다른 사람에게 공유되지 않음')}`;
}

export function bind(root, bctx) {
  const form = root.querySelector('form');
  const ctx = bctx.data.ctx;
  const keys = ['ref', ...ctx.d.form.fields.map((x) => x.key)];
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const v = {};
    for (const k of keys) v[k] = fd.get(k) ?? '';
    v.ref = String(v.ref).trim();
    const errs = validate(ctx, v);
    for (const k of keys) {
      root.querySelector(`#err-${k}`).textContent = errs[k] || '';
      const el = form.querySelector(`input[name="${k}"]:not([type="radio"]), textarea[name="${k}"]`);
      if (el) el.setAttribute('aria-invalid', errs[k] ? 'true' : 'false');
    }
    const saved = root.querySelector('#sh-saved');
    if (Object.keys(errs).length) { saved.textContent = ''; form.querySelector(`[name="${Object.keys(errs)[0]}"]`).focus(); return; }
    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    const rec = makeDecision(ctx, bctx.data.decisions, v, ts);
    const next = [...bctx.data.decisions, rec];
    try {
      const res = await fetch(`/api/${bctx.data.apiName}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      if (!res.ok) throw new Error(String(res.status));
      bctx.data.decisions = next;
      saved.textContent = `저장됨 ✓ ${ts.slice(11)}`;
      root.querySelector('#sh-history').innerHTML = historyTable(ctx, next, true);
      form.reset();
    } catch (e) {
      saved.textContent = `저장하지 못했습니다 (${e.message}). 서버가 켜져 있는지 확인하세요.`;
    }
  });
}
