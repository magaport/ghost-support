import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveThemeRelease} from './theme-tag.mjs';

const CLI_PATH = fileURLToPath(new URL('./theme-tag.mjs', import.meta.url));

function writeFixturePackageJson(name) {
    const dir = mkdtempSync(path.join(tmpdir(), 'theme-tag-'));
    const packageJsonPath = path.join(dir, 'package.json');
    writeFileSync(packageJsonPath, JSON.stringify({name}));
    return packageJsonPath;
}

function runCli(args, env = {}) {
    return spawnSync(process.execPath, [CLI_PATH, ...args], {
        encoding: 'utf8',
        env: {...process.env, ...env}
    });
}

test('タグと name が一致すれば zip のパスを返す', () => {
    // Arrange
    const tag = 'ywlr-v1.0.0';
    const name = 'ywlr';

    // Act
    const result = resolveThemeRelease({tag, name});

    // Assert
    assert.deepEqual(result, {
        name: 'ywlr',
        prefix: 'ywlr',
        version: '1.0.0',
        zipPath: 'dist/ywlr.zip'
    });
});

test('name に大文字が含まれていれば拒む', () => {
    // Arrange
    const tag = 'coverd-v1.0.0';
    const name = 'Coverd';

    // Act & Assert
    assert.throws(() => resolveThemeRelease({tag, name}), /大文字/);
});

test('接頭辞が package.json の name と一致しないタグを拒む', () => {
    // Arrange
    const tag = 'ywlr-v1.0.1';
    const name = 'coverd';

    // Act & Assert
    assert.throws(() => resolveThemeRelease({tag, name}));
});

test('Ghost がアップロードを拒む予約テーマ名を拒む', () => {
    // Arrange
    const cases = [
        {tag: 'source-v1.0.0', name: 'source'},
        {tag: 'casper-v1.0.0', name: 'casper'}
    ];

    for (const {tag, name} of cases) {
        // Act & Assert
        assert.throws(() => resolveThemeRelease({tag, name}));
    }
});

test('<prefix>-v<X.Y.Z> 形式でないタグを拒む', () => {
    // Arrange
    const name = 'ywlr';
    const malformedTags = ['v1.0.0', 'ywlr-1.0.0', 'ywlr-v1.0'];

    for (const tag of malformedTags) {
        // Act & Assert
        assert.throws(() => resolveThemeRelease({tag, name}), /<prefix>-v<X\.Y\.Z>/);
    }
});

test('package.json の name が空または未設定なら拒む', () => {
    // Arrange
    const tag = 'ywlr-v1.0.0';
    const emptyNames = ['', undefined];

    for (const name of emptyNames) {
        // Act & Assert
        assert.throws(() => resolveThemeRelease({tag, name}), /name/);
    }
});

test('CLI は正しいタグに対して name と zip のパスを出力する', () => {
    // Arrange
    const packageJsonPath = writeFixturePackageJson('ywlr');

    // Act
    const result = runCli(['ywlr-v1.0.0', packageJsonPath]);

    // Assert
    assert.equal(result.status, 0);
    assert.match(result.stdout, /name=ywlr/);
    assert.match(result.stdout, /zip=dist\/ywlr\.zip/);
});

test('CLI は GITHUB_OUTPUT が設定されていれば name と zip のパスを追記する', () => {
    // Arrange
    const packageJsonPath = writeFixturePackageJson('ywlr');
    const githubOutputPath = path.join(path.dirname(packageJsonPath), 'github_output');
    writeFileSync(githubOutputPath, '');

    // Act
    const result = runCli(['ywlr-v1.0.0', packageJsonPath], {GITHUB_OUTPUT: githubOutputPath});

    // Assert
    assert.equal(result.status, 0);
    const output = readFileSync(githubOutputPath, 'utf8');
    assert.match(output, /name=ywlr/);
    assert.match(output, /zip=dist\/ywlr\.zip/);
});

test('CLI はタグ引数がなければ使用法を出して異常終了する', () => {
    // Act
    const result = runCli([]);

    // Assert
    assert.equal(result.status, 1);
    assert.match(result.stderr, /使用法/);
});

test('CLI は不正なタグに対して stderr へメッセージを出して異常終了する', () => {
    // Arrange
    const packageJsonPath = writeFixturePackageJson('ywlr');

    // Act
    const result = runCli(['v1.0.0', packageJsonPath]);

    // Assert
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'タグ "v1.0.0" が <prefix>-v<X.Y.Z> 形式ではありません');
});

test('接頭辞に大文字が含まれていれば拒む', () => {
    // Arrange
    const tag = 'Coverd-v1.0.0';
    const name = 'coverd';

    // Act & Assert
    assert.throws(() => resolveThemeRelease({tag, name}), /coverd/);
});
