/* 01 계단 던지기 */
(() => {
'use strict';
const POINT = '#FE7606';
const ROUNDS = 3;
const GOAL_PCT = 70;          // 승리 조건: 3라운드 평균 일치율

/* ---------- 월드 설정 (논리 좌표) ---------- */
const W = 1600, H = 1000;
const GROUND = 900;
const STEPS = 12;
const STEP_W = 88, STEP_H = 58, BED_STEP_W = 200;
const STAIR_X = 300;
const START_X = 150;
const CHAR_H = 104, CHAR_W = CHAR_H * 315 / 360;
const HW = 26;                 // 충돌용 반폭
const GRAV = 1500;
const MAX_PULL = 240, MAX_SPEED = 2300;
const BED_HALF = 78;           // 침대 반폭 (착지면 + 골인 판정)
const BED_TOP = 46;            // 침대 윗면 높이

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const home = $('home'), game = $('game'), stage = $('stage'), cv = $('cv'), ctx = cv.getContext('2d');
// 골인 문구는 한 번 재생되면 표시를 지워둠 (화면을 다시 열 때 재생되는 문제 방지)
$('goalPop').addEventListener('animationend', () => $('goalPop').classList.remove('go'));
const img = new Image(); img.src = 'images/judeong.png';

/* ---------- 상태 ---------- */
let steps = [];      // {floor, x0, x1, top}
let target = 7, round = 1, results = [];
let ch, phase = 'aim';  // aim | drag | fly | land | done
let drag = null, landFx = null, particles = [];
let scale = 1, ox = 0, oy = 0, dpr = 1;

function buildStairs() {
  steps = [];
  let x = STAIR_X;
  for (let f = 1; f <= STEPS; f++) {
    let w = f === target ? BED_STEP_W : STEP_W;
    if (f === STEPS) w = W - x;     // 맨 위층은 오른쪽 끝까지
    steps.push({ floor: f, x0: x, x1: x + w, top: GROUND - f * STEP_H });
    x += w;
  }
}
const bedCenter = () => { const s = steps[target - 1]; return s.x0 + (s.x1 - s.x0) / 2; };
function floorAt(x) {
  for (const s of steps) if (x >= s.x0 && x < s.x1) return s.floor;
  return x >= W ? STEPS : 0;
}
const topOf = f => GROUND - f * STEP_H;
const onBedX = x => floorAt(x) === target && Math.abs(x - bedCenter()) <= BED_HALF;
const surfaceAt = x => topOf(floorAt(x)) - (onBedX(x) ? BED_TOP : 0);

function resetChar() {
  ch = { x: START_X, y: GROUND, vx: 0, vy: 0, rot: 0, sx: 1, sy: 1 };
  phase = 'aim'; drag = null; landFx = null;
}

function newRound() {
  $('goalPop').classList.remove('go');   // 지난 판의 골인 문구가 다시 재생되지 않게
  let t;
  do { t = 2 + Math.floor(Math.random() * 10); } while (results.some(r => r.target === t) && results.length < 9);
  target = t;
  buildStairs(); resetChar();
  $('targetTxt').textContent = target + '층';
  $('roundTxt').textContent = round;
  $('hint').classList.remove('hide');
}

function startGame() {
  round = 1; results = [];
  $('resultCard').classList.remove('on'); $('finalCard').classList.remove('on');
  newRound();
}

/* ---------- 화면 맞춤 ---------- */
function resize() {
  const r = stage.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const pad = 12;
  scale = Math.min((r.width - pad * 2) / W, (r.height - pad) / H);
  ox = (r.width - W * scale) / 2;
  oy = (r.height - H * scale) - pad / 2;
  if (oy < 0) oy = 0;
}
const toWorld = (cx, cy) => {
  const r = cv.getBoundingClientRect();
  return { x: (cx - r.left - ox) / scale, y: (cy - r.top - oy) / scale };
};
const toScreen = (x, y) => ({ x: x * scale + ox, y: y * scale + oy });

/* ---------- 입력 ---------- */
cv.addEventListener('pointerdown', e => {
  if (phase !== 'aim') return;
  const p = toWorld(e.clientX, e.clientY);
  const cx = ch.x, cy = ch.y - CHAR_H / 2;
  const hitR = Math.max(80, 44 / scale);   // 터치 여유
  if (Math.hypot(p.x - cx, p.y - cy) > hitR) return;
  cv.setPointerCapture(e.pointerId);
  drag = { id: e.pointerId, ax: cx, ay: cy, px: p.x, py: p.y };
  phase = 'drag';
  $('hint').classList.add('hide');
});
cv.addEventListener('pointermove', e => {
  const p = toWorld(e.clientX, e.clientY);
  if (phase === 'drag' && drag && e.pointerId === drag.id) { drag.px = p.x; drag.py = p.y; }
  if (phase === 'aim') {
    const near = Math.hypot(p.x - ch.x, p.y - (ch.y - CHAR_H / 2)) < Math.max(80, 44 / scale);
    cv.style.cursor = near ? 'grab' : 'default';
  } else cv.style.cursor = phase === 'drag' ? 'grabbing' : 'default';
});
function release(e) {
  if (phase !== 'drag' || !drag || e.pointerId !== drag.id) return;
  const v = pullVec();
  if (v.len < 18) { phase = 'aim'; drag = null; return; }   // 너무 약하면 취소
  const sp = (v.len / MAX_PULL) * MAX_SPEED;
  ch.vx = v.ux * sp; ch.vy = v.uy * sp;
  ch.spin = (ch.vx >= 0 ? 1 : -1) * (2 + sp / 900);
  phase = 'fly'; drag = null;
}
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', release);

function pullVec() {
  let dx = drag.ax - drag.px, dy = drag.ay - drag.py;
  let len = Math.hypot(dx, dy);
  if (len < 0.001) return { ux: 0, uy: 0, len: 0, dx: 0, dy: 0 };
  const ux = dx / len, uy = dy / len;
  len = Math.min(len, MAX_PULL);
  return { ux, uy, len, dx: ux * len, dy: uy * len };
}

/* ---------- 물리 ---------- */
function physics(dt) {
  const SUB = 6, h = dt / SUB;
  for (let i = 0; i < SUB && phase === 'fly'; i++) {
    const prevY = ch.y;
    ch.vy += GRAV * h;
    ch.x += ch.vx * h; ch.y += ch.vy * h;
    ch.rot += ch.spin * h;

    // 좌우 벽
    if (ch.x < HW) { ch.x = HW; ch.vx = Math.abs(ch.vx) * 0.35; ch.spin *= -0.6; }
    if (ch.x > W - HW) { ch.x = W - HW; ch.vx = -Math.abs(ch.vx) * 0.35; ch.spin *= -0.6; }

    // 계단 옆면(올라가는 방향) 충돌
    // 계단 옆면 / 침대 옆면 충돌
    if (ch.vx !== 0) {
      const dir = ch.vx > 0 ? 1 : -1;
      const sFront = surfaceAt(ch.x + dir * HW), sHere = surfaceAt(ch.x);
      const frontBed = onBedX(ch.x + dir * HW);
      const tol = frontBed ? 20 : 1;          // 침대 모서리는 살짝 걸쳐도 올라탈 수 있게
      if (sFront < sHere - 0.5 && ch.y > sFront + tol) {
        const bc = bedCenter();
        let edge;
        if (frontBed) edge = dir > 0 ? bc - BED_HALF : bc + BED_HALF;
        else edge = steps[floorAt(ch.x + dir * HW) - 1].x0;
        ch.x = edge - dir * (HW + 0.5);
        ch.vx = -ch.vx * (frontBed ? 0.18 : 0.3);
        ch.spin *= -0.5;
      }
    }

    // 착지
    const f = floorAt(ch.x), top = surfaceAt(ch.x);
    if (ch.vy > 0 && ch.y >= top && prevY <= top + 22) {
      ch.y = top; land(f);
    } else if (ch.y > top + 40) {          // 안전장치
      ch.y = top; land(f);
    }
  }
}

// 목표 층에 도착하면 100%, 벗어나면 목표 칸 가장자리와의 거리로 감점 (최대 90%)
function scoreFor(x) {
  const s = steps[target - 1];
  if (floorAt(x) === target) return { pct: 100, hit: true, onBed: onBedX(x) };
  const d = x < s.x0 ? s.x0 - x : x - s.x1;
  return { pct: Math.max(0, Math.round(90 * (1 - d / (5 * STEP_W)))), hit: false, onBed: false };
}

function land(f) {
  phase = 'land';
  const impact = Math.min(1, Math.abs(ch.vy) / 1400);
  ch.vx = ch.vy = 0;
  const sc = scoreFor(ch.x);
  const onBed = sc.onBed, hit = sc.hit;
  results.push({ target, floor: f, pct: sc.pct, onBed, hit });
  landFx = { t: 0, onBed, impact, startRot: ch.rot };
  if (hit) {
    burst(ch.x, ch.y - 30);
    const s = toScreen(ch.x, ch.y - CHAR_H - 30);
    const gp = $('goalPop');
    gp.textContent = onBed ? '골인!' : '도착!';
    gp.style.left = s.x + 'px'; gp.style.top = s.y + 'px';
    gp.classList.remove('go'); void gp.offsetWidth; gp.classList.add('go');
  }
  setTimeout(() => showResult(results[results.length - 1]), hit ? 1300 : 750);
}

function burst(x, y) {
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, s = 300 + Math.random() * 520;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1,
      r: 4 + Math.random() * 5, c: Math.random() < 0.7 ? POINT : '#FFC9A0', sq: Math.random() < 0.5 });
  }
}

