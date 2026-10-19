// @ts-check

function registerShellIpcHandlers(context) {
  const { ipcMain, tabShell } = context;

  ipcMain.handle("shell:getState", async () => ({ ok: true, state: tabShell.getState() }));

  ipcMain.handle("shell:activateTab", async (_event, tabId) => ({ ok: tabShell.activateTab(String(tabId || "")) }));

  ipcMain.handle("shell:closeTab", async (_event, tabId) => ({ ok: tabShell.closeTab(String(tabId || "")) }));

  ipcMain.handle("shell:moveTab", async (_event, payload) => ({
    ok: tabShell.moveTab(String(payload?.tabId || ""), String(payload?.targetTabId || "")),
  }));

  ipcMain.handle("shell:showTabMenu", async (_event, position) => ({
    ok: tabShell.showTabMenu({ x: Number(position?.x), y: Number(position?.y) }),
  }));

  // The reader reports its open comics so each one can be shown as its own tab.
  ipcMain.handle("shell:readerSessions", async (_event, payload) => tabShell.setReaderSessions(payload));

  ipcMain.handle("shell:closeReader", async () => ({ ok: tabShell.closeTab("reader") }));
}

module.exports = {
  registerShellIpcHandlers,
};
