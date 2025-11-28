# Source

Coverd のテーマファイル

## Development

```bash
# install dependencies
yarn install

# run development server
yarn dev
```

### Routes の設定

`../../settings/routes.yaml` を下記の内容で更新してください\
※ 反映にはGhostのサーバーの再起動が必要になります

```yaml
routes:
  /search-results/: search-results
  /magazine/: magazine
  /thanks/: thanks
  /post-likes/: post-likes

collections:
  /:
    permalink: /{slug}/
    template: index

taxonomies:
  tag: /tag/{slug}/
  author: /author/{slug}/
```
