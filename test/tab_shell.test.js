const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { EventEmitter } = require("node:events");

const { createTabShell } = require("../main/tab_shell");

function createFakes() {
  let nextId = 1;
  const roles = new Map();
  const sentToShell = [];
  const popups = [];

  class FakeWebContents extends EventEmitter {
    constructor() {
      super();
      this.id = nextId++;
      this.destroyed = false;
      this.focused = 0;
      this.sent = [];
    }
    isDestroyed() {
      return this.destroyed;
    }
    close() {
      this.destroyed = true;
      this.emit("destroyed");
    }
    focus() {
      this.focused += 1;
    }
    send(channel, payload) {
      this.sent.push({ channel, payload });
    }
    loadFile(filePath) {
      this.loadedFile = filePath;
    }
    setWindowOpenHandler() {}
  }

  class FakeWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.webContents = new FakeWebContents();
      this.webContents.send = (channel, payload) => sentToShell.push({ channel, payload });
      this.children = [];
      this.contentView = {
        addChildView: (view) => this.children.push(view),
        removeChildView: (view) => {
          this.children = this.children.filter((child) => child !== view);
        },
      };
      this.title = "";
    }
    loadFile() {}
    isDestroyed() {
      return false;
    }
    isMinimized() {
      return false;
    }
    restore() {}
    show() {}
    setTitle(title) {
      this.title = title;
    }
    getContentSize() {
      return [1000, 700];
    }
  }

  class FakeView {
    constructor(options) {
      this.options = options;
      this.webContents = new FakeWebContents();
      this.visible = true;
      this.bounds = null;
    }
    setBackgroundColor() {}
    setVisible(visible) {
      this.visible = visible;
    }
    setBounds(bounds) {
      this.bounds = bounds;
    }
  }

  const shell = createTabShell({
    BrowserWindow: FakeWindow,
    WebContentsView: FakeView,
    Menu: {
      buildFromTemplate: (template) => ({ popup: (options) => popups.push({ template, options }) }),
    },
    path,
    appRootDir: "/app",
    APP_ICON_PATH: "/icon.png",
    preloadScriptPath: (name) => `/preload/${name}`,
    getBootstrapTheme: () => "light",
    getBootstrapBackgroundColor: () => "#ffffff",
    assignWebContentsRole: (contents, role) => roles.set(contents.id, role),
    attachUiNavigationGuards: () => {},
  });
  return { shell, roles, sentToShell, popups };
}

function open(shell, id, extra = {}) {
  return shell.ensureSurface({
    id,
    title: id,
    role: id,
    preload: `/preload/${id}.js`,
    htmlFile: `${id}.html`,
    ...extra,
  });
}

const tabIds = (shell) => shell.getState().tabs.map((tab) => tab.id);
const activeTab = (shell) => shell.getState().tabs.find((tab) => tab.active)?.id;

test("surfaces become tabs with the gallery pinned first and only the active one visible", () => {
  const { shell, roles } = createFakes();
  const downloader = open(shell, "downloader");
  const gallery = open(shell, "gallery", { closable: false, activate: false });

  assert.deepEqual(tabIds(shell), ["gallery", "downloader"]);
  assert.equal(activeTab(shell), "downloader");
  assert.equal(downloader.view.visible, true);
  assert.equal(gallery.view.visible, false);
  assert.deepEqual(downloader.view.bounds, { x: 0, y: 40, width: 1000, height: 660 });
  assert.equal(roles.get(downloader.webContents.id), "downloader");
  assert.equal(downloader.view.options.webPreferences.sandbox, true);
  assert.equal(downloader.view.options.webPreferences.contextIsolation, true);

  assert.equal(open(shell, "downloader"), downloader, "re-opening returns the live surface");
  gallery.focus();
  assert.equal(activeTab(shell), "gallery");
  assert.equal(gallery.view.visible, true);
  assert.equal(downloader.view.visible, false);
});

test("closing a tab falls back to the previous tab and emits closed; the home tab cannot be closed", () => {
  const { shell } = createFakes();
  open(shell, "gallery", { closable: false });
  const browser = open(shell, "browser");
  const reader = open(shell, "reader");
  let closed = 0;
  reader.once("closed", () => {
    closed += 1;
  });

  assert.equal(shell.closeTab("gallery"), false);
  assert.equal(shell.closeTab("reader"), true);
  assert.equal(closed, 1);
  assert.equal(reader.isDestroyed(), true);
  assert.equal(activeTab(shell), "browser");
  assert.deepEqual(tabIds(shell), ["gallery", "browser"]);

  browser.webContents.close();
  assert.deepEqual(tabIds(shell), ["gallery"], "a destroyed page removes its tab");
});

