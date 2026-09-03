# Release とプレビュー反映（GitHub Actions）

`.github/workflows/theme-release.yml` が Release の作成とプレビューサイトへの反映を担う。

ワークフローから呼ぶスクリプト（`.github/scripts/`）のテストは次で実行する。

```bash
yarn test:workflow
```

`.node-version` の Node が必要（`node --test` のグロブ指定は Node 21 以降でのみ動く）。

## テーマ名とタグの規則

ブランチ名 = `package.json` の `name` = Release タグの接頭辞、という規則で統一している。
`name` はそのまま zip 名になる（`gulpfile.js` が `package.json` の `name` を zip 名にするため）。

このブランチの `name` は `coverd` なので、タグは `coverd-v<X.Y.Z>`、zip は `dist/coverd.zip` になる。

## Release を作る

タグを打ったコミットがビルドされ、`dist/coverd.zip` を添付した Release ができる。
添付は zip 1ファイルだけで、Unleash 側の構築ワークフローはこれを `*.zip` で取得する。
コミットを指定しなければ、そのブランチの先頭（HEAD）にタグが打たれる。

```bash
git switch coverd
git pull
git tag coverd-v1.0.0
git push origin coverd-v1.0.0
```

先頭以外のコミットをリリースするときは、コミットを指定して打つ。

```bash
git tag coverd-v1.0.0 <commit>
git push origin coverd-v1.0.0
```

接頭辞と `name` が一致しない場合はワークフローが失敗し、Release は作られない。

ワークフローファイルはタグが指すコミットに含まれるものが使われるため、テーマを開発する各ブランチに同一内容で置いている。

Release を作る操作はタグの push だけで、GitHub の Release 画面（Draft a new release）からは作らない。
Release 画面は publish した時点でタグを作るため、ワークフローが起動するときには Release が先に存在し、`gh release create` が衝突して失敗する。

## ワークフローが失敗したとき

失敗したステップのログに出るメッセージで原因が分かる。

| メッセージ | 原因 |
| --- | --- |
| `タグの接頭辞 "<prefix>" は package.json の name "<name>" と同じである必要があります` | 別ブランチのコミットにタグを打った |
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

## 既存サイトへ反映する

Release の `coverd.zip` を管理画面からアップロードする。
有効化中のテーマと同名の zip はその場で差し替わり、カスタムテーマ設定も保持されるため activate の切り替えは要らない。

## プレビューサイトへ反映する

Actions 画面で **Theme Release** を選び、ブランチを指定して手動実行する。
そのブランチをビルドしてプレビューサイトへ upload → activate する。Release は作らない。

Environment `preview` に Secrets `PREVIEW_URL` と `PREVIEW_ADMIN_API_KEY`（プレビューサイトのカスタム統合の Admin API キー）を登録する。
任意のブランチを手動実行できる以上、このジョブは Admin API キーを持つため、必要なら Environment の protection rules で承認や実行可能ブランチを制限する。
