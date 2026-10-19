// @ts-check
const { extractSequentialPageImageUrls, rewriteThumbToImageUrl } = require("../gallery_design_common");
const { parsePageCount } = require("./metadata_extractor");

function extractPageImageUrls(documentRef, locationRef) {
  return extractSequentialPageImageUrls(documentRef, locationRef, {
    thumbSelector: ".single-thumb img",
    pageCount: parsePageCount(documentRef),
  });
}

module.exports = {
  extractPageImageUrls,
  rewriteThumbToImageUrl,
};
