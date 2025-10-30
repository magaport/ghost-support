# WordPress to Ghost マイグレーション マッピング仕様

このドキュメントは、WordPressのXMLデータをGhost JSONフォーマットに変換する際のマッピング仕様を定義します。

## 概要

- **入力**: WordPress XML Export ファイル
- **出力**: Ghost JSON Import ファイル
- **スクリプト**:
  - `convert_sample_xml_to_json.py` - 投稿の変換
  - `convert_wp_pages_to_json.py` - 固定ページの変換

## カテゴリーのマッピング

WordPressのカテゴリーは、Ghostの**タグ**と**ページ**の両方にマッピングされます。

### XML構造

```xml
<wp:category>
  <wp:term_id>23</wp:term_id>
  <wp:category_nicename><![CDATA[voce-kodansha]]></wp:category_nicename>
  <wp:category_parent><![CDATA[women-magazine]]></wp:category_parent>
  <wp:cat_name><![CDATA[VOCE（ヴォーチェ）の付録]]></wp:cat_name>
  <wp:category_description><![CDATA[説明文...]]></wp:category_description>
  <wp:termmeta>
    <wp:meta_key><![CDATA[productid]]></wp:meta_key>
    <wp:meta_value><![CDATA[12804077]]></wp:meta_value>
  </wp:termmeta>
</wp:category>
```

### マッピング詳細

| WordPress フィールド | Ghost テーブル | Ghost フィールド | 処理内容 |
|-------------------|--------------|----------------|---------|
| `wp:term_id` | - | - | 抽出のみ（将来の拡張用） |
| `wp:category_nicename` | `tags` | `slug` | そのまま使用 |
| `wp:category_nicename` | `posts` (type=page) | `slug` | `category-{parent}-{slug}` または `category-{slug}` 形式 |
| `wp:cat_name` | `tags` | `name` | そのまま使用 |
| `wp:cat_name` | `posts` (type=page) | `title` | そのまま使用 |
| `wp:category_parent` | - | - | ページslug生成に使用 |
| `wp:category_description` | `posts` (type=page) | `html` | `<p>タグ`でラップ |
| `wp:category_description` | `posts` (type=page) | `plaintext` | そのまま使用 |
| `wp:category_description` | `posts` (type=page) | `lexical` | Lexical JSON形式に変換 |
| `productid` (termmeta) | `posts` (type=page) | `custom_excerpt` | `{"product_id": "12804077"}` 形式のJSON文字列 |
| `productid` (termmeta) | `posts` (type=page) | `feature_image` | `https://img.fujisan.co.jp/images/products/{product_id}_p.jpg` |

### 例

#### 入力 (WordPress XML)
```xml
<wp:category>
  <wp:term_id>23</wp:term_id>
  <wp:category_nicename><![CDATA[voce-kodansha]]></wp:category_nicename>
  <wp:category_parent><![CDATA[women-magazine]]></wp:category_parent>
  <wp:cat_name><![CDATA[VOCE（ヴォーチェ）の付録]]></wp:cat_name>
  <wp:category_description><![CDATA[VOCE（ヴォーチェ）はアラサー世代...]]></wp:category_description>
  <wp:termmeta>
    <wp:meta_key><![CDATA[productid]]></wp:meta_key>
    <wp:meta_value><![CDATA[12804077]]></wp:meta_value>
  </wp:termmeta>
</wp:category>
```

#### 出力 (Ghost JSON - Page)
```json
{
  "id": "f9e3020ab6022dca20679b4a",
  "uuid": "af67fed9-1f10-4450-8cd7-5c7fa7384bee",
  "title": "VOCE（ヴォーチェ）の付録",
  "slug": "category-women-magazine-voce-kodansha",
  "type": "page",
  "status": "published",
  "html": "<p>VOCE（ヴォーチェ）はアラサー世代...</p>",
  "plaintext": "VOCE（ヴォーチェ）はアラサー世代...",
  "lexical": "{\"root\": {...}}",
  "feature_image": "https://img.fujisan.co.jp/images/products/12804077_p.jpg",
  "custom_excerpt": "{\"product_id\": \"12804077\"}"
}
```

#### 出力 (Ghost JSON - Tag)
```json
{
  "id": "abc123...",
  "slug": "voce-kodansha",
  "name": "VOCE（ヴォーチェ）の付録"
}
```

## タグのマッピング

WordPressのタグは、Ghostの**タグ**と**ページ**の両方にマッピングされます。**すべてのタグに対して1つのページが作成されます**（説明文の有無に関わらず）。

### XML構造

```xml
<wp:tag>
  <wp:term_id>298</wp:term_id>
  <wp:tag_slug><![CDATA[x-girl]]></wp:tag_slug>
  <wp:tag_name><![CDATA[X-girl]]></wp:tag_name>
  <wp:tag_description><![CDATA[X-girlは、1994年にブランドが誕生...]]></wp:tag_description>
</wp:tag>
```

