import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type {
  LoggedSet,
  WorkoutSummary,
  ExerciseDefinition,
} from '../engine/types';

export interface WorkoutRow {
  id: string;
  date: string;
  focus: string;
  planned_time_min: number;
  energy_level: number;
  equipment: string;
  status: 'planned' | 'completed' | 'skipped';
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_volume: number;
  total_sets: number;
  avg_rest_sec: number;
}

export function startWorkout(
  db: Database.Database,
  params: {
    id?: string;
    date: string;
    focus: string;
    planned_time_min: number;
    energy_level: number;
    equipment: string;
  }
): WorkoutRow {
  const id = params.id || randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO workouts (
      id, date, focus, planned_time_min, energy_level, equipment,
      status, started_at, total_volume, total_sets, avg_rest_sec
    ) VALUES (?, ?, ?, ?, ?, ?, 'planned', ?, 0, 0, 0)
  `);

  stmt.run(
    id,
    params.date,
    params.focus,
    params.planned_time_min,
    params.energy_level,
    params.equipment,
    now
  );

  return db.prepare('SELECT * FROM workouts WHERE id = ?').get(id) as WorkoutRow;
}

export function logWorkoutSet(
  db: Database.Database,
  set: {
    id?: string;
    workout_id: string;
    exercise_id: string;
    set_number: number;
    weight_kg: number;
    reps: number;
    rir?: number;
    planned_rest_sec: number;
    actual_rest_sec: number;
  }
): LoggedSet {
  const id = set.id || randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO workout_sets (
      id, workout_id, exercise_id, set_number, weight_kg, reps,
      rir, planned_rest_sec, actual_rest_sec, logged_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    set.workout_id,
    set.exercise_id,
    set.set_number,
    set.weight_kg,
    set.reps,
    set.rir ?? null,
    set.planned_rest_sec,
    set.actual_rest_sec,
    now
  );

  return {
    id,
    workout_id: set.workout_id,
    exercise_id: set.exercise_id,
    set_number: set.set_number,
    weight_kg: set.weight_kg,
    reps: set.reps,
    rir: set.rir,
    planned_rest_sec: set.planned_rest_sec,
    actual_rest_sec: set.actual_rest_sec,
    logged_at: now,
  };
}

export function undoLastWorkoutSet(
  db: Database.Database,
  workoutId: string
): LoggedSet | null {
  const lastSet = db
    .prepare(
      'SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY set_number DESC, rowid DESC LIMIT 1'
    )
    .get(workoutId) as LoggedSet | undefined;

  if (!lastSet) return null;

  db.prepare('DELETE FROM workout_sets WHERE id = ?').run(lastSet.id);
  return lastSet;
}

export function cancelWorkout(db: Database.Database, workoutId: string): void {
  const cancelTx = db.transaction(() => {
    db.prepare('DELETE FROM workout_sets WHERE workout_id = ?').run(workoutId);
    db.prepare('DELETE FROM workouts WHERE id = ?').run(workoutId);
  });
  cancelTx();
}

export function getWorkoutSets(
  db: Database.Database,
  workoutId: string
): LoggedSet[] {
  return db
    .prepare('SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY set_number ASC, logged_at ASC')
    .all(workoutId) as LoggedSet[];
}

export function finishWorkout(
  db: Database.Database,
  summary: WorkoutSummary
): void {
  const now = new Date().toISOString();

  const finishTx = db.transaction(() => {
    // 1. Update workout table
    db.prepare(`
      UPDATE workouts
      SET status = 'completed',
          completed_at = ?,
          total_volume = ?,
          total_sets = ?,
          avg_rest_sec = ?
      WHERE id = ?
    `).run(
      now,
      summary.total_volume_kg,
      summary.total_sets,
      summary.avg_rest_sec,
      summary.workout_id
    );

    // 2. Update exercise tracking state & progression
    for (const update of summary.progression_updates) {
      const existing = db
        .prepare('SELECT * FROM exercise_tracking_state WHERE exercise_id = ?')
        .get(update.exercise_id) as any;

      if (existing) {
        db.prepare(`
          UPDATE exercise_tracking_state
          SET working_weight_kg = ?,
              last_session_date = ?,
              last_reps_json = ?
          WHERE exercise_id = ?
        `).run(
          update.next_weight_kg,
          now,
          JSON.stringify([update.previous_weight_kg]),
          update.exercise_id
        );
      } else {
        db.prepare(`
          INSERT INTO exercise_tracking_state (
            exercise_id, working_weight_kg, last_session_date, last_reps_json
          ) VALUES (?, ?, ?, ?)
        `).run(
          update.exercise_id,
          update.next_weight_kg,
          now,
          JSON.stringify([update.previous_weight_kg])
        );
      }
    }
  });

  finishTx();
}

export function getActiveWorkout(db: Database.Database): {
  workout: WorkoutRow;
  sets: LoggedSet[];
} | null {
  const workout = db
    .prepare("SELECT * FROM workouts WHERE status = 'planned' ORDER BY started_at DESC LIMIT 1")
    .get() as WorkoutRow | undefined;

  if (!workout) return null;

  const sets = getWorkoutSets(db, workout.id);
  return { workout, sets };
}

export function getExerciseHistory(
  db: Database.Database,
  exerciseId: string
): {
  working_weight_kg: number;
  last_reps: number[];
  last_session_date: string | null;
} {
  const tracking = db
    .prepare('SELECT * FROM exercise_tracking_state WHERE exercise_id = ?')
    .get(exerciseId) as any;

  if (tracking) {
    let lastReps: number[] = [];
    try {
      if (tracking.last_reps_json) {
        lastReps = JSON.parse(tracking.last_reps_json);
      }
    } catch {
      // ignore
    }
    return {
      working_weight_kg: tracking.working_weight_kg,
      last_reps: lastReps,
      last_session_date: tracking.last_session_date,
    };
  }

  // Fallback: look at latest set in workout_sets
  const latestSet = db
    .prepare(
      'SELECT weight_kg, reps, logged_at FROM workout_sets WHERE exercise_id = ? ORDER BY logged_at DESC LIMIT 1'
    )
    .get(exerciseId) as any;

  if (latestSet) {
    return {
      working_weight_kg: latestSet.weight_kg,
      last_reps: [latestSet.reps],
      last_session_date: latestSet.logged_at,
    };
  }

  return {
    working_weight_kg: 0,
    last_reps: [],
    last_session_date: null,
  };
}

export function listExercises(db: Database.Database): ExerciseDefinition[] {
  const rows = db.prepare('SELECT * FROM exercises ORDER BY name ASC').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    primary_muscles: JSON.parse(r.primary_muscles_json),
    secondary_muscles: JSON.parse(r.secondary_muscles_json),
    equipment: r.equipment,
    movement_pattern: r.movement_pattern,
    compound_or_isolation: r.compound_or_isolation,
    difficulty: r.difficulty,
    beginner_safe: Boolean(r.beginner_safe),
    short_form_cue: r.short_form_cue,
    substitution_ids: JSON.parse(r.substitution_ids_json),
  }));
}

export function getRecentWorkouts(db: Database.Database, limit = 15): WorkoutRow[] {
  return db
    .prepare('SELECT * FROM workouts ORDER BY date DESC, started_at DESC LIMIT ?')
    .all(limit) as WorkoutRow[];
}

export function recalculateWorkoutStats(db: Database.Database, workoutId: string): void {
  const sets = db.prepare('SELECT weight_kg, reps FROM workout_sets WHERE workout_id = ?').all(workoutId) as Array<{ weight_kg: number; reps: number }>;
  const totalVolume = sets.reduce((sum, s) => sum + (s.weight_kg * s.reps), 0);
  const totalSets = sets.length;
  db.prepare('UPDATE workouts SET total_volume = ?, total_sets = ? WHERE id = ?').run(totalVolume, totalSets, workoutId);
}

export function updateWorkout(
  db: Database.Database,
  workoutId: string,
  updates: { date?: string; focus?: string; planned_time_min?: number }
): WorkoutRow {
  const fields: string[] = [];
  const params: any[] = [];
  if (updates.date !== undefined) {
    fields.push('date = ?');
    params.push(updates.date);
  }
  if (updates.focus !== undefined) {
    fields.push('focus = ?');
    params.push(updates.focus);
  }
  if (updates.planned_time_min !== undefined) {
    fields.push('planned_time_min = ?');
    params.push(updates.planned_time_min);
  }
  if (fields.length > 0) {
    params.push(workoutId);
    db.prepare(`UPDATE workouts SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
  return db.prepare('SELECT * FROM workouts WHERE id = ?').get(workoutId) as WorkoutRow;
}

