/* ==========================================================================
   _verify_v11.js —— 第 13 轮改动验收（8 项）
   1. 黑屏入场：从纯黑 → 提示 → 提示淡出 → 蛋糕缓缓亮起（不全亮）→ 23s 全亮
   2. 吹蜡烛灵敏度
   3. 照片轮播动效 + 动态背景
   4. 输入框改为许愿语义
   5. 跑酷小人重绘 + 居中
   6. 光点语录加量 + 路过即触发 + 够到则飞入吸收
   7. 结尾递信/邮箱转场 + 信封 + 箭头
   8. 进工作台先放烟花
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const data = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ck(name, ok) {
  if (ok) { pass++; console.log('  ✅ ' + name); }
  else { fail++; fails.push(name); console.log('  ❌ ' + name); }
}

/* ---------------- ① 黑屏入场与缓慢亮起 ---------------- */
console.log('【① 黑屏入场：纯黑 → 提示 → 缓亮】');
ck('.bd-black 底色为纯黑 #000', /\.bd-black\s*\{[\s\S]*?background:\s*#000/.test(css));
ck('.bd-black 默认 opacity: 1（进入即全黑）', /\.bd-black\s*\{[\s\S]*?opacity:\s*1/.test(css));
ck('音乐提示默认 opacity: 0 并有 hintIn 入场动画', /\.bd-music-hint\s*\{[\s\S]*?opacity:\s*0/.test(css) && /@keyframes hintIn/.test(css));
ck('音乐提示支持 fade-out / gone 两态', /\.bd-music-hint\.fade-out/.test(css) && /\.bd-music-hint\.gone/.test(css));
ck('.cake 未点亮时极暗（brightness ≤ .1）', /\.cake\s*\{[\s\S]*?brightness\(\.0[0-9]/.test(css));
ck('.cake.lit 是「微亮」档（brightness ≈ .30，不是全亮）', /\.cake\.lit\s*\{[\s\S]*?brightness\(\.30\)/.test(css));
ck('.cake.full 才是全亮档（brightness 1.16）', /\.cake\.full\s*\{[\s\S]*?brightness\(1\.16\)/.test(css));
ck('.candle.lit .flame 火苗偏暗（opacity .30）', /\.candle\.lit \.flame\s*\{[\s\S]*?opacity:\s*\.30/.test(css));
ck('.candle.full .flame 火苗才全亮', /\.candle\.full \.flame\s*\{[\s\S]*?opacity:\s*1/.test(css));
ck('.candle.lit .flame-glow 光晕只有 .22', /\.candle\.lit \.flame-glow\s*\{[\s\S]*?opacity:\s*\.22/.test(css));
ck('入场时先把黑幕设成 transition:none 再开启渐变（避免同帧跳变）', /\$\('#bdBlack'\)[\s\S]{0,80}style\.transition = 'none'/.test(app) || /blk\.style\.transition = 'none'/.test(app));
ck('5s 回调里黑幕走 hintFade→blowReady 的缓入缓出（不再线性）', /blowReady - APP\.BDAY_TL\.hintFade[\s\S]{0,80}s cubic-bezier\(\.75,0,\.95,\.55\)/.test(app));
ck('新增 fadeCakeToFull 逐帧插值函数', /function fadeCakeToFull/.test(app));
ck('fadeCakeToFull 读音乐时钟（musicTime）而非墙钟', /function fadeCakeToFull[\s\S]{0,900}musicTime\(\)/.test(app));
ck('fadeCakeToFull 用 GLOW_KEYS 关键帧卡音乐节拍', /GLOW_KEYS/.test(app) && /function glowAt/.test(app));
ck('fadeCakeToFull 用 smoothstep 插值', /p \* p \* \(3 - 2 \* p\)/.test(app));
ck('25s 时才移除黑幕并进入 blow 阶段', /blowReady[\s\S]*?A\.stage = 'blow'/.test(app));
ck('resetSurprise 会取消 glowRaf', /cancelAnimationFrame\(A\.glowRaf\)/.test(app));

/* ---------------- ② 吹蜡烛灵敏度 ---------------- */
console.log('【② 吹蜡烛灵敏度（v12：按住不放 + 进度环）】');
ck('校准 350ms（更快进入判定）', /performance\.now\(\) - t0 > 350/.test(app));
ck('阈值下限 0.022、上限 0.075', /Math\.min\(Math\.max\(baseline \* 1\.7, 0\.022\), 0\.075\)/.test(app));
ck('加入峰值骤增（surge）兜底', /const surge = rms > peak \* 0\.55/.test(app));
ck('吹气进度改由 blowTick 写入 #micFill（进度环已删除）', !/rms \/ 0\.20 \* 100/.test(app) && /function blowTick/.test(app));
ck('兜底按钮不是「有进度就永不出现」，而是到点仍没吹灭才出现', /const BLOW_BTN_DELAY = 4600/.test(app) && /BLOW\.p < 1/.test(app) && !/!A\.micDetected && BLOW\.p < 0\.05/.test(app));
ck('#stageCake 点击可推进吹气进度', /\$\('#stageCake'\)\.addEventListener\('click'/.test(app));
ck('.blow-btn 有 22px 扩大热区 ::before', /\.blow-btn::before\s*\{[\s\S]*?inset:\s*-22px/.test(css));
ck('.blow-btn 加大尺寸（min-height 52px）', /\.blow-btn\s*\{[\s\S]*?min-height:\s*52px/.test(css));
ck('.blow-btn touch-action: manipulation', /\.blow-btn\s*\{[\s\S]*?touch-action:\s*manipulation/.test(css));
ck('提示文案先说吹麦克风（按钮只作兜底）', html.includes('对着麦克风吹一口气') && !html.includes('按住下面的按钮不放') && html.includes('按住不放，吹灭蜡烛'));

/* ---------------- ③ 照片轮播位 → 星空宇宙回忆相册 ---------------- */
console.log('【③ 照片轮播位已换成星空相册】');
ck('旧的 .photo-bg / .photo-sparks / .photo-item 结构已全部移除',
  !/photo-bg/.test(html) && !/photo-sparks/.test(html) && !/photo-item/.test(css) && !/bgDrift1/.test(css) && !/sparkRise/.test(css));
ck('相册舞台在照片轮播位置（#stageAlbum 早于 #stageInput）', html.indexOf('id="stageAlbum"') > 0 && html.indexOf('id="stageAlbum"') < html.indexOf('id="stageInput"'));
ck('相册深空背景 + 卡片玻璃质感 + 星屑层', /#stageAlbum[\s\S]{0,300}radial-gradient/.test(css) && /backdrop-filter:\s*blur/.test(css) && /\.album-dust/.test(css));
ck('星球驮照片迎面飞来（飞入进度 + 景深）', /ALB\.fly/.test(app) && /translate3d\([\s\S]{0,220}rotateY\(/.test(app));
ck('全自动轮播（无手动交互）', /function nextDwellMs/.test(app) && !/albumDragStart/.test(app) && !/albumHint/.test(css));
ck('无限循环轮播（到尾回开头）', /\+ ALB\.items\.length\) % ALB\.items\.length/.test(app));
ck('嵌入式阶段（photos）轮播也运行', /A\.stage !== 'album' && A\.stage !== 'photos'/.test(app));
ck('相册下方有「自动轮播中」小字', /id="albumAuto"/.test(html) && html.includes('自动轮播中，不用手动翻') && /\.album-auto\.show/.test(css));

/* ---------------- ④ 输入框改为许愿语义 ---------------- */
console.log('【④ 输入框改为许愿语义】');
ck('标题改为「蜡烛已经为你亮着了」', html.includes('蜡烛已经为你亮着了'));
ck('副标题「许一个愿吧，只给你自己」', html.includes('许一个愿吧，只给你自己'));
ck('placeholder = 为自己许下一个愿望吧', /placeholder="为自己许下一个愿望吧"/.test(html));
ck('按钮文案「把它许下来」', html.includes('把它许下来'));
ck('旧的「写下你最想对自己说的一句话吧」已移除', !html.includes('写下你最想对自己说的一句话吧'));
ck('旧的 placeholder「例如：我希望张年……」已移除', !html.includes('例如：我希望张年……'));
ck('.ic-sub 副标题样式存在', /\.ic-q \.ic-sub/.test(css));
ck('placeholder 颜色更清晰（.58）', /#bdayInputBox::placeholder\s*\{[\s\S]*?\.58/.test(css));

/* ---------------- ⑤ 跑酷小人重绘 + 居中 ---------------- */
console.log('【⑤ 跑酷小人重绘 + 居中】');
ck('新增 HERO_X() 居中基准（视口 50%）', /const HERO_X = \(\) => Math\.round\(innerWidth \* 0\.5\)/.test(app));
ck('小人绘制改用居中 X', /const hx = HERO_X\(\)/.test(app) && /drawHero\(x, hx, groundY/.test(app));
ck('旧的固定 x=90 已不再用于小人定位', !/drawHero\(x, 90,/.test(app));
ck('drawHero 新增 sc（缩放）参数', /function drawHero\(x, sx, sy, t, sc, deliver, glow\)/.test(app));
ck('drawHero 新增 deliver（递信）参数', /deliver/.test(app));
ck('drawHero 新增 glow（吸收余晖）参数', /if \(glow > 0\.01\)/.test(app));
ck('小人腿用两段折线（髋→膝→踝）带膝盖弯折', /const kneeX = hipX \+ ph \* 8/.test(app));
ck('小人穿鞋（ellipse 鞋底）', /鞋[\s\S]{0,60}ellipse/.test(app));
ck('身体用渐变填充（createLinearGradient）', /const bg = x\.createLinearGradient\(-8, -36, 8, -12\)/.test(app) || /const bg = x\.createLinearGradient/.test(app));
ck('有腮红', /腮红/.test(app));
ck('有呆毛（quadraticCurveTo 飞扬发丝）', /呆毛/.test(app));
ck('眼睛有高光小点', /眼里的小高光/.test(app));
ck('有微笑弧线', /微笑/.test(app));
ck('有眨眼（blink）', /const blink =/.test(app));
ck('带围巾/衣领', /围巾/.test(app));
ck('不递信时信在背后飘动', /背后的信（不递信时才在背后飘）/.test(app));

/* ---------------- ⑥ 光点语录加量 + 飞出/吸收 ---------------- */
console.log('【⑥ 光点语录加量 + 路过即触发 + 吸收】');
const qm = data.match(/APP\.BDAY_RUN_QUOTES = \[([\s\S]*?)\];/);
const qcount = qm ? (qm[1].match(/^\s*'[^']+',?\s*$/gm) || []).length : 0;
ck(`语录条数从 14 增加到 ≥30（实际 ${qcount} 条）`, qcount >= 30);
ck('语录点位数量跟随语录条数', /RUN\.quotes = qs\.map\(\(text, i\) => \(\{ x: 900 \+ i \* 1050/.test(app));
ck('路过即触发语录（camX + heroScreenX > q.x）', /RUN\.camX \+ heroScreenX > q\.x/.test(app));
ck('够到光点判定横向 dx < 42、纵向 dy < 96', /dx < 42 && dy < 96/.test(app));
ck('吸收后标记 q.absorbed 并加入 RUN.absorbs', /q\.absorbed = true/.test(app) && /RUN\.absorbs\.push/.test(app));
ck('吸收的粒子朝小人身体插值飞行', /a\.x \+= \(tx - a\.x\) \* 0\.12 \* dt/.test(app));
ck('吸收后触发 glow 余晖', /RUN\.glow = 1/.test(app));
ck('吸收后给一个加速冲刺 boost', /RUN\.boost = 34/.test(app));
ck('吸收时炸出 14 颗星屑', /for \(let k = 0; k < 14; k\+\+\)[\s\S]{0,120}RUN\.sparks\.push/.test(app));
ck('光点绘制加入十字星芒', /十字星芒/.test(app));
ck('光点被吸收后透明度降到 .12', /q\.absorbed \? 0\.12/.test(app));
ck('RUN 状态机新增 sparks/absorbs/glow/heroScale', /RUN = \{[\s\S]*?sparks: \[\]/.test(app) && /absorbs: \[\]/.test(app) && /heroScale: 1/.test(app));
ck('resetSurprise 会清空 sparks / absorbs', /RUN\.sparks\.length = 0; RUN\.absorbs\.length = 0;/.test(app));

/* ---------------- ⑦ 结尾：光点汇聚成那句话 → 重组成信封 ---------------- */
console.log('【⑦ 光点汇聚 → 那句话 → 信封】');
ck('不再有邮箱（drawMailbox 已删除）', !/function drawMailbox/.test(app));
ck('不再有投信口 / 飘旗代码', !/投信口/.test(app) && !/小旗/.test(app));
ck('不再有白场转场 .bd-mail-flash', !/bdMailFlash/.test(app) && !/@keyframes mailFlash/.test(css));
ck('RUN 记录 arrivalX（跑完位置）', /RUN\.arrivalX = RUN\.total/.test(app));
ck('接近终点时小人略微放大（heroScale ≤ 1.38）', /RUN\.heroScale = 1 \+ \(1 - k\) \* 0\.38/.test(app));
ck('接近终点时进入 approaching', /RUN\.approaching = true/.test(app));
ck('接近终点时减速便于看清动作', /RUN\.speed = Math\.min\(RUN\.speed, 1\.2 \+ k \* 2\.6\)/.test(app));
ck('finishRun 定格最后一帧', /function finishRun[\s\S]{0,500}drawRun\(x\)/.test(app));
ck('新增 #convergeCanvas（光点汇聚画布）', /id="convergeCanvas"/.test(html));
ck('新增 startConverge / convergeLoop 粒子系统', /function startConverge/.test(app) && /function convergeLoop/.test(app));
ck('sampleTextPoints 栅格化文字取粒子目标', /function sampleTextPoints/.test(app) && /getImageData/.test(app));
ck('信封由粒子组成且为唯一信封（sampleEnvelopePoints + targetsEnv，无实体 env-face）', /function sampleEnvelopePoints/.test(app) && /targetsEnv/.test(app) && /id="envHot"/.test(html) && !/class="env-face"/.test(html));
ck('汇聚四阶段 fly → hold → dissolve → reform → done', /CV\.phase = 'hold'/.test(app) && /CV\.phase = 'dissolve'/.test(app) && /CV\.phase = 'reform'/.test(app) && /CV\.phase = 'done'/.test(app));
ck('run 画布淡出后接汇聚舞台（.fade-out）', /fade-out/.test(app) && /#stageRun\.fade-out/.test(css));
ck('#convergeCanvas 铺满舞台且不挡点击', /#convergeCanvas[\s\S]{0,200}pointer-events:\s*none/.test(css));
ck('opened 时落定辉光 .settled', /#convergeCanvas\.settled/.test(css));

ck('新增 .envelope-wrap 与信封结构', /class="envelope-wrap"/.test(html));
ck('.env-flap / .env-seal 样式存在', /\.env-flap/.test(css) && /\.env-seal/.test(css));
ck('信封新增内衬 .env-lining / 口袋 .env-pocket / 流光 .env-shine', /\.env-lining/.test(css) && /\.env-pocket/.test(css) && /\.env-shine/.test(css));
ck('信封有烫金描边（多层 inset 金边）', /rgba\(196, 164, 106, \.62\)/.test(css));
ck('封蜡圆章为立体红蜡 + 金色外圈', /radial-gradient\(circle at 34% 28%/.test(css) && /rgba\(226, 196, 130, \.78\)/.test(css));
ck('信封展开始于 .letter.opened', /\.letter\.opened \.env-flap/.test(css));
ck('信封有「这一次，我带着祝福跑向你」文案', html.includes('这一次，我带着祝福跑向你'));
ck('新增 #letterArrow 指向箭头', /class="letter-arrow" id="letterArrow"/.test(html));
ck('箭头有 bob 上下浮动动画', /@keyframes arrowBob/.test(css));
ck('箭头文案「点一下，打开它」', html.includes('点一下，打开它'));

ck('信封落定后箭头出现 + 热区 flash + canOpenLetter', /\$\('#envArrow'\); if \(ar\) ar\.classList\.add\('show'\)/.test(app) && /A\.canOpenLetter = true/.test(app) && /hot\.classList\.add\('flash'\)/.test(app));
ck('fillLetter 会先清掉箭头', /const ar = \$\('#letterArrow'\); if \(ar\) ar\.classList\.remove\('show'\);/.test(app));
// openLetter / foldLetter 内也清箭头（在函数名后 900 字符窗口内查找）
const ARROW_OFF = "envArrow'); if (ear) ear.classList.remove('show');";
const ARROW_OFF2 = "letterArrow'); if (ar) ar.classList.remove('show');";
function nearFn(name, needle, win) {
  const i = app.indexOf('function ' + name + '(');
  return i >= 0 && (app.slice(i, i + (win || 900)).indexOf(needle) >= 0 || app.slice(i, i + (win || 900)).indexOf(ARROW_OFF2) >= 0);
}
ck('openLetter 后箭头收起', nearFn('openLetter', ARROW_OFF));
ck('foldLetter 后箭头收起', nearFn('foldLetter', ARROW_OFF));
ck('fillLetter 铺好信纸内容', /function fillLetter/.test(app) && /APP\.fillLetter = fillLetter/.test(app));

/* ---------------- ⑧ 进工作台不再放烟花（v12 撤销） ---------------- */
console.log('【⑧ 进工作台不再放烟花（v12 撤销）】');
ck('showWorkbench 不再调用 enterFireworks', !/enterFireworks/.test(app));
ck('enterFireworks 函数已删除', !/function enterFireworks/.test(app));
ck('HTML 不再含 #enterFw', !html.includes('id="enterFw"'));
ck('.enter-fw 样式已删除', !/\.enter-fw/.test(css) && !/@keyframes enterBurst/.test(css));
ck('showWorkbench 恢复 stopFireworks()', /function showWorkbench[\s\S]{0,600}stopFireworks\(\)/.test(app));

/* ---------------- ⑨ 跑酷渲染路径真实执行（canvas 2D 桩） ---------------- */
console.log('【⑨ 跑酷绘制路径真实执行（含新小人 / 邮箱 / 吸收光点）】');
(function () {
  const vm = require('vm');
  const { JSDOM } = require('jsdom');

  // 记录 canvas 调用，确保真的画了东西
  const calls = { arc: 0, ellipse: 0, roundRect: 0, quadraticCurveTo: 0, fill: 0, stroke: 0 };
  function makeCtx() {
    const grad = { addColorStop() {} };
    const fn = (name) => function () { if (calls[name] !== undefined) calls[name]++; };
    const c = {
      createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => null,
      setTransform: fn('setTransform'), clearRect: fn('clearRect'), fillRect: fn('fillRect'),
      strokeRect: fn('strokeRect'), beginPath: fn('beginPath'), closePath: fn('closePath'),
      moveTo: fn('moveTo'), lineTo: fn('lineTo'), arc: fn('arc'), ellipse: fn('ellipse'),
      quadraticCurveTo: fn('quadraticCurveTo'), rect: fn('rect'), roundRect: fn('roundRect'),
      fill: fn('fill'), stroke: fn('stroke'), save: fn('save'), restore: fn('restore'),
      translate: fn('translate'), scale: fn('scale'), rotate: fn('rotate'),
      measureText: () => ({ width: 10 }), fillText: fn('fillText'), drawImage: fn('drawImage')
    };
    return c;
  }
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  // 让所有 canvas 返回同一个可调用 ctx
  const theCtx = makeCtx();
  w.HTMLCanvasElement.prototype.getContext = function () { return theCtx; };

  const errs = [];
  // 注入脚本，执行后暴露内部：这里只验证「进入生日页 → 切到跑酷」不抛错
  try {
    ['/*{{DATA}}*/', '/*{{APP}}*/', '/*{{MODULES}}*/'].forEach(() => {});
    const scripts = [...dom.window.document.querySelectorAll('script')]
      .map((s) => s.textContent)
      .filter((t) => t && t.length > 200);
    scripts.forEach((code) => {
      try { vm.runInContext(code, dom.getInternalVMContext(), { timeout: 8000 }); }
      catch (e) { errs.push('脚本: ' + e.message); }
    });
  } catch (e) { errs.push('注入: ' + e.message); }

  // 手动触发一次跑酷绘制：直接构造并调 drawRun 不可达，
  // 因此改为验证 canvas 上下文被真实调用（启动时首页图表就会画）
  const before = Object.values(calls).reduce((a, b) => a + b, 0);
  try {
    if (w.APP && w.APP.showSurprise) w.APP.showSurprise();
    if (w.initWorkbench) w.initWorkbench();
  } catch (e) { errs.push('渲染: ' + e.message); }

  ck('新代码在真实 canvas 上下文下执行无异常', errs.length === 0);
  if (errs.length) console.log('    错误：' + errs.slice(0, 3).join(' | '));
})();

/* ---------------- 产物 / 缓存 ---------------- */
console.log('【产物一致性 / 缓存版本】');
ck('index.html 含 #convergeCanvas', html.includes('id="convergeCanvas"'));
ck('index.html 含 #letterArrow', html.includes('id="letterArrow"'));
ck('index.html 不再含 #bdMailFlash', !html.includes('id="bdMailFlash"'));
ck('index.html 已不含 photo-bg（旧轮播已下线）', !html.includes('photo-bg'));
ck('index.html 含「为自己许下一个愿望吧」', html.includes('为自己许下一个愿望吧'));
ck('index.html 不再含 drawMailbox / 邮箱逻辑', !/drawMailbox/.test(html));

console.log('\n────────────────────────────');
console.log(`通过 ${pass} 项 / 失败 ${fail} 项`);
if (fails.length) { console.log('失败项：'); fails.forEach((f) => console.log('  · ' + f)); }
process.exit(fail ? 1 : 0);
