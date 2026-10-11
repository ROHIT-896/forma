import { contextBridge, ipcRenderer } from 'electron';
import type { FormaAPI } from '../shared/types';

const api: FormaAPI = {
  ping: () => ipcRenderer.invoke('db:ping'),
  getAppInfo: () => ipcRenderer.invoke('system:getAppInfo'),
  setPowerSaveBlocker: (enabled: boolean) => ipcRenderer.invoke('system:setPowerSaveBlocker', enabled),
  updateTrayTimer: (text: string | null) => ipcRenderer.invoke('tray:updateTimer', text),
  notifyRestComplete: (title: string, body: string) => ipcRenderer.invoke('notification:show', { title, body }),
};

// Expose safe, typed API to renderer window
contextBridge.exposeInMainWorld('formaAPI', api);
