// 실행: node --test starter/shell/settings.test.mjs
// 기준값 설정 페이지(pages/settings.js)의 그리기 함수 + 서버의 /api/settings-<도메인> 씨앗·저장 왕복 + 하단 한계 줄 — 손으로 쓴 기대값과 비교한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { limitLine, makeCtx, paramDefs, paramValues, whatIf } from './util.js';
import { compareHtml, enabled, historyHtml, paramRow } from './pages/settings.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dom = (n) => JSON.parse(fs.readFileSync(path.join(here, '..', 'domains', n, 'domain.json'), 'utf8'));
const smp = (n) => JSON.parse(fs.readFileSync(path.join(here, '..', 'domains', n, 'sample.json'), 'utf8'));
const load = (n, saved) => makeCtx(dom(n), smp(n), saved);

test('설정 페이지는 params 가 있는 도메인에서만 켜진다', () => {
  assert.equal(enabled(load('alarm')), true);
  assert.equal(enabled(load('education')), false);
});

test('입력칸: 숫자는 범위·단위가 붙은 number, enum 은 select, bool 은 switch', () => {
  const alarm = paramDefs(dom('alarm'));
  const num = paramRow(alarm[0], 48, '48시간');
  assert.match(num, /type="number"/);
  assert.match(num, /min="1" max="336" step="1"/);
  assert.match(num, /<span class="sh-unit">시간<\/span>/);
  assert.match(num, /미완료 알람의 에스컬레이션 대상 · 기본 48시간/);
  const buy = paramDefs(dom('purchase')).find((p) => p.key === 'basis');
  const sel = paramRow(buy, 'cal_delay', '영업일');
  assert.match(sel, /<option value="delay">영업일<\/option><option value="cal_delay" selected>달력일<\/option>/);
  const pw = paramDefs(dom('power')).find((p) => p.key === 'skip_outage');
  assert.match(paramRow(pw, true, '켬'), /role="switch"[^>]* checked>/);
  assert.match(paramRow(pw, false, '켬'), /<span class="sh-switch-text">끔<\/span>/);
});

test('비교 칸: 바뀐 게 없으면 한 줄, 바꾸면 지표 표 + 판정이 바뀌는 행', () => {
  const ctx = load('alarm');
  assert.match(compareHtml(whatIf(ctx, {})), /바꾼 값이 없습니다\./);
  const html = compareHtml(whatIf(ctx, { esc_h: 24 }));
  assert.match(html, /<th scope="row">에스컬레이션 대상<\/th><td class="skh-num">77건<\/td><td class="skh-num">93건<\/td><td class="skh-num" data-diff>\+16건<\/td>/);
  assert.match(html, /판정이 바뀌는 행 16건/);
  assert.match(html, /기한 내 → 에스컬레이션 16건/);
  assert.equal((html.match(/<a href="#\/item\//g) || []).length, 10);
  assert.match(html, /상위 10건만 표시/);
});

test('변경 이력 표: 최근 것이 위, 시각·항목·이전 → 이후·사유', () => {
  assert.match(historyHtml([]), /저장된 변경이 없습니다\./);
  const h = historyHtml([
    { ts: '2026-10-29 09:00', label: '에스컬레이션 기준', from: '48시간', to: '24시간', reason: '첫째' },
    { ts: '2026-10-29 10:00', label: '조치 완료율 목표', from: '85%', to: '90%', reason: '둘째' },
  ]);
  assert.ok(h.indexOf('둘째') < h.indexOf('첫째'));
  assert.match(h, /<td>조치 완료율 목표<\/td><td>85% → 90%<\/td><td>둘째<\/td>/);
});

test('하단 한계 줄: 기본값이면 그대로, 저장된 기준값이 다르면 사실 한 줄이 붙는다', () => {
  assert.doesNotMatch(limitLine(load('alarm')), /기준값 사용자 설정 적용/);
  assert.match(limitLine(load('alarm', { esc_h: 24 })), /기준값 사용자 설정 적용\(에스컬레이션 기준 24시간\)<\/p>/);
  assert.match(limitLine(load('alarm', { esc_h: 24 }), '추가 문구'), /추가 문구 · 기준값 사용자 설정 적용/);
});

test('app.js 에 설정 페이지가 등록되고 필터 줄은 숨긴다', () => {
  const app = fs.readFileSync(path.join(here, 'app.js'), 'utf8');
  assert.match(app, /import \* as settings from '\.\/pages\/settings\.js'/);
  assert.match(app, /\['settings', '⚙'\]/);
  assert.match(app, /'assist', 'settings'\]\.includes\(state\.page\)/);
});

test('서버: /api/settings-<도메인> 씨앗 200 · 저장 왕복 · 기준값 없는 도메인은 404', async (t) => {
  const store = path.join(here, 'data/store/settings-alarm.json');
  const backup = fs.existsSync(store) ? fs.readFileSync(store) : null;
  t.after(() => { if (backup) fs.writeFileSync(store, backup); else fs.rmSync(store, { force: true }); });
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: here, env: { ...process.env, PORT: '0' } });
  t.after(() => srv.kill());
  const port = await new Promise((ok, fail) => {
    srv.stderr.on('data', (d) => fail(new Error(String(d))));
    srv.stdout.once('data', (d) => ok(Number(String(d).match(/PORT=(\d+)/)[1])));
  });
  const base = `http://127.0.0.1:${port}`;
  fs.rmSync(store, { force: true });
  assert.deepEqual(await (await fetch(`${base}/api/settings-alarm`)).json(), { values: {}, history: [] });
  assert.equal((await fetch(`${base}/api/settings-education`)).status, 404);
  const rec = { values: paramValues(dom('alarm'), { esc_h: 24 }), history: [{ ts: '2026-10-29 09:00', key: 'esc_h', label: '에스컬레이션 기준', unit: '시간', from: '48시간', to: '24시간', reason: '테스트' }] };
  assert.equal((await fetch(`${base}/api/settings-alarm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rec) })).status, 200);
  assert.deepEqual(await (await fetch(`${base}/api/settings-alarm`)).json(), rec);
});
