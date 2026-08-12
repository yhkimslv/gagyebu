const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gagyebu', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  // 업데이트 확인에 쓰인다 (version.json 의 버전과 비교)
  appVersion: process.env.GAGYEBU_VERSION || '',
  // 애플 실리콘 맥에서도 브라우저는 자신을 Intel 로 보고하므로, 실제 값을 넘겨준다
  platform: process.platform,
  arch: process.arch
});
