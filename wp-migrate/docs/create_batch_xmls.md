# create_batch_xmls.py

WordPress エクスポートファイルを指定サイズのバッチに分割し、ベースXMLとマージするスクリプト

## 概要

`raw/投稿/` フォルダから投稿を収集し、ベースXML（カテゴリー・タグ・著者情報を含む）とマージして、指定サイズのバッチファイルを生成します。

**特徴**:
- バッチサイズを自由に指定可能（デフォルト: 100件）
- 入力・出力パスをカスタマイズ可能
- コマンドライン引数で柔軟に設定

## 機能

### 主な処理

1. **投稿の収集**
   - `raw/投稿/` フォルダから投稿を再帰的に収集
   - 各XMLファイルから著者・カテゴリー・タグも同時に抽出

2. **ベースXMLの読み込み**
   - WordPress の完全エクスポートファイル（著者・カテゴリー・タグを含む）を読み込み

3. **メタデータのマージ**
   - ベースXMLの著者・カテゴリー・タグと、投稿から抽出したメタデータをマージ
   - 重複を自動的に排除

4. **バッチファイルの生成**
   - 100件ずつ分割して `batch-100posts/xml/` に出力
   - 各ファイルには**すべての著者・カテゴリー・タグ**が含まれる

## 入力

### 必要なファイル構造

```
raw/投稿/
  ├── post-001.xml
  ├── post-002.xml
  └── ...

wordpress-to-ghost-migration-files-20251017/xml/
  └── WordPress.2025-10-16.xml  (ベースXML)
```

### ベースXMLについて

**ベースXML** は、WordPress管理画面から「**すべてのコンテンツ**」をエクスポートして取得します：

```
WordPress管理画面 → ツール → エクスポート
→ すべてのコンテンツ を選択
→ エクスポートファイルをダウンロード
```

このファイルには以下が含まれます：
- サイトの基本情報
- すべての著者（`<wp:author>`）
- すべてのカテゴリー（`<wp:category>`）
- すべてのタグ（`<wp:tag>`）
- 投稿（オプション、このスクリプトでは削除される）

## 出力

### ファイル構造

```
batch-100posts/xml/
  ├── WordPress-batch-001-100posts.xml
  ├── WordPress-batch-002-100posts.xml
  └── WordPress-batch-095-100posts.xml
```

### 出力XMLの構造

各ファイルには以下が含まれます：

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" ...>
<channel>
  <title>付録ライフ</title>
  <link>https://edit.furoku.life</link>
  ...

  <!-- マージされたすべての著者 -->
  <wp:author>...</wp:author>

  <!-- マージされたすべてのカテゴリー -->
  <wp:category>...</wp:category>

  <!-- マージされたすべてのタグ -->
  <wp:tag>...</wp:tag>

  <!-- 100件の投稿 -->
  <item>...</item>
  <item>...</item>
  ...

</channel>
</rss>
```

## 使用方法

### 基本的な使い方

```bash
# プロジェクトルートで実行（デフォルト: 100件バッチ）
python3 scripts/create_batch_xmls.py
```

### バッチサイズを指定

```bash
# 200件ずつのバッチを作成
python3 scripts/create_batch_xmls.py --batch-size 200

# 500件ずつのバッチを作成
python3 scripts/create_batch_xmls.py --batch-size 500

# 50件ずつのバッチを作成（小さいバッチ）
python3 scripts/create_batch_xmls.py --batch-size 50
```

### カスタムパスを指定

```bash
# すべてのパスをカスタマイズ
python3 scripts/create_batch_xmls.py \
  --raw-folder raw/投稿 \
  --base-xml wordpress-to-ghost-migration-files-20251017/xml/WordPress.2025-10-16.xml \
  --output-dir output/batch-100 \
  --batch-size 100
```

### ヘルプの表示

```bash
python3 scripts/create_batch_xmls.py --help
```

### 実行前の確認

- [ ] `raw/投稿/` ディレクトリが存在し、投稿XMLファイルがある
- [ ] ベースXML `wordpress-to-ghost-migration-files-20251017/xml/WordPress.2025-10-16.xml` が存在する
- [ ] 出力先のディレクトリは自動作成される

## コマンドライン引数

| 引数 | デフォルト値 | 説明 |
|------|------------|------|
| `--batch-size` | `100` | バッチあたりの投稿数 |
| `--raw-folder` | `raw/投稿` | 投稿XMLファイルが格納されたフォルダ |
| `--base-xml` | `wordpress-to-ghost-migration-files-20251017/xml/WordPress.2025-10-16.xml` | ベースXMLファイル（すべてのコンテンツ） |
| `--output-dir` | `batch-{SIZE}posts/xml` | 出力先ディレクトリ（自動で決定） |

## 実行例

### 100件バッチの場合

```
================================================================================
Create batch XML files (100 posts per batch)
================================================================================

