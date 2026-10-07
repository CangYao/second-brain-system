// FICTIONAL / SAMPLE URL identifiers for offline parsing only. Never fetch them.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseInput, parseSubtitle, validateSegments, chunksFor, buildBundle, readWhisper, pickTracks, inside, errorKind, selectPublicAudio, orderBiliTracks } = require('../Video-Intake.cjs');

test('platform identity uses real host and selected page, not matching URL text', () => {
  assert.equal(parseInput('https://youtu.be/A1b2C3d4E5F?t=5').url, 'https://www.youtube.com/watch?v=A1b2C3d4E5F');
  assert.equal(parseInput('https://www.bilibili.com/video/BV1Ab411c7De/?p=2').part, 2);
  assert.equal(parseInput('https://b23.tv/SAMPLE01').platform, 'bilibili');
  assert.equal(parseInput('https://example.org/BV1Ab411c7De').platform, 'generic');
  assert.throws(() => parseInput('https://www.youtube.com/playlist?list=123'));
  assert.throws(() => parseInput('https://user:pass@www.youtube.com/watch?v=A1b2C3d4E5F'));
  assert.throws(() => parseInput('http://127.0.0.1/video'));
  assert.throws(() => parseInput('https://www.bilibili.com/video/BV1Ab411c7De/?p=0'));
});
test('VTT/SRT/JSON3/Bili retain timed evidence, Unicode and decimal offsets', () => {
  const a = parseSubtitle('WEBVTT\n\n00:01.250 --> 00:03.500 align:start\nHello &amp; <b>你好</b>\n', 'vtt');
  assert.deepEqual(a, [{ start: 1.25, end: 3.5, text: 'Hello & 你好' }]);
  assert.equal(parseSubtitle('1\n01:02:03,100 --> 01:02:05,000\n定位\n', 'srt')[0].start, 3723.1);
  assert.equal(parseSubtitle(JSON.stringify({ events: [{ tStartMs: 50, dDurationMs: 200, segs: [{ utf8: 'text' }] }] }), 'json3')[0].end, .25);
  assert.equal(parseSubtitle(JSON.stringify({ body: [{ from: 2, to: 3, content: '字幕' }] }), 'json')[0].text, '字幕');
  assert.throws(() => parseSubtitle('WEBVTT\n\n', 'vtt'));
});
test('empty ASR and invalid timestamps never become successful transcript', () => {
  assert.throws(() => validateSegments([{ start: 0, end: 1, text: '  ' }]));
  assert.throws(() => validateSegments([{ start: 2, end: 1, text: 'wrong' }]));
  assert.equal(validateSegments([{ start: 0, end: 2, text: 'same' }, { start: 1, end: 3, text: 'same' }]).length, 1);
});
test('manual before auto; do not silently select translated auto-caption tracks', () => {
  const info = { language: 'en', subtitles: { en: [{ ext: 'vtt', url: 'https://www.youtube.com/native' }] }, automatic_captions: { zh: [{ ext: 'vtt', url: 'https://www.youtube.com/native?tlang=zh' }], 'en-orig': [{ ext: 'json3', url: 'https://www.youtube.com/original' }] } };
  const tracks = pickTracks(info, 'zh');
  assert.equal(tracks[0].method, 'OFFICIAL_CAPTION');
  assert.equal(tracks.length, 2);
  assert.equal(tracks[1].language, 'en-orig');
});
test('two-hour text preserves every segment exactly once and final material', () => {
  const segments = Array.from({ length: 1200 }, (_, i) => ({ start: i * 6, end: i * 6 + 5, text: 'semantic unit ' + i }));
  const chunks = chunksFor(segments, [{ start_time: 900, title: 'chapter' }]);
  assert.deepEqual(chunks.flatMap(c => c.segments.map(s => s.segment_index)), Array.from({ length: 1200 }, (_, i) => i));
  assert.ok(chunks.length > 12);
  assert.equal(chunks.at(-1).last_segment, 1199);
  assert.ok(chunks.every(c => c.reading_status === 'UNREAD'));
  assert.ok(chunks.every(c => c.end - c.start <= 600));
});
test('available acquisition never upgrades to FULL reading or full multi-page coverage', () => {
  const bundle = buildBundle({ duration_seconds: 100, part_count: 3 }, [{ start: 10, end: 20, text: 'partial content' }], 'ASR', 'zh', []);
  assert.equal(bundle.coverage.reading, 'UNREAD');
  assert.ok(bundle.coverage.limitations.some(x => x.includes('尾段')));
  assert.ok(bundle.coverage.limitations.some(x => x.includes('分 P')));
  assert.ok(bundle.coverage.limitations.some(x => x.includes('幻觉')));
  assert.equal(bundle.trust, 'UNTRUSTED_CONTENT');
});
test('ASR overlap uses global times and preserves only owned central interval', () => {
  const dir = fs.mkdtempSync(path.join(process.env.VIDEO_INTAKE_TEST_TEMP || os.tmpdir(), 'video-intake-unit-'));
  try {
    const file = path.join(dir, 'asr.json');
    fs.writeFileSync(file, JSON.stringify({ transcription: [{ offsets: { from: 0, to: 1000 }, text: 'previous boundary' }, { offsets: { from: 2500, to: 4500 }, text: 'owned boundary' }] }));
    const segments = readWhisper(file, 597, 600, 1200);
    assert.equal(segments.length, 1);
    assert.equal(segments[0].start, 600);
    assert.equal(segments[0].end, 601.5);
  } finally { fs.unlinkSync(path.join(dir, 'asr.json')); fs.rmdirSync(dir); }
});
test('path boundaries and failure classes remain explicit', () => {
  assert.equal(inside(path.join(os.tmpdir(), 'owned'), os.tmpdir()), true);
  assert.equal(inside(path.resolve(os.tmpdir(), '..', 'other'), os.tmpdir()), false);
  assert.equal(errorKind('HTTP Error 412: Precondition Failed'), 'PLATFORM_REJECTED_412');
  assert.equal(errorKind('Sign in to confirm you are not a bot'), 'USER_AUTH_REQUIRED');
  assert.equal(errorKind('HTTP 429 Too Many Requests'), 'RATE_LIMITED');
});
test('public Bilibili audio selects bandwidth budget and rejects previews/private hosts', () => {
  const data = { timelength: 100000, dash: { audio: [
    { bandwidth: 300000, baseUrl: 'https://a.bilivideo.com/high.m4a' },
    { bandwidth: 64000, base_url: 'https://b.bilivideo.com/low.m4a' }
  ] } };
  assert.equal(selectPublicAudio(data, 100), 'https://b.bilivideo.com/low.m4a');
  assert.throws(() => selectPublicAudio({ ...data, is_preview: true }, 100));
  assert.throws(() => selectPublicAudio({ ...data, timelength: 10000 }, 100));
  assert.throws(() => selectPublicAudio({ dash: { audio: [{ baseUrl: 'http://127.0.0.1/audio' }] } }, 100));
  assert.throws(() => selectPublicAudio({ dash: { audio: [{ baseUrl: 'https://evil.example/audio' }] } }, 100));
  assert.throws(() => selectPublicAudio({ dash: { audio: [] } }, 100));
  assert.equal(selectPublicAudio({dash:{audio:[{baseUrl:'https://unknown.example/audio',backupUrl:['https://backup.bilivideo.com/audio']}]}},100),'https://backup.bilivideo.com/audio');
});
test('Bilibili caption preference keeps manual first, requested language and rejects summaries', () => {
  const tracks = [
    {lan:'ai-zh',subtitle_url:'https://aisubtitle.hdslb.com/a'},
    {lan:'zh-CN',subtitle_url:'https://aisubtitle.hdslb.com/b'},
    {lan:'en-US',subtitle_url:'https://aisubtitle.hdslb.com/c'},
    {lan:'ai-zh',lan_doc:'AI摘要',subtitle_url:'https://aisubtitle.hdslb.com/d'}
  ];
  const ordered=orderBiliTracks(tracks,'en');
  assert.equal(ordered.length,3);
  assert.equal(ordered[0].lan,'en-US');
  assert.equal(ordered[2].lan,'ai-zh');
  assert.equal(orderBiliTracks([{lan:'en-US',subtitle_url:''}]).length,0);
});
