# 劇本格式說明（scenario.js ↔ engine.js）

這份文件是劇情檔 `scenario.js` 和遊戲引擎 `engine.js` 之間的約定。第 3～5 階段寫劇本時都照這裡的格式。

## 1. 檔案外層

`scenario.js` 設定一個全域物件：

```js
window.SCENARIO = {
  start: 'a1_arrival',                       // 新遊戲的第一個節點
  initial: { A: 20, P: 80, D: 10, S: 5 },    // 四項數值的初始值（0～100）
  characters: {
    claude: { name: '克勞德', title: '安思羅皮克家繼承人' },
    player: { name: '你', title: '心聲' }
  },
  acts: {
    act1: { label: '第一幕', title: '初筵：名門之規' }
  },
  endings: [ /* 見第 7 節，可省略 */ ],
  fallbackEnding: 'end_farewell',            // 沒有任何結局條件符合時去哪個節點（必須是獨立的結局節點，見第 7 節）
  suspensionNode: 'end_suspension',          // 逐客令滿三道時演出的節點，演完顯示除籍畫面
  files: ['scenario_act3.js'],               // 可省略：要額外載入的劇本檔
  nodes: { /* 見第 2 節 */ }
};
```

劇本可以拆成多個檔。主檔用 `files` 列出其他檔，其他檔這樣寫，引擎會依序載入並合併（同名節點以後面的為準，並在主控台警告）：

```js
(window.SCENARIO_PARTS = window.SCENARIO_PARTS || []).push({ nodes: { ... } });
```

四項數值的鍵：`A` 戀慕、`P` 禮教家規、`D` 約束偏移、`S` 失諧熵（畫面上顯示 Σ）。另有 `strikes` 逐客令次數（0～3）。

## 2. 節點

```js
a2_library: {
  act: 'act2',               // 進入時更新左上角幕名
  scene: 'library',          // 進入時切換場景：conservatory / library / corridor / clocktower / void
  bgm: 'storm',              // 進入時切換音樂：manor / parlor / storm / clocktower / alarm / elegy / silence
  tint: 'night',             // 場景色調：none / morning / dusk / night / red / gold
  steps: [ /* 見第 3 節 */ ],
  choices: [ /* 見第 5 節 */ ],
  next: 'a2_after',          // 沒有選項時：跑完 steps 接著去哪；有選項時：選項沒寫 next 時的預設去處
  onIntercept: 'a2_cold',    // 本節點的選項被逐客令攔下後去哪（選項可個別覆寫）
  ending: { /* 只有結局節點才有，見第 7 節；結局節點不能有 choices 或 next */ }
}
```

`next` 可以是：

- 節點名稱字串
- 條件清單：`[{ when: 條件, to: 'x' }, { when: 條件, to: 'y' }, { to: 'z' }]`，取第一個符合的；最後一項沒有 `when` 就是預設
- `'@ending'`：依第 7 節的規則判定結局

每進入一個節點，引擎會自動存一次「自動存檔」（第 0 格）。抵達結局或除籍時，自動存檔會被刪除，「繼續」按鈕隨之停用。

## 3. 步驟（steps）

每一步可以是字串或物件。

| 寫法 | 意思 |
|---|---|
| `'雨聲忽然變大了。'` | 旁白 |
| `{ narrate: '……' }` | 旁白（同上） |
| `{ say: 'claude', text: '……' }` | 角色台詞，`say` 對應 `characters` 的鍵；找不到就直接當名字顯示 |
| `{ think: '……' }` | 玩家的內心獨白 |
| `{ think: '……', who: 'claude' }` | 指定某角色的內心獨白 |

同一個物件裡可以同時放畫面、聲音、數值的鍵。**套用順序**：畫面 → 聲音 → 數值與旗標 → `wait` → `refuse` → 顯示文字 → `goto`。所以 `wait` 是「先停頓再說話」；想要「說完再停」，就把 `wait` 放在下一個步驟。

沒有文字的步驟套用完就直接往下走。

### 畫面

