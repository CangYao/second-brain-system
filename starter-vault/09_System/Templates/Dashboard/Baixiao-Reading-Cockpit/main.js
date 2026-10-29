const { Plugin, ItemView, Notice, TFile } = require("obsidian");

const VIEW_TYPE = "ycs-reading-dashboard-view";
const READING = ["未读", "在读", "已读"], ABSORPTION = ["待沉淀", "已沉淀", "无需沉淀"];
const EXCLUDES = new Set([".obsidian", ".git", ".trash", ".venv", "node_modules", "阅读吸收驾驶舱", ".claude", ".claudian", ".workbuddy", ".verysync", ".stfolder", "_System 系统", "_Templates 模板", "_Assets 附件", "阅读吸收报告", "MOC 地图", "hooks", "memory", "rules", "skills", "subagent", "reports"]);
const EXCLUDED_FILES = new Set(["AGENTS.md", "CLAUDE.md", "VERIFICATION_REPORT.md", "协作看板.md", "交接记录.md", "变更日志.md"]);
const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[x]));
const localDate = () => { const n = new Date(); return new Date(n - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
// frontmatter 日期可能是字符串、YAML Date 或时间戳；统一成 YYYY-MM-DD，避免时区和 Date.toString() 造成统计错位。
const dateKey = (value, fallbackMs) => {
  let date = null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) date = value;
  else if (typeof value === "string") {
    const matched = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matched) return matched[1];
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) date = parsed;
  } else if (typeof value === "number" && Number.isFinite(value)) {
    date = new Date(value < 1e11 ? value * 1000 : value);
  }
  if (!date && Number.isFinite(fallbackMs)) date = new Date(fallbackMs);
  return date && !Number.isNaN(date.valueOf()) ? new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : "";
};
const dateText = (value) => dateKey(value) || "—";
const isToday = (value) => dateKey(value) === localDate();
// “今日新增”只能相信笔记自身 frontmatter 的创建日期。文件扫描、状态回写都会改变文件时间，不能拿它作为入库日期。
const isTodayAdded = (note) => Boolean(note?.createdFromFrontmatter) && isToday(note.created);
const isOlderThan = (value, days) => {
  const key = dateKey(value);
  if (!key) return false;
  const date = new Date(`${key}T12:00:00`);
  return Number.isFinite(date.valueOf()) && Date.now() - date.valueOf() >= days * 86400000;
};
const isManaged = (f) => f instanceof TFile && f.extension === "md" && !EXCLUDED_FILES.has(f.name) && !f.path.split("/").some((p) => EXCLUDES.has(p));
const FLUID_PRESETS = { cyan: { a: "#00e7d2", b: "#3cc8ff", c: "#075f68" }, original: { a: "#ff3aa7", b: "#ff8050", c: "#a443ff" }, klein: { a: "#3158ff", b: "#ff6531", c: "#20252e" }, chrome: { a: "#eef2f3", b: "#6c7780", c: "#11171d" } };
const FLUID_DEFAULTS = { quality: "high", interaction: true, cards: { today: { preset: "chrome", ...FLUID_PRESETS.chrome, speed: 1.92, intensity: 1.6, pointer: 1.5, surface: .86, seed: 1.7 }, unread: { preset: "custom", a: "#00e7d2", b: "#3cc8ff", c: "#096907", speed: .84, intensity: 1.08, pointer: .8, surface: .08, seed: 4.9 }, read: { preset: "custom", a: "#3158ff", b: "#36ff33", c: "#20252e", speed: .76, intensity: .98, pointer: .72, surface: .08, seed: 8.4 }, backlog: { preset: "original", ...FLUID_PRESETS.original, speed: .75, intensity: 1.05, pointer: .86, surface: .08, seed: 12.1 } } };
const IDENTITY_DEFAULTS = { brandMark: "YCS", brandName: "Knowledge OS", avatarText: "DY", displayName: "大Y", role: "知识库管理员" };
const DASHBOARD_DEFAULTS = { statLayout: "single-row", fontScale: 1.15, orbitCard: { width: 87, height: 132, offset: 82 }, orbitView: { r: 55.45340963580384, x: -5.910746807611419, zoom: .72, radius: 190, auto: false, speed: 1, flat: false } };
const fluidClone = (value) => JSON.parse(JSON.stringify(value));
const fluidClamp = (n, min, max) => Math.min(max, Math.max(min, n));
const orbitAngle = (value, fallback = -24) => { const n = Number(value); return Number.isFinite(n) ? ((n + 180) % 360 + 360) % 360 - 180 : fallback; };
const fluidHex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || "") ? value.toLowerCase() : fallback;
const fluidRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const boundedText = (value, fallback, maxLength) => { if (value === undefined || value === null) return fallback; return String(value).trim().slice(0, maxLength); };
const finiteNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const identitySettings = (raw) => { const next = fluidClone(IDENTITY_DEFAULTS); if (!raw || typeof raw !== "object" || Array.isArray(raw)) return next; next.brandMark = boundedText(raw.brandMark, next.brandMark, 16); next.brandName = boundedText(raw.brandName, next.brandName, 32); next.avatarText = boundedText(raw.avatarText, next.avatarText, 16); next.displayName = boundedText(raw.displayName, next.displayName, 32); next.role = boundedText(raw.role, next.role, 32); return next; };
function fluidSettings(raw) { const next = fluidClone(FLUID_DEFAULTS); if (!raw || typeof raw !== "object") return next; next.quality = ["auto", "high", "balanced", "eco", "fallback"].includes(raw.quality) ? raw.quality : next.quality; next.interaction = typeof raw.interaction === "boolean" ? raw.interaction : next.interaction; Object.keys(next.cards).forEach((id) => { const s = raw.cards?.[id]; if (!s) return; const d = next.cards[id]; next.cards[id] = { ...d, preset: typeof s.preset === "string" ? s.preset : "custom", a: fluidHex(s.a, d.a), b: fluidHex(s.b, d.b), c: fluidHex(s.c, d.c), speed: fluidClamp(Number(s.speed) || d.speed, 0, 2), intensity: fluidClamp(Number(s.intensity) || d.intensity, .35, 1.6), pointer: fluidClamp(Number.isFinite(Number(s.pointer)) ? Number(s.pointer) : d.pointer, 0, 1.5), surface: fluidClamp(Number.isFinite(Number(s.surface)) ? Number(s.surface) : d.surface, 0, 1), seed: Number.isFinite(Number(s.seed)) ? Number(s.seed) : d.seed }; }); return next; }

