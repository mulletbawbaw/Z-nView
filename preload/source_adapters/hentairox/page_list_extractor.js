// @ts-check
const {
  extractSequentialPageImageUrls,
  parsePositiveInt,
  rewriteThumbToImageUrl,
} = require("../gallery_design_common");

const DEFAULT_PAGE_EXTENSION = "webp";

/**
 * @param {string} htmlText
 * @param {{ domParserFactory?: (html: string) => any }} [options]
 */
function parseHtml(htmlText, { domParserFactory } = {}) {
  if (domParserFactory) return domParserFactory(htmlText);
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(String(htmlText || ""), "text/html");
}

/** Reads `[{ page, ext }]` and the image directory from the site's reader page. */
function parseReaderPages(documentRef) {
  const app = documentRef?.querySelector("#readerApp");
  const imageBase = String(app?.getAttribute("data-reader-image-base") || "").replace(/\/+$/, "");
  let pages = [];
  try {
    pages = JSON.parse(documentRef?.querySelector("#readerPagesJson")?.textContent || "[]");
  } catch {
    pages = [];
  }
  const extensionsByPage = new Map();
  for (const entry of Array.isArray(pages) ? pages : []) {
    const page = parsePositiveInt(entry?.page);
    const ext = String(entry?.ext || "").trim().toLowerCase();
    if (page && /^[a-z0-9]{2,5}$/.test(ext)) extensionsByPage.set(page, ext);
  }
  return { imageBase, extensionsByPage };
}

function readThumbDirectory(grid) {
  const thumb = grid.querySelector("img");
  const src = String(thumb?.getAttribute("src") || thumb?.getAttribute("data-src") || "");
  const match = src.match(/^(https?:\/\/[^?#]+)\/\d+t\.[a-z0-9]+(?:[?#].*)?$/i);
  return match ? match[1] : "";
}

// The 2026 redesign renders a few thumbnails in #js-thumbs-grid; the reader page carries the real extension of
// every page in #readerPagesJson, so it is fetched once (same origin) to build the full list.
async function extractRedesignPageImageUrls(grid, locationRef, helpers) {
  const galleryId = String(grid.getAttribute("data-gallery-id") || "").trim();
  const total = parsePositiveInt(grid.getAttribute("data-total-pages"));
  if (!galleryId || !total) return [];

  let imageBase = readThumbDirectory(grid);
  let extensionsByPage = new Map();
  const fetchImpl = helpers.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
  if (fetchImpl) {
    try {
      const readerUrl = new URL(`/g/${galleryId}/1/`, String(locationRef?.href || "")).toString();
      const response = await fetchImpl(readerUrl, { credentials: "same-origin" });
      if (response?.ok) {
        const parsed = parseReaderPages(parseHtml(await response.text(), helpers));
        imageBase = parsed.imageBase || imageBase;
        extensionsByPage = parsed.extensionsByPage;
      }
    } catch {
      // Fall back to the reader's own default extension below.
    }
  }
  if (!/^https?:\/\//i.test(imageBase)) return [];
  return Array.from({ length: total }, (_, idx) => {
    const page = idx + 1;
    return `${imageBase}/${page}.${extensionsByPage.get(page) || DEFAULT_PAGE_EXTENSION}`;
  });
}

async function extractPageImageUrls(documentRef, locationRef, helpers = {}) {
  const grid = documentRef.querySelector("#js-thumbs-grid");
  if (grid) return extractRedesignPageImageUrls(grid, locationRef, helpers);
  return extractSequentialPageImageUrls(documentRef, locationRef, { thumbSelector: "#append_thumbs .gthumb img" });
}

module.exports = {
  extractPageImageUrls,
  parseReaderPages,
  rewriteThumbToImageUrl,
};