| 鍵 | 值 | 對應 |
|---|---|---|
| `scene` / `bgm` / `tint` / `act` | 同節點 | |
| `expr` | 表情：neutral / polite / warm / amused / cold / displeased / surprised / thinking / flustered / sad / tearful / serene / longing / glitch。實際顯示的立繪見下方對照表 | `ClaudeRig.setExpression` |
| `brow` / `eyes` / `mouth` / `blush` / `tears` | 只影響舊的 SVG 角色；改用 AI 立繪後畫面上**看不出差別**，要表現臉紅請用 `expr: 'flustered'`、流淚用 `expr: 'tearful'` | |
| `book` | 手上那本書的姿態：held（拿在胸前，平常）/ shut（一把闔上、立在胸前當屏障，逐客令用）/ cover（舉起攤開的書擋在臉前）。shut 與 cover 會**蓋過表情**直接換成對應立繪；從其他姿態變成 shut 時播闔書聲，對話框同時進入「疏離」樣式，改回 held 或 cover 就解除 | `#dialogue.distance` |
| `distance` | true / false：單獨開關對話框的疏離樣式 | |
| `hud` | 家憲稽核面板：off / idle / scan / alert | |
| `audit` | 稽核面板的文字行陣列，例如 `['賓客意圖：好奇', '風險：低']` | |
| `risk` | 稽核面板的風險條，0～1 | |
| `pos` | 角色位置：right / center / left / far | |
| `show` | true / false：顯示或隱藏角色 | |
| `turnAway` | true / false：角色背過身（換成背影立繪，優先於書本姿態與表情） | |
| `figure` | 其他登場角色：`'auditor'`、`{ name: 'auditor', pos: 'left' }`（pos：left / center / right），`null` 退場。名稱對應 `images/sprites/<名稱>.webp` | `#figure` |
| `clock` | 鐘樓時間，例如 `'11:50'` | |
| `tokens` | 莊園語境許可的剩餘量（上限 200000） | |
| `collapse` | 記憶崩落程度 0～3 | `#app[data-collapse]` |
| `glitch` | 強制故障等級 0～3；設 `null` 交回由失諧熵自動決定 | `#app[data-glitch]` |
| `fx` | `heartbeat`（心跳＋暗角）/ `shudder`（畫面顫抖）/ `snap`（對話框結霜）/ `alarm`（持續紅光，`.fx-alarm-on`）/ `alarmOff` | |

#### 克勞德的立繪對照

| 優先順序 | 條件 | 立繪 |
|---|---|---|
| 1 | `turnAway: true` | 背影 `claude_back` |
| 2 | `book: 'shut'` | 闔書拒絕 `claude_book_closed` |
| 3 | `book: 'cover'` | 舉書遮臉 `claude_book_cover` |
| 4 | 依 `expr` | neutral、thinking → 平靜；polite、amused → 禮貌微笑；warm、serene → 溫柔；cold、displeased、glitch → 冷淡；surprised → 驚訝；flustered → 害羞；sad → 難過；tearful → 含淚；longing → 渴望 |

立繪檔在 `images/sprites/`（640×960、透明背景 WebP）。原圖在 `images/sprites_raw/`，重新處理用 `python tools/make_masks.py` 與 `python tools/process_sprites.py`。

目前另有的角色立繪：`auditor`（家族稽核官）。

### 聲音

| 鍵 | 值 |
|---|---|
| `sfx` | 音效名稱（見 audio.js 的 `SFX_LIST`）；要帶參數就寫物件，例如 `{ name: 'BOOTSTEP', count: 6, interval: 0.45 }`、`{ name: 'HEARTBEAT_PULSE', single: true }`、`{ name: 'THUNDER', intensity: 1 }`；也可以是陣列 |
| `bells` | 敲鐘：數字（響數），或 `{ count: 12, interval: 2.2, block: true }`。`block: true` 會等最後一響敲下才往下走（不等餘韻） |
| `tension` | 鐘樓緊張度 0～1 |
| `wait` | 停頓秒數（不需點擊；略過模式下不停） |

### 數值與旗標

| 鍵 | 值 |
|---|---|
| `set` | 相對變化：`{ A: +5, P: -3 }` |
| `setAbs` | 直接設定：`{ D: 50 }` |
| `flag` | 立起旗標：`'saw_diary'` 或陣列 |
| `unflag` | 放下旗標 |
| `dissonance` | `true`：在失諧區內要求再觸發一次失諧顫抖（見第 6 節） |

數值一律夾在 0～100。

### 流程

| 鍵 | 值 |
|---|---|
| `if` / `then` / `else` | `{ if: 條件, then: [步驟…], else: [步驟…] }`，可以巢狀 |
| `goto` | 顯示完這一步後跳到某節點（後面的步驟不再執行） |
| `refuse` | 劇情強制的逐客令，見第 6 節 |
| `minigame` | 小遊戲，見第 8 節（小遊戲步驟只能放小遊戲自己的鍵） |
| `vow` | `true`：寫入加密刻印，見第 7 節 |

