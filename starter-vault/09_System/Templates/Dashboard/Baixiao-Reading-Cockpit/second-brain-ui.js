// Second Brain customization of Baixiao Reading Cockpit (MIT, YCS).
// Retains upstream fluid cards, orbit, settings, responsive shell and interactions.
module.exports = function install({ DashboardView, esc, dateKey, localDate }) {
  const proto = DashboardView.prototype;
  // Keep functional open buttons and the orbit's true paused/running label.
  proto.stripDashboardDecorations = function () {};
  const statuses = ['计划阅读', '在读', '暂停', '已读'];
  const text = value => Array.isArray(value) ? value.join(' · ') : String(value ?? '');
  const open = (view, path) => view.app.workspace.openLinkText(path, '', true);
  const routePaths = {
    home: '02_Topics/第二大脑首页.md',
    projects: '08_Projects/项目总览.md',
    shelf: '03_Books/阅读书架.md'
  };
  proto.scopedNotes = function () {
    let notes = this.state.notes;
    if (this.state.folderFilter) notes = notes.filter(n => n.rootFolder === this.state.folderFilter);
    const filters = { reading:'在读', completed:'已读', unknown:'未登记', planned:'计划阅读', paused:'暂停' };
    if (filters[this.state.filter]) notes = notes.filter(n => n.reading === filters[this.state.filter]);
    if (this.state.filter === 'today') notes = notes.filter(n => n.createdFromFrontmatter && n.created === localDate());
    return notes;
  };
  proto.folders = function () {
    const groups = new Map();
    for (const n of this.state.notes) {
      const item = groups.get(n.rootFolder) || { name:n.rootFolder, total:0, unread:0 };
      item.total++; item.unread += n.reading === '计划阅读' ? 1 : 0; groups.set(n.rootFolder, item);
    }
    return [...groups.values()];
  };
  const stat = proto.stat;
  proto.stat = function (label, value, caption, icon, slim) {
    const notes = this.state.notes;
    const mappings = {
      '今日新增':['书架总览', notes.length, '已登记的真实书籍'],
      '未读库存':['正在阅读', notes.filter(n=>n.reading==='在读').length, '明确标记为在读'],
      '已经阅读':['已经读完', notes.filter(n=>n.reading==='已读').length, '明确标记为已读'],
      '长期未读':['状态未登记', notes.filter(n=>n.reading==='未登记').length, '保留空缺，等待自行登记']
    };
    const info = mappings[label];
    if (!info) return stat.call(this,label,value,caption,icon,slim);
    // Preserve the upstream fluid-card identifiers and palette selection.
    return stat.call(this,label,info[1],info[2],icon,slim).replace(`>${label}<`,`>${info[0]}<`).replace('篇笔记','本书');
  };
  const selectMarkup = n => `<select aria-label="${esc(n.title)}的阅读状态" data-path="${esc(n.path)}" data-field="status">${statuses.includes(n.reading) ? '' : `<option value="" selected disabled>${esc(n.reading)}</option>`}${statuses.map(s=>`<option value="${s}" ${s===n.reading?'selected':''}>${s}</option>`).join('')}</select>`;
  const queueMarkup = notes => notes.map(n=>`<button class="ycs-queue-note" data-open="${esc(n.path)}"><span>${esc(n.title)}</span><em>${esc(n.reading)}</em><small>${esc(text(n.author)||n.category||'书籍')}</small></button>`).join('');
  proto.installSecondBrainRoutes = function () {
    const parent = this.contentEl.querySelector('.ycs-topbar,.ycs-compact-head');
    if (!parent || this.contentEl.querySelector('.ycs-sb-routes')) return;
    const routes = document.createElement('nav'); routes.className='ycs-sb-routes'; routes.setAttribute('aria-label','第二大脑导航');
    routes.innerHTML='<button data-view="dashboard">阅读驾驶舱</button><button data-view="table">阅读书架</button><button data-route="projects">项目总览</button><button data-route="home">第二大脑首页</button><button data-route="shelf">书籍笔记视图</button>';
    parent.after(routes);
    routes.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',this.state.page===b.dataset.view);b.onclick=()=>{this.state.page=b.dataset.view;this.state.filter='all';void this.render();};});
    routes.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>void open(this,routePaths[b.dataset.route]));
    const search=document.createElement('label');search.className='ycs-search ycs-sb-search';
    search.innerHTML='<input type="search" aria-label="搜索书架" placeholder="搜索书名、作者或标签…">';routes.appendChild(search);
    this.bindSearch(this.contentEl);
  };
  const renderDashboard = proto.renderDashboard;
  proto.renderDashboard = function (root,...args) {
    renderDashboard.call(this,root,...args);
    root.querySelector('.ycs-title h1').textContent='阅读驾驶舱';
    root.querySelector('.ycs-title p').textContent='回到正在读的书，连接项目与长期知识';
    const notes=this.scopedNotes();
    const groups=this.state.filter==='all'
      ? [['正在阅读',notes.filter(n=>n.reading==='在读'),'blue'],['已读书籍',notes.filter(n=>n.reading==='已读'),'green'],['待登记与计划',notes.filter(n=>!['在读','已读'].includes(n.reading)),'purple']]
      : [['当前阅读队列',notes,'blue']];
    const queue=root.querySelector('.ycs-queue');
    queue.innerHTML=`<div class="ycs-section-head"><b>阅读队列</b><span>${notes.length} 本书</span></div>${groups.map(([label,rows,color])=>`<div class="ycs-group"><div class="ycs-group-head"><i class="ycs-group-dot ${color}"></i>${label}<span>${rows.length}</span></div>${queueMarkup(rows)||'<div class="ycs-empty">暂无书籍</div>'}</div>`).join('')}`;
    this.bindQueueNotes(queue,true);
    const refresh=root.querySelector('.ycs-refresh');
    refresh.textContent='刷新数据'; refresh.onclick=()=>void this.render();
    this.bindSearch(root);
    root.querySelectorAll('.ycs-doc-card small').forEach(el=>{el.textContent=el.textContent.replace('篇','本').replace('未读','计划');});
    root.querySelectorAll('.ycs-doc-card b').forEach(el=>{el.textContent=el.textContent.replace('03_Books/Nonfiction','非虚构').replace('03_Books/Fiction','小说与文学');});
  };
  proto.bindSearch = function (root) {
    const input=root.querySelector('.ycs-search input'); if(!input) return;
    input.placeholder='搜索书名、作者或标签…';
    root.querySelector('.ycs-search kbd')?.remove();
    input.oninput=()=>{const q=input.value.trim().toLocaleLowerCase();root.querySelectorAll('.ycs-queue-note,.ycs-table tbody tr').forEach(b=>{const path=b.dataset.open||b.querySelector('[data-detail]')?.dataset.detail;const n=this.state.notes.find(n=>n.path===path);b.hidden=!`${n?.title} ${text(n?.author)} ${text(n?.tags)}`.toLocaleLowerCase().includes(q);});};
  };
  proto.renderDetail = function (root) {
    const n=this.active(); if(!n){root.innerHTML='<div class="ycs-empty">书架暂无记录</div>';return;}
    const links=values=>(Array.isArray(values)?values:[]).map(v=>{
      const s=String(v);const wiki=s.match(/^\[\[([^\]]+)\]\]$/);
      if(wiki){const [path,label]=wiki[1].split('|');return `<button class="ycs-sb-link" data-note="${esc(path)}">${esc(label||path.split('/').pop())}</button>`;}
      if(/^https?:\/\//i.test(s))return `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(s)}</a>`;
      return `<span>${esc(s)}</span>`;
    }).join('');
    root.innerHTML=`<div class="ycs-right-head"><span>书籍详情</span></div><div class="ycs-detail-id">${esc(n.path)}</div><div class="ycs-detail-title">${esc(n.title)}</div><div class="ycs-detail-grid"><span>作者</span><b>${esc(text(n.author)||'未登记')}</b><span>分类</span><b>${esc(n.category||'未登记')}</b><span>阅读状态</span>${selectMarkup(n)}<span>建档日期</span><b>${esc(n.created||'未登记')}</b><span>笔记更新</span><b>${esc(n.updated||'未登记')}</b></div><div class="ycs-detail-context"><div><span>标签</span><b>${esc(text(n.tags)||'—')}</b></div></div><section class="ycs-sb-sources"><h4>来源</h4>${links(n.sources)||'<span>未登记</span>'}<h4>关联笔记</h4>${links(n.relations)||'<span>暂无关联</span>'}</section><div class="ycs-right-actions"><button class="ycs-open">打开阅读笔记</button></div>`;
    this.bindSelects(root);
    root.querySelector('.ycs-open').onclick=()=>void open(this,n.path);
    root.querySelectorAll('[data-note]').forEach(b=>b.onclick=()=>void open(this,b.dataset.note));
  };
  proto.renderCompactDetail = function (root) {
    const n=this.active();if(!n){root.innerHTML='<div class="ycs-empty">暂无书籍</div>';return;}
    root.innerHTML=`<div class="ycs-compact-detail-bar"><div class="ycs-compact-detail-title">${esc(n.title)}</div>${selectMarkup(n)}<button class="ycs-open">打开笔记</button></div>`;
    this.bindSelects(root);root.querySelector('.ycs-open').onclick=()=>void open(this,n.path);
  };
  proto.renderTable = function (root) {
    const notes=this.scopedNotes();
    root.innerHTML=`<section class="ycs-table ycs-glass"><div class="ycs-table-top"><div><h2>阅读书架</h2><p>${notes.length} 本真实书籍 · 未登记不等于未读</p></div><button class="ycs-table-filter">切换分类</button></div><div class="ycs-table-wrap"><table><thead><tr><th>书籍</th><th>作者</th><th>分类</th><th>阅读状态</th><th>笔记更新</th><th>操作</th></tr></thead><tbody>${notes.map(n=>`<tr><td><button data-detail="${esc(n.path)}">${esc(n.title)}</button></td><td>${esc(text(n.author))}</td><td>${esc(n.category)}</td><td>${selectMarkup(n)}</td><td>${esc(n.updated||'—')}</td><td><button data-open="${esc(n.path)}">打开</button></td></tr>`).join('')||'<tr><td colspan="6">当前没有书籍记录</td></tr>'}</tbody></table></div></section>`;
    this.bindSelects(root);root.querySelector('.ycs-table-filter').onclick=()=>this.cycleFolderFilter();
    root.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>this.select(b.dataset.detail));
    root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>void open(this,b.dataset.open));
    const heading=document.createElement('header');heading.className='ycs-topbar';heading.innerHTML='<div class="ycs-title"><h1>阅读书架</h1><p>查看原始笔记，记录真实阅读状态</p></div>';root.prepend(heading);
  };
  const renderCompact=proto.renderCompact;
  proto.renderCompact=function(root,...args){
    renderCompact.call(this,root,...args);
    const title=root.querySelector('.ycs-compact-head b');if(title)title.textContent='阅读驾驶舱';
    const foot=root.querySelector('.ycs-compact-foot');if(foot)foot.textContent=`书架 ${this.state.notes.length} 本 · 在原笔记中保留阅读理解`;
    if(this.state.page==='table')this.renderTable(root.querySelector('.ycs-compact-queue'));
  };
  proto.renderAnnualReadingTimeline=function(){
    const timeline=this.contentEl.querySelector('.ycs-timeline');if(!timeline)return;
    const today=new Date();const days=[];
    for(let i=364;i>=0;i--){const d=new Date(today);d.setDate(today.getDate()-i);days.push(dateKey(d));}
    const counts=new Map(days.map(d=>[d,0]));
    this.state.notes.forEach(n=>{if(n.createdFromFrontmatter&&counts.has(n.created))counts.set(n.created,counts.get(n.created)+1);});
    const max=Math.max(1,...counts.values());
    timeline.innerHTML=`<div class="ycs-annual-head"><div><b>书籍建档热力</b><small>近一年 · 按笔记建档日期记录</small></div><time>${localDate()}</time></div><div class="ycs-annual-stock">当前书架 ${this.state.notes.length} 本；建档活动不表示阅读时长或读完日期。</div><div class="ycs-annual-body heat-only"><section class="ycs-heat"><div class="ycs-heat-scroll"><div class="ycs-heat-grid">${days.map(date=>`<button type="button" class="ycs-heat-cell ${date===localDate()?'is-today':''}" style="--ycs-added:${counts.get(date)/max};--ycs-read:0" title="${date}：建档 ${counts.get(date)} 本" aria-label="${date}：建档 ${counts.get(date)} 本"></button>`).join('')}</div></div><div class="ycs-heat-months"><span>${days[0]}</span><span>${days[364]}</span></div></section></div>`;
  };
  const render=proto.render;
  proto.render=async function(){
    if(!this.state.active)this.state.active=this.notes().find(n=>n.reading==='在读')?.path||'';
    await render.call(this);
    const sidebar=this.contentEl.querySelector('.ycs-sidebar nav');
    if(sidebar){sidebar.innerHTML=[['阅读驾驶舱','dashboard','all'],['阅读书架','table','all'],['正在阅读','dashboard','reading'],['状态未登记','dashboard','unknown']].map(([label,page,filter])=>`<button data-page="${page}" data-filter="${filter}" class="${this.state.page===page&&this.state.filter===filter?'active':''}">${label}<em>›</em></button>`).join('')+'<button data-route="projects">项目总览<em>↗</em></button><button data-route="home">第二大脑首页<em>↗</em></button>';
      sidebar.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{this.state.page=b.dataset.page;this.state.filter=b.dataset.filter;void this.render();});
      sidebar.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>void open(this,routePaths[b.dataset.route]));
    }
    const progress=this.contentEl.querySelector('.ycs-progress');
    if(progress){const label=[...progress.children].find(el=>el.tagName==='DIV'&&!el.classList.contains('ycs-progress-controls'));if(label)label.textContent='已读占比';const small=progress.querySelector('small');if(small)small.textContent=`已读 / ${this.state.notes.length} 本（含未登记）`;}
    this.installSecondBrainRoutes();
  };
  const close=proto.onClose;
  proto.onClose=async function(){window.clearTimeout(this.timer);window.clearTimeout(this.newNoteTimer);window.clearTimeout(this.orbitCardSaveTimer);window.clearTimeout(this.orbitViewSaveTimer);return close.call(this);};
};
