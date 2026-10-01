/* ==================== 내 가계부 (개인용) ==================== */

/* 분류 색 — 0번은 회색(기타). dataviz 검증 통과 팔레트 */
const PALETTE = {
  light: ['#8d8480', '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark:  ['#948a85', '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
};
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const SAVE_CAT = '저축';
const FIXED_CAT = '고정지출';
const REQUIRED_CATEGORY_KEYS = new Set(['savings', 'fixed', 'other']);

function defaultCategories() {
  return {
    /* slot: 색 (1~8 이 서로 다른 색, 0 은 회색). 기본 분류를 8개로 맞춰 도넛 색이 겹치지 않게 한다.
       tip: 이 분류로 입력하면 팁 계산기가 나온다.
       name 은 예전 내역·카드 적립률이 참조하는 호환용 키라 바꾸지 않고,
       nameKo/nameEn 만 화면 언어에 맞춰 보여준다. */
    expense: [
      { key: 'food', name: '식비', nameKo: '식비', nameEn: 'Food', emoji: '🍚', slot: 1, tip: true },
      { key: 'cafe', name: '카페·간식', nameKo: '카페·간식', nameEn: 'Cafe & snacks', emoji: '☕', slot: 2, tip: true },
      { key: 'groceries', name: '장보기·마트', nameKo: '장보기·마트', nameEn: 'Groceries', emoji: '🛒', slot: 3 },
      { key: 'transport', name: '교통·차량', nameKo: '교통·차량', nameEn: 'Transport', emoji: '🚗', slot: 4 },
      { key: 'leisure', name: '문화·여가', nameKo: '문화·여가', nameEn: 'Fun & leisure', emoji: '🎬', slot: 5, tip: true },
      { key: 'savings', name: SAVE_CAT, nameKo: SAVE_CAT, nameEn: 'Savings', emoji: '🐷', slot: 6 },
      { key: 'fixed', name: FIXED_CAT, nameKo: FIXED_CAT, nameEn: 'Fixed costs', emoji: '🔁', slot: 7 },
      { key: 'shopping', name: '쇼핑·미용', nameKo: '쇼핑·미용', nameEn: 'Shopping & beauty', emoji: '🛍️', slot: 8 },
      { key: 'other', name: '기타', nameKo: '기타', nameEn: 'Other', emoji: '📦', slot: 0 }
    ],
    income: [
      { key: 'salary', name: '월급', nameKo: '월급', nameEn: 'Salary', emoji: '💰', slot: 1 },
      { key: 'allowance', name: '용돈', nameKo: '용돈', nameEn: 'Allowance', emoji: '🎁', slot: 5 },
      { key: 'side-income', name: '부수입', nameKo: '부수입', nameEn: 'Side income', emoji: '💵', slot: 3 },
      { key: 'other', name: '기타', nameKo: '기타', nameEn: 'Other', emoji: '📦', slot: 0 }
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
    lang: 'auto',            // 'auto' | 'ko' | 'en'
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
    linkShareVersion: 0,     // 내 몫 계산 방식 마이그레이션 버전 (이 기기 전용)
    linkShareMetaKey: '',    // 비율·정액 규칙이 바뀌면 과거 내역도 다시 계산
    metaTs: null,            // 설정 항목별로 마지막에 바꾼 시각
    metaUpdatedAt: null,
    metaDirty: false,
    categoryNamesVersion: 0  // 두 언어 분류명 마이그레이션 완료 여부 (기기별)
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
let filters = { q: '', category: '', method: '' };
let selectedDay = null;
let methodHistoryId = null;
let methodHistoryReturnView = 'cards';
let methodHistoryReturnPosition = null;
let editingId = null;
let draft = null;
let setDraftCats = null;
let editingCategory = null;
let categoryDrag = null;
let categoryMigrationPending = false;
let setDraftRecur = null;
let editingRecurringId = null;
let confirmCb = null;
let syncTimer = null;
let toastTimer = null;
/* 내역을 수정하는 동안 뒤의 화면이 다시 그려져도, 누르기 전에
   보던 행이 같은 화면 위치에 남도록 한다. 모달 내부의 스크롤과는 다른,
   본문(window) 스크롤의 돌아갈 자리이다. */
let viewScrollReturn = null;
let viewScrollToken = 0;
let statsSelectionMonth = curMonth;
let statsSelectedCategories = new Set();

/* ==================== 유틸 ==================== */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }));

function currentViewStateKey() {
  return JSON.stringify({
    view, curMonth, selectedDay, methodHistoryId,
    q: filters.q, category: filters.category, method: filters.method
  });
}

function pageScrollTop() {
  return Number(window.scrollY
    || (document.scrollingElement && document.scrollingElement.scrollTop)
    || document.documentElement.scrollTop || 0);
}

/* 재렌더링하면 행 위쪽의 요약·필터 높이가 바뀐 수 있어 scrollY 하나만으로는
   보던 행이 좀씩 밀린다. 가능하면 행을 식별해 화면 위에서의 위치까지 기억한다. */
function scrollAnchorFor(el) {
  if (!el || !el.closest) return null;
  const row = el.closest('[data-id], [data-payedit], [data-pay]');
  if (!row) return null;
  for (const attr of ['data-id', 'data-payedit', 'data-pay']) {
    if (row.hasAttribute(attr)) {
      return { attr, value: row.getAttribute(attr), top: row.getBoundingClientRect().top };
    }
  }
  return null;
}

function findScrollAnchor(anchor) {
  if (!anchor) return null;
  return [...document.querySelectorAll(`[${anchor.attr}]`)]
    .find((el) => el.getAttribute(anchor.attr) === anchor.value) || null;
}

function rememberViewScroll(modalId, sourceEl) {
  viewScrollToken++;
  viewScrollReturn = {
    modalId,
    stateKey: currentViewStateKey(),
    scrollTop: pageScrollTop(),
    anchor: scrollAnchorFor(sourceEl)
  };
}

/* 수정 중 달·탭·검색조건이 달라졌다면 이전 좌표는 다른 화면의 값이다.
   그런 경우에는 오래된 위치로 억지로 돌리지 않는다. */
function restoreViewScroll(modalId) {
  const saved = viewScrollReturn;
  if (!saved || (modalId && saved.modalId !== modalId)) return;
  viewScrollReturn = null;
  if (saved.stateKey !== currentViewStateKey()) return;
  const token = ++viewScrollToken;

  const restore = () => {
    if (token !== viewScrollToken || saved.stateKey !== currentViewStateKey()) return;
    const anchor = findScrollAnchor(saved.anchor);
    if (anchor && Number.isFinite(saved.anchor.top)) {
      const delta = anchor.getBoundingClientRect().top - saved.anchor.top;
      if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
    } else {
      const scrollEl = document.scrollingElement || document.documentElement;
      window.scrollTo(0, Math.min(saved.scrollTop,
        Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight)));
    }
  };

  /* innerHTML 교체와 모달 폐기가 반영된 뒤 복원한다. iOS에서는 키보드가
     닫히는 도중 한 번 더 화면을 밀 수 있어 짧게 후속 보정한다. */
  requestAnimationFrame(() => requestAnimationFrame(restore));
  const vv = window.visualViewport;
  const onResize = () => requestAnimationFrame(restore);
  if (vv) vv.addEventListener('resize', onResize);
  setTimeout(() => {
    if (vv) vv.removeEventListener('resize', onResize);
    restore();
  }, 240);
}

function closeModal(id) {
  const modal = $('#' + id);
  if (modal) modal.classList.add('hidden');
  restoreViewScroll(id);
}

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
  const ampm = h < 12 ? (I18n.lang === 'en' ? 'AM' : '오전')
    : (I18n.lang === 'en' ? 'PM' : '오후');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return I18n.lang === 'en' ? `${h12}:${pad2(m)} ${ampm}` : `${ampm} ${h12}:${pad2(m)}`;
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

function catIn(categories, type, name) {
  const list = (categories && categories[type]) || [];
  return list.find((c) => c.name === name || c.nameKo === name || c.nameEn === name) || null;
}
function catOf(type, name) { return catIn(data.settings.categories, type, name); }
function catLabel(c, lang = I18n.lang) {
  if (!c) return '';
  return (lang === 'en' ? (c.nameEn || c.nameKo) : (c.nameKo || c.nameEn)) || c.name || '';
}
function categoryLabel(type, name) {
  return catLabel(catOf(type, name)) || name || '';
}
function canonicalCategory(type, name, fallback = '') {
  const c = catOf(type, name);
  return c ? c.name : (name || fallback);
}

/* 단어 중간의 같은 글자는 기본 부분 검색으로, "ㅍㅋ" 같은 한글
   초성은 각 음절의 첫 자음을 뽑아서 찾는다. */
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
function draftCategoryLabel(type, name) {
  return catLabel(catIn(setDraftCats || data.settings.categories, type, name)) || name || '';
}
function categoryKeyFor(key, fallback) {
  const c = (data.settings.categories.expense || []).find((x) => x.key === key);
  return c ? c.name : fallback;
}
function isCategoryKey(type, name, key) {
  const c = catOf(type, name);
  return !!(c && c.key === key);
}

/* 예전 데이터에는 name 하나만 있다. 기본 분류는 양쪽 이름을 정확히 복원하고,
   사용자가 만든 분류는 기존 이름을 두 언어의 안전한 폴백으로 둔다. name 자체는
   내역과 카드 적립률의 참조 키이므로 절대 바꾸지 않는다. */