class DashboardView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.flowFrames = []; this.fluidObservers = []; this.lastScanPaths = new Set(); this.pendingNewPaths = new Set(); this.state = { notes: [], active: "", page: "dashboard", filter: "all", folderFilter: "", progress: { x: 6, y: 14, scale: 1 }, orbit: { r: -24, x: -5, zoom: 1, radius: 240, auto: true, speed: 1, dragging: false, vr: 0, vx: 0, flat: false } }; }
  getViewType() { return VIEW_TYPE; } getDisplayText() { return "阅读吸收驾驶舱"; } getIcon() { return "library-big"; }
  async onOpen() { this.registerEvent(this.app.metadataCache.on("changed", () => this.deferRender())); this.registerEvent(this.app.vault.on("create", (file) => { this.queueNewNote(file); this.deferRender(); })); ["delete", "rename"].forEach((event) => this.registerEvent(this.app.vault.on(event, () => this.deferRender()))); this.registerEvent(this.app.workspace.on("file-open", (file) => this.syncActiveFile(file))); if (typeof ResizeObserver !== "undefined") { this.resizeObserver = new ResizeObserver(() => { const compact = this.isCompact(); if (compact !== this.compactMode) this.deferRender(); }); this.resizeObserver.observe(this.contentEl); this.register(() => this.resizeObserver?.disconnect()); } await this.render(); this.lastScanPaths = new Set(this.state.notes.map((note) => note.path)); }
  async onClose() { this.resizeObserver?.disconnect(); this.orbitRoot = null; window.cancelAnimationFrame(this.animation); window.cancelAnimationFrame(this.v14FluidFrame); this.stopFluid(); this.v14FluidContexts?.forEach((gl) => { try { gl.getExtension("WEBGL_lose_context")?.loseContext(); } catch (_) {} }); }
  deferRender() { window.clearTimeout(this.timer); this.timer = window.setTimeout(() => this.render(), 250); }
  notes() { return this.app.vault.getMarkdownFiles().filter(isManaged).map((file) => { const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {}, segments = file.path.split("/"), rawCreated = fm["创建日期"] ?? fm.date, created = dateKey(rawCreated, file.stat.ctime); return { file, path: file.path, title: fm.title || file.basename, folder: file.parent?.name || "根目录", rootFolder: segments.length > 1 ? segments[0] : "", reading: READING.includes(fm["阅读状态"]) ? fm["阅读状态"] : "未读", absorption: ABSORPTION.includes(fm["吸收状态"]) ? fm["吸收状态"] : "待沉淀", created, createdFromFrontmatter: Boolean(dateKey(rawCreated)), modified: file.stat.mtime }; }); }
  active() { return this.state.notes.find((n) => n.path === this.state.active) || this.state.notes[0]; }
  syncActiveFile(file) { if (!(file instanceof TFile) || file.extension !== "md" || !isManaged(file) || this.state.active === file.path) return; this.state.active = file.path; this.deferRender(); }
  async initializeNewNotes(notes) { let initialized = 0; for (const note of notes) { if (!note || !isManaged(note.file)) continue; try { let changed = false; await this.app.fileManager.processFrontMatter(note.file, (fm) => { if (!dateKey(fm["创建日期"] ?? fm.date)) { fm["创建日期"] = localDate(); changed = true; } if (!READING.includes(fm["阅读状态"])) { fm["阅读状态"] = "未读"; changed = true; } if (!ABSORPTION.includes(fm["吸收状态"])) { fm["吸收状态"] = "待沉淀"; changed = true; } if (changed) fm["状态更新时间"] = localDate(); }); if (changed) initialized++; } catch (error) { console.warn("新笔记属性初始化失败", note.path, error); } } return initialized; }
  queueNewNote(file) { if (!isManaged(file)) return; this.pendingNewPaths.add(file.path); window.clearTimeout(this.newNoteTimer); this.newNoteTimer = window.setTimeout(async () => { try { const paths = [...this.pendingNewPaths]; this.pendingNewPaths.clear(); const notes = paths.map((path) => this.notes().find((note) => note.path === path)).filter(Boolean); const initialized = await this.initializeNewNotes(notes); if (!initialized) return; await new Promise((resolve) => window.setTimeout(resolve, 120)); this.state.notes = this.notes(); this.lastScanPaths = new Set(this.state.notes.map((note) => note.path)); await this.render(); } catch (error) { console.error("新笔记看板同步失败", error); new Notice("新笔记已创建，但看板同步失败；可点击立即扫描重试。"); } }, 450); }
  async backfillMissingReadingProperties() { let updated = 0; for (const file of this.app.vault.getMarkdownFiles().filter(isManaged)) { const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {}, missingReading = !READING.includes(frontmatter["阅读状态"]), missingAbsorption = !ABSORPTION.includes(frontmatter["吸收状态"]); if (!missingReading && !missingAbsorption) continue; await this.app.fileManager.processFrontMatter(file, (fm) => { if (!READING.includes(fm["阅读状态"])) fm["阅读状态"] = "未读"; if (!ABSORPTION.includes(fm["吸收状态"])) fm["吸收状态"] = "待沉淀"; fm["状态更新时间"] = localDate(); }); updated++; } return updated; }
  select(path, focus = false) { this.state.active = path; this.render(); if (focus) this.contentEl.querySelector(".ycs-right")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  async update(note, field, value) { try { await this.app.fileManager.processFrontMatter(note.file, (fm) => { fm[field] = value; fm["状态更新时间"] = localDate(); if (field === "阅读状态" && value === "在读" && !fm["开始阅读"]) fm["开始阅读"] = localDate(); if (field === "阅读状态" && value === "已读" && !fm["完成阅读"]) fm["完成阅读"] = localDate(); }); await new Promise((resolve) => window.setTimeout(resolve, 120)); new Notice(`已写入《${note.title}》的${field}`); await this.render(); } catch (error) { console.error(error); new Notice("状态写入失败，请检查笔记是否可编辑。"); } }
  options(values, active) { return values.map((v) => `<option value="${v}" ${v === active ? "selected" : ""}>${v}</option>`).join(""); }
  stat(label, value, caption, icon, slim = false) { const id = ["今日新增", "未读库存", "已经阅读", "长期未读"].indexOf(label); return `<article class="ycs-stat ycs-glass ycs-fluid-stat ${slim ? "ycs-slim" : ""}" data-fluid-card="${["today", "unread", "read", "backlog"][Math.max(0, id)]}"><canvas class="ycs-fluid-canvas" aria-hidden="true"></canvas><div class="ycs-fluid-noise" aria-hidden="true"></div><div class="ycs-fluid-fallback" aria-hidden="true"></div><div class="ycs-stat-content"><div class="ycs-stat-title">${label}</div><div><span class="ycs-stat-value">${value}</span><span class="ycs-stat-unit">篇笔记</span></div><div class="ycs-stat-change">${caption}</div><div class="ycs-stat-icon">${icon}</div></div></article>`; }
  folders() { const map = new Map(), primaryFolder = /^[0-5](?:[-_ ]|$)/; this.state.notes.forEach((n) => { if (!primaryFolder.test(n.rootFolder)) return; const v = map.get(n.rootFolder) || { name: n.rootFolder, total: 0, unread: 0 }; v.total++; v.unread += n.reading === "未读" ? 1 : 0; map.set(n.rootFolder, v); }); return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN", { numeric: true })); }
  scopedNotes() { let notes = this.state.notes; if (this.state.folderFilter) notes = notes.filter((n) => n.rootFolder === this.state.folderFilter); if (this.state.filter === "today") notes = notes.filter(isTodayAdded); if (this.state.filter === "reading") notes = notes.filter((n) => n.reading === "在读"); if (this.state.filter === "absorption") notes = notes.filter((n) => n.reading === "已读" && n.absorption === "待沉淀"); return notes; }
  stopFluid() { this.flowFrames.forEach((id) => window.cancelAnimationFrame(id)); this.flowFrames = []; this.fluidObservers.forEach((observer) => observer.disconnect()); this.fluidObservers = []; }
  // V1.4 原稿同款：每张统计卡独立 WebGL 着色器、透明材质及鼠标扰动；WebGL 不可用时才回退 CSS。
  bindV14Fluid(root) {
    this.stopFluid(); window.cancelAnimationFrame(this.v14FluidFrame); this.v14FluidContexts?.forEach((gl) => { try { gl.getExtension("WEBGL_lose_context")?.loseContext(); } catch (_) {} }); this.v14FluidContexts = []; this.v14FluidDraws = [];
    const settings = this.plugin.fluidSettings;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const vertex = "attribute vec2 p; varying vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
    const fragment = "precision highp float;varying vec2 uv;uniform vec2 r,m,v;uniform float t,seed,hit,speed,intensity,pointer,surface;uniform vec3 colorA,colorB,colorC;float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}float fb(vec2 p){float x=0.,a=.53;mat2 rot=mat2(.80,-.60,.60,.80);for(int i=0;i<5;i++){x+=a*n(p);p=rot*p*2.02+vec2(17.13,9.27);a*=.49;}return x;}void main(){vec2 q=(uv-.5)*vec2(r.x/max(1.,r.y),1.),mm=(m-.5)*vec2(r.x/max(1.,r.y),1.);vec2 d=q-mm;float dist=length(d),push=exp(-dist*dist*7.2)*hit*pointer;q+=d/max(dist,.035)*push*.115+vec2(-d.y,d.x)/max(dist,.035)*push*(v.x-v.y)*.045;float time=t*(speed*1.68+.08),a=fb(q*1.22+seed+vec2(time*.075,-time*.052)),b=fb(q*1.54-seed*.37+vec2(-time*.057,time*.064)+a*.82);vec2 z=q+(vec2(a,b)-.5)*(.58*intensity);float broad=fb(z*1.12+vec2(time*.041,-time*.033)),detail=fb(z*2.18+vec2(-time*.083,time*.057)+broad*.95),ribbon=.5+.5*sin(z.x*3.15+z.y*.76+detail*5.+time*.25+seed);vec3 fluid=mix(colorA,colorB,smoothstep(.16,.88,broad*.61+ribbon*.39));fluid=mix(fluid,colorC,smoothstep(.43,.84,detail*.69+(.5+.5*sin(z.y*4.2-z.x*.8-time*.17))*.31)*.74);float reveal=smoothstep(.055,.735,uv.x+(.5-broad)*.27+.070*sin(uv.y*4.+time*.12));float spec=pow(clamp(1.-abs(detail-.52)*2.,0.,1.),5.)*reveal;float alpha=clamp((.035+reveal*(.24+.50*intensity)+spec*.08+surface*reveal*.14),0.,.92)*smoothstep(1.08,.70,length((uv-.5)*vec2(1.,.90)));gl_FragColor=vec4(mix(fluid,vec3(.34,1.,.90),spec*.18),alpha);}";
    // 参考启动页的完整流体路径：自主运动由多层 plume / haze / caustic 驱动，鼠标只叠加局部扰动。
    // 保留上面的旧 shader 字符串作为兼容基线，实际编译使用这份增强版，便于回滚和逐项对比。
    const enhancedFragment = `precision highp float;
      varying vec2 uv;
      uniform vec2 r,m,v;
      uniform float t,seed,hit,speed,intensity,pointer,surface;
      uniform vec3 colorA,colorB,colorC;
      float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
      float fb(vec2 p){float x=0.,a=.53;mat2 rot=mat2(.80,-.60,.60,.80);for(int i=0;i<5;i++){x+=a*n(p);p=rot*p*2.02+vec2(17.13,9.27);a*=.49;}return x;}
      float blob(vec2 p,vec2 center,float radius,float softness){return 1.-smoothstep(radius-softness,radius+softness,length(p-center));}
      void main(){
        float aspect=r.x/max(1.,r.y);
        vec2 p=(uv-.5)*vec2(aspect,1.),mm=(m-.5)*vec2(aspect,1.),d=p-mm;
        float dist=length(d),mouseField=exp(-dist*dist*7.2)*hit*pointer;
        vec2 normal=d/max(dist,.035),tangent=vec2(-normal.y,normal.x);
        p+=normal*mouseField*.115+tangent*mouseField*(v.x-v.y)*.045;
        // 保留极低速的自主基线：即使用户把速度拉到 0，流体也不会退化成只靠鼠标才变化的静态图。
        float time=t*(max(speed,.08)*1.68+.08);
        vec2 seedVec=vec2(seed*1.713,seed*.937);
        float w1=fb(p*1.22+seedVec+vec2(time*.075,-time*.052));
        float w2=fb(p*1.54-seedVec*.37+vec2(-time*.057,time*.064)+w1*.82);
        vec2 q=p+(vec2(w1,w2)-.5)*(.58*intensity);
        float broad=fb(q*1.12+vec2(time*.041,-time*.033));
        float detail=fb(q*2.18+vec2(-time*.083,time*.057)+broad*.95);
        float ribbon=.5+.5*sin(q.x*3.15+q.y*.76+detail*5.+time*.25+seed);
        vec3 fluid=mix(colorA,colorB,smoothstep(.16,.88,broad*.61+ribbon*.39));
        fluid=mix(fluid,colorC,smoothstep(.43,.84,detail*.69+(.5+.5*sin(q.y*4.2-q.x*.8-time*.17))*.31)*.74);
        float plume1=blob(p,vec2(aspect*.23+.12*sin(time*.08+seed),.16*cos(time*.11+seed)),.52,.38);
        float plume2=blob(p,vec2(aspect*.39+.10*cos(time*.07-seed),-.24+.11*sin(time*.09)),.43,.34);
        float haze=clamp(plume1*.72+plume2*.58,0.,1.);
        float reveal=smoothstep(.055,.735,uv.x+(.5-broad)*.27+.070*sin(uv.y*4.+time*.12));
        reveal=clamp(reveal*mix(.70,1.,haze)*intensity,0.,1.);
        float spec=pow(clamp(1.-abs(detail-.52)*2.,0.,1.),5.)*reveal;
        float caustic=pow(clamp(.52+.48*sin((q.x-q.y)*5.2+detail*7.-time*.18),0.,1.),7.)*reveal;
        vec3 glow=mix(fluid,vec3(.34,1.,.90),spec*.18+caustic*.09);
        glow*=.78+.25*haze;
        glow=mix(glow,glow*.70,surface*.34);
        float filament=smoothstep(.48,.86,detail)*reveal;
        float density=clamp(reveal*(.36+.48*haze)+filament*.22+mouseField*.28,0.,1.);
        float alpha=clamp(.035*haze+density*(.24+.50*intensity)+spec*.08+surface*density*.14,0.,.92);
        alpha*=smoothstep(1.08,.70,length((uv-.5)*vec2(1.,.92)));
        glow=pow(max(glow,0.),vec3(.94));
        gl_FragColor=vec4(glow,alpha);
      }`;
    const compile = (gl, type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const palette = [[.0,.9,.82],[.12,.75,1],[.0,.65,.45],[.05,.8,.75]], materialUpdaters = [];
    this.v14FluidApply = () => materialUpdaters.forEach((apply) => apply());
    root.querySelectorAll("[data-fluid-card]").forEach((card, index) => {
      const id = card.dataset.fluidCard, config = settings.cards[id], canvas = card.querySelector(".ycs-fluid-canvas"); let gl;
      if (settings.quality === "fallback") { card.classList.add("is-fallback"); return; }
      try {
        gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: "high-performance" }); if (!gl) throw new Error("WebGL unavailable");
        const program = gl.createProgram(); gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex)); gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, enhancedFragment)); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)); gl.useProgram(program);
        const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW); const pos = gl.getAttribLocation(program, "p"); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
        const u = Object.fromEntries(["r","m","v","t","seed","hit","speed","intensity","pointer","surface","colorA","colorB","colorC"].map((name) => [name, gl.getUniformLocation(program, name)])); const mouse = { x: .76, y: .46, tx: .76, ty: .46, vx: 0, vy: 0, hit: 0 };
        const resize = () => { const box = card.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, settings.quality === "high" ? 1.8 : settings.quality === "eco" ? 1 : 1.35); canvas.width = Math.max(2, Math.round(box.width * dpr)); canvas.height = Math.max(2, Math.round(box.height * dpr)); gl.viewport(0, 0, canvas.width, canvas.height); }; const observer = new ResizeObserver(resize); observer.observe(card); this.fluidObservers.push(observer); resize();
        const material = () => { const s = config.surface, light = fluidClamp((s - .25) / .21, 0, 1); card.style.setProperty("--surface-opacity", s); card.style.setProperty("--content-shade", .48 * Math.pow(1 - s, 1.45)); card.style.setProperty("--stat-text", light > .5 ? "#16201d" : "#f3fffb"); card.dataset.surfaceTone = light > .5 ? "light" : "dark"; }; materialUpdaters.push(material); material();
        card.addEventListener("pointermove", (e) => { if (!settings.interaction) return; const box = card.getBoundingClientRect(), x = fluidClamp((e.clientX - box.left) / box.width, 0, 1), y = fluidClamp(1 - (e.clientY - box.top) / box.height, 0, 1); mouse.vx = fluidClamp(x - mouse.tx, -.12, .12); mouse.vy = fluidClamp(y - mouse.ty, -.12, .12); mouse.tx = x; mouse.ty = y; mouse.hit = 1; }); card.addEventListener("pointerleave", () => { mouse.hit = 0; });
        this.v14FluidContexts.push(gl); const draw = (now) => { mouse.x += (mouse.tx - mouse.x) * .105; mouse.y += (mouse.ty - mouse.y) * .105; mouse.vx *= .90; mouse.vy *= .90; gl.useProgram(program); gl.uniform2f(u.r, canvas.width, canvas.height); gl.uniform2f(u.m, mouse.x, mouse.y); gl.uniform2f(u.v, mouse.vx, mouse.vy); gl.uniform1f(u.t, now * .001 + index * 3.73); gl.uniform1f(u.seed, config.seed); gl.uniform1f(u.hit, settings.interaction ? mouse.hit : 0); gl.uniform1f(u.speed, reduced ? Math.max(.12, config.speed * .22) : config.speed); gl.uniform1f(u.intensity, config.intensity); gl.uniform1f(u.pointer, config.pointer); gl.uniform1f(u.surface, config.surface); gl.uniform3fv(u.colorA, fluidRgb(config.a)); gl.uniform3fv(u.colorB, fluidRgb(config.b)); gl.uniform3fv(u.colorC, fluidRgb(config.c)); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 6); };
        (this.v14FluidDraws ||= []).push(draw); card.classList.remove("is-fallback");
      } catch (error) { console.warn("V1.4 流体 WebGL 回退", error); card.classList.add("is-fallback"); }
    });
    const loop = (now) => { this.v14FluidDraws?.forEach((draw) => draw(now)); if (root.isConnected) this.v14FluidFrame = window.requestAnimationFrame(loop); }; this.v14FluidFrame = window.requestAnimationFrame(loop);
    // 设置面板是即时预览：uniform 每帧读取同一份配置，颜色/速度/强度会立即反映；仅“保存”写入插件数据。
    // 使用属性处理器而非重复 addEventListener：质量切换会重建 WebGL，旧 root 上
    // 的委托监听不能累积，否则一次滑块操作会被处理多次。
    root.oninput = (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.matches(".ycs-fluid-panel input[data-c]")) return;
      const panel = input.closest(".ycs-fluid-panel"), id = panel?.dataset.card || "today", c = settings.cards[id];
      if (!c) return;
      const key = input.dataset.c;
      if (key === "surface") c.surface = Number(input.value) / 100;
      else if (key === "speed" || key === "intensity" || key === "pointer") c[key] = Number(input.value);
      else if (key === "a" || key === "b" || key === "c") { c[key] = input.value; c.preset = "custom"; }
      root.querySelectorAll(`[data-fluid-card="${id}"]`).forEach((card) => {
        const surface = fluidClamp(c.surface, 0, 1), shade = (.48 * Math.pow(1 - surface, 1.45)).toFixed(3);
        card.style.setProperty("--surface-opacity", surface); card.style.setProperty("--content-shade", shade);
        card.style.setProperty("--fluid-a", c.a); card.style.setProperty("--fluid-b", c.b); card.style.setProperty("--fluid-c", c.c);
      });
    };
    const scanButton = root.querySelector(".ycs-refresh");
    if (scanButton) scanButton.onclick = async () => {
      if (scanButton.disabled) return;
      scanButton.disabled = true; scanButton.classList.add("is-scanning"); scanButton.textContent = "↻ 扫描中…";
      const before = this.lastScanPaths;
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      const discovered = this.notes().filter((note) => !before.has(note.path));
      const initializedCount = await this.initializeNewNotes(discovered);
      const filledCount = await this.backfillMissingReadingProperties();
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const scanned = this.notes(), newCount = discovered.length, todayAdded = scanned.filter(isTodayAdded).length;
      this.lastScanPaths = new Set(scanned.map((note) => note.path)); this.state.notes = scanned;
      const message = `扫描完成：${scanned.length} 篇笔记，${newCount ? `扫描新增 ${newCount} 篇` : "无扫描新增"}，今日入库 ${todayAdded} 篇（按创建日期）${initializedCount ? `，初始化 ${initializedCount} 篇新笔记属性` : ""}${filledCount ? `，补全 ${filledCount} 篇历史状态` : ""}`;
      scanButton.textContent = "✓ " + message; new Notice(message);
      window.setTimeout(() => { if (root.isConnected) this.render(); }, 1250);
    };
    const settingsButton = root.querySelector(".ycs-actions .ycs-icon");
    if (settingsButton) { settingsButton.title = "V1.4 流体设置"; settingsButton.onclick = () => { const panel = root.querySelector(".ycs-fluid-panel") || root.createDiv({ cls: "ycs-fluid-panel" }); const selected = panel.dataset.card || "today", c = settings.cards[selected]; panel.innerHTML = `<b>四张流体卡片设置</b><button class="close">×</button><label>当前卡片 <select data-c="card">${Object.entries({today:"今日新增",unread:"未读库存",read:"已经阅读",backlog:"长期未读"}).map(([id,name]) => `<option value="${id}" ${id === selected ? "selected" : ""}>${name}</option>`).join("")}</select></label><label>配色 <select data-c="preset">${Object.keys(FLUID_PRESETS).map((id) => `<option value="${id}" ${id === c.preset ? "selected" : ""}>${id}</option>`).join("")}</select></label><label>色 A <input data-c="a" type="color" value="${c.a}"></label><label>色 B <input data-c="b" type="color" value="${c.b}"></label><label>色 C <input data-c="c" type="color" value="${c.c}"></label><label>速度 <input data-c="speed" type="range" min="0" max="2" step=".01" value="${c.speed}"></label><label>强度 <input data-c="intensity" type="range" min=".35" max="1.6" step=".01" value="${c.intensity}"></label><label>鼠标扰动 <input data-c="pointer" type="range" min="0" max="1.5" step=".01" value="${c.pointer}"></label><label>底色透明度 <input data-c="surface" type="range" min="0" max="100" value="${Math.round(c.surface * 100)}"></label><label>渲染质量 <select data-c="quality">${["auto","high","balanced","eco","fallback"].map((q) => `<option value="${q}" ${q === settings.quality ? "selected" : ""}>${q}</option>`).join("")}</select></label><label>鼠标交互 <input data-c="interaction" type="checkbox" ${settings.interaction ? "checked" : ""}></label><button class="save">保存设置</button><small>拖动滑块会即时预览；点击保存后重载仍生效</small>`; panel.hidden = false; const persist = async () => { this.v14FluidApply?.(); await this.plugin.saveFluidSettings(); }; panel.querySelector(".close").onclick = () => panel.hidden = true; panel.querySelector("[data-c=card]").onchange = (e) => { panel.dataset.card = e.target.value; settingsButton.click(); }; panel.querySelector("[data-c=preset]").onchange = (e) => { const x = settings.cards[panel.dataset.card || selected]; Object.assign(x, FLUID_PRESETS[e.target.value], { preset: e.target.value }); this.v14FluidApply?.(); settingsButton.click(); }; panel.querySelectorAll("input[data-c]:not([data-c=interaction])").forEach((input) => input.oninput = () => { const x = settings.cards[panel.dataset.card || selected], key = input.dataset.c; x[key] = key === "surface" ? Number(input.value) / 100 : key === "speed" || key === "intensity" || key === "pointer" ? Number(input.value) : input.value; x.preset = key === "a" || key === "b" || key === "c" ? "custom" : x.preset; this.v14FluidApply?.(); }); panel.querySelector("[data-c=quality]").onchange = async (e) => { settings.quality = e.target.value; await this.plugin.saveFluidSettings(); this.bindV14Fluid(root); }; panel.querySelector("[data-c=interaction]").onchange = (e) => { settings.interaction = e.target.checked; this.v14FluidApply?.(); }; panel.querySelector(".save").onclick = async () => { await persist(); new Notice("V1.4 流体设置已保存，并已即时生效"); panel.hidden = true; }; }; }
  }
  bindFluid(root) {
    this.stopFluid();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    root.querySelectorAll(".ycs-stat").forEach((card, cardIndex) => {
      const canvas = card.querySelector(".ycs-fluid"), ctx = canvas?.getContext("2d"); if (!ctx) return;
      const pointer = { x: -999, y: -999, active: false };
      const dots = Array.from({ length: 18 }, (_, index) => ({ x: ((index * 47 + 17 * cardIndex) % 100) / 100, y: ((index * 31 + 11 * cardIndex) % 100) / 100, phase: index * .71 + cardIndex, size: 1.2 + (index % 3) * .45 }));
      const resize = () => { const rect = card.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio)); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); };
      resize(); const observer = new ResizeObserver(resize); observer.observe(card); this.fluidObservers.push(observer);
      card.addEventListener("pointermove", (event) => { const rect = card.getBoundingClientRect(); pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; pointer.active = true; });
      card.addEventListener("pointerleave", () => { pointer.active = false; });
      let started = performance.now();
      const draw = (now) => {
        const rect = card.getBoundingClientRect(), w = rect.width, h = rect.height, t = (now - started) / 1000;
        ctx.clearRect(0, 0, w, h);
        const pulseX = w * (.2 + .55 * (Math.sin(t * .46 + cardIndex) + 1) / 2), pulseY = h * (.72 + .10 * Math.sin(t * .7));
        const gradient = ctx.createRadialGradient(pulseX, pulseY, 0, pulseX, pulseY, Math.max(w, h) * .62);
        gradient.addColorStop(0, "rgba(0, 230, 118, .20)"); gradient.addColorStop(.38, "rgba(0, 196, 130, .075)"); gradient.addColorStop(1, "rgba(0, 80, 55, 0)");
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
        dots.forEach((dot) => { const x = ((dot.x + Math.sin(t * .24 + dot.phase) * .11 + 1) % 1) * w, y = ((dot.y + Math.cos(t * .34 + dot.phase) * .09 + 1) % 1) * h; let dx = 0, dy = 0; if (pointer.active) { const px = x - pointer.x, py = y - pointer.y, d2 = px * px + py * py; if (d2 < 8100) { const force = (1 - d2 / 8100) * 13; const d = Math.sqrt(d2) || 1; dx = px / d * force; dy = py / d * force; } } ctx.beginPath(); ctx.arc(x + dx, y + dy, dot.size, 0, Math.PI * 2); ctx.fillStyle = "rgba(67, 255, 178, .48)"; ctx.fill(); });
        if (pointer.active) { const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 72); glow.addColorStop(0, "rgba(112,255,198,.24)"); glow.addColorStop(1, "rgba(0,230,118,0)"); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h); }
        if (!reduced && root.isConnected) this.flowFrames[cardIndex] = window.requestAnimationFrame(draw);
      };
      draw(performance.now());
    });
  }
  bindSelects(root) { root.querySelectorAll("select[data-path]").forEach((select) => select.addEventListener("change", () => { const note = this.state.notes.find((n) => n.path === select.dataset.path); if (note) this.update(note, select.dataset.field, select.value); })); }
  async openNoteInMain(path) {
    const note = this.state.notes.find((item) => item.path === path), file = note?.file || this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) { new Notice("找不到要打开的笔记。"); return; }
    try {
      const leaves = this.app.workspace.getLeavesOfType("markdown") || [];
      const mainLeaf = leaves.find((leaf) => {
        const el = leaf.containerEl;
        return leaf !== this.leaf && !el?.closest?.(".workspace-split.mod-left-split, .workspace-split.mod-right-split");
      }) || leaves.find((leaf) => leaf !== this.leaf);
      // 优先复用主工作区已经打开的编辑器；没有编辑器时才让 Obsidian 创建普通标签页。
      if (mainLeaf?.openFile) await mainLeaf.openFile(file, { active: true });
      else {
        const fallbackLeaf = this.app.workspace.getLeaf?.(true);
        if (fallbackLeaf?.openFile) await fallbackLeaf.openFile(file, { active: true });
        else await this.app.workspace.openLinkText(file.path, "", true);
      }
    } catch (error) { console.error(error); new Notice("打开笔记失败，请检查当前工作区。 "); }
  }
  bindQueueNotes(root, focus = true) {
    root.querySelectorAll(".ycs-queue-note[data-open]").forEach((button) => {
      let clickTimer = 0;
      let opening = false;
      const open = async () => {
        if (opening) return;
        opening = true;
        try { await this.openNoteInMain(button.dataset.open); } finally { opening = false; }
      };
      // 单击会重绘详情；若延时过短，重绘会先销毁按钮，导致系统来不及派发 dblclick。
      // 统一以 click.detail / dblclick 双保险判定，延时采用常见系统双击窗口（480ms）。
      button.onclick = (event) => {
        event.preventDefault(); event.stopPropagation();
        window.clearTimeout(clickTimer);
        if (event.detail >= 2) { void open(); return; }
        clickTimer = window.setTimeout(() => this.select(button.dataset.open, focus), 480);
      };
      button.ondblclick = (event) => { event.preventDefault(); event.stopPropagation(); window.clearTimeout(clickTimer); void open(); };
    });
  }
  async revealRootFolder(folderPath) {
    if (!folderPath) return;
    try {
      this.app.workspace.leftSplit?.expand?.();
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      const leaf = (this.app.workspace.getLeavesOfType("file-explorer") || [])[0];
      const view = leaf?.view;
      if (!folder) { new Notice(`找不到目录「${folderPath}」。`); return; }
      if (!view) { new Notice("未找到文件浏览器，无法展开目录。"); return; }
      let revealed = false;
      if (typeof view.revealInFolder === "function") { await view.revealInFolder(folder); revealed = true; }
      const item = view?.fileItems?.[folderPath];
      if (item?.setCollapsed) { item.setCollapsed(false); revealed = true; }
      else if (item?.collapse) { item.collapse(false); revealed = true; }
      const escaped = window.CSS?.escape ? window.CSS.escape(folderPath) : folderPath.replace(/["\\\\]/g, "\\\\$&");
      const folderEl = leaf?.containerEl?.querySelector?.(`.nav-folder[data-path="${escaped}"]`) || document.querySelector(`.workspace-split.mod-left-split .nav-folder[data-path="${escaped}"]`);
      if (folderEl) {
        if (folderEl.classList.contains("is-collapsed")) folderEl.querySelector(".nav-folder-collapse-indicator")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        folderEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        revealed = true;
      }
      if (revealed) new Notice(`已在文件浏览器中展开「${folderPath}」`);
      else new Notice(`无法定位目录「${folderPath}」的文件树节点。`);
    } catch (error) { console.error(error); new Notice("无法展开文件夹，请确认文件浏览器已启用。 "); }
  }
  availableWidth() { const direct = Math.round(this.contentEl?.clientWidth || 0); if (direct > 0) return direct; const leafWidth = Math.round(this.leaf?.containerEl?.clientWidth || 0); if (leafWidth > 0) return leafWidth; try { if (this.leaf?.containerEl?.closest?.(".workspace-split.mod-right-split")) return 400; } catch (_) {} return 1000; }
  isCompact() { return this.availableWidth() < 860; }
  renderCompact(root, stats, long, pending) {
    const notes = this.scopedNotes().slice(0, 8), today = this.state.notes.filter(isTodayAdded).length;
    const layout = this.plugin.dashboardSettings.statLayout;
    root.innerHTML = `<main class="ycs-compact-main"><header class="ycs-compact-head"><div><b>阅读吸收</b><small>紧凑侧栏</small></div><div class="ycs-compact-tools"><button class="ycs-compact-layout" aria-label="切换统计卡布局" title="切换统计卡布局">▦</button><button class="ycs-compact-refresh" aria-label="刷新数据" title="刷新数据">↻</button></div></header><section class="ycs-compact-stats ycs-compact-stats-${layout}" data-layout="${layout}">${this.stat("今日新增", today, "今日变化", "▣")}${this.stat("未读库存", stats.unread, "待阅读", "〽")}${this.stat("已经阅读", stats.read, "已完成", "✓")}${this.stat("长期未读", long.length, "超过 30 天", "!", true)}</section><section class="ycs-compact-queue ycs-glass"><div class="ycs-compact-section-head"><b>阅读队列</b><span>${notes.length} 篇</span></div><div class="ycs-compact-queue-list">${notes.length ? notes.map((n) => `<button class="ycs-queue-note" data-open="${esc(n.path)}"><span>${esc(n.title)}</span><em>${n.reading}</em><small>${dateText(n.created)}</small></button>`).join("") : `<div class="ycs-empty">当前没有匹配笔记</div>`}</div></section><section class="ycs-compact-detail ycs-glass"></section><footer class="ycs-compact-foot">全库 ${this.state.notes.length} 篇 · 待沉淀 ${pending.length} 篇</footer></main>`;
    root.querySelector(".ycs-compact-refresh").onclick = () => this.render();
    root.querySelector(".ycs-compact-layout").onclick = async () => { await this.plugin.cycleCompactStatLayout(); this.render(); };
    this.bindQueueNotes(root, false); this.renderCompactDetail(root.querySelector(".ycs-compact-detail")); this.bindV14Fluid(root);
  }
  renderDashboard(root, stats, long, pending) {
    const notes = this.scopedNotes();
    const labels = { all: "全库优先队列", today: "今日阅读队列", reading: "在读管理", absorption: "吸收与沉淀" };
    const groups = this.state.filter === "all"
      ? [["今日新增", notes.filter((n) => isTodayAdded(n) && n.reading === "未读").sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN")).slice(0, 4), "green"], ["长期积压", notes.filter((n) => n.reading === "未读" && isOlderThan(n.created, 30)).sort((a, b) => a.created.localeCompare(b.created)).slice(0, 4), "blue"], ["待沉淀", notes.filter((n) => n.reading === "已读" && n.absorption === "待沉淀").sort((a, b) => String(b.completed || "").localeCompare(String(a.completed || ""))).slice(0, 4), "purple"]]
      : [[labels[this.state.filter], notes.slice(0, 12), this.state.filter === "reading" ? "blue" : this.state.filter === "absorption" ? "purple" : "green"]];
    const queue = groups.map(([label, rows, color]) => `<div class="ycs-group"><div class="ycs-group-head"><i class="ycs-group-dot ${color}"></i>${label}<span>${rows.length}</span><b>⌄</b></div>${rows.length ? rows.map((n) => `<button class="ycs-queue-note" data-open="${esc(n.path)}"><span>${esc(n.title)}</span><em>${n.reading}</em><small>${dateText(n.created)}</small></button>`).join("") : `<div class="ycs-empty">暂无${label}笔记</div>`}</div>`).join("");
    root.innerHTML = `<main class="ycs-main"><header class="ycs-topbar"><div class="ycs-title"><h1>阅读管理</h1><p>未读识别 · 阅读推进 · 知识沉淀</p></div><label class="ycs-search">⌕ <input placeholder="搜索笔记、目录或标签…"/><kbd>⌘K</kbd></label><div class="ycs-actions"><button class="ycs-icon" aria-label="流体卡片设置">Aa</button><button class="ycs-pill ycs-refresh">＋ 立即扫描</button></div></header><section class="ycs-stats">${this.stat("今日新增", this.state.notes.filter(isTodayAdded).length, "按创建日期统计", "▣")}${this.stat("未读库存", stats.unread, "全库实时统计", "〽")}${this.stat("已经阅读", stats.read, "全库实时统计", "✓")}${this.stat("长期未读", long.length, "超过 30 天的未读", "!", true)}</section><section class="ycs-board"><section class="ycs-queue"><div class="ycs-section-head"><b>阅读队列</b><span>真实数据 · ${notes.length} 篇</span></div><div class="ycs-tabs"><button>${labels[this.state.filter]}${this.state.folderFilter ? ` · ${esc(this.state.folderFilter)}` : ""}</button></div>${queue}</section><section class="ycs-visual ycs-glass"><div class="ycs-toolbar"><span><button class="ycs-orbit-mode active">◉ 3D 环绕</button><button class="ycs-auto active">↻ 自动巡航</button><button class="ycs-reset">⌖ 复位视角</button></span><span><button class="ycs-speed">速度 1×</button><button class="ycs-folder-filter">⌁ 全部目录</button></span></div><div class="ycs-stage"><div class="ycs-progress" style="left:${this.state.progress.x}%;top:${this.state.progress.y}%;--ycs-progress-scale:${this.state.progress.scale}"><div class="ycs-progress-controls"><button data-progress-scale="-0.1" aria-label="缩小阅读完成率卡">−</button><button data-progress-scale="0.1" aria-label="放大阅读完成率卡">＋</button></div><div>阅读完成率</div><b>${stats.rate}%</b><small>已读 / 全部笔记</small><i><em style="width:${stats.rate}%"></em></i></div><div class="ycs-live"><i></i>实时交互</div><div class="ycs-floor"></div><div class="ycs-orbit-core"></div><div class="ycs-scene"><div class="ycs-ring"></div></div><div class="ycs-caption">⌁ 拖动完成率卡 · 滚轮或 ± 缩放 · 双击目录卡打开文件夹 <b>${esc(this.active()?.folder || "阅读管理")}</b></div></div><div class="ycs-timeline"><div><b>阅读时间轴</b><span>▣ ${localDate()}</span><button class="ycs-today">今天</button></div><div class="ycs-gantt"><i>今</i><strong>全库 ${this.state.notes.length} 篇 · 未读 ${stats.unread} 篇 · 已读 ${stats.read} 篇 · 待沉淀 ${pending.length} 篇</strong></div></div></section></section></main>`;
    root.querySelector(".ycs-refresh").onclick = () => this.render(); root.querySelector(".ycs-today").onclick = () => { this.state.filter = "today"; this.state.page = "dashboard"; this.render(); }; this.bindQueueNotes(root, true); this.bindV14Fluid(root); this.bindOrbit(root); this.bindSearch(root);
  }
  renderDetail(root) { const n = this.active(); if (!n) return; root.innerHTML = `<div class="ycs-right-head"><span>✦ 智能详情</span><span>⌕</span></div><div class="ycs-detail-id">${esc(n.path)}</div><div class="ycs-detail-title">${esc(n.title)} <small>本机数据</small></div><p class="ycs-detail-desc">这篇笔记位于 ${esc(n.folder)}，可直接在此推进阅读和沉淀状态。</p><div class="ycs-detail-grid"><span>负责人</span><b><i>DY</i>大Y</b><span>所属目录</span><b>☑ ${esc(n.folder)}</b><span>创建日期</span><b>▣ ${dateText(n.created)}</b><span>阅读状态</span><select data-path="${esc(n.path)}" data-field="阅读状态">${this.options(READING, n.reading)}</select><span>吸收状态</span><select data-path="${esc(n.path)}" data-field="吸收状态">${this.options(ABSORPTION, n.absorption)}</select><span>打开方式</span><b>Obsidian 本地库</b></div><div class="ycs-ai"><b>AI 助手建议</b>• 优先完成已经在读超过 7 天的笔记<br>• 将已读内容提炼为摘要或 Wiki 条目</div><div class="ycs-right-actions"><button class="ycs-open">在 Obsidian 打开</button><button class="ycs-next">推进状态</button><button class="ycs-absorb">沉淀</button></div>`; this.bindSelects(root); root.querySelector(".ycs-open").onclick = () => this.app.workspace.openLinkText(n.path, "", false); root.querySelector(".ycs-next").onclick = () => this.update(n, "阅读状态", n.reading === "未读" ? "在读" : n.reading === "在读" ? "已读" : "未读"); root.querySelector(".ycs-absorb").onclick = () => this.update(n, "吸收状态", n.absorption === "待沉淀" ? "已沉淀" : "待沉淀"); }
  renderCompactDetail(root) { const n = this.active(); if (!n) { root.innerHTML = `<span class="ycs-compact-no-active">暂无可操作笔记</span>`; return; } root.innerHTML = `<div class="ycs-compact-detail-bar"><div class="ycs-compact-detail-title" title="${esc(n.path)}">${esc(n.title)}</div><select aria-label="阅读状态" data-path="${esc(n.path)}" data-field="阅读状态">${this.options(READING, n.reading)}</select><select aria-label="吸收状态" data-path="${esc(n.path)}" data-field="吸收状态">${this.options(ABSORPTION, n.absorption)}</select><button class="ycs-next" title="推进阅读状态">推进</button><button class="ycs-absorb" title="切换吸收状态">沉淀</button><button class="ycs-open" title="在 Obsidian 打开">打开</button></div>`; this.bindSelects(root); root.querySelector(".ycs-open").onclick = () => this.app.workspace.openLinkText(n.path, "", false); root.querySelector(".ycs-next").onclick = () => this.update(n, "阅读状态", n.reading === "未读" ? "在读" : n.reading === "在读" ? "已读" : "未读"); root.querySelector(".ycs-absorb").onclick = () => this.update(n, "吸收状态", n.absorption === "待沉淀" ? "已沉淀" : "待沉淀"); }
  renderTable(root) { const notes = this.state.notes.filter((n) => n.reading === "未读" && (!this.state.folderFilter || n.rootFolder === this.state.folderFilter)); const filterLabel = this.state.folderFilter || "全部目录"; root.innerHTML = `<section class="ycs-table ycs-glass"><div class="ycs-table-top"><div><h2>未读文件索引</h2><p>按主目录查看未读 Markdown 笔记 · 当前：${esc(filterLabel)}</p></div><button class="ycs-table-filter">筛选：${esc(filterLabel)}</button></div><div class="ycs-table-wrap"><table><thead><tr><th>笔记</th><th>目录</th><th>阅读状态</th><th>吸收状态</th><th>创建日期</th><th>操作</th></tr></thead><tbody>${notes.map((n) => `<tr><td><button data-detail="${esc(n.path)}">${esc(n.title)}<small>${esc(n.path)}</small></button></td><td>${esc(n.folder)}</td><td><select data-path="${esc(n.path)}" data-field="阅读状态">${this.options(READING, n.reading)}</select></td><td><select data-path="${esc(n.path)}" data-field="吸收状态">${this.options(ABSORPTION, n.absorption)}</select></td><td>${dateText(n.created)}</td><td><button data-open="${esc(n.path)}">打开</button></td></tr>`).join("") || `<tr><td colspan="6">没有未读笔记</td></tr>`}</tbody></table></div><footer>显示 ${notes.length} 条，共 ${this.state.notes.length} 条</footer></section>`; this.bindSelects(root); root.querySelector(".ycs-table-filter").onclick = () => this.cycleFolderFilter(); root.querySelectorAll("[data-detail]").forEach((b) => b.onclick = () => this.select(b.dataset.detail)); root.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => this.app.workspace.openLinkText(b.dataset.open, "", false)); }
  cycleFolderFilter() { const folders = this.folders().map((folder) => folder.name), current = folders.indexOf(this.state.folderFilter); this.state.folderFilter = current < 0 ? folders[0] || "" : folders[current + 1] || ""; this.render(); }
  bindSearch(root) { const input = root.querySelector("input"); input.oninput = () => { const term = input.value.toLowerCase(); this.contentEl.querySelectorAll(".ycs-queue-note").forEach((b) => b.hidden = !b.textContent.toLowerCase().includes(term)); }; }
  bindProgressCard(root) {
    const stage = root.querySelector(".ycs-stage"), card = root.querySelector(".ycs-progress"), p = this.state.progress;
    if (!stage || !card) return;
    const apply = () => { card.style.left = `${p.x}%`; card.style.top = `${p.y}%`; card.style.setProperty("--ycs-progress-scale", p.scale); };
    const scaleBy = (amount) => { p.scale = Math.max(.65, Math.min(1.7, Math.round((p.scale + amount) * 100) / 100)); apply(); };
    let dragging = false, lastX = 0, lastY = 0;
    card.onpointerdown = (event) => { if (event.target.closest("button")) return; event.preventDefault(); event.stopPropagation(); dragging = true; lastX = event.clientX; lastY = event.clientY; card.classList.add("is-dragging"); card.setPointerCapture?.(event.pointerId); };
    card.onpointermove = (event) => { if (!dragging) return; const rect = stage.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height); p.x = Math.max(1, Math.min(96, p.x + (event.clientX - lastX) / width * 100)); p.y = Math.max(2, Math.min(92, p.y + (event.clientY - lastY) / height * 100)); lastX = event.clientX; lastY = event.clientY; apply(); };
    const release = () => { dragging = false; card.classList.remove("is-dragging"); };
    card.onpointerup = release; card.onpointercancel = release; card.onlostpointercapture = release;
    card.onwheel = (event) => { event.preventDefault(); event.stopPropagation(); scaleBy(event.deltaY < 0 ? .1 : -.1); };
    card.querySelectorAll("[data-progress-scale]").forEach((button) => button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); scaleBy(Number(button.dataset.progressScale)); });
    apply();
  }
  bindOrbit(root) {
    // 先取消上一轮巡航，避免异常 DOM 或重复绑定路径遗留 RAF。
    window.cancelAnimationFrame(this.animation); this.animation = 0;
    const stage = root.querySelector(".ycs-stage"), ring = root.querySelector(".ycs-ring"), scene = root.querySelector(".ycs-scene"), o = this.state.orbit, cards = this.folders().filter((folder) => !this.state.folderFilter || folder.name === this.state.folderFilter).slice(0, 6);
    if (!stage || !ring || !scene || !o) return;
    const stepAngle = () => 360 / Math.max(cards.length, 1);
    const syncControls = () => {
      const mode = root.querySelector(".ycs-orbit-mode"), auto = root.querySelector(".ycs-auto"), speed = root.querySelector(".ycs-speed");
      mode?.classList.toggle("active", !o.flat); if (mode) mode.textContent = o.flat ? "▦ 平面目录" : "◉ 3D 环绕";
      auto?.classList.toggle("active", o.auto); if (auto) auto.textContent = o.auto ? "↻ 自动巡航" : "Ⅱ 已暂停";
      if (speed) speed.textContent = `速度 ${o.speed}×`;
    };
    const transform = () => { o.r = orbitAngle(o.r, -24); scene.style.transform = o.flat ? `translate3d(${o.cardOffset || 0}px,0,0) scale(${o.zoom})` : `translate3d(${o.cardOffset || 0}px,0,0) rotateX(${o.x}deg) rotateY(${o.r}deg) scale(${o.zoom})`; };
    const front = () => { const count = Math.max(cards.length, 1), step = stepAngle(); return Math.round(((-o.r % 360 + 360) % 360) / step) % count; };
    const syncFrontCard = () => {
      const frontIndex = front();
      ring.querySelectorAll("button").forEach((button, index) => {
        const active = index === frontIndex;
        button.classList.toggle("is-front", active); button.setAttribute("aria-pressed", String(active));
        button.querySelector(".ycs-doc-card")?.classList.toggle("active", active);
      });
    };
    const paint = () => {
      const step = stepAngle(), frontIndex = front(), width = o.cardWidth || 120, height = o.cardHeight || 182;
      ring.innerHTML = cards.map((c, i) => {
        const col = (i % 3) - 1, row = Math.floor(i / 3) - .5, flat = `translate3d(${col * (width + 12)}px,${row * (height * .74)}px,0) scale(.64)`, active = i === frontIndex;
        return `<button type="button" class="ycs-orbit-card ${active ? "is-front" : ""}" data-index="${i}" data-folder="${esc(c.name)}" aria-label="聚焦目录 ${esc(c.name)}" aria-pressed="${active}" style="--ycs-card-width:${width}px;--ycs-card-height:${height}px;transform:${o.flat ? flat : `rotateY(${i * step}deg) translateZ(${o.radius}px)`}"><span class="ycs-card-art"><span class="ycs-card-side ycs-card-side-left" aria-hidden="true"></span><span class="ycs-card-side ycs-card-side-right" aria-hidden="true"></span><span class="ycs-card-top-edge" aria-hidden="true"></span><span class="ycs-doc-card ycs-acrylic-shell ${active ? "active" : ""}"><span class="ycs-card-top"><span>MD · ${String(i + 1).padStart(2, "0")}</span><i aria-hidden="true"></i></span><span class="ycs-folder-core" aria-hidden="true"></span><span class="ycs-folder-paper" aria-hidden="true"></span><span class="ycs-card-lines" aria-hidden="true"></span><span class="ycs-card-glyph" aria-hidden="true">⌑</span><b>${esc(c.name)}</b><small>${esc(c.total)} 篇　未读 ${esc(c.unread)}</small><span class="ycs-card-reflection" aria-hidden="true"></span></span><span class="ycs-card-rim" aria-hidden="true"></span></span></button>`;
      }).join("");
      transform();
      syncControls();
      ring.querySelectorAll("button").forEach((button) => {
        const reveal = () => this.revealRootFolder(button.dataset.folder);
        // 点击目录卡先停住巡航并把该卡吸附到正面；目录展开仍保持原有行为。
        button.onclick = (event) => {
          event.preventDefault(); event.stopPropagation();
          const index = Number(button.dataset.index);
          o.r = orbitAngle(-stepAngle() * index, o.r); o.vr = 0; o.vx = 0; o.auto = false; transform(); syncFrontCard(); syncControls(); this.persistOrbitView?.();
          void reveal();
        };
        button.ondblclick = (event) => { event.preventDefault(); event.stopPropagation(); void reveal(); };
      });
    };
    paint(); this.bindProgressCard(root); let lx = 0, ly = 0, lastMove = 0;
    const release = () => { o.dragging = false; stage.classList.remove("is-dragging"); this.persistOrbitView?.(); };
    stage.onpointerdown = (event) => { if (event.button !== undefined && event.button !== 0) return; o.dragging = true; o.vr = 0; o.vx = 0; lx = event.clientX; ly = event.clientY; lastMove = performance.now(); stage.classList.add("is-dragging"); stage.setPointerCapture?.(event.pointerId); };
    stage.onpointermove = (event) => { if (!o.dragging) return; const now = performance.now(), dt = Math.max(8, now - lastMove), dx = event.clientX - lx, dy = event.clientY - ly; o.r = orbitAngle(o.r + dx * .27, o.r); o.x = Math.max(-18, Math.min(12, o.x - dy * .08)); o.vr = (dx * .27) / dt * 16; o.vx = (-dy * .08) / dt * 16; o.auto = false; lx = event.clientX; ly = event.clientY; lastMove = now; transform(); syncFrontCard(); syncControls(); };
    stage.onpointerup = release; stage.onpointercancel = release; stage.onlostpointercapture = release;
    stage.onwheel = (event) => { event.preventDefault(); o.zoom = Math.max(.72, Math.min(1.35, o.zoom - event.deltaY * .0007)); o.radius = Math.max(190, Math.min(340, o.radius - event.deltaY * .035)); o.auto = false; paint(); this.persistOrbitView?.(); };
    root.querySelector(".ycs-orbit-mode").onclick = (event) => { o.flat = !o.flat; stage.classList.toggle("is-flat", o.flat); paint(); this.persistOrbitView?.(); };
    root.querySelector(".ycs-auto").onclick = () => { o.auto = !o.auto; o.vr = 0; o.vx = 0; syncControls(); this.persistOrbitView?.(); };
    root.querySelector(".ycs-reset").onclick = () => { Object.assign(o, { r: -24, x: -5, zoom: 1, radius: 240, vr: 0, vx: 0, auto: true }); stage.classList.remove("is-flat"); paint(); this.persistOrbitView?.(); };
    root.querySelector(".ycs-speed").onclick = () => { o.speed = o.speed === 1 ? 2 : o.speed === 2 ? .5 : 1; syncControls(); this.persistOrbitView?.(); };
    root.querySelector(".ycs-folder-filter").onclick = () => this.cycleFolderFilter();
    // 队列标签在视觉上是按钮；绑定同一目录轮换，避免出现无响应控件。
    root.querySelector(".ycs-tabs button").onclick = () => this.cycleFolderFilter();
    this.orbitRoot = root;
    let lastFrame = performance.now();
    const loop = (now) => {
      if (!root.isConnected || this.orbitRoot !== root) { if (this.orbitRoot === root) this.orbitRoot = null; this.animation = 0; return; }
      const dt = Math.min(50, Math.max(0, now - lastFrame)); lastFrame = now;
      if (!o.dragging) {
        if (!document.hidden && o.auto) o.r += .0033 * dt * (Number(o.speed) || 1);
        if (!document.hidden && (Math.abs(o.vr) > .002 || Math.abs(o.vx) > .002)) { const frameScale = dt / 16.667; o.r += o.vr * frameScale; o.x = Math.max(-18, Math.min(12, o.x + o.vx * frameScale)); o.vr *= Math.pow(.93, frameScale); o.vx *= Math.pow(.88, frameScale); }
        transform(); syncFrontCard();
      }
      this.animation = window.requestAnimationFrame(loop);
    };
    this.animation = window.requestAnimationFrame(loop);
  }
  async render() { this.orbitRoot = null; window.cancelAnimationFrame(this.animation); this.stopFluid(); this.state.notes = this.notes(); if (!this.state.notes.some((n) => n.path === this.state.active)) this.state.active = this.state.notes[0]?.path || ""; const unread = this.state.notes.filter((n) => n.reading === "未读"), read = this.state.notes.filter((n) => n.reading === "已读"), long = unread.filter((n) => isOlderThan(n.created, 30)), pending = read.filter((n) => n.absorption === "待沉淀"), stats = { unread: unread.length, read: read.length, rate: this.state.notes.length ? Math.round(read.length / this.state.notes.length * 100) : 0 }; this.contentEl.empty(); const app = this.contentEl.createDiv({ cls: "ycs-app" }), side = app.createDiv({ cls: "ycs-sidebar ycs-glass" }), center = app.createDiv({ cls: "ycs-main-column" }), right = app.createDiv({ cls: "ycs-right ycs-glass" }); const navItems = [["◉", "阅读驾驶舱", "dashboard", "all"], ["▦", "未读文件索引", "table", "all"], ["▣", "今日阅读队列", "dashboard", "today"], ["◫", "在读管理", "dashboard", "reading"], ["♧", "吸收与沉淀", "dashboard", "absorption"]]; side.innerHTML = `<div class="ycs-brand"><b>YCS</b><span>Knowledge OS</span></div><nav>${navItems.map(([i, label, page, filter]) => `<button class="${page === this.state.page && filter === this.state.filter ? "active" : ""}" data-page="${page}" data-filter="${filter}"><i>${i}</i>${label}<em>›</em></button>`).join("")}</nav><div class="ycs-workspace"><small>当前知识库</small><div>◈　${esc(this.app.vault.getName())}</div><p><b>DY</b><span>大Y<br><small>知识库管理员</small></span></p></div>`; side.querySelectorAll("[data-page]").forEach((b) => b.onclick = () => { this.state.page = b.dataset.page; this.state.filter = b.dataset.filter; this.render(); }); if (this.state.page === "table") this.renderTable(center); else this.renderDashboard(center, stats, long, pending); this.renderDetail(right); }
  async renderCompactShell() { window.cancelAnimationFrame(this.animation); this.stopFluid(); this.state.notes = this.notes(); if (!this.state.notes.some((note) => note.path === this.state.active)) this.state.active = this.state.notes[0]?.path || ""; const unread = this.state.notes.filter((note) => note.reading === "未读"), read = this.state.notes.filter((note) => note.reading === "已读"), long = unread.filter((note) => isOlderThan(note.created, 30)), pending = read.filter((note) => note.absorption === "待沉淀"), stats = { unread: unread.length, read: read.length, rate: this.state.notes.length ? Math.round(read.length / this.state.notes.length * 100) : 0 }; this.compactMode = true; this.contentEl.empty(); const app = this.contentEl.createDiv({ cls: "ycs-app ycs-compact" }); this.renderCompact(app, stats, long, pending); }
}
const renderWideDashboard = DashboardView.prototype.render;
DashboardView.prototype.render = async function () { if (this.isCompact()) return this.renderCompactShell(); this.compactMode = false; return renderWideDashboard.call(this); };
module.exports = class ReadingDashboardPlugin extends Plugin { async onload() { const data = (await this.loadData()) || {}; this.fluidSettings = fluidSettings(data.fluidV14); this.dashboardSettings = { statLayout: ["single-row", "grid", "single-column"].includes(data.dashboard?.statLayout) ? data.dashboard.statLayout : "single-row" }; this.registerView(VIEW_TYPE, (leaf) => new DashboardView(leaf, this)); this.addRibbonIcon("library-big", "打开阅读吸收驾驶舱", () => this.activateView()); this.addCommand({ id: "open-reading-dashboard", name: "打开阅读吸收驾驶舱", callback: () => this.activateView() }); } async savePluginSettings() { await this.saveData({ fluidV14: this.fluidSettings, dashboard: this.dashboardSettings }); } async saveFluidSettings() { await this.savePluginSettings(); } async cycleCompactStatLayout() { const layouts = ["single-row", "grid", "single-column"], index = layouts.indexOf(this.dashboardSettings.statLayout); this.dashboardSettings.statLayout = layouts[(index + 1) % layouts.length]; await this.savePluginSettings(); new Notice(`统计卡布局：${this.dashboardSettings.statLayout === "single-row" ? "单行四卡" : this.dashboardSettings.statLayout === "grid" ? "2 × 2" : "单列四卡"}`); } async activateView() { const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0] || this.app.workspace.getRightLeaf(false); await leaf.setViewState({ type: VIEW_TYPE, active: true }); this.app.workspace.revealLeaf(leaf); } onunload() { this.app.workspace.detachLeavesOfType(VIEW_TYPE); } };

