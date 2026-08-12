/* 저장소 어댑터: Electron이면 파일(IPC), 브라우저·아이폰이면 localStorage */
(function () {
  const isElectron = typeof window.mygagyebu !== 'undefined';
  let timer = null;
  let pending = null;   // 아직 저장되지 않은 데이터

  window.Store = {
    async load() {
      if (isElectron) return await window.mygagyebu.loadData();
      try {
        const raw = localStorage.getItem('mygagyebu-data');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    /* 내역을 타이핑하는 동안처럼 변경이 잦을 때 쓰는 지연 저장.
       중요한 값(설정·이름)은 지연 없이 saveNow 를 써야 한다 —
       아이폰은 앱을 나가는 순간 타이머를 멈춰서 지연 저장이 날아간다. */
    save(data) {
      pending = data;
      clearTimeout(timer);
      timer = setTimeout(() => this.saveNow(data), 300);
    },

    saveNow(data) {
      clearTimeout(timer);
      timer = null;
      pending = null;
      if (isElectron) return window.mygagyebu.saveData(data);
      try {
        localStorage.setItem('mygagyebu-data', JSON.stringify(data));
      } catch (e) {
        // 저장 공간이 꽉 찬 경우 — 클라우드에 올라가 있으므로 앱은 계속 쓸 수 있다
        console.warn('로컬 저장 실패', e);
      }
      return true;
    },

    /* 화면이 가려지거나 앱이 닫히기 직전에 호출해 밀린 저장을 즉시 반영한다 */
    flush() {
      if (pending) this.saveNow(pending);
    }
  };
})();
