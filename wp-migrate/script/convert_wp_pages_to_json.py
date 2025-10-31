#!/usr/bin/env python3
"""
Convert WordPress Fixed Pages XML to Ghost JSON
This script converts WordPress pages (not posts) to Ghost pages
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

def html_to_plaintext(html: str) -> str:
    """Convert HTML to plain text (simple version)"""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', html)
    # Decode HTML entities
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.replace('&amp;', '&')
    text = text.replace('&quot;', '"')
    text = text.replace('&#241;', 'ñ')
    text = text.replace('&nbsp;', ' ')
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_pages_from_xml(xml_file):
    """Extract WordPress pages from XML file"""

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

    # Extract pages (not posts)
    pages = []
    items = re.findall(r'<item>.*?</item>', content, re.DOTALL)
    page_author_mapping = {}  # wp_page_id -> author_login

    for item in items:
        # Only pages (type = 'page')
        if '<wp:post_type><![CDATA[page]]></wp:post_type>' not in item:
            continue

        page = {}

        # Page ID
        post_id_match = re.search(r'<wp:post_id>(\d+)</wp:post_id>', item)
        if not post_id_match:
            continue
        wp_page_id = post_id_match.group(1)

        # Generate Ghost ID
        page['id'] = generate_object_id()
        page['uuid'] = generate_uuid()

        # Title
        title_match = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>', item)
        page['title'] = title_match.group(1) if title_match else f'Page {wp_page_id}'

        # Slug
        slug_match = re.search(r'<wp:post_name><!\[CDATA\[(.*?)\]\]></wp:post_name>', item)
        page['slug'] = slug_match.group(1) if (slug_match and slug_match.group(1)) else f'page-{wp_page_id}'

        # Content
        content_match = re.search(r'<content:encoded><!\[CDATA\[(.*?)\]\]></content:encoded>', item, re.DOTALL)
        page['html'] = content_match.group(1) if content_match else ''

        # Plaintext (from HTML)
        page['plaintext'] = html_to_plaintext(page['html'])

        # Lexical (Ghost's new editor format)
        page['lexical'] = text_to_lexical_json(page['plaintext'][:200])  # First 200 chars

        # Status
        status_match = re.search(r'<wp:status><!\[CDATA\[(.*?)\]\]></wp:status>', item)
        if status_match:
            wp_status = status_match.group(1)
            # Map WordPress status to Ghost status
            if wp_status == 'publish':
                page['status'] = 'published'
            elif wp_status == 'draft':
                page['status'] = 'draft'
            elif wp_status == 'private':
                page['status'] = 'draft'  # Ghost doesn't have "private" status for pages
            else:
                page['status'] = 'draft'
        else:
            page['status'] = 'draft'

        # Dates
        pub_date_match = re.search(r'<wp:post_date><!\[CDATA\[(.*?)\]\]></wp:post_date>', item)
        if pub_date_match:
            date_str = pub_date_match.group(1)
            # Convert to ISO format
            try:
                dt = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
                iso_date = dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
                page['created_at'] = iso_date
                page['updated_at'] = iso_date
                if page['status'] == 'published':
                    page['published_at'] = iso_date
            except:
                pass

        # Type and visibility
        page['type'] = 'page'
        page['visibility'] = 'public'

        # Author
        creator_match = re.search(r'<dc:creator><!\[CDATA\[(.*?)\]\]></dc:creator>', item)
        author_login = 'user'  # Default
        if creator_match:
            author_login = creator_match.group(1)

        # Store mapping for SQL generation
        page_author_mapping[wp_page_id] = author_login

        # Get author wp_id
        author_wp_id = '1'  # Default to user ID 1
        if author_login in authors_dict:
            author_wp_id = str(authors_dict[author_login]['wp_id'])

        # Store author_id temporarily for posts_authors table generation
        page['_author_id_temp'] = author_wp_id

        # Set audit fields
        page['created_by'] = author_wp_id
        page['updated_by'] = author_wp_id
        if page['status'] == 'published':
            page['published_by'] = author_wp_id

        # Custom excerpt with wp_page_id for SQL mapping
        page['custom_excerpt'] = json.dumps({'wp_page_id': wp_page_id}, ensure_ascii=False)

        # Other Ghost page fields
        page['comment_id'] = page['id']
        page['feature_image'] = None
        page['featured'] = 0
        page['locale'] = None
        page['mobiledoc'] = None
        page['codeinjection_head'] = None
        page['codeinjection_foot'] = None
        page['custom_template'] = None
        page['canonical_url'] = None
        page['newsletter_id'] = None
        page['show_title_and_feature_image'] = 1
        page['email_recipient_filter'] = 'none'

        print(f"    Page {wp_page_id}: {page['title']} (slug: {page['slug']}, status: {page['status']})")
        pages.append(page)

    return {
        'pages': pages,
        'authors_dict': authors_dict,
        'page_author_mapping': page_author_mapping
    }

def generate_fix_authors_sql(page_author_mapping: dict, authors_dict: dict, output_file: Path):
    """Generate SQL script to fix posts_authors table for pages after import"""

    print()
    print("="*80)
    print(f"Generating SQL script: {output_file}")
    print("="*80)

    sql_lines = [
        "-- Fix posts_authors mapping for pages after Ghost import",
        "-- This script updates the posts_authors table to match WordPress page author assignments",
        "-- Generated by convert_wp_pages_to_json.py",
        "",
        "-- WordPress page ID -> Author mapping:",
    ]

    # Add comment showing the mapping
    for wp_page_id, author_login in sorted(page_author_mapping.items(), key=lambda x: int(x[0])):
        author_info = authors_dict.get(author_login, {'slug': 'user', 'name': 'User'})
        sql_lines.append(f"--   Page {wp_page_id}: {author_login} ({author_info['name']})")

    sql_lines.extend([
        "",
        "-- Update posts_authors table using custom_excerpt as the key",
        "-- custom_excerpt contains JSON with wp_page_id field",
        "UPDATE posts_authors pa",
        "INNER JOIN posts p ON pa.post_id = p.id",
        "INNER JOIN (",
    ])

    # Build UNION ALL statements for mapping
    union_statements = []
    for wp_page_id, author_login in sorted(page_author_mapping.items(), key=lambda x: int(x[0])):
        author_info = authors_dict.get(author_login, {'slug': 'user'})
        author_slug = author_info['slug']
        union_statements.append(f"    SELECT '{wp_page_id}' as wp_page_id, '{author_slug}' as author_slug")

    sql_lines.append("\n    UNION ALL\n".join(union_statements))

    sql_lines.extend([
        ") AS wp_mapping ON JSON_UNQUOTE(JSON_EXTRACT(p.custom_excerpt, '$.wp_page_id')) = wp_mapping.wp_page_id",
        "INNER JOIN users u ON u.slug = wp_mapping.author_slug",
        "SET pa.author_id = u.id",
        "WHERE pa.author_id != u.id",
        "  AND p.custom_excerpt IS NOT NULL",
        "  AND JSON_EXTRACT(p.custom_excerpt, '$.wp_page_id') IS NOT NULL",
        "  AND p.type = 'page';",  # Only update pages, not posts
        "",
        "-- Verification query (optional - run this to check the results):",
        "-- SELECT ",
        "--   JSON_UNQUOTE(JSON_EXTRACT(p.custom_excerpt, '$.wp_page_id')) as wp_page_id,",
        "--   p.title,",
        "--   p.type,",
        "--   u.name as author_name,",
        "--   u.email as author_email",
        "-- FROM posts p",
        "-- INNER JOIN posts_authors pa ON p.id = pa.post_id",
        "-- INNER JOIN users u ON pa.author_id = u.id",
        "-- WHERE JSON_EXTRACT(p.custom_excerpt, '$.wp_page_id') IS NOT NULL",
        "--   AND p.type = 'page'",
        "-- ORDER BY CAST(JSON_UNQUOTE(JSON_EXTRACT(p.custom_excerpt, '$.wp_page_id')) AS UNSIGNED);",
    ])

    # Write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))

    print(f"  Generated SQL with {len(page_author_mapping)} page-author mappings")
    print(f"  SQL file: {output_file}")

def create_ghost_json_from_wp_pages(xml_file):
    """Create Ghost JSON from WordPress pages XML"""

    print("="*80)
    print(f"Converting {xml_file} to Ghost JSON (Pages only)")
    print("="*80)
    print()

    result = extract_pages_from_xml(xml_file)

    all_pages = result['pages']
    all_authors_dict = result['authors_dict']
    page_author_mapping = result['page_author_mapping']

    print()
    print("="*80)
    print(f"Total pages: {len(all_pages)}")
    print(f"Total authors: {len(all_authors_dict)}")
    print("="*80)

    # Build posts_authors relationships for pages
    posts_authors = []
    for page in all_pages:
        page_id = page['id']
        author_id = page.get('_author_id_temp', '1')

        posts_authors.append({
            'post_id': page_id,
            'author_id': str(author_id)
        })

        # Remove temporary field from page
        if '_author_id_temp' in page:
            del page['_author_id_temp']

    # Create users list
    users = []

    # Add default user (ID: 1)
    users.append({
        'id': '1',
        'slug': 'user',
        'name': 'User',
        'email': 'user@furoku.life',
        'roles': ['Administrator']
    })

    # Add WordPress authors
    for author_info in all_authors_dict.values():
        # Skip if already added as default user
        if author_info['wp_id'] == '1':
            continue

        users.append({
            'id': str(author_info['wp_id']),
            'slug': author_info['slug'],
            'name': author_info['name'],
            'email': author_info['email'],
            'roles': ['Author']
        })

    ghost_json = {
        "db": [{
            "meta": {
                "exported_on": int(datetime.now().timestamp() * 1000),
                "version": "6.0.6"
            },
            "data": {
                "posts": all_pages,  # Pages are stored in the same table as posts in Ghost
                "tags": [],
                "posts_tags": [],
                "posts_authors": posts_authors,
                "posts_meta": [],
                "users": users
            }
        }]
    }

    return {
        'ghost_json': ghost_json,
        'page_author_mapping': page_author_mapping,
        'authors_dict': all_authors_dict
    }

def main():
    print("="*80)
    print("Convert WordPress Fixed Pages XML to Ghost JSON")
    print("="*80)
    print()

    xml_file = Path(__file__).parent / 'xml' / 'WordPress-FixedPage.2025-10-21.xml'

    if not xml_file.exists():
        print(f"ERROR: {xml_file} not found")
        return

    result = create_ghost_json_from_wp_pages(xml_file)
    ghost_json = result['ghost_json']
    page_author_mapping = result['page_author_mapping']
    authors_dict = result['authors_dict']

    # Save JSON file
    output_dir = Path(__file__).parent / 'output'
    output_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = output_dir / f'ghost_import_pages_{timestamp}.json'
    print()
    print(f"Writing to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(ghost_json, f, ensure_ascii=False, indent=2)

    # Generate SQL fix script
    sql_output_file = output_dir / f'fix_page_authors_{timestamp}.sql'
    generate_fix_authors_sql(page_author_mapping, authors_dict, sql_output_file)

    # Print stats
    data = ghost_json['db'][0]['data']

    pages_only = [p for p in data['posts'] if p.get('type') == 'page']
    published_pages = [p for p in pages_only if p.get('status') == 'published']
    draft_pages = [p for p in pages_only if p.get('status') == 'draft']

    print()
    print("="*80)
    print(f"✓ Files created:")
    print(f"  - Ghost JSON: {output_file}")
    print(f"  - SQL fix script: {sql_output_file}")
    print("="*80)
    print(f"Total pages: {len(pages_only)}")
    print(f"  - Published: {len(published_pages)}")
    print(f"  - Draft: {len(draft_pages)}")
    print(f"Users: {len(data['users'])}")
    print(f"Posts-Authors relationships: {len(data['posts_authors'])}")

    # Page status distribution
    from collections import Counter
    status_counts = Counter(p['status'] for p in pages_only)

    print()
    print('Page status distribution:')
    for status, count in status_counts.most_common():
        print(f'  {status}: {count} pages')

    # Author distribution
    print()
    print('Pages by author:')
    author_counts = Counter()
    for page in pages_only:
        # Find author from posts_authors
        page_id = page['id']
        author_rel = next((pa for pa in data['posts_authors'] if pa['post_id'] == page_id), None)
        if author_rel:
            author_id = author_rel['author_id']
            author_counts[author_id] += 1

    for user_id, count in author_counts.most_common(10):  # Top 10 authors
        user = next((u for u in data['users'] if u['id'] == user_id), None)
        user_name = user['name'] if user else 'Unknown'
        print(f'  {user_name} (ID: {user_id}): {count} pages')

    if len(author_counts) > 10:
        print(f'  ... and {len(author_counts) - 10} more authors')

    print()
    print("="*80)

if __name__ == '__main__':
    main()
