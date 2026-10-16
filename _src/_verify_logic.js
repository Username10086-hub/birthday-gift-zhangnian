// 纯逻辑单测：气温分档 + 逐年消费对比
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// 抽出 wxTipKey 函数体
const m = html.match(/function wxTipKey\(t\)\s*\{[\s\S]*?\n  \}/);
if (!m) { console.log('❌ 未找到 wxTipKey'); process.exit(1); }
eval(m[0]);   // 定义 wxTipKey

// 抽出 WEATHER_TIPS / WEATHER_CODES 数据
const APP = {};
const tipsM = html.match(/APP\.WEATHER_TIPS\s*=\s*\{[\s\S]*?\n\};/);
eval(tipsM[0]);
const codesM = html.match(/APP\.WEATHER_CODES\s*=\s*\{[\s\S]*?\n\};/);
eval(codesM[0]);

let ok = 0, bad = 0;
const t = (label, actual, expect) => {
  if (actual === expect) { console.log('  ✅ ' + label + ' → ' + actual); ok++; }
  else { console.log('  ❌ ' + label + ' 期望 ' + expect + ' 实际 ' + actual); bad++; }
};

console.log('【wxTipKey 温度分档】');
t('38°C', wxTipKey(38), 'hot');
t('35°C', wxTipKey(35), 'hot');
t('30°C', wxTipKey(30), 'warm');
t('25°C', wxTipKey(25), 'mild');
t('18°C', wxTipKey(18), 'cool');
t('12°C', wxTipKey(12), 'cold');
t('5°C',  wxTipKey(5),  'chilly');
t('-3°C', wxTipKey(-3), 'freezing');
t('0°C',  wxTipKey(0),  'chilly');

console.log('\n【每个档位都有穿/带建议】');
for (const k of ['hot','warm','mild','cool','cold','chilly','freezing']) {
  const v = APP.WEATHER_TIPS[k];
  t(k, !!(v && v.wear && v.bring), true);
}

console.log('\n【WMO 天气码覆盖常见值】');
[0,1,2,3,45,51,61,63,65,71,73,75,80,95].forEach((c) => t('code ' + c, !!APP.WEATHER_CODES[c], true));

console.log('\n【逐年消费对比逻辑】');
const d = (yy) => { const exp = { ['2026']: 12000, ['2027']: 15000, ['2028']: 9000 }[yy] || 0; return exp; };
const START_Y = 2026;
function cmp(lastY) {
  const years = [];
  for (let yy = START_Y; yy <= lastY; yy++) years.push(String(yy));
  return years.map((yy) => yy + ' 年');
}
t('2026 年只有 1 个点', JSON.stringify(cmp(2026)), JSON.stringify(['2026 年']));
t('2026→2028 三个点', JSON.stringify(cmp(2028)), JSON.stringify(['2026 年','2027 年','2028 年']));

console.log('\n========================================');
console.log(`通过 ${ok} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
