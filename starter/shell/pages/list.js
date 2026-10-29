// pages/list.js — ② 목록: 정렬·필터·검색·상위 N 강조·여러 건 선택, 「보드 보기」로 W10 전환.
// 표 공통 기능 3개: CSV 내보내기(현재 필터·열, UTF-8 BOM) · D-day 열/기한 초과 배지(기한 열이 있을 때) · 선택한 행으로 안내문 일괄 생성.
// 상태(해시 쿼리): q 검색어 · f_<열>=값 필터 · sort/dir 정렬 · view=board · limit 표시 건수
import { rankTable, statusBoard } from '../widgets.js';
import {
  esc, buildHash, linkTo, limitLine, filterRows, tableCols, cell, evidenceLines, rulesFor, distinct, activeFilters, colLabel, titleOf, idOf,
  toCsv, csvFileName, makeNotices, noticeFileName, tpl, buildReportWorkbook, buildXlsx, downloadXlsx, filterParts, xlsxFileName,
} from '../util.js';

export const meta = (ctx) => ({
  name: '목록',
  action: { label: ctx.d.form.action, href: (s) => linkTo('form', s) },
});

export const selected = new Set(); // 브라우저에서 체크한 건 (정렬로 다시 그려도 유지)

export const filtered = filterRows;

