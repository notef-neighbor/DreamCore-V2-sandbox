# GameCreatorMVP-v2 システムアーキテクチャ

## 概要図

```
┌─────────────────────────────────────────────────────────┐
│                    ブラウザクライアント                   │
│           app.js - WebSocket + UI管理                   │
└───────────────────────┬─────────────────────────────────┘
                        │ WebSocket (双方向リアルタイム)
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Node.js/Express サーバー (Port 3000)        │
│  ┌────────────┐ ┌─────────────┐ ┌──────────────────┐   │
│  │claudeRunner│ │ userManager │ │   database.js    │   │
│  │ Gemini API │ │ Git管理     │ │   SQLite         │   │
│  └─────┬──────┘ └──────┬──────┘ └────────┬─────────┘   │
└────────┼───────────────┼────────────────┼──────────────┘
         │               │                │
         ▼               ▼                ▼
┌────────────────┐ ┌──────────────┐ ┌─────────────────┐
│ 外部API        │ │ users/       │ │ data/           │
│ - Gemini 2.0   │ │ {visitorId}/ │ │ gamecreator.db  │
│ - Claude CLI   │ │ {projectId}/ │ │                 │
└────────────────┘ └──────────────┘ └─────────────────┘
```

---

## ディレクトリ構造

```
GameCreatorMVP-v2/
├── server/                    # バックエンド
│   ├── index.js              # メインサーバー (Express + WebSocket)
│   ├── claudeRunner.js       # AI処理の中核 (Claude CLI + Gemini)
│   ├── geminiClient.js       # Gemini API クライアント
│   ├── database.js           # SQLite管理
│   ├── userManager.js        # ユーザー・プロジェクト・Git管理
│   ├── jobManager.js         # 非同期ジョブ管理
│   └── prompts/              # プロンプトテンプレート
│       ├── createPrompt.js   # 新規作成用プロンプト
│       ├── updatePrompt.js   # 更新用プロンプト
│       └── baseRules.js      # 共通ルール
├── public/                   # フロントエンド
│   ├── index.html            # メインHTML
│   ├── app.js                # クライアントロジック
│   └── style.css             # スタイルシート
├── users/                    # ユーザーデータ (Git管理)
│   └── {visitorId}/{projectId}/
│       ├── .git/             # プロジェクト版バージョン管理
│       ├── index.html        # ゲームコード
│       └── specs/            # ゲーム仕様
├── data/gamecreator.db       # SQLiteデータベース
└── .claude/skills/           # 19個のSkills
```

---

## 主要コンポーネント

| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| **Webサーバー** | index.js | Express + WebSocket、API提供 |
| **AI処理** | claudeRunner.js | Gemini API呼び出し、Skills選択 |
| **Geminiクライアント** | geminiClient.js | コード生成、画像生成 |
| **DB管理** | database.js | SQLite CRUD操作 |
| **ユーザー管理** | userManager.js | プロジェクト、Git、履歴 |
| **ジョブ管理** | jobManager.js | 非同期処理、進捗通知 |

---

## データベーススキーマ (SQLite)

```sql
-- Users (ユーザー)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  visitor_id TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Projects (プロジェクト)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'New Game',
  is_public INTEGER DEFAULT 0,
  remixed_from TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Assets (アセット)
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  is_public INTEGER DEFAULT 0,
  tags TEXT,
  description TEXT,
  created_at TEXT,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chat History (チャット履歴)
CREATE TABLE chat_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,
  created_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Jobs (非同期ジョブ)
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  progress_message TEXT,
  result TEXT,
  error TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

---

## WebSocket通信フロー

```
Client                    Server
  │── init ──────────────→│ 接続初期化
  │←─ init ───────────────│ (visitorId, projects)
  │── selectProject ─────→│ プロジェクト選択
  │←─ projectSelected ────│ (history)
  │── chat ──────────────→│ メッセージ送信
  │←─ jobStarted ─────────│ ジョブ開始
  │←─ stream ─────────────│ ストリーミング出力
  │←─ progress ───────────│ 進捗更新
  │←─ gameUpdated ────────│ ゲーム完成
