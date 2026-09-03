import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertUploadableThemeName} from './theme-tag.mjs';

const JWT_MAX_AGE_SECONDS = 300;
const JWT_AUDIENCE = '/admin/';

function base64url(value) {
    return Buffer.from(value).toString('base64url');
}

function parseAdminApiKey(key) {
    const separatorIndex = key.indexOf(':');
    if (separatorIndex === -1) {
        throw new Error('Admin API キーは "<id>:<secret>" 形式である必要があります');
    }

    const id = key.slice(0, separatorIndex);
    const secret = key.slice(separatorIndex + 1);
    if (!id || !secret) {
        throw new Error('Admin API キーの id または secret が空です');
    }

    // Buffer.from(secret, 'hex') は不正な文字や奇数長を黙って切り詰めるため、事前に検証する
    if (secret.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(secret)) {
        throw new Error('Admin API キーの secret が hex 形式ではありません');
    }

    return {id, secret};
}

export function createAdminToken(key, {now = Math.floor(Date.now() / 1000)} = {}) {
    const {id, secret} = parseAdminApiKey(key);

    const header = {alg: 'HS256', typ: 'JWT', kid: id};
    const payload = {iat: now, exp: now + JWT_MAX_AGE_SECONDS, aud: JWT_AUDIENCE};
    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
    const signature = createHmac('sha256', Buffer.from(secret, 'hex')).update(signingInput).digest('base64url');

    return `${signingInput}.${signature}`;
}

export function resolvePreviewZipPath(name) {
    assertUploadableThemeName(name);

    // gulpfile.js の zipper は require('./package.json').name をそのまま zip 名に使うため、大文字小文字を保持する
    return `dist/${name}.zip`;
}

export async function deployTheme({baseUrl, key, zipPath, fetch = globalThis.fetch}) {
    const token = createAdminToken(key);
    const authHeaders = {Authorization: `Ghost ${token}`};
    const origin = baseUrl.replace(/\/+$/, '');

    const form = new FormData();
    form.append('file', new Blob([readFileSync(zipPath)]), path.basename(zipPath));

    const uploadResponse = await fetch(`${origin}/ghost/api/admin/themes/upload/`, {
        method: 'POST',
        headers: authHeaders,
        body: form
    });
    if (!uploadResponse.ok) {
        throw new Error(`テーマのアップロードに失敗しました (${uploadResponse.status}): ${await uploadResponse.text()}`);
    }
    const {themes: [{name}]} = await uploadResponse.json();

    const activateResponse = await fetch(`${origin}/ghost/api/admin/themes/${name}/activate/`, {
        method: 'PUT',
        headers: authHeaders
    });
    if (!activateResponse.ok) {
        throw new Error(`テーマの有効化に失敗しました (${activateResponse.status}): ${await activateResponse.text()}`);
    }
    const {themes: [{name: activatedName}]} = await activateResponse.json();

    return activatedName;
}

async function main() {
    const {PREVIEW_URL, PREVIEW_ADMIN_API_KEY} = process.env;
    if (!PREVIEW_URL || !PREVIEW_ADMIN_API_KEY) {
        throw new Error('使用法: PREVIEW_URL と PREVIEW_ADMIN_API_KEY を環境変数に設定して node preview-deploy.mjs を実行してください');
    }

    const {name} = JSON.parse(readFileSync(path.resolve('./package.json'), 'utf8'));

    const activatedName = await deployTheme({baseUrl: PREVIEW_URL, key: PREVIEW_ADMIN_API_KEY, zipPath: resolvePreviewZipPath(name)});
    console.log(`テーマ "${activatedName}" をプレビューサイトへ反映しました`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}
