'use strict';
// 쿠키 대탈출 - HTML5 Canvas 러닝 게임 (모든 그래픽/사운드는 코드로 생성한 오리지널 에셋)
const W = 1280, H = 720, GY = 610, TILE = 52;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const FONT = '"Jua","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

/* ---------- 저장 ---------- */
const store = {
  d: { best: 0, coins: 0, char: 0, mute: false },
  load() { try { Object.assign(this.d, JSON.parse(localStorage.getItem('cookieRun') || '{}')); } catch (e) {} },
  save() { try { localStorage.setItem('cookieRun', JSON.stringify(this.d)); } catch (e) {} }
};
store.load();

/* ---------- 오디오 (WebAudio 합성) ---------- */
const audio = {
  ac: null, master: null, step: 0, next: 0,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.gain.value = store.d.mute ? 0 : 0.5;
    this.master.connect(this.ac.destination);
    this.next = this.ac.currentTime + 0.1;
    setInterval(() => this.sched(), 100);
  },
  setMute(m) { store.d.mute = m; store.save(); if (this.master) this.master.gain.value = m ? 0 : 0.5; },
  tone(f, t, dur, type, vol, f2) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  sfx(n, p = 1) {
    if (!this.ac || store.d.mute) return;
    const t = this.ac.currentTime;
    switch (n) {
      case 'jump': this.tone(380, t, .14, 'sine', .25, 760); break;
      case 'jump2': this.tone(520, t, .14, 'sine', .25, 1000); break;
      case 'slide': this.tone(300, t, .12, 'sawtooth', .08, 120); break;
      case 'jelly': this.tone(700 * p, t, .09, 'triangle', .22, 1300 * p); break;
      case 'coin': this.tone(1100, t, .06, 'square', .1); this.tone(1650, t + .06, .12, 'square', .1); break;
      case 'hit': this.tone(220, t, .35, 'sawtooth', .3, 50); break;
      case 'power': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * .06, .12, 'square', .12)); break;
      case 'giant': this.tone(120, t, .5, 'sawtooth', .25, 360); this.tone(90, t, .5, 'square', .12, 200); break;
      case 'speed': this.tone(300, t, .4, 'sawtooth', .15, 1400); break;
      case 'magnet': [700, 900, 1100, 1400].forEach((f, i) => this.tone(f, t + i * .05, .15, 'sine', .2, f * .7)); break;
      case 'shield': this.tone(900, t, .25, 'sine', .22, 1500); this.tone(1200, t + .1, .25, 'sine', .15, 1800); break;
      case 'pop': this.tone(1200, t, .15, 'triangle', .25, 300); break;
      case 'bomb': this.tone(150, t, .6, 'sawtooth', .35, 25); this.tone(60, t, .6, 'square', .3, 20); break;
      case 'smash': this.tone(160, t, .2, 'square', .2, 40); break;
      case 'over': [392, 330, 262, 196].forEach((f, i) => this.tone(f, t + i * .18, .3, 'triangle', .25)); break;
      case 'click': this.tone(600, t, .07, 'square', .1); break;
    }
  },
  sched() {
    if (!this.ac || store.d.mute) { if (this.ac) this.next = Math.max(this.next, this.ac.currentTime); return; }
    const mel = [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 12, 9, 7, 4, 2, 2, 4, 7, 9, 12, 9, 7, 4, 0, 2, 4, 2, 0, -3, 0, 4];
    const sc = n => 261.63 * Math.pow(2, n / 12);
    const bpm = scene === 'play' ? 0.15 : 0.2;
    while (this.next < this.ac.currentTime + 0.3) {
      const i = this.step % 32, t = this.next;
      this.tone(sc(mel[i]), t, bpm * 0.9, 'square', 0.035);
      if (i % 4 === 0) this.tone(sc(mel[i] - 24 + (i % 16 < 8 ? 0 : -2)), t, bpm * 3, 'triangle', 0.1);
      if (i % 2 === 0) this.tone(90, t, .05, 'sine', .08, 60);
      this.step++; this.next += bpm;
    }
  }
};

/* ---------- 유틸 ---------- */
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
function rr(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function text(s, x, y, size, color = '#fff', align = 'center', stroke = '#5A3A22') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = stroke;
  ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function star(x, y, r, col) {
  ctx.fillStyle = col; ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? r * .45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  ctx.closePath(); ctx.fill();
}

/* ---------- 캐릭터 / 아이템 정의 ---------- */
const CHARS = [
  { name: '진저', body: '#e8a050', dark: '#7a4515', cloth: '#e8a050', desc: '균형형 · 더블 점프', magnet: 1, dmg: 1 },
  { name: '베리', body: '#f6cf9c', dark: '#a0623d', cloth: '#ff8fb0', desc: '자석 범위 +20%', magnet: 1.2, dmg: 1 },
  { name: '초코', body: '#8a5a3a', dark: '#3d2210', cloth: '#8a5a3a', desc: '피격 피해 -15%', magnet: 1, dmg: 0.85 }
];
// max: 지속시간(초) / 즉시형은 max 없음
const ITEM = {
  hp:     { name: '체력 포션 +30',   col: '#ff5a8a', lab: '+' },
  giant:  { name: '거대화 물약!',     col: '#a35bff', lab: '▲', max: 7 },
  speed:  { name: '스피드 물약!',     col: '#ff9a1a', lab: '»', max: 5 },
  magnet: { name: '자석 물약!',       col: '#3aa8ff', lab: 'U', max: 6 },
  shield: { name: '보호막!',         col: '#2fd0b0', lab: '◆', max: 12 },
  bomb:   { name: '폭탄!',           col: '#555b66', lab: '!' },
  double: { name: '점수 2배!',       col: '#ffd23f', lab: '×2', max: 10 }
};
const TIMED = ['giant', 'speed', 'magnet', 'shield', 'double'];
const ITEM_W = { hp: 2, giant: 2, speed: 2, magnet: 2, shield: 1.5, bomb: 1, double: 1.5 };

/* ---------- 게임 상태 ---------- */
let scene = 'title';     // title | play | pause | over
let g = null, p = null;
let showHelp = false, tScroll = 0, tClock = 0;
const keys = { jump: false, slide: false };
let buttons = [];
let slidePtr = null, jumpPtrs = new Set();

function startGame() {
  g = {
    t: 0, dist: 0, scroll: 0, speed: 420, spMul: 1, dscore: 0, bonus: 0, coins: 0, jellies: 0, hp: 100,
    ents: [], parts: [], floats: [], sinceSpawn: 0, gap: 520,
    pw: { giant: 0, speed: 0, magnet: 0, shield: 0, double: 0 }, shake: 0, flash: 0, combo: 0, comboT: 0,
    dead: false, deadT: 0, newBest: false, spawnedItems: 0
  };
  p = { x: 220, y: GY, vy: 0, jumps: 0, ground: true, coyote: 0, buf: 0, inv: 0, cut: false, slide: false, run: 0, wasGround: true, sc: 1 };
  scene = 'play';
}

/* ---------- 입력 ---------- */
function pressJump() { audio.init(); if (scene !== 'play') return; keys.jump = true; p.buf = 0.12; }
function releaseJump() { keys.jump = false; }
function tryJump() {
  if (p.y > GY + 6) return false;
  if (p.ground || p.coyote > 0) {
    p.vy = -900; p.jumps = 1; p.coyote = 0; p.cut = false; p.ground = false;
    audio.sfx('jump'); dust(p.x, p.y, 6); return true;
  }
  if (p.jumps < 2) { p.vy = -800; p.jumps = 2; p.cut = true; audio.sfx('jump2'); sparkle(p.x, p.y - 20, '#fff', 8); return true; }
  return false;
}
function togglePause() {
  if (scene === 'play') scene = 'pause'; else if (scene === 'pause') scene = 'play';
}
addEventListener('keydown', e => {
  const c = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
  audio.init();
  if (e.repeat) return;
  if (c === 'KeyM') { audio.setMute(!store.d.mute); return; }
  if (scene === 'title') {
    if (c === 'Enter' || c === 'Space') { audio.sfx('click'); startGame(); }
    if (c === 'ArrowLeft') changeChar(-1);
    if (c === 'ArrowRight') changeChar(1);
    return;
  }
  if (scene === 'over') { if (c === 'Enter' || c === 'Space') { audio.sfx('click'); startGame(); } return; }
  if (c === 'KeyP' || c === 'Escape') { togglePause(); return; }
  if (scene === 'pause') { if (c === 'Enter') scene = 'play'; return; }
  if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') pressJump();
  if (c === 'ArrowDown' || c === 'KeyS') keys.slide = true;
});
addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') releaseJump();
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.slide = false;
});
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); audio.init();
  const { x, y } = toLogical(e);
  for (const b of buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { audio.sfx('click'); b.fn(); return; }
  }
  if (scene === 'play') {
    if (x < W / 2) { keys.slide = true; slidePtr = e.pointerId; }
    else { pressJump(); jumpPtrs.add(e.pointerId); }
  }
});
function ptrUp(e) {
  if (e.pointerId === slidePtr) { keys.slide = false; slidePtr = null; }
  if (jumpPtrs.delete(e.pointerId) && jumpPtrs.size === 0) releaseJump();
}
cv.addEventListener('pointerup', ptrUp);
cv.addEventListener('pointercancel', ptrUp);
cv.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && scene === 'play') scene = 'pause'; });
function changeChar(d) { store.d.char = (store.d.char + d + CHARS.length) % CHARS.length; store.save(); audio.sfx('click'); }

