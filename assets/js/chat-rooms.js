/**
 * chat-rooms.js
 *
 * トップページのチャットルーム一覧 ([data-chat-rooms]) を描画する。
 * - data-community-api-domain (= @custom.chat_api_domain) を読み取り、
 *   `${domain}/api/v1/unleash/chat/rooms` を認証なしで GET する
 * - 空の場合は同一ドメインの相対パスを使う
 * - レスポンスの available を描画する (joined はログイン連携が未対応のため通常は空)
 * - 取得失敗・ルーム0件の場合はセクションを非表示のままにする
 *
 * source.js に結合され全ページで読み込まれるため、コンテナが無ければ何もしない。
 */

const CHAT_ROOMS_PATH = '/api/v1/unleash/chat/rooms?limit=3';

// ドメイン設定から末尾スラッシュを除いた文字列を返す。空なら空文字列（同一オリジン）。
function normalizeDomain(domain) {
    return (domain || '').trim().replace(/\/+$/, '');
}

function buildRoomsUrl(domain) {
    const base = normalizeDomain(domain);
    return base ? `${base}${CHAT_ROOMS_PATH}` : CHAT_ROOMS_PATH;
}

function buildRoomUrl(webDomain, uuid) {
    const base = normalizeDomain(webDomain);
    return base ? `${base}/rooms/${uuid}/messages` : `/rooms/${uuid}/messages`;
}

function buildRoomsIndexUrl(webDomain) {
    const base = normalizeDomain(webDomain);
    return base ? `${base}/rooms` : '/rooms';
}

// アイコン URL は http(s) のみ許可する (javascript: などのスキーム混入を防ぐ)。
function isSafeIconUrl(url) {
    if (typeof url !== 'string' || url === '') {
        return false;
    }
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

// ルーム1件分のカード要素を生成する。画像とタイトルのみを表示する。
// name は API 由来の外部入力のため textContent で挿入する。
function createRoomCard(room, webDomain) {
    const link = document.createElement('a');
    link.className = 'gh-chat-room-card';
    link.href = buildRoomUrl(webDomain, room.uuid);

    if (isSafeIconUrl(room.icon_url)) {
        const icon = document.createElement('img');
        icon.className = 'gh-chat-room-icon';
        icon.src = room.icon_url;
        icon.alt = '';
        icon.loading = 'lazy';
        link.appendChild(icon);
    } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'gh-chat-room-icon gh-chat-room-icon--placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        placeholder.textContent = (room.name || '').trim().charAt(0).toUpperCase();
        link.appendChild(placeholder);
    }

    const name = document.createElement('h3');
    name.className = 'gh-chat-room-name';
    name.textContent = room.name || '';
    link.appendChild(name);

    return link;
}

function renderRooms(feed, rooms, webDomain) {
    const fragment = document.createDocumentFragment();
    rooms.forEach((room) => {
        fragment.appendChild(createRoomCard(room, webDomain));
    });
    feed.appendChild(fragment);
}

async function fetchRooms(domain) {
    const res = await fetch(buildRoomsUrl(domain), {
        method: 'GET',
        headers: {Accept: 'application/json'}
    });
    if (!res.ok) {
        // eslint-disable-next-line ghost/ghost-custom/no-native-error
        throw new Error(`Chat rooms GET API failed: ${res.status}`);
    }
    return res.json();
}

async function initializeChatRooms(section) {
    const feed = section.querySelector('[data-chat-rooms-feed]');
    if (!feed) {
        return;
    }

    try {
        const apiDomain = section.getAttribute('data-community-api-domain');
        const webDomain = section.getAttribute('data-community-web-domain');
        const data = await fetchRooms(apiDomain);
        // joined (参加中) はログイン連携が未対応のため通常は空。
        // 連携時に joined を専用セクションへ出し分ける拡張余地を残しつつ、今は available と合わせて描画する。
        // 取得自体を limit=3 に絞っているため、ここでの件数制限は不要。
        const rooms = [...(data.joined || []), ...(data.available || [])];
        if (rooms.length === 0) {
            return;
        }

        renderRooms(feed, rooms, webDomain);

        const moreLink = section.querySelector('[data-chat-rooms-more]');
        if (moreLink) {
            moreLink.href = buildRoomsIndexUrl(webDomain);
        }

        section.hidden = false;
    } catch (error) {
        console.error('[chat-rooms] チャットルーム一覧の取得に失敗しました:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const section = document.querySelector('[data-chat-rooms]');
    if (!section) {
        return;
    }
    initializeChatRooms(section);
});
