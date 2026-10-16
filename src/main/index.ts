import { app, BrowserWindow, ipcMain, Notification, powerSaveBlocker, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, getDbPath, getDatabase } from './db';
import type { AppInfo, DBPingResult } from '../shared/types';
import * as workoutRepo from './workoutRepo';
import * as dietRepo from './dietRepo';
import * as planRepo from './planRepo';
import * as backupRepo from './backupRepo';
import * as analyticsRepo from './analyticsRepo';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let powerSaveBlockerId: number | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 960,
    minHeight: 650,
    title: 'FORMA',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0F1115',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
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
  // System & Health
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
      build_mode: process.env.NODE_ENV ?? 'production',
      node_version: process.version,
      electron_version: process.versions.electron ?? '—',
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

  // Profile & Plan
  ipcMain.handle('plan:getProfile', async () => planRepo.getProfile(getDatabase()));
  ipcMain.handle('plan:clearProfile', async () => planRepo.deleteProfile(getDatabase()));
  ipcMain.handle('plan:saveProfile', async (_e, profile) => planRepo.saveProfile(getDatabase(), profile));
  ipcMain.handle('plan:getPlan', async () => planRepo.getPlan(getDatabase()));
  ipcMain.handle('plan:previewUpdate', async () => planRepo.previewPlanUpdate(getDatabase()));
  ipcMain.handle('plan:acceptUpdate', async (_e, newPlan) => planRepo.acceptPlanUpdate(getDatabase(), newPlan));
  ipcMain.handle('plan:setOverrides', async (_e, overrides) => planRepo.setPlanOverrides(getDatabase(), overrides));
  ipcMain.handle('meta:getMessMode', async () => planRepo.getMessMode(getDatabase()));
  ipcMain.handle('meta:setMessMode', async (_e, enabled) => planRepo.setMessMode(getDatabase(), enabled));
  ipcMain.handle('meta:getOnboardingSkipped', async () => planRepo.getOnboardingSkipped(getDatabase()));
  ipcMain.handle('meta:setOnboardingSkipped', async (_e, skipped) => planRepo.setOnboardingSkipped(getDatabase(), skipped));
  ipcMain.handle('plan:updateSchedule', async (_e, newSchedule) => planRepo.updateSchedule(getDatabase(), newSchedule));

  // Workouts
  ipcMain.handle('workout:listExercises', async () => workoutRepo.listExercises(getDatabase()));
  ipcMain.handle('workout:start', async (_e, params) => workoutRepo.startWorkout(getDatabase(), params));
  ipcMain.handle('workout:logSet', async (_e, set) => workoutRepo.logWorkoutSet(getDatabase(), set));
  ipcMain.handle('workout:undoSet', async (_e, workoutId) => workoutRepo.undoLastWorkoutSet(getDatabase(), workoutId));
  ipcMain.handle('workout:cancel', async (_e, workoutId) => workoutRepo.cancelWorkout(getDatabase(), workoutId));
  ipcMain.handle('workout:update', async (_e, workoutId, updates) => workoutRepo.updateWorkout(getDatabase(), workoutId, updates));
  ipcMain.handle('workout:delete', async (_e, workoutId) => workoutRepo.deleteWorkout(getDatabase(), workoutId));
  ipcMain.handle('workout:deleteSet', async (_e, setId) => workoutRepo.deleteWorkoutSet(getDatabase(), setId));
  ipcMain.handle('workout:updateSet', async (_e, setId, updates) => workoutRepo.updateWorkoutSet(getDatabase(), setId, updates));
  ipcMain.handle('workout:getSets', async (_e, workoutId) => workoutRepo.getWorkoutSets(getDatabase(), workoutId));
  ipcMain.handle('workout:finish', async (_e, summary) => workoutRepo.finishWorkout(getDatabase(), summary));
  ipcMain.handle('workout:getActive', async () => workoutRepo.getActiveWorkout(getDatabase()));
  ipcMain.handle('workout:getExerciseHistory', async (_e, exerciseId) => workoutRepo.getExerciseHistory(getDatabase(), exerciseId));
  ipcMain.handle('workout:getRecent', async (_e, limit) => workoutRepo.getRecentWorkouts(getDatabase(), limit));

  // Diet & Tracking
  ipcMain.handle('diet:listFoods', async () => dietRepo.listFoods(getDatabase()));
  ipcMain.handle('diet:upsertFood', async (_e, food) => dietRepo.upsertFood(getDatabase(), food));
  ipcMain.handle('diet:logFood', async (_e, entry) => dietRepo.logFood(getDatabase(), entry));
  ipcMain.handle('diet:deleteFoodLog', async (_e, id) => dietRepo.deleteFoodLog(getDatabase(), id));
  ipcMain.handle('diet:getDayDiet', async (_e, dateStr) => dietRepo.getDayDiet(getDatabase(), dateStr));
  ipcMain.handle('diet:repeatYesterdayMeal', async (_e, dateStr, mealType) => dietRepo.repeatYesterdayMeal(getDatabase(), dateStr, mealType));
  ipcMain.handle('diet:saveMeal', async (_e, name, mealType, items) => dietRepo.saveMeal(getDatabase(), name, mealType, items));
  ipcMain.handle('diet:listSavedMeals', async () => dietRepo.listSavedMeals(getDatabase()));
  ipcMain.handle('diet:logSavedMeal', async (_e, savedMealId, dateStr, mealType) => dietRepo.logSavedMeal(getDatabase(), savedMealId, dateStr, mealType));
  ipcMain.handle('diet:deleteSavedMeal', async (_e, savedMealId) => dietRepo.deleteSavedMeal(getDatabase(), savedMealId));
  ipcMain.handle('diet:logQuickProtein', async (_e, foodId, dateStr, isMessMode) => dietRepo.logQuickProtein(getDatabase(), foodId, dateStr, isMessMode));
  ipcMain.handle('diet:addWater', async (_e, dateStr, amountMl) => dietRepo.addWater(getDatabase(), dateStr, amountMl));
  ipcMain.handle('diet:undoLastWater', async (_e, dateStr) => dietRepo.undoLastWater(getDatabase(), dateStr));
  ipcMain.handle('diet:logWeight', async (_e, dateStr, weightKg) => dietRepo.logWeight(getDatabase(), dateStr, weightKg));
  ipcMain.handle('diet:getWeightHistory', async (_e, limitDays) => dietRepo.getWeightHistory(getDatabase(), limitDays));
  ipcMain.handle('diet:evaluateWeightTrend', async (_e, goal) => dietRepo.evaluateWeightTrendForGoal(getDatabase(), goal));

  // Phase 4: Analytics
  ipcMain.handle('analytics:getStreak', async () => analyticsRepo.getWorkoutStreak(getDatabase()));
  ipcMain.handle('analytics:getWeeklyMuscleVolume', async () => analyticsRepo.getWeeklyMuscleVolumeSummary(getDatabase()));
  ipcMain.handle('analytics:getWeeklyReview', async () => analyticsRepo.getWeeklyReviewSummary(getDatabase()));
  ipcMain.handle('analytics:getExercisePRHistory', async (_e, exerciseId: string) => analyticsRepo.getExercisePRHistorySummary(getDatabase(), exerciseId));

  // Phase 4: Data & Backup
  ipcMain.handle('data:exportJson', async () => {
    const data = backupRepo.exportAllData(getDatabase());
    return JSON.stringify(data, null, 2);
  });
  ipcMain.handle('data:importJson', async (_e, jsonString: string) => {
    const payload = JSON.parse(jsonString);
    return backupRepo.importAllData(getDatabase(), payload);
  });
  ipcMain.handle('data:getBackupsList', async () => {
    const backupsDir = path.join(app.getPath('userData'), 'backups');
    return backupRepo.listBackups(backupsDir);
  });

  // Phase 4: Settings & Customization
  ipcMain.handle('settings:getSettings', async () => analyticsRepo.getAppSettings(getDatabase()));
  ipcMain.handle('settings:saveSettings', async (_e, settings) => analyticsRepo.saveAppSettings(getDatabase(), settings));
}

// App lifecycle
app.whenReady().then(() => {
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
