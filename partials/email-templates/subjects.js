const siteTitleSub = '（カバード）';

// パスワードレスログイン時のマジックリンクメール
const signin = ({siteTitle}) => {
    return `【${siteTitle}${siteTitleSub}】ログインリンクのお知らせ`;
};

// ユーザー登録時の確認メール／ウェルカムメール（無料ユーザー）
const signup = ({siteTitle}) => {
    return `【${siteTitle}${siteTitleSub}】ご登録ありがとうございます（メールアドレスの確認）`;
};

// ユーザー登録時の確認メール／ウェルカムメール（有料ユーザー）
const signupPaid = ({siteTitle}) => {
    return `【${siteTitle}${siteTitleSub}】ご登録ありがとうございます（メールアドレスの確認）`;
};

// -----(module.exports)----------------------------
module.exports = {
    signin,
    signup,
    signupPaid
};