test("reader sessions are listed as individual tabs and forward commands to the reader", () => {
  const { shell } = createFakes();
  const commands = [];
  shell.setReaderCommandSender((command) => commands.push(command));
  open(shell, "gallery", { closable: false });
  open(shell, "reader");
  shell.setReaderSessions({
    sessions: [{ id: "session:a", title: "Book A" }, { id: "session:b", title: "  Book\nB " }, { title: "no id" }],
    activeSessionId: "session:b",
  });

  const tabs = shell.getState().tabs;
  assert.deepEqual(tabs.map((tab) => tab.id), ["gallery", "reader:session:a", "reader:session:b"]);
  assert.equal(tabs[2].title, "Book B");
  assert.equal(activeTab(shell), "reader:session:b");

  shell.activateTab("reader:session:a");
  shell.closeTab("reader:session:b");
  assert.deepEqual(commands, [
    { action: "activate", sessionId: "session:a" },
    { action: "close", sessionId: "session:b" },
  ]);
});

test("moveTab reorders surfaces but keeps the home tab first", () => {
  const { shell } = createFakes();
  open(shell, "gallery", { closable: false });
  open(shell, "browser");
  open(shell, "downloader");
  open(shell, "importer");

  assert.equal(shell.moveTab("importer", "browser"), true);
  assert.deepEqual(tabIds(shell), ["gallery", "importer", "browser", "downloader"]);
  assert.equal(shell.moveTab("downloader", "gallery"), true);
  assert.deepEqual(tabIds(shell), ["gallery", "downloader", "importer", "browser"]);
  assert.equal(shell.moveTab("gallery", "browser"), false);
});

test("keyboard shortcuts cycle, jump to and close tabs", () => {
  const { shell } = createFakes();
  open(shell, "gallery", { closable: false });
  open(shell, "browser");
  open(shell, "downloader");
  const key = (input) => shell.handleShortcut({ type: "keyDown", control: true, meta: true, alt: false, shift: false, ...input });

  assert.equal(key({ key: "1" }), true);
  assert.equal(activeTab(shell), "gallery");
  key({ key: "Tab" });
  assert.equal(activeTab(shell), "browser");
  key({ key: "Tab", shift: true });
  key({ key: "Tab", shift: true });
  assert.equal(activeTab(shell), "downloader");
  key({ key: "9" });
  assert.equal(activeTab(shell), "downloader");
  key({ key: "w" });
  assert.deepEqual(tabIds(shell), ["gallery", "browser"]);
  assert.equal(shell.handleShortcut({ type: "keyDown", control: false, meta: false, key: "w" }), false);
});

test("child views follow their tab visibility and layout hook", () => {
  const { shell } = createFakes();
  open(shell, "gallery", { closable: false });
  const browser = open(shell, "browser");
  const page = { webContents: { isDestroyed: () => false, close() {} }, visible: true, setVisible(v) { this.visible = v; }, setBounds(b) { this.bounds = b; } };
  browser.addChildView(page);
  browser.setLayoutHook((area) => page.setBounds({ ...area, y: area.y + 60, height: area.height - 60 }));

  assert.equal(page.visible, true);
  assert.deepEqual(page.bounds, { x: 0, y: 100, width: 1000, height: 600 });
  shell.activateTab("gallery");
  assert.equal(page.visible, false);
});

test("downloads badge and native tab menu reflect state", () => {
  const { shell, popups } = createFakes();
  open(shell, "gallery", { closable: false });
  const downloader = open(shell, "downloader");
  downloader.setBadge("3");
  assert.equal(shell.getState().tabs.find((tab) => tab.id === "downloader").badge, "3");

  assert.equal(shell.showTabMenu({ x: 10, y: 40 }), true);
  assert.deepEqual(popups[0].template.map((item) => [item.label, item.checked]), [["gallery", false], ["downloader", true]]);
});

test("shell IPC channels are restricted to the shell page, reader sync to the reader", () => {
  const source = require("node:fs").readFileSync(path.resolve(__dirname, "../main/ipc/register_main_ipc.js"), "utf8");
  for (const channel of ["shell:getState", "shell:activateTab", "shell:closeTab", "shell:moveTab", "shell:showTabMenu"]) {
    assert.match(source, new RegExp(`"${channel}": \\["shell"\\],`), channel);
  }
  assert.match(source, /"shell:readerSessions": \["reader"\],/);
  assert.match(source, /"shell:closeReader": \["reader"\],/);
});
