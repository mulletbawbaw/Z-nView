// @ts-check

const SESSION_OPEN_COMICS_MAX = 50;
const SESSION_SAVE_DELAY_MS = 3000;
const COMIC_ID_PATTERN = /^comic_[\w-]+$/;

/**
 * Remembers which galleries are open in the reader (and on which page) so the next start can reopen them after
 * the vault is unlocked. Only the comic folder id is stored, inside the encrypted settings; directories are
 * resolved again against the active library root on restore.
 *
 * @param {{
 *   settingsManager: { getSettings: () => any, updateSettings: (partial: any, options?: any) => any },
 *   path: typeof import("path"),
 *   fs: { existsSync: (p: string) => boolean },
 *   getLibraryRoot: () => string,
 *   isUnderLibraryRoot: (p: string) => boolean,
 *   isVaultUnlocked: () => boolean,
 *   getActiveTabId?: () => string,
 *   saveDelayMs?: number,
 *   setTimer?: (fn: () => void, ms: number) => any,
 *   clearTimer?: (handle: any) => void,
 * }} deps
 */
function createSessionRestore({
  settingsManager,
  path,
  fs,
  getLibraryRoot,
  isUnderLibraryRoot,
  isVaultUnlocked,
  getActiveTabId = () => "",
  saveDelayMs = SESSION_SAVE_DELAY_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  /** @type {null | { openComics: { id: string, page: number }[], activeComicId: string }} */
  let pending = null;
  /** @type {any} */
  let saveTimer = null;
  let frozen = false;
  let restoreTaken = false;
  /** @type {null | ((plan: RestorePlan) => void)} */
  let restorer = null;

  /** @param {string} comicDir */
  function toComicId(comicDir) {
    const dir = String(comicDir || "").trim();
    if (!dir) return "";
    const id = path.basename(dir);
    if (!COMIC_ID_PATTERN.test(id)) return "";
    if (path.resolve(path.dirname(dir)) !== path.resolve(getLibraryRoot())) return "";
    return id;
  }

  function getSessionSettings() {
    const session = settingsManager.getSettings()?.session;
    return session && typeof session === "object" ? session : { restoreTabs: true, openComics: [], activeComicId: "", activeTab: "gallery" };
  }

  /**
   * Accepts the reader's `ui:syncOpenComics` payload: either the legacy list of directories or
   * `{ comics: [{ comicDir, pageIndex }], activeComicDir }`.
   *
   * @param {any} payload
   */
  function normalizeRecordPayload(payload) {
    const rawComics = Array.isArray(payload) ? payload : (Array.isArray(payload?.comics) ? payload.comics : []);
    const seen = new Set();
    const openComics = [];
    for (const entry of rawComics) {
      const comicDir = typeof entry === "string" ? entry : entry?.comicDir;
      const id = toComicId(comicDir);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const page = Number(typeof entry === "string" ? 0 : entry?.pageIndex);
      openComics.push({ id, page: Number.isInteger(page) && page > 0 ? page : 0 });
      if (openComics.length >= SESSION_OPEN_COMICS_MAX) break;
    }
    const activeComicId = toComicId(Array.isArray(payload) ? "" : payload?.activeComicDir);
    return { openComics, activeComicId: seen.has(activeComicId) ? activeComicId : "" };
  }

  /** @param {{ openComics: { id: string, page: number }[], activeComicId: string }} next */
  function isSameAsSaved(next) {
    const saved = getSessionSettings();
    return saved.activeComicId === next.activeComicId
      && JSON.stringify(saved.openComics || []) === JSON.stringify(next.openComics);
  }

  /** @param {{ activeTab?: string }} [extra] */
  function flush(extra = {}) {
    if (saveTimer) {
      clearTimer(saveTimer);
      saveTimer = null;
    }
    const next = pending;
    pending = null;
    if (!isVaultUnlocked()) return false;
    const saved = getSessionSettings();
    if (saved.restoreTabs === false) return false;
    if (!next && !extra.activeTab) return false;
    if (next && isSameAsSaved(next) && (!extra.activeTab || extra.activeTab === saved.activeTab)) return false;
    settingsManager.updateSettings({
      session: {
        ...saved,
        ...(next || {}),
        ...(extra.activeTab ? { activeTab: extra.activeTab } : {}),
      },
    }, { suppressVaultLockedWarning: true });
    return true;
  }

  /** @param {any} payload */
  function record(payload) {
    if (frozen || !isVaultUnlocked()) return;
    if (getSessionSettings().restoreTabs === false) return;
    const next = normalizeRecordPayload(payload);
    // Before the saved tabs were restored, an empty reader must not wipe them.
    if (!restoreTaken && !next.openComics.length) return;
    pending = next;
    if (saveTimer) clearTimer(saveTimer);
    saveTimer = setTimer(() => {
      saveTimer = null;
      flush();
    }, saveDelayMs);
  }

  /**
   * Called once the app starts closing: saves what is pending and ignores the reader's teardown sync (it reports
   * an empty list while its view unloads).
   */
  function freeze() {
    if (frozen) return;
    const activeTabId = String(getActiveTabId() || "");
    const activeTab = activeTabId === "reader" || activeTabId.startsWith("reader:") ? "reader" : "gallery";
    try {
      flush(restoreTaken ? { activeTab } : {});
    } catch (err) {
      console.warn("[session restore] save failed:", String(err));
    }
    frozen = true;
  }

  /**
   * @typedef {{ comicDirs: string[], pageIndexByDir: Record<string, number>, focusComicDir: string, activeTab: string }} RestorePlan
   */

  /** @returns {RestorePlan | null} */
  function takeRestorePlan() {
    if (restoreTaken) return null;
    restoreTaken = true;
    const saved = getSessionSettings();
    if (saved.restoreTabs === false) return null;
    const root = getLibraryRoot();
    /** @type {string[]} */
    const comicDirs = [];
    /** @type {Record<string, number>} */
    const pageIndexByDir = {};
    let focusComicDir = "";
    for (const entry of Array.isArray(saved.openComics) ? saved.openComics : []) {
      const id = String(entry?.id || "");
      if (!COMIC_ID_PATTERN.test(id)) continue;
      const comicDir = path.join(root, id);
      if (!isUnderLibraryRoot(comicDir) || !fs.existsSync(comicDir)) continue;
      comicDirs.push(comicDir);
      const page = Number(entry?.page);
      if (Number.isInteger(page) && page > 0) pageIndexByDir[comicDir] = page;
      if (id === saved.activeComicId) focusComicDir = comicDir;
    }
    if (!comicDirs.length) return null;
    return {
      comicDirs,
      pageIndexByDir,
      focusComicDir: focusComicDir || comicDirs[comicDirs.length - 1],
      activeTab: saved.activeTab === "reader" ? "reader" : "gallery",
    };
  }

  /** @param {(plan: RestorePlan) => void} fn */
  function setRestorer(fn) {
    restorer = typeof fn === "function" ? fn : null;
  }

  /** Reopens the saved tabs once per run; later unlocks (after a manual lock) do nothing. */
  function restoreOnce() {
    if (restoreTaken || !restorer) return false;
    const plan = takeRestorePlan();
    if (!plan) return false;
    try {
      restorer(plan);
      return true;
    } catch (err) {
      console.warn("[session restore] restore failed:", String(err));
      return false;
    }
  }

  return {
    flush,
    freeze,
    record,
    restoreOnce,
    setRestorer,
    takeRestorePlan,
  };
}

module.exports = {
  COMIC_ID_PATTERN,
  SESSION_OPEN_COMICS_MAX,
  createSessionRestore,
};
