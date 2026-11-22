// 宠物学院大乱斗 第 3 版：对战中心（天梯赛、双人对战、错题怪兽）、每日任务、签到
// 依赖 game.js / grow.js 里的全局：P、B、store、go、RENDER、modal、ACTIONS、HOOKS、startBattle 等
'use strict';

const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const weekKey = () => Math.floor((Date.now() / 86400000 + 3) / 7);
const shuffleArr = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const teamLevel = (prof = P) => { const lv = prof.team.map(id => (prof.pets.find(p => p.uid === id) || {}).lv || 1); return Math.round(lv.reduce((a, b) => a + b, 0) / Math.max(1, lv.length)); };
const openRegions = () => REGIONS.filter((r, i) => regionOpen(i));
function giveAny(k, n, prof = P) { if (k === 'coins') prof.coins += n; else if (k.startsWith('egg_')) prof.eggs[k.slice(4)] = (prof.eggs[k.slice(4)] || 0) + n; else prof.items[k] = (prof.items[k] || 0) + n; }
const anyText = (k, n) => (k === 'coins' ? `🪙 ${n}` : rewardText(k, n));

// ================= 对战中心 =================
RENDER.arena = () => {
  const L = ladder(), ti = tierIdx(L.pts), T = LADDER_TIERS[ti], next = LADDER_TIERS[ti + 1];
  const pct = next ? (L.pts - T.pts) / (next.pts - T.pts) * 100 : 100;
  const mist = (P.mistakes || []).length;
  const others = store.profiles.filter(p => p !== P && p.starter);
  $('#arenaBody').innerHTML = `
    <div class="acard ladder">
      <div class="ahead"><span class="aic">${T.icon}</span><div><b>天梯赛</b><small>和其他学院的学生比一比！每周一个赛季</small></div></div>
      <div class="tier"><b>${T.name}段位</b> · ${L.pts} 分 ${next ? `<small>（${next.icon} ${next.name}：${next.pts} 分）</small>` : '<small>（最高段位！）</small>'}</div>
      <div class="expbar"><i style="width:${pct}%"></i></div>
      <small>本赛季 ${L.wins} 胜 ${L.losses} 负 · 赢 +${LADDER_WIN} 分，输 −${LADDER_LOSE} 分 · 段位越高奖励越多</small>
      <button class="btn big" data-act="ladderGo">🏆 开始天梯赛</button></div>
    <div class="acard pvp">
      <div class="ahead"><span class="aic">👥</span><div><b>双人对战</b><small>和家里的另一位玩家用同一台设备轮流出招，各自答自己年级的题</small></div></div>
      <button class="btn big" data-act="pvpGo" ${others.length ? '' : 'disabled'}>⚔️ 选择对手</button>
      ${others.length ? '' : '<p class="hint">需要另一位玩家：回到「切换玩家」创建一个新玩家，选好初始宠物就能对战</p>'}</div>
    <div class="acard mist">
      <div class="ahead"><span class="aic">👾</span><div><b>错题怪兽</b><small>答错的题会变成错题怪兽，再答对一次就能把它打败，奖励翻倍！</small></div></div>
      <div class="tier">错题本里有 <b>${mist}</b> 道题</div>
      <div class="row center"><button class="btn ghost small" data-act="mistakeList" ${mist ? '' : 'disabled'}>📒 看看错题本</button>
      <button class="btn" data-act="mistakeGo" ${mist ? '' : 'disabled'}>👾 挑战错题怪兽</button></div></div>`;
  checkSeason();
};

