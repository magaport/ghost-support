// プレビュー反映ジョブが、ビルド済みのテーマ zip をプレビューサイトへ送るために使う。

import {readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import GhostAdminAPI from '@tryghost/admin-api';
import {assertUploadableThemeName} from './theme-tag.mjs';

export function resolvePreviewZipPath(name) {
    assertUploadableThemeName(name);

    // gulpfile.js の zipper は require('./package.json').name をそのまま zip 名に使うため、大文字小文字を保持する
    return `dist/${name}.zip`;
}

export function createApi(url, key) {
    return new GhostAdminAPI({
        // GhostAdminAPI は末尾スラッシュ付きの url を拒む
        url: url.replace(/\/+$/, ''),
        key,
        version: true
    });
}

export async function deployTheme({api, zipPath}) {
    const uploaded = await api.themes.upload({file: zipPath});
    const activated = await api.themes.activate(uploaded.name);

    return activated.name;
}

async function main() {
    const {PREVIEW_URL, PREVIEW_ADMIN_API_KEY} = process.env;
    if (!PREVIEW_URL || !PREVIEW_ADMIN_API_KEY) {
        throw new Error('使用法: PREVIEW_URL と PREVIEW_ADMIN_API_KEY を環境変数に設定して node preview-deploy.mjs を実行してください');
    }

    const {name} = JSON.parse(readFileSync(path.resolve('./package.json'), 'utf8'));

    const activatedName = await deployTheme({
        api: createApi(PREVIEW_URL, PREVIEW_ADMIN_API_KEY),
        zipPath: resolvePreviewZipPath(name)
    });
    console.log(`テーマ "${activatedName}" をプレビューサイトへ反映しました`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}
