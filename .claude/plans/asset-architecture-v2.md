# アセットアーキテクチャ V2 計画

**作成日:** 2026-01-23
**ステータス:** レビュー済み（P1対応完了）

---

## 1. 概要

現行の複雑なアセット管理（`/api/assets/:id` + トークン注入）を、シンプルなフォルダベースのアーキテクチャに刷新する。

### 目標

- プロジェクト横断でアセット共有可能
- 認証不要で画像配信（フォルダ単位で制御）
- Remix時は独立コピー（ハッシュで追跡）
- 公式アセット（期間限定）対応

---

## 2. フォルダ構造

```
/data/
  assets/
    global/                              ← 公式アセット（認証不要）
      seasonal/
        christmas_bg_a1b2c3d4.png
        halloween_char_e5f6g7h8.png
      characters/
        mascot_i9j0k1l2.png

  users/
    {userId}/
      assets/                            ← ユーザーのアセット
        player_a1b2c3d4.png
        enemy_e5f6g7h8.png
        uploaded_i9j0k1l2.png

      projects/
        {projectId}/
          index.html
          js/
          css/
          thumbnail.webp
          SPEC.md
```

### 公開制御

- **プロジェクト公開**: `projects.is_public = true`
- **アセット公開**: `assets.is_public = true`（ゲーム公開時に自動設定）
- 同じ場所から配信、認証ルールで制御

### ファイル命名規則

**物理ファイル名（storage）:**
```
{alias}_{hash_short}.{ext}

例:
  player_a1b2c3d4.png
  background_e5f6g7h8.jpg
```

**エイリアス（URL用）:**
```
{original_name}.{ext}（衝突時は連番付与）

例:
  player.png
  player_2.png      ← 衝突時
  player_3.png
```

- `alias`: URL用の名前（owner_id + alias でユニーク）
- `hash_short`: SHA256の先頭8文字（追跡用、URLには出さない）
- 同じ内容 → 同じハッシュ → 追跡可能

### 置換ゼロの実現

**従来:** AI生成 → `assets/player.png` → サーバーで `/api/assets/{uuid}` に置換
**新方式:** AI生成 → `/user-assets/{userId}/player.png` → **HTML/JS内の置換なし**

- AIプロンプトにフルURLを渡す
- AI生成コードはそのままURLを使用
- **後からのHTML/JS置換処理は一切不要**

**注意:** 「置換ゼロ」は「HTML/JS内の自動置換が不要」という意味。
以下の処理は引き続き必要:
- AIへ渡すアセット一覧の生成（`player.png -> /user-assets/{userId}/player.png`）
- アップロード時のURL生成
- Remix時のパス書き換え（元ユーザー → 新ユーザー）

### 衝突回避ロジック

```javascript
async function generateUniqueAlias(ownerId, originalName) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);

  let alias = originalName;
  let counter = 2;

  while (await db.aliasExists(ownerId, alias)) {
    alias = `${base}_${counter}${ext}`;
    counter++;
  }

  return alias;  // player.png or player_2.png
}
```

---

## 3. データベーススキーマ

### 3.1 assets テーブル（改修）

**owner_id の NULL 許容について:**
- `owner_id = NULL` は公式アセット（`is_global = true`）を表す
- ユーザーアセットは必ず `owner_id` が設定される
- UNIQUE制約 `(owner_id, alias)` は NULL を別値として扱うため、
  公式アセット間の alias 重複防止には別途対応が必要（category で区別）

