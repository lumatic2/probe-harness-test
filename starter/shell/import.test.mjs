// 실행: node --test starter/shell/import.test.mjs
// CSV 올리기(#/import) 셸 쪽: 서버의 저장소 계약(/api/import-<도메인> · import-prev-<도메인>)과 페이지가 그려지는지.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { makeCtx, DEFAULT_STATE } from './util.js';
import * as importPage from './pages/import.js';
import { createState, loadText, recompute, pageHtml, errorsHtml } from './pages/import.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DOM = path.join(here, '..', 'domains');
const readDom = (n, f) => JSON.parse(fs.readFileSync(path.join(DOM, n, f), 'utf8'));
const dataOf = (n) => ({ ctx: makeCtx(readDom(n, 'domain.json'), readDom(n, 'sample.json')), baseSample: readDom(n, 'sample.json'), imported: {}, prevImported: {} });
const BAD = /undefined|NaN|\[object Object\]/;
const HEAD = '알람,장비,공정,코드,심각도,발생 시각,상태,담당';

test('서버: import-<도메인> 은 저장 전에도 200 {} (브라우저에 404 가 안 뜬다), 쓰면 그대로 읽힌다, 이름 규칙은 그대로', async (t) => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: here, env: { ...process.env, PORT: '0' } });
  const files = ['import-alarm.json', 'import-prev-alarm.json'].map((f) => path.join(here, 'data', 'store', f));
  const saved = files.map((f) => (fs.existsSync(f) ? fs.readFileSync(f) : null)); // 이미 있던 저장물은 끝나고 되돌린다
  files.forEach((f) => fs.rmSync(f, { force: true }));
  t.after(() => { srv.kill(); files.forEach((f, i) => { if (saved[i]) fs.writeFileSync(f, saved[i]); else fs.rmSync(f, { force: true }); }); });
  const port = await new Promise((ok, fail) => {
    srv.stderr.on('data', (d) => fail(new Error(String(d))));
    srv.stdout.once('data', (d) => ok(Number(String(d).match(/PORT=(\d+)/)[1])));
  });
  const base = `http://127.0.0.1:${port}`;
  const get = (n) => fetch(`${base}/api/${n}`);
  const r = await get('import-alarm');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {});
  assert.deepEqual(await (await get('import-prev-alarm')).json(), {});
  const body = { rows: [{ alarm_id: 'ALM-9' }], meta: { source: 'a.csv' } };
  const w = await fetch(`${base}/api/import-alarm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(w.status, 200);
  assert.deepEqual(await (await get('import-alarm')).json(), body);
  assert.equal((await get('other-alarm')).status, 404);
});

test('페이지: import 키가 있는 도메인에서만 켜지고(9개 모두 켬), 파일 전에는 현재 데이터·빈 미리보기·한계 줄', () => {
  for (const n of ['alarm', 'documents', 'education', 'inspection', 'interview', 'power', 'purchase', 'transport', 'yield']) assert.equal(importPage.enabled(dataOf(n).ctx), true, n);
  assert.equal(importPage.enabled({ d: {} }), false);
  const data = dataOf('alarm');
  assert.equal(importPage.meta(data.ctx).name, 'CSV 올리기');
  const html = importPage.render({ ...DEFAULT_STATE, page: 'import' }, data);
  assert.doesNotMatch(html, BAD);
  assert.match(html, new RegExp(`기본 샘플 · ${data.ctx.s.rows.length}건`));
  assert.match(html, /data-pick/);
  assert.match(html, /아직 고른 파일이 없습니다/);
  assert.ok(html.includes('이 화면의 한계'));
  assert.doesNotMatch(html, /data-apply/);
});

test('페이지: 오류가 섞인 파일 → 열 대응 표·오류 목록(행·열·값·이유)·미리보기 20행·「정상 행만 반영」', () => {
  const S = createState(dataOf('alarm'));
  const lines = [HEAD];
  for (let i = 0; i < 25; i++) lines.push(`ALM-9${String(i).padStart(3, '0')},EQP-101,식각,E-101,긴급,2026-10-28 09:00,미조치,`);
  lines.push('ALM-9100,EQP-101,식각,E-101,매우긴급,2026-10-28 09:00,미조치,');
  loadText(S, 'a.csv', 2048, lines.join('\n'), 'UTF-8');
  const html = pageHtml(S);
  assert.doesNotMatch(html, BAD);
  assert.match(html, /정상 25행 · 오류 1행/);
  assert.match(html, /<tr data-err-line="27"><td>27<\/td><td>심각도<\/td><td>매우긴급<\/td><td>허용 값이 아님 \(긴급 · 주의 · 정보\)<\/td><\/tr>/);
  assert.equal((html.match(/data-map="/g) || []).length, 8);
  assert.equal((html.match(/<td>\d+<\/td><td>ALM-9/g) || []).length, 20);
  assert.match(html, />정상 행만 반영 \(25행\)</);
  assert.match(html, /data-file-info>a\.csv · 2KB · UTF-8 · 26행/);
  S.mode = 'append'; recompute(S);
  assert.match(pageHtml(S), /data-mode="append" aria-pressed="true"/);
});

test('페이지: 필수 열을 못 맞추면 막는 문구만 보이고 반영 버튼이 꺼진다', () => {
  const S = createState(dataOf('alarm'));
  loadText(S, 'b.csv', 100, '장비,공정\nEQP-101,식각', 'UTF-8');
  const html = pageHtml(S);
  assert.match(html, /필수 열을 맞추지 못했습니다: 알람, 발생 시각/);
  assert.match(html, /data-apply disabled/);
  assert.match(errorsHtml(S.result, S.ctx.d), /data-blocked/);
});

test('페이지: 데이터 행이 없는 파일은 오류 문구', () => {
  const S = createState(dataOf('alarm'));
  loadText(S, 'c.csv', 10, '알람,장비\n', 'UTF-8');
  assert.equal(S.error, '데이터 행이 없는 파일입니다.');
  assert.match(pageHtml(S), /data-error/);
});

test('페이지: 반영된 데이터가 있으면 현재 데이터 줄에 파일·행 수·방식이 나오고 되돌리기가 켜진다', () => {
  const data = dataOf('alarm');
  data.imported = { rows: [{ alarm_id: 'X' }], meta: { source: 'n.csv', mode: 'append', at: '2026-10-29T10:00:00', added: 5, skipped: 0, total: 396 } };
  data.prevImported = { original: true };
  const html = pageHtml(createState(data));
  assert.match(html, /n\.csv · 396건 · 2026-10-29 10:00 · 덧붙이기 \+5/);
  assert.doesNotMatch(html, /data-undo disabled/);
});
