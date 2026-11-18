// 猫咪保卫战 — 主程序
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

const canvas = $('game');
let ctx = canvas.getContext('2d');
const WORLD = { w: 1700, h: 1300 };
const NEST = { x: WORLD.w / 2, y: WORLD.h / 2, r: 46 };
const FENCE_R = 150;
const BOSS_EVERY = 3;
const LEVEL_TIME = 60;
const GRID_SIZE = 100; // 地面方格每格 100 像素
const SHOCKWAVE_PUSH = GRID_SIZE * 5; // 冲击波震退五格 = 500 像素

// ---------- 存档与设置 ----------
const store = { best: 0, bestScore: 0, pinyin: true, mute: false, volume: 0.8, grade: 0 };
try { Object.assign(store, JSON.parse(localStorage.getItem('catDefense') || '{}')); } catch (e) { /* 无存档 */ }
if (!Number.isFinite(store.bestScore)) store.bestScore = 0;
store.mute = Boolean(store.mute);
store.volume = Number.isFinite(store.volume) ? clamp(store.volume, 0, 1) : 0.8;
if (![0, 1, 2, 3].includes(store.grade)) store.grade = 0;
const save = () => { try { localStorage.setItem('catDefense', JSON.stringify(store)); } catch (e) { /* 忽略 */ } };

// 分级抽题袋：支持按所选年级或随关卡自动进阶抽题
const bags = {};
function pickFromBank(bank, key) {
  const g = store.grade;
  const lv = G ? G.level : 1;
  const targetFilter = item => {
    if (!item.grade) return true;
    if (g > 0) return item.grade === g;
    if (lv <= 3) return item.grade === 1;
    if (lv <= 8) return item.grade <= 2;
    return true;
  };
  const bagKey = `${key}_${g}_${lv <= 3 ? 1 : lv <= 8 ? 2 : 3}`;
  if (!bags[bagKey] || !bags[bagKey].length) {
    const filtered = bank.filter(targetFilter);
    bags[bagKey] = shuffle(filtered.length ? filtered : bank);
  }
  return bags[bagKey].pop();
}

// ---------- 声音 ---------- (合成器在 sound.js)
const isAudioMuted = () => store.mute || store.volume <= 0;
function applyMasterAudio(playFeedback = false) {
  SFX.setMuted(() => store.mute);
  SFX.setVolume(store.volume);
  if (isAudioMuted()) SFX.stopVoice();
  if (playFeedback && !isAudioMuted()) SFX.play('switch');
}
applyMasterAudio(false);
const initAudio = () => { SFX.init(); applyMasterAudio(false); };
const sfx = new Proxy({}, { get: (_, name) => () => SFX.play(name) });
function toggleMasterMute(showToast = false) {
  store.mute = !store.mute;
  if (!store.mute && store.volume <= 0) store.volume = 0.8;
  save();
  applyMasterAudio(true);
  refreshToggles();
  if (showToast && L) toast(isAudioMuted() ? '🔇 声音已静音' : `🔊 声音已开启 (${Math.round(store.volume * 100)}%)`);
}
function setMasterVolume(val) {
  const v = clamp(Number(val), 0, 1);
  store.volume = Math.round(v * 100) / 100;
  store.mute = store.volume <= 0;
  save();
  applyMasterAudio(false);
  refreshToggles();
}

const ttsCache = new Map();
const ttsInFlight = new Map();
const staticVoiceMap = Object.create(null);
let speakSeq = 0;
let zhBrowserVoice = null;
const lastAnnounce = { text: '', at: 0 };

function pickBrowserVoice() {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  const zh = voices.filter(v => /^zh/i.test(v.lang || ''));
  if (!zh.length) return null;
  const preferred = zh.find(v => /Xiaoxiao|Xiaoyi|Huihui|Ting-?Ting|Meijia|Yaoyao|Google\s*普通话|Microsoft.*Chinese.*(Female|Online|Natural)/i.test(v.name));
  return preferred || zh.find(v => /zh[-_]CN/i.test(v.lang)) || zh[0];
}
if (window.speechSynthesis) {
  zhBrowserVoice = pickBrowserVoice();
  try { window.speechSynthesis.onvoiceschanged = () => { zhBrowserVoice = pickBrowserVoice(); }; } catch (e) { /* ignore */ }
}

function speakBrowser(clean, { interrupt = true, seq = speakSeq } = {}) {
  if (isAudioMuted() || !clean || !window.speechSynthesis) return false;
  const run = () => {
    if (isAudioMuted() || (interrupt && seq !== speakSeq)) return;
    if (interrupt) SFX.stopVoice();
    try {
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = 'zh-CN';
      const voice = zhBrowserVoice || pickBrowserVoice();
      if (voice) { zhBrowserVoice = voice; u.voice = voice; }
      u.volume = clamp(store.volume, 0, 1);
      u.rate = 1.05;
      u.pitch = 1.08;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  };
  if (interrupt) {
    run();
  } else if (SFX.isVoicePlaying()) {
    SFX.onVoiceIdle(() => {
      if (seq === speakSeq) run();
    });
  } else {
    run();
  }
  return true;
}

async function loadVoiceArchive() {
  try {
    const mRes = await fetch('voices/manifest.json', { cache: 'no-store' });
    if (mRes && mRes.ok) {
      const m = await mRes.json().catch(() => null);
      if (m && m.phrases && typeof m.phrases === 'object') {
        for (const k of Object.keys(staticVoiceMap)) delete staticVoiceMap[k];
        Object.assign(staticVoiceMap, m.phrases);
      }
    }
  } catch {
    // 静态语音索引不存在时直接使用浏览器语音托底
  }
}
loadVoiceArchive();

function formatSpeechText(text) {
  return String(text)
    .replace(/_{2,}/g, '什么')
    .replace(/[（(][^）)]*[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü][^）)]*[）)]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/[→·]/g, '，')
    .replace(/[：；]/g, '，')
    .replace(/——|……/g, '，')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchStaticVoiceWav(clean) {
  const cached = ttsCache.get(clean);
  if (cached) return cached;
  const staticFile = staticVoiceMap[clean];
  if (!staticFile) return null;

  let req = ttsInFlight.get(clean);
  if (!req) {
    req = (async () => {
      const sRes = await fetch(`voices/${staticFile}`);
      if (!sRes.ok) return null;
      const buf = await sRes.arrayBuffer();
      if (ttsCache.size >= 100) {
        const oldest = ttsCache.keys().next().value;
        ttsCache.delete(oldest);
      }
      ttsCache.set(clean, buf);
      return buf;
    })().finally(() => {
      ttsInFlight.delete(clean);
    });
    ttsInFlight.set(clean, req);
  }
  return req;
}

async function speak(text, interrupt = true) {
  if (isAudioMuted() || !text) return;
  const clean = formatSpeechText(text);
  if (!clean) return;
  const seq = interrupt ? ++speakSeq : speakSeq;
  if (interrupt) SFX.stopVoice();

  // 优先播放已预生成并保存的优化语音文件；没有存档文件则立即用浏览器语音托底
  if (ttsCache.has(clean) || staticVoiceMap[clean]) {
    try {
      const buf = await fetchStaticVoiceWav(clean);
      if (seq !== speakSeq || isAudioMuted()) return;
      if (buf) {
        const played = await SFX.playVoiceBuffer(buf, { interrupt });
        if (!played && !interrupt && seq === speakSeq && !isAudioMuted()) {
          if (SFX.isVoicePlaying()) {
            SFX.onVoiceIdle(() => {
              if (seq === speakSeq && !isAudioMuted()) SFX.playVoiceBuffer(buf, { interrupt: false });
            });
          } else if (window.speechSynthesis && window.speechSynthesis.speaking) {
            speakBrowser(clean, { interrupt: false, seq });
          }
        }
        return;
      }
    } catch {
      // 读取或解码异常时回退浏览器语音
    }
  }

  if (seq === speakSeq && !isAudioMuted()) {
    speakBrowser(clean, { interrupt, seq });
  }
}
function announce(text) {
  if (isAudioMuted() || !text) return;
  const clean = formatSpeechText(text);
  if (!clean) return;
  const now = performance.now();
  if (clean === lastAnnounce.text && now - lastAnnounce.at < 1500) return;
  lastAnnounce.text = clean;
  lastAnnounce.at = now;
  speak(clean, false);
}

// ---------- 画布与镜头 ----------
let W = 0, H = 0, scale = 1, camZoom = 1;
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

// 背景漂浮微尘与星光粒子（三层视差，增加战场纵深感）
let ambientT = 0;
const AMBIENT_COLORS = ['#ffffff', '#fff8d6', '#ffeaa7', '#d9ffd6'];
const AMBIENT_LAYERS = [
  { count: 30, parallax: 0.35, rMin: 1.1, rMax: 2.0, vxMin: 6,  vxMax: 12, vyMin: -4,  vyMax: 4, aMin: 0.14, aMax: 0.28, starChance: 0.45 },
  { count: 35, parallax: 0.60, rMin: 1.8, rMax: 3.0, vxMin: 10, vxMax: 20, vyMin: -7,  vyMax: 6, aMin: 0.16, aMax: 0.32, starChance: 0.25 },
  { count: 20, parallax: 0.85, rMin: 2.4, rMax: 4.0, vxMin: 14, vxMax: 26, vyMin: -10, vyMax: 8, aMin: 0.14, aMax: 0.26, starChance: 0.20 },
];
const ambientMotes = [];
for (const lay of AMBIENT_LAYERS) {
  for (let i = 0; i < lay.count; i++) {
    ambientMotes.push({
      u: Math.random(), v: Math.random(),
      parallax: lay.parallax,
      r: rand(lay.rMin, lay.rMax),
      vx: rand(lay.vxMin, lay.vxMax),
      vy: rand(lay.vyMin, lay.vyMax),
      alpha: rand(lay.aMin, lay.aMax),
      color: AMBIENT_COLORS[randInt(0, AMBIENT_COLORS.length - 1)],
      star: Math.random() < lay.starChance,
      phase: rand(0, TAU),
      swaySpd: rand(0.4, 1.1),
      swayAmp: rand(4, 12),
      twinkleSpd: rand(1.0, 2.6),
    });
  }
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
    if (k === 'f') { useShockwave(); e.preventDefault(); }
    if (k === 'r') fireMissiles();
    if (k >= '1' && k <= '5') { const w = WEAPONS[+k - 1], t = bestTier(w.id); if (t >= 0) { G.eq = { id: w.id, tier: t }; sfx.switch(); } }
    if (k === 'm') { initAudio(); toggleMasterMute(true); }
    if (k === 'p' || k === 'escape') pauseGame();
  } else if (state === 'paused' && (k === 'p' || k === 'escape')) {
    resumeGame();
  } else if ((state === 'menu' || state === 'paused') && k === 'm') {
    initAudio(); toggleMasterMute(false);
  } else if (state === 'quiz' && quiz) {
    if (!quiz.answered && k >= '1' && k <= '4') answerQuiz(+k - 1);
    else if (quiz.answered && (k === ' ' || k === 'enter')) { e.preventDefault(); finishQuiz(); }
  } else if (state === 'mini' && mini) {
    if (mini.chosen < 0 && k >= '1' && k <= '4') answerMini(+k - 1);
    else if (mini.chosen >= 0 && (k === ' ' || k === 'enter')) { e.preventDefault(); nextMini(); }
  } else if (state === 'exam' && exam && !exam.started && (k === ' ' || k === 'enter')) {
    e.preventDefault(); exam.started = true; renderExam();
  } else if (state === 'exam' && exam && !exam.finished) {
    if (exam.chosen < 0 && k >= '1' && k <= '4') answerExam(+k - 1);
    else if (exam.chosen >= 0 && (k === ' ' || k === 'enter')) { e.preventDefault(); nextExam(); }
  }
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
// 右下角的道具栏：用 pointerdown（按下即触发）。
const ibEls = {};
(function buildItemBar() {
  const bar = $('itemBar');
  const mk = (id, html, cls = '') => { const b = document.createElement('button'); b.className = 'ib ' + cls; b.dataset.ib = id; b.innerHTML = html; bar.appendChild(b); ibEls[id] = { el: b, sig: null }; };
  mk('weapon', '<img alt=""><span class="tierb"></span><span class="key">Q</span>', 'wb');
  mk('missile', `<img src="${ICONS.url.missile}" alt=""><span class="ct"></span><span class="key">R</span>`);
  for (const it of ITEMS) mk(it.id, `<img src="${ICONS.url[it.id]}" alt=""><span class="cd"></span><span class="ct"></span>${it.manual ? `<span class="key">${it.key || '空格'}</span>` : ''}${it.multi ? '<span class="num"></span>' : ''}`);
  bar.addEventListener('pointerdown', e => {
    const b = e.target.closest('.ib');
    if (!b || state !== 'playing') return;
    e.preventDefault(); initAudio();
    pressItem(b.dataset.ib);
  });
  bar.addEventListener('contextmenu', e => e.preventDefault());
})();

// ---------- 游戏状态 ----------
let state = 'menu';  // menu | playing | paused | quiz | exam | shop | mini | over | clear
let G = null;        // 整局数据
let L = null;        // 当前关卡数据

const catMaxHp = () => 100 + 25 * G.stats.catHp;
const catSpeed = () => 190 + 18 * G.stats.catSpd;
const nestMaxHp = () => 300 + 100 * G.stats.nestHp;
const weaponDef = id => WEAPONS.find(w => w.id === id);
const itemDef = id => ITEMS.find(it => it.id === id);
const itemIndex = id => ITEMS.findIndex(it => it.id === id);
const isItemUnlocked = (id, r = G) => {
  const idx = itemIndex(id);
  return idx >= 0 && idx < (r ? r.unlockedItems : 0);
};
const tierColor = t => t >= 5 ? `hsl(${Math.floor(performance.now() / 6) % 360} 90% 58%)` : TIERS[t].color;
const ilv = id => (L && L.on && L.on[id]) || 0;  // 本关生效中的道具强度（0 = 没有生效）
const fenceSlow = () => 0.12 + 0.08 * ilv('fence');
const itemUpCost = (it, lv) => Math.round(it.cost * 1.2 * lv);   // 合成升级 = 再买一份合进去，等级越高越贵
// 道具状态：n = 拥有几个（炮塔/飞镖最多 4 个，其他最多 1 个），lv = 合成等级
const owned = id => G.items[id].n > 0;
const itemPow = id => 1 + 0.35 * (G.items[id].lv - 1);  // 升级带来的伤害倍数
const tierBadge = (t, cls = '') => `<span class="tier t${t} ${cls}" style="--tc:${TIERS[t].color}">${TIERS[t].id}</span>`;

