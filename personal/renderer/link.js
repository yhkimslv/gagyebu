/* 커플 가계부 → 내 가계부 가져오기
 *
 * 카드에 실제로 찍힌 금액과 내가 최종 부담한 소비액은 서로 다를 수 있다.
 * 예를 들어 내가 $100 을 먼저 결제한 반반 지출은 카드 잔액에는 $100 이지만,
 * 이번 달 지출·예산·통계에는 내 몫 $50 만 잡혀야 한다. 그래서:
 *
 *   · amount          실제 결제/이체액 (카드·계좌 잔액용)
 *   · personalAmount  내 최종 부담액 (월 지출·예산·통계용)
 *
 * 을 따로 보존한다. 상대가 먼저 낸 함께 지출도 내 몫은 있으므로 가져오되,
 * method 를 비워 내 카드 잔액에는 영향을 주지 않는다. 정산 송금·수금은 이미
 * 원래 지출의 personalAmount 에 반영된 돈이므로 소비 통계에서는 0 으로 둔다.
 *
 * 가져온 기록은 id 를 'cp_<원본id>' 로 만들어, 몇 번을 돌려도 겹쳐 쌓이지 않는다.
 * 원본이 바뀌면 따라 바뀌고, 원본을 지우면 여기서도 사라진다.
 */
