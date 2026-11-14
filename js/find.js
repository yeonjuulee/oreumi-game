/* 04 시크릿 오르미 찾기 (원본: find/index.html — 라운드·시간·판정 규칙은 원본 그대로) */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const POINT = '#FE7606';
const SRC = 'images/find/';

// 캐릭터별 크기와 32×32 불투명 마스크(행마다 16진수 8자리). k는 갈기 크기를 서로 맞추기 위한 너비 보정값.
const ART = {
  'oreumi-1': { w: 255, h: 262, k: 1.00, mask: '0001f8000003fe0000ffff0003ffff0007ffffc00ffffff00ffffff81ffffffc3ffffffe7ffffffe7ffffffefffffffcfffffffefffffffe7fffffff7ffffffffffffffffffffffffffffffefffffffc7ffffff83ffffff80ffffff00fffffe007ffff8007ffff0007fffe0007ffff0007fffe0003f07e000180380000000000' },
  'oreumi-2': { w: 270, h: 270, k: 1.00, mask: '0003f000000ff800001ffc00017ffe0007ffff800ffffff01ffffff83ffffff83ffffffc3ffffffc7ffffffc7ffffffcfffffff8fffffff8fffffffcfffffffe7fffffff7fffffff7fffffff7fffffff3ffffffe1ffffffc03fffff803ffffe007ffffe00fffffc00ffffc000fffe0000fffc000079f8000001f8000000f0000' },
  'oreumi-3': { w: 208, h: 221, k: 0.98, mask: '0001f8000007fe00000fff0001ffff8003fffff807fffffc0ffffffe1ffffffe3fffffff7fffffff7ffffffefffffffefffffffeffffffffffffffff7ffffffffffffffffffffffefffffffefffffffe7ffffffe7ffffffe1ffffffe01fffffc01fffff000ffff80007fff00007ff800007ffc00007ffc00007cfc00007cf800' },
  'oreumi-4': { w: 455, h: 520, k: 1.04, mask: '0007e000000ff800001ffc0003ffffc00ffffff01ffffff81ffffff83ffffffc3ffffffc3ffffffc7ffffffcfffffffeffffffffffffffffffffffff7fffffff7ffffffefffffffcfffffffcfffffffc7ffffffc3ffffff80ffffff00fffffc007ffffc003ffff0003ffff0003ffff8001f87f8000f07f0000003e0000001c00' },
  'oreumi-5': { w: 520, h: 370, k: 1.25, mask: '0078e00001fff00003fff80007fff80007fffc0007fffc000ffffe000fffff800fffff803fffffc07fffffc07fffffc0ffffffc0ffffffc0ffffffc0ffffffc0ffffffc0ffffffc0ffffffc07fffffc07fffffe07ffffff07ffffff0fffffff0fffffffe7fffffff7fffffff3fffffff3fffffff0fffffce07ffff00038f3c00' },
  'oreumi-6': { w: 520, h: 348, k: 1.14, mask: '0007c000000ff000001ff800003ffc0000fffc0003fffc0007ffffe00ffffff00ffffff81ffffff81ffffffc1ffffffc3ffffffc3ffffffc3ffffffe3ffffffe7ffffffe7ffffffc7ffffffe7ffffffe7fffffff7ffffffffffffffffffffffffffffffffffffffffffffffefffffffc7ffffffc3ffffff81dfffef800f80000' },
  'oreumi-7': { w: 262, h: 205, k: 1.10, mask: '0001f8000003fc000007fe00000fff0001ffff0007ffff800ffffff80ffffffc1ffffffc3ffffffe7ffffffe7ffffffe7ffffffefffffffefffffffefffffffe7ffffffe7ffffffe7ffffffefffffffeffffffffffffffffffffffffffffffff7fffffff7ffffffe7ffffffe7ffffffc3ffffff81c3ffff00007ffc00001f800' },
  'oreumi-8': { w: 294, h: 209, k: 1.25, mask: '0078c00001fff00003fff80003fff80007fffc0007fffc000ffffe000fffff000fffff801fffffc03fffffc07fffffc07fffffc0ffffffc0ffffffc0ffffffc0ffffffc0ffffffc0fffffff87ffffff87ffffffc7ffffffc7ffffffc7ffffffc7ffffffe7fffffff7fffffff3fffffff1fffffff0fffffc607ffff00038f1c00' },
  'secret':   { w: 455, h: 520, k: 1.00, mask: '003e7c00007ffe0000ffff0001ffff800ffffff03ffffffc3ffffffc7ffffffe7ffffffe7ffffffe7ffffffeffffffffffffffffffffffff7ffffffe7ffffffe7ffffffe7ffffffe7ffffffc3ffffffc1ffffff80ffffff001ffff8001ffff0001ffff0001ffff00003ff800003ff800003ff800003ff800003ff800001ff800' }
};
const NORMAL = Object.keys(ART).filter(n => n !== 'secret');
Object.keys(ART).forEach(n => {
  const a = ART[n], rows = [];
  for (let i = 0; i < 32; i++) rows.push(parseInt(a.mask.substr(i * 8, 8), 16));
  a.rows = rows;
  new Image().src = SRC + n + '.png';
});

