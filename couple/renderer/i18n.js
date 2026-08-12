/* 화면 말 바꾸기 (한국어 ↔ English)
 *
 * 소스에 박힌 문장 수백 개를 t('...') 로 일일이 감싸는 대신,
 * 이미 그려진 화면의 글자를 사전에서 찾아 바꾼다.
 *
 * 이렇게 하는 이유:
 *   화면을 만드는 코드가 대부분 HTML 조각(템플릿 문자열)이라, 그 안의 글자만
 *   골라 감싸려면 코드가 온통 t() 로 뒤덮인다. 다 그린 뒤 한 번 훑는 편이
 *   손댈 곳도 적고, 새 화면을 만들어도 저절로 따라온다.
 *
 * 한국어일 때는 아무 일도 하지 않는다 (곧바로 빠져나간다).
 *
 * 사람이 적어 넣은 말(분류 이름, 결제수단 이름, 두 사람 이름, 메모)은
 * 건드리면 안 되므로 userWords() 로 받아서 건너뛴다.
 */
window.I18n = (function () {
  /* 한국어 원문 → 영어. 없는 말은 한국어 그대로 둔다. */
  const EN = {
    /* --- 머리말·탭 --- */
    '우리 가계부': 'Our Ledger',
    '우리 두 사람 (눌러서 설정)': 'The two of us (tap to set up)',
    '내역': 'Entries', '달력': 'Calendar', '통계': 'Stats', '정산': 'Settle',
    '＋ 입력': '＋ Add', '설정': 'Settings',
    '이전 달': 'Previous month', '다음 달': 'Next month', '눌러서 이번 달로': 'Tap for this month',
    '공유 상태': 'Sync status', '닫기': 'Close',

    /* --- 요약 --- */
    '이번 달 지출': "This month's spending",
    '이번 달 생활비': "This month's living costs",
    '고정지출 빼고': 'excluding fixed costs',
    '월세·유틸리티': 'rent & utilities',
    '넣은 돈': 'Money in', '생활비 몫만': 'living costs only',
    '남은 돈': 'Left', '수입': 'Income', '지출': 'Expense',
    '예산': 'Budget', '지난달보다': 'vs last month',
    '더 썼어요': 'more', '아꼈어요': 'less', '지난달과 같아요': 'Same as last month',
    '남음': 'left', '초과': 'over', '고정지출': 'Fixed costs',

    /* --- 입력 --- */
    '식사비 (팁 전)': 'Bill (before tip)',
    '어디에 썼는지 적어주세요': 'What did you spend on?',
    '어떤 수입인지 적어주세요': 'What kind of income?',
    '날짜': 'Date', '시간': 'Time', '(비워도 돼요)': '(optional)',
    '누가 냈어요?': 'Who paid?', '어떻게 결제했어요?': 'How did you pay?',
    '금액': 'Amount', '메모': 'Note', '합계': 'Total', '직접': 'Custom',
    '저장': 'Save', '취소': 'Cancel', '삭제': 'Delete', '확인': 'OK',
    '추가': 'Add', '끄기': 'Turn off', '켜기': 'Turn on', '없음': 'None',
    '같이 쓴 돈': 'Shared', '혼자 쓴 돈': 'Personal',
    '정산에는 안 들어가요': 'Not counted in settling up',
    '이번 달 예산에서 빼기': "Leave out of this month's budget",
    '가전·수리비처럼 갑자기 생긴 돈. 남은 돈이 줄지 않고, 그만큼 둘이 더 넣게 돼요.':
      "For one-offs like an appliance or a repair. It won't reduce what's left; you'll each chip in extra instead.",
    '예산 밖 지출 때문에 추가로 넣은 돈. 생활비 통장에 더해지지 않아요.':
      "Extra money added because of out-of-budget spending. It won't count toward the living-costs pot.",
    '금액을 넣어주세요': 'Enter an amount',
    '식사비를 먼저 넣어주세요': 'Enter the bill amount first',
    '이 내역을 삭제할까요?': 'Delete this entry?',
    '되돌릴 수 없어요.': "This can't be undone.",
    '(내용 없음)': '(no description)',
    '자동': 'auto', '예산 밖': 'off-budget',

    /* --- 목록·달력·통계 --- */
    '내용·분류·이름 검색': 'Search notes, categories, names',
    '모든 분류': 'All categories', '둘 다': 'Both',
    '조건에 맞는 내역이 없어요': 'No entries match',
    '아직 내역이 없어요.': 'No entries yet.',
    '이 날은 쓴 돈이 없어요': 'Nothing spent this day',
    '이번 달 지출이 없어서 보여줄 통계가 없어요': 'No spending this month, so there are no stats yet',
    '분류별 지출': 'Spending by category',
    '결제수단별 지출': 'Spending by payment method',
    '일별 지출': 'Daily spending',
    '둘이 쓴 돈 비교': 'Who spent what',
    '지출 없음': 'No spending',
    '오른쪽 위': 'top right', '으로 시작해보세요!': 'to get started!',
    '오전': 'AM', '오후': 'PM', '요일': '',

    /* --- 정산 --- */
    '지금 정산하면': 'Settle up now',
    '정산 완료로 기록': 'Mark as settled',
    '정산 완료로 기록할까요?': 'Mark this as settled?',
    '정산이 기록됐어요 ✨': 'Settlement recorded ✨',
    '✨ 정산할 게 없어요, 깔끔합니다!': "✨ Nothing to settle — you're square!",
    '함께 쓴 돈이 딱 맞게 나눠져 있어요': 'Shared spending is split evenly',
    '돈 보낸 기록': 'Record a transfer',
    '월초에 고정비를 미리 보냈거나, 일부만 정산했을 때 기록해두는 곳이에요.':
      'For when you sent fixed costs up front, or settled only part of it.',
    '누가 보냈어요?': 'Who sent it?', '누가 받았어요?': 'Who received it?',
    '어느 달 고정비 몫인가요?': 'Which month are these fixed costs for?',
    '정산 기록': 'Transfers', '보낸 돈': 'Sent',
    '이 기록을 삭제할까요?': 'Delete this record?',
    '정산 잔액이 다시 계산됩니다.': 'The settlement balance will be recalculated.',
    '이번 달 고정비': "This month's fixed costs",
    '✨ 이번 달 고정비 정리 완료': '✨ Fixed costs are settled for this month',
    '아직 이번 달 고정비가 입력되지 않았어요': "This month's fixed costs haven't been entered yet",
    '내 정액 부담': 'My fixed share', '청구됨': 'charged', '중': 'of',
    '더 보내면 이번 달 고정비가 맞아요': 'more needed to cover this month',
    '보낸 돈에서': 'Of what you sent,',
    '남았어요 (아직 안 나온 청구서가 있으면 여기서 빠져나갑니다)':
      'is unused (later bills come out of this)',
    '고정비 총': 'Fixed costs',
    '이번 달 예산 밖 지출': "This month's out-of-budget spending",
    '매달 넣는 생활비에서 쓴 게 아니라, 이만큼': "This wasn't paid from the monthly pot — it's what you each need to add",
    '이번 달 함께 쓴 돈': 'Shared this month',
    '아직 함께 쓴 돈이 없어요': 'Nothing shared yet',
    '함께 모으기': 'Saving together', '모은 돈': 'Saved', '🎉 목표 달성!': '🎉 Goal reached!',

    /* --- 설정 --- */
    '우리 두 사람': 'The two of us',
    '내 이름': 'My name', '상대 이름': "Partner's name",
    '상대 이름은 대충 적으셔도 돼요. 나중에 연동하면 상대가 쓰는 이름으로 자동으로 맞춰집니다.':
      "Don't worry about spelling your partner's name — it syncs to whatever they use once you connect.",
    '커플 공유를 켜면 상대 이름이 자동으로 맞춰집니다.':
      "Turn on sharing and your partner's name will match automatically.",
    '상대가 연결되면 상대 이름이 자동으로 맞춰져요.':
      "Once your partner connects, their name will match automatically.",
    '✓ 두 사람 이름이 맞춰졌어요. 상대 이름은 자동으로 유지됩니다.':
      "✓ Both names are matched. Your partner's name stays in sync.",
    '함께 쓴 돈, 내가 낼 비율 —': 'My share of shared spending —',
    '함께 쓴 돈을 정확히 반반씩 부담해요': 'Shared spending is split exactly in half',
    '고정지출은 내가 정액으로 부담 (0이면 위 비율 적용)':
      'I cover a fixed amount of the fixed costs (0 uses the ratio above)',
    '지금은 고정지출도 위 비율로 나눠요': 'Fixed costs currently use the ratio above',
    '예산과 통화': 'Budget and currency',
    '한 달 예산 (0이면 사용 안 함)': 'Monthly budget (0 to turn off)',
    '통화': 'Currency', '원 (₩)': 'Korean won (₩)', '달러 ($)': 'US dollar ($)',
    '함께 모으기 (저축 목표)': 'Saving together (goal)',
    '목표 이름': 'Goal name', '목표 금액 (0이면 사용 안 함)': 'Goal amount (0 to turn off)',
    '반복 지출': 'Recurring expenses',
    '월세·구독료처럼 매달 나가는 돈을 등록하면 자동으로 입력돼요.':
      'Add things like rent or subscriptions and they get entered automatically each month.',
    '내용 (예: 월세)': 'Description (e.g. Rent)',
    '날짜·내용·금액을 모두 넣어주세요': 'Fill in the day, description and amount',
    '결제수단 관리': 'Payment methods',
    '카드를 미리 등록해두면 입력할 때 한 번만 누르면 돼요. 두 사람이 함께 보는 목록입니다.':
      'Register your cards once and picking them is a single tap. Both of you see this list.',
    '결제수단 추가': 'Add payment method', '결제수단 수정': 'Edit payment method',
    '결제수단': 'Payment method', '결제수단 없음': 'No payment method',
    '신용카드': 'Credit', '체크카드': 'Debit', '현금·기타': 'Cash / other',
    '신용': 'Credit', '체크': 'Debit', '현금': 'Cash',
    '결제일 (매달 며칠, 비워도 됨)': 'Statement day (optional)',
    '혜택 메모': 'Perks note', '예: 연회비 $95, 여행보험 포함': 'e.g. $95 annual fee, travel insurance',
    '분류별 적립률 (%) — 비워두면 기본값을 씁니다': 'Reward rate by category (%) — blank uses the base rate',
    '그 외 기본': 'Base rate', '그 외': 'otherwise',
    '이름을 넣어주세요': 'Enter a name',
    '분류 관리': 'Categories', '지출 분류': 'Expense categories', '수입 분류': 'Income categories',
    '아이콘': 'Icon', '이름': 'Name', '종류': 'Type', '나눔': 'Split',
    '팁 계산 켜기/끄기': 'Turn tip calculation on/off',
    '같이': 'Shared', '혼자': 'Personal', '개인': 'Personal', '함께': 'Shared',
    '예: 🐶 반려동물 (이모지 생략 가능)': 'e.g. 🐶 Pets (emoji optional)',

    /* --- 커플 공유 --- */
    '커플 공유 (동기화)': 'Sharing with your partner',
    '커플 코드': 'Couple code', '새 코드 만들기': 'Generate a code',
    'anon public 키': 'anon public key',
    '지금 동기화': 'Sync now', '동기화 중…': 'Syncing…', '동기화됨': 'Synced',
    '공유 꺼짐': 'Sharing off', '오프라인': 'Offline', '대기 중': 'Waiting',
    '연결을 확인해주세요': 'Check your connection',
    '눌러서 지금 동기화': 'Tap to sync now',
    '눌러서 커플 공유 설정하기': 'Tap to set up sharing',
    'URL·키·커플 코드를 모두 넣어주세요.': 'Fill in the URL, key and couple code.',
    '✓ 연결됐어요! 이제 둘의 가계부가 합쳐집니다.': '✓ Connected. Your ledgers are now merged.',
    '⚠ 실패:': '⚠ Failed:',
    '⚠ 이 세 값을 아는 사람은 가계부를 볼 수 있어요. 둘만 알고 계세요.':
      '⚠ Anyone with these three values can read your ledger. Keep them between you.',
    '공유 저장소 만드는 방법 (무료, 5분)': 'How to set up shared storage (free, 5 min)',

    /* --- 알림 --- */
    '알림': 'Notifications', '알림 켜짐': 'Notifications on', '알림 꺼짐': 'Notifications off',
    '알림을 켰어요 🔔': 'Notifications on 🔔', '알림을 껐어요': 'Notifications off',
    '알림을 켜지 못했어요': "Couldn't turn on notifications",
    '알림 권한이 필요해요': 'Notification permission is needed',
    '상대가 입력하거나 정산할 금액이 생기면 폰으로 알려드려요.':
      'Get a phone alert when your partner adds something or a settlement comes up.',
    '아이폰은 홈 화면에 추가한 앱': 'On iPhone, only apps added to the Home Screen',
    '에서만 알림을 받을 수 있어요.': 'can receive notifications.',
    '상대가 지출·수입을 입력했을 때': 'When your partner adds an expense or income',
    '정산할 금액이 생겼을 때': 'When there is something to settle',
    '고정비 결제일 (매달 1일)': 'Fixed-cost day (1st of the month)',
    '앱 업데이트가 나왔을 때': 'When an app update is out',
    '이 브라우저는 알림을 지원하지 않아요.': "This browser doesn't support notifications.",
    '이 앱은 알림이 설정돼 있지 않아요. (배포할 때 알림용 키가 필요합니다)':
      'This build has no notification key set up.',
    '알림이 차단돼 있어요. 브라우저 주소창의 자물쇠를 눌러 알림을 허용해주세요.':
      'Notifications are blocked. Allow them from the padlock in the address bar.',
    '데스크톱 앱에서는 폰 알림을 쓰지 않아요. 아이폰 홈 화면 앱에서 켜주세요.':
      'Phone alerts are for the iPhone Home Screen app, not the desktop app.',

    /* --- 데이터·업데이트 --- */
    'CSV 내보내기 (이번 달)': 'Export CSV (this month)',
    'CSV 내보내기 (전체)': 'Export CSV (all)',
    'CSV 파일을 저장했어요': 'CSV file saved',
    '구분': 'Type', '내용': 'Note', '낸사람': 'Paid by',
    '새 버전이 준비됐어요': 'A new version is ready',
    '누르면 바로 최신 화면으로 바뀝니다': 'Tap to switch to the latest version',
    '업데이트': 'Update', '나중에': 'Later', '적용 중…': 'Applying…',
    '받은 파일을 실행하면 업데이트됩니다': 'Run the downloaded file to update',
    '기록했어요': 'Saved',

    /* --- 첫 화면 --- */
    '우리 가계부에 오신 걸 환영해요': 'Welcome to Our Ledger',
    '두 사람 이름을 알려주세요.': 'Tell us both your names.',
    '누가 얼마 썼는지, 정산은 얼마인지 자동으로 계산해드릴게요.':
      "We'll work out who spent what and who owes whom.",
    '시작하기': 'Get started', '이름 설정': 'Set names',
    '연결되면 자동으로 합쳐져요': 'Merges automatically once connected',

    /* --- 분류·수입 기본 이름 (설정에서 바꾼 이름은 그대로 둔다) --- */
    '식비': 'Food', '카페·간식': 'Cafe & snacks', '장보기·마트': 'Groceries',
    '교통·차량': 'Transport', '데이트': 'Dates', '저축': 'Savings',
    '쇼핑·미용': 'Shopping & beauty', '기타': 'Other',
    '월급': 'Salary', '용돈': 'Allowance', '부수입': 'Side income'
  };

  /* 숫자·금액이 사이에 끼어 통째로 못 찾는 문장에서 부분만 바꿀 말들.
     짧은 말은 남의 메모를 건드릴 수 있어 넣지 않는다. */
  const PARTIAL = {
    '예산 밖': 'off-budget', '은 따로 더 넣어요': ' is added separately',
    '남음': 'left', '초과': 'over',
    '남은 예산': 'left in budget',
    '지난달보다': 'vs last month', '더 썼어요': 'more', '아꼈어요': 'less',
    '님이 지출을 입력했어요': ' added an expense',
    '님에게 보내면 정산 끝!': " — then you're square!",
    '님이': ' →', '님에게': ' to',
    '내 정액 부담': 'My fixed share', '청구됨': 'charged',
    '보낸 돈': 'Sent', '고정비 총': 'Fixed costs',
    '함께 쓴 돈은': 'Shared spending:', '로 나눠요': '',
    '시작': 'start', '이후 사용': 'since', '갚음': 'paid',
    '외': 'and', '건 더 있어요': ' more',
    '전체 지출의': 'of all spending',
    '목표까지': 'to goal', '모은 돈': 'Saved',
    '예산': 'Budget', '월 몫': ' share'
  };

  /* 숫자가 섞여 통째로 못 찾는 말들 */
  const DOW_EN = { '일': 'Sun', '월': 'Mon', '화': 'Tue', '수': 'Wed', '목': 'Thu', '금': 'Fri', '토': 'Sat' };
  const MON_EN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const RULES = [
    [/^예산 (.+) 중 (.+) 남음$/, (m) => `${m[2]} left of ${m[1]}`],
    [/^⚠ 예산 (.+) 초과$/, (m) => `${m[1]} over budget`],
    [/^남은 예산 (.+)$/, (m) => `${m[1]} left`],
    [/^⚠ (.+) 초과$/, (m) => `${m[1]} over`],
    [/^(.+)님이 (.+)님에게 보내면 정산 끝!$/, (m) => `${m[1]} pays ${m[2]} and you're square!`],
    [/^(.+) 더 보내면 이번 달 고정비가 맞아요$/, (m) => `Send ${m[1]} more to cover this month`],
    [/^보낸 돈에서 (.+) 남았어요 \(아직 안 나온 청구서가 있으면 여기서 빠져나갑니다\)$/,
      (m) => `${m[1]} of what you sent is unused (later bills come out of this)`],
    [/^예산 밖 (.+) 은 따로 더 넣어요$/, (m) => `${m[1]} off-budget, added separately`],
    [/^\+ 예산 밖 (.+)$/, (m) => `+ ${m[1]} off-budget`],
    [/^목표까지 (.+)$/, (m) => `${m[1]} to go`],
    [/^이번 달 (.+) 갚았어요 👏$/, (m) => `${m[1]} paid this month 👏`],
    [/^(\d+)년 (\d+)월$/, (m) => `${MON_EN[+m[2]]} ${m[1]}`],
    [/^(\d+)월 (\d+)일$/, (m) => `${MON_EN[+m[1]]} ${m[2]}`],
    [/^(\d+)월 (\d+)일 \((.)\)$/, (m) => `${MON_EN[+m[1]]} ${m[2]} (${DOW_EN[m[3]] || m[3]})`],
    [/^(.)요일$/, (m) => DOW_EN[m[1]] || m[1]],
    [/^오전 (\d+):(\d+)$/, (m) => `${m[1]}:${m[2]} AM`],
    [/^오후 (\d+):(\d+)$/, (m) => `${m[1]}:${m[2]} PM`],
    [/^(\d+)월 몫$/, (m) => `for ${MON_EN[+m[1]]}`],
    [/^(\d+)건$/, (m) => `${m[1]} ${+m[1] === 1 ? 'entry' : 'entries'}`],
    [/^외 (\d+)건 더 있어요$/, (m) => `and ${m[1]} more`],
    [/^매달 (\d+)일$/, (m) => `Monthly on the ${m[1]}`],
    [/^(\d+)일 결제$/, (m) => `bills on the ${m[1]}`]
  ];

  let lang = 'ko';
  let userWords = () => [];

  function resolve(setting) {
    if (setting === 'ko' || setting === 'en') return setting;
    return /^ko\b/i.test(navigator.language || '') ? 'ko' : 'en';   // 'auto'
  }

  /* 코드에서 직접 쓰는 번역 */
  function t(ko, vars) {
    let s = (lang === 'en' && EN[ko] !== undefined) ? EN[ko] : ko;
    if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  function look(str) {
    const s = str.trim();
    if (!s) return null;
    if (EN[s] !== undefined) return EN[s];
    for (const [re, fn] of RULES) { const m = s.match(re); if (m) return fn(m); }
    return null;
  }

  /* 통째로 못 찾았을 때, 문장 안의 아는 말만 골라 바꾼다.
     긴 말부터 바꿔야 짧은 말이 먼저 먹어치우지 않는다. */
  let partialKeys = null;
  function partial(str, mine) {
    if (partialKeys === null) {
      partialKeys = Object.keys(PARTIAL).sort((a, b) => b.length - a.length);
    }
    let out = str
      .replace(/오전 (\d+):(\d+)/g, '$1:$2 AM')
      .replace(/오후 (\d+):(\d+)/g, '$1:$2 PM')
      .replace(/(\d+)월 (\d+)일/g, (m, a, b) => `${MON_EN[+a]} ${b}`)
      .replace(/(\d+)년 (\d+)월/g, (m, a, b) => `${MON_EN[+b]} ${a}`);
    for (const k of partialKeys) {
      if (mine.has(k)) continue;              // 사람이 쓰는 말이면 건드리지 않는다
      if (out.includes(k)) out = out.split(k).join(PARTIAL[k]);
    }
    out = out.replace(/ {2,}/g, ' ');
    return out === str ? null : out;
  }

  const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1 };

  /* 그려진 화면의 글자를 바꾼다. 사람이 적어 넣은 말은 건드리지 않는다. */
  function translateDom(root) {
    if (lang !== 'en' || !root) return;
    const mine = new Set(userWords());
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (SKIP_TAGS[n.parentNode && n.parentNode.nodeName]) return NodeFilter.FILTER_REJECT;
        return /[가-힣]/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const hits = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) hits.push(n);
    for (const n of hits) {
      const raw = n.nodeValue;
      const s = raw.trim();
      if (mine.has(s)) continue;                       // 분류·카드·사람 이름은 그대로
      let to = look(s);
      if (to === null) to = partial(s, mine);
      if (to !== null) n.nodeValue = raw.replace(s, to);
    }
    /* 입력칸 안내문과 말풍선도 */
    const els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[aria-label]') : [];
    els.forEach((el) => {
      ['placeholder', 'title', 'aria-label'].forEach((a) => {
        const v = el.getAttribute(a);
        if (!v || !/[가-힣]/.test(v)) return;
        if (mine.has(v.trim())) return;
        const to = look(v);
        if (to !== null) el.setAttribute(a, to);
      });
    });
  }

  /* 새로 그려지는 화면도 자동으로 따라오게 한다 */
  let observer = null;
  function watch() {
    if (observer || lang !== 'en' || !window.MutationObserver) return;
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) translateDom(node);
          else if (node.nodeType === 3 && /[가-힣]/.test(node.nodeValue)) {
            const s = node.nodeValue.trim();
            if (new Set(userWords()).has(s)) continue;
            const to = look(s);
            if (to !== null) node.nodeValue = node.nodeValue.replace(s, to);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function unwatch() { if (observer) { observer.disconnect(); observer = null; } }

  function setLang(next, words) {
    const before = lang;
    lang = resolve(next);
    if (words) userWords = words;
    if (lang === 'en') { translateDom(document.body); watch(); }
    else if (before === 'en') { unwatch(); location.reload(); }   // 한국어로 되돌릴 땐 새로 그린다
  }

  return { t, setLang, resolve, translateDom, watch, get lang() { return lang; } };
})();