// ================= 天梯 =================
function ladder(prof = P) {
  if (!prof.ladder) prof.ladder = { pts: 0, season: weekKey(), wins: 0, losses: 0, best: 0 };
  return prof.ladder;
}
const tierIdx = pts => { let k = 0; LADDER_TIERS.forEach((t, i) => { if (pts >= t.pts) k = i; }); return k; };
function checkSeason() {
  const L = ladder();
  if (L.season === weekKey()) return;
  const ti = tierIdx(L.pts), T = LADDER_TIERS[ti];
  const rew = { coins: 100 * (ti + 1) }; if (ti >= 3) rew.egg_rare = 1; else if (ti >= 1) rew.egg_normal = 1;
  for (const k in rew) giveAny(k, rew[k]);
  L.season = weekKey(); L.pts = Math.floor(L.pts / 2); L.wins = 0; L.losses = 0;
  save();
  modal(`<h2>🎊 新赛季开始了！</h2><p>上赛季你是 <b>${T.icon} ${T.name}段位</b></p>
    <p>赛季奖励：${Object.entries(rew).map(([k, n]) => anyText(k, n)).join(' · ')}</p>
    <p class="hint">新赛季积分减半，继续加油！</p><div class="row"><button class="btn big" data-act="closeModal">好的</button></div>`);
}
const LADDER_TALK = ['听说你很厉害，来比一比！', '我的宠物今天状态超好！', '这次我一定要赢！', '答题速度可是我的强项！', '我们学院的宠物也不弱哦！'];
ACTIONS.ladderGo = () => {
  if (!P.team.length) { toast('先在「我的宠物」里选好队伍'); return; }
  const L = ladder(), ti = tierIdx(L.pts);
  const lv = clamp(teamLevel() + LADDER_TIERS[ti].lvAdd, 2, MAX_LEVEL);
  const sps = shuffleArr(Object.keys(PETS)).slice(0, Math.min(3, P.team.length + 1));
  const [nm, face] = pick(LADDER_NPCS);
  const stage = { mode: 'ladder', id: 'ladder', name: '天梯赛', npc: `${LADDER_TIERS[ti].icon} ${nm}`, face, talk: pick(LADDER_TALK),
    team: sps.map(sp => [sp, clamp(lv + Math.round(rand(-1, 1)), 2, MAX_LEVEL)]), coins: 40 + 20 * ti, again: () => ACTIONS.ladderGo() };
  startBattle(stage, P.team.slice(), { region: pick(openRegions()) });
};
HOOKS.ladderResult = won => {
  if (!B || B.mode !== 'ladder') return [];
  const L = ladder(), before = tierIdx(L.pts);
  if (won) { L.pts += LADDER_WIN; L.wins++; HOOKS.track('ladder', 1, P); } else { L.pts = Math.max(0, L.pts - LADDER_LOSE); L.losses++; }
  L.best = Math.max(L.best, L.pts);
  const after = tierIdx(L.pts), out = [`🏆 天梯积分 ${won ? '+' + LADDER_WIN : '−' + LADDER_LOSE}（现在 ${L.pts} 分）`];
  if (after > before) { out.push(`🎉 升到了 ${LADDER_TIERS[after].icon} ${LADDER_TIERS[after].name}段位！`); setTimeout(() => sfx('levelup'), 1200); }
  save();
  return out;
};

