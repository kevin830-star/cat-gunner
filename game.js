// 猫咪保卫战 —— 主程序
(() => {
'use strict';

// ---------- 工具 ----------
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
// 抽题袋：抽完一轮才会重复
const makeBag = list => { let bag = []; return () => { if (!bag.length) bag = shuffle(list); return bag.pop(); }; };

const canvas = $('game'), ctx = canvas.getContext('2d');
const WORLD = { w: 1700, h: 1300 };
const NEST = { x: WORLD.w / 2, y: WORLD.h / 2, r: 46 };
const FENCE_R = 150;
const BOSS_EVERY = 3;
const LEVEL_TIME = 60;

// ---------- 存档与设置 ----------
const store = { best: 0, pinyin: true, mute: false };
try { Object.assign(store, JSON.parse(localStorage.getItem('catDefense') || '{}')); } catch (e) { /* 无存档 */ }
const save = () => { try { localStorage.setItem('catDefense', JSON.stringify(store)); } catch (e) { /* 忽略 */ } };

// ---------- 声音 ----------
let ac = null;
function initAudio() {
  if (ac) return;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
}
function beep(freq, dur, type = 'square', vol = 0.04, slide = 0) {
  if (!ac || store.mute) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
}
const sfx = {
  shoot: () => beep(520, 0.07, 'square', 0.025, -250),
  boom: () => beep(140, 0.3, 'sawtooth', 0.07, -100),
  hit: () => beep(220, 0.05, 'triangle', 0.04, -80),
  pickup: () => beep(880, 0.06, 'sine', 0.04, 400),
  hurt: () => beep(160, 0.18, 'sawtooth', 0.06, -90),
  buy: () => { beep(660, 0.08, 'sine', 0.05); setTimeout(() => beep(990, 0.12, 'sine', 0.05), 80); },
  right: () => { beep(523, 0.1, 'sine', 0.06); setTimeout(() => beep(659, 0.1, 'sine', 0.06), 100); setTimeout(() => beep(784, 0.18, 'sine', 0.06), 200); },
  wrong: () => beep(200, 0.3, 'square', 0.04, -80),
  boss: () => beep(90, 0.6, 'sawtooth', 0.07, 60),
};
function speak(text) {
  if (store.mute || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 0.85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* 不支持朗读 */ }
}

// ---------- 画布与镜头 ----------
let W = 0, H = 0, scale = 1;
const cam = { x: 0, y: 0 };
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas._dpr = dpr;
  scale = clamp(Math.min(W, H) / 620, 0.55, 1.2);
}
window.addEventListener('resize', resize);
resize();

// 地面装饰（固定随机）
const decor = [];
for (let i = 0; i < 150; i++) {
  decor.push({ x: rand(0, WORLD.w), y: rand(0, WORLD.h), t: Math.random() < 0.35 ? 'flower' : 'tuft', c: ['#fff', '#ffe066', '#ffadc6'][randInt(0, 2)], s: rand(0.7, 1.3) });
}

// ---------- 输入 ----------
const keys = {};
const mouse = { x: 0, y: 0, down: false };
const joy = { active: false, id: null, sx: 0, sy: 0, dx: 0, dy: 0 };
let touchMode = false;

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (state === 'playing') {
    if (k === 'q') cycleWeapon(1);
    if (k === 'e') cycleWeapon(-1);
    if (k === ' ') { useCatnip(); e.preventDefault(); }
    if (k >= '1' && k <= '5') { const w = WEAPONS[+k - 1]; if (G.weapons[w.id]) G.cur = w.id; }
    if (k === 'p' || k === 'escape') pauseGame();
  } else if (state === 'paused' && (k === 'p' || k === 'escape')) resumeGame();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; if (state === 'playing') pauseGame(); });

canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => { initAudio(); mouse.x = e.clientX; mouse.y = e.clientY; mouse.down = true; touchMode = false; });
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('touchstart', e => {
  e.preventDefault(); initAudio();
  if (!touchMode) { touchMode = true; document.body.classList.add('touch'); }
  if (!joy.active) {
    const t = e.changedTouches[0];
    Object.assign(joy, { active: true, id: t.identifier, sx: t.clientX, sy: t.clientY, dx: 0, dy: 0 });
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) if (t.identifier === joy.id) {
    let dx = t.clientX - joy.sx, dy = t.clientY - joy.sy;
    const d = Math.hypot(dx, dy), max = 50;
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    joy.dx = dx / max; joy.dy = dy / max;
  }
}, { passive: false });
const endTouch = e => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.active = false; joy.dx = joy.dy = 0; } };
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);

$('btnPause').addEventListener('click', () => { if (state === 'playing') pauseGame(); });
$('btnWeapon').addEventListener('click', () => { if (state === 'playing') cycleWeapon(1); });
$('btnCatnip').addEventListener('click', () => { if (state === 'playing') useCatnip(); });

// ---------- 游戏状态 ----------
let state = 'menu';   // menu | playing | paused | quiz | shop | mini | over
let G = null;         // 整局数据
let L = null;         // 当前关卡数据
const nextFill = makeBag(FILL_QUIZ);
const nextPic = makeBag(PIC_WORDS);
const nextComp = makeBag(COMPONENTS);
const nextTone = makeBag(PIC_WORDS.filter(w => w.c.length === 1));

const catMaxHp = () => 100 + 25 * G.stats.catHp;
const catSpeed = () => 190 + 18 * G.stats.catSpd;
const nestMaxHp = () => 300 + 100 * G.stats.nestHp;
const weaponDef = id => WEAPONS.find(w => w.id === id);
const weaponDmg = (w, lv) => w.dmg * (1 + 0.25 * (lv - 1));
const weaponInterval = (w, lv) => w.interval * (1 - 0.06 * (lv - 1));
const weaponUpCost = (w, lv) => Math.round((w.cost || 60) * 0.5 * lv);
const itemCost = (it, lv) => Math.round(it.cost * (1 + 0.7 * lv));
const statCost = lv => 40 + 30 * lv;
const REPAIR_COST = 30, REPAIR_HP = 100;
const isBossLevel = lv => lv % BOSS_EVERY === 0;

function show(id) {
  for (const o of document.querySelectorAll('.overlay')) o.classList.toggle('show', o.id === id);
}
function setState(s) {
  state = s;
  mouse.down = false;
  $('btnPause').style.display = (s === 'playing') ? '' : 'none';
  $('touchBtns').style.visibility = (s === 'playing') ? 'visible' : 'hidden';
}

function newGame() {
  G = {
    level: 1, fish: 0, kills: 0,
    weapons: { pistol: 1 }, cur: 'pistol',
    items: { catnip: 0, turret: 0, fence: 0, magnet: 0 },
    stats: { catHp: 0, catSpd: 0, nestHp: 0 },
    nestHp: 300, miniPlayed: false, lastBonus: 0,
  };
  startLevel();
}

