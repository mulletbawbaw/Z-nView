// @ts-check
// Shared helpers for sources built on the same gallery engine: hidden `load_*`
// inputs, `<n>t.<ext>` thumbnails and a `g_th` JSON map with per-page formats.

const IMAGE_EXTENSIONS_BY_CODE = Object.freeze({
  j: "jpg",
  p: "png",
  g: "gif",
  w: "webp",
  b: "bmp",
});

const THUMB_PATH_PATTERN = /\/\d+t\.[a-z0-9]+$/i;

function textContent(el) {
  return el && el.textContent ? el.textContent.replace(/\s+/g, " ").trim() : "";
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readHiddenInputValue(documentRef, id) {
  const input = documentRef.querySelector(`input#${id}`);
  return String(input?.getAttribute("value") || "").trim();
}

function extractGalleryIdFromPath(locationRef, pattern) {
  const match = String(locationRef?.pathname || "").match(pattern);
  return match ? match[1] : "";
}

function toAbsoluteUrl(rawUrl, locationHref) {
  if (!rawUrl) return "";
  try {
    return new URL(rawUrl, locationHref).toString();
  } catch {
    return "";
  }
}

/**
 * @param {string} raw
 * @param {{ locationHref?: string }} [options]
 */
function rewriteThumbToImageUrl(raw, { locationHref } = {}) {
  const absolute = toAbsoluteUrl(raw, locationHref);
  if (!absolute) return "";

  let parsed;
  try {
    parsed = new URL(absolute);
  } catch {
    return "";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
  parsed.pathname = parsed.pathname.replace(/(\d+)t(\.[a-z0-9]+)$/i, "$1$2");
  return parsed.toString();
}

function parsePageExtensionMap(documentRef) {
  const extensions = new Map();
  for (const script of Array.from(documentRef.querySelectorAll("script"))) {
    const source = String(script.textContent || "");
    if (!source.includes("g_th")) continue;
    const match = source.match(/g_th\s*=\s*\$\.parseJSON\(\s*'([\s\S]*?)'\s*\)/);
    if (!match) continue;
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      continue;
    }
    // Some sources nest the full-size map under `fl` next to thumb/cover maps.
    const pages = parsed?.fl && typeof parsed.fl === "object" ? parsed.fl : parsed;
    if (!pages || typeof pages !== "object") continue;
    for (const [pageKey, info] of Object.entries(pages)) {
      const page = parsePositiveInt(pageKey);
      const extension = IMAGE_EXTENSIONS_BY_CODE[String(info || "").split(",")[0]];
      if (page && extension) extensions.set(page, extension);
    }
    break;
  }
  return extensions;
}

function collectThumbUrls(documentRef, thumbSelector) {
  return Array.from(documentRef.querySelectorAll(thumbSelector))
    .map((img) => img.getAttribute("data-src") || img.getAttribute("src") || "")
    .map((raw) => String(raw).trim())
    .filter((raw) => {
      if (!raw || raw.startsWith("data:")) return false;
      try {
        return THUMB_PATH_PATTERN.test(new URL(raw, "https://placeholder.invalid/").pathname);
      } catch {
        return false;
      }
    });
}

function buildSequentialImageUrls(firstImageUrl, pageCount, extensionsByPage) {
  let parsed;
  try {
    parsed = new URL(firstImageUrl);
  } catch {
    return [];
  }
  const match = parsed.pathname.match(/^(.*\/)\d+\.([a-z0-9]+)$/i);
  if (!match) return [];
  const [, prefix, fallbackExtension] = match;
  return Array.from({ length: pageCount }, (_, idx) => {
    const page = idx + 1;
    parsed.pathname = `${prefix}${page}.${extensionsByPage.get(page) || fallbackExtension}`;
    return parsed.toString();
  });
}

// Gallery pages only render the first few thumbnails, so full page lists are
// rebuilt from the first thumbnail's directory plus the reported page count.
function extractSequentialPageImageUrls(documentRef, locationRef, { thumbSelector, pageCount = null }) {
  const locationHref = locationRef?.href;
  const imageUrls = collectThumbUrls(documentRef, thumbSelector)
    .map((raw) => rewriteThumbToImageUrl(raw, { locationHref }))
    .filter(Boolean);
  const count = pageCount
    || parsePositiveInt(readHiddenInputValue(documentRef, "load_pages"))
    || parsePositiveInt(readHiddenInputValue(documentRef, "t_pages"));

  if (imageUrls[0] && count) {
    const sequential = buildSequentialImageUrls(imageUrls[0], count, parsePageExtensionMap(documentRef));
    if (sequential.length) return sequential;
  }

  return Array.from(new Set(imageUrls));
}

module.exports = {
  extractGalleryIdFromPath,
  extractSequentialPageImageUrls,
  parsePageExtensionMap,
  parsePositiveInt,
  readHiddenInputValue,
  rewriteThumbToImageUrl,
  textContent,
};
