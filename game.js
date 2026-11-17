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

// ---------- 声音 ----------（合成器在 sound.js）
SFX.setMuted(() => store.mute);
const initAudio = () => SFX.init();
const sfx = new Proxy({}, { get: (_, name) => () => SFX.play(name) });
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
    if (k >= '1' && k <= '5') { const w = WEAPONS[+k - 1], t = bestTier(w.id); if (t >= 0) { G.eq = { id: w.id, tier: t }; sfx.switch(); } }
    if (k === 'p' || k === 'escape') pauseGame();
  } else if (state === 'paused' && (k === 'p' || k === 'escape')) resumeGame();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; if (state === 'playing') pauseGame(); });

canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => { initAudio(); skipClear(); mouse.x = e.clientX; mouse.y = e.clientY; mouse.down = true; touchMode = false; });
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('touchstart', e => {
  e.preventDefault(); initAudio(); skipClear();
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
const itemDef = id => ITEMS.find(it => it.id === id);
const tierColor = t => t >= 5 ? `hsl(${Math.floor(performance.now() / 6) % 360} 90% 58%)` : TIERS[t].color;
const ilv = id => (L && L.on && L.on[id]) || 0;   // 本关生效中的道具强度（0 = 没有生效）
const fenceSlow = () => 0.2 + 0.1 * ilv('fence');
const itemUpCost = (it, lv) => Math.round(it.cost * 1.5 * lv);
const tierBadge = (t, cls = '') => `<span class="tier t${t} ${cls}" style="--tc:${TIERS[t].color}">${TIERS[t].id}</span>`;

// 某把武器在某个品级下的实际数值
function weaponStats(id, tier) {
  const w = weaponDef(id), T = TIERS[tier];
  const s = {
    dmg: w.dmg * T.dmg, interval: w.interval * T.spd, speed: w.speed, jitter: w.jitter, pierce: w.pierce, life: w.life, color: w.color,
    count: w.count + (id === 'shotgun' ? tier : 0), spread: w.spread + (id === 'shotgun' ? tier * 0.05 : 0),
    explode: w.explode ? w.explode + 14 * tier : 0, splash: 0, r: w.r + (id === 'laser' ? tier * 1.6 : 0),
  };
  if (id === 'shotgun') s.dmg *= w.count / s.count;   // 弹丸多了，但总伤害只按品级增长
  if (w.splash && tier >= w.splash[0]) s.splash = w.splash[1] + w.splash[2] * (tier - w.splash[0]);
  s.dps = s.dmg * s.count / s.interval;
  s.area = s.explode ? `爆炸半径 ${s.explode}` : s.splash ? `溅射半径 ${s.splash}` : id === 'laser' ? '穿透整排' : id === 'shotgun' ? `扇形 ${Math.round(s.spread * 57.3)}°` : '单体';
  return s;
}

// 武器库：inv[武器][品级] = 数量
const freshInv = () => Object.fromEntries(WEAPONS.map(w => [w.id, TIERS.map(() => 0)]));
const bestTier = (id, r = G) => { for (let t = TIERS.length - 1; t >= 0; t--) if (r.inv[id][t] > 0) return t; return -1; };
function ownedList(r = G) {
  const list = [];
  for (const w of WEAPONS) for (let t = 0; t < TIERS.length; t++) if (r.inv[w.id][t] > 0) list.push({ id: w.id, tier: t, n: r.inv[w.id][t] });
  return list;
}
function fixEquip(r = G) {
  if (r.eq && r.inv[r.eq.id] && r.inv[r.eq.id][r.eq.tier] > 0) return;
  const own = ownedList(r);
  if (!own.length) { r.inv.pistol[0] = 1; r.eq = { id: 'pistol', tier: 0 }; return; }   // 保底：至少有一把枪
  const best = own.reduce((a, b) => weaponStats(b.id, b.tier).dps > weaponStats(a.id, a.tier).dps ? b : a);
  r.eq = { id: best.id, tier: best.tier };
}
function mergeWeapon(id, t) {
  const need = MERGE_NEED[t];
  if (t >= TIERS.length - 1 || G.inv[id][t] < need) return false;
  G.inv[id][t] -= need; G.inv[id][t + 1]++;
  if (G.eq.id === id && G.eq.tier === t && G.inv[id][t] === 0) G.eq = { id, tier: t + 1 };
  return true;
}
function mergeAll() {
  let top = null;
  for (const w of WEAPONS) for (let t = 0; t < TIERS.length - 1; t++) {
    while (mergeWeapon(w.id, t)) if (!top || t + 1 > top.to) top = { id: w.id, from: t, to: t + 1 };
  }
  fixEquip();
  return top;
}
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

const freshRun = () => {
  const inv = freshInv(); inv.pistol[0] = 1;
  return {
    level: 1, fish: 0, kills: 0,
    inv, eq: { id: 'pistol', tier: 0 },
    items: Object.fromEntries(ITEMS.map(it => [it.id, { uses: 0, lv: 1 }])),
    stats: { catHp: 0, catSpd: 0, nestHp: 0 },
    nestHp: 300, miniPlayed: false, lastBonus: 0, stars: {}, lastStars: 0, lastStarBonus: 0, lastCatLoss: 0, lastNestLoss: 0,
  };
};

// 进度存档：每次过关进商店、以及在商店里的每次操作后自动保存
const SAVE_KEY = 'catDefenseRun';
function saveRun() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { /* 忽略 */ } }
function clearRun() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 忽略 */ } }
function loadRun() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!d || !(d.level >= 1)) return null;
    const run = freshRun();
    for (const k of ['level', 'fish', 'kills', 'nestHp', 'lastBonus', 'lastStars', 'lastStarBonus', 'lastCatLoss', 'lastNestLoss']) if (Number.isFinite(d[k])) run[k] = d[k];
    run.miniPlayed = !!d.miniPlayed;
    // 武器：新存档是 inv（每个品级的数量）；旧存档是 weapons（每把武器一个等级），转成对应品级
    run.inv = freshInv();
    if (d.inv) {
      for (const w of WEAPONS) for (let t = 0; t < TIERS.length; t++) { const n = d.inv[w.id] && d.inv[w.id][t]; if (n > 0) run.inv[w.id][t] = clamp(Math.floor(n), 0, 999); }
    } else if (d.weapons) {
      for (const w of WEAPONS) { const lv = d.weapons[w.id]; if (lv >= 1) run.inv[w.id][clamp(Math.floor((lv - 1) / 2), 0, 2)] = 1; }
    }
    const eq = d.eq && WEAPONS.some(w => w.id === d.eq.id) ? { id: d.eq.id, tier: clamp(d.eq.tier | 0, 0, TIERS.length - 1) }
      : typeof d.cur === 'string' && run.inv[d.cur] ? { id: d.cur, tier: Math.max(bestTier(d.cur, run), 0) } : null;
    run.eq = eq || { id: 'pistol', tier: 0 };
    fixEquip(run);
    // 道具：新存档是 {uses, lv}；旧存档是一个数字（永久拥有），转成 3 次使用次数
    for (const it of ITEMS) {
      const v = d.items && d.items[it.id];
      if (typeof v === 'number') { if (v > 0) run.items[it.id] = { uses: 3, lv: clamp(Math.floor(v), 1, it.max) }; }
      else if (v && typeof v === 'object') run.items[it.id] = { uses: clamp(Math.floor(v.uses) || 0, 0, ITEM_CAP), lv: clamp(Math.floor(v.lv) || 1, 1, it.max) };
    }
    for (const st of STATS) if (d.stats && d.stats[st.id] >= 0) run.stats[st.id] = clamp(Math.floor(d.stats[st.id]), 0, st.max);
    if (d.stars && typeof d.stars === 'object') for (const k in d.stars) if (d.stars[k] >= 1 && d.stars[k] <= 3) run.stars[k] = d.stars[k] | 0;
    return run;
  } catch (e) { return null; }
}

function newGame() {
  clearRun();
  G = freshRun();
  startLevel();
}
function continueGame() {
  const run = loadRun();
  if (!run) return newGame();
  G = run; L = null;
  setState('shop');
  renderShop();
  $('shopBody').scrollTop = 0;
  show('shop');
}

// 小头目出现的时间（秒）：第 2 关起每关都有，越往后越多
function eliteSchedule(lv) {
  if (lv < 2) return [];
  if (isBossLevel(lv)) return lv >= 9 ? [35] : [];
  return lv >= 8 ? [15, 30, 45] : lv >= 5 ? [18, 40] : [22];
}

function startLevel() {
  L = {
    time: LEVEL_TIME, elapsed: 0, spawnT: 1.2,
    cat: { x: NEST.x, y: NEST.y + 95, r: 17, hp: catMaxHp(), cd: 0, inv: 0, aim: 0, walk: 0, moving: false, kx: 0, ky: 0, s: 1 },
    enemies: [], bullets: [], ebullets: [], fish: [], parts: [], texts: [], turrets: [],
    atkBuff: 0, catnipT: 0, catLost: 0, nestLost: 0, catMax: catMaxHp(), nestMax: nestMaxHp(), on: {}, starSnd: 3,
    boss: null, bossSpawned: false, bossHalfAsked: false, isBoss: isBossLevel(G.level),
    shake: 0, banner: 2.2, nestFlash: 0,
    drops: [], buffT: Object.fromEntries(BUFFS.filter(b => b.dur).map(b => [b.id, 0])),
    rings: [], bolts: [], helpers: [], trail: [], shAngle: 0, stormCd: 2, morphT: 0, stompT: 0, trailT: 0, form: null,
    eliteTimes: eliteSchedule(G.level), notice: null, clearT: 0, fireworkT: 0,
  };
  // 道具：每关开始时消耗 1 次使用次数，用完就不再生效
  for (const it of ITEMS) {
    const st = G.items[it.id];
    if (!it.manual && st.uses > 0) { st.uses--; L.on[it.id] = st.lv; }
  }
  for (let i = 0; i < (ilv('turret') ? ilv('turret') + 1 : 0); i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    L.turrets.push({ x: NEST.x + Math.cos(a) * 82, y: NEST.y + Math.sin(a) * 82, cd: rand(0, 0.5), aim: a });
  }
  for (let i = 0; i < ilv('helper'); i++) L.helpers.push({ x: NEST.x - 30 + i * 60, y: NEST.y + 120, cd: rand(0, 0.5), aim: 0, side: i ? 1 : -1 });
  show(null);
  setState('playing');
}

function pauseGame() { setState('paused'); refreshToggles(); show('pause'); }
function resumeGame() { show(null); setState('playing'); }

