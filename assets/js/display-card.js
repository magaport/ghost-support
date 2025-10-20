/**
 * 投稿データからpost-card.hbsパーシャルと同様のHTMLカードを生成
 * @param {Object} post - 投稿オブジェクト
 * @param {string} post.url - 投稿のURL
 * @param {string} post.title - 投稿のタイトル
 * @param {string} [post.feature_image] - アイキャッチ画像のURL
 * @param {string} [post.feature_image_alt] - アイキャッチ画像の代替テキスト
 * @param {string} [post.published_at] - 公開日時
 * @param {Array} [post.tags] - タグ情報の配列
 * @param {boolean} [lazyLoad=true] - 遅延読み込みを有効にするか
 * @returns {string} HTMLカードの文字列
 */
function createPostCard(post, lazyLoad = true) {
    // タグ情報をJSON文字列に変換
    const tagsJson =
        post.tags && post.tags.length > 0
            ? JSON.stringify(
                  post.tags.map((tag) => ({
                      slug: tag.slug,
                      name: tag.name,
                      url: tag.url
                  }))
              )
            : '';

    // アイキャッチ画像のHTML
    const imageHtml = post.feature_image
        ? `<img
                src="${post.feature_image}"
                alt="${post.feature_image_alt || post.title}"
                ${lazyLoad ? 'loading="lazy"' : ''}
            >`
        : `<img
                src="/assets/images/noimage.png"
                alt="No Image"
                ${lazyLoad ? 'loading="lazy"' : ''}
            >`;

    return `<article class="post-card" data-magazine-tags='${tagsJson}'>
    <a class="post-card__link" href="${post.url}">
        <div class="post-card__image">
            ${imageHtml}
        </div>

        <div class="post-card__info">
            <h2>
                <span class="new-badge" data-published="${
                    post.published_at || ''
                }" style="display:none;color:#F00;">New</span>${post.title}
            </h2>
        </div>
    </a>
    <div class="magazine-tag-placeholder"></div>
</article>`;
}

/**
 * 投稿カードを表示
 * @param {Array} posts - 投稿一覧
 * @param {string} selector - セクションのセレクタ
 */
function displayArticleCards(posts, selector) {
    const container = document.querySelector(selector);
    if (!container) {
        return;
    }

    posts.forEach((post) => {
        const cardHtml = createPostCard(post);
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}

function clearElements(selector) {
    const container = document.querySelector(selector);
    if (container) {
        container.innerHTML = '';
    }
}

function displaySearchResultsSummary(selector, searchQuery = '') {
    const container = document.querySelector(selector);
    if (!container) {
        return;
    }

    container.innerHTML = `
        <h1 class='search_results__header-title'>
            <i class="fa fa-search" aria-hidden="true"></i> 「${searchQuery}」 の検索結果
        </h1>
    `;
}

async function displayNoResultsMessage(selector) {
    const container = document.querySelector(selector);
    if (!container) {
        return;
    }

    container.innerHTML = `
        <article class="notfound">
            <div class="nofound-title">
                <i class="fa fa-tint fa-lg"></i>
                記事が見つかりませんでした。
            </div>
            <div class="nofound-img">
                <img src="/assets/images/notfound.jpg" alt="記事が見つかりませんでした">
            </div>
            <div class="nofound-contents">
                <p>指定されたキーワードでは記事が見つかりませんでした。別のキーワード、もしくはカテゴリーから記事をお探しください。</p>
                <form role="search" method="get" id="searchform" class="searchform" action="/">
                    <div>
                        <input type="search" id="s" name="s" value="" class="search-results-input">
                        <button type="submit" id="searchsubmit"><i class="fa fa-search"></i></button>
                    </div>
                </form>
                <p>以下のカテゴリー一覧から記事を探すこともできます。</p>
                <div class="withtag_list">
                    <span>カテゴリー</span>
                    <ul id="category-list-placeholder">
                        <li>読み込み中...</li>
                    </ul>
                </div>
                <div class="ct">
                    <a class="raised accent-bc" href="/"><i class="fa fa-home"></i> ホームに戻る</a>
                </div>
            </div>
        </article>
   `;

    await loadCategoryList();
}

async function loadCategoryList() {
    try {
        const data = await fetchTags();
        const categoryListElement = document.getElementById(
            'category-list-placeholder'
        );
        if (!categoryListElement || !data.tags) {
            return;
        }

        const tagsMap = {};
        data.tags.forEach((tag) => {
            tagsMap[tag.slug] = tag;
        });

        let categoryItems = '';
        categories.forEach((category) => {
            categoryItems += `<li class="cat-item"><a href="${category.url}">${category.name}</a>`;

            if (category.slugs.length > 0) {
                categoryItems += '<ul class="children">';
                category.slugs.forEach((slug) => {
                    const tag = tagsMap[slug];
                    if (tag) {
                        categoryItems += `<li class="cat-item"><a href="${tag.url}">${tag.name}</a></li>`;
                    }
                });
                categoryItems += '</ul>';
            }

            categoryItems += '</li>';
        });

        categoryListElement.innerHTML = categoryItems;
    } catch {
        const categoryListElement = document.getElementById(
            'category-list-placeholder'
        );
        if (categoryListElement) {
            categoryListElement.innerHTML =
                '<li>カテゴリーの読み込みに失敗しました</li>';
        }
    }
}
