// 游戏数据：武器、道具、敌人，以及中文学习题库
'use strict';

const WEAPONS = [
  { id: 'pistol', name: '豌豆手枪', py: 'wāndòu shǒuqiāng', desc: '可靠的初始武器。', cost: 0,
    dmg: 14, interval: 0.36, speed: 560, count: 1, spread: 0, jitter: 0.03, pierce: 0, explode: 0, life: 0.9, r: 5, color: '#6fd24a' },
  { id: 'shotgun', name: '毛线散弹枪', py: 'máoxiàn sǎndànqiāng', desc: '一次打出五颗毛线球，近战很强。', cost: 90,
    dmg: 9, interval: 0.75, speed: 480, count: 5, spread: 0.55, jitter: 0, pierce: 0, explode: 0, life: 0.45, r: 6, color: '#ff8fb1' },
  { id: 'smg', name: '鱼骨冲锋枪', py: 'yúgǔ chōngfēngqiāng', desc: '射速非常快，单发伤害低。', cost: 160,
    dmg: 7, interval: 0.11, speed: 640, count: 1, spread: 0, jitter: 0.12, pierce: 0, explode: 0, life: 0.75, r: 4, color: '#f4f4f4' },
  { id: 'grenade', name: '罐头榴弹炮', py: 'guàntou liúdànpào', desc: '罐头落地爆炸，伤害一大片。', cost: 260,
    dmg: 42, interval: 1.0, speed: 380, count: 1, spread: 0, jitter: 0.02, pierce: 0, explode: 85, life: 0.85, r: 8, color: '#c9a35a' },
  { id: 'laser', name: '激光逗猫笔', py: 'jīguāng dòumāobǐ', desc: '激光穿透一整排敌人。', cost: 380,
    dmg: 22, interval: 0.5, speed: 950, count: 1, spread: 0, jitter: 0, pierce: 99, explode: 0, life: 0.6, r: 5, color: '#ff4040' },
];
const WEAPON_MAX = 5;

const ITEMS = [
  { id: 'catnip', name: '猫薄荷', py: 'māo bòhe', desc: '每关可用几次：6 秒内移动和射击都变快。等级 = 每关次数。', cost: 60, max: 3 },
  { id: 'turret', name: '自动炮塔', py: 'zìdòng pàotǎ', desc: '在猫窝旁边自动射击。等级 = 炮塔数量。', cost: 120, max: 4 },
  { id: 'fence', name: '铁丝围栏', py: 'tiěsī wéilán', desc: '靠近猫窝的敌人会变慢。每级减速 15%。', cost: 80, max: 3 },
  { id: 'magnet', name: '磁铁项圈', py: 'cítiě xiàngquān', desc: '从更远的地方吸来小鱼干。', cost: 50, max: 3 },
];

const STATS = [
  { id: 'catHp', name: '猫咪生命', py: 'māomī shēngmìng', desc: '猫咪生命上限 +25。', max: 5 },
  { id: 'catSpd', name: '猫咪速度', py: 'māomī sùdù', desc: '猫咪跑得更快。', max: 5 },
  { id: 'nestHp', name: '加固猫窝', py: 'jiāgù māowō', desc: '猫窝生命上限 +100。', max: 5 },
];

// w: 出现权重；from: 第几关开始出现；group: 一次出现几只
const ENEMIES = {
  mouse:   { name: '老鼠小兵', hp: 22, spd: 68, r: 13, dmg: 3, fish: [1, 2], target: 'nest', from: 1, w: 10 },
  roach:   { name: '飞奔蟑螂', hp: 9, spd: 135, r: 9, dmg: 4, fish: [1, 1], target: 'cat', from: 2, w: 4, group: 3 },
  raccoon: { name: '浣熊盗贼', hp: 70, spd: 44, r: 19, dmg: 8, fish: [4, 6], target: 'nest', from: 3, w: 2 },
  crow:    { name: '乌鸦投弹手', hp: 32, spd: 85, r: 14, dmg: 8, fish: [3, 4], target: 'cat', ranged: true, from: 4, w: 3 },
  elite:   { name: '铁桶鼠队长', hp: 180, spd: 50, r: 24, dmg: 9, fish: [14, 18], target: 'nest' },
  boss:    { name: '野狗头目', hp: 520, spd: 34, r: 40, dmg: 14, fish: [40, 50], target: 'nest' },
};

