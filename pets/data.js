// 宠物学院大乱斗：属性、宠物、技能、道具、关卡
'use strict';

// ---------- 属性与克制 ----------
// 火 → 草 → 雷 → 水 → 火（前者克后者）；光、暗互相克制
const ELEMENTS = {
  fire:    { name: '火', icon: '🔥', color: '#ff7a2f', light: '#ffd0a8', beats: ['grass'] },
  grass:   { name: '草', icon: '🌿', color: '#3fb950', light: '#c8f0c0', beats: ['thunder'] },
  thunder: { name: '雷', icon: '⚡', color: '#f0b400', light: '#fff0a0', beats: ['water'] },
  water:   { name: '水', icon: '💧', color: '#2f8fe0', light: '#bfe2ff', beats: ['fire'] },
  light:   { name: '光', icon: '✨', color: '#e8a800', light: '#fff4c4', beats: ['dark'] },
  dark:    { name: '暗', icon: '🌑', color: '#7a4fd0', light: '#dccbff', beats: ['light'] },
};
function elementMult(atk, def) {
  if (!atk || !def) return 1;
  if (ELEMENTS[atk].beats.includes(def)) return 1.5;
  if (ELEMENTS[def].beats.includes(atk) && atk !== 'light' && atk !== 'dark') return 0.7;
  return 1;
}

// ---------- 科目 ----------
const SUBJECTS = {
  zh:   { name: '中文', icon: '📖', color: '#e0603a' },
  math: { name: '数学', icon: '🔢', color: '#2f8fe0' },
};

