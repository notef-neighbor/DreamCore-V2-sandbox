# Modal 技術設計書

作成日: 2026-01-27
対象: DreamCore-V2 Modal移行

---

## Modal概要

[Modal](https://modal.com/) はサーバーレスコンピューティングプラットフォーム。
コンテナベースの関数実行、永続ストレージ（Volume）、GPUサポートを提供。

---

## Volume設計

### ユーザーVolume

```
Volume: dreamcore-user-{userId}
├── projects/
│   └── {projectId}/
│       ├── index.html
│       ├── spec.md
│       ├── STYLE.md
│       ├── PUBLISH.json
│       ├── thumbnail.webp
│       ├── movie.mp4
│       └── .git/
└── assets/
    ├── player_abc123.png
    └── enemy_def456.png
```

### グローバルVolume

```
Volume: dreamcore-global
├── assets/
│   └── {category}/
│       └── {alias}_{hash}.png
└── skills/
    └── {skill-name}/
        └── SKILL.md
```

### Volume作成

```python
# modal_app.py
import modal

app = modal.App("dreamcore")

# ユーザーVolume（動的作成）
def get_user_volume(user_id: str) -> modal.Volume:
    return modal.Volume.from_name(
        f"dreamcore-user-{user_id}",
        create_if_missing=True
    )

# グローバルVolume
global_volume = modal.Volume.from_name("dreamcore-global")
```

---

## Secret設計

### 必要なSecrets

```python
# Modal Secrets設定
secrets = modal.Secret.from_name("dreamcore-secrets")

# 含まれるキー:
# - ANTHROPIC_API_KEY
# - GOOGLE_API_KEY (Gemini)
# - REPLICATE_API_TOKEN (背景削除)
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
```

### Secret作成（CLI）

```bash
modal secret create dreamcore-secrets \
  ANTHROPIC_API_KEY=sk-ant-... \
  GOOGLE_API_KEY=AIza... \
  REPLICATE_API_TOKEN=r8_... \
  SUPABASE_URL=https://xxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Function設計

### 1. generate-game（ゲーム生成）

```python
@app.function(
    image=modal.Image.debian_slim()
        .apt_install("git", "nodejs", "npm")
        .pip_install("anthropic")
        .run_commands("npm install -g @anthropic-ai/claude-code"),
    secrets=[secrets],
    timeout=600,  # 10分
    memory=2048,
)
def generate_game(
    user_id: str,
    project_id: str,
    message: str,
    skills: list[str],
    callback_url: str,  # ストリーミング用
) -> dict:
    import subprocess
    import requests

    volume = get_user_volume(user_id)
    project_path = f"/vol/projects/{project_id}"

    # Claude CLI実行
    process = subprocess.Popen(
        ["claude", "--model", "opus", "--output-format", "stream-json"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=project_path,
    )

    # ストリーミング出力をコールバック
    for line in process.stdout:
        requests.post(callback_url, json={"chunk": line.decode()})

    process.wait()

    return {"status": "completed", "exit_code": process.returncode}
```

### 2. generate-image（画像生成）

```python
@app.function(
    image=modal.Image.debian_slim()
        .pip_install("google-generativeai", "pillow"),
    secrets=[secrets],
    timeout=120,
)
def generate_image(
    user_id: str,
    prompt: str,
    output_path: str,
    style: str = "kawaii",
) -> dict:
    import google.generativeai as genai
    from PIL import Image

    volume = get_user_volume(user_id)

    # Gemini Imagen呼び出し
    genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
    model = genai.ImageGenerationModel("imagen-3.0-generate-002")

    result = model.generate_images(
        prompt=f"{prompt}, {style} style",
        number_of_images=1,
    )

    # Volume に保存
    image = result.images[0]
    with volume.open(output_path, "wb") as f:
        image.save(f, "PNG")

    return {"path": output_path}
```

### 3. git-operation（Git操作）

```python
@app.function(
    image=modal.Image.debian_slim().apt_install("git"),
    timeout=60,
)
def git_operation(
    user_id: str,
    project_id: str,
    operation: str,  # "commit", "log", "checkout", "diff"
    **kwargs,
) -> dict:
    import subprocess

    volume = get_user_volume(user_id)
    project_path = f"/vol/projects/{project_id}"

    if operation == "commit":
        message = kwargs.get("message", "Auto commit")
        subprocess.run(["git", "add", "-A"], cwd=project_path)
        subprocess.run(["git", "commit", "-m", message], cwd=project_path)

    elif operation == "log":
        result = subprocess.run(
            ["git", "log", "--oneline", "-n", "50"],
            cwd=project_path,
            capture_output=True,
            text=True,
        )
        return {"log": result.stdout}

    elif operation == "checkout":
        commit_hash = kwargs.get("commit_hash")
        subprocess.run(["git", "checkout", commit_hash], cwd=project_path)

    elif operation == "diff":
        commit_hash = kwargs.get("commit_hash")
        result = subprocess.run(
            ["git", "diff", commit_hash, "HEAD"],
            cwd=project_path,
            capture_output=True,
            text=True,
        )
        return {"diff": result.stdout}

    return {"status": "ok"}
```

### 4. render-video（動画生成）

```python
@app.function(
    image=modal.Image.debian_slim()
        .apt_install("nodejs", "npm", "chromium")
        .run_commands("npm install -g @remotion/cli"),
    gpu="T4",  # GPU使用
    timeout=300,
    memory=4096,
)
def render_video(
    user_id: str,
    project_id: str,
    output_path: str,
) -> dict:
    import subprocess

    volume = get_user_volume(user_id)
    project_path = f"/vol/projects/{project_id}"

    # Remotionレンダリング
    subprocess.run([
        "npx", "remotion", "render",
        "--props", f'{{"projectPath": "{project_path}"}}',
        "--output", output_path,
    ])

    return {"path": output_path}
```

### 5. file-operation（ファイル操作）

```python
@app.function(timeout=30)
def file_operation(
    user_id: str,
    operation: str,  # "read", "write", "delete", "list", "exists"
    path: str,
    content: str = None,
) -> dict:
    volume = get_user_volume(user_id)
    full_path = f"/vol/{path}"

    if operation == "read":
        with volume.open(full_path, "r") as f:
            return {"content": f.read()}

    elif operation == "write":
        with volume.open(full_path, "w") as f:
            f.write(content)
        return {"status": "ok"}

    elif operation == "delete":
        volume.remove(full_path)
        return {"status": "ok"}

    elif operation == "list":
        files = list(volume.iterdir(full_path))
        return {"files": files}

    elif operation == "exists":
        exists = volume.exists(full_path)
        return {"exists": exists}

    return {"error": "unknown operation"}
```

---

## Node.js クライアント

### modalClient.js

```javascript
// server/modalClient.js
const MODAL_API_URL = process.env.MODAL_API_URL || 'https://api.modal.com';
const MODAL_TOKEN = process.env.MODAL_TOKEN;

class ModalClient {
  constructor() {
    this.baseUrl = MODAL_API_URL;
    this.token = MODAL_TOKEN;
  }

  async callFunction(functionName, params) {
    const response = await fetch(`${this.baseUrl}/v1/apps/dreamcore/functions/${functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Modal function failed: ${response.status}`);
    }

    return response.json();
  }

  async generateGame(userId, projectId, message, skills, callbackUrl) {
    return this.callFunction('generate-game', {
      user_id: userId,
      project_id: projectId,
      message,
      skills,
      callback_url: callbackUrl,
    });
  }

  async generateImage(userId, prompt, outputPath, style = 'kawaii') {
    return this.callFunction('generate-image', {
      user_id: userId,
      prompt,
      output_path: outputPath,
      style,
    });
  }

  async gitOperation(userId, projectId, operation, options = {}) {
    return this.callFunction('git-operation', {
      user_id: userId,
      project_id: projectId,
      operation,
      ...options,
    });
  }

  async renderVideo(userId, projectId, outputPath) {
    return this.callFunction('render-video', {
      user_id: userId,
      project_id: projectId,
      output_path: outputPath,
    });
  }

  async fileOperation(userId, operation, path, content = null) {
    return this.callFunction('file-operation', {
      user_id: userId,
      operation,
      path,
      content,
    });
  }

  // ファイル読み書きのショートカット
  async readFile(userId, path) {
    const result = await this.fileOperation(userId, 'read', path);
    return result.content;
  }

  async writeFile(userId, path, content) {
    return this.fileOperation(userId, 'write', path, content);
  }

  async deleteFile(userId, path) {
    return this.fileOperation(userId, 'delete', path);
  }

  async listFiles(userId, path) {
    const result = await this.fileOperation(userId, 'list', path);
    return result.files;
  }

  async fileExists(userId, path) {
    const result = await this.fileOperation(userId, 'exists', path);
    return result.exists;
  }
}

module.exports = new ModalClient();
```

---

## ストリーミングブリッジ

### streamBridge.js

```javascript
// server/streamBridge.js
const express = require('express');
const { jobManager } = require('./jobManager');

// ストリーミングコールバック用ルーター
const streamRouter = express.Router();

// Modal Functionからのコールバック受信
streamRouter.post('/callback/:jobId', (req, res) => {
  const { jobId } = req.params;
  const { chunk, type, error } = req.body;

  const job = jobManager.getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (type === 'stream') {
    // WebSocketに転送
    jobManager.emit(jobId, 'stream', { content: chunk });
  } else if (type === 'progress') {
    jobManager.updateProgress(jobId, req.body.progress, req.body.message);
  } else if (type === 'error') {
    jobManager.failJob(jobId, error);
  } else if (type === 'complete') {
    jobManager.completeJob(jobId, req.body.result);
  }

  res.json({ ok: true });
});

// コールバックURL生成
function getCallbackUrl(jobId) {
  const baseUrl = process.env.CALLBACK_BASE_URL || 'https://api.dreamcore.com';
  return `${baseUrl}/modal/callback/${jobId}`;
}

module.exports = { streamRouter, getCallbackUrl };
```

### index.jsへの統合

```javascript
// server/index.js
const { streamRouter, getCallbackUrl } = require('./streamBridge');

// ストリーミングコールバック用エンドポイント
app.use('/modal', streamRouter);
```

---

## 環境変数

### 本番環境

```bash
# Modal
MODAL_TOKEN=your-modal-token
MODAL_API_URL=https://api.modal.com
USE_MODAL=true

# コールバック
CALLBACK_BASE_URL=https://api.dreamcore.com

# Supabase（既存）
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### ローカル開発

```bash
# Modal（ローカルテスト用）
MODAL_TOKEN=your-modal-token
USE_MODAL=false  # ローカルでは無効化

# コールバック（ngrok等でトンネル）
CALLBACK_BASE_URL=https://abc123.ngrok.io
```

---

## ローカル開発フロー

### 1. Modal CLIインストール

```bash
pip install modal
modal token new
```

### 2. Function開発

```bash
# ローカルでテスト
modal run modal_app.py::generate_game --user-id test --project-id test

# デプロイ
modal deploy modal_app.py
```

### 3. ローカルサーバー + Modal

```bash
# ngrokでトンネル作成（コールバック用）
ngrok http 3000

# 環境変数設定
export CALLBACK_BASE_URL=https://abc123.ngrok.io
export USE_MODAL=true

# サーバー起動
npm run dev
```

---

## フォールバック設計

### 条件分岐

```javascript
// server/claudeRunner.js
const modalClient = require('./modalClient');
const USE_MODAL = process.env.USE_MODAL === 'true';

async function runClaude(userId, projectId, message, skills) {
  if (USE_MODAL) {
    // Modal経由
    return runClaudeOnModal(userId, projectId, message, skills);
  } else {
    // ローカル実行（既存コード）
    return runClaudeLocal(userId, projectId, message, skills);
  }
}

async function runClaudeOnModal(userId, projectId, message, skills) {
  const callbackUrl = getCallbackUrl(jobId);
  return modalClient.generateGame(userId, projectId, message, skills, callbackUrl);
}

async function runClaudeLocal(userId, projectId, message, skills) {
  // 既存のローカル実行コード
  const child = spawn('claude', [...], { cwd: projectDir });
  // ...
}
```

---

## モニタリング

### Modal Dashboard
- Function実行時間
- エラー率
- Volume使用量

### カスタムメトリクス
```javascript
// ジョブ完了時にログ
console.log(JSON.stringify({
  type: 'job_completed',
  userId,
  projectId,
  duration: endTime - startTime,
  modal: USE_MODAL,
}));
```

---

## コスト見積もり

### Modal料金体系（2026年時点の目安）

| リソース | 単価 | 想定使用量/月 | 月額 |
|---------|------|--------------|------|
| CPU (generate-game) | $0.0001/sec | 100,000 sec | $10 |
| CPU (その他) | $0.0001/sec | 50,000 sec | $5 |
| GPU T4 (render-video) | $0.0006/sec | 10,000 sec | $6 |
| Volume Storage | $0.30/GB/月 | 100 GB | $30 |
| Volume I/O | $0.10/million | 10 million | $1 |

**想定月額: 約$50-100**

※実際の使用量に応じて変動

---

## セキュリティ考慮

### 隔離
- ユーザーごとに別Volume
- Function実行はステートレス
- ネットワーク制限（必要なAPIのみ許可）

### Secret管理
- Modal Secretsで一元管理
- 環境変数で注入
- ログに出力しない

### 入力検証
- パス操作時のディレクトリトラバーサル防止
- ユーザーIDの検証

```python
def validate_path(user_id: str, path: str) -> str:
    """パストラバーサル防止"""
    import os
    base = f"/vol/projects"
    full = os.path.normpath(os.path.join(base, path))
    if not full.startswith(base):
        raise ValueError("Invalid path")
    return full
```
