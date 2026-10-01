/* ==================== 우리 가계부 (커플용) ==================== */

/* 분류 색 — 0번은 회색(기타). dataviz 검증 통과 팔레트 */
const PALETTE = {
  light: ['#8d8480', '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark:  ['#948a85', '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
};
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const SAVE_CAT = '저축';
const FIXED_CAT = '고정지출';

function legacyDefaultCategories() {
  return {
    /* slot: 색 (1~8 이 서로 다른 색, 0 은 회색). 기본 분류를 8개로 맞춰 도넛 색이 겹치지 않게 한다.
       share: 이 분류로 입력하면 기본으로 정해지는 나눔 방식
              'half' = 둘이 같이 쓴 돈(정산 대상), 'personal' = 혼자 쓴 돈 */
    expense: [
      { name: '식비', emoji: '🍚', slot: 1, share: 'half', tip: true },
      { name: '카페·간식', emoji: '☕', slot: 2, share: 'half', tip: true },
      { name: '장보기·마트', emoji: '🛒', slot: 3, share: 'half' },
      { name: '교통·차량', emoji: '🚗', slot: 4, share: 'personal' },
      { name: '데이트', emoji: '💕', slot: 5, share: 'half', tip: true },
      { name: SAVE_CAT, emoji: '🐷', slot: 6, share: 'half' },
      { name: FIXED_CAT, emoji: '🔁', slot: 7, share: 'half' },
      { name: '쇼핑·미용', emoji: '🛍️', slot: 8, share: 'personal' },
      { name: '기타', emoji: '📦', slot: 0, share: 'personal' }
    ],
    income: [
      { name: '월급', emoji: '💰', slot: 1 },
      /* 렌트·유틸 몫으로 넣은 돈. 생활비 통장과 섞이면 안 되므로 따로 둔다. */
      { name: FIXED_CAT, emoji: '🔁', slot: 7 },
      { name: '용돈', emoji: '🎁', slot: 5 },
      { name: '부수입', emoji: '💵', slot: 3 },
      { name: '기타', emoji: '📦', slot: 0 }
    ]
  };
}

/* 결제수단 — 카드를 미리 등록해두고 입력할 때 한 번만 누른다.
   rates 는 분류별 적립률(%), base 는 그 외 분류에 적용할 기본 적립률. */
/* Category names are display data, while `name` remains the stable key used by
   entries, recurring rules and card reward-rate maps. */
function defaultCategories() {
  const cats = legacyDefaultCategories();
  const names = {
    expense: [
      ['\uC2DD\uBE44', 'Food'], ['\uCE74\uD398\u00B7\uAC04\uC2DD', 'Cafe & snacks'],
      ['\uC7A5\uBCF4\uAE30\u00B7\uB9C8\uD2B8', 'Groceries'], ['\uAD50\uD1B5\u00B7\uCC28\uB7C9', 'Transport'],
      ['\uB370\uC774\uD2B8', 'Dates'], ['\uC800\uCD95', 'Savings', 'savings'],
      ['\uACE0\uC815\uC9C0\uCD9C', 'Fixed costs', 'fixed'], ['\uC1FC\uD551\u00B7\uBBF8\uC6A9', 'Shopping & beauty'],
      ['\uAE30\uD0C0', 'Other', 'other']
    ],
    income: [
      ['\uC6D4\uAE09', 'Salary'], ['\uACE0\uC815\uC9C0\uCD9C', 'Fixed costs', 'fixed'],
      ['\uC6A9\uB3C8', 'Allowance'], ['\uBD80\uC218\uC785', 'Side income'], ['\uAE30\uD0C0', 'Other', 'other']
    ]
  };
  ['expense', 'income'].forEach((type) => {
    cats[type].forEach((c, i) => {
      const [nameKo, nameEn, key] = names[type][i];
      c.nameKo = nameKo;
      c.nameEn = nameEn;
      if (key) c.key = key;
    });
  });
  return cats;
}

/* Backfill bilingual labels without changing the stable key. This covers old
   Korean data, old English-first data (whose key was translated), and custom
   categories that previously had only one name. */
function normalizeCategories(cats) {
  if (!cats || typeof cats !== 'object') return false;
  const before = JSON.stringify(cats);
  const defaults = defaultCategories();
  ['expense', 'income'].forEach((type) => {
    if (!Array.isArray(cats[type])) cats[type] = [];
    cats[type].forEach((c) => {
      if (!c || typeof c !== 'object') return;
      if (!c.name) c.name = c.nameKo || c.nameEn || ('cat_' + uuid().slice(0, 8));
      const d = defaults[type].find((x) =>
        [x.name, x.nameKo, x.nameEn].includes(c.name)
        || (c.nameKo && [x.name, x.nameKo].includes(c.nameKo))
        || (c.nameEn && x.nameEn === c.nameEn));
      if (!c.nameKo) c.nameKo = d ? d.nameKo : c.name;
      if (!c.nameEn) c.nameEn = d ? d.nameEn : c.name;
      if (!c.key && d && d.key) c.key = d.key;
    });
  });
  return before !== JSON.stringify(cats);
}

function defaultMethods() {
  return [
    { id: 'cash', name: '현금', emoji: '💵', type: 'cash', memo: '', rates: {}, base: 0 }
  ];
}

function defaultSettings() {
  return {
    memberName: '',
    partnerName: '',
    members: [],             // 두 사람의 실제 이름 (동기화로 합집합 병합)
    retiredNames: [],        // 내가 예전에 쓰다 바꾼 이름 (다시 살아나지 않게)
    splitRatio: 50,          // splitRatioOwner 가 낼 비율(%)
    splitRatioOwner: '',     // 빈 값은 구버전 호환: 현재 기기의 '나' 기준
    /* 고정지출(렌트·유틸 등)은 비율이 아니라 '한 사람이 매달 내는 정액'으로 부담을 정한다.
       0 이면 이 기능을 쓰지 않고 위 비율을 그대로 적용한다. */
    fixedShare: 0,
    fixedShareOwner: '',     // fixedShare 정액을 부담하는 사람
    currency: 'USD',
    methods: defaultMethods(),
    lastMethod: 'cash',
    tipPresets: [15, 18, 20, 25],
    budget: 0,
    goal: { name: '', target: 0 },
    recurring: [],
    categories: defaultCategories(),
    supabaseUrl: '',
    supabaseKey: '',
    coupleCode: '',
    lang: 'auto',            // 'auto' | 'ko' | 'en'
    lastPullAt: null,
    retiredMethods: [],      // 지운 결제수단 (동기화로 다시 살아나지 않게)
    pushSub: null,           // 이 기기의 알림 구독 (동기화로 상대 기기와 합쳐진다)
    retiredSubs: [],         // 알림을 끈 기기 (다시 살아나지 않게)
    pushPrefs: { entry: true, settle: true, fixed: true, update: true },
    categoryNamesVersion: 0,  // bilingual category migration completed on this device
    metaTs: null,            // 설정 항목별로 마지막에 바꾼 시각
    metaUpdatedAt: null,
    metaDirty: false
  };
}

/* 항목별 시각을 쓰기 전에 저장된 자료를 넘겨받는다.
   '내가 한 번도 손대지 않은 항목'은 아주 옛날에 정한 것으로 쳐서,
   상대가 정해둔 값을 덮어쓰지 않게 한다. (예: 맥에서 예산을 정한 적이 없으면
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
const NO_METHOD_FILTER = '__no_payment_method__';
let filters = { q: '', who: '', category: '', method: '' };
let selectedDay = null;
let editingId = null;
let draft = null;
/* A fixed modal sits above the document, but focusing an input in it can still
   move the page underneath it on iOS. Remember the list item and its viewport
   offset before an edit so closing/saving returns to the same place. */
let editReturnPosition = null;
let editReturnToken = 0;
/* 통계 분류와 정산 내역의 체크 상태는 저장 데이터가 아니라 현재 화면에서만
   쓰는 선택값이다. 달이 바뀌면 예전 달의 선택이 섞이지 않게 비운다. */
let statsSelectionMonth = curMonth;
let statsSelectedCategories = new Set();
let sharedSelectionMonth = curMonth;
let sharedSelectedIds = new Set();
let setDraftCats = null;
let editingCategory = null;
let categoryDrag = null;
let categoryNativeDrag = null;
let setDraftRecur = null;
let editingRecurringId = null;
let settingsRatioAtOpen = 50;
let settingsFixedShareAtOpen = 0;
let settingsRatioTouched = false;
let settingsFixedShareTouched = false;
let confirmCb = null;
let syncTimer = null;
let toastTimer = null;
let categoriesNeedSync = false;

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

/* 시간은 'HH:MM' 으로 따로 둔다. 날짜(date)를 건드리면 달력·통계·반복지출·정산이
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
  return list.find((c) => c.name === name || c.nameKo === name || c.nameEn === name) || null;
}
function anyCatOf(name) {
  const cats = data.settings.categories || {};
  return [...(cats.expense || []), ...(cats.income || [])]
    .find((c) => c.name === name || c.nameKo === name || c.nameEn === name) || null;
}
/* `name` is an immutable storage key. Only these localized labels are edited. */
function catLabel(c, lang = I18n.lang) {
  if (!c) return '';
  return (lang === 'en' ? c.nameEn : c.nameKo) || c.nameKo || c.nameEn || c.name || '';
}
function categoryLabel(type, name) {
  const c = catOf(type, name);
  if (c) return catLabel(c);
  return I18n.lang === 'en' ? I18n.t(name || '') : (name || '');
}
function categoryKey(type, name) {
  const c = catOf(type, name);
  return c ? c.name : name;
}
function categorySearchText(type, name) {
  const c = catOf(type, name);
  return c ? [c.name, c.nameKo, c.nameEn].filter(Boolean).join(' ') : (name || '');
}

/* 일반 includes 검색은 단어 중간도 찾는다. 여기에 한글 초성 문자열을 하나 더
   만들어 두면 "ㅍㅋ"으로 "포커칩", "ㄱㅌ"으로 "교통"도 찾을 수 있다. */
const HANGUL_INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
function normalizeSearchText(value) {
  return String(value || '').normalize('NFC').toLocaleLowerCase('ko-KR')
    .replace(/\s+/g, ' ').trim();
}
function hangulInitialText(value) {
  return [...normalizeSearchText(value)].map((ch) => {
    const code = ch.codePointAt(0);
    return code >= 0xAC00 && code <= 0xD7A3
      ? HANGUL_INITIALS[Math.floor((code - 0xAC00) / 588)] : ch;
  }).join('');
}
function matchesSearch(haystack, query) {
  const text = normalizeSearchText(haystack);
  const q = normalizeSearchText(query);
  if (!q || text.includes(q)) return true;
  const compact = q.replace(/\s+/g, '');
  return /^[ㄱ-ㅎ]+$/.test(compact)
    && hangulInitialText(text).replace(/\s+/g, '').includes(compact);
}
function categoryKeyFor(type, key) {
  const list = data.settings.categories[type] || [];
  const c = list.find((x) => x.key === key);
  if (c) return c.name;
  return key === 'fixed' ? FIXED_CAT : (key === 'savings' ? SAVE_CAT : '');
}
function catColorOf(e) { const c = catOf(e.type, e.category); return slotColor(c ? c.slot : 0); }
function catEmojiOf(e) { const c = catOf(e.type, e.category); return c ? c.emoji : '📦'; }

/* --- 두 사람 --- */
function ME() { return data.settings.memberName || I18n.t('나'); }
/* 동기화로 받은 members 가 가장 정확하다. 아직 연동 전이면 직접 적은 이름을 쓴다. */
function PARTNER() {
  const others = (data.settings.members || []).filter((n) => n && n !== ME());
  if (others.length === 1) return others[0];
  if (data.settings.partnerName) return data.settings.partnerName;
  if (others.length) return others[0];
  const e = data.entries.find((x) => x.payer && x.payer !== ME());
  return e ? e.payer : I18n.t('상대');
}
/* 이름이 3개 이상이면 어느 한쪽이 철자를 다르게 적은 것 */
function nameConflict() {
  return (data.settings.members || []).filter(Boolean).length > 2;
}
function catShare(name) {
  const c = catOf('expense', name);
  return c && c.share === 'personal' ? 'personal' : 'half';
}
function catHasTip(name) {
  const c = catOf('expense', name);
  return !!(c && c.tip);
}

/* --- 결제수단 --- */
function methods() { return data.settings.methods || []; }
function methodOf(id) { return methods().find((m) => m.id === id) || null; }
/* 삭제된 결제수단의 id 는 기존 내역에 남아 있다. 이름은 삭제 시
 * 보존하지 않았으므로, 여러 개인 경우 일관된 번호를 붙여 구분한다. */
function missingMethodIds(entries = ledger()) {
  return [...new Set(entries
    .map((e) => e.method || '')
    .filter((id) => id && !methodOf(id)))]
    .sort();
}
function missingMethodName(id, entries = ledger()) {
  const ids = missingMethodIds(entries);
  const pos = ids.indexOf(id);
  const suffix = ids.length > 1 && pos >= 0 ? ` ${pos + 1}` : '';
  return I18n.t('지워진 결제수단') + suffix;
}
function methodLabel(id) {
  const m = methodOf(id);
  if (m) return m.emoji + ' ' + m.name;
  /* 목록의 모든 행에서 전체 원장을 다시 훑지 않도록 여기서는 공통 이름만 쓴다.
     필터와 통계에서는 missingMethodName() 으로 여러 삭제 카드를 구분한다. */
  return id ? '⚠️ ' + I18n.t('지워진 결제수단') : '';
}

function hasMethodBalanceBaseline(b) {
  return !!(b && b.baseline !== null && b.baseline !== '' && Number.isFinite(Number(b.baseline)));
}

/* 결제수단별 잔액 시작점.
 * 예전 버전의 결제수단은 이 값이 없으므로 잔액을 표시하지 않는다.
 * 금액이 0인 시작점도 유효하므로 null 여부로 설정 유무를 구분한다.
 * baseline 은 시작점을 저장했을 때 시작일보다 앞선 내역이 잔액에 기여하던 합계다.
 * 현재 합계와 baseline 의 차이만 더해야 이미 시작 금액에 들어간 과거 내역을
 * 통째로 다시 세지 않으면서, 나중에 추가·수정·삭제한 차액만 반영할 수 있다. */
function methodBalanceStart(m) {
  const b = m && m.balanceStart;
  if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return null;
  const baselineReady = hasMethodBalanceBaseline(b);
  return {
    amount: Number(b.amount) || 0,
    date: b.date,
    before: b.before === 'include' ? 'include' : 'exclude',
    baseline: baselineReady ? Number(b.baseline) : 0,
    baselineReady
  };
}

function methodEntryContribution(m, e) {
  if (!e || e.deleted || e.method !== m.id || (e.type !== 'expense' && e.type !== 'income')) return 0;
  const expenseSign = m.type === 'credit' ? 1 : -1;
  return (e.type === 'expense' ? expenseSign : -expenseSign) * (Number(e.amount) || 0);
}

/* 시작일은 '그날 시작 시점'이므로 과거 스냅샷에는 시작일 전날까지의 내역만 담는다.
 * 시작일 당일 내역은 아래 methodBalance 에서 언제나 이후 내역으로 전액 반영된다. */
function methodBalanceBaseline(m, date, entries = liveEntries()) {
  let out = 0;
  for (const e of entries) {
    if (!e.date || e.date >= date) continue;
    out += methodEntryContribution(m, e);
  }
  return out;
}

/* v1.8.0 에서 만든 시작점에는 baseline 이 없다. 현재 저장된 과거 내역을 최초
 * 스냅샷으로 삼으면 업데이트 직후 잔액이 과거 전체만큼 갑자기 변하지 않는다. */
function migrateMethodBalanceBaselines() {
  let changed = false;
  for (const m of methods()) {
    const b = m && m.balanceStart;
    if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) continue;
    if (hasMethodBalanceBaseline(b)) continue;
    b.baseline = methodBalanceBaseline(m, b.date);
    changed = true;
  }
  if (changed) markMeta('methods');
  return changed;
}

/* 다른 공유 원장에 처음 연결하거나 원장을 바꾸면, 기존 로컬 스냅샷은
   그 원격 원장을 반영하지 못한 값이다. 타임스탬프는 건드리지 않고 비워 두어
   첫 pull 에서 원격 설정과 내역을 합친 뒤 다시 잡게 한다. */
function invalidateMethodBalanceBaselines() {
  let changed = false;
  for (const m of methods()) {
    if (!m.balanceStart || !hasMethodBalanceBaseline(m.balanceStart)) continue;
    m.balanceStart.baseline = null;
    changed = true;
  }
  return changed;
}

/* 신용카드는 '쓴 금액(미결제액)', 체크카드·현금은 '쓸 수 있는 잔액'을 계산한다.
 * 시작일은 그날 시작 시점이므로 당일 내역은 반영한다.
 * 미래 내역은 '현재 잔액'에 섞이지 않도록 당일까지만 센다. */
function methodBalance(m, entries = liveEntries(), today = todayStr()) {
  const start = methodBalanceStart(m);
  if (!start) return null;
  let out = start.amount;
  let beforeNow = 0;
  for (const e of entries) {
    if (!e.date || e.date > today) continue;
    const contribution = methodEntryContribution(m, e);
    if (!contribution) continue;
    if (e.date < start.date) beforeNow += contribution;
    else out += contribution;
  }
  if (start.before === 'include' && start.baselineReady) out += beforeNow - start.baseline;
  return roundMoney(out);
}

