const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('finnishNative', {
  savePdf: (html, name, size) => ipcRenderer.invoke('pdf', html, name, size),
  saveFile: (name, text, existing) => ipcRenderer.invoke('saveFile', name, text, existing),
  saveText: (name, text) => ipcRenderer.invoke('saveText', name, text)
});
