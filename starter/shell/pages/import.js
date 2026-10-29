// pages/import.js — ⑨ CSV 올리기 #/import: 파일(끌어 놓기·버튼) → 인코딩 감지 → 열 맞추기 → 검증 → 미리보기 → 바꾸기/덧붙이기 → 반영 + 되돌리기(직전 한 벌).
// 파싱·검증·열 대응은 ../../domains/import.mjs (shadcn 판·명령줄 변환기와 같은 함수). 반영한 데이터는 서버(/api/import-<도메인>)에 쌓이고 샘플의 rows 를 대신한다.
// 도메인 설정에 import 키가 있을 때만 켜진다. shadcn 판(pages/import.tsx)과 같은 동작.
import { esc, linkTo, limitLine, nowTs, makeCtx } from '../util.js';
import {
  applyImported, autoMap, canRevert, decodeBytes, fitsStore, hasImported, importApi, importCols, importPrevApi, makeRecord, maxBytes, mergeRows, prevFor, PREVIEW_ROWS, readTable, requiredKeys, revertRecord, validateRows,
} from '../../domains/import.mjs';
import { card, empty, segment } from './parts.js';

export const bodyPrimary = true; // 본문에 검정 주 버튼(반영)이 있어 상단 행동 버튼은 테두리 버튼
export const enabled = (ctx) => !!ctx.d.import;
export const meta = (ctx) => ({
  name: ctx.d.import?.title ?? 'CSV 올리기',
  action: { label: '목록으로', href: (s) => linkTo('list', s) },
});

const MODES = [['replace', '바꾸기'], ['append', '덧붙이기']];
const MAX_ERRORS = 50;
const kb = (n) => `${Math.max(1, Math.round(n / 1024))}KB`;
const cellText = (v) => (Array.isArray(v) ? v.join(', ') : v === undefined || v === null ? '' : String(v));

// ---- 상태 ----
export function createState(data) {
  return { data, ctx: data.ctx, file: null, table: null, map: {}, mode: 'replace', result: null, error: '', busy: false, notice: '' };
}
export const baseRows = (S) => S.ctx.s.rows ?? []; // 덧붙이기의 바탕 = 지금 화면에 쓰이는 데이터
export function recompute(S) {
  if (!S.table) { S.result = null; return; }
  const ids = new Set(baseRows(S).map((r) => String(r[S.ctx.R.id])));
  S.result = validateRows(S.ctx.d, S.table, S.map, { existingIds: S.mode === 'append' ? ids : null });
}
export function loadText(S, name, size, text, encoding) {
  const table = readTable(text);
  if (!table.headers.length || !table.rows.length) { S.error = '데이터 행이 없는 파일입니다.'; S.table = null; S.result = null; return; }
  S.error = ''; S.notice = '';
  S.file = { name, size, encoding };
  S.table = table;
  S.map = autoMap(S.ctx.d, table.headers);
  recompute(S);
}

// ---- 그리기 ----
export function currentHtml(S) {
  const rec = S.data.imported, ctx = S.ctx;
  const line = hasImported(rec)
    ? `<p data-current>${esc(rec.meta.source)} · ${rec.meta.total}${esc(ctx.d.entity.unit)} · ${esc(String(rec.meta.at).replace('T', ' ').slice(0, 16))} · ${rec.meta.mode === 'append' ? `덧붙이기 +${rec.meta.added}` : '바꾸기'}</p>`
    : `<p data-current>기본 샘플 · ${ctx.s.rows.length}${esc(ctx.d.entity.unit)}</p>`;
  const undo = `<div class="sh-actions"><button type="button" class="sh-btn" data-undo${canRevert(S.data.prevImported) && !S.busy ? '' : ' disabled'}>되돌리기</button>${S.notice ? `<span role="status" data-notice>${esc(S.notice)}</span>` : ''}</div>`;
  return card({ title: '현재 데이터', html: `<div class="sh-subform">${line}${undo}</div>` });
}

export function fileHtml(S) {
  const f = S.file, max = maxBytes(S.ctx.d);
  const info = f ? `<p data-file-info>${esc(f.name)} · ${kb(f.size)} · ${esc(f.encoding)} · ${S.table.rows.length}행</p>` : '';
  return card({
    title: 'CSV 파일', sub: `.csv · 최대 ${kb(max)}`,
    attrs: 'data-drop', // 카드 전체가 끌어 놓는 자리
    html: `<div class="sh-subform"><div class="sh-actions"><button type="button" class="sh-btn" data-pick>${f ? '다른 파일 고르기' : 'CSV 파일 고르기'}</button><input type="file" accept=".csv,text/csv" hidden data-file aria-label="CSV 파일"></div>${info}${S.error ? `<p class="skh-error" role="alert" data-error>${esc(S.error)}</p>` : ''}</div>`,
  });
}

