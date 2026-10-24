const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WINDOW_HTML_FILES = [
  'index.html',
  'browser.html',
  'downloader.html',
  'importer.html',
  'exporter.html',
  'group_manager.html',
  'tag_manager.html',
  'reader.html',
  'shell.html',
];

test('window HTML bootstraps theme class from trusted bootstrapTheme query before renderer hydration', () => {
  const bootstrapSource = fs.readFileSync(path.join(process.cwd(), 'windows', 'bootstrap_theme.js'), 'utf8');
  assert.match(bootstrapSource, /new URLSearchParams\(window\.location\.search\)/, 'bootstrap_theme.js: reads search params');
  assert.match(bootstrapSource, /params\.get\("bootstrapTheme"\) === "dark"/, 'bootstrap_theme.js: only dark token enables dark bootstrap');
  assert.match(bootstrapSource, /document\.documentElement\.classList\.add\("bootstrap-dark"\)/, 'bootstrap_theme.js: sets bootstrap class on html element');

  for (const fileName of WINDOW_HTML_FILES) {
    const filePath = path.join(process.cwd(), 'windows', fileName);
    const source = fs.readFileSync(filePath, 'utf8');
    const head = source.slice(0, source.indexOf('</head>'));

    assert.match(head, /<script src="\.\/bootstrap_theme\.js"><\/script>/, `${fileName}: loads bootstrap_theme.js in head`);
    assert.ok(
      head.indexOf('bootstrap_theme.js') === head.search(/<script\b/) + '<script src="./'.length,
      `${fileName}: bootstrap_theme.js is the first script`,
    );
  }
});

test('shared stylesheet honors bootstrap-dark class before renderer applies body.dark', () => {
  const filePath = path.join(process.cwd(), 'windows', 'shared.css');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.match(source, /body\.dark,\s*\nhtml\.bootstrap-dark body\s*\{/, 'dark theme tokens include bootstrap-dark fallback selector');
  assert.match(source, /html:has\(body\.dark\),\s*\nhtml\.bootstrap-dark\s*\{/, 'root color-scheme selector includes bootstrap-dark');
});
