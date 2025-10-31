#!/usr/bin/env python3
"""
Create batch XML files from WordPress export files

This script collects posts from raw/投稿 folder and merges them with a base XML file
(containing all categories, tags, and authors), then splits them into batch files.

Features:
- Configurable batch size (default: 100 posts per file)
- Merges metadata (authors, categories, tags) from both sources
- Removes duplicates automatically
"""

import re
import argparse
from pathlib import Path
from datetime import datetime


def extract_items_from_xml(xml_file: Path) -> list:
    """Extract post items from XML file"""
    with open(xml_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract all <item>...</item> blocks
    items = re.findall(r'<item>.*?</item>', content, re.DOTALL)

    # Filter only post items (not attachments)
    post_items = []
    for item in items:
        if '<wp:post_type><![CDATA[post]]></wp:post_type>' in item:
            post_items.append(item)

    return post_items


def extract_authors_from_xml(xml_file: Path) -> list:
    """Extract author blocks from XML file"""
    with open(xml_file, 'r', encoding='utf-8') as f:
        content = f.read()

    authors = re.findall(r'<wp:author>.*?</wp:author>', content, re.DOTALL)
    return authors


def extract_categories_from_xml(xml_file: Path) -> list:
    """Extract category blocks from XML file"""
    with open(xml_file, 'r', encoding='utf-8') as f:
        content = f.read()

    categories = re.findall(r'<wp:category>.*?</wp:category>', content, re.DOTALL)
    return categories


def extract_tags_from_xml(xml_file: Path) -> list:
    """Extract tag blocks from XML file"""
    with open(xml_file, 'r', encoding='utf-8') as f:
        content = f.read()

    tags = re.findall(r'<wp:tag>.*?</wp:tag>', content, re.DOTALL)
    return tags


def collect_all_posts_from_raw_folder(raw_folder: Path) -> tuple:
    """Collect all posts from raw folder"""
    print(f"Collecting posts from {raw_folder}...")

    # Find all XML files in raw folder
    xml_files = sorted(raw_folder.glob('**/*.xml'))

    print(f"  Found {len(xml_files)} XML files")

    all_posts = []
    all_authors = {}  # author_id -> author_block
    all_categories = {}  # category_nicename -> category_block
    all_tags = {}  # tag_slug -> tag_block

    for xml_file in xml_files:
        # Extract posts
        posts = extract_items_from_xml(xml_file)
        all_posts.extend(posts)
        print(f"    {xml_file.name}: {len(posts)} posts (total: {len(all_posts)})")

        # Extract authors
        authors = extract_authors_from_xml(xml_file)
        for author in authors:
            author_id_match = re.search(r'<wp:author_id>(\d+)</wp:author_id>', author)
            if author_id_match:
                author_id = author_id_match.group(1)
                if author_id not in all_authors:
                    all_authors[author_id] = author

        # Extract categories
        categories = extract_categories_from_xml(xml_file)
        for category in categories:
            nicename_match = re.search(r'<wp:category_nicename><!\[CDATA\[(.*?)\]\]>', category)
            if nicename_match:
                nicename = nicename_match.group(1)
                if nicename not in all_categories:
                    all_categories[nicename] = category

        # Extract tags
        tags = extract_tags_from_xml(xml_file)
        for tag in tags:
            slug_match = re.search(r'<wp:tag_slug><!\[CDATA\[(.*?)\]\]>', tag)
            if slug_match:
                slug = slug_match.group(1)
                if slug not in all_tags:
                    all_tags[slug] = tag

    print(f"\n  Total collected:")
    print(f"    Posts: {len(all_posts)}")
    print(f"    Authors: {len(all_authors)}")
    print(f"    Categories: {len(all_categories)}")
    print(f"    Tags: {len(all_tags)}")

    return all_posts, all_authors, all_categories, all_tags


def merge_authors(base_authors: list, new_authors: dict) -> list:
    """Merge authors, avoiding duplicates"""
    existing_ids = set()
    for author in base_authors:
        author_id_match = re.search(r'<wp:author_id>(\d+)</wp:author_id>', author)
        if author_id_match:
            existing_ids.add(author_id_match.group(1))

    merged_authors = base_authors.copy()
    added_count = 0
    for author_id, author_block in new_authors.items():
        if author_id not in existing_ids:
            merged_authors.append(author_block)
            added_count += 1

    print(f"  Merged authors: {len(base_authors)} existing + {added_count} new = {len(merged_authors)}")
    return merged_authors


def merge_categories(base_categories: list, new_categories: dict) -> list:
    """Merge categories, avoiding duplicates"""
    existing_nicenames = set()
    for category in base_categories:
        nicename_match = re.search(r'<wp:category_nicename><!\[CDATA\[(.*?)\]\]>', category)
        if nicename_match:
            existing_nicenames.add(nicename_match.group(1))

    merged_categories = base_categories.copy()
    added_count = 0
    for nicename, category_block in new_categories.items():
        if nicename not in existing_nicenames:
            merged_categories.append(category_block)
            added_count += 1

    print(f"  Merged categories: {len(base_categories)} existing + {added_count} new = {len(merged_categories)}")
    return merged_categories


def merge_tags(base_tags: list, new_tags: dict) -> list:
    """Merge tags, avoiding duplicates"""
    existing_slugs = set()
    for tag in base_tags:
        slug_match = re.search(r'<wp:tag_slug><!\[CDATA\[(.*?)\]\]>', tag)
        if slug_match:
            existing_slugs.add(slug_match.group(1))

    merged_tags = base_tags.copy()
    added_count = 0
    for slug, tag_block in new_tags.items():
        if slug not in existing_slugs:
            merged_tags.append(tag_block)
            added_count += 1

    print(f"  Merged tags: {len(base_tags)} existing + {added_count} new = {len(merged_tags)}")
    return merged_tags


def clean_base_xml(content: str) -> str:
    """Clean base XML by removing any error HTML at the end"""
    doctype_match = re.search(r'<!DOCTYPE html>', content)
    if doctype_match:
        print("  Found HTML error content in base XML, cleaning...")
        content = content[:doctype_match.start()]
        content = content.rstrip() + '\n\t</channel>\n</rss>\n'
    return content


def create_merged_xml(base_xml: Path, posts: list, authors: list, categories: list, tags: list,
                      output_file: Path, batch_num: int):
    """Create new XML file with merged data"""
    print(f"\nCreating batch {batch_num}: {output_file.name}")
    print(f"  Posts: {len(posts)}")

    with open(base_xml, 'r', encoding='utf-8') as f:
        base_content = f.read()

    # Clean base XML if needed
    base_content = clean_base_xml(base_content)

    # Remove existing authors, categories, and tags from base content
    base_content = re.sub(r'\s*<wp:author>.*?</wp:author>', '', base_content, flags=re.DOTALL)
    base_content = re.sub(r'\s*<wp:category>.*?</wp:category>', '', base_content, flags=re.DOTALL)
    base_content = re.sub(r'\s*<wp:tag>.*?</wp:tag>', '', base_content, flags=re.DOTALL)

    # Find position to insert metadata
    image_end_match = re.search(r'</image>', base_content)
    if image_end_match:
        insert_metadata_pos = image_end_match.end()
    else:
        language_match = re.search(r'<language>.*?</language>', base_content)
        if language_match:
            insert_metadata_pos = language_match.end()
        else:
            raise ValueError("Could not find position to insert metadata")

    # Build metadata section
    metadata_parts = []

    if authors:
        metadata_parts.append('\n\n\t\t' + '\n\t'.join(authors))

    if categories:
        metadata_parts.append('\n\t' + '\n\t'.join(categories))

    if tags:
        metadata_parts.append('\n\t' + '\n\t'.join(tags))

    metadata_text = ''.join(metadata_parts)

    # Insert metadata
    base_content = base_content[:insert_metadata_pos] + metadata_text + '\n' + base_content[insert_metadata_pos:]

    # Find the position to insert posts
    channel_end_match = re.search(r'</channel>', base_content)
    if not channel_end_match:
        raise ValueError("Could not find </channel> tag in base XML")

    insert_pos = channel_end_match.start()

    # Format posts
    posts_text = '\n\t'.join(posts)

    # Insert posts
    new_content = base_content[:insert_pos] + '\n\t' + posts_text + '\n\n' + base_content[insert_pos:]

    # Update pubDate
    current_date = datetime.now().strftime('%a, %d %b %Y %H:%M:%S +0000')
    new_content = re.sub(
        r'<pubDate>.*?</pubDate>',
        f'<pubDate>{current_date}</pubDate>',
        new_content,
        count=1
    )

    # Write to output file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"  Created: {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description='Create batch XML files from WordPress export',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Create 100-post batches (default)
  python3 scripts/create_batch_xmls.py

  # Create 200-post batches
  python3 scripts/create_batch_xmls.py --batch-size 200

  # Specify custom paths
  python3 scripts/create_batch_xmls.py \\
    --raw-folder raw/投稿 \\
    --base-xml xml/WordPress.2025-10-16.xml \\
    --output-dir output/batch-100 \\
    --batch-size 100
        '''
    )

    parser.add_argument(
        '--batch-size',
        type=int,
        default=100,
        help='Number of posts per batch file (default: 100)'
    )

    parser.add_argument(
        '--raw-folder',
        type=Path,
        default=Path('raw/投稿'),
        help='Folder containing WordPress export XML files with posts (default: raw/投稿)'
    )

    parser.add_argument(
        '--base-xml',
        type=Path,
        default=Path('wordpress-to-ghost-migration-files-20251017/xml/WordPress.2025-10-16.xml'),
        help='Base XML file exported with "All content" option (default: wordpress-to-ghost-migration-files-20251017/xml/WordPress.2025-10-16.xml)'
    )

    parser.add_argument(
        '--output-dir',
        type=Path,
        help='Output directory for batch XML files (default: batch-{SIZE}posts/xml)'
    )

    args = parser.parse_args()

    # Set default output_dir if not specified
    if args.output_dir is None:
        args.output_dir = Path(f'batch-{args.batch_size}posts/xml')

    print("="*80)
    print(f"Create batch XML files ({args.batch_size} posts per batch)")
    print("="*80)
    print()
    print(f"Configuration:")
    print(f"  Raw folder:  {args.raw_folder}")
    print(f"  Base XML:    {args.base_xml}")
    print(f"  Output dir:  {args.output_dir}")
    print(f"  Batch size:  {args.batch_size} posts")
    print()

    # Check paths exist
    if not args.raw_folder.exists():
        print(f"ERROR: {args.raw_folder} not found")
        print(f"Please create the folder and add WordPress XML export files")
        return 1

    if not args.base_xml.exists():
        print(f"ERROR: {args.base_xml} not found")
        print(f"Please export 'All content' from WordPress and place it at {args.base_xml}")
        return 1

    args.output_dir.mkdir(parents=True, exist_ok=True)

    # Collect all posts from raw folder
    all_posts, new_authors, new_categories, new_tags = collect_all_posts_from_raw_folder(args.raw_folder)

    if len(all_posts) == 0:
        print("ERROR: No posts found in raw folder")
        return 1

    # Extract existing authors, categories, tags from base XML
    print(f"\nExtracting data from base XML...")
    base_authors = extract_authors_from_xml(args.base_xml)
    base_categories = extract_categories_from_xml(args.base_xml)
    base_tags = extract_tags_from_xml(args.base_xml)

    print(f"  Base XML has:")
    print(f"    Authors: {len(base_authors)}")
    print(f"    Categories: {len(base_categories)}")
    print(f"    Tags: {len(base_tags)}")

    # Merge data
    print(f"\nMerging metadata...")
    merged_authors = merge_authors(base_authors, new_authors)
    merged_categories = merge_categories(base_categories, new_categories)
    merged_tags = merge_tags(base_tags, new_tags)

    # Calculate batch size
    posts_per_batch = args.batch_size
    total_posts = len(all_posts)
    num_batches = (total_posts + posts_per_batch - 1) // posts_per_batch

    print(f"\nCreating {num_batches} batches ({posts_per_batch} posts per batch)")
    print(f"Total posts: {total_posts}")

    # Create batch XML files
    for i in range(num_batches):
        start_idx = i * posts_per_batch
        end_idx = min((i + 1) * posts_per_batch, total_posts)
        batch_posts = all_posts[start_idx:end_idx]

        batch_num = i + 1
        output_file = args.output_dir / f'WordPress-batch-{batch_num:03d}-{posts_per_batch}posts.xml'

        create_merged_xml(
            args.base_xml,
            batch_posts,
            merged_authors,
            merged_categories,
            merged_tags,
            output_file,
            batch_num
        )

    print()
    print("="*80)
    print("✓ Done!")
    print(f"  Created {num_batches} XML files in {args.output_dir}")
    print("="*80)
    print()
    print("Created files:")
    for i in range(num_batches):
        batch_num = i + 1
        output_file = args.output_dir / f'WordPress-batch-{batch_num:03d}-{posts_per_batch}posts.xml'
        file_size_mb = output_file.stat().st_size / (1024 * 1024) if output_file.exists() else 0
        print(f"  {output_file.name} ({file_size_mb:.2f} MB)")
    print()
    print("Next step:")
    print("  Convert batch XML files to Ghost JSON:")
    print(f"  python3 scripts/convert/convert_sample_xml_to_json.py {args.output_dir}/WordPress-batch-001-{posts_per_batch}posts.xml")
    print()

    return 0


if __name__ == '__main__':
    exit(main())
