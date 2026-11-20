// 游戏数据：武器、道具、敌人，以及分级中文学习题库（识字、偏旁、词语、成语、古诗、读音）
'use strict';

// ---------- 年级分级 ----------
// GRADE_LEVELS 和中文题库在 ../shared/zh-bank.js（猫咪保卫战和宠物学院共用）

// ---------- 武器 ----------
// cost：购买一把 D 级的价格；splash：[从第几阶开始, 起始半径, 每阶增加] 命中后的溅射范围
// 武器价格：豌豆手枪 80、毛线散弹枪 120、鱼骨冲锋枪 160、罐头榴弹炮 200、激光逗猫笔 240；
// 每把武器的攻击力（每秒伤害）跟价格成正比。
const WEAPONS = [
  { id: 'pistol', name: '豌豆手枪', py: 'wāndòu shǒuqiāng', desc: '可靠的基础武器，命中时炸开豌豆汁。C 级起有溅射。', cost: 80,
    dmg: 14, interval: 0.36, speed: 560, count: 1, spread: 0, jitter: 0.03, pierce: 0, explode: 0, life: 0.9, r: 5, color: '#6fd24a', splash: [1, 26, 9] },
  { id: 'shotgun', name: '毛线散弹枪', py: 'máoxiàn sǎndànqiāng', desc: '打出一扇毛线球，每升一阶多一颗，覆盖更广。B 级起有溅射。', cost: 120,
    dmg: 8.75, interval: 0.75, speed: 480, count: 5, spread: 0.55, jitter: 0, pierce: 0, explode: 0, life: 0.45, r: 6, color: '#ff8fb1', splash: [2, 24, 8] },
  { id: 'smg', name: '鱼骨冲锋枪', py: 'yúgǔ chōngfēngqiāng', desc: '射速非常快，单发伤害低。A 级起有溅射。', cost: 160,
    dmg: 8.56, interval: 0.11, speed: 640, count: 1, spread: 0, jitter: 0.12, pierce: 0, explode: 0, life: 0.75, r: 4, color: '#f4f4f4', splash: [3, 20, 8] },
  { id: 'grenade', name: '罐头榴弹炮', py: 'guàntou liúdànpào', desc: '罐头落地爆炸，范围随品级变大。', cost: 200,
    dmg: 97.22, interval: 1.0, speed: 380, count: 1, spread: 0, jitter: 0.02, pierce: 0, explode: 85, life: 0.85, r: 8, color: '#c9a35a' },
  { id: 'laser', name: '激光逗猫笔', py: 'jīguāng dòumāobǐ', desc: '激光穿透一整排敌人，品级越高光束越粗。', cost: 240,
    dmg: 58.33, interval: 0.5, speed: 950, count: 1, spread: 0, jitter: 0, pierce: 99, explode: 0, life: 0.6, r: 5, color: '#ff4040' },
];

// ---------- 品级与合成 ----------
// dmg / spd：伤害和射击间隔的倍数；need：合成成下一阶需要几把相同的武器（第 i 项 = 把 i 阶合成 i+1 阶）
const TIERS = [
  { id: 'D', name: '普通', color: '#a8794a', dmg: 1, spd: 1 },
  { id: 'C', name: '优秀', color: '#4fb83c', dmg: 1.9, spd: 0.94 },
  { id: 'B', name: '精良', color: '#3d8bff', dmg: 3.5, spd: 0.88 },
  { id: 'A', name: '史诗', color: '#a45cf0', dmg: 6.5, spd: 0.82 },
  { id: 'S', name: '传说', color: '#ffb300', dmg: 11, spd: 0.76 },
  { id: 'SSS', name: '神话', color: '#ff5e9a', dmg: 18, spd: 0.68 },
];
const MERGE_NEED = [2, 2, 2, 3, 3];

