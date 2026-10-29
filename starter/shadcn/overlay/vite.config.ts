import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Connect } from 'vite'
import { createAssist } from './server/assist.mjs'
import { createChat } from './server/chat.mjs'
import { createTranscribe } from './server/transcribe.mjs'

// /api/<이름> — 셸(serve.mjs)과 같은 계약.
// GET: data/store/<이름>.json 이 있으면 그것, 없으면 data/<이름>.json(또는 decisions-·schedule-·review-·settings-<도메인> 이면 src/domain/<도메인>/ 의 같은 이름 .json), 모두 없으면 404.
// POST /api/transcribe: 녹음(base64 JSON) → 글(server/transcribe.mjs). OPENAI_API_KEY(+OPENAI_STT_MODEL)는 같은 방식으로만 읽고, 없거나 실패하면 모의 전사.
// POST·PUT: JSON(1MB 이하)을 data/store/<이름>.json 에 쓴다. 이름은 ^[a-z0-9-]+$ .
// POST /api/chat: AI 대화창(server/chat.mjs) — 키·모의 응답 규칙은 assist 와 같다.
// POST /api/assist: AI 개선 제안(server/assist.mjs). OPENAI_API_KEY(+OPENAI_MODEL)는 서버 프로세스 환경변수 또는 앱 폴더의 .env(커밋 금지)에서만 읽고, 없으면 모의 응답.
const ROOT = import.meta.dirname
const STORE = path.join(ROOT, 'data', 'store')
const MAX_BODY = 1024 * 1024
const MAX_AUDIO_BODY = 12 * 1024 * 1024
const fileEnv = loadEnv('production', ROOT, 'OPENAI_')
const aiEnv = { OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? fileEnv.OPENAI_API_KEY, OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? fileEnv.OPENAI_BASE_URL, OPENAI_MODEL: process.env.OPENAI_MODEL ?? fileEnv.OPENAI_MODEL }
const assist = createAssist({ env: aiEnv })
const chat = createChat({ env: aiEnv })
const transcribe = createTranscribe({ env: { OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? fileEnv.OPENAI_API_KEY, OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? fileEnv.OPENAI_BASE_URL, OPENAI_STT_MODEL: process.env.OPENAI_STT_MODEL ?? fileEnv.OPENAI_STT_MODEL } })

function sendJson(res: ServerResponse, code: number, obj: unknown) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(obj))
}

function readBody(req: IncomingMessage, max = MAX_BODY) {
  return new Promise<string>((ok, fail) => {
    const chunks: Buffer[] = []
    let size = 0
    let over = false
    req.on('data', (c: Buffer) => {
      size += c.length
      if (over) return
      if (size > max) { over = true; chunks.length = 0; fail(Object.assign(new Error('too large'), { code: 413 })); return }
      chunks.push(c)
    })
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')))
    req.on('error', fail)
  })
}

const apiMiddleware: Connect.NextHandleFunction = async (req, res, next) => {
  const url = req.url ?? ''
  if (!url.startsWith('/api/')) return next()
  let name: string
  try { name = decodeURIComponent(url.slice(5).split('?')[0]) } catch { return sendJson(res, 400, { error: '잘못된 주소' }) }
  if (!/^[a-z0-9-]+$/.test(name)) return sendJson(res, 400, { error: '이름은 소문자·숫자·하이픈만 쓸 수 있습니다.' })
  if (name === 'assist' || name === 'chat') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: '허용 메서드: POST' })
    let parsedBody: unknown
    try { parsedBody = JSON.parse(await readBody(req)) } catch { return sendJson(res, 400, { error: 'JSON 형식이 아닙니다.' }) }
    const out = await (name === 'chat' ? chat : assist)(parsedBody)
    return sendJson(res, out.status, out.json)
  }
  if (name === 'transcribe') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: '허용 메서드: POST' })
    let parsedBody: unknown
    try { parsedBody = JSON.parse(await readBody(req, MAX_AUDIO_BODY)) } catch (e) {
      if ((e as { code?: number }).code === 413) return sendJson(res, 400, { error: '녹음이 너무 큽니다.' })
      return sendJson(res, 400, { error: 'JSON 형식이 아닙니다.' })
    }
    const out = await transcribe(parsedBody)
    return sendJson(res, out.status, out.json)
  }
  const stored = path.join(STORE, `${name}.json`)
  const seed = path.join(ROOT, 'data', `${name}.json`)
  if (!stored.startsWith(STORE + path.sep) || !seed.startsWith(path.join(ROOT, 'data') + path.sep)) return sendJson(res, 400, { error: '잘못된 경로' })
  if (req.method === 'GET') {
    // decisions-<도메인> 은 처음엔 src/domain/<도메인>/decisions.json 을 씨앗으로 쓴다(셸 serve.mjs 와 같은 계약). 일정 확정(schedule-)·문서 검토(review-)도 같은 방식 — 씨앗이 비어 있어도 있어야 브라우저에 404 가 안 뜬다.
    const dm = /^(decisions|schedule|review|settings)-([a-z0-9]+)$/.exec(name)
    const domSeed = dm ? path.join(ROOT, 'src', 'domain', dm[2], `${dm[1]}.json`) : ''
    const file = fs.existsSync(stored) ? stored : fs.existsSync(seed) ? seed : domSeed && fs.existsSync(domSeed) ? domSeed : null
    if (!file && name.startsWith('import-')) return sendJson(res, 200, {}) // CSV 올리기 저장물 — 올린 적 없으면 빈 값(브라우저에 404 가 안 뜨게)
    if (!file) return sendJson(res, 404, { error: `/api/${name} 데이터가 없습니다.` })
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    return res.end(fs.readFileSync(file))
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    let text: string
    try { text = await readBody(req) } catch (e) {
      if ((e as { code?: number }).code === 413) return sendJson(res, 413, { error: '본문이 1MB 를 넘습니다.' })
      return sendJson(res, 400, { error: '본문을 읽지 못했습니다.' })
    }
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { return sendJson(res, 400, { error: 'JSON 형식이 아닙니다.' }) }
    fs.mkdirSync(STORE, { recursive: true })
    const tmp = `${stored}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(parsed))
    fs.renameSync(tmp, stored)
    return sendJson(res, 200, { ok: true })
  }
  return sendJson(res, 405, { error: '허용 메서드: GET, POST, PUT' })
}

const apiPlugin = () => ({
  name: 'local-json-api',
  configureServer(server: { middlewares: Connect.Server }) { server.middlewares.use(apiMiddleware) },
  configurePreviewServer(server: { middlewares: Connect.Server }) { server.middlewares.use(apiMiddleware) },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin()],
  resolve: { alias: { '@': path.resolve(ROOT, './src') } },
  server: { host: '0.0.0.0', port: 3000, strictPort: true },
  preview: { host: '0.0.0.0', port: 3000, strictPort: true },
  build: { chunkSizeWarningLimit: 1500, target: 'esnext' }, // esnext: derive.ts 의 top-level await
})
