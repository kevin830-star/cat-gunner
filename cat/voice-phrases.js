import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

export const VOICE_NAME = 'Zephyr';
export const DEFAULT_STYLE = '自然明媚、元气亲切的年轻女声，标准普通话，吐字清晰温暖，像活泼可爱的少女老师';

export function formatSpeechText(text) {
  return String(text || '')
    .replace(/_{2,}/g, '什么')
    .replace(/[（(][^）)]*[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü][^）)]*[）)]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/[→·]/g, '，')
    .replace(/[：；]/g, '，')
    .replace(/——|……/g, '，')
    .replace(/\s+/g, ' ')
    .trim();
}

export function phraseFilename(cleanText) {
  const hash = crypto
    .createHash('sha256')
    .update(`${VOICE_NAME}|${DEFAULT_STYLE}|${cleanText}`)
    .digest('hex')
    .slice(0, 16);
  return `${hash}.wav`;
}

export function collectAllVoicePhrases(rootDir) {
  const dataPath = path.join(rootDir, 'data.js');
  const code = fs.readFileSync(dataPath, 'utf8');
  const sandbox = {};
  vm.runInNewContext(
    `${code}\nObject.assign(globalThis, { BUFFS, FILL_QUIZ, IDIOM_QUIZ, POEM_QUIZ, COMPONENTS, PIC_WORDS, PRONOUNCE_QUIZ });`,
    sandbox,
  );
  const { BUFFS, FILL_QUIZ, IDIOM_QUIZ, POEM_QUIZ, COMPONENTS, PIC_WORDS, PRONOUNCE_QUIZ } = sandbox;

  const idiomMeaning = q => (q.s.match(/（(.*?)）/) || [])[1] || '';
  const idiomText = q => q.s.replace(/（.*?）/g, '');
  const zhOf = (q, kind) => (kind === 'idiom' ? idiomMeaning(q) : q.zh || '');
  const questionSpeech = (q, kind) =>
    `${kind === 'idiom' ? '意思是：' : ''}${zhOf(q, kind).replace(/[。？！]$/, '')}。${q.s
      .replace(/（.*?）/g, '')
      .replace('____', '什么')}`;

  const phrases = new Set();
  const add = raw => {
    const clean = formatSpeechText(raw);
    if (clean) phrases.add(clean);
  };

  add('你好呀！我是小猫咪，今天也要元气满满地保卫猫窝哦！');
  // 优先预生成高频技能释放、拾取增益与固定战斗提示
  for (const fixed of [
    '猫薄荷',
    '冲击波',
    '导弹防御',
    '答对了，金光觉醒',
    '考试通过，猫咪和猫窝满血复活，导弹防御加一次',
    '小头目来了！',
    '个头越大、颜色越深越强：蓝·强化 → 紫·精英 → 红·狂暴',
  ]) {
    add(fixed);
  }
  for (const b of BUFFS) add(`${b.name}，${b.tip}`);

  for (const q of FILL_QUIZ) {
    const ans = q.opts[0].split('|')[0];
    add(q.s.replace('____', ans).replace(/（.*?）/g, ''));
    add(q.s.replace('____', ans));
  }
  for (const q of IDIOM_QUIZ) {
    const ans = q.opts[0].split('|')[0];
    add(questionSpeech(q, 'idiom'));
    add(q.s.replace('____', ans).replace(/（.*?）/g, ''));
    add(idiomText(q).replace('____', ans));
  }
  for (const q of POEM_QUIZ) {
    const ans = q.opts[0].split('|')[0];
    add(questionSpeech(q, 'poem'));
    add(q.s.replace('____', ans).replace(/（.*?）/g, ''));
  }
  for (const w of COMPONENTS) add(w.c);
  for (const w of PIC_WORDS) add(w.c);
  for (const q of PRONOUNCE_QUIZ) add(q.w.replace(/（.*?）/g, ''));

  return [...phrases];
}
