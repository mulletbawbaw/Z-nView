// @ts-check
const { normalizeHttpUrl, matchesUrlHashes } = require("../url_identity");

const DIRECT_DOWNLOAD_RULES = Object.freeze({
  originHashes: Object.freeze(["9e68bcc36a44dff0a44e5894c5eb8c23c788505919409443f7b60b9c18880255"]),
  pathPatterns: Object.freeze(["/gallery/*"]),
});

function parseUrl(value) {
  return normalizeHttpUrl(value);
}

function matchesHentaieraGalleryUrl(value) {
  const parsed = parseUrl(value);
  if (!parsed) return false;
  const pathMatch = /^\/gallery\/\d+\/?$/i.test(parsed.pathname);
  if (!pathMatch) return false;
  return matchesUrlHashes(parsed.href, DIRECT_DOWNLOAD_RULES.originHashes);
}

module.exports = {
  DIRECT_DOWNLOAD_RULES,
  matchesHentaieraGalleryUrl,
  parseUrl,
};