function methodBalanceName(m) {
  return I18n.t(m.type === 'credit' ? '현재 사용액' : '현재 잔액');
}
function categoryRateValue(rates, category) {
  const c = typeof category === 'object' ? category : catOf('expense', category);
  /* The stable key wins when both a legacy localized key and the current key
     exist. This keeps an old alias from overriding a rate the user just saved. */
  const keys = [...new Set([c && c.name,
    typeof category === 'string' ? category : null,
    c && c.nameKo, c && c.nameEn].filter(Boolean))];
  const key = keys.find((k) => rates && rates[k] != null && rates[k] !== '');
  return key ? rates[key] : null;
}
function methodRate(m, category) {
  if (!m) return 0;
  const r = categoryRateValue(m.rates, category);
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

/* --- 고정비 정액 부담 --- */
/* 보낸 돈이 '몇 월 고정비 몫'인지. 예전 기록엔 없으니 보낸 날짜의 달로 본다. */
function settleMonth(e) { return e.forMonth || (e.date || '').slice(0, 7); }

/* 이번 달 예산 밖으로 빼둔 지출인지.
   갑자기 생긴 큰 돈(가전, 수리비 등)은 매달 넣기로 한 생활비에서 쓴 게 아니라
   그때그때 따로 더 넣는 돈이라, 예산·남은 돈 계산에서 빼야 한다.
   (정산에서는 여느 '같이 쓴 돈'과 똑같이 나눈다) */
function isOffBudget(e) { return !!e.offBudget; }

/* 한 달 지출을 세 갈래로 나눈다: 고정지출 · 생활비 · 예산 밖 추가지출 */
function monthBuckets(m) {
  const list = monthLedger(m);
  const res = { fixed: 0, living: 0, extra: 0,        // 나간 돈
                income: 0, fixedIn: 0, extraIn: 0 };  // 넣은 돈
  for (const e of list) {
    const fx = isFixedCat(e.category);
    const off = isOffBudget(e);
    if (e.type === 'income') {
      if (fx) res.fixedIn += e.amount;          // 렌트·유틸 몫으로 넣은 돈
      else if (off) res.extraIn += e.amount;    // 예산 밖 지출 때문에 더 넣은 돈
      else res.income += e.amount;              // 생활비 통장에 넣은 돈
    } else if (e.type === 'expense') {
      if (fx) res.fixed += e.amount;
      else if (off) res.extra += e.amount;
      else res.living += e.amount;
    }
  }
  return res;
}

/* 비율과 고정비 정액은 두 기기에서 같은 값을 보지만,
 * 의미는 저장된 owner 기준이다. owner 가 없는 구자료는 예전처럼
 * 현재 기기의 '나' 기준으로 읽어 기존 50:50/사용자 값을 보존한다. */
function splitRatioValue() {
  const n = Number(data.settings.splitRatio);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
}
function ownerIsMe(owner) {
  if (!owner || owner === ME()) return true;
  return (data.settings.retiredNames || []).includes(owner);
}
function splitRatioOwnerName() { return data.settings.splitRatioOwner || ME(); }
function mySplitRatioPct() {
  const pct = splitRatioValue();
  return ownerIsMe(data.settings.splitRatioOwner) ? pct : 100 - pct;
}
function fixedShareAmount() {
  const n = Number(data.settings.fixedShare);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
function fixedShareOwnerName() { return data.settings.fixedShareOwner || ME(); }
function fixedShareBelongsToMe() { return ownerIsMe(data.settings.fixedShareOwner); }
function myFixedBurden(total) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const ownerPart = Math.min(fixedShareAmount(), safeTotal);
  return fixedShareBelongsToMe() ? ownerPart : safeTotal - ownerPart;
}
function usingFixedShare() { return fixedShareAmount() > 0; }
function isFixedCat(name) {
  const c = anyCatOf(name);
  return name === FIXED_CAT || !!(c && c.key === 'fixed');
}
function isSavingsCat(name) {
  const c = catOf('expense', name);
  return name === SAVE_CAT || !!(c && c.key === 'savings');
}

/* 같이 쓴 돈을 두 사람 부담액으로 나눈다.
 * 고정지출은 (정액 부담을 쓰는 경우) 달마다 내 몫을 정액으로 두고 나머지를 상대가 부담한다.
 * 그 밖의 지출은 분담 비율대로 나눈다. */
function burdenOf(expenses) {
  const myRatio = mySplitRatioPct() / 100;
  const useFixed = usingFixedShare();
  const res = { mine: 0, yours: 0, other: 0, myPaid: 0, yoursPaid: 0 };
  const fixedByMonth = {};   // 달별로 모아서 정액을 적용해야 한다

  for (const e of expenses) {
    if (e.type !== 'expense') continue;
    const mine = isMe(e.payer);
    const known = mine || e.payer === PARTNER();
    if (mine) res.myPaid += e.amount;
    else if (known) res.yoursPaid += e.amount;

    if (e.split !== 'half') {
      if (mine) res.mine += e.amount;
      else if (known) res.yours += e.amount;
      else res.other += e.amount;
      continue;
    }
    if (useFixed && isFixedCat(e.category)) {
      const m = (e.date || '').slice(0, 7);
      const g = fixedByMonth[m] || (fixedByMonth[m] = { total: 0 });
      g.total += e.amount;
      continue;
    }
    res.mine += e.amount * myRatio;
    res.yours += e.amount * (1 - myRatio);
  }

  for (const m in fixedByMonth) {
    const total = fixedByMonth[m].total;
    const myPart = myFixedBurden(total);
    res.mine += myPart;
    res.yours += total - myPart;
  }
  return res;
}
function isMe(name) { return name === ME(); }
function whoClass(name) { return isMe(name) ? 'me' : 'you'; }
function whoColor(name) { return isMe(name) ? cssVar('--me') : cssVar('--you'); }

/* --- 금액 --- */
function isUSD() { return data.settings.currency === 'USD'; }
/* 달러는 센트까지, 원은 원 단위로 반올림한다 (정산·팁 계산에서 오차가 쌓이지 않게) */
function roundMoney(n) {
  if (!n) return 0;
  const unit = isUSD() ? 100 : 1;
  const abs = Math.abs(n);
  return Math.sign(n) * Math.round((abs + Number.EPSILON * Math.max(1, abs)) * unit) / unit;
}

function fmtMoney(n) {
  if (isUSD()) {
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const amount = Math.round(n).toLocaleString(I18n.lang === 'en' ? 'en-US' : 'ko-KR');
  return I18n.lang === 'en' ? '₩' + amount : amount + '원';
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
function monthLabel(m) {
  const [y, mo] = m.split('-');
  if (I18n.lang === 'en') {
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(Number(y), Number(mo) - 1, 1)));
  }
  return y + '년 ' + Number(mo) + '월';
}
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
function settleEntries() {
  return liveEntries().filter((e) => e.type === 'settle').sort((a, b) => b.date.localeCompare(a.date));
}

function touch(e) { e.updatedAt = new Date().toISOString(); e.dirty = true; }

/* 공유 설정은 '항목마다' 따로 바뀐 시각을 남긴다.
   예전엔 설정 전체를 한 덩어리로 비교해서, 한쪽에서 카드 하나만 추가해도
   다른 쪽에서 정해둔 예산까지 통째로 덮어써 사라졌다. */
const META_FIELDS = ['categories', 'budget', 'splitRatio', 'fixedShare',
  'goal', 'recurring', 'methods', 'retiredMethods'];
function markMeta(...fields) {
  const s = data.settings;
  const now = new Date().toISOString();
  s.metaTs = s.metaTs || {};
  (fields.length ? fields : META_FIELDS).forEach((f) => { s.metaTs[f] = now; });
  s.metaUpdatedAt = now;
  s.metaDirty = true;
}
function afterChange() { Store.save(data); render(); scheduleSync(); }

function currentViewContext() {
  return {
    view,
    month: curMonth,
    selectedDay,
    filters: JSON.stringify(filters)
  };
}

function sameViewContext(a, b) {
  return !!(a && b && a.view === b.view && a.month === b.month
    && a.selectedDay === b.selectedDay && a.filters === b.filters);
}

function viewItemKey(el) {
  if (!el || !el.dataset) return null;
  if (el.dataset.id) return { attr: 'id', value: el.dataset.id };
  if (el.dataset.entry) return { attr: 'entry', value: el.dataset.entry };
  if (el.dataset.send) return { attr: 'send', value: el.dataset.send };
  return null;
}

function findViewItem(key) {
  const root = $('#view');
  if (!root || !key) return null;
  return [...root.querySelectorAll(`[data-${key.attr}]`)]
    .find((el) => el.dataset[key.attr] === key.value) || null;
}

function captureEditReturnPosition(modalId, itemId) {
  editReturnToken++;
  if (!itemId) { editReturnPosition = null; return; }

  const root = $('#view');
  const items = root
    ? [...root.querySelectorAll('.entry-row[data-id], [data-entry], [data-send]')]
    : [];
  const target = items.find((el) => {
    const key = viewItemKey(el);
    return key && key.value === itemId;
  }) || null;
  const innerScroller = target && target.closest('.shared-entry-scroll');
  const innerVisible = innerScroller
    ? [...innerScroller.querySelectorAll('[data-entry]')].find((el) => {
      const r = el.getBoundingClientRect();
      const sr = innerScroller.getBoundingClientRect();
      return r.bottom > sr.top && r.top < sr.bottom;
    }) : null;
  const visible = items.find((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }) || null;
  const scrollEl = document.scrollingElement || document.documentElement;

  editReturnPosition = {
    modalId,
    context: currentViewContext(),
    scrollTop: scrollEl.scrollTop,
    itemKey: viewItemKey(target),
    itemTop: target ? target.getBoundingClientRect().top : null,
    fallbackKey: viewItemKey(visible),
    fallbackTop: visible ? visible.getBoundingClientRect().top : null,
    innerScrollTop: innerScroller ? innerScroller.scrollTop : null,
    innerItemTop: innerScroller && target
      ? target.getBoundingClientRect().top - innerScroller.getBoundingClientRect().top : null,
    innerFallbackKey: viewItemKey(innerVisible),
    innerFallbackTop: innerScroller && innerVisible
      ? innerVisible.getBoundingClientRect().top - innerScroller.getBoundingClientRect().top : null
  };
}

/* `rerendered` uses a stable row anchor because an edited date/title can change
   the height/order above it. Cancel/close did not replace the DOM, so restoring
   the exact saved scrollTop is the least surprising result. */
function restoreEditReturnPosition(modalId, rerendered) {
  const saved = editReturnPosition;
  if (!saved || saved.modalId !== modalId) return;
  editReturnPosition = null;
  const token = ++editReturnToken;

  const apply = () => {
    if (token !== editReturnToken || !sameViewContext(saved.context, currentViewContext())) return;
    const scrollEl = document.scrollingElement || document.documentElement;
    if (!rerendered) {
      window.scrollTo(0, saved.scrollTop);
      return;
    }
    if (Number.isFinite(saved.innerScrollTop)) {
      const inner = $('.shared-entry-scroll');
      if (inner) {
        inner.scrollTop = saved.innerScrollTop;
        const item = findViewItem(saved.itemKey);
        const fallback = item ? null : findViewItem(saved.innerFallbackKey);
        const anchor = item || fallback;
        const oldTop = item ? saved.innerItemTop : saved.innerFallbackTop;
        if (anchor && anchor.closest('.shared-entry-scroll') === inner
            && Number.isFinite(oldTop)) {
          const newTop = anchor.getBoundingClientRect().top - inner.getBoundingClientRect().top;
          inner.scrollTop += newTop - oldTop;
        }
      }
      window.scrollTo(0, Math.min(saved.scrollTop,
        Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight)));
      return;
    }
    const item = findViewItem(saved.itemKey);
    const fallback = item ? null : findViewItem(saved.fallbackKey);
    const anchor = item || fallback;
    const oldTop = item ? saved.itemTop : saved.fallbackTop;
    if (anchor && Number.isFinite(oldTop)) {
      window.scrollBy(0, anchor.getBoundingClientRect().top - oldTop);
    } else {
      window.scrollTo(0, Math.min(saved.scrollTop,
        Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight)));
    }
  };

  requestAnimationFrame(() => requestAnimationFrame(apply));
  /* Safari adjusts the layout viewport once more while its keyboard is closing.
     Re-apply only during that short transition, and only if the user is still in
     the exact same view/month/filter context. */
  const vv = window.visualViewport;
  const onResize = () => requestAnimationFrame(apply);
  if (vv) vv.addEventListener('resize', onResize);
  setTimeout(() => {
    if (vv) vv.removeEventListener('resize', onResize);
    apply();
  }, 240);
}

function closeModal(id) {
  const modal = $('#' + id);
  if (modal) modal.classList.add('hidden');
  restoreEditReturnPosition(id, false);
}

function toast(msg) {
  const el = $('#toast');
  /* Toast text is replaced on an existing node and may disappear before a
     MutationObserver translation becomes visible. Localize it at the source. */
  el.textContent = I18n.t(msg);
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

/* ==================== 정산 계산 ==================== */
/* 반환값 > 0 : 상대가 나에게 줘야 할 돈 */
function balance() {
  const live = liveEntries();
  // 내가 먼저 낸 돈에서 내가 실제로 부담해야 할 몫을 빼면, 그게 상대가 나에게 줄 돈이다
  const b = burdenOf(live.filter((e) => e.type === 'expense'));
  let net = b.myPaid - b.mine;
  for (const e of live) {
    if (e.type !== 'settle') continue;
    if (isMe(e.payer)) net += e.amount;   // 내가 보낸 돈(선입금·정산)
    else net -= e.amount;                  // 상대가 보낸 돈
  }
  return roundMoney(net);
}

/* ==================== 이름 자동 맞추기 ====================
 * 연동 전에는 상대 이름을 직접 적게 되는데, 상대가 실제로 쓰는 이름과 다를 수 있다.
 * 동기화로 진짜 이름을 알게 되면 내가 적어둔 이름으로 기록해 둔 내역까지 함께 고쳐준다.
 * (이걸 안 하면 같은 사람이 두 명으로 잡혀서 정산 금액이 틀어진다) */
function reconcileNames() {
  const s = data.settings;
  const others = (s.members || []).filter((n) => n && n !== ME());
  if (others.length !== 1) return false;   // 아직 상대가 연결 안 됐거나 이름이 꼬인 상태
  const real = others[0];
  const typed = s.partnerName;
  if (typed === real) return false;
  if (typed && typed !== ME()) {
    renamePayer(typed, real);
  }
  s.partnerName = real;
  return true;
}

/* 내역·반복지출·분담 기준에 적힌 사람 이름을 바꾼다 */
function renamePayer(from, to) {
  if (!from || !to || from === to) return false;
  let changed = false;
  data.entries.forEach((e) => {
    if (e.payer === from) { e.payer = to; touch(e); changed = true; }
    if (e.member === from) e.member = to;
  });
  (data.settings.recurring || []).forEach((r) => {
    if (r.payer === from) { r.payer = to; changed = true; }
  });
  if (changed) markMeta('recurring');
  if (data.settings.splitRatioOwner === from) {
    data.settings.splitRatioOwner = to;
    markMeta('splitRatio');
    changed = true;
  }
  if (data.settings.fixedShareOwner === from) {
    data.settings.fixedShareOwner = to;
    markMeta('fixedShare');
    changed = true;
  }
  return changed;
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
            category: categoryKey('expense', r.category || categoryKeyFor('expense', 'fixed')),
            memo: r.memo || '',
            member: ME(),
            payer: r.payer || ME(),
            split: r.split || 'half',
            method: r.method || '',
            recurringId: r.id,
            recurringMonth: m,
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
  const categoriesMigrated = normalizeCategories(data.settings.categories);
  categoriesNeedSync = Number(data.settings.categoryNamesVersion || 0) < 1;
  let categoryMigrationSaved = categoriesMigrated;
  if (!data.settings.goal) data.settings.goal = { name: '', target: 0 };
  if (!Array.isArray(data.settings.recurring)) data.settings.recurring = [];
  if (!Array.isArray(data.settings.members)) data.settings.members = [];
  if (!Array.isArray(data.settings.retiredNames)) data.settings.retiredNames = [];
  if (!Array.isArray(data.settings.retiredMethods)) data.settings.retiredMethods = [];
  // 예전 버전 데이터 보정
  if (!Array.isArray(data.settings.tipPresets)) data.settings.tipPresets = [15, 18, 20, 25];
  if (!Array.isArray(data.settings.methods) || !data.settings.methods.length) {
    data.settings.methods = defaultMethods();
  }
  if (!methodOf(data.settings.lastMethod)) data.settings.lastMethod = methods()[0].id;
  seedMetaTs(data.settings);   // 항목별 시각이 없던 예전 자료를 넘겨받는다
  const defCats = defaultCategories().expense;
  data.settings.categories.expense.forEach((c) => {
    const d = defCats.find((x) => x.name === c.name || x.nameEn === c.name
      || (x.key && x.key === c.key));
    if (!c.share) c.share = d ? d.share : 'half';
    if (c.tip === undefined) c.tip = !!(d && d.tip);
  });
  /* 예전 자료에는 수입 쪽 '고정지출' 분류가 없다.
     이게 있어야 렌트·유틸 몫으로 넣은 돈을 생활비 통장과 갈라놓을 수 있다. */
  if (!data.settings.categories.income.some((c) => c.name === FIXED_CAT || c.key === 'fixed')) {
    const d = defaultCategories().income.find((c) => c.name === FIXED_CAT);
    data.settings.categories.income.splice(1, 0, { ...d });
    markMeta('categories');
  }
  data.entries.forEach((e) => {
    if (!e.payer) e.payer = e.member || data.settings.memberName;
    if (e.type === 'expense' && !e.split) e.split = 'half';
  });
  if (data.settings.memberName && !data.settings.members.includes(data.settings.memberName)) {
    data.settings.members.push(data.settings.memberName);
  }

  I18n.setLang(data.settings.lang || 'auto', userWords, stockNames());
  const pushLocaleMigrated = Push.refreshMetadata(ME());
  seedNamesForLang();
  Sync.configure(data.settings);
  /* 공유 중인 기기는 첫 pull/LWW 전에 migration 시각을 '지금'으로
     찍지 않는다. 상대의 더 최신 편집을 먼저 받은 다음 bilingual 필드를 올린다. */
  if (categoriesNeedSync && !Sync.isConfigured()) {
    markMeta('categories');
    data.settings.categoryNamesVersion = 1;
    categoriesNeedSync = false;
    categoryMigrationSaved = true;
  }
  Sync.onStatus(renderSyncStatus);
  bindStatic();

  /* 반복 지출로 생길 과거 내역까지 모두 만든 다음 기존 시작점의 최초 스냅샷을 잡는다.
     그래야 업데이트 직후 그 내역이 '나중에 추가된 변경분'으로 잘못 잡히지 않는다. */
  const recurringAdded = applyRecurring();
  /* 연결된 기기는 원격 과거 내역까지 먼저 받은 뒤 runSync 에서 스냅샷을 잡는다.
     오프라인 상태에서 불완전한 로컬 원장만 기준으로 확정하면 나중에 잔액이 튈 수 있다. */
  const balanceStartMigrated = Sync.isConfigured() ? false : migrateMethodBalanceBaselines();
  if (recurringAdded || balanceStartMigrated || categoryMigrationSaved || pushLocaleMigrated) Store.save(data);

  render();
  renderSyncStatus(Sync.getStatus());

  if (!data.settings.memberName) {
    $('#welcomeModal').classList.remove('hidden');
    $('#wcMe').focus();
  }

  runSync();
  setInterval(runSync, 60000);
  setInterval(() => { if (applyRecurring()) afterChange(); }, 3600000);
  window.addEventListener('focus', runSync);
  window.addEventListener('online', runSync);
  /* 아이폰은 앱을 나갈 때 beforeunload 를 부르지 않는다.
     화면이 가려지는 순간(visibilitychange/pagehide)에 밀린 저장을 반드시 밀어넣어야
     홈 화면 앱을 다시 열었을 때 설정과 내역이 그대로 남아 있다. */
  const flushSave = () => { Store.flush(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
  window.addEventListener('pagehide', flushSave);
  window.addEventListener('blur', flushSave);
  window.addEventListener('beforeunload', flushSave);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
}

function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(runSync, 2500); }
async function runSync() {
  if (!Sync.isConfigured()) return;
  const { changed } = await Sync.syncNow(data);
  const renamed = reconcileNames();
  const categoriesMigrated = normalizeCategories(data.settings.categories);
  const categoriesSchemaChanged = categoriesMigrated || categoriesNeedSync;
  const categoriesMigrationReady = Sync.getStatus().state === 'ok' && categoriesSchemaChanged;
  if (categoriesMigrationReady) {
    markMeta('categories');
    data.settings.categoryNamesVersion = 1;
    categoriesNeedSync = false;
  }
  if (changed) applyRecurring();
  /* 아직 v1.8.0 인 상대 기기에서 baseline 없는 결제수단을 받아온 경우도 즉시 보정한다. */
  const balanceStartMigrated = Sync.getStatus().state === 'ok'
    ? migrateMethodBalanceBaselines() : false;
  /* 설정 화면이 열린 채 동기화돼도 다른 초안 필드는 보존하고, 방금 확정된
     같은 범위의 baseline 만 초안에 옮겨 다음 저장에서 null 로 되돌아가지 않게 한다. */
  if (balanceStartMigrated && Array.isArray(setDraftMethods)) {
    for (const draft of setDraftMethods) {
      const saved = methodOf(draft.id);
      const db = draft.balanceStart;
      const sb = saved && saved.balanceStart;
      if (!db || !sb || draft.type !== saved.type || db.date !== sb.date) continue;
      if (!hasMethodBalanceBaseline(db) && hasMethodBalanceBaseline(sb)) {
        db.baseline = Number(sb.baseline);
      }
    }
  }
  // 동기화 결과(받아온 내역·lastPullAt)를 바로 남긴다. 지연 저장이면 앱을 나갈 때 날아간다.
  Store.saveNow(data);
  if (changed || renamed || balanceStartMigrated || categoriesMigrated) render();
  if (renamed || balanceStartMigrated || categoriesMigrationReady) scheduleSync();
}

/* ==================== 이벤트 ==================== */
const SINGLE_LINE_EDIT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'password', 'number']);

