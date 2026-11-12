/* 03 출근길 주덩이 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const POINT = '#FE7606';

/* ---------- 설정 ---------- */
const ROAD = 600;            // 길 너비 (논리 단위)
const LANES = [100, 300, 500];
const M = 27;                // 1m = 27단위
const GOAL_M = 500;          // 회사까지 거리
const GOAL = GOAL_M * M;
const SPEED_START = 260, SPEED_END = 450;   // 초당 단위
const MAX_DROWSY = 3;        // 졸음 3칸이 차면 잠듦
const CHAR_H = 150, CHAR_W = CHAR_H * 534 / 610;
const HIT_W = 64, HIT_H = 46;               // 주덩이 발밑 충돌 영역
const CLEAR = 700;          // 회사 앞 이만큼(약 26m)은 장애물 없이 비워둠

const scr = $('commute'), stage = $('cmStage'), cv = $('cmCv'), ctx = cv.getContext('2d');
const img = new Image(); img.src = 'images/judeong.png';
// 졸음이 쌓일수록 눈이 감긴 이미지로 바뀜 (눈 부분만 다름)
const drowsyImgs = ['images/judeong.png', 'images/judeong-drowsy1.png', 'images/judeong-drowsy2.png'].map(src => { const i = new Image(); i.src = src; return i; });
const sleepImg = new Image(); sleepImg.src = 'images/judeong-sleep.png';

/* ---------- 상태 ---------- */
let state = 'idle';          // count | run | sleep | arrive | end
let dist, speed, lane, x, objs, pops, dust, nextSpawn, drowsy, hits, cups, inv, slow, elapsed, t, countT, lastFree;
let confetti = [], endT = 0, nextZ = 0;
let roadPx = 600, scale = 1, roadLeft = 0, viewH = 800, feetY = 690, dpr = 1, running = false, last = 0;
let best = 0, bestTime = 0;
try { best = +localStorage.getItem('judeong-commute-best') || 0; bestTime = +localStorage.getItem('judeong-commute-time') || 0; } catch (e) {}

function reset() {
  dist = 0; speed = SPEED_START; lane = 1; x = LANES[1]; objs = []; pops = []; dust = [];
  confetti = []; endT = 0; nextZ = 0;
  $('cmBanner').className = 'cm-banner';
  nextSpawn = 420; drowsy = 0; hits = 0; cups = 0; inv = 0; slow = 0; elapsed = 0; t = 0; lastFree = [1];
  state = 'count'; countT = 3;
  $('cmResult').classList.remove('on'); stage.classList.remove('flash');
  $('cmHint').classList.remove('hide');
  showCount(3);
  hud();
}

/* ---------- 화면 맞춤 ---------- */
function resize() {
  const r = stage.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  roadPx = Math.min(r.width - 40, 640);
  scale = roadPx / ROAD;
  roadLeft = (r.width - roadPx) / 2;
  viewH = r.height / scale;
  feetY = viewH - Math.max(70, Math.min(120, viewH * 0.12));
  // 양옆 안내 패널 (공간이 있을 때만)
  const room = (r.width - roadPx) / 2;
  const show = room >= 250;
  stage.classList.toggle('wide', show);
  scr.classList.toggle('wide', show);
  if (show) {
    $('cmLeftPanel').style.right = (r.width / 2 + roadPx / 2 + 28) + 'px';
    $('cmRightPanel').style.left = (r.width / 2 + roadPx / 2 + 28) + 'px';
  }
}

/* ---------- 입력 ---------- */
function move(d) {
  if (state !== 'run' && state !== 'count') return;
  lane = Math.max(0, Math.min(2, lane + d));
  $('cmHint').classList.add('hide');
}
window.addEventListener('keydown', e => {
  if (!scr.classList.contains('on')) return;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { move(-1); e.preventDefault(); }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { move(1); e.preventDefault(); }
});
stage.addEventListener('pointerdown', e => {
  if (e.target.closest('.result') || e.target.closest('.cm-side')) return;
  const r = stage.getBoundingClientRect();
  move(e.clientX - r.left < r.width / 2 ? -1 : 1);
});

