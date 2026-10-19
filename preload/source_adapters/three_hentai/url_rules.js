// @ts-check
const { normalizeHttpUrl, matchesUrlHashes } = require("../url_identity");

const DIRECT_DOWNLOAD_RULES = Object.freeze({
  originHashes: Object.freeze(["0caddd18aaacb66015f692e085e2278ff8e618c97a4e649701b7a5be4c5b5b49"]),
  pathPatterns: Object.freeze(["/d/*"]),
});

function parseUrl(value) {
  return normalizeHttpUrl(value);
}

function matchesThreeHentaiGalleryUrl(value) {
  const parsed = parseUrl(value);
  if (!parsed) return false;
  const pathMatch = /^\/d\/\d+\/?$/i.test(parsed.pathname);
  if (!pathMatch) return false;
  return matchesUrlHashes(parsed.href, DIRECT_DOWNLOAD_RULES.originHashes);
}

module.exports = {
  DIRECT_DOWNLOAD_RULES,
  matchesThreeHentaiGalleryUrl,
  parseUrl,
};
