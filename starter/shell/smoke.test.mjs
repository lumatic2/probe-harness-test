// 실행: node --test starter/shell/csv.test.mjs starter/shell/smoke.test.mjs
// 도메인 5개(alarm·education·inspection·documents·interview) 각각으로 위젯 18종·페이지 6종(+ 설정 키가 있으면 일정 격자·문서 검토·AI 피드백)이 그려지는지, 표 공통 기능(CSV·D-day·안내문)과 도메인 전환,
// 서버가 뜨고 /api 가 왕복하는지, shell.css 규칙을 지키는지 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { smoke } from './smoke.mjs';
import { WIDGETS } from './widgets.js';
import {
  buildInputs, DEFAULT_STATE, makeCtx, pickDomainName, validate, toCsv, makeNotices, ddayText, dday, isOverdue, filterRows, tableCols, parseHash, buildHash, makeDecision,
} from './util.js';
import * as dashboard from './pages/dashboard.js';
import * as list from './pages/list.js';
import * as item from './pages/item.js';
import * as form from './pages/form.js';
import * as report from './pages/report.js';
import * as widgetsPage from './pages/widgets.js';
import * as schedulePage from './pages/schedule.js';
import * as reviewPage from './pages/review.js';
import * as assistPage from './pages/assist.js';
import { createAssist, mockSuggestion, parseBody, OPENAI_URL } from './assist-api.mjs';
import { createTranscribe, mockTranscript, STT_URL } from './transcribe-api.mjs';
import { recorderHtml, fmtClock } from './recorder.js';
import { confirmPayload } from '../domains/schedule.mjs';
import { GENERATORS } from '../domains/gen-sample.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DOM = path.join(here, '..', 'domains');
const NAMES = ['alarm', 'education', 'inspection', 'documents', 'interview'];
const read = (n, f) => JSON.parse(fs.readFileSync(path.join(DOM, n, f), 'utf8'));
const load = (n) => ({ ctx: makeCtx(read(n, 'domain.json'), read(n, 'sample.json')), decisions: read(n, 'decisions.json') });
const BAD = /undefined|NaN|\[object Object\]/;
const alarm = load('alarm');

test('도메인 샘플: 5개 모두 고정 시드로 재생성하면 같다(점검·문서 200~400행, 인터뷰 질문 60개), 알람은 장비 24대·공정 5개', () => {
  for (const n of NAMES) {
    const s = read(n, 'sample.json');
    const [lo, hi] = n === 'interview' ? [30, 100] : [200, 400];
    assert.ok(s.rows.length >= lo && s.rows.length <= hi, `${n} rows=${s.rows.length}`);
    const g = GENERATORS[n]();
    assert.deepEqual(g.sample, s, `${n} 재생성이 저장본과 다름`);
    assert.deepEqual(g.decisions, read(n, 'decisions.json'));
  }
  const a = read('alarm', 'sample.json');
  assert.equal(a.units.length, 24);
  assert.deepEqual(alarm.ctx.d.group.values, ['식각', '증착', '포토', '세정', 'CMP']);
  assert.deepEqual(Object.keys(a.rows[0]).sort(), ['alarm_id', 'code', 'equip', 'owner', 'proc', 'severity', 'status', 'ts']);
});

test('교육 샘플: 입사 90일 이내 직원은 배정에서 빠져 있다(데이터 생성 규칙)', () => {
  const s = read('education', 'sample.json');
  const cutoff = '2026-07-30';
  assert.ok(s.rows.every((r) => r.hired < cutoff));
  assert.deepEqual([...new Set(s.rows.map((r) => r.status))].sort(), ['만료', '미이수', '이수']);
});

