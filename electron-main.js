const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let launcherWindow = null;
let gameWindow = null;
let serverProcess = null;
const isDev = process.argv.includes('--dev');

// ─── Launcher window ─────────────────────────────────────────────────────────
function createLauncher() {
  launcherWindow = new BrowserWindow({
    width: 900,
    height: 560,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0508',
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: getIcon(),
    title: "Regni d'Oriente — Launcher",
    show: false,
  });

  launcherWindow.loadFile('launcher.html');

  launcherWindow.once('ready-to-show', () => {
    launcherWindow.show();
    if (isDev) launcherWindow.webContents.openDevTools({ mode: 'detach' });
  });

  launcherWindow.on('closed', () => {
    launcherWindow = null;
    if (!gameWindow) app.quit();
  });
}

// ─── Game window ──────────────────────────────────────────────────────────────
function createGame(characterData) {
  gameWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    frame: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,  // allow local file:// paths for Three.js
    },
    icon: getIcon(),
    title: "Regni d'Oriente",
    show: false,
    fullscreen: false,
  });

  // Remove menu bar
  gameWindow.setMenu(null);

  gameWindow.loadFile('game.html');

  gameWindow.once('ready-to-show', () => {
    if (launcherWindow) {
      launcherWindow.hide();
    }
    gameWindow.show();
    if (characterData) {
      gameWindow.webContents.executeJavaScript(
        `window._pendingCharacter = ${JSON.stringify(characterData)};`
      );
    }
    if (isDev) gameWindow.webContents.openDevTools({ mode: 'detach' });
  });

  gameWindow.on('closed', () => {
    gameWindow = null;
    stopServer();
    if (launcherWindow) {
      launcherWindow.show();
    } else {
      app.quit();
    }
  });

  // F11 fullscreen toggle
  gameWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      gameWindow.setFullScreen(!gameWindow.isFullScreen());
    }
  });
}

// ─── Embedded server ─────────────────────────────────────────────────────────
function startServer() {
  const serverDir = app.isPackaged
    ? path.join(process.resourcesPath, 'server')
    : path.join(__dirname, 'server');

  const serverEntry = path.join(serverDir, 'server.js');
  if (!fs.existsSync(serverEntry)) return;

  serverProcess = spawn(process.execPath.replace('electron', 'node')
    .replace(/[/\\]electron(?:\.exe)?$/, '/node' + (process.platform === 'win32' ? '.exe' : '')),
    [serverEntry],
    {
      cwd: serverDir,
      env: { ...process.env, PORT: '3000' },
      stdio: 'pipe',
    }
  );

  serverProcess.stdout.on('data', d => console.log('[server]', d.toString().trim()));
  serverProcess.stderr.on('data', d => console.error('[server]', d.toString().trim()));
  serverProcess.on('close', code => {
    console.log('[server] exited with code', code);
    serverProcess = null;
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('launch-game', (_e, characterData) => {
  createGame(characterData);
});

ipcMain.handle('quit-launcher', () => {
  app.quit();
});

ipcMain.handle('minimize-window', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.minimize();
});

ipcMain.handle('close-window', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.close();
});

ipcMain.handle('toggle-fullscreen', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.setFullScreen(!win.isFullScreen());
});

ipcMain.handle('exit-to-launcher', () => {
  if (gameWindow) gameWindow.close();
});

ipcMain.handle('get-version', () => app.getVersion());

ipcMain.handle('open-external', (_e, url) => {
  shell.openExternal(url);
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
function getIcon() {
  if (process.platform === 'win32') return path.join(__dirname, 'assets/icon.ico');
  if (process.platform === 'darwin') return path.join(__dirname, 'assets/icon.icns');
  return path.join(__dirname, 'assets/icon.png');
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // startServer();   // uncomment to auto-start multiplayer server
  createLauncher();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLauncher();
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopServer);
