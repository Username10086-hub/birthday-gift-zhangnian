// 校验 index.html 中所有 $('#id') / getElementById('id') 引用是否都有对应的 id=".."
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const ids = new Set();
const idRe = /\bid\s*=\s*"([^"]+)"/g;
let m;
while ((m = idRe.exec(html))) ids.add(m[1]);

const refs = new Set();
const refRe = /\$\(\s*['"]#([A-Za-z0-9_\-]+)['"]\s*\)/g;
while ((m = refRe.exec(html))) refs.add(m[1]);
const gebRe = /getElementById\(\s*['"]([A-Za-z0-9_\-]+)['"]\s*\)/g;
while ((m = gebRe.exec(html))) refs.add(m[1]);

const missing = [...refs].filter((r) => !ids.has(r) && !r.startsWith('view-'));
console.log('总 id 数:', ids.size, '| 引用数:', refs.size);
console.log(missing.length ? '❌ 缺失 id: ' + missing.join(', ') : '✅ 所有引用 id 均存在');