Configuration:
  Raw folder:  raw/投稿
  Base XML:    wordpress-to-ghost-migration-files-20251017/xml/WordPress.2025-10-16.xml
  Output dir:  batch-100posts/xml
  Batch size:  100 posts

Collecting posts from raw/投稿...
  Found 127 XML files
    WordPress-001.xml: 75 posts (total: 75)
    WordPress-002.xml: 75 posts (total: 150)
    ...
    WordPress-127.xml: 47 posts (total: 9547)

  Total collected:
    Posts: 9547
    Authors: 5
    Categories: 213
    Tags: 1847

Extracting data from base XML...
  Base XML has:
    Authors: 5
    Categories: 85
    Tags: 950

Merging metadata...
  Merged authors: 5 existing + 0 new = 5
  Merged categories: 85 existing + 128 new = 213
  Merged tags: 950 existing + 897 new = 1847

Creating 96 batches (100 posts per batch)
Total posts: 9547

Creating batch 1: batch-100posts/xml/WordPress-batch-001-100posts.xml
  Posts: 100
  Created: batch-100posts/xml/WordPress-batch-001-100posts.xml

Creating batch 2: batch-100posts/xml/WordPress-batch-002-100posts.xml
  Posts: 100
  Created: batch-100posts/xml/WordPress-batch-002-100posts.xml

...

================================================================================
✓ Done!
  Created 96 XML files in batch-100posts/xml
================================================================================

Next step:
  Run convert_batch_to_json.sh to convert all XML files to Ghost JSON
```

## 処理の詳細

### 1. 投稿とメタデータの収集

```python
def collect_all_posts_from_raw_folder(raw_folder: Path) -> tuple:
    xml_files = sorted(raw_folder.glob('**/*.xml'))

    all_posts = []
    all_authors = {}      # author_id -> author_block
    all_categories = {}   # category_nicename -> category_block
    all_tags = {}         # tag_slug -> tag_block

    for xml_file in xml_files:
        posts = extract_items_from_xml(xml_file)
        all_posts.extend(posts)

        # 著者・カテゴリー・タグも抽出（重複排除）
        ...
```

### 2. ベースXMLからのメタデータ抽出

```python
base_authors = extract_authors_from_xml(base_xml)
base_categories = extract_categories_from_xml(base_xml)
base_tags = extract_tags_from_xml(base_xml)
```

### 3. メタデータのマージ

```python
def merge_authors(base_authors: list, new_authors: dict) -> list:
    """既存の著者を保持し、新しい著者のみ追加"""
    existing_ids = set()
    for author in base_authors:
        author_id_match = re.search(r'<wp:author_id>(\d+)</wp:author_id>', author)
        if author_id_match:
            existing_ids.add(author_id_match.group(1))

    merged_authors = base_authors.copy()
    for author_id, author_block in new_authors.items():
        if author_id not in existing_ids:
            merged_authors.append(author_block)

    return merged_authors
```

同様の処理をカテゴリーとタグにも適用します。

### 4. ベースXMLとのマージ処理

**ここがWordPress.2025-10-16.xmlとの結合処理です：**

```python
def create_merged_xml(base_xml: Path, posts: list, authors: list,
                      categories: list, tags: list, output_file: Path, batch_num: int):
    # 1. ベースXMLを読み込む
    with open(base_xml, 'r', encoding='utf-8') as f:
        base_content = f.read()

    # 2. エラーHTMLがあれば除去
    base_content = clean_base_xml(base_content)

    # 3. 既存の著者・カテゴリー・タグを削除
    base_content = re.sub(r'\s*<wp:author>.*?</wp:author>', '', base_content, flags=re.DOTALL)
    base_content = re.sub(r'\s*<wp:category>.*?</wp:category>', '', base_content, flags=re.DOTALL)
    base_content = re.sub(r'\s*<wp:tag>.*?</wp:tag>', '', base_content, flags=re.DOTALL)

    # 4. メタデータを挿入する位置を検索（</image> の直後）
    image_end_match = re.search(r'</image>', base_content)
    insert_metadata_pos = image_end_match.end()

    # 5. マージされた著者・カテゴリー・タグを挿入
    metadata_text = ''
    if authors:
        metadata_text += '\n\n\t\t' + '\n\t'.join(authors)
    if categories:
        metadata_text += '\n\t' + '\n\t'.join(categories)
    if tags:
        metadata_text += '\n\t' + '\n\t'.join(tags)

    base_content = base_content[:insert_metadata_pos] + metadata_text + '\n' + base_content[insert_metadata_pos:]

    # 6. 投稿を挿入（</channel> の直前）
    channel_end_match = re.search(r'</channel>', base_content)
    insert_pos = channel_end_match.start()

    posts_text = '\n\t'.join(posts)
    new_content = base_content[:insert_pos] + '\n\t' + posts_text + '\n\n' + base_content[insert_pos:]

    # 7. pubDate を現在時刻に更新
    current_date = datetime.now().strftime('%a, %d %b %Y %H:%M:%S +0000')
    new_content = re.sub(r'<pubDate>.*?</pubDate>', f'<pubDate>{current_date}</pubDate>',
                         new_content, count=1)

    # 8. ファイルに書き込み
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
```

**処理のポイント:**

1. **ベースXMLの読み込み**: WordPress.2025-10-16.xml をテンプレートとして使用
2. **既存メタデータの削除**: ベースXML内の著者・カテゴリー・タグを一度削除
3. **マージされたメタデータの挿入**: 重複排除されたメタデータを挿入
4. **投稿の挿入**: 100件の投稿を挿入
5. **日付の更新**: 現在時刻に更新

### 5. バッチ分割

```python
posts_per_batch = 100
num_batches = (total_posts + posts_per_batch - 1) // posts_per_batch