// 仅在 Obsidian 已提供右侧 split 时设置偏好的侧栏宽度；找不到 DOM 时保持官方默认行为。
const ReadingDashboardPluginClass = module.exports;
const activateReadingDashboard = ReadingDashboardPluginClass.prototype.activateView;
ReadingDashboardPluginClass.prototype.activateView = async function () { await activateReadingDashboard.call(this); try { const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0], leafEl = leaf?.containerEl?.closest?.(".workspace-leaf"); if (leafEl?.closest?.(".workspace-split.mod-right-split")) { leafEl.style.flexBasis = "420px"; leafEl.style.width = "420px"; leafEl.style.minWidth = "320px"; leafEl.style.maxWidth = "520px"; } } catch (error) { console.debug("阅读吸收驾驶舱：无法设置侧栏宽度，将使用 Obsidian 默认宽度。", error); } };

// 看板偏好扩展：字号同样写入插件数据，既影响宽屏驾驶舱，也影响右侧紧凑阅读面板。
const readingDashboardOnload = ReadingDashboardPluginClass.prototype.onload;
ReadingDashboardPluginClass.prototype.onload = async function () {
  await readingDashboardOnload.call(this);
  // 原初始化仅保留了统计布局，导致字号虽写入 data.json 却没有被重新读回。
  const saved = (await this.loadData()) || {};
  const rawScale = Number(saved.dashboard?.fontScale);
  // 旧版本的 85%--125% 会让小字号难以阅读；统一迁移到实际提供给用户的舒适范围。
  this.dashboardSettings.fontScale = Number.isFinite(rawScale) ? Math.min(1.15, Math.max(.95, rawScale)) : DASHBOARD_DEFAULTS.fontScale;
  const savedOrbitCard = saved.dashboard?.orbitCard || {};
  this.dashboardSettings.orbitCard = {
    width: Math.min(220, Math.max(80, finiteNumber(savedOrbitCard.width, DASHBOARD_DEFAULTS.orbitCard.width))),
    height: Math.min(300, Math.max(120, finiteNumber(savedOrbitCard.height, DASHBOARD_DEFAULTS.orbitCard.height))),
    offset: Math.min(180, Math.max(-180, finiteNumber(savedOrbitCard.offset, DASHBOARD_DEFAULTS.orbitCard.offset)))
  };
  const savedOrbitView = saved.dashboard?.orbitView || {};
  this.dashboardSettings.orbitView = {
    r: orbitAngle(savedOrbitView.r, DASHBOARD_DEFAULTS.orbitView.r),
    x: Math.min(12, Math.max(-18, finiteNumber(savedOrbitView.x, DASHBOARD_DEFAULTS.orbitView.x))),
    zoom: Math.min(1.35, Math.max(.72, finiteNumber(savedOrbitView.zoom, DASHBOARD_DEFAULTS.orbitView.zoom))),
    radius: Math.min(340, Math.max(190, finiteNumber(savedOrbitView.radius, DASHBOARD_DEFAULTS.orbitView.radius))),
    auto: typeof savedOrbitView.auto === "boolean" ? savedOrbitView.auto : DASHBOARD_DEFAULTS.orbitView.auto,
    speed: [.5, 1, 2].includes(Number(savedOrbitView.speed)) ? Number(savedOrbitView.speed) : DASHBOARD_DEFAULTS.orbitView.speed,
    flat: typeof savedOrbitView.flat === "boolean" ? savedOrbitView.flat : DASHBOARD_DEFAULTS.orbitView.flat
  };
  this.dashboardSettings.identity = identitySettings(saved.dashboard?.identity);
};