function isSingleLineEdit(target) {
  return !!(target && target.matches && target.matches('input')
    && SINGLE_LINE_EDIT_TYPES.has((target.getAttribute('type') || '').toLowerCase()));
}

/* Keep Select All reliable in both Electron and the installed iPhone web app.
   Copy/cut/paste/undo/redo are intentionally left entirely to the browser. */
function handleTextSelectAll(ev) {
  if (ev.defaultPrevented || ev.isComposing || ev.keyCode === 229
      || String(ev.key).toLowerCase() !== 'a' || (!ev.ctrlKey && !ev.metaKey) || ev.altKey) return;
  const target = ev.target;
  if (!isSingleLineEdit(target) && !(target && target.matches && target.matches('textarea'))) return;
  ev.preventDefault();
  target.select();
}

/* A single Enter handler keeps every add/edit modal consistent. It deliberately
   handles only an unmodified Enter, so all other browser/Electron editing
   shortcuts keep their native behaviour in focused fields. */
function handleModalEnter(ev) {
  if (ev.key !== 'Enter' || ev.defaultPrevented || ev.repeat || ev.isComposing || ev.keyCode === 229
      || ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return;

  const target = ev.target;
  if (!target || !target.matches) return;
  /* Buttons and links already have correct native Enter activation. Handling
     them again here would click twice (and Enter on Cancel could also save). */
  if (target.closest('button, a, [role="button"]')) return;

  const modal = target.closest('.modal-backdrop:not(.hidden)');
  if (!modal) return;
  /* 설정 위의 편집창이나 확인창처럼 모달이 겹쳤을 때는 가장 위 창만
     키보드 입력을 받는다. iPhone에서 뒤 입력칸에 포커스가 남아도
     Enter가 가려진 내역·설정을 저장하지 않게 한다. */
  const visibleModals = [...document.querySelectorAll('.modal-backdrop:not(.hidden)')];
  if (modal !== visibleModals[visibleModals.length - 1]) return;

  /* Textareas/contenteditable retain newline behaviour. Date/time/select and
     other native controls retain their platform-specific keyboard behaviour. */
  if (!isSingleLineEdit(target)) return;

  let action = null;
  if (modal.id === 'entryModal') action = saveEntry;
  else if (modal.id === 'categoryModal') action = saveCategoryEditor;
  else if (modal.id === 'methodModal') action = saveMethod;
  else if (modal.id === 'sendModal') action = saveSendEntry;
  else if (modal.id === 'welcomeModal') action = welcomeStart;
  else if (modal.id === 'settingsModal') {
    /* These rows are small forms inside Settings. Enter should finish that
       row, not close and save the whole Settings modal. */
    if (target.closest('.recur-add')) action = saveRecurringForm;
    else if (target.id === 'methodAdd') action = () => $('#btnMethodAdd').click();
    else action = () => saveSettings(false);
  }
  if (!action) return;

  ev.preventDefault();
  action();
}

function bindStatic() {
  $('#btnPrevMonth').addEventListener('click', () => { curMonth = shiftMonth(curMonth, -1); selectedDay = null; render(); });
  $('#btnNextMonth').addEventListener('click', () => { curMonth = shiftMonth(curMonth, 1); selectedDay = null; render(); });
  $('#monthLabel').addEventListener('click', () => { curMonth = todayStr().slice(0, 7); selectedDay = null; render(); });
  $('#btnAdd').addEventListener('click', () => openEntryModal(null));
  $('#btnSettings').addEventListener('click', openSettings);
  $('#coupleBadge').addEventListener('click', openSettings);
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
    b.addEventListener('click', () => closeModal(b.dataset.close)));
  document.querySelectorAll('.modal-backdrop').forEach((bd) => {
    bd.addEventListener('mousedown', (ev) => {
      if (ev.target === bd && bd.id !== 'welcomeModal') closeModal(bd.id);
    });
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      const visible = [...document.querySelectorAll('.modal-backdrop:not(.hidden)')];
      const top = visible[visible.length - 1];
      if (top && top.id !== 'welcomeModal') closeModal(top.id);
    }
  });
  document.addEventListener('keydown', handleTextSelectAll);
  document.addEventListener('keydown', handleModalEnter);

  /* --- 입력 모달 --- */
  $('#typeSeg').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    captureDraft();
    draft.type = b.dataset.type;
    const list = data.settings.categories[draft.type];
    if (!list.some((c) => c.name === draft.category)) draft.category = list[0].name;
    if (draft.type === 'expense') draft.split = catShare(draft.category);
    else { draft.tipMode = 'none'; draft.tip = 0; }
    recalcTip();
    renderEntryModal();
  });
  $('#payerSeg').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    captureDraft();
    draft.payer = b.dataset.payer;
    renderEntryModal();
  });
  $('#inOffBudget').addEventListener('change', (ev) => { draft.offBudget = ev.target.checked; });
  $('#btnSplitToggle').addEventListener('click', () => {
    captureDraft();
    draft.split = draft.split === 'half' ? 'personal' : 'half';
    renderEntryModal();
  });
  $('#catGrid').addEventListener('click', (ev) => {
    const chip = ev.target.closest('.cat-chip');
    if (!chip) return;
    captureDraft();
    draft.category = chip.dataset.name;
    // 나눔 방식은 분류가 정해준 기본값을 따라간다 (그 뒤 아래 줄에서 바꿀 수 있음)
    if (draft.type === 'expense') draft.split = catShare(draft.category);
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

  /* --- 설정 --- */
  $('#setRatio').addEventListener('input', () => {
    settingsRatioTouched = true;
    updateRatioLabel();
  });
  $('#setFixedShare').addEventListener('input', () => {
    settingsFixedShareTouched = true;
    $('#setFixedShare').value = maskAmount($('#setFixedShare').value);
    updateRatioLabel();
  });
  $('#btnGenCode').addEventListener('click', () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = 'US-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    $('#setCoupleCode').value = code;
  });
  $('#btnSaveSettings').addEventListener('click', () => saveSettings(false));
  $('#btnSyncNow').addEventListener('click', async () => {
    if (saveSettings(true) === false) return;
    if (!Sync.isConfigured()) {
      $('#syncInfo').textContent = I18n.t('URL·키·커플 코드를 모두 넣어주세요.');
      return;
    }
    $('#syncInfo').textContent = I18n.t('동기화 중…');
    await runSync();
    const st = Sync.getStatus();
    $('#syncInfo').textContent = st.state === 'ok'
      ? I18n.t('✓ 연결됐어요! 이제 둘의 가계부가 합쳐집니다.')
      : I18n.t('⚠ 실패:') + ' ' + (st.error || I18n.t('연결을 확인해주세요'));
  });

  $('#catManage').addEventListener('click', (ev) => {
    const edit = ev.target.closest('[data-catedit]');
    if (edit) {
      openCategoryModal(edit.dataset.type, Number(edit.dataset.catedit));
      return;
    }
    const add = ev.target.closest('[data-catadd]');
    if (add) { openCategoryModal(add.dataset.catadd); return; }
    const share = ev.target.closest('[data-share]');
    if (share) {
      const c = setDraftCats.expense.find((x) => x.name === share.dataset.share);
      if (c) c.share = c.share === 'personal' ? 'half' : 'personal';
      renderCatManage(); return;
    }
    const tipCat = ev.target.closest('[data-tipcat]');
    if (tipCat) {
      const c = setDraftCats.expense.find((x) => x.name === tipCat.dataset.tipcat);
      if (c) c.tip = !c.tip;
      renderCatManage(); return;
    }
    const del = ev.target.closest('[data-del]');
    if (del) {
      const c = setDraftCats[del.dataset.type].find((x) => x.name === del.dataset.del);
      if (c && c.key) { toast('기본 분류는 삭제할 수 없어요'); return; }
      setDraftCats[del.dataset.type] = setDraftCats[del.dataset.type].filter((c) => c.name !== del.dataset.del);
      renderCatManage(); return;
    }
  });
  /* 분류 순서 변경은 전용 핸들에서만 시작한다. 따라서 같은 줄의
     같이/혼자·팁·수정·삭제 버튼을 누르는 동작과 충돌하지 않는다. */
  $('#catManage').addEventListener('pointerdown', (ev) => {
    /* 마우스는 아래 native drag/drop 경로를 쓰고, Pointer Events는
       기본 drag/drop이 불안정한 iPhone 터치와 펜 입력만 담당한다. */
    if (ev.pointerType !== 'mouse') beginCategoryDrag(ev, ev.pointerId, ev.pointerType || 'touch');
  });
  $('#catManage').addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') moveCategoryDrag(ev, ev.pointerId);
  });
  $('#catManage').addEventListener('pointerup', (ev) => {
    if (ev.pointerType !== 'mouse') finishCategoryDrag(ev, true, ev.pointerId);
  });
  $('#catManage').addEventListener('pointercancel', (ev) => {
    if (ev.pointerType !== 'mouse') finishCategoryDrag(ev, false, ev.pointerId);
  });
  $('#catManage').addEventListener('lostpointercapture', (ev) => {
    if (categoryDrag && categoryDrag.pointerId === ev.pointerId) finishCategoryDrag(ev, false, ev.pointerId);
  });
  /* 데스크톱 마우스는 브라우저의 기본 drag/drop을 사용한다. 이동 중인 칩의
     위치가 커서와 함께 자연스럽게 보이고 Electron에서도 안정적으로 동작한다. */
  $('#catManage').addEventListener('dragstart', beginNativeCategoryDrag);
  $('#catManage').addEventListener('dragover', moveNativeCategoryDrag);
  $('#catManage').addEventListener('drop', finishNativeCategoryDrop);
  $('#catManage').addEventListener('dragend', cancelNativeCategoryDrag);
  $('#catManage').addEventListener('keydown', onCategoryDragKeydown);
  $('#btnCategorySave').addEventListener('click', saveCategoryEditor);

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
  $('#methodTypeSeg').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    methodDraftType = b.dataset.mtype;
    renderMethodModal();
  });
  $('#btnMethodSave').addEventListener('click', saveMethod);
  $('#btnMethodDelete').addEventListener('click', deleteMethod);
  $('#inTrackBalance').addEventListener('change', renderMethodBalanceFields);
  $('#inStartingBalance').addEventListener('input', () => {
    $('#inStartingBalance').value = maskAmount($('#inStartingBalance').value);
  });
  $('#inBalanceStartDate').addEventListener('change', renderMethodBalanceFields);
  $('#inIncludeBeforeStart').addEventListener('change', renderMethodBalanceFields);
  $('#rateGrid').addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-rate]');
    if (el) methodDraftRates[el.dataset.rate] = el.value;
  });

  $('#btnRecAdd').addEventListener('click', saveRecurringForm);
  $('#btnRecCancel').addEventListener('click', resetRecurringForm);
  $('#recAmount').addEventListener('input', () => {
    $('#recAmount').value = maskAmount($('#recAmount').value);
  });
  $('#recurList').addEventListener('click', (ev) => {
    const del = ev.target.closest('[data-recdel]');
    if (del) { confirmDeleteRecurring(del.dataset.recdel); return; }
    const edit = ev.target.closest('[data-recedit]');
    if (edit) beginRecurringEdit(edit.dataset.recedit);
  });

  /* --- 돈 보낸 기록 --- */
  $('#sendFromSeg').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    sendFrom = b.dataset.from;
    renderSendModal();
  });
  $('#sendForSeg').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    sendFor = b.dataset.for;
    renderSendModal();
  });
  $('#inSendDate').addEventListener('change', renderSendModal);
  $('#inSendAmount').addEventListener('input', () => {
    $('#inSendAmount').value = maskAmount($('#inSendAmount').value);
    renderSendModal();
  });
  $('#btnSendSave').addEventListener('click', saveSendEntry);
  $('#btnSendDelete').addEventListener('click', deleteSendEntry);

  $('#btnCsvMonth').addEventListener('click', () => exportCsv(true));
  $('#btnCsvAll').addEventListener('click', () => exportCsv(false));

  /* --- 환영 / 확인 --- */
  $('#btnWelcomeStart').addEventListener('click', welcomeStart);
  $('#btnConfirmOk').addEventListener('click', () => {
    $('#confirmModal').classList.add('hidden');
    const cb = confirmCb; confirmCb = null;
    if (cb) cb();
  });

  /* --- 본문 위임 --- */
  $('#view').addEventListener('click', (ev) => {
    if (ev.target.closest('[data-stat-clear]')) {
      statsSelectedCategories.clear();
      renderStats();
      return;
    }
    const statCategory = ev.target.closest('[data-stat-category]');
    if (statCategory) {
      const name = statCategory.dataset.statCategory;
      if (statsSelectedCategories.has(name)) statsSelectedCategories.delete(name);
      else statsSelectedCategories.add(name);
      renderStats();
      return;
    }
    const sharedAll = ev.target.closest('[data-shared-select-all]');
    if (sharedAll) {
      const entries = sharedEntriesForMonth();
      const allSelected = entries.length > 0
        && entries.every((e) => sharedSelectedIds.has(e.id));
      if (allSelected) sharedSelectedIds.clear();
      else entries.forEach((e) => sharedSelectedIds.add(e.id));
      refreshSharedSelectionUi(entries);
      return;
    }
    const sharedPick = ev.target.closest('[data-shared-select]');
    if (sharedPick) {
      const id = sharedPick.dataset.sharedSelect;
      if (sharedSelectedIds.has(id)) sharedSelectedIds.delete(id);
      else sharedSelectedIds.add(id);
      refreshSharedSelectionUi();
      return;
    }
    const row = ev.target.closest('.entry-row');
    if (row && row.dataset.id) {
      const e = data.entries.find((x) => x.id === row.dataset.id);
      if (e) openEntryModal(e);
      return;
    }
    /* 정산 화면의 요약 줄도 눌러서 바로 고칠 수 있게 한다.
       (내역 탭까지 찾아가지 않아도 되고, 아래 정산 기록과 동작이 같아진다) */
    const mini = ev.target.closest('[data-entry]');
    if (mini) {
      const e = data.entries.find((x) => x.id === mini.dataset.entry);
      if (e) openEntryModal(e);
      return;
    }
    const cell = ev.target.closest('.cal-cell[data-date]');
    if (cell) { selectedDay = selectedDay === cell.dataset.date ? null : cell.dataset.date; renderView(); return; }
    const methodHistory = ev.target.closest('[data-method-history]');
    if (methodHistory) {
      /* 통계에서 카드를 고른 것이므로, 이전 검색·사람·분류 조건은
         초기화해 해당 카드의 전체 내역이 바로 보이게 한다. */
      filters = { q: '', who: '', category: '', method: methodHistory.dataset.methodHistory };
      view = 'list';
      document.querySelectorAll('.tab').forEach((t) =>
        t.classList.toggle('active', t.dataset.view === 'list'));
      renderView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      /* 방금 누른 통계 행은 사라지므로 키보드·스크린리더 초점을
         새로 그려진 결제수단 필터로 옮겨 화면 전환을 바로 알린다. */
      requestAnimationFrame(() => {
        const methodFilter = $('#fMethod');
        if (methodFilter) methodFilter.focus({ preventScroll: true });
      });
      return;
    }
    if (ev.target.closest('#btnSettleNow')) { doSettle(); return; }
    if (ev.target.closest('#btnSendMoney')) { openSendModal(null); return; }
    const rec = ev.target.closest('[data-send]');
    if (rec) {
      const e = data.entries.find((x) => x.id === rec.dataset.send);
      if (e) openSendModal(e);
    }
  });
  $('#view').addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ')
        && ev.target.matches('circle[data-stat-category]')) {
      ev.preventDefault();
      ev.target.click();
    }
  });
  $('#view').addEventListener('input', (ev) => {
    /* 검색창까지 다시 그리면 iOS 가 포커스와 한글 조합 상태를 잃어
       자모 하나를 입력할 때마다 키보드가 닫힌다. 입력창은 그대로 두고
       그 아래 결과만 바꾼다. */
    if (ev.target.id === 'fQ') { filters.q = ev.target.value; renderListResults(); }
  });
  $('#view').addEventListener('change', (ev) => {
    if (ev.target.id === 'fWho') { filters.who = ev.target.value; renderListResults(); }
    if (ev.target.id === 'fCategory') { filters.category = ev.target.value; renderListResults(); }
    if (ev.target.id === 'fMethod') { filters.method = ev.target.value; renderListResults(); }
  });
}

function askConfirm(opt, cb) {
  $('#confirmEmoji').textContent = opt.emoji || '🤝';
  $('#confirmTitle').textContent = I18n.t(opt.title || '');
  $('#confirmText').innerHTML = I18n.t(opt.text || '');
  $('#btnConfirmOk').textContent = I18n.t(opt.ok || '확인');
  $('#btnConfirmOk').className = 'btn ' + (opt.danger ? 'danger' : 'primary');
  confirmCb = cb;
  $('#confirmModal').classList.remove('hidden');
}

function welcomeStart() {
  const me = $('#wcMe').value.trim();
  if (!me) { $('#wcMe').focus(); return; }
  data.settings.memberName = me;
  data.settings.partnerName = $('#wcPartner').value.trim();
  data.settings.members = [me];
  Store.saveNow(data);          // 이름은 중요하니 지연 없이 바로 저장
  $('#welcomeModal').classList.add('hidden');
  render();
}

function nextCategorySlot(type) {
  const count = {};
  for (let i = 1; i <= 8; i++) count[i] = 0;
  (setDraftCats[type] || []).forEach((c) => { if (c.slot > 0) count[c.slot]++; });
  return Number(Object.keys(count).sort((a, b) => count[a] - count[b] || a - b)[0]);
}

function openCategoryModal(type, index = null) {
  const list = setDraftCats[type] || [];
  const c = Number.isInteger(index) ? list[index] : null;
  editingCategory = { type, index: c ? index : null };
  $('#categoryModalTitle').textContent = c ? '분류 수정' : '분류 추가';
  $('#inCategoryKo').value = c ? (c.nameKo || c.name || '') : '';
  $('#inCategoryEn').value = c ? (c.nameEn || c.name || '') : '';
  $('#inCategoryEmoji').value = c ? (c.emoji || '') : '🏷️';
  $('#categoryStableHint').classList.toggle('hidden', !c);
  $('#categoryModal').classList.remove('hidden');
  (I18n.lang === 'en' ? $('#inCategoryEn') : $('#inCategoryKo')).focus();
}

function saveCategoryEditor() {
  if (!editingCategory) return;
  const { type, index } = editingCategory;
  const list = setDraftCats[type] || [];
  const current = Number.isInteger(index) ? list[index] : null;
  const nameKo = $('#inCategoryKo').value.trim();
  const nameEn = $('#inCategoryEn').value.trim();
  const emoji = $('#inCategoryEmoji').value.trim() || (current && current.emoji) || '🏷️';
  if (!nameKo || !nameEn) {
    toast('한국어 이름과 영어 이름을 모두 넣어주세요');
    (nameKo ? $('#inCategoryEn') : $('#inCategoryKo')).focus();
    return;
  }
  const folded = (s) => s.trim().toLocaleLowerCase();
  const duplicate = list.some((c, i) => i !== index
    && [c.name, c.nameKo, c.nameEn].filter(Boolean).some((n) =>
      folded(n) === folded(nameKo) || folded(n) === folded(nameEn)));
  if (duplicate) { toast('같은 이름의 분류가 이미 있어요'); return; }

  if (current) {
    /* Keep name/slot/share/tip/key untouched so old entries and card rates stay linked. */
    Object.assign(current, { nameKo, nameEn, emoji });
  } else {
    let name = nameKo;
    if (list.some((c) => c.name === name)) name = 'cat_' + uuid().slice(0, 8);
    const c = { name, nameKo, nameEn, emoji, slot: nextCategorySlot(type) };
    if (type === 'expense') c.share = 'half';
    list.push(c);
  }
  editingCategory = null;
  $('#categoryModal').classList.add('hidden');
  renderCatManage();
}
function recurringFormHasInput() {
  return !!($('#recDay').value.trim() || $('#recMemo').value.trim()
    || $('#recAmount').value.trim() || editingRecurringId);
}

