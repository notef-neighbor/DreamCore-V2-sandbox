# Three.js 非推奨・削除API対応表

AIがコード生成時によく間違えるAPIと正しい書き方。

## 削除済みAPI（エラーになる）

### r152: カラースペース変更

```javascript
// ❌ 削除済み
renderer.outputEncoding = THREE.sRGBEncoding;
texture.encoding = THREE.sRGBEncoding;

// ✅ 正しい
renderer.outputColorSpace = THREE.SRGBColorSpace;
texture.colorSpace = THREE.SRGBColorSpace;
```

### r148: examples/js 削除

```javascript
// ❌ 削除済み
<script src="three/examples/js/controls/OrbitControls.js">

// ✅ ES Modules使用
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

### r141: Geometry 削除

```javascript
// ❌ 削除済み
const geometry = new THREE.Geometry();
geometry.vertices.push(new THREE.Vector3(0, 0, 0));

// ✅ BufferGeometry使用
const geometry = new THREE.BufferGeometry();
const vertices = new Float32Array([0, 0, 0]);
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
```

### r125: Geometry完全削除

```javascript
// ❌ 削除済み
new THREE.CubeGeometry()
new THREE.BoxGeometry() // Geometryベース

// ✅ BufferGeometry使用
new THREE.BoxGeometry(1, 1, 1)  // BufferGeometryベース
```

### r137: RGBFormat 削除

```javascript
// ❌ 削除済み
texture.format = THREE.RGBFormat;

// ✅ RGBAFormat使用
texture.format = THREE.RGBAFormat;
```

### r136: gammaOutput 削除

```javascript
// ❌ 削除済み
renderer.gammaOutput = true;
renderer.gammaInput = true;

// ✅ outputColorSpace使用
renderer.outputColorSpace = THREE.SRGBColorSpace;
```

## バージョン別で追加されたAPI

### r142: CapsuleGeometry 追加

```javascript
// r142未満ではエラー
new THREE.CapsuleGeometry(0.5, 1, 4, 8)

// 古いバージョン用代替
// シリンダー + 両端に球
```

### r163: WebGL 1サポート削除

```javascript
// r163以降、WebGL 2必須
// 古いブラウザ対応が必要な場合は r162以前を使用
```

## よく間違えるパターン

### 1. アニメーションループ

```javascript
// ❌ 古いパターン（動くが非推奨）
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// ✅ 最新パターン
renderer.setAnimationLoop(animate);
function animate() {
  renderer.render(scene, camera);
}
```

### 2. Face3の使用

```javascript
// ❌ 削除済み (r125)
geometry.faces.push(new THREE.Face3(0, 1, 2));

// ✅ BufferGeometryのindex使用
geometry.setIndex([0, 1, 2]);
```

### 3. 頂点カラー

```javascript
// ❌ 古いパターン
face.vertexColors = [color1, color2, color3];

// ✅ BufferAttribute使用
const colors = new Float32Array([r1,g1,b1, r2,g2,b2, r3,g3,b3]);
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
material.vertexColors = true;
```

### 4. Matrix操作

```javascript
// ❌ 削除済み (r113)
geometry.applyMatrix(matrix);

// ✅ 正しい
geometry.applyMatrix4(matrix);
```

### 5. UV属性名

```javascript
// ❌ 古いパターン (r151以前)
geometry.attributes.uv2

// ✅ 新しいパターン
geometry.attributes.uv1  // 2番目のUV
```

### 6. MultiMaterial

```javascript
// ❌ 削除済み (r85)
new THREE.MultiMaterial([mat1, mat2])

// ✅ 配列で渡す
new THREE.Mesh(geometry, [mat1, mat2])
```

### 7. ライトの減衰

```javascript
// ❌ decay=1がデフォルトだった (r146以前)
new THREE.PointLight(0xffffff, 1)

// ✅ decay=2がデフォルト (物理的に正確)
new THREE.PointLight(0xffffff, 1, 0, 2)
```

## CDN読み込み時のバージョン指定

```html
<!-- 安定バージョン指定推奨 -->
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/"
  }
}
</script>
```

## チェックリスト

生成コードの確認ポイント：

1. [ ] `encoding` → `colorSpace` になっているか
2. [ ] `Geometry` → `BufferGeometry` になっているか
3. [ ] `examples/js` → `examples/jsm` (ES Modules) になっているか
4. [ ] `requestAnimationFrame` → `setAnimationLoop` になっているか
5. [ ] `CapsuleGeometry` を使う場合 r142以上か
6. [ ] `RGBFormat` → `RGBAFormat` になっているか