DashboardView.prototype.applyDashboardFontScale = function () {
  const scale = Math.min(1.15, Math.max(.95, Number(this.plugin.dashboardSettings?.fontScale) || 1));
  this.contentEl.style.setProperty("--ycs-font-scale", String(scale));
  // CSS 不能安全地以 `calc(13px * number)` 缩放既有固定 px 字号。
  // 为每个真实字号写入计算后的长度，让字体变大/变小而不缩放卡片、轨道和布局几何。
  [9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 25, 27, 29, 30, 34, 36].forEach((base) => {
    this.contentEl.style.setProperty(`--ycs-font-${base}`, `${(base * scale).toFixed(2)}px`);
  });
};

DashboardView.prototype.createDailyNote = async function () {
  const folderPath = "5-Daily 日记与复盘/01 每日记录";
  const [year, month, day] = localDate().split("-").map(Number);
  const title = `${year}年${month}月${day}日 今日记录`;
  const path = `${folderPath}/${title}.md`;
  try {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.openNoteInMain(path);
      new Notice(`已打开今天的日记《${title}》`);
      return;
    }
    if (!this.app.vault.getAbstractFileByPath(folderPath)) await this.app.vault.createFolder(folderPath);
    const date = localDate();
    const content = `---\n分类: 日记\n类型: 每日记录\n状态: 待处理\n来源: 手动\n来源链接: \"\"\n创建日期: ${date}\n更新日期: ${date}\n标签: []\n关联: []\n自动化: 否\n阅读状态: 未读\n吸收状态: 待沉淀\n---\n\n# ${title}\n\n## 今日记录\n\n\n## 今日复盘\n\n`;
    await this.app.vault.create(path, content);
    await this.openNoteInMain(path);
    new Notice(`已创建今天的日记《${title}》`);
  } catch (error) {
    console.error("创建每日记录失败", error);
    new Notice("创建每日记录失败，请检查目标文件夹是否可写。");
  }
};

