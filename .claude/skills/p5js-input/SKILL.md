---
name: p5js-input
description: P5.js入力処理。キーボード、マウス、タッチ、仮想ボタン。モバイル対応パターン。
---

# P5.js 入力処理

## キーボード（連続移動）

```javascript
p.draw = () => {
  if (p.keyIsDown(p.LEFT_ARROW) || p.keyIsDown(65)) player.x -= 5;   // A
  if (p.keyIsDown(p.RIGHT_ARROW) || p.keyIsDown(68)) player.x += 5;  // D
  if (p.keyIsDown(p.UP_ARROW) || p.keyIsDown(87)) player.y -= 5;     // W
  if (p.keyIsDown(p.DOWN_ARROW) || p.keyIsDown(83)) player.y += 5;   // S
};
```

## キーボード（単発アクション）

```javascript
p.keyPressed = () => {
  if (p.key === ' ') shoot();
  if (p.keyCode === p.ENTER) startGame();
  return false; // デフォルト動作を防ぐ
};
```

---

## モバイル対応: pointerdown/pointerup

**`click`より`pointerdown`が確実。** マウスとタッチ両方に対応。

### 仮想ボタン

```html
<div id="controls">
  <button id="left-btn">◀</button>
  <button id="right-btn">▶</button>
  <button id="fire-btn">FIRE</button>
</div>
```

```javascript
const input = { left: false, right: false, fire: false };

// 左ボタン
document.getElementById('left-btn').addEventListener('pointerdown', () => input.left = true);
document.getElementById('left-btn').addEventListener('pointerup', () => input.left = false);
document.getElementById('left-btn').addEventListener('pointerleave', () => input.left = false);

// 右ボタン
document.getElementById('right-btn').addEventListener('pointerdown', () => input.right = true);
document.getElementById('right-btn').addEventListener('pointerup', () => input.right = false);
document.getElementById('right-btn').addEventListener('pointerleave', () => input.right = false);

// 発射ボタン
document.getElementById('fire-btn').addEventListener('pointerdown', () => input.fire = true);
document.getElementById('fire-btn').addEventListener('pointerup', () => input.fire = false);
```

### draw内で使用

```javascript
p.draw = () => {
  // キーボード or 仮想ボタン
  if (p.keyIsDown(p.LEFT_ARROW) || input.left) player.x -= 5;
  if (p.keyIsDown(p.RIGHT_ARROW) || input.right) player.x += 5;
  if (input.fire) shoot();
};
```

---

## 仮想ボタンCSS

```css
#controls {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 20px;
  z-index: 20;
}

#controls button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  font-size: 24px;
  background: rgba(255,255,255,0.3);
  border: 2px solid white;
  color: white;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}

#controls button:active {
  background: rgba(255,255,255,0.6);
}
```

---

## 左右分割タッチ（シンプル版）

画面左半分タップで左、右半分で右：

```javascript
p.touchStarted = () => {
  if (p.touches.length > 0) {
    const touch = p.touches[0];
    if (touch.x < p.width / 2) {
      input.left = true;
    } else {
      input.right = true;
    }
  }
  return false;
};

p.touchEnded = () => {
  input.left = false;
  input.right = false;
  return false;
};
```

---

## ドラッグ式タッチ操作（推奨）

**絶対座標移動は指で自機が隠れるため、相対移動（ドラッグ）方式を推奨。**

```javascript
// ★重要: タッチ操作の状態管理
let touchState = {
  active: false,
  lastX: 0,
  lastY: 0
};

// ★画面サイズに依存しない感度（どの端末でも同じ操作感）
const sensitivity = () => window.innerWidth / 400;

// ★{ passive: false } でブラウザのスクロールを確実に防止
document.addEventListener('touchstart', (e) => {
  e.preventDefault();
  touchState.active = true;
  touchState.lastX = e.touches[0].clientX;
  touchState.lastY = e.touches[0].clientY;
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  e.preventDefault();  // ★これがないと画面スクロールが優先される
  if (!touchState.active) return;

  const touch = e.touches[0];
  // ★相対移動量（Delta）を計算
  const deltaX = (touch.clientX - touchState.lastX) * sensitivity();
  const deltaY = (touch.clientY - touchState.lastY) * sensitivity();

  player.x += deltaX;
  player.y += deltaY;

  // 画面内に制限
  player.x = Math.max(0, Math.min(player.x, window.innerWidth));
  player.y = Math.max(0, Math.min(player.y, window.innerHeight));

  touchState.lastX = touch.clientX;
  touchState.lastY = touch.clientY;
}, { passive: false });

document.addEventListener('touchend', () => {
  touchState.active = false;
});

document.addEventListener('touchcancel', () => {
  touchState.active = false;
});
```

### なぜドラッグ式か？

