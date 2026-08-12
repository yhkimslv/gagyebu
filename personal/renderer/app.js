/* ==================== 내 가계부 (개인용) ==================== */

/* 분류 색 — 0번은 회색(기타). dataviz 검증 통과 팔레트 */
const PALETTE = {
  light: ['#8d8480', '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark:  ['#948a85', '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
};
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const SAVE_CAT = '저축';
const FIXED_CAT = '고정지출';

function defaultCategories() {
  return {
    /* slot: 색 (1~8 이 서로 다른 색, 0 은 회색). 기본 분류를 8개로 맞춰 도넛 색이 겹치지 않게 한다.
       tip: 이 분류로 입력하면 팁 계산기가 나온다 */
    expense: [
      { name: '식비', emoji: '🍚', slot: 1, tip: true },
      { name: '카페·간식', emoji: '☕', slot: 2, tip: true },
      { name: '장보기·마트', emoji: '🛒', slot: 3 },
      { name: '교통·차량', emoji: '🚗', slot: 4 },
      { name: '문화·여가', emoji: '🎬', slot: 5, tip: true },
      { name: SAVE_CAT, emoji: '🐷', slot: 6 },
      { name: FIXED_CAT, emoji: '🔁', slot: 7 },
      { name: '쇼핑·미용', emoji: '🛍️', slot: 8 },
      { name: '기타', emoji: '📦', slot: 0 }
    ],
    income: [
      { name: '월급', emoji: '💰', slot: 1 },
      { name: '용돈', emoji: '🎁', slot: 5 },
      { name: '부수입', emoji: '💵', slot: 3 },
      { name: '기타', emoji: '📦', slot: 0 }
    ]
  };
}

/* 결제수단 — 카드를 미리 등록해두고 입력할 때 한 번만 누른다.
   rates 는 분류별 적립률(%), base 는 그 외 분류에 적용할 기본 적립률. */
function defaultMethods() {
  return [
    { id: 'cash', name: '현금', emoji: '💵', type: 'cash', memo: '', rates: {}, base: 0 }
  ];
}

function defaultSettings() {
  return {
    currency: 'USD',
    budget: 0,
    methods: defaultMethods(),
    lastMethod: 'cash',
    tipPresets: [15, 18, 20, 25],
    goal: { name: '', target: 0 },
    recurring: [],
    categories: defaultCategories(),
    supabaseUrl: '',
    supabaseKey: '',
    coupleCode: '',        // 화면에는 '내 코드' 로 표시 (동기화 테이블 컬럼 이름과 맞춰둠)
    lastPullAt: null,
    /* 잠금 설정 — 이 기기에만 남는다 (동기화로 올리지 않는다).
       비밀번호는 저장하지 않고, 되돌릴 수 없게 섞은 값(hash)만 둔다. */
    lock: null,
    retiredMethods: [],      // 지운 결제수단 (동기화로 다시 살아나지 않게)
    pushSub: null,           // 이 기기의 알림 구독
    retiredSubs: [],         // 알림을 끈 기기
    pushPrefs: { card: true, budget: true, update: true },
    link: null,              // 커플 가계부에서 가져오기 설정
    linkPullAt: null,        // 커플 가계부를 어디까지 읽어왔는지
    metaTs: null,            // 설정 항목별로 마지막에 바꾼 시각
    metaUpdatedAt: null,
    metaDirty: false
  };
}

/* 항목별 시각을 쓰기 전에 저장된 자료를 넘겨받는다.
   '이 기기에서 한 번도 손대지 않은 항목'은 아주 옛날에 정한 것으로 쳐서,
   다른 기기에서 정해둔 값을 덮어쓰지 않게 한다. (예: 맥에서 예산을 정한 적이 없으면
   맥이 아이폰의 예산을 0 으로 지워버리는 일이 없다) */
function seedMetaTs(s) {
  if (s.metaTs) return;
  const EPOCH = '1970-01-01T00:00:00Z';
  const base = defaultSettings();
  const stamp = s.metaUpdatedAt || EPOCH;
  const touched = (f) => JSON.stringify(s[f]) !== JSON.stringify(base[f]);
  s.metaTs = {};
  META_FIELDS.forEach((f) => { s.metaTs[f] = touched(f) ? stamp : EPOCH; });
}

/* ==================== 상태 ==================== */
let data = null;
let view = 'list';
let curMonth = todayStr().slice(0, 7);
let filters = { q: '', category: '' };
let selectedDay = null;
let editingId = null;
let draft = null;
let setDraftCats = null;
let setDraftRecur = null;
let confirmCb = null;
let syncTimer = null;
let toastTimer = null;

/* ==================== 유틸 ==================== */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }));