function startLevel() {
  L = {
    time: LEVEL_TIME, elapsed: 0, spawnT: 1.2,
    cat: { x: NEST.x, y: NEST.y + 95, r: 17, hp: catMaxHp(), cd: 0, inv: 0, aim: 0, walk: 0, moving: false },
    enemies: [], bullets: [], ebullets: [], fish: [], parts: [], texts: [], turrets: [],
    atkBuff: 0, catnipLeft: G.items.catnip, catnipT: 0,
    boss: null, bossSpawned: false, bossHalfAsked: false, isBoss: isBossLevel(G.level),
    shake: 0, banner: 2.2, nestFlash: 0,
  };
  for (let i = 0; i < G.items.turret; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    L.turrets.push({ x: NEST.x + Math.cos(a) * 82, y: NEST.y + Math.sin(a) * 82, cd: rand(0, 0.5), aim: a });
  }
  show(null);
  setState('playing');
}

function pauseGame() { setState('paused'); refreshToggles(); show('pause'); }
function resumeGame() { show(null); setState('playing'); }

function cycleWeapon(dir) {
  const owned = WEAPONS.filter(w => G.weapons[w.id]);
  const i = owned.findIndex(w => w.id === G.cur);
  G.cur = owned[(i + dir + owned.length) % owned.length].id;
  addText(L.cat.x, L.cat.y - 34, weaponDef(G.cur).name, '#fff', 15);
}
function useCatnip() {
  if (L.catnipLeft <= 0 || L.catnipT > 0) return;
  L.catnipLeft--; L.catnipT = 6;
  addText(L.cat.x, L.cat.y - 34, '猫薄荷！', '#9cff6b', 18);
  sfx.buy();
}

// ---------- 效果 ----------
function addText(x, y, text, color = '#fff', size = 14) { L.texts.push({ x, y, text, color, size, life: 0.9 }); }
function burst(x, y, color, n = 6, speed = 120) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(speed * 0.3, speed);
    L.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.55), color, r: rand(2, 4.5) });
  }
}

// ---------- 敌人 ----------
function spawnEnemy(type, pos) {
  const d = ENEMIES[type];
  const lv = G.level;
  let x, y;
  if (pos) { x = pos.x; y = pos.y; } else {
    const side = randInt(0, 3);
    if (side === 0) { x = rand(0, WORLD.w); y = -20; }
    else if (side === 1) { x = rand(0, WORLD.w); y = WORLD.h + 20; }
    else if (side === 2) { x = -20; y = rand(0, WORLD.h); }
    else { x = WORLD.w + 20; y = rand(0, WORLD.h); }
  }
  let hp = d.hp * (1 + 0.12 * (lv - 1));
  if (type === 'boss') hp = d.hp * (lv / BOSS_EVERY) * (1 + 0.1 * (lv / BOSS_EVERY - 1));
  const e = {
    type, x, y, r: d.r, hp, maxHp: hp, spd: d.spd * Math.min(1.5, 1 + 0.025 * (lv - 1)) * rand(0.92, 1.08),
    dmg: d.dmg * (1 + 0.08 * (lv - 1)), cd: rand(0.3, 1), cd2: 0, flash: 0, face: 1, t: rand(0, 10), summon: 4, dead: false,
  };
  L.enemies.push(e);
  return e;
}
function spawnWave() {
  const lv = G.level;
  const pool = Object.keys(ENEMIES).filter(k => ENEMIES[k].w && ENEMIES[k].from <= lv);
  let total = 0; for (const k of pool) total += ENEMIES[k].w;
  let r = Math.random() * total, type = pool[0];
  for (const k of pool) { r -= ENEMIES[k].w; if (r <= 0) { type = k; break; } }
  const n = ENEMIES[type].group || 1;
  const first = spawnEnemy(type);
  for (let i = 1; i < n; i++) spawnEnemy(type, { x: first.x + rand(-30, 30), y: first.y + rand(-30, 30) });
}
function damageEnemy(e, dmg) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = 0.1;
  addText(e.x + rand(-6, 6), e.y - e.r - 4, String(Math.round(dmg)), '#fff7b0', 13);
  if (e.hp <= 0) {
    e.dead = true; G.kills++;
    const d = ENEMIES[e.type];
    burst(e.x, e.y, '#fff', e.type === 'boss' ? 30 : 8, e.type === 'boss' ? 260 : 130);
    const n = randInt(d.fish[0], d.fish[1]);
    if (e.type === 'boss') {
      for (let i = 0; i < 10; i++) L.fish.push({ x: e.x + rand(-40, 40), y: e.y + rand(-40, 40), v: Math.ceil(n / 10) });
      L.boss = null; L.shake = 0.5; sfx.boom();
    } else {
      L.fish.push({ x: e.x, y: e.y, v: n });
      sfx.hit();
    }
  }
}
function hurtCat(dmg) {
  const c = L.cat;
  if (c.inv > 0) return;
  c.hp -= dmg; c.inv = 0.45; L.shake = Math.max(L.shake, 0.2);
  addText(c.x, c.y - 30, '-' + Math.round(dmg), '#ff6b5e', 16);
  sfx.hurt();
}
function hurtNest(dmg) {
  G.nestHp -= dmg; L.nestFlash = 0.15;
  addText(NEST.x + rand(-20, 20), NEST.y - 50, '-' + Math.round(dmg), '#ff6b5e', 15);
}

// ---------- 射击 ----------
function fireWeapon(c) {
  const w = weaponDef(G.cur), lv = G.weapons[w.id];
  const fast = L.catnipT > 0 ? 0.65 : 1;
  c.cd = weaponInterval(w, lv) * fast;
  const dmg = weaponDmg(w, lv) * (1 + L.atkBuff);
  for (let i = 0; i < w.count; i++) {
    let a = c.aim + rand(-w.jitter, w.jitter);
    if (w.count > 1) a += (i / (w.count - 1) - 0.5) * w.spread;
    L.bullets.push({
      x: c.x + Math.cos(c.aim) * 24, y: c.y + Math.sin(c.aim) * 24,
      vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
      dmg, life: w.life, r: w.r, pierce: w.pierce, explode: w.explode, color: w.color, kind: w.id, hit: new Set(),
    });
  }
  sfx.shoot();
}
function explode(b) {
  for (const e of L.enemies) if (dist(e, b) < b.explode + e.r) damageEnemy(e, b.dmg);
  L.parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, color: 'boom', r: b.explode });
  burst(b.x, b.y, '#ffb347', 12, 220);
  L.shake = Math.max(L.shake, 0.15);
  sfx.boom();
}
function nearestEnemy(p, range) {
  let best = null, bd = range;
  for (const e of L.enemies) { const d = dist(e, p) - e.r; if (d < bd) { bd = d; best = e; } }
  return best;
}

