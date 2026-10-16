// 最小 DOM 垫片：加载打包后的 index.html 内的脚本，检查是否抛运行时错误
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');

// 抽出三段 script 内容
const scripts = [];
const re = /<script>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html))) scripts.push(m[1]);
console.log('脚本段数:', scripts.length);

// 构造极简 DOM
function makeEl(id) {
  const el = {
    id, _cls: new Set(), style: {}, dataset: {}, children: [], value: '', innerHTML: '', textContent: '',
    classList: {
      add: (...c) => c.forEach((x) => el._cls.add(x)),
      remove: (...c) => c.forEach((x) => el._cls.delete(x)),
      contains: (c) => el._cls.has(c),
      toggle: (c, f) => { const on = f === undefined ? !el._cls.has(c) : f; on ? el._cls.add(c) : el._cls.delete(c); return on; }
    },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    insertAdjacentText() {}, insertAdjacentHTML() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, focus() {}, scrollIntoView() {}, offsetWidth: 100
  };
  return el;
}
const registry = {};
const doc = {
  _ready: [],
  getElementById(id) { return (registry[id] = registry[id] || makeEl(id)); },
  querySelector(sel) { const id = String(sel).replace(/^#/, ''); return (registry[id] = registry[id] || makeEl(id)); },
  querySelectorAll() { return []; },
  createElement(t) { return makeEl('new-' + t); },
  addEventListener() {},
  body: makeEl('body'),
  documentElement: makeEl('html'),
  readyState: 'complete',
  cookie: ''
};
const store = {};
const sandbox = {
  window: {}, document: doc, console,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  },
  location: { protocol: 'http:', reload() {}, href: 'http://127.0.0.1:8899/index.html' },
  navigator: { geolocation: { getCurrentPosition: (s, e) => e && e() }, serviceWorker: undefined, userAgent: 'node' },
  fetch: () => Promise.reject(new Error('no-network-in-test')),
  setTimeout: (f, t) => setTimeout(f, t), clearTimeout,
  setInterval: (f, t) => setInterval(f, t), clearInterval,
  Math, Date, JSON, Object, Array, String, Number, Boolean, Promise, Error, RegExp, isNaN, parseInt, parseFloat,
  requestAnimationFrame: (f) => setTimeout(f, 16), cancelAnimationFrame: clearTimeout,
  alert() {}, confirm: () => true, prompt: () => '',
  Audio: function () { return { play() {}, pause() {}, addEventListener() {} }; },
  SpeechSynthesisUtterance: function () {}, speechSynthesis: { speak() {}, cancel() {} },
  FileReader: function () { return { readAsText() {}, addEventListener() {} }; },
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  Blob: function () {}
};
sandbox.window = sandbox;
sandbox.addEventListener = function (ev, fn) { if (ev === 'load' || ev === 'DOMContentLoaded') { /* 稍后手动触发 */ } };
sandbox.removeEventListener = function () {};
sandbox.dispatchEvent = function () {};
sandbox.window.APP = {};
sandbox.window.Store = undefined;
sandbox.globalThis = sandbox;

const ctx = vm.createContext(sandbox);
let errs = 0;
scripts.forEach((code, i) => {
  try { vm.runInContext(code, ctx, { timeout: 8000 }); console.log(`  ✅ script[${i}] 执行通过`); }
  catch (e) { console.log(`  ❌ script[${i}] 抛错: ${e.message}`); errs++; }
});

// 尝试触发 boot
try {
  if (typeof sandbox.initWorkbench === 'function') {
    sandbox.initWorkbench();
    console.log('  ✅ initWorkbench() 执行通过（首页/weather/periodReminder 初始化无异常）');
  } else { console.log('  ℹ️ 未发现 initWorkbench'); }
} catch (e) { console.log('  ❌ boot 抛错: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')); errs++; }

console.log('\n运行时错误数:', errs);
process.exit(errs ? 1 : 0);
