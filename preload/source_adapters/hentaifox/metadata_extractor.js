// @ts-check
const {
  extractGalleryIdFromPath,
  parsePositiveInt,
  readHiddenInputValue,
  textContent,
} = require("../gallery_design_common");

function extractGalleryId(documentRef, locationRef) {
  return extractGalleryIdFromPath(locationRef, /\/gallery\/(\d+)\/?/i);
}

function extractMetadata(documentRef, locationRef) {
  const infoRoot = documentRef.querySelector(".gallery_right .info") || documentRef;
  const name = textContent(infoRoot.querySelector("h1")) || null;

  // Each list is `<ul class="<field>">` with `<a class="tag_btn">name <span class="t_badge">count</span></a>`.
  const namesFrom = (listClass) =>
    Array.from(infoRoot.querySelectorAll(`ul.${listClass} a.tag_btn`))
      .map((entry) => entry.childNodes[0]?.textContent?.trim() || "")
      .filter(Boolean);

  const pagesLabel = Array.from(infoRoot.querySelectorAll(".i_text.pages"))
    .map((el) => textContent(el))
    .find((text) => /^pages\s*:/i.test(text));
  const pages = parsePositiveInt(readHiddenInputValue(documentRef, "load_pages")) || parsePositiveInt(pagesLabel);

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
