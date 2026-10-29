// widgets.js — 위젯 13종. 전부 "입력 객체 → HTML 문자열" 순수 함수 (DOM 없음, Node 에서 테스트됨).
// 색·글꼴은 shell.css 의 클래스(sh-*)와 design.css 의 var(--skh-*) 만 쓴다. 여기에는 색 값이 없다.
// 차트는 손 SVG(class="skh-chart", viewBox, 축·단위 라벨). 강조색은 하나, 나머지 회색. 의미는 글자로도 적는다.
// 입력 객체를 만드는 쪽은 util.js 의 buildInputs(sample, state) — 과제 데이터를 붙일 땐 이 입력 모양만 맞추면 된다.
//
// | 번호 | 함수           | 입력 모양 (선택은 ?)                                                                                   | 답하는 질문 |
// |------|----------------|--------------------------------------------------------------------------------------------------------|-------------|
// | W1   | metricRow      | {title, items:[{label,value,unit,decimals?,delta(null 가능),better:'up'|'down'|null(방향 없음 — 증감만 회색),spark:[수]}], prevLabel?}   | 지금 숫자가 얼마고 나아졌나 |
// | W2   | trendChart     | {title,unit,series:[{name,points:[{x,y}]}],target?:{value,label},baseline?,anomalies?:[{from,to,label}],area?} | 시간에 따라 어떻게 변했나 |
// | W3   | barList        | {title,unit,rows:[{label,value,href?}],topN?,otherLabel?}                                                | 어디가 가장 큰가 |
// | W4   | stackedBar     | {title,unit,rows:[{label,parts:[{name,value}]}],highlight?}                                              | 무엇으로 이루어졌나 |
// | W5   | heatmap        | {title,unit,rowLabels,colLabels,values:[[수]]}                                                           | 언제·어디에 몰리나 |
// | W6   | progressBars   | {title,due?,rows:[{label,value,target,unit,decimals?,lowerIsBetter?}]}                                   | 목표까지 얼마 남았나 |
// | W7   | funnel         | {title,unit,steps:[{label,value}]}                                                                       | 어느 단계에서 빠지나 |
// | W8   | rankTable      | {id,title,columns:[{key,label,num?,primary?,badge?,sortable?}],rows:[{id,...,href?,evidence?:[글]}],sortKey?,sortDir?,topN?,selectable?} | 먼저 볼 것은 무엇인가 |
// | W9   | alertList      | {title,items:[{badge(배지 글자),tone,title,ts,href?,note?}]}                                                          | 지금 문제가 되는 것은 |
// | W10  | statusBoard    | {title,columns:[{name,total?,items:[{id,title,meta?,href?}]}]}                                           | 일이 어느 단계에 몇 건 있나 |
// | W11  | timeline       | {title,days:['YYYY-MM-DD'],today?,items:[{label,start,end,owner?}]}                                      | 언제 무엇이 겹치나 |
// | W12  | activityFeed   | {title,items:[{ts,who,what,href?}]}                                                                      | 누가 무엇을 바꿨나 |
// | W13  | floorMap       | {title,cols,cells:[{id,row,col,state:states 중 하나,label,note?,href?,dim?}],states?}               | 공간 어디에서 나나 |
// | W17  | chatWidget     | {title?,suggestions?:[글],messages?:[{role,content,source?,reason?}]}  (동작 = chat.js mountChat)         | 이 화면 데이터를 AI 에게 물으면 |
//
// SVG 위젯(W2~W7, W11)은 폭 약 560px 칸(격자 span-6)에 맞춰 그린다 — 칸이 너무 좁거나 넓으면 글자 크기가 달라진다.
// panel({no,title,question,html,href,linkLabel}) 는 위젯을 칸(skh-panel)에 끼우는 껍데기. 지표 줄(W1)은 칸 없이 바로 쓴다.

import { esc, fmt, niceTicks, PERIODS, TONE_BADGE } from './util.js';
import { badgeText, reasonText } from '../domains/chat.mjs';
import { recorderHtml } from './recorder.js'; // W18 녹음·전사 — 입력 객체 없음. 동작은 recorder.js 의 bindRecorder(el, {onText}) 로 붙인다(위젯 모음·AI 피드백 화면이 그렇게 한다)

