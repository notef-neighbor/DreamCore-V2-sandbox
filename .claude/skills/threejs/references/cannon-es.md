# cannon-es 物理エンジン連携

Three.jsとcannon-esを連携させる際のベストプラクティス。

## CDN読み込み

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/",
    "cannon-es": "https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js"
  }
}
</script>
```

## 基本セットアップ

```javascript
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// 物理ワールド初期化
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0)
});

// ソルバー設定（パフォーマンス調整）
world.solver.iterations = 10;
world.broadphase = new CANNON.NaiveBroadphase();
```

## 基本パターン: メッシュと物理ボディの同期

```javascript
// Three.jsメッシュ作成
const sphereGeometry = new THREE.SphereGeometry(1);
const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(sphereMesh);

// 対応する物理ボディ作成
const sphereBody = new CANNON.Body({
  mass: 5,
  shape: new CANNON.Sphere(1),
  position: new CANNON.Vec3(0, 10, 0)
});
world.addBody(sphereBody);

// アニメーションループで同期
function animate() {
  // 物理シミュレーション更新
  world.fixedStep(); // デフォルト: 1/60秒

  // 物理→Three.js同期
  sphereMesh.position.copy(sphereBody.position);
  sphereMesh.quaternion.copy(sphereBody.quaternion);

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
```

## 形状タイプ

```javascript
// 球
new CANNON.Sphere(radius)

// ボックス（半径で指定）
new CANNON.Box(new CANNON.Vec3(halfWidth, halfHeight, halfDepth))

// 平面（無限平面）
new CANNON.Plane()

// シリンダー
new CANNON.Cylinder(radiusTop, radiusBottom, height, numSegments)

// 凸包（複雑な形状）
new CANNON.ConvexPolyhedron({ vertices, faces })
```

## 地面の作成

```javascript
// 静的な地面
const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane()
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // 上向きに
world.addBody(groundBody);
```

## ボディタイプ

```javascript
// 動的（物理演算の影響を受ける）
new CANNON.Body({ mass: 5, ... })

// 静的（動かない、mass: 0と同じ）
new CANNON.Body({ type: CANNON.Body.STATIC, ... })

// キネマティック（コードで動かすが、他の物体に影響を与える）
new CANNON.Body({ type: CANNON.Body.KINEMATIC, ... })
```

## 力とインパルス

```javascript
// 力を加える（継続的）
body.applyForce(new CANNON.Vec3(100, 0, 0), body.position);

// インパルス（瞬間的）
body.applyImpulse(new CANNON.Vec3(0, 50, 0), body.position);

// 速度を直接設定
body.velocity.set(5, 0, 0);
body.angularVelocity.set(0, 1, 0);
```

## マテリアルと摩擦

```javascript
// マテリアル定義
const groundMaterial = new CANNON.Material('ground');
const ballMaterial = new CANNON.Material('ball');

// 接触時の挙動
const contactMaterial = new CANNON.ContactMaterial(groundMaterial, ballMaterial, {
  friction: 0.3,
  restitution: 0.7  // 反発係数（0-1）
});
world.addContactMaterial(contactMaterial);

// ボディにマテリアル適用
groundBody.material = groundMaterial;
ballBody.material = ballMaterial;
```

## 衝突検知

```javascript
body.addEventListener('collide', (event) => {
  const contactBody = event.body;
  const contactPoint = event.contact;
  console.log('衝突検知:', contactBody);
});
```

## 完全な例: 落下するボックス

```javascript
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Three.js初期化
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ライト
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
light.castShadow = true;
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

// 物理ワールド
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });

// 地面
const groundMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x808080 })
);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// 落下するボックス
const boxMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xff6600 })
);
boxMesh.castShadow = true;
scene.add(boxMesh);

const boxBody = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
  position: new CANNON.Vec3(0, 5, 0)
});
world.addBody(boxBody);

// アニメーションループ
renderer.setAnimationLoop(() => {
  world.fixedStep();
  boxMesh.position.copy(boxBody.position);
  boxMesh.quaternion.copy(boxBody.quaternion);
  renderer.render(scene, camera);
});
```

## デバッグ表示

cannon-es-debuggerを使用：

```javascript
import CannonDebugger from 'cannon-es-debugger';

const cannonDebugger = new CannonDebugger(scene, world);

function animate() {
  world.fixedStep();
  cannonDebugger.update(); // 物理ボディのワイヤーフレーム表示
  renderer.render(scene, camera);
}
```

CDN:
```html
"cannon-es-debugger": "https://unpkg.com/cannon-es-debugger@1.0.0/dist/cannon-es-debugger.js"
```
