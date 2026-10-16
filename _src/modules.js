/* ==========================================================================
   modules.js —— 页面B：九个功能模块
   首页 / 记账 / 运动三餐 / 日程待办 / 经期 / 外语学习 / 专业学习 / 时政 / 设置
   ========================================================================== */
(function () {
  'use strict';

  const { $, $$, dateStr, today, daysBetween, uid, toast, clamp, pad2 } = APP.util;
  const Store = APP.Store;

  let inited = false;
  let currentView = 'home';

  /* ---------- 导航配置（顺序固定，不可随意改动） ---------- */
  const VIEWS = [
    { id: 'home', name: '首页', icon: 'fa-house' },
    { id: 'money', name: '记账', icon: 'fa-wallet' },
    { id: 'life', name: '运动三餐', icon: 'fa-utensils' },
    { id: 'todo', name: '日程待办', icon: 'fa-list-check' },
    { id: 'period', name: '经期', icon: 'fa-droplet' },
    { id: 'lang', name: '外语学习', icon: 'fa-language' },
    { id: 'study', name: '专业学习', icon: 'fa-calculator' },
    { id: 'news', name: '时政', icon: 'fa-newspaper' },
    { id: 'settings', name: '设置', icon: 'fa-gear' }
  ];

  /* ---------- 小工具 ---------- */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const yen = (n) => '¥' + num(n).toFixed(2);
  const dayIdx = () => { const d = new Date(); return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); };
  const last7 = () => { const a = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); a.push(dateStr(d)); } return a; };
  const lastN = (n) => { const a = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); a.push(dateStr(d)); } return a; };
  const monthKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };
  const weekday = () => ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][new Date().getDay()];

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); toast('已复制'); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('已复制'); } catch (e2) { toast('复制失败'); }
      ta.remove();
    }
  }

  function donutSvg(rows, total) {
    const R = 62, C = 2 * Math.PI * R;
    let acc = 0;
    let out = '';
    rows.forEach((r) => {
      const len = total > 0 ? (r.val / total) * C : 0;
      out += `<circle cx="78" cy="78" r="${R}" fill="none" stroke="${r.color}" stroke-width="22"
        stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}"
        stroke-dashoffset="${(-acc).toFixed(2)}"></circle>`;
      acc += len;
    });
    return `<svg viewBox="0 0 156 156">${out}</svg>`;
  }
  function barsHtml(labels, values, unit) {
    const max = Math.max(1, ...values);
    return `<div class="bars">${labels.map((l, i) => `
      <div class="b">
        <div class="vl">${values[i] ? values[i] : ''}</div>
        <div class="fill" style="height:${(values[i] / max * 100).toFixed(1)}%"></div>
        <div class="lb">${l}</div>
      </div>`).join('')}</div>`;
  }

  /* ---------- 每日轮换：同一天顺序固定，隔天自动刷新 ---------- */
  function rotateDaily(arr) {
    const off = dayIdx() % arr.length;
    return arr.slice(off).concat(arr.slice(0, off));
  }
  const dailyWords = () => rotateDaily(APP.WORDS);
  const dailyPatterns = () => rotateDaily(APP.ESSAY_PATTERNS);

  /* ---------- 通用分页（每页条数可选） ---------- */
  const PAGE_SIZES = [5, 10, 15, 20, 30];
  const pageState = {
    fav: { page: 1, size: 5 }, exp: { page: 1, size: 10 }, work: { page: 1, size: 10 },
    study: { page: 1, size: 10 }, period: { page: 1, size: 10 },
    exam: { page: 1, size: 10 }, news: { page: 1, size: 10 }, pat: { page: 1, size: 5 }
  };
  function pageOf(key, list) {
    const st = pageState[key] || (pageState[key] = { page: 1, size: 10 });
    const pages = Math.max(1, Math.ceil(list.length / st.size));
    if (st.page > pages) st.page = pages;
    if (st.page < 1) st.page = 1;
    return {
      slice: list.slice((st.page - 1) * st.size, st.page * st.size),
      pages, page: st.page, total: list.length, size: st.size
    };
  }
  function pagerHtml(key, total) {
    const st = pageState[key];
    const pages = Math.max(1, Math.ceil(total / st.size));
    const opts = PAGE_SIZES.map((n) => `<option value="${n}" ${n === st.size ? 'selected' : ''}>每页 ${n} 条</option>`).join('');
    return `<select class="pg-size" data-pgsize="${key}">${opts}</select>
      <button class="ibtn" data-pgpage="prev" data-pgkey="${key}" ${st.page <= 1 ? 'disabled style="opacity:.4"' : ''} title="上一页"><i class="fa-solid fa-chevron-left"></i></button>
      <span style="font-size:12px;color:var(--muted)">第 ${st.page} / ${pages} 页 · 共 ${total} 条</span>
      <button class="ibtn" data-pgpage="next" data-pgkey="${key}" ${st.page >= pages ? 'disabled style="opacity:.4"' : ''} title="下一页"><i class="fa-solid fa-chevron-right"></i></button>`;
  }
  function pagerInto(sel, key, total) {
    const el = $(sel);
    if (!el) return;
    el.innerHTML = pagerHtml(key, total);
    el.style.display = total > 0 ? '' : 'none';
  }
  function rerenderList(key) {
    if (key === 'fav') renderLang();
    else if (key === 'exp') renderMoney();
    else if (key === 'work') renderLife();
    else if (key === 'study') renderStudy();
    else if (key === 'period') renderPeriod();
    else if (key === 'exam') renderStudy();
    else if (key === 'news') renderNews();
    else if (key === 'pat') renderLang();
  }

  /* ---------- 月度堆叠柱状图：柱子内部按分类占比着色 ---------- */
  function monthStackHtml(months, dense) {
    const max = Math.max(1, ...months.map((m) => m.total));
    return `<div class="bars stack" style="height:${dense ? 132 : 118}px">${months.map((m) => `
      <div class="b">
        <div class="vl">${m.total ? m.total.toFixed(0) : ''}</div>
        <div class="fill stackcol" style="height:${(m.total / max * 100).toFixed(1)}%">
          ${m.parts.map((p) => `<i style="background:${p.color};height:${(p.val / m.total * 100).toFixed(2)}%" title="${esc(p.name)} ${p.val.toFixed(0)} 元"></i>`).join('')}
        </div>
        <div class="lb" style="${dense ? 'font-size:9px;transform:rotate(-30deg)' : ''}">${m.label}</div>
      </div>`).join('')}</div>`;
  }
  function lineChartSvg(labels, values, color, unit) {
    const W = 640, H = 190, P = { l: 34, r: 12, t: 16, b: 26 };
    const max = Math.max(1, ...values);
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const n = values.length;
    const x = (i) => P.l + (n <= 1 ? iw / 2 : i * iw / (n - 1));
    const y = (v) => P.t + ih - (v / max) * ih;
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const gid = 'lg' + Math.random().toString(36).slice(2, 7);
    // 横向网格线（0 / 1/2 / max）
    let grid = '';
    [0, .5, 1].forEach((f) => {
      const gy = (P.t + ih - f * ih).toFixed(1);
      grid += `<line x1="${P.l}" y1="${gy}" x2="${W - P.r}" y2="${gy}" stroke="var(--line)" stroke-width="1" stroke-dasharray="${f ? '3 4' : ''}"/>
        <text x="${P.l - 6}" y="${+gy + 3.5}" text-anchor="end" font-size="9.5" fill="var(--muted)">${Math.round(max * f)}</text>`;
    });
    // X 轴标签：最多 8 个
    const step = Math.max(1, Math.ceil(n / 8));
    let xl = '';
    labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) xl += `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(String(l))}</text>`; });
    let dots = '';
    values.forEach((v, i) => { if (v > 0) dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${color}" stroke="var(--surface)" stroke-width="1.5"/>`; });
    const peak = Math.max(...values);
    const pi = values.indexOf(peak);
    const peakTxt = peak > 0 ? `<text x="${Math.min(Math.max(x(pi), P.l + 22), W - P.r - 22).toFixed(1)}" y="${(y(peak) - 8).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="${color}">${peak}${unit || ''}</text>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".22"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <polygon points="${P.l},${P.t + ih} ${pts} ${W - P.r},${P.t + ih}" fill="url(#${gid})"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${xl}${peakTxt}
    </svg>`;
  }

  /* ==========================================================================
     视图切换
     ========================================================================== */
  function go(view) {
    if (!VIEWS.some((v) => v.id === view)) view = 'home';
    currentView = view;
    $$('.view').forEach((el) => el.classList.add('hidden'));
    const t = $('#view-' + view);
    if (t) { t.classList.remove('hidden'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; }
    $$('[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === view));
    const m = VIEWS.find((v) => v.id === view);
    $('#topbarTitle').textContent = m ? m.name : '';
    $('#topbarSub').textContent = `${new Date().getFullYear()}年${new Date().getMonth() + 1}月${new Date().getDate()}日 · ${weekday()}`;
    $('#viewport').scrollTop = 0;
    // 底部导航自动把当前项滚进可视区
    const bn = document.querySelector(`.bottom-nav [data-nav="${view}"]`);
    if (bn && bn.scrollIntoView) bn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    render(view);
  }
  APP.go = go;

  function render(view) {
    if (view === 'home') renderHome();
    else if (view === 'money') renderMoney();
    else if (view === 'life') renderLife();
    else if (view === 'todo') renderTodo();
    else if (view === 'period') renderPeriod();
    else if (view === 'lang') renderLang();
    else if (view === 'study') renderStudy();
    else if (view === 'news') renderNews();
    else if (view === 'settings') renderSettings();
  }
  APP.render = render;

  /* ==========================================================================
     1. 首页（数据汇总面板）
     ========================================================================== */
  function greetWord() {
    const h = new Date().getHours();
    if (h < 5) return '夜深了';
    if (h < 11) return '早上好';
    if (h < 13) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  function pickQuote(force) {
    const st = Store.data.quoteState;
    const list = APP.MOTIVATIONS;
    if (st.date !== today()) { st.date = today(); st.used = []; }
    if (!Array.isArray(st.used)) st.used = [];
    if (st.used.length >= list.length) st.used = [];
    let pool = list.map((_, i) => i).filter((i) => !st.used.includes(i));
    if (!pool.length) pool = list.map((_, i) => i);
    let idx = pool[Math.floor(Math.random() * pool.length)];
    if (force && pool.length > 1 && idx === st.lastIdx) {
      pool = pool.filter((i) => i !== idx);
      idx = pool[Math.floor(Math.random() * pool.length)];
    }
    st.used.push(idx); st.lastIdx = idx;
    Store.save();
    return list[idx];
  }

  /** 待办是否「今天已完成」（日常任务用最近打卡日期判断，天然实现次日自动重置） */
  function todoDone(t) { return t.type === 'daily' ? t.lastDone === today() : !!t.done; }

  function refreshHome() {
    const d = Store.data;
    $('#greet').textContent = greetWord();
    $('#heroDate').textContent = `${new Date().getFullYear()}年${new Date().getMonth() + 1}月${new Date().getDate()}日 ${weekday()}`;
    if (!$('#quote').dataset.filled) { $('#quote').textContent = pickQuote(false); $('#quote').dataset.filled = '1'; }

    // 今日待办
    const list = todoVisibleToday();
    const done = list.filter(todoDone).length;
    const pct = list.length ? Math.round(done / list.length * 100) : 0;
    $('#sTodo').innerHTML = `${done}<small>/ ${list.length}</small>`;
    $('#sTodoBar').style.width = pct + '%';
    $('#sTodoNote').textContent = list.length ? (pct === 100 ? '今天全部完成' : `完成度 ${pct}%`) : '暂无待办';

    // 今日支出
    const spend = d.expenses.filter((e) => e.date === today()).reduce((a, b) => a + num(b.amount), 0);
    $('#sSpend').innerHTML = `${spend.toFixed(0)}<small>元</small>`;
    const monthTotal = d.expenses.filter((e) => (e.date || '').startsWith(monthKey())).reduce((a, b) => a + num(b.amount), 0);
    $('#sSpendNote').textContent = `本月 ${yen(monthTotal)}`;

    // 今日学习
    const min = d.studyLogs.filter((s) => s.date === today()).reduce((a, b) => a + num(b.minutes), 0);
    $('#sStudy').innerHTML = `${min}<small>分钟</small>`;
    $('#sStudyNote').textContent = `累计 ${d.studyLogs.reduce((a, b) => a + num(b.minutes), 0)} 分钟`;

    // 外语学习（金句无需打卡，展示今日背单词量）
    const ws = d.wordState || {};
    const learned = ws.date === today() ? (ws.known || 0) + (ws.unknown || 0) : 0;
    $('#sLang').innerHTML = `${learned}<small>个</small>`;
    $('#sLangNote').textContent = `今日背单词 · 收藏 ${d.favorites.length} 条`;

    // 今日运动
    const ex = d.workouts.filter((w) => w.date === today()).reduce((a, b) => a + num(b.minutes), 0);
    $('#sSport').innerHTML = `${ex}<small>分钟</small>`;
    const mealsToday = d.meals.filter((m) => m.date === today()).length;
    $('#sSportNote').textContent = `已记录 ${mealsToday}/3 餐`;

    // 经期
    const p = periodStat();
    const pw = $('#sPeriodWrap');
    if (p.hasData) {
      $('#sPeriod').innerHTML = `${Math.max(p.left, 0)}<small>天</small>`;
      $('#sPeriodNote').textContent = p.left >= 0 ? `预计 ${p.next} 前后` : '已超过预测日期';
      // 预测前一天 → 标红提示；过了预测前一天就恢复
      const remind = p.left === 1;
      if (pw) pw.classList.toggle('period-soon', remind);
      if (remind) {
        $('#sPeriodNote').innerHTML = '<b style="color:#E05B5B">就在明天，记得备好卫生用品</b>';
      }
    } else {
      $('#sPeriod').innerHTML = '—';
      $('#sPeriodNote').textContent = '未录入周期';
      if (pw) pw.classList.remove('period-soon');
    }

    renderExamAlert();
  }
  window.refreshHome = refreshHome;

  /**
   * 考试临近提醒：考前 3 天起在首页浮出一块提醒（3 / 2 / 1 / 0 天都会提示）。
   *   3 天 —— 开始预告，提醒进入最后冲刺
   *   2 天 —— 提醒再过一遍重点
   *   1 天 —— 提醒准备证件、文具、早睡
   *   0 天 —— 今天就是考试日，红调呼吸提示
   * 取「最近的一场未过期考试」；没有考试、或距考试还有 4 天以上时不显示。
   */
  function examRemindText(left, name) {
    if (left === 3) return `还有 3 天就考「${name}」了，该收尾的章节收一收，别开新的了。`;
    if (left === 2) return `只剩 2 天。这两天别硬啃新知识，把错题和重点再过一遍最划算。`;
    if (left === 1) return `明天就考「${name}」了。今天早点睡，准考证、身份证、文具先放进包里。`;
    return `今天就是「${name}」的考试日。深呼吸，你已经准备得比你以为的更充分。`;
  }
  function renderExamAlert() {
    const box = $('#examAlert');
    if (!box) return;
    const list = (Store.data.exams || []).slice()
      .map((e) => ({ e, left: daysBetween(today(), e.date) }))
      .filter((x) => x.left >= 0)
      .sort((a, b) => a.left - b.left);
    const hit = list.find((x) => x.left >= 0 && x.left <= 3);
    if (!hit) { box.hidden = true; return; }
    const { e, left } = hit;
    box.hidden = false;
    box.classList.toggle('today', left === 0);
    $('#examAlertTitle').innerHTML = left === 0
      ? '<i class="fa-solid fa-flag-checkered"></i> 今天就是考试日'
      : `<i class="fa-solid fa-hourglass-half"></i> 考试倒计时 · ${esc(e.name)}`;
    $('#examAlertSub').textContent = examRemindText(left, e.name);
    $('#examAlertDays').innerHTML = left === 0
      ? '<b>今天</b><span>加油</span>'
      : `<b>${left}</b><span>天后考试</span>`;
  }

  function renderHome() { refreshHome(); renderWeather(); }

  /** 预测经期前一天进入时，弹一次提醒（同一天只弹一次） */
  function maybePeriodReminder() {
    const p = periodStat();
    if (!p.hasData || p.left !== 1) return;
    const todayKey = today();
    if (Store.data.settings.periodRemindOn === todayKey) return;   // 今天已提醒过
    Store.edit(() => { Store.data.settings.periodRemindOn = todayKey; });
    openNotice(
      '小提醒 · 经期快到了',
      `根据你的记录，预计明天（${p.next}）会来经期。今天记得：① 提前备好卫生用品；② 少喝冰的，多喝温水；③ 早点休息，别熬夜；④ 注意保暖，别让腰腹受凉。`,
      '—— 小可欣儿留',
      { okText: '好的，记住啦' }
    );
  }

  /* ---------- 当地天气（Open-Meteo，免密钥） ---------- */
  const WX_KEY = 'morandi_wx_v1';
  const WX_DEFAULT = { lat: 39.9042, lon: 116.4074, name: '北京' };  // 定位失败时的兜底

  function wxTipKey(t) {
    if (t >= 35) return 'hot';
    if (t >= 28) return 'warm';
    if (t >= 22) return 'mild';
    if (t >= 15) return 'cool';
    if (t >= 8) return 'cold';
    if (t >= 0) return 'chilly';
    return 'freezing';
  }
  function wxInfo(code) {
    return APP.WEATHER_CODES[code] || { t: '未知', i: 'fa-cloud' };
  }

  /** 让浏览器按定位获取经纬度（失败则用兜底城市） */
  function locate() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(WX_DEFAULT);
      const done = (v) => resolve(v);
      const timer = setTimeout(() => done(WX_DEFAULT), 6000);
      navigator.geolocation.getCurrentPosition(
        (p) => { clearTimeout(timer); done({ lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4), name: '我的位置' }); },
        () => { clearTimeout(timer); done(WX_DEFAULT); },
        { timeout: 6000, maximumAge: 600000 }
      );
    });
  }

  function wxCacheGet() {
    try { return JSON.parse(localStorage.getItem(WX_KEY) || 'null'); } catch (e) { return null; }
  }
  function wxCacheSet(v) {
    try { localStorage.setItem(WX_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }

  function renderWeatherBody(cur, daily, place) {
    const info = wxInfo(cur.weather_code);
    const tips = APP.WEATHER_TIPS[wxTipKey(cur.temp)] || APP.WEATHER_TIPS.mild;
    const rain = (daily.precipitation_probability_max || [])[0] || 0;
    const extra = [];
    if (rain >= 40 && !/雨|雪|雷/.test(info.t)) extra.push('今天可能下雨，记得带伞');
    if (cur.wind >= 25) extra.push('风有点大，注意防风');
    if (cur.humidity <= 30) extra.push('空气偏干，多补水、涂点护手霜');

    $('#weatherLoc').textContent = place;
    $('#weatherBody').innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:12px">
          <i class="fa-solid ${info.i}" style="font-size:38px;color:var(--accent)"></i>
          <div>
            <div style="font-size:30px;font-weight:600;color:var(--ink);line-height:1.1">${Math.round(cur.temp)}<small style="font-size:15px">°C</small></div>
            <div style="font-size:12.5px;color:var(--muted);margin-top:3px">${info.t} · 体感 ${Math.round(cur.feels)}°</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;font-size:12.5px;color:var(--ink-2)">
          <span><i class="fa-solid fa-temperature-half" style="color:var(--muted);width:16px"></i>今日 ${Math.round(daily.min[0])}° ~ ${Math.round(daily.max[0])}°</span>
          <span><i class="fa-solid fa-umbrella" style="color:var(--muted);width:16px"></i>降水概率 ${rain}%</span>
          <span><i class="fa-solid fa-wind" style="color:var(--muted);width:16px"></i>风速 ${Math.round(cur.wind)} km/h · 湿度 ${cur.humidity}%</span>
        </div>
      </div>
      <div style="margin-top:14px;padding:12px 14px;border-radius:var(--r);background:var(--bg-2);border:1px solid var(--line)">
        <div style="font-size:13px;color:var(--ink-2);line-height:1.8">
          <div><i class="fa-solid fa-shirt" style="color:var(--accent);margin-right:6px"></i><b>穿：</b>${tips.wear}</div>
          <div style="margin-top:4px"><i class="fa-solid fa-bag-shopping" style="color:var(--accent);margin-right:6px"></i><b>带：</b>${tips.bring}</div>
          ${extra.map((e) => `<div style="margin-top:4px"><i class="fa-solid fa-circle-info" style="color:var(--accent);margin-right:6px"></i>${e}</div>`).join('')}
        </div>
      </div>
      <div style="font-size:11.5px;color:var(--muted);text-align:right;margin-top:8px">更新于 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>`;
  }

  async function renderWeather(force) {
    const body = $('#weatherBody');
    if (!body) return;
    // 10 分钟内优先用缓存，避免频繁请求
    const cache = wxCacheGet();
    if (!force && cache && Date.now() - cache.at < 600000) {
      renderWeatherBody(cache.cur, cache.daily, cache.place);
      return;
    }
    try {
      const loc = await locate();
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}`
        + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m'
        + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
        + '&timezone=auto&forecast_days=3';
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const cur = {
        temp: j.current.temperature_2m, feels: j.current.apparent_temperature,
        weather_code: j.current.weather_code, wind: j.current.wind_speed_10m,
        humidity: j.current.relative_humidity_2m
      };
      const dly = j.daily;
      const daily = {
        max: dly.temperature_2m_max, min: dly.temperature_2m_min,
        code: dly.weather_code, precipitation_probability_max: dly.precipitation_probability_max
      };
      const place = loc.name;
      wxCacheSet({ at: Date.now(), cur, daily, place });
      renderWeatherBody(cur, daily, place);
    } catch (e) {
      // 网络/接口异常 → 优雅降级
      if (cache) { renderWeatherBody(cache.cur, cache.daily, cache.place + '（离线缓存）'); return; }
      $('#weatherLoc').textContent = '暂时获取不到';
      body.innerHTML = `<div class="empty" style="padding:14px">
        <i class="fa-solid fa-cloud-question"></i> 天气获取失败，检查网络后点右上角刷新
      </div>`;
    }
  }

  /* ==========================================================================
     2. 记账
     ========================================================================== */
  let moneyRange = 6;     // 消费构成柱状图区间（月）
  let yearOpen = false;   // 年度消费历史默认收起

  function renderMoney() {
    const d = Store.data;
    const list = d.expenses.filter((e) => (e.date || '').startsWith(monthKey()));
    const total = list.reduce((a, b) => a + num(b.amount), 0);
    $('#monthTotal').textContent = yen(total);
    $('#monthLabel').textContent = `${new Date().getFullYear()}年${new Date().getMonth() + 1}月`;

    const byCat = {};
    list.forEach((e) => { const k = e.category || '其他'; byCat[k] = (byCat[k] || 0) + num(e.amount); });
    const rows = APP.EXPENSE_CATS.map((c) => ({ name: c.name, color: c.color, val: byCat[c.name] || 0 }))
      .filter((r) => r.val > 0).sort((a, b) => b.val - a.val);

    $('#donut').innerHTML = rows.length
      ? donutSvg(rows, total) + `<div class="hub"><b>${total.toFixed(0)}</b><span>元 / 本月</span></div>`
      : `<div class="empty" style="padding:0"><i class="fa-solid fa-chart-pie"></i>本月暂无记录</div>`;

    $('#legend').innerHTML = rows.length
      ? rows.map((r) => {
        const pc = total ? r.val / total * 100 : 0;
        return `<div class="lg-row">
          <span class="dot" style="background:${r.color}"></span>
          <span class="nm">${r.name}</span>
          <span class="track"><i style="width:${pc.toFixed(1)}%;background:${r.color}"></i></span>
          <span class="vl">${r.val.toFixed(0)}</span>
          <span class="pc">${pc.toFixed(0)}%</span>
        </div>`;
      }).join('')
      : '';

    const sorted = list.slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
    const pg = pageOf('exp', sorted);
    $('#expList').innerHTML = pg.total
      ? pg.slice.map((e) => {
        const c = APP.EXPENSE_CATS.find((x) => x.name === e.category);
        return `<div class="item">
          <span class="dot" style="background:${c ? c.color : '#A9A9A4'};width:10px;height:10px;border-radius:3px;flex:0 0 auto"></span>
          <div class="grow">
            <div class="m">${esc(e.note || e.category)}</div>
            <div class="s">${esc(e.date)} · ${esc(e.category)}</div>
          </div>
          <b style="font-weight:600;color:var(--c-blue-deep)">${esc(num(e.amount).toFixed(2))}</b>
          <div class="acts">
            <button class="ibtn" data-edit-exp="${e.id}" title="编辑"><i class="fa-solid fa-pen"></i></button>
            <button class="ibtn" data-del-exp="${e.id}" title="删除"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`;
      }).join('')
      : `<div class="empty"><i class="fa-solid fa-receipt"></i>本月暂无记录</div>`;
    pagerInto('#expPager', 'exp', pg.total);

    // 区间消费柱状图：每根柱子按分类占比堆叠
    const now = new Date();
    const span = moneyRange || 6;
    const months = [];
    for (let i = span - 1; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const rows = d.expenses.filter((e) => (e.date || '').startsWith(key));
      const total = rows.reduce((a, b) => a + num(b.amount), 0);
      const parts = APP.EXPENSE_CATS.map((c) => ({
        name: c.name, color: c.color,
        val: rows.filter((e) => (e.category || '其他') === c.name).reduce((a, b) => a + num(b.amount), 0)
      })).filter((p) => p.val > 0);
      months.push({ label: key.slice(2, 4) + '/' + key.slice(5), total, parts });
    }
    $('#monthBars').innerHTML = monthStackHtml(months, span > 9);
    $('#monthBarsLabel').textContent = months.length ? `${months[0].label} ~ ${months[months.length - 1].label} · 共 ${months.length} 个月` : '';
    $$('#view-money [data-mrange]').forEach((b) => b.classList.toggle('on', +b.dataset.mrange === span));
    const usedCats = APP.EXPENSE_CATS.filter((c) => months.some((m) => m.parts.some((p) => p.name === c.name)));
    $('#monthBarsLegend').innerHTML = usedCats.map((c) => `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted)">
      <i style="width:9px;height:9px;border-radius:3px;background:${c.color};display:inline-block"></i>${c.name}</span>`).join('');

    // 年度消费历史：默认收起，点击展开
    $('#yearFold').innerHTML = `${yearOpen ? '收起' : '展开'}年度消费历史 <i class="fa-solid fa-chevron-${yearOpen ? 'up' : 'down'}"></i>`;
    $('#yearWrap').classList.toggle('hidden', !yearOpen);
    if (yearOpen) renderYearHistory();

    // 每日消费折线图（本月 1 号至今）
    const dim = now.getDate();   // 只画到今天
    const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dayTotals = [], dayLabels = [];
    for (let i = 1; i <= dim; i++) {
      const ds = `${mk}-${String(i).padStart(2, '0')}`;
      dayTotals.push(d.expenses.filter((e) => e.date === ds).reduce((a, b) => a + num(b.amount), 0));
      dayLabels.push(i);
    }
    $('#moneyLine').innerHTML = lineChartSvg(dayLabels, dayTotals, 'var(--c-blue)', '元');
  }

  /* 年度消费历史：默认收起；展开后按月柱状（分类占比）+ 全年折线 */
  function renderYearHistory() {
    const d = Store.data;
    const years = [...new Set(d.expenses.map((e) => (e.date || '').slice(0, 4)).filter(Boolean))].sort();
    const curY = String(new Date().getFullYear());
    if (!years.includes(curY)) years.push(curY);
    const sel = $('#yearPick');
    const keep = sel.value;
    sel.innerHTML = years.slice().reverse().map((y) => `<option value="${y}">${y} 年</option>`).join('');
    sel.value = years.includes(keep) ? keep : curY;
    const y = sel.value || curY;

    const months = [];
    for (let m = 0; m < 12; m++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const rows = d.expenses.filter((e) => (e.date || '').startsWith(key));
      const total = rows.reduce((a, b) => a + num(b.amount), 0);
      const parts = APP.EXPENSE_CATS.map((c) => ({
        name: c.name, color: c.color,
        val: rows.filter((e) => (e.category || '其他') === c.name).reduce((a, b) => a + num(b.amount), 0)
      })).filter((p) => p.val > 0);
      months.push({ label: (m + 1) + '月', total, parts });
    }
    $('#yearChart').innerHTML = monthStackHtml(months);
    const usedCats = APP.EXPENSE_CATS.filter((c) => months.some((m) => m.parts.some((p) => p.name === c.name)));
    $('#yearLegend').innerHTML = usedCats.map((c) => `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted)">
      <i style="width:9px;height:9px;border-radius:3px;background:${c.color};display:inline-block"></i>${c.name}</span>`).join('');

    // 每年消费折线：从 2026 年起，可自由选择起止年份
    const START_Y = 2026;
    const lastY = Math.max(+curY, START_Y);
    const allYears = [];
    for (let yy = START_Y; yy <= lastY; yy++) allYears.push(String(yy));
    const yrOpts = allYears.map((yy) => `<option value="${yy}">${yy} 年</option>`).join('');
    const fSel = $('#yearFrom'), tSel = $('#yearTo');
    const fKeep = fSel.value, tKeep = tSel.value;
    fSel.innerHTML = yrOpts; tSel.innerHTML = yrOpts;
    fSel.value = allYears.includes(fKeep) ? fKeep : allYears[0];
    tSel.value = allYears.includes(tKeep) ? tKeep : allYears[allYears.length - 1];
    let fy = +fSel.value, ty = +tSel.value;
    if (fy > ty) { const tmp = fy; fy = ty; ty = tmp; fSel.value = fy; tSel.value = ty; }

    const cmpYears = [];
    for (let yy = fy; yy <= ty; yy++) cmpYears.push(String(yy));
    const cmpVals = cmpYears.map((yy) =>
      d.expenses.filter((e) => (e.date || '').startsWith(yy)).reduce((a, b) => a + num(b.amount), 0)
    );
    $('#yearLineLabel').textContent = `${fy} ~ ${ty} 年 · 共 ${cmpYears.length} 年`;
    $('#yearLine').innerHTML = cmpYears.length > 1
      ? lineChartSvg(cmpYears.map((yy) => yy + ' 年'), cmpVals, 'var(--c-blue)', '元')
      : `<div class="empty" style="padding:14px">选择 2 个及以上年份就能看到折线啦 🌱</div>`;
  }

  function addExpense() {
    const amount = num($('#expAmount').value);
    if (amount <= 0) return toast('请输入金额');
    const rec = {
      id: uid(), date: $('#expDate').value || today(),
      amount, category: $('#expCat').value, note: $('#expNote').value.trim()
    };
    Store.edit((d) => d.expenses.push(rec));
    $('#expAmount').value = ''; $('#expNote').value = '';
    renderMoney(); refreshHome();
    toast('已记录 ' + yen(amount));
  }

  /* ==========================================================================
     3. 运动三餐
     ========================================================================== */
  function renderLife() {
    const d = Store.data;
    const t = today();

    // 今日三餐
    $('#mealSlots').innerHTML = APP.MEALS.map((m) => {
      const rec = d.meals.find((x) => x.date === t && x.meal === m);
      return `<div class="item" style="align-items:flex-start">
        <span class="tag ${m === '早餐' ? 'sand' : m === '午餐' ? 'sage' : m === '晚餐' ? 'lilac' : 'pink'}">${m}</span>
        <div class="grow">
          <div class="m">${rec ? esc(rec.content) : '<span style="color:var(--muted);font-weight:400">未记录</span>'}</div>
          ${rec && rec.note ? `<div class="s">${esc(rec.note)}</div>` : ''}
        </div>
        <div class="acts">
          ${rec ? `<button class="ibtn" data-edit-meal="${rec.id}" title="编辑"><i class="fa-solid fa-pen"></i></button>
          <button class="ibtn" data-del-meal="${rec.id}" title="删除"><i class="fa-solid fa-trash-can"></i></button>` : ''}
        </div>
      </div>`;
    }).join('');

    // 今日运动
    const todayWork = d.workouts.filter((w) => w.date === t);
    const todayMin = todayWork.reduce((a, b) => a + num(b.minutes), 0);
    $('#todaySport').innerHTML = `${todayMin}<small>分钟</small>`;
    $('#todaySportNote').textContent = todayWork.length ? `${todayWork.length} 次记录` : '今天还没运动';

    const days = last7();
    const vals = days.map((x) => d.workouts.filter((w) => w.date === x).reduce((a, b) => a + num(b.minutes), 0));
    $('#sportBars').innerHTML = barsHtml(days.map((x) => x.slice(5)), vals);

    const recs = d.workouts.slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
    const wpg = pageOf('work', recs);
    $('#sportList').innerHTML = wpg.total
      ? wpg.slice.map((w) => `<div class="item">
          <div class="grow"><div class="m">${esc(w.type)}</div><div class="s">${esc(w.date)} · ${esc(String(w.minutes))} 分钟${w.note ? ' · ' + esc(w.note) : ''}</div></div>
          <div class="acts">
            <button class="ibtn" data-edit-work="${w.id}" title="编辑"><i class="fa-solid fa-pen"></i></button>
            <button class="ibtn" data-del-work="${w.id}" title="删除"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`).join('')
      : `<div class="empty"><i class="fa-solid fa-person-running"></i>暂无运动记录</div>`;
    pagerInto('#workPager', 'work', wpg.total);

    // 折线图默认区间：近 1 周
    if (!$('#sportFrom').value) { const d0 = new Date(); d0.setDate(d0.getDate() - 6); $('#sportFrom').value = dateStr(d0); }
    if (!$('#sportTo').value) $('#sportTo').value = today();
    renderSportChart();
  }

  /* 运动时间折线图：可自选起止日期，图下附随机鼓励语 */
  function renderSportChart() {
    const d = Store.data;
    const from = $('#sportFrom').value, to = $('#sportTo').value;
    if (!from || !to || from > to) { $('#sportChart').innerHTML = `<div class="empty"><i class="fa-solid fa-chart-line"></i>请选择有效的起止日期</div>`; return; }
    const list = [];
    const end = new Date(to + 'T00:00:00');
    for (let cur = new Date(from + 'T00:00:00'); cur <= end; cur.setDate(cur.getDate() + 1)) {
      list.push(dateStr(cur));
      if (list.length > 92) break;   // 最多约 3 个月
    }
    const vals = list.map((x) => d.workouts.filter((w) => w.date === x).reduce((a, b) => a + num(b.minutes), 0));
    const total = vals.reduce((a, b) => a + b, 0);
    const active = vals.filter((v) => v > 0).length;
    $('#sportChart').innerHTML = lineChartSvg(list.map((x) => x.slice(5)), vals, 'var(--accent)', '分');
    if ($('#sportRangeLabel')) $('#sportRangeLabel').textContent = `${list[0].slice(5)} ~ ${list[list.length - 1].slice(5)} · 共 ${list.length} 天`;
    $$('#view-life [data-sportrange]').forEach((b) => b.classList.toggle('on', list.length === +b.dataset.sportrange));
    const cheer = APP.SPORT_CHEERS[Math.floor(Math.random() * APP.SPORT_CHEERS.length)];
    $('#sportEncourage').textContent = total > 0
      ? `这段时间共运动 ${total} 分钟 · 有 ${active} 天在动 · ${cheer}`
      : `这段时间还没有运动记录，从今天开始，哪怕 10 分钟也好 · ${cheer}`;
  }

  function addMeal() {
    const content = $('#mealContent').value.trim();
    if (!content) return toast('请输入饮食内容');
    const rec = { id: uid(), date: $('#mealDate').value || today(), meal: $('#mealType').value, content, note: $('#mealNote').value.trim() };
    // 同一天同一餐只保留一条
    Store.edit((d) => {
      d.meals = d.meals.filter((m) => !(m.date === rec.date && m.meal === rec.meal));
      d.meals.push(rec);
    });
    $('#mealContent').value = ''; $('#mealNote').value = '';
    renderLife(); refreshHome();
    toast('已记录' + rec.meal);
  }

  function addWorkout() {
    const minutes = parseInt($('#workMinutes').value, 10);
    if (!minutes || minutes <= 0) return toast('请输入运动时长');
    Store.edit((d) => d.workouts.push({
      id: uid(), date: $('#workDate').value || today(),
      type: $('#workType').value, minutes, note: $('#workNote').value.trim()
    }));
    $('#workMinutes').value = ''; $('#workNote').value = '';
    renderLife(); refreshHome();
    toast('运动打卡成功');
    // 备注旁原地浮现鼓励语（务实 / 情绪价值 / 俏皮随机一条），不弹窗
    const cheers = APP.WORKOUT_CHEERS || [];
    if (cheers.length) cheer($('#workCheer'), cheers[Math.floor(Math.random() * cheers.length)], 4200, { speed: 55 });
  }

  /* ==========================================================================
     4. 日程待办
     ========================================================================== */
  const TODO_TYPES = [
    { id: 'daily', name: '日常任务', tag: 'sage' },
    { id: 'today', name: '当日任务', tag: 'pink' },
    { id: 'long', name: '长期任务', tag: 'lilac' }
  ];
  const PRIOS = [{ id: 'high', name: '高' }, { id: 'mid', name: '中' }, { id: 'low', name: '低' }];
  const PRIO_W = { high: 0, mid: 1, low: 2 };
  const typeName = (id) => (TODO_TYPES.find((t) => t.id === id) || TODO_TYPES[1]).name;
  const typeTag = (id) => (TODO_TYPES.find((t) => t.id === id) || TODO_TYPES[1]).tag;

  let todoTab = 'all';

  /** 需要在首页/悬浮窗里看到的「今日清单」：日常任务 + 当日任务 */
  function todoVisibleToday() {
    return Store.data.todos.filter((t) => t.type !== 'long' || t.pinned);
  }

  function sortedTodos(filter) {
    const arr = Store.data.todos.filter((t) => !filter || filter === 'all' || t.type === filter);
    return arr.sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      const pa = PRIO_W[a.priority] == null ? 1 : PRIO_W[a.priority];
      const pb = PRIO_W[b.priority] == null ? 1 : PRIO_W[b.priority];
      if (pa !== pb) return pa - pb;
      return (a.order || 0) - (b.order || 0);
    });
  }

  /** 每日重置：当日任务在跨天后恢复未完成（可在设置里关） */
  function dailyTodoReset() {
    const d = Store.data;
    const t = today();
    if (d.lastTodoReset === t) return;
    Store.edit((dd) => {
      if (dd.settings.todoDailyReset) dd.todos.forEach((x) => { if (x.type === 'today') x.done = false; });
      dd.lastTodoReset = t;
    });
  }
  APP.dailyTodoReset = dailyTodoReset;

  function renderTodo() {
    const d = Store.data;
    $('#resetToggle').checked = !!d.settings.todoDailyReset;
    const counts = { all: d.todos.length, daily: 0, today: 0, long: 0 };
    d.todos.forEach((t) => { counts[t.type] = (counts[t.type] || 0) + 1; });

    $$('#todoTabs button').forEach((b) => {
      const k = b.dataset.tab;
      b.classList.toggle('on', k === todoTab);
      const n = b.querySelector('.n');
      if (n) n.textContent = counts[k] || 0;
    });

    const list = sortedTodos(todoTab);
    const box = $('#todoList');
    if (!list.length) {
      box.innerHTML = `<div class="empty"><i class="fa-regular fa-circle-check"></i>暂无任务</div>`;
    } else {
      box.innerHTML = list.map((t) => todoCardHtml(t)).join('');
    }
    renderFabList();
  }

  function todoCardHtml(t) {
    const done = todoDone(t);
    const isLong = t.type === 'long';
    const hist = lastN(21).map((x) => `<i class="${(t.history || []).includes(x) ? 'on' : ''}"></i>`).join('');
    return `<div class="todo-card ${t.pinned ? 'pinned' : ''} ${done ? 'done' : ''}" data-id="${t.id}">
      <button class="chk ${done ? 'on' : ''} ${t.type === 'daily' ? 'pink' : ''}" data-check="${t.id}">
        <i class="fa-solid fa-check"></i>
      </button>
      <div class="body">
        <div class="title">${esc(t.text)}</div>
        <div class="meta">
          <span class="prio ${t.priority || 'mid'}"></span>
          <span class="tag ${typeTag(t.type)}">${typeName(t.type)}</span>
          ${t.pinned ? '<span class="tag pink">置顶</span>' : ''}
          ${t.detail ? '<span class="tag">有详情</span>' : ''}
        </div>
        ${isLong ? `<div class="prog">
            <div class="track"><i style="width:${clamp(num(t.progress), 0, 100)}%"></i></div>
            <div class="lb"><span>进度</span><span>${clamp(num(t.progress), 0, 100)}%</span></div>
          </div>` : ''}
        ${t.type === 'daily' ? `<div class="dots">${hist}</div>` : ''}
      </div>
      <div class="grip" title="拖动排序"><i class="fa-solid fa-grip-vertical"></i></div>
    </div>`;
  }

  function addTodo(text, type, priority) {
    const d = Store.data;
    const maxOrder = d.todos.reduce((m, t) => Math.max(m, t.order || 0), 0);
    Store.edit((dd) => dd.todos.push({
      id: uid(), text, type: type || 'today', done: false, lastDone: '',
      progress: 0, priority: priority || 'mid', pinned: false,
      order: maxOrder + 1, createdAt: Date.now(), detail: '', history: []
    }));
    renderTodo(); refreshHome();
    return true;
  }

  function toggleTodo(id) {
    const t = Store.data.todos.find((x) => x.id === id);
    if (!t) return;
    if (t.type === 'daily') {
      // 日常任务：打卡不消失，只记录日期，次日自动恢复未完成
      Store.edit(() => {
        if (t.lastDone === today()) t.lastDone = '';
        else {
          t.lastDone = today();
          t.history = Array.isArray(t.history) ? t.history : [];
          if (!t.history.includes(today())) t.history.push(today());
        }
      });
    } else {
      Store.edit(() => { t.done = !t.done; });
    }
    renderTodo(); refreshHome();
  }

  function applyReorder(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    const arr = sortedTodos(todoTab);
    const from = arr.findIndex((t) => t.id === fromId);
    const to = arr.findIndex((t) => t.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    Store.edit(() => arr.forEach((t, i) => { t.order = i + 1; }));
  }

  /* ---------- 任务详情弹窗 ---------- */
  let detailId = null;
  function openDetail(id) {
    const t = Store.data.todos.find((x) => x.id === id);
    if (!t) return;
    detailId = id;
    $('#dText').value = t.text;
    $('#dDetail').value = t.detail || '';
    $('#dCreated').textContent = new Date(t.createdAt || Date.now()).toLocaleDateString('zh-CN');
    $$('#dType button').forEach((b) => b.classList.toggle('on', b.dataset.v === t.type));
    $$('#dPrio button').forEach((b) => b.classList.toggle('on', b.dataset.v === (t.priority || 'mid')));
    $('#dProgWrap').classList.toggle('hidden', t.type !== 'long');
    $('#dProg').value = clamp(num(t.progress), 0, 100);
    $('#dProgLabel').textContent = clamp(num(t.progress), 0, 100) + '%';
    $('#dHistWrap').classList.toggle('hidden', t.type !== 'daily');
    const hist = lastN(28).map((x) => `<i class="${(t.history || []).includes(x) ? 'on' : ''}" title="${x}"></i>`).join('');
    $('#dHist').innerHTML = hist;
    $('#dPin').innerHTML = t.pinned
      ? '<i class="fa-solid fa-thumbtack"></i> 取消置顶'
      : '<i class="fa-solid fa-thumbtack"></i> 置顶任务';
    $('#detailModal').classList.add('show');
  }

  function saveDetail() {
    const t = Store.data.todos.find((x) => x.id === detailId);
    if (!t) return;
    const text = $('#dText').value.trim();
    if (!text) return toast('任务内容不能为空');
    Store.edit(() => {
      t.text = text;
      t.detail = $('#dDetail').value.trim();
      t.type = $('#dType button.on') ? $('#dType button.on').dataset.v : t.type;
      t.priority = $('#dPrio button.on') ? $('#dPrio button.on').dataset.v : t.priority;
      t.progress = t.type === 'long' ? clamp(parseInt($('#dProg').value, 10) || 0, 0, 100) : t.progress;
    });
    $('#detailModal').classList.remove('show');
    renderTodo(); refreshHome();
    toast('已保存');
  }

  /* ---------- 通用记录编辑弹窗：所有记录都可修改 ---------- */
  const EDIT_FORMS = {
    expense: { title: '编辑支出', store: (d) => d.expenses, fields: [
      { key: 'date', label: '日期', type: 'date' },
      { key: 'amount', label: '金额（元）', type: 'number', min: 0, step: '0.01' },
      { key: 'category', label: '分类', type: 'select', opts: () => APP.EXPENSE_CATS.map((c) => c.name) },
      { key: 'note', label: '备注', type: 'text' }] },
    meal: { title: '编辑饮食记录', store: (d) => d.meals, fields: [
      { key: 'date', label: '日期', type: 'date' },
      { key: 'meal', label: '餐次', type: 'select', opts: () => APP.MEALS },
      { key: 'content', label: '吃了什么', type: 'text' },
      { key: 'note', label: '备注（可留空）', type: 'text' }] },
    workout: { title: '编辑运动记录', store: (d) => d.workouts, fields: [
      { key: 'date', label: '日期', type: 'date' },
      { key: 'type', label: '项目', type: 'select', opts: () => APP.EXERCISES },
      { key: 'minutes', label: '时长（分钟）', type: 'number', min: 1 },
      { key: 'note', label: '备注（可留空）', type: 'text' }] },
    period: { title: '编辑经期记录', store: (d) => d.periods, fields: [
      { key: 'start', label: '开始日期', type: 'date' },
      { key: 'end', label: '结束日期（可留空 = 进行中）', type: 'date' }] },
    exam: { title: '编辑考试', store: (d) => d.exams, fields: [
      { key: 'name', label: '考试名称', type: 'text' },
      { key: 'date', label: '考试日期', type: 'date' }] },
    study: { title: '编辑学习打卡', store: (d) => d.studyLogs, fields: [
      { key: 'date', label: '日期', type: 'date' },
      { key: 'minutes', label: '时长（分钟）', type: 'number', min: 1 },
      { key: 'chapter', label: '章节 / 内容', type: 'text' }] }
  };
  let editCtx = null;

  function openEdit(type, id) {
    const form = EDIT_FORMS[type];
    if (!form) return;
    const rec = form.store(Store.data).find((x) => x.id === id);
    if (!rec) return;
    editCtx = { type, id };
    $('#emTitle').textContent = form.title;
    $('#emFields').innerHTML = form.fields.map((f) => {
      const v = rec[f.key] == null ? '' : String(rec[f.key]);
      if (f.type === 'select') {
        return `<div class="field" style="margin-bottom:12px"><label>${f.label}</label>
          <select data-emk="${f.key}">${f.opts().map((o) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
      }
      return `<div class="field" style="margin-bottom:12px"><label>${f.label}</label>
        <input data-emk="${f.key}" type="${f.type}" ${f.min != null ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} value="${esc(v)}"></div>`;
    }).join('');
    $('#editModal').classList.add('show');
  }

  function saveEdit() {
    if (!editCtx) return;
    const form = EDIT_FORMS[editCtx.type];
    const rec = form.store(Store.data).find((x) => x.id === editCtx.id);
    if (!rec) return closeEdit();
    const patch = {};
    $$('#emFields [data-emk]').forEach((inp) => {
      const k = inp.dataset.emk;
      const f = form.fields.find((x) => x.key === k);
      if (f.type === 'number') { const v = num(inp.value); if (v > 0) patch[k] = v; }
      else patch[k] = inp.value.trim();
    });
    if (editCtx.type === 'expense' && !(patch.amount > 0)) { toast('金额需大于 0'); return; }
    if (editCtx.type === 'period' && patch.end && patch.start && daysBetween(patch.start, patch.end) < 0) { toast('结束日期不能早于开始日期'); return; }
    Store.edit(() => Object.assign(rec, patch));
    const type = editCtx.type;
    closeEdit();
    if (type === 'expense') { renderMoney(); refreshHome(); }
    else if (type === 'meal' || type === 'workout') { renderLife(); refreshHome(); }
    else if (type === 'period') { renderPeriod(); refreshHome(); }
    else if (type === 'exam' || type === 'study') { renderStudy(); refreshHome(); }
    toast('已保存修改');
  }

  function closeEdit() {
    editCtx = null;
    $('#editModal').classList.remove('show');
  }

  /* ---------- 通用说明弹窗（标题 + 正文 + 署名） ---------- */
  let noticeCb = null;
  function openNotice(title, body, sign, opts) {
    opts = opts || {};
    $('#nmTitle').textContent = title;
    $('#nmBody').textContent = body;
    $('#nmSign').textContent = sign || '';
    $('#nmSign').style.display = sign ? '' : 'none';
    $('#nmOk').textContent = opts.okText || '知道了';
    $('#nmCancel').style.display = opts.cancelText ? '' : 'none';
    if (opts.cancelText) $('#nmCancel').textContent = opts.cancelText;
    noticeCb = opts.onOk || null;
    $('#noticeModal').classList.add('show');
  }
  function closeNotice(confirmed) {
    $('#noticeModal').classList.remove('show');
    const cb = noticeCb;
    noticeCb = null;
    if (confirmed && cb) cb();
  }

  /* ---------- 悬浮小窗 ---------- */
  function renderFabList() {
    const list = sortedTodos(null).filter((t) => t.type !== 'long' || t.pinned).slice(0, 30);
    const left = list.filter((t) => !todoDone(t)).length;
    $('#fabCount').textContent = left;
    $('#fabCount').classList.toggle('hidden', left === 0);
    $('#fabList').innerHTML = list.length
      ? list.map((t) => `<div class="fab-item ${todoDone(t) ? 'done' : ''}" data-fab="${t.id}">
          <span class="chk ${todoDone(t) ? 'on' : ''}"></span>
          <span class="t">${esc(t.text)}</span>
        </div>`).join('')
      : `<div class="empty" style="padding:14px">暂无任务</div>`;
  }

  /* ---------- 拖拽排序（指针事件，鼠标与触屏通用） ---------- */
  let dragId = null, dropTargetId = null;

  function initDrag() {
    const list = $('#todoList');
    list.addEventListener('pointerdown', (e) => {
      const grip = e.target.closest('.grip');
      if (!grip) return;
      const card = grip.closest('.todo-card');
      if (!card) return;
      dragId = card.dataset.id;
      card.classList.add('dragging');
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      e.preventDefault();
    });
    list.addEventListener('pointermove', (e) => {
      if (!dragId) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const card = el && el.closest && el.closest('.todo-card');
      $$('#todoList .todo-card').forEach((c) => c.classList.remove('drop-target'));
      if (card && card.dataset.id !== dragId) { card.classList.add('drop-target'); dropTargetId = card.dataset.id; }
      else dropTargetId = null;
    });
    const end = () => {
      if (!dragId) return;
      const from = dragId;
      $$('#todoList .todo-card').forEach((c) => c.classList.remove('dragging', 'drop-target'));
      dragId = null;
      if (dropTargetId) { applyReorder(from, dropTargetId); dropTargetId = null; renderTodo(); toast('排序已更新'); }
      else renderTodo();
    };
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
  }

  /* ==========================================================================
     5. 经期
     ========================================================================== */
  function periodStat() {
    const ps = Store.data.periods.slice().sort((a, b) => a.start.localeCompare(b.start));
    if (!ps.length) return { hasData: false };
    const last = ps[ps.length - 1];
    const lens = ps.slice(1).map((p, i) => daysBetween(ps[i].start, p.start)).filter((n) => n > 10 && n < 60);
    const ov = Store.data.settings.period || {};
    const avgCycle = clamp(parseInt(ov.avgCycle, 10) || (lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 28), 15, 60);
    const durs = ps.filter((p) => p.end).map((p) => daysBetween(p.start, p.end) + 1).filter((n) => n > 0 && n < 15);
    const avgDur = clamp(parseInt(ov.avgDur, 10) || (durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 5), 1, 14);
    const nextD = new Date(last.start + 'T00:00:00');
    nextD.setDate(nextD.getDate() + avgCycle);
    const next = dateStr(nextD);
    return {
      hasData: true, last, avgCycle, avgDur, next,
      left: daysBetween(today(), next),
      dayNo: daysBetween(last.start, today()) + 1,
      onPeriod: !last.end || daysBetween(last.start, today()) + 1 <= avgDur,
      count: ps.length
    };
  }

  /* 经期关怀语：每天随机换一条（按天轮换，同一天固定）；经期中用暖心提醒 */
  function careText(onPeriod) {
    const arr = onPeriod ? APP.PERIOD_CARE : APP.HEALTH_CARE;
    return arr[dayIdx() % arr.length];
  }

  function renderPeriod() {
    const s = periodStat();
    const box = $('#periodStat');

    // 健康关心语：无论有没有记录都展示（经期中自动切换为暖心提醒）
    $('#periodCare').style.display = '';
    $('#periodCare').innerHTML = `<div class="card" style="margin-bottom:14px;border:1px solid var(--line)">
      <div style="display:flex;align-items:center;gap:10px">
        <i class="fa-solid fa-heart" style="color:var(--accent);font-size:18px"></i>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--ink)">${s.onPeriod ? '经期暖心提醒' : '今日健康关心'}</div>
          <div style="font-size:13.5px;color:var(--ink-2);margin-top:3px;line-height:1.7">${esc(careText(s.onPeriod))}</div>
        </div>
      </div>
    </div>`;

    if (!s.hasData) {
      box.innerHTML = `<div class="empty"><i class="fa-solid fa-droplet"></i>还没有记录经期</div>`;
    } else {
      const pctCycle = clamp(Math.round(s.dayNo / s.avgCycle * 100), 0, 100);
      box.innerHTML = `
        <div class="cols cols-2" style="margin-bottom:14px">
          <div class="card" style="margin:0">
            <h2><i class="fa-solid fa-calendar-day"></i> 下次预测<span class="right">${s.avgCycle} 天周期</span></h2>
            <div style="font-size:26px;font-weight:600;color:var(--accent-deep)">${s.next}</div>
            <div style="font-size:12.5px;color:var(--muted);margin-top:6px">${s.left >= 0 ? `还有 ${s.left} 天` : `已超过 ${-s.left} 天`}</div>
            <div class="bar" style="height:6px;border-radius:99px;background:var(--bg-2);margin-top:12px;overflow:hidden">
              <i style="display:block;height:100%;border-radius:99px;background:var(--accent);width:${pctCycle}%"></i>
            </div>
            <div style="font-size:11.5px;color:var(--muted);margin-top:7px">当前是周期第 ${s.dayNo} 天</div>
          </div>
          <div class="card" style="margin:0">
            <h2><i class="fa-solid fa-wave-square"></i> 周期概览</h2>
            <div class="item" style="margin-bottom:8px"><div class="grow"><div class="m">上次开始</div><div class="s">${s.last.start}</div></div></div>
            <div class="item" style="margin-bottom:8px">
              <div class="grow"><div class="m">平均周期长度</div><div class="s">${s.avgCycle} 天${(Store.data.settings.period || {}).avgCycle ? ' · 已自定义' : ' · 按记录自动计算'}</div></div>
              <div class="acts"><button class="ibtn" data-edit-avg="cycle" title="修改"><i class="fa-solid fa-pen"></i></button></div>
            </div>
            <div class="item" style="margin-bottom:8px">
              <div class="grow"><div class="m">平均经期长度</div><div class="s">${s.avgDur} 天${(Store.data.settings.period || {}).avgDur ? ' · 已自定义' : ' · 按记录自动计算'}</div></div>
              <div class="acts"><button class="ibtn" data-edit-avg="dur" title="修改"><i class="fa-solid fa-pen"></i></button></div>
            </div>
            <div class="item"><div class="grow"><div class="m">累计记录</div><div class="s">${s.count} 次</div></div></div>
          </div>
        </div>`;
    }

    const list = Store.data.periods.slice().sort((a, b) => b.start.localeCompare(a.start));
    const ppg = pageOf('period', list);
    $('#periodList').innerHTML = ppg.total
      ? ppg.slice.map((p) => `<div class="item">
          <div class="grow">
            <div class="m">${esc(p.start)}${p.end ? ' ~ ' + esc(p.end) : ' · 进行中'}</div>
            <div class="s">${p.end ? `经期 ${daysBetween(p.start, p.end) + 1} 天` : '未记录结束日期'}</div>
          </div>
          <div class="acts">
            <button class="ibtn" data-edit-period="${p.id}" title="编辑"><i class="fa-solid fa-pen"></i></button>
            <button class="ibtn" data-del-period="${p.id}" title="删除"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`).join('')
      : `<div class="empty"><i class="fa-regular fa-calendar"></i>暂无记录</div>`;
    pagerInto('#periodPager', 'period', ppg.total);
  }

  function addPeriod() {
    const start = $('#periodStart').value;
    if (!start) return toast('请选择开始日期');
    const end = $('#periodEnd').value;
    if (end && daysBetween(start, end) < 0) return toast('结束日期不能早于开始日期');
    const dup = Store.data.periods.find((p) => p.start === start);
    if (dup) { Store.edit(() => { dup.end = end || dup.end; }); }
    else Store.edit((d) => d.periods.push({ id: uid(), start, end }));
    $('#periodStart').value = ''; $('#periodEnd').value = '';
    renderPeriod(); refreshHome();
    toast('已保存记录');
  }

  /* ==========================================================================
     6. 外语学习
     ========================================================================== */
  let enIdx = null;
  let favFilter = '全部';
  let favOpen = true;      // 收藏夹展开/折叠

  /* ---------- 发音（Web Speech API，设备本地合成，无需联网） ---------- */
  function speak(text) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.92;
      speechSynthesis.speak(u);
    } catch (e) { toast('当前设备不支持语音朗读'); }
  }

  /* ---------- 原地鼓励语：每逢整十触发，非弹窗，逐字打出 + 光效，停留后自动淡出 ---------- */
  function randomCheer() { return APP.CHEERS[Math.floor(Math.random() * APP.CHEERS.length)]; }
  /**
   * 原地鼓励语（动态效果版）
   * @param {Element} el   容器
   * @param {string}  text 文案
   * @param {number}  hold 完整显示后的停留时长(ms)
   * @param {object}  opt  { speed: 每字毫秒 }
   */
  function cheer(el, text, hold, opt) {
    if (!el) return;
    opt = opt || {};
    const speed = opt.speed || 42;
    clearTimeout(el._t);
    clearInterval(el._timer);
    el.classList.remove('pop');
    el.classList.add('cheer-in');
    void el.offsetWidth;
    el.classList.add('pop');

    // 逐字打出（打字机效果）
    el.textContent = '';
    const chars = String(text).split('');
    let i = 0;
    const caret = document.createElement('i');
    caret.className = 'cheer-caret';
    el.appendChild(caret);
    el._timer = setInterval(() => {
      if (i >= chars.length) {
        clearInterval(el._timer);
        el._timer = null;
        caret.remove();
        return;
      }
      caret.insertAdjacentText('beforebegin', chars[i]);
      i++;
    }, speed);

    // 停留时长 = 打字时间 + hold，保证打完还能看到
    const total = chars.length * speed + (hold || 3000);
    el._t = setTimeout(() => {
      clearInterval(el._timer);
      el._timer = null;
      el.textContent = '';
      el.classList.remove('pop', 'cheer-in');
      if (caret.parentNode) caret.remove();
    }, total);
  }
  /* 收藏总数逢整十 → 在指定位置鼓励 */
  function checkCheer(anchorId) {
    const n = Store.data.favorites.length;
    if (n > 0 && n % 10 === 0) cheer($('#' + anchorId), `已收藏 ${n} 条！` + randomCheer());
  }

  const quoteText = (q) => q.en + '\n' + q.zh;

  function renderQuoteFav() {
    const q = APP.ENGLISH_QUOTES[enIdx] || APP.ENGLISH_QUOTES[0];
    const faved = Store.data.favorites.some((f) => f.text === quoteText(q));
    const b = $('#btnFavQuote');
    b.innerHTML = faved ? '<i class="fa-solid fa-star"></i> 已收藏' : '<i class="fa-regular fa-star"></i> 收藏';
    b.classList.toggle('on', faved);
  }

  function favQuote() {
    const q = APP.ENGLISH_QUOTES[enIdx] || APP.ENGLISH_QUOTES[0];
    const dup = Store.data.favorites.find((f) => f.text === quoteText(q));
    if (dup) {   // 再点一次 = 取消收藏
      Store.edit((d) => { d.favorites = d.favorites.filter((f) => f.id !== dup.id); });
      renderQuoteFav(); renderLang();
      toast('已取消收藏');
      return;
    }
    Store.edit((d) => d.favorites.push({ id: uid(), text: quoteText(q), cat: '外刊金句', createdAt: Date.now() }));
    renderQuoteFav(); renderLang();
    checkCheer('favCheer');
    toast('已收藏到「外刊金句」');
  }

  /* ---------- 作文常用句式卡（每日轮换 + 分页） ---------- */
  function renderPatterns() {
    const pats = dailyPatterns();
    const pg = pageOf('pat', pats);
    $('#patList').innerHTML = pg.slice.map((pt) => {
      const i = pats.indexOf(pt);
      const faved = Store.data.favorites.some((f) => f.pat === pt.p);
      return `<div class="item" style="align-items:flex-start">
        <div class="grow">
          <div class="m" style="font-family:Georgia,serif">${esc(pt.p)}</div>
          <div class="s" style="margin-top:4px">${esc(pt.zh)}
            <span class="tag lilac" style="margin-left:6px">${esc(pt.note)}</span>
          </div>
        </div>
        <div class="acts">
          <button class="ibtn" data-pat-speak="${i}" title="听发音"><i class="fa-solid fa-volume-high"></i></button>
          <button class="ibtn ${faved ? 'on' : ''}" data-pat-fav="${i}" title="${faved ? '点击取消收藏' : '收藏'}"><i class="fa-${faved ? 'solid' : 'regular'} fa-star"></i></button>
        </div>
      </div>`;
    }).join('');
    pagerInto('#patPager', 'pat', pg.total);
  }

  function renderLang() {
    // 每日金句
    const list = APP.ENGLISH_QUOTES;
    const st = Store.data.enQuoteState;
    if (st.date !== today()) { st.date = today(); st.lastIdx = -1; Store.save(); }
    if (enIdx == null) {
      let i = dayIdx() % list.length;
      if (i === st.lastIdx && list.length > 1) i = (i + 1) % list.length;
      enIdx = i;
    }
    st.lastIdx = enIdx; Store.save();
    const q = list[enIdx];
    $('#qEn').textContent = q.en;
    $('#qZh').textContent = q.zh;
    $('#qKeys').innerHTML = q.keys.map((k) => `<span class="tag">${esc(k.w)} · ${esc(k.m)}</span>`).join('');
    renderQuoteFav();
    $('#enTip').textContent = `每天自动换新 · 已收藏 ${Store.data.favorites.filter((f) => f.cat === '外刊金句').length} 句`;

    // 单词卡
    renderWord();

    // 作文常用句式
    renderPatterns();

    // 收藏夹（可折叠 + 分页）
    const cats = ['全部'].concat(APP.FAV_CATS);
    $('#favFilter').innerHTML = cats.map((c) =>
      `<button class="tag ${favFilter === c ? '' : ''}" data-favfilter="${esc(c)}"
        style="${favFilter === c ? 'background:var(--c-blue);color:#fff' : 'cursor:pointer'}">${esc(c)}</button>`).join('');
    const all = Store.data.favorites.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const fl = favFilter === '全部' ? all : all.filter((f) => f.cat === favFilter);
    const foldBtn = $('#favFold');
    if (foldBtn) foldBtn.innerHTML = `<i class="fa-solid fa-chevron-${favOpen ? 'up' : 'down'}"></i> ${favOpen ? '收起' : '展开'} <span style="opacity:.7;font-weight:400">(${all.length})</span>`;
    const fpg = pageOf('fav', fl);
    const shown = favOpen ? fpg.slice : [];
    $('#favList').style.display = favOpen ? '' : 'none';
    $('#favPager').style.display = favOpen && fpg.total > 0 ? '' : 'none';
    $('#favPager').innerHTML = favOpen ? pagerHtml('fav', fpg.total) : '';
    $('#favList').innerHTML = shown.length
      ? shown.map((f) => `<div class="item">
          <div class="grow">
            <div class="m">${esc(f.text)}</div>
            <div class="s"><span class="tag ${f.cat === '作文模板' ? 'sand' : f.cat === '高级词汇' ? 'sage' : f.cat === '外刊金句' ? 'lilac' : ''}">${esc(f.cat)}</span></div>
          </div>
          <div class="acts">
            <button class="ibtn" data-copy-fav="${f.id}"><i class="fa-regular fa-copy"></i></button>
            <button class="ibtn" data-edit-fav="${f.id}"><i class="fa-solid fa-pen"></i></button>
            <button class="ibtn" data-del-fav="${f.id}"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`).join('')
      : (favOpen ? `<div class="empty"><i class="fa-regular fa-bookmark"></i>暂无收藏</div>` : '');
  }

  function renderWord() {
    const ws = Store.data.wordState;
    if (ws.date !== today()) { ws.date = today(); ws.idx = 0; ws.known = 0; ws.unknown = 0; Store.save(); }
    const wlist = dailyWords();          // 每日轮换，隔天自动刷新
    const w = wlist[ws.idx % wlist.length];
    $('#wWord').textContent = w.w;
    $('#wPhon').textContent = w.p;
    $('#wMean').textContent = w.m;
    $('#wSent').textContent = w.s;
    $('#wKnown').textContent = ws.known || 0;
    $('#wUnknown').textContent = ws.unknown || 0;
    $('#wTotal').textContent = (ws.known || 0) + (ws.unknown || 0);
    $('#wMeaning').classList.add('hidden');
    $('#btnReveal').classList.remove('hidden');
    $('#wActions').classList.add('hidden');
  }

  function nextWord(known) {
    const ws = Store.data.wordState;
    const w = dailyWords()[ws.idx % dailyWords().length];
    // 第一次点「不认识」：先说明规则，确认后再计入并自动收藏
    if (known === false && !Store.data.settings.seenUnknownTip) {
      openNotice(APP.UNKNOWN_TIP.title, APP.UNKNOWN_TIP.body, APP.UNKNOWN_TIP.sign, {
        okText: '好的，记住了',
        cancelText: '再看看',
        onOk: () => {
          Store.data.settings.seenUnknownTip = true;   // 只弹一次
          Store.save();
          nextWord(false);
        }
      });
      return;
    }
    Store.edit(() => {
      if (known !== undefined) {
        if (known) ws.known = (ws.known || 0) + 1;
        else {
          ws.unknown = (ws.unknown || 0) + 1;
          // 不认识 → 自动静默收进「高级词汇」，可日后复习
          if (!Store.data.favorites.some((f) => f.word === w.w)) {
            Store.data.favorites.push({ id: uid(), word: w.w, text: `${w.w} ${w.p} ${w.m}`, cat: '高级词汇', createdAt: Date.now() });
          }
        }
      }
      ws.idx = (ws.idx || 0) + 1;
      if (known === false) Store.data.settings.seenUnknownTip = true;
    });
    if (known === false) {
      renderLang();   // 静默更新收藏列表，不弹窗、不提示、无特效
    }
    // 今日已学逢整十（10、20、30…）→ 在「看释义」旁原地鼓励（仅「认识」时触发，非弹窗）
    const learned = (ws.known || 0) + (ws.unknown || 0);
    if (known === true && learned > 0 && learned % 10 === 0) cheer($('#wCheer'), `已学 ${learned} 个！` + randomCheer());
    renderWord();
  }

  function addFav() {
    const text = $('#favText').value.trim();
    if (!text) return toast('请输入内容');
    Store.edit((d) => d.favorites.push({ id: uid(), text, cat: $('#favCat').value, createdAt: Date.now() }));
    $('#favText').value = '';
    renderLang();
    checkCheer('favCheer');
    toast('已收藏');
  }

  /* ==========================================================================
     7. 专业学习
     ========================================================================== */
  function renderStudy() {
    const tip = APP.ACCOUNTING_TIPS[dayIdx() % APP.ACCOUNTING_TIPS.length];
    $('#tipTitle').textContent = tip.title;
    $('#tipPlain').innerHTML = `<b>大白话：</b>${tip.plain}`;
    $('#tipExample').innerHTML = tip.example;
    const d = new Date();
    $('#tipDate').textContent = `${d.getMonth() + 1}月${d.getDate()}日`;

    // 考试倒计时
    const exams = Store.data.exams.slice().sort((a, b) => a.date.localeCompare(b.date));
    const epg = pageOf('exam', exams);
    $('#examList').innerHTML = epg.total
      ? epg.slice.map((e) => {
        const left = daysBetween(today(), e.date);
        const txt = left > 0 ? `${left}<small>天</small>` : (left === 0 ? '就是<small>今天</small>' : `已过<small>${-left}天</small>`);
        return `<div class="item">
          <div class="grow">
            <div class="m">${esc(e.name)}</div>
            <div class="s">考试日期 ${esc(e.date)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:19px;font-weight:600;color:${left <= 30 && left >= 0 ? 'var(--accent-deep)' : 'var(--c-blue-deep)'}">${txt}</div>
          </div>
          <div class="acts">
            <button class="ibtn" data-edit-exam="${e.id}" title="编辑"><i class="fa-solid fa-pen"></i></button>
            <button class="ibtn" data-del-exam="${e.id}" title="删除"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`;
      }).join('')
      : `<div class="empty"><i class="fa-solid fa-hourglass-half"></i>暂无考试</div>`;
    pagerInto('#examPager', 'exam', epg.total);

    // 学习打卡
    const logs = Store.data.studyLogs;
    const mins = logs.filter((s) => s.date === today()).reduce((a, b) => a + num(b.minutes), 0);
    $('#studyToday').textContent = mins;
    const days = last7();
    const vals = days.map((x) => logs.filter((s) => s.date === x).reduce((a, b) => a + num(b.minutes), 0));
    $('#studyBars').innerHTML = barsHtml(days.map((x) => x.slice(5)), vals);

    const recs = logs.slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
    const spg = pageOf('study', recs);
    $('#studyList').innerHTML = spg.total
      ? spg.slice.map((s) => `<div class="item">
          <div class="grow"><div class="m">${esc(s.chapter || '学习打卡')}</div><div class="s">${esc(s.date)} · ${esc(String(s.minutes))} 分钟</div></div>
          <div class="acts">
            <button class="ibtn" data-edit-study="${s.id}" title="编辑"><i class="fa-solid fa-pen"></i></button>
            <button class="ibtn" data-del-study="${s.id}" title="删除"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`).join('')
      : `<div class="empty"><i class="fa-solid fa-clock"></i>暂无打卡记录</div>`;
    pagerInto('#studyPager', 'study', spg.total);

    // 学习时间趋势折线（默认近 1 周）
    if (!$('#studyFrom').value) { const d0 = new Date(); d0.setDate(d0.getDate() - 6); $('#studyFrom').value = dateStr(d0); }
    if (!$('#studyTo').value) $('#studyTo').value = today();
    renderStudyChart();
  }

  /* 学习时间折线图：可自选起止日期，图下附鼓励语 */
  function renderStudyChart() {
    const logs = Store.data.studyLogs;
    const from = $('#studyFrom').value, to = $('#studyTo').value;
    if (!from || !to || from > to) { $('#studyChart').innerHTML = `<div class="empty"><i class="fa-solid fa-chart-line"></i>请选择有效的起止日期</div>`; return; }
    const list = [];
    const end = new Date(to + 'T00:00:00');
    for (let cur = new Date(from + 'T00:00:00'); cur <= end; cur.setDate(cur.getDate() + 1)) {
      list.push(dateStr(cur));
      if (list.length > 92) break;
    }
    const vals = list.map((x) => logs.filter((s) => s.date === x).reduce((a, b) => a + num(b.minutes), 0));
    const total = vals.reduce((a, b) => a + b, 0);
    const active = vals.filter((v) => v > 0).length;
    $('#studyChart').innerHTML = lineChartSvg(list.map((x) => x.slice(5)), vals, 'var(--c-blue)', '分');
    if ($('#studyRangeLabel')) $('#studyRangeLabel').textContent = `${list[0].slice(5)} ~ ${list[list.length - 1].slice(5)} · 共 ${list.length} 天`;
    $$('#view-study [data-studyrange]').forEach((b) => b.classList.toggle('on', list.length === +b.dataset.studyrange));
    const cheer = APP.SPORT_CHEERS[Math.floor(Math.random() * APP.SPORT_CHEERS.length)];
    $('#studyEncourage').textContent = total > 0
      ? `这段时间共学习 ${total} 分钟 · 有 ${active} 天在学 · ${cheer}`
      : `这段时间还没有学习记录，从今天开始，哪怕 20 分钟也好 · ${cheer}`;
  }

  function addExam() {
    const name = $('#examName').value.trim();
    const date = $('#examDate').value;
    if (!name) return toast('请输入考试名称');
    if (!date) return toast('请选择考试日期');
    Store.edit((d) => d.exams.push({ id: uid(), name, date }));
    $('#examName').value = '';
    renderStudy(); refreshHome();
    toast('已添加倒计时');
  }

  function addStudy() {
    const minutes = parseInt($('#studyMinutes').value, 10);
    if (!minutes || minutes <= 0) return toast('请输入学习时长');
    Store.edit((d) => d.studyLogs.push({ id: uid(), date: today(), minutes, chapter: $('#studyChapter').value.trim() || '学习打卡' }));
    $('#studyMinutes').value = ''; $('#studyChapter').value = '';
    renderStudy(); refreshHome();
    toast('打卡成功');
  }

  /* ==========================================================================
     8. 时政（预置长期有效的政策要点 + 用户自行录入每日新闻）
     ========================================================================== */
  /* ---------- 时政每日金句：每天轮换一条，可朗读 / 收藏 ---------- */
  function todayNewsQuote() {
    const list = APP.NEWS_QUOTES || [];
    return list.length ? list[dayIdx() % list.length] : { text: '', from: '' };
  }
  // 每日金句：每天自动轮换，纯展示、不可收藏
  function renderNewsQuote() {
    const q = todayNewsQuote();
    $('#newsQuoteText').textContent = q.text;
    $('#newsQuoteFrom').textContent = q.from ? '—— ' + q.from : '';
  }

  /**
   * 今日时政要点：把预置要点按「每天一组、一组 5 条」轮换。
   * 按 dayIdx() 取组，取到末尾自动回卷，保证每天都是固定 5 条。
   */
  function todayNewsSeed() {
    const all = APP.NEWS_SEED || [];
    if (!all.length) return [];
    const per = Math.max(1, APP.NEWS_SEED_PER_DAY || 5);
    const groups = Math.ceil(all.length / per);
    const d = dayIdx();
    const g = ((d % groups) + groups) % groups;
    const out = [];
    for (let i = 0; i < per; i++) out.push(all[(g * per + i) % all.length]);
    return out;
  }
  // 今日要点共几组（用于展示「第 N / M 组」）
  function newsSeedGroupInfo() {
    const all = APP.NEWS_SEED || [];
    const per = Math.max(1, APP.NEWS_SEED_PER_DAY || 5);
    const groups = Math.max(1, Math.ceil(all.length / per));
    const g = ((dayIdx() % groups) + groups) % groups;
    return { cur: g + 1, groups, per };
  }

  function renderNews() {
    // 每日金句（每天自动刷新）
    renderNewsQuote();

    // 今日要点：每天轮换一组（5 条）
    const seeds = todayNewsSeed();
    $('#newsSeed').innerHTML = seeds.map((n) => `<div class="item" style="align-items:flex-start">
        <div class="grow">
          <div class="m">${esc(n.title)}</div>
          <div class="s" style="margin-top:4px;color:var(--ink-2)">${esc(n.body)}</div>
        </div>
      </div>`).join('') || `<div class="empty"><i class="fa-regular fa-lightbulb"></i>暂无要点</div>`;
    const gi = newsSeedGroupInfo();
    const gl = $('#newsSeedLabel');
    if (gl) gl.textContent = `每天轮换 · 第 ${gi.cur} / ${gi.groups} 组 · 每组 ${gi.per} 条`;

    const list = Store.data.news.slice().sort((a, b) => b.date.localeCompare(a.date));
    const t = today();
    const cur = Store.data.news.find((n) => n.date === t);
    $('#newsDate').value = cur ? cur.date : t;
    $('#newsTitle').value = cur ? cur.title : '';
    $('#newsBody').value = cur ? cur.body : '';
    $('#newsSource').value = cur ? (cur.source || '') : '';

    const npg = pageOf('news', list);
    $('#newsList').innerHTML = npg.total
      ? npg.slice.map((n) => `<div class="item" style="align-items:flex-start">
          <div class="grow">
            <div class="m">${esc(n.title || '未命名')}</div>
            <div class="s">${esc(n.date)}${n.source ? ' · ' + esc(n.source) : ''}</div>
            ${n.body ? `<div class="s" style="margin-top:6px;color:var(--ink-2)">${esc(n.body)}</div>` : ''}
          </div>
          <div class="acts">
            <button class="ibtn" data-load-news="${n.id}"><i class="fa-solid fa-pen"></i></button>
            <button class="ibtn" data-del-news="${n.id}"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`).join('')
      : `<div class="empty"><i class="fa-regular fa-newspaper"></i>暂无记录</div>`;
    pagerInto('#newsPager', 'news', npg.total);
  }

  function saveNews() {
    const date = $('#newsDate').value || today();
    const title = $('#newsTitle').value.trim();
    const body = $('#newsBody').value.trim();
    const source = $('#newsSource').value.trim();
    if (!title && !body) return toast('请输入标题或摘要');
    Store.edit((d) => {
      const ex = d.news.find((n) => n.date === date);
      if (ex) { ex.title = title; ex.body = body; ex.source = source; }
      else d.news.push({ id: uid(), date, title, body, source });
    });
    renderNews();
    toast('已保存');
  }

  /* ==========================================================================
     9. 设置
     ========================================================================== */
  function renderSettings() {
    const s = Store.data.settings;
    $$('[data-themeset]').forEach((b) => b.classList.toggle('on', b.dataset.themeset === s.theme));
    $('#bdayMonth').value = s.birthday.month;
    $('#bdayDay').value = s.birthday.day;
    $('#dataSize').textContent = ((localStorage.getItem('morandi_life_v1') || '').length / 1024).toFixed(1) + ' KB';
    $('#isBdayToday').textContent = APP.isBirthdayToday() ? '今天正是生日 🎂' : '今天不是生日';
  }

  /* ==========================================================================
     事件绑定
     ========================================================================== */
  function bind() {
    // 导航
    $$('[data-nav]').forEach((b) => b.addEventListener('click', () => go(b.dataset.nav)));

    // 首页
    $('#btnQuote').addEventListener('click', () => {
      const el = $('#quote');
      el.textContent = pickQuote(true);
      el.classList.remove('swap');
      void el.offsetWidth;       // 触发重排以重播动画
      el.classList.add('swap');
    });
    $('#weatherRefresh').addEventListener('click', () => {
      $('#weatherBody').innerHTML = '<div class="empty" style="padding:16px"><i class="fa-solid fa-spinner fa-spin"></i> 正在刷新…</div>';
      renderWeather(true);
    });
    $$('[data-go]').forEach((el) => el.addEventListener('click', () => {
      const v = el.dataset.go;
      if (v === 'fab') { openFab(); return; }
      go(v);
      if (el.dataset.focus) setTimeout(() => {
        const f = $('#' + el.dataset.focus);
        if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (f.focus) f.focus(); }
      }, 240);
    }));

    // 记账
    $('#expAdd').addEventListener('click', addExpense);

    // 运动三餐
    $('#mealAdd').addEventListener('click', addMeal);
    $('#workAdd').addEventListener('click', addWorkout);

    // 待办
    $$('#todoTabs button').forEach((b) => b.addEventListener('click', () => { todoTab = b.dataset.tab; renderTodo(); }));
    $('#todoAdd').addEventListener('click', () => {
      const text = $('#todoInput').value.trim();
      if (!text) return toast('请输入任务内容');
      addTodo(text, $('#todoType').value, $('#todoPrio').value);
      $('#todoInput').value = '';
      toast('已添加');
    });
    $('#todoInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#todoAdd').click(); });
    $('#resetToggle').addEventListener('change', (e) => {
      Store.edit((d) => { d.settings.todoDailyReset = e.target.checked; });
      toast(e.target.checked ? '已开启每日重置' : '已关闭每日重置');
    });
    $('#todoClearDone').addEventListener('click', () => {
      const n = Store.data.todos.filter((t) => t.type !== 'daily' && todoDone(t)).length;
      if (!n) return toast('没有已完成的任务');
      Store.edit((d) => { d.todos = d.todos.filter((t) => !(t.type !== 'daily' && todoDone(t))); });
      renderTodo(); refreshHome();
      toast(`已清理 ${n} 条`);
    });

    // 详情弹窗
    $$('#dType button').forEach((b) => b.addEventListener('click', () => {
      $$('#dType button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      $('#dProgWrap').classList.toggle('hidden', b.dataset.v !== 'long');
      $('#dHistWrap').classList.toggle('hidden', b.dataset.v !== 'daily');
    }));
    $$('#dPrio button').forEach((b) => b.addEventListener('click', () => {
      $$('#dPrio button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    }));
    $('#dProg').addEventListener('input', (e) => { $('#dProgLabel').textContent = e.target.value + '%'; });
    $('#dSave').addEventListener('click', saveDetail);
    $('#dCancel').addEventListener('click', () => $('#detailModal').classList.remove('show'));
    $('#dPin').addEventListener('click', () => {
      const t = Store.data.todos.find((x) => x.id === detailId);
      if (!t) return;
      Store.edit(() => { t.pinned = !t.pinned; });
      $('#dPin').innerHTML = t.pinned
        ? '<i class="fa-solid fa-thumbtack"></i> 取消置顶'
        : '<i class="fa-solid fa-thumbtack"></i> 置顶任务';
      renderTodo();
      toast(t.pinned ? '已置顶' : '已取消置顶');
    });
    $('#dDelete').addEventListener('click', () => {
      Store.edit((d) => { d.todos = d.todos.filter((x) => x.id !== detailId); });
      $('#detailModal').classList.remove('show');
      renderTodo(); refreshHome();
      toast('已删除');
    });

    // 通用记录编辑弹窗
    $('#emSave').addEventListener('click', saveEdit);
    $('#emCancel').addEventListener('click', closeEdit);

    // 悬浮小窗
    $('#fabBtn').addEventListener('click', () => {
      const p = $('#fabPanel');
      const willShow = p.classList.contains('hidden-panel');
      p.classList.toggle('hidden-panel');
      if (willShow) renderFabList();
    });
    $('#fabClose').addEventListener('click', () => $('#fabPanel').classList.add('hidden-panel'));
    $$('#fabType button').forEach((b) => b.addEventListener('click', () => {
      $$('#fabType button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    }));
    $('#fabAdd').addEventListener('click', () => {
      const text = $('#fabInput').value.trim();
      if (!text) return toast('请输入任务内容');
      addTodo(text, $('#fabType button.on').dataset.v, 'mid');
      $('#fabInput').value = '';
      toast('已添加');
    });
    $('#fabInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#fabAdd').click(); });

    // 经期
    $('#periodAdd').addEventListener('click', addPeriod);

    // 外语
    $('#btnSpeakEn').addEventListener('click', () => {
      const q = APP.ENGLISH_QUOTES[enIdx] || APP.ENGLISH_QUOTES[0];
      speak(q.en);
    });
    $('#btnFavQuote').addEventListener('click', favQuote);
    $('#btnCopyEn').addEventListener('click', () => {
      const q = APP.ENGLISH_QUOTES[enIdx] || APP.ENGLISH_QUOTES[0];
      copyText(q.en + '\n' + q.zh);
    });
    $('#btnNextEn').addEventListener('click', () => {
      const L = APP.ENGLISH_QUOTES.length;
      let i;
      do { i = Math.floor(Math.random() * L); } while (L > 1 && i === enIdx);
      enIdx = i;
      renderLang();
    });
    $('#btnReveal').addEventListener('click', () => {
      $('#wMeaning').classList.remove('hidden');
      $('#btnReveal').classList.add('hidden');
      $('#wActions').classList.remove('hidden');
    });
    $('#wSpeak').addEventListener('click', () => {
      const w = dailyWords()[(Store.data.wordState.idx || 0) % APP.WORDS.length];
      speak(w.w);
    });
    $('#wNext').addEventListener('click', () => nextWord(true));
    $('#wAgain').addEventListener('click', () => nextWord(false));
    $('#favAdd').addEventListener('click', addFav);
    $('#favFold').addEventListener('click', () => { favOpen = !favOpen; renderLang(); });
    $('#sportFrom').addEventListener('change', renderSportChart);
    $('#sportTo').addEventListener('change', renderSportChart);
    $('#yearFold').addEventListener('click', () => { yearOpen = !yearOpen; renderMoney(); });
    $('#yearPick').addEventListener('change', renderYearHistory);
    $('#yearFrom').addEventListener('change', renderYearHistory);
    $('#yearTo').addEventListener('change', renderYearHistory);
    // 记账区间快捷键
    $$('#view-money [data-mrange]').forEach((b) => b.addEventListener('click', () => {
      moneyRange = +b.dataset.mrange || 6;
      renderMoney();
    }));
    // 运动趋势区间快捷键
    $$('#view-life [data-sportrange]').forEach((b) => b.addEventListener('click', () => {
      const n = +b.dataset.sportrange || 7;
      const to = new Date(), from = new Date();
      from.setDate(from.getDate() - (n - 1));
      $('#sportTo').value = dateStr(to);
      $('#sportFrom').value = dateStr(from);
      renderSportChart();
    }));
    $('#nmOk').addEventListener('click', () => closeNotice(true));
    $('#nmCancel').addEventListener('click', () => closeNotice(false));

    // 专业学习
    $('#examAdd').addEventListener('click', addExam);
    $('#studyAdd').addEventListener('click', addStudy);
    $('#studyFrom').addEventListener('change', renderStudyChart);
    $('#studyTo').addEventListener('change', renderStudyChart);
    // 学习趋势区间快捷键
    $$('#view-study [data-studyrange]').forEach((b) => b.addEventListener('click', () => {
      const n = +b.dataset.studyrange || 7;
      const to = new Date(), from = new Date();
      from.setDate(from.getDate() - (n - 1));
      $('#studyTo').value = dateStr(to);
      $('#studyFrom').value = dateStr(from);
      renderStudyChart();
    }));

    // 时政
    $('#newsSave').addEventListener('click', saveNews);
    $('#newsClear').addEventListener('click', () => {
      $('#newsTitle').value = ''; $('#newsBody').value = ''; $('#newsSource').value = '';
    });

    // 设置
    $$('[data-themeset]').forEach((b) => b.addEventListener('click', () => {
      Store.edit((d) => { d.settings.theme = b.dataset.themeset; });
      APP.applyTheme();
      renderSettings();
      if (currentView === 'money') renderMoney();
    }));
    $('#bdaySave').addEventListener('click', () => {
      const m = clamp(parseInt($('#bdayMonth').value, 10) || 10, 1, 12);
      const dd = clamp(parseInt($('#bdayDay').value, 10) || 16, 1, 31);
      Store.edit((s) => { s.settings.birthday = { month: m, day: dd }; });
      renderSettings();
      toast(`生日已设为 ${m} 月 ${dd} 日`);
    });
    $('#exportBtn').addEventListener('click', () => {
      try {
        const blob = new Blob([Store.export()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `纪念备份_${today()}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast('已导出备份');
      } catch (e) { toast('导出失败：' + e.message); }
    });
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          Store.import(String(rd.result));
          enIdx = null;
          $('#quote').dataset.filled = '';
          render(currentView); refreshHome();
          toast('已导入备份');
        } catch (err) { toast('导入失败：' + err.message); }
      };
      rd.readAsText(f);
      e.target.value = '';
    });
    $('#clearBtn').addEventListener('click', () => {
      if (!window.confirm('确定清空全部本地数据？\n待办、记账、三餐、运动、经期、收藏等都会被删除，且不可恢复。')) return;
      Store.clearAll();
      enIdx = null;
      $('#quote').dataset.filled = '';
      render(currentView); refreshHome();
      toast('已清空');
    });

    // ---------- 全局委托 ----------
    document.addEventListener('click', (e) => {
      const hit = (s) => e.target.closest(s);
      let el;

      // 待办卡片：勾选 / 详情 / 悬浮窗勾选
      if ((el = hit('[data-check]'))) { e.stopPropagation(); return toggleTodo(el.dataset.check); }
      const fabItem = hit('[data-fab]');
      if (fabItem) {
        const chk = e.target.closest('.chk');
        if (chk) { e.stopPropagation(); return toggleTodo(fabItem.dataset.fab); }
        openDetail(fabItem.dataset.fab);
        return;
      }
      const card = hit('.todo-card');
      if (card && !e.target.closest('.grip')) return openDetail(card.dataset.id);

      if ((el = hit('[data-del-exp]'))) { Store.edit((d) => { d.expenses = d.expenses.filter((x) => x.id !== el.dataset.delExp); }); renderMoney(); refreshHome(); return; }

      // 通用编辑：所有记录都可以点笔图标修改
      if ((el = hit('[data-edit-exp]'))) { openEdit('expense', el.dataset.editExp); return; }
      if ((el = hit('[data-edit-meal]'))) { openEdit('meal', el.dataset.editMeal); return; }
      if ((el = hit('[data-edit-work]'))) { openEdit('workout', el.dataset.editWork); return; }
      if ((el = hit('[data-edit-period]'))) { openEdit('period', el.dataset.editPeriod); return; }
      if ((el = hit('[data-edit-exam]'))) { openEdit('exam', el.dataset.editExam); return; }
      if ((el = hit('[data-edit-study]'))) { openEdit('study', el.dataset.editStudy); return; }
      if ((el = hit('[data-edit-avg]'))) {
        const ov = Store.data.settings.period || (Store.data.settings.period = {});
        if (el.dataset.editAvg === 'cycle') {
          const v = window.prompt('设置平均周期长度（天，15~60，留空恢复自动计算）：', ov.avgCycle || '');
          if (v === null) return;
          if (!v.trim()) delete ov.avgCycle; else ov.avgCycle = clamp(parseInt(v, 10) || 28, 15, 60);
        } else {
          const v = window.prompt('设置平均经期长度（天，1~14，留空恢复自动计算）：', ov.avgDur || '');
          if (v === null) return;
          if (!v.trim()) delete ov.avgDur; else ov.avgDur = clamp(parseInt(v, 10) || 5, 1, 14);
        }
        Store.save();
        renderPeriod(); refreshHome();
        toast('周期概览已更新');
        return;
      }

      if ((el = hit('[data-del-meal]'))) { Store.edit((d) => { d.meals = d.meals.filter((x) => x.id !== el.dataset.delMeal); }); renderLife(); refreshHome(); return; }
      if ((el = hit('[data-del-work]'))) { Store.edit((d) => { d.workouts = d.workouts.filter((x) => x.id !== el.dataset.delWork); }); renderLife(); refreshHome(); return; }
      if ((el = hit('[data-del-period]'))) { Store.edit((d) => { d.periods = d.periods.filter((x) => x.id !== el.dataset.delPeriod); }); renderPeriod(); refreshHome(); return; }
      if ((el = hit('[data-del-exam]'))) { Store.edit((d) => { d.exams = d.exams.filter((x) => x.id !== el.dataset.delExam); }); renderStudy(); refreshHome(); return; }
      if ((el = hit('[data-del-study]'))) { Store.edit((d) => { d.studyLogs = d.studyLogs.filter((x) => x.id !== el.dataset.delStudy); }); renderStudy(); refreshHome(); return; }

      if ((el = hit('[data-favfilter]'))) { favFilter = el.dataset.favfilter; pageState.fav.page = 1; renderLang(); return; }
      if ((el = hit('[data-pgpage]'))) {
        const k = el.dataset.pgkey;
        pageState[k].page += el.dataset.pgpage === 'prev' ? -1 : 1;
        rerenderList(k); return;
      }
      if ((el = hit('[data-pat-speak]'))) { speak(dailyPatterns()[+el.dataset.patSpeak].p); return; }
      if ((el = hit('[data-pat-fav]'))) {
        const pt = dailyPatterns()[+el.dataset.patFav];
        const dup = Store.data.favorites.find((f) => f.pat === pt.p);
        if (dup) {   // 再点一次 = 取消收藏
          Store.edit((d) => { d.favorites = d.favorites.filter((f) => f.id !== dup.id); });
          renderLang();
          toast('已取消收藏');
        } else {
          Store.edit((d) => d.favorites.push({ id: uid(), pat: pt.p, text: `${pt.p} ${pt.zh}`, cat: '作文模板', createdAt: Date.now() }));
          renderLang();
          checkCheer('patCheer');
          toast('已收藏到「作文模板」');
        }
        return;
      }
      if ((el = hit('[data-copy-fav]'))) { const f = Store.data.favorites.find((x) => x.id === el.dataset.copyFav); if (f) copyText(f.text); return; }
      if ((el = hit('[data-edit-fav]'))) {
        const f = Store.data.favorites.find((x) => x.id === el.dataset.editFav);
        if (!f) return;
        const v = window.prompt('修改内容：', f.text);
        if (v === null) return;
        if (!v.trim()) return toast('内容不能为空');
        Store.edit(() => { f.text = v.trim(); });
        renderLang(); return;
      }
      if ((el = hit('[data-del-fav]'))) { Store.edit((d) => { d.favorites = d.favorites.filter((x) => x.id !== el.dataset.delFav); }); renderLang(); return; }

      if ((el = hit('[data-load-news]'))) {
        const n = Store.data.news.find((x) => x.id === el.dataset.loadNews);
        if (!n) return;
        $('#newsDate').value = n.date; $('#newsTitle').value = n.title || '';
        $('#newsBody').value = n.body || ''; $('#newsSource').value = n.source || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if ((el = hit('[data-del-news]'))) { Store.edit((d) => { d.news = d.news.filter((x) => x.id !== el.dataset.delNews); }); renderNews(); return; }

      // 点弹窗遮罩关闭
      if (e.target.id === 'detailModal') $('#detailModal').classList.remove('show');
      if (e.target.id === 'editModal') closeEdit();
      if (e.target.id === 'noticeModal') closeNotice(false);
    });

    // 每页条数切换（收藏夹 / 明细 / 运动 / 学习 / 经期通用）
    document.addEventListener('change', (e) => {
      const sel = e.target.closest && e.target.closest('[data-pgsize]');
      if (!sel) return;
      const k = sel.dataset.pgsize;
      pageState[k].size = parseInt(sel.value, 10) || 10;
      pageState[k].page = 1;
      rerenderList(k);
    });

    // 悬浮窗内点击任务文本也要能打开详情（已在委托里处理）
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { $('#detailModal').classList.remove('show'); closeEdit(); closeNotice(false); $('#fabPanel').classList.add('hidden-panel'); }
    });
  }

  function openFab() {
    $('#fabPanel').classList.remove('hidden-panel');
    renderFabList();
    setTimeout(() => $('#fabInput').focus(), 120);
  }

  /* ==========================================================================
     初始化
     ========================================================================== */
  window.initWorkbench = function () {
    if (inited) return;
    inited = true;

    // 下拉选项
    $('#expCat').innerHTML = APP.EXPENSE_CATS.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    $('#mealType').innerHTML = APP.MEALS.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
    $('#workType').innerHTML = APP.EXERCISES.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
    $('#favCat').innerHTML = APP.FAV_CATS.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('');

    // 默认日期
    const t = today();
    $('#expDate').value = t;
    $('#mealDate').value = t;
    $('#workDate').value = t;
    const nd = new Date(); nd.setMonth(nd.getMonth() + 1);
    $('#examDate').value = dateStr(nd);

    // 考试临近提醒：点一下直达「专业学习」，顺手就能改考试日期
    const ea = $('#examAlert');
    if (ea) ea.addEventListener('click', () => go('study'));

    APP.dailyTodoReset();
    bind();
    initDrag();
    renderHome();
    renderFabList();
    maybePeriodReminder();
  };
})();
