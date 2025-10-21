/**
 * URLクエリパラメータとパスを解析して検索フィルター条件を取得
 * @returns {Object} 検索パラメータオブジェクト
 * @returns {string} returns.s - 検索クエリ文字列
 * @returns {number} returns.page - ページ番号
 */
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);

    // URLパスからページ番号を取得 (例: /page/2/ -> 2)
    const pageMatch = window.location.pathname.match(/\/page\/(\d+)/);
    const page = pageMatch ? parseInt(pageMatch[1], 10) : 1;

    return {
        s: params.get('s') || '',
        page: page,
    };
}

function setUrlParams(params) {
    const url = new URL(window.location.href);
    const searchParams = new URLSearchParams();

    if (params.s) {
        searchParams.set('s', params.s);
    }

    url.search = searchParams.toString();
    window.history.replaceState({}, '', url.toString());
}

function getSearchFilter(params) {
    const { s } = params;

    const filters = [];

    if (s) {
        filters.push(`title:~'${s}'`);
    }

    return filters.join('+');
}