// ---------- 道具 ----------
// 解锁顺序就是下面的排列顺序：猫薄荷开局就有，之后每打败一个头目按顺序解锁下一个（炮塔、冲击波……）
// pack：一次购买得到的使用次数；manual 为手动使用道具，其余每关开始时自动消耗 1 次
// 道具买一次永久拥有、不限次数；再买一份可以「合成升级」，最高 5 级
// manual：手动使用的道具（用完后要冷却 cool(lv) 秒）；multi：最多能同时拥有几个（炮塔、飞镖）
const ITEMS = [
  { id: 'catnip', name: '猫薄荷', py: 'māo bòhe', desc: '永久拥有。手动使用（空格键或按钮）：一段时间内移动和射击都变快，效果结束后冷却一会儿可以再用。', manual: true, key: '空格', cost: 45, max: 5,
    cool: lv => 22 - 2 * lv, eff: lv => `持续 ${5 + 2 * lv} 秒 · 冷却 ${22 - 2 * lv} 秒` },
  { id: 'turret', name: '自动炮塔', py: 'zìdòng pàotǎ', desc: '永久拥有，在猫窝旁自动射击。每买一座多一座（最多 4 座）；合成升级让所有炮塔更强。', multi: 4, unit: '座', cost: 300, max: 5,
    eff: lv => lv === 1 ? '基础强度' : `伤害 +${35 * (lv - 1)}%，射速 +${Math.round(100 / (1 - 0.08 * (lv - 1)) - 100)}%` },
  { id: 'shockwave', name: '冲击波', py: 'chōngjībō', desc: '永久拥有。手动使用（F 键或按钮）：全屏敌人被震晕并震退五格，同时震碎敌方弹幕；用后冷却一会儿可以再用。', manual: true, key: 'F', cost: 300, max: 5,
    cool: lv => 32 - 3 * lv, eff: lv => `眩晕 ${(1.2 + 0.4 * (lv - 1)).toFixed(1)} 秒 · 冷却 ${32 - 3 * lv} 秒${lv > 1 ? ` · 伤害 +${35 * (lv - 1)}%` : ''}` },
  { id: 'fence', name: '铁丝围栏', py: 'tiěsī wéilán', desc: '永久拥有。每关围住猫窝，靠近的敌人会变慢。', cost: 60, max: 5, eff: lv => `减速 ${Math.round(100 * (0.12 + 0.08 * lv))}%` },
  { id: 'magnet', name: '磁铁项圈', py: 'cítiě xiàngquān', desc: '永久拥有。从更远的地方吸来小鱼干。', cost: 40, max: 5, eff: lv => `吸取范围 ${60 + 55 * lv}` },
  { id: 'shuriken', name: '旋转飞镖', py: 'xuánzhuǎn fēibiāo', desc: '永久拥有，绕着猫窝高速旋转切碎敌人。每买一枚多一枚（最多 4 枚）；合成升级让所有飞镖更强。', multi: 4, unit: '枚', cost: 80, max: 5,
    eff: lv => lv === 1 ? '基础强度' : `伤害 +${35 * (lv - 1)}%，转速 +${12 * (lv - 1)}%` },
  { id: 'lightning', name: '闪电云', py: 'shǎndiàn yún', desc: '永久拥有。猫窝上空的雷云定时劈中附近的敌人。', cost: 130, max: 5,
    eff: lv => `每次劈 ${lv + 1} 个敌人 · 每 ${Math.max(1.2, 3.4 - 0.4 * lv).toFixed(1)} 秒` },
  { id: 'helper', name: '小猫助手', py: 'xiǎomāo zhùshǒu', desc: '永久拥有。小猫跟着你一起开枪，3 级起变成两只。', cost: 140, max: 5,
    eff: lv => `${lv >= 3 ? 2 : 1} 只小猫${lv > 1 ? ` · 伤害 +${35 * (lv - 1)}%` : ''}` },
];

const STATS = [
  { id: 'catHp', name: '猫咪护甲', py: 'māomī hùjiǎ', desc: '猫咪生命上限 +25（每关开始自动回满），不限等级。前 10 级每级换一身新装备，之后换颜色。', max: Infinity },
  { id: 'catSpd', name: '猫咪速度', py: 'māomī sùdù', desc: '猫咪跑得更快。', max: 5 },
  { id: 'nestHp', name: '加固猫窝', py: 'jiāgù māowō', desc: '猫窝生命上限 +100，并立刻回满生命，不限等级。前 10 级每级换新样子（大猫窝、猫别墅、猫城堡……），之后换颜色。3 级起解锁「导弹防御」，每关 1 次；之后每升 3 级每关多 1 次（6 级 2 次、9 级 3 次……）。', max: Infinity },
];

