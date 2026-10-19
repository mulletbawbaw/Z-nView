const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const layoutSource = fs.readFileSync(path.join(__dirname, "..", "renderer", "reader", "reader_layout.js"), "utf8");
const controllerSource = fs.readFileSync(
  path.join(__dirname, "..", "renderer", "reader", "reader_page_controller.js"),
  "utf8",
);

function loadLayout() {
  const context = { window: {} };
  vm.runInNewContext(layoutSource, context, { filename: "reader_layout.js" });
  return context.window.nviewReaderLayout;
}

// Values built inside the vm context come from another realm; compare them as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));

const portrait = { w: 1000, h: 1500 };
const wide = { w: 2000, h: 1500 };

test("computeSpreads keeps one page per spread in single mode", () => {
  const layout = loadLayout();
  assert.deepEqual(plain(layout.computeSpreads([portrait, portrait, portrait], { pageSpread: "single" })), [[0], [1], [2]]);
});

test("computeSpreads pairs pages after a lone cover in double mode", () => {
  const layout = loadLayout();
  const dims = [portrait, portrait, portrait, portrait, portrait, portrait];
  assert.deepEqual(plain(layout.computeSpreads(dims, { pageSpread: "double" })), [[0], [1, 2], [3, 4], [5]]);
});

test("computeSpreads keeps wide scans alone and restarts pairing after them", () => {
  const layout = loadLayout();
  const dims = [portrait, portrait, wide, portrait, portrait, { w: 0, h: 0 }];
  assert.deepEqual(plain(layout.computeSpreads(dims, { pageSpread: "double" })), [[0], [1], [2], [3, 4], [5]]);
});

test("findSpreadIndex locates the spread that holds a page and clamps out-of-range pages", () => {
  const layout = loadLayout();
  const spreads = [[0], [1, 2], [3, 4]];
  assert.equal(layout.findSpreadIndex(spreads, 2), 1);
  assert.equal(layout.findSpreadIndex(spreads, 3), 2);
  assert.equal(layout.findSpreadIndex(spreads, 99), 2);
  assert.equal(layout.findSpreadIndex([], 0), -1);
});

test("resolveReaderPreferences prefers comic override, then Japanese language, then defaults", () => {
  const layout = loadLayout();
  const readerSettings = {
    layoutMode: "vertical",
    readingDirection: "ltr",
    pageSpread: "single",
    autoDirectionByLanguage: true,
    comicOverrides: { comic_1: { layoutMode: "paged", readingDirection: "ltr", pageSpread: "double" } },
  };

  const fromComic = layout.resolveReaderPreferences({ readerSettings, comicId: "comic_1", languages: ["japanese"] });
  assert.equal(fromComic.source, "comic");
  assert.equal(fromComic.readingDirection, "ltr");
  assert.equal(fromComic.pageSpread, "double");

  const fromLanguage = layout.resolveReaderPreferences({ readerSettings, comicId: "comic_2", languages: ["Japanese"] });
  assert.equal(fromLanguage.source, "language");
  assert.equal(fromLanguage.layoutMode, "paged");
  assert.equal(fromLanguage.readingDirection, "rtl");

  const fromDefault = layout.resolveReaderPreferences({ readerSettings, comicId: "comic_2", languages: ["english"] });
  assert.equal(fromDefault.source, "default");
  assert.equal(fromDefault.layoutMode, "vertical");

  const autoOff = layout.resolveReaderPreferences({
    readerSettings: { ...readerSettings, autoDirectionByLanguage: false },
    comicId: "comic_2",
    languages: ["japanese"],
  });
  assert.equal(autoOff.source, "default");
});

test("withComicOverride stores normalized choices and keeps only the newest entries", () => {
  const layout = loadLayout();
  const updated = layout.withComicOverride({ widthScale: 0.8 }, "comic_9", {
    layoutMode: "PAGED",
    readingDirection: "sideways",
    pageSpread: "double",
  }, 1000);
  assert.equal(updated.widthScale, 0.8);
  assert.equal(updated.comicOverrides.comic_9.layoutMode, "paged");
  assert.equal(updated.comicOverrides.comic_9.readingDirection, "ltr");
  assert.equal(updated.comicOverrides.comic_9.updatedAt, 1000);

  const many = {};
  for (let i = 0; i < 5; i += 1) many[`comic_${i}`] = { layoutMode: "paged", updatedAt: i };
  assert.deepEqual(Object.keys(layout.pruneComicOverrides(many, 2)), ["comic_4", "comic_3"]);
});

test("navigation keys and click zones follow the reading direction", () => {
  const layout = loadLayout();
  assert.equal(layout.resolveNavigationKey("ArrowRight", { readingDirection: "ltr" }), "next");
  assert.equal(layout.resolveNavigationKey("ArrowRight", { readingDirection: "rtl" }), "prev");
  assert.equal(layout.resolveNavigationKey("ArrowLeft", { readingDirection: "rtl" }), "next");
  assert.equal(layout.resolveNavigationKey(" ", { shiftKey: true }), "prev");
  assert.equal(layout.resolveNavigationKey("PageDown", {}), "next");
  assert.equal(layout.resolveNavigationKey("Home", {}), "first");
  assert.equal(layout.resolveNavigationKey("x", {}), null);

  assert.equal(layout.resolveClickZoneAction(0.1, { readingDirection: "ltr" }), "prev");
  assert.equal(layout.resolveClickZoneAction(0.9, { readingDirection: "ltr" }), "next");
  assert.equal(layout.resolveClickZoneAction(0.1, { readingDirection: "rtl" }), "next");
  assert.equal(layout.resolveClickZoneAction(0.5, { readingDirection: "rtl" }), null);
});

