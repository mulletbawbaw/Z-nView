// @ts-check
const { extractSequentialPageImageUrls, rewriteThumbToImageUrl } = require("../gallery_design_common");

function parsePagesFromDocument(documentRef) {
  const pagesNode = Array.from(documentRef.querySelectorAll(".galleries_info li")).find((li) =>
    /\bpages\s*:/i.test((li.textContent || "").trim()),
  );
  const pagesText = (pagesNode?.textContent || "").trim();
  const pagesNum = Number.parseInt(pagesText.replace(/^.*?pages\s*:\s*/i, ""), 10);
  return Number.isFinite(pagesNum) && pagesNum > 0 ? pagesNum : null;
}

// Thumbnails are always .jpg while pages may be webp/png, so the per-page extension comes from g_th.
function extractPageImageUrls(documentRef, locationRef) {
  return extractSequentialPageImageUrls(documentRef, locationRef, {
    thumbSelector: "#append_thumbs .gthumb img",
    pageCount: parsePagesFromDocument(documentRef),
  });
}

module.exports = {
  extractPageImageUrls,
  rewriteThumbToImageUrl,
};