/* 함수 선언으로 둬야 파일 위쪽의 curMonth 초기화에서도 쓸 수 있다 */
function pad2(n) { return String(n).padStart(2, '0'); }

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function nowTime() { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

/* 시간은 'HH:MM' 으로 따로 둔다. 날짜(date)를 건드리면 달력·통계·반복지출이
   모두 날짜 문자열에 기대고 있어서 함께 흔들리기 때문이다. 없는 기록도 있다. */
function fmtTime(t) {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${pad2(m)}`;
}
/* 같은 날 안에서는 늦은 시각이 위로. 시간이 없는 기록은 맨 아래로 보낸다. */
function byTimeDesc(a, b) {
  const ta = a.time || '', tb = b.time || '';
  if (ta && tb) return tb.localeCompare(ta);
  if (ta) return -1;
  if (tb) return 1;
  return 0;
}
function isDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
function slotColor(slot) { return PALETTE[isDark() ? 'dark' : 'light'][slot] || PALETTE.light[0]; }
function cssVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }

function catOf(type, name) {
  const list = data.settings.categories[type] || [];
  return list.find((c) => c.name === name) || null;
}
function catColorOf(e) { const c = catOf(e.type, e.category); return slotColor(c ? c.slot : 0); }
function catEmojiOf(e) { const c = catOf(e.type, e.category); return c ? c.emoji : '📦'; }
function catHasTip(name) {
  const c = catOf('expense', name);
  return !!(c && c.tip);
}

/* --- 결제수단 --- */
function methods() { return data.settings.methods || []; }
function methodOf(id) { return methods().find((m) => m.id === id) || null; }
function methodLabel(id) {
  const m = methodOf(id);
  return m ? m.emoji + ' ' + m.name : '';
}
function methodRate(m, category) {
  if (!m) return 0;
  const r = m.rates && m.rates[category];
  return Number(r != null && r !== '' ? r : (m.base || 0)) || 0;
}
/* 이 분류에서 적립률이 가장 높은 카드 (동률이면 먼저 등록한 것) */
function bestMethodFor(category) {
  let best = null, bestRate = 0;
  for (const m of methods()) {
    const r = methodRate(m, category);
    if (r > bestRate) { bestRate = r; best = m; }
  }
  return bestRate > 0 ? { m: best, rate: bestRate } : null;
}

/* --- 금액 --- */
function isUSD() { return data.settings.currency === 'USD'; }
function roundMoney(n) { return isUSD() ? Math.round(n * 100) / 100 : Math.round(n); }

function fmtMoney(n) {
  if (isUSD()) {
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return Math.round(n).toLocaleString('ko-KR') + '원';
}
function fmtCompact(n) {
  if (isUSD()) {
    const a = Math.abs(n);
    // 100달러 미만은 센트까지, 그 이상은 달러 단위로 줄여 달력 칸에 들어가게
    const d = a < 100 ? 2 : 0;
    return '$' + a.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  return Math.abs(Math.round(n)).toLocaleString('ko-KR');
}
function monthLabel(m) { const [y, mo] = m.split('-'); return y + '년 ' + Number(mo) + '월'; }
function shiftMonth(m, d) {
  const [y, mo] = m.split('-').map(Number);
  const dt = new Date(y, mo - 1 + d, 1);
  return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1);
}
function daysInMonth(m) { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); }

/* --- 조회 --- */
function liveEntries() { return data.entries.filter((e) => !e.deleted); }
function ledger() { return liveEntries().filter((e) => e.type === 'expense' || e.type === 'income'); }
function monthLedger(m) { return ledger().filter((e) => e.date && e.date.startsWith(m)); }

/* ==================== 카드 갚기 ====================
 *
 * 이미 쌓인 카드 잔액은 '지출'로 넣지 않는다.
 * 그 돈은 지난 달들에 쓴 것이라, 이번 달 지출·예산에 섞이면 숫자가 엉망이 된다.
 * 그래서 카드 자체에 시작 금액(opening)으로 붙여두고, 여기서만 따로 계산한다.
 *
 *   갚을 돈 = 시작 금액 + (기준일 다음날부터 그 카드로 쓴 지출) − (그 카드에 갚은 돈)
 *
 * 갚은 돈(type: 'cardpay')도 지출이 아니다. 쓸 때 이미 지출로 세었거나
 * 시작 금액에 포함돼 있어서, 또 세면 두 번 세는 셈이 되기 때문이다. */
function cardPays() { return liveEntries().filter((e) => e.type === 'cardpay'); }

function isCreditM(m) { return !!m && m.type === 'credit'; }

/* 기준일 다음날부터의 기록만 센다.
   기준일까지의 일은 이미 시작 금액에 들어 있기 때문이다. */
function sinceFilter(since) { return (e) => !since || e.date > since; }

/* 신용카드 — 갚아야 할 돈 */
function cardDebt(m) {
  const opening = Number(m.opening) || 0;
  const since = m.openingDate || '';
  const after = sinceFilter(since);
  if (!opening && !cardPays().some((e) => e.method === m.id)) return null;   // 아직 안 쓰는 카드
  const spent = ledger()
    .filter((e) => e.type === 'expense' && e.method === m.id && after(e))
    .reduce((s, e) => s + e.amount, 0);
  const paid = cardPays().filter((e) => e.method === m.id).reduce((s, e) => s + e.amount, 0);
  return { opening, since, spent, paid, left: Math.max(0, opening + spent - paid) };
}

/* 현금·체크카드 — 남아있는 돈
   시작 금액에서 쓴 돈과 카드값 갚은 돈을 빼고, 들어온 돈을 더한다. */
function cashLeft(m) {
  const opening = Number(m.opening) || 0;
  const since = m.openingDate || '';
  const after = sinceFilter(since);
  const mine = (e) => e.method === m.id && after(e);
  const touched = liveEntries().some((e) => e.method === m.id || e.from === m.id);
  if (!opening && !touched) return null;
  const spent = ledger().filter((e) => e.type === 'expense' && mine(e))
    .reduce((s, e) => s + e.amount, 0);
  const earned = ledger().filter((e) => e.type === 'income' && mine(e))
    .reduce((s, e) => s + e.amount, 0);
  const paidOut = cardPays().filter((e) => e.from === m.id && after(e))
    .reduce((s, e) => s + e.amount, 0);
  return { opening, since, spent, earned, paidOut, left: opening + earned - spent - paidOut };
}

/* 가진 돈 · 갚을 돈 · 순자산 */
function moneySummary() {
  const assets = [];
  const debts = [];
  methods().forEach((m) => {
    if (isCreditM(m)) {
      const d = cardDebt(m);
      if (d) debts.push({ method: m, ...d });
    } else {
      const c = cashLeft(m);
      if (c) assets.push({ method: m, ...c });
    }
  });
  const have = assets.reduce((s, r) => s + r.left, 0);
  const owe = debts.reduce((s, r) => s + r.left, 0);
  const owedTotal = debts.reduce((s, r) => s + r.opening + r.spent, 0);
  const paid = debts.reduce((s, r) => s + r.paid, 0);
  return { assets, debts, have, owe, net: have - owe, owedTotal, paid };
}

function touch(e) { e.updatedAt = new Date().toISOString(); e.dirty = true; }
/* 공유 설정은 '항목마다' 따로 바뀐 시각을 남긴다.
   예전엔 설정 전체를 한 덩어리로 비교해서, 한쪽에서 카드 하나만 추가해도
   다른 기기에서 정해둔 예산까지 통째로 덮어써 사라졌다. */
const META_FIELDS = ['categories', 'budget', 'currency', 'goal', 'recurring',
  'methods', 'retiredMethods'];
function markMeta(...fields) {
  const s = data.settings;
  const now = new Date().toISOString();
  s.metaTs = s.metaTs || {};
  (fields.length ? fields : META_FIELDS).forEach((f) => { s.metaTs[f] = now; });
  s.metaUpdatedAt = now;
  s.metaDirty = true;
}
function afterChange() { Store.save(data); render(); scheduleSync(); }

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

/* ==================== 반복 지출 자동 입력 ==================== */
function applyRecurring() {
  const today = todayStr();
  const curM = today.slice(0, 7);
  let added = 0;

  for (const r of data.settings.recurring || []) {
    if (r.active === false) continue;
    let m = r.since || curM;
    for (let guard = 0; guard < 120 && m <= curM; guard++) {
      const day = Math.min(Number(r.day) || 1, daysInMonth(m));
      const date = m + '-' + pad2(day);
      if (date <= today) {
        const id = 'rec_' + r.id + '_' + m;
        // 지웠던 항목도 tombstone 으로 남아 있어 다시 생기지 않음
        if (!data.entries.some((e) => e.id === id)) {
          data.entries.push({
            id, date, type: 'expense',
            amount: Number(r.amount) || 0,
            category: r.category || FIXED_CAT,
            memo: r.memo || '',
            method: r.method || '',      // 그 카드 잔액에도 반영되도록
            tip: 0,
            auto: true,
            updatedAt: new Date().toISOString(),
            deleted: false, dirty: true
          });
          added++;
        }
      }
      m = shiftMonth(m, 1);
    }
  }
  return added;
}

/* ==================== 초기화 ==================== */
async function init() {
  data = (await Store.load()) || { entries: [], settings: defaultSettings() };
  data.entries = data.entries || [];
  data.settings = Object.assign(defaultSettings(), data.settings || {});
  if (!data.settings.categories || !data.settings.categories.expense) {
    data.settings.categories = defaultCategories();
  }
  if (!data.settings.goal) data.settings.goal = { name: '', target: 0 };
  if (!Array.isArray(data.settings.recurring)) data.settings.recurring = [];
  if (!Array.isArray(data.settings.tipPresets)) data.settings.tipPresets = [15, 18, 20, 25];
  if (!Array.isArray(data.settings.methods) || !data.settings.methods.length) {
    data.settings.methods = defaultMethods();
  }
  if (!methodOf(data.settings.lastMethod)) data.settings.lastMethod = methods()[0].id;
  if (!Array.isArray(data.settings.retiredMethods)) data.settings.retiredMethods = [];
  seedMetaTs(data.settings);   // 항목별 시각이 없던 예전 자료를 넘겨받는다
  const defCats = defaultCategories().expense;
  data.settings.categories.expense.forEach((c) => {
    const d = defCats.find((x) => x.name === c.name);
    if (c.tip === undefined) c.tip = !!(d && d.tip);
  });

  Sync.configure(data.settings);
  Sync.onStatus(renderSyncStatus);
  bindStatic();
  bindLock();
  Lock.start();          // 잠금이 켜져 있으면 화면을 덮는다

  if (applyRecurring()) Store.save(data);

  render();
  renderSyncStatus(Sync.getStatus());

  runSync();
  setInterval(runSync, 60000);
  setInterval(() => { if (applyRecurring()) afterChange(); }, 3600000);
  window.addEventListener('focus', runSync);
  window.addEventListener('online', runSync);

  /* 아이폰은 앱을 나갈 때 beforeunload 를 부르지 않는다.
     화면이 가려지는 순간에 밀린 저장을 반드시 밀어넣어야 다시 열었을 때 그대로 남아 있다. */
  const flushSave = () => { Store.flush(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
  window.addEventListener('pagehide', flushSave);
  window.addEventListener('blur', flushSave);
  window.addEventListener('beforeunload', flushSave);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
}

function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(runSync, 2500); }
async function runSync() {
  let changed = false;
  /* 커플 가계부에서 먼저 가져온 뒤 내 기기끼리 동기화한다.
     그래야 가져온 기록이 같은 차례에 다른 기기로도 넘어간다. */
  try {
    if (Link.cfgOf(data.settings)) {
      const r = await Link.pull(data);
      if (r.changed) changed = true;
    }
  } catch (e) {
    console.log('커플 가계부 가져오기 실패:', e.message);
  }
  if (Sync.isConfigured()) {
    const r = await Sync.syncNow(data);
    if (r.changed) changed = true;
  }
  if (changed) applyRecurring();
  Store.saveNow(data);
  if (changed) render();
}

/* ==================== 이벤트 ==================== */
function bindStatic() {
  $('#btnPrevMonth').addEventListener('click', () => { curMonth = shiftMonth(curMonth, -1); selectedDay = null; render(); });
  $('#btnNextMonth').addEventListener('click', () => { curMonth = shiftMonth(curMonth, 1); selectedDay = null; render(); });
  $('#monthLabel').addEventListener('click', () => { curMonth = todayStr().slice(0, 7); selectedDay = null; render(); });
  $('#btnAdd').addEventListener('click', () => openEntryModal(null));
  $('#btnSettings').addEventListener('click', openSettings);
  $('#syncStatus').addEventListener('click', () => {
    if (!Sync.isConfigured()) openSettings(); else runSync();
  });

  $('#tabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.tab');
    if (!btn) return;
    view = btn.dataset.view;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === btn));
    renderView();
  });

  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => $('#' + b.dataset.close).classList.add('hidden')));
  document.querySelectorAll('.modal-backdrop').forEach((bd) => {
    bd.addEventListener('mousedown', (ev) => { if (ev.target === bd) bd.classList.add('hidden'); });
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ['entryModal', 'settingsModal', 'confirmModal'].forEach((id) => $('#' + id).classList.add('hidden'));
    }
  });

  /* --- 입력 모달 --- */
  $('#typeSeg').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    captureDraft();
    draft.type = b.dataset.type;
    const list = data.settings.categories[draft.type];
    if (!list.some((c) => c.name === draft.category)) draft.category = list[0].name;
    if (draft.type !== 'expense') { draft.tipMode = 'none'; draft.tip = 0; }
    recalcTip();
    renderEntryModal();
  });
  $('#catGrid').addEventListener('click', (ev) => {
    const chip = ev.target.closest('.cat-chip');
    if (!chip) return;
    captureDraft();
    draft.category = chip.dataset.name;
    // 팁을 안 받는 분류로 옮기면 팁도 없앤다
    if (!catHasTip(draft.category)) { draft.tipMode = 'none'; draft.tip = 0; }
    recalcTip();
    renderEntryModal();
  });
  $('#methodGrid').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-method]');
    if (!b) return;
    captureDraft();
    draft.method = b.dataset.method;
    renderMethodPicker();
  });
  $('#inAmount').addEventListener('input', onAmountInput);

  /* --- 팁 --- */
  $('#tipChips').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tip]');
    if (!b) return;
    captureDraft();
    const v = b.dataset.tip;
    draft.tipMode = (v === 'none' || v === 'custom') ? v : Number(v);
    if (v === 'custom' && !draft.tip) draft.tip = roundMoney(draft.base * 0.18);
    recalcTip();
    renderEntryModal();
    if (draft.tipMode === 'custom') $('#inTip').focus();
  });
  $('#inTip').addEventListener('input', () => {
    $('#inTip').value = maskAmount($('#inTip').value);
    draft.tip = toNum($('#inTip').value);
    draft.amount = roundMoney(draft.base + draft.tip);
    $('#inTotal').value = draft.amount ? formatAmountStr(draft.amount) : '';
    refreshTipSummary();
  });
  $('#inTotal').addEventListener('input', () => {
    $('#inTotal').value = maskAmount($('#inTotal').value);
    // 총액에서 식사비를 빼서 팁을 거꾸로 구한다
    draft.tip = Math.max(0, roundMoney(toNum($('#inTotal').value) - draft.base));
    draft.amount = roundMoney(draft.base + draft.tip);
    $('#inTip').value = draft.tip ? formatAmountStr(draft.tip) : '';
    refreshTipSummary();
  });

  $('#btnSaveEntry').addEventListener('click', saveEntry);
  $('#btnDeleteEntry').addEventListener('click', deleteEntry);
  $('#inAmount').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') saveEntry(); });
  $('#inMemo').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') saveEntry(); });

  /* --- 설정 --- */
  $('#btnGenCode').addEventListener('click', () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = 'ME-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    $('#setCoupleCode').value = code;
  });
  $('#btnSaveSettings').addEventListener('click', () => saveSettings(false));
  $('#btnSyncNow').addEventListener('click', async () => {
    saveSettings(true);
    if (!Sync.isConfigured()) { $('#syncInfo').textContent = 'URL·키·내 코드를 모두 넣어주세요.'; return; }
    $('#syncInfo').textContent = '동기화 중…';
    await runSync();
    const st = Sync.getStatus();
    $('#syncInfo').textContent = st.state === 'ok'
      ? '✓ 연결됐어요! 이제 기기끼리 합쳐집니다.'
      : '⚠ 실패: ' + (st.error || '연결을 확인해주세요');
  });

  $('#catManage').addEventListener('click', (ev) => {
    const tipCat = ev.target.closest('[data-tipcat]');
    if (tipCat) {
      const c = setDraftCats.expense.find((x) => x.name === tipCat.dataset.tipcat);
      if (c) c.tip = !c.tip;
      renderCatManage(); return;
    }
    const del = ev.target.closest('[data-del]');
    if (del) {
      setDraftCats[del.dataset.type] = setDraftCats[del.dataset.type].filter((c) => c.name !== del.dataset.del);
      renderCatManage(); return;
    }
    const add = ev.target.closest('[data-add]');
    if (add) {
      const input = $('#catAdd-' + add.dataset.add);
      addCategory(add.dataset.add, input.value);
      input.value = '';
    }
  });
  $('#catManage').addEventListener('keydown', (ev) => {
    const input = ev.target.closest('input[data-addinput]');
    if (ev.key !== 'Enter' || !input) return;
    addCategory(input.dataset.addinput, input.value);
    input.value = '';
  });

  /* --- 결제수단 관리 --- */
  $('#methodManage').addEventListener('click', (ev) => {
    const del = ev.target.closest('[data-mdel]');
    if (del) { deleteMethodById(del.dataset.mdel); return; }   // 행 클릭보다 먼저
    const item = ev.target.closest('[data-medit]');
    if (item) openMethodModal(item.dataset.medit);
  });
  $('#btnMethodAdd').addEventListener('click', () => {
    const raw = $('#methodAdd').value.trim();
    $('#methodAdd').value = '';
    openMethodModal(null);
    if (raw) {
      const m = raw.match(/^(\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*)\s*(.+)$/u);
      $('#inMethodEmoji').value = m ? m[1] : '💳';
      $('#inMethodName').value = (m ? m[2] : raw).trim();
    }
  });
  $('#methodAdd').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') $('#btnMethodAdd').click(); });
  $('#methodTypeSeg').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    methodDraftType = b.dataset.mtype;
    renderMethodModal();
  });
  $('#btnMethodSave').addEventListener('click', saveMethod);
  $('#btnMethodDelete').addEventListener('click', deleteMethod);
  $('#rateGrid').addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-rate]');
    if (el) methodDraftRates[el.dataset.rate] = el.value;
  });

  $('#btnRecAdd').addEventListener('click', addRecurring);
  $('#recAmount').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') addRecurring(); });
  $('#recurList').addEventListener('click', (ev) => {
    const del = ev.target.closest('[data-recdel]');
    if (!del) return;
    setDraftRecur = setDraftRecur.filter((r) => r.id !== del.dataset.recdel);
    renderRecurList();
  });

  $('#btnCsvMonth').addEventListener('click', () => exportCsv(true));
  $('#btnCsvAll').addEventListener('click', () => exportCsv(false));

  $('#btnConfirmOk').addEventListener('click', () => {
    $('#confirmModal').classList.add('hidden');
    const cb = confirmCb; confirmCb = null;
    if (cb) cb();
  });

  /* --- 카드값 갚기 --- */
  $('#btnPaySave').addEventListener('click', savePay);
  $('#inPayAmount').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') savePay(); });
  $('#payQuick').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-quick]');
    if (b) $('#inPayAmount').value = b.dataset.quick;
  });
  $('#payFromGrid').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-payfrom]');
    if (b) { payFromId = b.dataset.payfrom; renderPayFrom(); }
  });

  /* --- 본문 위임 --- */
  $('#view').addEventListener('click', (ev) => {
    const pay = ev.target.closest('[data-pay]');
    if (pay) { openPayModal(pay.dataset.pay); return; }
    const paydel = ev.target.closest('[data-paydel]');
    if (paydel) { deletePay(paydel.dataset.paydel); return; }
    if (ev.target.closest('#btnGoMethods')) { openSettings(); return; }
    const row = ev.target.closest('.entry-row');
    if (row && row.dataset.id) {
      const e = data.entries.find((x) => x.id === row.dataset.id);
      if (e) openEntryModal(e);
      return;
    }
    const cell = ev.target.closest('.cal-cell[data-date]');
    if (cell) { selectedDay = selectedDay === cell.dataset.date ? null : cell.dataset.date; renderView(); }
  });
  $('#view').addEventListener('input', (ev) => {
    if (ev.target.id === 'fQ') { filters.q = ev.target.value; renderView(); }
  });
  $('#view').addEventListener('change', (ev) => {
    if (ev.target.id === 'fCategory') { filters.category = ev.target.value; renderView(); }
  });
}

function askConfirm(opt, cb) {
  $('#confirmEmoji').textContent = opt.emoji || '🗑️';
  $('#confirmTitle').textContent = opt.title || '';
  $('#confirmText').innerHTML = opt.text || '';
  $('#btnConfirmOk').textContent = opt.ok || '확인';
  $('#btnConfirmOk').className = 'btn ' + (opt.danger ? 'danger' : 'primary');
  confirmCb = cb;
  $('#confirmModal').classList.remove('hidden');
}

function addCategory(type, raw) {
  const val = (raw || '').trim();
  if (!val) return;
  const m = val.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.+)$/u);
  const emoji = m ? m[1] : '🏷️';
  const name = (m ? m[2] : val).trim();
  if (!name || setDraftCats[type].some((c) => c.name === name)) return;
  // 가장 적게 쓰인 색부터 배정해 같은 색이 겹치는 걸 최대한 미룬다
  const count = {};
  for (let i = 1; i <= 8; i++) count[i] = 0;
  setDraftCats[type].forEach((c) => { if (c.slot > 0) count[c.slot]++; });
  const slot = Number(Object.keys(count).sort((a, b) => count[a] - count[b] || a - b)[0]);
  const cat = { name, emoji, slot };
  if (type === 'expense') cat.tip = false;
  setDraftCats[type].push(cat);
  renderCatManage();
}

function addRecurring() {
  const day = Math.min(31, Math.max(1, Number($('#recDay').value) || 0));
  const memo = $('#recMemo').value.trim();
  const amount = toNum($('#recAmount').value);
  if (!day || !memo || !(amount > 0)) { toast('날짜·내용·금액을 모두 넣어주세요'); return; }
  setDraftRecur.push({
    id: uuid().slice(0, 8), day, amount, memo,
    method: $('#recMethod').value || '',      // 어느 카드로 나가는 돈인지
    category: FIXED_CAT, since: todayStr().slice(0, 7), active: true
  });
  $('#recDay').value = ''; $('#recMemo').value = ''; $('#recAmount').value = '';
  renderRecurList();
}

/* ==================== 렌더링 ==================== */
function render() {
  $('#monthLabel').textContent = monthLabel(curMonth);
  renderSummary();
  renderView();
}

function renderSummary() {
  const list = monthLedger(curMonth);
  const income = list.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const expense = list.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const net = income - expense;
  const prev = monthLedger(shiftMonth(curMonth, -1))
    .filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

  let delta = '';
  if (prev > 0) {
    const diff = expense - prev;
    const pct = Math.round(Math.abs(diff / prev) * 100);
    delta = diff === 0
      ? '<div class="delta">지난달과 같아요</div>'
      : `<div class="delta ${diff > 0 ? 'up' : 'down'}">지난달보다 <b>${diff > 0 ? '▲' : '▼'} ${pct}%</b> ${diff > 0 ? '더 썼어요' : '아꼈어요'}</div>`;
  }

  const budget = Number(data.settings.budget) || 0;
  let budgetCard = '';
  if (budget > 0) {
    const pct = Math.min(100, (expense / budget) * 100);
    const over = expense > budget;
    const warn = !over && pct >= 80;
    const color = over ? 'var(--critical)' : warn ? 'var(--warn)' : 'var(--accent)';
    budgetCard = `
      <div class="sum-card">
        <div class="lbl">예산 ${fmtMoney(budget)}</div>
        <div class="val">${Math.round((expense / budget) * 100)}%</div>
        <div class="budget-bar"><div style="width:${pct}%;background:${color}"></div></div>
        <div class="budget-note">${over
          ? '⚠ ' + fmtMoney(expense - budget) + ' 초과'
          : '남은 예산 ' + fmtMoney(budget - expense)}</div>
      </div>`;
  }

  $('#summary').className = 'summary' + (budget > 0 ? ' has-budget' : '');
  $('#summary').innerHTML = `
    <div class="sum-card">
      <div class="lbl">이번 달 지출</div>
      <div class="val expense">${fmtMoney(expense)}</div>${delta}
    </div>
    <div class="sum-card"><div class="lbl">수입</div><div class="val income">${fmtMoney(income)}</div></div>
    <div class="sum-card">
      <div class="lbl">남은 돈</div>
      <div class="val">${net < 0 ? '−' : ''}${fmtMoney(Math.abs(net))}</div>
    </div>
    ${budgetCard}`;
}

function renderView() {
  if (view === 'list') renderList();
  else if (view === 'calendar') renderCalendar();
  else if (view === 'cards') renderCards();
  else renderStats();
}

/* ---------- 잔액 (가진 돈 · 갚을 돈) ---------- */
function renderCards() {
  const m = moneySummary();

  if (!m.assets.length && !m.debts.length) {
    $('#view').innerHTML = `
      <div class="empty">
        <div class="big-emoji">💳</div>
        <p>아직 시작 금액을 넣은 결제수단이 없어요.</p>
        <p class="tiny">설정 → 결제수단에서 <b>시작 금액</b> 을 넣어주세요.<br>
          신용카드는 <b>갚아야 할 잔액</b>, 현금·체크카드는 <b>지금 들어있는 돈</b> 입니다.</p>
        <button class="btn primary" id="btnGoMethods">결제수단 설정 열기</button>
      </div>`;
    return;
  }

  const assetHtml = m.assets.map((r) => `
    <div class="bal-row ${r.left < 0 ? 'minus' : ''}">
      <span class="ic">${r.method.emoji || '💵'}</span>
      <span class="nm">${esc(r.method.name)}</span>
      <span class="amt">${fmtMoney(r.left)}</span>
    </div>`).join('');

  const debtHtml = m.debts.slice().sort((a, b2) => b2.left - a.left).map((r) => {
    const start = r.opening + r.spent;
    const pct = start > 0 ? Math.min(100, (r.paid / start) * 100) : 0;
    const cleared = r.left === 0;
    return `
      <div class="debt-card ${cleared ? 'cleared' : ''}">
        <div class="debt-top">
          <span class="ic">${r.method.emoji || '💳'}</span>
          <span class="nm">${esc(r.method.name)}</span>
          <span class="left">${cleared ? '✅ 다 갚았어요' : fmtMoney(r.left)}</span>
        </div>
        <div class="debt-bar"><div style="width:${pct}%"></div></div>
        <div class="debt-sub">
          <span>시작 ${fmtMoney(r.opening)}${r.spent ? ` + 이후 사용 ${fmtMoney(r.spent)}` : ''}</span>
          <span>갚음 ${fmtMoney(r.paid)}</span>
        </div>
        <div class="debt-actions">
          <button class="btn small primary" data-pay="${esc(r.method.id)}">갚기</button>
        </div>
      </div>`;
  }).join('');

  const donePct = m.owedTotal > 0 ? Math.min(100, (m.paid / m.owedTotal) * 100) : 0;
  const paidThisMonth = cardPays()
    .filter((e) => e.date && e.date.startsWith(curMonth))
    .reduce((s, e) => s + e.amount, 0);

  const history = cardPays().sort((a, b2) => b2.date.localeCompare(a.date)).slice(0, 12);
  const historyHtml = history.length ? `
    <h3 class="sec-title">갚은 기록</h3>
    <div class="pay-log">
      ${history.map((e) => {
        const dt = new Date(e.date + 'T00:00:00');
        const from = e.from ? ` ← ${esc(methodLabel(e.from) || '')}` : '';
        return `
        <div class="pay-row">
          <span class="dt">${dt.getMonth() + 1}월 ${dt.getDate()}일</span>
          <span class="nm">${esc(methodLabel(e.method) || '카드')}${from}${e.memo ? ` · ${esc(e.memo)}` : ''}</span>
          <span class="amt">${fmtMoney(e.amount)}</span>
          <button class="del" data-paydel="${esc(e.id)}" title="삭제">✕</button>
        </div>`;
      }).join('')}
    </div>` : '';

  $('#view').innerHTML = `
    <div class="net-hero ${m.net < 0 ? 'minus' : ''}">
      <div class="lbl">순자산 <small>가진 돈 − 갚을 돈</small></div>
      <div class="big">${m.net < 0 ? '−' : ''}${fmtMoney(Math.abs(m.net))}</div>
      <div class="net-split">
        <span class="have">가진 돈 ${fmtMoney(m.have)}</span>
        <span class="owe">갚을 돈 ${fmtMoney(m.owe)}</span>
      </div>
    </div>

    ${m.assets.length ? `
      <h3 class="sec-title">가진 돈</h3>
      <div class="bal-list">${assetHtml}</div>` : ''}

    ${m.debts.length ? `
      <h3 class="sec-title">갚을 돈</h3>
      <div class="debt-hero ${m.owe === 0 ? 'done' : ''}">
        <div class="debt-bar big"><div style="width:${donePct}%"></div></div>
        <div class="debt-sub">
          <span>${fmtMoney(m.paid)} 갚음 · ${Math.round(donePct)}%</span>
          <span>전체 ${fmtMoney(m.owedTotal)}</span>
        </div>
        ${paidThisMonth > 0
          ? `<div class="debt-month">이번 달 <b>${fmtMoney(paidThisMonth)}</b> 갚았어요 👏</div>`
          : '<div class="debt-month tiny">이번 달은 아직 갚은 기록이 없어요</div>'}
      </div>
      <div class="debt-list">${debtHtml}</div>` : ''}

    ${historyHtml}`;
}

/* ---------- 내역 ---------- */
function entryRowHtml(e) {
  const color = catColorOf(e);
  const sign = e.type === 'income' ? '+' : '−';
  const title = e.memo || e.category || '(내용 없음)';
  const sub = [fmtTime(e.time), e.category, methodLabel(e.method),
    e.tip ? '팁 ' + fmtMoney(e.tip) : null].filter(Boolean).join(' · ');
  return `
    <button class="entry-row" data-id="${e.id}">
      <span class="entry-emoji" style="background:${color}22">${catEmojiOf(e)}</span>
      <span class="entry-main">
        <span class="entry-title">
          <span class="t">${esc(title)}</span>
          ${e.auto ? '<span class="pill auto">자동</span>' : ''}
          ${e.fromCouple ? '<span class="pill couple">커플</span>' : ''}
        </span>
        <span class="entry-sub">${esc(sub)}</span>
      </span>
      <span class="entry-amt ${e.type}">${sign}${fmtMoney(e.amount)}</span>
    </button>`;
}

function applyFilters(list) {
  return list.filter((e) => {
    if (filters.category && e.category !== filters.category) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const nm = (methodOf(e.method) || {}).name || '';
      if (![e.memo, e.category, nm].join(' ').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function renderList() {
  const all = monthLedger(curMonth);
  const list = applyFilters(all);
  const cats = [...new Set([...data.settings.categories.expense, ...data.settings.categories.income].map((c) => c.name))];

  const toolbar = `
    <div class="list-toolbar">
      <input type="search" id="fQ" placeholder="내용·분류 검색" value="${esc(filters.q)}">
      <select id="fCategory">
        <option value="">모든 분류</option>
        ${cats.map((c) => `<option value="${esc(c)}" ${filters.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
    </div>`;

  if (!list.length) {
    $('#view').innerHTML = toolbar + `
      <div class="empty">
        <div class="big-emoji">${all.length ? '🔍' : '🌱'}</div>
        ${all.length ? '조건에 맞는 내역이 없어요'
          : '아직 내역이 없어요.<br>오른쪽 위 <b>＋ 입력</b>으로 시작해보세요!'}
      </div>`;
    return;
  }

  const byDay = {};
  list.forEach((e) => { (byDay[e.date] = byDay[e.date] || []).push(e); });

  const html = Object.keys(byDay).sort().reverse().map((d) => {
    const es = byDay[d].slice().sort(byTimeDesc);   // 같은 날 안에서는 늦은 시각이 위로
    const inc = es.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const exp = es.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const dt = new Date(d + 'T00:00:00');
    const tot = [inc ? '+' + fmtMoney(inc) : '', exp ? '−' + fmtMoney(exp) : ''].filter(Boolean).join('  ');
    return `
      <div class="day-group">
        <div class="day-head">
          <span class="d">${dt.getMonth() + 1}월 ${dt.getDate()}일</span>
          <span class="dow">${DOW[dt.getDay()]}요일</span>
          <span class="tot">${tot}</span>
        </div>
        <div class="day-card">${es.map(entryRowHtml).join('')}</div>
      </div>`;
  }).join('');

  $('#view').innerHTML = toolbar + html;
}

/* ---------- 달력 ---------- */
function renderCalendar() {
  const [y, mo] = curMonth.split('-').map(Number);
  const startDow = new Date(y, mo - 1, 1).getDay();
  const dim = daysInMonth(curMonth);
  const today = todayStr();

  const byDay = {};
  monthLedger(curMonth).forEach((e) => {
    const d = byDay[e.date] = byDay[e.date] || { inc: 0, exp: 0 };
    if (e.type === 'income') d.inc += e.amount; else d.exp += e.amount;
  });

  let cells = DOW.map((d, i) => `<div class="cal-dow ${i === 0 ? 'sun' : ''}">${d}</div>`).join('');
  for (let i = 0; i < startDow; i++) cells += '<div class="cal-cell out"></div>';
  for (let day = 1; day <= dim; day++) {
    const ds = curMonth + '-' + pad2(day);
    const t = byDay[ds];
    const dow = (startDow + day - 1) % 7;
    cells += `
      <button class="cal-cell ${ds === today ? 'today' : ''} ${ds === selectedDay ? 'selected' : ''}" data-date="${ds}">
        <span class="cal-day ${dow === 0 ? 'sun-d' : ''}">${day}</span>
        ${t && t.inc ? `<span class="cal-inc">+${fmtCompact(t.inc)}</span>` : ''}
        ${t && t.exp ? `<span class="cal-exp">−${fmtCompact(t.exp)}</span>` : ''}
      </button>`;
  }

  let detail;
  if (selectedDay) {
    const es = monthLedger(curMonth).filter((e) => e.date === selectedDay).sort(byTimeDesc);
    const dt = new Date(selectedDay + 'T00:00:00');
    detail = `
      <div class="cal-detail-title">${dt.getMonth() + 1}월 ${dt.getDate()}일 (${DOW[dt.getDay()]})</div>
      ${es.length ? `<div class="day-card">${es.map(entryRowHtml).join('')}</div>`
        : '<div class="empty" style="padding:28px 0">이 날은 쓴 돈이 없어요</div>'}`;
  } else {
    detail = '<p class="hint" style="text-align:center">날짜를 누르면 그날 내역이 보여요</p>';
  }

  $('#view').innerHTML = `<div class="cal-card"><div class="cal-grid">${cells}</div></div>` + detail;
}

/* ---------- 통계 ---------- */
function renderStats() {
  const expenses = monthLedger(curMonth).filter((e) => e.type === 'expense');
  const goalCard = goalCardHtml();

  if (!expenses.length) {
    $('#view').innerHTML = goalCard +
      `<div class="empty"><div class="big-emoji">📊</div>이번 달 지출이 없어서 보여줄 통계가 없어요</div>`;
    return;
  }
  $('#view').innerHTML = goalCard + `
    <div class="stats-grid">
      <div class="card full"><h3>분류별 지출 <small>${monthLabel(curMonth)}</small></h3>
        <div class="donut-wrap">${donutHtml(expenses)}</div></div>
      ${methodCardHtml(expenses)}
      <div class="card full"><h3>일별 지출 <small>${monthLabel(curMonth)}</small></h3>
        ${dailyBarsHtml(expenses)}</div>
    </div>`;
  bindChartHover();
}

/* 결제수단별 이번 달 지출. 신용카드는 결제일도 같이 보여준다. */
function methodCardHtml(expenses) {
  // 지워진 결제수단으로 기록된 내역도 빠뜨리지 않도록 '없음' 으로 모은다
  const totals = {};
  let unknown = 0;
  expenses.forEach((e) => {
    if (methodOf(e.method)) totals[e.method] = (totals[e.method] || 0) + e.amount;
    else unknown += e.amount;
  });
  const rows = methods()
    .map((m) => ({ m, amt: totals[m.id] || 0 }))
    .filter((r) => r.amt > 0)
    .sort((a, b) => b.amt - a.amt);
  if (!rows.length && !unknown) return '';

  const max = Math.max(...rows.map((r) => r.amt), unknown, 1);
  const bar = (label, sub, amt, color) => `
    <div class="who-row method-row">
      <span class="nm">${label}</span>
      <span class="track"><span class="fill" style="display:block;width:${Math.max(2, (amt / max) * 100)}%;background:${color}"></span></span>
      <span class="amt">${fmtMoney(amt)}</span>
    </div>${sub ? `<p class="hint tiny" style="margin:-6px 0 10px 158px">${sub}</p>` : ''}`;

  let html = rows.map((r, i) => bar(
    `${r.m.emoji || '💳'} ${esc(r.m.name)}`,
    r.m.type === 'credit' && r.m.billingDay ? `매달 ${r.m.billingDay}일 결제 예정` : '',
    r.amt,
    slotColor((i % 8) + 1)
  )).join('');
  if (unknown > 0) html += bar('결제수단 없음', '', unknown, 'var(--muted)');

  return `<div class="card full"><h3>결제수단별 지출 <small>${monthLabel(curMonth)}</small></h3>${html}</div>`;
}

function goalCardHtml() {
  const goal = data.settings.goal || {};
  if (!(goal.target > 0)) return '';
  const saved = liveEntries()
    .filter((e) => e.type === 'expense' && e.category === SAVE_CAT)
    .reduce((s, e) => s + e.amount, 0);
  const pct = Math.min(100, (saved / goal.target) * 100);
  const done = saved >= goal.target;
  return `
    <div class="card goal-card">
      <div class="goal-head">
        <span class="goal-name">🐷 ${esc(goal.name || '저축 목표')}</span>
        <span class="goal-pct">${Math.round(pct)}%</span>
      </div>
      <div class="goal-bar"><div style="width:${pct}%"></div></div>
      <div class="goal-nums">
        <span>모은 돈 <b>${fmtMoney(saved)}</b></span>
        <span>${done ? '🎉 목표 달성!' : '목표까지 <b>' + fmtMoney(goal.target - saved) + '</b>'}</span>
      </div>
    </div>`;
}

function donutHtml(expenses) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = {};
  expenses.forEach((e) => { const k = e.category || '기타'; byCat[k] = (byCat[k] || 0) + e.amount; });
  let items = Object.entries(byCat).map(([name, amt]) => {
    const c = catOf('expense', name);
    return { name, amt, slot: c ? c.slot : 0, emoji: c ? c.emoji : '📦' };
  }).sort((a, b) => b.amt - a.amt);
  if (items.length > 8) {
    const rest = items.slice(7);
    items = items.slice(0, 7);
    items.push({ name: '그 외', amt: rest.reduce((s, x) => s + x.amt, 0), slot: 0, emoji: '📦' });
  }

  const R = 58, C = 2 * Math.PI * R, GAP = 2;
  let off = 0;
  const segs = items.map((it) => {
    const frac = it.amt / total;
    const len = Math.max(0, frac * C - GAP);
    const s = `<circle r="${R}" cx="80" cy="80" fill="none" stroke="${slotColor(it.slot)}" stroke-width="26"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"
      data-tip="${esc(it.name)}|${fmtMoney(it.amt)} (${Math.round(frac * 100)}%)"></circle>`;
    off += frac * C;
    return s;
  }).join('');

  const rank = items.map((it) => `
    <div class="rank-item">
      <span class="dot" style="background:${slotColor(it.slot)}"></span>
      <span class="nm">${it.emoji} ${esc(it.name)}</span>
      <span class="pct">${Math.round((it.amt / total) * 100)}%</span>
      <span class="amt">${fmtMoney(it.amt)}</span>
    </div>`).join('');

  const tipTotal = expenses.reduce((s, e) => s + (e.tip || 0), 0);
  const tipNote = tipTotal > 0
    ? `<p class="hint tiny" style="margin-top:14px">💵 이 중 팁이 <b>${fmtMoney(tipTotal)}</b> 예요 (전체 지출의 ${((tipTotal / total) * 100).toFixed(1)}%)</p>`
    : '';

  return `
    <svg viewBox="0 0 160 160" width="160" height="160" style="flex:none">
      ${segs}
      <text x="80" y="74" text-anchor="middle" class="donut-center-lbl">이번 달 지출</text>
      <text x="80" y="94" text-anchor="middle" class="donut-center-val">${fmtMoney(total)}</text>
    </svg>
    <div class="rank-list">${rank}${tipNote}</div>`;
}

function dailyBarsHtml(expenses) {
  const [y, mo] = curMonth.split('-').map(Number);
  const dim = daysInMonth(curMonth);
  const byDay = new Array(dim + 1).fill(0);
  expenses.forEach((e) => { byDay[Number(e.date.slice(8, 10))] += e.amount; });
  const max = Math.max(...byDay, 1);

  const W = 680, H = 170, mL = 52, mR = 8, mT = 12, mB = 22;
  const plotW = W - mL - mR, plotH = H - mT - mB;
  const slotW = plotW / dim, barW = Math.min(14, slotW * 0.6);
  const bar = cssVar('--accent'), gridC = cssVar('--grid'), baseC = cssVar('--line');

  let bars = '', hits = '', labels = '';
  for (let d = 1; d <= dim; d++) {
    const v = byDay[d];
    const x = mL + (d - 1) * slotW + slotW / 2;
    if (v > 0) {
      const h = Math.max(2, (v / max) * plotH);
      bars += `<rect x="${(x - barW / 2).toFixed(1)}" y="${(mT + plotH - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${bar}"></rect>`;
    }
    const dt = new Date(y, mo - 1, d);
    hits += `<rect x="${(x - slotW / 2).toFixed(1)}" y="${mT}" width="${slotW.toFixed(1)}" height="${plotH}" fill="transparent"
      data-tip="${mo}월 ${d}일 (${DOW[dt.getDay()]})|${v > 0 ? '−' + fmtMoney(v) : '지출 없음'}"></rect>`;
    if (d === 1 || d % 5 === 0) labels += `<text x="${x.toFixed(1)}" y="${H - 6}" text-anchor="middle" class="axis-lbl">${d}</text>`;
  }
  const grid = [0.5, 1].map((f) => {
    const yy = mT + plotH - f * plotH;
    return `<line x1="${mL}" x2="${W - mR}" y1="${yy}" y2="${yy}" stroke="${gridC}" stroke-width="1"></line>
      <text x="${mL - 6}" y="${yy + 3}" text-anchor="end" class="axis-lbl">${fmtCompact(max * f)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="bar-chart-svg">
    ${grid}
    <line x1="${mL}" x2="${W - mR}" y1="${mT + plotH}" y2="${mT + plotH}" stroke="${baseC}" stroke-width="1"></line>
    ${bars}${hits}${labels}
  </svg>`;
}

function bindChartHover() {
  const tip = $('#tooltip');
  document.querySelectorAll('[data-tip]').forEach((el) => {
    el.addEventListener('mousemove', (ev) => {
      const [t, v] = el.dataset.tip.split('|');
      tip.innerHTML = esc(t) + '<br><b>' + esc(v) + '</b>';
      tip.classList.remove('hidden');
      const pad = 14, r = tip.getBoundingClientRect();
      let x = ev.clientX + pad, ty = ev.clientY + pad;
      if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
      if (ty + r.height > window.innerHeight - 8) ty = ev.clientY - r.height - pad;
      tip.style.left = x + 'px'; tip.style.top = ty + 'px';
    });
    el.addEventListener('mouseleave', () => tip.classList.add('hidden'));
  });
}

/* ==================== 동기화 상태 ==================== */
function renderSyncStatus(st) {
  const el = $('#syncStatus');
  el.className = 'sync-status ' + st.state;
  const dot = '<span class="dot"></span>';
  if (st.state === 'off') { el.innerHTML = dot + '동기화 꺼짐'; el.title = '눌러서 기기 동기화 설정하기'; }
  else if (st.state === 'syncing') { el.innerHTML = dot + '동기화 중…'; }
  else if (st.state === 'ok') {
    const t = st.lastSyncAt;
    el.innerHTML = dot + pad2(t.getHours()) + ':' + pad2(t.getMinutes()) + ' 동기화됨';
    el.title = '눌러서 지금 동기화';
  } else if (st.state === 'offline') { el.innerHTML = dot + '오프라인'; el.title = '연결되면 자동으로 합쳐져요'; }
  else if (st.state === 'error') { el.innerHTML = dot + '동기화 오류'; el.title = st.error || ''; }
  else { el.innerHTML = dot + '대기 중'; }
}

/* ==================== 입력 모달 ==================== */
function openEntryModal(entry) {
  editingId = entry ? entry.id : null;
  const firstCat = data.settings.categories.expense[0].name;
  draft = entry
    ? { type: entry.type, amount: entry.amount, category: entry.category, date: entry.date,
        time: entry.time || '', memo: entry.memo,
        /* 저장된 건 총액(amount)과 팁뿐이라, 식사비는 빼서 되돌린다 */
        base: roundMoney(entry.amount - (entry.tip || 0)),
        tip: entry.tip || 0,
        tipMode: entry.tip ? 'custom' : 'none' }
    : { type: 'expense', amount: 0, category: firstCat,
        date: selectedDay || todayStr(),
        // 새로 넣는 건 지금 시각을 채워둔다 (지우면 시간 없이 저장된다)
        time: selectedDay && selectedDay !== todayStr() ? '' : nowTime(),
        memo: '', base: 0, tip: 0, tipMode: 'none' };
  // 저장된 결제수단이 지워졌으면 마지막에 쓰던 것으로
  draft.method = (entry && methodOf(entry.method)) ? entry.method : data.settings.lastMethod;
  renderEntryModal();
  $('#entryModal').classList.remove('hidden');
  $('#inAmount').focus();
}

function renderEntryModal() {
  const isExp = draft.type === 'expense';
  document.querySelectorAll('#typeSeg button').forEach((b) => {
    const on = b.dataset.type === draft.type;
    b.className = on ? 'active ' + (isExp ? 'expense-on' : 'income-on') : '';
  });

  $('#amountUnit').textContent = isUSD() ? '$' : '원';
  $('#inAmount').value = draft.base ? formatAmountStr(draft.base) : '';
  $('#inDate').value = draft.date;
  $('#inTime').value = draft.time || '';
  $('#inMemo').value = draft.memo || '';
  $('#inMemo').placeholder = isExp ? '어디에 썼는지 적어주세요' : '어떤 수입인지 적어주세요';
  $('#btnDeleteEntry').classList.toggle('hidden', !editingId);

  $('#catGrid').innerHTML = data.settings.categories[draft.type].map((c) => `
    <button class="cat-chip ${c.name === draft.category ? 'active' : ''}" data-name="${esc(c.name)}">
      <span>${c.emoji}</span>${esc(c.name)}
    </button>`).join('');

  renderTipBox();
  renderMethodPicker();
}

/* 결제수단 칩 + 이 분류에 제일 좋은 카드 추천 */
function renderMethodPicker() {
  $('#methodGrid').innerHTML = methods().map((m) => `
    <button class="cat-chip method ${m.id === draft.method ? 'active' : ''}" data-method="${esc(m.id)}">
      <span>${m.emoji || '💳'}</span>${esc(m.name)}
    </button>`).join('');

  const hint = $('#methodHint');
  if (draft.type !== 'expense') { hint.textContent = ''; return; }

  const cur = methodOf(draft.method);
  const curRate = methodRate(cur, draft.category);
  const best = bestMethodFor(draft.category);

  if (best && cur && best.m.id !== cur.id && best.rate > curRate) {
    hint.innerHTML = `💡 <b>${esc(best.m.name)}</b> 로 결제하면 ${best.rate}% 적립돼요` +
      (curRate > 0 ? ` (지금 고른 건 ${curRate}%)` : '');
  } else if (curRate > 0) {
    hint.innerHTML = `✓ 이 분류에서 <b>${esc(cur.name)}</b> ${curRate}% 적립`;
  } else if (cur && cur.memo) {
    hint.textContent = cur.memo;
  } else {
    hint.textContent = '';
  }
}

/* 직접입력 중에는 입력칸을 건드리지 않고 요약만 갱신한다 */
function refreshTipSummary() {
  const pct = draft.base > 0 ? (draft.tip / draft.base) * 100 : 0;
  $('#tipSum').innerHTML = draft.base
    ? `식사비 <b>${fmtMoney(draft.base)}</b> + 팁 <b>${fmtMoney(draft.tip)}</b>` +
      ` (${pct.toFixed(pct % 1 ? 1 : 0)}%) = <span class="total">${fmtMoney(draft.amount)}</span>`
    : '식사비를 먼저 넣어주세요';
}

/* 팁 계산 영역 — 팁이 켜진 지출 분류에서만 보인다 */
function renderTipBox() {
  const on = draft.type === 'expense' && catHasTip(draft.category);
  $('#tipBox').classList.toggle('hidden', !on);
  $('#amountLabel').classList.toggle('hidden', !(on && draft.tipMode !== 'none'));
  if (!on) return;

  const presets = data.settings.tipPresets || [15, 18, 20, 25];
  const chips = [{ v: 'none', t: '없음' }]
    .concat(presets.map((p) => ({ v: p, t: p + '%' })))
    .concat([{ v: 'custom', t: '직접' }]);
  $('#tipChips').innerHTML = chips.map((c) =>
    `<button class="tip-chip ${draft.tipMode === c.v ? 'active' : ''}" data-tip="${c.v}">${c.t}</button>`).join('');

  const custom = draft.tipMode === 'custom';
  $('#tipInputs').classList.toggle('hidden', !custom);
  if (custom && document.activeElement !== $('#inTip') && document.activeElement !== $('#inTotal')) {
    $('#inTip').value = draft.tip ? formatAmountStr(draft.tip) : '';
    $('#inTotal').value = draft.amount ? formatAmountStr(draft.amount) : '';
  }

  if (draft.tipMode === 'none' || !draft.base) {
    $('#tipSum').innerHTML = draft.tipMode === 'none'
      ? '팁 없이 <b>' + fmtMoney(draft.base || 0) + '</b> 로 기록돼요'
      : '식사비를 먼저 넣어주세요';
    return;
  }
  refreshTipSummary();
}

function captureDraft() {
  draft.base = readAmount();
  draft.date = $('#inDate').value || draft.date;
  draft.memo = $('#inMemo').value;
  recalcTip();
}

/* 팁과 총액을 다시 계산한다. draft.base 가 사용자가 친 금액(식사비), draft.amount 가 실제 지출액. */
function recalcTip() {
  const usable = draft.type === 'expense' && catHasTip(draft.category);
  if (!usable || draft.tipMode === 'none') {
    draft.tip = 0;
  } else if (typeof draft.tipMode === 'number') {
    draft.tip = roundMoney(draft.base * draft.tipMode / 100);
  }
  // 'custom' 이면 사용자가 직접 넣은 draft.tip 을 그대로 쓴다
  draft.amount = roundMoney(draft.base + (draft.tip || 0));
}

function formatAmountStr(n) {
  if (!isUSD()) return Math.round(n).toLocaleString('ko-KR');
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* 타이핑 중에도 천 단위 쉼표를 넣되, 달러는 소수점 둘째 자리까지 그대로 둔다 */
function maskAmount(raw) {
  if (!isUSD()) {
    const d = raw.replace(/[^0-9]/g, '');
    return d ? Number(d).toLocaleString('ko-KR') : '';
  }
  let v = raw.replace(/[^0-9.]/g, '');
  const dot = v.indexOf('.');
  if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
  const parts = v.split('.');
  const intPart = parts[0].replace(/^0+(?=\d)/, '');
  const grouped = intPart ? Number(intPart).toLocaleString('en-US') : (parts.length > 1 ? '0' : '');
  return parts.length > 1 ? grouped + '.' + parts[1].slice(0, 2) : grouped;
}

function onAmountInput() {
  const el = $('#inAmount');
  el.value = maskAmount(el.value);
  draft.base = readAmount();
  recalcTip();
  renderTipBox();
}

function toNum(s) {
  const n = Number(String(s).replace(/[^0-9.]/g, ''));
  return isFinite(n) ? n : 0;
}
function readAmount() { return toNum($('#inAmount').value); }

function saveEntry() {
  draft.base = readAmount();
  recalcTip();
  if (!(draft.amount > 0)) { $('#inAmount').focus(); toast('금액을 넣어주세요'); return; }
  const f = {
    type: draft.type,
    amount: draft.amount,          // 팁을 포함한 실제 지출액
    tip: draft.tip || 0,
    category: draft.category,
    method: draft.method || '',
    date: $('#inDate').value || todayStr(),
    time: $('#inTime').value || '',
    memo: $('#inMemo').value.trim()
  };
  data.settings.lastMethod = draft.method || data.settings.lastMethod;
  if (editingId) {
    const e = data.entries.find((x) => x.id === editingId);
    if (e) { Object.assign(e, f); touch(e); }
  } else {
    const e = { id: uuid(), ...f, deleted: false };
    touch(e);
    data.entries.push(e);
  }
  $('#entryModal').classList.add('hidden');
  curMonth = f.date.slice(0, 7);
  afterChange();
}

function deleteEntry() {
  if (!editingId) return;
  const e = data.entries.find((x) => x.id === editingId);
  if (!e) return;
  askConfirm({ emoji: '🗑️', title: '이 내역을 삭제할까요?', text: '되돌릴 수 없어요.', ok: '삭제', danger: true }, () => {
    e.deleted = true;
    touch(e);
    $('#entryModal').classList.add('hidden');
    afterChange();
  });
}

/* ==================== 설정 모달 ==================== */
function openSettings() {
  const s = data.settings;
  $('#setCurrency').value = s.currency;
  $('#setBudget').value = s.budget || '';
  $('#setGoalName').value = (s.goal && s.goal.name) || '';
  $('#setGoalTarget').value = (s.goal && s.goal.target) || '';
  $('#setSupaUrl').value = s.supabaseUrl || '';
  $('#setSupaKey').value = s.supabaseKey || '';
  $('#setCoupleCode').value = s.coupleCode || '';
  $('#syncInfo').textContent = '';
  setDraftCats = JSON.parse(JSON.stringify(s.categories));
  setDraftRecur = JSON.parse(JSON.stringify(s.recurring || []));
  setDraftMethods = JSON.parse(JSON.stringify(s.methods || []));
  renderMethodManage();
  renderCatManage();
  renderRecurList();
  $('#lockSetup').classList.add('hidden');
  renderLockSetting();
  renderLinkSetting();
  renderPushSetting();
  $('#settingsModal').classList.remove('hidden');
}

/* ---------- 결제수단 관리 ---------- */
let setDraftMethods = null;
let editingMethodId = null;

function renderMethodManage() {
  const monthTotals = {};
  monthLedger(curMonth).filter((e) => e.type === 'expense')
    .forEach((e) => { monthTotals[e.method] = (monthTotals[e.method] || 0) + e.amount; });

  $('#methodManage').innerHTML = setDraftMethods.map((m) => {
    const kind = m.type === 'credit' ? '신용' : (m.type === 'debit' ? '체크' : '현금');
    const rates = Object.entries(m.rates || {}).filter(([, v]) => Number(v) > 0);
    const sub = [
      rates.length ? rates.map(([k, v]) => `${k} ${v}%`).slice(0, 2).join(' · ') : '',
      m.base > 0 ? `그 외 ${m.base}%` : '',
      m.billingDay ? `${m.billingDay}일 결제` : '',
      m.opening > 0 ? `시작 ${fmtMoney(m.opening)}` : ''
    ].filter(Boolean).join(' · ');
    return `
      <div class="method-item" data-medit="${esc(m.id)}">
        <span class="ic">${m.emoji || '💳'}</span>
        <span class="nm">${esc(m.name)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span>
        <span class="kind ${m.type}">${kind}</span>
        <span class="amt">${monthTotals[m.id] ? fmtMoney(monthTotals[m.id]) : ''}</span>
        ${m.id === 'cash' ? '' :
          `<button class="del" data-mdel="${esc(m.id)}" title="삭제">✕</button>`}
      </div>`;
  }).join('');
}

function openMethodModal(id) {
  editingMethodId = id;
  const m = id ? setDraftMethods.find((x) => x.id === id) : null;
  $('#methodModalTitle').textContent = m ? '결제수단 수정' : '결제수단 추가';
  $('#inMethodName').value = m ? m.name : '';
  $('#inMethodEmoji').value = m ? (m.emoji || '') : '💳';
  $('#inMethodMemo').value = m ? (m.memo || '') : '';
  $('#inBillingDay').value = m ? (m.billingDay || '') : '';
  $('#inRateBase').value = m && m.base ? m.base : '';
  $('#inPreSpent').value = m && m.opening ? m.opening : '';
  $('#inPreSpentDate').value = (m && m.openingDate) || todayStr();
  $('#btnMethodDelete').classList.toggle('hidden', !m || m.id === 'cash');
  methodDraftType = m ? m.type : 'credit';
  methodDraftRates = m ? { ...(m.rates || {}) } : {};
  renderMethodModal();
  $('#methodModal').classList.remove('hidden');
  $('#inMethodName').focus();
}

let methodDraftType = 'credit';
let methodDraftRates = {};

function renderMethodModal() {
  document.querySelectorAll('#methodTypeSeg button').forEach((b) =>
    b.classList.toggle('active', b.dataset.mtype === methodDraftType));
  const isCredit = methodDraftType === 'credit';
  $('#billingField').classList.toggle('hidden', !isCredit);
  /* 시작 금액은 모든 결제수단에 있다. 뜻만 반대다 —
     신용카드는 '갚아야 할 돈', 현금·체크카드는 '남아있는 돈'.
     지출이 아니라 결제수단에 붙는 값이라, 다시 저장해도 중복될 일이 없다. */
  $('#preSpentLabel').textContent = isCredit
    ? '시작 금액 — 지금 갚아야 할 잔액' : '시작 금액 — 지금 남아있는 돈';
  $('#preSpentHint').innerHTML = (isCredit
    ? '청구서에 찍힌 <b>현재 잔액</b> 과 그 기준 날짜를 넣어주세요. ' +
      '이번 달 지출에는 잡히지 않고 <b>잔액</b> 탭에서 갚아나가는 금액으로만 보입니다.'
    : '통장·지갑에 <b>지금 들어있는 돈</b> 과 그 기준 날짜를 넣어주세요. ' +
      '<b>잔액</b> 탭에서 쓸수록 줄어드는 게 보여요.'
  ) + ' 기준 날짜 <b>다음날부터</b> 입력한 내역이 반영됩니다.';

  $('#rateGrid').innerHTML = data.settings.categories.expense.map((c) => `
    <span class="rate-cell">
      ${c.emoji} ${esc(c.name)}
      <input data-rate="${esc(c.name)}" inputmode="decimal" maxlength="5"
             value="${methodDraftRates[c.name] != null ? esc(methodDraftRates[c.name]) : ''}" placeholder="–">
      <span class="pc">%</span>
    </span>`).join('');
}

function saveMethod() {
  const name = $('#inMethodName').value.trim();
  if (!name) { $('#inMethodName').focus(); toast('이름을 넣어주세요'); return; }
  const rates = {};
  document.querySelectorAll('#rateGrid [data-rate]').forEach((el) => {
    const v = toNum(el.value);
    if (v > 0) rates[el.dataset.rate] = v;
  });
  const fields = {
    name,
    emoji: $('#inMethodEmoji').value.trim() || '💳',
    type: methodDraftType,
    memo: $('#inMethodMemo').value.trim(),
    billingDay: methodDraftType === 'credit' ? (Number($('#inBillingDay').value) || 0) : 0,
    rates,
    base: toNum($('#inRateBase').value)
  };

  /* 시작 금액은 지출로 넣지 않고 카드에 붙여둔다.
     지난 달들에 쓴 돈이라, 이번 달 지출·예산에 섞이면 숫자가 엉망이 되기 때문이다. */
  fields.opening = toNum($('#inPreSpent').value);
  fields.openingDate = fields.opening > 0 ? ($('#inPreSpentDate').value || todayStr()) : '';

  if (editingMethodId) {
    const m = setDraftMethods.find((x) => x.id === editingMethodId);
    if (m) Object.assign(m, fields);
  } else {
    setDraftMethods.push({ id: 'm_' + uuid().slice(0, 8), ...fields });
  }
  $('#methodModal').classList.add('hidden');
  renderMethodManage();
}

/* ---------- 카드값 갚기 ---------- */
let payingMethodId = null;
let payFromId = null;

/* 카드값을 낼 수 있는 곳 = 현금·체크카드 */
function payableFrom() { return methods().filter((m) => !isCreditM(m)); }

function renderPayFrom() {
  const list = payableFrom();
  $('#payFromField').classList.toggle('hidden', list.length < 1);
  $('#payFromGrid').innerHTML = list.map((m) => {
    const c = cashLeft(m);
    const left = c ? ` <small>${fmtMoney(c.left)}</small>` : '';
    return `<button class="cat-chip method ${m.id === payFromId ? 'active' : ''}" data-payfrom="${esc(m.id)}">
      <span>${m.emoji || '💵'}</span>${esc(m.name)}${left}</button>`;
  }).join('');
}

function openPayModal(id) {
  const m = methodOf(id);
  if (!m) return;
  const d = cardDebt(m) || { left: 0 };
  payingMethodId = id;
  const from = payableFrom();
  payFromId = (from.find((x) => x.id === data.settings.lastPayFrom) || from[0] || {}).id || null;
  $('#payModalTitle').textContent = `${m.emoji || '💳'} ${m.name} 갚기`;
  $('#inPayAmount').value = '';
  $('#inPayDate').value = todayStr();
  $('#inPayMemo').value = '';
  renderPayFrom();
  /* 자주 쓰는 금액을 눌러 넣을 수 있게 — 전액이 제일 위 */
  $('#payQuick').innerHTML = d.left > 0
    ? `<button type="button" data-quick="${d.left}">전액 ${fmtMoney(d.left)}</button>` +
      [100, 200, 500].filter((v) => v < d.left)
        .map((v) => `<button type="button" data-quick="${v}">${fmtMoney(v)}</button>`).join('')
    : '';
  $('#payModal').classList.remove('hidden');
  $('#inPayAmount').focus();
}

function savePay() {
  const amount = toNum($('#inPayAmount').value);
  if (!(amount > 0)) { $('#inPayAmount').focus(); toast('금액을 넣어주세요'); return; }
  const e = {
    id: uuid(), date: $('#inPayDate').value || todayStr(),
    type: 'cardpay', amount, tip: 0, category: '',
    method: payingMethodId,          // 갚은 대상 카드
    from: payFromId || '',           // 돈이 빠져나간 곳 (현금·체크카드)
    memo: $('#inPayMemo').value.trim(),
    deleted: false
  };
  if (payFromId) data.settings.lastPayFrom = payFromId;
  touch(e);
  data.entries.push(e);
  $('#payModal').classList.add('hidden');
  afterChange();
  const m = methodOf(payingMethodId);
  const left = m ? (cardDebt(m) || {}).left : null;
  toast(left === 0 ? '다 갚았어요! 🎉' : `${fmtMoney(amount)} 갚았어요`);
}

function deletePay(id) {
  const e = data.entries.find((x) => x.id === id);
  if (!e) return;
  askConfirm({
    emoji: '🗑️',
    title: '이 갚은 기록을 지울까요?',
    text: `${fmtMoney(e.amount)} 기록이 사라지고, 갚을 돈이 그만큼 다시 늘어나요.`,
    ok: '삭제', danger: true
  }, () => {
    e.deleted = true;
    touch(e);
    afterChange();
  });
}

function deleteMethodById(id) {
  const m = setDraftMethods.find((x) => x.id === id);
  if (!m) return;
  const used = liveEntries().filter((e) => e.method === id).length;
  askConfirm({
    emoji: '🗑️',
    title: `${m.name} 을(를) 삭제할까요?`,
    text: used
      ? `이 결제수단으로 기록된 내역 <b>${used}건</b> 은 그대로 남고, 결제수단 표시만 사라집니다.`
      : '설정에서 [저장] 을 눌러야 최종 반영돼요.',
    ok: '삭제', danger: true
  }, () => {
    setDraftMethods = setDraftMethods.filter((x) => x.id !== id);
    $('#methodModal').classList.add('hidden');
    renderMethodManage();
  });
}
function deleteMethod() { deleteMethodById(editingMethodId); }

function renderCatManage() {
  const block = (type, label, hint) => `
    <div class="field">
      <label>${label}</label>
      ${hint ? `<p class="hint tiny" style="margin:-2px 0 8px">${hint}</p>` : ''}
      <div class="cat-manage-list">
        ${setDraftCats[type].map((c) => `
          <span class="cat-manage-chip">
            <span style="width:8px;height:8px;border-radius:3px;background:${slotColor(c.slot)};display:inline-block"></span>
            ${c.emoji} ${esc(c.name)}
            ${type === 'expense' ? `<button class="tip-btn ${c.tip ? 'on' : 'off'}"
                data-tipcat="${esc(c.name)}" title="팁 계산 켜기/끄기">팁</button>` : ''}
            <button class="del" data-del="${esc(c.name)}" data-type="${type}" title="삭제">✕</button>
          </span>`).join('')}
      </div>
      <div class="cat-add-row">
        <input id="catAdd-${type}" data-addinput="${type}" placeholder="예: 🐶 반려동물 (이모지 생략 가능)">
        <button class="btn" data-add="${type}">추가</button>
      </div>
    </div>`;
  $('#catManage').innerHTML =
    block('expense', '지출 분류', '<b>팁</b> 을 눌러 켜두면 그 분류에서 팁 계산기가 나와요.') +
    block('income', '수입 분류', '');
}

function renderRecurList() {
  /* 새로 추가할 때 고를 결제수단 목록 (설정 화면의 초안 기준) */
  const list = setDraftMethods && setDraftMethods.length ? setDraftMethods : methods();
  const sel = $('#recMethod');
  if (sel) {
    const keep = sel.value;
    sel.innerHTML = '<option value="">결제수단 없음</option>' + list.map((m) =>
      `<option value="${esc(m.id)}">${m.emoji || '💳'} ${esc(m.name)}</option>`).join('');
    sel.value = list.some((m) => m.id === keep) ? keep : (data.settings.lastMethod || '');
  }

  if (!setDraftRecur.length) {
    $('#recurList').innerHTML = '<p class="hint">등록된 반복 지출이 없어요.</p>';
    return;
  }
  $('#recurList').innerHTML = setDraftRecur.map((r) => {
    const m = list.find((x) => x.id === r.method);
    return `
    <div class="recur-item">
      <span class="day">매달 ${r.day}일</span>
      <span class="nm">${esc(r.memo)}${m ? `<span class="rec-method">${m.emoji || '💳'} ${esc(m.name)}</span>` : ''}</span>
      <span class="amt">${fmtMoney(r.amount)}</span>
      <button data-recdel="${r.id}" title="삭제">✕</button>
    </div>`;
  }).join('');
}

function saveSettings(keepOpen) {
  const s = data.settings;
  const newCurrency = $('#setCurrency').value;
  const newBudget = toNum($('#setBudget').value);
  const newGoal = {
    name: $('#setGoalName').value.trim(),
    target: toNum($('#setGoalTarget').value)
  };
  const newMethods = setDraftMethods.length ? setDraftMethods : defaultMethods();
  /* 실제로 바뀐 항목만 골라낸다 — 안 건드린 항목은 다른 기기에서 정한 값이 그대로 살아남는다 */
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const changedFields = [];
  if (!same(setDraftCats, s.categories)) changedFields.push('categories');
  if (!same(setDraftRecur, s.recurring)) changedFields.push('recurring');
  if (!same(newMethods, s.methods)) changedFields.push('methods');
  if (!same(newGoal, s.goal)) changedFields.push('goal');
  if (newCurrency !== s.currency) changedFields.push('currency');
  if (newBudget !== s.budget) changedFields.push('budget');

  /* 지운 카드는 따로 적어둔다. 안 그러면 다른 기기에서 다시 살아난다. */
  const goneIds = (s.methods || []).map((m) => m.id)
    .filter((id) => !newMethods.some((m) => m.id === id));
  if (goneIds.length) {
    s.retiredMethods = [...new Set([...(s.retiredMethods || []), ...goneIds])];
    changedFields.push('retiredMethods');
  }
  const revived = newMethods.map((m) => m.id).filter((id) => (s.retiredMethods || []).includes(id));
  if (revived.length) {
    s.retiredMethods = (s.retiredMethods || []).filter((id) => !revived.includes(id));
    changedFields.push('retiredMethods');
  }

  s.currency = newCurrency;
  s.budget = newBudget;
  s.goal = newGoal;
  s.categories = setDraftCats;
  s.recurring = setDraftRecur;
  s.methods = newMethods;
  if (!methodOf(s.lastMethod)) s.lastMethod = s.methods[0].id;
  setDraftMethods = JSON.parse(JSON.stringify(s.methods));
  setDraftCats = JSON.parse(JSON.stringify(setDraftCats));
  setDraftRecur = JSON.parse(JSON.stringify(setDraftRecur));
  if (changedFields.length) markMeta(...changedFields);

  const prev = [s.supabaseUrl, s.supabaseKey, s.coupleCode].join('|');
  // 붙여넣을 때 /rest/v1 같은 경로가 같이 들어오면 잘라낸다 (안 자르면 동기화가 404 로 실패)
  s.supabaseUrl = Sync.normalizeUrl($('#setSupaUrl').value);
  s.supabaseKey = $('#setSupaKey').value.trim().replace(/\s+/g, '');
  s.coupleCode = $('#setCoupleCode').value.trim();
  $('#setSupaUrl').value = s.supabaseUrl;
  const cfgChanged = prev !== [s.supabaseUrl, s.supabaseKey, s.coupleCode].join('|');
  if (cfgChanged) {
    s.lastPullAt = null;
    data.entries.forEach((e) => { e.dirty = true; });
    Sync.configure(s);
  }

  applyRecurring();
  // 동기화 설정은 절대 날아가면 안 되므로 지연 없이 바로 저장
  Store.saveNow(data);
  if (keepOpen !== true) $('#settingsModal').classList.add('hidden');
  render();
  if (Sync.isConfigured() && (cfgChanged || metaChanged)) scheduleSync();
}

/* ==================== CSV ==================== */
function exportCsv(monthOnly) {
  /* 카드 갚은 기록도 함께 내보낸다 — 지출은 아니지만 돈이 나간 기록이라 있어야 한다 */
  const pays = monthOnly
    ? cardPays().filter((e) => e.date && e.date.startsWith(curMonth)) : cardPays();
  const list = (monthOnly ? monthLedger(curMonth) : ledger()).concat(pays)
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  const label = { income: '수입', cardpay: '카드갚기' };
  const rows = [['날짜', '시간', '구분', '금액', '팁', '분류', '결제수단', '내용']];
  list.forEach((e) => rows.push([
    e.date, e.time || '', label[e.type] || '지출', e.amount, e.tip || 0, e.category,
    (methodOf(e.method) || {}).name || '', e.memo
  ]));
  const csv = '﻿' + rows.map((r) => r.map((v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = monthOnly ? `내가계부_${curMonth}.csv` : '내가계부_전체.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('CSV 파일을 저장했어요');
}

/* ==================== 업데이트 알림 ====================
 * 아이폰 웹앱: 서비스 워커가 새 파일을 받아두면 [업데이트] 한 번으로 바로 갱신된다.
 * 맥·윈도우 앱: version.json 을 확인해 새 버전이 있으면 내려받는 링크를 열어준다.
 */
/* 배포하는 사람이 정하는 값 (build 가 renderer/config.js 를 만들어준다).
   비어 있으면 업데이트 확인을 건너뛴다. */
const CFG = window.APP_CONFIG || {};
const UPDATE_BASE = CFG.updateBase || '';
let swWaiting = null;

function showUpdateBar(title, sub, onClick) {
  $('#updateTxt').innerHTML = esc(title) + (sub ? `<small>${esc(sub)}</small>` : '');
  $('#updateBar').classList.remove('hidden');
  $('#btnUpdateNow').onclick = onClick;
}

function bindUpdateBar() {
  $('#btnUpdateLater').addEventListener('click', () => $('#updateBar').classList.add('hidden'));
}

function setupServiceWorker() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;

  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (worker) => {
      swWaiting = worker;
      showUpdateBar('새 버전이 준비됐어요', '누르면 바로 최신 화면으로 바뀝니다', () => {
        $('#btnUpdateNow').textContent = '적용 중…';
        swWaiting.postMessage({ type: 'SKIP_WAITING' });
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    window.addEventListener('focus', () => reg.update().catch(() => {}));
  }).catch(() => { /* 오프라인 기능만 빠질 뿐 앱은 동작 */ });

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

function platformKey() {
  /* 앱이 알려준 값이 가장 정확하다.
     브라우저는 애플 실리콘 맥에서도 자신을 MacIntel 이라고 하기 때문에,
     이것만 보고 판단하면 M1/M2 맥에 인텔용 파일을 받게 된다. */
  const g = window.mygagyebu || {};
  if (g.platform === 'win32') return 'win';
  if (g.platform === 'darwin') return g.arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'win';
  if (/Mac/i.test(ua)) return /arm|aarch/i.test(navigator.platform + ua) ? 'mac-arm64' : 'mac-x64';
  return 'win';
}

async function checkDesktopUpdate() {
  if (!UPDATE_BASE) return;                            // 배포 설정이 없으면 확인하지 않는다
  if (location.protocol.startsWith('http')) return;   // 웹앱은 서비스 워커가 담당
  const mine = (window.mygagyebu && window.mygagyebu.appVersion) || '0.0.0';
  try {
    const res = await fetch(UPDATE_BASE + '/version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const info = await res.json();
    if (cmpVersion(info.version, mine) <= 0) return;
    const url = (info.downloads && info.downloads[platformKey()]) || info.downloadPage || UPDATE_BASE;
    showUpdateBar(`새 버전 ${info.version} 이 나왔어요`, info.notes || '', () => {
      window.open(url, '_blank');
      $('#updateBar').classList.add('hidden');
      toast('받은 파일을 실행하면 업데이트됩니다');
    });
  } catch (e) { /* 인터넷이 없으면 조용히 넘어간다 */ }
}

/* 맥·윈도우 앱은 제목 표시줄을 없앴다. 헤더가 그 자리까지 올라오도록 표시만 해준다.
   (웹·아이폰에서는 window.mygagyebu 가 없으므로 그대로 둔다) */
function markDesktopChrome() {
  const g = window.mygagyebu;
  if (!g || !g.platform) return;
  document.body.classList.add('desktop');
  if (g.platform === 'darwin') document.body.classList.add('mac');
  // 회색 제목 표시줄 자리를 앱 색으로 채우는 띠 (창을 끌 수 있는 손잡이 역할도 한다)
  const band = document.createElement('div');
  band.className = 'titlebar-band';
  document.body.insertBefore(band, document.body.firstChild);
}

/* ==================== 잠금 ====================
 *
 * 남이 앱을 열어보지 못하게 막는 '화면 잠금'이다.
 * 비밀번호는 저장하지 않는다. 소금(salt)을 섞어 되돌릴 수 없게 만든 값만 두고,
 * 입력한 비밀번호를 같은 방법으로 섞어 그 값과 같은지만 본다.
 *
 * 지문·얼굴은 앱이 보지 않는다. 맥은 시스템이, 아이폰은 사파리가 확인하고
 * 성공했다는 사실만 앱에 알려준다.
 *
 * 잠금 설정은 이 기기에만 남는다 (동기화로 올리지 않는다).
 */
const Lock = (function () {
  const ITER = 250000;                 // 비밀번호를 섞는 횟수 — 많을수록 추측이 느려진다
  const enc = new TextEncoder();
  let unlocked = false;
  let hiddenAt = null;

  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function hash(pw, saltB64, iter) {
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: unb64(saltB64), iterations: iter, hash: 'SHA-256' }, key, 256);
    return b64(bits);
  }

  async function make(pw) {
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    return { salt, iter: ITER, hash: await hash(pw, salt, ITER) };
  }

  async function verify(pw) {
    const L = cfg();
    if (!L) return false;
    return (await hash(pw, L.salt, L.iter)) === L.hash;
  }

  function cfg() { return (data && data.settings && data.settings.lock) || null; }
  function isOn() { const L = cfg(); return !!(L && L.on); }

  /* --- 지문·얼굴 --- */
  const isDesktop = () => !!(window.mygagyebu && window.mygagyebu.platform);

  async function bioKind() {
    if (isDesktop()) {
      if (!window.mygagyebu.bioAvailable) return null;
      return (await window.mygagyebu.bioAvailable()) ? 'touchid' : null;
    }
    // 아이폰·아이패드 웹앱: 사파리의 패스키(Face ID / 지문)
    if (!window.PublicKeyCredential || !window.isSecureContext) return null;
    try {
      return (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
        ? 'webauthn' : null;
    } catch (e) { return null; }
  }

  /* 웹앱에서 잠금 해제용 패스키를 하나 만들어 둔다 (서버에 보내지 않는다) */
  async function webauthnRegister() {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: '내 가계부' },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: '내 가계부', displayName: '내 가계부' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred'
        },
        timeout: 60000
      }
    });
    return b64(cred.rawId);
  }

  async function webauthnVerify(credId) {
    await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: credId ? [{ type: 'public-key', id: unb64(credId) }] : [],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return true;   // 실패하면 예외가 난다
  }

  async function tryBio() {
    const L = cfg();
    if (!L || !L.bio) return false;
    try {
      if (L.bio === 'touchid') return await window.mygagyebu.bioPrompt('내 가계부 잠금 해제');
      if (L.bio === 'webauthn') return await webauthnVerify(L.credId);
    } catch (e) { /* 취소하면 비밀번호로 넘어간다 */ }
    return false;
  }

  /* --- 화면 --- */
  function show() {
    document.body.classList.add('locked');
    $('#lockScreen').classList.remove('hidden');
    $('#lockPw').value = '';
    $('#lockError').textContent = '';
    const L = cfg();
    $('#btnLockBio').classList.toggle('hidden', !(L && L.bio));
    $('#btnLockBio').textContent = L && L.bio === 'touchid' ? '👆 Touch ID 로 열기' : '👤 Face ID · 지문으로 열기';
  }
  function hide() {
    unlocked = true;
    hiddenAt = null;
    document.body.classList.remove('locked');
    $('#lockScreen').classList.add('hidden');
  }

  async function submit() {
    const pw = $('#lockPw').value;
    if (!pw) return;
    if (await verify(pw)) { hide(); return; }
    $('#lockError').textContent = '비밀번호가 맞지 않아요';
    $('#lockPw').value = '';
    $('#lockPw').focus();
  }

  /* 앱을 열 때 잠그고, 자리를 비웠다 돌아와도 잠근다 */
  async function start() {
    if (!isOn()) { unlocked = true; return; }
    show();
    if (await tryBio()) hide();
    else $('#lockPw').focus();
  }

  function watchAway() {
    const IDLE_MS = 60 * 1000;   // 1분 넘게 자리를 비우면 다시 잠근다
    document.addEventListener('visibilitychange', () => {
      if (!isOn()) return;
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (unlocked && hiddenAt && Date.now() - hiddenAt > IDLE_MS) {
        unlocked = false;
        start();
      }
    });
  }

  return { make, verify, isOn, cfg, bioKind, webauthnRegister, webauthnVerify, tryBio,
    show, hide, submit, start, watchAway, isDesktop };
})();

/* --- 잠금 설정 화면 --- */
let lockBioKind = null;      // 이 기기에서 쓸 수 있는 지문·얼굴 방식

async function renderLockSetting() {
  const L = Lock.cfg();
  const on = !!(L && L.on);
  $('#lockStateText').textContent = on
    ? (L.bio ? '잠금 켜짐 · 비밀번호 + ' + (L.bio === 'touchid' ? 'Touch ID' : 'Face ID·지문')
             : '잠금 켜짐 · 비밀번호')
    : '잠금 꺼짐';
  $('#btnLockToggle').textContent = on ? '끄기' : '켜기';
  $('#btnLockToggle').classList.toggle('danger', on);

  lockBioKind = await Lock.bioKind();
  const row = $('#lockBioRow');
  row.classList.toggle('hidden', !lockBioKind);
  if (lockBioKind) {
    $('#lockBioLabel').textContent = lockBioKind === 'touchid'
      ? 'Touch ID 로도 열기' : 'Face ID · 지문으로도 열기';
  }
  $('#lockBioHint').textContent = lockBioKind
    ? '' : (Lock.isDesktop()
      ? '이 컴퓨터에서는 지문을 쓸 수 없어 비밀번호만 됩니다.'
      : '이 브라우저에서는 지문·얼굴을 쓸 수 없어 비밀번호만 됩니다.');
}

function openLockSetup() {
  $('#setLockPw').value = '';
  $('#setLockPw2').value = '';
  $('#setLockBio').checked = !!lockBioKind;
  $('#lockSetup').classList.remove('hidden');
  $('#setLockPw').focus();
}

async function saveLockSetting() {
  const pw = $('#setLockPw').value;
  const pw2 = $('#setLockPw2').value;
  if (pw.length < 4) { $('#setLockPw').focus(); toast('비밀번호는 4자 이상으로 해주세요'); return; }
  if (pw !== pw2) { $('#setLockPw2').focus(); toast('두 번 넣은 비밀번호가 달라요'); return; }

  const lock = { on: true, ...(await Lock.make(pw)), bio: null, credId: null };

  /* 지문·얼굴을 쓰겠다고 했으면 지금 한 번 등록해본다.
     여기서 실패하면 비밀번호만으로 켠다 — 켜는 것 자체가 막히면 안 되니까. */
  if ($('#setLockBio').checked && lockBioKind) {
    try {
      if (lockBioKind === 'touchid') {
        if (await window.mygagyebu.bioPrompt('내 가계부 잠금에 Touch ID 를 등록합니다')) {
          lock.bio = 'touchid';
        }
      } else {
        lock.credId = await Lock.webauthnRegister();
        lock.bio = 'webauthn';
      }
    } catch (e) { /* 아래에서 안내한다 */ }
    if (!lock.bio) toast('지문 등록이 안 돼서 비밀번호만 켰어요');
  }

  data.settings.lock = lock;
  Store.saveNow ? Store.saveNow(data) : Store.save(data);
  $('#lockSetup').classList.add('hidden');
  await renderLockSetting();
  toast('잠금을 켰어요 🔒');
}

async function toggleLock() {
  if (Lock.isOn()) {
    askConfirm({
      emoji: '🔓',
      title: '잠금을 끌까요?',
      text: '앱을 열 때 비밀번호를 묻지 않게 됩니다.',
      ok: '끄기', danger: true
    }, async () => {
      data.settings.lock = null;
      Store.saveNow ? Store.saveNow(data) : Store.save(data);
      $('#lockSetup').classList.add('hidden');
      await renderLockSetting();
      toast('잠금을 껐어요');
    });
    return;
  }
  openLockSetup();
}

function bindLock() {
  $('#btnLockOk').addEventListener('click', () => Lock.submit());
  $('#lockPw').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') Lock.submit(); });
  $('#btnLockBio').addEventListener('click', async () => {
    if (await Lock.tryBio()) Lock.hide();
    else $('#lockPw').focus();
  });
  $('#btnLockToggle').addEventListener('click', toggleLock);
  $('#btnLockCancel').addEventListener('click', () => $('#lockSetup').classList.add('hidden'));
  $('#btnLockSave').addEventListener('click', saveLockSetting);
  $('#setLockPw2').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') saveLockSetting(); });
  Lock.watchAway();
}

/* 아이폰에서 키보드가 올라오면 '보이는 화면'만 줄어들고 창 크기는 그대로다.
   그래서 입력칸이 키보드 뒤로 숨거나, 키보드를 내린 뒤 화면이 엉뚱한 곳에 가 있다.
   보이는 영역 크기를 CSS 에 알려주고, 방금 누른 칸을 화면 가운데로 데려온다. */
function trackKeyboard() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  if (vv) {
    const apply = () => {
      root.style.setProperty('--vv-h', vv.height + 'px');
    };
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    apply();
  }

  document.addEventListener('focusin', (ev) => {
    const el = ev.target;
    if (!el.matches || !el.matches('input, select, textarea')) return;
    if (!el.closest('.modal')) return;
    // 키보드가 다 올라온 뒤에 옮겨야 자리가 맞는다
    setTimeout(() => {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* 무시 */ }
    }, 300);
  });

  /* 키보드를 내렸을 때 화면이 어긋나 있으면 원래 자리로 돌려놓는다 */
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      const a = document.activeElement;
      if (a && a.matches && a.matches('input, select, textarea')) return;
      window.scrollTo(0, 0);
    }, 120);
  });
}

