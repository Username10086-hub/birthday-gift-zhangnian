/* ==========================================================================
   app.js —— 核心：本地存储 / 页面路由 / 生日惊喜页(页面A)全流程
   ========================================================================== */
(function () {
  'use strict';

  /* ======================= ① 工具 ======================= */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const pad2 = (n) => String(n).padStart(2, '0');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /** Date -> 'YYYY-MM-DD'（本地时区，不能用 toISOString 否则会差一天） */
  function dateStr(d) {
    const t = d || new Date();
    return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
  }
  const today = () => dateStr();
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);

  function toast(msg, ms) {
    const box = $('#toastBox');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms || 1800);
  }

  /* ======================= ② 数据存储 ======================= */
  const KEY = 'morandi_life_v1';

  function defaults() {
    return {
      settings: {
        theme: 'light',           // 默认浅色（晨雾紫）；可在设置切换 auto / dark（深空极光）
        birthday: Object.assign({}, APP.BIRTHDAY_DEFAULT),
        period: {},               // 经期周期概览自定义：{ avgCycle, avgDur }，缺省按记录自动计算
        todoDailyReset: true      // 当日任务每天重置
      },
      todos: [],
      expenses: [],
      meals: [],
      workouts: [],
      periods: [],
      favorites: [],
      studyLogs: [],
      exams: [],
      englishCheckins: [],
      news: [],                   // 时政：用户自行录入
      wordState: { date: '', idx: 0, known: 0, unknown: 0 },
      quoteState: { date: '', used: [], lastIdx: -1 },
      enQuoteState: { date: '', lastIdx: -1 },
      lastTodoReset: ''
    };
  }

  const Store = {
    data: defaults(),
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const p = JSON.parse(raw);
          const d = defaults();
          Object.keys(d).forEach((k) => { if (p[k] !== undefined) d[k] = p[k]; });
          d.settings = Object.assign(defaults().settings, p.settings || {});
          d.settings.birthday = Object.assign({}, APP.BIRTHDAY_DEFAULT, (p.settings && p.settings.birthday) || {});
          ['quoteState', 'enQuoteState', 'wordState'].forEach((k) => {
            d[k] = Object.assign(defaults()[k], p[k] || {});
          });
          this.data = d;
        }
      } catch (e) {
        console.warn('[Store] 本地数据读取失败，已重置', e);
        this.data = defaults();
      }
      return this.data;
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); }
      catch (e) { toast('本地保存失败，请检查浏览器设置'); }
    },
    edit(fn) { fn(this.data); this.save(); },
    export() { return JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, data: this.data }, null, 2); },
    import(json) {
      const p = JSON.parse(json);
      if (!p || !p.data) throw new Error('文件格式不正确');
      localStorage.setItem(KEY, JSON.stringify(p.data));
      this.load();
    },
    clearAll() {
      const theme = this.data.settings.theme;
      const bday = this.data.settings.birthday;
      this.data = defaults();
      this.data.settings.theme = theme;
      this.data.settings.birthday = bday;
      this.save();
    }
  };

  APP.Store = Store;
  APP.util = { $, $$, pad2, wait, uid, clamp, dateStr, today, daysBetween, toast };

  /* ======================= ③ 主题 / 音乐 ======================= */
  function applyTheme() {
    let m = Store.data.settings.theme;
    if (m === 'auto') { const h = new Date().getHours(); m = (h >= 7 && h < 19) ? 'light' : 'dark'; }
    document.documentElement.setAttribute('data-theme', m);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', m === 'dark' ? '#14132B' : '#6366F1');
  }
  APP.applyTheme = applyTheme;

  /* ======================= ④ 日期判断与路由 =======================
     规则（三重保险，绝不死循环）：
     A. 只有「今天正好是设定的生日月日」且 localStorage 没有看过标记，
        才自动进入页面A；
     B. sessionStorage 记录「本次会话已看过」，生日当天中途刷新不会重播；
     C. 页面B顶部按钮 / 设置里的入口走强制通道，任何时候都能完整重看；
     D. 页面A只能通过「礼物」按钮去页面B，反向只能手动点按钮，
        不存在任何自动反向跳转。
     另外支持预览参数：?surprise=1 或 #surprise 可直接打开页面A。
     ================================================================= */
  const K_SEEN = 'birthday_surprise_shown';
  const K_SEEN_SESSION = 'birthday_surprise_shown_session';

  function birthday() {
    const b = Store.data.settings.birthday || APP.BIRTHDAY_DEFAULT;
    return { month: Number(b.month) || 10, day: Number(b.day) || 16 };
  }
  function isBirthdayToday() {
    const b = birthday();
    const n = new Date();
    return n.getMonth() === b.month - 1 && n.getDate() === b.day;
  }
  function shouldAutoShow() {
    if (!isBirthdayToday()) return false;
    if (localStorage.getItem(K_SEEN) === 'true') return false;
    if (sessionStorage.getItem(K_SEEN_SESSION) === 'true') return false;
    return true;
  }
  APP.isBirthdayToday = isBirthdayToday;

  /* 生日入口按钮只在「今天正是生日」时出现；平时隐藏，
     想重看流程走「设置 → 生日惊喜 → 播放」。 */
  function syncBirthdayBtn() {
    const b = $('#birthdayBtn');
    if (!b) return;
    b.hidden = !isBirthdayToday();
  }
  APP.syncBirthdayBtn = syncBirthdayBtn;

  let currentPage = null;

  function showSurprise() {
    if (currentPage === 'A') return;
    resetSurprise();
    sessionStorage.setItem(K_SEEN_SESSION, 'true');
    $('#pageA').classList.remove('hide-right', 'hidden');
    $('#pageB').classList.add('hide-right');
    currentPage = 'A';
    startSurprise();
  }
  APP.showSurprise = showSurprise;

  function showWorkbench() {
    stopMic();
    stopRun();
    stopBdayMusic();
    if (typeof window.initWorkbench === 'function') window.initWorkbench();
    $('#pageA').classList.add('hide-right');
    $('#pageB').classList.remove('hidden', 'hide-right');
    currentPage = 'B';
    applyTheme();
    syncBirthdayBtn();
    if (typeof window.refreshHome === 'function') window.refreshHome();
    setTimeout(() => $('#pageA').classList.add('hidden'), 640);
    stopFireworks();
  }
  APP.showWorkbench = showWorkbench;

  /* ==========================================================================
     ⑤ 页面A：生日惊喜（音乐驱动时间轴）
     整个流程以「音乐播放进度」为准，时间点见 APP.BDAY_TL：
       0s   黑屏 + 音乐提示
       5s   提示淡出，蛋糕蜡烛开始亮起（不全亮）
       23s  蜡烛全亮 → 可以吹蜡烛
       吹灭 → 照片轮播（照片下方 = 文件名 = 我的话）
       68s  照片收拢 → 输入框（15s 倒计时）
       填完 → 满屏「我希望张年XX」祝福
       91s  猛然向上炸成大烟花 + 金句
       92s  跑酷小游戏（带信件，沿途文学语录）
       180s 跑酷结束 → 「这一次，我带着祝福跑向你」
       183s 信件闪烁可点 → 信 → 收起 → 礼物 → 工作台
     ========================================================================== */
  const A = { stage: 'idle', timers: [], raf: 0, started: false, t0: 0, canOpenLetter: false };
  let inputTimer = 0;

  const clearTimers = () => { A.timers.forEach(clearTimeout); A.timers = []; };
  const after = (fn, ms) => { const t = setTimeout(fn, ms); A.timers.push(t); return t; };

  /* ---------- 音乐控制 ---------- */
  function stopBdayMusic() {
    const au = $('#bdayAudio');
    if (au) { try { au.pause(); au.currentTime = 0; } catch (e) { /* 忽略 */ } }
  }
  /** 当前音乐进度（秒）；音乐不可用时回退到墙钟时间，保证流程一定能走完 */
  function musicTime() {
    const au = $('#bdayAudio');
    if (au && !au.paused && au.currentTime > 0) return au.currentTime;
    return A.t0 ? (Date.now() - A.t0) / 1000 : 0;
  }
  /** 等到音乐进度到达 t 秒时执行 fn（每 100ms 轮询，稳定可靠） */
  function atTime(t, fn) {
    const tick = () => {
      if (A.stage === 'done') return;
      if (musicTime() >= t) { fn(); return; }
      A.timers.push(setTimeout(tick, 100));
    };
    A.timers.push(setTimeout(tick, 100));
  }

  /** 从当前阶段平滑过渡到新的阶段：先等音乐到达 t，再执行 */
  function resetSurprise() {
    A.stage = 'idle';
    A.started = false;
    A.canOpenLetter = false;
    clearTimers();
    cancelAnimationFrame(A.raf);
    cancelAnimationFrame(A.glowRaf);
    clearTimeout(A.wishTimer);
    clearTimeout(A.photoTimer);
    clearInterval(inputTimer);
    stopMic();
    stopRun();
    stopFireworks();
    stopBdayMusic();

    $$('#pageA .stage').forEach((s) => s.classList.remove('show'));
    $('#stageCake').classList.remove('show');

    const cake = $('#cake');
    cake.classList.remove('lit', 'full');
    cake.style.filter = '';
    cake.style.opacity = '';
    cake.style.transition = '';
    const flameEl = $('#candle .flame');
    if (flameEl) flameEl.style.opacity = '';
    $('#candle').classList.remove('lit', 'full');
    $('#pageA').classList.remove('lit');

    $('#blowHint').classList.remove('show');
    $('#micBar').classList.remove('show');
    $('#micFill').style.width = '0%';
    $('#blowBtn').classList.add('hidden');
    blowReset();

    // 黑屏与音乐提示复位
    const blk = $('#bdBlack'); if (blk) { blk.classList.remove('gone'); blk.style.opacity = ''; blk.style.transition = ''; }
    const hint = $('#bdMusicHint'); if (hint) hint.classList.remove('gone', 'fade-out');

    // 输入框 / 满屏祝福复位（照片轮播那一屏已经换成星空相册，见 stopAlbum）
    const card = $('#stageInput'); if (card) card.classList.remove('show');
    const ib = $('#bdayInputBox'); if (ib) ib.value = '';
    const field = $('#wishField');
    if (field) { field.innerHTML = ''; field.classList.remove('suck-up', 'pulling'); }
    const bm = $('#bdBoom'); if (bm) { bm.textContent = ''; bm.classList.remove('show'); }
    const rq = $('#runQuote'); if (rq) { rq.textContent = ''; rq.classList.remove('show', 'typing'); }
    const rt = $('#runTip'); if (rt) rt.classList.remove('show');
    RUN.sparks.length = 0; RUN.absorbs.length = 0;
    RUN.approaching = false; RUN.heroScale = 1; RUN.glow = 0;
    RUN.arrived = false;
    stopConverge();
    const cc = $('#convergeCanvas');
    if (cc) {
      const cx2 = cc.getContext && cc.getContext('2d');
      if (cx2) cx2.clearRect(0, 0, cc.width, cc.height);
    }
    const rsc = $('#runCanvas');
    if (rsc) {
      const rx = rsc.getContext && rsc.getContext('2d');
      if (rx) rx.clearRect(0, 0, rsc.width, rsc.height);
    }
    $('#stageRun').classList.remove('show', 'fade-out');
    $('#stageRunEnd').classList.remove('show');

    const gd = $('#giftHint'); if (gd) gd.classList.remove('show');
    stopAlbum();
    const lp = $('#letterPaper');
    if (lp) lp.classList.remove('folded', 'flashable', 'pending', 'opened');
    const lar = $('#letterArrow'); if (lar) lar.classList.remove('show');
    const ehot = $('#envHot'); if (ehot) { ehot.hidden = true; ehot.classList.remove('flash'); ehot.style.cssText = ''; }
    const earw = $('#envArrow'); if (earw) earw.classList.remove('show');
    $('#stageLetter').classList.remove('show', 'top');
    $('#stageGift').classList.remove('show');
    $('#stageWishes').classList.remove('show');

    const c = $('#fwCanvas');
    if (c) {
      c.style.opacity = '0';
      const cx = c.getContext && c.getContext('2d');
      if (cx) { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, c.width, c.height); }
    }
  }

  /** 进入生日页：纯黑 → 「有音乐」提示 → 提示淡出 → 蛋糕从黑幕里缓缓亮起（不全亮）→ 23s 全亮可吹 */
  function startSurprise() {
    if (A.started) return;
    A.started = true;
    A.stage = 'intro';
    A.t0 = Date.now();

    // 尽量自动播放音乐；被浏览器拦截时，等第一次点击再播
    const au = $('#bdayAudio');
    if (au) {
      au.currentTime = 0;
      const p = au.play();
      if (p && p.catch) p.catch(() => { A.needTap = true; });
    }

    // —— 0s：完全纯黑。蛋糕先「存在但看不见」，蜡烛还没点亮 ——
    const blk = $('#bdBlack');
    if (blk) { blk.style.transition = 'none'; blk.style.opacity = '1'; blk.classList.remove('gone'); }
    $('#bdMusicHint').classList.remove('gone');
    $('#bdMusicHint').classList.remove('fade-out');
    $('#stageCake').classList.add('show');
    $('#cake').classList.remove('lit', 'full');
    $('#cake').style.transition = 'none';
    $('#cake').style.filter = '';
    $('#cake').style.opacity = '';
    $('#candle').classList.remove('lit', 'full');

    // 让浏览器先应用「全黑」这一帧，避免同帧就被过渡覆盖
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = $('#cake');
      if (c) c.style.transition = 'filter 1.8s ease, opacity 1.8s ease';
      if (blk) blk.style.transition = '';
    }));

    // 5s：提示淡出 + 黑幕开始变薄（蛋糕蜡烛从黑暗里缓缓浮出来，仍然很暗）
    atTime(APP.BDAY_TL.hintFade, () => {
      $('#bdMusicHint').classList.add('fade-out');
      A.stage = 'glowing';
      $('#pageA').classList.add('lit');
      // 黑幕在 5s → 23s 之间从 1 → 0。
      // 用 cubic-bezier(.75,0,.95,.55)：前段几乎不动（保持很暗），
      // 后段才放开 —— 配合亮度台阶，让人感觉是「跟着音乐一点点亮起来」。
      if (blk) {
        blk.style.transition = 'none';
        blk.style.opacity = '1';
        requestAnimationFrame(() => {
          blk.style.transition = 'opacity ' + (APP.BDAY_TL.blowReady - APP.BDAY_TL.hintFade) + 's cubic-bezier(.75,0,.95,.55)';
          blk.style.opacity = '0';
        });
      }
      // 蛋糕蜡烛进入「微亮」档：能看清轮廓，但远远没到全亮
      const c = $('#cake');
      if (c) { c.style.transition = 'filter 1.8s ease, opacity 1.8s ease'; c.style.filter = ''; c.style.opacity = ''; }
      $('#cake').classList.add('lit');
      $('#candle').classList.add('lit');
      // 微亮 → 全亮：逐帧插值，进度取自音乐播放时间，天然卡在音乐拍子上
      fadeCakeToFull();
    });

    // 23s：蜡烛完全亮起，可以吹蜡烛
    atTime(APP.BDAY_TL.blowReady, () => {
      if (A.stage === 'done') return;
      A.stage = 'blow';
      const blk2 = $('#bdBlack');
      if (blk2) { blk2.style.transition = 'none'; blk2.style.opacity = '0'; blk2.classList.add('gone'); }
      $('#bdMusicHint').classList.add('gone');
      const c = $('#cake');
      if (c) { c.style.transition = ''; c.style.filter = ''; c.style.opacity = ''; }
      $('#cake').classList.add('full');
      $('#candle').classList.add('full');
      $('#blowHint').classList.add('show');
      $('#micBar').classList.add('show');
      blowReset();
      blowBegin();               // 进度条立即开始工作（麦克风还没授权也能显示）
      startMic();
      // 交互顺序：先吹麦克风 —— 给几秒钟时间吹。
      // 到点还没把蜡烛吹灭（无论是有微弱的进度，还是完全没被识别），
      // 兜底按钮就出现；只要在这之前吹灭了，按钮自然不会出现。
      after(() => {
        if (A.stage !== 'blow') return;
        if (BLOW.p < 1) $('#blowBtn').classList.remove('hidden');
      }, BLOW_BTN_DELAY);
    });
  }

  /**
   * 微亮 → 全亮的逐帧插值。
   * 关键点：进度**取自音乐播放时间**（musicTime()），不是墙钟 ——
   * 这样亮度曲线天然卡在音乐的拍子上，音乐一停亮度也停。
   *
   * 关键帧（音乐秒数）与亮度：
   *   5s  .lit 微光 .30 → 12s .46 → 18s .62 → 22s .74
   *   24.6s 前一直压在 .80 附近，最后 0.4s 骤然冲到全亮 ——
   *   对齐音频里 25 秒处的那个重拍，「突然大亮」就落在它身上。
   */
  const GLOW_KEYS = [
    { t: 5,    br: 0.30, sa: 0.42 },
    { t: 12,   br: 0.46, sa: 0.56 },
    { t: 18,   br: 0.62, sa: 0.72 },
    { t: 22,   br: 0.74, sa: 0.86 },
    { t: 24.6, br: 0.80, sa: 0.92 },
    { t: 25,   br: 1.22, sa: 1.2 }
  ];
  function glowAt(t) {
    if (t <= GLOW_KEYS[0].t) return GLOW_KEYS[0];
    for (let i = 1; i < GLOW_KEYS.length; i++) {
      const a = GLOW_KEYS[i - 1], b = GLOW_KEYS[i];
      if (t <= b.t) {
        let p = (t - a.t) / Math.max(0.001, b.t - a.t);
        p = p * p * (3 - 2 * p);          // smoothstep，进出更柔和
        return { br: a.br + (b.br - a.br) * p, sa: a.sa + (b.sa - a.sa) * p, p };
      }
    }
    const L = GLOW_KEYS[GLOW_KEYS.length - 1];
    return { br: L.br, sa: L.sa, p: 1 };
  }

  function fadeCakeToFull() {
    const c = $('#cake');
    if (!c) return () => {};
    let stopped = false;
    const tick = () => {
      if (stopped || A.stage === 'done') return;
      const t = musicTime();
      if (t >= APP.BDAY_TL.blowReady) {          // 到 23s 交给 .full 接管
        c.style.filter = '';
        const fl0 = $('#candle .flame');
        if (fl0) fl0.style.opacity = '';
        return;
      }
      const g = glowAt(t);
      c.style.filter = `brightness(${g.br.toFixed(3)}) saturate(${g.sa.toFixed(3)})`
        + (g.br > 0.4 ? ` drop-shadow(0 0 ${(6 + g.br * 22).toFixed(0)}px rgba(167,139,250,${(0.05 + g.br * 0.2).toFixed(2)}))` : '');
      const fl = $('#candle .flame');
      // 火苗随亮度同步：0.3 → 1（在 23s 那一刻正好到 1，跟 .full 无缝衔接）
      if (fl) fl.style.opacity = clamp(0.3 + (g.br - 0.30) / 0.86 * 0.7, 0.3, 1).toFixed(3);
      A.glowRaf = requestAnimationFrame(tick);
    };
    A.glowRaf = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(A.glowRaf); };
  }

  /** 音乐被拦截时，用户第一次点击就补上播放 */
  function resumeBdayMusic() {
    const au = $('#bdayAudio');
    if (!au || !A.needTap) return;
    A.needTap = false;
    au.play().catch(() => {});
  }

  /* ---------- 吹蜡烛：麦克风检测 ---------- */
  let micFallbackTimer = 0;
  function fallbackBlow() {
    // 进度条保持显示（它现在就是吹气进度），只把按钮交出来
    $('#blowBtn').classList.remove('hidden');
  }

  /* --------------------------------------------------------------------------
     吹气进度：把「吹」变成一个持续可见的过程（不是一瞬间的判定）
       - 麦克风路径：由音量的「超阈值程度」逐帧累积
       - 按钮路径：按住不放时逐帧累积（松手缓慢回落）
     累积满 1 → 吹灭。进度直接显示在**麦克风的进度条**上（不另做圆环），
     无论用麦克风吹还是按住按钮，都是同一条进度条在涨。
     -------------------------------------------------------------------------- */
  const BLOW_FULL_MS = 2400;          // 吹满所需的「有效吹气时长」
  const BLOW_BTN_GAIN = 1.75;         // 按住按钮时的累积倍率（按住 ≈ 1.4s 吹灭）
  const BLOW_DECAY = 0.55;            // 松开/停止吹后的回落速度（每秒）
  const BLOW_BTN_DELAY = 4600;        // 麦克风吹了几秒还没吹灭 → 才交出兜底按钮
  const BLOW = { p: 0, last: 0, raf: 0 };
  let blowPressing = false;

  function blowReset() {
    cancelAnimationFrame(BLOW.raf);
    BLOW.raf = 0; BLOW.p = 0; BLOW.last = 0;
    blowPressing = false;
    A.micDetected = false;              // 每次进入吹气阶段都先信麦克风
    const fill = $('#micFill');
    if (fill) fill.style.width = '0%';
    const btn = $('#blowBtn');
    if (btn) btn.classList.remove('pressing');
  }

  function blowTick() {
    if (A.stage !== 'blow') { blowReset(); return; }
    const now = performance.now();
    const dt = BLOW.last ? Math.min(now - BLOW.last, 120) : 16;
    BLOW.last = now;

    let gain = 0;
    if (blowPressing) {
      gain = BLOW_BTN_GAIN;
    } else if (A.blowGain > 0) {
      gain = A.blowGain;              // 由麦克风 loop 每帧写入（0~1）
      A.blowGain = 0;
    }

    BLOW.p = gain > 0
      ? Math.min(1, BLOW.p + (dt / BLOW_FULL_MS) * gain)
      : Math.max(0, BLOW.p - (dt / 1000) * BLOW_DECAY);

    // 进度直接上麦克风那条进度条
    const fill = $('#micFill');
    if (fill) fill.style.width = (BLOW.p * 100).toFixed(1) + '%';

    if (BLOW.p >= 1) { blowOut(); return; }
    BLOW.raf = requestAnimationFrame(blowTick);
  }

  function blowBegin() {
    if (A.stage !== 'blow') return;
    if (!BLOW.raf) { BLOW.last = 0; BLOW.raf = requestAnimationFrame(blowTick); }
  }

  /* 麦克风检测到「在吹」时，给出一个 0~1 的强度，交给 blowTick 累积 */
  function feedBlow(strength) {
    if (A.stage !== 'blow') return;
    A.blowGain = Math.max(A.blowGain || 0, clamp(strength, 0, 1));
    blowBegin();
  }

  async function startMic() {
    const insecure = !window.isSecureContext && location.protocol !== 'file:' &&
      !['localhost', '127.0.0.1'].includes(location.hostname);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || insecure) return fallbackBlow();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      if (A.stage !== 'blow') { stream.getTracks().forEach((t) => t.stop()); return; }
      A.stream = stream;

      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return fallbackBlow();
      const actx = new AC();
      A.actx = actx;
      if (actx.state === 'suspended') { try { await actx.resume(); } catch (e) { /* 忽略 */ } }

      const an = actx.createAnalyser();
      an.fftSize = 1024;
      an.smoothingTimeConstant = 0.4;
      actx.createMediaStreamSource(stream).connect(an);

      const buf = new Float32Array(an.fftSize);
      let baseline = 0, calibrating = true, peak = 0;
      const t0 = performance.now();

      const loop = () => {
        if (A.stage !== 'blow') return;
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        peak = Math.max(peak * 0.94, rms);
        // 进度条不再显示瞬时音量 —— 它统一由 blowTick 写入「吹气进度」

        if (calibrating) {
          // 校准压缩到 350ms，让「吹」几乎立刻生效
          baseline = Math.max(baseline, rms);
          if (performance.now() - t0 > 350) { calibrating = false; baseline = Math.max(baseline, 0.008); }
        } else {
          // 阈值下调到 0.022；同时用「峰值骤增」兜底，防止安静环境阈值过高
          const th = Math.min(Math.max(baseline * 1.7, 0.022), 0.075);
          const surge = rms > peak * 0.55 && rms > 0.02;
          const on = rms > th || surge;
          // 不再「两帧即吹灭」，而是把强度交给进度条累积：
          // 轻声吹也能慢慢把进度推上去，吹得越用力涨得越快。
          if (on) {
            const strength = clamp((rms - th * 0.85) / Math.max(0.02, th * 1.1), 0.4, 1.8);
            A.micDetected = true;            // 麦克风起过作用 → 兜底按钮不再需要
            feedBlow(strength);
          }
        }
        A.micRaf = requestAnimationFrame(loop);
      };
      A.micRaf = requestAnimationFrame(loop);

      // 给麦克风几秒钟机会：到点蜡烛还没灭，才把兜底按钮交出来
      micFallbackTimer = setTimeout(() => {
        if (A.stage === 'blow' && BLOW.p < 1) {
          $('#blowBtn').classList.remove('hidden');
        }
      }, BLOW_BTN_DELAY);
      blowBegin();                       // 进度环从这一刻起开始工作
    } catch (e) {
      fallbackBlow();
      blowBegin();
    }
  }

  function stopMic() {
    cancelAnimationFrame(A.micRaf);
    clearTimeout(micFallbackTimer);
    if (A.stream) { A.stream.getTracks().forEach((t) => t.stop()); A.stream = null; }
    if (A.actx) { try { A.actx.close(); } catch (e) { /* 忽略 */ } A.actx = null; }
    A.blowGain = 0;
  }

  /** 吹灭蜡烛 → 进入照片轮播 */
  function blowOut() {
    if (A.stage !== 'blow') return;
    A.stage = 'photos';
    stopMic();
    blowReset();
    $('#micBar').classList.remove('show');
    $('#blowHint').classList.remove('show');
    $('#blowBtn').classList.add('hidden');
    $('#candle').classList.remove('lit', 'full');
    $('#cake').classList.remove('full', 'lit');
    $('#cake').style.transition = 'filter 1.2s ease, opacity 1.2s ease';
    $('#cake').style.filter = 'brightness(.7) saturate(.75)';
    $('#cake').style.opacity = '.78';

    starBurst();                      // 吹灭时的小庆祝
    setTimeout(() => $('#stageCake').classList.remove('show'), 500);
    after(startPhotos, 620);          // 蛋糕退场 → 照片登场
  }

  /* ==========================================================================
     ⑥ 照片轮播 = 星空宇宙回忆相册（星球驮着照片迎面飞来，全自动轮播）
     吹灭蜡烛后直接进相册；相册放完（或到收拢时间）→ 输入框
     ========================================================================== */
  function startPhotos() {
    const photos = (APP.BDAY_ALBUM && APP.BDAY_ALBUM.length ? APP.BDAY_ALBUM : APP.BDAY_PHOTOS) || [];
    if (!photos.length) return;
    A.stage = 'photos';
    startAlbum({ embedded: true });

    // collect 秒：相册收拢 → 输入框
    atTime(APP.BDAY_TL.collect, () => {
      if (A.stage !== 'photos') return;
      A.stage = 'input';
      stopAlbum();
      openInput();
    });
  }

  /* ==========================================================================
     ⑦ 输入框（15 秒内填完）
     ========================================================================== */
  let inputTick = 0;
  function openInput() {
    const secs = APP.BDAY_TL.inputSecs || 15;
    $('#stageInput').classList.add('show');
    const box = $('#bdayInputBox');
    box.value = '';
    setTimeout(() => box.focus(), 260);

    let left = secs;
    $('#bdayInputCount').textContent = left + 's';
    $('#bdayInputRing').style.width = '0%';
    clearInterval(inputTimer);
    inputTimer = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(inputTimer); finishInput(true); return; }
      $('#bdayInputCount').textContent = left + 's';
      $('#bdayInputRing').style.width = ((secs - left) / secs * 100).toFixed(0) + '%';
    }, 1000);
  }

  function finishInput(timeout) {
    if (A.stage !== 'input') return;
    clearInterval(inputTimer);
    A.stage = 'wishes';
    const box = $('#bdayInputBox');
    const mine = (box.value || '').trim();
    $('#stageInput').classList.remove('show');

    // 记录她写的那句话（不给提示，只静静收下）
    if (mine) {
      try { Store.edit((d) => { (d.bdayNotes = d.bdayNotes || []).push({ text: mine, at: Date.now() }); }); } catch (e) { /* 忽略 */ }
    }
    setTimeout(() => startWishes(mine, timeout), 420);
  }

  /* ==========================================================================
     ⑧ 满屏祝福 —— 一片一片铺满整块屏幕，然后「一堆一堆」被吸着向上抽成烟花
     目标：真的把屏幕塞满（短句 + 大字号 + 密集排布，层层叠叠）
     ========================================================================== */
  function startWishes(mine, timeout) {
    $('#stageWishes').classList.add('show');
    const field = $('#wishField');
    field.classList.remove('suck-up', 'pulling');
    field.innerHTML = '';
    const pool = (APP.BDAY_WISHES || []).slice();
    // 她写的那句优先，再多复制几条让它最先铺满
    if (mine) pool.unshift(mine, mine, mine, mine, mine, mine);
    for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }

    // 铺满期间同时监控「屏幕是否已经满了」——满了就地开始往上抽
    const chips = [];
    let n = 0, full = false;
    const vw0 = innerWidth, vh0 = innerHeight;
    // 把屏幕切成 cols × rows 的格子，用打散的顺序逐格填充（保证真的铺满整屏）
    const cols = 5, rows = 9;
    const cellW = 100 / cols, cellH = 100 / rows;
    const perm = shuffleIdx(cols * rows);
    const isFull = () => {
      // 以「文字实际覆盖的面积 / 屏幕面积」判断是否已经铺满
      let area = 0;
      for (const el of chips) {
        const r = el.getBoundingClientRect();
        area += r.width * r.height;
      }
      return area >= vw0 * vh0 * 0.62;
    };

    const spawn = () => {
      if (A.stage !== 'wishes') return;
      const el = document.createElement('div');
      el.className = 'wish-chip';
      const txt = pool[n % pool.length];
      el.textContent = txt;
      if (txt.length > 14) el.classList.add('long');
      // 逐格填充，格内再随机抖动一点，避免「排队」的机械感
      const cell = perm[n % perm.length];
      const cxx = (cell % cols) * cellW;
      const cyy = Math.floor(cell / cols) * cellH;
      el.style.left = (cxx + (Math.random() * 0.9) * cellW - 2) + '%';
      el.style.top = (cyy + (Math.random() * 0.86) * cellH + 1) + '%';
      el.style.setProperty('--rot', (Math.random() * 16 - 8).toFixed(1) + 'deg');
      el.style.fontSize = (13.5 + Math.random() * 12.5).toFixed(1) + 'px';
      el.style.animationDelay = (Math.random() * 0.16).toFixed(2) + 's';
      el.style.opacity = (0.82 + Math.random() * 0.18).toFixed(2);
      field.appendChild(el);
      chips.push(el);
      n++;
      // 铺满后停止追加（留出「抽走」的表演空间）
      if (n > 620 || (n > 120 && isFull())) { full = true; }
      if (full) return;
      const gap = Math.max(18, 120 - n * 2.2);
      A.wishTimer = setTimeout(spawn, gap);
    };
    spawn();

    // 91s：猛然急速向上炸成一大朵烟花 + 金句
    atTime(APP.BDAY_TL.fireworks, () => {
      if (A.stage !== 'wishes') return;
      A.stage = 'boom';
      clearTimeout(A.wishTimer);
      pullWishesAway();                        // 一堆一堆往上抽
      bigBoom();                               // 大烟花
      $('#bdBoom').textContent = APP.BDAY_BOOM;
      setTimeout(() => $('#bdBoom').classList.add('show'), 620);
      after(() => {
        $('#stageWishes').classList.remove('show');
        $('#bdBoom').classList.remove('show');
        setTimeout(startRun, 520);             // 92s：跑酷开始
      }, 3600);
    });
  }

  /** 洗牌：给铺满用的格子顺序打散，避免一看就是从左上往下填 */
  function shuffleIdx(k) {
    const a = new Array(k);
    for (let i = 0; i < k; i++) a[i] = i;
    for (let i = k - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /**
   * 「一堆一堆往上抽」：不是所有祝福同时刷地飞走，而是按批次一组一组被吸走。
   * 每一批的延迟错开（横向扫过 + 纵向抽离），像整屏祝福被一缕缕抽向夜空，
   * 最后一批抽完后整屏腾空 —— 正好接上大烟花。
   */
  function pullWishesAway() {
    const field = $('#wishField');
    if (!field) return;
    field.classList.add('pulling');
    const chips = Array.from(field.querySelectorAll('.wish-chip'));
    const groups = 12;                         // 抽 12 批，一层层被卷走
    const perGroup = Math.max(1, Math.ceil(chips.length / groups));
    chips.forEach((el, i) => {
      const g = Math.floor(i / perGroup);      // 第几批
      const k = (i % perGroup) / perGroup;     // 组内错开
      const delay = g * 110 + k * 55;
      el.style.animationDelay = delay.toFixed(0) + 'ms';
      el.style.setProperty('--pl', (i % 2 ? 1 : -1) * (5 + Math.random() * 18) + 'vw');  // 横向飘移
      el.style.setProperty('--pd', (100 + Math.random() * 40) + 'ms');
      el.style.zIndex = String(300 - i);
      el.style.opacity = '';                   // 让动画接管不透明度
    });
    field.classList.add('suck-up');
  }

  /** 猛然向上炸开的大烟花（比普通 burst 更密、更大、更快） */
  function bigBoom() {
    startFireworks(3600, true);
    const w = innerWidth, h = innerHeight;
    // 从下往上急速升腾的一串
    for (let i = 0; i < 7; i++) {
      setTimeout(() => burst(w * (0.2 + Math.random() * 0.6), h * (0.42 + Math.random() * 0.36), 120), i * 110);
    }
    setTimeout(() => burst(w * 0.5, h * 0.3, 220), 620);
  }

  /** 吹灭蜡烛时的小庆祝 */
  function starBurst() {
    startFireworks(2000, false);
    burst(innerWidth * 0.5, innerHeight * 0.42, 96);
  }

  /* ======================= ⑥ 烟花 ======================= */
  const FW = { ps: [], raf: 0, spawn: 0, running: false };
  // 烟花配色：五彩缤纷（红橙黄绿青蓝紫 + 粉白），在夜空里热闹喜庆
  const FW_COLORS = ['#FF4D4F', '#FF7A45', '#FFC53D', '#FFE066', '#73D13D', '#36CFC9',
    '#40A9FF', '#597EF7', '#9254DE', '#F759AB', '#FF85C0', '#FFFFFF'];

  function resizeFW() {
    const c = $('#fwCanvas');
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.floor(innerWidth * dpr);
    c.height = Math.floor(innerHeight * dpr);
    const x = c.getContext('2d');
    if (x) x.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst(x, y, n) {
    const base = FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)];
    const cnt = n || 74;
    for (let i = 0; i < cnt; i++) {
      const a = Math.PI * 2 * i / cnt + Math.random() * 0.2;
      const sp = 1.3 + Math.random() * 4.3;
      FW.ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1,
        decay: 0.008 + Math.random() * 0.012,
        color: Math.random() > 0.68 ? FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)] : base,
        size: 1.2 + Math.random() * 1.8 });
    }
    for (let i = 0; i < 12; i++) {
      FW.ps.push({ x, y, vx: (Math.random() - .5) * 1.3, vy: (Math.random() - .5) * 1.3,
        life: 1, decay: 0.03, color: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)], size: 1 + Math.random() * 1.3 });
    }
  }

  function fwLoop() {
    const c = $('#fwCanvas');
    if (!c) return;
    const x = c.getContext('2d');
    if (!x) return;
    const w = innerWidth, h = innerHeight;
    // 夜色拖尾：保持深蓝夜空底，五彩粒子拖出清晰亮尾
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = 'rgba(18, 16, 42, 0.20)';
    x.fillRect(0, 0, w, h);
    for (let i = FW.ps.length - 1; i >= 0; i--) {
      const p = FW.ps[i];
      p.vx *= .985; p.vy = p.vy * .985 + .035;
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      if (p.life <= 0) { FW.ps.splice(i, 1); continue; }
      const a = Math.max(p.life, 0);
      x.fillStyle = p.color;
      // 外圈柔光 + 内核实心，浅底上也有颗粒的通透感
      x.globalAlpha = a * 0.16;
      x.beginPath(); x.arc(p.x, p.y, p.size * a * 2.2, 0, Math.PI * 2); x.fill();
      x.globalAlpha = a;
      x.beginPath(); x.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
    if (FW.running || FW.ps.length) FW.raf = requestAnimationFrame(fwLoop);
    else x.clearRect(0, 0, w, h);
  }

  function startFireworks(dur, intense) {
    resizeFW();
    const c = $('#fwCanvas');
    c.style.transition = 'opacity .5s ease';
    c.style.opacity = '1';
    FW.running = true;
    FW.ps.length = 0;
    burst(innerWidth * .32, innerHeight * .3, intense ? 130 : 86);
    setTimeout(() => burst(innerWidth * .7, innerHeight * .26, intense ? 130 : 86), 240);

    const spawn = () => {
      if (!FW.running) return;
      burst(innerWidth * (.14 + Math.random() * .72), innerHeight * (.12 + Math.random() * .4));
      FW.spawn = setTimeout(spawn, intense ? 180 + Math.random() * 120 : 330 + Math.random() * 250);
    };
    FW.spawn = setTimeout(spawn, 500);

    cancelAnimationFrame(FW.raf);
    FW.raf = requestAnimationFrame(fwLoop);

    setTimeout(() => {
      FW.running = false;
      $('#fwCanvas').style.transition = 'opacity 1.3s ease';
      $('#fwCanvas').style.opacity = '0';
    }, dur || 6600);
  }

  function stopFireworks() {
    FW.running = false;
    clearTimeout(FW.spawn);
    cancelAnimationFrame(FW.raf);
    FW.ps.length = 0;
    const c = $('#fwCanvas');
    if (c) {
      c.style.opacity = '0';
      const x = c.getContext && c.getContext('2d');
      if (x) { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); }
    }
  }
  window.addEventListener('resize', () => { if (FW.running) resizeFW(); });

  /* ==========================================================================
     ⑨ 跑酷小游戏（92s - 180s）
     小人带着信件自动向前奔跑，地形起伏（上坡/下坡/平台/悬崖），
     途中穿过一个个「光点」：只要路过就弹出语录；
     若跳起来「够到」光点，光点会飞进小人身体里被吸收（变大、加速、发光）。
     点一下屏幕可以跳跃 —— 参考 Sheepy: A Short Adventure 的节奏感。
     ========================================================================== */
  const RUN = { raf: 0, running: false, t: 0, last: 0, camX: 0, vy: 0, onGround: true,
                heroY: 0, quotes: [], qi: 0, letters: [], particles: [], sparks: [],
                absorbs: [], speed: 0, glow: 0, heroScale: 1, approaching: false };

  /** 小人屏幕基准 X（居中偏左一点点，给前方留出视野） */
  const HERO_X = () => Math.round(innerWidth * 0.5);

  const RUN_GROUND = () => { const c = $('#runCanvas'); return c ? c.height / (window.devicePixelRatio > 1 ? Math.min(window.devicePixelRatio, 2) : 1) : 0; };

  /** 起伏地形：用多组正弦叠加，保证一直有上坡下坡和台阶感 */
  function runHeight(x) {
    const base = innerHeight * 0.68;
    const h1 = Math.sin(x / 260) * 46;
    const h2 = Math.sin(x / 91 + 1.3) * 22;
    const h3 = Math.sin(x / 640 + 2.1) * 74;
    return base + h1 + h2 + h3;
  }

  function resizeRun() {
    const c = $('#runCanvas');
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.floor(innerWidth * dpr);
    c.height = Math.floor(innerHeight * dpr);
    const x = c.getContext('2d');
    if (x) x.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 跑酷总路程（用于「快到终点」判断） */
  function runTotalDistance() {
    const qs = APP.BDAY_RUN_QUOTES || [];
    return 900 + (qs.length - 1) * 1050 + 1500;
  }

  function startRun() {
    A.stage = 'run';
    $('#stageRun').classList.add('show');
    resizeRun();
    RUN.running = true;
    RUN.t = 0; RUN.camX = 0; RUN.vy = 0; RUN.onGround = true; RUN.heroY = 0;
    RUN.particles.length = 0; RUN.letters.length = 0; RUN.sparks.length = 0; RUN.absorbs.length = 0;
    RUN.speed = 3.4;
    RUN.glow = 0; RUN.heroScale = 1; RUN.approaching = false;
    RUN.total = runTotalDistance();
    RUN.mailX = RUN.total + 240;             // 终点邮箱的位置
    RUN.arrivalX = RUN.total;                // 小人「跑完」的位置（不再进邮箱）
    RUN.arrived = false;

    // 语录点位：均匀铺在跑道上，数量跟着语录条数走
    const qs = APP.BDAY_RUN_QUOTES || [];
    RUN.quotes = qs.map((text, i) => ({ x: 900 + i * 1050, text, done: false, absorb: 0 }));
    RUN.qi = 0;
    $('#runTip').classList.add('show');
    setTimeout(() => $('#runTip').classList.remove('show'), 3600);

    RUN.last = performance.now();
    cancelAnimationFrame(RUN.raf);
    RUN.raf = requestAnimationFrame(runLoop);

    // 180s：跑酷结束 → 屏幕上出现信件和那句话
    atTime(APP.BDAY_TL.parkourEnd, finishRun);
  }

  function jump() {
    if (!RUN.running || !RUN.onGround) return;
    RUN.vy = -13.4;
    RUN.onGround = false;
    // 起跳时的尘土
    for (let i = 0; i < 10; i++) {
      RUN.particles.push({ x: RUN.camX + HERO_X(), y: runHeight(RUN.camX + HERO_X()) + RUN.heroY,
        vx: -1 - Math.random() * 2, vy: -Math.random() * 2, life: 1, r: 1.5 + Math.random() * 2.5 });
    }
  }

  function runLoop(now) {
    if (!RUN.running) return;
    const c = $('#runCanvas');
    const x = c && c.getContext && c.getContext('2d');
    if (!x) return;
    const dt = Math.min((now - RUN.last) / 16.67, 3);
    RUN.last = now;
    RUN.t += dt;

    // 前进（速度随音乐渐增，越跑越有劲）
    RUN.camX += RUN.speed * dt;
    RUN.speed = Math.min(3.4 + RUN.t * 0.006, 5.6);

    // 重力
    RUN.vy += 0.62 * dt;
    RUN.heroY += RUN.vy * dt;
    const gy = runHeight(RUN.camX + HERO_X());
    if (RUN.heroY >= 0) { RUN.heroY = 0; RUN.vy = 0; RUN.onGround = true; }

    // 自动躲避：前方地形抬高或下落时自动起跳（保证精彩、不卡住）
    const aheadD = runHeight(RUN.camX + HERO_X() + 62) - gy;
    if (RUN.onGround && aheadD < -26) { RUN.vy = -13.4; RUN.onGround = false; }
    if (!RUN.onGround && RUN.heroY > 78 && RUN.vy > 0 && runHeight(RUN.camX + HERO_X() + 40) > gy + 10) RUN.vy = -8.5;

    // 接近终点：速度自然放缓，小人略微走近镜头（不再有邮箱，跑到底即可）
    const nearEnd = RUN.arrivalX - (RUN.camX + HERO_X());
    if (nearEnd < 520) {
      if (!RUN.approaching) { RUN.approaching = true; }
      const k = clamp(nearEnd / 520, 0, 1);
      RUN.speed = Math.min(RUN.speed, 1.2 + k * 2.6);
      RUN.heroScale = 1 + (1 - k) * 0.38;
    }

    // 经过光点 → 弹语录；跳得够高就吸收（光点飞进小人身体）
    const heroScreenX = HERO_X();
    const heroTopY = gy + RUN.heroY - 62 * RUN.heroScale;
    RUN.quotes.forEach((q) => {
      if (q.done) return;
      const qy = runHeight(q.x) - 70;
      // ① 路过即触发语录（不管有没有够到）
      if (RUN.camX + heroScreenX > q.x) {
        q.done = true;
        showRunQuote(q.text);
      }
      // ② 够到光点（横向接近 + 纵向够得着）→ 吸收
      const dx = Math.abs(q.x - (RUN.camX + heroScreenX));
      const dy = Math.abs(qy - (gy + RUN.heroY - 40 * RUN.heroScale));
      if (dx < 42 && dy < 96 && !q.absorbed) {
        q.absorbed = true;
        RUN.absorbs.push({ x: q.x, y: qy, life: 1, sx: q.x - RUN.camX });
        RUN.glow = 1;
        RUN.boost = 34;
        for (let k = 0; k < 14; k++) {
          RUN.sparks.push({ x: q.x, y: qy, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6,
            life: 1, r: 1.2 + Math.random() * 2.2 });
        }
      }
    });

    // 吸收后的加速冲刺
    if (RUN.boost > 0) { RUN.speed += RUN.boost * 0.02; RUN.boost = Math.max(0, RUN.boost - dt * 0.9); }
    RUN.glow = Math.max(0, RUN.glow - 0.012 * dt);

    // 信件跟随小人的飘动尾巴
    RUN.letters.push({ x: RUN.camX + heroScreenX - 26, y: gy + RUN.heroY - 34, life: 1 });
    if (RUN.letters.length > 240) RUN.letters.shift();
    RUN.letters.forEach((l) => { l.life -= 0.012 * dt; });
    RUN.letters = RUN.letters.filter((l) => l.life > 0);

    RUN.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.18 * dt; p.life -= 0.02 * dt; });
    RUN.particles = RUN.particles.filter((p) => p.life > 0);
    RUN.sparks.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.12 * dt; p.life -= 0.022 * dt; });
    RUN.sparks = RUN.sparks.filter((p) => p.life > 0);
    RUN.absorbs.forEach((a) => {
      const tx = RUN.camX + heroScreenX, ty = gy + RUN.heroY - 34 * RUN.heroScale;
      a.x += (tx - a.x) * 0.12 * dt;
      a.y += (ty - a.y) * 0.12 * dt;
      a.life -= 0.022 * dt;
    });
    RUN.absorbs = RUN.absorbs.filter((a) => a.life > 0);

    drawRun(x);
    RUN.raf = requestAnimationFrame(runLoop);
  }

  /**
   * 跑酷语录：放慢节奏，看得清。
   * 用「队列 + 逐字打字机」而不是快速闪一下——文字先逐字浮出，
   * 停留足够久，再柔和淡出；如果同时有多条要弹，排队依次播。
   */
  const RQ = { queue: [], busy: false, hold: 0 };
  const RQ_TYPE_MS = 78;      // 每个字 78ms（一句话约 1.5~2.5s 打完）
  const RQ_HOLD_MS = 3200;    // 打完后再停留 3.2s 让人看完
  const RQ_FADE_MS = 700;     // 淡出时间
  function showRunQuote(text) {
    RQ.queue.push(text);
    if (!RQ.busy) drainRunQuote();
  }
  function drainRunQuote() {
    if (RQ.busy) return;
    const text = RQ.queue.shift();
    if (text === undefined) return;
    RQ.busy = true;
    const el = $('#runQuote');
    if (!el || A.stage !== 'run') { RQ.busy = false; return; }
    el.classList.remove('show', 'typing');
    el.textContent = '';
    setTimeout(() => {
      if (A.stage !== 'run') { RQ.busy = false; return; }
      el.classList.add('show', 'typing');
      let i = 0;
      const chars = Array.from(text);
      const type = () => {
        if (A.stage !== 'run') { RQ.busy = false; return; }
        el.textContent = chars.slice(0, ++i).join('');
        if (i < chars.length) {
          RQ.hold = setTimeout(type, RQ_TYPE_MS);
        } else {
          el.classList.remove('typing');
          RQ.hold = setTimeout(() => {
            if (A.stage !== 'run') { RQ.busy = false; return; }
            el.classList.remove('show');
            RQ.hold = setTimeout(() => { RQ.busy = false; drainRunQuote(); }, RQ_FADE_MS);
          }, RQ_HOLD_MS);
        }
      };
      type();
    }, 260);
  }

  function drawRun(x) {
    const w = innerWidth, h = innerHeight;
    RUN.ground = h * 0.68;
    const hx = HERO_X();

    // 夜色渐变天空
    const sky = x.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0E0C26');
    sky.addColorStop(.5, '#221D4A');
    sky.addColorStop(1, '#3B2F66');
    x.fillStyle = sky;
    x.fillRect(0, 0, w, h);

    // 星星（多一层视差，越快越明显）
    for (let layer = 0; layer < 2; layer++) {
      const par = layer === 0 ? 0.05 : 0.13;
      const cnt = layer === 0 ? 60 : 34;
      for (let i = 0; i < cnt; i++) {
        const sx = (i * 211.7 + layer * 90 - RUN.camX * par) % (w + 60);
        const sy = (i * 97.3 + layer * 40) % (h * 0.6);
        x.globalAlpha = (layer === 0 ? 0.22 : 0.42) + (i % 5) * 0.12;
        x.fillStyle = '#fff';
        x.beginPath(); x.arc(sx < 0 ? sx + w + 60 : sx, sy, (i % 3) * 0.4 + (layer ? 1 : .7), 0, Math.PI * 2); x.fill();
      }
    }
    x.globalAlpha = 1;

    // 月光
    const mg = x.createRadialGradient(w * 0.82, h * 0.14, 0, w * 0.82, h * 0.14, h * 0.42);
    mg.addColorStop(0, 'rgba(226,214,255,.20)');
    mg.addColorStop(1, 'rgba(226,214,255,0)');
    x.fillStyle = mg; x.fillRect(0, 0, w, h);

    // 远景山（视差）
    drawHills(x, w, h, 0.14, '#2A2454', 0.50);
    drawHills(x, w, h, 0.30, '#362B62', 0.59);
    drawHills(x, w, h, 0.52, '#443573', 0.66);

    // 跑道：起伏地形
    x.beginPath();
    x.moveTo(0, h);
    for (let sx = 0; sx <= w; sx += 6) x.lineTo(sx, runHeight(RUN.camX + sx));
    x.lineTo(w, h); x.closePath();
    const gg = x.createLinearGradient(0, h * 0.5, 0, h);
    gg.addColorStop(0, '#7A69B8');
    gg.addColorStop(.5, '#4B3D80');
    gg.addColorStop(1, '#221C40');
    x.fillStyle = gg; x.fill();

    // 跑道高光边
    x.strokeStyle = 'rgba(190,172,255,.8)'; x.lineWidth = 2.6; x.beginPath();
    for (let sx = 0; sx <= w; sx += 6) {
      const py = runHeight(RUN.camX + sx);
      if (sx === 0) x.moveTo(sx, py); else x.lineTo(sx, py);
    }
    x.stroke();

    // 背景装饰：路过的树/水晶柱
    for (let i = 0; i < 8; i++) {
      const gx = Math.floor((RUN.camX + i * 340) / 340) * 340 + i * 340;
      const sx = gx - RUN.camX;
      if (sx < -80 || sx > w + 80) continue;
      const gy2 = runHeight(gx);
      x.globalAlpha = .5;
      x.fillStyle = '#5B4A9B';
      x.beginPath();
      x.moveTo(sx, gy2); x.lineTo(sx - 9, gy2 + 34); x.lineTo(sx + 9, gy2 + 34); x.closePath(); x.fill();
      x.globalAlpha = 1;
    }

    // 不再有终点邮箱：小人一直跑，终点由「光点汇聚」来收束

    // 光点（语录触发点）
    RUN.quotes.forEach((q) => {
      const sx = q.x - RUN.camX;
      if (sx < -80 || sx > w + 80) return;
      const gy = runHeight(q.x);
      const pulse = 0.6 + Math.sin(RUN.t * 0.16 + q.x) * 0.4;
      x.globalAlpha = q.absorbed ? 0.12 : (q.done ? 0.34 : 1);
      const R = (q.absorbed ? 20 : 36) * pulse;
      const rg = x.createRadialGradient(sx, gy - 70, 0, sx, gy - 70, R);
      rg.addColorStop(0, 'rgba(255,232,160,.98)');
      rg.addColorStop(.45, 'rgba(255,206,110,.5)');
      rg.addColorStop(1, 'rgba(255,190,80,0)');
      x.fillStyle = rg;
      x.beginPath(); x.arc(sx, gy - 70, R, 0, Math.PI * 2); x.fill();
      // 核心 + 十字星芒，更像「可以拿到的道具」
      x.fillStyle = '#FFF3C4';
      x.beginPath(); x.arc(sx, gy - 70, 5.8, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(255,240,190,.85)'; x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(sx - 13 * pulse, gy - 70); x.lineTo(sx + 13 * pulse, gy - 70); x.stroke();
      x.beginPath(); x.moveTo(sx, gy - 70 - 13 * pulse); x.lineTo(sx, gy - 70 + 13 * pulse); x.stroke();
      x.globalAlpha = 1;
    });

    // 被吸收的光点：飞向小人（越飞越小、越飞越亮）
    RUN.absorbs.forEach((a) => {
      const sx = a.x - RUN.camX;
      const r = 16 * a.life + 3;
      const rg = x.createRadialGradient(sx, a.y, 0, sx, a.y, r);
      rg.addColorStop(0, 'rgba(255,250,220,' + (0.95 * a.life).toFixed(2) + ')');
      rg.addColorStop(1, 'rgba(255,210,120,0)');
      x.fillStyle = rg;
      x.beginPath(); x.arc(sx, a.y, r, 0, Math.PI * 2); x.fill();
    });

    // 吸收时炸开的星屑
    RUN.sparks.forEach((p) => {
      const sx = p.x - RUN.camX;
      x.globalAlpha = p.life;
      x.fillStyle = p.life > .5 ? '#FFF6D0' : '#FFD98A';
      x.beginPath(); x.arc(sx, p.y, p.r * p.life, 0, Math.PI * 2); x.fill();
    });
    x.globalAlpha = 1;

    // 飘落的信件尾迹
    RUN.letters.forEach((l) => {
      const sx = l.x - RUN.camX;
      x.globalAlpha = l.life * 0.5;
      x.fillStyle = '#fff3c4';
      x.fillRect(sx, l.y, 7, 5);
    });
    x.globalAlpha = 1;

    // 尘土
    RUN.particles.forEach((p) => {
      const sx = p.x - RUN.camX;
      x.globalAlpha = p.life * 0.7;
      x.fillStyle = '#cbb8ff';
      x.beginPath(); x.arc(sx, p.y, p.r * p.life, 0, Math.PI * 2); x.fill();
    });
    x.globalAlpha = 1;

    // 小人（居中）；越接近终点越大，并开始把信往前递
    const groundY = runHeight(RUN.camX + hx) + RUN.heroY;
    drawHero(x, hx, groundY, RUN.t, RUN.heroScale, RUN.approaching, RUN.glow);
  }

  function drawHills(x, w, h, par, color, base) {
    x.beginPath();
    x.moveTo(0, h);
    for (let sx = 0; sx <= w; sx += 10) {
      const gx = (RUN.camX * par + sx) / 120;
      const y = h * base + Math.sin(gx) * 42 + Math.sin(gx * 2.3) * 20;
      x.lineTo(sx, y);
    }
    x.lineTo(w, h); x.closePath();
    x.fillStyle = color; x.fill();
  }

  /**
   * 小人：带着信件奔跑。
   * sc       —— 缩放（接近终点时会变大）
   * deliver  —— 是否进入「递信」姿势（双手把信往前递）
   * glow     —— 吸收光点后的余晖
   */
  function drawHero(x, sx, sy, t, sc, deliver, glow) {
    const S = sc || 1;
    const sw = Math.sin(t * 0.32);
    const bob = Math.abs(Math.sin(t * 0.32)) * 2.4 * S;

    x.save();
    x.translate(sx, sy - bob);
    x.scale(S, S);

    // 影子
    x.globalAlpha = 0.26; x.fillStyle = '#000';
    x.beginPath(); x.ellipse(0, 2, 15, 4, 0, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1;

    // 吸收光点后的余晖
    if (glow > 0.01) {
      const rg = x.createRadialGradient(0, -22, 0, 0, -22, 52);
      rg.addColorStop(0, 'rgba(255,238,180,' + (0.5 * glow).toFixed(2) + ')');
      rg.addColorStop(1, 'rgba(255,210,120,0)');
      x.fillStyle = rg;
      x.beginPath(); x.arc(0, -22, 52, 0, Math.PI * 2); x.fill();
    }

    const SKIN = '#FFE6C4';
    const SKIN_D = '#E8C49A';
    const HAIR = '#3A2A5A';
    const CLOTH = '#8B7BD8';
    const CLOTH_D = '#6A57B0';

    // ---- 腿（跑动交替，膝盖有弯折）----
    x.strokeStyle = CLOTH_D; x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round';
    const legs = [[1, sw], [-1, -sw]];
    legs.forEach(([side, ph]) => {
      const hipX = side * 3, hipY = -16;
      const kneeX = hipX + ph * 8, kneeY = hipY + 9;
      const footX = hipX + ph * 13, footY = -1 + Math.abs(ph) * 3;
      x.beginPath();
      x.moveTo(hipX, hipY); x.lineTo(kneeX, kneeY); x.lineTo(footX, footY);
      x.stroke();
      // 鞋
      x.fillStyle = '#F0E6FF';
      x.beginPath(); x.ellipse(footX + side * 1.5, footY + 1.6, 4.4, 2.6, 0, 0, Math.PI * 2); x.fill();
    });

    // ---- 身体（微微前倾）----
    x.save();
    x.rotate(deliver ? -0.16 : -0.09);
    const bg = x.createLinearGradient(-8, -36, 8, -12);
    bg.addColorStop(0, CLOTH);
    bg.addColorStop(1, CLOTH_D);
    x.fillStyle = bg;
    x.beginPath();
    if (x.roundRect) x.roundRect(-8, -36, 16, 24, 6);
    else x.rect(-8, -36, 16, 24);
    x.fill();
    // 衣领/围巾
    x.fillStyle = '#F5A9C0';
    x.beginPath(); x.ellipse(0, -35, 8, 3.4, 0, 0, Math.PI * 2); x.fill();
    x.restore();

    // ---- 手臂 ----
    x.strokeStyle = CLOTH; x.lineWidth = 4.6;
    if (deliver) {
      // 双手向前递信：两臂前伸、双手捧住信封
      [[-1], [1]].forEach(([side]) => {
        x.beginPath();
        x.moveTo(side * 2, -31);
        x.lineTo(side * 11, -27);
        x.lineTo(side * 17, -25);
        x.stroke();
        x.fillStyle = SKIN;
        x.beginPath(); x.arc(side * 17, -25, 3.2, 0, Math.PI * 2); x.fill();
      });
      // 递出去的信（在身体前方，微微抖动）
      const lx = 6, ly = -32 + Math.sin(t * 0.3) * 1.6;
      x.save();
      x.translate(lx, ly);
      x.rotate(-0.15);
      x.fillStyle = '#FFFDF3';
      x.strokeStyle = '#DDB56A'; x.lineWidth = 1.4;
      x.fillRect(-9, -6, 22, 14);
      x.strokeRect(-9, -6, 22, 14);
      x.beginPath(); x.moveTo(-9, -6); x.lineTo(2, 2); x.lineTo(13, -6); x.stroke();
      x.restore();
    } else {
      [[1, sw], [-1, -sw]].forEach(([side, ph]) => {
        x.beginPath();
        x.moveTo(side * 2, -31);
        x.lineTo(side * (7 + ph * 6), -22 + ph * 4);
        x.stroke();
        x.fillStyle = SKIN;
        x.beginPath(); x.arc(side * (7 + ph * 6), -22 + ph * 4, 3.1, 0, Math.PI * 2); x.fill();
      });
    }

    // ---- 头 ----
    x.fillStyle = SKIN;
    x.beginPath(); x.arc(0, -44, 8.4, 0, Math.PI * 2); x.fill();
    // 腮红
    x.fillStyle = 'rgba(245,150,175,.5)';
    x.beginPath(); x.arc(-4.4, -42, 2.2, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(4.4, -42, 2.2, 0, Math.PI * 2); x.fill();
    // 头发（双层，带一撮飞扬的呆毛）
    x.fillStyle = HAIR;
    x.beginPath(); x.arc(0, -46.4, 8.4, Math.PI, Math.PI * 2); x.fill();
    x.beginPath();
    x.moveTo(-8.4, -45);
    x.quadraticCurveTo(-11, -38, -7.5, -37.5);
    x.quadraticCurveTo(-6, -41, -5.5, -44);
    x.closePath(); x.fill();
    x.beginPath();
    x.moveTo(2, -53.5);
    x.quadraticCurveTo(7, -60, 9, -53);
    x.quadraticCurveTo(6, -54, 2, -53.5);
    x.closePath(); x.fill();
    // 眼睛（向前看）
    x.fillStyle = '#2A2140';
    const blink = (Math.sin(t * 0.05) > 0.985) ? 0.2 : 1;
    x.beginPath(); x.ellipse(-2.6, -44, 1.5, 2.1 * blink, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(2.6, -44, 1.5, 2.1 * blink, 0, 0, Math.PI * 2); x.fill();
    // 眼里的小高光
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.beginPath(); x.arc(-2.1, -45, .55, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(3.1, -45, .55, 0, Math.PI * 2); x.fill();
    // 微笑
    x.strokeStyle = '#8A6A5A'; x.lineWidth = 1.2; x.lineCap = 'round';
    x.beginPath();
    x.arc(0, -41.4, 3.2, 0.25 * Math.PI, 0.75 * Math.PI);
    x.stroke();

    // ---- 背后的信（不递信时才在背后飘）----
    if (!deliver) {
      x.save();
      const ly2 = -34 + Math.sin(t * 0.2) * 3;
      x.translate(-20, ly2);
      x.rotate(Math.sin(t * 0.18) * 0.24 - 0.1);
      x.fillStyle = '#FFFDF3';
      x.strokeStyle = '#DDB56A'; x.lineWidth = 1.4;
      x.fillRect(-8, -5, 16, 11);
      x.strokeRect(-8, -5, 16, 11);
      x.beginPath(); x.moveTo(-8, -5); x.lineTo(0, 1.5); x.lineTo(8, -5); x.stroke();
      x.restore();
    }

    x.restore();
  }

  function stopRun() {
    RUN.running = false;
    cancelAnimationFrame(RUN.raf);
    const c = $('#runCanvas');
    if (c) {
      const x = c.getContext && c.getContext('2d');
      if (x) { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); }
    }
    const q = $('#runQuote'); if (q) { q.textContent = ''; q.classList.remove('show', 'typing'); }
    const tp = $('#runTip'); if (tp) tp.classList.remove('show');
    $('#stageRun').classList.remove('fade-out');
    RQ.queue.length = 0; RQ.busy = false; clearTimeout(RQ.hold);
    stopConverge();
  }

  /**
   * 跑酷结束 → 光点汇聚成那句话 → 那句话化作光尘散开、真正的信封浮现。
   *
   * 关键点（用户要求）：
   *   ① 汇聚的过程要「好看」：粒子从四面八方螺旋吸入、越聚越亮、最后定格成发光的字；
   *   ② 绝不额外出现第二个信封 —— 汇聚完成后，就是 #stageLetter 里那个
   *      「可以点的信封」本身从光里长出来（.letter.born），
   *      画布上的粒子则在同一时刻化成一圈光尘散开，把注意力交还给真信封。
   */
  function finishRun() {
    if (A.stage !== 'run') return;
    A.stage = 'runend';
    RUN.running = false;
    cancelAnimationFrame(RUN.raf);

    // 定格最后一帧（小人继续以奔跑姿态停在画面中央）
    const c = $('#runCanvas');
    const x = c && c.getContext && c.getContext('2d');
    if (x) { RUN.approaching = true; try { drawRun(x); } catch (e) { /* 忽略 */ } }

    // 跑酷画布淡出 → 光点汇聚舞台登场
    $('#stageRun').classList.add('fade-out');
    setTimeout(() => {
      $('#stageRun').classList.remove('show', 'fade-out');
      $('#stageRunEnd').classList.add('show');
      startConverge();
    }, 620);
  }

  /* --------------------------------------------------------------------------
     光点 → 那句话 → 光点散开 → 光点重新组成信封 → 真信封接棒。

     用户要求（关键）：
       「是字的光点消散了又重新组成的信封，不是这个样子的信封」
     所以粒子必须自己「长」成信封：写完那句话后，字的光点先四散（dissolve），
     再沿着信封的轮廓（外框 + 翻盖 V + 封蜡圆章）重新聚拢（reform），
     等轮廓完全站住的一瞬间，DOM 里那个「可以点的信封」才在同一个位置接棒 ——
     看起来就是这个信封被光点一笔一笔拼出来的。
     -------------------------------------------------------------------------- */
  const CV = {
    raf: 0, t: 0, phase: 'fly', ps: [],
    targetsText: [], targetsEnv: [],
    envBox: null,        // 信封在画布上的位置与尺寸（DOM 会让信封落到同一个地方）
    startedAt: 0, last: 0
  };

  /** 把一段文字栅格化，取「笔画上的点」作为粒子目标（返回点 + 画布宽度） */
  function sampleTextPoints(text, W, H) {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const ox = off.getContext('2d');
    if (!ox) return [];
    const fs = Math.min(W / Math.max(8, text.length) * 1.55, H * 0.16);
    ox.fillStyle = '#fff';
    ox.textAlign = 'center';
    ox.textBaseline = 'middle';
    ox.font = `600 ${fs}px Georgia, "Songti SC", serif`;
    // 太长就折成两行
    let lines = [text];
    if (ox.measureText(text).width > W * 0.86) {
      const half = Math.ceil(text.length / 2);
      lines = [text.slice(0, half), text.slice(half)];
    }
    const lh = fs * 1.42;
    lines.forEach((ln, i) => {
      ox.fillText(ln, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh);
    });
    const img = ox.getImageData(0, 0, W, H).data;
    const pts = [];
    const step = 3;
    for (let py = 0; py < H; py += step) {
      for (let px = 0; px < W; px += step) {
        if (img[(py * W + px) * 4 + 3] > 128) pts.push({ x: px, y: py });
      }
    }
    // 打乱，让汇聚过程更自然
    for (let i = pts.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0; [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    return pts;
  }

  /**
   * 把信封「画」成一组点，作为粒子重新聚拢的目标。
   * 信封 = 外框（圆角矩形）+ 翻盖（从顶端垂下的 V）+ 封蜡圆章（实心圆），
   * 点上再补一层薄薄的「填充洒点」，让粒子组成的信封是有质感的面，而不只是线。
   */
  function sampleEnvelopePoints(cx, cy, w, h) {
    const pts = [];
    const push = (x, y) => pts.push({ x, y });
    const r = Math.min(w, h) * 0.075;              // 圆角
    const thin = Math.max(2.2, w * 0.017);         // 描边厚度
    const steps = Math.max(420, Math.round(w * 2.2));

    // 1) 外框：四边 + 圆角（把描边加粗成几层，粒子看起来是「有重量」的线）
    for (let k = 0; k < 3; k++) {
      const inset = (k - 1) * thin * 0.9;
      const L = cx - w / 2 + inset, R = cx + w / 2 - inset;
      const T = cy - h / 2 + inset, B = cy + h / 2 - inset;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        // 上 / 下边（去掉圆角段）
        const yy0 = T, yy1 = B;
        if (u <= 1) {
          const x = L + r + u * (R - L - r * 2);
          push(x + (Math.random() - 0.5) * 1.8, yy0 + (Math.random() - 0.5) * 1.8);
          push(x + (Math.random() - 0.5) * 1.8, yy1 + (Math.random() - 0.5) * 1.8);
        }
        // 左 / 右边
        const x0 = L, x1 = R;
        const y = T + r + u * (B - T - r * 2);
        push(x0 + (Math.random() - 0.5) * 1.8, y + (Math.random() - 0.5) * 1.8);
        push(x1 + (Math.random() - 0.5) * 1.8, y + (Math.random() - 0.5) * 1.8);
      }
      // 四个圆角
      const corners = [[L + r, T + r, Math.PI, Math.PI * 1.5], [R - r, T + r, Math.PI * 1.5, Math.PI * 2],
        [R - r, B - r, 0, Math.PI * 0.5], [L + r, B - r, Math.PI * 0.5, Math.PI]];
      corners.forEach(([ox, oy, a0, a1]) => {
        for (let i = 0; i <= 16; i++) {
          const a = a0 + (a1 - a0) * (i / 16);
          push(ox + Math.cos(a) * r + (Math.random() - 0.5) * 1.4, oy + Math.sin(a) * r + (Math.random() - 0.5) * 1.4);
        }
      });
    }

    // 2) 翻盖：从左上、右上各自向下汇到中下方，形成一个 V（信封的灵魂）
    const fw = w / 2 - r * 0.6;
    const fh = h * 0.54;
    for (let k = 0; k < 3; k++) {
      const off = (k - 1) * thin * 0.85;
      for (let i = 0; i <= 220; i++) {
        const u = i / 220;
        push(cx - fw + u * fw + (Math.random() - 0.5) * 1.8, cy - h / 2 + r * 0.5 + u * fh + off + (Math.random() - 0.5) * 1.8);
        push(cx + fw - u * fw + (Math.random() - 0.5) * 1.8, cy - h / 2 + r * 0.5 + u * fh + off + (Math.random() - 0.5) * 1.8);
      }
    }

    // 3) 封蜡圆章：中心的实心圆（带一点厚度）
    const sr = Math.min(w, h) * 0.115;
    for (let i = 0; i < 1300; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = sr * Math.sqrt(Math.random());
      push(cx + Math.cos(a) * rr, cy + h * 0.06 + Math.sin(a) * rr);
    }
    // 圆章外圈（描边）
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      push(cx + Math.cos(a) * sr, cy + h * 0.06 + Math.sin(a) * sr);
      push(cx + Math.cos(a) * sr * 1.14, cy + h * 0.06 + Math.sin(a) * sr * 1.14);
    }

    // 4) 信封面的淡淡洒点：让它看起来是一张纸，而不是一个空框
    for (let i = 0; i < Math.round(w * h * 0.0016); i++) {
      push(cx + (Math.random() - 0.5) * w * 0.94, cy + (Math.random() - 0.5) * h * 0.94);
    }

    for (let i = pts.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0; [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    return pts;
  }

  /** 量一下真实信封在屏幕上的位置与尺寸，让粒子在「同一个地方」把信封拼出来 */
  function measureEnvelope() {
    const wrap = $('#stageLetter');
    const el = $('#letterPaper');
    let w = Math.min(innerWidth * 0.92, 600);
    let h = Math.min(innerHeight * 0.62, 500);
    let cx = innerWidth / 2, cy = innerHeight / 2;
    try {
      if (wrap && el && el.getBoundingClientRect) {
        const r = el.getBoundingClientRect();
        if (r && r.width > 40 && r.height > 40) {
          w = r.width; h = Math.min(r.height, innerHeight * 0.72);
          cx = r.left + r.width / 2; cy = r.top + h / 2;
        }
      }
    } catch (e) { /* 量不到就用默认值，不影响主流程 */ }
    return { cx, cy, w, h };
  }

  function startConverge() {
    const cv = $('#convergeCanvas');
    if (!cv) { after(onConvergeDone, 800); return; }
    const W = cv.width = cv.clientWidth || innerWidth;
    const H = cv.height = cv.clientHeight || innerHeight;
    CV.startedAt = performance.now();
    CV.t = 0; CV.phase = 'fly'; CV.last = 0;
    const cl = $('#convergeLine'); if (cl) cl.classList.remove('show');

    // 不支持 2D 上下文（或尺寸异常）：跳过粒子动画，按总时长直接推进
    const probe = cv.getContext && cv.getContext('2d');
    if (!probe || !W || !H) {
      const CFG0 = APP.BDAY_CONVERGE || {};
      after(onConvergeDone, totalConvergeMs(CFG0));
      return;
    }

    const line = APP.BDAY_RUN_END || '这一次，我带着祝福跑向你。';
    CV.targetsText = sampleTextPoints(line, W, H);
    // 信封目标点：先在「信纸量不到」的早期调用里退化成居中估算，稍后 phase 切入时再量一次
    CV.envBox = measureEnvelope();
    CV.targetsEnv = sampleEnvelopePoints(CV.envBox.cx, CV.envBox.cy, CV.envBox.w, CV.envBox.h);

    // 粒子：从屏幕四周螺旋飞入，带着各自的旋转半径与初速
    const N = CV.targetsText.length || 900;
    CV.ps = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = Math.max(W, H) * (0.55 + Math.random() * 0.55);
      CV.ps.push({
        x: W / 2 + Math.cos(a) * rad,
        y: H / 2 + Math.sin(a) * rad * 0.7,
        vx: 0, vy: 0,
        r: 1.0 + Math.random() * 1.8,
        hue: Math.random() < 0.34 ? 'warm' : 'cool',
        // 延迟让粒子分批到位（越靠后的越晚汇入）
        d: Math.random() * 0.46,
        // 螺旋角度：到位前会绕着中心转一点，看起来像被「吸」进去
        sw: (Math.random() < 0.5 ? 1 : -1) * (0.4 + Math.random() * 1.3),
        tw: Math.random() * Math.PI * 2,         // 闪烁相位
        // 「散开再重组」用：各自飘散的初速与随机目标（重组途中先乱一下）
        sx: 0, sy: 0, ex: 0, ey: 0, ei: 0, x: 0, y: 0
      });
    }
    // 为每个粒子预分配「散开的落点」与「重组的目标点」，保证整个动画连续、不跳帧
    CV.ps.forEach((p, i) => {
      const la = Math.random() * Math.PI * 2;
      p.ex = W / 2 + Math.cos(la) * (Math.max(W, H) * (0.08 + Math.random() * 0.42));
      p.ey = H / 2 + Math.sin(la) * (Math.max(W, H) * (0.06 + Math.random() * 0.34));
      p.ei = (i / N) * 0.55;                 // 重组时的分批延迟
    });

    cancelAnimationFrame(CV.raf);
    CV.raf = requestAnimationFrame(convergeLoop);
  }

  /** 光点链路总时长（末帧 → onConvergeDone 的兜底节拍） */
  function totalConvergeMs(c) {
    const C = c || {};
    return (C.flyMs || 1700) + (C.holdMs || 2100) + (C.dissolveMs || 900) +
      (C.reformMs || 1900) + (C.sealMs || 900);
  }


  function convergeLoop(now) {
    const cv = $('#convergeCanvas');
    if (!cv) return;
    const cx2 = cv.getContext && cv.getContext('2d');
    if (!cx2) return;
    const W = cv.width, H = cv.height;
    const dtMs = CV.last ? Math.min(now - CV.last, 60) : 16;
    CV.last = now;
    const dt = dtMs / 16.67;
    CV.t += dtMs;

    const CFG = APP.BDAY_CONVERGE || {};
    const FLY = CFG.flyMs || 1700;
    const HOLD = CFG.holdMs || 2100;
    const DISS = CFG.dissolveMs || 900;
    const REF = CFG.reformMs || 1900;
    const T_HOLD = FLY;
    const T_DISS = FLY + HOLD;
    const T_REF = FLY + HOLD + DISS;
    const T_END = FLY + HOLD + DISS + REF;

    // 阶段推进：fly（汇聚成字）→ hold（定格发亮）
    //          → dissolve（字的光点四散）→ reform（光点重新组成信封）→ done
    if (CV.t >= T_HOLD) CV.phase = 'hold';
    if (CV.t >= T_DISS) CV.phase = 'dissolve';
    if (CV.t >= T_REF) CV.phase = 'reform';
    if (CV.t >= T_END) CV.phase = 'done';

    const tc = CV.targetsText;
    if (!tc.length) { CV.raf = requestAnimationFrame(convergeLoop); return; }

    // 重组开始时重新量一次信封的真实位置，把粒子精确地引到 DOM 信封上
    if (CV.phase === 'reform' && !CV.envMeasured) {
      CV.envMeasured = true;
      CV.envBox = measureEnvelope();
      CV.targetsEnv = sampleEnvelopePoints(CV.envBox.cx, CV.envBox.cy, CV.envBox.w, CV.envBox.h);
    }
    const te = CV.targetsEnv.length ? CV.targetsEnv : tc;

    cx2.clearRect(0, 0, W, H);

    // 中央的光：汇聚时把字托在光里；散开时熄灭；重组信封时再慢慢亮起来
    let glowA = 0;
    if (CV.phase === 'fly' || CV.phase === 'hold') {
      glowA = 0.5 * clamp((CV.t - FLY * 0.35) / (FLY * 0.65), 0, 1);
    } else if (CV.phase === 'dissolve') {
      glowA = 0.5 * (1 - clamp((CV.t - T_DISS) / DISS, 0, 1));
    } else {
      glowA = 0.42 * clamp((CV.t - T_REF) / (REF * 0.5), 0, 1);
    }
    if (glowA > 0.002) {
      const gg = cx2.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.5);
      gg.addColorStop(0, `rgba(255,228,178,${glowA.toFixed(3)})`);
      gg.addColorStop(0.5, `rgba(186,150,255,${(glowA * 0.5).toFixed(3)})`);
      gg.addColorStop(1, 'rgba(120,90,220,0)');
      cx2.fillStyle = gg;
      cx2.fillRect(0, 0, W, H);
    }

    const dissolving = CV.phase === 'dissolve';
    const reforming = CV.phase === 'reform' || CV.phase === 'done';
    const dissP = dissolving ? clamp((CV.t - T_DISS) / DISS, 0, 1) : (reforming ? 1 : 0);
    const reforP = reforming ? clamp((CV.t - T_REF) / REF, 0, 1) : 0;

    CV.ps.forEach((p, i) => {
      let tgt, inPlace;

      if (dissolving) {
        // ① 消散：先微微向外鼓一下，再各自飘向自己的落点（带横向风），越飘越淡
        const e = 1 - Math.pow(1 - dissP, 2.4);
        const from = tc[i % tc.length];
        p.x = from.x + (p.ex - from.x) * e;
        p.y = from.y + (p.ey - from.y) * e - Math.sin(dissP * Math.PI) * 22;
        inPlace = 1 - e;
        tgt = { x: p.x, y: p.y };
      } else if (reforming) {
        // ② 重新组成信封：每个粒子从自己的散点，被「吸」到信封轮廓上的目标点
        const k = clamp((reforP - p.ei) / (1 - p.ei || 1), 0, 1);
        const e = 1 - Math.pow(1 - k, 3);              // easeOutCubic，收尾稳
        const from = { x: p.ex, y: p.ey };
        const to = te[i % te.length];
        // 到位前绕一点小弧线，像被磁铁吸过去
        const swirl = Math.sin(e * Math.PI) * p.sw * 26;
        const ang = Math.atan2(to.y - from.y, to.x - from.x) + Math.PI / 2;
        p.x = from.x + (to.x - from.x) * e + Math.cos(ang) * swirl;
        p.y = from.y + (to.y - from.y) * e + Math.sin(ang) * swirl;
        // 到位度用「自己的 k」，这样外框、翻盖、圆章是一笔一笔长出来的
        inPlace = k;
        tgt = to;
      } else {
        const t2 = tc[i % tc.length];
        tgt = t2;
        if (CV.phase === 'fly' && CV.t < FLY * (0.12 + p.d)) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vx *= 0.97; p.vy *= 0.97;
        } else {
          const ease = CV.phase === 'hold' ? 0.16 : 0.052;
          const dx = t2.x - p.x, dy = t2.y - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          const swirl = CV.phase === 'hold' ? 0 : clamp(dist / (Math.max(W, H) * 0.35), 0, 1) * p.sw * 0.5;
          p.x += (dx * ease - dy * swirl * 0.02) * dt;
          p.y += (dy * ease + dx * swirl * 0.02) * dt;
        }
        inPlace = 1 - clamp(Math.hypot(tgt.x - p.x, tgt.y - p.y) / Math.max(W, H) * 2.6, 0, 1);
      }

      const rise = CV.phase === 'fly' ? clamp(CV.t / 420, 0, 1) : 1;
      const breathe = CV.phase === 'hold' ? 0.9 + Math.sin(CV.t * 0.005 + p.tw) * 0.1 : 1;
      // 消散时淡出到 0.18 左右「留一口气」，重组时再从这口气长回满亮
      let alpha = (0.24 + inPlace * 0.76) * rise * breathe;
      if (dissolving) alpha *= (0.18 + 0.82 * (1 - dissP));
      if (reforming) alpha *= (0.18 + 0.82 * clamp(reforP * 1.5, 0, 1));

      cx2.globalAlpha = clamp(alpha, 0, 1);
      // 组成信封的光点偏「纸与金」的暖调，跟信封本体、封蜡一个色系
      cx2.fillStyle = reforming
        ? (p.hue === 'warm'
          ? `rgba(255,${Math.round(236 + inPlace * 16)},${Math.round(196 + inPlace * 48)},1)`
          : `rgba(${Math.round(238 + inPlace * 14)},${Math.round(214 + inPlace * 24)},${Math.round(178 + inPlace * 34)},1)`)
        : (p.hue === 'warm'
          ? `rgba(255,${Math.round(216 + inPlace * 28)},${Math.round(158 + inPlace * 70)},1)`
          : `rgba(${Math.round(190 + inPlace * 46)},${Math.round(172 + inPlace * 58)},255,1)`);
      cx2.beginPath();
      cx2.arc(p.x, p.y, p.r * (0.68 + inPlace * 0.8), 0, Math.PI * 2);
      cx2.fill();
      // 到位的光点带一层柔光边，让字 / 信封看起来是「发光」的
      if (inPlace > 0.72) {
        cx2.globalAlpha = clamp(alpha * 0.3, 0, 1);
        cx2.beginPath();
        cx2.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
        cx2.fill();
      }
    });
    cx2.globalAlpha = 1;

    // 汇聚到位 → 让清晰的那句话淡入（DOM 层，保证一定看清）；
    // 一旦开始消散，这句话就跟着光点一起退场（它已经读完了）
    const cl = $('#convergeLine');
    if (cl) {
      if (CV.phase === 'hold') cl.classList.add('show');
      else if (CV.phase !== 'fly') cl.classList.remove('show');
    }

    if (CV.phase === 'done') {
      if (cv) cv.classList.add('settled');
      onConvergeDone();
      CV.raf = requestAnimationFrame(convergeLoop);
      return;
    }
    CV.raf = requestAnimationFrame(convergeLoop);
  }

  let convergeDoneHandled = false;
  function onConvergeDone() {
    if (convergeDoneHandled) return;
    convergeDoneHandled = true;
    A.stage = 'letterWait';
    A.canOpenLetter = false;
    fillLetter();                                 // 预填好信件内容（点开即读）
    // 不再出现实体信封 —— 屏幕上就是光点组成的那个信封，
    // 汇聚画布继续以「done」帧渲染信封轮廓；热区盖在光点信封上等点击
    $('#stageRun').classList.remove('show', 'fade-out');
    const box = (CV.envBox && CV.envBox.w > 40) ? CV.envBox : measureEnvelope();
    const hot = $('#envHot');
    if (hot) {
      hot.hidden = false;
      hot.style.left = (box.cx - box.w / 2) + 'px';
      hot.style.top = (box.cy - box.h / 2) + 'px';
      hot.style.width = box.w + 'px';
      hot.style.height = box.h + 'px';
    }
    // 信封落定后箭头出现，指向可点
    setTimeout(() => {
      if (A.stage !== 'letterWait') return;
      if (hot) hot.classList.add('flash');
      const ar = $('#envArrow'); if (ar) ar.classList.add('show');
      A.canOpenLetter = true;
    }, 900);
  }

  function stopConverge() {
    cancelAnimationFrame(CV.raf);
    convergeDoneHandled = false;
    CV.ps.length = 0;
    CV.targetsEnv.length = 0;
    CV.envMeasured = false;
    const cv = $('#convergeCanvas');
    if (cv) cv.classList.remove('settled');
    const cl = $('#convergeLine'); if (cl) cl.classList.remove('show');
    const paper = $('#letterPaper'); if (paper) paper.classList.remove('born');
    const st = $('#stageLetter'); if (st) st.classList.remove('converged');
    const hot = $('#envHot'); if (hot) { hot.hidden = true; hot.classList.remove('flash'); hot.style.cssText = ''; }
    const ear = $('#envArrow'); if (ear) ear.classList.remove('show');
    const rer = $('#stageRunEnd'); if (rer) rer.classList.remove('fade-out');
  }

  /* ======================= 信件 / 礼物 ======================= */
  /** 填充信件内容（由 finishRun 的光点汇聚链路调用） */
  function fillLetter() {
    const L = APP.LETTER;
    $('#letterTitle').textContent = L.title;
    $('#letterBody').innerHTML = L.paras.map((p) => `<p>${p}</p>`).join('');
    $('#letterSign').textContent = L.sign;
    $('#letterPaper').classList.remove('folded', 'flashable', 'opened', 'pending');
    const ar = $('#letterArrow'); if (ar) ar.classList.remove('show');
    $('#letterScroll').scrollTop = 0;
  }
  APP.fillLetter = fillLetter;

  /* 开发预览钩子：?pv=album-settled / album-fly / letter / converge-* 时直接停在某个画面 */
  APP.previewAlbum = function (mode) {
    if (A.stage === 'album') return;
    A.stage = 'album';
    const st = $('#stageAlbum');
    st.classList.add('show', 'top');
    ALB.items = (APP.BDAY_ALBUM || []).slice();
    ALB.idx = 0; ALB.dx = 0;
    sizeAlbumSky(); initAlbumSky();
    fillAlbumCard(albumPanel(), 0);
    if (mode === 'fly' || mode === 'album-fly') { ALB.fly = 0.42; ALB.flyFrom = 0.42; ALB.flyMs = 1e9; layoutAlbumCard(albumPanel(), ALB.fly); }
    else { ALB.fly = 1; ALB.flyFrom = 0; ALB.flyMs = 1250; layoutAlbumCard(albumPanel(), 1); ALB.dwellAt = performance.now(); ALB.dwellMs = nextDwellMs(); }
    // 预览路径同样亮出「自动轮播中」小字
    const aap = $('#albumAuto');
    if (aap) { aap.classList.remove('show'); setTimeout(() => { if (A.stage === 'album') aap.classList.add('show'); }, 700); }
    ALB.last = performance.now();
    cancelAnimationFrame(ALB.raf);
    ALB.raf = requestAnimationFrame(albumLoop);
  };
  /** ?pv=converge-text | converge-dissolve | converge-envelope —— 光点链路的关键帧（从头播放，由截图的 virtual-time-budget 控制停在哪一帧） */
  APP.previewConverge = function () {
    A.stage = 'runend';
    $('#stageRunEnd').classList.add('show');
    $('#convergeCanvas').classList.add('show');
    startConverge();
  };
  APP.previewLetter = function () {
    A.stage = 'letter';
    A.canOpenLetter = false;
    fillLetter();
    $('#letterPaper').classList.add('opened');
    $('#stageLetter').classList.add('show', 'top');
  };

  /** 点击光点信封 → 光点舞台淡出，信纸直接展开阅读（没有实体信封这一步） */
  function openLetter() {
    if (A.stage !== 'letterWait' || !A.canOpenLetter) return;
    A.stage = 'letter';
    A.canOpenLetter = false;
    const hot = $('#envHot'); if (hot) { hot.classList.remove('flash'); hot.hidden = true; }
    const ear = $('#envArrow'); if (ear) ear.classList.remove('show');
    const rer = $('#stageRunEnd');
    if (rer) rer.classList.add('fade-out');
    setTimeout(() => {
      if (A.stage !== 'letter') return;
      stopConverge();                             // 停掉汇聚画布，回收光点
      rer.classList.remove('show', 'fade-out');
      $('#stageLetter').classList.add('show', 'top');
      $('#letterPaper').classList.add('opened');
      const sc = $('#letterScroll');
      if (sc) sc.scrollTop = 0;
    }, 520);
  }

  function foldLetter() {
    // 收起信件 → 礼物（相册已经挪到前面「照片轮播」那一段了）
    if (A.stage !== 'letter' && A.stage !== 'letterWait') return;
    A.stage = 'gift';
    A.canOpenLetter = false;
    $('#letterPaper').classList.remove('pending', 'flashable');
    $('#letterPaper').classList.add('folded');
    const ar = $('#letterArrow'); if (ar) ar.classList.remove('show');
    setTimeout(() => {
      $('#stageLetter').classList.remove('show', 'top');
      $('#stageGift').classList.add('show');
      setTimeout(() => $('#giftHint').classList.add('show'), 360);
    }, 660);
  }

  /* ==========================================================================
     ⑨ 星空宇宙回忆相册
     深邃夜空（canvas：闪烁星星 + 大小不同带土星环的星球）
     一颗颗星球从画面深处「迎面往前飞」，每颗星球驮着一张回忆照片，
     飞到镜头前时照片端端正正停在屏幕中央（图 + 标题 + 小字备注）。
     交互：点一下 / 左右滑动 → 换下一颗星球（下一张照片）；拖拽时照片跟着手指走。
     ========================================================================== */
  const ALB = {
    raf: 0, stars: [], planets: [], dust: [], carriers: [], rafts: [], shoots: [],
    items: [], idx: 0, dx: 0,
    w: 0, h: 0, last: 0, t: 0,
    // 飞入进度：0 = 刚从远处起航，1 = 稳稳停在镜头前
    fly: 1, flyFrom: 0, flyAt: 0, flyMs: 1250,
    flight: null, dwellAt: 0, dwellMs: 4200, shootTimer: 2,
    embedded: false
  };

  /** 相册里始终只有一张卡片 —— 它就是「被星球驮着飞来的那张照片」 */
  function albumPanel() { return $('#albumCardB'); }

  /**
   * 进入相册。
   *   embedded = true —— 它现在就在「吹灭蜡烛之后」这个位置（原来的照片轮播位），
   *   由时间线自己推进，所以不显示任何手动提示 / 指示点 / 按钮，也不接任何手动手势。
   *   两个分支都全自动轮播，没有「让用户翻」这回事。
   */
  function startAlbum(opt) {
    const embedded = !!(opt && opt.embedded);
    ALB.embedded = embedded;
    ALB.items = (APP.BDAY_ALBUM || []).slice();
    ALB.idx = 0; ALB.dx = 0;
    ALB.flight = null; ALB.dwellAt = 0;
    ALB.fly = 1; ALB.flyFrom = 0; ALB.flyAt = performance.now();
    const st = $('#stageAlbum');
    st.classList.add('show');
    st.classList.toggle('embedded', embedded);
    $('#albumNext').classList.remove('show');
    const aa = $('#albumAuto');
    if (aa) {
      aa.classList.remove('show');
      setTimeout(() => { if (A.stage === 'album' || A.stage === 'photos') aa.classList.add('show'); }, embedded ? 700 : 1400);
    }
    const it = $('#albumIntro');
    if (it) {
      it.textContent = embedded ? '' : (APP.BDAY_ALBUM_INTRO || '');
      it.classList.remove('show');
      if (!embedded) {
        setTimeout(() => { if (A.stage === 'album' || A.stage === 'photos') it.classList.add('show'); }, 260);
        setTimeout(() => it.classList.remove('show'), 4600);
      }
    }

    sizeAlbumSky();
    initAlbumSky();
    fillAlbumCard(albumPanel(), 0);
    paintAlbum(true);
    // 第一颗星球从很远处飞来
    flyInAlbum(0);
    ALB.last = performance.now();
    cancelAnimationFrame(ALB.raf);
    ALB.raf = requestAnimationFrame(albumLoop);
  }

  /** 让当前这张照片从「画面深处」飞到镜头前 */
  /**
   * 每次飞行生成一份「飞行剧本」：从哪侧来、走什么弧线、怎么转。
   * 目的：每张照片的入场都不一样，避免「每次都一个样」的重复感。
   */
  function makeFlightPlan(idx) {
    const side = (idx % 2 ? -1 : 1) * (Math.random() < 0.78 ? 1 : -1);  // 大交替，偶尔反一手
    return {
      side,                                                    // 飞行方向（星球从哪侧掠过）
      dip: -6 + Math.random() * 26,                            // 弧线：先沉一点还是直接平飞
      rotY: (22 + Math.random() * 22) * side,                  // 侧向入场的最大转角
      rotZ: (Math.random() * 10 - 5),                          // 落定前的整体倾斜
      drift: Math.random() * Math.PI * 2,                      // 到位后悬浮的相位
      swayAmp: 3.5 + Math.random() * 4,                        // 悬浮幅度
      breath: 0.9 + Math.random() * 0.5                        // 悬浮速度
    };
  }

  function flyInAlbum(dir) {
    ALB.flight = makeFlightPlan(ALB.idx);
    ALB.flyFrom = dir < 0 ? -1 : 0;
    ALB.fly = 0;
    ALB.flyAt = performance.now();
    ALB.flyMs = 1150 + Math.random() * 350;                    // 每次快慢略不同
    ALB.dwellAt = 0;
    ALB.dwellMs = nextDwellMs();                               // 每张停留时长也不同
  }

  /** 把第 i 张卡的内容填到面板上（图片 + 标题 + 小字备注） */
  function fillAlbumCard(panel, i) {
    if (!panel || !ALB.items.length) return;
    const it = ALB.items[((i % ALB.items.length) + ALB.items.length) % ALB.items.length];
    if (!it) return;
    const img = panel.querySelector('img');
    const t = panel.querySelector('.ac-title');
    const n = panel.querySelector('.ac-note');
    if (t) t.textContent = it.title || '';
    if (n) n.textContent = it.note || '';
    if (img) {
      const want = 'images/' + it.file;
      if (img.getAttribute('data-src') !== want) {
        img.setAttribute('data-src', want);
        img.classList.remove('ready');
        img.onload = () => img.classList.add('ready');
        img.onerror = () => img.classList.add('ready');
        img.src = want;
      } else if (img.complete) {
        img.classList.add('ready');
      }
    }
  }

  /**
   * 单张卡片的摆位：e 为「飞入进度 0→1」，位姿由 ALB.flight 剧本决定。
   *   e = 0   还在画面深处：极小、模糊、很暗，按剧本一侧斜着往镜头飞
   *   e = 1   停在镜头前正中央：实体大小、清晰、明亮，带着轻微呼吸悬浮
   * 拖拽时把手势折算成一个偏移 + 旋转，卡片跟着手指轻微偏移。
   */
  function layoutAlbumCard(panel, e) {
    if (!panel) return;
    const fp = ALB.flight || makeFlightPlan(ALB.idx);
    ALB.flight = fp;
    const k = clamp(e, 0, 1);
    // easeOutCubic：起步快、收尾稳，像真的「飞过来停住」
    const p = 1 - Math.pow(1 - k, 3);
    const depth = 1 - p;                                  // 1 = 远处，0 = 到位
    const scale = (0.16 + Math.abs(fp.side) * 0.02) + p * 0.82;
    const z = -depth * 900;
    const rotY = depth * fp.rotY;
    const rotZ = depth * fp.rotZ;
    // 到位后的呼吸悬浮：每张照片的节奏、幅度都不一样
    const sway = Math.sin(ALB.t * fp.breath + fp.drift) * fp.swayAmp * p;
    const float = Math.cos(ALB.t * fp.breath * 0.8 + fp.drift) * fp.swayAmp * 0.7 * p;

    panel.style.transform =
      `translate3d(calc(-50% + ${sway.toFixed(2)}%), calc(-50% + ${(depth * fp.dip + float).toFixed(2)}%), ${z.toFixed(0)}px)`
      + ` scale(${scale.toFixed(3)}) rotateY(${rotY.toFixed(2)}deg) rotate(${rotZ.toFixed(2)}deg)`;
    panel.style.opacity = clamp(0.06 + p * 0.94, 0, 1).toFixed(3);
    panel.style.filter = `blur(${(depth * 7).toFixed(2)}px) brightness(${(0.58 + p * 0.42).toFixed(2)}) saturate(${(0.7 + p * 0.3).toFixed(2)})`;
    panel.style.zIndex = '10';
    panel.style.pointerEvents = 'none';
    panel.classList.toggle('settled', p > 0.985);
  }

  /** 单帧绘制：填内容 + 摆位 */
  function paintAlbum(instant) {
    if (instant) { ALB.fly = 1; ALB.flyFrom = 0; }
    layoutAlbumCard(albumPanel(), ALB.fly);
  }

  /* ---------------- 星空背景：星星 + 星球（三层视差） ---------------- */
  function sizeAlbumSky() {
    const cv = $('#albumSky');
    if (!cv) return;
    ALB.w = cv.width = cv.clientWidth || innerWidth;
    ALB.h = cv.height = cv.clientHeight || innerHeight;
  }

  function initAlbumSky() {
    const W = ALB.w || innerWidth, H = ALB.h || innerHeight;
    // 星星：分三层，大小与亮度不同，缓慢闪烁（偏冷的月白，跟蓝紫色系统一）
    ALB.stars = [];
    const N = Math.round((W * H) / 5200);
    for (let i = 0; i < N; i++) {
      const layer = i % 3;                              // 0 最远 2 最近
      ALB.stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.5 + layer * 0.55 + Math.random() * 0.6,
        a: 0.28 + layer * 0.2 + Math.random() * 0.3,
        ph: Math.random() * Math.PI * 2,
        sp: 0.6 + Math.random() * 1.6,
        drift: (layer + 1) * 0.06,                  // 视差：越近飘得越快
        // 统一色调：绝大多数是月白，少量偏薄荷蓝 —— 不再有暖黄跳色
        tint: Math.random() < 0.22 ? 'mint' : 'moon'
      });
    }
    // 星球：远中近三层布景，缓慢漂浮。
    // 用户要求「色调统一」：全部收在同一支莫兰迪蓝紫灰里（只靠明度/色相差一点点），
    // 不再出现粉、棕、绿、米这几个跳出来的颜色。
    const presets = [
      { x: 0.16, y: 0.20, r: 0.085, ring: 1.45, tilt: -0.32, c1: '#8CA9B3', c2: '#5B7C8A', sp: 0.13, layer: 2 },
      { x: 0.82, y: 0.30, r: 0.052, ring: 0,    tilt: 0,     c1: '#A3AEC3', c2: '#6B7691', sp: 0.19, layer: 1 },
      { x: 0.30, y: 0.78, r: 0.115, ring: 1.6,  tilt: 0.42,  c1: '#B8AECB', c2: '#6E6A93', sp: 0.09, layer: 3 },
      { x: 0.72, y: 0.82, r: 0.038, ring: 0,    tilt: 0,     c1: '#9FB3BF', c2: '#68808F', sp: 0.26, layer: 1 },
      { x: 0.50, y: 0.12, r: 0.030, ring: 0,    tilt: 0,     c1: '#AFB4CB', c2: '#74798F', sp: 0.31, layer: 0 },
      { x: 0.06, y: 0.56, r: 0.024, ring: 0,    tilt: 0,     c1: '#97A5B2', c2: '#63717E', sp: 0.35, layer: 0 }
    ];
    ALB.planets = presets.map((p, i) => ({
      ...p,
      bx: p.x * W, by: p.y * H,
      R: Math.max(16, p.r * Math.min(W, H)),
      ph: i * 1.7,
      // 漂浮范围：层数越小（越远）漂得越慢越小
      ax: (14 + i * 7) * (0.5 + p.layer * 0.22),
      ay: (10 + i * 6) * (0.5 + p.layer * 0.22)
    }));
    // 驮照片的「航行者星球」：三颗交替，同一支蓝紫色系里换明度
    const carrier = [
      { c1: '#8CA9B3', c2: '#5B7C8A', ring: 1.5,  tilt: -0.3 },
      { c1: '#A3AEC3', c2: '#6B7691', ring: 0,    tilt: 0 },
      { c1: '#B8AECB', c2: '#6E6A93', ring: 1.62, tilt: 0.36 }
    ];
    ALB.carriers = carrier.map((c, i) => ({ ...c, ph: i * 2.3 }));
    // 远处的漂流星球（不驮照片，只做深度感）—— 同样只用同一支色系
    const raftTones = ['#8CA9B3', '#A3AEC3', '#B8AECB', '#9FB3BF', '#AFB4CB'];
    ALB.rafts = [];
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      ALB.rafts.push({
        ang: a,
        rad: 0.5 + Math.random() * 0.9,
        z: i / 7,
        r: 0.016 + Math.random() * 0.03,
        c1: raftTones[i % raftTones.length],
        c2: '#5C5A7E',
        sp: 0.05 + Math.random() * 0.08
      });
    }
    // 飘落的星屑（DOM 层，与 canvas 星空叠加）
    const dustBox = $('#albumDust');
    if (dustBox) {
      dustBox.innerHTML = '';
      for (let i = 0; i < 22; i++) {
        const d = document.createElement('i');
        d.style.left = (Math.random() * 100) + '%';
        d.style.bottom = (-6 - Math.random() * 12) + '%';
        d.style.animationDuration = (7 + Math.random() * 9).toFixed(1) + 's';
        d.style.animationDelay = (-Math.random() * 12).toFixed(1) + 's';
        dustBox.appendChild(d);
      }
    }
  }

  function albumLoop(now) {
    if (A.stage !== 'album' && A.stage !== 'photos') return;
    const cv = $('#albumSky');
    if (!cv) { ALB.raf = requestAnimationFrame(albumLoop); return; }
    const x = cv.getContext && cv.getContext('2d');
    if (!x) { ALB.raf = requestAnimationFrame(albumLoop); return; }
    const dtMs = ALB.last ? Math.min(now - ALB.last, 60) : 16;
    ALB.last = now;
    const dt = dtMs / 1000;
    ALB.t += dt;
    const W = ALB.w, H = ALB.h;

    // ---- 飞入进度推进：星球驮着照片一路飞到镜头前 ----
    if (ALB.fly < 1) {
      const el = now - ALB.flyAt;
      ALB.fly = clamp(ALB.flyFrom + (el / ALB.flyMs) * (1 - ALB.flyFrom), 0, 1);
      if (ALB.fly >= 1) { ALB.fly = 1; ALB.flyFrom = 0; ALB.dwellAt = now; }
      layoutAlbumCard(albumPanel(), ALB.fly);
    } else if (ALB.dwellAt) {
      // ---- 全自动轮播：到位后停留一下，自动飞来下一颗星球。
      // 用户要求「去掉让她手动」——不再有拖拽/点击/键盘，只有这一条时间线在推。
      // 全自动循环轮播：到最后一张后回到第一张，永远转下去
      if (now - ALB.dwellAt > ALB.dwellMs) albumStep(1);
    }

    // ---- 流星：偶发一颗（画在星空之后，见下方绘制段） ----
    ALB.shootTimer = (ALB.shootTimer || 0) - dt;
    if (ALB.shootTimer <= 0) {
      ALB.shootTimer = 2.2 + Math.random() * 3.4;
      ALB.shoots.push({
        x: W * (0.15 + Math.random() * 0.7),
        y: H * (Math.random() * 0.3),
        vx: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 160),
        vy: 90 + Math.random() * 110,
        life: 1
      });
    }
    ALB.shoots = (ALB.shoots || []).filter((s) => s.life > 0);
    ALB.shoots.forEach((s) => {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 0.9;
    });

    x.clearRect(0, 0, W, H);

    // ---- 深邃夜空底色（画布内再铺一层，保证叠加层次） ----
    const bg = x.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.78);
    bg.addColorStop(0, 'rgba(26, 22, 58, .9)');
    bg.addColorStop(0.55, 'rgba(14, 11, 36, .92)');
    bg.addColorStop(1, 'rgba(5, 4, 15, .96)');
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);

    // ---- 星星（闪烁 + 极缓横移，做出视差） ----
    ALB.stars.forEach((s) => {
      const tw = 0.55 + Math.sin(ALB.t * s.sp + s.ph) * 0.45;
      const px = s.x + Math.sin(ALB.t * s.drift + s.ph) * 6;
      x.globalAlpha = clamp(s.a * tw, 0, 1);
      x.fillStyle = s.tint === 'mint' ? '#DCEFF0' : '#F2F3FA';
      x.beginPath(); x.arc(px, s.y, s.r, 0, Math.PI * 2); x.fill();
      // 最近的星星带一点点十字星芒
      if (s.r > 1.5) {
        x.globalAlpha *= 0.5;
        x.strokeStyle = 'rgba(238,242,252,.9)'; x.lineWidth = 0.9;
        x.beginPath(); x.moveTo(px - s.r * 3, s.y); x.lineTo(px + s.r * 3, s.y); x.stroke();
        x.beginPath(); x.moveTo(px, s.y - s.r * 3); x.lineTo(px, s.y + s.r * 3); x.stroke();
      }
    });
    x.globalAlpha = 1;

    // ---- 星球：温柔缓慢漂浮，带土星环（远景布景） ----
    ALB.planets.forEach((p) => {
      const cx = p.bx + Math.sin(ALB.t * p.sp * 0.5 + p.ph) * p.ax;
      const cy = p.by + Math.cos(ALB.t * p.sp * 0.42 + p.ph) * p.ay;
      drawPlanet(x, cx, cy, p.R, p);
    });

    // ---- 远处的漂流星球：绕中心极慢公转，靠近时更亮更大 ----
    (ALB.rafts || []).forEach((r) => {
      const a = r.ang + ALB.t * r.sp;
      const cx = W * 0.5 + Math.cos(a) * W * r.rad * 0.62;
      const cy = H * 0.46 + Math.sin(a) * H * r.rad * 0.5;
      const R = Math.max(10, r.r * Math.min(W, H) * (0.7 + r.z * 0.9));
      x.globalAlpha = 0.34 + r.z * 0.4;
      drawPlanet(x, cx, cy, R, { c1: r.c1, c2: r.c2, ring: 0, tilt: 0 });
      x.globalAlpha = 1;
    });

    // ---- 航行者星球：驮着照片从画面深处迎面飞来 ----
    //   fly: 0 → 1 时，星球从 vanish point 一路放大、擦身而过
    const f = ALB.fly;
    if (f < 1.001) {
      const fp = ALB.flight || {};
      const car = (ALB.carriers || [])[ALB.idx % Math.max(1, (ALB.carriers || []).length)];
      if (car && fp.side !== undefined) {
        // 起自屏幕中央偏上的消失点，按飞行剧本往镜头一侧擦过
        const vx = W * 0.5, vy = H * 0.44;
        const dir = fp.side;
        const ee = f * f * (3 - 2 * f);                      // smoothstep
        const cx = vx + dir * ee * W * 0.62;
        const cy = vy + ee * H * 0.72;
        const R = Math.max(12, Math.min(W, H) * (0.035 + ee * 0.62));
        drawPlanet(x, cx, cy, R, car);
        // 擦身而过时的一道光晕拉丝
        if (f > 0.15 && f < 0.95) {
          const g2 = x.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 2.6);
          g2.addColorStop(0, hexA(car.c1, 0.34 * (1 - f)));
          g2.addColorStop(1, hexA(car.c1, 0));
          x.fillStyle = g2;
          x.beginPath(); x.arc(cx, cy, R * 2.6, 0, Math.PI * 2); x.fill();
        }
      }
    }

    // ---- 流星（拖尾）：画在所有星空元素之上（月白，不用暖黄跳色） ----
    (ALB.shoots || []).forEach((s) => {
      const a = clamp(s.life, 0, 1);
      const tail = 0.09;
      const g = x.createLinearGradient(s.x - s.vx * tail, s.y - s.vy * tail, s.x, s.y);
      g.addColorStop(0, 'rgba(226,232,246,0)');
      g.addColorStop(1, `rgba(244,247,255,${(0.82 * a).toFixed(3)})`);
      x.strokeStyle = g; x.lineWidth = 1.6; x.lineCap = 'round';
      x.beginPath();
      x.moveTo(s.x - s.vx * tail, s.y - s.vy * tail);
      x.lineTo(s.x, s.y);
      x.stroke();
    });

    ALB.raf = requestAnimationFrame(albumLoop);
  }

  /** 一颗温柔治愈的星球（带土星环）。用莫兰迪色系，禁止高饱和。 */
  function drawPlanet(x, cx, cy, R, p) {
    // 外层辉光
    const halo = x.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.1);
    halo.addColorStop(0, hexA(p.c1, 0.22));
    halo.addColorStop(1, hexA(p.c1, 0));
    x.fillStyle = halo;
    x.beginPath(); x.arc(cx, cy, R * 2.1, 0, Math.PI * 2); x.fill();

    // 土星环（在球体之后画一半、之前画一半，做出穿过球体的感觉）
    if (p.ring) {
      x.save();
      x.translate(cx, cy);
      x.rotate(p.tilt);
      const rx = R * p.ring, ry = R * p.ring * 0.30;
      // 环的后半
      x.strokeStyle = hexA(p.c2, 0.55); x.lineWidth = Math.max(2, R * 0.11);
      x.beginPath(); x.ellipse(0, 0, rx, ry, 0, Math.PI, Math.PI * 2); x.stroke();
      x.strokeStyle = hexA(p.c1, 0.34); x.lineWidth = Math.max(1, R * 0.05);
      x.beginPath(); x.ellipse(0, 0, rx * 1.16, ry * 1.16, 0, Math.PI, Math.PI * 2); x.stroke();
      x.restore();
    }

    // 球体
    const g = x.createRadialGradient(cx - R * 0.34, cy - R * 0.36, R * 0.14, cx, cy, R);
    g.addColorStop(0, lighten(p.c1));
    g.addColorStop(0.55, p.c1);
    g.addColorStop(1, p.c2);
    x.fillStyle = g;
    x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();

    // 球体上的一点柔光与暗部，做出体积
    x.globalAlpha = 0.24;
    x.fillStyle = '#FFFFFF';
    x.beginPath(); x.ellipse(cx - R * 0.34, cy - R * 0.4, R * 0.4, R * 0.28, -0.5, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1;

    // 环的前半（盖在球体上）
    if (p.ring) {
      x.save();
      x.translate(cx, cy);
      x.rotate(p.tilt);
      const rx = R * p.ring, ry = R * p.ring * 0.30;
      x.strokeStyle = hexA(p.c1, 0.72); x.lineWidth = Math.max(2, R * 0.12);
      x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, Math.PI); x.stroke();
      x.strokeStyle = hexA('#FFFFFF', 0.3); x.lineWidth = Math.max(1, R * 0.045);
      x.beginPath(); x.ellipse(0, 0, rx * 1.16, ry * 1.16, 0, 0, Math.PI); x.stroke();
      x.restore();
    }
  }

  /* ---------------- 换页：只由时间线自动驱动（手动交互已按要求移除） ---------------- */

  /** 自动轮播停留时长：每张略有差别，避免「一秒一次」的机械感 */
  function nextDwellMs() {
    return 3600 + Math.random() * 1200;              // 3.6 ~ 4.8s
  }

  /** 换到下一张照片：填内容 → 让新的星球从深处飞来 */
  function albumStep(dir) {
    if (A.stage !== 'album' && A.stage !== 'photos') return;
    if (!ALB.items.length) return;
    // 循环轮播：到头就绕回开头，永远转下去
    const ni = (((ALB.idx + dir) % ALB.items.length) + ALB.items.length) % ALB.items.length;
    ALB.idx = ni;
    fillAlbumCard(albumPanel(), ni);
    flyInAlbum(dir);
    if (!ALB.embedded && ALB.idx >= ALB.items.length - 1) {
      $('#albumNext').classList.add('show');
    } else {
      $('#albumNext').classList.remove('show');
    }
  }

  function stopAlbum() {
    cancelAnimationFrame(ALB.raf);
    ALB.raf = 0;
    ALB.dx = 0;
    ALB.fly = 1; ALB.flyFrom = 0;
    ALB.flight = null; ALB.dwellAt = 0; ALB.shootTimer = 2;
    ALB.stars.length = 0; ALB.planets.length = 0;
    ALB.carriers.length = 0; ALB.rafts.length = 0; ALB.shoots.length = 0;
    const cv = $('#albumSky');
    if (cv) { const x = cv.getContext && cv.getContext('2d'); if (x) x.clearRect(0, 0, cv.width, cv.height); }
    $('#stageAlbum').classList.remove('show');
    const it = $('#albumIntro'); if (it) it.classList.remove('show');
    const aa2 = $('#albumAuto'); if (aa2) aa2.classList.remove('show');
    const nx = $('#albumNext'); if (nx) nx.classList.remove('show');
  }

  /** 相册 → 礼物 */
  function albumToGift() {
    if (A.stage !== 'album') return;
    A.stage = 'gift';
    stopAlbum();
    $('#stageGift').classList.add('show');
    setTimeout(() => $('#giftHint').classList.add('show'), 360);
  }

  /* 颜色工具：把 #RRGGBB 转成 rgba(...) / 提亮 */
  function hexA(hex, a) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function lighten(hex) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    const up = (v) => Math.min(255, Math.round(v + (255 - v) * 0.45));
    return `rgb(${up((n >> 16) & 255)},${up((n >> 8) & 255)},${up(n & 255)})`;
  }

  /* ======================= 事件绑定 ======================= */
  function bind() {
    /* ---- 吹蜡烛按钮：按住不放持续吹气（按下即生效，不再有「点不动」） ---- */
    const blowBtn = $('#blowBtn');
    const pressBlow = (e) => {
      if (e && e.cancelable) e.preventDefault();
      resumeBdayMusic();
      if (A.stage !== 'blow') return;
      blowPressing = true;
      blowBtn.classList.add('pressing');
      blowBtn.classList.remove('hidden');      // 保险：任何情况下按下都可见
      blowBegin();
    };
    const releaseBlow = () => {
      blowPressing = false;
      blowBtn.classList.remove('pressing');
    };
    blowBtn.addEventListener('pointerdown', pressBlow);
    blowBtn.addEventListener('pointerup', releaseBlow);
    blowBtn.addEventListener('pointercancel', releaseBlow);
    blowBtn.addEventListener('pointerleave', releaseBlow);
    // 兼容不支持 Pointer Events 的环境
    blowBtn.addEventListener('touchstart', pressBlow, { passive: false });
    blowBtn.addEventListener('touchend', releaseBlow);
    blowBtn.addEventListener('mousedown', pressBlow);
    window.addEventListener('mouseup', releaseBlow);
    // 键盘可达性（空格/回车按住同样有效）
    blowBtn.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') pressBlow(e);
    });
    blowBtn.addEventListener('keyup', releaseBlow);

    /* 兜底：点蛋糕区域 = 一次性推进一大段吹气进度（连点几下即可吹灭） */
    $('#stageCake').addEventListener('click', () => {
      resumeBdayMusic();
      if (A.stage !== 'blow') return;
      blowBtn.classList.remove('hidden');
      feedBlow(1.5);
      // 单次点击直接给 42% 进度，两三下就能吹灭
      BLOW.p = Math.min(1, BLOW.p + 0.42);
      const fill = $('#micFill');
      if (fill) fill.style.width = (BLOW.p * 100).toFixed(1) + '%';
      if (BLOW.p >= 1) blowOut(); else blowBegin();
    });
    $('#foldLetter').addEventListener('click', foldLetter);

    // 点击信件：待点击态 → 展开
    $('#letterPaper').addEventListener('click', openLetter);
    // 点击「光点组成的信封」（热区盖在汇聚画布上）→ 打开信
    $('#envHot').addEventListener('click', openLetter);

    /* ---- 星空宇宙回忆相册：全自动轮播，不再接手动交互 ----
       用户要求「自动轮播，去掉让她手动的话」，所以拖拽 / 滑动 / 点击 / 键盘
       这些换页手段统一去掉，只留下时间线自己一张张往前推。 */
    $('#albumNext').addEventListener('click', albumToGift);

    $('#giftBtn').addEventListener('click', () => {
      localStorage.setItem(K_SEEN, 'true');
      sessionStorage.setItem(K_SEEN_SESSION, 'true');
      showWorkbench();
    });

    // 输入框
    $('#bdayInputGo').addEventListener('click', () => finishInput(false));
    $('#bdayInputBox').addEventListener('keydown', (e) => { if (e.key === 'Enter') finishInput(false); });

    // 跑酷：点屏幕跳
    const runTap = () => { if (A.stage === 'run') jump(); };
    $('#stageRun').addEventListener('click', runTap);
    window.addEventListener('keydown', (e) => {
      if (A.stage === 'run' && (e.key === ' ' || e.key === 'ArrowUp')) jump();
    });

    // 出生日页任意点击都可补上被拦截的音乐
    $('#pageA').addEventListener('click', resumeBdayMusic);

    // 顶部 / 设置里的按钮：强制重看（不改动已看过标记，不影响当天刷新逻辑）
    $('#birthdayBtn').addEventListener('click', () => showSurprise());

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="replay-birthday"]')) showSurprise();
    });

    window.addEventListener('resize', () => { if (RUN.running) resizeRun(); });
    window.addEventListener('resize', () => {
      if (A.stage !== 'album') return;
      sizeAlbumSky();
      initAlbumSky();
      layoutAlbumCard(albumPanel(), ALB.fly);
    });
  }

  /* ======================= ⑨ 启动 ======================= */
  function boot() {
    Store.load();
    applyTheme();
    syncBirthdayBtn();
    bind();

    const p = new URLSearchParams(location.search);
    const forcePreview = p.get('surprise') === '1' || location.hash === '#surprise';
    // 开发预览：?pv=album-settled | album-fly | letter 直接停在某个画面（不启动正式流程）
    const pv = p.get('pv');

    if (pv) {
      const bb = $('#bdBlack');
      if (bb) { bb.classList.add('gone'); bb.style.transition = 'none'; bb.style.opacity = '0'; }
      const mh = $('#bdMusicHint'); if (mh) { mh.classList.add('gone'); mh.style.opacity = '0'; }
      const pa = $('#pageA'); if (pa) pa.classList.add('lit');
      // 预览专用：直接掐掉入场遮罩与所有过渡，保证截图/预览所见即所得
      const pvStyle = document.createElement('style');
      pvStyle.textContent = '#pageA::after{transition:none!important;opacity:0!important}' +
        '*{animation-duration:0s!important;transition-duration:0s!important}' +
        '.album-dust i{animation-duration:9s!important}';
      document.head.appendChild(pvStyle);
      const ck = $('#cake'); if (ck) ck.classList.add('lit', 'full');
      const cd = $('#candle'); if (cd) cd.classList.add('lit', 'full');
      setTimeout(() => {
        if (pv === 'letter') APP.previewLetter();
        else if (pv.indexOf('converge') === 0) APP.previewConverge();
        else APP.previewAlbum(pv);
      }, 60);
    }
    else if (forcePreview || shouldAutoShow()) showSurprise();
    else showWorkbench();

    // 支持 ?theme=light|dark 临时预览某个主题（不写入设置）
    const th = p.get('theme');
    if (th === 'light' || th === 'dark') APP.applyTheme = () => document.documentElement.setAttribute('data-theme', th);
    APP.applyTheme();

    // 支持 ?view=模块名 直接打开某个模块（便于收藏某页）
    const v = p.get('view');
    if (!forcePreview && v && typeof APP.go === 'function') setTimeout(() => APP.go(v), 40);

    setInterval(applyTheme, 60000);
  }

  let tries = 0;
  function whenReady() {
    if (typeof window.initWorkbench !== 'function' && tries < 120) { tries++; return setTimeout(whenReady, 25); }
    boot();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', whenReady);
  else whenReady();
})();