```sql
CREATE TABLE IF NOT EXISTS public.assets (
  -- 識別子
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,  -- NULL = 公式アセット

  -- ファイル情報
  alias TEXT NOT NULL,                 -- player.png（URL用、ユニーク）
  filename TEXT NOT NULL,              -- player_a1b2c3d4.png（物理ファイル名）
  storage_path TEXT NOT NULL,          -- /users/{userId}/assets/player_a1b2c3d4.png
  mime_type TEXT,
  size INTEGER,

  -- ハッシュ（追跡用、URLには出さない）
  hash TEXT NOT NULL,                  -- SHA256 full (64文字)
  hash_short TEXT GENERATED ALWAYS AS (LEFT(hash, 8)) STORED,

  -- 系譜追跡
  original_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  created_in_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  -- 公開設定
  is_public BOOLEAN DEFAULT FALSE,
  is_remix_allowed BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  is_global BOOLEAN DEFAULT FALSE,     -- 公式アセット

  -- 期間限定（公式用）
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,

  -- メタデータ
  category TEXT,                       -- seasonal, characters, etc.
  tags TEXT,
  description TEXT,

  -- タイムスタンプ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- エイリアス一意制約（owner_id + alias）
  UNIQUE(owner_id, alias)
);

-- インデックス
CREATE INDEX idx_assets_owner_id ON assets(owner_id);
CREATE INDEX idx_assets_owner_alias ON assets(owner_id, alias);  -- URL検索用（重要）
CREATE INDEX idx_assets_hash ON assets(hash);
CREATE INDEX idx_assets_original_asset_id ON assets(original_asset_id);
CREATE INDEX idx_assets_created_in_project_id ON assets(created_in_project_id);
CREATE INDEX idx_assets_global ON assets(is_global) WHERE is_global = TRUE;
CREATE INDEX idx_assets_owner_active ON assets(owner_id, created_at DESC)
  WHERE is_deleted = FALSE;
```

### 3.4 必要なDBクエリ関数

```javascript
// database-supabase.js に追加

// エイリアス存在チェック（衝突回避用）
async aliasExists(ownerId, alias) {
  const { data } = await supabaseAdmin
    .from('assets')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('alias', alias)
    .eq('is_deleted', false)
    .single();
  return !!data;
}

// エイリアスでアセット取得（service_role、RLS回避）
async getAssetByAliasAdmin(ownerId, alias) {
  const { data } = await supabaseAdmin
    .from('assets')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('alias', alias)
    .eq('is_deleted', false)
    .single();
  return data;
}

// 公式アセット取得（service_role）
async getGlobalAssetAdmin(category, alias) {
  const { data } = await supabaseAdmin
    .from('assets')
    .select('*')
    .eq('is_global', true)
    .eq('category', category)
    .eq('alias', alias)
    .eq('is_deleted', false)
    .single();
  return data;
}
```

### 3.2 project_assets テーブル（維持）

```sql
CREATE TABLE IF NOT EXISTS public.project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  usage_type TEXT DEFAULT 'image',     -- image, audio, etc.
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, asset_id)
);

CREATE INDEX idx_project_assets_project_id ON project_assets(project_id);
CREATE INDEX idx_project_assets_asset_id ON project_assets(asset_id);
```

### 3.3 RLS ポリシー

**注意:** 実際のアセット配信は `service_role` でDBアクセスし、サーバー側で権限判定する。
RLSはフロントエンドからの直接アクセス用（アセット一覧取得など）。

```sql
-- assets: 自分のアセット + 公開アセット + 公式アセット
-- ※ is_deleted, availability はサーバー側で判定
CREATE POLICY "assets_select" ON public.assets
  FOR SELECT TO authenticated
  USING (
    is_deleted = FALSE
    AND (
      owner_id = (SELECT auth.uid())
      OR is_public = TRUE
      OR (is_global = TRUE
          AND (available_from IS NULL OR available_from <= NOW())
          AND (available_until IS NULL OR available_until >= NOW()))
    )
  );

-- assets: 公開アセットは匿名でも閲覧可（公開ゲーム用）
CREATE POLICY "assets_select_public" ON public.assets
  FOR SELECT TO anon
  USING (
    is_deleted = FALSE
    AND (
      is_public = TRUE
      OR (is_global = TRUE
          AND (available_from IS NULL OR available_from <= NOW())
          AND (available_until IS NULL OR available_until >= NOW()))
    )
  );

-- 自分のアセットのみ CUD
CREATE POLICY "assets_insert" ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "assets_update" ON public.assets
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "assets_delete" ON public.assets
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));
```

---

## 4. API エンドポイント