DashboardView.prototype.installDailyEntry = function () {
  const sidebar = this.contentEl.querySelector(".ycs-sidebar");
  if (!sidebar || sidebar.querySelector(".ycs-create-daily")) return;
  const button = document.createElement("button");
  button.className = "ycs-create-daily";
  button.type = "button";
  button.innerHTML = "＋ 新增日记";
  button.title = "创建或打开今天的每日记录";
  button.onclick = () => { void this.createDailyNote(); };
  sidebar.querySelector("nav")?.insertAdjacentElement("afterend", button);
};

DashboardView.prototype.installFontSetting = function () {
  const button = this.contentEl.querySelector(".ycs-actions .ycs-icon");
  if (!button || button.dataset.ycsFontSettingBound) return;
  button.dataset.ycsFontSettingBound = "true";
  const openFluidSettings = button.onclick;
  button.onclick = () => {
    openFluidSettings?.call(button);
    const panel = this.contentEl.querySelector(".ycs-fluid-panel");
    const save = panel?.querySelector(".save");
    if (!panel || !save) return;
    if (!panel.querySelector("[data-font-scale]")) {
      const scale = Math.round((Number(this.plugin.dashboardSettings?.fontScale) || 1) * 100);
      save.insertAdjacentHTML("beforebegin", `<label>全局字体 <input data-font-scale type="range" min="95" max="115" step="5" value="${Math.min(115, Math.max(95, scale))}"><output>${Math.min(115, Math.max(95, scale))}%</output></label>`);
      const input = panel.querySelector("[data-font-scale]"), output = input.nextElementSibling;
      input.oninput = () => { this.plugin.dashboardSettings.fontScale = Number(input.value) / 100; output.textContent = `${input.value}%`; this.applyDashboardFontScale(); window.clearTimeout(this.fontScaleSaveTimer); this.fontScaleSaveTimer = window.setTimeout(() => { void this.plugin.savePluginSettings(); }, 160); };
      input.onchange = () => { window.clearTimeout(this.fontScaleSaveTimer); void this.plugin.savePluginSettings(); };
    }
    if (!panel.querySelector("[data-identity-settings]")) {
      const identity = identitySettings(this.plugin.dashboardSettings.identity);
      save.insertAdjacentHTML("beforebegin", `<div class="ycs-identity-setting" data-identity-settings><b>个人 IP</b><label>品牌标识 <input data-identity="brandMark" type="text" maxlength="16" value="${esc(identity.brandMark)}"></label><label>品牌名称 <input data-identity="brandName" type="text" maxlength="32" value="${esc(identity.brandName)}"></label><label>头像文字 <input data-identity="avatarText" type="text" maxlength="16" value="${esc(identity.avatarText)}"></label><label>显示名称 <input data-identity="displayName" type="text" maxlength="32" value="${esc(identity.displayName)}"></label><label>身份说明 <input data-identity="role" type="text" maxlength="32" value="${esc(identity.role)}"></label></div>`);
      const maxLengths = { brandMark: 16, brandName: 32, avatarText: 16, displayName: 32, role: 32 };
      panel.querySelectorAll("[data-identity]").forEach((input) => input.oninput = () => {
        const key = input.dataset.identity;
        if (!Object.hasOwn(maxLengths, key)) return;
        this.plugin.dashboardSettings.identity[key] = boundedText(input.value, "", maxLengths[key]);
        this.applyIdentityAppearance();
        window.clearTimeout(this.identitySaveTimer);
        this.identitySaveTimer = window.setTimeout(() => { void this.plugin.savePluginSettings(); }, 160);
      });
    }
  };
};

