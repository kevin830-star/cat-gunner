// 宠物学院大乱斗：主程序（玩家存档、界面、对战）
'use strict';

// ================= 小工具 =================
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let SPEED = 1;                                         // 测试时可以调快
const sleep = ms => new Promise(r => setTimeout(r, ms * SPEED));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

function toast(text) {
  const t = $('#toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- 语音（中文） ----------
let zhVoice = null;
function pickVoice() {
  if (!window.speechSynthesis) return;
  const vs = speechSynthesis.getVoices();
  zhVoice = vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
}
if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text) {
  if (!P || !P.settings.voice || !window.speechSynthesis || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ''));
    u.lang = 'zh-CN'; u.rate = 0.95; if (zhVoice) u.voice = zhVoice;
    speechSynthesis.speak(u);
  } catch (e) { /* 有的浏览器不支持 */ }
}

// ---------- 音效 ----------
SFX.setMuted(() => !P || !P.settings.sound);
const sfx = name => SFX.play(name);
SFX.add('tap', 40, ({ tone }) => tone(880, 0.05, { type: 'sine', vol: 0.08 }));
SFX.add('fire', 0, ({ tone, noise }) => { noise(0.5, { freq: 1800, to: 300, vol: 0.32 }); tone(160, 0.4, { type: 'sawtooth', to: 70, vol: 0.12 }); });
SFX.add('water', 0, ({ tone }) => { for (let i = 0; i < 5; i++) tone(500 + Math.random() * 500, 0.09, { type: 'sine', to: 1200, vol: 0.12, delay: i * 0.06 }); });
SFX.add('grass', 0, ({ noise, tone }) => { noise(0.35, { freq: 3000, to: 6000, type: 'highpass', vol: 0.2 }); tone(660, 0.15, { type: 'triangle', to: 990, vol: 0.06 }); });
SFX.add('thunder', 0, ({ noise, tone }) => { noise(0.08, { freq: 6000, type: 'highpass', vol: 0.5 }); noise(0.7, { freq: 800, to: 90, vol: 0.45, delay: 0.05 }); tone(90, 0.5, { type: 'sawtooth', to: 40, vol: 0.2, delay: 0.05 }); });
SFX.add('light', 0, ({ arp }) => arp([1319, 1568, 2093, 2637], 0.05, { type: 'triangle', vol: 0.1, dur: 0.2 }));
SFX.add('dark', 0, ({ tone, noise }) => { tone(300, 0.45, { type: 'sawtooth', to: 70, vol: 0.14 }); noise(0.4, { freq: 400, to: 1500, type: 'bandpass', vol: 0.2 }); });
SFX.add('hit', 30, ({ tone, noise }) => { tone(140, 0.18, { type: 'sine', to: 50, vol: 0.4 }); noise(0.12, { freq: 1200, to: 200, vol: 0.3 }); });
SFX.add('crit', 0, ({ tone, noise }) => { tone(120, 0.35, { type: 'sine', to: 35, vol: 0.55 }); noise(0.3, { freq: 2500, to: 200, vol: 0.4 }); tone(1568, 0.25, { type: 'triangle', vol: 0.12, delay: 0.05 }); });
SFX.add('faint', 0, ({ tone }) => { tone(520, 0.5, { type: 'triangle', to: 120, vol: 0.16 }); });
SFX.add('dodge', 0, ({ noise, tone }) => { noise(0.25, { freq: 900, to: 3500, type: 'bandpass', vol: 0.25 }); tone(700, 0.12, { type: 'sine', to: 1400, vol: 0.08 }); });
SFX.add('shield', 0, ({ arp }) => arp([523, 784, 1047], 0.06, { type: 'sine', vol: 0.12, dur: 0.3 }));
SFX.add('buff', 0, ({ arp }) => arp([392, 523, 659, 784, 1047], 0.05, { type: 'square', vol: 0.06, dur: 0.12 }));
SFX.add('levelup', 0, ({ arp }) => arp([523, 659, 784, 1047, 1319, 1568], 0.08, { type: 'triangle', vol: 0.15, dur: 0.22 }));
SFX.add('join', 0, ({ arp, tone }) => { arp([392, 523, 659, 784, 659, 784, 1047], 0.11, { type: 'triangle', vol: 0.15, dur: 0.25 }); tone(130, 0.9, { type: 'sine', vol: 0.15 }); });
SFX.add('ult', 0, ({ tone, noise }) => { tone(110, 1.0, { type: 'sawtooth', to: 880, vol: 0.18 }); noise(1.1, { freq: 300, to: 5000, type: 'bandpass', vol: 0.25 }); });
SFX.add('boom', 0, ({ tone, noise }) => { tone(80, 0.8, { type: 'sine', to: 28, vol: 0.6 }); noise(0.9, { freq: 1500, to: 80, vol: 0.6 }); });
SFX.add('win', 0, ({ arp }) => arp([523, 523, 784, 784, 1047, 988, 1047, 1319], 0.12, { type: 'square', vol: 0.08, dur: 0.18 }));
SFX.add('lose', 0, ({ arp }) => arp([523, 466, 392, 330], 0.2, { type: 'triangle', vol: 0.12, dur: 0.3 }));
SFX.add('enter', 0, ({ noise, tone }) => { noise(0.3, { freq: 600, to: 2400, type: 'bandpass', vol: 0.2 }); tone(330, 0.2, { type: 'triangle', to: 660, vol: 0.1, delay: 0.15 }); });
SFX.add('tick', 0, ({ tone }) => tone(1200, 0.04, { type: 'square', vol: 0.05 }));
SFX.add('coin', 60, ({ tone }) => { tone(1500, 0.06, { type: 'square', vol: 0.06 }); tone(2000, 0.1, { type: 'square', vol: 0.06, delay: 0.06 }); });
document.addEventListener('pointerdown', () => SFX.init(), { capture: true });

// 宠物头像图片（缓存成 dataURL）
const imgCache = {};
const petImg = (look, px = 96, form = 0) => imgCache[look + px + '_' + form] || (imgCache[look + px + '_' + form] = PetArt.portrait(look, px, form).toDataURL());

// ================= 存档 =================
const KEY = 'petAcademy';
let store = (() => { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.profiles)) return d; } catch (e) { /* 坏存档 */ } return { profiles: [], last: null }; })();
let P = null;   // 当前玩家
// 第 1 版的存档没有星级、进化、装备、宠物蛋，这里补上
function normalizeProfile(p) {
  for (const x of p.pets) { x.star = x.star || 1; x.form = x.form || 0; }
  p.gear = p.gear || [];
  p.eggs = Object.assign({ normal: 0, rare: 0 }, p.eggs || {});
  p.items = Object.assign({ potion: 0, bubble: 0, candy: 0, feather: 0, expCandy: 0 }, p.items || {});
  p.stats = p.stats || { q: 0, right: 0 };
  return p;
}
store.profiles.forEach(normalizeProfile);
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 隐私模式 */ } }
function newProfile(name, avatar, gradeZh, gradeMath) {
  const p = {
    id: uid(), name, avatar, gradeZh, gradeMath, coins: 50, pets: [], team: [], starter: null,
    items: { potion: 2, bubble: 0, candy: 0, feather: 0, expCandy: 0 }, gear: [], eggs: { normal: 0, rare: 0 },
    stages: {}, badges: [], stats: { q: 0, right: 0 },
    settings: { timer: 'normal', pinyin: gradeZh <= 3, voice: true, sound: true }, created: Date.now(),
  };
  store.profiles.push(p); store.last = p.id; save();
  return p;
}
function addPet(sp, lv) {
  const pet = { uid: uid(), sp, lv, exp: 0, star: 1, form: 0 };
  P.pets.push(pet);
  if (P.team.length < 3) P.team.push(pet.uid);
  return pet;
}
const petByUid = id => P.pets.find(p => p.uid === id);
const ownsSpecies = sp => P.pets.some(p => p.sp === sp);
function giveExp(pet, n) {
  const from = pet.lv;
  pet.exp += n;
  while (pet.lv < MAX_LEVEL && pet.exp >= expNeed(pet.lv)) { pet.exp -= expNeed(pet.lv); pet.lv++; }
  if (pet.lv >= MAX_LEVEL) pet.exp = 0;
  return { from, to: pet.lv };
}
const teamBonus = sps => new Set(sps.map(sp => PETS[sp].sub)).size >= 2;
const petName = p => formName(p.sp, p.form || 0);
function gearBonus(id) { const g = { hp: 0, atk: 0, def: 0 }; for (const it of P.gear) if (it.on === id) g[GEAR[it.type].stat] += GEAR_BONUS[it.lv]; return g; }
const petFull = p => petStats(p.sp, p.lv, { star: p.star, form: p.form, gearBonus: gearBonus(p.uid) });
const foeForm = lv => (lv >= EVOLVE_LV[1] ? 2 : lv >= EVOLVE_LV[0] ? 1 : 0);   // 对手到了进化等级也会进化
const starStr = n => '★'.repeat(n || 1);
const rarityTag = sp => { const r = RARITY[PETS[sp].rarity || 'N']; return `<span class="rar" style="background:${r.color}">${r.name}</span>`; };
const timerSec = () => (TIMERS.find(t => t.id === P.settings.timer) || TIMERS[1]).sec;

