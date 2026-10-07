// Manual QuickAdd entries. No network, shell commands, deletion, or existing-note writes.
// Templates retain their Obsidian-native syntax. Content review follows AGENTS/ROUTER.
const kinds = {
  fiction: { template: 'Book-Fiction', folder: '03_Books/Fiction', scope: '03_Books', prefix: 'book' },
  nonfiction: { template: 'Book-Nonfiction', folder: '03_Books/Nonfiction', scope: '03_Books', prefix: 'book' },
  video: { template: 'Video', folder: '04_Media/Videos', scope: '04_Media', prefix: 'video' },
  knowledge: { template: 'Knowledge', folder: '01_Knowledge', scope: '01_Knowledge', prefix: 'concept' },
  thought: { template: 'Thought', folder: '05_Personal', scope: '05_Personal', prefix: 'thought' },
  daily: { template: 'Daily', folder: '06_Daily', scope: '06_Daily', prefix: 'daily' },
};
const normalize = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s《》]/g, '');
const inFolder = (path, folder) => path.startsWith(folder + '/');

async function chooseKind(api, bookOnly = false) {
  return api.suggester(
    bookOnly ? ['Fiction：小说', 'Nonfiction：非虚构'] : ['书籍：Fiction', '书籍：Nonfiction', '视频', '知识', '想法', '每日记录'],
    bookOnly ? ['fiction', 'nonfiction'] : Object.keys(kinds),
    '选择类型，使用已有模板'
  );
}