// ---------- 宠物 ----------
// base：1 级属性；每升 1 级：生命 +9、攻击 +2.2、防御 +1.8
// skills：kind = attack（power 威力，hard 题目难一级）/ heal / shield / buff / stealth；sub = 出题科目
const PETS = {
  huowei: {
    name: '火尾喵', py: 'huǒwěi miāo', el: 'fire', sub: 'zh', look: 'huowei',
    desc: '尾巴上有一团永不熄灭的小火苗，生气时火苗会变成蓝色。',
    base: { hp: 62, atk: 15, def: 9 },
    skills: [
      { name: '火球喵喵拳', kind: 'attack', power: 40, sub: 'zh' },
      { name: '烈焰尾扫', kind: 'attack', power: 60, sub: 'zh', hard: true },
      { name: '火花算术弹', kind: 'attack', power: 45, sub: 'math' },
      { name: '暖暖火光', kind: 'heal', sub: 'zh' },
    ],
    ult: '爆炎猫猫冲', rarity: 'R', forms: ['火尾喵', '炎爪猫', '烈焰狮王'],
  },
  paopao: {
    name: '泡泡獭', py: 'pàopao tǎ', el: 'water', sub: 'math', look: 'paopao',
    desc: '喜欢一边吐泡泡一边数数，能同时数清一百个泡泡。',
    base: { hp: 70, atk: 12, def: 12 },
    skills: [
      { name: '泡泡弹', kind: 'attack', power: 40, sub: 'math' },
      { name: '浪花冲击', kind: 'attack', power: 60, sub: 'math', hard: true },
      { name: '水墨字字波', kind: 'attack', power: 45, sub: 'zh' },
      { name: '泡泡护盾', kind: 'shield', sub: 'math' },
    ],
    ult: '巨浪大漩涡', rarity: 'R', forms: ['泡泡獭', '浪花獭', '潮汐獭将军'],
  },
  yeye: {
    name: '叶叶兔', py: 'yèye tù', el: 'grass', sub: 'zh', look: 'yeye',
    desc: '耳朵尖上长着两片嫩叶，晒太阳的时候会悄悄开花。',
    base: { hp: 66, atk: 13, def: 11 },
    skills: [
      { name: '飞叶快刀', kind: 'attack', power: 40, sub: 'zh' },
      { name: '藤蔓缠绕', kind: 'attack', power: 60, sub: 'zh', hard: true },
      { name: '种子计数炮', kind: 'attack', power: 45, sub: 'math' },
      { name: '光合治愈', kind: 'heal', sub: 'zh' },
    ],
    ult: '森林之怒', rarity: 'R', forms: ['叶叶兔', '花冠兔', '森林兔神'],
  },
  dianwan: {
    name: '电丸鼠', py: 'diànwán shǔ', el: 'thunder', sub: 'math', look: 'dianwan',
    desc: '圆滚滚的身体里存满了静电，跑得越快电力越强。',
    base: { hp: 58, atk: 16, def: 8 },
    skills: [
      { name: '电光一闪', kind: 'attack', power: 40, sub: 'math' },
      { name: '雷霆乘法炮', kind: 'attack', power: 60, sub: 'math', hard: true },
      { name: '静电写字球', kind: 'attack', power: 45, sub: 'zh' },
      { name: '充电加速', kind: 'buff', sub: 'math' },
    ],
    ult: '千雷轰顶', rarity: 'R', forms: ['电丸鼠', '闪电貂', '雷霆貂王'],
  },
  xingxing: {
    name: '星星鹿', py: 'xīngxing lù', el: 'light', sub: 'zh', look: 'xingxing',
    desc: '鹿角上挂着会发光的小星星，夜里会给迷路的宠物带路。',
    base: { hp: 68, atk: 13, def: 11 },
    skills: [
      { name: '星光箭', kind: 'attack', power: 40, sub: 'zh' },
      { name: '流星雨', kind: 'attack', power: 60, sub: 'zh', hard: true },
      { name: '月光几何', kind: 'attack', power: 45, sub: 'math' },
      { name: '圣光祝福', kind: 'heal', sub: 'zh' },
    ],
    ult: '银河星爆', rarity: 'SR', forms: ['星星鹿', '月光鹿', '极光圣鹿'],
  },
  yingzi: {
    name: '影子猫', py: 'yǐngzi māo', el: 'dark', sub: 'math', look: 'yingzi',
    desc: '能躲进任何影子里，眼睛在黑暗中像两颗小月亮。',
    base: { hp: 60, atk: 16, def: 9 },
    skills: [
      { name: '暗影爪', kind: 'attack', power: 40, sub: 'math' },
      { name: '夜幕突袭', kind: 'attack', power: 60, sub: 'math', hard: true },
      { name: '影字迷踪', kind: 'attack', power: 45, sub: 'zh' },
      { name: '隐身术', kind: 'stealth', sub: 'math' },
    ],
    ult: '暗月吞噬', rarity: 'SSR', forms: ['影子猫', '夜行豹', '暗月魔豹'],
  },

  // ---------- 第 2 版新增（从宠物蛋里孵出来） ----------
  huohu: {
    name: '小火狐', py: 'xiǎo huǒhú', el: 'fire', sub: 'math', look: 'huohu', rarity: 'SR', forms: ['小火狐', '九焰狐', '焚天狐仙'],
    desc: '蓬松的大尾巴尖上跳着狐火，最喜欢玩数字捉迷藏。',
    base: { hp: 60, atk: 16, def: 9 },
    skills: [
      { name: '狐火飞弹', kind: 'attack', power: 40, sub: 'math' },
      { name: '九尾炎阵', kind: 'attack', power: 60, sub: 'math', hard: true },
      { name: '火字连环', kind: 'attack', power: 45, sub: 'zh' },
      { name: '狐火鼓舞', kind: 'buff', sub: 'math' },
    ],
    ult: '焚天狐火',
  },
  yuanjing: {
    name: '圆圆鲸', py: 'yuányuan jīng', el: 'water', sub: 'zh', look: 'yuanjing', rarity: 'R', forms: ['圆圆鲸', '歌声鲸', '深海鲸皇'],
    desc: '头顶会喷出小喷泉，唱歌的时候整片海都会安静下来。',
    base: { hp: 74, atk: 12, def: 11 },
    skills: [
      { name: '水柱喷泉', kind: 'attack', power: 40, sub: 'zh' },
      { name: '鲸歌巨浪', kind: 'attack', power: 60, sub: 'zh', hard: true },
      { name: '数数泡泡', kind: 'attack', power: 45, sub: 'math' },
      { name: '海洋之歌', kind: 'heal', sub: 'zh' },
    ],
    ult: '万鲸齐鸣',
  },
  mogu: {
    name: '蘑菇龟', py: 'mógu guī', el: 'grass', sub: 'math', look: 'mogu', rarity: 'N', forms: ['蘑菇龟', '苔甲龟', '古树龟王'],
    desc: '背着一个小蘑菇慢慢走，算数却一点也不慢。',
    base: { hp: 72, atk: 11, def: 14 },
    skills: [
      { name: '孢子炮', kind: 'attack', power: 40, sub: 'math' },
      { name: '巨木撞击', kind: 'attack', power: 60, sub: 'math', hard: true },
      { name: '青苔字阵', kind: 'attack', power: 45, sub: 'zh' },
      { name: '硬壳防御', kind: 'shield', sub: 'math' },
    ],
    ult: '古树天罚',
  },
  mianyang: {
    name: '静电羊', py: 'jìngdiàn yáng', el: 'thunder', sub: 'zh', look: 'mianyang', rarity: 'N', forms: ['静电羊', '雷云羊', '天雷羊座'],
    desc: '羊毛蓬蓬的像一朵云，一摸就会噼里啪啦冒火花。',
    base: { hp: 66, atk: 13, def: 11 },
    skills: [
      { name: '静电毛球', kind: 'attack', power: 40, sub: 'zh' },
      { name: '雷云落雷', kind: 'attack', power: 60, sub: 'zh', hard: true },
      { name: '电光计算', kind: 'attack', power: 45, sub: 'math' },
      { name: '羊毛暖暖', kind: 'heal', sub: 'zh' },
    ],
    ult: '天雷万钧',
  },
  tianma: {
    name: '小天马', py: 'xiǎo tiānmǎ', el: 'light', sub: 'math', look: 'tianma', rarity: 'SSR', forms: ['小天马', '光翼马', '彩虹天马'],
    desc: '长着一对小翅膀，跑起来身后会留下一道彩虹。',
    base: { hp: 66, atk: 15, def: 10 },
    skills: [
      { name: '光羽箭', kind: 'attack', power: 40, sub: 'math' },
      { name: '彩虹冲锋', kind: 'attack', power: 60, sub: 'math', hard: true },
      { name: '天马行空', kind: 'attack', power: 45, sub: 'zh' },
      { name: '光之羽翼', kind: 'shield', sub: 'math' },
    ],
    ult: '彩虹天桥',
  },
  bianfu: {
    name: '小蝙蝠', py: 'xiǎo biānfú', el: 'dark', sub: 'zh', look: 'bianfu', rarity: 'N', forms: ['小蝙蝠', '月蝠', '深渊蝠王'],
    desc: '白天倒挂着睡觉，晚上用耳朵「听」出所有的字。',
    base: { hp: 58, atk: 15, def: 9 },
    skills: [
      { name: '超声波', kind: 'attack', power: 40, sub: 'zh' },
      { name: '暗夜俯冲', kind: 'attack', power: 60, sub: 'zh', hard: true },
      { name: '倒挂算术', kind: 'attack', power: 45, sub: 'math' },
      { name: '夜色隐身', kind: 'stealth', sub: 'math' },
    ],
    ult: '深渊回响',
  },
};
const STARTERS = ['huowei', 'paopao', 'yeye'];
const MAX_LEVEL = 30;
const ULT_POWER = 90;
const SUPPORT_CD = 3;   // 辅助技能用完要等 3 回合

