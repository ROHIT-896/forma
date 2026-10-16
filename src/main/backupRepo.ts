import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface ExportDataPayload {
  version: number;
  exported_at: string;
  tables: {
    user_profile: any[];
    user_plan: any[];
    app_meta: any[];
    workouts: any[];
    workout_sets: any[];
    exercise_tracking_state: any[];
    food_logs: any[];
    saved_meals: any[];
    saved_meal_items: any[];
    water_logs: any[];
    weight_logs: any[];
  };
}

export function exportAllData(db: Database.Database): ExportDataPayload {
  const getTableData = (tableName: string): any[] => {
    try {
      return db.prepare(`SELECT * FROM ${tableName}`).all();
    } catch {
      return [];
    }
  };

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    tables: {
      user_profile: getTableData('user_profile'),
      user_plan: getTableData('user_plan'),
      app_meta: getTableData('app_meta'),
      workouts: getTableData('workouts'),
      workout_sets: getTableData('workout_sets'),
      exercise_tracking_state: getTableData('exercise_tracking_state'),
      food_logs: getTableData('food_logs'),
      saved_meals: getTableData('saved_meals'),
      saved_meal_items: getTableData('saved_meal_items'),
      water_logs: getTableData('water_logs'),
      weight_logs: getTableData('weight_logs'),
    },
  };
}

export function importAllData(
  db: Database.Database,
  payload: ExportDataPayload
): { success: boolean; counts: Record<string, number> } {
  if (!payload || !payload.tables) {
    throw new Error('Invalid export file format: missing tables');
  }

  const counts: Record<string, number> = {};

  const restoreTransaction = db.transaction(() => {
    const tableKeys = Object.keys(payload.tables) as Array<keyof typeof payload.tables>;

    for (const table of tableKeys) {
      const rows = payload.tables[table];
      if (!Array.isArray(rows)) continue;

      // Delete existing rows for user data tables
      db.prepare(`DELETE FROM ${table}`).run();

      if (rows.length === 0) {
        counts[table] = 0;
        continue;
      }

      // Dynamically insert each row
      const sample = rows[0];
      const cols = Object.keys(sample);
      const placeholders = cols.map(() => '?').join(', ');
      const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
      const insertStmt = db.prepare(sql);

      for (const row of rows) {
        const values = cols.map((col) => row[col]);
        insertStmt.run(...values);
      }

      counts[table] = rows.length;
    }
  });

  restoreTransaction();

  return {
    success: true,
    counts,
  };
}

export function listBackups(backupsDir: string): Array<{ fileName: string; sizeBytes: number; createdAt: string }> {
  if (!fs.existsSync(backupsDir)) return [];

  const files = fs.readdirSync(backupsDir).filter((f) => f.endsWith('.sqlite'));
  return files.map((fileName) => {
    const filePath = path.join(backupsDir, fileName);
    const stat = fs.statSync(filePath);
    return {
      fileName,
      sizeBytes: stat.size,
      createdAt: stat.birthtime.toISOString(),
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
