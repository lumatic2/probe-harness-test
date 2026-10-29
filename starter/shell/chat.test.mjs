// 실행: node --test starter/shell/chat.test.mjs
// W17 AI 대화창(셸 판) — 위젯 HTML(빈 상태·말풍선·배지·대기·실패), 카탈로그 등록, 서버 /api/chat 왕복, 어댑터 사본, 옆 패널 연결.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { chatMessagesHtml, chatWidget, WIDGETS } from './widgets.js';
import { createChat, mockReply, OPENAI_URL } from './chat-api.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BAD = /undefined|NaN|\[object Object\]/;
const text = (f) => fs.readFileSync(path.join(here, f), 'utf8');

test('카탈로그: W17 AI 대화창이 W16 다음에 있고 「언제 쓰나」가 있다', () => {
  const w = WIDGETS.find((x) => x.no === 'W17');
  assert.ok(w);
  assert.equal(w.name, 'AI 대화창');
  assert.equal(WIDGETS[WIDGETS.findIndex((x) => x.no === 'W16') + 1], w);
  assert.match(w.when, /AI 에게 묻/);
});

test('W17 빈 상태: 아직 대화가 없다는 한 줄, 입력칸·보내기·대화 지우기, 첫 질문 칩', () => {
  const html = chatWidget({ title: '장비 알람 질문', suggestions: ['긴급 알람은 몇 건이야?', '평균 가동률이 어때?'] });
  assert.doesNotMatch(html, BAD);
  assert.match(html, /data-chat\b/);
  assert.match(html, /아직 대화가 없습니다/);
  assert.match(html, /<textarea[^>]*data-chat-input/);
  assert.match(html, /aria-label="질문"/);
  assert.match(html, /<button[^>]*data-chat-send[^>]*>보내기</);
  assert.match(html, /<button[^>]*data-chat-clear[^>]*>대화 지우기</);
  assert.match(html, /<button[^>]*data-chat-suggest="긴급 알람은 몇 건이야\?"[^>]*>긴급 알람은 몇 건이야\?</);
  assert.equal((html.match(/data-chat-suggest=/g) || []).length, 2);
  assert.doesNotMatch(chatWidget({}), /data-chat-suggest/);
  assert.doesNotMatch(chatWidget(), BAD);
});

test('W17 말풍선: 사용자/AI 구분, 응답 옆 배지(AI 응답 · 모의 응답), 실패 이유, 글자는 이스케이프, 대화가 있으면 칩은 숨김', () => {
  const messages = [
    { role: 'user', content: '미연습은? <b>' },
    { role: 'assistant', content: '화면 데이터 기준으로 「미연습: 12개」입니다.', source: 'mock', reason: 'no-key' },
    { role: 'user', content: '다시' },
    { role: 'assistant', content: '12개입니다.', source: 'openai' },
    { role: 'user', content: '또' },
    { role: 'assistant', content: '모의로 대신합니다.', source: 'mock', reason: 'timeout' },
  ];
  const html = chatWidget({ suggestions: ['칩'], messages });
  assert.doesNotMatch(html, BAD);
  assert.equal((html.match(/data-role="user"/g) || []).length, 3);
  assert.equal((html.match(/data-role="assistant"/g) || []).length, 3);
  assert.equal((html.match(/>AI 응답</g) || []).length, 1);
  assert.equal((html.match(/>모의 응답</g) || []).length, 2);
  assert.ok(html.includes('미연습은? &lt;b&gt;'));
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('OpenAI 호출 실패(시간 초과) — 모의 응답으로 대신함'));
  assert.equal((html.match(/OpenAI 호출 실패/g) || []).length, 1); // 키 없음(no-key)은 이유를 말하지 않는다
  assert.doesNotMatch(html, /data-chat-suggest/);
  assert.doesNotMatch(html, /아직 대화가 없습니다/);
});

test('W17 대기·실패 표시', () => {
  const wait = chatMessagesHtml([{ role: 'user', content: '질문' }], { pending: true });
  assert.match(wait, /data-pending[^>]*>답변을 만드는 중/);
  const fail = chatMessagesHtml([{ role: 'user', content: '질문' }], { error: '답변을 불러오지 못했습니다(응답 오류 500).' });
  assert.match(fail, /role="alert"[^>]*>답변을 불러오지 못했습니다\(응답 오류 500\)\./);
  assert.doesNotMatch(chatMessagesHtml([{ role: 'user', content: '질문' }], {}), /data-pending|role="alert"/);
});

test('어댑터 사본(chat-api.mjs): 키 없음 → 모의(결정적), 키 있음 → OpenAI 요청 모양, 키는 응답에 없다', async () => {
  const body = { messages: [{ role: 'user', content: '미연습은?' }], context: '미연습: 12개\n기한 초과: 3개' };
  const a = await createChat({ env: {}, fetchImpl: () => { throw new Error('호출 금지'); } })(body);
  assert.deepEqual(a, await createChat({ env: {} })(body));
  assert.deepEqual(a, { status: 200, json: { reply: '화면 데이터 기준으로 「미연습: 12개」입니다.', source: 'mock', mock: true, reason: 'no-key' } });
  assert.equal(mockReply(body), '화면 데이터 기준으로 「미연습: 12개」입니다.');
  const calls = [];
  const ok = await createChat({ env: { OPENAI_API_KEY: 'sk-test-0000', OPENAI_MODEL: 'm1' }, fetchImpl: async (u, i) => { calls.push([u, i]); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '12개' } }] }) }; } })(body);
  assert.equal(calls[0][0], OPENAI_URL);
  assert.equal(calls[0][1].headers.Authorization, 'Bearer sk-test-0000');
  assert.deepEqual(ok, { status: 200, json: { reply: '12개', source: 'openai', mock: false, model: 'm1' } });
});

