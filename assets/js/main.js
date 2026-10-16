/* Add lightbox to gallery images */
(function () {
    lightbox(
        '.kg-image-card > .kg-image[width][height], .kg-gallery-image > img'
    );
})();

/* Responsive video in post content */
(function () {
    const sources = [
        '.gh-content iframe[src*="youtube.com"]',
        '.gh-content iframe[src*="youtube-nocookie.com"]',
        '.gh-content iframe[src*="player.vimeo.com"]',
        '.gh-content iframe[src*="kickstarter.com"][src*="video.html"]',
        '.gh-content object',
        '.gh-content embed',
    ];
    reframe(document.querySelectorAll(sources.join(',')));
})();

/* Responsive HTML table */
(function () {
    const tables = document.querySelectorAll('.gh-content > table:not(.gist table)');

    tables.forEach(function (table) {
        const wrapper = document.createElement('div');
        wrapper.className = 'gh-table';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    });
})();

/* ナビを並べる幅に広がったら、開いたままのメニューを閉じる */
(function () {
    const menu = document.getElementById('voyage-menu');
    const burger = document.querySelector('header.voyage-header > .voyage-burger');
    if (!menu || !burger) return;

    // CSS の display: none では popover が開いたままで、本文のスクロール制限が残る。
    // 幅の判定は CSS の container query だけに持たせたいので、JS で幅を比べず MENU が隠れたことで知る
    new ResizeObserver(function () {
        if (burger.offsetWidth === 0 && menu.matches(':popover-open')) {
            menu.hidePopover();
        }
    }).observe(burger);
})();
