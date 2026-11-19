// 音效：全部用 Web Audio 合成（振荡器 + 噪声），不需要音频文件
'use strict';

const SFX = (() => {
  let ac = null, master = null, voiceGain = null, voiceSource = null, noiseBuf = null;
  let mutedFn = () => false;
  let masterVolume = 0.8;
  const lastPlayed = {};
  const voiceIdleWaiters = [];

  const effectiveMuted = () => Boolean(mutedFn()) || masterVolume <= 0;

  function flushVoiceWaiters() {
    while (voiceIdleWaiters.length) {
      const fn = voiceIdleWaiters.shift();
      try { fn(); } catch (e) { /* ignore */ }
    }
  }

  function stopVoice() {
    voiceIdleWaiters.length = 0;
    if (voiceSource) {
      try { voiceSource.onended = null; voiceSource.stop(); voiceSource.disconnect(); } catch (e) { /* ignore */ }
      voiceSource = null;
    }
    if (window.speechSynthesis) {
      try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    }
  }

  function syncGain() {
    if (effectiveMuted()) stopVoice();
    if (!ac || !master) return;
    const target = effectiveMuted() ? 0 : masterVolume * 0.8;
    master.gain.setTargetAtTime(target, ac.currentTime, 0.015);
  }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); syncGain(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; return; }
    const comp = ac.createDynamicsCompressor();   // 防止很多声音叠在一起时爆音
    master = ac.createGain();
    master.gain.value = effectiveMuted() ? 0 : masterVolume * 0.8;
    master.connect(comp); comp.connect(ac.destination);
    voiceGain = ac.createGain();
    voiceGain.gain.value = 1.35;
    voiceGain.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // 一个音：freq 起始频率，to 结束频率（滑音）
  function tone(freq, dur, { type = 'square', vol = 0.1, to = 0, delay = 0 } = {}) {
    if (!ac || effectiveMuted()) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  // 一段过滤后的噪声：用来做枪声、爆炸、风声
  function noise(dur, { vol = 0.2, freq = 1000, to = 0, type = 'lowpass', q = 0.8, delay = 0 } = {}) {
    if (!ac || effectiveMuted()) return;
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const arp = (notes, step, opt) => notes.forEach((n, i) => tone(n, opt.dur || 0.12, { ...opt, delay: i * step }));

  // gap：同一种声音的最小间隔（毫秒），避免连发时糊成一片
  const SOUNDS = {
    // 武器
    shoot_pistol: [0, () => { tone(900, 0.1, { to: 220, vol: 0.13 }); noise(0.05, { freq: 3500, type: 'highpass', vol: 0.14 }); }],
    shoot_shotgun: [0, () => { noise(0.25, { freq: 2200, to: 250, vol: 0.55 }); tone(130, 0.2, { type: 'sine', to: 45, vol: 0.45 }); noise(0.05, { freq: 5000, type: 'highpass', vol: 0.2 }); }],
    shoot_smg: [45, () => { noise(0.045, { freq: 2600, type: 'bandpass', q: 1.5, vol: 0.3 }); tone(520, 0.045, { to: 240, vol: 0.08 }); }],
    shoot_grenade: [0, () => { tone(240, 0.22, { type: 'sine', to: 60, vol: 0.45 }); noise(0.09, { freq: 700, vol: 0.25 }); }],
    shoot_laser: [0, () => { tone(2400, 0.24, { type: 'sawtooth', to: 280, vol: 0.12 }); tone(1200, 0.24, { to: 140, vol: 0.06 }); noise(0.1, { freq: 6000, type: 'highpass', vol: 0.06 }); }],
    boom: [60, () => { noise(0.55, { freq: 1000, to: 70, vol: 0.75 }); tone(95, 0.5, { type: 'sine', to: 28, vol: 0.65 }); noise(0.08, { freq: 4000, type: 'highpass', vol: 0.25 }); }],
    // 道具
    shockwave: [0, () => {
      tone(140, 0.7, { type: 'sine', to: 28, vol: 0.8 });
      tone(420, 0.55, { type: 'sawtooth', to: 65, vol: 0.38 });
      noise(0.65, { freq: 2800, to: 140, type: 'bandpass', q: 0.9, vol: 0.7 });
      arp([880, 1175, 1568], 0.05, { type: 'triangle', vol: 0.16, dur: 0.18 });
    }],
    missile: [0, () => { noise(0.8, { freq: 600, to: 3000, type: 'bandpass', vol: 0.35 }); tone(220, 0.6, { type: 'sawtooth', to: 90, vol: 0.15 }); arp([660, 880, 1100], 0.06, { type: 'triangle', vol: 0.1, dur: 0.12 }); }],
    turret: [60, () => { tone(1300, 0.06, { type: 'triangle', to: 600, vol: 0.09 }); noise(0.03, { freq: 4000, type: 'highpass', vol: 0.06 }); }],
    helper: [70, () => tone(1700, 0.05, { to: 900, vol: 0.05 })],
    shuriken: [70, () => { tone(2500, 0.08, { type: 'triangle', to: 3400, vol: 0.08 }); noise(0.06, { freq: 6000, type: 'highpass', vol: 0.14 }); }],
    lightning: [0, () => { noise(0.3, { freq: 2500, type: 'highpass', vol: 0.4 }); tone(150, 0.3, { type: 'sawtooth', to: 45, vol: 0.28 }); noise(0.5, { freq: 400, to: 80, vol: 0.3, delay: 0.08 }); }],
    catnip: [0, () => arp([660, 880, 1100, 1320, 1760], 0.05, { type: 'triangle', vol: 0.12, dur: 0.1 })],
    switch: [0, () => { tone(420, 0.03, { vol: 0.09 }); noise(0.04, { freq: 3500, type: 'highpass', vol: 0.14, delay: 0.04 }); tone(700, 0.04, { vol: 0.07, delay: 0.05 }); }],
    transform: [0, () => { tone(180, 0.4, { type: 'sawtooth', to: 1400, vol: 0.13 }); noise(0.4, { freq: 400, to: 5000, type: 'bandpass', vol: 0.2 }); arp([523, 659, 784, 1047, 1319], 0.06, { type: 'triangle', vol: 0.13, dur: 0.16 }); }],
    redPowerup: [0, () => {
      tone(110, 0.85, { type: 'sawtooth', to: 880, vol: 0.26 });
      noise(0.75, { freq: 300, to: 4200, type: 'bandpass', vol: 0.32 });
      arp([523, 659, 784, 1047, 1319, 1568], 0.07, { type: 'triangle', vol: 0.18, dur: 0.22 });
    }],
    unlock: [0, () => {
      arp([523, 659, 784, 1047, 1319, 1568, 2093], 0.075, { type: 'triangle', vol: 0.18, dur: 0.22 });
      tone(130, 0.55, { type: 'sine', to: 45, vol: 0.35 });
      noise(0.65, { freq: 3500, type: 'highpass', vol: 0.1, delay: 0.12 });
    }],
    revert: [0, () => tone(900, 0.25, { type: 'triangle', to: 250, vol: 0.09 })],
    stompCat: [120, () => { tone(110, 0.18, { type: 'sine', to: 40, vol: 0.4 }); noise(0.1, { freq: 500, vol: 0.25 }); }],
    // 战斗反馈
    hit: [40, () => tone(320, 0.045, { type: 'triangle', to: 180, vol: 0.09 })],
    kill: [40, () => { tone(520, 0.08, { type: 'triangle', to: 950, vol: 0.1 }); noise(0.05, { freq: 2500, type: 'highpass', vol: 0.07 }); }],
    pickup: [30, () => tone(1050, 0.07, { type: 'sine', to: 1600, vol: 0.09 })],
    combo: [80, () => playCombo(5, 5, true)],
    hurt: [0, () => { tone(220, 0.22, { type: 'sawtooth', to: 85, vol: 0.22 }); noise(0.1, { freq: 900, vol: 0.18 }); }],
    nestHit: [150, () => { tone(115, 0.13, { to: 65, vol: 0.12 }); noise(0.07, { freq: 500, vol: 0.16 }); }],
    // 头目
    boss: [0, () => { tone(70, 0.75, { type: 'sawtooth', to: 115, vol: 0.3 }); noise(0.6, { freq: 320, vol: 0.28 }); }],
    bossIntro: [0, () => {
      tone(95, 0.55, { type: 'sine', to: 36, vol: 0.52 });
      tone(340, 0.24, { type: 'sawtooth', to: 240, vol: 0.16 });
      tone(340, 0.24, { type: 'sawtooth', to: 240, vol: 0.16, delay: 0.32 });
      tone(140, 0.85, { type: 'triangle', to: 72, vol: 0.22, delay: 0.18 });
      noise(0.5, { freq: 1800, to: 420, type: 'bandpass', q: 1.4, vol: 0.2, delay: 0.08 });
    }],
    roar: [0, () => { tone(115, 0.85, { type: 'sawtooth', to: 68, vol: 0.34 }); tone(172, 0.85, { type: 'sawtooth', to: 98, vol: 0.2 }); noise(0.85, { freq: 800, to: 300, vol: 0.32 }); }],
    howl: [0, () => { tone(340, 0.5, { type: 'sine', to: 640, vol: 0.24 }); tone(640, 0.7, { type: 'sine', to: 300, vol: 0.24, delay: 0.5 }); }],
    trumpet: [0, () => { tone(310, 0.45, { type: 'sawtooth', to: 540, vol: 0.2 }); tone(465, 0.45, { to: 800, vol: 0.06 }); }],
    stomp: [0, () => { tone(85, 0.45, { type: 'sine', to: 28, vol: 0.75 }); noise(0.35, { freq: 350, to: 80, vol: 0.55 }); }],
    dash: [0, () => noise(0.35, { freq: 700, to: 3500, type: 'bandpass', vol: 0.3 })],
    bark: [0, () => { tone(420, 0.09, { to: 250, vol: 0.2 }); tone(440, 0.1, { to: 240, vol: 0.2, delay: 0.15 }); }],
    spit: [0, () => { tone(620, 0.09, { type: 'triangle', to: 950, vol: 0.13 }); noise(0.06, { freq: 3000, type: 'bandpass', vol: 0.1 }); }],
    // 命中（按武器区分）
    hit_pistol: [30, () => { tone(720, 0.05, { type: 'sine', to: 300, vol: 0.11 }); noise(0.04, { freq: 1800, vol: 0.09 }); }],
    hit_shotgun: [40, () => { noise(0.09, { freq: 650, vol: 0.22 }); tone(170, 0.09, { type: 'sine', to: 80, vol: 0.16 }); }],
    hit_smg: [30, () => tone(1900, 0.025, { type: 'triangle', vol: 0.07 })],
    hit_laser: [30, () => { tone(1700, 0.12, { type: 'sawtooth', to: 420, vol: 0.1 }); noise(0.06, { freq: 5000, type: 'highpass', vol: 0.08 }); }],
    hit_turret: [40, () => tone(320, 0.045, { type: 'triangle', to: 180, vol: 0.09 })],
    // 合成与星级
    merge: [0, () => { arp([523, 659, 784, 1047, 1319], 0.06, { type: 'triangle', vol: 0.14, dur: 0.16 }); noise(0.5, { freq: 4000, type: 'highpass', vol: 0.08, delay: 0.1 }); }],
    mergeBig: [0, () => { arp([523, 659, 784, 1047, 1319, 1568, 2093], 0.07, { type: 'triangle', vol: 0.15, dur: 0.2 }); tone(100, 0.6, { type: 'sine', to: 38, vol: 0.4 }); noise(0.8, { freq: 500, to: 6000, type: 'bandpass', vol: 0.18 }); }],
    star0: [0, () => { tone(784, 0.14, { type: 'triangle', vol: 0.16 }); tone(1047, 0.22, { type: 'triangle', vol: 0.14, delay: 0.07 }); }],
    star1: [0, () => { tone(988, 0.14, { type: 'triangle', vol: 0.16 }); tone(1319, 0.22, { type: 'triangle', vol: 0.14, delay: 0.07 }); }],
    star2: [0, () => { tone(1175, 0.14, { type: 'triangle', vol: 0.16 }); tone(1568, 0.3, { type: 'triangle', vol: 0.14, delay: 0.07 }); noise(0.4, { freq: 5000, type: 'highpass', vol: 0.07, delay: 0.1 }); }],
    starMiss: [0, () => tone(300, 0.22, { type: 'triangle', to: 190, vol: 0.09 })],
    // 巨龙
    dragonRoar: [0, () => { tone(75, 1.1, { type: 'sawtooth', to: 130, vol: 0.38 }); tone(112, 1.1, { type: 'sawtooth', to: 70, vol: 0.2 }); noise(1.1, { freq: 700, to: 250, vol: 0.34 }); }],
    fireBreath: [0, () => { noise(1.5, { freq: 1100, to: 350, vol: 0.5 }); tone(68, 1.5, { type: 'sawtooth', vol: 0.2 }); }],
    meteorFall: [0, () => tone(1500, 0.9, { type: 'sine', to: 220, vol: 0.09 })],
    meteorHit: [50, () => { noise(0.4, { freq: 900, to: 70, vol: 0.55 }); tone(90, 0.35, { type: 'sine', to: 32, vol: 0.5 }); }],
    heal: [200, () => { tone(880, 0.12, { type: 'sine', vol: 0.08 }); tone(1175, 0.18, { type: 'sine', vol: 0.08, delay: 0.09 }); }],
    boarWind: [0, () => { tone(180, 0.35, { type: 'sawtooth', to: 120, vol: 0.12 }); noise(0.3, { freq: 500, vol: 0.14 }); }],
    bomberBlast: [40, () => { noise(0.45, { freq: 1200, to: 80, vol: 0.6 }); tone(110, 0.4, { type: 'sine', to: 35, vol: 0.55 }); }],
    slimeSplit: [60, () => { tone(300, 0.18, { type: 'sine', to: 700, vol: 0.12 }); tone(420, 0.18, { type: 'sine', to: 900, vol: 0.1, delay: 0.05 }); }],
    horde: [0, () => { tone(150, 0.7, { type: 'sawtooth', to: 90, vol: 0.28 }); tone(225, 0.7, { type: 'sawtooth', to: 135, vol: 0.18 }); noise(0.7, { freq: 500, vol: 0.22 }); }],
    // 界面
    buy: [0, () => { tone(1250, 0.07, { type: 'sine', vol: 0.13 }); tone(1680, 0.14, { type: 'sine', vol: 0.13, delay: 0.07 }); }],
    right: [0, () => arp([523, 659, 784, 1047], 0.09, { type: 'sine', vol: 0.15, dur: 0.18 })],
    wrong: [0, () => { tone(230, 0.18, { to: 170, vol: 0.1 }); tone(170, 0.3, { to: 120, vol: 0.1, delay: 0.16 }); }],
    firework: [0, () => { tone(500 + Math.random() * 400, 0.14, { type: 'triangle', to: 1300, vol: 0.06 }); noise(0.2, { freq: 3000, type: 'highpass', vol: 0.05, delay: 0.1 }); }],
  };

  // 连击音效：按连击数逐级升调，并在跨入 x2 / x5 / x10 / x20 / x30 等阶时播放递增冲击感与音高的提示音
  const COMBO_PENTA = [0, 2, 4, 7, 9];
  const COMBO_TIER_SPECS = {
    2:  { punch: 165, punchVol: 0.16, notes: [784, 988], step: 0.055, dur: 0.13, vol: 0.13, shimmer: 0 },
    5:  { punch: 195, punchVol: 0.19, notes: [988, 1175, 1480], step: 0.05, dur: 0.15, vol: 0.14, shimmer: 3200 },
    10: { punch: 225, punchVol: 0.22, notes: [1175, 1480, 1760, 2349], step: 0.045, dur: 0.17, vol: 0.14, shimmer: 3800 },
    20: { punch: 255, punchVol: 0.24, notes: [1319, 1661, 1976, 2637], step: 0.04, dur: 0.19, vol: 0.14, shimmer: 4400 },
    30: { punch: 285, punchVol: 0.26, notes: [1568, 1976, 2349, 3136], step: 0.036, dur: 0.22, vol: 0.15, shimmer: 5000 },
  };
  function playCombo(combo, tierMin = 2, tierUp = false) {
    if (!ac || effectiveMuted() || combo < 2) return;
    const now = performance.now();
    if (tierUp) {
      if (now - (lastPlayed.comboTier || 0) < 70) return;
      lastPlayed.comboTier = now;
      lastPlayed.comboHit = now;
      const spec = COMBO_TIER_SPECS[tierMin] || COMBO_TIER_SPECS[30];
      tone(spec.punch, 0.085, { type: 'sine', to: Math.max(60, spec.punch * 0.42), vol: spec.punchVol });
      if (spec.shimmer) noise(0.055, { freq: spec.shimmer, type: 'highpass', vol: 0.09 });
      arp(spec.notes, spec.step, { type: 'triangle', vol: spec.vol, dur: spec.dur });
      if (tierMin >= 10) {
        const top = spec.notes[spec.notes.length - 1];
        tone(top, spec.dur + 0.06, { type: 'sine', vol: 0.06, delay: spec.step * (spec.notes.length - 1) });
      }
      return;
    }
    if (now - (lastPlayed.comboHit || 0) < 55) return;
    lastPlayed.comboHit = now;
    const step = Math.min(14, Math.max(0, combo - 2));
    const semi = Math.floor(step / 5) * 12 + COMBO_PENTA[step % 5];
    const baseFreq = 587.33 * Math.pow(2, semi / 12);
    const punchFreq = 145 + Math.min(125, combo * 4);
    tone(punchFreq, 0.055, { type: 'sine', to: 68, vol: 0.13 });
    tone(baseFreq, 0.09, { type: 'triangle', to: baseFreq * 1.12, vol: 0.11 });
    if (tierMin >= 10) {
      tone(baseFreq * 1.5, 0.08, { type: 'sine', vol: 0.05, delay: 0.02 });
    }
  }

  function play(name) {
    const s = SOUNDS[name];
    if (!s || !ac || effectiveMuted()) return;
    const now = performance.now();
    if (s[0] && now - (lastPlayed[name] || 0) < s[0]) return;
    lastPlayed[name] = now;
    s[1]();
  }

  async function playVoiceBuffer(arrayBuffer, { interrupt = true } = {}) {
    if (effectiveMuted()) return false;
    init();
    if (!ac || !voiceGain) return false;
    if (ac.state === 'suspended') {
      try { await ac.resume(); } catch (e) { /* ignore */ }
    }
    if (effectiveMuted()) return false;
    const audioBuf = await ac.decodeAudioData(arrayBuffer.slice(0));
    if (effectiveMuted()) return false;
    if (voiceSource || (window.speechSynthesis && window.speechSynthesis.speaking)) {
      if (!interrupt) return false;
      stopVoice();
    }
    const src = ac.createBufferSource();
    src.buffer = audioBuf;
    src.connect(voiceGain);
    src.onended = () => {
      if (voiceSource === src) {
        voiceSource = null;
        flushVoiceWaiters();
      }
    };
    voiceSource = src;
    src.start(0);
    return true;
  }

  return {
    init,
    play,
    playCombo,
    playVoiceBuffer,
    stopVoice,
    isVoicePlaying: () => Boolean(voiceSource),
    onVoiceIdle(fn) {
      if (!voiceSource) { fn(); return; }
      if (voiceIdleWaiters.length < 6) voiceIdleWaiters.push(fn);
    },
    syncGain,
    isMuted: effectiveMuted,
    setMuted(fn) {
      mutedFn = typeof fn === 'function' ? fn : () => Boolean(fn);
      syncGain();
    },
    setVolume(v) {
      const n = Number(v);
      masterVolume = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.8;
      syncGain();
    },
    getVolume() { return masterVolume; },
  };
})();
