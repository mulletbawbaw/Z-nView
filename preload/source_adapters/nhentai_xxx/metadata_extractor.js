// @ts-check
const {
  extractGalleryIdFromPath,
  parsePositiveInt,
  readHiddenInputValue,
  textContent,
} = require("../gallery_design_common");

function extractGalleryId(documentRef, locationRef) {
  return extractGalleryIdFromPath(locationRef, /\/g\/(\d+)\/?/i);
}

function extractMetadata(documentRef, locationRef) {
  const infoRoot = documentRef.querySelector(".info") || documentRef;
  const name = textContent(infoRoot.querySelector("h1")) || null;
  const rows = Array.from(infoRoot.querySelectorAll("li.tags"));

  // Each row is `<li class="tags"><span class="text">Label</span><a class="tag_btn"><span class="tag_name">`.
  const namesFrom = (label) => {
    const row = rows.find((entry) => textContent(entry.querySelector(".text")).replace(/:$/, "").toLowerCase() === label);
    return row
      ? Array.from(row.querySelectorAll(".tag_name:not(.pages)")).map((entry) => textContent(entry)).filter(Boolean)
      : [];
  };

  const pages = parsePositiveInt(readHiddenInputValue(documentRef, "load_pages"))
    || parsePositiveInt(textContent(infoRoot.querySelector(".tag_name.pages")));

  const artists = namesFrom("artists");

  return {
    sourceUrl: String(locationRef?.href || ""),
    galleryId: extractGalleryId(documentRef, locationRef) || null,
    comicName: name,
    artists,
    artist: artists[0] || null,
    tags: namesFrom("tags"),
    parodies: namesFrom("parodies"),
    characters: namesFrom("characters"),
    languages: namesFrom("languages"),
    pages,
    capturedAt: new Date().toISOString(),
  };
}

module.exports = {
  extractGalleryId,
  extractMetadata,
};
