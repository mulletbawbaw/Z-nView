const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractSequentialPageImageUrls,
  parsePageExtensionMap,
} = require('../preload/source_adapters/gallery_design_common');
const { hentaifoxSourceAdapter } = require('../preload/source_adapters/hentaifox');
const { hentairoxSourceAdapter } = require('../preload/source_adapters/hentairox');
const { hentaieraSourceAdapter } = require('../preload/source_adapters/hentaiera');
const { asmhentaiSourceAdapter } = require('../preload/source_adapters/asmhentai');
const { nhentaiXxxSourceAdapter } = require('../preload/source_adapters/nhentai_xxx');
const { threeHentaiSourceAdapter } = require('../preload/source_adapters/three_hentai');
const { resolveSourceAdapterForStartPage } = require('../preload/source_adapters/registry');

function makeImage(attrs) {
  return {
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
  };
}

function makeDocument({ thumbSelector, thumbs = [], hiddenInputs = {}, scripts = [] }) {
  return {
    querySelector(selector) {
      const match = selector.match(/^input#(.+)$/);
      if (match && Object.prototype.hasOwnProperty.call(hiddenInputs, match[1])) {
        return makeImage({ value: hiddenInputs[match[1]] });
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === thumbSelector) return thumbs.map((src) => makeImage({ 'data-src': src }));
      if (selector === 'script') return scripts.map((textContent) => ({ textContent }));
      return [];
    },
  };
}

const ADAPTER_CASES = [
  { adapter: hentaifoxSourceAdapter, origin: 'https://hentaifox.com', gallery: '/gallery/174420/', reader: '/g/174420/1/' },
  { adapter: hentairoxSourceAdapter, origin: 'https://hentairox.com', gallery: '/gallery/864399/', reader: '/view/864399/1/' },
  { adapter: hentaieraSourceAdapter, origin: 'https://hentaiera.com', gallery: '/gallery/1752125/', reader: '/view/1752125/1/' },
  { adapter: asmhentaiSourceAdapter, origin: 'https://asmhentai.com', gallery: '/g/691002/', reader: '/gallery/691002/1/' },
  { adapter: nhentaiXxxSourceAdapter, origin: 'https://nhentai.xxx', gallery: '/g/706701/', reader: '/g/706701/1/' },
  { adapter: threeHentaiSourceAdapter, origin: 'https://3hentai.net', gallery: '/d/769810', reader: '/d/769810/1' },
];

for (const { adapter, origin, gallery, reader } of ADAPTER_CASES) {
  test(`${adapter.sourceId} URL matching only accepts gallery URLs on its origin`, () => {
    assert.equal(adapter.matchesUrl(`${origin}${gallery}`), true);
    assert.equal(adapter.matchesUrl(`${origin}${reader}`), false);
    assert.equal(adapter.matchesUrl(`https://example.com${gallery}`), false);
    assert.equal(resolveSourceAdapterForStartPage(origin)?.sourceId, adapter.sourceId);
  });
}

test('parsePageExtensionMap reads flat and nested g_th maps', () => {
  const flat = makeDocument({
    scripts: ['var g_th = $.parseJSON(\'{"1":"j,1200,630","2":"w,1280,2048","3":"p,1280,1820"}\');'],
  });
  assert.deepEqual(Array.from(parsePageExtensionMap(flat)), [[1, 'jpg'], [2, 'webp'], [3, 'png']]);

  const nested = makeDocument({
    scripts: ['g_th = $.parseJSON(\'{"fl":{"1":"w,1280,1810"},"th":{"1":"j,250,354"}}\');'],
  });
  assert.deepEqual(Array.from(parsePageExtensionMap(nested)), [[1, 'webp']]);

  assert.equal(parsePageExtensionMap(makeDocument({ scripts: ['var g_th = broken;'] })).size, 0);
});

test('extractSequentialPageImageUrls expands every page with per-page extensions', () => {
  const documentRef = makeDocument({
    thumbSelector: '#thumbs img',
    thumbs: ['data:image/svg+xml,placeholder', 'https://m1.cdn.test/033/abc/1t.jpg', 'https://m1.cdn.test/033/abc/2t.jpg'],
    hiddenInputs: { load_pages: '4' },
    scripts: ['g_th = $.parseJSON(\'{"1":"j,1,1","2":"w,1,1","3":"w,1,1"}\');'],
  });

  const urls = extractSequentialPageImageUrls(documentRef, { href: 'https://source.test/gallery/1/' }, {
    thumbSelector: '#thumbs img',
  });

  assert.deepEqual(urls, [
    'https://m1.cdn.test/033/abc/1.jpg',
    'https://m1.cdn.test/033/abc/2.webp',
    'https://m1.cdn.test/033/abc/3.webp',
    'https://m1.cdn.test/033/abc/4.jpg',
  ]);
});

test('extractSequentialPageImageUrls falls back to t_pages and to visible thumbnails', () => {
  const withTotalPages = makeDocument({
    thumbSelector: '.preview_thumb img',
    thumbs: ['https://images.cdn.test/019/691002/1t.jpg'],
    hiddenInputs: { t_pages: '3' },
  });
  assert.equal(
    extractSequentialPageImageUrls(withTotalPages, { href: 'https://source.test/g/691002/' }, {
      thumbSelector: '.preview_thumb img',
    }).length,
    3,
  );

  const withoutCount = makeDocument({
    thumbSelector: '.preview_thumb img',
    thumbs: ['/019/691002/1t.jpg', '/019/691002/2t.jpg', '/019/691002/2t.jpg', 'https://images.cdn.test/cover.jpg'],
  });
  assert.deepEqual(
    extractSequentialPageImageUrls(withoutCount, { href: 'https://source.test/g/691002/' }, {
      thumbSelector: '.preview_thumb img',
    }),
    ['https://source.test/019/691002/1.jpg', 'https://source.test/019/691002/2.jpg'],
  );
});

test('3hentai metadata classifies tag links by path segment', () => {
  const link = (href, text) => ({ textContent: `\n${text}\n`, getAttribute: (name) => (name === 'href' ? href : null) });
  const links = [
    link('https://3hentai.net/language/english', 'english'),
    link('https://3hentai.net/tags/full-color', 'full color'),
    link('https://3hentai.net/series/the-idolmaster', 'the idolmaster'),
    link('https://3hentai.net/characters/yuriko-nanao', 'yuriko nanao'),
    link('https://3hentai.net/artists/someone', 'someone'),
    link('https://3hentai.net/category/doujinshi', 'doujinshi'),
  ];
  const pagesContainer = {
    textContent: 'Pages: 67',
    querySelector: (selector) => (selector === '.field-light-text' ? { textContent: '\n67\n' } : null),
  };
  const documentRef = {
    querySelector: (selector) => (selector === 'h1' ? { textContent: ' Sample Title ' } : null),
    querySelectorAll(selector) {
      if (selector === '.tag-container .filter-elem a.name') return links;
      if (selector === '.tag-container') return [pagesContainer];
      return [];
    },
  };

  const meta = threeHentaiSourceAdapter.extractMetadata(documentRef, {
    href: 'https://3hentai.net/d/769895',
    pathname: '/d/769895',
  });

  assert.equal(meta.galleryId, '769895');
  assert.equal(meta.comicName, 'Sample Title');
  assert.deepEqual(meta.languages, ['english']);
  assert.deepEqual(meta.tags, ['full color']);
  assert.deepEqual(meta.parodies, ['the idolmaster']);
  assert.deepEqual(meta.characters, ['yuriko nanao']);
  assert.deepEqual(meta.artists, ['someone']);
  assert.equal(meta.artist, 'someone');
  assert.equal(meta.pages, 67);
});
