# WordPress から Ghost への移行ワークフロー

WordPress のエクスポートから Ghost へのインポートまでの手順

---

## 1. WordPress でのエクスポート

### 1.1 すべてのコンテンツをエクスポート（ベースXML）

サイトの構造（著者・カテゴリー・タグ）を含むベースファイルをエクスポートします。

```
WordPress 管理画面 → ツール → エクスポート
→ 「すべてのコンテンツ」を選択
→ エクスポートファイルをダウンロード
```

**配置先**: `wordpress-to-ghost-migration-files-20251017/xml/WordPress.2025-10-16.xml`

### 1.2 投稿のみを月別でエクスポート

投稿データを月別に分割してエクスポートします。

```
WordPress 管理画面 → ツール → エクスポート
→ 「投稿」を選択
→ 日付範囲を指定（例: 2024年1月）
→ エクスポートファイルをダウンロード
```

**配置先**: `raw/投稿/2024-01/WordPress.2024-01.xml`

各月ごとに繰り返してください。

---

## 2. ファイルの配置

```
project-root/
├── raw/
│   └── 投稿/
│       ├── 2024-01/WordPress.2024-01.xml
│       ├── 2024-02/WordPress.2024-02.xml
│       └── ...
│
├── wordpress-to-ghost-migration-files-20251017/
│   └── xml/
│       └── WordPress.2025-10-16.xml  (ベースXML)
│
├── scripts/
│   ├── create_batch_xmls.py
│   └── convert/
│       ├── convert_sample_xml_to_json.py
│       └── convert_wp_pages_to_json.py
│
└── batch-{SIZE}posts/xml/  (出力先、自動作成)
```

---

## 3. バッチXMLファイルの生成

投稿を指定サイズのバッチファイルに分割します。

### 基本的な使い方

```bash
# デフォルト（100件バッチ）
python3 scripts/create_batch_xmls.py

# バッチサイズを指定
python3 scripts/create_batch_xmls.py --batch-size 200
```

### バッチサイズの選び方

| サイズ | 適用ケース |
|-------|----------|
| 50件 | タイムアウトが頻発する環境 |
| **100件** | **推奨（デフォルト）** |
| 200件 | 安定した高速環境 |
| 500件 | 大量データを高速処理 |

**詳細**: [create_batch_xmls.md](./create_batch_xmls.md)

---

## 4. Ghost JSON への変換

### 4.1 投稿の変換

```bash
# 個別変換（テスト）
python3 scripts/convert/convert_sample_xml_to_json.py \
  batch-100posts/xml/WordPress-batch-001-100posts.xml

# 一括変換
for xml in batch-100posts/xml/WordPress-batch-*.xml; do
  python3 scripts/convert/convert_sample_xml_to_json.py "$xml"
done
```

**出力**:
- `data/json/ghost_import_batch_*.json`
- `sql/fix_authors_batch_*.sql`

---

## 5. Ghost へのインポート（投稿）

### 5.1 Ghost 管理画面でのインポート

```
Ghost 管理画面 → Settings → Labs → Import content
→ JSONファイルを選択（例: ghost_import_batch_001_*.json）
→ Import をクリック
```

**注意**: バッチごとに1つずつインポートしてください。

### 5.2 著者情報の修正

Ghost へのインポート後、SQLで著者情報を修正します。

```bash
# 個別実行
mysql -u ghost_user -p ghost_db < sql/fix_authors_batch_001_*.sql

# 全バッチ一括実行
for sql in sql/fix_authors_*.sql; do
  mysql -u ghost_user -p ghost_db < "$sql"
done
```

### 5.3 確認

```
Ghost 管理画面 → Posts
```

投稿が表示され、著者が正しく設定されていることを確認します。

---

## 6. 固定ページのインポート（オプション）

WordPress の固定ページをインポートする場合は、投稿とは別に処理します。

### 6.1 WordPress からページをエクスポート

```
WordPress 管理画面 → ツール → エクスポート
→ 「ページ」を選択
→ エクスポートファイルをダウンロード
```

**配置先**: `scripts/convert/xml/WordPress-FixedPage.2025-10-21.xml`

### 6.2 Ghost JSON に変換

```bash
cd scripts/convert
python3 convert_wp_pages_to_json.py
```

**出力**:
- `output/ghost_import_pages_*.json`
- `output/fix_page_authors_*.sql`

### 6.3 Ghost にインポート

```
Ghost 管理画面 → Settings → Labs → Import content
→ ghost_import_pages_*.json を選択
→ Import をクリック
```

### 6.4 著者情報を修正

```bash
mysql -u ghost_user -p ghost_db < scripts/convert/output/fix_page_authors_*.sql
```

### 6.5 確認

```
Ghost 管理画面 → Pages
```

**詳細**: [convert_wp_pages_to_json.md](./convert_wp_pages_to_json.md)

---

## 7. ワークフロー全体のまとめ

### 投稿のインポート

```bash
# 1. ディレクトリ構造の確認
tree -L 3

# 2. バッチXML生成
python3 scripts/create_batch_xmls.py --batch-size 100

# 3. Ghost JSON変換（一括）
for xml in batch-100posts/xml/WordPress-batch-*.xml; do
  python3 scripts/convert/convert_sample_xml_to_json.py "$xml"
done

# 4. Ghost へインポート（管理画面で実行）
# Settings → Labs → Import content

# 5. 著者情報の修正
for sql in sql/fix_authors_*.sql; do
  mysql -u ghost_user -p ghost_db < "$sql"
done
```

### 固定ページのインポート（オプション）

```bash
# 1. XMLファイル配置
# scripts/convert/xml/WordPress-FixedPage.2025-10-21.xml

# 2. Ghost JSON変換
cd scripts/convert
python3 convert_wp_pages_to_json.py

# 3. Ghost へインポート（管理画面で実行）
# Settings → Labs → Import content → ghost_import_pages_*.json

# 4. 著者情報の修正
mysql -u ghost_user -p ghost_db < scripts/convert/output/fix_page_authors_*.sql
```

---

## 8. トラブルシューティング

### バッチXML生成でエラー

**エラー**: `ERROR: raw/投稿 not found`

**解決策**:
```bash
python3 scripts/create_batch_xmls.py --raw-folder path/to/your/posts
```

---

**エラー**: `ERROR: WordPress.2025-10-16.xml not found`

**解決策**:
```bash
python3 scripts/create_batch_xmls.py --base-xml path/to/your/base.xml
```

---

### Ghost インポートでエラー

**エラー**: `Import failed: File too large`

**解決策**: バッチサイズを小さくする
```bash
python3 scripts/create_batch_xmls.py --batch-size 50
```

---

**エラー**: `Timeout during import`

**解決策**: バッチサイズを50件に減らす

---

### 著者が Owner のまま

**原因**: SQLスクリプトが実行されていない

**解決策**:
```bash
# SQLスクリプトを実行
mysql -u ghost_user -p ghost_db < sql/fix_authors_batch_*.sql
```

---

## 9. 検証

### 投稿数の確認

```sql
SELECT COUNT(*) as total_posts FROM posts WHERE type = 'post';
```

### 著者の確認

```sql
SELECT u.name, COUNT(pa.post_id) as post_count
FROM users u
LEFT JOIN posts_authors pa ON u.id = pa.author_id
LEFT JOIN posts p ON pa.post_id = p.id AND p.type = 'post'
GROUP BY u.id, u.name
ORDER BY post_count DESC;
```

### カテゴリーページの確認

```sql
SELECT COUNT(*) as category_pages
FROM posts
WHERE type = 'page' AND slug LIKE 'category-%';
```
