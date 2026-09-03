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

GitHub の Releases で `Draft a new release` を開き、`Choose a tag` で `coverd-v1.0.0` を新規作成し、`Generate release notes` を押して `Publish release` する。
`Target` は既定でデフォルトブランチ（`main`）になっているため、`coverd` に変える。
publish した時点でタグが作られ、ワークフローがそのタグの指すコミットをビルドして `coverd.zip` を同じ Release に添付する。
Release の名前と本文は UI で作ったものがそのまま残る。

添付は zip 1ファイルだけで、Unleash 側の構築ワークフローはこれを `*.zip` で取得する。
publish から添付が終わるまでは asset がない状態になるため、Release の zip を使うのは Actions の完了後にする。

タグを直接 push しても Release はできる。この場合はワークフローが Release を作り、本文は自動生成される。

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

接頭辞と `name` が一致しない場合はワークフローが失敗し、zip は添付されない。

ワークフローファイルはタグが指すコミットに含まれるものが使われるため、テーマを開発する各ブランチに同一内容で置いている。

## ワークフローが失敗したとき

`タグの接頭辞 "<prefix>" は package.json の name "<name>" と同じである必要があります` が出た場合は、別ブランチのコミットにタグを打っている。

ビルドや添付で失敗したときは、原因を直してから run を再実行する。Release とタグはそのまま残る。

```bash
gh run list --repo magaport/ghost-support
gh run rerun <run-id> --repo magaport/ghost-support
```

タグを打つコミットを間違えたときは、Release とタグを消してから作り直す。

```bash
gh release delete <tag> --repo magaport/ghost-support --cleanup-tag --yes
```

## 既存サイトへ反映する

Release の `coverd.zip` を管理画面からアップロードする。
有効化中のテーマと同名の zip はその場で差し替わり、カスタムテーマ設定も保持されるため activate の切り替えは要らない。

## プレビューサイトへ反映する

Actions 画面で **Theme Release** を選び、ブランチを指定して手動実行する。
そのブランチをビルドしてプレビューサイトへ upload → activate する。Release は作らない。

Environment `preview` に Secrets `PREVIEW_URL` と `PREVIEW_ADMIN_API_KEY`（プレビューサイトのカスタム統合の Admin API キー）を登録する。
任意のブランチを手動実行できる以上、このジョブは Admin API キーを持つため、必要なら Environment の protection rules で承認や実行可能ブランチを制限する。
