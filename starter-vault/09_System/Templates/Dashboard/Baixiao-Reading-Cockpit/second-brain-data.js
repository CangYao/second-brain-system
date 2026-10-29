"use strict";

// Local data adapter for Baixiao Reading Cockpit. Upstream license remains unchanged.
// Install after the upstream prototype extensions; no background note migration.
const STATUS_LABELS = Object.freeze({
  planned: "计划阅读",
  reading: "在读",
  paused: "暂停",
  completed: "已读"
});
const LABEL_STATUSES = Object.freeze(Object.fromEntries(
  Object.entries(STATUS_LABELS).map(([status, label]) => [label, status])
));
const PROTOCOL = "second-brain-cockpit";
const INSTALLED = Symbol.for("second-brain.reading-cockpit.data-adapter");

function install({ DashboardView, PluginClass, TFile, Notice, dateKey, localDate }) {
  if (!DashboardView?.prototype || !PluginClass?.prototype || typeof TFile !== "function" ||
      typeof Notice !== "function" || typeof dateKey !== "function" || typeof localDate !== "function") {
    throw new TypeError("Second Brain data adapter requires the upstream view, plugin and Obsidian helpers.");
  }
  if (Object.prototype.hasOwnProperty.call(DashboardView.prototype, INSTALLED)) return;
  const notify = (message) => new Notice(message);
  const inBookScope = (file) => file instanceof TFile && file.extension === "md" &&
    /^(?:03_Books\/Fiction|03_Books\/Nonfiction)\/.+\.md$/.test(file.path) &&
    !file.path.split("/").some((part) => part === "." || part === "..") &&
    !String(file.basename || "").includes("模板");
  const isBook = (file, fm) => inBookScope(file) && fm?.type === "book" && fm.validation_fixture !== true;
  const list = (value) => Array.isArray(value) ? value.slice() : [];
  const readingLabel = (status) => typeof status === "string" && Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)
    ? STATUS_LABELS[status]
    : status === undefined || status === null || status === "" ? "未登记" : "其他状态";

  DashboardView.prototype.notes = function () {
    return this.app.vault.getMarkdownFiles().flatMap((file) => {
      if (!inBookScope(file)) return [];
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
      if (!isBook(file, fm)) return [];
      // No ctime/mtime/updated fallback: a reading date cannot be inferred from file activity.
      const created = dateKey(fm.created);
      return [{
        file,
        path: file.path,
        title: typeof fm.title === "string" && fm.title.trim() ? fm.title : file.basename,
        folder: file.parent?.name || "",
        rootFolder: file.path.split("/").slice(0, 2).join("/"),
        reading: readingLabel(fm.status),
        absorption: "未登记",
        created,
        createdFromFrontmatter: Boolean(created),
        modified: file.stat?.mtime,
        completed: "",
        id: fm.id,
        author: Array.isArray(fm.author) ? fm.author.slice() : fm.author,
        category: fm.book_category,
        tags: list(fm.tags),
        sources: list(fm.sources),
        relations: list(fm.relations),
        updated: fm.updated,
        status: fm.status
      }];
    });
  };

  // Upstream scan and create handlers may call these methods. They only refresh views.
  DashboardView.prototype.initializeNewNotes = async function () { return 0; };
  DashboardView.prototype.backfillMissingReadingProperties = async function () { return 0; };
  DashboardView.prototype.queueNewNote = function () { return 0; };

  DashboardView.prototype.update = async function (note, field, value) {
    const canonical = typeof value === "string" && Object.prototype.hasOwnProperty.call(STATUS_LABELS, value)
      ? value
      : typeof value === "string" && Object.prototype.hasOwnProperty.call(LABEL_STATUSES, value)
        ? LABEL_STATUSES[value] : null;
    if ((field !== "阅读状态" && field !== "status") || !canonical) {
      notify("只支持明确设置为计划阅读、在读、暂停或已读；未登记及吸收状态不写入。");
      return false;
    }
    const matches = (file, fm) => file === note?.file && file?.path === note?.path &&
      typeof note?.id === "string" && note.id.trim() !== "" &&
      fm?.id === note.id && isBook(file, fm);
    const current = this.app.vault.getAbstractFileByPath(note?.path || "");
    const cached = inBookScope(current) && current === note?.file && current.path === note?.path
      ? this.app.metadataCache.getFileCache(current)?.frontmatter : null;
    if (!matches(current, cached)) {
      notify("书籍入口、类型或稳定 ID 已变化，已取消写入；请刷新后重试。");
      return false;
    }
    if (cached.status === canonical) return true;
    try {
      await this.app.fileManager.processFrontMatter(current, (fm) => {
        // Revalidate against the fresh document inside the write callback, not just the cache.
        const resolved = this.app.vault.getAbstractFileByPath(note.path);
        if (!matches(resolved, fm)) throw new Error("BOOK_IDENTITY_CHANGED");
        fm.status = canonical;
        fm.updated = localDate();
      });
    } catch (error) {
      console.warn("Second Brain reading status update rejected or failed.", error);
      notify("阅读状态未能保存；笔记可能已变化或不可编辑，请刷新后检查。");
      return false;
    }
    notify(`已将《${note.title}》标记为${STATUS_LABELS[canonical]}`);
    try { await this.render(); } catch (error) {
      console.warn("Second Brain status saved but view refresh failed.", error);
      notify("状态已保存，但页面刷新失败；请重新打开驾驶舱。");
    }
    return true;
  };

  DashboardView.prototype.createDailyNote = async function () {
    const quickAdd = this.app.plugins?.getPlugin?.("quickadd") || this.app.plugins?.plugins?.quickadd;
    const api = quickAdd?.api;
    if (typeof api?.executeChoice !== "function") {
      notify("请先启用 QuickAdd 并配置已有入口“新增每日记录”；驾驶舱未创建任何日记或目录。");
      return false;
    }
    try {
      await api.executeChoice("新增每日记录");
      return true;
    } catch (error) {
      console.warn("Existing QuickAdd daily entry failed.", error);
      notify("QuickAdd“新增每日记录”执行失败，请检查该入口；驾驶舱未另建日记或目录。");
      return false;
    }
  };

  PluginClass.prototype.activateView = async function () {
    const workspace = this.app.workspace;
    const viewType = DashboardView.prototype.getViewType.call({});
    const leaves = workspace.getLeavesOfType(viewType) || [];
    const centerLeaf = leaves.find((leaf) => {
      if (typeof leaf.getRoot === "function" && workspace.rootSplit) {
        return leaf.getRoot() === workspace.rootSplit;
      }
      return leaf.containerEl && !leaf.containerEl.closest?.(
        ".workspace-split.mod-left-split, .workspace-split.mod-right-split"
      );
    });
    const leaf = centerLeaf || workspace.getLeaf("tab");
    if (!leaf) {
      notify("无法打开中心工作区标签页，请稍后重试。");
      return false;
    }
    await leaf.setViewState({ type: viewType, active: true });
    await workspace.revealLeaf(leaf);
    return true;
  };

  const originalOnload = PluginClass.prototype.onload;
  PluginClass.prototype.onload = async function () {
    const saved = (await this.loadData()) || {};
    const savedIdentity = saved.dashboard?.identity;
    await originalOnload.call(this);
    if (!savedIdentity || typeof savedIdentity !== "object" || Array.isArray(savedIdentity)) {
      this.dashboardSettings ||= {};
      this.dashboardSettings.identity = {
        brandMark: "SB",
        brandName: "Second Brain",
        avatarText: "",
        displayName: "第二大脑",
        role: "阅读与知识"
      };
    }
    // Registers a view-only command; neither startup nor the protocol writes business notes.
    this.registerObsidianProtocolHandler(PROTOCOL, () => {
      void this.activateView().catch((error) => {
        console.warn("Second Brain cockpit could not open.", error);
        notify("驾驶舱未能打开，请从命令面板重试。");
      });
    });
  };
  DashboardView.prototype.getDisplayText = function () { return "第二大脑 · 阅读驾驶舱"; };
  Object.defineProperty(DashboardView.prototype, INSTALLED, { value: true });
}

module.exports = { install };