// 某把武器在某个品级下的实际数值
function weaponStats(id, tier) {
  const w = weaponDef(id), T = TIERS[tier];
  const s = {
    dmg: w.dmg * T.dmg, interval: w.interval * T.spd, speed: w.speed, jitter: w.jitter, pierce: w.pierce, life: w.life, color: w.color,
    count: w.count + (id === 'shotgun' ? tier : 0), spread: w.spread + (id === 'shotgun' ? tier * 0.05 : 0),
    explode: w.explode ? w.explode + 14 * tier : 0, splash: 0, r: w.r + (id === 'laser' ? tier * 1.6 : 0),
  };
  if (id === 'shotgun') s.dmg *= w.count / s.count;  // 弹丸多了，但总伤害只按品级增长
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
function totalWeaponCount(r = G) {
  let n = 0;
  for (const w of WEAPONS) for (let t = 0; t < TIERS.length; t++) n += (r.inv[w.id][t] || 0);
  return n;
}
function weaponSellPrice(id, tier) {
  const w = weaponDef(id);
  if (!w) return 0;
  let dCount = 1;
  for (let i = 0; i < tier; i++) dCount *= MERGE_NEED[i] || 2;
  return Math.floor(w.cost * dCount / 2);
}
function fixEquip(r = G) {
  if (r.eq && r.inv[r.eq.id] && r.inv[r.eq.id][r.eq.tier] > 0) return;
  const own = ownedList(r);
  if (!own.length) { r.inv.pistol[0] = 1; r.eq = { id: 'pistol', tier: 0 }; return; }  // 保底：至少有一把枪
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
  $('itemBar').style.visibility = (s === 'playing') ? 'visible' : 'hidden';
}

const freshRun = () => {
  const inv = freshInv(); inv.pistol[0] = 1;
  return {
    level: 1, fish: 0, kills: 0, score: 0, maxCombo: 0,
    inv, eq: { id: 'pistol', tier: 0 },
    items: Object.fromEntries(ITEMS.map(it => [it.id, { n: 0, lv: 1 }])),
    unlockedItems: 1, // 开局只有猫薄荷，之后每击败一个头目按顺序解锁一个
    itemOrder: 2,      // 道具解锁顺序的版本（2 = 猫薄荷、炮塔、冲击波……）
    pendingUnlock: null,
    stats: { catHp: 0, catSpd: 0, nestHp: 0 },
    nestHp: 300, miniPlayed: false, lastBonus: 0, seen: {}, stars: {}, lastStars: 0, lastStarBonus: 0, lastCatLoss: 0, lastNestLoss: 0,
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
    for (const k of ['level', 'fish', 'kills', 'score', 'maxCombo', 'nestHp', 'lastBonus', 'lastStars', 'lastStarBonus', 'lastCatLoss', 'lastNestLoss']) if (Number.isFinite(d[k])) run[k] = d[k];
    run.miniPlayed = !!d.miniPlayed;
    // 旧版的解锁数量不包含开局就有的猫薄荷，所以要多算 1 个
    if (Number.isFinite(d.unlockedItems)) run.unlockedItems = clamp(Math.floor(d.unlockedItems) + (d.itemOrder === 2 ? 0 : 1), 1, ITEMS.length);
    else run.unlockedItems = clamp(1 + Math.floor(run.level / BOSS_EVERY), 1, ITEMS.length);
    run.pendingUnlock = typeof d.pendingUnlock === 'string' ? d.pendingUnlock : null;
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
    // 道具：新格式 {n, lv}；旧格式里有次数的道具（uses / units）转成永久拥有
    for (const it of ITEMS) {
      const v = d.items && d.items[it.id], cap = it.multi || 1;
      let n = 0, lv = 1;
      if (typeof v === 'number') { n = v > 0 ? Math.min(cap, it.multi ? v + 1 : 1) : 0; lv = clamp(Math.floor(v) || 1, 1, it.max); }
      else if (v && typeof v === 'object') {
        n = Number.isFinite(v.n) ? v.n : Array.isArray(v.units) ? v.units.length : v.uses > 0 ? 1 : 0;
        lv = Math.floor(v.lv) || 1;
      }
      run.items[it.id] = { n: clamp(Math.floor(n) || 0, 0, cap), lv: clamp(lv, 1, it.max) };
    }
    for (const st of STATS) if (d.stats && d.stats[st.id] >= 0) run.stats[st.id] = clamp(Math.floor(d.stats[st.id]), 0, Number.isFinite(st.max) ? st.max : 999);
    if (d.seen && typeof d.seen === 'object') for (const k in d.seen) if (d.seen[k]) run.seen[k] = 1;
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
  if (isBossLevel(lv)) return lv >= 18 ? [20, 40] : lv >= 9 ? [30] : [25];
  return lv >= 20 ? [8, 18, 28, 38, 48] : lv >= 14 ? [12, 24, 36, 48] : lv >= 8 ? [15, 30, 45] : lv >= 5 ? [18, 40] : [22];
}
// 敌人潮：第 8 关起，关卡中途会有一大群敌人从同一个方向涌来
function hordeSchedule(lv) {
  if (lv < 8) return [];
  if (isBossLevel(lv)) return [36];
  return lv >= 16 ? [14, 30, 46] : lv >= 12 ? [20, 40] : [28];
}

function startLevel() {
  const fullCatHp = catMaxHp();
  L = {
    time: LEVEL_TIME, elapsed: 0, spawnT: 1.2,
    // 每个关卡开始，猫的生命值回满
    cat: { x: NEST.x, y: NEST.y + 95, r: 17, hp: fullCatHp, cd: 0, inv: 0, aim: 0, walk: 0, moving: false, kx: 0, ky: 0, s: 1 },
    enemies: [], bullets: [], ebullets: [], fish: [], parts: [], texts: [], turrets: [],
    atkBuff: 0, catnipT: 0, catnipCd: 0, shockwaveCd: 0, missileLeft: missileBase(), redRageT: 0, reviveUsed: false,
    catLost: 0, nestLost: 0, catMax: fullCatHp, nestMax: nestMaxHp(), on: {}, starsSnd: 3,
    boss: null, bossSpawned: false, bossHalfAsked: false, isBoss: isBossLevel(G.level),
    shake: 0, banner: 2.2, nestFlash: 0,
    drops: [], buffT: Object.fromEntries(BUFFS.filter(b => b.dur).map(b => [b.id, 0])),
    rings: [], bolts: [], helpers: [], trail: [], shAngle: 0, stormCd: 2, morphT: 0, stompT: 0, trailT: 0, form: null,
    eliteTimes: eliteSchedule(G.level), hordeTimes: hordeSchedule(G.level), notice: null, clearT: 0, fireworkT: 0,
    combo: 0, comboT: 0, comboPop: 0, comboTierMin: 1, lastComboPts: 0, levelScore: 0, levelMaxCombo: 0, comboSplash: null,
    comboBarVis: 0, comboBreakT: 0, comboBreak: null, comboFilter: 0,
  };
  camZoom = 1;
  announce(`第 ${G.level} 关，${L.isBoss ? '头目关，头目会在最后出现' : '保卫猫窝'}`);
  // 开局满血视觉反馈
  ring(L.cat.x, L.cat.y, 65, '#7ed957', 0.55);
  addText(L.cat.x, L.cat.y - 34, `猫咪生命已回满 (${fullCatHp})`, '#9cff6b', 15, 1.4);

  // 道具：已拥有的被动道具每关自动生效（永久拥有，不限次数）
  for (let idx = 0; idx < G.unlockedItems; idx++) {
    const it = ITEMS[idx], st = G.items[it.id];
    if (st.n === undefined) st.n = Array.isArray(st.units) ? st.units.length : st.uses > 0 ? 1 : 0;
    if (!it.manual && st.n > 0) L.on[it.id] = it.multi ? st.n : st.lv;   // 炮塔/飞镖记数量，其他记等级
  }
  for (let i = 0; i < ilv('turret'); i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    L.turrets.push({ x: NEST.x + Math.cos(a) * 82, y: NEST.y + Math.sin(a) * 82, cd: rand(0, 0.5), aim: a });
  }
  for (let i = 0; i < (ilv('helper') >= 3 ? 2 : ilv('helper') ? 1 : 0); i++) L.helpers.push({ x: NEST.x - 30 + i * 60, y: NEST.y + 120, cd: rand(0, 0.5), aim: 0, side: i ? 1 : -1 });
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
function toast(text) { if (L) L.toast = { text, t: 2 }; }

// 点道具栏上的按钮：换枪、冲击波、猫薄荷；其他道具是每关自动生效的
function pressItem(id) {
  if (id === 'weapon') {
    if (ownedList().length < 2) return toast('只有一把武器，去商店买新的或合成');
    return cycleWeapon(1);
  }
  if (id === 'missile') return fireMissiles();
  if (!isItemUnlocked(id)) return toast('击败头目后解锁该道具');
  const it = itemDef(id), st = G.items[id];
  if (!owned(id)) return toast(`还没有${it.name}，去商店购买（${it.cost} 🐟）`);
  if (id === 'shockwave') {
    if (L.shockwaveCd > 0) return toast(`${it.name}冷却中，还要 ${Math.ceil(L.shockwaveCd)} 秒`);
    return useShockwave();
  }
  if (id === 'catnip') {
    if (L.catnipT > 0) return;
    if (L.catnipCd > 0) return toast(`${it.name}冷却中，还要 ${Math.ceil(L.catnipCd)} 秒`);
    return useCatnip();
  }
  toast(`${it.name} ${st.lv} 级${it.multi ? ` · ${st.n} ${it.unit}` : ''}，每关自动生效`);
}

function useCatnip() {
  if (!isItemUnlocked('catnip')) return;
  const st = G.items.catnip;
  if (!owned('catnip') || L.catnipT > 0 || L.catnipCd > 0) return;
  L.catnipT = 5 + 2 * st.lv; L.catnipCd = itemDef('catnip').cool(st.lv);   // 冷却在效果结束后才开始倒数
  addText(L.cat.x, L.cat.y - 34, '猫薄荷！', '#9cff6b', 18);
  announce('猫薄荷');
  sfx.catnip();
}

// 新道具：冲击波（价格 300 一个，使用后全屏敌人被震，后退五格 = 500 像素）
function useShockwave() {
  if (!isItemUnlocked('shockwave')) return;
  const st = G.items.shockwave;
  if (!owned('shockwave') || L.shockwaveCd > 0) return;
  L.shockwaveCd = itemDef('shockwave').cool(st.lv);
  const c = L.cat;
  L.shake = 0.65;
  sfx.shockwave();
  // 全屏多层冲击波气浪环
  ring(c.x, c.y, 960, '#4fc3ff', 0.65, true);
  ring(c.x, c.y, 680, '#ffe066', 0.5, false);
  ring(c.x, c.y, 420, '#ffffff', 0.35, false);
  burst(c.x, c.y, '#4fc3ff', 28, 340);
  burst(c.x, c.y, '#ffe066', 18, 260);
  addText(c.x, c.y - 44, '💥 冲击波！全屏震退五格！', '#4fc3ff', 21, 1.5);
  announce('冲击波');
  // 震碎场上所有敌方子弹
  L.ebullets = [];
  const stunDur = 1.2 + 0.4 * (st.lv - 1);
  const shockDmg = (35 + 8 * G.level) * itemPow('shockwave');
  for (const e of L.enemies) {
    if (e.dead) continue;
    // 计算从猫咪指向敌人的击退方向，若重合则背离猫窝
    let dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy);
    if (d < 1) { dx = e.x - NEST.x; dy = e.y - NEST.y; d = Math.hypot(dx, dy) || 1; }
    const a = Math.atan2(dy, dx);
    // 后退五格（5 * 100 = 500 像素），通过平滑高速击退位移实现
    e.shockDist = SHOCKWAVE_PUSH;
    e.shockAngle = a;
    e.stunT = Math.max(e.stunT || 0, stunDur);
    e.flash = 0.35;
    if (e.mode === 'wind' || e.mode === 'charge') { e.mode = 'rest'; e.mt = 1.0; }
    if (e.type === 'boss' && (e.st === 'wind' || e.st === 'act')) bossState(e, 'rest', 0.8);
    burst(e.x, e.y, '#9be7ff', 6, 150);
    addText(e.x, e.y - e.r - 16, '震退!', '#8fd0ff', 14, 0.9);
    damageEnemy(e, shockDmg);
  }
}

// 导弹防御：猫窝 3 级起解锁，每升 3 级每关多一次（3 级 1 次、6 级 2 次、9 级 3 次……）；
// 考试复活再送一次。从猫窝向四面八方发射导弹，碰到第一个敌人就爆炸（范围伤害）
function missileBase() { return G ? Math.floor(G.stats.nestHp / 3) : 0; }
function fireMissiles() {
  if (!G || !L) return;
  if (L.missileLeft <= 0) return toast(G.stats.nestHp < 3 ? '猫窝升到 3 级后解锁导弹防御' : '本关导弹防御已经用完了');
  L.missileLeft--;
  const lv = Math.max(3, G.stats.nestHp), n = Math.min(36, 16 + 2 * (lv - 3)), dmg = (60 + 12 * G.level) * (1 + 0.15 * (lv - 3));
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n + rand(-0.04, 0.04), sp = rand(360, 420);
    L.bullets.push({ x: NEST.x + Math.cos(a) * 46, y: NEST.y - 20 + Math.sin(a) * 36, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      dmg, life: 3, r: 7, pierce: 0, explode: 90, splash: 0, tier: 0, color: '#ff6b3c', kind: 'missile', hit: new Set(), noEndBoom: true });
  }
  ring(NEST.x, NEST.y, 140, '#ff9a3c', 0.5, true); burst(NEST.x, NEST.y - 20, '#ffd84a', 20, 220);
  L.shake = Math.max(L.shake, 0.3); sfx.missile();
  addText(NEST.x, NEST.y - 80, '🚀 导弹防御！', '#ffb347', 20, 1.5);
  announce('导弹防御');
}

// 答对头目中文题后触发：慢镜头特写，全身变大变红，周身金光上升，维持 5 秒钟
function triggerRedRage() {
  if (!L) return;
  const c = L.cat;
  L.redRageT = 5.0; // 严格维持 5 秒真实时间
  L.morphT = 0.45;
  L.shake = 0.45;
  c.inv = Math.max(c.inv, 5.0);
  ring(c.x, c.y, 160, '#ffd84a', 0.65, true);
  ring(c.x, c.y, 95, '#ffe066', 0.45);
  burst(c.x, c.y, '#ff2424', 32, 280);
  burst(c.x, c.y, '#ffb347', 18, 200);
  addText(c.x, c.y - 52, '✨ 答对觉醒！金光巨化 5 秒！', '#ffe066', 20, 2.2);
  sfx.redPowerup();
  announce('答对了，金光觉醒');
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
// 敌人血量随关卡增长得比较慢：武器品级倍率已经调低（S 级 ×11），血量也同比例缩小，难度和以前差不多，但数字不再夸张
const hpScale = lv => Math.min(1 + 0.055 * (lv - 1), 1.6 + 0.015 * Math.max(0, lv - 12));
const dmgScale = lv => (1 + 0.08 * (lv - 1)) * (1 + 0.025 * Math.max(0, lv - 8));
const speedScale = lv => Math.min(1.7, 1 + 0.03 * (lv - 1));
const ENEMY_CAP = 110;
function rollTier(lv) {
  const p1 = clamp((lv - 4) * 0.035, 0, 0.3), p2 = clamp((lv - 9) * 0.025, 0, 0.22), p3 = clamp((lv - 14) * 0.018, 0, 0.15);
  const r = Math.random();
  const t = r < p3 ? 3 : r < p3 + p2 ? 2 : r < p3 + p2 + p1 ? 1 : 0;
  return L && L.boss ? Math.min(t, 1) : t;
}
const huntChance = (lv, tier) => lv >= 8 ? clamp(0.02 * (lv - 7) + 0.08 * tier, 0, 0.4) : 0;
const edgePos = (side, along) => side === 0 ? { x: along, y: -20 } : side === 1 ? { x: along, y: WORLD.h + 20 } : side === 2 ? { x: -20, y: along } : { x: WORLD.w + 20, y: along };

function spawnEnemy(type, pos, tierArg) {
  const d = ENEMIES[type];
  const lv = G.level;
  let x, y;
  if (pos) { x = pos.x; y = pos.y; } else {
    const side = randInt(0, 3), p = edgePos(side, side < 2 ? rand(0, WORLD.w) : rand(0, WORLD.h));
    x = p.x; y = p.y;
  }
  const special = type === 'boss' || type === 'elite';
  const tier = special ? 0 : tierArg !== undefined ? tierArg : rollTier(lv), T = ETIERS[tier];
  let hp = d.hp * hpScale(lv) * T.hp;
  const kind = type === 'boss' ? bossFor(lv) : null;
  // 头目血量翻倍（BOSS_HP_MULT = 3.0，为原版 1.5 的两倍）
  if (kind) hp = d.hp * kind.hp * (1 + 0.22 * (lv / BOSS_EVERY - 1)) * BOSS_HP_MULT;
  const e = {
    type, tier, x, y, r: d.r * T.size, hp, maxHp: hp, spd: d.spd * speedScale(lv) * T.spd * rand(0.92, 1.08),
    dmg: d.dmg * (special ? 1 + 0.08 * (lv - 1) : dmgScale(lv)) * T.dmg, cd: rand(0.3, 1), cd2: 0, flash: 0, face: 1, t: rand(0, 10), seed: rand(0, 6.28), summon: 4, dead: false,
    stunT: 0, shockDist: 0, shockAngle: 0,
    hunter: d.target === 'cat' || (d.target === 'nest' && !special && Math.random() < huntChance(lv, tier)),
  };
  if (kind) Object.assign(e, { kind, r: kind.r, spd: kind.spd, st: 'walk', stT: 0, stDur: 1, spCd: 3, atkAnim: 0, z: 0, dir: 0, walking: true, meteors: [], sub: '', atk: 0, tick: 0 });
  L.enemies.push(e);
  if (!special) announceEnemy(type, tier);
  return e;
}
function announceEnemy(type, tier) {
  if (L.notice) return;
  const d = ENEMIES[type];
  if (!G.seen[type] && d.tip) {
    G.seen[type] = 1;
    L.notice = { text: `新敌人：${d.name}${store.pinyin && d.py ? ' (' + d.py + ') ' : ''} ${d.tip}`, t: 4.2, color: '#ffe066' };
  } else if (tier > 0 && !G.seen.tiers) {
    G.seen.tiers = 1;
    L.notice = { text: '个头越大、颜色越深越强：蓝·强化 → 紫·精英 → 红·狂暴', t: 4.2, color: '#ffe066' };
  }
}

// ---------- 头目行为 ----------
const BOSS_ANIMALS = BOSSES.filter(b => b.id !== 'dragon');
const BOSS_HP_MULT = 3.0; // 头目血量翻倍（原为 1.5，现翻倍为 3.0）
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
  if (L.buffT.giant > 0 || L.redRageT > 0) return;
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
    else if (e.cd <= 0) { e.cd = 1.3; e.atkAnim = 0.4; hurtNest(e.dmg); }
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
    e.spCd = k.cd * (e.hp < e.maxHp / 2 ? 0.7 : 1);
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
  return Math.abs(da) < BREATH_HALF + Math.atan2(pad, Math.max(d, 1));
}
function updateDragon(e, dt, c) {
  const k = e.kind;
  e.z = 22 + Math.sin(e.t * 3) * 6;
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
    else { const a = Math.atan2(e.y - NEST.y, e.x - NEST.x) + dt * 0.22; e.x = NEST.x + Math.cos(a) * dd; e.y = NEST.y + Math.sin(a) * dd; }
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
      if (e.stT > 0.3) { e.dir = Math.atan2(c.y - o.y, c.x - o.x); e.face = Math.cos(e.dir) < 0 ? -1 : 1; }
    }
    if (e.stT <= 0) {
      if (e.sub === 'breath') { e.dir0 = e.dir; e.fire = e.dir; e.tick = 0; sfx.fireBreath(); bossState(e, 'act', 1.5); }
      else bossState(e, 'act', Math.max(0.3, 0.6 + (e.meteors.length - 1) * 0.28));
    }
  } else if (e.st === 'act') {
    if (e.sub === 'breath') {
      const p = clamp(1 - e.stT / e.stDur, 0, 1), o = dragonMouth(e);
      e.fire = e.dir0 + (p - 0.5) * 0.9;
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

function updateCharger(e, dt, c) {
  const dCat = dist(e, c);
  e.mode = e.mode || 'run';
  if (e.mode === 'run') {
    const dx = c.x - e.x, dy = c.y - e.y, dd = Math.hypot(dx, dy) || 1;
    let spd = e.spd * (e.rage > 0 ? 1.4 : 1);
    if (ilv('fence') && dist(e, NEST) < FENCE_R) spd *= 1 - fenceSlow();
    if (dd > c.r + e.r - 8) { e.x += dx / dd * spd * dt; e.y += dy / dd * spd * dt; }
    if (Math.abs(dx) > 2) e.face = dx < 0 ? -1 : 1;
    if (e.cd2 <= 0 && dCat < c.r + e.r - 4) { e.cd2 = 0.8; hurtCat(e.dmg); }
    if (e.cd <= 0 && dCat < 380 && dCat > 90) { e.mode = 'wind'; e.mt = 0.7; e.dir = Math.atan2(dy, dx); sfx.boarWind(); }
  } else if (e.mode === 'wind') {
    e.mt -= dt;
    if (e.mt > 0.25) e.dir = Math.atan2(c.y - e.y, c.x - e.x);
    e.face = Math.cos(e.dir) < 0 ? -1 : 1;
    if (e.mt <= 0) { e.mode = 'charge'; e.mt = 0.9; e.hit = false; sfx.dash(); }
  } else if (e.mode === 'charge') {
    e.mt -= dt;
    const v = 430 * Math.min(1.3, 1 + 0.01 * G.level);
    e.x += Math.cos(e.dir) * v * dt; e.y += Math.sin(e.dir) * v * dt;
    if (Math.random() < 0.7) L.parts.push({ x: e.x - Math.cos(e.dir) * e.r, y: e.y + e.r * 0.7, vx: rand(-40, 40), vy: rand(-40, 0), life: 0.4, color: '#e3cf9a', r: rand(3, 6) });
    if (!e.hit && dCat < c.r + e.r) { e.hit = true; hurtCat(e.dmg * 1.2); knockCat(e, 380); }
    if (dist(e, NEST) < NEST.r + e.r) { hurtNest(e.dmg * 1.2); e.mt = 0; L.shake = Math.max(L.shake, 0.2); }
    if (e.x < 20 || e.x > WORLD.w - 20 || e.y < 20 || e.y > WORLD.h - 20) { e.x = clamp(e.x, 20, WORLD.w - 20); e.y = clamp(e.y, 20, WORLD.h - 20); e.mt = 0; }
    if (e.mt <= 0) { e.mode = 'rest'; e.mt = 0.8; }
  } else {
    e.mt -= dt;
    if (e.mt <= 0) { e.mode = 'run'; e.cd = rand(2, 3.4); }
  }
}
function healTick(e, dt) {
  e.hc = (e.hc === undefined ? 1 : e.hc) - dt;
  if (e.hc > 0) return;
  e.hc = 1.6;
  let n = 0;
  for (const o of L.enemies) {
    if (o === e || o.dead || o.type === 'boss' || o.hp >= o.maxHp || dist(o, e) > 150) continue;
    o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08); n++;
    addText(o.x, o.y - o.r - 8, '+', '#7ed957', 15, 0.7);
  }
  if (n) { ring(e.x, e.y, 150, '#7ed957', 0.5, true); sfx.heal(); }
}
function bomberBlast(e, c) {
  const R = 80 + 8 * e.tier;
  ring(e.x, e.y, R, '#ff6b3c', 0.45, true); ring(e.x, e.y, R * 0.55, '#fff7b0', 0.3);
  burst(e.x, e.y, '#ff9a3c', 16, 240); burst(e.x, e.y, '#4a3423', 6, 160);
  L.shake = Math.max(L.shake, 0.25); sfx.bomberBlast();
  if (dist(c, e) < R + c.r) { hurtCat(e.dmg * 1.4); knockCat(e, 360); }
  if (dist(NEST, e) < R + NEST.r) hurtNest(e.dmg * 1.4);
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
    addText(e.x, e.y - e.r - 34, '吼——！', '#fff', 22, 1.2);
    bossState(e, 'rest', 0.5);
  } else if (sp === 'charge') { sfx.dash(); bossState(e, 'act', 1.1); }
}

function pickType(lv) {
  const pool = Object.keys(ENEMIES).filter(k => ENEMIES[k].w && ENEMIES[k].from <= lv);
  const wt = k => ENEMIES[k].w * (ENEMIES[k].weak ? Math.max(0.2, 1 - 0.06 * Math.max(0, lv - 6)) : 1);
  let total = 0; for (const k of pool) total += wt(k);
  let r = Math.random() * total;
  for (const k of pool) { r -= wt(k); if (r <= 0) return k; }
  return pool[0];
}
function spawnWave() {
  if (L.enemies.length >= ENEMY_CAP) return;
  const type = pickType(G.level), n = ENEMIES[type].group || 1, tier = rollTier(G.level);
  const first = spawnEnemy(type, undefined, tier);
  for (let i = 1; i < n; i++) spawnEnemy(type, { x: first.x + rand(-30, 30), y: first.y + rand(-30, 30) }, tier);
}
// 每关怪物数量系数（整体减少 30%）
const ENEMY_COUNT_MUL = 0.7;
function hordeBurst() {
  const lv = G.level, side = randInt(0, 3), n = Math.min(Math.floor((6 + lv * 0.7) * (L.boss ? 0.6 : 1) * ENEMY_COUNT_MUL), Math.max(0, ENEMY_CAP - L.enemies.length));
  const mid = side < 2 ? rand(300, WORLD.w - 300) : rand(250, WORLD.h - 250);
  for (let i = 0; i < n; i++) {
    const p = edgePos(side, mid + rand(-170, 170)), out = rand(0, 90);
    spawnEnemy(pickType(lv), { x: p.x + (side === 2 ? -out : side === 3 ? out : 0), y: p.y + (side === 0 ? -out : side === 1 ? out : 0) });
  }
  L.notice = { text: `敌人潮来了！从${['上方', '下方', '左边', '右边'][side]}涌来`, t: 3, color: '#ff9a8a' };
  sfx.horde();
}
// 连击系统：短时间内连续击败敌人可提升连击倍率，获得更高积分
const COMBO_WINDOW = 3.2;
const COMBO_TIERS = [
  { min: 30, mult: 3.0, label: '猫咪传说', color: '#ff5e9a', bg: '#4e1535', bar: '#ffe066' },
  { min: 20, mult: 2.5, label: '超级无敌', color: '#c48bff', bg: '#321b54', bar: '#d6a8ff' },
  { min: 10, mult: 2.0, label: '势不可挡', color: '#ff6b5e', bg: '#5a1c15', bar: '#ffb347' },
  { min: 5,  mult: 1.5, label: '火力全开', color: '#ffb347', bg: '#543210', bar: '#ffe066' },
  { min: 2,  mult: 1.2, label: '连击开始', color: '#7ed957', bg: '#204518', bar: '#a7f37a' },
  { min: 1,  mult: 1.0, label: '连击',     color: '#fff6df', bg: '#6b4a2e', bar: '#ffe066' },
];
function comboTier(combo) {
  for (const t of COMBO_TIERS) if (combo >= t.min) return t;
  return COMBO_TIERS[COMBO_TIERS.length - 1];
}
function enemyBasePoints(e) {
  const d = ENEMIES[e.type];
  const T = ETIERS[e.tier || 0];
  let base = e.type === 'boss' ? 400 : e.type === 'elite' ? 120 : Math.max(10, Math.round((d.fish[0] + d.fish[1]) * 5));
  base = Math.round(base * (e.type === 'boss' || e.type === 'elite' ? 1 : T.fish));
  if (e.small) base = Math.max(5, Math.round(base * 0.4));
  return base;
}

function triggerComboFx(x, y, combo, ct, tierUp) {
  if (combo < 5) return;
  const milestone = tierUp || combo % 5 === 0;
  if (L.parts.length < 360) {
    const scalePow = clamp(0.9 + combo * 0.04, 1, 2.1);
    const sparkCount = milestone ? Math.min(26, 12 + Math.floor(combo * 0.5)) : Math.min(10, 4 + Math.floor(combo / 5));
    const starCount = milestone ? Math.min(14, 6 + Math.floor(combo * 0.25)) : Math.min(5, 2 + Math.floor(combo / 8));
    ring(x, y, (milestone ? 58 : 34) + Math.min(56, combo * 1.6), ct.color, milestone ? 0.42 : 0.26, milestone);
    if (milestone) ring(x, y, 36 + Math.min(34, combo), '#fff7b0', 0.28);
    L.parts.push({ x, y, vx: 0, vy: 0, life: milestone ? 0.28 : 0.18, max: milestone ? 0.28 : 0.18, k: 'flash', color: '#fff7b0', r: (milestone ? 22 : 13) + Math.min(16, combo * 0.45) });
    for (let i = 0; i < sparkCount; i++) {
      const a = (TAU * i) / sparkCount + rand(-0.22, 0.22);
      const spd = rand(180, milestone ? 390 : 250) * (0.85 + 0.15 * scalePow);
      L.parts.push({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: rand(0.22, milestone ? 0.44 : 0.28),
        color: i % 3 === 0 ? '#fff7b0' : ct.color,
        r: rand(2.2, milestone ? 4.2 : 3.0),
        k: 'spark',
      });
    }
    const palette = combo >= 20 ? [ct.color, '#ffe066', '#8cf0ff', '#fff'] : [ct.color, '#ffe066', '#fff7b0'];
    for (let i = 0; i < starCount; i++) {
      const a = rand(0, TAU), spd = rand(95, milestone ? 270 : 165);
      const life = rand(0.32, milestone ? 0.62 : 0.4);
      L.parts.push({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life, max: life, k: 'cstar',
        color: palette[i % palette.length],
        r: rand(4.5, milestone ? 9.5 : 6.5),
        spin: rand(-7, 7),
      });
    }
    if (milestone) {
      if (tierUp) {
        ring(L.cat.x, L.cat.y, 82, ct.color, 0.45);
        L.parts.push({ x: L.cat.x, y: L.cat.y, vx: 0, vy: 0, life: 0.24, max: 0.24, k: 'flash', color: ct.color, r: 24 });
      }
      L.shake = Math.max(L.shake, combo >= 20 ? 0.2 : combo >= 10 ? 0.14 : 0.09);
    }
  }
  if (milestone) {
    L.comboSplash = { combo, label: ct.label, mult: ct.mult, color: ct.color, t: 0.9, dur: 0.9 };
  }
}

