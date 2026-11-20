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
  };

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
    if (L.ears === 'cat' || L.mark === 'muzzle') {   // 胡须
      ctx.lineWidth = 1.4; ctx.beginPath();
      ctx.moveTo(-6, -56); ctx.lineTo(-20, -58); ctx.moveTo(-6, -53); ctx.lineTo(-19, -51);
      ctx.moveTo(26, -56); ctx.lineTo(40, -58); ctx.moveTo(26, -53); ctx.lineTo(39, -51); ctx.stroke();
    }
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
  function portrait(look, px = 96) {
    const key = look + px;
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas'); c.width = c.height = px;
    const ctx = c.getContext('2d');
    draw(ctx, look, px * 0.5, px * 0.96, px * 0.62, 0.5, {});   // 整只宠物，头顶留给耳朵和鹿角
    return (cache[key] = c);
  }
  return { draw, flame, star, portrait, LOOKS };
})();