### マッピング詳細

| WordPress フィールド | Ghost テーブル | Ghost フィールド | 処理内容 |
|-------------------|--------------|----------------|---------|
| `wp:term_id` | - | - | 抽出のみ（将来の拡張用） |
| `wp:tag_slug` | `tags` | `slug` | URLデコード後に使用 |
| `wp:tag_slug` | `posts` (type=page) | `slug` | `tag-{slug}` 形式（全タグ対象） |
| `wp:tag_name` | `tags` | `name` | そのまま使用 |
| `wp:tag_name` | `posts` (type=page) | `title` | そのまま使用（全タグ対象） |
| `wp:tag_description` | `posts` (type=page) | `html` | `<p>タグ`でラップ（説明文がある場合）、なければ空文字 |
| `wp:tag_description` | `posts` (type=page) | `plaintext` | そのまま使用（説明文がある場合）、なければ空文字 |
| `wp:tag_description` | `posts` (type=page) | `lexical` | Lexical JSON形式に変換（全タグ対象） |

### 例

#### 入力 (WordPress XML)
```xml
<wp:tag>
  <wp:term_id>831</wp:term_id>
  <wp:tag_slug><![CDATA[x-girl]]></wp:tag_slug>
  <wp:tag_name><![CDATA[X-girl]]></wp:tag_name>
  <wp:tag_description><![CDATA[X-girlは、1994年にブランドが誕生しています...]]></wp:tag_description>
</wp:tag>
```

#### 出力 (Ghost JSON - Tag)
```json
{
  "id": "def456...",
  "slug": "x-girl",
  "name": "X-girl"
}
```

#### 出力 (Ghost JSON - Page) ※全タグに対して作成
```json
{
  "id": "ghi789...",
  "uuid": "...",
  "title": "X-girl",
  "slug": "tag-x-girl",
  "type": "page",
  "status": "published",
  "html": "<p>X-girlは、1994年にブランドが誕生しています...</p>",
  "plaintext": "X-girlは、1994年にブランドが誕生しています...",
  "lexical": "{\"root\": {...}}",
  "feature_image": null,
  "custom_excerpt": null
}
```

## 投稿のマッピング

WordPressの投稿は、Ghostの**投稿**にマッピングされます。

### 主な処理

1. **スラッグの修正**: `-postid` サフィックスの削除、180文字制限
2. **内部タグの追加**: `opening` カスタムフィールドの値に基づいて自動追加
   - `before` → `#発売予告` (slug: `hash-before`)
   - `after` → `#開封レビュー` (slug: `hash-after`)
   - `other` → `#その他` (slug: `hash-other`)
3. **重複スラッグのチェック**: 重複があれば post_id を追加して一意性を確保

## 親カテゴリータグ

事前定義された親カテゴリーは、`description` フィールド付きのタグとして追加されます。

### 親カテゴリー一覧

| slug | name | description |
|------|------|-------------|
| `brandmook` | ブランドムック | 本が売れないといわれるこの時代に... |
| `women-magazine` | 女性ファッション雑誌 | 女性向けファッション雑誌はJS（女子小学生）から... |
| `women-manga` | 少女・女性マンガの付録 | (空文字) |
| `child-magazine` | 子供・児童学習 雑誌 | (空文字) |
| `mother-magazine` | ママ・主婦雑誌 | (空文字) |
| `wedding-magazine` | 結婚情報誌 | (空文字) |
| `men-magazine` | メンズファッション雑誌 | (空文字) |
| `outdoor-magazine` | アウトドア雑誌 | (空文字) |
| `other-magazine` | その他雑誌 | (空文字) |
| `entertainment` | エンタメ | (空文字) |
| `uncategorized` | Uncategorized | (空文字) |

## 出力ファイル形式

### ファイル名

```
ghost_import_sample_5posts_YYYYMMDD_HHMMSS.json
```

例: `ghost_import_sample_5posts_20251020_165007.json`

### JSON構造

```json
{
  "db": [{
    "meta": {
      "exported_on": 1760946607725,
      "version": "5.96.0"
    },
    "data": {
      "posts": [...],     // 投稿とページ
      "tags": [...],      // タグ
      "posts_tags": [...], // 投稿とタグの関連
      "users": [...]      // ユーザー
    }
  }]
}
```

## 注意事項

1. **product_id が 0 の場合**: `feature_image` と `custom_excerpt` は null になります
2. **タグとページの対応**: **すべてのタグに対して1つのページが作成されます**（説明文の有無に関わらず）
3. **カテゴリーの親子関係**: ページの slug に反映されますが、Ghost の tags テーブルには親子関係は保存されません
4. **URL デコード**: タグの slug は URL エンコードされている場合があるため、デコードしてから使用します
5. **Lexical 形式**: Ghost 5.x 以降で使用される新しいエディタ形式に対応しています
6. **タグページの説明文**: 説明文がない場合、html、plaintext、lexical は空文字またはデフォルト値になります

