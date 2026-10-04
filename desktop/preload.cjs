const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shixuDesktop', {
  load: () => ipcRenderer.invoke('shixu:load'),
  // Small local records are written atomically before acknowledging the save.
  save: data => ipcRenderer.sendSync('shixu:save', data),
  preferences: changes => ipcRenderer.invoke('shixu:preferences', changes),
  exportData: data => ipcRenderer.invoke('shixu:export', data),
  importData: () => ipcRenderer.invoke('shixu:import'),
  showDataFolder: () => ipcRenderer.invoke('shixu:data-folder'),
  testNotification: () => ipcRenderer.invoke('shixu:test-notification'),
  weatherSearch: query => ipcRenderer.invoke('shixu:weather-search', query),
  weatherForecast: location => ipcRenderer.invoke('shixu:weather-forecast', location),
  weatherSource: () => ipcRenderer.invoke('shixu:weather-source'),
  snooze: context => ipcRenderer.invoke('shixu:snooze', context),
  minimize: () => ipcRenderer.send('shixu:window', 'minimize'),
  maximize: () => ipcRenderer.send('shixu:window', 'maximize'),
  close: () => ipcRenderer.send('shixu:window', 'close'),
  quit: () => ipcRenderer.send('shixu:window', 'quit'),
  ready: () => ipcRenderer.send('shixu:ready'),
  onReminder: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('shixu:reminder', listener);
    return () => ipcRenderer.removeListener('shixu:reminder', listener);
  },
});
