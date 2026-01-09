function useFetchPosts(postsSelector, baseParams) {
    const contentApiKey = window.ghostConfig.contentApiKey;
    const searchParams = new URLSearchParams({
        key: contentApiKey,
        include: baseParams.include || 'tags,group',
        filter: baseParams.filter || '',
        page: baseParams.page || 1,
        limit: baseParams.limit || 'all',
        order: baseParams.order || 'published_at DESC'
    });
    const loadMoreButton = document.querySelector('#load-more button');

    // 検索コンテキスト（検索クエリがある場合のページネーション用）
    let searchContext = {
        query: '',
        sort: 'relevance',
        page: 1
    };

    async function fetchPosts(additionalParams = {}) {
        Array.from(additionalParams).forEach(([key, value]) => {
            searchParams.set(key, value);
        });

        try {
            const response = await fetch(
                `/ghost/api/content/posts/?${searchParams.toString()}`
            );

            if (!response.ok) {
                return {
                    posts: [],
                    hasNext: false,
                    count: 0
                };
            }

            const data = await response.json();

            return {
                posts: data.posts || [],
                hasNext: data.meta.pagination.next !== null,
                count: data.meta.pagination.total
            }
        } catch (error) {
            return {
                posts: [],
                hasNext: false,
                count: 0
            };
        }
    }

    /**
     * Algolia全文検索エンドポイントを使用して投稿を検索
     *
     * @param {string} query - 検索クエリ
     * @param {Object} additionalParams - 追加のパラメータ
     * @param {number} additionalParams.page - ページ番号
     * @param {string} additionalParams.sort - ソート順（published_at | page_view_count | relevance）
     * @param {string[]} additionalParams.tags - タグ slug の配列
     * @param {string[]} additionalParams.groups - グループ ID の配列
     * @returns {Promise<{posts: Array, hasNext: boolean, count: number}>}
     */
    async function searchPosts(query, additionalParams = {}) {
        const params = new URLSearchParams({
            key: contentApiKey,
            q: query,
            page: additionalParams.page || 1,
            limit: baseParams.limit || 15,
            sort: additionalParams.sort || 'relevance',
            type: 'post'
        });

        if (additionalParams.tags && additionalParams.tags.length > 0) {
            params.set('tags', additionalParams.tags.join(','));
        }

        if (additionalParams.groups && additionalParams.groups.length > 0) {
            params.set('groups', additionalParams.groups.join(','));
        }

        try {
            const response = await fetch(
                `/ghost/api/content/search?${params.toString()}`
            );

            if (!response.ok) {
                return {
                    posts: [],
                    hasNext: false,
                    count: 0
                };
            }

            const data = await response.json();

            return {
                posts: data.posts || [],
                hasNext: data.meta?.pagination?.next !== null,
                count: data.meta?.pagination?.total || 0
            };
        } catch (error) {
            return {
                posts: [],
                hasNext: false,
                count: 0
            };
        }
    }

    async function displayPosts(posts, hasNext) {
        displayArticleCards(posts, postsSelector);

        if (!hasNext) {
            toggleLoadMoreButton(false);
        }
    }

    /**
     * 検索コンテキストを設定
     * 検索クエリがある場合のページネーションに使用
     *
     * @param {Object} context - 検索コンテキスト
     * @param {string} context.query - 検索クエリ
     * @param {string} context.sort - ソート順
     */
    function setSearchContext(context) {
        searchContext = {
            query: context.query || '',
            sort: context.sort || 'relevance',
            page: 1
        };
    }

    async function loadMore() {
        // 検索クエリがある場合は searchPosts を使用
        if (searchContext.query) {
            searchContext.page += 1;
            const {posts, hasNext} = await searchPosts(searchContext.query, {
                page: searchContext.page,
                sort: searchContext.sort
            });
            if (posts.length > 0) {
                await displayPosts(posts, hasNext);
            } else {
                toggleLoadMoreButton(false);
            }
            return;
        }

        // 検索クエリがない場合は従来の fetchPosts を使用
        const pageNumber = Number(searchParams.get('page'));
        const currentPage = isNaN(pageNumber) ? 1 : pageNumber;
        searchParams.set('page', currentPage + 1);

        const {posts, hasNext} = await fetchPosts({page: currentPage + 1});
        if (posts.length > 0) {
            await displayPosts(posts, hasNext);
        } else {
            toggleLoadMoreButton(false);
        }
    }

    /**
     * 「もっと見る」ボタンのクリックイベントを処理
     */
    function handleLoadMoreButton() {
        if (!loadMoreButton) {
            return;
        }

        loadMoreButton.addEventListener('click', async (e) => {
            e.preventDefault();
           await loadMore();
        });
    }

    /**
     * もっと見るボタンの表示/非表示を切り替え
     *
     * @param {boolean} isShow - trueなら表示、falseなら非表示
     */
    async function toggleLoadMoreButton(isShow) {
        if (!loadMoreButton) {
            return;
        }

        const displayStyle = isShow ? 'block' : 'none';
        loadMoreButton.style.display = displayStyle;
    }

    return {fetchPosts, searchPosts, setSearchContext, displayPosts, handleLoadMoreButton, toggleLoadMoreButton};
}