/* ---------- 결과 ---------- */
function countUp(el, to) {
  const t0 = performance.now();
  const tick = now => {
    const k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(to * e);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function showResult(r) {
  const b = $('rBadge');
  if (r.onBed) { b.textContent = '침대 골인'; b.className = 'r-badge'; }
  else if (r.floor === r.target) { b.textContent = '목표 층 도착'; b.className = 'r-badge'; }
  else { b.textContent = r.floor < r.target ? '조금 더 세게' : '조금 더 약하게'; b.className = 'r-badge miss'; }
  $('rTarget').textContent = r.target + '층';
  $('rLand').textContent = r.floor === 0 ? '바닥' : r.floor + '층';
  $('nextBtn').textContent = round < ROUNDS ? '다음 라운드' : '최종 결과 보기';
  countUp($('rPct'), r.pct);
  $('resultCard').classList.add('on');
  phase = 'done';
}
$('nextBtn').addEventListener('click', () => {
  $('resultCard').classList.remove('on');
  if (round < ROUNDS) { round++; newRound(); }
  else showFinal();
});
function showFinal() {
  const avg = Math.round(results.reduce((a, r) => a + r.pct, 0) / results.length);
  $('fList').innerHTML = results.map((r, i) =>
    `<li><span>${i + 1}라운드 · 목표 ${r.target}층 → ${r.floor === 0 ? '바닥' : r.floor + '층'}</span>` +
    `<b>${r.pct}%${r.hit ? '<span class="goal">도착</span>' : ''}</b></li>`).join('');
  const ok = avg >= GOAL_PCT, b = $('fBadge');
  b.textContent = ok ? '목표 달성 · 승리!' : '아쉬워요 · 목표 미달성';
  b.className = ok ? 'r-badge win' : 'r-badge miss';
  $('fGoal').textContent = ok ? `목표 평균 ${GOAL_PCT}% 이상을 달성했어요` : `목표 평균 ${GOAL_PCT}% 이상 · ${GOAL_PCT - avg}%가 부족해요`;
  countUp($('fPct'), avg);
  $('finalCard').classList.add('on');
}
$('againBtn').addEventListener('click', startGame);
$('homeBtn').addEventListener('click', goHome);

/* ---------- 그리기 ---------- */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawBed(s) {
  const cx = (s.x0 + s.x1) / 2, top = s.top;
  const bw = BED_HALF * 2, x = cx - bw / 2;
  ctx.lineWidth = 2; ctx.strokeStyle = '#E3E3E3';
  // 헤드보드
  ctx.fillStyle = '#FFFFFF'; rr(x - 4, top - 66, 16, 66, 6); ctx.fill(); ctx.stroke();
  // 다리
  ctx.fillStyle = '#E3E3E3';
  ctx.fillRect(x + 4, top - 8, 6, 8); ctx.fillRect(x + bw - 10, top - 8, 6, 8);
  // 프레임 + 매트리스
  ctx.fillStyle = '#FFFFFF'; rr(x, top - 34, bw, 26, 8); ctx.fill(); ctx.stroke();
  rr(x + 6, top - 46, bw - 10, 16, 8); ctx.fill(); ctx.stroke();
  // 이불
  ctx.fillStyle = POINT; rr(x + 52, top - 49, bw - 54, 30, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 62, top - 40); ctx.lineTo(x + bw - 10, top - 40); ctx.stroke();
  // 베개
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#E3E3E3'; ctx.lineWidth = 2;
  rr(x + 14, top - 58, 36, 16, 8); ctx.fill(); ctx.stroke();
}

function drawWorld() {
  // 바닥
  ctx.fillStyle = '#F7F7F7'; ctx.fillRect(-2000, GROUND, W + 4000, 400);
  ctx.strokeStyle = '#E6E6E6'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-2000, GROUND); ctx.lineTo(W + 2000, GROUND); ctx.stroke();

  // 계단
  for (const s of steps) {
    const isT = s.floor === target;
    ctx.fillStyle = isT ? '#FFF5EC' : '#F7F7F7';
    ctx.fillRect(s.x0, s.top, s.x1 - s.x0 + (s.floor === STEPS ? 2000 : 0), GROUND - s.top);
  }
  ctx.strokeStyle = '#E6E6E6'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-2000, GROUND); ctx.lineTo(STAIR_X, GROUND);
  for (const s of steps) { ctx.lineTo(s.x0, s.top); ctx.lineTo(s.floor === STEPS ? W + 2000 : s.x1, s.top); }
  ctx.stroke();
  // 칸 구분 세로선
  ctx.strokeStyle = '#EFEFEF'; ctx.lineWidth = 1.5;
  for (const s of steps) { ctx.beginPath(); ctx.moveTo(s.x0, s.top); ctx.lineTo(s.x0, GROUND); ctx.stroke(); }

  // 목표 층 윗면 강조
  const t = steps[target - 1];
  ctx.strokeStyle = POINT; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(t.x0 + 2, t.top); ctx.lineTo(t.x1 - 2, t.top); ctx.stroke(); ctx.lineCap = 'butt';

  // 층 숫자
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const s of steps) {
    const isT = s.floor === target;
    ctx.fillStyle = isT ? POINT : '#BDBDBD';
    ctx.font = (isT ? '400 ' : '300 ') + '22px Pretendard, sans-serif';
    const cx = s.floor === STEPS ? s.x0 + 44 : (s.x0 + s.x1) / 2;
    ctx.fillText(s.floor, cx, s.top + 14);
  }
  drawBed(t);

  // 출발 지점 표시
  ctx.fillStyle = '#E9E9E9'; rr(START_X - 46, GROUND + 10, 92, 6, 3); ctx.fill();
}