const W = 560;
const n0 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : 0);
const cut = (s, n) => { const t = String(s ?? ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const empty = (msg = '표시할 데이터가 없습니다.') => `<div class="skh-empty"><p>${esc(msg)}</p></div>`;
const svg = (h, label, inner) => `<svg class="skh-chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}">${inner}</svg>`;
const unitDiff = (u) => (u === '%' ? '%p' : u || '');
const mm = (d) => String(d).slice(5, 10);

// 카드 머리: 왼쪽 제목(16px)+설명 한 줄, 오른쪽 기간 세그먼트(seg)와 작은 텍스트 버튼(href). seg 는 periodSeg(state.period) 가 만든 HTML.
export function periodSeg(current) {
  return `<div class="sh-seg-group" role="group" aria-label="기간">${PERIODS.map((p) => `<button type="button" data-period="${esc(p.v)}" aria-pressed="${p.v === current}">${esc(p.label.replace('최근 ', ''))}</button>`).join('')}</div>`;
}

export function panel({ no, title, question, html, href, linkLabel = '자세히 ›', seg = '' }) {
  return `<section class="skh-panel sh-card sh-widget" data-widget="${esc(no)}">
<div class="skh-panel-head"><div class="sh-head-text"><h2>${esc(title)}</h2>${question ? `<p class="sh-question">${esc(question)}</p>` : ''}</div><div class="sh-head-tools">${seg}${href ? `<a class="sh-textbtn" href="${esc(href)}">${esc(linkLabel)}</a>` : ''}</div></div>
${html}</section>`;
}

// ---------- W1 지표 줄 ----------
function sparkline(vals) {
  const pts = (vals || []).filter(Number.isFinite);
  if (pts.length < 2) return '';
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const xy = pts.map((v, i) => `${n0((i * 96) / (pts.length - 1))},${n0(32 - ((v - lo) / span) * 24)}`);
  return `<svg class="skh-chart sh-spark" viewBox="0 0 96 40" preserveAspectRatio="none" aria-hidden="true"><polygon class="sh-area" points="0,40 ${xy.join(' ')} 96,40"/><polyline class="sh-stroke-accent sh-nofill sh-spark-line" points="${xy.join(' ')}"/></svg>`;
}

export function metricRow({ title = '핵심 지표', items = [], prevLabel = '' }) {
  if (!items.length) return empty();
  const cells = items.map((it) => {
    const dec = it.decimals ?? 0;
    let delta;
    if (!Number.isFinite(it.delta)) delta = '<span class="sh-delta-chip skh-muted">비교 없음</span>';
    else if (Math.abs(it.delta) < 0.5 * 10 ** -dec) delta = '<span class="sh-delta-chip skh-muted">– 변동 없음</span>';
    else {
      const up = it.delta > 0;
      const good = it.better === 'down' ? !up : up;
      if (!it.better) delta = `<span class="sh-delta-chip skh-muted">${up ? '▲' : '▼'} ${fmt(Math.abs(it.delta), dec)}${esc(unitDiff(it.unit))}</span>`;
      else delta = `<span class="sh-delta-chip ${good ? 'skh-delta--improved' : 'skh-delta--worsened'}">${up ? '▲' : '▼'} ${fmt(Math.abs(it.delta), dec)}${esc(unitDiff(it.unit))} ${good ? '개선' : '악화'}</span>`;
    }
    return `<div class="sh-metric" role="listitem"><div class="sh-metric-label">${esc(it.label)}</div>
<div class="sh-metric-main"><span class="sh-metric-num"><span class="sh-metric-value">${fmt(it.value, dec)}</span><span class="skh-unit">${esc(it.unit || '')}</span></span><span class="sh-metric-delta">${delta}</span></div>
${it.read ? `<div class="sh-metric-read">${esc(it.read)}</div>` : ''}${it.sub ? `<div class="sh-metric-sub">${esc(it.sub)}</div>` : ''}${sparkline(it.spark)}</div>`;
  }).join('');
  return `<div class="sh-metrics" role="list" aria-label="${esc(title)}">${cells}</div>${prevLabel ? `<small class="skh-muted sh-metric-note">${esc(prevLabel)}</small>` : ''}`;
}

// ---------- W2 추세 선·면 ----------
export function trendChart({ title = '추세', unit = '', series = [], target, baseline, anomalies = [], area = false }) {
  const vals = series.flatMap((s) => s.points.map((p) => p.y)).filter(Number.isFinite);
  if (!vals.length) return empty();
  const extra = [target?.value, baseline?.value].filter(Number.isFinite);
  let lo = Math.min(...vals, ...extra), hi = Math.max(...vals, ...extra);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const L = 52, R = 24, T = 22, B = 34, H = 240;
  const n = Math.max(...series.map((s) => s.points.length));
  const X = (i) => (n <= 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const dec = hi - lo < 8 ? 1 : 0;
  let g = '';
  for (let k = 0; k < 4; k++) {
    const v = lo + ((hi - lo) * k) / 3;
    g += `<line class="skh-grid" x1="${L}" x2="${W - R}" y1="${n0(Y(v))}" y2="${n0(Y(v))}"/><text x="${L - 6}" y="${n0(Y(v) + 5)}" text-anchor="end">${fmt(v, dec)}</text>`;
  }
  g += `<line class="skh-axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>`;
  const step = Math.max(1, Math.ceil(n / 7));
  const pts0 = series[0].points;
  for (let i = 0; i < n; i += step) g += `<text x="${n0(X(i))}" y="${H - 12}" text-anchor="middle">${esc(pts0[i]?.x ?? '')}</text>`;
  const half = n <= 1 ? 20 : (W - L - R) / (n - 1) / 2;
  for (const a of anomalies) {
    const x1 = Math.max(L, X(a.from) - half), x2 = Math.min(W - R, X(a.to) + half);
    g += `<rect class="sh-shade" x="${n0(x1)}" y="${T}" width="${n0(x2 - x1)}" height="${H - T - B}"><title>${esc(a.label || '이상 구간')}</title></rect><text x="${n0(x1 + 4)}" y="${T + 14}">${esc(a.label || '이상 구간')}</text>`;
  }
  for (const [ref, cls] of [[target, 'sh-stroke-ink'], [baseline, 'sh-stroke-muted']]) {
    if (ref && Number.isFinite(ref.value)) g += `<line class="${cls} sh-dash" x1="${L}" x2="${W - R}" y1="${n0(Y(ref.value))}" y2="${n0(Y(ref.value))}"/><text x="${W - R}" y="${n0(Y(ref.value) + 17)}" text-anchor="end">${esc(ref.label || '')}</text>`;
  }
  series.forEach((s, si) => {
    const segs = [];
    let cur = [];
    s.points.forEach((p, i) => { if (Number.isFinite(p.y)) cur.push([n0(X(i)), n0(Y(p.y))]); else if (cur.length) { segs.push(cur); cur = []; } });
    if (cur.length) segs.push(cur);
    for (const seg of segs) {
      const d = seg.map((q, i) => `${i ? 'L' : 'M'}${q[0]} ${q[1]}`).join(' ');
      if (area && si === 0 && seg.length > 1) g += `<path class="sh-area" d="${d} L${seg[seg.length - 1][0]} ${H - B} L${seg[0][0]} ${H - B} Z"/>`;
      g += `<path class="${si === 0 ? 'sh-stroke-accent' : 'sh-stroke-muted'} sh-line" d="${d}"/>`;
    }
    const last = [...s.points].reverse().find((p) => Number.isFinite(p.y));
    if (last) {
      const i = s.points.lastIndexOf(last);
      g += `<circle class="${si === 0 ? 'sh-fill-accent' : 'sh-fill-muted'}" cx="${n0(X(i))}" cy="${n0(Y(last.y))}" r="4"/><text class="skh-value" x="${n0(X(i))}" y="${n0(Y(last.y) - 9)}" text-anchor="end">${fmt(last.y, 1)}${esc(unit)}</text>`;
    }
  });
  g += `<text x="4" y="14">단위: ${esc(unit || '값')}</text>`;
  const legend = series.map((s, i) => `<span><span class="sh-sw ${i === 0 ? 'sh-bg-accent' : 'sh-bg-muted'}"></span>${esc(s.name)}</span>`).join('');
  const notes = [target ? `점선 = ${target.label}` : '', baseline ? `회색 점선 = ${baseline.label}` : '', anomalies.length ? `음영 = ${anomalies.map((a) => a.label || '이상 구간').join(', ')}` : ''].filter(Boolean).join(' · ');
  return `${svg(H, title, g)}<div class="skh-legend">${legend}${notes ? `<span>${esc(notes)}</span>` : ''}</div>`;
}

// ---------- W3 범주 가로 막대 ----------
export function barList({ title = '범주별', unit = '', rows = [], topN = 5, otherLabel = '나머지 묶음' }) {
  const s = rows.filter((r) => Number.isFinite(r.value)).sort((a, b) => b.value - a.value);
  if (!s.length) return empty();
  const list = s.slice(0, topN);
  const rest = s.slice(topN);
  if (rest.length) list.push({ label: `${otherLabel} (${rest.length}개)`, value: rest.reduce((t, r) => t + r.value, 0), other: true });
  const L = 200, R = 56, rowH = 30, T = 8, H = T + list.length * rowH + 22;
  const max = Math.max(...list.map((r) => r.value)) || 1;
  let g = `<line class="skh-axis" x1="${L}" x2="${L}" y1="${T}" y2="${H - 22}"/>`;
  list.forEach((r, i) => {
    const y = T + i * rowH, bw = Math.max(1, ((W - L - R) * r.value) / max);
    const label = `<text x="${L - 8}" y="${y + 19}" text-anchor="end">${esc(cut(r.label, 15))}</text>`;
    g += r.href && !r.other ? `<a href="${esc(r.href)}">${label}</a>` : label;
    g += `<rect class="${r.other ? 'sh-fill-context' : i === 0 ? 'sh-fill-accent' : 'sh-fill-muted'}" x="${L}" y="${y + 5}" width="${n0(bw)}" height="18"><title>${esc(r.label)}: ${fmt(r.value)}${esc(unit)}</title></rect><text class="skh-value" x="${n0(L + bw + 6)}" y="${y + 19}">${fmt(r.value)}</text>`;
  });
  g += `<text x="${W - R}" y="${H - 6}" text-anchor="end">단위: ${esc(unit || '값')}</text>`;
  return svg(H, title, g);
}

// ---------- W4 100% 누적 막대 ----------
const GRAY = [['sh-fill-muted', 'sh-bg-muted', 'sh-on-light'], ['sh-fill-context', 'sh-bg-context', 'sh-on-light'], ['sh-fill-soft', 'sh-bg-soft', 'sh-on-light']];
export function stackedBar({ title = '구성', unit = '', rows = [], highlight }) {
  const valid = rows.filter((r) => r.parts.reduce((t, p) => t + (Number.isFinite(p.value) ? p.value : 0), 0) > 0);
  if (!valid.length) return empty();
  const names = rows[0].parts.map((p) => p.name);
  let gi = 0;
  const style = {};
  for (const nme of names) style[nme] = nme === highlight ? ['sh-fill-accent', 'sh-bg-accent', 'sh-on-dark'] : GRAY[gi++ % GRAY.length];
  const L = 64, R = highlight ? 104 : 72, rowH = 36, T = 8, H = T + valid.length * rowH + 30;
  const bw = W - L - R;
  let g = '';
  valid.forEach((r, i) => {
    const total = r.parts.reduce((t, p) => t + p.value, 0), y = T + i * rowH;
    let x = L;
    g += `<text x="${L - 8}" y="${y + 21}" text-anchor="end">${esc(r.label)}</text>`;
    for (const p of r.parts) {
      if (!(p.value > 0)) continue;
      const w = (bw * p.value) / total, st = style[p.name] || GRAY[0];
      g += `<rect class="${st[0]} sh-seg" x="${n0(x)}" y="${y + 4}" width="${n0(w)}" height="24"><title>${esc(r.label)} ${esc(p.name)}: ${fmt(p.value)}${esc(unit)} (${fmt((p.value / total) * 100)}%)</title></rect>`;
      if (w >= 40 && p.name !== highlight) g += `<text class="${st[2]}" x="${n0(x + w / 2)}" y="${y + 21}" text-anchor="middle">${fmt((p.value / total) * 100)}%</text>`;
      x += w;
    }
    const hp = r.parts.find((p) => p.name === highlight);
    // 강조 칸(주황) 안에는 글자를 두지 않는다(색 시안 C) — 몫은 막대 오른쪽 바깥에 쓴다
    g += hp && hp.value > 0
      ? `<text class="skh-value" x="${W - R + 8}" y="${y + 14}">${fmt(total)}${esc(unit)}</text><text x="${W - R + 8}" y="${y + 29}">${esc(highlight)} ${fmt((hp.value / total) * 100)}%</text>`
      : `<text class="skh-value" x="${W - R + 8}" y="${y + 21}">${fmt(total)}${esc(unit)}</text>`;
  });
  const ay = T + valid.length * rowH;
  g += `<line class="skh-axis" x1="${L}" x2="${W - R}" y1="${ay}" y2="${ay}"/>`;
  for (const t of [0, 50, 100]) g += `<text x="${n0(L + (bw * t) / 100)}" y="${ay + 18}" text-anchor="middle">${t}%</text>`;
  const totals = names.map((nme) => [nme, rows.reduce((t, r) => t + (r.parts.find((p) => p.name === nme)?.value || 0), 0)]);
  const sum = totals.reduce((t, x) => t + x[1], 0) || 1;
  const legend = totals.map(([nme, v]) => `<span><span class="sh-sw ${style[nme][1]}"></span>${esc(nme)} ${fmt(v)}${esc(unit)} (${fmt((v / sum) * 100)}%)</span>`).join('');
  return `${svg(H, title, g)}<div class="skh-legend">${legend}</div>`;
}

// ---------- W5 히트맵 ----------
export function heatmap({ title = '분포', unit = '', rowLabels = [], colLabels = [], values = [], hrefs, decimals = 0 }) {
  const flat = values.flat().filter(Number.isFinite);
  if (!rowLabels.length || !colLabels.length || !flat.length) return empty();
  const max = Math.max(...flat) || 1;
  const L = 44, T = 28, rowH = 28, cw = (W - L - 8) / colLabels.length, H = T + rowLabels.length * rowH + 6;
  let g = '';
  colLabels.forEach((c, j) => { g += `<text x="${n0(L + cw * j + cw / 2)}" y="${T - 8}" text-anchor="middle">${esc(c)}</text>`; });
  rowLabels.forEach((r, i) => {
    g += `<text x="${L - 8}" y="${T + i * rowH + 19}" text-anchor="end">${esc(r)}</text>`;
    colLabels.forEach((c, j) => {
      const v = values[i]?.[j];
      const val = Number.isFinite(v) ? v : 0;
      const lvl = val <= 0 ? 0 : Math.min(5, Math.ceil((val / max) * 5));
      const cellSvg = `<rect class="sh-seq-${lvl}" x="${n0(L + cw * j + 1)}" y="${T + i * rowH + 1}" width="${n0(cw - 2)}" height="${rowH - 2}"><title>${esc(r)} ${esc(c)}: ${fmt(val, decimals)}${esc(unit)}</title></rect><text class="${lvl >= 5 ? 'sh-on-dark' : 'sh-on-light'}" x="${n0(L + cw * j + cw / 2)}" y="${T + i * rowH + 19}" text-anchor="middle">${Number.isFinite(v) ? fmt(val, decimals) : '–'}</text>`;
      g += hrefs?.[i]?.[j] ? `<a href="${esc(hrefs[i][j])}">${cellSvg}</a>` : cellSvg;
    });
  });
  const legend = `<div class="skh-legend"><span>적음</span>${[1, 2, 3, 4, 5].map((k) => `<span class="sh-sw sh-seq-bg-${k}"></span>`).join('')}<span>많음 (최대 ${fmt(max)}${esc(unit)})</span><span>칸 안 숫자 = ${esc(unit || '값')}</span></div>`;
  return `${svg(H, title, g)}${legend}`;
}

// ---------- W6 목표 대비 진척 ----------
export function progressBars({ title = '목표 대비', due = '', rows = [] }) {
  if (!rows.length) return empty();
  const rowH = 62, H = rows.length * rowH + 8, TL = W - 8;
  let g = '';
  rows.forEach((r, i) => {
    const y = 4 + i * rowH, dec = r.decimals ?? 0, u = r.unit || '';
    g += `<text x="0" y="${y + 14}">${esc(r.label)}</text>`;
    if (!Number.isFinite(r.value) || !Number.isFinite(r.target)) { g += `<text x="${TL}" y="${y + 14}" text-anchor="end">데이터 없음</text>`; return; }
    const ok = r.lowerIsBetter ? r.value <= r.target : r.value >= r.target;
    const max = Math.max(r.value, r.target) * 1.15 || 1;
    const bx = (v) => (TL * v) / max;
    const gap = Math.abs(r.target - r.value);
    g += `<text class="skh-value" x="${TL}" y="${y + 14}" text-anchor="end">${fmt(r.value, dec)}${esc(u)} / 목표 ${fmt(r.target, dec)}${esc(u)}</text>`;
    g += `<rect class="sh-track" x="0" y="${y + 22}" width="${TL}" height="14"/><rect class="${ok ? 'sh-fill-muted' : 'sh-fill-accent'}" x="0" y="${y + 22}" width="${n0(bx(r.value))}" height="14"><title>${esc(r.label)} ${fmt(r.value, dec)}${esc(u)}</title></rect>`;
    g += `<line class="sh-stroke-ink" x1="${n0(bx(r.target))}" x2="${n0(bx(r.target))}" y1="${y + 18}" y2="${y + 40}"/>`;
    const msg = r.lowerIsBetter
      ? (ok ? `달성 · 목표 이하, 여유 ${fmt(gap, dec)}${unitDiff(u)}` : `미달 · ${fmt(gap, dec)}${unitDiff(u)} 줄여야 함`)
      : (ok ? `달성 · 목표보다 ${fmt(gap, dec)}${unitDiff(u)} 높음` : `미달 · 남은 양 ${fmt(gap, dec)}${unitDiff(u)}`);
    g += `<text x="0" y="${y + 55}">${esc(msg)}${due ? ` · ${esc(due)}` : ''}</text>`;
  });
  return svg(H, title, g);
}

// ---------- W7 퍼널 ----------
export function funnel({ title = '단계', unit = '', steps = [] }) {
  if (!steps.length || !(steps[0].value > 0)) return empty();
  const L = 92, R = 170, rowH = 40, H = steps.length * rowH + 8;
  const max = steps[0].value;
  let worst = -1, worstRate = 2;
  steps.forEach((s, i) => { if (i > 0 && s.value / steps[i - 1].value < worstRate) { worstRate = s.value / (steps[i - 1].value || 1); worst = i; } });
  let g = '';
  steps.forEach((s, i) => {
    const y = 4 + i * rowH, bw = Math.max(1, ((W - L - R) * s.value) / max);
    g += `<text x="${L - 8}" y="${y + 24}" text-anchor="end">${esc(s.label)}</text><rect class="${i === worst ? 'sh-fill-accent' : 'sh-fill-muted'}" x="${L}" y="${y + 8}" width="${n0(bw)}" height="22"><title>${esc(s.label)}: ${fmt(s.value)}${esc(unit)}</title></rect><text class="skh-value" x="${n0(L + bw + 6)}" y="${y + 24}">${fmt(s.value)}${esc(unit)}</text>`;
    if (i > 0) {
      const prev = steps[i - 1].value;
      g += `<text x="${W}" y="${y + 24}" text-anchor="end">전환 ${fmt(prev ? (s.value / prev) * 100 : 0)}% · 이탈 ${fmt(prev - s.value)}${esc(unit)}</text>`;
    } else g += `<text x="${W}" y="${y + 24}" text-anchor="end">기준 100%</text>`;
  });
  const note = worst > 0 ? `<p class="skh-muted">가장 많이 빠지는 단계(강조색): ${esc(steps[worst - 1].label)} → ${esc(steps[worst].label)}, 전환 ${fmt(worstRate * 100)}%</p>` : '';
  return `${svg(H, title, g)}${note}`;
}

// ---------- W8 순위·판단 큐 표 ----------
export function rankTable({ id = 'rank', title = '순위', columns = [], rows = [], sortKey, sortDir = 'asc', topN = 5, selectable = false, empty: emptyMsg }) {
  if (!rows.length) return empty(emptyMsg || '조건에 맞는 건이 없습니다.');
  const th = columns.map((c) => {
    const active = sortKey === c.key;
    const aria = active ? ` aria-sort="${sortDir === 'desc' ? 'descending' : 'ascending'}"` : '';
    const mark = active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';
    return `<th scope="col"${aria}${c.num ? ' class="skh-num"' : ''}>${c.sortable === false ? esc(c.label) : `<button type="button" class="sh-sort" data-sort="${esc(c.key)}">${esc(c.label)}${mark}</button>`}</th>`;
  }).join('');
  const body = rows.map((r, i) => {
    const top = i < topN;
    const tds = columns.map((c) => {
      let v = c.badge ? (r[c.key] ? `<span class="skh-badge skh-badge--${TONE_BADGE[r.tones?.[c.key]] || 'normal'}">${esc(r[c.key])}</span>` : '') : esc(r[c.key] ?? '');
      if (c.primary && Array.isArray(r.evidence) && r.evidence.length) v = `<details class="sh-row-detail"><summary>${esc(r[c.key])}</summary><ul class="sh-evidence">${r.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></details>`;
      return `<td${c.num ? ' class="skh-num"' : ''}>${v}</td>`;
    }).join('');
    return `<tr class="${top ? 'sh-top' : ''}"${r.id !== undefined ? ` data-row="${esc(r.id)}"` : ''}>${selectable ? `<td><input type="checkbox" data-pick="${esc(r.id)}" aria-label="${esc(r.id)} 선택"${r.checked ? ' checked' : ''}></td>` : ''}<td class="skh-num sh-rank${top ? ' sh-rank--top' : ''}">${i + 1}</td>${tds}<td>${r.href ? `<a href="${esc(r.href)}">상세 →</a>` : ''}</td></tr>`;
  }).join('');
  return `<div class="skh-table-scroll"><table class="skh-table" data-table="${esc(id)}"><caption>${esc(title)} · 위 ${topN}건은 왼쪽 굵은 선과 굵은 순위 번호로 강조 · 머리글을 누르면 정렬</caption>
<thead><tr>${selectable ? '<th scope="col">선택</th>' : ''}<th scope="col" class="skh-num">순위</th>${th}<th scope="col">이동</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

// ---------- W9 이상치·알림 목록 ----------
export function alertList({ title = '알림', items = [] }) {
  if (!items.length) return empty('지금 문제가 되는 건이 없습니다.');
  return `<ul class="sh-alerts" aria-label="${esc(title)}">${items.map((a) => `<li><span class="skh-badge skh-badge--${TONE_BADGE[a.tone] || 'normal'}">${esc(a.badge)}</span><span class="sh-alert-title">${esc(a.title)}</span><time class="skh-muted">${esc(a.ts)}</time>${a.note ? `<small class="skh-muted">${esc(a.note)}</small>` : ''}${a.href ? `<a href="${esc(a.href)}">열기 →</a>` : ''}</li>`).join('')}</ul>`;
}

// ---------- W10 상태 보드 ----------
export function statusBoard({ title = '상태 보드', columns = [] }) {
  if (!columns.length) return empty();
  return `<div class="sh-board" style="grid-template-columns:repeat(${columns.length},minmax(0,1fr))" aria-label="${esc(title)}">${columns.map((c) => {
    const total = c.total ?? c.items.length;
    return `<section class="sh-col"><h3>${esc(c.name)} <span class="sh-count">${fmt(total)}건</span></h3>${c.items.length ? c.items.map((it) => `<${it.href ? `a href="${esc(it.href)}"` : 'div'} class="sh-item"><strong>${esc(it.title)}</strong>${it.meta ? `<small class="skh-muted">${esc(it.meta)}</small>` : ''}<small class="skh-muted">${esc(it.id)}</small></${it.href ? 'a' : 'div'}>`).join('') : '<p class="skh-muted">없음</p>'}${total > c.items.length ? `<small class="skh-muted">외 ${fmt(total - c.items.length)}건</small>` : ''}</section>`;
  }).join('')}</div>`;
}

// ---------- W11 일정 타임라인 ----------
export function timeline({ title = '일정', days = [], today, items = [] }) {
  const first = days[0], last = days[days.length - 1];
  const shown = items.filter((it) => days.length && it.end >= first && it.start <= last).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  if (!shown.length) return empty('표시 기간에 일정이 없습니다.');
  const L = 250, T = 30, rowH = 28, dw = (W - L - 6) / days.length, H = T + shown.length * rowH + 8;
  const idx = (d) => days.indexOf(d);
  let g = '';
  days.forEach((d, i) => { if (i % 2 === 0) g += `<text x="${n0(L + dw * i + dw / 2)}" y="${T - 12}" text-anchor="middle">${mm(d)}</text>`; });
  g += `<line class="skh-axis" x1="${L}" x2="${W - 6}" y1="${T - 4}" y2="${T - 4}"/>`;
  let running = 0;
  shown.forEach((it, i) => {
    const y = T + i * rowH;
    const a = Math.max(0, it.start < first ? 0 : idx(it.start)), b = it.end > last ? days.length - 1 : idx(it.end);
    const live = today && it.start <= today && it.end >= today;
    if (live) running++;
    g += `<text x="${L - 8}" y="${y + 17}" text-anchor="end">${esc(cut(it.label, 19))}</text><rect class="${live ? 'sh-fill-accent' : 'sh-fill-muted'}" x="${n0(L + dw * a)}" y="${y + 5}" width="${n0(dw * (b - a + 1) - 2)}" height="14"><title>${esc(it.label)} ${mm(it.start)}~${mm(it.end)}${it.owner ? ' · ' + esc(it.owner) : ''}${live ? ' · 진행 중' : ''}</title></rect>`;
  });
  const ti = today ? idx(today) : -1;
  if (ti >= 0) g += `<line class="sh-stroke-ink" x1="${n0(L + dw * ti + dw / 2)}" x2="${n0(L + dw * ti + dw / 2)}" y1="${T - 4}" y2="${H - 4}"/><text class="skh-value" x="${n0(L + dw * ti + dw / 2 + 4)}" y="${H - 8}">오늘 ${mm(today)}</text>`;
  return `${svg(H, title, g)}<div class="skh-legend"><span><span class="sh-sw sh-bg-accent"></span>오늘 진행 중 ${running}건</span><span><span class="sh-sw sh-bg-muted"></span>예정·종료</span><span>세로선 = 오늘</span></div>`;
}

// ---------- W12 최근 활동 ----------
export function activityFeed({ title = '최근 활동', items = [] }) {
  if (!items.length) return empty('최근 활동이 없습니다.');
  return `<ol class="sh-feed" aria-label="${esc(title)}">${items.map((a) => `<li><time class="skh-muted">${esc(a.ts)}</time><span>${esc(a.who)}</span><span>${a.href ? `<a href="${esc(a.href)}">${esc(a.what)}</a>` : esc(a.what)}</span></li>`).join('')}</ol>`;
}

// ---------- W13 배치도 ----------
const STATE_KEY = ['ok', 'warn', 'bad']; // states 배열의 순서대로 정상·주의·위험
const STATE_BADGE = ['normal', 'warning', 'danger'];
export function floorMap({ title = '배치도', cols = 6, cells = [], states = ['정상', '주의', '위험'] }) {
  if (!cells.length) return empty();
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  const html = sorted.map((c) => `<${c.href ? `a href="${esc(c.href)}"` : 'div'} class="sh-cell sh-cell--${STATE_KEY[Math.max(0, states.indexOf(c.state))]}${c.dim ? ' sh-cell--dim' : ''}" style="grid-row:${Number(c.row) || 1};grid-column:${Number(c.col) || 1}"><span class="sh-cell-top"><strong>${esc(c.label)}</strong><span class="skh-badge skh-badge--${STATE_BADGE[Math.max(0, states.indexOf(c.state))]}">${esc(c.state)}</span></span>${c.note ? `<small>${esc(c.note)}</small>` : ''}</${c.href ? 'a' : 'div'}>`).join('');
  const counts = states.map((s) => `${s} ${cells.filter((c) => c.state === s).length}곳`).join(' · ');
  return `<div class="sh-floor" style="grid-template-columns:repeat(${Number(cols) || 6},minmax(0,1fr))" aria-label="${esc(title)}">${html}</div><div class="skh-legend"><span>${esc(counts)}</span><span>칸 글자 = 이름 · 상태 · 소속과 해당 건수</span></div>`;
}

// ---------- W14 관리도: 하루 단위 점 + 기준선 + 상·하한 띠. 한계 밖 점은 강조색, 누르면 그날 목록 ----------
export function controlChart(w) {
  const pts = w?.points || [];
  if (!w || !pts.some((p) => Number.isFinite(p.y)) || w.center === null) return empty('관리도 설정이 없거나 점이 없습니다.');
  const ys = pts.map((p) => p.y).filter(Number.isFinite);
  const { lo, hi, ticks } = niceTicks(Math.min(...ys, w.lcl), Math.max(...ys, w.ucl), 5);
  const L = 52, R = 24, T = 22, B = 34, H = 260, n = pts.length;
  const X = (i) => (n <= 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const dec = ticks.every((t) => Number.isInteger(t)) ? 0 : 1;
  let g = '';
  for (const t of ticks) g += `<line class="skh-grid" x1="${L}" x2="${W - R}" y1="${n0(Y(t))}" y2="${n0(Y(t))}"/><text x="${L - 6}" y="${n0(Y(t) + 5)}" text-anchor="end">${fmt(t, dec)}</text>`;
  g += `<rect class="sh-shade" x="${L}" y="${n0(Y(w.ucl))}" width="${W - L - R}" height="${n0(Y(w.lcl) - Y(w.ucl))}"><title>상한 ${fmt(w.ucl, 1)} ~ 하한 ${fmt(w.lcl, 1)}</title></rect>`;
  g += `<line class="sh-stroke-ink sh-dash" x1="${L}" x2="${W - R}" y1="${n0(Y(w.center))}" y2="${n0(Y(w.center))}"/><text x="${W - R}" y="${n0(Y(w.center) - 5)}" text-anchor="end">기준선 ${fmt(w.center, 1)}${esc(w.unit)}</text>`;
  g += `<text x="${L + 4}" y="${n0(Y(w.ucl) - 5)}">상한 ${fmt(w.ucl, 1)}</text><text x="${L + 4}" y="${n0(Y(w.lcl) + 14)}">하한 ${fmt(w.lcl, 1)}</text>`;
  g += `<line class="skh-axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>`;
  const step = Math.max(1, Math.ceil(n / 7));
  for (let i = 0; i < n; i += step) g += `<text x="${n0(X(i))}" y="${H - 12}" text-anchor="middle">${esc(pts[i].x)}</text>`;
  const path = pts.map((p, i) => (Number.isFinite(p.y) ? `${i && Number.isFinite(pts[i - 1].y) ? 'L' : 'M'}${n0(X(i))} ${n0(Y(p.y))}` : '')).join(' ');
  g += `<path class="sh-stroke-muted sh-line" d="${path}"/>`;
  pts.forEach((p, i) => {
    if (!Number.isFinite(p.y)) return;
    const dot = `<circle class="${p.out ? 'sh-fill-accent' : 'sh-fill-muted'}" cx="${n0(X(i))}" cy="${n0(Y(p.y))}" r="${p.out ? 6 : 4}"><title>${esc(p.x)} ${fmt(p.y, 1)}${esc(w.unit)}${p.out ? (p.side === 'high' ? ' · 상한 초과' : ' · 하한 미만') : ''}</title></circle>`;
    g += p.out && p.href ? `<a href="${esc(p.href)}" data-out="${esc(p.date)}">${dot}</a>` : dot;
  });
  g += `<text x="4" y="14">단위: ${esc(w.unit || '값')}</text>`;
  const legend = `<div class="skh-legend"><span><span class="sh-sw sh-bg-accent"></span>한계 밖 ${w.outCount}곳(누르면 그날 목록)</span><span><span class="sh-sw sh-bg-muted"></span>한계 안</span><span>기준 = ${esc(w.basis)}</span></div>`;
  return `${svg(H, w.title, g)}${legend}`;
}

// ---------- W15 분포: 수치 열 히스토그램 + 중앙값·p90 선, 그룹이 있으면 같은 구간의 작은 다중 막대 ----------
function histBars(edges, counts, { H, L, R, T, B, med, p90, unit, dec, labels = true }) {
  const max = Math.max(1, ...counts);
  const lo = edges[0], hi = edges[edges.length - 1];
  const X = (v) => L + ((v - lo) / (hi - lo || 1)) * (W - L - R);
  const Y = (c) => T + (1 - c / max) * (H - T - B);
  let g = `<line class="skh-axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>`;
  counts.forEach((c, i) => {
    const x1 = X(edges[i]), x2 = X(edges[i + 1]);
    g += `<rect class="sh-fill-muted" x="${n0(x1 + 1)}" y="${n0(Y(c))}" width="${n0(Math.max(1, x2 - x1 - 2))}" height="${n0(H - B - Y(c))}"><title>${fmt(edges[i], dec)}~${fmt(edges[i + 1], dec)}${esc(unit)}: ${c}</title></rect>`;
    if (labels && c > 0) g += `<text class="skh-value" x="${n0((x1 + x2) / 2)}" y="${n0(Y(c) - 4)}" text-anchor="middle">${c}</text>`;
  });
  if (labels) edges.forEach((e, i) => { if (edges.length <= 9 || i % 2 === 0) g += `<text x="${n0(X(e))}" y="${H - 12}" text-anchor="middle">${fmt(e, dec)}</text>`; });
  if (Number.isFinite(med)) g += `<line class="sh-stroke-ink sh-dash" x1="${n0(X(med))}" x2="${n0(X(med))}" y1="${T}" y2="${H - B}"/>`;
  if (Number.isFinite(p90)) g += `<line class="sh-stroke-accent sh-dash" x1="${n0(X(p90))}" x2="${n0(X(p90))}" y1="${T}" y2="${H - B}"/>`;
  return g;
}
export function histogram(w) {
  if (!w || !w.n || !w.edges.length) return empty('분포를 그릴 값이 없습니다.');
  const dec = w.decimals ?? 0;
  const H = 240;
  let g = histBars(w.edges, w.counts, { H, L: 40, R: 24, T: 22, B: 34, med: w.median, p90: w.p90, unit: w.unit, dec });
  g += `<text x="4" y="14">${esc(w.label)}(${esc(w.unit)}) · 막대 위 숫자 = ${esc(w.countUnit)}</text>`;
  const legend = `<div class="skh-legend"><span>${esc(w.countUnit)} ${fmt(w.n)}</span><span>회색 점선 = 중앙값 ${fmt(w.median, 1)}${esc(w.unit)}</span><span>주황 점선 = p90 ${fmt(w.p90, 1)}${esc(w.unit)}</span></div>`;
  let multi = '';
  if (w.groups?.length) {
    const cells = w.groups.map((gr) => `<div class="sh-span-4"><small class="skh-muted">${esc(gr.name)} · ${fmt(gr.n)}${esc(w.countUnit)}${Number.isFinite(gr.median) ? ` · 중앙값 ${fmt(gr.median, 1)}${esc(w.unit)}` : ''}</small>${gr.n ? `<svg class="skh-chart" viewBox="0 0 ${W} 110" role="img" aria-label="${esc(gr.name)} 분포">${histBars(w.edges, gr.counts, { H: 110, L: 12, R: 12, T: 8, B: 16, med: gr.median, unit: w.unit, dec, labels: false })}</svg>` : '<p class="skh-muted">값 없음</p>'}</div>`).join('');
    multi = `<h3>${esc(w.groupLabel)}별 비교</h3><div class="sh-grid">${cells}</div>`;
  }
  return `${svg(H, w.title, g)}${legend}${multi}`;
}

// ---------- W16 행렬 히트맵: 두 범주 열 × 집계값, 칸을 누르면 그 두 값으로 거른 목록 (W5 와 같은 그림, 입력만 일반화) ----------
export function matrixHeat(w) {
  if (!w) return empty('행렬 설정이 없습니다.');
  return heatmap(w);
}

// ---------- W17 AI 대화창: 화면 데이터(context)를 근거로 AI 에게 묻는 대화. 순수 HTML 문자열 — 동작(전송·보관)은 chat.js 의 mountChat ----------
// 입력: {title?, suggestions?:[첫 질문 칩], messages?:[{role,content,source?,reason?}]}. 서버 /api/chat, 대화 보관 sessionStorage, context 는 domains/chat.mjs 의 chatContext.
export function chatMessagesHtml(messages = [], { pending = false, error = '' } = {}) {
  if (!messages.length && !pending && !error) return '<p class="sh-none">아직 대화가 없습니다.</p>';
  const rows = messages.map((m) => {
    if (m.role === 'user') return `<div class="sh-chat-row sh-chat-row--user"><div class="sh-chat-bubble sh-chat-bubble--user" data-role="user">${esc(m.content)}</div></div>`;
    const why = m.source !== 'openai' && reasonText(m.reason) ? `<span>OpenAI 호출 실패(${esc(reasonText(m.reason))}) — 모의 응답으로 대신함</span>` : '';
    const tone = m.source === 'openai' ? 'normal' : 'warning';
    // 근거 칩: 답에 쓴 문서 문단(refs) — 누르면(details) 소제목과 원문이 펼쳐진다
    const refs = Array.isArray(m.refs) && m.refs.length
      ? `<div class="sh-chat-refs">${m.refs.map((r) => `<details class="sh-chat-ref" data-ref><summary class="sh-btn sh-chip">${esc(r.doc)} §${esc(r.n)}</summary><div class="sh-chat-ref-body">${r.heading ? `<strong>${esc(r.heading)}</strong>` : ''}<p>${esc(r.text)}</p></div></details>`).join('')}</div>` : '';
    return `<div class="sh-chat-row"><div class="sh-chat-bubble" data-role="assistant">${esc(m.content)}</div>${refs}<div class="sh-chat-meta"><span class="skh-badge skh-badge--${tone}">${badgeText(m)}</span>${why}</div></div>`;
  });
  if (pending) rows.push('<div class="sh-chat-row"><div class="sh-chat-bubble sh-chat-bubble--wait" data-pending>답변을 만드는 중…</div></div>');
  if (error) rows.push(`<p class="skh-error" role="alert">${esc(error)}</p>`);
  return rows.join('');
}

export function chatWidget({ title = 'AI에게 묻기', suggestions = [], messages = [] } = {}) {
  const chips = !messages.length && suggestions.length
    ? `<div class="sh-chat-chips" data-chat-chips>${suggestions.map((s) => `<button type="button" class="sh-btn sh-chip" data-chat-suggest="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : '<div class="sh-chat-chips" data-chat-chips hidden></div>';
  return `<div class="sh-chat" data-chat role="group" aria-label="${esc(title)}">
<div class="sh-chat-list" data-chat-list role="log" aria-live="polite">${chatMessagesHtml(messages)}</div>
${chips}
<form class="sh-chat-form" data-chat-form>
<textarea class="sh-input sh-full" rows="2" aria-label="질문" placeholder="질문" data-chat-input></textarea>
<div class="sh-actions"><button type="submit" class="sh-primary" data-chat-send>보내기</button><button type="button" class="sh-btn" data-chat-clear>대화 지우기</button></div>
</form>
</div>`;
}

// ---------- 카탈로그 ----------
export const WIDGETS = [
  { no: 'W1', key: 'w1', name: '지표 줄', fn: metricRow, when: '맨 위에서 핵심 숫자 3~5개와 전 기간 대비 개선/악화를 한 줄로 보여 줄 때' },
  { no: 'W2', key: 'w2', name: '추세 선·면', fn: trendChart, when: '시간에 따른 변화, 기준·목표선과 이상 구간을 보여 줄 때' },
  { no: 'W3', key: 'w3', name: '범주 가로 막대', fn: barList, when: '어느 범주가 가장 큰지 순위로 보여 줄 때(상위 N + 나머지)' },
  { no: 'W4', key: 'w4', name: '100% 누적 막대', fn: stackedBar, when: '전체가 무엇으로 이루어졌는지 구성비를 보여 줄 때(도넛 대신)' },
  { no: 'W5', key: 'w5', name: '히트맵', fn: heatmap, when: '요일×시간처럼 두 기준으로 몰리는 곳을 보여 줄 때' },
  { no: 'W6', key: 'w6', name: '목표 대비 진척', fn: progressBars, when: '목표까지 남은 양과 기한을 보여 줄 때' },
  { no: 'W7', key: 'w7', name: '퍼널', fn: funnel, when: '단계별 건수와 단계 사이 전환·이탈을 보여 줄 때' },
  { no: 'W8', key: 'w8', name: '순위·판단 큐 표', fn: rankTable, when: '먼저 볼 건을 정렬하고, 행을 펼쳐 근거를 확인하게 할 때' },
  { no: 'W9', key: 'w9', name: '이상치·알림 목록', fn: alertList, when: '지금 문제가 되는 건을 배지·시각과 함께 바로가기로 줄 때' },
  { no: 'W10', key: 'w10', name: '상태 보드', fn: statusBoard, when: '일이 대기·진행·완료 어디에 몇 건 있는지 열로 보여 줄 때' },
  { no: 'W11', key: 'w11', name: '일정 타임라인', fn: timeline, when: '언제 무엇이 겹치는지, 오늘 기준 진행 중인 일을 보여 줄 때' },
  { no: 'W12', key: 'w12', name: '최근 활동', fn: activityFeed, when: '누가 언제 무엇을 바꿨는지 줄 목록으로 보여 줄 때' },
  { no: 'W13', key: 'w13', name: '배치도', fn: floorMap, when: '대상·구역을 격자에 놓고 상태를 색과 글자로 보여 줄 때' },
  { no: 'W14', key: 'w14', name: '관리도', fn: controlChart, when: '기준선과 상·하한 띠로 어느 날이 평소 범위를 벗어났는지 보여 줄 때(한계 밖 점을 누르면 그날 목록)' },
  { no: 'W15', key: 'w15', name: '분포', fn: histogram, when: '수치 열이 어디에 몰리는지, 중앙값과 p90 은 어디인지, 그룹마다 어떻게 다른지 보여 줄 때' },
  { no: 'W16', key: 'w16', name: '행렬 히트맵', fn: matrixHeat, when: '두 범주(출발×도착, 라인×팀)의 조합마다 건수·평균이 얼마인지 보여 줄 때' },
  { no: 'W17', key: 'w17', name: 'AI 대화창', fn: chatWidget, when: '지금 보는 화면의 데이터를 AI 에게 묻고 답을 받을 때(대화는 페이지를 옮겨도 남고, 서버에 키가 없으면 모의 응답)' },
  { no: 'W18', key: 'w18', name: '녹음·전사', fn: recorderHtml, when: '사용자가 말로 입력해야 할 때(인터뷰 답변, 점검 메모를 말로) — 녹음 또는 오디오 파일을 글로 바꿔 입력란에 넣는다' },
];