/* ---------- 파티클 ---------- */
function dust(x, y, n) { for (let i = 0; i < n; i++) g.parts.push({ x: x + rand(-14, 6), y, vx: rand(-160, -30), vy: rand(-90, -10), life: .4, max: .4, c: '#e9d9a8', s: rand(4, 8), grav: 200 }); }
function sparkle(x, y, c, n) { for (let i = 0; i < n; i++) { const a = rand(0, 6.28), s = rand(80, 260); g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .5, max: .5, c, s: rand(3, 7), grav: 0 }); } }
function floatText(x, y, t, c) { g.floats.push({ x, y, t, c, life: 1 }); }

/* ---------- 맵 패턴 ---------- */
const JC = ['#3aa8ff', '#ffd23f', '#5bd16b'], JD = ['#1c5fa8', '#b8860b', '#2a8a3a'];
function jelly(x, y, big) {
  if (big) { g.ents.push({ t: 'big', x: x - 20, y: y - 20, w: 40, h: 40 }); return; }
  if (Math.random() < .18) { g.ents.push({ t: 'bear', x: x - 16, y: y - 16, w: 32, h: 32, ci: (Math.random() * 3) | 0 }); return; }
  const ci = Math.random() < .6 ? 0 : (Math.random() * 3) | 0;
  g.ents.push({ t: 'jelly', x: x - 16, y: y - 16, w: 32, h: 32, ci });
}
function coin(x, y) { g.ents.push({ t: 'coin', x: x - 14, y: y - 14, w: 28, h: 28 }); }
function plat(x, y, n) { g.ents.push({ t: 'plat', x, y, w: n * TILE, h: 30 }); line(x + TILE / 2, n, y - 44, TILE); }
function ob(t, x) {
  const o = { spike: { w: 70, h: 56 }, fence: { w: 52, h: 92 }, bat: { w: 64, h: 52 }, gear: { w: 60, h: 60, vx: 150 } }[t];
  const y = t === 'bat' ? GY - 96 : GY - o.h;
  g.ents.push({ t, x, y, w: o.w, h: o.h, vx: o.vx || 0, ph: Math.random() * 6 });
  return o.w;
}
function arc(x0, x1, n, base, hgt) { for (let i = 0; i < n; i++) { const k = i / (n - 1); jelly(x0 + (x1 - x0) * k, base - Math.sin(k * Math.PI) * hgt); } }
function line(x0, n, y, sp = 44) { for (let i = 0; i < n; i++) jelly(x0 + i * sp, y); }
function pickItem() {
  const w = Object.assign({}, ITEM_W); if (g.hp < 55) w.hp *= 2.5;
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'hp';
}
const PATTERNS = [
  { min: 0, f(x) { ob('spike', x + 100); arc(x, x + 270, 7, GY - 40, 140); return 320; } },
  { min: 0, f(x) { ob('fence', x + 60); line(x, 6, GY - 160, 36); return 240; } },
  { min: 0, f(x) { line(x, 8, GY - 30); coin(x + 380, GY - 30); return 400; } },
  { min: 0, f(x) { ob('bat', x + 80); line(x - 20, 8, GY - 30, 40); return 300; } },
  { min: 0, f(x) { const w = 150 + g.speed * .22; g.ents.push({ t: 'pit', x, y: GY, w, h: 110 }); arc(x - 30, x + w + 30, 9, GY - 60, 150); return w; } },
  { min: 0, f(x) { ob('spike', x); ob('spike', x + 90); jelly(x + 45, GY - 200, true); return 200; } },
  { min: 0, f(x) { for (let i = 0; i < 3; i++) coin(x + i * 40, GY - 60); line(x + 40, 6, GY - 30); return 300; } },
  { min: 0, f(x) { plat(x, GY - 150, 6); ob('spike', x + 120); for (let i = 0; i < 4; i++) coin(x + 60 + i * 60, GY - 30); return 330; } },
  { min: 200, f(x) { plat(x, GY - 90, 3); plat(x + 260, GY - 170, 3); plat(x + 520, GY - 240, 3); return 700; } },
  { min: 300, f(x) { ob('spike', x); ob('bat', x + 260); line(x + 90, 4, GY - 170, 40); return 360; } },
  { min: 400, f(x) { const w = 260; g.ents.push({ t: 'pit', x, y: GY, w, h: 110 }); plat(x, GY - 120, 5); return w; } },
  { min: 500, f(x) { ob('gear', x + 200); arc(x, x + 140, 5, GY - 40, 120); return 260; } },
  { min: 800, f(x) { const w = 150 + g.speed * .2; g.ents.push({ t: 'pit', x, y: GY, w, h: 110 }); ob('fence', x + w + 120); return w + 150; } },
  { min: 900, f(x) { plat(x, GY - 170, 7); ob('fence', x + 80); ob('bat', x + 250); for (let i = 0; i < 5; i++) coin(x + 40 + i * 50, GY - 30); return 380; } },
  { min: 1200, f(x) { ob('fence', x); ob('bat', x + 230); ob('spike', x + 470); line(x + 40, 4, GY - 190, 36); return 540; } },
  { min: 1800, f(x) { ob('gear', x); ob('gear', x + 220); jelly(x + 150, GY - 190, true); return 300; } }
];
function spawn() {
  const x = W + 60, m = g.dist / 25;
  if (g.spawnedItems * 300 < m - 120 && Math.random() < .85) {      // 아이템 패턴 (약 300m마다)
    g.ents.push({ t: 'item', k: pickItem(), x, y: GY - 130, w: 44, h: 44 });
    line(x + 70, 5, GY - 130, 40); g.spawnedItems++;
    g.sinceSpawn = 0; g.gap = 420 + g.speed * .4; return;
  }
  const pool = PATTERNS.filter(q => q.min <= m);
  const w = pool[(Math.random() * pool.length) | 0].f(x);
  g.sinceSpawn = 0; g.gap = w + g.speed * rand(.8, 1.25);
}

