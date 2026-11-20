// 头目：种类数据和画法。每 3 关一个，按顺序轮流出场
'use strict';

// hp / spd：相对基础头目的倍数和移动速度；special：特殊攻击；cd：特殊攻击间隔（秒）
const BOSSES = [
  { id: 'dog', name: '野狗', py: 'yěgǒu', r: 38, hp: 1, spd: 36, special: 'bark', cd: 5, tip: '汪汪叫来老鼠小弟' },
  { id: 'fox', name: '狐狸', py: 'húli', r: 33, hp: 0.85, spd: 48, special: 'dash', cd: 4.5, tip: '会突然冲向猫咪' },
  { id: 'wolf', name: '大灰狼', py: 'dà huīláng', r: 40, hp: 1.1, spd: 38, special: 'howl', cd: 6, tip: '嚎叫让敌人跑得更快' },
  { id: 'croc', name: '巨鳄', py: 'jù è', r: 46, hp: 1.55, spd: 35, special: 'snap', cd: 4.3, tip: '高速扑咬并甩尾扫击周围' },
  { id: 'elephant', name: '大象', py: 'dàxiàng', r: 52, hp: 1.6, spd: 26, special: 'stomp', cd: 5, tip: '跺脚震伤周围' },
  { id: 'gorilla', name: '金刚猩猩', py: 'jīngāng xīngxīng', r: 54, hp: 1.9, spd: 32, special: 'boulder', cd: 4.5, tip: '捶胸咆哮，砸出连环巨石', barY: 86 },
  { id: 'cobra', name: '眼镜王蛇', py: 'yǎnjìng wángshé', r: 44, hp: 1.55, spd: 38, special: 'venom', cd: 3.6, tip: '喷射环形毒液弹幕并召唤毒蛇', barY: 98 },
  { id: 'scorpion', name: '暗影巨蝎', py: 'ànyǐng jùxiē', r: 50, hp: 1.85, spd: 36, special: 'sting', cd: 4.0, tip: '连发剧毒尾刺并召唤自爆鼠群', barY: 92 },
  { id: 'mammoth', name: '猛犸巨兽', py: 'měngmǎ jùshòu', r: 60, hp: 2.25, spd: 26, special: 'quake', cd: 4.8, tip: '冰霜践踏，引发三连震荡波', barY: 96 },
  { id: 'giraffe', name: '长颈鹿', py: 'chángjǐnglù', r: 40, hp: 1.2, spd: 34, special: 'spit', cd: 3.5, tip: '从高处吐出一排树叶弹', barY: 112 },
  { id: 'tiger', name: '老虎', py: 'lǎohǔ', r: 40, hp: 1.2, spd: 42, special: 'pounce', cd: 4.5, tip: '高高跳起扑向猫咪' },
  { id: 'lion', name: '狮子', py: 'shīzi', r: 44, hp: 1.4, spd: 36, special: 'roar', cd: 6, tip: '吼声把猫咪震飞' },
  { id: 'rhino', name: '犀牛', py: 'xīniú', r: 48, hp: 1.7, spd: 30, special: 'charge', cd: 5, tip: '直线冲撞，快躲开' },
  { id: 'dragon', name: '巨龙', py: 'jùlóng', r: 62, hp: 2.0, spd: 28, special: 'dragon', cd: 3.2, tip: '喷火扫射，召唤陨石雨', barY: 122, apex: true },
  { id: 'phoenix', name: '烈焰凤凰', py: 'lièyàn fènghuáng', r: 60, hp: 2.35, spd: 34, special: 'phoenix', cd: 3.2, tip: '烈焰羽毛雨与炽热俯冲', barY: 112, apex: true },
];

