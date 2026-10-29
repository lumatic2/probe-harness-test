// recorder.js — W18 녹음·전사: 녹음(MediaRecorder) 또는 오디오 파일 올리기 → 「텍스트로 바꾸기」 버튼 → /api/transcribe → 글.
// recorderHtml(opts) 는 HTML 문자열을 돌려주는 순수 함수(Node 에서 테스트됨), bindRecorder(el, opts) 가 브라우저에서 동작을 붙인다.
//   opts.text   = true(기본)면 전사 결과를 담는 고칠 수 있는 입력란(textarea[data-rec-text])을 함께 그린다. false 면 입력란은 쓰는 쪽(폼의 답변 칸 등)에 있고 onText 로 받는다.
//   opts.maxSec = 최대 녹음 길이(초, 기본 120)
//   bindRecorder 의 onText(text, {mock, reason}) = 전사가 끝났을 때 불린다. 키가 없거나 실패하면 mock:true 이고 「모의 전사」 배지가 붙는다.
// 마이크가 없거나 막혀도(웹 IDE 미리보기 등) 오디오 파일 올리기로 같은 엔드포인트를 쓴다.
import { esc } from './util.js';

export const MAX_SEC = 120;
export const MAX_BYTES = 8 * 1024 * 1024;
export const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function recorderHtml({ text = true, maxSec = MAX_SEC } = {}) {
  return `<div class="sh-rec" data-recorder data-max="${maxSec}">
<div class="sh-actions"><button type="button" class="sh-btn" data-rec-start>녹음 시작</button><button type="button" class="sh-btn" data-rec-pick>오디오 파일 올리기</button><input type="file" accept="audio/*" hidden data-rec-file><span class="skh-muted" data-rec-time>0:00 / ${esc(fmtClock(maxSec))}</span></div>
<audio controls hidden data-rec-audio></audio>
<div class="sh-actions" data-rec-convert><button type="button" class="sh-btn" data-rec-transcribe disabled>텍스트로 바꾸기</button></div>
${text ? '<textarea class="sh-input sh-full" rows="4" aria-label="전사 결과" data-rec-text></textarea>' : ''}
<p class="skh-muted" data-rec-note></p></div>`;
}

const EXT_MIME = { webm: 'audio/webm', ogg: 'audio/ogg', mp4: 'audio/mp4', m4a: 'audio/x-m4a', mp3: 'audio/mpeg', wav: 'audio/wav' };
const toBase64 = (blob) => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] ?? '');
  r.onerror = () => fail(r.error);
  r.readAsDataURL(blob);
});
const REASON = { timeout: '시간 초과', network: '연결 실패', empty: '빈 응답' };
const reasonText = (r) => (!r || r === 'no-key' ? '' : String(r).startsWith('http-') ? `응답 오류 ${String(r).slice(5)}` : REASON[r] ?? r);

export function bindRecorder(el, { onText } = {}) {
  if (!el) return;
  const $ = (s) => el.querySelector(s);
  const maxSec = Number(el.dataset.max) || MAX_SEC;
  const start = $('[data-rec-start]'), pick = $('[data-rec-pick]'), file = $('[data-rec-file]'), time = $('[data-rec-time]');
  const audio = $('[data-rec-audio]'), go = $('[data-rec-transcribe]'), area = $('[data-rec-text]'), note = $('[data-rec-note]');
  let blob = null, mime = '', url = '', mr = null, stream = null, tick = null, startedAt = 0, seq = 0;
  const say = (m) => { note.textContent = m; };
  const setBlob = (b, type) => {
    if (url) URL.revokeObjectURL(url);
    blob = b; mime = type;
    url = URL.createObjectURL(b);
    audio.src = url; audio.hidden = false;
    go.disabled = false;
    el.querySelector('[data-rec-mock]')?.remove();
  };
  const finish = () => {
    clearInterval(tick); tick = null;
    stream?.getTracks().forEach((t) => t.stop()); stream = null;
    start.textContent = '녹음 시작';
  };

  const canRecord = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  if (!canRecord) { start.disabled = true; say('이 브라우저에서는 녹음을 쓸 수 없습니다. 오디오 파일을 올려 전사할 수 있습니다.'); }

  start.addEventListener('click', async () => {
    if (mr?.state === 'recording') { mr.stop(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      say('마이크 권한이 없거나 장치가 없어 녹음하지 못했습니다.');
      return;
    }
    const chunks = [];
    mr = new MediaRecorder(stream);
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      const secs = Math.min(maxSec, Math.round((Date.now() - startedAt) / 1000));
      finish();
      time.textContent = `${fmtClock(secs)} / ${fmtClock(maxSec)}`;
      if (chunks.length) setBlob(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), mr.mimeType || 'audio/webm');
    };
    startedAt = Date.now();
    mr.start();
    start.textContent = '녹음 중지';
    say('녹음 중');
    tick = setInterval(() => {
      const s = (Date.now() - startedAt) / 1000;
      time.textContent = `${fmtClock(Math.min(s, maxSec))} / ${fmtClock(maxSec)}`;
      if (s >= maxSec) { say(`최대 ${fmtClock(maxSec)} 까지만 녹음됩니다.`); mr.stop(); }
    }, 250);
  });

  pick.addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    const type = f.type.startsWith('audio/') ? f.type : EXT_MIME[f.name.split('.').pop().toLowerCase()] ?? '';
    if (!type) { say('오디오 파일(webm · ogg · mp4 · mp3 · wav · m4a)만 올릴 수 있습니다.'); return; }
    if (f.size > MAX_BYTES) { say(`파일이 ${MAX_BYTES / 1024 / 1024}MB 를 넘어 올릴 수 없습니다.`); return; }
    setBlob(f, type);
    time.textContent = f.name;
    say('');
  });

  go.addEventListener('click', async () => {
    if (!blob) return;
    const my = ++seq;
    go.disabled = true;
    say('텍스트로 바꾸는 중…');
    try {
      const res = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio: await toBase64(blob), mime }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || String(res.status));
      if (my !== seq) return;
      if (area) area.value = j.text;
      el.querySelector('[data-rec-mock]')?.remove();
      if (j.mock) go.parentElement.insertAdjacentHTML('beforeend', '<span class="skh-badge skh-badge--normal" data-rec-mock>모의 전사</span>');
      say(j.mock && reasonText(j.reason) ? `OpenAI 호출 실패(${reasonText(j.reason)}) — 모의 전사로 대신함` : '');
      onText?.(j.text, { mock: !!j.mock, reason: j.reason });
    } catch (e) {
      if (my === seq) say(`변환하지 못했습니다(${e.message}).`);
    } finally {
      if (my === seq) go.disabled = false;
    }
  });
}
