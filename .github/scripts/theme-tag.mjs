// Release ワークフローが、タグの指すコミットをビルドしてよいかを決めるために使う。
// 別ブランチへの誤ったタグと、Ghost や gscan が受け付けない名前での Release をここで止める。

import {readFileSync, appendFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const TAG_PATTERN = /^(.+)-v(\d+\.\d+\.\d+)$/;
// Ghost はテーマアップロード時に source.zip / casper.zip を予約名として拒否する
const RESERVED_NAMES = new Set(['source', 'casper']);

export function assertUploadableThemeName(name) {
    // gscan は name の大文字を Error として報告する
    if (name !== name.toLowerCase()) {
        throw new Error(`テーマ名 "${name}" に大文字が含まれています。小文字だけで書いてください`);
    }

    if (RESERVED_NAMES.has(name)) {
        throw new Error(`"${name}" は予約されたテーマ名のため使用できません`);
    }
}

export function resolveThemeRelease({tag, name}) {
    if (!name) {
        throw new Error('package.json の name が未設定です');
    }

    assertUploadableThemeName(name);

    const match = tag.match(TAG_PATTERN);
    if (!match) {
        throw new Error(`タグ "${tag}" が <prefix>-v<X.Y.Z> 形式ではありません`);
    }
    const [, prefix, version] = match;

    if (prefix !== name) {
        throw new Error(`タグの接頭辞 "${prefix}" は package.json の name "${name}" と同じである必要があります`);
    }

    return {
        name,
        prefix,
        version,
        zipPath: `dist/${name}.zip`
    };
}

function main() {
    const [tag, packageJsonPathArg] = process.argv.slice(2);
    if (!tag) {
        throw new Error('使用法: node theme-tag.mjs <tag> [packageJsonPath]');
    }

    const packageJsonPath = packageJsonPathArg ?? './package.json';
    const {name} = JSON.parse(readFileSync(path.resolve(packageJsonPath), 'utf8'));

    const {zipPath} = resolveThemeRelease({tag, name});
    const outputLines = [`name=${name}`, `zip=${zipPath}`];

    console.log(outputLines.join('\n'));

    if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, `${outputLines.join('\n')}\n`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        main();
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}
