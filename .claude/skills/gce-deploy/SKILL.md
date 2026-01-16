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
Instance: dreamcorecode
Zone: asia-northeast1-b
App Dir: /opt/gamecreator
Process: PM2 (gamecreator) - runs as user dreamcorecode
URL: http://34.84.28.42
```

## デプロイ手順

### gcloudでデプロイ（推奨）

```bash
/usr/local/bin/gcloud compute ssh dreamcorecode@dreamcorecode --zone=asia-northeast1-b --command="cd /opt/gamecreator && sudo git stash && sudo git fetch origin && sudo git checkout main && sudo git pull origin main && sudo npm install --silent && pm2 restart gamecreator && pm2 status gamecreator"
```

### ステータス確認

```bash
/usr/local/bin/gcloud compute ssh dreamcorecode@dreamcorecode --zone=asia-northeast1-b --command="pm2 status gamecreator"
```

### ログ確認

```bash
/usr/local/bin/gcloud compute ssh dreamcorecode@dreamcorecode --zone=asia-northeast1-b --command="pm2 logs gamecreator --lines 50 --nostream"
```

## 注意事項

- git操作には`sudo`が必要（/opt/gamecreatorのパーミッション）
- npm installにも`sudo`が必要
- PM2は`dreamcorecode`ユーザーで実行されている
- サーバーにローカル変更がある場合は `sudo git stash` で退避

## トラブルシューティング

### gcloud認証が切れた場合
```bash
/usr/local/bin/gcloud auth login --launch-browser
```

### PM2プロセスが存在しない場合
```bash
/usr/local/bin/gcloud compute ssh dreamcorecode@dreamcorecode --zone=asia-northeast1-b --command="cd /opt/gamecreator && pm2 start server/index.js --name gamecreator && pm2 save"
```