for i in range(num_batches):
    start_idx = i * posts_per_batch
    end_idx = min((i + 1) * posts_per_batch, total_posts)
    batch_posts = all_posts[start_idx:end_idx]

    output_file = output_dir / f'WordPress-batch-{i+1:03d}-100posts.xml'
    create_merged_xml(base_xml, batch_posts, merged_authors,
                      merged_categories, merged_tags, output_file, i+1)
```

## バッチサイズの選び方

| バッチサイズ | 適用ケース | ファイルサイズ | インポート時間/バッチ | バッチ数（10,000投稿） |
|------------|----------|--------------|-------------------|-------------------|
| 50件 | タイムアウトが頻発する環境 | ~45 MB | 30秒-1分 | 200バッチ |
| **100件** | **推奨（デフォルト）** | **~90 MB** | **1-2分** | **100バッチ** |
| 200件 | 安定した高速環境 | ~180 MB | 2-4分 | 50バッチ |
| 500件 | 大量データを高速処理 | ~450 MB | 5-10分 | 20バッチ |

**推奨**: まずはデフォルトの100件で試し、環境に応じて調整してください。

## 使用例

### ケース1: 標準的な移行（100件バッチ）

```bash
# デフォルト設定で実行
python3 scripts/create_batch_xmls.py
```

### ケース2: 大量データの高速処理（500件バッチ）

```bash
# 500件ずつに分割して、バッチ数を減らす
python3 scripts/create_batch_xmls.py --batch-size 500
```

### ケース3: タイムアウト対策（50件バッチ）

```bash
# Ghost インポートでタイムアウトが発生する場合
python3 scripts/create_batch_xmls.py --batch-size 50
```

### ケース4: カスタムディレクトリ構成

```bash
# プロジェクト構成が異なる場合
python3 scripts/create_batch_xmls.py \
  --raw-folder data/wordpress-exports \
  --base-xml data/base/all-content.xml \
  --output-dir output/batches \
  --batch-size 100
```

## 注意事項

1. **ベースXMLの必要性**
   - ベースXMLがないと実行できません
   - WordPress管理画面から「すべてのコンテンツ」をエクスポートして取得

2. **メモリ使用量**
   - すべての投稿とメタデータをメモリに読み込みます
   - 10,000件以上の投稿がある場合、数GB のメモリが必要

3. **ファイルサイズ**
   - 各バッチファイルは約90MB（100件の場合）
   - すべてのカテゴリー・タグを含むため、メタデータのサイズが大きい

4. **エラーHTMLの除去**
   - ベースXMLに `<!DOCTYPE html>` エラーが含まれている場合、自動的に除去されます

## 次のステップ

生成されたバッチXMLファイルをGhost JSONに変換します：

```bash
# 個別変換
python3 scripts/convert/convert_sample_xml_to_json.py \
  batch-100posts/xml/WordPress-batch-001-100posts.xml

# 一括変換
bash scripts/convert_batch_to_json.sh
```

## 関連スクリプト

- **split_raw_xmls.py**: 元のXMLファイルを2000件ずつに分割
- **convert_sample_xml_to_json.py**: XMLをGhost JSON形式に変換
- **convert_batch_to_json.sh**: バッチファイルを一括でJSON変換
