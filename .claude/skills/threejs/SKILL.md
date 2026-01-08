---
name: threejs
description: Three.js 3Dゲーム・ビジュアライゼーション生成スキル。CDN + ES Modules形式でのコード生成、最新API (r170+) のベストプラクティス、非推奨APIの回避、物理エンジン(cannon-es/Rapier)連携、モバイルジョイスティック実装に対応。使用タイミング：(1) Three.jsを使った3Dゲームやビジュアライゼーションの生成、(2) 物理エンジンを使った動的なシーン、(3) モバイル対応のゲームコントローラー実装
---

# Three.js Game Generation Skill

DreamCore等のゲーム生成AIがThree.jsコードを生成する際のベストプラクティス。

## 基本セットアップ (CDN + ES Modules)

```html
<script async src="https://unpkg.com/es-module-shims@1.8.0/dist/es-module-shims.js"></script>
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/"
  }
}
</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// シーン初期化
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// アニメーションループ（最新の書き方）
renderer.setAnimationLoop(animate);

function animate() {
  renderer.render(scene, camera);
}
</script>
```

## 重要: 最新APIパターン

### アニメーションループ
```javascript
// ✅ 正しい（r170+）
renderer.setAnimationLoop(animate);

// ❌ 古い（動くが非推奨）
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
```

### カラースペース設定
```javascript
// ✅ 正しい（r152+）
renderer.outputColorSpace = THREE.SRGBColorSpace;
texture.colorSpace = THREE.SRGBColorSpace;

// ❌ 削除済み（エラーになる）
renderer.outputEncoding = THREE.sRGBEncoding;
texture.encoding = THREE.sRGBEncoding;
```

### リサイズ対応
```javascript
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

## よくある間違いと修正

| 間違い | 修正 |
|--------|------|
| `THREE.Geometry` | `THREE.BufferGeometry` (r125で削除) |
| `face.vertexColors` | BufferAttribute使用 |
| `THREE.CapsuleGeometry` | r142以降でのみ使用可 |
| `material.encoding` | `material.colorSpace` |
| `geometry.vertices` | `geometry.attributes.position` |

## 標準的なシーン構成

```javascript
// ライティング
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
scene.add(directionalLight);

// 影の設定
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 地面
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x808080 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
```

## アドオン読み込み

```javascript
// Controls
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Loaders
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Post Processing
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
```

## 参照ドキュメント

特定の機能が必要な場合は以下を参照：

- **物理エンジン (cannon-es)**: [references/cannon-es.md](references/cannon-es.md) - メイン推奨
- **物理エンジン (Rapier)**: [references/rapier.md](references/rapier.md) - 高性能が必要な場合
- **モバイルジョイスティック**: [references/mobile-controls.md](references/mobile-controls.md)
- **非推奨API対応表**: [references/deprecated-apis.md](references/deprecated-apis.md)
