// @ts-check
const { normalizeHttpUrl, matchesUrlHashes } = require("../url_identity");

const DIRECT_DOWNLOAD_RULES = Object.freeze({
  originHashes: Object.freeze(["46d787dbf59b7f8114bf9bd3fa559b26d8070a2dd7986c34e9f38cc6c342c0f8"]),
  pathPatterns: Object.freeze(["/gallery/*"]),
});

function parseUrl(value) {
  return normalizeHttpUrl(value);
}

function matchesHentaifoxGalleryUrl(value) {
  const parsed = parseUrl(value);
  if (!parsed) return false;
  const pathMatch = /^\/gallery\/\d+\/?$/i.test(parsed.pathname);
  if (!pathMatch) return false;
  return matchesUrlHashes(parsed.href, DIRECT_DOWNLOAD_RULES.originHashes);
}

module.exports = {
  DIRECT_DOWNLOAD_RULES,
  matchesHentaifoxGalleryUrl,
  parseUrl,
};
