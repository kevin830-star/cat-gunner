// 头目：种类数据和画法。每 3 关一个，按顺序轮流出场
'use strict';

// hp / spd：相对基础头目的倍数和移动速度；special：特殊攻击；cd：特殊攻击间隔（秒）
const BOSSES = [
  { id: 'dog', name: '野狗', py: 'yěgǒu', r: 38, hp: 1, spd: 36, special: 'bark', cd: 5, tip: '汪汪叫来老鼠小弟' },
  { id: 'fox', name: '狐狸', py: 'húli', r: 33, hp: 0.85, spd: 48, special: 'dash', cd: 4.5, tip: '会突然冲向猫咪' },
  { id: 'wolf', name: '大灰狼', py: 'dà huīláng', r: 40, hp: 1.1, spd: 38, special: 'howl', cd: 6, tip: '嚎叫让敌人跑得更快' },
  { id: 'elephant', name: '大象', py: 'dàxiàng', r: 52, hp: 1.6, spd: 26, special: 'stomp', cd: 5, tip: '跺脚震伤周围' },
  { id: 'giraffe', name: '长颈鹿', py: 'chángjǐnglù', r: 40, hp: 1.2, spd: 34, special: 'spit', cd: 3.5, tip: '从高处吐出一排树叶弹', barY: 112 },
  { id: 'tiger', name: '老虎', py: 'lǎohǔ', r: 40, hp: 1.2, spd: 42, special: 'pounce', cd: 4.5, tip: '高高跳起扑向猫咪' },
  { id: 'lion', name: '狮子', py: 'shīzi', r: 44, hp: 1.4, spd: 36, special: 'roar', cd: 6, tip: '吼声把猫咪震飞' },
  { id: 'rhino', name: '犀牛', py: 'xīniú', r: 48, hp: 1.7, spd: 30, special: 'charge', cd: 5, tip: '直线冲撞，快躲开' },
  { id: 'dragon', name: '巨龙', py: 'jùlóng', r: 62, hp: 1.8, spd: 28, special: 'dragon', cd: 3.2, tip: '喷火扫射，召唤陨石雨', barY: 122 },
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
      P([-30, -14, -22, -26, -18, -14, -10, -28, -6, -16, 2, -28, 6, -14], dk);   // 颈背的鬃毛
      head(8, -22, p, () => {
        P([-22, -8, -20, -36, -4, -18], fur); P([6, -18, 20, -36, 24, -8], fur);
        E(0, 0, 27, 22, fur);
        E(13, 8, 16, 10, '#dfe3e8'); E(22, 3, 5, 3.5, OUT, false);
        eyes(-8, -6, 19, p, 4.5, '#e0a800');
        L([-14, -16, -4, 2], '#c8402d', 2);   // 伤疤
        mouth(13, 13, 10, p);
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
        P([10, 13, 30, 24, 13, 21], '#fffbe9');   // 象牙
        eyes(-2, -7, 19, p, 4.2, '#3d2a1a');
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
      g.save(); g.strokeStyle = col(dk); g.lineWidth = 3;   // 盔甲一样的皮
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
      wing(-0.35 + flap * 0.9, dk);                       // 远处的翅膀
      curve(-30, 12, -62, 26, -74, 0 + wag(p), red, 10);  // 尾巴
      P([-70, -2 + wag(p), -88, -10 + wag(p), -78, 8 + wag(p)], dk);   // 尾尖
      legs(p, dk, 8, 30);
      E(0, 6, 40, 28, red);
      E(8, 14, 25, 16, belly, false);
      for (const x of [-2, 6, 14, 22]) L([x, 6, x + 4, 22], '#d9a24f', 2);
      for (const x of [-28, -16, -4, 8, 20]) P([x - 6, -17, x, -31, x + 6, -17], dk);   // 背刺
      wing(-0.15 + flap, wingC);                          // 近处的翅膀
      head(34, -18, p, () => {
        P([-8, -14, -20, -42, 4, -20], bone); P([6, -16, 6, -44, 18, -18], bone);   // 犄角
        E(0, 0, 22, 19, red);
        const o = p.mouth || 0;
        E(15, 7 + o * 1, 18, 11, red);                    // 上颚
        E(8, -6, 4, 3, dk, false); E(22, -1, 2.2, 2.2, OUT, false);   // 鼻孔
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