// 라운드 구성 (원본 그대로): 뒤로 갈수록 오르미가 많아지고 작아진다. t는 제한 시간(초).
const ROUNDS = [
  { cols: 6,  rows: 3, base: 176, t: 20, title: '몸풀기',       desc: '오르미 18마리 사이에 숨었어요' },
  { cols: 9,  rows: 4, base: 146, t: 10, title: '조금 더 북적', desc: '오르미 36마리 사이에 숨었어요' },
  { cols: 11, rows: 5, base: 122, t: 5,  title: '마지막 도전',  desc: '오르미 55마리 사이에 숨었어요' }
];
const GOAL = ROUNDS.length;   // 승리 조건: 3라운드 모두 찾기
const LOW_AT = 3;              // 남은 시간이 이만큼 이하면 시계가 주황색 + 째깍 소리
const TOP = 16, BOTTOM_PAD = 26;

const scr = $('find'), stageEl = $('fdStage'), inner = $('fdInner'), toast = $('fdToast'), card = $('fdCard');
let W = 1194, H = 760, scale = 1;
let state = 'idle', round = 0, sprites = [], target = null;
let deadline = 0, total = 0, startedAt = 0, raf = 0, results = [], timers = [], lastTick = -1;
let best = null;
try { best = JSON.parse(localStorage.getItem('oreumi-find-best') || 'null'); } catch (e) {}

/* ---------- 화면 맞춤: 원본처럼 가로 1194를 기준으로 통째로 확대·축소 ---------- */
function fit() {
  const r = stageEl.getBoundingClientRect();
  if (!r.width) return;
  W = 1194; scale = r.width / W; H = r.height / scale;
  if (H < 640) { H = 640; scale = r.height / H; W = r.width / scale; }
  inner.style.width = W + 'px'; inner.style.height = H + 'px';
  inner.style.transform = `scale(${scale})`;
  sprites.forEach(place);
}
function place(s) {
  let fy = TOP + s.v * (H - BOTTOM_PAD - TOP);
  const cx = Math.max(s.w / 2 + 6, Math.min(W - s.w / 2 - 6, s.u * W));
  fy = Math.max(TOP - 6 + s.h, Math.min(H - 12, fy));
  s.x = cx - s.w / 2; s.y = fy - s.h;
  s.el.style.left = s.x.toFixed(1) + 'px';
  s.el.style.top = s.y.toFixed(1) + 'px';
}
window.addEventListener('resize', () => { if (scr.classList.contains('on')) fit(); });

function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
function clearTimers() { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); }
const rand = (a, b) => a + Math.random() * (b - a);
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

