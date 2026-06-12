const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  launchGame: (characterData) => ipcRenderer.invoke('launch-game', characterData),
  quitLauncher: () => ipcRenderer.invoke('quit-launcher'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  exitToLauncher: () => ipcRenderer.invoke('exit-to-launcher'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  isElectron: true,
  platform: process.platform,
});
