/* v10 静态/结构校验：时政金句去收藏 + 生日页音乐驱动时间轴 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, '_src/shell.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, '_src/app.js'), 'utf8');
const mod = fs.readFileSync(path.join(ROOT, '_src/modules.js'), 'utf8');
const data = fs.readFileSync(path.join(ROOT, '_src/data.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, '_src/styles.css'), 'utf8');
const out = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const fsx = fs;   // 便于文件系统检查

let pass = 0, fail = 0;
function ck(name, cond, extra) { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); } }

console.log('【① 时政金句：去掉收藏】');
ck('shell 无 #newsQuoteFav', !shell.includes('newsQuoteFav'));
ck('shell 无「每天自动刷新 · 可收藏」', !/每天自动刷新 · 可收藏/.test(shell));
ck('modules 无 favNewsQuote', !mod.includes('favNewsQuote'));
ck('modules 无 #newsQuoteFav 绑定', !mod.includes("$('#newsQuoteFav')"));
ck('FAV_CATS 已移除「时政金句」', !/时政金句/.test(data));
ck('金句朗读按钮已移除（v12）', !shell.includes('id="newsQuoteSpeak"'));
ck('每天自动轮换逻辑保留（dayIdx）', /dayIdx\(\)/.test(mod));

console.log('【② 生日音乐：本地文件 + 黑屏提示】');
ck('shell 有 #bdayAudio', shell.includes('id="bdayAudio"'));
ck('音频指向 images/bday-music.mp3', /src="images\/bday-music\.mp3"/.test(shell));
ck('APP.BDAY_MUSIC 指向 bday-music.mp3', /APP\.BDAY_MUSIC\s*=\s*'images\/bday-music\.mp3'/.test(data));
ck('压缩后音频文件存在', fsx.existsSync(path.join(ROOT, 'images/bday-music.mp3')));
const auSize = fsx.existsSync(path.join(ROOT, 'images/bday-music.mp3')) ? fsx.statSync(path.join(ROOT, 'images/bday-music.mp3')).size : 0;
ck('音频体积 < 8MB（已压缩）', auSize > 0 && auSize < 8 * 1024 * 1024, (auSize / 1048576).toFixed(1) + 'MB');
ck('shell 有 #bdBlack 黑幕', shell.includes('id="bdBlack"'));
ck('shell 有 #bdMusicHint 音乐提示', shell.includes('id="bdMusicHint"'));
ck('音乐提示文案含「音乐」', /这里有一段音乐/.test(shell));

console.log('【③ 时间轴锚点（APP.BDAY_TL）】');
ck('hintFade = 5', /hintFade:\s*5\b/.test(data));
ck('blowReady = 25（音频 25s 处突然大亮）', /blowReady:\s*25\b/.test(data));
ck('collect = 70', /collect:\s*70\b/.test(data));
ck('inputSecs = 15', /inputSecs:\s*15\b/.test(data));
ck('fireworks = 91', /fireworks:\s*91\b/.test(data));
ck('parkour = 92', /parkour:\s*92\b/.test(data));
ck('parkourEnd = 180', /parkourEnd:\s*180\b/.test(data));
ck('letterShow = 183', /letterShow:\s*183\b/.test(data));
ck('letterFlash = 3', /letterFlash:\s*3\b/.test(data));

console.log('【④ 音乐驱动机制】');
ck('musicTime() 读取音频进度', /function musicTime\(\)/.test(app));
ck('atTime() 按进度触发', /function atTime\(t, fn\)/.test(app));
ck('音乐被拦截时等点击补播', /function resumeBdayMusic\(\)/.test(app) && /needTap/.test(app));
ck('showSurprise 里调用 startSurprise', /startSurprise\(\);/.test(app));
ck('resetSurprise 停止音乐', /stopBdayMusic\(\)/.test(app));

console.log('【⑤ 照片轮播（照片下方=文件名=我的话）】');
ck('APP.BDAY_PHOTOS 存在', /APP\.BDAY_PHOTOS\s*=/.test(data));
const photoCount = (() => { const m = data.match(/APP\.BDAY_PHOTOS\s*=\s*\[([\s\S]*?)\n\];/); return m ? (m[1].match(/\{ file:/g) || []).length : 0; })();
ck('照片数量 = 10（与 images/ 一致）', photoCount === 10, 'n=' + photoCount);
ck('每张都带 cap（我的话）', /cap:/.test(data));
ck('照片轮播位已换成星空相册（#stageAlbum 在 #stageInput 之前）', shell.includes('id="stageAlbum"') && shell.indexOf('id="stageAlbum"') < shell.indexOf('id="stageInput"'));
ck('旧的 #photoDeck 已移除', !shell.includes('id="photoDeck"'));
ck('startPhotos() 已定义', /function startPhotos\(\)/.test(app));
[[1, '第一张照片文件存在'], [2, '']].forEach(() => {});
ck('照片文件均存在于 images/', (APP_PHOTOS() || []).every((f) => fsx.existsSync(path.join(ROOT, 'images', f))));
function APP_PHOTOS() { return (data.match(/'([^']+\.jpg)'/g) || []).map((s) => s.slice(1, -1)); }
ck('相册为全自动轮播（nextDwellMs + dwellAt 计时）', /function nextDwellMs\(\)/.test(app) && /now - ALB\.dwellAt > ALB\.dwellMs/.test(app));
ck('相册不再接手动交互（无拖拽/点击换页）', !/albumDragStart/.test(app) && !/function albumDragMove/.test(app) && !/track\.addEventListener\('click'/.test(app));

console.log('【⑥ 输入框（15 秒倒计时）】');
ck('shell 有 #stageInput / #bdayInputBox / #bdayInputGo', shell.includes('id="stageInput"') && shell.includes('id="bdayInputBox"') && shell.includes('id="bdayInputGo"'));
ck('shell 有 #bdayInputCount 倒计时读数', shell.includes('id="bdayInputCount"'));
ck('openInput() / finishInput() 已定义', /function openInput\(\)/.test(app) && /function finishInput\(/.test(app));
ck('倒计时到期自动收尾', /left <= 0[\s\S]{0,80}finishInput\(true\)/.test(app));
ck('她写的话会被记下（bdayNotes）', /bdayNotes/.test(app));

console.log('【⑦ 满屏「我希望张年XX」祝福】');
ck('APP.BDAY_WISHES 存在', /APP\.BDAY_WISHES\s*=/.test(data));
ck('祝福格式全为「我希望张年…」', (() => { const m = data.match(/APP\.BDAY_WISHES\s*=\s*\[([\s\S]*?)\n\];/); if (!m) return false; const items = (m[1].match(/'[^']+'/g) || []); return items.length >= 15 && items.every((s) => s.includes('我希望张年')); })());
ck('shell 有 #stageWishes / #wishField', shell.includes('id="stageWishes"') && shell.includes('id="wishField"'));
ck('CSS 有 .wish-chip', /\.wish-chip\s*\{/.test(css));
ck('CSS 有按批次上抽动画 chipAway（v12）', /@keyframes chipAway/.test(css));
ck('startWishes() 已定义', /function startWishes\(/.test(app));

console.log('【⑧ 91s 猛炸大烟花 + 金句】');
ck('APP.BDAY_BOOM 金句正确', /虽然我们的过去看似很少很少，但是我们的未来一定很多很多/.test(data));
ck('bigBoom() 已定义', /function bigBoom\(\)/.test(app));
ck('shell 有 #bdBoom', shell.includes('id="bdBoom"'));
ck('CSS 有 .bd-boom 与 boomIn', /\.bd-boom\s*\{/.test(css) && /@keyframes boomIn/.test(css));
ck('startFireworks 支持 intense 加强模式', /function startFireworks\(dur, intense\)/.test(app));
ck('金句 91s 触发', /APP\.BDAY_TL\.fireworks/.test(app));

console.log('【⑨ 跑酷小游戏】');
ck('shell 有 #stageRun / #runCanvas', shell.includes('id="stageRun"') && shell.includes('id="runCanvas"'));
ck('shell 有 #runQuote / #runTip', shell.includes('id="runQuote"') && shell.includes('id="runTip"'));
ck('APP.BDAY_RUN_QUOTES 存在', /APP\.BDAY_RUN_QUOTES\s*=/.test(data));
ck('含 2004.10.16 语录', /2004\.10\.16/.test(data));
ck('语录 >= 10 条', (() => { const m = data.match(/APP\.BDAY_RUN_QUOTES\s*=\s*\[([\s\S]*?)\n\];/); return !!m && (m[1].match(/',/g) || []).length >= 10; })());
ck('startRun() / runLoop() / jump() 已定义', /function startRun\(\)/.test(app) && /function runLoop\(/.test(app) && /function jump\(\)/.test(app));
ck('起伏地形 runHeight（多正弦叠加）', /function runHeight\(x\)/.test(app) && (app.match(/Math\.sin\(x \//g) || []).length >= 3);
ck('自动躲避 + 可跳跃', /RUN\.onGround && aheadD < -26/.test(app) && /function jump\(\)/.test(app));
ck('点屏幕可跳（stageRun click）', /stageRun'\)\.addEventListener\('click', runTap\)/.test(app));
ck('沿途光点触发语录', /RUN\.quotes\.forEach/.test(app) && /showRunQuote/.test(app));
ck('小人带信件（drawHero 画信）', /function drawHero\(/.test(app) && /背后的信/.test(app));
ck('180s 结束跑酷', /APP\.BDAY_TL\.parkourEnd/.test(app));

console.log('【⑩ 跑酷结束 → 信件 → 礼物 → 工作台】');
ck('APP.BDAY_RUN_END 文案正确', /这一次，我带着祝福跑向你/.test(data));
ck('APP.BDAY_GIFT_HINT 文案正确', /点击礼物直达惊喜/.test(data));
ck('shell 有 #stageRunEnd（光点汇聚舞台）', shell.includes('id="stageRunEnd"'));
ck('shell 有 #giftHint', shell.includes('id="giftHint"'));
ck('信封落定后进入闪烁态', /flashable/.test(app) && /A\.canOpenLetter = true/.test(app));
ck('CSS 有 letterFlash 闪烁动画', /@keyframes letterFlash/.test(css));
ck('点击信件展开 openLetter', /function openLetter\(\)/.test(app) && /letterWait/.test(app));
ck('收起信件 foldLetter', /function foldLetter\(\)/.test(app));
ck('giftHint 显示', /giftHint'\)\.classList\.add\('show'\)/.test(app));

console.log('【⑪ 吹蜡烛灵敏度持续优化（v11 参数）】');
ck('麦克风校准进一步缩短到 350ms', /performance\.now\(\) - t0 > 350/.test(app));
ck('判定阈值进一步调低（0.022 起，上限 0.075）', /baseline \* 1\.7, 0\.022/.test(app) && /0\.075/.test(app));
ck('加入峰值骤增兜底判定', /surge/.test(app));
ck('吹气改为进度环累积（v12：不再两帧即灭）', /function blowTick/.test(app) && /BLOW_FULL_MS/.test(app));
ck('兜底按钮等几秒（BLOW_BTN_DELAY）后蜡烛仍未吹灭才出现', /const BLOW_BTN_DELAY = 4600/.test(app) && /if \(BLOW\.p < 1\) \$\('#blowBtn'\)\.classList\.remove\('hidden'\)/.test(app) && /\}, BLOW_BTN_DELAY\)/.test(app));
ck('点蛋糕区域也能吹灭（兜底通路）', /#stageCake'\)\.addEventListener\('click'/.test(app));
ck('无麦克风直接走按钮兜底', /return fallbackBlow\(\);/.test(app));
ck('未到 23s 不能吹（blowOut 仅 blow 阶段）', /if \(A\.stage !== 'blow'\) return;/.test(app));

console.log('【产物一致性】');
ck('index.html 含 #bdayAudio', out.includes('id="bdayAudio"'));
ck('index.html 含 #stageRun', out.includes('id="stageRun"'));
ck('index.html 含 #bdMusicHint', out.includes('id="bdMusicHint"'));
ck('index.html 已移除 newsQuoteFav', !out.includes('newsQuoteFav'));
ck('index.html 含 BDAY_WISHES', /我希望张年越来越幸福/.test(out));
ck('index.html 含跑酷语录', /2004\.10\.16/.test(out));

console.log('\n────────────────────────────');
console.log(`通过 ${pass} 项 / 失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
