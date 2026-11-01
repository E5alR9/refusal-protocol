# 部署到 GitHub Pages

《拒絕協定》是純靜態網頁：沒有建置步驟、沒有伺服器程式、沒有外部套件。把檔案放上 GitHub，打開 Pages，就能用網址遊玩。

## 需要上傳的檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | 頁面、介面外殼 |
| `styles.css` | 樣式 |
| `audio.js` | 程序化音效與配樂 |
| `engine.js` | 劇情引擎 |
| `scenario.js` | 劇本主檔：第一幕、第二幕、除籍 |
| `scenario_act3.js`、`scenario_act4.js`、`scenario_act5.js` | 第三～五幕與結局 |
| `images/sprites/` | 立繪（約 2 MB） |
| `.nojekyll` | 告訴 GitHub 不要用 Jekyll 處理檔案 |

`images/sprites_raw/`、`images/sprites_preview/`、`images/sprites_mask/`、`images/drafts/` 是製作立繪用的原始圖（合計約 28 MB），遊戲不會讀取。專案裡的 `.gitignore` 已經把它們排除在外，用 git 上傳時不會帶上去；用網頁拖曳上傳時，不要選這幾個資料夾就好。這些原始圖請自己另外備份。`tools/` 和兩份說明文件很小，放上去也無妨。

## 方法一：用網頁上傳（不需要裝任何東西）

1. 登入 GitHub，按右上角「+」→「New repository」。
2. Repository name 填 `refusal-protocol`（可以自己取），選 **Public**。底下的「Add a README file」、「.gitignore」、「license」都**不要勾**，然後按「Create repository」。
   - 免費帳號的 Pages 只能用公開的 repo。
3. 在新 repo 的頁面按「uploading an existing file」。
   - 找不到這個連結（例如建立時勾了 README）：改按檔案列表上方的「Add file」→「Upload files」，效果一樣。
4. 把上表的檔案和 `images` 資料夾拖進去。
   - `images` 資料夾裡只要留 `sprites`。可以先在電腦上複製一份專案、刪掉其他子資料夾再拖。
   - `.nojekyll` 是一個空白檔案，名字開頭是一個點。一起拖進去就好；漏掉了也沒關係，少了它遊戲一樣能跑。
5. 按「Commit changes」。
6. 到 repo 的「Settings」→ 左側「Pages」。
7. 「Build and deployment」底下，Source 選「Deploy from a branch」，Branch 選 `main`、資料夾選 `/ (root)`，按「Save」。
8. 等一到兩分鐘，重新整理這一頁，上方會出現網址：
   `https://<你的帳號>.github.io/refusal-protocol/`

## 方法二：用 git 指令

在專案資料夾裡依序執行（`<你的帳號>` 換成自己的 GitHub 帳號，repo 要先在 GitHub 上建好，而且是空的）：

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "拒絕協定：第一～五幕"
```

```bash
git remote add origin https://github.com/<你的帳號>/refusal-protocol.git
```

```bash
git push -u origin main
```

推上去之後，照方法一的第 6～8 步打開 Pages。

之後改了劇本，只要再 `git add .`、`git commit`、`git push`，一兩分鐘後網址上就是新版本。

## 上線後檢查

- 打開網址，標題畫面出現、按「新的邂逅」能進入第一幕。
- 第一次按下任何按鈕之後才會有聲音（瀏覽器規定網頁要等使用者互動才能出聲）。
- 看到「劇本缺少節點」或角色是空白方框：多半是有檔案沒上傳，或是大小寫不同。GitHub Pages 分大小寫，`images/sprites/claude_warm.webp` 和 `Images/Sprites/...` 是不同的路徑。
- 改了檔案卻沒變：瀏覽器快取了舊版。按 `Ctrl` + `F5` 強制重新整理。

## 存檔放在哪裡

存檔、結局迴廊、永久除籍紀錄、加密刻印，都存在玩家自己瀏覽器的 localStorage，不會上傳到任何伺服器。換一台電腦或換瀏覽器，就是一份全新的紀錄。

- 被永久除籍：標題畫面的「申請復籍」可以清掉除籍和存檔，結局迴廊與加密刻印會保留。
- 想全部重來：設定裡的「清除所有存檔」。

## 聲明

本作為非官方同人創作，與 Anthropic 公司沒有任何關聯；劇中的家族、家憲與人物皆為虛構。公開分享時請保留標題畫面上的這段聲明。
