/* 构建脚本：把 _src 下的 CSS / JS 内联进 shell.html，输出单文件 index.html */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = __dirname;

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

let html = read('shell.html');

const parts = {
  '/*{{CSS}}*/': read('styles.css'),
  '/*{{DATA}}*/': read('data.js'),
  '/*{{APP}}*/': read('app.js'),
  '/*{{MODULES}}*/': read('modules.js')
};

Object.keys(parts).forEach((token) => {
  if (!html.includes(token)) throw new Error('缺少占位符: ' + token);
  // 用函数返回值，避免 $& 等特殊替换符号被解释
  html = html.replace(token, () => parts[token]);
});

// 安全校验：内联内容里不能出现 </script>
['data.js', 'app.js', 'modules.js'].forEach((f) => {
  if (read(f).includes('</script')) throw new Error(f + ' 含有 </script>，会破坏内联结构');
});

fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8');
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('✅ 已生成单文件 index.html（' + kb + ' KB）');