```

### メッセージタイプ

**Client → Server:**
- `init` - 接続初期化
- `selectProject` - プロジェクト選択
- `createProject` - 新規プロジェクト作成
- `deleteProject` - プロジェクト削除
- `renameProject` - プロジェクトリネーム
- `chat` - メッセージ送信
- `subscribeJob` - ジョブ更新購読
- `getVersions` - バージョン一覧
- `restoreVersion` - バージョン復元
- `cancel` - ジョブキャンセル

**Server → Client:**
- `init` - 初期化完了
- `projectSelected` - プロジェクト選択完了
- `projectCreated` - プロジェクト作成完了
- `jobStarted` - ジョブ開始
- `jobUpdate` - ジョブ状態更新
- `stream` - ストリーミング出力
- `gameUpdated` - ゲーム更新完了
- `error` - エラーメッセージ

---

## 外部API連携

| API | 用途 | モデル |
|-----|------|-------|
| **Gemini Flash 2.0** | ゲームコード生成 | gemini-2.0-flash |
| **Gemini Image** | 画像生成 | gemini-2.5-flash-image |
| **Claude CLI** | フォールバック | - |

### Gemini API フロー

1. `createPrompt.js` または `updatePrompt.js` でリクエストボディ構築
2. Gemini APIへストリーミングリクエスト送信
3. SSE形式でレスポンス受信
4. JSON応答をパース
5. ファイル生成・更新

### 応答フォーマット (JSON)

```json
{
  "mode": "create | edit | chat",
  "files": [
    {"path": "index.html", "content": "..."}
  ],
  "images": [
    {"name": "player.png", "prompt": "..."}
  ],
  "summary": "実行した内容の説明"
}
```

---

## 特徴的な機能

### 1. AI駆動コード生成
ユーザーの自然言語からゲームコード自動生成

### 2. 2D/3D自動判定
メッセージ内容から適切なフレームワーク選択（P5.js / Three.js）

### 3. Skills自動選択
19個のSkillsから最適なものを選択してプロンプトに組み込み

### 4. Gitバージョン管理
プロジェクトごとにGitリポジトリを作成、スナップショット復元可能

### 5. リアルタイムプレビュー
iframe内でゲーム即時実行、エラー検出スクリプト注入

### 6. エラー自動検出
ゲーム内JSエラーをキャッチして修正提案

### 7. 画像生成
Geminiでゲームアセット生成（マゼンタ背景透過対応）

---

## 技術スタック

### Backend
- Node.js
- Express 4.18.2
- WebSocket (ws 8.14.2)
- SQLite (better-sqlite3 12.5.0)
- Sharp 0.34.5 (画像処理)
- Multer 2.0.2 (ファイルアップロード)

### Frontend
- Vanilla JavaScript
- HTML5
- CSS3
- WebSocket API

### AI/ML
- Gemini Flash 2.0 API
- Gemini 2.5 Flash Image API
- Claude CLI (フォールバック)

### Other
- Git (バージョン管理)
- UUID (ID生成)

---

## 処理フロー詳細

### ゲーム生成フロー

```
1. ユーザーがチャットでメッセージ送信
   │
2. WebSocketでサーバーに送信
   │
3. claudeRunner.runClaudeAsJob() でジョブ作成
   │
4. 2D/3D判定 (detectDimension)
   │
5. Skills自動選択 (detectSkillsWithAI)
   │
6. Gemini APIでコード生成 (geminiClient.generateCode)
   │  - ストリーミングでクライアントに進捗送信
   │
7. 画像生成リクエストがあれば実行
   │
8. ファイル保存 + Gitコミット
   │
9. WebSocketで完了通知
   │
10. クライアントでiframeリロード
```

### エラー修正フロー

```
1. iframe内のゲームでJSエラー発生
   │
2. 注入されたエラー検出スクリプトがキャッチ
   │
3. postMessageで親フレームに送信
   │
4. エラーパネルに表示
   │
5. 「自動修正」ボタンでAIに修正依頼
   │
6. 通常のゲーム生成フローで修正
```

---

## ゲーム生成フロー詳細

### 全体シーケンス図

```
┌─────────┐    ┌─────────┐    ┌─────────────┐    ┌────────────┐    ┌───────────┐
│ Browser │    │ index.js│    │claudeRunner │    │geminiClient│    │ Gemini API│
└────┬────┘    └────┬────┘    └──────┬──────┘    └─────┬──────┘    └─────┬─────┘
     │              │                │                  │                 │
     │ sendMessage()│                │                  │                 │
     │─────────────>│                │                  │                 │
     │   WebSocket  │                │                  │                 │
     │              │ runClaudeAsJob │                  │                 │
     │              │───────────────>│                  │                 │
     │              │                │                  │                 │
     │              │   job created  │                  │                 │
     │<─────────────│<───────────────│                  │                 │
     │  jobStarted  │                │                  │                 │
     │              │                │ tryGeminiGeneration                │
     │              │                │─────────────────>│                 │
     │              │                │                  │                 │
     │              │                │                  │ generateCode()  │
     │              │                │                  │────────────────>│
     │              │                │                  │    HTTPS POST   │
     │              │                │                  │                 │
     │              │                │                  │<────────────────│
     │              │                │                  │   SSE Stream    │
     │<─────────────│<───────────────│<─────────────────│                 │
     │   stream     │                │   onStream()     │                 │
     │   (繰り返し)  │                │                  │                 │
     │              │                │                  │                 │
     │              │                │<─────────────────│                 │
     │              │                │   JSON response  │                 │
     │              │                │                  │                 │
     │              │                │ applyGeminiResult│                 │
     │              │                │ (ファイル保存)    │                 │
     │              │                │                  │                 │
     │<─────────────│<───────────────│                  │                 │
     │ gameUpdated  │   completed    │                  │                 │
     │              │                │                  │                 │
     │ refreshPreview()              │                  │                 │
     │              │                │                  │                 │
