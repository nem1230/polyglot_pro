const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectImage: () => ipcRenderer.invoke('select-image'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  exportData: (data, type) => ipcRenderer.invoke('export-data', data, type)
});

// Expose a limited API for Ollama communication
contextBridge.exposeInMainWorld('ollamaAPI', {
  // We'll handle Ollama requests through fetch in the renderer
  // This is just a placeholder for any future native integrations
  isAvailable: () => true
});