/* ---------- 장애물 생성 ---------- */
const TYPES = {
  bed:     { w: 150, h: 190 },
  sofa:    { w: 170, h: 96 },
  pillow:  { w: 124, h: 68 },
  blanket: { w: 150, h: 96 },
};
function spawnRow() {
  const p = dist / GOAL;
  const two = Math.random() < 0.3 + p * 0.35;          // 갈수록 두 칸 막힘이 늘어요
  let blocked;
  if (two) {
    const free = Math.floor(Math.random() * 3);
    blocked = [0, 1, 2].filter(l => l !== free);
  } else {
    blocked = [Math.floor(Math.random() * 3)];
  }
  const at = dist + feetY + 260;                         // 화면 위쪽 밖에서 시작
  if (at + 200 > GOAL - CLEAR) return;                   // 회사 앞 구간은 비워둠
  const names = Object.keys(TYPES);
  for (const l of blocked) {
    const type = names[Math.floor(Math.random() * names.length)];
    objs.push({ kind: 'ob', type, lane: l, at: at + Math.random() * 30, ...TYPES[type], hit: false, rot: (Math.random() - 0.5) * 0.12 });
  }
  const free = [0, 1, 2].filter(l => !blocked.includes(l));
  if (Math.random() < 0.14) {
    const l = free[Math.floor(Math.random() * free.length)];
    objs.push({ kind: 'coffee', lane: l, at: at + 40 + Math.random() * 60, taken: false });
  }
  lastFree = free;
}

/* ---------- 진행 ---------- */
function update(dt) {
  t += dt;
  x += (LANES[lane] - x) * Math.min(1, dt * 14);

  if (state === 'count') {
    countT -= dt;
    const n = Math.ceil(countT);
    if (n > 0) showCount(n); else { hideCount(); state = 'run'; }
    return;
  }
  if (state === 'sleep' || state === 'arrive' || state === 'end') { endT += dt; return; }
  if (state !== 'run') return;

  elapsed += dt;
  const p = Math.min(1, dist / GOAL);
  speed = SPEED_START + (SPEED_END - SPEED_START) * p;
  if (slow > 0) slow -= dt;
  const v = speed * (slow > 0 ? 0.55 : 1);
  dist += v * dt;
  if (inv > 0) inv -= dt;

  if (dist >= nextSpawn && dist + feetY + 260 + 200 <= GOAL - CLEAR) {
    spawnRow();
    nextSpawn = dist + 340 - p * 50 + Math.random() * 90;
  }

  // 충돌
  const hx0 = x - HIT_W / 2, hx1 = x + HIT_W / 2, hy1 = feetY - 4, hy0 = feetY - HIT_H;
  for (const o of objs) {
    const yb = feetY - (o.at - dist);
    if (o.kind === 'ob') {
      if (o.hit || inv > 0) continue;
      const ox0 = LANES[o.lane] - o.w / 2 + 12, ox1 = LANES[o.lane] + o.w / 2 - 12;
      const oy0 = yb - o.h + 10, oy1 = yb - 6;
      if (hx1 > ox0 && hx0 < ox1 && hy1 > oy0 && hy0 < oy1) { o.hit = true; bump(); if (state !== 'run') return; }
    } else if (o.kind === 'coffee' && !o.taken) {
      if (Math.abs(LANES[o.lane] - x) < 70 && Math.abs((yb - 34) - (feetY - 30)) < 56) drink(o);
    }
  }
  objs = objs.filter(o => feetY - (o.at - dist) - (o.h || 80) < viewH + 40);

  // 발밑 먼지
  if (Math.random() < dt * 9) dust.push({ x: x + (Math.random() - 0.5) * 50, y: feetY + 4, r: 4 + Math.random() * 5, life: 1 });

  if (dist >= GOAL) arrive();
  hud();
}