function cycleWeapon(dir) {
  const own = ownedList();
  if (own.length < 2) return;
  const i = own.findIndex(o => o.id === G.eq.id && o.tier === G.eq.tier);
  const nx = own[(i + dir + own.length) % own.length];
  G.eq = { id: nx.id, tier: nx.tier };
  addText(L.cat.x, L.cat.y - 34, `${weaponDef(nx.id).name} ${TIERS[nx.tier].id}`, tierColor(nx.tier), 15);
  sfx.switch();
}
function useCatnip() {
  const st = G.items.catnip;
  if (st.uses <= 0 || L.catnipT > 0) return;
  st.uses--; L.catnipT = 5 + 2 * st.lv;
  addText(L.cat.x, L.cat.y - 34, '猫薄荷！', '#9cff6b', 18);
  sfx.catnip();
}

// ---------- 效果 ----------
function addText(x, y, text, color = '#fff', size = 14, life = 0.9) { L.texts.push({ x, y, text, color, size, life }); }
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
  const kind = type === 'boss' ? bossFor(lv) : null;
  if (kind) hp = d.hp * kind.hp * (1 + 0.7 * (lv / BOSS_EVERY - 1)) * BOSS_HP_MULT;
  const e = {
    type, x, y, r: d.r, hp, maxHp: hp, spd: d.spd * Math.min(1.5, 1 + 0.025 * (lv - 1)) * rand(0.92, 1.08),
    dmg: d.dmg * (1 + 0.08 * (lv - 1)), cd: rand(0.3, 1), cd2: 0, flash: 0, face: 1, t: rand(0, 10), summon: 4, dead: false,
  };
  if (kind) Object.assign(e, { kind, r: kind.r, spd: kind.spd, st: 'walk', stT: 0, stDur: 1, spCd: 3, atkAnim: 0, z: 0, dir: 0, walking: true, meteors: [], sub: '', atk: 0, tick: 0 });
  L.enemies.push(e);
  return e;
}

// ---------- 头目行为 ----------
const BOSS_ANIMALS = BOSSES.filter(b => b.id !== 'dragon');
const BOSS_HP_MULT = 1.5;
// 每 5 个头目里的第 5 个是巨龙（第 15、30 关……），其余按顺序轮流出场
function bossFor(lv) {
  const n = Math.max(1, Math.floor(lv / BOSS_EVERY));
  if (n % 5 === 0) return BOSSES.find(b => b.id === 'dragon');
  return BOSS_ANIMALS[(n - Math.floor(n / 5) - 1) % BOSS_ANIMALS.length];
}
const BOSS_WIND = { bark: 0.5, dash: 0.6, howl: 0.8, stomp: 0.9, spit: 0.5, pounce: 0.6, roar: 0.7, charge: 0.9 };
const BOSS_RANGE = { dash: 520, spit: 560, pounce: 470, charge: 700 };
function ring(x, y, max, color, life = 0.5, fill = false) { L.rings.push({ x, y, max, color, life, maxLife: life, fill }); }
function bossState(e, st, t) { e.st = st; e.stT = t; e.stDur = t || 1; }
function knockCat(from, power) {
  const c = L.cat;
  if (L.buffT.giant > 0) return;
  const a = Math.atan2(c.y - from.y, c.x - from.x);
  c.kx = Math.cos(a) * power; c.ky = Math.sin(a) * power;
}
function faceDir(e) { e.face = Math.cos(e.dir) < 0 ? -1 : 1; }

function updateBoss(e, dt, c) {
  const k = e.kind, sp = k.special, dCat = dist(e, c);
  e.atkAnim = Math.max(0, e.atkAnim - dt);
  if (sp === 'dragon') return updateDragon(e, dt, c);
  if (e.st === 'walk') {
    let spd = e.spd * (e.rage > 0 ? 1.3 : 1);
    if (ilv('fence') && dist(e, NEST) < FENCE_R) spd *= 1 - fenceSlow();
    const dx = NEST.x - e.x, dy = NEST.y - e.y, dd = Math.hypot(dx, dy) || 1, stop = NEST.r + e.r - 6;
    e.walking = dd > stop;
    if (e.walking) { e.x += dx / dd * spd * dt; e.y += dy / dd * spd * dt; if (Math.abs(dx) > 2) e.face = dx < 0 ? -1 : 1; }
    else if (e.cd <= 0) { e.cd = 1.3; e.atkAnim = 0.4; hurtNest(e.dmg); }   // 咬猫窝
    if (e.cd2 <= 0 && dCat < c.r + e.r - 6) { e.cd2 = 0.8; e.atkAnim = 0.4; hurtCat(e.dmg); }
    e.spCd -= dt;
    const inRange = sp === 'stomp' ? (dist(e, NEST) < 250 || dCat < 210) : dCat < (BOSS_RANGE[sp] || 1e9);
    if (e.spCd <= 0 && inRange) {
      bossState(e, 'wind', BOSS_WIND[sp]);
      e.dir = Math.atan2(c.y - e.y, c.x - e.x); e.tx = c.x; e.ty = c.y;
      if (sp !== 'bark' && sp !== 'howl' && sp !== 'stomp' && sp !== 'roar') faceDir(e);
      if (sp === 'howl') sfx.howl(); else if (sp === 'stomp') sfx.trumpet(); else if (sp === 'roar') sfx.roar(); else if (sp === 'charge') sfx.boss();
    }
    return;
  }
  e.walking = false;
  e.stT -= dt;
  if (e.st === 'wind') {
    // 冲撞类攻击在蓄力前半段会继续瞄准猫咪，之后方向锁定，给玩家躲开的时间
    if ((sp === 'charge' && e.stT > 0.35) || (sp === 'dash' && e.stT > 0.2)) { e.dir = Math.atan2(c.y - e.y, c.x - e.x); faceDir(e); }
    if (e.stT <= 0) bossAct(e, c);
  } else if (e.st === 'act') {
    if (sp === 'dash' || sp === 'charge') {
      const v = sp === 'dash' ? 560 : 640;
      e.x += Math.cos(e.dir) * v * dt; e.y += Math.sin(e.dir) * v * dt;
      if (Math.random() < 0.6) L.parts.push({ x: e.x - Math.cos(e.dir) * e.r, y: e.y + e.r * 0.7, vx: rand(-40, 40), vy: rand(-40, 0), life: 0.4, color: '#e3cf9a', r: rand(3, 6) });
      if (!e.hitOnce && dCat < c.r + e.r) { e.hitOnce = true; hurtCat(e.dmg * (sp === 'dash' ? 0.9 : 1.2)); knockCat(e, 420); }
      if (sp === 'charge' && !e.nestOnce && dist(e, NEST) < NEST.r + e.r) { e.nestOnce = true; hurtNest(e.dmg * 1.2); L.shake = 0.3; sfx.stomp(); }
      const out = e.x < 30 || e.x > WORLD.w - 30 || e.y < 30 || e.y > WORLD.h - 30;
      if (out) { e.x = clamp(e.x, 30, WORLD.w - 30); e.y = clamp(e.y, 30, WORLD.h - 30); }
      if (out || e.stT <= 0) bossState(e, 'rest', sp === 'dash' ? 0.4 : 0.7);
    } else if (sp === 'pounce') {
      const p = clamp(1 - e.stT / e.stDur, 0, 1);
      e.x = e.sx + (e.tx - e.sx) * p; e.y = e.sy + (e.ty - e.sy) * p; e.z = Math.sin(Math.PI * p) * 95;
      if (e.stT <= 0) {
        e.z = 0; ring(e.x, e.y, 90, '#ffb347'); L.shake = 0.35; sfx.stomp();
        burst(e.x, e.y + e.r * 0.6, '#e3cf9a', 14, 200);
        if (dist(e, c) < 85) { hurtCat(e.dmg * 1.1); knockCat(e, 300); }
        bossState(e, 'rest', 0.5);
      }
    }
  } else if (e.stT <= 0) {
    e.spCd = k.cd * (e.hp < e.maxHp / 2 ? 0.7 : 1);   // 血量过半后更暴躁
    bossState(e, 'walk', 0);
  }
}
// ---------- 巨龙：喷火扫射 + 陨石雨 ----------
const dragonMouth = e => ({ x: e.x + e.face * e.r * 0.9, y: e.y - e.z * 0.7 - e.r * 0.25 });
const BREATH_LEN = 440, BREATH_HALF = 0.3;
function inCone(o, a, p, pad = 0) {
  const d = Math.hypot(p.x - o.x, p.y - o.y);
  if (d > BREATH_LEN + pad) return false;
  let da = Math.atan2(p.y - o.y, p.x - o.x) - a;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  return Math.abs(da) < BREATH_HALF + Math.atan2(pad, Math.max(d, 1));   // 目标有体积，近处角度放宽一点
}
function updateDragon(e, dt, c) {
  const k = e.kind;
  e.z = 22 + Math.sin(e.t * 3) * 6;
  // 陨石：不管龙当前在做什么都继续下落，落地时炸开
  for (const m of e.meteors) {
    m.t += dt;
    if (!m.done && m.t >= m.delay) {
      m.done = true;
      ring(m.x, m.y, 74, '#ff6b3c', 0.45, true); ring(m.x, m.y, 40, '#fff7b0', 0.3);
      burst(m.x, m.y, '#ff9a3c', 14, 220); burst(m.x, m.y, '#4a3423', 6, 140);
      L.shake = Math.max(L.shake, 0.25); sfx.meteorHit();
      if (dist(m, c) < 74 + c.r) { hurtCat(e.dmg * 0.8); knockCat(m, 340); }
      if (dist(m, NEST) < 74 + NEST.r) hurtNest(e.dmg * 0.6);
    }
  }
  e.meteors = e.meteors.filter(m => !m.done);
  const dCat = dist(e, c);
  if (e.st === 'walk') {
    e.walking = true;
    const dx = NEST.x - e.x, dy = NEST.y - e.y, dd = Math.hypot(dx, dy) || 1;
    if (dd > 250) { e.x += dx / dd * e.spd * dt; e.y += dy / dd * e.spd * dt; }
    else { const a = Math.atan2(e.y - NEST.y, e.x - NEST.x) + dt * 0.22; e.x = NEST.x + Math.cos(a) * dd; e.y = NEST.y + Math.sin(a) * dd; }   // 绕着猫窝盘旋
    e.face = c.x < e.x ? -1 : 1;
    if (e.cd2 <= 0 && dCat < c.r + e.r * 0.85) { e.cd2 = 0.9; e.atkAnim = 0.4; hurtCat(e.dmg); knockCat(e, 320); }
    e.spCd -= dt;
    if (e.spCd <= 0) {
      e.atk++; e.sub = e.atk % 2 ? 'breath' : 'meteor';
      sfx.dragonRoar();
      if (e.sub === 'breath') bossState(e, 'wind', 1.0);
      else {
        bossState(e, 'wind', 0.7);
        const n = 5 + Math.floor(G.level / 15);
        for (let i = 0; i < n; i++) {
          const nearNest = i % 3 === 2;
          const tx = (nearNest ? NEST.x : c.x) + rand(-110, 110), ty = (nearNest ? NEST.y : c.y) + rand(-110, 110);
          e.meteors.push({ x: clamp(tx, 40, WORLD.w - 40), y: clamp(ty, 40, WORLD.h - 40), t: 0, delay: 1.0 + i * 0.28, done: false });
        }
        sfx.meteorFall();
      }
    }
    return;
  }
  e.walking = true;
  e.stT -= dt;
  if (e.st === 'wind') {
    if (e.sub === 'breath') {
      const o = dragonMouth(e);
      if (e.stT > 0.3) { e.dir = Math.atan2(c.y - o.y, c.x - o.x); e.face = Math.cos(e.dir) < 0 ? -1 : 1; }   // 最后 0.3 秒锁定方向
    }
    if (e.stT <= 0) {
      if (e.sub === 'breath') { e.dir0 = e.dir; e.fire = e.dir; e.tick = 0; sfx.fireBreath(); bossState(e, 'act', 1.5); }
      else bossState(e, 'act', Math.max(0.3, 0.6 + (e.meteors.length - 1) * 0.28));
    }
  } else if (e.st === 'act') {
    if (e.sub === 'breath') {
      const p = clamp(1 - e.stT / e.stDur, 0, 1), o = dragonMouth(e);
      e.fire = e.dir0 + (p - 0.5) * 0.9;   // 火焰左右扫射
      e.face = Math.cos(e.fire) < 0 ? -1 : 1;
      e.tick -= dt;
      if (e.tick <= 0) {
        e.tick = 0.12;
        if (inCone(o, e.fire, c, c.r)) hurtCat(e.dmg * 0.55);
        if (inCone(o, e.fire, NEST, NEST.r)) hurtNest(e.dmg * 0.2);
      }
      for (let i = 0; i < 3; i++) {
        const a = e.fire + rand(-BREATH_HALF, BREATH_HALF), v = rand(280, 520);
        L.parts.push({ x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.25, 0.5), color: ['#ff6b3c', '#ffb347', '#ffe066'][randInt(0, 2)], r: rand(4, 9) });
      }
    }
    if (e.stT <= 0) bossState(e, 'rest', 0.7);
  } else if (e.stT <= 0) {
    e.spCd = k.cd * (e.hp < e.maxHp / 2 ? 0.7 : 1);
    bossState(e, 'walk', 0);
  }
}