// ---------- 每帧更新 ----------
function update(dt) {
  const c = L.cat;
  L.elapsed += dt;
  L.time = Math.max(0, L.time - dt);
  L.banner -= dt; L.shake = Math.max(0, L.shake - dt); L.nestFlash -= dt;
  if (L.catnipT > 0) L.catnipT -= dt;

  // 移动
  let mx = 0, my = 0;
  if (keys.a || keys.arrowleft) mx -= 1;
  if (keys.d || keys.arrowright) mx += 1;
  if (keys.w || keys.arrowup) my -= 1;
  if (keys.s || keys.arrowdown) my += 1;
  if (joy.active) { mx = joy.dx; my = joy.dy; }
  const ml = Math.hypot(mx, my);
  c.moving = ml > 0.15;
  if (c.moving) {
    const sp = catSpeed() * (L.catnipT > 0 ? 1.4 : 1) * Math.min(1, ml);
    let nx = c.x + mx / ml * sp * dt, ny = c.y + my / ml * sp * dt;
    // 不能走进猫窝里
    const dn = Math.hypot(nx - NEST.x, ny - NEST.y), minD = NEST.r + c.r - 6;
    if (dn < minD) { nx = NEST.x + (nx - NEST.x) / dn * minD; ny = NEST.y + (ny - NEST.y) / dn * minD; }
    c.x = clamp(nx, c.r, WORLD.w - c.r); c.y = clamp(ny, c.r, WORLD.h - c.r);
    c.walk += dt * 12;
  }
  c.inv -= dt; c.cd -= dt;

  // 瞄准与射击
  let firing = false;
  if (touchMode) {
    const t = nearestEnemy(c, 430);
    if (t) { c.aim = Math.atan2(t.y - c.y, t.x - c.x); firing = true; }
  } else {
    c.aim = Math.atan2(cam.y + mouse.y / scale - c.y, cam.x + mouse.x / scale - c.x);
    firing = mouse.down;
  }
  if (firing && c.cd <= 0) fireWeapon(c);

  // 出怪
  if (L.time > 0) {
    L.spawnT -= dt;
    if (L.spawnT <= 0) {
      spawnWave();
      const base = Math.max(0.3, 1.7 * Math.pow(0.92, G.level - 1));
      L.spawnT = base * (1 - 0.3 * L.elapsed / LEVEL_TIME) * rand(0.8, 1.2) * (L.boss ? 1.5 : 1);
    }
  }
  if (L.isBoss && !L.bossSpawned && L.elapsed > 6) {
    L.bossSpawned = true;
    L.boss = spawnEnemy('boss');
    L.shake = 0.4; sfx.boss();
    openQuiz('头目来了！');
    return;
  }
  if (L.boss && !L.bossHalfAsked && L.boss.hp < L.boss.maxHp / 2) {
    L.bossHalfAsked = true;
    openQuiz('头目发怒了！');
    return;
  }

  // 敌人
  for (const e of L.enemies) {
    const d = ENEMIES[e.type];
    e.cd -= dt; e.cd2 -= dt; e.flash -= dt; e.t += dt;
    const tgt = d.target === 'nest' ? NEST : c;
    let spd = e.spd;
    if (G.items.fence && dist(e, NEST) < FENCE_R) spd *= 1 - 0.15 * G.items.fence;
    const dx = tgt.x - e.x, dy = tgt.y - e.y, dd = Math.hypot(dx, dy) || 1;
    const stop = d.ranged ? 230 : (tgt === NEST ? NEST.r + e.r - 4 : c.r + e.r - 8);
    if (dd > stop) {
      e.x += dx / dd * spd * dt; e.y += dy / dd * spd * dt;
      if (Math.abs(dx) > 2) e.face = dx < 0 ? -1 : 1;
    } else if (tgt === NEST && e.cd <= 0) {
      e.cd = 1; hurtNest(e.dmg);
    }
    if (d.ranged && dd < 300 && e.cd <= 0) {
      e.cd = 2.2;
      L.ebullets.push({ x: e.x, y: e.y, vx: dx / dd * 210, vy: dy / dd * 210, dmg: e.dmg, life: 2.2, r: 6 });
    }
    if (!d.ranged && e.cd2 <= 0 && dist(e, c) < c.r + e.r - 4) { e.cd2 = 0.8; hurtCat(e.dmg); }
    if (e.type === 'boss') {
      e.summon -= dt;
      if (e.summon <= 0) {
        e.summon = 5;
        for (let i = 0; i < 2; i++) spawnEnemy('mouse', { x: e.x + rand(-50, 50), y: e.y + rand(-50, 50) });
      }
    }
  }

  // 子弹
  for (const b of L.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const e of L.enemies) {
      if (e.dead || b.hit.has(e) || dist(e, b) > e.r + b.r) continue;
      if (b.explode) { explode(b); b.dead = true; break; }
      damageEnemy(e, b.dmg); b.hit.add(e);
      burst(b.x, b.y, b.color, 3, 80);
      if (b.pierce-- <= 0) { b.dead = true; break; }
    }
    if (!b.dead && b.life <= 0) { if (b.explode) explode(b); b.dead = true; }
  }
  for (const b of L.ebullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (dist(b, c) < c.r + b.r) { hurtCat(b.dmg); b.life = 0; }
  }

  // 炮塔
  for (const t of L.turrets) {
    t.cd -= dt;
    const e = nearestEnemy(t, 330);
    if (e) {
      t.aim = Math.atan2(e.y - t.y, e.x - t.x);
      if (t.cd <= 0) {
        t.cd = 0.7;
        L.bullets.push({ x: t.x, y: t.y, vx: Math.cos(t.aim) * 520, vy: Math.sin(t.aim) * 520, dmg: 9 + G.level, life: 0.7, r: 4, pierce: 0, explode: 0, color: '#ffd84a', kind: 'turret', hit: new Set() });
      }
    }
  }

  // 小鱼干
  const magR = 60 + 45 * G.items.magnet;
  for (const f of L.fish) {
    const d = dist(f, c);
    if (d < magR) { const s = 420 * dt / (d || 1); f.x += (c.x - f.x) * Math.min(1, s); f.y += (c.y - f.y) * Math.min(1, s); }
    if (d < c.r + 8) { f.dead = true; G.fish += f.v; sfx.pickup(); }
  }

  for (const p of L.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  for (const t of L.texts) { t.y -= 34 * dt; t.life -= dt; }

  L.enemies = L.enemies.filter(e => !e.dead);
  L.bullets = L.bullets.filter(b => !b.dead);
  L.ebullets = L.ebullets.filter(b => b.life > 0);
  L.fish = L.fish.filter(f => !f.dead);
  L.parts = L.parts.filter(p => p.life > 0);
  L.texts = L.texts.filter(t => t.life > 0);

  // 胜负
  if (G.nestHp <= 0 || c.hp <= 0) return gameOver(G.nestHp <= 0 ? '猫窝被攻破了……' : '猫咪倒下了……');
  if (L.time <= 0 && !L.boss) levelClear();
}

function levelClear() {
  for (const f of L.fish) G.fish += f.v;   // 自动收走地上的小鱼干
  for (const e of L.enemies) burst(e.x, e.y, '#fff', 6);   // 剩下的入侵者逃跑了
  L.fish = []; L.enemies = []; L.ebullets = []; L.bullets = [];
  G.lastBonus = 10 + 5 * G.level;
  G.fish += G.lastBonus;
  G.miniPlayed = false;
  if (G.level > store.best) { store.best = G.level; save(); }
  sfx.right();
  setState('shop');
  renderShop();
  $('shopBody').scrollTop = 0;
  show('shop');
}

function gameOver(reason) {
  const cleared = G.level - 1;
  if (cleared > store.best) { store.best = cleared; save(); }
  sfx.wrong();
  setState('over');
  $('overBody').innerHTML = `
    <h2>${reason}</h2>
    <div class="stat">到达：第 <b>${G.level}</b> 关<br>赶走入侵者：<b>${G.kills}</b> 只<br>最高纪录：通过 <b>${store.best}</b> 关</div>
    <button class="big" data-action="start">再来一次</button><br>
    <button class="plain" data-action="toMenu">回到主菜单</button>`;
  show('over');
}

