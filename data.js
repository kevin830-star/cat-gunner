// 游戏数据：武器、道具、敌人，以及分级中文学习题库（识字、偏旁、词语、成语、古诗、读音）
'use strict';

// ---------- 年级分级 ----------
const GRADE_LEVELS = [
  { id: 0, name: '全部年级（随关卡进阶）', short: '全部' },
  { id: 1, name: '低年级（1-2年级）', short: '低年级' },
  { id: 2, name: '中年级（3-4年级）', short: '中年级' },
  { id: 3, name: '高年级（5-6年级）', short: '高年级' },
];

// ---------- 武器 ----------
// cost：购买一把 D 级的价格；splash：[从第几阶开始, 起始半径, 每阶增加] 命中后的溅射范围
const WEAPONS = [
  { id: 'pistol', name: '豌豆手枪', py: 'wāndòu shǒuqiāng', desc: '可靠的基础武器，命中时炸开豌豆汁。C 级起有溅射。', cost: 30,
    dmg: 14, interval: 0.36, speed: 560, count: 1, spread: 0, jitter: 0.03, pierce: 0, explode: 0, life: 0.9, r: 5, color: '#6fd24a', splash: [1, 26, 9] },
  { id: 'shotgun', name: '毛线散弹枪', py: 'máoxiàn sǎndànqiāng', desc: '打出一扇毛线球，每升一阶多一颗，覆盖更广。B 级起有溅射。', cost: 90,
    dmg: 9, interval: 0.75, speed: 480, count: 5, spread: 0.55, jitter: 0, pierce: 0, explode: 0, life: 0.45, r: 6, color: '#ff8fb1', splash: [2, 24, 8] },
  { id: 'smg', name: '鱼骨冲锋枪', py: 'yúgǔ chōngfēngqiāng', desc: '射速非常快，单发伤害低。A 级起有溅射。', cost: 160,
    dmg: 7, interval: 0.11, speed: 640, count: 1, spread: 0, jitter: 0.12, pierce: 0, explode: 0, life: 0.75, r: 4, color: '#f4f4f4', splash: [3, 20, 8] },
  { id: 'grenade', name: '罐头榴弹炮', py: 'guàntou liúdànpào', desc: '罐头落地爆炸，范围随品级变大。', cost: 260,
    dmg: 42, interval: 1.0, speed: 380, count: 1, spread: 0, jitter: 0.02, pierce: 0, explode: 85, life: 0.85, r: 8, color: '#c9a35a' },
  { id: 'laser', name: '激光逗猫笔', py: 'jīguāng dòumāobǐ', desc: '激光穿透一整排敌人，品级越高光束越粗。', cost: 380,
    dmg: 22, interval: 0.5, speed: 950, count: 1, spread: 0, jitter: 0, pierce: 99, explode: 0, life: 0.6, r: 5, color: '#ff4040' },
];

