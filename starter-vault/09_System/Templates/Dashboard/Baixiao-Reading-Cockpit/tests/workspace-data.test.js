"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { install, helpers: h } = require("../second-brain-workspace-data.js");
const S = h.SOURCE_PATHS, F = String.fromCharCode(96).repeat(3);
const A = "08_Projects/Alpha/Overview.md", B = "08_Projects/Beta.md";
const PB = { filters: { and: ['file.ext == "md"', { or: ['file.path == "' + A + '"', 'file.path == "' + B + '"'] }] } };
const HB = {
  filters: { and: ['file.ext == "md"', 'note.validation_fixture != true', '!file.basename.contains("模板")',
    { or: [{ and: ['file.inFolder("00_Inbox")', '!file.inFolder("00_Inbox/Personal Model")'] }, 'file.inFolder("01_Knowledge")', 'file.inFolder("06_Daily")'] }] },
  views: [["收件箱资料", "00_Inbox", "file.mtime"], ["知识节点", "01_Knowledge", "note.updated"], ["每日记录", "06_Daily", "file.mtime"]]
    .map(([name, folder, property]) => ({ name, filters: 'file.inFolder("' + folder + '")', limit: 5, sort: [{ property, direction: "DESC" }] }))
};
const HM = [
  "> [!dashboard-actions]",
  "> - **[Record](obsidian://quickadd?choice=Daily)**<br>Existing action",
  "> - **[[08_Projects/Alpha/Overview#Next|Continue]]**<br>Original entry",
  "> - **[Search](obsidian://search?query=(path%3A%2201_Knowledge%22%20OR%20path%3A%2203_Books%22))**<br>Find",
  "> - **[Source](https://example.org/reference)**",
  "> - **[Unsafe](javascript:alert(1))**", "",
  "> [!todo]- Existing tasks", "> " + F + "tasks", "> not done",
  "> path regex matches /^(06_Daily|08_Projects)\\//", "> limit 6", "> " + F
].join("\n");
const PM = [
  "---", 'sources: ["[[08_Projects/Unrelated]]"]', "---",
  "> [!dashboard-panel] Alpha project", "> **Goal**: original wording.",
  "> [[08_Projects/Alpha/Overview#Goal|Entry]]", ">", "> Original next step.", "",
  "> [!dashboard-panel] Beta project", "> [[08_Projects/Beta|Entry]]", "> No invented status."
].join("\n");

function fixture() {
  const files = new Map(), reads = [], metadata = [], writes = [];
  class TFile {
    constructor(path, fm, body) {
      Object.assign(this, { path, fm, body, name: path.split("/").at(-1), stat: { mtime: 1 } });
      this.extension = this.name.split(".").at(-1); this.basename = this.name.replace(/\.[^.]+$/, "");
    }
  }
  const add = (path, fm = {}, body = "") => { const file = new TFile(path, fm, body); files.set(path, file); return file; };
  add(S.home, {}, HM); add(S.homeBase, {}, JSON.stringify(HB)); add(S.projects, {}, PM); add(S.projectsBase, {}, JSON.stringify(PB));
  add(A, { title: "Alpha", id: "project_a", type: "project", tags: ["project"] }); add(B, { title: "Beta", id: "project_b" });
  add("08_Projects/Alpha/Week.md", { type: "project" }, "Never read");
  for (const [folder, total] of [["00_Inbox", 6], ["01_Knowledge", 7], ["06_Daily", 8]]) {
    for (let i = 0; i < total; i++) {
      add(folder + "/Note-" + i + ".md", { id: folder + i, type: folder === "06_Daily" ? "daily" : "concept",
        date: folder === "06_Daily" && i ? "2026-01-02" : undefined,
        updated: "2026-01-" + String(i + 1).padStart(2, "0") }, "Never read").stat.mtime = 10 + i;
    }
  }
  for (const path of ["00_Inbox/Personal Model/Private.md", "00_Inbox/模板.md", "05_Personal/Profile.md",
    "Reference-Package/00_Inbox/Copy.md", "00_Inbox-Elsewhere/Copy.md", "09_System/Templates/Knowledge.md"]) add(path, {}, "Excluded");
  add("01_Knowledge/Fixture.md", { validation_fixture: true }, "Excluded");
  const write = () => { writes.push(true); throw Error("Forbidden write"); };
  const app = { vault: {
    getAbstractFileByPath: path => files.get(path), getMarkdownFiles: () => [...files.values()].filter(f => f.extension === "md"),
    cachedRead: async f => { reads.push(f.path); return f.body; }, create: write, modify: write, createFolder: write
  }, metadataCache: { getFileCache: f => { metadata.push(f.path); return { frontmatter: f.fm }; } }, fileManager: { processFrontMatter: write } };
  class DashboardView { constructor() { this.app = app; } }
  // JSON is a YAML subset; the actual plugin injects Obsidian parseYaml.
  install({ DashboardView, parseYaml: JSON.parse, TFile, dateKey: x => typeof x === "string" ? x : "" });
  return { app, files, reads, metadata, writes, view: new DashboardView() };
}