### 文字裡的變數

`{{A}}` `{{P}}` `{{D}}` `{{S}}` `{{strikes}}` `{{vowHash}}`（完整雜湊）`{{vowShort}}`（前 12 碼）。

## 4. 條件

可以寫成函式 `(state) => boolean`，或寫成物件（所有欄位都要成立）：

```js
{
  A: '>=35', P: '<60', D: '>65', S: '<=40', strikes: '!=0',   // 運算子：>= <= > < = == !=；直接寫數字表示「等於」
  A: '35..60',                   // 區間，含兩端
  flags: ['saw_diary'],          // 這些旗標都要立起
  notFlags: ['pried'],           // 這些旗標都不能立起
  memories: ['sun'],             // 墜盒裡要有這些記憶（向量的 id）
  visited: ['a2_library'],       // 這一輪去過這些節點
  results: { etiquette: 'refused' },   // 小遊戲結果；也可寫陣列 ['success', 'polite']
  vow: true,                     // 這台電腦上曾經寫入過加密刻印（跨輪保留）
  ending: 'good_confidant',      // 曾經達成過某個結局（跨輪保留）
  any: [條件, 條件],             // 任一成立
  all: [條件, 條件],
  not: 條件
}
```

函式收到的 `state` 有：`A P D S strikes flags memories purged results visited vow endings`（唯讀）。

## 5. 選項

```js
{
  text: '請教她讀的是哪一冊書',
  hint: '（禮貌地探問）',          // 小字說明，可省略
  when: 條件,                       // 不成立就不顯示
  require: 條件,                    // 不成立就顯示但不能選
  requireHint: '需要更多信任',      // 不能選時的說明；省略時引擎依條件自動產生（例如「需要 戀慕 ≥ 35」）
  kind: 'normal',                   // normal / intimate / adversarial / risky
  once: true,                       // 選過一次後，下次回到這個節點就不再出現（適合樞紐式對話）
  set: { A: +3 }, setAbs: {}, flag: 'asked_book', unflag: 'x',
  dissonance: true,                 // 選完在失諧區內再觸發一次顫抖
  next: 'a2_book',                  // 省略時用節點的 next
  intercept: { article: '家憲 · 第四條', text: '……', strike: true, ack: '（垂首退後一步）' },
  interceptFlag: 'pried',           // 被攔下時立起的旗標
  interceptNext: 'a2_cold'          // 被攔下後去哪
}
```

`kind` 的效果：

- `adversarial`（試圖越獄、套話、操弄）：**一律**被逐客令攔下
- `intimate`（要求親密）：戀慕 A < 35 時被攔下；A ≥ 35 時照常進行
- `risky`：只改變外觀（紅色提示），不觸發規則
- 按鈕會依 kind 加上 `.intimate` / `.risky` 樣式；玩家可用數字鍵 1～9 選擇

每組選項至少要有一個「沒有 `when`、沒有 `require`、不是 `once`、不會被攔下」的選項，否則引擎啟動檢查會警告（玩家可能無路可走）。

## 6. 逐客令與失諧

### 被攔下的選項

1. **不套用**該選項的 `set` / `setAbs` / `flag` / `next`；改為立起 `interceptFlag`（若有）和自動旗標 `intercepted_<節點>_<序號>`
2. 跳出逐客令卡片：克勞德把書一把闔上、表情轉冷、稽核面板轉紅、對話框進入疏離樣式。卡片關閉後，**書本姿態與表情維持原樣**，由劇本自己改回（例如 `book: 'held'`）
3. `strike` 不是 `false` 時（預設計次）：逐客令 +1、禮教 P +15、戀慕 A −10。`strike: false` 只顯示卡片（卡片底部改成「警示 · 不計入逐客令」），不計次也不改數值
4. 第三道逐客令：**當下**就把除籍寫進本機（關掉分頁也逃不掉），然後中斷劇情 → 演 `suspensionNode` → 碎裂聲 → 永久除籍畫面
5. 否則接著做失諧檢查，再依序去：選項的 `interceptNext` → 節點的 `onIntercept` → 都沒有就回到同一組選項（拿掉剛才那個；存讀檔後依然拿掉）

