'use strict';
// Package/discovery/import model only. Does not claim official importer or GUI execution.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vault=process.env.SB_STARTER_TEST_VAULT||path.resolve(__dirname,'../../..');
const packagePath=path.join(vault,'09_System/Config/QuickAdd-Starter.quickadd.json');
test('fresh starter deploys six official-shaped choices and valid member references',()=>{
 const p=JSON.parse(fs.readFileSync(packagePath,'utf8'));assert.equal(p.schemaVersion,1);assert.equal(p.quickAddVersion,'2.31.0');assert.equal(p.assets.length,0);assert.equal(p.choices.length,6);
 const module={exports:{}};new Function('require','module','exports',fs.readFileSync(path.join(vault,'09_System/Scripts/QuickAdd-Create.js'),'utf8'))(()=>{throw Error('No resolvable runtime dependency');},module,module.exports);
 const names=['新增 Inbox','新增书籍','新增视频','新增知识','新增想法','新增每日记录'];assert.deepEqual(p.choices.map(c=>c.choice.name),names);assert.equal(new Set(p.rootChoiceIds).size,6);
 for(const {choice,pathHint,parentChoiceId}of p.choices){assert.ok(p.rootChoiceIds.includes(choice.id));assert.deepEqual(pathHint,[]);assert.equal(parentChoiceId,null);assert.equal(choice.type,'Macro');assert.equal(choice.command,true);assert.equal(choice.runOnStartup,false);assert.equal(choice.macro.commands.length,1);const cmd=choice.macro.commands[0];assert.equal(cmd.type,'UserScript');assert.equal(cmd.path,'09_System/Scripts/QuickAdd-Create.js');assert.equal(typeof module.exports[cmd.name.split('::')[1]],'function');}
});
test('empty plugin settings plus reviewed package imports six commands without replacing user choices',()=>{
 const p=JSON.parse(fs.readFileSync(packagePath,'utf8'));const initial={choices:[],userSetting:'preserve'};
 // Explicit limited model: QuickAdd install does not itself infer choices from scripts.
 assert.equal(initial.choices.length,0);const imported={...initial,choices:p.choices.map(e=>structuredClone(e.choice))};
 const saved=JSON.parse(JSON.stringify(imported));assert.equal(saved.userSetting,'preserve');assert.equal(saved.choices.filter(c=>c.command).length,6);
 const ids=new Set(saved.choices.map(c=>c.id));const skipped=p.choices.filter(e=>!ids.has(e.choice.id));assert.equal(skipped.length,0,'second import with Skip must not duplicate entries');
});
