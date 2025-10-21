#!/usr/bin/env python3
"""
Convert WordPress-sample-5posts.xml to Ghost JSON
Applies the same fixes as fix_and_merge_xml.py:
1. Fix post slugs (remove -postid suffix, limit length)
2. Add internal tags based on opening field
"""

import re
import json
import secrets
from pathlib import Path
from datetime import datetime

def generate_object_id():
    """Generate 24-character hex ID (MongoDB ObjectId format)"""
    return secrets.token_hex(12)

def generate_uuid():
    """Generate UUID v4"""
    import uuid
    return str(uuid.uuid4())

def generate_slug_from_title(title: str, post_id: str, max_length: int = 150) -> str:
    """Generate slug from title (same as fix_and_merge_xml.py)"""
    # Remove 【】brackets
    slug = re.sub(r'【[^】]*】', '', title)
    slug = slug.strip()

    # Replace whitespace with hyphen
    slug = re.sub(r'[　\s]+', '-', slug)

    # Remove special characters
    slug = re.sub(r'[!！?？。、，,.\(\)（）《》\[\]［］]', '', slug)

    # Remove multiple hyphens
    slug = re.sub(r'-+', '-', slug)

    # Truncate to max_length
    if len(slug) > max_length:
        slug = slug[:max_length].rstrip('-')

    # Add post ID for uniqueness
    slug = f"{slug}-{post_id}"

    # Ensure not too long
    if len(slug) > 180:
        slug = slug[:180].rstrip('-')

    return slug.lower().strip('-')

def fix_xml_item(item: str) -> str:
    """Fix a single XML item (same as fix_and_merge_xml.py)"""

    # 1. Fix post_name (slug) - remove -postid suffix and limit length
    post_id_match = re.search(r'<wp:post_id>(\d+)</wp:post_id>', item)
    if post_id_match:
        post_id = post_id_match.group(1)

        # Find post_name
        post_name_match = re.search(r'<wp:post_name><!\[CDATA\[(.*?)\]\]></wp:post_name>', item)
        if post_name_match:
            old_slug = post_name_match.group(1).strip()

            # If slug is empty, generate from title
            if not old_slug:
                title_match = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>', item)
                if title_match:
                    title = title_match.group(1)
                    new_slug = generate_slug_from_title(title, post_id)
                else:
                    # Fallback to post_id only
                    new_slug = f"post-{post_id}"
            else:
                # Remove -postid suffix
                new_slug = re.sub(r'-\d+$', '', old_slug)

                # Limit slug length to 180 characters (Ghost limit is 191, leave some margin)
                if len(new_slug) > 180:
                    # Truncate and remove trailing hyphen if any
                    new_slug = new_slug[:180].rstrip('-')
                    # Add post_id suffix for uniqueness when truncated
                    new_slug = f"{new_slug}-{post_id}"

            # Ensure slug doesn't end with hyphen
            new_slug = new_slug.rstrip('-')

            # Replace in item
            item = item.replace(
                f'<wp:post_name><![CDATA[{old_slug}]]></wp:post_name>',
                f'<wp:post_name><![CDATA[{new_slug}]]></wp:post_name>'
            )

    # 2. Add internal tags based on opening field
    opening_match = re.search(
        r'<wp:meta_key><!\[CDATA\[opening\]\]></wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(before|after|other)\]\]></wp:meta_value>',
        item,
        re.DOTALL
    )

    if opening_match:
        opening_value = opening_match.group(1)

        # Determine internal tag
        if opening_value == 'before':
            tag_slug = 'hash-before'
            tag_name = '#発売予告'
        elif opening_value == 'after':
            tag_slug = 'hash-after'
            tag_name = '#開封レビュー'
        else:
            tag_slug = 'hash-other'
            tag_name = '#その他'

        # Check if internal tag already exists
        if tag_slug not in item:
            # Find the last category tag and insert after it
            # Find the position of the last </category> tag
            category_tags = list(re.finditer(r'</category>', item))
            if category_tags:
                last_category_pos = category_tags[-1].end()

                # Insert internal tag
                internal_tag = f'\n\t\t<category domain="post_tag" nicename="{tag_slug}"><![CDATA[{tag_name}]]></category>'
                item = item[:last_category_pos] + internal_tag + item[last_category_pos:]
            else:
                # No category tags, insert before </wp:postmeta>
                postmeta_match = re.search(r'<wp:postmeta>', item)
                if postmeta_match:
                    pos = postmeta_match.start()
                    internal_tag = f'\t\t<category domain="post_tag" nicename="{tag_slug}"><![CDATA[{tag_name}]]></category>\n\t\t'
                    item = item[:pos] + internal_tag + item[pos:]

    return item

