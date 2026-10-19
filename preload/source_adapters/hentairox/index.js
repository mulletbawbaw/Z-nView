// @ts-check
const { extractMetadata, extractGalleryId } = require("./metadata_extractor");
const { extractPageImageUrls, rewriteThumbToImageUrl } = require("./page_list_extractor");
const { DIRECT_DOWNLOAD_RULES, matchesHentairoxGalleryUrl } = require("./url_rules");

const hentairoxSourceAdapter = {
  sourceId: "hentairox",
  displayName: "HentaiRox",
  defaultAllowedDomains: Object.freeze([
    "*.cloudflare.com",
    "*.bootstrapcdn.com",
    "*.googleapis.com",
  ]),
  matchesUrl(urlValue) {
    return matchesHentairoxGalleryUrl(urlValue);
  },
  extractMetadata,
  extractPageImageUrls,
  extractGalleryId,
  rewriteThumbToImageUrl,
  directDownloadRules: DIRECT_DOWNLOAD_RULES,
};

module.exports = {
  hentairoxSourceAdapter,
};