/* ---------- 업데이트 ---------- */
function mighty() { return g.pw.speed > 0 || g.pw.giant > 0; }
function overPit() {
  if (mighty()) return false;
  for (const e of g.ents) if (e.t === 'pit' && p.x > e.x + 14 && p.x < e.x + e.w - 14) return true;
  return false;
}
function hurt(dmg) {
  if (p.inv > 0) return;
  if (g.pw.shield > 0) { g.pw.shield = 0; p.inv = 1; audio.sfx('pop'); sparkle(p.x, p.y - 45, '#7ff0d8', 18); g.shake = .1; return; }
  g.hp -= dmg * CHARS[store.d.char].dmg; p.inv = 1.5; g.shake = .3; g.combo = 0; audio.sfx('hit');
  sparkle(p.x, p.y - 40, '#ff5a4a', 12);
}
function die() { if (g.dead) return; g.dead = true; g.deadT = 0; p.vy = -600; audio.sfx('over'); }
function playerBox() {
  const sc = p.sc, h = (p.slide ? 34 : 70) * sc, w = 44 * sc;
  return { x: p.x - w / 2, y: p.y - h, w, h };
}
function hitBox(e) {
  switch (e.t) {
    case 'spike': return { x: e.x + 10, y: e.y + 16, w: e.w - 20, h: e.h - 16 };
    case 'fence': return { x: e.x + 6, y: e.y + 4, w: e.w - 12, h: e.h - 4 };
    case 'bat': return { x: e.x + 8, y: e.y + 8, w: e.w - 16, h: e.h - 16 };
    case 'gear': return { x: e.x + 10, y: e.y + 10, w: e.w - 20, h: e.h - 10 };
  }
  return e;
}
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const isOb = e => e.t === 'spike' || e.t === 'fence' || e.t === 'bat' || e.t === 'gear';
function smash(e, mult) {
  e.dead = true; g.bonus += 50 * mult; audio.sfx('smash');
  sparkle(e.x + e.w / 2, e.y + e.h / 2, '#ffe9b8', 12);
}
function applyItem(k, e) {
  const I = ITEM[k], cx = e.x + 22, cy = e.y + 22;
  audio.sfx(k === 'hp' || k === 'double' ? 'power' : k === 'bomb' ? 'bomb' : k);
  sparkle(cx, cy, I.col, 16); floatText(cx - 30, cy - 20, I.name, '#fff');
  if (k === 'hp') g.hp = Math.min(100, g.hp + 30);
  else if (k === 'bomb') {
    const mult = g.pw.double > 0 ? 2 : 1;
    for (const o of g.ents) if (isOb(o) && o.x < W + 40 && o.x + o.w > 0) smash(o, mult);
    g.flash = .7; g.shake = .45;
  } else { g.pw[k] = I.max; if (k === 'giant') g.shake = .25; }
}

function update(dt) {
  g.t += dt;
  for (const q of g.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; }
  g.parts = g.parts.filter(q => q.life > 0);
  for (const f of g.floats) { f.life -= dt; f.y -= 50 * dt; }
  g.floats = g.floats.filter(f => f.life > 0);
  g.shake = Math.max(0, g.shake - dt); g.flash = Math.max(0, g.flash - dt);

  if (g.dead) {
    g.deadT += dt; p.vy += 2400 * dt; p.y += p.vy * dt;
    if (g.deadT > 1.1) endGame();
    return;
  }

  const m = g.dist / 25, pg = g.pw.giant, ps = g.pw.speed;
  for (const k in g.pw) g.pw[k] = Math.max(0, g.pw[k] - dt);
  if ((pg > 0 && g.pw.giant <= 0) || (ps > 0 && g.pw.speed <= 0)) p.inv = Math.max(p.inv, 1.2);
  const fast = g.pw.speed > 0, giant = g.pw.giant > 0, mult = g.pw.double > 0 ? 2 : 1;
  g.spMul += ((fast ? 1.9 : 1) - g.spMul) * Math.min(1, dt * 4);
  g.speed = Math.min(900, 420 + m * .18) * g.spMul;
  const move = g.speed * dt; g.dist += move; g.scroll += move; g.dscore += move / 25 * 10 * mult;
  if (!mighty()) g.hp -= 2.5 * dt;
  g.hp = Math.min(100, g.hp);
  p.inv = Math.max(0, p.inv - dt); g.comboT -= dt; if (g.comboT <= 0) g.combo = 0;
  p.sc += ((giant ? 2.1 : 1) - p.sc) * Math.min(1, dt * 6);

  // 플레이어 물리 (바닥 + 한 방향 발판)
  p.buf -= dt; p.coyote -= dt; p.run += dt * Math.min(g.speed, 700) / 40;
  if (p.buf > 0 && tryJump()) p.buf = 0;
  if (!keys.jump && p.vy < -400 && !p.cut && p.jumps === 1) { p.vy *= .5; p.cut = true; }
  const prevY = p.y;
  p.vy += 2400 * dt; p.y += p.vy * dt;
  p.wasGround = p.ground; p.ground = false;
  if (p.vy >= 0) {
    let land = null;
    for (const e of g.ents) if (e.t === 'plat' && p.x > e.x - 8 && p.x < e.x + e.w + 8 && prevY <= e.y + 2 && p.y >= e.y) { land = e.y; break; }
    if (land === null && p.y >= GY && !overPit()) land = GY;
    if (land !== null) {
      p.y = land; p.vy = 0; p.ground = true; p.jumps = 0; p.cut = false; p.coyote = .1;
      if (!p.wasGround) { dust(p.x, p.y, giant ? 14 : 5); if (giant) g.shake = Math.max(g.shake, .12); }
    }
  }
  if (!p.ground && p.coyote <= 0 && p.jumps === 0) p.jumps = 1;
  const wasSlide = p.slide;
  p.slide = keys.slide && p.ground && !giant;
  if (p.slide && !wasSlide) audio.sfx('slide');
  if (p.slide && Math.random() < .5) dust(p.x - 10, p.y, 1);
  if (p.y > GY + 90) { g.hp = 0; die(); return; }
  if (fast && Math.random() < .8) g.parts.push({ x: p.x - 24, y: p.y - 30 + rand(-30, 30), vx: -380, vy: rand(-30, 30), life: .35, max: .35, c: Math.random() < .5 ? '#ffb020' : '#fff1a8', s: rand(6, 13), grav: 0 });

  g.sinceSpawn += move;
  if (g.sinceSpawn >= g.gap) spawn();

  // 엔티티
  const pb = playerBox(), cx = pb.x + pb.w / 2, cy = pb.y + pb.h / 2, CH = CHARS[store.d.char];
  const pull = g.pw.magnet > 0 ? 720 * CH.magnet : fast ? 420 : 0;
  for (const e of g.ents) {
    e.x -= move + (e.vx || 0) * dt;
    if (e.t === 'pit' || e.t === 'plat') continue;
    if (e.t === 'jelly' || e.t === 'bear' || e.t === 'big' || e.t === 'coin') {
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2, d = Math.hypot(cx - ex, cy - ey);
      if (pull && d < pull) {
        const s = (1500 * dt + (1 - d / pull) * 900 * dt) / Math.max(d, 1);
        if (g.pw.magnet > 0 && Math.random() < .25) g.parts.push({ x: ex, y: ey, vx: 0, vy: 0, life: .2, max: .2, c: '#8fd0ff', s: 5, grav: 0 });
        e.x += (cx - ex) * Math.min(s, 1); e.y += (cy - ey) * Math.min(s, 1);
      }
    }
    if (e.dead || !hit(pb, hitBox(e))) continue;
    switch (e.t) {
      case 'jelly': case 'bear': case 'big': {
        e.dead = true; g.jellies++; g.combo++; g.comboT = 1.5;
        const base = e.t === 'big' ? 500 : e.t === 'bear' ? 200 : 100;
        const cm = 1 + Math.min(g.combo, 30) / 30, pts = Math.round(base * cm * mult);
        g.bonus += pts; g.hp = Math.min(100, g.hp + (e.t === 'big' ? 6 : e.t === 'bear' ? 2 : .8));
        audio.sfx('jelly', 1 + Math.min(g.combo, 12) * .04);
        sparkle(e.x + 16, e.y + 16, e.t === 'jelly' ? JC[e.ci] : '#ffd1f0', e.t === 'big' ? 10 : 4);
        if (e.t !== 'jelly') floatText(e.x, e.y, '+' + pts, '#ffd23f');
        break;
      }
      case 'coin': e.dead = true; g.coins++; audio.sfx('coin'); sparkle(e.x + 14, e.y + 14, '#e6edf5', 5); break;
      case 'item': e.dead = true; applyItem(e.k, e); break;
      default:
        if (isOb(e)) { if (mighty()) smash(e, mult), g.shake = Math.max(g.shake, giant ? .2 : .1); else hurt(20); }
    }
  }
  g.ents = g.ents.filter(e => !e.dead && e.x + e.w > -120);
  if (g.hp <= 0) { g.hp = 0; die(); }
}
function endGame() {
  const score = curScore();
  g.newBest = score > store.d.best;
  if (g.newBest) store.d.best = score;
  store.d.coins += g.coins; store.save();
  g.finalScore = score; scene = 'over';
}
const curScore = () => Math.floor(g.dscore) + g.bonus;