test("only finite exact project allowlists or explicit false are accepted", () => {
  assert.deepEqual(h.parseProjectBase(PB).paths, [A, B]);
  assert.deepEqual(h.parseProjectBase({ filters: "false" }).paths, []);
  assert.deepEqual(h.parseProjectBase({ filters: { and: ['file.ext == "md"', 'file.inFolder("08_Projects")', { or: ["false"] }] } }).paths, []);
  assert.throws(() => h.parseProjectBase({ filters: { or: ['file.inFolder("08_Projects")', 'file.path == "' + A + '"'] } }), { code: "PROJECT_WHITELIST_REQUIRED" });
  assert.throws(() => h.parseProjectBase({ filters: 'file.path.contains("Projects")' }), { code: "UNSUPPORTED_FILTER" });
  assert.throws(() => h.parseProjectBase({ filters: { not: ['file.path == "' + A + '"'] } }), { code: "UNSUPPORTED_FILTER" });
  for (const path of ["05_Personal/Profile.md", "08_Projects/../05_Personal/Profile.md", "C:/Private.md"])
    assert.throws(() => h.parseProjectBase({ filters: 'file.path == "' + path + '"' }), { code: "PROJECT_PATH_OUT_OF_SCOPE" });
});
test("project panel uses its first wikilink and preserves source Markdown", () => {
  const extra = "\n\n> [!dashboard-panel] Ignore\n> [[Other]] then [[08_Projects/Alpha/Overview]]\n\n" + F + "md\n> [!dashboard-panel] Example\n> [[08_Projects/Beta]]\n" + F;
  const panels = h.parseProjectPanels(PM + extra, [A, B]);
  assert.equal(panels.size, 2); assert.equal(panels.get(A).title, "Alpha project");
  assert.match(panels.get(A).body, /^\*\*Goal\*\*: original wording\./);
  assert.match(panels.get(A).body, /\[\[08_Projects\/Alpha\/Overview#Goal\|Entry\]\]/);
  assert.equal(panels.get(B).title, "Beta project");
});
test("actions retain balanced native URI and tasks retain the original query only", () => {
  const actions = h.parseActions(HM);
  assert.deepEqual(actions.map(a => a.kind), ["quickadd", "wikilink", "obsidian", "external"]);
  assert.equal(actions[1].target, "08_Projects/Alpha/Overview#Next");
  assert.equal(actions[2].target, "obsidian://search?query=(path%3A%2201_Knowledge%22%20OR%20path%3A%2203_Books%22)");
  assert.equal(h.extractTasksMarkdown(HM), F + "tasks\nnot done\npath regex matches /^(06_Daily|08_Projects)\\//\nlimit 6\n" + F);
  assert.equal(h.extractTasksMarkdown("No query"), ""); assert.equal(h.extractTasksMarkdown("> " + F + "tasks\n> incomplete"), "");
  const four = F + String.fromCharCode(96);
  assert.equal(h.extractTasksMarkdown(four + "markdown\n" + F + "tasks\nexample\n" + F + "\n" + four), "");
});
test("HTML comment examples never appear as projects, actions or task queries", () => {
  const hidden = "<!--\n" + PM + "\n" + HM + "\n-->\n";
  assert.equal(h.parseProjectPanels(hidden, [A, B]).size, 0); assert.deepEqual(h.parseActions(hidden), []);
  assert.equal(h.extractTasksMarkdown(hidden), "");
  assert.equal(h.parseProjectPanels(hidden + PM, [A, B]).get(A).title, "Alpha project");
});
test("workspace body reads are limited to four sources; counts are full while lists are limited", async () => {
  const f = fixture(), before = [...f.files.values()].map(x => [x.path, JSON.stringify(x.fm), x.body]);
  const data = await f.view.loadSecondBrainWorkspace();
  assert.equal(f.view.workspaceData, data); assert.deepEqual(data.errors, []);
  assert.deepEqual(data.counts, { projects: 2, inbox: 6, knowledge: 7, daily: 8 });
  assert.deepEqual([data.inbox.length, data.knowledge.length, data.daily.length], [5, 5, 5]);
  assert.equal(data.knowledge[0].path, "01_Knowledge/Note-6.md"); assert.equal(data.inbox[0].path, "00_Inbox/Note-5.md");
  assert.equal(data.daily[0].date, "2026-01-02"); assert.equal(data.daily[0].type, "daily");
  assert.equal(data.projects[0].panel.sourcePath, S.projects);
  assert.deepEqual([...f.reads].sort(), Object.values(S).sort());
  for (const path of ["00_Inbox/Personal Model/Private.md", "00_Inbox/模板.md", "05_Personal/Profile.md",
    "Reference-Package/00_Inbox/Copy.md", "00_Inbox-Elsewhere/Copy.md", "09_System/Templates/Knowledge.md", "08_Projects/Alpha/Week.md"])
    assert.ok(!f.metadata.includes(path), "Excluded metadata: " + path);
  assert.deepEqual(f.writes, []); assert.deepEqual([...f.files.values()].map(x => [x.path, JSON.stringify(x.fm), x.body]), before);
});
test("missing or invalid project base has an explicit error with no directory fallback", async () => {
  for (const replacement of [undefined, "{bad", JSON.stringify({ filters: 'file.inFolder("08_Projects")' })]) {
    const f = fixture();
    if (replacement === undefined) f.files.delete(S.projectsBase); else f.files.get(S.projectsBase).body = replacement;
    const data = await f.view.loadSecondBrainWorkspace();
    assert.equal(data.counts.projects, 0); assert.equal(data.counts.inbox, 6);
    assert.ok(data.errors.some(e => e.section === "projects")); assert.ok(!f.metadata.includes(A)); assert.deepEqual(f.writes, []);
  }
});
test("safe false is valid empty data, and a missing whitelisted file remains explicit", async () => {
  const f = fixture(); f.files.get(S.projectsBase).body = JSON.stringify({ filters: "false" });
  const empty = await f.view.loadSecondBrainWorkspace(); assert.equal(empty.counts.projects, 0); assert.deepEqual(empty.errors, []);
  f.files.get(S.projectsBase).body = JSON.stringify(PB); f.files.delete(B);
  const partial = await f.view.loadSecondBrainWorkspace(); assert.equal(partial.counts.projects, 1);
  assert.ok(partial.errors.some(e => e.path === B && e.code === "PROJECT_ENTRY_MISSING"));
});
test("unsupported home filter fails closed while independent projects remain usable", async () => {
  const f = fixture(), base = structuredClone(HB); base.filters.and.push("note.someCustomFunction()");
  f.files.get(S.homeBase).body = JSON.stringify(base);
  const data = await f.view.loadSecondBrainWorkspace();
  assert.equal(data.counts.projects, 2); assert.equal(data.counts.inbox, 0);
  assert.ok(data.errors.some(e => e.section === "home" && e.code === "UNSUPPORTED_FILTER"));
  assert.ok(f.metadata.every(p => p === A || p === B)); assert.deepEqual(f.writes, []);
});
test("slow old loads neither overwrite nor return old data after a newer load", async () => {
  const f = fixture(), read = f.app.vault.cachedRead; let first = true, release;
  f.app.vault.cachedRead = file => file.path === S.home && first
    ? (first = false, new Promise(resolve => { release = resolve; })) : read(file);
  const old = f.view.loadSecondBrainWorkspace(); f.files.get(S.home).body = HM.replace("[Record]", "[New action]");
  const latest = await f.view.loadSecondBrainWorkspace(); release(HM);
  assert.equal(await old, latest); assert.equal(f.view.workspaceData, latest);
  assert.equal(latest.actions[0].label, "New action"); assert.deepEqual(f.writes, []);
});
