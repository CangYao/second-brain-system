'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const upstream = fs.readFileSync(path.join(root, 'main.js'), 'utf8').split('// BEGIN SECOND BRAIN ADAPTERS')[0];
const installData = require('../second-brain-data.js').install;
const installReadingUi = require('../second-brain-ui.js');
const installWorkspaceUi = require('../second-brain-workspace-ui.js');
const HOME = '02_Topics/第二大脑首页.md';
const PROJECTS = '08_Projects/项目总览.md';
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const decode = text => String(text).replace(/&(?:amp|lt|gt|quot|#39);/g, token => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[token]));
const encode = text => String(text).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));

// Minimal DOM for the actual adapter. It parses inert elements and text only;
// no browser, network, script execution, or Markdown parsing is supplied.
class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.attrs = {}; this.dataset = {}; this.children = []; this.parentElement = null; this.style = {setProperty() {}}; }
  setAttribute(name, value) {
    this.attrs[name] = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attrs[name] ?? null; }
  get className() { return this.attrs.class || ''; }
  set className(value) { this.setAttribute('class', value); }
  get classList() {
    const owner = this;
    return {
      contains(name) { return owner.className.split(/\s+/).includes(name); },
      add(...names) { owner.className = [...new Set([...owner.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove(...names) { owner.className = owner.className.split(/\s+/).filter(n => !names.includes(n)).join(' '); },
      toggle(name, force) { const yes = force ?? !this.contains(name); yes ? this.add(name) : this.remove(name); return yes; },
    };
  }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  createEl(tag, options = {}) { const child = this.appendChild(new Element(tag)); if (options.cls) child.className = options.cls; if (options.text !== undefined) child.textContent = options.text; return child; }
  createDiv(options) { return this.createEl('div', options); }
  getContext(type) { assert.equal(this.tagName,'CANVAS'); (this.contextRequests ||= []).push(type); return null; }
  empty() { this.children.forEach(child => { if (typeof child !== 'string') child.parentElement = null; }); this.children = []; }
  remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null; }
  after(child) { assert.ok(this.parentElement); child.parentElement = this.parentElement; this.parentElement.children.splice(this.parentElement.children.indexOf(this) + 1, 0, child); }
  prepend(child) { child.parentElement = this; this.children.unshift(child); }
  get isConnected() { return this === this.ownerRoot || Boolean(this.parentElement?.isConnected); }
  get textContent() { return this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  set textContent(text) { this.empty(); this.children = [String(text)]; }
  get innerHTML() { return this.children.map(child => typeof child === 'string' ? encode(child) : child.outerHTML).join(''); }
  get outerHTML() { return `<${this.tagName.toLowerCase()}${Object.entries(this.attrs).map(([k,v]) => ` ${k}="${encode(v)}"`).join('')}>${this.innerHTML}</${this.tagName.toLowerCase()}>`; }
  set innerHTML(markup) {
    this.empty(); const stack = [this];
    for (const token of String(markup).match(/<!--[^]*?-->|<[^>]*>|[^<]+/g) || []) {
      if (token.startsWith('<!--')) continue;
      if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      if (token.startsWith('<')) {
        const match = token.match(/^<([\w-]+)/); if (!match) continue;
        const element = stack.at(-1).appendChild(new Element(match[1]));
        const attributes = token.slice(match[0].length).replace(/\/?\s*>$/, '');
        for (const attr of attributes.matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g)) element.setAttribute(attr[1], decode(attr[2] ?? attr[3] ?? attr[4] ?? ''));
        if (!/^(br|input|hr|img|meta|link)$/i.test(match[1]) && !token.endsWith('/>')) stack.push(element);
      } else stack.at(-1).children.push(decode(token));
    }
  }
  matches(selector) {
    const attr = selector.match(/\[([^=\]]+)(?:=["']?([^\]"']*)["']?)?\]/);
    if (attr && (!(attr[1] in this.attrs) || (attr[2] !== undefined && this.attrs[attr[1]] !== attr[2]))) return false;
    const rest = selector.replace(/\[[^\]]*\]/g, '');
    const tag = rest.match(/^[\w-]+/); if (tag && this.tagName !== tag[0].toUpperCase()) return false;
    return [...rest.matchAll(/\.([\w-]+)/g)].every(match => this.classList.contains(match[1]));
  }
  querySelectorAll(selector) {
    const results = [];
    const match = (node, parts) => {
      if (!node.matches(parts.at(-1))) return false;
      let parent = node.parentElement;
      for (let i = parts.length - 2; i >= 0; i--) { while (parent && !parent.matches(parts[i])) parent = parent.parentElement; if (!parent) return false; parent = parent.parentElement; }
      return true;
    };
    const alternatives = selector.split(',').map(item => item.trim().split(/\s+/));
    const visit = node => { for (const child of node.children) if (child instanceof Element) { if (alternatives.some(parts => match(child, parts))) results.push(child); visit(child); } };
    visit(this); return results;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function fixture() {
  return { projects:[{path:'08_Projects/Example.md', title:'Example project', tags:['fixture'], updated:'2026-10-30', panel:{title:'Project panel',body:'## Goal\nRead the original [[Example]].',sourcePath:PROJECTS}}], inbox:[],knowledge:[],daily:[],actions:[],tasksMarkdown:'',counts:{projects:1,inbox:0,knowledge:0,daily:0},errors:[] };
}

function harness() {
  const events = new Map(), timers = new Map(), notices = [], links = [], uris = [], markdown = [], commits = [], components = [], cancellations = [], entries = new Map(), metadata = new Map(), gpuBindings = [], gpuWarnings = [];
  let sequence = 0, writes = 0, reads = 0, legacyRenders = 0, renderGate;
  const windowMock = {
    setTimeout(callback) { const id = ++sequence; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    cancelAnimationFrame(id) { cancellations.push(id); }, requestAnimationFrame() { return ++sequence; },
    open(uri) { uris.push(uri); }, matchMedia: () => ({matches:false}),
  };
  const documentMock = {createElement: tag => new Element(tag), hidden:false};
  global.window = windowMock; global.document = documentMock;
  const on = prefix => (name, handler) => { const key = `${prefix}:${name}`; const rows = events.get(key) || []; rows.push(handler); events.set(key, rows); return {key,handler}; };
  const failWrite = async () => { writes++; throw new Error('Fixture forbids source writes'); };
  class TFile { constructor(p) { this.path=p; this.extension='md'; this.basename=p.split('/').at(-1).slice(0,-3); this.name=this.basename+'.md'; this.parent={name:'fixture'}; this.stat={mtime:1,ctime:1}; } }
  class Notice { constructor(message) { notices.push(message); } }
  class Component { constructor() { this.loaded=false; this.unloads=0; components.push(this); } load() { this.loaded=true; } unload() { this.loaded=false; this.unloads++; } }
  const app = {
    vault:{getName:()=> 'Fixture vault',getMarkdownFiles:()=>[...entries.values()],getAbstractFileByPath:p=>entries.get(p),on:on('vault'),create:failWrite,createFolder:failWrite,modify:failWrite,delete:failWrite},
    metadataCache:{on:on('metadata'),getFileCache:file=>({frontmatter:metadata.get(file.path)||{}}),getFirstLinkpathDest:(p)=>entries.get(p)},
    workspace:{on:on('workspace'),openLinkText:async(...args)=>{links.push(args);}},
    plugins:{plugins:{}},fileManager:{processFrontMatter:failWrite},
  };
  class ItemView {
    constructor() { this.app=app; this.contentEl=new Element(); this.contentEl.ownerRoot=this.contentEl; this.children=[]; }
    registerEvent() {} register() {}
    addChild(child) { this.children.push(child); child.load(); return child; }
    removeChild(child) { this.children.splice(this.children.indexOf(child),1); child.unload(); return child; }
  }
  class Plugin { constructor() { this.app=app; } async onload() {} }
  const fixtureConsole={...console,warn(...args){if(String(args[0]).includes('流体 WebGL 回退'))gpuWarnings.push(args);else console.warn(...args);}};
  const context={module:{exports:{}},require:id=>{assert.equal(id,'obsidian');return {ItemView,Plugin,TFile,Notice};},window:windowMock,document:documentMock,console:fixtureConsole,Date,URL};
  vm.runInNewContext(upstream+'\nglobalThis.subject={DashboardView,PluginClass:module.exports,esc,dateKey,localDate,fluidSettings};',context);
  const {DashboardView,PluginClass,esc,dateKey,localDate,fluidSettings}=context.subject;
  installData({DashboardView,PluginClass,TFile,Notice,dateKey,localDate});
  // Reading visuals are outside this suite. Preserve actual onOpen/onClose/event
  // methods, but provide an inert reading shell for the real navigation installer.
  DashboardView.prototype.render=async function(){legacyRenders++;this.contentEl.empty();const shell=this.contentEl.createDiv({cls:'ycs-app'});shell.createDiv({cls:'ycs-sidebar'}).createEl('nav');shell.createEl('header',{cls:'ycs-topbar'});this.state.notes=this.notes();};
  for(const method of ['applyDashboardFontScale','applyIdentityAppearance','installDailyEntry']) DashboardView.prototype[method]=function(){};
  DashboardView.prototype.isCompact=()=>false;
  // Exercise the real binding and settings hooks using real default settings.
  // Only canvas.getContext is mocked as unavailable: the upstream CSS fallback
  // must still initialize each card, bind appearance controls and schedule RAF.
  const bindFluid=DashboardView.prototype.bindV14Fluid;
  DashboardView.prototype.bindV14Fluid=function(element){
    const cards=element.querySelectorAll('[data-fluid-card]');
    gpuBindings.push({element,cards});
    return bindFluid.call(this,element);
  };
  installReadingUi({DashboardView,esc,dateKey,localDate});
  const MarkdownRenderer={async render(appArg,md,el,sourcePath,component){assert.equal(appArg,app);markdown.push({md,el,sourcePath,component});if(renderGate)await renderGate.promise;el.createEl('pre',{text:md});}};
  installWorkspaceUi({DashboardView,PluginClass,MarkdownRenderer,Component,Notice,esc});
  const plugin=new PluginClass();plugin.dashboardSettings={};plugin.fluidSettings=fluidSettings();
  const view=new DashboardView({},plugin);view.state.page='home';
  let data=fixture();view.loadSecondBrainWorkspace=async()=>{reads++;return data;};
  const renderWorkspace=view.renderSecondBrainWorkspace;
  view.renderSecondBrainWorkspace=async function(...args){commits.push(args[1]);return renderWorkspace.apply(this,args);};
  return {view,app,events,timers,notices,links,uris,markdown,commits,components,cancellations,entries,gpuBindings,gpuWarnings,
    setData(value){data=value;},setRenderGate(value){renderGate=value;},
    add(p,fields={}){const file=new TFile(p);entries.set(p,file);metadata.set(p,fields);return file;},
    emit(name,...args){for(const handler of events.get(name)||[])handler(...args);},
    async flush(){const jobs=[...timers.values()];timers.clear();for(const job of jobs)job();await tick();},
    stats:()=>({writes,reads,legacyRenders})};
}

test('home/project navigation remains inside the cockpit in both navigation bars',async()=>{
  const h=harness();await h.view.render();
  h.view.contentEl.querySelector('[data-view="projects"]').onclick();await tick();
  assert.equal(h.view.state.page,'projects');assert.equal(h.view.contentEl.querySelector('h1').textContent,'项目总览');
  h.view.contentEl.querySelector('[data-page="home"]').onclick();await tick();
  assert.equal(h.view.state.page,'home');
  h.view.contentEl.querySelector('[data-view="table"]').onclick();await tick();
  assert.equal(h.view.state.page,'table');assert.equal(h.stats().legacyRenders,1);
  assert.deepEqual(h.links,[]);assert.equal(h.stats().writes,0);
});

test('metadata, metadata readiness and relevant Base changes refresh the current page',async()=>{
  const h=harness();await h.view.onOpen();
  const before=h.stats().reads;
  h.emit('metadata:changed',h.add('08_Projects/Example.md'));await h.flush();
  assert.equal(h.stats().reads,before+1);assert.equal(h.view.state.page,'home');
  h.emit('metadata:resolved');await h.flush();assert.equal(h.stats().reads,before+2);
  h.emit('vault:modify',{path:'08_Projects/项目总览.base'});await h.flush();assert.equal(h.stats().reads,before+3);
  h.emit('vault:modify',{path:'unrelated.base'});await h.flush();assert.equal(h.stats().reads,before+3);
  h.emit('vault:create',h.add('00_Inbox/New.md'));await h.flush();assert.equal(h.stats().reads,before+4);
  assert.equal(h.stats().writes,0);
});

test('late home data cannot replace a newer project page',async()=>{
  const h=harness(),old=deferred();let calls=0;
  h.view.loadSecondBrainWorkspace=()=>++calls===1?old.promise:Promise.resolve(fixture());
  const pending=h.view.render();await h.view.navigateSecondBrain('projects');
  const html=h.view.contentEl.innerHTML;old.resolve(fixture());await pending;
  assert.equal(h.view.contentEl.innerHTML,html);assert.deepEqual(h.commits,['projects']);
});

test('close invalidates pending reads and subsequent queued metadata rendering',async()=>{
  const h=harness();await h.view.onOpen();const old=deferred();
  h.view.loadSecondBrainWorkspace=()=>old.promise;
  const pending=h.view.render();await h.view.onClose();old.resolve(fixture());await pending;
  const commits=h.commits.length;
  h.emit('metadata:changed',h.add('08_Projects/AfterClose.md'));await h.flush();
  assert.equal(h.commits.length,commits);assert.equal(h.view.sbWorkspaceClosed,true);assert.equal(h.view.children.length,0);
});

test('closing an in-flight Markdown render unloads its component and stops subsequent cards',async()=>{
  const h=harness(),gate=deferred(),data=fixture();data.projects.push({...data.projects[0],path:'08_Projects/Second.md'});
  h.setData(data);h.setRenderGate(gate);h.view.state.page='projects';const pending=h.view.render();await tick();
  assert.equal(h.markdown.length,1);const component=h.markdown[0].component;
  await h.view.onClose();gate.resolve();await pending;
  assert.equal(h.markdown.length,1);assert.equal(component.loaded,false);assert.equal(component.unloads,1);
});

test('switching from reading releases orbit, fluid frames, observers and WebGL resources',async()=>{
  const h=harness();let lost=0,disconnected=0;
  h.view.animation=101;h.view.v14FluidFrame=102;h.view.flowFrames=[103];h.view.fluidObservers=[{disconnect(){disconnected++;}}];
  h.view.v14FluidContexts=[{getExtension(name){assert.equal(name,'WEBGL_lose_context');return {loseContext(){lost++;}};}}];h.view.v14FluidDraws=[()=>{}];
  await h.view.render();
  assert.ok([101,102,103].every(id=>h.cancellations.includes(id)));assert.equal(lost,1);assert.equal(disconnected,1);
  assert.equal(h.view.orbitRoot,null);assert.equal(h.view.v14FluidContexts.length,0);assert.equal(h.view.v14FluidDraws.length,0);
});

test('quick actions use existing QuickAdd, reject unsafe URLs and never create a fallback note',async()=>{
  const h=harness(),action={kind:'quickadd',target:'obsidian://quickadd?choice=Existing%20Choice'},choices=[];
  assert.equal(await h.view.runSecondBrainAction(action),false);
  h.app.plugins.plugins.quickadd={api:{executeChoice:async choice=>{choices.push(choice);}}};
  assert.equal(await h.view.runSecondBrainAction(action),true);assert.deepEqual(choices,['Existing Choice']);
  h.app.plugins.plugins.quickadd.api.executeChoice=async()=>{throw new Error('Fixture failure');};
  assert.equal(await h.view.runSecondBrainAction(action),false);
  for(const target of ['javascript:alert(1)','data:text/html,<script>1</script>','https://example.org','obsidian://open?file=New','invalid']) assert.equal(await h.view.runSecondBrainAction({kind:'obsidian',target}),false);
  assert.equal(await h.view.openSecondBrainSource('Missing.md'),false);
  assert.equal(await h.view.openSecondBrainSource('javascript:alert(1)'),false);
  assert.deepEqual(h.links,[]);assert.deepEqual(h.uris,[]);assert.equal(h.stats().writes,0);
  assert.equal(await h.view.runSecondBrainAction({kind:'obsidian',target:'obsidian://search?query=tag%3Aproject&vault=Other'}),true);
  const search=new URL(h.uris[0]);assert.equal(search.searchParams.get('vault'),'Fixture vault');assert.equal(search.searchParams.get('query'),'tag:project');
});

test('titles, metadata and actions are inert HTML while Markdown rendering retains its source',async()=>{
  const h=harness(),data=fixture(),malicious='<img src=x onerror="alert(1)"><script>1</script>';
  data.projects[0].title=malicious;data.projects[0].panel.title=malicious;data.projects[0].tags=[malicious];
  data.actions=[{kind:'wikilink',target:'01_Knowledge/Existing.md',label:malicious,description:malicious}];
  data.tasksMarkdown='```tasks\nnot done\n```';h.app.plugins.plugins['obsidian-tasks-plugin']={};h.setData(data);
  h.add('01_Knowledge/Existing.md');h.add('08_Projects/Example.md');
  await h.view.render();assert.equal(h.view.contentEl.querySelector('img'),null);assert.equal(h.view.contentEl.querySelector('script'),null);
  assert.ok(h.view.contentEl.textContent.includes(malicious));assert.equal(h.markdown[0].sourcePath,HOME);
  h.view.contentEl.querySelector('[data-sb-action="0"]').onclick();await tick();
  assert.deepEqual(h.links[0],['01_Knowledge/Existing.md',HOME,true]);
  await h.view.navigateSecondBrain('projects');
  assert.equal(h.markdown.at(-1).sourcePath,PROJECTS);assert.equal(h.markdown.at(-1).md,data.projects[0].panel.body);
  assert.equal(h.view.contentEl.querySelector('img'),null);assert.equal(h.view.contentEl.querySelector('script'),null);
  h.view.contentEl.querySelector('[data-sb-open="08_Projects/Example.md"]').onclick();await tick();
  assert.deepEqual(h.links.at(-1),['08_Projects/Example.md',PROJECTS,true]);assert.equal(h.stats().writes,0);
});

test('a stale Markdown component is released on navigation without replacing the new page',async()=>{
  const h=harness(),gate=deferred();h.setRenderGate(gate);h.view.state.page='projects';const pending=h.view.render();await tick();
  const old=h.markdown[0];h.setRenderGate(null);await h.view.navigateSecondBrain('home');const html=h.view.contentEl.innerHTML;
  gate.resolve();await pending;
  assert.equal(old.component.loaded,false);assert.equal(old.el.isConnected,false);assert.equal(h.view.contentEl.innerHTML,html);
});

test('workspace metric cards retain upstream fluid binding and show their own data, not book mappings',async()=>{
  const h=harness(),data=fixture();data.counts={projects:4,inbox:9,knowledge:13,daily:0};h.setData(data);
  h.add('03_Books/Nonfiction/Reading-A.md',{type:'book',id:'book_a',title:'Reading A',status:'reading'});
  h.add('03_Books/Nonfiction/Reading-B.md',{type:'book',id:'book_b',title:'Reading B',status:'reading'});
  h.add('03_Books/Fiction/Completed.md',{type:'book',id:'book_c',title:'Completed',status:'completed'});
  await h.view.render();
  assert.equal(h.gpuBindings.length,1);
  const cards=h.gpuBindings[0].cards;
  assert.deepEqual(cards.map(card=>card.dataset.fluidCard),['today','unread','read','backlog']);
  assert.deepEqual(cards.map(card=>[card.querySelector('.ycs-stat-title').textContent,card.querySelector('.ycs-stat-value').textContent,card.querySelector('.ycs-stat-unit').textContent]),[
    ['正在阅读','2','本书'],['项目入口','4','个入口'],['收件箱资料','9','份资料'],['知识节点','13','条笔记']
  ]);
  for(const card of cards){assert.deepEqual(card.querySelector('canvas').contextRequests,['webgl']);assert.equal(card.classList.contains('is-fallback'),true);}
  assert.equal(h.gpuWarnings.length,4);assert.equal(typeof h.view.contentEl.querySelector('.ycs-actions .ycs-icon').onclick,'function');
  assert.equal(h.view.contentEl.querySelector('.ycs-actions .ycs-icon').dataset.ycsFontSettingBound,'true');
  await h.view.navigateSecondBrain('projects');
  assert.deepEqual(h.gpuBindings.at(-1).cards.map(card=>[card.dataset.fluidCard,card.querySelector('.ycs-stat-value').textContent]),[['today','4'],['unread','3']]);
  assert.equal(h.stats().writes,0);
});

test('hero nodes and continue actions use current book/project records without invented progress',async()=>{
  const h=harness(),data=fixture();
  data.projects=Array.from({length:4},(_,i)=>({path:`08_Projects/P${i}.md`,title:`Project ${i}`,tags:[],panel:{title:`Panel ${i}`,body:`Project body ${i}`,sourcePath:PROJECTS}}));
  data.counts.projects=4;h.setData(data);
  const reading=h.add('03_Books/Nonfiction/Current.md',{type:'book',id:'book_current',title:'Current book',author:['Author A'],status:'reading'});
  h.add('03_Books/Nonfiction/Next.md',{type:'book',id:'book_next',title:'Another reading book',status:'reading'});
  h.add('03_Books/Fiction/Done.md',{type:'book',id:'book_done',title:'Completed book',status:'completed'});
  for(const project of data.projects)h.add(project.path);
  await h.view.render();
  let hero=h.view.contentEl.querySelector('.sb-workspace-hero');
  assert.deepEqual(hero.querySelectorAll('.sb-orbit-card').map(card=>card.dataset.sbOpen),[reading.path,...data.projects.slice(0,3).map(p=>p.path)]);
  assert.deepEqual(hero.querySelectorAll('.sb-orbit-card b').map(el=>el.textContent),['Current book','Panel 0','Panel 1','Panel 2']);
  assert.equal(hero.querySelector('.sb-hero-focus b').textContent,'Current book');
  assert.ok(hero.textContent.includes('Author A'));assert.doesNotMatch(hero.textContent,/\d+(?:\.\d+)?\s*%|完成率|预计完成/);
  assert.equal(hero.querySelector('progress'),null);assert.equal(hero.querySelector('[role="progressbar"]'),null);
  hero.querySelector('.sb-hero-continue').onclick();await tick();assert.deepEqual(h.links.at(-1),[reading.path,HOME,true]);
  await h.view.navigateSecondBrain('projects');hero=h.view.contentEl.querySelector('.sb-workspace-hero');
  assert.deepEqual(hero.querySelectorAll('.sb-orbit-card').map(card=>card.dataset.sbOpen),data.projects.slice(0,3).map(p=>p.path));
  assert.equal(hero.querySelector('.sb-hero-focus b').textContent,'Panel 0');
  hero.querySelector('.sb-hero-continue').onclick();await tick();assert.deepEqual(h.links.at(-1),[data.projects[0].path,PROJECTS,true]);
  assert.equal(h.stats().writes,0);
});

test('empty home and project views keep zero metrics and show no invented hero nodes',async()=>{
  const h=harness(),data=fixture();data.projects=[];data.counts.projects=0;h.setData(data);h.add(HOME);h.add(PROJECTS);
  for(const page of ['home','projects']){
    await h.view.navigateSecondBrain(page);
    const hero=h.view.contentEl.querySelector('.sb-workspace-hero');
    assert.equal(hero.querySelectorAll('.sb-orbit-card').length,0);assert.equal(hero.querySelector('.sb-hero-continue'),null);
    assert.match(hero.querySelector('.sb-orbit-empty').textContent,/第一条真实记录/);
    assert.ok(h.gpuBindings.at(-1).cards.every(card=>card.querySelector('.ycs-stat-value').textContent==='0'));
    const existingPage=page==='home'?HOME:PROJECTS;
    hero.querySelector('[data-sb-open]').onclick();await tick();assert.deepEqual(h.links.at(-1),[existingPage,existingPage,true]);
  }
  assert.equal(h.stats().writes,0);
});