/* 추가와 수정은 같은 입력칸을 쓴다.
 * 수정할 때는 기존 규칙의 id·시작월·낸 사람을 유지해야
 * 같은 달의 자동 내역이 두 번 생기거나 정산 주체가 바뀌지 않는다. */
function saveRecurringForm() {
  const rawDay = $('#recDay').value.trim();
  const day = Number(rawDay);
  const memo = $('#recMemo').value.trim();
  const amount = toNum($('#recAmount').value);
  if (!/^\d{1,2}$/.test(rawDay) || day < 1 || day > 31 || !memo || !(amount > 0)) {
    toast('날짜·내용·금액을 모두 올바르게 넣어주세요');
    return false;
  }

  if (editingRecurringId) {
    const r = setDraftRecur.find((x) => x.id === editingRecurringId);
    if (r) Object.assign(r, { day, amount, memo });
  } else {
    setDraftRecur.push({
      id: uuid(), day, amount, memo,
      category: categoryKeyFor('expense', 'fixed'), payer: ME(), split: 'half',
      since: todayStr().slice(0, 7), active: true
    });
  }
  resetRecurringForm();
  renderRecurList();
  return true;
}

function beginRecurringEdit(id) {
  const r = setDraftRecur.find((x) => x.id === id);
  if (!r) return;
  editingRecurringId = id;
  $('#recDay').value = r.day;
  $('#recMemo').value = r.memo || '';
  $('#recAmount').value = formatAmountStr(Number(r.amount) || 0);
  $('#btnRecAdd').textContent = '수정 저장';
  $('#btnRecCancel').classList.remove('hidden');
  renderRecurList();
  $('#recMemo').focus();
}

function resetRecurringForm() {
  editingRecurringId = null;
  $('#recDay').value = '';
  $('#recMemo').value = '';
  $('#recAmount').value = '';
  $('#btnRecAdd').textContent = '추가';
  $('#btnRecCancel').classList.add('hidden');
}

function confirmDeleteRecurring(id) {
  const r = setDraftRecur.find((x) => x.id === id);
  if (!r) return;
  askConfirm({
    emoji: '🗑️',
    title: '이 반복 지출을 삭제할까요?',
    text: I18n.lang === 'en'
      ? `Only the recurring rule for <b>${esc(r.memo)}</b> will be deleted.<br>${I18n.t('이미 생성된 내역은 그대로 남아요.')}`
      : `<b>${esc(r.memo)}</b> 반복 설정만 삭제됩니다.<br>이미 생성된 내역은 그대로 남아요.`,
    ok: '삭제', danger: true
  }, () => {
    setDraftRecur = setDraftRecur.filter((x) => x.id !== id);
    if (editingRecurringId === id) resetRecurringForm();
    renderRecurList();
  });
}

/* ==================== 렌더링 ==================== */
function render() {
  $('#monthLabel').textContent = monthLabel(curMonth);
  renderCoupleBadge();
  renderSummary();
  renderSettleBadge();
  renderView();
}

function renderCoupleBadge() {
  const el = $('#coupleBadge');
  if (!data.settings.memberName) { el.textContent = '이름 설정'; return; }
  el.innerHTML =
    `<span class="who-dot me"></span>${esc(ME())}` +
    `<span class="heart">💛</span>` +
    `<span class="who-dot you"></span>${esc(PARTNER())}`;
}

function renderSettleBadge() {
  const b = balance();
  const el = $('#settleBadge');
  if (Math.abs(b) < 1) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.textContent = fmtCompact(b);
}

function renderSummary() {
  const b = monthBuckets(curMonth);
  /* 남은 돈 = 넣은 돈 − 생활비.
     고정지출은 정액 선입금으로 따로 정산하는 돈이라 여기서 빼면 이중으로 세는 셈이고,
     예산 밖 추가지출은 그때그때 따로 더 넣는 돈이라 역시 빼지 않는다. */
  const net = b.income - b.living;

  const prevB = monthBuckets(shiftMonth(curMonth, -1));
  let delta = '';
  if (prevB.living > 0) {
    const diff = b.living - prevB.living;
    const pct = Math.round(Math.abs(diff / prevB.living) * 100);
    delta = diff === 0
      ? '<div class="delta">지난달과 같아요</div>'
      : `<div class="delta ${diff > 0 ? 'up' : 'down'}">지난달보다 <b>${diff > 0 ? '▲' : '▼'} ${pct}%</b> ${diff > 0 ? '더 썼어요' : '아꼈어요'}</div>`;
  }

  const budget = Number(data.settings.budget) || 0;
  let bar = '';
  if (budget > 0) {
    const pct = Math.min(100, (b.living / budget) * 100);
    const over = b.living > budget;
    const color = over ? 'var(--critical)' : (pct >= 80 ? 'var(--warn)' : 'var(--accent)');
    bar = `
      <div class="budget-bar"><div style="width:${pct}%;background:${color}"></div></div>
      <div class="budget-note">${over
        ? '⚠ 예산 ' + fmtMoney(b.living - budget) + ' 초과'
        : '예산 ' + fmtMoney(budget) + ' 중 ' + fmtMoney(budget - b.living) + ' 남음'}</div>`;
  }

  $('#summary').className = 'summary';
  $('#summary').innerHTML = `
    <div class="sum-card">
      <div class="lbl">고정지출 <small>월세·유틸리티</small></div>
      <div class="val fixed">${fmtMoney(b.fixed)}</div>
    </div>
    <div class="sum-card">
      <div class="lbl">이번 달 생활비 <small>고정지출 빼고</small></div>
      <div class="val expense">${fmtMoney(b.living)}</div>${delta}
      ${bar}
    </div>
    <div class="sum-card">
      <div class="lbl">넣은 돈 <small>생활비 몫만</small></div>
      <div class="val income">${fmtMoney(b.income)}</div>
      ${b.fixedIn > 0 ? `<div class="delta">고정지출 몫 ${fmtMoney(b.fixedIn)} 따로</div>` : ''}
    </div>
    <div class="sum-card">
      <div class="lbl">남은 돈</div>
      <div class="val ${net < 0 ? 'expense' : ''}">${net < 0 ? '−' : ''}${fmtMoney(Math.abs(net))}</div>
      ${b.extra > 0
        ? `<div class="extra-note">예산 밖 ${fmtMoney(b.extra)} 은 따로 더 넣어요</div>` : ''}
    </div>`;
}

function renderView() {
  if (view === 'list') renderList();
  else if (view === 'calendar') renderCalendar();
  else if (view === 'stats') renderStats();
  else renderSettle();
}

/* ---------- 내역 ---------- */
function entryRowHtml(e) {
  const color = catColorOf(e);
  const sign = e.type === 'income' ? '+' : '−';
  const cat = categoryLabel(e.type, e.category);
  const title = e.memo || cat || '(내용 없음)';
  const sub = [fmtTime(e.time), cat, methodLabel(e.method),
    e.tip ? '팁 ' + fmtMoney(e.tip) : null].filter(Boolean).join(' · ');
  return `
    <button class="entry-row" data-id="${e.id}" title="${esc(I18n.t('눌러서 수정'))}"
      aria-label="${esc(I18n.lang === 'en' ? `Edit ${title}` : `${title} 수정`)}">
      <span class="entry-emoji" style="background:${color}22">${esc(catEmojiOf(e))}</span>
      <span class="entry-main">
        <span class="entry-title">
          <span class="t">${esc(title)}</span>
          <span class="who-chip ${whoClass(e.payer)}">${esc(e.payer || '?')}</span>
          ${e.type === 'expense' && e.split === 'half' ? '<span class="pill half">함께</span>' : ''}
          ${e.auto ? '<span class="pill auto">자동</span>' : ''}
          ${isOffBudget(e) ? '<span class="pill off">예산 밖</span>' : ''}
        </span>
        <span class="entry-sub">${esc(sub)}</span>
      </span>
      <span class="entry-amt ${e.type}">${sign}${fmtMoney(e.amount)}</span>
      <span class="row-edit" aria-hidden="true">✎</span>
    </button>`;
}

function applyFilters(list) {
  return list.filter((e) => {
    if (filters.who && e.payer !== filters.who) return false;
    if (filters.category && categoryKey(e.type, e.category) !== filters.category) return false;
    if (filters.method === NO_METHOD_FILTER) {
      if (e.method) return false;
    } else if (filters.method && e.method !== filters.method) return false;
    if (filters.q) {
      const nm = (methodOf(e.method) || {}).name || I18n.t(e.method
        ? '지워진 결제수단' : '결제수단 없음');
      if (!matchesSearch(
        [e.memo, categorySearchText(e.type, e.category), e.payer, nm].join(' '),
        filters.q
      )) return false;
    }
    return true;
  });
}

/* 검색·필터 중에는 이 결과 영역만 바꾼다. 검색창과 select 를 DOM 에
   그대로 남겨 두는 것이 모바일 키보드/IME 조합을 유지하는 핵심이다. */