export function mapHtml(S) {
  const d = S.ctx.d, req = new Set(requiredKeys(d)), first = S.table.rows[0]?.cells ?? [];
  const body = importCols(d).map((c) => {
    const i = S.map[c.key];
    const opts = [`<option value="-1"${i < 0 ? ' selected' : ''}>대응 안 함</option>`, ...S.table.headers.map((h, k) => `<option value="${k}"${i === k ? ' selected' : ''}>${esc(h)}</option>`)].join('');
    return `<tr><td>${esc(c.label)}${req.has(c.key) ? ' <span class="skh-badge skh-badge--info">필수</span>' : ''}</td><td><select class="sh-input" data-map="${esc(c.key)}" aria-label="${esc(c.label)} 열">${opts}</select></td><td>${i >= 0 ? esc(cellText(first[i])) : ''}</td></tr>`;
  }).join('');
  return card({ title: '열 맞추기', sub: `CSV 열 ${S.table.headers.length}개`, html: `<div class="sh-listbox" data-map-table><table class="skh-table"><thead><tr><th scope="col">열</th><th scope="col">CSV 머리글</th><th scope="col">첫 행 값</th></tr></thead><tbody>${body}</tbody></table></div>` });
}

export function errorsHtml(r, d) {
  if (r.blocked) {
    const names = r.missingRequired.map((k) => d.cols.find((c) => c.key === k)?.label ?? k);
    return `<p class="skh-error" role="alert" data-blocked>필수 열을 맞추지 못했습니다: ${esc(names.join(', '))}</p>`;
  }
  if (!r.errors.length) return '<p data-no-errors>오류가 없습니다.</p>';
  const rows = r.errors.slice(0, MAX_ERRORS).map((e) => `<tr data-err-line="${e.line}"><td>${e.line}</td><td>${esc(e.label)}</td><td>${esc(e.value)}</td><td>${esc(e.reason)}</td></tr>`).join('');
  return `<div class="sh-listbox" data-errors><table class="skh-table"><thead><tr><th scope="col">행</th><th scope="col">열</th><th scope="col">값</th><th scope="col">이유</th></tr></thead><tbody>${rows}</tbody></table></div>${r.errors.length > MAX_ERRORS ? `<p class="skh-muted">외 ${r.errors.length - MAX_ERRORS}건</p>` : ''}`;
}

export function verifyHtml(S) {
  const r = S.result, d = S.ctx.d;
  const label = r.errorRowCount ? `정상 행만 반영 (${r.okCount}행)` : '반영';
  const can = !r.blocked && r.okCount > 0 && !S.busy;
  const html = `<div class="sh-subform">
<div class="sh-inline"><span class="sh-lab">반영 방식</span>${segment('반영 방식', 'data-mode', MODES, S.mode)}</div>
${errorsHtml(r, d)}
<div class="sh-actions"><button type="button" class="sh-primary" data-apply${can ? '' : ' disabled'}>${label}</button></div></div>`;
  return card({ title: '검증', sub: r.blocked ? '필수 열 대응 필요' : `정상 ${r.okCount}행 · 오류 ${r.errorRowCount}행`, html });
}

export function previewHtml(S) {
  const d = S.ctx.d, cols = importCols(d).filter((c) => S.map[c.key] >= 0);
  const recs = S.result.records.slice(0, PREVIEW_ROWS);
  const head = `<th scope="col">행</th>${cols.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('')}`;
  const body = recs.map((r, n) => {
    const bad = new Map(r.errors.map((e) => [e.key, e.reason]));
    const cells = cols.map((c) => {
      const raw = S.table.rows[n].cells[S.map[c.key]] ?? '';
      return bad.has(c.key) ? `<td class="skh-error" title="${esc(bad.get(c.key))}"><strong>${esc(raw) || '(빈 칸)'}</strong></td>` : `<td>${esc(cellText(r.rec[c.key]))}</td>`;
    }).join('');
    return `<tr${r.errors.length ? ' data-row-error="true"' : ''}><td>${r.line}</td>${cells}</tr>`;
  }).join('');
  return card({ title: '미리보기', sub: `처음 ${recs.length}행`, html: `<div class="sh-listbox" data-preview><table class="skh-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` });
}

