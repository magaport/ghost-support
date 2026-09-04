# Source of Yuta Watanabe Locker Room

渡邊雄太選手のファンサイトの[Ghost](http://github.com/tryghost/ghost/)テーマファイル

&nbsp;

## Requirements

- [Node.js](https://nodejs.org/): v18.20.4
- [Yarn](https://yarnpkg.com/): v1.22.22
- [ローカルのGhost環境](https://github.com/magaport/Unleash): yw-japanese ブランチ
  - `ghost/core/content/themes`以下の`source`ディレクトリを本リポジトリに置換する

&nbsp;

## Development

- packageのインストール

   ```bash
   yarn install
   ```

- serverの起動 
  - `/assets/css/` ファイルを編集できるようになり、自動的に `/assets/built/` にコンパイルされる

   ```bash
   yarn dev
   ```

- (サイトにテーマファイルをアップロードするときにのみ使用)テーマファイルをzipする
  - `dist/<theme-name>.zip`に出力

   ```bash
   yarn zip
   ```

### EC連携のURL設定

EC の各サービス（mp-fms-js / mp-fms-cart / mp-base-api / mp-tkm / mp-medusa）の URL は、テーマが実行時のオリジンから決める。
サイトごとの設定ファイルはなく、zip はどのサイトでもそのまま使える。

| 値                | サービス    | デプロイ先                                            | ローカル開発             |
|-------------------|-------------|-------------------------------------------------------|--------------------------|
| `MP_FMS_JS_URL`   | mp-fms-js   | `<origin>/fms-js`                                     | `http://localhost:18081` |
| `MP_FMS_CART_URL` | mp-fms-cart | `<origin>/cart`                                       | `http://localhost:18083` |
| `MP_BASE_API_URL` | mp-base-api | `<origin>`（`servicePath` 配下）                      | `http://localhost:18082` |
| `MP_TKM_URL`      | mp-tkm      | `<origin>/tkm`                                        | `http://localhost:18080` |
| `MP_MEDUSA_URL`   | mp-medusa   | `<origin>`（`/store/` `/admin/` `/fms/` `/uploads/`） | `http://localhost:9000`  |

デプロイ先では nginx が全サービスをサイトと同一オリジンの固定パスへ集約する（Unleash の `unleash/docker/nginx.snippets/ec-sns.locations.conf`）。

オリジンが `localhost` / `127.0.0.1` のときだけ、個別ポートの Vite dev サーバーへ直接つなぐ。
ポートは Unleash の `unleash/docker/compose.ec.dev.yml` の既定値と対応しているため、ポートを変えて起動した場合はテーマ側も直す必要がある。

&nbsp;

### Develope Reference

- [Handlebars](http://handlebarsjs.com/)
- [theme API documentation](https://ghost.org/docs/themes/)
- [メールテンプレートのカスタマイズの方法（暫定対応）](CustomizeMailTemplate.md)

## Production Deployment Flow

[リリース作業](RELEASE.md)

[テーマの Release とプレビュー反映](UNLEASH_README.md)

## Copyright & License

Copyright (c) 2013-2023 Ghost Foundation - Released under the [MIT license](LICENSE).