| 方式 | 問題点 |
|------|--------|
| 絶対座標移動 | 指で自機が隠れ、敵弾が見えない |
| ドラッグ式 | 画面のどこでも操作可能、自機が見える |

---

## マウス/タッチ位置へ移動（非推奨）

⚠️ **指で自機が隠れるため、シューティングゲームには不向き**

```javascript
p.draw = () => {
  if (p.mouseIsPressed || p.touches.length > 0) {
    const targetX = p.touches.length > 0 ? p.touches[0].x : p.mouseX;
    const targetY = p.touches.length > 0 ? p.touches[0].y : p.mouseY;

    // スムーズに追従
    player.x = p.lerp(player.x, targetX, 0.1);
    player.y = p.lerp(player.y, targetY, 0.1);
  }
};
```

---

## 完全な入力システム例

```javascript
const input = {
  left: false, right: false, up: false, down: false, fire: false
};

// キーボード
document.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') input.up = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') input.down = true;
  if (e.code === 'Space') input.fire = true;
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') input.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') input.down = false;
  if (e.code === 'Space') input.fire = false;
});

// 仮想ボタン（モバイル）
function setupVirtualButton(id, key) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('pointerdown', () => input[key] = true);
  btn.addEventListener('pointerup', () => input[key] = false);
  btn.addEventListener('pointerleave', () => input[key] = false);
}

setupVirtualButton('left-btn', 'left');
setupVirtualButton('right-btn', 'right');
setupVirtualButton('up-btn', 'up');
setupVirtualButton('down-btn', 'down');
setupVirtualButton('fire-btn', 'fire');

// draw内で使用
p.draw = () => {
  if (input.left) player.x -= 5;
  if (input.right) player.x += 5;
  if (input.up) player.y -= 5;
  if (input.down) player.y += 5;

  player.x = p.constrain(player.x, 0, p.width);
  player.y = p.constrain(player.y, 0, p.height);
};
```

---

## スタートボタン/オーバーレイ

```javascript
document.getElementById('start-btn').addEventListener('pointerdown', () => {
  document.getElementById('start-overlay').style.display = 'none';
  gameStarted = true;

  // オーディオ再生（ユーザーインタラクション後）
  if (bgmAudio) bgmAudio.play().catch(() => {});
});
```

---

## 禁止・注意事項

- `click` のみ使用 → モバイルで反応悪い、`pointerdown` を使う
- `touchstart` のみ → `pointerdown` なら両対応
- `return false` 忘れ → 画面スクロールしてしまう
- **`{ passive: false }` なしで `touchmove` を使う** → `preventDefault()` が効かない
- **`e.clientX` をタッチで使う** → タッチは `e.touches[0].clientX` を使う
- **絶対座標移動** → 指で自機が隠れる、ドラッグ式を使う

---

## z-indexレイヤー管理（重要）

**透明な操作エリアがボタンのタッチを吸い取る問題を防ぐ。**

```css
/* ★レイヤー階層を明確に定義 */

/* 背景レイヤー: ドラッグ操作エリア、カメラ操作 */
.drag-zone,
#camera-zone {
  z-index: 5;
  touch-action: none;
}

/* 中間レイヤー: ジョイスティック */
#joystick-zone {
  z-index: 50;
}

/* 前面レイヤー: ボタン類（常に最前面） */
.control-area,
#controls,
.action-btn,
#jump-btn,
#fire-btn {
  z-index: 100;
}

/* UI/HUD: スコア、ライフ表示 */
.hud {
  z-index: 150;
  pointer-events: none;  /* タッチを透過 */
}
```

### よくある問題と解決

| 症状 | 原因 | 解決 |
|------|------|------|
| ボタンが反応しない | 透明エリアがタッチを吸収 | ボタンの `z-index` を上げる |
| ドラッグ中にボタン誤爆 | レイヤー逆転 | ドラッグエリアの `z-index` を下げる |
| HUDがタッチを妨害 | 表示専用なのにイベント発生 | `pointer-events: none` を追加 |

---

## タッチイベントの座標取得

```javascript
// ★マウスとタッチで座標取得方法が異なる
function getEventPosition(e) {
  if (e.touches && e.touches.length > 0) {
    // タッチイベント
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  } else {
    // マウスイベント
    return { x: e.clientX, y: e.clientY };
  }
}
```

---

## 将来の拡張: マルチタッチID管理

移動しながら別のボタンを押す操作には、タッチIDによる追跡が必要：

```javascript
const activeTouches = new Map();

document.addEventListener('touchstart', (e) => {
  for (const touch of e.changedTouches) {
    activeTouches.set(touch.identifier, {
      startX: touch.clientX,
      startY: touch.clientY
    });
  }
}, { passive: false });

document.addEventListener('touchend', (e) => {
  for (const touch of e.changedTouches) {
    activeTouches.delete(touch.identifier);
  }
});
```
