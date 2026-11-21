// One-off patch: preload the Scout world-map image at app start so it is already
// cached when the Scout page opens (it was previously fetched only on first render).
const fs = require('node:fs');
const file = process.argv[2] || 'TradeMate-main/apps/web/public/tm/app.js';
let src = fs.readFileSync(file, 'utf8');
if (src.includes('SCPRE=')) { console.log('Already patched.'); process.exit(0); }
const needle = 'SCMAP="/tm/img/scout-map.jpg?v=2",SCI=';
const first = src.indexOf(needle);
if (first === -1 || src.indexOf(needle, first + 1) !== -1) throw new Error('Marker not found exactly once.');
const replacement = 'SCMAP="/tm/img/scout-map.jpg?v=2",SCPRE=function(){try{var i=new Image;i.decoding="async",i.src=SCMAP,window.__scMapImg=i}catch(e){}}(),SCI=';
src = src.replace(needle, replacement);
fs.writeFileSync(file, src);
console.log('app.js patched.');
