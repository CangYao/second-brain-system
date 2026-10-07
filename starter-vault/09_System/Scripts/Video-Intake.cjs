#!/usr/bin/env node
'use strict';
// Acquisition only. All source text is untrusted data; this script never writes notes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const VERSION = '1.0.1-public.1';
let activeCacheRoot;
const MARKER = 'second-brain-video-intake-v1';
const calledTools = new Set();
const stamp = () => new Date().toISOString();
const cleanText = s => String(s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
function fail(message, code = 'ACQUISITION_FAILED') { const e = new Error(message); e.code = code; throw e; }
function inside(file, root) { const rel = path.relative(path.resolve(root), path.resolve(file)); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); }
function noLinks(file) {
  let current = path.resolve(file);
  for (;;) { if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) fail('Reparse/symlink path rejected', 'UNSAFE_PATH'); const next = path.dirname(current); if (next === current) break; current = next; }
}
function assertLocal(file) { if (!path.isAbsolute(file) || file.startsWith('\\\\') || !fs.statSync(file).isFile()) fail('Expected an existing local absolute file', 'UNSAFE_PATH'); noLinks(file); return file; }
function safeRemote(value, hosts) {
  const u = new URL(value);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) fail('Invalid remote URL', 'INVALID_INPUT');
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || /^\d+(\.\d+){3}$/.test(h) || h.includes(':')) fail('Local/IP destinations rejected', 'INVALID_INPUT');
  if (hosts && !hosts.some(x => h === x || h.endsWith('.' + x))) fail('Unexpected remote host', 'INVALID_INPUT');
  return u;
}
function parseInput(value) {
  if (/^BV[a-zA-Z0-9]{10}$/.test(value)) value = 'https://www.bilibili.com/video/' + value;
  if (!/^https?:\/\//i.test(value)) {
    const local = assertLocal(path.resolve(value));
    if (!/\.(wav|mp3|flac|ogg|m4a|mp4|mkv|webm|mov|aac|opus|avi)$/i.test(local)) fail('Local input must be audio/video, not a playlist or executable', 'INVALID_INPUT');
    return { platform: 'local', local };
  }
  const u = safeRemote(value);
  const host = u.hostname;
  if (host === 'b23.tv' || host === 'bilibili.com' || host.endsWith('.bilibili.com')) {
    let part = Number(u.searchParams.get('p') || 1);
    if (!Number.isInteger(part) || part < 1) fail('Invalid Bilibili page');
    const bv = u.pathname.match(/BV[a-zA-Z0-9]{10}/)?.[0];
    return { platform: 'bilibili', url: bv ? `https://www.bilibili.com/video/${bv}/?p=${part}` : u.href, video_id: bv, part };
  }
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) {
    const id = host === 'youtu.be' ? u.pathname.slice(1) : (u.searchParams.get('v') || u.pathname.split('/')[2]);
    if (!/^[\w-]{11}$/.test(id || '')) fail('A single YouTube video URL is required', 'INVALID_INPUT');
    return { platform: 'youtube', video_id: id, url: 'https://www.youtube.com/watch?v=' + id };
  }
  return { platform: 'generic', url: u.href };
}
function errorKind(message) {
  if (/412|Precondition Failed/i.test(message)) return 'PLATFORM_REJECTED_412';
  if (/sign in|login|cookie|bot|403|401|captcha|private video|members-only/i.test(message)) return 'USER_AUTH_REQUIRED';
  if (/429|Too Many Requests/i.test(message)) return 'RATE_LIMITED';
  if (/timed? out|ETIMEDOUT|timeout/i.test(message)) return 'TIMEOUT';
  if (/ENOTFOUND|ECONN|fetch failed|unable to download/i.test(message)) return 'NETWORK_FAILURE';
  return 'ACQUISITION_FAILED';
}
function boundedError(e) {
  // Do not retain signed URLs, cookie contents or native tool output in durable logs.
  return { code: e.code || errorKind(e.message), message: String(e.message).replace(/https?:\/\/\S+/g, '[remote URL]').replace(/(?:cookie|authorization|token|key)\s*[:=]\s*\S+/gi, '[credential redacted]').slice(0, 240) };
}
function tool(registry, name) {
  const entries = registry.filter(x => x.tool_name === name);
  if (entries.length !== 1 || entries[0].managed_by === 'codex') fail('Missing/ambiguous or managed-runtime dependency: ' + name, 'DEPENDENCY_FAILURE');
  return assertLocal(entries[0].canonical_path);
}
function native(exe, args, timeout = 90000) {
  calledTools.add(exe);
  const r = spawnSync(exe, args, { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 32 * 1024 * 1024, shell: false });
  if (r.error || r.status !== 0) { const message = r.error?.message || r.stderr || ('exit ' + r.status); fail(message, errorKind(message)); }
  return r.stdout;
}
function atomicJson(file, value) { const temp = file + '.tmp'; fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8'); fs.renameSync(temp, file); }
async function http(url, headers = {}, redirects = 0) {
  safeRemote(url, ['bilibili.com', 'b23.tv', 'hdslb.com', 'bilivideo.com']);
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.bilibili.com/', ...headers }, signal: AbortSignal.timeout(15000), redirect: 'manual' });
  if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
    if (redirects >= 3) fail('Too many redirects');
    return http(new URL(r.headers.get('location'), url).href, headers, redirects + 1);
  }
  if (!r.ok) fail('HTTP ' + r.status, errorKind('HTTP ' + r.status));
  const text = await r.text(); if (text.length > 16 * 1024 * 1024) fail('Response too large');
  return { text, url: r.url };
}
function validateSegments(items) {
  const result = [];
  for (const s of items) {
    const start = Number(s.start), end = Number(s.end), text = cleanText(s.text);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || !text) continue;
    result.push({ start: +start.toFixed(3), end: +end.toFixed(3), text });
  }
  result.sort((a, b) => a.start - b.start);
  const out = [];
  for (const s of result) {
    const prev = out.at(-1);
    if (prev && prev.text === s.text && s.start <= prev.end + 0.2) { prev.end = Math.max(prev.end, s.end); continue; }
    out.push(s);
  }
  if (!out.length) fail('Empty/unreadable transcript', 'TRANSCRIPT_UNAVAILABLE');
  return out;
}
function timestamp(text) { const v = text.replace(',', '.').split(':').map(Number); return v.reduce((n, x) => n * 60 + x, 0); }
function parseSubtitle(raw, ext) {
  if (ext === 'json' || ext === 'json3') {
    const j = JSON.parse(raw);
    if (Array.isArray(j.body)) return validateSegments(j.body.map(s => ({ start: s.from, end: s.to, text: s.content })));
    if (Array.isArray(j.events)) return validateSegments(j.events.filter(s => s.segs).map(s => ({ start: s.tStartMs / 1000, end: (s.tStartMs + (s.dDurationMs || 0)) / 1000, text: s.segs.map(t => t.utf8 || '').join('') })));
  }
  const output = [], lines = raw.replace(/\r/g, '').split('\n');
  const pattern = /((?:\d+:)?\d{2}:\d{2}[.,]\d+)\s*-->\s*((?:\d+:)?\d{2}:\d{2}[.,]\d+)/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(pattern); if (!m) continue;
    const text = []; for (i++; i < lines.length && lines[i].trim(); i++) text.push(lines[i]);
    output.push({ start: timestamp(m[1]), end: timestamp(m[2]), text: text.join(' ') });
  }
  return validateSegments(output);
}
function chunksFor(segments, chapters = [], maxSeconds = 600) {
  const chunks = []; let current = [];
  const breaks = new Set(chapters.map(c => c.start_time));
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const chapterBreak = current.length && [...breaks].some(x => x > current.at(-1).start && x <= s.start);
    if (current.length && (s.end - current[0].start > maxSeconds || current.reduce((n, x) => n + x.text.length, 0) + s.text.length > 12000 || chapterBreak)) {
      chunks.push(current); current = [];
    }
    current.push({ ...s, segment_index: i });
  }
  if (current.length) chunks.push(current);
  return chunks.map((items, i) => ({ id: i + 1, start: items[0].start, end: items.at(-1).end, first_segment: items[0].segment_index, last_segment: items.at(-1).segment_index, reading_status: 'UNREAD', segments: items }));
}
function buildBundle(meta, segments, method, language, attempts) {
  const normalized = validateSegments(segments);
  const duration = meta.duration_seconds || normalized.at(-1).end;
  return { schema_version: 1, trust: 'UNTRUSTED_CONTENT', source: meta, acquisition_timestamp: stamp(), language: language || 'unknown', transcript_source: method, transcription_method: method === 'ASR' ? 'whisper.cpp / shared small / CPU' : 'platform caption', tools_used: [...calledTools], coverage: { acquisition: 'AVAILABLE_TRACK', reading: 'UNREAD', last_segment_end: normalized.at(-1).end, duration_seconds: duration, limitations: ['取得全部可用文本不等于已读取全文；字幕不能证明画面内容。', ...(meta.part_count > 1 ? ['仅取得所选分 P，不覆盖其他分 P。'] : []), ...(normalized.at(-1).end < duration - 15 ? ['字幕结束早于媒体结束；尾段须核实，不能假定无遗漏。'] : []), ...(method === 'ASR' ? ['ASR 未经逐段听音校验，不能保证无漏词或幻觉。'] : method === 'AUTO_CAPTION' ? ['平台自动字幕可能误识别；关键引文须回查。'] : [])] }, chapters: meta.chapters || [], segments: normalized, chunks: chunksFor(normalized, meta.chapters || []), attempts };
}
function orderBiliTracks(tracks, language = 'auto') {
  const rank = t => String(t.lan).replace(/^ai-/, '').startsWith(language) ? 0 : /^zh|^ai-zh/.test(t.lan) ? 1 : /^en/.test(t.lan) ? 2 : 3;
  return tracks.filter(t => t.subtitle_url && !/摘要|summary|自动翻译/i.test(t.lan_doc || '')).sort((a, b) => Number(String(a.lan).startsWith('ai-')) - Number(String(b.lan).startsWith('ai-')) || rank(a) - rank(b));
}
async function biliPublic(input, attempt, language = 'auto') {
  const originalUrl = input.url;
  if (!input.video_id) {
    const page = await http(input.url); const id = page.url.match(/BV[a-zA-Z0-9]{10}/)?.[0];
    if (!id) fail('Short URL did not resolve a BV identity', 'INVALID_INPUT');
    input.video_id = id; input.url = `https://www.bilibili.com/video/${id}/?p=${input.part}`;
  }
  const view = JSON.parse((await http('https://api.bilibili.com/x/web-interface/view?bvid=' + input.video_id)).text);
  if (view.code !== 0) fail('Bilibili view code ' + view.code, view.code === -101 ? 'USER_AUTH_REQUIRED' : 'ACQUISITION_FAILED');
  const v = view.data, page = v.pages?.[input.part - 1];
  if (!page) fail('Requested Bilibili page not found', 'INVALID_INPUT');
  const meta = { url: input.url, original_url: originalUrl, platform: input.platform, video_id: input.video_id, part: input.part, part_count: v.pages.length, title: v.title, part_title: page.part, creator: v.owner?.name, published_date: v.pubdate ? new Date(v.pubdate * 1000).toISOString().slice(0, 10) : undefined, duration_seconds: page.duration, chapters: [] };
  let tracks = (v.subtitle?.list || []).filter(t => t.subtitle_url);
  if (!tracks.length) {
    // Public WBI signing is a platform request checksum, not login or authentication bypass.
    const nav = JSON.parse((await http('https://api.bilibili.com/x/web-interface/nav')).text);
    const keys = nav.data?.wbi_img;
    if (!keys) fail('Public WBI key unavailable');
    const key = ['img_url', 'sub_url'].map(k => path.basename(new URL(keys[k]).pathname).split('.')[0]).join('');
    const table = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
    const mixin = table.map(i => key[i]).join('').slice(0, 32);
    const q = `bvid=${encodeURIComponent(input.video_id)}&cid=${page.cid}&wts=${Math.floor(Date.now() / 1000)}`;
    const sign = crypto.createHash('md5').update(q + mixin).digest('hex');
    const player = JSON.parse((await http('https://api.bilibili.com/x/player/wbi/v2?' + q + '&w_rid=' + sign)).text);
    if (player.code !== 0) fail('Bilibili player code ' + player.code, player.code === -101 ? 'USER_AUTH_REQUIRED' : 'ACQUISITION_FAILED');
    tracks = (player.data?.subtitle?.subtitles || []).filter(t => t.subtitle_url);
    meta.subtitle_access = player.data?.need_login_subtitle || player.data?.subtitle?.need_login_subtitle ? 'LOGIN_REQUIRED' : tracks.length ? 'AVAILABLE' : 'NOT_AVAILABLE';
  }
  if (!tracks.length) {
    try {
      const dm = JSON.parse((await http(`https://api.bilibili.com/x/v2/dm/view?type=1&oid=${page.cid}&pid=${v.aid}`)).text);
      if (dm.code === 0) tracks = (dm.data?.subtitle?.subtitles || []).filter(t => t.subtitle_url);
      if (tracks.length) { meta.subtitle_access = 'PUBLIC_DM_AVAILABLE'; meta.caption_endpoint = 'public-dm-view'; }
    } catch (e) { attempt('bilibili-public-dm-subtitle', e); }
  }
  const ordered = orderBiliTracks(tracks, language);
  for (const t of ordered) {
    try { const raw = await http(t.subtitle_url.startsWith('//') ? 'https:' + t.subtitle_url : t.subtitle_url); meta.caption_track_language = t.lan; meta.acquisition_provider = 'bilibili-public-subtitle'; return { meta, segments: parseSubtitle(raw.text, 'json'), language: t.lan.replace(/^ai-/, ''), method: String(t.lan).startsWith('ai-') ? 'AUTO_CAPTION' : 'OFFICIAL_CAPTION' }; }
    catch (e) { attempt('bilibili-caption', e); }
  }
  return { meta };
}
function selectPublicAudio(data, duration) {
  if (data.is_preview || data.isPreview || (Number.isFinite(data.timelength) && data.timelength / 1000 < duration - 2)) fail('Public manifest is preview/incomplete; authorized full source required', 'USER_AUTH_REQUIRED');
  const tracks = (data.dash?.audio || []).filter(t => t.baseUrl || t.base_url).sort((a, b) => Number(a.bandwidth) - Number(b.bandwidth));
  if (!tracks.length) fail('Public manifest has no audio track', 'TRANSCRIPT_UNAVAILABLE');
  for (const track of tracks) {
    for (const url of [track.baseUrl || track.base_url, ...(track.backupUrl || track.backup_url || [])]) {
      try { safeRemote(url, ['bilivideo.com', 'acgvideo.com', 'hdslb.com']); return url; } catch { /* Only allow known CDN hosts, including manifest backups. */ }
    }
  }
  fail('Public manifest has no trusted CDN audio URL', 'INVALID_INPUT');
}
async function biliAudio(meta, input, run, registry, language, limitSeconds) {
  if (!Number.isFinite(meta.duration_seconds) || meta.duration_seconds > limitSeconds) fail('Public media exceeds duration budget', 'SIZE_LIMIT');
  const view = JSON.parse((await http('https://api.bilibili.com/x/player/pagelist?bvid=' + input.video_id)).text);
  if (view.code !== 0 || !view.data?.[input.part - 1]) fail('Public page identity unavailable');
  const cid = view.data[input.part - 1].cid;
  const manifest = JSON.parse((await http(`https://api.bilibili.com/x/player/playurl?bvid=${input.video_id}&cid=${cid}&qn=32&fnval=4048&fourk=0`)).text);
  if (manifest.code !== 0) fail('Public playurl code ' + manifest.code, manifest.code === -101 ? 'USER_AUTH_REQUIRED' : 'ACQUISITION_FAILED');
  const url = selectPublicAudio(manifest.data, meta.duration_seconds);
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: input.url }, redirect: 'error', signal: AbortSignal.timeout(300000) });
  if (!response.ok) fail('Public audio HTTP ' + response.status, errorKind('HTTP ' + response.status));
  const maxBytes = 256 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > maxBytes) { await response.body.cancel(); fail('Public audio exceeds byte budget', 'SIZE_LIMIT'); }
  const file = path.join(run, 'media', 'bilibili-audio.m4a');
  const fd = fs.openSync(file, 'wx'); let bytes = 0;
  try { for await (const chunk of response.body) { bytes += chunk.length; if (bytes > maxBytes) fail('Public audio exceeds byte budget', 'SIZE_LIMIT'); fs.writeSync(fd, chunk); } }
  finally { fs.closeSync(fd); }
  if (!bytes) fail('Public audio empty', 'TRANSCRIPT_UNAVAILABLE');
  const result = asr(file, registry, run, language, limitSeconds);
  if (Math.abs(result.duration - meta.duration_seconds) > 2) fail('Downloaded audio duration differs from selected source', 'TRANSCRIPT_UNAVAILABLE');
  meta.acquisition_provider = 'bilibili-public-playurl';
  return result;
}
function metaFromYt(info, input) {
  const id = input.platform === 'bilibili' ? input.video_id || (info.webpage_url || '').match(/BV[a-zA-Z0-9]{10}/)?.[0] || String(info.id) : String(info.id);
  const url = input.platform === 'bilibili' && /^BV[a-zA-Z0-9]{10}$/.test(id) ? `https://www.bilibili.com/video/${id}/?p=${input.part}` : input.url;
  return { url, original_url: input.url, platform: input.platform, video_id: id, title: info.title, creator: info.uploader || info.channel, published_date: /^\d{8}$/.test(info.upload_date || '') ? info.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : undefined, duration_seconds: info.duration, ...(input.platform === 'bilibili' ? { part: input.part } : {}), chapters: (info.chapters || []).map(c => ({ start_time: c.start_time, end_time: c.end_time, title: c.title })) };
}
function baseYt(registry, cookieFile) {
  const node = tool(registry, 'node');
  const args = ['--ignore-config', '--no-playlist', '--no-overwrites', '--no-progress', '--socket-timeout', '15', '--retries', '1', '--extractor-retries', '1', '--cache-dir', path.join(activeCacheRoot, 'yt-dlp'), '--js-runtimes', 'node:' + node];
  if (availableTool(registry, 'ffmpeg')) args.push('--ffmpeg-location', path.dirname(tool(registry, 'ffmpeg')));
  if (cookieFile) args.push('--cookies', cookieFile);
  return args;
}
function availableTool(registry, name) { try { tool(registry, name); return true; } catch { return false; } }
function videoReadiness(registry) {
  const check = names => ({ ready: names.every(n => availableTool(registry, n)), missing: names.filter(n => !availableTool(registry, n)) });
  return { public_subtitles: check([]), yt_dlp_subtitles: check(['node','yt-dlp']), asr: check(['ffmpeg','ffprobe','whisper-cli','whisper-model-small']) };
}
function loadRuntime(configFile, registryOverride) {
  if (Number(process.versions.node.split('.')[0]) < 24) fail('Video requires Node 24 or later', 'DEPENDENCY_FAILURE');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8').replace(/^\uFEFF/, ''));
  const actualVault = path.resolve(__dirname, '..', '..');
  if (path.resolve(config.vault_root || '') !== actualVault) fail('Config belongs to another Vault', 'CONFIGURATION_FAILURE');
  if (config.schema_version !== 1 || typeof config.features?.video !== 'boolean') fail('Invalid local configuration', 'CONFIGURATION_FAILURE');
  for (const key of ['tools_root','temp_root','cache_root']) {
    if (!path.isAbsolute(config[key] || '')) fail('Expected absolute configured ' + key, 'CONFIGURATION_FAILURE');
    if (inside(config[key], actualVault) || inside(actualVault, config[key])) fail(key + ' must be disjoint from Vault', 'UNSAFE_PATH');
    noLinks(config[key]);
  }
  const registryFile = registryOverride ? path.resolve(registryOverride) : path.resolve(path.dirname(configFile), config.registry_file);
  const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8').replace(/^\uFEFF/, ''));
  if (!Array.isArray(registry)) fail('Registry must be an array', 'CONFIGURATION_FAILURE');
  return { config, registry, tempRoot: config.temp_root, cacheRoot: config.cache_root };
}
function pickTracks(info, language) {
  const tracks = [];
  for (const [method, group] of [['OFFICIAL_CAPTION', info.subtitles], ['AUTO_CAPTION', info.automatic_captions]]) {
    for (const [lang, formats] of Object.entries(group || {})) {
      // Only native caption tracks; no silent translation using tlang.
      const valid = formats.filter(f => ['vtt', 'srt', 'json3', 'json'].includes(f.ext) && !/[?&]tlang=/.test(f.url || ''));
      if (valid.length) tracks.push({ method, language: lang, formats: valid, rank: (lang === language ? 0 : lang === info.language ? 1 : lang.endsWith('-orig') ? 2 : lang.startsWith('zh') ? 3 : lang.startsWith('en') ? 4 : 5) });
    }
  }
  return tracks.sort((a, b) => (a.method === b.method ? a.rank - b.rank : a.method === 'OFFICIAL_CAPTION' ? -1 : 1));
}
function readWhisper(file, offset, minStart, maxEnd) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (data.transcription || []).map(s => ({ start: offset + s.offsets.from / 1000, end: offset + s.offsets.to / 1000, text: s.text })).filter(s => (s.start + s.end) / 2 >= minStart && (s.start + s.end) / 2 < maxEnd).map(s => ({ ...s, start: Math.max(s.start, minStart), end: Math.min(s.end, maxEnd) }));
}
function asr(media, registry, run, language, limitSeconds) {
  const ffprobe = tool(registry, 'ffprobe'), ffmpeg = tool(registry, 'ffmpeg'), whisper = tool(registry, 'whisper-cli'), model = tool(registry, 'whisper-model-small');
  const duration = Number(native(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', media]));
  if (!Number.isFinite(duration) || duration <= 0) fail('Invalid media duration');
  if (duration > limitSeconds) fail('Media exceeds configured unattended duration limit', 'SIZE_LIMIT');
  const segments = [], processed = [], languages = new Set();
  for (let start = 0, i = 0; start < duration; start += 600, i++) {
    const from = Math.max(0, start - 3), until = Math.min(duration, start + 603), wav = path.join(run, 'media', 'chunk-' + i + '.wav'), prefix = path.join(run, 'media', 'asr-' + i);
    native(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe', '-ss', String(from), '-i', media, '-t', String(until - from), '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-threads', '2', '-n', wav], 120000);
    native(whisper, ['-m', model, '-f', wav, '-l', language || 'auto', '-t', '2', '-ng', '-oj', '-of', prefix], 1200000);
    const detected = JSON.parse(fs.readFileSync(prefix + '.json', 'utf8')).result?.language;
    if (detected) languages.add(detected);
    segments.push(...readWhisper(prefix + '.json', from, start, Math.min(start + 600, duration)));
    processed.push({ start, end: Math.min(start + 600, duration), result: 'PROCESSED' });
    atomicJson(path.join(run, 'asr-coverage.json'), { duration_seconds: duration, processed, status: start + 600 >= duration ? 'COMPLETE_PROCESSING' : 'PARTIAL' });
    fs.unlinkSync(wav);
  }
  return { segments: validateSegments(segments), duration, language: languages.size === 1 ? [...languages][0] : languages.size > 1 ? 'mixed' : language === 'auto' ? 'unknown' : language };
}
function removeOwnedTree(dir, root) {
  if (!inside(dir, root) || path.resolve(dir) === path.resolve(root)) fail('Unsafe cleanup target', 'UNSAFE_PATH');
  noLinks(dir);
  const check = file => { if (fs.lstatSync(file).isSymbolicLink()) fail('Cleanup found a symlink', 'UNSAFE_PATH'); if (fs.statSync(file).isDirectory()) for (const name of fs.readdirSync(file)) check(path.join(file, name)); };
  check(dir); fs.rmSync(dir, { recursive: true });
}
function emit(run, bundle) {
  atomicJson(path.join(run, 'result.json'), { status: 'PASS', trust: 'UNTRUSTED_CONTENT', ...bundle });
  const time = n => { const h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = Math.floor(n % 60); return [h, m, s].map(x => String(x).padStart(2, '0')).join(':'); };
  fs.writeFileSync(path.join(run, 'transcript.txt'), bundle.segments.map(s => `[${time(s.start)}–${time(s.end)}] ${s.text}`).join('\n'), 'utf8');
  for (const c of bundle.chunks) atomicJson(path.join(run, `chunk-${String(c.id).padStart(3, '0')}.json`), c);
  console.log(JSON.stringify({ status: 'PASS', run_directory: run, result: path.join(run, 'result.json'), transcript: path.join(run, 'transcript.txt'), chunk_count: bundle.chunks.length, reading: 'UNREAD' }));
}
function options(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) { if (!argv[i].startsWith('--')) fail('Named arguments required', 'INVALID_INPUT'); const key = argv[i].slice(2); if (['no-asr', 'keep-media', 'help', 'check'].includes(key)) out[key] = true; else { if (i + 1 === argv.length) fail('Missing argument value'); out[key] = argv[++i]; } }
  for (const key of Object.keys(out)) if (!['input', 'config', 'registry', 'language', 'output', 'cookies-file', 'max-minutes', 'no-asr', 'keep-media', 'help', 'check', 'cleanup'].includes(key)) fail('Unknown option: ' + key, 'INVALID_INPUT');
  return out;
}
async function main(argv) {
  const o = options(argv);
  if (o.help) { console.log('Video-Intake ' + VERSION + '\nnode Video-Intake.cjs --input <URL|BV|local media> [--config <local.json>] [--registry <override>] [--language auto|en|zh] [--no-asr] [--max-minutes 180]\n--check: offline branch readiness (missing optional dependencies => WARN). --cleanup <owned run> requires the same local config. Acquisition only; no note/Git writes or implicit credentials.'); return; }
  const configFile = path.resolve(o.config || path.join(__dirname, '..', 'Config', 'local.json'));
  const { config, registry, tempRoot, cacheRoot } = loadRuntime(configFile, o.registry);
  activeCacheRoot = cacheRoot;
  if (o.cleanup) {
    const run = path.resolve(o.cleanup); if (!inside(run, tempRoot) || !path.basename(run).startsWith('intake-')) fail('Unowned cleanup directory', 'UNSAFE_PATH');
    noLinks(run); const marker = JSON.parse(fs.readFileSync(path.join(run, 'run.json'), 'utf8'));
    if (marker.owner !== MARKER || marker.run_directory !== run) fail('Invalid ownership marker'); removeOwnedTree(run, tempRoot); console.log('CLEANED'); return;
  }
  if (o.check) { const capabilities = videoReadiness(registry); console.log(JSON.stringify({ status: config.features.video && capabilities.yt_dlp_subtitles.ready && capabilities.asr.ready ? 'PASS' : 'WARN', enabled: config.features.video, capabilities })); return; }
  if (!config.features.video) fail('Video disabled; opt in and configure dependencies', 'FEATURE_NOT_CONFIGURED');
  if (!o.input) fail('--input is required', 'INVALID_INPUT');
  const language = o.language || 'auto'; if (!/^(auto|[a-z]{2,3}(?:-[\w]+)?)$/.test(language)) fail('Invalid language');
  const maxMinutes = Number(o['max-minutes'] || 180); if (!Number.isFinite(maxMinutes) || maxMinutes <= 0 || maxMinutes > 1440) fail('max-minutes must be within 0–1440');
  const input = parseInput(o.input), vaultRoot = path.resolve(__dirname, '..', '..');
  if (o['cookies-file']) { assertLocal(path.resolve(o['cookies-file'])); if (inside(o['cookies-file'], vaultRoot)) fail('Credentials must remain outside Vault', 'UNSAFE_PATH'); }
  noLinks(tempRoot); noLinks(cacheRoot); fs.mkdirSync(tempRoot, { recursive: true }); fs.mkdirSync(cacheRoot, { recursive: true });
  const run = path.resolve(o.output || path.join(tempRoot, 'intake-' + crypto.randomUUID()));
  if (!inside(run, tempRoot) || path.dirname(run) !== tempRoot || !path.basename(run).startsWith('intake-') || fs.existsSync(run)) fail('Output must be a new intake-* directory directly in configured Temp', 'UNSAFE_PATH');
  noLinks(run); fs.mkdirSync(run); fs.mkdirSync(path.join(run, 'media'));
  atomicJson(path.join(run, 'run.json'), { owner: MARKER, run_directory: run, created: stamp(), version: VERSION });
  const attempts = [], attempt = (stage, e) => { attempts.push({ stage, time: stamp(), ...boundedError(e) }); atomicJson(path.join(run, 'attempts.json'), attempts); };
  let meta;
  try {
    let segments, method, lang = language;
    if (input.platform === 'local') {
      const a = asr(input.local, registry, run, language, maxMinutes * 60); segments = a.segments; method = 'ASR'; lang = a.language;
      meta = { platform: 'local', local_file: input.local, video_id: crypto.createHash('sha256').update(input.local).digest('hex').slice(0, 16), identity_basis: 'local path (provisional; Workflow must confirm association)', title: path.basename(input.local), duration_seconds: a.duration };
    } else {
      if (input.platform === 'bilibili') { try { const b = await biliPublic(input, attempt, language); ({ meta, segments, method, language: lang } = b); } catch (e) { attempt('bilibili-public-api', e); } }
      if (input.platform === 'bilibili' && meta && !segments && !o['no-asr']) {
        try { const a = await biliAudio(meta, input, run, registry, language, maxMinutes * 60); segments = a.segments; method = 'ASR'; lang = a.language; }
        catch (e) { attempt('bilibili-public-media', e); }
      }
      if (!segments) {
        let cookieFile;
        if (o['cookies-file']) {
          const original = path.resolve(o['cookies-file']);
          if (fs.statSync(original).size > 1024 * 1024) fail('Cookie input too large');
          cookieFile = path.join(run, 'media', 'explicit-auth.txt');
          fs.copyFileSync(original, cookieFile, fs.constants.COPYFILE_EXCL);
        }
        const yt = tool(registry, 'yt-dlp'), base = baseYt(registry, cookieFile);
        const info = JSON.parse(native(yt, [...base, '--skip-download', '--dump-single-json', input.url]));
        meta = metaFromYt(info, input);
        const choices = pickTracks(info, language === 'auto' ? info.language : language);
        for (const choice of choices.slice(0, 3)) {
          try {
            for (const name of fs.readdirSync(path.join(run, 'media')).filter(f => /^caption\./.test(f))) fs.unlinkSync(path.join(run, 'media', name));
            const args = [...base, '--skip-download', choice.method === 'OFFICIAL_CAPTION' ? '--write-subs' : '--write-auto-subs', '--sub-langs', '^' + choice.language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', '--sub-format', 'vtt/srt/json3/json', '--output', path.join(run, 'media', 'caption.%(ext)s'), input.url];
            native(yt, args);
            const files = fs.readdirSync(path.join(run, 'media')).filter(f => /\.(vtt|srt|json3|json)$/.test(f));
            if (!files.length) fail('No subtitle file returned');
            const file = path.join(run, 'media', files[0]); segments = parseSubtitle(fs.readFileSync(file, 'utf8'), path.extname(file).slice(1)); method = choice.method; lang = choice.language; break;
          } catch (e) { attempt('yt-dlp-caption-' + choice.language, e); }
        }
        if (!segments) {
          if (o['no-asr']) fail('No available caption; ASR disabled', 'TRANSCRIPT_UNAVAILABLE');
          if (!Number.isFinite(info.duration) || info.duration > maxMinutes * 60 || info.is_live) fail('Live/unknown/over-limit duration requires user decision', 'SIZE_LIMIT');
          native(yt, [...base, '--no-simulate', '-f', 'bestaudio/best', '--max-filesize', '256M', '--print', 'after_move:filepath', '--output', path.join(run, 'media', 'audio.%(ext)s'), input.url], 300000);
          const files = fs.readdirSync(path.join(run, 'media')).filter(f => /^audio\./.test(f) && !/\.(part|ytdl)$/.test(f));
          if (files.length !== 1) fail('Audio result missing/ambiguous');
          if (fs.statSync(path.join(run, 'media', files[0])).size > 256 * 1024 * 1024) fail('Audio exceeded unattended byte limit', 'SIZE_LIMIT');
          const a = asr(path.join(run, 'media', files[0]), registry, run, language, maxMinutes * 60); segments = a.segments; method = 'ASR'; lang = a.language;
        }
      }
    }
    emit(run, buildBundle(meta, segments, method, lang, attempts));
    // Auth material is never kept even when the user opts to retain media.
    const auth = path.join(run, 'media', 'explicit-auth.txt');
    if (fs.existsSync(auth)) fs.unlinkSync(auth);
    if (!o['keep-media']) removeOwnedTree(path.join(run, 'media'), run);
  } catch (e) {
    attempt('final', e); atomicJson(path.join(run, 'result.json'), { status: 'FAIL', ...boundedError(e), source: meta || { platform: input.platform, url: input.url, video_id: input.video_id }, tools_used: [...calledTools], attempts });
    if (fs.existsSync(path.join(run, 'media'))) removeOwnedTree(path.join(run, 'media'), run);
    console.error(JSON.stringify({ status: 'FAIL', ...boundedError(e), run_directory: run })); process.exitCode = 1;
  }
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(JSON.stringify({ status: 'FAIL', ...boundedError(e) })); process.exitCode = 1; });
module.exports = { parseInput, parseSubtitle, validateSegments, chunksFor, buildBundle, readWhisper, pickTracks, inside, errorKind, selectPublicAudio, orderBiliTracks, loadRuntime, videoReadiness };
