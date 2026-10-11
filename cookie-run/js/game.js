'use strict';
// 쿠키 대탈출 - HTML5 Canvas 러닝 게임 (모든 그래픽/사운드는 코드로 생성한 오리지널 에셋)
const W = 1280, H = 720, GY = 610;
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

/* ---------- 캐릭터 ---------- */
const CHARS = [
  { name: '진저', body: '#e0a050', dark: '#7a4515', desc: '균형형 · 더블 점프', magnet: 1, dmg: 1 },
  { name: '베리', body: '#ff7f9f', dark: '#a02a47', desc: '젤리 자석 범위 +20%', magnet: 1.2, dmg: 1 },
  { name: '초코', body: '#8a5a3a', dark: '#3d2210', desc: '피격 피해 -15%', magnet: 1, dmg: 0.85 }
];

/* ---------- 게임 상태 ---------- */
let scene = 'title';     // title | play | pause | over
let g = null, p = null;
let showHelp = false, tScroll = 0, tClock = 0;
const keys = { jump: false, slide: false };
let buttons = [];
let slidePtr = null, jumpPtrs = new Set();

function startGame() {
  g = {
    t: 0, dist: 0, scroll: 0, speed: 420, bonus: 0, coins: 0, jellies: 0, hp: 100,
    ents: [], parts: [], floats: [], sinceSpawn: 0, gap: 520,
    pw: { magnet: 0, booster: 0, giant: 0 }, shake: 0, combo: 0, comboT: 0,
    dead: false, deadT: 0, newBest: false, spawnedItems: 0
  };
  p = { x: 220, y: GY, vy: 0, jumps: 0, ground: true, coyote: 0, buf: 0, inv: 0, cut: false, slide: false, run: 0, wasGround: true };
  scene = 'play';
}

/* ---------- 입력 ---------- */
function pressJump() { audio.init(); if (scene !== 'play') return; keys.jump = true; p.buf = 0.12; }
function releaseJump() { keys.jump = false; }
function tryJump() {
  if (p.y > GY + 6) return false;
  if (p.ground || p.coyote > 0) {
    p.vy = -900; p.jumps = 1; p.coyote = 0; p.cut = false; p.ground = false;
    audio.sfx('jump'); dust(p.x, GY, 6); return true;
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
function dust(x, y, n) { for (let i = 0; i < n; i++) g.parts.push({ x: x + rand(-14, 6), y, vx: rand(-160, -30), vy: rand(-90, -10), life: .4, max: .4, c: '#f3dcb2', s: rand(4, 8), grav: 200 }); }
function sparkle(x, y, c, n) { for (let i = 0; i < n; i++) { const a = rand(0, 6.28), s = rand(80, 260); g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .5, max: .5, c, s: rand(3, 7), grav: 0 }); } }
function floatText(x, y, t, c) { g.floats.push({ x, y, t, c, life: .8 }); }