/* --- 커플 가계부 연동 설정 --- */
function renderLinkSetting() {
  const L = data.settings.link || {};
  const on = !!L.on;
  $('#linkStateText').textContent = on
    ? `연동 켜짐 · 커플 앱에서 '${L.myName || '?'}' 로 기록된 것만` : '연동 꺼짐';
  $('#btnLinkToggle').textContent = on ? '끄기' : '켜기';
  $('#btnLinkToggle').classList.toggle('danger', on);
  const n = liveEntries().filter((e) => e.fromCouple).length;
  $('#linkHint').textContent = on && n ? `지금까지 ${n}건 가져왔어요.` : '';
}

function openLinkSetup() {
  const L = data.settings.link || {};
  $('#setLinkUrl').value = L.url || '';
  $('#setLinkKey').value = L.key || '';
  $('#setLinkCode').value = L.code || '';
  $('#setLinkName').value = L.myName || '';
  $('#linkSetup').classList.remove('hidden');
  $('#setLinkUrl').focus();
}

function draftLink() {
  return {
    on: true,
    url: $('#setLinkUrl').value.trim(),
    key: $('#setLinkKey').value.trim().replace(/\s+/g, ''),
    code: $('#setLinkCode').value.trim(),
    myName: $('#setLinkName').value.trim()
  };
}