// w：出现权重；from：第几关开始出现；group：一次出现几只
// target：'nest' 攻击猫窝，'cat' 追着猫打
// weak：弱小的敌人，关卡越高出现得越少；tip：第一次遇到时显示的说明
const ENEMIES = {
  mouse:   { name: '老鼠小兵', py: 'lǎoshǔ xiǎobīng', tip: '最常见的小敌人，冲向猫窝', hp: 22, spd: 68, r: 13, dmg: 3, fish: [1, 2], target: 'nest', from: 1, w: 10, weak: true },
  roach:   { name: '飞奔蟑螂', py: 'fēibēn zhāngláng', tip: '成群结队，追着猫咬', hp: 9, spd: 135, r: 9, dmg: 4, fish: [1, 1], target: 'cat', from: 2, w: 4, group: 3, weak: true },
  raccoon: { name: '浣熊盗贼', py: 'huànxióng dàozéi', tip: '皮厚，专偷猫窝', hp: 70, spd: 44, r: 19, dmg: 8, fish: [4, 6], target: 'nest', from: 3, w: 2 },
  crow:    { name: '乌鸦投弹手', py: 'wūyā tóudànshǒu', tip: '在空中朝猫丢炸弹', hp: 32, spd: 85, r: 14, dmg: 8, fish: [3, 4], target: 'cat', ranged: true, pdmg: 0.7, from: 4, w: 3 },
  boar:    { name: '冲撞野猪', py: 'chōngzhuàng yězhū', tip: '蓄力后直线冲向猫，快躲开', hp: 80, spd: 58, r: 20, dmg: 9, fish: [5, 7], target: 'cat', charger: true, from: 7, w: 3 },
  bat:     { name: '吸血蝙蝠', py: 'xīxuè biānfú', tip: '又快又乱的飞行敌人，专追猫', hp: 16, spd: 150, r: 10, dmg: 3, fish: [2, 3], target: 'cat', flyer: true, from: 8, w: 3, group: 2, weak: true },
  bomber:  { name: '自爆老鼠', py: 'zìbào lǎoshǔ', tip: '冲上来就爆炸，别让它靠近', hp: 34, spd: 100, r: 13, dmg: 10, fish: [3, 4], target: 'near', bomber: true, from: 10, w: 3 },
  snake:   { name: '毒蛇', py: 'dúshé', tip: '远远地吐出三发毒液', hp: 40, spd: 62, r: 14, dmg: 8, fish: [4, 5], target: 'cat', ranged: true, shots: 3, pdmg: 0.5, pcol: '#7ed957', rcd: 2.8, pspd: 190, from: 12, w: 3 },
  bear:    { name: '黑熊', py: 'hēixióng', tip: '皮糙肉厚，一掌拍坏猫窝', hp: 250, spd: 40, r: 26, dmg: 18, fish: [9, 12], target: 'nest', from: 14, w: 2 },
  healer:  { name: '医疗兔', py: 'yīliáo tù', tip: '给周围的敌人回血，先打它', hp: 60, spd: 52, r: 13, dmg: 3, fish: [5, 6], target: 'nest', healer: true, from: 15, w: 2 },
  slime:   { name: '软泥怪', py: 'ruǎnní guài', tip: '被打败后会分裂成两只小的', hp: 90, spd: 54, r: 17, dmg: 8, fish: [4, 6], target: 'nest', splits: true, from: 17, w: 3 },
  elite:   { name: '铁桶鼠队长', hp: 180, spd: 50, r: 24, dmg: 9, fish: [14, 18], target: 'nest' },
  boss:    { name: '头目', hp: 520, spd: 34, r: 40, dmg: 14, fish: [40, 50], target: 'nest' },
};

// 敌人的强度分级：颜色越深、个头越大、越难打。size/hp/dmg/spd/fish 都是倍数
const ETIERS = [
  { name: '普通', size: 1, hp: 1, dmg: 1, spd: 1, fish: 1, tint: null, alpha: 0, bar: '#ff7a5c' },
  { name: '强化', size: 1.25, hp: 1.5, dmg: 1.2, spd: 1, fish: 1.8, tint: '#3d8bff', alpha: 0.34, bar: '#4f9dff' },
  { name: '精英', size: 1.5, hp: 2.4, dmg: 1.45, spd: 0.95, fish: 3, tint: '#a45cf0', alpha: 0.4, bar: '#b57cf5' },
  { name: '狂暴', size: 1.8, hp: 3.8, dmg: 1.75, spd: 0.9, fish: 5, tint: '#ff3b2f', alpha: 0.46, bar: '#ff5a4a' },
];

// 战斗中随机掉落的增益。ch：掉落物上显示的汉字；dur：持续秒数（0 = 立刻生效）
const BUFFS = [
  { id: 'giant', ch: '大', name: '变大', py: 'biàn dà', tip: '变成巨猫，踩扁敌人', color: '#f5b300', dur: 6 },
  { id: 'power', ch: '力', name: '力量', py: 'lìliàng', tip: '攻击力加倍', color: '#ff6b5e', dur: 8 },
  { id: 'rapid', ch: '快', name: '快速', py: 'kuàisù', tip: '射击变快', color: '#ffa726', dur: 8 },
  { id: 'shield', ch: '盾', name: '护盾', py: 'hùdùn', tip: '暂时不会受伤', color: '#5aa9ff', dur: 6 },
  { id: 'freeze', ch: '冰', name: '冰冻', py: 'bīngdòng', tip: '敌人被冻住', color: '#45c4d8', dur: 4 },
  { id: 'heal', ch: '心', name: '爱心', py: 'àixīn', tip: '恢复生命', color: '#ff7fa8', dur: 0 },
  { id: 'magnet', ch: '吸', name: '吸引', py: 'xīyǐn', tip: '吸来所有小鱼干', color: '#a57cf5', dur: 0 },
  { id: 'nestShield', ch: '护', name: '猫窝护盾', py: 'māowō hùdùn', tip: '猫窝暂时不会受伤', color: '#4fb7ff', dur: 10 },
];
const BUFF_DROP_CHANCE = 0.06;

