// @ts-check
const { normalizeHttpUrl, matchesUrlHashes } = require("../url_identity");

const DIRECT_DOWNLOAD_RULES = Object.freeze({
  originHashes: Object.freeze(["2c8c341f58bbb9d77cd2ee0e5ce7e087a8f98a67a3a2e74ac2b82d5c40ad8f26"]),
  pathPatterns: Object.freeze(["/g/*"]),
});

function parseUrl(value) {
  return normalizeHttpUrl(value);
}

function matchesAsmhentaiGalleryUrl(value) {
  const parsed = parseUrl(value);
  if (!parsed) return false;
  const pathMatch = /^\/g\/\d+\/?$/i.test(parsed.pathname);
  if (!pathMatch) return false;
  return matchesUrlHashes(parsed.href, DIRECT_DOWNLOAD_RULES.originHashes);
}

module.exports = {
  DIRECT_DOWNLOAD_RULES,
  matchesAsmhentaiGalleryUrl,
  parseUrl,
};