function listResultsHtml(all, list) {
  if (!list.length) {
    return `
      <div class="empty">
        <div class="big-emoji">${all.length ? '🔍' : '🌱'}</div>
        ${all.length ? '조건에 맞는 내역이 없어요'
          : '아직 내역이 없어요.<br>오른쪽 위 <b>＋ 입력</b>으로 시작해보세요!'}
      </div>`;
  }

  const byDay = {};
  list.forEach((e) => { (byDay[e.date] = byDay[e.date] || []).push(e); });

  return Object.keys(byDay).sort().reverse().map((d) => {
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
}

function renderListResults() {
  const results = $('#listResults');
  /* 내역 화면이 아닌 순간에 동기화 등으로 호출되어도 안전하게 끝낸다. */
  if (!results) return;
  const all = monthLedger(curMonth);
  results.innerHTML = listResultsHtml(all, applyFilters(all));
}

function renderList() {
  const all = monthLedger(curMonth);
  const catsByKey = new Map();
  [...data.settings.categories.expense, ...data.settings.categories.income]
    .forEach((c) => { if (!catsByKey.has(c.name)) catsByKey.set(c.name, c); });
  const cats = [...catsByKey.values()];
  /* 현재 달에 내역이 없어도 다른 달의 삭제된 카드를 계속 고를 수 있게
     전체 원장에 남은 id 를 필터 목록에 보여준다. */
  const missingIds = missingMethodIds();
  const validMethod = !filters.method || filters.method === NO_METHOD_FILTER
    || !!methodOf(filters.method) || missingIds.includes(filters.method);
  if (!validMethod) filters.method = '';
  const list = applyFilters(all);
  const methodOptions = methods().map((m) => `
    <option value="${esc(m.id)}" ${filters.method === m.id ? 'selected' : ''}>
      ${m.emoji || '💳'} ${esc(m.name)}
    </option>`).join('') + missingIds.map((id) => `
    <option value="${esc(id)}" ${filters.method === id ? 'selected' : ''}>
      ⚠️ ${esc(missingMethodName(id))}
    </option>`).join('');

  const toolbar = `
    <div class="list-toolbar">
      <input type="search" id="fQ" aria-label="${esc(I18n.t('내역 검색'))}"
        placeholder="내용·분류·이름·카드·초성 검색" value="${esc(filters.q)}"
        autocomplete="off" enterkeyhint="search">
      <select id="fWho">
        <option value="">둘 다</option>
        <option value="${esc(ME())}" ${filters.who === ME() ? 'selected' : ''}>${esc(ME())}</option>
        <option value="${esc(PARTNER())}" ${filters.who === PARTNER() ? 'selected' : ''}>${esc(PARTNER())}</option>
      </select>
      <select id="fCategory">
        <option value="">모든 분류</option>
        ${cats.map((c) => `<option value="${esc(c.name)}" ${filters.category === c.name ? 'selected' : ''}>${esc(catLabel(c))}</option>`).join('')}
      </select>
      <select id="fMethod" aria-label="${esc(I18n.t('카드·결제수단별 필터'))}">
        <option value="">모든 카드·결제수단</option>
        ${methodOptions}
        <option value="${NO_METHOD_FILTER}" ${filters.method === NO_METHOD_FILTER ? 'selected' : ''}>결제수단 없음</option>
      </select>
      <span class="list-edit-hint">✎ 개인·함께 내역을 누르면 수정할 수 있어요</span>
    </div>`;

  $('#view').innerHTML = toolbar
    + `<div id="listResults">${listResultsHtml(all, list)}</div>`;
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
function syncStatsSelection(expenses) {
  if (statsSelectionMonth !== curMonth) {
    statsSelectionMonth = curMonth;
    statsSelectedCategories.clear();
  }
  const available = new Set(expenses.map((e) =>
    categoryKey('expense', e.category || '기타')));
  [...statsSelectedCategories].forEach((name) => {
    if (!available.has(name)) statsSelectedCategories.delete(name);
  });
}

function renderStats() {
  const expenses = monthLedger(curMonth).filter((e) => e.type === 'expense');
  syncStatsSelection(expenses);
  if (!expenses.length) {
    $('#view').innerHTML = `<div class="empty"><div class="big-emoji">📊</div>이번 달 지출이 없어서 보여줄 통계가 없어요</div>`;
    return;
  }
  $('#view').innerHTML = `
    <div class="stats-grid">
      <div class="card"><h3>분류별 지출 <small>${monthLabel(curMonth)}</small></h3>
        <div class="donut-wrap">${donutHtml(expenses)}</div></div>
      <div class="card"><h3>둘이 쓴 돈 비교 <small>정산 반영 · ${monthLabel(curMonth)}</small></h3>
        ${whoBarsHtml(expenses)}</div>
      ${methodCardHtml(expenses)}
      <div class="card full"><h3>일별 지출 <small>${monthLabel(curMonth)}</small></h3>
        ${dailyBarsHtml(expenses)}</div>
    </div>`;
  bindChartHover();
}

function donutHtml(expenses) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = {};
  expenses.forEach((e) => {
    const k = categoryKey('expense', e.category || '기타');
    byCat[k] = (byCat[k] || 0) + e.amount;
  });
  const items = Object.entries(byCat).map(([name, amt]) => {
    const c = catOf('expense', name);
    return { name, label: categoryLabel('expense', name), amt,
      slot: c ? c.slot : 0, emoji: c ? c.emoji : '📦' };
  }).sort((a, b) => b.amt - a.amt);

  const hasSelection = statsSelectedCategories.size > 0;
  const selectedTotal = items
    .filter((it) => statsSelectedCategories.has(it.name))
    .reduce((sum, it) => sum + it.amt, 0);

  const R = 58, C = 2 * Math.PI * R, GAP = 2;
  let off = 0;
  const segs = items.map((it) => {
    const frac = it.amt / total;
    const len = Math.max(0, frac * C - GAP);
    const selected = statsSelectedCategories.has(it.name);
    const stateClass = selected ? ' selected' : (hasSelection ? ' muted' : '');
    const s = `<circle class="donut-segment${stateClass}" r="${R}" cx="80" cy="80" fill="none" stroke="${slotColor(it.slot)}" stroke-width="${selected ? 30 : 26}"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"
      data-stat-category="${esc(it.name)}" tabindex="0" role="button"
      aria-pressed="${selected}" aria-label="${esc(it.label)} ${fmtMoney(it.amt)}"
      data-tip="${esc(it.label)}|${fmtMoney(it.amt)} (${Math.round(frac * 100)}%)"></circle>`;
    off += frac * C;
    return s;
  }).join('');

  const rank = items.map((it) => {
    const selected = statsSelectedCategories.has(it.name);
    const stateClass = selected ? ' selected' : (hasSelection ? ' muted' : '');
    return `
    <button type="button" class="rank-item${stateClass}" data-stat-category="${esc(it.name)}"
            aria-pressed="${selected}">
      <span class="dot" style="background:${slotColor(it.slot)}"></span>
      <span class="nm">${esc(it.emoji)} ${esc(it.label)}</span>
      <span class="pct">${Math.round((it.amt / total) * 100)}%</span>
      <span class="amt">${fmtMoney(it.amt)}</span>
    </button>`;
  }).join('');

  const selectionNote = hasSelection
    ? `<div class="stats-selection-summary">
         <span><b>${I18n.lang === 'en'
           ? `${statsSelectedCategories.size} ${statsSelectedCategories.size === 1 ? 'category' : 'categories'} selected`
           : `${statsSelectedCategories.size}개 분류 선택`}</b> · ${I18n.lang === 'en' ? 'Total' : '합계'} <strong>${fmtMoney(selectedTotal)}</strong></span>
         <button type="button" data-stat-clear>${I18n.lang === 'en' ? 'Clear selection' : '선택 해제'}</button>
       </div>`
    : `<p class="stats-selection-hint">${I18n.lang === 'en'
      ? 'Select multiple categories to see their combined total'
      : '분류를 여러 개 눌러 합계를 볼 수 있어요'}</p>`;

  const tipTotal = expenses.reduce((s, e) => s + (e.tip || 0), 0);
  const tipNote = tipTotal > 0
    ? `<p class="hint tiny" style="margin-top:14px">💵 이 중 팁이 <b>${fmtMoney(tipTotal)}</b> 예요 (전체 지출의 ${((tipTotal / total) * 100).toFixed(1)}%)</p>`
    : '';

  return `
    <svg viewBox="0 0 160 160" width="160" height="160" style="flex:none">
      ${segs}
      <text x="80" y="74" text-anchor="middle" class="donut-center-lbl">${hasSelection
        ? (I18n.lang === 'en' ? 'Selected total' : '선택 합계')
        : (I18n.lang === 'en' ? 'This month' : '이번 달')}</text>
      <text x="80" y="94" text-anchor="middle" class="donut-center-val">${fmtMoney(hasSelection ? selectedTotal : total)}</text>
    </svg>
    <div class="rank-list">${selectionNote}${rank}${tipNote}</div>`;
}

/* 누가 카드로 먼저 냈는지가 아니라, 정산까지 끝났을 때 '실제로 각자 부담한 돈'을 보여준다.
   같이 쓴 돈은 분담 비율대로 둘에게 나눠 붙이고, 혼자 쓴 돈은 낸 사람에게 전부 붙인다. */
function whoBarsHtml(expenses) {
  const names = [ME(), PARTNER()];
  const myRatio = mySplitRatioPct() / 100;
  const b = burdenOf(expenses);
  const burden = [b.mine, b.yours];
  const paid = [b.myPaid, b.yoursPaid];
  const other = b.other;

  const max = Math.max(burden[0], burden[1], other, 1);
  let html = names.map((n, i) => `
    <div class="who-row">
      <span class="nm" style="color:${i === 0 ? 'var(--me)' : 'var(--you)'}">${esc(n)}</span>
      <span class="track"><span class="fill" style="display:block;width:${Math.max(2, (burden[i] / max) * 100)}%;background:${i === 0 ? 'var(--me)' : 'var(--you)'}"></span></span>
      <span class="amt">${fmtMoney(roundMoney(burden[i]))}</span>
    </div>`).join('');
  if (other > 0) {
    html += `<div class="who-row"><span class="nm">기타</span>
      <span class="track"><span class="fill" style="display:block;width:${(other / max) * 100}%;background:var(--muted)"></span></span>
      <span class="amt">${fmtMoney(other)}</span></div>`;
  }

  const shared = expenses.filter((e) => e.split === 'half').reduce((s, e) => s + e.amount, 0);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const minePct = Math.round(myRatio * 100);
  const yoursPct = Math.round((1 - myRatio) * 100);
  const rule = I18n.lang === 'en'
    ? (usingFixedShare()
      ? `Of <b>${fmtMoney(shared)}</b> in shared spending, ${esc(fixedShareOwnerName())}'s fixed-cost share is <b>${fmtMoney(fixedShareAmount())}</b>; the rest is split ${minePct}:${yoursPct}.`
      : `<b>${fmtMoney(shared)}</b> in shared spending is split ${minePct}:${yoursPct} (${Math.round((shared / total) * 100)}% of all spending).`)
    : (usingFixedShare()
      ? `같이 쓴 돈 <b>${fmtMoney(shared)}</b> 중 고정지출은 ${esc(fixedShareOwnerName())} 정액 <b>${fmtMoney(fixedShareAmount())}</b>,
         나머지는 ${minePct} : ${yoursPct} 로 나눠 계산했어요.`
      : `같이 쓴 돈 <b>${fmtMoney(shared)}</b> 는 ${minePct} : ${yoursPct} 로 나눠서 계산한 금액이에요
         (전체 지출의 ${Math.round((shared / total) * 100)}%).`);
  const paidLine = I18n.lang === 'en'
    ? `Amount paid up front: ${esc(names[0])} <b>${fmtMoney(paid[0])}</b> · ${esc(names[1])} <b>${fmtMoney(paid[1])}</b>.`
    : `카드로 먼저 낸 금액은 ${esc(names[0])} <b>${fmtMoney(paid[0])}</b> · ${esc(names[1])} <b>${fmtMoney(paid[1])}</b> 였어요.`;
  html += `<p class="hint tiny" style="margin-top:14px">${rule}<br>${paidLine}</p>`;
  return html;
}

/* 결제수단별 이번 달 지출. 행을 누르면 그 결제수단으로 걸러진
   내역 탭으로 이동한다. 삭제된 결제수단도 id 별로 따로 보여준다. */
function methodCardHtml(expenses) {
  const totals = {};
  expenses.forEach((e) => {
    const id = e.method || NO_METHOD_FILTER;
    totals[id] = (totals[id] || 0) + e.amount;
  });
  const rows = methods().map((m) => ({
    id: m.id, label: `${m.emoji || '💳'} ${m.name}`,
    m, amt: totals[m.id] || 0
  }))
    .filter((r) => r.amt > 0)
    .sort((a, b) => b.amt - a.amt);
  const deletedRows = missingMethodIds(expenses).map((id) => ({
    id, label: `⚠️ ${missingMethodName(id)}`, m: null, amt: totals[id] || 0
  })).filter((r) => r.amt > 0);
  rows.push(...deletedRows);
  const noMethod = totals[NO_METHOD_FILTER] || 0;
  if (!rows.length && !noMethod) return '';

  const max = Math.max(...rows.map((r) => r.amt), noMethod, 1);
  const bar = (id, label, sub, amt, color) => `
    <button class="who-row method-row method-history-link" data-method-history="${esc(id)}"
            title="${esc(I18n.t('누르면 내역 보기'))}" aria-label="${esc(label)} ${fmtMoney(amt)} ${I18n.t('내역 보기')}">
      <span class="nm">${esc(label)}</span>
      <span class="track"><span class="fill" style="display:block;width:${Math.max(2, (amt / max) * 100)}%;background:${color}"></span></span>
      <span class="amt">${fmtMoney(amt)}</span>
      <span class="method-history-arrow" aria-hidden="true">›</span>
    </button>${sub ? `<p class="hint tiny method-history-sub">${sub}</p>` : ''}`;

  let html = rows.map((r, i) => bar(r.id, r.label,
    r.m ? [
      r.m.type === 'credit' && r.m.billingDay ? `매달 ${r.m.billingDay}일 결제 예정` : '',
      methodBalanceStart(r.m)
        ? `${methodBalanceName(r.m)} ${fmtMoney(methodBalance(r.m))} · ${methodBalanceStart(r.m).date} 시작 기준`
        : ''
    ].filter(Boolean).join(' · ') : '',
    r.amt, r.m ? slotColor((i % 8) + 1) : 'var(--muted)'
  )).join('');
  if (noMethod > 0) html += bar(NO_METHOD_FILTER, I18n.t('결제수단 없음'), '', noMethod, 'var(--muted)');

  return `<div class="card full"><h3>결제수단별 지출 <small>${monthLabel(curMonth)} · ${I18n.t('결제수단을 누르면 내역')}</small></h3>${html}</div>`;
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
    const tipDate = I18n.lang === 'en'
      ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
      : `${mo}월 ${d}일 (${DOW[dt.getDay()]})`;
    hits += `<rect x="${(x - slotW / 2).toFixed(1)}" y="${mT}" width="${slotW.toFixed(1)}" height="${plotH}" fill="transparent"
      data-tip="${esc(tipDate)}|${v > 0 ? '−' + fmtMoney(v) : I18n.t('지출 없음')}"></rect>`;
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

/* ---------- 정산 ---------- */
function sharedEntriesForMonth() {
  return monthLedger(curMonth)
    .filter((e) => e.type === 'expense' && e.split === 'half'
      && !(usingFixedShare() && isFixedCat(e.category)) && !isOffBudget(e))
    .sort((a, b) => b.date.localeCompare(a.date) || byTimeDesc(a, b));
}

function syncSharedSelection(entries) {
  if (sharedSelectionMonth !== curMonth) {
    sharedSelectionMonth = curMonth;
    sharedSelectedIds.clear();
  }
  const available = new Set(entries.map((e) => e.id));
  [...sharedSelectedIds].forEach((id) => {
    if (!available.has(id)) sharedSelectedIds.delete(id);
  });
}

/* 체크할 때 정산 화면 전체를 다시 그리지 않아야, 긴 목록을
   스크롤해도 그 위치에서 계속 선택할 수 있다. */
function refreshSharedSelectionUi(entries = sharedEntriesForMonth()) {
  syncSharedSelection(entries);
  const selected = entries.filter((e) => sharedSelectedIds.has(e.id));
  const total = selected.reduce((sum, e) => sum + e.amount, 0);
  const totalEl = $('#sharedSelectedTotal');
  const countEl = $('#sharedSelectedCount');
  if (totalEl) totalEl.textContent = fmtMoney(total);
  if (countEl) countEl.textContent = I18n.lang === 'en'
    ? `${selected.length} selected` : `${selected.length}건 선택`;

  document.querySelectorAll('[data-shared-row]').forEach((row) => {
    row.classList.toggle('selected', sharedSelectedIds.has(row.dataset.sharedRow));
  });
  document.querySelectorAll('[data-shared-select]').forEach((button) => {
    const on = sharedSelectedIds.has(button.dataset.sharedSelect);
    button.classList.toggle('selected', on);
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? '✓' : '';
  });

  const allButton = $('[data-shared-select-all]');
  if (allButton) {
    const all = entries.length > 0 && selected.length === entries.length;
    allButton.textContent = I18n.lang === 'en'
      ? (all ? 'Clear all' : 'Select all') : (all ? '전체 해제' : '전체 선택');
    allButton.setAttribute('aria-pressed', String(all));
  }
}

function renderSettle() {
  const b = balance();
  const myPct = mySplitRatioPct();
  const me = ME(), you = PARTNER();
  const av = (name, cls) =>
    `<div class="settle-person">
       <div class="settle-av" style="background:${cls === 'me' ? 'var(--me)' : 'var(--you)'}">${esc(name.slice(0, 1))}</div>
       <span class="nm">${esc(name)}</span>
     </div>`;

  let hero;
  if (Math.abs(b) < 1) {
    hero = `<div class="settle-hero">
      <div class="settle-clean">✨ 정산할 게 없어요, 깔끔합니다!</div>
      <div class="settle-sub" style="margin-top:8px">함께 쓴 돈이 딱 맞게 나눠져 있어요</div>
      <div class="settle-btns"><button class="btn" id="btnSendMoney">돈 보낸 기록</button></div>
    </div>`;
  } else {
    const from = b > 0 ? you : me;
    const to = b > 0 ? me : you;
    const fromCls = b > 0 ? 'you' : 'me';
    const toCls = b > 0 ? 'me' : 'you';
    hero = `<div class="settle-hero">
      <div class="lead">지금 정산하면</div>
      <div class="settle-flow">
        ${av(from, fromCls)}
        <span class="settle-arrow">→</span>
        ${av(to, toCls)}
      </div>
      <div class="settle-amount">${fmtMoney(Math.abs(b))}</div>
      <div class="settle-sub">${esc(from)}님이 ${esc(to)}님에게 보내면 정산 끝!</div>
      <div class="settle-btns">
        <button class="btn primary" id="btnSettleNow">정산 완료로 기록</button>
        <button class="btn" id="btnSendMoney">돈 보낸 기록</button>
      </div>
    </div>`;
  }

  /* 이번 달 고정비 — 정액 부담을 쓸 때만 */
  let fixedCard = '';
  if (usingFixedShare()) {
    const monthFixed = monthLedger(curMonth)
      .filter((e) => e.type === 'expense' && e.split === 'half' && isFixedCat(e.category))
      .sort((a, b2) => b2.date.localeCompare(a.date));
    const total = monthFixed.reduce((s, e) => s + e.amount, 0);
    const myPart = myFixedBurden(total);
    const yourPart = total - myPart;
    /* 이번 달 몫으로 내가 보낸 돈.
       미리 보내는 경우가 많아서 보낸 날짜가 아니라 '몇 월 몫'으로 센다.
       (예: 7월 말에 보낸 8월 렌트 몫은 8월에 잡혀야 한다) */
    const sentByMe = liveEntries()
      .filter((e) => e.type === 'settle' && isMe(e.payer) && settleMonth(e) === curMonth)
      .reduce((s, e) => s + e.amount, 0);
    const left = roundMoney(sentByMe - myPart);
    const myFlat = fixedShareBelongsToMe();
    const pct = myFlat && fixedShareAmount() > 0
      ? Math.min(100, (myPart / fixedShareAmount()) * 100)
      : (total > 0 ? 100 : 0);

    let statusLine;
    if (Math.abs(left) < 0.005) {
      statusLine = total > 0
        ? `<span style="color:var(--income);font-weight:700">✨ 이번 달 고정비 정리 완료</span>`
        : '아직 이번 달 고정비가 입력되지 않았어요';
    } else if (left > 0) {
      statusLine = `보낸 돈에서 <b>${fmtMoney(left)}</b> 남았어요 (아직 안 나온 청구서가 있으면 여기서 빠져나갑니다)`;
    } else {
      statusLine = `<b>${fmtMoney(-left)}</b> 더 보내면 이번 달 고정비가 맞아요`;
    }

    fixedCard = `
      <div class="card">
        <h3>이번 달 고정비 <small>${monthLabel(curMonth)}</small></h3>
        <div class="goal-bar"><div style="width:${pct}%"></div></div>
        <div class="goal-nums">
          <span>${myFlat
            ? `내 정액 부담 <b>${fmtMoney(fixedShareAmount())}</b> 중 <b>${fmtMoney(myPart)}</b> 청구됨`
            : `내 부담 <b>${fmtMoney(myPart)}</b> · ${esc(fixedShareOwnerName())} 정액 <b>${fmtMoney(fixedShareAmount())}</b>`}</span>
          <span>보낸 돈 <b>${fmtMoney(sentByMe)}</b></span>
        </div>
        <p class="hint tiny" style="margin-top:10px">${statusLine}</p>
        ${monthFixed.length ? monthFixed.map((e) => `
          <div class="mini-row tappable" data-entry="${e.id}" title="${esc(I18n.t('눌러서 수정'))}">
            <span class="dt">${Number(e.date.slice(5, 7))}/${Number(e.date.slice(8, 10))}</span>
            <span class="who-chip ${whoClass(e.payer)}">${esc(e.payer)}</span>
            <span class="nm">${esc(e.memo || categoryLabel(e.type, e.category))}</span>
            <span class="amt">${fmtMoney(e.amount)}</span>
            <span class="row-edit" aria-hidden="true">✎</span>
          </div>`).join('') : ''}
        <div class="split-note">
          🧮 고정비 총 ${fmtMoney(total)} → ${esc(me)} ${fmtMoney(myPart)} · ${esc(you)} ${fmtMoney(yourPart)}
        </div>
      </div>`;
  }

  /* 예산 밖 추가지출 — 이번 달 둘이 얼마씩 더 넣어야 하는지 */
  const extras = monthLedger(curMonth)
    .filter((e) => e.type === 'expense' && e.split === 'half'
      && isOffBudget(e) && !isFixedCat(e.category))
    .sort((a, b2) => b2.date.localeCompare(a.date));
  let extraCard = '';
  if (extras.length) {
    const total = extras.reduce((s, e) => s + e.amount, 0);
    const myAdd = roundMoney(total * myPct / 100);
    const yourAdd = roundMoney(total - myAdd);
    const budget = Number(data.settings.budget) || 0;
    const myBase = budget > 0 ? roundMoney(budget * myPct / 100) : 0;
    const yourBase = budget > 0 ? roundMoney(budget - myBase) : 0;

    extraCard = `
      <div class="card">
        <h3>이번 달 예산 밖 지출 <small>${fmtMoney(total)}</small></h3>
        <p class="hint">매달 넣는 생활비에서 쓴 게 아니라, 이만큼 <b>더 넣어야 하는</b> 돈이에요.</p>
        ${extras.map((e) => `
          <div class="mini-row tappable" data-entry="${e.id}" title="${esc(I18n.t('눌러서 수정'))}">
            <span class="dt">${Number(e.date.slice(5, 7))}/${Number(e.date.slice(8, 10))}</span>
            <span class="who-chip ${whoClass(e.payer)}">${esc(e.payer)}</span>
            <span class="nm">${esc(e.memo || categoryLabel(e.type, e.category))}</span>
            <span class="amt">${fmtMoney(e.amount)}</span>
            <span class="row-edit" aria-hidden="true">✎</span>
          </div>`).join('')}
        <div class="add-grid">
          ${[[me, myBase, myAdd], [you, yourBase, yourAdd]].map(([n, base, add]) => `
            <div class="add-cell">
              <div class="who">${esc(n)}</div>
              <div class="tot">${fmtMoney(base + add)}</div>
              ${budget > 0
                ? `<div class="brk">${fmtMoney(base)} + <b>${fmtMoney(add)}</b></div>`
                : `<div class="brk">추가로 <b>${fmtMoney(add)}</b></div>`}
            </div>`).join('')}
        </div>
        ${budget > 0 ? '' :
          '<p class="hint tiny">설정에서 <b>한 달 예산</b>을 넣으면 “인당 총 얼마”까지 계산해드려요.</p>'}
      </div>`;
  }

  /* 이번 달 함께 쓴 돈 — 정액 부담을 쓰면 고정지출은 위 카드가 따로 맡는다.
     예산 밖 지출도 자기 카드가 따로 있어서 여기서는 뺀다. */
  const sharedThisMonth = sharedEntriesForMonth();
  syncSharedSelection(sharedThisMonth);
  const sharedTotal = sharedThisMonth.reduce((s, e) => s + e.amount, 0);
  const mySharedPaid = sharedThisMonth
    .filter((e) => isMe(e.payer)).reduce((s, e) => s + e.amount, 0);
  const yourSharedPaid = sharedThisMonth
    .filter((e) => e.payer === you).reduce((s, e) => s + e.amount, 0);
  const selectedShared = sharedThisMonth.filter((e) => sharedSelectedIds.has(e.id));
  const selectedSharedTotal = selectedShared.reduce((s, e) => s + e.amount, 0);
  const allSharedSelected = sharedThisMonth.length > 0
    && selectedShared.length === sharedThisMonth.length;
  const usageWord = I18n.lang === 'en' ? 'spent' : '사용금액';
  const selectedCountLabel = I18n.lang === 'en'
    ? `${selectedShared.length} selected` : `${selectedShared.length}건 선택`;
  const selectAllLabel = I18n.lang === 'en'
    ? (allSharedSelected ? 'Clear all' : 'Select all')
    : (allSharedSelected ? '전체 해제' : '전체 선택');
  const sharedCard = `
    <div class="card">
      <h3>이번 달 함께 쓴 돈${usingFixedShare() ? ' <small class="dim">(고정비 빼고)</small>' : ''}
        <small>${fmtMoney(sharedTotal)}</small></h3>
      <div class="shared-spend-grid">
        <div><span>${esc(me)} ${usageWord}</span><b>${fmtMoney(mySharedPaid)}</b></div>
        <div><span>${esc(you)} ${usageWord}</span><b>${fmtMoney(yourSharedPaid)}</b></div>
      </div>
      <p class="hint tiny shared-spend-note">${I18n.lang === 'en'
        ? 'Based on who paid.' : '누가 결제했는지 기준이에요.'}</p>
      ${sharedThisMonth.length ? `
        <div class="shared-select-head">
          <div>
            <span>${I18n.lang === 'en' ? 'Selected total' : '선택 합계'}</span>
            <b id="sharedSelectedTotal">${fmtMoney(selectedSharedTotal)}</b>
            <small id="sharedSelectedCount">${selectedCountLabel}</small>
          </div>
          <button type="button" data-shared-select-all aria-pressed="${allSharedSelected}">
            ${selectAllLabel}
          </button>
        </div>
        <div class="shared-entry-scroll" role="list" aria-label="${I18n.lang === 'en'
          ? 'All shared spending this month' : '이번 달 함께 쓴 돈 전체 내역'}">
        ${sharedThisMonth.map((e) => {
          const selected = sharedSelectedIds.has(e.id);
          return `
          <div class="mini-row tappable shared-row${selected ? ' selected' : ''}"
               data-entry="${e.id}" data-shared-row="${e.id}" role="listitem"
               title="${esc(I18n.t('체크하면 선택 합계, 나머지 영역을 누르면 수정'))}">
            <button type="button" class="shared-pick${selected ? ' selected' : ''}"
                    data-shared-select="${e.id}" aria-pressed="${selected}"
                    aria-label="${esc(e.memo || categoryLabel(e.type, e.category))} ${I18n.lang === 'en'
                      ? 'include in selected total' : '합계 선택'}">${selected ? '✓' : ''}</button>
            <span class="dt">${Number(e.date.slice(5, 7))}/${Number(e.date.slice(8, 10))}</span>
            <span class="who-chip ${whoClass(e.payer)}">${esc(e.payer)}</span>
            <span class="nm">${esc(e.memo || categoryLabel(e.type, e.category))}</span>
            <span class="amt">${fmtMoney(e.amount)}</span>
            <span class="row-edit" aria-hidden="true">✎</span>
          </div>`;
        }).join('')}
        </div>`
        : '<p class="hint">아직 함께 쓴 돈이 없어요</p>'}
      <div class="split-note">
        🧮 함께 쓴 돈은 ${esc(me)} ${myPct}% · ${esc(you)} ${100 - myPct}% 로 나눠요
      </div>
    </div>`;

  /* 저축 목표 */
  const goal = data.settings.goal || {};
  let goalCard = '';
  if (goal.target > 0) {
    const saved = liveEntries()
      .filter((e) => e.type === 'expense' && isSavingsCat(e.category))
      .reduce((s, e) => s + e.amount, 0);
    const pct = Math.min(100, (saved / goal.target) * 100);
    const done = saved >= goal.target;
    goalCard = `
      <div class="card goal-card">
        <div class="goal-head">
          <span class="goal-name">🐷 ${esc(goal.name || '함께 모으기')}</span>
          <span class="goal-pct">${Math.round(pct)}%</span>
        </div>
        <div class="goal-bar"><div style="width:${pct}%"></div></div>
        <div class="goal-nums">
          <span>모은 돈 <b>${fmtMoney(saved)}</b></span>
          <span>${done ? '🎉 목표 달성!' : '목표까지 <b>' + fmtMoney(goal.target - saved) + '</b>'}</span>
        </div>
      </div>`;
  }

  /* 정산 기록 */
  const recs = settleEntries();
  const recCard = recs.length ? `
    <div class="card">
      <h3>정산 기록</h3>
      ${recs.slice(0, 10).map((e) => {
        // 보낸 날짜와 몫이 다르면(=미리 보낸 돈) 어느 달 몫인지 같이 보여준다
        const fm = settleMonth(e);
        const pre = usingFixedShare() && fm !== e.date.slice(0, 7);
        return `
        <div class="mini-row tappable" data-send="${e.id}" title="${esc(I18n.t('눌러서 수정'))}">
          <span class="dt">${Number(e.date.slice(5, 7))}/${Number(e.date.slice(8, 10))}</span>
          <span class="who-chip ${whoClass(e.payer)}">${esc(e.payer)}</span>
          <span class="nm">${esc(e.memo || (e.payer + ' → ' + (isMe(e.payer) ? PARTNER() : ME())))}
            ${pre ? `<span class="for-chip">${Number(fm.slice(5, 7))}월 몫</span>` : ''}</span>
          <span class="amt">${fmtMoney(e.amount)}</span>
          <span class="row-edit" aria-hidden="true">✎</span>
        </div>`;
      }).join('')}
    </div>` : '';

  $('#view').innerHTML = hero + fixedCard + extraCard + goalCard + sharedCard + recCard;
}

/* ---------- 돈 보낸 기록 (선입금 · 부분 정산) ---------- */
let editingSendId = null;

function openSendModal(entry) {
  editingSendId = entry ? entry.id : null;
  captureEditReturnPosition('sendModal', editingSendId);
  $('#sendUnit').textContent = isUSD() ? '$' : '원';
  $('#inSendAmount').value = entry ? formatAmountStr(entry.amount) : '';
  $('#inSendDate').value = entry ? entry.date : todayStr();
  $('#inSendMemo').value = entry ? (entry.memo || '') : '';
  sendFrom = entry ? entry.payer : ME();
  /* 미리 보내는 돈이 많아서, 보낸 날짜의 달과 '몇 월 몫'이 다를 수 있다.
     예: 7월 말에 8월 렌트 몫을 미리 보내는 경우 */
  sendFor = (entry && entry.forMonth) || (entry ? entry.date.slice(0, 7) : todayStr().slice(0, 7));
  $('#btnSendDelete').classList.toggle('hidden', !editingSendId);
  renderSendModal();
  $('#sendModal').classList.remove('hidden');
  $('#inSendAmount').focus();
}

let sendFrom = null;
let sendFor = null;

function renderSendModal() {
  const me = ME(), you = PARTNER();
  $('#sendFromSeg').innerHTML = [me, you].map((n) =>
    `<button data-from="${esc(n)}" class="${sendFrom === n ? 'active' : ''}">${esc(n)}</button>`).join('');

  /* 보낸 날짜 기준으로 지난달·이번달·다음달 중에서 고른다 */
  const base = $('#inSendDate').value || todayStr();
  const opts = [-1, 0, 1].map((d) => shiftMonth(base.slice(0, 7), d));
  if (opts.indexOf(sendFor) < 0) sendFor = base.slice(0, 7);
  $('#sendForField').classList.toggle('hidden', !usingFixedShare());
  $('#sendForSeg').innerHTML = opts.map((m) =>
    `<button data-for="${m}" class="${sendFor === m ? 'active' : ''}">${monthLabel(m)}</button>`).join('');

  const to = sendFrom === me ? you : me;
  const amt = toNum($('#inSendAmount').value);
  $('#sendHint').textContent = amt > 0
    ? (I18n.lang === 'en'
      ? `Record ${fmtMoney(amt)} from ${sendFrom} to ${to}.`
      : `${sendFrom} → ${to} ${fmtMoney(amt)} 로 기록됩니다`)
    : (I18n.lang === 'en'
      ? `This will be recorded as money sent from ${sendFrom} to ${to}.`
      : `${sendFrom} 가 ${to} 에게 보낸 돈으로 기록됩니다`);
}

function saveSendEntry() {
  const amount = toNum($('#inSendAmount').value);
  if (!(amount > 0)) { $('#inSendAmount').focus(); toast('금액을 넣어주세요'); return; }
  const me = ME(), you = PARTNER();
  const to = sendFrom === me ? you : me;
  const f = {
    date: $('#inSendDate').value || todayStr(),
    amount,
    payer: sendFrom,
    forMonth: sendFor || ($('#inSendDate').value || todayStr()).slice(0, 7),
    memo: $('#inSendMemo').value.trim() || `${sendFrom} → ${to}`
  };
  if (editingSendId) {
    const e = data.entries.find((x) => x.id === editingSendId);
    if (e) { Object.assign(e, f); touch(e); }
  } else {
    const e = {
      id: uuid(), type: 'settle', category: '정산',
      member: ME(), split: 'personal', deleted: false, ...f
    };
    touch(e);
    data.entries.push(e);
  }
  $('#sendModal').classList.add('hidden');
  afterChange();
  restoreEditReturnPosition('sendModal', true);
  toast('기록했어요');
}

function deleteSendEntry() {
  const e = data.entries.find((x) => x.id === editingSendId);
  if (!e) return;
  askConfirm({ emoji: '🗑️', title: '이 기록을 삭제할까요?', text: '정산 잔액이 다시 계산됩니다.', ok: '삭제', danger: true }, () => {
    e.deleted = true;
    touch(e);
    $('#sendModal').classList.add('hidden');
    afterChange();
    restoreEditReturnPosition('sendModal', true);
  });
}

function doSettle() {
  const b = balance();
  if (Math.abs(b) < 1) return;
  const from = b > 0 ? PARTNER() : ME();
  const to = b > 0 ? ME() : PARTNER();
  askConfirm({
    emoji: '🤝',
    title: '정산 완료로 기록할까요?',
    text: I18n.lang === 'en'
      ? `Record a <b>${fmtMoney(Math.abs(b))}</b> payment from <b>${esc(from)}</b> to <b>${esc(to)}</b><br>and reset the settlement balance to zero.`
      : `<b>${esc(from)}</b>님이 <b>${esc(to)}</b>님에게 <b>${fmtMoney(Math.abs(b))}</b> 보낸 것으로 기록하고<br>잔액을 0으로 만듭니다.`,
    ok: I18n.t('정산 완료')
  }, () => {
    const e = {
      id: uuid(), date: todayStr(), type: 'settle',
      amount: Math.abs(b), category: '정산', memo: `${from} → ${to}`,
      member: ME(), payer: from, split: 'personal', deleted: false
    };
    touch(e);
    data.entries.push(e);
    afterChange();
    toast('정산이 기록됐어요 ✨');
  });
}

/* ==================== 동기화 상태 ==================== */
function renderSyncStatus(st) {
  const el = $('#syncStatus');
  el.className = 'sync-status ' + st.state;
  const dot = '<span class="dot"></span>';
  if (st.state === 'off') {
    el.innerHTML = dot + I18n.t('공유 꺼짐');
    el.title = I18n.t('눌러서 커플 공유 설정하기');
  }
  else if (st.state === 'syncing') { el.innerHTML = dot + I18n.t('동기화 중…'); }
  else if (st.state === 'ok') {
    const t = st.lastSyncAt;
    el.innerHTML = dot + pad2(t.getHours()) + ':' + pad2(t.getMinutes()) + ' ' + I18n.t('동기화됨');
    el.title = I18n.t('눌러서 지금 동기화');
  } else if (st.state === 'offline') {
    el.innerHTML = dot + I18n.t('오프라인');
    el.title = I18n.t('연결되면 자동으로 합쳐져요');
  } else if (st.state === 'error') {
    el.innerHTML = dot + I18n.t('동기화 오류');
    el.title = I18n.t(st.error || '');
  } else { el.innerHTML = dot + I18n.t('대기 중'); }
}

/* ==================== 입력 모달 ==================== */
function openEntryModal(entry) {
  editingId = entry ? entry.id : null;
  captureEditReturnPosition('entryModal', editingId);
  const firstCat = data.settings.categories.expense[0].name;
  draft = entry
    ? { type: entry.type, amount: entry.amount,
        category: categoryKey(entry.type, entry.category), date: entry.date,
        time: entry.time || '', memo: entry.memo, payer: entry.payer, split: entry.split || 'half',
        offBudget: !!entry.offBudget,
        /* 저장된 건 총액(amount)과 팁뿐이라, 식사비는 빼서 되돌린다 */
        base: roundMoney(entry.amount - (entry.tip || 0)),
        tip: entry.tip || 0,
        tipMode: entry.tip ? 'custom' : 'none' }
    : { type: 'expense', amount: 0, category: firstCat,
        date: selectedDay || todayStr(),
        // 새로 넣는 건 지금 시각을 채워둔다 (지우면 시간 없이 저장된다)
        time: selectedDay && selectedDay !== todayStr() ? '' : nowTime(),
        memo: '', payer: ME(), split: catShare(firstCat), offBudget: false,
        base: 0, tip: 0, tipMode: 'none' };
  /* 수정 중에는 지금은 지워진 결제수단 id도 그대로 유지한다.
     다른 필드만 고쳐도 결제수단이 조용히 바뀌는 일을 막기 위함이다. */
  const fallbackMethod = methodOf(data.settings.lastMethod)
    ? data.settings.lastMethod : ((methods()[0] || {}).id || '');
  draft.method = entry ? (entry.method || '') : fallbackMethod;
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
  $('#inMemo').placeholder = I18n.t(isExp ? '어디에 썼는지 적어주세요' : '어떤 수입인지 적어주세요');
  $('#btnDeleteEntry').classList.toggle('hidden', !editingId);
  $('#btnSaveEntry').textContent = editingId ? '수정 저장' : '저장';

  $('#catGrid').innerHTML = data.settings.categories[draft.type].map((c) => `
    <button class="cat-chip ${c.name === draft.category ? 'active' : ''}" data-name="${esc(c.name)}">
      <span>${esc(c.emoji)}</span>${esc(catLabel(c))}
    </button>`).join('');

  $('#payerField').querySelector('label').textContent = isExp ? '누가 냈어요?' : '누가 받았어요?';
  $('#payerSeg').innerHTML = [ME(), PARTNER()].map((n) =>
    `<button data-payer="${esc(n)}" class="${draft.payer === n ? 'active' : ''}">${esc(n)}</button>`).join('');

  renderTipBox();
  renderMethodPicker();
  $('#splitLine').classList.toggle('hidden', !isExp);
  /* 예산 밖으로 뺄 수 있는 것:
     지출은 '같이 쓴 돈'일 때만 (혼자 쓴 돈은 애초에 예산·정산에 안 들어간다),
     수입은 언제나 (예산 밖 지출 때문에 더 넣은 돈을 생활비와 갈라놓기 위해).
     고정지출 분류는 이미 따로 세므로 뺄 필요가 없다. */
  const showOB = !isFixedCat(draft.category)
    && (isExp ? draft.split === 'half' : true);
  $('#offBudgetLine').classList.toggle('hidden', !showOB);
  $('#inOffBudget').checked = !!draft.offBudget;
  /* 같은 체크지만 지출과 수입에서 뜻이 반대라 설명을 바꿔준다 */
  $('#obTitle').textContent = '이번 달 예산에서 빼기';
  $('#obDesc').textContent = isExp
    ? '가전·수리비처럼 갑자기 생긴 돈. 남은 돈이 줄지 않고, 그만큼 둘이 더 넣게 돼요.'
    : '예산 밖 지출 때문에 추가로 넣은 돈. 생활비 통장에 더해지지 않아요.';
  if (isExp) renderSplitLine();
}

/* 결제수단 칩 + 이 분류에 제일 좋은 카드 추천 */
function renderMethodPicker() {
  const missing = draft.method && !methodOf(draft.method)
    ? `<button class="cat-chip method active" data-method="${esc(draft.method)}"><span>⚠️</span>지워진 결제수단</button>`
    : '';
  $('#methodGrid').innerHTML = methods().map((m) => `
    <button class="cat-chip method ${m.id === draft.method ? 'active' : ''}" data-method="${esc(m.id)}">
      <span>${m.emoji || '💳'}</span>${esc(m.name)}
    </button>`).join('') + missing + `
    <button class="cat-chip method ${draft.method ? '' : 'active'}" data-method=""><span>➖</span>결제수단 없음</button>`;

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

/* 직접입력 중에는 입력칸을 건드리지 않고 요약과 분담액만 갱신한다 */
function refreshTipSummary() {
  const pct = draft.base > 0 ? (draft.tip / draft.base) * 100 : 0;
  $('#tipSum').innerHTML = draft.base
    ? `식사비 <b>${fmtMoney(draft.base)}</b> + 팁 <b>${fmtMoney(draft.tip)}</b>` +
      ` (${pct.toFixed(pct % 1 ? 1 : 0)}%) = <span class="total">${fmtMoney(draft.amount)}</span>`
    : '식사비를 먼저 넣어주세요';
  renderSplitLine();
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
  const pct = draft.base > 0 ? (draft.tip / draft.base) * 100 : 0;
  $('#tipSum').innerHTML =
    `식사비 <b>${fmtMoney(draft.base)}</b> + 팁 <b>${fmtMoney(draft.tip)}</b>` +
    ` (${pct.toFixed(pct % 1 ? 1 : 0)}%) = <span class="total">${fmtMoney(draft.amount)}</span>`;
}

/* 분류가 정해준 나눔 방식과 실제 부담액을 한 줄로 보여준다 */
function renderSplitLine() {
  const c = catOf('expense', draft.category);
  const emoji = c ? c.emoji : '📦';
  const amt = draft.amount || 0;

  if (draft.split === 'half') {
    const myPct = mySplitRatioPct();
    const myPart = roundMoney(amt * myPct / 100);
    const yourPart = roundMoney(amt - myPart);
    const detail = amt > 0
      ? `${esc(ME())} <b>${fmtMoney(myPart)}</b> · ${esc(PARTNER())} <b>${fmtMoney(yourPart)}</b>`
      : `${myPct} : ${100 - myPct} 로 나눠서 정산에 반영돼요`;
    $('#splitText').innerHTML =
      `${esc(emoji)} <span class="tag">같이 쓴 돈</span><br>${detail}`;
    $('#btnSplitToggle').textContent = '혼자 쓴 돈';
  } else {
    $('#splitText').innerHTML =
      `${esc(emoji)} <span class="tag solo">${esc(draft.payer)} 혼자 쓴 돈</span><br>정산에는 안 들어가요`;
    $('#btnSplitToggle').textContent = '같이 쓴 돈';
  }
}

function captureDraft() {
  draft.base = readAmount();
  draft.date = $('#inDate').value || draft.date;
  draft.time = $('#inTime').value || '';
  draft.memo = $('#inMemo').value;
  const ob = $('#inOffBudget');
  if (ob && !$('#offBudgetLine').classList.contains('hidden')) draft.offBudget = ob.checked;
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
  if (draft.type === 'expense') renderSplitLine();
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
    memo: $('#inMemo').value.trim(),
    payer: draft.payer,
    split: draft.type === 'expense' ? draft.split : 'personal',
    // 지출·수입 모두 예산 밖으로 뺄 수 있다
    offBudget: !!draft.offBudget
  };
  if (methodOf(draft.method)) data.settings.lastMethod = draft.method;
  const wasEditing = !!editingId;
  if (wasEditing) {
    const e = data.entries.find((x) => x.id === editingId);
    if (e) { Object.assign(e, f); touch(e); }
  } else {
    const e = { id: uuid(), ...f, member: ME(), deleted: false };
    touch(e);
    data.entries.push(e);
  }
  $('#entryModal').classList.add('hidden');
  /* Editing should not silently switch the month underneath the user. New
     entries still open the month they were added to, as before. */
  if (!wasEditing) curMonth = f.date.slice(0, 7);
  afterChange();
  restoreEditReturnPosition('entryModal', true);
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
    restoreEditReturnPosition('entryModal', true);
  });
}

