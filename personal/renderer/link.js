/* 커플 가계부 → 내 가계부 가져오기
 *
 * 커플 가계부에서 '내 돈이 실제로 오간 것'만 골라 이쪽에 자동으로 넣는다.
 *   · 내가 결제한 지출          → 지출  (카드에 그대로 청구되므로 잔액에 반영돼야 한다)
 *   · 내가 보낸 정산·선입금      → 지출  (내 통장에서 나간 돈)
 *   · 상대가 나에게 보낸 정산    → 수입  (내 통장으로 들어온 돈)
 *
 * 커플 가계부의 '수입'은 가져오지 않는다.
 * 그건 둘이 쓰기로 정해둔 몫이라, 내 통장에서 언제 나갔는지와는 다른 이야기다.
 *
 * 가져온 기록은 id 를 'cp_<원본id>' 로 만들어, 몇 번을 돌려도 겹쳐 쌓이지 않는다.
 * 원본이 바뀌면 따라 바뀌고, 원본을 지우면 여기서도 사라진다.
 */
window.Link = (function () {
  /* 커플 앱과 이쪽의 분류 이름이 다른 것만 맞춰준다 */
  const CAT_MAP = { '데이트': '문화·여가' };

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
        throw new Error('커플 가계부의 anon public 키가 맞는지 확인해주세요.');
      }
      throw new Error('커플 가계부를 읽지 못했어요 (HTTP ' + res.status + ') ' + t.slice(0, 80));
    }
    return res.json();
  }

  /* 이쪽에 없는 분류로 들어오면 '기타' 로 받는다 */
  function mapCategory(data, name, type) {
    const want = CAT_MAP[name] || name;
    const list = (data.settings.categories && data.settings.categories[type]) || [];
    return list.some((c) => c.name === want) ? want : '기타';
  }

  /* 커플 기록 하나를 이쪽 기록으로 옮겨 적는다. 가져올 게 아니면 null. */
  function convert(data, r, me) {
    const base = {
      id: 'cp_' + r.id,
      date: r.date,
      time: (r.extra && r.extra.time) || '',
      method: r.method || '',
      fromCouple: true,
      deleted: !!r.deleted
    };
    if (r.type === 'expense') {
      if (r.payer !== me) return null;                 // 상대가 낸 건 내 통장과 무관
      return { ...base, type: 'expense', amount: Number(r.amount),
        tip: Number(r.tip) || 0,
        category: mapCategory(data, r.category, 'expense'),
        memo: r.memo || r.category || '커플 지출' };
    }
    if (r.type === 'settle') {
      const sentByMe = r.payer === me;
      return { ...base, type: sentByMe ? 'expense' : 'income', amount: Number(r.amount), tip: 0,
        category: mapCategory(data, sentByMe ? '기타' : '부수입', sentByMe ? 'expense' : 'income'),
        memo: r.memo || (sentByMe ? '커플 정산 보냄' : '커플 정산 받음') };
    }
    return null;   // 커플 가계부의 수입은 가져오지 않는다
  }

  async function pull(data) {
    const s = data.settings;
    const c = cfgOf(s);
    if (!c) return { changed: false };

    const since = s.linkPullAt || '1970-01-01T00:00:00Z';
    const rows = await req(c, 'entries?couple_code=eq.' + encodeURIComponent(c.code) +
      '&updated_at=gte.' + encodeURIComponent(since) + '&order=updated_at.asc&limit=2000');

    let changed = false;
    let maxSeen = s.linkPullAt || null;
    for (const r of rows || []) {
      if (!maxSeen || r.updated_at > maxSeen) maxSeen = r.updated_at;
      const conv = convert(data, r, c.me);
      const idx = data.entries.findIndex((e) => e.id === 'cp_' + r.id);

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
        const same = ['date', 'time', 'type', 'amount', 'category', 'memo', 'method', 'deleted']
          .every((k) => String(cur[k] || '') === String(conv[k] || ''));
        if (!same) {
          Object.assign(cur, conv, { updatedAt: now, dirty: true });
          changed = true;
        }
      }
    }
    if (maxSeen) s.linkPullAt = maxSeen;
    return { changed };
  }

  /* 설정 화면에서 '연결 확인' 을 눌렀을 때 */
  async function test(s) {
    const c = cfgOf({ ...s, link: { ...(s.link || {}), on: true } });
    if (!c) throw new Error('네 칸을 모두 채워주세요.');
    const rows = await req(c, 'entries?couple_code=eq.' + encodeURIComponent(c.code) +
      '&deleted=is.false&select=payer&limit=200');
    const names = [...new Set((rows || []).map((r) => r.payer).filter(Boolean))];
    if (!names.length) throw new Error('그 코드로 된 기록이 없어요. 커플 코드를 확인해주세요.');
    if (names.indexOf(c.me) < 0) {
      throw new Error(`'${c.me}' 라는 이름으로 된 기록이 없어요. 커플 앱에서 쓰는 이름은 ${names.join(', ')} 이에요.`);
    }
    const mine = (rows || []).filter((r) => r.payer === c.me).length;
    return { names, mine };
  }

  return { pull, test, cfgOf };
})();
