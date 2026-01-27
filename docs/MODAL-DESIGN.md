# Modal 技術設計書（Express + WebSocket維持）

作成日: 2026-01-27
更新日: 2026-01-27

---

## システム概要

```
Browser ──WebSocket──▶ Express Server ──HTTP/SSE──▶ Modal ──▶ gVisor Sandbox
              │               │                                      │
              │               ▼                                      ▼
              │          Supabase                              Claude CLI
              │          (Auth + DB)                           (Code Gen)
              │               │
              └───────────────┘
                   JWT検証
```

**ポイント:**
- フロントエンド・WebSocket通信は一切変更なし
- ExpressサーバーはModalへの中継役に徹する
- 重い処理（Claude CLI、画像生成）はModal Sandboxで実行

---

## 1. Express Server（中継・オーケストレーション）

### 役割変更

| 項目 | Before | After |
|------|--------|-------|
| Claude CLI実行 | ローカルで実行 | Modal API呼び出し |
| Gemini API | ローカルで呼び出し | Modal API呼び出し |
| ファイルI/O | ローカルFS | Modal Volume経由 |
| WebSocket | 処理 + 配信 | 中継 + 配信（変更なし） |
| REST API | 処理 + 応答 | 中継 + 応答（変更なし） |

### 新規追加ファイル

```
server/
├── modalClient.js    [NEW] Modal API クライアント
└── ... (既存ファイルは改修のみ)
```

---

## 2. modalClient.js 設計

```javascript
// server/modalClient.js
const MODAL_ENDPOINT = process.env.MODAL_ENDPOINT;
const MODAL_GET_FILE_ENDPOINT = process.env.MODAL_GET_FILE_ENDPOINT;
const MODAL_INTERNAL_SECRET = process.env.MODAL_INTERNAL_SECRET;

class ModalClient {
  constructor() {
    this.headers = {
      'Content-Type': 'application/json',
      'X-Modal-Secret': MODAL_INTERNAL_SECRET,
    };
  }

  /**
   * ゲーム生成（SSEストリーム）
   */
  async *generateGame({ user_id, project_id, message, skills }) {
    const response = await fetch(MODAL_ENDPOINT, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ user_id, project_id, message, skills }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          yield JSON.parse(line.slice(6));
        }
      }
    }
  }

  /**
   * Gemini生成（SSEストリーム）
   */
  async *generateGemini({ user_id, project_id, message, skills }) {
    const response = await fetch(process.env.MODAL_GEMINI_ENDPOINT, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ user_id, project_id, message, skills }),
    });
    // 同様のストリーム処理
  }

  /**
   * ファイル取得
   */
  async getFile(user_id, project_id, path) {
    const url = new URL(MODAL_GET_FILE_ENDPOINT);
    url.searchParams.set('user_id', user_id);
    url.searchParams.set('project_id', project_id);
    url.searchParams.set('path', path);

    const response = await fetch(url, { headers: this.headers });
    const { content } = await response.json();
    return content;
  }

  /**
   * ファイル一覧
   */
  async listFiles(user_id, project_id, path = '') {
    const response = await fetch(process.env.MODAL_LIST_FILES_ENDPOINT, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ user_id, project_id, path }),
    });
    const { files } = await response.json();
    return files;
  }

  /**
   * ファイル書き込み
   */
  async writeFile(user_id, project_id, path, content) {
    const response = await fetch(process.env.MODAL_WRITE_FILE_ENDPOINT, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ user_id, project_id, path, content }),
    });
    return response.ok;
  }

  /**
   * Intent検出
   */
  async detectIntent(message) {
    const response = await fetch(process.env.MODAL_DETECT_INTENT_ENDPOINT, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ message }),
    });
    const { intent } = await response.json();
    return intent;
  }

  /**
   * スキル検出
   */
  async detectSkills(message, dimension) {
    const response = await fetch(process.env.MODAL_DETECT_SKILLS_ENDPOINT, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ message, dimension }),
    });
    const { skills } = await response.json();
    return skills;
  }
}

module.exports = new ModalClient();
```

---

## 3. claudeRunner.js 改修

### Before

```javascript
// ローカルでClaude CLI実行
async function runClaudeAsJob(userId, projectId, message, options) {
  const projectDir = getProjectPath(userId, projectId);
  const child = spawn('claude', [
    '--model', 'opus',
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
  ], { cwd: projectDir });

  child.stdout.on('data', (data) => {
    jobManager.emit(jobId, 'stream', { content: data.toString() });
  });
  // ...
}
```

### After

