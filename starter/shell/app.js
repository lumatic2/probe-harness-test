// app.js — 해시 라우터. 페이지 모듈(render/bind)을 불러 본문에 끼우고, 상단 바·필터 줄·메뉴를 갱신한다.
// 데이터: /domains/<이름>/domain.json(설정) + sample.json(그릴 데이터) + /api/decisions-<이름>(저장된 입력).
// 도메인은 주소의 ?domain=이름 또는 domains/active.json 의 값. 과제 데이터로 바꾸려면 starter/DOMAIN.md 참고.
import { parseHash, buildHash, linkTo, PERIODS, rowsIn, windowDates, esc, makeCtx, pickDomainName, groupLabel, groupAll, ALL } from './util.js';
import * as dashboard from './pages/dashboard.js';
import * as list from './pages/list.js';
import * as item from './pages/item.js';
import * as form from './pages/form.js';
import * as report from './pages/report.js';
import * as widgets from './pages/widgets.js';
import * as schedule from './pages/schedule.js';
import * as review from './pages/review.js';
import * as assist from './pages/assist.js';
import { chatConfig, chatContext } from '../domains/chat.mjs';
import { buildParagraphs } from '../domains/docs.mjs';
import { mountChat } from './chat.js';
import * as importPage from './pages/import.js';
import * as settings from './pages/settings.js';
import { applyImported, importApi, importPrevApi } from '../domains/import.mjs';

const PAGES = { dashboard, list, item, form, report, widgets, schedule, review, assist, import: importPage, settings };
// 페이지 켜기: 도메인 설정(domain.json)에 schedule · review · assist · import · settings 키가 있을 때만 메뉴에 나오고 열린다(shadcn 판과 같은 키). 모듈의 enabled(ctx) 가 없으면 항상 켜짐.
const isOn = (k, ctx) => !PAGES[k].enabled || PAGES[k].enabled(ctx);
const NAV = [
  { title: '현황', pages: [['dashboard', '▦'], ['list', '☰']] },
  { title: '작업', pages: [['form', '✎'], ['report', '▤'], ['schedule', '▥'], ['review', '☷'], ['assist', '◈'], ['import', '⇪'], ['settings', '⚙']] },
  { title: '참고', pages: [['widgets', '◫']] },
];
const $ = (id) => document.getElementById(id);
const data = { ctx: null, decisions: [], apiName: '', stores: { schedule: {}, review: {} }, baseSample: null, imported: {}, prevImported: {}, settings: { values: {}, history: [] }, settingsApi: '', flash: '' };
let lastPage = null;

