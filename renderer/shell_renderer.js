(function initShellRenderer() {
  const tabListEl = document.getElementById("tabList");
  const overflowBtn = document.getElementById("tabOverflow");
  const KIND_ICONS = Object.freeze({
    gallery: "▦",
    reader: "📖",
    browser: "🌐",
    downloader: "⬇",
    importer: "⤓",
    exporter: "⤒",
    "group-manager": "▤",
    "tag-manager": "#",
  });

  let tabs = [];
  let draggedTabId = "";

  function tabElementId(tabId) {
    return `tab-${String(tabId).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  }

  function activate(tabId) {
    void window.shellApi.activateTab(tabId);
  }

  function close(tabId) {
    void window.shellApi.closeTab(tabId);
  }

  function buildTab(tab) {
    const tabEl = document.createElement("div");
    tabEl.className = "tab";
    tabEl.id = tabElementId(tab.id);
    tabEl.setAttribute("role", "tab");
    tabEl.setAttribute("aria-selected", tab.active ? "true" : "false");
    tabEl.tabIndex = tab.active ? 0 : -1;
    tabEl.dataset.tabId = tab.id;
    tabEl.dataset.kind = tab.kind;
    tabEl.title = tab.title;
    tabEl.draggable = tab.id !== "gallery";

    const iconEl = document.createElement("span");
    iconEl.className = "tab-icon";
    iconEl.setAttribute("aria-hidden", "true");
    iconEl.textContent = KIND_ICONS[tab.kind] || "•";

    const labelEl = document.createElement("span");
    labelEl.className = "tab-label";
    labelEl.textContent = tab.title;

    tabEl.append(iconEl, labelEl);

    if (tab.badge) {
      const badgeEl = document.createElement("span");
      badgeEl.className = "tab-badge";
      badgeEl.textContent = tab.badge;
      badgeEl.setAttribute("aria-label", `${tab.badge} active`);
      tabEl.append(badgeEl);
    }

    if (tab.closable) {
      const closeEl = document.createElement("button");
      closeEl.type = "button";
      closeEl.className = "tab-close";
      closeEl.tabIndex = -1;
      closeEl.setAttribute("aria-label", `Close ${tab.title}`);
      closeEl.textContent = "✕";
      closeEl.addEventListener("click", (event) => {
        event.stopPropagation();
        close(tab.id);
      });
      tabEl.append(closeEl);
    }
    return tabEl;
  }

  function render(state) {
    tabs = Array.isArray(state?.tabs) ? state.tabs : [];
    const hadFocus = tabListEl.contains(document.activeElement);
    tabListEl.replaceChildren(...tabs.map(buildTab));
    const activeEl = tabListEl.querySelector('[aria-selected="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (hadFocus) activeEl.focus();
    }
    updateOverflow();
  }

  function updateOverflow() {
    overflowBtn.hidden = tabListEl.scrollWidth <= tabListEl.clientWidth + 1;
  }

  function focusTabAt(index) {
    const tabEls = Array.from(tabListEl.querySelectorAll('[role="tab"]'));
    if (!tabEls.length) return;
    const target = tabEls[(index + tabEls.length) % tabEls.length];
    target.focus();
    activate(target.dataset.tabId);
  }

  tabListEl.addEventListener("click", (event) => {
    const tabEl = event.target.closest('[role="tab"]');
    if (tabEl) activate(tabEl.dataset.tabId);
  });

  tabListEl.addEventListener("auxclick", (event) => {
    if (event.button !== 1) return;
    const tabEl = event.target.closest('[role="tab"]');
    const tab = tabs.find((entry) => entry.id === tabEl?.dataset.tabId);
    if (tab?.closable) {
      event.preventDefault();
      close(tab.id);
    }
  });

  // WAI-ARIA tabs pattern: arrows move between tabs, Home/End jump, Delete closes.
  tabListEl.addEventListener("keydown", (event) => {
    const tabEls = Array.from(tabListEl.querySelectorAll('[role="tab"]'));
    const index = tabEls.indexOf(document.activeElement);
    if (index < 0) return;
    if (event.key === "ArrowRight") focusTabAt(index + 1);
    else if (event.key === "ArrowLeft") focusTabAt(index - 1);
    else if (event.key === "Home") focusTabAt(0);
    else if (event.key === "End") focusTabAt(tabEls.length - 1);
    else if (event.key === "Delete") {
      const tab = tabs[index];
      if (tab?.closable) close(tab.id);
    } else return;
    event.preventDefault();
  });

  tabListEl.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    tabListEl.scrollLeft += event.deltaY;
    event.preventDefault();
  }, { passive: false });

  tabListEl.addEventListener("dragstart", (event) => {
    const tabEl = event.target.closest('[role="tab"]');
    if (!tabEl) return;
    draggedTabId = tabEl.dataset.tabId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedTabId);
    tabEl.classList.add("is-dragging");
  });

  tabListEl.addEventListener("dragover", (event) => {
    if (!draggedTabId) return;
    const tabEl = event.target.closest('[role="tab"]');
    if (!tabEl || tabEl.dataset.tabId === "gallery") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  tabListEl.addEventListener("drop", (event) => {
    const tabEl = event.target.closest('[role="tab"]');
    if (!tabEl || !draggedTabId) return;
    event.preventDefault();
    if (tabEl.dataset.tabId !== draggedTabId) void window.shellApi.moveTab(draggedTabId, tabEl.dataset.tabId);
  });

  tabListEl.addEventListener("dragend", () => {
    draggedTabId = "";
    for (const el of tabListEl.querySelectorAll(".is-dragging")) el.classList.remove("is-dragging");
  });

  // The page views cover everything below the tab strip, so the full tab list opens as a native menu.
  overflowBtn.addEventListener("click", () => {
    const rect = overflowBtn.getBoundingClientRect();
    void window.shellApi.showTabMenu({ x: Math.round(rect.left), y: Math.round(rect.bottom) });
  });
  window.addEventListener("resize", updateOverflow);

  window.shellApi.onState(render);
  void window.shellApi.getState().then((res) => {
    if (res?.ok) render(res.state);
  });
})();
