// @ts-check
const { extractMetadata, extractGalleryId } = require("./metadata_extractor");
const { extractPageImageUrls, rewriteThumbToImageUrl } = require("./page_list_extractor");
const { DIRECT_DOWNLOAD_RULES, matchesNhentaiXxxGalleryUrl } = require("./url_rules");

const nhentaiXxxSourceAdapter = {
  sourceId: "nhentai_xxx",
  displayName: "nHentai(xxx)",
  defaultAllowedDomains: Object.freeze([
    "*.nhentaimg.com",
    "*.cloudflare.com",
    "*.bootstrapcdn.com",
    "*.googleapis.com",
  ]),
  matchesUrl(urlValue) {
    return matchesNhentaiXxxGalleryUrl(urlValue);
  },
  extractMetadata,
  extractPageImageUrls,
  extractGalleryId,
  rewriteThumbToImageUrl,
  directDownloadRules: DIRECT_DOWNLOAD_RULES,
};

module.exports = {
  nhentaiXxxSourceAdapter,
};
