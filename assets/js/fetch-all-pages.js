/**
 * Fetch all pages using Ghost Content API
 * Ghost's {{#get}} helper is limited to 100 items max
 */

async function fetchAllPages() {
    const apiKey = window.ghostConfig?.contentApiKey;
    if (!apiKey) {
        console.error('API key not found');
        return [];
    }

    let allPages = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const params = new URLSearchParams({
            key: apiKey,
            limit: 100,
            page: page,
            order: 'slug desc',
            fields: 'slug,url,title'
        });

        try {
            const response = await fetch(`/ghost/api/content/pages/?${params.toString()}`);
            const data = await response.json();

            if (data.pages && data.pages.length > 0) {
                allPages = allPages.concat(data.pages);
                page++;

                // Check if there are more pages
                hasMore = data.meta.pagination.pages > data.meta.pagination.page;
            } else {
                hasMore = false;
            }
        } catch (error) {
            console.error('Error fetching pages:', error);
            hasMore = false;
        }
    }

    console.log('Total pages fetched:', allPages.length);
    return allPages;
}

// Export for use in other scripts
window.fetchAllPages = fetchAllPages;
