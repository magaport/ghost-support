/**
 *
 * ユーザー登録時の確認メール
 *
 */
const siteTitleSub = '（カバード）';

module.exports = ({t, url, siteTitle, siteUrl}) => `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
  </head>
    <title>${t(
        '【${siteTitle}】ご登録ありがとうございます（メールアドレスの確認）',
        {
            siteTitle: siteTitle + siteTitleSub,
            interpolation: {escapeValue: false}
        }
    )}</title>
  <body>
    <p>${t('{siteTitle} にご登録いただき、ありがとうございます。', {
        siteTitle: siteTitle + siteTitleSub,
        interpolation: {escapeValue: false}
    })}</p>

    <p>まだ登録は完了しておりません。<br>
    お手数ですが、以下のリンクをクリックしてメールアドレスの確認手続きを完了してください。</p>

    <p><strong>▼メールアドレス確認用リンク</strong><br>
    <a href="${url}">[${url}]</a></p>

    <p>このリンクの有効期限は24時間です。<br>
    期限が切れた場合は、お手数ですが再度ご登録手続きをお願いいたします。</p>

    <hr>

    <p>${t('{siteTitle} 運営事務局', {
        siteTitle: siteTitle + siteTitleSub,
        interpolation: {escapeValue: false}
    })}<br>
    <a href="${siteUrl}">[${siteUrl}]</a></p>

    <p>
      ※ このメールはシステムにより自動送信されています。ご返信いただいても対応できませんのでご了承ください。<br>
      ※ このメールにお心当たりがない場合は、お手数ですが本メールを破棄していただきますようお願いいたします。<br>
    </p>
  </body>
</html>
`;