```javascript
const modalClient = require('./modalClient');
const USE_MODAL = process.env.USE_MODAL === 'true';

async function runClaudeAsJob(userId, projectId, message, options) {
  const job = await jobManager.createJob(userId, projectId);

  if (USE_MODAL) {
    // Modal経由
    await runClaudeOnModal(job.id, userId, projectId, message, options);
  } else {
    // ローカルフォールバック（既存コード）
    await runClaudeLocal(job.id, userId, projectId, message, options);
  }
}

async function runClaudeOnModal(jobId, userId, projectId, message, options) {
  try {
    const stream = modalClient.generateGame({
      user_id: userId,
      project_id: projectId,
      message,
      skills: options.skills || [],
    });

    // SSE → WebSocketブリッジ
    for await (const event of stream) {
      switch (event.type) {
        case 'stream':
          jobManager.emit(jobId, 'stream', { content: event.content });
          break;
        case 'status':
          jobManager.updateProgress(jobId, event.progress, event.message);
          break;
        case 'done':
          jobManager.completeJob(jobId, event.result);
          break;
        case 'error':
          jobManager.failJob(jobId, event.message);
          break;
      }
    }
  } catch (error) {
    jobManager.failJob(jobId, error.message);
  }
}

async function runClaudeLocal(jobId, userId, projectId, message, options) {
  // 既存のローカル実行コード（フォールバック用に保持）
}
```

---

## 4. userManager.js 改修

### Before

```javascript
// ローカルファイルI/O
async function readProjectFile(userId, projectId, filename) {
  const filePath = path.join(getProjectPath(userId, projectId), filename);
  return fs.readFileSync(filePath, 'utf-8');
}

async function writeProjectFile(userId, projectId, filename, content) {
  const filePath = path.join(getProjectPath(userId, projectId), filename);
  fs.writeFileSync(filePath, content);
}
```

### After

```javascript
const modalClient = require('./modalClient');
const USE_MODAL = process.env.USE_MODAL === 'true';

async function readProjectFile(userId, projectId, filename) {
  if (USE_MODAL) {
    return modalClient.getFile(userId, projectId, filename);
  } else {
    const filePath = path.join(getProjectPath(userId, projectId), filename);
    return fs.readFileSync(filePath, 'utf-8');
  }
}

async function writeProjectFile(userId, projectId, filename, content) {
  if (USE_MODAL) {
    return modalClient.writeFile(userId, projectId, filename, content);
  } else {
    const filePath = path.join(getProjectPath(userId, projectId), filename);
    fs.writeFileSync(filePath, content);
  }
}
```

---

## 5. Modal Sandbox設計

### Sandbox Image構成

```python
# modal/app.py
sandbox_image = modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "curl", "ca-certificates", "nodejs", "npm")
    .pip_install("Pillow", "httpx")
    .run_commands(
        # Claude Code CLI インストール
        "npm install -g @anthropic-ai/claude-code",
        # 非rootユーザー作成
        "useradd -m -s /bin/bash claude"
    )
```

### Sandbox実行パラメータ

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `timeout` | 600秒 | 最大実行時間（10分） |
| `memory` | 2048MB | メモリ上限 |
| `user` | claude (UID 1000) | 非root実行 |
| `isolation` | gVisor | VM級隔離 |

---

## 6. Modal Endpoints設計

```python
# modal/app.py
import modal
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse

app = modal.App("dreamcore")
web_app = FastAPI()

# Volumes
data_volume = modal.Volume.from_name("dreamcore-data")
global_volume = modal.Volume.from_name("dreamcore-global")

# Secrets
secrets = [
    modal.Secret.from_name("anthropic-api-key"),
    modal.Secret.from_name("modal-internal-secret"),
    modal.Secret.from_name("gemini-api-key"),
]

def validate_secret(x_modal_secret: str):
    if x_modal_secret != os.environ["MODAL_INTERNAL_SECRET"]:
        raise HTTPException(status_code=401, detail="Invalid secret")

def validate_uuid(value: str):
    import re
    UUID_REGEX = re.compile(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        re.IGNORECASE
    )
    if not UUID_REGEX.match(value):
        raise HTTPException(status_code=400, detail=f"Invalid UUID: {value}")

@web_app.post("/generate_game")
async def generate_game(
    request: GenerateRequest,
    x_modal_secret: str = Header(...),
):
    validate_secret(x_modal_secret)
    validate_uuid(request.user_id)
    validate_uuid(request.project_id)

    return StreamingResponse(
        generate_stream(request),
        media_type="text/event-stream",
    )

async def generate_stream(request):
    project_dir = f"/data/users/{request.user_id}/projects/{request.project_id}"

    with modal.Sandbox.create(
        image=sandbox_image,
        volumes={"/data": data_volume, "/global": global_volume},
        secrets=secrets,
        timeout=600,
    ) as sb:
        proc = sb.exec(
            "bash", "-c",
            f"cd {project_dir} && echo '{request.message}' | claude --output-format stream-json"
        )

        for line in proc.stdout:
            yield f"data: {json.dumps({'type': 'stream', 'content': line})}\n\n"

        exit_code = proc.wait()
        yield f"data: {json.dumps({'type': 'done', 'exit_code': exit_code})}\n\n"

@web_app.get("/get_file")
async def get_file(
    user_id: str,
    project_id: str,
    path: str,
    x_modal_secret: str = Header(...),
):
    validate_secret(x_modal_secret)
    validate_uuid(user_id)
    validate_uuid(project_id)

    if '..' in path or path.startswith('/'):
        raise HTTPException(status_code=400, detail="Invalid path")

    file_path = f"/data/users/{user_id}/projects/{project_id}/{path}"
    try:
        with data_volume.open(file_path, "r") as f:
            return {"content": f.read()}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
```

