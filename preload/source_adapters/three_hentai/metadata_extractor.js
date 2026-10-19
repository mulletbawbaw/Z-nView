// @ts-check
const { extractGalleryIdFromPath, parsePositiveInt, textContent } = require("../gallery_design_common");

// Tag links are grouped by their first path segment (e.g. `/language/english`
// is listed under "Tags:"), so classify by href rather than by section label.
const FIELD_BY_PATH_SEGMENT = Object.freeze({
  artists: "artists",
  artist: "artists",
  series: "parodies",
  parodies: "parodies",
  characters: "characters",
  language: "languages",
  tags: "tags",
});

function extractGalleryId(documentRef, locationRef) {
  return extractGalleryIdFromPath(locationRef, /\/d\/(\d+)\/?/i);
}

function parsePageCount(documentRef) {
  const container = Array.from(documentRef.querySelectorAll(".tag-container")).find((entry) =>
    /^pages\s*:/i.test(textContent(entry)),
  );
  return parsePositiveInt(textContent(container?.querySelector(".field-light-text")));
}

function extractMetadata(documentRef, locationRef) {
  const name = textContent(documentRef.querySelector("h1")) || null;
  const fields = { artists: [], parodies: [], characters: [], languages: [], tags: [] };

  for (const link of Array.from(documentRef.querySelectorAll(".tag-container .filter-elem a.name"))) {
    let segment = "";
    try {
      segment = new URL(link.getAttribute("href") || "", "https://placeholder.invalid/").pathname.split("/")[1] || "";
    } catch {
      continue;
    }
    const field = FIELD_BY_PATH_SEGMENT[segment.toLowerCase()];
    const value = textContent(link);
    if (field && value && !fields[field].includes(value)) fields[field].push(value);
  }

  return {
    sourceUrl: String(locationRef?.href || ""),
    galleryId: extractGalleryId(documentRef, locationRef) || null,
    comicName: name,
    artists: fields.artists,
    artist: fields.artists[0] || null,
    tags: fields.tags,
    parodies: fields.parodies,
    characters: fields.characters,
    languages: fields.languages,
    pages: parsePageCount(documentRef),
    capturedAt: new Date().toISOString(),
  };
}

module.exports = {
  extractGalleryId,
  extractMetadata,
  parsePageCount,
};