window.Link = (function () {
  const SHARE_VERSION = 1;
  const msg = (ko, en) => (window.I18n && I18n.lang === 'en' ? en : ko);
  /* 커플 앱과 개인 앱에서 뜻은 같지만 기본 이름이 다른 분류 */
  const CAT_KEY_MAP = { '데이트': 'leisure', 'Dates': 'leisure' };

  function cfgOf(s) {
    const L = s.link || {};
    if (!L.on) return null;
    const url = Sync.normalizeUrl(L.url);
    const key = (L.key || '').trim().replace(/\s+/g, '');
    const code = (L.code || '').trim();
    const me = (L.myName || '').trim();
    return url && key && code && me ? { url, key, code, me } : null;
  }

  async function req(c, pathq) {
    const res = await fetch(c.url + '/rest/v1/' + pathq, {
      headers: { apikey: c.key, Authorization: 'Bearer ' + c.key }
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new Error(msg(
          '커플 가계부의 anon public 키가 맞는지 확인해주세요.',
          'Check the couple ledger anon public key.'));
      }
      throw new Error(msg('커플 가계부를 읽지 못했어요', 'Could not read the couple ledger') +
        ' (HTTP ' + res.status + ') ' + t.slice(0, 80));
    }
    return res.json();
  }

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function unitOf(data) { return data.settings.currency === 'USD' ? 100 : 1; }
  function toUnits(data, value) { return Math.round((num(value, 0) || 0) * unitOf(data)); }
  function fromUnits(data, value) { return value / unitOf(data); }

  /* split_ratio 는 예전 자료에서 0%도 가능하다. `|| 50` 을 쓰면 0이 50으로
     바뀌므로 유효 범위를 직접 검사한다. */
  function ratioOf(value) {
    const n = num(value, 50);
    return Math.max(0, Math.min(100, n)) / 100;
  }

  async function shareTerms(c) {
    let rows;
    try {
      rows = await req(c, 'couple_meta?couple_code=eq.' + encodeURIComponent(c.code) +
        '&select=split_ratio,fixed_share,categories,members,updated_at,extra&limit=1');
    } catch (err) {
      /* 아주 오래된 표에 extra 칸이 없으면 50:50 호환 모드로라도 읽는다. */
      if (!/extra|column/i.test(err.message || '')) throw err;
      rows = await req(c, 'couple_meta?couple_code=eq.' + encodeURIComponent(c.code) +
        '&select=split_ratio,fixed_share,categories,members,updated_at&limit=1');
    }
    const m = (rows && rows[0]) || {};
    const x = m.extra || {};
    const share = x.shareConfig || {};
    const ratio = num(share.ratioPercent, num(m.split_ratio, 50));
    const fixed = num(share.fixedAmount, num(m.fixed_share, 0));
    const out = {
      ratio,
      ratioOwner: share.ratioOwner || x.splitRatioOwner || '',
      fixed,
      fixedOwner: share.fixedOwner || x.fixedShareOwner || '',
      categories: m.categories || null,
      members: Array.isArray(m.members) ? m.members : [],
      updatedAt: m.updated_at || ''
    };
    /* updated_at 만 쓰면 일부 오래된 서버/수동 수정에서 규칙 변경을 놓칠 수 있어
       실제 계산 입력도 함께 넣는다. */
    out.key = JSON.stringify([
      out.updatedAt, out.ratio, out.ratioOwner, out.fixed, out.fixedOwner,
      out.categories
    ]);
    return out;
  }

  function categoryIsFixed(terms, name) {
    if (name === '고정지출' || name === 'Fixed costs') return true;
    const cats = terms.categories;
    const list = Array.isArray(cats) ? cats
      : (cats && Array.isArray(cats.expense) ? cats.expense : []);
    const c = list.find((it) => it && [it.name, it.nameKo, it.nameEn]
      .filter(Boolean).includes(name));
    return !!(c && c.key === 'fixed');
  }

  /* 비율 소유자가 있으면 그 사람 몫을 먼저 반올림하고, 상대 몫은 총액에서
     빼서 구한다. $13.11 반반도 $6.56 + $6.55 로 원금과 정확히 맞는다.
     구버전처럼 owner가 없으면 이 연동의 myName 기준 비율로 해석한다. */
  function ratioShareUnits(data, total, terms, me) {
    const totalUnits = toUnits(data, total);
    const ownerUnits = Math.round(totalUnits * ratioOf(terms.ratio));
    return terms.ratioOwner && terms.ratioOwner !== me
      ? totalUnits - ownerUnits : ownerUnits;
  }

  /* owner 없는 구버전 50:50 자료는 두 개인 앱이 같은 센트를 가져가지 않도록
     이름 정렬상 첫 사람을 반올림 기준자로 삼는다. 비대칭 구자료는 누구 기준인지
     알 방법이 없어 기존처럼 이 연동의 myName 기준으로 해석한다. */
  function effectiveRatioOwner(terms, me) {
    if (terms.ratioOwner) return terms.ratioOwner;
    if (Math.abs(ratioOf(terms.ratio) - 0.5) < 1e-9 && terms.members.includes(me)) {
      return terms.members.slice().filter(Boolean).sort((a, b) => a.localeCompare(b))[0] || me;
    }
    return me;
  }

  /* 이쪽에 없는 분류로 들어오면 '기타' 로 받는다 */
  function mapCategory(data, name, type) {
    const list = (data.settings.categories && data.settings.categories[type]) || [];
    const direct = list.find((c) => [c.name, c.nameKo, c.nameEn].filter(Boolean).includes(name));
    if (direct) return direct.name;
    const mapped = CAT_KEY_MAP[name];
    if (mapped) {
      const byKey = list.find((c) => c.key === mapped);
      if (byKey) return byKey.name;
    }
    const other = list.find((c) => c.key === 'other'
      || [c.name, c.nameKo, c.nameEn].includes('기타')
      || [c.name, c.nameKo, c.nameEn].includes('Other'));
    return other ? other.name : '기타';
  }

  /* 커플 기록 하나를 이쪽 기록으로 옮겨 적는다. 가져올 게 아니면 null. */
  function convert(data, r, me, terms) {
    const base = {
      id: 'cp_' + r.id,
      date: r.date,
      time: (r.extra && r.extra.time) || '',
      fromCouple: true,
      deleted: !!r.deleted
    };
    if (r.type === 'expense') {
      const mine = r.payer === me;
      const shared = (r.split || 'half') === 'half';
      if (!shared && !mine) return null;              // 상대가 혼자 쓴 돈은 내 지출이 아님
      const total = num(r.amount, 0);
      const tip = num(r.tip, 0);
      const fixed = shared && categoryIsFixed(terms, r.category);
      return { ...base, type: 'expense', amount: total,
        tip,
        /* 고정비는 같은 달 전체를 모아야 정액 부담을 나눌 수 있어서 아래
           recomputePersonalAmounts 에서 최종값을 채운다. */
        personalAmount: shared && !fixed
          ? fromUnits(data, ratioShareUnits(data, total, terms, me)) : total,
        personalTip: shared && !fixed
          ? fromUnits(data, ratioShareUnits(data, tip, terms, me)) : tip,
        method: mine ? (r.method || '') : '',
        couplePayer: r.payer || '',
        coupleSplit: shared ? 'half' : 'personal',
        coupleMethod: r.method || '',
        coupleFixed: fixed,
        coupleTransfer: false,
        category: mapCategory(data, r.category, 'expense'),
        memo: r.memo || r.category || '커플 지출' };
    }
    if (r.type === 'settle') {
      const sentByMe = r.payer === me;
      return { ...base, type: sentByMe ? 'expense' : 'income', amount: num(r.amount, 0), tip: 0,
        personalAmount: 0, personalTip: 0, reportExcluded: true,
        method: '', couplePayer: r.payer || '', coupleSplit: 'settle',
        coupleMethod: r.method || '', coupleFixed: false, coupleTransfer: true,
        category: mapCategory(data, sentByMe ? '기타' : '부수입', sentByMe ? 'expense' : 'income'),
        memo: r.memo || (sentByMe ? '커플 정산 보냄' : '커플 정산 받음') };
    }
    return null;   // 커플 가계부의 수입은 가져오지 않는다
  }

  function setPersonal(e, amount, tip) {
    const nextAmount = Number(amount) || 0;
    const nextTip = Number(tip) || 0;
    if (Number(e.personalAmount) === nextAmount && Number(e.personalTip) === nextTip) return false;
    e.personalAmount = nextAmount;
    e.personalTip = nextTip;
    e.updatedAt = new Date().toISOString();
    e.dirty = true;
    return true;
  }

  /* targetUnits 를 행들의 금액 비중대로 나누되, 남는 최소 단위(센트/원)는
     소수부가 큰 행부터 배정한다. 따라서 모든 행의 합이 target 과 정확히 같다. */
  function allocateUnits(rows, targetUnits, weightOf) {
    const weights = rows.map((e) => Math.max(0, Number(weightOf(e)) || 0));
    const total = weights.reduce((s, v) => s + v, 0);
    if (!total || targetUnits <= 0) return rows.map(() => 0);
    const parts = rows.map((e, i) => {
      const raw = targetUnits * weights[i] / total;
      const base = Math.floor(raw);
      return { i, base, frac: raw - base, key: `${e.date || ''}|${e.id || ''}` };
    });
    let left = targetUnits - parts.reduce((s, p) => s + p.base, 0);
    parts.slice().sort((a, b) => b.frac - a.frac || a.key.localeCompare(b.key))
      .forEach((p) => { if (left > 0) { parts[p.i].base++; left--; } });
    return parts.map((p) => p.base);
  }

  /* 원본 수정, 새 고정비 추가, 비율 변경 어느 경우에도 모든 자동 복사본의
     통계용 내 몫을 한 번에 맞춘다. linkDetached 는 사용자가 개인 앱에서 직접
     고친 기록이므로 건드리지 않는다. */
  function recomputePersonalAmounts(data, me, terms) {
    let changed = false;
    const rows = data.entries.filter((e) => e.fromCouple && !e.linkDetached && !e.deleted);
    const fixedByMonth = new Map();
    const ratioByMonth = new Map();

    rows.forEach((e) => {
      if (e.coupleTransfer || e.reportExcluded) {
        if (setPersonal(e, 0, 0)) changed = true;
        return;
      }
      if (e.type !== 'expense') return;
      if (e.coupleSplit !== 'half') {
        if (setPersonal(e, num(e.amount, 0), num(e.tip, 0))) changed = true;
        return;
      }
      if (e.coupleFixed && terms.fixed > 0) {
        const key = (e.date || '').slice(0, 7);
        if (!fixedByMonth.has(key)) fixedByMonth.set(key, []);
        fixedByMonth.get(key).push(e);
        return;
      }
      const key = (e.date || '').slice(0, 7);
      if (!ratioByMonth.has(key)) ratioByMonth.set(key, []);
      ratioByMonth.get(key).push(e);
    });

    /* 같은 달의 일반 공유지출을 한 번에 반올림한다. 항목마다 반올림하면
       $0.01 두 건의 50%가 $0.02가 되는 식으로 월 합계가 부풀 수 있다. */
    for (const monthRows of ratioByMonth.values()) {
      monthRows.sort((a, b) => (a.date || '').localeCompare(b.date || '')
        || (a.id || '').localeCompare(b.id || ''));
      const totalUnits = monthRows.reduce((s, e) => s + toUnits(data, e.amount), 0);
      const ownerTarget = Math.round(totalUnits * ratioOf(terms.ratio));
      const ownerAmounts = allocateUnits(monthRows, ownerTarget, (e) => toUnits(data, e.amount));
      const totalTipUnits = monthRows.reduce((s, e) => s + toUnits(data, e.tip), 0);
      const ownerTipTarget = Math.round(totalTipUnits * ratioOf(terms.ratio));
      const ownerTips = allocateUnits(monthRows, ownerTipTarget, (e) => toUnits(data, e.tip));
      const ownerIsMe = effectiveRatioOwner(terms, me) === me;
      monthRows.forEach((e, i) => {
        const amountUnits = ownerIsMe ? ownerAmounts[i] : toUnits(data, e.amount) - ownerAmounts[i];
        const tipUnits = ownerIsMe ? ownerTips[i] : toUnits(data, e.tip) - ownerTips[i];
        if (setPersonal(e, fromUnits(data, amountUnits), fromUnits(data, tipUnits))) changed = true;
      });
    }

    for (const monthRows of fixedByMonth.values()) {
      monthRows.sort((a, b) => (a.date || '').localeCompare(b.date || '')
        || (a.id || '').localeCompare(b.id || ''));
      const totalUnits = monthRows.reduce((s, e) => s + toUnits(data, e.amount), 0);
      const ownerTarget = Math.min(toUnits(data, terms.fixed), totalUnits);
      const ownerAmounts = allocateUnits(monthRows, ownerTarget, (e) => toUnits(data, e.amount));
      const totalTipUnits = monthRows.reduce((s, e) => s + toUnits(data, e.tip), 0);
      const ownerTipTarget = totalUnits > 0
        ? Math.round(totalTipUnits * ownerTarget / totalUnits) : 0;
      const ownerTips = allocateUnits(monthRows, ownerTipTarget, (e) => toUnits(data, e.tip));
      const ownerIsMe = !terms.fixedOwner || terms.fixedOwner === me;
      monthRows.forEach((e, i) => {
        const amountUnits = ownerIsMe ? ownerAmounts[i] : toUnits(data, e.amount) - ownerAmounts[i];
        const tipUnits = ownerIsMe ? ownerTips[i] : toUnits(data, e.tip) - ownerTips[i];
        if (setPersonal(e, fromUnits(data, amountUnits), fromUnits(data, tipUnits))) changed = true;
      });
    }
    return changed;
  }

  async function pull(data) {
    const s = data.settings;
    const c = cfgOf(s);
    if (!c) return { changed: false };

    const terms = await shareTerms(c);
    const fullScan = Number(s.linkShareVersion || 0) < SHARE_VERSION
      || s.linkShareMetaKey !== terms.key;
    const since = fullScan ? '1970-01-01T00:00:00Z'
      : (s.linkPullAt || '1970-01-01T00:00:00Z');
    let changed = false;
    let maxSeen = s.linkPullAt || null;
    const pageSize = 1000;
    let cursorTs = null;
    let cursorId = '';
    while (true) {
      /* 커플 원장도 (updated_at,id) 복합 커서로 끝까지 읽는다. 페이지 사이에
         상대가 앞쪽 내역을 수정해 정렬 끝으로 옮겨도 미수신 행을 건너뛰지 않는다. */
      const cursorFilter = cursorTs
        ? '&or=(updated_at.gt.' + encodeURIComponent(cursorTs)
          + ',and(updated_at.eq.' + encodeURIComponent(cursorTs)
          + ',id.gt.' + encodeURIComponent(cursorId) + '))'
        : '&updated_at=gte.' + encodeURIComponent(since);
      const rows = (await req(c, 'entries?couple_code=eq.' + encodeURIComponent(c.code) +
        cursorFilter + '&order=updated_at.asc,id.asc&limit=' + pageSize)) || [];

      for (const r of rows) {
        if (!maxSeen || r.updated_at > maxSeen) maxSeen = r.updated_at;
        const conv = convert(data, r, c.me, terms);
        const idx = data.entries.findIndex((e) => e.id === 'cp_' + r.id);

        /* 개인 가계부에서 직접 수정·삭제한 복사본은 사용자의 편집을 우선한다. */
        if (idx >= 0 && data.entries[idx].linkDetached) continue;

        if (!conv) {
          /* 가져올 대상이 아니게 됐다면(예: 낸 사람이 상대로 바뀜) 이쪽에서도 지운다 */
          if (idx >= 0 && !data.entries[idx].deleted) {
            data.entries[idx].deleted = true;
            data.entries[idx].updatedAt = new Date().toISOString();
            data.entries[idx].dirty = true;
            changed = true;
          }
          continue;
        }
        const now = new Date().toISOString();
        if (idx < 0) {
          data.entries.push({ ...conv, updatedAt: now, dirty: true });
          changed = true;
        } else {
          const cur = data.entries[idx];
          const same = ['date', 'time', 'type', 'amount', 'tip', 'personalAmount', 'personalTip',
            'category', 'memo', 'method', 'deleted', 'reportExcluded', 'couplePayer',
            'coupleSplit', 'coupleMethod', 'coupleFixed', 'coupleTransfer']
            .every((k) => String(cur[k] || '') === String(conv[k] || ''));
          if (!same) {
            Object.assign(cur, conv, { updatedAt: now, dirty: true });
            changed = true;
          }
        }
      }

      if (rows.length < pageSize) break;
      const tail = rows[rows.length - 1];
      cursorTs = tail.updated_at;
      cursorId = tail.id;
    }
    if (recomputePersonalAmounts(data, c.me, terms)) changed = true;
    if (maxSeen) s.linkPullAt = maxSeen;
    if (s.linkShareVersion !== SHARE_VERSION || s.linkShareMetaKey !== terms.key) changed = true;
    s.linkShareVersion = SHARE_VERSION;
    s.linkShareMetaKey = terms.key;
    return { changed };
  }

  /* 설정 화면에서 '연결 확인' 을 눌렀을 때 */
  async function test(s) {
    const c = cfgOf({ ...s, link: { ...(s.link || {}), on: true } });
    if (!c) throw new Error(msg('네 칸을 모두 채워주세요.', 'Fill in all four fields.'));
    const rows = await req(c, 'entries?couple_code=eq.' + encodeURIComponent(c.code) +
      '&deleted=is.false&select=payer&limit=200');
    const names = [...new Set((rows || []).map((r) => r.payer).filter(Boolean))];
    if (!names.length) throw new Error(msg(
      '그 코드로 된 기록이 없어요. 커플 코드를 확인해주세요.',
      'No entries use that code. Check the couple code.'));
    if (names.indexOf(c.me) < 0) {
      throw new Error(I18n.lang === 'en'
        ? `No entries use the name '${c.me}'. Names found in the couple ledger: ${names.join(', ')}.`
        : `'${c.me}' 라는 이름으로 된 기록이 없어요. 커플 앱에서 쓰는 이름은 ${names.join(', ')} 이에요.`);
    }
    const mine = (rows || []).filter((r) => r.payer === c.me).length;
    return { names, mine };
  }

  return { pull, test, cfgOf };
})();
