// 游戏大厅：漂浮的背景字、卡片里的小动画、卡片倾斜效果、存档信息
'use strict';
(() => {
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const rand = (a, b) => a + Math.random() * (b - a);
  function fit(c) {
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * DPR) || c.height !== Math.round(h * DPR)) { c.width = Math.round(w * DPR); c.height = Math.round(h * DPR); }
    const ctx = c.getContext('2d'); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { ctx, w, h };
  }

  // ---------- 背景：慢慢往上飘的汉字、数字和星星 ----------
  const GLYPHS = '猫宠学字书春花鱼山水火123456789+−×÷=★✿'.split('');
  const bg = document.getElementById('bg');
  const floaters = Array.from({ length: 26 }, () => ({ g: GLYPHS[Math.floor(Math.random() * GLYPHS.length)], x: Math.random(), y: Math.random(), s: rand(16, 40), v: rand(0.012, 0.035), r: rand(-0.5, 0.5), vr: rand(-0.3, 0.3) }));
  function drawBg(dt) {
    const { ctx, w, h } = fit(bg);
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of floaters) {
      f.y -= f.v * dt; f.r += f.vr * dt;
      if (f.y < -0.08) { f.y = 1.08; f.x = Math.random(); }
      ctx.save(); ctx.translate(f.x * w, f.y * h); ctx.rotate(f.r);
      ctx.font = `900 ${f.s}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillText(f.g, 0, 0);
      ctx.restore();
    }
  }

  // ---------- 卡片动画 ----------
  const scenes = [...document.querySelectorAll('canvas.scene')];
  const S = {
    cat: { peas: [], foes: [{ x: 1.1, hop: 0, hp: 3, flash: 0 }], parts: [], cd: 0 },
    pets: { shots: [], parts: [], turn: 0, cd: 1, flash: [0, 0], texts: [] },
  };

  function drawCat(ctx, w, h, t, dt) {
    const s = S.cat, cx = w * 0.22, gy = h * 0.9, size = h * 0.5;
    // 地面上的小猫窝
    ctx.fillStyle = '#c98b4a'; ctx.strokeStyle = '#33215c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.rect(w * 0.02, gy - h * 0.3, w * 0.11, h * 0.27); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e0603a'; ctx.beginPath(); ctx.moveTo(w * 0.005, gy - h * 0.3); ctx.lineTo(w * 0.075, gy - h * 0.46); ctx.lineTo(w * 0.145, gy - h * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
    PetArt.draw(ctx, 'gunner', cx, gy, size, t, {});
    // 手里的枪
    const gun = typeof ICONS !== 'undefined' && ICONS.canvas && ICONS.canvas.pistol;   // ICONS 是 const，不在 window 上
    if (gun) { const gs = size * 0.42; ctx.drawImage(gun, cx + size * 0.1, gy - size * 0.42 - gs / 2 + Math.sin(t * 3) * 2, gs, gs); }
    // 发射豌豆
    s.cd -= dt;
    if (s.cd <= 0) { s.cd = 0.45; s.peas.push({ x: cx + size * 0.5, y: gy - size * 0.4 }); }
    for (let i = s.peas.length - 1; i >= 0; i--) {
      const p = s.peas[i]; p.x += 420 * dt;
      ctx.fillStyle = '#6fd24a'; ctx.strokeStyle = '#2e6b2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill(); ctx.stroke();
      const f = s.foes[0];
      if (f && Math.abs(p.x - f.x * w) < 18) {
        s.peas.splice(i, 1); f.hp--; f.flash = 0.15;
        for (let k = 0; k < 8; k++) s.parts.push({ x: p.x, y: p.y, vx: rand(-120, 120), vy: rand(-140, 40), life: 0.5, c: '#8ee06a' });
        if (f.hp <= 0) { for (let k = 0; k < 16; k++) s.parts.push({ x: f.x * w, y: gy - 20, vx: rand(-200, 200), vy: rand(-240, 0), life: 0.7, c: '#ffe14a' }); f.x = 1.15; f.hp = 3; }
      } else if (p.x > w + 20) s.peas.splice(i, 1);
    }
    // 跳过来的小怪
    for (const f of s.foes) {
      f.x -= 0.09 * dt; f.hop += dt * 7; f.flash -= dt;
      if (f.x < 0.42) f.x = 1.15;
      const fx = f.x * w, fy = gy - Math.abs(Math.sin(f.hop)) * 16;
      ctx.fillStyle = f.flash > 0 ? '#fff' : '#ff6b8a'; ctx.strokeStyle = '#33215c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(fx, fy - 18, 24, 20, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#33215c'; ctx.beginPath(); ctx.arc(fx - 8, fy - 22, 3.5, 0, 7); ctx.arc(fx + 4, fy - 22, 3.5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#33215c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx - 14, fy - 32); ctx.lineTo(fx - 4, fy - 28); ctx.moveTo(fx + 10, fy - 32); ctx.lineTo(fx, fy - 28); ctx.stroke();
    }
    parts(ctx, s.parts, dt);
  }

  function drawPets(ctx, w, h, t, dt) {
    const s = S.pets, size = h * 0.48, L = { x: w * 0.24, y: h * 0.92 }, R = { x: w * 0.76, y: h * 0.92 };
    s.cd -= dt;
    if (s.cd <= 0) { s.cd = 1.3; s.shots.push({ from: s.turn, k: 0 }); s.turn = 1 - s.turn; }
    s.flash = s.flash.map(v => Math.max(0, v - dt * 3));
    PetArt.draw(ctx, 'huowei', L.x, L.y, size, t, { white: s.flash[0] });
    PetArt.draw(ctx, 'paopao', R.x, R.y, size, t + 1.7, { flip: true, white: s.flash[1] });
    for (let i = s.shots.length - 1; i >= 0; i--) {
      const sh = s.shots[i]; sh.k += dt / 0.6;
      const a = sh.from === 0 ? L : R, b = sh.from === 0 ? R : L;
      const x = a.x + (b.x - a.x) * sh.k, y = a.y - size * 0.5 - Math.sin(sh.k * Math.PI) * 34;
      if (sh.from === 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2); PetArt.flame(ctx, 0, 0, 14, '#ff5a2a'); PetArt.flame(ctx, 0, 3, 8, '#ffb000'); ctx.restore(); }
      else for (let k = 0; k < 3; k++) { ctx.fillStyle = 'rgba(160,215,255,.7)'; ctx.strokeStyle = '#2f8fe0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + Math.sin(t * 12 + k * 2) * 8, y + (k - 1) * 10, 8 - k * 2, 0, 7); ctx.fill(); ctx.stroke(); }
      if (sh.k >= 1) {
        s.shots.splice(i, 1); const tgt = 1 - sh.from; s.flash[tgt] = 1;
        const col = sh.from === 0 ? ['#ff7a2f', '#ffd000'] : ['#2f8fe0', '#bfe2ff'];
        for (let k = 0; k < 14; k++) s.parts.push({ x: b.x, y: b.y - size * 0.5, vx: rand(-180, 180), vy: rand(-200, 60), life: 0.6, c: col[k % 2] });
        s.texts.push({ x: b.x, y: b.y - size * 1.05, life: 0.9, txt: Math.random() < 0.3 ? '暴击！' : String(Math.floor(rand(18, 40))) });
      }
    }
    parts(ctx, s.parts, dt);
    ctx.textAlign = 'center'; ctx.font = '900 24px "PingFang SC","Microsoft YaHei",sans-serif';
    for (let i = s.texts.length - 1; i >= 0; i--) {
      const tx = s.texts[i]; tx.life -= dt; tx.y -= 40 * dt; if (tx.life <= 0) { s.texts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, tx.life * 2); ctx.lineWidth = 5; ctx.strokeStyle = '#33215c'; ctx.strokeText(tx.txt, tx.x, tx.y);
      ctx.fillStyle = tx.txt === '暴击！' ? '#ffe14a' : '#fff'; ctx.fillText(tx.txt, tx.x, tx.y); ctx.globalAlpha = 1;
    }
    // 中间的 VS
    ctx.font = '900 34px sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#33215c'; ctx.fillStyle = '#ffe14a';
    const vs = 1 + Math.sin(t * 5) * 0.08; ctx.save(); ctx.translate(w / 2, h * 0.3); ctx.scale(vs, vs); ctx.strokeText('VS', 0, 0); ctx.fillText('VS', 0, 0); ctx.restore();
  }

  function drawSoon(ctx, w, h, t) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {   // 剪影
      const look = ['dianwan', 'xingxing', 'yingzi'][i];
      ctx.save(); ctx.filter = 'brightness(0)';
      PetArt.draw(ctx, look, w * (0.2 + i * 0.3), h * 0.95, h * 0.42, t + i, { alpha: 0.16 });
      ctx.restore();
    }
    const y = h * 0.45 + Math.sin(t * 2.5) * 10;
    ctx.font = '900 90px sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = '#33215c'; ctx.fillStyle = '#fff';
    ctx.strokeText('?', w / 2, y); ctx.fillText('?', w / 2, y);
    for (let i = 0; i < 6; i++) { const a = t * 1.5 + i * 1.047; PetArt.star(ctx, w / 2 + Math.cos(a) * 80, y + Math.sin(a) * 46, 7 + Math.sin(t * 4 + i) * 2, '#ffd000'); }
  }

  function parts(ctx, list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]; p.life -= dt; if (p.life <= 0) { list.splice(i, 1); continue; }
      p.vy += 400 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
    drawBg(dt);
    for (const c of scenes) {
      const { ctx, w, h } = fit(c);
      ctx.clearRect(0, 0, w, h);
      if (c.dataset.scene === 'cat') drawCat(ctx, w, h, t, dt);
      else if (c.dataset.scene === 'pets') drawPets(ctx, w, h, t, dt);
      else drawSoon(ctx, w, h, t);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- 卡片倾斜 + 点击飞入 ----------
  for (const card of document.querySelectorAll('.gcard:not(.soon)')) {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 10}deg) scale(1.02)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    card.addEventListener('click', e => {
      e.preventDefault();
      card.style.transform = '';
      card.classList.add('go');
      setTimeout(() => { location.href = card.getAttribute('href'); }, 380);
    });
  }
  // 从游戏返回时（浏览器缓存的页面）恢复卡片
  window.addEventListener('pageshow', () => document.querySelectorAll('.gcard.go').forEach(c => c.classList.remove('go')));

  // ---------- 存档信息 ----------
  try {
    const run = JSON.parse(localStorage.getItem('catDefenseRun'));
    if (run && run.level >= 1) document.getElementById('saveCat').textContent = `💾 继续第 ${run.level} 关`;
  } catch (e) { /* 没有存档 */ }
  try {
    const pa = JSON.parse(localStorage.getItem('petAcademy'));
    if (pa && pa.profiles && pa.profiles.length) {
      document.getElementById('savePets').textContent = '💾 ' + pa.profiles.map(p => `${p.avatar}${p.name}（${p.pets.length} 只宠物${p.badges.length ? ' · ' + p.badges.length + ' 枚徽章' : ''}）`).join('　');
    }
  } catch (e) { /* 没有存档 */ }
})();