// 画法：坐标以身体中心为原点、朝右，按 r = 40 的大小绘制
// pose: { t, walk, fl, mouth, headRot, lean, puff, trunkUp, angry }
const BOSS_ART = (() => {
  const OUT = '#4a3423', TAU = Math.PI * 2;
  let g, fl;
  const col = c => fl ? '#fff' : c;
  const E = (x, y, rx, ry, fill, stroke = true, rot = 0) => {
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU);
    if (fill) { g.fillStyle = col(fill); g.fill(); }
    if (stroke) g.stroke();
  };
  const P = (pts, fill, stroke = true) => {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fillStyle = col(fill); g.fill(); if (stroke) g.stroke();
  };
  const L = (pts, color = OUT, w = 3) => {
    g.save(); g.strokeStyle = color; g.lineWidth = w;
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke(); g.restore();
  };
  // 一条有轮廓的粗曲线：尾巴、象鼻
  const curve = (x0, y0, cx, cy, x1, y1, color, w) => {
    g.save(); g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1);
    g.strokeStyle = OUT; g.lineWidth = w + 5; g.stroke();
    g.strokeStyle = col(color); g.lineWidth = w; g.stroke();
    g.restore();
  };
  const legs = (p, color, w = 9, y = 31) => {
    const s = p.walk ? Math.sin(p.t * 9) * 4 : 0;
    E(-24 + s, y, w, 7, color); E(-8 - s, y, w, 7, color); E(12 + s, y, w, 7, color); E(27 - s, y, w, 7, color);
  };
  const eyes = (x, y, gap, p, r = 4.5, pupil = '#c8402d') => {
    for (const ex of [x, x + gap]) {
      g.save(); g.lineWidth = 2; E(ex, y, r, r, '#fff'); g.restore();
      E(ex + 1, y, r * 0.5, r * 0.5, fl ? '#fff' : pupil, false);
    }
    L([x - r - 2, y - r - 4, x + r, y - r + 1], OUT, 3);
    L([x + gap + r + 2, y - r - 4, x + gap - r, y - r + 1], OUT, 3);
  };
  const mouth = (x, y, w, p, fangs = true) => {
    const o = p.mouth || 0;
    if (o > 0.15) {
      g.save(); g.lineWidth = 2.5; E(x, y + o * 3, w, 2 + o * 7, '#7a1f1f');
      if (fangs) { g.lineWidth = 1.5; P([x - w * 0.6, y - 1, x - w * 0.3, y + 5, x - w * 0.1, y - 1], '#fff'); P([x + w * 0.6, y - 1, x + w * 0.3, y + 5, x + w * 0.1, y - 1], '#fff'); }
      g.restore();
    } else {
      g.save(); g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x, y + 4, x + w, y); g.stroke();
      if (fangs) { g.lineWidth = 1.5; P([x - w * 0.6, y + 1, x - w * 0.4, y + 6, x - w * 0.2, y + 2], '#fff'); P([x + w * 0.6, y + 1, x + w * 0.4, y + 6, x + w * 0.2, y + 2], '#fff'); }
      g.restore();
    }
  };
  const head = (x, y, p, fn) => { g.save(); g.translate(x, y); g.rotate(p.headRot || 0); fn(); g.restore(); };
  const wag = p => Math.sin(p.t * 6) * 5;

  const kinds = {
    dog(p) {
      const fur = '#a9703f', dk = '#6f4524';
      curve(-34, 6, -54, 0, -52, -22 + wag(p), dk, 5);
      legs(p, dk);
      E(0, 8, 38, 30, fur); E(6, 17, 22, 15, '#d9b287', false);
      head(8, -20, p, () => {
        E(-22, -2, 9, 17, dk); E(24, -4, 9, 17, dk);
        E(0, 0, 26, 22, fur);
        E(9, 9, 14, 10, '#f0d9bd'); E(13, 4, 5, 3.5, OUT, false);
        eyes(-8, -7, 20, p); mouth(9, 13, 8, p);
      });
      g.save(); g.strokeStyle = col('#c8402d'); g.lineWidth = 6; g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(8, 9, 30, 0); g.stroke(); g.restore();
      for (const i of [-1, 0, 1]) E(8 + i * 12, 5 - Math.abs(i) * 2, 2.5, 2.5, '#e6e6e6', false);
    },
    fox(p) {
      const fur = '#f08a3c', dk = '#5a3418';
      g.save(); g.translate(-40, -2); g.rotate(-0.55 + wag(p) * 0.02);
      E(0, 0, 26, 13, fur); E(-17, 0, 10, 9, '#fff');
      g.restore();
      legs(p, dk, 8);
      E(0, 10, 34, 26, fur); E(10, 18, 15, 14, '#fff', false);
      head(10, -18, p, () => {
        P([-22, -8, -18, -42, -2, -18], fur); P([-17, -16, -16, -36, -8, -20], dk, false);
        P([6, -18, 20, -42, 25, -8], fur); P([11, -19, 19, -36, 21, -15], dk, false);
        E(0, 0, 27, 20, fur);
        E(-13, 9, 10, 7, '#fff', false); E(15, 9, 11, 7, '#fff', false);
        E(13, 6, 10, 7, '#fff'); E(20, 3, 4, 3, OUT, false);
        eyes(-8, -5, 18, p, 3.8, '#3d2a1a'); mouth(13, 11, 6, p);
      });
    },
    wolf(p) {
      const fur = '#8b929e', dk = '#5b6270';
      g.save(); g.translate(-42, 0); g.rotate(-0.4 + wag(p) * 0.02); E(0, 0, 24, 11, dk); g.restore();
      legs(p, dk, 9);
      E(0, 8, 40, 30, fur); E(6, 18, 22, 14, '#c9cfd8', false);
      P([-30, -14, -22, -26, -18, -14, -10, -28, -6, -16, 2, -28, 6, -14], dk);  // 颈背的鬃毛
      head(8, -22, p, () => {
        P([-22, -8, -20, -36, -4, -18], fur); P([6, -18, 20, -36, 24, -8], fur);
        E(0, 0, 27, 22, fur);
        E(13, 8, 16, 10, '#dfe3e8'); E(22, 3, 5, 3.5, OUT, false);
        eyes(-8, -6, 19, p, 4.5, '#e0a800');
        L([-14, -16, -4, 2], '#c8402d', 2);  // 伤疤
        mouth(13, 13, 10, p);
      });
    },
    croc(p) {
      const gr = '#4f9640', dk = '#2f6328', belly = '#e6dfa8';
      const sw = wag(p) * 1.3;
      // 粗壮锯齿鳄鱼尾
      P([-30, 8, -74, 2 + sw, -84, 12 + sw, -62, 22 + sw * 0.6, -28, 24], gr);
      for (const [tx, ty] of [[-46, 5 + sw * 0.4], [-60, 3 + sw * 0.7], [-72, 2 + sw]]) {
        P([tx - 5, ty + 4, tx, ty - 7, tx + 5, ty + 4], dk);
      }
      legs(p, dk, 10, 27);
      // 扁长重甲身躯
      E(-4, 12, 42, 22, gr);
      E(0, 22, 30, 9, belly, false);
      for (const sx of [-28, -16, -4, 8, 20]) P([sx - 6, -7, sx, -17, sx + 6, -7], dk);
      // 长吻鳄头与张合巨口
      head(26, 2, p, () => {
        const o = p.mouth || 0;
        // 下颚
        g.save(); g.translate(4, 9); g.rotate(o * 0.45);
        E(16, 3, 24, 7, dk);
        for (const tx of [4, 12, 20, 28]) P([tx - 2.5, -2, tx, -9, tx + 2.5, -2], '#fff');
        g.restore();
        // 上颚与头骨
        g.save(); g.rotate(-o * 0.25);
        E(-4, -4, 18, 14, gr);
        E(20, 0, 25, 9, gr);
        E(38, -3, 3, 2.2, OUT, false);
        for (const tx of [6, 15, 24, 33]) P([tx - 2.5, 6, tx, 13, tx + 2.5, 6], '#fff');
        // 凸起鳄鱼眼
        E(-6, -15, 7, 7, gr); E(6, -15, 7, 7, gr);
        E(-5, -15, 4.2, 4.2, '#ffe066'); E(7, -15, 4.2, 4.2, '#ffe066');
        E(-5, -15, 1.5, 3.8, fl ? '#fff' : OUT, false); E(7, -15, 1.5, 3.8, fl ? '#fff' : OUT, false);
        g.restore();
      });
    },
    elephant(p) {
      const fur = '#9fb0c2', dk = '#7d8fa3';
      curve(-38, 0, -50, 6, -48, 20 + wag(p) * 0.5, dk, 3); E(-48, 22 + wag(p) * 0.5, 4, 5, OUT, false);
      legs(p, dk, 11, 32);
      E(0, 6, 42, 34, fur);
      head(10, -14, p, () => {
        const flap = 1 + Math.sin(p.t * 5) * 0.06;
        E(-20, 0, 20 * flap, 27, dk); E(-20, 0, 12 * flap, 18, '#c7a9b4', false);
        E(27, -2, 13 * flap, 22, dk);
        E(4, 0, 26, 24, fur);
        // 象鼻：平时垂下，攻击时高高扬起
        const u = p.trunkUp || 0, sw = Math.sin(p.t * 4) * 3;
        curve(20, 6, 46 + u * 6, 12 - u * 30, 40 + sw + u * 14, 36 - u * 66, fur, 11);
        P([10, 13, 30, 24, 13, 21], '#fffbe9');  // 象牙
        eyes(-2, -7, 19, p, 4.2, '#3d2a1a');
      });
    },
    gorilla(p) {
      const fur = '#353842', silver = '#a2aab8', skin = '#56505c';
      const beat = p.puff > 0 ? Math.sin(p.t * 28) * 10 * p.puff : 0;
      const walkS = p.walk ? Math.sin(p.t * 8) * 5 : 0;
      // 后腿
      E(-18 + walkS, 32, 12, 9, fur); E(16 - walkS, 32, 12, 9, fur);
      // 远侧巨臂
      E(26, 12 - beat, 13, 22, '#24262e', true, -0.25);
      // 宽厚银背胸膛
      E(-2, 4, 38, 34, fur);
      E(-12, -4, 24, 22, silver, false);
      E(8, 12, 20, 16, skin, false);
      L([2, 6, 16, 6], OUT, 2.5);
      // 头与厚眉骨
      head(6, -28, p, () => {
        E(-19, -2, 6, 7, skin); E(21, -2, 6, 7, skin);
        E(0, -4, 23, 22, fur);
        E(4, 4, 18, 14, skin);
        // 霸气眉脊与红眼
        E(2, -9, 17, 5.5, fur);
        eyes(-6, -4, 16, p, 4, '#ff5238');
        E(6, 3, 2.5, 2, OUT, false); E(12, 3, 2.5, 2, OUT, false);
        mouth(8, 12, 10, p, true);
      });
      // 近侧巨臂（蓄力时捶胸）
      g.save();
      g.translate(-22 + beat * 1.4, 12 - Math.abs(beat) * 0.6);
      g.rotate(beat ? -0.55 : 0.25 - walkS * 0.04);
      E(0, 0, 14, 24, fur);
      E(2, 18, 12, 9, skin);
      g.restore();
    },
    cobra(p) {
      const gr = '#2b7d69', lt = '#44a88e', belly = '#dce895', gold = '#ffd84a';
      const sway = Math.sin(p.t * 5) * 6;
      const flare = 1 + (p.puff || 0) * 0.35;
      // 盘绕蛇身底座
      E(0, 26, 40, 15, gr);
      E(2, 16, 32, 12, lt);
      E(-2, 7, 23, 10, gr);
      curve(-34, 26, -54, 16, -48, -2 + wag(p), gr, 7);
      // 挺立颈身
      curve(0, 10, -8 + sway * 0.6, -20, 4 + sway, -48, gr, 16);
      curve(4, 10, -2 + sway * 0.6, -20, 8 + sway, -48, belly, 7);
      // 展开眼镜蛇兜帽与头部
      head(6 + sway, -54, p, () => {
        // 巨大兜帽
        E(-4, 8, 28 * flare, 26, gr);
        E(-4, 10, 20 * flare, 19, lt, false);
        // 眼镜花纹
        g.save(); g.strokeStyle = col(gold); g.lineWidth = 3;
        g.beginPath(); g.arc(-13 * flare, 6, 5.5, 0, TAU); g.stroke();
        g.beginPath(); g.arc(5 * flare, 6, 5.5, 0, TAU); g.stroke();
        L([-8 * flare, 6, 0, 6], col(gold), 3);
        g.restore();
        // 蛇头
        E(8, -4, 19, 13, gr);
        E(20, 0, 12, 8, lt);
        // 蛇信子
        if (Math.sin(p.t * 10) > -0.2 || (p.mouth || 0) > 0.2) {
          L([28, 3, 44, 3], '#ff3b4e', 2.5);
          L([44, 3, 50, -3], '#ff3b4e', 2.2);
          L([44, 3, 50, 9], '#ff3b4e', 2.2);
        }
        // 毒牙
        P([18, 5, 20, 14, 23, 6], '#fff');
        P([25, 5, 27, 13, 30, 5], '#fff');
        // 竖瞳金眼
        E(4, -8, 5, 5, '#ffe066'); E(16, -8, 5, 5, '#ffe066');
        E(4, -8, 1.8, 4.5, fl ? '#fff' : OUT, false); E(16, -8, 1.8, 4.5, fl ? '#fff' : OUT, false);
        L([-2, -14, 9, -10], OUT, 3); L([22, -14, 11, -10], OUT, 3);
      });
    },
    scorpion(p) {
      const body = '#4a2e66', hi = '#734c9e', dk = '#2e1b42', venom = '#ff48b0';
      const scurry = p.walk ? Math.sin(p.t * 14) * 5 : 0;
      const arch = p.trunkUp || 0;
      // 6 条节肢长腿
      for (const [i, lx] of [-20, -4, 12].entries()) {
        const d = i % 2 ? scurry : -scurry;
        L([lx, 14, lx - 10 + d, 26, lx - 6 + d, 35], OUT, 6);
        L([lx, 14, lx - 10 + d, 26, lx - 6 + d, 35], col(dk), 3);
        L([lx + 4, 14, lx + 14 - d, 26, lx + 10 - d, 35], OUT, 6);
        L([lx + 4, 14, lx + 14 - d, 26, lx + 10 - d, 35], col(dk), 3);
      }
      // 高高弯曲的毒蝎尾与发光毒刺
      const segs = [
        [-32, 6], [-44, -8], [-44, -26 - arch * 8], [-32, -42 - arch * 12], [-14, -48 - arch * 14], [4 + arch * 14, -44 - arch * 8],
      ];
      for (let i = 0; i < segs.length; i++) {
        const [sx, sy] = segs[i];
        E(sx, sy, 11 - i * 0.7, 9 - i * 0.5, i % 2 ? hi : body);
      }
      const tipX = 16 + arch * 18, tipY = -36 - arch * 4;
      E(tipX, tipY, 10, 7, venom);
      P([tipX + 6, tipY - 3, tipX + 22, tipY + 6, tipX + 5, tipY + 6], '#ffe066');
      // 装甲节肢主躯干
      E(-12, 10, 26, 17, dk);
      E(6, 10, 28, 19, body);
      for (const sx of [-18, -4, 10]) E(sx, 6, 8, 12, hi, false);
      // 巨型双螯
      for (const [oy, rot] of [[-12, -0.35], [20, 0.35]]) {
        g.save(); g.translate(28, oy); g.rotate(rot + Math.sin(p.t * 7) * 0.08);
        E(12, 0, 14, 8, hi);
        P([18, -6, 38, -12, 30, -1, 38, 10, 18, 6], body);
        g.restore();
      }
      // 复眼
      E(20, 1, 4, 4, venom); E(28, 1, 4, 4, venom);
      E(21, 1, 1.8, 1.8, '#fff', false); E(29, 1, 1.8, 1.8, '#fff', false);
    },
    mammoth(p) {
      const fur = '#7d4a2d', dk = '#522e1b', frost = '#d8f4ff', tusk = '#fff8e6';
      curve(-40, 2, -54, 10, -52, 24 + wag(p) * 0.5, dk, 4);
      legs(p, dk, 13, 33);
      // 巨型毛绒躯干与霜雪绒毛
      E(-2, 4, 46, 36, fur);
      E(-8, -14, 34, 16, dk, false);
      P([-34, -18, -22, -32, -10, -20, 2, -34, 14, -18, 22, -26, 26, -12], frost);
      head(14, -18, p, () => {
        // 高耸猛犸绒毛头冠
        E(-18, 2, 14, 20, dk);
        E(2, -14, 22, 18, fur);
        E(4, 2, 27, 25, fur);
        E(2, -22, 14, 8, frost, false);
        // 巨大上翘象牙
        curve(16, 12, 52, 22, 56, -24, tusk, 10);
        curve(10, 16, 44, 28, 46, -14, '#f0e4c8', 8);
        // 毛绒长鼻
        const u = p.trunkUp || 0, sw = Math.sin(p.t * 4) * 3;
        curve(22, 6, 48 + u * 6, 14 - u * 32, 42 + sw + u * 16, 38 - u * 68, fur, 12);
        eyes(-2, -6, 18, p, 4.5, '#4fc3ff');
      });
    },
    giraffe(p) {
      const fur = '#f4cf6a', sp = '#b9762c';
      const hx = 28 - (p.lean || 0) * 16, hy = -88 + (p.lean || 0) * 6;
      curve(-30, 0, -42, 6, -40, 22 + wag(p) * 0.5, sp, 3);
      const s = p.walk ? Math.sin(p.t * 9) * 4 : 0;
      for (const [x, d] of [[-22, s], [-8, -s], [8, s], [20, -s]]) { P([x - 4 + d, 12, x + 4 + d, 12, x + 4 + d, 34, x - 4 + d, 34], fur); P([x - 5 + d, 32, x + 5 + d, 32, x + 5 + d, 38, x - 5 + d, 38], '#6f4524'); }
      // 长脖子
      P([4, -4, 24, 2, hx + 7, hy + 10, hx - 8, hy + 8], fur);
      L([2, -6, hx - 9, hy + 6], sp, 4);
      E(-2, 2, 32, 21, fur);
      for (const [x, y, r] of [[-16, -4, 6], [0, 6, 7], [14, -2, 5], [-8, 12, 4], [18, 10, 4]]) E(x, y, r, r * 0.8, sp, false);
      for (const k of [0.25, 0.5, 0.75]) E(14 + (hx - 14) * k, -2 + (hy + 8) * k, 5, 6, sp, false);
      head(hx, hy, p, () => {
        L([-4, -10, -6, -24], OUT, 5); L([-4, -10, -6, -24], fur, 2.5); E(-6, -25, 3.5, 3.5, sp);
        L([5, -10, 6, -24], OUT, 5); L([5, -10, 6, -24], fur, 2.5); E(6, -25, 3.5, 3.5, sp);
        E(-15, -4, 7, 4, fur);
        E(0, 0, 15, 12, fur); E(11, 4, 11, 8, '#fbe7ad'); E(17, 1, 1.5, 1.5, OUT, false);
        eyes(-4, -3, 10, p, 3.2, '#3d2a1a'); mouth(12, 8, 5, p, false);
      });
    },
    tiger(p) {
      const fur = '#f59a2e', st = '#3d2a1a';
      curve(-34, 4, -58, 2, -54, -24 + wag(p), fur, 6);
      L([-48, -2, -42, -6], st, 3); L([-56, -12, -49, -13], st, 3);
      legs(p, fur);
      E(0, 8, 38, 29, fur); E(6, 18, 22, 14, '#fff', false);
      for (const x of [-24, -12, 0]) P([x - 4, -19 + Math.abs(x) * 0.15, x + 4, -20 + Math.abs(x) * 0.15, x + 1, -2], st, false);
      head(8, -20, p, () => {
        E(-19, -17, 8, 8, fur); E(-19, -17, 4, 4, '#ffd9b0', false);
        E(19, -17, 8, 8, fur); E(19, -17, 4, 4, '#ffd9b0', false);
        E(0, 0, 27, 23, fur);
        E(-15, 10, 10, 7, '#fff', false); E(17, 10, 10, 7, '#fff', false);
        E(7, 9, 13, 9, '#fff'); E(9, 4, 4.5, 3, '#e0667a', false);
        for (const x of [-5, 1, 7]) L([x, -22, x, -14], st, 3);
        L([-26, -2, -18, 0], st, 3); L([-25, 6, -18, 6], st, 3); L([26, -2, 20, 0], st, 3);
        eyes(-8, -5, 20, p, 4.5, '#3c8f1f'); mouth(7, 13, 8, p);
      });
    },
    lion(p) {
      const fur = '#e9b65a', mane = '#a55a1e';
      curve(-32, 6, -54, 4, -52, -18 + wag(p), fur, 5); E(-52, -20 + wag(p), 6, 7, mane);
      legs(p, fur);
      E(0, 10, 36, 28, fur); E(6, 19, 20, 13, '#f6dfa8', false);
      head(8, -18, p, () => {
        const k = 1 + (p.puff || 0) * 0.22, pts = [];
        for (let i = 0; i < 28; i++) { const a = i * TAU / 28 + Math.sin(p.t * 3) * 0.03, r = (i % 2 ? 30 : 38) * k; pts.push(Math.cos(a) * r, Math.sin(a) * r + 2); }
        P(pts, mane); E(0, 2, 29 * k, 27 * k, '#c9772b', false);
        E(-15, -19, 7, 7, fur); E(15, -19, 7, 7, fur);
        E(0, 2, 22, 20, fur);
        E(5, 11, 12, 8, '#f6dfa8'); E(7, 6, 5, 3.5, '#6f4524', false);
        eyes(-8, -4, 18, p); mouth(5, 15, 8, p);
      });
    },
    rhino(p) {
      const fur = '#8e949c', dk = '#6d737b';
      curve(-44, 0, -56, 4, -54, 16 + wag(p) * 0.5, dk, 3);
      legs(p, dk, 11, 32);
      E(-4, 6, 44, 32, fur);
      g.save(); g.strokeStyle = col(dk); g.lineWidth = 3;  // 盔甲一样的皮
      g.beginPath(); g.arc(-22, 6, 26, -1.1, 1.1); g.stroke();
      g.beginPath(); g.arc(-2, 6, 28, -1.0, 1.0); g.stroke();
      g.restore();
      head(26, -4, p, () => {
        P([-18, -12, -16, -26, -8, -14], fur); P([-8, -14, -4, -26, 2, -13], fur);
        E(0, 0, 25, 18, fur);
        P([13, -8, 36, -36, 25, 3], '#f1ead9'); P([3, -13, 9, -27, 14, -11], '#f1ead9');
        E(18, 6, 2, 2.5, OUT, false);
        eyes(-8, -4, 12, p, 3.5, '#3d2a1a'); mouth(10, 11, 7, p, false);
      });
    },
    dragon(p) {
      const red = '#d9413b', dk = '#9c2a3a', belly = '#f7d27f', wingC = '#b8323f', bone = '#f1ead9';
      const flap = p.wing !== undefined ? p.wing : Math.sin(p.t * 5) * 0.5;
      const wing = (rot, col2) => {
        g.save(); g.translate(-10, -14); g.rotate(rot);
        P([0, 0, -14, -50, 6, -38, 20, -66, 32, -34, 54, -50, 44, -6, 16, 10], col2);
        L([0, 0, 6, -38], OUT, 2.5); L([0, 0, 32, -34], OUT, 2.5); L([0, 0, 44, -6], OUT, 2.5);
        g.restore();
      };
      wing(-0.35 + flap * 0.9, dk);                // 远处的翅膀
      curve(-30, 12, -62, 26, -74, 0 + wag(p), red, 10); // 尾巴
      P([-70, -2 + wag(p), -88, -10 + wag(p), -78, 8 + wag(p)], dk);  // 尾尖
      legs(p, dk, 8, 30);
      E(0, 6, 40, 28, red);
      E(8, 14, 25, 16, belly, false);
      for (const x of [-2, 6, 14, 22]) L([x, 6, x + 4, 22], '#d9a24f', 2);
      for (const x of [-28, -16, -4, 8, 20]) P([x - 6, -17, x, -31, x + 6, -17], dk);  // 背刺
      wing(-0.15 + flap, wingC);                  // 近处的翅膀
      head(34, -18, p, () => {
        P([-8, -14, -20, -42, 4, -20], bone); P([6, -16, 6, -44, 18, -18], bone); // 犄角
        E(0, 0, 22, 19, red);
        const o = p.mouth || 0;
        E(15, 7 + o * 1, 18, 11, red);            // 上颚
        E(8, -6, 4, 3, dk, false); E(22, -1, 2.2, 2.2, OUT, false);  // 鼻孔
        // 下颚张开
        g.save(); g.translate(8, 12); g.rotate(o * 0.5);
        E(8, 2, 15, 6, dk);
        g.restore();
        if (o > 0.15) { g.save(); g.lineWidth = 2; E(18, 13 + o * 3, 11, 3 + o * 6, '#7a1f1f'); E(26 + o * 6, 13, 7 + o * 6, 5 + o * 4, 'rgba(255,190,60,.85)', false); g.restore(); }
        g.save(); g.lineWidth = 1.5;
        P([13, 13, 16, 20, 19, 13], '#fff'); P([22, 13, 25, 19, 28, 13], '#fff');
        g.restore();
        g.save(); g.lineWidth = 2; E(-1, -6, 6, 6, '#ffe066'); g.restore();
        E(0, -6, 1.8, 5, fl ? '#fff' : OUT, false);
        L([-9, -16, 6, -9], OUT, 3.5);
      });
    },
    phoenix(p) {
      const red = '#e63e2e', org = '#ff8c2b', gold = '#ffe066', dk = '#a62328';
      const flap = p.wing !== undefined ? p.wing : Math.sin(p.t * 7) * 0.55;
      const wv = Math.sin(p.t * 8) * 7;
      // 飘逸烈焰尾羽
      curve(-24, 10, -56, 24 + wv, -82, 8 - wv, org, 8);
      curve(-22, 16, -54, 34 - wv * 0.7, -76, 26 + wv, gold, 6);
      curve(-24, 4, -52, 6 - wv, -78, -12 + wv, red, 7);
      // 火焰翼画法
      const wing = (rot, c1, c2) => {
        g.save(); g.translate(-4, -10); g.rotate(rot);
        P([0, 0, -24, -54, -4, -44, 12, -72, 26, -42, 48, -60, 44, -22, 58, -18, 28, 8], c1);
        P([4, -6, -6, -34, 14, -48, 28, -26, 36, -36, 32, -6], c2, false);
        g.restore();
      };
      wing(-0.3 + flap * 0.9, dk, org);
      // 凤凰躯干与胸羽
      E(0, 6, 34, 24, red);
      E(10, 12, 20, 14, org, false);
      E(14, 14, 12, 9, gold, false);
      wing(-0.1 + flap, red, gold);
      // 凤首、凤冠与金喙
      head(26, -24, p, () => {
        // 燃烧三支凤冠
        P([-8, -14, -26, -40 + wv * 0.3, -2, -20], gold);
        P([-2, -16, -10, -48 - wv * 0.3, 8, -18], org);
        P([4, -16, 8, -42 + wv * 0.3, 16, -14], red);
        E(0, 0, 20, 17, red);
        E(4, 2, 12, 10, org, false);
        // 锐利金喙
        const o = p.mouth || 0;
        P([14, -6, 36, 2 - o * 4, 14, 4], gold);
        P([14, 4, 30, 8 + o * 6, 12, 10], '#f0a82e');
        E(4, -5, 5.5, 5.5, '#fff7b0');
        E(5, -5, 2.2, 4.5, fl ? '#fff' : '#d92b2b', false);
        L([-4, -13, 12, -8], OUT, 3);
      });
    },
  };

  return {
    draw(ctx, kind, pose) {
      g = ctx; fl = pose.fl;
      g.save(); g.lineWidth = 3.5; g.strokeStyle = OUT; g.lineJoin = 'round'; g.lineCap = 'round';
      kinds[kind](pose);
      g.restore();
    },
  };
})();