function bossAct(e, c) {
  const sp = e.kind.special, lv = G.level, around = () => ({ x: e.x + rand(-70, 70), y: e.y + rand(-70, 70) });
  e.hitOnce = false; e.nestOnce = false;
  if (sp === 'bark') {
    for (let i = 0; i < 2 + Math.floor(lv / 9); i++) spawnEnemy('mouse', around());
    addText(e.x, e.y - e.r - 34, '汪！汪！', '#fff', 20, 1.1); sfx.bark();
    bossState(e, 'rest', 0.4);
  } else if (sp === 'dash') { sfx.dash(); bossState(e, 'act', 0.45); }
  else if (sp === 'howl') {
    for (let i = 0; i < 4; i++) spawnEnemy('roach', around());
    for (const o of L.enemies) o.rage = 4;
    ring(e.x, e.y, 280, '#cfd8e6', 0.7); ring(e.x, e.y, 200, '#cfd8e6', 0.5);
    addText(e.x, e.y - e.r - 34, '嗷呜——', '#fff', 20, 1.2);
    bossState(e, 'rest', 0.5);
  } else if (sp === 'stomp') {
    ring(e.x, e.y, 210, '#ffb347', 0.5); ring(e.x, e.y, 140, '#fff', 0.35);
    L.shake = 0.55; sfx.stomp();
    if (dist(e, c) < 210) { hurtCat(e.dmg * 1.2); knockCat(e, 380); }
    if (dist(e, NEST) < 210 + NEST.r) hurtNest(e.dmg);
    bossState(e, 'rest', 0.5);
  } else if (sp === 'spit') {
    const hx = e.x + e.face * e.r * 0.7, hy = e.y - e.r * 2.1, a0 = Math.atan2(c.y - hy, c.x - hx);
    for (let i = -2; i <= 2; i++) L.ebullets.push({ x: hx, y: hy, vx: Math.cos(a0 + i * 0.22) * 250, vy: Math.sin(a0 + i * 0.22) * 250, dmg: e.dmg * 0.6, life: 2.6, r: 7, leaf: true });
    sfx.spit();
    bossState(e, 'rest', 0.3);
  } else if (sp === 'pounce') { e.sx = e.x; e.sy = e.y; sfx.dash(); bossState(e, 'act', 0.55); }
  else if (sp === 'roar') {
    ring(e.x, e.y, 290, '#ffd27a', 0.6); ring(e.x, e.y, 220, '#ffd27a', 0.45); ring(e.x, e.y, 150, '#fff', 0.3);
    L.shake = 0.45;
    if (dist(e, c) < 290) { hurtCat(e.dmg * 0.6); knockCat(e, 620); }
    spawnEnemy('raccoon', around()); spawnEnemy('mouse', around()); spawnEnemy('mouse', around());
    addText(e.x, e.y - e.r - 34, '吼————！', '#fff', 22, 1.2);
    bossState(e, 'rest', 0.5);
  } else if (sp === 'charge') { sfx.dash(); bossState(e, 'act', 1.1); }
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
      dropBuff(e.x - 30, e.y); dropBuff(e.x + 30, e.y);
      if (e.kind.id === 'dragon') dropBuff(e.x, e.y - 30);
      L.boss = null; L.shake = 0.5; sfx.boom();
    } else if (e.type === 'elite') {
      for (let i = 0; i < 4; i++) L.fish.push({ x: e.x + rand(-25, 25), y: e.y + rand(-25, 25), v: Math.ceil(n / 4) });
      dropBuff(e.x, e.y);
      L.shake = 0.3; sfx.boom();
    } else {
      L.fish.push({ x: e.x, y: e.y, v: n });
      if (Math.random() < BUFF_DROP_CHANCE) dropBuff(e.x, e.y);
      sfx.kill();
    }
  }
}
// ---------- 增益掉落 ----------
function dropBuff(x, y) {
  if (L.drops.length >= 6) return;
  const b = BUFFS[randInt(0, BUFFS.length - 1)];
  L.drops.push({ x: clamp(x, 30, WORLD.w - 30), y: clamp(y, 30, WORLD.h - 30), buff: b, life: 12, t: rand(0, 6) });
}
function applyBuff(b) {
  const c = L.cat;
  if (b.dur) {
    L.buffT[b.id] = b.dur;
    // 变身！
    L.morphT = 0.4; L.shake = Math.max(L.shake, 0.25);
    ring(c.x, c.y, 120, b.color, 0.45); ring(c.x, c.y, 70, '#fff', 0.3);
  }
  if (b.id === 'heal') c.hp = Math.min(catMaxHp(), c.hp + 35);
  if (b.id === 'magnet') for (const f of L.fish) f.fly = true;
  if (b.id === 'freeze') for (const e of L.enemies) burst(e.x, e.y, '#c8f4ff', 3, 60);
  addText(c.x, c.y - 44, `${b.name}${store.pinyin ? ' ' + b.py : ''}`, b.color, 18, 1.6);
  addText(c.x, c.y - 24, b.tip + '！', '#fff', 14, 1.6);
  burst(c.x, c.y, b.color, 22, 240);
  sfx.transform();
  speak(b.name);
}

function hurtCat(dmg) {
  const c = L.cat;
  if (c.inv > 0 || L.buffT.shield > 0 || L.buffT.giant > 0) return;
  c.hp -= dmg; L.catLost += dmg; c.inv = 0.45; L.shake = Math.max(L.shake, 0.2);
  addText(c.x, c.y - 30, '-' + Math.round(dmg), '#ff6b5e', 16);
  sfx.hurt();
}
function hurtNest(dmg) {
  sfx.nestHit();
  G.nestHp -= dmg; L.nestLost += dmg; L.nestFlash = 0.15;
  addText(NEST.x + rand(-20, 20), NEST.y - 50, '-' + Math.round(dmg), '#ff6b5e', 15);
}

// ---------- 射击 ----------
function fireWeapon(c) {
  const eq = G.eq, w = weaponDef(eq.id), s = weaponStats(eq.id, eq.tier);
  const fast = (L.catnipT > 0 ? 0.65 : 1) * (L.buffT.rapid > 0 ? 0.6 : 1);
  c.cd = s.interval * fast;
  const dmg = s.dmg * (1 + L.atkBuff) * (L.buffT.power > 0 ? 2 : 1);
  for (let i = 0; i < s.count; i++) {
    let a = c.aim + rand(-s.jitter, s.jitter);
    if (s.count > 1) a += (i / (s.count - 1) - 0.5) * s.spread;
    L.bullets.push({
      x: c.x + Math.cos(c.aim) * 24, y: c.y + Math.sin(c.aim) * 24,
      vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
      dmg, life: s.life, r: s.r * (L.buffT.power > 0 ? 1.5 : 1), pierce: s.pierce, explode: s.explode, splash: s.splash,
      tier: eq.tier, color: s.color, kind: w.id, hit: new Set(),
    });
  }
  // 枪口火花：品级越高越大、颜色越亮
  const big = (eq.id === 'shotgun' || eq.id === 'grenade') ? 6 : 0;
  L.parts.push({ x: c.x + Math.cos(c.aim) * 32, y: c.y + Math.sin(c.aim) * 32, vx: 0, vy: 0, life: 0.07, max: 0.07, k: 'flash', color: eq.tier ? tierColor(eq.tier) : '#ffe9a0', r: 8 + eq.tier * 1.5 + big });
  sfx['shoot_' + w.id]();
}