function bump() {
  drowsy++; hits++; inv = 1.3; slow = 0.6;
  pop('졸음 +1', POINT);
  stage.classList.remove('flash'); void stage.offsetWidth; stage.classList.add('flash');
  const card = $('cmDrowsyCard'); card.classList.remove('bump'); void card.offsetWidth; card.classList.add('bump');
  for (let i = 0; i < 2; i++) pops.push({ text: i ? 'z' : 'Z', x: x - 70 - i * 22, y: feetY - CHAR_H + 10 - i * 26, life: 1.2, color: '#BDBDBD', size: i ? 22 : 32 });
  hud();
  if (drowsy >= MAX_DROWSY) fallAsleep();
}
function drink(o) {
  o.taken = true; cups++;
  if (drowsy > 0) { drowsy--; pop('졸음 -1', POINT); } else pop('커피!', POINT);
  hud();
}
function pop(text, color) { pops.push({ text, x: x + 80, y: feetY - CHAR_H + 20, life: 1, color, size: 26 }); }

function banner(text, cls) {
  $('cmHint').classList.add('hide');
  const b = $('cmBanner'); b.textContent = text;
  b.className = 'cm-banner ' + cls; void b.offsetWidth; b.classList.add('on');
}
function fallAsleep() {
  state = 'sleep'; endT = 0; nextZ = 0;
  stage.classList.remove('flash');
  $('cmHint').classList.add('hide');
  setTimeout(() => { if (state === 'sleep') finish(false); }, 2300);
}
function arrive() {
  dist = GOAL; state = 'arrive'; endT = 0;
  hud();
  burst(x, feetY - CHAR_H * 0.6, 46);
  setTimeout(() => { if (state === 'arrive') burst(x, feetY - CHAR_H * 0.8, 34); }, 450);
  banner('출근 완료!', 'win');
  setTimeout(() => { if (state === 'arrive') finish(true); }, 2200);
}
function burst(cx, cy, n) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = 380 + Math.random() * 520;
    confetti.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.6, r: 5 + Math.random() * 6,
      c: Math.random() < 0.65 ? POINT : '#FFC9A0', sq: Math.random() < 0.55, rot: Math.random() * 6 });
  }
}

/* ---------- 결과 ---------- */
function finish(ok) {
  state = 'end';
  const m = Math.floor(dist / M);
  if (ok) {
    if (!bestTime || elapsed < bestTime) bestTime = elapsed;
    best = GOAL_M;
  } else if (m > best) best = m;
  try { localStorage.setItem('judeong-commute-best', best); localStorage.setItem('judeong-commute-time', bestTime); } catch (e) {}

  const b = $('cmBadge');
  if (ok) {
    b.textContent = '출근 성공 · 선물 획득!'; b.className = 'r-badge win';
    $('cmBig').innerHTML = `${elapsed.toFixed(1)}<em>초</em>`;
    $('cmLabel').textContent = '회사까지 걸린 시간';
    $('cmNote').textContent = `잠들지 않고 ${GOAL_M}m를 걸어왔어요`;
    $('cmL1').textContent = '부딪힌 횟수'; $('cmV1').textContent = hits + '번';
    $('cmL2').textContent = '마신 커피'; $('cmV2').textContent = cups + '잔';
  } else {
    b.textContent = '침대의 유혹에 졌어요'; b.className = 'r-badge miss';
    $('cmBig').innerHTML = `${m}<em>m</em>`;
    $('cmLabel').textContent = '걸어온 거리';
    $('cmNote').textContent = `회사까지 ${GOAL_M - m}m 남았어요 · 잠들지 않고 도착하면 선물을 받아요`;
    $('cmL1').textContent = '부딪힌 횟수'; $('cmV1').textContent = hits + '번';
    $('cmL2').textContent = '최고 기록'; $('cmV2').textContent = best >= GOAL_M ? (bestTime ? bestTime.toFixed(1) + '초' : '도착') : best + 'm';
  }
  $('cmResult').classList.add('on');
}

