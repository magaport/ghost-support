# convert_wp_pages_to_json.py

WordPress 固定ページ（Pages）を Ghost JSON に変換するスクリプト

## 概要

WordPress の固定ページ（投稿ではなく Pages）を Ghost のページ形式に変換します。

**用途**:
- WordPress の「固定ページ」をインポートしたい場合
- 「お問い合わせ」「会社概要」「プライバシーポリシー」などの静的ページ

**注意**: このスクリプトは**投稿（Posts）は処理しません**。投稿の変換には `convert_sample_xml_to_json.py` を使用してください。

## いつ実行するか？

WordPress から固定ページをエクスポートし、Ghost にインポートしたいときに使用します。

### 実行タイミング

```
投稿のインポート完了後
    ↓
固定ページのエクスポート（WordPress）
    ↓
convert_wp_pages_to_json.py 実行 ← ここ！
    ↓
Ghost へインポート
    ↓
著者情報のSQL修正
```

## 機能

### 主な処理

1. **固定ページの抽出**
   - `<wp:post_type>page</wp:post_type>` を含む `<item>` 要素のみを抽出

2. **Ghost JSON への変換**
   - タイトル、スラッグ、本文、ステータス、日付を変換
   - HTML、plaintext、lexical 形式を生成

3. **著者情報の保存**
   - `custom_excerpt` に `wp_page_id` を保存
   - 著者修正用 SQL ファイルを生成

## 入力

### 必要なファイル

```
scripts/convert/xml/WordPress-FixedPage.2025-10-21.xml
```

### WordPress でのエクスポート方法

```
WordPress 管理画面
  ↓
ツール → エクスポート
  ↓
「ページ」を選択
  ↓
「エクスポートファイルをダウンロード」をクリック
```

取得されるXMLには以下が含まれます：
- すべての固定ページ
- 著者情報
- ページのメタデータ

### ファイル配置

```
scripts/convert/xml/WordPress-FixedPage.2025-10-21.xml
```

または、スクリプト内のパスを変更：

```python
xml_file = Path(__file__).parent / 'xml' / 'your-pages-file.xml'
```

## 出力

### ファイル構造

```
scripts/convert/output/
├── ghost_import_pages_20251030_120000.json
└── fix_page_authors_20251030_120000.sql
```

### Ghost JSON の内容

- **posts**: 固定ページのリスト（`type: 'page'`）
- **users**: 著者情報
- **posts_authors**: ページと著者の関連付け
- **tags**: 空配列（固定ページにはタグがない）
- **posts_tags**: 空配列

### SQL ファイル

ページの著者情報を修正するための SQL スクリプトが生成されます。

## 使用方法

### 基本的な使い方

```bash
# スクリプトのディレクトリに移動
cd scripts/convert

# 実行
python3 convert_wp_pages_to_json.py
```

### カスタムパスを指定する場合

スクリプトを編集して、入力ファイルのパスを変更します：

```python
# convert_wp_pages_to_json.py の main() 関数内
xml_file = Path('/path/to/your/WordPress-Pages.xml')
```

または、コマンドライン引数対応版に修正：

```bash
python3 convert_wp_pages_to_json.py --xml-file /path/to/WordPress-Pages.xml
```

## 実行例

```
================================================================================
Convert WordPress Fixed Pages XML to Ghost JSON
================================================================================

  Reading scripts/convert/xml/WordPress-FixedPage.2025-10-21.xml...
  Found 2 authors
    - admin (ID: 1)
    - editor (ID: 2)

    Page 10: お問い合わせ (slug: contact, status: published)
    Page 12: プライバシーポリシー (slug: privacy-policy, status: published)
    Page 15: 会社概要 (slug: about, status: published)

================================================================================
Total pages: 3
Total authors: 2
================================================================================

Writing to scripts/convert/output/ghost_import_pages_20251030_120000.json...

================================================================================
Generating SQL script: scripts/convert/output/fix_page_authors_20251030_120000.sql
================================================================================
  Generated SQL with 3 page-author mappings
  SQL file: scripts/convert/output/fix_page_authors_20251030_120000.sql

================================================================================
✓ Files created:
  - Ghost JSON: scripts/convert/output/ghost_import_pages_20251030_120000.json
  - SQL fix script: scripts/convert/output/fix_page_authors_20251030_120000.sql
================================================================================
Total pages: 3
  - Published: 3
  - Draft: 0
Users: 2
Posts-Authors relationships: 3

Page status distribution:
  published: 3 pages

Pages by author:
  Admin (ID: 1): 2 pages
  Editor (ID: 2): 1 pages

================================================================================
```

## Ghost へのインポート

### 1. Ghost JSON のインポート

```
Ghost 管理画面
  ↓
Settings → Labs → Import content
  ↓
ghost_import_pages_20251030_120000.json を選択
  ↓
Import をクリック
```

### 2. 著者情報の修正

