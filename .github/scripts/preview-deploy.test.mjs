import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createApi, deployTheme, resolvePreviewZipPath} from './preview-deploy.mjs';

const CLI_PATH = fileURLToPath(new URL('./preview-deploy.mjs', import.meta.url));
const VALID_KEY = '507f1f77bcf86cd799439011:' + 'a'.repeat(64);

function runCli(env = {}) {
    return spawnSync(process.execPath, [CLI_PATH], {
        encoding: 'utf8',
        env: {...process.env, PREVIEW_URL: '', PREVIEW_ADMIN_API_KEY: '', ...env}
    });
}

function fakeApi({uploadedName = 'my-theme', activatedName = 'my-theme'} = {}) {
    const calls = [];

    return {
        calls,
        themes: {
            async upload(data) {
                calls.push({method: 'upload', data});
                return {name: uploadedName};
            },
            async activate(name) {
                calls.push({method: 'activate', name});
                return {name: activatedName, active: true};
            }
        }
    };
}

test('zip をアップロードし、その応答が返したテーマ名で有効化する', async () => {
    // Arrange
    const api = fakeApi({uploadedName: 'my-theme'});

    // Act
    const activatedName = await deployTheme({api, zipPath: 'dist/my-theme.zip'});

    // Assert
    assert.equal(activatedName, 'my-theme');
    assert.deepEqual(api.calls, [
        {method: 'upload', data: {file: 'dist/my-theme.zip'}},
        {method: 'activate', name: 'my-theme'}
    ]);
});

test('アップロードが失敗したらそのまま失敗する', async () => {
    // Arrange
    const api = fakeApi();
    api.themes.upload = async () => {
        throw new Error('theme validation failed');
    };

    // Act & Assert
    await assert.rejects(
        deployTheme({api, zipPath: 'dist/my-theme.zip'}),
        /theme validation failed/
    );
});

test('有効化が失敗したらそのまま失敗する', async () => {
    // Arrange
    const api = fakeApi();
    api.themes.activate = async () => {
        throw new Error('theme not found');
    };

    // Act & Assert
    await assert.rejects(
        deployTheme({api, zipPath: 'dist/my-theme.zip'}),
        /theme not found/
    );
});

test('Ghost が予約しているテーマ名はアップロードしない', () => {
    // Arrange
    const name = 'source';

    // Act & Assert
    assert.throws(() => resolvePreviewZipPath(name), /source/);
});

test('name に大文字が含まれていればアップロードしない', () => {
    // Arrange
    const name = 'Coverd';

    // Act & Assert
    assert.throws(() => resolvePreviewZipPath(name), /大文字/);
});

test('プレビュー用 zip のパスを name から組み立てる', () => {
    // Arrange
    const name = 'coverd';

    // Act
    const zipPath = resolvePreviewZipPath(name);

    // Assert
    assert.equal(zipPath, 'dist/coverd.zip');
});

test('ベース URL の末尾スラッシュを落として API を作る', () => {
    // Arrange
    const url = 'https://preview.example.com/';

    // Act & Assert
    assert.doesNotThrow(() => createApi(url, VALID_KEY));
});

test('形式が不正な Admin API キーを拒む', () => {
    // Arrange
    const keys = [
        '507f1f77bcf86cd799439011',
        ':' + 'a'.repeat(64),
        '507f1f77bcf86cd799439011:zzzz'
    ];

    for (const key of keys) {
        // Act & Assert
        assert.throws(() => createApi('https://preview.example.com', key));
    }
});

test('CLI は必要な環境変数がなければ stderr へ使用法を出して異常終了する', () => {
    // Act
    const result = runCli();

    // Assert
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PREVIEW_URL/);
    assert.match(result.stderr, /PREVIEW_ADMIN_API_KEY/);
});
