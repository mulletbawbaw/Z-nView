// @ts-check
const { extractMetadata, extractGalleryId } = require("./metadata_extractor");
const { extractPageImageUrls, rewriteThumbToImageUrl } = require("./page_list_extractor");
const { DIRECT_DOWNLOAD_RULES, matchesHentaifoxGalleryUrl } = require("./url_rules");

const hentaifoxSourceAdapter = {
  sourceId: "hentaifox",
  displayName: "HentaiFox",
  defaultAllowedDomains: Object.freeze([
    "*.cloudflare.com",
    "*.bootstrapcdn.com",
    "*.googleapis.com",
  ]),
  matchesUrl(urlValue) {
    return matchesHentaifoxGalleryUrl(urlValue);
  },
  extractMetadata,
  extractPageImageUrls,
  extractGalleryId,
  rewriteThumbToImageUrl,
  directDownloadRules: DIRECT_DOWNLOAD_RULES,
};

module.exports = {
  hentaifoxSourceAdapter,
};
