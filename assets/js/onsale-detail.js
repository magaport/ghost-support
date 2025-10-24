/**
 * Onsale detail page
 * Filter posts by year-month based on published_at
 */
(function() {
    'use strict';

    /**
     * Decode HTML entities
     */
    function decodeHTMLEntities(text) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    /**
     * Parse excerpt to extract release_date
     */
    function parseExcerpt(excerpt) {
        if (!excerpt) {
            return {};
        }

        // HTMLエンティティをデコード
        const decodedExcerpt = decodeHTMLEntities(excerpt);

        // JSON形式の場合
        if (decodedExcerpt.trim().startsWith('{')) {
            try {
                return JSON.parse(decodedExcerpt);
            } catch (e) {
                return {};
            }
        }

        return {};
    }

    /**
     * Generate onsale post cards HTML
     */
    function generateOnsaleHTML(posts, targetYearMonth) {
        let html = '';

        posts.forEach(function(post) {
            // excerptからrelease_dateを取得
            const excerptData = parseExcerpt(post.excerpt);
            const releaseDate = excerptData.release_date;

            if (!releaseDate) {
                return;
            }

            // release_dateから年月を抽出 (YYYY-MM形式)
            const postYearMonth = releaseDate.substring(0, 7); // YYYY-MM-DD -> YYYY-MM

            // 該当年月の投稿のみ表示
            if (postYearMonth !== targetYearMonth) {
                return;
            }

            // タグデータをJSON文字列に変換
            const tagsJson = JSON.stringify(post.tags).replace(/"/g, '&quot;');

            html += '<article class="post-card post" data-magazine-tags=\'' + tagsJson + '\'>';
            html += '  <a class="post-card__link" href="' + post.url + '">';

            // Feature image
            if (post.feature_image) {
                html += '    <div class="post-card__image">';
                html += '      <img src="' + post.feature_image + '" alt="' + post.title + '" loading="lazy">';
                html += '    </div>';
            } else {
                html += '    <div class="post-card__image">';
                html += '      <img src="/assets/images/noimage.png" alt="No Image" loading="lazy">';
                html += '    </div>';
            }

            html += '    <div class="post-card__info">';
            html += '      <h2>';
            html += '        <span class="new-badge" data-published="' + post.published_at + '" style="display:none;color:#F00;">New</span>';
            html += post.title;
            html += '      </h2>';
            html += '    </div>';
            html += '  </a>';
            html += '  <div class="magazine-tag-placeholder"></div>';
            html += '</article>';
        });

        // 投稿がない場合のメッセージ
        if (html === '') {
            html = '<div class="notfound"><p class="nofound-message">該当する付録がありません</p></div>';
        }

        return html;
    }

    /**
     * Update page title with year and month
     */
    function updatePageTitle(year, month) {
        const titleElement = document.getElementById('onsale-detail-title');
        if (!titleElement) {
            return;
        }

        const monthNum = parseInt(month, 10);
        titleElement.textContent = year + '年' + String(monthNum).padStart(2, '0') + '月の付録発売日情報 – 全雑誌';
    }

    /**
     * Initialize onsale detail page
     */
    function initOnsaleDetail() {
        const contentDiv = document.getElementById('onsale-detail-content');
        if (!contentDiv) {
            return;
        }

        const pageSlug = contentDiv.getAttribute('data-page-slug');
        if (!pageSlug) {
            return;
        }

        // Extract year and month from slug (onsaleYYYYMM)
        const match = pageSlug.match(/^onsale(\d{4})(\d{2})$/);
        if (!match) {
            return;
        }

        const year = match[1];
        const month = match[2];
        const targetYearMonth = year + '-' + month;

        // Update page title
        updatePageTitle(year, month);

        // Get posts data
        const posts = window.onsalePosts || [];

        // Generate HTML
        const html = generateOnsaleHTML(posts, targetYearMonth);

        // Insert HTML
        const gridDiv = document.getElementById('onsale-posts-grid');
        if (gridDiv) {
            gridDiv.innerHTML = html;
        }

        // Trigger magazine tag processing (if available)
        if (typeof window.processPostCardMagazineTags === 'function') {
            window.processPostCardMagazineTags();
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOnsaleDetail);
    } else {
        initOnsaleDetail();
    }
})();
