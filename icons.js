// 武器、道具、强化的图标：全部用代码绘制，生成后可用于商店卡片和游戏画面
'use strict';

const ICONS = (() => {
  const OUT = '#4a3423', TAU = Math.PI * 2;
  const METAL = '#8a96a3', DARK = '#5a6572', WOOD = '#a06a3f';
  let c;   // 当前画笔

  const rr = (x, y, w, h, r, fill) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); c.stroke(); };
  const circ = (x, y, r, fill, stroke = true) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill(); if (stroke) c.stroke(); };
  const poly = (pts, fill) => {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fillStyle = fill; c.fill(); c.stroke();
  };
  const line = (pts, color = OUT, w = 3) => {
    c.save(); c.strokeStyle = color; c.lineWidth = w;
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.stroke(); c.restore();
  };
  const leaf = (x, y, rot, len, fill) => {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0); c.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
    c.fillStyle = fill; c.fill(); c.stroke();
    line([2, 0, len - 3, 0], '#3f8f2c', 1.5);
    c.restore();
  };

  const draw = {
    // 豌豆手枪：枪身上嵌着一只豌豆荚
    pistol() {
      c.translate(32, 32); c.rotate(-0.12); c.translate(-32, -32);
      poly([19, 30, 32, 30, 29, 53, 15, 53], WOOD);
      c.beginPath(); c.arc(36, 36, 6, 0.1, Math.PI * 0.9); c.stroke();
      rr(10, 20, 40, 14, 5, METAL);
      rr(48, 22, 7, 10, 2, DARK);
      rr(15, 12, 28, 11, 5.5, '#6fd24a');
      for (const x of [22, 29, 36]) circ(x, 17.5, 3, '#a4ec7a', false);
      circ(59, 25, 3.5, '#6fd24a');
    },
    // 毛线散弹枪：双管，旁边一团毛线
    shotgun() {
      poly([4, 30, 22, 24, 22, 40, 7, 47], WOOD);
      rr(20, 22, 38, 8, 3, METAL);
      rr(20, 30, 38, 8, 3, METAL);
      rr(31, 38, 15, 7, 3, WOOD);
      circ(57, 26, 1.6, OUT, false); circ(57, 34, 1.6, OUT, false);
      c.beginPath(); c.moveTo(38, 50); c.quadraticCurveTo(28, 60, 18, 54); c.strokeStyle = OUT; c.lineWidth = 4; c.stroke();
      c.strokeStyle = '#ff8fb1'; c.lineWidth = 2; c.stroke(); c.strokeStyle = OUT; c.lineWidth = 3;
      circ(46, 50, 10, '#ff8fb1');
      c.save(); c.strokeStyle = '#d95f88'; c.lineWidth = 1.6;
      c.beginPath(); c.arc(40, 44, 10, 0.3, 1.5); c.stroke();
      c.beginPath(); c.arc(54, 42, 11, 1.7, 2.9); c.stroke();
      c.beginPath(); c.arc(46, 62, 12, 4.0, 5.4); c.stroke();
      c.restore();
    },
    // 鱼骨冲锋枪：枪身上有鱼骨图案
    smg() {
      line([15, 26, 5, 26, 5, 38], OUT, 4);
      poly([15, 36, 25, 36, 22, 52, 12, 52], WOOD);
      rr(28, 36, 9, 18, 2, DARK);
      rr(46, 25, 14, 7, 2, DARK);
      rr(12, 19, 36, 18, 5, '#7c8fa6');
      // 鱼骨
      line([19, 28, 40, 28], '#fff', 2.2);
      for (const x of [24, 29, 34]) line([x - 2, 23, x, 28, x - 2, 33], '#fff', 2);
      c.save(); c.lineWidth = 1.5; poly([39, 24, 45, 28, 39, 32], '#fff'); c.restore();
      line([19, 28, 16, 24], '#fff', 2); line([19, 28, 16, 32], '#fff', 2);
    },
    // 罐头榴弹炮：粗炮管，配一个鱼罐头
    grenade() {
      poly([20, 34, 31, 34, 28, 50, 16, 50], WOOD);
      rr(8, 16, 42, 20, 9, METAL);
      rr(46, 12, 9, 28, 4, DARK);
      rr(14, 12, 12, 6, 2, DARK);
      // 罐头
      rr(38, 42, 20, 18, 3, '#d8dde3');
      c.save(); c.lineWidth = 0; c.fillStyle = '#e8743b'; c.fillRect(39.5, 47, 17, 8); c.restore();
      c.save(); c.lineWidth = 1.2; c.beginPath(); c.ellipse(47, 51, 4.5, 2.5, 0, 0, TAU); c.fillStyle = '#fff'; c.fill();
      poly([51, 51, 54.5, 48.5, 54.5, 53.5], '#fff'); c.restore();
    },
    // 激光逗猫笔：一支笔射出红色激光
    laser() {
      line([34, 30, 57, 12], '#ffb0b0', 6);
      line([34, 30, 57, 12], '#ff4040', 2.5);
      c.save(); c.strokeStyle = '#ff4040'; c.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.beginPath(); c.moveTo(57 + Math.cos(a) * 3, 12 + Math.sin(a) * 3); c.lineTo(57 + Math.cos(a) * 6.5, 12 + Math.sin(a) * 6.5); c.stroke(); }
      c.restore();
      circ(57, 12, 2.5, '#ff4040', false);
      c.translate(22, 40); c.rotate(-0.66);
      rr(-18, -5.5, 32, 11, 5.5, '#465264');
      rr(12, -4, 7, 8, 2, '#c9ced6');
      rr(-18, -5.5, 8, 11, 4, '#2bb5a0');
      circ(1, -1, 2.6, '#ff4040');
    },
    // 猫薄荷：一枝带小花的绿叶
    catnip() {
      c.beginPath(); c.moveTo(32, 58); c.quadraticCurveTo(29, 38, 32, 18); c.stroke();
      const G1 = '#7ed957', G2 = '#5fc23f';
      leaf(31, 48, Math.PI - 0.5, 19, G2); leaf(32, 48, -0.5, 19, G1);
      leaf(30, 36, Math.PI - 0.6, 16, G1); leaf(31, 36, -0.55, 16, G2);
      leaf(31, 25, Math.PI - 0.75, 12, G2); leaf(32, 25, -0.7, 12, G1);
      c.save(); c.lineWidth = 2;
      circ(32, 12, 4.5, '#c9a0ff'); circ(26.5, 16, 3.5, '#dcc0ff'); circ(37.5, 16, 3.5, '#dcc0ff');
      c.restore();
    },
    // 自动炮塔：长着猫耳朵的小炮塔
    turret() {
      rr(14, 48, 36, 9, 4.5, DARK);
      rr(26, 38, 12, 12, 2, METAL);
      rr(38, 24, 22, 10, 3, METAL);
      rr(56, 22, 5, 14, 2, DARK);
      poly([18, 20, 15, 5, 28, 14], '#ffd84a'); poly([42, 20, 45, 5, 32, 14], '#ffd84a');
      circ(30, 28, 15, '#ffd84a');
      circ(25, 26, 2, OUT, false); circ(36, 26, 2, OUT, false);
      c.save(); c.lineWidth = 1.6; c.beginPath(); c.moveTo(27, 32); c.quadraticCurveTo(30.5, 35, 34, 32); c.stroke(); c.restore();
    },
    // 铁丝围栏：木桩加带刺铁丝
    fence() {
      for (const x of [8, 28, 48]) poly([x, 56, x, 20, x + 4.5, 13, x + 9, 20, x + 9, 56], '#c79a63');
      for (const y of [28, 44]) {
        line([3, y, 61, y], OUT, 4); line([3, y, 61, y], '#b9c1cb', 2);
        for (const x of [22, 42]) { line([x - 3, y - 3, x + 3, y + 3], OUT, 1.8); line([x - 3, y + 3, x + 3, y - 3], OUT, 1.8); }
      }
    },
    // 磁铁项圈：红色马蹄形磁铁吸来小鱼干
    magnet() {
      c.translate(30, 34); c.rotate(-0.35); c.translate(-30, -34);
      const u = () => { c.beginPath(); c.moveTo(16, 52); c.lineTo(16, 30); c.arc(30, 30, 14, Math.PI, 0); c.lineTo(44, 52); };
      c.lineCap = 'butt';
      u(); c.strokeStyle = OUT; c.lineWidth = 15; c.stroke();
      u(); c.strokeStyle = '#e8483f'; c.lineWidth = 10; c.stroke();
      c.strokeStyle = OUT; c.lineWidth = 3; c.lineCap = 'round';
      rr(9.5, 44, 13, 9, 1, '#eef1f4'); rr(37.5, 44, 13, 9, 1, '#eef1f4');
      line([24, 58, 24, 62], '#ffb347', 2.5); line([30, 59, 30, 63], '#ffb347', 2.5); line([36, 58, 36, 62], '#ffb347', 2.5);
    },
    // 猫咪生命：爱心
    catHp() {
      c.beginPath(); c.moveTo(32, 54);
      c.bezierCurveTo(4, 36, 10, 10, 32, 22);
      c.bezierCurveTo(54, 10, 60, 36, 32, 54);
      c.fillStyle = '#ff7a8a'; c.fill(); c.stroke();
      c.save(); c.strokeStyle = '#fff'; c.lineWidth = 3.5; c.beginPath(); c.arc(23, 27, 6, Math.PI, Math.PI * 1.5); c.stroke(); c.restore();
    },
    // 猫咪速度：带速度线的猫爪
    catSpd() {
      line([4, 24, 16, 24], '#ffb347', 3.5); line([2, 36, 13, 36], '#ffb347', 3.5); line([6, 48, 17, 48], '#ffb347', 3.5);
      c.beginPath(); c.ellipse(40, 42, 13, 11, 0, 0, TAU); c.fillStyle = '#ff9fb5'; c.fill(); c.stroke();
      c.beginPath(); c.ellipse(24, 28, 4.5, 6, -0.5, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(34, 20, 4.5, 6.5, -0.15, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(46, 20, 4.5, 6.5, 0.15, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(56, 28, 4.5, 6, 0.5, 0, TAU); c.fill(); c.stroke();
    },
    // 加固猫窝：小屋加绿色加号
    nestHp() {
      rr(13, 28, 34, 26, 4, '#d9a765');
      poly([6, 30, 30, 9, 54, 30], '#e8743b');
      c.beginPath(); c.arc(30, 54, 8, Math.PI, 0); c.closePath(); c.fillStyle = '#5b3d28'; c.fill(); c.stroke();
      circ(49, 47, 11, '#5fc23f');
      line([49, 41, 49, 53], '#fff', 4); line([43, 47, 55, 47], '#fff', 4);
    },
    // 修补猫窝：锤子
    repair() {
      c.translate(32, 32); c.rotate(0.7); c.translate(-32, -32);
      rr(28.5, 20, 7, 40, 3, WOOD);
      rr(14, 8, 36, 16, 4, METAL);
      rr(10, 10, 7, 12, 2, DARK);
    },
  };

  const canvas = {}, url = {};
  for (const id in draw) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    c = cv.getContext('2d');
    c.scale(2, 2);
    c.lineWidth = 3; c.strokeStyle = OUT; c.lineJoin = 'round'; c.lineCap = 'round';
    draw[id]();
    canvas[id] = cv; url[id] = cv.toDataURL();
  }
  return { canvas, url };
})();