async function testLink() {
  $('#linkHint').textContent = '확인하는 중…';
  try {
    const r = await Link.test({ ...data.settings, link: draftLink() });
    $('#linkHint').textContent =
      `연결됐어요. 커플 앱에 ${r.names.join(', ')} 가 있고, 내 이름으로 된 기록이 ${r.mine}건이에요.`;
  } catch (e) {
    $('#linkHint').textContent = '⚠ ' + e.message;
  }
}

async function saveLink() {
  const L = draftLink();
  if (!L.url || !L.key || !L.code || !L.myName) { toast('네 칸을 모두 채워주세요'); return; }
  try {
    await Link.test({ ...data.settings, link: L });
  } catch (e) {
    $('#linkHint').textContent = '⚠ ' + e.message;
    return;
  }
  data.settings.link = L;
  data.settings.linkPullAt = null;      // 처음 켤 때는 지난 기록까지 모두 가져온다
  Store.saveNow(data);
  $('#linkSetup').classList.add('hidden');
  toast('가져오는 중…');
  await runSync();
  renderLinkSetting();
  const n = liveEntries().filter((e) => e.fromCouple).length;
  toast(n ? `커플 가계부에서 ${n}건 가져왔어요` : '가져올 기록이 없어요');
}

function toggleLink() {
  if ((data.settings.link || {}).on) {
    askConfirm({
      emoji: '🔌',
      title: '연동을 끌까요?',
      text: '이미 가져온 기록은 그대로 남고, 앞으로 새로 가져오지 않습니다.',
      ok: '끄기', danger: true
    }, () => {
      data.settings.link = { ...(data.settings.link || {}), on: false };
      Store.saveNow(data);
      $('#linkSetup').classList.add('hidden');
      renderLinkSetting();
      toast('연동을 껐어요');
    });
    return;
  }
  openLinkSetup();
}

