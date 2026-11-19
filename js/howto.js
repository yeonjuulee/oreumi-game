/* 게임 방법 모달: 시작 페이지에서 게임을 고르면 해당 게임 화면 위에 먼저 띄움 */
window.HowTo = (() => {
  'use strict';
  const DATA = {
    stairs: {
      video: 'videos/stairs.mp4', poster: 'videos/stairs.jpg',
      no: '01', title: '오르미 계단 던지기',
      steps: ['오르미를 누른 채 뒤로 당겼다가 놓아서 던져요', '침대가 놓인 목표 층에 떨어지면 일치율 100%예요', '3번 던진 평균 일치율이 최종 점수예요'],
      win: '3라운드 평균 일치율 70% 이상'
    },
    pet: {
      video: 'videos/pet.mp4', poster: 'videos/pet.jpg',
      no: '02', title: '오르미 쓰다듬기',
      steps: ['오르미를 누른 채 문지르면 횟수가 올라가요', '뒤척이기 시작하면 잠깐 손을 멈춰요', '오르미가 깨면 게임 오버예요'],
      win: '깨우지 않고 30초 동안 70회 이상'
    },
    commute: {
      video: 'videos/commute.mp4', poster: 'videos/commute.jpg',
      no: '03', title: '오르미 출근시키기',
      steps: ['← → 키나 화면 왼쪽·오른쪽을 눌러 길을 바꿔요', '침대·베개·이불·소파에 3번 닿으면 잠들어요', '오름 로고를 먹으면 졸음이 1칸 줄어요'],
      win: '잠들지 않고 회사(500m)까지 도착하기'
    },
    find: {
      no: '04', title: '시크릿 오르미 찾기',
      sil: 'images/find/secret.png',
      steps: ['오르미 친구들 사이에서 시크릿 오르미를 톡 눌러요', '라운드마다 18 → 36 → 55마리로 늘어나요', '다른 오르미를 누르면 그 라운드는 실패예요'],
      win: '3라운드 모두 찾기'
    }
  };

  const $ = id => document.getElementById(id);
  const box = $('howto');
  let handlers = {}, open = false;

  function show(key, opts) {
    const d = DATA[key]; if (!d) { if (opts && opts.onStart) opts.onStart(); return; }
    handlers = opts || {};
    $('howtoNo').textContent = d.no;
    $('howtoTitle').textContent = d.title;
    const img = $('howtoImg'), note = $('howtoNote');
    img.hidden = !d.img; if (d.img) img.src = d.img;
    img.classList.toggle('silhouette', !!d.silhouette);
    note.hidden = !d.note; note.textContent = d.note || '';
    $('howtoSteps').innerHTML = d.steps.map((s, i) => `<li><span>${i + 1}</span>${s}</li>`).join('');
    $('howtoWin').textContent = d.win;
    $('howtoImg').parentNode.hidden = !d.img && !d.note;
    const v = $('howtoVideo'), sil = $('howtoSil');
    sil.hidden = !d.sil; if (d.sil) sil.src = d.sil;
    v.hidden = !!d.sil;
    $('howtoVtag').hidden = !!d.sil; $('howtoMtag').hidden = !d.sil;
    if (d.sil) { box.classList.remove('no-video'); v.pause(); v.removeAttribute('src'); v.load(); }
    else if (d.video) {
      if (v.getAttribute('src') !== d.video) { v.poster = d.poster || ''; v.src = d.video; }
      box.classList.remove('no-video');
      try { v.currentTime = 0; } catch (e) {}
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    } else { box.classList.add('no-video'); v.removeAttribute('src'); }
    box.classList.add('on'); open = true;
    setTimeout(() => $('howtoGo').focus(), 50);
  }
  function close(kind) {
    if (!open) return;
    box.classList.remove('on'); open = false;
    try { $('howtoVideo').pause(); } catch (e) {}
    const h = handlers; handlers = {};
    if (kind === 'start' && h.onStart) h.onStart();
    if (kind === 'exit' && h.onExit) h.onExit();
  }
  $('howtoGo').addEventListener('click', () => close('start'));
  $('howtoExit').addEventListener('click', () => close('exit'));
  window.addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); $('howtoGo').click(); }
    if (e.key === 'Escape') { e.preventDefault(); $('howtoExit').click(); }
  }, true);

  return { show, close, get isOpen() { return open; } };
})();