// ---------- 头目填空题 ----------
const pyTag = py => store.pinyin ? `<small>${py}</small>` : '';
let quiz = null;
function openQuiz(title) {
  const q = nextFill();
  const opts = shuffle(q.opts.map((o, i) => { const [w, py] = o.split('|'); return { w, py, ok: i === 0 }; }));
  quiz = { q, opts, title, answered: false };
  setState('quiz');
  renderQuiz();
  show('quiz');
}
function renderQuiz(chosen) {
  const { q, opts, title, answered } = quiz;
  const ans = q.opts[0].split('|')[0];
  const sent = q.s.replace('____', `<span class="blank">${answered ? ans : '&nbsp;'}</span>`);
  let h = `<div class="qtitle">⚠ ${title} 答对填空题：本关攻击力 +50%</div>
    <div class="qsent">${sent}</div><div class="opts">`;
  opts.forEach((o, i) => {
    let cls = 'opt';
    if (answered) { if (o.ok) cls += ' right'; else if (i === chosen) cls += ' wrong'; }
    h += `<button class="${cls}" data-action="quizAns" data-i="${i}" ${answered ? 'disabled' : ''}>${o.w}${pyTag(o.py)}</button>`;
  });
  h += '</div>';
  if (answered) {
    const ok = opts[chosen].ok;
    h += `<div class="qfb">
      <div class="res ${ok ? 'ok' : 'no'}">${ok ? '答对了！攻击力 +50%' : '答错了，正确答案是「' + ans + '」'}</div>
      <div class="full">${q.s.replace('____', ans)}<button class="speak" data-action="speak" data-t="${q.s.replace('____', ans)}">🔊</button></div>
      <div>${q.py}</div><div>${q.en}</div></div>
      <button class="big" data-action="quizDone">继续战斗</button>`;
  }
  $('quizBody').innerHTML = h;
}
function answerQuiz(i) {
  if (quiz.answered) return;
  quiz.answered = true;
  const ok = quiz.opts[i].ok;
  if (ok) { L.atkBuff += 0.5; sfx.right(); } else sfx.wrong();
  renderQuiz(i);
  speak(quiz.q.s.replace('____', quiz.q.opts[0].split('|')[0]));
}

// ---------- 商店里的汉字小游戏 ----------
const MINI_TYPES = [
  { id: 'pic', name: '看图选字', tip: '看图片，选出正确的字。' },
  { id: 'comp', name: '偏旁拼字', tip: '两个部分合起来是哪个字？' },
  { id: 'tone', name: '选声调', tip: '这个字读第几声？选出正确的拼音。' },
];
const TONES = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
function toneVariants(py) {
  for (let i = 0; i < py.length; i++) for (const base in TONES) {
    if (TONES[base].includes(py[i])) return [...TONES[base]].map(v => py.slice(0, i) + v + py.slice(i + 1));
  }
  return null;
}
const miniType = () => MINI_TYPES[(G.level - 1) % MINI_TYPES.length];
const miniReward = () => 12 + 3 * G.level;
let mini = null;

function makeMiniQuestion(type) {
  if (type === 'pic') {
    const w = nextPic();
    const wrong = shuffle(PIC_WORDS.filter(x => x.c !== w.c && x.c.length === w.c.length)).slice(0, 3);
    return { prompt: `<div class="qbig">${w.e}</div><div class="qhint">${w.en}</div>`,
      opts: shuffle([{ t: w.c, ok: true }, ...wrong.map(x => ({ t: x.c }))]), info: `${w.e} ${w.c}　${w.py}　${w.en}`, say: w.c };
  }
  if (type === 'comp') {
    const w = nextComp();
    return { prompt: `<div class="qbig">${w.parts[0]} + ${w.parts[1]} = ?</div>`,
      opts: shuffle([{ t: w.c, ok: true }, ...w.wrong.map(x => ({ t: x }))]), info: `${w.c}　${w.py}　${w.en}`, say: w.c };
  }
  const w = nextTone();
  return { prompt: `<div class="qbig">${w.c}</div><div class="qhint">${w.e} ${w.en}</div>`,
    opts: shuffle(toneVariants(w.py).map(v => ({ t: v, ok: v === w.py }))), info: `${w.e} ${w.c}　${w.py}　${w.en}`, say: w.c };
}
function openMini() {
  if (G.miniPlayed) return;
  G.miniPlayed = true;
  const type = miniType();
  mini = { type, i: 0, right: 0, total: 3, q: makeMiniQuestion(type.id), chosen: -1 };
  setState('mini');
  renderMini();
  show('mini');
}
function renderMini() {
  const m = mini, q = m.q, answered = m.chosen >= 0;
  let h = `<div class="qtitle">汉字小游戏 · ${m.type.name}（${m.i + 1}/${m.total}）</div>
    <div class="qhint">${m.type.tip} 每答对一题 +${miniReward()} 🐟</div>${q.prompt}<div class="opts">`;
  q.opts.forEach((o, i) => {
    let cls = 'opt';
    if (answered) { if (o.ok) cls += ' right'; else if (i === m.chosen) cls += ' wrong'; }
    h += `<button class="${cls}" data-action="miniAns" data-i="${i}" ${answered ? 'disabled' : ''}>${o.t}</button>`;
  });
  h += '</div>';
  if (answered) {
    const ok = q.opts[m.chosen].ok;
    h += `<div class="qfb"><div class="res ${ok ? 'ok' : 'no'}">${ok ? '答对了！' : '答错了'}</div>
      <div class="full">${q.info}<button class="speak" data-action="speak" data-t="${q.say}">🔊</button></div></div>
      <button class="big" data-action="miniNext">${m.i + 1 < m.total ? '下一题' : '看结果'}</button>`;
  }
  $('miniBody').innerHTML = h;
}
function answerMini(i) {
  const m = mini;
  if (m.chosen >= 0) return;
  m.chosen = i;
  if (m.q.opts[i].ok) { m.right++; sfx.right(); } else sfx.wrong();
  renderMini();
  speak(m.q.say);
}
function nextMini() {
  const m = mini;
  if (m.i + 1 < m.total) { m.i++; m.chosen = -1; m.q = makeMiniQuestion(m.type.id); return renderMini(); }
  const perfect = m.right === m.total;
  const reward = m.right * miniReward() + (perfect ? 15 : 0);
  G.fish += reward;
  if (reward) sfx.buy();
  $('miniBody').innerHTML = `<h2>${perfect ? '全部答对！太棒了！' : '小游戏结束'}</h2>
    <div class="stat">答对 <b>${m.right}</b> / ${m.total} 题${perfect ? '<br>全对奖励 +15 🐟' : ''}<br>一共获得 <b>${reward}</b> 🐟 小鱼干</div>
    <button class="big" data-action="miniDone">回到商店</button>`;
}