export function deleteWorkout(db: Database.Database, workoutId: string): void {
  cancelWorkout(db, workoutId);
}

export function deleteWorkoutSet(db: Database.Database, setId: string): void {
  const setRow = db.prepare('SELECT workout_id FROM workout_sets WHERE id = ?').get(setId) as { workout_id: string } | undefined;
  if (!setRow) return;
  db.prepare('DELETE FROM workout_sets WHERE id = ?').run(setId);
  recalculateWorkoutStats(db, setRow.workout_id);
}

export function updateWorkoutSet(
  db: Database.Database,
  setId: string,
  updates: { weight_kg?: number; reps?: number }
): LoggedSet {
  const fields: string[] = [];
  const params: any[] = [];
  if (updates.weight_kg !== undefined) {
    fields.push('weight_kg = ?');
    params.push(updates.weight_kg);
  }
  if (updates.reps !== undefined) {
    fields.push('reps = ?');
    params.push(updates.reps);
  }
  if (fields.length > 0) {
    params.push(setId);
    db.prepare(`UPDATE workout_sets SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
  const updatedSet = db.prepare('SELECT * FROM workout_sets WHERE id = ?').get(setId) as LoggedSet;
  if (updatedSet) {
    recalculateWorkoutStats(db, updatedSet.workout_id);
  }
  return updatedSet;
}