function damageEnemy(e, dmg) {
  if (e.dead) return;
  if (e.hpTrail === undefined) e.hpTrail = e.hp;
  e.hp -= dmg; e.flash = 0.12;
  addText(e.x + rand(-6, 6), e.y - e.r - 4, String(Math.round(dmg)), '#fff7b0', 13);
  if (e.hp <= 0) {
    e.dead = true; G.kills++;
    L.combo++;
    L.comboT = COMBO_WINDOW;
    L.comboPop = 1;
    L.comboBreakT = 0;
    L.comboBreak = null;
    const ct = comboTier(L.combo);
    const pts = Math.round(enemyBasePoints(e) * ct.mult);
    G.score += pts;
    L.levelScore += pts;
    L.lastComboPts = pts;
    if (L.combo > G.maxCombo) G.maxCombo = L.combo;
    if (L.combo > L.levelMaxCombo) L.levelMaxCombo = L.combo;
    const tierUp = ct.min > L.comboTierMin;
    if (tierUp) {
      L.comboTierMin = ct.min;
      SFX.playCombo(L.combo, ct.min, true);
      if (L.combo < 5) {
        ring(L.cat.x, L.cat.y, 52, ct.color, 0.32);
      } else {
        addText(L.cat.x, L.cat.y - 46, `${L.combo} 连击！×${ct.mult.toFixed(1)} 积分`, ct.color, 17, 1.3);
      }
    } else if (L.combo >= 2) {
      SFX.playCombo(L.combo, ct.min, false);
    }
    if (L.combo >= 5) {
      triggerComboFx(e.x, e.y, L.combo, ct, tierUp);
    }
    if (L.combo >= 20) {
      L.shake = Math.max(L.shake, L.combo >= 30 ? 0.16 : 0.11);
    }
    if (L.combo >= 2 || e.type === 'boss' || e.type === 'elite') {
      addText(e.x + rand(-10, 10), e.y - e.r - 20, `+${pts}分`, ct.color, L.combo >= 10 ? 15 : 13, 0.95);
    }
    const d = ENEMIES[e.type];
    burst(e.x, e.y, '#fff', e.type === 'boss' ? 30 : 8, e.type === 'boss' ? 260 : 130);
    const T = ETIERS[e.tier || 0];
    let n = Math.round(randInt(d.fish[0], d.fish[1]) * T.fish);
    if (e.small) n = Math.max(1, Math.round(n * 0.3));
    if (e.type === 'boss') {
      for (let i = 0; i < 10; i++) L.fish.push({ x: e.x + rand(-40, 40), y: e.y + rand(-40, 40), v: Math.ceil(n / 10) });
      dropBuff(e.x - 30, e.y); dropBuff(e.x + 30, e.y);
      if (e.kind.id === 'dragon') dropBuff(e.x, e.y - 30);
      L.boss = null; L.shake = 0.5; sfx.boom();
      // 每打败一个头目解锁一个新道具，并记录待播放解锁动画
      if (G.unlockedItems < ITEMS.length) {
        const unlocked = ITEMS[G.unlockedItems];
        G.unlockedItems++;
        G.pendingUnlock = unlocked.id;
        addText(e.x, e.y - 54, `🎉 解锁新道具：${unlocked.name}！`, '#ffe066', 20, 2.2);
        sfx.unlock();
      }
    } else if (e.type === 'elite') {
      for (let i = 0; i < 4; i++) L.fish.push({ x: e.x + rand(-25, 25), y: e.y + rand(-25, 25), v: Math.ceil(n / 4) });
      dropBuff(e.x, e.y);
      L.shake = 0.3; sfx.boom();
    } else {
      L.fish.push({ x: e.x, y: e.y, v: n });
      if (Math.random() < BUFF_DROP_CHANCE + [0, 0.03, 0.14, 0.5][e.tier || 0]) dropBuff(e.x, e.y);
      if (d.splits && !e.small) splitSlime(e);
      if (e.tier >= 2) { burst(e.x, e.y, T.tint, 12, 200); L.shake = Math.max(L.shake, 0.12); }
      if (!tierUp) sfx.kill();
    }
  }
}
function splitSlime(e) {
  for (let i = 0; i < 2; i++) {
    const s = spawnEnemy('slime', { x: e.x + rand(-16, 16), y: e.y + rand(-16, 16) }, e.tier);
    s.small = true; s.r = e.r * 0.62; s.hp = s.maxHp = e.maxHp * 0.4; s.spd *= 1.25; s.hunter = e.hunter; s.dmg = e.dmg * 0.7;
  }
  burst(e.x, e.y, '#4fd6a8', 10, 150); sfx.slimeSplit();
}

// ---------- 增益掉落 ----------
function dropBuff(x, y) {
  if (L.drops.length >= 6) return;
  const low = L.cat.hp < catMaxHp() / 3 && !L.drops.some(d => d.buff.id === 'heal');
  const b = low ? BUFFS.find(x => x.id === 'heal') : BUFFS[randInt(0, BUFFS.length - 1)];
  L.drops.push({ x: clamp(x, 30, WORLD.w - 30), y: clamp(y, 30, WORLD.h - 30), buff: b, life: 12, t: rand(0, 6) });
}
function applyBuff(b) {
  const c = L.cat;
  if (b.dur) {
    L.buffT[b.id] = b.dur;
    if (b.id === 'nestShield') { ring(NEST.x, NEST.y, 150, b.color, 0.6, true); ring(NEST.x, NEST.y, 100, '#fff', 0.4); }
    else { L.morphT = 0.4; L.shake = Math.max(L.shake, 0.25); ring(c.x, c.y, 120, b.color, 0.45); ring(c.x, c.y, 70, '#fff', 0.3); }
  }
  if (b.id === 'heal') c.hp = Math.min(catMaxHp(), c.hp + 35);
  if (b.id === 'magnet') for (const f of L.fish) f.fly = true;
  if (b.id === 'freeze') for (const e of L.enemies) burst(e.x, e.y, '#c8f4ff', 3, 60);
  addText(c.x, c.y - 44, `${b.name}${store.pinyin ? ' ' + b.py : ''}`, b.color, 18, 1.6);
  addText(c.x, c.y - 24, b.tip + '!', '#fff', 14, 1.6);
  burst(c.x, c.y, b.color, 22, 240);
  sfx.transform();
  announce(`${b.name}，${b.tip}`);
}

function hurtCat(dmg) {
  const c = L.cat;
  if (c.inv > 0 || L.buffT.shield > 0 || L.buffT.giant > 0 || L.redRageT > 0) return;
  dmg = Math.min(dmg, catMaxHp() * 0.25);
  c.hp -= dmg; L.catLost += dmg; c.inv = 0.45; L.shake = Math.max(L.shake, 0.2);
  addText(c.x, c.y - 30, '-' + Math.round(dmg), '#ff6b5e', 16);
  sfx.hurt();
}
function hurtNest(dmg) {
  if (L.buffT.nestShield > 0) {   // 猫窝护盾挡住伤害
    if (Math.random() < 0.25) addText(NEST.x + rand(-30, 30), NEST.y - 60, '挡住了', '#8fd0ff', 13, 0.7);
    return;
  }
  sfx.nestHit();
  G.nestHp -= dmg; L.nestLost += dmg; L.nestFlash = 0.15;
  addText(NEST.x + rand(-20, 20), NEST.y - 50, '-' + Math.round(dmg), '#ff6b5e', 15);
}

// ---------- 射击 ----------
function fireWeapon(c) {
  const eq = G.eq, w = weaponDef(eq.id), s = weaponStats(eq.id, eq.tier);
  const fast = (L.catnipT > 0 ? 0.65 : 1) * (L.buffT.rapid > 0 ? 0.6 : 1) * (L.redRageT > 0 ? 0.55 : 1);
  c.cd = s.interval * fast;
  const dmg = s.dmg * (1 + L.atkBuff) * (L.buffT.power > 0 ? 2 : 1) * (L.redRageT > 0 ? 1.5 : 1);
  for (let i = 0; i < s.count; i++) {
    let a = c.aim + rand(-s.jitter, s.jitter);
    if (s.count > 1) a += (i / (s.count - 1) - 0.5) * s.spread;
    L.bullets.push({
      x: c.x + Math.cos(c.aim) * 24, y: c.y + Math.sin(c.aim) * 24,
      vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
      dmg, life: s.life, r: s.r * (L.buffT.power > 0 || L.redRageT > 0 ? 1.5 : 1), pierce: s.pierce, explode: s.explode, splash: s.splash,
      tier: eq.tier, color: L.redRageT > 0 ? '#ff3b2f' : s.color, kind: w.id, hit: new Set(),
    });
  }
  const big = (eq.id === 'shotgun' || eq.id === 'grenade') ? 6 : 0;
  L.parts.push({ x: c.x + Math.cos(c.aim) * 32, y: c.y + Math.sin(c.aim) * 32, vx: 0, vy: 0, life: 0.07, max: 0.07, k: 'flash', color: L.redRageT > 0 ? '#ff4040' : eq.tier ? tierColor(eq.tier) : '#ffe9a0', r: 8 + eq.tier * 1.5 + big });
  sfx['shoot_' + w.id]();
}

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
  if (t >= 1) burst(x, y, tc, 2 + t, 140);
}
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
// 猫咪当前的变身形态：redRage（答对中文题后的5秒金光巨化）优先级最高
const FORMS = {
  redRage: { s: 2.25, fur: '#ff2b2b', dark: '#a80000' },
  giant:   { s: 2.3,  fur: '#ffcf5a', dark: '#e09a2a' },
  power:   { s: 1.45, fur: '#ff7a5c', dark: '#c8402d' },
  rapid:   { s: 1.2,  fur: '#ffe066', dark: '#e0a800' },
  shield:  { s: 1.2,  fur: '#8fc4ff', dark: '#4f8fdc' },
  freeze:  { s: 1.15, fur: '#c8f4ff', dark: '#7fd3e8' },
};
const currentForm = () => {
  if (L.redRageT > 0) return 'redRage';
  for (const id in FORMS) if (id !== 'redRage' && L.buffT[id] > 0) return id;
  return null;
};
function updateForm(dt, rawDt) {
  const c = L.cat, form = currentForm();
  if (L.form && !form) { burst(c.x, c.y, '#fff', 14, 160); sfx.revert(); }
  L.form = form;
  L.morphT = Math.max(0, L.morphT - rawDt);
  c.s += ((form ? FORMS[form].s : 1) - c.s) * Math.min(1, rawDt * 10);
  // 残影
  L.trailT -= rawDt;
  if (form && form !== 'shield' && form !== 'freeze' && (c.moving || form === 'redRage') && L.trailT <= 0) {
    L.trailT = 0.055;
    L.trail.push({ x: c.x, y: c.y, s: c.s, color: FORMS[form].fur, life: 0.32 });
  }
  for (const t of L.trail) t.life -= rawDt;
  L.trail = L.trail.filter(t => t.life > 0);
  // 答对中文题后的 5 秒周身金光上升特效
  if (form === 'redRage') {
    for (let i = 0; i < 3; i++) {
      L.parts.push({
        x: c.x + rand(-36, 36), y: c.y + rand(-10, 26),
        vx: rand(-18, 18), vy: rand(-210, -110),
        life: rand(0.35, 0.7), max: 0.7, k: 'redbeam',
        color: ['#ffd84a', '#ffe98a', '#ffb300'][randInt(0, 2)], r: rand(4, 8),
      });
    }
  }
  if (form === 'power' && Math.random() < 0.5) L.parts.push({ x: c.x + rand(-16, 16), y: c.y + rand(-10, 14), vx: rand(-15, 15), vy: rand(-110, -50), life: rand(0.3, 0.55), color: Math.random() < 0.5 ? '#ff6b5e' : '#ffb347', r: rand(3, 5.5) });
  if (form === 'rapid' && Math.random() < 0.3) L.parts.push({ x: c.x + rand(-20, 20), y: c.y + rand(-24, 14), vx: rand(-60, 60), vy: rand(-60, 60), life: 0.2, color: '#fff7b0', r: rand(2, 3.5) });
  // 巨猫或金光巨化踩扁靠近的敌人
  if (form === 'giant' || form === 'redRage') {
    L.stompT -= rawDt;
    if (L.stompT <= 0) {
      L.stompT = 0.22;
      let hit = false;
      for (const e of L.enemies) if (dist(e, c) < 58 + e.r) { damageEnemy(e, 28 + 6 * G.level); hit = true; }
      if (hit) { L.shake = Math.max(L.shake, 0.12); sfx.stompCat(); }
    }
  }
}

const SHURIKEN_R = 128;
function updateGadgets(dt) {
  const c = L.cat, lv = G.level;
  if (ilv('shuriken')) {
    const nSh = ilv('shuriken');
    L.shAngle += dt * 3.2 * (1 + 0.12 * (G.items.shuriken.lv - 1));
    for (const e of L.enemies) e.shCd = (e.shCd || 0) - dt;
    for (let i = 0; i < nSh; i++) {
      const a = L.shAngle + i * TAU / nSh, bx = NEST.x + Math.cos(a) * SHURIKEN_R, by = NEST.y + Math.sin(a) * SHURIKEN_R;
      for (const e of L.enemies) {
        if (e.dead || e.shCd > 0 || Math.hypot(e.x - bx, e.y - by) > e.r + 22) continue;
        e.shCd = 0.35; damageEnemy(e, (16 + 3 * lv) * itemPow('shuriken'));
        burst(bx, by, '#dfe8f2', 4, 140); sfx.shuriken();
      }
    }
  }
  if (ilv('lightning')) {
    L.stormCd -= dt;
    if (L.stormCd <= 0) {
      const near = L.enemies.filter(e => !e.dead && dist(e, NEST) < 440).sort((a, b) => dist(a, NEST) - dist(b, NEST)).slice(0, ilv('lightning') + 1);
      if (near.length) {
        L.stormCd = Math.max(1.2, 3.4 - 0.4 * ilv('lightning'));
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
    const tx = c.x + h.side * 34, ty = c.y + 30, d = Math.hypot(tx - h.x, ty - h.y);
    if (d > 6) { const v = Math.min(d * 5, 330) * dt / d; h.x += (tx - h.x) * v; h.y += (ty - h.y) * v; }
    h.cd -= dt;
    const e = nearestEnemy(h, 320);
    if (e) {
      h.aim = Math.atan2(e.y - h.y, e.x - h.x);
      if (h.cd <= 0) {
        h.cd = 0.55; sfx.helper();
        L.bullets.push({ x: h.x, y: h.y, vx: Math.cos(h.aim) * 540, vy: Math.sin(h.aim) * 540, dmg: (8 + 1.5 * lv) * itemPow('helper'), life: 0.7, r: 4, pierce: 0, explode: 0, color: '#ffb347', kind: 'turret', hit: new Set() });
      }
    }
  }
  for (const r of L.rings) r.life -= dt;
  for (const b of L.bolts) b.life -= dt;
  L.rings = L.rings.filter(r => r.life > 0);
  L.bolts = L.bolts.filter(b => b.life > 0);
}

function update(rawDt) {
  const c = L.cat;
  // 处理答对中文题后的 5 秒慢镜头特写与金光巨化计时（按真实秒数倒计时 5 秒）
  let timeScale = 1;
  if (L.redRageT > 0) {
    L.redRageT = Math.max(0, L.redRageT - rawDt);
    // 前 1.8 秒强慢镜头特写 (0.35x)，后段保持慢动作特写 (0.55x)
    timeScale = L.redRageT > 3.2 ? 0.35 : 0.55;
    const targetZoom = L.redRageT > 3.2 ? 1.55 : 1.28;
    camZoom += (targetZoom - camZoom) * Math.min(1, rawDt * 8);
  } else {
    camZoom += (1 - camZoom) * Math.min(1, rawDt * 8);
  }
  const dt = rawDt * timeScale;

  L.elapsed += dt;
  L.time = Math.max(0, L.time - dt);
  L.banner -= rawDt; L.shake = Math.max(0, L.shake - rawDt); L.nestFlash = Math.max(0, L.nestFlash - rawDt);
  if (L.comboT > 0) {
    L.comboT = Math.max(0, L.comboT - dt);
    const targetPct = L.comboT / COMBO_WINDOW;
    if (L.comboBarVis < targetPct) {
      L.comboBarVis = Math.min(targetPct, L.comboBarVis + rawDt * 14);
    } else {
      L.comboBarVis = targetPct;
    }
    if (L.comboT <= 0) {
      if (L.combo >= 2) {
        const lostTier = comboTier(L.combo);
        L.comboBreakT = 0.4;
        L.comboBreak = { combo: L.combo, mult: lostTier.mult, t: 0.72, dur: 0.72 };
      }
      L.combo = 0; L.comboTierMin = 1; L.comboBarVis = 0;
    }
  } else {
    L.comboBarVis = 0;
  }
  const targetFilter = L.combo >= 30 ? 1 : L.combo >= 20 ? 0.72 : 0;
  L.comboFilter += (targetFilter - L.comboFilter) * Math.min(1, rawDt * 4.5);
  if (L.comboBreakT > 0) L.comboBreakT = Math.max(0, L.comboBreakT - rawDt);
  if (L.comboBreak) {
    L.comboBreak.t -= rawDt;
    if (L.comboBreak.t <= 0) L.comboBreak = null;
  }
  if (L.comboPop > 0) L.comboPop = Math.max(0, L.comboPop - rawDt * 4.5);
  if (L.comboSplash) {
    L.comboSplash.t -= rawDt;
    if (L.comboSplash.t <= 0) L.comboSplash = null;
  }
  if (L.catnipT > 0) L.catnipT -= rawDt;
  else if (L.catnipCd > 0) L.catnipCd = Math.max(0, L.catnipCd - rawDt);
  if (L.shockwaveCd > 0) L.shockwaveCd = Math.max(0, L.shockwaveCd - rawDt);
  for (const k in L.buffT) if (L.buffT[k] > 0) L.buffT[k] -= rawDt;
  if (L.notice && L.notice !== L.saidNotice) { L.saidNotice = L.notice; announce(L.notice.text); }
  if (L.toast && L.toast !== L.saidToast) { L.saidToast = L.toast; announce(L.toast.text); }
  if (L.notice) { L.notice.t -= rawDt; if (L.notice.t <= 0) L.notice = null; }
  if (L.toast) { L.toast.t -= rawDt; if (L.toast.t <= 0) L.toast = null; }

  // 移动（在金光慢镜头期间猫咪依然保持敏捷手感）
  const catDt = L.redRageT > 0 ? rawDt * 0.85 : dt;
  let mx = 0, my = 0;
  if (keys.a || keys.arrowleft) mx -= 1;
  if (keys.d || keys.arrowright) mx += 1;
  if (keys.w || keys.arrowup) my -= 1;
  if (keys.s || keys.arrowdown) my += 1;
  if (joy.active) { mx = joy.dx; my = joy.dy; }
  const ml = Math.hypot(mx, my);
  c.moving = ml > 0.15;
  if (c.moving) {
    const sp = catSpeed() * (L.catnipT > 0 ? 1.4 : 1) * (L.buffT.giant > 0 || L.redRageT > 0 ? 1.2 : 1) * Math.min(1, ml);
    let nx = c.x + mx / ml * sp * catDt, ny = c.y + my / ml * sp * catDt;
    const dn = Math.hypot(nx - NEST.x, ny - NEST.y), minD = NEST.r + c.r - 6;
    if (dn < minD) { nx = NEST.x + (nx - NEST.x) / dn * minD; ny = NEST.y + (ny - NEST.y) / dn * minD; }
    c.x = clamp(nx, c.r, WORLD.w - c.r); c.y = clamp(ny, c.r, WORLD.h - c.r);
    c.walk += catDt * 12;
  }
  if (Math.abs(c.kx) + Math.abs(c.ky) > 5) {
    c.x = clamp(c.x + c.kx * dt, c.r, WORLD.w - c.r); c.y = clamp(c.y + c.ky * dt, c.r, WORLD.h - c.r);
    const k = Math.pow(0.002, dt); c.kx *= k; c.ky *= k;
  }
  c.inv -= rawDt; c.cd -= catDt;
  updateForm(dt, rawDt);

  // 瞄准与射击
  const effScale = scale * camZoom;
  let firing = false;
  if (touchMode) {
    const t = nearestEnemy(c, 430);
    if (t) { c.aim = Math.atan2(t.y - c.y, t.x - c.x); firing = true; }
  } else {
    c.aim = Math.atan2(cam.y + mouse.y / effScale - c.y, cam.x + mouse.x / effScale - c.x);
    firing = mouse.down;
  }
  if (firing && c.cd <= 0) fireWeapon(c);

  // 出怪
  if (L.time > 0) {
    L.spawnT -= dt;
    if (L.spawnT <= 0) {
      const per = 1 + Math.floor(Math.max(0, G.level - 19) / 8);
      for (let i = 0; i < per; i++) spawnWave();
      const base = Math.max(0.45, 1.7 * Math.pow(0.92, G.level - 1));
      L.spawnT = base * (1 - 0.3 * L.elapsed / LEVEL_TIME) * rand(0.8, 1.2) * (L.boss ? 1.8 : 1) / ENEMY_COUNT_MUL;
    }
  }
  // 头目在关卡的最后出现（倒计时剩余 3 秒内登场，且血量翻倍）
  if (L.isBoss && !L.bossSpawned && L.time <= 3) {
    L.bossSpawned = true;
    L.boss = spawnEnemy('boss');
    L.shake = 0.4; sfx.boss();
    L.notice = { text: `关底头目登场：${L.boss.kind.name}（${L.boss.kind.tip}）`, t: 3.8 };
    openQuiz(`${L.boss.kind.name}在关卡最后出现了！`);
    return;
  }
  if (L.boss && !L.bossHalfAsked && L.boss.hp < L.boss.maxHp / 2) {
    L.bossHalfAsked = true;
    sfx.roar();
    openQuiz(`${L.boss.kind.name}发怒了！`);
    return;
  }

  // 敌人潮
  while (L.hordeTimes.length && L.elapsed >= L.hordeTimes[0]) { L.hordeTimes.shift(); hordeBurst(); }

  // 小头目
  while (L.eliteTimes.length && L.elapsed >= L.eliteTimes[0]) {
    L.eliteTimes.shift();
    spawnEnemy('elite');
    L.notice = { text: '小头目来了！', t: 2.2 };
    sfx.boss();
  }

  // 敌人更新
  const frozen = L.buffT.freeze > 0;
  for (const e of L.enemies) {
    const d = ENEMIES[e.type];
    e.flash = Math.max(0, e.flash - rawDt);
    if (e.hpTrail === undefined) e.hpTrail = e.hp;
    else if (e.hpTrail > e.hp) e.hpTrail = Math.max(e.hp, e.hpTrail - Math.max(e.maxHp * 0.65, (e.hpTrail - e.hp) * 7) * rawDt);
    else e.hpTrail = e.hp;
    // 处理冲击波的后退五格（500 像素）平滑高速震退位移
    if (e.shockDist > 0) {
      const step = Math.min(e.shockDist, 1800 * rawDt);
      e.x = clamp(e.x + Math.cos(e.shockAngle) * step, 24, WORLD.w - 24);
      e.y = clamp(e.y + Math.sin(e.shockAngle) * step, 24, WORLD.h - 24);
      e.shockDist -= step;
      if (Math.random() < 0.6) L.parts.push({ x: e.x, y: e.y + e.r * 0.6, vx: rand(-30, 30), vy: rand(-20, 20), life: 0.25, color: '#9be7ff', r: rand(2.5, 5) });
    }
    if (e.stunT > 0) { e.stunT -= rawDt; continue; }
    if (frozen) continue;
    e.cd -= dt; e.cd2 -= dt; e.t += dt;
    if (e.rage > 0) e.rage -= dt;
    if (e.type === 'boss') { updateBoss(e, dt, c); continue; }
    if (d.charger) { updateCharger(e, dt, c); continue; }
    if (d.healer) healTick(e, dt);
    if (d.bomber) e.hunter = dist(e, c) < 340;
    const tgt = e.hunter ? c : NEST;
    let spd = e.spd * (e.rage > 0 ? 1.4 : 1);
    if (e.type === 'elite' && e.t % 4 > 3) {
      spd *= 2.6;
      if (Math.random() < 0.4) L.parts.push({ x: e.x, y: e.y + e.r * 0.7, vx: rand(-30, 30), vy: rand(-30, 0), life: 0.35, color: '#e3cf9a', r: rand(3, 5) });
    }
    if (ilv('fence') && dist(e, NEST) < FENCE_R) spd *= 1 - fenceSlow();
    const dx = tgt.x - e.x, dy = tgt.y - e.y, dd = Math.hypot(dx, dy) || 1;
    const stop = d.ranged ? 230 : (tgt === NEST ? NEST.r + e.r - 4 : c.r + e.r - 8);
    if (d.flyer) {
      const a = Math.atan2(dy, dx) + Math.sin(e.t * 4 + e.seed) * (dd > 120 ? 0.9 : 0.3);
      e.x += Math.cos(a) * spd * dt; e.y += Math.sin(a) * spd * dt;
      if (Math.abs(Math.cos(a)) > 0.1) e.face = Math.cos(a) < 0 ? -1 : 1;
    } else if (dd > stop) {
      e.x += dx / dd * spd * dt; e.y += dy / dd * spd * dt;
      if (Math.abs(dx) > 2) e.face = dx < 0 ? -1 : 1;
    } else if (tgt === NEST && e.cd <= 0) {
      e.cd = 1; hurtNest(e.dmg);
    }
    if (d.ranged && dd < 150) { e.x -= dx / dd * spd * 0.7 * dt; e.y -= dy / dd * spd * 0.7 * dt; }
    if (d.ranged && dd < 300 && e.cd <= 0) {
      e.cd = d.rcd || 2.2;
      const n = d.shots || 1, base = Math.atan2(dy, dx), pspd = d.pspd || 210;
      for (let i = 0; i < n; i++) {
        const a = base + (n > 1 ? (i - (n - 1) / 2) * 0.28 : 0);
        L.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * pspd, vy: Math.sin(a) * pspd, dmg: e.dmg * (d.pdmg || 0.7), life: 2.4, r: 6, col: d.pcol });
      }
      if (d.shots) sfx.spit();
    }
    if (d.bomber && dd < (tgt === NEST ? NEST.r : c.r) + e.r) { bomberBlast(e, c); e.dead = true; continue; }
    if (!d.ranged && e.cd2 <= 0 && dist(e, c) < c.r + e.r - 4) { e.cd2 = 0.8; hurtCat(e.dmg); }
  }
  updateGadgets(dt);

  // 子弹（玩家子弹在慢镜头下保持正常高速）
  for (const b of L.bullets) {
    b.x += b.vx * catDt; b.y += b.vy * catDt; b.life -= catDt;
    if (b.kind === 'missile' && Math.random() < 0.6) L.parts.push({ x: b.x - b.vx * 0.03, y: b.y - b.vy * 0.03, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.45, color: 'rgba(210,210,210,.75)', r: rand(3, 5) });
    for (const e of L.enemies) {
      if (e.dead || b.hit.has(e) || dist(e, b) > e.r + b.r) continue;
      if (b.explode) { explode(b); b.dead = true; break; }
      damageEnemy(e, b.dmg); b.hit.add(e);
      sfx['hit_' + b.kind]();
      impactFx(b);
      if (b.splash) splashHit(b, e);
      if (b.pierce-- <= 0) { b.dead = true; break; }
    }
    if (!b.dead && b.life <= 0) { if (b.explode && !b.noEndBoom) explode(b); b.dead = true; }
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
        t.cd = 0.7 * (1 - 0.08 * (G.items.turret.lv - 1)); sfx.turret();
        L.bullets.push({ x: t.x, y: t.y, vx: Math.cos(t.aim) * 520, vy: Math.sin(t.aim) * 520, dmg: (9 + G.level) * itemPow('turret'), life: 0.7, r: 4, pierce: 0, explode: 0, color: '#ffd84a', kind: 'turret', hit: new Set() });
      }
    }
  }

  // 小鱼干
  const magR = 60 + 55 * ilv('magnet');
  for (const f of L.fish) {
    const d = dist(f, c);
    if (f.fly || d < magR) { const s = (f.fly ? 800 : 420) * rawDt / (d || 1); f.x += (c.x - f.x) * Math.min(1, s); f.y += (c.y - f.y) * Math.min(1, s); }
    if (d < c.r + 8) { f.dead = true; G.fish += f.v; sfx.pickup(); }
  }
  // 增益掉落物
  for (const d of L.drops) {
    d.life -= rawDt; d.t += rawDt;
    if (dist(d, c) < c.r + 18) { d.life = 0; applyBuff(d.buff); }
  }
  L.drops = L.drops.filter(d => d.life > 0);

  for (const p of L.parts) {
    p.x += p.vx * rawDt; p.y += p.vy * rawDt; p.life -= rawDt;
    if (p.k === 'cstar') {
      const drag = Math.max(0, 1 - 2.6 * rawDt);
      p.vx *= drag; p.vy *= drag;
    }
  }
  for (const t of L.texts) { t.y -= 34 * rawDt; t.life -= rawDt; }

  L.enemies = L.enemies.filter(e => !e.dead);
  L.bullets = L.bullets.filter(b => !b.dead);
  L.ebullets = L.ebullets.filter(b => b.life > 0);
  L.fish = L.fish.filter(f => !f.dead);
  L.parts = L.parts.filter(p => p.life > 0);
  L.texts = L.texts.filter(t => t.life > 0);

  // 胜负判定：中途被打败时，若本关尚未使用复活考试，则触发 10 题中文复活考试
  if (G.nestHp <= 0 || c.hp <= 0) {
    const reason = G.nestHp <= 0 ? '猫窝被攻破了……' : '猫咪倒下了……';
    return openReviveExam(reason);   // 每次倒下都可以参加中文测验复活，不限次数
  }
  if (L.time <= 0 && (!L.isBoss || L.bossSpawned) && !L.boss) levelClear();
}

