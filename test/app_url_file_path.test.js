const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { resolveAppUrlFilePath } = require('../main/window_runtime');

const resolve = (url, options) => resolveAppUrlFilePath(new URL(url), { pathApi: path, ...options });

test('resolveAppUrlFilePath restores the POSIX leading segment parsed as host', () => {
  const libraryRoot = '/home/user/.config/nView/Library';
  assert.equal(
    resolve('appblob:////home/user/.config/nView/Library/comic_1/001.png', { platform: 'linux', libraryRoot }),
    '/home/user/.config/nView/Library/comic_1/001.png',
  );
  assert.equal(
    resolve('appfile:///tmp/lib/comic_1/cover%20page.jpg', { platform: 'linux', libraryRoot: '/tmp/lib' }),
    '/tmp/lib/comic_1/cover page.jpg',
  );
});

test('resolveAppUrlFilePath keeps the original casing of the library root head segment', () => {
  assert.equal(
    resolve('appblob:////Volumes/Data/Library/comic_1/001.png', { platform: 'darwin', libraryRoot: '/Volumes/Data/Library' }),
    '/Volumes/Data/Library/comic_1/001.png',
  );
});

test('resolveAppUrlFilePath never yields a cwd-relative path on POSIX', () => {
  const resolved = resolve('appblob:///comic_1/001.png', { platform: 'linux', libraryRoot: '/srv/lib' });
  assert.equal(resolved, '/comic_1/001.png');
});

test('resolveAppUrlFilePath normalizes traversal so the library guard can reject it', () => {
  const resolved = resolve('appblob:////srv/lib/%2E%2E/%2E%2E/etc/passwd', { platform: 'linux', libraryRoot: '/srv/lib' });
  assert.equal(resolved, '/etc/passwd');
});

test('resolveAppUrlFilePath maps Windows drive hosts and drive-prefixed paths', () => {
  assert.equal(
    resolve('appblob://c/Users/me/Library/comic_1/001.png', { platform: 'win32', libraryRoot: 'C:\\Users\\me\\Library' }),
    'C:\\Users\\me\\Library\\comic_1\\001.png',
  );
  assert.equal(
    resolve('appblob:///D:/nView/Library/comic_1/001.png', { platform: 'win32', libraryRoot: 'D:\\nView\\Library' }),
    'D:\\nView\\Library\\comic_1\\001.png',
  );
});
