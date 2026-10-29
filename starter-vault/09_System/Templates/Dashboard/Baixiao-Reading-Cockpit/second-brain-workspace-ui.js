'use strict';

// In-view home and project pages. The existing Markdown/Bases remain the data owners.
module.exports = function install({ DashboardView, PluginClass, MarkdownRenderer, Component, Notice, esc }) {
  const proto = DashboardView.prototype;
  const HOME = '02_Topics/第二大脑首页.md';
  const PROJECTS = '08_Projects/项目总览.md';
  const isWorkspace = page => page === 'home' || page === 'projects';
  const text = value => Array.isArray(value) ? value.join(' · ') : String(value ?? '');
  const empty = message => `<p class="sb-workspace-empty">${esc(message)}</p>`;
  const stat = (label, value, caption) => `<div class="sb-workspace-stat"><span>${esc(label)}</span><b>${esc(String(value))}</b><small>${esc(caption)}</small></div>`;
  const source = (path, label) => `<button class="sb-workspace-source" data-sb-open="${esc(path)}">${esc(label)}</button>`;
  const icons = {
    reading: '<path d="M3 5c4-2 7-1 9 1v15c-2-2-5-3-9-1V5Zm18 0c-4-2-7-1-9 1v15c2-2 5-3 9-1V5Z"/>',
    projects: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5 5-3Z"/>',
    inbox: '<path d="M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8M8 16h6"/>',
    knowledge: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>',
    daily: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6M17 2v6M3 11h18M7 15h3M14 15h3"/>',
    tasks: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 9 2 2 4-4M8 16h8"/>'
  };
  const icon = kind => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[kind] || icons.knowledge}</svg>`;
  const typeLabels = new Map([['book','书籍'],['article','文章'],['video','视频'],['concept','概念'],['thought','想法'],['event','事件'],['daily','每日记录'],['project','项目']]);
  const typeLabel = value => typeLabels.get(value) || '资料';
  const tags = values => (Array.isArray(values) ? values : []).slice(0,2).map(t => `<span>${esc(String(t))}</span>`).join('');
  const module = (kind,title,eyebrow,count,content,footer) => `<section class="sb-workspace-panel sb-module sb-module-${kind}"><header class="sb-module-head"><span class="sb-module-icon">${icon(kind)}</span><div><small>${eyebrow}</small><h2>${title}</h2></div><span class="sb-module-count">${esc(String(count))}</span></header><div class="sb-module-content">${content}</div><footer class="sb-module-foot">${footer}</footer></section>`;
  const lowerHome = (view,data,reading,count) => {
    const books = reading.length ? `<div class="sb-book-gallery">${reading.map(n => {
      const author = text(n.author) || '作者未登记';
      const category = n.category === 'Fiction' ? '小说与文学' : n.category === 'Nonfiction' ? '非虚构' : text(n.category);
      return `<button class="sb-book-feature" data-sb-open="${esc(n.path)}"><span class="sb-book-object" aria-hidden="true"><span class="sb-book-spine" aria-hidden="true"></span><span class="sb-book-face"><small>READING NOTES</small><b>${esc(n.title)}</b><em>${esc(author)}</em></span></span><span class="sb-book-info"><span class="sb-content-chip">正在阅读</span><strong>${esc(n.title)}</strong><small>${esc(author)}</small><span class="sb-book-tags">${category?`<span>${esc(category)}</span>`:''}${tags(n.tags)}</span><span class="sb-card-action">打开阅读笔记 ↗</span></span></button>`;
    }).join('')}</div>` : empty('暂无标记为在读的书籍');
    const projects = data.projects.length ? `<div class="sb-project-portals">${data.projects.map((n,i) => `<button class="sb-project-portal" style="--tile-index:${i}" data-sb-open="${esc(n.path)}"><span class="sb-portal-orb">${icon('projects')}</span><span class="sb-portal-copy"><b>${esc(n.panel?.title || n.title)}</b><small>${esc(n.updated ? `笔记更新 ${n.updated}` : '内容更新日期未登记')}</small></span><span class="sb-portal-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>` : empty('项目清单暂未配置入口');
    const inbox = data.inbox.length ? `<div class="sb-inbox-stack">${data.inbox.map((n,i) => `<button class="sb-inbox-document" style="--tile-index:${i}" data-sb-open="${esc(n.path)}"><span class="sb-document-icon">${icon('inbox')}</span><span class="sb-document-copy"><b>${esc(n.title)}</b><small>${esc(typeLabel(n.type))}</small></span><span class="sb-document-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>` : empty('收件箱暂时没有资料');
    const knowledge = data.knowledge.length ? `<div class="sb-knowledge-cards">${data.knowledge.map((n,i) => `<button class="sb-knowledge-card" style="--tile-index:${i}" data-sb-open="${esc(n.path)}"><span class="sb-knowledge-top"><span class="sb-node-glyph">${icon('knowledge')}</span><span class="sb-content-chip">${esc(n.type ? typeLabel(n.type) : '知识笔记')}</span></span><b class="sb-knowledge-title">${esc(n.title)}</b><small class="sb-knowledge-date">${esc(n.updated ? `内容更新 ${n.updated}` : '内容更新日期未登记')}</small><span class="sb-knowledge-tags">${tags(n.tags)}</span><span class="sb-card-action">打开笔记 ↗</span></button>`).join('')}</div>` : empty('这里暂时没有知识笔记');
    const daily = data.daily.length ? `<div class="sb-daily-trail">${data.daily.map(n => {
      const date = typeof n.date === 'string' ? n.date : '';
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      return `<button class="sb-daily-entry" data-sb-open="${esc(n.path)}"><span class="sb-date-tile"><b>${match?match[3]:'—'}</b><small>${match?`${match[1]}-${match[2]}`:'日期未登记'}</small></span><span class="sb-daily-copy"><b>${esc(n.title)}</b><small>${esc(date || '记录日期未登记')}</small></span><span class="sb-daily-arrow" aria-hidden="true">↗</span></button>`;
    }).join('')}</div>` : empty('这里暂时没有每日记录');
    const tasks = '<div class="sb-task-console"><div class="sb-task-console-top"><span aria-hidden="true">● ● ●</span><b>行动清单</b></div><div class="sb-workspace-tasks"></div></div>';
    return `<div class="sb-workspace-grid sb-library-grid">${module('reading','继续阅读','READING ROOM',`${reading.length} 本在读`,books,`<button class="sb-workspace-source" data-sb-page="table">查看全部 ${view.state.notes.length} 本书籍 →</button>`)}${module('projects','项目入口','PROJECT PORTALS',`${count('projects')} 个入口`,projects,'<button class="sb-workspace-source" data-sb-page="projects">查看目标与后续节点 →</button>')}${module('inbox','收件箱资料','INBOX STUDIO',`${count('inbox')} 份资料`,inbox,'<p>最多显示最近修改的 5 份；保留在 Inbox 不代表尚未阅读。</p>')}${module('knowledge','最近更新的知识','KNOWLEDGE COLLECTION',`${count('knowledge')} 条笔记`,knowledge,'<p>按原笔记的内容更新日期排序，最多显示 5 条。</p>')}${module('daily','最近的每日记录','DAILY TRAIL',`${count('daily')} 篇记录`,daily,'<p>最近修改的 5 条记录；卡片日期取自原笔记，不从修改时间推算。</p>')}${module('tasks','明确记录的待办','ACTION DESK','TASKS',tasks,'<p>沿用首页现有的 Tasks 查询与任务工作流。</p>')}</div>`;
  };
  const hero = (view, data, reading, page) => {
    const nodes = (page === 'home' ? reading.slice(0,1).map(n => ({...n,kind:'正在阅读'})) : [])
      .concat(data.projects.slice(0,3).map(n => ({...n,title:n.panel?.title||n.title,kind:'项目入口'})));
    const focus = page === 'home' ? reading[0] : data.projects[0];
    return `<section class="sb-workspace-hero"><div class="sb-hero-copy"><span class="sb-hero-eyebrow">SECOND BRAIN · ${esc(view.app.vault.getName())}</span><h2>${page==='home'?'继续你的探索':'把想法推进一步'}</h2><p>${page==='home'?'从正在读的书，连接想弄懂的问题与正在推进的项目。':'让目标、原始记录与下一步，在同一片视野里相遇。'}</p>${focus?`<div class="sb-hero-focus"><small>${page==='home'?'正在阅读':'回到项目'}</small><b>${esc(focus.panel?.title||focus.title)}</b><small>${esc(page==='home'?text(focus.author):'查看目标、记录与后续节点')}</small></div><button class="sb-hero-continue" data-sb-open="${esc(focus.path)}">${page==='home'?'继续阅读':'打开项目'} <span>↗</span></button>`:source(page==='home'?HOME:PROJECTS,'打开原页面添加入口')}</div><div class="sb-hero-orbit" aria-label="知识与项目入口"><i class="sb-orbit-ring ring-a" aria-hidden="true"></i><i class="sb-orbit-ring ring-b" aria-hidden="true"></i><i class="sb-orbit-ring ring-c" aria-hidden="true"></i><div class="sb-orbit-core"><b>SB</b><small>Second Brain</small></div>${nodes.map((n,i)=>`<button class="sb-orbit-card" style="--node:${i}" data-sb-open="${esc(n.path)}" title="${esc(n.title)}"><small>${esc(n.kind)}</small><b>${esc(n.title)}</b><span aria-hidden="true">↗</span></button>`).join('')}${!nodes.length?'<span class="sb-orbit-empty">等待你的第一条真实记录</span>':''}</div></section>`;
  };

  proto.releaseSecondBrainWorkspace = function () {
    if (this.sbWorkspaceComponent) {
      this.removeChild(this.sbWorkspaceComponent);
      this.sbWorkspaceComponent = null;
    }
  };
  proto.stopSecondBrainReadingVisuals = function () {
    this.orbitRoot = null;
    window.cancelAnimationFrame(this.animation);
    window.cancelAnimationFrame(this.v14FluidFrame);
    this.stopFluid();
    this.v14FluidContexts?.forEach(gl => { try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch (_) {} });
    this.v14FluidContexts = [];
    this.v14FluidDraws = [];
  };
  proto.openSecondBrainSource = async function (target, sourcePath = HOME) {
    // A missing source is an error, not an invitation to create a new note.
    const path = String(target).split('#')[0];
    const file = this.app.vault.getAbstractFileByPath(path) || this.app.metadataCache.getFirstLinkpathDest?.(path, sourcePath);
    if (!file || file.extension !== 'md') { new Notice('原始笔记未找到，请检查现有入口。'); return false; }
    await this.app.workspace.openLinkText(target, sourcePath, true);
    return true;
  };
  proto.runSecondBrainAction = async function (action) {
    if (!action) return false;
    if (action.kind === 'wikilink') return this.openSecondBrainSource(action.target, HOME);
    let url;
    try { url = new URL(action.target); } catch (_) { return false; }
    if (url.protocol !== 'obsidian:') return false;
    if (url.hostname === 'quickadd') {
      const choice = url.searchParams.get('choice');
      const quickAdd = this.app.plugins?.getPlugin?.('quickadd') || this.app.plugins?.plugins?.quickadd;
      if (!choice || typeof quickAdd?.api?.executeChoice !== 'function') {
        new Notice('请启用已有 QuickAdd 入口后重试。'); return false;
      }
      try { await quickAdd.api.executeChoice(choice); return true; }
      catch (_) { new Notice('QuickAdd 入口执行失败，请检查原有配置。'); return false; }
    }
    if (url.hostname === 'search') {
      // Retain the note's existing query; always target the current vault.
      url.searchParams.set('vault', this.app.vault.getName());
      window.open(url.toString());
      return true;
    }
    return false;
  };
  proto.renderSecondBrainWorkspace = async function (data, page, generation) {
    this.releaseSecondBrainWorkspace();
    this.stopSecondBrainReadingVisuals();
    this.state.notes = this.notes();
    this.compactMode = this.isCompact();
    this.contentEl.empty();
    const shell = this.contentEl.createDiv({ cls: `ycs-app sb-workspace-shell${this.compactMode ? ' ycs-compact' : ''}` });
    const side = shell.createDiv({ cls: 'ycs-sidebar ycs-glass' });
    side.innerHTML = `<div class="ycs-brand"><b>SB</b><span>Second Brain</span></div><nav aria-label="驾驶舱页面"></nav><div class="ycs-workspace"><small>当前知识库</small><div>${esc(this.app.vault.getName())}</div><p><b></b><span>第二大脑<br><small>阅读与知识</small></span></p></div>`;
    const center = shell.createDiv({ cls: 'ycs-main-column' });
    const main = center.createEl('main', { cls: 'ycs-main sb-workspace-page' });
    const title = page === 'home' ? '第二大脑首页' : '项目总览';
    const description = page === 'home' ? '记录今天，继续阅读，回到正在推进的问题' : '从原始记录出发，查看目标、进展与下一步';
    const sourcePath = page === 'home' ? HOME : PROJECTS;
    main.innerHTML = `<header class="ycs-topbar"><div class="ycs-title"><h1>${title}</h1><p>${description}</p></div><div class="ycs-actions"><button class="ycs-icon" aria-label="外观设置">Aa</button><button class="ycs-pill" data-sb-open="${sourcePath}">打开原页面</button><button class="ycs-pill ycs-refresh">刷新数据</button></div></header>`;
    const body = main.createDiv({ cls: 'sb-workspace-body' });
    const errors = (data.errors || []).filter(e => page === 'home' || e.section === 'projects' || e.section === 'workspace');
    const count = section => errors.some(e => e.section === section || e.section === 'workspace' || (e.section === 'home' && ['inbox','knowledge','daily'].includes(section))) ? '—' : data.counts?.[section] ?? data[section]?.length ?? 0;
    const reading = this.state.notes.filter(n => n.reading === '在读');
    const metric = (index,label,value,caption,unit) => this.renderSecondBrainMetric?.(index,label,value,caption,unit) || stat(label,value,caption);
    if (page === 'home') {
      body.innerHTML = `<section class="ycs-stats sb-workspace-stats sb-fluid-stats">${metric(0,'正在阅读',reading.length,'来自书籍的阅读状态','本书')}${metric(1,'项目入口',count('projects'),'回到目标与下一步','个入口')}${metric(2,'收件箱资料',count('inbox'),'保留在 Inbox 的资料','份资料')}${metric(3,'知识节点',count('knowledge'),'已有知识笔记','条笔记')}</section><section class="sb-workspace-actions">${data.actions.filter(a => ['wikilink','quickadd','obsidian'].includes(a.kind)).map((a,i) => `<button data-sb-action="${i}"><b>${esc(a.label)}</b><small>${esc(a.description || '')}</small></button>`).join('')}</section>${hero(this,data,reading,page)}${lowerHome(this,data,reading,count)}`;
    } else {
      body.innerHTML = `<section class="ycs-stats sb-workspace-stats sb-project-stats sb-fluid-stats">${metric(0,'项目入口',count('projects'),'一个项目对应一个主入口','个入口')}${metric(1,'阅读书架',this.state.notes.length,'可随时回到阅读驾驶舱','本书')}</section>${hero(this,data,reading,page)}<p class="sb-workspace-caption">内容更新日期来自原笔记；项目进度、方案是否采纳及后续节点以原文为准。</p><section class="sb-project-grid">${data.projects.map((n,i) => `<article class="sb-project-card"><h2>${esc(n.panel?.title || n.title)}</h2><div class="sb-project-meta"><span>笔记更新 ${esc(n.updated || '未登记')}</span><span>${esc(text(n.tags))}</span></div><div class="sb-project-body" data-sb-project="${i}"></div><button class="sb-project-open" data-sb-open="${esc(n.path)}">打开项目原记录 ↗</button></article>`).join('') || empty('项目清单暂未配置入口，可打开原页面查看。')}</section>`;
    }
    if (errors.length) {
      const notices = main.createDiv({ cls: 'sb-workspace-errors' });
      notices.innerHTML = errors.map(e => `<p class="sb-workspace-error">${esc(e.message)} ${source(e.path || sourcePath, '查看对应来源')}</p>`).join('');
    }
    const foot = main.createEl('footer', { cls: 'sb-workspace-caption' });
    foot.innerHTML = `${source(sourcePath, '维护内容与入口：打开原页面')} · ${source('09_System/第二大脑可视化入口验收.md', '使用说明')}`;
    this.renderSecondBrainNavigation();
    this.installSecondBrainRoutes();
    this.applyDashboardFontScale();
    this.applyIdentityAppearance();
    this.installDailyEntry();
    this.bindV14Fluid?.(main);
    this.installFontSetting?.();
    main.querySelector('.ycs-refresh').onclick = () => void this.render();
    main.querySelectorAll('[data-sb-open]').forEach(b => b.onclick = () => void this.openSecondBrainSource(b.dataset.sbOpen, sourcePath));
    main.querySelectorAll('[data-sb-page]').forEach(b => b.onclick = () => void this.navigateSecondBrain(b.dataset.sbPage));
    const actions = data.actions.filter(a => ['wikilink','quickadd','obsidian'].includes(a.kind));
    main.querySelectorAll('[data-sb-action]').forEach(b => b.onclick = () => void this.runSecondBrainAction(actions[Number(b.dataset.sbAction)]));
    const component = this.addChild(new Component());
    this.sbWorkspaceComponent = component;
    const current = () => !this.sbWorkspaceClosed && this.sbWorkspaceGeneration === generation && this.state.page === page;
    for (const el of main.querySelectorAll('[data-sb-project]')) {
      if (!current()) return;
      const n = data.projects[Number(el.dataset.sbProject)];
      if (n.panel?.body) {
        await MarkdownRenderer.render(this.app, n.panel.body, el, n.panel.sourcePath || PROJECTS, component);
        if (!current()) return;
        el.querySelectorAll('a.internal-link').forEach(link => {
          link.onclick = event => {
            event.preventDefault(); event.stopPropagation();
            void this.openSecondBrainSource(link.dataset.href || link.getAttribute('href'), n.panel.sourcePath || PROJECTS);
          };
        });
      } else {
        el.textContent = '项目说明请查看原记录。';
      }
    }
    const tasks = main.querySelector('.sb-workspace-tasks');
    if (tasks && current()) {
      if (!data.tasksMarkdown) tasks.innerHTML = empty('首页暂未配置待办查询。');
      else if (!this.app.plugins?.getPlugin?.('obsidian-tasks-plugin') && !this.app.plugins?.plugins?.['obsidian-tasks-plugin']) tasks.innerHTML = empty('启用已有 Tasks 插件后，可在这里查看待办。');
      else await MarkdownRenderer.render(this.app, data.tasksMarkdown, tasks, HOME, component);
    }
  };

  const render = proto.render;
  proto.render = async function () {
    if (this.sbWorkspaceClosed) return;
    const generation = this.sbWorkspaceGeneration = (this.sbWorkspaceGeneration || 0) + 1;
    const page = this.state.page;
    if (!isWorkspace(page)) { this.releaseSecondBrainWorkspace(); return render.call(this); }
    let data;
    try { data = await this.loadSecondBrainWorkspace(); }
    catch (error) {
      console.warn('Second Brain workspace read failed.', error);
      data = { projects:[],inbox:[],knowledge:[],daily:[],actions:[],errors:[{section:'workspace',message:'页面数据读取失败，请刷新或打开原页面。',path:page==='home'?HOME:PROJECTS}] };
    }
    if (this.sbWorkspaceClosed || generation !== this.sbWorkspaceGeneration || this.state.page !== page) return;
    return this.renderSecondBrainWorkspace(data, page, generation);
  };
  const open = proto.onOpen;
  proto.onOpen = async function () {
    this.sbWorkspaceClosed = false;
    this.registerEvent(this.app.metadataCache.on('resolved', () => {
      if (isWorkspace(this.state.page)) this.deferRender();
    }));
    // .base files have no Markdown metadata event; preserve live updates to the whitelist.
    this.registerEvent(this.app.vault.on('modify', file => {
      if (file.path === '08_Projects/项目总览.base' || file.path === '02_Topics/首页动态视图.base') this.deferRender();
    }));
    return open.call(this);
  };
  const close = proto.onClose;
  proto.onClose = async function () {
    this.sbWorkspaceClosed = true;
    this.sbWorkspaceGeneration = (this.sbWorkspaceGeneration || 0) + 1;
    this.releaseSecondBrainWorkspace();
    return close.call(this);
  };
  const onload = PluginClass.prototype.onload;
  PluginClass.prototype.onload = async function () {
    await onload.call(this);
    this.addCommand({id:'open-second-brain-home',name:'打开第二大脑首页',callback:()=>void this.activateView('home')});
    this.addCommand({id:'open-projects-overview',name:'打开项目总览',callback:()=>void this.activateView('projects')});
  };
};
