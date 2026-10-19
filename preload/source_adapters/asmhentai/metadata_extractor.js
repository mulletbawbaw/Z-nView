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
  const infoRoot = documentRef.querySelector(".book_page") || documentRef;
  const name = textContent(infoRoot.querySelector(".info h1")) || null;
  const sections = Array.from(infoRoot.querySelectorAll(".tags"));

  // Each section is `<div class="tags"><h3>Label:</h3><div class="tag_list">...</div></div>`.
  const namesFrom = (label) => {
    const section = sections.find(
      (entry) => textContent(entry.querySelector("h3")).replace(/:$/, "").toLowerCase() === label,
    );
    return section
      ? Array.from(section.querySelectorAll(".tag_list .tag"))
          .map((entry) => entry.childNodes[0]?.textContent?.trim() || "")
          .filter(Boolean)
      : [];
  };

  const pages = parsePositiveInt(readHiddenInputValue(documentRef, "t_pages"))
    || parsePositiveInt(textContent(infoRoot.querySelector(".pages h3")));

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
