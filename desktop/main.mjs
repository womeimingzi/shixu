import { app, BrowserWindow, Menu, Tray, Notification, ipcMain, protocol, dialog, shell, nativeImage, powerMonitor } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { StateStore } from './store.mjs';
import { collectDueReminders, createSnooze } from './reminders.mjs';
import { mergeData, validateData } from '../src/data.mjs';
import { todayISO } from '../src/schedule.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_ID = 'com.shixu.desktop';
const APP_URL = 'shixu://app/handdrawn-preview.html';
const selfTest = process.argv.includes('--self-test');
const dataDirectory = selfTest ? process.env.SHIXU_TEST_DIR : path.join(app.getPath('appData'), 'Shixu');
if (!dataDirectory) throw Error('Self-test requires an isolated SHIXU_TEST_DIR');
fs.mkdirSync(dataDirectory, { recursive: true });
app.setPath('userData', dataDirectory);
app.setName('拾序');
app.setAppUserModelId(APP_ID);
protocol.registerSchemesAsPrivileged([{ scheme: 'shixu', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let window;
let tray;
let store;
let quitting = false;
let notificationError = '';
let reminderTimer;
let rendererReady = false;
let pageLoaded = false;
const notifications = new Set();
const errors = [];
const retryAfter = new Map();
const launchArgs = ['--background'];
const iconPath = path.join(ROOT, 'build', 'icon.png');
const allowedFiles = new Set(['handdrawn-preview.html', 'src/app.js', 'src/styles.css', 'src/schedule.mjs', 'src/data.mjs', 'assets/mascots/handdrawn-cat-v1.png']);
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };

function logError(error) {
  const message = String(error?.stack || error);
  errors.push(message);
  try { fs.appendFileSync(path.join(dataDirectory, 'application.log'), `${new Date().toISOString()} ${message}\n`); } catch {}
}
function trusted(event) {
  return window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === APP_URL;
}
function registerHandler(channel, callback) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!trusted(event)) return { ok: false, error: '无法识别的窗口请求' };
    try { return { ok: true, ...(await callback(...args)) }; }
    catch (error) { logError(error); return { ok: false, error: error.message || '操作暂时没有成功，请重试' }; }
  });
}
function showWindow() {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show(); window.focus();
}
function preferences() {
  return { ...store.state.preferences, autoStart: !selfTest && app.isPackaged ? app.getLoginItemSettings({ path: process.execPath, args: launchArgs }).openAtLogin : false };
}
function setAutoStart(enabled) {
  if (selfTest || !app.isPackaged) { if (enabled) throw Error('请在打包后的拾序中开启自启动'); return; }
  app.setLoginItemSettings({ openAtLogin: enabled, name: 'Shixu', path: process.execPath, args: launchArgs });
}
function createShortcut() {
  if (!app.isPackaged || selfTest || process.platform !== 'win32') return;
  const file = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', '拾序.lnk');
  // A Start Menu identity is also required for Windows notification attribution.
  const success = shell.writeShortcutLink(file, fs.existsSync(file) ? 'update' : 'create', {
    target: process.execPath, cwd: path.dirname(process.execPath), description: '拾序 · 个人日程',
    icon: process.execPath, iconIndex: 0, appUserModelId: APP_ID,
  });
  if (!success) logError('无法创建开始菜单快捷方式，系统通知可能不可用。');
}
function createTray() {
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 24, height: 24 }));
  tray.setToolTip('拾序 · 在这里陪你');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开拾序', click: showWindow },
    { type: 'separator' },
    { label: '退出拾序（停止提醒）', click: () => app.quit() },
  ]));
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}
function deliverReminder(reminder, test = false) {
  if (selfTest) return false;
  if (!Notification.isSupported()) throw Error('当前 Windows 环境不支持系统通知');
  const notification = new Notification({ title: reminder.title, body: reminder.body, icon: iconPath, silent: false, timeoutType: 'default' });
  notifications.add(notification);
  notification.on('show', () => {
    notificationError = '';
    if (test) fs.writeFileSync(path.join(dataDirectory, 'notification-test.json'), JSON.stringify({ shown: true, at: new Date().toISOString() }));
  });
  notification.on('click', () => {
    showWindow();
    if (reminder.taskId) window.webContents.send('shixu:reminder', reminder);
  });
  notification.on('failed', (_event, error) => {
    notificationError = `系统通知未能显示：${error}`;
    if (test) fs.writeFileSync(path.join(dataDirectory, 'notification-test.json'), JSON.stringify({ shown: false, error: String(error), at: new Date().toISOString() }));
    logError(notificationError);
    if (!test) {
      retryAfter.set(reminder.key, Date.now() + 5 * 60000);
      const ledger = { ...store.state.ledger }; delete ledger[reminder.key];
      try { store.patch({ ledger }); } catch (saveError) { logError(saveError); }
    }
    notifications.delete(notification);
  });
  notification.on('close', () => notifications.delete(notification));
  notification.show();
  return true;
}
function checkReminders() {
  if (!store?.state.preferences.notifications || selfTest) return;
  try {
    const now = new Date();
    const due = collectDueReminders(store.state.data.tasks, now, store.state.ledger, store.state.snoozes).filter(r => (retryAfter.get(r.key) || 0) < +now);
    // Limit a wake-up burst; remaining reminders are delivered on the next tick.
    for (const reminder of due.slice(0, 3)) {
      const ledger = Object.fromEntries(Object.entries(store.state.ledger).filter(([, timestamp]) => timestamp > +now - 32 * 86400000));
      ledger[reminder.key] = +now;
      store.patch({ ledger, snoozes: store.state.snoozes.filter(s => s.due > +now - 86400000) });
      try { deliverReminder(reminder); }
      catch (error) {
        delete ledger[reminder.key]; store.patch({ ledger });
        retryAfter.set(reminder.key, +now + 5 * 60000); logError(error);
      }
    }
  } catch (error) { logError(error); }
}
function finishSelfTest() {
  if (!selfTest || !rendererReady || !pageLoaded) return;
  setImmediate(() => {
    try {
      window.close();
      const report = { ok: errors.length === 0 && !window.isDestroyed(), packaged: app.isPackaged, version: app.getVersion(), rendererReady: true, pageLoaded: true, closeHidesToTray: !window.isDestroyed() && !window.isVisible(), trayCreated: !!tray && !tray.isDestroyed(), dataFile: store.file, errors };
      fs.writeFileSync(path.join(dataDirectory, 'smoke-report.json'), JSON.stringify(report, null, 2));
      app.exit(report.ok ? 0 : 1);
    } catch (error) { logError(error); app.exit(1); }
  });
}
function installIPC() {
  registerHandler('shixu:load', () => ({ data: store.state.data, preferences: preferences(), info: { version: app.getVersion(), dataDirectory, packaged: app.isPackaged, notificationSupported: Notification.isSupported(), notificationError }, notice: store.notice }));
  ipcMain.on('shixu:save', (event, data) => {
    if (!trusted(event)) { event.returnValue = { ok: false, error: '无法识别的保存请求' }; return; }
    try { store.saveData(data); event.returnValue = { ok: true }; }
    catch (error) { logError(error); event.returnValue = { ok: false, error: error.message }; }
  });
  registerHandler('shixu:preferences', changes => {
    const previous = store.state.preferences;
    if (!changes || typeof changes !== 'object' || Object.entries(changes).some(([key, value]) => !['autoStart','closeToTray','notifications'].includes(key) || typeof value !== 'boolean')) throw Error('设置格式不正确');
    const next = { ...previous, ...changes };
    if ('autoStart' in changes) setAutoStart(next.autoStart);
    try { store.patch({ preferences: next }); }
    catch (error) { if ('autoStart' in changes) setAutoStart(previous.autoStart); throw error; }
    return { preferences: preferences() };
  });
  registerHandler('shixu:data-folder', async () => {
    const error = await shell.openPath(dataDirectory);
    if (error) throw Error(error);
  });
  registerHandler('shixu:export', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(window, { title: '导出拾序备份', defaultPath: `拾序备份-${todayISO()}.json`, filters: [{ name: '拾序备份', extensions: ['json'] }] });
    if (canceled) return { cancelled: true };
    fs.writeFileSync(filePath, JSON.stringify(store.state.data, null, 2), { encoding: 'utf8', flush: true });
    return { cancelled: false };
  });
  registerHandler('shixu:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(window, { title: '导入拾序备份（保留现有事项）', properties: ['openFile'], filters: [{ name: '拾序备份', extensions: ['json'] }] });
    if (canceled) return { cancelled: true };
    if (fs.statSync(filePaths[0]).size > 16 * 1024 * 1024) throw Error('备份文件过大');
    const imported = validateData(JSON.parse(fs.readFileSync(filePaths[0], 'utf8')));
    const merged = mergeData(store.state.data, imported, randomUUID);
    store.saveData(merged.data);
    return { data: store.state.data, added: merged.added };
  });
  registerHandler('shixu:test-notification', () => {
    deliverReminder({ title: '拾序 · 提醒已准备好', body: '这是一条测试提醒。关闭主窗口后，拾序可以留在托盘里陪着你。' }, true);
    return {};
  });
  registerHandler('shixu:snooze', context => {
    const id = context?.id;
    const task = store.state.data.tasks.find(t => t.id === id && !t.deleted && !t.completed);
    if (!task) throw Error('这件事已经完成或移除了');
    const snooze = { key: `snooze:${randomUUID()}`, ...createSnooze(task, context) };
    store.patch({ snoozes: [...store.state.snoozes.filter(s => s.taskId !== id), snooze] });
  });
  ipcMain.on('shixu:window', (event, action) => {
    if (!trusted(event)) return;
    if (action === 'minimize') window.minimize();
    if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
    if (action === 'close') window.close();
    if (action === 'quit') app.quit();
  });
  ipcMain.on('shixu:ready', event => {
    if (!trusted(event) || !selfTest) return;
    rendererReady = true;
    finishSelfTest();
  });
}
function createWindow() {
  window = new BrowserWindow({
    width: 1280, height: 900, minWidth: 740, minHeight: 620, show: false,
    title: '拾序', icon: iconPath, frame: false, backgroundColor: store.state.data.theme === 'dark' ? '#252621' : '#faf8f2',
    webPreferences: { preload: path.join(ROOT, 'desktop', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: true, spellcheck: false },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.on('did-fail-load', (_event, code, description) => logError(`页面加载失败 ${code}: ${description}`));
  window.webContents.on('render-process-gone', (_event, details) => logError(`界面进程退出：${details.reason}`));
  window.webContents.once('did-finish-load', () => { pageLoaded = true; finishSelfTest(); });
  window.webContents.on('console-message', (_event, details) => { if (details.level === 'error') logError(details.message); });
  window.on('close', event => {
    if (!quitting && store.state.preferences.closeToTray && tray && !tray.isDestroyed()) { event.preventDefault(); window.hide(); }
  });
  window.once('ready-to-show', () => { if (!selfTest && !process.argv.includes('--background')) showWindow(); });
  window.loadURL(APP_URL).catch(logError);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showWindow);
  app.on('before-quit', () => { quitting = true; clearInterval(reminderTimer); });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(() => {
    store = new StateStore(dataDirectory);
    Menu.setApplicationMenu(null);
    protocol.handle('shixu', request => {
      try {
        const url = new URL(request.url);
        const file = decodeURIComponent(url.pathname.slice(1));
        if (url.hostname !== 'app' || request.method !== 'GET' || !allowedFiles.has(file)) return new Response('Not found', { status: 404 });
        return new Response(fs.readFileSync(path.join(ROOT, file)), { headers: {
          'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream',
          'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        } });
      } catch { return new Response('Not found', { status: 404 }); }
    });
    installIPC(); createShortcut(); createTray(); createWindow();
    reminderTimer = setInterval(checkReminders, 30000);
    powerMonitor.on('resume', checkReminders);
    if (!selfTest) setTimeout(checkReminders, 3000);
    else setTimeout(() => { logError('启动自检超时'); fs.writeFileSync(path.join(dataDirectory, 'smoke-report.json'), JSON.stringify({ ok: false, errors })); app.exit(1); }, 20000);
    if (!selfTest && process.argv.includes('--test-notification')) setTimeout(() => {
      try { deliverReminder({ title: '拾序 · 提醒已准备好', body: '桌面版启动成功。以后可以直接双击拾序打开，我会在这里陪你。' }, true); }
      catch (error) { logError(error); }
    }, 1500);
  }).catch(error => {
    logError(error);
    if (!selfTest) dialog.showErrorBox('拾序暂时无法启动', `${error.message}\n\n数据目录：${dataDirectory}`);
    app.exit(1);
  });
}
