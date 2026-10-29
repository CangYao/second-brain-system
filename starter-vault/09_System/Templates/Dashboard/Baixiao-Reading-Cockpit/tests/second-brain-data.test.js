"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sourceDir = path.resolve(__dirname, "..");
const { install } = require(path.join(sourceDir, "second-brain-data.js"));
// Exercise the adapter source independently even when the packaged main already embeds it.
const upstream = fs.readFileSync(path.join(sourceDir, "main.js"), "utf8")
  .split("\n// BEGIN SECOND BRAIN ADAPTERS")[0];

function harness(saved = {}) {
  const notices = [], metadataReads = [], events = new Map(), entries = new Map(), protocols = new Map();
  let processCalls = 0, writes = 0, directWrites = 0, renders = 0, defers = 0;
  let beforeCallback = null, currentData = saved;
  class TFile {
    constructor(filePath) {
      this.path = filePath; this.name = filePath.split("/").at(-1);
      this.extension = this.name.split(".").at(-1); this.basename = this.name.slice(0, -3);
      this.parent = { name: filePath.split("/").at(-2), path: filePath.split("/").slice(0, -1).join("/") };
      this.stat = { ctime: Date.now(), mtime: Date.now() };
    }
  }
  class Notice { constructor(message) { notices.push(message); } }
  const recordEvent = (prefix) => (name, handler) => { events.set(prefix + name, handler); return handler; };
  const failDirect = async () => { directWrites++; throw new Error("Direct source write forbidden"); };
  const rootSplit = {}, sideSplit = {};
  const center = { getRoot: () => rootSplit, setViewState: async (state) => { center.state = state; } };
  const side = { getRoot: () => sideSplit, setViewState: async () => { throw new Error("Sidebar used"); } };
  const workspace = {
    rootSplit, leaves: [], newTabs: [], revealed: [],
    getLeavesOfType() { return this.leaves; },
    getLeaf(mode) { this.newTabs.push(mode); return center; },
    revealLeaf: async (leaf) => { workspace.revealed.push(leaf); },
    on: recordEvent("workspace:")
  };
  const app = {
    vault: {
      getMarkdownFiles: () => [...entries.values()].map((item) => item.file),
      getAbstractFileByPath: (p) => entries.get(p)?.file,
      on: recordEvent("vault:"),
      create: failDirect, createFolder: failDirect, modify: failDirect, delete: failDirect
    },
    metadataCache: {
      getFileCache: (file) => {
        metadataReads.push(file.path);
        return { frontmatter: entries.get(file.path)?.fm };
      },
      on: recordEvent("metadata:")
    },
    fileManager: {
      processFrontMatter: async (file, callback) => {
        processCalls++;
        beforeCallback?.(entries.get(file.path));
        const entry = entries.get(file.path), latest = structuredClone(entry.fm);
        callback(latest);
        entry.fm = latest; writes++;
      }
    },
    plugins: { plugins: {} }, workspace
  };
  class ItemView {
    constructor() { this.app = app; this.contentEl = {}; }
    registerEvent() {}
    register() {}
  }
  class Plugin {
    constructor() { this.app = app; }
    async loadData() { return currentData; }
    async saveData() { throw new Error("Startup must not save config"); }
    registerView() {} addRibbonIcon() {} addCommand() {}
    registerObsidianProtocolHandler(name, handler) { protocols.set(name, handler); }
  }
  const context = {
    module: { exports: {} },
    require: (id) => { assert.equal(id, "obsidian"); return { Plugin, ItemView, Notice, TFile }; },
    console: { warn() {}, debug() {}, error() {}, log() {} },
    Date, Set, Map, Symbol,
    window: {
      clearTimeout() {}, cancelAnimationFrame() {},
      setTimeout: (callback) => { queueMicrotask(callback); return 1; },
      matchMedia: () => ({ matches: true }),
      requestAnimationFrame: () => 1
    }
  };
  vm.runInNewContext(upstream + "\nglobalThis.subject = {DashboardView, PluginClass: module.exports, dateKey, localDate};", context);
  const { DashboardView, PluginClass, dateKey, localDate } = context.subject;
  install({ DashboardView, PluginClass, TFile, Notice, dateKey, localDate });
  const plugin = new PluginClass();
  plugin.fluidSettings = { quality: "fallback", cards: {} };
  const view = new DashboardView({}, plugin);
  view.render = async () => { renders++; view.state.notes = view.notes(); };
  view.deferRender = () => { defers++; };
  const add = (filePath, fields = {}, body = "# Preserved body\n\nOriginal text.\n") => {
    const file = new TFile(filePath);
    entries.set(filePath, { file, fm: { id: "book_" + entries.size, type: "book", ...fields }, body });
    return file;
  };
  return {
    app, view, plugin, add, entries, notices, metadataReads, events, protocols, center, side, localDate,
    setBeforeCallback(fn) { beforeCallback = fn; },
    stats: () => ({ processCalls, writes, directWrites, renders, defers }),
    snapshot: () => JSON.stringify([...entries.values()].map(({ file, fm, body }) => [file.path, fm, body]))
  };
}

