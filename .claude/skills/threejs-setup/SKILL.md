---
name: threejs-setup
description: Three.js基本セットアップ。CDN + ES Modules、シーン初期化、レンダラー設定、アニメーションループ。3Dゲーム作成時に必須。
---

# Three.js 基本セットアップ

## 重要: Canvas事前配置パターン（推奨）

JavaScriptエラーで画面が真っ白になる問題を防ぐため、**HTMLにCanvas要素を事前配置**する。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Game</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #000; }
    #gameCanvas { display: block; width: 100%; height: 100vh; }
    #loading { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: #1a1a2e; color: #fff; font-family: sans-serif; z-index: 9999; }
    #loading.hidden { display: none; }
    #error { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; background: #2d1b1b; color: #ff6b6b; font-family: sans-serif; z-index: 9999; padding: 20px; text-align: center; }
  </style>
</head>
<body>
  <!-- Canvas事前配置（JSエラーでも要素は存在） -->
  <canvas id="gameCanvas"></canvas>

  <!-- ローディング表示 -->
  <div id="loading">Loading...</div>

  <!-- エラー表示 -->
  <div id="error"></div>

  <!-- UI要素はここに配置 -->

  <!-- CDN: jsdelivrを優先（unpkgより安定） -->
  <script async src="https://cdn.jsdelivr.net/npm/es-module-shims@1.8.0/dist/es-module-shims.min.js"></script>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
    }
  }
  </script>
  <script type="module">
  // グローバルエラーハンドリング
  window.onerror = (msg, url, line) => {
    document.getElementById('loading').classList.add('hidden');
    const errorDiv = document.getElementById('error');
    errorDiv.style.display = 'flex';
    errorDiv.textContent = `エラー: ${msg}`;
  };

  try {
    const { Scene, PerspectiveCamera, WebGLRenderer } = await import('three');

    // 事前配置されたCanvasを取得
    const canvas = document.getElementById('gameCanvas');

    const scene = new Scene();
    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new WebGLRenderer({ canvas, antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ローディング完了
    document.getElementById('loading').classList.add('hidden');

    // アニメーションループ
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });

    // リサイズ対応
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

  } catch (e) {
    document.getElementById('loading').classList.add('hidden');
    const errorDiv = document.getElementById('error');
    errorDiv.style.display = 'flex';
    errorDiv.textContent = `読み込みエラー: ${e.message}`;
    console.error(e);
  }
  </script>
</body>
</html>
```

## ポイント

1. **Canvas事前配置**: `<canvas id="gameCanvas">` をHTMLに記述
2. **WebGLRenderer({ canvas })**: 既存Canvasを渡す
3. **ローディング/エラー表示**: ユーザーに状態を伝える
4. **try-catch**: モジュール読み込みエラーをキャッチ
5. **jsdelivr CDN**: unpkgより接続安定性が高い

## 最小パターン（シンプル版）

```html
<canvas id="gameCanvas"></canvas>
<script type="importmap">
{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}
</script>
<script type="module">
import * as THREE from 'three';
const canvas = document.getElementById('gameCanvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setAnimationLoop(() => renderer.render(scene, camera));
</script>
```

## ジョイスティックが動かない問題（頻発・重要）

### 事象
ジョイスティックを操作しても反応せず、代わりにカメラが回転する、または無反応になる。

### 原因
**透明な全画面レイヤーによるイベント遮断**。カメラ操作用の透明要素（#camera-zone）がジョイスティックより手前にあり、タッチがカメラ層に吸収される。

### 解決策：z-indexによる操作優先度の明確化

```css
/* z-index: 100 [最優先] - ボタン類 */
#jump-btn, #retry-btn, .action-btn {
  z-index: 100;
  pointer-events: auto;
}

/* z-index: 50 [優先] - ジョイスティック */
#joystick-zone {
  z-index: 50;
  touch-action: none;
  pointer-events: auto;
}

/* z-index: 5 [背景操作] - カメラ領域（ジョイスティックの下に潜る） */
#camera-zone {
  z-index: 5;
  touch-action: none;
}

/* z-index: 1 [描画層] - Canvas */
#gameCanvas { z-index: 1; }

