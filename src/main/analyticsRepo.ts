import Database from 'better-sqlite3';
import {
  calculateWorkoutStreak,
  calculateWeeklyMuscleVolume,
  generateWeeklyReview,
  calculateEstimated1RM,
  type WeeklyVolumeSummary,
  type WeeklyReview,
  type ExercisePRHistory,
} from '../engine/progress';
import { listExercises } from './workoutRepo';
import type { Goal, Muscle } from '../engine/types';

export function getWorkoutStreak(db: Database.Database): { current_streak: number; best_streak: number } {
  const rows = db.prepare("SELECT DISTINCT date FROM workouts WHERE status = 'completed' ORDER BY date ASC").all() as Array<{ date: string }>;
  const dates = rows.map((r) => r.date);

  let weeklySchedule: Array<{ day: number; is_rest: boolean }> = [
    { day: 0, is_rest: true },
    { day: 1, is_rest: false },
    { day: 2, is_rest: false },
    { day: 3, is_rest: true },
    { day: 4, is_rest: false },
    { day: 5, is_rest: false },
    { day: 6, is_rest: true },
  ];

  const planRow = db.prepare('SELECT weekly_schedule_json FROM user_plan WHERE id = 1').get() as any;
  if (planRow && planRow.weekly_schedule_json) {
    try {
      const parsed = JSON.parse(planRow.weekly_schedule_json);
      weeklySchedule = parsed.map((p: any) => ({ day: p.day, is_rest: Boolean(p.is_rest) }));
    } catch {
      // fallback
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  return calculateWorkoutStreak({
    completedWorkoutDates: dates,
    weeklySchedule,
    todayStr,
  });
}

export function getWeeklyMuscleVolumeSummary(db: Database.Database): WeeklyVolumeSummary[] {
  const today = new Date();
  const pastWeek = new Date(today);
  pastWeek.setUTCDate(today.getUTCDate() - 6);

  const startDateStr = pastWeek.toISOString().slice(0, 10);
  const endDateStr = today.toISOString().slice(0, 10);

  // Fetch logged sets in range
  const sets = db.prepare(`
    SELECT ws.exercise_id, ws.set_number, ws.logged_at
    FROM workout_sets ws
    JOIN workouts w ON ws.workout_id = w.id
    WHERE w.status = 'completed' AND w.date >= ? AND w.date <= ?
  `).all(startDateStr, endDateStr) as Array<{ exercise_id: string; set_number: number; logged_at: string }>;

  // Fetch exercise catalog
  const exercises = listExercises(db);

  // Fetch targets from plan if available
  let weeklyMuscleTargets: Record<Muscle, number> | undefined;
  const planRow = db.prepare('SELECT muscle_targets_json FROM user_plan WHERE id = 1').get() as any;
  if (planRow && planRow.muscle_targets_json) {
    try {
      weeklyMuscleTargets = JSON.parse(planRow.muscle_targets_json);
    } catch {
      // fallback
    }
  }

  return calculateWeeklyMuscleVolume({
    sets,
    exercises: exercises as any,
    weeklyMuscleTargets,
    startDateStr,
    endDateStr,
  });
}

export function getWeeklyReviewSummary(db: Database.Database): WeeklyReview {
  const today = new Date();
  const pastWeek = new Date(today);
  pastWeek.setUTCDate(today.getUTCDate() - 6);

  const startDateStr = pastWeek.toISOString().slice(0, 10);
  const endDateStr = today.toISOString().slice(0, 10);

  // Completed workouts in last 7 days
  const completedRow = db.prepare(`
    SELECT COUNT(DISTINCT date) as cnt FROM workouts WHERE status = 'completed' AND date >= ? AND date <= ?
  `).get(startDateStr, endDateStr) as { cnt: number };
  const workoutsCompleted = completedRow ? completedRow.cnt : 0;

  // Planned days per week
  const profRow = db.prepare('SELECT days_per_week, goal FROM user_profile WHERE id = 1').get() as any;
  const workoutsPlanned = profRow ? profRow.days_per_week : 4;
  const goal: Goal = profRow ? profRow.goal : 'maintain';

  // Target protein
  const planRow = db.prepare('SELECT protein_target_g FROM user_plan WHERE id = 1').get() as any;
  const targetProtein = planRow ? planRow.protein_target_g : 140;

  // Days hit protein in last 7 days
  const dietRows = db.prepare(`
    SELECT date, SUM(protein) as total_protein
    FROM food_logs
    WHERE date >= ? AND date <= ?
    GROUP BY date
  `).all(startDateStr, endDateStr) as Array<{ date: string; total_protein: number }>;

  const daysHitProtein = dietRows.filter((r) => r.total_protein >= targetProtein * 0.9).length;

  // 7-day weight trend
  const weights = db.prepare(`
    SELECT weight_kg FROM weight_logs WHERE date >= ? AND date <= ? ORDER BY date ASC
  `).all(startDateStr, endDateStr) as Array<{ weight_kg: number }>;

  let weightChangeKg = 0;
  if (weights.length >= 2) {
    weightChangeKg = weights[weights.length - 1].weight_kg - weights[0].weight_kg;
  }

  return generateWeeklyReview({
    workoutsCompleted,
    workoutsPlanned,
    daysHitProtein,
    weightChangeKg,
    goal,
  });
}

export function getExercisePRHistorySummary(db: Database.Database, exerciseId: string): ExercisePRHistory | null {
  const exRow = db.prepare('SELECT name FROM exercises WHERE id = ?').get(exerciseId) as { name: string } | undefined;
  if (!exRow) return null;

  const rows = db.prepare(`
    SELECT ws.weight_kg, ws.reps, w.date
    FROM workout_sets ws
    JOIN workouts w ON ws.workout_id = w.id
    WHERE ws.exercise_id = ? AND w.status = 'completed'
    ORDER BY w.date ASC, ws.set_number ASC
  `).all(exerciseId) as Array<{ weight_kg: number; reps: number; date: string }>;

  if (rows.length === 0) {
    return {
      exercise_id: exerciseId,
      exercise_name: exRow.name,
      best_weight_kg: 0,
      best_reps: 0,
      estimated_1rm_kg: 0,
      history: [],
    };
  }

  let bestWeight = 0;
  let bestReps = 0;
  let best1RM = 0;

  const history = rows.map((r) => {
    const rm = calculateEstimated1RM(r.weight_kg, r.reps);
    if (r.weight_kg > bestWeight) {
      bestWeight = r.weight_kg;
    }
    if (r.reps > bestReps) {
      bestReps = r.reps;
    }
    if (rm > best1RM) {
      best1RM = rm;
    }
    return {
      date: r.date,
      weight_kg: r.weight_kg,
      reps: r.reps,
      estimated_1rm_kg: rm,
    };
  });

  return {
    exercise_id: exerciseId,
    exercise_name: exRow.name,
    best_weight_kg: bestWeight,
    best_reps: bestReps,
    estimated_1rm_kg: best1RM,
    history,
  };
}

export function getAppSettings(db: Database.Database) {
  const getMeta = (key: string, def: string) => {
    const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as any;
    return row ? row.value : def;
  };

  return {
    accentColor: getMeta('accent_color', 'emerald'),
    themeMode: (getMeta('theme_mode', 'dark') as 'dark' | 'light' | 'midnight'),
    notifications: {
      workoutReminder: getMeta('notif_workout_enabled', 'false') === 'true',
      workoutTime: getMeta('notif_workout_time', '18:00'),
      mealReminder: getMeta('notif_meal_enabled', 'false') === 'true',
      mealTime: getMeta('notif_meal_time', '13:00'),
    },
  };
}

export function saveAppSettings(
  db: Database.Database,
  settings: {
    accentColor?: string;
    themeMode?: 'dark' | 'light' | 'midnight';
    notifications?: {
      workoutReminder: boolean;
      workoutTime: string;
      mealReminder: boolean;
      mealTime: string;
    };
  }
) {
  const setMeta = db.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')");

  if (settings.accentColor !== undefined) {
    setMeta.run('accent_color', settings.accentColor);
  }
  if (settings.themeMode !== undefined) {
    setMeta.run('theme_mode', settings.themeMode);
  }
  if (settings.notifications !== undefined) {
    setMeta.run('notif_workout_enabled', String(settings.notifications.workoutReminder));
    setMeta.run('notif_workout_time', settings.notifications.workoutTime);
    setMeta.run('notif_meal_enabled', String(settings.notifications.mealReminder));
    setMeta.run('notif_meal_time', settings.notifications.mealTime);
  }
}
