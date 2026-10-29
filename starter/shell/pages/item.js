// pages/item.js — ③ 상세: 한 건의 정보 + 근거(원 데이터 행·계산 규칙) + 같은 대상의 최근 건 + 변경 이력(/api/decisions-<도메인>).
// 주소: #/item/<ID>
import { alertList } from '../widgets.js';
import { esc, badge, titleOf, limitLine, linkTo, findRow, rulesFor, relatedRows, rawLines, shortTs, tone, tpl, idOf, ddayText, isOverdue, cell } from '../util.js';

export const meta = (ctx) => ({
  name: '상세',
  action: { label: `이 건 ${ctx.d.form.action}`, href: (s) => linkTo('form', s, {}, s.id) },
});

export const historyRows = (ctx, decisions, id) => decisions.filter((x) => String(x.ref) === String(id));

export function historyTable(ctx, decisions, withRef) {
  const f = ctx.d.form;
  const rows = [...decisions].reverse().slice(0, 8);
  if (!rows.length) return `<div class="skh-empty"><p>${esc(f.emptyHistory)}</p></div>`;
  const th = f.fields.map((x) => `<th${x.type === 'number' ? ' class="skh-num"' : ''}>${esc(x.label.replace(/\s*\(.*\)$/, ''))}</th>`).join('');
  const tr = rows.map((x) => `<tr><td>${esc(shortTs(x.ts))}</td>${withRef ? `<td><a href="#/item/${encodeURIComponent(x.ref)}">${esc(x.ref)}</a></td>` : `<td>${esc(x.who)}</td>`}${f.fields.map((fl) => `<td${fl.type === 'number' ? ' class="skh-num"' : ''}>${esc(x[fl.key])}</td>`).join('')}</tr>`).join('');
  return `<div class="skh-table-scroll"><table class="skh-table"><thead><tr><th>시각</th><th>${withRef ? esc(ctx.d.entity.singular) : '담당'}</th>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

export function render(state, data) {
  const { ctx, decisions } = data;
  const d = ctx.d, R = ctx.R;
  const a = findRow(ctx, state.id);
  if (!a) {
    return `<h2>상세</h2><div class="skh-alert"><strong>${esc(d.entity.singular)} ${esc(state.id || '')}을(를) 찾을 수 없습니다.</strong><p><a href="${linkTo('list', state)}">목록으로 돌아가기</a></p></div>${limitLine(ctx)}`;
  }
  const kv = (rows) => `<table class="skh-table sh-kv"><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;
  const { applied, others } = rulesFor(ctx, a);
  const rel = d.related ? relatedRows(ctx, a) : [];
  const hist = historyRows(ctx, decisions, state.id);
  const raw = rawLines(ctx, a).map(([k, v]) => { const nm = d.cols.find((c) => c.key === k)?.names?.[v]; return [k, esc(nm ? `${v} (${nm})` : v)]; });
  const dd = ddayText(ctx, a);
  const meta = [R.owner && a[R.owner], R.group && `${a[R.group]}${d.group.suffix ? ' ' + d.group.suffix : ''}`, R.date && shortTs(a[R.date]), dd].filter(Boolean).join(' · ');
  const badges = [R.priority && badge(a[R.priority], tone(ctx, R.priority, a[R.priority])), R.status && badge(a[R.status], tone(ctx, R.status, a[R.status])), isOverdue(ctx, a) ? badge(dd, 'urgent') : ''].join(' ');
  const relItems = rel.slice(0, 5).map((x) => {
    const c = cell(ctx, x, d.related.badge);
    return { badge: c.text, tone: c.tone, title: tpl(ctx, d.related.item, x), ts: shortTs(x[R.date]), href: `#/item/${encodeURIComponent(idOf(ctx, x))}`, note: tpl(ctx, d.related.note || '', x) };
  });
  return `<h2>${esc(idOf(ctx, a))} · ${esc(titleOf(ctx, a))}</h2>
<p>${badges} <span class="skh-muted">${esc(meta)}</span></p>
<div class="sh-grid">
<section class="skh-panel sh-card sh-span-6"><div class="skh-panel-head"><h2>근거 — 원 데이터 행</h2></div>${kv(raw)}</section>
<section class="skh-panel sh-card sh-span-6"><div class="skh-panel-head"><h2>근거 — 계산 규칙</h2></div><ul class="sh-rules">${applied.map((r) => `<li>${esc(r.text)} (이 건에 적용)</li>`).join('')}${others.map((r) => `<li>${esc(r.text)}</li>`).join('')}</ul></section>
${d.related ? `<section class="skh-panel sh-card sh-span-6"><div class="skh-panel-head"><h2>${esc(d.related.title)}</h2></div>${alertList({ title: d.related.title, items: relItems })}</section>` : ''}
<section class="skh-panel sh-card sh-span-6"><div class="skh-panel-head"><h2>${esc(d.form.itemHistoryTitle)}</h2><a href="${linkTo('form', state, {}, state.id)}">${esc(d.form.action)} →</a></div>${hist.length ? historyTable(ctx, hist, false) : '<div class="skh-empty"><p>아직 기록된 변경이 없습니다.</p></div>'}</section>
</div>
${limitLine(ctx, '변경 이력은 이 셸의 /api/decisions-<도메인> 에 저장된 것만 보임')}`;
}