// 战斗中随机掉落的增益。ch: 掉落物上显示的汉字；dur: 持续秒数（0 = 立刻生效）
const BUFFS = [
  { id: 'power', ch: '力', name: '力量', py: 'lìliàng', tip: '攻击力加倍', color: '#ff6b5e', dur: 8 },
  { id: 'rapid', ch: '快', name: '快速', py: 'kuàisù', tip: '射击变快', color: '#ffa726', dur: 8 },
  { id: 'shield', ch: '盾', name: '护盾', py: 'hùdùn', tip: '暂时不会受伤', color: '#5aa9ff', dur: 6 },
  { id: 'freeze', ch: '冰', name: '冰冻', py: 'bīngdòng', tip: '敌人被冻住', color: '#45c4d8', dur: 4 },
  { id: 'heal', ch: '心', name: '爱心', py: 'àixīn', tip: '恢复生命', color: '#ff7fa8', dur: 0 },
  { id: 'magnet', ch: '吸', name: '吸引', py: 'xīyǐn', tip: '吸来所有小鱼干', color: '#a57cf5', dur: 0 },
];
const BUFF_DROP_CHANCE = 0.06;

// ---------- 头目战：词语填空 ----------
// s: 句子（____ 是空格）；opts: 第一个是正确答案，格式 "词|拼音"；py: 整句拼音；en: 英文意思
const FILL_QUIZ = [
  { s: '小猫喜欢吃____。', opts: ['鱼|yú', '石头|shítou', '书|shū', '雨伞|yǔsǎn'], py: 'Xiǎo māo xǐhuan chī yú.', en: 'The kitten likes to eat fish.' },
  { s: '今天天气很____，我们去公园吧。', opts: ['好|hǎo', '贵|guì', '胖|pàng', '咸|xián'], py: 'Jīntiān tiānqì hěn hǎo, wǒmen qù gōngyuán ba.', en: "The weather is nice today, let's go to the park." },
  { s: '我每天早上七点____。', opts: ['起床|qǐchuáng', '睡觉|shuìjiào', '下雨|xiàyǔ', '生病|shēngbìng'], py: 'Wǒ měitiān zǎoshang qī diǎn qǐchuáng.', en: 'I get up at seven every morning.' },
  { s: '妈妈在厨房____饭。', opts: ['做|zuò', '喝|hē', '穿|chuān', '听|tīng'], py: 'Māma zài chúfáng zuò fàn.', en: 'Mom is cooking in the kitchen.' },
  { s: '他会说____，也会说英语。', opts: ['中文|Zhōngwén', '苹果|píngguǒ', '电脑|diànnǎo', '椅子|yǐzi'], py: 'Tā huì shuō Zhōngwén, yě huì shuō Yīngyǔ.', en: 'He can speak Chinese and English.' },
  { s: '我想喝一____水。', opts: ['杯|bēi', '本|běn', '只|zhī', '件|jiàn'], py: 'Wǒ xiǎng hē yì bēi shuǐ.', en: 'I want to drink a glass of water.' },
  { s: '这本书很有____。', opts: ['意思|yìsi', '时间|shíjiān', '颜色|yánsè', '身体|shēntǐ'], py: 'Zhè běn shū hěn yǒu yìsi.', en: 'This book is very interesting.' },
  { s: '外面下____了，别忘了带伞。', opts: ['雨|yǔ', '课|kè', '班|bān', '车|chē'], py: 'Wàimiàn xià yǔ le, bié wàng le dài sǎn.', en: "It's raining outside, don't forget an umbrella." },
  { s: '我的朋友____北京工作。', opts: ['在|zài', '是|shì', '有|yǒu', '很|hěn'], py: 'Wǒ de péngyou zài Běijīng gōngzuò.', en: 'My friend works in Beijing.' },
  { s: '你____什么名字？', opts: ['叫|jiào', '吃|chī', '买|mǎi', '走|zǒu'], py: 'Nǐ jiào shénme míngzi?', en: 'What is your name?' },
  { s: '这只猫比那只猫____。', opts: ['大|dà', '吗|ma', '的|de', '不|bù'], py: 'Zhè zhī māo bǐ nà zhī māo dà.', en: 'This cat is bigger than that cat.' },
  { s: '我们坐____去上海。', opts: ['火车|huǒchē', '桌子|zhuōzi', '米饭|mǐfàn', '衣服|yīfu'], py: 'Wǒmen zuò huǒchē qù Shànghǎi.', en: 'We take the train to Shanghai.' },
  { s: '老师让我们认真____课。', opts: ['听|tīng', '吃|chī', '开|kāi', '洗|xǐ'], py: 'Lǎoshī ràng wǒmen rènzhēn tīng kè.', en: 'The teacher asks us to listen carefully in class.' },
  { s: '我有两____猫。', opts: ['只|zhī', '本|běn', '张|zhāng', '杯|bēi'], py: 'Wǒ yǒu liǎng zhī māo.', en: 'I have two cats.' },
  { s: '因为下雨，____我们没去爬山。', opts: ['所以|suǒyǐ', '但是|dànshì', '虽然|suīrán', '如果|rúguǒ'], py: 'Yīnwèi xià yǔ, suǒyǐ wǒmen méi qù pá shān.', en: "Because it rained, we didn't go hiking." },
  { s: '虽然很累，____他还在学习。', opts: ['但是|dànshì', '所以|suǒyǐ', '因为|yīnwèi', '或者|huòzhě'], py: 'Suīrán hěn lèi, dànshì tā hái zài xuéxí.', en: 'Although he is tired, he is still studying.' },
  { s: '请把门____上。', opts: ['关|guān', '吃|chī', '写|xiě', '跑|pǎo'], py: 'Qǐng bǎ mén guān shàng.', en: 'Please close the door.' },
  { s: '我____去过中国。', opts: ['没|méi', '很|hěn', '吗|ma', '的|de'], py: 'Wǒ méi qù guo Zhōngguó.', en: 'I have never been to China.' },
  { s: '晚上小猫在窝里____。', opts: ['睡觉|shuìjiào', '游泳|yóuyǒng', '开车|kāichē', '上班|shàngbān'], py: 'Wǎnshang xiǎo māo zài wō lǐ shuìjiào.', en: 'At night the kitten sleeps in its nest.' },
  { s: '这个苹果是____色的。', opts: ['红|hóng', '蓝|lán', '黑|hēi', '白|bái'], py: 'Zhège píngguǒ shì hóngsè de.', en: 'This apple is red.' },
  { s: '一年有四个____。', opts: ['季节|jìjié', '星期|xīngqī', '小时|xiǎoshí', '月亮|yuèliang'], py: 'Yì nián yǒu sì gè jìjié.', en: 'A year has four seasons.' },
  { s: '生病了要去____看医生。', opts: ['医院|yīyuàn', '银行|yínháng', '商店|shāngdiàn', '学校|xuéxiào'], py: 'Shēngbìng le yào qù yīyuàn kàn yīshēng.', en: 'When you are sick, go to the hospital to see a doctor.' },
  { s: '我用____写字。', opts: ['笔|bǐ', '碗|wǎn', '鞋|xié', '门|mén'], py: 'Wǒ yòng bǐ xiě zì.', en: 'I write with a pen.' },
  { s: '太____了，请开一下窗户。', opts: ['热|rè', '高|gāo', '快|kuài', '甜|tián'], py: 'Tài rè le, qǐng kāi yíxià chuānghu.', en: "It's too hot, please open the window." },
  { s: '他跑得很____。', opts: ['快|kuài', '贵|guì', '甜|tián', '红|hóng'], py: 'Tā pǎo de hěn kuài.', en: 'He runs very fast.' },
  { s: '我____妈妈打电话。', opts: ['给|gěi', '把|bǎ', '被|bèi', '从|cóng'], py: 'Wǒ gěi māma dǎ diànhuà.', en: 'I call my mom.' },
  { s: '你喜欢喝茶____咖啡？', opts: ['还是|háishi', '所以|suǒyǐ', '因为|yīnwèi', '已经|yǐjīng'], py: 'Nǐ xǐhuan hē chá háishi kāfēi?', en: 'Do you like tea or coffee?' },
  { s: '这个问题太____了，我不会。', opts: ['难|nán', '近|jìn', '瘦|shòu', '新|xīn'], py: 'Zhège wèntí tài nán le, wǒ bú huì.', en: "This question is too hard, I can't do it." },
  { s: '小狗看见小猫就____走了。', opts: ['跑|pǎo', '吃|chī', '买|mǎi', '读|dú'], py: 'Xiǎo gǒu kànjiàn xiǎo māo jiù pǎo zǒu le.', en: 'The puppy ran away as soon as it saw the kitten.' },
  { s: '我们一起____卫猫窝！', opts: ['保|bǎo', '报|bào', '包|bāo', '抱|bào'], py: 'Wǒmen yìqǐ bǎowèi māowō!', en: "Let's defend the cat nest together!" },
  { s: '我的生日是五____十号。', opts: ['月|yuè', '天|tiān', '年|nián', '点|diǎn'], py: 'Wǒ de shēngrì shì wǔ yuè shí hào.', en: 'My birthday is May 10th.' },
  { s: '这件衣服多少____？', opts: ['钱|qián', '岁|suì', '人|rén', '次|cì'], py: 'Zhè jiàn yīfu duōshao qián?', en: 'How much is this piece of clothing?' },
  { s: '对不起，我来____了。', opts: ['晚|wǎn', '早|zǎo', '少|shǎo', '短|duǎn'], py: 'Duìbuqǐ, wǒ lái wǎn le.', en: "Sorry, I'm late." },
  { s: '吃饭以前要洗____。', opts: ['手|shǒu', '书|shū', '树|shù', '水|shuǐ'], py: 'Chī fàn yǐqián yào xǐ shǒu.', en: 'Wash your hands before eating.' },
];

