// @ts-check
const { extractMetadata, extractGalleryId } = require("./metadata_extractor");
const { extractPageImageUrls, rewriteThumbToImageUrl } = require("./page_list_extractor");
const { DIRECT_DOWNLOAD_RULES, matchesAsmhentaiGalleryUrl } = require("./url_rules");

const asmhentaiSourceAdapter = {
  sourceId: "asmhentai",
  displayName: "AsmHentai",
  defaultAllowedDomains: Object.freeze([
    "*.cloudflare.com",
    "*.bootstrapcdn.com",
    "*.googleapis.com",
  ]),
  matchesUrl(urlValue) {
    return matchesAsmhentaiGalleryUrl(urlValue);
  },
  extractMetadata,
  extractPageImageUrls,
  extractGalleryId,
  rewriteThumbToImageUrl,
  directDownloadRules: DIRECT_DOWNLOAD_RULES,
};

module.exports = {
  asmhentaiSourceAdapter,
};
