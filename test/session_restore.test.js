const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createSessionRestore } = require('../main/session_restore');

const ROOT = path.resolve('/library');

function makeHarness({ session, unlocked = true, existing = null, activeTabId = 'reader:session:x' } = {}) {
  const state = {
    settings: { session: session || { restoreTabs: true, openComics: [], activeComicId: '', activeTab: 'gallery' } },
    writes: 0,
    timers: [],
    unlocked,
  };
  const settingsManager = {
    getSettings: () => state.settings,
    updateSettings: (partial) => {
      state.writes += 1;
      state.settings = { ...state.settings, ...partial };
      return state.settings;
    },
  };
  const sessionRestore = createSessionRestore({
    settingsManager,
    path,
    fs: { existsSync: (p) => (existing ? existing.includes(p) : true) },
    getLibraryRoot: () => ROOT,
    isUnderLibraryRoot: (p) => path.resolve(p).startsWith(`${ROOT}${path.sep}`),
    isVaultUnlocked: () => state.unlocked,
    getActiveTabId: () => activeTabId,
    setTimer: (fn) => {
      state.timers.push(fn);
      return state.timers.length;
    },
    clearTimer: () => {},
  });
  const runTimers = () => {
    const timers = state.timers.splice(0);
    for (const fn of timers) fn();
  };
  return { state, sessionRestore, runTimers };
}

const dir = (id) => path.join(ROOT, id);

test('record stores comic ids with pages after the debounce and skips unchanged payloads', () => {
  const { state, sessionRestore, runTimers } = makeHarness();
  sessionRestore.takeRestorePlan();
  sessionRestore.record({
    comics: [
      { comicDir: dir('comic_a'), pageIndex: 4 },
      { comicDir: dir('comic_b'), pageIndex: -2 },
      { comicDir: '/elsewhere/comic_c', pageIndex: 1 },
      { comicDir: dir('not-a-comic'), pageIndex: 1 },
    ],
    activeComicDir: dir('comic_a'),
  });
  assert.equal(state.writes, 0);
  runTimers();
  assert.equal(state.writes, 1);
  assert.deepEqual(state.settings.session.openComics, [{ id: 'comic_a', page: 4 }, { id: 'comic_b', page: 0 }]);
  assert.equal(state.settings.session.activeComicId, 'comic_a');

  sessionRestore.record({ comics: [{ comicDir: dir('comic_a'), pageIndex: 4 }, { comicDir: dir('comic_b') }], activeComicDir: dir('comic_a') });
  runTimers();
  assert.equal(state.writes, 1);
});

test('record accepts the legacy list of directories', () => {
  const { state, sessionRestore, runTimers } = makeHarness();
  sessionRestore.takeRestorePlan();
  sessionRestore.record([dir('comic_a')]);
  runTimers();
  assert.deepEqual(state.settings.session.openComics, [{ id: 'comic_a', page: 0 }]);
});

test('an empty reader before the restore does not wipe the saved tabs', () => {
  const saved = { restoreTabs: true, openComics: [{ id: 'comic_a', page: 3 }], activeComicId: 'comic_a', activeTab: 'reader' };
  const { state, sessionRestore, runTimers } = makeHarness({ session: saved });
  sessionRestore.record([]);
  runTimers();
  assert.equal(state.writes, 0);
  assert.deepEqual(state.settings.session.openComics, saved.openComics);
});

test('freeze saves pending state with the active tab and ignores the teardown sync', () => {
  const { state, sessionRestore, runTimers } = makeHarness({ activeTabId: 'gallery' });
  sessionRestore.takeRestorePlan();
  sessionRestore.record({ comics: [{ comicDir: dir('comic_a'), pageIndex: 2 }], activeComicDir: dir('comic_a') });
  sessionRestore.freeze();
  assert.equal(state.writes, 1);
  assert.equal(state.settings.session.activeTab, 'gallery');

  sessionRestore.record([]);
  runTimers();
  assert.equal(state.writes, 1);
  assert.deepEqual(state.settings.session.openComics, [{ id: 'comic_a', page: 2 }]);
});

test('nothing is written when the option is off or the vault is locked', () => {
  const off = makeHarness({ session: { restoreTabs: false, openComics: [], activeComicId: '', activeTab: 'gallery' } });
  off.sessionRestore.takeRestorePlan();
  off.sessionRestore.record([dir('comic_a')]);
  off.runTimers();
  off.sessionRestore.freeze();
  assert.equal(off.state.writes, 0);

  const locked = makeHarness({ unlocked: false });
  locked.sessionRestore.record([dir('comic_a')]);
  locked.runTimers();
  locked.sessionRestore.freeze();
  assert.equal(locked.state.writes, 0);
});

test('restoreOnce resolves saved ids against the library root and runs once', () => {
  const saved = {
    restoreTabs: true,
    openComics: [{ id: 'comic_a', page: 5 }, { id: 'comic_gone', page: 1 }, { id: '../escape', page: 1 }, { id: 'comic_b', page: 0 }],
    activeComicId: 'comic_a',
    activeTab: 'reader',
  };
  const { sessionRestore } = makeHarness({ session: saved, existing: [dir('comic_a'), dir('comic_b')] });
  const plans = [];
  sessionRestore.setRestorer((plan) => plans.push(plan));

  assert.equal(sessionRestore.restoreOnce(), true);
  assert.equal(sessionRestore.restoreOnce(), false);
  assert.deepEqual(plans, [{
    comicDirs: [dir('comic_a'), dir('comic_b')],
    pageIndexByDir: { [dir('comic_a')]: 5 },
    focusComicDir: dir('comic_a'),
    activeTab: 'reader',
  }]);
});

test('restoreOnce does nothing when the option is off', () => {
  const saved = { restoreTabs: false, openComics: [{ id: 'comic_a', page: 5 }], activeComicId: '', activeTab: 'gallery' };
  const { sessionRestore } = makeHarness({ session: saved });
  let called = false;
  sessionRestore.setRestorer(() => {
    called = true;
  });
  assert.equal(sessionRestore.restoreOnce(), false);
  assert.equal(called, false);
});