// ---------- 商店 ----------
function card({ icon, name, py, desc, lv, btns, equipped }) {
  return `<div class="card${equipped ? ' equipped' : ''}"><div class="hd"><img class="ic" src="${ICONS.url[icon]}" alt=""><div>
    <div class="nm">${name}</div>${store.pinyin ? `<div class="py">${py}</div>` : ''}</div></div>
    <div class="ds">${desc}</div><div class="lv">${lv}</div><div class="row">${btns}</div></div>`;
}
const btn = (action, id, label, enabled = true) => `<button data-action="${action}" data-id="${id}" ${enabled ? '' : 'disabled'}>${label}</button>`;

function renderShop() {
  const fish = G.fish, mt = miniType();
  let h = `<div class="shophead"><h2>第 ${G.level} 关完成！<span style="font-size:14px;font-weight:400">　过关奖励 +${G.lastBonus} 🐟</span></h2>
    <div class="fishbar">🐟 ${fish}</div></div>
    <div class="minicard"><div class="txt"><b>汉字小游戏 · ${mt.name}</b><br>答 3 道题，每答对一题 +${miniReward()} 🐟，全对再 +15 🐟。</div>
    ${btn('mini', '', G.miniPlayed ? '已玩过' : '开始', !G.miniPlayed)}</div>`;

  h += '<h3>武器</h3><div class="cards">';
  for (const w of WEAPONS) {
    const lv = G.weapons[w.id] || 0;
    let btns, lvTxt;
    if (!lv) { lvTxt = '未拥有'; btns = btn('buyW', w.id, `购买 ${w.cost} 🐟`, fish >= w.cost); }
    else {
      lvTxt = `等级 ${lv}/${WEAPON_MAX}　伤害 ${Math.round(weaponDmg(w, lv))}`;
      const c = weaponUpCost(w, lv);
      btns = (lv < WEAPON_MAX ? btn('upW', w.id, `升级 ${c} 🐟`, fish >= c) : btn('', '', '已满级', false))
        + btn('eqW', w.id, G.cur === w.id ? '使用中' : '装备', G.cur !== w.id);
    }
    h += card({ icon: w.id, name: w.name, py: w.py, desc: w.desc, lv: lvTxt, btns, equipped: G.cur === w.id });
  }
  h += '</div><h3>道具</h3><div class="cards">';
  for (const it of ITEMS) {
    const lv = G.items[it.id], c = itemCost(it, lv);
    const btns = lv < it.max ? btn('item', it.id, `${lv ? '升级' : '购买'} ${c} 🐟`, fish >= c) : btn('', '', '已满级', false);
    h += card({ icon: it.id, name: it.name, py: it.py, desc: it.desc, lv: lv ? `等级 ${lv}/${it.max}` : '未拥有', btns });
  }
  h += '</div><h3>强化</h3><div class="cards">';
  for (const s of STATS) {
    const lv = G.stats[s.id], c = statCost(lv);
    const btns = lv < s.max ? btn('stat', s.id, `强化 ${c} 🐟`, fish >= c) : btn('', '', '已满级', false);
    h += card({ icon: s.id, name: s.name, py: s.py, desc: s.desc, lv: `等级 ${lv}/${s.max}`, btns });
  }
  const hurt = G.nestHp < nestMaxHp();
  h += card({ icon: 'repair', name: '修补猫窝', py: 'xiūbǔ māowō', desc: `恢复猫窝 ${REPAIR_HP} 点生命。`,
    lv: `猫窝生命 ${Math.ceil(G.nestHp)}/${nestMaxHp()}`,
    btns: btn('repair', '', hurt ? `修补 ${REPAIR_COST} 🐟` : '不需要修补', hurt && fish >= REPAIR_COST) });
  const nextBoss = isBossLevel(G.level + 1);
  h += `</div><div class="shopfoot"><button class="big" data-action="next">开始第 ${G.level + 1} 关${nextBoss ? '（头目关！）' : ''}</button></div>`;
  const body = $('shopBody'), st = body.scrollTop;
  body.innerHTML = h;
  body.scrollTop = st;
}

function pay(cost) { if (G.fish < cost) return false; G.fish -= cost; sfx.buy(); return true; }
function shopAction(action, id) {
  if (action === 'buyW') { const w = weaponDef(id); if (!G.weapons[id] && pay(w.cost)) { G.weapons[id] = 1; G.cur = id; } }
  else if (action === 'upW') { const w = weaponDef(id), lv = G.weapons[id]; if (lv && lv < WEAPON_MAX && pay(weaponUpCost(w, lv))) G.weapons[id]++; }
  else if (action === 'eqW') { if (G.weapons[id]) G.cur = id; }
  else if (action === 'item') { const it = ITEMS.find(x => x.id === id), lv = G.items[id]; if (lv < it.max && pay(itemCost(it, lv))) G.items[id]++; }
  else if (action === 'stat') {
    const s = STATS.find(x => x.id === id), lv = G.stats[id];
    if (lv < s.max && pay(statCost(lv))) { G.stats[id]++; if (id === 'nestHp') G.nestHp += 100; }
  }
  else if (action === 'repair') { if (G.nestHp < nestMaxHp() && pay(REPAIR_COST)) G.nestHp = Math.min(nestMaxHp(), G.nestHp + REPAIR_HP); }
  renderShop();
}

// ---------- 按钮事件 ----------
function refreshToggles() {
  for (const n of [1, 2]) {
    $('tglPinyin' + n).textContent = '拼音：' + (store.pinyin ? '开' : '关');
    $('tglMute' + n).textContent = '声音：' + (store.mute ? '关' : '开');
  }
  $('bestText').textContent = store.best ? `最高纪录：通过 ${store.best} 关` : '';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  initAudio();
  const a = b.dataset.action, id = b.dataset.id;
  switch (a) {
    case 'start': newGame(); break;
    case 'resume': resumeGame(); break;
    case 'toMenu': G = null; L = null; setState('menu'); refreshToggles(); show('menu'); break;
    case 'togglePinyin': store.pinyin = !store.pinyin; save(); refreshToggles(); break;
    case 'toggleMute': store.mute = !store.mute; save(); refreshToggles(); break;
    case 'quizAns': answerQuiz(+b.dataset.i); break;
    case 'quizDone': show(null); setState('playing'); break;
    case 'speak': speak(b.dataset.t); break;
    case 'mini': openMini(); break;
    case 'miniAns': answerMini(+b.dataset.i); break;
    case 'miniNext': nextMini(); break;
    case 'miniDone': setState('shop'); renderShop(); show('shop'); break;
    case 'next': G.level++; startLevel(); break;
    case 'buyW': case 'upW': case 'eqW': case 'item': case 'stat': case 'repair': shopAction(a, id); break;
  }
});

// ---------- 绘图 ----------
function ell(x, y, rx, ry, fill, stroke) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
const OUT = '#4a3423';