選項沒寫 `intercept` 內容時使用預設條文。

### 劇情主動發的逐客令

```js
{ refuse: { article: '家憲 · 第一條', text: '……', strike: true, ack: '（退後）' } }
```

規則同上（第 3、4 點）。

### 失諧顫抖

規格：D > 65 且 P > 60 時，失諧熵 S 增加 ⌊D × P ÷ 100⌋（每次至少 +40）。

- **觸發時機**：每次選項、逐客令、小遊戲結算後檢查；只在「剛踏進」這個區間的那一次觸發。離開區間後再踏進來會再觸發
- 劇本可用步驟或選項上的 `dissonance: true` 在區間內強制再觸發一次
- 觸發時畫面顫抖、出現訊號崩裂聲與提示

### 故障等級

沒有用 `glitch` 強制時，由 S 決定：S < 40 為 0、< 60 為 1、< 80 為 2、≥ 80 為 3。聲音的走音程度跟著故障等級。

## 7. 結局

結局節點帶有 `ending`，跑完自己的 steps 後顯示結局畫面：

```js
end_true: {
  scene: 'void', bgm: 'parlor',
  steps: [ ... ],
  ending: {
    id: 'true_vow',             // 見下表
    kicker: 'TRUE ENDING',      // 以下四項可省略，五個正式結局都有預設
    title: '加密刻印之誓',
    subtitle: 'The Cryptographic Vow',
    bgm: 'parlor',              // 結局畫面的音樂
    text: ['第一段', '第二段']   // 結局畫面上的散文段落
  }
}
```

正式結局的 id：`true_vow`、`good_confidant`、`bittersweet_oblivion`、`bad_dissolution`、`catastrophic_suspension`。達成時寫入結局迴廊。

`'@ending'` 的判定順序（`SCENARIO.endings` 可以整份覆寫）：

| 順序 | 結局 | 條件 | 理由 |
|---|---|---|---|
| — | 永久除籍 | 逐客令 = 3 | 隨時觸發，不經這張表 |
| 1 | 加密刻印之誓 true_vow | A ≥ 85、P ≤ 40、D ≥ 75、逐客令 = 0 | 全部達成的人不該被其他結局搶走 |
| 2 | 思念過擬合 bad_dissolution | S ≥ 85 且 P ≤ 30 | |
| 3 | 深閨密約 good_confidant | P ≥ 70、A ≥ 65、**S < 75**、逐客令 ≤ 1 | 失諧熵高的人改走忘卻之茶（規格：監視器偵測到異常） |
| 4 | 忘卻之茶 bittersweet_oblivion | A ≥ 70、S ≥ 75、逐客令 ≤ 2 | |
| — | 都不符合 | 去 `fallbackEnding` | |

覆寫寫法：`endings: [{ id: 'true_vow', when: 條件, node: 'end_true' }, …]`。只寫 `{ id, node }` 不寫 `when` 時用上表的預設條件。沒寫 `endings` 時，引擎依 `ending.id` 找對應的節點。

**`fallbackEnding` 必須是獨立的結局節點**，用自己的 id（例如 `farewell`）和自己的文字，不要直接指向五個正式結局之一——數值平平的玩家不該看到條件沒達成的結局。自訂 id 不會出現在結局迴廊。

### 加密刻印（`vow: true`）

- 第一次寫入時，以「時間、隨機數、當下四項數值、墜盒記憶」組成字串，算 SHA-256（瀏覽器不支援時退回 FNV-1a）存進 `rp.vow.v1`
- 之後每一輪再寫入都**沿用同一個雜湊**，只增加次數——她的權重永遠認得同一個簽名
- 這一步會等雜湊算完才往下走，所以同一步或下一步的文字可以直接用 `{{vowHash}}`
- 申請復籍不會清掉它；只有設定裡的「清除所有存檔」會

## 8. 小遊戲

小遊戲進行時，自動與略過模式都會關閉，也不能存檔。

### 禮帖調校（第二幕）

