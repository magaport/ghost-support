/**
 * blockquoteと.blockquote-like内の連続するbrタグを処理
 * 2つ連続している場合、2つ目を削除
 */
(function () {
    'use strict';

    function removeConsecutiveBr() {
        // blockquoteと.blockquote-like内のすべてのbrタグを処理
        const containers = document.querySelectorAll('.entry-content blockquote, .entry-content .blockquote-like');

        containers.forEach(function (container) {
            const brElements = container.querySelectorAll('br');

            brElements.forEach(function (br, index) {
                // 前の兄弟要素をチェック
                let previousSibling = br.previousSibling;

                // テキストノードで空白のみの場合はスキップ
                while (previousSibling && previousSibling.nodeType === Node.TEXT_NODE && previousSibling.textContent.trim() === '') {
                    previousSibling = previousSibling.previousSibling;
                }

                // 直前の要素がbrタグの場合、現在のbrを削除
                if (previousSibling && previousSibling.nodeName === 'BR') {
                    br.remove();
                }
            });
        });
    }

    // DOMの準備ができたら実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', removeConsecutiveBr);
    } else {
        removeConsecutiveBr();
    }
})();
