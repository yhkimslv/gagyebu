/* 내 기기끼리 동기화 (Supabase REST)
 * - 로컬 우선(오프라인에서도 동작), 연결되면 올리고(push) 받아오기(pull)
 * - 여러 기기에서 고쳤으면 updated_at 이 나중인 쪽이 이김
 * - 삭제는 deleted 플래그(tombstone)로 전파
 */
window.Sync = (function () {
  let cfg = null;
  let extraOk = true;   // Supabase 에 extra 칸이 있는지 (없으면 빼고 보낸다)
  const status = { state: 'off', lastSyncAt: null, error: null, running: false };
  const listeners = [];
  function emit() { listeners.forEach((fn) => fn(status)); }

  /* 붙여넣은 Project URL 을 정리한다.
     Supabase 화면에서 복사하면 뒤에 /rest/v1 같은 경로가 함께 붙어 오는 경우가 있는데,
     그대로 두면 요청 주소가 /rest/v1/rest/v1/... 로 겹쳐져 404(PGRST125) 가 난다. */
  function normalizeUrl(raw) {
    let u = (raw || '').trim().replace(/\s+/g, '');
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
      const parsed = new URL(u);
      return parsed.origin;            // 경로·쿼리·해시는 모두 버린다
    } catch (e) {
      return u.replace(/\/+$/, '');
    }
  }

  function configure(s) {
    const url = normalizeUrl(s.supabaseUrl);
    const key = (s.supabaseKey || '').trim().replace(/\s+/g, '');
    const code = (s.coupleCode || '').trim();
    cfg = url && key && code ? { url, key, code } : null;
    if (!cfg) { status.state = 'off'; status.error = null; }
    else if (status.state === 'off') status.state = 'idle';
    emit();
  }

  /* 원문 오류를 사용자가 뭘 고쳐야 하는지 알 수 있는 문장으로 바꾼다 */
  function friendlyError(status, body) {
    const b = body || '';
    if (status === 404 && b.includes('PGRST125')) {
      return 'Project URL 을 확인해주세요. 뒤에 /rest/v1 같은 주소가 붙어 있으면 지우고 https://xxxx.supabase.co 형태만 넣으면 됩니다.';
    }
    if (status === 404 && (b.includes('PGRST205') || b.includes('Could not find the table'))) {
      return 'Supabase 에 표가 아직 없어요. SQL Editor 에서 supabase_setup.sql 을 실행했는지 확인해주세요.';
    }
    if (status === 401 || status === 403) {
      return 'anon public 키가 맞는지 확인해주세요. (service_role 키가 아니라 anon public 키입니다)';
    }
    if (status === 400 && b.includes('column')) {
      return 'Supabase 표에 칸이 부족해요. supabase_setup.sql 을 다시 한 번 실행해주세요.';
    }
    return 'HTTP ' + status + ' ' + b.slice(0, 200);
  }

  async function req(pathq, opts = {}) {
    let res;
    try {
      res = await fetch(cfg.url + '/rest/v1/' + pathq, {
        ...opts,
        headers: {
          apikey: cfg.key,
          Authorization: 'Bearer ' + cfg.key,
          'Content-Type': 'application/json',
          ...(opts.headers || {})
        }
      });
    } catch (e) {
      // 인터넷이 끊겼거나 Project URL 이 잘못된 주소일 때
      throw new Error(navigator.onLine === false
        ? '인터넷에 연결되면 자동으로 동기화됩니다.'
        : '서버에 연결할 수 없어요. Project URL 이 맞는지 확인해주세요.');
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(friendlyError(res.status, t));
    }
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  }

  /* 아래 목록에 없는 항목은 extra 칸에 담아 보낸다.
     그래야 앞으로 기능이 늘어도 Supabase 에 칸을 새로 만들 필요가 없다. */
  const EXTRA_SKIP = ['dirty', 'updatedAt'];
  function packExtra(e, known) {
    const extra = {};
    for (const k of Object.keys(e)) {
      if (known.indexOf(k) >= 0 || EXTRA_SKIP.indexOf(k) >= 0) continue;
      extra[k] = e[k];
    }
    return Object.keys(extra).length ? extra : null;
  }

  function toRow(e) {
    return {
      id: e.id,
      couple_code: cfg.code,
      date: e.date,
      type: e.type,
      amount: e.amount,
      category: e.category || null,
      memo: e.memo || null,
      member: e.member || null,
      method: e.method || null,
      tip: e.tip || 0,
      auto: !!e.auto,
      updated_at: e.updatedAt,
      deleted: !!e.deleted,
      ...(extraOk ? { extra: packExtra(e, ['id', 'date', 'type', 'amount', 'category', 'memo',
        'member', 'payer', 'split', 'tip', 'method', 'auto', 'deleted']) } : {})
    };
  }
  function fromRow(r) {
    return {
      id: r.id,
      date: r.date,
      type: r.type,
      amount: Number(r.amount),
      category: r.category || '',
      memo: r.memo || '',
      member: r.member || '',
      method: r.method || '',
      tip: Number(r.tip) || 0,
      auto: !!r.auto,
      updatedAt: r.updated_at,
      deleted: !!r.deleted,
      ...(r.extra || {})
    };
  }

  async function syncNow(data) {
    if (!cfg || status.running) return { changed: false };
    status.running = true;
    status.state = 'syncing';
    status.error = null;
    emit();
    let changed = false;
    try {
      /* 1) 내 변경분 올리기 */
      const dirty = data.entries.filter((e) => e.dirty);
      if (dirty.length) {
        const push = () => req('entries?on_conflict=id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(dirty.map(toRow))
        });
        try {
          await push();
        } catch (err) {
          // 아직 extra 칸을 안 만든 Supabase 라면 그것만 빼고 다시 보낸다
          if (extraOk && /extra/.test(err.message || '')) { extraOk = false; await push(); }
          else throw err;
        }
        dirty.forEach((e) => delete e.dirty);
        changed = true;
      }

      /* 2) 상대 변경분 받아오기 */
      const since = data.settings.lastPullAt || '1970-01-01T00:00:00Z';
      const rows = await req(
        'entries?couple_code=eq.' + encodeURIComponent(cfg.code) +
        '&updated_at=gte.' + encodeURIComponent(since) +
        '&order=updated_at.asc&limit=3000'
      );
      let maxSeen = data.settings.lastPullAt || null;
      for (const r of rows || []) {
        const remote = fromRow(r);
        if (!maxSeen || r.updated_at > maxSeen) maxSeen = r.updated_at;
        const local = data.entries.find((e) => e.id === remote.id);
        if (!local) {
          data.entries.push(remote);
          changed = true;
        } else if (remote.updatedAt > local.updatedAt && !local.dirty) {
          Object.assign(local, remote);
          changed = true;
        }
      }
      if (maxSeen) data.settings.lastPullAt = maxSeen;

      /* 3) 공통 설정 공유 */
      if (await syncMeta(data)) changed = true;

      status.state = 'ok';
      status.lastSyncAt = new Date();
    } catch (err) {
      status.state = navigator.onLine === false ? 'offline' : 'error';
      status.error = err.message;
    } finally {
      status.running = false;
      emit();
    }
    return { changed };
  }

  /* 설정 항목 ↔ 서버 컬럼 이름 대응 */
  const META_COLS = {
    categories: 'categories', budget: 'budget', currency: 'currency',
    goal: 'goal', recurring: 'recurring'
    // methods / retiredMethods 는 아래에서 합집합으로 따로 병합한다
  };

  /* 분류·예산·통화·저축목표·반복지출·결제수단을 기기끼리 공유
   *
   * 설정은 '항목마다' 따로 비교한다. 예전처럼 통째로 비교하면,
   * 맥에서 카드를 하나 추가한 것만으로 아이폰에서 정해둔 예산까지 덮어써 사라진다. */
  async function syncMeta(data) {
    const s = data.settings;
    const rows = await req('couple_meta?couple_code=eq.' + encodeURIComponent(cfg.code) + '&select=*');
    const remote = rows && rows[0];
    let changed = false;

    const EPOCH = '1970-01-01T00:00:00Z';
    s.metaTs = s.metaTs || {};
    /* 예전 버전에서 올라온 기기는 항목별 시각이 없다. 이때는 전체 시각을 쓴다. */
    const remoteTsAll = (remote && remote.extra && remote.extra.metaTs) || {};
    const rTs = (f) => remoteTsAll[f] || (remote ? remote.updated_at : EPOCH);
    const lTs = (f) => s.metaTs[f] || s.metaUpdatedAt || EPOCH;

    /* 1) 항목별로 나중에 바꾼 쪽이 이긴다 */
    if (remote) {
      for (const f of Object.keys(META_COLS)) {
        const rv = remote[META_COLS[f]];
        if (rv == null) continue;
        if (rTs(f) <= lTs(f)) continue;
        s[f] = f === 'budget' ? Number(rv) : rv;
        s.metaTs[f] = rTs(f);
        changed = true;
      }
    }

    /* 2) 결제수단은 합집합으로 병합한다.
       기기마다 카드를 등록해도 서로 지우지 않아야 하기 때문이다.
       같은 카드가 양쪽에 있으면 나중에 고친 쪽 내용을 쓰고,
       지운 카드(retiredMethods)는 되살아나지 않게 걸러낸다. */
    const retiredOut = [...new Set([
      ...(s.retiredMethods || []),
      ...(((remote && remote.extra) || {}).retiredMethods || [])
    ])];
    if (JSON.stringify(retiredOut) !== JSON.stringify(s.retiredMethods || [])) {
      s.retiredMethods = retiredOut;
      changed = true;
    }
    /* 알림 구독도 합집합으로 병합한다 (기기마다 자기 것만 등록하므로) */
    const remoteExtra = (remote && remote.extra) || {};
    const retiredSubs = [...new Set([
      ...(s.retiredSubs || []), ...(remoteExtra.retiredSubs || [])
    ])];
    if (JSON.stringify(retiredSubs) !== JSON.stringify(s.retiredSubs || [])) {
      s.retiredSubs = retiredSubs;
      changed = true;
    }
    const subsById = new Map();
    (remoteExtra.pushSubs || []).concat(s.pushSub ? [s.pushSub] : [])
      .forEach((x) => { if (x && x.endpoint) subsById.set(x.endpoint, x); });
    const subsOut = [...subsById.values()].filter((x) => retiredSubs.indexOf(x.endpoint) < 0);
    const prefsOut = s.pushPrefs || (remoteExtra.pushPrefs || {});

    const remoteMethods = (remote && Array.isArray(remote.methods)) ? remote.methods : [];
    const remoteWins = rTs('methods') > lTs('methods');
    const byId = new Map();
    (remoteWins ? (s.methods || []).concat(remoteMethods) : remoteMethods.concat(s.methods || []))
      .forEach((m) => { if (m && m.id) byId.set(m.id, m); });   // 뒤에 온 쪽이 남는다
    const mergedMethods = [...byId.values()].filter((m) => retiredOut.indexOf(m.id) < 0);
    if (mergedMethods.length && JSON.stringify(mergedMethods) !== JSON.stringify(s.methods || [])) {
      s.methods = mergedMethods;
      if (remoteWins) s.metaTs.methods = rTs('methods');
      changed = true;
    }

    const subsChanged = JSON.stringify(subsOut) !== JSON.stringify(remoteExtra.pushSubs || [])
      || JSON.stringify(prefsOut) !== JSON.stringify(remoteExtra.pushPrefs || {});
    if (!remote || s.metaDirty || subsChanged) {
      /* 올릴 때도 항목별 시각을 함께 보낸다.
         위 1)에서 다른 기기가 최신인 항목은 이미 그 값을 받아왔으므로, 여기서 되돌아가지 않는다. */
      const tsOut = {};
      for (const f of Object.keys(META_COLS)) tsOut[f] = lTs(f);
      tsOut.methods = lTs('methods');
      const row = {
        couple_code: cfg.code,
        categories: s.categories,
        budget: s.budget,
        currency: s.currency,
        goal: s.goal,
        recurring: s.recurring,
        methods: s.methods,
        updated_at: new Date().toISOString()
      };
      const push = () => req('couple_meta?on_conflict=couple_code', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([extraOk
          ? { ...row, extra: { metaTs: tsOut, retiredMethods: retiredOut,
                               pushSubs: subsOut, retiredSubs, pushPrefs: prefsOut } }
          : row])
      });
      try {
        await push();
      } catch (err) {
        if (extraOk && /extra/.test(err.message || '')) { extraOk = false; await push(); }
        else throw err;
      }
      s.metaDirty = false;
    }
    return changed;
  }

  return {
    configure,
    normalizeUrl,
    syncNow,
    isConfigured: () => !!cfg,
    getStatus: () => status,
    onStatus: (fn) => listeners.push(fn)
  };
})();
