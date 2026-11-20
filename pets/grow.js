// 宠物学院大乱斗 第 2 版：我的宠物 / 图鉴、孵蛋屋、升星、进化、装备工坊
// 依赖 game.js 里的全局：P、B、go、RENDER、modal、ACTIONS、askQuestion、DRAW_HOOKS 等
'use strict';

// ================= 奖励 =================
function rewardText(k, n) {
  if (k.startsWith('egg_')) return `🥚 ${EGGS[k.slice(4)].name} ×${n}`;
  return `${ITEMS[k].icon} ${ITEMS[k].name} ×${n}`;
}
function giveReward(k, n) {
  if (k.startsWith('egg_')) P.eggs[k.slice(4)] = (P.eggs[k.slice(4)] || 0) + n;
  else P.items[k] = (P.items[k] || 0) + n;
}
const RARITY_ORDER = ['SSR', 'SR', 'R', 'N'];
const canEvolve = p => p.form < 2 && p.lv >= EVOLVE_LV[p.form];
const dupesOf = p => P.pets.filter(x => x.sp === p.sp && x.uid !== p.uid && !P.team.includes(x.uid)).sort((a, b) => a.lv - b.lv);
const canStar = p => p.star < MAX_STAR && dupesOf(p).length >= STAR_NEED;
// 只有在冒险中加入的宠物（其他的要从蛋里孵）
const STAGE_JOIN = new Set(['huowei', 'paopao', 'yeye', 'dianwan', 'xingxing', 'yingzi']);

// ================= 我的宠物 =================
RENDER.pets = () => {
  const team = P.team.map(id => petByUid(id)).filter(Boolean);
  $('#teamSlots').innerHTML = [0, 1, 2].map(k => {
    const p = team[k];
    return p ? `<div class="slot full" data-act="petInfo" data-uid="${p.uid}"><span class="ord">第 ${k + 1} 位</span>
        <canvas class="pet live" data-look="${p.sp}" data-form="${p.form}"></canvas><b>${petName(p)}</b><span class="stars">${starStr(p.star)}</span></div>`
      : `<div class="slot">空位<br><small>点下面的宠物加入</small></div>`;
  }).join('');
  $('#teamBonus').textContent = teamBonus(team.map(p => p.sp)) ? '✅ 中文 + 数学搭配：全队攻击 +10%' : '💡 同时带上擅长📖中文和🔢数学的宠物，全队攻击 +10%';
  const order = p => (P.team.includes(p.uid) ? 0 : 1) * 100 + RARITY_ORDER.indexOf(PETS[p.sp].rarity) * 10 - p.lv / 100;
  const list = P.pets.slice().sort((a, b) => order(a) - order(b));
  $('#petCount').textContent = `（${P.pets.length} 只）`;
  $('#petGrid').innerHTML = list.map((p, i) => {
    const d = PETS[p.sp], inTeam = P.team.includes(p.uid);
    const badge = canEvolve(p) ? '<span class="hot">✨ 可进化</span>' : canStar(p) ? '<span class="hot">⭐ 可升星</span>' : '';
    return `<div class="pet-c" data-act="petInfo" data-uid="${p.uid}" style="animation-delay:${Math.min(i, 12) * 0.03}s">${inTeam ? '<span class="in">出战</span>' : ''}<span class="el">${ELEMENTS[d.el].icon}</span>
      <img src="${petImg(p.sp, 96, p.form)}" style="width:100%" alt="">${rarityTag(p.sp)}<b>${petName(p)}</b>
      <span class="lv">Lv.${p.lv} · ${SUBJECTS[d.sub].icon} <span class="stars">${starStr(p.star)}</span></span>
      <div class="expbar"><i style="width:${p.lv >= MAX_LEVEL ? 100 : p.exp / expNeed(p.lv) * 100}%"></i></div>${badge}</div>`;
  }).join('');
  // 图鉴：12 只宠物，没有的显示剪影
  const sps = Object.keys(PETS), got = sps.filter(ownsSpecies).length;
  $('#dexCount').textContent = `${got} / ${sps.length}`;
  $('#dex').innerHTML = sps.map(sp => {
    const own = P.pets.filter(x => x.sp === sp), best = own.reduce((a, b) => (!a || b.form > a.form ? b : a), null);
    return own.length ? `<div class="dx" title="${PETS[sp].name}"><img src="${petImg(sp, 64, best.form)}" alt="">${rarityTag(sp)}<small>${formName(sp, best.form)}</small></div>`
      : `<div class="dx no"><img src="${petImg(sp, 64)}" alt="">${rarityTag(sp)}<small>${STAGE_JOIN.has(sp) ? '冒险中遇到' : '孵蛋屋'}</small></div>`;
  }).join('');
};