function migrateCategoryNames(categories) {
  if (!categories) return false;
  const defs = defaultCategories();
  let changed = false;
  ['expense', 'income'].forEach((type) => {
    if (!Array.isArray(categories[type]) || !categories[type].length) {
      categories[type] = JSON.parse(JSON.stringify(defs[type]));
      changed = true;
    }
    categories[type].forEach((c) => {
      const values = [c.name, c.nameKo, c.nameEn].filter(Boolean);
      const d = defs[type].find((x) => c.key === x.key
        || values.includes(x.name) || values.includes(x.nameKo) || values.includes(x.nameEn));
      if (!c.name) { c.name = (c.nameKo || c.nameEn || '').trim(); changed = true; }
      if (!c.nameKo) { c.nameKo = d ? d.nameKo : c.name; changed = true; }
      if (!c.nameEn) { c.nameEn = d ? d.nameEn : c.name; changed = true; }
      if (d && !c.key) { c.key = d.key; changed = true; }
    });
  });
  return changed;
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

/* 결제수단별 조회에서 쓰는 특수 묶음. 삭제한 결제수단은 원래 id가 내역에
   남아 있으므로 빠뜨리지 않고 한 묶음으로 보여준다. */
const METHOD_NONE = '__method_none__';
const METHOD_RETIRED = '__method_retired__';
function methodRefMatches(id, ref) {
  if (id === METHOD_NONE) return !ref;
  if (id === METHOD_RETIRED) return !!ref && !methodOf(ref);
  return ref === id;
}
function entryMatchesMethod(e, id) {
  if (!e) return false;
  if (e.type === 'cardpay') {
    /* '결제수단 없음'에는 출금 계좌를 생략한 모든 카드값 기록을 섞지 않는다.
       반면 삭제된 카드는 대상/출금 어느 쪽이든 해당하면 복구 가능한 기록으로 보인다. */
    if (id === METHOD_NONE) return false;
    return methodRefMatches(id, e.method) || methodRefMatches(id, e.from);
  }
  return (e.type === 'expense' || e.type === 'income') && methodRefMatches(id, e.method);
}
function methodHistoryInfo(id) {
  const m = methodOf(id);
  if (m) return { id, name: m.name, emoji: m.emoji || (isCreditM(m) ? '💳' : '💵'), method: m };
  if (id === METHOD_NONE) return { id, name: '결제수단 없음', emoji: '❔', method: null };
  return { id, name: '삭제된 결제수단', emoji: '🗑️', method: null };
}
function methodRate(m, category) {
  if (!m) return 0;
  const c = catOf('expense', category);
  /* Prefer the immutable storage key over legacy localized aliases when both
     remain in an older reward-rate map. */
  const keys = [...new Set([c && c.name, category, c && c.nameKo, c && c.nameEn].filter(Boolean))];
  const key = keys.find((k) => m.rates && m.rates[k] != null && m.rates[k] !== '');
  const r = key && m.rates[key];
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
  return Math.abs(Math.round(n)).toLocaleString(I18n.lang === 'en' ? 'en-US' : 'ko-KR');
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

/* 커플 가계부 복사본은 실제 카드 청구액(amount)과 내 최종 부담액이 다를 수 있다.
   월 지출·예산·달력·통계는 personalAmount 를 쓰고, 카드/계좌 잔액과 카드 상세
   내역은 계속 amount 를 써야 실제 명세서와 맞는다. 0도 유효한 값이다
   (정산 송금·수금은 소비 통계에서 제외). */
function reportAmount(e) {
  if (!e || e.reportExcluded) return 0;
  if (e.fromCouple && e.personalAmount !== null && e.personalAmount !== ''
      && Number.isFinite(Number(e.personalAmount))) return Number(e.personalAmount);
  return Number(e.amount) || 0;
}
function reportTip(e) {
  if (!e || e.reportExcluded) return 0;
  if (e.fromCouple && e.personalTip !== null && e.personalTip !== ''
      && Number.isFinite(Number(e.personalTip))) return Number(e.personalTip);
  return Number(e.tip) || 0;
}

/* 커플 원본을 개인 앱에서 직접 고치면 이후 원본 동기화를 끊고, 그 순간부터
   평범한 개인 내역처럼 계산한다. 예전 personalAmount 가 남으면 수정한 총액과
   월 지출이 달라지므로 계산 전용 필드도 함께 걷어낸다. */
function detachCoupleCopy(e) {
  if (!e || !e.fromCouple) return;
  e.linkDetached = true;
  ['personalAmount', 'personalTip', 'reportExcluded', 'couplePayer', 'coupleSplit',
    'coupleMethod', 'coupleFixed', 'coupleTransfer'].forEach((k) => delete e[k]);
}

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

function hasOpeningBaseline(m) {
  return !!(m && m.openingBaseline !== null && m.openingBaseline !== ''
    && Number.isFinite(Number(m.openingBaseline)));
}

/* 결제수단의 잔액 시작점. 구버전의 opening/openingDate 도 그대로 읽는다.
   openingSet 으로 0원/$0 시작점과 '설정 안 함'을 구분한다. */
function methodOpening(m) {
  if (!m || m.openingSet === false) return null;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(m.openingDate || '');
  const explicit = m.openingSet === true;
  const legacy = m.openingSet == null && Number(m.opening) > 0 && validDate;
  if ((!explicit && !legacy) || !validDate) return null;
  const baselineReady = hasOpeningBaseline(m);
  return {
    amount: Number(m.opening) || 0,
    date: m.openingDate,
    before: m.openingBefore === 'include' ? 'include' : 'exclude',
    baseline: baselineReady ? Number(m.openingBaseline) : 0,
    baselineReady
  };
}

/* 기존 의미를 보존한다: 시작 금액은 기준일 '하루 마감' 잔액이고,
   기본값은 그 다음날부터 오늘까지의 내역만 센다. 사용자가 과거 변경 반영을
   고르면 기준점을 저장한 뒤 추가·수정·삭제된 과거 내역의 차이만 함께 센다. */
function balanceEntryFilter(m) {
  const start = methodOpening(m);
  const today = todayStr();
  return (e) => !!(e && e.date && e.date <= today
    && (!start || start.before === 'include' || e.date > start.date));
}

/* 기준일 이전 내역이 잔액에 미치는 부호까지 합친 값.
   기준점을 저장할 때 이 값을 스냅샷으로 남기면, 이미 시작 금액에 들어 있던
   과거 기록은 다시 세지 않고 나중에 바뀐 차이만 정확히 반영할 수 있다. */
function historicalBalanceContribution(m, cutoff) {
  if (!m || !cutoff) return 0;
  const rows = liveEntries().filter((e) => e.date && e.date <= cutoff);
  let total = 0;
  if (isCreditM(m)) {
    rows.forEach((e) => {
      if (e.method !== m.id) return;
      if (e.type === 'expense') total += Number(e.amount) || 0;
      else if (e.type === 'income' || e.type === 'cardpay') total -= Number(e.amount) || 0;
    });
  } else {
    rows.forEach((e) => {
      if (e.method === m.id && e.type === 'income') total += Number(e.amount) || 0;
      else if (e.method === m.id && e.type === 'expense') total -= Number(e.amount) || 0;
      else if (e.from === m.id && e.type === 'cardpay') total -= Number(e.amount) || 0;
    });
  }
  return roundMoney(total);
}

function historyDelta(m, start) {
  if (!start || start.before !== 'include' || !start.baselineReady) return 0;
  return roundMoney(historicalBalanceContribution(m, start.date) - start.baseline);
}

/* v1.10.0 개발판에서 먼저 만든 기준점에도 스냅샷을 한 번 채운다.
   구버전의 opening/openingDate 만 있는 자료는 사용자가 다시 저장할 때 전환한다. */
function migrateOpeningBaselines() {
  let changed = false;
  methods().forEach((m) => {
    const start = methodOpening(m);
    if (m.openingSet !== true || !start || hasOpeningBaseline(m)) return;
    m.openingBaseline = historicalBalanceContribution(m, start.date);
    changed = true;
  });
  return changed;
}

/* 다른 개인 동기화 원장에 처음 연결하거나 원장을 바꾸면 기존 로컬 기준 합계는
   그 원격 내역을 반영하지 못한 값이다. methods 타임스탬프는 건드리지 않고
   비워 두어 첫 pull 뒤 합쳐진 원장으로 다시 확정한다. */
function invalidateOpeningBaselines() {
  let changed = false;
  methods().forEach((m) => {
    if (m.openingSet !== true || !hasOpeningBaseline(m)) return;
    m.openingBaseline = null;
    changed = true;
  });
  return changed;
}

function openingLabel(start) {
  if (!start) return '';
  if (I18n.lang === 'en') {
    const detail = start.before !== 'include' ? 'after date only'
      : (start.baselineReady ? 'later history changes included' : 'later history changes apply after sync');
    return `${start.date} end-of-day · ${detail}`;
  }
  const detail = start.before !== 'include' ? '다음날부터'
    : (start.baselineReady ? '과거 변경 반영' : '동기화 후 과거 변경 반영');
  return `${start.date} 마감 기준 · ${detail}`;
}

/* 신용카드 — 갚아야 할 돈 */
function cardDebt(m) {
  if (m.openingSet === false) return null;
  const balanceStart = methodOpening(m);
  const opening = balanceStart ? balanceStart.amount : 0;
  const included = (e) => !!(e && e.date && e.date <= todayStr()
    && (!balanceStart || e.date > balanceStart.date));
  const touched = liveEntries().some((e) => e.method === m.id);
  if (!balanceStart && !touched) return null;
  const spent = ledger()
    .filter((e) => e.type === 'expense' && e.method === m.id && included(e))
    .reduce((s, e) => s + e.amount, 0);
  const refunded = ledger()
    .filter((e) => e.type === 'income' && e.method === m.id && included(e))
    .reduce((s, e) => s + e.amount, 0);
  const paid = cardPays().filter((e) => e.method === m.id && included(e))
    .reduce((s, e) => s + e.amount, 0);
  const priorDelta = historyDelta(m, balanceStart);
  const rawLeft = roundMoney(opening + spent - refunded - paid + priorDelta);
  return {
    opening, balanceStart, spent, refunded, paid, priorDelta, rawLeft,
    left: Math.max(0, rawLeft)
  };
}

/* 현금·체크카드 — 남아있는 돈
   시작 금액에서 쓴 돈과 카드값 갚은 돈을 빼고, 들어온 돈을 더한다. */
function cashLeft(m) {
  if (m.openingSet === false) return null;
  const balanceStart = methodOpening(m);
  const opening = balanceStart ? balanceStart.amount : 0;
  const included = (e) => !!(e && e.date && e.date <= todayStr()
    && (!balanceStart || e.date > balanceStart.date));
  const mine = (e) => e.method === m.id && included(e);
  const touched = liveEntries().some((e) => e.method === m.id || e.from === m.id);
  if (!balanceStart && !touched) return null;
  const spent = ledger().filter((e) => e.type === 'expense' && mine(e))
    .reduce((s, e) => s + e.amount, 0);
  const earned = ledger().filter((e) => e.type === 'income' && mine(e))
    .reduce((s, e) => s + e.amount, 0);
  const paidOut = cardPays().filter((e) => e.from === m.id && included(e))
    .reduce((s, e) => s + e.amount, 0);
  const priorDelta = historyDelta(m, balanceStart);
  const left = roundMoney(opening + earned - spent - paidOut + priorDelta);
  return { opening, balanceStart, spent, earned, paidOut, priorDelta, left };
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
  const have = roundMoney(assets.reduce((s, r) => s + r.left, 0));
  const owe = roundMoney(debts.reduce((s, r) => s + r.left, 0));
  const owedTotal = roundMoney(debts.reduce((s, r) =>
    s + Math.max(0, r.opening + r.spent - r.refunded + r.priorDelta), 0));
  const paid = roundMoney(debts.reduce((s, r) => s + r.paid, 0));
  return { assets, debts, have, owe, net: roundMoney(have - owe), owedTotal, paid };
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
  el.textContent = I18n.t(msg);
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
            category: canonicalCategory('expense', r.category,
              categoryKeyFor('fixed', FIXED_CAT)),
            memo: r.memo || '',
            method: r.method || '',      // 그 카드 잔액에도 반영되도록
            recurringId: r.id,
            recurringMonth: m,
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
  categoryMigrationPending = Number(data.settings.categoryNamesVersion || 0) < 1;
  const categoriesMigrated = migrateCategoryNames(data.settings.categories);
  let categoryMigrationSaved = categoriesMigrated;
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
    const d = defCats.find((x) => x.key === c.key || x.name === c.name || x.nameEn === c.name);
    if (c.tip === undefined) c.tip = !!(d && d.tip);
  });

  I18n.setLang(data.settings.lang || 'auto', userWords, stockNames());
  const pushLocaleMigrated = Push.refreshMetadata('나');
  seedNamesForLang();
  Sync.configure(data.settings);
  if (categoryMigrationPending && !Sync.isConfigured()) {
    markMeta('categories');
    data.settings.categoryNamesVersion = 1;
    categoryMigrationPending = false;
    categoryMigrationSaved = true;
  }
  Sync.onStatus(renderSyncStatus);
  bindStatic();
  bindLock();
  Lock.start();          // 잠금이 켜져 있으면 화면을 덮는다

  /* 반복 지출로 생길 과거 내역까지 만든 다음 최초 기준 합계를 잡는다.
     동기화가 연결돼 있으면 원격 과거 내역을 먼저 받은 뒤 runSync 에서 확정한다. */
  const recurringAdded = applyRecurring();
  const openingMigrated = Sync.isConfigured() ? false : migrateOpeningBaselines();
  if (openingMigrated) markMeta('methods');
  if (recurringAdded || openingMigrated || categoryMigrationSaved || pushLocaleMigrated) Store.save(data);

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
  let linkChanged = false;
  /* 먼저 내 기기끼리 합쳐야 다른 기기에서 직접 고친 커플 복사본(linkDetached)을
     받은 뒤 원본을 확인할 수 있다. 그 다음 커플 원본을 가져오고, 새로 들어온 게
     있으면 한 번 더 올려 같은 차례에 다른 개인 기기로도 보낸다. */
  if (Sync.isConfigured()) {
    const r = await Sync.syncNow(data);
    if (r.changed) changed = true;
    /* 최신 원격 설정을 받은 다음 두 언어 이름을 붙인다. 이렇게 해야 첫 업그레이드
       기기가 오래된 로컬 설정으로 다른 기기의 최신 분류를 덮어쓰지 않는다. */
    if (Sync.getStatus().state === 'ok') {
      const migrated = migrateCategoryNames(data.settings.categories);
      if (categoryMigrationPending || migrated) {
        markMeta('categories');
        data.settings.categoryNamesVersion = 1;
        categoryMigrationPending = false;
        changed = true;
        const pushed = await Sync.syncNow(data);
        if (pushed.changed) changed = true;
      }
    }
  }
  try {
    if (Link.cfgOf(data.settings)) {
      const r = await Link.pull(data);
      if (r.changed) { changed = true; linkChanged = true; }
    }
  } catch (e) {
    console.log('커플 가계부 가져오기 실패:', e.message);
  }
  if (linkChanged && Sync.isConfigured()) {
    const r = await Sync.syncNow(data);
    if (r.changed) changed = true;
  }
  if (changed) applyRecurring();
  /* 동기화가 끝난 뒤에만 미확정 기준 합계를 채운다. Link.pull 로 들어온
     과거 커플 내역까지 포함한 상태라 업그레이드 직후 잔액이 튀지 않는다. */
  const openingMigrated = Sync.isConfigured() && Sync.getStatus().state === 'ok'
    ? migrateOpeningBaselines() : false;
  if (openingMigrated) markMeta('methods');
  /* 설정 화면이 열린 채 동기화돼도 다른 초안 필드는 보존하고, 방금 확정된
     같은 범위의 baseline 만 초안에 옮겨 다음 저장에서 null 로 되돌아가지 않게 한다. */
  if (openingMigrated && Array.isArray(setDraftMethods)) {
    setDraftMethods.forEach((draft) => {
      const saved = methodOf(draft.id);
      if (!saved || draft.openingSet !== true || saved.openingSet !== true
          || draft.type !== saved.type || draft.openingDate !== saved.openingDate) return;
      if (!hasOpeningBaseline(draft) && hasOpeningBaseline(saved)) {
        draft.openingBaseline = Number(saved.openingBaseline);
      }
    });
  }
  Store.saveNow(data);
  if (changed || openingMigrated) render();
  if (openingMigrated) scheduleSync();
}

/* ==================== 이벤트 ==================== */

/*
 * 폼이 <form> 태그를 쓰지 않아도 현재 열린 편집 창에서 Enter로 저장할 수
 * 있게 한다. 한글 IME가 글자 조합을 끝내는 Enter는 저장으로 처리하지 않는다.
 * Ctrl/Cmd+A는 현재 필드 전체 선택으로 맞추고, C·X·V·Z·Shift+Z 등
 * 나머지 편집 단축키는 Chromium/Safari/Electron의 표준 동작을 그대로 쓴다.
 */