test("only canonical book folders and type; status/date projections never modify sources", () => {
  const h = harness();
  const states = ["planned", "reading", "paused", "completed", undefined, null, "", ["reading"]];
  states.forEach((status, index) => h.add("03_Books/Nonfiction/Book-" + index + ".md", {
    status, title: "Book " + index, created: index ? undefined : "2026-02-03",
    date: "2026-09-01", updated: "2026-10-30", "完成阅读": "2026-10-30",
    author: ["Author"], book_category: "Nonfiction", tags: ["book"], sources: ["https://example.org"], relations: ["[[Concept]]"]
  }));
  h.add("03_Books/Fiction/Nested/Story.md", { status: "custom", book_category: "Fiction" });
  h.add("03_Books/Nonfiction/模板.md");
  h.add("03_Books/Nonfiction/Fixture.md", { validation_fixture: true });
  h.add("03_Books/Nonfiction/Concept.md", { type: "concept" });
  h.add("03_Books/Nonfiction-old/Elsewhere.md");
  h.add("08_Projects/Book-looking.md");
  const before = h.snapshot(), notes = h.view.notes();
  assert.equal(notes.length, 9);
  assert.deepEqual(Array.from(notes.slice(0, 8), n => n.reading), ["计划阅读", "在读", "暂停", "已读", "未登记", "未登记", "未登记", "其他状态"]);
  assert.equal(notes[8].reading, "其他状态");
  assert.equal(notes[0].created, "2026-02-03");
  assert.equal(notes[1].created, "");
  assert.equal(notes[1].createdFromFrontmatter, false);
  assert.equal(notes[0].rootFolder, "03_Books/Nonfiction");
  assert.equal(notes[8].rootFolder, "03_Books/Fiction");
  assert.ok(notes.every(n => n.completed === "" && n.absorption === "未登记"));
  notes[0].tags.push("view-only");
  assert.equal(h.snapshot(), before);
  assert.equal(h.stats().processCalls, 0);
  assert.equal(h.stats().directWrites, 0);
  assert.ok(!h.metadataReads.includes("08_Projects/Book-looking.md"));
  assert.ok(!h.metadataReads.includes("03_Books/Nonfiction-old/Elsewhere.md"));
  assert.ok(!h.metadataReads.includes("03_Books/Nonfiction/模板.md"));
});

test("upstream onOpen/create event and actual refresh handler are read-only", async () => {
  const h = harness();
  h.add("03_Books/Fiction/Existing.md");
  await h.view.onOpen();
  const file = h.add("03_Books/Nonfiction/New.md");
  const before = h.snapshot();
  h.events.get("vault:create")(file);
  h.events.get("metadata:changed")(file);
  assert.equal(await h.view.initializeNewNotes(h.view.notes()), 0);
  assert.equal(await h.view.backfillMissingReadingProperties(), 0);
  const scanButton = { disabled: false, classList: { add() {} }, textContent: "" };
  const root = {
    isConnected: false,
    querySelectorAll: () => [],
    querySelector: (selector) => selector === ".ycs-refresh" ? scanButton : null
  };
  h.view.bindV14Fluid(root);
  assert.equal(typeof scanButton.onclick, "function");
  await scanButton.onclick();
  assert.match(scanButton.textContent, /扫描完成/);
  assert.equal(h.snapshot(), before);
  assert.equal(h.stats().processCalls, 0);
  assert.equal(h.stats().writes, 0);
  assert.equal(h.stats().directWrites, 0);
  assert.ok(h.stats().defers >= 2);
});

test("explicit status update changes only status and updated, preserving id/body and all other fields", async () => {
  const h = harness(), p = "03_Books/Fiction/Book.md";
  h.add(p, { id: "book_stable", title: "Book", created: "2026-01-01", tags: ["fiction"], sources: ["source"], custom: { preserved: true } });
  const before = structuredClone(h.entries.get(p));
  const note = h.view.notes()[0];
  assert.equal(await h.view.update(note, "阅读状态", "在读"), true);
  const after = h.entries.get(p);
  assert.equal(after.fm.status, "reading");
  assert.equal(after.fm.updated, h.localDate());
  const { status, updated, ...untouched } = after.fm;
  assert.deepEqual(untouched, before.fm);
  assert.equal(after.body, before.body);
  assert.equal(after.fm.id, "book_stable");
  assert.equal(h.stats().writes, 1);
  assert.equal(h.stats().directWrites, 0);
  assert.equal(await h.view.update(h.view.notes()[0], "status", "completed"), true);
  assert.equal(h.entries.get(p).fm.status, "completed");
  assert.equal(h.entries.get(p).fm["完成阅读"], undefined);
});

