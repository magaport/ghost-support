(function() {
    'use strict';

    // 検索結果ページでのみ実行
    if (window.location.pathname !== '/search-results/') {
        return;
    }

    const POSTS_PER_PAGE = 15;

    // DOMContentLoaded後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    const cardContainerSelector = '#search-results-container';
    const {fetchPosts, searchPosts, setSearchContext, displayPosts, handleLoadMoreButton, toggleLoadMoreButton} = useFetchPosts(cardContainerSelector, {
        include: 'tags,group',
        page: 1,
        limit: POSTS_PER_PAGE,
        order: 'published_at DESC',
    });

    async function initialize() {
        // イベントハンドラの登録
        handleFormSubmit();
        handleLoadMoreButton();
        handleAccordion();

        const params = getUrlParams();
        initializeForm(params);

        const filter = getSearchFilter(params);
        const filterParams = new URLSearchParams({
            filter,
            order: params.order === 'newest' ? 'published_at DESC' : 'popularity.7 DESC',
        });
        const sort = params.order === 'newest' ? 'published_at' : 'page_view_count';
        await displaySearchResults({
            query: params.q,
            filterParams,
            sort,
            tags: params.tags,
            groups: params.groups
        });
    }

    /**
     * 検索結果を表示
     *
     * @param {Object} options - 検索オプション
     * @param {string} options.query - 検索クエリ（空の場合はフィルタのみで検索）
     * @param {URLSearchParams} options.filterParams - フィルタ用パラメータ（クエリがない場合に使用）
     * @param {string} options.sort - ソート順（published_at | page_view_count）
     * @param {string[]} options.tags - タグ slug の配列
     * @param {string[]} options.groups - グループ ID の配列
     */
    async function displaySearchResults({query, filterParams, sort, tags, groups}) {
        clearElements(cardContainerSelector);
        clearElements('.search_results__header');

        // ページネーション用に検索コンテキストを設定
        setSearchContext({query, sort});

        let result;
        if (query) {
            // 検索クエリがある場合はAlgolia全文検索を使用
            result = await searchPosts(query, {page: 1, sort, tags, groups});
        } else {
            // 検索クエリがない場合は従来のフィルタ検索を使用
            result = await fetchPosts(filterParams);
        }

        const {posts, hasNext, count} = result;
        if (posts.length > 0) {
            displaySearchResultsSummary('.search_results__header', count);
            await displayPosts(posts, hasNext);
        } else {
            toggleLoadMoreButton(false);
            displayNoResultsMessage('.search_results__header');
        }
    }

    function handleFormSubmit() {
        const resultForm = document.querySelector('form[id="posts"]');
        const headerForm = document.querySelector('form[id="header-search-form"]');

        [resultForm, headerForm].forEach((form) => {
            if (!form) {
                return;
            }

            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const searchInput = document.getElementById('header-search-input');
                const searchQuery = searchInput ? searchInput.value.trim() : '';
                await submitForm(searchQuery);
            });
        });

        const spForm = document.querySelector('form[id="posts-sp"]');
        spForm?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const searchInput = document.getElementById('search-results-input');
            const searchQuery = searchInput ? searchInput.value.trim() : '';
            await submitForm(searchQuery);
        });

        const orderSelect = document.querySelector('.search_results__sort-dropdown');
        orderSelect?.addEventListener('change', async () => {
            const searchInput = document.getElementById('header-search-input') || document.getElementById('search-results-input');
            const searchQuery = searchInput ? searchInput.value.trim() : '';
            await submitForm(searchQuery);
        });
    }

    async function submitForm(searchQuery) {
        const tagCheckboxes = document.querySelectorAll('input[name="tag"]:checked');
        const selectedTags = Array.from(tagCheckboxes).map(checkbox => checkbox.value).filter(Boolean);

        const groupCheckboxes = document.querySelectorAll('input[name="magazine"]:checked');
        const selectedGroups = Array.from(groupCheckboxes).map(checkbox => checkbox.value).filter(Boolean);

        const orderSelect = document.querySelector('.search_results__sort-dropdown');
        const order = getSearchOrder(orderSelect?.value);

        setUrlParams({q: searchQuery, tags: selectedTags, groups: selectedGroups, order: orderSelect.value});

        const filter = getSearchFilter({q: searchQuery, tags: selectedTags, groups: selectedGroups});
        const filterParams = new URLSearchParams({
            filter,
            page: 1,
            order
        });
        const sort = orderSelect?.value === 'newest' ? 'published_at' : 'page_view_count';
        await displaySearchResults({
            query: searchQuery,
            filterParams,
            sort,
            tags: selectedTags,
            groups: selectedGroups
        });
    }
})();
