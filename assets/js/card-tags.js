(function () {
    'use strict';

    const HIDDEN_CLASS = 'card-tags__link--hidden';
    const RESIZE_DEBOUNCE = 150;

    /**
     * コンテナの `column-gap` を取得し数値として返す。
     * @param {HTMLElement} container `card-tags` のコンテナ要素
     * @returns {number} gap のピクセル値。取得できない場合は 0
     */
    const parseColumnGap = function (container) {
        const gapValue = window.getComputedStyle(container).columnGap;
        const parsed = Number.parseFloat(gapValue);
        return Number.isNaN(parsed) ? 0 : parsed;
    };

    /**
     * コンテナ幅を超えるタグリンクに非表示クラスを付与する。
     * @param {HTMLElement} container `.card-tags` のコンテナ要素
     * @returns {void}
     */
    const hideOverflowingTags = function (container) {
        const tags = Array.from(container.querySelectorAll('.card-tags__link'));
        if (tags.length === 0) {
            return;
        }

        const availableWidth = container.clientWidth;
        if (availableWidth === 0) {
            return;
        }

        const columnGap = parseColumnGap(container);
        let usedWidth = 0;

        tags.forEach((tag, index) => {
            tag.classList.remove(HIDDEN_CLASS);

            const tagWidth = Math.ceil(tag.offsetWidth);
            const nextWidth = index === 0 ? tagWidth : usedWidth + columnGap + tagWidth;

            if (nextWidth <= availableWidth) {
                usedWidth = nextWidth;
                return;
            }

            tag.classList.add(HIDDEN_CLASS);
        });
    };

    /**
     * すべての `.card-tags` コンテナでタグの表示状態を再計算する。
     * @returns {void}
     */
    const updateAllCardTagVisibility = function () {
        const containers = document.querySelectorAll('.card-tags');
        containers.forEach((container) => {
            hideOverflowingTags(container);
        });
    };

    /**
     * DOM 準備完了とリサイズイベントに合わせてタグ表示制御を初期化する。
     * @returns {void}
     */
    const initCardTagVisibility = function () {
        /**
         * 現在のビューポート幅に対して表示制御を実行する。
         * @returns {void}
         */
        const run = function () {
            updateAllCardTagVisibility();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }

        let resizeTimer = null;
        window.addEventListener('resize', () => {
            if (resizeTimer !== null) {
                window.clearTimeout(resizeTimer);
            }
            resizeTimer = window.setTimeout(run, RESIZE_DEBOUNCE);
        });
    };

    window.Source = window.Source || {};
    window.Source.cardTags = {
        update: updateAllCardTagVisibility
    };

    initCardTagVisibility();
})();
