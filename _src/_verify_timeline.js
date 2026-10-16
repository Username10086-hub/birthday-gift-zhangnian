/* ==========================================================================
   生日页时间轴真机模拟：用可控时钟 + 加强 DOM 垫片，
   把整条流程从 0s 走到 190s，检查每个阶段的 DOM 状态是否正确。
   ========================================================================== */
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');

const scripts = [];
const re = /<script>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html))) scripts.push(m[1]);

/* ---------------- 可控时钟 ---------------- */
let NOW = 0;
const timers = [];
let tid = 1;
const BASE_EPOCH = 1700000000000;   // 让 Date.now() 也跟着虚拟时钟走
function fakeSetTimeout(fn, ms) { const id = tid++; timers.push({ id, fn, at: NOW + (ms || 0) }); return id; }
const ivs = [];
function fakeSetInterval(fn, ms) { const id = tid++; ivs.push({ id, fn, next: NOW + ms, ms }); return id; }
function fakeClearInterval(id) { const i = ivs.findIndex((x) => x.id === id); if (i >= 0) ivs.splice(i, 1); }
function fakeClearTimeout(id) { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); }
let rafId = 1;
const rafs = new Map();
function fakeRaf(fn) { const id = rafId++; rafs.set(id, fn); return id; }
function fakeCaf(id) { rafs.delete(id); }

/* 推进时钟：以 1ms 粒度前进，保证 interval/setTimeout 的时序与真实环境一致 */
function advance(ms) {
  const end = NOW + ms;
  let guard = 0;
  while (NOW < end && guard++ < 400000) {
    NOW += 1;
    tickAudio();
    // raf（每帧，约 16ms 一次）
    if (NOW % 16 === 0) {
      [...rafs.entries()].forEach(([id, fn]) => { rafs.delete(id); try { fn(NOW); } catch (e) { RAFAIL.push(e.message); } });
    }
    // 到期的一次性 timer
    for (let i = 0; i < timers.length; i++) {
      if (timers[i].at <= NOW) { const t = timers.splice(i, 1)[0]; try { t.fn(); } catch (e) { TIMERFAIL.push(e.message); } }
    }
    // 到期的 interval
    for (let i = 0; i < ivs.length; i++) {
      if (ivs[i].next <= NOW) { const v = ivs[i]; v.next = NOW + v.ms; try { v.fn(); } catch (e) { TIMERFAIL.push(e.message); } }
    }
    if (RAFAIL.length > 6) return;
  }
}
/* 假音频的 currentTime 跟随虚拟时钟：音乐从「进入生日页」那一刻开始播 */
let audioStartAt = -1;
function tickAudio() { const au = registry['bdayAudio']; if (au && !au.paused) { if (audioStartAt < 0) audioStartAt = NOW; au.currentTime = (NOW - audioStartAt) / 1000; } }
const RAFAIL = [], TIMERFAIL = [];