test("invalid target values and absorption writes are rejected before processFrontMatter", async () => {
  const h = harness(); h.add("03_Books/Fiction/Book.md");
  const note = h.view.notes()[0], before = h.snapshot();
  for (const value of [undefined, null, "", "未登记", "其他状态", "未读", "active", ["reading"], "__proto__"]) {
    assert.equal(await h.view.update(note, "status", value), false);
  }
  for (const field of ["absorption", "吸收状态", "id", "updated", "sources"]) {
    assert.equal(await h.view.update(note, field, "reading"), false);
  }
  assert.equal(h.snapshot(), before);
  assert.equal(h.stats().processCalls, 0);
});

test("deleted/replaced/moved/type-changed/fixture/id-changed entries cannot be written", async () => {
  const mutations = [
    (entry) => { entry.fm.id = "book_other"; },
    (entry) => { delete entry.fm.id; },
    (entry) => { entry.fm.type = "concept"; },
    (entry) => { entry.fm.validation_fixture = true; },
    (entry) => { entry.file.path = "08_Projects/Moved.md"; }
  ];
  for (const mutate of mutations) {
    const h = harness(), p = "03_Books/Fiction/Book.md"; h.add(p);
    const note = h.view.notes()[0]; mutate(h.entries.get(p));
    const before = h.snapshot();
    assert.equal(await h.view.update(note, "status", "planned"), false);
    assert.equal(h.snapshot(), before);
    assert.equal(h.stats().processCalls, 0);
  }
  const h = harness(), p = "03_Books/Fiction/Book.md"; h.add(p);
  const old = h.view.notes()[0]; h.entries.delete(p); h.add(p, { id: old.id });
  assert.equal(await h.view.update(old, "status", "paused"), false);
  assert.equal(h.stats().writes, 0);
});

test("fresh frontmatter identity guard rejects a cache-to-write race without committing", async () => {
  const h = harness(), p = "03_Books/Nonfiction/Book.md"; h.add(p);
  const note = h.view.notes()[0];
  h.setBeforeCallback(entry => { entry.fm.id = "book_replaced"; });
  assert.equal(await h.view.update(note, "status", "completed"), false);
  assert.equal(h.entries.get(p).fm.id, "book_replaced");
  assert.equal(h.entries.get(p).fm.status, undefined);
  assert.equal(h.entries.get(p).fm.updated, undefined);
  assert.equal(h.stats().writes, 0);
});

test("daily action invokes the existing QuickAdd Choice and never creates a fallback file/folder", async () => {
  const h = harness(), choices = [];
  assert.equal(await h.view.createDailyNote(), false);
  h.app.plugins.plugins.quickadd = { api: { executeChoice: async (choice) => { choices.push(choice); } } };
  assert.equal(await h.view.createDailyNote(), true);
  assert.deepEqual(choices, ["新增每日记录"]);
  h.app.plugins.plugins.quickadd.api.executeChoice = async () => { throw new Error("Configured Choice failed"); };
  assert.equal(await h.view.createDailyNote(), false);
  assert.equal(h.stats().directWrites, 0);
  assert.equal(h.stats().processCalls, 0);
  assert.ok(h.notices.some(message => message.includes("执行失败")));
});

test("startup defaults identity only when absent; protocol opens central tab without business writes", async () => {
  const h = harness();
  await h.plugin.onload();
  assert.equal(h.plugin.dashboardSettings.identity.brandName, "Second Brain");
  assert.equal(h.plugin.dashboardSettings.identity.displayName, "第二大脑");
  assert.equal(h.protocols.size, 1);
  h.app.workspace.leaves = [h.side];
  await h.plugin.activateView();
  assert.deepEqual(h.app.workspace.newTabs, ["tab"]);
  assert.equal(h.app.workspace.revealed[0], h.center);
  h.app.workspace.leaves = [h.side, h.center];
  await h.plugin.activateView();
  assert.equal(h.app.workspace.newTabs.length, 1);
  h.protocols.get("second-brain-cockpit")({});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.app.workspace.revealed.length, 3);
  assert.equal(h.stats().writes, 0);
  assert.equal(h.stats().directWrites, 0);
  const identity = { brandMark: "Custom", brandName: "Mine", avatarText: "U", displayName: "User", role: "Reader" };
  const custom = harness({ dashboard: { identity } });
  await custom.plugin.onload();
  assert.equal(JSON.stringify(custom.plugin.dashboardSettings.identity), JSON.stringify(identity));
});
