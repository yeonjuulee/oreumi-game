/* 02 쓰담쓰담 주덩이 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const home = $('home'), scr = $('pet'), stage = $('petStage'), wrap = $('petWrap'), body = $('petBody');
const sleepImg = $('petSleep'), bubble = $('bubble'), mark = $('mark'), talk = $('talk');

const TIME = 30;
const GOAL = 70;          // 승리 조건: 깨우지 않고 70회 이상
const STROKE = 0.25;      // 주덩이 너비의 25%를 문지를 때마다 1회
const RATE = 0.17;        // 이동 거리당 깨어남 게이지 증가량
const DECAY = 0.30;       // 손을 멈췄을 때 초당 감소량
const UNEASY = 0.45, WARN = 0.72;

/* 알파 마스크: 투명한 곳은 쓰다듬기로 치지 않음 */
let mask = null, mw = 0, mh = 0;
// 예비 마스크 (judeong-sleep.png를 140x100로 줄인 투명도 지도)
// 파일을 더블클릭해서 열면 브라우저 보안 때문에 이미지 픽셀을 읽을 수 없어서 이걸 대신 써요.
// 자는 이미지를 바꾸면 이 값은 맞지 않지만, 서버로 열 때는 이미지에서 자동으로 다시 만들어요.
const FALLBACK = { w: 140, h: 100, bits: 'AAAAAAD+fwAAAAAAAAAAAAAAAAAAAPz/PwD8HwAAAAAAAAAAAAAA+P//H/j/BwAAAAAAAAAAAADg////4///AQAAAAAAAAAAAAD///////9/AAAAAAAAAAAAAPz///////8PAAAAAAAAAAAA4P////////8DAAAAAAAAAAAA/////////38AAAAAAAAAAAD4/////////w8AAAAAAAAAAMD//////////wAAAAAAAAAAAP7/////////HwAAAAAAAAAA8P//////////AwAAAAAAAACA//////////8/AAAAAAAAAAD8//////////8HAAAAAAAAAMD//////////38AAAAAAAAAAP7//////////w8AAAAAAAAA4P///////////wAAAAAAAAAA////////////DwAAAAAAAADw////////////BwAAAAAAAID/////////////AQAAAAAAAPj///////////9/AAAAAAAAgP////////////8fAAAAAAAA+P////////////8DAAAAAADA/////////////38AAAAAAAD8/////////////w8AAAAAAMD//////////////wEAAAAAAPz/////////////PwAAAAAA8P//////////////AwAAAADg//////////////9/AAAAAID///////////////8HAAAAAPz///////////////8AAAAA8P///////////////w8AAACA/////////////////wEAAAD8////////////////HwAAAOD/////////////////AQAAAP////////////////8fAAAA8P////////////////8DAACA/////////////////z8AAAD4/////////////////wMAAMD/////////////////PwAAAPz/////////////////AwAA4P////////////////8fAAAA/v////////////////8BAADg/////////////////x8AAAD//////////////////wEAAPD/////////////////DwAAAP//////////////////AAAA8P////////////////8PAAAA//////////////////8AAADw/////////////////w8AAAD//////////////////wEAAPD/////////////////HwAAAP//////////////////AQAA8P////////////////8fAAAA//////////////////8BAADg/////////////////x8AAAD+/////////////////wEAAOD/////////////////HwAAAPz/////////////////AQAAwP////////////////8fAAAA+P////////////////8AAACA/////////////////w8AAADw/////////////////wMAAAD+/////////////////wEAAOD/////////////////PwAAAP7/////////////////DwAA8P//////////////////AQAA//////////////////8fAAD4//////////////////8DAID//////////////////38AAPj//////////////////wcAwP//////////////////fwAA/P//////////////////DwDA////////////////////AAD8//////////////////8PAMD////////////////////gAPz///////////////////9/gP////////////////////8f+P////////////////////+D/////////////////////z/w/////////////////////wf//////////////////////+D/////////////////////D/7/////////////////////wP////////////////////8P+P////////////////////8A/////////////////////w/g/////////////////////wD8////////////////////BwD///////////////////9/AOD///////////////////8DAPD////////////////w/x8AAPj//////////////wHAPwAAAP////////////9/AAAAAAAA8P////////////8DAAAAAAAA/v///////////x8AAAAAAACA////////////fwAAAAAAAADw/3+A//8f/P//AQAAAAAAAADwfwDw//8A//8DAAAAAAAAAAAAAAD8/wMAPgAAAAAAAA==' };
function useFallback() {
  const raw = atob(FALLBACK.bits);
  mw = FALLBACK.w; mh = FALLBACK.h; mask = new Uint8Array(mw * mh);
  for (let i = 0; i < mw * mh; i++) mask[i] = (raw.charCodeAt(i >> 3) >> (i & 7)) & 1;
}
function buildMask() {
  const w = sleepImg.naturalWidth, h = sleepImg.naturalHeight;
  if (!w) return useFallback();
  try {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(sleepImg, 0, 0);
    const d = x.getImageData(0, 0, w, h).data;
    mw = w; mh = h; mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  } catch (e) { useFallback(); }
}
useFallback();
if (sleepImg.complete) buildMask(); else sleepImg.addEventListener('load', buildMask);
function overPet(cx, cy) {
  const r = wrap.getBoundingClientRect();
  const u = (cx - r.left) / r.width, v = (cy - r.top) / r.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return false;
  if (!mask) return true;
  const px = Math.min(mw - 1, Math.floor(u * mw)), py = Math.min(mh - 1, Math.floor(v * mh));
  return mask[py * mw + px] === 1;
}