// 命中特效：每种武器各有各的样子，品级越高越华丽
function impactFx(b) {
  const t = b.tier || 0, tc = tierColor(t), s = 1 + t * 0.22, x = b.x, y = b.y;
  if (b.kind === 'pistol') {
    burst(x, y, '#6fd24a', 5 + t, 110 * s); burst(x, y, '#c8f5a8', 3, 70);
    L.parts.push({ x, y, vx: 0, vy: 0, life: 0.14, max: 0.14, k: 'flash', color: '#d6ffb8', r: 9 * s });
  } else if (b.kind === 'shotgun') {
    for (let i = 0; i < 4 + t; i++) L.parts.push({ x, y, vx: rand(-70, 70), vy: rand(-70, 70), life: rand(0.3, 0.5), color: '#ffc2d6', r: rand(3, 6.5) * s });
  } else if (b.kind === 'smg') {
    const back = Math.atan2(b.vy, b.vx) + Math.PI;
    for (let i = 0; i < 4; i++) { const a = back + rand(-1.1, 1.1), v = rand(160, 320); L.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.12, 0.22), color: '#fff6c8', r: 2.2, k: 'spark' }); }
  } else if (b.kind === 'laser') {
    L.parts.push({ x, y, vx: 0, vy: 0, life: 0.18, max: 0.18, k: 'flash', color: '#ff7a7a', r: 16 * s });
    burst(x, y, '#ff6b6b', 4, 150);
  } else burst(x, y, b.color, 3, 80);
  if (t >= 1) burst(x, y, tc, 2 + t, 140);   // 高阶武器会带上品级的颜色
}
// 溅射：子弹命中后波及周围的敌人，并画出波及范围
function splashHit(b, hitE) {
  ring(b.x, b.y, b.splash, tierColor(b.tier), 0.3, true);
  for (const o of L.enemies) if (o !== hitE && !o.dead && dist(o, b) < b.splash + o.r) damageEnemy(o, b.dmg * 0.55);
}
function explode(b) {
  const R = b.explode;
  for (const e of L.enemies) if (dist(e, b) < R + e.r) damageEnemy(e, b.dmg);
  L.parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, color: 'boom', r: R });
  ring(b.x, b.y, R, '#ffb347', 0.4, true); ring(b.x, b.y, R * 0.6, '#fff7b0', 0.3);
  L.parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.22, max: 0.22, k: 'flash', color: '#fff2a8', r: R * 0.55 });
  burst(b.x, b.y, '#ffb347', 14, 240); burst(b.x, b.y, '#ff6b3c', 8, 180); burst(b.x, b.y, '#6b4a2e', 6, 160);
  if (b.tier > 0) burst(b.x, b.y, tierColor(b.tier), 6 + b.tier * 2, 260);
  L.shake = Math.max(L.shake, 0.15 + 0.03 * (b.tier || 0));
  sfx.boom();
}
function nearestEnemy(p, range) {
  let best = null, bd = range;
  for (const e of L.enemies) { const d = dist(e, p) - e.r; if (d < bd) { bd = d; best = e; } }
  return best;
}

// ---------- 每帧更新 ----------
// 猫咪当前的变身形态：由生效中的增益决定，优先显示最厉害的
const FORMS = {
  giant: { s: 2.3, fur: '#ffcf5a', dark: '#e09a2a' },
  power: { s: 1.45, fur: '#ff7a5c', dark: '#c8402d' },
  rapid: { s: 1.2, fur: '#ffe066', dark: '#e0a800' },
  shield: { s: 1.2, fur: '#8fc4ff', dark: '#4f8fdc' },
  freeze: { s: 1.15, fur: '#c8f4ff', dark: '#7fd3e8' },
};
const currentForm = () => { for (const id in FORMS) if (L.buffT[id] > 0) return id; return null; };
function updateForm(dt) {
  const c = L.cat, form = currentForm();
  if (L.form && !form) { burst(c.x, c.y, '#fff', 14, 160); sfx.revert(); }   // 变回原样
  L.form = form;
  L.morphT = Math.max(0, L.morphT - dt);
  c.s += ((form ? FORMS[form].s : 1) - c.s) * Math.min(1, dt * 9);
  // 残影
  L.trailT -= dt;
  if (form && form !== 'shield' && form !== 'freeze' && c.moving && L.trailT <= 0) { L.trailT = 0.06; L.trail.push({ x: c.x, y: c.y, s: c.s, color: FORMS[form].fur, life: 0.3 }); }
  for (const t of L.trail) t.life -= dt;
  L.trail = L.trail.filter(t => t.life > 0);
  if (form === 'power' && Math.random() < 0.5) L.parts.push({ x: c.x + rand(-16, 16), y: c.y + rand(-10, 14), vx: rand(-15, 15), vy: rand(-110, -50), life: rand(0.3, 0.55), color: Math.random() < 0.5 ? '#ff6b5e' : '#ffb347', r: rand(3, 5.5) });
  if (form === 'rapid' && Math.random() < 0.3) L.parts.push({ x: c.x + rand(-20, 20), y: c.y + rand(-24, 14), vx: rand(-60, 60), vy: rand(-60, 60), life: 0.2, color: '#fff7b0', r: rand(2, 3.5) });
  // 巨猫踩扁靠近的敌人
  if (form === 'giant') {
    L.stompT -= dt;
    if (L.stompT <= 0) {
      L.stompT = 0.22;
      let hit = false;
      for (const e of L.enemies) if (dist(e, c) < 58 + e.r) { damageEnemy(e, 28 + 6 * G.level); hit = true; }
      if (hit) { L.shake = Math.max(L.shake, 0.12); sfx.stompCat(); }
    }
  }
}

// 新道具：旋转飞镖、闪电云、小猫助手
const SHURIKEN_R = 128;
function updateGadgets(dt) {
  const c = L.cat, lv = G.level;
  if (ilv('shuriken')) {
    const nSh = ilv('shuriken') + 1;
    L.shAngle += dt * 3.2;
    for (const e of L.enemies) e.shCd = (e.shCd || 0) - dt;
    for (let i = 0; i < nSh; i++) {
      const a = L.shAngle + i * TAU / nSh, bx = NEST.x + Math.cos(a) * SHURIKEN_R, by = NEST.y + Math.sin(a) * SHURIKEN_R;
      for (const e of L.enemies) {
        if (e.dead || e.shCd > 0 || Math.hypot(e.x - bx, e.y - by) > e.r + 22) continue;
        e.shCd = 0.35; damageEnemy(e, 16 + 3 * lv);
        burst(bx, by, '#dfe8f2', 4, 140); sfx.shuriken();
      }
    }
  }
  if (ilv('lightning')) {
    L.stormCd -= dt;
    if (L.stormCd <= 0) {
      const near = L.enemies.filter(e => !e.dead && dist(e, NEST) < 440).sort((a, b) => dist(a, NEST) - dist(b, NEST)).slice(0, ilv('lightning') + 1);
      if (near.length) {
        L.stormCd = 3.4 - 0.5 * ilv('lightning');
        for (const e of near) {
          const pts = [[NEST.x, NEST.y - 95]];
          for (let k = 1; k < 6; k++) pts.push([NEST.x + (e.x - NEST.x) * k / 6 + rand(-16, 16), NEST.y - 95 + (e.y - NEST.y + 95) * k / 6 + rand(-16, 16)]);
          pts.push([e.x, e.y]);
          L.bolts.push({ pts, life: 0.2 });
          damageEnemy(e, 30 + 5 * lv); burst(e.x, e.y, '#fff7b0', 8, 200);
        }
        L.shake = Math.max(L.shake, 0.12); sfx.lightning();
      } else L.stormCd = 0.3;
    }
  }
  for (const h of L.helpers) {
    // 跟在猫咪身后
    const tx = c.x + h.side * 34, ty = c.y + 30, d = Math.hypot(tx - h.x, ty - h.y);
    if (d > 6) { const v = Math.min(d * 5, 330) * dt / d; h.x += (tx - h.x) * v; h.y += (ty - h.y) * v; }
    h.cd -= dt;
    const e = nearestEnemy(h, 320);
    if (e) {
      h.aim = Math.atan2(e.y - h.y, e.x - h.x);
      if (h.cd <= 0) {
        h.cd = 0.55; sfx.helper();
        L.bullets.push({ x: h.x, y: h.y, vx: Math.cos(h.aim) * 540, vy: Math.sin(h.aim) * 540, dmg: 8 + 1.5 * lv, life: 0.7, r: 4, pierce: 0, explode: 0, color: '#ffb347', kind: 'turret', hit: new Set() });
      }
    }
  }
  for (const r of L.rings) r.life -= dt;
  for (const b of L.bolts) b.life -= dt;
  L.rings = L.rings.filter(r => r.life > 0);
  L.bolts = L.bolts.filter(b => b.life > 0);
}

function update(dt) {
  const c = L.cat;
  L.elapsed += dt;
  L.time = Math.max(0, L.time - dt);
  L.banner -= dt; L.shake = Math.max(0, L.shake - dt); L.nestFlash -= dt;
  if (L.catnipT > 0) L.catnipT -= dt;
  for (const k in L.buffT) if (L.buffT[k] > 0) L.buffT[k] -= dt;
  if (L.notice) { L.notice.t -= dt; if (L.notice.t <= 0) L.notice = null; }

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
    const sp = catSpeed() * (L.catnipT > 0 ? 1.4 : 1) * (L.buffT.giant > 0 ? 1.15 : 1) * Math.min(1, ml);
    let nx = c.x + mx / ml * sp * dt, ny = c.y + my / ml * sp * dt;
    // 不能走进猫窝里
    const dn = Math.hypot(nx - NEST.x, ny - NEST.y), minD = NEST.r + c.r - 6;
    if (dn < minD) { nx = NEST.x + (nx - NEST.x) / dn * minD; ny = NEST.y + (ny - NEST.y) / dn * minD; }
    c.x = clamp(nx, c.r, WORLD.w - c.r); c.y = clamp(ny, c.r, WORLD.h - c.r);
    c.walk += dt * 12;
  }
  // 被头目震飞
  if (Math.abs(c.kx) + Math.abs(c.ky) > 5) {
    c.x = clamp(c.x + c.kx * dt, c.r, WORLD.w - c.r); c.y = clamp(c.y + c.ky * dt, c.r, WORLD.h - c.r);
    const k = Math.pow(0.002, dt); c.kx *= k; c.ky *= k;
  }
  c.inv -= dt; c.cd -= dt;
  updateForm(dt);

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
    L.notice = { text: `${L.boss.kind.name}：${L.boss.kind.tip}`, t: 3.5 };
    openQuiz(`${L.boss.kind.name}来了！`);
    return;
  }
  if (L.boss && !L.bossHalfAsked && L.boss.hp < L.boss.maxHp / 2) {
    L.bossHalfAsked = true;
    sfx.roar();
    openQuiz(`${L.boss.kind.name}发怒了！`);
    return;
  }

  // 小头目
  while (L.eliteTimes.length && L.elapsed >= L.eliteTimes[0]) {
    L.eliteTimes.shift();
    spawnEnemy('elite');
    L.notice = { text: '小头目来了！', t: 2.2 };
    sfx.boss();
  }

  // 敌人
  const frozen = L.buffT.freeze > 0;
  for (const e of L.enemies) {
    const d = ENEMIES[e.type];
    e.flash -= dt;
    if (frozen) continue;
    e.cd -= dt; e.cd2 -= dt; e.t += dt;
    if (e.rage > 0) e.rage -= dt;
    if (e.type === 'boss') { updateBoss(e, dt, c); continue; }
    const tgt = d.target === 'nest' ? NEST : c;
    let spd = e.spd * (e.rage > 0 ? 1.4 : 1);
    if (e.type === 'elite' && e.t % 4 > 3) {   // 小头目每隔几秒冲刺一下
      spd *= 2.6;
      if (Math.random() < 0.4) L.parts.push({ x: e.x, y: e.y + e.r * 0.7, vx: rand(-30, 30), vy: rand(-30, 0), life: 0.35, color: '#e3cf9a', r: rand(3, 5) });
    }
    if (ilv('fence') && dist(e, NEST) < FENCE_R) spd *= 1 - fenceSlow();
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
  }
  updateGadgets(dt);

  // 子弹
  for (const b of L.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const e of L.enemies) {
      if (e.dead || b.hit.has(e) || dist(e, b) > e.r + b.r) continue;
      if (b.explode) { explode(b); b.dead = true; break; }
      damageEnemy(e, b.dmg); b.hit.add(e);
      sfx['hit_' + b.kind]();
      impactFx(b);
      if (b.splash) splashHit(b, e);
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
        t.cd = 0.7; sfx.turret();
        L.bullets.push({ x: t.x, y: t.y, vx: Math.cos(t.aim) * 520, vy: Math.sin(t.aim) * 520, dmg: 9 + G.level, life: 0.7, r: 4, pierce: 0, explode: 0, color: '#ffd84a', kind: 'turret', hit: new Set() });
      }
    }
  }

  // 小鱼干
  const magR = 60 + 55 * ilv('magnet');
  for (const f of L.fish) {
    const d = dist(f, c);
    if (f.fly || d < magR) { const s = (f.fly ? 800 : 420) * dt / (d || 1); f.x += (c.x - f.x) * Math.min(1, s); f.y += (c.y - f.y) * Math.min(1, s); }
    if (d < c.r + 8) { f.dead = true; G.fish += f.v; sfx.pickup(); }
  }
  // 增益掉落物
  for (const d of L.drops) {
    d.life -= dt; d.t += dt;
    if (dist(d, c) < c.r + 18) { d.life = 0; applyBuff(d.buff); }
  }
  L.drops = L.drops.filter(d => d.life > 0);

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