### 4.1 新規エンドポイント

| メソッド | パス | 認証 | 説明 |
|---------|------|------|------|
| GET | `/user-assets/{userId}/{alias}` | 条件付き | ユーザーアセット配信 |
| GET | `/global-assets/{category}/{alias}` | 不要 | 公式アセット配信 |
| GET | `/game/{userId}/{projectId}/*` | 条件付き | ゲームファイル配信（オーナー or 公開） |

### 4.2 認可条件（/user-assets）

**認可条件（すべて満たす必要あり）:**
1. `is_deleted = false`
2. `available_from` を満たす（NULL または 現在時刻以降）
3. `available_until` を満たす（NULL または 現在時刻以前）
4. 以下のいずれかを満たす:
   - `is_global = true`（公式アセット）
   - `is_public = true`（公開アセット）
   - `owner_id = req.user.id`（所有者）
5. **それ以外は 404**（存在を隠す）

**重要:** DB参照は `service_role` で行い、権限判定はサーバー側で行う

```javascript
// /user-assets/{userId}/{alias}
app.get('/user-assets/:userId/:alias', optionalAuth, async (req, res) => {
  const { userId, alias } = req.params;

  // service_role で取得（RLS回避）
  const asset = await db.getAssetByAliasAdmin(userId, alias);

  // 認可条件チェック
  if (!asset || asset.is_deleted) {
    return res.status(404).send('Not found');
  }

  // 期間チェック
  const now = new Date();
  if (asset.available_from && new Date(asset.available_from) > now) {
    return res.status(404).send('Not found');
  }
  if (asset.available_until && new Date(asset.available_until) < now) {
    return res.status(404).send('Not found');
  }

  // 権限判定
  const isOwner = req.user?.id === userId;
  const isPublic = asset.is_public || asset.is_global;

  if (isOwner || isPublic) {
    return res.sendFile(asset.storage_path);
  }

  // 存在を隠す（403ではなく404）
  return res.status(404).send('Not found');
});

// /global-assets/{category}/{alias}
app.get('/global-assets/:category/:alias', async (req, res) => {
  const { category, alias } = req.params;

  // service_role で取得
  const asset = await db.getGlobalAssetAdmin(category, alias);

  if (!asset || asset.is_deleted) {
    return res.status(404).send('Not found');
  }

  // 期間チェック
  const now = new Date();
  if (asset.available_from && new Date(asset.available_from) > now) {
    return res.status(404).send('Not found');
  }
  if (asset.available_until && new Date(asset.available_until) < now) {
    return res.status(404).send('Not found');
  }

  res.sendFile(asset.storage_path);
});
```

### 4.3 Private アセットのプレビュー

プレビュー（iframe）では private アセットも表示したい場合:

```javascript
// access_token クエリパラメータを許可
app.get('/user-assets/:userId/:alias', optionalAuth, async (req, res) => {
  // optionalAuth が access_token も処理するので
  // req.user がセットされていれば認証済み
  const isOwner = req.user?.id === userId;
  // ...
});
```

**注意:** `optionalAuth` は既に `access_token` クエリパラメータをサポート（authMiddleware.js参照）

### 4.3 廃止エンドポイント

| パス | 理由 |
|------|------|
| `/api/assets/:id` | `/user-assets/` に統合 |
| `/api/assets/:id/meta` | 必要に応じて別途追加 |

---

## 5. ゲームHTML内の参照

### 5.1 参照パターン

```html
<!-- 自分のアセット（alias を使用） -->
<img src="/user-assets/{userId}/player.png" />

<!-- 公式アセット -->
<img src="/global-assets/characters/mascot.png" />
```

### 5.2 AI生成時の処理（置換ゼロ）

**従来の方式（廃止）:**
```javascript
// ❌ 後から置換が必要だった
AI: <img src="assets/player.png" />
Server: → <img src="/api/assets/{uuid}" />
```

