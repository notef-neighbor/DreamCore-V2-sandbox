# Modal await 不足修正

**日付:** 2026-01-28

## 問題

既存プロジェクトで追加プロンプトを送ると、毎回「2Dですか3Dですか」の選択肢が表示される。

## 原因

`userManager.listProjectFiles()` と `userManager.readProjectFile()` は、Modal 環境（`USE_MODAL=true`）では Promise を返すが、呼び出し側で `await` していなかった。

```javascript
// 問題のコード（server/index.js:1174）
const files = userManager.listProjectFiles(userId, currentProjectId);  // Promise!
if (files.length > 0) {  // Promise.length は undefined → falsy
  // ここに到達しない
}
```

結果として `files.length > 0` が常に `false` 相当になり、`isNewProject = true` のまま処理が進んでいた。

## 調査方法

Task ツールで並列調査を実行：
1. `listProjectFiles` の全呼び出し箇所
2. `readProjectFile` の全呼び出し箇所
3. `userManager.js` の関数定義確認

## 修正内容

### server/index.js (2箇所)

| 行 | 関数 | 修正 |
|----|------|------|
| 1174 | `listProjectFiles` | `await` 追加 |
| 1177 | `readProjectFile` | `await` 追加 |

### server/claudeRunner.js (9箇所)

| 行 | 関数 | 修正 |
|----|------|------|
| 919 | `listProjectFiles` | `await` 追加 |
| 922 | `readProjectFile` | `await` 追加 |
| 1036 | `listProjectFiles` | `await` 追加 |
| 1042 | `readProjectFile` | `await` 追加 |
| 1050-1053 | `readProjectFile` (map内) | `Promise.all` に変更 |
| 1669 | `readProjectFile` | `await` 追加 |
| 1691 | `readProjectFile` | `await` 追加 |
| 2027 | `readProjectFile` | `await` 追加 |
| 2198 | `readProjectFile` | `await` 追加 |

※ 1866行は既に `await` あり

### map内の特別な対応

```javascript
// 修正前（同期的）
currentCode = files.map(f => {
  const content = userManager.readProjectFile(userId, projectId, f);
  return `--- ${f} ---\n${content}`;
}).join('\n\n');

// 修正後（非同期対応）
const fileContents = await Promise.all(files.map(async f => {
  const content = await userManager.readProjectFile(userId, projectId, f);
  return `--- ${f} ---\n${content}`;
}));
currentCode = fileContents.join('\n\n');
```

## 解決した問題

1. **2D/3D選択が毎回表示される** → 初回のみに修正
2. **既存コードがGemini/Claudeに渡されない** → 正しく渡される
3. **バージョン作成時に空HTMLがコミットされる可能性** → 正しいHTMLがコミット

## 教訓

`userManager.js` の関数は Modal 環境で Promise を返すことがドキュメントコメントに記載されていた：

```javascript
/**
 * @returns {string[]|Promise<string[]>} Array of file paths
 *
 * Note: Returns Promise when USE_MODAL=true
 */
```

呼び出し側は常に `await` を付けるべき（ローカル環境でも害はない）。

## デプロイ

- GitHub push: `feature/sandbox-runtime` ブランチ
- GCE: `git pull && pm2 restart dreamcore-sandbox`
- 動作確認: 既存プロジェクトで2D/3D選択が出ないことを確認