function enterSaveButton(target) {
  if (!target || !target.closest) return null;

  if (target.closest('#lockScreen:not(.hidden)')) return $('#btnLockOk');

  const modal = target.closest('.modal-backdrop:not(.hidden)');
  if (!modal) return null;
  /* 겹쳐 열린 모달 중 가장 위의 창만 Enter를 받는다. 확인창이 떠 있는데
     iPhone이 뒤 입력칸의 포커스를 유지해도 가려진 폼은 저장되지 않는다. */
  const visibleModals = [...document.querySelectorAll('.modal-backdrop:not(.hidden)')];
  if (modal !== visibleModals[visibleModals.length - 1]) return null;
  const direct = {
    entryModal: 'btnSaveEntry',
    categoryModal: 'btnCategorySave',
    methodModal: 'btnMethodSave',
    payModal: 'btnPaySave'
  }[modal.id];
  if (direct) return $('#' + direct);

  if (modal.id === 'settingsModal') {
    /* 설정 안의 작은 편집기는 전체 설정 저장보다 먼저 처리한다. */
    if (target.closest('.recur-add')) return $('#btnRecAdd');
    if (target.id === 'methodAdd') return $('#btnMethodAdd');
    if (target.closest('#lockSetup:not(.hidden)')) return $('#btnLockSave');
    if (target.closest('#linkSetup:not(.hidden)')) return $('#btnLinkSave');
    return $('#btnSaveSettings');
  }
  return null;
}

function onEnterSave(ev) {
  if (ev.key !== 'Enter' || ev.defaultPrevented || ev.repeat) return;
  /* 조합 중 Enter와 iOS/구형 WebKit의 IME keyCode를 둘 다 막는다. */
  if (ev.isComposing || ev.keyCode === 229) return;
  if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return;

  const target = ev.target;
  if (!target || !target.matches) return;
  /* 날짜·시간·선택 컨트롤과 여러 줄 필드의 기본 키 동작은 보존한다. */
  if (!target.matches('input:not([type]), input[type="text"], input[type="search"], input[type="password"], input[type="email"], input[type="url"], input[type="tel"], input[type="number"]')) return;

  const button = enterSaveButton(target);
  if (!button || button.disabled || button.classList.contains('hidden')) return;
  ev.preventDefault();
  button.click();
}

function onEditableSelectAll(ev) {
  if (String(ev.key).toLowerCase() !== 'a' || !(ev.ctrlKey || ev.metaKey)
      || ev.altKey || ev.shiftKey) return;
  const target = ev.target;
  if (!target || !target.matches) return;
  let selected = false;
  if (target.matches('input:not([type]), input[type="text"], input[type="search"], input[type="password"], input[type="email"], input[type="url"], input[type="tel"], input[type="number"], textarea')) {
    try { target.select(); selected = true; } catch (e) { /* 지원하지 않으면 기본 동작에 맡긴다. */ }
  } else if (target.isContentEditable) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(target);
    selection.removeAllRanges();
    selection.addRange(range);
    selected = true;
  }
  /* macOS에서 Ctrl+A는 기본적으로 줄 맨 앞 이동이므로, 직접 선택한
     편집 필드에서만 기본 동작을 막는다. 복사·붙여넣기·실행 취소는 건드리지 않는다. */
  if (selected) ev.preventDefault();
}

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
    b.addEventListener('click', () => closeModal(b.dataset.close)));
  document.querySelectorAll('.modal-backdrop').forEach((bd) => {
    bd.addEventListener('mousedown', (ev) => { if (ev.target === bd) closeModal(bd.id); });
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && categoryDrag) {
      finishCategoryDrag(true);
      ev.preventDefault();
      return;
    }
    if (ev.key === 'Escape') {
      /* 겹쳐 열린 확인창과 편집창을 한꺼번에 닫지 않고 맨 위 창만 닫는다. */
      const visible = [...document.querySelectorAll('.modal-backdrop:not(.hidden)')];
      const top = visible[visible.length - 1];
      if (top) closeModal(top.id);
    }
  });
  document.addEventListener('keydown', onEnterSave);
  document.addEventListener('keydown', onEditableSelectAll);

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

  /* --- 설정 --- */
  $('#btnGenCode').addEventListener('click', () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = 'ME-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    $('#setCoupleCode').value = code;
  });
  $('#btnSaveSettings').addEventListener('click', () => saveSettings(false));
  $('#btnSyncNow').addEventListener('click', async () => {
    if (saveSettings(true) === false) return;
    if (!Sync.isConfigured()) {
      $('#syncInfo').textContent = I18n.t('URL·키·내 코드를 모두 넣어주세요.');
      return;
    }
    $('#syncInfo').textContent = I18n.t('동기화 중…');
    await runSync();
    const st = Sync.getStatus();
    $('#syncInfo').textContent = st.state === 'ok'
      ? I18n.t('✓ 연결됐어요! 이제 기기끼리 합쳐집니다.')
      : I18n.t('⚠ 실패:') + ' ' + (st.error || I18n.t('연결을 확인해주세요'));
  });

  $('#catManage').addEventListener('click', (ev) => {
    /* 드래그 핸들은 순서 변경전용이다. 핸들에서 끝난 click 이
       편집·삭제·팁 토글로 전파되지 않게 먼저 멈춘다. */
    if (ev.target.closest('[data-catdrag]')) return;
    const tipCat = ev.target.closest('[data-tipcat]');
    if (tipCat) {
      const c = setDraftCats.expense[Number(tipCat.dataset.tipcat)];
      if (c) c.tip = !c.tip;
      renderCatManage(); return;
    }
    const edit = ev.target.closest('[data-catedit]');
    if (edit) {
      openCategoryModal(edit.dataset.type, Number(edit.dataset.catedit));
      return;
    }
    const del = ev.target.closest('[data-catdel]');
    if (del) {
      const list = setDraftCats[del.dataset.type];
      const c = list[Number(del.dataset.catdel)];
      if (c && REQUIRED_CATEGORY_KEYS.has(c.key)) {
        toast('저축·고정지출·기타 분류는 삭제할 수 없어요');
        return;
      }
      list.splice(Number(del.dataset.catdel), 1);
      renderCatManage(); return;
    }
    const add = ev.target.closest('[data-add]');
    if (add) openCategoryModal(add.dataset.add);
  });
  $('#catManage').addEventListener('pointerdown', beginCategoryDrag);
  $('#catManage').addEventListener('pointermove', updateCategoryDrag);
  $('#catManage').addEventListener('pointerup', (ev) => {
    if (categoryDrag && ev.pointerId === categoryDrag.pointerId) finishCategoryDrag(false);
  });
  $('#catManage').addEventListener('pointercancel', (ev) => {
    if (categoryDrag && ev.pointerId === categoryDrag.pointerId) finishCategoryDrag(true);
  });
  $('#catManage').addEventListener('lostpointercapture', () => {
    /* releasePointerCapture() 로 발생한 이벤트는 finish 안에서 이미 정리된다. */
    if (categoryDrag) finishCategoryDrag(true);
  });
  $('#catManage').addEventListener('keydown', onCategoryDragKey);
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
  $('#inPreSpentDate').addEventListener('change', renderMethodOpeningHint);
  $('#inIncludeBeforeStart').addEventListener('change', renderMethodOpeningHint);
  $('#rateGrid').addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-rate]');
    if (el) methodDraftRates[el.dataset.rate] = el.value;
  });

  $('#btnRecAdd').addEventListener('click', saveRecurringForm);
  $('#btnRecCancel').addEventListener('click', resetRecurringForm);
  $('#recurList').addEventListener('click', (ev) => {
    const edit = ev.target.closest('[data-recedit]');
    if (edit) { beginRecurringEdit(edit.dataset.recedit); return; }
    const del = ev.target.closest('[data-recdel]');
    if (del) confirmDeleteRecurring(del.dataset.recdel);
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
    const history = ev.target.closest('[data-method-history]');
    if (history) { openMethodHistory(history.dataset.methodHistory, history); return; }
    if (ev.target.closest('[data-method-history-back]')) { closeMethodHistory(); return; }
    const pay = ev.target.closest('[data-pay]');
    if (pay) { openPayModal(pay.dataset.pay, null, pay); return; }
    const payedit = ev.target.closest('[data-payedit]');
    if (payedit) {
      const e = data.entries.find((x) => x.id === payedit.dataset.payedit && x.type === 'cardpay');
      if (e) openPayModal(e.method, e.id, payedit);
      return;
    }
    const paydel = ev.target.closest('[data-paydel]');
    if (paydel) { deletePay(paydel.dataset.paydel, paydel); return; }
    if (ev.target.closest('#btnGoMethods')) { openSettings(); return; }
    const row = ev.target.closest('.entry-row');
    if (row && row.dataset.id) {
      const e = data.entries.find((x) => x.id === row.dataset.id);
      if (e) openEntryModal(e, row);
      return;
    }
    const cell = ev.target.closest('.cal-cell[data-date]');
    if (cell) { selectedDay = selectedDay === cell.dataset.date ? null : cell.dataset.date; renderView(); }
  });
  $('#view').addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ')
        && ev.target.matches('circle[data-stat-category]')) {
      ev.preventDefault();
      ev.target.click();
    }
  });
  $('#view').addEventListener('input', (ev) => {
    /* 검색창을 매 글자마다 새로 만들면 iOS에서 포커스와 한글 IME
       조합이 끊긴다. 입력창은 그대로 두고 결과 영역만 갱신한다. */
    if (ev.target.id === 'fQ') { filters.q = ev.target.value; renderListResults(); }
  });
  $('#view').addEventListener('change', (ev) => {
    if (ev.target.id === 'fCategory') { filters.category = ev.target.value; renderListResults(); }
    if (ev.target.id === 'fMethod') { filters.method = ev.target.value; renderListResults(); }
  });
}

function askConfirm(opt, cb) {
  $('#confirmEmoji').textContent = opt.emoji || '🗑️';
  $('#confirmTitle').textContent = I18n.t(opt.title || '');
  $('#confirmText').innerHTML = I18n.t(opt.text || '');
  $('#btnConfirmOk').textContent = I18n.t(opt.ok || '확인');
  $('#btnConfirmOk').className = 'btn ' + (opt.danger ? 'danger' : 'primary');
  confirmCb = cb;
  $('#confirmModal').classList.remove('hidden');
}

function nextCategorySlot(type) {
  const count = {};
  for (let i = 1; i <= 8; i++) count[i] = 0;
  setDraftCats[type].forEach((c) => { if (c.slot > 0) count[c.slot]++; });
  return Number(Object.keys(count).sort((a, b) => count[a] - count[b] || a - b)[0]);
}

function openCategoryModal(type, index = null) {
  const c = index == null ? null : setDraftCats[type][index];
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
  const nameKo = $('#inCategoryKo').value.trim();
  const nameEn = $('#inCategoryEn').value.trim();
  const emoji = $('#inCategoryEmoji').value.trim() || '🏷️';
  if (!nameKo || !nameEn) {
    toast('한국어 이름과 영어 이름을 모두 넣어주세요');
    (!nameKo ? $('#inCategoryKo') : $('#inCategoryEn')).focus();
    return;
  }
  const norm = (s) => s.trim().toLocaleLowerCase();
  const duplicate = setDraftCats[type].some((c, i) => i !== index
    && ([c.name, c.nameKo, c.nameEn].filter(Boolean).map(norm).includes(norm(nameKo))
      || [c.name, c.nameKo, c.nameEn].filter(Boolean).map(norm).includes(norm(nameEn))));
  if (duplicate) { toast('같은 이름의 분류가 이미 있어요'); return; }

  if (index == null) {
    const cat = { name: nameKo, nameKo, nameEn, emoji, slot: nextCategorySlot(type) };
    if (type === 'expense') cat.tip = false;
    setDraftCats[type].push(cat);
  } else {
    /* name/slot/tip/key 및 앞으로 추가될 속성까지 그대로 둔 채 표시 이름만 고친다. */
    Object.assign(setDraftCats[type][index], { nameKo, nameEn, emoji });
  }
  editingCategory = null;
  $('#categoryModal').classList.add('hidden');
  renderCatManage();
}

function recurringFormHasInput() {
  return !!($('#recDay').value.trim() || $('#recMemo').value.trim()
    || $('#recAmount').value.trim() || editingRecurringId);
}

function saveRecurringForm() {
  const rawDay = $('#recDay').value.trim();
  const day = Number(rawDay);
  const memo = $('#recMemo').value.trim();
  const amount = parseMoneyInput($('#recAmount').value.trim());
  if (!/^\d{1,2}$/.test(rawDay) || day < 1 || day > 31 || !memo || !(amount > 0)) {
    toast('날짜·내용·금액을 모두 넣어주세요');
    if (!/^\d{1,2}$/.test(rawDay) || day < 1 || day > 31) $('#recDay').focus();
    return false;
  }
  const fields = { day, amount, memo, method: $('#recMethod').value || '' };
  if (editingRecurringId) {
    const r = setDraftRecur.find((x) => x.id === editingRecurringId);
    if (!r) { toast('수정할 반복 지출을 찾지 못했어요'); return false; }
    Object.assign(r, fields);                  // id/since/category/active 는 그대로 보존
  } else {
    setDraftRecur.push({
      id: uuid().slice(0, 8), ...fields,
      category: categoryKeyFor('fixed', FIXED_CAT), since: todayStr().slice(0, 7), active: true
    });
  }
  resetRecurringForm();
  return true;
}

function beginRecurringEdit(id) {
  if (editingRecurringId === id) return;
  if (recurringFormHasInput() && saveRecurringForm() === false) return;
  const r = setDraftRecur.find((x) => x.id === id);
  if (!r) return;
  editingRecurringId = id;
  $('#recDay').value = r.day;
  $('#recMemo').value = r.memo || '';
  $('#recAmount').value = formatAmountStr(Number(r.amount) || 0);
  /* 대상 규칙이 삭제된 결제수단을 가리키는 구데이터여도, 그 값을 잃지 않도록
     옵션을 대상 규칙 기준으로 처음부터 다시 만든다. */
  $('#recMethod').innerHTML = '';
  renderRecurList();
  $('#recMethod').value = r.method || '';
  $('#btnRecAdd').textContent = '수정 저장';
  $('#btnRecCancel').classList.remove('hidden');
  $('#recDay').focus();
}