function bindLink() {
  $('#btnLinkToggle').addEventListener('click', toggleLink);
  $('#btnLinkCancel').addEventListener('click', () => $('#linkSetup').classList.add('hidden'));
  $('#btnLinkTest').addEventListener('click', testLink);
  $('#btnLinkSave').addEventListener('click', saveLink);
}

/* ==================== 폰 알림 ====================
 *
 * 웹 푸시. 알림을 '보내는 쪽'은 GitHub Actions 가 맡고,
 * 여기서는 이 기기를 받을 대상으로 등록해두는 일만 한다.
 *
 * 구독 정보는 Supabase 의 couple_meta.extra.pushSubs 에 모인다.
 * (표를 새로 만들지 않아도 되도록 이미 있는 extra 칸을 쓴다)
 *
 * 아이폰은 홈 화면에 추가한 웹앱에서만 알림이 온다 (iOS 16.4 이상).
 */
const VAPID_PUBLIC = CFG.vapidPublic || '';

const Push = (function () {
  function b64ToBytes(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  /* 이 기기에서 알림을 쓸 수 있는지. 아이폰 사파리는 홈 화면 앱일 때만 된다. */
  function supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function isIOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent); }
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }

  /* 왜 못 쓰는지 사람 말로 */
  function blockedReason() {
    if (window.mygagyebu && window.mygagyebu.platform) return '데스크톱 앱에서는 폰 알림을 쓰지 않아요. 아이폰 홈 화면 앱에서 켜주세요.';
    if (!VAPID_PUBLIC) return '이 앱은 알림이 설정돼 있지 않아요. (배포할 때 알림용 키가 필요합니다)';
    if (!supported()) return '이 브라우저는 알림을 지원하지 않아요.';
    if (isIOS() && !isStandalone()) return '사파리에서 <b>공유 → 홈 화면에 추가</b> 한 뒤, 그 앱에서 켜주세요.';
    if (Notification.permission === 'denied') {
      return isIOS()
        ? '알림이 차단돼 있어요. 아이폰 <b>설정 → 알림</b> 에서 이 앱을 켜주세요.'
        : '알림이 차단돼 있어요. 브라우저 주소창의 자물쇠를 눌러 알림을 허용해주세요.';
    }
    return null;
  }

  async function current() {
    if (!supported()) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    return reg.pushManager.getSubscription();
  }

  function pack(sub, member) {
    const j = sub.toJSON();
    return { endpoint: j.endpoint, keys: j.keys, member: member || '', at: new Date().toISOString() };
  }

  async function enable() {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('알림 권한이 필요해요');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToBytes(VAPID_PUBLIC)
      });
    }
    const s = data.settings;
    s.pushSub = pack(sub, '나');
    s.retiredSubs = (s.retiredSubs || []).filter((e) => e !== s.pushSub.endpoint);
    markMeta('pushSubs');
    saveNowIfPossible();
    scheduleSync();
    return s.pushSub;
  }

  async function disable() {
    const sub = await current();
    const s = data.settings;
    const ep = (s.pushSub && s.pushSub.endpoint) || (sub && sub.endpoint);
    if (sub) { try { await sub.unsubscribe(); } catch (e) { /* 이미 없으면 넘어간다 */ } }
    if (ep) s.retiredSubs = [...new Set([...(s.retiredSubs || []), ep])];
    s.pushSub = null;
    markMeta('pushSubs');
    saveNowIfPossible();
    scheduleSync();
  }

  /* 어떤 알림을 받을지 — 보내는 쪽이 이 값을 보고 거른다 */
  function prefs() {
    return data.settings.pushPrefs || { card: true, budget: true, update: true };
  }
  function setPrefs(p) {
    data.settings.pushPrefs = p;
    markMeta('pushSubs');
    saveNowIfPossible();
    scheduleSync();
  }

  return { supported, isIOS, isStandalone, blockedReason, current, enable, disable, prefs, setPrefs };
})();