/* ---------- HUD ---------- */
function hud() {
  const m = Math.max(0, Math.ceil((GOAL - dist) / M));
  $('cmLeft').textContent = m;
  $('cmPill').classList.toggle('reached', dist >= GOAL);
  $('cmBar').style.transform = `scaleX(${Math.min(1, dist / GOAL)})`;
  document.querySelectorAll('#cmDrowsy i, #cmZz i').forEach((n, i) => n.classList.toggle('on', (i % 3) < drowsy));
  const left = MAX_DROWSY - drowsy;
  $('cmDrowsyTxt').textContent = drowsy === 0 ? '3번 부딪히면 잠들어요' : left === 1 ? '한 번만 더 부딪히면 잠들어요!' : left <= 0 ? '잠들어버렸어요' : `앞으로 ${left}번 더 부딪히면 잠들어요`;
  $('cmDrowsyCard').classList.toggle('danger', left <= 1);
  const p = Math.min(1, dist / GOAL);
  $('cmMarker').style.top = `${(1 - p) * 100}%`;
  $('cmFill').style.height = `${p * 100}%`;
  $('cmMarkerTxt').textContent = Math.floor(dist / M) + 'm';
}
function showCount(n) { const c = $('cmCount'); if (c.textContent !== String(n) || !c.classList.contains('on')) { c.textContent = n; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); } }
function hideCount() { $('cmCount').classList.remove('on'); }

