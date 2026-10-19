// @ts-check
const { contextBridge, ipcRenderer } = require("electron");
const { subscribeIpc } = require("./ipc_subscribe.js");

const SUBSCRIPTION_CHANNELS = new Set([
  "shell:state",
]);

const shellApi = {
  getState: () => ipcRenderer.invoke("shell:getState"),
  activateTab: (tabId) => ipcRenderer.invoke("shell:activateTab", tabId),
  closeTab: (tabId) => ipcRenderer.invoke("shell:closeTab", tabId),
  showTabMenu: (position) => ipcRenderer.invoke("shell:showTabMenu", position),
  moveTab: (tabId, targetTabId) => ipcRenderer.invoke("shell:moveTab", { tabId, targetTabId }),
  onState: (cb) =>
    subscribeIpc(ipcRenderer, "shell:state", cb, { allowedChannels: SUBSCRIPTION_CHANNELS }),
};

contextBridge.exposeInMainWorld("shellApi", Object.freeze(shellApi));
