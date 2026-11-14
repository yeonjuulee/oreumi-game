/* 사이트 공통 사운드: 효과음 + 배경음 (파일 없이 Web Audio로 직접 합성) */
window.Sound = (() => {
  'use strict';
  let ctx = null, master = null, sfxBus = null, bgmBus = null;
  let sfxOn = true, bgmOn = true;
  try {
    sfxOn = localStorage.getItem('oreumi-sfx') !== 'off';
    bgmOn = localStorage.getItem('oreumi-bgm') !== 'off';
  } catch (e) {}

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    bgmBus = ctx.createGain(); bgmBus.gain.value = bgmOn ? 1 : 0; bgmBus.connect(master);
    return ctx;
  }
  // 브라우저는 사용자가 한 번 누르기 전까지 소리를 막으므로, 첫 터치/클릭/키 입력 때 오디오를 연다
  function unlock() {
    try {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      if (bgmOn) startBgm();
    } catch (e) {}
  }
  ['pointerdown', 'keydown'].forEach(t => window.addEventListener(t, unlock, { capture: true }));

  /* ---------- 기본 음 ---------- */
  function tone(freq, at, dur, type, vol, slideTo, bus) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + (at || 0);
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.14, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  }
  let noiseBuf = null;
  function noise(at, dur, from, to, vol, type, bus) {
    if (!ctx) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + (at || 0);
    src.buffer = noiseBuf;
    f.type = type || 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || 0.12, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(bus || sfxBus);
    src.start(t); src.stop(t + dur + 0.05);
  }
  // 네모파를 살짝 깎아서 부드러운 오락실 느낌으로
  function chip(freq, at, dur, vol, slideTo, bus) {
    if (!ctx) return;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + (at || 0);
    o.type = 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    f.type = 'lowpass'; f.frequency.value = 2600;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || 0.06, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(f); f.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  }

  /* ---------- 효과음 목록 (통통 튀는 오락실 느낌) ---------- */
  const lib = {
    tap:    () => { chip(660, 0, 0.05, 0.07); chip(990, 0.045, 0.07, 0.07); },
    grab:   () => { tone(300, 0, 0.1, 'triangle', 0.14, 600); chip(900, 0.06, 0.06, 0.04); },
    throw:  () => { noise(0, 0.3, 600, 3200, 0.12); tone(260, 0, 0.3, 'triangle', 0.1, 1100); },
    thud:   () => { tone(170, 0, 0.22, 'sine', 0.26, 55); noise(0, 0.09, 400, 160, 0.09); tone(340, 0.12, 0.08, 'triangle', 0.05, 280); },
    bump:   () => { tone(240, 0, 0.08, 'triangle', 0.14, 150); noise(0, 0.05, 900, 400, 0.05); },
    boing:  () => { tone(220, 0, 0.14, 'sine', 0.2, 740); tone(740, 0.13, 0.12, 'sine', 0.15, 330); tone(330, 0.24, 0.16, 'sine', 0.1, 560); },
    goal:   () => { [523, 659, 784, 1047, 1319].forEach((f, i) => chip(f, i * 0.055, 0.16, 0.07)); [2093, 2637].forEach((f, i) => tone(f, 0.3 + i * 0.07, 0.25, 'sine', 0.05)); },
    miss:   () => { chip(440, 0, 0.12, 0.06, 415); chip(370, 0.13, 0.28, 0.06, 330); },
    win:    () => {
      [523, 523, 523, 659, 784].forEach((f, i) => chip(f, [0, 0.1, 0.2, 0.32, 0.44][i], i === 4 ? 0.2 : 0.09, 0.08));
      [1047, 1319, 1568, 2093].forEach(f => tone(f, 0.62, 0.9, 'triangle', 0.06));
      [523, 659, 784].forEach(f => chip(f, 0.62, 0.9, 0.035));
      noise(0.62, 0.6, 6000, 9000, 0.03, 'highpass');
    },
    lose:   () => [392, 370, 349, 294].forEach((f, i) => tone(f, i * 0.22, i === 3 ? 0.6 : 0.24, 'sawtooth', 0.045, i === 3 ? 262 : f * 0.97)),
    pat:    () => { const p = [784, 880, 1047, 1175, 1319][Math.floor(Math.random() * 5)]; tone(p, 0, 0.07, 'sine', 0.07, p * 1.25); },
    twitch: () => { tone(180, 0, 0.12, 'triangle', 0.12, 260); tone(260, 0.1, 0.1, 'triangle', 0.08, 190); },
    warn:   () => { chip(880, 0, 0.08, 0.05); chip(880, 0.12, 0.08, 0.05); chip(1175, 0.24, 0.1, 0.05); },
    wake:   () => { chip(330, 0, 0.12, 0.08, 1320); tone(1320, 0.12, 0.3, 'triangle', 0.12, 990); noise(0.12, 0.2, 2000, 5000, 0.05); },
    tick:   () => chip(1320, 0, 0.04, 0.05),
    count:  () => chip(784, 0, 0.16, 0.08),
    go:     () => { chip(1568, 0, 0.32, 0.08); tone(784, 0, 0.32, 'triangle', 0.08); },
    swish:  () => { noise(0, 0.11, 1200, 4200, 0.09); },
    bonk:   () => { tone(520, 0, 0.12, 'square', 0.06, 130); tone(110, 0.02, 0.22, 'sine', 0.2, 60); },
    chime:  () => { chip(988, 0, 0.07, 0.07); chip(1319, 0.07, 0.28, 0.07); tone(2637, 0.07, 0.25, 'sine', 0.03); },
    sleep:  () => { [659, 523, 440, 349, 262].forEach((f, i) => tone(f, i * 0.2, 0.45, 'sine', 0.1)); tone(130, 0.9, 0.8, 'sine', 0.06, 110); },
    no:     () => { chip(220, 0, 0.12, 0.07); chip(165, 0.11, 0.2, 0.07); },
  };
  function play(name) {
    if (!sfxOn || !ensure() || ctx.state !== 'running') return;
    const f = lib[name]; if (f) try { f(); } catch (e) {}
  }

  /* ---------- 배경음: 신나는 132 BPM 루프 (드럼 + 통통 베이스 + 멜로디 + 오프비트 코드) ---------- */
  const BPM = 132, STEP = 60 / BPM / 2;   // 8분음표 단위, 한 마디 = 8칸
  const MEL = [
    659, 0, 784, 659, 0, 523, 587, 659,     // C
    587, 0, 494, 0, 587, 784, 0, 587,       // G
    523, 0, 659, 880, 0, 784, 659, 0,       // Am
    698, 659, 587, 0, 523, 0, 440, 0,       // F
    659, 784, 1047, 0, 988, 0, 784, 0,      // C
    880, 784, 587, 0, 784, 0, 494, 0,       // G
    880, 0, 784, 698, 659, 0, 587, 0,       // F
    587, 659, 698, 784, 0, 0, 0, 0,         // G
  ];
  const ROOT = [131, 98, 110, 87.3, 131, 98, 87.3, 98];
  const CHORD = [[262, 330, 392], [247, 294, 392], [262, 330, 440], [262, 349, 440], [262, 330, 392], [247, 294, 392], [262, 349, 440], [247, 294, 392]];
  let bgmTimer = null, nextTime = 0, stepIdx = 0;
  function kick(at) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at;
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(bgmBus); o.start(t); o.stop(t + 0.18);
  }
  function schedule() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.25) {
      const at = nextTime - ctx.currentTime, s = stepIdx % 8, bar = Math.floor(stepIdx / 8) % 8;
      const m = MEL[stepIdx % MEL.length];
      if (m) { chip(m, at, STEP * 0.9, 0.022, null, bgmBus); tone(m, at, STEP * 1.2, 'triangle', 0.018, null, bgmBus); }
      // 통통 튀는 베이스: 근음 ↔ 한 옥타브 위
      tone(ROOT[bar] * (s % 2 ? 2 : 1), at, STEP * 0.8, 'triangle', 0.06, null, bgmBus);
      // 드럼: 쿵(1,3박) · 착(2,4박) · 칫(매 8분)
      if (s === 0 || s === 4) kick(at);
      if (s === 2 || s === 6) noise(at, 0.12, 1800, 1400, 0.045, 'bandpass', bgmBus);
      noise(at + (s % 2 ? 0 : 0.002), 0.035, 8000, 9000, s % 2 ? 0.018 : 0.01, 'highpass', bgmBus);
      // 오프비트 코드 짧게 '짠'
      if (s % 2 === 1) CHORD[bar].forEach(f => tone(f, at, STEP * 0.45, 'triangle', 0.011, null, bgmBus));
      nextTime += STEP; stepIdx++;
    }
  }
  function startBgm() {
    if (!ensure() || bgmTimer) return;
    nextTime = ctx.currentTime + 0.1;
    bgmTimer = setInterval(schedule, 100);
  }
  function stopBgm() { clearInterval(bgmTimer); bgmTimer = null; }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (bgmOn || sfxOn) ctx.resume();
  });

  /* ---------- 켜기/끄기 ---------- */
  function setSfx(on) { sfxOn = on; try { localStorage.setItem('oreumi-sfx', on ? 'on' : 'off'); } catch (e) {} }
  function setBgm(on) {
    bgmOn = on;
    try { localStorage.setItem('oreumi-bgm', on ? 'on' : 'off'); } catch (e) {}
    if (!ensure()) return;
    bgmBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.1);
    if (on) { if (ctx.state === 'suspended') ctx.resume(); startBgm(); } else stopBgm();
  }

  // 모든 버튼(시작하기, 다시 하기, 처음으로, 뒤로)에 누르는 소리
  document.addEventListener('click', e => {
    if (e.target.closest('.btn, .back, .snd-btn')) play('tap');
  });

  return {
    play, tone: (f, at, dur, type, vol) => { if (sfxOn && ensure() && ctx.state === 'running') tone(f, at, dur, type, vol); },
    unlock, setSfx, setBgm,
    get sfxOn() { return sfxOn; }, get bgmOn() { return bgmOn; }
  };
})();

/* 시작 페이지의 배경음·효과음 버튼 */
(() => {
  const bgmBtn = document.getElementById('sndBgm'), sfxBtn = document.getElementById('sndSfx');
  if (!bgmBtn || !sfxBtn) return;
  const sync = () => {
    bgmBtn.classList.toggle('on', Sound.bgmOn); bgmBtn.setAttribute('aria-pressed', Sound.bgmOn);
    sfxBtn.classList.toggle('on', Sound.sfxOn); sfxBtn.setAttribute('aria-pressed', Sound.sfxOn);
  };
  bgmBtn.addEventListener('click', () => { Sound.setBgm(!Sound.bgmOn); sync(); });
  sfxBtn.addEventListener('click', () => { Sound.setSfx(!Sound.sfxOn); sync(); });
  sync();
})();
