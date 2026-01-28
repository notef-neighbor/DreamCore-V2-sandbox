# Sandbox 再利用機能の実装

**日付:** 2026-01-28
**対象:** `/Users/admin/DreamCore-V2-modal/modal/app.py`
**コミット:** `6dda89c` (DreamCore-V2-modal)

---

## 概要

同一プロジェクトへの連続リクエストで Sandbox を再利用することで、コールドスタートのオーバーヘッド（約10秒）を削減する。

---

## 実装内容

### 1. 定数追加

```python
SANDBOX_IDLE_TIMEOUT = 20 * 60      # 20分（アイドル時の自動終了）
SANDBOX_MAX_TIMEOUT = 5 * 60 * 60   # 5時間（最大寿命）
```

### 2. ヘルパー関数

```python
def get_sandbox_name(user_id: str, project_id: str) -> str:
    """user_id + project_id から一意な Sandbox 名を生成"""
    combined = f"{user_id}:{project_id}"
    hash_str = hashlib.sha256(combined.encode()).hexdigest()[:12]
    return f"dreamcore-{hash_str}"
```

**命名規則:** `dreamcore-{sha256(user_id:project_id)[:12]}`
- 12文字の hex で十分なユニーク性（16^12 ≈ 281兆通り）
- UUID をそのまま使うより短く、衝突リスクも低い

### 3. Named Sandbox パターン

```python
try:
    # 既存 Sandbox を取得（ウォームスタート）
    sb = modal.Sandbox.from_name(APP_NAME, sandbox_name)
    sandbox_reused = True
except modal.exception.NotFoundError:
    # 新規作成（コールドスタート）
    sb = modal.Sandbox.create(
        name=sandbox_name,
        idle_timeout=SANDBOX_IDLE_TIMEOUT,
        timeout=SANDBOX_MAX_TIMEOUT,
        ...
    )
except (AlreadyExistsError, Exception) as e:
    # レースコンディション: 別リクエストが先に作成
    if "already exists" in str(e).lower():
        sb = modal.Sandbox.from_name(APP_NAME, sandbox_name)
except (SandboxTerminatedError, SandboxTimeoutError):
    # 異常状態の Sandbox を再作成
    sb = modal.Sandbox.create(...)
```

### 4. terminate() 削除

**Before:**
```python
finally:
    sb.terminate()
```

**After:**
```python
# NOTE: Do NOT terminate the sandbox!
# It will auto-terminate after idle_timeout (20 min) for reuse
```

### 5. デバッグ情報追加

```python
debug_info = {
    'type': 'debug',
    'sandbox_reused': sandbox_reused,  # True = warm, False = cold
    ...
}
```

---

## 設計判断

### Sandbox 上限（3個）は Phase 2 で実装

**理由:**
- Modal SDK に Sandbox 列挙 API がない
- Express 側の in-memory 追跡は再起動でリセット（ベストエフォート）
- TTL（20分）による自然消滅で初期リリースは十分

### Skills は コピー方式を維持

**理由:**
- `CLAUDE_SKILLS_PATH` 環境変数の有効性が未検証
- 安全側の実装を優先
- 動作確認済みの方式を変更するリスクを回避

---

## 検証結果

### 基本動作テスト

| リクエスト | ステータスメッセージ | sandbox_reused | 所要時間 |
|------------|---------------------|----------------|---------|
| 1回目 | "Creating sandbox..." | `false` | 26.19秒 |
| 2回目 | "Sandbox connected (warm)" | `true` | 15.07秒 |

**改善効果:** 約10秒の短縮（Sandbox 作成時間のスキップ）

### TTL 検証方法

```bash
# リクエスト送信後、21分待機してから再リクエスト
# → "Creating sandbox..." が表示されれば TTL が機能している
```

### 複数プロジェクト並列テスト

異なる project_id で同時リクエストを送信し、それぞれ独立した Sandbox が作成されることを確認。

---

## 期待される効果

| 指標 | Before | After |
|------|--------|-------|
| 初回リクエスト | 26秒 | 26秒（変わらず） |
| 2回目以降 | 26秒 | **15秒**（約10秒短縮） |
| アイドルコスト | 0 | 最大20分/プロジェクト |

---

## 将来の改善候補

1. **Skills の直接参照**
   - `CLAUDE_SKILLS_PATH=/global/.claude/skills` の検証
   - 有効なら Skills コピー処理（2-3秒）をスキップ可能

2. **Sandbox 上限（Phase 2）**
   - ユーザーあたり最大3個の Sandbox を維持
   - Redis 等で永続追跡が必要

3. **ウォームアップ強化**
   - アクティブユーザーのプロジェクトを事前にウォームアップ
   - Sandbox の idle_timeout をリセット

---

## ロールバック手順

問題発生時:
1. `app.py` を元に戻す（`Sandbox.create()` + `terminate()`）
2. `modal deploy app.py` で再デプロイ
3. 既存 Sandbox は idle_timeout で自然消滅
