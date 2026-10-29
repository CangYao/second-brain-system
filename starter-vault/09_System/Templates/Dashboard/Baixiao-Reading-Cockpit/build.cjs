// Rebuild the local fork without npm, network access or a second upstream copy.
const fs = require('node:fs');
const path = require('node:path');
const marker = '// BEGIN SECOND BRAIN ADAPTERS';
const file = path.join(__dirname,'main.js');
const upstream = fs.readFileSync(file,'utf8').split(marker)[0].trimEnd();
const data = fs.readFileSync(path.join(__dirname,'second-brain-data.js'),'utf8');
const ui = fs.readFileSync(path.join(__dirname,'second-brain-ui.js'),'utf8');
const bundle = `${upstream}\n\n${marker}\n// Upstream: csuyincs-creator/Baixiao-Reading-Cockpit @ 99c34d0a15398636fdbf4e497e76347cdd91fcf4\n(function(module) {\n${data}\nmodule.exports.install({DashboardView,PluginClass:ReadingDashboardPluginClass,TFile,Notice,dateKey,localDate});\n})({exports:{}});\n(function(module) {\n${ui}\nmodule.exports({DashboardView,esc,dateKey,localDate});\n})({exports:{}});\n`;
fs.writeFileSync(file,bundle);
const cssFile=path.join(__dirname,'styles.css');
const cssMarker='/* BEGIN SECOND BRAIN STYLES */';
const baseCss=fs.readFileSync(cssFile,'utf8').split(cssMarker)[0].trimEnd();
fs.writeFileSync(cssFile,baseCss+'\n\n'+cssMarker+'\n'+fs.readFileSync(path.join(__dirname,'second-brain.css'),'utf8'));
console.log('Built Baixiao Reading Cockpit + Second Brain adapters.');