/* ---------- 그리기 ---------- */
function rr(x0, y0, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r); ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
  ctx.arcTo(x0, y0 + h, x0, y0, r); ctx.arcTo(x0, y0, x0 + w, y0, r); ctx.closePath();
}
const LINE = '#E3E3E3';
function drawBed(cx, yb, o) {
  const w = o.w, h = o.h, x0 = cx - w / 2, y0 = yb - h;
  ctx.lineWidth = 2; ctx.strokeStyle = LINE; ctx.fillStyle = '#FFFFFF';
  rr(x0, y0, w, 22, 11); ctx.fill(); ctx.stroke();
  rr(x0, y0 + 12, w, h - 12, 16); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#E8E8E8'; rr(x0 + 30, y0 + 26, w - 60, 34, 17); ctx.fill(); ctx.stroke();
  ctx.save(); rr(x0, y0 + 12, w, h - 12, 16); ctx.clip();
  ctx.fillStyle = POINT; ctx.fillRect(x0, y0 + 78, w, h - 78);
  ctx.fillStyle = '#FF8A33'; ctx.fillRect(x0, y0 + 78, w, 14);
  ctx.restore();
}
function drawSofa(cx, yb, o) {
  const w = o.w, h = o.h, x0 = cx - w / 2, y0 = yb - h;
  ctx.fillStyle = '#E6E6E6'; rr(x0, y0, w, h, 22); ctx.fill();
  ctx.fillStyle = '#D4D4D4'; rr(x0, y0, w, 28, 14); ctx.fill();
  rr(x0, y0 + 10, 24, h - 10, 12); ctx.fill(); rr(x0 + w - 24, y0 + 10, 24, h - 10, 12); ctx.fill();
  ctx.fillStyle = '#F0F0F0'; rr(x0 + 30, y0 + 34, (w - 66) / 2, h - 42, 10); ctx.fill();
  rr(x0 + 36 + (w - 66) / 2, y0 + 34, (w - 66) / 2, h - 42, 10); ctx.fill();
}
function drawPillow(cx, yb, o) {
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = LINE; ctx.lineWidth = 2;
  rr(cx - o.w / 2, yb - o.h, o.w, o.h, o.h / 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#EFEFEF'; ctx.beginPath(); ctx.moveTo(cx - o.w / 2 + 26, yb - o.h / 2); ctx.lineTo(cx + o.w / 2 - 26, yb - o.h / 2); ctx.stroke();
}
function drawBlanket(cx, yb, o) {
  ctx.save(); ctx.translate(cx, yb - o.h / 2); ctx.rotate(o.rot * 1.5);
  rr(-o.w / 2, -o.h / 2, o.w, o.h, 28); ctx.fillStyle = POINT; ctx.fill(); ctx.clip();
  ctx.fillStyle = '#FF8A33'; ctx.fillRect(-o.w / 2, -o.h / 2 + 18, o.w, 16);
  ctx.restore();
}
function drawCoffee(cx, yb) {
  const cy = yb - 34;
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = LINE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7A4A2E'; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx + 36, cy, 10, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.fillStyle = '#C55400'; ctx.font = '400 15px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('졸음 -1', cx, cy + 42);
}
function drawBuilding(yb) {
  const w = 420, h = 250, x0 = ROAD / 2 - w / 2, y0 = yb - h;
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = LINE; ctx.lineWidth = 2;
  rr(x0, y0, w, h, 14); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = POINT; rr(ROAD / 2 - 80, y0 - 16, 160, 36, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#C55400'; ctx.font = '400 17px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('회사', ROAD / 2, y0 + 2);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
    ctx.fillStyle = (r * 5 + c) % 3 === 2 ? '#F2F2F2' : '#FFE7D4';
    rr(x0 + 32 + c * 74, y0 + 42 + r * 50, 60, 34, 6); ctx.fill();
  }
  ctx.fillStyle = POINT; rr(ROAD / 2 - 40, yb - 92, 80, 92, 10); ctx.fill();
  ctx.fillRect(ROAD / 2 - 40, yb - 20, 80, 20);
}

function draw(dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#F4F4F4'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * roadLeft, 0);

  // 길
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, -10, ROAD, viewH + 20);
  ctx.fillStyle = '#E6E6E6'; ctx.fillRect(-2, -10, 2, viewH + 20); ctx.fillRect(ROAD, -10, 2, viewH + 20);
  const off = dist % 60;
  ctx.fillStyle = '#EBEBEB';
  for (const lx of [200, 400]) for (let y = -60 + off; y < viewH; y += 60) { rr(lx - 2, y, 4, 28, 2); ctx.fill(); }

  // 길가 덤불
  ctx.fillStyle = '#EAEAEA';
  const boff = dist % 260;
  for (let y = -260 + boff; y < viewH + 60; y += 260) {
    ctx.beginPath(); ctx.arc(-70, y, 28, 0, Math.PI * 2); ctx.arc(-40, y + 14, 20, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ROAD + 70, y + 130, 28, 0, Math.PI * 2); ctx.arc(ROAD + 42, y + 144, 20, 0, Math.PI * 2); ctx.fill();
  }

  // 출발선
  const sy = feetY + dist;
  if (sy - 40 < viewH) {
    ctx.fillStyle = '#FFF4EB'; ctx.fillRect(0, sy - 40, ROAD, 400);
    ctx.fillStyle = '#C55400'; ctx.font = '400 15px Pretendard, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('START · 집 앞', 18, sy - 28);
  }

  // 회사
  const by = feetY - (GOAL + 6 - dist);
  if (by > -20) drawBuilding(by);

  // 장애물 · 커피
  for (const o of objs) {
    const yb = feetY - (o.at - dist), cx = LANES[o.lane];
    if (yb < -10 || yb - (o.h || 80) > viewH) continue;
    if (o.kind === 'coffee') { if (!o.taken) drawCoffee(cx, yb); continue; }
    ctx.save(); ctx.translate(cx, yb); ctx.rotate(o.rot); ctx.translate(-cx, -yb);
    if (o.type === 'bed') drawBed(cx, yb, o);
    else if (o.type === 'sofa') drawSofa(cx, yb, o);
    else if (o.type === 'pillow') drawPillow(cx, yb, o);
    else drawBlanket(cx, yb, o);
    ctx.restore();
  }

  // 먼지
  for (const d of dust) {
    d.life -= dt * 1.6; d.y += (state === 'run' ? speed : 0) * dt * 0.6;
    ctx.globalAlpha = Math.max(0, d.life) * 0.8; ctx.fillStyle = '#E9E9E9';
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; dust = dust.filter(d => d.life > 0);

  // 잠들 때 화면이 살짝 어두워짐
  const asleep = state === 'sleep' || (state === 'end' && drowsy >= MAX_DROWSY);
  if (asleep) {
    const k = Math.min(1, endT / 0.8);
    ctx.fillStyle = `rgba(40,40,48,${0.16 * k})`;
    ctx.fillRect(-roadLeft / scale - 10, -10, cv.width / dpr / scale + 20, viewH + 20);
  }

  // 주덩이
  ctx.fillStyle = 'rgba(0,0,0,.07)';
  ctx.beginPath(); ctx.ellipse(x, feetY, 56, 9, 0, 0, Math.PI * 2); ctx.fill();
  if (asleep) {
    if (sleepImg.complete) {
      const w = 200, h = w * 833 / 1173;
      const drop = Math.max(0, 1 - endT / 0.25);                 // 털썩 눕는 느낌
      const br = Math.sin(t * 2.4) * 0.02;                        // 숨쉬기
      ctx.save(); ctx.translate(x, feetY + 6 - drop * 30); ctx.scale(1 - br * 0.4, 1 + br);
      ctx.drawImage(sleepImg, -w / 2, -h, w, h); ctx.restore();
    }
    if (t > nextZ) {
      nextZ = t + 0.42;
      pops.push({ text: 'Z', x: x + 70 + Math.random() * 20, y: feetY - 120, life: 1.8, color: '#8E8E8E', size: 26 + Math.random() * 18, vx: 18 + Math.random() * 14 });
    }
  } else if (img.complete) {
    const face = drowsyImgs[Math.min(drowsy, 2)];
    const walking = state === 'run';
    const ph = t * 9;
    let bob = walking ? Math.abs(Math.sin(ph)) * 7 : 0;
    if (state === 'arrive' || (state === 'end' && drowsy < MAX_DROWSY)) {
      bob = Math.abs(Math.sin(endT * 8)) * 26 * Math.max(0, 1 - endT / 1.6);   // 도착해서 폴짝폴짝
    }
    const tilt = walking ? Math.sin(ph) * 0.05 : 0;
    const lean = (LANES[lane] - x) * 0.002;
    ctx.save();
    if (inv > 0 && Math.floor(inv * 10) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.translate(x, feetY - bob); ctx.rotate(tilt + lean);
    ctx.drawImage(face.complete ? face : img, -CHAR_W / 2, -CHAR_H, CHAR_W, CHAR_H);
    ctx.restore();
  }

  // 글자 이펙트
  for (const p of pops) {
    p.life -= dt; p.y -= dt * 50; if (p.vx) p.x += p.vx * dt;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
    ctx.fillStyle = p.color; ctx.font = `400 ${p.size}px Pretendard, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1; pops = pops.filter(p => p.life > 0);

  // 축하 조각
  for (const c of confetti) {
    c.vy += 1300 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt; c.rot += dt * 8;
    ctx.globalAlpha = Math.max(0, Math.min(1, c.life)); ctx.fillStyle = c.c;
    if (c.sq) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.fillRect(-c.r, -c.r / 2, c.r * 2, c.r); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.75, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1; confetti = confetti.filter(c => c.life > 0);
}

/* ---------- 루프 ---------- */
function frame(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt);
  draw(dt);
  requestAnimationFrame(frame);
}
function open() {
  document.getElementById('home').classList.remove('on'); scr.classList.add('on');
  resize(); reset();
  if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
}
function close() { running = false; state = 'idle'; hideCount(); scr.classList.remove('on'); document.getElementById('home').classList.add('on'); }
$('cmStartBtn').addEventListener('click', open);
$('cmBack').addEventListener('click', close);
$('cmHome').addEventListener('click', close);
$('cmAgain').addEventListener('click', () => { resize(); reset(); });
window.addEventListener('resize', () => { if (scr.classList.contains('on')) resize(); });
})();
