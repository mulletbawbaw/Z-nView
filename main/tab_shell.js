// @ts-check
const { EventEmitter } = require("events");

// Height of the tab strip drawn by the shell page at the top of the main window.
const TAB_BAR_HEIGHT = 40;
const HOME_TAB_ID = "gallery";
const READER_TAB_ID = "reader";
const READER_SESSION_TAB_PREFIX = "reader:";

/**
 * Hosts every app area (gallery, reader, web viewer, downloader, managers) as a WebContentsView inside one
 * window with a tab strip. Each area keeps its own webContents, preload and IPC role, and inactive areas stay
 * alive (hidden) so switching tabs never reloads them.
 *
 * Surfaces mimic the small BrowserWindow subset the rest of main uses (webContents, isDestroyed, focus, show,
 * close, isMinimized, restore, setBackgroundColor, getContentBounds, "closed" event).
 */
function createTabShell({
  BrowserWindow,
  WebContentsView,
  Menu,
  path,
  appRootDir,
  APP_ICON_PATH,
  preloadScriptPath,
  getBootstrapTheme,
  getBootstrapBackgroundColor,
  assignWebContentsRole,
  attachUiNavigationGuards,
}) {
  /** @type {any} */
  let shellWin = null;
  /** @type {Map<string, TabSurface>} */
  const surfaces = new Map();
  /** @type {string[]} */
  const order = [];
  let activeId = "";
  let previousActiveId = "";
  /** @type {{ sessions: { id: string, title: string }[], activeSessionId: string }} */
  let readerSessions = { sessions: [], activeSessionId: "" };
  /** @type {(command: { action: string, sessionId: string }) => void} */
  let sendReaderCommand = () => {};

  class TabSurface extends EventEmitter {
    /**
     * @param {{ id: string, title: string, closable: boolean, kind: string }} options
     */
    constructor({ id, title, closable, kind }) {
      super();
      this.id = id;
      this.title = title;
      this.closable = closable;
      this.kind = kind;
      this.badge = "";
      /** @type {any} */
      this.view = null;
      /** @type {any[]} */
      this.childViews = [];
      /** @type {null | ((area: { x: number, y: number, width: number, height: number }) => void)} */
      this.layoutHook = null;
      this.destroyed = false;
    }

    get webContents() {
      return this.view?.webContents;
    }

    isDestroyed() {
      return this.destroyed || !this.view || this.view.webContents.isDestroyed();
    }

    focus() {
      activateTab(this.id);
    }

    show() {
      activateTab(this.id);
    }

    isMinimized() {
      return Boolean(shellWin && !shellWin.isDestroyed() && shellWin.isMinimized());
    }

    restore() {
      if (shellWin && !shellWin.isDestroyed()) shellWin.restore();
    }

    close() {
      closeSurface(this.id, { force: true });
    }

    getOwnerWindow() {
      return shellWin;
    }

    getContentBounds() {
      return getAreaBounds();
    }

    /** @param {string} color */
    setBackgroundColor(color) {
      if (!this.isDestroyed()) this.view.setBackgroundColor(color);
    }

    /** @param {string} title */
    setTitle(title) {
      this.title = String(title || "").trim() || this.title;
      publishState();
    }

    /** @param {string} badge */
    setBadge(badge) {
      const next = String(badge || "");
      if (next === this.badge) return;
      this.badge = next;
      publishState();
    }

    /** Adds an extra view (e.g. the web page under the viewer toolbar) that follows this tab's visibility. */
    addChildView(view) {
      ensureShellWindow();
      shellWin.contentView.addChildView(view);
      this.childViews.push(view);
      view.setVisible(activeId === this.id);
      layoutSurface(this);
    }

    /** @param {(area: { x: number, y: number, width: number, height: number }) => void} hook */
    setLayoutHook(hook) {
      this.layoutHook = typeof hook === "function" ? hook : null;
      layoutSurface(this);
    }

    relayout() {
      layoutSurface(this);
    }
  }

  function getAreaBounds() {
    if (!shellWin || shellWin.isDestroyed()) return { x: 0, y: TAB_BAR_HEIGHT, width: 0, height: 0 };
    const [width, height] = shellWin.getContentSize();
    return { x: 0, y: TAB_BAR_HEIGHT, width: Math.max(0, width), height: Math.max(0, height - TAB_BAR_HEIGHT) };
  }

  /** @param {TabSurface} surface */
  function layoutSurface(surface) {
    if (!surface || surface.isDestroyed()) return;
    const area = getAreaBounds();
    surface.view.setBounds(area);
    if (surface.layoutHook) surface.layoutHook(area);
  }

  function layoutAll() {
    for (const surface of surfaces.values()) layoutSurface(surface);
  }

  function getVisibleTabs() {
    const tabs = [];
    for (const id of order) {
      const surface = surfaces.get(id);
      if (!surface || surface.isDestroyed()) continue;
      if (id === READER_TAB_ID && readerSessions.sessions.length) {
        for (const session of readerSessions.sessions) {
          tabs.push({
            id: `${READER_SESSION_TAB_PREFIX}${session.id}`,
            title: session.title || "Reader",
            kind: "reader",
            closable: true,
            badge: "",
            active: activeId === READER_TAB_ID && session.id === readerSessions.activeSessionId,
          });
        }
        continue;
      }
      tabs.push({
        id,
        title: surface.title,
        kind: surface.kind,
        closable: surface.closable,
        badge: surface.badge,
        active: activeId === id,
      });
    }
    return tabs;
  }

  function getState() {
    return { tabs: getVisibleTabs(), tabBarHeight: TAB_BAR_HEIGHT };
  }

  function publishState() {
    if (!shellWin || shellWin.isDestroyed()) return;
    const state = getState();
    shellWin.webContents.send("shell:state", state);
    const active = state.tabs.find((tab) => tab.active);
    shellWin.setTitle(active ? `${active.title} — nView` : "nView");
  }

  function applyVisibility() {
    for (const surface of surfaces.values()) {
      if (surface.isDestroyed()) continue;
      const visible = surface.id === activeId;
      surface.view.setVisible(visible);
      for (const child of surface.childViews) child.setVisible(visible);
    }
  }

  /** @param {string} tabId */
  function activateTab(tabId) {
    const id = String(tabId || "");
    if (id.startsWith(READER_SESSION_TAB_PREFIX)) {
      const sessionId = id.slice(READER_SESSION_TAB_PREFIX.length);
      activateTab(READER_TAB_ID);
      if (sessionId && sessionId !== readerSessions.activeSessionId) {
        sendReaderCommand({ action: "activate", sessionId });
      }
      return true;
    }
    const surface = surfaces.get(id);
    if (!surface || surface.isDestroyed()) return false;
    if (activeId !== id) {
      previousActiveId = activeId;
      activeId = id;
    }
    applyVisibility();
    layoutSurface(surface);
    if (shellWin && !shellWin.isDestroyed()) {
      if (shellWin.isMinimized()) shellWin.restore();
      shellWin.show();
    }
    surface.view.webContents.focus();
    publishState();
    return true;
  }

  /**
   * @param {string} tabId
   * @param {{ force?: boolean }} [options]
   */
  function closeSurface(tabId, { force = false } = {}) {
    const id = String(tabId || "");
    if (id.startsWith(READER_SESSION_TAB_PREFIX)) {
      sendReaderCommand({ action: "close", sessionId: id.slice(READER_SESSION_TAB_PREFIX.length) });
      return true;
    }
    const surface = surfaces.get(id);
    if (!surface) return false;
    if (!surface.closable && !force) return false;
    disposeSurface(surface);
    return true;
  }

  /** @param {TabSurface} surface */
  function disposeSurface(surface) {
    if (surface.destroyed) return;
    surface.destroyed = true;
    surfaces.delete(surface.id);
    const index = order.indexOf(surface.id);
    if (index >= 0) order.splice(index, 1);
    if (surface.id === READER_TAB_ID) readerSessions = { sessions: [], activeSessionId: "" };
    const views = [surface.view, ...surface.childViews].filter(Boolean);
    for (const view of views) {
      if (shellWin && !shellWin.isDestroyed()) {
        try {
          shellWin.contentView.removeChildView(view);
        } catch {
          // The view may already be detached when its webContents was destroyed first.
        }
      }
      if (!view.webContents.isDestroyed()) view.webContents.close();
    }
    surface.emit("closed");
    if (activeId === surface.id) {
      const fallback = surfaces.has(previousActiveId) ? previousActiveId : HOME_TAB_ID;
      activeId = "";
      if (!activateTab(fallback)) {
        const first = order.find((candidate) => surfaces.has(candidate));
        if (first) activateTab(first);
      }
    }
    publishState();
  }

  /** @param {string} tabId */
  function toSurfaceId(tabId) {
    const raw = String(tabId || "");
    return raw.startsWith(READER_SESSION_TAB_PREFIX) ? READER_TAB_ID : raw;
  }

  /**
   * Moves a tab to the position of another tab (reader comics move together as one block).
   * @param {string} tabId
   * @param {string} targetTabId
   */
  function moveTab(tabId, targetTabId) {
    const id = toSurfaceId(tabId);
    const targetId = toSurfaceId(targetTabId);
    const from = order.indexOf(id);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0 || id === targetId || id === HOME_TAB_ID) return false;
    order.splice(from, 1);
    order.splice(Math.max(1, to), 0, id);
    publishState();
    return true;
  }

  /** @param {number} delta */
  function cycleTab(delta) {
    const tabs = getVisibleTabs();
    if (tabs.length < 2) return;
    const current = Math.max(0, tabs.findIndex((tab) => tab.active));
    const next = tabs[(current + delta + tabs.length) % tabs.length];
    activateTab(next.id);
  }

  /** @param {{ x: number, y: number }} position */
  function showTabMenu({ x, y }) {
    if (!Menu || !shellWin || shellWin.isDestroyed()) return false;
    const template = getVisibleTabs().map((tab) => ({
      label: tab.title,
      type: /** @type {const} */ ("radio"),
      checked: tab.active,
      click: () => activateTab(tab.id),
    }));
    if (!template.length) return false;
    const popupOptions = { window: shellWin };
    if (Number.isFinite(x) && Number.isFinite(y)) Object.assign(popupOptions, { x, y });
    Menu.buildFromTemplate(template).popup(popupOptions);
    return true;
  }

  /** Global tab shortcuts, handled in main so they work whichever view has focus. */
  function handleShortcut(input) {
    if (input?.type !== "keyDown") return false;
    const mod = process.platform === "darwin" ? input.meta : input.control;
    if (!mod || input.alt) return false;
    const key = String(input.key || "");
    if (key === "Tab") {
      cycleTab(input.shift ? -1 : 1);
      return true;
    }
    if (input.shift) return false;
    if (key.toLowerCase() === "w") {
      const active = getVisibleTabs().find((tab) => tab.active);
      if (active?.closable) closeSurface(active.id);
      return true;
    }
    if (/^[1-9]$/.test(key)) {
      const tabs = getVisibleTabs();
      const target = key === "9" ? tabs[tabs.length - 1] : tabs[Number(key) - 1];
      if (target) activateTab(target.id);
      return true;
    }
    return false;
  }

  function bindShortcuts(contents) {
    contents.on("before-input-event", (event, input) => {
      if (handleShortcut(input)) event.preventDefault();
    });
  }

  /**
   * `onClosing` runs when the window is gone but before its views unload (every close path, unlike "close").
   *
   * @param {{ backgroundColor?: string, onClose?: (event: any) => void, onClosing?: () => void, onClosed?: () => void }} [options]
   */
  function ensureShellWindow({ onClose, onClosing, onClosed } = {}) {
    if (shellWin && !shellWin.isDestroyed()) return shellWin;
    shellWin = new BrowserWindow({
      width: 1280,
      height: 900,
      minWidth: 720,
      minHeight: 480,
      title: "nView",
      icon: APP_ICON_PATH,
      autoHideMenuBar: true,
      backgroundColor: getBootstrapBackgroundColor(),
      webPreferences: {
        preload: preloadScriptPath("shell_preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    shellWin.loadFile(path.join(appRootDir, "windows", "shell.html"), { query: { bootstrapTheme: getBootstrapTheme() } });
    assignWebContentsRole(shellWin.webContents, "shell");
    attachUiNavigationGuards(shellWin, "shell");
    bindShortcuts(shellWin.webContents);
    shellWin.webContents.on("did-finish-load", publishState);
    shellWin.on("resize", layoutAll);
    shellWin.on("maximize", layoutAll);
    shellWin.on("unmaximize", layoutAll);
    if (typeof onClose === "function") shellWin.on("close", onClose);
    shellWin.on("closed", () => {
      if (typeof onClosing === "function") onClosing();
      for (const surface of Array.from(surfaces.values())) {
        surface.destroyed = true;
        // Views do not own their webContents lifetime, so close them explicitly with the window.
        for (const view of [surface.view, ...surface.childViews].filter(Boolean)) {
          if (!view.webContents.isDestroyed()) view.webContents.close();
        }
        surface.emit("closed");
      }
      surfaces.clear();
      order.length = 0;
      activeId = "";
      shellWin = null;
      if (typeof onClosed === "function") onClosed();
    });
    return shellWin;
  }

  /**
   * Returns the existing surface for `id` or creates it. New surfaces become the active tab unless
   * `activate` is false.
   *
   * @param {{ id: string, title: string, kind?: string, closable?: boolean, role: string, preload: string,
   *   htmlFile: string, partition?: string, activate?: boolean, guardLabel?: string }} options
   */
  function ensureSurface({ id, title, kind = id, closable = true, role, preload, htmlFile, partition, activate = true, guardLabel = role }) {
    const existing = surfaces.get(id);
    if (existing && !existing.isDestroyed()) {
      if (activate) activateTab(id);
      return existing;
    }
    ensureShellWindow();
    const surface = new TabSurface({ id, title, closable, kind });
    const view = new WebContentsView({
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition,
      },
    });
    surface.view = view;
    view.setBackgroundColor(getBootstrapBackgroundColor());
    view.setVisible(false);
    shellWin.contentView.addChildView(view);
    assignWebContentsRole(view.webContents, role);
    attachUiNavigationGuards(surface, guardLabel);
    bindShortcuts(view.webContents);
    view.webContents.once("destroyed", () => disposeSurface(surface));
    view.webContents.loadFile(path.join(appRootDir, "windows", htmlFile), { query: { bootstrapTheme: getBootstrapTheme() } });
    surfaces.set(id, surface);
    if (id === HOME_TAB_ID) order.unshift(id);
    else order.push(id);
    layoutSurface(surface);
    if (activate || !activeId) activateTab(id);
    else publishState();
    return surface;
  }

  /**
   * @param {{ sessions?: { id?: string, title?: string }[], activeSessionId?: string }} payload
   */
  function setReaderSessions(payload) {
    const sessions = (Array.isArray(payload?.sessions) ? payload.sessions : [])
      .map((session) => ({
        id: String(session?.id || "").trim(),
        title: String(session?.title || "").replace(/\s+/g, " ").trim().slice(0, 200),
      }))
      .filter((session) => session.id)
      .slice(0, 200);
    const activeSessionId = String(payload?.activeSessionId || "").trim();
    readerSessions = {
      sessions,
      activeSessionId: sessions.some((session) => session.id === activeSessionId) ? activeSessionId : "",
    };
    publishState();
    return { ok: true, count: sessions.length };
  }

  /** @param {(command: { action: string, sessionId: string }) => void} sender */
  function setReaderCommandSender(sender) {
    sendReaderCommand = typeof sender === "function" ? sender : () => {};
  }

  return {
    TAB_BAR_HEIGHT,
    activateTab,
    bindShortcuts,
    closeTab: (tabId) => closeSurface(tabId),
    ensureShellWindow,
    ensureSurface,
    getActiveTabId: () => activeId,
    getShellWindow: () => shellWin,
    getState,
    getSurface: (id) => surfaces.get(id) || null,
    handleShortcut,
    moveTab,
    setReaderCommandSender,
    setReaderSessions,
    showTabMenu,
  };
}

module.exports = {
  READER_SESSION_TAB_PREFIX,
  TAB_BAR_HEIGHT,
  createTabShell,
};