/* ---------- 효과음 (원본 그대로, 첫 터치 때 오디오가 열림) ---------- */
// 소리는 사이트 공통 사운드(js/sound.js)를 통해 재생 — 시작 페이지의 효과음 켜기/끄기를 따름
function tone(freq, at, dur, type, vol) { if (window.Sound) Sound.tone(freq, at, dur, type, vol); }
function unlockAudio() { if (window.Sound) Sound.unlock(); }
const sfx = {
  tap:  () => tone(520, 0, 0.09, 'triangle'),
  no:   () => { tone(220, 0, 0.14, 'square', 0.07); tone(170, 0.1, 0.18, 'square', 0.07); },
  yes:  () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.26, 'triangle')),
  miss: () => { tone(392, 0, 0.22, 'sine'); tone(294, 0.2, 0.4, 'sine'); },
  tick: () => tone(880, 0, 0.06, 'sine', 0.08)
};

/* ---------- 진행 ---------- */
function showIntro() {
  clearTimers();
  state = 'intro0';
  inner.innerHTML = ''; sprites = []; inner.classList.remove('done');
  toast.classList.remove('on'); card.classList.remove('on');
  $('fdResult').classList.remove('on');
  $('fdRound').textContent = '1';
  setDots();
  setClock(ROUNDS[0].t, ROUNDS[0].t);
  $('fdIntro').classList.add('on');
}
function startGame() {
  clearTimers();
  $('fdIntro').classList.remove('on'); $('fdResult').classList.remove('on');
  results = []; round = 0;
  introRound();
}
function setDots() {
  $('fdDots').innerHTML = ROUNDS.map((_, i) => {
    const c = i < round ? (results[i] && results[i].found ? 'ok' : 'miss') : (i === round ? 'now' : '');
    return `<i class="${c}"></i>`;
  }).join('');
}
function introRound() {
  const cfg = ROUNDS[round];
  state = 'intro';
  inner.innerHTML = ''; sprites = []; inner.classList.remove('done');
  toast.classList.remove('on');
  $('fdRound').textContent = round + 1;
  setDots();
  setClock(cfg.t, cfg.t);
  card.querySelector('.rd').textContent = 'ROUND ' + (round + 1);
  card.querySelector('.tt').textContent = cfg.title;
  card.querySelector('.ds').textContent = cfg.desc;
  card.classList.add('on');
  later(() => {
    card.classList.remove('on');
    build(cfg);
    later(() => {
      state = 'play';
      total = cfg.t * 1000; startedAt = performance.now(); deadline = startedAt + total;
      lastTick = -1;
      raf = requestAnimationFrame(loop);
    }, 650);
  }, 1500);
}

// 벽돌처럼 엇갈린 격자에 흩뿌리고, 발 위치(y)가 아래일수록 앞에 오도록 겹친다.
function build(cfg) {
  sprites = []; target = null;
  const n = cfg.cols * cfg.rows, padX = 34, top = TOP, bottom = H - BOTTOM_PAD;
  const cellW = (W - padX * 2) / cfg.cols, cellH = (bottom - top) / cfg.rows;
  const secretAt = Math.floor(Math.random() * n);
  let bag = [];
  while (bag.length < n) bag = bag.concat(shuffle(NORMAL.slice()));
  const frag = document.createDocumentFragment();
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const i = r * cfg.cols + c, isSecret = i === secretAt;
      const name = isSecret ? 'secret' : bag[i], art = ART[name];
      const w = cfg.base * art.k * rand(0.93, 1.07), h = w * art.h / art.w;
      const cx = padX + (c + 0.5 + (r % 2 ? 0.22 : -0.22)) * cellW + rand(-0.16, 0.16) * cellW;
      const fy = top + (r + 1) * cellH - 4 + rand(-0.12, 0.12) * cellH;
      const s = { name, art, u: cx / W, v: (fy - top) / (bottom - top), w, h, z: Math.round(fy), flip: Math.random() < 0.5, secret: isSecret };
      const el = document.createElement('div');
      el.className = 'fd-sp pop' + (s.flip ? ' flip' : '') + (isSecret ? ' fd-target' : '');
      el.style.cssText = `width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;z-index:${s.z};--in:${rand(0, 0.3).toFixed(2)}s;--delay:-${rand(0, 3).toFixed(2)}s;--dur:${rand(2.4, 3.4).toFixed(2)}s`;
      el.innerHTML = `<div class="fl"><img src="${SRC}${name}.png" alt="" draggable="false"></div>`;
      s.el = el; place(s); sprites.push(s); frag.appendChild(el);
      if (isSecret) target = s;
    }
  }
  inner.appendChild(frag);
  sprites.sort((a, b) => b.z - a.z);
}