```bash
# MySQL に接続
mysql -u root ghost_development

# SQL スクリプトを実行
source /path/to/scripts/convert/output/fix_page_authors_20251030_120000.sql

# 結果を確認
SELECT
  JSON_UNQUOTE(JSON_EXTRACT(p.custom_excerpt, '$.wp_page_id')) as wp_page_id,
  p.title,
  p.type,
  u.name as author_name
FROM posts p
INNER JOIN posts_authors pa ON p.id = pa.post_id
INNER JOIN users u ON pa.author_id = u.id
WHERE JSON_EXTRACT(p.custom_excerpt, '$.wp_page_id') IS NOT NULL
  AND p.type = 'page';
```

### 3. Ghost 管理画面で確認

```
Ghost 管理画面 → Pages
```

すべての固定ページが表示され、著者が正しく設定されていることを確認します。

## フィールドマッピング

| WordPress フィールド | Ghost フィールド | 処理内容 |
|-------------------|----------------|---------|
| `<wp:post_id>` | `custom_excerpt` | JSON形式で保存: `{"wp_page_id": "123"}` |
| `<title>` | `title` | そのまま使用 |
| `<wp:post_name>` | `slug` | そのまま使用（空の場合は `page-{id}`） |
| `<content:encoded>` | `html` | そのまま使用 |
| `<content:encoded>` | `plaintext` | HTMLタグを除去 |
| `<content:encoded>` | `lexical` | Lexical JSON形式に変換 |
| `<wp:status>` | `status` | `publish` → `published`, `draft` → `draft` |
| `<wp:post_date>` | `created_at`, `updated_at`, `published_at` | ISO 8601形式に変換 |
| `<dc:creator>` | `posts_authors.author_id` | 著者IDにマッピング |

## カスタマイズ

### 入力ファイルのパス変更

```python
# main() 関数内
xml_file = Path('/path/to/your/WordPress-Pages.xml')
```

### 出力ディレクトリの変更

```python
# main() 関数内
output_dir = Path('/path/to/output')
```

### Lexical 形式のカスタマイズ

```python
def text_to_lexical_json(text: str) -> str:
    # Lexical JSON構造をカスタマイズ
    ...
```

## 注意事項

1. **投稿は含まれない**
   - このスクリプトは固定ページのみを処理します
   - 投稿は `convert_sample_xml_to_json.py` で処理してください

2. **タグは含まれない**
   - 固定ページにはタグが設定されません
   - Ghost の仕様上、固定ページにタグは不要です

3. **ステータスの変換**
   - `publish` → `published`
   - `draft` → `draft`
   - `private` → `draft`（Ghost にはプライベートステータスがない）

4. **スラッグの重複**
   - スラッグが重複している場合、Ghost インポート時にエラーになる可能性があります
   - 事前に重複チェックが必要です

5. **Lexical 形式**
   - Ghost 5.x 以降の新しいエディタ形式に対応
   - plaintext の先頭200文字のみを使用

## トラブルシューティング

### エラー: `ERROR: WordPress-FixedPage.2025-10-21.xml not found`

**原因**: 入力ファイルが見つかりません

**解決策**:
```bash
# ファイルが存在するか確認
ls scripts/convert/xml/

# 正しいパスに配置するか、スクリプト内のパスを修正
```

---

### エラー: `No pages found in XML`

**原因**: XML に固定ページが含まれていません

**解決策**:
- WordPress のエクスポート時に「ページ」を選択したか確認
- XML を開いて `<wp:post_type>page</wp:post_type>` が含まれているか確認

---

### エラー: `UnicodeDecodeError`

**原因**: XML ファイルのエンコーディングが UTF-8 ではない

**解決策**:
- XML ファイルを UTF-8 で保存し直す
- または、スクリプトでエンコーディングを指定：
  ```python
  with open(xml_file, 'r', encoding='utf-8') as f:
  ```

---

### Ghost インポート後、著者が Owner になっている

**原因**: SQL スクリプトがまだ実行されていません

**解決策**:
```bash
# SQL スクリプトを実行
mysql -u root ghost_development < scripts/convert/output/fix_page_authors_*.sql
```

## 関連スクリプト

- **convert_sample_xml_to_json.py**: 投稿の変換スクリプト
- **create_batch_xmls.py**: バッチXML生成スクリプト

## ワークフロー全体

```
1. 投稿のインポート
   └─ create_batch_xmls.py → convert_sample_xml_to_json.py → Ghost インポート

2. 固定ページのインポート ← ここ！
   └─ convert_wp_pages_to_json.py → Ghost インポート → SQL修正

3. 確認
   └─ Ghost 管理画面で投稿とページをチェック
```

## まとめ

このスクリプトを使用することで：

- ✅ WordPress の固定ページを Ghost にインポート可能
- ✅ 著者情報を正しく維持
- ✅ HTML、plaintext、lexical 形式を自動生成
- ✅ SQL による著者修正をサポート

**重要**: 投稿と固定ページは別々にインポートしてください。投稿は `convert_sample_xml_to_json.py`、固定ページは `convert_wp_pages_to_json.py` を使用します。