function openPetInfo(id) {
  const p = petByUid(id); if (!p) return;
  const d = PETS[p.sp], st = petFull(p), E = ELEMENTS[d.el], inTeam = P.team.includes(id);
  const dupes = dupesOf(p);
  const nextForm = p.form < 2 ? formName(p.sp, p.form + 1) : null;
  const gearSlots = Object.entries(GEAR).map(([type, g]) => {
    const it = P.gear.find(x => x.on === id && x.type === type);
    return `<button class="gslot ${it ? 'on' : ''}" data-act="gearPick" data-uid="${id}" data-type="${type}">
      <span class="gi">${g.icon}</span>${it ? `<b>Lv.${it.lv}</b><small>${g.statName} +${Math.round(GEAR_BONUS[it.lv] * 100)}%</small>` : `<small>${g.name}</small><small>点一下装备</small>`}</button>`;
  }).join('');
  modal(`<canvas class="pet live big" data-look="${p.sp}" data-form="${p.form}"></canvas>
    <h2>${petName(p)} <small>Lv.${p.lv}</small></h2>
    <p>${rarityTag(p.sp)} <span class="stars big">${starStr(p.star)}${'☆'.repeat(MAX_STAR - p.star)}</span></p>
    <p><span class="tag" style="background:${E.light}">${E.icon} ${E.name}属性</span><span class="tag">${SUBJECTS[d.sub].icon} 擅长${SUBJECTS[d.sub].name}</span>
      <span class="tag">进化：${(d.forms || [d.name]).map((n, k) => (k === p.form ? `<b>${n}</b>` : n)).join(' → ')}</span></p>
    <div class="expbar"><i style="width:${p.lv >= MAX_LEVEL ? 100 : p.exp / expNeed(p.lv) * 100}%"></i></div>
    <small>经验 ${p.exp} / ${expNeed(p.lv)}</small>
    <div class="stats"><div>${st.hp}<small>❤️ 生命</small></div><div>${st.atk}<small>⚔️ 攻击</small></div><div>${st.def}<small>🛡️ 防御</small></div></div>
    <div class="gslots">${gearSlots}</div>
    <div class="grow">
      ${p.form < 2 ? `<button class="btn ${canEvolve(p) ? 'glow' : ''}" data-act="evolve" data-uid="${id}" ${canEvolve(p) ? '' : 'disabled'}>✨ 进化成 ${nextForm}<small>${canEvolve(p) ? '答对 3 题里的 2 题' : `需要 Lv.${EVOLVE_LV[p.form]}`}</small></button>` : '<span class="tag">✨ 已经是终极形态</span>'}
      ${p.star < MAX_STAR ? `<button class="btn ${canStar(p) ? 'glow' : ''}" data-act="starUp" data-uid="${id}" ${canStar(p) ? '' : 'disabled'}>⭐ 升到 ${p.star + 1} 星<small>需要 ${STAR_NEED} 只相同宠物（有 ${dupes.length} 只）</small></button>` : '<span class="tag">⭐ 已经满星</span>'}
    </div>
    <p class="hint">${d.desc}${p.star < MAX_STAR && !canStar(p) ? '<br>💡 孵蛋屋孵出相同的宠物，就能用来升星（每升 1 星属性 +10%）。出战中的宠物不会被用掉。' : ''}</p>
    <div class="sklist">${d.skills.map(s => `<div><b>${s.name}</b> <span class="tag">${SUBJECTS[s.sub].icon} ${SUBJECTS[s.sub].name}</span>
      ${s.kind === 'attack' ? `威力 ${s.power}${s.hard ? '（难题）' : ''}` : SUPPORT_TEXT[s.kind]}</div>`).join('')}
      <div>🌟 <b>必杀技：${d.ult}</b>（连续答对 3 题后可用，威力 ${ULT_POWER + 10 * p.form}）</div></div>
    <div class="row">
      ${inTeam ? `<button class="btn ghost" data-act="teamOut" data-uid="${id}" ${P.team.length <= 1 ? 'disabled' : ''}>移出队伍</button>` : `<button class="btn green" data-act="teamIn" data-uid="${id}">加入队伍</button>`}
      ${P.items.expCandy > 0 && p.lv < MAX_LEVEL ? `<button class="btn" data-act="useExpCandy" data-uid="${id}">🍭 经验糖果（${P.items.expCandy}）</button>` : ''}
      <button class="btn ghost" data-act="closeModal">关闭</button></div>`);
}
ACTIONS.petInfo = d => openPetInfo(d.uid);