test('위젯 18종 × 도메인 5개 × 필터 3종: 번호 순서대로 렌더되고 금지 토큰이 없다', () => {
  assert.deepEqual(WIDGETS.map((w) => w.no), ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14', 'W15', 'W16', 'W17', 'W18']);
  for (const n of NAMES) {
    const { ctx } = load(n);
    const g = ctx.d.group.values[1];
    for (const state of [DEFAULT_STATE, { ...DEFAULT_STATE, period: '3d', group: g }, { ...DEFAULT_STATE, period: '14d' }]) {
      const inputs = buildInputs(ctx, state);
      for (const w of WIDGETS) {
        const html = w.fn(inputs[w.key]);
        assert.ok(html.length > 50, `${n} ${w.no} 비어 있음`);
        assert.doesNotMatch(html, BAD, `${n} ${w.no} ${JSON.stringify(state)}`);
      }
    }
  }
});

test('위젯 형태(알람): W1 개선/악화 글자, W8 details, W13 칸 24개, W3 나머지 묶음, SVG 위젯은 skh-chart', () => {
  const inputs = buildInputs(alarm.ctx, { ...DEFAULT_STATE, period: '7d' });
  const by = Object.fromEntries(WIDGETS.map((w) => [w.no, w.fn(inputs[w.key])]));
  assert.match(by.W1, /개선|악화/);
  assert.match(by.W1, /▲|▼/);
  assert.match(by.W8, /<details/);
  assert.match(by.W8, /<button[^>]*data-sort=/);
  assert.equal((by.W13.match(/class="sh-cell /g) || []).length, 24);
  assert.match(by.W3, /나머지/);
  for (const nme of ['W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W11']) assert.match(by[nme], /<svg class="skh-chart"/, nme);
  assert.match(by.W9, /skh-badge/);
  assert.match(by.W10, /건/);
});

test('위젯 빈 입력: 죽지 않고 빈 상태 문구를 낸다', () => {
  for (const n of NAMES) {
    const { ctx } = load(n);
    const emptyCtx = makeCtx(ctx.d, { rows: [] });
    const empty = buildInputs(emptyCtx, DEFAULT_STATE);
    for (const w of WIDGETS) assert.doesNotMatch(w.fn(empty[w.key]), BAD, `${n} ${w.no} 빈 입력`);
  }
});

const PAGES = { dashboard, list, item, form, report, widgets: widgetsPage };

test('페이지 6종 × 도메인 5개: 렌더되고 금지 토큰이 없고 「이 화면의 한계」가 있다', () => {
  for (const n of NAMES) {
    const data = load(n);
    const g = data.ctx.d.group.values[0];
    for (const [name, mod] of Object.entries(PAGES)) {
      const m = mod.meta(data.ctx);
      assert.ok(m.name && m.action.label && typeof m.action.href === 'function', `${n} ${name} meta`);
      for (const s of [DEFAULT_STATE, { ...DEFAULT_STATE, period: '3d', group: g }, { ...DEFAULT_STATE, period: '14d' }]) {
        const st = { ...s, page: name, id: name === 'item' ? data.ctx.rows[0][data.ctx.R.id] : undefined };
        const html = mod.render(st, data);
        assert.ok(html.length > 200, `${n} ${name} 비어 있음`);
        assert.doesNotMatch(html, BAD, `${n} ${name} ${JSON.stringify(s)}`);
        assert.ok(html.includes('이 화면의 한계'), `${n} ${name} 한계 줄 없음`);
      }
    }
  }
});

test('페이지 형태(알람): 대시보드 위젯 6~8개·목록 보드/CSV/안내문 버튼·상세 근거/이력·보고 A/B·카탈로그 W1~W18', () => {
  const data = alarm;
  const dash = dashboard.render({ ...DEFAULT_STATE, page: 'dashboard' }, data);
  const n = (dash.match(/data-widget="W\d+"/g) || []).length;
  assert.ok(n >= 6 && n <= 8, `대시보드 위젯 ${n}개`);
  assert.match(dash, /href="#\/list/);
  assert.equal(dashboard.meta(data.ctx).action.label, '긴급 미조치 건 보기');
  assert.equal(dashboard.meta(data.ctx).action.href(DEFAULT_STATE), '#/list?f_severity=%EA%B8%B4%EA%B8%89&f_status=%EB%AF%B8%EC%A1%B0%EC%B9%98');
  const lst = list.render({ ...DEFAULT_STATE, page: 'list' }, data);
  assert.match(lst, /type="checkbox"/); assert.match(lst, /보드 보기/);
  assert.match(lst, /CSV 내보내기/); assert.match(lst, /선택 건 안내문 만들기/);
  assert.match(list.render({ ...DEFAULT_STATE, page: 'list', view: 'board' }, data), /sh-board/);
  const id = data.decisions[0].ref;
  const it = item.render({ ...DEFAULT_STATE, page: 'item', id }, data);
  assert.match(it, /근거/); assert.match(it, /계산 규칙/); assert.match(it, /변경 이력/);
  assert.ok(it.includes(data.decisions[0].reason));
  assert.match(item.render({ ...DEFAULT_STATE, page: 'item', id: 'ALM-없음' }, data), /찾을 수 없습니다/);
  const rep = report.render({ ...DEFAULT_STATE, page: 'report' }, data);
  assert.match(rep, /한계/); assert.match(rep, /복사/); assert.match(rep, /내려받기/); assert.match(rep, /조건 A/); assert.match(rep, /조건 B/);
  const cat = widgetsPage.render({ ...DEFAULT_STATE, page: 'widgets' }, data);
  for (let i = 1; i <= 16; i++) assert.ok(cat.includes(`W${i} `), `카탈로그에 W${i} 없음`);
});

test('도메인 전환: ?domain= 값이 설정 파일의 active 보다 우선하고, 이상한 값은 무시한다', () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(DOM, 'active.json'), 'utf8')).active, 'alarm');
  assert.equal(pickDomainName('', 'alarm'), 'alarm');
  assert.equal(pickDomainName('?domain=education', 'alarm'), 'education');
  assert.equal(pickDomainName('?x=1&domain=inspection', 'alarm'), 'inspection');
  assert.equal(pickDomainName('?domain=../etc', 'alarm'), 'alarm');
  const titles = NAMES.map((n) => load(n).ctx.d.app.title);
  assert.equal(new Set(titles).size, 5);
  // 같은 화면 코드가 도메인마다 그 도메인의 말로 그려진다
  const edu = load('education'), ins = load('inspection');
  assert.match(list.render({ ...DEFAULT_STATE, page: 'list' }, edu), /교육 배정 목록/);
  assert.match(list.render({ ...DEFAULT_STATE, page: 'list' }, ins), /점검 목록/);
  assert.equal(dashboard.meta(edu.ctx).action.label, '기한 초과 건 보기');
  assert.match(form.render({ ...DEFAULT_STATE, page: 'form' }, edu), /이수일/);
  assert.match(form.render({ ...DEFAULT_STATE, page: 'form' }, ins), /점검 소요\(분\)/);
});

test('표 공통 ① CSV: UTF-8 BOM·한글 머리글·현재 필터 행만·쉼표/따옴표 이스케이프', () => {
  const { ctx } = alarm;
  const state = { ...DEFAULT_STATE, f_severity: '긴급' };
  const rows = filterRows(ctx, state);
  assert.ok(rows.length > 0 && rows.every((r) => r.severity === '긴급'));
  const keys = tableCols(ctx, 'shell').map((c) => c.key);
  const csv = toCsv(ctx, rows, keys);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.slice(1).trimEnd().split('\r\n');
  assert.equal(lines[0], '알람,장비,공정,코드,심각도,발생 시각,상태,담당');
  assert.equal(lines.length, rows.length + 1);
  const buf = Buffer.from(csv, 'utf8');
  assert.deepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const tricky = makeCtx(ctx.d, { rows: [{ ...rows[0], equip: 'A,"B"' }] });
  assert.ok(toCsv(tricky, tricky.rows, ['equip']).includes('"A,""B"""'));
});

test('표 공통 ② D-day·기한 초과: 기한 열이 있는 도메인에만, 끝난 건은 비운다, 기한 초과 = 긴급 배지', () => {
  assert.ok(!tableCols(alarm.ctx, 'shell').some((c) => c.key === '_dday'));
  const { ctx } = load('education');
  assert.ok(tableCols(ctx, 'shell').some((c) => c.key === '_dday'));
  const mk = (status, valid) => ({ rec_id: 'X', status, valid_until: valid, assigned: '2026-10-20' });
  assert.equal(dday(ctx, mk('미이수', '2026-10-31')), 3);
  assert.equal(ddayText(ctx, mk('미이수', '2026-10-31')), 'D-3');
  assert.equal(ddayText(ctx, mk('미이수', '2026-10-28')), 'D-day');
  assert.equal(ddayText(ctx, mk('미이수', '2026-10-26')), '기한 초과 D+2');
  assert.equal(isOverdue(ctx, mk('미이수', '2026-10-26')), true);
  assert.equal(isOverdue(ctx, mk('이수', '2026-10-26')), false);
  assert.equal(ddayText(ctx, mk('이수', '2026-10-26')), '');
  const html = list.render({ ...DEFAULT_STATE, page: 'list' }, load('education'));
  assert.match(html, /skh-badge--danger">기한 초과 D\+\d+/);
});

test('표 공통 ③ 안내문 일괄 생성: 선택 행 값을 템플릿에 넣고 건마다 구분선으로 잇는다', () => {
  const { ctx } = load('education');
  const rows = ctx.rows.filter((r) => r.status === '미이수').slice(0, 2);
  const text = makeNotices(ctx, rows);
  for (const r of rows) {
    assert.ok(text.includes(`${r.name}님, 안녕하세요. (사번 ${r.emp_id} · ${r.job})`));
    assert.ok(text.includes(`유효기간(이수 기한): ${r.valid_until} `));
  }
  assert.equal(text.split('----------------------------------------').length, 2);
  assert.doesNotMatch(text, /\{[a-z_]+\}/);
  assert.equal(makeNotices(ctx, []), '');
});

test('폼 검증: 빈 사유·잘못된 값·없는 대상을 글자 그대로 거른다(도메인 설정의 문구)', () => {
  const { ctx } = alarm;
  const id = ctx.rows[0].alarm_id;
  assert.deepEqual(validate(ctx, { ref: id, value: '15', decision: '승인', reason: '재가동 확인' }), {});
  const e = validate(ctx, { ref: 'ALM-9999', value: '-3', decision: '', reason: '  ' });
  assert.deepEqual(Object.keys(e).sort(), ['decision', 'reason', 'ref', 'value']);
  assert.equal(e.reason, '사유를 입력하세요.');
  assert.equal(e.decision, '승인 또는 반려를 선택하세요.');
  const rec = makeDecision(ctx, [], { ref: id, value: '15', decision: '승인', reason: ' 확인 ' }, '2026-10-28T09:00:00');
  assert.deepEqual(rec, { id: 'D-0001', ref: id, value: 15, decision: '승인', reason: '확인', who: '담당 A조', ts: '2026-10-28T09:00:00' });
});

test('해시 라우팅: 그룹 필터와 목록 필터(f_)가 왕복한다', () => {
  const h = buildHash('list', { period: '3d', group: '식각', f_status: '미조치' });
  assert.deepEqual(parseHash(h), { period: '3d', group: '식각', page: 'list', f_status: '미조치' });
});

function startServer(t) {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: here, env: { ...process.env, PORT: '0' } });
  t.after(() => srv.kill());
  return new Promise((ok, fail) => {
    srv.stderr.on('data', (d) => fail(new Error(String(d))));
    srv.stdout.once('data', (d) => {
      const line = String(d);
      const m = line.match(/Browser: PORT=(\d+), URL=\//);
      if (!m) return fail(new Error('시작 로그 형식 불일치: ' + line));
      ok({ port: Number(m[1]), line });
    });
  });
}

function rawGet(port, rawPath) {
  return new Promise((ok, fail) => {
    http.get({ host: '127.0.0.1', port, path: rawPath }, (res) => { res.resume(); res.on('end', () => ok(res.statusCode)); }).on('error', fail);
  });
}

test('서버: / 와 /vendor 와 /domains 5개 200, /api/decisions-<도메인> 왕복, 경로 탈출 거부, 0.0.0.0 바인딩', async (t) => {
  const src = fs.readFileSync(path.join(here, 'serve.mjs'), 'utf8');
  assert.ok(src.includes("'0.0.0.0'"));
  const store = path.join(here, 'data/store/decisions-alarm.json');
  const backup = fs.existsSync(store) ? fs.readFileSync(store) : null;
  t.after(() => { if (backup) fs.writeFileSync(store, backup); else fs.rmSync(store, { force: true }); });

  const { port, line } = await startServer(t);
  assert.match(line, new RegExp(`PORT=${port}`));
  const base = `http://127.0.0.1:${port}`;
  assert.equal((await smoke(`${base}/`, ['<main class="skh-dashboard', '/vendor/skhynix/design.css'])).ok, true);
  const css = await fetch(`${base}/vendor/skhynix/design.css`);
  assert.equal(css.status, 200);
  assert.match(await css.text(), /--skh-data-accent/);
  assert.equal((await fetch(`${base}/shell.css`)).status, 200);
  assert.equal((await fetch(`${base}/pages/list.js`)).status, 200);
  assert.equal((await fetch(`${base}/domains/core.mjs`)).status, 200);
  assert.equal((await (await fetch(`${base}/domains/active.json`)).json()).active, 'alarm');
  for (const n of NAMES) {
    const d = await (await fetch(`${base}/domains/${n}/domain.json`)).json();
    assert.equal(d.name, n);
    assert.equal((await fetch(`${base}/domains/${n}/sample.json`)).status, 200);
  }

  const seed = await (await fetch(`${base}/api/decisions-alarm`)).json();
  assert.equal(seed.length, alarm.decisions.length);
  assert.equal((await (await fetch(`${base}/api/decisions-education`)).json()).length, load('education').decisions.length);
  const rec = [...seed, { id: 'T-1', ref: 'ALM-0001', value: 5, decision: '승인', reason: '스모크', who: '테스트', ts: '2026-10-28T09:00:00' }];
  const post = await fetch(`${base}/api/decisions-alarm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rec) });
  assert.equal(post.status, 200);
  assert.deepEqual(await (await fetch(`${base}/api/decisions-alarm`)).json(), rec);

  assert.equal((await fetch(`${base}/api/nope-none`)).status, 404);
  assert.equal((await fetch(`${base}/api/decisions-alarm`, { method: 'POST', body: '{깨짐' })).status, 400);
  const big = await fetch(`${base}/api/decisions-alarm`, { method: 'POST', body: JSON.stringify({ x: 'a'.repeat(1024 * 1024 + 10) }) });
  assert.equal(big.status, 413);
  assert.deepEqual(await (await fetch(`${base}/api/decisions-alarm`)).json(), rec);

  for (const p of ['/api/../x', '/api/..%2F..%2Fserve', '/../serve.mjs', '/vendor/../../serve.mjs', '/api/Bad_Name', '/domains/../shell/serve.mjs', '/domains/..%2Fshell%2Fserve.mjs']) {
    const code = await rawGet(port, p);
    assert.ok(code >= 400 && code < 500, `${p} → ${code}`);
  }
});

test('shell.css: hex 색·:root·그림자·그라데이션·애니메이션 없음, 토큰은 var(--skh-*) 로만, 선택 표시에 주황 선 없음', () => {
  const css = fs.readFileSync(path.join(here, 'shell.css'), 'utf8');
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(css, /:root/);
  assert.doesNotMatch(css, /box-shadow|text-shadow|gradient|@keyframes|animation/);
  assert.doesNotMatch(css, /(^|\})\s*\.skh-[a-z-]+\s*\{/); // 같은 선택자로 vendor 규칙 재정의 금지
  assert.match(css, /var\(--skh-data-accent\)/);
  assert.match(css, /prefers-reduced-motion/);
  // 원본 모양 원칙(10-29): 선택 상태·포커스·상단 띠에 주황을 쓰지 않는다
  assert.doesNotMatch(css, /aria-current="page"\][^{]*::before/);
  assert.doesNotMatch(css, /aria-pressed="true"\][^}]*accent/);
  assert.doesNotMatch(css, /focus-visible[^}]*accent/);
  assert.doesNotMatch(css, /border-top: 2px solid var\(--skh-data-accent\)/);
});

// ---------- 일정 격자 · 문서 검토 · AI 피드백 (도메인 설정 키 schedule · review · assist 가 있을 때만 켜지는 페이지) ----------
const NEW_PAGES = { schedule: schedulePage, review: reviewPage, assist: assistPage };
const withStores = (d) => ({ ...d, stores: { schedule: {}, review: {} } });

test('새 페이지 3종: 도메인 설정에 같은 키(schedule · review · assist)가 있을 때만 켜진다', () => {
  const on = (n) => Object.keys(NEW_PAGES).filter((k) => NEW_PAGES[k].enabled(load(n).ctx));
  assert.deepEqual(on('inspection'), ['schedule']);
  assert.deepEqual(on('documents'), ['review']);
  assert.deepEqual(on('interview'), ['assist']);
  assert.deepEqual(on('alarm'), []);
  assert.deepEqual(on('education'), []);
});

test('일정 격자(점검): 일정이 여러 날이라 처음은 주 보기(일 단위), 막대 55개 모두 라벨, 충돌 9건·미배정 5건, 한계 줄', () => {
  const data = withStores(load('inspection'));
  const m = schedulePage.meta(data.ctx);
  assert.equal(m.name, '점검 일정 격자');
  const html = schedulePage.render({ ...DEFAULT_STATE, page: 'schedule' }, data);
  assert.doesNotMatch(html, BAD);
  assert.ok(html.includes('이 화면의 한계'));
  assert.match(html, /data-schedule-grid data-scale="day"/);
  assert.equal((html.match(/data-bar="/g) || []).length, 55);
  assert.equal((html.match(/<span class="sh-bar-label">/g) || []).length, 55);
  assert.equal((html.match(/data-conflict-row=/g) || []).length, 9);
  assert.equal((html.match(/data-unassigned-row=/g) || []).length, 5);
  assert.match(html, /10-26/);
  assert.match(html, /data-scale-btn="hour"[^>]*>일</);
  assert.match(html, /data-scale-btn="day"[^>]*aria-pressed="true"[^>]*>주</);
  assert.match(html, /data-day-select/);
});

test('일정 격자: 일 보기는 시 단위 열(06시~)과 그날 막대만, 날짜를 고르면 일 보기로 바뀐다', () => {
  const S = schedulePage.createState(withStores(load('inspection')));
  assert.equal(S.scale, 'day');
  schedulePage.pickDay(S, '2026-10-28');
  assert.equal(S.scale, 'hour');
  const html = schedulePage.gridHtml(S, schedulePage.modelOf(S));
  assert.match(html, /06시/);
  assert.match(html, /21시/);
  assert.doesNotMatch(html.split('data-bar=')[0], /10-27/);
  const n = (html.match(/data-bar="/g) || []).length;
  assert.ok(n > 0 && n < 55, `일 보기 막대 ${n}개`);
  assert.equal((html.match(/<span class="sh-bar-label">/g) || []).length, n);
});

test('일정 격자: 충돌 → 옮겨서 해소 → 확정 본문 (충돌이 있으면 확정 불가, 종료가 시작보다 앞서면 거절)', () => {
  const S = schedulePage.createState(withStores(load('inspection')));
  assert.equal(schedulePage.modelOf(S).conflicts.length, 9);
  assert.equal(schedulePage.canConfirm(S), false);
  assert.equal(confirmPayload(schedulePage.modelOf(S), S.edits, '2026-10-28T10:00:00'), null);
  const target = schedulePage.modelOf(S).conflicts[0].ids[1];
  assert.equal(schedulePage.applyEdit(S, target, { resource: 'EQP-001', start: '2026-10-28T12:00:00', end: '2026-10-28T10:00:00' }), '종료는 시작보다 뒤여야 합니다.');
  assert.deepEqual(S.edits, {});
  // 충돌 일정 하나를 격자 밖 날짜로 옮기는 것을 충돌이 없어질 때까지 되풀이
  for (let i = 0; i < 20 && schedulePage.modelOf(S).conflicts.length; i++) {
    const id = schedulePage.modelOf(S).conflicts[0].ids.at(-1);
    assert.equal(schedulePage.applyEdit(S, id, { start: '2026-12-01T09:00:00', end: '2026-12-01T10:00:00' }), '');
  }
  assert.equal(schedulePage.modelOf(S).conflicts.length, 0);
  assert.equal(schedulePage.canConfirm(S), true);
  const body = schedulePage.payloadOf(S, '2026-10-28T10:00:00');
  assert.equal(body.ts, '2026-10-28T10:00:00');
  assert.ok(body.count < 55 && body.count > 40);
  assert.ok(Object.keys(body.edits).length > 0);
});

test('문서 검토(문서): 처음은 불확실 59건을 신뢰도 낮은 순으로, 맨 위 DOC-0243(37%)을 열고 본문·태그·사유 칸이 있다', () => {
  const data = withStores(load('documents'));
  const html = reviewPage.render({ ...DEFAULT_STATE, page: 'review' }, data);
  assert.doesNotMatch(html, BAD);
  assert.ok(html.includes('이 화면의 한계'));
  assert.equal((html.match(/data-doc="/g) || []).length, 59);
  assert.match(html, /data-doc="DOC-0243"[^>]*data-state="selected"/);
  assert.match(html, /data-filter="uncertain"[^>]*aria-pressed="true"[^>]*>불확실 59</);
  assert.match(html, /data-filter="all"[^>]*>전체 300</);
  assert.match(html, /data-filter="done"[^>]*>확정 131</);
  assert.match(html, /data-review-body/);
  assert.match(html, /data-tags/);
  assert.match(html, /data-add-tag/);
  assert.match(html, />분류 확정</);
});

test('문서 검토: 태그를 더하고 빼고, 빈 분류·빈 사유는 글자 그대로 거르고, 저장 기록은 분류 확정 상태', () => {
  const S = reviewPage.createState(withStores(load('documents')));
  assert.equal(S.selected, 'DOC-0243');
  reviewPage.setTags(S, []);
  reviewPage.setReason(S, '   ');
  assert.deepEqual(reviewPage.buildSave(S, '2026-10-28T10:00:00').errs, { tags: '분류를 하나 이상 고르세요.', reason: '판정 사유를 입력하세요.' });
  reviewPage.addTagTo(S, '패키징');
  reviewPage.addTagTo(S, '패키징');
  reviewPage.addTagTo(S, '회로 설계');
  assert.deepEqual(S.tags, ['패키징', '회로 설계']);
  reviewPage.removeTagFrom(S, '패키징');
  assert.deepEqual(S.tags, ['회로 설계']);
  reviewPage.setReason(S, ' 청구항이 회로 구성 중심 ');
  const out = reviewPage.buildSave(S, '2026-10-28T10:00:00');
  assert.deepEqual(out.errs, {});
  assert.deepEqual(out.saved['DOC-0243'], { tags: ['회로 설계'], reason: '청구항이 회로 구성 중심', status: '확정', ts: '2026-10-28T10:00:00', who: '지식재산 담당' });
});

test('문서 검토: 신뢰도 필터와 확정 목록', () => {
  const S = reviewPage.createState(withStores(load('documents')));
  reviewPage.setFilter(S, 'all');
  assert.equal(reviewPage.listOf(S).length, 300);
  reviewPage.setMinConf(S, '90');
  const hi = reviewPage.listOf(S);
  assert.ok(hi.length > 0 && hi.every((r) => r.confidence >= 90));
  reviewPage.setMinConf(S, '');
  reviewPage.setFilter(S, 'done');
  assert.equal(reviewPage.listOf(S).length, 131);
});

const RISKY = '솔직히 말해서 혼자 다 했습니다. 결과는 좋았고 많이 배웠습니다.';
test('AI 피드백(인터뷰): 같은 답변이면 같은 판정·같은 화면, 위험 표현을 굵게, 「AI 제안」과 「모의 응답」을 따로 표시', () => {
  const { ctx } = load('interview');
  const cfg = ctx.d.assist;
  const row = ctx.rows[0];
  const a = assistPage.resultFor(cfg, row, RISKY);
  const b = assistPage.resultFor(cfg, row, RISKY);
  assert.equal(a.judgement.code, 'risk');
  assert.equal(a.judgement.label, '위험 표현 있음');
  assert.deepEqual(a, b);
  const mock = { state: 'done', source: 'mock', reason: 'no-key', text: mockSuggestion({ code: 'risk', terms: a.judgement.terms }) };
  const h1 = assistPage.feedbackHtml(cfg, { ...a, ai: mock });
  assert.equal(h1, assistPage.feedbackHtml(cfg, { ...b, ai: mock }));
  assert.match(h1, /위험 표현 있음/);
  assert.match(h1, /<strong>솔직히<\/strong>/);
  assert.match(h1, /<strong>혼자 다<\/strong>/);
  assert.match(h1, /data-hit="true"/);
  assert.match(h1, /AI 제안/);
  assert.match(h1, /data-mock>모의 응답</);
  assert.match(h1, /「혼자 다」, 「솔직히」/);
  assert.doesNotMatch(h1, BAD);
  const loading = assistPage.feedbackHtml(cfg, { ...a, ai: { state: 'loading' } });
  assert.doesNotMatch(loading, /모의 응답/);
  const short = assistPage.feedbackHtml(cfg, { ...assistPage.resultFor(cfg, row, '네'), ai: { state: 'loading' } });
  assert.match(short, /답변 부족/);
  const safe = assistPage.resultFor(cfg, row, '팀 일정이 밀렸을 때 역할을 나누고 매일 아침 진행 상황을 공유했습니다. 결과적으로 기한 안에 마쳤습니다.');
  assert.equal(safe.judgement.label, '위험 표현 없음');
  assert.ok(assistPage.feedbackHtml(cfg, null).includes('아직 피드백이 없습니다'));
});

test('AI 피드백 페이지: 질문 60개 목록·답변 칸·녹음 영역·한계 줄', () => {
  const data = withStores(load('interview'));
  assert.equal(assistPage.meta(data.ctx).name, '인터뷰 연습');
  const html = assistPage.render({ ...DEFAULT_STATE, page: 'assist' }, data);
  assert.doesNotMatch(html, BAD);
  assert.ok(html.includes('이 화면의 한계'));
  assert.equal((html.match(/data-q="/g) || []).length, 60);
  assert.match(html, /data-answer/);
  assert.match(html, /data-record/);
  assert.match(html, /data-recorder/);
  assert.match(html, /data-rec-transcribe[^>]*disabled/);
  assert.doesNotMatch(html, /data-rec-mock/);
  assert.match(html, /data-submit[^>]*disabled/);
  assert.match(html, />피드백 받기</);
});

test('AI 어댑터 사본(assist-api.mjs): 키 없음 → 모의, 키 있음 → OpenAI 요청 모양, 실패 → 모의 + 이유, 키는 응답에 없다', async () => {
  const body = { question: 'q', answer: RISKY, code: 'risk', terms: ['솔직히', '혼자 다'], sentences: [RISKY], minChars: 30 };
  const failFetch = () => { throw new Error('키가 없으면 fetch 를 부르지 않는다'); };
  const r = await createAssist({ env: {}, fetchImpl: failFetch })(body);
  assert.deepEqual([r.status, r.json.source, r.json.reason], [200, 'mock', 'no-key']);
  assert.equal(r.json.suggestion, '「솔직히」, 「혼자 다」 같은 표현은 단정하거나 부정적으로 들릴 수 있습니다. 상황, 내가 한 행동, 결과 순서로 사실과 근거를 한 문장씩 적어 다시 말해 보세요.');
  const calls = [];
  const ok = await createAssist({ env: { OPENAI_API_KEY: 'sk-test-0000', OPENAI_MODEL: 'm1' }, fetchImpl: async (u, i) => { calls.push([u, i]); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: ' 결론부터 말해 보세요. ' } }] }) }; } })(body);
  assert.equal(calls[0][0], OPENAI_URL);
  assert.equal(calls[0][1].headers.Authorization, 'Bearer sk-test-0000');
  assert.deepEqual(ok, { status: 200, json: { suggestion: '결론부터 말해 보세요.', source: 'openai', model: 'm1' } });
  const bad = await createAssist({ env: { OPENAI_API_KEY: 'sk-test-0000' }, fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }) })(body);
  assert.deepEqual([bad.json.source, bad.json.reason], ['mock', 'http-401']);
  assert.ok(!JSON.stringify(bad).includes('sk-test-0000'));
  const slow = await createAssist({ env: { OPENAI_API_KEY: 'sk-test-0000' }, timeoutMs: 20, fetchImpl: (_u, i) => new Promise((_ok, fail) => i.signal.addEventListener('abort', () => fail(Object.assign(new Error('x'), { name: 'AbortError' })))) })(body);
  assert.equal(slow.json.reason, 'timeout');
  assert.ok(parseBody({ ...body, code: 'nope' }).error);
});

test('서버: POST /api/assist 는 키가 없으면 모의 응답(두 번 같음), 잘못된 본문 400, GET 405 · 일정·검토 저장소 씨앗 200', async (t) => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: here, env: { ...process.env, PORT: '0', OPENAI_API_KEY: '', OPENAI_MODEL: '' } });
  t.after(() => srv.kill());
  const port = await new Promise((ok, fail) => {
    srv.stderr.on('data', (d) => fail(new Error(String(d))));
    srv.stdout.once('data', (d) => ok(Number(String(d).match(/PORT=(\d+)/)[1])));
  });
  const base = `http://127.0.0.1:${port}`;
  const post = (b) => fetch(`${base}/api/assist`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof b === 'string' ? b : JSON.stringify(b) });
  const body = { question: 'q', answer: RISKY, code: 'risk', terms: ['솔직히'], sentences: [], minChars: 30 };
  const j1 = await (await post(body)).json();
  const j2 = await (await post(body)).json();
  assert.deepEqual(j1, j2);
  assert.deepEqual([j1.source, j1.reason], ['mock', 'no-key']);
  assert.equal((await post({ ...body, code: 'x' })).status, 400);
  assert.equal((await post('{깨짐')).status, 400);
  assert.equal((await fetch(`${base}/api/assist`)).status, 405);
  assert.deepEqual(await (await fetch(`${base}/api/schedule-inspection`)).json(), {});
  assert.deepEqual(await (await fetch(`${base}/api/review-documents`)).json(), {});
  assert.equal((await fetch(`${base}/api/schedule-alarm`)).status, 404);
});

test('shell.css: 새 페이지 규칙(막대·충돌 막대)이 있고 주황 선택 표시가 없다', () => {
  const css = fs.readFileSync(path.join(here, 'shell.css'), 'utf8');
  assert.match(css, /\.sh-bar\b/);
  assert.match(css, /\.sh-bar\[data-conflict="true"\]/);
  assert.doesNotMatch(css, /data-selected[^}]*accent/);
  assert.doesNotMatch(css, /data-state="selected"[^}]*accent/);
});

