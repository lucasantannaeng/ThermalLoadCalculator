const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  saveCopyrightReport: (report) => ipcRenderer.invoke('save-copyright-report', report),
  onShowCopyrightReport: (callback) => {
    const handler = (...args) => callback(...args);
    ipcRenderer.on('show-copyright-report', handler);
    return () => {
      ipcRenderer.removeListener('show-copyright-report', handler);
    };
  }
});