function drawAim() {
  if (phase !== 'drag' || !drag) return;
  const v = pullVec(); if (v.len < 4) return;
  const ax = ch.x, ay = ch.y - CHAR_H / 2;
  const power = v.len / MAX_PULL;
  // 당긴 끈
  ctx.strokeStyle = '#D9D9D9'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - v.dx, ay - v.dy); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#CFCFCF';
  ctx.beginPath(); ctx.arc(ax - v.dx, ay - v.dy, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 방향 화살표 (짧게: 궤적은 보여주지 않음)
  const L = 70 + power * 110;
  const ex = ax + v.ux * L, ey = ay + v.uy * L;
  ctx.strokeStyle = POINT; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax + v.ux * 62, ay + v.uy * 62); ctx.lineTo(ex, ey); ctx.stroke();
  const a = Math.atan2(v.uy, v.ux);
  ctx.beginPath();
  ctx.moveTo(ex + Math.cos(a) * 4, ey + Math.sin(a) * 4);
  ctx.lineTo(ex - Math.cos(a - 0.5) * 18, ey - Math.sin(a - 0.5) * 18);
  ctx.moveTo(ex + Math.cos(a) * 4, ey + Math.sin(a) * 4);
  ctx.lineTo(ex - Math.cos(a + 0.5) * 18, ey - Math.sin(a + 0.5) * 18);
  ctx.stroke(); ctx.lineCap = 'butt';
  // 파워 게이지
  const gx = ax - 60, gy = ay + 78, gw = 120;
  ctx.fillStyle = '#EFEFEF'; rr(gx, gy, gw, 8, 4); ctx.fill();
  ctx.fillStyle = POINT; rr(gx, gy, Math.max(8, gw * power), 8, 4); ctx.fill();
  ctx.fillStyle = '#8A8A8A'; ctx.font = '300 18px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('힘 ' + Math.round(power * 100), ax, gy + 14);
}

