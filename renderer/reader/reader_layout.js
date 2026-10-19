(function initReaderLayoutModule(globalObj) {
  const LAYOUT_MODES = Object.freeze(["vertical", "paged"]);
  const READING_DIRECTIONS = Object.freeze(["ltr", "rtl"]);
  const PAGE_SPREADS = Object.freeze(["single", "double"]);
  const DEFAULT_READER_LAYOUT = Object.freeze({
    layoutMode: "vertical",
    readingDirection: "ltr",
    pageSpread: "single",
  });
  const MAX_COMIC_OVERRIDES = 500;
  // A scan wider than this ratio is already a two-page spread and is never paired.
  const WIDE_PAGE_RATIO = 1.1;
  const RTL_LANGUAGES = new Set(["japanese"]);

  function pickOption(value, allowed, fallback) {
    const normalized = String(value || "").trim().toLowerCase();
    return allowed.includes(normalized) ? normalized : fallback;
  }

  function normalizeLayoutPrefs(value, fallback = DEFAULT_READER_LAYOUT) {
    const source = value && typeof value === "object" ? value : {};
    return {
      layoutMode: pickOption(source.layoutMode, LAYOUT_MODES, fallback.layoutMode),
      readingDirection: pickOption(source.readingDirection, READING_DIRECTIONS, fallback.readingDirection),
      pageSpread: pickOption(source.pageSpread, PAGE_SPREADS, fallback.pageSpread),
    };
  }

  function isWidePage(dims) {
    const width = Number(dims?.w || 0);
    const height = Number(dims?.h || 0);
    if (!(width > 0) || !(height > 0)) return false;
    return width > height * WIDE_PAGE_RATIO;
  }

  // Returns groups of page indices shown together. In double mode the cover stays alone and wide scans
  // break the pairing so later pages still line up as left/right halves of the printed book.
  function computeSpreads(pageDims, { pageSpread = "single" } = {}) {
    const dims = Array.isArray(pageDims) ? pageDims : [];
    const spreads = [];
    if (pageSpread !== "double") {
      for (let i = 0; i < dims.length; i += 1) spreads.push([i]);
      return spreads;
    }
    let i = 0;
    while (i < dims.length) {
      if (i === 0 || isWidePage(dims[i])) {
        spreads.push([i]);
        i += 1;
        continue;
      }
      const next = i + 1;
      if (next < dims.length && !isWidePage(dims[next])) {
        spreads.push([i, next]);
        i += 2;
      } else {
        spreads.push([i]);
        i += 1;
      }
    }
    return spreads;
  }

  function findSpreadIndex(spreads, pageIndex) {
    const list = Array.isArray(spreads) ? spreads : [];
    const target = Number(pageIndex);
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].includes(target)) return i;
    }
    return list.length ? (target < list[0][0] ? 0 : list.length - 1) : -1;
  }

  function hasRtlLanguage(languages) {
    const list = Array.isArray(languages) ? languages : [];
    return list.some((language) => RTL_LANGUAGES.has(String(language || "").trim().toLowerCase()));
  }

  // Priority: explicit choice for this comic > language rule > global defaults.
  function resolveReaderPreferences({ readerSettings, comicId, languages } = {}) {
    const settings = readerSettings && typeof readerSettings === "object" ? readerSettings : {};
    const defaults = normalizeLayoutPrefs(settings);
    const overrides = settings.comicOverrides && typeof settings.comicOverrides === "object"
      ? settings.comicOverrides
      : {};
    const key = String(comicId || "").trim();
    if (key && Object.prototype.hasOwnProperty.call(overrides, key)) {
      return { ...normalizeLayoutPrefs(overrides[key], defaults), source: "comic" };
    }
    if (settings.autoDirectionByLanguage !== false && hasRtlLanguage(languages)) {
      return { ...defaults, layoutMode: "paged", readingDirection: "rtl", source: "language" };
    }
    return { ...defaults, source: "default" };
  }

  function pruneComicOverrides(overrides, maxEntries = MAX_COMIC_OVERRIDES) {
    const source = overrides && typeof overrides === "object" ? overrides : {};
    const entries = Object.entries(source)
      .filter(([key, value]) => String(key || "").trim() && value && typeof value === "object")
      .map(([key, value]) => [key, { ...normalizeLayoutPrefs(value), updatedAt: Number(value.updatedAt) || 0 }]);
    entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    return Object.fromEntries(entries.slice(0, Math.max(0, maxEntries)));
  }

  function withComicOverride(readerSettings, comicId, prefs, now = Date.now()) {
    const settings = readerSettings && typeof readerSettings === "object" ? readerSettings : {};
    const key = String(comicId || "").trim();
    if (!key) return { ...settings };
    const overrides = {
      ...(settings.comicOverrides && typeof settings.comicOverrides === "object" ? settings.comicOverrides : {}),
      [key]: { ...normalizeLayoutPrefs(prefs), updatedAt: now },
    };
    return { ...settings, comicOverrides: pruneComicOverrides(overrides) };
  }

  // Maps a key press to a navigation action; arrow keys follow the reading direction.
  function resolveNavigationKey(key, { readingDirection = "ltr", shiftKey = false } = {}) {
    const rtl = readingDirection === "rtl";
    switch (key) {
      case "ArrowRight":
        return rtl ? "prev" : "next";
      case "ArrowLeft":
        return rtl ? "next" : "prev";
      case "PageDown":
      case "ArrowDown":
        return "next";
      case "PageUp":
      case "ArrowUp":
        return "prev";
      case " ":
        return shiftKey ? "prev" : "next";
      case "Home":
        return "first";
      case "End":
        return "last";
      default:
        return null;
    }
  }

  // Clicking the outer thirds turns the page; the side that advances depends on the reading direction.
  function resolveClickZoneAction(xFraction, { readingDirection = "ltr" } = {}) {
    const x = Number(xFraction);
    if (!Number.isFinite(x)) return null;
    const rtl = readingDirection === "rtl";
    if (x < 1 / 3) return rtl ? "next" : "prev";
    if (x > 2 / 3) return rtl ? "prev" : "next";
    return null;
  }

  globalObj.nviewReaderLayout = {
    DEFAULT_READER_LAYOUT,
    LAYOUT_MODES,
    MAX_COMIC_OVERRIDES,
    PAGE_SPREADS,
    READING_DIRECTIONS,
    computeSpreads,
    findSpreadIndex,
    isWidePage,
    normalizeLayoutPrefs,
    pruneComicOverrides,
    resolveClickZoneAction,
    resolveNavigationKey,
    resolveReaderPreferences,
    withComicOverride,
  };
})(window);