// 星级：按本关猫咪和猫窝各损失了多少生命来评定
function rateLevel() {
  const cr = clamp(L.catLost / L.catMax, 0, 1), nr = clamp(L.nestLost / L.nestMax, 0, 1);
  const score = (cr + nr) / 2;
  return { cr, nr, stars: score <= 0.15 ? 3 : score <= 0.4 ? 2 : 1 };
}

// 过关：先结算并存档，再播放庆祝动画（含星级），最后进商店
function levelClear() {
  for (const f of L.fish) { G.fish += f.v; f.v = 0; f.fly = true; }   // 地上的小鱼干飞向猫咪
  const r = rateLevel();
  G.lastBonus = 10 + 5 * G.level;
  G.lastStarBonus = r.stars === 3 ? 15 + 4 * G.level : r.stars === 2 ? 6 + 2 * G.level : 0;
  G.fish += G.lastBonus + G.lastStarBonus;
  G.lastStars = r.stars; G.lastCatLoss = r.cr; G.lastNestLoss = r.nr;
  G.stars[G.level] = Math.max(G.stars[G.level] || 0, r.stars);
  G.miniPlayed = false;
  saveRun();
  if (G.level > store.best) { store.best = G.level; save(); }
  L.bullets = []; L.ebullets = []; L.drops = []; L.rings = []; L.bolts = []; L.trail = [];
  L.form = null; L.cat.kx = L.cat.ky = 0;
  L.clearT = 0; L.fireworkT = 0; L.notice = null; L.starSnd = 0;
  for (const k in L.buffT) L.buffT[k] = 0;
  L.catnipT = 0;
  sfx.right();
  setState('clear');
}
const CLEAR_TIME = 8;
const STAR_T0 = 1.7, STAR_GAP = 0.6, STARS_DONE = STAR_T0 + 3 * STAR_GAP + 0.6;
const PARTY = ['#ff6b5e', '#ffd84a', '#7ed957', '#5aa9ff', '#ff8fb1', '#b48cff'];
// 结算画面的布局（屏幕坐标）：标题、星星、文字都叠在猫咪上方
function clearLayout() {
  const u = clamp(Math.min(W / 460, H / 600), 0.6, 1.2), y0 = Math.max(14, H * 0.5 - 330 * u);
  return { u, y0, starY: y0 + 138 * u, R: 27 * u, gap: 78 * u };
}
const starPos = i => { const l = clearLayout(); return { x: W / 2 + (i - 1) * l.gap, y: l.starY }; };
function updateClear(dt) {
  const c = L.cat;
  L.clearT += dt; L.shake = 0;
  // 猫咪举枪蹦跳
  c.hop = -Math.abs(Math.sin(L.clearT * 7)) * 14;
  c.aim = -0.95 + Math.sin(L.clearT * 8) * 0.3;
  c.moving = false; c.inv = 0; c.s += (1 - c.s) * Math.min(1, dt * 9);
  // 星星依次出现
  for (let i = 0; i < 3; i++) {
    if (L.starSnd > i || L.clearT < STAR_T0 + i * STAR_GAP) continue;
    L.starSnd = i + 1;
    const p = starPos(i), wx = cam.x + p.x / scale, wy = cam.y + p.y / scale;
    if (i < G.lastStars) {
      sfx['star' + i](); burst(wx, wy, '#ffd84a', 18, 220); burst(wx, wy, '#fff', 8, 140);
      if (i === 2) for (let k = 0; k < 3; k++) burst(wx + rand(-120, 120), wy + rand(-40, 80), PARTY[randInt(0, 5)], 22, 260);
    } else sfx.starMiss();
  }
  // 入侵者吓得逃跑
  for (const e of L.enemies) {
    const dx = e.x - NEST.x, dy = e.y - NEST.y, dd = Math.hypot(dx, dy) || 1;
    e.x += dx / dd * 300 * dt; e.y += dy / dd * 300 * dt;
    e.face = dx < 0 ? -1 : 1; e.t += dt * 2; e.flash = 0;
    if (e.x < -60 || e.x > WORLD.w + 60 || e.y < -60 || e.y > WORLD.h + 60) e.dead = true;
  }
  L.enemies = L.enemies.filter(e => !e.dead);
  for (const f of L.fish) {
    const d = dist(f, c), s = 800 * dt / (d || 1);
    f.x += (c.x - f.x) * Math.min(1, s); f.y += (c.y - f.y) * Math.min(1, s);
    if (d < c.r + 8) { f.dead = true; sfx.pickup(); }
  }
  L.fish = L.fish.filter(f => !f.dead);
  // 彩纸和烟花（三星时更盛大）
  const vw = W / scale, vh = H / scale, party = G.lastStars === 3 ? 2 : 1;
  for (let i = 0; i < 2 * party; i++) L.parts.push({ x: cam.x + rand(0, vw), y: cam.y - 10, vx: rand(-40, 40), vy: rand(140, 300), life: rand(1.2, 2.2), color: PARTY[randInt(0, 5)], r: rand(3, 5.5) });
  L.fireworkT -= dt;
  if (L.fireworkT <= 0) {
    L.fireworkT = 0.4 / party;
    burst(cam.x + rand(vw * 0.15, vw * 0.85), cam.y + rand(vh * 0.15, vh * 0.6), PARTY[randInt(0, 5)], 22, 260);
    sfx.firework();
  }
  for (const p of L.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  for (const t of L.texts) { t.y -= 34 * dt; t.life -= dt; }
  L.parts = L.parts.filter(p => p.life > 0);
  L.texts = L.texts.filter(t => t.life > 0);
  if (L.clearT >= CLEAR_TIME) openShop();
}
// 点一下先把星星直接显示完，再点一下进商店
function skipClear() {
  if (state !== 'clear' || L.clearT < 0.7) return;
  if (L.clearT < STARS_DONE) { L.clearT = STARS_DONE; L.starSnd = 3; } else openShop();
}
function openShop() {
  delete L.cat.hop;
  L.enemies = []; L.fish = [];
  setState('shop');
  renderShop();
  $('shopBody').scrollTop = 0;
  show('shop');
}

function gameOver(reason) {
  const cleared = G.level - 1;
  if (cleared > store.best) { store.best = cleared; save(); }
  clearRun();
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
  saveRun();
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
  saveRun();
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
  const starRow = n => [0, 1, 2].map(i => `<span class="${i < n ? '' : 'off'}">★</span>`).join('');
  const totalStars = Object.values(G.stars).reduce((a, b) => a + b, 0);
  let h = `<div class="shophead"><h2>第 ${G.level} 关完成！<span class="stars">${starRow(G.lastStars)}</span></h2>
    <div class="fishbar">🐟 ${fish}</div></div>
    <div style="font-size:13px;margin:2px 0 8px">过关奖励 +${G.lastBonus}${G.lastStarBonus ? `，星级奖励 +${G.lastStarBonus}` : ''} 🐟　·　累计 ★ ${totalStars}</div>
    <div class="minicard"><div class="txt"><b>汉字小游戏 · ${mt.name}</b><br>答 3 道题，每答对一题 +${miniReward()} 🐟，全对再 +15 🐟。</div>
    ${btn('mini', '', G.miniPlayed ? '已玩过' : '开始', !G.miniPlayed)}</div>`;

  // 武器库：同品级的武器叠在一起，凑够数量可以合成
  const own = ownedList(), canMerge = own.some(o => o.tier < TIERS.length - 1 && o.n >= MERGE_NEED[o.tier]);
  h += `<h3>武器库</h3><div class="wtools"><span>相同的武器 ${MERGE_NEED[0]} 把合成 1 把更高一阶（A 级起需要 ${MERGE_NEED[3]} 把）</span>
    <button data-action="mergeAll" ${canMerge ? '' : 'disabled'}>一键合成</button></div><div class="wgrid">`;
  for (const o of own) {
    const w = weaponDef(o.id), s = weaponStats(o.id, o.tier), eqd = G.eq.id === o.id && G.eq.tier === o.tier;
    const need = MERGE_NEED[o.tier], top = o.tier >= TIERS.length - 1, key = `${o.id}:${o.tier}`;
    h += `<div class="wcell t${o.tier}${eqd ? ' equipped' : ''}" style="--tc:${TIERS[o.tier].color}">
      <div class="top"><img class="wi" src="${ICONS.url[o.id]}" alt=""><div style="text-align:right">${tierBadge(o.tier)}<div class="cnt">×${o.n}</div></div></div>
      <div class="wn">${w.name}</div>
      <div class="ws">伤害 ${Math.round(s.dmg)}${s.count > 1 ? '×' + s.count : ''} · 射速 ${(1 / s.interval).toFixed(1)}/秒<br>${s.area}</div>
      <div class="row">${btn('eqW', key, eqd ? '使用中' : '装备', !eqd)}${top ? '' : `<button class="merge" data-action="mergeW" data-id="${key}" ${o.n >= need ? '' : 'disabled'}>合成 ${o.n}/${need}</button>`}</div></div>`;
  }
  h += '</div><h3>购买武器（D 级）</h3><div class="cards">';
  for (const w of WEAPONS) {
    const s = weaponStats(w.id, 0), have = G.inv[w.id].reduce((a, b) => a + b, 0);
    h += card({ icon: w.id, name: w.name, py: w.py, desc: w.desc,
      lv: `D 级　伤害 ${Math.round(s.dmg)}${s.count > 1 ? '×' + s.count : ''}　${s.area}${have ? `　已有 ${have} 把` : ''}`,
      btns: btn('buyW', w.id, `购买 ${w.cost} 🐟`, fish >= w.cost) });
  }
  h += '</div><h3>道具（有使用次数，用完就消失）</h3><div class="cards">';
  for (const it of ITEMS) {
    const st = G.items[it.id], upC = itemUpCost(it, st.lv);
    const btns = btn('buyI', it.id, `+${it.pack} 次 ${it.cost} 🐟`, fish >= it.cost && st.uses < ITEM_CAP)
      + (st.lv < it.max ? btn('upI', it.id, `升级 ${upC} 🐟`, fish >= upC) : btn('', '', '强度已满', false));
    h += card({ icon: it.id, name: it.name, py: it.py, desc: it.desc, lv: `剩余 <b>${st.uses}</b> 次　强度 ${st.lv}/${it.max}：${it.eff(st.lv)}`, btns });
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
  h += `</div><div class="shopfoot"><button class="big" data-action="next">开始第 ${G.level + 1} 关${nextBoss ? '（头目关！）' : ''}</button><br>
    <button class="plain" data-action="toMenu">回到主菜单（进度已自动保存）</button></div>`;
  const body = $('shopBody'), st = body.scrollTop;
  body.innerHTML = h;
  body.scrollTop = st;
}

function pay(cost) { if (G.fish < cost) return false; G.fish -= cost; sfx.buy(); return true; }

// 合成成功的庆祝画面
let mergeTimer = 0;
function showMerge(id, from, to) {
  const el = $('mergeFx'), w = weaponDef(id);
  el.innerHTML = `<div class="mfbox"><div class="mfrays"></div><div class="ttl">合成成功！</div><img src="${ICONS.url[id]}" alt="">
    <div>${tierBadge(from)} → ${tierBadge(to, 'big')}</div><div class="sub">${w.name}　${TIERS[to].name}</div></div>`;
  el.classList.add('show');
  if (to >= 4) sfx.mergeBig(); else sfx.merge();
  clearTimeout(mergeTimer); mergeTimer = setTimeout(hideMerge, 2200);
}
function hideMerge() { $('mergeFx').classList.remove('show'); }
$('mergeFx').addEventListener('click', hideMerge);

function shopAction(action, id) {
  if (action === 'buyW') { const w = weaponDef(id); if (pay(w.cost)) { G.inv[id][0]++; fixEquip(); } }
  else if (action === 'eqW') { const [wid, t] = id.split(':'); if (G.inv[wid] && G.inv[wid][+t] > 0) { G.eq = { id: wid, tier: +t }; sfx.switch(); } }
  else if (action === 'mergeW') {
    const [wid, t] = id.split(':');
    if (G.inv[wid] && mergeWeapon(wid, +t)) { fixEquip(); showMerge(wid, +t, +t + 1); }
  }
  else if (action === 'mergeAll') { const top = mergeAll(); if (top) showMerge(top.id, top.from, top.to); }
  else if (action === 'buyI') { const it = itemDef(id), st = G.items[id]; if (st.uses < ITEM_CAP && pay(it.cost)) st.uses = Math.min(ITEM_CAP, st.uses + it.pack); }
  else if (action === 'upI') { const it = itemDef(id), st = G.items[id]; if (st.lv < it.max && pay(itemUpCost(it, st.lv))) st.lv++; }
  else if (action === 'stat') {
    const s = STATS.find(x => x.id === id), lv = G.stats[id];
    if (lv < s.max && pay(statCost(lv))) { G.stats[id]++; if (id === 'nestHp') G.nestHp += 100; }
  }
  else if (action === 'repair') { if (G.nestHp < nestMaxHp() && pay(REPAIR_COST)) G.nestHp = Math.min(nestMaxHp(), G.nestHp + REPAIR_HP); }
  saveRun();
  renderShop();
}

// ---------- 按钮事件 ----------
function refreshToggles() {
  for (const n of [1, 2]) {
    $('tglPinyin' + n).textContent = '拼音：' + (store.pinyin ? '开' : '关');
    $('tglMute' + n).textContent = '声音：' + (store.mute ? '关' : '开');
  }
  $('bestText').textContent = store.best ? `最高纪录：通过 ${store.best} 关` : '';
  const run = loadRun();
  $('btnContinue').style.display = run ? '' : 'none';
  if (run) $('btnContinue').textContent = `继续游戏（从第 ${run.level + 1} 关开始）`;
  $('btnStart').textContent = run ? '开始新游戏' : '开始游戏';
  $('btnStart').className = run ? 'tgl' : 'big';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  initAudio();
  const a = b.dataset.action, id = b.dataset.id;
  switch (a) {
    case 'start':
      if (state === 'menu' && loadRun() && !confirm('开始新游戏会覆盖已保存的进度，确定吗？')) break;
      newGame(); break;
    case 'continue': continueGame(); break;
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
    case 'buyW': case 'eqW': case 'mergeW': case 'mergeAll': case 'buyI': case 'upI': case 'stat': case 'repair': shopAction(a, id); break;
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
  if (!L || !ilv('fence')) return;
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

function drawHelper(h) {
  const bob = Math.sin(performance.now() / 150 + h.side) * 2;
  ell(h.x, h.y + 13, 10, 3.5, 'rgba(0,0,0,.18)');
  ctx.lineWidth = 2; ell(h.x, h.y + 6 + bob, 8, 7, '#ffb347', OUT); ell(h.x, h.y + 8 + bob, 4, 4, '#fff');
  ctx.save(); ctx.translate(h.x, h.y + 4 + bob); ctx.rotate(h.aim); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT;
  ctx.fillStyle = '#6b7686'; ctx.fillRect(5, -2, 11, 4); ctx.strokeRect(5, -2, 11, 4);
  ctx.restore();
  ctx.drawImage(ICONS.canvas.helper, h.x - 13, h.y - 21 + bob, 26, 26);
}
function drawGadgets() {
  if (ilv('shuriken')) {
    const nSh = ilv('shuriken') + 1;
    for (let i = 0; i < nSh; i++) {
      const a = L.shAngle + i * TAU / nSh, bx = NEST.x + Math.cos(a) * SHURIKEN_R, by = NEST.y + Math.sin(a) * SHURIKEN_R;
      // 拖尾
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = `rgba(200,225,255,${0.5 - k * 0.15})`; ctx.lineWidth = 9 - k * 2.5;
        ctx.beginPath(); ctx.arc(NEST.x, NEST.y, SHURIKEN_R, a - 0.18 - k * 0.2, a - k * 0.2); ctx.stroke();
      }
      ctx.save(); ctx.translate(bx, by); ctx.rotate(performance.now() / 45);
      ctx.drawImage(ICONS.canvas.shuriken, -21, -21, 42, 42);
      ctx.restore();
    }
  }
  if (ilv('lightning')) {
    const y = NEST.y - 112 + Math.sin(performance.now() / 500) * 4;
    ctx.globalAlpha = 0.95; ctx.drawImage(ICONS.canvas.lightning, NEST.x - 30, y - 22, 60, 60); ctx.globalAlpha = 1;
  }
  for (const b of L.bolts) {
    ctx.globalAlpha = clamp(b.life / 0.2, 0, 1); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [color, w] of [['#fff7b0', 9], ['#ffd84a', 5], ['#fff', 2]]) {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
      b.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawFish(f) {
  ctx.save(); ctx.translate(f.x, f.y + Math.sin(performance.now() / 200 + f.x) * 2);
  ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.fillStyle = '#ffd27a';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(12, -5); ctx.lineTo(12, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ell(0, 0, 8, 4.5, '#ffd27a', OUT);
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(-4, -1, 1, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawDrop(d) {
  if (d.life < 3 && Math.floor(d.life * 6) % 2) return;   // 快消失时闪烁
  const y = d.y + Math.sin(d.t * 4) * 3;
  ell(d.x, d.y + 17, 13, 4, 'rgba(0,0,0,.18)');
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.beginPath(); ctx.arc(d.x, y, 20 + Math.sin(d.t * 6) * 2, 0, TAU); ctx.stroke();
  ctx.lineWidth = 3; ell(d.x, y, 15, 15, d.buff.color, OUT);
  ell(d.x - 5, y - 6, 4, 2.5, 'rgba(255,255,255,.55)');
  outlined(d.buff.ch, d.x, y + 1, 17);
}

function drawCat(c) {
  const cheer = c.hop !== undefined;
  const face = cheer ? 1 : Math.cos(c.aim) < 0 ? -1 : 1;
  const bob = cheer ? c.hop : c.moving ? Math.sin(c.walk) * 2 : Math.sin(performance.now() / 400) * 0.8;
  const form = L.form && FORMS[L.form];
  const S = c.s * (1 + 0.45 * Math.sin(Math.PI * L.morphT / 0.4));   // 变身瞬间鼓一下
  for (const t of L.trail) {   // 残影
    ctx.globalAlpha = t.life; ell(t.x, t.y + 18 - 12 * t.s, 14 * t.s, 12 * t.s, t.color); ell(t.x, t.y + 18 - 30 * t.s, 15 * t.s, 13 * t.s, t.color);
  }
  ctx.globalAlpha = c.inv > 0 && Math.floor(c.inv * 20) % 2 ? 0.5 : 1;
  ctx.save(); ctx.translate(c.x, c.y + 18); ctx.scale(S, S); ctx.translate(-c.x, -(c.y + 18));
  if (L.form === 'giant') { ctx.strokeStyle = 'rgba(255,216,74,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(c.x, c.y - 4, 30 + Math.sin(performance.now() / 90) * 2, 0, TAU); ctx.stroke(); }
  ell(c.x, c.y + 18, 17, 5, 'rgba(0,0,0,.18)');
  if (L.catnipT > 0) { ctx.strokeStyle = 'rgba(156,255,107,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, 27 + Math.sin(performance.now() / 80) * 2, 0, TAU); ctx.stroke(); }
  if (L.buffT.shield > 0) {
    const blink = L.buffT.shield < 1.5 && Math.floor(L.buffT.shield * 8) % 2;
    if (!blink) { ctx.lineWidth = 3; ell(c.x, c.y - 4, 32, 32, 'rgba(90,169,255,.25)', 'rgba(90,169,255,.9)'); }
  }
  if (L.buffT.power > 0) { ctx.strokeStyle = 'rgba(255,107,94,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, 23 + Math.sin(performance.now() / 70) * 2, 0, TAU); ctx.stroke(); }
  ctx.save(); ctx.translate(c.x, c.y + bob); ctx.scale(cheer ? 1 : face, 1);
  ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
  const FUR = form ? form.fur : '#aab6c8', DARK = form ? form.dark : '#7b889c';
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
  if (cheer) {   // 开心的眯眯眼
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-2, -12, 2.6, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(9, -12, 2.6, Math.PI, 0); ctx.stroke();
  } else {
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(-2, -13, 2.2, 0, TAU); ctx.arc(9, -13, 2.2, 0, TAU); ctx.fill();
    if (L.form === 'giant' || L.form === 'power') {   // 变身后眼神更凶
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(0, -15.5); ctx.moveTo(13, -18); ctx.lineTo(7, -15.5); ctx.stroke();
    }
  }
  ctx.fillStyle = '#ff8fa3'; ctx.beginPath(); ctx.moveTo(2, -9.5); ctx.lineTo(6, -9.5); ctx.lineTo(4, -7.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(4, -7.5); ctx.quadraticCurveTo(2, -4.5, 0.5, -6.5); ctx.moveTo(4, -7.5); ctx.quadraticCurveTo(6, -4.5, 7.5, -6.5); ctx.stroke();
  ctx.restore();
  // 枪：和商店图标是同一张图
  const [gx, gy] = ICONS.grip[G.eq.id], gs = 0.62;
  ctx.save(); ctx.translate(c.x, c.y + 4 + bob); ctx.rotate(c.aim); ctx.scale(1, face);
  if (G.eq.tier > 0) {   // 高阶武器带品级光晕
    const ga = ctx.globalAlpha; ctx.globalAlpha = ga * (0.28 + 0.1 * Math.sin(performance.now() / 160));
    ell(22, 1, 18 + G.eq.tier * 1.5, 11 + G.eq.tier, tierColor(G.eq.tier)); ctx.globalAlpha = ga;
  }
  ctx.drawImage(ICONS.held[G.eq.id], 11 - gx * gs, 1 - gy * gs, 64 * gs, 64 * gs);
  ctx.lineWidth = 2; ctx.strokeStyle = OUT;
  ell(11, 3, 4.5, 4, '#fff', OUT);   // 小爪子
  ctx.restore();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function coneFill(o, a, len, fill, stroke, hs = 1) {
  ctx.beginPath(); ctx.moveTo(o.x, o.y);
  ctx.arc(o.x, o.y, len, a - BREATH_HALF * hs, a + BREATH_HALF * hs);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
// 巨龙的预警：陨石落点和火焰扇形
function drawDragonTelegraph(e) {
  ctx.lineWidth = 2;
  for (const m of e.meteors) {
    const p = clamp(m.t / m.delay, 0, 1);
    ell(m.x, m.y, 74, 74, `rgba(230,60,40,${0.1 + 0.2 * p})`, 'rgba(230,60,40,.7)');
    ell(m.x, m.y, 74 * p, 74 * p, `rgba(255,120,40,${0.2 + 0.3 * p})`);
    if (p > 0.35) {   // 从天而降的火球
      const q = (p - 0.35) / 0.65, fy = m.y - (1 - q) * 320, fx = m.x - (1 - q) * 70;
      for (let k = 3; k >= 1; k--) ell(fx + k * 7, fy - k * 14, 12 - k * 2, 12 - k * 2, 'rgba(255,' + (120 + k * 30) + ',60,.35)');
      ell(fx, fy, 14, 14, '#ff9a3c', OUT); ell(fx - 3, fy - 3, 6, 6, '#ffe066');
    }
  }
  if (e.sub === 'breath' && (e.st === 'wind' || e.st === 'act')) {
    const o = dragonMouth(e);
    if (e.st === 'wind') {
      const wp = 1 - e.stT / e.stDur;
      coneFill(o, e.dir, BREATH_LEN, `rgba(230,60,40,${0.1 + 0.2 * wp})`, 'rgba(230,60,40,.7)');
    } else {
      const fl = 1 + Math.sin(performance.now() / 40) * 0.05;
      coneFill(o, e.fire, BREATH_LEN * 0.95 * fl, 'rgba(255,90,40,.5)');
      coneFill(o, e.fire, BREATH_LEN * 0.7, 'rgba(255,170,60,.55)', null, 0.8);
      coneFill(o, e.fire, BREATH_LEN * 0.4, 'rgba(255,240,150,.7)', null, 0.55);
    }
  }
}

// 头目攻击前的地面预警
function drawTelegraph(e) {
  if (e.type !== 'boss') return;
  if (e.kind.special === 'dragon') return drawDragonTelegraph(e);
  if (e.st !== 'wind' && e.st !== 'act') return;
  const sp = e.kind.special, wp = e.st === 'wind' ? 1 - e.stT / e.stDur : 1;
  const fill = `rgba(230,60,40,${0.12 + 0.22 * wp})`, edge = 'rgba(230,60,40,.7)';
  ctx.lineWidth = 2;
  if (e.st === 'wind' && (sp === 'stomp' || sp === 'roar')) ell(e.x, e.y, sp === 'stomp' ? 210 : 290, sp === 'stomp' ? 210 : 290, fill, edge);
  else if (sp === 'pounce') ell(e.tx, e.ty, 85, 85, fill, edge);
  else if (e.st === 'wind' && (sp === 'charge' || sp === 'dash')) {
    const len = sp === 'charge' ? 700 : 260;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.dir);
    ctx.fillStyle = fill; ctx.strokeStyle = edge;
    ctx.beginPath(); ctx.roundRect(0, -e.r * 0.8, len, e.r * 1.6, 12); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
// 根据头目当前的动作算出姿势，再交给 bosses.js 画
function drawBossBody(e, fl) {
  const sp = e.kind.special, wind = e.st === 'wind', act = e.st === 'act';
  const wp = wind ? 1 - e.stT / e.stDur : 0;
  const lunge = e.atkAnim > 0 ? Math.sin((1 - e.atkAnim / 0.4) * Math.PI) : 0;
  const pose = { t: e.t, walk: e.walking, fl, mouth: lunge, headRot: -lunge * 0.15, lean: 0, puff: 0, trunkUp: lunge * 0.6 };
  let crouch = 0, rear = 0, stretch = 0, shake = 0, tilt = 0;
  if (wind) {
    if (sp === 'bark') { pose.headRot = -0.45 * wp; pose.mouth = wp > 0.6 ? 1 : 0; }
    else if (sp === 'dash' || sp === 'pounce') { crouch = wp; shake = 1.5; }
    else if (sp === 'howl') { pose.headRot = -0.75 * wp; pose.mouth = wp; }
    else if (sp === 'stomp') { rear = wp; pose.trunkUp = wp; }
    else if (sp === 'spit') { pose.lean = wp; pose.mouth = wp; }
    else if (sp === 'roar') { pose.mouth = 1; pose.puff = wp; shake = 2.5; pose.headRot = -0.2; }
    else if (sp === 'charge') { pose.headRot = 0.3 * wp; crouch = 0.3 * wp; shake = 2; }
  } else if (act) {
    if (sp === 'dash' || sp === 'charge') { stretch = 1; tilt = 0.1; pose.walk = true; pose.t = e.t * 3; pose.headRot = sp === 'charge' ? 0.3 : 0; }
    else if (sp === 'pounce') { pose.mouth = 1; tilt = -0.25 + 0.5 * (1 - e.stT / e.stDur); }
  } else if (e.st === 'rest' && (sp === 'roar' || sp === 'bark' || sp === 'howl')) { pose.mouth = 1; pose.puff = 1; if (sp === 'howl') pose.headRot = -0.75; }
  if (sp === 'dragon') {
    const br = e.sub === 'breath';
    pose.mouth = e.st === 'act' && br ? 1 : e.st === 'wind' && br ? wp : lunge;
    if (e.st === 'wind') pose.wing = -0.55 - 0.2 * wp;
    else if (e.st === 'act' && br) pose.wing = -0.35 + Math.sin(e.t * 8) * 0.08;
    pose.headRot = e.st === 'wind' && br ? -0.2 * wp : 0;
  }
  const k = e.r / 40;
  ctx.translate(lunge * 16 + (shake ? rand(-shake, shake) : 0), -e.z - rear * 22 + crouch * 7);
  ctx.rotate(tilt - rear * 0.38);
  ctx.scale(k * (1 + stretch * 0.14 + crouch * 0.08), k * (1 - crouch * 0.2 - stretch * 0.08));
  BOSS_ART.draw(ctx, e.kind.id, pose);
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
    drawBossBody(e, fl);
  } else if (e.type === 'elite') {
    const c = fl ? '#fff' : '#9a8672';
    const dash = e.t % 4 > 3;
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-r, 6); ctx.quadraticCurveTo(-r - 18, 12 + wob, -r - 22, -6); ctx.strokeStyle = '#e59aa0'; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = OUT;
    // 小披风
    ctx.fillStyle = '#c8402d'; ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-r - 8, 4 + wob); ctx.lineTo(-r - 2, 16); ctx.lineTo(-4, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ell(-12, -r + 6, 9, 9, c, OUT); ell(-12, -r + 6, 4.5, 4.5, '#f5b8bd');
    ell(0, 2, r, r * 0.85, c, OUT);
    ell(4, 9, 11, 8, '#e9dccb');
    // 铁桶头盔
    ctx.fillStyle = fl ? '#fff' : '#9aa7b5';
    ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-7, -r - 10); ctx.lineTo(19, -r - 10); ctx.lineTo(22, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(24, -8); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(6, -r - 10, 9, Math.PI, 0); ctx.stroke(); ctx.lineWidth = 3;
    // 凶凶的眼睛
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10, -1, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = dash ? '#c8402d' : OUT; ctx.beginPath(); ctx.arc(11, -1, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -7); ctx.lineTo(16, -3); ctx.stroke();
    ell(r - 1, 5, 3.5, 3.5, '#ff8fa3', OUT);
    ctx.fillStyle = '#fff'; ctx.fillRect(14, 10, 3, 5); ctx.strokeRect(14, 10, 3, 5);
  }
  ctx.restore();
  // 冰冻效果
  if (L.buffT.freeze > 0) {
    ctx.lineWidth = 2;
    ell(e.x, e.y - (e.type === 'boss' ? 8 : 0) - (e.z || 0), r * 1.25, r * 1.25, 'rgba(160,230,255,.45)', 'rgba(255,255,255,.9)');
  }
  // 血条
  const big = e.type === 'boss' || e.type === 'elite';
  if (e.hp < e.maxHp || big) {
    const bw = e.type === 'boss' ? 96 : e.type === 'elite' ? 56 : r * 2;
    const by = e.y - (e.z || 0) - (e.type === 'boss' ? (e.kind.barY || r + 34) : r + (e.type === 'elite' ? 26 : 14));
    if (e.type === 'boss') outlined(e.kind.name, e.x, by - 12, 14, e.hp < e.maxHp / 2 ? '#ff9a8a' : '#fff');
    ctx.fillStyle = OUT; ctx.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = big ? '#c8402d' : '#ff7a5c'; ctx.fillRect(e.x - bw / 2, by, bw * clamp(e.hp / e.maxHp, 0, 1), 4);
  }
}

function flashStar(x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16, rr = i % 2 ? r * 0.38 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
// 五角星：结算画面的星级用它
function drawStar(x, y, R, fill, stroke, lw = 3, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + rot + i * Math.PI / 5, r = i % 2 ? R * 0.48 : R; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function drawTierBadge(x, yMid, t) {
  const label = TIERS[t].id, w = label.length > 1 ? 36 : 22, h = 17;
  ctx.beginPath(); ctx.roundRect(x, yMid - h / 2, w, h, 6);
  if (t >= 5) { const g = ctx.createLinearGradient(x, 0, x + w, 0); ['#ff5e5e', '#ffd84a', '#6fe06f', '#4fc3ff', '#b48cff'].forEach((c, i) => g.addColorStop(i / 4, c)); ctx.fillStyle = g; }
  else ctx.fillStyle = tierColor(t);
  ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.strokeText(label, x + w / 2, yMid + 1); ctx.fillStyle = '#fff'; ctx.fillText(label, x + w / 2, yMid + 1);
}

function drawBullet(b) {
  if (b.tier > 0) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.35; ell(b.x, b.y, b.r * 2.4 + b.tier, b.r * 2.4 + b.tier, tierColor(b.tier)); ctx.globalAlpha = ga; }
  ctx.lineWidth = 1.5; ctx.strokeStyle = OUT;
  if (b.kind === 'laser') {
    const a = Math.atan2(b.vy, b.vx);
    ctx.strokeStyle = '#ffb0b0'; ctx.lineWidth = b.r * 1.3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x - Math.cos(a) * 26, b.y - Math.sin(a) * 26); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = b.color; ctx.lineWidth = b.r * 0.65; ctx.stroke();
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
  const w = weaponDef(G.eq.id), cn = G.items.catnip;
  let y = 66;
  ctx.drawImage(ICONS.canvas[w.id], 8, y - 15, 30, 30);
  outlined(w.name, 42, y, 14, '#fff', 'left');
  drawTierBadge(42 + ctx.measureText(w.name).width + 8, y, G.eq.tier);
  y += 28;
  if (cn.uses > 0 || L.catnipT > 0) {
    ctx.drawImage(ICONS.canvas.catnip, 10, y - 13, 26, 26);
    outlined(`猫薄荷 ×${cn.uses}${L.catnipT > 0 ? `（${Math.ceil(L.catnipT)}秒）` : ''}`, 42, y, 14, '#c9ff9e', 'left'); y += 26;
  }
  if (L.atkBuff > 0) { outlined(`攻击力 +${Math.round(L.atkBuff * 100)}%`, 10, y, 14, '#ffe066', 'left'); y += 24; }
  for (const b of BUFFS) {
    const t = L.buffT[b.id];
    if (!(t > 0)) continue;
    ctx.lineWidth = 2; ell(22, y, 11, 11, b.color, OUT);
    outlined(b.ch, 22, y + 1, 13);
    outlined(`${b.name} ${Math.ceil(t)}秒`, 42, y, 14, '#fff', 'left');
    y += 26;
  }
  // 本关生效的道具和剩余次数
  let ix = 10;
  for (const it of ITEMS) {
    if (it.manual || !L.on[it.id]) continue;
    if (ix > W - 130) { ix = 10; y += 28; }
    const left = G.items[it.id].uses;
    ctx.drawImage(ICONS.canvas[it.id], ix, y - 12, 24, 24);
    outlined(left > 0 ? `×${left}` : '最后一次', ix + 26, y + 1, 11, left > 0 ? '#fff' : '#ffb0a0', 'left');
    ix += left > 0 ? 56 : 92;
  }
  $('btnCatnip').disabled = cn.uses <= 0 || L.catnipT > 0;
  $('btnCatnip').style.display = cn.uses > 0 || L.catnipT > 0 ? '' : 'none';

  if (L.banner > 0 && state !== 'clear') {
    ctx.globalAlpha = clamp(L.banner, 0, 1);
    outlined(`第 ${G.level} 关`, W / 2, H * 0.3, 46, '#ffe066');
    outlined(L.isBoss ? '头目关！准备回答问题' : '保卫猫窝！', W / 2, H * 0.3 + 44, 20);
    ctx.globalAlpha = 1;
  }
  // 头目方向提示
  if (state !== 'clear') for (const e of L.enemies) {
    if (e.type !== 'boss' && e.type !== 'elite') continue;
    const sx = (e.x - cam.x) * scale, sy = (e.y - cam.y) * scale;
    if (sx < 0 || sx > W || sy < 0 || sy > H) {
      const a = Math.atan2(sy - H / 2, sx - W / 2);
      const px = clamp(W / 2 + Math.cos(a) * W, 36, W - 36), py = clamp(H / 2 + Math.sin(a) * H, 90, H - 30);
      outlined(e.type === 'boss' ? e.kind.name : '小头目', px, py, 15, '#ff9a8a');
    }
  }
  if (L.notice) { ctx.globalAlpha = clamp(L.notice.t, 0, 1); outlined(L.notice.text, W / 2, H * 0.24, 26, '#ff9a8a'); ctx.globalAlpha = 1; }
  // 过关庆祝：标题 → 三颗星依次出现 → 受伤情况和奖励
  if (state === 'clear') {
    const t = L.clearT, k = Math.min(1, t / 0.35), pop = 1 + 0.35 * Math.sin(k * Math.PI) * (1 - k * 0.3);
    const lay = clearLayout(), u = lay.u, cx = W / 2;
    outlined(`第 ${G.level} 关`, cx, lay.y0 + 18 * u, 26 * u * (0.3 + 0.7 * k), '#fff');
    outlined(L.isBoss ? '打败头目！' : '过关！', cx, lay.y0 + 66 * u, 52 * u * (0.3 + 0.7 * k) * pop, '#ffe066');
    for (let i = 0; i < 3; i++) {
      const p = starPos(i), t0 = STAR_T0 + i * STAR_GAP, q = clamp((t - t0) / 0.4, 0, 1);
      if (t > 0.9) { ctx.globalAlpha = clamp((t - 0.9) * 3, 0, 1); drawStar(p.x, p.y, lay.R, 'rgba(60,40,20,.35)', 'rgba(255,255,255,.55)', 3); ctx.globalAlpha = 1; }
      if (t >= t0 && i < G.lastStars) {
        const sc = 0.3 + 0.7 * q + 0.45 * Math.sin(q * Math.PI) * (1 - q * 0.4);
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc, sc); ctx.rotate((1 - q) * 0.9);
        drawStar(0, 0, lay.R * 1.12, '#ffd84a', OUT, 4);
        drawStar(-lay.R * 0.15, -lay.R * 0.2, lay.R * 0.4, 'rgba(255,255,255,.7)', null);
        ctx.restore();
      }
    }
    const tInfo = STAR_T0 + 3 * STAR_GAP;
    if (t > 1.0) { ctx.globalAlpha = clamp((t - 1.0) * 3, 0, 1); outlined(`猫咪受伤 ${Math.round(G.lastCatLoss * 100)}%　猫窝受伤 ${Math.round(G.lastNestLoss * 100)}%`, cx, lay.y0 + 188 * u, 16 * u, '#fff'); ctx.globalAlpha = 1; }
    if (t > tInfo - 0.2) {
      ctx.globalAlpha = clamp((t - tInfo + 0.2) * 3, 0, 1);
      outlined(['', '再稳一点就能拿更多星！', '不错！', '完美！'][G.lastStars], cx, lay.y0 + 216 * u, 22 * u, G.lastStars === 3 ? '#ffe066' : '#fff');
      outlined(`过关奖励 +${G.lastBonus} 🐟${G.lastStarBonus ? `　星级奖励 +${G.lastStarBonus} 🐟` : ''}`, cx, lay.y0 + 244 * u, 17 * u, '#ffe9a8');
      ctx.globalAlpha = 1;
    }
    if (t > STARS_DONE) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6); outlined('点击屏幕继续', cx, H * 0.86, 15, '#fff'); ctx.globalAlpha = 1; }
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
  for (const e of L.enemies) drawTelegraph(e);
  for (const r of L.rings) {
    const p = 1 - r.life / r.maxLife;
    const ease = 1 - (1 - p) * (1 - p);
    ctx.globalAlpha = 1 - p; ctx.strokeStyle = r.color; ctx.lineWidth = 6 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.max * ease, 0, TAU);
    if (r.fill) { ctx.save(); ctx.globalAlpha = (1 - p) * 0.22; ctx.fillStyle = r.color; ctx.fill(); ctx.restore(); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const f of L.fish) drawFish(f);
  for (const d of L.drops) drawDrop(d);
  // 按 y 排序，产生前后遮挡
  const objs = [{ y: NEST.y + 30, draw: drawNest }, { y: L.cat.y, draw: () => drawCat(L.cat) }];
  for (const t of L.turrets) objs.push({ y: t.y, draw: () => drawTurret(t) });
  for (const e of L.enemies) objs.push({ y: e.y, draw: () => drawEnemy(e) });
  for (const h of L.helpers) objs.push({ y: h.y, draw: () => drawHelper(h) });
  objs.sort((a, b) => a.y - b.y);
  for (const o of objs) o.draw();
  drawGadgets();
  for (const b of L.bullets) drawBullet(b);
  ctx.lineWidth = 2;
  for (const b of L.ebullets) {
    if (b.leaf) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx)); ell(0, 0, 10, 5, '#5fc23f', OUT); ctx.restore(); }
    else { ell(b.x, b.y, b.r, b.r, '#5b4a6b', OUT); ell(b.x - 1.5, b.y - 1.5, 2, 2, '#b8a8c8'); }
  }
  for (const p of L.parts) {
    if (p.color === 'boom') {
      ctx.globalAlpha = clamp(p.life / 0.25, 0, 1) * 0.6;
      ell(p.x, p.y, p.r * (1.1 - p.life * 2), p.r * (1.1 - p.life * 2), '#ffcf70');
    } else if (p.k === 'spark') {
      ctx.globalAlpha = clamp(p.life * 6, 0, 1); ctx.strokeStyle = p.color; ctx.lineWidth = p.r; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke();
    } else if (p.k === 'flash') {
      const q = p.life / p.max; ctx.globalAlpha = clamp(q * 1.5, 0, 1);
      flashStar(p.x, p.y, p.r * (1.3 - 0.5 * q), p.color);
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
  else if (state === 'clear') updateClear(dt);
  render();
  requestAnimationFrame(frame);
}
refreshToggles();
setState('menu');
requestAnimationFrame(frame);

// 调试接口
window.__cat = { get G() { return G; }, get L() { return L; }, get state() { return state; }, set auto(v) { touchMode = v; }, update, startLevel, applyBuff, levelClear, rateLevel, weaponStats, mergeAll, ilv, spawnEnemy };
})();