def extract_posts_from_xml(xml_file):
    """Extract posts from XML file with correct slugs and tags
    Applies fixes from fix_and_merge_xml.py
    """

    print(f"  Reading {xml_file}...")

    with open(xml_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract authors
    authors_dict = {}
    author_sections = re.findall(r'<wp:author>.*?</wp:author>', content, re.DOTALL)

    print(f"  Found {len(author_sections)} authors")

    for author_section in author_sections:
        author_id = re.search(r'<wp:author_id>(\d+)</wp:author_id>', author_section)
        login = re.search(r'<wp:author_login><!\[CDATA\[(.*?)\]\]></wp:author_login>', author_section)
        email = re.search(r'<wp:author_email><!\[CDATA\[(.*?)\]\]></wp:author_email>', author_section)
        display_name = re.search(r'<wp:author_display_name><!\[CDATA\[(.*?)\]\]></wp:author_display_name>', author_section)

        if author_id and login:
            login_name = login.group(1)
            authors_dict[login_name] = {
                'wp_id': author_id.group(1),
                'slug': login_name,
                'name': display_name.group(1) if display_name else login_name,
                'email': email.group(1) if email else f'{login_name}@furoku.life'
            }
            print(f"    - {login_name} (ID: {author_id.group(1)})")

    # Build attachment map
    attachment_map = {}
    items = re.findall(r'<item>.*?</item>', content, re.DOTALL)

    for item in items:
        if '<wp:post_type><![CDATA[attachment]]></wp:post_type>' not in item:
            continue

        id_match = re.search(r'<wp:post_id>(\d+)</wp:post_id>', item)
        url_match = re.search(r'<wp:attachment_url><!\[CDATA\[(.*?)\]\]></wp:attachment_url>', item)

        if id_match and url_match:
            attachment_map[id_match.group(1)] = url_match.group(1)

    print(f"  Found {len(attachment_map)} attachments")

    # Extract posts
    posts = []
    tags_set = set()  # (slug, name)
    fixed_items = []  # Store fixed items for slug deduplication
    post_author_mapping = {}  # wp_post_id -> author_login (for SQL generation)

    for item in items:
        # Only posts
        if '<wp:post_type><![CDATA[post]]></wp:post_type>' not in item:
            continue

        # Apply fixes (slug fix and internal tag addition)
        item = fix_xml_item(item)
        fixed_items.append(item)

        post = {}

        # Post ID
        post_id_match = re.search(r'<wp:post_id>(\d+)</wp:post_id>', item)
        if not post_id_match:
            continue
        wp_post_id = post_id_match.group(1)

        # Generate Ghost ID
        post['id'] = generate_object_id()
        post['uuid'] = generate_uuid()

        # Title
        title_match = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>', item)
        post['title'] = title_match.group(1) if title_match else f'投稿 {wp_post_id}'

        # Slug
        slug_match = re.search(r'<wp:post_name><!\[CDATA\[(.*?)\]\]></wp:post_name>', item)
        post['slug'] = slug_match.group(1) if slug_match else f'post-{wp_post_id}'

        # Content
        content_match = re.search(r'<content:encoded><!\[CDATA\[(.*?)\]\]></content:encoded>', item, re.DOTALL)
        post['html'] = content_match.group(1) if content_match else ''

        # Feature image from _thumbnail_id
        thumbnail_match = re.search(
            r'<wp:meta_key><!\[CDATA\[_thumbnail_id\]\]></wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(\d+)\]\]></wp:meta_value>',
            item
        )
        if thumbnail_match:
            thumbnail_id = thumbnail_match.group(1)
            if thumbnail_id in attachment_map:
                post['feature_image'] = attachment_map[thumbnail_id]

        # If no thumbnail, extract first image from content
        if 'feature_image' not in post and post['html']:
            img_match = re.search(r'<img[^>]+src="([^"]+)"', post['html'])
            if img_match:
                post['feature_image'] = img_match.group(1)

        # Status
        status_match = re.search(r'<wp:status><!\[CDATA\[(.*?)\]\]></wp:status>', item)
        if status_match and status_match.group(1) == 'publish':
            post['status'] = 'published'
        else:
            post['status'] = 'draft'

        # Dates
        pub_date_match = re.search(r'<wp:post_date><!\[CDATA\[(.*?)\]\]></wp:post_date>', item)
        if pub_date_match:
            date_str = pub_date_match.group(1)
            # Convert to ISO format
            try:
                dt = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
                iso_date = dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
                post['created_at'] = iso_date
                if post['status'] == 'published':
                    post['published_at'] = iso_date
            except:
                pass

        # Type and visibility
        post['type'] = 'post'
        post['visibility'] = 'public'

        # Author - Extract author for posts_authors mapping
        # Note: author_id is deprecated, we use posts_authors table instead
        # But we still set created_by, updated_by, published_by for audit trail
        creator_match = re.search(r'<dc:creator><!\[CDATA\[(.*?)\]\]></dc:creator>', item)
        author_wp_id = '1'  # Default to owner (ID: '1') if author not found
        author_login = 'owner'  # Default author login
        if creator_match:
            author_login = creator_match.group(1)
            if author_login in authors_dict:
                author_wp_id = str(authors_dict[author_login]['wp_id'])

        # Store mapping for SQL generation (wp_post_id -> author_login)
        post_author_mapping[wp_post_id] = author_login

        # Store author_id temporarily for posts_authors table generation
        post['_author_id_temp'] = author_wp_id

        # Set audit fields (these are separate from post authors)
        post['created_by'] = author_wp_id
        post['updated_by'] = author_wp_id
        post['published_by'] = author_wp_id

        # Extract custom post meta fields
        post_meta = {}

        # Amazon ASIN code
        asin_match = re.search(
            r'<wp:meta_key><!\[CDATA\[asin\]\]></wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(.*?)\]\]></wp:meta_value>',
            item,
            re.DOTALL
        )
        if asin_match and asin_match.group(1):
            post_meta['amazon_code'] = asin_match.group(1)

        # Published date (release date)
        published_date_match = re.search(
            r'<wp:meta_key><!\[CDATA\[published-date\]\]></wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(.*?)\]\]></wp:meta_value>',
            item,
            re.DOTALL
        )
        if published_date_match and published_date_match.group(1):
            post_meta['release_date'] = published_date_match.group(1)

        # Magazine title
        furoku_title_match = re.search(
            r'<wp:meta_key><!\[CDATA\[title\]\]></wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(.*?)\]\]></wp:meta_value>',
            item,
            re.DOTALL
        )
        if furoku_title_match and furoku_title_match.group(1):
            post_meta['furoku_title'] = furoku_title_match.group(1)

        # Lead text (furoku description)
        lead_text_match = re.search(
            r'<wp:meta_key><!\[CDATA\[lead-text\]\]></wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(.*?)\]\]></wp:meta_value>',
            item,
            re.DOTALL
        )
        if lead_text_match and lead_text_match.group(1):
            post_meta['furoku_lead_text'] = lead_text_match.group(1)

        # SEO Title
        seo_title_match = re.search(
            r'<wp:meta_key><!\[CDATA\[sng_title\]\]></wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(.*?)\]\]></wp:meta_value>',
            item,
            re.DOTALL
        )
        if seo_title_match and seo_title_match.group(1):
            post['meta_title'] = seo_title_match.group(1)

        # SEO Meta Description
        seo_desc_match = re.search(
            r'<wp:meta_key><!\[CDATA\[sng_meta_description\]\]></wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(.*?)\]\]></wp:meta_value>',
            item,
            re.DOTALL
        )
        if seo_desc_match and seo_desc_match.group(1):
            post['meta_description'] = seo_desc_match.group(1)

        # Set custom_excerpt with WordPress post ID for SQL mapping
        # This allows us to fix posts_authors after import
        post['custom_excerpt'] = f'wp_post_id:{wp_post_id}'

        # Store post meta separately if needed
        if post_meta:
            post['_post_meta_temp'] = post_meta  # Temporary field for later use

        # Extract tags and categories
        post_tags = re.findall(r'<category domain="post_tag" nicename="([^"]+)"><!\[CDATA\[([^\]]+)\]\]></category>', item)
        categories = re.findall(r'<category domain="category" nicename="([^"]+)"><!\[CDATA\[([^\]]+)\]\]></category>', item)

        # Store tag info
        post['_tags'] = []  # Temporary field

        for slug, name in post_tags:
            tags_set.add((slug, name))
            post['_tags'].append(slug)

        for slug, name in categories:
            tags_set.add((slug, name))
            post['_tags'].append(slug)

        meta_info = f" [meta: {len(post_meta)} fields]" if post_meta else ""
        print(f"    Post {wp_post_id}: {post['title'][:50]}... ({len(post_tags)} tags, {len(categories)} categories){meta_info}")

        posts.append(post)

    # Check for duplicate slugs
    print(f"\n  Checking for duplicate slugs...")
    slug_to_posts = {}
    slug_changes = []

    for i, (item, post) in enumerate(zip(fixed_items, posts)):
        slug = post['slug']
        post_id_match = re.search(r'<wp:post_id>(\d+)</wp:post_id>', item)
        if not post_id_match:
            continue
        post_id = post_id_match.group(1)

        if slug in slug_to_posts:
            # Duplicate found - add post_id to make it unique
            old_slug = slug
            new_slug = f"{slug}-{post_id}"
            posts[i]['slug'] = new_slug
            slug_changes.append(f"    {old_slug} -> {new_slug} (Post ID: {post_id})")
            slug_to_posts[new_slug] = post_id
        else:
            slug_to_posts[slug] = post_id

    if slug_changes:
        print(f"  Found {len(slug_changes)} duplicate slugs (fixed):")
        for change in slug_changes:
            print(change)
    else:
        print(f"  No duplicate slugs found")

    return {
        'posts': posts,
        'tags_set': tags_set,
        'authors_dict': authors_dict,
        'post_author_mapping': post_author_mapping
    }

def get_parent_category_tags():
    """Get parent category tags (same as create_parent_category_tags_safe.sql)
    Returns metadata without IDs - IDs will be generated dynamically
    """
    return {
        'brandmook': {
            'name': 'ブランドムック',
            'description': '本が売れないといわれるこの時代に、女性に愛され続け、変わらぬ快進撃を続ける雑誌があります。その雑誌の名は「ブランドムック」。'
        },
        'women-magazine': {
            'name': '女性ファッション雑誌',
            'description': '女性向けファッション雑誌はJS（女子小学生）から熟年50代向けまで読者年齢に幅広さがあります。'
        },
        'women-manga': {
            'name': '少女・女性マンガの付録',
            'description': ''
        },
        'child-magazine': {
            'name': '子供・児童学習 雑誌',
            'description': ''
        },
        'mother-magazine': {
            'name': 'ママ・主婦雑誌',
            'description': ''
        },
        'wedding-magazine': {
            'name': '結婚情報誌',
            'description': ''
        },
        'men-magazine': {
            'name': 'メンズファッション雑誌',
            'description': ''
        },
        'outdoor-magazine': {
            'name': 'アウトドア雑誌',
            'description': ''
        },
        'other-magazine': {
            'name': 'その他雑誌',
            'description': ''
        },
        'entertainment': {
            'name': 'エンタメ',
            'description': ''
        },
        'uncategorized': {
            'name': 'Uncategorized',
            'description': ''
        }
    }

def text_to_lexical_json(text: str) -> str:
    """Convert plain text to Ghost Lexical JSON format"""
    lexical_obj = {
        "root": {
            "children": [{
                "children": [{
                    "detail": 0,
                    "format": 0,
                    "mode": "normal",
                    "style": "",
                    "text": text,
                    "type": "extended-text",
                    "version": 1
                }],
                "direction": "ltr",
                "format": "",
                "indent": 0,
                "type": "paragraph",
                "version": 1
            }],
            "direction": "ltr",
            "format": "",
            "indent": 0,
            "type": "root",
            "version": 1
        }
    }
    return json.dumps(lexical_obj, ensure_ascii=False)

def extract_tags_from_xml(xml_content: str) -> list:
    """Extract tag definitions from WordPress XML"""
    tags = []

    # Find all wp:tag blocks
    tag_pattern = r'<wp:tag>(.*?)</wp:tag>'
    tag_blocks = re.findall(tag_pattern, xml_content, re.DOTALL)

    for block in tag_blocks:
        term_id_match = re.search(r'<wp:term_id>(\d+)</wp:term_id>', block)
        slug_match = re.search(r'<wp:tag_slug><!\[CDATA\[(.*?)\]\]>', block)
        name_match = re.search(r'<wp:tag_name><!\[CDATA\[(.*?)\]\]>', block)
        desc_match = re.search(r'<wp:tag_description><!\[CDATA\[(.*?)\]\]>', block, re.DOTALL)

        if slug_match and name_match:
            # URL decode slug
            import urllib.parse
            decoded_slug = urllib.parse.unquote(slug_match.group(1))

            tag_data = {
                'term_id': term_id_match.group(1) if term_id_match else None,
                'slug': decoded_slug,
                'name': name_match.group(1),
                'description': desc_match.group(1) if desc_match else ''
            }
            tags.append(tag_data)

    return tags

def extract_categories_from_xml(xml_content: str) -> list:
    """Extract category definitions from WordPress XML"""
    categories = []

    # Find all wp:category blocks
    cat_pattern = r'<wp:category>(.*?)</wp:category>'
    cat_blocks = re.findall(cat_pattern, xml_content, re.DOTALL)

    for block in cat_blocks:
        term_id_match = re.search(r'<wp:term_id>(\d+)</wp:term_id>', block)
        slug_match = re.search(r'<wp:category_nicename><!\[CDATA\[(.*?)\]\]>', block)
        name_match = re.search(r'<wp:cat_name><!\[CDATA\[(.*?)\]\]>', block)
        parent_match = re.search(r'<wp:category_parent><!\[CDATA\[(.*?)\]\]>', block)
        desc_match = re.search(r'<wp:category_description><!\[CDATA\[(.*?)\]\]>', block, re.DOTALL)

        # Extract productid from termmeta
        productid_match = re.search(
            r'<wp:meta_key><!\[CDATA\[productid\]\]></wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(\d+)\]\]></wp:meta_value>',
            block,
            re.DOTALL
        )

        if slug_match and name_match:
            cat_data = {
                'term_id': term_id_match.group(1) if term_id_match else None,
                'slug': slug_match.group(1),
                'name': name_match.group(1),
                'parent': parent_match.group(1) if parent_match else '',
                'description': desc_match.group(1) if desc_match else '',
                'product_id': productid_match.group(1) if productid_match and productid_match.group(1) != '0' else None
            }
            categories.append(cat_data)

    return categories

def create_tag_pages(tags: list) -> list:
    """Create Ghost pages for all WordPress tags"""
    pages = []

    for tag in tags:
        page_id = generate_object_id()
        page_uuid = generate_uuid()
        page_slug = f"tag-{tag['slug']}"

        # Use description if available, otherwise empty
        description = tag.get('description', '')

        # Convert description to HTML (simple paragraph wrap)
        html = f"<p>{description}</p>" if description else ""
        plaintext = description
        lexical = text_to_lexical_json(description)

        page = {
            'id': page_id,
            'uuid': page_uuid,
            'title': tag['name'],
            'slug': page_slug,
            'mobiledoc': None,
            'lexical': lexical,
            'html': html,
            'comment_id': page_id,
            'plaintext': plaintext,
            'feature_image': None,
            'featured': 0,
            'type': 'page',
            'status': 'published',
            'locale': None,
            'visibility': 'public',
            'email_recipient_filter': 'none',
            'created_at': int(datetime.now().timestamp() * 1000),
            'updated_at': int(datetime.now().timestamp() * 1000),
            'published_at': int(datetime.now().timestamp() * 1000),
            'custom_excerpt': None,
            'codeinjection_head': None,
            'codeinjection_foot': None,
            'custom_template': None,
            'canonical_url': None,
            'newsletter_id': None,
            'show_title_and_feature_image': 1,
            '_author_id_temp': '1',  # For posts_authors mapping
            'created_by': '1',
            'updated_by': '1',
            'published_by': '1'
        }

        pages.append(page)

    return pages

def create_category_page_slug(category_slug: str, parent_slug: str = '') -> str:
    """Generate Ghost page slug for a category"""
    if parent_slug:
        return f"category-{parent_slug}-{category_slug}"
    else:
        return f"category-{category_slug}"

def create_category_pages(categories: list) -> list:
    """Create Ghost pages for WordPress categories"""
    pages = []

    for cat in categories:
        page_id = generate_object_id()
        page_uuid = generate_uuid()
        page_slug = create_category_page_slug(cat['slug'], cat['parent'])

        # Convert description to HTML (simple paragraph wrap)
        html = f"<p>{cat['description']}</p>" if cat['description'] else ""
        plaintext = cat['description']
        lexical = text_to_lexical_json(cat['description'])

        # Set custom_excerpt with product_id if available
        custom_excerpt = None
        if cat.get('product_id'):
            custom_excerpt = json.dumps({'product_id': cat['product_id']}, ensure_ascii=False)

        # Set feature_image URL if product_id is available
        feature_image = None
        if cat.get('product_id'):
            feature_image = f"https://img.fujisan.co.jp/images/products/{cat['product_id']}_p.jpg"

        page = {
            'id': page_id,
            'uuid': page_uuid,
            'title': cat['name'],
            'slug': page_slug,
            'mobiledoc': None,
            'lexical': lexical,
            'html': html,
            'comment_id': page_id,
            'plaintext': plaintext,
            'feature_image': feature_image,
            'featured': 0,
            'type': 'page',
            'status': 'published',
            'locale': None,
            'visibility': 'public',
            'email_recipient_filter': 'none',
            'created_at': int(datetime.now().timestamp() * 1000),
            'updated_at': int(datetime.now().timestamp() * 1000),
            'published_at': int(datetime.now().timestamp() * 1000),
            'custom_excerpt': custom_excerpt,
            'codeinjection_head': None,
            'codeinjection_foot': None,
            'custom_template': None,
            'canonical_url': None,
            'newsletter_id': None,
            'show_title_and_feature_image': 1,
            '_author_id_temp': '1',  # For posts_authors mapping
            'created_by': '1',
            'updated_by': '1',
            'published_by': '1'
        }

        pages.append(page)

    return pages

def generate_fix_authors_sql(post_author_mapping: dict, authors_dict: dict, output_file: Path):
    """
    Generate SQL script to fix posts_authors table after import

    Args:
        post_author_mapping: {wp_post_id: author_login}
        authors_dict: {author_login: {wp_id, slug, name, email}}
        output_file: Path to output SQL file
    """
    print()
    print("="*80)
    print(f"Generating SQL script: {output_file}")
    print("="*80)

    sql_lines = [
        "-- Fix posts_authors mapping after Ghost import",
        "-- This script updates the posts_authors table to match WordPress author assignments",
        "-- Generated by convert_sample_xml_to_json.py",
        "",
        "-- WordPress post ID -> Author mapping:",
    ]

    # Add comment showing the mapping
    for wp_post_id, author_login in sorted(post_author_mapping.items(), key=lambda x: int(x[0])):
        author_info = authors_dict.get(author_login, {'slug': 'owner', 'name': 'Owner'})
        sql_lines.append(f"--   Post {wp_post_id}: {author_login} ({author_info['name']})")

    sql_lines.extend([
        "",
        "-- Update posts_authors table using custom_excerpt as the key",
        "UPDATE posts_authors pa",
        "INNER JOIN posts p ON pa.post_id = p.id",
        "INNER JOIN (",
    ])

    # Build UNION ALL statements for mapping
    union_statements = []
    for wp_post_id, author_login in sorted(post_author_mapping.items(), key=lambda x: int(x[0])):
        author_info = authors_dict.get(author_login, {'slug': 'owner'})
        author_slug = author_info['slug']
        wp_key = f'wp_post_id:{wp_post_id}'
        union_statements.append(f"    SELECT '{wp_key}' as wp_key, '{author_slug}' as author_slug")

    sql_lines.append("\n    UNION ALL\n".join(union_statements))

    sql_lines.extend([
        ") AS wp_mapping ON p.custom_excerpt = wp_mapping.wp_key",
        "INNER JOIN users u ON u.slug = wp_mapping.author_slug",
        "SET pa.author_id = u.id",
        "WHERE pa.author_id != u.id;",
        "",
        "-- Verification query (optional - run this to check the results):",
        "-- SELECT ",
        "--   p.custom_excerpt,",
        "--   p.title,",
        "--   u.name as author_name,",
        "--   u.email as author_email",
        "-- FROM posts p",
        "-- INNER JOIN posts_authors pa ON p.id = pa.post_id",
        "-- INNER JOIN users u ON pa.author_id = u.id",
        "-- WHERE p.custom_excerpt LIKE 'wp_post_id:%'",
        "-- ORDER BY p.custom_excerpt;",
    ])

    # Write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))

    print(f"  Generated SQL with {len(post_author_mapping)} post-author mappings")
    print(f"  SQL file: {output_file}")

def create_ghost_json_from_sample_xml(xml_file):
    """Create Ghost JSON from WordPress sample XML"""

    print("="*80)
    print(f"Converting {xml_file} to Ghost JSON")
    print("="*80)
    print()

    result = extract_posts_from_xml(xml_file)

    all_posts = result['posts']
    all_tags_set = result['tags_set']
    all_authors_dict = result['authors_dict']
    post_author_mapping = result['post_author_mapping']

    print()
    print("="*80)
    print(f"Total posts: {len(all_posts)}")
    print(f"Total unique tags: {len(all_tags_set)}")
    print(f"Total authors: {len(all_authors_dict)}")
    print("="*80)

    # Get parent category tags metadata
    parent_tags = get_parent_category_tags()

    # Collect parent category slugs used in data
    parent_slugs_used = set()

    # Read XML to find category parents
    print(f"\n  Analyzing parent categories...")
    with open(xml_file, 'r', encoding='utf-8') as f:
        xml_content = f.read()

    # Extract parent categories from XML
    parent_matches = re.findall(r'<wp:category_parent><!\[CDATA\[(.*?)\]\]></wp:category_parent>', xml_content)
    for parent_slug in parent_matches:
        if parent_slug and parent_slug in parent_tags:
            parent_slugs_used.add(parent_slug)

    # Also check if categories themselves are parent categories
    category_blocks = re.findall(r'<wp:category>.*?</wp:category>', xml_content, re.DOTALL)
    for block in category_blocks:
        nicename_match = re.search(r'<wp:category_nicename><!\[CDATA\[(.*?)\]\]>', block)
        if nicename_match:
            nicename = nicename_match.group(1)
            if nicename in parent_tags:
                parent_slugs_used.add(nicename)

    if parent_slugs_used:
        print(f"  Found {len(parent_slugs_used)} parent categories: {', '.join(sorted(parent_slugs_used))}")

    # Extract categories and create pages
    print(f"\n  Extracting categories for pages...")
    categories = extract_categories_from_xml(xml_content)
    category_pages = create_category_pages(categories)
    print(f"  Created {len(category_pages)} category pages")
    for page in category_pages:
        product_info = f" (product_id: {json.loads(page['custom_excerpt'])['product_id']})" if page.get('custom_excerpt') else ""
        print(f"    - {page['title']} (slug: {page['slug']}){product_info}")

    # Extract tags from XML to get descriptions
    print(f"\n  Extracting tags from XML...")
    tags_from_xml = extract_tags_from_xml(xml_content)
    tags_from_xml_dict = {tag['slug']: tag for tag in tags_from_xml}

    # Create tags list with Ghost IDs and collect all unique tags
    tags_list = []
    tag_slug_to_id = {}
    all_tag_data = {}  # slug -> {name, description}

    # Add parent category tags first (with dynamically generated IDs)
    for parent_slug in sorted(parent_slugs_used):
        if parent_slug in parent_tags:
            parent_tag = parent_tags[parent_slug]
            tag_id = generate_object_id()
            tag_data = {
                'id': tag_id,
                'slug': parent_slug,
                'name': parent_tag['name']
            }
            # Add description field (even if empty, to mark as parent tag)
            tag_data['description'] = parent_tag.get('description', '')
            tags_list.append(tag_data)
            tag_slug_to_id[parent_slug] = tag_id
            all_tag_data[parent_slug] = {
                'name': parent_tag['name'],
                'description': parent_tag.get('description', '')
            }
            print(f"    Added parent tag: {parent_slug} ({parent_tag['name']}) [ID: {tag_id}]")

    # Add regular tags
    for slug, name in sorted(all_tags_set):
        # Skip if already added as parent tag
        if slug in tag_slug_to_id:
            continue

        tag_id = generate_object_id()
        tags_list.append({
            'id': tag_id,
            'slug': slug,
            'name': name
        })
        tag_slug_to_id[slug] = tag_id

        # Store tag data with description from XML if available
        description = tags_from_xml_dict.get(slug, {}).get('description', '')
        all_tag_data[slug] = {
            'name': name,
            'description': description
        }

    # Create pages for all tags
    print(f"\n  Creating tag pages...")
    tag_pages = []
    for slug, tag_info in all_tag_data.items():
        page_id = generate_object_id()
        page_uuid = generate_uuid()
        page_slug = f"tag-{slug}"

        description = tag_info.get('description', '')
        html = f"<p>{description}</p>" if description else ""
        plaintext = description
        lexical = text_to_lexical_json(description)

        page = {
            'id': page_id,
            'uuid': page_uuid,
            'title': tag_info['name'],
            'slug': page_slug,
            'mobiledoc': None,
            'lexical': lexical,
            'html': html,
            'comment_id': page_id,
            'plaintext': plaintext,
            'feature_image': None,
            'featured': 0,
            'type': 'page',
            'status': 'published',
            'locale': None,
            'visibility': 'public',
            'email_recipient_filter': 'none',
            'created_at': int(datetime.now().timestamp() * 1000),
            'updated_at': int(datetime.now().timestamp() * 1000),
            'published_at': int(datetime.now().timestamp() * 1000),
            'custom_excerpt': None,
            'codeinjection_head': None,
            'codeinjection_foot': None,
            'custom_template': None,
            'canonical_url': None,
            'newsletter_id': None,
            'show_title_and_feature_image': 1,
            'created_by': 1,
            'updated_by': 1,
            'published_by': 1
        }
        tag_pages.append(page)

    tags_with_desc = sum(1 for p in tag_pages if p['plaintext'])
    print(f"  Created {len(tag_pages)} tag pages (description付き: {tags_with_desc}件)")
    for page in tag_pages[:5]:  # Show first 5 as sample
        desc_preview = page['plaintext'][:30] + "..." if len(page['plaintext']) > 30 else (page['plaintext'] or "(説明なし)")
        print(f"    - {page['title']} (slug: {page['slug']}) - {desc_preview}")
    if len(tag_pages) > 5:
        print(f"    ... and {len(tag_pages) - 5} more tag pages")

    # Build posts_tags relationships
    posts_tags = []
    for post in all_posts:
        for tag_slug in post.get('_tags', []):
            if tag_slug in tag_slug_to_id:
                posts_tags.append({
                    'post_id': post['id'],
                    'tag_id': tag_slug_to_id[tag_slug]
                })
        # Remove temporary field
        del post['_tags']

    # Build posts_authors relationships (required for Ghost to properly link authors)
    # According to Ghost docs, only post_id and author_id are required
    posts_authors = []
    for post in all_posts + category_pages + tag_pages:
        post_id = post['id']
        author_id = post.get('_author_id_temp', '1')  # Get from temporary field

        posts_authors.append({
            'post_id': post_id,
            'author_id': str(author_id)  # Ensure it's string
        })

        # Remove temporary field from post
        if '_author_id_temp' in post:
            del post['_author_id_temp']

    # Build posts_meta for SEO fields
    posts_meta = []
    for post in all_posts + category_pages + tag_pages:
        post_id = post['id']

        # Add meta_title if present
        if 'meta_title' in post and post['meta_title']:
            posts_meta.append({
                'post_id': post_id,
                'meta_title': post['meta_title']
            })
            # Remove from post dict as it should be in posts_meta
            del post['meta_title']

        # Add meta_description if present
        if 'meta_description' in post and post['meta_description']:
            posts_meta.append({
                'post_id': post_id,
                'meta_description': post['meta_description']
            })
            # Remove from post dict as it should be in posts_meta
            del post['meta_description']

    # Create users list
    users = []

    # Add Owner (ID: 1) as the first user - required by Ghost
    # This ensures that posts/pages with author_id: 1 can be properly imported
    users.append({
        'id': '1',
        'slug': 'owner',
        'name': 'Owner',
        'email': 'owner@furoku.life',
        'roles': ['Administrator']  # Owner role will be converted to Administrator by Ghost
    })

    # Add WordPress authors
    for author_info in all_authors_dict.values():
        users.append({
            'id': str(author_info['wp_id']),  # Convert to string
            'slug': author_info['slug'],
            'name': author_info['name'],
            'email': author_info['email'],
            'roles': ['Author']  # Default role for WordPress authors
        })

    # Combine posts, category pages, and tag pages
    all_posts_and_pages = all_posts + category_pages + tag_pages

    ghost_json = {
        "db": [{
            "meta": {
                "exported_on": int(datetime.now().timestamp() * 1000),
                "version": "6.0.6"
            },
            "data": {
                "posts": all_posts_and_pages,
                "tags": tags_list,
                "posts_tags": posts_tags,
                "posts_authors": posts_authors,
                "posts_meta": posts_meta,
                "users": users
            }
        }]
    }

    return {
        'ghost_json': ghost_json,
        'post_author_mapping': post_author_mapping,
        'authors_dict': all_authors_dict
    }

def main():
    print("="*80)
    print("Convert WordPress-sample-5posts.xml to Ghost JSON")
    print("="*80)
    print()

    xml_file = Path(__file__).parent / 'sampleData' / 'WordPress-sample-5posts.xml'

    if not xml_file.exists():
        print(f"ERROR: {xml_file} not found")
        return

    result = create_ghost_json_from_sample_xml(xml_file)
    ghost_json = result['ghost_json']
    post_author_mapping = result['post_author_mapping']
    authors_dict = result['authors_dict']

    # Save JSON file
    output_dir = Path(__file__).parent / 'output'
    output_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = output_dir / f'ghost_import_sample_5posts_{timestamp}.json'
    print()
    print(f"Writing to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(ghost_json, f, ensure_ascii=False, indent=2)

    # Generate SQL fix script
    sql_output_file = output_dir / f'fix_authors_{timestamp}.sql'
    generate_fix_authors_sql(post_author_mapping, authors_dict, sql_output_file)

    # Print stats
    data = ghost_json['db'][0]['data']

    # Separate posts and pages
    posts_only = [p for p in data['posts'] if p.get('type') == 'post']
    pages_only = [p for p in data['posts'] if p.get('type') == 'page']

    # Count category pages and tag pages
    category_pages_count = sum(1 for p in pages_only if p['slug'].startswith('category-'))
    tag_pages_count = sum(1 for p in pages_only if p['slug'].startswith('tag-'))

    print()
    print("="*80)
    print(f"✓ Files created:")
    print(f"  - Ghost JSON: {output_file}")
    print(f"  - SQL fix script: {sql_output_file}")
    print("="*80)
    print(f"Posts: {len(posts_only)}")
    print(f"Pages: {len(pages_only)} (category: {category_pages_count}, tag: {tag_pages_count})")
    print(f"Total posts+pages: {len(data['posts'])}")
    print(f"Tags: {len(data['tags'])}")
    print(f"Posts-Tags relationships: {len(data['posts_tags'])}")
    print(f"Posts-Authors relationships: {len(data['posts_authors'])}")
    print(f"Posts-Meta (SEO): {len(data['posts_meta'])}")
    print(f"Users: {len(data['users'])}")

    # Count posts with custom_excerpt (meta fields)
    posts_with_excerpt = sum(1 for post in posts_only if post.get('custom_excerpt'))
    print(f"Posts with custom metadata: {posts_with_excerpt}")

    # Feature image stats (posts only)
    posts_with_images = sum(1 for post in posts_only if 'feature_image' in post and post['feature_image'])
    print(f"Posts with feature images: {posts_with_images} ({posts_with_images/len(posts_only)*100:.1f}%)" if posts_only else "Posts with feature images: 0")

    # Tag distribution (posts only)
    from collections import Counter
    tag_counts = Counter()
    for post in posts_only:
        post_tag_rels = [pt for pt in data['posts_tags'] if pt['post_id'] == post['id']]
        tag_counts[len(post_tag_rels)] += 1

    if tag_counts:
        print()
        print('Tag count distribution (posts only):')
        for count, num_posts in sorted(tag_counts.items()):
            print(f'  {count} tags: {num_posts} posts')

    # User distribution (posts only)
    print()
    print('Posts by user:')
    user_counts = Counter()
    for post in posts_only:
        author_id = post.get('author_id', 'unknown')
        user_counts[author_id] += 1

    for user_id, count in user_counts.most_common():
        user = next((u for u in data['users'] if u['id'] == user_id), None)
        user_name = user['name'] if user else 'Unknown'
        print(f'  {user_name} (ID: {user_id}): {count} posts')

    # Count parent tags (check if description key exists, not if it's truthy)
    parent_tag_count = sum(1 for tag in data['tags'] if 'description' in tag)

    # Count pages with product_id
    pages_with_product_id = sum(1 for p in pages_only if p.get('custom_excerpt'))

    print()
    print("="*80)
    print("適用された修正:")
    print("="*80)
    # Count tag pages with descriptions
    tags_with_descriptions = sum(1 for p in pages_only if p['slug'].startswith('tag-') and p.get('plaintext'))

    print("  1. 投稿のslugを修正（-postid サフィックスの削除、180文字制限）")
    print("  2. opening値から内部タグを追加（#発売予告, #開封レビュー, #その他）")
    print("  3. 重複slugのチェックと修正")
    print(f"  4. 親カテゴリータグを追加（{parent_tag_count}件）")
    print(f"  5. カテゴリーページを生成（{category_pages_count}件、product_id付き: {pages_with_product_id}件）")
    print(f"  6. タグページを生成（{tag_pages_count}件、description付き: {tags_with_descriptions}件）")
    print(f"  7. 投稿のカスタムメタデータを抽出（{posts_with_excerpt}件の投稿）")
    print(f"     - amazon_code, release_date, furoku_title, furoku_lead_text")
    print(f"  8. SEOメタデータを抽出（meta_title, meta_description）")
    print()
    print("="*80)

if __name__ == '__main__':
    main()
