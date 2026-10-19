// @ts-check
const { normalizeHttpUrl, matchesUrlHashes } = require("../url_identity");

const DIRECT_DOWNLOAD_RULES = Object.freeze({
  originHashes: Object.freeze(["040e14ed47954fc8ba70133e93ca03af2b2f996cfb46d6e3f87efdabdb071f42"]),
  pathPatterns: Object.freeze(["/g/*"]),
});

function parseUrl(value) {
  return normalizeHttpUrl(value);
}

function matchesNhentaiXxxGalleryUrl(value) {
  const parsed = parseUrl(value);
  if (!parsed) return false;
  const pathMatch = /^\/g\/\d+\/?$/i.test(parsed.pathname);
  if (!pathMatch) return false;
  return matchesUrlHashes(parsed.href, DIRECT_DOWNLOAD_RULES.originHashes);
}

module.exports = {
  DIRECT_DOWNLOAD_RULES,
  matchesNhentaiXxxGalleryUrl,
  parseUrl,
};