/* UIコンテナ：隙間のタッチ遮断を防ぐ */
#ui-layer { pointer-events: none; }
#ui-layer > * { pointer-events: auto; }
```

| z-index | 用途 | pointer-events |
|---------|------|----------------|
| 100 | ボタン | auto |
| 50 | ジョイスティック | auto |
| 5 | カメラ操作 | auto |
| 1 | Canvas | - |

**ポイント**: カメラ領域（z-index:5）がジョイスティック（z-index:50）より下になるため、ジョイスティック内のタッチは確実にジョイスティックが受け取る。

## ジョイスティックY軸の方向（重要）

ブラウザ座標系とゲーム座標系の違いを理解する。

```
ブラウザ座標: 上スワイプ → deltaY < 0（画面上方向がY小）
ゲーム期待値: 上に倒す → 前進 → 正の値が欲しい
```

**ジョイスティック実装時は必ずY軸を反転：**

```javascript
// ジョイスティックの値を計算
this.vector = {
  x: clampedX / maxDistance,
  y: -clampedY / maxDistance  // ★Y軸反転: 上に倒す → プラス値 → 前進
};
```

## カメラピッチ方向（重要）

Three.js右手座標系でのカメラ回転：

```
X軸正回転 → カメラが下を向く
X軸負回転 → カメラが上を向く
```

**ドラッグでカメラ操作する場合：**

```javascript
let cameraPitch = 0;

document.addEventListener('touchmove', (e) => {
  const deltaY = touch.clientY - lastY;

  // ★ += で正しい方向（上スワイプ=上を向く）
  cameraPitch += deltaY * 0.005;
  cameraPitch = Math.max(-Math.PI/3, Math.min(Math.PI/3, cameraPitch));

  camera.rotation.order = 'YXZ';  // ジンバルロック防止
  camera.rotation.x = cameraPitch;
}, { passive: false });
```

**ジョイスティックでカメラ操作する場合：**

```javascript
// ジョイスティックのY軸は既に反転済み（上=正）
// Three.jsでX軸正回転=下を向く
// したがって -= で反転させる
cameraPitch -= look.y * 0.02;
```

| 操作方法 | 計算式 | 理由 |
|----------|--------|------|
| ドラッグ | `pitch += deltaY` | deltaYは生の値 |
| ジョイスティック | `pitch -= look.y` | look.yは既に反転済み |

## 非推奨API（エラーになる）

```javascript
// ❌ 古い・削除済み
document.body.appendChild(renderer.domElement); // Canvas動的追加は避ける
requestAnimationFrame(animate); // setAnimationLoopを使う
renderer.outputEncoding = THREE.sRGBEncoding; // 削除済み

// ✅ 正しい
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas') });
renderer.setAnimationLoop(animate);
renderer.outputColorSpace = THREE.SRGBColorSpace;
```

## 移動スタック問題（3Dゲーム頻発）

### 事象
平らな地面で見えない壁に引っかかり、移動が止まる。

### 原因
当たり判定の過敏反応。足元の地面との「接触」を「壁への衝突」と誤判定。

### 解決策：水平移動時の判定緩和

```javascript
function checkCollision(player, direction, obstacles) {
  const box = new THREE.Box3().setFromObject(player);

  // 水平移動時は足元・頭上を判定から除外
  if (direction.y === 0) {
    box.min.y += 0.1;  // 足元を少し上げる
    box.max.y -= 0.1;  // 頭上を少し下げる
  }

  for (const obs of obstacles) {
    if (box.intersectsBox(new THREE.Box3().setFromObject(obs))) {
      return true;  // 衝突
    }
  }
  return false;
}
```

**ポイント**: 水平移動時だけ判定ボックスを縮小し、地面との摩擦を無視して純粋な「壁」だけを検知。

## キャラクターが地面に埋まる問題（3Dゲーム頻発）

### 事象
キャラクターの足が地面に埋没して表示される。

### 原因
3Dモデルの原点（中心点）と配置座標のズレ。BoxGeometryは中心が原点のため、Y=0に配置すると下半分が地面に埋まる。

### 解決策：ジオメトリの底面合わせ

```javascript
// ❌ 中心基準（足が埋まる）
foot.position.y = 0;

// ✅ 底面基準（足裏が地面に接地）
const footHeight = 0.8;
foot.position.y = footHeight / 2;  // 高さの半分だけ上にずらす
```

**全身の配置例：**
```javascript
const footH = 0.8, torsoH = 1.2, headH = 0.6;

// 足: 底面がY=0
foot.position.y = footH / 2;  // 0.4

// 胴体: 足の上
torso.position.y = footH + torsoH / 2;  // 1.4

// 頭: 胴体の上
head.position.y = footH + torsoH + headH / 2;  // 2.3
```

**ポイント**: 各パーツの `position.y = 下のパーツまでの高さ + 自身の高さ/2`