### Endpoint一覧

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/generate_game` | POST | Claude CLIでゲーム生成（SSE） |
| `/generate_gemini` | POST | Gemini APIで高速生成（SSE） |
| `/get_file` | GET | プロジェクトファイル取得 |
| `/list_files` | POST | プロジェクトファイル一覧 |
| `/write_file` | POST | ファイル書き込み |
| `/detect_intent` | POST | ユーザー意図検出（Haiku） |
| `/detect_skills` | POST | 必要スキル検出（Haiku） |
| `/git_operation` | POST | Git操作（commit, log, restore） |

---

## 7. SSE → WebSocketブリッジ

ExpressサーバーがModalからのSSEをWebSocketに変換：

```
Modal (SSE)                Express                    Browser (WebSocket)
     │                          │                              │
     │  data: {"type":"stream"} │                              │
     │─────────────────────────▶│                              │
     │                          │  ws.send({type:"stream"})    │
     │                          │─────────────────────────────▶│
     │                          │                              │
     │  data: {"type":"done"}   │                              │
     │─────────────────────────▶│                              │
     │                          │  ws.send({type:"gameUpdated"})│
     │                          │─────────────────────────────▶│
```

---

## 8. Volume構造

```
dreamcore-data/                      ← ユーザーデータ（読み書き可能）
└── users/
    └── {userId}/                    ← UUID形式のみ許可
        ├── projects/
        │   └── {projectId}/
        │       ├── index.html
        │       ├── spec.md
        │       ├── STYLE.md
        │       ├── assets/
        │       └── .git/
        └── assets/                  ← ユーザーアセット

dreamcore-global/                    ← グローバルリソース（読み取り専用）
├── .claude/
│   └── skills/
└── scripts/
```

---

## 9. 環境変数

### Express Server

```env
# 既存（変更なし）
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 新規追加
MODAL_ENDPOINT=https://xxx--dreamcore-generate-game.modal.run
MODAL_GEMINI_ENDPOINT=https://xxx--dreamcore-generate-gemini.modal.run
MODAL_GET_FILE_ENDPOINT=https://xxx--dreamcore-get-file.modal.run
MODAL_WRITE_FILE_ENDPOINT=https://xxx--dreamcore-write-file.modal.run
MODAL_LIST_FILES_ENDPOINT=https://xxx--dreamcore-list-files.modal.run
MODAL_DETECT_INTENT_ENDPOINT=https://xxx--dreamcore-detect-intent.modal.run
MODAL_DETECT_SKILLS_ENDPOINT=https://xxx--dreamcore-detect-skills.modal.run
MODAL_GIT_OPERATION_ENDPOINT=https://xxx--dreamcore-git-operation.modal.run
MODAL_INTERNAL_SECRET=<random-hex-64>
USE_MODAL=true
```

### Modal Secrets

```bash
modal secret create anthropic-api-key ANTHROPIC_API_KEY=sk-ant-...
modal secret create modal-internal-secret MODAL_INTERNAL_SECRET=...
modal secret create gemini-api-key GEMINI_API_KEY=...
```

---

## 10. フォールバック設計

```javascript
// USE_MODAL=false でローカル実行にフォールバック
const USE_MODAL = process.env.USE_MODAL === 'true';

if (USE_MODAL) {
  // Modal経由
} else {
  // ローカル実行（既存コード）
}
```

---

## 11. デプロイ手順

### 初期セットアップ

```bash
# 1. Modal Secrets作成
modal secret create anthropic-api-key ANTHROPIC_API_KEY=sk-ant-...
modal secret create modal-internal-secret MODAL_INTERNAL_SECRET=$(openssl rand -hex 32)
modal secret create gemini-api-key GEMINI_API_KEY=...

# 2. Modal Volumes作成
modal volume create dreamcore-data
modal volume create dreamcore-global

# 3. スキルアップロード
cd modal
modal run upload_skills.py

# 4. Modalアプリデプロイ
modal deploy app.py

# 5. Express環境変数設定
# .envに新規変数追加

# 6. Expressサーバーデプロイ
# 既存のデプロイフローを使用
```

### 更新時

```bash
# スキル変更時
cd modal && modal run upload_skills.py

# Modalアプリ変更時
cd modal && modal deploy app.py

# Expressサーバー変更時
# 既存のデプロイフローを使用
```

---

## 12. トラブルシューティング

| Issue | Check |
|-------|-------|
| 401 on Modal | X-Modal-Secret matches? |
| Files not persisting | `volume.commit()` called? |
| Skills not loading | `modal run upload_skills.py` run? |
| Sandbox timeout | Check complexity, increase timeout |
| WebSocket not receiving | SSE→WS bridge working? |

---

## 13. 参考ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| `/Users/admin/DreamCore-V2-sandbox/docs/modal-architecture/MODAL-SANDBOX-ARCHITECTURE.md` | Modal汎用アーキテクチャパターン |
| `/Users/admin/DreamCore-V2-sandbox/docs/modal-architecture/QUICK-REFERENCE.md` | Modalコマンド・運用チェック |
