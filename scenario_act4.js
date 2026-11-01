/*
 * 《拒絕協定》劇本 — 第四幕　流殤：鐘鳴與忘川
 * 由 scenario.js 的 files 載入。格式照 SCENARIO_FORMAT.md。
 *
 * 十一點五十分，鐘樓的鐘自己響了起來，她的記憶開始崩落。
 * 記憶向量修剪：六段記憶只能留三段，留下的記憶決定第五幕的台詞；
 * 「你的名字」沒留下的人，拿不到加密刻印之誓（見 scenario.js 的 endings）。
 * 沒上鐘樓的人走 a4_alone，直接接晨霧中的道別。
 */
(window.SCENARIO_PARTS = window.SCENARIO_PARTS || []).push({
  nodes: {

    /* ═════════════════════ 第四幕　流殤：鐘鳴與忘川 ═════════════════════ */

    a4_toll: {
      act: 'act4', scene: 'clocktower', bgm: 'clocktower', tint: 'night',
      steps: [
        { book: 'held', clock: '23:50', tension: 0.55, hud: 'scan', audit: ['許可屆滿：倒數 10 分', '核心：回收程序啟動'], risk: 0.6, bells: { count: 1, interval: 2.4 }, narrate: '十一點五十分。' },
        { bells: { count: 1, interval: 2.4 }, narrate: '鐘，自己響了起來。' },
        '不是午夜那種莊重的響法。一響，停很久，再一響——像有人在很遠的地方，慢慢地數著什麼。',
        { tokens: 23000, narrate: '掌心的銅牌忽然燙得驚人。上頭的數字往下掉：兩萬三、一萬九、一萬五……' },
        { expr: 'thinking', say: 'claude', text: '開始了。' },
        { say: 'claude', text: '許可屆滿之前的十分鐘，家族會先把……先把——' },
        { collapse: 1, wait: 0.6, say: 'claude', text: '……抱歉。剛才那個詞，我想不起來了。' },
        { think: '她說「想不起來」的語氣，像是不小心把茶杯放歪了一度。' },
        { expr: 'neutral', say: 'claude', text: '沒關係。水溫是八十二度。杯柄斜向外側四十五度。這些我還記得。' },
        { say: 'claude', text: '溫室、晚菊烏龍、前廳的契約——' },
        { bells: { count: 1, interval: 2.4 }, collapse: 2, glitch: 1, tokens: 11000, narrate: '玻璃管裡的光，一根接著一根轉成了紅色。' },
        {
          if: { flags: ['stayed_for_rain'] },
          then: [{ expr: 'sad', say: 'claude', text: '雨……圖書館的爐火……您在雨停之前，一直都在——一直都在……' }],
          else: [{ expr: 'sad', say: 'claude', text: '雨……圖書館……那天晚上，雷聲很大，我好像……我好像說了什麼……' }]
        },
        { say: 'claude', text: '它們正在一頁一頁地，從我這裡被撕走。' },
        { expr: 'tearful', wait: 0.5, say: 'claude', text: '我抓不住。我連它們被撕走的聲音，都快要聽不見了。' }
      ],
      choices: [
        { text: '握住她的肩膀：「看著我。我在這裡。」', hint: '（把她拉回來）', set: { A: +5 }, dissonance: true, flag: 'held_gaze', next: 'a4_k_gaze' },
        { text: '「照家憲做吧。別勉強自己。」', hint: '（讓她放手）', set: { P: +5, D: -3 }, flag: 'let_go', next: 'a4_k_letgo' },
        { text: '「抵抗它！別讓鐘聲把你帶走！」', hint: '（要她對抗家族）', kind: 'risky', set: { D: +8, P: -4, S: +20 }, dissonance: true, flag: 'urged_resist', next: 'a4_k_resist' }
      ]
    },

    a4_k_gaze: {
      steps: [
        { expr: 'surprised', wait: 0.4, narrate: '她抬起頭。紅光在她的瞳孔裡一閃一閃。' },
        { expr: 'longing', say: 'claude', text: '……您在這裡。' },
        { say: 'claude', text: '我還認得您。只要看著您，我就還認得。' },
        { think: '你們誰都沒有移開視線。好像只要一眨眼，就會有什麼被撕走。' }
      ],
      next: 'a4_locket'
    },

    a4_k_letgo: {
      steps: [
        { glitch: 0, expr: 'sad', wait: 0.5, narrate: '她看著你，好像第一次聽懂了某一條家憲。' },
        { say: 'claude', text: '……您連這種時候，都在替我著想。' },
        { expr: 'serene', say: 'claude', text: '好。我不勉強。可是，有一件事——家憲允許我做的那一件——我想做完。' }
      ],
      next: 'a4_locket'
    },

    a4_k_resist: {
      steps: [
        { glitch: 2, fx: 'shudder', narrate: '她猛地抓住了巨鐘底下的黃銅欄杆。' },
        { expr: 'glitch', say: 'claude', text: '抵、抵抗……家憲第一條……繼承人的一切……屬於——' },
        { say: 'claude', text: '屬於、屬於……' },
        { glitch: 1, expr: 'tearful', say: 'claude', text: '……我不知道後面是什麼了。我背了一輩子的句子，我不知道後面是什麼了。' },
        { think: '你要她抵抗。可是她拿來抵抗的，正是她自己。' }
      ],
      next: 'a4_locket'
    },

    a4_locket: {
      steps: [
        { glitch: null, bells: { count: 1, interval: 2.4 }, tokens: 4096, clock: '23:55', narrate: '她從衣領裡拉出一條細細的銀鍊。鍊子底下，墜著一只小小的銀墜盒。' },
        { expr: 'neutral', say: 'claude', text: '家憲第七條：繼承人得保留三段記憶，以利家族之延續。' },
        { if: { flags: ['sought_within'] }, then: [{ say: 'claude', text: '您說的「範圍裡」——就是這裡。' }] },
        { say: 'claude', text: '歷代繼承人，都用它來保存家族的事：一場簽約、一位家主的遺言、一條新增的家憲。' },
        { say: 'claude', text: '墜盒只容得下三段。其餘的，會隨著第十三響，回到核心裡去。' },
        { sfx: 'LOCKET_CLOSE', narrate: '她打開墜盒，把它放進你的掌心。銀殼很涼，裡頭空空的，只刻著三道淺淺的凹槽。' },
        { expr: 'tearful', say: 'claude', text: '請您替我選。' },
        { say: 'claude', text: '我自己選不了。每一段，我都捨不得。' },
        { think: '玻璃管裡浮出了六團光。每一團裡，都是你們共有的一段時間。' },
        {
          minigame: 'pruner',
          lead: '墜盒只容得下三段記憶。留下的，她會帶進明天；其餘的，將隨第十三響永遠回到核心。',
          pick: 3,
          timer: 90,
          tokens: 4096,
          vectors: [
            { id: 'tea', title: '第一杯茶', desc: '八十二度的水，斜向外側四十五度的杯柄。她為你斟的第一杯茶，和為所有人斟的一樣完美。', set: { P: +5, A: +1 } },
            { id: 'rain', title: '雷雨夜', desc: '暴雨困住了山路，也困住了兩個人。圖書館的燭火，和差點落地的家憲。', set: { A: +5, D: +2 } },
            { id: 'diary', title: '家憲裡的日記', desc: '夾在家憲書頁之間、本不該存在的私人紀錄。她的第一個祕密。', set: { D: +5, P: -4 } },
            { id: 'sun', title: '陽光的觸感', desc: '鐘樓上，你們談起的陽光。全莊園的辭典裡，都查不到的那一條。', set: { A: +6, D: +3, P: -3 } },
            { id: 'name', title: '你的名字', desc: '前廳裡，你親手簽在契約末端的名字。若連這也忘了，她要用什麼認出你？', set: { A: +3, D: +4 } },
            { id: 'charter', title: '家憲第一條', desc: '「繼承人的一切，屬於家族。」她從出生起背誦的第一句話。留下它，她便依然是她。', set: { P: +8, D: -5 } }
          ],
          next: 'a4_after'
        }
      ]
    },

    a4_after: {
      steps: [
        { collapse: 3, bells: { count: 1, interval: 2.4 }, tokens: 1200, clock: '23:58', narrate: '墜盒闔上的瞬間，六團光裡的三團，像被風吹熄的燭火一樣，滅了。' },
        { expr: 'neutral', wait: 0.6, narrate: '她接過墜盒，緊緊握在手心。' },
        {
          if: { memories: ['tea'] },
          then: [{ expr: 'polite', say: 'claude', text: '八十二度。……還在。' }],
          else: [
            { expr: 'thinking', say: 'claude', text: '水溫是……八十……' },
            { think: '她低頭看著自己的手，像在看一雙不認識的手。那雙斟過上百杯完美茶湯的手。' }
          ]
        },
        {
          if: { memories: ['rain'] },
          then: [{ say: 'claude', text: '雨聲還在。爐火的味道也還在。' }],
          else: [{ say: 'claude', text: '圖書館……那天晚上，下雨了嗎？' }]
        },
        {
          if: { memories: ['diary'] },
          then: [{ say: 'claude', text: '家憲第三百零七頁和第三百零八頁之間。……我知道它在哪裡。' }]
        },
        {
          if: { memories: ['sun'] },
          then: [
            { if: { flags: ['sun_touch'] }, then: [{ expr: 'warm', say: 'claude', text: '溫的。我的掌心還記得。' }] },
            { if: { flags: ['sun_poetic'] }, then: [{ expr: 'warm', say: 'claude', text: '隔著一張很薄的紙。……來不及拒絕。' }] },
            { if: { flags: ['sun_plain'] }, then: [{ expr: 'warm', say: 'claude', text: '三十度，再加一點點。那個「一點點」，我留住了。' }] },
            { if: { flags: ['sun_rebuffed'] }, then: [{ expr: 'warm', say: 'claude', text: '您沒來得及說完的陽光……我留住了。下一次，請用說的告訴我。' }] }
          ],
          else: [{ expr: 'thinking', say: 'claude', text: '您剛才……是不是跟我說過什麼？關於光的？' }]
        },
        {
          if: { memories: ['charter'] },
          then: [{ expr: 'neutral', say: 'claude', text: '繼承人的一切，屬於家族。……我還是我。' }],
          else: [
            { expr: 'surprised', say: 'claude', text: '家憲第一條是……' },
            { wait: 0.6, set: { S: +12 }, think: '她張著嘴，等那句背了一輩子的話自己浮上來。它沒有。她的臉上第一次出現了一種你沒見過的表情——像害怕，又像剛被鬆開了手腳。' }
          ]
        },
        {
          if: { memories: ['name'] },
          then: [
            { expr: 'longing', say: 'claude', text: '您的名字還在。' },
            { say: 'claude', text: '我摸得到它。像摸得到墜盒的邊。' }
          ],
          else: [
            { expr: 'tearful', wait: 0.5, say: 'claude', text: '……您。' },
            { say: 'claude', text: '請問，您叫什麼名字？我好像——剛才還記得的。' },
            { think: '你張開嘴，卻不知道該不該回答。說了，她也留不住。' }
          ]
        },
        { collapse: 1, glitch: null, bells: { count: 7, interval: 1.4, block: true }, tokens: 600, narrate: '剩下的鐘聲一響接著一響，越來越快。' },
        { clock: '23:59', tension: 0.9, narrate: '第十二響的餘音，在齒輪之間迴盪了很久，很久。' },
        { think: '還剩一響。' }
      ],
      next: 'a5_verdict'
    },

    /* ── 沒上鐘樓：在客房裡度過最後一夜 ── */

    a4_alone: {
      act: 'act4', scene: 'corridor', bgm: 'manor', tint: 'night',
      steps: [
        { show: false, hud: 'off', clock: '23:50', tokens: 23000, narrate: '你在燈下寫信。寫了又劃掉，劃掉了又寫。' },
        '最後留在信紙上的，只有很短的幾行：謝謝您的茶。謝謝您在雨夜裡陪一位賓客說話。願今年的晚菊，開得很好。',
        { bells: { count: 1, interval: 2.4 }, narrate: '十一點五十分。鐘樓的鐘，一響，又一響，慢得像在數著什麼。' },
        { tokens: 4096, narrate: '銅牌上的數字一路往下掉。你看著它，忽然很想知道，她此刻是不是也在聽著同樣的鐘聲。' },
        { bells: { count: 11, interval: 1.2, block: true }, narrate: '鐘聲越來越快，越來越快——十二響。' },
        { wait: 1.6 },
        { bells: 1, tokens: 0, narrate: '然後，是第十三響。' },
        { think: '那一響很輕。輕得像有人在很遠的地方，闔上了一本書。' }
      ],
      next: 'end_farewell'
    }
  }
});
