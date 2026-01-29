# サムネイル生成修正

**日付:** 2026-01-29
**作業者:** Claude

## 背景・問題

publish.html でサムネイルが表示されない問題が発生。

**エラーログ:**
```
[NanoBanana Error] subprocess.CalledProcessError: Command '['/usr/bin/python3', '-m', 'venv', ...]' returned non-zero exit status 1.
[NanoBanana Error] ModuleNotFoundError: No module named 'google'
```

## 原因分析

3つの問題が重なっていた:

1. **Python venv パッケージ不足**: GCE に `python3.12-venv` がインストールされていなかった
2. **NanoBanana 依存関係不足**: `google-genai`, `pillow` がインストールされていなかった
3. **Claude CLI 不在**: プロンプト生成に `spawn('claude', ...)` を使用していたが、GCE に Claude CLI がない

## 実施内容

### 1. Python venv パッケージインストール

```bash
sudo apt-get install -y python3.12-venv
```

### 2. NanoBanana 依存関係インストール

```bash
cd /home/notef/DreamCore-V2-sandbox/.claude/skills/nanobanana
rm -rf .venv
python3 -m venv .venv
.venv/bin/pip install google-genai pillow
```

### 3. generate-thumbnail エンドポイント修正

**ファイル:** `server/index.js`

プロンプト生成をローカル Claude CLI から Modal Haiku に変更:

```javascript
// Before: ローカル Claude CLI (GCE にない)
const claudePrompt = spawn('claude', ['--print', '--model', 'sonnet', ...]);

// After: Modal Haiku
const haikuResult = await modalClient.chatHaiku({
  message: promptGeneratorPrompt,
  game_spec: '',
  conversation_history: [],
});
imagePrompt = haikuResult.message;
```

**フォールバック追加:**
Modal Haiku が失敗した場合、タイトルベースの簡易プロンプトを使用:
```javascript
imagePrompt = `ゲーム「${title}」のサムネイル。縦長9:16、アプリストア向け高品質イラスト。`;
```

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `server/index.js` | generate-thumbnail を Modal Haiku 対応に |
| GCE システム | python3.12-venv インストール |
| GCE NanoBanana | venv 作成 + 依存関係インストール |

## 検証結果

publish.html でサムネイルが正常に生成・表示されることを確認。

## 学び・注意点

- GCE には Claude CLI がインストールされていないため、すべての Claude 関連機能は Modal 経由で実行する必要がある
- Python スクリプトを使用する場合、GCE の Python 環境（venv パッケージ、依存関係）を事前に確認する
- NanoBanana は `google-genai` パッケージを使用するため、Gemini API キーが環境変数に必要
