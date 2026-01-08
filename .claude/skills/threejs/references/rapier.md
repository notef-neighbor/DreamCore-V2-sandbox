# Rapier 物理エンジン連携

高性能が必要な場合のRapier（Rust/WASM製）連携ガイド。

## 特徴

- Rust製WASMで高速
- Three.js公式examples採用
- 決定論的シミュレーション

## 方法1: Three.js公式RapierPhysics（簡単）

```javascript
import * as THREE from 'three';
import { RapierPhysics } from 'three/addons/physics/RapierPhysics.js';

// 非同期で初期化（CDNから自動読み込み）
const physics = await RapierPhysics();

// シーンに物理を追加
// userData.physicsでmassとrestitutionを指定
const box = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
box.position.set(0, 5, 0);
box.userData.physics = { mass: 1, restitution: 0.5 };
scene.add(box);

// 地面（mass: 0で静的）
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(10, 0.5, 10),
  new THREE.MeshStandardMaterial({ color: 0x808080 })
);
ground.position.set(0, -0.25, 0);
ground.userData.physics = { mass: 0 };
scene.add(ground);

// シーン全体に物理適用
physics.addScene(scene);

// アニメーションループ
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});
```

## 方法2: 直接Rapierを使用（詳細制御）

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/",
    "@dimforge/rapier3d-compat": "https://cdn.skypack.dev/@dimforge/rapier3d-compat"
  }
}
</script>
```

```javascript
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// 初期化（非同期必須）
await RAPIER.init();

// 物理ワールド
const gravity = { x: 0, y: -9.81, z: 0 };
const world = new RAPIER.World(gravity);

// 地面（固定）
const groundColliderDesc = RAPIER.ColliderDesc.cuboid(10, 0.1, 10);
world.createCollider(groundColliderDesc);

// 動的ボディ
const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0);
const rigidBody = world.createRigidBody(rigidBodyDesc);

const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
world.createCollider(colliderDesc, rigidBody);

// Three.jsメッシュ
const boxMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
scene.add(boxMesh);

// アニメーションループ
renderer.setAnimationLoop(() => {
  world.step();
  
  // 物理→Three.js同期
  const position = rigidBody.translation();
  const rotation = rigidBody.rotation();
  boxMesh.position.set(position.x, position.y, position.z);
  boxMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  
  renderer.render(scene, camera);
});
```

## 形状タイプ

```javascript
// ボックス（半径）
RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ)

// 球
RAPIER.ColliderDesc.ball(radius)

// シリンダー
RAPIER.ColliderDesc.cylinder(halfHeight, radius)

// カプセル
RAPIER.ColliderDesc.capsule(halfHeight, radius)

// 凸包
RAPIER.ColliderDesc.convexHull(vertices)
```

## ボディタイプ

```javascript
// 動的（物理演算あり）
RAPIER.RigidBodyDesc.dynamic()

// 固定（動かない）
RAPIER.RigidBodyDesc.fixed()

// キネマティック（位置ベース）
RAPIER.RigidBodyDesc.kinematicPositionBased()

// キネマティック（速度ベース）
RAPIER.RigidBodyDesc.kinematicVelocityBased()
```

## 力とインパルス

```javascript
// インパルス（瞬間的）
rigidBody.applyImpulse({ x: 0, y: 10, z: 0 }, true);

// 力（継続的）
rigidBody.addForce({ x: 100, y: 0, z: 0 }, true);

// 速度設定
rigidBody.setLinvel({ x: 5, y: 0, z: 0 }, true);
rigidBody.setAngvel({ x: 0, y: 1, z: 0 }, true);
```

## キャラクターコントローラー

```javascript
const characterController = world.createCharacterController(0.01);
characterController.setUp({ x: 0, y: 1, z: 0 });
characterController.setMaxSlopeClimbAngle(45 * Math.PI / 180);
characterController.setMinSlopeSlideAngle(30 * Math.PI / 180);

// 移動計算
characterController.computeColliderMovement(
  collider,
  { x: moveX, y: moveY, z: moveZ }
);

// 補正後の移動量取得
const correctedMovement = characterController.computedMovement();
```

## cannon-es vs Rapier 選択基準

| 項目 | cannon-es | Rapier |
|------|-----------|--------|
| 学習コスト | 低い | やや高い |
| ネット情報量 | 多い | 少なめ |
| パフォーマンス | 普通 | 高速 |
| AI生成安定性 | 高い | 普通 |

**推奨**: 基本的にcannon-esを使用。パフォーマンスが問題になったらRapierに移行。