// ---------- 商店小游戏：看图选字 / 选声调 ----------
const PIC_WORDS = [
  { e: '🐱', c: '猫', py: 'māo', en: 'cat' }, { e: '🐶', c: '狗', py: 'gǒu', en: 'dog' },
  { e: '🐟', c: '鱼', py: 'yú', en: 'fish' }, { e: '🐦', c: '鸟', py: 'niǎo', en: 'bird' },
  { e: '🐴', c: '马', py: 'mǎ', en: 'horse' }, { e: '🐮', c: '牛', py: 'niú', en: 'cow' },
  { e: '🐑', c: '羊', py: 'yáng', en: 'sheep' }, { e: '🐷', c: '猪', py: 'zhū', en: 'pig' },
  { e: '🐭', c: '鼠', py: 'shǔ', en: 'mouse' }, { e: '🐯', c: '虎', py: 'hǔ', en: 'tiger' },
  { e: '🐰', c: '兔', py: 'tù', en: 'rabbit' }, { e: '🐉', c: '龙', py: 'lóng', en: 'dragon' },
  { e: '🐍', c: '蛇', py: 'shé', en: 'snake' }, { e: '🌸', c: '花', py: 'huā', en: 'flower' },
  { e: '🌳', c: '树', py: 'shù', en: 'tree' }, { e: '⛰️', c: '山', py: 'shān', en: 'mountain' },
  { e: '💧', c: '水', py: 'shuǐ', en: 'water' }, { e: '🔥', c: '火', py: 'huǒ', en: 'fire' },
  { e: '🌙', c: '月', py: 'yuè', en: 'moon' }, { e: '⭐', c: '星', py: 'xīng', en: 'star' },
  { e: '🌧️', c: '雨', py: 'yǔ', en: 'rain' }, { e: '❄️', c: '雪', py: 'xuě', en: 'snow' },
  { e: '📖', c: '书', py: 'shū', en: 'book' }, { e: '🚗', c: '车', py: 'chē', en: 'car' },
  { e: '🚪', c: '门', py: 'mén', en: 'door' }, { e: '✋', c: '手', py: 'shǒu', en: 'hand' },
  { e: '👂', c: '耳', py: 'ěr', en: 'ear' }, { e: '🍵', c: '茶', py: 'chá', en: 'tea' },
  { e: '🍚', c: '饭', py: 'fàn', en: 'cooked rice / meal' }, { e: '💰', c: '钱', py: 'qián', en: 'money' },
  { e: '🍎', c: '苹果', py: 'píngguǒ', en: 'apple' }, { e: '🍉', c: '西瓜', py: 'xīguā', en: 'watermelon' },
  { e: '📞', c: '电话', py: 'diànhuà', en: 'telephone' }, { e: '✈️', c: '飞机', py: 'fēijī', en: 'airplane' },
  { e: '🏠', c: '房子', py: 'fángzi', en: 'house' }, { e: '☀️', c: '太阳', py: 'tàiyáng', en: 'sun' },
];

