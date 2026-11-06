// finnish – desktop shell (Windows .exe). Creator: Nishan
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 420, minHeight: 600, backgroundColor: '#dfe9f7', title: 'finnish',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false }
  });
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

ipcMain.handle('pdf', async (e, html, name, size) => {
  const tmp = path.join(os.tmpdir(), 'finnish-print-' + Date.now() + '.html');
  fs.writeFileSync(tmp, html, 'utf8');
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: false } });
  try {
    await w.loadFile(tmp);
    await w.webContents.executeJavaScript('document.fonts.ready.then(()=>true)');
    await new Promise(r => setTimeout(r, 400));
    const data = await w.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true });
    const r = await dialog.showSaveDialog({ defaultPath: name, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, data); shell.showItemInFolder(r.filePath); return r.filePath;
  } finally { w.destroy(); try { fs.unlinkSync(tmp); } catch (x) { } }
});
ipcMain.handle('saveFile', async (e, name, text, existing) => {
  let p = existing;
  if (!p || !fs.existsSync(path.dirname(p))) {
    const r = await dialog.showSaveDialog({ defaultPath: name, filters: [{ name: 'finnish script', extensions: ['finnish'] }] });
    if (r.canceled || !r.filePath) return null; p = r.filePath;
  }
  fs.writeFileSync(p, text, 'utf8'); return p;
});
ipcMain.handle('saveText', async (e, name, text) => {
  const ext = path.extname(name).slice(1) || 'txt';
  const r = await dialog.showSaveDialog({ defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  if (r.canceled || !r.filePath) return null; fs.writeFileSync(r.filePath, text, 'utf8'); return r.filePath;
});

app.whenReady().then(() => { Menu.setApplicationMenu(null); createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
