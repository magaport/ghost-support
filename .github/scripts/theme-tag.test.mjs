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

test('resolves a matching tag and name into a zip path', () => {
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

test('keeps the zip path in the exact casing of package.json name', () => {
    // Arrange
    const tag = 'coverd-v1.0.0';
    const name = 'Coverd';

    // Act
    const result = resolveThemeRelease({tag, name});

    // Assert
    assert.equal(result.zipPath, 'dist/Coverd.zip');
});

test('rejects a tag whose prefix does not match package.json name', () => {
    // Arrange
    const tag = 'ywlr-v1.0.1';
    const name = 'Coverd';

    // Act & Assert
    assert.throws(() => resolveThemeRelease({tag, name}));
});

test('rejects reserved theme names that Ghost refuses to upload', () => {
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

test('rejects a tag that is not in <prefix>-v<X.Y.Z> form', () => {
    // Arrange
    const name = 'ywlr';
    const malformedTags = ['v1.0.0', 'ywlr-1.0.0', 'ywlr-v1.0'];

    for (const tag of malformedTags) {
        // Act & Assert
        assert.throws(() => resolveThemeRelease({tag, name}), /<prefix>-v<X\.Y\.Z>/);
    }
});

test('rejects a missing or empty package.json name', () => {
    // Arrange
    const tag = 'ywlr-v1.0.0';
    const emptyNames = ['', undefined];

    for (const name of emptyNames) {
        // Act & Assert
        assert.throws(() => resolveThemeRelease({tag, name}), /name/);
    }
});

test('CLI prints name and zip path for a valid tag', () => {
    // Arrange
    const packageJsonPath = writeFixturePackageJson('ywlr');

    // Act
    const result = runCli(['ywlr-v1.0.0', packageJsonPath]);

    // Assert
    assert.equal(result.status, 0);
    assert.match(result.stdout, /name=ywlr/);
    assert.match(result.stdout, /zip=dist\/ywlr\.zip/);
});

test('CLI appends name and zip path to GITHUB_OUTPUT when set', () => {
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

test('CLI exits with an error and a usage message when the tag argument is missing', () => {
    // Act
    const result = runCli([]);

    // Assert
    assert.equal(result.status, 1);
    assert.match(result.stderr, /使用法/);
});

test('CLI exits with an error and a stderr message for an invalid tag', () => {
    // Arrange
    const packageJsonPath = writeFixturePackageJson('ywlr');

    // Act
    const result = runCli(['v1.0.0', packageJsonPath]);

    // Assert
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'タグ "v1.0.0" が <prefix>-v<X.Y.Z> 形式ではありません');
});
