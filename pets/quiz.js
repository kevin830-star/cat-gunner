// 出题：中文（共用题库 ../shared/zh-bank.js）+ 数学（math.js）
// Quiz.make(sub, grade, diff) → { sub, type, html, opts:[{t, py}], ans, explain, say }
// grade：1-6 年级；diff：-1 简单（防御题）、0 普通、1 难（威力大的技能）
'use strict';

const Quiz = (() => {
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BLANK = '<span class="blank">　</span>';
  const recent = [];   // 最近出过的题，尽量不重复

  // 年级 → 题库分级（1 低 2 中 3 高），难题高一级，防御题低一级
  const bankGrade = (g, diff) => Math.max(1, Math.min(3, (g <= 2 ? 1 : g <= 4 ? 2 : 3) + diff));
  function fromBank(bank, key, target) {
    for (let t = target; t >= 1; t--) {
      let pool = bank.filter(q => (q.grade || 1) === t);
      if (!pool.length) continue;
      const fresh = pool.filter(q => !recent.includes(key + (q.s || q.c || q.w)));
      if (fresh.length) pool = fresh;
      const q = pick(pool);
      recent.push(key + (q.s || q.c || q.w)); if (recent.length > 40) recent.shift();
      return q;
    }
    return pick(bank);
  }
  // 选项：第一个是正确答案，打乱后记下正确位置
  function finish(o) {
    const order = shuffle(o.opts.map((x, i) => ({ ...x, ok: i === 0 })));
    return { ...o, opts: order, ans: order.findIndex(x => x.ok) };
  }
  const split = o => { const [t, py] = o.split('|'); return { t, py: py || '' }; };

  const ZH = {
    pic(g) {
      const w = fromBank(PIC_WORDS, 'pic', g);
      const others = shuffle(PIC_WORDS.filter(x => x.c !== w.c)).slice(0, 3);
      return finish({ type: '看图选字', html: `<div class="qpic">${w.e}</div><div class="qtext">图上画的是什么？</div>`,
        opts: [w, ...others].map(x => ({ t: x.c, py: x.py })), explain: `${w.e} 是「${w.c}」（${w.py}）`, say: '图上画的是什么？' });
    },
    comp(g) {
      const w = fromBank(COMPONENTS, 'comp', g);
      return finish({ type: '偏旁拼字', html: `<div class="qcomp"><span>${w.parts[0]}</span>＋<span>${w.parts[1]}</span>＝${BLANK}</div><div class="qtext">这两个部分合起来是哪个字？</div>`,
        opts: [{ t: w.c, py: w.py }, ...w.wrong.map(c => ({ t: c, py: '' }))], explain: `${w.parts[0]} ＋ ${w.parts[1]} ＝ ${w.c}（${w.py}）`, say: '这两个部分合起来是哪个字？' });
    },
    fill(g) {
      const q = fromBank(FILL_QUIZ, 'fill', g), ans = split(q.opts[0]).t;
      return finish({ type: '词语填空', html: `<div class="qsent">${esc(q.s).replace('____', BLANK)}</div>`,
        opts: q.opts.map(split), explain: `${q.s.replace('____', `<b>${ans}</b>`)}<br><span class="qpy">${q.py}</span>`, say: q.s.replace('____', '什么') });
    },
    idiom(g) {
      const q = fromBank(IDIOM_QUIZ, 'idiom', g), ans = split(q.opts[0]).t;
      const mean = (q.s.match(/（(.*?)）/) || [])[1] || '', text = q.s.replace(/（.*?）/g, '');
      return finish({ type: '成语填空', html: `<div class="qsent">${text.replace('____', BLANK)}</div><div class="qhint">意思：${mean}</div>`,
        opts: q.opts.map(split), explain: `${text.replace('____', `<b>${ans}</b>`)}（${q.py}）<br>${mean}`, say: `意思是：${mean}。${text.replace('____', '什么')}` });
    },
    poem(g) {
      const q = fromBank(POEM_QUIZ, 'poem', g), ans = split(q.opts[0]).t;
      return finish({ type: '古诗填空', html: `<div class="qsent">${q.s.replace('____', BLANK)}</div><div class="qhint">${q.zh || ''}</div>`,
        opts: q.opts.map(split), explain: `${q.s.replace('____', `<b>${ans}</b>`)}<br><span class="qpy">${q.py}</span>`,
        say: `${(q.zh || '').replace(/[。？！]$/, '')}。${q.s.replace(/（.*?）/g, '').replace('____', '什么')}` });
    },
    pron(g) {
      const q = fromBank(PRONOUNCE_QUIZ, 'pron', g);
      const word = q.w.replace(q.target, `<b class="tgt">${q.target}</b>`);
      return finish({ type: '读音选择', html: `<div class="qsent">${word}</div><div class="qtext">加粗的「${q.target}」字怎么读？</div>`,
        opts: q.opts.map(p => ({ t: p, py: '' })), explain: `「${q.w}」里的「${q.target}」读 ${q.opts[0]}`, say: '选出加粗的字的正确读音' });
    },
  };
  // 不同难度出不同题型
  const ZH_MIX = {
    '-1': ['pic', 'pic', 'pron', 'comp', 'comp'],
    '0': ['comp', 'comp', 'fill', 'fill', 'fill', 'pron', 'pron', 'pic', 'idiom', 'poem'],
    '1': ['idiom', 'idiom', 'idiom', 'poem', 'poem', 'fill', 'fill', 'comp'],
  };

  function make(sub, grade, diff = 0) {
    if (sub === 'math') {
      const m = MathGen.make(grade + diff);
      return finish({ sub, type: m.type, html: `<div class="qmath${m.text.length > 22 ? ' long' : ''}">${esc(m.text).replace(/([=:]\s*)？|^？/, (x, p) => (p || '') + BLANK)}</div>`,
        opts: m.opts.map(t => ({ t, py: '' })), explain: esc(m.explain), say: m.say });
    }
    const type = pick(ZH_MIX[String(diff)] || ZH_MIX['0']);
    return { sub: 'zh', ...ZH[type](bankGrade(grade, diff)) };
  }
  return { make, bankGrade };
})();
