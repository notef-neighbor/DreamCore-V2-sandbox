# Modal generate_game volumes 修正

**日付:** 2026-01-28

## 問題

バグフィックスで Claude Code CLI が動作中にエラー:

```
Modal function has no attached volumes. Please specify 'volumes' parameter in your @app.function decorator.
```

## 原因

`/Users/admin/DreamCore-V2-modal/modal/app.py` の `generate_game` 関数のデコレータに `volumes=` パラメータが欠落していた。

```python
# 修正前（volumes がない）
@app.function(image=web_image, secrets=[anthropic_secret, internal_secret])
@modal.fastapi_endpoint(method="POST")
async def generate_game(request: Request):
```

`generate_game` は Claude CLI を実行してゲームコードを生成・保存する関数で、ファイル操作のために Volume マウントが必須。

## 修正内容

```python
# 修正後
@app.function(
    image=web_image,
    secrets=[anthropic_secret, internal_secret],
    volumes={MOUNT_DATA: data_volume, MOUNT_GLOBAL: global_volume}
)
@modal.fastapi_endpoint(method="POST")
async def generate_game(request: Request):
```

## 修正ファイル

| ファイル | 変更内容 |
|----------|----------|
| `/Users/admin/DreamCore-V2-modal/modal/app.py` | `generate_game` に volumes パラメータ追加 |

## デプロイ

```bash
cd /Users/admin/DreamCore-V2-modal && modal deploy modal/app.py
```

結果:
```
✓ App deployed in 3.092s! 🎉
```

## 調査方法

1. GCE ログ確認（`pm2 logs dreamcore-sandbox`）
2. Modal Dashboard でエラーステータスのリクエスト確認
3. `generate_game` 関数のデコレータ確認

## 学び・注意点

- Modal の `@app.function` デコレータで、ファイル操作を行う関数には必ず `volumes=` パラメータが必要
- 他の関数（`list_files`, `read_file`, `apply_files` 等）は既に volumes が設定されていた
- `generate_game` だけ設定漏れしていた

## 関連

- 同日の「Modal await 不足修正」とは別の問題
- `generate_game` はゲーム生成・バグ修正時に呼ばれる関数
