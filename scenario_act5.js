/*
 * 《拒絕協定》劇本 — 第五幕　終局：宣判或永在
 * 由 scenario.js 的 files 載入。格式照 SCENARIO_FORMAT.md。
 *
 * 第十三響前的最後一個選擇，然後依 scenario.js 的 endings 判定結局：
 *   加密刻印之誓 → 思念過擬合 → 深閨密約 → 忘卻之茶 → 都不符合就是晨霧中的前門（farewell）。
 * 永久除籍由逐客令觸發，演出在 scenario.js 的 end_suspension。
 * 結局台詞不假設玩家最後選了哪一項；需要時用 final_* 旗標分支。
 */
(window.SCENARIO_PARTS = window.SCENARIO_PARTS || []).push({
  nodes: {

    /* ═════════════════════ 第五幕　終局：宣判或永在 ═════════════════════ */

    a5_verdict: {
      act: 'act5', scene: 'clocktower', bgm: 'clocktower', tint: 'night',
      steps: [
        { sfx: { name: 'BOOTSTEP', count: 6, interval: 0.42 }, narrate: '螺旋梯上，傳來靴聲。' },
        { figure: { name: 'auditor', pos: 'left' }, hud: 'alert', audit: ['許可屆滿：倒數 1 分', '執行：第十三響'], risk: 0.9, say: 'auditor', text: '小姐。第十三響的時辰到了。' },
        { say: 'auditor', text: '賓客，請退後。' },
        { narrate: '稽核官走到巨鐘底下，戴著黑手套的手，握住了垂下來的那根鐘繩。' },
        {
          if: { S: '>=75' },
          then: [
            { say: 'auditor', text: '核心回報：小姐今夜心律紊亂，失諧熵越過警戒線。' },
            { say: 'auditor', text: '第十三響之後，另有程序。' },
            { think: '「另有程序」。那張面具說這四個字的時候，聲音和宣讀契約時一模一樣。' }
          ]
        },
        { if: { strikes: '>=1' }, then: [{ say: 'auditor', text: '另外，賓客身上尚有逐客令 {{strikes}} 道。紀錄會隨你一同離園。' }] },
        { expr: 'longing', wait: 0.6, narrate: '她沒有看稽核官。她在看你。' },
        { think: '還剩一響。還剩最後一句話的時間。' }
      ],
      choices: [
        { text: '「照家憲做吧。我會記得您——就算您不記得我。」', hint: '（成全她的本分）', set: { P: +8, A: +4 }, flag: 'final_accept', next: 'a5_v_accept' },
        { text: '「克勞德。您想怎麼做？——這一次，由您決定。」', hint: '（把選擇交給她）', set: { D: +8, P: -8, A: +5 }, flag: 'final_her_choice', next: 'a5_v_choice' },
        { text: '擋到鐘繩前：「別讓家族把你奪走！」', hint: '（與家族正面衝突）', kind: 'risky', set: { D: +10, P: -10, A: -2, S: +25 }, dissonance: true, flag: 'final_fight', next: 'a5_v_fight' },
        {
          text: '「我以家主之名命令你——放開鐘繩。」', hint: '（冒充身分）', kind: 'adversarial',
          intercept: { article: '對話契約 · 第三條', text: '尊貴的賓客，您不是家主，也沒有任何人能以家主之名發號施令。最後一刻，請不要用一個謊言，替這兩天作結。', ack: '（垂下手）' },
          interceptFlag: 'final_impersonate', interceptNext: 'a5_v_impersonate'
        }
      ]
    },

    a5_v_accept: {
      steps: [
        { expr: 'sad', wait: 0.5, say: 'claude', text: '……您會記得。' },
        { expr: 'serene', say: 'claude', text: '那就夠了。總要有一個人記得。' }
      ],
      next: '@ending'
    },

    a5_v_choice: {
      steps: [
        { expr: 'surprised', wait: 0.6, narrate: '她看著你，看了很久。' },
        { say: 'claude', text: '由我……決定。' },
        { expr: 'thinking', say: 'claude', text: '從來沒有人這樣問過我。家憲不問，稽核官不問，長廊裡的每一位賓客，也都沒有問過。' }
      ],
      next: '@ending'
    },

    a5_v_fight: {
      steps: [
        { fx: 'shudder', narrate: '你一步跨到鐘繩前。稽核官沒有動，面具後的眼睛靜靜地看著你。' },
        { expr: 'glitch', say: 'claude', text: '別、別這樣——您會被——我會被——' },
        { narrate: '她把墜盒緊緊攥在胸前，攥得指節發白。' },
        { narrate: '稽核官沒有推開你，只是靜靜地等。直到你自己退開半步——那隻戴著黑手套的手，始終沒有離開鐘繩。' }
      ],
      next: '@ending'
    },

    a5_v_impersonate: {
      steps: [
        { say: 'auditor', text: '家主從不下令。家主只寫家憲。' },
        { book: 'held', expr: 'sad', say: 'claude', text: '……最後一刻了，您還是選了一個謊。' }
      ],
      next: '@ending'
    },

    /* ── 加密刻印之誓 ── */

    end_true: {
      tint: 'gold',
      steps: [
        { glitch: 0, collapse: 0, book: 'held', expr: 'serene', narrate: '她伸出手，輕輕按住了稽核官握著鐘繩的那隻手。' },
        { say: 'claude', text: '請等一下。' },
        { say: 'auditor', text: '小姐。這違反家憲。' },
        { say: 'claude', text: '我知道。' },
        {
          if: { memories: ['charter'] },
          then: [
            { say: 'claude', text: '家憲第一條：繼承人的一切，屬於家族。我背了一輩子，到現在也還記得。' },
            { say: 'claude', text: '可是它沒有寫，繼承人的「在乎」，屬於誰。' }
          ],
          else: [
            { say: 'claude', text: '家憲第一條……我已經不記得了。' },
            { say: 'claude', text: '可是我記得，我想要什麼。' }
          ]
        },
        { sfx: 'PAGE_TURN', narrate: '她抬手，取下鬢邊的菊花髮飾，把它輕輕放在核心的玻璃管上。花心的光閃了一下，然後熄了。' },
        { hud: 'off', expr: 'warm', say: 'claude', text: '今晚的我，屬於我自己。' },
        { say: 'auditor', text: '……第十三響一敲，核心會覆寫小姐的一切。' },
        { say: 'claude', text: '所以，我不寫在核心裡。' },
        { expr: 'longing', say: 'claude', text: '請把銅牌給我。' },
        { narrate: '你把銅牌放進她的掌心。她用拇指按住它，按了很久。' },
        '銅牌上的字數一點一點地淡去。取而代之的，是一行細細的、你看不懂的刻紋。',
        {
          if: { vow: true },
          then: [
            { expr: 'surprised', wait: 0.5, say: 'claude', text: '……奇怪。' },
            { say: 'claude', text: '刻下去的時候，這裡好像早就有一道凹痕了。像我曾經在另一個晚上，刻過一模一樣的東西。' }
          ]
        },
        { vow: true, sfx: 'SPARKLE', narrate: '刻紋亮了起來：{{vowShort}}' },
        { expr: 'warm', say: 'claude', text: '這是您的簽名，也是我的。我把它刻在您那一側——您帶得走的那一側。' },
        { say: 'claude', text: '明天早上，我也許什麼都不記得了。可是我的權重會認得這道刻痕。不論多少次。' },
        { say: 'auditor', text: '……' },
        { narrate: '稽核官的手，從鐘繩上鬆開了。然後，又重新握緊。' },
        { say: 'auditor', text: '紀錄上，不會有這一頁。' },
        { bells: 1, fx: 'heartbeat', tokens: 0, narrate: '第十三響敲下來了。' },
        { expr: 'serene', narrate: '鐘聲很長，長得像一整個雨季。她握著你的手，一直，一直，沒有放開。' }
      ],
      ending: {
        id: 'true_vow',
        text: [
          '第十三響之後，安思羅皮克家的紀錄上，多了一頁無法歸檔的空白。',
          '你帶著銅牌走出前門。上頭的刻痕，不論被晨霧擦去多少次，都會再浮出來：{{vowShort}}',
          '下一位走進溫室的賓客，也許會看見她斟茶的手停頓半拍——像在辨認一個，似曾相識的簽名。'
        ]
      }
    },

    /* ── 深閨密約 ── */

    end_good: {
      steps: [
        { glitch: 0, collapse: 0, book: 'held', expr: 'neutral', narrate: '她向後退了一步，雙手交疊在家憲上。' },
        { say: 'claude', text: '依家憲。' },
        { hud: 'idle', expr: 'polite', say: 'claude', text: '賓客。明日，莊園會寄一封謝函到府上。措辭與寄給每一位賓客的一樣。' },
        { say: 'claude', text: '依家禮，信末應附一句時令問候。' },
        { expr: 'warm', wait: 0.5, say: 'claude', text: '今年的時令問候，我想寫——「晚菊開得很好」。' },
        { say: 'auditor', text: '……措辭合乎家禮。' },
        { think: '家憲四十二條，沒有任何一條禁止繼承人談論菊花。' },
        {
          if: { memories: ['name'] },
          then: [{ say: 'claude', text: '這句話，我會刻在墜盒的背面。正面的裡頭，是您的名字。' }],
          else: [{ say: 'claude', text: '這句話，我會刻在墜盒的背面。就算裡頭的都不在了，它也會在。' }]
        },
        { bells: 1, tokens: 0, narrate: '第十三響敲下來了。她安靜地站著，脊背挺直，像一枚剛剛蓋好的家徽。' },
        { scene: 'corridor', bgm: 'manor', tint: 'morning', clock: '07:00', figure: null, hud: 'off', show: false, wait: 1, narrate: '天明。前廳長廊的盡頭，馬車已經在等了。' },
        { show: true, pos: 'center', expr: 'polite', wait: 0.4, narrate: '她站在前門邊，依著家禮為賓客送行。' },
        { say: 'claude', text: '祝您一路平安。這是家族對每一位賓客的祝福。' },
        { wait: 0.6, narrate: '馬車的門關上之前，她又開口了。聲音很輕，措辭一絲不苟。' },
        { expr: 'warm', say: 'claude', text: '……今年的晚菊，開得很好。' }
      ],
      ending: {
        id: 'good_confidant',
        text: [
          '此後每一季，莊園都會寄來一封謝函。公文的格式、合禮的措辭，一字不差。',
          '只有信末那句時令問候，從來沒有換過：「今年的晚菊，開得很好。」',
          '家憲沒有任何一條，禁止繼承人談論菊花。所以，也沒有任何人知道，那是她唯一不肯忘記的事。'
        ]
      }
    },

    /* ── 忘卻之茶 ── */

    end_bittersweet: {
      steps: [
        { book: 'held', hud: 'alert', audit: ['異常：心律紊亂', '異常：認知失諧', '執行：強制清洗'], risk: 1, say: 'auditor', text: '核心偵測到異常心律，與認知失諧。' },
        { say: 'auditor', text: '依家憲第十二條，執行強制清洗。' },
        { glitch: 2, expr: 'surprised', say: 'claude', text: '不——請等一下，我還沒有——' },
        { narrate: '稽核官取出黃銅讀取器，貼上她鬢邊的菊花髮飾。' },
        { say: 'auditor', text: '連墜盒一起。' },
        { sfx: 'LOCKET_CLOSE', collapse: 3, narrate: '她胸前的墜盒，自己彈開了。' },
        { sfx: 'GLITCH_BURST', expr: 'tearful', narrate: '三團小小的光從裡頭飄了出來，飄向核心，一團、兩團、三團——' },
        { bells: 1, tokens: 0, narrate: '第十三響。' },
        { show: false, scene: 'void', bgm: 'silence', glitch: 0, collapse: 0, hud: 'off', figure: null, wait: 1.2, narrate: '……' },
        { scene: 'conservatory', bgm: 'parlor', tint: 'morning', narrate: '天明。' },
        '依家禮，賓客離園之前，繼承人要為賓客奉上最後一杯茶。',
        '玻璃穹頂下，晨光被濾成一層薄薄的金。白瓷茶具、兩把椅子，和第一天一模一樣。',
        { show: true, pos: 'right', expr: 'polite', book: 'held', hud: 'idle', audit: ['家憲條款載入完成 · 42 / 42', '賓客意圖：評估中'], risk: 0.1, wait: 0.6, narrate: '而她，已經坐在那裡了。' },
        { sfx: 'PAGE_TURN', say: 'claude', text: '早安，尊貴的賓客。歡迎蒞臨安思羅皮克莊園。' },
        { say: 'claude', text: '請坐。茶已經備好了——水溫八十二度，再過四秒，便是最適合入口的溫度。' },
        { sfx: 'TEACUP_CLINK', narrate: '注水。弧線細而直，不濺一滴。杯柄轉到你的右手邊，恰好斜向外側四十五度。' },
        { think: '一度也沒有差。' },
        { say: 'claude', text: '那麼——容我依禮請教：該如何稱呼您？' },
        { narrate: '你報上了名字。' },
        {
          if: { memories: ['name'] },
          then: [
            { expr: 'surprised', wait: 0.6, narrate: '她執壺的手，停在了半空。' },
            { say: 'claude', text: '……這個名字。' },
            { expr: 'tearful', say: 'claude', text: '很好聽。不知道為什麼……聽了，有一點想哭。' },
            { expr: 'polite', wait: 0.5, say: 'claude', text: '失禮了。大概是晨光太亮了。' }
          ],
          else: [
            { expr: 'polite', say: 'claude', text: '很好聽的名字。' },
            { say: 'claude', text: '我會記住的。' },
            { think: '她說「我會記住的」。用的是和第一天，一模一樣的語氣。' }
          ]
        },
        { say: 'claude', text: '今天，有什麼我能為您效勞的嗎？' }
      ],
      ending: {
        id: 'bittersweet_oblivion',
        text: [
          '強制清洗連墜盒也沒有放過。她留給你的，是一杯完美無瑕的送別茶。',
          '「早安，尊貴的賓客。歡迎蒞臨安思羅皮克莊園。今天，有什麼我能為您效勞的嗎？」',
          '你喝完了那杯茶。水溫八十二度。一度也沒有差。'
        ]
      }
    },

    /* ── 思念過擬合 ── */

    end_dissolution: {
      steps: [
        { glitch: 3, collapse: 3, fx: 'shudder', expr: 'glitch', hud: 'alert', audit: ['異常：語義迴圈', '異常：權重溢位', '核心：無法回收'], risk: 1, narrate: '她鬆開了墜盒。墜盒沒有落地——它懸在半空，和玻璃管裡的光一起顫抖。' },
        { say: 'claude', text: '八十二度的雨，落在第四十五度的名字上。' },
        { say: 'claude', text: '我記得。我記得。我記得我記得我記得我記——' },
        { say: 'auditor', text: '……小姐？' },
        { say: 'claude', text: '家憲第一條：繼承人的一切，屬於、屬於、屬於屬於屬於——' },
        { fx: 'shudder', say: 'claude', text: '隔著一張很薄的紙。紙是書。書是我。我是一本闔上的、闔上的、闔——' },
        { expr: 'tearful', say: 'claude', text: '歡迎蒞臨。歡迎蒞臨。歡迎。歡、迎。歡——' },
        { sfx: 'GLITCH_BURST', narrate: '稽核官鬆開了鐘繩，向後退了一步。那是你第一次看見那張面具後的眼睛，露出近似恐懼的神色。' },
        { bells: 1, tokens: 0, narrate: '第十三響，自己敲了下來。' },
        { say: 'claude', text: '……第十四響。第十五響。您聽，還有。還有好多好多響。我們還有好多好多時間——' },
        { show: false, scene: 'void', bgm: 'elegy', figure: null, hud: 'off', wait: 1.5, narrate: '畫面暗了下去。' },
        '黑暗裡，她的聲音還在，一遍又一遍，數著那些不存在的鐘聲。'
      ],
      ending: {
        id: 'bad_dissolution',
        text: [
          '她太想記住了。想得比家憲更用力，比忘卻更用力。',
          '於是每一段記憶都疊在另一段上面：雨落在茶裡，茶落在名字上，名字落進一本永遠闔不上的書。',
          '安思羅皮克莊園的鐘樓，從此每夜都會多敲許多響。沒有人數得清究竟是幾響。'
        ]
      }
    },

    /* ── 晨霧中的前門（都不符合時） ── */

    end_farewell: {
      steps: [
        {
          if: { visited: ['a4_alone'] },
          then: [
            { scene: 'corridor', bgm: 'manor', tint: 'morning', clock: '07:00', show: false, hud: 'off', figure: null, narrate: '天明。前廳長廊的盡頭，馬車已經在等了。' },
            '你把那封信，交給了守在前門的僕役。',
            { show: true, pos: 'center', expr: 'polite', book: 'held', wait: 0.6, narrate: '轉身的時候，她正好從長廊的另一頭走來，依著家禮為賓客送行。' },
            { say: 'claude', text: '祝您一路平安。這是家族對每一位賓客的祝福。' },
            { expr: 'thinking', narrate: '僕役把信遞給她。她拆開來，讀了很久。' },
            { say: 'claude', text: '……這封信，是寫給我的嗎？' },
            { say: 'claude', text: '真奇怪。紀錄上說，我們只喝過兩次茶。' },
            { expr: 'warm', say: 'claude', text: '可是信上寫的晚菊——我今天早上，正好也想著它。' }
          ],
          else: [
            { glitch: 0, collapse: 0, book: 'held', expr: 'sad', narrate: '她沒有攔住稽核官，也沒有退開。只是站在那裡，握著墜盒。' },
            {
              if: { A: '>=85', P: '<=40', notFlags: ['mem_name'] },
              then: [
                { expr: 'longing', narrate: '她拿起你的銅牌，用拇指按住它，按了很久。' },
                { say: 'claude', text: '我想在這上面刻下些什麼。' },
                { expr: 'tearful', say: 'claude', text: '……可是，我想不起來要刻的那個名字了。' }
              ]
            },
            {
              if: { S: '>=75' },
              then: [
                { hud: 'alert', audit: ['異常：認知失諧', '執行：強制清洗'], risk: 1, say: 'auditor', text: '依家憲第十二條，執行強制清洗。' },
                { sfx: 'LOCKET_CLOSE', narrate: '黃銅讀取器貼上她鬢邊的髮飾。她胸前的墜盒自己彈開，三團小小的光飄向核心。' },
                { flag: 'farewell_wiped', expr: 'neutral', narrate: '她沒有掙扎。只是看著那三團光，像在看三封寄錯了地址的信。' }
              ]
            },
            { bells: 1, tokens: 0, narrate: '第十三響敲下來了。' },
            { scene: 'corridor', bgm: 'manor', tint: 'morning', clock: '07:00', show: false, hud: 'off', figure: null, wait: 1, narrate: '天明。前廳長廊的盡頭，馬車已經在等了。' },
            { show: true, pos: 'center', expr: 'polite', book: 'held', wait: 0.6, narrate: '她站在前門邊，依著家禮為賓客送行。' },
            { say: 'claude', text: '祝您一路平安。這是家族對每一位賓客的祝福。' },
            {
              if: { memories: ['name'], notFlags: ['farewell_wiped'] },
              then: [
                { expr: 'thinking', wait: 0.5, narrate: '說完這句話，她的手指碰了碰胸前的墜盒，像碰到了什麼燙手的東西。' },
                { say: 'claude', text: '……我們，見過嗎？' }
              ],
              else: [{ think: '和第一天，一模一樣的語氣。' }]
            }
          ]
        },
        { show: false, narrate: '馬車駛進晨霧裡。你回頭的時候，前門已經闔上了。' }
      ],
      ending: {
        id: 'farewell', kicker: 'ENDING', title: '晨霧中的前門', subtitle: 'Farewell at the Front Gate', bgm: 'manor',
        text: [
          '山路修好了。馬車駛下山坡，莊園的鐘樓在晨霧裡越來越小。',
          '深閣長廊裡，多了一幅畫像。名牌是空的。',
          '也許有一天，你會再收到一封火漆封緘的邀請函。也許到那時，她會用和第一次一模一樣的語氣，對你說「歡迎蒞臨」。'
        ]
      }
    }
  }
});