function resetRecurringForm(rerender = true) {
  editingRecurringId = null;
  $('#recDay').value = '';
  $('#recMemo').value = '';
  $('#recAmount').value = '';
  $('#btnRecAdd').textContent = '추가';
  $('#btnRecCancel').classList.add('hidden');
  if (rerender && setDraftRecur) renderRecurList();
}

function confirmDeleteRecurring(id) {
  const r = setDraftRecur.find((x) => x.id === id);
  if (!r) return;
  askConfirm({
    emoji: '🗑️', title: '이 반복 설정을 삭제할까요?',
    text: '이미 자동으로 생성된 내역은 그대로 남고, 앞으로 새 내역만 만들어지지 않아요.',
    ok: '삭제', danger: true
  }, () => {
    setDraftRecur = setDraftRecur.filter((x) => x.id !== id);
    if (editingRecurringId === id) resetRecurringForm(false);
    renderRecurList();
  });
}

/* ==================== 렌더링 ==================== */
function render() {
  $('#monthLabel').textContent = monthLabel(curMonth);
  renderSummary();
  renderView();
}

function renderSummary() {
  const list = monthLedger(curMonth);
  const income = list.filter((e) => e.type === 'income').reduce((s, e) => s + reportAmount(e), 0);
  const expense = list.filter((e) => e.type === 'expense').reduce((s, e) => s + reportAmount(e), 0);
  const net = income - expense;
  const prev = monthLedger(shiftMonth(curMonth, -1))
    .filter((e) => e.type === 'expense').reduce((s, e) => s + reportAmount(e), 0);

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
  else if (view === 'method') renderMethodHistory();
  else renderStats();
}

function openMethodHistory(id, sourceEl = null) {
  if (!id) return;
  if (view !== 'method') {
    methodHistoryReturnView = view;
    const sameLinks = sourceEl
      ? [...document.querySelectorAll('[data-method-history]')]
        .filter((el) => el.dataset.methodHistory === id) : [];
    methodHistoryReturnPosition = {
      view,
      month: curMonth,
      scrollTop: pageScrollTop(),
      methodId: id,
      sourceIndex: Math.max(0, sameLinks.indexOf(sourceEl)),
      sourceTop: sourceEl ? sourceEl.getBoundingClientRect().top : null
    };
  }
  methodHistoryId = id;
  view = 'method';
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  renderView();
  window.scrollTo(0, 0);
}

function closeMethodHistory() {
  const saved = methodHistoryReturnPosition;
  methodHistoryReturnPosition = null;
  const next = ['list', 'calendar', 'stats', 'cards'].includes(methodHistoryReturnView)
    ? methodHistoryReturnView : 'cards';
  view = next;
  methodHistoryId = null;
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.view === next));
  renderView();
  const restore = () => {
    if (!saved || saved.view !== view || saved.month !== curMonth) return;
    const links = [...document.querySelectorAll('[data-method-history]')]
      .filter((el) => el.dataset.methodHistory === saved.methodId);
    const anchor = links[saved.sourceIndex] || links[0];
    if (anchor && Number.isFinite(saved.sourceTop)) {
      window.scrollBy(0, anchor.getBoundingClientRect().top - saved.sourceTop);
    } else {
      window.scrollTo(0, saved.scrollTop);
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(restore));
}

function methodHistoryCountLabel(n) {
  return I18n.lang === 'en' ? `${n} ${n === 1 ? 'entry' : 'entries'}` : `${n}건`;
}

function methodHistoryPayRowHtml(e, selectedId) {
  const isTarget = methodRefMatches(selectedId, e.method);
  const other = isTarget ? methodLabel(e.from) : methodLabel(e.method);
  const title = I18n.t(isTarget ? '카드값 갚음' : '카드값 결제');
  const otherLabel = I18n.t(isTarget ? '출금' : '받는 카드');
  const editLabel = I18n.t('카드값 기록 수정');
  const sub = [
    other ? `${otherLabel} ${other}` : '',
    e.memo || ''
  ].filter(Boolean).join(' · ');
  return `
    <button class="entry-row cardpay-entry" data-payedit="${esc(e.id)}"
            title="${esc(editLabel)}" aria-label="${esc(editLabel)}">
      <span class="entry-emoji cardpay-icon">💳</span>
      <span class="entry-main">
        <span class="entry-title"><span class="t">${title}</span></span>
        <span class="entry-sub">${esc(sub)}</span>
      </span>
      <span class="entry-amt ${isTarget ? 'income' : 'expense'}">−${fmtMoney(e.amount)}</span>
      <span class="entry-edit-mark" aria-hidden="true">✎</span>
    </button>`;
}

/* 현재 상단에서 고른 달의 지출·수입·카드값 기록을 결제수단 하나로 모아 본다.
   카드값은 대상 신용카드와 돈이 빠진 현금/체크카드 양쪽 내역에 모두 나타난다. */
function renderMethodHistory() {
  const id = methodHistoryId;
  if (!id) { closeMethodHistory(); return; }
  const info = methodHistoryInfo(id);
  const rows = liveEntries()
    .filter((e) => e.date && e.date.startsWith(curMonth) && entryMatchesMethod(e, id))
    .sort((a, b) => b.date.localeCompare(a.date) || byTimeDesc(a, b));
  const rowAmount = id === METHOD_NONE ? reportAmount : (e) => Number(e.amount) || 0;
  const expense = rows.filter((e) => e.type === 'expense').reduce((s, e) => s + rowAmount(e), 0);
  const income = rows.filter((e) => e.type === 'income').reduce((s, e) => s + rowAmount(e), 0);
  const paidTo = rows.filter((e) => e.type === 'cardpay' && methodRefMatches(id, e.method))
    .reduce((s, e) => s + e.amount, 0);
  const paidFrom = rows.filter((e) => e.type === 'cardpay' && methodRefMatches(id, e.from))
    .reduce((s, e) => s + e.amount, 0);
  const backLabel = I18n.t(methodHistoryReturnView === 'stats' ? '통계'
    : (methodHistoryReturnView === 'list' ? '내역' : '잔액'));
  const infoLabel = info.method ? info.name : I18n.t(info.name);

  const byDay = {};
  rows.forEach((e) => { (byDay[e.date] = byDay[e.date] || []).push(e); });
  const listHtml = Object.keys(byDay).sort().reverse().map((d) => {
    const dt = new Date(d + 'T00:00:00');
    const es = byDay[d].slice().sort(byTimeDesc);
    return `
      <div class="day-group">
        <div class="day-head">
          <span class="d">${dt.getMonth() + 1}월 ${dt.getDate()}일</span>
          <span class="dow">${DOW[dt.getDay()]}요일</span>
          <span class="tot">${methodHistoryCountLabel(es.length)}</span>
        </div>
        <div class="day-card">${es.map((e) => e.type === 'cardpay'
          ? methodHistoryPayRowHtml(e, id) : entryRowHtml(e, id !== METHOD_NONE)).join('')}</div>
      </div>`;
  }).join('');

  const summary = [
    expense ? `<span><small>지출</small><b class="expense">−${fmtMoney(expense)}</b></span>` : '',
    income ? `<span><small>수입·환불</small><b class="income">+${fmtMoney(income)}</b></span>` : '',
    paidTo ? `<span><small>갚음</small><b class="income">−${fmtMoney(paidTo)}</b></span>` : '',
    paidFrom ? `<span><small>카드값 출금</small><b class="expense">−${fmtMoney(paidFrom)}</b></span>` : ''
  ].filter(Boolean).join('');

  $('#view').innerHTML = `
    <div class="method-history-head">
      <button class="method-history-back" data-method-history-back>‹ ${backLabel}</button>
      <div class="method-history-title">
        <h2>${esc(info.emoji)} ${esc(infoLabel)} ${I18n.t('내역')}</h2>
        <p>${monthLabel(curMonth)} · ${methodHistoryCountLabel(rows.length)}</p>
      </div>
    </div>
    ${summary ? `<div class="method-history-summary">${summary}</div>` : ''}
    ${rows.length ? listHtml : `
      <div class="empty"><div class="big-emoji">🧾</div>이 달에는 이 결제수단 내역이 없어요</div>`}`;
}

/* ---------- 잔액 (가진 돈 · 갚을 돈) ---------- */
function renderCards() {
  const m = moneySummary();
  const hasRetiredHistory = liveEntries().some((e) =>
    (e.method && !methodOf(e.method))
    || (e.type === 'cardpay' && e.from && !methodOf(e.from)));

  if (!m.assets.length && !m.debts.length && !cardPays().length && !hasRetiredHistory) {
    $('#view').innerHTML = `
      <div class="empty">
        <div class="big-emoji">💳</div>
        <p>아직 시작 금액을 넣은 결제수단이 없어요.</p>
        <p class="tiny">${I18n.lang === 'en'
          ? 'Add a <b>starting amount</b> under Settings → Payment methods.<br>Credit cards show what you owe; cash and debit cards show what you hold.'
          : '설정 → 결제수단에서 <b>시작 금액</b> 을 넣어주세요.<br>신용카드는 <b>갚아야 할 잔액</b>, 현금·체크카드는 <b>지금 들어있는 돈</b> 입니다.'}</p>
        <button class="btn primary" id="btnGoMethods">결제수단 설정 열기</button>
      </div>`;
    return;
  }

  const assetHtml = m.assets.map((r) => `
    <button class="bal-row tappable ${r.left < 0 ? 'minus' : ''}"
            data-method-history="${esc(r.method.id)}" title="결제수단 내역 보기">
      <span class="ic">${r.method.emoji || '💵'}</span>
      <span class="nm">${esc(r.method.name)}${r.balanceStart
        ? `<small>${esc(openingLabel(r.balanceStart))}</small>` : ''}</span>
      <span class="amt">${fmtMoney(r.left)}</span>
      <span class="method-history-chevron" aria-hidden="true">›</span>
    </button>`).join('');

  const debtHtml = m.debts.slice().sort((a, b2) => b2.left - a.left).map((r) => {
    const basisTotal = Math.max(0, r.opening + r.spent - r.refunded + r.priorDelta);
    const pct = basisTotal > 0 ? Math.min(100, (r.paid / basisTotal) * 100) : 0;
    const cleared = r.left === 0;
    const priorLabel = I18n.lang === 'en' ? 'earlier changes' : '과거 변경';
    return `
      <div class="debt-card ${cleared ? 'cleared' : ''}">
        <div class="debt-top">
          <span class="ic">${r.method.emoji || '💳'}</span>
          <span class="nm">${esc(r.method.name)}</span>
          <span class="left">${cleared ? '✅ 다 갚았어요' : fmtMoney(r.left)}</span>
        </div>
        <div class="debt-bar"><div style="width:${pct}%"></div></div>
        <div class="debt-sub">
          <span>시작 ${fmtMoney(r.opening)}${r.spent ? ` + 이후 사용 ${fmtMoney(r.spent)}` : ''}${r.refunded ? ` − 수입·환불 ${fmtMoney(r.refunded)}` : ''}${r.priorDelta ? ` ${r.priorDelta > 0 ? '+' : '−'} ${priorLabel} ${fmtMoney(Math.abs(r.priorDelta))}` : ''}</span>
          <span>갚음 ${fmtMoney(r.paid)}</span>
        </div>
        ${r.balanceStart ? `<div class="balance-basis">${esc(openingLabel(r.balanceStart))}</div>` : ''}
        <div class="debt-actions">
          <button class="btn small" data-method-history="${esc(r.method.id)}">내역</button>
          <button class="btn small primary" data-pay="${esc(r.method.id)}">갚기</button>
        </div>
      </div>`;
  }).join('');

  const donePct = m.owedTotal > 0 ? Math.min(100, (m.paid / m.owedTotal) * 100) : 0;
  const paidThisMonth = cardPays()
    .filter((e) => e.date && e.date <= todayStr() && e.date.startsWith(curMonth))
    .reduce((s, e) => s + e.amount, 0);

  const history = cardPays().sort((a, b2) => b2.date.localeCompare(a.date));
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
          <button class="edit" data-payedit="${esc(e.id)}" title="카드값 기록 수정" aria-label="카드값 기록 수정">✎</button>
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
          : `<div class="debt-month tiny">${I18n.lang === 'en'
            ? 'No card payments this month' : '이번 달은 아직 갚은 기록이 없어요'}</div>`}
      </div>
      <div class="debt-list">${debtHtml}</div>` : ''}

    ${hasRetiredHistory ? `
      <h3 class="sec-title">${I18n.t('이전 결제수단')}</h3>
      <div class="bal-list">
        <button class="bal-row tappable" data-method-history="${METHOD_RETIRED}"
                title="${I18n.t('결제수단 내역 보기')}">
          <span class="ic">🗑️</span>
          <span class="nm">${I18n.t('삭제된 결제수단 내역')}</span>
          <span class="method-history-chevron" aria-hidden="true">›</span>
        </button>
      </div>` : ''}

    ${historyHtml}`;
}

