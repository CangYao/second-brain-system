'use strict';
// Own-code offline Obsidian API double. Does not claim a real GUI/plugin/LLM run.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
test('SAMPLE routes create valid identities, preserve duplicates and respect system/IANA timezone',async()=>{
 const owned=!process.env.SB_SMOKE_VAULT,root=process.env.SB_SMOKE_VAULT||fs.mkdtempSync(path.join(os.tmpdir(),'sb-api-smoke-'));
 const templates=path.resolve(__dirname,'../../Templates');
 const dirs=['00_Inbox','01_Knowledge','03_Books/Fiction','03_Books/Nonfiction','04_Media/Videos','05_Personal','06_Daily','09_System/Templates'];
 for(const d of dirs)fs.mkdirSync(path.join(root,d),{recursive:true});
 if(owned)for(const f of fs.readdirSync(templates))fs.copyFileSync(path.join(templates,f),path.join(root,'09_System/Templates',f));
 const resolve=p=>{const f=path.resolve(root,p),r=path.relative(root,f);if(r.startsWith('..')||path.isAbsolute(r))throw Error('Outside test Vault');return f;};
 const obj=p=>({path:p,basename:path.basename(p,'.md'),extension:path.extname(p).slice(1)});
 // Only the scalar/list subset actually present in these template fixtures is decoded.
 const parseYaml=text=>{const out={};let key;for(const line of text.split(/\r?\n/)){if(!line.trim()||line.startsWith('#'))continue;const list=line.match(/^\s+-\s+(.+)$/);if(list){if(!Array.isArray(out[key]))throw Error('Invalid fixture list');out[key].push(list[1].startsWith('"')?JSON.parse(list[1]):list[1]);continue;}const m=line.match(/^([a-z_]+):\s*(.*)$/);if(!m)throw Error('Unsupported fixture YAML');key=m[1];let val=m[2];if(val.startsWith('[')){try{out[key]=JSON.parse(val);}catch{if(!/^\[[a-z_-]+(?:,\s*[a-z_-]+)*\]$/i.test(val))throw Error('Unsupported fixture flow list');out[key]=val.slice(1,-1).split(',').map(s=>s.trim());}}else out[key]=val===''?[]:val.startsWith('"')?JSON.parse(val):val;}return out;};
 const notes=()=>{const scan=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(path.join(d,e.name)):[path.join(d,e.name)]);return scan(root).filter(f=>f.endsWith('.md')).map(f=>obj(path.relative(root,f).replaceAll('\\','/')));};
 const opened=[],dateOptions=[];
 const app={vault:{getAbstractFileByPath:p=>fs.existsSync(resolve(p))?obj(p):null,getMarkdownFiles:notes,cachedRead:f=>Promise.resolve(fs.readFileSync(resolve(f.path),'utf8')),read:f=>Promise.resolve(fs.readFileSync(resolve(f.path),'utf8')),create:async(p,content)=>{fs.writeFileSync(resolve(p),content,{flag:'wx'});return obj(p);}},metadataCache:{getFileCache:f=>{const m=fs.readFileSync(resolve(f.path),'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);return m?{frontmatter:parseYaml(m[1])}:null;}},workspace:{getLeaf:()=>({openFile:async f=>opened.push(f.path)})}};
 const FixedDate=class extends Date{constructor(...args){super(...(args.length?args:['2026-01-01T00:30:00Z']));}};
 const intl={DateTimeFormat:function(locale,options){dateOptions.push({...options});return new Intl.DateTimeFormat(locale,options);}};
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../QuickAdd-Create.js'),'utf8'),{module,exports:module.exports,require:n=>{throw Error('Unavailable User Script dependency: '+n);},Intl:intl,Date:FixedDate,URL,console});
 const call=async(member,title,source='https://example.com/demo/'+member)=>{let count=0;await module.exports[member]({app,obsidian:{Notice:class{},parseYaml},variables:{},quickAddApi:{suggester:async()=>member==='book'?'nonfiction':'knowledge',inputPrompt:async()=>++count===1?title:source}});};
 const before=notes().length;
 for(const [member,title]of [['inbox','SAMPLE Inbox'],['knowledge','SAMPLE Knowledge'],['book','SAMPLE Book'],['thought','SAMPLE Thought'],['video','SAMPLE Video']])await call(member,title);
 await call('daily');
 assert.equal(notes().length,before+6);
 for(const f of notes().filter(f=>f.basename.startsWith('SAMPLE ')||f.path.startsWith('06_Daily/'))){const raw=fs.readFileSync(resolve(f.path),'utf8'),fm=parseYaml(raw.match(/^---\n([\s\S]*?)\n---/)[1]);assert.ok(fm.id);assert.ok(fm.type);assert.ok(Array.isArray(fm.sources));assert.ok(Array.isArray(fm.relations));assert.doesNotMatch(raw.replace(/<!--[\s\S]*?-->/g,''),/{{|<slug>|<序号>/);}
 const book=resolve('03_Books/Nonfiction/SAMPLE Book.md'),bookHash=fs.readFileSync(book,'utf8');
 await call('book','Different SAMPLE Title','https://example.com/demo/book');assert.equal(notes().length,before+6);assert.equal(fs.readFileSync(book,'utf8'),bookHash);
 await call('book','SAMPLE Book');assert.equal(notes().length,before+6);
 assert.ok(dateOptions.every(o=>!Object.hasOwn(o,'timeZone')),'SYSTEM default must not impose a timezone');
 const configFile=resolve('09_System/Config/local.json');fs.mkdirSync(path.dirname(configFile),{recursive:true});const original=fs.existsSync(configFile)?fs.readFileSync(configFile):null;
 try{fs.writeFileSync(configFile,JSON.stringify({timezone:'America/Los_Angeles'}));await call('daily');assert.ok(dateOptions.some(o=>o.timeZone==='America/Los_Angeles'));assert.ok(fs.existsSync(resolve('06_Daily/2025-12-31.md')));}
 finally{if(original)fs.writeFileSync(configFile,original);else fs.unlinkSync(configFile);}
 assert.ok(opened.length>=8);
 if(owned){const normalized=path.resolve(root);assert.ok(path.basename(normalized).startsWith('sb-api-smoke-'));assert.equal(path.dirname(normalized),path.resolve(os.tmpdir()));fs.rmSync(normalized,{recursive:true});}
});
