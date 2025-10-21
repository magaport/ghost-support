# WordPress to Ghost インポート手順書

このドキュメントでは、WordPress XMLファイルからGhostへのインポート手順を説明します。

## 概要

WordPress XMLからGhostへのマイグレーションは以下の3ステップで行います：

1. **変換**: WordPress XMLをGhost JSON + SQL修正スクリプトに変換
2. **インポート**: Ghost管理画面からJSONをインポート
3. **修正**: SQLスクリプトを実行して`posts_authors`テーブルを修正

## 前提条件

- Python 3.x がインストールされていること
- Ghostがローカルで起動していること (`yarn dev:ghost`)
- MySQLクライアントがインストールされていること

## ステップ1: WordPress XMLをGhost JSONに変換

### 1.1 変換スクリプトの実行

```bash
cd /Users/soichiro/workspace/magaport/Unleash/main/ghost/core/content/themes/source/wp-migrate
python3 convert_sample_xml_to_json.py
```

### 1.2 出力ファイルの確認

以下の2つのファイルが `output/` ディレクトリに生成されます：

```
output/
├── ghost_import_sample_5posts_20251020_143000.json  # Ghostインポート用JSON
└── fix_authors_20251020_143000.sql                   # posts_authors修正用SQL
```

**重要**: タイムスタンプは同じになるため、対応するファイルを簡単に識別できます。

## ステップ2: Ghost JSONをインポート

### 2.1 Ghostにログイン

ブラウザで Ghost 管理画面を開きます：

```
http://localhost:2368/ghost/
```

### 2.2 インポート機能を開く

1. **Settings** (設定) に移動
2. **Advanced** (詳細設定) を選択
3. **Migration tools** (マイグレーションツール) セクションを見つける
4. **Import content** (コンテンツをインポート) をクリック

### 2.3 JSONファイルを選択してインポート

1. `ghost_import_sample_5posts_YYYYMMDD_HHMMSS.json` を選択
2. **Import** ボタンをクリック
3. インポート完了を待つ（数秒〜数分）

### 2.4 インポート結果の確認

インポート完了後、以下が表示されます：

- ✓ X posts imported
- ✓ X pages imported
- ✓ X tags imported
- ✓ X users imported

**注意**: この時点では、すべての投稿の著者が "Owner" になっています。これは正常な動作です。次のステップで修正します。

## ステップ3: posts_authorsテーブルをSQLで修正

### 3.1 データベース接続情報の確認

Ghost の MySQL データベース接続情報を確認します：

```bash
# config.development.json を確認
cat /Users/soichiro/workspace/magaport/Unleash/main/ghost/core/config.development.json
```

通常、以下の情報になります：
- **ホスト**: `localhost`
- **ユーザー**: `root`
- **パスワード**: (空文字列 or 設定されたパスワード)
- **データベース名**: `ghost_development`

### 3.2 SQLスクリプトの実行

#### 方法A: MySQLコマンドラインから実行

```bash
# MySQL にログイン
mysql -u root ghost_development

# SQLファイルを実行
source /Users/soichiro/workspace/magaport/Unleash/main/ghost/core/content/themes/source/wp-migrate/output/fix_authors_20251020_143000.sql
```

#### 方法B: ワンライナーで実行

```bash
mysql -u root ghost_development < /Users/soichiro/workspace/magaport/Unleash/main/ghost/core/content/themes/source/wp-migrate/output/fix_authors_20251020_143000.sql
```

### 3.3 修正結果の確認

以下のSQLクエリを実行して、著者が正しく設定されているか確認します：

```sql
SELECT
  JSON_UNQUOTE(JSON_EXTRACT(p.custom_excerpt, '$.wp_post_id')) as wp_post_id,
  p.title,
  u.name as author_name,
  u.email as author_email,
  p.custom_excerpt
FROM posts p
INNER JOIN posts_authors pa ON p.id = pa.post_id
INNER JOIN users u ON pa.author_id = u.id
WHERE JSON_EXTRACT(p.custom_excerpt, '$.wp_post_id') IS NOT NULL
ORDER BY CAST(JSON_UNQUOTE(JSON_EXTRACT(p.custom_excerpt, '$.wp_post_id')) AS UNSIGNED);
```

**期待される結果**:
- 各投稿の `author_name` が WordPress の著者名と一致している
- `custom_excerpt` にJSON形式で `wp_post_id` と他のメタデータが記録されている
  - 例: `{"wp_post_id": "123", "amazon_code": "B089J21FQ9", "release_date": "2020-06-22"}`

### 3.4 Ghost管理画面で確認

1. Ghost管理画面を再読み込み
2. **Posts** (投稿一覧) を開く
3. 各投稿の著者が正しく設定されているか確認

## トラブルシューティング

### 問題: SQLスクリプト実行時に "Unknown column" エラーが出る

**原因**: テーブル構造が想定と異なる可能性があります。

**解決策**:
1. テーブル構造を確認:
   ```sql
   DESCRIBE posts;
   DESCRIBE posts_authors;
   DESCRIBE users;
   ```
2. `custom_excerpt` カラムが存在するか確認

### 問題: インポート後も著者が Owner のまま