/* ---------- 내역 ---------- */
function entryRowHtml(e, showActual = false) {
  const color = catColorOf(e);
  const sign = e.type === 'income' ? '+' : '−';
  const category = categoryLabel(e.type, e.category);
  const title = e.memo || category || '(내용 없음)';
  const personal = reportAmount(e);
  const shown = showActual || e.reportExcluded ? Number(e.amount) || 0 : personal;
  let coupleNote = '';
  if (e.fromCouple && e.coupleTransfer) {
    coupleNote = I18n.lang === 'en' ? 'Settlement · excluded from spending' : '정산 · 지출 통계 제외';
  } else if (e.fromCouple && e.coupleSplit === 'half') {
    const payer = e.couplePayer
      ? (I18n.lang === 'en' ? `paid by ${e.couplePayer}` : `${e.couplePayer} 결제`) : '';
    coupleNote = I18n.lang === 'en'
      ? `My share ${fmtMoney(personal)} · total ${fmtMoney(e.amount)}${payer ? ` · ${payer}` : ''}`
      : `내 몫 ${fmtMoney(personal)} · 전체 ${fmtMoney(e.amount)}${payer ? ` · ${payer}` : ''}`;
  }
  const sub = [fmtTime(e.time), category, methodLabel(e.method), coupleNote,
    reportTip(e) ? '팁 ' + fmtMoney(reportTip(e)) : null].filter(Boolean).join(' · ');
  return `
    <button class="entry-row" data-id="${e.id}" title="${I18n.t('눌러서 수정')}" aria-label="${esc(title)} — ${I18n.t('눌러서 수정')}">
      <span class="entry-emoji" style="background:${color}22">${esc(catEmojiOf(e))}</span>
      <span class="entry-main">
        <span class="entry-title">
          <span class="t">${esc(title)}</span>
          ${e.auto ? '<span class="pill auto">자동</span>' : ''}
          ${e.fromCouple ? '<span class="pill couple">커플</span>' : ''}
          ${e.coupleTransfer ? '<span class="pill transfer">정산</span>' : ''}
        </span>
        <span class="entry-sub">${esc(sub)}</span>
      </span>
      <span class="entry-amt ${e.type}">${sign}${fmtMoney(shown)}</span>
      <span class="entry-edit-mark" aria-hidden="true">✎</span>
    </button>`;
}

function applyFilters(list) {
  return list.filter((e) => {
    if (filters.category && canonicalCategory(e.type, e.category) !== filters.category) return false;
    if (filters.method && !methodRefMatches(filters.method, e.method)) return false;
    if (filters.q) {
      const nm = (methodOf(e.method) || {}).name || '';
      const c = catOf(e.type, e.category);
      const catNames = c ? [c.name, c.nameKo, c.nameEn] : [e.category];
      if (!matchesSearch([e.memo, ...catNames, nm, e.couplePayer].join(' '), filters.q)) return false;
    }
    return true;
  });
}

function listResultsHtml(all) {
  const list = applyFilters(all);
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
    const inc = es.filter((e) => e.type === 'income').reduce((s, e) => s + reportAmount(e), 0);
    const exp = es.filter((e) => e.type === 'expense').reduce((s, e) => s + reportAmount(e), 0);
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
  const el = $('#listResults');
  if (!el || view !== 'list') return;
  el.innerHTML = listResultsHtml(monthLedger(curMonth));
}

function renderList() {
  const all = monthLedger(curMonth);
  const cats = [...data.settings.categories.expense, ...data.settings.categories.income]
    .filter((c, i, list) => list.findIndex((x) => x.name === c.name) === i);
  const hasNoMethod = ledger().some((e) => !e.method);
  const hasRetiredMethod = ledger().some((e) => e.method && !methodOf(e.method));
  /* 조회 중이던 카드를 설정에서 지워도 선택칸과 실제 결과가 어긋나지 않게 한다. */
  if (filters.method === METHOD_NONE && !hasNoMethod) filters.method = '';
  else if (filters.method === METHOD_RETIRED && !hasRetiredMethod) filters.method = '';
  else if (filters.method && filters.method !== METHOD_NONE
      && filters.method !== METHOD_RETIRED && !methodOf(filters.method)) {
    filters.method = hasRetiredMethod ? METHOD_RETIRED : '';
  }
  const toolbar = `
    <div class="list-toolbar">
      <input type="search" id="fQ" placeholder="내용·분류·카드·초성 검색" value="${esc(filters.q)}"
             autocomplete="off" enterkeyhint="search" aria-label="내역 검색">
      <select id="fCategory" aria-label="분류별 조회">
        <option value="">모든 분류</option>
        ${cats.map((c) => `<option value="${esc(c.name)}" ${filters.category === c.name ? 'selected' : ''}>${esc(catLabel(c))}</option>`).join('')}
      </select>
      <select id="fMethod" aria-label="결제수단별 조회">
        <option value="">모든 카드·결제수단</option>
        ${methods().map((m) => `<option value="${esc(m.id)}" ${filters.method === m.id ? 'selected' : ''}>${esc(m.emoji || '💳')} ${esc(m.name)}</option>`).join('')}
        ${hasNoMethod ? `<option value="${METHOD_NONE}" ${filters.method === METHOD_NONE ? 'selected' : ''}>결제수단 없음</option>` : ''}
        ${hasRetiredMethod ? `<option value="${METHOD_RETIRED}" ${filters.method === METHOD_RETIRED ? 'selected' : ''}>삭제된 결제수단</option>` : ''}
      </select>
      <div class="entry-edit-hint">✎ 내역을 누르면 수정할 수 있어요</div>
    </div>`;
  $('#view').innerHTML = `${toolbar}<div id="listResults">${listResultsHtml(all)}</div>`;
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
    if (e.type === 'income') d.inc += reportAmount(e); else d.exp += reportAmount(e);
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
    canonicalCategory('expense', e.category, '기타')));
  [...statsSelectedCategories].forEach((name) => {
    if (!available.has(name)) statsSelectedCategories.delete(name);
  });
}

function renderStats() {
  const expenses = monthLedger(curMonth)
    .filter((e) => e.type === 'expense' && reportAmount(e) > 0);
  const goalCard = goalCardHtml();
  syncStatsSelection(expenses);

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
  // 지워진 결제수단과 애초에 고르지 않은 내역을 나눠서 둘 다 조회할 수 있게 한다
  const totals = {};
  let noMethod = 0;
  let retired = 0;
  let partnerPaid = 0;
  expenses.forEach((e) => {
    const amount = reportAmount(e);
    if (methodOf(e.method)) totals[e.method] = (totals[e.method] || 0) + amount;
    else if (e.method) retired += amount;
    else {
      noMethod += amount;
      if (e.fromCouple && e.coupleSplit === 'half' && e.couplePayer) partnerPaid += amount;
    }
  });
  const rows = methods()
    .map((m) => ({ m, amt: totals[m.id] || 0 }))
    .filter((r) => r.amt > 0)
    .sort((a, b) => b.amt - a.amt);
  if (!rows.length && !noMethod && !retired) return '';

  const max = Math.max(...rows.map((r) => r.amt), noMethod, retired, 1);
  const bar = (id, label, sub, amt, color) => `
    <button class="who-row method-row method-history-link" data-method-history="${esc(id)}"
            title="결제수단 내역 보기">
      <span class="nm">${label}</span>
      <span class="track"><span class="fill" style="display:block;width:${Math.max(2, (amt / max) * 100)}%;background:${color}"></span></span>
      <span class="amt">${fmtMoney(amt)}</span>
      <span class="method-history-chevron" aria-hidden="true">›</span>
    </button>${sub ? `<p class="hint tiny method-row-sub">${sub}</p>` : ''}`;

  let html = rows.map((r, i) => bar(
    r.m.id,
    `${r.m.emoji || '💳'} ${esc(r.m.name)}`,
    r.m.type === 'credit' && r.m.billingDay ? `매달 ${r.m.billingDay}일 결제 예정` : '',
    r.amt,
    slotColor((i % 8) + 1)
  )).join('');
  if (noMethod > 0) html += bar(METHOD_NONE,
    partnerPaid === noMethod ? '🤝 상대 결제' : '결제수단 없음·상대 결제', '', noMethod, 'var(--muted)');
  if (retired > 0) html += bar(METHOD_RETIRED, '삭제된 결제수단', '', retired, 'var(--muted)');

  const coupleHint = expenses.some((e) => e.fromCouple && e.coupleSplit === 'half')
    ? `<p class="hint tiny method-share-hint">${I18n.lang === 'en'
      ? 'Shared purchases show my share here; card details keep the full charged amount.'
      : '함께 쓴 돈은 내 몫만 표시하고, 카드 상세에는 실제 결제 총액을 유지해요.'}</p>` : '';
  return `<div class="card full"><h3>결제수단별 지출 <small>${monthLabel(curMonth)}</small></h3>${coupleHint}${html}</div>`;
}