// 星级：按本关猫咪和猫窝各损失了多少生命来评定
function rateLevel() {
  const cr = clamp(L.catLost / L.catMax, 0, 1), nr = clamp(L.nestLost / L.nestMax, 0, 1);
  const score = (cr + nr) / 2;
  return { cr, nr, stars: score <= 0.15 ? 3 : score <= 0.4 ? 2 : 1 };
}

// 过关：先结算并存档，再播放庆祝动画（含星级），最后进商店
function levelClear() {
  for (const f of L.fish) { G.fish += f.v; f.v = 0; f.fly = true; }
  const r = rateLevel();
  G.lastBonus = 10 + 5 * G.level;
  G.lastStarBonus = r.stars === 3 ? 15 + 4 * G.level : r.stars === 2 ? 6 + 2 * G.level : 0;
  G.fish += G.lastBonus + G.lastStarBonus;
  G.lastStars = r.stars; G.lastCatLoss = r.cr; G.lastNestLoss = r.nr;
  G.stars[G.level] = Math.max(G.stars[G.level] || 0, r.stars);
  G.miniPlayed = false;
  saveRun();
  let saveCfg = false;
  if (G.level > store.best) { store.best = G.level; saveCfg = true; }
  if (G.score > store.bestScore) { store.bestScore = G.score; saveCfg = true; }
  if (saveCfg) save();
  L.bullets = []; L.ebullets = []; L.drops = []; L.rings = []; L.bolts = []; L.trail = [];
  L.form = null; L.cat.kx = L.cat.ky = 0; L.redRageT = 0; camZoom = 1;
  L.clearT = 0; L.fireworkT = 0; L.notice = null; L.starSnd = 0;
  L.combo = 0; L.comboT = 0; L.comboPop = 0; L.comboTierMin = 1; L.comboSplash = null; L.comboBarVis = 0; L.comboBreakT = 0; L.comboBreak = null; L.comboFilter = 0;
  for (const k in L.buffT) L.buffT[k] = 0;
  L.catnipT = 0;
  sfx.right();
  setState('clear');
}
const CLEAR_TIME = 8;
const STAR_T0 = 1.7, STAR_GAP = 0.6, STARS_DONE = STAR_T0 + 3 * STAR_GAP + 0.6;
const PARTY = ['#ff6b5e', '#ffd84a', '#7ed957', '#5aa9ff', '#ff8fb1', '#b48cff'];
function clearLayout() {
  const u = clamp(Math.min(W / 460, H / 600), 0.6, 1.2), y0 = Math.max(14, H * 0.5 - 330 * u);
  return { u, y0, starY: y0 + 138 * u, R: 27 * u, gap: 78 * u };
}
const starPos = i => { const l = clearLayout(); return { x: W / 2 + (i - 1) * l.gap, y: l.starY }; };
function updateClear(dt) {
  const c = L.cat;
  L.clearT += dt; L.shake = 0; camZoom = 1;
  c.hop = -Math.abs(Math.sin(L.clearT * 7)) * 14;
  c.aim = -0.95 + Math.sin(L.clearT * 8) * 0.3;
  c.moving = false; c.inv = 0; c.s += (1 - c.s) * Math.min(1, dt * 9);
  for (let i = 0; i < 3; i++) {
    if (L.starSnd > i || L.clearT < STAR_T0 + i * STAR_GAP) continue;
    L.starSnd = i + 1;
    const p = starPos(i), wx = cam.x + p.x / scale, wy = cam.y + p.y / scale;
    if (i < G.lastStars) {
      sfx['star' + i](); burst(wx, wy, '#ffd84a', 18, 220); burst(wx, wy, '#fff', 8, 140);
      if (i === 2) for (let k = 0; k < 3; k++) burst(wx + rand(-120, 120), wy + rand(-40, 80), PARTY[randInt(0, 5)], 22, 260);
    } else sfx.starMiss();
  }
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
function skipClear() {
  if (state !== 'clear' || L.clearT < 0.7) return;
  if (L.clearT < STARS_DONE) { L.clearT = STARS_DONE; L.starSnd = 3; } else openShop();
}
function openShop() {
  delete L.cat.hop;
  L.enemies = []; L.fish = []; camZoom = 1;
  setState('shop');
  renderShop();
  $('shopBody').scrollTop = 0;
  show('shop');
  // 如果刚刚击败了头目解锁了新道具，播放新道具解锁全屏动画
  if (G.pendingUnlock) {
    const uid = G.pendingUnlock;
    G.pendingUnlock = null;
    shopTab = 'item'; renderShop();
    saveRun();
    showUnlock(uid);
  }
  // 每关结束后自动弹出汉字小游戏（解锁动画会盖在上面，点掉后就能答题）
  if (!G.miniPlayed) openMini();
}
function gameOver(reason) {
  camZoom = 1;
  const cleared = G.level - 1;
  let saveCfg = false;
  if (cleared > store.best) { store.best = cleared; saveCfg = true; }
  if (G.score > store.bestScore) { store.bestScore = G.score; saveCfg = true; }
  if (saveCfg) save();
  clearRun();
  sfx.wrong();
  setState('over');
  $('overBody').innerHTML = `
    <h2>${reason}</h2>
    <div class="stat">到达：第 <b>${G.level}</b> 关<br>本局积分：<b>${G.score}</b>（最高积分：<b>${store.bestScore}</b>）<br>赶走入侵者：<b>${G.kills}</b> 只 · 最高连击：<b>${G.maxCombo}</b><br>最高纪录：通过 <b>${store.best}</b> 关</div>
    <button class="big" data-action="start">再来一次</button><br>
    <button class="plain" data-action="toMenu">回到主菜单</button>`;
  show('over');
}

// ---------- 头目中文题（涵盖词语填空、成语填空、古诗名句填空） ----------
// 成语题：括号里是意思，单独拿出来做中文解释；古诗题：用 zh 字段的中文解释
const idiomMeaning = q => (q.s.match(/（(.*?)）/) || [])[1] || '';
const idiomText = q => q.s.replace(/（.*?）/g, '');
const zhOf = (q, kind) => kind === 'idiom' ? idiomMeaning(q) : q.zh || '';
// 题目出现时朗读：先读中文解释，再读题目（空格读作「什么」，不读作者）
const questionSpeech = (q, kind) => `${kind === 'idiom' ? '意思是：' : ''}${zhOf(q, kind).replace(/[。？！]$/, '')}。${q.s.replace(/（.*?）/g, '').replace('____', '什么')}`;
const pyTag = py => store.pinyin && py ? `<small>${py}</small>` : '';
let quiz = null;
function openQuiz(title) {
  const roll = Math.random();
  let bank = FILL_QUIZ, bKey = 'fill', qType = '词语填空';
  if (roll < 0.34) { bank = IDIOM_QUIZ; bKey = 'idiom'; qType = '成语填空'; }
  else if (roll < 0.65) { bank = POEM_QUIZ; bKey = 'poem'; qType = '古诗填空'; }
  const q = pickFromBank(bank, bKey);
  const opts = shuffle(q.opts.map((o, i) => { const [w, py] = o.split('|'); return { w, py, ok: i === 0 }; }));
  const gName = GRADE_LEVELS[q.grade || 1].short;
  quiz = { q, opts, title, qType, gName, bKey, answered: false, correct: false };
  setState('quiz');
  renderQuiz();
  show('quiz');
  if (bKey === 'idiom' || bKey === 'poem') speak(questionSpeech(q, bKey));
}
function renderQuiz(chosen) {
  const { q, opts, title, qType, gName, answered, bKey } = quiz;
  const ans = q.opts[0].split('|')[0];
  const zhq = bKey === 'idiom' || bKey === 'poem';
  const sent = (bKey === 'idiom' ? idiomText(q) : q.s).replace('____', `<span class="blank">${answered ? ans : '&nbsp;'}</span>`);
  let h = `<div class="qbadge">📚 ${qType} · ${gName}</div>
    <div class="qtitle">⚠️ ${title} 答对问题：攻击力 +25% 并触发 5 秒金光觉醒！</div>
    <div class="qsent">${sent}</div>${zhq ? `<div class="qhint">${bKey === 'idiom' ? '意思：' : ''}${zhOf(q, bKey)}</div>` : ''}<div class="opts">`;
  opts.forEach((o, i) => {
    let cls = 'opt';
    if (answered) { if (o.ok) cls += ' right'; else if (i === chosen) cls += ' wrong'; }
    h += `<button class="${cls}" data-action="quizAns" data-i="${i}" ${answered ? 'disabled' : ''}><span class="knum">${i + 1}</span>${o.w}${pyTag(o.py)}</button>`;
  });
  h += '</div>';
  if (answered) {
    const ok = opts[chosen].ok;
    const cleanSent = q.s.replace('____', ans).replace(/（.*?）/g, '');
    h += `<div class="qfb">
      <div class="res ${ok ? 'ok' : 'no'}">${ok ? '答对了！攻击力 +25% · 准备金光觉醒！' : '答错了，正确答案是「' + ans + '」'}</div>
      <div class="full">${q.s.replace('____', ans)}<button class="speak" data-action="speak" data-t="${cleanSent}">🔊</button></div>
      <div>${q.py}</div>${zhq ? '' : `<div>${q.en}</div>`}
      <button class="big" data-action="quizDone">${ok ? '🔥 觉醒并继续战斗' : '继续战斗'}</button>`;
  }
  $('quizBody').innerHTML = h;
}
function answerQuiz(i) {
  if (!quiz || quiz.answered || i < 0 || i >= quiz.opts.length) return;
  quiz.answered = true;
  const ok = quiz.opts[i].ok;
  quiz.correct = ok;
  if (ok) { L.atkBuff += 0.25; sfx.right(); } else sfx.wrong();
  renderQuiz(i);
  const cleanSent = quiz.q.s.replace('____', quiz.q.opts[0].split('|')[0]).replace(/（.*?）/g, '');
  speak(cleanSent);
}
function finishQuiz() {
  const won = quiz && quiz.correct;
  show(null);
  setState('playing');
  if (won) triggerRedRage();
}

// ---------- 中途战败：10题中文复活考试（偏旁填空、词语填空、成语填空、读音选择，答对>=8题复活） ----------
let exam = null;
function makeExamQuestion(kind) {
  if (kind === 'radical') {
    const w = pickFromBank(COMPONENTS, 'exam_comp');
    const gName = GRADE_LEVELS[w.grade || 1].short;
    // 两种问法：偏旁填空 或 部件拼字
    if (Math.random() < 0.5) {
      return {
        qType: '偏旁填空', gName,
        prompt: `<div class="qsent">「<span class="blank">&nbsp;</span>」+「${w.parts[1]}」= <b>${w.c}</b>（${w.en}）</div><div class="qhint">请选择正确的偏旁/部件组成「${w.c}」字</div>`,
        answeredPrompt: `<div class="qsent">「<span class="blank">${w.parts[0]}</span>」+「${w.parts[1]}」= <b>${w.c}</b>（${w.en}）</div>`,
        opts: shuffle([
          { t: w.parts[0], sub: '', ok: true },
          ...shuffle(['氵', '亻', '口', '女', '木', '日', '艹', '宀', '讠', '忄', '犭', '竹', '目'].filter(p => p !== w.parts[0])).slice(0, 3).map(p => ({ t: p, sub: '', ok: false })),
        ]),
        ansText: `${w.parts[0]} + ${w.parts[1]} = ${w.c}`,
        info: `${w.c} (${w.py}) · ${w.en}`,
        say: w.c,
      };
    }
    return {
      qType: '偏旁填空', gName,
      prompt: `<div class="qsent">「${w.parts[0]}」+「${w.parts[1]}」= <span class="blank">&nbsp;</span></div><div class="qhint">含义提示：${w.en}</div>`,
      answeredPrompt: `<div class="qsent">「${w.parts[0]}」+「${w.parts[1]}」= <span class="blank">${w.c}</span></div>`,
      opts: shuffle([{ t: w.c, sub: '', ok: true }, ...w.wrong.slice(0, 3).map(x => ({ t: x, sub: '', ok: false }))]),
      ansText: w.c,
      info: `${w.c} (${w.py}) · ${w.en}`,
      say: w.c,
    };
  }
  if (kind === 'word') {
    const q = pickFromBank(FILL_QUIZ, 'exam_fill');
    const gName = GRADE_LEVELS[q.grade || 1].short;
    const ans = q.opts[0].split('|')[0];
    return {
      qType: '词语填空', gName,
      prompt: `<div class="qsent">${q.s.replace('____', '<span class="blank">&nbsp;</span>')}</div><div class="qhint">${q.en}</div>`,
      answeredPrompt: `<div class="qsent">${q.s.replace('____', `<span class="blank">${ans}</span>`)}</div>`,
      opts: shuffle(q.opts.map((o, i) => { const [w, py] = o.split('|'); return { t: w, sub: py, ok: i === 0 }; })),
      ansText: ans,
      info: `${q.py} · ${q.en}`,
      say: q.s.replace('____', ans),
    };
  }
  if (kind === 'idiom') {
    const q = pickFromBank(IDIOM_QUIZ, 'exam_idiom');
    const gName = GRADE_LEVELS[q.grade || 1].short;
    const ans = q.opts[0].split('|')[0];
    return {
      qType: '成语填空', gName,
      prompt: `<div class="qsent">${idiomText(q).replace('____', '<span class="blank">&nbsp;</span>')}</div><div class="qhint">意思：${idiomMeaning(q)}</div>`,
      answeredPrompt: `<div class="qsent">${idiomText(q).replace('____', `<span class="blank">${ans}</span>`)}</div><div class="qhint">意思：${idiomMeaning(q)}</div>`,
      opts: shuffle(q.opts.map((o, i) => { const [w, py] = o.split('|'); return { t: w, sub: py, ok: i === 0 }; })),
      ansText: ans,
      info: q.py,
      speakQ: questionSpeech(q, 'idiom'),
      say: q.s.replace('____', ans).replace(/（.*?）/g, ''),
    };
  }
  // pronounce: 读音选择
  const q = pickFromBank(PRONOUNCE_QUIZ, 'exam_pron');
  const gName = GRADE_LEVELS[q.grade || 1].short;
  const ans = q.opts[0];
  return {
    qType: '读音选择', gName,
    prompt: `<div class="qsent">${q.w}</div><div class="qhint">请选择「<b>${q.target}</b>」字的正确读音（${q.en}）</div>`,
    answeredPrompt: `<div class="qsent">${q.w}（「${q.target}」读作 <span class="blank">${ans}</span>）</div>`,
    opts: shuffle(q.opts.map((py, i) => ({ t: py, sub: '', ok: i === 0 }))),
    ansText: ans,
    info: `「${q.target}」正确读音：${ans} · ${q.en}`,
    say: q.w.replace(/（.*?）/g, ''),
  };
}

function openReviveExam(reason) {
  // 10 道考题：3 偏旁填空 + 3 词语填空 + 2 成语填空 + 2 读音选择
  const types = ['radical', 'radical', 'radical', 'word', 'word', 'word', 'idiom', 'idiom', 'pronounce', 'pronounce'];
  const questions = types.map(t => makeExamQuestion(t));
  exam = {
    reason,
    questions,
    results: Array(10).fill(null), // true | false | null
    i: 0,
    right: 0,
    total: 10,
    passNeed: 8,
    chosen: -1,
    finished: false,
    started: false,   // 先显示提示，玩家点「开始」后才开始答题
  };
  sfx.boss();
  announce(`${reason.replace(/……/g, '')}，进行中文测验，答对八题即可复活`);
  setState('exam');
  renderExam();
  show('exam');
}

function renderExam() {
  const ex = exam;
  if (!ex.started) {
    $('examBody').innerHTML = `
      <h2>${ex.reason}</h2>
      <div class="stat">进行中文测验，答对 <b>${ex.passNeed}</b> 题即可复活！<br>
        共 ${ex.total} 题：偏旁填空、词语填空、成语填空、读音选择</div>
      <button class="big" data-action="examStart">开始</button><br>
      <button class="plain" data-action="examGiveUp">放弃，直接结算</button>`;
    return;
  }
  if (ex.finished) {
    const passed = ex.right >= ex.passNeed;
    $('examBody').innerHTML = `
      <h2>${passed ? '🎉 考试通过！成功复活！' : '😢 考试未达标'}</h2>
      <div class="stat">
        本次中文考试成绩：<b>${ex.right}</b> / ${ex.total} 题（及格线：${ex.passNeed} 题）<br>
        ${passed ? '猫咪生命已全部回满，猫窝已紧急修复，并获得无敌护盾！' : `差一点点！再答对 ${ex.passNeed - ex.right} 题就能复活了。`}
      </div>
      ${passed
        ? '<button class="big" data-action="examRevive">⚡ 满血复活，继续战斗！</button>'
        : '<button class="big" data-action="examFail">查看本局结算</button>'}`;
    return;
  }
  const q = ex.questions[ex.i];
  const answered = ex.chosen >= 0;
  if (!answered && q.speakQ && ex.saidI !== ex.i) { ex.saidI = ex.i; speak(q.speakQ); }
  const dots = ex.results.map((r, idx) => {
    const cls = r === true ? 'ok' : r === false ? 'no' : idx === ex.i ? 'cur' : '';
    return `<div class="exam-dot ${cls}">${r === true ? '✓' : r === false ? '✗' : idx + 1}</div>`;
  }).join('');
  let h = `
    <div class="exam-prog">
      <div class="qtitle" style="margin:0">🚑 危急时刻：中文复活考试（答对 8/10 题满血复活）</div>
      <div style="font-size:13px">进度：第 <b>${ex.i + 1}</b> / ${ex.total} 题 · 已答对 <b>${ex.right}</b> 题</div>
      <div class="exam-dots">${dots}</div>
    </div>
    <div class="qbadge">📝 ${q.qType} · ${q.gName}</div>
    ${answered ? q.answeredPrompt : q.prompt}
    <div class="opts">`;
  q.opts.forEach((o, i) => {
    let cls = 'opt';
    if (answered) { if (o.ok) cls += ' right'; else if (i === ex.chosen) cls += ' wrong'; }
    h += `<button class="${cls}" data-action="examAns" data-i="${i}" ${answered ? 'disabled' : ''}><span class="knum">${i + 1}</span>${o.t}${pyTag(o.sub)}</button>`;
  });
  h += '</div>';
  if (answered) {
    const ok = q.opts[ex.chosen].ok;
    h += `<div class="qfb">
      <div class="res ${ok ? 'ok' : 'no'}">${ok ? '✓ 答对了！' : `✗ 答错了，正确答案是「${q.ansText}」`}</div>
      <div class="full">${q.info}<button class="speak" data-action="speak" data-t="${q.say}">🔊</button></div>
      <button class="big" data-action="examNext">${ex.i + 1 < ex.total ? '下一题' : '查看考试结果'}</button>
    </div>`;
  } else {
    h += `<button class="plain" data-action="examGiveUp">放弃考试，直接结算</button>`;
  }
  $('examBody').innerHTML = h;
}

function answerExam(i) {
  const ex = exam;
  if (!ex || !ex.started || ex.finished || ex.chosen >= 0) return;
  const q = ex.questions[ex.i];
  if (i < 0 || i >= q.opts.length) return;
  ex.chosen = i;
  const ok = q.opts[i].ok;
  ex.results[ex.i] = ok;
  if (ok) { ex.right++; sfx.right(); } else sfx.wrong();
  renderExam();
  speak(q.say);
}

function nextExam() {
  const ex = exam;
  if (!ex || ex.finished) return;
  if (ex.i + 1 < ex.total) {
    ex.i++;
    ex.chosen = -1;
    renderExam();
  } else {
    ex.finished = true;
    if (ex.right >= ex.passNeed) sfx.unlock(); else sfx.wrong();
    renderExam();
  }
}

const NEST_WIPE_R = 380;
function reviveFromExam() {
  if (!L) return;
  L.reviveUsed = true;
  L.cat.hp = catMaxHp();
  L.cat.inv = 3.5;
  G.nestHp = nestMaxHp();   // 猫和猫窝都满血
  L.ebullets = [];
  L.missileLeft++;          // 导弹防御多一次
  // 猫窝附近的敌人全部消灭（头目只受重创），猫身边的敌人被震退
  let wiped = 0;
  for (const e of L.enemies) {
    if (e.dead || dist(e, NEST) >= NEST_WIPE_R) continue;
    if (e.type === 'boss') { damageEnemy(e, Math.min(e.hp - 1, e.maxHp * 0.3)); e.stunT = 1.5; }
    else { damageEnemy(e, e.hp + 1); wiped++; }
  }
  ring(NEST.x, NEST.y, NEST_WIPE_R, '#ffe066', 0.7, true);
  ring(NEST.x, NEST.y, NEST_WIPE_R * 0.6, '#ffffff', 0.5, false);
  burst(NEST.x, NEST.y - 20, '#ffe066', 30, 320);
  if (wiped) addText(NEST.x, NEST.y - 90, `💥 猫窝附近 ${wiped} 个敌人被团灭！`, '#ffe066', 18, 2.2);
  for (const e of L.enemies) {
    if (e.dead) continue;
    if (dist(e, L.cat) < 280) {
      const a = Math.atan2(e.y - NEST.y, e.x - NEST.x);
      e.shockDist = 320;
      e.shockAngle = a;
      e.stunT = 1.5;
    }
  }
  ring(L.cat.x, L.cat.y, 180, '#7ed957', 0.6, true);
  burst(L.cat.x, L.cat.y, '#ffe066', 26, 260);
  addText(L.cat.x, L.cat.y - 44, '🎉 考试通过！满血复活！导弹 +1', '#9cff6b', 20, 2.0);
  announce('考试通过，猫咪和猫窝满血复活，导弹防御加一次');
  sfx.transform();
  show(null);
  setState('playing');
}

// ---------- 商店里的汉字小游戏 ----------
// 小游戏的六种题型：每轮 6 题，每种题型各一题，顺序随机
const MINI_TYPES = [
  { id: 'pic', name: '看图选字', tip: '看图片，选出正确的字。' },
  { id: 'comp', name: '偏旁拼字', tip: '两个部分合起来是哪个字？' },
  { id: 'word', name: '词语填空', tip: '选出句子里空缺的词语。' },
  { id: 'idiom', name: '成语填空', tip: '根据意思补全四字成语。' },
  { id: 'pron', name: '读音选择', tip: '选出正确的读音。' },
  { id: 'poem', name: '古诗填空', tip: '选出古诗中空缺的字词。' },
];
const miniTypeDef = id => MINI_TYPES.find(t => t.id === id);
function miniRound() {
  return shuffle(MINI_TYPES).map(t => t.id);
}
const TONES = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
function toneVariants(py) {
  for (let i = 0; i < py.length; i++) for (const base in TONES) {
    if (TONES[base].includes(py[i])) return [...TONES[base]].map(v => py.slice(0, i) + v + py.slice(i + 1));
  }
  return null;
}
const miniReward = () => 12 + 3 * G.level;
const MINI_TOTAL = 6, MINI_PERFECT = 30;   // 每次 6 题（每种题型一题）；全对额外奖励
let mini = null;
function makeMiniQuestion(type) {
  if (type === 'pic') {
    const w = pickFromBank(PIC_WORDS, 'mini_pic');
    const wrong = shuffle(PIC_WORDS.filter(x => x.c !== w.c && x.c.length === w.c.length)).slice(0, 3);
    return { prompt: `<div class="qbig">${w.e}</div><div class="qhint">${w.en}</div>`,
      opts: shuffle([{ t: w.c, ok: true }, ...wrong.map(x => ({ t: x.c }))]), info: `${w.e} ${w.c} ${w.py} ${w.en}`, say: w.c };
  }
  if (type === 'comp') {
    const w = pickFromBank(COMPONENTS, 'mini_comp');
    return { prompt: `<div class="qbig">${w.parts[0]} + ${w.parts[1]} = ?</div><div class="qhint">${w.en}</div>`,
      opts: shuffle([{ t: w.c, ok: true }, ...w.wrong.map(x => ({ t: x }))]), info: `${w.c} ${w.py} ${w.en}`, say: w.c };
  }
  if (type === 'idiom') {
    const q = pickFromBank(IDIOM_QUIZ, 'mini_idiom');
    const ans = q.opts[0].split('|')[0];
    return { prompt: `<div class="qsent">${idiomText(q).replace('____', '<span class="blank">&nbsp;</span>')}</div><div class="qhint">意思：${idiomMeaning(q)}</div>`,
      opts: shuffle(q.opts.map((o, i) => ({ t: o.split('|')[0], ok: i === 0 }))), info: `${idiomText(q).replace('____', ans)} (${q.py})`, say: idiomText(q).replace('____', ans), speakQ: questionSpeech(q, 'idiom') };
  }
  if (type === 'word') {
    const q = pickFromBank(FILL_QUIZ, 'mini_word');
    const ans = q.opts[0].split('|')[0];
    return { prompt: `<div class="qsent">${q.s.replace('____', '<span class="blank">&nbsp;</span>')}</div><div class="qhint">${q.en}</div>`,
      opts: shuffle(q.opts.map((o, i) => ({ t: o.split('|')[0], ok: i === 0 }))), info: `${q.s.replace('____', ans)} (${q.py})`, say: q.s.replace('____', ans) };
  }
  if (type === 'pron' && Math.random() < 0.5) {   // 读音选择：一半是多音字/词语里的读音，一半是单字声调
    const q = pickFromBank(PRONOUNCE_QUIZ, 'mini_pron');
    return { prompt: `<div class="qsent">${q.w}</div><div class="qhint">「<b>${q.target}</b>」在这里读什么？（${q.en}）</div>`,
      opts: shuffle(q.opts.map((py, i) => ({ t: py, ok: i === 0 }))), info: `「${q.target}」读 ${q.opts[0]} · ${q.en}`, say: q.w.replace(/（.*?）/g, '') };
  }
  if (type === 'poem') {
    const q = pickFromBank(POEM_QUIZ, 'mini_poem');
    const ans = q.opts[0].split('|')[0];
    return { prompt: `<div class="qsent">${q.s.replace('____', '<span class="blank">&nbsp;</span>')}</div><div class="qhint">${q.zh}</div>`,
      opts: shuffle(q.opts.map((o, i) => ({ t: o.split('|')[0], ok: i === 0 }))), info: `${q.s.replace('____', ans)} (${q.py})`, say: q.s.replace('____', ans).replace(/（.*?）/g, ''), speakQ: questionSpeech(q, 'poem') };
  }
  const singlePool = PIC_WORDS.filter(w => w.c.length === 1);
  const w = pickFromBank(singlePool, 'mini_tone');
  return { prompt: `<div class="qbig">${w.c}</div><div class="qhint">${w.e} ${w.en}</div>`,
    opts: shuffle(toneVariants(w.py).map(v => ({ t: v, ok: v === w.py }))), info: `${w.e} ${w.c} ${w.py} ${w.en}`, say: w.c };
}
function openMini() {
  if (G.miniPlayed) return;
  G.miniPlayed = true;
  saveRun();
  const types = miniRound();
  mini = { types, type: miniTypeDef(types[0]), i: 0, right: 0, total: types.length, q: makeMiniQuestion(types[0]), chosen: -1 };
  setState('mini');
  renderMini();
  show('mini');
}
function renderMini() {
  const m = mini, q = m.q, answered = m.chosen >= 0;
  if (!answered && q.speakQ && m.saidI !== m.i) { m.saidI = m.i; speak(q.speakQ); }
  let h = `<div class="qtitle">汉字小游戏 · ${m.type.name} (${m.i + 1}/${m.total}) </div>
    <div class="qhint">${m.type.tip} 每答对一题 +${miniReward()} 🐟</div>${q.prompt}<div class="opts">`;
  q.opts.forEach((o, i) => {
    let cls = 'opt';
    if (answered) { if (o.ok) cls += ' right'; else if (i === m.chosen) cls += ' wrong'; }
    h += `<button class="${cls}" data-action="miniAns" data-i="${i}" ${answered ? 'disabled' : ''}><span class="knum">${i + 1}</span>${o.t}</button>`;
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
  if (!m || m.chosen >= 0 || i < 0 || i >= m.q.opts.length) return;
  m.chosen = i;
  if (m.q.opts[i].ok) { m.right++; sfx.right(); } else sfx.wrong();
  renderMini();
  speak(m.q.say);
}
function nextMini() {
  const m = mini;
  if (m.i + 1 < m.total) { m.i++; m.chosen = -1; m.type = miniTypeDef(m.types[m.i]); m.q = makeMiniQuestion(m.types[m.i]); return renderMini(); }
  const perfect = m.right === m.total;
  const reward = m.right * miniReward() + (perfect ? MINI_PERFECT : 0);
  G.fish += reward;
  saveRun();
  if (reward) sfx.buy();
  $('miniBody').innerHTML = `<h2>${perfect ? '全部答对！太棒了！' : '小游戏结束'}</h2>
    <div class="stat">答对 <b>${m.right}</b> / ${m.total} 题${perfect ? `<br>全对奖励 +${MINI_PERFECT} 🐟` : ''}<br>一共获得 <b>${reward}</b> 🐟 小鱼干</div>
    <button class="big" data-action="miniDone">回到商店</button>`;
}

// ---------- 商店 ----------
function card({ icon, name, py, desc, lv, btns, equipped, locked }) {
  return `<div class="card${equipped ? ' equipped' : ''}${locked ? ' locked' : ''}"><div class="hd"><img class="ic" src="${ICONS.url[icon]}" alt=""><div>
    <div class="nm">${name}</div>${store.pinyin && py ? `<div class="py">${py}</div>` : ''}</div></div>
    <div class="ds">${desc}</div><div class="lv">${lv}</div><div class="row">${btns}</div></div>`;
}
const btn = (action, id, label, enabled = true) => `<button data-action="${action}" data-id="${id}" ${enabled ? '' : 'disabled'}>${label}</button>`;
let shopTab = 'weapon';   // 商店当前分页：life 生命 / weapon 武器 / item 道具
function renderShop() {
  const fish = G.fish;
  const starRow = n => [0, 1, 2].map(i => `<span class="${i < n ? '' : 'off'}">★</span>`).join('');
  const totalStars = Object.values(G.stars).reduce((a, b) => a + b, 0);
  let h = `<div class="shophead"><h2>第 ${G.level} 关完成！<span class="stars">${starRow(G.lastStars)}</span></h2>
    <div class="fishbar">🐟 ${fish}</div></div>
    <div style="font-size:13px;margin:2px 0 8px">过关奖励 +${G.lastBonus}${G.lastStarBonus ? `, 星级奖励 +${G.lastStarBonus}` : ''} 🐟 · 累计 ★ ${totalStars} · 下一关开始猫咪生命自动回满 (${catMaxHp()} HP)</div>
    <div class="minicard"><div class="txt"><b>汉字小游戏 · 综合练习</b><br>${MINI_TOTAL} 道题，识字、偏旁、词语、成语、读音、古诗各一题，每答对一题 +${miniReward()} 🐟，全对再 +${MINI_PERFECT} 🐟。</div>${btn('mini', '', G.miniPlayed ? '已玩过' : '开始', !G.miniPlayed)}</div>`;

  // 分页：生命 / 武器 / 道具
  const tabs = [['life', '❤️ 生命'], ['weapon', '🔫 武器'], ['item', '🎒 道具']];
  h += `<div class="shoptabs">${tabs.map(([id, label]) => `<button class="stab${shopTab === id ? ' on' : ''}" data-action="shopTab" data-id="${id}">${label}</button>`).join('')}</div>`;

  if (shopTab === 'weapon') {
  // 武器库
  const own = ownedList(), totalOwn = totalWeaponCount(), canSell = totalOwn > 1, canMerge = own.some(o => o.tier < TIERS.length - 1 && o.n >= MERGE_NEED[o.tier]);
  h += `<h3>武器库</h3><div class="wtools"><span>相同的武器 ${MERGE_NEED[0]} 把合成 1 把更高一阶（A 级起需要 ${MERGE_NEED[3]} 把）· 多余武器可半价出售</span><button data-action="mergeAll" ${canMerge ? '' : 'disabled'}>一键合成</button></div><div class="wgrid">`;
  for (const o of own) {
    const w = weaponDef(o.id), s = weaponStats(o.id, o.tier), eqd = G.eq.id === o.id && G.eq.tier === o.tier;
    const need = MERGE_NEED[o.tier], top = o.tier >= TIERS.length - 1, key = `${o.id}:${o.tier}`;
    const sellPrice = weaponSellPrice(o.id, o.tier);
    h += `<div class="wcell t${o.tier}${eqd ? ' equipped' : ''}" style="--tc:${TIERS[o.tier].color}">
      <div class="top"><img class="wi" src="${ICONS.url[o.id]}" alt=""><div style="text-align:right">${tierBadge(o.tier)}<div class="cnt">×${o.n}</div></div></div>
      <div class="wn">${w.name}</div>
      <div class="ws">攻击力 ${Math.round(s.dps)}/秒 · 伤害 ${Math.round(s.dmg)}${s.count > 1 ? '×' + s.count : ''} · 射速 ${(1 / s.interval).toFixed(1)}/秒<br>${s.area}</div>
      <div class="row">${btn('eqW', key, eqd ? '使用中' : '装备', !eqd)}${top ? '' : `<button class="merge" data-action="mergeW" data-id="${key}" ${o.n >= need ? '' : 'disabled'}>合成 ${o.n}/${need}</button>`}<button class="sell" data-action="sellW" data-id="${key}" ${canSell ? '' : 'disabled'}>${canSell ? `半价出售 +${sellPrice} 🐟` : '至少保留 1 把'}</button></div></div>`;
  }
  h += '</div><h3>购买武器（D 级）</h3><div class="cards">';
  for (const w of WEAPONS) {
    const s = weaponStats(w.id, 0), have = G.inv[w.id].reduce((a, b) => a + b, 0);
    h += card({ icon: w.id, name: w.name, py: w.py, desc: w.desc,
      lv: `D 级 攻击力 ${Math.round(s.dps)}/秒 · 伤害 ${Math.round(s.dmg)}${s.count > 1 ? '×' + s.count : ''} ${s.area}${have ? ` · 已有 ${have} 把` : ''}`,
      btns: btn('buyW', w.id, `购买 ${w.cost} 🐟`, fish >= w.cost) });
  }
  h += '</div>';
  }

  if (shopTab === 'item') {
  // 道具区：开局只有猫薄荷；每打败一个头目按顺序解锁下一个道具
  h += `<h3>道具（已解锁 ${G.unlockedItems}/${ITEMS.length} · 每击败 1 个头目解锁 1 个）</h3><div class="cards">`;
  const unlockedList = ITEMS.slice(0, G.unlockedItems);
  for (const it of unlockedList) {
    const st = G.items[it.id], upC = itemUpCost(it, st.lv);
    // 合成升级：再买一份合进去，等级 +1，威力增强
    const up = !st.n ? '' : st.lv < it.max ? btn('upI', it.id, `合成升级 ${upC} 🐟`, fish >= upC) : btn('', '', '已满级', false);
    let buy, have;
    if (it.multi) {
      buy = st.n < it.multi ? btn('buyI', it.id, `${st.n ? '再买' : '购买'} 1 ${it.unit} ${it.cost} 🐟`, fish >= it.cost) : '';
      have = st.n ? `已有 <b>${st.n}/${it.multi}</b> ${it.unit} · 等级 ${st.lv}/${it.max}` : `还没有（最多 ${it.multi} ${it.unit}）`;
    } else {
      buy = st.n ? '' : btn('buyI', it.id, `购买 ${it.cost} 🐟`, fish >= it.cost);
      have = st.n ? `已拥有 · 等级 ${st.lv}/${it.max}` : '还没有';
    }
    h += card({ icon: it.id, name: it.name, py: it.py, desc: it.desc, lv: `${have}<br>${it.eff(st.lv)}${st.n && st.lv < it.max ? ` → 下一级：${it.eff(st.lv + 1)}` : ''}`, btns: buy + up });
  }
  if (G.unlockedItems < ITEMS.length) {
    const nxt = ITEMS[G.unlockedItems];
    h += card({
      icon: nxt.id,
      name: `🔒 待解锁：${nxt.name}`,
      py: nxt.py,
      desc: G.unlockedItems === 1 ? '击败第 3 关的头目即可解锁！' : '击败下一个头目即可解锁此道具！',
      lv: `预告：${nxt.desc}`,
      btns: btn('', '', '击败头目解锁', false),
      locked: true,
    });
  }
  h += '</div>';
  }

  if (shopTab === 'life') {
  h += '<h3>生命升级与加固猫窝</h3><div class="cards">';
  for (const s of STATS) {
    const lv = G.stats[s.id], c = statCost(lv);
    const btns = lv < s.max ? btn('stat', s.id, `强化 ${c} 🐟`, fish >= c) : btn('', '', '已满级', false);
    const look = s.id === 'catHp' ? `　造型：${catLookName(lv)}` : s.id === 'nestHp' ? `　造型：${nestLookName(lv)}${lv >= 3 ? ` · 导弹防御每关 ${Math.floor(lv / 3)} 次` : ''}` : '';
    h += card({ icon: s.id, name: s.name, py: s.py, desc: s.desc, lv: `等级 ${lv}${Number.isFinite(s.max) ? '/' + s.max : ''}${look}`, btns });
  }
  const hurt = G.nestHp < nestMaxHp();
  h += card({ icon: 'repair', name: '修补猫窝', py: 'xiūbǔ māowō', desc: `恢复猫窝 ${REPAIR_HP} 点生命。`,
    lv: `猫窝生命 ${Math.ceil(G.nestHp)}/${nestMaxHp()}`,
    btns: btn('repair', '', hurt ? `修补 ${REPAIR_COST} 🐟` : '不需要修补', hurt && fish >= REPAIR_COST) });
  h += '</div>';
  }
  const nextBoss = isBossLevel(G.level + 1);
  h += `<div class="shopfoot"><button class="big" data-action="next">开始第 ${G.level + 1} 关${nextBoss ? '（头目关！）' : ''}</button><br>
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
    <div>${tierBadge(from)} → ${tierBadge(to, 'big')}</div><div class="sub">${w.name} ${TIERS[to].name}</div></div>`;
  el.classList.add('show');
  if (to >= 4) sfx.mergeBig(); else sfx.merge();
  clearTimeout(mergeTimer); mergeTimer = setTimeout(hideMerge, 2200);
}
function hideMerge() { $('mergeFx').classList.remove('show'); }
$('mergeFx').addEventListener('click', hideMerge);

// 击败头目解锁新道具庆祝动画
let unlockTimer = 0;
function showUnlock(id) {
  const el = $('unlockFx'), it = itemDef(id);
  if (!el || !it) return;
  el.innerHTML = `
    <div class="mfbox">
      <div class="mfrays"></div>
      <div class="ttl">🎉 击败头目 · 解锁新道具！</div>
      <img src="${ICONS.url[it.id]}" alt="">
      <div class="un-name">${it.name}</div>
      ${store.pinyin ? `<div class="un-py">${it.py}</div>` : ''}
      <div class="un-desc">${it.desc}<br><b>商店价格：${it.cost} 🐟（买一次永久拥有）</b></div>
      <div class="sub">点击任意处继续</div>
    </div>`;
  el.classList.add('show');
  sfx.unlock();
  announce(`解锁新道具：${it.name}`);
  clearTimeout(unlockTimer);
  unlockTimer = setTimeout(hideUnlock, 4200);
}
// 道具合成升级的庆祝画面（和武器合成同一个弹窗）
function showItemMerge(id, from, to) {
  const el = $('mergeFx'), it = itemDef(id);
  el.innerHTML = `<div class="mfbox"><div class="mfrays"></div><div class="ttl">合成升级！</div><img src="${ICONS.url[id]}" alt="">
    <div class="sub" style="font-size:24px;font-weight:900">Lv${from} → Lv${to}</div><div class="sub">${it.name}：${it.eff(to)}</div></div>`;
  el.classList.add('show');
  if (to >= 4) sfx.mergeBig(); else sfx.merge();
  announce(`${it.name}升到 ${to} 级`);
  clearTimeout(mergeTimer); mergeTimer = setTimeout(hideMerge, 2200);
}
function hideUnlock() { $('unlockFx').classList.remove('show'); }
$('unlockFx').addEventListener('click', hideUnlock);

function shopAction(action, id) {
  if (action === 'buyW') { const w = weaponDef(id); if (pay(w.cost)) { G.inv[id][0]++; fixEquip(); } }
  else if (action === 'sellW') {
    const [wid, t] = id.split(':'), tier = +t;
    if (G.inv[wid] && G.inv[wid][tier] > 0 && totalWeaponCount() > 1) {
      G.inv[wid][tier]--;
      G.fish += weaponSellPrice(wid, tier);
      fixEquip();
      sfx.buy();
    }
  }
  else if (action === 'eqW') { const [wid, t] = id.split(':'); if (G.inv[wid] && G.inv[wid][+t] > 0) { G.eq = { id: wid, tier: +t }; sfx.switch(); } }
  else if (action === 'mergeW') {
    const [wid, t] = id.split(':');
    if (G.inv[wid] && mergeWeapon(wid, +t)) { fixEquip(); showMerge(wid, +t, +t + 1); }
  }
  else if (action === 'mergeAll') { const top = mergeAll(); if (top) showMerge(top.id, top.from, top.to); }
  else if (action === 'buyI') {
    if (!isItemUnlocked(id)) return;
    const it = itemDef(id), st = G.items[id];
    if (st.n < (it.multi || 1) && pay(it.cost)) st.n++;
  }
  else if (action === 'upI') {
    if (!isItemUnlocked(id)) return;
    const it = itemDef(id), st = G.items[id];
    if (st.n && st.lv < it.max && pay(itemUpCost(it, st.lv))) { st.lv++; showItemMerge(id, st.lv - 1, st.lv); }
  }
  else if (action === 'stat') {
    const s = STATS.find(x => x.id === id), lv = G.stats[id];
    if (lv < s.max && pay(statCost(lv))) { G.stats[id]++; if (id === 'nestHp') { G.nestHp = nestMaxHp(); } }
  }
  else if (action === 'repair') { if (G.nestHp < nestMaxHp() && pay(REPAIR_COST)) G.nestHp = Math.min(nestMaxHp(), G.nestHp + REPAIR_HP); }
  saveRun();
  renderShop();
}

// ---------- 按钮事件 ----------
let confirmNewRun = false;
function refreshToggles() {
  const gInfo = GRADE_LEVELS.find(g => g.id === store.grade) || GRADE_LEVELS[0];
  const muted = isAudioMuted();
  const pct = Math.round(store.volume * 100);
  for (const n of [1, 2]) {
    if ($('tglGrade' + n)) $('tglGrade' + n).textContent = '题库：' + gInfo.short;
    if ($('tglPinyin' + n)) $('tglPinyin' + n).textContent = '拼音：' + (store.pinyin ? '开' : '关');
    const panel = $('audioPanel' + n);
    if (panel) {
      panel.classList.toggle('muted', muted);
      panel.classList.toggle('unmuted', !muted);
    }
    const btn = $('tglMute' + n);
    if (btn) btn.setAttribute('aria-pressed', String(muted));
    if ($('audioIcon' + n)) $('audioIcon' + n).textContent = muted ? '🔇' : '🔊';
    if ($('audioLabel' + n)) $('audioLabel' + n).textContent = muted ? '声音已静音' : '声音已开启';
    if ($('audioBadge' + n)) $('audioBadge' + n).textContent = muted ? '已静音' : '未静音';
    if ($('volSlider' + n)) $('volSlider' + n).value = String(muted ? 0 : pct);
    if ($('volPct' + n)) $('volPct' + n).textContent = (muted ? 0 : pct) + '%';
  }
  const bestParts = [];
  if (store.best) bestParts.push(`通过 ${store.best} 关`);
  if (store.bestScore) bestParts.push(`最高积分 ${store.bestScore}`);
  $('bestText').textContent = bestParts.length ? `最高纪录：${bestParts.join(' · ')}` : '';
  const run = loadRun();
  $('btnContinue').style.display = run ? '' : 'none';
  if (run) $('btnContinue').textContent = `继续游戏（从第 ${run.level + 1} 关开始）`;
  confirmNewRun = false;
  $('btnStart').textContent = run ? '开始新游戏' : '开始游戏';
  $('btnStart').className = run ? 'tgl' : 'big';
}
for (const n of [1, 2]) {
  const sl = $('volSlider' + n);
  if (sl) sl.addEventListener('input', () => { initAudio(); setMasterVolume(sl.value / 100); });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  initAudio();
  const a = b.dataset.action, id = b.dataset.id;
  switch (a) {
    case 'start':
      if (state === 'menu' && loadRun() && !confirmNewRun) {
        confirmNewRun = true;
        $('btnStart').textContent = '再点一次：确认覆盖旧进度';
        break;
      }
      confirmNewRun = false;
      newGame(); break;
    case 'continue': continueGame(); break;
    case 'resume': resumeGame(); break;
    case 'toMenu': G = null; L = null; camZoom = 1; setState('menu'); refreshToggles(); show('menu'); break;
    case 'toggleGrade': store.grade = (store.grade + 1) % GRADE_LEVELS.length; save(); refreshToggles(); break;
    case 'togglePinyin': store.pinyin = !store.pinyin; save(); refreshToggles(); break;
    case 'toggleMute': toggleMasterMute(false); break;
    case 'quizAns': answerQuiz(+b.dataset.i); break;
    case 'quizDone': finishQuiz(); break;
    case 'examStart': if (exam) { exam.started = true; renderExam(); } break;
    case 'examAns': answerExam(+b.dataset.i); break;
    case 'examNext': nextExam(); break;
    case 'examRevive': reviveFromExam(); break;
    case 'examFail': case 'examGiveUp': gameOver(exam ? exam.reason : '闯关失败'); break;
    case 'speak': speak(b.dataset.t, true); break;
    case 'mini': openMini(); break;
    case 'miniAns': answerMini(+b.dataset.i); break;
    case 'miniNext': nextMini(); break;
    case 'miniDone': setState('shop'); renderShop(); show('shop'); break;
    case 'next': G.level++; startLevel(); break;
    case 'shopTab': shopTab = id; sfx.switch(); renderShop(); break;
    case 'buyW': case 'sellW': case 'eqW': case 'mergeW': case 'mergeAll': case 'buyI': case 'upI': case 'stat': case 'repair': shopAction(a, id); break;
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
  const effScale = scale * camZoom;
  ctx.fillStyle = '#5aa84e'; ctx.fillRect(cam.x - 50, cam.y - 50, W / effScale + 100, H / effScale + 100);
  ctx.fillStyle = '#8fd16f'; ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.fillStyle = '#86c966';
  for (let x = 0; x < WORLD.w; x += 100) for (let y = (x / 100 % 2) * 100; y < WORLD.h; y += 200) ctx.fillRect(x, y, 100, 100);
  ctx.fillStyle = '#e3cf9a';
  ell(NEST.x, NEST.y + 10, 120, 95, '#e3cf9a');
  for (const d of decor) {
    if (d.x < cam.x - 20 || d.x > cam.x + W / effScale + 20 || d.y < cam.y - 20 || d.y > cam.y + H / effScale + 20) continue;
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
function drawAmbientMotes(vw, vh) {
  const spanW = vw + 160, spanH = vh + 160;
  for (const m of ambientMotes) {
    const x0 = ((m.u * spanW + m.vx * ambientT - cam.x * m.parallax) % spanW + spanW) % spanW - 80;
    const y0 = ((m.v * spanH + m.vy * ambientT - cam.y * m.parallax) % spanH + spanH) % spanH - 80;
    const wx = cam.x + x0 + Math.sin(ambientT * m.swaySpd + m.phase) * m.swayAmp;
    const wy = cam.y + y0 + Math.cos(ambientT * m.swaySpd * 0.8 + m.phase) * (m.swayAmp * 0.6);
    const tw = 0.55 + 0.45 * Math.sin(ambientT * m.twinkleSpd + m.phase);
    const a = m.alpha * tw;
    ctx.globalAlpha = a * 0.32;
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.arc(wx, wy, m.r * 2.1, 0, TAU); ctx.fill();
    ctx.globalAlpha = a;
    if (m.star) {
      const sr = m.r * 1.55;
      ctx.beginPath();
      ctx.moveTo(wx, wy - sr);
      ctx.quadraticCurveTo(wx, wy, wx + sr, wy);
      ctx.quadraticCurveTo(wx, wy, wx, wy + sr);
      ctx.quadraticCurveTo(wx, wy, wx - sr, wy);
      ctx.quadraticCurveTo(wx, wy, wx, wy - sr);
      ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(wx, wy, m.r, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
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
// 猫窝和猫咪的造型：前 10 级每级换样子，10 级以后按等级换颜色
const NEST_LOOKS = ['纸箱小窝', '加固小窝', '大猫窝', '花窗大猫窝', '猫别墅', '阳台猫别墅', '花园猫别墅', '猫城堡', '旗帜猫城堡', '高塔猫城堡', '黄金猫城堡'];
const CAT_LOOKS = ['普通猫咪', '红围巾', '小斗篷', '斗篷和帽子', '铁头盔', '羽毛头盔', '骑士铠甲', '金头盔', '黄金铠甲', '王冠', '猫咪国王'];
const nestLookName = lv => lv <= 10 ? NEST_LOOKS[lv] : `彩色猫城堡（第 ${lv - 9} 款）`;
const catLookName = lv => lv <= 10 ? CAT_LOOKS[lv] : `彩色国王（第 ${lv - 9} 款）`;
const lookHue = lv => `hsl(${((lv - 10) * 47 + 160) % 360} 70% 55%)`;

function drawNest() {
  const lv = G ? G.stats.nestHp : 0, x = NEST.x, y = NEST.y, flash = L && L.nestFlash > 0;
  const tint = c => flash ? '#ffd0c0' : c;
  const R = (rx, ry, w, h, fill, r = 4) => { ctx.fillStyle = tint(fill); ctx.beginPath(); ctx.roundRect(rx, ry, w, h, r); ctx.fill(); ctx.stroke(); };
  const T = (pts, fill) => polyFill(pts, tint(fill));
  const win = (wx, wy, w = 14, h = 14) => { R(wx - w / 2, wy - h / 2, w, h, '#bfe6ff', 3); ctx.beginPath(); ctx.moveTo(wx, wy - h / 2); ctx.lineTo(wx, wy + h / 2); ctx.moveTo(wx - w / 2, wy); ctx.lineTo(wx + w / 2, wy); ctx.stroke(); };
  const door = (dx, dy, r = 19) => { ctx.fillStyle = '#5b3d28'; ctx.beginPath(); ctx.arc(dx, dy, r, Math.PI, 0); ctx.lineTo(dx + r, dy); ctx.lineTo(dx - r, dy); ctx.fill(); ctx.stroke(); ell(dx, dy - 2, r * 0.8, r * 0.26, '#ffadc6'); };
  const sign = (sx, sy, w = 44) => { R(sx - w / 2, sy - 10, w, 20, '#fff6df', 5); ctx.fillStyle = OUT; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('猫窝', sx, sy + 1); };
  const flag = (fx, fy, col) => { ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 26); ctx.stroke(); T([fx, fy - 26, fx + 18 + Math.sin(performance.now() / 200) * 2, fy - 21, fx, fy - 15], col); };
  const crenel = (cx0, cy0, w, n, col) => { const k = w / (n * 2 - 1); for (let i = 0; i < n; i++) R(cx0 + i * 2 * k, cy0 - 8, k, 9, col, 1); };
  const tower = (tx, ty, w, h, wall, roof) => { R(tx - w / 2, ty - h, w, h, wall, 3); T([tx - w / 2 - 5, ty - h, tx, ty - h - w * 0.9, tx + w / 2 + 5, ty - h], roof); win(tx, ty - h * 0.55, 9, 12); };
  ctx.lineWidth = 3; ctx.strokeStyle = OUT;
  ell(x, y + 34, 54 + Math.min(lv, 10) * 4, 14, 'rgba(0,0,0,.15)');
  if (lv <= 1) {   // 纸箱小窝 / 加固小窝（钉了木板）
    R(x - 44, y - 18, 88, 54, '#d9a765', 8);
    if (lv === 1) { ctx.save(); ctx.strokeStyle = '#8a5a2c'; ctx.lineWidth = 3; for (const yy of [y - 4, y + 12]) { ctx.beginPath(); ctx.moveTo(x - 42, yy); ctx.lineTo(x + 42, yy); ctx.stroke(); } ctx.restore(); for (const s2 of [-1, 1]) ell(x + s2 * 36, y - 4, 2, 2, OUT); }
    T([x - 56, y - 16, x, y - 58, x + 56, y - 16], lv === 1 ? '#c8562a' : '#e8743b');
    door(x, y + 36); sign(x, y - 1);
  } else if (lv <= 3) {   // 大猫窝（烟囱、屋瓦；3 级加花窗）
    R(x + 26, y - 68, 12, 28, '#9a6b4a', 2);
    R(x - 56, y - 22, 112, 60, '#e2b77a', 8);
    T([x - 68, y - 20, x, y - 76, x + 68, y - 20], '#d4552f');
    ctx.save(); ctx.strokeStyle = 'rgba(74,52,35,.45)'; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) { const yy = y - 20 - i * 14, hw = 68 * (1 - i * 14 / 56); ctx.beginPath(); ctx.moveTo(x - hw, yy); ctx.lineTo(x + hw, yy); ctx.stroke(); }
    ctx.restore();
    if (lv === 3) for (const wx of [x - 36, x + 36]) { win(wx, y + 2); R(wx - 11, y + 10, 22, 6, '#8a5a3a', 2); ['#ff8fb1', '#ffd84a', '#ff6b5e'].forEach((fc, k) => ell(wx - 6 + k * 6, y + 8, 3, 3, fc)); }
    door(x, y + 38, 20); sign(x, y - 6);
  } else if (lv <= 6) {   // 猫别墅：两层（5 级加阳台，6 级加花园）
    if (lv >= 6) {
      for (const s2 of [-1, 1]) { ell(x + s2 * 80, y + 28, 15, 12, '#5fae3c', OUT); ell(x + s2 * 96, y + 22, 11, 10, '#7ed957', OUT); }
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      for (let k = -104; k <= 104; k += 13) if (Math.abs(k) > 30) { ctx.beginPath(); ctx.moveTo(x + k, y + 48); ctx.lineTo(x + k, y + 34); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(x - 104, y + 41); ctx.lineTo(x - 30, y + 41); ctx.moveTo(x + 30, y + 41); ctx.lineTo(x + 104, y + 41); ctx.stroke();
      ctx.restore();
    }
    R(x - 62, y - 14, 124, 52, '#f2d9a6', 6);
    R(x - 46, y - 54, 92, 42, '#f6e2b8', 6);
    T([x - 58, y - 52, x, y - 94, x + 58, y - 52], '#c8402d');
    win(x - 40, y + 8); win(x + 40, y + 8); win(x - 22, y - 34, 13, 13); win(x + 22, y - 34, 13, 13);
    if (lv >= 5) { R(x - 50, y - 18, 100, 6, '#8a5a3a', 2); ctx.save(); ctx.lineWidth = 2; for (let k = -46; k <= 46; k += 10) { ctx.beginPath(); ctx.moveTo(x + k, y - 18); ctx.lineTo(x + k, y - 27); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(x - 50, y - 27); ctx.lineTo(x + 50, y - 27); ctx.stroke(); ctx.restore(); }
    door(x, y + 38, 18); sign(x, y - 68, 40);
  } else {   // 猫城堡（8 级插旗，9 级加中央高塔，10 级黄金；之后按等级换色）
    const over10 = lv > 10, gold = lv >= 10;
    const wall = over10 ? lookHue(lv) : gold ? '#f0c95a' : '#b9b3a8', roof = gold ? '#ffb300' : '#4f7fd6', flagC = over10 ? '#fff' : gold ? '#ff5e5e' : '#e8483f';
    if (lv >= 9) { tower(x, y - 30, 34, 42, wall, roof); flag(x, y - 30 - 42 - 34 * 0.9, flagC); }
    for (const s2 of [-1, 1]) tower(x + s2 * 64, y + 38, 30, 86, wall, roof);
    if (lv >= 8) for (const s2 of [-1, 1]) flag(x + s2 * 64, y + 38 - 86 - 30 * 0.9, flagC);
    R(x - 52, y - 30, 104, 68, wall, 3); crenel(x - 52, y - 30, 104, 7, wall);
    ctx.save(); ctx.strokeStyle = 'rgba(74,52,35,.3)'; ctx.lineWidth = 1.5;
    for (let r0 = 0; r0 < 3; r0++) for (let k = 0; k < 5; k++) ctx.strokeRect(x - 48 + k * 19 + (r0 % 2) * 9, y - 22 + r0 * 13, 17, 11);
    ctx.restore();
    door(x, y + 38, 20); sign(x, y - 10, 44);
  }
  // 猫窝护盾（地上掉落的增益）
  if (L && L.buffT && L.buffT.nestShield > 0) {
    const t = L.buffT.nestShield, blink = t < 2 && Math.floor(t * 8) % 2;
    if (!blink) { ctx.lineWidth = 3; ell(x, y - 12, 104 + Math.min(lv, 10) * 4, 92 + Math.min(lv, 10) * 4, 'rgba(79,183,255,.16)', 'rgba(79,183,255,.85)'); }
  }
}
function drawTurret(t) {
  ctx.lineWidth = 2.5; ctx.strokeStyle = OUT;
  ell(t.x, t.y + 8, 14, 5, 'rgba(0,0,0,.15)');
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.aim);
  ctx.fillStyle = '#8c98a8'; ctx.fillRect(4, -4, 18, 8); ctx.strokeRect(4, -4, 18, 8);
  ctx.restore();
  ell(t.x, t.y, 12, 12, '#ffd84a', OUT);
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
    const nSh = ilv('shuriken');
    for (let i = 0; i < nSh; i++) {
      const a = L.shAngle + i * TAU / nSh, bx = NEST.x + Math.cos(a) * SHURIKEN_R, by = NEST.y + Math.sin(a) * SHURIKEN_R;
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
  if (d.life < 3 && Math.floor(d.life * 6) % 2) return;
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
  const S = c.s * (1 + 0.45 * Math.sin(Math.PI * L.morphT / 0.4));
  for (const t of L.trail) {
    ctx.globalAlpha = t.life; ell(t.x, t.y + 18 - 12 * t.s, 14 * t.s, 12 * t.s, t.color); ell(t.x, t.y + 18 - 30 * t.s, 15 * t.s, 13 * t.s, t.color);
  }
  ctx.globalAlpha = c.inv > 0 && L.redRageT <= 0 && Math.floor(c.inv * 20) % 2 ? 0.5 : 1;
  ctx.save(); ctx.translate(c.x, c.y + 18); ctx.scale(S, S); ctx.translate(-c.x, -(c.y + 18));

  // 答对中文题后的 5 秒周身金光上升气焰与光环
  if (L.redRageT > 0) {
    const now = performance.now();
    ctx.save();
    ell(c.x, c.y - 4, 36 + Math.sin(now / 60) * 3, 38 + Math.cos(now / 60) * 3, 'rgba(255, 210, 60, 0.26)', 'rgba(255, 215, 80, 0.95)');
    // 周身上升金光柱与气浪线条
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const phase = ((now / 380 + i / 6) % 1);
      const rx = c.x + Math.sin(i * 2.1 + now / 200) * 24;
      const ry = c.y + 20 - phase * 62;
      const len = 12 + (1 - phase) * 14;
      ctx.strokeStyle = i % 2 ? `rgba(255, 215, 60, ${0.9 * (1 - phase)})` : `rgba(255, 245, 190, ${0.9 * (1 - phase)})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry - len); ctx.stroke();
    }
    ctx.restore();
  }

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
  // 装备：猫咪护甲等级越高，装备越多（前 10 级换装备，之后换颜色）
  const gl = G.stats.catHp, hueC = gl > 10 ? lookHue(gl) : null;
  const capeC = hueC || (gl >= 9 ? '#7b3fb8' : gl >= 7 ? '#3f6fd8' : '#d8402d');
  const metal = gl > 10 ? '#ffd24a' : gl >= 8 ? '#ffd24a' : '#c9d1db';
  if (gl >= 2) {   // 斗篷（在身体后面）
    const flutter = Math.sin(performance.now() / 160) * 2 + (c.moving ? 3 : 0);
    polyFill([-9, -3, 8, -3, 6, 14, -16 - flutter, 18, -21 - flutter, 7], capeC);
    if (gl >= 9) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, 14); ctx.lineTo(-16 - flutter, 18); ctx.stroke(); ctx.restore(); }
  }
  // 脚
  const step = c.moving ? Math.sin(c.walk) * 3 : 0;
  ell(-6 + step, 16, 5, 3.5, L.redRageT > 0 ? '#ffd8d8' : '#fff', OUT); ell(6 - step, 16, 5, 3.5, L.redRageT > 0 ? '#ffd8d8' : '#fff', OUT);
  // 身体
  ell(0, 6, 13, 11, FUR, OUT);
  ell(0, 9, 7, 6, L.redRageT > 0 ? '#ff9e9e' : '#fff');
  if (gl >= 6) { ctx.save(); ctx.lineWidth = 2; ell(2, 7, 10, 9, metal, OUT); ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(2, 15); ctx.stroke(); ctx.restore(); }   // 铠甲
  // 项圈和铃铛
  ctx.strokeStyle = L.redRageT > 0 ? '#ffe066' : '#2bb5a0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-10, -1); ctx.quadraticCurveTo(0, 4, 10, -1); ctx.stroke();
  ctx.lineWidth = 1.5; ell(0, 3, 3, 3, '#ffd84a', OUT);
  if (gl >= 1 && L.redRageT <= 0) {   // 围巾
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-10, -1); ctx.quadraticCurveTo(0, 4, 10, -1);
    ctx.strokeStyle = OUT; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = capeC; ctx.lineWidth = 5; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; polyFill([-7, 1, -13, 11, -6, 11], capeC);
  }
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
  ell(3, -8, 7, 5, L.redRageT > 0 ? '#ffd8d8' : '#fff');
  if (cheer) {
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-2, -12, 2.6, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(9, -12, 2.6, Math.PI, 0); ctx.stroke();
  } else {
    ctx.fillStyle = L.redRageT > 0 ? '#ffe066' : OUT;
    ctx.beginPath(); ctx.arc(-2, -13, 2.2, 0, TAU); ctx.arc(9, -13, 2.2, 0, TAU); ctx.fill();
    if (L.form === 'giant' || L.form === 'power' || L.form === 'redRage') {
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(0, -15.5); ctx.moveTo(13, -18); ctx.lineTo(7, -15.5); ctx.stroke();
    }
  }
  ctx.fillStyle = '#ff8fa3'; ctx.beginPath(); ctx.moveTo(2, -9.5); ctx.lineTo(6, -9.5); ctx.lineTo(4, -7.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(4, -7.5); ctx.quadraticCurveTo(2, -4.5, 0.5, -6.5); ctx.moveTo(4, -7.5); ctx.quadraticCurveTo(6, -4.5, 7.5, -6.5); ctx.stroke();
  // 头饰：帽子 → 头盔 → 羽毛 → 金头盔 → 王冠
  ctx.lineWidth = 2.2; ctx.strokeStyle = OUT;
  if (gl === 3) {
    ctx.fillStyle = '#3f8fe0'; ctx.beginPath(); ctx.arc(0, -20, 12, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    polyFill([8, -21, 23, -20, 23, -17, 7, -18], '#2f6fb8');
  } else if (gl >= 4 && gl <= 8) {
    ctx.fillStyle = gl >= 7 ? '#ffd24a' : '#c9d1db';
    ctx.beginPath(); ctx.ellipse(0, -18, 16, 11, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillRect(6, -19, 3, 9); ctx.strokeRect(6, -19, 3, 9);
    for (const s2 of [-1, 1]) {   // 猫耳朵从头盔里钻出来
      ctx.fillStyle = FUR; ctx.beginPath(); ctx.moveTo(s2 * 6, -24); ctx.lineTo(s2 * 14, -32); ctx.lineTo(s2 * 15, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (gl >= 5) ellRot(-1, -34, 4, 10, -0.4, gl >= 7 ? '#ffffff' : '#e8483f', OUT);
  } else if (gl >= 9) {
    const crown = gl > 10 ? '#ffd24a' : '#ffd24a', k = gl >= 10 ? 1.25 : 1;
    polyFill([-10 * k, -21, -10 * k, -21 - 11 * k, -5 * k, -21 - 6 * k, 0, -21 - 13 * k, 5 * k, -21 - 6 * k, 10 * k, -21 - 11 * k, 10 * k, -21], crown);
    ell(0, -25, 2.4, 2.4, hueC || '#e8483f'); if (gl >= 10) { ell(-6, -24, 2, 2, '#4fc3ff'); ell(6, -24, 2, 2, '#7ed957'); }
  }
  ctx.restore();
  // 枪
  const [gx, gy] = ICONS.grip[G.eq.id], gs = 0.62;
  ctx.save(); ctx.translate(c.x, c.y + 4 + bob); ctx.rotate(c.aim); ctx.scale(1, face);
  if (G.eq.tier > 0 || L.redRageT > 0) {
    const ga = ctx.globalAlpha; ctx.globalAlpha = ga * (0.28 + 0.1 * Math.sin(performance.now() / 160));
    ell(22, 1, 18 + G.eq.tier * 1.5, 11 + G.eq.tier, L.redRageT > 0 ? '#ff2424' : tierColor(G.eq.tier)); ctx.globalAlpha = ga;
  }
  ctx.drawImage(ICONS.held[G.eq.id], 11 - gx * gs, 1 - gy * gs, 64 * gs, 64 * gs);
  ctx.lineWidth = 2; ctx.strokeStyle = OUT;
  ell(11, 3, 4.5, 4, '#fff', OUT);
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
function drawDragonTelegraph(e) {
  ctx.lineWidth = 2;
  for (const m of e.meteors) {
    const p = clamp(m.t / m.delay, 0, 1);
    ell(m.x, m.y, 74, 74, `rgba(230,60,40,${0.1 + 0.2 * p})`, 'rgba(230,60,40,.7)');
    ell(m.x, m.y, 74 * p, 74 * p, `rgba(255,120,40,${0.2 + 0.3 * p})`);
    if (p > 0.35) {
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
function polyFill(pts, fill, stroke = true) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) ctx.stroke();
}
function ellRot(x, y, rx, ry, rot, fill, stroke) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

const ctxReal = ctx;
let ctxBase = ctxReal;
let tintRgb = null, tintAmt = 0;
const tintCache = new Map();
function tintColor(col) {
  if (typeof col !== 'string' || col[0] !== '#' || col === '#fff' || col === '#ffffff') return col;
  const key = col + tintRgb;
  let out = tintCache.get(key);
  if (out) return out;
  let h = col.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const v = [0, 2, 4].map((i, k) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - tintAmt) + tintRgb[k] * tintAmt));
  out = '#' + v.map(x => x.toString(16).padStart(2, '0')).join('');
  tintCache.set(key, out);
  return out;
}
const boundFnCache = new WeakMap();
function getBoundFn(base, k, fn) {
  let map = boundFnCache.get(base);
  if (!map) { map = new Map(); boundFnCache.set(base, map); }
  let bound = map.get(k);
  if (!bound) { bound = fn.bind(base); map.set(k, bound); }
  return bound;
}
const ctxTinted = new Proxy(ctxReal, {
  get(_t, k) {
    const v = ctxBase[k];
    return typeof v === 'function' ? getBoundFn(ctxBase, k, v) : v;
  },
  set(_t, k, v) { ctxBase[k] = (k === 'fillStyle' || k === 'strokeStyle') && tintRgb ? tintColor(v) : v; return true; },
});
const HIT_SZ = 320, HIT_HALF = HIT_SZ / 2;
const hitCanvas = document.createElement('canvas');
hitCanvas.width = HIT_SZ * 2;
hitCanvas.height = HIT_SZ * 2;
const hitCtx = hitCanvas.getContext('2d');
const TINT_RGB = ETIERS.map(T => T.tint && [1, 3, 5].map(i => parseInt(T.tint.slice(i, i + 2), 16)));
function drawEnemyTinted(e) {
  tintRgb = TINT_RGB[e.tier]; tintAmt = ETIERS[e.tier].alpha * 1.35;
  ctx = ctxTinted;
  try { drawEnemyBody(e); } finally { ctx = ctxBase; tintRgb = null; }
}
function drawEnemyBody(e) {
  const wob = Math.sin(e.t * 10) * 1.5;
  const fly = e.type === 'crow' || e.type === 'bat';
  const stunShake = e.stunT > 0 ? Math.sin(performance.now() / 25) * 3 : 0;
  ctx.save(); ctx.translate(e.x + stunShake, e.y + (fly ? Math.sin(e.t * (e.type === 'bat' ? 9 : 5)) * 4 - 8 : wob * 0.4)); ctx.scale(e.face, 1);
  ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const fl = false;
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
    ctx.lineWidth = 11; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(-r + 2, 6); ctx.quadraticCurveTo(-r - 16, 4, -r - 14, -12 + wob); ctx.stroke();
    ctx.lineWidth = 7; ctx.strokeStyle = c; ctx.stroke();
    ctx.setLineDash([4, 6]); ctx.strokeStyle = '#3d3f46'; ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2.5; ctx.strokeStyle = OUT;
    ell(-9, -r + 2, 6, 6, c, OUT); ell(9, -r + 2, 6, 6, c, OUT);
    ell(0, 0, r, r * 0.9, c, OUT);
    ctx.fillStyle = '#3d3f46'; ctx.beginPath(); ctx.ellipse(3, -4, r * 0.8, 5.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -4, 2.5, 0, TAU); ctx.arc(9, -4, 2.5, 0, TAU); ctx.fill();
    ell(4, 5, 6, 4.5, '#e8e8ec'); ell(6, 3.5, 2.2, 1.8, OUT);
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
  } else if (e.type === 'boar') {
    const c = fl ? '#fff' : '#8b5a3c', dk = fl ? '#fff' : '#5e3a24', pink = fl ? '#fff' : '#e8a5a0';
    const run = e.mode === 'charge' ? Math.sin(e.t * 28) * 3 : wob;
    for (const x of [-0.55, -0.15, 0.3, 0.7]) ell(x * r, r * 0.78 + (x > 0.2 ? run : -run) * 0.5, r * 0.14, r * 0.22, dk, OUT);
    ctx.beginPath(); ctx.moveTo(-r * 1.05, -r * 0.1); ctx.quadraticCurveTo(-r * 1.45, -r * 0.5, -r * 1.2, -r * 0.75); ctx.lineWidth = 3.5; ctx.stroke(); ctx.lineWidth = 2.5;
    ell(0, 0, r * 1.1, r * 0.85, c, OUT);
    for (let i = 0; i < 5; i++) { const x = -r * 0.8 + i * r * 0.4; polyFill([x - 3, -r * 0.72, x + 1, -r * 1.05, x + 5, -r * 0.7], dk); }
    ell(r * 0.85, r * 0.08, r * 0.5, r * 0.46, c, OUT);
    ell(r * 1.28, r * 0.2, r * 0.28, r * 0.22, pink, OUT);
    polyFill([r * 1.05, r * 0.3, r * 1.15, r * 0.66, r * 1.24, r * 0.34], fl ? '#fff' : '#f4efe0');
    polyFill([r * 0.5, -r * 0.3, r * 0.58, -r * 0.66, r * 0.82, -r * 0.34], dk);
    const ang = e.mode === 'wind' || e.mode === 'charge';
    ctx.fillStyle = ang ? '#ff3b2f' : OUT; ctx.beginPath(); ctx.arc(r * 0.88, -r * 0.1, 2.8, 0, TAU); ctx.fill();
    if (ang) { ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.3); ctx.lineTo(r * 1.04, -r * 0.16); ctx.stroke(); }
  } else if (e.type === 'bat') {
    const c = fl ? '#fff' : '#4b3f72', wing = fl ? '#fff' : '#6a5a9e', f = Math.sin(e.t * 22);
    for (const [rot, col] of [[-1.15 + f * 0.7, wing], [-0.55 + f * 0.7, c]]) {
      ctx.save(); ctx.translate(-r * 0.1, -r * 0.2); ctx.rotate(rot);
      polyFill([0, 0, -r * 0.3, -r * 1.9, -r * 0.75, -r * 1.35, -r * 1.05, -r * 1.7, -r * 1.3, -r * 0.6, -r * 0.8, -r * 0.2], col);
      ctx.restore();
    }
    ell(0, 0, r * 0.85, r * 0.75, c, OUT);
    polyFill([r * 0.1, -r * 0.6, r * 0.2, -r * 1.15, r * 0.6, -r * 0.55], c);
    polyFill([r * 0.5, -r * 0.5, r * 0.8, -r * 1.05, r * 0.9, -r * 0.35], c);
    ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.1, 2.2, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.2; polyFill([r * 0.55, r * 0.3, r * 0.65, r * 0.7, r * 0.8, r * 0.3], '#fff'); ctx.lineWidth = 2.5;
  } else if (e.type === 'bomber') {
    const c = fl ? '#fff' : '#c9b8a6', near = e.hunter, blink = Math.sin(e.t * (near ? 34 : 16)) > 0;
    ctx.beginPath(); ctx.moveTo(-r, 4); ctx.quadraticCurveTo(-r - 12, 8 + wob, -r - 16, -2); ctx.strokeStyle = '#e59aa0'; ctx.stroke(); ctx.strokeStyle = OUT;
    ell(-5, -r + 1, 6, 6, c, OUT); ell(6, -r, 6, 6, c, OUT);
    ell(0, 0, r, r * 0.85, c, OUT);
    for (const dx of [-7, -1, 5]) { ctx.fillStyle = fl ? '#fff' : '#d9382c'; ctx.fillRect(-r * 0.55 + dx, -r * 1.25, 5, r * 0.75); ctx.strokeRect(-r * 0.55 + dx, -r * 1.25, 5, r * 0.75); }
    ctx.fillStyle = OUT; ctx.fillRect(-r * 0.55 - 7, -r * 0.95, 17, 2.5);
    ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 1.25); ctx.quadraticCurveTo(-r * 0.2, -r * 1.7, r * 0.1, -r * 1.65); ctx.stroke();
    ell(r * 0.1, -r * 1.65, blink ? 4 : 2.5, blink ? 4 : 2.5, blink ? '#ffe066' : '#ff8a3c');
    ctx.fillStyle = '#ff3b2f'; ctx.beginPath(); ctx.arc(5, -3, 2.4, 0, TAU); ctx.fill();
    ell(r - 1, 2, 2.5, 2.5, '#ff8fa3');
  } else if (e.type === 'snake') {
    const g1 = fl ? '#fff' : '#6fbf4a', g2 = fl ? '#fff' : '#3f8f2c';
    for (let i = 8; i >= 1; i--) { const rr = r * (0.58 - i * 0.03); ell(-i * r * 0.55, Math.sin(e.t * 6 + i * 0.9) * r * 0.45, rr, rr, i % 2 ? g1 : g2, OUT); }
    const hy = Math.sin(e.t * 6) * r * 0.45;
    ell(r * 0.1, hy, r * 0.78, r * 0.6, g1, OUT);
    polyFill([r * 0.4, hy - r * 0.45, r * 0.1, hy - r * 0.2, r * 0.7, hy - r * 0.15], g2, false);
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(r * 0.4, hy - r * 0.15, 3, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = OUT; ctx.fillRect(r * 0.42, hy - r * 0.3, 1.8, r * 0.3);
    if (Math.sin(e.t * 9) > -0.2) { ctx.strokeStyle = '#e8403c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r * 0.85, hy + r * 0.1); ctx.lineTo(r * 1.4, hy + r * 0.1); ctx.moveTo(r * 1.4, hy + r * 0.1); ctx.lineTo(r * 1.65, hy - r * 0.05); ctx.moveTo(r * 1.4, hy + r * 0.1); ctx.lineTo(r * 1.65, hy + r * 0.25); ctx.stroke(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; }
  } else if (e.type === 'bear') {
    const c = fl ? '#fff' : '#5a463b', lt = fl ? '#fff' : '#c9a98a';
    ell(-r * 0.3, r * 0.88 + wob * 0.3, r * 0.3, r * 0.2, c, OUT); ell(r * 0.35, r * 0.88 - wob * 0.3, r * 0.3, r * 0.2, c, OUT);
    ell(0, r * 0.15, r * 1.05, r * 0.88, c, OUT);
    ell(-r * 0.35, -r * 1.0, r * 0.26, r * 0.26, c, OUT); ell(r * 0.7, -r * 1.0, r * 0.26, r * 0.26, c, OUT);
    ell(r * 0.2, -r * 0.55, r * 0.78, r * 0.66, c, OUT);
    ell(r * 0.55, -r * 0.38, r * 0.38, r * 0.3, lt, OUT);
    ell(r * 0.72, -r * 0.5, r * 0.11, r * 0.08, OUT);
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.78, 2.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.12, -r * 0.98); ctx.lineTo(r * 0.45, -r * 0.84); ctx.stroke();
    ell(r * 0.78, r * 0.25, r * 0.3, r * 0.26, c, OUT);
    ctx.strokeStyle = fl ? '#fff' : '#f4efe0'; ctx.lineWidth = 2; ctx.beginPath(); for (const k of [-0.1, 0.1, 0.3]) { ctx.moveTo(r * (0.9 + k * 0.4), r * 0.32); ctx.lineTo(r * (1.12 + k * 0.4), r * (0.5 + k * 0.1)); } ctx.stroke(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
  } else if (e.type === 'healer') {
    const c = fl ? '#fff' : '#f4f1ec', pk = fl ? '#fff' : '#ffb7c9';
    ellRot(-r * 0.2, -r * 1.35, r * 0.28, r * 0.75, -0.2, c, OUT); ellRot(r * 0.4, -r * 1.35, r * 0.28, r * 0.75, 0.15, c, OUT);
    ellRot(-r * 0.2, -r * 1.35, r * 0.13, r * 0.55, -0.2, pk); ellRot(r * 0.4, -r * 1.35, r * 0.13, r * 0.55, 0.15, pk);
    ell(0, r * 0.1, r, r * 0.9, c, OUT);
    ell(r * 0.35, -r * 0.45, r * 0.65, r * 0.58, c, OUT);
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.55, 2.4, 0, TAU); ctx.fill();
    ell(r * 0.9, -r * 0.35, 2.2, 1.8, '#ff8fa3');
    ctx.fillStyle = fl ? '#fff' : '#35b34a'; ctx.fillRect(-r * 0.4, r * 0.05, r * 0.7, r * 0.22); ctx.fillRect(-r * 0.16, -r * 0.2, r * 0.22, r * 0.7);
    ell(-r * 0.9, r * 0.5, r * 0.24, r * 0.24, c, OUT);
  } else if (e.type === 'slime') {
    const c = fl ? '#fff' : '#4fd6a8', lt = fl ? '#fff' : '#b6f6de', sq = 1 + Math.sin(e.t * 7) * 0.08;
    ctx.save(); ctx.translate(0, r * 0.7); ctx.scale(sq, 2 - sq); ctx.translate(0, -r * 0.7);
    ctx.beginPath(); ctx.moveTo(-r, r * 0.7); ctx.bezierCurveTo(-r * 1.15, -r * 0.95, r * 1.15, -r * 0.95, r, r * 0.7); ctx.quadraticCurveTo(0, r * 0.98, -r, r * 0.7); ctx.closePath();
    ctx.fillStyle = c; ctx.fill(); ctx.stroke();
    ellRot(-r * 0.4, -r * 0.4, r * 0.28, r * 0.14, -0.6, lt);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 0.05, -r * 0.1, r * 0.2, 0, TAU); ctx.arc(r * 0.55, -r * 0.1, r * 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.08, r * 0.1, 0, TAU); ctx.arc(r * 0.6, -r * 0.08, r * 0.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.0, -r * 0.38); ctx.lineTo(r * 0.25, -r * 0.26); ctx.moveTo(r * 0.7, -r * 0.38); ctx.lineTo(r * 0.45, -r * 0.26); ctx.stroke();
  } else if (e.type === 'elite') {
    const c = fl ? '#fff' : '#9a8672';
    const dash = e.t % 4 > 3;
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-r, 6); ctx.quadraticCurveTo(-r - 18, 12 + wob, -r - 22, -6); ctx.strokeStyle = '#e59aa0'; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = OUT;
    ctx.fillStyle = '#c8402d'; ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-r - 8, 4 + wob); ctx.lineTo(-r - 2, 16); ctx.lineTo(-4, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ell(-12, -r + 6, 9, 9, c, OUT); ell(-12, -r + 6, 4.5, 4.5, '#f5b8bd');
    ell(0, 2, r, r * 0.85, c, OUT);
    ell(4, 9, 11, 8, '#e9dccb');
    ctx.fillStyle = fl ? '#fff' : '#9aa7b5';
    ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-7, -r - 10); ctx.lineTo(19, -r - 10); ctx.lineTo(22, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(24, -8); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(6, -r - 10, 9, Math.PI, 0); ctx.stroke(); ctx.lineWidth = 3;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10, -1, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = dash ? '#c8402d' : OUT; ctx.beginPath(); ctx.arc(11, -1, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -7); ctx.lineTo(16, -3); ctx.stroke();
    ell(r - 1, 5, 3.5, 3.5, '#ff8fa3', OUT);
    ctx.fillStyle = '#fff'; ctx.fillRect(14, 10, 3, 5); ctx.strokeRect(14, 10, 3, 5);
  }
  ctx.restore();
}
function drawEnemy(e) {
  const r = e.r, T = ETIERS[e.tier || 0];
  ell(e.x, e.y + r * 0.9, r * 0.9, r * 0.3, 'rgba(0,0,0,.18)');
  if (e.tier >= 2) {
    const ga = ctx.globalAlpha; ctx.globalAlpha = ga * (0.22 + 0.08 * Math.sin(performance.now() / 180 + e.seed));
    ell(e.x, e.y + r * 0.25, r * 1.45, r * 1.2, T.tint); ctx.globalAlpha = ga;
  }
  if (e.mode === 'wind') {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.dir);
    ctx.fillStyle = `rgba(230,60,40,${0.12 + 0.2 * (1 - e.mt / 0.7)})`; ctx.fillRect(0, -r * 0.8, 380, r * 1.6);
    ctx.restore();
  }
  if (e.flash > 0) {
    const flashAmt = clamp(e.flash / 0.12, 0, 1);
    hitCtx.setTransform(2, 0, 0, 2, 0, 0);
    hitCtx.clearRect(0, 0, HIT_SZ, HIT_SZ);
    hitCtx.save();
    hitCtx.translate(HIT_HALF - e.x, HIT_HALF - e.y);
    ctxBase = hitCtx;
    ctx = hitCtx;
    try {
      if (e.tier > 0 && T.tint) drawEnemyTinted(e); else drawEnemyBody(e);
    } finally {
      ctxBase = ctxReal;
      ctx = ctxReal;
      hitCtx.restore();
    }
    ctx.drawImage(hitCanvas, e.x - HIT_HALF, e.y - HIT_HALF, HIT_SZ, HIT_SZ);
    hitCtx.save();
    hitCtx.globalCompositeOperation = 'source-in';
    hitCtx.fillStyle = '#ffffff';
    hitCtx.fillRect(0, 0, HIT_SZ, HIT_SZ);
    hitCtx.restore();
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = prevA * flashAmt * 0.88;
    ctx.drawImage(hitCanvas, e.x - HIT_HALF, e.y - HIT_HALF, HIT_SZ, HIT_SZ);
    ctx.globalAlpha = prevA;
  } else {
    if (e.tier > 0 && T.tint) drawEnemyTinted(e); else drawEnemyBody(e);
  }
  if (L.buffT.freeze > 0) {
    ctx.lineWidth = 2;
    ell(e.x, e.y - (e.type === 'boss' ? 8 : 0) - (e.z || 0), r * 1.25, r * 1.25, 'rgba(160,230,255,.45)', 'rgba(255,255,255,.9)');
  }
  if (e.stunT > 0) {
    const a0 = performance.now() / 150;
    for (let k = 0; k < 2; k++) {
      const a = a0 + k * Math.PI;
      drawStar(e.x + Math.cos(a) * (r * 0.65), e.y - r - 10 + Math.sin(a) * 4, 4.5, '#ffe066', OUT, 1.5);
    }
  }
  const big = e.type === 'boss' || e.type === 'elite';
  let top = e.y - r - 14;
  if (e.hp < e.maxHp || big || e.tier > 0) {
    const bw = e.type === 'boss' ? 104 : e.type === 'elite' ? 60 : Math.max(r * 2.1, 30);
    const bh = e.type === 'boss' ? 8 : e.type === 'elite' ? 6.5 : 5.5;
    const hitPop = e.flash > 0 ? -Math.sin(clamp(e.flash / 0.12, 0, 1) * Math.PI) * 2.5 : 0;
    const by = e.y - (e.z || 0) - (e.type === 'boss' ? (e.kind.barY || r + 34) : r + (e.type === 'elite' ? 26 : 15)) + hitPop;
    const bx = e.x - bw / 2;
    const hpPct = clamp(e.hp / e.maxHp, 0, 1);
    const trailPct = clamp((e.hpTrail !== undefined ? e.hpTrail : e.hp) / e.maxHp, hpPct, 1);
    top = by;
    if (e.type === 'boss') outlined(e.kind.name, e.x, by - 13, 14, hpPct < 0.5 ? '#ff9a8a' : '#fff');

    ctx.save();
    ctx.fillStyle = OUT;
    ctx.beginPath(); ctx.roundRect(bx - 1.5, by - 1.5, bw + 3, bh + 3, 4); ctx.fill();
    ctx.fillStyle = '#2d1e12';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();

    if (trailPct > hpPct) {
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.roundRect(bx, by, Math.max(3, bw * trailPct), bh, 3); ctx.fill();
    }
    if (hpPct > 0) {
      ctx.fillStyle = big ? '#e04836' : hpPct > 0.6 ? '#6fe06f' : hpPct > 0.28 ? '#ffb347' : '#ff5252';
      ctx.beginPath(); ctx.roundRect(bx, by, Math.max(3, bw * hpPct), bh, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.roundRect(bx + 1, by + 0.8, Math.max(2, bw * hpPct - 2), Math.max(1.2, bh * 0.3), 1.5); ctx.fill();
    }
    if (e.flash > 0) {
      ctx.globalAlpha = clamp(e.flash / 0.12, 0, 1) * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
    }
    ctx.restore();
  }
  for (let i = 0; i < e.tier; i++) drawStar(e.x + (i - (e.tier - 1) / 2) * 12, top - 9, 5.5, T.bar, OUT, 1.5);
  if (e.hunter && !big) {
    const mx = e.x, my = top - (e.tier > 0 ? 24 : 11);
    ctx.lineCap = 'round';
    for (const [col, w] of [['#fff', 4.5], ['#ff3b2f', 2.2]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(mx, my, 5, 0, TAU);
      ctx.moveTo(mx - 9, my); ctx.lineTo(mx - 3, my); ctx.moveTo(mx + 3, my); ctx.lineTo(mx + 9, my);
      ctx.moveTo(mx, my - 9); ctx.lineTo(mx, my - 3); ctx.moveTo(mx, my + 3); ctx.lineTo(mx, my + 9); ctx.stroke();
    }
  }
  if (e.mode === 'wind') outlined('!', e.x, top - (e.hunter ? 30 : 16), 22, '#ff3b2f');
}
function flashStar(x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16, rr = i % 2 ? r * 0.38 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
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
  if (b.kind === 'missile') {   // 导弹：白色弹身、红色弹头和尾翼，尾部喷火
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
    ell(-15, 0, 7 + Math.random() * 3, 3.5, '#ffb347'); ell(-13, 0, 4, 2, '#fff7b0');
    ctx.lineWidth = 1.5; ctx.strokeStyle = OUT;
    polyFill([-9, -7, -3, 0, -9, 7], '#c8402d');
    ctx.fillStyle = '#eef1f4'; ctx.beginPath(); ctx.roundRect(-10, -3.5, 18, 7, 3); ctx.fill(); ctx.stroke();
    polyFill([8, -3.5, 14, 0, 8, 3.5], '#e8483f');
    ctx.restore();
    return;
  }
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
function updateItemBar() {
  const ms = ibEls.missile, mLeft = L.missileLeft, mOk = G.stats.nestHp >= 3 || mLeft > 0, msig = `${mOk}|${mLeft}`;
  if (ms.sig !== msig) {
    ms.sig = msig; ms.el.style.display = mOk ? '' : 'none';
    const ct = ms.el.querySelector('.ct'); ct.textContent = '×' + mLeft; ct.classList.toggle('zero', mLeft <= 0);
    ms.el.classList.toggle('cooling', mLeft <= 0);
  }
  const eq = G.eq, w = ibEls.weapon, wsig = eq.id + ':' + eq.tier;
  if (w.sig !== wsig) {
    w.sig = wsig;
    w.el.querySelector('img').src = ICONS.url[eq.id];
    w.el.querySelector('.tierb').innerHTML = tierBadge(eq.tier);
  }
  for (const it of ITEMS) {
    const x = ibEls[it.id], st = G.items[it.id], on = L.on[it.id] || 0;
    const unlocked = isItemUnlocked(it.id);
    const active = it.id === 'catnip' && L.catnipT > 0;
    const cool = it.id === 'catnip' ? Math.ceil(Math.max(0, active ? L.catnipT : L.catnipCd)) : it.id === 'shockwave' ? Math.ceil(Math.max(0, L.shockwaveCd)) : 0;
    const show = unlocked && (it.manual ? st.n > 0 : on > 0);
    const sig = `${show}|${st.lv}|${on}|${cool}|${active}`;
    if (x.sig === sig) continue;
    x.sig = sig;
    x.el.style.display = show ? '' : 'none';
    const ct = x.el.querySelector('.ct');
    ct.textContent = `Lv${st.lv}`; ct.classList.remove('zero');
    const num = x.el.querySelector('.num'); if (num) num.textContent = on > 1 ? on + it.unit : '';
    x.el.classList.toggle('on', it.manual ? active : on > 0);
    x.el.classList.toggle('cooling', it.manual && cool > 0 && !active);
    const cd = x.el.querySelector('.cd');
    cd.textContent = cool > 0 ? cool + '秒' : ''; cd.style.display = cool > 0 ? 'flex' : 'none';
  }
}

function drawTopComboBar() {
  if (!L || state !== 'playing') return;
  const bw = Math.min(560, W - 20);
  const bh = 6;
  const bx = (W - bw) / 2;
  const by = 1;
  const active = L.combo > 0 && L.comboT > 0;
  const pct = active ? clamp(L.comboBarVis, 0, 1) : 0;
  const breaking = !active && L.comboBreakT > 0;
  const ct = active ? comboTier(L.combo) : null;
  const urgent = active && (L.comboT / COMBO_WINDOW) < 0.3;

  ctx.save();
  // 背景细长轨道：空闲时低透明度待命，连击或耗尽闪烁时高亮
  ctx.globalAlpha = active ? 0.96 : breaking ? clamp(L.comboBreakT / 0.35, 0.35, 1) : 0.42;
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.roundRect(bx - 1, by - 0.5, bw + 2, bh + 1.5, 4); ctx.fill();
  ctx.fillStyle = breaking ? '#5a1b18' : '#2d1e12';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3.5); ctx.fill();

  if (active && pct > 0) {
    const fw = Math.max(5, bw * pct);
    if (urgent) {
      ctx.fillStyle = Math.sin(performance.now() / 65) > 0 ? '#ff4d4d' : '#ff9a8a';
    } else {
      const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, ct.color);
      grad.addColorStop(1, ct.bar);
      ctx.fillStyle = grad;
    }
    ctx.beginPath(); ctx.roundRect(bx, by, fw, bh, 3.5); ctx.fill();

    // 顶部高光条与右端衰减光点
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.roundRect(bx + 1, by + 0.8, Math.max(2, fw - 2), 1.8, 1); ctx.fill();

    const tipX = bx + fw;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(tipX, by + bh / 2, 2.6, 0, TAU); ctx.fill();

    if (L.comboPop > 0) {
      ctx.globalAlpha = L.comboPop * 0.55;
      ctx.fillStyle = '#fff7b0';
      ctx.beginPath(); ctx.roundRect(bx, by, fw, bh, 3.5); ctx.fill();
    }
  } else if (breaking) {
    ctx.strokeStyle = '#ff5e5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3.5); ctx.stroke();
  }
  ctx.restore();
}

function drawComboMeter(narrow) {
  if (!L || L.combo <= 0 || L.comboT <= 0 || state !== 'playing') return;
  const ct = comboTier(L.combo);
  const pct = clamp(L.comboT / COMBO_WINDOW, 0, 1);
  const w = narrow ? 148 : 176, h = 58;
  const rx = W - 12 - w, ry = narrow ? 108 : 74;
  const popScale = 1 + 0.16 * Math.sin(L.comboPop * Math.PI * 0.5);
  const alpha = L.comboT < 0.4 ? clamp(L.comboT / 0.4, 0, 1) : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(rx + w / 2, ry + h / 2);
  ctx.scale(popScale, popScale);
  ctx.translate(-w / 2, -h / 2);

  // 卡片阴影与主体
  ctx.fillStyle = 'rgba(74, 52, 35, 0.35)';
  ctx.beginPath(); ctx.roundRect(0, 4, w, h, 14); ctx.fill();

  if (L.combo >= 30) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#5a1840'); g.addColorStop(0.5, '#3b1c68'); g.addColorStop(1, '#5c2d12');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = ct.bg;
  }
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 14); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();

  if (L.combo >= 5) {
    ctx.save();
    ctx.strokeStyle = ct.color;
    ctx.globalAlpha = alpha * (0.45 + 0.25 * Math.sin(performance.now() / 110));
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(3, 3, w - 6, h - 6, 11); ctx.stroke();
    ctx.restore();
  }

  // 连击数 + "连击"
  const numStr = `${L.combo}`;
  ctx.font = `900 ${narrow ? 22 : 24}px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
  ctx.strokeText(numStr, 11, 20);
  ctx.fillStyle = ct.color;
  ctx.fillText(numStr, 11, 20);
  const numW = ctx.measureText(numStr).width;

  ctx.font = `bold ${narrow ? 12 : 13}px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.lineWidth = 3; ctx.strokeStyle = OUT;
  ctx.strokeText('连击', 14 + numW, 22);
  ctx.fillStyle = '#fff6df';
  ctx.fillText('连击', 14 + numW, 22);

  // 倍率徽章
  const multText = `×${ct.mult.toFixed(1)}`;
  ctx.font = `900 ${narrow ? 11 : 12}px sans-serif`;
  const mw = Math.max(40, ctx.measureText(multText).width + 12);
  const mx = w - mw - 9, my = 8, mh = 20;
  ctx.fillStyle = L.combo >= 2 ? ct.color : '#fbe6bd';
  ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 9); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.fillStyle = OUT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(multText, mx + mw / 2, my + mh / 2 + 0.5);

  // 状态名 & 最近加分
  ctx.font = `bold 11px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = ct.color;
  ctx.fillText(ct.label, 11, 38);
  if (L.lastComboPts > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(`+${L.lastComboPts}分`, w - 10, 38);
  }

  // 倒计时能量条
  const bx = 10, by = h - 12, bw = w - 20, bh = 7;
  ctx.fillStyle = '#2d1e12';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 4); ctx.fill();
  if (pct > 0) {
    const fw = Math.max(6, bw * pct);
    const urgent = pct < 0.3;
    ctx.fillStyle = urgent ? (Math.sin(performance.now() / 65) > 0 ? '#ff5e5e' : '#ff9a8a') : ct.bar;
    ctx.beginPath(); ctx.roundRect(bx, by, fw, bh, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.roundRect(bx + 1, by + 1, Math.max(2, fw - 2), 2.5, 2); ctx.fill();
  }

  ctx.restore();
}

function drawComboSplash(narrow) {
  if (!L || !L.comboSplash || L.comboSplash.t <= 0 || state !== 'playing') return;
  const s = L.comboSplash;
  const p = clamp(1 - s.t / s.dur, 0, 1);
  let sc = 1;
  if (p < 0.16) {
    const u = p / 0.16;
    sc = 0.35 + 0.95 * (1 - Math.pow(1 - u, 3));
  } else if (p < 0.30) {
    const u = (p - 0.16) / 0.14;
    sc = 1.30 - 0.30 * u;
  } else if (p < 0.72) {
    sc = 1.0 + 0.04 * Math.sin((p - 0.30) * 18);
  } else {
    const u = (p - 0.72) / 0.28;
    sc = 1.0 + 0.22 * u;
  }
  const alpha = p < 0.08 ? p / 0.08 : p > 0.72 ? clamp(1 - (p - 0.72) / 0.28, 0, 1) : 1;
  const dy = p > 0.72 ? -26 * ((p - 0.72) / 0.28) : 0;
  const cx = W / 2, cy = H * 0.38 + dy;

  ctx.save();
  ctx.translate(cx, cy);

  // 中心扩散光环与柔光背景
  const ringP = Math.min(1, p / 0.55);
  if (ringP < 1) {
    ctx.save();
    ctx.globalAlpha = alpha * (1 - ringP) * 0.55;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(2, 6 * (1 - ringP));
    ctx.beginPath();
    ctx.arc(0, 0, (narrow ? 48 : 66) + ringP * (narrow ? 72 : 105), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalAlpha = alpha * 0.32;
  const glowR = narrow ? 92 : 128;
  const rg = ctx.createRadialGradient(0, 0, 8, 0, 0, glowR);
  rg.addColorStop(0, s.color);
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg;
  ctx.beginPath(); ctx.arc(0, 0, glowR, 0, TAU); ctx.fill();

  ctx.globalAlpha = alpha;
  ctx.scale(sc, sc);

  const numSz = narrow ? 44 : 58;
  const tagSz = narrow ? 20 : 26;
  ctx.font = `900 ${numSz}px "PingFang SC","Microsoft YaHei",sans-serif`;
  const numStr = `${s.combo}`;
  const numW = ctx.measureText(numStr).width;
  ctx.font = `900 ${tagSz}px "PingFang SC","Microsoft YaHei",sans-serif`;
  const tagStr = ' 连击!';
  const tagW = ctx.measureText(tagStr).width;
  const totalW = numW + tagW;
  const startX = -totalW / 2;

  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.font = `900 ${numSz}px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.lineWidth = Math.max(6, numSz / 6); ctx.strokeStyle = OUT;
  ctx.strokeText(numStr, startX, -4);
  ctx.fillStyle = s.color;
  ctx.fillText(numStr, startX, -4);

  ctx.font = `900 ${tagSz}px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.lineWidth = Math.max(4, tagSz / 5); ctx.strokeStyle = OUT;
  ctx.strokeText(tagStr, startX + numW, 4);
  ctx.fillStyle = '#fff6df';
  ctx.fillText(tagStr, startX + numW, 4);

  outlined(`${s.label} · ×${s.mult.toFixed(1)} 积分`, 0, narrow ? 28 : 35, narrow ? 15 : 18, '#ffe9a8', 'center');
  ctx.restore();
}

function drawComboPenalty(narrow) {
  if (!L || !L.comboBreak || L.comboBreak.t <= 0 || state !== 'playing') return;
  const b = L.comboBreak;
  const p = clamp(1 - b.t / b.dur, 0, 1);
  // 短暂淡入（0~0.18）-> 停留 -> 平滑淡出（0.45~1.0）
  const alpha = p < 0.18 ? p / 0.18 : p > 0.45 ? clamp(1 - (p - 0.45) / 0.55, 0, 1) : 1;
  const dropY = p * 14;
  const jx = p < 0.25 ? Math.sin(p * 85) * 4 * (1 - p / 0.25) : 0;

  ctx.save();
  // 四周暗红冷却边缘闪光，制造连击中断的紧迫惩罚感
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(30, 10, 12, 0)');
  vg.addColorStop(1, `rgba(175, 36, 42, ${0.26 * alpha})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = alpha;
  const cx = W / 2 + jx, cy = H * 0.29 + dropY;
  outlined('连击重置！', cx, cy, narrow ? 24 : 30, '#ff8b85', 'center');
  outlined(`${b.combo} 连击 · ×${b.mult.toFixed(1)} 积分已清空`, cx, cy + (narrow ? 24 : 28), narrow ? 13 : 15, '#ffd7d2', 'center');
  ctx.restore();
}

function drawHUD() {
  // 连击 >= 20 高燃战斗边缘氛围晕影
  if (L && L.comboFilter > 0.02 && state === 'playing') {
    const f = L.comboFilter;
    const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 110);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.76);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, L.combo >= 30
      ? `rgba(255, 72, 158, ${0.22 * f * pulse})`
      : `rgba(168, 92, 255, ${0.18 * f * pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // 答对中文题后的慢镜头特写边缘金光氛围晕影
  if (L && L.redRageT > 0 && state === 'playing') {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(255, 0, 0, 0)');
    g.addColorStop(1, `rgba(255, 190, 40, ${0.26 + 0.08 * Math.sin(performance.now() / 80)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const bw = Math.min(150, W * 0.34);
  hudBar(8, 8, bw, '猫咪', L.cat.hp, catMaxHp(), '#ff7a8a');
  hudBar(8, 30, bw, '猫窝', G.nestHp, nestMaxHp(), '#ffb347');
  const narrow = W < 520, cx = narrow ? W - 58 : W / 2;
  const al = narrow ? 'right' : 'center';
  outlined(`第 ${G.level} 关`, cx, 18, 17, '#fff', al);
  if (L.time > 0) outlined(`${Math.ceil(L.time)} 秒`, cx, 42, 22, L.time <= 10 ? '#ffe066' : '#fff', al);
  else outlined(L.boss ? '打败头目！' : '过关！', cx, 42, 20, L.boss ? '#ff9a8a' : '#c9ff9e', al);
  outlined(`🐟 ${G.fish}`, narrow ? W - 58 : W - 60, narrow ? 68 : 26, 18, '#ffe9a8', 'right');
  outlined(`⭐ ${G.score}`, narrow ? W - 58 : W - 60, narrow ? 90 : 50, 15, '#ffe066', 'right');
  drawTopComboBar();
  drawComboMeter(narrow);
  drawComboSplash(narrow);
  drawComboPenalty(narrow);
  const w = weaponDef(G.eq.id);
  let y = 66;
  ctx.drawImage(ICONS.canvas[w.id], 8, y - 15, 30, 30);
  outlined(w.name, 42, y, 14, '#fff', 'left');
  drawTierBadge(42 + ctx.measureText(w.name).width + 8, y, G.eq.tier);
  y += 28;
  if (L.atkBuff > 0) { outlined(`攻击力 +${Math.round(L.atkBuff * 100)}%`, 10, y, 14, '#ffe066', 'left'); y += 24; }
  if (L.redRageT > 0) {
    outlined(`✨ 金光觉醒 ${L.redRageT.toFixed(1)}秒`, 10, y, 15, '#ffe066', 'left');
    y += 26;
  }
  for (const b of BUFFS) {
    const t = L.buffT[b.id];
    if (!(t > 0)) continue;
    ctx.lineWidth = 2; ell(22, y, 11, 11, b.color, OUT);
    outlined(b.ch, 22, y + 1, 13);
    outlined(`${b.name} ${Math.ceil(t)}秒`, 42, y, 14, '#fff', 'left');
    y += 26;
  }
  updateItemBar();
  if (L.toast) { ctx.globalAlpha = clamp(L.toast.t, 0, 1); outlined(L.toast.text, W / 2, H * 0.74, 15, '#fff'); ctx.globalAlpha = 1; }

  if (L.banner > 0 && state !== 'clear') {
    ctx.globalAlpha = clamp(L.banner, 0, 1);
    outlined(`第 ${G.level} 关`, W / 2, H * 0.3, 46, '#ffe066');
    outlined(L.isBoss ? '头目关！头目将在关卡最后登场' : '保卫猫窝！', W / 2, H * 0.3 + 44, 20);
    ctx.globalAlpha = 1;
  }
  const effScale = scale * camZoom;
  if (state !== 'clear') for (const e of L.enemies) {
    if (e.type !== 'boss' && e.type !== 'elite') continue;
    const sx = (e.x - cam.x) * effScale, sy = (e.y - cam.y) * effScale;
    if (sx < 0 || sx > W || sy < 0 || sy > H) {
      const a = Math.atan2(sy - H / 2, sx - W / 2);
      const px = clamp(W / 2 + Math.cos(a) * W, 36, W - 36), py = clamp(H / 2 + Math.sin(a) * H, 90, H - 30);
      outlined(e.type === 'boss' ? e.kind.name : '小头目', px, py, 15, '#ff9a8a');
    }
  }
  if (L.notice) {
    ctx.font = 'bold 26px "PingFang SC","Microsoft YaHei",sans-serif';
    const nw = ctx.measureText(L.notice.text).width, nz = Math.floor(26 * Math.min(1, (W - 24) / nw));
    ctx.globalAlpha = clamp(L.notice.t, 0, 1); outlined(L.notice.text, W / 2, H * 0.24, nz, L.notice.color || '#ff9a8a'); ctx.globalAlpha = 1;
  }
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
    if (t > 1.0) { ctx.globalAlpha = clamp((t - 1.0) * 3, 0, 1); outlined(`猫咪受伤 ${Math.round(G.lastCatLoss * 100)}%  猫窝受伤 ${Math.round(G.lastNestLoss * 100)}%`, cx, lay.y0 + 188 * u, 16 * u, '#fff'); ctx.globalAlpha = 1; }
    if (t > tInfo - 0.2) {
      ctx.globalAlpha = clamp((t - tInfo + 0.2) * 3, 0, 1);
      outlined(['', '再稳一点就能拿更多星！', '不错！', '完美！'][G.lastStars], cx, lay.y0 + 216 * u, 22 * u, G.lastStars === 3 ? '#ffe066' : '#fff');
      outlined(`过关奖励 +${G.lastBonus} 🐟${G.lastStarBonus ? `  星级奖励 +${G.lastStarBonus} 🐟` : ''}`, cx, lay.y0 + 244 * u, 17 * u, '#ffe9a8');
      outlined(`本关积分 +${L.levelScore}${L.levelMaxCombo >= 2 ? `  最高连击 ${L.levelMaxCombo}` : ''}  总积分 ${G.score}`, cx, lay.y0 + 270 * u, 15 * u, '#fff');
      ctx.globalAlpha = 1;
    }
    if (t > STARS_DONE) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6); outlined('点击屏幕继续', cx, H * 0.86, 15, '#fff'); ctx.globalAlpha = 1; }
  }
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
  const effScale = scale * camZoom;
  const vw = W / effScale, vh = H / effScale;
  const focus = L ? L.cat : NEST;
  cam.x = vw >= WORLD.w ? (WORLD.w - vw) / 2 : clamp(focus.x - vw / 2, 0, WORLD.w - vw);
  cam.y = vh >= WORLD.h ? (WORLD.h - vh) / 2 : clamp(focus.y - vh / 2, 0, WORLD.h - vh);
  let shx = 0, shy = 0;
  if (L && state === 'playing') {
    if (L.shake > 0) {
      const amp = L.combo >= 30 ? 6.5 : L.combo >= 20 ? 5.2 : 4;
      shx += rand(-amp, amp); shy += rand(-amp, amp);
    }
    if (L.combo >= 20) {
      const hum = L.combo >= 30 ? 1.8 : 1.1;
      shx += rand(-hum, hum); shy += rand(-hum, hum);
    }
  }
  ctx.save();
  if ('filter' in ctx) {
    if (L && L.comboFilter > 0.02 && state === 'playing') {
      const f = L.comboFilter;
      ctx.filter = `saturate(${(1 + 0.22 * f).toFixed(3)}) contrast(${(1 + 0.06 * f).toFixed(3)}) hue-rotate(${(-10 * f).toFixed(2)}deg)`;
    } else {
      ctx.filter = 'none';
    }
  }
  ctx.scale(effScale, effScale); ctx.translate(-cam.x + shx, -cam.y + shy);
  drawGround();
  drawAmbientMotes(vw, vh);
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
    else { ell(b.x, b.y, b.r, b.r, b.col || '#5b4a6b', OUT); ell(b.x - 1.5, b.y - 1.5, 2, 2, b.col ? '#e8ffd8' : '#b8a8c8'); }
  }
  for (const p of L.parts) {
    if (p.color === 'boom') {
      ctx.globalAlpha = clamp(p.life / 0.25, 0, 1) * 0.6;
      ell(p.x, p.y, p.r * (1.1 - p.life * 2), p.r * (1.1 - p.life * 2), '#ffcf70');
    } else if (p.k === 'spark') {
      ctx.globalAlpha = clamp(p.life * 6, 0, 1); ctx.strokeStyle = p.color; ctx.lineWidth = p.r; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke();
    } else if (p.k === 'redbeam') {
      ctx.globalAlpha = clamp(p.life / (p.max || 0.7), 0, 1) * 0.85;
      ctx.strokeStyle = p.color; ctx.lineWidth = p.r * 0.7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + 18); ctx.stroke();
      ell(p.x, p.y, p.r * 0.6, p.r * 0.6, '#fff7b0');
    } else if (p.k === 'flash') {
      const q = p.life / p.max; ctx.globalAlpha = clamp(q * 1.5, 0, 1);
      flashStar(p.x, p.y, p.r * (1.3 - 0.5 * q), p.color);
    } else if (p.k === 'cstar') {
      const q = clamp(p.life / (p.max || 0.45), 0, 1);
      ctx.globalAlpha = clamp(q * 1.4, 0, 1);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((1 - q) * (p.spin || 3));
      drawStar(0, 0, p.r * (0.45 + 0.65 * q), p.color, OUT, 1.5);
      ctx.restore();
    } else {
      ctx.globalAlpha = clamp(p.life * 3, 0, 1);
      ell(p.x, p.y, p.r, p.r, p.color);
    }
  }
  ctx.globalAlpha = 1;
  for (const t of L.texts) { ctx.globalAlpha = clamp(t.life * 2, 0, 1); outlined(t.text, t.x, t.y, t.size, t.color); }
  ctx.globalAlpha = 1;
  ctx.restore();
  if ('filter' in ctx) ctx.filter = 'none';
  drawHUD();
}

// ---------- 主循环 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === 'playing' || state === 'clear' || state === 'menu') ambientT += dt;
  if (state === 'playing') update(dt);
  else if (state === 'clear') updateClear(dt);
  render();
  requestAnimationFrame(frame);
}
refreshToggles();
setState('menu');
requestAnimationFrame(frame);

// 调试接口
window.__cat = { get G() { return G; }, get L() { return L; }, get state() { return state; }, get exam() { return exam; }, set auto(v) { touchMode = v; }, update, startLevel, applyBuff, levelClear, rateLevel, weaponStats, mergeAll, ilv, spawnEnemy, useShockwave, triggerRedRage, openReviveExam, showUnlock, makeMiniQuestion, shopAction, openShop, makeExamQuestion, openQuiz, openMini, get mini() { return mini; }, get quiz() { return quiz; } };
})();
