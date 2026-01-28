# Claude セッション永続化 計画書

**ステータス**: 将来実装予定
**作成日**: 2026-01-28
**参照**: claude-slack-gif-creator, modal-claude-agent-sdk-python

---

## 概要

Claude Agent SDK の `resume` パラメータを使用して、Sandbox が終了しても会話履歴を継続できる機能。ユーザーがプロジェクトに戻った時、Claude が「前回ここまで作ったよね」と覚えている状態を実現する。

---

## 技術的背景

### 仕組み

```
┌─────────────────────────────────────────────────────────┐
│  Modal Volume（永続ストレージ）                          │
│  /data/users/{userId}/projects/{projectId}/             │
│  └── .claude-session  ← session_id を保存               │
└─────────────────────────────────────────────────────────┘
        ↑ 保存                    ↓ 読み込み
┌───────────────┐           ┌───────────────┐
│  Sandbox A    │  終了 →   │  Sandbox B    │
│  (1回目)      │           │  (2回目)      │
│  session_id   │           │  resume=      │
│  を取得・保存  │           │  session_id   │
└───────────────┘           └───────────────┘
```

### Claude Agent SDK の resume パラメータ

```python
# claude-slack-gif-creator より
options = ClaudeAgentOptions(
    resume=session_id,  # 前回のセッションを再開
    system_prompt=SYSTEM_PROMPT,
    allowed_tools=["Bash", "Read", "Write"],
)
```

- `session_id` は Anthropic 側で管理されている会話履歴への参照
- Sandbox が終了しても、Anthropic のサーバーには会話履歴が残っている
- 新しい Sandbox で `resume=session_id` を渡すと、続きから会話できる

---

## 参照リポジトリ

### claude-slack-gif-creator (Modal 公式)

**GitHub**: https://github.com/modal-projects/claude-slack-gif-creator

**関連ファイル**:
- `src/agent/agent_entrypoint.py` - セッション読み込み・保存
- `src/main.py` - Sandbox ライフサイクル管理

**セッション保存パターン**:
```python
SESSIONS_FILE = Path("/data/sessions.json")

def load_session_id(sandbox_name: str) -> str | None:
    if not SESSIONS_FILE.exists():
        return None
    sessions = json.loads(SESSIONS_FILE.read_text())
    return sessions.get(sandbox_name)

def save_session_id(sandbox_name: str, session_id: str):
    sessions = {}
    if SESSIONS_FILE.exists():
        sessions = json.loads(SESSIONS_FILE.read_text())
    sessions[sandbox_name] = session_id
    SESSIONS_FILE.write_text(json.dumps(sessions))
```

### modal-claude-agent-sdk-python

**GitHub**: https://github.com/sshh12/modal-claude-agent-sdk-python

**関連ファイル**:
- `src/modal_agents_sdk/_options.py` - ModalAgentOptions の resume パラメータ
- `examples/multi_turn.py` - マルチターン会話の例

---

## DreamCore 実装案

### 1. ファイル構造

```
/data/users/{userId}/projects/{projectId}/
├── index.html
├── .git/
├── .current-version      ← 既存（現在表示中のバージョン）
└── .claude-session       ← 新規（セッションID）
```

### 2. バックエンド変更

**server/userManager.js**:
```javascript
// セッションID 読み込み
const getClaudeSession = (userId, projectId) => {
  const projectDir = getProjectDir(userId, projectId);
  const sessionFile = path.join(projectDir, '.claude-session');
  try {
    if (fs.existsSync(sessionFile)) {
      return fs.readFileSync(sessionFile, 'utf8').trim();
    }
  } catch (e) {
    // Ignore
  }
  return null;
};

// セッションID 保存
const setClaudeSession = (userId, projectId, sessionId) => {
  const projectDir = getProjectDir(userId, projectId);
  const sessionFile = path.join(projectDir, '.claude-session');
  try {
    if (sessionId) {
      fs.writeFileSync(sessionFile, sessionId, 'utf8');
    } else if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
    }
  } catch (e) {
    console.warn('[setClaudeSession] Error:', e.message);
  }
};
```

**server/claudeRunner.js** (または Modal 呼び出し部分):
```javascript
// Claude CLI 呼び出し時
const sessionId = getClaudeSession(userId, projectId);
const args = sessionId
  ? ['--resume', sessionId, '--print', '-p', prompt]
  : ['--print', '-p', prompt];

// 実行後、新しい session_id を取得して保存
// (Claude の出力から session_id を抽出する必要あり)
```

### 3. セッションID の取得方法

Claude CLI の出力から session_id を取得する方法を調査する必要あり:
- `--json` オプションで構造化出力？
- 特定のログパターンから抽出？
- Claude Agent SDK の Python 版を参考に

### 4. セッションリセット

以下のタイミングでセッションをクリア:
- ユーザーが明示的に「新しい会話を開始」
- 一定期間（例: 7日）経過後
- プロジェクト削除時

---

## 期待される UX

### Before（現状）
```
ユーザー: 「敵キャラを追加して」
Claude: 「どんな敵ですか？」
ユーザー: 「スライムで」
Claude: 「追加しました」
(ページリロード)
ユーザー: 「敵の動きを変えて」
Claude: 「どの敵のことですか？」 ← 忘れている
```

### After（実装後）
```
ユーザー: 「敵キャラを追加して」
Claude: 「どんな敵ですか？」
ユーザー: 「スライムで」
Claude: 「追加しました」
(ページリロード)
ユーザー: 「敵の動きを変えて」
Claude: 「スライムの動きを変更しますね」 ← 覚えている
```

---

## 制限事項・懸念点

| 項目 | 内容 | 対策 |
|------|------|------|
| 有効期限 | Anthropic 側でセッションが期限切れになる可能性 | 期限切れ時は新規セッション開始 |
| ストレージ | session_id を Volume に保存する必要 | `.claude-session` ファイルで管理 |
| プライバシー | 会話履歴が Anthropic に保持される | ユーザーに明示、オプトアウト提供 |
| コスト | セッション維持自体は無料 | API 呼び出し時のみ課金 |
| 複数デバイス | 同じプロジェクトを複数デバイスで操作 | 最後のセッションが優先 |

---

## 実装優先度

**Phase 2（短期）** として位置付け

依存関係:
- CIDR Allowlist 設定（Phase 1）
- Idle Timeout 追加（Phase 1）

---

## 関連ドキュメント

- `/docs/ENGINEER-HANDOFF.md` - Modal 統合の全体像
- `/docs/MODAL-DESIGN.md` - SSE→WS 変換ルール
- `/.claude/logs/2026-01-28-repo-investigation.md` - 調査レポート（作成予定）

---

## 調査時のメモ

### claudex からの学び
- Multi-provider 対応の Factory パターン
- SSE ストリーミング（WebSocket より単純）
- スキル ZIP 配布システム

### modal-claude-agent-sdk からの学び
- CIDR Allowlist でネットワーク制限
- Host Tools パターン（Sandbox→Express のコールバック）
- エラー分類（exit_code 追跡）

### claude-slack-gif-creator からの学び
- 永続 Sandbox（thread 単位で名前付け）
- セッション永続化（Volume に JSON 保存）
- API キープロキシ（Sandbox にキーを渡さない）