**新方式（置換不要）:**
```javascript
// ✅ AIが最初から正しいURLを書く
// プロンプトで利用可能なアセットをフルURLで渡す
const availableAssets = [
  '/user-assets/{userId}/player.png',
  '/user-assets/{userId}/enemy.png',
  '/global-assets/characters/mascot.png',
];

// AI生成コード（そのまま動く）
<img src="/user-assets/{userId}/player.png" />
```

**claudeRunner.js の変更:**
```javascript
// 置換処理は削除
// 代わりに、プロンプトでフルURLを渡す
const buildAssetPrompt = (userId, assets) => {
  return assets.map(a =>
    `- ${a.alias}: /user-assets/${userId}/${a.alias}`
  ).join('\n');
};
```

---

## 6. アップロード処理

### 6.1 フロー

```
ユーザーが player.png をアップロード
    ↓
1. ファイル内容からSHA256ハッシュ計算 → a1b2c3d4...
    ↓
2. エイリアス決定: player.png（衝突時は player_2.png）
    ↓
3. 物理ファイル名: player_a1b2c3d4.png
    ↓
4. 保存先: /users/{userId}/assets/player_a1b2c3d4.png
    ↓
5. DB登録: alias="player.png", filename="player_a1b2c3d4.png"
    ↓
6. レスポンス: { url: "/user-assets/{userId}/player.png" }
```

### 6.2 実装

```javascript
app.post('/api/assets/upload', authenticate, upload.single('file'), async (req, res) => {
  const userId = req.user.id;
  const projectId = req.body.projectId;
  const file = req.file;

  // ハッシュ計算
  const fileBuffer = fs.readFileSync(file.path);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const hashShort = hash.slice(0, 8);

  // エイリアス決定（衝突時は連番付与）
  const ext = path.extname(file.originalname);
  const baseName = path.basename(file.originalname, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 32);
  const alias = await generateUniqueAlias(userId, `${baseName}${ext}`);

  // 物理ファイル名（ハッシュ付き）
  const aliasBase = path.basename(alias, ext);
  const filename = `${aliasBase}_${hashShort}${ext}`;

  // 保存先
  const userAssetsDir = path.join(USERS_DIR, userId, 'assets');
  ensureDir(userAssetsDir);
  const storagePath = path.join(userAssetsDir, filename);

  // 同じハッシュのファイルが既にあればスキップ（デデュープ）
  if (!fs.existsSync(storagePath)) {
    fs.renameSync(file.path, storagePath);
  } else {
    fs.unlinkSync(file.path);  // 一時ファイル削除
  }

  // DB登録
  const asset = await db.createAsset({
    owner_id: userId,
    alias,                              // player.png（URL用）
    filename,                           // player_a1b2c3d4.png（物理）
    original_name: file.originalname,
    storage_path: storagePath,
    mime_type: file.mimetype,
    size: file.size,
    hash,
    created_in_project_id: projectId,
  });

  // プロジェクトと関連付け
  if (projectId) {
    await db.linkAssetToProject(projectId, asset.id);
  }

  res.json({
    id: asset.id,
    alias: asset.alias,
    filename: asset.filename,
    url: `/user-assets/${userId}/${asset.alias}`,  // エイリアスを使用
  });
});

// エイリアス衝突回避ヘルパー
async function generateUniqueAlias(ownerId, originalName) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);

  let alias = originalName;
  let counter = 2;

  while (await db.aliasExists(ownerId, alias)) {
    alias = `${base}_${counter}${ext}`;
    counter++;
  }

  return alias;  // player.png or player_2.png
}
```

---

## 7. Remix処理

### 7.1 フロー

```
ユーザーがゲームをRemix
    ↓
1. 元ゲームのプロジェクトをコピー
    ↓
2. 使用アセットを特定（project_assets）
    ↓
3. 各アセットをチェック:
   - is_public && is_remix_allowed → コピー
   - 公式アセット → 参照のまま（コピー不要）
   - それ以外 → エラー or スキップ
    ↓
4. アセットファイルを新ユーザーのフォルダにコピー
    ↓
5. DB登録（original_asset_id で系譜記録）
    ↓
6. HTML内のパスを新ユーザー用に書き換え
```

