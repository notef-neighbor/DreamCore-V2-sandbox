# iframe セキュリティ設定

公開ゲームの iframe サンドボックス設定について。

## 概要

DreamCore では UGC（ユーザー生成コンテンツ）としてブラウザゲームを公開できる。悪意あるコードからユーザーを保護するため、itch.io と同等のセキュリティモデルを採用。

## アーキテクチャ

```
v2.dreamcore.gg（メインサイト）
├── 認証情報（Cookie, localStorage）
├── ユーザーデータ
└── /game/:gameId ページ
        │
        └── iframe（サンドボックス化）
                │
                └── play.dreamcore.gg/g/:gameId/index.html
                    └── ゲーム本体（JavaScript）
```

**ポイント:** ゲームは別オリジン（play.dreamcore.gg）で実行されるため、メインサイトの認証情報にアクセスできない。

---

## iframe 設定

### 現在の設定

```html
<iframe
  sandbox="allow-scripts allow-pointer-lock allow-popups allow-orientation-lock allow-forms"
  allow="fullscreen; accelerometer; gyroscope; gamepad; camera; microphone; autoplay"
>
```

---

## sandbox 属性

iframe の動作を制限する属性。

### 許可している機能

| 属性 | 説明 | 用途 |
|------|------|------|
| `allow-scripts` | JavaScript 実行 | ゲームに必須 |
| `allow-pointer-lock` | Pointer Lock API | FPS、マウス操作ゲーム |
| `allow-popups` | window.open() | 外部リンク、シェア |
| `allow-orientation-lock` | 画面回転ロック | モバイルゲーム |
| `allow-forms` | フォーム送信 | ゲーム内フォーム |

### 禁止している機能

| 属性 | 説明 | 禁止理由 |
|------|------|----------|
| `allow-modals` | alert/confirm/prompt | 無限ダイアログ攻撃防止 |
| `allow-same-origin` | 同一オリジン扱い | **絶対禁止** - 認証情報窃取を防止 |
| `allow-top-navigation` | 親ページ遷移 | フィッシング防止 |
| `allow-downloads` | ダウンロード | マルウェア配布防止 |

### allow-same-origin が絶対禁止の理由

これを許可すると iframe 内のコードが親オリジンのリソースにアクセス可能になる:

```javascript
// allow-same-origin があると可能になる危険なコード
document.cookie                    // Cookie 読み取り
localStorage.getItem('auth_token') // 認証トークン窃取
fetch('/api/user/delete', {        // 認証済みリクエスト
  credentials: 'include'
});
```

---

## allow 属性（Permissions Policy）

ブラウザ機能へのアクセスを制御。

### 許可している機能

| 機能 | 説明 | 用途 |
|------|------|------|
| `fullscreen` | フルスクリーン | 没入感のあるゲーム |
| `accelerometer` | 加速度センサー | 傾き操作 |
| `gyroscope` | ジャイロスコープ | 傾き操作 |
| `gamepad` | ゲームパッド API | コントローラー対応 |
| `camera` | カメラ | AR ゲーム等（ユーザー許可必要） |
| `microphone` | マイク | 音声入力ゲーム（ユーザー許可必要） |
| `autoplay` | 自動再生 | BGM |

### 禁止している機能

| 機能 | 禁止理由 |
|------|----------|
| `geolocation` | プライバシーリスク（将来検討） |
| `payment` | 決済は不要 |
| `usb`, `serial`, `midi` | ハードウェアアクセスは不要 |

---

## CSP（Content-Security-Policy）

### frame-ancestors

ゲームファイル配信時のレスポンスヘッダー:

```
Content-Security-Policy: frame-ancestors 'self' https://v2.dreamcore.gg
```

- `'self'`: play.dreamcore.gg 自身からの埋め込み許可
- `https://v2.dreamcore.gg`: メインサイトからの埋め込み許可
- 他サイトからの埋め込みは拒否

---

## よくある質問

### Q: ゲーム内のポップアップ UI は使える？

**A:** はい。HTML/CSS で作るポップアップ（リザルト画面等）は `allow-modals` とは無関係。

```html
<!-- これは問題なく動作する -->
<div class="popup">
  <h1>Game Over</h1>
  <button>Retry</button>
</div>
```

`allow-modals` が制御するのは `alert()`, `confirm()`, `prompt()` のみ。

### Q: 外部 CDN からライブラリを読み込める？

**A:** はい。`allow-downloads` はファイルの**ダウンロード保存**のみを制御。

```html
<!-- これは問題なく動作する -->
<script src="https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js"></script>
<img src="https://example.com/sprite.png">
```

### Q: カメラを使うゲームは作れる？

**A:** はい。`allow="camera"` が設定されているため、ブラウザのカメラ許可プロンプトが表示される。ユーザーが許可すればカメラにアクセス可能。

### Q: ゲームデータのセーブは？

**A:** iframe 内の localStorage は使用可能。ただし sandbox により「ユニークオリジン」扱いになるため、同じゲームでもセッションごとにリセットされる可能性がある。永続化が必要な場合は外部 API を使用。

---

## 将来の検討事項

- [ ] `geolocation` の許可（位置情報ゲーム対応）
- [ ] ゲームごとの権限設定 UI
- [ ] Storage Access API 対応（永続化改善）

---

## 参考リンク

- [MDN: iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox)
- [MDN: Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Permissions_Policy)
- [itch.io Security](https://itch.io/docs/creators/html5)
