// @ts-check
const { extractSequentialPageImageUrls, rewriteThumbToImageUrl } = require("../gallery_design_common");

function extractPageImageUrls(documentRef, locationRef) {
  return extractSequentialPageImageUrls(documentRef, locationRef, { thumbSelector: "#append_thumbs .gthumb img" });
}

module.exports = {
  extractPageImageUrls,
  rewriteThumbToImageUrl,
};