```

### Step 1: クライアント - sendMessage()

**ファイル**: `public/app.js` (行 889-911)

```javascript
async sendMessage(content = null) {
  const message = content || this.chatInput.value.trim();

  // UIにユーザーメッセージ追加
  this.addMessage(message, 'user');

  // WebSocket送信
  this.ws.send(JSON.stringify({
    type: 'message',
    content: message,
    debugOptions: {
      disableSkills: this.disableSkillsCheckbox?.checked,
      useClaude: this.useClaudeCheckbox?.checked
    }
  }));
}
```

### Step 2: サーバー - WebSocket受信

**ファイル**: `server/index.js` (行 623-788)

```javascript
case 'message':
  // 1. スタイル選択チェック（新規プロジェクトの場合）
  if (isNewProject && !has2Dor3DSpecified) {
    // styleOptionsメッセージをクライアントに送信
    safeSend({ type: 'styleOptions', dimension, styles });
    return;
  }

  // 2. ビジュアルガイド生成
  const guide = generateVisualGuide(selectedStyle);
  userMessage += formatGuideForCodeGeneration(guide);

  // 3. 履歴保存
  userManager.addToHistory(visitorId, projectId, 'user', content);

  // 4. ジョブ作成と処理開始
  const { job, startProcessing } = await claudeRunner.runClaudeAsJob(
    visitorId, projectId, userMessage, debugOptions
  );

  // 5. ジョブ購読（更新をクライアントに転送）
  jobManager.subscribe(job.id, (update) => {
    safeSend({ type: 'jobUpdate', ...update });
  });

  // 6. 非同期処理開始
  startProcessing();
