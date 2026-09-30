/**
 * post_like.js
 *
 * - テーマ側のJSとしてロードすると、ページ読み込み時に
 *   すべての .gh-post-like-button の状態を取得し、いいね数と「いいね済みか」を反映
 * - ボタンクリックでPOST/DELETEしていいね数を更新
 *
 * GhostのContent APIエンドポイント (例: /ghost/api/content/posts/:postId/like?key=YOUR_API_KEY) を想定
 */

// Cookie セッションから GhostMembers JWT を取得してキャッシュする
// Content API の認証には Authorization: GhostMembers <token> が必要
let memberTokenCache;
const getMemberToken = async () => {
    if (memberTokenCache !== undefined) {
        return memberTokenCache;
    }
    try {
        const res = await fetch('/members/api/session', {credentials: 'include'});
        if (!res.ok) {
            memberTokenCache = null;
            return null;
        }
        const token = await res.text();
        memberTokenCache = token || null;
        return memberTokenCache;
    } catch {
        memberTokenCache = null;
        return null;
    }
};

const getPostLike = async (postId, contentApiKey) => {
    const token = await getMemberToken();
    const res = await fetch(`/ghost/api/content/posts/${postId}/like?key=${contentApiKey}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            ...(token ? {Authorization: `GhostMembers ${token}`} : {})
        }
    });
    if (!res.ok) {
        // eslint-disable-next-line ghost/ghost-custom/no-native-error
        throw new Error(`Like GET API failed: ${res.status}`);
    }

    const data = await res.json();
    return data;
};

// いいねする会員はサーバーが GhostMembers トークンから決めるので、会員 ID は送らない。
// Ghost の API フレームワークは POST の本文に空でない post_likes を求めるので、本文を空にはできない
const addPostLike = async (postId, contentApiKey) => {
    const token = await getMemberToken();
    const res = await fetch(`/ghost/api/content/posts/${postId}/like?key=${contentApiKey}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? {Authorization: `GhostMembers ${token}`} : {})
        },
        body: JSON.stringify({
            post_likes: [{post_id: postId}]
        })
    });

    if (!res.ok) {
        // eslint-disable-next-line ghost/ghost-custom/no-native-error
        throw new Error(`Like POST API failed: ${res.status}`);
    }
    return;
};

const removePostLike = async (postId, contentApiKey) => {
    const token = await getMemberToken();
    const res = await fetch(`/ghost/api/content/posts/${postId}/like?key=${contentApiKey}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            ...(token ? {Authorization: `GhostMembers ${token}`} : {})
        }
    });

    if (!res.ok) {
        // eslint-disable-next-line ghost/ghost-custom/no-native-error
        throw new Error(`Like DELETE API failed: ${res.status}`);
    }

    return;
};

// -----(UIを初期化する関数)----------------------------
/**
 * ページ読み込み時に呼び出し:
 * - GET していいね数と「いいね済みか」を反映
 */
async function initializeLikeButtonUI(button) {
    const postId = button.getAttribute('data-post-id');
    const contentApiKey = button.getAttribute('data-content-api-key');

    if (!postId) {
        console.warn('[post-like] No postId, cannot proceed');
        return;
    }

    try {
        // いいね情報を取得
        // レスポンス形式: {"post_likes": [[{"count": N, "liked_by_me": bool}]]}
        const responsePostLikes = await getPostLike(postId, contentApiKey);
        const postLikesData = responsePostLikes.post_likes?.[0]?.[0] ?? {count: 0, liked_by_me: false};
        const likeCount = postLikesData.count;

        // liked_by_me はサーバーが GhostMembers トークンで判定した結果を使う
        const isLiked = postLikesData.liked_by_me;

        // data-liked属性を更新
        button.setAttribute('data-liked', String(isLiked));

        // カウントの表示
        const countSpan = button.closest('.gh-post-like-wrapper')?.querySelector('.gh-post-like-count');
        if (countSpan) {
            countSpan.textContent = String(likeCount);
        }

        // アイコン表示更新
        const icon = button.querySelector('.gh-post-like-icon');
        if (icon) {
            if (isLiked) {
                icon.classList.add('gh-post-like-icon--active');
            } else {
                icon.classList.remove('gh-post-like-icon--active');
            }
        }
    } catch (error) {
        console.error('[post-like] いいね情報の初期化に失敗しました:', error);
    }
}

// -----(クリック時の処理)----------------------------
/**
 * ボタンがクリックされたときに呼び出し:
 * - 「いいね済み」なら DELETE,
 * - 「未いいね」なら POST
 * - UIを更新
 */
async function handleLikeButtonClick(event) {
    const button = event.currentTarget;
    const postId = button.getAttribute('data-post-id');
    const contentApiKey = button.getAttribute('data-content-api-key');
    // 未ログイン？
    if (button.getAttribute('data-signed-in') !== 'true') {
        alert('ログインが必要です');
        return;
    }

    const currentIsLiked = (button.getAttribute('data-liked') === 'true');

    try {
        if (currentIsLiked) {
            await removePostLike(postId, contentApiKey);
        } else {
            await addPostLike(postId, contentApiKey);
        }
    } catch (error) {
        console.error('[post-like] いいね操作に失敗しました:', error);
        return;
    }

    // 成功したのでUIを更新
    const newIsLiked = !currentIsLiked;
    button.setAttribute('data-liked', String(newIsLiked));

    const icon = button.querySelector('.gh-post-like-icon');
    if (icon) {
        if (newIsLiked) {
            icon.classList.add('gh-post-like-icon--active');
        } else {
            icon.classList.remove('gh-post-like-icon--active');
        }
    }

    const countSpan = button.closest('.gh-post-like-wrapper')?.querySelector('.gh-post-like-count');
    if (countSpan) {
        let currentCount = parseInt(countSpan.textContent, 10) || 0;
        currentCount = newIsLiked ? currentCount + 1 : currentCount - 1;
        countSpan.textContent = String(currentCount);
    }
}

// -----(メイン: DOMContentLoaded)----------------------------
document.addEventListener('DOMContentLoaded', async () => {
    const button = document.querySelector('.gh-post-like-button');
    if (!button) {
        return;
    }

    // 1) 初期化 (GETして状態を反映)
    await initializeLikeButtonUI(button);

    // 2) クリック時の処理
    button.addEventListener('click', handleLikeButtonClick);
});