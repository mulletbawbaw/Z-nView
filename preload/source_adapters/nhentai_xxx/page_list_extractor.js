// @ts-check
const { extractSequentialPageImageUrls, rewriteThumbToImageUrl } = require("../gallery_design_common");

function extractPageImageUrls(documentRef, locationRef) {
  return extractSequentialPageImageUrls(documentRef, locationRef, { thumbSelector: ".gt_th img" });
}

module.exports = {
  extractPageImageUrls,
  rewriteThumbToImageUrl,
};
