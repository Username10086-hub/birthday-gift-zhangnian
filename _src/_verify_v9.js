/* v9 静态/结构校验：覆盖本轮 9 项需求 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, '_src/shell.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, '_src/app.js'), 'utf8');
const mod = fs.readFileSync(path.join(ROOT, '_src/modules.js'), 'utf8');
const data = fs.readFileSync(path.join(ROOT, '_src/data.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, '_src/styles.css'), 'utf8');
const out = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); }
}
const idx = (s, sub) => s.indexOf(sub);

console.log('【① 首页天气卡片位置上移】');
const iWeather = idx(shell, 'id="weatherCard"');
const iHero = idx(shell, 'class="hero"');
const iStat = idx(shell, 'class="stat-grid"');
ck('weatherCard 在 hero 之后', iWeather > iHero && iHero > -1);
ck('weatherCard 在 stat-grid 之前', iWeather < iStat && iStat > -1);

console.log('【② 鼓励语为第三人称祝福口径】');
ck('MOTIVATIONS 含「小可欣儿也觉得你」', /小可欣儿也觉得你/.test(data));
ck('MOTIVATIONS 不含「今天小可欣儿也超级棒」', !/今天小可欣儿也超级棒/.test(data));
ck('MOTIVATIONS 不以「今天小可欣儿也+形容词」直夸', !/今天小可欣儿也(超级棒|很棒|真棒)/.test(data));
const mm = data.match(/APP\.MOTIVATIONS\s*=\s*\[([\s\S]*?)\];/);
ck('MOTIVATIONS 条目 >= 15', !!mm && (mm[1].match(/^\s*['"]/gm) || []).length >= 15);

console.log('【③ 非首次「不认识」静默无弹窗】');
// 取出 nextWord 函数体中「非首次」的静默处理段
const silentMatch = mod.match(/if \(known === false\) \{\s*([\s\S]{0,160}?)\}\s*\n\s*\/\/\s*今日已学逢整十/);
ck('nextWord 中 known===false 静默分支存在', !!silentMatch);
ck('静默分支内不调用 cheer(', !!silentMatch && !/cheer\(/.test(silentMatch[1]));
ck('静默分支内不调用 openNotice(', !!silentMatch && !/openNotice\(/.test(silentMatch[1]));
ck('静默分支内不调用 toast(', !!silentMatch && !/toast\(/.test(silentMatch[1]));
ck('非首次不再走弹窗：seenUnknownTip 作为首弹条件', /known === false && !Store\.data\.settings\.seenUnknownTip/.test(mod));
ck('每 10 个鼓励已限定 known === true', /known === true && learned > 0 && learned % 10 === 0/.test(mod));
ck('按钮文案已去掉（自动收藏）', !/（自动收藏）/.test(shell) && !/（自动收藏）/.test(mod));

console.log('【④ 年度消费折线：自由选年起止】');
ck('#yearFrom 选择器存在', shell.includes('id="yearFrom"'));
ck('#yearTo 选择器存在', shell.includes('id="yearTo"'));
ck('#yearLine 容器存在', shell.includes('id="yearLine"'));
ck('renderYearHistory 填充起止年份', /renderYearHistory/.test(mod) && /yearFrom/.test(mod));
ck('支持 from > to 自动交换', /swap|临时|交换/.test(mod) || /\[a, b\] = \[b, a\]/.test(mod));
ck('起始年份从 2026 开始', /START_Y\s*=\s*2026/.test(mod) || /\b2026\b/.test(mod));

console.log('【⑤ 运动趋势快捷键 + 删查看趋势按钮】');
ck('data-sportrange 3/7/30 快捷键存在', /data-sportrange="3"/.test(shell) && /data-sportrange="7"/.test(shell) && /data-sportrange="30"/.test(shell));
ck('近 3 天 / 近 1 周 / 近 1 月 文案', /近 ?3 ?天/.test(shell) && /近 ?1 ?周/.test(shell) && /近 ?1 ?月/.test(shell));
ck('#sportRangeLabel 存在', shell.includes('id="sportRangeLabel"'));
ck('「查看趋势」按钮已删除', !shell.includes('sportChartBtn'));
ck('sportChartBtn 绑定已删除', !mod.includes('sportChartBtn'));

console.log('【⑥ 专业学习：学习时间趋势】');
ck('#studyChart 存在', shell.includes('id="studyChart"'));
ck('data-studyrange 3/7/30 快捷键存在', /data-studyrange="3"/.test(shell) && /data-studyrange="7"/.test(shell) && /data-studyrange="30"/.test(shell));
ck('#studyRangeLabel / #studyFrom / #studyTo 存在', shell.includes('id="studyRangeLabel"') && shell.includes('id="studyFrom"') && shell.includes('id="studyTo"'));
ck('renderStudyChart 已定义', mod.includes('renderStudyChart'));

console.log('【⑦ 时政每日金句卡片】');
ck('#newsQuoteText 存在', shell.includes('id="newsQuoteText"'));
ck('#newsQuoteFrom 存在', shell.includes('id="newsQuoteFrom"'));
ck('v10：收藏按钮已移除', !shell.includes('newsQuoteFav') && !mod.includes('favNewsQuote'));
ck('v10：「每天自动刷新 · 可收藏」文案已移除', !/每天自动刷新 · 可收藏/.test(shell));
ck('APP.NEWS_QUOTES 数据存在', /APP\.NEWS_QUOTES\s*=/.test(data));
ck('NEWS_QUOTES 含人民日报来源', /人民日报/.test(data));
ck('NEWS_QUOTES 条目 >= 15', (() => { const m = data.match(/APP\.NEWS_QUOTES\s*=\s*\[([\s\S]*?)\n\];/); return !!m && (m[1].match(/\{/g) || []).length >= 15; })());
ck('renderNewsQuote 已定义（每天自动轮换，纯展示）', mod.includes('renderNewsQuote'));

console.log('【⑧ 设置背景音乐已删除】');
ck('shell 无 #bgmToggle', !shell.includes('bgmToggle'));
ck('shell 无 #bgmPreset', !shell.includes('bgmPreset'));
ck('shell 无 背景音乐 卡片', !/背景音乐/.test(shell));
ck('modules 无 bgm 绑定', !/bgmToggle|bgmPreset|bgmUrlSave|bgmVol/.test(mod));
ck('app.js 无 initAudio', !/initAudio/.test(app));
ck('app.js 无 APP.bgm', !/APP\.bgm\b/.test(app));
ck('defaults 无 bgm 字段', !/bgm:\s*false/.test(app) && !/bgmVol/.test(app));
ck('data.js 无 BGM_DEFAULT/BGM_OPTIONS', !/BGM_DEFAULT|BGM_OPTIONS/.test(data));

console.log('【⑨ 生日按钮仅 10.16 出现 + 五彩烟花】');
ck('shell 中 birthdayBtn 默认 hidden', /id="birthdayBtn"[^>]*hidden/.test(shell));
ck('app 定义 syncBirthdayBtn', app.includes('syncBirthdayBtn'));
ck('boot() 调用 syncBirthdayBtn', /syncBirthdayBtn\(\)/.test(app));
ck('showWorkbench 中调用 syncBirthdayBtn', (app.match(/syncBirthdayBtn\(\)/g) || []).length >= 2);
ck('syncBirthdayBtn 依据 isBirthdayToday', /syncBirthdayBtn[\s\S]{0,200}isBirthdayToday/.test(app));
ck('CSS .btn-bday[hidden] display:none', /\.btn-bday\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(css));
ck('设置里「重新体验惊喜」入口仍在', shell.includes('data-action="replay-birthday"'));
ck('烟花配色含红 #FF4D4F', /FW_COLORS[\s\S]{0,300}#FF4D4F/.test(app));
ck('烟花配色含黄 #FFC53D', /FW_COLORS[\s\S]{0,300}#FFC53D/.test(app));
ck('烟花配色含绿 #73D13D', /FW_COLORS[\s\S]{0,300}#73D13D/.test(app));
ck('烟花配色含蓝 #40A9FF', /FW_COLORS[\s\S]{0,300}#40A9FF/.test(app));
ck('烟花配色含紫 #9254DE', /FW_COLORS[\s\S]{0,300}#9254DE/.test(app));
ck('已移除旧蓝紫 neon 主色 #A5B4FC', !/#A5B4FC/.test(app));

console.log('【产物 index.html 一致性】');
ck('index.html 已包含 #studyChart', out.includes('id="studyChart"'));
ck('index.html 已包含 #newsQuoteText', out.includes('id="newsQuoteText"'));
ck('index.html 已移除 #bgmToggle', !out.includes('bgmToggle'));
ck('index.html 已移除 #sportChartBtn', !out.includes('sportChartBtn'));
ck('index.html 含五彩烟花 #FF4D4F', out.includes('#FF4D4F'));

console.log('\n────────────────────────────');
console.log(`通过 ${pass} 项 / 失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
