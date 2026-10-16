// 本轮 v8 功能核验（静态 + 纯逻辑）
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
let ok = 0, bad = 0;
function has(label, cond) {
  if (cond) { console.log('  ✅ ' + label); ok++; }
  else { console.log('  ❌ ' + label); bad++; }
}

console.log('【1】运动打卡鼓励语「动态效果」');
has('cheer 打字机实现（逐字 setInterval）', /function cheer\(el, text, hold, opt\)/.test(html) && /clearInterval\(el\._timer\)/.test(html) && /setInterval/.test(html));
has('打字机光标元素 .cheer-caret', /cheer-caret/.test(html));
has('光效动画 cheerShine', /cheerShine/.test(html));
has('#workCheer 带 cheer 类', /class="cheer-text cheer" id="workCheer"/.test(html));
has('打卡调用带 speed 参数', /cheer\(\$\('#workCheer'\)[\s\S]{0,120}speed:\s*55/.test(html));

console.log('\n【2】删除「今日第 N 个」与「（自动收藏）」');
has('无「今日第 」文案', !/今日第/.test(html));
has('无「不限量」', !/不限量/.test(html));
has('#wProgress 元素已移除', !/id="wProgress"/.test(html));
has('不认识按钮无「（自动收藏）」', /id="wAgain"><i class="fa-solid fa-rotate-left"><\/i> 不认识</.test(html) || />\s*不认识</.test(html));
has('按钮文案为纯「不认识」', !/不认识（自动收藏）/.test(html));

console.log('\n【3】年度消费对比折线图（自 2026 起）');
has('起始年份为 2026（自 2026 起）', /START_Y\s*=\s*2026/.test(html));
has('label 为「YYYY 年」', /yy \+ ' 年'/.test(html));
has('说明文案含「每年消费折线」', /每年消费折线（自 2026 年起/.test(html));
has('v9 新增：#yearFrom / #yearTo 起止年份选择', /id="yearFrom"/.test(html) && /id="yearTo"/.test(html));

console.log('\n【4】经期前一天提醒 + 首页标红');
has('maybePeriodReminder 函数', /function maybePeriodReminder/.test(html));
has('left === 1 触发', /p\.left !== 1/.test(html));
has('同一天只弹一次 periodRemindOn', /periodRemindOn/.test(html));
has('首页 #sPeriodWrap 元素', /id="sPeriodWrap"/.test(html));
has('标红 class period-soon', /period-soon/.test(html));
has('CSS .stat.period-soon 呼吸动画', /\.stat\.period-soon/.test(html) && /periodPulse/.test(html));
has('启动时调用 maybePeriodReminder()', /renderFabList\(\);\s*maybePeriodReminder\(\)/.test(html));
has('提醒文案含「备好卫生用品」', /提前备好卫生用品/.test(html));

console.log('\n【5】首页当地天气 + 穿衣提醒');
has('#weatherCard 卡片', /id="weatherCard"/.test(html));
has('#weatherBody 容器', /id="weatherBody"/.test(html));
has('#weatherRefresh 刷新按钮', /id="weatherRefresh"/.test(html));
has('Open-Meteo 接口', /api\.open-meteo\.com\/v1\/forecast/.test(html));
has('定位 locate()', /function locate\(\)/.test(html) && /navigator\.geolocation/.test(html));
has('天气缓存 WX_KEY（10 分钟）', /morandi_wx_v1/.test(html) && /600000/.test(html));
has('wxTipKey 温度分档', /function wxTipKey/.test(html));
has('WEATHER_CODES WMO 映射', /WEATHER_CODES/.test(html));
has('WEATHER_TIPS 穿衣建议', /WEATHER_TIPS/.test(html));
has('输出「穿：」「带：」', /<b>穿：<\/b>/.test(html) && /<b>带：<\/b>/.test(html));
has('加载中占位', /正在获取当地天气/.test(html));
has('失败优雅降级', /天气获取失败/.test(html));
has('renderHome 调用 renderWeather', /renderHome\(\)\s*\{\s*refreshHome\(\);\s*renderWeather\(\);\s*\}/.test(html));

console.log('\n【6】首页个人鼓励语');
has('MOTIVATIONS 以「今天小可欣儿也」开头', /APP\.MOTIVATIONS\s*=\s*\[\s*'今天小可欣儿也/.test(html));
const mCount = (html.match(/今天小可欣儿也/g) || []).length;
has(`鼓励语条数 ${mCount}（≥10）`, mCount >= 10);
has('含「为你加油呀」', /为你加油呀/.test(html));
has('含「为你喝彩呀」', /为你喝彩呀/.test(html));
has('含「相信你呀」', /相信你呀/.test(html));
has('换一句有 swap 动画', /classList\.add\('swap'\)/.test(html) && /quoteSwap/.test(html));

console.log('\n========================================');
console.log(`通过 ${ok} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
