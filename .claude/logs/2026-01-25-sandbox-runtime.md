# sandbox-runtime 導入作業ログ

**作業日:** 2026-01-25
**目的:** Claude CLI 実行時のセキュリティ強化（OS ネイティブサンドボックス）

---

## 背景

DreamCore-V2 では Claude CLI を `spawn` で直接実行していたが、OS レベルの隔離がなかった。
Anthropic の `@anthropic-ai/sandbox-runtime` を使用して、ファイルシステム・ネットワークの制限を追加。

---

## 実施内容

### 1. sandbox-runtime 実装の改善（server/claudeRunner.js）

**専門家レビューで指摘された問題:**

| 指摘 | 重要度 | 対応 |
|------|--------|------|
| spawnClaude() が常に非サンドボックス | HIGH | 全呼び出しを spawnClaudeAsync() に移行 |
| 初期化完了前の実行がスルー | MEDIUM | Promise 共有 + await initSandbox() |
| sh -c のクオート不足 | MEDIUM | shellEscape() で POSIX 標準エスケープ |
| allowWrite がプロジェクトDir未対応 | MEDIUM | getSandboxOverrides() で cwd を動的追加 |

**変更内容:**

1. **初期化の Promise 共有**
   - `sandboxInitPromise` で重複初期化を防止
   - `sandboxInitFailed` フラグで失敗状態を追跡
   - `spawnClaudeAsync` 内で `await initSandbox()` を呼び、初期化完了を保証

2. **シェルエスケープの安全化**
   - `shellEscape()`: シングルクォートで POSIX 標準エスケープ
   - `buildClaudeCommand()`: 引数を安全に連結

3. **動的 allowWrite**
   - `getSandboxOverrides(options)`: cwd（プロジェクトDir）を動的に追加
   - `wrapWithSandbox` にカスタム設定を渡す

4. **全呼び出しの async 化**
   - 10箇所の `spawnClaude()` を `await spawnClaudeAsync()` に変更

### 2. 環境変数の有効化（.env）

```
USE_SANDBOX=true
```

### 3. 動作検証

- サーバー起動: `[sandbox-runtime] Initialized with secure configuration`
- CLI 実行時: `[sandbox-runtime] Running Claude in sandbox` が全呼び出しで出力
- ゲーム生成・プレビュー: 正常動作を確認

---

## 有効化された保護

### ファイルシステム制限（sandbox-config.json）

**読み取り禁止:**
- `~/.ssh`, `~/.aws`, `~/.config/gcloud`, `~/.gnupg`
- `/etc/passwd`, `/etc/shadow`, `/etc/sudoers`

**書き込み許可:**
- `./data`（DATA_DIR）
- `/tmp`
- プロジェクトディレクトリ（動的追加）

**書き込み禁止:**
- `.env`, `.env.*`
- `*.pem`, `*.key`, `*.p12`
- `credentials.json`, `service-account.json`

### ネットワーク制限

**許可ドメイン:**
- `api.anthropic.com`, `*.anthropic.com`
- `registry.npmjs.org`
- `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`
- `fonts.googleapis.com`, `fonts.gstatic.com`
- `unpkg.com`, `esm.sh`

---

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `server/claudeRunner.js` | sandbox-runtime 統合の改善 |
| `.env` | `USE_SANDBOX=true` 追加 |

---

## 注意事項

- macOS: `sandbox-exec` (Seatbelt) を使用
- Linux: `bubblewrap` を使用
- Docker 内では `enableWeakerNestedSandbox` が必要になる場合あり
- sandbox-runtime は research preview のため、将来 API が変わる可能性あり

---

## 参考

- sandbox-runtime README: https://github.com/anthropics/sandbox-runtime
- 元の計画: `.claude/plans/docker-sandbox-claude-cli.md`（Docker 方式 → sandbox-runtime 方式に変更）
