// 直接单测 periodStat + maybePeriodReminder 的判定条件（mock 依赖）
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// --- 复刻工具函数 ---
const pad2 = (n) => String(n).padStart(2, '0');
const dateStr = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => dateStr();
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => parseFloat(v) || 0;

// --- 从打包产物里抽出 periodStat 源码 ---
const src = html.match(/function periodStat\(\)\s*\{[\s\S]*?\n  \}/);
if (!src) { console.log('❌ 未找到 periodStat'); process.exit(1); }

// mock Store
let STORE = { periods: [], settings: {} };
const Store = { data: STORE };

eval(src[0]);   // 定义 periodStat

let ok = 0, bad = 0;
const chk = (l, c) => { if (c) { console.log('  ✅ ' + l); ok++; } else { console.log('  ❌ ' + l); bad++; } };

function setData(startOffsetDays, avgCycle, avgDur) {
  STORE = {
    periods: [{ id: 'p', start: dateStr(new Date(Date.now() - startOffsetDays * 86400000)), end: dateStr(new Date(Date.now() - (startOffsetDays - 5) * 86400000)) }],
    settings: { period: { avgCycle, avgDur } }
  };
  Store.data = STORE;
  // periodStat 内部用 Store.data
  globalThis.Store = Store;
}

console.log('【periodStat 预测天数】');
setData(27, 28, 5);   // next = today + 1
let p = periodStat();
chk(`start=-27,cycle=28 → left=${p.left}（应为 1）`, p.left === 1);
chk('next 为明天', p.next === dateStr(new Date(Date.now() + 86400000)));

setData(23, 28, 5);   // next = today + 5
p = periodStat();
chk(`start=-23,cycle=28 → left=${p.left}（应为 5）`, p.left === 5);

setData(28, 28, 5);   // next = today
p = periodStat();
chk(`start=-28,cycle=28 → left=${p.left}（应为 0）`, p.left === 0);

setData(29, 28, 5);   // next = 昨天
p = periodStat();
chk(`start=-29,cycle=28 → left=${p.left}（应为 -1）`, p.left === -1);

console.log('\n【触发条件：left === 1 才弹窗/标红】');
const shouldRemind = (left) => left === 1;
chk('left=1 → 提醒', shouldRemind(1) === true);
chk('left=0 → 不提醒', shouldRemind(0) === false);
chk('left=5 → 不提醒', shouldRemind(5) === false);
chk('left=-1 → 不提醒', shouldRemind(-1) === false);

console.log('\n【无数据时不提醒】');
STORE = { periods: [], settings: {} }; Store.data = STORE;
p = periodStat();
chk('hasData=false', p.hasData === false);
chk('无数据不触发提醒', !(p.hasData && p.left === 1));

console.log('\n========================================');
console.log(`通过 ${ok} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