const SUPPORT_TEXT = {
  heal: '恢复生命（答对 35%，答得快 45%，答错 20%）',
  shield: '护盾：接下来 2 次受到的伤害减半（答错只挡 1 次）',
  buff: '攻击力 ×1.4，持续 3 回合（答错 ×1.2）',
  stealth: '隐身：躲开对手下一次攻击（答错有一半机会）',
};

// ---------- 稀有度、星级、进化 ----------
const RARITY = {
  N:   { name: 'N',   color: '#8a9bb0', mul: 1.0 },
  R:   { name: 'R',   color: '#3fa9f5', mul: 1.06 },
  SR:  { name: 'SR',  color: '#a45cf0', mul: 1.12 },
  SSR: { name: 'SSR', color: '#ff9a00', mul: 1.2 },
};
const MAX_STAR = 5;
const STAR_NEED = 2;                    // 每升 1 星要吃掉 2 只相同的宠物
const starMul = star => 1 + 0.1 * (star - 1);
const EVOLVE_LV = [10, 20];            // 10 级、20 级可以进化
const FORM_MUL = [1, 1.12, 1.25];
const formName = (sp, form = 0) => (PETS[sp].forms || [PETS[sp].name])[form] || PETS[sp].name;
// pet 可以是 { sp, lv, star, form, gear }，也可以只传 sp 和 lv（对手）
function petStats(sp, lv, o = {}) {
  const b = PETS[sp].base, r = RARITY[PETS[sp].rarity || 'N'].mul;
  const m = r * starMul(o.star || 1) * FORM_MUL[o.form || 0];
  const g = o.gearBonus || { hp: 0, atk: 0, def: 0 };
  return {
    hp: Math.round((b.hp + 9 * (lv - 1)) * m * (1 + g.hp)),
    atk: Math.round((b.atk + 2.2 * (lv - 1)) * m * (1 + g.atk)),
    def: Math.round((b.def + 1.8 * (lv - 1)) * m * (1 + g.def)),
  };
}