### 7.2 実装

```javascript
async function remixProject(originalProjectId, newUserId) {
  const original = await db.getProjectById(originalProjectId);

  // 権限チェック
  if (!original.is_public) {
    throw new Error('Cannot remix private project');
  }

  // 新プロジェクト作成
  const newProject = await db.createProject({
    user_id: newUserId,
    name: `${original.name} (Remix)`,
    remixed_from: originalProjectId,
  });

  // プロジェクトファイルをコピー
  const originalDir = getProjectPath(original.user_id, originalProjectId);
  const newDir = getProjectPath(newUserId, newProject.id);
  await copyDirectory(originalDir, newDir);

  // アセットをコピー
  const assets = await db.getProjectAssets(originalProjectId);
  const assetMapping = {};  // old alias URL → new alias URL

  for (const asset of assets) {
    if (asset.is_global) {
      // 公式アセットは参照のまま
      continue;
    }

    if (!asset.is_public || !asset.is_remix_allowed) {
      console.warn(`Skipping non-remixable asset: ${asset.alias}`);
      continue;
    }

    // 新ユーザーでのエイリアス決定（衝突時は連番付与）
    const newAlias = await generateUniqueAlias(newUserId, asset.alias);
    const ext = path.extname(asset.alias);
    const newAliasBase = path.basename(newAlias, ext);
    const newFilename = `${newAliasBase}_${asset.hash.slice(0, 8)}${ext}`;

    // ファイルコピー
    const newStoragePath = path.join(USERS_DIR, newUserId, 'assets', newFilename);
    ensureDir(path.dirname(newStoragePath));
    fs.copyFileSync(asset.storage_path, newStoragePath);

    // DB登録
    const newAsset = await db.createAsset({
      owner_id: newUserId,
      alias: newAlias,                  // player.png（または player_2.png）
      filename: newFilename,            // player_a1b2c3d4.png
      original_name: asset.original_name,
      storage_path: newStoragePath,
      mime_type: asset.mime_type,
      size: asset.size,
      hash: asset.hash,
      original_asset_id: asset.id,      // 系譜追跡
      created_in_project_id: newProject.id,
    });

    await db.linkAssetToProject(newProject.id, newAsset.id);

    // URLマッピング（エイリアスベース）
    assetMapping[`/user-assets/${original.user_id}/${asset.alias}`] =
                `/user-assets/${newUserId}/${newAlias}`;
  }

  // HTML内のパスを書き換え（エイリアス → エイリアス）
  const indexPath = path.join(newDir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf-8');
  for (const [oldPath, newPath] of Object.entries(assetMapping)) {
    html = html.replace(new RegExp(escapeRegex(oldPath), 'g'), newPath);
  }
  fs.writeFileSync(indexPath, html);

  return newProject;
}
```

---

## 8. 公開処理

### 8.1 フロー

```
ユーザーがゲームを公開
    ↓
1. projects.is_public = true に設定
    ↓
2. 使用アセットを特定（project_assets）
    ↓
3. 各アセットの is_public = true に設定
    ↓
4. 完了（ファイルコピー不要！）
```

### 8.2 実装

```javascript
async function publishProject(projectId, userId) {
  // プロジェクトを公開
  await db.updateProject(projectId, { is_public: true });

  // 使用アセットを公開
  const assets = await db.getProjectAssets(projectId);
  for (const asset of assets) {
    if (asset.owner_id === userId && !asset.is_global) {
      await db.updateAsset(asset.id, { is_public: true });
    }
  }
}
```

### 8.3 非公開に戻す場合

```javascript
async function unpublishProject(projectId, userId) {
  // プロジェクトを非公開
  await db.updateProject(projectId, { is_public: false });

  // アセットは他のプロジェクトで使用中かもしれないので
  // 個別に is_public を戻すかはユーザーに委ねる
  // または: 他の公開プロジェクトで使用されていなければ非公開に
}
```

---

## 9. フロントエンド変更

### 9.1 アセットURL生成

