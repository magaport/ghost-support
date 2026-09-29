/* NEW badge
/* 公開から NEW_BADGE_DAYS 日以内の記事にだけ NEW を出す。条件は先方に確認中の仮の値 */
(function () {
    const NEW_BADGE_DAYS = 7;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    document.querySelectorAll('.voyage-new[data-published-at]').forEach(function (badge) {
        const publishedAt = Date.parse(badge.dataset.publishedAt);
        if (Number.isNaN(publishedAt)) {
            return;
        }
        if (now - publishedAt < NEW_BADGE_DAYS * DAY_MS) {
            badge.hidden = false;
        }
    });
})();