// ---------- 商店小游戏：偏旁拼字 ----------
const COMPONENTS = [
  { parts: ['氵', '可'], c: '河', py: 'hé', en: 'river', wrong: ['何', '海', '湖'] },
  { parts: ['女', '子'], c: '好', py: 'hǎo', en: 'good', wrong: ['妈', '如', '孩'] },
  { parts: ['日', '月'], c: '明', py: 'míng', en: 'bright', wrong: ['朋', '昌', '阳'] },
  { parts: ['木', '木'], c: '林', py: 'lín', en: 'forest', wrong: ['休', '森', '本'] },
  { parts: ['亻', '木'], c: '休', py: 'xiū', en: 'to rest', wrong: ['体', '林', '什'] },
  { parts: ['口', '马'], c: '吗', py: 'ma', en: '(question word)', wrong: ['妈', '吃', '骂'] },
  { parts: ['女', '马'], c: '妈', py: 'mā', en: 'mom', wrong: ['吗', '好', '姐'] },
  { parts: ['亻', '尔'], c: '你', py: 'nǐ', en: 'you', wrong: ['他', '们', '什'] },
  { parts: ['田', '力'], c: '男', py: 'nán', en: 'male', wrong: ['思', '累', '加'] },
  { parts: ['小', '大'], c: '尖', py: 'jiān', en: 'sharp', wrong: ['天', '太', '少'] },
  { parts: ['禾', '火'], c: '秋', py: 'qiū', en: 'autumn', wrong: ['和', '秒', '灯'] },
  { parts: ['艹', '早'], c: '草', py: 'cǎo', en: 'grass', wrong: ['花', '苗', '章'] },
  { parts: ['门', '口'], c: '问', py: 'wèn', en: 'to ask', wrong: ['间', '闻', '回'] },
  { parts: ['宀', '子'], c: '字', py: 'zì', en: 'character', wrong: ['学', '家', '安'] },
  { parts: ['日', '青'], c: '晴', py: 'qíng', en: 'sunny', wrong: ['清', '请', '睛'] },
  { parts: ['氵', '青'], c: '清', py: 'qīng', en: 'clear', wrong: ['晴', '请', '情'] },
  { parts: ['讠', '青'], c: '请', py: 'qǐng', en: 'please', wrong: ['清', '晴', '说'] },
  { parts: ['犭', '苗'], c: '猫', py: 'māo', en: 'cat', wrong: ['狗', '描', '猪'] },
  { parts: ['山', '石'], c: '岩', py: 'yán', en: 'rock', wrong: ['岁', '码', '出'] },
  { parts: ['口', '乞'], c: '吃', py: 'chī', en: 'to eat', wrong: ['喝', '吗', '叫'] },
  { parts: ['人', '人'], c: '从', py: 'cóng', en: 'from / to follow', wrong: ['众', '比', '入'] },
  { parts: ['日', '十'], c: '早', py: 'zǎo', en: 'early', wrong: ['旦', '田', '草'] },
  { parts: ['门', '日'], c: '间', py: 'jiān', en: 'between / room', wrong: ['问', '闻', '明'] },
  { parts: ['心', '你'], c: '您', py: 'nín', en: 'you (polite)', wrong: ['你', '想', '怎'] },
];
