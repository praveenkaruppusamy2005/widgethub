const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window-toggle-always-on-top'),
  getAlwaysOnTop: () => ipcRenderer.invoke('window-get-always-on-top'),
  spawnWidget: (widgetType) => ipcRenderer.invoke('spawn-widget', widgetType),
  getBluetoothDevices: () => ipcRenderer.invoke('get-bluetooth-devices'),
  openBluetoothSettings: () => ipcRenderer.invoke('open-bluetooth-settings'),
  getMediaSession: () => ipcRenderer.invoke('get-media-session'),
  controlMedia: (action, value) => ipcRenderer.invoke('control-media', action, value),
  openApp: (appId) => ipcRenderer.invoke('open-app', appId),
  getSystemUptime: () => ipcRenderer.invoke('get-system-uptime'),
});