const renderDashboardWithFontAndDaily = DashboardView.prototype.render;
DashboardView.prototype.render = async function () {
  await renderDashboardWithFontAndDaily.call(this);
  this.applyDashboardFontScale();
  this.applyIdentityAppearance();
  // 这些是网页原型残留的装饰性控件；插件内没有相应的必要工作流。
  this.contentEl.querySelector(".ycs-search")?.remove();
  this.contentEl.querySelector(".ycs-caption")?.remove();
  this.contentEl.querySelector(".ycs-progress-controls")?.remove();
  if (!this.isCompact()) {
    this.installDailyEntry();
    this.installFontSetting();
  }
};

DashboardView.prototype.applyIdentityAppearance = function () {
  const identity = identitySettings(this.plugin.dashboardSettings?.identity);
  this.plugin.dashboardSettings.identity = identity;
  const brandMark = this.contentEl.querySelector(".ycs-brand b");
  const brandName = this.contentEl.querySelector(".ycs-brand span");
  const avatar = this.contentEl.querySelector(".ycs-workspace p>b");
  const profile = this.contentEl.querySelector(".ycs-workspace p>span");
  const detailProfile = this.contentEl.querySelector(".ycs-right .ycs-detail-grid b i")?.parentElement;
  if (brandMark) { brandMark.textContent = identity.brandMark; brandMark.hidden = identity.brandMark === ""; }
  if (brandName) { brandName.textContent = identity.brandName; brandName.hidden = identity.brandName === ""; }
  if (avatar) { avatar.textContent = identity.avatarText; avatar.hidden = identity.avatarText === ""; }
  if (profile) { profile.innerHTML = `${esc(identity.displayName)}<br><small>${esc(identity.role)}</small>`; profile.hidden = identity.displayName === "" && identity.role === ""; }
  if (detailProfile) { detailProfile.innerHTML = `<i>${esc(identity.avatarText)}</i>${esc(identity.displayName)}`; detailProfile.hidden = identity.avatarText === "" && identity.displayName === ""; }
};