function setClock(leftSec, totalSec) {
  const shown = Math.max(0, Math.ceil(leftSec));
  $('fdSec').textContent = shown;
  $('fdBar').style.transform = `scaleX(${Math.max(0, leftSec / totalSec).toFixed(4)})`;
  $('fdClock').classList.toggle('low', leftSec <= LOW_AT && leftSec > 0);
  return shown;
}
function loop(now) {
  if (state !== 'play') return;
  const left = (deadline - now) / 1000;
  const shown = setClock(left, total / 1000);
  if (left <= LOW_AT && shown !== lastTick && shown > 0) { lastTick = shown; sfx.tick(); }
  if (left <= 0) return finish(false);
  raf = requestAnimationFrame(loop);
}

/* ---------- 터치 판정 (원본 그대로) ---------- */
function opaque(s, px, py) {
  let u = (px - s.x) / s.w; const v = (py - s.y) / s.h;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
  if (s.flip) u = 1 - u;
  return ((s.art.rows[Math.floor(v * 32)] >>> (31 - Math.floor(u * 32))) & 1) === 1;
}
function pick(px, py) {
  for (let i = 0; i < sprites.length; i++) if (opaque(sprites[i], px, py)) return sprites[i];
  return null;
}
// 손가락이 살짝 빗나가도 잡히도록 주변 8곳을 한 번 더 본다.
function pickNear(px, py) {
  let hit = pick(px, py);
  for (let a = 0; !hit && a < 8; a++) hit = pick(px + Math.cos(a * Math.PI / 4) * 14, py + Math.sin(a * Math.PI / 4) * 14);
  return hit;
}

stageEl.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  const r = stageEl.getBoundingClientRect();
  const px = (e.clientX - r.left) / scale, py = (e.clientY - r.top) / scale;
  const hit = pickNear(px, py);
  if (!hit) return;
  if (hit.secret) return finish(true);
  // 오답이면 그 라운드는 바로 실패. 틀린 오르미가 흔들리는 걸 잠깐 보여 준 뒤 정답을 공개한다.
  state = 'reveal';
  cancelAnimationFrame(raf);
  sfx.no();
  hit.el.classList.remove('pop', 'no');
  void hit.el.offsetWidth;
  hit.el.classList.add('no');
  floatText(px, py - 20, '땡!');
  later(() => finish(false, true), 500);
});
inner.addEventListener('animationend', e => {
  if (e.target.classList.contains('fd-sp')) e.target.classList.remove('pop', 'no');
});

function floatText(x, y, text) {
  const el = document.createElement('div');
  el.className = 'fd-float'; el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  inner.appendChild(el);
  later(() => el.remove(), 950);
}

