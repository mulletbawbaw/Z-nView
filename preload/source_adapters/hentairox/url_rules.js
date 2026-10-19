// @ts-check
const { normalizeHttpUrl, matchesUrlHashes } = require("../url_identity");

const DIRECT_DOWNLOAD_RULES = Object.freeze({
  originHashes: Object.freeze(["af9a5a1bec1963c38620fa6502b90b134da820843b7099de0d195de1d2e752be"]),
  pathPatterns: Object.freeze(["/gallery/*"]),
});

function parseUrl(value) {
  return normalizeHttpUrl(value);
}

function matchesHentairoxGalleryUrl(value) {
  const parsed = parseUrl(value);
  if (!parsed) return false;
  const pathMatch = /^\/gallery\/\d+\/?$/i.test(parsed.pathname);
  if (!pathMatch) return false;
  return matchesUrlHashes(parsed.href, DIRECT_DOWNLOAD_RULES.originHashes);
}

module.exports = {
  DIRECT_DOWNLOAD_RULES,
  matchesHentairoxGalleryUrl,
  parseUrl,
};
