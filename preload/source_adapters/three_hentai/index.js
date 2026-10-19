// @ts-check
const { extractMetadata, extractGalleryId } = require("./metadata_extractor");
const { extractPageImageUrls, rewriteThumbToImageUrl } = require("./page_list_extractor");
const { DIRECT_DOWNLOAD_RULES, matchesThreeHentaiGalleryUrl } = require("./url_rules");

const threeHentaiSourceAdapter = {
  sourceId: "3hentai",
  displayName: "3Hentai",
  defaultAllowedDomains: Object.freeze([
    "*.3hentai.xyz",
    "*.cloudflare.com",
    "*.googleapis.com",
  ]),
  matchesUrl(urlValue) {
    return matchesThreeHentaiGalleryUrl(urlValue);
  },
  extractMetadata,
  extractPageImageUrls,
  extractGalleryId,
  rewriteThumbToImageUrl,
  directDownloadRules: DIRECT_DOWNLOAD_RULES,
};

module.exports = {
  threeHentaiSourceAdapter,
};
