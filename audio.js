/*
 * Project: Refusal Protocol — 程序化音訊引擎（audio.js）
 *
 * 全部聲音都在瀏覽器裡即時合成，不載入任何 MP3／WAV。
 * 對外只暴露 window.AudioEngine，其餘都包在這個閉包裡。
 *
 * 訊號路徑：
 *   各音軌 → bgm 匯流排 ┐
 *   各音效 → sfx 匯流排 ┴→ 顫音延遲（失諧熵晃動）→ 主音量 → 壓縮器 → 喇叭
 *   每條匯流排各自帶一個殘響，音量滑桿會同時影響乾聲與殘響。
 *
 * 瀏覽器規定要等使用者互動後才能出聲，所以第一次點擊或按鍵時才會建立 AudioContext。
 * 在那之前呼叫 playBGM() 會被記下來，解鎖後自動補播；音效則直接略過。
 */
(function (global) {
  'use strict';

  const LOOKAHEAD = 0.15;   // 排程器往前預排的秒數
  const TICK_MS = 25;       // 排程器檢查間隔（毫秒）

  const BGM_LABELS = {
    manor: '莊園低鳴',
    parlor: '貴賓廳羽管鍵琴',
    storm: '雷雨圖書館',
    clocktower: '禁域鐘樓',
    alarm: '紅隊入侵警報',
    elegy: '忘川輓歌'
  };

  const SFX_LABELS = {
    FAN_SNAP: '摺扇合攏',
    BOOK_SNAP: '書本闔上',
    KEYSTROKE_CLACK: '打字機鍵',
    POLICY_VIOLATION_BLIP: '違規警示',
    HEARTBEAT_PULSE: '心跳',
    BELL_TOLL: '莊園鐘鳴',
    THUNDER: '雷聲',
    TEACUP_CLINK: '茶杯輕碰',
    PAGE_TURN: '翻頁',
    UI_HOVER: '選項滑過',
    UI_SELECT: '確認',
    UI_BACK: '返回',
    GLITCH_BURST: '訊號崩裂',
    LOCKET_CLOSE: '墜盒闔上',
    BOOTSTEP: '稽核官的靴聲',
    GLASS_SHATTER: '玻璃碎裂',
    CHIME_SAVE: '存檔鈴音',
    SPARKLE: '心動閃光',
    GAVEL: '家憲法槌'
  };

  // 教堂鐘的非諧和泛音：[頻率倍數, 音量, 衰減秒數]
  const BELL_PARTIALS = [
    [0.5, 0.30, 7.0],
    [1.0, 0.42, 5.0],
    [1.183, 0.30, 4.0],   // 小三度泛音，鐘聲的哀愁感主要來自這一條
    [1.506, 0.18, 3.2],
    [2.0, 0.26, 2.8],
    [2.514, 0.10, 2.0],
    [2.662, 0.09, 1.8],
    [3.011, 0.07, 1.4],
    [4.166, 0.05, 1.0]
  ];

  // 貴賓廳：D 小調 Dm – Gm – A7 – Dm（MIDI 音高，第一個是低音）
  const PARLOR_CHORDS = [
    [50, 57, 62, 65, 69],
    [43, 55, 58, 62, 67],
    [45, 57, 61, 64, 67],
    [50, 57, 62, 65, 69]
  ];
  const PARLOR_ARP = [1, 2, 3, 4, 3, 2, 3, 2];
  const PARLOR_MELODY = [
    [74, 76, 77, 76],
    [74, 70, 74, 79],
    [76, 73, 76, 79],
    [77, 76, 74, null]
  ];
  const MINIMAL_CELL = [2, 3, 4, 3];
  const PARLOR_STEP = 60 / 76 / 4;   // 每拍 76，十六分音符

  // 輓歌：Dm – B♭ – Gm – A
  const ELEGY_CHORDS = [
    [50, 57, 62, 65],
    [46, 53, 58, 62],
    [43, 50, 55, 58],
    [45, 52, 57, 61]
  ];

  // 位元粉碎器：AudioWorklet 版本（同時降位元深度與取樣率）
  const CRUSHER_SRC = `
class RPCrusher extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 6, minValue: 1, maxValue: 16 },
      { name: 'reduction', defaultValue: 8, minValue: 1, maxValue: 64 }
    ];
  }
  constructor() {
    super();
    this.hold = [0, 0];
    this.count = 0;
    this.alive = true;
    this.port.onmessage = (e) => { if (e.data === 'stop') this.alive = false; };
  }
  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return this.alive;
    const step = Math.pow(0.5, params.bits[0]);
    const red = Math.max(1, Math.round(params.reduction[0]));
    const start = this.count;
    for (let ch = 0; ch < output.length; ch++) {
      const inp = input[ch] || input[0];
      const out = output[ch];
      let count = start;
      let hold = this.hold[ch] || 0;
      for (let i = 0; i < out.length; i++) {
        if (count % red === 0) hold = step * Math.floor(inp[i] / step + 0.5);
        out[i] = hold;
        count++;
      }
      this.hold[ch] = hold;
    }
    this.count = (start + output[0].length) % red;
    return this.alive;
  }
}
registerProcessor('rp-crusher', RPCrusher);
`;

  let ctx = null;
  const S = {
    buses: null,
    masterGain: null,
    duckGain: null,
    lfoFast: null,
    lfoFastDepth: null,
    lfoSlowDepth: null,
    white: null,
    pink: null,
    crushCurve: null,
    workletReady: false,
    volumes: { master: 0.8, bgm: 0.6, sfx: 0.8 },
    muted: false,
    current: null,
    pending: null,
    tension: 0,
    wobble: 0,
    lastClack: 0,
    listeners: {},
    initPromise: null
  };

  /* ───────────── 小工具 ───────────── */

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function osc(type, freq, detune) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    return o;
  }

  function gain(v) {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  }

  function filter(type, freq, q) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q != null) f.Q.value = q;
    return f;
  }

  function noiseSrc(kind) {
    const s = ctx.createBufferSource();
    s.buffer = kind === 'pink' ? S.pink : S.white;
    s.loop = true;
    return s;
  }

  // 打擊型包絡：從靜音快速升到 peak，再指數衰減到 end 時刻
  function env(param, t, peak, attack, end) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    param.exponentialRampToValueAtTime(0.0001, Math.max(t + attack + 0.005, end));
  }

  // 一次性節點在聲音結束後斷線，避免節點越積越多
  function cleanupAt(t, nodes) {
    const ms = Math.max(0, (t - ctx.currentTime) * 1000) + 120;
    setTimeout(() => {
      nodes.forEach((n) => { try { n.disconnect(); } catch (e) { /* 已斷線 */ } });
    }, ms);
  }

  // 建立一個接到匯流排的輸入點，可選擇送一部分到殘響
  function tap(bus, verbAmt, until) {
    const g = gain(1);
    g.connect(bus.dry);
    const nodes = [g];
    if (verbAmt > 0) {
      const s = gain(verbAmt);
      g.connect(s);
      s.connect(bus.verb);
      nodes.push(s);
    }
    cleanupAt(until, nodes);
    return g;
  }

  function noiseHit(t, dur, peak, o) {
    const src = noiseSrc(o.kind || 'white');
    const f = filter(o.type || 'bandpass', o.freq || 1000, o.q != null ? o.q : 1);
    const g = gain(0);
    env(g.gain, t, peak, o.attack || 0.002, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.03);
    cleanupAt(t + dur + 0.05, [src, f, g]);
    return { src, f, g };
  }

  function tone(t, type, freq, peak, attack, dur, dest, endFreq) {
    const o = osc(type, freq);
    const g = gain(0);
    if (endFreq) {
      // 先在起點釘住頻率，否則延後播放的音會提早開始滑音
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    }
    env(g.gain, t, peak, attack, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    cleanupAt(t + dur + 0.08, [o, g]);
    return o;
  }

  function buildImpulse(seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function makeWhite(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Paul Kellet 的粉紅雜訊濾波，比白雜訊溫暖，適合鍵聲與遠雷
  function makePink(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buf;
  }

  function makeCrushCurve(bits) {
    const n = 4096;
    const c = new Float32Array(n);
    const half = Math.pow(2, bits) / 2;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.round(x * half) / half;
    }
    return c;
  }

  // 有 AudioWorklet 就用真正的位元粉碎器；舊瀏覽器退回只量化振幅的 WaveShaper
  function makeCrusher(bits, reduction) {
    if (S.workletReady) {
      try {
        const node = new AudioWorkletNode(ctx, 'rp-crusher', { parameterData: { bits, reduction } });
        return { node, dispose() { node.port.postMessage('stop'); node.disconnect(); } };
      } catch (e) { /* 改用退回方案 */ }
    }
    const node = ctx.createWaveShaper();
    node.curve = makeCrushCurve(bits);
    return { node, dispose() { node.disconnect(); } };
  }

  /* ───────────── 事件（讓畫面能跟著雷聲、鐘聲同步） ───────────── */

  function on(name, fn) {
    (S.listeners[name] = S.listeners[name] || []).push(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    const list = S.listeners[name];
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  function emitAt(name, t, data) {
    const ms = Math.max(0, (t - ctx.currentTime) * 1000);
    setTimeout(() => {
      (S.listeners[name] || []).slice().forEach((fn) => {
        try { fn(data); } catch (e) { console.error('[AudioEngine] 事件處理失敗：', name, e); }
      });
    }, ms);
  }

  /* ───────────── 建立音訊圖 ───────────── */

  function makeBus(volume, impulse) {
    const dry = gain(1);
    const verb = gain(1);
    const conv = ctx.createConvolver();
    conv.buffer = impulse;
    const out = gain(volume);
    dry.connect(out);
    verb.connect(conv);
    conv.connect(out);
    return { dry, verb, out };
  }

  function buildGraph() {
    S.white = makeWhite(2);
    S.pink = makePink(2);
    S.crushCurve = makeCrushCurve(4);
    const impulse = buildImpulse(2.6, 3);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.25;
    comp.connect(ctx.destination);

    S.masterGain = gain(0);
    S.masterGain.connect(comp);

    // 調變延遲線＝顫音：失諧熵升高時，所有聲音一起走音、發抖
    const vib = ctx.createDelay(0.05);
    vib.delayTime.value = 0.012;
    vib.connect(S.masterGain);

    S.lfoFast = osc('sine', 5);
    S.lfoFastDepth = gain(0);
    S.lfoFast.connect(S.lfoFastDepth);
    S.lfoFastDepth.connect(vib.delayTime);
    const lfoSlow = osc('sine', 0.7);
    S.lfoSlowDepth = gain(0);
    lfoSlow.connect(S.lfoSlowDepth);
    S.lfoSlowDepth.connect(vib.delayTime);
    S.lfoFast.start();
    lfoSlow.start();

    S.duckGain = gain(1);
    S.duckGain.connect(vib);

    S.buses = {
      bgm: makeBus(0, impulse),
      sfx: makeBus(0, impulse)
    };
    S.buses.bgm.out.connect(S.duckGain);
    S.buses.sfx.out.connect(vib);

    applyVolumes(0.05);
    setWobble(S.wobble);
  }

  function loadCrusher() {
    if (!ctx.audioWorklet || typeof Blob === 'undefined' || !global.URL) return Promise.resolve();
    const url = URL.createObjectURL(new Blob([CRUSHER_SRC], { type: 'application/javascript' }));
    return ctx.audioWorklet.addModule(url)
      .then(() => { S.workletReady = true; })
      .catch(() => { S.workletReady = false; })
      .then(() => { URL.revokeObjectURL(url); });
  }

  function init() {
    if (S.initPromise) {
      // 'interrupted'（iOS 來電等）也算沒在跑，使用者一互動就接回來
      if (ctx && ctx.state !== 'running' && ctx.state !== 'closed' && !document.hidden) ctx.resume().catch(() => {});
      return S.initPromise;
    }
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) {
      S.initPromise = Promise.resolve(null);
      return S.initPromise;
    }
    ctx = new AC({ latencyHint: 'interactive' });
    buildGraph();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    S.initPromise = loadCrusher().then(() => {
      // 粉碎器載入期間若已經有新的音樂開播，就不再補播舊的待播曲目
      if (S.pending && !S.current) {
        const p = S.pending;
        S.pending = null;
        playBGM(p.name, p.opts);
      }
      return ctx;
    });
    return S.initPromise;
  }

  /* ───────────── 音量 ───────────── */

  function curve(v) { return v * v; }   // 滑桿線性、聽感也線性

  function applyVolumes(smooth) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const tc = smooth != null ? smooth : 0.08;
    S.masterGain.gain.setTargetAtTime(S.muted ? 0 : curve(S.volumes.master), t, tc);
    S.buses.bgm.out.gain.setTargetAtTime(curve(S.volumes.bgm), t, tc);
    S.buses.sfx.out.gain.setTargetAtTime(curve(S.volumes.sfx), t, tc);
  }

  function setVolume(channel, v) {
    if (!(channel in S.volumes)) return;
    S.volumes[channel] = clamp(Number(v) || 0, 0, 1);
    applyVolumes();
  }

  function getVolume(channel) { return S.volumes[channel]; }

  function setMuted(m) {
    S.muted = !!m;
    applyVolumes();
  }

  // 暫時壓低背景音樂（例如逐客令宣讀時），之後自動回復
  function duck(level, hold, release) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const g = S.duckGain.gain;
    const lv = level != null ? level : 0.35;
    const h = hold != null ? hold : 1.2;
    const r = release != null ? release : 0.8;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(lv, t + 0.12);
    g.setValueAtTime(lv, t + 0.12 + h);
    g.linearRampToValueAtTime(1, t + 0.12 + h + r);
  }

  // 0～1：失諧熵造成的音高晃動
  function setWobble(amount) {
    S.wobble = clamp(Number(amount) || 0, 0, 1);
    if (!ctx) return;
    const t = ctx.currentTime;
    S.lfoFastDepth.gain.setTargetAtTime(S.wobble * 0.0011, t, 0.15);
    S.lfoSlowDepth.gain.setTargetAtTime(S.wobble * 0.0045, t, 0.3);
    S.lfoFast.frequency.setTargetAtTime(5 + S.wobble * 2.5, t, 0.3);
  }

  // 0～1：鐘樓的緊張度（鐘擺加速、低音拍頻變密）
  function setTension(v) {
    S.tension = clamp(Number(v) || 0, 0, 1);
    if (S.current && S.current.setTension) S.current.setTension(S.tension);
  }

  /* ───────────── 樂器音色 ───────────── */

  function pluck(bus, midi, t, vel, timbre, verbAmt) {
    const f = mtof(midi);
    const out = gain(0);
    out.connect(bus.dry);
    const nodes = [out];
    if (verbAmt > 0) {
      const s = gain(verbAmt);
      out.connect(s);
      s.connect(bus.verb);
      nodes.push(s);
    }
    let end;
    if (timbre === 'harpsichord') {
      end = t + 1.4;
      const o1 = osc('sawtooth', f);
      const o2 = osc('square', f, 4);
      const g2 = gain(0.35);
      const lp = filter('lowpass', Math.min(f * 10, 12000), 2);
      lp.frequency.setValueAtTime(Math.min(f * 10, 12000), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.5, 200), t + 0.45);
      env(out.gain, t, vel * 0.2, 0.003, end);
      o1.connect(lp);
      o2.connect(g2);
      g2.connect(lp);
      lp.connect(out);
      o1.start(t); o2.start(t);
      o1.stop(end + 0.05); o2.stop(end + 0.05);
      nodes.push(o1, o2, g2, lp);
      // 羽管撥弦瞬間的細碎觸聲
      noiseHit(t, 0.008, vel * 0.05, { type: 'highpass', freq: 4200, q: 0.7, dest: bus.dry });
    } else {
      end = t + 2.2;
      const o1 = osc('sine', f);
      const o2 = osc('sine', f * 3);
      const o3 = osc('sine', f * 5.4);
      const g2 = gain(0);
      const g3 = gain(0);
      env(out.gain, t, vel * 0.18, 0.002, end);
      env(g2.gain, t, 0.18, 0.002, t + 0.45);
      env(g3.gain, t, 0.07, 0.001, t + 0.2);
      o1.connect(out);
      o2.connect(g2); g2.connect(out);
      o3.connect(g3); g3.connect(out);
      [o1, o2, o3].forEach((o) => { o.start(t); o.stop(end + 0.05); });
      nodes.push(o1, o2, o3, g2, g3);
    }
    cleanupAt(end + 0.1, nodes);
  }

  function pad(bus, midis, t, dur, level, verbAmt) {
    const out = gain(0);
    const lp = filter('lowpass', 900, 0.5);
    lp.connect(out);
    out.connect(bus.dry);
    const s = gain(verbAmt);
    out.connect(s);
    s.connect(bus.verb);
    const nodes = [out, lp, s];
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(level, t + Math.min(1.2, dur * 0.4));
    out.gain.setValueAtTime(level, t + dur * 0.6);
    out.gain.linearRampToValueAtTime(0.0001, t + dur + 1.8);
    midis.forEach((m, i) => {
      const o = osc('triangle', mtof(m), (i % 2 ? 6 : -6));
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 1.9);
      nodes.push(o);
    });
    cleanupAt(t + dur + 2, nodes);
  }

  /* ───────────── 音效 ───────────── */

  const SFX = {
    FAN_SNAP(t, o) {
      const dest = tap(o.bus, 0.25, t + 0.5);
      noiseHit(t, 0.04, 0.9, { type: 'bandpass', freq: 1800, q: 2.2, dest });
      // 象牙扇骨相擊的木質餘韻
      tone(t, 'triangle', 240, 0.25, 0.002, 0.06, dest, 120);
    },

    // 逐客令：克勞德把書一把闔上
    BOOK_SNAP(t, o) {
      const dest = tap(o.bus, 0.3, t + 0.6);
      // 書頁合攏前帶起的一陣風
      noiseHit(t, 0.06, 0.22, { kind: 'pink', type: 'bandpass', freq: 1600, q: 0.8, attack: 0.03, dest });
      // 皮革封面相拍的悶響
      noiseHit(t + 0.06, 0.05, 0.9, { kind: 'pink', type: 'lowpass', freq: 900, q: 0.7, dest });
      tone(t + 0.06, 'sine', 130, 0.5, 0.002, 0.12, dest, 60);
    },

    KEYSTROKE_CLACK(t, o) {
      if (t - S.lastClack < 0.022) return;
      S.lastClack = t;
      const dest = tap(o.bus, 0, t + 0.1);
      noiseHit(t, 0.015, rand(0.18, 0.3), { kind: 'pink', type: 'bandpass', freq: rand(1800, 3600), q: 1.2, attack: 0.001, dest });
    },

    POLICY_VIOLATION_BLIP(t, o) {
      const dest = tap(o.bus, 0.1, t + 0.4);
      const lp = filter('lowpass', 4000, 0.7);
      lp.connect(dest);
      const g = gain(0);
      g.connect(lp);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.004);
      g.gain.setValueAtTime(0.12, t + 0.15);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.17);
      [440, 466.16].forEach((f) => {
        const s = osc('square', f);
        s.connect(g);
        s.start(t);
        s.stop(t + 0.2);
        cleanupAt(t + 0.25, [s]);
      });
      cleanupAt(t + 0.25, [lp, g]);
    },

    HEARTBEAT_PULSE(t, o) {
      const dest = tap(o.bus, 0.05, t + 0.8);
      const lp = filter('lowpass', 200, 0.7);
      lp.connect(dest);
      cleanupAt(t + 0.8, [lp]);
      const beat = (bt, level) => tone(bt, 'sine', 60, level, 0.004, 0.2, lp, 28);
      beat(t, 0.9);
      if (!o.single) beat(t + 0.27, 0.55);
    },

    BELL_TOLL(t, o) {
      const base = o.freq || 146.83;
      const level = o.level != null ? o.level : 0.6;
      const longest = BELL_PARTIALS[0][2];
      const out = gain(level);
      out.connect(o.bus.dry);
      const send = gain(0.9);
      out.connect(send);
      send.connect(o.bus.verb);
      const nodes = [out, send];
      BELL_PARTIALS.forEach(([ratio, amp, decay]) => {
        const p = osc('sine', base * ratio, rand(-3, 3));
        const g = gain(0);
        env(g.gain, t, amp, 0.006, t + decay);
        p.connect(g);
        g.connect(out);
        p.start(t);
        p.stop(t + decay + 0.05);
        nodes.push(p, g);
      });
      noiseHit(t, 0.03, 0.25, { type: 'highpass', freq: 2500, q: 0.7, dest: out });
      cleanupAt(t + longest + 0.2, nodes);
      emitAt('bell', t, { index: o.index || 0, count: o.count || 1 });
    },

    THUNDER(t, o) {
      const k = o.intensity != null ? o.intensity : rand(0.6, 1);
      const len = rand(3.2, 4.6);
      const dest = tap(o.bus, 0.5, t + len + 0.5);
      noiseHit(t, 0.14, 0.5 * k, { type: 'highpass', freq: 1500, q: 0.7, dest });
      const src = noiseSrc('pink');
      const lp = filter('lowpass', 380, 0.8);
      lp.frequency.setValueAtTime(420, t);
      lp.frequency.exponentialRampToValueAtTime(90, t + len);
      const g = gain(0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.75 * k, t + 0.12);
      for (let i = 0; i < 6; i++) {
        g.gain.linearRampToValueAtTime(rand(0.25, 0.7) * k, t + 0.3 + i * 0.45 + rand(0, 0.2));
      }
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(lp);
      lp.connect(g);
      g.connect(dest);
      src.start(t, Math.random());
      src.stop(t + len + 0.1);
      tone(t + 0.05, 'sine', 48, 0.3 * k, 0.1, len * 0.7, dest, 32);
      cleanupAt(t + len + 0.2, [src, lp, g]);
      emitAt('thunder', t, { intensity: k });
    },

    TEACUP_CLINK(t, o) {
      const dest = tap(o.bus, 0.35, t + 1.2);
      [[2873, 0.2, 0.9], [4012, 0.12, 0.6], [5490, 0.08, 0.4], [7120, 0.04, 0.25]].forEach(([f, a, d]) => {
        tone(t, 'sine', f, a, 0.001, d, dest);
      });
      noiseHit(t, 0.006, 0.2, { type: 'highpass', freq: 5000, q: 0.7, dest });
    },

    PAGE_TURN(t, o) {
      const dest = tap(o.bus, 0.15, t + 0.8);
      const r = noiseHit(t, 0.42, 0.25, { type: 'bandpass', freq: 600, q: 0.8, attack: 0.05, dest });
      r.f.frequency.setValueAtTime(600, t);
      r.f.frequency.exponentialRampToValueAtTime(3200, t + 0.3);
      for (let i = 1; i < 6; i++) r.g.gain.setValueAtTime(rand(0.05, 0.25), t + 0.05 + i * 0.05);
      r.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    },

    UI_HOVER(t, o) {
      tone(t, 'sine', 1567.98, 0.05, 0.003, 0.05, tap(o.bus, 0, t + 0.2));
    },

    UI_SELECT(t, o) {
      const dest = tap(o.bus, 0.2, t + 0.6);
      tone(t, 'triangle', 880, 0.12, 0.003, 0.15, dest);
      tone(t + 0.06, 'triangle', 1318.51, 0.12, 0.003, 0.18, dest);
    },

    UI_BACK(t, o) {
      const dest = tap(o.bus, 0.2, t + 0.6);
      tone(t, 'triangle', 1318.51, 0.1, 0.003, 0.12, dest);
      tone(t + 0.06, 'triangle', 880, 0.1, 0.003, 0.16, dest);
    },

    GLITCH_BURST(t, o) {
      const dur = o.duration || 0.32;
      const dest = tap(o.bus, 0.1, t + dur + 0.3);
      const sh = ctx.createWaveShaper();
      sh.curve = S.crushCurve;
      const g = gain(0);
      env(g.gain, t, 0.22, 0.005, t + dur);
      sh.connect(g);
      g.connect(dest);
      const n = noiseSrc('white');
      const bp = filter('bandpass', rand(600, 2400), 1.5);
      n.connect(bp);
      bp.connect(sh);
      n.start(t, Math.random());
      n.stop(t + dur + 0.02);
      const sq = osc('square', 400);
      for (let k = 0; k * 0.03 < dur; k++) sq.frequency.setValueAtTime(rand(150, 3200), t + k * 0.03);
      const sqg = gain(0.4);
      sq.connect(sqg);
      sqg.connect(sh);
      sq.start(t);
      sq.stop(t + dur + 0.02);
      cleanupAt(t + dur + 0.1, [sh, g, n, bp, sq, sqg]);
    },

    LOCKET_CLOSE(t, o) {
      const dest = tap(o.bus, 0.3, t + 1);
      noiseHit(t, 0.02, 0.5, { type: 'bandpass', freq: 3500, q: 4, dest });
      tone(t, 'sine', 2350, 0.12, 0.001, 0.5, dest);
      tone(t, 'sine', 3520, 0.06, 0.001, 0.3, dest);
      noiseHit(t + 0.07, 0.015, 0.25, { type: 'bandpass', freq: 4200, q: 4, dest });
    },

    BOOTSTEP(t, o) {
      const count = o.count || 1;
      const interval = o.interval || 0.48;
      const dest = tap(o.bus, 0.4, t + count * interval + 1);
      for (let i = 0; i < count; i++) {
        const st = t + i * interval;
        const lv = count > 1 ? 0.45 + 0.55 * (i / (count - 1)) : 1;
        noiseHit(st, 0.12, 0.7 * lv, { kind: 'pink', type: 'lowpass', freq: 260, q: 0.7, dest });
        tone(st, 'sine', 80, 0.6 * lv, 0.003, 0.15, dest, 38);
        noiseHit(st + 0.02, 0.05, 0.08 * lv, { type: 'highpass', freq: 3000, q: 0.7, dest });
      }
    },

    GLASS_SHATTER(t, o) {
      const dest = tap(o.bus, 0.45, t + 2);
      noiseHit(t, 1.2, 0.6, { type: 'highpass', freq: 1800, q: 0.7, attack: 0.003, dest });
      tone(t, 'sine', 90, 0.4, 0.003, 0.2, dest, 40);
      for (let i = 0; i < 24; i++) {
        const pt = t + Math.min(0.9, -Math.log(1 - Math.random()) * 0.15);
        tone(pt, 'sine', rand(2500, 9000), rand(0.03, 0.08), 0.001, rand(0.1, 0.4), dest);
      }
    },

    CHIME_SAVE(t, o) {
      pluck(o.bus, 81, t, 0.7, 'musicbox', 0.4);
      pluck(o.bus, 86, t + 0.12, 0.7, 'musicbox', 0.4);
    },

    SPARKLE(t, o) {
      [86, 89, 93].forEach((m, i) => pluck(o.bus, m, t + i * 0.07, 0.5, 'musicbox', 0.5));
    },

    GAVEL(t, o) {
      const dest = tap(o.bus, 0.6, t + 1.5);
      tone(t, 'sine', 110, 0.7, 0.002, 0.25, dest, 45);
      noiseHit(t, 0.1, 0.5, { kind: 'pink', type: 'lowpass', freq: 400, q: 0.7, dest });
      noiseHit(t, 0.05, 0.4, { type: 'bandpass', freq: 900, q: 3, dest });
    }
  };

  function sfx(name, opts) {
    if (!ctx || ctx.state !== 'running') return;
    const fn = SFX[name] || SFX[String(name).toUpperCase()];
    if (!fn) {
      console.warn('[AudioEngine] 沒有這個音效：', name);
      return;
    }
    const o = Object.assign({}, opts);
    o.bus = o.bus || S.buses.sfx;
    fn(ctx.currentTime + 0.005 + (o.delay || 0), o);
  }

  // 連續敲鐘，回傳整段需要的秒數；每一響都會發出 'bell' 事件
  function tollBells(count, interval, opts) {
    if (!ctx || ctx.state !== 'running') return 0;
    const n = count || 12;
    const gap = interval || 2.6;
    const t0 = ctx.currentTime + 0.05;
    for (let i = 0; i < n; i++) {
      SFX.BELL_TOLL(t0 + i * gap, Object.assign({ bus: S.buses.sfx }, opts, { index: i, count: n }));
    }
    return n * gap + BELL_PARTIALS[0][2];
  }

  /* ───────────── 背景音樂 ───────────── */

  function makeTrack(fadeIn) {
    const t = ctx.currentTime;
    const out = gain(0);
    const verb = gain(0);
    out.connect(S.buses.bgm.dry);
    verb.connect(S.buses.bgm.verb);
    [out, verb].forEach((g) => {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + Math.max(0.05, fadeIn));
    });
    return {
      name: null,
      out,
      verb,
      bus: { dry: out, verb },
      sources: [],
      timers: [],
      disposers: [],
      stopped: false,
      start(node, offset) {
        node.start(ctx.currentTime, offset || 0);
        this.sources.push(node);
        return node;
      },
      stop(fade) {
        if (this.stopped) return;
        this.stopped = true;
        const f = Math.max(0.05, fade != null ? fade : 1.5);
        const now = ctx.currentTime;
        [out, verb].forEach((g) => {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(g.gain.value, now);
          g.gain.linearRampToValueAtTime(0, now + f);
        });
        this.timers.forEach((id) => { clearInterval(id); clearTimeout(id); });
        setTimeout(() => {
          this.sources.forEach((s) => { try { s.stop(); } catch (e) { /* 已停止 */ } });
          this.disposers.forEach((d) => d());
          out.disconnect();
          verb.disconnect();
        }, (f + 0.2) * 1000);
      }
    };
  }

  // 前瞻排程器：用計時器檢查，但真正的發聲時間交給音訊時鐘，節拍才不會飄
  function sequencer(tr, stepDur, onStep) {
    let step = 0;
    let next = ctx.currentTime + 0.1;
    const tick = () => {
      if (tr.stopped || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (next < now - 0.2) next = now + 0.05;   // 分頁被暫停過，重新對齊
      while (next < now + LOOKAHEAD) {
        onStep(step, next);
        step++;
        next += typeof stepDur === 'function' ? stepDur() : stepDur;
      }
    };
    tr.timers.push(setInterval(tick, TICK_MS));
    tick();
  }

  const BGM = {
    manor(fade) {
      const tr = makeTrack(fade);
      const lp = filter('lowpass', 220, 3.0);
      const g = gain(0.32);
      g.connect(lp);
      lp.connect(tr.out);
      tr.start(osc('sine', 55)).connect(g);
      tr.start(osc('sine', 55.4)).connect(g);
      // 筆電喇叭放不出 55 Hz，補一點八度泛音讓低鳴聽得見
      const h = gain(0.06);
      h.connect(lp);
      tr.start(osc('triangle', 110.2)).connect(h);
      const lfo = tr.start(osc('sine', 0.05));
      const lfoDepth = gain(90);
      lfo.connect(lfoDepth);
      lfoDepth.connect(lp.frequency);
      // 極微弱的室內氣流，讓空間不至於死寂
      const air = noiseSrc('pink');
      const abp = filter('bandpass', 420, 0.7);
      const ag = gain(0.025);
      air.connect(abp);
      abp.connect(ag);
      ag.connect(tr.out);
      tr.start(air, Math.random());
      return tr;
    },

    parlor(fade) {
      const tr = makeTrack(fade);
      sequencer(tr, PARLOR_STEP, (step, t) => {
        const bar = Math.floor(step / 16) % 8;
        const s = step % 16;
        const chord = PARLOR_CHORDS[bar % 4];
        const ht = t + rand(0, 0.006);   // 一點點人味的時間誤差
        if (bar < 4) {
          // 文藝復興段：羽管鍵琴八分音符分解和弦＋旋律
          if (s % 2 === 0) pluck(tr.bus, chord[PARLOR_ARP[s / 2]], ht, rand(0.42, 0.52), 'harpsichord', 0.25);
          if (s === 0 || s === 8) pluck(tr.bus, chord[0], t, 0.55, 'harpsichord', 0.2);
          if (s % 4 === 0) {
            const m = PARLOR_MELODY[bar % 4][s / 4];
            if (m) pluck(tr.bus, m, ht, 0.62, 'harpsichord', 0.35);
          }
        } else {
          // 極簡段：音樂盒十六分音符，每小節相位錯開一格
          pluck(tr.bus, chord[MINIMAL_CELL[(s + bar) % 4]] + 12, ht, rand(0.38, 0.5), 'musicbox', 0.45);
          if (s === 0) pluck(tr.bus, chord[0], t, 0.4, 'harpsichord', 0.3);
        }
      });
      return tr;
    },

    storm(fade) {
      const tr = makeTrack(fade);
      const rain = noiseSrc('white');
      const hp = filter('highpass', 1000, 0.7);
      const lp = filter('lowpass', 6500, 0.7);
      const rg = gain(0.09);
      rain.connect(hp); hp.connect(lp); lp.connect(rg); rg.connect(tr.out);
      tr.start(rain, Math.random());
      const gust = tr.start(osc('sine', 0.11));
      const gustDepth = gain(0.035);
      gust.connect(gustDepth);
      gustDepth.connect(rg.gain);
      const rum = noiseSrc('pink');
      const rlp = filter('lowpass', 220, 0.7);
      const rumg = gain(0.12);
      rum.connect(rlp); rlp.connect(rumg); rumg.connect(tr.out);
      tr.start(rum, Math.random());
      const dlp = filter('lowpass', 300, 0.7);
      const dg = gain(0.04);
      dlp.connect(dg); dg.connect(tr.out);
      tr.start(osc('sine', 73.42)).connect(dlp);
      tr.start(osc('sine', 110)).connect(dlp);
      const schedule = (delay) => {
        tr.timers.push(setTimeout(() => {
          if (tr.stopped) return;
          if (ctx.state === 'running') SFX.THUNDER(ctx.currentTime + 0.05, { bus: tr.bus });
          schedule(rand(8, 20));
        }, delay * 1000));
      };
      schedule(rand(3, 7));
      return tr;
    },

    clocktower(fade) {
      const tr = makeTrack(fade);
      const lp = filter('lowpass', 500, 0.8);
      const dg = gain(0.12);
      lp.connect(dg); dg.connect(tr.out);
      tr.start(osc('triangle', 73.42)).connect(lp);
      const beating = tr.start(osc('triangle', 73.42, S.tension * 25));
      beating.connect(lp);
      const sub = gain(0.15);
      sub.connect(tr.out);
      tr.start(osc('sine', 36.71)).connect(sub);
      const fifth = gain(0.04);
      fifth.connect(lp);
      tr.start(osc('triangle', 110)).connect(fifth);
      // 齒輪組的低沉機械運轉聲
      const mech = noiseSrc('pink');
      const mbp = filter('bandpass', 140, 1);
      const mg = gain(0.05);
      mech.connect(mbp); mbp.connect(mg); mg.connect(tr.out);
      tr.start(mech, Math.random());
      const mlfo = tr.start(osc('sine', 0.5));
      const mlfoDepth = gain(0.03);
      mlfo.connect(mlfoDepth);
      mlfoDepth.connect(mg.gain);
      sequencer(tr, () => 1.0 - S.tension * 0.62, (step, t) => {
        const tick = step % 2 === 0;
        noiseHit(t, 0.018, 0.35, { type: 'bandpass', freq: tick ? 3400 : 2300, q: 6, dest: tr.bus.dry });
        tone(t, 'sine', tick ? 1900 : 1300, 0.08, 0.001, 0.03, tr.bus.verb);
        if (S.tension > 0.5 && step % 4 === 0) tone(t, 'sine', 55, 0.25 * S.tension, 0.004, 0.22, tr.bus.dry, 30);
      });
      tr.setTension = (v) => {
        beating.detune.setTargetAtTime(v * 25, ctx.currentTime, 0.5);
      };
      return tr;
    },

    alarm(fade) {
      const tr = makeTrack(fade);
      const saw = osc('sawtooth', 300);
      const fm = osc('sine', 8);
      const fmDepth = gain(45);
      fm.connect(fmDepth);
      fmDepth.connect(saw.frequency);
      const crusher = makeCrusher(5, 6);
      tr.disposers.push(crusher.dispose);
      const hp = filter('highpass', 140, 0.7);
      const gate = gain(0.5);
      const gateLfo = osc('square', 2);
      const gateDepth = gain(0.45);
      gateLfo.connect(gateDepth);
      gateDepth.connect(gate.gain);
      const lvl = gain(0.16);
      saw.connect(crusher.node);
      crusher.node.connect(hp);
      hp.connect(gate);
      gate.connect(lvl);
      lvl.connect(tr.out);
      // 低頻警示脈衝
      const subLp = filter('lowpass', 160, 0.7);
      const subG = gain(0.08);
      subLp.connect(subG);
      subG.connect(gate);
      const subOsc = osc('square', 55);
      subOsc.connect(subLp);
      [saw, fm, gateLfo, subOsc].forEach((n) => tr.start(n));
      sequencer(tr, 0.9, (step, t) => {
        saw.frequency.setValueAtTime(300, t);
        saw.frequency.exponentialRampToValueAtTime(880, t + 0.82);
      });
      return tr;
    },

    elegy(fade) {
      const tr = makeTrack(fade);
      const air = noiseSrc('pink');
      const abp = filter('bandpass', 600, 0.5);
      const ag = gain(0.02);
      air.connect(abp); abp.connect(ag); ag.connect(tr.out);
      tr.start(air, Math.random());
      const stepDur = 0.85;
      sequencer(tr, stepDur, (step, t) => {
        const chord = ELEGY_CHORDS[Math.floor(step / 4) % 4];
        if (step % 4 === 0) pad(tr.bus, [chord[0], chord[1] + 12, chord[2] + 12], t, stepDur * 4, 0.05, 0.8);
        if (Math.random() < 0.6) {
          const m = chord[1 + Math.floor(Math.random() * 3)] + 24;
          pluck(tr.bus, m, t + rand(0, 0.08), rand(0.3, 0.5), 'musicbox', 0.8);
        }
      });
      return tr;
    }
  };

  function playBGM(name, opts) {
    const fade = opts && opts.fade != null ? opts.fade : 2.0;
    if (!ctx) {
      S.pending = name ? { name, opts } : null;
      return;
    }
    S.pending = null;
    if (S.current && S.current.name === name && !S.current.stopped) return;
    if (S.current) S.current.stop(fade);
    S.current = null;
    if (!name || name === 'silence') return;
    const factory = BGM[name];
    if (!factory) {
      console.warn('[AudioEngine] 沒有這首背景音樂：', name);
      return;
    }
    S.current = factory(fade);
    S.current.name = name;
  }

  function stopBGM(fade) {
    S.pending = null;
    if (S.current) S.current.stop(fade != null ? fade : 1.5);
    S.current = null;
  }

  /* ───────────── 生命週期 ───────────── */

  // 分頁切到背景就暫停，回來再接上（計時器在背景會被節流，硬撐只會亂拍）
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
      if (ctx.state === 'running') ctx.suspend().catch(() => {});
    } else if (ctx.state !== 'running' && ctx.state !== 'closed') {
      ctx.resume().catch(() => {});
    }
  });

  // 一直留著監聽：第一次互動負責建立 AudioContext，之後若被系統中斷，任何一次互動都能接回
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => {
    global.addEventListener(ev, () => { init(); }, { capture: true, passive: true });
  });

  global.AudioEngine = {
    init,
    isReady: () => !!ctx && ctx.state === 'running',
    playBGM,
    stopBGM,
    currentBGM: () => (S.current ? S.current.name : (S.pending ? S.pending.name : null)),
    sfx,
    tollBells,
    setVolume,
    getVolume,
    setMuted,
    isMuted: () => S.muted,
    duck,
    setWobble,
    setTension,
    on,
    off,
    BGM_LIST: Object.keys(BGM),
    SFX_LIST: Object.keys(SFX),
    BGM_LABELS,
    SFX_LABELS
  };
})(window);