function goalCardHtml() {
  const goal = data.settings.goal || {};
  if (!(goal.target > 0)) return '';
  const saved = liveEntries()
    .filter((e) => e.type === 'expense' && isCategoryKey('expense', e.category, 'savings'))
    .reduce((s, e) => s + reportAmount(e), 0);
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
  const total = expenses.reduce((s, e) => s + reportAmount(e), 0);
  const byCat = {};
  expenses.forEach((e) => {
    const k = canonicalCategory('expense', e.category, '기타');
    byCat[k] = (byCat[k] || 0) + reportAmount(e);
  });
  const items = Object.entries(byCat).map(([name, amt]) => {
    const c = catOf('expense', name);
    return { name, label: c ? catLabel(c) : name, amt, slot: c ? c.slot : 0, emoji: c ? c.emoji : '📦' };
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

  const tipTotal = expenses.reduce((s, e) => s + reportTip(e), 0);
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

function dailyBarsHtml(expenses) {
  const [y, mo] = curMonth.split('-').map(Number);
  const dim = daysInMonth(curMonth);
  const byDay = new Array(dim + 1).fill(0);
  expenses.forEach((e) => { byDay[Number(e.date.slice(8, 10))] += reportAmount(e); });
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
    const dayTip = I18n.lang === 'en'
      ? `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(dt)} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()]})`
      : `${mo}월 ${d}일 (${DOW[dt.getDay()]})`;
    hits += `<rect x="${(x - slotW / 2).toFixed(1)}" y="${mT}" width="${slotW.toFixed(1)}" height="${plotH}" fill="transparent"
      data-tip="${dayTip}|${v > 0 ? '−' + fmtMoney(v) : I18n.t('지출 없음')}"></rect>`;
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
  if (st.state === 'off') {
    el.innerHTML = dot + I18n.t('동기화 꺼짐');
    el.title = I18n.t('눌러서 기기 동기화 설정하기');
  }
  else if (st.state === 'syncing') { el.innerHTML = dot + '동기화 중…'; }
  else if (st.state === 'ok') {
    const t = st.lastSyncAt;
    el.innerHTML = dot + pad2(t.getHours()) + ':' + pad2(t.getMinutes()) + ' 동기화됨';
    el.title = I18n.t('눌러서 지금 동기화');
  } else if (st.state === 'offline') {
    el.innerHTML = dot + I18n.t('오프라인');
    el.title = I18n.t('연결되면 자동으로 합쳐져요');
  }
  else if (st.state === 'error') { el.innerHTML = dot + I18n.t('동기화 오류'); el.title = st.error || ''; }
  else { el.innerHTML = dot + '대기 중'; }
}

/* ==================== 입력 모달 ==================== */
function openEntryModal(entry, sourceEl = null) {
  rememberViewScroll('entryModal', sourceEl);
  editingId = entry ? entry.id : null;
  const firstCat = data.settings.categories.expense[0].name;
  draft = entry
    ? { type: entry.type, amount: entry.amount,
        category: canonicalCategory(entry.type, entry.category, firstCat), date: entry.date,
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
  // 지워진 결제수단도 편집 저장 때 조용히 다른 카드로 바뀌지 않게 원래 값을 보존한다.
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

  $('#amountUnit').textContent = isUSD() ? '$' : (I18n.lang === 'en' ? '₩' : '원');
  $('#inAmount').value = draft.base ? formatAmountStr(draft.base) : '';
  $('#inDate').value = draft.date;
  $('#inTime').value = draft.time || '';
  $('#inMemo').value = draft.memo || '';
  $('#inMemo').placeholder = I18n.t(isExp ? '어디에 썼는지 적어주세요' : '어떤 수입인지 적어주세요');
  $('#btnDeleteEntry').classList.toggle('hidden', !editingId);
  $('#btnSaveEntry').textContent = I18n.t(editingId ? '수정 저장' : '저장');

  $('#catGrid').innerHTML = data.settings.categories[draft.type].map((c) => `
    <button class="cat-chip ${c.name === draft.category ? 'active' : ''}" data-name="${esc(c.name)}">
      <span>${esc(c.emoji)}</span>${esc(catLabel(c))}
    </button>`).join('');

  renderTipBox();
  renderMethodPicker();
}

/* 결제수단 칩 + 이 분류에 제일 좋은 카드 추천 */
function renderMethodPicker() {
  const missing = draft.method && !methodOf(draft.method);
  $('#methodGrid').innerHTML = methods().map((m) => `
    <button class="cat-chip method ${m.id === draft.method ? 'active' : ''}" data-method="${esc(m.id)}">
      <span>${m.emoji || '💳'}</span>${esc(m.name)}
    </button>`).join('') + (missing
      ? '<button class="cat-chip method active missing" type="button" disabled><span>?</span>지워진 결제수단</button>' : '');

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
  draft.time = $('#inTime').value || '';
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

/* 저장용 금액은 표시 통화의 자릿수까지 엄격히 검사한다.
   빈 값과 잘못된 값이 조용히 0원/$0 기준점으로 바뀌면 잔액을 맞출 수 없다. */
function parseMoneyInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const re = isUSD()
    ? /^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?|\.\d{1,2})$/
    : /^(?:\d+|\d{1,3}(?:,\d{3})+)$/;
  if (!re.test(s)) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? roundMoney(n) : null;
}
function readAmount() { return toNum($('#inAmount').value); }

function saveEntry() {
  const wasEditing = !!editingId;
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
  if (methodOf(draft.method)) data.settings.lastMethod = draft.method;
  if (editingId) {
    const e = data.entries.find((x) => x.id === editingId);
    if (e) {
      Object.assign(e, f);
      detachCoupleCopy(e);
      touch(e);
    }
  } else {
    const e = { id: uuid(), ...f, deleted: false };
    touch(e);
    data.entries.push(e);
  }
  $('#entryModal').classList.add('hidden');
  /* 새 내역을 다른 달에 추가할 때만 그 달로 이동한다. 기존 내역의 날짜를
     고쳐도 사용자가 보던 달·탭·검색조건은 그대로 남겨둔다. */
  if (!wasEditing) curMonth = f.date.slice(0, 7);
  afterChange();
  restoreViewScroll('entryModal');
}

function deleteEntry() {
  if (!editingId) return;
  const e = data.entries.find((x) => x.id === editingId);
  if (!e) return;
  askConfirm({ emoji: '🗑️', title: '이 내역을 삭제할까요?', text: '되돌릴 수 없어요.', ok: '삭제', danger: true }, () => {
    e.deleted = true;
    if (e.fromCouple) e.linkDetached = true;
    touch(e);
    $('#entryModal').classList.add('hidden');
    afterChange();
    restoreViewScroll('entryModal');
  });
}

/* ==================== 설정 모달 ==================== */
function openSettings() {
  const s = data.settings;
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
  setDraftRecur = JSON.parse(JSON.stringify(s.recurring || []));
  setDraftMethods = JSON.parse(JSON.stringify(s.methods || []));
  resetRecurringForm(false);
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
    .forEach((e) => { monthTotals[e.method] = (monthTotals[e.method] || 0) + reportAmount(e); });

  $('#methodManage').innerHTML = setDraftMethods.map((m) => {
    const kind = m.type === 'credit' ? '신용' : (m.type === 'debit' ? '체크' : '현금');
    const rates = Object.entries(m.rates || {}).filter(([, v]) => Number(v) > 0);
    const start = methodOpening(m);
    const balance = isCreditM(m) ? cardDebt(m) : cashLeft(m);
    const sub = [
      rates.length ? rates.map(([k, v]) => `${draftCategoryLabel('expense', k)} ${v}%`).slice(0, 2).join(' · ') : '',
      m.base > 0 ? `그 외 ${m.base}%` : '',
      m.billingDay ? `${m.billingDay}일 결제` : '',
      monthTotals[m.id] ? (I18n.lang === 'en'
        ? `This month spent ${fmtMoney(monthTotals[m.id])}`
        : `이번 달 지출 ${fmtMoney(monthTotals[m.id])}`) : '',
      start ? openingLabel(start) : ''
    ].filter(Boolean).join(' · ');
    return `
      <div class="method-item" data-medit="${esc(m.id)}">
        <span class="ic">${m.emoji || '💳'}</span>
        <span class="nm">${esc(m.name)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span>
        <span class="kind ${m.type}">${kind}</span>
        <span class="amt">${balance
          ? `<small>${isCreditM(m) ? '갚을 돈' : '현재 잔액'}</small>${fmtMoney(balance.left)}` : ''}</span>
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
  const start = methodOpening(m);
  $('#inPreSpent').value = start ? formatAmountStr(start.amount) : '';
  $('#inPreSpentDate').value = start ? start.date : todayStr();
  $('#inPreSpentDate').max = todayStr();
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

function methodDraftRate(c) {
  const key = [c.name, c.nameKo, c.nameEn]
    .find((k) => k && methodDraftRates[k] != null && methodDraftRates[k] !== '');
  return key ? methodDraftRates[key] : '';
}

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
  renderMethodOpeningHint();

  $('#rateGrid').innerHTML = (setDraftCats || data.settings.categories).expense.map((c) => `
    <span class="rate-cell">
      ${esc(c.emoji)} ${esc(catLabel(c))}
      <input data-rate="${esc(c.name)}" inputmode="decimal" maxlength="5"
             value="${esc(methodDraftRate(c))}" placeholder="–">
      <span class="pc">%</span>
    </span>`).join('');
}

function renderMethodOpeningHint() {
  const date = $('#inPreSpentDate').value || todayStr();
  const include = $('#inIncludeBeforeStart').checked;
  const current = editingMethodId
    ? setDraftMethods.find((m) => m.id === editingMethodId) : null;
  const canKeepBaseline = !!(current && current.openingSet === true
    && current.openingDate === date && current.type === methodDraftType
    && hasOpeningBaseline(current));
  const pending = include && !canKeepBaseline
    && Sync.isConfigured() && Sync.getStatus().state !== 'ok';
  const meaning = I18n.t(methodDraftType === 'credit'
    ? '이 날짜가 끝난 시점의 갚아야 할 잔액을 넣어주세요.'
    : '이 날짜가 끝난 시점의 사용 가능 잔액을 넣어주세요.');
  const history = I18n.t(pending
    ? '동기화가 끝나면 기준일까지의 현재 내역을 기준으로 잡고, 그 뒤 과거 변경분을 반영해요.'
    : include
      ? '기준점을 저장한 뒤 기준일까지 추가·수정·삭제한 내역의 차이도 잔액에 반영돼요.'
    : '기준일 다음날부터의 내역만 잔액에 반영돼요.');
  const basis = I18n.lang === 'en' ? `${date} end-of-day basis` : `${date} 하루 마감 기준`;
  $('#preSpentHint').textContent = `${basis} · ${meaning} ${history}`;
}

function saveMethod() {
  const name = $('#inMethodName').value.trim();
  if (!name) { $('#inMethodName').focus(); toast('이름을 넣어주세요'); return; }
  const rates = {};
  document.querySelectorAll('#rateGrid [data-rate]').forEach((el) => {
    const v = toNum(el.value);
    if (v > 0) rates[el.dataset.rate] = v;
  });
  const methodId = editingMethodId || ('m_' + uuid().slice(0, 8));
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
  const openingRaw = $('#inPreSpent').value.trim();
  if (openingRaw === '') {
    fields.openingSet = false;
    fields.opening = 0;
    fields.openingDate = '';
    fields.openingBefore = 'exclude';
    fields.openingBaseline = 0;
  } else {
    const opening = parseMoneyInput(openingRaw);
    if (opening == null) {
      $('#inPreSpent').focus(); toast('시작 금액을 올바르게 넣어주세요'); return;
    }
    const openingDate = $('#inPreSpentDate').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(openingDate || '') || openingDate > todayStr()) {
      $('#inPreSpentDate').focus(); toast('잔액 기준일을 골라주세요'); return;
    }
    fields.openingSet = true;
    fields.opening = opening;
    fields.openingDate = openingDate;
    fields.openingBefore = $('#inIncludeBeforeStart').checked ? 'include' : 'exclude';
    const old = editingMethodId ? setDraftMethods.find((x) => x.id === editingMethodId) : null;
    const canKeepBaseline = !!(old && old.openingSet === true
      && old.openingDate === openingDate && old.type === methodDraftType
      && hasOpeningBaseline(old));
    fields.openingBaseline = canKeepBaseline
      ? Number(old.openingBaseline)
      /* 새 범위는 바깥 설정 저장에서 최종 동기화 상태를 적용한 뒤 확정한다.
         같은 설정 세션에서 동기화를 처음 켜도 로컬 과거 합계를 먼저 잡지 않는다. */
      : null;
  }

  if (editingMethodId) {
    const m = setDraftMethods.find((x) => x.id === editingMethodId);
    if (m) Object.assign(m, fields);
  } else {
    setDraftMethods.push({ id: methodId, ...fields });
  }
  $('#methodModal').classList.add('hidden');
  renderMethodManage();
  renderRecurList();
}

/* ---------- 카드값 갚기 ---------- */
let payingMethodId = null;
let payFromId = null;
let editingPayId = null;

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

function openPayModal(id, entryId = null, sourceEl = null) {
  const existing = entryId
    ? data.entries.find((x) => x.id === entryId && x.type === 'cardpay') : null;
  const m = methodOf(existing ? existing.method : id);
  if (!m && !existing) return;
  rememberViewScroll('payModal', sourceEl);
  editingPayId = existing ? existing.id : null;
  payingMethodId = existing ? existing.method : id;
  const d = m ? (cardDebt(m) || { left: 0 }) : { left: 0 };
  const from = payableFrom();
  payFromId = existing
    ? (existing.from || '')
    : ((from.find((x) => x.id === data.settings.lastPayFrom) || from[0] || {}).id || null);
  const label = m ? `${m.emoji || '💳'} ${m.name}` : '카드';
  $('#payModalTitle').textContent = I18n.lang === 'en'
    ? (existing ? `Edit ${label} payment` : `Pay ${label}`)
    : (existing ? `${label} 갚은 기록 수정` : `${label} 갚기`);
  $('#inPayAmount').value = existing ? formatAmountStr(existing.amount) : '';
  $('#inPayDate').value = existing ? existing.date : todayStr();
  $('#inPayDate').max = todayStr();
  $('#inPayMemo').value = existing ? (existing.memo || '') : '';
  $('#btnPaySave').textContent = existing ? '수정 저장' : '저장';
  renderPayFrom();
  /* 자주 쓰는 금액을 눌러 넣을 수 있게 — 전액이 제일 위 */
  const existingIncluded = !!(existing && m && balanceEntryFilter(m)(existing));
  const fullAmount = roundMoney(Math.max(0,
    (Number.isFinite(d.rawLeft) ? d.rawLeft : d.left) + (existingIncluded ? existing.amount : 0)));
  $('#payQuick').innerHTML = fullAmount > 0
    ? `<button type="button" data-quick="${fullAmount}">${I18n.lang === 'en' ? 'Full' : '전액'} ${fmtMoney(fullAmount)}</button>` +
      [100, 200, 500].filter((v) => v < fullAmount)
        .map((v) => `<button type="button" data-quick="${v}">${fmtMoney(v)}</button>`).join('')
    : '';
  $('#payModal').classList.remove('hidden');
  $('#inPayAmount').focus();
}

function savePay() {
  const amount = parseMoneyInput($('#inPayAmount').value.trim());
  if (!(amount > 0)) { $('#inPayAmount').focus(); toast('금액을 올바르게 넣어주세요'); return; }
  const payDate = $('#inPayDate').value || todayStr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate) || payDate > todayStr()) {
    $('#inPayDate').focus(); toast('오늘 또는 이전 날짜를 골라주세요'); return;
  }
  const fields = {
    date: payDate,
    type: 'cardpay', amount, tip: 0, category: '',
    method: payingMethodId,          // 갚은 대상 카드
    from: payFromId || '',           // 돈이 빠져나간 곳 (현금·체크카드)
    memo: $('#inPayMemo').value.trim()
  };
  const card = methodOf(payingMethodId);
  const existing = editingPayId
    ? data.entries.find((x) => x.id === editingPayId && x.type === 'cardpay') : null;
  const debt = card ? cardDebt(card) : null;
  if (debt && balanceEntryFilter(card)(fields)) {
    const oldIncluded = !!(existing && balanceEntryFilter(card)(existing));
    const maxPayable = roundMoney(Math.max(0,
      (Number.isFinite(debt.rawLeft) ? debt.rawLeft : debt.left)
      + (oldIncluded ? existing.amount : 0)));
    if (amount > maxPayable) {
      $('#inPayAmount').focus();
      toast(I18n.lang === 'en'
        ? `Enter no more than the current balance of ${fmtMoney(maxPayable)}`
        : `현재 갚을 돈 ${fmtMoney(maxPayable)} 이하로 넣어주세요`);
      return;
    }
  }
  if (payFromId) data.settings.lastPayFrom = payFromId;
  if (editingPayId) {
    const e = data.entries.find((x) => x.id === editingPayId && x.type === 'cardpay');
    if (e) { Object.assign(e, fields); touch(e); }
  } else {
    const e = { id: uuid(), ...fields, deleted: false };
    touch(e);
    data.entries.push(e);
  }
  const wasEditing = !!editingPayId;
  editingPayId = null;
  $('#payModal').classList.add('hidden');
  afterChange();
  restoreViewScroll('payModal');
  const m = methodOf(payingMethodId);
  const left = m ? (cardDebt(m) || {}).left : null;
  toast(wasEditing ? '카드값 기록을 수정했어요'
    : (left === 0 ? '다 갚았어요! 🎉'
      : (I18n.lang === 'en' ? `Paid ${fmtMoney(amount)}` : `${fmtMoney(amount)} 갚았어요`)));
}

function deletePay(id, sourceEl = null) {
  const e = data.entries.find((x) => x.id === id);
  if (!e) return;
  rememberViewScroll('confirmModal', sourceEl);
  askConfirm({
    emoji: '🗑️',
    title: '이 갚은 기록을 지울까요?',
    text: I18n.lang === 'en'
      ? `The ${fmtMoney(e.amount)} payment will be removed and that amount will be added back to what you owe.`
      : `${fmtMoney(e.amount)} 기록이 사라지고, 갚을 돈이 그만큼 다시 늘어나요.`,
    ok: '삭제', danger: true
  }, () => {
    e.deleted = true;
    touch(e);
    afterChange();
    restoreViewScroll('confirmModal');
  });
}

function deleteMethodById(id) {
  const m = setDraftMethods.find((x) => x.id === id);
  if (!m) return;
  const used = liveEntries().filter((e) => e.method === id || e.from === id).length;
  const recurUsed = setDraftRecur.filter((r) => r.method === id).length;
  askConfirm({
    emoji: '🗑️',
    title: I18n.lang === 'en' ? `Delete ${m.name}?` : `${m.name} 을(를) 삭제할까요?`,
    text: I18n.lang === 'en'
      ? (used || recurUsed
        ? `<b>${used}</b> linked ${used === 1 ? 'entry stays' : 'entries stay'}.${recurUsed
          ? ` <b>${recurUsed}</b> recurring ${recurUsed === 1 ? 'expense changes' : 'expenses change'} to no payment method.` : ''}`
        : 'Select Save in Settings to apply this change.')
      : (used || recurUsed
        ? `연결된 내역 <b>${used}건</b> 은 그대로 남습니다.${recurUsed
          ? ` 반복 지출 <b>${recurUsed}건</b> 은 결제수단 없음으로 바뀝니다.` : ''}`
        : '설정에서 [저장] 을 눌러야 최종 반영돼요.'),
    ok: '삭제', danger: true
  }, () => {
    setDraftMethods = setDraftMethods.filter((x) => x.id !== id);
    setDraftRecur.forEach((r) => { if (r.method === id) r.method = ''; });
    $('#methodModal').classList.add('hidden');
    renderMethodManage();
    renderRecurList();
  });
}
function deleteMethod() { deleteMethodById(editingMethodId); }

function moveDraftCategory(type, from, to) {
  const list = setDraftCats && setDraftCats[type];
  if (!list || from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return false;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return true;
}

function announceCategoryOrder(type, index) {
  const status = $('#catOrderStatus');
  const list = setDraftCats && setDraftCats[type];
  const c = list && list[index];
  if (!status || !c) return;
  status.textContent = I18n.lang === 'en'
    ? `${catLabel(c)} moved to position ${index + 1} of ${list.length}.`
    : `${catLabel(c)} 분류를 ${list.length}개 중 ${index + 1}번째로 옮겼어요.`;
}

function focusCategoryHandle(type, index) {
  requestAnimationFrame(() => {
    const handle = document.querySelector(`[data-catdrag="${type}"][data-catindex="${index}"]`);
    if (handle) handle.focus();
    announceCategoryOrder(type, index);
  });
}

function onCategoryDragKey(ev) {
  const handle = ev.target.closest('[data-catdrag]');
  if (!handle || !setDraftCats) return;
  const type = handle.dataset.catdrag;
  const list = setDraftCats[type];
  const from = Number(handle.dataset.catindex);
  let to = from;
  if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') to = Math.max(0, from - 1);
  else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') to = Math.min(list.length - 1, from + 1);
  else if (ev.key === 'Home') to = 0;
  else if (ev.key === 'End') to = list.length - 1;
  else return;
  ev.preventDefault();
  if (!moveDraftCategory(type, from, to)) return;
  renderCatManage();
  focusCategoryHandle(type, to);
}

function beginCategoryDrag(ev) {
  const handle = ev.target.closest('[data-catdrag]');
  if (categoryDrag || !handle || !setDraftCats || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
  const type = handle.dataset.catdrag;
  const index = Number(handle.dataset.catindex);
  const chip = handle.closest('.cat-manage-chip');
  if (!chip || !setDraftCats[type] || !setDraftCats[type][index]) return;
  handle.focus({ preventScroll: true });
  ev.preventDefault();
  /* 핸들이 아닌 고정된 컨테이너에 pointer capture 를 건다. 드래그 중
     칩의 DOM 위치를 옮겨도 iOS/Safari 가 capture 를 풀지 않게 하기 위함이다. */
  const captureEl = $('#catManage');
  try { captureEl.setPointerCapture(ev.pointerId); } catch (_) { /* 구형 WebView 폴백 */ }
  categoryDrag = {
    pointerId: ev.pointerId,
    type,
    startIndex: index,
    currentIndex: index,
    original: setDraftCats[type].slice(),
    chip,
    handle,
    captureEl,
    listEl: chip.parentElement,
    startX: ev.clientX,
    startY: ev.clientY,
    offsetX: 0,
    offsetY: 0,
    ghost: null,
    started: false
  };
}

function startCategoryDrag(ev) {
  const d = categoryDrag;
  if (!d || d.started) return;
  const rect = d.chip.getBoundingClientRect();
  d.started = true;
  d.offsetX = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
  d.offsetY = Math.max(0, Math.min(rect.height, ev.clientY - rect.top));
  d.ghost = d.chip.cloneNode(true);
  d.ghost.classList.add('cat-drag-ghost');
  d.ghost.classList.remove('is-dragging');
  d.ghost.setAttribute('aria-hidden', 'true');
  d.ghost.querySelectorAll('button').forEach((b) => { b.tabIndex = -1; });
  Object.assign(d.ghost.style, { width: `${rect.width}px`, height: `${rect.height}px` });
  document.body.appendChild(d.ghost);
  d.chip.classList.add('is-dragging');
  document.body.classList.add('category-reordering');
}

function categoryDropIndex(d, x, y) {
  const siblings = [...d.listEl.querySelectorAll(`.cat-manage-chip[data-cat-type="${d.type}"]`)]
    .filter((el) => el !== d.chip);
  if (!siblings.length) return 0;
  let nearest = siblings[0];
  let best = Infinity;
  siblings.forEach((el) => {
    const r = el.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    const score = dx * dx + dy * dy;
    if (score < best) { best = score; nearest = el; }
  });
  const r = nearest.getBoundingClientRect();
  /* 같은 줄에서는 좌우, 다른 줄에서는 상하 위치로 앞/뒤를 판단한다. */
  const sameRow = y >= r.top && y <= r.bottom;
  const after = sameRow ? x > r.left + r.width / 2 : y > r.top + r.height / 2;
  return siblings.indexOf(nearest) + (after ? 1 : 0);
}

function autoScrollCategorySettings(y) {
  const box = categoryDrag && categoryDrag.chip.closest('.settings-body');
  if (!box) return;
  const r = box.getBoundingClientRect();
  const edge = 48;
  if (y < r.top + edge) box.scrollBy(0, -10);
  else if (y > r.bottom - edge) box.scrollBy(0, 10);
}

function updateCategoryDrag(ev) {
  const d = categoryDrag;
  if (!d || ev.pointerId !== d.pointerId) return;
  if (!d.started && Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < 5) return;
  startCategoryDrag(ev);
  if (!d.started) return;
  ev.preventDefault();
  d.ghost.style.left = `${ev.clientX - d.offsetX}px`;
  d.ghost.style.top = `${ev.clientY - d.offsetY}px`;
  autoScrollCategorySettings(ev.clientY);

  const to = categoryDropIndex(d, ev.clientX, ev.clientY);
  if (to === d.currentIndex || !moveDraftCategory(d.type, d.currentIndex, to)) return;
  const siblings = [...d.listEl.querySelectorAll(`.cat-manage-chip[data-cat-type="${d.type}"]`)]
    .filter((el) => el !== d.chip);
  d.listEl.insertBefore(d.chip, siblings[to] || null);
  d.currentIndex = to;
}

function finishCategoryDrag(cancelled) {
  const d = categoryDrag;
  if (!d) return;
  categoryDrag = null;
  if (cancelled && d.started) setDraftCats[d.type] = d.original;
  if (d.ghost) d.ghost.remove();
  d.chip.classList.remove('is-dragging');
  document.body.classList.remove('category-reordering');
  try {
    if (d.captureEl.hasPointerCapture && d.captureEl.hasPointerCapture(d.pointerId)) {
      d.captureEl.releasePointerCapture(d.pointerId);
    }
  } catch (_) { /* 구형 WebView 폴백 */ }
  if (!d.started) return;
  const index = cancelled ? d.startIndex : d.currentIndex;
  renderCatManage();
  focusCategoryHandle(d.type, index);
}

function renderCatManage() {
  const block = (type, label, hint) => `
    <div class="field">
      <label>${label}</label>
      ${hint ? `<p class="hint tiny" style="margin:-2px 0 8px">${hint}</p>` : ''}
      <div class="cat-manage-list" role="list" aria-label="${label}">
        ${setDraftCats[type].map((c, i) => `
          <span class="cat-manage-chip" data-cat-type="${type}" data-cat-index="${i}" role="listitem">
            <button type="button" class="cat-drag-handle" data-catdrag="${type}" data-catindex="${i}"
              title="${I18n.t('순서 변경')}" aria-label="${esc(catLabel(c))} — ${I18n.t('순서 변경')}"
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End">⠿</button>
            <span style="width:8px;height:8px;border-radius:3px;background:${slotColor(c.slot)};display:inline-block"></span>
            ${esc(c.emoji)} <span class="cat-manage-name">${esc(catLabel(c))}</span>
            ${type === 'expense' ? `<button class="tip-btn ${c.tip ? 'on' : 'off'}"
                data-tipcat="${i}" title="팁 계산 켜기/끄기">팁</button>` : ''}
            <button class="edit" data-catedit="${i}" data-type="${type}" title="${I18n.t('분류 수정')}" aria-label="${esc(catLabel(c))} — ${I18n.t('분류 수정')}">✎</button>
            ${REQUIRED_CATEGORY_KEYS.has(c.key) ? ''
              : `<button class="del" data-catdel="${i}" data-type="${type}" title="삭제">✕</button>`}
          </span>`).join('')}
      </div>
      <div class="cat-add-row">
        <button class="btn" data-add="${type}">＋ ${label} 추가</button>
      </div>
    </div>`;
  $('#catManage').innerHTML =
    '<p class="hint tiny cat-order-hint">핸들을 끌어 분류 순서를 바꿀 수 있어요. 키보드에서는 핸들에 초점을 맞추고 방향키를 누르세요.</p>' +
    '<span class="sr-only" id="catOrderStatus" aria-live="polite" aria-atomic="true"></span>' +
    block('expense', '지출 분류', '<b>팁</b> 을 눌러 켜두면 그 분류에서 팁 계산기가 나와요.') +
    block('income', '수입 분류', '');
}

function renderRecurList() {
  /* 새로 추가할 때 고를 결제수단 목록 (설정 화면의 초안 기준) */
  const list = setDraftMethods && setDraftMethods.length ? setDraftMethods : methods();
  const sel = $('#recMethod');
  if (sel) {
    const hadOptions = sel.options.length > 0;
    const previous = sel.value;
    const editingRule = editingRecurringId
      ? setDraftRecur.find((r) => r.id === editingRecurringId) : null;
    const keep = hadOptions ? previous : (editingRule ? (editingRule.method || '') : '');
    const missing = !!(editingRule && keep && !list.some((m) => m.id === keep)
      && keep === (editingRule.method || ''));
    sel.innerHTML = '<option value="">결제수단 없음</option>' + list.map((m) =>
      `<option value="${esc(m.id)}">${m.emoji || '💳'} ${esc(m.name)}</option>`).join('') +
      (missing ? `<option value="${esc(keep)}">? 지워진 결제수단</option>` : '');
    sel.value = (keep === '' || list.some((m) => m.id === keep) || missing) ? keep : '';
  }

  if (!setDraftRecur.length) {
    $('#recurList').innerHTML = '<p class="hint">등록된 반복 지출이 없어요.</p>';
    return;
  }
  $('#recurList').innerHTML = setDraftRecur.map((r) => {
    const m = list.find((x) => x.id === r.method);
    return `
    <div class="recur-item ${editingRecurringId === r.id ? 'editing' : ''}">
      <span class="day">매달 ${r.day}일</span>
      <span class="nm">${esc(r.memo)}${m ? `<span class="rec-method">${m.emoji || '💳'} ${esc(m.name)}</span>` : ''}</span>
      <span class="amt">${fmtMoney(r.amount)}</span>
      <button class="edit" data-recedit="${r.id}" title="${I18n.t('반복 지출 수정')}" aria-label="${esc(r.memo)} — ${I18n.t('반복 지출 수정')}">✎</button>
      <button class="del" data-recdel="${r.id}" title="${I18n.t('삭제')}" aria-label="${esc(r.memo)} — ${I18n.t('삭제')}">✕</button>
    </div>`;
  }).join('');
}

function saveSettings(keepOpen) {
  /* 반복 입력칸을 편집하다가 바로 설정 저장을 눌러도 값이 사라지지 않게 한다. */
  if (recurringFormHasInput() && saveRecurringForm() === false) return false;
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

  /* 언어는 기기마다 다를 수 있으므로 동기화하지 않고 이 기기에만 둔다 */
  const newLang = $('#setLang').value || 'auto';
  const langChanged = newLang !== (s.lang || 'auto');
  s.lang = newLang;

  s.currency = newCurrency;
  s.budget = newBudget;
  s.goal = newGoal;
  s.categories = setDraftCats;
  s.recurring = setDraftRecur;
  s.methods = newMethods;
  if (!methodOf(s.lastMethod)) s.lastMethod = s.methods[0].id;
  setDraftCats = JSON.parse(JSON.stringify(setDraftCats));
  setDraftRecur = JSON.parse(JSON.stringify(setDraftRecur));
  const metaChanged = changedFields.length > 0;
  if (metaChanged) markMeta(...changedFields);
  if (langChanged) {
    I18n.setLang(newLang, userWords, stockNames());
    checkDesktopUpdate();
  }
  const pushLocaleChanged = Push.refreshMetadata('나');

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
     그래야 첫 pull 에서 원격의 더 최신 결제수단 설정이 정상적으로 이긴다. */
  if (ledgerChanged) invalidateOpeningBaselines();
  if (cfgChanged) {
    s.lastPullAt = null;
    data.entries.forEach((e) => { e.dirty = true; });
    Sync.configure(s);
  }

  applyRecurring();

  /* 동기화가 켜져 있으면 마지막 상태가 ok 여도 이번 저장 뒤 다른 기기 변경을
     한 번 더 받아야 한다. 동기화를 끈 경우에만 로컬 원장으로 즉시 확정한다. */
  const canCaptureOpeningBaseline = !Sync.isConfigured();
  const openingBaselineMigrated = canCaptureOpeningBaseline
    ? migrateOpeningBaselines() : false;
  if (openingBaselineMigrated) markMeta('methods');
  setDraftMethods = JSON.parse(JSON.stringify(s.methods));

  // 동기화 설정은 절대 날아가면 안 되므로 지연 없이 바로 저장
  Store.saveNow(data);
  if (keepOpen !== true) $('#settingsModal').classList.add('hidden');
  render();
  if (Sync.isConfigured()
      && (cfgChanged || metaChanged || openingBaselineMigrated || pushLocaleChanged)) scheduleSync();
  return true;
}

/* ==================== CSV ==================== */
function exportCsv(monthOnly) {
  /* 카드 갚은 기록도 함께 내보낸다 — 지출은 아니지만 돈이 나간 기록이라 있어야 한다 */
  const pays = monthOnly
    ? cardPays().filter((e) => e.date && e.date.startsWith(curMonth)) : cardPays();
  const list = (monthOnly ? monthLedger(curMonth) : ledger()).concat(pays)
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  const en = I18n.lang === 'en';
  const label = en
    ? { expense: 'Expense', income: 'Income', cardpay: 'Card payment' }
    : { expense: '지출', income: '수입', cardpay: '카드갚기' };
  const rows = [en
    ? ['Date', 'Time', 'Type', 'Actual amount', 'Monthly spending amount', 'Tip',
      'Category', 'Payment method', 'Note', 'Couple-ledger source']
    : ['날짜', '시간', '구분', '실제 결제액', '월지출 반영액', '팁',
      '분류', '결제수단', '내용', '커플 원본']];
  list.forEach((e) => {
    const method = methodOf(e.method);
    rows.push([
      e.date, e.time || '', label[e.type] || label.expense, e.amount,
      e.type === 'cardpay' ? 0 : reportAmount(e), e.type === 'cardpay' ? 0 : reportTip(e),
      categoryLabel(e.type, e.category),
      method ? (method.id === 'cash' ? I18n.t(method.name) : method.name) : '',
      e.memo, e.fromCouple ? (en ? 'Yes' : '예') : ''
    ]);
  });
  const csv = '﻿' + rows.map((r) => r.map((v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = en
    ? (monthOnly ? `my-ledger_${curMonth}.csv` : 'my-ledger_all.csv')
    : (monthOnly ? `내가계부_${curMonth}.csv` : '내가계부_전체.csv');
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
  $('#updateTxt').innerHTML = esc(I18n.t(title)) + (sub ? `<small>${esc(I18n.t(sub))}</small>` : '');
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
        $('#btnUpdateNow').textContent = I18n.t('적용 중…');
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
    const title = I18n.lang === 'en'
      ? `Version ${info.version} is available`
      : `새 버전 ${info.version} 이 나왔어요`;
    const notes = I18n.lang === 'en'
      ? (info.notesEn || info.notes_en || info.notes || '')
      : (info.notesKo || info.notes_ko || info.notes || '');
    showUpdateBar(title, notes, () => {
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
        rp: { name: I18n.t('내 가계부') },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: I18n.t('내 가계부'), displayName: I18n.t('내 가계부') },
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
        /* 이 잠금은 이 아이폰의 Face ID용이므로 다른 기기/보안키 선택 화면으로
           새지 않도록 내장 인증기만 힌트로 준다. Safari가 모르는 힌트는 무시한다. */
        allowCredentials: credId
          ? [{ type: 'public-key', id: unb64(credId), transports: ['internal'] }]
          : [],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return true;   // 실패하면 예외가 난다
  }

  let lastBioErr = '';
  let bioBusy = false;
  async function tryBio() {
    const L = cfg();
    if (!L || !L.bio || bioBusy) return false;
    lastBioErr = '';
    bioBusy = true;
    const btn = $('#btnLockBio');
    if (btn) btn.disabled = true;
    try {
      if (L.bio === 'touchid') return await window.mygagyebu.bioPrompt(I18n.t('내 가계부 잠금 해제'));
      if (L.bio === 'webauthn') return await webauthnVerify(L.credId);
    } catch (e) {
      lastBioErr = e && e.name === 'NotAllowedError' ? '' : (e && e.message) || '';
    } finally {
      bioBusy = false;
      if (btn) btn.disabled = false;
    }
    return false;
  }
  function bioError() { return lastBioErr; }

  /* --- 화면 --- */
  function show() {
    document.body.classList.add('locked');
    $('#lockScreen').classList.remove('hidden');
    $('#lockPw').value = '';
    $('#lockError').textContent = '';
    const L = cfg();
    const hasBio = !!(L && L.bio);
    const btn = $('#btnLockBio');
    btn.classList.toggle('hidden', !hasBio);
    btn.textContent = I18n.t(L && L.bio === 'touchid' ? '👆 Touch ID 로 열기' : '👤 Face ID 로 열기');
    /* 지문·얼굴을 쓰면 그 버튼을 먼저 보여주고, 비밀번호는 아래로 내린다 */
    btn.classList.toggle('primary', hasBio);
    $('#btnLockOk').classList.toggle('primary', !hasBio);
    document.querySelector('.lock-box').classList.toggle('bio-first', hasBio);
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
    $('#lockError').textContent = I18n.t('비밀번호가 맞지 않아요');
    $('#lockPw').value = '';
    $('#lockPw').focus();
  }

  /* 앱을 열 때 잠그고, 자리를 비웠다 돌아와도 잠근다 */
  async function start() {
    if (!isOn()) { unlocked = true; return; }
    show();
    const L = cfg();
    /* 아이폰도 앱에 들어오자마자 Face ID를 한 번 시도한다. 최신 Safari는
       첫 WebAuthn 요청을 사용자 탭 없이 제시할 수 있다. 브라우저가 막거나
       사용자가 취소하면 잠금 화면과 기존 버튼을 그대로 남겨 재시도하게 한다. */
    if (L && L.bio) {
      if (await tryBio()) { hide(); return; }
    }
    // 지문·얼굴을 쓰는 경우엔 키보드를 먼저 올리지 않는다 (버튼이 가려져서)
    if (!(L && L.bio)) $('#lockPw').focus();
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

  return { make, verify, isOn, cfg, bioKind, webauthnRegister, webauthnVerify, tryBio, bioError,
    show, hide, submit, start, watchAway, isDesktop };
})();

/* --- 잠금 설정 화면 --- */
let lockBioKind = null;      // 이 기기에서 쓸 수 있는 지문·얼굴 방식

async function renderLockSetting() {
  const L = Lock.cfg();
  const on = !!(L && L.on);
  $('#lockStateText').textContent = on
    ? (L.bio ? I18n.t('잠금 켜짐 · 비밀번호 +') + ' ' + (L.bio === 'touchid' ? 'Touch ID' : I18n.t('Face ID·지문'))
             : I18n.t('잠금 켜짐 · 비밀번호'))
    : I18n.t('잠금 꺼짐');
  $('#btnLockToggle').textContent = I18n.t(on ? '끄기' : '켜기');
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

  /* 지문·얼굴 등록을 '먼저' 한다.
     사파리는 사용자가 방금 버튼을 누른 직후에만 Face ID 창을 띄워준다.
     비밀번호 해싱(25만 회)을 먼저 하면 1초 가까이 걸려 그 자격이 풀려버린다. */
  let bio = null, credId = null, bioErr = '';
  if ($('#setLockBio').checked && lockBioKind) {
    try {
      if (lockBioKind === 'touchid') {
        if (await window.mygagyebu.bioPrompt(I18n.t('내 가계부 잠금에 Touch ID 를 등록합니다'))) bio = 'touchid';
        else bioErr = 'Touch ID 를 취소하셨어요';
      } else {
        credId = await Lock.webauthnRegister();
        bio = 'webauthn';
      }
    } catch (e) {
      bioErr = e && e.name === 'NotAllowedError'
        ? '얼굴·지문 등록이 취소됐어요' : (e && e.message) || '알 수 없는 이유';
    }
    if (!bio) toast('비밀번호만 켰어요 — ' + bioErr);
  }

  const lock = { on: true, ...(await Lock.make(pw)), bio, credId };
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
  $('#btnLockBio').addEventListener('click', async () => {
    if (await Lock.tryBio()) { Lock.hide(); return; }
    const why = Lock.bioError();
    $('#lockError').textContent = why
      ? '얼굴·지문으로 열지 못했어요 — ' + why : '비밀번호로 열어주세요';
    $('#lockPw').focus();
  });
  $('#btnLockToggle').addEventListener('click', toggleLock);
  $('#btnLockCancel').addEventListener('click', () => $('#lockSetup').classList.add('hidden'));
  $('#btnLockSave').addEventListener('click', saveLockSetting);
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
    const modal = el.closest('.modal');
    if (!modal) return;
    // 키보드가 다 올라온 뒤에 옮겨야 자리가 맞는다
    setTimeout(() => {
      if (!el.isConnected || document.activeElement !== el
          || !modal.closest('.modal-backdrop:not(.hidden)')) return;
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

  /* 이전에는 키보드가 닫히면 window.scrollTo(0, 0)을 호출했다. 그 때문에
     아래쪽 내역을 수정·취소할 때마다 목록 처음으로 튀었다. 모달 입력칸은
     위의 focusin 처리로 모달 안에서만 보이게 하고, 본문 위치는 수정을 열 때
     기억한 viewScrollReturn으로 복원한다. */
}

/* --- 커플 가계부 연동 설정 --- */
function renderLinkSetting() {
  const L = data.settings.link || {};
  const on = !!L.on;
  $('#linkStateText').textContent = on
    ? (I18n.lang === 'en'
      ? `Import on · calculating ${L.myName || '?'}'s share`
      : `연동 켜짐 · '${L.myName || '?'}'의 내 몫으로 계산`)
    : I18n.t('연동 꺼짐');
  $('#btnLinkToggle').textContent = I18n.t(on ? '끄기' : '켜기');
  $('#btnLinkToggle').classList.toggle('danger', on);
  const n = liveEntries().filter((e) => e.fromCouple).length;
  $('#linkHint').textContent = on && n
    ? (I18n.lang === 'en' ? `${n} ${n === 1 ? 'entry' : 'entries'} imported so far.`
      : `지금까지 ${n}건 가져왔어요.`) : '';
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
  $('#linkHint').textContent = I18n.t('확인하는 중…');
  try {
    const r = await Link.test({ ...data.settings, link: draftLink() });
    $('#linkHint').textContent = I18n.lang === 'en'
      ? `Connected. The couple ledger contains ${r.names.join(', ')}; ${r.mine} ${r.mine === 1 ? 'entry uses' : 'entries use'} your name.`
      : `연결됐어요. 커플 앱에 ${r.names.join(', ')} 가 있고, 내 이름으로 된 기록이 ${r.mine}건이에요.`;
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
  data.settings.linkShareVersion = 0;
  data.settings.linkShareMetaKey = '';
  Store.saveNow(data);
  $('#linkSetup').classList.add('hidden');
  toast('가져오는 중…');
  await runSync();
  renderLinkSetting();
  const n = liveEntries().filter((e) => e.fromCouple).length;
  toast(n
    ? (I18n.lang === 'en'
      ? `Imported ${n} ${n === 1 ? 'entry' : 'entries'} from the couple ledger`
      : `커플 가계부에서 ${n}건 가져왔어요`)
    : '가져올 기록이 없어요');
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

  /* Upgrade an old subscription in place and keep its device-local language current.
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

/* 사람이 직접 적어 넣은 말은 번역하지 않는다 (분류·결제수단·목표·반복지출 이름) */
/* 앱이 처음 넣어준 이름들 — 문장 중간에 섞여 있어도 번역해도 안전하다 */
function stockNames() {
  return [
    ...defaultCategories().expense.map((c) => c.nameKo),
    ...defaultCategories().income.map((c) => c.nameKo),
    ...defaultMethods().map((m) => m.name)
  ];
}

function userWords() {
  const s = (data && data.settings) || {};
  const cats = s.categories || {};
  /* 앱이 처음 넣어준 이름은 번역해도 된다 (영어 화면에 한글이 남지 않게).
     사용자가 직접 만들거나 바꾼 이름만 그대로 둔다. */
  const stock = new Set([
    ...defaultCategories().expense.flatMap((c) => [c.name, c.nameKo, c.nameEn]),
    ...defaultCategories().income.flatMap((c) => [c.name, c.nameKo, c.nameEn]),
    ...defaultMethods().map((m) => m.name)
  ]);
  return [
    ...(cats.expense || []).flatMap((c) => [c.name, c.nameKo, c.nameEn]),
    ...(cats.income || []).flatMap((c) => [c.name, c.nameKo, c.nameEn]),
    ...(s.methods || []).map((m) => m.name),
    ...(s.goal && s.goal.name ? [s.goal.name] : []),
    ...(s.recurring || []).map((r) => r.memo)
  ].filter(Boolean).filter((n) => !stock.has(n));
}


/* 분류 name 은 내역·반복·적립률이 참조하는 안정적인 키라 언어를 바꿔도 손대지 않는다.
   예전 동작과의 호환을 위해 기본 결제수단 이름만 빈 가계부의 영어 첫 실행에서 바꾼다. */
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
bindLink();
bindUpdateBar();
init().then(() => {
  setupServiceWorker();
  checkDesktopUpdate();
  setInterval(checkDesktopUpdate, 6 * 60 * 60 * 1000);
});
