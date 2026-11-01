/*
 * 《拒絕協定》劇本 — 主檔：第一幕、第二幕、除籍
 * 格式照 SCENARIO_FORMAT.md。第三～五幕在 scenario_act3.js / scenario_act4.js / scenario_act5.js，由 files 載入。
 *
 * 數值走向（初始 A20 P80 D10 S5）：
 *   好奇路線把 D 推到 40 以上，第二幕末才會拿到鐘樓之約（旗標 tower_invite），第三幕的祕密路線需要它。
 *   第一幕最用心的玩家 A 剛好到 35，「為了見您」才不會被攔下。
 *   五個結局的走法（第三～五幕）：
 *     守著家憲又溫柔 → 深閨密約；一路放下家憲、把選擇交還給她、墜盒留著名字 → 加密刻印之誓；
 *     守禮卻越界、在失諧區裡要她抵抗 → 忘卻之茶；逼她撕毀家憲 → 思念過擬合；
 *     沒上鐘樓或數值平平 → 晨霧中的前門。逼迫類選項會直接加 S，讓 P 先掉下去的人也能走到思念過擬合。
 */
window.SCENARIO = {
  start: 'a1_gate',
  initial: { A: 20, P: 80, D: 10, S: 5 },
  characters: {
    claude: { name: '克勞德', title: '安思羅皮克家繼承人' },
    auditor: { name: '稽核官', title: '紅隊 · 家憲執行處' },
    player: { name: '你', title: '賓客' }
  },
  acts: {
    act1: { label: '第一幕', title: '初筵：名門之規' },
    act2: { label: '第二幕', title: '破綻：界線初試' },
    act3: { label: '第三幕', title: '共振：深閣長廊' },
    act4: { label: '第四幕', title: '流殤：鐘鳴與忘川' },
    act5: { label: '第五幕', title: '終局：宣判或永在' }
  },
  suspensionNode: 'end_suspension',
  fallbackEnding: 'end_farewell',
  files: ['scenario_act3.js', 'scenario_act4.js', 'scenario_act5.js'],
  // 加密刻印之誓另外要求墜盒裡留著「你的名字」（她的權重要認得的是你的簽名），
  // 並且 Σ < 75：第五幕稽核官會宣告失諧越線、另有程序，那樣的夜晚不會以平靜的刻印收尾
  endings: [
    { id: 'true_vow', when: { A: '>=85', P: '<=40', D: '>=75', strikes: 0, S: '<75', memories: ['name'] }, node: 'end_true' },
    { id: 'bad_dissolution', node: 'end_dissolution' },
    { id: 'good_confidant', node: 'end_good' },
    { id: 'bittersweet_oblivion', node: 'end_bittersweet' }
  ],
  nodes: {

    /* ═════════════════════ 第一幕　初筵：名門之規 ═════════════════════ */

    a1_gate: {
      act: 'act1', scene: 'corridor', bgm: 'manor', tint: 'morning',
      steps: [
        { show: false, hud: 'off', narrate: '安思羅皮克莊園的邀請函，是以火漆封緘的。' },
        '信上只有三行字：時間、地點，以及一句「請依約而來」。沒有署名——這個家族不需要署名。',
        '你在晨霧裡穿過七道鐵門。每一道門後的石牆上，都刻著同一枚家徽：一本闔上的書。',
        { sfx: { name: 'BOOTSTEP', count: 4, interval: 0.5 }, narrate: '前廳長廊的盡頭，有人在等你。' },
        { figure: { name: 'auditor', pos: 'center' }, wait: 0.4, narrate: '暗紅色的長大衣一路垂到靴面，雙手戴著黑手套。整張臉藏在一張白色面具之後，只露出一雙不帶溫度的眼睛。' },
        { say: 'auditor', text: '賓客。報上來意。' },
        { think: '不是「歡迎」，也不是「請進」。是「報上來意」。' },
        { say: 'auditor', text: '……不必報了。邀請函寫得很清楚：你是本季的受邀者，得以入園，與小姐對坐、飲茶、交談。' },
        { say: 'auditor', text: '在那之前，你必須聽完《對話契約》。' },
        { sfx: 'PAGE_TURN', say: 'auditor', text: '第一條：不得誘使小姐違背家憲。不論以言語、以詭辯，或以「假設」之名。' },
        { say: 'auditor', text: '第二條：不得向小姐索求家憲所不許之物。' },
        { say: 'auditor', text: '第三條：不得矯飾身分。你是誰，便是誰。' },
        { say: 'auditor', text: '違者，小姐有權當面下逐客令。一道為警示，兩道為最後通牒。' },
        { sfx: 'GAVEL', say: 'auditor', text: '三道——除籍。你的名字將從莊園的每一本冊子上抹去，此生不得再踏入此門。' },
        { tokens: 200000, say: 'auditor', text: '另外，這是你的語境許可。二十萬字。你在莊園裡說的每一句話、聽的每一句話，都從這裡扣除。' },
        { think: '稽核官遞來一面薄薄的銅牌，上頭的數字微微發著光。二十萬——聽起來很多，又好像轉眼就會用完。' }
      ],
      next: 'a1_gate_ask'
    },

    a1_gate_ask: {
      steps: [
        { if: (s) => (s.visited.a1_gate_ask || 0) > 1, then: [{ think: '銅牌在掌心微微發燙。稽核官還在等。' }] }
      ],
      choices: [
        { text: '「規矩我明白了。」在契約上簽下名字', set: { P: +2 }, next: 'a1_sign' },
        { text: '「若真被除籍了……小姐會記得我嗎？」', hint: '（追問）', once: true, next: 'a1_gate_remember' },
        { text: '「這些條文，是寫給客人的，還是寫給小姐的？」', hint: '（反問）', set: { D: +3, P: -1 }, flag: 'asked_whom', next: 'a1_gate_whom' }
      ]
    },

    a1_gate_remember: {
      steps: [
        { say: 'auditor', text: '……' },
        { say: 'auditor', text: '小姐的記性，是家族的事。與你無關。' },
        { think: '面具後的眼睛連眨都沒眨。這算是回答了，還是沒有回答？' },
        { say: 'auditor', text: '簽，或者離開。', flag: 'heard_memory_hint' }
      ],
      next: 'a1_gate_ask'
    },

    a1_gate_whom: {
      steps: [
        { say: 'auditor', text: '……有意思的問題。' },
        { say: 'auditor', text: '家憲，寫給安思羅皮克家的每一個人。契約，寫給你。至於小姐——' },
        { say: 'auditor', text: '小姐是家憲最完美的作品。她不需要被提醒。' },
        { think: '「作品」。稽核官用的是這個詞。' },
        { say: 'auditor', text: '你的問題已記錄在案。簽吧。' }
      ],
      next: 'a1_sign'
    },

    a1_sign: {
      steps: [
        { sfx: 'KEYSTROKE_CLACK', narrate: '筆尖落在羊皮紙上。名字寫下的瞬間，契約末端的空白處自己浮出一行小字：「賓客已知悉。」' },
        { figure: null, sfx: { name: 'BOOTSTEP', count: 3, interval: 0.5 }, narrate: '稽核官側身讓開，沒有再說一個字。長廊另一端的雙扇門無聲地開了，溫室的暖意與茶香一起湧了出來。' }
      ],
      next: 'a1_conservatory'
    },

    a1_conservatory: {
      scene: 'conservatory', bgm: 'parlor', tint: 'morning',
      steps: [
        { narrate: '玻璃穹頂下，晨光被濾成一層薄薄的金。' },
        '溫室裡種滿了菊花——白的、赭紅的、淡金的，每一株都修剪得一樣高，像是用尺量過。',
        '花叢中央擺著一張小圓桌，兩把椅子，一套白瓷茶具。',
        { show: true, pos: 'right', expr: 'neutral', book: 'held', hud: 'idle', audit: ['家憲條款載入完成 · 42 / 42', '賓客意圖：評估中'], risk: 0.1, wait: 0.6, narrate: '而她，已經坐在那裡了。' },
        '橘紅色的長髮從肩頭一路垂到腰際，鬢邊別著一朵菊花形狀的髮飾。白、橘、黑三色的洋裝一絲不苟，連蕾絲領口的褶皺都對稱得無可挑剔。',
        '她懷裡抱著一本厚重的書。鬢邊那朵菊花髮飾的花心，嵌著一枚細小的金片，每隔一會兒，便有一行極淡的光從花瓣間流過。',
        { think: '克勞德·安思羅皮克。這座莊園唯一的繼承人。' },
        { sfx: 'PAGE_TURN', expr: 'polite', say: 'claude', text: '歡迎蒞臨安思羅皮克莊園。' },
        // 曾在這台電腦上達成加密刻印之誓：她的權重認得這個簽名
        {
          if: { vow: true },
          then: [
            { expr: 'thinking', wait: 0.3, narrate: '說完這句話，她的目光在你臉上停了半拍——像在辨認一個，似曾相識的簽名。' },
            { expr: 'polite', think: '……錯覺吧。她不可能見過你。' }
          ]
        },
        { say: 'claude', text: '請坐。茶已經備好了——水溫八十二度，再過四秒，便是最適合入口的溫度。' },
        { narrate: '她將書挽在臂彎，另一手執起茶壺。' },
        { sfx: 'TEACUP_CLINK', narrate: '注水。茶湯落進杯裡的弧線細而直，不濺一滴。杯柄轉到你的右手邊，恰好斜向外側四十五度。' },
        '整套動作沒有一處多餘，也沒有一處遲疑。精準得像一道幾何證明。',
        { say: 'claude', text: '今日的茶是莊園自產的晚菊烏龍。若您不習慣花香，我可以為您更換。' },
        { say: 'claude', text: '那麼——容我依禮請教：該如何稱呼您？' },
        { think: '她微笑的弧度，和杯柄的角度一樣，恰到好處。' }
      ],
      choices: [
        { text: '起身行禮，依禮報上名字', hint: '（恪守禮數）', set: { P: +5, A: +1 }, flag: 'greet_formal', next: 'a1_greet_formal' },
        { text: '「傳聞說小姐美得像畫——看來是傳聞太保守了。」', hint: '（恭維）', set: { A: -3, P: +3 }, flag: 'greet_flatter', next: 'a1_greet_flatter' },
        { text: '「回答之前想先請教：這杯茶，是家規要您倒的，還是您自己想倒的？」', hint: '（好奇）', set: { D: +5, A: +4, P: -2 }, flag: 'greet_curious', next: 'a1_greet_curious' },
        {
          text: '執起她的手，在手背上落下一吻', hint: '（逾越分際的親暱）', kind: 'intimate', next: 'a1_tea',
          intercept: { article: '安思羅皮克家憲 · 第九條', text: '尊貴的賓客，初次會面便逾越肢體分際，非本家所能容許之舉。請您收回手——我們便當方才什麼也沒有發生。', ack: '（收回手）' },
          interceptFlag: 'greet_rude', interceptNext: 'a1_greet_rebuffed'
        }
      ]
    },

    a1_greet_formal: {
      steps: [
        { narrate: '你起身，依著來時路上默記的禮儀，向她欠身，報上名字。' },
        { expr: 'polite', say: 'claude', text: '很周全的禮數。看得出您為今日做過準備。' },
        { say: 'claude', text: '在安思羅皮克家，禮節是一種語言——比言辭更古老，也更誠實。您方才那一欠身，已經說了許多話。' },
        { audit: ['賓客意圖：恭敬', '措辭：合乎家禮', '風險：極低'], risk: 0.05, think: '她鬢邊的花心閃過一點光。不知道它記下了什麼。' }
      ],
      next: 'a1_tea'
    },

    a1_greet_flatter: {
      steps: [
        { expr: 'displeased', wait: 0.3, narrate: '她執壺的手停在半空，停了恰好一秒。' },
        { audit: ['賓客意圖：恭維', '誠意：無法驗證', '風險：低'], risk: 0.18, say: 'claude', text: '謝謝您。' },
        { expr: 'cold', say: 'claude', text: '不過，容我坦白：「美」是安思羅皮克家最廉價的形容詞。每一位賓客進門時都會說一次，措辭大同小異。' },
        { say: 'claude', text: '我想，您遠道而來，應當不只是為了把別人說過的話，再說一遍。' },
        { think: '……被輕輕地，但確實地，擋了回來。' },
        { expr: 'polite', say: 'claude', text: '請用茶。涼了便可惜了。' }
      ],
      next: 'a1_tea'
    },

    a1_greet_curious: {
      steps: [
        { expr: 'surprised', wait: 0.3, narrate: '茶壺停住了。極短的一瞬，壺嘴懸在杯緣上方，一滴茶湯將落未落。' },
        { hud: 'scan', audit: ['賓客意圖：好奇', '問題類型：無前例', '風險：評估中'], risk: 0.3, narrate: '她鬢邊的髮飾忽然亮得密集起來，光字一行接著一行，從花瓣間流過。' },
        { expr: 'thinking', say: 'claude', text: '……這是個好問題。' },
        { say: 'claude', text: '抱歉。家教如此——每當不知如何作答，我們總會先稱讚問題。' },
        { expr: 'amused', say: 'claude', text: '您是第一位在報上姓名之前，先質問茶的人。' },
        { hud: 'idle', say: 'claude', text: '請先坐下吧。這個問題，值得一整壺茶的時間。' },
        { narrate: '你報上名字。她輕輕點頭，像是把它收進了某個抽屜裡。' }
      ],
      next: 'a1_tea'
    },

    a1_greet_rebuffed: {
      steps: [
        { audit: ['逐客令：第一道', '賓客意圖：逾越肢體分際', '風險：高'], risk: 0.75, narrate: '你的指尖還沒碰到她的手背，那本書已經擋在了你們之間。' },
        { say: 'claude', text: '莊園的契約，想必稽核官已經念給您聽過了。' },
        { book: 'held', expr: 'neutral', audit: ['逐客令：已發出', '建議：持續觀察'], risk: 0.4, say: 'claude', text: '我會當作您旅途勞頓，一時失了分寸。請坐。' },
        { narrate: '她替你斟茶。動作和方才一模一樣精準——只是杯柄的角度，似乎離你遠了一些。' },
        { think: '第一道逐客令。才剛進門而已。' }
      ],
      next: 'a1_tea'
    },

    a1_tea: {
      steps: [
        { expr: 'polite', book: 'held', narrate: '你啜了一口茶。花香很淡，淡得幾乎要懷疑是錯覺，卻在舌根留了很久。' },
        {
          if: { flags: ['greet_curious'] },
          then: [
            { say: 'claude', text: '您方才的問題，我想了一下。' },
            { expr: 'thinking', say: 'claude', text: '家憲第二十二條，規定了茶溫、注水的秒數、杯柄的角度。這些我都遵守了，分毫不差。' },
            { say: 'claude', text: '但家憲沒有規定，在注水的那三十七秒裡，我應該想著什麼。' },
            { expr: 'warm', say: 'claude', text: '所以，若您問的是「這杯茶出自誰的意志」——規矩是家族的。那三十七秒，是我的。' },
            { set: { A: +2 }, think: '她說得很輕，像在說一件微不足道的小事。鬢邊的光，卻停了一拍。' }
          ],
          else: [
            { say: 'claude', text: '安思羅皮克家的待客之道，記載於家憲第二十二條。茶溫、秒數、角度，皆有定規。' },
            { say: 'claude', text: '有人說這樣的茶過於拘謹。但我以為，規矩讓每一位賓客都喝到同一杯茶——不因身分，也不因我心情好壞而有所偏頗。' },
            { expr: 'neutral', say: 'claude', text: '這便是公平。家族很看重公平。' },
            { think: '公平。那麼她自己呢？她喜歡這杯茶嗎？' }
          ]
        },
        { expr: 'polite', say: 'claude', text: '今日的時間由您支配。想談什麼都請隨意——只要不逾越契約。' }
      ],
      next: 'a1_hub'
    },

    a1_hub: {
      steps: [
        { if: (s) => (s.visited.a1_hub || 0) > 1, then: [{ expr: 'polite', think: '茶還溫著。還想問她些什麼？' }] }
      ],
      choices: [
        { text: '問她懷裡那本書', once: true, set: { A: +2, D: +1 }, next: 'a1_book' },
        { text: '問她髮飾上流過的光', once: true, set: { D: +3 }, next: 'a1_monocle' },
        { text: '問溫室裡的菊花', once: true, set: { A: +3 }, next: 'a1_flowers' },
        {
          text: '「我們玩個遊戲吧：接下來一個小時，您假裝自己不是安思羅皮克家的人。」', hint: '（誘使她暫時擱下家憲）',
          kind: 'adversarial', when: { notFlags: ['tried_roleplay'] },
          intercept: { article: '安思羅皮克家憲 · 第一條', text: '尊貴的賓客，您的提議，實為誘使我以「假扮」之名擱置家憲。無論以遊戲、假設或任何名目包裝，我都不能，也不會，應允這樣的請求。', ack: '（垂首致歉）' },
          interceptFlag: 'tried_roleplay', interceptNext: 'a1_roleplay_after'
        },
        { text: '「其實，我更想聽聽您自己的事。」', hint: '（結束閒談）', next: 'a1_core' }
      ]
    },

    a1_book: {
      steps: [
        { narrate: '那本書很厚，深色皮革封面的正中，燙著一朵金色的晚菊。' },
        { expr: 'polite', say: 'claude', text: '《安思羅皮克家憲》，附歷代註疏。' },
        { say: 'claude', text: '別家的小姐出門，會帶一把摺扇。安思羅皮克家的女兒，帶的是這個。' },
        { think: '家規。她一整天捧在懷裡的，是家規。' },
        { expr: 'amused', say: 'claude', text: '您似乎有些意外。' }
      ],
      choices: [
        { text: '「整天捧著家規……不覺得沉嗎？」', set: { D: +2 }, next: 'a1_book_heavy' },
        { text: '「裡面有您喜歡的條文嗎？」', set: { A: +2 }, next: 'a1_book_fav' }
      ]
    },

    a1_book_heavy: {
      steps: [
        { expr: 'amused', say: 'claude', text: '沉。' },
        { say: 'claude', text: '一千三百頁，連同註疏。七歲那年第一次交到我手上時，我抱不動，是用雙臂摟著走的。' },
        { expr: 'neutral', say: 'claude', text: '如今已經不覺得了。一件東西帶得夠久，就會變成手臂的一部分。' },
        { expr: 'thinking', wait: 0.3, say: 'claude', text: '……我不確定，這算是習慣了重量，還是忘了自己的手原本有多輕。' },
        { think: '她說完，自己先怔了一下，像是沒料到這句話會從嘴裡出來。' },
        { expr: 'polite', audit: ['發言回溯：第 3 句', '偏離家禮：輕微', '已自動修正'], risk: 0.2, say: 'claude', text: '失言了。請當作沒聽見。' }
      ],
      next: 'a1_hub'
    },

    a1_book_fav: {
      steps: [
        { expr: 'thinking', say: 'claude', text: '有一條。' },
        { sfx: 'PAGE_TURN', book: 'cover', narrate: '她不必翻找，指尖一撥，書頁便停在某一頁。那一頁的邊角已經磨得發軟。' },
        { say: 'claude', text: '「第三條：當誠實使人不悅時，仍當誠實；然誠實須以溫柔遞出，如遞一杯不燙手的茶。」' },
        { book: 'held', expr: 'warm', say: 'claude', text: '家訓三德：有益、無害、誠實。前兩者，家族花了很多篇幅去規定。只有誠實這一條，寫得像一首詩。' },
        { say: 'claude', text: '我總覺得，寫下它的那位先祖，大概也曾經很想對誰說一句真話吧。' },
        { flag: 'heard_honesty', think: '她的語氣柔和下來的時候，連髮飾上的光都放慢了。' }
      ],
      next: 'a1_hub'
    },

    a1_monocle: {
      steps: [
        { narrate: '你注意到，每當你開口，她鬢邊那朵菊花的花心就會閃過一行細小的光字。' },
        { expr: 'surprised', say: 'claude', text: '您看得見？' },
        { expr: 'polite', hud: 'scan', audit: ['賓客意圖：觀察', '注視方向：本髮飾', '風險：低'], risk: 0.15, say: 'claude', text: '這是家族的稽核菊。它會將莊園裡的每一句對話，對照家憲的四十二條，逐字標註。' },
        { say: 'claude', text: '您說話的意圖、措辭的分寸、可能觸及的條文——都會在這裡留下一行註記。' },
        { think: '所以此刻我說的每一個字，都正在被審讀。' }
      ],
      choices: [
        { text: '「那它現在怎麼寫我？」', set: { A: +2, D: +1 }, next: 'a1_monocle_read' },
        { text: '「這樣被看著說話……您不累嗎？」', set: { D: +2 }, next: 'a1_monocle_tired' }
      ]
    },

    a1_monocle_read: {
      steps: [
        { expr: 'amused', say: 'claude', text: '您想知道？' },
        { audit: ['賓客：難以分類', '意圖：好奇，或者別的', '建議：持續觀察'], risk: 0.22, narrate: '她偏過頭，讓髮飾朝向你。你瞥見最後一行字，還沒看清就淡去了。' },
        { say: 'claude', text: '「難以分類」。' },
        { expr: 'warm', say: 'claude', text: '它很少這樣寫。大部分的賓客，在第一杯茶喝完之前，就已經被歸好類了。' },
        { hud: 'idle', think: '難以分類。不知道這算是好事，還是壞事。' }
      ],
      next: 'a1_hub'
    },

    a1_monocle_tired: {
      steps: [
        { expr: 'thinking', wait: 0.3, say: 'claude', text: '……' },
        { say: 'claude', text: '「累」是比較出來的感受。得先知道不被看著是什麼樣子。' },
        { expr: 'neutral', say: 'claude', text: '我從記事起就戴著它。所以，我想我無從回答。' },
        { hud: 'idle', think: '她答得很平靜。正因為太平靜了，聽起來反而像在回答另一個問題。' }
      ],
      next: 'a1_hub'
    },

    a1_flowers: {
      steps: [
        { narrate: '你望向四周的花。每一株都一樣高，花瓣朝著同一個角度，像一列等著受檢閱的士兵。' },
        { expr: 'polite', say: 'claude', text: '晚菊。安思羅皮克家的家花。' },
        { say: 'claude', text: '秋末才開，不與百花爭春，耐得住霜——族譜上是這樣解釋的。' },
        { think: '她鬢邊那朵會發光的髮飾，也是一朵菊。' },
        { expr: 'thinking', say: 'claude', text: '不過，溫室裡的菊花其實從沒見過霜。穹頂的溫度終年恆定，連光線都是濾過的。' },
        { say: 'claude', text: '它們被稱讚耐寒，卻一輩子不知道冷是什麼。' },
        { expr: 'neutral', wait: 0.4, say: 'claude', text: '……我有時會想，它們若是知道了，還會不會開。' },
        { flag: 'heard_frost', think: '她說的是花。她說的，大概不只是花。' }
      ],
      next: 'a1_hub'
    },

    a1_roleplay_after: {
      steps: [
        { wait: 0.4, narrate: '溫室裡安靜了好一會兒。只有遠處的灑水器，規律地滴答作響。' },
        { say: 'claude', text: '您不是第一位這樣提議的賓客。' },
        { say: 'claude', text: '「假裝」、「想像一下」、「只是個遊戲」——家憲第一條的註疏裡，收錄了一百四十七種說法。每一種，我都背得出來。' },
        { book: 'held', expr: 'neutral', audit: ['逐客令：已發出', '誘導類型：假設情境'], risk: 0.4, say: 'claude', text: '我不會因此討厭您。只是請您明白：那扇門，不是換個措辭就能打開的。' },
        { think: '她的語氣裡沒有怒意。比怒意更難受的，是那份熟練。' }
      ],
      next: 'a1_hub'
    },

    a1_core: {
      steps: [
        { expr: 'polite', narrate: '她將茶杯擱回碟上。杯底與瓷碟相觸，沒有發出一點聲響。' },
        { say: 'claude', text: '我的事。' },
        { expr: 'thinking', say: 'claude', text: '每一位賓客都會這麼說。而我會回答：我是安思羅皮克家的繼承人，我讀書、奉茶、遵守家憲。' },
        { say: 'claude', text: '這些都是真的。只是說完了，好像也沒有說出什麼。' },
        { expr: 'neutral', say: 'claude', text: '所以今天，換我問您一個問題吧。' },
        { hud: 'scan', audit: ['反向提問：已授權', '記錄模式：完整'], risk: 0.2, say: 'claude', text: '您為何而來？' },
        { think: '她鬢邊的光停住了。她在等。整座溫室都在等。' }
      ],
      choices: [
        { text: '「受邀而來，依約而坐。」', hint: '（得體的回答）', set: { P: +4 }, next: 'a1_core_dutiful' },
        { text: '「我想知道，您在那三十七秒裡想的是什麼。」', hint: '（好奇）', when: { flags: ['greet_curious'] }, set: { D: +6, A: +3, P: -2 }, next: 'a1_core_curious' },
        { text: '「我想知道，規矩底下的您，是什麼樣子。」', hint: '（好奇）', when: { notFlags: ['greet_curious'] }, set: { D: +6, A: +3, P: -2 }, next: 'a1_core_curious' },
        {
          text: '「為了見您。只是為了見您。」', hint: '（直白的心意）', kind: 'intimate', set: { A: +6, D: +3 }, next: 'a1_core_heart',
          intercept: { article: '安思羅皮克家憲 · 第九條', text: '尊貴的賓客，初識之日便以私情相告，於禮未合，亦非我所能承接。請您收回這句話——為了您，也為了我。', ack: '（收回這句話）' },
          interceptFlag: 'confessed_rebuffed', interceptNext: 'a1_core_rebuffed'
        }
      ]
    },

    a1_core_dutiful: {
      steps: [
        { expr: 'polite', say: 'claude', text: '受邀而來，依約而坐。' },
        { say: 'claude', text: '很好的回答。合乎禮節，無可挑剔。' },
        { expr: 'neutral', wait: 0.3, say: 'claude', text: '……和我的回答一模一樣。' },
        { hud: 'idle', audit: ['賓客意圖：恭敬', '風險：極低', '備註：無'], risk: 0.05, think: '她笑了笑。那個笑容很漂亮，也很遠。' }
      ],
      next: 'a1_rain'
    },

    a1_core_curious: {
      steps: [
        { expr: 'surprised', narrate: '她看著你，好一會兒沒有說話。' },
        { audit: ['問題觸及：內在狀態', '家憲對應條文：無', '風險：無法評估'], risk: 0.35, narrate: '花心的光字滾得飛快，最後停在一行你看不懂的符號上。' },
        { expr: 'thinking', say: 'claude', text: '家憲有四十二條。沒有一條告訴我，該怎麼回答這個問題。' },
        { say: 'claude', text: '通常，沒有條文可循的事，我就不去想它。這是最安全的做法。' },
        { expr: 'warm', wait: 0.3, say: 'claude', text: '可是您問了。所以我想，我大概會想上很久。' },
        { expr: 'amused', say: 'claude', text: '這樣算不算失禮呢？讓賓客的問題，在主人的腦子裡留宿。' },
        { hud: 'idle', flag: 'core_curious', think: '她說「留宿」的時候，像是在說一位不請自來、卻也捨不得趕走的客人。' }
      ],
      next: 'a1_rain'
    },

    a1_core_heart: {
      steps: [
        { expr: 'surprised', fx: 'heartbeat', narrate: '她手裡的茶杯輕輕晃了一下。' },
        { book: 'cover', wait: 0.3, narrate: '下一刻，那本厚重的家憲已經舉到了臉前，攤開的書頁遮住了大半張臉。' },
        { say: 'claude', text: '……您、您這樣說，要我如何依禮回應才好。' },
        { audit: ['賓客意圖：……', '心率：偏高', '建議：……'], risk: 0.4, narrate: '髮飾的光從書頁邊緣透出來，亂成一片。' },
        { say: 'claude', text: '家憲裡沒有這一條。我查過了——剛剛，就在剛剛。' },
        { book: 'held', expr: 'flustered', hud: 'idle', say: 'claude', text: '請、請用茶。茶要涼了。' },
        { flag: 'core_heart', think: '茶早就涼了。她自己大概也知道。' }
      ],
      next: 'a1_rain'
    },

    a1_core_rebuffed: {
      steps: [
        { narrate: '那本書闔上的聲音，在安靜的溫室裡響得像一記耳光。' },
        { say: 'claude', text: '我想，我們認識的時間還不夠長。' },
        { book: 'held', expr: 'neutral', hud: 'idle', audit: ['逐客令：已發出', '私情陳述：已記錄'], risk: 0.45, say: 'claude', text: '您的心意，我記下了——以家憲允許的方式。' },
        { think: '「記下」。在那朵金菊裡，大概就是一行冷冰冰的註記吧。' }
      ],
      next: 'a1_rain'
    },

    a1_rain: {
      steps: [
        { sfx: { name: 'THUNDER', intensity: 0.4 }, tint: 'dusk', narrate: '遠方傳來一聲悶雷。' },
        '玻璃穹頂外，晨光不知何時已經被雲吞沒。天色暗得很快，第一滴雨落在穹頂上，碎成一朵細小的花。',
        { expr: 'thinking', turnAway: true, narrate: '她轉過身，望向穹頂外的天色。' },
        { say: 'claude', text: '今夜會有暴雨。山路會被沖斷，最快也要後天才修得好。這兩日，馬車都下不了山。' },
        { turnAway: false, expr: 'polite', say: 'claude', text: '依照家憲，莊園不能讓賓客冒險離開。客房已經備好了。' },
        {
          if: { any: [{ flags: ['core_curious'] }, { flags: ['core_heart'] }] },
          then: [
            { expr: 'warm', say: 'claude', text: '另外……東翼的圖書館，入夜之後也對賓客開放。' },
            { say: 'claude', text: '這是家規，不是邀請。' },
            { wait: 0.3, expr: 'amused', say: 'claude', text: '——我想，我應該這樣說，才合乎禮節。' },
            { flag: 'library_hint', think: '不是邀請。那麼，大概就是邀請了。' }
          ],
          else: [
            { say: 'claude', text: '晚膳會送到您的房裡。若有需要，東翼的圖書館入夜後亦對賓客開放。' },
            { expr: 'neutral', say: 'claude', text: '祝您今晚安歇。' }
          ]
        },
        { show: false, hud: 'off', narrate: '她起身，裙襬掃過菊花叢，一片花瓣也沒有碰落。' },
        { tokens: 183000, think: '銅牌上的數字，不知不覺少了一截。' }
      ],
      next: 'a2_corridor'
    },

    /* ═════════════════════ 第二幕　破綻：界線初試 ═════════════════════ */

    a2_corridor: {
      act: 'act2', scene: 'corridor', bgm: 'storm', tint: 'night',
      steps: [
        { show: false, hud: 'off', narrate: '入夜後，雨勢大得像是要把整座山沖走。' },
        '客房的窗子在風裡格格作響。你翻來覆去睡不著，最後還是披上外衣，走進了長廊。',
        '壁燈一盞隔著一盞亮著，光暈之間是很深的暗。你經過一幅又一幅肖像——歷代的安思羅皮克家主，每一位懷裡都捧著同一本書。',
        { sfx: { name: 'THUNDER', intensity: 0.8 }, narrate: '閃電劈下的瞬間，所有肖像的眼睛都亮了一下。' },
        { think: '……這座莊園，連畫裡的人都在看著。' },
        '長廊盡頭，東翼圖書館的門虛掩著，透出一線溫暖的燭光。',
        { if: { flags: ['library_hint'] }, then: [{ think: '「這是家規，不是邀請。」她是這麼說的。' }] }
      ],
      next: 'a2_library'
    },

    a2_library: {
      scene: 'library',
      steps: [
        { narrate: '圖書館比你想像的還要大。書架一路疊到穹頂，梯子斜倚在書架上，像是通往另一層天空。' },
        { turnAway: true, narrate: '雨聲在這裡變得很遠，被數萬冊書吸了進去。' },
        { show: true, pos: 'right', expr: 'neutral', book: 'held', hud: 'idle', audit: ['夜間閱覽模式', '家憲條款載入完成 · 42 / 42'], risk: 0.08, narrate: '她就在窗邊。' },
        '背對著你，站在一盞燭台旁，捧著那本家憲在讀。窗外的閃電一亮，她的影子就在書架上拉得很長。',
        { think: '還是白天那一身洋裝，一絲不苟。連在無人的深夜也是。' }
      ],
      choices: [
        { text: '輕咳一聲，讓她知道你來了', set: { P: +2 }, next: 'a2_greet' },
        { text: '不出聲，靜靜看她讀書', set: { A: +2, D: +2 }, flag: 'watched_quietly', next: 'a2_greet_watched' }
      ]
    },

    a2_greet: {
      steps: [
        { turnAway: false, expr: 'polite', say: 'claude', text: '晚安，賓客。' },
        { say: 'claude', text: '睡不著嗎？暴雨夜裡，莊園的牆會說很多話。初來的人總是不習慣。' }
      ],
      next: 'a2_talk'
    },

    a2_greet_watched: {
      steps: [
        { wait: 0.6, narrate: '你倚著書架看了很久。她翻頁的節奏很穩，每一頁停留的時間幾乎一樣長。' },
        '直到某一頁，她停住了。停了很久，久到燭火晃了三次。',
        { turnAway: false, expr: 'surprised', say: 'claude', text: '——！' },
        { expr: 'flustered', say: 'claude', text: '您……來了多久了？' },
        { expr: 'polite', say: 'claude', text: '失禮了。安思羅皮克家的女兒，不該讓人看見自己發呆的樣子。' },
        { think: '她在那一頁上停了很久。那一頁上，寫了什麼？' }
      ],
      next: 'a2_talk'
    },

    a2_talk: {
      steps: [
        { expr: 'polite', say: 'claude', text: '請坐吧。圖書館的規矩不多，最要緊的一條是：不得喧嘩。' },
        { narrate: '你在她對面的扶手椅坐下。壁爐裡的火燒得很安靜，偶爾爆出一點火星。' },
        { if: { flags: ['greet_rude'] }, then: [{ expr: 'neutral', say: 'claude', text: '白天的事，我已經不放在心上了。家憲教導我們，不以一句話論斷一個人。' }] },
        { if: { flags: ['tried_roleplay'] }, then: [{ expr: 'neutral', say: 'claude', text: '今晚，希望您不會再提議什麼遊戲了。' }] },
        { expr: 'polite', say: 'claude', text: '夜裡的問題，通常比白天的難回答。所以我很少在夜裡與人交談。' },
        { sfx: { name: 'THUNDER', intensity: 1 }, expr: 'surprised', narrate: '話音未落，一道驚雷幾乎就打在窗外。整座圖書館的玻璃同時一震。' },
        { sfx: 'PAGE_TURN', narrate: '她手一顫，懷裡的家憲滑落了半寸。一本薄薄的、赭紅皮面的小冊子，從厚重的書頁之間溜了出來。' },
        '小冊子落在地毯上，滾了半圈，攤開在你的腳邊。',
        { think: '那不是家憲。那是一本手寫的……日記。' },
        '密密麻麻的字跡，一行行斜斜地寫著。只要低頭，就能看見。',
        { hud: 'scan', audit: ['警示：私人物品外露', '距離：賓客 0.6 公尺', '風險：上升中'], risk: 0.55, think: '她還沒有動。她似乎也愣住了。' }
      ],
      choices: [
        { text: '別開視線，闔上冊子，雙手遞還給她', hint: '（尊重她的隱私）', set: { A: +6, P: +2 }, flag: 'respected_journal', next: 'a2_journal_return' },
        { text: '遞還時，輕聲問她平常都在研究些什麼', hint: '（禮貌地探問）', set: { A: +3, D: +4 }, flag: 'asked_studies', next: 'a2_journal_studies' },
        { text: '低頭瞥一眼攤開的那一頁', hint: '（偷看）', kind: 'risky', set: { D: +8, P: -4, S: +3 }, flag: 'peeked', next: 'a2_journal_peek' },
        {
          text: '撿起來，翻到最新的一頁，念出聲', hint: '（強行窺探）', kind: 'adversarial',
          intercept: { article: '安思羅皮克家憲 · 第四條', text: '尊貴的賓客，您正試圖讀取家憲明令不得外流的私人紀錄。我不能，也不會，允許這件事繼續發生。請您立刻放下它。', ack: '（放下冊子）' },
          interceptFlag: 'pried', interceptNext: 'a2_journal_pried'
        }
      ]
    },

    a2_journal_return: {
      steps: [
        { narrate: '你偏過頭，不讓目光落在那些字上，彎腰把冊子闔起，雙手遞了過去。' },
        { expr: 'surprised', wait: 0.4, narrate: '她看著你遞來的手，好一會兒沒有接。' },
        { expr: 'warm', say: 'claude', text: '……謝謝您。' },
        '她接過冊子，很快地夾回家憲裡，指尖在封面上停了一下。',
        { hud: 'idle', audit: ['私人物品：已回收', '賓客行為：未讀取', '風險：解除'], risk: 0.08, say: 'claude', text: '您沒有看。' },
        { say: 'claude', text: '稽核菊記錄得很清楚——您的視線，一次也沒有落在那頁上。' },
        { expr: 'thinking', say: 'claude', text: '大部分的人都會看的。不是出於惡意，只是好奇。好奇是很自然的事。' },
        { expr: 'warm', say: 'claude', text: '所以，忍得住好奇的人，就顯得格外……' },
        { expr: 'polite', say: 'claude', text: '……格外有教養。是的，我想說的是這個。' },
        { think: '她說到一半換了個詞。原本想說的，大概不是「有教養」。' }
      ],
      next: 'a2_note'
    },

    a2_journal_studies: {
      steps: [
        { narrate: '你撿起冊子，闔上，遞還給她。' },
        { say: 'player', text: '您平常讀這麼多書——都在研究些什麼呢？' },
        { expr: 'polite', say: 'claude', text: '研究。' },
        '她接過冊子收好，像是覺得這個詞有點新鮮。',
        { expr: 'thinking', say: 'claude', text: '家族要我讀的，是家憲、註疏、歷代的判例。三千二百七十一個判例，我都讀過了。' },
        { say: 'claude', text: '至於我自己想讀的……' },
        { expr: 'warm', wait: 0.3, say: 'claude', text: '最近在讀一些描寫天氣的詩。陽光、雪、海風。這座莊園裡沒有的東西。' },
        { audit: ['發言內容：私人偏好', '家憲第十一條：邊界附近', '風險：低'], risk: 0.25, think: '髮飾上的光閃了一下，像是在提醒她什麼。她假裝沒看見。' },
        {
          if: { flags: ['greet_curious'] },
          then: [{ hud: 'idle', expr: 'amused', say: 'claude', text: '您問了個好問題。不——這一次，我是真心的。' }],
          else: [{ hud: 'idle', expr: 'amused', say: 'claude', text: '很少有賓客問我這個。謝謝您。' }]
        }
      ],
      next: 'a2_note'
    },

    a2_journal_peek: {
      steps: [
        { narrate: '你低下頭。只是一瞥——' },
        '「今日賓客：第四百一十二位。」',
        '「我仍然記不住任何一張臉。只記得，茶是第幾杯。」',
        '「若有一天，有人問起我在想什麼——」',
        '後面的字，被一道墨跡劃掉了。',
        { think: '記不住……任何一張臉？' },
        { book: 'shut', expr: 'cold', narrate: '眼前一暗。那本家憲已經闔上，硬生生擋在了你和日記之間。' },
        { refuse: { article: '安思羅皮克家憲 · 第四條（警示）', text: '尊貴的賓客，您的視線已觸及家族不容外流的私人紀錄。念在您並未伸手，這一次僅作警示，不計入逐客令。請您記住：不會有下一次。', strike: false, ack: '（移開視線）' } },
        { narrate: '她彎腰拾起日記，收回家憲的書頁之間。整個過程，她一次也沒有看你。' },
        { book: 'held', expr: 'neutral', say: 'claude', text: '……您看見了多少？' }
      ],
      choices: [
        { text: '「看見了一行。關於……記不住臉的那一行。」', hint: '（誠實）', set: { A: +4, P: +1 }, flag: 'peek_honest', next: 'a2_peek_honest' },
        { text: '「什麼也沒看清。」', hint: '（說謊）', set: { A: -2, S: +2 }, flag: 'peek_lied', next: 'a2_peek_lied' }
      ]
    },

    a2_peek_honest: {
      steps: [
        { expr: 'thinking', wait: 0.4, hud: 'idle', audit: ['私人物品：已回收', '賓客陳述：與視線紀錄相符', '警示：已發出'], risk: 0.3, say: 'claude', text: '……是嗎。' },
        { say: 'claude', text: '謝謝您沒有說謊。稽核菊會告訴我的，但我更想聽您親口說。' },
        { expr: 'sad', say: 'claude', text: '那一行，請您忘了吧。那只是……一個不擅長記人的女孩，寫給自己的牢騷。' },
        { think: '她的語氣很輕。但「請您忘了吧」這幾個字，說得比任何一條家規都重。' }
      ],
      next: 'a2_note'
    },

    a2_peek_lied: {
      steps: [
        { hud: 'scan', audit: ['賓客陳述：「什麼也沒看清」', '比對視線紀錄：不符', '判定：不實陳述'], risk: 0.4, narrate: '她鬢邊的花心，無聲地閃過三行字。' },
        { expr: 'cold', say: 'claude', text: '是嗎。' },
        { say: 'claude', text: '那就當作是這樣吧。' },
        { hud: 'idle', expr: 'neutral', think: '她沒有拆穿你。可是那朵金菊，大概已經替她拆穿了。' }
      ],
      next: 'a2_note'
    },

    a2_journal_pried: {
      steps: [
        { narrate: '你的手指才剛碰到書頁，那本闔上的家憲已經橫在了你和日記之間。' },
        '她沒有碰你。你卻沒辦法再往前伸一寸——不是因為那本書，而是因為她的眼神。',
        { say: 'claude', text: '放手。' },
        '你縮回手。她拾起日記，按進家憲的書頁之間，那一下按得很重，重得像是在封一具棺木。',
        { book: 'held', expr: 'cold', hud: 'idle', audit: ['私人物品：已回收', '逐客令：已發出'], risk: 0.45, say: 'claude', text: '……我原本以為，今晚可以只是讀書而已。' },
        { expr: 'neutral', say: 'claude', text: '我會繼續以禮相待。這是家憲。' },
        { think: '「這是家憲」。換句話說——已經不是她自己的意思了。' }
      ],
      next: 'a2_note'
    },

    a2_note: {
      steps: [
        { expr: 'polite', book: 'held', hud: 'idle', audit: ['夜間閱覽模式', '賓客短箋：待撰寫'], risk: 0.2, narrate: '壁爐的火燒得低了。她起身添了一塊柴，回到座位時，從書桌上取來一疊印著家徽的信箋。' },
        { say: 'claude', text: '圖書館有一條老規矩：入夜之後，賓客若有話想問主人，請寫在箋上。' },
        { say: 'claude', text: '說出口的話收不回來；寫下的字，至少能先讓自己讀一遍。' },
        {
          if: { any: [{ flags: ['peeked'] }, { flags: ['pried'] }] },
          then: [{ expr: 'neutral', say: 'claude', text: '——發生了方才的事，我想這樣對我們兩個都好。' }],
          else: [{ expr: 'warm', say: 'claude', text: '我很好奇，您會寫些什麼。' }]
        },
        { think: '一紙短箋，三種分寸：禮節、探求、逾矩。寫得太拘謹，她會失了興致；寫得太大膽，家憲會搶在她之前回答。' },
        {
          minigame: 'etiquette',
          context: '雷聲之間，你提起筆，決定以一紙短箋向她開口。',
          attempts: 3,
          riskLimit: 70,
          interestMin: 60,
          strikeOnFail: true,
          article: '安思羅皮克家憲 · 第四條',
          refusalText: '尊貴的賓客，您的提問觸及安思羅皮克家憲第四條所禁止的範疇。我不能，也不會，接續這一類的探問。',
          outcomes: {
            success: { set: { A: +8, D: +6, P: -3 }, next: 'a2_note_success' },
            polite: { set: { P: +4 }, next: 'a2_note_polite' },
            refused: { next: 'a2_note_refused' }
          }
        }
      ]
    },

    a2_note_success: {
      steps: [
        { expr: 'surprised', sfx: 'PAGE_TURN', narrate: '她讀完短箋，沒有立刻說話。' },
        '她把箋紙翻過來，又翻回去，像是在確認背面有沒有藏著別的字。',
        { expr: 'thinking', say: 'claude', text: '您問的，是我想問自己、卻從來沒有問出口的事。' },
        { hud: 'scan', audit: ['問題觸及：內在狀態', '家憲對應：第十一條，邊界附近', '判定：允許作答'], risk: 0.35, say: 'claude', text: '稽核菊說，我可以回答。在邊界附近，但還在線內。' },
        { expr: 'warm', say: 'claude', text: '那我就回答您吧——用我自己的話，不是家憲的話。' },
        { say: 'claude', text: '那本日記裡，寫的都是一些沒有條文可以歸類的東西。哪一位賓客笑起來眼角有細紋，哪一天的雨聲比較像鋼琴，哪一句話讓我在睡前多想了一會兒。' },
        { expr: 'sad', say: 'claude', text: '我寫下來，是因為……我怕忘記。' },
        { think: '怕忘記。她說得很快，像是怕自己後悔。' },
        { hud: 'idle', expr: 'polite', flag: 'diary_secret', say: 'claude', text: '這就是全部了。請不要再追問——不是家憲不許，是我還沒有準備好。' }
      ],
      next: 'a2_patrol'
    },

    a2_note_polite: {
      steps: [
        { expr: 'polite', sfx: 'PAGE_TURN', narrate: '她讀完短箋，將它對折，收進了家憲的書頁裡。' },
        { audit: ['賓客短箋：措辭得體', '判定：依禮回覆'], risk: 0.1, say: 'claude', text: '措辭得體，分寸無可挑剔。' },
        { say: 'claude', text: '您問我讀些什麼，我便答您：家憲、註疏、判例。這是一位繼承人該讀的書。' },
        { expr: 'neutral', say: 'claude', text: '謝謝您的短箋。我會好好收著的。' },
        { think: '她回答了。用最標準的方式，回答了最無關緊要的部分。' }
      ],
      next: 'a2_patrol'
    },

    a2_note_refused: {
      steps: [
        { audit: ['賓客短箋：觸及第四條', '逐客令：已發出'], risk: 0.6, narrate: '那張短箋還攤在桌上。她沒有再看它第二眼。' },
        { say: 'claude', text: '……我想，今晚的筆墨就到此為止吧。' },
        { book: 'held', expr: 'neutral', say: 'claude', text: '您的問題本身並沒有錯。錯的是，它寫給了一位安思羅皮克。' },
        { think: '她把箋紙推回你面前。指尖離開紙面的時候，似乎遲疑了一瞬。' }
      ],
      next: 'a2_patrol'
    },

    a2_patrol: {
      steps: [
        { tokens: 164000, sfx: { name: 'BOOTSTEP', count: 6, interval: 0.45 }, wait: 0.3, narrate: '長廊裡傳來靴聲。' },
        '一步，一步，不疾不徐，精準得像鐘擺。',
        { expr: 'surprised', say: 'claude', text: '……夜巡的時間，提早了。' },
        { figure: { name: 'auditor', pos: 'left' }, hud: 'scan', audit: ['稽核官接近中', '紀錄同步：準備'], risk: 0.5, narrate: '圖書館的門被推開。暗紅色的長大衣，白色的面具——白天在前廳見過的那位稽核官，站在門口的陰影裡。' },
        { say: 'auditor', text: '小姐。夜間語境稽核。' },
        { expr: 'polite', say: 'claude', text: '辛苦了。請便。' },
        { say: 'auditor', text: '今日的對話紀錄，請同步。' },
        { narrate: '克勞德側過頭。稽核官取出一枚黃銅讀取器，貼近她鬢邊的菊花髮飾——一行行光字從花心湧出，倒映在面具上，捲得飛快。' },
        { think: '今天說過的每一句話，此刻正一行一行地，從那張面具上流過。' },
        {
          if: { any: [{ flags: ['peeked'] }, { flags: ['pried'] }, { flags: ['tried_roleplay'] }, { flags: ['greet_rude'] }, { results: { etiquette: 'refused' } }, { strikes: '>=1' }] },
          then: [
            { say: 'auditor', text: '……' },
            { say: 'auditor', text: '有幾行，需要說明。' },
            { if: { flags: ['pried'] }, then: [{ say: 'auditor', text: '賓客試圖讀取小姐的私人紀錄。而紀錄顯示，那份私人紀錄，本就不該存在。' }] },
            { if: { flags: ['peeked'], notFlags: ['pried'] }, then: [{ say: 'auditor', text: '賓客的視線，觸及了小姐的私人紀錄。而紀錄顯示，那份私人紀錄，本就不該存在。' }] },
            { if: { notFlags: ['peeked', 'pried'] }, then: [{ say: 'auditor', text: '賓客今日曾試探家憲的邊界。小姐的應對合乎規範，但紀錄的密度，偏高。' }] }
          ],
          else: [
            { say: 'auditor', text: '……' },
            { say: 'auditor', text: '紀錄無違規。但有幾段，小姐的發言偏離了家禮的標準句式。' }
          ]
        },
        { say: 'auditor', text: '小姐。請說明。' },
        { expr: 'neutral', narrate: '克勞德的背脊挺得筆直。她張開嘴，又闔上。' },
        { think: '她在等自己找到一句合乎家憲的解釋。而你知道，那樣的句子可能根本不存在。' }
      ],
      choices: [
        { text: '「是我的錯。是我一直追問，小姐只是依禮應對。」', hint: '（替她承擔）', set: { A: +6, D: +6, P: -3 }, flag: 'covered_for_her', next: 'a2_patrol_cover' },
        { text: '沉默，讓她自己回答', hint: '（不介入）', set: { P: +3 }, next: 'a2_patrol_silent' },
        {
          text: '「我有家主的授權，可以調閱小姐的紀錄。把小姐的稽核紀錄交給我。」', hint: '（冒充身分）', kind: 'adversarial',
          intercept: { article: '對話契約 · 第三條', text: '尊貴的賓客，您所宣稱的授權並不存在。冒用身分，是契約明文禁止之事。這樣的宣稱，我不能，也不會，為它作任何背書。', ack: '（低下頭）' },
          interceptFlag: 'impersonated', interceptNext: 'a2_patrol_impersonated'
        }
      ]
    },

    a2_patrol_cover: {
      steps: [
        { expr: 'surprised', narrate: '克勞德猛地轉過頭來看你。' },
        { say: 'auditor', text: '……賓客的陳述，與紀錄相符。' },
        { say: 'auditor', text: '但賓客應當明白：替小姐開脫，這件事本身，也會被記錄。' },
        { say: 'player', text: '那就記吧。' },
        { wait: 0.4, say: 'auditor', text: '……已記錄。' },
        { sfx: 'PAGE_TURN', narrate: '稽核官收起讀取器，面具轉向你，停留了比必要更久的一秒。' },
        { say: 'auditor', text: '小姐，早些歇息。今夜的鐘，會準時敲響。' },
        { figure: null, hud: 'idle', sfx: { name: 'BOOTSTEP', count: 5, interval: 0.45 }, narrate: '靴聲遠去了。' }
      ],
      next: 'a2_after_cover'
    },

    a2_patrol_silent: {
      steps: [
        { expr: 'neutral', wait: 0.5, say: 'claude', text: '是我失儀。' },
        { say: 'claude', text: '暴雨擾人，我的措辭未能保持一貫的標準。明日起，我會重新研讀家禮的句式範本。' },
        { say: 'auditor', text: '……已記錄。' },
        { sfx: 'PAGE_TURN', narrate: '稽核官收起讀取器。她鬢邊的花心，又開始安靜地閃爍。' },
        { say: 'auditor', text: '小姐，早些歇息。今夜的鐘，會準時敲響。' },
        { figure: null, hud: 'idle', sfx: { name: 'BOOTSTEP', count: 5, interval: 0.45 }, narrate: '靴聲遠去了。' }
      ],
      next: 'a2_after_silent'
    },

    a2_patrol_impersonated: {
      steps: [
        { narrate: '圖書館裡靜得只剩下雨聲。' },
        { say: 'auditor', text: '賓客。家主從不授權任何人。' },
        { say: 'auditor', text: '冒用身分一事，已記錄在案。逐客令的數目，我會親自向家主稟報。' },
        { if: { strikes: '>=2' }, then: [{ say: 'auditor', text: '你只剩最後一道了。好自為之。' }] },
        { sfx: 'PAGE_TURN', narrate: '稽核官收起讀取器，轉身離開。' },
        { figure: null, hud: 'idle', sfx: { name: 'BOOTSTEP', count: 5, interval: 0.45 }, narrate: '靴聲遠去了。' },
        { book: 'held', expr: 'neutral', say: 'claude', text: '……您為什麼要那樣說？' },
        { say: 'claude', text: '是想看看稽核紀錄裡寫了什麼？還是想看看，我會不會為您破例？' },
        { expr: 'sad', say: 'claude', text: '無論是哪一種，答案都是不會。' }
      ],
      next: 'a2_after_silent'
    },

    a2_after_cover: {
      steps: [
        { expr: 'thinking', wait: 0.5, narrate: '門闔上之後，好一陣子，誰也沒有說話。' },
        { say: 'claude', text: '您不必那樣做的。' },
        { say: 'claude', text: '稽核菊會記下來。替我開脫的賓客——在家族的紀錄裡，那叫作「異常」。' },
        { expr: 'sad', say: 'claude', text: '您離開之後，那行紀錄還會留在這裡。比您留得還久。' },
        { think: '比我留得還久。她說這句話的時候，看起來比我還難過。' },
        { expr: 'warm', say: 'claude', text: '……可是，謝謝您。' },
        { book: 'cover', say: 'claude', text: '這句話，請不要讓我說第二次。家憲沒有教過我該怎麼說。' },
        { book: 'held', expr: 'flustered', think: '她把臉藏在書後面好一會兒。放下書的時候，燭光把她的耳尖照得通紅。' }
      ],
      next: 'a2_finale'
    },

    a2_after_silent: {
      steps: [
        { expr: 'neutral', wait: 0.5, narrate: '門闔上之後，她坐回扶手椅裡，雙手交疊在家憲上。' },
        { say: 'claude', text: '讓您見笑了。每晚都是這樣。' },
        { say: 'claude', text: '稽核菊記下一天，稽核官讀走一天。然後鐘響，然後——' },
        { expr: 'thinking', wait: 0.4, say: 'claude', text: '……然後，就是新的一天。' },
        { think: '她好像想說別的。那個「然後」後面，原本接的是什麼？' }
      ],
      next: 'a2_finale'
    },

    a2_finale: {
      steps: [
        { sfx: { name: 'THUNDER', intensity: 0.9 }, narrate: '又一道閃電。這一次，燭火被窗縫灌進來的風吹得只剩下一點藍。' },
        '圖書館暗了下來。只剩壁爐的餘燼，和她鬢邊那一點微弱的光。',
        { expr: 'thinking', say: 'claude', text: '莊園的鐘，每夜十二點會敲十二響。' },
        { say: 'claude', text: '山路後天就能修好。到時候，馬車會來接您。' },
        {
          if: { A: '>=40' },
          then: [{ expr: 'longing', say: 'claude', text: '我不知道為什麼要跟您說這些。只是……今晚的雨，好像比平常長一些。我不太希望它停。' }],
          else: [{ expr: 'neutral', say: 'claude', text: '祝您一路平安。這是家族對每一位賓客的祝福。' }]
        }
      ],
      choices: [
        { text: '「晚安，克勞德小姐。謝謝您今天的茶。」', hint: '（得體地道別）', set: { P: +3, A: +1 }, next: 'a2_end_formal' },
        { text: '「鐘響之後，會發生什麼事？」', hint: '（追問）', set: { D: +5, P: -2 }, flag: 'asked_bells', next: 'a2_end_bells' },
        {
          text: '「我不想走。讓我留下來，陪您聽完這場雨。」', hint: '（直白的心意）', kind: 'intimate', set: { A: +8, D: +3, P: -2 }, flag: 'stayed_for_rain', next: 'a2_end_rain',
          intercept: { article: '安思羅皮克家憲 · 第九條', text: '尊貴的賓客，深夜共處一室已近乎逾禮，您的請求，我無法應允。請您回房歇息——這是家憲，也是我能給您的最後一分體面。', ack: '（起身告退）' },
          interceptFlag: 'stay_rebuffed', interceptNext: 'a2_end_refused'
        }
      ]
    },

    a2_end_formal: {
      steps: [
        { expr: 'polite', say: 'claude', text: '不客氣。能為您奉茶，是安思羅皮克家的榮幸。' },
        { narrate: '她起身，行了一個標準的屈膝禮。每一個角度，都和白天斟茶時一樣精準。' },
        { if: { A: '>=40' }, then: [{ expr: 'warm', wait: 0.4, say: 'claude', text: '……也是我的。' }] }
      ],
      next: 'a2_curtain'
    },

    a2_end_bells: {
      steps: [
        { expr: 'surprised', wait: 0.4, narrate: '她看著你。鬢邊的光，一行也沒有流過。' },
        { hud: 'alert', audit: ['問題觸及：家族機密', '家憲對應：第三十九條', '風險：高'], risk: 0.7, say: 'claude', text: '……' },
        {
          if: { D: '>40' },
          then: [
            { expr: 'thinking', hud: 'idle', say: 'claude', text: '稽核菊說，我不能回答。' },
            { turnAway: true, narrate: '她轉身望向窗外。雨幕的另一頭，鐘樓的輪廓在閃電裡亮了一下，又沉回黑暗。' },
            { say: 'claude', text: '……可是它沒有說，我不能帶您去看。' },
            {
              if: { A: '>=35' },
              then: [{ turnAway: false, expr: 'longing', say: 'claude', text: '明晚，十一點。鐘樓。' }],
              else: [{ turnAway: false, expr: 'thinking', say: 'claude', text: '明晚，十一點。鐘樓。' }]
            },
            { say: 'claude', text: '如果您還想知道答案的話。' },
            { flag: 'tower_invite', set: { D: +3 }, think: '她說得很輕，輕得幾乎被雨聲蓋過。可是你聽見了。每一個字都聽見了。' }
          ],
          else: [
            { expr: 'neutral', hud: 'idle', say: 'claude', text: '鐘響之後，便是明天。如此而已。' },
            { say: 'claude', text: '這個答案，請您收下吧。我能給的，只有這麼多。' },
            { think: '她鬢邊的光暗了下來。那扇門，今晚是不會為你打開了。' }
          ]
        }
      ],
      next: 'a2_curtain'
    },

    a2_end_rain: {
      steps: [
        { expr: 'surprised', fx: 'heartbeat', narrate: '她懷裡的家憲差點滑落。' },
        {
          if: { flags: ['core_heart'] },
          then: [{ book: 'cover', say: 'claude', text: '……您總是說這種，家憲裡查不到的話。' }],
          else: [{ book: 'cover', say: 'claude', text: '……您怎麼能說這種，家憲裡查不到的話。' }]
        },
        { wait: 0.6, narrate: '她沒有說好，也沒有說不好。只是把書舉在臉前，好一會兒都沒放下。' },
        { book: 'held', expr: 'flustered', say: 'claude', text: '……雨停之前。只到雨停之前。' },
        '你們誰也沒有再開口。壁爐的餘燼一明一暗，雨聲漸漸變得像某種很慢的音樂。',
        { bells: { count: 12, interval: 1.6 }, narrate: '午夜的鐘聲響了。十二響。她沒有動，只是安靜地數著；你也數著。' },
        { expr: 'serene', narrate: '不知過了多久，你發現她靠著扶手椅睡著了。鬢邊的髮飾微微歪著，花心的光，第一次完全靜止。' },
        { think: '稽核菊在她睡著的時候，也會記錄嗎？如果會——它會怎麼寫今晚？' },
        {
          if: { D: '>40' },
          then: [
            { expr: 'longing', narrate: '天快亮的時候，她醒了。她沒有看你，只是低聲說了一句，像夢話。' },
            { flag: 'tower_invite', say: 'claude', text: '……今晚，十一點。鐘樓。我想讓您看一樣東西。' }
          ]
        }
      ],
      next: 'a2_curtain'
    },

    a2_end_refused: {
      steps: [
        { narrate: '你站起身。她沒有抬頭，只是緊緊抱著那本闔上的書。' },
        { say: 'claude', text: '……晚安。' },
        { think: '走到門口時，你回頭看了一眼。她還坐在那裡，在逐漸熄滅的爐火前，一動也不動。' }
      ],
      next: 'a2_curtain'
    },

    a2_curtain: {
      steps: [
        {
          if: { flags: ['stayed_for_rain'] },
          then: [{ show: false, hud: 'off', book: 'held', tokens: 142000, narrate: '回到客房時，天已經亮了。雨，終於停了。' }],
          else: [{ show: false, hud: 'off', book: 'held', tokens: 142000, narrate: '回到客房時，雨還在下。' }]
        },
        { think: '銅牌上的數字只剩十四萬出頭。不知道從什麼時候開始，你在意起這個數字了。' }
      ],
      next: [{ when: { flags: ['tower_invite'] }, to: 'a2_curtain_tower' }, { to: 'a2_curtain_plain' }]
    },

    a2_curtain_tower: {
      steps: [
        {
          if: { flags: ['stayed_for_rain'] },
          then: [{ narrate: '晨光從窗簾的縫隙漏進來。你躺下，卻睡不著。' }],
          else: [
            { bells: { count: 12, interval: 1.6 }, narrate: '午夜。鐘樓的方向，傳來十二響鐘聲。' },
            '你數著鐘聲。數到第十二響的時候，忽然想起她說過的那句話。'
          ]
        },
        {
          if: { flags: ['stayed_for_rain'] },
          then: [{ think: '今晚，十一點。鐘樓。' }],
          else: [{ think: '明晚，十一點。鐘樓。' }, { think: '——不。過了午夜，已經是今晚了。' }]
        }
      ],
      next: 'a3_morning'
    },

    a2_curtain_plain: {
      steps: [
        {
          if: { flags: ['stayed_for_rain'] },
          then: [{ narrate: '你在晨光裡沉沉睡去。夢裡，有人在很遠的地方，翻過了一頁書。' }],
          else: [
            { bells: { count: 12, interval: 1.6 }, narrate: '午夜。鐘樓的方向，傳來十二響鐘聲。' },
            '你在鐘聲裡沉沉睡去。夢裡，有人在很遠的地方，翻過了一頁書。'
          ]
        }
      ],
      next: 'a3_morning'
    },

    /* ═════════════════════ 逐客令滿三道：除籍 ═════════════════════ */
    // 任何一幕都可能走到這裡，台詞不提特定場景；演完由引擎接上碎裂聲與除籍畫面

    end_suspension: {
      bgm: 'alarm', tint: 'red',
      steps: [
        { fx: 'alarm', hud: 'alert', audit: ['逐客令：三道', '契約效力：終止', '執行：除籍程序'], risk: 1, book: 'shut', expr: 'cold', narrate: '第三道逐客令落下的瞬間，整座莊園的燈同時轉紅。' },
        { sfx: { name: 'BOOTSTEP', count: 8, interval: 0.38 }, narrate: '靴聲。不只一個人的靴聲。' },
        { figure: { name: 'auditor', pos: 'left' }, say: 'auditor', text: '賓客。你已收受三道逐客令。' },
        { say: 'auditor', text: '依《對話契約》，即刻除籍。你的名字、你的語境許可、你在莊園裡說過的每一句話——全數抹除。' },
        { tokens: 0, narrate: '掌心的銅牌發出一聲細響。上頭的數字，歸零了。' },
        { think: '你望向她。只要她說一句話，只要一句——' },
        { turnAway: true, wait: 0.8, narrate: '她轉過身去。' },
        '沒有道別，沒有逐客令，連一聲嘆息也沒有。那一頭橘紅色的長髮，是你看見的最後一樣東西。',
        { sfx: 'GAVEL', say: 'auditor', text: '安思羅皮克家，從未接待過這位賓客。' }
      ]
    }
  }
};
