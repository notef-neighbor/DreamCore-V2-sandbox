# claudeChat Modal Haiku 統合

**日付:** 2026-01-29
**作業者:** Claude

## 背景・問題

GCE サーバーには Claude CLI がインストールされていないため、`claudeChat.js` が `which claude` でCLIを検出できず、チャットモードが常に Gemini にフォールバックしていた。

**ログ:**
```
Claude CLI not found, Claude Chat will not be available
[claudeChat] Modal error: getModalClient is not a function
Haiku chat failed, falling back to Gemini: getModalClient is not a function
```

## 原因分析

1. **GCE に Claude CLI がない**: `claudeChat.js` は `which claude` で CLI を検出 → 失敗
2. **Modal Haiku 未対応**: `claudeChat.js` はローカル CLI 実行を前提に設計されていた
3. **インポートエラー**: Modal 対応時に `getModalClient` を誤ってインポート

## 実施内容

### 1. Modal `chat_haiku` エンドポイント追加

**ファイル:** `/Users/admin/DreamCore-V2-modal/modal/app.py`

```python
@app.function(image=web_image, secrets=[api_proxy_secret, internal_secret, proxy_secret])
@modal.fastapi_endpoint(method="POST")
async def chat_haiku(request: Request):
    """Handle chat requests using Claude Haiku in sandbox."""
    # game_spec と conversation_history を受け取り
    # run_haiku_in_sandbox でプロンプト実行
    # JSON レスポンス { message, suggestions } を返す
```

### 2. modalClient に `chatHaiku` メソッド追加

**ファイル:** `server/modalClient.js`

```javascript
async chatHaiku({ message, game_spec = '', conversation_history = [] }) {
  const endpoint = getEndpoint(null, this.baseEndpoint, 'chat_haiku');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': this.internalSecret },
    body: JSON.stringify({ message, game_spec, conversation_history }),
  });
  return await response.json();
}
```

### 3. claudeChat.js を Modal 対応に書き換え

**ファイル:** `server/claudeChat.js`

| Before | After |
|--------|-------|
| `which claude` でCLI検出 | `config.USE_MODAL && config.MODAL_ENDPOINT` で判定 |
| ローカル CLI 実行 | `modalClient.chatHaiku()` を呼び出し |
| `getModalClient()` (誤り) | `modalClient` を直接使用 |

**修正したインポートエラー:**
```javascript
// Before (誤り)
const { getModalClient } = require('./modalClient');
const client = getModalClient();

// After (正しい)
const modalClient = require('./modalClient');
const result = await modalClient.chatHaiku({...});
```

## 検証結果

**修正後のログ:**
```
Claude Chat client initialized (using Modal Haiku)
[detectIntent] Modal result: chat
Chat intent detected by Claude, using Haiku...
[claudeChat] Calling Modal chat_haiku...
[claudeChat] Modal Haiku responded in 16204ms
[claudeChat] Suggestions: ["キーボード操作（矢印キーとスペースキー）にも対応させて",...]
Job completed with Haiku (chat mode): 91b17fd1-840a-4bb0-be60-c7b4bdcdbe94
```

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `modal/app.py` | `chat_haiku` エンドポイント追加 |
| `server/modalClient.js` | `chatHaiku` メソッド追加 |
| `server/claudeChat.js` | Modal Haiku 対応に書き換え |

## 学び・注意点

- `modalClient.js` は singleton パターンでエクスポートされているため、`require('./modalClient')` で直接インスタンスを取得する
- GCE サーバーには Claude CLI がないため、すべての Claude 関連機能は Modal 経由で実行する必要がある
- チャットモードのフォールバックは意図しない動作を引き起こすため、明確にエラーを出すべき