function finish(found, wrong) {
  state = 'reveal';
  cancelAnimationFrame(raf);
  const took = Math.min(total, performance.now() - startedAt) / 1000;
  results.push({ found, time: took });
  $('fdClock').classList.remove('low');
  target.el.classList.remove('pop', 'no');
  // 가장자리에서 커져도 잘리지 않게 확대 기준점을 화면 안쪽으로 둔다.
  const ox = target.x + target.w / 2 < 140 ? 0 : target.x + target.w / 2 > W - 140 ? 1 : 0.5;
  const oy = target.y + target.h / 2 < TOP + 120 ? 0 : target.y + target.h / 2 > H - 130 ? 1 : 0.5;
  target.el.style.transformOrigin = `${ox * 100}% ${oy * 100}%`;
  inner.classList.add('done');
  // 1.5배로 커진 뒤의 실제 중심에 원과 축하 조각을 맞춘다
  const ZOOM = 1.5;
  const cx = target.x + target.w * ox + (target.w / 2 - target.w * ox) * ZOOM;
  const cy = target.y + target.h * oy + (target.h / 2 - target.h * oy) * ZOOM;
  const d = Math.max(target.w, target.h) * ZOOM * 1.45, ring = document.createElement('div');
  ring.className = 'fd-ring';
  ring.style.cssText = `left:${cx - d / 2}px;top:${cy - d / 2}px;width:${d}px;height:${d}px`;
  inner.appendChild(ring);
  if (found) {
    sfx.yes(); confetti(cx, cy);
    toast.innerHTML = `찾았다! <em>${took.toFixed(1)}초</em>`;
  } else {
    sfx.miss();
    toast.innerHTML = `${wrong ? '앗, 아니에요!' : '시간 끝!'} <em>여기 숨어 있었어요</em>`;
  }
  toast.classList.add('on');
  later(() => {
    round++;
    if (round < ROUNDS.length) introRound(); else showResult();
  }, found ? 2300 : 2900);
}

function confetti(cx, cy) {
  const colors = [POINT, '#FFC9A0', '#FF8A33', '#FFE1C9'];
  for (let i = 0; i < 34; i++) {
    const el = document.createElement('div'), ang = rand(0, Math.PI * 2), dist = rand(120, 300);
    el.className = 'fd-bit';
    el.style.cssText = `left:${cx}px;top:${cy}px;background:${colors[i % colors.length]};--dx:${(Math.cos(ang) * dist).toFixed(0)}px;--dy:${(Math.sin(ang) * dist - 60).toFixed(0)}px;--rot:${rand(-540, 540).toFixed(0)}deg` + (i % 3 === 0 ? ';border-radius:50%' : '');
    inner.appendChild(el);
    later(() => el.remove(), 950);
  }
}

/* ---------- 결과 ---------- */
function showResult() {
  state = 'result';
  toast.classList.remove('on');
  setDots();
  const found = results.filter(r => r.found);
  const time = found.reduce((s, r) => s + r.time, 0);
  const n = found.length, win = n >= GOAL;
  if (!best || n > best.n || (n === best.n && n > 0 && time < best.t)) {
    best = { n, t: time };
    try { localStorage.setItem('oreumi-find-best', JSON.stringify(best)); } catch (e) {}
  }
  const b = $('fdBadge');
  b.textContent = win ? '모두 찾았어요 · 승리!' : n > 0 ? `${n}마리 발견 · 목표 미달성` : '꼭꼭 숨었네요 · 목표 미달성';
  b.className = win ? 'r-badge win' : 'r-badge miss';
  $('fdNote').textContent = win ? '눈썰미가 정말 대단해요' : '갈색 코를 기억하고 다시 도전해 보세요 · 3라운드 모두 찾으면 승리예요';
  $('fdTime').textContent = n ? time.toFixed(1) + '초' : '-';
  $('fdBest').textContent = best && best.n ? `${best.t.toFixed(1)}초` : '-';
  const el = $('fdCount'), t0 = performance.now();
  const tick = now => { const k = Math.min(1, (now - t0) / 500); el.textContent = Math.round(n * k); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  $('fdResult').classList.add('on');
  if (win) sfx.yes();
}

/* ---------- 화면 전환 ---------- */
function open() {
  document.getElementById('home').classList.remove('on'); scr.classList.add('on');
  fit(); showIntro();
}
function close() {
  clearTimers(); state = 'idle';
  inner.innerHTML = ''; sprites = [];
  toast.classList.remove('on'); card.classList.remove('on');
  scr.classList.remove('on'); document.getElementById('home').classList.add('on');
}
$('fdStartBtn').addEventListener('click', open);
$('fdBack').addEventListener('click', close);
$('fdHome').addEventListener('click', close);
$('fdGo').addEventListener('click', () => { unlockAudio(); sfx.tap(); startGame(); });
$('fdAgain').addEventListener('click', () => { unlockAudio(); sfx.tap(); startGame(); });
})();
