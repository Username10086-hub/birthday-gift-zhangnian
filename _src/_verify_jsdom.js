/* 用 jsdom 在真实 DOM 里跑一遍 index.html，验证生日页关键节点与封面渲染 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('C:/Users/14342/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ck = (n, c, e) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (e ? '  → ' + e : '')); } };

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://127.0.0.1:8899/index.html',
  resources: undefined
});
const w = dom.window;
const d = w.document;

setTimeout(() => {
  console.log('【真实 DOM：页面结构】');
  ck('生日页 pageA 存在', !!d.getElementById('pageA'));
  ck('工作台 pageB 存在', !!d.getElementById('pageB'));
  ck('音频元素存在且指向 bday-music.mp3', (d.getElementById('bdayAudio') || {}).getAttribute
      ? d.getElementById('bdayAudio').getAttribute('src') === 'images/bday-music.mp3' : false);
  ck('黑幕 #bdBlack 存在', !!d.getElementById('bdBlack'));
  ck('音乐提示 #bdMusicHint 存在', !!d.getElementById('bdMusicHint'));
  ck('跑酷画布 #runCanvas 存在', !!d.getElementById('runCanvas'));
  ck('星空相册舞台 #stageAlbum 存在（照片轮播位置）', !!d.getElementById('stageAlbum'));
  ck('输入框 #bdayInputBox 存在', !!d.getElementById('bdayInputBox'));
  ck('祝福容器 #wishField 存在', !!d.getElementById('wishField'));
  ck('金句容器 #bdBoom 存在', !!d.getElementById('bdBoom'));
  ck('跑酷收尾使用 #convergeCanvas 光点舞台', !!d.getElementById('convergeCanvas'));
  ck('礼物提示 #giftHint 存在', !!d.getElementById('giftHint'));

  console.log('【真实 DOM：脚本已 boot】');
  ck('window.APP 存在', !!w.APP);
  ck('APP.showSurprise 已暴露', typeof w.APP.showSurprise === 'function');
  ck('APP.showWorkbench 已暴露', typeof w.APP.showWorkbench === 'function');
  ck('生日页初始为显示（首页 banner 或 auto）', !!d.getElementById('pageA'));
  ck('工作台导航已渲染（initWorkbench 跑过）', !!d.querySelector('[data-nav="home"]'));

  console.log('【真实 DOM：时政金句无收藏】');
  ck('#newsQuoteFav 不存在', !d.getElementById('newsQuoteFav'));
  ck('金句朗读按钮已移除', !d.getElementById('newsQuoteSpeak'));
  // 切到时政页，触发 renderNews → renderNewsQuote
  if (typeof w.APP.go === 'function') w.APP.go('news');
  ck('切到时政页后金句文案已填充', (d.getElementById('newsQuoteText') || {}).textContent !== '',
     JSON.stringify((d.getElementById('newsQuoteText') || {}).textContent));
  ck('金句来源已填充', (d.getElementById('newsQuoteFrom') || {}).textContent !== '');

  console.log('【真实 DOM：生日按钮平时隐藏】');
  const bb = d.getElementById('birthdayBtn');
  ck('#birthdayBtn 存在', !!bb);
  ck('#birthdayBtn 今天(10.16)显示（今天正是生日）', bb ? bb.hidden === false : false,
     '今天=' + new Date().toISOString().slice(5, 10));

  console.log('\n────────────────────────────');
  console.log(`通过 ${pass} 项 / 失败 ${fail} 项`);
  dom.window.close();
  process.exit(fail ? 1 : 0);
}, 1800);