function drawChar(dt) {
  let sx = 1, sy = 1, rot = 0, lift = 0;
  if (phase === 'drag' && drag) {
    const p = pullVec().len / MAX_PULL;
    sx = 1 + p * 0.1; sy = 1 - p * 0.12;
  } else if (phase === 'fly') {
    rot = ch.rot;
  } else if ((phase === 'land' || phase === 'done') && landFx) {
    landFx.t += dt;
    const t = landFx.t;
    // 회전은 빠르게 똑바로 복귀
    rot = landFx.startRot * Math.max(0, 1 - t / 0.12);
    if (landFx.onBed) {
      // 침대 위 통통 튀기 (연출)
      const hops = [[0, 0.42, 70], [0.42, 0.74, 32], [0.74, 0.96, 12]];
      for (const [a, b, hgt] of hops) if (t >= a && t < b) { const k = (t - a) / (b - a); lift = 4 * hgt * k * (1 - k); }
      const sq = (u) => Math.max(0, 1 - u / 0.08);
      const impacts = [0, 0.42, 0.74, 0.96];
      let s = 0; for (const i of impacts) if (t >= i) s = Math.max(s, sq(t - i) * (i === 0 ? 0.22 : 0.12));
      sx = 1 + s; sy = 1 - s;
    } else {
      const s = Math.max(0, 1 - t / 0.18) * 0.18 * (0.4 + landFx.impact);
      sx = 1 + s; sy = 1 - s;
    }
  } else if (phase === 'aim') {
    const k = Math.sin(performance.now() / 380) * 0.02;
    sx = 1 - k; sy = 1 + k;
  }

  // 그림자
  const floorY = surfaceAt(ch.x);
  const alt = Math.max(0, floorY - ch.y + lift);
  const shw = Math.max(18, 40 - alt * 0.04);
  {
    ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0.03, 0.08 - alt * 0.0001) + ')';
    ctx.beginPath(); ctx.ellipse(ch.x, floorY - 1, shw, 6, 0, 0, Math.PI * 2); ctx.fill();
  }

  if (!img.complete) return;
  ctx.save();
  ctx.translate(ch.x, ch.y - lift);
  if (phase === 'fly') { ctx.translate(0, -CHAR_H / 2); ctx.rotate(rot); ctx.translate(0, CHAR_H / 2); }
  else if (rot) { ctx.translate(0, -CHAR_H / 2); ctx.rotate(rot); ctx.translate(0, CHAR_H / 2); }
  ctx.scale(sx, sy);
  ctx.drawImage(img, -CHAR_W / 2, -CHAR_H, CHAR_W, CHAR_H);
  ctx.restore();

  // 화면 위로 벗어났을 때 위치 표시
  const sTop = (0 - oy) / scale;
  if (ch.y - CHAR_H < sTop) {
    const yy = sTop + 18;
    ctx.fillStyle = POINT;
    ctx.beginPath(); ctx.moveTo(ch.x, yy - 10); ctx.lineTo(ch.x - 11, yy + 8); ctx.lineTo(ch.x + 11, yy + 8); ctx.closePath(); ctx.fill();
  }
}

function drawParticles(dt) {
  for (const p of particles) {
    p.vy += 1400 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.9;
    ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
    if (p.sq) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 8); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.8, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  particles = particles.filter(p => p.life > 0);
}

/* ---------- 루프 ---------- */
let last = performance.now(), running = false;
function frame(now) {
  if (!running) return;
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (phase === 'fly') physics(dt);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  drawWorld();
  drawAim();
  drawChar(dt);
  drawParticles(dt);
  requestAnimationFrame(frame);
}

/* ---------- 화면 전환 ---------- */
function goGame() {
  home.classList.remove('on'); game.classList.add('on');
  resize(); startGame();
  if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
}
function goHome() {
  running = false;
  $('resultCard').classList.remove('on'); $('finalCard').classList.remove('on');
  game.classList.remove('on'); home.classList.add('on');
}
$('startBtn').addEventListener('click', goGame);
$('backBtn').addEventListener('click', goHome);
window.addEventListener('resize', () => { if (game.classList.contains('on')) resize(); });
document.addEventListener('gesturestart', e => e.preventDefault());
})();
