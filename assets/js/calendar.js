/**
 * Calendar page - Load all calendar pages using Ghost Content API
 */
(function() {
    'use strict';

    async function loadCalendarPages() {
        // onsaleページでは実行しない
        if (window.location.pathname === '/onsale/') {
            return;
        }

        // onsale詳細ページでは実行しない
        if (document.getElementById('onsale-detail-content')) {
            return;
        }

        const container = document.querySelector('#past_sale p');
        if (!container) {
            return;
        }

        // Wait for fetchAllPages to be available
        if (typeof window.fetchAllPages !== 'function') {
            console.error('fetchAllPages function not found');
            return;
        }

        const allPages = await window.fetchAllPages();

        // Filter calendar pages
        const calendarPages = allPages.filter(function(page) {
            return page.slug && page.slug.match(/^calendar\d{6}$/);
        });

        console.log('Calendar pages found:', calendarPages.length);

        // Clear existing content
        container.innerHTML = '';

        // Add calendar pages
        calendarPages.forEach(function(page) {
            const span = document.createElement('span');
            span.className = 'calendar-item';
            span.setAttribute('data-slug', page.slug);

            // Extract YYYYMM from slug (e.g., calendar202307 -> 2023/07の発売情報)
            const match = page.slug.match(/calendar(\d{4})(\d{2})/);
            let displayText = page.title;
            if (match) {
                const year = match[1];
                const month = match[2];
                displayText = year + '/' + month + 'の発売情報';
            }

            span.innerHTML = '<small><a href="' + page.url + '">' + displayText + '</a></small>';
            container.appendChild(span);
        });
    }

    function updateTodayButton() {
        const todayButton = document.querySelector('.btn-simple');

        if (!todayButton) {
            return;
        }

        // 今日の日付を取得
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // 月は0始まりなので+1
        const day = String(today.getDate()).padStart(2, '0');

        // day_mm_dd形式で作成
        const dateHash = 'day_' + month + '_' + day;

        // hrefを更新
        todayButton.href = '#' + dateHash;
    }

    async function init() {
        await loadCalendarPages();
        updateTodayButton();
    }

    // DOMの準備ができるまで待機
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
