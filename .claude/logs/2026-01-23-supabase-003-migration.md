# 作業ログ: Supabase 003 Migration

**日付:** 2026-01-23
**ブランチ:** feature/supabase-003-fixes
**コミット:** 8e31e50

---

## 概要

Supabase のスキーマ整合性・RLS 最適化・セキュリティ強化のためのマイグレーション 003 を作成・本番適用した。

---

## 実施内容

### 1. 003_sync_schema.sql の作成

| 変更 | 内容 |
|------|------|
| RLS 最適化 | `auth.uid()` → `(SELECT auth.uid())` で行ごとの評価を回避 |
| RLS roles | 全29ポリシーに `TO authenticated` 追加（セキュリティ原則） |
| WITH CHECK | UPDATE ポリシー6箇所に明示追加（防御的プログラミング） |
| games ポリシー | Phase 1 方針（owner-only + authenticated）に統一 |
| profiles backfill | `to_regclass` ガードで新規環境対応 |
| FK インデックス | 10個追加（JOIN/DELETE パフォーマンス向上） |

### 2. OAuth コールバックのバグ修正

| ファイル | 修正内容 |
|----------|----------|
| `public/create.html` | 早期チェックで OAuth パラメータ（`#access_token`）をスキップ |
| `public/app.js` | OAuth 時は Supabase セッション取得を待機してからリダイレクト判定 |

---

## 発見した問題点

### 問題1: ログインできない

- **症状:** Google ログイン後、`/create.html` に戻らず `/` にリダイレクトされる
- **原因:** Supabase Dashboard の Redirect URLs が空だった
- **対応:** `http://localhost:3000/create.html` を追加

### 問題2: OAuth 後に `/` へ戻される

- **症状:** Redirect URLs 設定後もログインできない
- **原因:** `create.html` と `app.js` の早期チェックが OAuth コールバック直後（`dreamcore_session_cache` 未作成）にリダイレクトしていた
- **対応:** OAuth パラメータ（`#access_token`, `?code`）がある場合はセッション取得を待機

---

## 専門家レビュー対応

### 第1回レビュー（計画段階）

| 指摘 | 対応 |
|------|------|
| UPDATE に WITH CHECK がない | 6箇所に追加 |
| games ポリシーが不完全（games_read_public のみ削除） | 全4ポリシー削除→再作成 |
| profiles backfill が新規環境で失敗する | `to_regclass` ガード追加 |
| インデックス冗長の可能性 | 運用後に判断（今回は残す） |

### 第2回レビュー（実装後）

| 指摘 | 対応 |
|------|------|
| `projects.remixed_from` インデックス不足 | `idx_projects_remixed_from` 追加 |
| `jobs.project_id` インデックス不足 | `idx_jobs_project_id` 追加 |

---

## 本番適用結果

### 適用前

| 項目 | 状態 |
|------|------|
| ポリシー数 | 38（重複あり） |
| roles | 全て `{public}` |
| UPDATE WITH CHECK | 0 |

### 適用後

| 項目 | 状態 |
|------|------|
| ポリシー数 | 29（profiles 除く） |
| roles | 全て `{authenticated}`（profiles 除く） |
| UPDATE WITH CHECK | 6（profiles 除く） |
| インデックス数 | 22 |

---

## 残タスク

| 項目 | 優先度 | 備考 |
|------|--------|------|
| profiles テーブル削除 | 低 | レガシー、コードで未参照、影響なし |
| インデックス冗長整理 | 低 | 運用後に `pg_stat_user_indexes` で判断 |
| 本番 Redirect URLs に本番URL追加 | 中 | デプロイ時に実施 |

---

## 変更ファイル

```
supabase/migrations/003_sync_schema.sql  (新規)
public/create.html                       (OAuth対応)
public/app.js                            (OAuth対応)
```

---

## 学び・注意点

1. **Supabase Redirect URLs**: OAuth 使用時は必ず設定が必要
2. **早期チェックと OAuth の競合**: セッションキャッシュ依存の早期リダイレクトは OAuth コールバックを考慮する必要がある
3. **WITH CHECK の明示**: PostgreSQL では省略可能だが、明示した方がレビュー時に見落としがない
4. **to_regclass ガード**: テーブルの存在確認には `IF EXISTS` より `to_regclass` が柔軟