// ---------- 品级与合成 ----------
// dmg / spd：伤害和射击间隔的倍数；need：合成成下一阶需要几把相同的武器（第 i 项 = 把 i 阶合成 i+1 阶）
const TIERS = [
  { id: 'D', name: '普通', color: '#a8794a', dmg: 1, spd: 1 },
  { id: 'C', name: '优秀', color: '#4fb83c', dmg: 2.2, spd: 0.94 },
  { id: 'B', name: '精良', color: '#3d8bff', dmg: 4.8, spd: 0.88 },
  { id: 'A', name: '史诗', color: '#a45cf0', dmg: 10.5, spd: 0.82 },
  { id: 'S', name: '传说', color: '#ffb300', dmg: 25, spd: 0.76 },
  { id: 'SSS', name: '神话', color: '#ff5e9a', dmg: 62, spd: 0.68 },
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
  { id: 'turret', name: '自动炮塔', py: 'zìdòng pàotǎ', desc: '永久拥有，在猫窝旁自动射击。每买一座多一座（最多 4 座）；合成升级让所有炮塔更强。', multi: 4, unit: '座', cost: 70, max: 5,
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
  { id: 'nestHp', name: '加固猫窝', py: 'jiāgù māowō', desc: '猫窝生命上限 +100，不限等级。前 10 级每级换新样子（大猫窝、猫别墅、猫城堡……），之后换颜色。3 级起每关可用一次「导弹防御」。', max: Infinity },
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

// ---------- 题库 1：词语填空（按年级分级） ----------
// s：句子（____ 是空格）；opts：第一个是正确答案，格式 "词|拼音"；py：整句拼音；en：英文意思；grade：1低 2中 3高
const FILL_QUIZ = [
  // 低年级 (Grade 1)
  { grade: 1, s: '小猫喜欢吃____。', opts: ['鱼|yú', '石头|shítou', '书|shū', '雨伞|yǔsǎn'], py: 'Xiǎo māo xǐhuan chī yú.', en: 'The kitten likes to eat fish.' },
  { grade: 1, s: '今天天气很____，我们去公园吧。', opts: ['好|hǎo', '贵|guì', '胖|pàng', '咸|xián'], py: 'Jīntiān tiānqì hěn hǎo, wǒmen qù gōngyuán ba.', en: "The weather is nice today, let's go to the park." },
  { grade: 1, s: '我每天早上七点____。', opts: ['起床|qǐchuáng', '睡觉|shuìjiào', '下雨|xiàyǔ', '生病|shēngbìng'], py: 'Wǒ měitiān zǎoshang qī diǎn qǐchuáng.', en: 'I get up at seven every morning.' },
  { grade: 1, s: '妈妈在厨房____饭。', opts: ['做|zuò', '喝|hē', '穿|chuān', '听|tīng'], py: 'Māma zài chúfáng zuò fàn.', en: 'Mom is cooking in the kitchen.' },
  { grade: 1, s: '我想喝一____水。', opts: ['杯|bēi', '本|běn', '只|zhī', '件|jiàn'], py: 'Wǒ xiǎng hē yì bēi shuǐ.', en: 'I want to drink a glass of water.' },
  { grade: 1, s: '外面下____了，别忘了带伞。', opts: ['雨|yǔ', '课|kè', '班|bān', '车|chē'], py: 'Wàimiàn xià yǔ le, bié wàng le dài sǎn.', en: "It's raining outside, don't forget an umbrella." },
  { grade: 1, s: '你____什么名字？', opts: ['叫|jiào', '吃|chī', '买|mǎi', '走|zǒu'], py: 'Nǐ jiào shénme míngzi?', en: 'What is your name?' },
  { grade: 1, s: '这只猫比那只猫____。', opts: ['大|dà', '吗|ma', '的|de', '不|bù'], py: 'Zhè zhī māo bǐ nà zhī māo dà.', en: 'This cat is bigger than that cat.' },
  { grade: 1, s: '我有两____猫。', opts: ['只|zhī', '本|běn', '张|zhāng', '杯|bēi'], py: 'Wǒ yǒu liǎng zhī māo.', en: 'I have two cats.' },
  { grade: 1, s: '请把门____上。', opts: ['关|guān', '吃|chī', '写|xiě', '跑|pǎo'], py: 'Qǐng bǎ mén guān shàng.', en: 'Please close the door.' },
  { grade: 1, s: '晚上小猫在窝里____。', opts: ['睡觉|shuìjiào', '游泳|yóuyǒng', '开车|kāichē', '上班|shàngbān'], py: 'Wǎnshang xiǎo māo zài wō lǐ shuìjiào.', en: 'At night the kitten sleeps in its nest.' },
  { grade: 1, s: '这个苹果是____色的。', opts: ['红|hóng', '蓝|lán', '黑|hēi', '白|bái'], py: 'Zhège píngguǒ shì hóngsè de.', en: 'This apple is red.' },
  { grade: 1, s: '我用____写字。', opts: ['笔|bǐ', '碗|wǎn', '鞋|xié', '门|mén'], py: 'Wǒ yòng bǐ xiě zì.', en: 'I write with a pen.' },
  { grade: 1, s: '他跑得很____。', opts: ['快|kuài', '贵|guì', '甜|tián', '红|hóng'], py: 'Tā pǎo de hěn kuài.', en: 'He runs very fast.' },
  { grade: 1, s: '我的生日是五____十号。', opts: ['月|yuè', '天|tiān', '年|nián', '点|diǎn'], py: 'Wǒ de shēngrì shì wǔ yuè shí hào.', en: 'My birthday is May 10th.' },
  { grade: 1, s: '吃饭以前要洗____。', opts: ['手|shǒu', '书|shū', '树|shù', '水|shuǐ'], py: 'Chī fàn yǐqián yào xǐ shǒu.', en: 'Wash your hands before eating.' },
  { grade: 1, s: '天上有弯弯的____。', opts: ['月亮|yuèliang', '小草|xiǎocǎo', '石头|shítou', '铅笔|qiānbǐ'], py: 'Tiānshàng yǒu wānwān de yuèliang.', en: 'There is a curved moon in the sky.' },
  { grade: 1, s: '春天来了，花园里的花都____了。', opts: ['开|kāi', '关|guān', '坐|zuò', '穿|chuān'], py: 'Chūntiān lái le, huāyuán lǐ de huā dōu kāi le.', en: 'Spring has come, and the flowers in the garden are blooming.' },

  // 中年级 (Grade 2)
  { grade: 2, s: '他会说____，也会说英语。', opts: ['中文|Zhōngwén', '苹果|píngguǒ', '电脑|diànnǎo', '椅子|yǐzi'], py: 'Tā huì shuō Zhōngwén, yě huì shuō Yīngyǔ.', en: 'He can speak Chinese and English.' },
  { grade: 2, s: '这本书很有____。', opts: ['意思|yìsi', '时间|shíjiān', '颜色|yánsè', '身体|shēntǐ'], py: 'Zhè běn shū hěn yǒu yìsi.', en: 'This book is very interesting.' },
  { grade: 2, s: '我的朋友____北京工作。', opts: ['在|zài', '是|shì', '有|yǒu', '很|hěn'], py: 'Wǒ de péngyou zài Běijīng gōngzuò.', en: 'My friend works in Beijing.' },
  { grade: 2, s: '我们坐____去上海。', opts: ['火车|huǒchē', '桌子|zhuōzi', '米饭|mǐfàn', '衣服|yīfu'], py: 'Wǒmen zuò huǒchē qù Shànghǎi.', en: 'We take the train to Shanghai.' },
  { grade: 2, s: '老师让我们认真____课。', opts: ['听|tīng', '吃|chī', '开|kāi', '洗|xǐ'], py: 'Lǎoshī ràng wǒmen rènzhēn tīng kè.', en: 'The teacher asks us to listen carefully in class.' },
  { grade: 2, s: '因为下雨，____我们没去爬山。', opts: ['所以|suǒyǐ', '但是|dànshì', '虽然|suīrán', '如果|rúguǒ'], py: 'Yīnwèi xià yǔ, suǒyǐ wǒmen méi qù pá shān.', en: "Because it rained, we didn't go hiking." },
  { grade: 2, s: '虽然很累，____他还在学习。', opts: ['但是|dànshì', '所以|suǒyǐ', '因为|yīnwèi', '或者|huòzhě'], py: 'Suīrán hěn lèi, dànshì tā hái zài xuéxí.', en: 'Although he is tired, he is still studying.' },
  { grade: 2, s: '我____去过中国。', opts: ['没|méi', '很|hěn', '吗|ma', '的|de'], py: 'Wǒ méi qù guo Zhōngguó.', en: 'I have never been to China.' },
  { grade: 2, s: '一年有四个____。', opts: ['季节|jìjié', '星期|xīngqī', '小时|xiǎoshí', '月亮|yuèliang'], py: 'Yì nián yǒu sì gè jìjié.', en: 'A year has four seasons.' },
  { grade: 2, s: '生病了要去____看医生。', opts: ['医院|yīyuàn', '银行|yínháng', '商店|shāngdiàn', '学校|xuéxiào'], py: 'Shēngbìng le yào qù yīyuàn kàn yīshēng.', en: 'When you are sick, go to the hospital to see a doctor.' },
  { grade: 2, s: '太____了，请开一下窗户。', opts: ['热|rè', '高|gāo', '快|kuài', '甜|tián'], py: 'Tài rè le, qǐng kāi yíxià chuānghu.', en: "It's too hot, please open the window." },
  { grade: 2, s: '我____妈妈打电话。', opts: ['给|gěi', '把|bǎ', '被|bèi', '从|cóng'], py: 'Wǒ gěi māma dǎ diànhuà.', en: 'I call my mom.' },
  { grade: 2, s: '你喜欢喝茶____咖啡？', opts: ['还是|háishi', '所以|suǒyǐ', '因为|yīnwèi', '已经|yǐjīng'], py: 'Nǐ xǐhuan hē chá háishi kāfēi?', en: 'Do you like tea or coffee?' },
  { grade: 2, s: '这个问题太____了，我不会。', opts: ['难|nán', '近|jìn', '瘦|shòu', '新|xīn'], py: 'Zhège wèntí tài nán le, wǒ bú huì.', en: "This question is too hard, I can't do it." },
  { grade: 2, s: '小狗看见小猫就____走了。', opts: ['跑|pǎo', '吃|chī', '买|mǎi', '读|dú'], py: 'Xiǎo gǒu kànjiàn xiǎo māo jiù pǎo zǒu le.', en: 'The puppy ran away as soon as it saw the kitten.' },
  { grade: 2, s: '我们一起____卫猫窝！', opts: ['保|bǎo', '报|bào', '包|bāo', '抱|bào'], py: 'Wǒmen yìqǐ bǎowèi māowō!', en: "Let's defend the cat nest together!" },
  { grade: 2, s: '这件衣服多少____？', opts: ['钱|qián', '岁|suì', '人|rén', '次|cì'], py: 'Zhè jiàn yīfu duōshao qián?', en: 'How much is this piece of clothing?' },
  { grade: 2, s: '对不起，我来____了。', opts: ['晚|wǎn', '早|zǎo', '少|shǎo', '短|duǎn'], py: 'Duìbuqǐ, wǒ lái wǎn le.', en: "Sorry, I'm late." },

  // 高年级 (Grade 3)
  { grade: 3, s: '无论遇到什么困难，我们都不能____放弃。', opts: ['轻易|qīngyì', '忽然|hūrán', '偶尔|ǒuěr', '居然|jūrán'], py: 'Wúlùn yùdào shénme kùnnan, wǒmen dōu bù néng qīngyì fàngqì.', en: 'No matter what difficulties we meet, we must not give up easily.' },
  { grade: 3, s: '经过反复练习，他的钢琴弹得越来越____。', opts: ['熟练|shúliàn', '陌生|mòshēng', '犹豫|yóuyù', '骄傲|jiāoào'], py: 'Jīngguò fǎnfù liànxí, tā de gāngqín tán de yuèláiyuè shúliàn.', en: 'After repeated practice, his piano playing became more and more skillful.' },
  { grade: 3, s: '保护自然____是我们每个人的责任。', opts: ['环境|huánjìng', '印象|yìnxiàng', '纪律|jìlǜ', '规律|guīlǜ'], py: 'Bǎohù zìrán huánjìng shì wǒmen měi gè rén de zérèn.', en: 'Protecting the natural environment is everyone’s responsibility.' },
  { grade: 3, s: '只有平时认真积累，考试时才能____有余。', opts: ['从容|cóngróng', '匆忙|cōngmáng', '慌张|huāngzhāng', '勉强|miǎnqiǎng'], py: 'Zhǐyǒu píngshí rènzhēn jīlěi, kǎoshì shí cái néng cóngróng yǒuyú.', en: 'Only by accumulating knowledge diligently can you handle exams with ease.' },
  { grade: 3, s: '科学家通过仔细____，发现了这个有趣的现象。', opts: ['观察|guānchá', '参观|cānguān', '观赏|guānshǎng', '浏览|liúlǎn'], py: 'Kēxuéjiā tōngguò zǐxì guānchá, fāxiàn le zhège yǒuqù de xiànxiàng.', en: 'Through careful observation, scientists discovered this interesting phenomenon.' },
  { grade: 3, s: '面对强大的头目，小猫依然毫不____地举起武器。', opts: ['畏惧|wèijù', '羡慕|xiànmù', '感激|gǎnjī', '惭愧|cánkuì'], py: 'Miànduì qiángdà de tóumù, xiǎo māo yīrán háobù wèijù de jǔ qǐ wǔqì.', en: 'Facing the powerful boss, the kitten still raised its weapon without fear.' },
  { grade: 3, s: '这幅山水画色彩鲜艳，给人留下深刻的____。', opts: ['印象|yìnxiàng', '影响|yǐngxiǎng', '形象|xíngxiàng', '想象|xiǎngxiàng'], py: 'Zhè fú shānshuǐhuà sècǎi xiānyàn, gěi rén liúxià shēnkè de yìnxiàng.', en: 'This landscape painting has bright colors and leaves a deep impression.' },
  { grade: 3, s: '只要大家齐心____，就一定能守住猫窝。', opts: ['协力|xiélì', '妥协|tuǒxié', '协助|xiézhù', '协调|xiétiáo'], py: 'Zhǐyào dàjiā qíxīn xiélì, jiù yídìng néng shǒuzhù māowō.', en: 'As long as everyone works together as one, we can definitely defend the cat nest.' },
];

// ---------- 题库 2：成语填空 ----------
const IDIOM_QUIZ = [
  { grade: 1, s: '一____一意（形容做事专心，不分心）', opts: ['心|xīn', '手|shǒu', '口|kǒu', '目|mù'], py: 'yì xīn yí yì', en: 'Wholeheartedly / with undivided attention' },
  { grade: 1, s: '五____六色（形容色彩非常丰富）', opts: ['颜|yán', '花|huā', '光|guāng', '彩|cǎi'], py: 'wǔ yán liù sè', en: 'Colorful / of all colors' },
  { grade: 1, s: '九____一毛（比喻极大数量中的极小部分）', opts: ['牛|niú', '马|mǎ', '羊|yáng', '虎|hǔ'], py: 'jiǔ niú yì máo', en: 'A drop in the ocean (lit. one hair from nine oxen)' },
  { grade: 1, s: '马到____功（形容事情顺利，一开始就取得胜利）', opts: ['成|chéng', '生|shēng', '真|zhēn', '大|dà'], py: 'mǎ dào chéng gōng', en: 'Win instant success' },
  { grade: 1, s: '七____八下（形容心里慌乱不安）', opts: ['上|shàng', '左|zuǒ', '前|qián', '高|gāo'], py: 'qī shàng bā xià', en: 'Anxious and unsettled' },
  { grade: 1, s: '四面____方（指各个方向、到处）', opts: ['八|bā', '六|liù', '十|shí', '九|jiǔ'], py: 'sì miàn bā fāng', en: 'In all directions / everywhere' },
  { grade: 2, s: '画____点睛（比喻在关键处加上一笔，使内容更生动）', opts: ['龙|lóng', '虎|hǔ', '蛇|shé', '鸟|niǎo'], py: 'huà lóng diǎn jīng', en: 'Add the finishing touch (lit. paint the dragon and dot its eyes)' },
  { grade: 2, s: '守株待____（比喻不主动努力，只想靠碰运气）', opts: ['兔|tù', '猫|māo', '鼠|shǔ', '狗|gǒu'], py: 'shǒu zhū dài tù', en: 'Wait by a stump for a hare (trust to luck instead of effort)' },
  { grade: 2, s: '亡____补牢（比喻出了问题后及时补救还不算晚）', opts: ['羊|yáng', '牛|niú', '猪|zhū', '马|mǎ'], py: 'wáng yáng bǔ láo', en: 'Mend the fold after losing sheep (better late than never)' },
  { grade: 2, s: '狐____虎威（比喻借着别人的威势欺压人）', opts: ['假|jiǎ', '借|jiè', '看|kàn', '怕|pà'], py: 'hú jiǎ hǔ wēi', en: 'The fox borrows the tiger’s terror (bully others using someone else’s power)' },
  { grade: 2, s: '井底之____（比喻见识狭窄的人）', opts: ['蛙|wā', '鱼|yú', '虾|xiā', '龟|guī'], py: 'jǐng dǐ zhī wā', en: 'A frog at the bottom of a well (narrow-minded person)' },
  { grade: 2, s: '画____添足（比喻做了多余的事，反而不恰当）', opts: ['蛇|shé', '龙|lóng', '鸡|jī', '猫|māo'], py: 'huà shé tiān zú', en: 'Draw a snake and add feet (ruin something by adding superfluous details)' },
  { grade: 2, s: '对____弹琴（比喻对不懂道理的人讲道理）', opts: ['牛|niú', '马|mǎ', '羊|yáng', '鸡|jī'], py: 'duì niú tán qín', en: 'Play the lute to a cow (preach to deaf ears)' },
  { grade: 2, s: '掩____盗铃（比喻自己欺骗自己）', opts: ['耳|ěr', '目|mù', '口|kǒu', '鼻|bí'], py: 'yǎn ěr dào líng', en: 'Cover one’s ears while stealing a bell (deceive oneself)' },
  { grade: 2, s: '刻____求剑（比喻死守老办法，不知道跟着情况变化）', opts: ['舟|zhōu', '木|mù', '石|shí', '桥|qiáo'], py: 'kè zhōu qiú jiàn', en: 'Mark the boat to find a dropped sword (stubbornly stick to old ways)' },
  { grade: 3, s: '拔____助长（比喻急于求成，反而把事情弄糟）', opts: ['苗|miáo', '草|cǎo', '树|shù', '花|huā'], py: 'bá miáo zhù zhǎng', en: 'Pull up shoots to help them grow (spoil things by excessive haste)' },
  { grade: 3, s: '雪中送____（比喻在别人急需的时候给予帮助）', opts: ['炭|tàn', '火|huǒ', '衣|yī', '伞|sǎn'], py: 'xuě zhōng sòng tàn', en: 'Send charcoal in snowy weather (provide timely help)' },
  { grade: 3, s: '锦上添____（比喻好上加好，更加完美）', opts: ['花|huā', '叶|yè', '金|jīn', '彩|cǎi'], py: 'jǐn shàng tiān huā', en: 'Add flowers to brocade (make perfection still more perfect)' },
  { grade: 3, s: '水滴____穿（比喻只要坚持不懈，再难的事也能成功）', opts: ['石|shí', '木|mù', '铁|tiě', '山|shān'], py: 'shuǐ dī shí chuān', en: 'Dripping water wears through stone (perseverance prevails)' },
  { grade: 3, s: '自相矛____（比喻自己说话或做事前后抵触）', opts: ['盾|dùn', '剑|jiàn', '枪|qiāng', '刀|dāo'], py: 'zì xiāng máo dùn', en: 'Self-contradictory (spear vs. shield)' },
  { grade: 3, s: '半____而废（比喻做事没有坚持到底，中途停顿）', opts: ['途|tú', '路|lù', '天|tiān', '步|bù'], py: 'bàn tú ér fèi', en: 'Give up halfway' },
  { grade: 3, s: '愚公移____（比喻不怕困难，坚持奋斗到底）', opts: ['山|shān', '石|shí', '河|hé', '海|hǎi'], py: 'Yúgōng yí shān', en: 'The Foolish Old Man moves mountains (unyielding perseverance)' },
];

// ---------- 题库 3：古诗名句填空 ----------
const POEM_QUIZ = [
  { grade: 1, s: '举头望明月，低头思____。（李白《静夜思》）', opts: ['故乡|gùxiāng', '朋友|péngyou', '太阳|tàiyáng', '春风|chūnfēng'], py: 'Jǔ tóu wàng míngyuè, dī tóu sī gùxiāng.', en: 'Raising my head, I gaze at the bright moon; bowing my head, I think of my hometown.' },
  { grade: 1, s: '白毛浮绿水，红掌拨清____。（骆宾王《咏鹅》）', opts: ['波|bō', '风|fēng', '云|yún', '沙|shā'], py: 'Bái máo fú lǜ shuǐ, hóng zhǎng bō qīng bō.', en: 'White feathers float on green water; red webbed feet paddle clear waves.' },
  { grade: 1, s: '春眠不觉晓，处处闻啼____。（孟浩然《春晓》）', opts: ['鸟|niǎo', '虫|chóng', '猫|māo', '蛙|wā'], py: 'Chūn mián bù jué xiǎo, chùchù wén tí niǎo.', en: 'Sleeping in spring, unaware of dawn; everywhere I hear singing birds.' },
  { grade: 1, s: '锄禾日当午，汗滴禾下____。（李绅《悯农》）', opts: ['土|tǔ', '水|shuǐ', '草|cǎo', '田|tián'], py: 'Chú hé rì dāng wǔ, hàn dī hé xià tǔ.', en: 'Hoeing grain at noon, sweat drips into the soil beneath the crops.' },
  { grade: 1, s: '远看____有色，近听水无声。（王维《画》）', opts: ['山|shān', '花|huā', '云|yún', '树|shù'], py: 'Yuǎn kàn shān yǒu sè, jìn tīng shuǐ wú shēng.', en: 'Seen from afar, the mountains have color; listened to closely, the water makes no sound.' },
  { grade: 2, s: '欲穷千里目，更上一层____。（王之涣《登鹳雀楼》）', opts: ['楼|lóu', '山|shān', '云|yún', '天|tiān'], py: 'Yù qióng qiān lǐ mù, gèng shàng yì céng lóu.', en: 'To see a thousand miles further, climb one story higher.' },
  { grade: 2, s: '飞流直下三千尺，疑是银河落____天。（李白《望庐山瀑布》）', opts: ['九|jiǔ', '七|qī', '八|bā', '十|shí'], py: 'Fēi liú zhí xià sān qiān chǐ, yí shì yínhé luò jiǔ tiān.', en: 'The torrent plunges three thousand feet, as if the Milky Way fell from the ninth heaven.' },
  { grade: 2, s: '小荷才露尖尖角，早有蜻蜓立上____。（杨万里《小池》）', opts: ['头|tóu', '叶|yè', '花|huā', '枝|zhī'], py: 'Xiǎo hé cái lù jiānjiān jiǎo, zǎo yǒu qīngtíng lì shàng tóu.', en: 'The young lotus has barely shown its pointed bud, and already a dragonfly stands upon it.' },
  { grade: 2, s: '儿童散学归来早，忙趁东风放纸____。（高鼎《村居》）', opts: ['鸢|yuān', '船|chuán', '球|qiú', '灯|dēng'], py: 'Értóng sànxué guīlái zǎo, máng chèn dōngfēng fàng zhǐyuān.', en: 'Children return early from school and hurry to fly kites in the east wind.' },
  { grade: 2, s: '两个黄鹂鸣翠柳，一行白鹭上青____。（杜甫《绝句》）', opts: ['天|tiān', '山|shān', '云|yún', '水|shuǐ'], py: 'Liǎng gè huánglí míng cuì liǔ, yì háng báilù shàng qīng tiān.', en: 'Two orioles sing among green willows; a line of egrets ascends into the blue sky.' },
  { grade: 3, s: '孤帆远影碧空尽，唯见长江天际____。（李白《黄鹤楼送孟浩然之广陵》）', opts: ['流|liú', '走|zǒu', '飞|fēi', '来|lái'], py: 'Gū fān yuǎn yǐng bìkōng jìn, wéi jiàn Chángjiāng tiānjì liú.', en: 'The lone sail’s distant shadow vanishes into the blue sky; all I see is the Yangtze flowing to the horizon.' },
  { grade: 3, s: '独在异乡为异客，每逢佳节____思亲。（王维《九月九日忆山东兄弟》）', opts: ['倍|bèi', '更|gèng', '常|cháng', '多|duō'], py: 'Dú zài yìxiāng wéi yìkè, měi féng jiājié bèi sī qīn.', en: 'Alone in a foreign land as a stranger, I miss my family doubly on every festive day.' },
  { grade: 3, s: '两岸猿声啼不住，轻舟已过____重山。（李白《早发白帝城》）', opts: ['万|wàn', '千|qiān', '百|bǎi', '九|jiǔ'], py: 'Liǎng àn yuán shēng tí bú zhù, qīngzhōu yǐ guò wàn chóng shān.', en: 'While monkeys cry endlessly on both banks, my light boat has already passed ten thousand mountains.' },
  { grade: 3, s: '谁言寸草心，报得三____晖。（孟郊《游子吟》）', opts: ['春|chūn', '秋|qiū', '冬|dōng', '夏|xià'], py: 'Shuí yán cùn cǎo xīn, bào dé sān chūn huī.', en: 'Who says the heart of a tiny blade of grass can repay the warmth of spring sunshine?' },
];

// ---------- 题库 4：读音选择（声调与多音字辨析） ----------
const PRONOUNCE_QUIZ = [
  { grade: 1, w: '猫咪', target: '猫', opts: ['māo', 'máo', 'mǎo', 'mào'], en: 'kitten / cat' },
  { grade: 1, w: '小鱼', target: '鱼', opts: ['yú', 'yū', 'yǔ', 'yù'], en: 'little fish' },
  { grade: 1, w: '水手', target: '手', opts: ['shǒu', 'shōu', 'shóu', 'shòu'], en: 'hand / sailor' },
  { grade: 1, w: '月亮', target: '月', opts: ['yuè', 'yuē', 'yué', 'yuě'], en: 'moon' },
  { grade: 1, w: '大海', target: '海', opts: ['hǎi', 'hāi', 'hái', 'hài'], en: 'sea / ocean' },
  { grade: 1, w: '苹果', target: '果', opts: ['guǒ', 'guō', 'guó', 'guò'], en: 'apple / fruit' },
  { grade: 2, w: '快乐（高高兴兴）', target: '乐', opts: ['lè', 'yuè', 'lē', 'lě'], en: 'happy / joyful' },
  { grade: 2, w: '音乐（好听的歌）', target: '乐', opts: ['yuè', 'lè', 'yù', 'yào'], en: 'music' },
  { grade: 2, w: '长大（个子变高）', target: '长', opts: ['zhǎng', 'cháng', 'zhāng', 'chǎng'], en: 'grow up' },
  { grade: 2, w: '万里长城', target: '长', opts: ['cháng', 'zhǎng', 'chǎng', 'zhàng'], en: 'The Great Wall (long)' },
  { grade: 2, w: '睡觉（躺在床上）', target: '觉', opts: ['jiào', 'jué', 'jiāo', 'jiǎo'], en: 'sleep' },
  { grade: 2, w: '觉得（心里认为）', target: '觉', opts: ['jué', 'jiào', 'jüé', 'jiǎo'], en: 'feel / think' },
  { grade: 2, w: '数字（一二三四）', target: '数', opts: ['shù', 'shǔ', 'shū', 'shuò'], en: 'number' },
  { grade: 2, w: '数一数（数星星）', target: '数', opts: ['shǔ', 'shù', 'shū', 'shú'], en: 'to count' },
  { grade: 3, w: '参加（加入活动）', target: '参', opts: ['cān', 'shēn', 'cēn', 'sān'], en: 'participate / join' },
  { grade: 3, w: '人参（名贵药材）', target: '参', opts: ['shēn', 'cān', 'cēn', 'shèn'], en: 'ginseng' },
  { grade: 3, w: '银行（存钱的地方）', target: '行', opts: ['háng', 'xíng', 'hǎng', 'xìng'], en: 'bank' },
  { grade: 3, w: '人行道（走路的路）', target: '行', opts: ['xíng', 'háng', 'xǐng', 'hàng'], en: 'sidewalk / pedestrian walkway' },
  { grade: 3, w: '勇敢（不怕危险）', target: '勇', opts: ['yǒng', 'yōng', 'yóng', 'yòng'], en: 'brave / courageous' },
  { grade: 3, w: '满载而归（装满收获）', target: '载', opts: ['zài', 'zǎi', 'zhài', 'zāi'], en: 'return fully loaded' },
];

// ---------- 商店小游戏：看图选字 / 选声调 ----------
const PIC_WORDS = [
  { grade: 1, e: '🐱', c: '猫', py: 'māo', en: 'cat' }, { grade: 1, e: '🐶', c: '狗', py: 'gǒu', en: 'dog' },
  { grade: 1, e: '🐟', c: '鱼', py: 'yú', en: 'fish' }, { grade: 1, e: '🐦', c: '鸟', py: 'niǎo', en: 'bird' },
  { grade: 1, e: '🐴', c: '马', py: 'mǎ', en: 'horse' }, { grade: 1, e: '🐮', c: '牛', py: 'niú', en: 'cow' },
  { grade: 1, e: '🐑', c: '羊', py: 'yáng', en: 'sheep' }, { grade: 1, e: '🐷', c: '猪', py: 'zhū', en: 'pig' },
  { grade: 1, e: '🐭', c: '鼠', py: 'shǔ', en: 'mouse' }, { grade: 1, e: '🐯', c: '虎', py: 'hǔ', en: 'tiger' },
  { grade: 1, e: '🐰', c: '兔', py: 'tù', en: 'rabbit' }, { grade: 1, e: '🐲', c: '龙', py: 'lóng', en: 'dragon' },
  { grade: 1, e: '🐍', c: '蛇', py: 'shé', en: 'snake' }, { grade: 1, e: '🌸', c: '花', py: 'huā', en: 'flower' },
  { grade: 1, e: '🌳', c: '树', py: 'shù', en: 'tree' }, { grade: 1, e: '⛰️', c: '山', py: 'shān', en: 'mountain' },
  { grade: 1, e: '💧', c: '水', py: 'shuǐ', en: 'water' }, { grade: 1, e: '🔥', c: '火', py: 'huǒ', en: 'fire' },
  { grade: 1, e: '🌙', c: '月', py: 'yuè', en: 'moon' }, { grade: 1, e: '⭐', c: '星', py: 'xīng', en: 'star' },
  { grade: 1, e: '🌧️', c: '雨', py: 'yǔ', en: 'rain' }, { grade: 1, e: '❄️', c: '雪', py: 'xuě', en: 'snow' },
  { grade: 1, e: '📖', c: '书', py: 'shū', en: 'book' }, { grade: 1, e: '🚗', c: '车', py: 'chē', en: 'car' },
  { grade: 1, e: '🚪', c: '门', py: 'mén', en: 'door' }, { grade: 1, e: '✋', c: '手', py: 'shǒu', en: 'hand' },
  { grade: 1, e: '👂', c: '耳', py: 'ěr', en: 'ear' }, { grade: 2, e: '🍵', c: '茶', py: 'chá', en: 'tea' },
  { grade: 2, e: '🍚', c: '饭', py: 'fàn', en: 'cooked rice / meal' }, { grade: 2, e: '💰', c: '钱', py: 'qián', en: 'money' },
  { grade: 2, e: '🍎', c: '苹果', py: 'píngguǒ', en: 'apple' }, { grade: 2, e: '🍉', c: '西瓜', py: 'xīguā', en: 'watermelon' },
  { grade: 2, e: '📞', c: '电话', py: 'diànhuà', en: 'telephone' }, { grade: 2, e: '✈️', c: '飞机', py: 'fēijī', en: 'airplane' },
  { grade: 2, e: '🏠', c: '房子', py: 'fángzi', en: 'house' }, { grade: 2, e: '☀️', c: '太阳', py: 'tàiyáng', en: 'sun' },
  { grade: 2, e: '🌈', c: '彩虹', py: 'cǎihóng', en: 'rainbow' }, { grade: 2, e: '🐼', c: '熊猫', py: 'xióngmāo', en: 'panda' },
  { grade: 3, e: '🔭', c: '望远镜', py: 'wàngyuǎnjìng', en: 'telescope' }, { grade: 3, e: '🧭', c: '指南针', py: 'zhǐnánzhēn', en: 'compass' },
  { grade: 3, e: '🚀', c: '火箭', py: 'huǒjiàn', en: 'rocket' }, { grade: 3, e: '🎻', c: '小提琴', py: 'xiǎotíqín', en: 'violin' },
];

// ---------- 偏旁拼字 / 偏旁填空 ----------
const COMPONENTS = [
  { grade: 1, parts: ['氵', '可'], c: '河', py: 'hé', en: 'river', wrong: ['何', '海', '湖'] },
  { grade: 1, parts: ['女', '子'], c: '好', py: 'hǎo', en: 'good', wrong: ['妈', '如', '孩'] },
  { grade: 1, parts: ['日', '月'], c: '明', py: 'míng', en: 'bright', wrong: ['朋', '昌', '阳'] },
  { grade: 1, parts: ['木', '木'], c: '林', py: 'lín', en: 'forest', wrong: ['休', '森', '本'] },
  { grade: 1, parts: ['亻', '木'], c: '休', py: 'xiū', en: 'to rest', wrong: ['体', '林', '什'] },
  { grade: 1, parts: ['口', '马'], c: '吗', py: 'ma', en: '(question word)', wrong: ['妈', '吃', '骂'] },
  { grade: 1, parts: ['女', '马'], c: '妈', py: 'mā', en: 'mom', wrong: ['吗', '好', '姐'] },
  { grade: 1, parts: ['亻', '尔'], c: '你', py: 'nǐ', en: 'you', wrong: ['他', '们', '什'] },
  { grade: 1, parts: ['田', '力'], c: '男', py: 'nán', en: 'male', wrong: ['思', '累', '加'] },
  { grade: 1, parts: ['小', '大'], c: '尖', py: 'jiān', en: 'sharp', wrong: ['天', '太', '少'] },
  { grade: 1, parts: ['人', '人'], c: '从', py: 'cóng', en: 'from / to follow', wrong: ['众', '比', '入'] },
  { grade: 1, parts: ['日', '十'], c: '早', py: 'zǎo', en: 'early', wrong: ['旦', '田', '草'] },
  { grade: 2, parts: ['禾', '火'], c: '秋', py: 'qiū', en: 'autumn', wrong: ['和', '秒', '灯'] },
  { grade: 2, parts: ['艹', '早'], c: '草', py: 'cǎo', en: 'grass', wrong: ['花', '苗', '章'] },
  { grade: 2, parts: ['门', '口'], c: '问', py: 'wèn', en: 'to ask', wrong: ['间', '闻', '回'] },
  { grade: 2, parts: ['宀', '子'], c: '字', py: 'zì', en: 'character', wrong: ['学', '家', '安'] },
  { grade: 2, parts: ['日', '青'], c: '晴', py: 'qíng', en: 'sunny', wrong: ['清', '请', '睛'] },
  { grade: 2, parts: ['氵', '青'], c: '清', py: 'qīng', en: 'clear', wrong: ['晴', '请', '情'] },
  { grade: 2, parts: ['讠', '青'], c: '请', py: 'qǐng', en: 'please', wrong: ['清', '晴', '说'] },
  { grade: 2, parts: ['犭', '苗'], c: '猫', py: 'māo', en: 'cat', wrong: ['狗', '描', '猪'] },
  { grade: 2, parts: ['山', '石'], c: '岩', py: 'yán', en: 'rock', wrong: ['岁', '码', '出'] },
  { grade: 2, parts: ['口', '乞'], c: '吃', py: 'chī', en: 'to eat', wrong: ['喝', '吗', '叫'] },
  { grade: 2, parts: ['门', '日'], c: '间', py: 'jiān', en: 'between / room', wrong: ['问', '闻', '明'] },
  { grade: 2, parts: ['心', '你'], c: '您', py: 'nín', en: 'you (polite)', wrong: ['你', '想', '怎'] },
  { grade: 3, parts: ['忄', '青'], c: '情', py: 'qíng', en: 'feeling / emotion', wrong: ['晴', '清', '请'] },
  { grade: 3, parts: ['目', '青'], c: '睛', py: 'jīng', en: 'eye / eyeball', wrong: ['晴', '清', '精'] },
  { grade: 3, parts: ['米', '青'], c: '精', py: 'jīng', en: 'spirit / essence', wrong: ['睛', '清', '情'] },
  { grade: 3, parts: ['竹', '毛'], c: '笔', py: 'bǐ', en: 'pen / writing brush', wrong: ['笑', '笼', '笛'] },
  { grade: 3, parts: ['相', '心'], c: '想', py: 'xiǎng', en: 'to think / miss', wrong: ['念', '思', '忘'] },
  { grade: 3, parts: ['亡', '心'], c: '忘', py: 'wàng', en: 'to forget', wrong: ['忙', '想', '念'] },
  { grade: 3, parts: ['舌', '甘'], c: '甜', py: 'tián', en: 'sweet', wrong: ['话', '活', '苦'] },
  { grade: 3, parts: ['艹', '古'], c: '苦', py: 'kǔ', en: 'bitter / hard', wrong: ['草', '苗', '甜'] },
];
