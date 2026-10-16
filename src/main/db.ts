import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import defaultExercises from '../../data/exercises.json';
import defaultFoods from '../../data/foods.json';

let dbInstance: Database.Database | null = null;
let currentDbPath: string = '';

/**
 * Seeds initial exercise and food catalog if tables are empty.
 */
function seedInitialData(db: Database.Database): void {
  try {
    const exCountRow = db.prepare('SELECT COUNT(*) as cnt FROM exercises').get() as { cnt: number } | undefined;
    if ((exCountRow?.cnt ?? 0) === 0) {
      const insertEx = db.prepare(`
        INSERT INTO exercises (
          id, name, primary_muscles_json, secondary_muscles_json, equipment,
          movement_pattern, compound_or_isolation, difficulty, beginner_safe,
          short_form_cue, substitution_ids_json, is_custom
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      const insertManyEx = db.transaction((list: any[]) => {
        for (const ex of list) {
          insertEx.run(
            ex.id,
            ex.name,
            JSON.stringify(ex.primary_muscles),
            JSON.stringify(ex.secondary_muscles),
            ex.equipment,
            ex.movement_pattern,
            ex.compound_or_isolation,
            ex.difficulty,
            ex.beginner_safe ? 1 : 0,
            ex.short_form_cue,
            JSON.stringify(ex.substitution_ids)
          );
        }
      });
      insertManyEx(defaultExercises);
      console.log(`Seeded ${defaultExercises.length} default exercises.`);
    }

    const insertFood = db.prepare(`
      INSERT OR IGNORE INTO foods (
        id, name, category, dietary_type, default_portion_unit, portion_description,
        estimated_calories, estimated_protein, is_mess_item, mess_serving_definition,
        assumption_note, quick_protein_chip, is_custom
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const insertManyFoods = db.transaction((list: any[]) => {
      for (const f of list) {
        insertFood.run(
          f.id,
          f.name,
          f.category,
          f.dietary_type,
          f.default_portion_unit,
          f.portion_description,
          f.estimated_calories,
          f.estimated_protein,
          f.is_mess_item ? 1 : 0,
          f.mess_serving_definition,
          f.assumption_note,
          f.quick_protein_chip ? 1 : 0
        );
      }
    });
    insertManyFoods(defaultFoods);
  } catch (error) {
    console.error('Error seeding initial data:', error);
  }
}

/**
 * Returns the path to the SQLite database file in Electron userData directory.
 */
export function getDbPath(): string {
  if (currentDbPath) return currentDbPath;
  const userData = app.getPath('userData');
  if (!fs.existsSync(userData)) {
    fs.mkdirSync(userData, { recursive: true });
  }
  return path.join(userData, 'forma.sqlite');
}

/**
 * Creates an automatic backup of the database on app launch and keeps only the latest 5.
 */
export function autoBackupDatabase(dbFilePath: string): number {
  try {
    if (!fs.existsSync(dbFilePath)) {
      return 0; // DB does not exist yet (first run)
    }

    const backupDir = path.join(path.dirname(dbFilePath), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupTarget = path.join(backupDir, `forma-backup-${timestamp}.sqlite`);

    fs.copyFileSync(dbFilePath, backupTarget);

    // Prune backups: keep only the latest 5
    const files = fs
      .readdirSync(backupDir)
      .filter((file) => file.startsWith('forma-backup-') && file.endsWith('.sqlite'))
      .map((file) => ({
        name: file,
        fullPath: path.join(backupDir, file),
        time: fs.statSync(path.join(backupDir, file)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 5) {
      for (const oldFile of files.slice(5)) {
        try {
          fs.unlinkSync(oldFile.fullPath);
        } catch (err) {
          console.error(`Failed to delete old backup: ${oldFile.name}`, err);
        }
      }
    }

    const remaining = fs
      .readdirSync(backupDir)
      .filter((file) => file.startsWith('forma-backup-') && file.endsWith('.sqlite')).length;

    return remaining;
  } catch (error) {
    console.error('Error during database auto-backup:', error);
    return 0;
  }
}

/**
 * Applies versioned migrations sequentially.
 */
function applyMigrations(db: Database.Database): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const currentVersionRow = db
    .prepare('SELECT MAX(version) AS max_v FROM schema_migrations')
    .get() as { max_v: number | null };

  const currentVersion = currentVersionRow?.max_v ?? 0;

  const migrations: Array<{ version: number; name: string; sql: string }> = [
    {
      version: 1,
      name: 'initial_schema_meta',
      sql: `
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT OR IGNORE INTO app_meta (key, value, updated_at)
        VALUES ('initialized_at', datetime('now'), datetime('now'));
      `,
    },
    {
      version: 2,
      name: 'domain_schema_tables',
      sql: `
        -- User profile table
        CREATE TABLE IF NOT EXISTS user_profile (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          height_cm REAL NOT NULL,
          weight_kg REAL NOT NULL,
          age INTEGER NOT NULL,
          sex TEXT NOT NULL CHECK (sex IN ('male', 'female')),
          goal TEXT NOT NULL CHECK (goal IN ('gain_muscle', 'lose_fat', 'maintain')),
          experience TEXT NOT NULL CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
          days_per_week INTEGER NOT NULL CHECK (days_per_week BETWEEN 2 AND 7),
          equipment TEXT NOT NULL CHECK (equipment IN ('full_gym', 'dumbbells_only', 'bodyweight_only')),
          dietary_type TEXT NOT NULL CHECK (dietary_type IN ('veg', 'non_veg', 'eggetarian')),
          accent_color TEXT DEFAULT 'emerald',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- User active plan
        CREATE TABLE IF NOT EXISTS user_plan (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          calorie_target INTEGER NOT NULL,
          protein_target_g INTEGER NOT NULL,
          weekly_weight_change_kg REAL NOT NULL,
          split_type TEXT NOT NULL,
          weekly_schedule_json TEXT NOT NULL,
          muscle_targets_json TEXT NOT NULL,
          meal_conversions_json TEXT NOT NULL,
          formula_breakdown TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- Exercises seed and custom
        CREATE TABLE IF NOT EXISTS exercises (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          primary_muscles_json TEXT NOT NULL,
          secondary_muscles_json TEXT NOT NULL,
          equipment TEXT NOT NULL,
          movement_pattern TEXT NOT NULL,
          compound_or_isolation TEXT NOT NULL,
          difficulty TEXT NOT NULL,
          beginner_safe INTEGER NOT NULL,
          short_form_cue TEXT NOT NULL,
          substitution_ids_json TEXT NOT NULL,
          is_custom INTEGER DEFAULT 0
        );

        -- Foods seed and custom
        CREATE TABLE IF NOT EXISTS foods (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          dietary_type TEXT NOT NULL,
          default_portion_unit TEXT NOT NULL,
          portion_description TEXT NOT NULL,
          estimated_calories REAL NOT NULL,
          estimated_protein REAL NOT NULL,
          is_mess_item INTEGER NOT NULL,
          mess_serving_definition TEXT NOT NULL,
          assumption_note TEXT NOT NULL,
          quick_protein_chip INTEGER DEFAULT 0,
          is_custom INTEGER DEFAULT 0
        );

        -- Daily food logs
        CREATE TABLE IF NOT EXISTS food_logs (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snacks', 'dinner', 'extra')),
          food_id TEXT NOT NULL,
          portion_quantity REAL NOT NULL,
          portion_unit TEXT NOT NULL,
          calories REAL NOT NULL,
          protein REAL NOT NULL,
          logged_at TEXT NOT NULL,
          FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_food_logs_date ON food_logs(date);

        -- Daily water logs
        CREATE TABLE IF NOT EXISTS water_logs (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          amount_ml INTEGER NOT NULL,
          logged_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_water_logs_date ON water_logs(date);

        -- Bodyweight log
        CREATE TABLE IF NOT EXISTS weight_logs (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL UNIQUE,
          weight_kg REAL NOT NULL,
          logged_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_weight_logs_date ON weight_logs(date);

        -- Workout sessions
        CREATE TABLE IF NOT EXISTS workouts (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          focus TEXT NOT NULL,
          planned_time_min INTEGER NOT NULL,
          energy_level INTEGER NOT NULL,
          equipment TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('planned', 'completed', 'skipped')),
          notes TEXT,
          started_at TEXT,
          completed_at TEXT,
          total_volume REAL DEFAULT 0,
          total_sets INTEGER DEFAULT 0,
          avg_rest_sec REAL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);

        -- Logged workout sets
        CREATE TABLE IF NOT EXISTS workout_sets (
          id TEXT PRIMARY KEY,
          workout_id TEXT NOT NULL,
          exercise_id TEXT NOT NULL,
          set_number INTEGER NOT NULL,
          weight_kg REAL NOT NULL,
          reps INTEGER NOT NULL,
          rir INTEGER,
          planned_rest_sec INTEGER NOT NULL,
          actual_rest_sec REAL NOT NULL,
          logged_at TEXT NOT NULL,
          FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
          FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_workout_sets_workout ON workout_sets(workout_id);
        CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets(exercise_id);

        -- Exercise progression state
        CREATE TABLE IF NOT EXISTS exercise_tracking_state (
          exercise_id TEXT PRIMARY KEY,
          working_weight_kg REAL NOT NULL,
          consecutive_failures INTEGER DEFAULT 0,
          consecutive_stalls INTEGER DEFAULT 0,
          last_session_date TEXT,
          last_reps_json TEXT,
          estimated_1rm REAL DEFAULT 0,
          FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
        );
      `,
    },
    {
      version: 3,
      name: 'workout_and_diet_extensions',
      sql: `
        CREATE TABLE IF NOT EXISTS saved_meals (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          meal_type TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS saved_meal_items (
          id TEXT PRIMARY KEY,
          saved_meal_id TEXT NOT NULL,
          food_id TEXT NOT NULL,
          portion_quantity REAL NOT NULL,
          portion_unit TEXT NOT NULL,
          calories REAL NOT NULL,
          protein REAL NOT NULL,
          FOREIGN KEY (saved_meal_id) REFERENCES saved_meals(id) ON DELETE CASCADE,
          FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
        );
      `,
    },
  ];

  for (const m of migrations) {
    if (m.version > currentVersion) {
      const applyTx = db.transaction(() => {
        db.exec(m.sql);

        // Safe column addition for user_plan.overrides_json in migration 3
        if (m.version === 3) {
          try {
            const tableCols = db.pragma('table_info(user_plan)') as Array<{ name: string }>;
            if (!tableCols.some((col) => col.name === 'overrides_json')) {
              db.exec('ALTER TABLE user_plan ADD COLUMN overrides_json TEXT;');
            }
          } catch {
            // ignore if already present
          }
        }

        db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, datetime('now'))").run(m.version);
      });
      applyTx();
      console.log(`Applied migration ${m.version}: ${m.name}`);
    }
  }


  // Seed default exercises and foods if table is empty
  seedInitialData(db);

  const latestVersionRow = db
    .prepare('SELECT MAX(version) AS max_v FROM schema_migrations')
    .get() as { max_v: number | null };

  return latestVersionRow?.max_v ?? 0;
}

/**
 * Initializes better-sqlite3 with WAL mode, foreign keys, backups, and migrations.
 */
export function initDatabase(customPath?: string): {
  db: Database.Database;
  dbPath: string;
  backupCount: number;
  schemaVersion: number;
} {
  const targetPath = customPath || getDbPath();
  currentDbPath = targetPath;

  const backupCount = autoBackupDatabase(targetPath);

  const isElectron = Boolean(process.versions.electron);
  let dbOptions: Database.Options = {};
  
  if (!isElectron) {
    // Vitest / Node runtime: locate Node 24 compiled native addon if present
    const nodeBindingPath = path.resolve(__dirname, '../../node_modules/better-sqlite3/build/Release/better_sqlite3_node24.node');
    if (fs.existsSync(nodeBindingPath)) {
      dbOptions = { nativeBinding: nodeBindingPath };
    }
  }

  const db = new Database(targetPath, dbOptions);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaVersion = applyMigrations(db);

  dbInstance = db;

  return {
    db,
    dbPath: targetPath,
    backupCount,
    schemaVersion,
  };
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database has not been initialized. Call initDatabase() first.');
  }
  return dbInstance;
}