// ---------- 宠物蛋 ----------
const EGGS = {
  normal: { name: '普通宠物蛋', price: 100, rates: { N: 0.6, R: 0.3, SR: 0.09, SSR: 0.01 }, colors: ['#fff4d6', '#7ccf6a'] },
  rare:   { name: '稀有宠物蛋', price: 300, rates: { N: 0, R: 0.5, SR: 0.38, SSR: 0.12 }, colors: ['#e6dcff', '#ffc531'] },
};
const HATCH_NEED = 3;                  // 答对 3 题唤醒宠物

// ---------- 装备 ----------
const GEAR = {
  collar: { name: '力量项圈', icon: '📿', stat: 'atk', statName: '攻击', price: 80 },
  cape:   { name: '守护披风', icon: '🧣', stat: 'def', statName: '防御', price: 80 },
  bell:   { name: '元气铃铛', icon: '🔔', stat: 'hp', statName: '生命', price: 80 },
};
const GEAR_MAX = 5;
const GEAR_BONUS = [0, 0.06, 0.12, 0.18, 0.25, 0.33];   // 1~5 级加成
const GEAR_DROP = 0.3;                                  // 打赢比赛掉落装备的机会
// 10 级以后升级越来越慢（后面的区域对手等级高、经验多）
const expNeed = lv => 12 + 8 * lv + 2 * Math.max(0, lv - 10) ** 2;

// ---------- 道具 ----------
const ITEMS = {
  potion:  { name: '回血药水', icon: '🧪', price: 30, desc: '恢复 50% 生命', battle: true },
  bubble:  { name: '护盾泡泡', icon: '🫧', price: 40, desc: '接下来 2 次受到的伤害减半', battle: true },
  candy:   { name: '力量糖', icon: '🍬', price: 40, desc: '攻击力 ×1.5，持续 3 回合', battle: true },
  feather: { name: '复活羽毛', icon: '🪶', price: 80, desc: '让一只倒下的宠物带着 50% 生命复活', battle: true },
  expCandy:{ name: '经验糖果', icon: '🍭', price: 100, desc: '让一只宠物直接升 1 级（在「我的宠物」里使用）', battle: false },
};
const BATTLE_ITEM_LIMIT = 3;

