# 同時実行数制御の実装計画

**作成日:** 2026-01-23
**優先度:** 中（100人イベント前に必須）
**参照:** sandbox-architecture.md セクション4

---

## 背景

現在の `claudeRunner.js` には同時実行数の制限がない。
100人規模のイベント（DreamCore体験会・ゲーム教室）では、リソース枯渇のリスクがある。

---

## 設計

### 制限値

| レベル | 値 | 設定方法 |
|--------|-----|----------|
| ユーザーあたり | 1件 | 固定（コード内定数） |
| システム全体 | 20件（デフォルト） | 環境変数 `MAX_CONCURRENT_TOTAL` |

### 超過時の挙動

- ユーザー上限超過: 「生成中のリクエストがあります。完了をお待ちください」
- システム上限超過: 「サーバーが混雑しています。しばらくお待ちください」

---

## 実装箇所

### 1. config.js

```javascript
MAX_CONCURRENT_PER_USER: 1,
MAX_CONCURRENT_TOTAL: parseInt(process.env.MAX_CONCURRENT_TOTAL) || 20,
```

### 2. claudeRunner.js

```javascript
// runClaudeAsJob() の先頭に追加

// ユーザーあたり制限
const userProcessCount = [...this.runningProcesses.keys()]
  .filter(key => key.startsWith(userId)).length;

if (userProcessCount >= config.MAX_CONCURRENT_PER_USER) {
  throw new Error('生成中のリクエストがあります。完了をお待ちください');
}

// システム全体制限
if (this.runningProcesses.size >= config.MAX_CONCURRENT_TOTAL) {
  throw new Error('サーバーが混雑しています。しばらくお待ちください');
}
```

### 3. フロントエンド（app.js）

エラーメッセージをユーザーフレンドリーに表示。

---

## スケール対応

| 状況 | GCEスペック | MAX_CONCURRENT_TOTAL |
|------|-------------|---------------------|
| 通常運用 | e2-standard-2 | 20 |
| 50人イベント | e2-standard-4 | 30 |
| 100人イベント | e2-standard-8 | 50 |

---

## 将来の拡張（オプション）

- キュー方式: 「順番待ち（3番目）」表示
- 優先キュー: 有料ユーザー優先
- 自動スケール: GCE負荷に応じて上限動的調整

---

## チェックリスト

- [ ] config.js に環境変数追加
- [ ] claudeRunner.js に制限ロジック追加
- [ ] エラーメッセージの日英対応
- [ ] フロントエンドでのエラー表示
- [ ] イベント前にGCEスペック確認