**原因**: SQLスクリプトが実行されていない、または実行に失敗しています。

**解決策**:
1. SQLスクリプトの実行結果を確認
2. 以下のクエリで現在の状態を確認:
   ```sql
   SELECT COUNT(*) as owner_count
   FROM posts_authors pa
   INNER JOIN users u ON pa.author_id = u.id
   WHERE u.slug = 'owner';
   ```
3. 期待される値と異なる場合は、SQLスクリプトを再実行

### 問題: 一部の投稿の著者が正しく設定されない

**原因**: WordPressの著者がGhostにインポートされていない可能性があります。

**解決策**:
1. インポートされたユーザーを確認:
   ```sql
   SELECT id, slug, name, email FROM users ORDER BY slug;
   ```
2. SQLスクリプト内のマッピングコメントを確認
3. 不足している著者がいる場合は、JSONファイルの `users` セクションを確認

### 問題: custom_excerpt が空になっている

**原因**: 変換スクリプトが正しく実行されていない可能性があります。

**解決策**:
1. JSONファイルを開いて、投稿の `custom_excerpt` フィールドを確認:
   ```json
   {
     "id": "...",
     "title": "投稿タイトル",
     "custom_excerpt": "wp_post_id:123",
     ...
   }
   ```
2. `custom_excerpt` が空の場合は、変換スクリプトを再実行

## SQL修正スクリプトの仕組み

生成されるSQLスクリプトは以下のロジックで動作します：

1. **マッピングテーブルの作成**: WordPress投稿ID (`wp_post_id:XXX`) と著者slug のマッピングを定義
2. **JOINによる照合**:
   - `posts.custom_excerpt` でWordPress投稿IDを特定
   - マッピングテーブルから正しい著者slugを取得
   - `users.slug` で正しい著者IDを特定
3. **UPDATEの実行**: `posts_authors.author_id` を正しい値に更新

### SQLスクリプトの例

```sql
-- Fix posts_authors mapping after Ghost import
-- WordPress post ID -> Author mapping:
--   Post 123: author1 (Author Name)
--   Post 124: author2 (Another Author)

UPDATE posts_authors pa
INNER JOIN posts p ON pa.post_id = p.id
INNER JOIN (
    SELECT 'wp_post_id:123' as wp_key, 'author1' as author_slug
    UNION ALL
    SELECT 'wp_post_id:124', 'author2'
) AS wp_mapping ON p.custom_excerpt = wp_mapping.wp_key
INNER JOIN users u ON u.slug = wp_mapping.author_slug
SET pa.author_id = u.id
WHERE pa.author_id != u.id;
```

## custom_excerpt フィールドについて

`custom_excerpt` フィールドにはJSON形式で以下の情報が保存されます：

- `wp_post_id`: WordPress の投稿ID（著者マッピングに使用）
- `amazon_code`: Amazon ASIN コード
- `release_date`: 発売日
- `furoku_title`: 付録タイトル
- `furoku_lead_text`: 付録説明文

### 例

```json
{
  "wp_post_id": "54054",
  "amazon_code": "B089J21FQ9",
  "release_date": "2020-06-22",
  "furoku_title": "VOCE（ヴォーチェ）2020年8月号",
  "furoku_lead_text": "透明美肌スペシャルBOX（SABON新作スキンケア3点＆アクセーヌ4点セット）"
}
```

### なぜ custom_excerpt を使うのか？

1. **一意性**: 投稿タイトルは重複する可能性がありますが、WordPress投稿IDは一意です
2. **永続性**: Ghostインポート後もフィールドが保持されます
3. **SQL照合の容易さ**: JSONパスでWordPress投稿IDを抽出して照合できます
4. **メタデータの保存**: WordPressのカスタムフィールド情報をそのまま保持できます

### インポート後にcustom_excerptをクリアする必要はありますか？

**不要です**。`custom_excerpt` は Ghost の標準フィールドで、以下の用途で活用できます：

1. **著者マッピングの追跡**: 再インポート時に `wp_post_id` で照合可能
2. **カスタムフィールドの利用**: テーマで `amazon_code` などを読み取って表示可能
3. **データ移行の検証**: WordPress とのデータ整合性確認に使用

もし将来的にクリアしたい場合は、以下のSQLを実行します（**非推奨**）：

```sql
UPDATE posts
SET custom_excerpt = NULL
WHERE JSON_EXTRACT(custom_excerpt, '$.wp_post_id') IS NOT NULL;
```

## 再インポートする場合

同じWordPress XMLを再インポートする場合：

1. **既存データの削除**: Ghost管理画面から既存の投稿・ページ・タグを削除
2. **ステップ1から再実行**: 変換スクリプトを実行（新しいタイムスタンプでファイルが生成されます）
3. **ステップ2-3を実行**: JSONインポート → SQL実行

## まとめ

このワークフローにより、どんなWordPress XMLでも：

1. ✅ 投稿と著者の正しいマッピングを維持
2. ✅ 再現可能な自動化プロセス
3. ✅ デバッグしやすい（custom_excerptで追跡可能）
4. ✅ タイトル重複の心配なし

問題が発生した場合は、トラブルシューティングセクションを参照してください。