// ---------- 冒险地图 ----------
// 'S1'、'S2' 是玩家没选的另外两只初始宠物
const REGIONS = [
  {
    id: 'grass', name: '新手草原', icon: '🌳', sky: ['#9fe0ff', '#dff6ff'], ground: ['#8fd16a', '#6fb84a'], hill: '#a7d98a', deco: 'clouds',
    stages: [
      { id: 'g1', name: '草原入口', npc: '小路路', face: '🧒', talk: '你也是新生吗？我们来比一比！', team: [['S1', 2]], join: 'S1', easy: true, coins: 60 },
      { id: 'g2', name: '小河边', npc: '泡泡妹', face: '👧', talk: '我的宠物最喜欢在河边练习了！', team: [['S2', 3], ['S1', 2]], join: 'S2', easy: true, coins: 70 },
      { id: 'g3', name: '蒲公英坡', npc: '电电哥', face: '👦', talk: '小心！我的电丸鼠可是很快的！', team: [['dianwan', 4], ['S1', 3]], join: 'dianwan', reward: { egg_normal: 1 }, coins: 80 },
      { id: 'g4', name: '星光林', npc: '星星姐', face: '👩', talk: '星星会为答对题的人闪耀。', team: [['xingxing', 5], ['S2', 4], ['dianwan', 4]], join: 'xingxing', coins: 90 },
      { id: 'g5', name: '风车磨坊', npc: '磨坊爷爷', face: '👴', talk: '老头子我也年轻过，来吧！', team: [['huowei', 6], ['paopao', 6], ['yeye', 6]], reward: { feather: 1 }, coins: 110 },
      { id: 'g6', name: '擂台前哨', npc: '守门员小石', face: '🧑', talk: '想见阿木队长，先过我这一关！', team: [['dianwan', 7], ['xingxing', 7], ['S2', 7]], reward: { expCandy: 1, egg_normal: 1 }, coins: 130 },
      { id: 'g7', name: '草原擂台', npc: '擂台主 · 阿木队长', face: '🧔', talk: '我是草原擂台主！赢了我，你就能拿到草原徽章！', team: [['yeye', 9], ['xingxing', 9], ['yingzi', 10]], join: 'yingzi', boss: true, reward: { egg_rare: 1 }, badge: '🌿 草原徽章', coins: 300 },
    ],
  },
  {
    id: 'sea', name: '珊瑚海湾', icon: '🌊', sky: ['#7fd3ff', '#d8f4ff'], ground: ['#f5dc9a', '#e2bd72'], hill: '#4fb3e8', deco: 'waves',
    stages: [
      { id: 's1', name: '珊瑚滩', npc: '渔夫小海', face: '👨', talk: '海边的宠物可比草原的厉害多啦！', team: [['paopao', 10], ['yuanjing', 10]], coins: 150 },
      { id: 's2', name: '海星湾', npc: '潜水员阿蓝', face: '🧑', talk: '我在海底练了好久，接招吧！', team: [['yuanjing', 11], ['mogu', 11], ['paopao', 11]], reward: { egg_normal: 1 }, coins: 160 },
      { id: 's3', name: '灯塔下', npc: '灯塔姐姐', face: '👩', talk: '灯塔的光会照亮答对题的人！', team: [['dianwan', 12], ['yuanjing', 12], ['huohu', 11]], coins: 170 },
      { id: 's4', name: '沉船湾', npc: '船长老海', face: '👴', talk: '这艘沉船里藏着宝贝，赢了就送你！', team: [['bianfu', 13], ['paopao', 13], ['mianyang', 13]], reward: { feather: 1 }, coins: 180 },
      { id: 's5', name: '珍珠洞', npc: '珍珠公主', face: '👸', talk: '我的宠物闪闪发光，你看得清吗？', team: [['tianma', 13], ['yuanjing', 14], ['yeye', 14]], reward: { egg_normal: 1 }, coins: 190 },
      { id: 's6', name: '浪花台', npc: '冲浪少年', face: '🏄', talk: '跟上我的浪花节奏！', team: [['huohu', 15], ['dianwan', 15], ['paopao', 15]], reward: { expCandy: 1 }, coins: 210 },
      { id: 's7', name: '海湾擂台', npc: '擂台主 · 鲸歌船长', face: '🧜', talk: '我是海湾擂台主！听，我的鲸鱼在唱歌！', team: [['mogu', 16], ['mianyang', 16], ['yuanjing', 17]], boss: true, badge: '🌊 海湾徽章', reward: { egg_rare: 1 }, coins: 400 },
    ],
  },
  {
    id: 'volcano', name: '火山工坊', icon: '🌋', sky: ['#ff9a6a', '#ffd9b0'], ground: ['#7a5444', '#563a2e'], hill: '#9a6250', deco: 'lava',
    stages: [
      { id: 'v1', name: '火山脚下', npc: '工匠学徒', face: '🧑‍🔧', talk: '火山工坊可热了，小心别被烫到！', team: [['huowei', 17], ['huohu', 17]], coins: 220 },
      { id: 'v2', name: '温泉谷', npc: '温泉奶奶', face: '👵', talk: '泡完温泉，宠物们精神百倍！', team: [['yuanjing', 18], ['huowei', 18], ['mogu', 18]], reward: { egg_normal: 1 }, coins: 230 },
      { id: 'v3', name: '熔岩桥', npc: '守桥人', face: '💂', talk: '想过熔岩桥？先答对我的题！', team: [['huohu', 19], ['dianwan', 19], ['yingzi', 18]], coins: 240 },
      { id: 'v4', name: '火龙洞', npc: '探险家', face: '🧗', talk: '洞里好像住着火龙……', team: [['huowei', 20], ['bianfu', 20], ['tianma', 19]], reward: { feather: 1 }, coins: 250 },
      { id: 'v5', name: '铁匠铺', npc: '铁匠大叔', face: '👨‍🏭', talk: '我打的装备最结实了！', team: [['mogu', 20], ['huohu', 21], ['mianyang', 20]], reward: { egg_normal: 1 }, coins: 260 },
      { id: 'v6', name: '火山口', npc: '火焰舞者', face: '💃', talk: '跟着火焰一起跳舞吧！', team: [['xingxing', 21], ['huowei', 21], ['yuanjing', 21]], reward: { expCandy: 1 }, coins: 280 },
      { id: 'v7', name: '火山擂台', npc: '擂台主 · 炎铸大师', face: '🧙', talk: '我是火山擂台主！我的宠物是用火焰锻造的！', team: [['huohu', 22], ['tianma', 22], ['huowei', 23]], boss: true, badge: '🌋 火山徽章', reward: { egg_rare: 1 }, coins: 500 },
    ],
  },
  {
    id: 'storm', name: '雷鸣高原', icon: '⛈️', sky: ['#5b6b8c', '#a9b8d6'], ground: ['#5e7d5a', '#45603f'], hill: '#6f8a92', deco: 'storm',
    stages: [
      { id: 't1', name: '风暴入口', npc: '风筝男孩', face: '👦', talk: '风好大！我的风筝都飞走了！', team: [['mianyang', 23], ['dianwan', 23]], coins: 300 },
      { id: 't2', name: '雷云桥', npc: '气象员', face: '🧑‍🔬', talk: '今天的天气预报：有雷，有宠物对战！', team: [['dianwan', 24], ['paopao', 24], ['mianyang', 24]], reward: { egg_normal: 1 }, coins: 310 },
      { id: 't3', name: '闪电林', npc: '护林员', face: '🧝', talk: '树林里的闪电会帮我的宠物充电。', team: [['yeye', 24], ['mogu', 25], ['dianwan', 25]], coins: 320 },
      { id: 't4', name: '风车高地', npc: '风车爷爷', face: '👴', talk: '风车转得越快，我越开心！', team: [['tianma', 25], ['bianfu', 25], ['mianyang', 26]], reward: { feather: 1 }, coins: 330 },
      { id: 't5', name: '雷鸣塔', npc: '塔顶法师', face: '🧙‍♀️', talk: '能爬上雷鸣塔的人可不多！', team: [['huohu', 26], ['dianwan', 26], ['yuanjing', 26]], reward: { egg_normal: 1 }, coins: 340 },
      { id: 't6', name: '风暴眼', npc: '飞行员', face: '🧑‍✈️', talk: '风暴中间反而最安静哦。', team: [['yingzi', 27], ['mianyang', 27], ['tianma', 27]], reward: { expCandy: 1 }, coins: 360 },
      { id: 't7', name: '高原擂台', npc: '擂台主 · 雷霆队长', face: '🦸', talk: '我是高原擂台主！感受雷霆的力量吧！', team: [['mogu', 28], ['mianyang', 28], ['dianwan', 29]], boss: true, badge: '⚡ 高原徽章', reward: { egg_rare: 1 }, coins: 600 },
    ],
  },
  {
    id: 'castle', name: '星月城堡', icon: '🏰', sky: ['#2a1f5c', '#6b5bb0'], ground: ['#4a4070', '#352d55'], hill: '#3c3368', deco: 'stars',
    stages: [
      { id: 'c1', name: '城堡大门', npc: '守门骑士', face: '🤺', talk: '只有最厉害的学生才能进入星月城堡！', team: [['yingzi', 28], ['xingxing', 28]], coins: 380 },
      { id: 'c2', name: '星光长廊', npc: '画家', face: '🧑‍🎨', talk: '长廊里的每幅画都在看着你。', team: [['xingxing', 29], ['bianfu', 28], ['tianma', 28]], reward: { egg_normal: 1 }, coins: 400 },
      { id: 'c3', name: '月影图书馆', npc: '图书管理员', face: '🧑‍🏫', talk: '图书馆里的书，我全都读过！', team: [['bianfu', 29], ['yuanjing', 29], ['xingxing', 29]], coins: 420 },
      { id: 'c4', name: '镜子大厅', npc: '镜子魔法师', face: '🪄', talk: '镜子里的宠物，哪个才是真的？', team: [['tianma', 29], ['yingzi', 29], ['huohu', 29]], reward: { feather: 1 }, coins: 440 },
      { id: 'c5', name: '钟楼', npc: '敲钟人', face: '🔔', talk: '钟声响起，决战就要开始了！', team: [['xingxing', 30], ['mianyang', 30], ['mogu', 30]], reward: { egg_rare: 1 }, coins: 460 },
      { id: 'c6', name: '王座前厅', npc: '城堡管家', face: '🤵', talk: '院长就在里面等着你。', team: [['yingzi', 30], ['tianma', 30], ['huowei', 30]], reward: { expCandy: 2 }, coins: 500 },
      { id: 'c7', name: '学院冠军之战', npc: '院长 · 星月老师', face: '🧙‍♂️', talk: '恭喜你走到这里！最后一战，让我看看你学到了多少！', team: [['xingxing', 30], ['yingzi', 30], ['tianma', 30]], boss: true, final: true, badge: '👑 学院冠军', reward: { egg_rare: 2 }, coins: 1000 },
    ],
  },
];