// 未接入真实 AI 服务前，不展示会误导用户的静态“AI 助手建议”。
const renderDashboardDetailWithoutPlaceholder = DashboardView.prototype.renderDetail;
DashboardView.prototype.renderDetail = function (root) {
  renderDashboardDetailWithoutPlaceholder.call(this, root);
  root?.querySelector(".ycs-ai")?.remove();
  const note = this.active();
  if (!root || !note) return;
  const frontmatter = this.app.metadataCache.getFileCache(note.file)?.frontmatter || {};
  const text = (value) => Array.isArray(value) ? value.map(String).filter(Boolean).join(" · ") : String(value ?? "").trim();
  const source = text(frontmatter["来源"]), sourceLink = text(frontmatter["来源链接"]), tags = text(frontmatter["标签"]);
  const start = text(frontmatter["开始阅读"]) || "尚未开始", completed = text(frontmatter["完成阅读"]) || "未完成", updated = text(frontmatter["状态更新时间"]);
  const sourceValue = sourceLink && /^https?:\/\//i.test(sourceLink) ? `<a href="${esc(sourceLink)}" target="_blank" rel="noopener">${esc(source || sourceLink)}</a>` : esc(source);
  const openingLabel = [...root.querySelectorAll(".ycs-detail-grid > span")].find((element) => element.textContent.trim() === "打开方式");
  if (openingLabel) openingLabel.nextElementSibling?.remove();
  openingLabel?.remove();
  const extra = document.createElement("section");
  extra.className = "ycs-detail-extra";
  extra.innerHTML = `${source ? `<div><span>来源</span><b>${sourceValue}</b></div>` : ""}${tags ? `<div><span>标签</span><b>${esc(tags)}</b></div>` : ""}<div><span>阅读节点</span><b>开始：${esc(start)}　完成：${esc(completed)}${updated ? `　更新：${esc(updated)}` : ""}</b></div>`;
  root.querySelector(".ycs-detail-desc")?.replaceWith(extra);
  const relations = Array.isArray(frontmatter["关联"]) ? frontmatter["关联"].map(text).filter(Boolean) : text(frontmatter["关联"]) ? [text(frontmatter["关联"])] : [];
  const relationNames = relations.map((value) => value.replace(/^\[\[|\]\]$/g, "").split("|").at(-1).trim());
  const classification = text(frontmatter["分类"]) || "—", documentType = text(frontmatter["类型"]) || "—", flowStatus = text(frontmatter["状态"]) || "—";
  const lastUpdated = text(frontmatter["更新日期"]) || dateText(new Date(note.file.stat.mtime).toISOString());
  const relationSummary = relationNames.length === 0 ? "—" : relationNames.length <= 3 ? relationNames.join("、") : `共 ${relationNames.length} 条关联`;
  const context = document.createElement("section");
  context.className = "ycs-detail-context";
  context.innerHTML = `<div><span>分类类型</span><b>${esc(classification)} / ${esc(documentType)}</b></div><div><span>资料状态</span><b>${esc(flowStatus)}</b></div><div><span>最后更新</span><b>${esc(lastUpdated)}</b></div><div><span>全文统计</span><b data-text-stats>统计中…</b></div><div><span>关联笔记</span><b title="${esc(relationNames.join("、"))}">${esc(relationSummary)}</b></div>`;
  root.appendChild(context);
  void this.updateDetailTextStats(note, context);
};

