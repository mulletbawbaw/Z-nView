// @ts-check
const { extractSequentialPageImageUrls, rewriteThumbToImageUrl } = require("../gallery_design_common");

function extractPageImageUrls(documentRef, locationRef) {
  return extractSequentialPageImageUrls(documentRef, locationRef, { thumbSelector: ".preview_thumb img" });
}

module.exports = {
  extractPageImageUrls,
  rewriteThumbToImageUrl,
};