async function create(params, kind, inbox = false) {
  const { app, quickAddApi: api, obsidian } = params;
  if (!kind || !kinds[kind]) return;
  // QuickAdd supplies the Obsidian API at invocation, not via Node module resolution.
  if (typeof obsidian?.Notice !== 'function' || typeof obsidian?.parseYaml !== 'function') {
    throw new Error('QuickAdd runtime must provide params.obsidian.Notice and parseYaml; no file was created.');
  }
  const { Notice, parseYaml } = obsidian;
  const config = kinds[kind];
  // System timezone by default; explicit IANA override comes from user-local config.
  let timezone = 'SYSTEM';
  const configFile = app.vault.getAbstractFileByPath('09_System/Config/local.json');
  if (configFile) timezone = JSON.parse(await app.vault.read(configFile)).timezone || 'SYSTEM';
  const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  if (timezone !== 'SYSTEM' && timezone !== 'AUTO') dateOptions.timeZone = timezone;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    ...dateOptions,
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const compactDate = today.replace(/-/g, '');
  const title = kind === 'daily' && !inbox ? today : (await api.inputPrompt('笔记标题', '已有同名记录将直接打开，不覆盖'))?.trim();
  if (!title) return;
  if (/[\\/:*?"<>|\r\n]/.test(title) || /[. ]$/.test(title) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(title) || title.length > 120) {
    new Notice('标题含不支持的文件名字符、保留名称或过长；未创建文件。');
    return;
  }
  const folder = inbox ? '00_Inbox' : config.folder;
  const path = `${folder}/${title}.md`;
  const open = async (file, message) => {
    await app.workspace.getLeaf(false).openFile(file);
    if (message) new Notice(message);
  };
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) {
    if (existing.extension === 'md') await open(existing, '已打开已有笔记；未覆盖或追加内容。');
    else new Notice('目标路径已存在；未创建文件。');
    return;
  }
  const scopes = [...new Set([config.scope, '00_Inbox'])];
  const relevantFiles = app.vault.getMarkdownFiles().filter(file => scopes.some(scope => inFolder(file.path, scope)));
  const records = [];
  for (const file of relevantFiles) {
    let fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) {
      const raw = await app.vault.cachedRead(file);
      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (match) {
        try { fm = parseYaml(match[1]); }
        catch { throw new Error(`相关笔记 YAML 无法解析，请先检查：${file.path}`); }
      }
    }
    fm = fm ?? {};
    records.push({ file, fm });
    if (normalize(file.basename) === normalize(title) || normalize(fm.title) === normalize(title)) {
      await open(file, '发现同名记录，已打开；未创建重复文件。');
      return;
    }
  }
  const source = kind === 'daily' ? '' : (await api.inputPrompt('原始来源（可留空）', 'URL 或真实来源说明；不自动获取或生成摘要'))?.trim();
  // Undefined/null means the prompt was cancelled, rather than an intentionally empty source.
  if (kind !== 'daily' && source == null) return;
  if (source) {
    const canonical = value => {
      try { const url = new URL(String(value)); url.hash = ''; return url.href.replace(/\/$/, ''); }
      catch { return String(value).trim(); }
    };
    for (const { file, fm } of records) {
      if (Array.isArray(fm.sources) && fm.sources.some(value => canonical(value) === canonical(source))) {
        await open(file, '发现已有同来源记录，已打开；未创建重复文件。');
        return;
      }
    }
  }
  const ids = new Set(records.map(record => record.fm.id).filter(Boolean));
  let id;
  if (kind === 'daily') id = `daily_${compactDate}`;
  else if (kind === 'thought') {
    const prefix = 'thought';
    let sequence = 1;
    do { id = `${prefix}_${compactDate}_${String(sequence++).padStart(3, '0')}`; } while (ids.has(id));
  } else {
    const slug = title.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '-');
    const base = `${config.prefix}_${slug}`;
    id = base;
    let sequence = 2;
    while (ids.has(id)) id = `${base}_${sequence++}`;
  }
  if (ids.has(id)) { new Notice(`已有相同 ID：${id}；未创建文件。`); return; }
  const templatePath = `09_System/Templates/${config.template}.md`;
  const template = app.vault.getAbstractFileByPath(templatePath);
  if (!template || template.extension !== 'md') throw new Error(`模板不存在：${templatePath}`);
  let content = await app.vault.read(template);
  content = content.replace(/{{\s*title\s*}}/g, () => title)
    .replace(/{{\s*date\s*:\s*YYYY-MM-DD\s*}}/g, today)
    .replace(/{{\s*date\s*:\s*YYYYMMDD\s*}}/g, compactDate);
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) throw new Error('模板缺少 YAML Properties；未创建文件。');
  let yaml = frontmatter[1].replace(/^id:.*$/m, () => `id: ${JSON.stringify(id)}`);
  if (/^title:/m.test(yaml)) yaml = yaml.replace(/^title:.*$/m, () => `title: ${JSON.stringify(title)}`);
  if (source) yaml = yaml.replace(/^sources:.*$/m, () => `sources:\n  - ${JSON.stringify(source)}`);
  parseYaml(yaml); // Validate before any write.
  content = content.replace(frontmatter[0], () => `---\n${yaml}\n---\n`);
  if (content.replace(/<!--[\s\S]*?-->/g, '').match(/{{[^}]+}}|<slug>|<序号>/)) throw new Error('尚有未解析的模板占位符；未创建文件。');
  if (!app.vault.getAbstractFileByPath(folder)) throw new Error(`目标目录不存在：${folder}`);
  // Vault.create refuses an existing path; never modify or append to an existing file.
  let file;
  try { file = await app.vault.create(path, content); }
  catch (error) {
    const racedFile = app.vault.getAbstractFileByPath(path);
    if (racedFile?.extension === 'md') { await open(racedFile, '目标已被创建，已打开；未覆盖。'); return; }
    throw error;
  }
  await open(file, inbox ? '已捕获到 Inbox，等待按 Workflow 整理。' : '已建立模板笔记；内容与语义关联仍需按 Workflow 整理。');
}

// Separate exports are selected by QuickAdd's documented script::member syntax.
module.exports = {
  inbox: async params => create(params, await chooseKind(params.quickAddApi), true),
  book: async params => create(params, await chooseKind(params.quickAddApi, true)),
  video: async params => create(params, 'video'),
  knowledge: async params => create(params, 'knowledge'),
  thought: async params => create(params, 'thought'),
  daily: async params => create(params, 'daily'),
};
