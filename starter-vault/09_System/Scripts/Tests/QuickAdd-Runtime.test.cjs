'use strict';
// Loader/invocation contract regression, not an Electron/Obsidian GUI test.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../QuickAdd-Create.js'),'utf8');
function load(text,requireFn){const exports={},module={exports};new Function('require','module','exports',text)(requireFn,module,exports);return module.exports;}
const denyRequire=name=>{const e=new Error("Cannot find module '"+name+"'");e.code='MODULE_NOT_FOUND';throw e;};
test('loader rejects the old module-resolution assumption',()=>{
 assert.throws(()=>load("const { Notice, parseYaml } = require('obsidian');",denyRequire),{code:'MODULE_NOT_FOUND'});
});
test('all six member exports load without any resolvable module',()=>{
 const requests=[],entries=load(source,name=>{requests.push(name);return denyRequire(name);});
 assert.deepEqual(requests,[]);
 assert.deepEqual(Object.keys(entries).sort(),['book','daily','inbox','knowledge','thought','video']);
 for(const entry of Object.values(entries))assert.equal(typeof entry,'function');
});
test('missing injected Obsidian API fails explicitly before Vault access/write',async()=>{
 const entries=load(source,denyRequire);let accesses=0;
 const app=new Proxy({},{get(){accesses++;throw Error('Vault must not be touched');}});
 await assert.rejects(entries.knowledge({app,quickAddApi:{},variables:{}}),/params\.obsidian/);
 assert.equal(accesses,0);
});
test('official params.obsidian injection reaches a safe cancellation without module loading',async()=>{
 const entries=load(source,denyRequire);let prompts=0,writes=0;
 const app={vault:{getAbstractFileByPath:()=>null,create:()=>{writes++;throw Error('Cancelled input must not write');}}};
 const params={app,variables:{},obsidian:{Notice:class{},parseYaml:()=>{throw Error('No YAML parsing expected before cancellation');}},quickAddApi:{inputPrompt:async()=>{prompts++;return null;}}};
 await entries.knowledge(params,{});assert.equal(prompts,1);assert.equal(writes,0);
});
