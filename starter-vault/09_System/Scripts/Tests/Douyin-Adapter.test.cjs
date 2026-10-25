const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const entry=path.resolve(__dirname,'../Video-Intake.cjs');
function isolated(response,status=0){
 const calls=[],box={module:{exports:{}},__dirname:path.dirname(entry),__filename:entry,process,Buffer,URL,URLSearchParams,console,AbortSignal,fetch};
 box.require=name=>name==='node:child_process'?{spawnSync:(exe,args,options)=>{calls.push({exe,args,options});return {status,stdout:JSON.stringify(response),stderr:status?JSON.stringify(response):''};}}:require(name);
 vm.runInNewContext(fs.readFileSync(entry,'utf8')+'\nmodule.exports.testDouyinMedia = douyinMedia;',box,{filename:entry});return {...box.module.exports,calls};
}
const registry=[{tool_name:'douyin-python',canonical_path:__filename,managed_by:'user'},{tool_name:'douyin-provider',canonical_path:__filename,managed_by:'user'}];
const input={platform:'douyin',url:'https://www.douyin.com/video/1234567890123456789'};
test('Douyin share text selects the first legitimate link and preserves identity',()=>{
 const api=isolated({}),p=api.parseInput('SAMPLE 分享 https://www.douyin.com/video/1234567890123456789 第二条 https://v.douyin.com/sample/');assert.equal(p.platform,'douyin');assert.equal(p.video_id,'1234567890123456789');assert.equal(api.parseInput('https://v.douyin.com/sample/').platform,'douyin');
 assert.notEqual(api.parseInput('https://douyin.com.example.invalid/video/1234567890123456789').platform,'douyin');
 assert.throws(()=>api.parseInput('https://user:secret@www.douyin.com/video/1234567890123456789'));
});
test('Provider is optional and does not block ordinary ASR readiness',()=>{
 const api=isolated({}),other=['node','yt-dlp','ffmpeg','ffprobe','whisper-cli','whisper-model-small'].map(tool_name=>({tool_name,canonical_path:__filename,managed_by:'user'})),ready=api.videoReadiness(other);assert.equal(ready.asr.ready,true);assert.equal(ready.douyin.ready,false);assert.throws(()=>api.testDouyinMedia(input,__dirname,[], 'auto',180,true));
});
test('Metadata-only caller passes bounded args with no login/profile/cookie inputs',()=>{
 const api=isolated({url:input.url,aweme_id:'1234567890123456789',title:'SAMPLE',author:'SAMPLE',provider:'SAMPLE_ANONYMOUS',duration_seconds:10});const out=api.testDouyinMedia(input,__dirname,registry,'auto',180,true);assert.equal(out.meta.platform,'douyin');assert.equal(out.segments,undefined);assert.equal(api.calls.length,1);assert.equal(api.calls[0].options.shell,false);assert(api.calls[0].args.includes('--metadata-only'));assert(!/cookies|profile|login/i.test(api.calls[0].args.join(' ')));
});
test('Provider media outside current run is rejected before ASR',()=>{
 const api=isolated({url:input.url,aweme_id:'1234567890123456789',title:'SAMPLE',provider:'SAMPLE_ANONYMOUS',duration_seconds:10,media_file:path.resolve(__dirname,'../outside.mp4')});assert.throws(()=>api.testDouyinMedia(input,__dirname,registry,'auto',180,false),e=>e.code==='UNSAFE_PATH');assert.equal(api.calls.length,1);
});
test('CAPTCHA propagates as an explicit error without alternate fetcher',()=>{
 const api=isolated({code:'CAPTCHA',message:'SAMPLE CAPTCHA'},1);assert.throws(()=>api.testDouyinMedia(input,__dirname,registry,'auto',180,false),e=>e.code==='DOUYIN_CAPTCHA');assert.equal(api.calls.length,1);
});