/* ==================== 설정 모달 ==================== */
function openSettings() {
  const s = data.settings;
  settingsRatioAtOpen = mySplitRatioPct();
  settingsFixedShareAtOpen = fixedShareAmount();
  settingsRatioTouched = false;
  settingsFixedShareTouched = false;
  $('#setName').value = s.memberName || '';
  $('#setPartner').value = s.partnerName || '';
  $('#setRatio').value = settingsRatioAtOpen;
  $('#setFixedShare').value = settingsFixedShareAtOpen || '';
  $('#setCurrency').value = s.currency;
  $('#setLang').value = s.lang || 'auto';
  $('#setBudget').value = s.budget || '';
  $('#setGoalName').value = (s.goal && s.goal.name) || '';
  $('#setGoalTarget').value = (s.goal && s.goal.target) || '';
  $('#setSupaUrl').value = s.supabaseUrl || '';
  $('#setSupaKey').value = s.supabaseKey || '';
  $('#setCoupleCode').value = s.coupleCode || '';
  $('#syncInfo').textContent = '';
  setDraftCats = JSON.parse(JSON.stringify(s.categories));
  editingCategory = null;
  setDraftRecur = JSON.parse(JSON.stringify(s.recurring || []));
  setDraftMethods = JSON.parse(JSON.stringify(s.methods || []));
  resetRecurringForm();
  renderMethodManage();
  updateRatioLabel();
  renderNameSyncHint();
  renderCatManage();
  renderRecurList();
  renderPushSetting();
  $('#settingsModal').classList.remove('hidden');
}

function renderNameSyncHint() {
  const el = $('#nameSyncHint');
  const members = (data.settings.members || []).filter(Boolean);
  if (nameConflict()) {
    el.innerHTML = I18n.lang === 'en'
      ? `⚠ This ledger has <b>${members.length} names</b> (${members.map(esc).join(', ')}). One of you may have used a different name before. Open any entry under the unused name to correct it.`
      : `⚠ 이름이 <b>${members.length}개</b>로 잡혀 있어요 (${members.map(esc).join(', ')}).` +
        ' 둘 중 한 분이 예전에 다른 이름을 쓰신 것 같아요. 쓰지 않는 이름으로 된 내역을 눌러 고쳐주세요.';
  } else if (members.length === 2) {
    el.textContent = I18n.t('✓ 두 사람 이름이 맞춰졌어요. 상대 이름은 자동으로 유지됩니다.');
  } else if (Sync.isConfigured()) {
    el.textContent = I18n.t('상대가 연결되면 상대 이름이 자동으로 맞춰져요.');
  } else {
    el.textContent = I18n.t('커플 공유를 켜면 상대 이름이 자동으로 맞춰집니다.');
  }
}

