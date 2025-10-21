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
            };
        } catch (error) {
            return {
                posts: [],
                hasNext: false,
                count: 0
            };
        }
    }

    async function displayPosts(posts) {
        displayArticleCards(posts, postsSelector);
    }

    return {fetchPosts, displayPosts};
}