```javascript
// 現行
asset.url = `/api/assets/${asset.id}`;

// 新規（エイリアスを使用）
asset.url = `/user-assets/${asset.owner_id}/${asset.alias}`;

// 例:
// alias = "player.png" → /user-assets/{userId}/player.png
// alias = "player_2.png" → /user-assets/{userId}/player_2.png
```

### 9.2 アセットパネル表示

```javascript
// プロジェクトごとにグループ化（現状維持）
async loadAssets() {
  const assets = await authFetch('/api/assets').then(r => r.json());

  // created_in_project_id でグループ化
  const grouped = {};
  for (const asset of assets) {
    const projectId = asset.created_in_project_id || 'unassigned';
    if (!grouped[projectId]) grouped[projectId] = [];
    grouped[projectId].push(asset);
  }

  this.renderAssetsByProject(grouped);
}
```

### 9.3 トークン注入の削除

以下のコードは**削除**:
- `app.js`: `getAuthenticatedAssetUrl()`
- `publish.js`: `getAuthenticatedUrl()`
- `server/index.js`: `/game/` でのトークン注入

---

## 10. マイグレーション計画

### Phase 1: 準備

1. 新フォルダ構造を作成
2. 新エンドポイントを追加（旧と並行稼働）
3. DBマイグレーション（新カラム追加）

### Phase 2: データ移行

1. 既存アセットを新フォルダ構造に移動
2. ファイル名にハッシュを付与
3. storage_path を更新

### Phase 3: 切り替え

1. フロントエンドを新URLに切り替え
2. 旧エンドポイントを非推奨化
3. トークン注入コードを削除

### Phase 4: クリーンアップ

1. 旧エンドポイントを削除
2. 旧フォルダを削除
3. 不要なコードを削除

---

## 11. 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `server/config.js` | パス定数追加 |
| `server/index.js` | 新エンドポイント追加、旧削除 |
| `server/database-supabase.js` | 新クエリ追加 |
| `server/claudeRunner.js` | アセット参照置換修正 |
| `server/userManager.js` | 保存先変更 |
| `public/app.js` | URL生成変更、トークン削除 |
| `public/publish.js` | URL生成変更、トークン削除 |
| `supabase/migrations/005_asset_v2.sql` | スキーマ変更 |

---

## 12. リスクと対策

| リスク | 対策 |
|--------|------|
| マイグレーション中のダウンタイム | 並行稼働で段階移行 |
| 既存アセットのリンク切れ | リダイレクト or 両方のパスで配信 |
| ハッシュ衝突 | SHA256で実質ゼロ |
| ストレージ増加（Remix時コピー） | 許容範囲、必要なら後でデデュープ |

### デデュープについて（P2: 将来検討）

**現状:**
- 物理保存が `/users/{userId}/assets/` のため、ユーザー間の物理デデュープは発生しない
- ハッシュは**追跡用**（同じ画像がどこで使われているか把握）

**将来のストレージ削減が必要な場合:**
- 共通ストア `/data/assets/store/{hash}` を導入
- `storage_path` は共通ストアへのシンボリックリンクまたは直接参照
- 参照カウントで物理削除を管理

**現フェーズでは不要** - 運用でストレージ問題が顕在化してから検討

---

## 13. 確認事項（監修回答済み）

- [x] 公式アセットの管理画面は必要か？ → **不要**（SQL/スクリプトで管理）
- [x] アセットの検索機能は必要か？ → **UI上は必要**（UX上の価値が高い）
- [x] アセット使用量の制限は必要か？ → **不要**（Phase 2以降で検討）
- [x] 古いアセットの自動削除は必要か？ → **不要**（運用安定後に検討）

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-01-23 | 初版作成 |
| 2026-01-23 | エイリアス方式に更新（置換ゼロ実現）、衝突回避ロジック追加、DBクエリ関数仕様追加 |
| 2026-01-23 | P1レビュー対応: owner_id NULL許容明文化、RLSにis_deleted/availability条件追加、認可条件明文化、「置換ゼロ」の意味を明確化、デデュープ注記追加、確認事項回答 |