## 統計情報

スクリプト実行後、以下の統計情報が表示されます：

- 投稿数
- ページ数（カテゴリーページ、タグページ）
- タグ数
- 投稿-タグ関連数
- ユーザー数
- アイキャッチ画像付き投稿数
- タグ分布
- ユーザー別投稿数

## 固定ページ（Pages）のマッピング

WordPress の固定ページは、Ghost のページ（`type: 'page'`）にマッピングされます。

### XML構造

```xml
<item>
  <wp:post_id>10</wp:post_id>
  <title><![CDATA[お問い合わせ]]></title>
  <wp:post_name><![CDATA[contact]]></wp:post_name>
  <wp:post_type><![CDATA[page]]></wp:post_type>
  <wp:status><![CDATA[publish]]></wp:status>
  <wp:post_date><![CDATA[2024-01-15 10:30:00]]></wp:post_date>
  <content:encoded><![CDATA[<p>お問い合わせ内容...</p>]]></content:encoded>
  <dc:creator><![CDATA[admin]]></dc:creator>
</item>
```

### マッピング詳細

| WordPress フィールド | Ghost フィールド | 処理内容 |
|-------------------|----------------|---------|
| `<wp:post_id>` | `custom_excerpt` | JSON形式: `{"wp_page_id": "10"}` |
| `<title>` | `title` | そのまま使用 |
| `<wp:post_name>` | `slug` | そのまま使用（空なら `page-{id}`） |
| `<content:encoded>` | `html` | そのまま使用 |
| `<content:encoded>` | `plaintext` | HTMLタグを除去 |
| `<content:encoded>` | `lexical` | Lexical JSON形式に変換 |
| `<wp:status>` | `status` | `publish`→`published`, `draft`→`draft`, `private`→`draft` |
| `<wp:post_date>` | `created_at`, `updated_at` | ISO 8601形式 |
| `<wp:post_date>` | `published_at` | ステータスが `published` の場合のみ |
| `<dc:creator>` | `posts_authors.author_id` | 著者slugから著者IDにマッピング |

### 固定ページの特徴

1. **タグなし**: 固定ページにはタグが設定されません
2. **カテゴリーなし**: 固定ページにはカテゴリーが設定されません
3. **シンプルな構造**: タイトル、本文、著者のみ
4. **ステータス変換**: `private` は `draft` に変換（Ghost に private ステータスがないため）

### 例

#### 入力 (WordPress XML)

```xml
<item>
  <wp:post_id>12</wp:post_id>
  <title><![CDATA[プライバシーポリシー]]></title>
  <wp:post_name><![CDATA[privacy-policy]]></wp:post_name>
  <wp:post_type><![CDATA[page]]></wp:post_type>
  <wp:status><![CDATA[publish]]></wp:status>
  <wp:post_date><![CDATA[2024-01-20 14:00:00]]></wp:post_date>
  <content:encoded><![CDATA[<p>当サイトは個人情報を...</p>]]></content:encoded>
  <dc:creator><![CDATA[admin]]></dc:creator>
</item>
```

#### 出力 (Ghost JSON)

```json
{
  "id": "abc123def456...",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "プライバシーポリシー",
  "slug": "privacy-policy",
  "type": "page",
  "status": "published",
  "html": "<p>当サイトは個人情報を...</p>",
  "plaintext": "当サイトは個人情報を...",
  "lexical": "{\"root\": {...}}",
  "custom_excerpt": "{\"wp_page_id\": \"12\"}",
  "created_at": "2024-01-20T14:00:00.000Z",
  "updated_at": "2024-01-20T14:00:00.000Z",
  "published_at": "2024-01-20T14:00:00.000Z",
  "visibility": "public",
  "feature_image": null,
  "featured": 0
}
```

---

## スクリプト別の処理対象

### convert_sample_xml_to_json.py（投稿用）

**処理対象**:
- 投稿（`<wp:post_type>post</wp:post_type>`）
- カテゴリー（タグとページに変換）
- タグ（タグとページに変換）
- 著者

**出力**:
- 投稿
- タグ
- カテゴリーページ
- タグページ
- 著者
- 投稿-タグ関連
- 投稿-著者関連

### convert_wp_pages_to_json.py（固定ページ用）

**処理対象**:
- 固定ページ（`<wp:post_type>page</wp:post_type>`）
- 著者

**出力**:
- 固定ページ
- 著者
- ページ-著者関連

**処理しないもの**:
- 投稿
- カテゴリー
- タグ

---

## 関連ファイル

- **投稿変換**: `scripts/convert/convert_sample_xml_to_json.py`
- **固定ページ変換**: `scripts/convert/convert_wp_pages_to_json.py`
- **バッチ生成**: `scripts/create_batch_xmls.py`
- **サンプル入力**: `sampleData/WordPress-sample-5posts.xml`
- **出力ディレクトリ**: `output/`