// ================= 界面切换 =================
let screen = null;
function go(name) {
  if (name !== 'profiles' && name !== 'newprofile' && !P) name = 'profiles';
  screen = name;
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 's-' + name));
  (RENDER[name] || (() => {}))();
  $$('[data-coins]').forEach(e => { e.textContent = `🪙 ${P ? P.coins : 0}`; });
  window.scrollTo(0, 0);
}
const RENDER = {};
let npState = {};

RENDER.profiles = () => {
  const list = $('#profileList');
  list.innerHTML = store.profiles.map((p, i) => `
    <div class="pcard" data-act="pickProfile" data-id="${p.id}" style="animation-delay:${i * 0.06}s">
      <div class="av">${p.avatar}</div>
      <div class="info"><b>${esc(p.name)}</b><small>📖 ${GRADES[p.gradeZh - 1]} · 🔢 ${GRADES[p.gradeMath - 1]}</small>
        <small>${p.badges.length ? p.badges.join(' ') : '还没有徽章'} · 🪙 ${p.coins}</small></div>
      <div class="team">${p.team.map(id => { const pet = p.pets.find(x => x.uid === id); return pet ? `<img src="${petImg(pet.sp, 64, pet.form)}" width="40" height="40" alt="">` : ''; }).join('')}</div>
    </div>`).join('') + `<div class="pcard add" data-go="newprofile">＋ 新玩家</div>`;
};

RENDER.newprofile = () => {
  npState = { avatar: AVATARS[store.profiles.length % AVATARS.length], zh: 3, math: 3 };
  $('#npName').value = '';
  drawNewProfile();
};
function drawNewProfile() {
  $('#npAvatars').innerHTML = AVATARS.map(a => `<button class="chip ${a === npState.avatar ? 'on' : ''}" data-act="npAvatar" data-v="${a}">${a}</button>`).join('');
  $('#npZh').innerHTML = GRADES.map((g, i) => `<button class="chip ${i + 1 === npState.zh ? 'on' : ''}" data-act="npZh" data-v="${i + 1}">${g}</button>`).join('');
  $('#npMath').innerHTML = GRADES.map((g, i) => `<button class="chip ${i + 1 === npState.math ? 'on' : ''}" data-act="npMath" data-v="${i + 1}">${g}</button>`).join('');
}

RENDER.starter = () => {
  $('#starterList').innerHTML = STARTERS.map((sp, i) => {
    const d = PETS[sp], E = ELEMENTS[d.el], S = SUBJECTS[d.sub];
    return `<div class="scard" data-act="pickStarter" data-sp="${sp}" style="animation-delay:${i * 0.1}s">
      <canvas class="pet live" data-look="${sp}"></canvas>
      <div><h3>${d.name}</h3>
        <p><span class="tag" style="background:${E.light}">${E.icon} ${E.name}属性</span><span class="tag">${S.icon} 擅长${S.name}</span></p>
        <p>${d.desc}</p></div></div>`;
  }).join('');
};

RENDER.home = () => {
  const done = Object.keys(P.stages).length;
  $('#homeHud').innerHTML = `<div class="av">${P.avatar}</div>
    <div class="nm">${esc(P.name)}<small>📖 ${GRADES[P.gradeZh - 1]} · 🔢 ${GRADES[P.gradeMath - 1]} · 已通过 ${done} 关</small></div>
    <div class="coins">🪙 ${P.coins}</div>`;
  const team = P.team.map(id => petByUid(id)).filter(Boolean);
  $('#homeTeam').dataset.looks = team.map(p => p.sp).join(',');
  $('#homeTeam').dataset.forms = team.map(p => p.form || 0).join(',');
  $('#homeBadges').textContent = P.badges.map(b => b.split(' ')[0]).join('');
  $('#homePetCount').textContent = `图鉴 ${new Set(P.pets.map(p => p.sp)).size} / ${Object.keys(PETS).length}`;
  $('#homeEggCount').textContent = P.eggs.normal + P.eggs.rare ? `有 ${P.eggs.normal + P.eggs.rare} 个蛋待孵化` : 'N · R · SR · SSR';
  $('#homeGearCount').textContent = `${P.gear.length} 件装备`;
};

// ---------- 地图 ----------
let mapRegion = 0;
const stageStatus = (region, i) => {
  const st = region.stages[i];
  if (P.stages[st.id]) return 'done';
  if (i === 0 || P.stages[region.stages[i - 1].id]) return 'cur';
  return 'lock';
};
RENDER.map = () => {
  $('#regionTabs').innerHTML = REGIONS.map((r, i) => `<button class="rtab ${i === mapRegion ? 'on' : ''} ${r.locked ? 'locked' : ''}" data-act="region" data-i="${i}">${r.icon} ${r.name}${r.locked ? ' 🔒' : ''}</button>`).join('');
  const R = REGIONS[mapRegion], box = $('#mapPath');
  if (R.locked) {
    box.innerHTML = `<div class="lockedRegion"><b>${R.icon}</b>${R.name}<br><small>正在建造中，打败前面的擂台主后开放！</small></div>`;
    return;
  }
  // 从下往上走：第 1 关在最下面
  const nodes = R.stages.map((st, i) => {
    const s = stageStatus(R, i), stars = P.stages[st.id] || 0;
    return `<div class="node ${st.boss ? 'boss' : ''} ${s}" data-i="${i}" style="animation-delay:${(R.stages.length - i) * 0.05}s">
      <div class="dot" data-act="stage" data-i="${i}">${s === 'lock' ? '🔒' : st.boss ? '👑' : st.face}</div>
      <div class="nm">${i + 1}. ${st.name}</div>
      <div class="st">${s === 'done' ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : ''}</div></div>`;
  }).reverse();
  box.innerHTML = `<svg class="road"></svg>${nodes.join('')}`;
  requestAnimationFrame(() => { drawRoad(); const cur = $('#mapPath .node.cur') || $('#mapPath .node.done'); if (cur) cur.scrollIntoView({ block: 'center' }); });
};
function drawRoad() {
  const box = $('#mapPath'), svg = box.querySelector('svg.road');
  if (!svg) return;
  const br = box.getBoundingClientRect();
  const pts = $$('#mapPath .node .dot').map(d => { const r = d.getBoundingClientRect(); return [r.left + r.width / 2 - br.left, r.top + r.height / 2 - br.top]; });
  let dPath = '';
  pts.forEach(([x, y], i) => { if (!i) dPath = `M${x},${y}`; else { const [px, py] = pts[i - 1]; dPath += ` C${px},${(py + y) / 2} ${x},${(py + y) / 2} ${x},${y}`; } });
  svg.setAttribute('viewBox', `0 0 ${br.width} ${br.height}`);
  svg.innerHTML = `<path d="${dPath}" fill="none" stroke="#33215c" stroke-width="22" stroke-linecap="round"/>
    <path d="${dPath}" fill="none" stroke="#f3d9a0" stroke-width="15" stroke-linecap="round"/>
    <path d="${dPath}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 12" stroke-linecap="round" opacity=".8"/>`;
}
// 另外两只初始宠物：第一关的对手要是被你克制（或者至少不克制你）的那只
const otherStarters = () => {
  const me = PETS[P.starter].el;
  const score = sp => elementMult(me, PETS[sp].el) - elementMult(PETS[sp].el, me);
  return STARTERS.filter(s => s !== P.starter).sort((a, b) => score(b) - score(a));
};
function resolveTeam(stage) {
  const [s1, s2] = otherStarters();
  return stage.team.map(([sp, lv]) => [sp === 'S1' ? s1 : sp === 'S2' ? s2 : sp, lv]);
}
const joinSpecies = stage => stage.join === 'S1' ? otherStarters()[0] : stage.join === 'S2' ? otherStarters()[1] : stage.join;

