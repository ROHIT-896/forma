export interface AppInfo {
  version: string;
  name: string;
  userDataPath: string;
  dbPath: string;
  sqliteVersion: string;
  platform: string;
  arch: string;
}

export interface DBPingResult {
  ok: boolean;
  timestamp: number;
  sqliteVersion: string;
  dbPath: string;
  backupCount: number;
  schemaVersion: number;
  catalogCounts: {
    exercises: number;
    foods: number;
  };
}

export interface FormaAPI {
  // System & Health
  ping: () => Promise<DBPingResult>;
  getAppInfo: () => Promise<AppInfo>;
  
  // Power save blocker (stay awake during active workouts)
  setPowerSaveBlocker: (enabled: boolean) => Promise<boolean>;
  
  // Menu bar tray workout timer
  updateTrayTimer: (text: string | null) => Promise<void>;
  
  // Audio & Notification
  notifyRestComplete: (title: string, body: string) => Promise<void>;
}

declare global {
  interface Window {
    formaAPI: FormaAPI;
  }
}
