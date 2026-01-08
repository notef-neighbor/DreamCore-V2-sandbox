# モバイルジョイスティック (nipplejs)

モバイルゲーム向けバーチャルジョイスティック実装ガイド。

## CDN読み込み

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/",
    "nipplejs": "https://unpkg.com/nipplejs@0.10.2/dist/nipplejs.min.js"
  }
}
</script>
```

## 基本実装

```html
<!-- ジョイスティック配置用DOM -->
<div id="joystick-zone" style="
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 120px;
  height: 120px;
  z-index: 100;
"></div>

<script type="module">
import * as THREE from 'three';
import nipplejs from 'nipplejs';

// ジョイスティック入力値
let moveX = 0;
let moveY = 0;

// ジョイスティック作成
const joystick = nipplejs.create({
  zone: document.getElementById('joystick-zone'),
  mode: 'static',
  position: { left: '60px', bottom: '60px' },
  color: 'white',
  size: 100
});

// 入力イベント
joystick.on('move', (evt, data) => {
  if (data.vector) {
    moveX = data.vector.x;  // -1 ~ 1
    moveY = data.vector.y;  // -1 ~ 1
  }
});

joystick.on('end', () => {
  moveX = 0;
  moveY = 0;
});

// Three.jsでの移動適用
function animate() {
  // カメラ方向を考慮した移動
  const speed = 0.1;
  player.position.x += moveX * speed;
  player.position.z -= moveY * speed; // Yは前後方向
  
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
</script>
```

## オプション設定

```javascript
const joystick = nipplejs.create({
  zone: document.getElementById('joystick-zone'),
  
  // モード
  mode: 'static',      // 固定位置
  // mode: 'dynamic',  // タッチ位置に出現
  // mode: 'semi',     // 一定範囲内で再利用
  
  // 見た目
  color: 'white',
  size: 100,
  
  // 位置（staticモード時）
  position: { left: '60px', bottom: '60px' },
  
  // 挙動
  threshold: 0.1,       // 入力検知しきい値
  fadeTime: 250,        // フェードアニメーション時間
  restJoystick: true,   // 離したとき中央に戻す
  restOpacity: 0.5,     // 非操作時の透明度
  
  // 軸制限
  lockX: false,         // X軸のみ
  lockY: false          // Y軸のみ
});
```

## イベント一覧

```javascript
joystick.on('start', (evt, data) => {
  console.log('タッチ開始');
});

joystick.on('move', (evt, data) => {
  // data.vector: {x, y} 正規化された方向 (-1~1)
  // data.angle: { degree, radian } 角度
  // data.distance: 中心からの距離
  // data.force: 強さ (0~1)
  console.log('移動中', data.vector, data.force);
});

joystick.on('end', (evt, data) => {
  console.log('タッチ終了');
});

joystick.on('dir:up', () => console.log('上方向'));
joystick.on('dir:down', () => console.log('下方向'));
joystick.on('dir:left', () => console.log('左方向'));
joystick.on('dir:right', () => console.log('右方向'));
```

## カメラ方向を考慮した移動

```javascript
let moveX = 0;
let moveY = 0;
const moveDirection = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();

joystick.on('move', (evt, data) => {
  moveX = data.vector.x;
  moveY = data.vector.y;
});

joystick.on('end', () => {
  moveX = 0;
  moveY = 0;
});

function animate() {
  // カメラの前方向を取得
  camera.getWorldDirection(cameraDirection);
  cameraDirection.y = 0;
  cameraDirection.normalize();
  
  // 右方向
  const rightDirection = new THREE.Vector3();
  rightDirection.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
  
  // 移動ベクトル計算
  moveDirection.set(0, 0, 0);
  moveDirection.addScaledVector(rightDirection, moveX);
  moveDirection.addScaledVector(cameraDirection, moveY);
  
  // プレイヤー移動
  const speed = 0.1;
  player.position.add(moveDirection.multiplyScalar(speed));
  
  renderer.render(scene, camera);
}
```

## デュアルジョイスティック（移動 + 視点）

```html
<div id="joystick-move" style="position:fixed; bottom:20px; left:20px; width:120px; height:120px;"></div>
<div id="joystick-look" style="position:fixed; bottom:20px; right:20px; width:120px; height:120px;"></div>

<script type="module">
import nipplejs from 'nipplejs';

let moveX = 0, moveY = 0;
let lookX = 0, lookY = 0;

// 移動用ジョイスティック
const moveJoystick = nipplejs.create({
  zone: document.getElementById('joystick-move'),
  mode: 'static',
  position: { left: '60px', bottom: '60px' },
  color: 'blue'
});

moveJoystick.on('move', (e, d) => { moveX = d.vector.x; moveY = d.vector.y; });
moveJoystick.on('end', () => { moveX = 0; moveY = 0; });

// 視点用ジョイスティック
const lookJoystick = nipplejs.create({
  zone: document.getElementById('joystick-look'),
  mode: 'static',
  position: { right: '60px', bottom: '60px' },
  color: 'red'
});

lookJoystick.on('move', (e, d) => { lookX = d.vector.x; lookY = d.vector.y; });
lookJoystick.on('end', () => { lookX = 0; lookY = 0; });

// アニメーションループ
function animate() {
  // 移動
  player.position.x += moveX * 0.1;
  player.position.z -= moveY * 0.1;
  
  // 視点回転
  camera.rotation.y -= lookX * 0.02;
  camera.rotation.x = Math.max(-Math.PI/4, Math.min(Math.PI/4, camera.rotation.x - lookY * 0.02));
  
  renderer.render(scene, camera);
}
</script>
```

## タッチ操作との競合回避

```css
/* ジョイスティック領域でのデフォルト動作を無効化 */
#joystick-zone {
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

/* ページ全体のスクロール防止（ゲーム用） */
body {
  overflow: hidden;
  touch-action: none;
}
```

## ジャンプボタン追加

```html
<button id="jump-btn" style="
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255,255,255,0.3);
  border: 2px solid white;
  color: white;
  font-size: 16px;
  touch-action: manipulation;
">JUMP</button>

<script type="module">
let isJumping = false;

document.getElementById('jump-btn').addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!isJumping) {
    isJumping = true;
    playerBody.applyImpulse(new CANNON.Vec3(0, 10, 0)); // 物理エンジン使用時
  }
});
</script>
```

## モバイル判定

```javascript
const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
  // ジョイスティック表示
  document.getElementById('joystick-zone').style.display = 'block';
} else {
  // PC: キーボード操作
  document.getElementById('joystick-zone').style.display = 'none';
}
```