const opts = (list, cur, all) => [`<option value=""${cur ? '' : ' selected'}>${esc(all)}</option>`, ...list.map((v) => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`)].join('');

export function listColumns(ctx) {
  return tableCols(ctx, 'shell').map((c, i) => ({ key: c.key, label: c.label, primary: i === 0, badge: !!c.badge, num: c.type === 'number' }));
}

export function render(state, data) {
  const { ctx } = data;
  const d = ctx.d, R = ctx.R;
  const rows = filterRows(ctx, state);
  const limit = Math.max(10, Number(state.limit) || 50);
  const board = state.view === 'board';
  const selectCols = d.cols.filter((c) => c.filter === 'select');
  const selectKeys = new Set(selectCols.map((c) => c.key));
  const chips = activeFilters(state).filter(([k]) => !selectKeys.has(k));
  const toolbar = `<div class="sh-toolbar">
<label>검색<input type="search" data-q="q" value="${esc(state.q || '')}" placeholder="${esc(d.entity.searchHint)}"></label>
${selectCols.map((c) => `<label>${esc(c.label)}<select data-q="f_${esc(c.key)}">${opts(distinct(ctx, c.key), state['f_' + c.key], '전체')}</select></label>`).join('\n')}
${chips.map(([k, v]) => `<span class="sh-chip">${esc(colLabel(ctx, k))} ${esc(v)} <button type="button" data-clear="f_${esc(k)}" aria-label="${esc(colLabel(ctx, k))} 필터 해제">해제</button></span>`).join('')}
<button type="button" data-act="view">${board ? '표 보기' : '보드 보기'}</button>
</div>`;
  const pick = `<div class="sh-pickbar"><span data-sel>선택 ${selected.size}건</span>
<button type="button" data-act="to-report">선택 건 리포트에 담기</button>
<button type="button" data-act="notice">선택 건 안내문 만들기</button>
<details class="sh-menu" data-menu><summary class="sh-btn" data-act="export">내보내기 ▾</summary><div class="sh-menu-list" role="menu"><button type="button" role="menuitem" data-act="csv" aria-label="CSV 내보내기">CSV</button><button type="button" role="menuitem" data-act="xlsx" aria-label="엑셀 내보내기">엑셀</button></div></details></div>
<section class="sh-section" data-notice hidden aria-live="polite"><h2>${esc(d.notice.title || '안내문')} 미리보기</h2><pre class="sh-memo" data-notice-text></pre>
<div class="sh-actions"><button type="button" data-act="notice-copy">복사</button> <button type="button" data-act="notice-download">내려받기 (.txt)</button> <small class="skh-muted" data-notice-count></small></div></section>`;
  let body;
  if (board) {
    const cols = d.cols.find((c) => c.key === R.status).values.map((s) => {
      const x = rows.filter((a) => a[R.status] === s.v);
      return { name: s.v, total: x.length, items: x.slice(0, 8).map((a) => ({ id: idOf(ctx, a), title: titleOf(ctx, a), meta: tpl(ctx, d.board.meta, a), href: `#/item/${encodeURIComponent(idOf(ctx, a))}` })) };
    });
    body = statusBoard({ title: d.board.title, columns: cols });
  } else {
    const cs = listColumns(ctx);
    const tableRows = rows.slice(0, limit).map((a) => {
      const o = { id: idOf(ctx, a), href: `#/item/${encodeURIComponent(idOf(ctx, a))}`, checked: selected.has(String(idOf(ctx, a))), tones: {},
        evidence: [`원 데이터: ${cs.slice(0, 5).map((c) => cell(ctx, a, c.key).text || '–').join(' / ')}`, ...(rulesFor(ctx, a).applied.slice(0, 1).map((r) => `규칙: ${r.text}`))] };
      for (const c of cs) { const v = cell(ctx, a, c.key); o[c.key] = v.text; o.tones[c.key] = v.tone; }
      return o;
    });
    body = rankTable({ id: 'list', title: `${d.entity.plural} ${rows.length}${d.entity.unit} 중 ${Math.min(limit, rows.length)}${d.entity.unit} 표시`, columns: cs, rows: tableRows, sortKey: state.sort || 'queue', sortDir: state.dir || 'asc', topN: 5, selectable: true });
    if (rows.length > limit) body += `<p><a href="${esc(buildHash('list', { ...state, limit: limit + 50 }))}">더 보기 (${rows.length - limit}건 남음) →</a></p>`;
  }
  return `<h2>${esc(d.entity.plural)} 목록</h2><p class="skh-muted">조건에 맞는 ${esc(d.entity.plural)} ${rows.length}${esc(d.entity.unit)} · 기본 정렬은 급한 순, 같으면 최근 순</p>${toolbar}${board ? '' : pick}${body}${limitLine(ctx, '목록은 기간·그룹 필터를 따르며 원 데이터 행은 상세에서 확인')}`;
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function bind(root, ctx) {
  const { state, data } = ctx;
  const c = data.ctx;
  root.querySelectorAll('[data-q]').forEach((el) => {
    el.addEventListener('change', () => ctx.setQuery({ [el.dataset.q]: el.value }));
  });
  root.querySelectorAll('[data-clear]').forEach((el) => el.addEventListener('click', () => ctx.setQuery({ [el.dataset.clear]: '' })));
  root.querySelectorAll('[data-sort]').forEach((el) => el.addEventListener('click', () => {
    const k = el.dataset.sort;
    ctx.setQuery({ sort: k, dir: state.sort === k && (state.dir || 'asc') === 'asc' ? 'desc' : 'asc' });
  }));
  root.querySelector('[data-act="view"]')?.addEventListener('click', () => ctx.setQuery({ view: state.view === 'board' ? '' : 'board' }));
  root.querySelectorAll('[data-pick]').forEach((el) => el.addEventListener('change', () => {
    if (el.checked) selected.add(el.dataset.pick); else selected.delete(el.dataset.pick);
    root.querySelector('[data-sel]').textContent = `선택 ${selected.size}건`;
  }));
  root.querySelector('[data-act="to-report"]')?.addEventListener('click', () => ctx.go(buildHash('report', { period: state.period, group: state.group, ids: [...selected].join(',') })));

  // 표 공통 기능 ① CSV: 지금 필터·정렬이 적용된 전체 행 × 화면에 보이는 열
  root.querySelector('[data-act="csv"]')?.addEventListener('click', () => {
    download(csvFileName(c), toCsv(c, filterRows(c, state), tableCols(c, 'shell').map((x) => x.key)), 'text/csv');
    root.querySelector('[data-menu]').open = false;
  });
  // 엑셀: 같은 행·열 + 「요약」 시트(지표 표). 파일 이름 = 도메인 제목-기준일-필터
  root.querySelector('[data-act="xlsx"]')?.addEventListener('click', () => {
    const keys = tableCols(c, 'shell').map((x) => x.key);
    downloadXlsx(xlsxFileName(c, filterParts(c, state)), buildXlsx(buildReportWorkbook(c, state, { rows: filterRows(c, state), keys })));
    root.querySelector('[data-menu]').open = false;
  });
  // ③ 안내문: 선택한 행의 값을 템플릿에 넣는다
  const panel = root.querySelector('[data-notice]');
  let text = '';
  root.querySelector('[data-act="notice"]')?.addEventListener('click', () => {
    const rows = filterRows(c, { ...state, sort: 'queue' }).filter((r) => selected.has(String(idOf(c, r))));
    panel.hidden = false;
    text = rows.length ? makeNotices(c, rows) : '';
    panel.querySelector('[data-notice-text]').textContent = text || '먼저 표에서 행을 선택하세요.';
    panel.querySelector('[data-notice-count]').textContent = `${rows.length}${c.d.entity.unit} 생성`;
  });
  panel?.querySelector('[data-act="notice-copy"]')?.addEventListener('click', async (e) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    e.target.textContent = '복사됨 ✓';
    setTimeout(() => { e.target.textContent = '복사'; }, 1500);
  });
  panel?.querySelector('[data-act="notice-download"]')?.addEventListener('click', () => { if (text) download(noticeFileName(c), `﻿${text}`, 'text/plain'); });
}