// ================= 双人对战 =================
ACTIONS.pvpGo = () => {
  const others = store.profiles.filter(p => p !== P && p.starter);
  modal(`<h2>👥 选择对手</h2><p class="hint">两个人用同一台设备，轮流出招。每个人答自己年级的题。</p>
    <div class="chooser">${others.map(o => `<button data-act="pvpPick" data-id="${o.id}"><span style="font-size:34px">${o.avatar}</span>
      <span style="flex:1">${esc(o.name)}<br><small>📖 ${GRADES[o.gradeZh - 1]} · 🔢 ${GRADES[o.gradeMath - 1]}</small></span>
      ${o.team.map(id => { const pt = o.pets.find(x => x.uid === id); return pt ? `<img src="${petImg(pt.sp, 64, pt.form)}" width="40" height="40" alt="">` : ''; }).join('')}</button>`).join('')}</div>
    <div class="row"><button class="btn ghost" data-act="closeModal">返回</button></div>`);
};
ACTIONS.pvpPick = d => {
  const o = store.profiles.find(p => p.id === d.id); if (!o) return;
  normalizeProfile(o);
  const teamHtml = prof => prof.team.map(id => prof.pets.find(x => x.uid === id)).filter(Boolean)
    .map(pt => `<div><img src="${petImg(pt.sp, 96, pt.form)}" width="64" height="64" alt=""><br>${formName(pt.sp, pt.form)}<br>Lv.${pt.lv}</div>`).join('');
  modal(`<h2>⚔️ 双人对战</h2>
    <div class="vs"><div><b>${P.avatar} ${esc(P.name)}</b><div class="foes">${teamHtml(P)}</div></div>
    <div class="vsx">VS</div>
    <div><b>${o.avatar} ${esc(o.name)}</b><div class="foes">${teamHtml(o)}</div></div></div>
    <p class="hint">${esc(P.name)} 先出招。想换队伍的话，先到各自的「我的宠物」里调整。<br>赢的人 +50 🪙，输的人 +10 🪙，答对的题都有金币和经验。</p>
    <div class="row"><button class="btn ghost" data-act="closeModal">返回</button><button class="btn big" data-act="pvpStart" data-id="${o.id}">开始对战！</button></div>`);
};
ACTIONS.pvpStart = d => {
  const o = store.profiles.find(p => p.id === d.id); if (!o) return;
  const stage = { mode: 'pvp', id: 'pvp', name: '双人对战', npc: o.name, face: o.avatar, talk: '', coins: 0, again: () => ACTIONS.pvpStart(d) };
  startBattle(stage, P.team.slice(), { pvp: o, region: pick(openRegions()) });
};
async function pvpEnd(winner) {
  B.over = true; B.busy = true;
  const res = [B.me, B.foe].map(side => {
    const won = side === winner, prof = side.prof;
    const coins = side.coins + (won ? 50 : 10);
    prof.coins += coins;
    const gains = side.team.map(f => { const pet = prof.pets.find(x => x.uid === f.uid); const n = (B.exp[f.uid] || 0) + (won ? 30 : 15); return pet ? { pet, n, ...giveExp(pet, n) } : null; }).filter(Boolean);
    if (won) HOOKS.track('win', 1, prof);
    return { side, prof, won, coins, gains };
  });
  save();
  sfx('win'); speak(`${winner.prof.name}赢了！`);
  await sleep(400);
  modal(`<div class="result"><h2>🏆 ${winner.prof.avatar} ${esc(winner.prof.name)} 赢了！</h2>
    ${res.map(r => `<div class="pvpres ${r.won ? 'win' : ''}"><b>${r.prof.avatar} ${esc(r.prof.name)}</b> ${r.won ? '🏆' : ''}
      <span>答对 ${r.side.stats.right} / ${r.side.stats.q} 题 · 🪙 +${r.coins}</span>
      <div class="gains">${r.gains.map(g => `<div class="gain"><img src="${petImg(g.pet.sp, 64, g.pet.form)}" width="40" height="40" alt=""><span>${formName(g.pet.sp, g.pet.form)} +${g.n} 经验</span><span class="${g.to > g.from ? 'lvup' : ''}">Lv.${g.to}</span></div>`).join('')}</div></div>`).join('')}
    <p class="hint">比赛第一，友谊第二……开玩笑的，友谊第一！🤝</p>
    <div class="row"><button class="btn ghost" data-act="toMap">返回对战中心</button><button class="btn" data-act="again">再来一局</button></div></div>`, true);
}