function saveNowIfPossible() {
  if (Store.saveNow) Store.saveNow(data); else Store.save(data);
}

/* --- 알림 설정 화면 --- */
async function renderPushSetting() {
  const why = Push.blockedReason();
  const sub = why ? null : await Push.current();
  const on = !!sub && !!data.settings.pushSub;

  $('#pushStateText').textContent = on ? '알림 켜짐' : '알림 꺼짐';
  $('#btnPushToggle').textContent = on ? '끄기' : '켜기';
  $('#btnPushToggle').classList.toggle('danger', on);
  $('#btnPushToggle').disabled = !!why;
  $('#pushHint').innerHTML = why || '';
  $('#pushOpts').classList.toggle('hidden', !on);

  const p = Push.prefs();
  $('#pushOnCard').checked = p.card !== false;
  $('#pushOnBudget').checked = p.budget !== false;
  $('#pushOnUpdate').checked = p.update !== false;
}

function bindPush() {
  $('#btnPushToggle').addEventListener('click', async () => {
    try {
      if (data.settings.pushSub) { await Push.disable(); toast('알림을 껐어요'); }
      else { await Push.enable(); toast('알림을 켰어요 🔔'); }
    } catch (e) {
      toast(e.message || '알림을 켜지 못했어요');
    }
    renderPushSetting();
  });
  ['Card', 'Budget', 'Update'].forEach((k) => {
    $('#pushOn' + k).addEventListener('change', () => {
      Push.setPrefs({
        card: $('#pushOnCard').checked, budget: $('#pushOnBudget').checked,
        update: $('#pushOnUpdate').checked
      });
    });
  });
}

/* ==================== 시작 ==================== */
markDesktopChrome();
trackKeyboard();
bindPush();
bindLink();
init();
bindUpdateBar();
setupServiceWorker();
checkDesktopUpdate();
setInterval(checkDesktopUpdate, 6 * 60 * 60 * 1000);