/* ---------- 맵 패턴 ---------- */
const JC = ['#ff6fa5', '#ffd23f', '#5bd16b', '#58b7ff'];
function jelly(x, y, big) { g.ents.push({ t: big ? 'big' : 'jelly', x: x - 16, y: y - 16, w: 32, h: 32, c: JC[(Math.random() * 4) | 0] }); }
function coin(x, y) { g.ents.push({ t: 'coin', x: x - 14, y: y - 14, w: 28, h: 28 }); }
function ob(t, x) {
  const o = { spike: { w: 70, h: 56, y: GY - 56 }, fence: { w: 44, h: 84, y: GY - 84 }, bat: { w: 70, h: 44, y: GY - 112 }, gear: { w: 60, h: 60, y: GY - 60, vx: 150 } }[t];
  g.ents.push({ t, x, y: o.y, w: o.w, h: o.h, vx: o.vx || 0, ph: Math.random() * 6 });
  return o.w;
}
function arc(x0, x1, n, base, hgt) { for (let i = 0; i < n; i++) { const k = i / (n - 1); jelly(x0 + (x1 - x0) * k, base - Math.sin(k * Math.PI) * hgt); } }
function line(x0, n, y, sp = 44) { for (let i = 0; i < n; i++) jelly(x0 + i * sp, y); }
function item() {
  const r = Math.random(); let k;
  if (g.hp < 55 && r < .55) k = 'potion';
  else k = ['potion', 'magnet', 'booster', 'giant'][(Math.random() * 4) | 0];
  g.ents.push({ t: 'item', k, x: 0, y: GY - 120, w: 44, h: 44 });
  return g.ents[g.ents.length - 1];
}
const PATTERNS = [
  { min: 0, f(x) { ob('spike', x + 100); arc(x, x + 270, 7, GY - 40, 140); return 320; } },
  { min: 0, f(x) { ob('fence', x + 60); line(x, 6, GY - 150, 36); return 240; } },
  { min: 0, f(x) { line(x, 8, GY - 30); coin(x + 380, GY - 30); return 400; } },
  { min: 0, f(x) { ob('bat', x + 80); line(x - 20, 8, GY - 30, 40); return 300; } },
  { min: 0, f(x) { const w = 150 + g.speed * .22; g.ents.push({ t: 'pit', x, y: GY, w, h: 110 }); arc(x - 30, x + w + 30, 9, GY - 60, 150); return w; } },
  { min: 0, f(x) { ob('spike', x); ob('spike', x + 90); jelly(x + 45, GY - 200, true); return 200; } },
  { min: 0, f(x) { for (let i = 0; i < 3; i++) coin(x + i * 40, GY - 60); line(x + 40, 6, GY - 30); return 300; } },
  { min: 300, f(x) { ob('spike', x); ob('bat', x + 260); line(x + 90, 4, GY - 160, 40); return 360; } },
  { min: 500, f(x) { ob('gear', x + 200); arc(x, x + 140, 5, GY - 40, 120); return 260; } },
  { min: 800, f(x) { const w = 150 + g.speed * .2; g.ents.push({ t: 'pit', x, y: GY, w, h: 110 }); ob('fence', x + w + 120); return w + 150; } },
  { min: 1200, f(x) { ob('fence', x); ob('bat', x + 230); ob('spike', x + 470); line(x + 40, 4, GY - 180, 36); return 540; } },
  { min: 1800, f(x) { ob('gear', x); ob('gear', x + 220); jelly(x + 150, GY - 190, true); return 300; } }
];
function spawn() {
  const x = W + 60, m = g.dist / 25;
  if (g.spawnedItems * 600 < m - 250 && Math.random() < .8) {      // 아이템 패턴 (약 600m마다)
    const it = item(); it.x = x; line(x + 60, 5, GY - 120, 40); g.spawnedItems++;
    g.sinceSpawn = 0; g.gap = 420 + g.speed * .4; return;
  }
  const pool = PATTERNS.filter(q => q.min <= m);
  const w = pool[(Math.random() * pool.length) | 0].f(x);
  g.sinceSpawn = 0; g.gap = w + g.speed * rand(.8, 1.25);
}