const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
const getJson = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url} → ${r.status}`); return r.json(); };

// W17 AI 대화창 옆 패널 — 도메인 설정(domain.json)에 chat 키가 있을 때만 헤더 버튼이 보인다. 어느 페이지에서든 열리고, 보낼 때마다 그 시점의 화면 요약(chatContext)을 context 로 보낸다.
function setupChat(ctx) {
  const cfg = chatConfig(ctx.d);
  if (!cfg) return;
  const open = $('sh-chat-open'), panel = $('sh-chat'), body = $('sh-chat-body');
  open.textContent = cfg.title;
  open.hidden = false;
  $('sh-chat-title').textContent = cfg.title;
  let paragraphs; // 근거 문서(chat.docs)는 처음 열 때 한 번만 불러온다
  const set = async (on) => {
    panel.hidden = !on;
    open.setAttribute('aria-expanded', String(on));
    if (!on) return;
    body.innerHTML = '';
    if (cfg.docs && !paragraphs) paragraphs = buildParagraphs(await getJson(`/api/docs-${ctx.d.name}`).catch(() => ({})));
    mountChat(body, { name: ctx.d.name, getContext: () => chatContext(ctx, parseHash(location.hash)), config: cfg, paragraphs });
    body.querySelector('[data-chat-input]').focus();
  };
  open.addEventListener('click', () => set(panel.hidden));
  $('sh-chat-close').addEventListener('click', () => { set(false); open.focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { set(false); open.focus(); } });
}

async function boot() {
  try {
    const active = (await getJson('/domains/active.json')).active;
    const name = pickDomainName(location.search, active);
    const [domain, sample] = await Promise.all([getJson(`/domains/${name}/domain.json`), getJson(`/domains/${name}/sample.json`)]);
    // CSV 올리기로 반영한 데이터(import-<도메인>)가 있으면 샘플의 rows 를 대신한다(domain.json 에 import 키가 있을 때만 읽는다)
    data.baseSample = sample;
    if (domain.import) {
      const [cur, prev] = await Promise.all([fetch(`/api/${importApi(name)}`), fetch(`/api/${importPrevApi(name)}`)]);
      data.imported = cur.ok ? await cur.json() : {};
      data.prevImported = prev.ok ? await prev.json() : {};
    }
    // 기준값 설정(domain.json 의 params 가 있을 때만): 저장된 값으로 ctx 를 만든다. 아직 없으면 씨앗 {values:{},history:[]}
    data.settingsApi = `settings-${name}`;
    if (Array.isArray(domain.params) && domain.params.length) { const s = await fetch(`/api/${data.settingsApi}`); if (s.ok) data.settings = await s.json(); }
    data.ctx = makeCtx(domain, applyImported(sample, data.imported), data.settings.values);
    data.apiName = `decisions-${name}`;
    const r = await fetch(`/api/${data.apiName}`);
    data.decisions = r.ok ? await r.json() : [];
    // 저장물: 일정 확정(schedule-<도메인>) · 문서 검토 기록(review-<도메인>) — 아직 없으면(404) 빈 값으로 시작
    for (const k of ['schedule', 'review']) {
      if (!domain[k]) continue;
      const s = await fetch(`/api/${k}-${name}`);
      data.stores[k] = s.ok ? await s.json() : {};
    }
  } catch (e) {
    $('sh-view').innerHTML = `<div class="skh-alert"><strong>데이터를 불러오지 못했습니다.</strong><p>${esc(e.message)} — 서버가 켜져 있는지, 도메인 이름이 맞는지 확인하세요.</p></div>`;
    return;
  }
  const ctx = data.ctx;
  $('sh-period').innerHTML = PERIODS.map((p) => `<option value="${p.v}">${p.label}</option>`).join('');
  $('sh-group-label').textContent = groupLabel(ctx);
  $('sh-group').innerHTML = [ALL, ...(ctx.d.group.values || [])].map((p) => `<option value="${esc(p)}">${p === ALL ? esc(groupAll(ctx)) : esc(p)}</option>`).join('');
  $('sh-service').textContent = ctx.d.app.title;
  $('sh-asof').textContent = ctx.d.app.asOf;
  document.title = ctx.d.app.title;
  document.body.dataset.domain = ctx.d.name;
  const onFilter = () => { const s = parseHash(location.hash); go(buildHash(s.page, { ...s, period: $('sh-period').value, group: $('sh-group').value }, s.id)); };
  $('sh-period').addEventListener('change', onFilter);
  $('sh-view').addEventListener('click', (e) => { // 카드 안 기간 세그먼트 — 공통 필터의 기간과 같은 상태
    const b = e.target.closest('[data-period]');
    if (b) { $('sh-period').value = b.dataset.period; onFilter(); }
  });
  $('sh-group').addEventListener('change', onFilter);
  window.addEventListener('hashchange', render);
  setupChat(ctx);
  render();
}

function render() {
  const state = parseHash(location.hash);
  const page = PAGES[state.page];
  const ctx = data.ctx;
  if (!page || !isOn(state.page, ctx)) { location.replace('#/dashboard'); return; }
  const meta = page.meta(ctx);
  $('sh-eyebrow').textContent = meta.name;
  const second = $('sh-secondary');
  second.textContent = state.page === 'report' ? '대시보드' : '리포트';
  second.href = linkTo(state.page === 'report' ? 'dashboard' : 'report', state);
  const action = $('sh-action');
  action.textContent = meta.action.label;
  action.href = meta.action.href(state);
  action.className = page.bodyPrimary ? 'sh-btn' : 'sh-primary'; // 본문에 검정 주 버튼이 있는 화면은 상단 행동 버튼을 테두리 버튼으로
  $('sh-period').value = state.period;
  $('sh-group').value = state.group;
  const filterOn = !['item', 'form', 'schedule', 'review', 'import', 'assist', 'settings'].includes(state.page);
  $('sh-filter').hidden = !filterOn;
  $('sh-result').textContent = `기간 내 ${ctx.d.entity.plural} ${rowsIn(ctx, windowDates(ctx, state), state.group).length}${ctx.d.entity.unit}`;
  $('sh-nav').innerHTML = NAV.map((g) => `<p class="sh-nav-group">${g.title}</p>${g.pages.filter(([k]) => isOn(k, ctx)).map(([k, ico]) => `<a href="${linkTo(k, state)}"${k === state.page ? ' aria-current="page"' : ''}><span class="sh-nav-ico" aria-hidden="true">${ico}</span>${PAGES[k].meta(ctx).name}</a>`).join('')}`).join('');
  const view = $('sh-view');
  try {
    view.innerHTML = page.render(state, data);
    page.bind?.(view, { state, data, go, setQuery: (q) => go(buildHash(state.page, { ...state, ...q }, state.id)) });
  } catch (e) {
    view.innerHTML = `<div class="skh-alert"><strong>이 화면을 그리지 못했습니다.</strong><p>${esc(e.message)}</p></div>`;
  }
  if (lastPage !== state.page) { window.scrollTo(0, 0); lastPage = state.page; }
}

boot();