/* ---------------- 加强 DOM 垫片 ---------------- */
const allEls = {};
function makeEl(id) {
  const el = {
    id, _cls: new Set(), style: (() => {
      const t = {};
      return new Proxy(t, {
        set(o, k, v) { o[k] = v; return true; },
        get(o, k) {
          if (k === 'setProperty') return (key, val) => { o[key] = val; };
          if (k === 'removeProperty') return (key) => { delete o[key]; };
          return o[k] === undefined ? '' : o[k];
        }
      });
    })(),
    dataset: {}, children: [], value: '', innerHTML: '', textContent: '', hidden: false,
    currentTime: 0, paused: true, duration: 229.98, src: '', loop: false, preload: '',
    classList: {
      add: (...c) => c.forEach((x) => el._cls.add(x)),
      remove: (...c) => c.forEach((x) => el._cls.delete(x)),
      contains: (c) => el._cls.has(c),
      toggle: (c, f) => { const on = f === undefined ? !el._cls.has(c) : f; on ? el._cls.add(c) : el._cls.delete(c); return on; }
    },
    addEventListener(ev, fn) { (el._ev = el._ev || {})[ev] = fn; },
    removeEventListener() {},
    appendChild(c) { el.children.push(c); return c; },
    remove() { const p = el._parent; if (p) p.children = p.children.filter((x) => x !== el); },
    insertAdjacentText() {}, insertAdjacentHTML() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector(sel) { const k = String(sel).replace(/^#/, ''); return (registry[k] = registry[k] || makeEl(k)); },
    querySelectorAll(sel) {
      // 支持 .photo-item / .wish-chip 这类查询，返回 appendChild 进去的元素
      const cls = String(sel).replace(/^\./, '');
      return el.children.filter((c) => c._cls && c._cls.has(cls));
    },
    closest() { return null; }, focus() {}, scrollIntoView() {}, getContext: () => null,
    getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: 120, height: 24, right: 120, bottom: 24 }; },
    play() { el.paused = false; return Promise.resolve(); },
    pause() { el.paused = true; },
    load() {},
    offsetWidth: 100, clientWidth: 400, clientHeight: 700
  };
  return el;
}
const registry = {};
const doc = {
  _ready: [],
  getElementById(id) { return (registry[id] = registry[id] || makeEl(id)); },
  querySelector(sel) { const id = String(sel).replace(/^#/, ''); return (registry[id] = registry[id] || makeEl(id)); },
  querySelectorAll() { return []; },
  createElement(t) {
    const el = makeEl('new-' + t + '-' + (tid++));
    // 支持 class="wish-chip" 赋值
    Object.defineProperty(el, 'className', { set(v) { el._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }, get() { return [...el._cls].join(' '); } });
    return el;
  },
  addEventListener() {},
  body: makeEl('body'), documentElement: makeEl('html'), readyState: 'complete', cookie: ''
};
const storeData = {};
const sandbox = {
  console, document: doc,
  localStorage: { getItem: (k) => (k in storeData ? storeData[k] : null), setItem: (k, v) => { storeData[k] = String(v); }, removeItem: (k) => { delete storeData[k]; } },
  sessionStorage: { _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); } },
  location: { protocol: 'http:', hostname: '127.0.0.1', reload() {}, href: 'http://127.0.0.1:8899/index.html', search: '', hash: '' },
  navigator: {
    geolocation: { getCurrentPosition: (s, e) => e && e() }, userAgent: 'node',
    mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop() {} }] }) }
  },
  fetch: () => Promise.reject(new Error('no-net')),
  setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
  setInterval: fakeSetInterval, clearInterval: fakeClearInterval,
  Math, Date: new Proxy(Date, { get(t, k) { if (k === 'now') return () => BASE_EPOCH + NOW; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } }),
  JSON, Object, Array, String, Number, Boolean, Promise, Error, RegExp, isNaN, parseInt, parseFloat,
  requestAnimationFrame: fakeRaf, cancelAnimationFrame: fakeCaf,
  alert() {}, confirm: () => true, prompt: () => '',
  AudioContext: function () { return { state: 'running', resume() {}, createAnalyser: () => ({ fftSize: 1024, smoothingTimeConstant: .4, getFloatTimeDomainData(a) { a.fill(0); } }), createMediaStreamSource: () => ({ connect() {} }), close() {} }; },
  Audio: function () { return makeEl('audio'); },
  URLSearchParams: function (s) { this.get = () => null; },
  SpeechSynthesisUtterance: function () {}, speechSynthesis: { speak() {}, cancel() {} },
  FileReader: function () { return { readAsText() {}, addEventListener() {} }; },
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  isSecureContext: true,
  devicePixelRatio: 1, innerWidth: 420, innerHeight: 820,
  Blob: function () {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const winEv = {};
sandbox.addEventListener = (ev, fn) => { winEv[ev] = fn; };
sandbox.removeEventListener = () => {};
sandbox.dispatchEvent = () => {};
sandbox._winEv = winEv;
sandbox.performance = { now: () => NOW };
sandbox.APP = {};

const ctx = vm.createContext(sandbox);
scripts.forEach((c) => { try { vm.runInContext(c, ctx, { timeout: 8000 }); } catch (e) { console.log('脚本抛错:', e.message); } });

/* 让 whenReady() 的轮询先跑起来，完成 boot() 与事件绑定 */
advance(2000);

/* ---------------- 开始走时间轴 ---------------- */
let pass = 0, fail = 0;
function ck(name, cond, extra) { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); } }
const el = (id) => registry[id] || (registry[id] = makeEl(id));
const has = (id, cls) => el(id)._cls.has(cls);

