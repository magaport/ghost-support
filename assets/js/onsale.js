/**
 * Onsale page - Load all onsale pages using Ghost Content API
 */
(function() {
    'use strict';

    async function loadOnsaleListPage() {
        // onsale一覧ページにいるかチェック
        if (window.location.pathname !== '/onsale/') {
            return;
        }

        // Wait for fetchAllPages to be available
        if (typeof window.fetchAllPages !== 'function') {
            console.error('fetchAllPages function not found');
            return;
        }

        const allPages = await window.fetchAllPages();

        // Filter onsale pages
        const onsalePages = allPages.filter(function(page) {
            return page.slug && page.slug.match(/^onsale\d{6}$/);
        });

        console.log('Onsale pages found:', onsalePages.length);

        // 最新3件セクション
        const recentContainer = document.querySelector('#recent_sale p');
        if (recentContainer) {
            recentContainer.innerHTML = '';
            onsalePages.slice(0, 3).forEach(function(page, index) {
                const span = document.createElement('span');
                span.className = 'calendar-item onsale-recent';
                span.setAttribute('data-slug', page.slug);
                span.setAttribute('data-index', index);

                // Extract YYYYMM from slug (e.g., onsale202307 -> 2023/07の付録)
                const match = page.slug.match(/onsale(\d{4})(\d{2})/);
                let displayText = page.title;
                if (match) {
                    const year = match[1];
                    const month = match[2];
                    displayText = year + '/' + month + 'の付録';
                }

                span.innerHTML = '<small><a href="' + page.url + '">' + displayText + '</a></small>';
                recentContainer.appendChild(span);
            });
        }

        // 残りの年月リスト
        const pastContainer = document.querySelector('#past_sale p');
        if (pastContainer) {
            pastContainer.innerHTML = '';
            onsalePages.slice(3).forEach(function(page, index) {
                const span = document.createElement('span');
                span.className = 'calendar-item onsale-past';
                span.setAttribute('data-slug', page.slug);
                span.setAttribute('data-index', index + 3);

                // Extract YYYYMM from slug (e.g., onsale202307 -> 2023/07の付録)
                const match = page.slug.match(/onsale(\d{4})(\d{2})/);
                let displayText = page.title;
                if (match) {
                    const year = match[1];
                    const month = match[2];
                    displayText = year + '/' + month + 'の付録';
                }

                span.innerHTML = '<small><a href="' + page.url + '">' + displayText + '</a></small>';
                pastContainer.appendChild(span);
            });
        }
    }

    async function loadOnsaleDetailPage() {
        // onsale詳細ページかチェック
        if (!document.getElementById('onsale-detail-content')) {
            return;
        }

        // Wait for fetchAllPages to be available
        if (typeof window.fetchAllPages !== 'function') {
            console.error('fetchAllPages function not found');
            return;
        }

        const allPages = await window.fetchAllPages();

        // Filter onsale pages
        const onsalePages = allPages.filter(function(page) {
            return page.slug && page.slug.match(/^onsale\d{6}$/);
        });

        console.log('Onsale detail pages found:', onsalePages.length);

        const container = document.querySelector('#past_sale p');
        if (container) {
            container.innerHTML = '';
            onsalePages.forEach(function(page) {
                const span = document.createElement('span');
                span.className = 'calendar-item';
                span.setAttribute('data-slug', page.slug);

                // Extract YYYYMM from slug (e.g., onsale202307 -> 2023/07の付録)
                const match = page.slug.match(/onsale(\d{4})(\d{2})/);
                let displayText = page.title;
                if (match) {
                    const year = match[1];
                    const month = match[2];
                    displayText = year + '/' + month + 'の付録';
                }

                span.innerHTML = '<small><a href="' + page.url + '">' + displayText + '</a></small>';
                container.appendChild(span);
            });
        }
    }

    async function init() {
        await loadOnsaleListPage();
        await loadOnsaleDetailPage();
    }

    // DOMの準備ができるまで待機
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