function updateRatioLabel() {
  const v = Number($('#setRatio').value);
  const me = $('#setName').value.trim() || ME();
  const you = $('#setPartner').value.trim() || PARTNER();
  $('#ratioLabel').textContent = v + '%';
  $('#ratioHint').textContent = v === 50
    ? `함께 쓴 돈을 정확히 반반씩 부담해요`
    : `${me} ${v}% · ${you} ${100 - v}% 로 나눠요`;

  const fx = toNum($('#setFixedShare').value);
  const fixedOwnedHere = settingsFixedShareTouched || fixedShareBelongsToMe();
  const fixedOwner = fixedOwnedHere ? me : fixedShareOwnerName();
  const fixedLabel = $('label[for="setFixedShare"]');
  if (fixedLabel) fixedLabel.textContent = fixedOwnedHere
    ? '고정지출은 내가 정액으로 부담 (0이면 위 비율 적용)'
    : `${fixedOwner} 정액 부담액 (바꾸면 내 정액 부담으로 변경)`;
  $('#fixedShareHint').textContent = fx > 0
    ? `고정지출은 ${fixedOwner} 가 매달 ${fmtMoney(fx)} 만 부담하고, 남는 금액은 ${fixedOwnedHere ? you : me} 부담이 돼요`
    : `지금은 고정지출도 위 비율로 나눠요`;
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
    const start = methodBalanceStart(m);
    const current = methodBalance(m);
    const deleteLabel = I18n.lang === 'en' ? `Delete ${m.name}` : `${m.name} 삭제`;
    const sub = [
      rates.length ? rates.map(([k, v]) => `${categoryLabel('expense', k)} ${v}%`).slice(0, 2).join(' · ') : '',
      m.base > 0 ? `그 외 ${m.base}%` : '',
      m.billingDay ? `${m.billingDay}일 결제` : '',
      monthTotals[m.id] ? `이번 달 지출 ${fmtMoney(monthTotals[m.id])}` : '',
      start ? `${start.date} 시작 · ${start.before === 'include' && !start.baselineReady
        ? '동기화 후 과거 변경분 반영'
        : `과거 변경분 ${start.before === 'include' ? '반영' : '미반영'}`}` : ''
    ].filter(Boolean).join(' · ');
    return `
      <div class="method-item" data-medit="${esc(m.id)}">
        <span class="ic">${m.emoji || '💳'}</span>
        <span class="nm">${esc(m.name)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span>
        <span class="kind ${m.type}">${kind}</span>
        <span class="amt">${current == null ? '' : `<small>${methodBalanceName(m)}</small>${fmtMoney(current)}`}</span>
        ${m.id === 'cash' ? '' :
          `<button class="del" data-mdel="${esc(m.id)}" title="${esc(I18n.t('삭제'))}" aria-label="${esc(deleteLabel)}">✕</button>`}
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
  const start = methodBalanceStart(m);
  $('#inTrackBalance').checked = !!start;
  $('#inStartingBalance').value = start ? formatAmountStr(start.amount) : '';
  $('#inBalanceStartDate').value = start ? start.date : todayStr();
  $('#inBalanceStartDate').max = todayStr();
  $('#inIncludeBeforeStart').checked = !!(start && start.before === 'include');
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
  renderMethodBalanceFields();

  $('#rateGrid').innerHTML = (setDraftCats || data.settings.categories).expense.map((c) => `
    <span class="rate-cell">
      ${esc(c.emoji)} ${esc(catLabel(c))}
      <input data-rate="${esc(c.name)}" inputmode="decimal" maxlength="5"
             value="${esc(categoryRateValue(methodDraftRates, c) ?? '')}" placeholder="–">
      <span class="pc">%</span>
    </span>`).join('');
}

function renderMethodBalanceFields() {
  const on = $('#inTrackBalance').checked;
  $('#balanceStartFields').classList.toggle('hidden', !on);
  if (!on) return;
  const date = $('#inBalanceStartDate').value || todayStr();
  const include = $('#inIncludeBeforeStart').checked;
  const meaning = I18n.t(methodDraftType === 'credit'
    ? '이 날 시작 시점의 미결제 사용액을 넣어주세요. 이후 지출은 더하고 수입·환불은 빼서 계산해요.'
    : '이 날 시작 시점의 사용 가능 잔액을 넣어주세요. 이후 수입은 더하고 지출은 빼서 계산해요.');
  const before = I18n.t(include
    ? '시작점을 저장한 뒤 시작일 이전 내역을 추가·수정·삭제하면 그 차액만 잔액에 반영돼요.'
    : '시작점을 저장한 뒤 시작일 이전 내역을 추가·수정·삭제해도 잔액은 바뀌지 않아요.');
  const basis = I18n.lang === 'en' ? `${date} basis` : `${date} 기준`;
  $('#balanceStartHint').textContent = `${basis} · ${meaning} ${before}`;
}

function saveMethod() {
  const name = $('#inMethodName').value.trim();
  if (!name) { $('#inMethodName').focus(); toast('이름을 넣어주세요'); return; }
  let balanceStartInput = null;
  if ($('#inTrackBalance').checked) {
    const raw = $('#inStartingBalance').value.trim();
    const date = $('#inBalanceStartDate').value;
    if (raw === '') { $('#inStartingBalance').focus(); toast('시작 금액을 넣어주세요'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date > todayStr()) {
      $('#inBalanceStartDate').focus(); toast('잔액 계산 시작일을 골라주세요'); return;
    }
    balanceStartInput = {
      amount: toNum(raw), date,
      before: $('#inIncludeBeforeStart').checked ? 'include' : 'exclude'
    };
  }
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

  if (editingMethodId) {
    const m = setDraftMethods.find((x) => x.id === editingMethodId);
    if (m) {
      let balanceStart = null;
      if (balanceStartInput) {
        const old = m.balanceStart;
        /* 이름·혜택·시작 금액·반영 여부만 고칠 때는 최초 스냅샷을 유지한다.
           시작일이나 카드 종류가 바뀌면 기여 범위/부호가 달라지므로 지금 다시 잡는다. */
        const sameScope = old && old.date === balanceStartInput.date && m.type === methodDraftType
          && hasMethodBalanceBaseline(old);
        balanceStart = {
          ...balanceStartInput,
          /* 새 범위는 바깥 설정 저장에서 최종 공유 상태를 적용한 뒤 확정한다.
             같은 설정 세션에서 공유를 처음 켜도 불완전한 로컬 합계를 올리지 않는다. */
          baseline: sameScope ? Number(old.baseline) : null
        };
      }
      Object.assign(m, fields, { balanceStart });
    }
  } else {
    const id = 'm_' + uuid().slice(0, 8);
    const balanceStart = balanceStartInput ? {
      ...balanceStartInput,
      baseline: null
    } : null;
    setDraftMethods.push({ id, ...fields, balanceStart });
  }
  $('#methodModal').classList.add('hidden');
  renderMethodManage();
}

function deleteMethodById(id) {
  const m = setDraftMethods.find((x) => x.id === id);
  if (!m) return;
  const used = liveEntries().filter((e) => e.method === id).length;
  askConfirm({
    emoji: '🗑️',
    title: I18n.lang === 'en' ? `Delete ${m.name}?` : `${m.name} 을(를) 삭제할까요?`,
    text: used
      ? (I18n.lang === 'en'
        ? `<b>${used}</b> ${used === 1 ? 'entry' : 'entries'} recorded with this payment method will remain, but its payment-method label will be removed.`
        : `이 결제수단으로 기록된 내역 <b>${used}건</b> 은 그대로 남고, 결제수단 표시만 사라집니다.`)
      : (I18n.lang === 'en'
        ? 'Select Save in Settings to apply this change.'
        : '설정에서 [저장] 을 눌러야 최종 반영돼요.'),
    ok: '삭제', danger: true
  }, () => {
    setDraftMethods = setDraftMethods.filter((x) => x.id !== id);
    $('#methodModal').classList.add('hidden');
    renderMethodManage();
  });
}
function deleteMethod() { deleteMethodById(editingMethodId); }

function categoryOrderMessage(c, index, total) {
  const label = catLabel(c);
  return I18n.lang === 'en'
    ? `${label} moved to position ${index + 1} of ${total}.`
    : `${label} 분류를 ${total}개 중 ${index + 1}번째로 옮겼어요.`;
}

function announceCategoryOrder(message, type, name, focusHandle) {
  const status = $('#catOrderStatus');
  if (status) {
    /* 같은 위치를 연속해서 선택해도 스크린 리더가 다시 읽도록 비웠다가 넣는다. */
    status.textContent = '';
    requestAnimationFrame(() => { if ($('#catOrderStatus')) $('#catOrderStatus').textContent = message; });
  }
  if (!focusHandle) return;
  requestAnimationFrame(() => {
    const handle = [...document.querySelectorAll('#catManage [data-catdrag]')]
      .find((el) => el.dataset.type === type && el.dataset.catdrag === name);
    if (!handle) return;
    try { handle.focus({ preventScroll: true }); } catch (_) { handle.focus(); }
  });
}

function reorderDraftCategory(type, from, to) {
  const list = setDraftCats && setDraftCats[type];
  if (!Array.isArray(list) || from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) {
    return null;
  }
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  return moved;
}

function beginCategoryDrag(ev, pointerId, pointerType) {
  const handle = ev.target.closest('[data-catdrag]');
  if (!handle || categoryDrag || ev.isPrimary === false || (pointerType === 'mouse' && ev.button !== 0)) return;
  const item = handle.closest('[data-catitem]');
  const list = item && item.closest('.cat-manage-list');
  if (!item || !list || !setDraftCats) return;

  /* iOS 에서는 핸들만 touch-action:none 이다. 핸들 밖에서는 설정 화면을
     평소처럼 스크롤할 수 있고, 핸들을 잡았을 때만 정렬 제스처가 된다. */
  ev.preventDefault();
  categoryDrag = {
    pointerId,
    pointerType,
    type: item.dataset.type,
    name: item.dataset.catname,
    startX: ev.clientX,
    startY: ev.clientY,
    item,
    list,
    handle,
    /* 드래그 중 item은 목록 안에서 계속 재삽입된다. Safari는 이동한 요소나
       그 자식(handle)에 건 pointer capture를 잃을 수 있으므로, DOM 위치가
       고정된 관리 컨테이너가 끝까지 터치/펜 포인터를 잡는다. */
    captureTarget: $('#catManage'),
    active: false
  };
  item.classList.add('drag-ready');
  if (pointerType !== 'mouse') {
    try { categoryDrag.captureTarget.setPointerCapture(pointerId); } catch (_) { /* 구형 WebKit은 캡처 없이도 동작 */ }
  }
}

function categoryDropTarget(drag, x, y) {
  const listRect = drag.list.getBoundingClientRect();
  if (x < listRect.left - 24 || x > listRect.right + 24
      || y < listRect.top - 24 || y > listRect.bottom + 24) return null;

  const hit = document.elementFromPoint(x, y);
  const direct = hit && hit.closest('[data-catitem]');
  if (direct === drag.item) return null;
  if (direct && direct !== drag.item && direct.dataset.type === drag.type
      && direct.closest('.cat-manage-list') === drag.list) return direct;

  /* 칩 사이의 빈 공간에서도 가장 가까운 칩을 찾는다. 특히 작은 화면에서
     여러 줄로 줄바꿈된 목록을 손가락으로 옮길 때 필요하다. */
  let nearest = null;
  let nearestDistance = Infinity;
  [...drag.list.querySelectorAll('[data-catitem]')].forEach((item) => {
    if (item === drag.item) return;
    const r = item.getBoundingClientRect();
    const dx = x < r.left ? r.left - x : (x > r.right ? x - r.right : 0);
    const dy = y < r.top ? r.top - y : (y > r.bottom ? y - r.bottom : 0);
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) { nearestDistance = distance; nearest = item; }
  });
  return nearest;
}

function moveCategoryDragItem(drag, x, y) {
  const scroller = $('#settingsModal .settings-body');
  if (scroller) {
    const sr = scroller.getBoundingClientRect();
    const edge = Math.min(64, sr.height * 0.18);
    if (y < sr.top + edge) scroller.scrollTop -= 14;
    else if (y > sr.bottom - edge) scroller.scrollTop += 14;
  }
  const target = categoryDropTarget(drag, x, y);
  if (!target) return;
  const r = target.getBoundingClientRect();
  const sameRow = y >= r.top && y <= r.bottom;
  const insertBefore = sameRow ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
  const reference = insertBefore ? target : target.nextElementSibling;
  if (reference !== drag.item) drag.list.insertBefore(drag.item, reference);
}

function moveCategoryDrag(ev, pointerId) {
  const drag = categoryDrag;
  if (!drag || drag.pointerId !== pointerId) return;
  const distance = Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY);
  if (!drag.active && distance < 5) return;
  if (!drag.active) {
    drag.active = true;
    drag.item.classList.remove('drag-ready');
    drag.item.classList.add('is-dragging');
    drag.list.classList.add('is-sorting');
  }
  ev.preventDefault();
  moveCategoryDragItem(drag, ev.clientX, ev.clientY);
}

function commitCategoryDomOrder(drag) {
  const current = setDraftCats[drag.type] || [];
  const byName = new Map(current.map((c) => [c.name, c]));
  const ordered = [...drag.list.querySelectorAll('[data-catitem]')]
    .map((el) => byName.get(el.dataset.catname)).filter(Boolean);
  if (ordered.length === current.length) setDraftCats[drag.type] = ordered;
  const index = setDraftCats[drag.type].findIndex((c) => c.name === drag.name);
  return { moved: setDraftCats[drag.type][index], index, total: setDraftCats[drag.type].length };
}

function finishCategoryDrag(ev, commit, pointerId) {
  const drag = categoryDrag;
  if (!drag || drag.pointerId !== pointerId) return;
  categoryDrag = null; // releasePointerCapture의 lost 이벤트보다 먼저 비운다.
  try {
    if (drag.pointerType !== 'mouse' && drag.captureTarget.hasPointerCapture
        && drag.captureTarget.hasPointerCapture(pointerId)) {
      drag.captureTarget.releasePointerCapture(pointerId);
    }
  } catch (_) { /* 이미 캡처가 풀린 경우 */ }

  drag.item.classList.remove('drag-ready', 'is-dragging');
  drag.list.classList.remove('is-sorting');
  if (!drag.active) return;
  ev.preventDefault();

  if (!commit) {
    /* OS 제스처나 전화 등으로 드래그가 취소되면 초안 배열의 원래 순서로 되돌린다. */
    renderCatManage();
    return;
  }

  const { moved, index, total } = commitCategoryDomOrder(drag);
  renderCatManage();
  if (moved) announceCategoryOrder(
    categoryOrderMessage(moved, index, total), drag.type, drag.name, false);
}

function beginNativeCategoryDrag(ev) {
  const handle = ev.target.closest('[data-catdrag]');
  const item = handle && handle.closest('[data-catitem]');
  const list = item && item.closest('.cat-manage-list');
  if (categoryDrag || !handle || !item || !list || !setDraftCats) { ev.preventDefault(); return; }
  categoryNativeDrag = {
    type: item.dataset.type,
    name: item.dataset.catname,
    item,
    list,
    handle
  };
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move';
    /* Safari/Firefox는 데이터가 하나도 없으면 dragover/drop을 보내지 않는다. */
    ev.dataTransfer.setData('text/plain', item.dataset.catname || 'category');
  }
  item.classList.add('is-dragging');
  list.classList.add('is-sorting');
}

function moveNativeCategoryDrag(ev) {
  const drag = categoryNativeDrag;
  if (!drag || !ev.target.closest('.cat-manage-list') || ev.target.closest('.cat-manage-list') !== drag.list) return;
  ev.preventDefault();
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
  moveCategoryDragItem(drag, ev.clientX, ev.clientY);
}

function finishNativeCategoryDrop(ev) {
  const drag = categoryNativeDrag;
  if (!drag) return;
  ev.preventDefault();
  categoryNativeDrag = null; // 뒤이어 오는 dragend가 취소 처리하지 않게 먼저 비운다.
  const { moved, index, total } = commitCategoryDomOrder(drag);
  renderCatManage();
  if (moved) announceCategoryOrder(
    categoryOrderMessage(moved, index, total), drag.type, drag.name, false);
}

function cancelNativeCategoryDrag() {
  const drag = categoryNativeDrag;
  if (!drag) return; // 정상 drop 뒤의 dragend
  categoryNativeDrag = null;
  renderCatManage(); // 목록 밖에 놓은 경우에는 초안의 원래 순서로 복원한다.
}

function onCategoryDragKeydown(ev) {
  const handle = ev.target.closest('[data-catdrag]');
  if (!handle) return;
  const list = setDraftCats && setDraftCats[handle.dataset.type];
  if (!Array.isArray(list)) return;
  const from = list.findIndex((c) => c.name === handle.dataset.catdrag);
  let to = from;
  if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') to = Math.max(0, from - 1);
  else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') to = Math.min(list.length - 1, from + 1);
  else if (ev.key === 'Home') to = 0;
  else if (ev.key === 'End') to = list.length - 1;
  else return;
  ev.preventDefault();
  const moved = reorderDraftCategory(handle.dataset.type, from, to) || list[from];
  renderCatManage();
  if (moved) announceCategoryOrder(
    categoryOrderMessage(moved, to, list.length), handle.dataset.type, moved.name, true);
}

function renderCatManage() {
  const block = (type, label, hint) => `
    <div class="field">
      <label>${label}</label>
      ${hint ? `<p class="hint tiny" style="margin:-2px 0 8px">${hint}</p>` : ''}
      <p class="hint tiny cat-order-help" id="catOrderHelp-${type}">${esc(I18n.t('핸들을 끌어서 순서를 바꿀 수 있어요. 키보드에서는 방향키를 누르세요.'))}</p>
      <div class="cat-manage-list" role="list" aria-label="${esc(I18n.t(label))}">
        ${(setDraftCats[type] || []).map((c, index) => {
          const other = I18n.lang === 'en' ? c.nameKo : c.nameEn;
          const otherLanguage = I18n.lang === 'en' ? 'Korean' : 'English';
          const dragLabel = `${catLabel(c)} · ${I18n.t('끌어서 순서 바꾸기')}`;
          const editLabel = I18n.lang === 'en' ? `Edit ${catLabel(c)}` : `${catLabel(c)} 수정`;
          const deleteLabel = I18n.lang === 'en' ? `Delete ${catLabel(c)}` : `${catLabel(c)} 삭제`;
          return `
          <div class="cat-manage-chip" role="listitem" data-catitem data-type="${type}" data-catname="${esc(c.name)}">
            <button type="button" class="cat-drag-handle" draggable="true" data-catdrag="${esc(c.name)}" data-type="${type}"
              aria-label="${esc(dragLabel)}" aria-describedby="catOrderHelp-${type}"
              title="${esc(I18n.t('끌어서 순서 바꾸기'))}">⠿</button>
            <span style="width:8px;height:8px;border-radius:3px;background:${slotColor(c.slot)};display:inline-block"></span>
            <span class="cat-label" data-i18n-user>${esc(c.emoji)} ${esc(catLabel(c))}</span>
            ${other && other !== catLabel(c)
              ? `<span class="cat-other-name" data-i18n-user>(${otherLanguage}: ${esc(other)})</span>` : ''}
            ${type === 'expense' ? `<button class="share-btn ${c.share === 'personal' ? 'personal' : 'half'}"
                data-share="${esc(c.name)}" title="${esc(I18n.t('눌러서 바꾸기'))}">${c.share === 'personal' ? I18n.t('혼자') : I18n.t('같이')}</button>
              <button class="tip-btn ${c.tip ? 'on' : 'off'}"
                data-tipcat="${esc(c.name)}" title="${esc(I18n.t('팁 계산 켜기/끄기'))}">${I18n.t('팁')}</button>` : ''}
            <button class="edit" data-catedit="${index}" data-type="${type}" title="${esc(I18n.t('분류 수정'))}"
              aria-label="${esc(editLabel)}">✎</button>
            ${c.key ? '' : `<button class="del" data-del="${esc(c.name)}" data-type="${type}" title="${esc(I18n.t('삭제'))}" aria-label="${esc(deleteLabel)}">✕</button>`}
          </div>`;
        }).join('')}
      </div>
      <div class="cat-add-row">
        <button class="btn" data-catadd="${type}">＋ 분류 추가</button>
      </div>
    </div>`;
  $('#catManage').innerHTML =
    block('expense', '지출 분류',
      '<b>같이 / 혼자</b>· <b>팁</b> 을 눌러서 바꿀 수 있어요.') +
    block('income', '수입 분류', '') +
    '<p id="catOrderStatus" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>';
}
function renderRecurList() {
  if (!setDraftRecur.length) {
    $('#recurList').innerHTML = '<p class="hint">등록된 반복 지출이 없어요.</p>';
    return;
  }
  $('#recurList').innerHTML = setDraftRecur.map((r) => `
    <div class="recur-item ${editingRecurringId === r.id ? 'editing' : ''}">
      <span class="day">매달 ${r.day}일</span>
      <span class="nm">${esc(r.memo)}</span>
      <span class="amt">${fmtMoney(r.amount)}</span>
      <button class="edit" data-recedit="${r.id}" title="${esc(I18n.t('반복 지출 수정'))}"
        aria-label="${esc(I18n.lang === 'en' ? `Edit ${r.memo}` : `${r.memo} 수정`)}">✎</button>
      <button class="del" data-recdel="${r.id}" title="${esc(I18n.t('삭제'))}"
        aria-label="${esc(I18n.lang === 'en' ? `Delete ${r.memo}` : `${r.memo} 삭제`)}">✕</button>
    </div>`).join('');
}

function saveSettings(keepOpen) {
  /* 반복 입력칸을 편집하다가 바로 설정 저장을 눌러도 값이 사라지지 않게 한다. */
  if (recurringFormHasInput() && saveRecurringForm() === false) return false;
  const s = data.settings;
  const newCurrency = $('#setCurrency').value;
  const newBudget = Number(String($('#setBudget').value).replace(/[^0-9.]/g, '')) || 0;
  const ratioInput = Number($('#setRatio').value);
  const newRatio = Number.isFinite(ratioInput)
    ? Math.max(0, Math.min(100, ratioInput)) : settingsRatioAtOpen;
  const newGoal = {
    name: $('#setGoalName').value.trim(),
    target: Number(String($('#setGoalTarget').value).replace(/[^0-9.]/g, '')) || 0
  };
  const newFixedShare = toNum($('#setFixedShare').value);
  const newMethods = setDraftMethods.length ? setDraftMethods : defaultMethods();
  const ratioChanged = settingsRatioTouched
    && (newRatio !== settingsRatioAtOpen || !ownerIsMe(s.splitRatioOwner));
  const fixedShareChanged = settingsFixedShareTouched
    && (newFixedShare !== settingsFixedShareAtOpen || !fixedShareBelongsToMe());
  /* 실제로 바뀐 항목만 골라낸다 — 안 건드린 항목은 상대가 정한 값이 그대로 살아남는다 */
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const changedFields = [];
  if (!same(setDraftCats, s.categories)) changedFields.push('categories');
  if (!same(setDraftRecur, s.recurring)) changedFields.push('recurring');
  if (!same(newMethods, s.methods)) changedFields.push('methods');
  if (!same(newGoal, s.goal)) changedFields.push('goal');
  if (newBudget !== s.budget) changedFields.push('budget');
  if (ratioChanged) changedFields.push('splitRatio');
  if (fixedShareChanged) changedFields.push('fixedShare');

  /* 지운 카드는 따로 적어둔다. 안 그러면 상대 기기에서 다시 살아난다. */
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

  /* 내 이름을 바꾸면 내가 냈다고 기록된 내역도 같이 따라가야 한다.
     예전 이름은 retiredNames 에 넣어 동기화로 되살아나지 않게 한다. */
  const oldMe = s.memberName;
  const newMe = $('#setName').value.trim() || oldMe;
  if (oldMe && newMe !== oldMe) {
    renamePayer(oldMe, newMe);
    s.retiredNames = [...new Set([...(s.retiredNames || []), oldMe])].filter((n) => n !== newMe);
    s.members = (s.members || []).filter((n) => n !== oldMe);
  }
  s.memberName = newMe;
  if (newMe && !(s.members || []).includes(newMe)) s.members = [...(s.members || []), newMe];

  const typedPartner = $('#setPartner').value.trim();
  if (typedPartner && typedPartner !== s.partnerName && !(s.members || []).includes(s.partnerName)) {
    // 아직 연동 전이라 상대 이름을 직접 고친 경우 — 기존 기록도 같이 옮겨준다
    renamePayer(s.partnerName, typedPartner);
  }
  s.partnerName = typedPartner;
  /* 언어는 기기마다 다를 수 있으므로 동기화하지 않고 이 기기에만 둔다 */
  const newLang = $('#setLang').value || 'auto';
  const langChanged = newLang !== (s.lang || 'auto');
  s.lang = newLang;

  /* 입력칸은 항상 '현재 기기의 나' 기준으로 보여준다.
     사용자가 직접 바꾸지 않은 경우에는 상대 기기가 저장한 owner 와
     원본 값을 그대로 두어, 설정의 기준 사람이 조용히 바뀌지 않게 한다. */
  if (ratioChanged) {
    s.splitRatio = newRatio;
    s.splitRatioOwner = newMe || ME();
  }
  if (fixedShareChanged) {
    s.fixedShare = newFixedShare;
    s.fixedShareOwner = newMe || ME();
  }
  /* 통화는 표시·입력 형식이므로 상대 설정에 덮이지 않게 이 기기에만 저장한다.
     환율 변환은 하지 않으므로 두 기기에서 같은 실제 통화를 선택해야 한다. */
  s.currency = newCurrency;
  s.budget = newBudget;
  s.goal = newGoal;
  s.categories = setDraftCats;
  s.recurring = setDraftRecur;
  s.methods = newMethods;
  if (!methodOf(s.lastMethod)) s.lastMethod = s.methods[0].id;
  setDraftCats = JSON.parse(JSON.stringify(setDraftCats));
  setDraftRecur = JSON.parse(JSON.stringify(setDraftRecur));
  if (changedFields.length) markMeta(...changedFields);
  /* 이름 변경은 renamePayer() 안에서 owner 필드의 metaDirty 를
     먼저 표시한다. 그 경우도 저장 직후 동기화하도록 포함한다. */
  const metaChanged = changedFields.length > 0 || s.metaDirty;
  settingsRatioAtOpen = mySplitRatioPct();
  settingsFixedShareAtOpen = fixedShareAmount();
  settingsRatioTouched = false;
  settingsFixedShareTouched = false;
  if (langChanged) {
    I18n.setLang(newLang, userWords, stockNames());
    checkDesktopUpdate();
  }
  const pushLocaleChanged = Push.refreshMetadata(ME());

  const oldLedgerUrl = Sync.normalizeUrl(s.supabaseUrl);
  const oldLedgerKey = (s.supabaseKey || '').trim().replace(/\s+/g, '');
  const oldLedgerCode = (s.coupleCode || '').trim();
  const wasConfigured = !!(oldLedgerUrl && oldLedgerKey && oldLedgerCode);
  const prev = [oldLedgerUrl, oldLedgerKey, oldLedgerCode].join('|');
  // 붙여넣을 때 /rest/v1 같은 경로가 같이 들어오면 잘라낸다 (안 자르면 동기화가 404 로 실패)
  s.supabaseUrl = Sync.normalizeUrl($('#setSupaUrl').value);
  s.supabaseKey = $('#setSupaKey').value.trim().replace(/\s+/g, '');
  s.coupleCode = $('#setCoupleCode').value.trim();
  $('#setSupaUrl').value = s.supabaseUrl;
  const cfgChanged = prev !== [s.supabaseUrl, s.supabaseKey, s.coupleCode].join('|');
  const nowConfigured = !!(s.supabaseUrl && s.supabaseKey && s.coupleCode);
  const ledgerChanged = nowConfigured && (!wasConfigured
    || oldLedgerUrl !== s.supabaseUrl || oldLedgerCode !== s.coupleCode);
  /* 원장 정체성 변경만으로 methods 수정 시각을 새로 만들지는 않는다.
     그래야 첫 pull 에서 상대의 더 최신 결제수단 설정이 정상적으로 이긴다. */
  if (ledgerChanged) invalidateMethodBalanceBaselines();
  if (cfgChanged) {
    s.lastPullAt = null;
    data.entries.forEach((e) => { e.dirty = true; });
    Sync.configure(s);
  }

  applyRecurring();

  /* 공유가 켜져 있으면 마지막 상태가 ok 여도 이번 저장 뒤 다른 기기 변경을
     한 번 더 받아야 한다. 공유를 끈 경우에만 로컬 원장으로 즉시 확정한다. */
  const canCaptureBalanceBaseline = !Sync.isConfigured();
  const balanceStartMigrated = canCaptureBalanceBaseline
    ? migrateMethodBalanceBaselines() : false;
  setDraftMethods = JSON.parse(JSON.stringify(s.methods));

  // 공유 설정(주소·키·커플 코드)은 절대 날아가면 안 되므로 지연 없이 바로 저장
  Store.saveNow(data);
  if (keepOpen !== true) $('#settingsModal').classList.add('hidden');
  render();
  if (Sync.isConfigured()
      && (cfgChanged || metaChanged || balanceStartMigrated || pushLocaleChanged)) scheduleSync();
  return true;
}

/* ==================== CSV ==================== */
function exportCsv(monthOnly) {
  const list = (monthOnly ? monthLedger(curMonth) : ledger())
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  const rows = [[
    '날짜', '시간', '구분', '금액', '팁', '분류', '결제수단', '내용', '낸사람', '나눔'
  ].map((label) => I18n.t(label))];
  list.forEach((e) => {
    const method = methodOf(e.method);
    /* Only localize the untouched built-in cash label. User-created and
       renamed payment methods are data and must remain byte-for-byte theirs. */
    const methodName = method && method.id === 'cash' && method.name === defaultMethods()[0].name
      ? I18n.t(method.name) : ((method || {}).name || '');
    rows.push([
      e.date, e.time || '', I18n.t(e.type === 'income' ? '수입' : '지출'), e.amount, e.tip || 0,
      categoryLabel(e.type, e.category), methodName, e.memo, e.payer,
      e.type === 'expense' ? I18n.t(e.split === 'half' ? '함께' : '개인') : ''
    ]);
  });
  const csv = '﻿' + rows.map((r) => r.map((v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = I18n.lang === 'en'
    ? (monthOnly ? `our-ledger_${curMonth}.csv` : 'our-ledger_all.csv')
    : (monthOnly ? `가계부_${curMonth}.csv` : '가계부_전체.csv');
  a.click();
  URL.revokeObjectURL(a.href);
  toast('CSV 파일을 저장했어요');
}

/* ==================== 업데이트 알림 ====================
 * 아이폰 웹앱: 서비스 워커가 새 파일을 받아두면 [업데이트] 한 번으로 바로 갱신된다.
 * 맥·윈도우 앱: version.json 을 확인해 새 버전이 있으면 내려받는 링크를 열어준다.
 *   (애플 개발자 서명이 없어서 앱이 스스로 설치까지 하는 건 불가능하다)
 */
/* 배포하는 사람이 정하는 값 (build 가 renderer/config.js 를 만들어준다).
   비어 있으면 업데이트 확인을 건너뛴다. */
const CFG = window.APP_CONFIG || {};
const UPDATE_BASE = CFG.updateBase || '';
let swWaiting = null;

function showUpdateBar(title, sub, onClick) {
  $('#updateTxt').innerHTML = esc(title) + (sub ? `<small>${esc(sub)}</small>` : '');
  $('#updateBar').classList.remove('hidden');
  const btn = $('#btnUpdateNow');
  btn.onclick = onClick;
}

function bindUpdateBar() {
  $('#btnUpdateLater').addEventListener('click', () => $('#updateBar').classList.add('hidden'));
}

/* --- 웹앱(아이폰) --- */
function setupServiceWorker() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;

  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (worker) => {
      swWaiting = worker;
      showUpdateBar(I18n.t('새 버전이 준비됐어요'), I18n.t('누르면 바로 최신 화면으로 바뀝니다'), () => {
        $('#btnUpdateNow').textContent = I18n.t('적용 중…');
        swWaiting.postMessage({ type: 'SKIP_WAITING' });
      });
    };
    // 이미 대기 중인 새 버전이 있으면 바로 알린다
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        // controller 가 있어야 '기존 사용자에게 온 업데이트'다 (첫 설치는 알릴 필요 없음)
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    window.addEventListener('focus', () => reg.update().catch(() => {}));
  }).catch(() => { /* 오프라인 기능만 빠질 뿐 앱은 동작 */ });

  // 새 서비스 워커가 주도권을 잡으면 화면을 다시 불러온다
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

/* --- 데스크톱 앱 --- */
/* 맥·윈도우 앱은 제목 표시줄을 없앴다. 헤더가 그 자리까지 올라오도록 표시만 해준다.
   (웹·아이폰에서는 window.gagyebu 가 없으므로 그대로 둔다) */
function markDesktopChrome() {
  const g = window.gagyebu;
  if (!g || !g.platform) return;
  document.body.classList.add('desktop');
  if (g.platform === 'darwin') document.body.classList.add('mac');
  // 회색 제목 표시줄 자리를 앱 색으로 채우는 띠 (창을 끌 수 있는 손잡이 역할도 한다)
  const band = document.createElement('div');
  band.className = 'titlebar-band';
  document.body.insertBefore(band, document.body.firstChild);
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
  const g = window.gagyebu || {};
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
  const mine = (window.gagyebu && window.gagyebu.appVersion) || '0.0.0';
  try {
    const res = await fetch(UPDATE_BASE + '/version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const info = await res.json();
    if (cmpVersion(info.version, mine) <= 0) return;
    // 플랫폼별 링크가 있으면 그걸로, 없으면 받는 곳 주소로 보낸다
    const url = (info.downloads && info.downloads[platformKey()]) || info.downloadPage || UPDATE_BASE;
    const updateTitle = I18n.lang === 'en'
      ? `Version ${info.version} is available`
      : `새 버전 ${info.version} 이 나왔어요`;
    const updateNotes = I18n.lang === 'en'
      ? (info.notesEn || info.notes || '')
      : (info.notesKo || info.notes || '');
    showUpdateBar(updateTitle, updateNotes, () => {
      window.open(url, '_blank');
      $('#updateBar').classList.add('hidden');
      toast('받은 파일을 실행하면 업데이트됩니다');
    });
  } catch (e) { /* 인터넷이 없으면 조용히 넘어간다 */ }
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
    const modal = el.closest('.modal');
    if (!modal) return;
    // 키보드가 다 올라온 뒤에 옮겨야 자리가 맞는다
    setTimeout(() => {
      if (!el.isConnected || document.activeElement !== el
          || !modal.closest('.modal-backdrop:not(.hidden)')) return;
      /* scrollIntoView는 고정 모달 뒤의 본문까지 움직일 수 있다.
         입력칸이 보이는 영역을 벗어난 만큼만 모달 내부 스크롤을 조정한다. */
      const scroller = el.closest('.settings-body') || modal;
      const er = el.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      const top = sr.top + 16;
      const bottom = Math.min(sr.bottom, window.visualViewport
        ? window.visualViewport.height : window.innerHeight) - 16;
      if (er.bottom > bottom) scroller.scrollTop += er.bottom - bottom;
      else if (er.top < top) scroller.scrollTop -= top - er.top;
    }, 300);
  });

  /* Do not reset the document on blur. That used to send a scrolled ledger to
     the top whenever an edit modal closed. The edit-return anchor above handles
     Safari's keyboard/layout adjustment without discarding the user's place. */
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
    if (window.gagyebu && window.gagyebu.platform) return '데스크톱 앱에서는 폰 알림을 쓰지 않아요. 아이폰 홈 화면 앱에서 켜주세요.';
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

  function language() {
    return I18n.lang === 'en' ? 'en' : 'ko';
  }

  function pack(sub, member) {
    const j = sub.toJSON();
    return {
      endpoint: j.endpoint, keys: j.keys, member: member || '',
      lang: language(), at: new Date().toISOString()
    };
  }

  /* Upgrade an old subscription in place and keep device-local metadata current.
     The endpoint and keys stay untouched, so this does not prompt or resubscribe. */
  function refreshMetadata(member) {
    const sub = data && data.settings && data.settings.pushSub;
    if (!sub) return false;
    const lang = language();
    const name = member || '';
    if (sub.lang === lang && sub.member === name) return false;
    sub.lang = lang;
    sub.member = name;
    return true;
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
    s.pushSub = pack(sub, ME());
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
    return data.settings.pushPrefs || { entry: true, settle: true, fixed: true, update: true };
  }
  function setPrefs(p) {
    data.settings.pushPrefs = p;
    markMeta('pushSubs');
    saveNowIfPossible();
    scheduleSync();
  }

  return {
    supported, isIOS, isStandalone, blockedReason, current, enable, disable,
    prefs, setPrefs, refreshMetadata
  };
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
  $('#pushOnEntry').checked = p.entry !== false;
  $('#pushOnSettle').checked = p.settle !== false;
  $('#pushOnFixed').checked = p.fixed !== false;
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
  ['Entry', 'Settle', 'Fixed', 'Update'].forEach((k) => {
    $('#pushOn' + k).addEventListener('change', () => {
      Push.setPrefs({
        entry: $('#pushOnEntry').checked, settle: $('#pushOnSettle').checked,
        fixed: $('#pushOnFixed').checked, update: $('#pushOnUpdate').checked
      });
    });
  });
}

/* 사람이 직접 적어 넣은 말은 번역하지 않는다 (분류·결제수단·두 사람 이름) */
/* 앱이 처음 넣어준 이름들 — 문장 중간에 섞여 있어도 번역해도 안전하다 */
function stockNames() {
  return [
    ...defaultCategories().expense.map((c) => c.name),
    ...defaultCategories().income.map((c) => c.name),
    ...defaultMethods().map((m) => m.name)
  ];
}

function userWords() {
  const s = (data && data.settings) || {};
  const cats = s.categories || {};
  /* 앱이 처음 넣어준 이름은 번역해도 된다 (영어 화면에 한글이 남지 않게).
     사용자가 직접 만들거나 바꾼 이름만 그대로 둔다. */
  const stock = new Set([
    ...defaultCategories().expense.map((c) => c.name),
    ...defaultCategories().income.map((c) => c.name),
    ...defaultMethods().map((m) => m.name)
  ]);
  return [
    ...(cats.expense || []).flatMap((c) => [c.name, c.nameKo, c.nameEn]),
    ...(cats.income || []).flatMap((c) => [c.name, c.nameKo, c.nameEn]),
    ...(s.methods || []).map((m) => m.name),
    ...(s.members || []), s.memberName, s.partnerName,
    ...(s.goal && s.goal.name ? [s.goal.name] : []),
    ...(s.recurring || []).map((r) => r.memo)
  ].filter(Boolean).filter((n) => !stock.has(n));
}


/* 분류는 bilingual label로 표시하므로 stable name을 바꾸지 않는다.
   영어 첫 실행에서는 기본 결제수단 이름만 기존 동작을 유지한다. */
function seedNamesForLang() {
  if (I18n.lang !== 'en') return;
  if (data.entries.length) return;                 // 이미 쓰던 가계부면 건드리지 않는다
  const en = (n) => I18n.t(n);
  (data.settings.methods || []).forEach((m) => { m.name = en(m.name); });
}

/* ==================== 시작 ==================== */
markDesktopChrome();
trackKeyboard();
bindPush();
bindUpdateBar();
/* Update prompts and install metadata need the saved language setting. Waiting
   for init avoids briefly (or permanently, on a fast response) showing the
   Korean update copy on an English-configured device. */
init().then(() => {
  setupServiceWorker();
  checkDesktopUpdate();
  setInterval(checkDesktopUpdate, 6 * 60 * 60 * 1000);
});
