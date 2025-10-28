/* Mobile menu burger toggle */
(function () {
    const navigation = document.querySelector('.gh-navigation');
    const burger = navigation.querySelector('.gh-burger');
    if (!burger) return;

    burger.addEventListener('click', function () {
        if (!navigation.classList.contains('is-open')) {
            navigation.classList.add('is-open');
            document.documentElement.style.overflowY = 'hidden';
        } else {
            navigation.classList.remove('is-open');
            document.documentElement.style.overflowY = null;
        }
    });
})();

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

/* Turn the main nav into dropdown menu when there are more than 5 menu items */
(function () {
    dropdown();
})();

/* Infinite scroll pagination */
(function () {
    if (!document.body.classList.contains('home-template') && !document.body.classList.contains('post-template')) {
        pagination();
    }
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

/* Show NEW badge for posts published within last 7 days */
(function () {
    const badges = document.querySelectorAll('.new-badge');
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    badges.forEach(function (badge) {
        const publishedDate = new Date(badge.getAttribute('data-published'));
        if (publishedDate >= sevenDaysAgo) {
            badge.style.display = 'inline';
        }
    });
})();

/* Show updated date only if different from published date */
(function () {
    const updatedTime = document.querySelector('.entry-header .updated');
    if (!updatedTime) return;

    const publishedDate = updatedTime.getAttribute('data-published');
    const updatedDate = updatedTime.getAttribute('data-updated');

    if (publishedDate !== updatedDate) {
        updatedTime.classList.add('show');
    }
})();

/* Set background image from data attribute */
(function () {
    const bgImageElement = document.querySelector('.fab__contents_img[data-bg-image]');
    if (!bgImageElement) return;

    const imageUrl = bgImageElement.getAttribute('data-bg-image');
    if (imageUrl) {
        bgImageElement.style.backgroundImage = `url(${imageUrl})`;
    }
})();

/* Hide TAGS section if only category tags exist */
(function () {
    const metaTag = document.querySelector('.meta-tag');
    if (!metaTag) return;

    const tagLinks = metaTag.querySelectorAll('ul li a[rel="tag"]');
    if (tagLinks.length === 0) {
        metaTag.style.display = 'none';
        return;
    }

    // Define all magazine category tags (from magazine-tag.js)
    const magazineCategoryTags = [
        // ブランドムック
        'brandmook',
        // 女性ファッション雑誌
        '25ans-hearstfujingaho', 'androsy-takarajimasha', 'baila-shueisha', 'bestory-kobunsha',
        'bijinhyakka-kadokawaharuki', 'biteki-shogakukan', 'cancam-shogakukan', 'domani-shogakukan',
        'eclat-shueisha', 'elledecor-hearstfujingaho', 'ellejapon-hearstfujingaho', 'fudge-saneishobo',
        'fujingaho-hearstfujingaho', 'gina-bunkasha', 'ginger-gentosha', 'glow-takarajimasha',
        'harpersbazaar-hearstfujingaho', 'inred-takarajimasha', 'jelly-bunkasha', 'jj-kobunsha',
        'jsgirl-saneishobo', 'kimonoanne-tacshuppan', 'kirapichi-gakken', 'kunel-magazinehouse',
        'lafarfa-bunkasha', 'larme-tokumashoten', 'lee-shueisha', 'liniere-takarajimasha',
        'loveggg-mediaboy', 'maquia-shueisha', 'marisol-shueisha', 'mini-takarajimasha',
        'more-shueisha', 'nicola-shinchosha', 'nicopuchi-shinchosha', 'nonno-shueisha',
        'numerotokyo-fusosha', 'oggi-shogakukan', 'osharetecho-takarajimasha', 'otonamuse-takarajimasha',
        'popteen-kadokawaharuki', 'richesse-hearstfujingaho', 'seventeen-shueisha', 'spring-takarajimasha',
        'spur-shueisha', 'steady-takarajimasha', 'sutekinaanohito-takarajimasha', 'sweet-takarajimasha',
        'utsukushiikimono-hearstfujingaho', 'vivi-kodansha', 'voce-kodansha', 'waraku-shogakukan',
        'with-kodansha', 'yogini-peacs',
        // 少女・女性マンガの付録
        'ciao-shogakukan', 'nakayosi-kodansha', 'ribon-shueisha', 'shocomi-shogakukan',
        // 子供・児童学習 雑誌
        'babybook-shogakukan', 'fukufuku-fukuinkan', 'genki-kodansha', 'inaiinai-kodansha',
        'mebae-shogakukan', 'nene-shufu', 'okaitsu-kodansha', 'otomodachi-kodansha',
        'pucchigumi-shogakukan', 'sho1-shogakukan', 'sho8-shogakukan', 'tanoyo-kodansha',
        'telemaga-kodansha', 'televikun-shogakukan', 'youchien-shogakukan',
        // ママ・主婦雑誌
        '39mag-benesse', 'akahoshi-shufunotomo', 'babymo-shufunotomo', 'cookpadplus-7andi',
        'croissant-magazinehouse', 'ellegourmet-hearstfujingaho', 'esse-fusosha', 'hiyokoclub-benesse',
        'hugmug-sekaibunkasha', 'kodomoe-hakusensha', 'lettuceclub-kadokawa', 'moe-hakusensha',
        'orangepage', 'premo-shufunotomo', 'sutekinaokusan-shufutoseikatsusha',
        // 結婚情報誌
        'ellemariage-hearstfujingaho', 'zexy-recruit',
        // メンズファッション雑誌
        'dime-shogakukan', 'getnavi-gakkenplus', 'lightning-eipublishing', 'mensclub-hearstfujingaho',
        'mensnonno-shueisha', 'monomaster-takarajimasha', 'monomax-takarajimasha', 'smart-takarajimasha',
        'uomo-shueisha',
        // アウトドア雑誌
        'bepal-shogakukan', 'bicycleclub-eipublishing', 'camplife-yamakei', 'cyclesports-yaesu',
        'fielder-kasakura', 'peaks-eipublishing', 'randonnee-eipublishing', 'wandervogel-yamakei',
        // その他雑誌
        'modernliving-hearstfujingaho', 'nikkeiwoman-nikkeibp', 'serai-shogakukan',
        'tabinotecho-kotsushinbun', 'tokyowalker-kadokawa',
        // エンタメ
        'campaign', 'furoku-favorite', 'furoku-ranking', 'furoku-sufficiency', 'other',
        'recommended', 'subscription-tokuten',
        // 親カテゴリー
        'women-magazine', 'women-manga', 'child-magazine', 'mother-magazine', 'wedding-magazine',
        'men-magazine', 'outdoor-magazine', 'other-magazine', 'entertainment', 'uncategorized'
    ];

    // Check if any non-category tag exists
    let hasNonCategoryTag = false;
    tagLinks.forEach(function (link) {
        const href = link.getAttribute('href');
        const slug = href.split('/tag/')[1]?.replace('/', '') || '';

        const isCategoryTag = magazineCategoryTags.indexOf(slug) !== -1;

        if (!isCategoryTag) {
            hasNonCategoryTag = true;
        } else {
            // Hide category tags
            link.parentElement.style.display = 'none';
        }
    });

    // Hide TAGS section if no non-category tags exist
    if (!hasNonCategoryTag) {
        metaTag.style.display = 'none';
    }
})();