/* ---------- 업데이트 ---------- */
function overPit() {
  if (g.pw.booster > 0 || g.pw.giant > 0) return false;
  for (const e of g.ents) if (e.t === 'pit' && p.x > e.x + 14 && p.x < e.x + e.w - 14) return true;
  return false;
}
function hurt(dmg) {
  if (p.inv > 0) return;
  g.hp -= dmg * CHARS[store.d.char].dmg; p.inv = 1.5; g.shake = .3; g.combo = 0; audio.sfx('hit');
  sparkle(p.x, p.y - 40, '#ff5a4a', 12);
}
function die() { if (g.dead) return; g.dead = true; g.deadT = 0; p.vy = -600; audio.sfx('over'); }
function playerBox() {
  const sc = g.pw.giant > 0 ? 2 : 1, h = (p.slide ? 34 : 64) * sc, w = 44 * sc;
  return { x: p.x - w / 2, y: p.y - h, w, h };
}
function hitBox(e) {
  switch (e.t) {
    case 'spike': return { x: e.x + 10, y: e.y + 16, w: e.w - 20, h: e.h - 16 };
    case 'fence': return { x: e.x + 6, y: e.y + 4, w: e.w - 12, h: e.h - 4 };
    case 'bat': return { x: e.x + 10, y: e.y + 8, w: e.w - 20, h: e.h - 16 };
    case 'gear': return { x: e.x + 10, y: e.y + 10, w: e.w - 20, h: e.h - 10 };
  }
  return e;
}
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function update(dt) {
  g.t += dt;
  // 파티클/텍스트
  for (const q of g.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; }
  g.parts = g.parts.filter(q => q.life > 0);
  for (const f of g.floats) { f.life -= dt; f.y -= 50 * dt; }
  g.floats = g.floats.filter(f => f.life > 0);
  g.shake = Math.max(0, g.shake - dt);

  if (g.dead) {
    g.deadT += dt; p.vy += 2400 * dt; p.y += p.vy * dt;
    if (g.deadT > 1.1) endGame();
    return;
  }

  const m = g.dist / 25, boost = g.pw.booster > 0;
  g.speed = Math.min(900, 420 + m * .18) * (boost ? 1.5 : 1);
  const move = g.speed * dt; g.dist += move; g.scroll += move;
  if (!boost) g.hp -= 2.5 * dt;
  g.hp = Math.min(100, g.hp);
  for (const k in g.pw) g.pw[k] = Math.max(0, g.pw[k] - dt);
  p.inv = Math.max(0, p.inv - dt); g.comboT -= dt; if (g.comboT <= 0) g.combo = 0;

  // 플레이어 물리
  p.buf -= dt; p.coyote -= dt; p.run += dt * g.speed / 40;
  if (p.buf > 0 && tryJump()) p.buf = 0;
  if (!keys.jump && p.vy < -400 && !p.cut && p.jumps === 1) { p.vy *= .5; p.cut = true; }
  p.vy += 2400 * dt; p.y += p.vy * dt;
  p.wasGround = p.ground; p.ground = false;
  if (p.y >= GY && p.vy >= 0 && !overPit()) {
    p.y = GY; p.vy = 0; p.ground = true; p.jumps = 0; p.cut = false; p.coyote = .1;
    if (!p.wasGround) dust(p.x, GY, 5);
  }
  if (!p.ground && p.coyote <= 0 && p.jumps === 0) p.jumps = 1;
  const wasSlide = p.slide;
  p.slide = keys.slide && p.ground;
  if (p.slide && !wasSlide) audio.sfx('slide');
  if (p.slide && Math.random() < .5) dust(p.x - 10, GY, 1);
  if (p.y > GY + 90) { g.hp = 0; die(); return; }
  if (g.pw.giant > 0 || boost) p.slide = false;

  // 스폰
  g.sinceSpawn += move;
  if (g.sinceSpawn >= g.gap) spawn();

  // 엔티티
  const pb = playerBox(), cx = pb.x + pb.w / 2, cy = pb.y + pb.h / 2;
  const mag = (g.pw.magnet > 0 ? 330 * CHARS[store.d.char].magnet : 0), pull = boost ? 520 : mag;
  for (const e of g.ents) {
    e.x -= move + (e.vx || 0) * dt;
    if (e.t === 'jelly' || e.t === 'big' || e.t === 'coin') {
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2, d = Math.hypot(cx - ex, cy - ey);
      if (pull && d < pull) { const s = 1100 * dt / Math.max(d, 1); e.x += (cx - ex) * s; e.y += (cy - ey) * s; }
    }
    if (e.dead) continue;
    if (!hit(pb, hitBox(e))) continue;
    switch (e.t) {
      case 'jelly': case 'big': {
        e.dead = true; g.jellies++; g.combo++; g.comboT = 1.5;
        const mult = 1 + Math.min(g.combo, 30) / 30, pts = Math.round((e.t === 'big' ? 500 : 100) * mult);
        g.bonus += pts; g.hp = Math.min(100, g.hp + (e.t === 'big' ? 6 : .8));
        audio.sfx('jelly', 1 + Math.min(g.combo, 12) * .04); sparkle(e.x + 16, e.y + 16, e.c, e.t === 'big' ? 10 : 4);
        if (e.t === 'big') floatText(e.x, e.y, '+' + pts, '#ffd23f');
        break;
      }
      case 'coin': e.dead = true; g.coins++; audio.sfx('coin'); sparkle(e.x + 14, e.y + 14, '#ffd23f', 5); break;
      case 'item':
        e.dead = true; audio.sfx('power'); sparkle(e.x + 22, e.y + 22, '#fff', 14);
        if (e.k === 'potion') { g.hp = Math.min(100, g.hp + 30); floatText(e.x, e.y, 'HP +30', '#5bd16b'); }
        else g.pw[e.k] = { magnet: 6, booster: 4, giant: 5 }[e.k];
        break;
      case 'spike': case 'fence': case 'bat': case 'gear':
        if (boost || g.pw.giant > 0) { e.dead = true; g.bonus += 50; audio.sfx('smash'); sparkle(e.x + e.w / 2, e.y + e.h / 2, '#ffe9b8', 12); g.shake = .12; }
        else hurt(20);
        break;
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
const curScore = () => Math.floor(g.dist / 25) * 10 + g.bonus;

/* ---------- 배경 ---------- */
const THEMES = [
  { sky: ['#8FD3FF', '#FFE9B8'], hill: '#a6e8a8', mid: '#6fcf7a', top: '#7ed957', gnd: '#C68642', gnd2: '#a96f32', void: '#4a2c14' },
  { sky: ['#ffb3d1', '#ffe0c2'], hill: '#e0a98a', mid: '#a0623d', top: '#ff8fb8', gnd: '#6b3e1f', gnd2: '#552f16', void: '#2a1208' },
  { sky: ['#2b1740', '#d9503c'], hill: '#4a2a5a', mid: '#2a1236', top: '#e8453c', gnd: '#3a2230', gnd2: '#2a1622', void: '#120008' }
];
function themeAt(m) { return m < 1000 ? 0 : m < 2500 ? 1 : 2; }
function drawTheme(i, a, sc) {
  const T = THEMES[i];
  ctx.globalAlpha = a;
  const gr = ctx.createLinearGradient(0, 0, 0, GY); gr.addColorStop(0, T.sky[0]); gr.addColorStop(1, T.sky[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  // 해/달 & 구름/별
  if (i === 2) {
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (let k = 0; k < 30; k++) ctx.fillRect(hash(k) * W, hash(k + 50) * 330, 3, 3);
    ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.arc(980, 150, 55, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = i === 0 ? '#fff6c0' : '#fff0d8'; ctx.beginPath(); ctx.arc(1000, 130, 52, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let k = 0; k < 6; k++) {
      const cx = ((hash(k) * 1800 - sc * .05) % 1500 + 1500) % 1500 - 110, cy = 70 + hash(k + 9) * 160;
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 7); ctx.arc(cx + 34, cy - 12, 38, 0, 7); ctx.arc(cx + 72, cy, 30, 0, 7); ctx.fill();
    }
  }
  // 원경 언덕
  ctx.fillStyle = T.hill; ctx.beginPath(); ctx.moveTo(0, GY);
  const o1 = sc * .1;
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, GY - 150 - Math.sin((x + o1) / 130) * 50 - Math.sin((x + o1) / 57) * 18);
  ctx.lineTo(W, GY); ctx.fill();
  // 중경 장식
  const o2 = sc * .3, sp = 240, i0 = Math.floor(o2 / sp);
  for (let k = 0; k < Math.ceil(W / sp) + 2; k++) {
    const idx = i0 + k, x = k * sp - (o2 % sp), r = hash(idx), bh = 90 + r * 90;
    ctx.fillStyle = T.mid;
    if (i === 0) { // 캔디 나무
      ctx.fillRect(x - 5, GY - bh, 10, bh); ctx.beginPath(); ctx.arc(x, GY - bh, 38 + r * 14, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, GY - bh, 20 + r * 8, .3, 4.5); ctx.stroke();
    } else if (i === 1) { // 초콜릿 기둥 + 시럽
      rr(x - 28, GY - bh - 40, 56, bh + 40, 12); ctx.fill();
      ctx.fillStyle = T.top; rr(x - 32, GY - bh - 46, 64, 26, 12); ctx.fill();
      for (let d = -20; d <= 20; d += 20) { rr(x + d - 5, GY - bh - 30, 10, 30 + hash(idx + d) * 40, 5); ctx.fill(); }
    } else { // 성탑
      ctx.fillRect(x - 36, GY - bh - 70, 72, bh + 70);
      ctx.beginPath(); ctx.moveTo(x - 46, GY - bh - 70); ctx.lineTo(x, GY - bh - 130); ctx.lineTo(x + 46, GY - bh - 70); ctx.fill();
      ctx.fillStyle = `rgba(255,${150 + Math.sin(tClock * 6 + idx) * 40 | 0},50,.9)`; ctx.fillRect(x - 6, GY - bh - 40, 12, 24);
    }
  }
  // 지면
  ctx.fillStyle = T.gnd; ctx.fillRect(0, GY, W, H - GY);
  ctx.fillStyle = T.gnd2; const o3 = sc % 80;
  for (let x = -o3; x < W; x += 80) { ctx.beginPath(); ctx.arc(x + 30, GY + 50, 9, 0, 7); ctx.arc(x + 62, GY + 85, 6, 0, 7); ctx.fill(); }
  ctx.fillStyle = T.top; ctx.fillRect(0, GY - 2, W, 18);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0, GY - 2, W, 4);
  ctx.globalAlpha = 1;
}
function drawBackground(m, sc) {
  const i = themeAt(m), bd = i === 0 ? 1000 : 2500, blend = i < 2 ? clamp((m - (bd - 100)) / 100, 0, 1) : 0;
  drawTheme(i, 1, sc);
  if (i < 2 && blend > 0) drawTheme(i + 1, blend, sc);
}

/* ---------- 스프라이트 그리기 ---------- */
function drawCookie(x, y, sc, st, t, ci, alpha) {
  const C = CHARS[ci];
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.lineWidth = 3.5; ctx.strokeStyle = C.dark; ctx.lineJoin = 'round';
  let bob = 0, l1 = 0, l2 = 0;
  if (st === 'run') { bob = Math.abs(Math.sin(t * 1.2)) * -5; l1 = Math.sin(t * 1.2) * 12; l2 = -l1; }
  if (st === 'jump') { l1 = 8; l2 = -8; }
  if (st === 'dead') { ctx.rotate(t * 8); ctx.translate(0, -40); ctx.translate(0, 40); }
  if (st === 'slide') { ctx.translate(0, 0); ctx.rotate(-.35); ctx.scale(1.15, .6); ctx.translate(-6, -10); }
  // 다리
  ctx.fillStyle = C.body;
  [[-12, l1], [12, l2]].forEach(([dx, dl]) => { ctx.beginPath(); ctx.ellipse(dx + dl * .6, -9 - Math.max(0, -dl) * .5, 11, 10, 0, 0, 7); ctx.fill(); ctx.stroke(); });
  // 몸
  ctx.translate(0, bob);
  ctx.beginPath(); ctx.ellipse(0, -46, 36, 36, 0, 0, 7); ctx.fill(); ctx.stroke();
  // 팔
  const arm = st === 'run' ? Math.sin(t * 1.2) * 14 : -10;
  ctx.beginPath(); ctx.ellipse(-30, -40 + arm * .3, 8, 11, .5, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(31, -40 - arm * .3, 8, 11, -.5, 0, 7); ctx.fill(); ctx.stroke();
  // 캐릭터별 장식
  if (ci === 0) { // 진저: 아이싱 지그재그
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-26, -20); for (let k = 0; k < 6; k++) ctx.lineTo(-26 + k * 10.4 + 5, -20 + (k % 2 ? 4 : -4)); ctx.stroke();
    ctx.fillStyle = '#e8453c'; ctx.beginPath(); ctx.arc(0, -2 - 1, 0, 0, 7); ctx.fill();
  } else if (ci === 1) { // 베리: 잎 + 씨앗
    ctx.fillStyle = '#5bd16b'; ctx.strokeStyle = '#2a7a35'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(-10, -86, 12, 7, -.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(10, -86, 12, 7, .5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe0a0'; [[-18, -26], [-4, -20], [14, -24], [22, -36], [-24, -42]].forEach(([a, b]) => { ctx.beginPath(); ctx.ellipse(a, b, 2.5, 4, 0, 0, 7); ctx.fill(); });
  } else { // 초코: 칩
    ctx.fillStyle = '#e8c9a0'; [[-20, -64], [-6, -76], [18, -70], [-24, -34], [22, -28]].forEach(([a, b]) => { rr(a - 5, b - 4, 10, 8, 3); ctx.fill(); });
  }
  // 얼굴
  const ex = st === 'dead' ? 0 : 1;
  ctx.fillStyle = '#2b1810';
  if (ex) { ctx.beginPath(); ctx.ellipse(6, -52, 4.5, 6.5, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(21, -52, 4.5, 6.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(5, -56, 2.5, 3); ctx.fillRect(20, -56, 2.5, 3); }
  else { ctx.strokeStyle = '#2b1810'; ctx.lineWidth = 3; [[6, -52], [21, -52]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a - 4, b - 4); ctx.lineTo(a + 4, b + 4); ctx.moveTo(a + 4, b - 4); ctx.lineTo(a - 4, b + 4); ctx.stroke(); }); }
  ctx.fillStyle = 'rgba(255,90,120,.5)'; ctx.beginPath(); ctx.ellipse(0, -40, 5, 3.5, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(27, -40, 5, 3.5, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2b1810'; ctx.lineWidth = 3; ctx.beginPath();
  if (st === 'jump' || st === 'dead') ctx.ellipse(14, -37, 5, 5, 0, 0, 7); else ctx.arc(14, -42, 7, .15, Math.PI - .15);
  ctx.stroke();
  ctx.restore();
}
function drawEnt(e) {
  const t = g ? g.t : tClock;
  ctx.save();
  switch (e.t) {
    case 'jelly': case 'big': {
      const s = e.t === 'big' ? 1.5 : 1, by = Math.sin(t * 6 + e.x * .02) * 3;
      ctx.translate(e.x + 16, e.y + 16 + by); ctx.scale(s, s); ctx.rotate(Math.sin(t * 4 + e.x * .01) * .2);
      ctx.fillStyle = e.c; ctx.strokeStyle = 'rgba(60,30,20,.8)'; ctx.lineWidth = 3; rr(-13, -15, 26, 30, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.65)'; rr(-8, -11, 6, 12, 3); ctx.fill();
      if (e.t === 'big') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 7); ctx.stroke(); }
      break;
    }
    case 'coin':
      ctx.translate(e.x + 14, e.y + 14); ctx.scale(Math.abs(Math.cos(t * 4 + e.x * .01)) * .8 + .2, 1);
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a86a00'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a86a00'; ctx.font = `bold 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('C', 0, 1);
      break;
    case 'item': {
      const by = Math.sin(t * 4) * 6, col = { potion: '#ff6fa5', magnet: '#58b7ff', booster: '#ffd23f', giant: '#5bd16b' }[e.k];
      ctx.translate(e.x + 22, e.y + 22 + by);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(0, 0, 32 + Math.sin(t * 6) * 3, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.strokeStyle = '#5A3A22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = `24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText({ potion: '+', magnet: 'U', booster: '»', giant: '▲' }[e.k], 0, 2);
      break;
    }
    case 'spike':
      ctx.translate(e.x, e.y); ctx.lineWidth = 3; ctx.strokeStyle = '#5A3A22';
      for (let k = 0; k < 3; k++) { ctx.fillStyle = ['#ff6fa5', '#fff', '#ff6fa5'][k]; ctx.beginPath(); ctx.moveTo(k * 23.3, e.h); ctx.lineTo(k * 23.3 + 11.6, 0); ctx.lineTo(k * 23.3 + 23.3, e.h); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      break;
    case 'fence':
      ctx.translate(e.x, e.y); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#5A3A22'; ctx.lineWidth = 3; rr(0, 0, e.w, e.h, 16); ctx.fill(); ctx.stroke();
      ctx.save(); rr(0, 0, e.w, e.h, 16); ctx.clip(); ctx.fillStyle = '#e8453c';
      for (let y = -e.w; y < e.h + e.w; y += 26) { ctx.beginPath(); ctx.moveTo(0, y + 14); ctx.lineTo(e.w, y); ctx.lineTo(e.w, y + 13); ctx.lineTo(0, y + 27); ctx.fill(); }
      ctx.restore(); rr(0, 0, e.w, e.h, 16); ctx.stroke();
      break;
    case 'bat': {
      ctx.translate(e.x + 35, e.y + 22 + Math.sin(t * 5 + e.ph) * 5); const f = Math.sin(t * 14 + e.ph);
      ctx.fillStyle = '#7a3fa0'; ctx.strokeStyle = '#2a1236'; ctx.lineWidth = 3;
      [-1, 1].forEach(s => { ctx.beginPath(); ctx.moveTo(s * 10, 0); ctx.quadraticCurveTo(s * 40, -28 * f - 6, s * 38, 10); ctx.quadraticCurveTo(s * 26, 2, s * 18, 14); ctx.quadraticCurveTo(s * 12, 6, s * 10, 12); ctx.closePath(); ctx.fill(); ctx.stroke(); });
      ctx.beginPath(); ctx.ellipse(0, 4, 15, 17, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(-5, 0, 3.5, 0, 7); ctx.arc(5, 0, 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-4, 9); ctx.lineTo(-2, 14); ctx.lineTo(0, 9); ctx.moveTo(0, 9); ctx.lineTo(2, 14); ctx.lineTo(4, 9); ctx.fill();
      break;
    }
    case 'gear': {
      ctx.translate(e.x + 30, e.y + 30); ctx.rotate(-t * 8); ctx.fillStyle = '#9aa0a6'; ctx.strokeStyle = '#3a3f44'; ctx.lineWidth = 3;
      ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, r = k % 2 ? 24 : 31; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8453c'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
function drawPits() {
  for (const e of g.ents) if (e.t === 'pit') {
    const T = THEMES[themeAt(g.dist / 25)];
    const gr = ctx.createLinearGradient(0, GY - 2, 0, H); gr.addColorStop(0, T.void); gr.addColorStop(1, '#000');
    ctx.fillStyle = gr; ctx.fillRect(e.x, GY - 2, e.w, H - GY + 2);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let k = 0; k < 5; k++) ctx.fillRect(e.x + 12 + k * (e.w / 5), GY + 20 + (k % 2) * 25, 3, 18);
  }
}

/* ---------- 화면 그리기 ---------- */
function btn(x, y, w, h, label, fn, col = '#ff6fa5') {
  buttons.push({ x, y, w, h, fn });
  ctx.fillStyle = 'rgba(90,58,34,.9)'; rr(x + 3, y + 6, w, h, h / 2); ctx.fill();
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
function drawHUD() {
  // HP
  ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(60, 28, 380, 34, 17); ctx.fill();
  const low = g.hp < 30, hw = 372 * g.hp / 100;
  if (hw > 4) { ctx.fillStyle = low ? (Math.floor(g.t * 6) % 2 ? '#ff3b30' : '#ff8a80') : '#ff6fa5'; rr(64, 32, hw, 26, 13); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(70, 35, Math.max(0, hw - 12), 8, 4); ctx.fill(); }
  ctx.strokeStyle = '#5A3A22'; ctx.lineWidth = 4; rr(60, 28, 380, 34, 17); ctx.stroke();
  text('♥', 40, 46, 44, '#ff3b5c');
  // 파워업
  let px = 66;
  const MAXT = { magnet: 6, booster: 4, giant: 5 }, LAB = { magnet: 'U', booster: '»', giant: '▲' }, COL = { magnet: '#58b7ff', booster: '#ffd23f', giant: '#5bd16b' };
  for (const k in g.pw) if (g.pw[k] > 0) {
    ctx.fillStyle = COL[k]; ctx.strokeStyle = '#5A3A22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, 100, 22, 0, 7); ctx.fill(); ctx.stroke();
    text(LAB[k], px, 102, 24); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(px, 100, 28, -Math.PI / 2, -Math.PI / 2 + 6.283 * g.pw[k] / MAXT[k]); ctx.stroke();
    px += 66;
  }
  // 점수
  text(String(curScore()).padStart(6, '0'), W - 100, 46, 46, '#fff', 'right');
  text('🪙 ' + g.coins, W - 100, 92, 28, '#ffd23f', 'right');
  text(Math.floor(g.dist / 25) + ' m', W - 100, 128, 24, '#fff', 'right');
  if (g.combo >= 5) text(`콤보 ${g.combo}  x${(1 + Math.min(g.combo, 30) / 30).toFixed(1)}`, 450, 46, 26, '#ffd23f', 'left');
  // 일시정지 버튼
  buttons.push({ x: W - 70, y: 150, w: 52, h: 52, fn: togglePause });
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(W - 44, 176, 26, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(W - 54, 164, 8, 24); ctx.fillRect(W - 40, 164, 8, 24);
  // 플로팅 텍스트
  for (const f of g.floats) { ctx.globalAlpha = clamp(f.life * 2, 0, 1); text(f.t, f.x, f.y, 28, f.c); ctx.globalAlpha = 1; }
  // 터치 안내
  if (g.t < 5) {
    ctx.globalAlpha = clamp(5 - g.t, 0, 1) * .6;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, 250, W / 2, 360); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(W / 2, 250, W / 2, 360);
    text('슬라이드 (↓ / 좌측 터치)', W / 4, 400, 32); text('점프 · 더블점프 (Space / 우측 터치)', W * .75, 400, 32);
    ctx.globalAlpha = 1;
  }
}
function drawOverlay(a) { ctx.fillStyle = `rgba(30,15,10,${a})`; ctx.fillRect(0, 0, W, H); }

function render() {
  buttons = [];
  ctx.save();
  if (scene === 'title') {
    drawBackground(0, tScroll);
    const C = store.d.char;
    drawCookie(220 + Math.sin(tClock * 2) * 0, GY, 2.4, 'run', tClock * 10, C, 1);
    text('쿠키 대탈출', W / 2, 130, 110, '#fff');
    text('오븐 속을 달려라!', W / 2, 205, 36, '#ffd23f');
    // 캐릭터 선택
    ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(W / 2 - 250, 250, 500, 50, 25); ctx.fill();
    text(`${CHARS[C].name}  ·  ${CHARS[C].desc}`, W / 2, 276, 28);
    btn(W / 2 - 330, 245, 60, 60, '◀', () => changeChar(-1), '#58b7ff');
    btn(W / 2 + 270, 245, 60, 60, '▶', () => changeChar(1), '#58b7ff');
    btn(W / 2 - 160, 320, 320, 80, '게임 시작', startGame);
    btn(W / 2 - 160, 420, 320, 64, showHelp ? '닫기' : '도움말', () => { showHelp = !showHelp; }, '#5bd16b');
    text(`최고 점수 ${store.d.best}   ·   🪙 ${store.d.coins}`, W / 2, 530, 30);
    soundBtn();
    if (showHelp) {
      drawOverlay(.75);
      const L = ['[ 조작법 ]', '점프: Space / ↑ / W  (공중에서 한 번 더 = 더블 점프)', '슬라이드: ↓ / S (누르는 동안)', '모바일: 화면 오른쪽 = 점프, 왼쪽 = 슬라이드', '일시정지: P / Esc    소리: M', '', '젤리를 먹으면 점수와 에너지 회복, 장애물에 닿으면 에너지 감소!', '🧪+ 포션   U 자석   » 부스터(무적 질주)   ▲ 거대화(장애물 파괴)'];
      L.forEach((s, i) => text(s, W / 2, 170 + i * 52, i ? 30 : 42, i ? '#fff' : '#ffd23f'));
      btn(W / 2 - 100, 600, 200, 64, '닫기', () => { showHelp = false; }, '#5bd16b');
    }
  } else {
    const sx = g.shake > 0 ? rand(-8, 8) : 0, sy = g.shake > 0 ? rand(-8, 8) : 0;
    ctx.translate(sx, sy);
    drawBackground(g.dist / 25, g.scroll);
    drawPits();
    for (const e of g.ents) if (e.t !== 'pit') drawEnt(e);
    // 플레이어
    const giant = g.pw.giant > 0, boost = g.pw.booster > 0;
    const st = g.dead ? 'dead' : p.slide ? 'slide' : p.ground ? 'run' : 'jump';
    const blink = p.inv > 0 && Math.floor(p.inv * 14) % 2;
    if (boost) { ctx.fillStyle = 'rgba(255,230,80,.35)'; ctx.beginPath(); ctx.arc(p.x, p.y - 45, 70, 0, 7); ctx.fill(); for (let k = 1; k < 5; k++) { ctx.globalAlpha = .25 - k * .04; ctx.fillStyle = '#ffd23f'; ctx.fillRect(p.x - 40 - k * 50, p.y - 70, 40, 8); ctx.fillRect(p.x - 40 - k * 40, p.y - 40, 40, 8); } ctx.globalAlpha = 1; }
    if (g.pw.magnet > 0) { ctx.strokeStyle = 'rgba(88,183,255,.5)'; ctx.lineWidth = 4; ctx.setLineDash([10, 10]); ctx.lineDashOffset = -g.t * 40; ctx.beginPath(); ctx.arc(p.x, p.y - 45, 330 * CHARS[store.d.char].magnet * .3 + 40, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    drawCookie(p.x, p.y, (giant ? 2 : 1), st, p.run, store.d.char, blink ? .35 : 1);
    for (const q of g.parts) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.s * (.4 + q.life / q.max * .6), 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (g.hp < 30 && !g.dead) { const gr = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 760); gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, `rgba(255,0,0,${.25 + Math.sin(g.t * 8) * .1})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
    ctx.translate(-sx, -sy);
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
