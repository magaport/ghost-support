import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAdminToken, deployTheme, resolvePreviewZipPath} from './preview-deploy.mjs';

const CLI_PATH = fileURLToPath(new URL('./preview-deploy.mjs', import.meta.url));

function runCli(env = {}) {
    return spawnSync(process.execPath, [CLI_PATH], {
        encoding: 'utf8',
        env: {...process.env, PREVIEW_URL: '', PREVIEW_ADMIN_API_KEY: '', ...env}
    });
}

function decodeSegment(segment) {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

function writeFixtureZip() {
    const dir = mkdtempSync(path.join(tmpdir(), 'preview-deploy-'));
    const zipPath = path.join(dir, 'theme.zip');
    writeFileSync(zipPath, 'fake zip contents');
    return zipPath;
}

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {'content-type': 'application/json'}
    });
}

test('Admin API が求めるヘッダとペイロードの形で JWT を作る', () => {
    // Arrange
    const key = '507f1f77bcf86cd799439011:abcdef0123456789';

    // Act
    const token = createAdminToken(key);

    // Assert
    const [headerSegment, payloadSegment] = token.split('.');
    const header = decodeSegment(headerSegment);
    const payload = decodeSegment(payloadSegment);
    assert.deepEqual(header, {alg: 'HS256', typ: 'JWT', kid: '507f1f77bcf86cd799439011'});
    assert.equal(payload.aud, '/admin/');
    assert.ok(payload.exp - payload.iat <= 300);
});

test('hex デコードした secret を鍵に HMAC-SHA256 で JWT に署名する', () => {
    // Arrange
    const key = '507f1f77bcf86cd799439011:abcdef0123456789';

    // Act
    const token = createAdminToken(key, {now: 1700000000});

    // Assert
    const [headerSegment, payloadSegment, signatureSegment] = token.split('.');
    const expectedSignature = createHmac('sha256', Buffer.from('abcdef0123456789', 'hex'))
        .update(`${headerSegment}.${payloadSegment}`)
        .digest('base64url');
    assert.equal(signatureSegment, expectedSignature);
});

test('コロン区切りのない Admin API キーを拒む', () => {
    // Act & Assert
    assert.throws(() => createAdminToken('507f1f77bcf86cd799439011abcdef0123456789'));
});

test('id または secret が空の Admin API キーを拒む', () => {
    // Arrange
    const keys = [':abcdef0123456789', '507f1f77bcf86cd799439011:'];

    for (const key of keys) {
        // Act & Assert
        assert.throws(() => createAdminToken(key));
    }
});

test('secret が hex 形式でない Admin API キーを拒む', () => {
    // Arrange
    const keys = ['507f1f77bcf86cd799439011:not-hex!!', '507f1f77bcf86cd799439011:abc', '507f1f77bcf86cd799439011:zzzzzzzz'];

    for (const key of keys) {
        // Act & Assert
        assert.throws(() => createAdminToken(key));
    }
});

test('zip をアップロードし、その応答が返したテーマ名で有効化する', async () => {
    // Arrange
    const zipPath = writeFixtureZip();
    const calls = [];
    const fakeFetch = async (url, options) => {
        calls.push({url, options});
        if (calls.length === 1) {
            return jsonResponse(200, {themes: [{name: 'my-theme', active: false}]});
        }
        return jsonResponse(200, {themes: [{name: 'my-theme', active: true}]});
    };

    // Act
    const activatedName = await deployTheme({
        baseUrl: 'https://preview.example.com',
        key: '507f1f77bcf86cd799439011:abcdef0123456789',
        zipPath,
        fetch: fakeFetch
    });

    // Assert
    assert.equal(activatedName, 'my-theme');
    assert.equal(calls.length, 2);

    const [uploadCall, activateCall] = calls;
    assert.equal(uploadCall.url, 'https://preview.example.com/ghost/api/admin/themes/upload/');
    assert.equal(uploadCall.options.method, 'POST');
    assert.match(uploadCall.options.headers.Authorization, /^Ghost /);
    assert.ok(uploadCall.options.body instanceof FormData);
    assert.ok(uploadCall.options.body.get('file') instanceof Blob);

    assert.equal(activateCall.url, 'https://preview.example.com/ghost/api/admin/themes/my-theme/activate/');
    assert.equal(activateCall.options.method, 'PUT');
    assert.match(activateCall.options.headers.Authorization, /^Ghost /);
});

test('アップロードが拒否されたらステータスと本文を含めて失敗する', async () => {
    // Arrange
    const zipPath = writeFixtureZip();
    const fakeFetch = async () => new Response('theme validation failed', {status: 422});

    // Act & Assert
    await assert.rejects(
        deployTheme({
            baseUrl: 'https://preview.example.com',
            key: '507f1f77bcf86cd799439011:abcdef0123456789',
            zipPath,
            fetch: fakeFetch
        }),
        /422.*theme validation failed/s
    );
});

test('有効化が拒否されたらステータスと本文を含めて失敗する', async () => {
    // Arrange
    const zipPath = writeFixtureZip();
    let callCount = 0;
    const fakeFetch = async () => {
        callCount += 1;
        if (callCount === 1) {
            return jsonResponse(200, {themes: [{name: 'my-theme', active: false}]});
        }
        return new Response('theme not found', {status: 404});
    };

    // Act & Assert
    await assert.rejects(
        deployTheme({
            baseUrl: 'https://preview.example.com',
            key: '507f1f77bcf86cd799439011:abcdef0123456789',
            zipPath,
            fetch: fakeFetch
        }),
        /404.*theme not found/s
    );
});

test('CLI は必要な環境変数がなければ stderr へ使用法を出して異常終了する', () => {
    // Act
    const result = runCli();

    // Assert
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PREVIEW_URL/);
    assert.match(result.stderr, /PREVIEW_ADMIN_API_KEY/);
});

test('Ghost が予約しているテーマ名はアップロードしない', () => {
    // Arrange
    const name = 'source';

    // Act & Assert
    assert.throws(() => resolvePreviewZipPath(name), /source/);
});

test('プレビュー用 zip のパスは name の大文字小文字をそのまま使う', () => {
    // Arrange
    const name = 'Coverd';

    // Act
    const zipPath = resolvePreviewZipPath(name);

    // Assert
    assert.equal(zipPath, 'dist/Coverd.zip');
});

test('プレビューのベース URL の末尾スラッシュを許容する', async () => {
    // Arrange
    const zipPath = writeFixtureZip();
    const requestedUrls = [];
    const fakeFetch = async (url) => {
        requestedUrls.push(url);
        return jsonResponse(200, {themes: [{name: 'my-theme'}]});
    };

    // Act
    await deployTheme({
        baseUrl: 'https://preview.example.com/',
        key: '507f1f77bcf86cd799439011:abcdef0123456789',
        zipPath,
        fetch: fakeFetch
    });

    // Assert
    assert.deepEqual(requestedUrls, [
        'https://preview.example.com/ghost/api/admin/themes/upload/',
        'https://preview.example.com/ghost/api/admin/themes/my-theme/activate/'
    ]);
});