test('W1 방향 없는 지표(better:null)는 개선·악화 없이 증감만', async () => {
  const W = await import('./widgets.js');
  const html = W.metricRow({ items: [{ label: '건수', value: 12, unit: '건', delta: 3, better: null, spark: [] }] });
  assert.ok(!html.includes('개선') && !html.includes('악화'), html);
  assert.ok(html.includes('▲ 3'), html);
});

test('W18 녹음·전사: 녹음 시작·파일 올리기·텍스트로 바꾸기(처음엔 비활성)·시간 표시, 색 값 없음, 카탈로그 한 줄', () => {
  const w = WIDGETS.find((x) => x.no === 'W18');
  assert.equal(w.name, '녹음·전사');
  assert.match(w.when, /말로/);
  const html = w.fn();
  assert.match(html, /data-recorder/);
  assert.match(html, /data-rec-start/);
  assert.match(html, /type="file"[^>]*accept="audio\/\*"/);
  assert.match(html, /data-rec-transcribe[^>]*disabled/);
  assert.match(html, /0:00 \/ 2:00/);
  assert.match(html, /<textarea[^>]*data-rec-text/);
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,6}\b|undefined|NaN/);
  const noText = recorderHtml({ text: false, maxSec: 90 });
  assert.doesNotMatch(noText, /data-rec-text/);
  assert.match(noText, /0:00 \/ 1:30/);
  assert.equal(fmtClock(0), '0:00');
  assert.equal(fmtClock(65), '1:05');
  assert.equal(fmtClock(120), '2:00');
});