// ================= 错题本 / 错题怪兽 =================
const mistakeKey = q => `${q.sub}|${q.html}|${q.opts[q.ans].t}`;
HOOKS.mistake = (prof, q) => {
  if (!prof || !q || !q.opts) return;
  prof.mistakes = prof.mistakes || [];
  const key = mistakeKey(q), old = prof.mistakes.find(m => m.key === key);
  if (old) { old.n++; old.t = Date.now(); return; }
  prof.mistakes.push({ key, q: JSON.parse(JSON.stringify(q)), t: Date.now(), n: 1 });
  while (prof.mistakes.length > MISTAKE_MAX) prof.mistakes.shift();
};
HOOKS.mistakeDone = (prof, q) => {
  if (!prof || !prof.mistakes) return;
  const key = mistakeKey(q);
  prof.mistakes = prof.mistakes.filter(m => m.key !== key);
  toast('👾 打败一道错题！从错题本里划掉了');
};
ACTIONS.mistakeList = () => {
  const list = (P.mistakes || []).slice().reverse();
  const plain = h => h.replace(/<span class="blank">.*?<\/span>/g, '（　）').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  modal(`<h2>📒 错题本（${list.length}）</h2><p class="hint">打败错题怪兽时再答对一次，题目就会被划掉</p>
    <div class="mlist">${list.map(m => `<div><span class="tag">${SUBJECTS[m.q.sub].icon} ${m.q.type}</span>${m.n > 1 ? ` <small>错了 ${m.n} 次</small>` : ''}<br>${esc(plain(m.q.html))}<br><small>正确答案：<b>${esc(m.q.opts[m.q.ans].t)}</b></small></div>`).join('')}</div>
    <div class="row"><button class="btn ghost" data-act="closeModal">关闭</button></div>`);
};
ACTIONS.mistakeGo = () => {
  const list = P.mistakes || [];
  if (!list.length) { toast('错题本是空的，太棒了！'); return; }
  if (!P.team.length) { toast('先在「我的宠物」里选好队伍'); return; }
  // 出题队列：最多 9 道错题，选项重新打乱
  const mq = shuffleArr(list.slice()).slice(0, 9).map(m => {
    const q = JSON.parse(JSON.stringify(m.q)), right = q.opts[q.ans];
    q.opts = shuffleArr(q.opts); q.ans = q.opts.indexOf(q.opts.find(o => o.t === right.t && o.py === right.py));
    return q;
  });
  const n = clamp(Math.ceil(mq.length / 3), 1, 3), lv = teamLevel();
  const foes = Array.from({ length: n }, () => {
    const sp = pick(Object.keys(PETS)), f = makeFighter(sp, lv, { form: foeForm(lv), hpMul: 0.85 });
    f.monster = true; f.name = '错题怪兽'; return f;
  });
  const stage = { mode: 'mistake', id: 'mistake', name: '错题怪兽', npc: '错题怪兽', face: '👾', talk: '嘿嘿，这些题你上次答错了，还记得吗？', team: [], coins: 60, again: () => ACTIONS.mistakeGo() };
  startBattle(stage, P.team.slice(), { foes, mq, region: REGIONS[REGIONS.length - 1] });
};

