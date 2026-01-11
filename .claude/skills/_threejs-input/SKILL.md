---
name: threejs-input
description: Three.js入力処理。モバイルジョイスティック、アクションボタン、タッチ操作。3Dゲーム用。
---

# Three.js 入力処理（モバイル対応）

## 仮想ジョイスティック

**外部ライブラリ不要** - カスタム実装で軽量・確実に動作。

```html
<div id="joystick-zone" style="
  position: fixed;
  bottom: calc(30px + env(safe-area-inset-bottom));
  left: 20px;
  width: 120px;
  height: 120px;
  z-index: 50;
  touch-action: none;
"></div>
```

```javascript
class VirtualJoystick {
  constructor(container, options = {}) {
    this.container = container;
    this.radius = options.radius || 50;
    this.innerRadius = options.innerRadius || 25;
    this.color = options.color || 'rgba(255,255,255,0.5)';
    this.active = false;
    this.vector = { x: 0, y: 0 };
    this.startPos = { x: 0, y: 0 };
    this.createElements();
    this.bindEvents();
  }

  createElements() {
    // ベース: transform で中央配置
    this.base = document.createElement('div');
    this.base.style.cssText = `
      position: absolute;
      width: ${this.radius * 2}px;
      height: ${this.radius * 2}px;
      background: rgba(255,255,255,0.2);
      border: 3px solid ${this.color};
      border-radius: 50%;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
    `;

    // スティック: margin で中央配置（transform は JS アニメーション用）
    this.stick = document.createElement('div');
    this.stick.style.cssText = `
      position: absolute;
      width: ${this.innerRadius * 2}px;
      height: ${this.innerRadius * 2}px;
      background: ${this.color};
      border-radius: 50%;
      left: 50%;
      top: 50%;
      margin-left: -${this.innerRadius}px;
      margin-top: -${this.innerRadius}px;
    `;

    this.base.appendChild(this.stick);
    this.container.appendChild(this.base);
  }

  bindEvents() {
    this.container.addEventListener('touchstart', (e) => this.onStart(e), { passive: false });
    this.container.addEventListener('touchmove', (e) => this.onMove(e), { passive: false });
    this.container.addEventListener('touchend', () => this.onEnd());
    this.container.addEventListener('touchcancel', () => this.onEnd());

    // PC デバッグ用
    this.container.addEventListener('mousedown', (e) => this.onMouseStart(e));
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mouseup', () => this.onMouseEnd());
  }

  onStart(e) {
    e.preventDefault();
    this.active = true;
    const rect = this.base.getBoundingClientRect();
    this.startPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  onMove(e) {
    if (!this.active) return;
    e.preventDefault();
    this.updatePosition(e.touches[0].clientX, e.touches[0].clientY);
  }

  onEnd() {
    this.active = false;
    this.stick.style.transform = 'translate(0px, 0px)';
    this.vector = { x: 0, y: 0 };
  }

  onMouseStart(e) {
    this.active = true;
    const rect = this.base.getBoundingClientRect();
    this.startPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  onMouseMove(e) {
    if (!this.active) return;
    this.updatePosition(e.clientX, e.clientY);
  }

  onMouseEnd() {
    if (!this.active) return;
    this.onEnd();
  }

  updatePosition(clientX, clientY) {
    const dx = clientX - this.startPos.x;
    const dy = clientY - this.startPos.y;
    const maxDistance = this.radius - this.innerRadius;
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);
    const angle = Math.atan2(dy, dx);

    const clampedX = Math.cos(angle) * distance;
    const clampedY = Math.sin(angle) * distance;

    this.stick.style.transform = `translate(${clampedX}px, ${clampedY}px)`;

    // ★Y軸反転: 上に倒す → プラス値 → 前進
    this.vector = {
      x: clampedX / maxDistance,
      y: -clampedY / maxDistance
    };
  }

  getVector() {
    return this.vector;
  }
}
```

---

## 使用例

```javascript
const joystick = new VirtualJoystick(document.getElementById('joystick-zone'));

function animate() {
  const input = joystick.getVector();
  const speed = 0.1;

  player.position.x += input.x * speed;
  player.position.z -= input.y * speed;

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
```

---

## デュアルジョイスティック（移動 + 視点）

```html
<div id="joystick-move" style="position:fixed; bottom:30px; left:20px; width:120px; height:120px; z-index:50; touch-action:none;"></div>
<div id="joystick-look" style="position:fixed; bottom:30px; right:20px; width:120px; height:120px; z-index:50; touch-action:none;"></div>
```