// ================= 升星 =================
ACTIONS.starUp = d => {
  const p = petByUid(d.uid); if (!p || !canStar(p)) return;
  const eat = dupesOf(p).slice(0, STAR_NEED);
  for (const e of eat) { for (const g of P.gear) if (g.on === e.uid) g.on = null; }
  P.pets = P.pets.filter(x => !eat.includes(x));
  p.star++;
  save();
  sfx('mergeBig');
  modal(`<div class="starfx">${eat.map((e, i) => `<img class="fly f${i}" src="${petImg(e.sp, 96, e.form)}" alt="">`).join('')}<img class="core" src="${petImg(p.sp, 96, p.form)}" alt=""></div>
    <h2>⭐ ${petName(p)} 升到 ${p.star} 星！</h2><p class="stars big">${starStr(p.star)}${'☆'.repeat(MAX_STAR - p.star)}</p>
    <p>生命、攻击、防御都变强了（+${(p.star - 1) * 10}%）</p>
    <div class="row"><button class="btn big" data-act="petInfo" data-uid="${p.uid}">太棒了！</button></div>`, true);
  speak(`${petName(p)}升到${p.star}星`);
  if (screen === 'pets') RENDER.pets();
};

// ================= 孵蛋屋 =================
RENDER.eggs = () => {
  $('#eggList').innerHTML = Object.entries(EGGS).map(([k, e]) => {
    const have = P.eggs[k] || 0, can = have > 0 || P.coins >= e.price;
    const rates = RARITY_ORDER.slice().reverse().filter(r => e.rates[r]).map(r => `<span class="rar" style="background:${RARITY[r].color}">${r} ${Math.round(e.rates[r] * 100)}%</span>`).join(' ');
    return `<div class="eggcard ${k}"><canvas class="egg" data-kind="${k}"></canvas>
      <div class="tx"><b>${e.name}</b><div>${rates}</div><small>已有 ${have} 个</small></div>
      <button class="btn" data-act="hatch" data-kind="${k}" ${can ? '' : 'disabled'}>${have ? '🥚 孵化' : `🪙 ${e.price} 孵化`}</button></div>`;
  }).join('');
};
// 孵蛋/进化仪式用同一个舞台画布
let H = null;
function stageCanvasDraw(t, dt) {
  if (screen !== 'hatch' || !H) return;
  const f = fitCanvas($('#hatchCv')); if (!f) return;
  const { ctx, w, h } = f;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.88, size = h * 0.62;
  const rc = H.rarity ? RARITY[H.rarity].color : '#ffd23a';
  if (H.phase === 'reveal' || H.phase === 'burst') {   // 旋转的光芒
    ctx.save(); ctx.translate(cx, h * 0.5); ctx.rotate(t * 0.6);
    for (let i = 0; i < 14; i++) { ctx.rotate(Math.PI / 7); ctx.fillStyle = i % 2 ? hexAlpha(rc, 0.35) : 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, -h); ctx.lineTo(30, -h); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  if (H.mode === 'egg') {
    if (H.phase !== 'reveal') {
      const shake = H.phase === 'burst' ? Math.min(1, (t - H.t0) / 1.2) * 2 : H.pulse > 0 ? 1 : 0.15;
      PetArt.egg(ctx, cx, cy, size * 0.95, t, { kind: H.kind, crack: H.crack, shake, glow: H.crack ? hexAlpha(rc, 0.25 + H.crack * 0.15) : null });
    }
  }
  if (H.mode === 'evolve' && H.phase !== 'reveal') {
    // 进化：新旧形态越闪越快
    let form = H.from;
    if (H.phase === 'burst') { const k = (t - H.t0); form = Math.floor(k * (3 + k * 10)) % 2 ? H.from + 1 : H.from; }
    PetArt.draw(ctx, H.pet.sp, cx, cy, size * 0.8, t, { form, white: H.phase === 'burst' ? 0.6 : 0, glow: hexAlpha(rc, 0.35) });
  }
  if (H.phase === 'reveal') {
    const k = Math.min(1, (t - H.t0) / 0.5), bounce = Math.sin(k * Math.PI) * 30;
    PetArt.draw(ctx, H.pet.sp, cx, cy - bounce, size * 0.8 * (0.6 + 0.4 * k), t, { form: H.pet.form, glow: hexAlpha(rc, 0.4) });
  }
  if (H.pulse > 0) H.pulse -= dt;
  if (H.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${H.flash})`; ctx.fillRect(0, 0, w, h); H.flash -= dt * 1.5; }
  // 孵蛋屋里的小蛋也会晃
}
function eggCardsDraw(t) {
  if (screen !== 'eggs') return;
  for (const c of $$('#s-eggs canvas.egg')) {
    const f = fitCanvas(c); if (!f) continue;
    f.ctx.clearRect(0, 0, f.w, f.h);
    PetArt.egg(f.ctx, f.w / 2, f.h * 0.95, f.h * 0.8, t + (c.dataset.kind === 'rare' ? 1 : 0), { kind: c.dataset.kind, shake: 0.3, glow: c.dataset.kind === 'rare' ? 'rgba(255,200,60,.45)' : null });
  }
}
DRAW_HOOKS.push(stageCanvasDraw, eggCardsDraw);
function hexAlpha(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

function rollPet(kind) {
  const rates = EGGS[kind].rates;
  let r = Math.random(), rar = 'N';
  for (const k of ['SSR', 'SR', 'R', 'N']) { if (r < (rates[k] || 0)) { rar = k; break; } r -= rates[k] || 0; }
  const pool = Object.keys(PETS).filter(sp => PETS[sp].rarity === rar);
  return { rar, sp: pick(pool) };
}
function setHatchUI(msg, prog, btns) {
  $('#hatchMsg').innerHTML = msg;
  $('#hatchProg').innerHTML = prog;
  $('#hatchBtns').innerHTML = btns;
}
const crackDots = n => `${'🟡'.repeat(n)}${'⚪'.repeat(HATCH_NEED - n)}`;

ACTIONS.hatch = d => {
  const k = d.kind, e = EGGS[k];
  if (P.eggs[k] > 0) P.eggs[k]--;
  else if (P.coins >= e.price) P.coins -= e.price;
  else { toast('金币不够，去冒险赚金币吧！'); return; }
  save(); sfx('buy');
  H = { mode: 'egg', kind: k, crack: 0, phase: 'wait', pulse: 0, flash: 0, rarity: null, q: 0 };
  $('#hatchTitle').textContent = `孵化${e.name}`;
  go('hatch');
  setHatchUI(`答对 ${HATCH_NEED} 题，把宠物从蛋里唤醒！`, crackDots(0), `<button class="btn big" data-act="hatchGo">开始答题</button>`);
};
ACTIONS.hatchGo = async () => {
  if (!H || H.phase !== 'wait') return;
  H.phase = 'quiz';
  setHatchUI('仔细想一想再回答哦～', crackDots(H.crack), '');
  while (H.crack < HATCH_NEED) {
    const sub = H.q++ % 2 ? 'math' : 'zh';
    const res = await askQuestion(sub, 0, { tag: `🥚 唤醒宠物蛋 · ${SUBJECTS[sub].icon} ${SUBJECTS[sub].name}`, kind: 'hatch' });
    if (screen !== 'hatch' || !H) return;
    if (res.correct) { H.crack++; H.pulse = 0.5; sfx('hit'); setHatchUI(H.crack < HATCH_NEED ? '蛋壳裂开了！继续！' : '要出来了！', crackDots(H.crack), ''); }
    else { setHatchUI('没关系，再来一题！', crackDots(H.crack), ''); }
    await sleep(500);
  }
  // 破壳
  const got = rollPet(H.kind);
  H.rarity = got.rar; H.phase = 'burst'; H.t0 = performance.now() / 1000;
  setHatchUI('……', crackDots(HATCH_NEED), '');
  sfx('ult');
  await sleep(1300);
  const isNew = !ownsSpecies(got.sp);
  const lvs = P.pets.map(p => p.lv).sort((a, b) => b - a);
  const lv = Math.max(3, (lvs[2] || lvs[0] || 3) - 1);   // 孵出来的宠物和队伍差不多强
  const pet = { uid: uid(), sp: got.sp, lv, exp: 0, star: 1, form: 0 };
  P.pets.push(pet);
  if (P.team.length < 3) P.team.push(pet.uid);
  save();
  H.pet = pet; H.phase = 'reveal'; H.t0 = performance.now() / 1000; H.flash = 1;
  sfx(got.rar === 'SSR' || got.rar === 'SR' ? 'mergeBig' : 'join');
  if (got.rar === 'SSR') setTimeout(() => sfx('win'), 600);
  speak(`${got.rar === 'SSR' ? '哇！超稀有！' : ''}${PETS[got.sp].name}`);
  const again = (P.eggs[H.kind] || 0) > 0 || P.coins >= EGGS[H.kind].price;
  setHatchUI(`<div class="rarbig" style="color:${RARITY[got.rar].color}">${got.rar}</div><b class="hname">${PETS[got.sp].name}</b> Lv.${lv}
    <br>${isNew ? '🎉 新宠物！加进了图鉴' : `已经有${PETS[got.sp].name}了 → 可以用来给它升星 ⭐`}`, '',
    `<button class="btn ghost" data-go="eggs">返回孵蛋屋</button>${again ? `<button class="btn" data-act="hatch" data-kind="${H.kind}">再孵一个</button>` : ''}<button class="btn green" data-act="viewPet" data-uid="${pet.uid}">去看看</button>`);
};
ACTIONS.viewPet = d => { go('pets'); openPetInfo(d.uid); };

// ================= 进化 =================
ACTIONS.evolve = async d => {
  const p = petByUid(d.uid); if (!p || !canEvolve(p)) return;
  closeModal();
  H = { mode: 'evolve', pet: p, from: p.form, phase: 'wait', pulse: 0, flash: 0, rarity: PETS[p.sp].rarity, right: 0 };
  $('#hatchTitle').textContent = '进化考验';
  go('hatch');
  setHatchUI(`${petName(p)} 想进化成 <b>${formName(p.sp, p.form + 1)}</b>！<br>进化考验：3 题里答对 2 题就能进化`, '⚪⚪⚪', `<button class="btn big" data-act="evolveGo">开始考验</button>`);
};
ACTIONS.evolveGo = async () => {
  if (!H || H.mode !== 'evolve' || H.phase !== 'wait') return;
  H.phase = 'quiz';
  const p = H.pet, sub = PETS[p.sp].sub, marks = [];
  for (let i = 0; i < 3; i++) {
    const res = await askQuestion(i === 2 ? (sub === 'zh' ? 'math' : 'zh') : sub, 0, { tag: `✨ 进化考验 · 第 ${i + 1} 题`, kind: 'evolve' });
    if (screen !== 'hatch' || !H) return;
    marks.push(res.correct ? '🟢' : '🔴'); if (res.correct) { H.right++; H.pulse = 0.4; }
    setHatchUI(`答对 ${H.right} 题`, marks.join('') + '⚪'.repeat(3 - marks.length), '');
    await sleep(400);
    if (H.right >= 2) break;
  }
  if (H.right < 2) {
    H.phase = 'wait';
    setHatchUI('差一点点！多练习一下，随时可以再来挑战进化考验。', marks.join(''), `<button class="btn ghost" data-go="pets">回到我的宠物</button><button class="btn" data-act="evolveRetry" data-uid="${p.uid}">再试一次</button>`);
    return;
  }
  H.phase = 'burst'; H.t0 = performance.now() / 1000;
  setHatchUI('咦？！' + petName(p) + ' 的样子……', '', '');
  sfx('ult'); speak('咦？' + petName(p) + '的样子');
  await sleep(2100);
  p.form++;
  save();
  H.phase = 'reveal'; H.t0 = performance.now() / 1000; H.flash = 1;
  sfx('levelup'); setTimeout(() => sfx('win'), 300);
  speak(`恭喜！进化成了${petName(p)}！`);
  setHatchUI(`🎉 进化成了 <b class="hname">${petName(p)}</b>！<br><small>属性大幅提升 · 必杀技威力 +10${p.form === 2 ? ' · 戴上了皇冠 👑' : ' · 披上了披风'}</small>`, '✨✨✨',
    `<button class="btn green" data-act="viewPet" data-uid="${p.uid}">看看新样子</button>`);
};
ACTIONS.evolveRetry = d => { H = null; ACTIONS.evolve(d); };

// ================= 装备 =================
RENDER.gear = () => {
  $('#gearList').innerHTML = Object.entries(GEAR).map(([type, g]) => {
    const items = P.gear.filter(x => x.type === type);
    const lvRows = [1, 2, 3, 4, 5].map(lv => {
      const all = items.filter(x => x.lv === lv), free = all.filter(x => !x.on);
      if (!all.length) return '';
      const worn = all.filter(x => x.on).map(x => petByUid(x.on)).filter(Boolean);
      return `<div class="glv"><span class="glvn">Lv.${lv}</span><span>×${all.length}<small> · ${g.statName} +${Math.round(GEAR_BONUS[lv] * 100)}%</small>
        ${worn.map(pt => `<img src="${petImg(pt.sp, 64, pt.form)}" title="${petName(pt)}" alt="">`).join('')}</span>
        ${lv < GEAR_MAX ? `<button class="btn small" data-act="gearMerge" data-type="${type}" data-lv="${lv}" ${free.length >= 2 ? '' : 'disabled'}>合成 → Lv.${lv + 1}</button>` : '<span class="tag">满级</span>'}</div>`;
    }).join('');
    return `<div class="gcard2"><div class="ghead"><span class="gi">${g.icon}</span><div><b>${g.name}</b><small>增加${g.statName}（Lv.1 +6% … Lv.5 +33%）</small></div>
      <button class="btn small" data-act="gearBuy" data-type="${type}" ${P.coins >= g.price ? '' : 'disabled'}>🪙 ${g.price} 买 Lv.1</button></div>
      ${lvRows || '<p class="hint">还没有，打赢比赛有机会掉落，也可以直接买</p>'}</div>`;
  }).join('');
};
ACTIONS.gearBuy = d => {
  const g = GEAR[d.type]; if (P.coins < g.price) return;
  P.coins -= g.price; P.gear.push({ id: uid(), type: d.type, lv: 1, on: null }); save(); sfx('buy'); toast(`买到了 ${g.icon} ${g.name} Lv.1`); go('gear');
};
ACTIONS.gearMerge = d => {
  const lv = +d.lv, free = P.gear.filter(x => x.type === d.type && x.lv === lv && !x.on);
  if (free.length < 2 || lv >= GEAR_MAX) return;
  const [a, b] = free;
  P.gear = P.gear.filter(x => x !== a && x !== b);
  P.gear.push({ id: uid(), type: d.type, lv: lv + 1, on: null });
  save(); sfx('merge');
  toast(`✨ 合成成功：${GEAR[d.type].icon} ${GEAR[d.type].name} Lv.${lv + 1}`);
  go('gear');
};
ACTIONS.gearPick = d => {
  const type = d.type, id = d.uid, g = GEAR[type];
  const items = P.gear.filter(x => x.type === type).sort((a, b) => b.lv - a.lv);
  const cur = items.find(x => x.on === id);
  modal(`<h2>${g.icon} 选择${g.name}</h2><p class="hint">装备会增加${g.statName}；如果装在别的宠物身上，会换过来</p>
    <div class="chooser">${items.length ? items.map(x => { const on = x.on && petByUid(x.on); return `<button data-act="gearWear" data-uid="${id}" data-gid="${x.id}" ${x.on === id ? 'disabled' : ''}>
      <span style="font-size:28px">${g.icon}</span><span style="flex:1">Lv.${x.lv} · ${g.statName} +${Math.round(GEAR_BONUS[x.lv] * 100)}%<br><small>${x.on === id ? '正在装备' : on ? `${petName(on)} 正在用` : '空闲'}</small></span></button>`; }).join('')
      : '<p>还没有这种装备。去 ⚒️ 装备工坊买，或者打赢比赛掉落。</p>'}</div>
    <div class="row">${cur ? `<button class="btn ghost" data-act="gearOff" data-uid="${id}" data-gid="${cur.id}">卸下</button>` : ''}<button class="btn ghost" data-act="petInfo" data-uid="${id}">返回</button></div>`);
};
ACTIONS.gearWear = d => {
  for (const x of P.gear) if (x.on === d.uid && x.type === P.gear.find(y => y.id === d.gid).type) x.on = null;
  const it = P.gear.find(x => x.id === d.gid); if (it) it.on = d.uid;
  save(); sfx('shield'); openPetInfo(d.uid);
};
ACTIONS.gearOff = d => { const it = P.gear.find(x => x.id === d.gid); if (it) it.on = null; save(); openPetInfo(d.uid); };