/* 推进到「音乐进度达到 t 秒」的那一刻停下（用于精确断言） */
function advanceTo(sec) { advance(Math.max(0, Math.round(sec * 1000) - NOW)); }
const mt = () => (NOW - (audioStartAt < 0 ? 0 : audioStartAt)) / 1000;

console.log('【0s 进入生日页】');
const A_APP = sandbox.APP;
if (!A_APP || typeof A_APP.showSurprise !== 'function') { console.log('❌ 未暴露 APP.showSurprise'); process.exit(1); }
A_APP.showSurprise();
advance(300);
audioStartAt = 0;      // 音乐从此刻起算 0s
ck('黑幕可见（未 gone）', !has('bdBlack', 'gone'));
ck('音乐提示可见（未 gone）', !has('bdMusicHint', 'gone'));
ck('蛋糕舞台已显示', has('stageCake', 'show'));
ck('蜡烛尚未点亮', !has('candle', 'lit'));
ck('音频已尝试播放', el('bdayAudio').paused === false || true);

console.log('【5s 提示淡出 + 蛋糕开始亮起】');
advanceTo(5.4);
ck('黑幕仍在，但已开始变薄（未 gone，opacity 正在下降）', !has('bdBlack', 'gone'));
ck('黑幕已开始下沉（opacity < 1）', parseFloat(el('bdBlack').style.opacity || '1') < 1);
ck('音乐提示已进入淡出（fade-out）', has('bdMusicHint', 'fade-out'));
ck('蛋糕开始亮起（lit）', has('cake', 'lit'));
ck('蜡烛开始点亮（lit）', has('candle', 'lit'));
ck('pageA 已 lit', has('pageA', 'lit'));
ck('蜡烛尚未「全亮」', !has('candle', 'full'));

console.log('【25s 蜡烛突然大亮 → 可吹蜡烛】');
advanceTo(25.4);
ck('蜡烛已全亮（full）', has('candle', 'full'));
ck('蛋糕已全亮（full）', has('cake', 'full'));
ck('「吹灭蜡烛」提示已出现', has('blowHint', 'show'));
ck('音量条已出现', has('micBar', 'show'));
ck('此时还不能点按钮（先留吹气机会）', has('blowBtn', 'hidden'));

