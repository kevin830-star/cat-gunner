// 数学题生成器：按年级（1-6）随机出题，每题 4 个选项
// makeMath(level) → { type, text, ans, opts, explain, say }
'use strict';

const MathGen = (() => {
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const PETN = ['火尾喵', '泡泡獭', '叶叶兔', '电丸鼠', '星星鹿', '影子猫'];
  const THINGS = [['小鱼干', '条'], ['星星糖', '颗'], ['松果', '个'], ['贝壳', '个'], ['苹果', '个'], ['彩虹豆', '颗']];

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const frac = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = gcd(Math.abs(n), d) || 1; n /= g; d /= g; return d === 1 ? String(n) : `${n}/${d}`; };
  const dec = x => String(Math.round(x * 100) / 100);

  // 生成 3 个不同的干扰项
  function options(ans, wrongs) {
    const set = new Set([String(ans)]), out = [String(ans)];
    for (const w of wrongs) {
      const s = String(w);
      if (out.length >= 4) break;
      if (!set.has(s) && s !== 'NaN' && !s.startsWith('-')) { set.add(s); out.push(s); }
    }
    let k = 1;
    while (out.length < 4) {   // 不够就在答案附近补
      const n = Number(ans);
      const s = Number.isFinite(n) ? dec(n + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Number.isInteger(n) ? 1 : 0.1)) : String(ans) + k;
      if (!set.has(s) && !s.startsWith('-')) { set.add(s); out.push(s); }
      k++;
    }
    return out;
  }
  const near = (a, ...d) => d.map(x => a + x);
  // 朗读：符号读成中文；算式里的「？」读作「多少」，句末的问号不读
  const say = t => t.replace(/([=:])\s*？/g, '$1 多少').replace(/^？/, '多少').replace(/(\d+)\/(\d+)/g, '$2分之$1')
    .replace(/×/g, '乘').replace(/÷/g, '除以').replace(/\+/g, '加').replace(/−/g, '减').replace(/=/g, '等于').replace(/:/g, '比').replace(/……/g, '余');
  // 乘法口诀：二六十二、三三得九
  const CN = '零一二三四五六七八九';
  const cn = n => n < 10 ? CN[n] : n === 10 ? '十' : n < 20 ? '十' + (n % 10 ? CN[n % 10] : '') : CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
  const koujue = (a, b) => `${CN[Math.min(a, b)]}${CN[Math.max(a, b)]}${a * b < 10 ? '得' : ''}${cn(a * b)}`;
  const Q = (type, text, ans, wrongs, explain) => ({ type, text, ans: String(ans), opts: options(ans, wrongs), explain, say: say(text) });

  // ---------- 一年级 ----------
  const L1 = [
    () => { const a = R(2, 12), b = R(1, 20 - a); return Q('加法', `${a} + ${b} = ？`, a + b, near(a + b, 1, -1, 2, -2), `${a} + ${b} = ${a + b}`); },
    () => { const a = R(6, 20), b = R(1, a - 1); return Q('减法', `${a} − ${b} = ？`, a - b, near(a - b, 1, -1, 2), `${a} − ${b} = ${a - b}`); },
    () => { const a = R(2, 9), c = R(a + 2, 20); return Q('填空', `？ + ${a} = ${c}`, c - a, [c + a, c - a + 1, c - a - 1], `${c} − ${a} = ${c - a}，所以 ${c - a} + ${a} = ${c}`); },
    () => { const [t, u] = pick(THINGS), a = R(3, 9), b = R(2, 9), p = pick(PETN); return Q('应用题', `${p}有 ${a} ${u}${t}，又捡到 ${b} ${u}，现在一共有几${u}？`, a + b, near(a + b, 1, -1, -2), `${a} + ${b} = ${a + b}（${u}）`); },
  ];
  // ---------- 二年级 ----------
  const L2 = [
    () => { const a = R(15, 68), b = R(12, 99 - a); return Q('两位数加法', `${a} + ${b} = ？`, a + b, [a + b - 10, a + b + 10, a + b + 1], `个位 ${a % 10}+${b % 10}，满十进一：${a} + ${b} = ${a + b}`); },
    () => { const a = R(40, 99), b = R(12, a - 10); return Q('两位数减法', `${a} − ${b} = ？`, a - b, [a - b + 10, a - b - 10, a - b + 1], `${a} − ${b} = ${a - b}（个位不够减，向十位借 1）`); },
    () => { const a = R(2, 9), b = R(2, 9); return Q('乘法口诀', `${a} × ${b} = ？`, a * b, [a * b + a, a * b - b, a + b, a * b + 1], `口诀：${koujue(a, b)}`); },
    () => { const b = R(2, 9), c = R(2, 9), a = b * c; return Q('表内除法', `${a} ÷ ${b} = ？`, c, [c + 1, c - 1, b], `想口诀：${b} × ${c} = ${a}，所以 ${a} ÷ ${b} = ${c}`); },
    () => { const [t, u] = pick(THINGS), n = R(3, 6), each = R(2, 9), p = pick(PETN); return Q('应用题', `${p}有 ${n} 个盒子，每个盒子装 ${each} ${u}${t}，一共有几${u}？`, n * each, [n + each, n * each + each, n * each - n], `${n} × ${each} = ${n * each}（${u}）`); },
  ];
  // ---------- 三年级 ----------
  const L3 = [
    () => { const a = R(120, 680), b = R(105, 999 - a); return Q('三位数加法', `${a} + ${b} = ？`, a + b, [a + b - 10, a + b + 100, a + b - 100], `${a} + ${b} = ${a + b}`); },
    () => { const a = R(300, 999), b = R(110, a - 50); return Q('三位数减法', `${a} − ${b} = ？`, a - b, [a - b + 10, a - b - 10, a - b + 100], `${a} − ${b} = ${a - b}`); },
    () => { const a = R(12, 98), b = R(3, 9); return Q('两位数乘一位数', `${a} × ${b} = ？`, a * b, [a * b + b, a * b - 10, a * b + 10], `${a} × ${b} = ${Math.floor(a / 10) * 10} × ${b} + ${a % 10} × ${b} = ${a * b}`); },
    () => { const b = R(3, 9), c = R(11, 32), a = b * c; return Q('除法', `${a} ÷ ${b} = ？`, c, [c + 1, c - 1, c + 10], `${b} × ${c} = ${a}，所以 ${a} ÷ ${b} = ${c}`); },
    () => { const b = R(3, 9), c = R(3, 9), r = R(1, b - 1), a = b * c + r; return Q('有余数的除法', `${a} ÷ ${b} = ？`, `${c}……${r}`, [`${c}……${r + 1 < b ? r + 1 : r - 1}`, `${c + 1}……${r}`, `${c - 1}……${r + b <= 9 ? r + b : r}`], `${b} × ${c} = ${b * c}，${a} − ${b * c} = ${r}，商 ${c} 余 ${r}（余数要比除数 ${b} 小）`); },
    () => { const [t, u] = pick(THINGS), n = R(3, 8), tot = n * R(4, 12), p = pick(PETN); return Q('应用题', `${p}把 ${tot} ${u}${t}平均分给 ${n} 个朋友，每个朋友分到几${u}？`, tot / n, [tot / n + 1, tot - n, tot / n - 1], `${tot} ÷ ${n} = ${tot / n}（${u}）`); },
    () => { const l = R(3, 12), w = R(2, l); return Q('周长', `长 ${l} 厘米、宽 ${w} 厘米的长方形，周长是多少厘米？`, 2 * (l + w), [l * w, l + w, 2 * l + w], `周长 =（长 + 宽）× 2 =（${l} + ${w}）× 2 = ${2 * (l + w)}`); },
  ];
  // ---------- 四年级 ----------
  const L4 = [
    () => { const a = R(12, 49), b = R(11, 39); return Q('两位数乘两位数', `${a} × ${b} = ？`, a * b, [a * b + 10, a * b - a, a * (b % 10) + a], `${a} × ${b} = ${a} × ${Math.floor(b / 10) * 10} + ${a} × ${b % 10} = ${a * b}`); },
    () => { const b = R(12, 35), c = R(3, 24), a = b * c; return Q('除数是两位数的除法', `${a} ÷ ${b} = ？`, c, [c + 1, c - 1, c + 10], `${b} × ${c} = ${a}，所以商是 ${c}`); },
    () => { const a = R(2, 9), b = R(2, 9), c = R(5, 40); return Q('混合运算', `${c} + ${a} × ${b} = ？`, c + a * b, [(c + a) * b, c + a + b, c * a + b], `先乘后加：${a} × ${b} = ${a * b}，${c} + ${a * b} = ${c + a * b}`); },
    () => { const a = R(10, 40), b = R(2, 9), c = R(2, 6); return Q('带括号运算', `(${a} − ${b}) × ${c} = ？`, (a - b) * c, [a - b * c, (a - b) * c + c, a * c - b], `先算括号：${a} − ${b} = ${a - b}，再乘 ${c} 得 ${(a - b) * c}`); },
    () => { const k = pick([[25, 4], [125, 8], [50, 2], [20, 5]]), m = R(2, 9); return Q('简便运算', `${k[0]} × ${m} × ${k[1]} = ？`, k[0] * k[1] * m, [k[0] * m + k[1], k[0] * k[1] + m, k[0] * k[1] * m + k[0]], `先算 ${k[0]} × ${k[1]} = ${k[0] * k[1]}，再乘 ${m}：${k[0] * k[1] * m}`); },
    () => { const sp = R(40, 90), t = R(3, 9), p = pick(PETN); return Q('应用题', `${p}每分钟跑 ${sp} 米，跑了 ${t} 分钟，一共跑了多少米？`, sp * t, [sp + t, sp * t + sp, sp * t - 10], `速度 × 时间 = 路程：${sp} × ${t} = ${sp * t}（米）`); },
    () => { const a = R(3, 15), b = R(2, 12); return Q('面积', `长 ${a} 米、宽 ${b} 米的长方形，面积是多少平方米？`, a * b, [2 * (a + b), a + b, a * b + a], `面积 = 长 × 宽 = ${a} × ${b} = ${a * b}`); },
  ];
  // ---------- 五年级 ----------
  const L5 = [
    () => { const a = R(11, 99) / 10, b = R(11, 99) / 10; return Q('小数加法', `${dec(a)} + ${dec(b)} = ？`, dec(a + b), [dec(a + b + 1), dec(a + b - 0.1), dec(a + b + 0.1)], `小数点对齐：${dec(a)} + ${dec(b)} = ${dec(a + b)}`); },
    () => { const a = R(50, 99) / 10, b = R(11, 49) / 10; return Q('小数减法', `${dec(a)} − ${dec(b)} = ？`, dec(a - b), [dec(a - b + 1), dec(a - b + 0.1), dec(a - b - 0.1)], `小数点对齐：${dec(a)} − ${dec(b)} = ${dec(a - b)}`); },
    () => { const a = R(12, 49) / 10, b = R(2, 9); return Q('小数乘法', `${dec(a)} × ${b} = ？`, dec(a * b), [dec(a * b * 10), dec(a * b / 10), dec(a * b + 1)], `先算 ${Math.round(a * 10)} × ${b} = ${Math.round(a * 10) * b}，再点一位小数：${dec(a * b)}`); },
    () => { const x = R(3, 40), a = R(5, 60); return Q('解方程', `x + ${a} = ${x + a}，x = ？`, x, [x + a + a, x + 1, x - 1], `x = ${x + a} − ${a} = ${x}`); },
    () => { const x = R(2, 12), a = R(2, 9); return Q('解方程', `${a}x = ${a * x}，x = ？`, x, [a * x - a, x + 1, a * x], `x = ${a * x} ÷ ${a} = ${x}`); },
    () => { const x = R(2, 9), a = R(2, 6), b = R(1, 9); return Q('解方程', `${a}x + ${b} = ${a * x + b}，x = ？`, x, [x + 1, (a * x + b) / a > 0 ? Math.floor((a * x + b) / a) + 1 : x + 2, a * x], `${a}x = ${a * x + b} − ${b} = ${a * x}，x = ${a * x} ÷ ${a} = ${x}`); },
    () => { const d = R(5, 12), a = R(1, d - 2), b = R(1, d - 1 - a); return Q('同分母分数加法', `${a}/${d} + ${b}/${d} = ？`, frac(a + b, d), [`${a + b}/${d + d}`, frac(a + b + 1, d), frac(Math.abs(a - b) || 1, d)], `分母不变，分子相加：${a} + ${b} = ${a + b}，得 ${frac(a + b, d)}`); },
    () => { const b = R(4, 16), h = R(2, 10) * 2; return Q('三角形面积', `底 ${b} 厘米、高 ${h} 厘米的三角形，面积是多少平方厘米？`, b * h / 2, [b * h, b + h, b * h / 2 + b], `三角形面积 = 底 × 高 ÷ 2 = ${b} × ${h} ÷ 2 = ${b * h / 2}`); },
  ];
  // ---------- 六年级 ----------
  const L6 = [
    () => { const p = pick([[1, 2, 1, 3], [1, 2, 1, 4], [1, 3, 1, 6], [2, 3, 1, 6], [1, 4, 1, 6], [3, 4, 1, 8], [2, 5, 1, 10], [1, 3, 1, 4]]); const n = p[0] * p[3] + p[2] * p[1], d = p[1] * p[3]; return Q('异分母分数加法', `${p[0]}/${p[1]} + ${p[2]}/${p[3]} = ？`, frac(n, d), [`${p[0] + p[2]}/${p[1] + p[3]}`, frac(n + 1, d), frac(n, d * 2)], `先通分再相加：${frac(n, d)}`); },
    () => { const a = R(1, 4), b = a + R(1, 5), c = R(2, 9); return Q('分数乘法', `${a}/${b} × ${c} = ？`, frac(a * c, b), [`${a * c}/${b * c}`, frac(a, b * c), frac(a * c + 1, b)], `分子乘 ${c}：${a} × ${c} = ${a * c}，得 ${frac(a * c, b)}`); },
    () => { const pct = pick([10, 20, 25, 40, 50, 75]), n = pick([40, 60, 80, 120, 160, 200, 240]); return Q('百分数', `${n} 的 ${pct}% 是多少？`, n * pct / 100, [pct, n * pct / 10, n - n * pct / 100], `${n} × ${pct}% = ${n} × ${pct / 100} = ${n * pct / 100}`); },
    () => { const r = R(1, 6); return Q('圆的面积', `半径 ${r} 厘米的圆，面积是多少平方厘米？（π 取 3.14）`, dec(3.14 * r * r), [dec(3.14 * 2 * r), dec(3.14 * r), dec(3.14 * 2 * r * r)], `S = πr² = 3.14 × ${r} × ${r} = ${dec(3.14 * r * r)}`); },
    () => { const a = R(2, 9), b = R(2, 9), k = R(2, 8); if (a === b) return L6[4](); return Q('比例', `${a} : ${b} = ${a * k} : ？`, b * k, [b + k, a * k + b, b * k + k], `前项乘 ${k}，后项也乘 ${k}：${b} × ${k} = ${b * k}`); },
    () => { const tot = pick([24, 30, 36, 40, 48, 60]), a = R(1, 3), b = R(1, 4); const s = a + b; if (tot % s || a === b) return L6[5](); return Q('按比分配', `${tot} 颗星星糖按 ${a} : ${b} 分给两只宠物，多的那只分到几颗？`, Math.max(a, b) * tot / s, [Math.min(a, b) * tot / s, tot / 2, tot / s], `一共 ${s} 份，每份 ${tot / s} 颗，多的 ${Math.max(a, b)} 份：${Math.max(a, b) * tot / s} 颗`); },
  ];
  const LEVELS = [L1, L2, L3, L4, L5, L6];

  function make(level) {
    const lv = Math.max(1, Math.min(6, level));
    // 主要出本年级的题，偶尔复习低一年级
    const pool = lv > 1 && Math.random() < 0.25 ? LEVELS[lv - 2] : LEVELS[lv - 1];
    for (let tries = 0; tries < 10; tries++) {
      const q = pick(pool)();
      if (q && q.opts.length === 4 && new Set(q.opts).size === 4) return q;
    }
    return LEVELS[0][0]();
  }
  return { make, LEVELS };
})();