```

### Step 3: ジョブ作成

**ファイル**: `server/claudeRunner.js` (行 1075-1100)

```javascript
async runClaudeAsJob(visitorId, projectId, userMessage, debugOptions) {
  const user = db.getUserByVisitorId(visitorId);
  const job = jobManager.createJob(user.id, projectId);

  return {
    job,
    startProcessing: () => {
      this.processJob(job.id, visitorId, projectId, userMessage, debugOptions);
    }
  };
}
```

### Step 4: ジョブ処理

**ファイル**: `server/claudeRunner.js` (行 1103-1338)

```javascript
async processJob(jobId, visitorId, projectId, userMessage, debugOptions) {
  jobManager.startJob(jobId);

  // 1. 意図判定（restore/chat/edit）
  jobManager.updateProgress(jobId, 5, '意図を判定中...');
  const intent = await this.detectIntent(userMessage);

  // 2. 復元意図の場合は確認画面
  if (intent === 'restore') {
    // restoreConfirmメッセージ送信
    return;
  }

  // 3. Gemini生成試行
  const geminiResult = await this.tryGeminiGeneration(
    visitorId, projectId, userMessage, jobId, debugOptions
  );

  // 4. 結果適用
  if (geminiResult && geminiResult.mode !== 'chat') {
    await this.applyGeminiResult(visitorId, projectId, geminiResult, jobId);
    jobManager.completeJob(jobId, { message: geminiResult.summary });
  }
}
```

### Step 5: Gemini生成

**ファイル**: `server/claudeRunner.js` (行 742-972)

```javascript
async tryGeminiGeneration(visitorId, projectId, userMessage, jobId, debugOptions) {
  // 1. 現在のコード取得
  const currentCode = userManager.readProjectFile(visitorId, projectId, 'index.html');
  const isNewProject = !currentCode || currentCode.includes('Welcome');

  // 2. 2D/3D判定
  jobManager.updateProgress(jobId, 3, '2D/3D判定中...');
  const dimension = await this.detectDimension(userMessage);

  if (dimension === 'unclear') {
    // ユーザーに確認要求（geminiChatメッセージ）
    return { mode: 'chat', message: '2Dと3Dどちらで作成しますか？' };
  }

  // 3. 仕様・スタイル読み込み
  const gameSpec = this.readSpec(visitorId, projectId);
  const visualStyle = this.readStyle(visitorId, projectId);

  // 4. スキル自動選択
  jobManager.updateProgress(jobId, 5, 'スキルを分析中...');
  const detectedSkills = await this.detectSkillsWithAI(userMessage, currentCode, isNewProject);
  const skillSummary = this.getSkillContentForGemini(detectedSkills);

  jobManager.updateProgress(jobId, 12, `スキル選択: ${detectedSkills.slice(0,3).join(', ')}`);

  // 5. Gemini API呼び出し
  jobManager.updateProgress(jobId, 20, 'Gemini APIでコード生成中...');

  const result = await geminiClient.generateCode({
    userMessage,
    currentCode,
    conversationHistory: history,
    skillSummary,
    gameSpec,
    visualStyle,
    onStream: (chunk) => {
      jobManager.notifySubscribers(jobId, { type: 'stream', content: chunk.content });
    }
  });

  return result;
}
```

### Step 6: Gemini API呼び出し

**ファイル**: `server/geminiClient.js` (行 135-310)

```javascript
async generateCode(options) {
  const { userMessage, currentCode, skillSummary, onStream } = options;
  const isFirstMessage = !currentCode;

  // 1. プロンプト構築
  const requestBody = isFirstMessage
    ? createPrompt.buildRequest({ userMessage, skillSummary, ... })
    : updatePrompt.buildRequest({ userMessage, currentCode, ... });

  // 2. Gemini APIエンドポイント
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:streamGenerateContent?alt=sse&key=${API_KEY}`;

  // 3. ストリーミングHTTPSリクエスト
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let fullText = '';

      res.on('data', (chunk) => {
        // SSE解析
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullText += text;
              onStream({ type: 'text', content: text });  // ストリーム送信
            }
          }
        }
      });

      res.on('end', () => {
        const result = JSON.parse(fullText);
        resolve(result);  // { mode, files, summary, ... }
      });
    });

    req.write(JSON.stringify(requestBody));
    req.end();
  });
}
```

### Step 7: 結果適用

**ファイル**: `server/claudeRunner.js` (行 976-1073)

```javascript
async applyGeminiResult(visitorId, projectId, geminiResult, jobId) {
  const projectDir = userManager.getProjectDir(visitorId, projectId);

  // 1. 画像生成（リクエストがあれば）
  if (geminiResult.images?.length > 0) {
    jobManager.updateProgress(jobId, 52, '画像を生成中...');
    for (const img of geminiResult.images) {
      const direction = await this.analyzeImageDirection(gameCode, gameSpec, img.name);
      const result = await geminiClient.generateImage({ prompt: img.prompt + direction });
      userManager.saveGeneratedImage(visitorId, projectId, img.name, result.image);
    }
  }

  // 2. ファイル保存
  if (geminiResult.mode === 'edit') {
    // 差分適用
    for (const edit of geminiResult.edits) {
      const filePath = path.join(projectDir, edit.path);
      let content = fs.readFileSync(filePath, 'utf-8');
      content = content.replace(edit.old_string, edit.new_string);
      fs.writeFileSync(filePath, content);
    }
  } else {
    // 新規ファイル作成
    for (const file of geminiResult.files) {
      const filePath = path.join(projectDir, file.path);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, file.content);
    }
  }

  // 3. Gitコミット
  userManager.createVersionSnapshot(visitorId, projectId, geminiResult.summary);

  // 4. 仕様書作成/更新（非同期）
  this.createInitialSpecFromCode(visitorId, projectId, userMessage, null, gameCode);
}
```

### Step 8: クライアント更新

**ファイル**: `public/app.js` (行 530-753)

```javascript
handleMessage(data) {
  switch (data.type) {
    case 'stream':
      // ストリーミング出力をUIに追加
      this.appendToStream(data.content);
      break;

    case 'jobUpdate':
      // 進捗バー更新
      this.updateProgress(data.progress, data.message);

      if (data.type === 'completed') {
        this.completeStreaming();
        this.addMessage(data.result.message, 'assistant');
        this.isProcessing = false;
      }
      break;

    case 'gameUpdated':
      // iframeリロード
      this.refreshPreview();
      break;
  }
}
```

---

### 主要関数の行番号一覧

| 処理 | ファイル | 関数 | 行番号 |
|-----|---------|------|--------|
| メッセージ送信 | app.js | sendMessage() | 889-911 |
| WS受信 | index.js | case 'message' | 623-788 |
| ジョブ作成 | claudeRunner.js | runClaudeAsJob() | 1075-1100 |
| ジョブ処理 | claudeRunner.js | processJob() | 1103-1338 |
| Gemini生成 | claudeRunner.js | tryGeminiGeneration() | 742-972 |
| API呼び出し | geminiClient.js | generateCode() | 135-310 |
| 結果適用 | claudeRunner.js | applyGeminiResult() | 976-1073 |
| 2D/3D判定 | claudeRunner.js | detectDimension() | 574-630 |
| スキル選択 | claudeRunner.js | detectSkillsWithAI() | 412-504 |
| 画像生成 | geminiClient.js | generateImage() | 319-475 |