// ---------- 第 3 版：天梯、每日任务、签到 ----------
const LADDER_TIERS = [
  { name: '青铜', icon: '🥉', pts: 0, lvAdd: -1 },
  { name: '白银', icon: '🥈', pts: 100, lvAdd: 0 },
  { name: '黄金', icon: '🥇', pts: 250, lvAdd: 1 },
  { name: '钻石', icon: '💎', pts: 450, lvAdd: 2 },
  { name: '冠军', icon: '🏆', pts: 700, lvAdd: 3 },
];
const LADDER_WIN = 25;
const LADDER_LOSE = 10;
const LADDER_NPCS = [['小艾', '👧'], ['阿乐', '👦'], ['朵朵', '👧'], ['大熊', '🧑'], ['米米', '👩'], ['豆豆', '👦'], ['星辰', '🧒'], ['可可', '👧'], ['阿杰', '🧑'], ['飞飞', '👦']];
const DAILY_POOL = [
  { id: 'right', name: '答对 20 题', target: 20, reward: { coins: 60 } },
  { id: 'zh', name: '答对 10 道中文题', target: 10, reward: { coins: 50 } },
  { id: 'math', name: '答对 10 道数学题', target: 10, reward: { coins: 50 } },
  { id: 'win', name: '打赢 3 场比赛', target: 3, reward: { coins: 80 } },
  { id: 'crit', name: '打出 5 次暴击', target: 5, reward: { coins: 60 } },
  { id: 'ult', name: '放 2 次必杀技', target: 2, reward: { coins: 60 } },
  { id: 'hatch', name: '孵化 1 个宠物蛋', target: 1, reward: { coins: 50 } },
  { id: 'mistake', name: '打败 1 次错题怪兽', target: 1, reward: { egg_normal: 1 } },
  { id: 'ladder', name: '天梯赛赢 1 场', target: 1, reward: { coins: 80 } },
];
const DAILY_ALL_BONUS = { egg_normal: 1 };   // 三个任务都完成再送一个蛋
const CHECKIN_REWARDS = [{ coins: 30 }, { coins: 40 }, { coins: 50 }, { coins: 60 }, { coins: 80 }, { coins: 100 }, { egg_rare: 1 }];
const MISTAKE_MAX = 40;

// ---------- 玩家设置 ----------
const AVATARS = ['🐱', '🐶', '🐰', '🦊', '🐼', '🐯', '🦁', '🐨', '🐸', '🐧', '🦄', '🐲'];
const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
const TIMERS = [
  { id: 'easy', name: '宽松', sec: 30 },
  { id: 'normal', name: '标准', sec: 20 },
  { id: 'fast', name: '挑战', sec: 12 },
];
