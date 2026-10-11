import { app, BrowserWindow, ipcMain, Notification, powerSaveBlocker, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, getDbPath, getDatabase } from './db';
import type { AppInfo, DBPingResult } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let powerSaveBlockerId: number | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: 'FORMA',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0F1115',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Allows preload to require electron modules safely with contextBridge
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupTray() {
  // Empty tray initialized on demand or with transparent/blank icon
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('FORMA');
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open FORMA',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

function setupIPCHandlers(dbInfo: { dbPath: string; backupCount: number; schemaVersion: number }) {
  ipcMain.handle('db:ping', async (): Promise<DBPingResult> => {
    const db = getDatabase();
    const versionRow = db.prepare('SELECT sqlite_version() AS version').get() as { version: string };
    const exCountRow = db.prepare('SELECT count(*) as cnt FROM exercises').get() as { cnt: number };
    const foodCountRow = db.prepare('SELECT count(*) as cnt FROM foods').get() as { cnt: number };
    return {
      ok: true,
      timestamp: Date.now(),
      sqliteVersion: versionRow.version,
      dbPath: dbInfo.dbPath,
      backupCount: dbInfo.backupCount,
      schemaVersion: dbInfo.schemaVersion,
      catalogCounts: {
        exercises: exCountRow.cnt,
        foods: foodCountRow.cnt,
      },
    };
  });

  ipcMain.handle('system:getAppInfo', async (): Promise<AppInfo> => {
    const db = getDatabase();
    const versionRow = db.prepare('SELECT sqlite_version() AS version').get() as { version: string };
    return {
      version: app.getVersion(),
      name: app.getName(),
      userDataPath: app.getPath('userData'),
      dbPath: dbInfo.dbPath,
      sqliteVersion: versionRow.version,
      platform: process.platform,
      arch: process.arch,
    };
  });

  ipcMain.handle('system:setPowerSaveBlocker', async (_event, enabled: boolean): Promise<boolean> => {
    if (enabled) {
      if (powerSaveBlockerId === null || !powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
      }
      return true;
    } else {
      if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlocker.stop(powerSaveBlockerId);
        powerSaveBlockerId = null;
      }
      return false;
    }
  });

  ipcMain.handle('tray:updateTimer', async (_event, text: string | null) => {
    if (!tray) return;
    if (text) {
      tray.setTitle(` ⏱️ ${text}`);
    } else {
      tray.setTitle('');
    }
  });

  ipcMain.handle('notification:show', async (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body, silent: false }).show();
    }
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Initialize Database in main process
  const dbInfo = initDatabase();

  setupIPCHandlers(dbInfo);
  setupTray();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }
});