DashboardView.prototype.updateDetailTextStats = async function (note, context) {
  try {
    const content = await this.app.vault.cachedRead(note.file);
    if (!context.isConnected) return;
    const body = content.replace(/^---[\s\S]*?---\s*/u, "").replace(/```[\s\S]*?```/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[>#*_`~|\-]/g, " ");
    const chinese = (body.match(/[\u4e00-\u9fff]/g) || []).length;
    const words = (body.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) || []).length;
    const count = chinese + words;
    const reading = count < 220 ? "<1分钟" : `${Math.ceil(count / 220)}分钟`;
    const target = context.querySelector("[data-text-stats]");
    if (target) target.textContent = `全文 ${count.toLocaleString()} 字 · 预估阅读 ${reading}`;
  } catch (error) {
    console.warn("笔记详情：无法统计字数", error);
    const target = context.querySelector("[data-text-stats]");
    if (target) target.textContent = "—";
  }
};

// 统计卡保留数据与流体动画，移除没有交互含义的右上角装饰图标。
DashboardView.prototype.stat = function (label, value, caption, _icon, slim = false) {
  const id = ["今日新增", "未读库存", "已经阅读", "长期未读"].indexOf(label);
  const cardKey = ["today", "unread", "read", "backlog"][Math.max(0, id)];
  return `<article class="ycs-stat ycs-glass ycs-fluid-stat ${slim ? "ycs-slim" : ""}" data-fluid-card="${cardKey}"><canvas class="ycs-fluid-canvas" aria-hidden="true"></canvas><div class="ycs-fluid-noise" aria-hidden="true"></div><div class="ycs-fluid-fallback" aria-hidden="true"></div><div class="ycs-stat-content"><div class="ycs-stat-title">${label}</div><div><span class="ycs-stat-value">${value}</span><span class="ycs-stat-unit">篇笔记</span></div><div class="ycs-stat-change">${caption}</div></div></article>`;
};

// 年度热力图只使用可追溯日期：创建日期、完成阅读日期与当前待沉淀状态。
const renderCompactWithAnnualTimeline = DashboardView.prototype.renderCompact;
DashboardView.prototype.renderCompact = function (root, stats, long, pending) {
  renderCompactWithAnnualTimeline.call(this, root, stats, long, pending);
  if (this.contentEl.querySelector(".ycs-compact-timeline")) return;
  const timeline = document.createElement("section");
  timeline.className = "ycs-timeline ycs-compact-timeline";
  timeline.setAttribute("aria-label", "年度阅读热力");
  const detail = root.querySelector(".ycs-compact-detail");
  if (detail) detail.insertAdjacentElement("beforebegin", timeline);
  else root.appendChild(timeline);
};

const notesWithReadingDates = DashboardView.prototype.notes;
DashboardView.prototype.notes = function () {
  return notesWithReadingDates.call(this).map((note) => {
    const frontmatter = this.app.metadataCache.getFileCache(note.file)?.frontmatter || {};
    return { ...note, completed: dateKey(frontmatter["完成阅读"]), statusUpdated: dateKey(frontmatter["状态更新时间"]) };
  });
};

DashboardView.prototype.buildAnnualReadingDays = function () {
  const today = new Date();
  const dates = [];
  for (let offset = 364; offset >= 0; offset -= 1) {
    const value = new Date(today);
    value.setDate(today.getDate() - offset);
    dates.push(new Date(value - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  }
  const rows = new Map(dates.map((date) => [date, { date, added: 0, read: 0, pending: 0 }]));
  this.state.notes.forEach((note) => {
    const created = dateText(note.created), completed = note.completed;
    // 与顶部“今日新增”使用同一可信口径：只有 frontmatter 创建日期才算入库。
    if (note.createdFromFrontmatter && rows.has(created)) rows.get(created).added += 1;
    if (rows.has(completed)) {
      const row = rows.get(completed);
      row.read += 1;
      if (note.absorption === "待沉淀") row.pending += 1;
    }
  });
  return dates.map((date) => rows.get(date));
};

DashboardView.prototype.renderAnnualReadingTimeline = function () {
  const timeline = this.contentEl.querySelector(".ycs-timeline");
  if (!timeline) return;
  // 新日期在最前：打开面板先看到今天，再向右回看历史。
  const days = this.buildAnnualReadingDays().reverse(), maxAdded = Math.max(1, ...days.map((day) => day.added)), maxRead = Math.max(1, ...days.map((day) => day.read));
  let runningAdded = 0, runningRead = 0;
  const trend = days.map((day, index) => { runningAdded += day.added; runningRead += day.read; return { index, added: runningAdded, read: runningRead }; });
  const line = (key) => {
    const max = Math.max(1, ...trend.map((point) => point[key]));
    return trend.map((point, index) => `${index ? "L" : "M"}${(point.index / Math.max(1, trend.length - 1) * 100).toFixed(2)},${(92 - point[key] / max * 76).toFixed(2)}`).join(" ");
  };
  const today = localDate(), firstWeekday = (new Date(`${days[0].date}T12:00:00`).getDay() + 6) % 7;
  const emptyCells = Array.from({ length: firstWeekday }, () => `<span class="ycs-heat-empty"></span>`).join("");
  const cells = days.map((day) => {
    const addedLevel = Math.min(1, day.added / maxAdded).toFixed(3), readLevel = Math.min(1, day.read / maxRead).toFixed(3);
    return `<button class="ycs-heat-cell ${day.date === today ? "is-today" : ""}" type="button" data-heat-date="${day.date}" data-added="${day.added}" data-read="${day.read}" data-pending="${day.pending}" style="--ycs-added:${addedLevel};--ycs-read:${readLevel}" aria-label="${day.date}：新增 ${day.added}，已读 ${day.read}，待沉淀 ${day.pending}"></button>`;
  }).join("");
  const total = this.state.notes.length, read = this.state.notes.filter((note) => note.reading === "已读").length, pending = this.state.notes.filter((note) => note.reading === "已读" && note.absorption === "待沉淀").length, unread = this.state.notes.filter((note) => note.reading === "未读").length, todayRow = days[0];
  timeline.innerHTML = `<div class="ycs-annual-head"><div><b>阅读时间轴</b><small>近一年 · 真实阅读行为</small></div><time>${today}</time><button class="ycs-heat-today" type="button">回到今日</button></div><div class="ycs-annual-today">今日新增：<strong>${todayRow.added}</strong> 篇</div><div class="ycs-annual-stock">全库总计：${total} 篇 <i></i> 已读：${read} 篇 <i></i> 待沉淀：${pending} 篇 <i></i> 未读积压：${unread} 篇</div><div class="ycs-annual-body"><section class="ycs-trend"><div class="ycs-trend-title">累计趋势</div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="累计入库与累计已读趋势"><path class="ycs-trend-added" d="${line("added")}"/><path class="ycs-trend-read" d="${line("read")}"/></svg><div class="ycs-trend-legend"><span>累计入库</span><span>累计已读</span></div></section><section class="ycs-heat"><div class="ycs-heat-title">年度阅读热力</div><div class="ycs-heat-scroll"><div class="ycs-heat-grid">${emptyCells}${cells}</div></div><div class="ycs-heat-months"><span>9月</span><span>11月</span><span>1月</span><span>3月</span><span>5月</span><span>7月</span><span>今天</span></div><div class="ycs-heat-legend"><span>无操作</span><span>仅新增</span><span>少量已读</span><span>高阅读量</span></div><div class="ycs-heat-tooltip" role="status" aria-live="polite"></div></section></div>`;
  const monthLabels = days.filter((day, index) => index === 0 || day.date.slice(8) === "01" || index === days.length - 1).map((day) => `${Number(day.date.slice(5, 7))}月`);
  timeline.querySelector(".ycs-heat-months").innerHTML = monthLabels.map((label) => `<span>${label}</span>`).join("");
  const heatScroll = timeline.querySelector(".ycs-heat-scroll"), todayCell = timeline.querySelector(".ycs-heat-cell.is-today"), tooltip = timeline.querySelector(".ycs-heat-tooltip");
  timeline.querySelector(".ycs-trend")?.remove();
  timeline.querySelector(".ycs-annual-body")?.classList.add("heat-only");
  timeline.querySelector(".ycs-heat-today").onclick = () => heatScroll?.scrollTo({ left: 0, behavior: "smooth" });
  timeline.querySelectorAll(".ycs-heat-cell").forEach((cell) => {
    const show = () => { tooltip.innerHTML = `<b>${cell.dataset.heatDate}</b><span>今日入库：${cell.dataset.added} 篇</span><span>今日读完：${cell.dataset.read} 篇</span><span>新增待沉淀：${cell.dataset.pending} 篇</span>`; tooltip.classList.add("is-visible"); };
    cell.onpointerenter = show;
    cell.onpointerleave = () => tooltip.classList.remove("is-visible");
    cell.onfocus = show;
    cell.onblur = () => tooltip.classList.remove("is-visible");
  });
  if (heatScroll && todayCell) window.requestAnimationFrame(() => { heatScroll.scrollLeft = 0; });
};

DashboardView.prototype.stripDashboardDecorations = function () {
  this.contentEl.querySelectorAll(".ycs-sidebar nav i,.ycs-sidebar nav em,.ycs-group-head > i,.ycs-group-head > b").forEach((element) => element.remove());
  const workspaceName = this.contentEl.querySelector(".ycs-workspace > div");
  if (workspaceName) workspaceName.textContent = this.app.vault.getName();
  const detailHead = this.contentEl.querySelector(".ycs-right-head");
  if (detailHead) detailHead.textContent = "笔记详情";
  this.contentEl.querySelector(".ycs-detail-id")?.remove();
  this.contentEl.querySelectorAll(".ycs-right .ycs-open,.ycs-compact-detail .ycs-open").forEach((button) => button.remove());
  const labels = [[".ycs-orbit-mode", "3D 环绕"], [".ycs-auto", "自动巡航"], [".ycs-reset", "复位视角"], [".ycs-folder-filter", "全部目录"]];
  labels.forEach(([selector, text]) => { const button = this.contentEl.querySelector(selector); if (button) button.textContent = text; });
};

// 3D 卡片的几何尺寸与水平位置独立保存：不再把滚轮缩放误当作宽高调整。
const bindOrbitWithIndependentCardGeometry = DashboardView.prototype.bindOrbit;
DashboardView.prototype.bindOrbit = function (root) {
  const saved = this.plugin.dashboardSettings?.orbitCard || { width: 120, height: 182, offset: 0 };
  const orbit = this.state.orbit;
  if (!orbit.preferencesLoaded) {
    const view = this.plugin.dashboardSettings?.orbitView || {};
    orbit.r = orbitAngle(view.r, orbit.r);
    orbit.x = Math.min(12, Math.max(-18, Number.isFinite(Number(view.x)) ? Number(view.x) : orbit.x));
    orbit.zoom = Math.min(1.35, Math.max(.72, Number.isFinite(Number(view.zoom)) ? Number(view.zoom) : orbit.zoom));
    orbit.radius = Math.min(340, Math.max(190, Number.isFinite(Number(view.radius)) ? Number(view.radius) : orbit.radius));
    orbit.auto = typeof view.auto === "boolean" ? view.auto : orbit.auto;
    orbit.speed = [.5, 1, 2].includes(Number(view.speed)) ? Number(view.speed) : orbit.speed;
    orbit.flat = typeof view.flat === "boolean" ? view.flat : orbit.flat;
    orbit.preferencesLoaded = true;
  }
  orbit.cardWidth = Math.min(220, Math.max(80, Number(saved.width) || 120));
  orbit.cardHeight = Math.min(300, Math.max(120, Number(saved.height) || 182));
  orbit.cardOffset = Math.min(180, Math.max(-180, Number(saved.offset) || 0));
  bindOrbitWithIndependentCardGeometry.call(this, root);
  const modeButton = root.querySelector(".ycs-orbit-mode"), autoButton = root.querySelector(".ycs-auto"), speedButton = root.querySelector(".ycs-speed");
  modeButton?.classList.toggle("active", !orbit.flat);
  if (modeButton) modeButton.textContent = orbit.flat ? "平面目录" : "3D 环绕";
  root.querySelector(".ycs-stage")?.classList.toggle("is-flat", orbit.flat);
  autoButton?.classList.toggle("active", orbit.auto);
  if (autoButton) autoButton.textContent = orbit.auto ? "自动巡航" : "已暂停";
  if (speedButton) speedButton.textContent = `速度 ${orbit.speed}×`;
  const toolbar = root.querySelector(".ycs-toolbar > span:first-child");
  const stage = root.querySelector(".ycs-stage");
  if (!toolbar || !stage || toolbar.querySelector(".ycs-card-geometry-toggle")) return;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "ycs-card-geometry-toggle";
  toggle.textContent = "卡片调整";
  toolbar.appendChild(toggle);
  const panel = document.createElement("section");
  panel.className = "ycs-card-geometry-panel";
  panel.hidden = true;
  panel.innerHTML = `<label>横向宽度 <input data-geometry="width" type="range" min="80" max="220" step="1" value="${orbit.cardWidth}"><output>${orbit.cardWidth}px</output></label><label>纵向高度 <input data-geometry="height" type="range" min="120" max="300" step="1" value="${orbit.cardHeight}"><output>${orbit.cardHeight}px</output></label><label>整体左右 <input data-geometry="offset" type="range" min="-180" max="180" step="1" value="${orbit.cardOffset}"><output>${orbit.cardOffset}px</output></label>`;
  stage.appendChild(panel);
  const persist = () => {
    this.plugin.dashboardSettings.orbitCard = { width: orbit.cardWidth, height: orbit.cardHeight, offset: orbit.cardOffset };
    window.clearTimeout(this.orbitCardSaveTimer);
    this.orbitCardSaveTimer = window.setTimeout(() => { void this.plugin.savePluginSettings(); }, 180);
  };
  const apply = () => {
    stage.style.setProperty("--ycs-card-width", `${orbit.cardWidth}px`);
    stage.style.setProperty("--ycs-card-height", `${orbit.cardHeight}px`);
    root.querySelectorAll(".ycs-orbit-card").forEach((card) => {
      card.style.setProperty("--ycs-card-width", `${orbit.cardWidth}px`);
      card.style.setProperty("--ycs-card-height", `${orbit.cardHeight}px`);
    });
    persist();
  };
  panel.onpointerdown = (event) => event.stopPropagation();
  panel.querySelectorAll("input[data-geometry]").forEach((input) => input.oninput = () => {
    const key = input.dataset.geometry;
    if (key === "width") orbit.cardWidth = Number(input.value);
    if (key === "height") orbit.cardHeight = Number(input.value);
    if (key === "offset") orbit.cardOffset = Number(input.value);
    input.nextElementSibling.textContent = `${input.value}px`;
    apply();
  });
  toggle.onclick = () => { panel.hidden = !panel.hidden; toggle.classList.toggle("active", !panel.hidden); };
  apply();
};

DashboardView.prototype.persistOrbitView = function () {
  const orbit = this.state?.orbit;
  if (!orbit) return;
  orbit.r = orbitAngle(orbit.r, -24);
  orbit.x = Math.min(12, Math.max(-18, Number(orbit.x) || 0));
  orbit.zoom = Math.min(1.35, Math.max(.72, Number(orbit.zoom) || 1));
  orbit.radius = Math.min(340, Math.max(190, Number(orbit.radius) || 240));
  orbit.speed = [.5, 1, 2].includes(Number(orbit.speed)) ? Number(orbit.speed) : 1;
  orbit.auto = Boolean(orbit.auto); orbit.flat = Boolean(orbit.flat);
  this.plugin.dashboardSettings.orbitView = { r: orbit.r, x: orbit.x, zoom: orbit.zoom, radius: orbit.radius, auto: orbit.auto, speed: orbit.speed, flat: orbit.flat };
  window.clearTimeout(this.orbitViewSaveTimer);
  this.orbitViewSaveTimer = window.setTimeout(() => { void this.plugin.savePluginSettings(); }, 180);
};

const renderDashboardWithAnnualTimeline = DashboardView.prototype.render;
DashboardView.prototype.getReadingCompletionRate = function () {
  const total = Array.isArray(this.state?.notes) ? this.state.notes.length : 0;
  if (!total) return 0;
  const completed = this.state.notes.filter((note) => note.reading === "已读").length;
  return completed / total * 100;
};
DashboardView.prototype.refreshReadingCompletionRate = function () {
  const rate = this.getReadingCompletionRate();
  const progress = this.contentEl.querySelector(".ycs-progress");
  if (!progress) return;
  const label = rate > 0 && rate < 0.01 ? "<0.01%" : (rate < 1 ? rate.toFixed(2) : rate.toFixed(1)) + "%";
  const value = progress.querySelector("b");
  const bar = progress.querySelector("em");
  if (value) value.textContent = label;
  if (bar) {
    bar.style.width = rate + "%";
    // 极低完成率仍保留一条可见的进度提示，不改变实际百分比文本。
    bar.style.minWidth = rate > 0 ? "2px" : "0";
  }
};
DashboardView.prototype.render = async function () {
  await renderDashboardWithAnnualTimeline.call(this);
  this.refreshReadingCompletionRate();
  this.renderAnnualReadingTimeline();
  this.stripDashboardDecorations();
};

// BEGIN SECOND BRAIN ADAPTERS
// Upstream: csuyincs-creator/Baixiao-Reading-Cockpit @ 99c34d0a15398636fdbf4e497e76347cdd91fcf4
(function(module) {
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

  PluginClass.prototype.activateView = async function (page) {
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
    if (['home', 'projects', 'dashboard', 'table'].includes(page) && leaf.view?.navigateSecondBrain) {
      await leaf.view.navigateSecondBrain(page);
    }
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
    this.registerObsidianProtocolHandler(PROTOCOL, (params = {}) => {
      void this.activateView(params.page).catch((error) => {
        console.warn("Second Brain cockpit could not open.", error);
        notify("驾驶舱未能打开，请从命令面板重试。");
      });
    });
  };
  DashboardView.prototype.getDisplayText = function () { return "第二大脑 · 驾驶舱"; };
  Object.defineProperty(DashboardView.prototype, INSTALLED, { value: true });
}

module.exports = { install };

module.exports.install({DashboardView,PluginClass:ReadingDashboardPluginClass,TFile,Notice,dateKey,localDate});
})({exports:{}});
(function(module) {
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

module.exports.install({DashboardView,TFile,dateKey,parseYaml:require('obsidian').parseYaml});
})({exports:{}});
(function(module) {
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
  proto.navigateSecondBrain = function (page, filter = 'all') {
    if (!['home', 'projects', 'dashboard', 'table'].includes(page)) return;
    this.state.page = page;
    this.state.filter = filter;
    this.state.folderFilter = '';
    return this.render();
  };
  proto.renderSecondBrainNavigation = function () {
    const sidebar = this.contentEl.querySelector('.ycs-sidebar nav');
    if (!sidebar) return;
    sidebar.innerHTML = [['第二大脑首页','home','all'],['项目总览','projects','all'],['阅读驾驶舱','dashboard','all'],['阅读书架','table','all'],['正在阅读','dashboard','reading'],['状态未登记','dashboard','unknown']].map(([label,page,filter]) => `<button data-page="${page}" data-filter="${filter}" class="${this.state.page===page&&this.state.filter===filter?'active':''}">${label}<em>›</em></button>`).join('');
    sidebar.querySelectorAll('[data-page]').forEach(b => b.onclick = () => void this.navigateSecondBrain(b.dataset.page, b.dataset.filter));
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
  proto.renderSecondBrainMetric = function (index, label, value, caption, unit) {
    const original = ['今日新增','未读库存','已经阅读','长期未读'][index % 4];
    return stat.call(this, original, esc(String(value)), esc(caption), '', false)
      .replace(`>${original}<`, `>${esc(label)}<`).replace('篇笔记', esc(unit));
  };
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
    routes.innerHTML='<button data-view="home">第二大脑首页</button><button data-view="projects">项目总览</button><button data-view="dashboard">阅读驾驶舱</button><button data-view="table">阅读书架</button>';
    parent.after(routes);
    routes.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',this.state.page===b.dataset.view);b.setAttribute('aria-current',this.state.page===b.dataset.view?'page':'false');b.onclick=()=>void this.navigateSecondBrain(b.dataset.view);});
    routes.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>void open(this,routePaths[b.dataset.route]));
    if (['home', 'projects'].includes(this.state.page)) return;
    const source = document.createElement('button'); source.textContent='书籍笔记视图'; source.onclick=()=>void open(this,routePaths.shelf); routes.appendChild(source);
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
    this.renderSecondBrainNavigation();
    const progress=this.contentEl.querySelector('.ycs-progress');
    if(progress){const label=[...progress.children].find(el=>el.tagName==='DIV'&&!el.classList.contains('ycs-progress-controls'));if(label)label.textContent='已读占比';const small=progress.querySelector('small');if(small)small.textContent=`已读 / ${this.state.notes.length} 本（含未登记）`;}
    this.installSecondBrainRoutes();
  };
  const close=proto.onClose;
  proto.onClose=async function(){window.clearTimeout(this.timer);window.clearTimeout(this.newNoteTimer);window.clearTimeout(this.orbitCardSaveTimer);window.clearTimeout(this.orbitViewSaveTimer);return close.call(this);};
};

module.exports({DashboardView,esc,dateKey,localDate});
})({exports:{}});
(function(module) {
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

module.exports({DashboardView,PluginClass:ReadingDashboardPluginClass,esc,Notice,MarkdownRenderer:require('obsidian').MarkdownRenderer,Component:require('obsidian').Component});
})({exports:{}});