/* 상태 */
let state = 'ready', count = 0, gauge = 0, sens = 1, left = TIME, accum = 0;
let pressed = null, lastPetT = -9, samples = [], mood = 'calm';
let squish = 0, twitchT = 0, nextZ = 0, nextTwitch = 0, running = false, last = 0, bubbleOn = true;
let best = 0;
try { best = +localStorage.getItem('judeong-pet-best') || 0; } catch (e) {}

function reset() {
  state = 'ready'; count = 0; gauge = 0; left = TIME; accum = 0; samples = []; mood = 'calm';
  sens = 0.88 + Math.random() * 0.26;     // 판마다 예민함이 조금씩 달라요
  $('petCount').textContent = '0'; $('petTime').textContent = TIME.toFixed(1); $('petPill').classList.remove('reached');
  $('clock').classList.remove('low'); $('petBar').style.transform = 'scaleX(1)';
  $('petHint').classList.remove('hide'); $('petResult').classList.remove('on');
  wrap.classList.remove('awake'); stage.classList.remove('warn');
  mark.className = 'mark'; mark.textContent = '!?'; talk.classList.remove('on');
  bubble.className = 'bubble'; bubbleOn = true;
  stage.querySelectorAll('.fx').forEach(n => n.remove());
}

/* 입력 */
stage.addEventListener('pointerdown', e => {
  if (state !== 'ready' && state !== 'play') return;
  if (e.target.closest('.result')) return;
  stage.setPointerCapture(e.pointerId);
  pressed = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
stage.addEventListener('pointermove', e => {
  if (!pressed || e.pointerId !== pressed.id) return;
  const d = Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y);
  const mx = e.clientX, my = e.clientY;
  pressed.x = mx; pressed.y = my;
  if (d < 0.5 || d > 200) return;
  if (state !== 'ready' && state !== 'play') return;
  if (!overPet(mx, my)) return;
  pet(d, mx, my);
});
const up = e => { if (pressed && e.pointerId === pressed.id) pressed = null; };
stage.addEventListener('pointerup', up);
stage.addEventListener('pointercancel', up);

function pet(d, mx, my) {
  if (state === 'ready') { state = 'play'; $('petHint').classList.add('hide'); }
  const now = performance.now() / 1000;
  const w = wrap.getBoundingClientRect().width;
  samples.push({ t: now, d }); lastPetT = now;
  // 속도(초당 주덩이 너비) 빠를수록 더 쉽게 깸
  samples = samples.filter(s => now - s.t < 0.2);
  const speed = samples.reduce((a, s) => a + s.d, 0) / 0.2 / w;
  const speedMul = Math.min(2, 1 + 0.9 * Math.max(0, speed - 1.4) / 1.4);
  gauge += (d / w) * RATE * sens * speedMul;

  accum += d;
  const unit = w * STROKE;
  while (accum >= unit) {
    accum -= unit; count++;
    const c = $('petCount'); c.textContent = count;
    if (count === GOAL) $('petPill').classList.add('reached');
    c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
    squish = 1;
    heart(mx, my);
  }
  if (gauge >= 1) wake();
}

/* 이펙트 */
function fx(cls, html, x, y, parent, extra) {
  const n = document.createElement('div');
  n.className = 'fx ' + cls; n.innerHTML = html;
  n.style.left = x; n.style.top = y;
  if (extra) Object.assign(n.style, extra);
  (parent || wrap).appendChild(n);
  n.addEventListener('animationend', () => n.remove());
  return n;
}
const HEART = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="#FE7606"/></svg>';
function heart(mx, my) {
  const r = stage.getBoundingClientRect();
  fx('heart', HEART, (mx - r.left) + 'px', (my - r.top) + 'px', stage, { '--dx': (Math.random() * 40 - 20) + 'px' });
}
function zzz() {
  const big = mood === 'calm';
  const size = (big ? 26 : 18) + Math.random() * (big ? 16 : 6);
  fx('zzz', 'Z', (70 + Math.random() * 8) + '%', (14 + Math.random() * 6) + '%', wrap, { fontSize: size + 'px' });
}
const TWITCH = ['꿈틀', '움찔', '뒤척'];
function twitchWord() {
  fx('twitch', TWITCH[Math.floor(Math.random() * TWITCH.length)], (12 + Math.random() * 70) + '%', (-12 + Math.random() * 8) + '%');
}
const MUTTER = ['으음…', '음냐…', '누구야…', '으으…'];

function setMood(m) {
  if (m === mood) return;
  const prev = mood; mood = m;
  stage.classList.toggle('warn', m === 'warn');
  if (m === 'warn') {
    mark.textContent = '!?'; mark.className = 'mark on';
    talk.textContent = MUTTER[Math.floor(Math.random() * MUTTER.length)]; talk.classList.add('on');
    if (bubbleOn) { bubble.className = 'bubble pop'; bubbleOn = false; fx('poof', '퐁', '64%', '70%'); }
  } else {
    mark.className = 'mark'; talk.classList.remove('on');
  }
  if (m === 'calm' && !bubbleOn) { bubble.className = 'bubble'; bubbleOn = true; }
  if (m === 'uneasy' && prev === 'calm') { twitchT = 0.45; twitchWord(); }
}

/* 종료 */
function wake() {
  state = 'awake'; pressed = null;
  stage.classList.remove('warn'); talk.classList.remove('on');
  if (bubbleOn) { bubble.className = 'bubble pop'; bubbleOn = false; }
  wrap.classList.add('awake');
  mark.textContent = '!'; mark.className = 'mark on big';
  setTimeout(() => showResult(false), 1100);
}
function finish() {
  state = 'end'; pressed = null; left = 0;
  setMood('calm');
  showResult(true);
}
function showResult(ok) {
  if (ok && count > best) { best = count; try { localStorage.setItem('judeong-pet-best', best); } catch (e) {} }
  const b = $('pBadge');
  const win = ok && count >= GOAL;
  b.textContent = win ? '목표 달성 · 승리!' : ok ? '푹 재웠어요 · 목표 미달성' : '주덩이가 깼어요';
  b.className = win ? 'r-badge win' : 'r-badge miss';
  $('pGoal').textContent = win ? `목표 ${GOAL}회 이상을 달성했어요`
    : ok ? `목표 ${GOAL}회까지 ${GOAL - count}회 부족해요` : `깨우지 않고 ${GOAL}회 이상 쓰다듬어야 해요`;
  $('pLabel').textContent = ok ? '쓰다듬은 횟수' : '깨기 전까지 쓰다듬은 횟수';
  $('pLeftLabel').textContent = ok ? '결과' : '남은 시간';
  $('pLeft').textContent = ok ? '성공' : left.toFixed(1) + '초';
  $('pBest').textContent = best + '회';
  const el = $('pCount'), t0 = performance.now();
  const tick = now => { const k = Math.min(1, (now - t0) / 700); el.textContent = Math.round(count * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  $('petResult').classList.add('on');
}

/* 루프 */
function frame(nowMs) {
  if (!running) return;
  const now = nowMs / 1000, dt = Math.min(0.05, now - last); last = now;

  if (state === 'play') {
    left -= dt;
    if (now - lastPetT > 0.3) gauge = Math.max(0, gauge - DECAY * dt);
    setMood(gauge >= WARN ? 'warn' : gauge >= UNEASY ? 'uneasy' : (mood === 'uneasy' && gauge > UNEASY - 0.05 ? 'uneasy' : 'calm'));
    $('petTime').textContent = Math.max(0, left).toFixed(1);
    $('petBar').style.transform = 'scaleX(' + Math.max(0, left / TIME) + ')';
    $('clock').classList.toggle('low', left <= 5);
    if (left <= 0) finish();
  }

  // 몸 움직임
  const breath = Math.sin(now * Math.PI * 2 / (mood === 'calm' ? 3.2 : 2.2));
  let sx = 1 - 0.008 * breath, sy = 1 + 0.018 * breath, rot = 0, tx = 0;
  squish = Math.max(0, squish - dt * 6);
  sx += 0.012 * squish; sy -= 0.02 * squish;
  if (state !== 'awake') {
    if (mood === 'uneasy') {
      if (now > nextTwitch) { twitchT = 0.4; nextTwitch = now + 0.9 + Math.random() * 1.2; if (Math.random() < 0.4) twitchWord(); }
    }
    if (twitchT > 0) { twitchT -= dt; rot += Math.sin(twitchT * 40) * 2.2 * (twitchT / 0.4); }
    if (mood === 'warn') { rot += Math.sin(now * 38) * 1.6; tx = Math.sin(now * 29) * 2.5; }
    body.style.transform = `translateX(${tx}px) rotate(${rot}deg) scale(${sx},${sy})`;
  } else body.style.transform = '';

  // 콧방울
  if (bubbleOn && state !== 'awake') {
    const amp = mood === 'calm' ? 1 : 0.45;
    bubble.style.transform = `translate(0,-50%) scale(${0.55 + amp * 0.45 * (breath * 0.5 + 0.5)})`;
  }
  // Zzz
  if (state !== 'awake' && mood !== 'warn' && now > nextZ) {
    zzz(); nextZ = now + (mood === 'calm' ? 1.1 + Math.random() * 0.5 : 2.4 + Math.random());
  }
  requestAnimationFrame(frame);
}

function open() {
  home.classList.remove('on'); scr.classList.add('on');
  reset();
  if (!running) { running = true; last = performance.now() / 1000; requestAnimationFrame(frame); }
}
function close() { running = false; state = 'ready'; scr.classList.remove('on'); home.classList.add('on'); }
$('petStartBtn').addEventListener('click', open);
$('petBack').addEventListener('click', close);
$('petHome').addEventListener('click', close);
$('petAgain').addEventListener('click', reset);
})();
