/**
 * AmazonJS要素を生成して表示する
 */
document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('amazonjs-container');

    if (!container) return;

    // 既にコンテンツ内にamazonjs要素がある場合は重複を避ける
    const existingAmazonjs = document.querySelector('.entry-content [data-role="amazonjs"]');
    if (existingAmazonjs) {
        // 既存の要素をコンテナに移動
        container.appendChild(existingAmazonjs);
        return;
    }

    const excerptData = container.getAttribute('data-excerpt');

    if (!excerptData) return;

    // excerptからJSONデータを抽出
    let amazonCode = null;
    try {
        const jsonMatch = excerptData.match(/\{[^}]+\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            amazonCode = data.amazon_code;
        }
    } catch (e) {
        console.error('Failed to parse excerpt JSON:', e);
        return;
    }

    if (!amazonCode) return;

    // 現在の投稿のタイトルとURLを取得
    const postTitle = document.querySelector('.entry-title')?.textContent?.trim() || '';
    const postUrl = window.location.href;

    // AmazonJS要素を生成
    const amazonjsElement = document.createElement('div');
    amazonjsElement.className = 'amazonjs_item';
    amazonjsElement.setAttribute('data-role', 'amazonjs');
    amazonjsElement.setAttribute('data-asin', amazonCode);
    amazonjsElement.setAttribute('data-locale', 'JP');

    amazonjsElement.innerHTML = `
        <div class="amazonjs_indicator">
            <a class="amazonjs_indicator_title" href="${postUrl}">${postTitle}</a>
        </div>
    `;

    // コンテナに追加
    container.appendChild(amazonjsElement);
});
