/* ==========================================================================
   _verify_v12.js —— v12 十项改动静态 + 结构校验
   ① 去掉时政金句播放
   ② 时政要点每天轮换、五个一组
   ③ 小人奔跑语录放慢（打字机）
   ④ 进场更暗 + 蜡烛按音乐节拍亮起
   ⑤ 照片轮播要点位置修正
   ⑥ 星空宇宙回忆相册轮播模块
   ⑦ 进入工作台不再放烟花
   ⑧ 吹蜡烛按钮点击不灵敏修复 + 延长吹气
   ⑨ 祝福按批次上抽成烟花
   ⑩ 结尾光点汇聚成那句话 → 重组成信封（去掉邮箱）
   运行：node _src/_verify_v12.js （需 NODE_PATH 指向 jsdom 所在 workspace）
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, '_src', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, '_src', 'styles.css'), 'utf8');
const data = fs.readFileSync(path.join(ROOT, '_src', 'data.js'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, '_src', 'shell.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ck(name, ok) {
  if (ok) { pass++; if (process.env.VERBOSE) console.log('  ✅ ' + name); }
  else { fail++; fails.push(name); console.log('  ❌ ' + name); }
}
function has(hay, needle) { return hay.indexOf(needle) >= 0; }

/* ---------------- ① 去掉时政金句播放 ---------------- */
console.log('【① 去掉时政金句播放】');
ck('HTML 不再有 #newsQuoteSpeak 朗读按钮', !has(shell, 'newsQuoteSpeak') && !has(html, 'newsQuoteSpeak'));
ck('模块不再绑定金句朗读', !/newsQuoteSpeak'\)\.addEventListener/.test(fs.readFileSync(path.join(ROOT, '_src', 'modules.js'), 'utf8')));
ck('金句仍渲染（只是不朗读）', /function renderNewsQuote/.test(fs.readFileSync(path.join(ROOT, '_src', 'modules.js'), 'utf8')));

/* ---------------- ② 时政要点每天轮换、五个一组 ---------------- */
console.log('【② 时政要点每天轮换 · 五个一组】');
const mjs = fs.readFileSync(path.join(ROOT, '_src', 'modules.js'), 'utf8');
ck('APP.NEWS_SEED_PER_DAY = 5', /APP\.NEWS_SEED_PER_DAY\s*=\s*5/.test(data));
ck('NEWS_SEED 扩到 ≥ 25 条', (data.match(/APP\.NEWS_SEED\s*=\s*\[[\s\S]*?\];/) || [''])[0].split(/\{/).length - 1 >= 25);
ck('新增 todayNewsSeed()（按天取一组）', /function todayNewsSeed/.test(mjs));
ck('todayNewsSeed 用 dayIdx() 做轮换', /function todayNewsSeed[\s\S]{0,400}dayIdx\(\)/.test(mjs));
ck('renderNews 使用 todayNewsSeed()', /function renderNews[\s\S]{0,700}todayNewsSeed\(\)/.test(mjs));
ck('标签显示「每天轮换」', has(shell, '每天轮换') || /每天轮换/.test(mjs));
ck('HTML 标题为「今日时政要点」', has(shell, '今日时政要点'));
ck('HTML 含 #newsSeedLabel', has(shell, 'newsSeedLabel'));

/* ---------------- ③ 小人奔跑语录放慢 ---------------- */
console.log('【③ 奔跑语录放慢（打字机）】');
ck('新增 RQ 队列 + 打字机常量', /const RQ = \{ queue: \[\], busy: false, hold: 0 \}/.test(app));
ck('每个字 ≥ 70ms', /RQ_TYPE_MS\s*=\s*([7-9]\d|1\d\d)/.test(app));
ck('停留 ≥ 3s', /RQ_HOLD_MS\s*=\s*(\d{4,})/.test(app) && parseInt((app.match(/RQ_HOLD_MS\s*=\s*(\d+)/) || [0, 0])[1], 10) >= 3000);
ck('showRunQuote 入队而非直接闪', /function showRunQuote\(text\) \{\s*RQ\.queue\.push/.test(app));
ck('.run-quote 有 typing 光标', /\.run-quote\.typing::after/.test(css));
ck('.run-quote 过渡 ≥ .7s', (function () {
  const i = css.indexOf('.run-quote {');
  const m = css.slice(i, i + 700).match(/transition: opacity (\.\d+)s/);
  return !!m && parseFloat(m[1]) >= 0.7;
})());
ck('.run-quote line-height ≥ 1.8', /\.run-quote\s*\{[\s\S]{0,200}line-height:\s*1\.(8|9)/.test(css));

/* ---------------- ④ 进场更暗 + 蜡烛卡音乐节拍 ---------------- */
console.log('【④ 进场更暗 + 蜡烛按音乐节拍亮起】');
ck('.cake 暗到 brightness ≤ .10', /\.cake\s*\{[\s\S]{0,300}brightness\(\.0\d\)/.test(css));
ck('.cake.lit 仍是「微亮」档（≤ .34）', /\.cake\.lit\s*\{[\s\S]{0,200}brightness\(\.30\)/.test(css));
ck('GLOW_KEYS 关键帧存在', /GLOW_KEYS/.test(app));
ck('关键帧覆盖 5→25s', /t:\s*5[,)]/.test(app) && /t:\s*25[,)]/.test(app));
ck('25s 处是「突然大亮」的一跳（br > 1）', /t:\s*25,\s*br:\s*1\.\d/.test(app));
ck('glowAt 用 smoothstep', /p \* p \* \(3 - 2 \* p\)/.test(app));
ck('fadeCakeToFull 依赖 musicTime()', /function fadeCakeToFull[\s\S]{0,900}musicTime\(\)/.test(app));
ck('黑幕过渡不是 linear', /blowReady - APP\.BDAY_TL\.hintFade[\s\S]{0,90}cubic-bezier/.test(app));
ck('#pageA::after 入场遮罩更暗（≥ .8 收尾）', /#pageA::after[\s\S]{0,400}rgba\(2,2,9,\.8\d\)/.test(css));

/* ---------------- ⑤ 照片轮播要点位置修正 ---------------- */
console.log('【⑤ 照片轮播位置：已换成星空相册】');
ck('旧的 #stagePhotos 相关样式已整段移除', !/#stagePhotos/.test(css) && !/\.photo-deck/.test(css) && !/\.photo-item/.test(css));
ck('相册舞台占据照片轮播位（#stageAlbum 在 #stageInput 之前）', shell.indexOf('id="stageAlbum"') < shell.indexOf('id="stageInput"'));

/* ---------------- ⑥ 星空宇宙回忆相册（星球驮着照片迎面飞来） ---------------- */
console.log('【⑥ 星空宇宙回忆相册模块】');
ck('HTML 含 #stageAlbum', has(shell, 'id="stageAlbum"'));
ck('HTML 含 #albumSky 画布', has(shell, 'id="albumSky"'));
ck('HTML 只有一张卡片 (#albumCardB)，不再有 A/C', has(shell, 'id="albumCardB"') && !has(shell, 'id="albumCardA"') && !has(shell, 'id="albumCardC"'));
ck('卡片含 图 + 标题 + 小字备注', /class="ac-img"/.test(shell) && /class="ac-title"/.test(shell) && /class="ac-note"/.test(shell));
ck('HTML 含 #albumNext（手动提示/指示点已按要求移除）', has(shell, 'id="albumNext"') && !has(shell, 'id="albumDots"') && !has(shell, 'id="albumHint"'));
ck('相册数据 APP.BDAY_ALBUM（10 条，含 title+note）', (data.match(/APP\.BDAY_ALBUM\s*=\s*\[/) || []).length === 1 && (data.match(/title:\s*'/g) || []).length >= 10 && (data.match(/note:\s*'/g) || []).length >= 10);
ck('新增 startAlbum / stopAlbum / paintAlbum', /function startAlbum/.test(app) && /function stopAlbum/.test(app) && /function paintAlbum/.test(app));
ck('新增 albumLoop（canvas 星空 + 星球漂移）', /function albumLoop/.test(app));
ck('新增 drawPlanet（带土星环）', /function drawPlanet/.test(app) && /土星环/.test(app));
ck('星球有 ring 参数（大小不同）', /ring:\s*1\.\d/.test(app) && /ring:\s*0/.test(app));
ck('星星分三层（视差）', /const layer = i % 3/.test(app));
ck('驮照片的航行者星球 carriers', /ALB\.carriers\s*=/.test(app) && /航行者星球/.test(app));
ck('新增 flyInAlbum（照片从远处飞来）', /function flyInAlbum/.test(app) && /ALB\.fly\s*=\s*0/.test(app));
ck('新增 albumStep（换下一张 / 上一张）', /function albumStep/.test(app));
ck('全自动轮播：不再有拖拽/滑动/点击/键盘换页', !/albumDragStart/.test(app) && !/albumDragMove/.test(app) && !/albumDragEnd/.test(app) && !/ArrowRight'\) albumStep/.test(app));
ck('全自动轮播：dwellAt 到点自己换下一张', /function nextDwellMs/.test(app) && /now - ALB\.dwellAt > ALB\.dwellMs/.test(app) && /albumStep\(1\)/.test(app));
ck('飞入进度驱动卡片位姿（layoutAlbumCard(panel, e)）', /function layoutAlbumCard\(panel, e\)/.test(app));
ck('景深：translate3d Z + scale + rotateY + blur', /translate3d\([\s\S]{0,220}rotateY\([\s\S]{0,220}blur\(/.test(app));
ck('到位后加 .settled（光晕亮起）', /classList\.toggle\('settled'/.test(app) && /\.album-card\.settled \.ac-glow/.test(css));
ck('相册开场引导语配置', /APP\.BDAY_ALBUM_INTRO/.test(data));
ck('CSS：#stageAlbum 深空底色', /#stageAlbum\s*\{[\s\S]{0,300}radial-gradient/.test(css));
ck('CSS：卡片半透明玻璃质感（backdrop-filter）', /\.album-card\s*\{[\s\S]{0,700}backdrop-filter:\s*blur/.test(css));
ck('CSS：卡片由 JS 每帧驱动（will-change）', /\.album-card\s*\{[\s\S]{0,700}will-change:\s*transform/.test(css));
ck('CSS：#albumNext 滑到最后才出现', /\.album-next\.show/.test(css));
ck('相册位置：照片轮播位（吹灭蜡烛之后、输入框之前）', (function () {
  const b = shell.indexOf('id="stageAlbum"');
  const c = shell.indexOf('id="stageInput"');
  return b > 0 && c > b;
})());
ck('foldLetter 直接进入礼物（相册已前置）', /function foldLetter[\s\S]{0,400}A\.stage = 'gift'/.test(app));
ck('albumToGift 进入礼物', /function albumToGift[\s\S]{0,400}A\.stage = 'gift'/.test(app));
ck('resetSurprise 会 stopAlbum()', /stopAlbum\(\);/.test(app));

/* ---------------- ⑦ 进工作台不再放烟花 ---------------- */
console.log('【⑦ 进工作台不再放烟花】');
ck('app 无 enterFireworks', !/enterFireworks/.test(app));
ck('HTML 无 #enterFw', !has(shell, 'enterFw') && !has(html, 'enterFw'));
ck('CSS 无 .enter-fw / enterBurst', !/\.enter-fw/.test(css) && !/enterBurst/.test(css));
ck('showWorkbench 调用 stopFireworks()', /function showWorkbench[\s\S]{0,600}stopFireworks\(\)/.test(app));

/* ---------------- ⑧ 吹蜡烛按钮不灵敏修复 + 延长吹气 ---------------- */
console.log('【⑧ 吹蜡烛按钮 + 延长吹气】');
ck('新增吹气进度状态 BLOW', /const BLOW = \{ p: 0, last: 0, raf: 0 \}/.test(app));
ck('吹满时长 ≥ 2s（不是一瞬间）', parseInt((app.match(/BLOW_FULL_MS\s*=\s*(\d+)/) || [0, 0])[1], 10) >= 2000);
ck('新增 blowTick / blowBegin / blowReset', /function blowTick/.test(app) && /function blowBegin/.test(app) && /function blowReset/.test(app));
ck('麦克风改为喂进度 feedBlow()（不再两帧即吹灭）', /function feedBlow/.test(app) && !/return blowOut\(\);\s*\}\s*else above/.test(app));
ck('按钮改为 pointerdown 按住', /blowBtn\.addEventListener\('pointerdown', pressBlow\)/.test(app));
ck('按钮支持按住 + 松开', /pressBlow/.test(app) && /releaseBlow/.test(app));
ck('window mouseup 兜底释放', /window\.addEventListener\('mouseup', releaseBlow\)/.test(app));
ck('点蛋糕区域累加 42% 进度', /BLOW\.p = Math\.min\(1, BLOW\.p \+ 0\.42\)/.test(app));
ck('不再有独立进度环 #blowRing', !has(shell, 'id="blowRing"') && !/blowRing/.test(app) && !/\.hold-ring/.test(css));
ck('吹气进度直接驱动麦克风进度条 #micFill', /blowTick[\s\S]{0,1400}\$\('#micFill'\)[\s\S]{0,120}style\.width/.test(app));
ck('.mic-bar > i 有过渡与辉光', /\.mic-bar\s*>\s*i\s*\{[\s\S]{0,400}transition:\s*width/.test(css));
ck('.blow-btn 热区扩到 22px', /\.blow-btn::before\s*\{[\s\S]{0,120}inset:\s*-22px/.test(css));
ck('.blow-btn.hidden 真正 display:none', /\.blow-btn\.hidden\s*\{[\s\S]{0,80}display:\s*none/.test(css));
ck('#stageCake z-index 不高于按钮', /#stageCake\s*\{[^}]*z-index:\s*12/.test(css));
ck('按钮文案改为「按住不放」', has(shell, '按住不放'));
ck('blowOut 会 blowReset()', /function blowOut[\s\S]{0,300}blowReset\(\)/.test(app));

/* ---------------- ⑨ 祝福按批次上抽 + 铺满屏幕 ---------------- */
console.log('【⑨ 祝福按批次往上抽】');
ck('新增 pullWishesAway()', /function pullWishesAway/.test(app));
ck('分 12 批抽走（groups）', /const groups = 12/.test(app));
ck('每片错开延迟（110ms 批间隔）', /g \* 110 \+ k \* 55/.test(app));
ck('CSS 用 chipAway 关键帧（横向漂移 + 抽离）', /@keyframes chipAway/.test(css) && /var\(--pl/.test(css));
ck('.wish-field.pulling 触发动画', /\.wish-field\.pulling \.wish-chip/.test(css));
ck('铺满后停止追加（full 判定）', /let n = 0, full = false/.test(app) && /if \(full\) return;/.test(app));
ck('上限提到 ≥ 600（真的塞满屏幕）', parseInt((app.match(/if \(n > (\d+) \|\|/) || [0, 0])[1], 10) >= 600);
ck('用格子铺满（perm + cols/rows）', /const perm = shuffleIdx\(cols \* rows\)/.test(app) && /const cols = 5, rows = 9/.test(app));
ck('短句更快追加（gap 下限 ≤ 20ms）', /Math\.max\(18, 120 - n \* 2\.2\)/.test(app));
ck('isFull() 用 getBoundingClientRect 估算覆盖率', /isFull = \(\) => \{[\s\S]{0,400}getBoundingClientRect/.test(app));
ck('不再有空回调 setTimeout(null)', !/setTimeout\(full \? null/.test(app));

/* ---------------- ⑩ 光点汇聚 → 那句话 → 真信封（不再有第二个信封） ---------------- */
console.log('【⑩ 光点汇聚 → 那句话 → 真信封】');
ck('HTML 含 #convergeCanvas', has(shell, 'id="convergeCanvas"'));
ck('HTML 含清晰文字层 #convergeLine', has(shell, 'id="convergeLine"'));
ck('HTML 无 #runEndText / #bdMailFlash', !has(shell, 'runEndText') && !has(shell, 'bdMailFlash'));
ck('app 无 drawMailbox / 邮箱', !/drawMailbox/.test(app) && !/投信口/.test(app));
ck('APP.BDAY_CONVERGE 节奏配置（fly/hold/dissolve/reform/seal）', /APP\.BDAY_CONVERGE/.test(data) && /flyMs/.test(data) && /dissolveMs/.test(data) && /reformMs/.test(data) && /sealMs/.test(data));
ck('新增 startConverge / convergeLoop', /function startConverge/.test(app) && /function convergeLoop/.test(app));
ck('sampleTextPoints 用 getImageData 取字形点', /function sampleTextPoints/.test(app) && /getImageData/.test(app));
ck('信封由光点重新组成（sampleEnvelopePoints + targetsEnv）', /function sampleEnvelopePoints/.test(app) && /CV\.targetsEnv/.test(app));
ck('四阶段 fly → hold → dissolve → reform → done', /CV\.phase = 'hold'/.test(app) && /CV\.phase = 'dissolve'/.test(app) && /CV\.phase = 'reform'/.test(app) && /CV\.phase = 'done'/.test(app));
ck('粒子螺旋汇聚（swirl / sw 参数）', /swirl/.test(app) && /sw:\s*\(Math\.random\(\) < 0\.5/.test(app));
ck('到位的光点带柔光边（inPlace > 0.72）', /if \(inPlace > 0\.72\)/.test(app));
ck('dissolve 阶段字的光点四散', /① 消散/.test(app) && /p\.ex/.test(app) && /p\.ey/.test(app));
ck('reform 阶段光点重新聚成信封', /② 重新组成信封/.test(app) && /te\[i % te\.length\]/.test(app));
ck('重新测量信封真实位置（measureEnvelope + envMeasured）', /function measureEnvelope/.test(app) && /envMeasured/.test(app));
ck('CSS：#stageLetter.converged 接棒辉光', /#stageLetter\.converged/.test(css) && /@keyframes convergeFade/.test(css));
ck('onConvergeDone 亮出光点信封热区（不再有实体信封）', /function onConvergeDone/.test(app) && /hot\.hidden = false/.test(app) && !/classList\.add\('born'\)/.test(app));
ck('onConvergeDone 仍衔接箭头（envArrow）', /\$\('#envArrow'\); if \(ar\) ar\.classList\.add\('show'\)/.test(app));
ck('stopConverge 清理（含 born / convergeLine）', /function stopConverge/.test(app) && /classList\.remove\('born'\)/.test(app));
ck('RUN 不再有 mailX 缩放（heroScale ≤ .38 增量）', /RUN\.heroScale = 1 \+ \(1 - k\) \* 0\.38/.test(app));
ck('新增 RUN.arrivalX', /RUN\.arrivalX = RUN\.total/.test(app));
ck('#stageRun.fade-out 过渡样式', /#stageRun\.fade-out/.test(css));
ck('#convergeCanvas 不挡点击', /#convergeCanvas[\s\S]{0,200}pointer-events:\s*none/.test(css));
ck('CSS：.converge-line 淡入（.show）', /\.converge-line\.show/.test(css));
ck('CSS：.letter.born + envBorn 关键帧', /\.letter\.born\s*\{[\s\S]{0,120}envBorn/.test(css) && /@keyframes envBorn/.test(css));
ck('信封内衬 .env-lining', /\.env-lining/.test(css));
ck('信封口袋 .env-pocket', /\.env-pocket/.test(css));
ck('信封流光 .env-shine + envShine 动画', /\.env-shine/.test(css) && /@keyframes envShine/.test(css));
ck('封蜡为立体红蜡 + 金圈', /radial-gradient\(circle at 34% 28%/.test(css) && /rgba\(226, 196, 130, \.78\)/.test(css));
ck('信封有烫金描边', /rgba\(196, 164, 106, \.62\)/.test(css));
ck('HTML 已删实体信封（无 env-face / env-lining / env-seal 标记）', !/class="env-face"/.test(shell) && !/class="env-lining"/.test(shell) && !/class="env-seal"/.test(shell));
ck('新增光点信封热区 envHot + 指引箭头 envArrow', /id="envHot"/.test(shell) && /id="envArrow"/.test(shell));
ck('fillLetter 铺信纸内容', /function fillLetter/.test(app));
ck('envelope-line 改为 .show 控制', /\.envelope-line\.show/.test(css));

/* ---------------- 产物 / 缓存 ---------------- */
console.log('【产物一致性 / 缓存版本】');
ck('index.html 体积合理（< 400KB）', Buffer.byteLength(html, 'utf8') < 400 * 1024);
ck('index.html 含 #stageAlbum', has(html, 'id="stageAlbum"'));
ck('index.html 含 #convergeCanvas', has(html, 'id="convergeCanvas"'));
ck('index.html 不含 #enterFw', !has(html, 'id="enterFw"'));
ck('sw.js 缓存已升到 v18（v12 之后强制刷新）', /morandi-life-v18/.test(sw));
ck('sw.js 仍缓存生日音乐', /bday-music\.mp3/.test(sw));

console.log('\n────────────────────────────');
console.log(`通过 ${pass} 项 / 失败 ${fail} 项`);
if (fails.length) { console.log('失败项：'); fails.forEach((f) => console.log('  · ' + f)); }
process.exit(fail ? 1 : 0);
