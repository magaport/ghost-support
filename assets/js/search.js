(function () {
    'use strict';

    // トップページまたはページネーションページでのみ実行
    const isHomePage =
        window.location.pathname === '/' ||
        /^\/page\/\d+\/?$/.test(window.location.pathname);
    if (!isHomePage) {
        return;
    }

    const POSTS_PER_PAGE = 40;

    // DOMContentLoaded後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    const cardContainerSelector = '#search-results-container';
    const {fetchPosts, displayPosts} = useFetchPosts(
        cardContainerSelector,
        {
            include: 'tags,group',
            page: 1,
            limit: POSTS_PER_PAGE,
            order: 'published_at DESC'
        }
    );

    async function initialize() {
        // イベントハンドラの登録
        handleFormSubmit();

        const params = getUrlParams();

        // クエリパラメータの有無とページ番号で表示/非表示を制御
        const urlParams = new URLSearchParams(window.location.search);
        const isSearchMode = urlParams.has('s');
        const isPageTwo = params.page >= 2;
        toggleSearchResultsMode(isSearchMode, isPageTwo);

        const filter = getSearchFilter(params);
        const searchParams = new URLSearchParams({
            filter,
            page: params.page
        });
        await displaySearchResults(searchParams);
    }

    async function displaySearchResults(searchParams) {
        const searchHeaderElement = '.search_results__header';
        clearElements(cardContainerSelector);
        clearElements(searchHeaderElement);

        const params = getUrlParams();
        const {posts, hasNext, count} = await fetchPosts(searchParams);

        displaySearchResultsSummary(searchHeaderElement, params.s);

        if (posts.length > 0) {
            await displayPosts(posts, hasNext);
            updatePaginationMetadata(count);
        } else {
            displayNoResultsMessage(cardContainerSelector);
            // 検索結果が0件の場合はページネーションを非表示
            const searchPaginationWrap = document.querySelector(
                '.search-pagination-wrap'
            );
            if (searchPaginationWrap) {
                searchPaginationWrap.style.display = 'none';
            }
        }
    }

    function updatePaginationMetadata(totalCount) {
        const paginationElement = document.querySelector(
            '.pagination[data-current-page]'
        );
        if (!paginationElement) {
            return;
        }

        const params = getUrlParams();
        const totalPages = Math.ceil(totalCount / POSTS_PER_PAGE);

        paginationElement.setAttribute('data-current-page', params.page);
        paginationElement.setAttribute('data-total-pages', totalPages);

        // ページネーション番号を再レンダリング
        if (typeof renderPaginationNumbers === 'function') {
            renderPaginationNumbers();
        }
    }

    function handleFormSubmit() {
        const searchForm = document.querySelector('form[id="search-form"]');

        if (!searchForm) {
            return;
        }

        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const searchInput = document.getElementById('search-results-input');
            const searchQuery = searchInput ? searchInput.value.trim() : '';
            await submitForm(searchQuery);
        });
    }

    async function submitForm(searchQuery) {
        setUrlParams({s: searchQuery});

        // クエリパラメータの有無で表示/非表示を制御
        const urlParams = new URLSearchParams(window.location.search);
        toggleSearchResultsMode(urlParams.has('s'), false);

        const filter = getSearchFilter({s: searchQuery});
        const params = new URLSearchParams({
            filter,
            page: 1
        });
        await displaySearchResults(params);
    }

    function toggleSearchResultsMode(isSearchMode, isPageTwoOrMore) {
        const contentMenuWrap = document.querySelector('.content-menu-wrap');
        const searchHeader = document.querySelector('.search_results__header');
        const loadMoreWrap = document.querySelector('.load-more-wrap');
        const searchPaginationWrap = document.querySelector(
            '.search-pagination-wrap'
        );

        if (isSearchMode) {
            // 検索モード: content-menu-wrapを非表示、ページネーションを表示
            contentMenuWrap && (contentMenuWrap.style.display = 'none');
            searchHeader && (searchHeader.style.display = 'block');
            loadMoreWrap && (loadMoreWrap.style.display = 'none');
            searchPaginationWrap &&
                (searchPaginationWrap.style.display = 'block');
        } else if (isPageTwoOrMore) {
            // 2ページ目以降（検索なし）: content-menu-wrapを表示、もっと見るを非表示、ページネーションを表示
            contentMenuWrap && (contentMenuWrap.style.display = '');
            searchHeader && (searchHeader.style.display = 'none');
            loadMoreWrap && (loadMoreWrap.style.display = 'none');
            searchPaginationWrap &&
                (searchPaginationWrap.style.display = 'block');
        } else {
            // 通常モード（1ページ目）: content-menu-wrapを表示、search_results__headerとページネーションを非表示
            contentMenuWrap && (contentMenuWrap.style.display = '');
            searchHeader && (searchHeader.style.display = 'none');
            loadMoreWrap && (loadMoreWrap.style.display = '');
            searchPaginationWrap &&
                (searchPaginationWrap.style.display = 'none');
        }
    }
})();