test('음성 전사 어댑터 사본(transcribe-api.mjs): 키 없음 → 모의(같은 글), 키 있음 → 요청 모양, 실패 → 모의 + 이유, 400', async () => {
  const body = { audio: Buffer.alloc(5000, 1).toString('base64'), mime: 'audio/webm' };
  const failFetch = () => { throw new Error('키가 없으면 fetch 를 부르지 않는다'); };
  const r = await createTranscribe({ env: {}, fetchImpl: failFetch })(body);
  assert.deepEqual([r.status, r.json.mock, r.json.reason, r.json.text], [200, true, 'no-key', '네, 먼저 오늘 경기에 대해 간단히 말씀드리겠습니다.']);
  assert.equal(mockTranscript(5000), r.json.text);
  const calls = [];
  const ok = await createTranscribe({ env: { OPENAI_API_KEY: 'sk-test-0000' }, fetchImpl: async (u, i) => { calls.push([u, i]); return { ok: true, status: 200, json: async () => ({ text: ' 전사 결과 ' }) }; } })(body);
  assert.equal(calls[0][0], STT_URL);
  assert.equal(calls[0][1].headers.Authorization, 'Bearer sk-test-0000');
  assert.equal(calls[0][1].body.get('language'), 'ko');
  assert.deepEqual(ok, { status: 200, json: { text: '전사 결과', source: 'openai', mock: false, model: 'whisper-1' } });
  const bad = await createTranscribe({ env: { OPENAI_API_KEY: 'sk-test-0000' }, fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) })(body);
  assert.deepEqual([bad.json.mock, bad.json.reason], [true, 'http-500']);
  assert.ok(!JSON.stringify(bad).includes('sk-test-0000'));
  assert.equal((await createTranscribe({ env: {}, fetchImpl: failFetch })({ ...body, mime: 'text/plain' })).status, 400);
});

