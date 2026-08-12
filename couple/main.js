const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// preload 에서 읽어 업데이트 확인에 쓴다
process.env.GAGYEBU_VERSION = app.getVersion();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function dataFile() {
  return path.join(app.getPath('userData'), 'gagyebu-data.json');
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveData(data) {
  const file = dataFile();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  fs.renameSync(tmp, file);
  return true;
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 860,
    minHeight: 600,
    title: '우리 가계부',
    autoHideMenuBar: true,
    backgroundColor: '#faf7f6',
    /* 제목 표시줄을 앱 색으로 물들인다.
       맥은 신호등 버튼만 남기고 표시줄을 화면에 녹이고(hiddenInset),
       윈도우는 표시줄 자체를 앱 색으로 칠한다(titleBarOverlay). */
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },   // 40px 띠 한가운데 (버튼 지름 12px)
    titleBarOverlay: process.platform === 'win32'
      ? { color: '#a44a7b', symbolColor: '#ffffff', height: 40 } : false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  ipcMain.handle('data:load', () => loadData());
  ipcMain.handle('data:save', (_e, data) => saveData(data));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
