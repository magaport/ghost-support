/**
 * 分配金用の集計レコードの追加
 *
 * @param {string | null} postId
 */
async function recordPostByPaidMemberView(postId) {
    if (!postId) {
        return;
    }

    try {
        await fetch(`/members/api/posts/${postId}/page-views`, {
            method: 'POST',
            credentials: 'include',
        });
    } catch  {
        // no-op
    }
}

/**
 * 閲覧履歴レコードの追加
 *
 * @param {string | null} postId
 */
async function recordPostView(postId) {
    if (!postId) {
        return;
    }

    const contentApiKey = window.ghostConfig.contentApiKey;
    const searchParams = new URLSearchParams({
        key: contentApiKey,
    });

    const uuid = window.currentMember?.uuid;
    if (uuid) {
        searchParams.append("member_uuid", uuid)
    }

    try {
        await fetch(`/ghost/api/content/posts/${postId}/views?${searchParams.toString()}`, {
            method: 'POST',
        });
    } catch  {
        // no-op
    }
}