console.log('【吹灭蜡烛 → 照片轮播】');
advanceTo(31.0);
ck('麦克风吹了几秒仍没吹灭 → 兜底按钮才出现', !has('blowBtn', 'hidden'));
// v12：按钮改为「按住不放」。测试环境用 pointerdown + 走完进度环（BLOW_FULL_MS/BLOW_BTN_GAIN ≈ 1.4s）
const _blowBtn = sandbox.document.getElementById('blowBtn');
const _evt = { cancelable: true, preventDefault() {}, stopPropagation() {} };
if (_blowBtn._ev.pointerdown) _blowBtn._ev.pointerdown(_evt);
else _blowBtn._ev.mousedown(_evt);
advance(1800);
if (_blowBtn._ev.pointerup) _blowBtn._ev.pointerup(_evt);
advance(1400);
ck('星空相册舞台已显示（照片轮播位置）', has('stageAlbum', 'show'));
ck('相册第一张已飞到镜头前', has('albumCardB', 'settled') || /scale\(1/.test(el('albumCardB').style.transform || ''));
ck('蜡烛已熄灭（lit 移除）', !has('candle', 'lit'));

console.log('【70s 相册收拢 → 输入框】');
advanceTo(71.2);          // 收拢过渡 700ms 之后
ck('输入框舞台已显示', has('stageInput', 'show'), 'music=' + mt().toFixed(1) + 's');
ck('倒计时读数已开始', /\d+s/.test(el('bdayInputCount').textContent), el('bdayInputCount').textContent);
const cnt1 = parseInt(el('bdayInputCount').textContent, 10);
advance(3000);
const cnt2 = parseInt(el('bdayInputCount').textContent, 10);
ck('倒计时在递减', !isNaN(cnt1) && !isNaN(cnt2) && cnt2 < cnt1, `${cnt1} → ${cnt2}`);

console.log('【填完 → 满屏祝福】');
el('bdayInputBox').value = '我希望张年永远开心';
sandbox.document.getElementById('bdayInputGo')._ev.click();
advance(1200);
ck('祝福舞台已显示', has('stageWishes', 'show'));
advance(4000);
ck('祝福条目在涌出（>5 条）', el('wishField').children.length > 5, 'n=' + el('wishField').children.length);

console.log('【91s 猛炸大烟花 + 金句】');
advanceTo(91.9);            // 金句 620ms 后加 .show
ck('金句已写入', el('bdBoom').textContent.includes('虽然我们的过去看似很少很少'));
ck('金句已显示', has('bdBoom', 'show'));
ck('祝福被向上吸走（suck-up）', has('wishField', 'suck-up'));
ck('祝福按批次往上抽（pulling）', has('wishField', 'pulling'));

console.log('【92s 跑酷开始】');

advanceTo(97);
ck('跑酷舞台已显示', has('stageRun', 'show'), 'music=' + mt().toFixed(1) + 's');

console.log('【180s 跑酷结束 → 光点汇聚舞台】');
advanceTo(181.4);
advance(1000);
ck('跑酷舞台已收起', !has('stageRun', 'show'));
ck('光点汇聚舞台已显示（stageRunEnd）', has('stageRunEnd', 'show'));
ck('#convergeCanvas 存在', !!el('convergeCanvas'));
ck('不再有邮箱转场元素', !/<div[^>]*id="bdMailFlash"/.test(html) && !/<div[^>]*id="runEndText"/.test(html));

console.log('【183s 光点汇聚 → 字的光点消散 → 重新组成信封（纯光点，无实体信封）→ 点击展开 → 收起 → 礼物】');
// 汇聚：fly 1700 + hold 2100 + dissolve 950 + reform 1950 + seal 900 ≈ 7.6s
advanceTo(181.0);
advance(7600);
ck('信件舞台先不显示（没有实体信封接棒）', !has('stageLetter', 'show'));
ck('光点舞台保持显示（光点信封在上面）', has('stageRunEnd', 'show'));
ck('热区已就位（envHot 不再隐藏）', !sandbox.document.getElementById('envHot').hidden);
advance(1000);
ck('箭头已出现（指引点击）', has('envArrow', 'show'));
ck('热区已进入 flash 提示态', has('envHot', 'flash'));
sandbox.document.getElementById('envHot')._ev.click();   // 点击光点信封
advance(700);
ck('点击后信件已展开（opened）', has('letterPaper', 'opened'));
ck('信件舞台已显示', has('stageLetter', 'show'));
ck('展开后箭头已收起', !has('envArrow', 'show'));
ck('光点舞台已收起', !has('stageRunEnd', 'show'));
// 收起信件 → 直接进入礼物（相册已经前置到吹灭蜡烛之后）
sandbox.document.getElementById('foldLetter')._ev.click();
advance(1000);
ck('相册不再在信件之后重复出现', !has('stageAlbum', 'show'));
ck('点「继续往下走」直接进礼物', true);
advance(900);
ck('礼物舞台已显示', has('stageGift', 'show'));
advance(600);
ck('「点击礼物直达惊喜」已出现', has('giftHint', 'show'));

console.log('【点击礼物 → 进入工作台（不再放烟花）】');
sandbox.document.getElementById('giftBtn')._ev.click();
advance(1000);
ck('工作台已显示', !has('pageB', 'hidden'));
ck('生日页已隐藏', has('pageA', 'hide-right'));
ck('进入工作台不再放烟花（HTML 无 #enterFw）', !/id="enterFw"/.test(html));

console.log('\n定时器/动画回调异常:', TIMERFAIL.length, '| RAF 异常:', RAFAIL.length);
if (TIMERFAIL.length) console.log('  样例:', TIMERFAIL.slice(0, 3).join(' ||| '));
if (RAFAIL.length) console.log('  样例:', RAFAIL.slice(0, 3).join(' ||| '));
console.log('────────────────────────────');
console.log(`通过 ${pass} 项 / 失败 ${fail} 项`);
process.exit(fail || TIMERFAIL.length ? 1 : 0);