```javascript
const moveJoystick = new VirtualJoystick(document.getElementById('joystick-move'));
const lookJoystick = new VirtualJoystick(document.getElementById('joystick-look'));

let cameraPitch = 0;

function animate() {
  const move = moveJoystick.getVector();
  const look = lookJoystick.getVector();

  // 移動
  player.position.x += move.x * 0.1;
  player.position.z -= move.y * 0.1;

  // 視点回転（ヨー: 左右）
  camera.rotation.y -= look.x * 0.02;

  // 視点回転（ピッチ: 上下）
  // ★ジョイスティックのY軸は反転済み → -= で正しい方向に
  cameraPitch -= look.y * 0.02;
  cameraPitch = Math.max(-Math.PI/4, Math.min(Math.PI/4, cameraPitch));
  camera.rotation.x = cameraPitch;
}
```

---

## アクションボタン

```html
<button id="action-btn" style="
  position: fixed;
  bottom: calc(40px + env(safe-area-inset-bottom));
  right: 20px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(145deg, #ff6b6b, #ee5a5a);
  border: 3px solid white;
  color: white;
  font-size: 14px;
  font-weight: bold;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  z-index: 100;
">JUMP</button>
```

```javascript
let isActionPressed = false;
const actionBtn = document.getElementById('action-btn');

actionBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  isActionPressed = true;
  actionBtn.style.transform = 'scale(0.9)';
  performAction();
});

actionBtn.addEventListener('touchend', () => {
  isActionPressed = false;
  actionBtn.style.transform = 'scale(1)';
});

actionBtn.addEventListener('click', (e) => {
  e.preventDefault();
  performAction();
});

function performAction() {
  // ジャンプ、攻撃など
}
```

---

## z-index レイヤー管理（重要）

```css
/* 背景: カメラドラッグエリア */
#camera-zone { z-index: 5; }

/* 中間: ジョイスティック */
#joystick-zone, #joystick-move, #joystick-look { z-index: 50; }

/* 前面: アクションボタン */
#action-btn, #jump-btn { z-index: 100; }

/* HUD（タッチ透過） */
.hud { z-index: 150; pointer-events: none; }
```

| z-index | 用途 | 例 |
|---------|------|-----|
| 5 | 背景操作 | カメラドラッグ |
| 50 | ジョイスティック | 移動、視点 |
| 100 | ボタン | ジャンプ、攻撃 |
| 150 | HUD | スコア、ライフ |

---

## ドラッグ式タッチ移動

```javascript
const touchState = { active: false, lastX: 0, lastY: 0 };
const sensitivity = () => window.innerWidth / 400;

document.addEventListener('touchstart', (e) => {
  e.preventDefault();
  touchState.active = true;
  touchState.lastX = e.touches[0].clientX;
  touchState.lastY = e.touches[0].clientY;
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!touchState.active) return;

  const touch = e.touches[0];
  const deltaX = (touch.clientX - touchState.lastX) * sensitivity();
  const deltaY = (touch.clientY - touchState.lastY) * sensitivity();

  player.position.x += deltaX * 0.01;
  player.position.z += deltaY * 0.01;

  touchState.lastX = touch.clientX;
  touchState.lastY = touch.clientY;
}, { passive: false });

document.addEventListener('touchend', () => { touchState.active = false; });
```

---

## カメラピッチ方向

```
Three.js右手座標系:
- X軸正回転 → 下を向く
- X軸負回転 → 上を向く
```

```javascript
// ドラッグでカメラ操作
let cameraPitch = 0;

document.addEventListener('touchmove', (e) => {
  const deltaY = touch.clientY - touchState.lastY;

  // ★ += で正しい方向（上スワイプ=上を向く）
  cameraPitch += deltaY * 0.005;
  cameraPitch = Math.max(-Math.PI/3, Math.min(Math.PI/3, cameraPitch));

  camera.rotation.order = 'YXZ';
  camera.rotation.x = cameraPitch;
}, { passive: false });
```

---

## 必須事項

| 項目 | 理由 |
|------|------|
| `{ passive: false }` | `preventDefault()` を有効に |
| `e.preventDefault()` | ブラウザスクロール防止 |
| `e.touches[0].clientX` | タッチ座標取得 |
| 相対移動（Delta） | 指で対象が隠れない |
| Y軸反転 | ジョイスティック上=前進 |

---

## モバイル判定

```javascript
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

if (isMobile) {
  document.getElementById('joystick-zone').style.display = 'block';
  document.getElementById('action-btn').style.display = 'block';
}
```

---

## CSS 基本設定

```css
#joystick-zone, #joystick-move, #joystick-look {
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

html, body {
  overflow: hidden;
  touch-action: none;
  overscroll-behavior: none;
}

body {
  position: fixed;
  width: 100%;
  height: 100%;
}
```
