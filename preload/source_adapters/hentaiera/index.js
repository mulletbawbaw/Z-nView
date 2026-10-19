// @ts-check
const { extractMetadata, extractGalleryId } = require("./metadata_extractor");
const { extractPageImageUrls, rewriteThumbToImageUrl } = require("./page_list_extractor");
const { DIRECT_DOWNLOAD_RULES, matchesHentaieraGalleryUrl } = require("./url_rules");

const hentaieraSourceAdapter = {
  sourceId: "hentaiera",
  displayName: "HentaiEra",
  defaultAllowedDomains: Object.freeze([
    "*.cloudflare.com",
    "*.bootstrapcdn.com",
    "*.googleapis.com",
  ]),
  matchesUrl(urlValue) {
    return matchesHentaieraGalleryUrl(urlValue);
  },
  extractMetadata,
  extractPageImageUrls,
  extractGalleryId,
  rewriteThumbToImageUrl,
  directDownloadRules: DIRECT_DOWNLOAD_RULES,
};

module.exports = {
  hentaieraSourceAdapter,
};
