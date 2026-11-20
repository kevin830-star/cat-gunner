// 宠物造型：全部用代码画（Q 版大头），带呼吸、眨眼、尾巴摆动
// PetArt.draw(ctx, look, x, y, size, t, opts)
//   x, y：脚底中心；size：大约的身高（像素）；t：时间（秒）
//   opts：flip 朝左、lunge 0~1 往前冲、white 0~1 受击闪白、faint 0~1 倒下、alpha、glow 发光颜色
'use strict';

const PetArt = (() => {
  const LOOKS = {
    huowei:   { main: '#ff9a3c', belly: '#ffe6c2', line: '#7a3412', inner: '#ffc2a0', cheek: '#ff6f6f', ears: 'cat', tail: 'flame', mark: 'flame' },
    paopao:   { main: '#5fb0e6', belly: '#e3f4ff', line: '#1f4f7a', inner: '#9fd0f2', cheek: '#ff8fa8', ears: 'round', tail: 'otter', mark: 'muzzle' },
    yeye:     { main: '#c8eba8', belly: '#f8fff0', line: '#3d6b2a', inner: '#ffd0dc', cheek: '#ff9ab0', ears: 'bunny', tail: 'puff', mark: 'flower' },
    dianwan:  { main: '#7fd3ea', belly: '#e8fbff', line: '#1d5a6e', inner: '#ffe46a', cheek: '#ffe14a', ears: 'mouse', tail: 'bolt', mark: 'zig' },
    xingxing: { main: '#f2cf98', belly: '#fff4e0', line: '#7a5020', inner: '#ffd9b0', cheek: '#ff9f9f', ears: 'deer', tail: 'deer', mark: 'spots' },
    yingzi:   { main: '#4d3b78', belly: '#6d5aa0', line: '#1c1236', inner: '#c99cff', cheek: '#b46fe0', ears: 'cat', tail: 'wisp', mark: 'moon', eye: 'glow' },
    gunner:   { main: '#a3a8b4', belly: '#ffffff', line: '#3c3f48', inner: '#ffb7c2', cheek: '#ff9aa8', ears: 'cat', tail: 'cat', mark: 'stripe' },
    huohu:    { main: '#ff8a3d', belly: '#fff3e0', line: '#7a3412', inner: '#ffd0b0', cheek: '#ff7a7a', ears: 'fox', tail: 'fox', mark: 'none' },
    yuanjing: { main: '#4f8fe0', belly: '#dff0ff', line: '#1c4a80', inner: '#bfe2ff', cheek: '#ff9ab0', ears: 'none', tail: 'whale', mark: 'spout' },
    mogu:     { main: '#9ccc65', belly: '#f1f8e9', line: '#33691e', inner: '#ffd0dc', cheek: '#ff9ab0', ears: 'none', tail: 'none', mark: 'mushroom', shell: true },
    mianyang: { main: '#f4ecd8', belly: '#fffaf0', line: '#6d5a3a', inner: '#ffd0dc', cheek: '#ff9ab0', ears: 'sheep', tail: 'wool', mark: 'wool' },
    tianma:   { main: '#fbf7ff', belly: '#ffffff', line: '#5a4a8a', inner: '#ffd0f0', cheek: '#ff9ad0', ears: 'horse', tail: 'rainbow', mark: 'mane', wings: 'feather' },
    bianfu:   { main: '#6a4c93', belly: '#b39ddb', line: '#2a1a45', inner: '#ff9ad8', cheek: '#ff7ac0', ears: 'bat', tail: 'none', mark: 'none', wings: 'bat', fang: true },
  };
  // 元素色：进化后的披风、皇冠宝石、光环
  const ACC = { huowei: '#ff5a2a', huohu: '#ff5a2a', paopao: '#2f8fe0', yuanjing: '#2f8fe0', yeye: '#3fb950', mogu: '#3fb950',
    dianwan: '#f0b400', mianyang: '#f0b400', xingxing: '#ffc531', tianma: '#ffc531', yingzi: '#7a4fd0', bianfu: '#7a4fd0', gunner: '#ff7a2f' };

  // ---------- 颜色混合（受击闪白、倒下变灰） ----------
  const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  function mix(c, white, gray) {
    if (!white && !gray) return c;
    let [r, g, b] = hex(c);
    if (gray) { const v = (r + g + b) / 3; r += (v - r) * gray; g += (v - g) * gray; b += (v - b) * gray; }
    if (white) { r += (255 - r) * white; g += (255 - g) * white; b += (255 - b) * white; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  function draw(ctx, look, x, y, size, t = 0, o = {}) {
    const L = LOOKS[look] || LOOKS.huowei;
    const C = c => mix(c, o.white || 0, (o.faint || 0) * 0.7);
    const LW = 3.2;
    const s = size / 100;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(0, 0, 36 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.scale(s * (o.flip ? -1 : 1), s);
    const form = o.form || 0, acc = ACC[look] || '#ffc531';
    if (form) ctx.scale(1 + 0.05 * form, 1 + 0.05 * form);
    if (o.lunge) ctx.translate(26 * o.lunge, -6 * Math.sin(o.lunge * Math.PI));
    if (o.faint) { ctx.translate(0, -4); ctx.rotate(-1.35 * o.faint); ctx.translate(0, 4 + 10 * o.faint); }
    const bob = Math.sin(t * 3) * 1.8, breath = 1 + Math.sin(t * 3) * 0.02;
    const sway = Math.sin(t * 2.4) * 0.16;

    if (o.glow) {   // 脚下的光环
      const g = ctx.createRadialGradient(0, -40, 5, 0, -40, 75);
      g.addColorStop(0, o.glow); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -40, 75, 0, Math.PI * 2); ctx.fill();
    }

    const path = (fill, fn, lw = LW) => { ctx.beginPath(); fn(); ctx.fillStyle = C(fill); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C(L.line); ctx.stroke(); };
    const ell = (cx, cy, rx, ry, rot = 0) => () => ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);

    if (form >= 2) {   // 终极形态：身后一圈元素色光环
      const g = ctx.createRadialGradient(0, -55, 10, 0, -55, 95);
      g.addColorStop(0, hexA(acc, 0.45)); g.addColorStop(1, hexA(acc, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -55, 95, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 5; i++) { const an = t * 1.4 + i * 1.256; star(ctx, Math.cos(an) * 62, -58 + Math.sin(an) * 30, 4, hexA(acc, 0.9)); }
    }
    if (form >= 1) {   // 进化后：元素色小披风
      const wave = Math.sin(t * 3) * 3;
      path(acc, () => { ctx.moveTo(-8, -46); ctx.quadraticCurveTo(-40, -30, -44 + wave, 2); ctx.lineTo(-18, -6 + wave * 0.5); ctx.quadraticCurveTo(-6, -24, 8, -44); ctx.closePath(); });
    }
    if (L.wings) drawWings(ctx, L, C, path, t);
    if (L.shell) {     // 龟壳
      path('#8d6e63', ell(-10, -32, 32, 27));
      ctx.strokeStyle = C('#5d4037'); ctx.lineWidth = 2.4;
      for (const [hx, hy] of [[-22, -40], [-4, -46], [-14, -24], [4, -28], [-30, -24]]) { ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3; ctx.lineTo(hx + Math.cos(an) * 6, hy + Math.sin(an) * 6); } ctx.closePath(); ctx.stroke(); }
    }
    // ---------- 尾巴（在身体后面） ----------
    ctx.save();
    ctx.translate(-22, -26 + bob * 0.5); ctx.rotate(sway);
    drawTail(ctx, L, C, path, ell, t);
    ctx.restore();

    // ---------- 身体 ----------
    ctx.save(); ctx.translate(0, bob * 0.4); ctx.scale(1, breath);
    path(L.main, ell(0, -28, 28, 25));
    ctx.beginPath(); ctx.ellipse(5, -24, 17, 16, 0, 0, Math.PI * 2); ctx.fillStyle = C(L.belly); ctx.fill();
    if (L.mark === 'spots') { ctx.fillStyle = C('#ffffff'); for (const [px, py, r] of [[-14, -36, 3.2], [-6, -44, 2.6], [-18, -24, 2.4]]) { ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); } }
    if (L.mark === 'zig') { ctx.strokeStyle = C('#ffd21f'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-24, -34); ctx.lineTo(-16, -42); ctx.lineTo(-12, -32); ctx.lineTo(-4, -46); ctx.stroke(); }
    if (L.mark === 'wool') { for (const [wx, wy, wr] of [[-18, -40, 11], [-4, -48, 11], [12, -44, 10], [-22, -22, 10], [20, -30, 9]]) path('#ffffff', ell(wx, wy, wr, wr * 0.9), 2.2); }
    ctx.restore();
    // 脚
    path(L.main, ell(-13, -4, 10, 6.5));
    path(L.main, ell(15, -4, 10, 6.5));

    // ---------- 头 ----------
    ctx.save();
    ctx.translate(0, bob);
    drawEars(ctx, L, C, path, ell, t);
    path(L.main, ell(6, -64, 31, 28));
    if (L.mark === 'muzzle') { ctx.beginPath(); ctx.ellipse(10, -55, 15, 10, 0, 0, Math.PI * 2); ctx.fillStyle = C(L.belly); ctx.fill(); }
    if (L.mark === 'stripe') { ctx.strokeStyle = C('#7d828e'); ctx.lineWidth = 3; for (const dx of [-4, 4, 12]) { ctx.beginPath(); ctx.moveTo(dx + 2, -91); ctx.lineTo(dx + 2, -82); ctx.stroke(); } }
    drawMark(ctx, L, C, t);
    drawFace(ctx, L, C, t, o);
    if (form >= 2) {
      path('#ffd23a', () => { ctx.moveTo(-10, -88); ctx.lineTo(-12, -104); ctx.lineTo(-2, -95); ctx.lineTo(6, -108); ctx.lineTo(14, -95); ctx.lineTo(24, -104); ctx.lineTo(22, -88); ctx.closePath(); }, 2.4);
      ctx.fillStyle = C(acc); ctx.beginPath(); ctx.arc(6, -95, 3.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // 前爪
    path(L.main, ell(22, -24 + bob * 0.4, 7, 6));
    ctx.restore();
  }

  function drawEars(ctx, L, C, path, ell, t) {
    const tw = Math.sin(t * 1.7) > 0.96 ? 0.15 : 0;   // 偶尔动一下耳朵
    if (L.ears === 'cat') {
      for (const [ex, dir] of [[-14, -1], [24, 1]]) {
        ctx.save(); ctx.translate(ex, -84); ctx.rotate(dir * (0.25 + tw));
        path(L.main, () => { ctx.moveTo(-11, 6); ctx.lineTo(0, -20); ctx.lineTo(11, 6); ctx.closePath(); });
        ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(0, -11); ctx.lineTo(6, 4); ctx.closePath(); ctx.fillStyle = C(L.inner); ctx.fill();
        ctx.restore();
      }
    } else if (L.ears === 'round') {
      path(L.main, ell(-18, -84, 9, 8)); path(L.main, ell(30, -84, 9, 8));
      ctx.fillStyle = C(L.inner); ctx.beginPath(); ctx.arc(-18, -84, 4, 0, 7); ctx.arc(30, -84, 4, 0, 7); ctx.fill();
    } else if (L.ears === 'bunny') {
      for (const [ex, rot] of [[-6, -0.18], [18, 0.2]]) {
        ctx.save(); ctx.translate(ex, -86); ctx.rotate(rot + Math.sin(t * 2) * 0.05 + tw);
        path(L.main, ell(0, -22, 8.5, 24));
        ctx.beginPath(); ctx.ellipse(0, -20, 4, 17, 0, 0, Math.PI * 2); ctx.fillStyle = C(L.inner); ctx.fill();
        // 耳尖的嫩叶
        ctx.save(); ctx.translate(0, -46); ctx.rotate(0.5);
        path('#4caf50', () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -6, 16, 0); ctx.quadraticCurveTo(10, 6, 0, 0); }, 2.2);
        ctx.restore(); ctx.restore();
      }
    } else if (L.ears === 'mouse') {
      for (const ex of [-18, 30]) {
        path(L.main, ell(ex, -88, 14, 13));
        ctx.beginPath(); ctx.arc(ex, -88, 8, 0, 7); ctx.fillStyle = C(L.inner); ctx.fill();
      }
    } else if (L.ears === 'fox') {
      for (const [ex, dir] of [[-16, -1], [26, 1]]) {
        ctx.save(); ctx.translate(ex, -82); ctx.rotate(dir * (0.3 + tw));
        path(L.main, () => { ctx.moveTo(-12, 8); ctx.lineTo(0, -28); ctx.lineTo(12, 8); ctx.closePath(); });
        ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(0, -16); ctx.lineTo(6, 4); ctx.closePath(); ctx.fillStyle = C(L.inner); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-4, -16); ctx.lineTo(0, -28); ctx.lineTo(4, -16); ctx.closePath(); ctx.fillStyle = C('#5a2a10'); ctx.fill();
        ctx.restore();
      }
    } else if (L.ears === 'sheep') {
      for (const [ex, rot] of [[-22, 0.9], [34, -0.9]]) { ctx.save(); ctx.translate(ex, -66); ctx.rotate(rot); path(L.main, ell(0, 0, 6, 13)); ctx.restore(); }
    } else if (L.ears === 'horse') {
      // 彩虹鬃毛（在头后面）
      for (const [ex, dir] of [[-8, -1], [22, 1]]) {
        ctx.save(); ctx.translate(ex, -86); ctx.rotate(dir * (0.15 + tw));
        path(L.main, () => { ctx.moveTo(-7, 6); ctx.quadraticCurveTo(-4, -16, 0, -22); ctx.quadraticCurveTo(4, -16, 7, 6); ctx.closePath(); });
        ctx.beginPath(); ctx.ellipse(0, -4, 3, 8, 0, 0, Math.PI * 2); ctx.fillStyle = C(L.inner); ctx.fill();
        ctx.restore();
      }
    } else if (L.ears === 'bat') {
      for (const [ex, dir] of [[-16, -1], [28, 1]]) {
        ctx.save(); ctx.translate(ex, -84); ctx.rotate(dir * (0.35 + tw));
        path(L.main, () => { ctx.moveTo(-12, 8); ctx.lineTo(-4, -30); ctx.lineTo(12, 8); ctx.closePath(); });
        ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(-3, -18); ctx.lineTo(6, 4); ctx.closePath(); ctx.fillStyle = C(L.inner); ctx.fill();
        ctx.restore();
      }
    } else if (L.ears === 'deer') {
      // 鹿角（金色，角尖挂着小星星）
      ctx.lineCap = 'round';
      for (const dir of [-1, 1]) {
        const bx = dir < 0 ? -6 : 18;
        ctx.strokeStyle = C('#7a5020'); ctx.lineWidth = 7.5;
        ctx.beginPath(); ctx.moveTo(bx, -88); ctx.lineTo(bx + dir * 6, -108); ctx.lineTo(bx + dir * 2, -122); ctx.moveTo(bx + dir * 6, -108); ctx.lineTo(bx + dir * 16, -116); ctx.stroke();
        ctx.strokeStyle = C('#ffd54a'); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(bx, -88); ctx.lineTo(bx + dir * 6, -108); ctx.lineTo(bx + dir * 2, -122); ctx.moveTo(bx + dir * 6, -108); ctx.lineTo(bx + dir * 16, -116); ctx.stroke();
        star(ctx, bx + dir * 16, -118, 4 + Math.sin(t * 4 + dir) * 1, C('#fff7b0'));
      }
      for (const [ex, rot] of [[-22, -0.9], [34, 0.9]]) {
        ctx.save(); ctx.translate(ex, -78); ctx.rotate(rot);
        path(L.main, ell(0, -6, 6, 11)); ctx.restore();
      }
    }
  }

  function drawTail(ctx, L, C, path, ell, t) {
    if (L.tail === 'flame' || L.tail === 'cat') {
      ctx.lineCap = 'round';
      ctx.strokeStyle = C(L.line); ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-22, -4, -22, -30); ctx.stroke();
      ctx.strokeStyle = C(L.main); ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-22, -4, -22, -30); ctx.stroke();
      if (L.tail === 'flame') {
        const f = 1 + Math.sin(t * 14) * 0.08 + Math.sin(t * 23) * 0.05;
        ctx.save(); ctx.translate(-22, -32); ctx.scale(f, f);
        flame(ctx, 0, 0, 16, C('#ff5a2a')); flame(ctx, 0, 2, 10, C('#ffb000')); flame(ctx, 0, 4, 5, C('#fff3a0'));
        ctx.restore();
      }
    } else if (L.tail === 'otter') {
      path(L.main, () => { ctx.moveTo(0, 4); ctx.quadraticCurveTo(-30, 10, -40, -2); ctx.quadraticCurveTo(-34, -10, 0, -8); ctx.closePath(); });
    } else if (L.tail === 'puff') {
      path('#ffffff', ell(-4, -4, 11, 10));
      ctx.save(); ctx.translate(-10, -14); ctx.rotate(-0.8);
      path('#4caf50', () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(7, -5, 12, 0); ctx.quadraticCurveTo(7, 5, 0, 0); }, 2);
      ctx.restore();
    } else if (L.tail === 'bolt') {
      path('#ffd21f', () => { ctx.moveTo(2, 2); ctx.lineTo(-14, -6); ctx.lineTo(-8, -14); ctx.lineTo(-26, -22); ctx.lineTo(-18, -30); ctx.lineTo(-40, -42); ctx.lineTo(-24, -20); ctx.lineTo(-30, -14); ctx.lineTo(-14, -4); ctx.lineTo(-18, 2); ctx.closePath(); }, 2.6);
    } else if (L.tail === 'fox') {
      path(L.main, () => { ctx.moveTo(4, 2); ctx.bezierCurveTo(-30, 8, -46, -14, -36, -40); ctx.bezierCurveTo(-20, -30, -8, -14, 4, -10); ctx.closePath(); });
      path('#ffffff', () => { ctx.moveTo(-30, -30); ctx.quadraticCurveTo(-42, -34, -36, -40); ctx.quadraticCurveTo(-28, -38, -30, -30); });
      const f = 1 + Math.sin(t * 14) * 0.1;
      ctx.save(); ctx.translate(-37, -44); ctx.scale(f, f); flame(ctx, 0, 0, 9, C('#ff5a2a')); flame(ctx, 0, 2, 5, C('#ffd23a')); ctx.restore();
    } else if (L.tail === 'whale') {
      ctx.strokeStyle = C(L.line); ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-18, 2, -24, -14); ctx.stroke();
      ctx.strokeStyle = C(L.main); ctx.lineWidth = 7; ctx.stroke();
      path(L.main, () => { ctx.moveTo(-24, -14); ctx.quadraticCurveTo(-42, -16, -44, -30); ctx.quadraticCurveTo(-30, -22, -24, -24); ctx.quadraticCurveTo(-20, -36, -8, -40); ctx.quadraticCurveTo(-14, -24, -24, -14); });
    } else if (L.tail === 'wool') {
      path('#ffffff', ell(-4, -4, 9, 8), 2.2);
    } else if (L.tail === 'rainbow') {
      ['#ff6b6b', '#ffb347', '#ffe066', '#7ee07a', '#5aa8ff', '#b07cff'].forEach((c, i) => {
        ctx.strokeStyle = C(c); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath();
        ctx.moveTo(0, -4 + i * 2); ctx.quadraticCurveTo(-24, -12 + i * 3 + Math.sin(t * 3 + i * 0.4) * 4, -40, 2 + i * 3); ctx.stroke();
      });
    } else if (L.tail === 'deer') {
      path('#ffffff', ell(-6, -6, 8, 9, -0.5));
    } else if (L.tail === 'wisp') {
      // 烟雾一样的尾巴，越到尾端越透明
      for (let i = 0; i < 7; i++) {
        const k = i / 6, px = -6 - k * 34 + Math.sin(t * 3 + k * 4) * 4, py = -2 - k * 26 + Math.cos(t * 2.4 + k * 3) * 3;
        ctx.globalAlpha *= 1; ctx.fillStyle = C(i < 3 ? L.main : '#7a5fb8');
        ctx.beginPath(); ctx.arc(px, py, 10 - k * 5, 0, 7); ctx.fill();
      }
      ctx.fillStyle = C('#c99cff'); ctx.beginPath(); ctx.arc(-40 + Math.sin(t * 3) * 4, -28, 3, 0, 7); ctx.fill();
    }
  }

  function drawMark(ctx, L, C, t) {
    if (L.mark === 'flame') { flame(ctx, 6, -80, 7, C('#ff5a2a')); flame(ctx, 6, -79, 3.5, C('#ffd23a')); }
    if (L.mark === 'flower') {
      ctx.save(); ctx.translate(-10, -86); ctx.rotate(t * 0.6);
      ctx.fillStyle = C('#ff9ac0'); for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.256) * 5, Math.sin(i * 1.256) * 5, 3.6, 0, 7); ctx.fill(); }
      ctx.fillStyle = C('#ffd23a'); ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill(); ctx.restore();
    }
    if (L.mark === 'zig') { ctx.strokeStyle = C('#ffd21f'); ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(-2, -90); ctx.lineTo(6, -82); ctx.lineTo(2, -80); ctx.lineTo(10, -72); ctx.stroke(); }
    if (L.mark === 'moon') {
      ctx.fillStyle = C('#ffe14a'); ctx.beginPath(); ctx.arc(6, -82, 6, 0, 7); ctx.fill();
      ctx.fillStyle = C(L.main); ctx.beginPath(); ctx.arc(9, -84, 5.2, 0, 7); ctx.fill();
    }
    if (L.mark === 'spots') star(ctx, 6, -84, 4, C('#ffffff'));
    if (L.mark === 'mane') {   // 彩虹鬃毛：从头顶沿着后脑勺垂下来
      ['#ff6b6b', '#ffb347', '#ffe066', '#7ee07a', '#5aa8ff', '#b07cff'].forEach((c, i) => {
        ctx.fillStyle = C(c); ctx.beginPath();
        ctx.ellipse(4 - i * 5.5, -92 + i * 6 + Math.sin(t * 3 + i) * 1.2, 8, 5.5, -0.5 - i * 0.12, 0, Math.PI * 2); ctx.fill();
      });
    }
    if (L.mark === 'spout') {   // 头顶的小喷泉
      const h = 14 + Math.sin(t * 5) * 4;
      ctx.fillStyle = C('#9fd8ff'); ctx.beginPath(); ctx.moveTo(2, -90); ctx.quadraticCurveTo(6, -90 - h, 10, -90); ctx.fill();
      for (const [dx, k] of [[-8, 0], [6, 1.3], [20, 2.6]]) { ctx.beginPath(); ctx.arc(6 + dx * 0.8, -92 - h + Math.sin(t * 5 + k) * 3, 3.4, 0, Math.PI * 2); ctx.fill(); }
    }
    if (L.mark === 'mushroom') {   // 头顶的小蘑菇
      ctx.fillStyle = C('#fff3e0'); ctx.fillRect(1, -96, 10, 10);
      ctx.beginPath(); ctx.ellipse(6, -96, 20, 13, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = C('#e8453c'); ctx.fill();
      ctx.lineWidth = 2.6; ctx.strokeStyle = C(L.line); ctx.stroke();
      ctx.fillStyle = C('#ffffff'); for (const [mx, my, mr] of [[-4, -101, 3], [8, -105, 3.4], [17, -99, 2.6]]) { ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill(); }
    }
    if (L.mark === 'wool') {   // 头顶的毛球和小电火花
      for (const [wx, wy, wr] of [[-8, -90, 9], [6, -94, 10], [20, -90, 9]]) {
        ctx.beginPath(); ctx.ellipse(wx, wy, wr, wr * 0.85, 0, 0, Math.PI * 2); ctx.fillStyle = C('#ffffff'); ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = C(L.line); ctx.stroke();
      }
      if (Math.sin(t * 6) > 0.3) { ctx.strokeStyle = C('#ffd21f'); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(30, -100); ctx.lineTo(36, -94); ctx.lineTo(32, -92); ctx.lineTo(38, -84); ctx.stroke(); }
    }
  }

  function drawFace(ctx, L, C, t, o) {
    const blink = (t % 3.7) < 0.12 || o.faint > 0.5;
    const hurt = o.white > 0.3;
    for (const [ex, r] of [[-6, 6.6], [18, 7.2]]) {
      if (blink || hurt) {
        ctx.strokeStyle = C('#2a1a10'); ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        if (hurt) { ctx.moveTo(ex - 5, -68); ctx.lineTo(ex + 5, -64); ctx.lineTo(ex - 5, -60); }   // > < 表情
        else { ctx.moveTo(ex - 5, -64); ctx.quadraticCurveTo(ex, -60, ex + 5, -64); }
        ctx.stroke();
        continue;
      }
      if (L.eye === 'glow') {
        ctx.fillStyle = C('#ffe14a'); ctx.beginPath(); ctx.ellipse(ex, -64, r, r * 1.05, 0, 0, 7); ctx.fill();
        ctx.fillStyle = C('#1c1236'); ctx.beginPath(); ctx.ellipse(ex + 1, -64, 2, r * 0.8, 0, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = C('#2a1a10'); ctx.beginPath(); ctx.ellipse(ex, -64, r, r * 1.12, 0, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ex + 2, -67, r * 0.38, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(ex - 2, -61, r * 0.18, 0, 7); ctx.fill();
    }
    // 腮红
    ctx.fillStyle = C(L.cheek); ctx.globalAlpha *= 0.55;
    ctx.beginPath(); ctx.ellipse(-14, -54, 6, 3.6, 0, 0, 7); ctx.ellipse(28, -54, 6, 3.6, 0, 0, 7); ctx.fill();
    ctx.globalAlpha /= 0.55;
    if (L.ears === 'mouse') { star(ctx, -14, -54, 4, C('#ffe14a')); star(ctx, 28, -54, 4, C('#ffe14a')); }
    // 鼻子和嘴（ω）
    ctx.fillStyle = C(L.line); ctx.beginPath(); ctx.ellipse(10, -57, 2.6, 1.8, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = C(L.line); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    if (hurt) { ctx.arc(10, -49, 3.5, Math.PI * 1.1, Math.PI * 1.9); }
    else { ctx.arc(7, -55, 3, 0.1, Math.PI - 0.1); ctx.moveTo(16, -55); ctx.arc(13, -55, 3, 0.1, Math.PI - 0.1); }
    ctx.stroke();
    if (L.fang) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(5, -53); ctx.lineTo(7, -48); ctx.lineTo(9, -53); ctx.moveTo(12, -53); ctx.lineTo(14, -48); ctx.lineTo(16, -53); ctx.fill(); }
    if (L.ears === 'cat' || L.ears === 'fox' || L.mark === 'muzzle') {   // 胡须
      ctx.lineWidth = 1.4; ctx.beginPath();
      ctx.moveTo(-6, -56); ctx.lineTo(-20, -58); ctx.moveTo(-6, -53); ctx.lineTo(-19, -51);
      ctx.moveTo(26, -56); ctx.lineTo(40, -58); ctx.moveTo(26, -53); ctx.lineTo(39, -51); ctx.stroke();
    }
  }

  function drawWings(ctx, L, C, path, t) {
    const flap = Math.sin(t * 6) * 0.25;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side < 0 ? -12 : 6, -50); ctx.scale(1.3, 1.3); ctx.rotate(side < 0 ? -0.6 - flap : -0.2 + flap); if (side > 0) ctx.globalAlpha *= 0.85;
      if (L.wings === 'feather') {
        path('#ffffff', () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -30, -46, -16); ctx.quadraticCurveTo(-40, -10, -42, -4); ctx.quadraticCurveTo(-34, -2, -34, 4); ctx.quadraticCurveTo(-20, 6, 0, 8); ctx.closePath(); });
        ctx.strokeStyle = C('#d8ccff'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(-36, -12); ctx.moveTo(-8, 4); ctx.lineTo(-30, 0); ctx.stroke();
      } else {
        path('#4a3470', () => { ctx.moveTo(0, 0); ctx.lineTo(-20, -26); ctx.lineTo(-48, -20); ctx.quadraticCurveTo(-40, -10, -44, 0); ctx.quadraticCurveTo(-34, -4, -30, 6); ctx.quadraticCurveTo(-18, 0, -14, 10); ctx.closePath(); });
      }
      ctx.restore();
    }
  }
  function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

  // 宠物蛋：kind = normal / rare；crack 0~3 裂纹；shake 0~1 晃动
  function egg(ctx, x, y, size, t, o = {}) {
    const rare = o.kind === 'rare', s = size / 100;
    const sh = (o.shake || 0) * Math.sin(t * 40) * 0.12 + Math.sin(t * 2.2) * 0.04;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 0, 40 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (o.glow) { const g = ctx.createRadialGradient(0, -55 * s, 5, 0, -55 * s, 90 * s); g.addColorStop(0, o.glow); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -55 * s, 90 * s, 0, Math.PI * 2); ctx.fill(); }
    ctx.scale(s, s); ctx.rotate(sh);
    const body = () => { ctx.beginPath(); ctx.moveTo(0, -112); ctx.bezierCurveTo(40, -112, 50, -40, 44, -22); ctx.bezierCurveTo(38, -2, -38, -2, -44, -22); ctx.bezierCurveTo(-50, -40, -40, -112, 0, -112); ctx.closePath(); };
    body(); ctx.fillStyle = rare ? '#e6dcff' : '#fff4d6'; ctx.fill();
    ctx.save(); body(); ctx.clip();
    if (rare) {
      ctx.fillStyle = '#ffc531'; for (const [px, py, r] of [[-20, -80, 9], [18, -58, 11], [-14, -36, 8], [22, -94, 6]]) star(ctx, px, py, r, '#ffc531');
      ctx.fillStyle = '#b79cff'; ctx.fillRect(-60, -52, 120, 10);
    } else {
      ctx.fillStyle = '#7ccf6a'; for (const [px, py, r] of [[-18, -84, 10], [20, -62, 12], [-20, -38, 9], [8, -100, 6], [24, -28, 7]]) { ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-18, -82, 7, 16, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    body(); ctx.lineWidth = 4; ctx.strokeStyle = '#33215c'; ctx.stroke();
    const crack = o.crack || 0;   // 裂纹越来越多
    ctx.strokeStyle = '#33215c'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    const cracks = [[[-30, -60], [-18, -52], [-22, -42], [-8, -36]], [[12, -96], [20, -84], [12, -78], [26, -70], [20, -60]], [[-36, -30], [-20, -26], [-4, -32], [10, -24], [24, -30], [38, -26]]];
    for (let i = 0; i < Math.min(crack, 3); i++) { ctx.beginPath(); cracks[i].forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); }
    ctx.restore();
  }

  // ---------- 小图形 ----------
  function flame(ctx, x, y, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x, y - r * 1.9);
    ctx.bezierCurveTo(x + r * 1.1, y - r * 0.7, x + r, y + r * 0.7, x, y + r);
    ctx.bezierCurveTo(x - r, y + r * 0.7, x - r * 1.1, y - r * 0.7, x, y - r * 1.9);
    ctx.fill();
  }
  function star(ctx, x, y, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }

  // 头像（只画头，放在卡片里），用小画布缓存
  const cache = {};
  function portrait(look, px = 96, form = 0) {
    const key = look + px + '_' + form;
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas'); c.width = c.height = px;
    const ctx = c.getContext('2d');
    draw(ctx, look, px * 0.5, px * 0.96, px * (form >= 2 ? 0.54 : 0.6), 0.5, { form });   // 整只宠物，头顶留给耳朵、鹿角和皇冠
    return (cache[key] = c);
  }
  return { draw, flame, star, portrait, egg, LOOKS, ACC };
})();