function drawGround() {
  ctx.fillStyle = '#5aa84e'; ctx.fillRect(cam.x - 50, cam.y - 50, W / scale + 100, H / scale + 100);
  ctx.fillStyle = '#8fd16f'; ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.fillStyle = '#86c966';
  for (let x = 0; x < WORLD.w; x += 100) for (let y = (x / 100 % 2) * 100; y < WORLD.h; y += 200) ctx.fillRect(x, y, 100, 100);
  // 通向猫窝的小路
  ctx.fillStyle = '#e3cf9a';
  ell(NEST.x, NEST.y + 10, 120, 95, '#e3cf9a');
  for (const d of decor) {
    if (d.x < cam.x - 20 || d.x > cam.x + W / scale + 20 || d.y < cam.y - 20 || d.y > cam.y + H / scale + 20) continue;
    if (Math.hypot(d.x - NEST.x, d.y - NEST.y) < 130) continue;
    if (d.t === 'flower') {
      ctx.fillStyle = d.c;
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5; ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * 4 * d.s, d.y + Math.sin(a) * 4 * d.s, 3 * d.s, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#f29d38'; ctx.beginPath(); ctx.arc(d.x, d.y, 2.5 * d.s, 0, TAU); ctx.fill();
    } else {
      ctx.strokeStyle = '#4f9a45'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = -1; i <= 1; i++) { ctx.moveTo(d.x + i * 3, d.y); ctx.lineTo(d.x + i * 6 * d.s, d.y - 9 * d.s); }
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#3f7d38'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
}

function drawFence() {
  if (!G || !G.items.fence) return;
  ctx.strokeStyle = 'rgba(120,120,130,.8)'; ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(NEST.x, NEST.y, FENCE_R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n, x = NEST.x + Math.cos(a) * FENCE_R, y = NEST.y + Math.sin(a) * FENCE_R;
    ctx.fillStyle = '#b98a55'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
    ctx.fillRect(x - 3, y - 12, 6, 16); ctx.strokeRect(x - 3, y - 12, 6, 16);
  }
}

function drawNest() {
  const x = NEST.x, y = NEST.y, flash = L && L.nestFlash > 0;
  ctx.lineWidth = 3; ctx.strokeStyle = OUT;
  ell(x, y + 34, 54, 14, 'rgba(0,0,0,.15)');
  // 纸箱小屋
  ctx.fillStyle = flash ? '#ffd0c0' : '#d9a765';
  ctx.beginPath(); ctx.roundRect(x - 44, y - 18, 88, 54, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = flash ? '#ffb0a0' : '#e8743b';
  ctx.beginPath(); ctx.moveTo(x - 56, y - 16); ctx.lineTo(x, y - 58); ctx.lineTo(x + 56, y - 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5b3d28';
  ctx.beginPath(); ctx.arc(x, y + 36, 19, Math.PI, 0); ctx.lineTo(x + 19, y + 36); ctx.lineTo(x - 19, y + 36); ctx.fill(); ctx.stroke();
  // 软垫
  ell(x, y + 34, 15, 5, '#ffadc6');
  // 牌子
  ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.roundRect(x - 22, y - 12, 44, 20, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = OUT; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('猫窝', x, y - 1);
}

function drawTurret(t) {
  ctx.lineWidth = 2.5; ctx.strokeStyle = OUT;
  ell(t.x, t.y + 8, 14, 5, 'rgba(0,0,0,.15)');
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.aim);
  ctx.fillStyle = '#8c98a8'; ctx.fillRect(4, -4, 18, 8); ctx.strokeRect(4, -4, 18, 8);
  ctx.restore();
  ell(t.x, t.y, 12, 12, '#ffd84a', OUT);
  // 小猫耳朵
  ctx.fillStyle = '#ffd84a';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(t.x + s * 4, t.y - 10); ctx.lineTo(t.x + s * 10, t.y - 18); ctx.lineTo(t.x + s * 11, t.y - 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
}

function drawFish(f) {
  ctx.save(); ctx.translate(f.x, f.y + Math.sin(performance.now() / 200 + f.x) * 2);
  ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.fillStyle = '#ffd27a';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(12, -5); ctx.lineTo(12, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ell(0, 0, 8, 4.5, '#ffd27a', OUT);
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(-4, -1, 1, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawCat(c) {
  const face = Math.cos(c.aim) < 0 ? -1 : 1;
  const bob = c.moving ? Math.sin(c.walk) * 2 : Math.sin(performance.now() / 400) * 0.8;
  if (c.inv > 0 && Math.floor(c.inv * 20) % 2) ctx.globalAlpha = 0.5;
  ell(c.x, c.y + 18, 17, 5, 'rgba(0,0,0,.18)');
  if (L.catnipT > 0) { ctx.strokeStyle = 'rgba(156,255,107,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, 27 + Math.sin(performance.now() / 80) * 2, 0, TAU); ctx.stroke(); }
  ctx.save(); ctx.translate(c.x, c.y + bob); ctx.scale(face, 1);
  ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
  const FUR = '#aab6c8', DARK = '#7b889c';
  // 尾巴
  ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.lineCap = 'round';
  const tw = Math.sin(performance.now() / 180) * 4;
  ctx.beginPath(); ctx.moveTo(-10, 10); ctx.quadraticCurveTo(-24, 8, -22 + tw * 0.4, -6 + tw); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = DARK; ctx.stroke();
  ctx.lineWidth = 2.5; ctx.strokeStyle = OUT;
  // 脚
  const step = c.moving ? Math.sin(c.walk) * 3 : 0;
  ell(-6 + step, 16, 5, 3.5, '#fff', OUT); ell(6 - step, 16, 5, 3.5, '#fff', OUT);
  // 身体
  ell(0, 6, 13, 11, FUR, OUT);
  ell(0, 9, 7, 6, '#fff');
  // 项圈和铃铛
  ctx.strokeStyle = '#2bb5a0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-10, -1); ctx.quadraticCurveTo(0, 4, 10, -1); ctx.stroke();
  ctx.lineWidth = 1.5; ell(0, 3, 3, 3, '#ffd84a', OUT);
  ctx.lineWidth = 2.5; ctx.strokeStyle = OUT;
  // 耳朵
  for (const s of [-1, 1]) {
    ctx.fillStyle = FUR; ctx.beginPath(); ctx.moveTo(s * 5, -20); ctx.lineTo(s * 14, -30); ctx.lineTo(s * 15, -15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffadc6'; ctx.beginPath(); ctx.moveTo(s * 8, -20); ctx.lineTo(s * 12.5, -25); ctx.lineTo(s * 13, -18); ctx.closePath(); ctx.fill();
  }
  // 头
  ell(0, -12, 15, 13, FUR, OUT);
  // 花纹
  ctx.strokeStyle = DARK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-3, -24); ctx.lineTo(-3, -20); ctx.moveTo(0, -25); ctx.lineTo(0, -20); ctx.moveTo(3, -24); ctx.lineTo(3, -20); ctx.stroke();
  // 脸
  ell(3, -8, 7, 5, '#fff');
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(-2, -13, 2.2, 0, TAU); ctx.arc(9, -13, 2.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff8fa3'; ctx.beginPath(); ctx.moveTo(2, -9.5); ctx.lineTo(6, -9.5); ctx.lineTo(4, -7.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(4, -7.5); ctx.quadraticCurveTo(2, -4.5, 0.5, -6.5); ctx.moveTo(4, -7.5); ctx.quadraticCurveTo(6, -4.5, 7.5, -6.5); ctx.stroke();
  ctx.restore();
  // 枪
  const w = weaponDef(G.cur);
  ctx.save(); ctx.translate(c.x, c.y + 4 + bob); ctx.rotate(c.aim); ctx.scale(1, face);
  ctx.lineWidth = 2; ctx.strokeStyle = OUT;
  const len = { pistol: 16, shotgun: 22, smg: 20, grenade: 22, laser: 24 }[w.id];
  const th = { pistol: 6, shotgun: 8, smg: 6, grenade: 11, laser: 4 }[w.id];
  ctx.fillStyle = '#6b7686'; ctx.fillRect(8, -th / 2, len, th); ctx.strokeRect(8, -th / 2, len, th);
  ctx.fillStyle = w.color; ctx.fillRect(8 + len - 5, -th / 2, 5, th); ctx.strokeRect(8 + len - 5, -th / 2, 5, th);
  ctx.fillStyle = '#8a5a3a'; ctx.fillRect(8, 0, 6, 7); ctx.strokeRect(8, 0, 6, 7);
  ell(11, 3, 4.5, 4, '#fff', OUT);   // 小爪子
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawEnemy(e) {
  const wob = Math.sin(e.t * 10) * 1.5;
  ell(e.x, e.y + e.r * 0.9, e.r * 0.9, e.r * 0.3, 'rgba(0,0,0,.18)');
  ctx.save(); ctx.translate(e.x, e.y + (e.type === 'crow' ? Math.sin(e.t * 5) * 4 - 8 : wob * 0.4)); ctx.scale(e.face, 1);
  ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const fl = e.flash > 0;
  const r = e.r;
  if (e.type === 'mouse') {
    const c = fl ? '#fff' : '#b9a58f';
    ctx.beginPath(); ctx.moveTo(-r, 4); ctx.quadraticCurveTo(-r - 12, 8 + wob, -r - 16, -2); ctx.strokeStyle = '#e59aa0'; ctx.stroke(); ctx.strokeStyle = OUT;
    ell(-5, -r + 1, 6, 6, c, OUT); ell(6, -r, 6, 6, c, OUT);
    ell(-5, -r + 1, 3, 3, '#f5b8bd'); ell(6, -r, 3, 3, '#f5b8bd');
    ell(0, 0, r, r * 0.85, c, OUT);
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(5, -3, 1.8, 0, TAU); ctx.fill();
    ell(r - 1, 2, 2.5, 2.5, '#ff8fa3');
  } else if (e.type === 'roach') {
    const c = fl ? '#fff' : '#8a4f2a';
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 5, 0); ctx.lineTo(i * 5 - 2, r + 3 + (i ? wob : -wob)); ctx.moveTo(i * 5, 0); ctx.lineTo(i * 5 - 2, -r - 3 - (i ? wob : -wob)); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(r, -2); ctx.quadraticCurveTo(r + 8, -8, r + 12, -4 + wob); ctx.moveTo(r, 2); ctx.quadraticCurveTo(r + 8, 8, r + 12, 4 - wob); ctx.stroke();
    ctx.lineWidth = 2; ell(0, 0, r + 2, r * 0.7, c, OUT);
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r - 4, 0); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r - 2, -2.5, 1.5, 0, TAU); ctx.arc(r - 2, 2.5, 1.5, 0, TAU); ctx.fill();
  } else if (e.type === 'raccoon') {
    const c = fl ? '#fff' : '#8d8f96';
    // 条纹尾巴
    ctx.lineWidth = 11; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(-r + 2, 6); ctx.quadraticCurveTo(-r - 16, 4, -r - 14, -12 + wob); ctx.stroke();
    ctx.lineWidth = 7; ctx.strokeStyle = c; ctx.stroke();
    ctx.setLineDash([4, 6]); ctx.strokeStyle = '#3d3f46'; ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2.5; ctx.strokeStyle = OUT;
    ell(-9, -r + 2, 6, 6, c, OUT); ell(9, -r + 2, 6, 6, c, OUT);
    ell(0, 0, r, r * 0.9, c, OUT);
    ctx.fillStyle = '#3d3f46'; ctx.beginPath(); ctx.ellipse(3, -4, r * 0.8, 5.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -4, 2.5, 0, TAU); ctx.arc(9, -4, 2.5, 0, TAU); ctx.fill();
    ell(4, 5, 6, 4.5, '#e8e8ec'); ell(6, 3.5, 2.2, 1.8, OUT);
    // 小布袋
    ell(-r + 3, 8, 6, 7, '#d9a765', OUT);
  } else if (e.type === 'crow') {
    const c = fl ? '#fff' : '#3a3d52';
    const flap = Math.sin(e.t * 14) * 9;
    ctx.fillStyle = c;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * -4 - 12, -8 - flap * s * (s > 0 ? 1 : -1)); ctx.lineTo(-10, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ell(0, 0, r, r * 0.8, c, OUT);
    ctx.fillStyle = '#f2b632'; ctx.beginPath(); ctx.moveTo(r - 3, -3); ctx.lineTo(r + 9, 1); ctx.lineTo(r - 3, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, -3, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(6, -3, 1.4, 0, TAU); ctx.fill();
  } else if (e.type === 'boss') {
    const c = fl ? '#fff' : '#a9703f', dk = '#6f4524';
    ctx.lineWidth = 3.5;
    ctx.lineWidth = 9; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(-r + 4, 4); ctx.quadraticCurveTo(-r - 18, 0, -r - 14, -22 + wob * 2); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = dk; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT;
    ell(-14, r - 2, 10, 6, dk, OUT); ell(14, r - 2, 10, 6, dk, OUT);
    ell(0, 6, r, r * 0.8, c, OUT);
    // 耷拉的耳朵
    ell(-20, -24, 9, 16, dk, OUT); ell(26, -24, 9, 16, dk, OUT);
    ell(4, -18, 26, 22, c, OUT);
    ell(10, -9, 14, 10, '#f0d9bd');
    ell(14, -14, 5, 3.5, OUT);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -24, 4.5, 0, TAU); ctx.arc(16, -24, 4.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c8402d'; ctx.beginPath(); ctx.arc(-3, -24, 2.2, 0, TAU); ctx.arc(17, -24, 2.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-11, -33); ctx.lineTo(1, -28); ctx.moveTo(24, -33); ctx.lineTo(12, -28); ctx.stroke();   // 生气的眉毛
    ctx.beginPath(); ctx.moveTo(3, -4); ctx.quadraticCurveTo(10, 0, 18, -4); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(6, -4, 3, 4); ctx.fillRect(13, -4, 3, 4);
    // 带刺项圈
    ctx.strokeStyle = '#c8402d'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(4, 9, 26, 0); ctx.stroke();
    ctx.fillStyle = '#e6e6e6'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(4 + i * 12, 4 - Math.abs(i) * 2, 2.5, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  // 血条
  if (e.hp < e.maxHp || e.type === 'boss') {
    const bw = e.type === 'boss' ? 90 : r * 2, by = e.y - r - (e.type === 'boss' ? 30 : 14);
    ctx.fillStyle = OUT; ctx.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = e.type === 'boss' ? '#c8402d' : '#ff7a5c'; ctx.fillRect(e.x - bw / 2, by, bw * clamp(e.hp / e.maxHp, 0, 1), 4);
  }
}

function drawBullet(b) {
  ctx.lineWidth = 1.5; ctx.strokeStyle = OUT;
  if (b.kind === 'laser') {
    const a = Math.atan2(b.vy, b.vx);
    ctx.strokeStyle = '#ffb0b0'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x - Math.cos(a) * 26, b.y - Math.sin(a) * 26); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.stroke();
  } else if (b.kind === 'grenade') {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.life * 12);
    ctx.fillStyle = b.color; ctx.fillRect(-6, -8, 12, 16); ctx.strokeRect(-6, -8, 12, 16);
    ctx.fillStyle = '#e8743b'; ctx.fillRect(-6, -3, 12, 6);
    ctx.restore();
  } else if (b.kind === 'smg') {
    const a = Math.atan2(b.vy, b.vx);
    ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x - Math.cos(a) * 8, b.y - Math.sin(a) * 8); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = b.color; ctx.lineWidth = 2.5; ctx.stroke();
  } else {
    ell(b.x, b.y, b.r, b.r, b.color, OUT);
  }
}

function hudBar(x, y, w, label, v, max, color) {
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.roundRect(x, y, w, 18, 6); ctx.fill();
  ctx.fillStyle = '#6b5a4a'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, 14, 4); ctx.fill();
  const f = clamp(v / max, 0, 1);
  if (f > 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, Math.max(6, (w - 4) * f), 14, 4); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`${label} ${Math.max(0, Math.ceil(v))}`, x + 7, y + 10);
}
function outlined(text, x, y, size, color = '#fff', align = 'center') {
  ctx.font = `bold ${size}px "PingFang SC","Microsoft YaHei",sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
}

function drawHUD() {
  const bw = Math.min(150, W * 0.34);
  hudBar(8, 8, bw, '猫咪', L.cat.hp, catMaxHp(), '#ff7a8a');
  hudBar(8, 30, bw, '猫窝', G.nestHp, nestMaxHp(), '#ffb347');
  const narrow = W < 520, cx = narrow ? W - 58 : W / 2;
  const al = narrow ? 'right' : 'center';
  outlined(`第 ${G.level} 关`, cx, 18, 17, '#fff', al);
  if (L.time > 0) outlined(`${Math.ceil(L.time)} 秒`, cx, 42, 22, L.time <= 10 ? '#ffe066' : '#fff', al);
  else outlined(L.boss ? '打败头目！' : '过关！', cx, 42, 20, L.boss ? '#ff9a8a' : '#c9ff9e', al);
  outlined(`🐟 ${G.fish}`, narrow ? W - 58 : W - 60, narrow ? 68 : 28, 18, '#ffe9a8', 'right');
  // 武器与增益
  const w = weaponDef(G.cur);
  let y = 62;
  y += 4;
  ctx.drawImage(ICONS.canvas[w.id], 8, y - 15, 30, 30);
  outlined(`${w.name} Lv${G.weapons[w.id]}`, 42, y, 14, '#fff', 'left'); y += 28;
  if (G.items.catnip) {
    ctx.drawImage(ICONS.canvas.catnip, 10, y - 13, 26, 26);
    outlined(`猫薄荷 ×${L.catnipLeft}${L.catnipT > 0 ? '（生效中）' : ''}`, 42, y, 14, '#c9ff9e', 'left'); y += 26;
  }
  if (L.atkBuff > 0) outlined(`攻击力 +${Math.round(L.atkBuff * 100)}%`, 10, y, 14, '#ffe066', 'left');
  $('btnCatnip').disabled = L.catnipLeft <= 0 || L.catnipT > 0;
  $('btnCatnip').style.display = G.items.catnip ? '' : 'none';

  if (L.banner > 0) {
    ctx.globalAlpha = clamp(L.banner, 0, 1);
    outlined(`第 ${G.level} 关`, W / 2, H * 0.3, 46, '#ffe066');
    outlined(L.isBoss ? '头目关！准备回答问题' : '保卫猫窝！', W / 2, H * 0.3 + 44, 20);
    ctx.globalAlpha = 1;
  }
  // 头目方向提示
  if (L.boss) {
    const sx = (L.boss.x - cam.x) * scale, sy = (L.boss.y - cam.y) * scale;
    if (sx < 0 || sx > W || sy < 0 || sy > H) {
      const a = Math.atan2(sy - H / 2, sx - W / 2);
      const px = clamp(W / 2 + Math.cos(a) * W, 30, W - 30), py = clamp(H / 2 + Math.sin(a) * H, 90, H - 30);
      outlined('头目', px, py, 15, '#ff9a8a');
    }
  }
  // 摇杆
  if (joy.active) {
    ctx.globalAlpha = 0.5;
    ell(joy.sx, joy.sy, 50, 50, 'rgba(255,255,255,.25)', '#fff');
    ell(joy.sx + joy.dx * 50, joy.sy + joy.dy * 50, 22, 22, '#fff');
    ctx.globalAlpha = 1;
  }
}

function render() {
  const dpr = canvas._dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vw = W / scale, vh = H / scale;
  const focus = L ? L.cat : NEST;
  cam.x = vw >= WORLD.w ? (WORLD.w - vw) / 2 : clamp(focus.x - vw / 2, 0, WORLD.w - vw);
  cam.y = vh >= WORLD.h ? (WORLD.h - vh) / 2 : clamp(focus.y - vh / 2, 0, WORLD.h - vh);
  let shx = 0, shy = 0;
  if (L && L.shake > 0 && state === 'playing') { shx = rand(-4, 4); shy = rand(-4, 4); }
  ctx.save();
  ctx.scale(scale, scale); ctx.translate(-cam.x + shx, -cam.y + shy);
  drawGround();
  drawFence();
  if (!L) { drawNest(); ctx.restore(); return; }
  for (const f of L.fish) drawFish(f);
  // 按 y 排序，产生前后遮挡
  const objs = [{ y: NEST.y + 30, draw: drawNest }, { y: L.cat.y, draw: () => drawCat(L.cat) }];
  for (const t of L.turrets) objs.push({ y: t.y, draw: () => drawTurret(t) });
  for (const e of L.enemies) objs.push({ y: e.y, draw: () => drawEnemy(e) });
  objs.sort((a, b) => a.y - b.y);
  for (const o of objs) o.draw();
  for (const b of L.bullets) drawBullet(b);
  for (const b of L.ebullets) { ell(b.x, b.y, b.r, b.r, '#5b4a6b', OUT); ell(b.x - 1.5, b.y - 1.5, 2, 2, '#b8a8c8'); }
  for (const p of L.parts) {
    if (p.color === 'boom') {
      ctx.globalAlpha = clamp(p.life / 0.25, 0, 1) * 0.6;
      ell(p.x, p.y, p.r * (1.1 - p.life * 2), p.r * (1.1 - p.life * 2), '#ffcf70');
    } else {
      ctx.globalAlpha = clamp(p.life * 3, 0, 1);
      ell(p.x, p.y, p.r, p.r, p.color);
    }
  }
  ctx.globalAlpha = 1;
  for (const t of L.texts) { ctx.globalAlpha = clamp(t.life * 2, 0, 1); outlined(t.text, t.x, t.y, t.size, t.color); }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawHUD();
}

// ---------- 主循环 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === 'playing') update(dt);
  render();
  requestAnimationFrame(frame);
}
refreshToggles();
setState('menu');
requestAnimationFrame(frame);

// 调试接口
window.__cat = { get G() { return G; }, get L() { return L; }, get state() { return state; }, set auto(v) { touchMode = v; }, update };
})();