class FakeClassList {
  constructor() {
    this.values = new Set();
  }
  add(value) {
    this.values.add(value);
  }
  remove(value) {
    this.values.delete(value);
  }
  contains(value) {
    return this.values.has(value);
  }
}

class FakeImage extends EventTarget {
  constructor() {
    super();
    this.dataset = {};
    this.style = {};
    this.classList = new FakeClassList();
    this.isConnected = true;
    this.src = "";
  }
  getBoundingClientRect() {
    return { top: 0, bottom: 200 };
  }
  get offsetHeight() {
    return 200;
  }
  get offsetTop() {
    return 0;
  }
}

function createPagedHarness() {
  const pages = [];
  const pageChanges = [];
  const pagesEl = {
    clientWidth: 1000,
    clientHeight: 800,
    scrollTop: 0,
    scrollHeight: 800,
    dataset: {},
    innerHTML: "",
    appendChild(img) {
      pages.push(img);
    },
    querySelectorAll(selector) {
      return selector === ".page" ? pages.slice() : [];
    },
    addEventListener() {},
    getBoundingClientRect() {
      return { top: 0, bottom: 800, left: 0, width: 1000 };
    },
    scrollTo({ top }) {
      this.scrollTop = top;
    },
  };
  const windowObj = {
    requestAnimationFrame: (cb) => {
      cb();
      return 1;
    },
    cancelAnimationFrame: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    addEventListener: () => {},
    document: { visibilityState: "visible", addEventListener: () => {} },
    getComputedStyle: () => ({ paddingLeft: "0", paddingRight: "0", paddingTop: "0", paddingBottom: "0", marginBottom: "0" }),
  };
  const context = {
    window: windowObj,
    document: {
      createElement: (tag) => (tag === "img" ? new FakeImage() : { value: "", textContent: "" }),
    },
    URL: { createObjectURL: () => "blob:1", revokeObjectURL: () => {} },
    fetch: async () => ({ ok: true, blob: async () => ({}) }),
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    AbortController,
    Event,
  };
  vm.runInNewContext(layoutSource, context, { filename: "reader_layout.js" });
  vm.runInNewContext(controllerSource, context, { filename: "reader_page_controller.js" });
  const controller = context.window.nviewReaderPageController.createReaderPageController({
    win: windowObj,
    readerEl: { style: { display: "block" } },
    pagesEl,
    readerPageSelect: null,
    toAppBlobUrl: (p) => `appblob:///${p}`,
    appBlobFetchOptions: () => ({}),
    readerRuntimeConfig: { windowedResidency: { enabled: true } },
    onPageChange: (info) => pageChanges.push(info),
  });
  const pageList = Array.from({ length: 6 }, (_, i) => ({ path: `p${i}.jpg`, name: `p${i}`, w: 1000, h: 1500 }));
  return { controller, pages, pagesEl, pageChanges, pageList };
}

function visibleIndices(pages) {
  return pages.map((img, index) => (img.classList.contains("is-visible") ? index : -1)).filter((index) => index >= 0);
}

test("paged layout shows one spread at a time and navigates between spreads", () => {
  const { controller, pages, pagesEl, pageChanges, pageList } = createPagedHarness();
  controller.setLayout({ layoutMode: "paged", readingDirection: "rtl", pageSpread: "double" });
  controller.open({ pages: pageList });

  assert.equal(pagesEl.dataset.layout, "paged");
  assert.equal(pagesEl.dataset.direction, "rtl");
  assert.deepEqual(visibleIndices(pages), [0]);

  assert.equal(controller.nextPage(), true);
  assert.deepEqual(visibleIndices(pages), [1, 2]);
  assert.equal(controller.getCurrentPageIndex(), 1);
  assert.equal(pagesEl.dataset.spreadCount, "2");
  assert.equal(pageChanges.at(-1).pageIndex, 1);

  controller.goToPage(4);
  assert.deepEqual(visibleIndices(pages), [3, 4]);
  assert.equal(controller.nextPage(), true);
  assert.deepEqual(visibleIndices(pages), [5]);
  assert.equal(controller.isAtEnd(), true);
  assert.equal(controller.nextPage(), false);
  assert.equal(controller.prevPage(), true);
  assert.deepEqual(visibleIndices(pages), [3, 4]);
});

test("switching layouts keeps the current page", () => {
  const { controller, pages, pagesEl, pageList } = createPagedHarness();
  controller.open({ pages: pageList });
  assert.equal(pagesEl.dataset.layout, undefined);

  controller.setLayout({ layoutMode: "paged", pageSpread: "single" }, { anchorIndex: 3 });
  assert.deepEqual(visibleIndices(pages), [3]);

  controller.setLayout({ layoutMode: "paged", pageSpread: "double" });
  assert.deepEqual(visibleIndices(pages), [3, 4]);

  controller.setLayout({ layoutMode: "vertical" });
  assert.equal(pagesEl.dataset.layout, undefined);
  assert.deepEqual(visibleIndices(pages), []);
  assert.ok(pages.every((img) => String(img.style.minHeight || "").endsWith("px")));
});
