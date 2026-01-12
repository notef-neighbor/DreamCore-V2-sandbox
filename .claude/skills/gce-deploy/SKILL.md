# GCE Deploy Skill

GameCreatorMVPをGCE (Google Compute Engine) にデプロイするスキル。

## 使用タイミング

ユーザーが以下のような依頼をした時に使用:
- 「GCEにデプロイして」
- 「本番環境を更新して」
- 「サーバーを最新版にして」
- 「デプロイして」

## GCE接続情報

```
Host: 34.84.28.42
User: dreamcorecode
SSH Key: ~/.ssh/google_compute_engine
App Dir: /opt/gamecreator
Process: PM2 (gamecreator)
URL: http://34.84.28.42 または https://dreamcorecode.asia
```

## デプロイコマンド

### 完全なデプロイ手順

```bash
ssh -o BatchMode=yes dreamcorecode@34.84.28.42 -i ~/.ssh/google_compute_engine \
  'cd /opt/gamecreator && sudo git pull origin main && sudo npm install --silent && pm2 restart gamecreator'
```

### ステータス確認

```bash
ssh -o BatchMode=yes dreamcorecode@34.84.28.42 -i ~/.ssh/google_compute_engine \
  'pm2 status gamecreator'
```

### ログ確認

```bash
ssh -o BatchMode=yes dreamcorecode@34.84.28.42 -i ~/.ssh/google_compute_engine \
  'pm2 logs gamecreator --lines 50'
```

## 注意事項

- git pullには`sudo`が必要（/opt/gamecreatorのパーミッション）
- npm installにも`sudo`が必要
- pm2はユーザー権限で実行

## トラブルシューティング

### PM2プロセスが存在しない場合
```bash
ssh dreamcorecode@34.84.28.42 -i ~/.ssh/google_compute_engine \
  'cd /opt/gamecreator && pm2 start server/index.js --name gamecreator && pm2 save'
```

### ログでエラー確認
```bash
ssh dreamcorecode@34.84.28.42 -i ~/.ssh/google_compute_engine \
  'pm2 logs gamecreator --err --lines 100'
```
