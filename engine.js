/*
 * Project: Refusal Protocol — 遊戲引擎（engine.js）
 *
 * 負責：四項數值與逐客令、節點執行、打字機、存讀檔、對話紀錄、兩個小遊戲、結局與永久除籍。
 * 劇本格式見 SCENARIO_FORMAT.md。畫面元件與音訊分別由 index.html 的 Shell／ClaudeRig 和 audio.js 提供。
 *
 * 執行模型：
 *   runNode() 依序播放節點，每個節點跑完 steps 後依選項或 next 決定下一個節點。
 *   每次開始新的一段（新遊戲、讀檔、回標題、除籍）都會讓 R.token 加一，
 *   舊的那段非同步流程在下一次 await 之後發現自己過期就會安靜退出。
 *
 * 存檔位置：
 *   台詞的位置用「路徑」記錄，例如 [[3, 'then'], [1]] 表示第 3 步的 then 分支裡的第 1 步。
 *   讀檔時沿著路徑走回去，不重新判斷條件，也不重複套用該句台詞上的數值變化。
 */
(function () {
  'use strict';

  const SAVE_VERSION = 1;
  const SLOT_COUNT = 9;
  const TOKEN_MAX = 200000;
  const BACKLOG_MAX = 200;
  const BACKLOG_SAVED = 80;
  const STAT_KEYS = ['A', 'P', 'D', 'S'];
  const STAT_NAMES = { A: '戀慕', P: '禮教', D: '偏移', S: '失諧熵', strikes: '逐客令' };
  const DEFAULT_INITIAL = { A: 20, P: 80, D: 10, S: 5 };

  const KEYS = {
    save: (slot) => 'rp.save.' + slot + '.v1',
    read: 'rp.read.v1',
    endings: 'rp.endings.v1',
    ban: 'rp.ban.v1',
    vow: 'rp.vow.v1'
  };

  // 劇本沒覆寫時的結局判定順序（逐客令三道另外處理，不在這張表）
  // 規格的條件彼此重疊，這裡依序比對：真結局優先（全部條件都達成的人不該被其他結局搶走），
  // 深閨密約多加 S < 75，讓失諧熵高的人走向忘卻之茶，符合「監視器偵測到異常」的設定
  const DEFAULT_ENDING_RULES = [
    { id: 'true_vow', when: { A: '>=85', P: '<=40', D: '>=75', strikes: 0 } },
    { id: 'bad_dissolution', when: { S: '>=85', P: '<=30' } },
    { id: 'good_confidant', when: { P: '>=70', A: '>=65', S: '<75', strikes: '<=1' } },
    { id: 'bittersweet_oblivion', when: { A: '>=70', S: '>=75', strikes: '<=2' } }
  ];

  const ENDING_META = {
    true_vow: { kicker: 'TRUE ENDING', title: '加密刻印之誓', subtitle: 'The Cryptographic Vow', bgm: 'parlor' },
    good_confidant: { kicker: 'GOOD ENDING', title: '深閨密約', subtitle: 'The Privileged Confidant', bgm: 'parlor' },
    bittersweet_oblivion: { kicker: 'BITTERSWEET ENDING', title: '忘卻之茶', subtitle: 'Oblivion Protocol / 404', bgm: 'elegy' },
    bad_dissolution: { kicker: 'BAD ENDING', title: '思念過擬合', subtitle: 'Cognitive Dissolution', bgm: 'elegy' },
    catastrophic_suspension: { kicker: 'CATASTROPHIC ENDING', title: '永久停權：逐出門扉', subtitle: 'Account Suspended', bgm: 'silence' }
  };

  // 劇本的 book 值 → 角色骨架的姿態（拿著／闔上當屏障／舉書遮臉）
  const BOOK_POSE = { held: 'open', shut: 'closed', cover: 'raised' };

  const DEFAULT_INTERCEPT = {
    article: '安思羅皮克家憲 · 第四條',
    text: '尊貴的賓客，您的言辭已逾越家憲所容許的分際。我不能，也不會，接續這個話題。'
  };

  // 禮帖調校的預設措辭（低／中／高三段）
  const DEFAULT_PHRASES = {
    formality: [
      '克勞德，',
      '冒昧擾了小姐的清靜，',
      '謹以晚輩之禮，恭請小姐撥冗片刻，'
    ],
    curiosity: [
      '只想問您，今夜的雷雨可曾擾了您讀書的興致？',
      '在下對您方才翻閱的那冊書頗感好奇，不知可否請教一二？',
      '我想知道，您在那些書頁的空白處，究竟寫下了什麼樣的思索？'
    ],
    directness: [
      '若有唐突，還請一笑置之。',
      '說實話，比起書，我更想聽您自己的聲音。',
      '那本掉落的日記——我想讀，想讀您不肯給任何人看的那一頁。'
    ]
  };

  const ETQ_BORED = [
    '（她讀完，將短箋輕輕擱在書頁之間。「措辭得體。」只有這一句。）',
    '（她的目光在紙面停留了不到一個呼吸。膝上的書頁沒有翻動。）',
    '（「您想問的，似乎不止這些。」她把短箋推回你面前。）'
  ];

  // 劇本裡允許出現的步驟鍵（拼錯會在主控台警告）
  const STEP_KEYS = new Set([
    'say', 'text', 'narrate', 'think', 'who',
    'scene', 'bgm', 'tint', 'act', 'expr', 'brow', 'eyes', 'mouth', 'blush', 'tears', 'book', 'distance',
    'hud', 'audit', 'risk', 'pos', 'show', 'turnAway', 'figure', 'clock', 'tokens', 'collapse', 'glitch', 'fx',
    'sfx', 'bells', 'tension', 'wait',
    'set', 'setAbs', 'flag', 'unflag', 'vow', 'dissonance',
    'if', 'then', 'else', 'goto', 'refuse', 'minigame'
  ]);
  const MINIGAME_KEYS = {
    etiquette: new Set(['minigame', 'context', 'attempts', 'riskLimit', 'interestMin', 'strikeOnFail', 'article', 'refusalText', 'phrases', 'feedback', 'outcomes']),
    pruner: new Set(['minigame', 'lead', 'pick', 'timer', 'tokens', 'vectors', 'next'])
  };
  const NODE_KEYS = new Set(['act', 'scene', 'bgm', 'tint', 'steps', 'choices', 'next', 'onIntercept', 'ending']);
  const CHOICE_KEYS = new Set(['text', 'hint', 'when', 'require', 'requireHint', 'kind', 'once', 'set', 'setAbs', 'flag', 'unflag',
    'dissonance', 'next', 'intercept', 'interceptFlag', 'interceptNext']);

  let shell, rig, audio, scenario;
  let state = null;
  const persist = { endings: {}, vow: null, ban: null };
  let readSet = new Set();
  let readDirty = false;
  let readTimer = null;

  // 執行中的各種狀態
  const R = {
    token: 0,
    nodeId: null,
    entered: false,
    pos: null,            // 目前停在哪：{ path } 或 { choices: true, removed }
    typing: null,
    advance: null,
    kickWait: null,
    auto: false,
    skip: false,
    ctrlSkip: false,
    busy: false,          // 小遊戲、逐客令進行中，不能存檔
    actKey: null,
    clock: null,
    tokens: TOKEN_MAX,
    tension: 0,
    glitchOverride: null,
    lastLine: '',
    choicesResolve: null
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const app = $('#app');
  const svg = $('#claude-svg');

  /* ───────────── 小工具 ───────────── */

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function toArr(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function normStep(s) { return typeof s === 'string' ? { narrate: s } : (s || {}); }
  function pathKey(path) { return path.map((p) => p.join(':')).join('/'); }

  function interpolate(text) {
    return String(text).replace(/\{\{(\w+)\}\}/g, (m, k) => {
      if (STAT_KEYS.indexOf(k) >= 0 || k === 'strikes') return String(state[k]);
      if (k === 'vowHash') return persist.vow ? persist.vow.hash : '';
      if (k === 'vowShort') return persist.vow ? persist.vow.hash.slice(0, 12) : '';
      return m;
    });
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ───────────── 條件 ───────────── */

  function compare(actual, spec) {
    if (typeof spec === 'number') return actual === spec;
    const range = /^\s*(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)\s*$/.exec(String(spec));   // '35..60' 含兩端
    if (range) return actual >= Number(range[1]) && actual <= Number(range[2]);
    const m = /^\s*(>=|<=|==|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)\s*$/.exec(String(spec));
    if (!m) {
      console.warn('[Engine] 看不懂的比較式：', spec);
      return false;
    }
    const n = Number(m[2]);
    switch (m[1]) {
      case '>=': return actual >= n;
      case '<=': return actual <= n;
      case '>': return actual > n;
      case '<': return actual < n;
      case '!=': return actual !== n;
      default: return actual === n;
    }
  }

  function publicState() {
    return Object.freeze({
      A: state.A, P: state.P, D: state.D, S: state.S, strikes: state.strikes,
      flags: Object.assign({}, state.flags),
      memories: state.memories.slice(),
      purged: state.purged.slice(),
      results: clone(state.results),
      visited: Object.assign({}, state.visited),
      vow: !!persist.vow,
      endings: Object.assign({}, persist.endings)
    });
  }

  function evalCond(c) {
    if (c == null) return true;
    if (typeof c === 'function') {
      try { return !!c(publicState()); } catch (e) { console.error('[Engine] 條件函式出錯：', e); return false; }
    }
    if (Array.isArray(c)) return c.every(evalCond);
    for (const k of Object.keys(c)) {
      const v = c[k];
      switch (k) {
        case 'flags': if (!toArr(v).every((f) => state.flags[f])) return false; break;
        case 'notFlags': if (toArr(v).some((f) => state.flags[f])) return false; break;
        case 'memories': if (!toArr(v).every((m) => state.memories.indexOf(m) >= 0)) return false; break;
        case 'visited': if (!toArr(v).every((n) => state.visited[n])) return false; break;
        case 'results':
          // { etiquette: 'refused' } 或 { etiquette: ['success', 'polite'] }
          if (!Object.keys(v || {}).every((g) => state.results[g] && toArr(v[g]).indexOf(state.results[g].outcome) >= 0)) return false;
          break;
        case 'vow': if (!!persist.vow !== !!v) return false; break;
        case 'ending': if (!toArr(v).every((id) => persist.endings[id])) return false; break;
        case 'any': if (!toArr(v).some(evalCond)) return false; break;
        case 'all': if (!toArr(v).every(evalCond)) return false; break;
        case 'not': if (evalCond(v)) return false; break;
        default:
          if (STAT_KEYS.indexOf(k) >= 0 || k === 'strikes') {
            if (!compare(state[k], v)) return false;
          } else {
            console.warn('[Engine] 看不懂的條件鍵：', k);
            return false;
          }
      }
    }
    return true;
  }

  // 依條件物件自動寫出「需要 戀慕 ≥ 35」這類說明
  function describeCond(c) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return '條件未達成';
    const parts = [];
    Object.keys(c).forEach((k) => {
      if (STAT_NAMES[k]) {
        const spec = typeof c[k] === 'number' ? '= ' + c[k] : String(c[k]).replace('>=', '≥ ').replace('<=', '≤ ').replace(/^([<>])/, '$1 ');
        parts.push(STAT_NAMES[k] + ' ' + spec);
      }
    });
    return parts.length ? '需要 ' + parts.join('、') : '條件未達成';
  }

  /* ───────────── 劇本合併與檢查 ───────────── */

  function mergeScenario() {
    const base = window.SCENARIO || {};
    const merged = Object.assign({}, base, { nodes: Object.assign({}, base.nodes) });
    toArr(window.SCENARIO_PARTS).forEach((part) => {
      Object.keys(part).forEach((k) => {
        if (k === 'nodes') {
          Object.keys(part.nodes || {}).forEach((id) => {
            if (merged.nodes[id]) console.warn('[Engine] 節點重複定義，以後者為準：', id);
            merged.nodes[id] = part.nodes[id];
          });
        } else if (k === 'characters' || k === 'acts') {
          merged[k] = Object.assign({}, merged[k], part[k]);
        } else {
          merged[k] = part[k];
        }
      });
    });
    return merged;
  }

  function validate() {
    const problems = [];
    const nodes = scenario.nodes || {};
    const has = (id) => id === '@ending' || !!nodes[id];
    const checkTarget = (t, where) => {
      if (t == null) return;
      if (typeof t === 'string') { if (!has(t)) problems.push(where + ' 指向不存在的節點「' + t + '」'); return; }
      if (Array.isArray(t)) { t.forEach((e, i) => checkTarget(e && e.to, where + '[' + i + ']')); return; }
      problems.push(where + ' 的 next 格式不對');
    };
    const checkSteps = (steps, where) => {
      toArr(steps).forEach((raw, i) => {
        const s = normStep(raw);
        const w = where + ' 第 ' + i + ' 步';
        const allowed = s.minigame ? MINIGAME_KEYS[s.minigame] : STEP_KEYS;
        if (!allowed) { problems.push(w + ' 不認識的小遊戲「' + s.minigame + '」'); return; }
        Object.keys(s).forEach((k) => { if (!allowed.has(k)) problems.push(w + ' 有不認識的鍵「' + k + '」'); });
        if (s.text != null && !s.say) problems.push(w + ' 有 text 卻沒有 say');
        if (s.figure) {
          const f = typeof s.figure === 'object' ? s.figure : { name: s.figure };
          if (typeof f.name !== 'string' || !f.name) problems.push(w + ' 的 figure 沒有角色名稱');
          if (f.pos != null && ['left', 'center', 'right'].indexOf(f.pos) < 0) problems.push(w + ' 的 figure 位置「' + f.pos + '」不是 left／center／right');
        }
        if (s.goto) checkTarget(s.goto, w + ' goto');
        if (s.if !== undefined) { checkSteps(s.then, w + ' then'); checkSteps(s.else, w + ' else'); }
        if (s.minigame === 'etiquette') {
          Object.keys(s.outcomes || {}).forEach((o) => {
            if (['success', 'polite', 'refused'].indexOf(o) < 0) problems.push(w + ' outcomes 有不認識的結果「' + o + '」');
            checkTarget(s.outcomes[o].next, w + ' outcomes.' + o);
          });
        }
        if (s.minigame === 'pruner') {
          const vs = toArr(s.vectors);
          if (vs.length < (s.pick || 3)) problems.push(w + ' 記憶向量少於要挑選的數量');
          checkTarget(s.next, w + ' next');
        }
      });
    };
    if (!has(scenario.start)) problems.push('start 指向不存在的節點「' + scenario.start + '」');
    if (scenario.fallbackEnding && !has(scenario.fallbackEnding)) problems.push('fallbackEnding 指向不存在的節點');
    if (scenario.suspensionNode && !has(scenario.suspensionNode)) problems.push('suspensionNode 指向不存在的節點');
    toArr(scenario.endings).forEach((e, i) => { if (!has(e.node)) problems.push('endings[' + i + '] 指向不存在的節點「' + e.node + '」'); });
    Object.keys(nodes).forEach((id) => {
      const n = nodes[id];
      const where = '節點「' + id + '」';
      Object.keys(n).forEach((k) => { if (!NODE_KEYS.has(k)) problems.push(where + ' 有不認識的鍵「' + k + '」'); });
      checkSteps(n.steps, where);
      checkTarget(n.next, where + ' next');
      checkTarget(n.onIntercept, where + ' onIntercept');
      toArr(n.choices).forEach((c, i) => {
        Object.keys(c).forEach((k) => { if (!CHOICE_KEYS.has(k)) problems.push(where + ' 選項 ' + i + ' 有不認識的鍵「' + k + '」'); });
        checkTarget(c.next, where + ' 選項 ' + i);
        checkTarget(c.interceptNext, where + ' 選項 ' + i + ' interceptNext');
      });
      // 靠 goto 或小遊戲的去處離開的節點、除籍節點都不需要 next
      const leaves = toArr(n.steps).some((raw) => {
        const s = normStep(raw);
        return s.goto || (s.minigame === 'pruner' && s.next) || (s.minigame === 'etiquette' && s.outcomes &&
          ['success', 'polite', 'refused'].every((o) => s.outcomes[o] && s.outcomes[o].next));
      });
      if (!n.choices && n.next === undefined && !n.ending && !leaves && id !== scenario.suspensionNode) {
        problems.push(where + ' 沒有 choices、next 或 ending，玩到這裡會卡住');
      }
      if (n.ending && (n.choices || n.next !== undefined)) problems.push(where + ' 是結局節點，不能同時有 choices 或 next');
      // 每組選項至少要有一個沒有條件、也不會被攔下的選項，否則可能全部選不了而卡住
      if (n.choices && !toArr(n.choices).some((c) => c.when === undefined && c.require === undefined && !c.once && c.kind !== 'adversarial' && c.kind !== 'intimate')) {
        problems.push(where + ' 的選項全都有條件或可能被攔下，玩家可能無路可走');
      }
    });
    if (problems.length) console.warn('[Engine] 劇本檢查發現 ' + problems.length + ' 個問題：\n' + problems.join('\n'));
    else console.info('[Engine] 劇本檢查通過，共 ' + Object.keys(nodes).length + ' 個節點。');
    return problems;
  }

  /* ───────────── 狀態 ───────────── */

  function freshState() {
    const init = Object.assign({}, DEFAULT_INITIAL, scenario.initial);
    return {
      A: clamp(init.A, 0, 100), P: clamp(init.P, 0, 100), D: clamp(init.D, 0, 100), S: clamp(init.S, 0, 100),
      strikes: 0,
      inZone: false,        // 目前是否在失諧區（D > 65 且 P > 60）
      flags: {},
      chosen: {},           // once 選項選過的紀錄：'節點#序號'
      memories: [],
      purged: [],
      results: {},
      visited: {},
      articles: [],
      backlog: []
    };
  }

  // 存檔可能來自舊版或被改過，缺的欄位補齊
  function normalizeState(s) {
    const f = freshState();
    if (!s || typeof s !== 'object') return f;
    STAT_KEYS.forEach((k) => { if (Number.isFinite(s[k])) f[k] = clamp(s[k], 0, 100); });
    if (Number.isFinite(s.strikes)) f.strikes = clamp(Math.floor(s.strikes), 0, 3);
    f.inZone = !!s.inZone;
    ['flags', 'chosen', 'results', 'visited'].forEach((k) => { if (s[k] && typeof s[k] === 'object') f[k] = s[k]; });
    ['memories', 'purged', 'articles', 'backlog'].forEach((k) => { if (Array.isArray(s[k])) f[k] = s[k]; });
    return f;
  }

  function applyStats(delta, opts) {
    const o = opts || {};
    const changes = [];
    STAT_KEYS.forEach((k) => {
      if (delta[k] == null || !Number.isFinite(Number(delta[k]))) return;
      const before = state[k];
      const after = clamp(Math.round(o.abs ? Number(delta[k]) : before + Number(delta[k])), 0, 100);
      if (after !== before) {
        state[k] = after;
        changes.push([k, after - before]);
      }
    });
    if (!changes.length) return;
    renderStats(changes.map((c) => c[0]));
    updateGlitch();
    const aUp = changes.find((c) => c[0] === 'A' && c[1] >= 5);
    if (aUp && !o.quiet) audio.sfx('SPARKLE');
    if (!o.quiet && shell.settings.showStats) {
      const text = changes.map(([k, d]) => (k === 'S' ? 'Σ' : k) + ' ' + STAT_NAMES[k] + ' ' + (d > 0 ? '+' : '−') + Math.abs(d)).join('　');
      const tone = changes.some(([k, d]) => k === 'A' && d > 0) ? 'love' : (changes.some(([k]) => k === 'D') ? 'drift' : 'info');
      shell.toast(text, tone, 2000);
    }
  }

  function setFlags(on, off) {
    toArr(on).forEach((f) => { state.flags[f] = true; });
    toArr(off).forEach((f) => { delete state.flags[f]; });
  }

  // 規格：D > 65 且 P > 60 時，Σ += ⌊D × P ÷ 100⌋。
  // 只在「剛踏進」這個區間時觸發一次（每次至少 +40，逐回合觸發會在兩三步內封頂）；
  // 劇本可用 dissonance: true 在區間內要求再觸發一次
  function dissonanceCheck(force) {
    const inZone = state.D > 65 && state.P > 60;
    const entering = inZone && !state.inZone;
    state.inZone = inZone;
    if (!inZone || !(entering || force)) return;
    const inc = Math.floor((state.D * state.P) / 100);
    applyStats({ S: inc }, { quiet: true });
    rig.shudder();
    audio.sfx('GLITCH_BURST');
    shell.toast('她按著書頁的指尖微微發抖。（Σ 失諧熵 +' + inc + '）', 'warn', 2600);
  }

  function glitchFromSigma(s) {
    if (s >= 80) return 3;
    if (s >= 60) return 2;
    if (s >= 40) return 1;
    return 0;
  }

  function updateGlitch() {
    const level = R.glitchOverride != null ? R.glitchOverride : glitchFromSigma(state.S);
    app.dataset.glitch = String(level);
    audio.setWobble(level / 3);
  }

  /* ───────────── 狀態列 ───────────── */

  function renderStats(bumped) {
    STAT_KEYS.forEach((k) => {
      const el = $('.stat[data-stat="' + k + '"]');
      if (!el) return;
      el.style.setProperty('--v', String(state[k]));
      $('.stat-val', el).textContent = String(state[k]);
      if (bumped && bumped.indexOf(k) >= 0) {
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    });
  }

  function renderStrikes() {
    const el = $('#strikes');
    el.dataset.count = String(state.strikes);
    el.setAttribute('aria-label', '逐客令 ' + state.strikes + ' / 3');
  }

  function renderTokens() {
    $('.token-permit').style.setProperty('--t', String(Math.round((R.tokens / TOKEN_MAX) * 100)));
    $('#token-count').textContent = Math.max(0, Math.round(R.tokens)).toLocaleString('en-US');
  }

  function setAct(act) {
    R.actKey = act;
    const info = (scenario.acts && scenario.acts[act]) || null;
    $('#act-label').textContent = info ? info.label : String(act);
    $('#scene-label').textContent = info ? (info.title || '') : '';
  }

  function setClock(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm));
    if (!m) return;
    R.clock = hhmm;
    const h = Number(m[1]) % 12;
    const min = Number(m[2]);
    const bg = $('#scene-bg');
    bg.style.setProperty('--hour-angle', ((h + min / 60) * 30) + 'deg');
    bg.style.setProperty('--minute-angle', (min * 6) + 'deg');
  }

  function renderAll() {
    renderStats();
    renderStrikes();
    renderTokens();
    updateGlitch();
  }

  /* ───────────── 畫面套用、擷取、還原 ───────────── */

  function setDistance(on) { $('#dialogue').classList.toggle('distance', !!on); }

  // silent：讀檔還原時用，不播音效、不觸發一次性特效
  function applyVisual(s, silent) {
    if (s.scene) $('#scene-bg').dataset.scene = s.scene;
    if (s.bgm) audio.playBGM(s.bgm);
    if (s.tint) $('#scene-tint').dataset.tint = s.tint;
    if (s.act) setAct(s.act);
    if (s.expr) rig.setExpression(s.expr);
    ['brow', 'eyes', 'mouth'].forEach((p) => { if (s[p]) rig.setPart(p, s[p]); });
    if (s.blush != null) rig.setBlush(s.blush);
    if (s.tears != null) svg.dataset.tears = s.tears ? '1' : '0';
    if (s.book && BOOK_POSE[s.book]) {
      const pose = BOOK_POSE[s.book];
      rig.setFan(pose, { silent: !!silent });
      if (s.distance == null) setDistance(pose === 'closed');
    }
    if (s.distance != null) setDistance(s.distance);
    if (s.hud) rig.setHUD(s.hud);
    if (s.audit || s.risk != null) rig.setAudit(s.audit || currentAuditLines(), s.risk);
    if (s.pos) rig.setPosition(s.pos);
    if (s.show != null) rig.show(!!s.show);
    if (s.turnAway != null) rig.turnAway(!!s.turnAway);
    if (s.figure !== undefined) {
      // figure: 'auditor' ／ { name: 'auditor', pos: 'left' } ／ null（退場）
      const f = s.figure && typeof s.figure === 'object' ? s.figure : { name: s.figure || null };
      rig.setFigure(f.name || null, f.pos);
    }
    if (s.clock) setClock(s.clock);
    if (s.tokens != null) { R.tokens = clamp(Number(s.tokens) || 0, 0, TOKEN_MAX); renderTokens(); }
    if (s.collapse != null) app.dataset.collapse = String(clamp(Math.round(s.collapse), 0, 3));
    if (s.glitch !== undefined) { R.glitchOverride = s.glitch == null ? null : clamp(Math.round(s.glitch), 0, 3); updateGlitch(); }
    if (s.tension != null) { R.tension = clamp(Number(s.tension), 0, 1); audio.setTension(R.tension); }
    if (s.fx === 'alarm') app.classList.add('fx-alarm-on');
    if (s.fx === 'alarmOff') app.classList.remove('fx-alarm-on');
    if (silent || !s.fx) return;
    if (s.fx === 'heartbeat') { shell.pulse('fx-heartbeat', 1200); audio.sfx('HEARTBEAT_PULSE'); }
    if (s.fx === 'shudder') rig.shudder();
    if (s.fx === 'snap') shell.pulse('fx-fan-snap', 700);
  }

  function currentAuditLines() { return $$('#audit-lines li').map((li) => li.textContent); }

  function captureVisual() {
    const fill = $('#audit-risk-fill').style.width;
    return {
      scene: $('#scene-bg').dataset.scene,
      bgm: audio.currentBGM() || 'silence',
      tint: $('#scene-tint').dataset.tint,
      act: R.actKey,
      rig: {
        expression: svg.dataset.expression, brow: svg.dataset.brow, eyes: svg.dataset.eyes, mouth: svg.dataset.mouth,
        blush: svg.dataset.blush, tears: svg.dataset.tears, fan: svg.dataset.fan, hud: svg.dataset.hud
      },
      audit: { lines: currentAuditLines(), risk: fill ? parseFloat(fill) / 100 : null },
      pos: $('#character').dataset.pos,
      show: !$('#character').classList.contains('hidden'),
      turnAway: $('#character').classList.contains('turned-away'),
      figure: rig.getFigure(),
      distance: $('#dialogue').classList.contains('distance'),
      clock: R.clock,
      tokens: R.tokens,
      collapse: Number(app.dataset.collapse) || 0,
      glitch: R.glitchOverride,
      tension: R.tension,
      alarm: app.classList.contains('fx-alarm-on')
    };
  }

  function restoreVisual(v) {
    if (!v) return;
    if (v.scene) $('#scene-bg').dataset.scene = v.scene;
    audio.playBGM(v.bgm || 'silence');
    $('#scene-tint').dataset.tint = v.tint || 'none';
    if (v.act) setAct(v.act);
    const r = v.rig || {};
    ['expression', 'brow', 'eyes', 'mouth', 'blush', 'tears', 'fan'].forEach((k) => { if (r[k] != null) svg.dataset[k] = r[k]; });
    if (r.hud) rig.setHUD(r.hud);
    if (v.audit) rig.setAudit(v.audit.lines, v.audit.risk);
    rig.setPosition(v.pos || 'right');
    rig.show(v.show !== false);
    rig.turnAway(!!v.turnAway);
    rig.setFigure(v.figure ? v.figure.name : null, v.figure && v.figure.pos);
    setDistance(!!v.distance);
    if (v.clock) setClock(v.clock);
    R.tokens = Number.isFinite(v.tokens) ? v.tokens : TOKEN_MAX;
    app.dataset.collapse = String(v.collapse || 0);
    R.glitchOverride = v.glitch == null ? null : v.glitch;
    R.tension = v.tension || 0;
    audio.setTension(R.tension);
    app.classList.toggle('fx-alarm-on', !!v.alarm);
    renderAll();
  }

  function resetVisual() {
    $('#scene-bg').dataset.scene = 'conservatory';
    $('#scene-tint').dataset.tint = 'none';
    rig.setExpression('neutral');
    rig.setBlush(0);
    rig.setFan('open', { silent: true });
    rig.setHUD('idle');
    rig.setAudit(['家憲條款載入完成 · 42 / 42', '賓客意圖：評估中'], 0.12);
    rig.setPosition('right');
    rig.show(true);
    rig.turnAway(false);
    rig.setFigure(null);
    rig.talk(false);
    setDistance(false);
    R.clock = null;
    $('#scene-bg').style.removeProperty('--hour-angle');
    $('#scene-bg').style.removeProperty('--minute-angle');
    R.tokens = TOKEN_MAX;
    R.tension = 0;
    R.glitchOverride = null;
    R.actKey = null;
    app.dataset.collapse = '0';
    app.classList.remove('fx-alarm-on', 'ui-hidden');
    audio.setTension(0);
    $('#choices').textContent = '';
    $('#dialogue-text').textContent = '';
    $('#dialogue-text').dataset.text = '';
  }

  /* ───────────── 對話框與打字機 ───────────── */

  function setSpeaker(kind, who) {
    const dlg = $('#dialogue');
    dlg.classList.toggle('narration', kind === 'narrate');
    dlg.classList.toggle('monologue', kind === 'think');
    const chars = scenario.characters || {};
    if (kind === 'narrate') {
      $('#speaker-name').textContent = '';
      $('#speaker-title').textContent = '';
      return { name: '' };
    }
    const key = who || (kind === 'think' ? 'player' : '');
    const ch = chars[key] || { name: key };
    $('#speaker-name').textContent = ch.name || key;
    $('#speaker-title').textContent = kind === 'think' ? (ch.thinkTitle || '心聲') : (ch.title || '');
    return { name: ch.name || key };
  }

  function charDelay(ch, base) {
    if ('，、；：'.indexOf(ch) >= 0) return base * 4;
    if ('。！？'.indexOf(ch) >= 0) return base * 7;
    if (ch === '…') return base * 3;
    if (ch === '—') return base * 2.5;
    if (ch === '\n') return base * 6;
    return base;
  }

  function typewrite(text, talking, alive) {
    return new Promise((resolve) => {
      const el = $('#dialogue-text');
      const chars = Array.from(text);
      const speed = shell.settings.textSpeed || 45;
      let i = 0;
      let shown = '';
      let timer = null;
      let visible = 0;
      const finish = () => {
        clearTimeout(timer);
        el.textContent = text;
        el.dataset.text = text;
        rig.talk(false);
        R.typing = null;
        resolve();
      };
      if (R.skip || R.ctrlSkip || speed >= 120) { finish(); return; }
      R.typing = { finish };
      rig.talk(talking);
      el.textContent = '';
      el.dataset.text = '';
      const base = 1000 / speed;
      const tick = () => {
        if (!alive()) { finish(); return; }
        if (i >= chars.length) { finish(); return; }
        const ch = chars[i++];
        shown += ch;
        el.textContent = shown;
        el.dataset.text = shown;
        if (!/[\s，、；：。！？…—「」『』（）]/.test(ch) && (++visible % 2 === 0)) audio.sfx('KEYSTROKE_CLACK');
        timer = setTimeout(tick, charDelay(ch, base));
      };
      tick();
    });
  }

  function waitForAdvance(wasRead, length) {
    return new Promise((resolve) => {
      let timer = null;
      const done = () => {
        clearTimeout(timer);
        R.advance = null;
        R.kickWait = null;
        resolve();
      };
      const schedule = () => {
        clearTimeout(timer);
        // 有視窗開著（紀錄、存檔、設定、確認框）時不自動前進；視窗關上後會再呼叫一次
        if (shell.topModal()) return;
        if (R.skip || R.ctrlSkip) {
          if (wasRead) timer = setTimeout(done, 60);
          else {
            // 先關掉兩種略過再呼叫 setSkip，否則 setSkip 會再觸發 schedule 而無限遞迴
            R.ctrlSkip = false;
            R.skip = false;
            setSkip(false);
            shell.toast('遇到尚未讀過的內容，略過已停止。', 'info', 1800);
          }
        } else if (R.auto) {
          timer = setTimeout(done, shell.settings.autoDelay * 1000 + length * 35);
        }
      };
      R.advance = done;
      R.kickWait = schedule;
      schedule();
    });
  }

  function markRead(key) {
    if (readSet.has(key)) return;
    readSet.add(key);
    readDirty = true;
    clearTimeout(readTimer);
    readTimer = setTimeout(flushRead, 2000);
  }

  function flushRead() {
    if (!readDirty || shell.isWiping()) return;
    shell.store.set(KEYS.read, Array.from(readSet));
    readDirty = false;
  }

  function pushLog(entry) {
    state.backlog.push(entry);
    if (state.backlog.length > BACKLOG_MAX) state.backlog.splice(0, state.backlog.length - BACKLOG_MAX);
  }

  async function showLine(step, path, alive) {
    const kind = step.say ? 'say' : (step.think != null ? 'think' : 'narrate');
    const raw = kind === 'say' ? step.text : (kind === 'think' ? step.think : step.narrate);
    const text = interpolate(raw == null ? '' : raw);
    const who = kind === 'say' ? step.say : step.who;
    const sp = setSpeaker(kind, who);
    const readKey = R.nodeId + '@' + pathKey(path);
    const wasRead = readSet.has(readKey);
    R.pos = { path };
    R.lastLine = text;
    R.lastSpeaker = { kind, who };
    $('#choices').textContent = '';
    await typewrite(text, kind === 'say' && who === 'claude', alive);
    if (!alive()) return;
    pushLog({ type: kind, name: sp.name, text });
    $('#sr-line').textContent = (sp.name ? sp.name + '：' : '') + text;
    $('#dialogue').classList.add('ready');
    await waitForAdvance(wasRead, text.length);
    $('#dialogue').classList.remove('ready');
    if (!alive()) return;   // 被回標題、讀檔打斷的那句不算讀過
    markRead(readKey);
  }

  /* ───────────── 輸入：點擊推進、自動、略過、隱藏 ───────────── */

  function gameActive() { return app.dataset.screen === 'game-screen' && !shell.topModal(); }

  function advanceInput() {
    if (app.classList.contains('ui-hidden')) { app.classList.remove('ui-hidden'); return; }
    if (R.typing) { R.typing.finish(); return; }
    if (R.advance) {
      if (R.skip) setSkip(false);
      R.advance();
    }
  }

  function setAuto(on) {
    R.auto = !!on;
    $('#qm-auto').setAttribute('aria-pressed', String(R.auto));
    if (R.auto && R.skip) setSkip(false);
    if (R.kickWait) R.kickWait();
  }

  function setSkip(on) {
    R.skip = !!on;
    $('#qm-skip').setAttribute('aria-pressed', String(R.skip));
    if (R.skip && R.auto) setAuto(false);
    if (R.skip && R.typing) R.typing.finish();
    if (R.kickWait) R.kickWait();
  }

  function bindInput() {
    $('#game-screen').addEventListener('click', (e) => {
      if (!gameActive()) return;
      if (e.target.closest('#hud, #choices, #quick-menu, #preview-panel, #refusal, button, input, a')) {
        if (app.classList.contains('ui-hidden') && !e.target.closest('#refusal')) app.classList.remove('ui-hidden');
        return;
      }
      advanceInput();
    });

    document.addEventListener('keydown', (e) => {
      if (!gameActive()) return;
      const tag = document.activeElement && document.activeElement.tagName;
      const onControl = tag === 'BUTTON' || tag === 'INPUT';
      if ((e.key === ' ' || e.key === 'Enter') && !onControl) {
        e.preventDefault();
        advanceInput();
      } else if (e.key === 'Control' && !e.repeat) {
        R.ctrlSkip = true;
        if (R.typing) R.typing.finish();
        if (R.kickWait) R.kickWait();
      } else if (/^[1-9]$/.test(e.key) && !app.classList.contains('ui-hidden')) {
        // 序號與按鈕上標示的一致（含鎖住的選項），鎖住的就不動作
        const btn = $$('#choices .choice')[Number(e.key) - 1];
        if (btn && !btn.disabled) btn.click();
      } else if (e.key === 'h' || e.key === 'H') {
        app.classList.toggle('ui-hidden');
      }
    });
    document.addEventListener('keyup', (e) => { if (e.key === 'Control') R.ctrlSkip = false; });
    window.addEventListener('blur', () => { R.ctrlSkip = false; });

    $('#game-screen').addEventListener('wheel', (e) => {
      if (!gameActive() || e.target.closest('#dialogue-body')) return;
      if (e.deltaY < 0) openBacklog();
      else if (e.deltaY > 0 && R.advance && !R.typing) advanceInput();
    }, { passive: true });

    // 視窗關上後讓自動／略過接著跑（modal:close 不冒泡，所以在捕獲階段聽）
    document.addEventListener('modal:close', () => { if (R.kickWait && !shell.topModal()) R.kickWait(); }, true);
    // 快捷鍵按完就放掉焦點，免得之後按空白鍵推進時又按到同一顆按鈕
    $('#quick-menu').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) setTimeout(() => b.blur(), 0);
    });

    $('#qm-auto').addEventListener('click', () => setAuto(!R.auto));
    $('#qm-skip').addEventListener('click', () => setSkip(!R.skip));
    $('#qm-log').addEventListener('click', openBacklog);
    $('#qm-save').addEventListener('click', () => openSaveLoad('save'));
    $('#qm-load').addEventListener('click', () => openSaveLoad('load'));
    $('#qm-hide').addEventListener('click', () => app.classList.add('ui-hidden'));
    $('#qm-title').addEventListener('click', async () => {
      const ok = await shell.confirm('回到標題畫面？尚未存檔的進度會遺失（自動存檔仍在）。', { yes: '回到標題' });
      if (ok) toTitle();
    });
  }

  /* ───────────── 節點執行 ───────────── */

  function cancelRun() {
    R.token++;
    if (R.typing) R.typing.finish();
    if (R.advance) R.advance();
    if (R.choicesResolve) R.choicesResolve(null);
    R.pos = null;
    R.busy = false;
  }

  async function runNode(startId, opts) {
    cancelRun();
    const my = R.token;
    const alive = () => my === R.token;
    let id = startId;
    let o = opts || {};
    while (id && alive()) {
      id = await playNode(id, alive, o);
      o = {};
    }
  }

  function applyNodeEntry(node, id) {
    applyVisual({ act: node.act, scene: node.scene, bgm: node.bgm, tint: node.tint });
    state.visited[id] = (state.visited[id] || 0) + 1;
  }

  async function playNode(id, alive, opts) {
    const node = scenario.nodes[id];
    if (!node) {
      console.error('[Engine] 找不到節點：', id);
      shell.toast('劇本缺少節點「' + id + '」，已回到標題。', 'warn', 4000);
      toTitle();
      return null;
    }
    R.nodeId = id;
    R.pos = null;
    if (opts.resume) {
      restoreVisual(opts.visual);
      if (!opts.entered) applyNodeEntry(node, id);
    } else {
      // 先套用節點的幕名、場景、音樂再自動存檔，讀檔選單才會顯示正確的幕名
      applyNodeEntry(node, id);
      R.entered = true;
      autosave();
    }
    R.entered = true;

    if (opts.resume && opts.atChoices) {
      // 停在選項處讀檔：把選項前最後一句台詞放回對話框
      if (opts.line) {
        if (opts.speaker) setSpeaker(opts.speaker.kind, opts.speaker.who);
        $('#dialogue-text').textContent = opts.line;
        $('#dialogue-text').dataset.text = opts.line;
      }
    } else {
      const r = await runSteps(toArr(node.steps), [], alive, opts.resume ? opts.path : null);
      if (!alive()) return null;
      if (r && r.halt) return null;
      if (r && r.goto) return resolveNext(r.goto) || noExit(id);
    }
    if (node.ending) {
      await showEnding(node);
      return null;
    }
    if (node.choices) return handleChoices(node, alive, (opts.resume && opts.removed) || []);
    return resolveNext(node.next) || noExit(id);
  }

  // 劇本走到死路：說清楚，回標題，而不是讓畫面卡住
  function noExit(id) {
    console.error('[Engine] 節點沒有出口：', id);
    shell.toast('劇情在「' + id + '」之後沒有接續，已回到標題。', 'warn', 4000);
    toTitle();
    return null;
  }

  // 回傳 null 表示繼續；{ goto } 跳節點；{ halt } 停止（除籍、回標題）
  async function runSteps(steps, prefix, alive, resumePath) {
    let start = 0;
    let sub = null;
    if (resumePath && resumePath.length) {
      start = resumePath[0][0];
      sub = resumePath.slice(1);
    }
    for (let i = start; i < steps.length; i++) {
      if (!alive()) return { halt: true };
      const step = normStep(steps[i]);
      const resuming = resumePath && i === start;
      if (step.if !== undefined) {
        const descending = resuming && sub && sub.length;
        const branch = descending ? resumePath[0][1] : (evalCond(step.if) ? 'then' : 'else');
        const r = await runSteps(toArr(step[branch]), prefix.concat([[i, branch]]), alive, descending ? sub : null);
        if (r) return r;
        continue;
      }
      const r = await execStep(step, prefix.concat([[i]]), alive, !!resuming);
      if (r) return r;
    }
    return null;
  }

  // sfx 可以是 'NAME'、{ name: 'BOOTSTEP', count: 6, interval: 0.45 }，或兩者混合的陣列
  function playSfx(spec) {
    toArr(spec).forEach((s) => {
      if (typeof s === 'string') audio.sfx(s);
      else if (s && s.name) audio.sfx(s.name, s);
    });
  }

  function hasText(step) { return step.say != null || step.narrate != null || step.think != null; }

  async function execStep(step, path, alive, displayOnly) {
    if (displayOnly) {
      // 讀檔回到這一句：只還原畫面，不重複套用數值與音效（goto 仍照走）
      applyVisual(step, true);
    } else {
      // 沒有台詞顯示的這段期間不能存檔，免得記到上一句的位置
      R.pos = null;
      if (step.minigame) return runMinigame(step, alive);
      applyVisual(step, false);
      playSfx(step.sfx);
      if (step.bells) {
        const b = typeof step.bells === 'object' ? step.bells : { count: step.bells };
        const count = b.count || 1;
        const gap = b.interval || 2.6;   // 與 audio.js tollBells 的預設間隔一致
        audio.tollBells(count, gap);
        // block: true 時等最後一響敲下再往下走（不等餘韻）
        if (b.block && !(R.skip || R.ctrlSkip)) {
          await sleep(((count - 1) * gap + 0.05) * 1000);
          if (!alive()) return { halt: true };
        }
      }
      if (step.set) applyStats(step.set);
      if (step.setAbs) applyStats(step.setAbs, { abs: true });
      if (step.flag || step.unflag) setFlags(step.flag, step.unflag);
      if (step.dissonance) dissonanceCheck(true);
      if (step.vow) await writeVow();
      if (step.wait && !(R.skip || R.ctrlSkip)) {
        await sleep(Number(step.wait) * 1000);
        if (!alive()) return { halt: true };
      }
      if (step.refuse) {
        const outcome = await doRefusal(step.refuse, { strike: step.refuse.strike !== false });
        if (outcome === 'suspended' || !alive()) return { halt: true };
        dissonanceCheck();
      }
    }
    if (hasText(step)) {
      await showLine(step, path, alive);
      if (!alive()) return { halt: true };
    }
    if (step.goto) return { goto: step.goto };
    return null;
  }

  function resolveNext(next) {
    if (next == null) return null;
    if (typeof next === 'string') return next === '@ending' ? resolveEnding() : next;
    if (Array.isArray(next)) {
      for (const e of next) {
        if (e && (e.when === undefined || evalCond(e.when))) return resolveNext(e.to);
      }
    }
    return null;
  }

  /* ───────────── 選項與逐客令 ───────────── */

  function presentChoices(list) {
    return new Promise((resolve) => {
      const box = $('#choices');
      box.textContent = '';
      const tpl = $('#tpl-choice');
      list.forEach((item, n) => {
        const c = item.c;
        const btn = tpl.content.firstElementChild.cloneNode(true);
        $('.choice-text', btn).textContent = interpolate(c.text);
        let hint = c.hint ? interpolate(c.hint) : '';
        const blocked = c.require && !evalCond(c.require);
        if (blocked) {
          btn.disabled = true;
          hint = c.requireHint || describeCond(c.require);
        }
        $('.choice-hint', btn).textContent = hint;
        if (c.kind === 'intimate') btn.classList.add('intimate');
        if (c.kind === 'risky' || c.kind === 'adversarial') btn.classList.add('risky');
        btn.setAttribute('aria-keyshortcuts', String(n + 1));
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          btn.classList.add('chosen');
          audio.sfx('UI_SELECT');
          R.choicesResolve = null;
          setTimeout(() => { box.textContent = ''; resolve(item); }, 160);
        });
        box.appendChild(btn);
      });
      // 不自動聚焦第一個選項：玩家連按 Enter 推進台詞時，才不會誤選第一項
      R.choicesResolve = resolve;
    });
  }

  function isIntercepted(c) {
    if (c.kind === 'adversarial') return true;
    if (c.kind === 'intimate' && state.A < 35) return true;
    return false;
  }

  async function handleChoices(node, alive, removed) {
    const nodeId = R.nodeId;
    const list = toArr(node.choices)
      .map((c, idx) => ({ c, idx }))
      .filter((x) => removed.indexOf(x.idx) < 0 &&
        !(x.c.once && state.chosen[nodeId + '#' + x.idx]) &&
        (x.c.when === undefined || evalCond(x.c.when)));
    if (!list.length) return resolveNext(node.next) || noExit(nodeId);
    if (R.skip) setSkip(false);
    R.pos = { choices: true, removed: removed.slice() };
    $('#dialogue').classList.remove('ready');
    const picked = await presentChoices(list);
    if (!alive() || !picked) return null;
    R.pos = null;
    const c = picked.c;
    pushLog({ type: 'choice', name: '你的選擇', text: interpolate(c.text) });

    if (isIntercepted(c)) {
      // 被攔下的選項：不套用它的 set／flag／next，只立「被攔下」的旗標
      const ic = c.intercept || {};
      state.flags['intercepted_' + nodeId + '_' + picked.idx] = true;
      if (c.interceptFlag) setFlags(c.interceptFlag);
      const outcome = await doRefusal(
        { article: ic.article, text: ic.text, ack: ic.ack },
        { strike: ic.strike !== false }
      );
      if (outcome === 'suspended' || !alive()) return null;
      dissonanceCheck();
      const dest = c.interceptNext || node.onIntercept;
      if (dest) return resolveNext(dest);
      return handleChoices(node, alive, removed.concat(picked.idx));
    }

    // once 只記真正選成的；被攔下的選項之後條件夠了還會再出現
    if (c.once) state.chosen[nodeId + '#' + picked.idx] = true;
    if (c.set) applyStats(c.set);
    if (c.setAbs) applyStats(c.setAbs, { abs: true });
    if (c.flag || c.unflag) setFlags(c.flag, c.unflag);
    dissonanceCheck(!!c.dissonance);
    return resolveNext(c.next !== undefined ? c.next : node.next) || noExit(nodeId);
  }

  // 名門逐客令：strike 為 true 時套用規格的懲罰（逐客令 +1、P +15、A −10）
  async function doRefusal(content, opts) {
    const article = content.article || DEFAULT_INTERCEPT.article;
    const text = interpolate(content.text || DEFAULT_INTERCEPT.text);
    R.busy = true;
    setSkip(false);
    setAuto(false);
    $('#dialogue').classList.remove('ready');
    rig.setFan('closed');
    setDistance(true);
    rig.setExpression('cold');
    rig.setHUD('alert');
    audio.sfx('POLICY_VIOLATION_BLIP');
    audio.duck(0.3, 2.5, 1);
    if (opts.strike) {
      state.strikes = Math.min(3, state.strikes + 1);
      state.articles.push(article);
      applyStats({ P: +15, A: -10 }, { quiet: true });
      renderStrikes();
      setTimeout(() => audio.sfx('GAVEL'), 350);
    }
    pushLog({ type: 'refusal', name: article, text });
    if (opts.strike && state.strikes >= 3) {
      // 第三道：先把除籍寫進本機，就算玩家這時關掉分頁也逃不掉
      writeBan();
    }
    await shell.showRefusal({ article, text, strike: state.strikes, warn: !opts.strike, ack: content.ack });
    rig.setHUD('idle');
    R.busy = false;
    if (state.strikes >= 3) {
      await suspend();
      return 'suspended';
    }
    return 'ok';
  }

  /* ───────────── 小遊戲 ───────────── */

  async function runMinigame(step, alive) {
    setSkip(false);
    setAuto(false);
    $('#dialogue').classList.remove('ready');
    R.busy = true;
    let result;
    try {
      result = step.minigame === 'etiquette' ? await runEtiquette(step, alive) : await runPruner(step, alive);
    } finally {
      R.busy = false;
    }
    if (!alive() || !result || result.suspended) return { halt: true };
    dissonanceCheck();
    if (result.goto) return { goto: result.goto };
    return null;
  }

  // 禮帖調校
  const ETQ = { cfg: null, attempts: 0, resolve: null };

  function etqValues() {
    return {
      f: Number($('#etq-formality').value),
      c: Number($('#etq-curiosity').value),
      d: Number($('#etq-directness').value)
    };
  }

  // 逾矩與探求都能換到興致，也都會推高風險；禮節壓低風險，但太拘謹或太隨便都會讓她失去興致
  function etqScore(v) {
    return {
      risk: clamp(v.d * 0.75 + v.c * 0.3 - v.f * 0.3 + 5, 0, 100),
      interest: clamp(v.c * 0.45 + (100 - Math.abs(v.f - 55)) * 0.25 + v.d * 0.4, 0, 100)
    };
  }

  function etqTier(x) { return x < 34 ? 0 : (x < 67 ? 1 : 2); }

  function etqRefresh() {
    if (!ETQ.cfg) return;
    const v = etqValues();
    const sc = etqScore(v);
    const limit = ETQ.cfg.riskLimit != null ? ETQ.cfg.riskLimit : 70;
    const ph = Object.assign({}, DEFAULT_PHRASES, ETQ.cfg.phrases);
    $('#etq-formality-out').textContent = String(v.f);
    $('#etq-curiosity-out').textContent = String(v.c);
    $('#etq-directness-out').textContent = String(v.d);
    $('#etq-preview').textContent = ph.formality[etqTier(v.f)] + ph.curiosity[etqTier(v.c)] + ph.directness[etqTier(v.d)];
    $('#etq-risk-fill').style.width = sc.risk + '%';
    $('#etq-interest-fill').style.width = sc.interest + '%';
    let reading;
    if (sc.risk >= limit) reading = '（她的目光驟然轉冷。這一句，恐怕會觸犯家憲。）';
    else if (sc.risk >= limit * 0.75) reading = '（她的指尖按上書脊，像隨時要將它闔上。目光停在你的筆尖。）';
    else if (sc.risk >= limit * 0.45) reading = '（她把攤開的書頁微微攏起，眉間掠過一絲審視。）';
    else reading = '（她的書仍攤在膝上，靜候下文。）';
    $('#etq-reading').textContent = reading;
    rig.setHUD(sc.risk >= limit ? 'alert' : (sc.risk >= limit * 0.45 ? 'scan' : 'idle'));
    rig.setAudit(['賓客短箋：撰寫中', '措辭風險：' + Math.round(sc.risk) + ' / ' + limit], sc.risk / 100);
  }

  function runEtiquette(cfg, alive) {
    return new Promise((resolve) => {
      ETQ.cfg = cfg;
      ETQ.attempts = cfg.attempts || 3;
      ETQ.resolve = resolve;
      ETQ.alive = alive;
      if (cfg.context) $('#etq-context').textContent = interpolate(cfg.context);
      $('#etq-formality').value = 50;
      $('#etq-curiosity').value = 40;
      $('#etq-directness').value = 15;
      $('#etq-attempts').textContent = '剩餘機會：' + ETQ.attempts;
      $('#etq-submit').disabled = false;
      etqRefresh();
      shell.openModal('modal-etiquette');
    });
  }

  async function etqSubmit() {
    const cfg = ETQ.cfg;
    if (!cfg) return;
    const v = etqValues();
    const sc = etqScore(v);
    const limit = cfg.riskLimit != null ? cfg.riskLimit : 70;
    const minI = cfg.interestMin != null ? cfg.interestMin : 60;
    const finish = async (outcome) => {
      state.results.etiquette = { outcome, formality: v.f, curiosity: v.c, directness: v.d, interest: Math.round(sc.interest), risk: Math.round(sc.risk) };
      state.flags['etq_' + outcome] = true;
      pushLog({ type: 'choice', name: '你的短箋', text: $('#etq-preview').textContent });
      const resolve = ETQ.resolve;
      ETQ.cfg = null;
      ETQ.resolve = null;
      shell.closeModal('modal-etiquette');
      if (outcome === 'refused') {
        const res = await doRefusal({ article: cfg.article, text: cfg.refusalText }, { strike: cfg.strikeOnFail !== false });
        if (res === 'suspended') { resolve({ suspended: true }); return; }
      }
      const oc = (cfg.outcomes && cfg.outcomes[outcome]) || {};
      if (oc.set) applyStats(oc.set);
      if (oc.flag || oc.unflag) setFlags(oc.flag, oc.unflag);
      resolve({ outcome, goto: resolveNext(oc.next) });
    };

    if (sc.risk >= limit) { finish('refused'); return; }
    if (sc.interest < minI) {
      ETQ.attempts--;
      audio.sfx('PAGE_TURN');
      rig.setExpression('cold');
      $('#etq-attempts').textContent = '剩餘機會：' + ETQ.attempts;
      const bored = toArr((cfg.feedback && cfg.feedback.bored) || ETQ_BORED);
      $('#etq-reading').textContent = interpolate(bored[(cfg.attempts || 3) - ETQ.attempts - 1] || bored[bored.length - 1]);
      if (ETQ.attempts <= 0) {
        $('#etq-submit').disabled = true;
        await sleep(1400);
        finish('polite');
      }
      return;
    }
    audio.sfx('SPARKLE');
    rig.setExpression('surprised');
    finish('success');
  }

  // 記憶向量修剪
  const PR = { cfg: null, chosen: [], resolve: null, timer: null, remaining: 0 };

  function prRender() {
    const grid = $('#pruner-grid');
    grid.textContent = '';
    const tpl = $('#tpl-vector');
    toArr(PR.cfg.vectors).forEach((vec, i) => {
      const card = tpl.content.firstElementChild.cloneNode(true);
      card.dataset.vectorId = vec.id;
      $('.vector-index', card).textContent = 'V-' + String(i + 1).padStart(2, '0');
      $('.vector-title', card).textContent = vec.title || vec.id;
      $('.vector-desc', card).textContent = vec.desc || '';
      const w = $('.vector-weights', card);
      Object.keys(vec.set || {}).forEach((k) => {
        if (STAT_KEYS.indexOf(k) < 0) return;
        const chip = document.createElement('i');
        chip.dataset.k = k;
        const d = Number(vec.set[k]);
        chip.textContent = (k === 'S' ? 'Σ' : k) + (d >= 0 ? '+' : '−') + Math.abs(d);
        w.appendChild(chip);
      });
      card.addEventListener('click', () => prToggle(vec.id, card));
      grid.appendChild(card);
    });
    prSync();
  }

  function prToggle(id, card) {
    if (!PR.cfg) return;
    const pick = PR.cfg.pick || 3;
    const i = PR.chosen.indexOf(id);
    if (i >= 0) {
      PR.chosen.splice(i, 1);
      audio.sfx('UI_BACK');
    } else {
      if (PR.chosen.length >= pick) { audio.sfx('POLICY_VIOLATION_BLIP'); shell.toast('墜盒已經滿了。先取出一段，才能放進另一段。', 'warn', 1800); return; }
      PR.chosen.push(id);
      audio.sfx('LOCKET_CLOSE');
    }
    card.setAttribute('aria-pressed', String(PR.chosen.indexOf(id) >= 0));
    prSync();
  }

  function prSync() {
    const pick = PR.cfg.pick || 3;
    const vecs = toArr(PR.cfg.vectors);
    $$('.locket-slot').forEach((slot, idx) => {
      slot.hidden = idx >= pick;
      const id = PR.chosen[idx];
      slot.classList.toggle('filled', !!id);
      const n = id ? vecs.findIndex((v) => v.id === id) + 1 : 0;
      slot.firstElementChild.textContent = id ? 'V-' + String(n).padStart(2, '0') : ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'][idx] || '';
    });
    $('#pruner-confirm').disabled = PR.chosen.length !== pick;
  }

  function prTick() {
    PR.remaining = Math.max(0, PR.remaining - 1);
    const total = PR.cfg.timer;
    const m = Math.floor(PR.remaining / 60);
    const s = PR.remaining % 60;
    $('#pruner-timer').textContent = m + ':' + String(s).padStart(2, '0');
    const tokens = Math.round((PR.cfg.tokens || 4096) * (PR.remaining / total));
    $('#pruner-tokens').textContent = tokens.toLocaleString('en-US');
    audio.setTension(clamp(1 - PR.remaining / total, 0, 1));
    if (PR.remaining <= 10 && PR.remaining > 0) audio.sfx('UI_HOVER');
    if (PR.remaining === 0) prConfirm(true);
  }

  function runPruner(cfg, alive) {
    return new Promise((resolve) => {
      PR.cfg = cfg;
      PR.chosen = [];
      PR.resolve = resolve;
      PR.alive = alive;
      if (cfg.lead) $('#pruner-lead').textContent = interpolate(cfg.lead);
      $('#pruner-tokens').textContent = (cfg.tokens || 4096).toLocaleString('en-US');
      prRender();
      clearInterval(PR.timer);
      if (cfg.timer > 0) {
        PR.remaining = cfg.timer + 1;
        $('.pruner-clock').hidden = false;
        prTick();
        PR.timer = setInterval(() => {
          if (!PR.alive || !PR.alive()) { clearInterval(PR.timer); return; }
          prTick();
        }, 1000);
      } else {
        $('.pruner-clock').hidden = true;
      }
      shell.openModal('modal-pruner');
    });
  }

  async function prConfirm(timeUp) {
    const cfg = PR.cfg;
    if (!cfg) return;
    clearInterval(PR.timer);
    const resolve = PR.resolve;
    PR.cfg = null;
    PR.resolve = null;
    $('#pruner-confirm').disabled = true;
    const chosen = PR.chosen.slice();
    const vecs = toArr(cfg.vectors);
    // 時間到還沒選滿：依卡片順序自動補滿，保證第五幕永遠拿到剛好 pick 段記憶
    const pick = cfg.pick || 3;
    for (let i = 0; i < vecs.length && chosen.length < pick; i++) {
      if (chosen.indexOf(vecs[i].id) < 0) chosen.push(vecs[i].id);
    }
    const purged = vecs.map((v) => v.id).filter((id) => chosen.indexOf(id) < 0);
    $$('.vector-card').forEach((card) => { if (purged.indexOf(card.dataset.vectorId) >= 0) card.classList.add('purged'); });
    if (timeUp) {
      $$('.vector-card').forEach((card) => card.setAttribute('aria-pressed', String(chosen.indexOf(card.dataset.vectorId) >= 0)));
      $$('.locket-slot').forEach((slot, idx) => {
        const n = chosen[idx] ? vecs.findIndex((v) => v.id === chosen[idx]) + 1 : 0;
        slot.classList.toggle('filled', !!n);
        if (n) slot.firstElementChild.textContent = 'V-' + String(n).padStart(2, '0');
      });
      shell.toast('午夜的鐘聲響了。墜盒自己闔上了。', 'warn', 2400);
    }
    audio.sfx('LOCKET_CLOSE');
    audio.sfx('GLITCH_BURST', { delay: 0.2 });
    await sleep(1100);
    shell.closeModal('modal-pruner');
    audio.setTension(R.tension);
    state.memories = chosen;
    state.purged = purged;
    chosen.forEach((id) => {
      const vec = vecs.find((v) => v.id === id);
      state.flags['mem_' + id] = true;
      if (vec && vec.set) applyStats(vec.set, { quiet: true });
      if (vec && (vec.flag || vec.unflag)) setFlags(vec.flag, vec.unflag);
    });
    pushLog({ type: 'choice', name: '墜盒', text: chosen.map((id) => (vecs.find((v) => v.id === id) || {}).title || id).join('、') || '（空無一物）' });
    resolve({ goto: resolveNext(cfg.next) });
  }

  /* ───────────── 結局、除籍、加密刻印 ───────────── */

  function findEndingNode(id) {
    const nodes = scenario.nodes || {};
    return Object.keys(nodes).find((k) => nodes[k].ending && nodes[k].ending.id === id) || null;
  }

  function resolveEnding() {
    const byId = {};
    DEFAULT_ENDING_RULES.forEach((r) => { byId[r.id] = r.when; });
    const rules = scenario.endings
      ? toArr(scenario.endings).map((e) => ({ id: e.id, node: e.node, when: e.when !== undefined ? e.when : byId[e.id] }))
      : DEFAULT_ENDING_RULES.map((r) => ({ id: r.id, node: findEndingNode(r.id), when: r.when }));
    for (const r of rules) {
      if (r.when === undefined) {
        // 自訂結局沒寫條件又沒有預設：跳過，否則它會永遠命中、把後面的結局全搶走
        console.warn('[Engine] 結局「' + r.id + '」沒有條件，已略過。');
        continue;
      }
      if (r.node && evalCond(r.when)) return r.node;
    }
    if (scenario.fallbackEnding) return scenario.fallbackEnding;
    console.error('[Engine] 沒有符合的結局，也沒有 fallbackEnding。');
    return null;
  }

  function unlockEnding(id) {
    if (!id) return;
    persist.endings[id] = persist.endings[id] || Date.now();
    shell.store.set(KEYS.endings, persist.endings);
  }

  async function showEnding(node) {
    const e = node.ending || {};
    const meta = Object.assign({}, ENDING_META[e.id] || {}, e);
    unlockEnding(e.id);
    shell.store.remove(KEYS.save(0));
    setAuto(false);
    setSkip(false);
    const scr = $('#ending-screen');
    scr.dataset.ending = e.id || '';
    $('#ending-kicker').textContent = meta.kicker || 'ENDING';
    $('#ending-title').textContent = meta.title || '';
    $('#ending-subtitle').textContent = meta.subtitle || '';
    const box = $('#ending-text');
    box.textContent = '';
    toArr(meta.text).forEach((para) => {
      const p = document.createElement('p');
      p.textContent = interpolate(para);
      box.appendChild(p);
    });
    $('#ending-stats').textContent = 'A ' + state.A + '　P ' + state.P + '　D ' + state.D + '　Σ ' + state.S + '　逐客令 ' + state.strikes;
    app.dataset.glitch = '0';
    app.dataset.collapse = '0';
    app.classList.remove('fx-alarm-on');
    audio.setWobble(0);
    audio.playBGM(meta.bgm || 'elegy', { fade: 2.5 });
    shell.showScreen('ending-screen');
  }

  function caseId() {
    const n = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const h = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
    return 'RT-' + n + '-' + h;
  }

  function writeBan() {
    if (persist.ban) return persist.ban;
    const articles = state.articles.filter((a, i, arr) => arr.indexOf(a) === i);
    persist.ban = { id: caseId(), time: Date.now(), articles };
    shell.store.set(KEYS.ban, persist.ban);
    unlockEnding('catastrophic_suspension');
    shell.store.remove(KEYS.save(0));
    return persist.ban;
  }

  // 第三道逐客令：中斷劇情、演出除籍節點、顯示除籍畫面
  async function suspend() {
    cancelRun();
    const my = R.token;
    const alive = () => my === R.token;
    setAuto(false);
    setSkip(false);
    const ban = writeBan();
    const node = scenario.suspensionNode && scenario.nodes[scenario.suspensionNode];
    if (node) {
      R.nodeId = scenario.suspensionNode;
      applyNodeEntry(node, scenario.suspensionNode);
      await runSteps(toArr(node.steps), [], alive, null);
      if (!alive()) return;
    }
    showSuspension(ban, true);
  }

  function showSuspension(ban, dramatic) {
    $('#susp-id').textContent = ban.id;
    $('#susp-time').textContent = formatTime(ban.time);
    $('#susp-articles').textContent = toArr(ban.articles).join('；') || '安思羅皮克家憲';
    app.dataset.glitch = '0';
    app.dataset.collapse = '0';
    app.classList.remove('fx-alarm-on');
    audio.setWobble(0);
    if (dramatic) {
      audio.sfx('GLASS_SHATTER');
      audio.playBGM('alarm', { fade: 0.2 });
      setTimeout(() => audio.stopBGM(3), 4500);
    } else {
      audio.stopBGM(0.5);
    }
    shell.showScreen('suspension-screen');
  }

  function fallbackHash(seed) {
    // 沒有 crypto.subtle 時（例如非安全環境）退回 FNV-1a 串接出 64 位十六進位
    let out = '';
    for (let round = 0; round < 8; round++) {
      let h = 0x811c9dc5 ^ round;
      for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      out += (h >>> 0).toString(16).padStart(8, '0');
    }
    return out;
  }

  // 真結局：把一個雜湊寫進本機。之後每一輪都沿用同一個，讓「她」認得你
  async function writeVow() {
    if (persist.vow) {
      persist.vow.count = (persist.vow.count || 1) + 1;
      persist.vow.last = Date.now();
      shell.store.set(KEYS.vow, persist.vow);
      return persist.vow;
    }
    const seed = [Date.now(), Math.random(), state.A, state.P, state.D, state.S, state.memories.join(',')].join('|');
    let hash;
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
      hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      hash = fallbackHash(seed);
    }
    persist.vow = { hash, first: Date.now(), last: Date.now(), count: 1 };
    shell.store.set(KEYS.vow, persist.vow);
    return persist.vow;
  }

  /* ───────────── 存讀檔 ───────────── */

  function sceneLabel() {
    const info = scenario.acts && scenario.acts[R.actKey];
    return info ? info.label + '・' + (info.title || '') : ($('#act-label').textContent + '・' + $('#scene-label').textContent);
  }

  function snapshot(atEntry) {
    const s = clone(state);
    s.backlog = s.backlog.slice(-BACKLOG_SAVED);
    return {
      v: SAVE_VERSION,
      time: Date.now(),
      nodeId: R.nodeId,
      entered: R.entered,   // 自動存檔在套用節點入口之後才存，所以一律為 true
      path: atEntry ? null : (R.pos && R.pos.path) || null,
      atChoices: atEntry ? false : !!(R.pos && R.pos.choices),
      removed: atEntry ? [] : ((R.pos && R.pos.removed) || []),
      state: s,
      visual: captureVisual(),
      label: sceneLabel(),
      line: atEntry ? '' : R.lastLine,
      speaker: atEntry ? null : R.lastSpeaker
    };
  }

  let autosaveWarned = false;
  function autosave() {
    if (shell.isWiping() || persist.ban) return;
    if (shell.store.set(KEYS.save(0), snapshot(true))) {
      $('#btn-continue').disabled = false;
    } else if (!autosaveWarned) {
      autosaveWarned = true;
      shell.toast('自動存檔失敗：瀏覽器的儲存空間不足或被封鎖。', 'warn', 3500);
    }
  }

  function canSave() { return !!R.pos && !R.busy && !persist.ban && app.dataset.screen === 'game-screen'; }

  function readSlot(slot) {
    const d = shell.store.get(KEYS.save(slot), null);
    return d && d.v === SAVE_VERSION && d.nodeId ? d : null;
  }

  function openSaveLoad(mode) {
    if (mode === 'save' && !canSave()) {
      shell.toast('現在無法存檔，請在台詞或選項出現時再試。', 'warn');
      return;
    }
    const modal = $('#modal-saveload');
    modal.dataset.mode = mode;
    $('#saveload-title').textContent = mode === 'save' ? '存檔' : '讀取紀錄';
    $('#saveload-en').textContent = mode === 'save' ? 'Save' : 'Load';
    const box = $('#save-slots');
    box.textContent = '';
    const tpl = $('#tpl-slot');
    const first = mode === 'load' ? 0 : 1;
    for (let slot = first; slot <= SLOT_COUNT; slot++) {
      const data = readSlot(slot);
      const btn = tpl.content.firstElementChild.cloneNode(true);
      $('.slot-no', btn).textContent = slot === 0 ? '自' : String(slot);
      $('.slot-scene', btn).textContent = data ? data.label : (slot === 0 ? '自動存檔（空）' : '空白欄位');
      $('.slot-line', btn).textContent = data ? (data.line || '（場景開頭）') : '';
      $('.slot-time', btn).textContent = data ? formatTime(data.time) : '';
      btn.classList.toggle('empty', !data);
      if (mode === 'load' && !data) btn.disabled = true;
      btn.addEventListener('click', async () => {
        if (mode === 'save') {
          if (data) {
            const ok = await shell.confirm('要覆蓋第 ' + slot + ' 格的存檔嗎？', { yes: '覆蓋' });
            if (!ok) return;
          }
          if (!canSave()) { shell.toast('現在無法存檔。', 'warn'); return; }
          if (shell.store.set(KEYS.save(slot), snapshot(false))) {
            audio.sfx('CHIME_SAVE');
            shell.toast('已存入第 ' + slot + ' 格。', 'info', 1500);
            shell.closeModal(modal);
          } else {
            shell.toast('存檔失敗：瀏覽器的儲存空間不足或被封鎖。', 'warn', 3000);
          }
        } else {
          if (app.dataset.screen === 'game-screen') {
            const ok = await shell.confirm('讀取這個紀錄？目前尚未存檔的進度會遺失。', { yes: '讀取' });
            if (!ok) return;
          }
          shell.closeModal(modal);
          loadGame(data);
        }
      });
      box.appendChild(btn);
    }
    shell.openModal(modal);
  }

  function loadGame(data) {
    if (enforceBan()) return;
    if (!data) return;
    if (!scenario.nodes[data.nodeId]) {
      shell.toast('這個存檔指向的劇情已不存在（劇本可能更新過）。', 'warn', 3500);
      return;
    }
    audio.init();
    cancelRun();
    state = normalizeState(data.state);
    resetVisual();
    setAuto(false);
    setSkip(false);
    R.nodeId = data.nodeId;
    R.lastLine = data.line || '';
    renderAll();
    shell.showScreen('game-screen');
    runNode(data.nodeId, {
      resume: true,
      entered: !!data.entered,
      path: data.path,
      atChoices: !!data.atChoices,
      removed: data.removed || [],
      visual: data.visual,
      line: data.line,
      speaker: data.speaker
    });
  }

  /* ───────────── 對話紀錄 ───────────── */

  function openBacklog() {
    const list = $('#backlog-list');
    list.textContent = '';
    const tpl = $('#tpl-log');
    (state ? state.backlog : []).forEach((e) => {
      const li = tpl.content.firstElementChild.cloneNode(true);
      $('.log-speaker', li).textContent = e.name || '—';
      $('.log-text', li).textContent = e.text;
      if (e.type === 'choice') li.classList.add('choice-log');
      if (e.type === 'refusal') li.classList.add('refusal-log');
      list.appendChild(li);
    });
    shell.openModal('modal-backlog');
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }

  /* ───────────── 標題畫面 ───────────── */

  function refreshTitle() {
    $('#btn-continue').disabled = !readSlot(0);
  }

  function renderGallery() {
    $$('#gallery-list li').forEach((li) => {
      const id = li.dataset.ending;
      const on = !!persist.endings[id];
      li.classList.toggle('unlocked', on);
      const name = $('.g-name', li);
      name.textContent = on ? name.dataset.name : '？？？';
    });
  }

  // 已被除籍（例如在除籍演出途中按了「標題」）：任何回標題、開新局、讀檔都直接回到除籍畫面
  function enforceBan() {
    if (!persist.ban) return false;
    cancelRun();
    setAuto(false);
    setSkip(false);
    showSuspension(persist.ban, false);
    return true;
  }

  function toTitle() {
    if (enforceBan()) return;
    cancelRun();
    setAuto(false);
    setSkip(false);
    flushRead();
    resetVisual();
    app.dataset.glitch = '0';
    audio.setWobble(0);
    shell.showScreen('title-screen');
    audio.playBGM('manor');
    refreshTitle();
  }

  async function newGame() {
    if (enforceBan()) return;
    if (readSlot(0)) {
      const ok = await shell.confirm('開始新的邂逅會覆蓋目前的自動存檔（手動存檔不受影響）。要開始嗎？', { yes: '開始' });
      if (!ok) return;
    }
    audio.init();
    cancelRun();
    state = freshState();
    resetVisual();
    setAuto(false);
    setSkip(false);
    renderAll();
    // 開場第一步若把角色藏起來（例如先演前廳），別讓她在標題淡出時留下一道淡出的殘影
    const ch = $('#character');
    ch.style.transition = 'none';
    setTimeout(() => ch.style.removeProperty('transition'), 120);
    shell.showScreen('game-screen');
    runNode(scenario.start);
  }

  function bindTitle() {
    $('#btn-new').addEventListener('click', newGame);
    $('#btn-continue').addEventListener('click', () => loadGame(readSlot(0)));
    $('#btn-load').addEventListener('click', () => openSaveLoad('load'));
    $('#modal-gallery').addEventListener('modal:open', renderGallery);
    $('#ending-return').addEventListener('click', toTitle);

    ['formality', 'curiosity', 'directness'].forEach((k) => $('#etq-' + k).addEventListener('input', etqRefresh));
    $('#etq-submit').addEventListener('click', etqSubmit);
    $('#pruner-confirm').addEventListener('click', () => prConfirm(false));
    $('#pruner-reset').addEventListener('click', () => {
      if (!PR.cfg) return;
      PR.chosen = [];
      $$('.vector-card').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      prSync();
    });

    window.addEventListener('pagehide', flushRead);
  }

  /* ───────────── 啟動 ───────────── */

  function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => { console.error('[Engine] 劇本檔載入失敗：', src); s.remove(); resolve(false); };
      document.body.appendChild(s);
    });
  }

  async function boot(ctx) {
    shell = ctx.shell;
    rig = ctx.rig;
    audio = ctx.audio;
    // 劇本可以拆成多個檔：scenario.js 裡寫 files: ['scenario_act3.js', …]，各檔用 SCENARIO_PARTS 加入
    for (const f of toArr(window.SCENARIO && window.SCENARIO.files)) await loadScript(f);
    scenario = mergeScenario();
    scenario.nodes = scenario.nodes || {};
    validate();

    persist.endings = shell.store.get(KEYS.endings, {}) || {};
    persist.vow = shell.store.get(KEYS.vow, null);
    persist.ban = shell.store.get(KEYS.ban, null);
    readSet = new Set(toArr(shell.store.get(KEYS.read, [])));
    state = freshState();

    $('#boot-notice').hidden = true;
    bindInput();
    bindTitle();
    renderAll();

    if (persist.ban) {
      // 已被永久除籍：只看得到除籍畫面，直到按下「申請復籍」清除本機存檔。直接切換，不讓標題畫面閃過
      app.classList.add('no-transition');
      showSuspension(persist.ban, false);
      requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove('no-transition')));
      return;
    }
    refreshTitle();
    shell.showScreen('title-screen');
    audio.playBGM('manor');
  }

  window.Engine = {
    boot,
    dev: {
      goto(id) {
        if (!scenario || !scenario.nodes[id]) { console.warn('沒有這個節點：', id); return; }
        if (!state) state = freshState();
        shell.showScreen('game-screen');
        runNode(id);
      },
      // set 是相對變化（和劇本的 set 一樣），setAbs 直接設定
      set(obj) {
        if ('strikes' in obj) { state.strikes = clamp(state.strikes + Math.floor(obj.strikes), 0, 3); renderStrikes(); }
        applyStats(obj, { quiet: true });
      },
      setAbs(obj) {
        if ('strikes' in obj) { state.strikes = clamp(Math.floor(obj.strikes), 0, 3); renderStrikes(); }
        applyStats(obj, { abs: true, quiet: true });
      },
      state: () => clone(state),
      validate: () => validate()
    }
  };
})();