function openStage(i) {
  const R = REGIONS[mapRegion], st = R.stages[i];
  if (stageStatus(R, i) === 'lock') { toast('先打赢前面的关卡哦！'); return; }
  const first = !P.stages[st.id], foes = resolveTeam(st), join = joinSpecies(st);
  const rewards = [];
  rewards.push(`🪙 ${first ? st.coins : Math.round(st.coins / 3)}`);
  if (first && join && !ownsSpecies(join)) rewards.push(`🐾 ${PETS[join].name}加入`);
  if (first && st.reward) for (const k in st.reward) rewards.push(rewardText(k, st.reward[k]));
  if (first && st.badge) rewards.push(st.badge);
  modal(`<div class="npc">${st.face}</div><h2>${st.npc}</h2>
    <div class="talk">${st.talk}</div>
    <div class="foes">${foes.map(([sp, lv]) => `<div><img src="${petImg(sp, 96, foeForm(lv))}" width="72" height="72" alt=""><br>${formName(sp, foeForm(lv))}<br>Lv.${lv} ${ELEMENTS[PETS[sp].el].icon}</div>`).join('')}</div>
    <p><b>${first ? '首次胜利奖励' : '再次挑战奖励'}：</b>${rewards.join(' · ')}</p>
    <div class="row"><button class="btn ghost" data-act="closeModal">再想想</button><button class="btn big" data-act="pickTeam" data-i="${i}">⚔️ 选择队伍</button></div>`);
}
let teamPick = [];
function openTeamPick(i) {
  teamPick = P.team.filter(id => petByUid(id));
  drawTeamPick(i);
}
function drawTeamPick(i) {
  const bonus = teamBonus(teamPick.map(id => petByUid(id).sp));
  modal(`<h2>选择出战宠物</h2><p class="hint">最多 3 只，按顺序上场。队伍里同时有擅长📖中文和🔢数学的宠物，全队攻击 +10%！</p>
    <div class="pickteam">${P.pets.map(p => {
      const k = teamPick.indexOf(p.uid);
      return `<div class="pet-c ${k >= 0 ? 'on' : ''}" data-act="togglePick" data-uid="${p.uid}" data-i="${i}">
        ${k >= 0 ? `<span class="in">${k + 1}</span>` : ''}<span class="el">${ELEMENTS[PETS[p.sp].el].icon}</span>
        <img src="${petImg(p.sp, 96, p.form)}" style="width:100%" alt=""><b>${petName(p)}</b><span class="lv">Lv.${p.lv} ${SUBJECTS[PETS[p.sp].sub].icon} <span class="stars">${starStr(p.star)}</span></span></div>`;
    }).join('')}</div>
    <p class="hint">${bonus ? '✅ 中文 + 数学搭配：全队攻击 +10%' : ''}</p>
    <div class="row"><button class="btn ghost" data-act="closeModal">返回</button>
    <button class="btn big" data-act="fight" data-i="${i}" ${teamPick.length ? '' : 'disabled'}>开始对战！</button></div>`);
}

// 「我的宠物」、宠物详情、孵蛋、升星、进化、装备在 grow.js

// ---------- 商店 ----------
RENDER.shop = () => {
  $('#shopList').innerHTML = Object.entries(ITEMS).map(([id, it], i) => `
    <div class="sitem" style="animation-delay:${i * 0.05}s"><div class="ic">${it.icon}</div>
      <div class="tx"><b>${it.name}</b><small>${it.desc}</small><span class="have">已有 ${P.items[id] || 0} 个</span></div>
      <button class="btn small" data-act="buy" data-id="${id}" ${P.coins < it.price ? 'disabled' : ''}>🪙 ${it.price}</button></div>`).join('');
};

// ---------- 设置 ----------
RENDER.settings = () => {
  const S = P.settings, tg = (k, label) => `<div class="toggle">${label}<button class="chip ${S[k] ? 'on' : ''}" data-act="toggle" data-k="${k}">${S[k] ? '开' : '关'}</button></div>`;
  $('#settingsBody').innerHTML = `
    <label>📖 中文年级</label><div class="chips">${GRADES.map((g, i) => `<button class="chip ${P.gradeZh === i + 1 ? 'on' : ''}" data-act="setGrade" data-k="gradeZh" data-v="${i + 1}">${g}</button>`).join('')}</div>
    <label>🔢 数学年级</label><div class="chips">${GRADES.map((g, i) => `<button class="chip ${P.gradeMath === i + 1 ? 'on' : ''}" data-act="setGrade" data-k="gradeMath" data-v="${i + 1}">${g}</button>`).join('')}</div>
    <label>⏱️ 答题时间</label><div class="chips">${TIMERS.map(t => `<button class="chip ${S.timer === t.id ? 'on' : ''}" data-act="setTimer" data-v="${t.id}">${t.name}（${t.sec} 秒）</button>`).join('')}</div>
    ${tg('pinyin', '中文选项显示拼音')}${tg('voice', '语音读题')}${tg('sound', '音效')}
    <p class="hint">答题统计：一共答了 ${P.stats.q} 题，答对 ${P.stats.right} 题${P.stats.q ? `（正确率 ${Math.round(P.stats.right / P.stats.q * 100)}%）` : ''}</p>
    <div class="danger"><button class="btn small red" data-act="deleteProfile">删除这个玩家</button></div>`;
};

// ================= 弹窗 =================
let modalLock = false;
function modal(html, lock = false) { $('#mbox').innerHTML = html; $('#modal').classList.add('show'); modalLock = lock; }
function closeModal() { $('#modal').classList.remove('show'); modalLock = false; }

// ================= 画布动画（主页、卡片里的宠物会动） =================
const DPR = () => Math.min(2, window.devicePixelRatio || 1);
function fitCanvas(c) {
  const w = c.clientWidth, h = c.clientHeight || +c.dataset.h || w;
  if (!w) return null;
  const d = DPR();
  if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
  const ctx = c.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0);
  return { ctx, w, h };
}
let heroJump = 0;
function drawLiveCanvases(host, t) {
  for (const c of $$(`${host} canvas.pet`)) {
    if (c.dataset.h && !c.style.height) c.style.height = c.dataset.h + 'px';
    const f = fitCanvas(c); if (!f) continue;
    const { ctx, w, h } = f;
    ctx.clearRect(0, 0, w, h);
    const looks = (c.dataset.looks || c.dataset.look || '').split(',').filter(Boolean);
    const forms = (c.dataset.forms || c.dataset.form || '').split(',').map(Number);
    const n = looks.length;
    looks.forEach((lk, i) => {
      const size = Math.min(h * 0.6, (w / Math.max(1, n)) * 0.7);   // 兔耳朵、鹿角很高，留出头顶空间
      const x = n === 1 ? w * 0.5 : w * (i + 0.5) / n;
      const jump = Math.max(0, Math.sin(clamp((t - heroJump - i * 0.08) * 6, 0, Math.PI))) * 22;
      PetArt.draw(ctx, lk, x, h * 0.94 - jump, size * (forms[i] >= 2 ? 0.9 : 1), t + i * 1.3, { form: forms[i] || 0 });
    });
  }
}

// ================= 对战 =================
let B = null;            // 当前对战
const ENEMY_DMG = 0.85;  // 对手伤害系数（让孩子更容易赢一点）
const FOE_HP = 1.3;      // 对手血量系数（让每场多答几题）
function makeFighter(sp, lv, extra = {}) {
  const form = extra.form || 0, st = extra.stats || petStats(sp, lv, { form }), d = PETS[sp];
  const hp = Math.round(st.hp * (extra.hpMul || 1));
  return { sp, lv, form, star: extra.star || 1, name: formName(sp, form), el: d.el, sub: d.sub, skills: d.skills, ult: d.ult, uid: extra.uid || null,
    maxHp: hp, hp, atk: st.atk, def: st.def, atkMul: extra.atkMul || (extra.easy ? 0.75 : 1), cds: [0, 0, 0, 0],
    shield: 0, stealth: false, buffT: 0, buffMul: 1, fainted: false,
    anim: { lunge: 0, white: 0, faint: 0, enter: 0, alpha: 1 } };
}
const active = side => side.team[side.active];
const aliveIdx = side => side.team.map((f, i) => (f.fainted ? -1 : i)).filter(i => i >= 0);

async function startBattle(stageIdx, uids) {
  const R = REGIONS[mapRegion], stage = R.stages[stageIdx];
  const myPets = uids.map(petByUid).filter(Boolean);
  const bonus = teamBonus(myPets.map(p => p.sp)) ? 1.1 : 1;
  B = {
    region: R, stage, stageIdx, first: !P.stages[stage.id],
    me: { team: myPets.map(p => makeFighter(p.sp, p.lv, { uid: p.uid, atkMul: bonus, form: p.form, star: p.star, stats: petFull(p) })), active: 0, rage: 0, items: 0 },
    foe: { team: resolveTeam(stage).map(([sp, lv]) => makeFighter(sp, lv, { form: foeForm(lv), hpMul: (stage.easy ? 1 : FOE_HP) * (stage.boss ? 1.05 : 1), easy: stage.easy })), active: 0 },
    stats: { q: 0, right: 0, crit: 0 }, exp: {}, coins: 0, busy: true, over: false, rounds: 0,
    fx: { parts: [], projs: [], rings: [], shake: 0, flash: 0, darken: 0, bolts: [] },
  };
  closeModal();
  go('battle');
  renderBattle();
  setMsg(`${stage.npc}：「${stage.talk}」`);
  await sleep(900);
  await enter(B.foe);
  setMsg(`${stage.npc}派出了 ${active(B.foe).name}！`);
  await sleep(700);
  await enter(B.me);
  setMsg(`上吧，${active(B.me).name}！`);
  await sleep(600);
  playerTurn();
}

