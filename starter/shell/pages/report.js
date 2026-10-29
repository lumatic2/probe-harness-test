// pages/report.js — ⑤ 리포트·내보내기: 분석 요약 + W2/W3 + 「한계」 문단 + 메모 미리보기(복사·내려받기) + 조건 A/B 2열 비교.
// 상태(해시 쿼리): ids 선택한 건(쉼표) · ap/ag 조건 A 기간·그룹 · bp/bg 조건 B. buildMemo/buildSummary 는 core.mjs 의 순수 함수.
import { trendChart, barList, panel } from '../widgets.js';
import { buildReportWorkbook, buildXlsx, downloadXlsx, filterParts, xlsxFileName, toCsv, csvFileName, filterRows, tableCols } from '../util.js';
import { buildInputs, buildMemo, buildSummary, metricsFor, compareRows, compareDiff, windowDates, esc, fmt, sign, limitLine, linkTo, PERIODS, groupAll, ALL } from '../util.js';

export const meta = (ctx) => ({
  name: '리포트',
  action: { label: '목록에서 건 고르기', href: (s) => linkTo('list', s) },
});

export { buildSummary, buildMemo };

function conds(state) {
  const other = state.period === '14d' ? '7d' : state.period === '3d' ? '7d' : '14d';
  return {
    a: { period: state.ap || state.period, group: state.ag || state.group },
    b: { period: state.bp || other, group: state.bg || state.group },
  };
}

const sel = (name, list, cur) => `<select data-q="${name}">${list.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;

export function render(state, data) {
  const { ctx } = data;
  const d = ctx.d;
  const i = buildInputs(ctx, state);
  const c = conds(state);
  const ma = metricsFor(ctx, windowDates(ctx, { period: c.a.period }), c.a.group);
  const mb = metricsFor(ctx, windowDates(ctx, { period: c.b.period }), c.b.group);
  const periodOpts = PERIODS.map((p) => [p.v, p.label]);
  const groupOpts = [[ALL, groupAll(ctx)], ...(d.group.values || []).map((p) => [p, p])];
  const rowsA = compareRows(ctx, ma), rowsB = compareRows(ctx, mb);
  const cmp = rowsA.map(([label, va, dec], k) => `<tr><th scope="row">${esc(label)}</th><td class="skh-num">${fmt(va, dec)}</td><td class="skh-num">${fmt(rowsB[k][1], dec)}</td><td class="skh-num">${sign(compareDiff(va, rowsB[k][1]) ?? NaN, dec)}</td></tr>`).join('');
  return `<p class="sh-print-head" data-print-head><strong>${esc(d.app.title)} · 분석 리포트</strong> · 데이터 기준 ${esc(d.app.asOf)} · 적용 필터 ${esc(filterParts(ctx, state).join(' · '))}</p>
<div class="sh-actions sh-report-bar"><details class="sh-menu" data-menu><summary class="sh-btn" data-act="export">내보내기 ▾</summary><div class="sh-menu-list" role="menu"><button type="button" role="menuitem" data-act="csv" aria-label="CSV 내보내기">CSV</button><button type="button" role="menuitem" data-act="xlsx" aria-label="엑셀 내보내기">엑셀</button></div></details><button type="button" data-act="print">인쇄</button></div>
<h2>분석 리포트</h2>
<p class="sh-summary">${esc(buildSummary(ctx, state))}</p>
<div class="sh-grid">
<div class="sh-span-6">${panel({ no: 'W2', title: i.w2.title, html: trendChart(i.w2) })}</div>
<div class="sh-span-6">${panel({ no: 'W3', title: i.w3.title, html: barList(i.w3) })}</div>
</div>
<section class="sh-section"><h2>한계</h2><p>${esc(d.app.limit)}. 이 리포트의 숫자는 위 기간·${esc(d.group.label)} 필터로 집계한 값이며, 원인은 확정하지 않았고 상세 화면의 원 데이터 행으로 확인해야 합니다.</p></section>
<section class="sh-section"><h2>조건 A/B 비교</h2>
<div class="sh-two">
<fieldset><legend>조건 A</legend><label>기간 ${sel('ap', periodOpts, c.a.period)}</label> <label>${esc(d.group.label)} ${sel('ag', groupOpts, c.a.group)}</label></fieldset>
<fieldset><legend>조건 B</legend><label>기간 ${sel('bp', periodOpts, c.b.period)}</label> <label>${esc(d.group.label)} ${sel('bg', groupOpts, c.b.group)}</label></fieldset>
</div>
<div class="skh-table-scroll"><table class="skh-table"><caption>조건 A 와 조건 B 의 같은 지표 비교 (차이 = A − B)</caption><thead><tr><th scope="col">지표</th><th scope="col" class="skh-num">조건 A</th><th scope="col" class="skh-num">조건 B</th><th scope="col" class="skh-num">차이</th></tr></thead><tbody>${cmp}</tbody></table></div></section>
<section class="sh-section"><h2>메모 미리보기</h2>
<pre class="sh-memo" data-memo>${esc(buildMemo(ctx, state))}</pre>
<div class="sh-actions"><button type="button" data-act="copy">복사</button> <button type="button" data-act="download">내려받기</button> <small class="skh-muted">복사: 붙여넣기는 ⌘V</small></div></section>
${limitLine(ctx, '비교는 서로 다른 기간 길이를 그대로 견주므로 건수 대신 일 평균을 함께 볼 것')}`;
}

function saveBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function bind(root, ctx) {
  const c = ctx.data.ctx, st = ctx.state, cd = conds(st);
  const rowsKeys = () => ({ rows: filterRows(c, st), keys: tableCols(c, 'shell').map((x) => x.key) });
  root.querySelector('[data-act="print"]')?.addEventListener('click', () => window.print());
  root.querySelector('[data-act="csv"]')?.addEventListener('click', () => {
    const { rows, keys } = rowsKeys();
    saveBlob(csvFileName(c), new Blob([toCsv(c, rows, keys)], { type: 'text/csv;charset=utf-8' }));
    root.querySelector('[data-menu]').open = false;
  });
  root.querySelector('[data-act="xlsx"]')?.addEventListener('click', () => {
    const { rows, keys } = rowsKeys();
    const ma = metricsFor(c, windowDates(c, { period: cd.a.period }), cd.a.group), mb = metricsFor(c, windowDates(c, { period: cd.b.period }), cd.b.group);
    downloadXlsx(xlsxFileName(c, filterParts(c, st)), buildXlsx(buildReportWorkbook(c, st, { rows, keys, cmp: [ma, mb] })));
    root.querySelector('[data-menu]').open = false;
  });
  root.querySelectorAll('[data-q]').forEach((el) => el.addEventListener('change', () => ctx.setQuery({ [el.dataset.q]: el.value })));
  const text = () => root.querySelector('[data-memo]').textContent;
  const copy = root.querySelector('[data-act="copy"]');
  copy?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text()); } catch {
      const ta = document.createElement('textarea'); ta.value = text(); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    copy.textContent = '복사됨 ✓';
    setTimeout(() => { copy.textContent = '복사'; }, 1500);
  });
  root.querySelector('[data-act="download"]')?.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([`﻿${text()}`], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `memo-${ctx.data.ctx.today}.txt`; a.click();
    URL.revokeObjectURL(url);
  });
}
