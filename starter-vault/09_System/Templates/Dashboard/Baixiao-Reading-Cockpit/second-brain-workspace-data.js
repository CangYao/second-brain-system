"use strict";

// Read-only workspace projections. The existing Bases and Markdown remain the source of truth.
const SOURCE_PATHS = Object.freeze({
  home: "02_Topics/第二大脑首页.md",
  homeBase: "02_Topics/首页动态视图.base",
  projects: "08_Projects/项目总览.md",
  projectsBase: "08_Projects/项目总览.base"
});
const HOME_SECTIONS = Object.freeze({
  inbox: { folder: "00_Inbox", view: "收件箱资料" },
  knowledge: { folder: "01_Knowledge", view: "知识节点" },
  daily: { folder: "06_Daily", view: "每日记录" }
});
const INSTALLED = Symbol.for("second-brain.reading-cockpit.workspace-data");

function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function safePath(path) {
  return typeof path === "string" && path !== "" && !/^[\\/]|[\\:\0]/.test(path) &&
    !path.split("/").some(part => !part || part === "." || part === "..");
}
function inFolder(path, folder) {
  return safePath(path) && path.startsWith(folder + "/");
}
function inHomeScope(file) {
  return file?.extension === "md" && safePath(file.path) &&
    Object.values(HOME_SECTIONS).some(section => inFolder(file.path, section.folder)) &&
    !inFolder(file.path, "00_Inbox/Personal Model") &&
    !String(file.basename || "").includes("模板");
}
function literal(text) {
  const value = text.trim();
  if (/^"(?:[^"\\]|\\.)*"$/.test(value)) {
    try { return JSON.parse(value); } catch (_) { /* rejected below */ }
  }
  if (/^'[^'\\]*'$/.test(value)) return value.slice(1, -1);
  throw failure("UNSUPPORTED_FILTER", "筛选只支持明确的带引号字符串。");
}
function filterLeaf(expression, mode) {
  if (typeof expression !== "string") throw failure("UNSUPPORTED_FILTER", "筛选表达式必须是字符串。");
  const text = expression.trim();
  if (text === "false") return { test: () => false, bounded: true, paths: [] };
  if (text === "true") return { test: () => true, bounded: false, paths: [] };
  let match = text.match(/^file\.path\s*==\s*(.+)$/);
  if (match && mode === "projects") {
    const path = literal(match[1]);
    if (!inFolder(path, "08_Projects") || !path.endsWith(".md")) {
      throw failure("PROJECT_PATH_OUT_OF_SCOPE", "项目白名单必须指向 08_Projects 内明确的 Markdown 文件。");
    }
    return { test: file => file.path === path, bounded: true, paths: [path] };
  }
  match = text.match(/^file\.ext\s*==\s*(.+)$/);
  if (match) {
    const extension = literal(match[1]);
    if (extension !== "md") throw failure("UNSUPPORTED_FILTER", "当前视图只支持 Markdown 文件。");
    return { test: file => file.extension === extension, bounded: false, paths: [] };
  }
  match = text.match(/^(!?)file\.inFolder\((.+)\)$/);
  if (match) {
    const folder = literal(match[2]);
    const permitted = safePath(folder) && (mode === "projects"
      ? folder === "08_Projects" || inFolder(folder, "08_Projects")
      : Object.values(HOME_SECTIONS).some(section => folder === section.folder || inFolder(folder, section.folder)));
    if (!permitted) throw failure("FILTER_SCOPE_UNSUPPORTED", "Bases 筛选超出当前首页或项目的数据范围。");
    return { test: file => match[1] ? !inFolder(file.path, folder) : inFolder(file.path, folder), bounded: false, paths: [] };
  }
  if (/^note\.validation_fixture\s*!=\s*true$/.test(text)) {
    return { test: (_file, fm) => fm.validation_fixture !== true, bounded: false, paths: [] };
  }
  match = text.match(/^!file\.basename\.contains\((.+)\)$/);
  if (match) {
    const part = literal(match[1]);
    return { test: file => !String(file.basename || "").includes(part), bounded: false, paths: [] };
  }
  throw failure("UNSUPPORTED_FILTER", "Bases 使用了尚未支持的筛选；已停止该视图读取，请检查原 .base 文件。");
}
function compileFilter(node, mode, depth = 0) {
  if (depth > 24) throw failure("UNSUPPORTED_FILTER", "Bases 筛选嵌套过深。");
  if (typeof node === "string") return filterLeaf(node, mode);
  if (!node || Array.isArray(node) || typeof node !== "object") {
    throw failure("INVALID_BASE", "Bases 缺少有效筛选结构。");
  }
  const keys = Object.keys(node);
  if (keys.length !== 1 || !["and", "or", "not"].includes(keys[0]) || !Array.isArray(node[keys[0]])) {
    throw failure("UNSUPPORTED_FILTER", "Bases 仅支持 and / or / not 的明确筛选列表。");
  }
  const operation = keys[0], children = node[operation].map(child => compileFilter(child, mode, depth + 1));
  if (!children.length || (mode === "projects" && operation === "not")) {
    throw failure("UNSUPPORTED_FILTER", "项目白名单必须使用明确的正向路径；空列表请改用 false。");
  }
  const paths = [...new Set(children.flatMap(child => child.paths))];
  if (operation === "and") {
    return { paths, bounded: children.some(child => child.bounded), test: (file, fm) => children.every(child => child.test(file, fm)) };
  }
  if (operation === "or") {
    return { paths, bounded: children.every(child => child.bounded), test: (file, fm) => children.some(child => child.test(file, fm)) };
  }
  return { paths: [], bounded: false, test: (file, fm) => !children.some(child => child.test(file, fm)) };
}
function parseProjectBase(base) {
  if (!base || typeof base !== "object" || Array.isArray(base)) throw failure("INVALID_BASE", "项目 Bases 格式无效。");
  const compiled = compileFilter(base.filters, "projects");
  if (!compiled.bounded) {
    throw failure("PROJECT_WHITELIST_REQUIRED", "项目 Bases 缺少明确的 file.path 白名单；不会扫描整个项目目录。");
  }
  return compiled;
}
function parseHomeBase(base) {
  if (!base || typeof base !== "object" || !Array.isArray(base.views)) {
    throw failure("INVALID_BASE", "首页 Bases 缺少有效视图。");
  }
  return { filter: compileFilter(base.filters, "home").test, views: base.views };
}
function homeView(views, section) {
  const matches = views.filter(view => view?.name === HOME_SECTIONS[section].view);
  if (matches.length !== 1) throw failure("HOME_VIEW_MISSING", "首页 Bases 中对应视图缺失或重名。");
  const view = matches[0];
  const filter = view.filters === undefined ? () => true : compileFilter(view.filters, "home").test;
  if (view.limit !== undefined && (!Number.isInteger(view.limit) || view.limit < 0)) {
    throw failure("UNSUPPORTED_VIEW", "首页视图 limit 必须是非负整数。");
  }
  const sort = view.sort === undefined ? [] : view.sort;
  if (!Array.isArray(sort) || sort.some(item =>
    !["file.mtime", "note.updated", "file.name", "note.title"].includes(item?.property) ||
    !["ASC", "DESC"].includes(item?.direction))) {
    throw failure("UNSUPPORTED_VIEW", "首页视图使用了尚未支持的排序。");
  }
  return { filter, sort, limit: Math.min(5, view.limit ?? 5) };
}
function markdownLines(markdown) {
  const lines = String(markdown || "").replace(/^\uFEFF/, "").replace(/<!--[\s\S]*?(?:-->|$)/g, "").split(/\r?\n/);
  if (lines[0] === "---") {
    const end = lines.findIndex((line, index) => index > 0 && line === "---");
    return end < 0 ? [] : lines.slice(end + 1);
  }
  return lines;
}
function fence(line) {
  const match = line.match(/^\s{0,3}([\x60~])\1{2,}(.*)$/);
  return match ? { character: match[1], length: line.trimStart().match(/^[\x60~]+/)[0].length, language: match[2].trim() } : null;
}
function extractCallouts(markdown, type) {
  const lines = markdownLines(markdown), result = [];
  let openFence = null;
  for (let index = 0; index < lines.length; index++) {
    const foundFence = fence(lines[index]);
    if (foundFence) {
      if (!openFence) openFence = foundFence;
      else if (foundFence.character === openFence.character && foundFence.length >= openFence.length && !foundFence.language) openFence = null;
      continue;
    }
    if (openFence) continue;
    const header = lines[index].match(/^\s{0,3}>\s?\[!([a-z0-9-]+)\][+-]?\s*(.*)$/i);
    if (!header || header[1].toLowerCase() !== type) continue;
    const body = [];
    for (index++; index < lines.length; index++) {
      if (/^\s{0,3}>\s?\[![a-z0-9-]+\]/i.test(lines[index])) break;
      const quote = lines[index].match(/^\s{0,3}>\s?(.*)$/);
      if (!quote) break;
      body.push(quote[1]);
    }
    index--;
    result.push({ title: header[2].trim(), body: body.join("\n").trim() });
  }
  return result;
}
function wikiPath(target) {
  const path = target.split("|")[0].split("#")[0].trim();
  return safePath(path) ? path.endsWith(".md") ? path : path + ".md" : "";
}
function parseProjectPanels(markdown, whitelist) {
  const allowed = new Set(whitelist), panels = new Map();
  for (const panel of extractCallouts(markdown, "dashboard-panel")) {
    const first = (panel.title + "\n" + panel.body).match(/\[\[([^\]]+)\]\]/);
    const path = first ? wikiPath(first[1]) : "";
    if (allowed.has(path) && !panels.has(path)) panels.set(path, panel);
  }
  return panels;
}
function markdownLink(line) {
  const start = /\[([^\]\n]+)\]\(/g;
  let match;
  while ((match = start.exec(line))) {
    if (match.index > 0 && line[match.index - 1] === "[") continue;
    let depth = 1, end = start.lastIndex;
    for (; end < line.length && depth; end++) {
      if (line[end] === "\\") { end++; continue; }
      if (line[end] === "(") depth++;
      if (line[end] === ")") depth--;
    }
    if (!depth) return { label: match[1], target: line.slice(start.lastIndex, end - 1).trim(), start: match.index, end };
  }
  return null;
}
function parseActions(markdown) {
  const actions = [];
  for (const callout of extractCallouts(markdown, "dashboard-actions")) {
    for (const line of callout.body.split("\n")) {
      if (!/^\s*[-*+]\s/.test(line)) continue;
      const wiki = /\[\[([^\]]+)\]\]/.exec(line), link = markdownLink(line);
      let item;
      if (wiki && (!link || wiki.index < link.start)) {
        const [target, label] = wiki[1].split("|");
        if (!wikiPath(target)) continue;
        item = { target: target.trim(), label: label || target.split("/").pop(), kind: "wikilink", end: wiki.index + wiki[0].length };
      } else if (link) {
        const target = link.target.replace(/^<([^<>]+)>$/, "$1");
        const kind = /^obsidian:\/\/quickadd(?:[/?#]|$)/i.test(target) ? "quickadd"
          : /^obsidian:\/\//i.test(target) ? "obsidian"
            : /^https?:\/\//i.test(target) ? "external" : "";
        if (!kind) continue;
        item = { ...link, target, kind };
      }
      if (!item) continue;
      const remainder = line.slice(item.end), description = remainder.split(/<br\s*\/?>/i).slice(1).join(" ").trim();
      actions.push({ label: item.label.trim(), target: item.target, kind: item.kind, description });
    }
  }
  return actions;
}
function extractTasksMarkdown(markdown) {
  const lines = markdownLines(markdown).map(line => line.replace(/^\s{0,3}(?:>\s?)+/, ""));
  let active = null, block = [];
  for (const line of lines) {
    const found = fence(line);
    if (!active) {
      if (found) { active = found; block = [line.trimStart()]; }
      continue;
    }
    block.push(line);
    if (found && found.character === active.character && found.length >= active.length && !found.language) {
      if (active.language.toLowerCase() === "tasks") return block.join("\n");
      active = null; block = [];
    }
  }
  return "";
}
function emptyWorkspace() {
  return { projects: [], inbox: [], knowledge: [], daily: [], actions: [], tasksMarkdown: "",
    counts: { projects: 0, inbox: 0, knowledge: 0, daily: 0 }, errors: [], sourcePaths: { ...SOURCE_PATHS } };
}
function descriptor(file, fm) {
  return { file, path: file.path, title: typeof fm.title === "string" && fm.title.trim() ? fm.title : file.basename,
    id: fm.id, type: fm.type, date: fm.date, tags: Array.isArray(fm.tags) ? fm.tags.slice() : [], updated: fm.updated, mtime: file.stat?.mtime };
}
function ordered(rows, sort, dateKey) {
  const value = (row, property) => {
    if (property === "file.mtime") return Number(row.mtime) || 0;
    if (property === "note.updated") return dateKey(row.updated) || "";
    return property === "note.title" ? String(row.title || "") : String(row.file.name || row.path);
  };
  return rows.slice().sort((a, b) => {
    for (const item of sort) {
      const left = value(a, item.property), right = value(b, item.property);
      const comparison = left < right ? -1 : left > right ? 1 : 0;
      if (comparison) return item.direction === "DESC" ? -comparison : comparison;
    }
    return a.path.localeCompare(b.path);
  });
}
function install({ DashboardView, parseYaml, TFile, dateKey }) {
  if (!DashboardView?.prototype || typeof parseYaml !== "function" || typeof TFile !== "function" || typeof dateKey !== "function") {
    throw new TypeError("Workspace adapter requires DashboardView, parseYaml, TFile and dateKey.");
  }
  if (Object.prototype.hasOwnProperty.call(DashboardView.prototype, INSTALLED)) return;
  async function collect(app) {
    const data = emptyWorkspace(), texts = {};
    const addError = (section, path, error) => data.errors.push({
      section, path, code: error.code || "WORKSPACE_READ_FAILED",
      message: error.message || "读取失败，请检查原入口文件。"
    });
    await Promise.all(Object.entries(SOURCE_PATHS).map(async ([key, path]) => {
      try {
        const file = app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile) || file.path !== path) throw failure("SOURCE_MISSING", "入口文件不存在：" + path);
        texts[key] = await app.vault.cachedRead(file);
      } catch (error) { addError(key.startsWith("projects") ? "projects" : "home", path, error); }
    }));
    if (texts.home !== undefined) {
      data.actions = parseActions(texts.home);
      data.tasksMarkdown = extractTasksMarkdown(texts.home);
    }
    if (texts.projectsBase !== undefined) {
      try {
        const whitelist = parseProjectBase(parseYaml(texts.projectsBase));
        const panels = parseProjectPanels(texts.projects || "", whitelist.paths);
        for (const path of whitelist.paths) {
          const file = app.vault.getAbstractFileByPath(path);
          if (!(file instanceof TFile) || file.path !== path || file.extension !== "md") {
            addError("projects", path, failure("PROJECT_ENTRY_MISSING", "白名单中的项目入口不存在。"));
            continue;
          }
          const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
          if (!whitelist.test(file, fm)) continue;
          const panel = panels.get(path);
          data.projects.push({ ...descriptor(file, fm), panel: panel ? { ...panel, sourcePath: SOURCE_PATHS.projects } : null });
        }
        data.counts.projects = data.projects.length;
      } catch (error) { data.projects = []; data.counts.projects = 0; addError("projects", SOURCE_PATHS.projectsBase, error); }
    }
    if (texts.homeBase !== undefined) {
      try {
        const home = parseHomeBase(parseYaml(texts.homeBase));
        const candidates = [];
        for (const file of app.vault.getMarkdownFiles()) {
          if (!(file instanceof TFile) || !inHomeScope(file)) continue;
          const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
          if (fm.validation_fixture === true || !home.filter(file, fm)) continue;
          candidates.push({ note: descriptor(file, fm), fm });
        }
        for (const [section, config] of Object.entries(HOME_SECTIONS)) {
          try {
            const view = homeView(home.views, section);
            const rows = candidates.filter(item => inFolder(item.note.path, config.folder) && view.filter(item.note.file, item.fm)).map(item => item.note);
            data.counts[section] = rows.length;
            data[section] = ordered(rows, view.sort, dateKey).slice(0, view.limit);
          } catch (error) { addError(section, SOURCE_PATHS.homeBase, error); }
        }
      } catch (error) { addError("home", SOURCE_PATHS.homeBase, error); }
    }
    return data;
  }
  DashboardView.prototype.loadSecondBrainWorkspace = async function () {
    const sequence = (this._sbWorkspaceLoadSequence || 0) + 1;
    this._sbWorkspaceLoadSequence = sequence;
    const promise = collect(this.app).catch(error => {
      const data = emptyWorkspace();
      data.errors.push({ section: "workspace", path: "", code: error.code || "WORKSPACE_READ_FAILED", message: error.message });
      return data;
    }).then(data => {
      if (sequence !== this._sbWorkspaceLoadSequence) return this._sbWorkspaceLatestLoad;
      this.workspaceData = data;
      return data;
    });
    this._sbWorkspaceLatestLoad = promise;
    return promise;
  };
  Object.defineProperty(DashboardView.prototype, INSTALLED, { value: true });
}

module.exports = { install, helpers: {
  SOURCE_PATHS, inHomeScope, compileFilter, parseProjectBase, parseHomeBase, homeView,
  extractCallouts, parseProjectPanels, parseActions, extractTasksMarkdown, ordered
} };