// ---------- 渲染界面 ----------
function setMsg(t) { $('#bmsg').innerHTML = t; }
function hpCard(side, el) {
  const f = active(side), pct = f.hp / f.maxHp * 100;
  const st = [f.shield ? `🛡️×${f.shield}` : '', f.buffT ? `💪${f.buffT}` : '', f.stealth ? '👻' : ''].filter(Boolean).join(' ');
  el.innerHTML = `<div class="nm"><span>${ELEMENTS[f.el].icon} ${f.name}</span><small>Lv.${f.lv}</small></div>
    <div class="hpbar"><i class="${pct < 25 ? 'low' : pct < 50 ? 'mid' : ''}" style="width:${pct}%"></i></div>
    <div class="nm"><span class="st">${st}</span><span class="hpn">${Math.ceil(f.hp)} / ${f.maxHp}</span></div>
    <div class="balls">${side.team.map(x => `<i class="${x.fainted ? 'out' : ''}"></i>`).join('')}</div>`;
}
function renderBattle() {
  if (!B) return;
  hpCard(B.foe, $('#hpEnemy')); hpCard(B.me, $('#hpMine'));
  const f = active(B.me), dis = B.busy || B.over;
  $('#rage').innerHTML = `必杀能量 ${[0, 1, 2].map(i => `<span class="pip ${i < B.me.rage ? 'on' : ''}"></span>`).join('')}
    ${B.me.rage >= 3 && !dis ? `<button class="ultbtn" data-act="ult">🌟 必杀技：${f.ult}</button>` : ''}`;
  $('#skills').innerHTML = f.skills.map((s, i) => {
    const E = ELEMENTS[f.el], S = SUBJECTS[s.sub], cd = f.cds[i];
    const info = s.kind === 'attack' ? `${E.icon} 威力 ${s.power}${s.hard ? ' · 难题' : ''}` : { heal: '💚 恢复生命', shield: '🛡️ 伤害减半 ×2', buff: '💪 攻击 ×1.4', stealth: '👻 躲开下一招' }[s.kind];
    return `<button class="skill" data-act="skill" data-i="${i}" ${dis || cd ? 'disabled' : ''} style="border-left-color:${s.kind === 'attack' ? E.color : '#9b7bff'}">
      <span class="subj" style="background:${S.color}">${S.icon}${S.name}</span><b>${s.name}</b><small>${info}</small>
      ${cd ? `<span class="cd">冷却 ${cd} 回合</span>` : ''}</button>`;
  }).join('');
  $$('#controls .tools button').forEach(b => { b.disabled = dis; });
  $('#btnItems').textContent = `🎒 道具（${BATTLE_ITEM_LIMIT - B.me.items}）`;
}

// ---------- 飘字 ----------
function floatText(side, text, cls = 'dmg', dy = 0) {
  const pos = petPos(side), cv = $('#bcv');
  const d = document.createElement('div');
  d.className = 'fl ' + cls; d.textContent = text;
  d.style.left = (pos.x / cv.clientWidth * 100) + '%';
  d.style.top = ((pos.y - pos.size * 0.75 + dy) / cv.clientHeight * 100) + '%';
  $('#floaters').appendChild(d);
  setTimeout(() => d.remove(), 1200);
}

// ---------- 补间动画 ----------
const tweens = [];
function tween(obj, key, to, ms) {
  return new Promise(res => tweens.push({ obj, key, from: obj[key], to, start: performance.now(), dur: Math.max(1, ms * SPEED), res }));
}
function updateTweens(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i], k = clamp((now - w.start) / w.dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
    w.obj[w.key] = w.from + (w.to - w.from) * e;
    if (k >= 1) { tweens.splice(i, 1); w.res(); }
  }
}

// ---------- 位置 ----------
function petPos(side) {
  const c = $('#bcv'), W = c.clientWidth, H = c.clientHeight;
  return side === B.me ? { x: W * 0.27, y: H * 0.92, size: H * 0.44 } : { x: W * 0.72, y: H * 0.53, size: H * 0.32 };
}

async function enter(side) {
  const f = active(side);
  f.anim.enter = 0; f.anim.alpha = 1; f.anim.faint = 0;
  sfx('enter');
  renderBattle();
  const p = petPos(side);
  ring(p.x, p.y - p.size * 0.4, ELEMENTS[f.el].color, p.size * 0.9);
  await tween(f.anim, 'enter', 1, 450);
}

// ================= 特效 =================
function burst(x, y, el, n = 18, spd = 220) {
  const E = ELEMENTS[el] || ELEMENTS.light;
  const shape = { fire: 'f', water: 'b', grass: 'l', thunder: 'z', light: 's', dark: 'c' }[el] || 'c';
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), v = rand(spd * 0.3, spd);
    B.fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rand(0.4, 0.8), max: 0.8, r: rand(3, 8), color: Math.random() < 0.5 ? E.color : E.light, shape, rot: rand(0, 6), g: 260 });
  }
}
function ring(x, y, color, r = 80) { B.fx.rings.push({ x, y, color, r, life: 0.5, max: 0.5 }); }
function sparkle(x, y, color, n = 10, up = true) {
  for (let i = 0; i < n; i++) B.fx.parts.push({ x: x + rand(-30, 30), y: y + rand(-20, 20), vx: rand(-20, 20), vy: up ? rand(-110, -40) : rand(-40, 40), life: rand(0.6, 1.1), max: 1.1, r: rand(3, 6), color, shape: 's', rot: 0, g: 0 });
}

// 发射一个技能弹（按属性不同样子），返回到达时的 Promise
function projectile(fromSide, toSide, el, big = 1) {
  const a = petPos(fromSide), b = petPos(toSide);
  const x0 = a.x + (fromSide === B.me ? a.size * 0.3 : -a.size * 0.3), y0 = a.y - a.size * 0.5;
  const x1 = b.x, y1 = b.y - b.size * 0.45;
  sfx(el);
  if (el === 'thunder') {   // 雷：从天而降的闪电
    B.fx.bolts.push({ x: x1, y0: -10, y1, life: 0.35 * big, max: 0.35 * big, w: 5 * big });
    return sleep(220);
  }
  const p = { el, x0, y0, x1, y1, t: 0, dur: 0.48, big };
  B.fx.projs.push(p);
  return sleep(480);
}

function drawProj(ctx, p, now) {
  const k = clamp(p.t / p.dur, 0, 1);
  const x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * 40;
  const ang = Math.atan2(p.y1 - p.y0, p.x1 - p.x0), E = ELEMENTS[p.el], s = p.big;
  ctx.save(); ctx.translate(x, y);
  if (p.el === 'fire') {
    ctx.rotate(ang - Math.PI / 2 + Math.PI);
    PetArt.flame(ctx, 0, 0, 16 * s, '#ff5a2a'); PetArt.flame(ctx, 0, 3, 10 * s, '#ffb000'); PetArt.flame(ctx, 0, 5, 5 * s, '#fff3a0');
    if (Math.random() < 0.8) B.fx.parts.push({ x, y, vx: rand(-30, 30), vy: rand(-60, 0), life: 0.4, max: 0.4, r: rand(3, 6) * s, color: pick(['#ff7a2f', '#ffb000']), shape: 'c', g: 0 });
  } else if (p.el === 'water') {
    for (let i = 0; i < 3; i++) {
      const ox = Math.sin(now * 12 + i * 2) * 10, oy = (i - 1) * 12;
      ctx.beginPath(); ctx.arc(ox, oy, (9 - i * 2) * s, 0, 7);
      ctx.fillStyle = 'rgba(160,215,255,.6)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#2f8fe0'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox - 3, oy - 3, 2.4 * s, 0, 7); ctx.fill();
    }
  } else if (p.el === 'grass') {
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.translate((i - 1) * 8, (i - 1) * 14); ctx.rotate(now * 18 + i * 2);
      ctx.fillStyle = '#4caf50'; ctx.strokeStyle = '#2e6b2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-12 * s, 0); ctx.quadraticCurveTo(0, -9 * s, 12 * s, 0); ctx.quadraticCurveTo(0, 9 * s, -12 * s, 0); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  } else if (p.el === 'light') {
    ctx.rotate(now * 10);
    PetArt.star(ctx, 0, 0, 18 * s, '#fff3a0'); PetArt.star(ctx, 0, 0, 10 * s, '#ffd000');
    if (Math.random() < 0.7) B.fx.parts.push({ x, y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.5, max: 0.5, r: 4 * s, color: '#fff3a0', shape: 's', g: 0 });
  } else if (p.el === 'dark') {
    ctx.rotate(now * 14);
    ctx.fillStyle = E.color; ctx.beginPath(); ctx.arc(0, 0, 20 * s, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(30,15,60,1)'; ctx.beginPath(); ctx.arc(7 * s, -4 * s, 17 * s, 0, 7); ctx.fill();
    if (Math.random() < 0.7) B.fx.parts.push({ x, y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.5, max: 0.5, r: 6 * s, color: '#7a4fd0', shape: 'c', g: 0 });
  }
  ctx.restore();
}

function drawPart(ctx, q) {
  const a = clamp(q.life / q.max, 0, 1);
  ctx.globalAlpha = a; ctx.fillStyle = q.color;
  if (q.shape === 's') PetArt.star(ctx, q.x, q.y, q.r * 1.4, q.color);
  else if (q.shape === 'f') PetArt.flame(ctx, q.x, q.y, q.r, q.color);
  else if (q.shape === 'b') { ctx.strokeStyle = q.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.stroke(); }
  else if (q.shape === 'l') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot += 0.2); ctx.beginPath(); ctx.ellipse(0, 0, q.r * 1.5, q.r * 0.6, 0, 0, 7); ctx.fill(); ctx.restore(); }
  else if (q.shape === 'z') { ctx.strokeStyle = q.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + 4, q.y + 5); ctx.lineTo(q.x - 2, q.y + 7); ctx.lineTo(q.x + 3, q.y + 13); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}