// ================= 每日任务 =================
function daily(prof = P) {
  const today = localDate();
  if (!prof.daily || prof.daily.date !== today) {
    // 用玩家 id + 日期做种子，每天固定 3 个任务
    let seed = 0; for (const ch of prof.id + today) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const pool = DAILY_POOL.slice(), picks = [];
    while (picks.length < 3) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    prof.daily = { date: today, tasks: picks.map(t => ({ id: t.id, prog: 0, claimed: false })), bonus: false };
  }
  return prof.daily;
}
const taskDef = id => DAILY_POOL.find(t => t.id === id);
HOOKS.track = (ev, n = 1, prof = P) => {
  if (!prof) return;
  const d = daily(prof);
  for (const t of d.tasks) if (t.id === ev && !t.claimed) t.prog = Math.min(taskDef(t.id).target, t.prog + n);
};
const claimable = (prof = P) => { const d = daily(prof); return d.tasks.filter(t => !t.claimed && t.prog >= taskDef(t.id).target).length + (d.tasks.every(t => t.claimed) && !d.bonus ? 1 : 0); };
function openDaily() {
  const d = daily();
  const all = d.tasks.every(t => t.claimed);
  modal(`<h2>📅 每日任务</h2><p class="hint">每天 3 个任务，第二天会换新的</p>
    <div class="tasks">${d.tasks.map((t, i) => { const def = taskDef(t.id), done = t.prog >= def.target;
      return `<div class="task ${t.claimed ? 'claimed' : done ? 'done' : ''}"><div class="tt"><b>${def.name}</b><small>${t.prog} / ${def.target} · 奖励 ${Object.entries(def.reward).map(([k, n]) => anyText(k, n)).join(' ')}</small>
        <div class="expbar"><i style="width:${t.prog / def.target * 100}%"></i></div></div>
        ${t.claimed ? '<span class="tag">✅ 已领取</span>' : `<button class="btn small" data-act="claimTask" data-i="${i}" ${done ? '' : 'disabled'}>领取</button>`}</div>`; }).join('')}
      <div class="task bonus ${d.bonus ? 'claimed' : all ? 'done' : ''}"><div class="tt"><b>🎁 完成全部 3 个任务</b><small>奖励 ${Object.entries(DAILY_ALL_BONUS).map(([k, n]) => anyText(k, n)).join(' ')}</small></div>
        ${d.bonus ? '<span class="tag">✅ 已领取</span>' : `<button class="btn small" data-act="claimBonus" ${all ? '' : 'disabled'}>领取</button>`}</div></div>
    <div class="row"><button class="btn ghost" data-act="closeModal">关闭</button></div>`);
}
ACTIONS.daily = () => openDaily();
ACTIONS.claimTask = d => {
  const t = daily().tasks[+d.i], def = taskDef(t.id);
  if (t.claimed || t.prog < def.target) return;
  t.claimed = true; for (const k in def.reward) giveAny(k, def.reward[k]);
  save(); sfx('coin'); sfx('buy'); toast(`领取了 ${Object.entries(def.reward).map(([k, n]) => anyText(k, n)).join(' ')}`);
  openDaily(); if (screen === 'home') RENDER.home();
};
ACTIONS.claimBonus = () => {
  const d = daily(); if (d.bonus || !d.tasks.every(t => t.claimed)) return;
  d.bonus = true; for (const k in DAILY_ALL_BONUS) giveAny(k, DAILY_ALL_BONUS[k]);
  save(); sfx('join'); toast('🎁 全部完成！');
  openDaily(); if (screen === 'home') RENDER.home();
};

// ================= 签到 =================
function checkIn() {
  const today = localDate(), c = P.checkin || { last: null, streak: 0 };
  if (c.last === today) return false;
  const y = new Date(); y.setDate(y.getDate() - 1);
  c.streak = c.last === localDate(y) ? c.streak + 1 : 1;
  c.last = today; P.checkin = c;
  const day = (c.streak - 1) % 7, rew = CHECKIN_REWARDS[day];
  for (const k in rew) giveAny(k, rew[k]);
  save();
  sfx('join');
  modal(`<h2>📆 每日签到</h2><p>已经连续签到 <b>${c.streak}</b> 天！</p>
    <div class="checkin">${CHECKIN_REWARDS.map((r, i) => `<div class="cday ${i < day ? 'got' : i === day ? 'today' : ''}"><small>第 ${i + 1} 天</small><b>${Object.entries(r).map(([k, n]) => (k === 'coins' ? `🪙${n}` : '🥚')).join('')}</b>${i < day ? '✅' : i === day ? '🎁' : ''}</div>`).join('')}</div>
    <p>今天的奖励：${Object.entries(rew).map(([k, n]) => anyText(k, n)).join(' ')}</p>
    <p class="hint">连续签到 7 天送稀有宠物蛋！断了会从第 1 天重新开始。</p>
    <div class="row"><button class="btn big" data-act="closeModal">好的！</button></div>`);
  return true;
}

// 主页：加上每日任务按钮，第一次进来自动签到
const baseHome = RENDER.home;
RENDER.home = () => {
  if (!$('#modal.show')) checkIn();   // 先签到，金币数字才是最新的
  baseHome();
  const n = claimable();
  $('#homeHud').insertAdjacentHTML('beforeend', `<button class="dailybtn" data-act="daily">📅${n ? `<i>${n}</i>` : ''}</button>`);
  const L = ladder();
  $('#homeArena').textContent = `${LADDER_TIERS[tierIdx(L.pts)].icon} ${LADDER_TIERS[tierIdx(L.pts)].name} · 错题 ${(P.mistakes || []).length}`;
};