test('서버: POST /api/chat 는 키가 없으면 모의 응답(두 번 같음), 잘못된 본문 400, GET 405', async (t) => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: here, env: { ...process.env, PORT: '0', OPENAI_API_KEY: '', OPENAI_MODEL: '' } });
  t.after(() => srv.kill());
  const port = await new Promise((ok, fail) => {
    srv.stderr.on('data', (d) => fail(new Error(String(d))));
    srv.stdout.once('data', (d) => ok(Number(String(d).match(/PORT=(\d+)/)[1])));
  });
  const base = `http://127.0.0.1:${port}`;
  const post = (b) => fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof b === 'string' ? b : JSON.stringify(b) });
  const body = { messages: [{ role: 'user', content: '미연습은?' }], context: '미연습: 12개' };
  const j1 = await (await post(body)).json();
  assert.deepEqual(j1, await (await post(body)).json());
  assert.deepEqual(j1, { reply: '화면 데이터 기준으로 「미연습: 12개」입니다.', source: 'mock', mock: true, reason: 'no-key' });
  assert.equal((await post({ messages: [] })).status, 400);
  assert.equal((await post('{깨짐')).status, 400);
  assert.equal((await fetch(`${base}/api/chat`)).status, 405);
  assert.equal((await fetch(`${base}/chat.js`)).status, 200);
});

test('연결: 헤더 버튼·옆 패널(index.html)과 app.js 가 도메인 설정 chat 키로 켠다 · 위젯 모음 W17 은 대화를 붙인다 · CSS 는 hex 없이', () => {
  const html = text('index.html');
  assert.match(html, /id="sh-chat-open"[^>]*hidden/);
  assert.match(html, /<aside[^>]*id="sh-chat"[^>]*hidden/);
  const app = text('app.js');
  assert.match(app, /chatConfig\(/);
  assert.match(app, /mountChat\(/);
  assert.match(text('pages/widgets.js'), /mountChat\(/);
  const css = text('shell.css');
  for (const c of ['.sh-chat-bubble', '.sh-chat-panel', '.sh-chat-list']) assert.ok(css.includes(c), c);
  const chatCss = css.split('\n').filter((l) => l.includes('sh-chat')).join('\n');
  assert.doesNotMatch(chatCss, /#[0-9a-fA-F]{3,8}\b|box-shadow|gradient|animation/);
  const js = text('chat.js');
  assert.match(js, /isSendKey\(/); // 한글 조합 중 Enter 는 전송하지 않는다 (판정은 domains/chat.mjs)
});

test('W17 근거 칩: 답 아래 「문서명 §n」 칩, 누르면(details) 소제목과 원문 문단이 펼쳐진다 · 글자는 이스케이프 · 근거 없으면 칩 없음', () => {
  const refs = [{ doc: '개인정보 처리 기준', n: 3, heading: '3. 개인정보는 어떻게 처리하는가', text: '열람자와 시각을 기록한다. <b>' }, { doc: '답변 평가 기준', n: 2, heading: '', text: '규칙이 판정한다.' }];
  const html = chatMessagesHtml([{ role: 'user', content: 'q' }, { role: 'assistant', content: '답 [개인정보 처리 기준 §3]', source: 'mock', reason: 'no-key', refs }]);
  assert.doesNotMatch(html, BAD);
  assert.equal((html.match(/<details[^>]*data-ref/g) || []).length, 2);
  assert.match(html, /<summary[^>]*>개인정보 처리 기준 §3<\/summary>/);
  assert.match(html, /<summary[^>]*>답변 평가 기준 §2<\/summary>/);
  assert.ok(html.includes('3. 개인정보는 어떻게 처리하는가'));
  assert.ok(html.includes('열람자와 시각을 기록한다. &lt;b&gt;'));
  assert.ok(html.includes('>모의 응답<')); // 배지는 그대로
  assert.doesNotMatch(chatMessagesHtml([{ role: 'assistant', content: '답', source: 'mock' }]), /<details/);
});

test('서버: GET /api/docs-<도메인> 은 domains/<도메인>/docs 의 md·txt 를 {파일명: 본문} 으로, 문서 폴더가 없으면 {}', async (t) => {
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: here, env: { ...process.env, PORT: '0', OPENAI_API_KEY: '', OPENAI_MODEL: '' } });
  t.after(() => srv.kill());
  const port = await new Promise((ok, fail) => {
    srv.stderr.on('data', (d) => fail(new Error(String(d))));
    srv.stdout.once('data', (d) => ok(Number(String(d).match(/PORT=(\d+)/)[1])));
  });
  const base = `http://127.0.0.1:${port}`;
  const got = await (await fetch(`${base}/api/docs-interview`)).json();
  assert.deepEqual(Object.keys(got).sort(), ['answer-rubric.md', 'privacy-standard.md', 'question-guide.md']);
  assert.match(got['privacy-standard.md'], /^# 개인정보 처리 기준\n/);
  assert.deepEqual(await (await fetch(`${base}/api/docs-yield`)).json(), {});
  assert.equal((await fetch(`${base}/api/docs-interview`, { method: 'POST', body: '{}' })).status, 405);
  assert.equal((await fetch(`${base}/api/docs-..%2F..`)).status, 400);
});

test('연결(근거 문서): app.js 가 chat.docs 일 때 문서를 불러 mountChat 에 paragraphs 로 넘기고, chat.js 는 askChat 에 전한다 · CSS 칩', () => {
  assert.match(text('app.js'), /api\/docs-/);
  assert.match(text('app.js'), /buildParagraphs\(/);
  assert.match(text('chat.js'), /paragraphs/);
  assert.ok(text('shell.css').includes('.sh-chat-refs'));
});
