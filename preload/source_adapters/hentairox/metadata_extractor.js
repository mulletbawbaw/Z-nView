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

// 2026 redesign: `.hr-gallery-entity-group` blocks labelled "Tags:", "Artists:", … with `.hr-gallery-tag__name` items.
function extractRedesignMetadata(documentRef, locationRef) {
  const groups = Array.from(documentRef.querySelectorAll(".hr-gallery-entity-group"));
  const namesFrom = (label) => {
    const group = groups.find((entry) =>
      textContent(entry.querySelector(".hr-gallery-entity-label")).replace(/:$/, "").toLowerCase() === label,
    );
    return group
      ? Array.from(group.querySelectorAll(".hr-gallery-tag__name")).map((entry) => textContent(entry)).filter(Boolean)
      : [];
  };
  const grid = documentRef.querySelector("#js-thumbs-grid");
  const pages = parsePositiveInt(grid?.getAttribute("data-total-pages"))
    || parsePositiveInt(textContent(documentRef.querySelector(".hr-gallery-pages")).replace(/\D+/g, ""));
  const artists = namesFrom("artists");

  return {
    sourceUrl: String(locationRef?.href || ""),
    galleryId: extractGalleryId(documentRef, locationRef) || null,
    comicName: textContent(documentRef.querySelector("#gallery-title")) || textContent(documentRef.querySelector("h1")) || null,
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

function extractMetadata(documentRef, locationRef) {
  if (documentRef.querySelector(".hr-gallery-entity-group")) return extractRedesignMetadata(documentRef, locationRef);
  const name = textContent(documentRef.querySelector("h1")) || null;
  const containers = Array.from(documentRef.querySelectorAll(".galleries_info li"));

  const findContainer = (label) =>
    containers.find((container) =>
      textContent(container.querySelector(".tags_text")).replace(/:$/, "").toLowerCase() === label,
    );

  const namesFrom = (label) => {
    const container = findContainer(label);
    return container
      ? Array.from(container.querySelectorAll("a.tag .item_name")).map((entry) => textContent(entry)).filter(Boolean)
      : [];
  };

  const pages = parsePositiveInt(readHiddenInputValue(documentRef, "load_pages"))
    || parsePositiveInt(textContent(documentRef.querySelector(".galleries_info li.pages")));

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
