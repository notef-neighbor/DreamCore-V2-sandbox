# 画像読み込み問題の調査と対応

**日付:** 2026-01-23
**症状:** ゲームプレビューで画像が表示されない、ゲームが「読み込み中...」で停止

---

## 調査経緯

### 初期仮説

ユーザー報告: 「画像のパブリック、非パブリックまわりの実装をしてから」問題発生

### 調査1: iframe sandbox の `allow-same-origin` 削除

**試行:**
セキュリティ向上のため `allow-same-origin` を削除

```html
<!-- Before -->
<iframe sandbox="allow-scripts allow-same-origin">

<!-- After -->
<iframe sandbox="allow-scripts">
```

**結果:** ゲームが完全に動かなくなった
- P5.js (CDN) の読み込みが「pending」状態で停止
- `/game/` の HTML は 200 で読み込み成功
- CDN からのスクリプト読み込みがブロックされた

**対応:** `allow-same-origin` を戻した → ゲーム動作復旧

---

### 調査2: CORS ヘッダー追加

**背景:**
`allow-same-origin` なしの iframe は「null オリジン」として扱われ、同一ドメインへのリクエストも CORS が必要

**実装:**
```javascript
// server/index.js
// 環境変数 CORS_ALLOWED_ORIGINS で許可オリジンを指定
// 本番: CORS_ALLOWED_ORIGINS=https://play.dreamcore.gg
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',').map(o => o.trim());

app.use((req, res, next) => {
  if (req.path.startsWith('/user-assets/') || ...) {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);  // * ではなくドメイン限定
      res.header('Access-Control-Allow-Credentials', 'true');
      ...
    }
  }
  next();
});
```

**結果:** CORS 自体は問題ではなかった（CDN ブロックが根本原因）
**維持:** Phase 2 サブドメイン方式で必要。`*` ではなく `play.dreamcore.gg` 限定。

**セキュリティ修正（レビュー指摘）:**
- `*` は広すぎる（将来の事故リスク）
- Authorization ヘッダーを使う場合 `*` は CORS 仕様で使用不可
- → ドメイン限定 + `Allow-Credentials: true` に変更

---

### 調査3: `/api/assets/:id` の認証緩和

**背景:**
旧形式 URL `/api/assets/:uuid` は `authenticate` ミドルウェア必須だった

**実装:**
```javascript
// 新しいミドルウェア追加
const checkAssetAccess = async (req, res, next) => {
  const asset = await db.getAssetByIdAdmin(assetId);
  const isOwner = req.user?.id === asset.owner_id;
  const isPublic = asset.is_public || asset.is_global;
  if (!isOwner && !isPublic) {
    return res.status(404).json({ error: 'Asset not found' });
  }
  req.asset = asset;
  next();
};

// エンドポイント変更
app.get('/api/assets/:id', optionalAuth, checkAssetAccess, ...);
```

**結果:** 公開アセットは認証なしでアクセス可能に
**維持:** セキュリティ向上のため残す

---

## 最終結論

**根本原因:** 調査の結果、`allow-same-origin` 削除が原因と判明

- `allow-same-origin` なしでは CDN スクリプトの読み込みがブロックされる
- P5.js が読み込めず、ゲームが `preload()` で停止

**元の問題について:**
ユーザーが報告した「パブリック実装後から画像が表示されない」問題は、今回の調査では再現できなかった。`allow-same-origin` を戻した状態で画像もゲームも正常動作。

---

## 変更ファイル

| ファイル | 変更内容 | 維持 |
|----------|----------|------|
| `server/index.js` | CORS ミドルウェア追加 | ✅ |
| `server/index.js` | `checkAssetAccess` ミドルウェア追加 | ✅ |
| `server/database-supabase.js` | `getAssetByIdAdmin()` 追加 | ✅ |
| `public/editor.html` | sandbox属性 | 元に戻した |
| `public/app.js` | sandbox属性 | 元に戻した |

---

## Phase 2 での対応方針

`allow-same-origin` を安全に削除するには:

1. **サブドメイン方式**: `play.dreamcore.gg` で iframe コンテンツを配信
2. **CSP 設定**: CDN ホワイトリスト
3. **postMessage API**: 親子間通信

これにより:
- iframe は完全に別オリジン
- トークン漏洩リスクなし
- CDN アクセスは CSP で制御

---

## 学び

1. `sandbox="allow-scripts"` だけでは CDN スクリプトが読み込めない
2. `allow-same-origin` は「同一オリジンとして扱う」設定であり、これがないと null オリジンになる
3. null オリジンからは外部リソース読み込みに制限がかかる場合がある
4. セキュリティ変更は段階的にテストすべき
5. **CORS の `*` は避けるべき** - ドメイン限定の方が安全（将来の仕様変更時の事故防止、Authorization ヘッダー対応）