test('서버: POST /api/transcribe 는 키가 없으면 모의 전사(두 번 같음), 형식·크기 오류 400, GET 405', async (t) => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: here, env: { ...process.env, PORT: '0', OPENAI_API_KEY: '', OPENAI_STT_MODEL: '' } });
  t.after(() => srv.kill());
  const port = await new Promise((ok, fail) => {
    srv.stderr.on('data', (d) => fail(new Error(String(d))));
    srv.stdout.once('data', (d) => ok(Number(String(d).match(/PORT=(\d+)/)[1])));
  });
  const base = `http://127.0.0.1:${port}`;
  const post = (b) => fetch(`${base}/api/transcribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof b === 'string' ? b : JSON.stringify(b) });
  const body = { audio: Buffer.alloc(60000, 3).toString('base64'), mime: 'audio/ogg' };
  const j1 = await (await post(body)).json();
  const j2 = await (await post(body)).json();
  assert.deepEqual(j1, j2);
  assert.deepEqual([j1.mock, j1.source, j1.reason], [true, 'mock', 'no-key']);
  assert.equal(j1.text, '네, 오늘 경기에서는 초반 운영이 가장 중요했다고 생각합니다. 팀원들과 미리 맞춘 계획대로 움직였고, 결과도 만족스럽습니다.');
  assert.equal((await post({ ...body, mime: 'text/plain' })).status, 400);
  assert.equal((await post('{깨짐')).status, 400);
  assert.equal((await post({ audio: Buffer.alloc(9 * 1024 * 1024, 1).toString('base64'), mime: 'audio/webm' })).status, 400);
  assert.equal((await fetch(`${base}/api/transcribe`)).status, 405);
});
