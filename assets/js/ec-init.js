/**
 * EC 初期化スクリプト
 * FMS ローダー・OIDC 認証・カート UI の起動を行う。
 *
 * @param {Object} opts
 * @param {boolean} opts.isGhostMember - Ghost のログイン状態（Handlebars でサーバーサイド判定）
 * @param {string}  opts.servicePath   - FMS サービスパス
 * @param {string}  opts.apiKey        - FMS API キー
 */
async function initEC({ isGhostMember, servicePath, apiKey }) {
  const config = window.EC_CONFIG || {};
  const MP_FMS_JS_URL  = config.MP_FMS_JS_URL  || 'http://localhost:18081';
  const MP_FMS_CART_URL = config.MP_FMS_CART_URL || 'http://localhost:18083';
  const MP_BASE_API_URL = config.MP_BASE_API_URL || 'http://localhost:18082';
  const MP_TKM_URL      = config.MP_TKM_URL      || 'http://localhost:18080';
  const MP_MEDUSA_URL   = config.MP_MEDUSA_URL   || 'http://localhost:9000';

  const isDev = /localhost|127\.0\.0\.1/.test(MP_FMS_JS_URL);

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
    if (isGhostMember) {
      try {
        await baseUser.init();
        unleash.init();
      } catch (_) {
        // 認証初期化に失敗しても商品リストは表示する
      }
    } else if (window.FMS.oidc.isLogin()) {
      // Ghost は未ログインだが OIDC セッションが残っている場合: 強制クリア
      await window.FMS.oidc.logout();
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