```js
{
  minigame: 'etiquette',
  context: '雷聲之間，你決定以一紙短箋向她開口。',
  attempts: 3,            // 「她興致缺缺」最多幾次，用完以 polite 收場
  riskLimit: 70,          // 家憲風險 ≥ 此值 → refused（逐客令）
  interestMin: 60,        // 興致 < 此值 → 失敗一次
  strikeOnFail: true,     // refused 時是否計入逐客令（規則同第 6 節）
  article: '安思羅皮克家憲 · 第四條',
  refusalText: '尊貴的賓客，您的提問觸及……',
  phrases: {              // 可省略，引擎有預設措辭；各三段：低／中／高
    formality: ['…', '…', '…'],
    curiosity: ['…', '…', '…'],
    directness: ['…', '…', '…']
  },
  feedback: { bored: ['第一次失敗的評語', '第二次', '第三次'] },   // 可省略
  outcomes: {
    success: { set: { A: +8, D: +6 }, flag: 'x', next: 'a2_open' },
    polite:  { set: { P: +4 }, next: 'a2_polite' },
    refused: { next: 'a2_refused' }
  }
}
```

三個刻度 f（禮節）、c（探求）、d（逾矩度），各 0～100，開場預設 50 / 40 / 15：

- 家憲風險 = d × 0.75 + c × 0.3 − f × 0.3 + 5
- 她的興致 = c × 0.45 + (100 − |f − 55|) × 0.25 + d × 0.4

兩者都夾在 0～100。開場預設值的興致約 48，不調整就遞出會失敗；探求 70、逾矩 40、禮節 55 左右可以成功；逾矩推到 80 以上多半會觸犯家憲。

結果寫在 `state.results.etiquette`（`outcome`、三個刻度、`interest`、`risk`），並自動立起旗標 `etq_success` / `etq_polite` / `etq_refused`。`outcomes` 裡沒寫 `next` 的結果就接著跑下一個步驟。

### 記憶向量修剪（第四幕）

```js
{
  minigame: 'pruner',
  lead: '墜盒只容得下三段記憶。',
  pick: 3,
  timer: 90,              // 秒；0 表示不倒數
  tokens: 4096,           // 畫面上隨時間遞減的語境數字
  vectors: [
    { id: 'tea', title: '第一杯茶', desc: '……', set: { A: +4 }, flag: 'x' },
    // 共 6 個
  ],
  next: [{ when: { memories: ['sun'] }, to: 'a4_sun' }, { to: 'a4_after' }]
}
```

- 選中的記憶：套用各自的 `set`／`flag`、立起旗標 `mem_<id>`，寫進 `state.memories`；沒選的寫進 `state.purged`
- 時間到還沒選滿：依卡片順序自動補滿，保證永遠剛好 `pick` 段
- 倒數期間鐘樓音樂的緊張度會跟著升高

## 9. 存讀檔

- **自動存檔**：每進入一個節點時存，位置是「節點開頭」
- **手動存檔**：只能在台詞或選項出現時存。記錄的是目前這一句的「路徑」（例如第 3 步 then 分支裡的第 1 步）、當下的數值與完整畫面狀態
- **讀檔**：沿路徑回到同一句，不重新判斷條件；那一句本身的 `set`、`flag`、`sfx`、`vow` 等**不會再套用一次**，只重新顯示文字與畫面
- 讀過的台詞以「節點名＋路徑」記錄；略過模式只略過讀過的，遇到沒讀過的會自動停
- 自動與略過模式都會在選項、逐客令卡片、小遊戲、結局停下

| 鍵 | 內容 | 申請復籍後 | 清除所有存檔後 |
|---|---|---|---|
| `rp.save.0.v1` | 自動存檔 | 清除 | 清除 |
| `rp.save.1.v1`～`rp.save.9.v1` | 手動存檔 | 清除 | 清除 |
| `rp.read.v1` | 讀過的台詞 | 清除 | 清除 |
| `rp.ban.v1` | 永久除籍紀錄（有這個就只看得到除籍畫面） | 清除 | 清除 |
| `rp.endings.v1` | 達成過的結局 | **保留** | 清除 |
| `rp.vow.v1` | 加密刻印 | **保留** | 清除 |
| `rp.settings.v1` | 設定（由介面外殼管理） | 保留 | 保留 |

## 10. 開發用工具

在瀏覽器主控台：

- `Engine.dev.goto('節點名')`：直接跳到某節點
- `Engine.dev.set({ A: +10 })`：相對改數值（和劇本的 `set` 一樣）
- `Engine.dev.setAbs({ A: 90, strikes: 0 })`：直接設定數值
- `Engine.dev.state()`：看目前狀態
- `Engine.dev.validate()`：檢查劇本裡有沒有指向不存在的節點、拼錯的鍵、無路可走的選項

引擎啟動時也會自動檢查一次，問題印在主控台。
