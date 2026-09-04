// OIDC トークンの持ち主と Ghost の会員が食い違ったとき、取り直しを一度だけに留めるための印。
// 取り直しても解消しない場合に無限リロードになるのを防ぐ
const OIDC_MEMBER_RESYNC_KEY = 'fms-oidc-member-resync';

/**
 * OIDC トークンの持ち主が、いま Ghost にログインしている会員と一致するか確かめる。
 * 食い違っていればトークンを破棄してリロードし、現在の会員で取り直す。
 *
 * OIDC のトークンは mp-tkm のサーバーセッションに保持されており、Ghost 側だけで会員が
 * 切り替わっても更新されない。前の会員のトークンのまま EC を操作すると、カートの紐づけも
 * 注文の確定もその会員として行われてしまう。
 *
 * @param {string} memberUuid - Ghost のログイン会員の uuid
 * @returns {Promise<boolean>} 以降の EC 初期化を中止すべきなら true
 */
async function ensureOidcMemberMatches(memberUuid) {
  if (!memberUuid || !window.FMS.oidc.isLogin()) {
    sessionStorage.removeItem(OIDC_MEMBER_RESYNC_KEY);
    return false;
  }

  // 未提供（古い mp-fms-js）や IDトークンから取れなかった場合は持ち主を判定できない。
  // 判定できないことを食い違いとして扱うと、正常な利用者まで EC を使えなくしてしまう
  const tokenUserId = window.FMS.oidc.getUserId?.();
  if (typeof tokenUserId !== 'string' || !tokenUserId) {
    return false;
  }

  if (tokenUserId === memberUuid) {
    sessionStorage.removeItem(OIDC_MEMBER_RESYNC_KEY);
    return false;
  }

  if (sessionStorage.getItem(OIDC_MEMBER_RESYNC_KEY) === memberUuid) {
    // 取り直しても解消しなかった。前の会員として注文が成立してしまうため EC は起動しない
    console.error('OIDC トークンの持ち主がログイン会員と一致しないため、EC の初期化を中止しました');
    window.FMS.sendException?.(new Error('OIDC token subject does not match the logged-in member'), true);
    return true;
  }

  sessionStorage.setItem(OIDC_MEMBER_RESYNC_KEY, memberUuid);
  const result = await window.FMS.oidc.logout();
  if (result && !result.ok) {
    console.error(`前の会員の OIDC セッションのクリアに失敗しました: ${result.reason}`);
  }
  location.reload();
  return true;
}

/**
 * EC 初期化スクリプト
 * FMS ローダー・OIDC 認証・カート UI の起動を行う。
 *
 * @param {Object} opts
 * @param {boolean} opts.isGhostMember - Ghost のログイン状態（Handlebars でサーバーサイド判定）
 * @param {string}  opts.memberUuid    - Ghost のログイン会員の uuid（未ログイン時は空文字）
 * @param {string}  opts.servicePath   - FMS サービスパス
 * @param {string}  opts.apiKey        - FMS API キー
 */
async function initEC({ isGhostMember, memberUuid, servicePath, apiKey }) {
  // Ghost がサブディレクトリ配下にあっても nginx の location はルートなので @site.url は使わない
  const origin = window.location.origin;

  // ローカル開発は各サービスを個別ポートの Vite dev サーバーで動かす（Unleash の
  // unleash/docker/compose.ec.dev.yml）。Vite dev は base 未設定ではパス prefix 配下に置けないため、
  // nginx の集約経路ではなくポートへ直接つなぐ
  const isDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  // デプロイ先では nginx がサイトと同一オリジンの固定パスへ集約する（Unleash の
  // nginx.snippets/ec-sns.locations.conf との契約）。/fms-js/・/cart/・/tkm/ は prefix を剥がして
  // 転送されるので base に prefix を含め、mp-medusa（/store/・/fms/・/uploads/）と
  // mp-base-api（servicePath 配下）は剥がさず転送されるためオリジンそのままになる
  const MP_FMS_JS_URL   = isDev ? 'http://localhost:18081' : `${origin}/fms-js`;
  const MP_FMS_CART_URL = isDev ? 'http://localhost:18083' : `${origin}/cart`;
  const MP_BASE_API_URL = isDev ? 'http://localhost:18082' : origin;
  const MP_TKM_URL      = isDev ? 'http://localhost:18080' : `${origin}/tkm`;
  const MP_MEDUSA_URL   = isDev ? 'http://localhost:9000'  : origin;

  // ローダーだけ先に読み込む（カートは OIDC 認証状態の確定後に読み込む）
  if (isDev) {
    await import(`${MP_FMS_JS_URL}/src/loader/index.js`);
    // dev では Vite dev サーバーが manifest.json を配信しないため手動設定
    // （本番では FMS.load() 内部で ${baseUrl}/loader/manifest.json を自動取得する）
    window.FMS.setManifest({
      'oidc':      { file: 'src/tkm/oidc.js', deps: [] },
      'base/user': { file: 'src/base/user/user-api.js', deps: ['oidc'] },
      'unleash':   { file: 'src/unleash/unleash.js', deps: ['oidc', 'base/user'] },
      'cart':      { file: `${MP_FMS_CART_URL}/src/main.ts`, deps: ['oidc', 'base/user'] }
    });
  } else {
    await import(`${MP_FMS_JS_URL}/loader/index.js`);
  }

  FMS.load(['oidc', 'base/user', 'unleash'], {
    baseUrl: MP_FMS_JS_URL,
    servicePath,
    apiBaseUrl: MP_BASE_API_URL,
    tkmDomain: MP_TKM_URL,
    silentLogin: isGhostMember
  }, async (baseUser, unleash) => {
    // 認証を使う処理より先に判定する。前の会員のトークンのまま
    // baseUser.init() やカートを動かすと、その会員として扱われてしまう
    if (await ensureOidcMemberMatches(memberUuid)) {
      return;
    }

    if (isGhostMember) {
      try {
        await baseUser.init();
      } catch (error) {
        // 認証初期化に失敗しても商品リストは表示する
        console.error('FMS base/user の初期化に失敗しました', error);
      }
      // baseUser.init() の成否に依存させない。ここに到達しないと
      // ナビゲーションの Log Out が使えなくなる
      unleash.init();
    } else if (window.FMS.oidc.isLogin()) {
      // Ghost は未ログインだが OIDC セッションが残っている場合: 強制クリア
      const result = await window.FMS.oidc.logout();
      if (result && !result.ok) {
        console.error(`残存 OIDC セッションのクリアに失敗しました: ${result.reason}`);
      }
    }

    // OIDC 認証状態が確定してからカート UI を読み込む
    // （Cart コンポーネントは isLogin() をマウント時に評価するため）
    // dev: Vite dev サーバーが TS を直接配信 / 本番: ビルド済み JS を使用
    if (isDev) {
      await import(`${MP_FMS_CART_URL}/src/main.ts`);
    } else {
      await import(`${MP_FMS_CART_URL}/js/main.js`);
    }

    await window.FMS.initialize({ k: apiKey, h: MP_MEDUSA_URL });

    // カート変更バッジの更新を購読
    if (window.FMS.cart && window.FMS.cart.addEventListener) {
      window.FMS.cart.addEventListener('cartChange', function (count) {
        var badge = document.getElementById('gh-cart-badge');
        if (badge) {
          badge.textContent = count;
          badge.style.display = count > 0 ? '' : 'none';
        }
      });
    }
  });
}
