const fs = require('node:fs');
const file = process.argv[2];
let src = fs.readFileSync(file, 'utf8');
if (src.includes("'identity-pass'")) { console.log('Already registered.'); process.exit(0); }
const needle = "'scout-spin-fix-2',";
const first = src.indexOf(needle);
if (first === -1 || src.indexOf(needle, first + 1) !== -1) throw new Error('Marker not found exactly once.');
src = src.replace(needle, "'scout-spin-fix-2',\n        'identity-pass',");
fs.writeFileSync(file, src);
console.log('Registered identity-pass.');
