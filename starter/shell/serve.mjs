// serve.mjs — 의존성 0 서버 (node starter/shell/serve.mjs → 0.0.0.0:3000, Browser 도구: PORT=3000, URL=/)
// - 정적 파일: 이 폴더 기준. /vendor/* 는 이 폴더에서 위로 올라가며 처음 만나는 vendor/skhynix/design.css 의 vendor 폴더.
// - /domains/*: 이 폴더의 형제 폴더 domains/ (도메인 설정·샘플 데이터). 셸과 shadcn 앱이 같이 쓰는 원본.
// - /api/<이름>: GET → data/store/<이름>.json 있으면 그것, 없으면 data/<이름>.json, 둘 다 없으면 404 JSON.
//                POST·PUT → 본문 JSON 검증(1MB 상한) 후 data/store/<이름>.json 에 쓴다.
//                decisions-·schedule-·review-·settings-<도메인> 의 처음 값은 domains/<도메인>/decisions.json · schedule.json · review.json · settings.json (없으면 404 — 화면은 빈 값으로 시작).
// - POST /api/chat: AI 대화창(chat-api.mjs) — 키·모의 응답 규칙은 assist 와 같다.
// - GET /api/docs-<도메인>: 근거 문서(domain.json chat.docs) — domains/<도메인>/docs/*.md|*.txt 를 {파일명: 본문} 으로(폴더가 없으면 {}). 문단 고르기는 화면이 한다(domains/docs.mjs).
// - POST /api/transcribe: 녹음(base64 JSON, 12MB 상한) → 글(transcribe-api.mjs). OPENAI_API_KEY(+OPENAI_STT_MODEL)는 이 프로세스의 환경변수에서만 읽고, 없거나 실패하면 모의 전사.
// - import-<도메인> · import-prev-<도메인> (CSV 올리기 저장물): 저장 전 GET 은 404 가 아니라 200 {} .
// - POST /api/assist: AI 개선 제안(assist-api.mjs). OPENAI_API_KEY(+OPENAI_MODEL)는 이 프로세스의 환경변수에서만 읽고, 없거나 실패·시간 초과면 모의 응답.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAssist } from './assist-api.mjs';
import { createChat } from './chat-api.mjs';
import { createTranscribe } from './transcribe-api.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT === undefined || process.env.PORT === '' ? 3000 : Number(process.env.PORT);
const MAX_BODY = 1024 * 1024;
const MAX_AUDIO_BODY = 12 * 1024 * 1024;
const STORE = path.join(ROOT, 'data', 'store');
const DOMAINS = path.join(ROOT, '..', 'domains');
const aiEnv = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_MODEL: process.env.OPENAI_MODEL };
const assist = createAssist({ env: aiEnv });
const chat = createChat({ env: aiEnv });
const transcribe = createTranscribe({ env: { OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_STT_MODEL: process.env.OPENAI_STT_MODEL } });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function findVendor() {
  let dir = ROOT;
  for (;;) {
    const v = path.join(dir, 'vendor');
    if (fs.existsSync(path.join(v, 'skhynix', 'design.css'))) return v;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}
const VENDOR = findVendor();

const inside = (base, target) => target === base || target.startsWith(base + path.sep);

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

function readBody(req, max = MAX_BODY) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let size = 0, over = false;
    req.on('data', (c) => {
      size += c.length;
      if (over) return; // 초과분은 버리며 끝까지 읽어 응답을 보낼 수 있게 한다
      if (size > max) { over = true; chunks.length = 0; fail(Object.assign(new Error('too large'), { code: 413 })); return; }
      chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

async function api(req, res, name) {
  if (!/^[a-z0-9-]+$/.test(name)) return sendJson(res, 400, { error: '이름은 소문자·숫자·하이픈만 쓸 수 있습니다.' });
  if (name === 'assist' || name === 'chat') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: '허용 메서드: POST' });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (e) {
      if (e.code === 413) return sendJson(res, 413, { error: '본문이 1MB 를 넘습니다.' });
      return sendJson(res, 400, { error: 'JSON 형식이 아닙니다.' });
    }
    const out = await (name === 'chat' ? chat : assist)(body);
    return sendJson(res, out.status, out.json);
  }
  if (name === 'transcribe') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: '허용 메서드: POST' });
    let body;
    try { body = JSON.parse(await readBody(req, MAX_AUDIO_BODY)); } catch (e) {
      if (e.code === 413) return sendJson(res, 400, { error: '녹음이 너무 큽니다.' });
      return sendJson(res, 400, { error: 'JSON 형식이 아닙니다.' });
    }
    const out = await transcribe(body);
    return sendJson(res, out.status, out.json);
  }
  const docsM = /^docs-([a-z0-9]+)$/.exec(name);
  if (docsM) {
    if (req.method !== 'GET') return sendJson(res, 405, { error: '허용 메서드: GET' });
    const dir = path.join(DOMAINS, docsM[1], 'docs');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(md|txt)$/i.test(f)).sort() : [];
    return sendJson(res, 200, Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')])));
  }
  const stored = path.join(STORE, `${name}.json`);
  // decisions-·schedule-·review-·settings-<도메인> 의 처음 값은 domains/<도메인>/ 의 같은 이름 .json
  const dm = /^(decisions|schedule|review|settings)-([a-z0-9]+)$/.exec(name);
  const seed = dm ? path.join(DOMAINS, dm[2], `${dm[1]}.json`) : path.join(ROOT, 'data', `${name}.json`);
  if (req.method === 'GET') {
    const file = fs.existsSync(stored) ? stored : fs.existsSync(seed) ? seed : null;
    if (!file && /^import-/.test(name)) return sendJson(res, 200, {}); // CSV 올리기 저장물 — 올린 적 없으면 빈 값(브라우저에 404 가 안 뜨게)
    if (!file) return sendJson(res, 404, { error: `/api/${name} 데이터가 없습니다.` });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(fs.readFileSync(file));
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    let text;
    try { text = await readBody(req); } catch (e) {
      if (e.code === 413) return sendJson(res, 413, { error: '본문이 1MB 를 넘습니다.' });
      return sendJson(res, 400, { error: '본문을 읽지 못했습니다.' });
    }
    let parsed;
    try { parsed = JSON.parse(text); } catch { return sendJson(res, 400, { error: 'JSON 형식이 아닙니다.' }); }
    fs.mkdirSync(STORE, { recursive: true });
    const tmp = `${stored}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(parsed));
    fs.renameSync(tmp, stored);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 405, { error: '허용 메서드: GET, POST, PUT' });
}

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); } catch { return sendJson(res, 400, { error: '잘못된 주소' }); }
  if (urlPath.includes('\0')) return sendJson(res, 400, { error: '잘못된 주소' });

  if (urlPath.startsWith('/api/')) return api(req, res, urlPath.slice(5));

  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end('method not allowed'); }

  if (urlPath.startsWith('/domains/')) {
    const f = path.normalize(path.join(DOMAINS, urlPath.slice(9)));
    if (!inside(path.normalize(DOMAINS), f)) { res.writeHead(403); return res.end('forbidden'); }
    return sendFile(res, f);
  }

  if (urlPath.startsWith('/vendor/')) {
    if (!VENDOR) { res.writeHead(404); return res.end('vendor not found'); }
    const f = path.normalize(path.join(VENDOR, urlPath.slice(8)));
    if (!inside(VENDOR, f)) { res.writeHead(403); return res.end('forbidden'); }
    return sendFile(res, f);
  }

  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const f = path.normalize(path.join(ROOT, rel));
  if (!inside(ROOT, f)) { res.writeHead(403); return res.end('forbidden'); }
  sendFile(res, f);
});

server.on('error', (e) => { console.error(`서버를 시작하지 못했습니다: ${e.message}`); process.exit(1); });
server.listen(PORT, '0.0.0.0', () => {
  const p = server.address().port;
  console.log(`listening 0.0.0.0:${p} — Browser: PORT=${p}, URL=/`);
});
