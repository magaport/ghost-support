# Unelash テーマ開発フロー

## Requirements

- **Node.js**: 現行の Ghost がサポートする LTS（2025/09/25 時点 v22 系）
- **パッケージマネージャ**: Yarn 1.x
- **ローカルの Ghost 環境**: 開発モード
  - 通常は `content/themes/<your-theme>` 配下にテーマを配置（またはシンボリックリンク）

---

## テーマの基本構成

```
/partials        # パーシャル（共通断片）
/assets          # CSS/JS/画像（生成物は /assets/built/）
/locales         # 多言語（必要に応じて）
*.hbs            # テンプレート（index.hbs, post.hbs など）
package.json     # テーマのメタ情報・カスタム設定
```

- Handlebars でテンプレート構築（例: `{{> "header"}}` でパーシャル読込）
- [公式の Theme API / Helpers 一覧](https://docs.ghost.org/themes/contexts)を随時参照

---

## 開発フロー（Development）

### 1) 依存インストール

```bash
yarn install
# または npm ci
```

### 2) 開発サーバ（アセット監視・ビルド）

```bash
yarn dev
```

- `assets/css/`（あるいは `src/`）の変更を監視し、`assets/built/` へ自動ビルド
- Gulp / Rollup / esbuild などはプロジェクトの `package.json` に準拠

### 3) テーマの反映

- ローカル Ghost の `content/themes/<your-theme>` に配置（または symlink）
- Ghost 再起動後、管理画面 → **Design & branding** からテーマ選択

> 既存プロジェクトで `ghost/core/content/themes` 以下を直接置換する運用の場合は、環境更新時の衝突や追従コストに注意。標準の `content/themes` 配下運用が推奨です。

---

## 検証（Validation）

テーマの品質・互換性は **gscan** でチェックできます。

```bash
# ディレクトリを検証
yarn dlx gscan .
# もしくは
npx gscan .

# zip を検証
yarn dlx gscan -z dist/theme.zip
# もしくは
npx gscan -z dist/theme.zip
```

- エラー（Fatal）はアップロード時にもブロックされます
- 警告（Warning）は非推奨 API 等の早期検知に有効

---

## パッケージング & デプロイ

### 配布用 ZIP 作成

```bash
yarn zip  # dist/<theme-name>.zip に出力（プロジェクトの script 前提）
```

### 反映方法

- **管理画面アップロード**: Settings → Design & branding → Change theme → **Upload theme** → **Activate**
- **Admin API**: `POST /ghost/api/admin/themes/upload`（CI/CD からの自動反映に最適）
  - マルチパートで `file=@dist/<theme-name>.zip` を送信

---

## Release とプレビュー反映（GitHub Actions）

`.github/workflows/theme-release.yml` が Release の作成とプレビューサイトへの反映を担う。

ワークフローから呼ぶスクリプト（`.github/scripts/`）のテストは次で実行する。

```bash
yarn test:workflow
```

`.node-version` の Node が必要（`node --test` のグロブ指定は Node 21 以降でのみ動く）。

### テーマ名とタグの規則

ブランチ名 = `package.json` の `name` = Release タグの接頭辞、という規則で統一している。
`name` はそのまま zip 名になる（`gulpfile.js` が `package.json` の `name` を zip 名にするため）。

`name` は小文字だけで書く。gscan が大文字を Error として報告するため、ワークフローも大文字を含む `name` では Release を作らない。

`source` / `casper` は Ghost がアップロードを拒否する予約名のため、その名前でも Release を作れない。

`main` の `name` は `source` のため、このブランチからは Release を作れない。
テーマごとの実際のタグ名と zip 名は、各テーマブランチの同じドキュメントに書いてある。

### Release を作る

タグを打ったコミットがビルドされ、`dist/<name>.zip` を添付した Release ができる。
添付は zip 1ファイルだけで、Unleash 側の構築ワークフローはこれを `*.zip` で取得する。
コミットを指定しなければ、そのブランチの先頭（HEAD）にタグが打たれる。

```bash
git switch <branch>
git pull
git tag <name>-v1.0.0
git push origin <name>-v1.0.0
```

先頭以外のコミットをリリースするときは、コミットを指定して打つ。

```bash
git tag <name>-v1.0.0 <commit>
git push origin <name>-v1.0.0
```

接頭辞と `name` が一致しない場合はワークフローが失敗し、Release は作られない。

ワークフローファイルはタグが指すコミットに含まれるものが使われるため、テーマを開発する各ブランチに同一内容で置いている。

Release を作る操作はタグの push だけで、GitHub の Release 画面（Draft a new release）からは作らない。
Release 画面は publish した時点でタグを作るため、ワークフローが起動するときには Release が先に存在し、`gh release create` が衝突して失敗する。

### ワークフローが失敗したとき

失敗したステップのログに出るメッセージで原因が分かる。

| メッセージ | 原因 |
| --- | --- |
| `タグの接頭辞 "<prefix>" は package.json の name "<name>" と同じである必要があります` | 別ブランチのコミットにタグを打った |
| `テーマ名 "<name>" に大文字が含まれています。小文字だけで書いてください` | `package.json` の `name` に大文字がある |
| `"<name>" は予約されたテーマ名のため使用できません` | `name` が `source` / `casper`（`main` からは Release を作れない） |
| `a release with the same tag name already exists: <tag>` | Release がタグより先に存在する（Release 画面から作った場合など） |

タグを打つコミットを間違えた場合は、ローカルとリモートの両方からタグを消してから打ち直す。

```bash
git tag -d <tag>
git push origin :refs/tags/<tag>
```

Release が先に存在して失敗した場合は、その Release を削除してから失敗した run を再実行する。
Release を削除してもタグは残るため、タグの打ち直しは要らない。

```bash
gh release delete <tag> --repo magaport/ghost-support --yes
gh run list --repo magaport/ghost-support
gh run rerun <run-id> --repo magaport/ghost-support
```

### 既存サイトへ反映する

Release の `<name>.zip` を管理画面からアップロードする。
有効化中のテーマと同名の zip はその場で差し替わり、カスタムテーマ設定も保持されるため activate の切り替えは要らない。

### プレビューサイトへ反映する

Actions 画面で **Theme Release** を選び、ブランチを指定して手動実行する。
そのブランチをビルドしてプレビューサイトへ upload → activate する。Release は作らない。

Environment `preview` に Secrets `PREVIEW_URL` と `PREVIEW_ADMIN_API_KEY`（プレビューサイトのカスタム統合の Admin API キー）を登録する。
任意のブランチを手動実行できる以上、このジョブは Admin API キーを持つため、必要なら Environment の protection rules で承認や実行可能ブランチを制限する。

---

## カスタム設定（Theme Custom Settings）

`package.json` の `config` セクションで、テーマ独自の設定 UI を管理画面に表示できます。

- 例: カラースキーム、ロゴ画像、レイアウト切替、トグル／セレクト等
- 編集した値はテンプレート内で `@site` / `@custom` 経由で参照

雛形例：

```json
{
  "name": "your-theme",
  "config": {
    "posts_per_page": 25,
    "custom": {
      "brand_color": {
        "type": "color",
        "title": "Brand Color",
        "default": "#111827"
      },
      "show_featured": {
        "type": "boolean",
        "title": "Show Featured Section",
        "default": true
      }
    }
  }
}
```

テンプレート参照例：

```hbs
<style>
  :root { --brand: {{@custom.brand_color}}; }
</style>
{{#if @custom.show_featured}}
  {{> "featured"}}
{{/if}}
```

---

## ルーティング（routes.yaml）

- トップページ差替え／コレクション／チャンネルの定義を `routes.yaml` で管理
- 管理画面 → Labs（あるいは設定画面）からアップロード

例：

```yaml
routes:
  /: home

collections:
  /blog/:
    permalink: /blog/{slug}/
    template: index

taxonomies:
  tag: /tag/{slug}/
  author: /author/{slug}/
```

---

## Production 運用の指針

- サポート対象の **Node LTS** で Ghost を稼働
- 反映前に `gscan` を継続的に実行（CI で PR ごとに Gate）
- 反映は **管理画面アップロード** か **Admin API**（CI/CD）
- 破壊的変更（Helper の仕様変更等）がある Ghost へのアップグレード時は、先にステージングで検証

---

## 参考リンク（開発者向け）

- [テーマ構造 / Theme API / Helpers](https://docs.ghost.org/themes)
- [Ghost-CLI（ローカル／本番のセットアップ）](https://github.com/magaport/Unleash/blob/magaco-foods/docs/Unleash%E3%81%AE%E3%83%AD%E3%83%BC%E3%82%AB%E3%83%AB%E7%92%B0%E5%A2%83%E6%A7%8B%E7%AF%89%E6%89%8B%E9%A0%86.md)
- [ルーティング（`routes.yaml`）](https://docs.ghost.org/themes/routing)
- [gscan（テーマ検証）](https://docs.ghost.org/themes/gscan)

---

## ライセンス

- 公式テーマ（Casper 等）は **MIT License**。
- 自作テーマはプロジェクト要件に合わせ、`package.json` の `license` も整備。

---

## 補足ドキュメント

- **メールテンプレートのカスタマイズ方法**: `CustomizeMailTemplate.md`

---