export function pageHtml(S) {
  const top = `<div class="sh-grid"><div class="sh-span-8">${fileHtml(S)}</div><div class="sh-span-4">${currentHtml(S)}</div></div>`;
  const rest = S.table && S.result
    ? `<div class="sh-grid"><div class="sh-span-6">${mapHtml(S)}</div><div class="sh-span-6">${verifyHtml(S)}</div><div class="sh-span-12">${previewHtml(S)}</div></div>`
    : `<div class="sh-grid"><div class="sh-span-12">${card({ title: '미리보기', html: empty('아직 고른 파일이 없습니다.') })}</div></div>`;
  return `${top}${rest}${limitLine(S.ctx, '반영한 데이터는 서버에 저장되며 직전 한 벌만 되돌릴 수 있음')}`;
}

let cur = null;
export function render(state, data) {
  cur = createState(data);
  return `<div class="sh-import" data-import>${pageHtml(cur)}</div>`;
}

// ---- 동작 ----
async function save(name, body) {
  const res = await fetch(`/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(res.status === 413 ? '서버 저장 상한(1MB)을 넘습니다.' : `저장하지 못했습니다(${res.status}).`);
}

export function bind(root) {
  const S = cur;
  const host = root.querySelector('[data-import]');
  const paint = () => { host.innerHTML = pageHtml(S); };

  const take = async (file) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) { S.error = 'CSV 파일(.csv)만 올릴 수 있습니다.'; paint(); return; }
    if (file.size > maxBytes(S.ctx.d)) { S.error = `파일이 크기 상한(${kb(maxBytes(S.ctx.d))})을 넘습니다.`; paint(); return; }
    const { text, encoding } = decodeBytes(new Uint8Array(await file.arrayBuffer()));
    loadText(S, file.name, file.size, text, encoding);
    paint();
  };

  const apply = async () => {
    const r = S.result;
    if (!r || r.blocked || !r.okCount) return;
    const d = S.ctx.d;
    const rec = makeRecord({ rows: mergeRows(baseRows(S), r.okRows, S.mode), source: S.file.name, encoding: S.file.encoding, mode: S.mode, at: nowTs(), added: r.okCount, skipped: r.errorRowCount });
    if (!fitsStore(rec)) { S.error = '반영할 데이터가 서버 저장 상한(1MB)을 넘습니다. 파일을 줄이거나 바꾸기로 올리세요.'; paint(); return; }
    S.busy = true; S.error = ''; paint();
    try {
      const prev = prevFor(S.data.imported);
      await save(importPrevApi(d.name), prev);
      await save(importApi(d.name), rec);
      S.data.prevImported = prev; S.data.imported = rec;
      S.data.ctx = S.ctx = makeCtx(d, applyImported(S.data.baseSample, rec), S.data.settings.values);
      S.notice = `${r.okCount}행을 ${S.mode === 'append' ? '덧붙였' : '바꿔 반영했'}습니다.`;
      S.file = null; S.table = null; S.result = null;
    } catch (e) { S.error = e.message; }
    S.busy = false; paint();
  };

  const undo = async () => {
    const prev = S.data.prevImported;
    if (!canRevert(prev)) return;
    const d = S.ctx.d;
    S.busy = true; paint();
    try {
      const back = revertRecord(prev);
      await save(importApi(d.name), back);
      await save(importPrevApi(d.name), {});
      S.data.imported = back; S.data.prevImported = {};
      S.data.ctx = S.ctx = makeCtx(d, applyImported(S.data.baseSample, back), S.data.settings.values);
      S.notice = '직전 데이터로 되돌렸습니다.'; S.error = '';
    } catch (e) { S.error = e.message; }
    S.busy = false; paint();
  };

  host.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-pick]')) host.querySelector('[data-file]').click();
    else if (t.closest('[data-apply]')) apply();
    else if (t.closest('[data-undo]')) undo();
    else { const m = t.closest('[data-mode]'); if (m && S.table) { S.mode = m.dataset.mode; recompute(S); paint(); } }
  });
  host.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-file]')) take(t.files[0]);
    else if (t.matches('[data-map]')) { S.map = { ...S.map, [t.dataset.map]: Number(t.value) }; recompute(S); paint(); }
  });
  host.addEventListener('dragover', (e) => { if (e.target.closest('[data-drop]')) { e.preventDefault(); e.target.closest('[data-drop]').dataset.over = 'true'; } });
  host.addEventListener('dragleave', (e) => { const z = e.target.closest('[data-drop]'); if (z) delete z.dataset.over; });
  host.addEventListener('drop', (e) => { if (e.target.closest('[data-drop]')) { e.preventDefault(); take(e.dataTransfer.files[0]); } });
}