/* ---------- 배경 (정글 / 천년나무 사원 / 꽃 언덕) ---------- */
const THEMES = [
  { name: '정글 숲', dirt: '#c47a35', dirt2: '#8f5421', grass: '#5cc43a', grassD: '#2d7a1c', under: '#10281a', void: '#04100a' },
  { name: '천년나무 사원', dirt: '#a6703f', dirt2: '#734a26', grass: '#6bc94a', grassD: '#2f7a28', under: '#12302a', void: '#04130f' },
  { name: '꽃 언덕', dirt: '#d4903f', dirt2: '#9c6a28', grass: '#9edf3d', grassD: '#4f9a1c', under: '#2f4a14', void: '#1a2a08' }
];
const themeAt = m => m < 1000 ? 0 : m < 2500 ? 1 : 2;
function stageInfo(m) {
  const i = themeAt(m), frac = i === 0 ? m / 1000 : i === 1 ? (m - 1000) / 1500 : ((m - 2500) % 1500) / 1500;
  return { i, frac: clamp(frac, 0, 1), name: THEMES[i].name };
}
function leaf(x, y, len, w, ang, col, vein) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(w, len * .45, 0, len); ctx.quadraticCurveTo(-w, len * .45, 0, 0); ctx.fill();
  ctx.strokeStyle = vein; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, len * .92); ctx.stroke();
  ctx.restore();
}
function canopy(sc, sp, spacing, col, vein, lmin, lmax) {
  const off = sc * sp, i0 = Math.floor(off / spacing);
  for (let k = -1; k < W / spacing + 2; k++) {
    const idx = i0 + k, x = k * spacing - (off % spacing) + hash(idx) * 40, r = hash(idx + 7);
    leaf(x, -14, lmin + r * (lmax - lmin), 34 + hash(idx + 3) * 26, .35 - hash(idx + 5) * .7 + Math.sin(tClock * 1.3 + idx) * .05, col, vein);
  }
}
function drift(sc, col, n) {
  ctx.fillStyle = col;
  for (let k = 0; k < n; k++) {
    const x = (((hash(k) * 1500 - sc * .25 - tClock * 25) % 1400) + 1400) % 1400 - 60;
    const y = (hash(k + 30) * 500 + tClock * (30 + hash(k) * 30)) % (GY - 40) + Math.sin(tClock * 1.5 + k) * 18;
    ctx.save(); ctx.translate(x, y); ctx.rotate(tClock + k); ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, 7); ctx.fill(); ctx.restore();
  }
}
function bgJungle(sc) {
  const gr = ctx.createLinearGradient(0, 0, 0, GY); gr.addColorStop(0, '#1a6a3a'); gr.addColorStop(.55, '#4bab4a'); gr.addColorStop(1, '#a6dc62');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,220,.12)';                       // 햇살
  for (let k = 0; k < 4; k++) { const x = 180 + k * 300 + Math.sin(tClock * .4 + k) * 30; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x - 140, GY); ctx.lineTo(x - 260, GY); ctx.fill(); }
  const o1 = sc * .08, s1 = 330, i1 = Math.floor(o1 / s1);                // 먼 나무 기둥
  for (let k = -1; k < W / s1 + 2; k++) {
    const x = k * s1 - (o1 % s1) + hash(i1 + k) * 80, w = 70 + hash(i1 + k + 2) * 40;
    ctx.fillStyle = '#1d6034'; ctx.fillRect(x, 0, w, GY); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + w * .65, 0, w * .35, GY);
  }
  canopy(sc, .15, 140, '#1f7a38', '#155a28', 160, 260);
  canopy(sc, .35, 190, '#3aa84a', '#237a34', 110, 200);
  const o3 = sc * .5, s3 = 130, i3 = Math.floor(o3 / s3);                 // 덤불
  for (let k = -1; k < W / s3 + 2; k++) {
    const x = k * s3 - (o3 % s3), r = hash(i3 + k);
    ctx.fillStyle = '#2b8a3a'; ctx.beginPath(); ctx.arc(x, GY - 6, 46 + r * 18, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#48b04c'; ctx.beginPath(); ctx.arc(x + 20, GY - 14, 28 + r * 10, Math.PI, 0); ctx.fill();
  }
  drift(sc, 'rgba(230,255,170,.8)', 12);
}
function bgTemple(sc) {
  const gr = ctx.createLinearGradient(0, 0, 0, GY); gr.addColorStop(0, '#3f9a8a'); gr.addColorStop(.6, '#9ad2a8'); gr.addColorStop(1, '#dff0bf');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  const o1 = sc * .1, s1 = 700, i1 = Math.floor(o1 / s1);                 // 먼 사원 아치
  for (let k = -1; k < W / s1 + 2; k++) {
    const x = k * s1 - (o1 % s1) + 100;
    ctx.fillStyle = 'rgba(86,140,120,.75)'; ctx.fillRect(x, 160, 420, GY - 160);
    ctx.beginPath(); ctx.arc(x + 210, 160, 210, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(170,215,190,.7)'; ctx.beginPath(); ctx.arc(x + 210, 300, 100, Math.PI, 0); ctx.fillRect(x + 110, 300, 200, GY - 300); ctx.fill();
  }
  canopy(sc, .15, 150, '#2e8a58', '#1f6a40', 120, 200);
  const o2 = sc * .3, s2 = 360, i2 = Math.floor(o2 / s2);                 // 조각 기둥 + 덩굴
  for (let k = -1; k < W / s2 + 2; k++) {
    const x = k * s2 - (o2 % s2) + hash(i2 + k) * 60, bw = 100;
    for (let by = GY - 96; by > -90; by -= 96) {
      ctx.fillStyle = '#9a5f3a'; ctx.strokeStyle = '#5e3a20'; ctx.lineWidth = 4; rr(x, by, bw, 96, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#b8794a'; rr(x + 14, by + 14, bw - 28, 68, 8); ctx.fill();
      ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.arc(x + bw / 2, by + 48, 14, 0, 7); ctx.fill(); ctx.fillStyle = '#b8794a'; ctx.beginPath(); ctx.arc(x + bw / 2, by + 48, 6, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = '#d8efc4'; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.beginPath();
    for (let y = -10; y <= GY; y += 10) { const vx = x + bw / 2 + Math.sin(y / 38 + hash(i2 + k) * 6) * (bw / 2 + 8); y < 0 ? ctx.moveTo(vx, y) : ctx.lineTo(vx, y); }
    ctx.stroke();
    for (let y = 40; y < GY; y += 90) { const vx = x + bw / 2 + Math.sin(y / 38 + hash(i2 + k) * 6) * (bw / 2 + 8); leaf(vx, y, 34, 12, 1.2, '#7fcf6a', '#3a8a36'); }
  }
  canopy(sc, .4, 200, '#3aa860', '#237a45', 90, 170);
  drift(sc, 'rgba(255,255,255,.7)', 10);
}
function bgMeadow(sc) {
  const gr = ctx.createLinearGradient(0, 0, 0, GY); gr.addColorStop(0, '#a9dc5a'); gr.addColorStop(.6, '#dff0a0'); gr.addColorStop(1, '#fbfbd0');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(900, 120, 10, 900, 120, 320); rg.addColorStop(0, 'rgba(255,255,230,.95)'); rg.addColorStop(1, 'rgba(255,255,230,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, GY);
  [['#b5e062', .08, 190, 70, 130], ['#8fd04a', .2, 120, 55, 90]].forEach(([c, sp, base, a1, a2]) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, GY); const o = sc * sp;
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, GY - base - Math.sin((x + o) / a2) * a1 * .5 - Math.sin((x + o) / 47) * 12);
    ctx.lineTo(W, GY); ctx.fill();
  });
  const o3 = sc * .4, s3 = 170, i3 = Math.floor(o3 / s3);                 // 큰 데이지
  for (let k = -1; k < W / s3 + 2; k++) {
    const x = k * s3 - (o3 % s3) + hash(i3 + k) * 50, r = hash(i3 + k + 4), fy = GY - 70 - r * 150, sw = Math.sin(tClock * 1.4 + k) * 4;
    ctx.strokeStyle = '#4f9a2a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, GY); ctx.quadraticCurveTo(x + sw, (GY + fy) / 2, x + sw, fy); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d9e0b0'; ctx.lineWidth = 2;
    for (let a = 0; a < 8; a++) { ctx.save(); ctx.translate(x + sw, fy); ctx.rotate(a * Math.PI / 4 + r); ctx.beginPath(); ctx.ellipse(0, -20, 8, 17, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = '#ffc928'; ctx.beginPath(); ctx.arc(x + sw, fy, 10, 0, 7); ctx.fill();
  }
  drift(sc, 'rgba(255,255,255,.9)', 14); drift(sc + 400, 'rgba(255,170,200,.8)', 8);
}
function drawGround(i, sc) {
  const T = THEMES[i];
  ctx.fillStyle = T.under; ctx.fillRect(0, GY, W, H - GY);
  const off = sc % TILE;
  for (let x = -off - TILE; x < W + TILE; x += TILE) {
    ctx.fillStyle = T.dirt; rr(x + 1, GY + 4, TILE - 2, 66, 6); ctx.fill();
    ctx.fillStyle = T.dirt2; ctx.fillRect(x + 6, GY + 38, TILE - 12, 5); ctx.beginPath(); ctx.arc(x + 14, GY + 26, 3.5, 0, 7); ctx.arc(x + 38, GY + 56, 3.5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 3; rr(x + 1, GY + 4, TILE - 2, 66, 6); ctx.stroke();
    ctx.fillStyle = T.grass; rr(x - 1, GY - 8, TILE + 2, 24, 9); ctx.fill();
    ctx.strokeStyle = T.grassD; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(x + 6, GY - 5, TILE - 14, 5, 2.5); ctx.fill();
  }
}
function drawTheme(i, a, sc) {
  ctx.globalAlpha = a;
  [bgJungle, bgTemple, bgMeadow][i](sc);
  drawGround(i, sc);
  ctx.globalAlpha = 1;
}
function drawBackground(m, sc) {
  const i = themeAt(m), bd = i === 0 ? 1000 : 2500, blend = i < 2 ? clamp((m - (bd - 100)) / 100, 0, 1) : 0;
  drawTheme(i, 1, sc);
  if (i < 2 && blend > 0) drawTheme(i + 1, blend, sc);
}

/* ---------- 스프라이트 그리기 ---------- */
function limb(x0, y0, x1, y1, w, col, dk, band) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = dk; ctx.lineWidth = w + 6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  if (band) {
    const lx = a => x0 + (x1 - x0) * a, ly = a => y0 + (y1 - y0) * a;
    ctx.lineCap = 'butt'; ctx.strokeStyle = band; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(lx(.58), ly(.58)); ctx.lineTo(lx(.8), ly(.8)); ctx.stroke();
  }
}
function drawCookie(x, y, sc, st, ph, ci, alpha) {
  const C = CHARS[ci], s = Math.sin(ph), c = Math.cos(ph);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(sc * .82, sc * .82); ctx.lineJoin = 'round';
  let fA, fB, hA, hB, bob = 0;
  if (st === 'run') { fA = [-6 + s * 16, -5 - Math.max(0, c) * 10]; fB = [6 - s * 16, -5 - Math.max(0, -c) * 10]; hA = [-24 - s * 12, -24]; hB = [24 + s * 12, -26]; bob = -Math.abs(s) * 4; }
  else if (st === 'jump') { fA = [-12, -9]; fB = [14, -16]; hA = [-28, -60]; hB = [30, -62]; }
  else if (st === 'slide') { fA = [-6, -5]; fB = [14, -7]; hA = [-26, -24]; hB = [28, -30]; }
  else { fA = [-14, -6]; fB = [14, -6]; hA = [-30, -30]; hB = [30, -30]; ctx.rotate(ph * .3); }
  if (st === 'slide') { ctx.translate(0, -8); ctx.rotate(-1.25); ctx.translate(0, 22); }
  if (st === 'dead') { ctx.translate(0, -40); ctx.rotate(ph); ctx.translate(0, 40); }
  ctx.translate(0, bob);
  const dk = C.dark;
  // 뒤쪽 장식 (머리카락 / 목도리 꼬리)
  if (ci === 1) { ctx.fillStyle = '#ff8fb0'; ctx.strokeStyle = '#b84a72'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(-36 + Math.sin(ph) * 3, -58, 12, 24, .35, 0, 7); ctx.fill(); ctx.stroke(); }
  if (ci === 2) { ctx.fillStyle = '#e8453c'; ctx.strokeStyle = '#8a1a14'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -48); ctx.lineTo(-46, -50 + Math.sin(ph * 1.5) * 7); ctx.lineTo(-44, -38 + Math.sin(ph * 1.5) * 7); ctx.lineTo(-12, -40); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  limb(-19, -42, hA[0], hA[1], 11, C.body, dk, '#fff');                 // 뒤 팔
  limb(-7, -18, fA[0], fA[1], 12, C.body, dk, '#fff');                  // 다리
  limb(7, -18, fB[0], fB[1], 12, C.body, dk, '#fff');
  // 몸통
  ctx.lineWidth = 3.5; ctx.strokeStyle = dk;
  if (ci === 1) { ctx.fillStyle = C.cloth; ctx.beginPath(); ctx.moveTo(-16, -46); ctx.lineTo(16, -46); ctx.lineTo(24, -12); ctx.lineTo(-24, -12); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else { ctx.fillStyle = C.body; rr(-17, -46, 34, 32, 11); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -36, 3.6, 0, 7); ctx.arc(0, -25, 3.6, 0, 7); ctx.fill();
  // 머리
  ctx.fillStyle = C.body; ctx.strokeStyle = dk; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(2, -70, 40, 33, 0, 0, 7); ctx.fill(); ctx.stroke();
  if (ci === 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-26, -92); for (let k = 0; k < 6; k++) ctx.lineTo(-26 + (k + 1) * 8, -92 + (k % 2 ? -3 : 3) - Math.abs(k - 2.5) * 1.3); ctx.stroke(); }
  if (ci === 1) {
    ctx.fillStyle = '#ff8fb0'; ctx.strokeStyle = '#b84a72'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(2, -76, 40, 27, 0, Math.PI, 0); ctx.lineTo(42, -72); for (let k = 0; k < 5; k++) ctx.quadraticCurveTo(36 - k * 17, -60, 42 - (k + 1) * 17, -72); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let a = 0; a < 5; a++) { ctx.save(); ctx.translate(-18, -98); ctx.rotate(a * 1.2566); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d98aa8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -7, 5.5, 8, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = '#ffc928'; ctx.beginPath(); ctx.arc(-18, -98, 4.5, 0, 7); ctx.fill();
  }
  if (ci === 2) {
    ctx.fillStyle = '#e8c9a0'; [[-20, -88], [-2, -96], [20, -90], [32, -76]].forEach(([a, b]) => { rr(a - 6, b - 4.5, 12, 9, 3); ctx.fill(); });
    ctx.fillStyle = '#e8453c'; ctx.strokeStyle = '#8a1a14'; ctx.lineWidth = 3; rr(-20, -46, 40, 11, 5); ctx.fill(); ctx.stroke();
  }
  // 얼굴
  if (st === 'dead') { ctx.strokeStyle = '#2b1810'; ctx.lineWidth = 3.5; [[-8, -72], [16, -72]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a - 5, b - 5); ctx.lineTo(a + 5, b + 5); ctx.moveTo(a + 5, b - 5); ctx.lineTo(a - 5, b + 5); ctx.stroke(); }); }
  else { ctx.fillStyle = '#2b1810'; [[-8, -72], [16, -72]].forEach(([a, b]) => { ctx.beginPath(); ctx.ellipse(a, b, 5.5, 8, 0, 0, 7); ctx.fill(); }); ctx.fillStyle = '#fff'; [[-9.5, -75], [14.5, -75]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 2.4, 0, 7); ctx.fill(); }); }
  ctx.fillStyle = 'rgba(255,90,110,.45)'; ctx.beginPath(); ctx.ellipse(-20, -60, 6, 4, 0, 0, 7); ctx.ellipse(30, -60, 6, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#7a1f1f'; ctx.strokeStyle = '#2b1810'; ctx.lineWidth = 3; ctx.beginPath();
  if (st === 'jump' || st === 'dead') ctx.ellipse(4, -56, 6, 7, 0, 0, 7); else ctx.arc(4, -61, 10, .1, Math.PI - .1);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 앞 팔
  limb(19, -42, hB[0], hB[1], 11, C.body, dk, '#fff');
  if (ci === 0 && st !== 'slide') {                                      // 사탕 지팡이
    ctx.save(); ctx.translate(hB[0], hB[1]); ctx.rotate(.35 + (st === 'run' ? -s * .25 : 0)); ctx.lineCap = 'round';
    ctx.strokeStyle = '#7a1a1a'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -38); ctx.arc(8, -38, 8, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#e8453c'; ctx.setLineDash([7, 8]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.restore();
}
function bean(ci, s) {
  ctx.fillStyle = JC[ci]; ctx.strokeStyle = JD[ci]; ctx.lineWidth = 3; rr(-9 * s, -15 * s, 18 * s, 30 * s, 9 * s); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(-5 * s, -11 * s, 5 * s, 12 * s, 2.5 * s); ctx.fill();
}
function bear(col, s, wings, t) {
  if (wings) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#9ac8ff'; ctx.lineWidth = 2.5;
    [-1, 1].forEach(d => { ctx.save(); ctx.rotate(d * (.5 + Math.sin(t * 12) * .25)); ctx.beginPath(); ctx.ellipse(d * 20 * s, -4 * s, 14 * s, 6 * s, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); });
  }
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(70,40,30,.85)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(-10 * s, -11 * s, 6 * s, 0, 7); ctx.arc(10 * s, -11 * s, 6 * s, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 14 * s, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(0, 4 * s, 7 * s, 5 * s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.arc(-5 * s, -3 * s, 1.8 * s, 0, 7); ctx.arc(5 * s, -3 * s, 1.8 * s, 0, 7); ctx.arc(0, 3 * s, 1.8 * s, 0, 7); ctx.fill();
}
function flytrap(cx, base, ph, t) {
  ctx.save(); ctx.translate(cx, base);
  ctx.strokeStyle = '#2b7a2f'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.stroke();
  leaf(0, -4, 16, 8, 1.1, '#3dad3d', '#1f6a24'); leaf(0, -4, 16, 8, -1.1, '#3dad3d', '#1f6a24');
  const open = .35 + (.5 + .5 * Math.sin(t * 5 + ph)) * .5;
  [-1, 1].forEach(d => {
    ctx.save(); ctx.translate(0, -22); ctx.rotate(d * open);
    ctx.fillStyle = '#4dc24a'; ctx.strokeStyle = '#1f5a24'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -16, 11, 20, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d8353b'; ctx.beginPath(); ctx.ellipse(-d * 3, -16, 6, 15, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-d * 10, -26 + k * 9); ctx.lineTo(-d * 4, -22 + k * 9); ctx.lineTo(-d * 10, -18 + k * 9); ctx.fill(); }
    ctx.restore();
  });
  ctx.restore();
}
function drawEnt(e) {
  const t = g ? g.t : tClock;
  ctx.save();
  switch (e.t) {
    case 'plat':
      for (let k = 0; k < e.w / TILE; k++) {
        const x = e.x + k * TILE;
        ctx.fillStyle = '#c47a35'; rr(x + 1, e.y + 6, TILE - 2, 26, 6); ctx.fill(); ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#8f5421'; ctx.fillRect(x + 8, e.y + 20, TILE - 16, 4);
        ctx.fillStyle = '#5cc43a'; rr(x - 1, e.y - 6, TILE + 2, 20, 8); ctx.fill(); ctx.strokeStyle = '#2d7a1c'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(x + 6, e.y - 3, TILE - 14, 4, 2); ctx.fill();
      }
      break;
    case 'jelly': ctx.translate(e.x + 16, e.y + 16 + Math.sin(t * 6 + e.x * .02) * 3); ctx.rotate(.5 + Math.sin(t * 4 + e.x * .01) * .15); bean(e.ci, 1); break;
    case 'bear': ctx.translate(e.x + 16, e.y + 16 + Math.sin(t * 6 + e.x * .02) * 3); bear(['#ffd23f', '#ff8fb8', '#6ecbff'][e.ci], 1, false, t); break;
    case 'big': {
      ctx.translate(e.x + 20, e.y + 20 + Math.sin(t * 5 + e.x * .02) * 4);
      const gr = ctx.createRadialGradient(0, 0, 2, 0, 0, 24); gr.addColorStop(0, '#ffe3f6'); gr.addColorStop(.6, '#d9a8ff'); gr.addColorStop(1, '#8fb8ff');
      bear(gr, 1.5, true, t); break;
    }
    case 'coin':
      ctx.translate(e.x + 14, e.y + 14); ctx.scale(Math.abs(Math.cos(t * 4 + e.x * .01)) * .8 + .2, 1);
      ctx.fillStyle = '#dfe6ee'; ctx.strokeStyle = '#7a8594'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#aab4c2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke(); star(0, 0, 6, '#8d99a8');
      break;
    case 'item': {
      const I = ITEM[e.k], by = Math.sin(t * 4) * 6;
      ctx.translate(e.x + 22, e.y + 22 + by);
      const gl = ctx.createRadialGradient(0, 0, 8, 0, 0, 44 + Math.sin(t * 6) * 3); gl.addColorStop(0, 'rgba(255,255,255,.7)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 48, 0, 7); ctx.fill();
      potion(I.col, I.lab); break;
    }
    case 'spike': flytrap(e.x + 18, e.y + e.h, e.ph, t); flytrap(e.x + 52, e.y + e.h, e.ph + 1.7, t); break;
    case 'fence': {
      ctx.translate(e.x, e.y); const hh = e.h / 3;
      for (let k = 0; k < 3; k++) {
        const y = e.h - (k + 1) * hh;
        const gr = ctx.createLinearGradient(0, y, 0, y + hh); gr.addColorStop(0, '#ffc93a'); gr.addColorStop(1, '#e08f10');
        ctx.fillStyle = gr; ctx.strokeStyle = '#5a3a10'; ctx.lineWidth = 3; rr(0, y, e.w, hh + 2, 13); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6a3b10'; [[14, 15], [36, 15]].forEach(([a, b]) => { ctx.beginPath(); for (let q = 0; q < 6; q++) ctx.lineTo(a + Math.cos(q * 1.047) * 6.5, y + b + Math.sin(q * 1.047) * 6.5); ctx.closePath(); ctx.fill(); });
      }
      leaf(e.w / 2 - 6, 2, 22, 9, .7, '#4dc24a', '#1f6a24'); leaf(e.w / 2 + 6, 2, 22, 9, -.7, '#4dc24a', '#1f6a24');
      break;
    }
    case 'bat': {
      ctx.translate(e.x + 32, e.y + 26 + Math.sin(t * 5 + e.ph) * 5); const f = Math.sin(t * 40 + e.ph);
      ctx.fillStyle = 'rgba(220,240,255,.8)'; ctx.strokeStyle = '#6a8aa8'; ctx.lineWidth = 2.5;
      [-1, 1].forEach(d => { ctx.save(); ctx.translate(d * 6, -10); ctx.rotate(d * (.6 + f * .35)); ctx.beginPath(); ctx.ellipse(d * 14, 0, 18, 9, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); });
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#4a3010'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 2, 22, 16, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a2418'; ctx.fillRect(-4, -13, 6, 29); ctx.fillRect(8, -11, 6, 25);
      ctx.beginPath(); ctx.moveTo(22, 4); ctx.lineTo(32, 0); ctx.lineTo(22, -2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-14, -2, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#2b1810'; ctx.beginPath(); ctx.arc(-13, -1, 2.5, 0, 7); ctx.fill();
      break;
    }
    case 'gear': {
      ctx.translate(e.x + 30, e.y + 30); ctx.rotate(-t * 7); ctx.fillStyle = '#d9a35a'; ctx.strokeStyle = '#5a3418'; ctx.lineWidth = 3;
      ctx.beginPath(); for (let k = 0; k < 20; k++) { const a = k * Math.PI / 10, r = k % 2 ? 22 : 32; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8a4b1f'; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-7, -3, 5, 0, 7); ctx.arc(7, -3, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#2b1810'; ctx.beginPath(); ctx.arc(-6, -2, 2.4, 0, 7); ctx.arc(8, -2, 2.4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#2b1810'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(-3, -6); ctx.moveTo(12, -10); ctx.lineTo(3, -6); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
function potion(col, lab) {                       // 물약 병 (원점 기준)
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#8a5a30'; ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 3; rr(-6, -29, 12, 8, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(235,245,255,.95)'; rr(-6, -23, 12, 10, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(235,245,255,.95)'; ctx.beginPath(); ctx.arc(0, 4, 20, 0, 7); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 4, 17, 0, 7); ctx.clip();
  ctx.fillStyle = col; ctx.fillRect(-20, -4, 40, 30);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-20, -4, 40, 4); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(-9, -2, 3, 6, .5, 0, 7); ctx.fill();
  ctx.font = `bold 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3;
  ctx.strokeText(lab, 0, 10); ctx.fillText(lab, 0, 10);
}
function drawPits() {
  const T = THEMES[themeAt(g.dist / 25)];
  for (const e of g.ents) if (e.t === 'pit') {
    const gr = ctx.createLinearGradient(0, GY - 8, 0, H); gr.addColorStop(0, T.void); gr.addColorStop(1, '#000');
    ctx.fillStyle = gr; ctx.fillRect(e.x, GY - 10, e.w, H - GY + 10);
    ctx.fillStyle = T.grass; rr(e.x - 6, GY - 8, 14, 20, 7); ctx.fill(); rr(e.x + e.w - 8, GY - 8, 14, 20, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.1)'; for (let k = 0; k < 4; k++) ctx.fillRect(e.x + 14 + k * (e.w / 4), GY + 24 + (k % 2) * 28, 3, 16);
  }
}

/* ---------- 화면 그리기 ---------- */
function btn(x, y, w, h, label, fn, col = '#ff8a3d') {
  buttons.push({ x, y, w, h, fn });
  ctx.fillStyle = 'rgba(70,40,20,.9)'; rr(x + 3, y + 6, w, h, h / 2); ctx.fill();
  ctx.fillStyle = col; rr(x, y, w, h, h / 2); ctx.fill(); ctx.strokeStyle = '#5A3A22'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(x + 10, y + 6, w - 20, h / 3, h / 6); ctx.fill();
  text(label, x + w / 2, y + h / 2 + 2, h * .5);
}
function soundBtn() {
  const x = W - 70, y = 18;
  buttons.push({ x, y, w: 52, h: 52, fn: () => audio.setMute(!store.d.mute) });
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(x + 26, y + 26, 26, 0, 7); ctx.fill();
  text(store.d.mute ? '🔇' : '🔊', x + 26, y + 28, 26, '#fff', 'center', 'transparent');
}
function coinIcon(x, y, r) {
  ctx.fillStyle = '#dfe6ee'; ctx.strokeStyle = '#6f7b8a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke(); star(x, y, r * .55, '#8d99a8');
}
function bigBtn(cx, label, pressed) {
  ctx.fillStyle = pressed ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(cx, 648, 112, 58, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 4; ctx.stroke();
  text(label, cx, 648, 46, '#fff', 'center', 'rgba(0,0,0,.6)');
}
function drawHUD() {
  const st = stageInfo(g.dist / 25);
  // 좌상단: 코인 / 거리
  coinIcon(44, 48, 17); text(String(g.coins), 72, 48, 36, '#fff', 'left');
  text(Math.floor(g.dist / 25) + ' m', 30, 92, 28, '#fff', 'left');
  // 상단 중앙: 하트 메달 + HP 바
  const bx = 330, by = 30, bw = 500, bh = 34, hw = (bw - 8) * g.hp / 100;
  ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(bx, by, bw, bh, 17); ctx.fill();
  if (hw > 6) {
    const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    if (g.hp < 30 && Math.floor(g.t * 6) % 2) { gr.addColorStop(0, '#ff3b30'); gr.addColorStop(1, '#ff8a80'); } else { gr.addColorStop(0, '#ff6a00'); gr.addColorStop(1, '#ffd23f'); }
    ctx.fillStyle = gr; rr(bx + 4, by + 4, hw, bh - 8, 13); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(bx + 10, by + 7, Math.max(0, hw - 12), 7, 3.5); ctx.fill();
  }
  ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 4; rr(bx, by, bw, bh, 17); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(bx - 8, by + 17, 27, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8203c'; ctx.beginPath(); ctx.moveTo(bx - 8, by + 30); ctx.bezierCurveTo(bx - 34, by + 12, bx - 20, by - 2, bx - 8, by + 8); ctx.bezierCurveTo(bx + 4, by - 2, bx + 18, by + 12, bx - 8, by + 30); ctx.fill();
  // 진행도
  const ty = 86; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, ty); ctx.lineTo(bx + bw, ty); ctx.stroke();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx, ty); ctx.lineTo(bx + bw * st.frac, ty); ctx.stroke();
  ctx.fillStyle = CHARS[store.d.char].body; ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx + bw * st.frac, ty, 9, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8453c'; ctx.fillRect(bx + bw, ty - 14, 3, 18); ctx.fillRect(bx + bw, ty - 14, 14, 8);
  text(`Stage 1-${st.i + 1}  ${st.name}`, bx, 110, 22, '#ffd23f', 'left');
  // 우상단: 점수 (콩젤리 아이콘)
  const sTxt = String(curScore()); ctx.font = `46px ${FONT}`; const tw = ctx.measureText(sTxt).width;
  text(sTxt, W - 100, 48, 46, '#fff', 'right');
  ctx.save(); ctx.translate(W - 100 - tw - 28, 48); ctx.rotate(.5); bean(0, 1.1); ctx.restore();
  if (g.combo >= 5) text(`콤보 ${g.combo}  x${(1 + Math.min(g.combo, 30) / 30).toFixed(1)}`, W - 100, 92, 26, '#ffd23f', 'right');
  if (g.pw.double > 0) text('점수 ×2', W - 100, 128, 24, '#ffd23f', 'right');
  // 일시정지
  buttons.push({ x: W - 70, y: 150, w: 52, h: 52, fn: togglePause });
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(W - 44, 176, 26, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(W - 54, 164, 8, 24); ctx.fillRect(W - 40, 164, 8, 24);
  // 활성 아이템 (하단 중앙)
  const act = TIMED.filter(k => g.pw[k] > 0);
  act.forEach((k, i) => {
    const x = W / 2 + (i - (act.length - 1) / 2) * 76, y = 650, I = ITEM[k];
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(x, y, 31, 0, 7); ctx.fill();
    ctx.fillStyle = I.col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 23, 0, 7); ctx.fill(); ctx.stroke();
    text(I.lab, x, y + 1, 24);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + 6.283 * g.pw[k] / I.max); ctx.stroke();
  });
  // 점프/슬라이드 버튼
  bigBtn(130, 'Slide', keys.slide); bigBtn(W - 130, 'Jump', keys.jump);
  for (const f of g.floats) { ctx.globalAlpha = clamp(f.life * 2, 0, 1); text(f.t, f.x, f.y, 30, f.c); ctx.globalAlpha = 1; }
}
function drawOverlay(a) { ctx.fillStyle = `rgba(20,30,10,${a})`; ctx.fillRect(0, 0, W, H); }

function drawEffects() {
  const fast = g.pw.speed > 0, mag = g.pw.magnet > 0, giant = g.pw.giant > 0;
  if (fast) {                                                 // 속도선 + 주황 비네트
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3;
    for (let k = 0; k < 16; k++) { const y = (hash(k) * H + g.t * 0) % H, x = ((hash(k + 20) * W - g.t * 2600) % (W + 400) + W + 400) % (W + 400) - 200; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 140 + hash(k + 40) * 120, y); ctx.stroke(); }
    const gr = ctx.createRadialGradient(W / 2, H / 2, 360, W / 2, H / 2, 780); gr.addColorStop(0, 'rgba(255,150,0,0)'); gr.addColorStop(1, 'rgba(255,150,0,.35)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  if (mag) {                                                  // 흡수 파동
    ctx.strokeStyle = 'rgba(80,170,255,.55)'; ctx.lineWidth = 4;
    for (let k = 0; k < 3; k++) { const r = 720 * CHARS[store.d.char].magnet * (1 - ((g.t * .8 + k / 3) % 1)); ctx.globalAlpha = clamp(1 - r / 860, 0, 1) * .8; ctx.beginPath(); ctx.arc(p.x, p.y - 40 * p.sc, r, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (giant) { ctx.fillStyle = 'rgba(180,100,255,.18)'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 80 * p.sc * .8, 90 * p.sc * .9, 110 * p.sc * .9, 0, 0, 7); ctx.fill(); }
  if (g.pw.shield > 0) {
    const r = 62 * (.8 + p.sc * .2), cy = p.y - 48 * p.sc, blink = g.pw.shield < 3 && Math.floor(g.t * 8) % 2;
    if (!blink) { const gr = ctx.createRadialGradient(p.x, cy, r * .5, p.x, cy, r); gr.addColorStop(0, 'rgba(120,255,230,.05)'); gr.addColorStop(1, 'rgba(120,255,230,.45)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, cy, r, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.stroke(); }
  }
}

function render() {
  buttons = [];
  ctx.save();
  if (scene === 'title') {
    drawBackground(0, tScroll);
    drawCookie(230, GY, 2.3, 'run', tClock * 10, store.d.char, 1);
    text('쿠키 대탈출', W / 2 + 120, 130, 110, '#fff');
    text('정글 속을 달려라!', W / 2 + 120, 205, 36, '#ffd23f');
    const cx = W / 2 + 120, C = store.d.char;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; rr(cx - 250, 250, 500, 50, 25); ctx.fill();
    text(`${CHARS[C].name}  ·  ${CHARS[C].desc}`, cx, 276, 28);
    btn(cx - 330, 245, 60, 60, '◀', () => changeChar(-1), '#58b7ff');
    btn(cx + 270, 245, 60, 60, '▶', () => changeChar(1), '#58b7ff');
    btn(cx - 160, 320, 320, 80, '게임 시작', startGame);
    btn(cx - 160, 420, 320, 64, showHelp ? '닫기' : '도움말', () => { showHelp = !showHelp; }, '#5bd16b');
    text(`최고 점수 ${store.d.best}   ·   코인 ${store.d.coins}`, cx, 530, 30);
    soundBtn();
    if (showHelp) {
      drawOverlay(.78);
      const L = ['[ 조작법 ]', '점프: Space / ↑ / W  (공중에서 한 번 더 = 더블 점프)', '슬라이드: ↓ / S (누르는 동안)   일시정지: P / Esc   소리: M', '모바일: 화면 오른쪽 = 점프, 왼쪽 = 슬라이드', '', '[ 아이템 ]', '▲ 거대화: 커지고 무적, 장애물을 부수며 질주   » 스피드: 엄청 빠르고 무적', 'U 자석: 주변 젤리·코인을 빨아들임   ◆ 보호막: 피격 1회 방어', '! 폭탄: 화면의 장애물 전부 파괴   ×2 점수 2배   + 체력 회복'];
      L.forEach((s, i) => text(s, W / 2, 120 + i * 50, i === 0 || i === 5 ? 38 : 27, i === 0 || i === 5 ? '#ffd23f' : '#fff'));
      btn(W / 2 - 100, 620, 200, 64, '닫기', () => { showHelp = false; }, '#5bd16b');
    }
  } else {
    const sx = g.shake > 0 ? rand(-8, 8) : 0, sy = g.shake > 0 ? rand(-8, 8) : 0;
    ctx.translate(sx, sy);
    drawBackground(g.dist / 25, g.scroll);
    drawPits();
    for (const e of g.ents) if (e.t !== 'pit') drawEnt(e);
    const st = g.dead ? 'dead' : p.slide ? 'slide' : p.ground ? 'run' : 'jump';
    const blink = p.inv > 0 && Math.floor(p.inv * 14) % 2;
    if (g.pw.speed > 0) for (let k = 3; k >= 1; k--) drawCookie(p.x - k * 55, p.y, p.sc, st, p.run - k * .5, store.d.char, .18);
    drawCookie(p.x, p.y, p.sc, st, g.dead ? g.deadT * 10 : p.run, store.d.char, blink ? .35 : 1);
    for (const q of g.parts) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.s * (.4 + q.life / q.max * .6), 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (!g.dead) drawEffects();
    if (g.hp < 30 && !g.dead) { const gr = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 760); gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, `rgba(255,0,0,${.25 + Math.sin(g.t * 8) * .1})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
    ctx.translate(-sx, -sy);
    if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${g.flash})`; ctx.fillRect(0, 0, W, H); }
    drawHUD();
    if (scene === 'pause') {
      drawOverlay(.6); text('일시정지', W / 2, 220, 90);
      btn(W / 2 - 160, 300, 320, 80, '계속하기', togglePause, '#5bd16b');
      btn(W / 2 - 160, 400, 320, 72, '타이틀로', () => { scene = 'title'; }, '#58b7ff');
    }
    if (scene === 'over') {
      drawOverlay(.7); text('게임 오버', W / 2, 110, 90, '#ff6f6f');
      if (g.newBest) text('★ 신기록! ★', W / 2, 185, 46, '#ffd23f');
      const rows = [['점수', g.finalScore], ['달린 거리', Math.floor(g.dist / 25) + ' m'], ['젤리', g.jellies], ['코인', g.coins], ['최고 점수', store.d.best]];
      rows.forEach((r, i) => { text(r[0], W / 2 - 170, 250 + i * 54, 36, '#fff', 'left'); text(String(r[1]), W / 2 + 170, 250 + i * 54, 36, '#ffd23f', 'right'); });
      btn(W / 2 - 330, 560, 300, 80, '다시하기', startGame);
      btn(W / 2 + 30, 560, 300, 80, '타이틀로', () => { scene = 'title'; }, '#58b7ff');
    }
  }
  ctx.restore();
}

/* ---------- 메인 루프 ---------- */
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now; tClock += dt;
  if (scene === 'title') tScroll += 260 * dt;
  else if (scene === 'play') update(dt);
  render();
  requestAnimationFrame(loop);
}
if (document.fonts && document.fonts.load) document.fonts.load(`20px "Jua"`).catch(() => {});
requestAnimationFrame(loop);