let lastT = performance.now();
const DRAW_HOOKS = [];   // grow.js 等模块的额外绘制（宠物蛋、进化仪式）
function drawBattle(now, dt) {
  const c = $('#bcv'), f = fitCanvas(c); if (!f) return;
  const { ctx, w: W, h: H } = f, R = B.region, fx = B.fx, t = now / 1000;
  ctx.save();
  if (fx.shake > 0) { ctx.translate(rand(-1, 1) * fx.shake * 14, rand(-1, 1) * fx.shake * 10); fx.shake = Math.max(0, fx.shake - dt * 1.6); }
  // 背景：天空、远山、草地、站台
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, R.sky[0]); sky.addColorStop(1, R.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  for (let i = 0; i < 3; i++) { const cx = ((t * 8 + i * W / 2.4) % (W + 120)) - 60, cy = H * (0.1 + i * 0.07); ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.arc(cx + 18, cy - 6, 20, 0, 7); ctx.arc(cx + 38, cy, 15, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#a7d98a'; ctx.beginPath(); ctx.moveTo(-20, H * 0.6);
  for (let x = -20; x <= W + 20; x += 20) ctx.lineTo(x, H * 0.52 + Math.sin(x / 70) * 14 + Math.sin(x / 31) * 5);
  ctx.lineTo(W + 20, H); ctx.lineTo(-20, H); ctx.fill();
  const gr = ctx.createLinearGradient(0, H * 0.58, 0, H);
  gr.addColorStop(0, R.ground[0]); gr.addColorStop(1, R.ground[1]);
  ctx.fillStyle = gr; ctx.fillRect(-20, H * 0.6, W + 40, H * 0.5);
  for (const [px, py, rx] of [[0.72, 0.5, 0.2], [0.27, 0.92, 0.25]]) {
    ctx.fillStyle = 'rgba(60,110,40,.35)'; ctx.beginPath(); ctx.ellipse(W * px, H * py, W * rx, H * 0.05, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.stroke();
  }
  // 宠物
  for (const side of [B.foe, B.me]) {
    const fi = active(side); if (!fi) continue;
    const p = petPos(side), A = fi.anim, mine = side === B.me;
    const x = p.x + (mine ? -1 : 1) * (1 - A.enter) * W * 0.6;
    let alpha = A.alpha * (fi.stealth ? 0.45 : 1);
    if (fi.buffT) sparkleAura(ctx, x, p.y, p.size, t);
    PetArt.draw(ctx, fi.sp, x, p.y, p.size, t + (mine ? 0 : 1.7), { flip: !mine, lunge: A.lunge, white: A.white, faint: A.faint, alpha, form: fi.form });
    if (fi.shield) {   // 护盾泡泡
      ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.08;
      ctx.fillStyle = '#9fd8ff'; ctx.strokeStyle = '#2f8fe0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, p.y - p.size * 0.48, p.size * 0.62, p.size * 0.58, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }
  // 特效
  if (fx.darken > 0) { ctx.fillStyle = `rgba(20,10,45,${fx.darken})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
  for (let i = fx.rings.length - 1; i >= 0; i--) {
    const r = fx.rings[i]; r.life -= dt; if (r.life <= 0) { fx.rings.splice(i, 1); continue; }
    const k = 1 - r.life / r.max;
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.color; ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * (0.3 + k), r.r * (0.3 + k) * 0.6, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (let i = fx.projs.length - 1; i >= 0; i--) { const p = fx.projs[i]; p.t += dt / SPEED; if (p.t >= p.dur) { fx.projs.splice(i, 1); continue; } drawProj(ctx, p, t); }
  for (let i = fx.bolts.length - 1; i >= 0; i--) {
    const b = fx.bolts[i]; b.life -= dt / SPEED; if (b.life <= 0) { fx.bolts.splice(i, 1); continue; }
    ctx.globalAlpha = clamp(b.life / b.max * 1.5, 0, 1);
    for (const [col, wd] of [['#fff7a0', b.w * 2.4], ['#ffd000', b.w], ['#ffffff', b.w * 0.4]]) {
      ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(b.x, b.y0);
      let y = b.y0, xx = b.x; while (y < b.y1) { y += 18; xx = b.x + rand(-16, 16); ctx.lineTo(xx, Math.min(y, b.y1)); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  for (let i = fx.parts.length - 1; i >= 0; i--) {
    const q = fx.parts[i]; q.life -= dt; if (q.life <= 0) { fx.parts.splice(i, 1); continue; }
    q.vy += (q.g || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt; drawPart(ctx, q);
  }
  if (fx.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${fx.flash})`; ctx.fillRect(-20, -20, W + 40, H + 40); fx.flash = Math.max(0, fx.flash - dt * 2.5); }
  ctx.restore();
}
function sparkleAura(ctx, x, y, size, t) {
  for (let i = 0; i < 6; i++) {
    const a = t * 2 + i * 1.05, r = size * 0.5;
    PetArt.flame(ctx, x + Math.cos(a) * r, y - size * 0.4 + Math.sin(a) * r * 0.35 - ((t * 60 + i * 15) % 30), 6, 'rgba(255,120,40,.75)');
  }
}

// 主循环
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  updateTweens(now);
  if (screen === 'battle' && B) drawBattle(now, dt);
  else drawLiveCanvases(`#s-${screen}`, now / 1000);
  for (const fn of DRAW_HOOKS) fn(now / 1000, dt);
  if ($('#modal.show')) drawLiveCanvases('#modal', now / 1000);
  requestAnimationFrame(loop);
}

// ================= 伤害 =================
function calcDamage(att, def, power, opts = {}) {
  let d = power * (att.atk * att.atkMul * (att.buffT ? att.buffMul : 1)) / (def.def + 20) * 1.4;
  const em = opts.noElement ? 1 : elementMult(att.el, def.el);
  d *= em;
  if (opts.crit) d *= 1.5;
  if (opts.weak) d *= 0.5;
  if (opts.enemy) d *= ENEMY_DMG;
  d *= rand(0.92, 1.08);
  return { dmg: Math.max(1, Math.round(d)), em };
}

// 一次攻击：冲刺 → 技能弹 → 命中
async function attack(attSide, defSide, power, opts = {}) {
  const a = active(attSide), d = active(defSide), dp = petPos(defSide);
  await tween(a.anim, 'lunge', 1, 160);
  const back = tween(a.anim, 'lunge', 0, 260);
  await projectile(attSide, defSide, a.el, opts.ult ? 1.6 : 1);
  await back;
  if (opts.dodge || (d.stealth && attSide === B.foe)) {
    if (d.stealth && attSide === B.foe) d.stealth = false;
    sfx('dodge'); floatText(defSide, opts.dodge ? '完美闪避！' : '躲开了！', 'word');
    const ox = d.anim.enter; await tween(d.anim, 'enter', 0.85, 120); await tween(d.anim, 'enter', ox, 180);
    renderBattle();
    return 0;
  }
  let { dmg, em } = calcDamage(a, d, power, opts);
  if (opts.reduce) dmg = Math.max(1, Math.round(dmg * opts.reduce));
  if (d.shield > 0) { dmg = Math.max(1, Math.round(dmg * 0.5)); d.shield--; }
  d.hp = Math.max(0, d.hp - dmg);
  burst(dp.x, dp.y - dp.size * 0.45, a.el, opts.crit || opts.ult ? 34 : 18, opts.crit || opts.ult ? 320 : 220);
  ring(dp.x, dp.y - dp.size * 0.45, ELEMENTS[a.el].color, dp.size);
  B.fx.shake = opts.ult ? 0.9 : opts.crit ? 0.6 : 0.3;
  if (opts.crit || opts.ult) B.fx.flash = 0.5;
  sfx(opts.crit || opts.ult ? 'crit' : 'hit');
  d.anim.white = 1; tween(d.anim, 'white', 0, 350);
  floatText(defSide, String(dmg), opts.crit || opts.ult ? 'crit' : 'dmg');
  if (opts.crit) floatText(defSide, '暴击！', 'word', -46);
  if (em > 1) floatText(defSide, '属性克制！', 'word', 34);
  else if (em < 1) floatText(defSide, '效果一般…', 'small', 34);
  renderBattle();
  await sleep(450);
  if (d.hp <= 0) await faint(defSide);
  return dmg;
}
async function faint(side) {
  const f = active(side);
  f.fainted = true; sfx('faint');
  setMsg(`${f.name} 倒下了！`);
  await tween(f.anim, 'faint', 1, 500);
  await tween(f.anim, 'alpha', 0, 300);
  renderBattle();
}

// ================= 回合 =================
function playerTurn() {
  if (!B || B.over) return;
  B.rounds++;
  const f = active(B.me);
  f.cds = f.cds.map(c => Math.max(0, c - 1));
  B.busy = false;
  setMsg(B.me.rage >= 3 ? '必杀能量满了！可以放必杀技！' : `轮到你了！选一个技能出招`);
  renderBattle();
}
async function afterMyAction() {
  const me = active(B.me);
  if (me.buffT) me.buffT--;
  renderBattle();
  if (B.over) return;
  if (active(B.foe).fainted) { if (!(await nextFoe())) return; }
  await sleep(350);
  await enemyTurn();
}
async function nextFoe() {
  const left = aliveIdx(B.foe);
  if (!left.length) { await win(); return false; }
  await sleep(400);
  B.foe.active = left[0];
  await enter(B.foe);
  setMsg(`${B.stage.npc}派出了 ${active(B.foe).name}！`);
  await sleep(700);
  return true;
}

async function useSkill(i) {
  if (!B || B.busy || B.over) return;
  const f = active(B.me), s = f.skills[i];
  if (f.cds[i]) return;
  B.busy = true; renderBattle();
  sfx('tap');
  const res = await askQuestion(s.sub, s.hard ? 1 : 0, { tag: `${SUBJECTS[s.sub].icon} ${f.name} · ${s.name}${s.hard ? '（难题，威力更大）' : ''}`, kind: s.kind === 'attack' ? 'attack' : 'support' });
  setMsg(`${f.name} 使用了「${s.name}」！`);
  if (s.kind === 'attack') {
    await attack(B.me, B.foe, s.power, { crit: res.correct && res.fast, weak: !res.correct });
  } else {
    await support(B.me, s.kind, res);
    f.cds[i] = SUPPORT_CD + 1;
  }
  await afterMyAction();
}
async function support(side, kind, res) {
  const f = active(side), p = petPos(side), cy = p.y - p.size * 0.45;
  const ok = res.correct, fast = res.correct && res.fast;
  if (kind === 'heal') {
    const amt = Math.round(f.maxHp * (fast ? 0.45 : ok ? 0.35 : 0.2));
    const real = Math.min(amt, f.maxHp - f.hp); f.hp += real;
    sfx('heal'); sparkle(p.x, cy, '#8ef07a', 16); floatText(side, `+${real}`, 'heal');
  } else if (kind === 'shield') {
    f.shield = ok ? 2 : 1; sfx('shield'); ring(p.x, cy, '#4fb7ff', p.size); floatText(side, `护盾 ×${f.shield}`, 'word');
  } else if (kind === 'buff') {
    f.buffT = 3; f.buffMul = ok ? 1.4 : 1.2; sfx('buff'); sparkle(p.x, cy, '#ff9a3c', 14); floatText(side, `攻击 ×${f.buffMul}`, 'word');
  } else if (kind === 'stealth') {
    f.stealth = ok || Math.random() < 0.5; sfx('dodge'); sparkle(p.x, cy, '#c99cff', 12, false); floatText(side, f.stealth ? '隐身成功！' : '隐身失败…', 'word');
  }
  renderBattle();
  await sleep(700);
}

async function useUlt() {
  if (!B || B.busy || B.over || B.me.rage < 3) return;
  B.busy = true; B.me.rage = 0; renderBattle();
  const f = active(B.me);
  setMsg(`🌟 ${f.name} 的必杀技「${f.ult}」！`);
  const cut = $('#cutin');
  cut.innerHTML = `<img src="${petImg(f.sp, 120, f.form)}" width="90" height="90" alt=""><span>${f.ult}！</span>`;
  cut.classList.remove('show'); void cut.offsetWidth; cut.classList.add('show');
  sfx('ult'); speak(f.ult);
  tween(B.fx, 'darken', 0.55, 300);
  await sleep(1300);
  const dp = petPos(B.foe);
  for (let k = 0; k < 4; k++) { burst(dp.x + rand(-40, 40), dp.y - dp.size * rand(0.2, 0.8), f.el, 14, 260); await sleep(90); }
  sfx('boom');
  await attack(B.me, B.foe, ULT_POWER + 10 * f.form, { ult: true });
  await tween(B.fx, 'darken', 0, 300);
  await afterMyAction();
}

// 对手的回合
async function enemyTurn() {
  if (!B || B.over) return;
  B.busy = true; renderBattle();
  const f = active(B.foe), me = active(B.me);
  f.cds = f.cds.map(c => Math.max(0, c - 1));
  // 选招：血少时优先回血；偶尔用辅助；否则挑伤害高的攻击
  const ready = f.skills.map((s, i) => ({ s, i })).filter(o => !f.cds[o.i]);
  let choice = null;
  const heal = ready.find(o => o.s.kind === 'heal');
  if (heal && f.hp / f.maxHp < 0.4 && Math.random() < 0.6) choice = heal;
  const sup = ready.find(o => o.s.kind !== 'attack' && o.s.kind !== 'heal');
  if (!choice && sup && Math.random() < 0.18) choice = sup;
  if (!choice) {
    const atks = ready.filter(o => o.s.kind === 'attack');
    atks.sort((a, b) => b.s.power * elementMult(f.el, me.el) - a.s.power * elementMult(f.el, me.el));
    choice = Math.random() < 0.65 ? atks[0] : pick(atks);
  }
  const s = choice.s;
  setMsg(`${f.name} 使用了「${s.name}」！`);
  await sleep(500);
  if (s.kind === 'attack') {
    let dodge = false, reduce = 0;
    if (!me.stealth && Math.random() < 0.35) {   // 防御题
      const res = await askQuestion(s.sub, -1, { tag: `🛡️ 防御题！答对伤害减半，答得快直接闪避`, kind: 'defense' });
      if (res.correct) { if (res.fast) dodge = true; else reduce = 0.5; }
    }
    await attack(B.foe, B.me, s.power, { enemy: true, dodge, reduce, crit: Math.random() < 0.08 });
  } else {
    await support(B.foe, s.kind, { correct: true, fast: false });
    f.cds[choice.i] = SUPPORT_CD + 1;
  }
  if (f.buffT) f.buffT--;
  renderBattle();
  if (B.over) return;
  if (active(B.me).fainted) {
    const left = aliveIdx(B.me);
    if (!left.length) { await lose(); return; }
    await chooseNext(true);
  }
  playerTurn();
}

// ---------- 换宠物 ----------
function chooser(title, list, forced) {
  return new Promise(res => {
    chooser.res = res;
    modal(`<h2>${title}</h2><div class="chooser">${list.map(o => `
      <button data-act="choose" data-i="${o.i}" ${o.disabled ? 'disabled' : ''}><img src="${petImg(o.f.sp, 64, o.f.form)}" width="48" height="48" alt="">
        <span style="flex:1">${o.f.name} <small>Lv.${o.f.lv}</small>${o.note ? `<br><small>${o.note}</small>` : ''}</span>
        <span class="hpbar"><i class="${o.f.hp / o.f.maxHp < 0.25 ? 'low' : o.f.hp / o.f.maxHp < 0.5 ? 'mid' : ''}" style="width:${o.f.hp / o.f.maxHp * 100}%"></i></span></button>`).join('')}</div>
      ${forced ? '' : '<div class="row"><button class="btn ghost" data-act="choose" data-i="-1">取消</button></div>'}`, forced);
  });
}
async function chooseNext(forced) {
  const list = B.me.team.map((f, i) => ({ f, i, disabled: f.fainted || i === B.me.active, note: f.fainted ? '已倒下' : i === B.me.active ? '正在场上' : '' }));
  const i = await chooser(forced ? '选择下一只宠物' : '换哪只宠物上场？（会用掉这一回合）', list, forced);
  closeModal();
  if (i < 0) return false;
  const old = active(B.me);
  if (!old.fainted) await tween(old.anim, 'enter', 0, 300);
  B.me.active = i;
  await enter(B.me);
  setMsg(`上吧，${active(B.me).name}！`);
  await sleep(400);
  return true;
}
async function doSwitch() {
  if (!B || B.busy || B.over) return;
  if (aliveIdx(B.me).length < 2) { toast('没有别的宠物可以换了'); return; }
  B.busy = true; renderBattle();
  if (await chooseNext(false)) await enemyTurn();
  else { B.busy = false; renderBattle(); }
}

// ---------- 道具 ----------
async function openItems() {
  if (!B || B.busy || B.over) return;
  if (B.me.items >= BATTLE_ITEM_LIMIT) { toast(`每场最多用 ${BATTLE_ITEM_LIMIT} 个道具`); return; }
  const ids = Object.keys(ITEMS).filter(id => ITEMS[id].battle);
  B.busy = true; renderBattle();
  const i = await new Promise(res => {
    chooser.res = res;
    modal(`<h2>使用道具</h2><p class="hint">用道具会用掉这一回合，这场还能用 ${BATTLE_ITEM_LIMIT - B.me.items} 个</p>
      <div class="chooser">${ids.map((id, k) => `<button data-act="choose" data-i="${k}" ${(P.items[id] || 0) > 0 ? '' : 'disabled'}><span style="font-size:30px">${ITEMS[id].icon}</span>
        <span style="flex:1">${ITEMS[id].name} ×${P.items[id] || 0}<br><small>${ITEMS[id].desc}</small></span></button>`).join('')}</div>
      <div class="row"><button class="btn ghost" data-act="choose" data-i="-1">取消</button></div>`);
  });
  closeModal();
  if (i < 0) { B.busy = false; renderBattle(); return; }
  const id = ids[i], f = active(B.me), p = petPos(B.me), cy = p.y - p.size * 0.45;
  if (id === 'feather') {
    const dead = B.me.team.map((x, k) => ({ f: x, i: k, disabled: !x.fainted, note: x.fainted ? '' : '没有倒下' }));
    if (!dead.some(o => !o.disabled)) { toast('现在没有倒下的宠物'); B.busy = false; renderBattle(); return; }
    const k = await chooser('让哪只宠物复活？', dead, false);
    closeModal();
    if (k < 0) { B.busy = false; renderBattle(); return; }
    const t = B.me.team[k]; t.fainted = false; t.hp = Math.round(t.maxHp * 0.5); t.anim.faint = 0; t.anim.alpha = 1;
    sfx('levelup'); toast(`${t.name} 复活了！`);
  } else if (id === 'potion') {
    const real = Math.min(Math.round(f.maxHp * 0.5), f.maxHp - f.hp); f.hp += real; sfx('heal'); sparkle(p.x, cy, '#8ef07a', 16); floatText(B.me, `+${real}`, 'heal');
  } else if (id === 'bubble') {
    f.shield = 2; sfx('shield'); ring(p.x, cy, '#4fb7ff', p.size); floatText(B.me, '护盾 ×2', 'word');
  } else if (id === 'candy') {
    f.buffT = 3; f.buffMul = 1.5; sfx('buff'); sparkle(p.x, cy, '#ff9a3c', 14); floatText(B.me, '攻击 ×1.5', 'word');
  }
  P.items[id]--; B.me.items++; save();
  setMsg(`使用了 ${ITEMS[id].icon} ${ITEMS[id].name}！`);
  renderBattle();
  await sleep(700);
  await enemyTurn();
}

// ================= 答题 =================
let Qs = null;
function askQuestion(sub, diff, { tag, kind }) {
  return new Promise(resolve => {
    const grade = sub === 'zh' ? P.gradeZh : P.gradeMath;
    const q = Quiz.make(sub, grade, diff);
    const sec = kind === 'defense' ? Math.max(8, Math.round(timerSec() * 0.6)) : timerSec();
    const critWin = Math.min(sec * 0.4, 9);
    Qs = { q, sec, critWin, start: performance.now(), done: false, resolve, kind, ticks: 0 };
    $('#qTag').innerHTML = tag;
    $('#qBody').innerHTML = q.html;
    const showPy = sub === 'zh' && P.settings.pinyin;
    $('#qOpts').innerHTML = q.opts.map((o, i) => `<button class="opt" data-act="answer" data-i="${i}"><span class="k">${i + 1}</span>${esc(o.t)}${showPy && o.py ? `<small>${o.py}</small>` : ''}</button>`).join('');
    $('#qFeed').innerHTML = kind === 'hatch' || kind === 'evolve' ? '' : `<small>⚡ ${Math.round(critWin)} 秒内答对 = ${kind === 'defense' ? '完美闪避' : kind === 'support' ? '效果更好' : '暴击'}</small>`;
    $('#qsheet').classList.add('show');
    speak(q.say);
    tickTimer();
    if (window.__pets && __pets.auto != null) setTimeout(() => {
      const a = __pets.auto, ok = a === 'right' || (typeof a === 'number' && Math.random() < a);
      if (Math.random() >= (__pets.autoFast == null ? 1 : __pets.autoFast)) Qs.start -= (critWin + 1) * 1000;
      answer(ok ? q.ans : (q.ans + 1) % 4);
    }, 30);
  });
}
function tickTimer() {
  if (!Qs || Qs.done) return;
  const used = (performance.now() - Qs.start) / 1000, left = Qs.sec - used;
  const bar = $('#qBar');
  bar.style.width = clamp(left / Qs.sec * 100, 0, 100) + '%';
  bar.className = used < Qs.critWin ? 'crit' : left < 5 ? 'hurry' : '';
  if (left < 5 && Math.ceil(left) !== Qs.ticks) { Qs.ticks = Math.ceil(left); sfx('tick'); }
  if (left <= 0) { answer(-1); return; }
  requestAnimationFrame(tickTimer);
}
async function answer(i) {
  if (!Qs || Qs.done) return;
  const S = Qs; S.done = true;
  const used = (performance.now() - S.start) / 1000;
  const correct = i === S.q.ans, fast = correct && used <= S.critWin;
  $$('#qOpts .opt').forEach((b, k) => { b.disabled = true; if (k === S.q.ans) b.classList.add('right'); else if (k === i) b.classList.add('wrong'); });
  const inBattle = !!(B && screen === 'battle');
  if (inBattle) B.stats.q++;
  P.stats.q++;
  if (correct) {
    P.stats.right++;
    if (inBattle) {
      B.stats.right++; if (fast) B.stats.crit++;
      B.me.rage = Math.min(3, B.me.rage + 1);
      B.coins += 3;
      const me = active(B.me); if (me.uid) B.exp[me.uid] = (B.exp[me.uid] || 0) + 2;
    }
    sfx('right'); sfx('coin');
    const word = !inBattle ? (fast ? '⚡ 又快又对！' : '✅ 答对了！') : fast ? (S.kind === 'defense' ? '⚡ 完美闪避！' : S.kind === 'support' ? '⚡ 超快！效果加强！' : '⚡ 暴击！') : (S.kind === 'defense' ? '✅ 答对了！伤害减半' : '✅ 答对了！');
    const sub = S.kind === 'hatch' ? '蛋壳又裂开了一点！' : S.kind === 'evolve' ? '进化能量 +1' : '+3 🪙 · +2 经验 · 必杀能量 +1';
    $('#qFeed').innerHTML = `<div class="big ${fast ? 'crit' : 'ok'}">${word}</div><small>${sub}</small>`;
    await sleep(fast ? 900 : 750);
  } else {
    if (inBattle) B.me.rage = 0;
    sfx('wrong');
    const right = S.q.opts[S.q.ans].t;
    $('#qFeed').innerHTML = `<div class="big no">${i < 0 ? '⏰ 时间到！' : '❌ 答错了'}</div>
      <div class="exp">正确答案：<b>${esc(right)}</b><br>${S.q.explain}</div>
      <button class="btn big" data-act="gotIt">知道了</button>`;
    speak('正确答案是' + right);
    if (window.__pets && __pets.auto != null) setTimeout(() => S.got && S.got(), 30);
    await new Promise(r => { S.got = r; });
  }
  $('#qsheet').classList.remove('show');
  save();
  if (inBattle) renderBattle();
  await sleep(250);
  S.resolve({ correct, fast });
}

// ================= 胜负 =================
async function win() {
  B.over = true; B.busy = true;
  const st = B.stage, first = B.first;
  const acc = B.stats.q ? B.stats.right / B.stats.q : 1;
  const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
  const coinBonus = first ? st.coins : Math.round(st.coins / 3);
  const foeLv = B.foe.team.reduce((a, f) => a + f.lv, 0);
  const baseExp = Math.round(foeLv * (first ? 4 : 2.5));
  P.coins += B.coins + coinBonus;
  P.stages[st.id] = Math.max(P.stages[st.id] || 0, stars);
  const gains = B.me.team.map(f => { const pet = petByUid(f.uid); const n = baseExp + (B.exp[f.uid] || 0); return { pet, n, ...giveExp(pet, n) }; });
  const extra = [];
  let joined = null;
  if (first) {
    if (st.reward) for (const k in st.reward) { giveReward(k, st.reward[k]); extra.push(rewardText(k, st.reward[k])); }
    if (st.badge && !P.badges.includes(st.badge)) { P.badges.push(st.badge); extra.push(st.badge); }
    const sp = joinSpecies(st);
    if (sp && !ownsSpecies(sp)) {
      const avg = Math.round(P.pets.reduce((a, p) => a + p.lv, 0) / P.pets.length);
      joined = addPet(sp, Math.max(2, avg - 1));
    }
  }
  if (Math.random() < GEAR_DROP || (first && st.boss)) {   // 掉落装备
    const type = pick(Object.keys(GEAR)), lv = first && st.boss ? 2 : 1;
    P.gear.push({ id: uid(), type, lv, on: null });
    extra.push(`${GEAR[type].icon} 掉落：${GEAR[type].name} Lv.${lv}`);
  }
  save();
  sfx('win'); speak('胜利！');
  await sleep(400);
  modal(`<div class="result"><h2>🏆 胜利！</h2>
    <div class="stars">${[0, 1, 2].map(k => `<span class="${k < stars ? '' : 'off'}" style="animation-delay:${0.2 + k * 0.25}s">⭐</span>`).join('')}</div>
    <p>答对 <b>${B.stats.right} / ${B.stats.q}</b> 题${B.stats.crit ? ` · 暴击 ${B.stats.crit} 次` : ''}<br><small>正确率 90% 以上 3 星，70% 以上 2 星</small></p>
    <p><b>🪙 +${B.coins + coinBonus}</b>（答题 ${B.coins} + 胜利 ${coinBonus}）${extra.length ? '<br>' + extra.join(' · ') : ''}</p>
    <div class="gains">${gains.map(g => `<div class="gain"><img src="${petImg(g.pet.sp, 64, g.pet.form)}" width="40" height="40" alt="">
      <span>${petName(g.pet)}<br><small>+${g.n} 经验</small></span>
      <div class="expbar"><i style="width:${g.pet.lv >= MAX_LEVEL ? 100 : g.pet.exp / expNeed(g.pet.lv) * 100}%"></i></div>
      <span class="${g.to > g.from ? 'lvup' : ''}">${g.to > g.from ? `升级！Lv.${g.to}` : `Lv.${g.to}`}</span></div>`).join('')}</div>
    ${gains.some(g => g.to >= EVOLVE_LV[g.pet.form] && g.pet.form < 2) ? '<p class="hint">✨ 有宠物可以进化了！去「我的宠物」看看</p>' : ''}
    <div class="row"><button class="btn ghost" data-act="again">再打一次</button><button class="btn" data-act="toMap">${joined ? '🎁 看看谁来了' : '回到地图'}</button></div></div>`, true);
  if (gains.some(g => g.to > g.from)) setTimeout(() => sfx('levelup'), 900);
  B.joined = joined;
}
async function lose() {
  B.over = true; B.busy = true;
  const gains = B.me.team.map(f => { const pet = petByUid(f.uid); const n = Math.round((B.exp[f.uid] || 0) + B.foe.team.reduce((a, x) => a + x.lv, 0) * 2); return { pet, n, ...giveExp(pet, n) }; });
  P.coins += B.coins;
  save();
  sfx('lose');
  modal(`<div class="result"><h2>😿 这次输了…</h2>
    <p>答对 <b>${B.stats.right} / ${B.stats.q}</b> 题 · 🪙 +${B.coins}</p>
    <div class="gains">${gains.map(g => `<div class="gain"><img src="${petImg(g.pet.sp, 64, g.pet.form)}" width="40" height="40" alt=""><span>${petName(g.pet)} +${g.n} 经验</span><span class="${g.to > g.from ? 'lvup' : ''}">Lv.${g.to}</span></div>`).join('')}</div>
    <p class="hint">💡 小提示：用克制对手的属性（🔥克🌿，🌿克⚡，⚡克💧，💧克🔥）、在商店买回血药水，或者先打前面的关卡让宠物升级。</p>
    <div class="row"><button class="btn ghost" data-act="toMap">回到地图</button><button class="btn" data-act="again">再试一次</button></div></div>`, true);
}
function showJoin(pet) {
  const d = PETS[pet.sp];
  sfx('join'); speak(`${d.name}想加入你的队伍！`);
  modal(`<div class="joinfx"><canvas class="pet live big" data-look="${pet.sp}" data-form="${pet.form || 0}"></canvas></div>
    <h2>🎉 ${petName(pet)} 加入了你的队伍！</h2><p>${rarityTag(pet.sp)}</p>
    <p><span class="tag" style="background:${ELEMENTS[d.el].light}">${ELEMENTS[d.el].icon} ${ELEMENTS[d.el].name}属性</span><span class="tag">${SUBJECTS[d.sub].icon} 擅长${SUBJECTS[d.sub].name}</span> Lv.${pet.lv}</p>
    <p class="hint">${d.desc}</p>
    <div class="row"><button class="btn big" data-act="closeJoin">太好了！</button></div>`, true);
}

// ================= 点击事件 =================
const ACTIONS = {};   // grow.js 等扩展模块注册的按钮动作
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-go]');
  if (!t) { if (e.target.id === 'modal' && !modalLock) closeModal(); return; }
  if (t.disabled) return;
  if (t.dataset.go) { sfx('tap'); closeModal(); go(t.dataset.go); return; }
  const a = t.dataset.act, d = t.dataset;
  switch (a) {
    case 'pickProfile': P = store.profiles.find(p => p.id === d.id); store.last = P.id; save(); sfx('tap'); go(P.starter ? 'home' : 'starter'); break;
    case 'npAvatar': npState.avatar = d.v; drawNewProfile(); break;
    case 'npZh': npState.zh = +d.v; drawNewProfile(); break;
    case 'npMath': npState.math = +d.v; drawNewProfile(); break;
    case 'createProfile': {
      const name = $('#npName').value.trim();
      if (!name) { toast('请先输入名字'); $('#npName').focus(); return; }
      P = newProfile(name, npState.avatar, npState.zh, npState.math);
      sfx('join'); go('starter'); break;
    }
    case 'pickStarter': {
      const sp = d.sp, D = PETS[sp];
      modal(`<canvas class="pet live big" data-look="${sp}"></canvas><h2>就选 ${D.name} 吗？</h2><p class="hint">${D.desc}</p>
        <div class="row"><button class="btn ghost" data-act="closeModal">再看看</button><button class="btn big" data-act="confirmStarter" data-sp="${sp}">就是你了！</button></div>`);
      break;
    }
    case 'confirmStarter': P.starter = d.sp; addPet(d.sp, 3); save(); closeModal(); showJoin(P.pets[0]); break;
    case 'closeJoin': closeModal(); go(screen === 'starter' ? 'home' : 'map'); break;
    case 'closeModal': closeModal(); break;
    case 'region': mapRegion = +d.i; sfx('tap'); RENDER.map(); break;
    case 'stage': sfx('tap'); openStage(+d.i); break;
    case 'pickTeam': openTeamPick(+d.i); break;
    case 'togglePick': {
      const k = teamPick.indexOf(d.uid);
      if (k >= 0) teamPick.splice(k, 1); else if (teamPick.length < 3) teamPick.push(d.uid); else toast('最多 3 只');
      sfx('tap'); drawTeamPick(+d.i); break;
    }
    case 'fight': if (teamPick.length) { P.team = teamPick.slice(); save(); startBattle(+d.i, teamPick); } break;
    case 'petInfo': openPetInfo(d.uid); break;
    case 'teamIn': if (P.team.length >= 3) { toast('队伍满了，先移出一只'); return; } P.team.push(d.uid); save(); closeModal(); RENDER.pets(); sfx('tap'); break;
    case 'teamOut': P.team = P.team.filter(x => x !== d.uid); save(); closeModal(); RENDER.pets(); sfx('tap'); break;
    case 'useExpCandy': {
      const pet = petByUid(d.uid); if (!pet || P.items.expCandy <= 0) return;
      P.items.expCandy--; pet.lv = Math.min(MAX_LEVEL, pet.lv + 1); save(); sfx('levelup'); toast(`${petName(pet)} 升到了 Lv.${pet.lv}！`); openPetInfo(d.uid); RENDER.pets(); break;
    }
    case 'buy': {
      const it = ITEMS[d.id]; if (P.coins < it.price) return;
      P.coins -= it.price; P.items[d.id] = (P.items[d.id] || 0) + 1; save(); sfx('buy'); toast(`买到了 ${it.icon} ${it.name}`); go('shop'); break;
    }
    case 'setGrade': P[d.k] = +d.v; save(); RENDER.settings(); break;
    case 'setTimer': P.settings.timer = d.v; save(); RENDER.settings(); break;
    case 'toggle': P.settings[d.k] = !P.settings[d.k]; save(); RENDER.settings(); break;
    case 'deleteProfile':
      modal(`<h2>真的要删除「${esc(P.name)}」吗？</h2><p>所有宠物和进度都会消失，不能恢复。</p><div class="row"><button class="btn ghost" data-act="closeModal">不删了</button><button class="btn red" data-act="reallyDelete">删除</button></div>`);
      break;
    case 'reallyDelete': store.profiles = store.profiles.filter(p => p !== P); P = null; save(); closeModal(); go('profiles'); break;
    // 对战
    case 'skill': useSkill(+d.i); break;
    case 'ult': useUlt(); break;
    case 'openSwitch': doSwitch(); break;
    case 'openItems': openItems(); break;
    case 'choose': if (chooser.res) { const r = chooser.res; chooser.res = null; r(+d.i); } break;
    case 'answer': answer(+d.i); break;
    case 'gotIt': if (Qs && Qs.got) Qs.got(); break;
    case 'repeatSay': if (Qs) speak(Qs.q.say); break;
    case 'quitBattle':
      if (!B || B.busy) return;
      modal(`<h2>要退出这场对战吗？</h2><p>退出不会得到奖励。</p><div class="row"><button class="btn ghost" data-act="closeModal">继续打</button><button class="btn red" data-act="reallyQuit">退出</button></div>`);
      break;
    default: if (ACTIONS[a]) ACTIONS[a](d, t); break;
    case 'reallyQuit': B.over = true; closeModal(); B = null; go('map'); break;
    case 'again': { const i = B.stageIdx; closeModal(); B = null; openTeamPick(i); break; }
    case 'toMap': { const j = B && B.joined; closeModal(); B = null; if (j) { screen = 'map'; go('map'); showJoin(j); } else go('map'); break; }
  }
});
// 答题时可以用键盘 1-4
document.addEventListener('keydown', e => { if (Qs && !Qs.done && /^[1-4]$/.test(e.key)) answer(+e.key - 1); });
// 主页点宠物会跳
document.addEventListener('pointerdown', e => { if (e.target.id === 'homeTeam') { heroJump = performance.now() / 1000; sfx('levelup'); } });
window.addEventListener('resize', () => { if (screen === 'map') drawRoad(); });

// ================= 开始 =================
(function boot() {
  go('profiles');
  requestAnimationFrame(loop);
})();

// 调试 / 自动测试用
window.__pets = {
  get B() { return B; }, get P() { return P; }, get Q() { return Qs; }, set P(v) { P = v; }, get store() { return store; }, get screen() { return screen; },
  set speed(v) { SPEED = v; }, auto: null, autoFast: null, go, startBattle, makeFighter, calcDamage, giveExp,
  setRegion(i) { mapRegion = i; },
};
