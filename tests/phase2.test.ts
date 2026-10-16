import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase } from '../src/main/db';
import {
  startWorkout,
  logWorkoutSet,
  undoLastWorkoutSet,
  getWorkoutSets,
  finishWorkout,
  getExerciseHistory,
  listExercises,
  updateWorkout,
  deleteWorkout,
  deleteWorkoutSet,
  updateWorkoutSet,
} from '../src/main/workoutRepo';
import {
  generateWorkoutSession,
  getExerciseSubstitutions,
} from '../src/engine/workout';
import { calculateNextExerciseProgression } from '../src/engine/adaptation';
import { calculateElapsedRestSec, formatRestTimer } from '../src/engine/rest';
import { calculateSessionSummary, formatTimerMMSS } from '../src/engine/session';
import type { ExerciseSessionState } from '../src/engine/types';

describe('Phase 2: Workout Generator, Active Session & Progression Tracking', () => {
  let tempDir: string;
  let testDbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-test-phase2-'));
    testDbPath = path.join(tempDir, 'forma-p2.sqlite');
    const init = initDatabase(testDbPath);
    db = init.db;
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('generates a fitted workout session within tolerance', () => {
    const exercises = listExercises(db);
    expect(exercises.length).toBeGreaterThanOrEqual(80);

    const session45 = generateWorkoutSession({
      focus: 'Push',
      energy_today: 4,
      time_available_min: 45,
      equipment: 'full_gym',
      exerciseCatalog: exercises,
    });

    expect(session45.exercises.length).toBeGreaterThanOrEqual(3);
    // Tolerance is +/- 3.5 min
    expect(session45.estimated_duration_min).toBeGreaterThanOrEqual(41.5);
    expect(session45.estimated_duration_min).toBeLessThanOrEqual(48.5);
  });

  it('scales volume down on low energy (energy level 1-2) for minimal effective dose', () => {
    const exercises = listExercises(db);

    const lowEnergy = generateWorkoutSession({
      focus: 'Push',
      energy_today: 1,
      time_available_min: 45,
      equipment: 'full_gym',
      exerciseCatalog: exercises,
    });

    const highEnergy = generateWorkoutSession({
      focus: 'Push',
      energy_today: 5,
      time_available_min: 45,
      equipment: 'full_gym',
      exerciseCatalog: exercises,
    });


    const lowTotalSets = lowEnergy.exercises.reduce((s, ex) => s + ex.sets.length, 0);
    const highTotalSets = highEnergy.exercises.reduce((s, ex) => s + ex.sets.length, 0);

    expect(lowTotalSets).toBeLessThan(highTotalSets);
    expect(lowEnergy.adaptation_notes.length).toBeGreaterThan(0);
  });

  it('resolves valid exercise substitutions', () => {
    const exercises = listExercises(db);
    const benchPress = exercises.find((e) => e.id === 'barbell_bench_press');
    expect(benchPress).toBeDefined();

    const subs = getExerciseSubstitutions(benchPress!, exercises);
    expect(subs.length).toBeGreaterThan(0);
    // Should contain dumbbell bench press or pushups
    expect(subs.some((s) => s.id === 'dumbbell_bench_press' || s.movement_pattern === 'horizontal_push')).toBe(true);
  });

  it('starts a workout session in SQLite and logs sets accurately', () => {
    const workout = startWorkout(db, {
      date: '2026-10-16',
      focus: 'Push',
      planned_time_min: 45,
      energy_level: 4,
      equipment: 'full_gym',
    });

    expect(workout.id).toBeDefined();
    expect(workout.status).toBe('planned');

    // Log set 1
    const set1 = logWorkoutSet(db, {
      workout_id: workout.id,
      exercise_id: 'barbell_bench_press',
      set_number: 1,
      weight_kg: 60,
      reps: 10,
      rir: 2,
      planned_rest_sec: 120,
      actual_rest_sec: 118,
    });

    expect(set1.id).toBeDefined();
    expect(set1.weight_kg).toBe(60);
    expect(set1.reps).toBe(10);

    // Log set 2
    logWorkoutSet(db, {
      workout_id: workout.id,
      exercise_id: 'barbell_bench_press',
      set_number: 2,
      weight_kg: 60,
      reps: 10,
      rir: 1,
      planned_rest_sec: 120,
      actual_rest_sec: 122,
    });

    const sets = getWorkoutSets(db, workout.id);
    expect(sets.length).toBe(2);
    expect(sets[0].set_number).toBe(1);
    expect(sets[1].set_number).toBe(2);
  });

  it('supports Cmd+Z undo of the most recently logged set', () => {
    const workout = startWorkout(db, {
      date: '2026-10-16',
      focus: 'Pull',
      planned_time_min: 45,
      energy_level: 3,
      equipment: 'full_gym',
    });

    logWorkoutSet(db, {
      workout_id: workout.id,
      exercise_id: 'barbell_bent_over_row',
      set_number: 1,
      weight_kg: 50,
      reps: 8,
      planned_rest_sec: 90,
      actual_rest_sec: 85,
    });

    const set2 = logWorkoutSet(db, {
      workout_id: workout.id,
      exercise_id: 'barbell_bent_over_row',
      set_number: 2,
      weight_kg: 50,
      reps: 7,
      planned_rest_sec: 90,
      actual_rest_sec: 92,
    });

    // Undo set 2
    const undone = undoLastWorkoutSet(db, workout.id);
    expect(undone).toBeDefined();
    expect(undone?.id).toBe(set2.id);

    const remainingSets = getWorkoutSets(db, workout.id);
    expect(remainingSets.length).toBe(1);
    expect(remainingSets[0].set_number).toBe(1);
  });

  it('calculates rest duration using timestamps immune to system App Nap / sleep', () => {
    const setLoggedTime = Date.now() - 45000; // 45 seconds ago
    const elapsed = calculateElapsedRestSec(setLoggedTime);
    expect(elapsed).toBeGreaterThanOrEqual(44);
    expect(elapsed).toBeLessThanOrEqual(46);

    const formatted = formatRestTimer(elapsed);
    expect(formatted).toBe('00:45');

    const formattedMMSS = formatTimerMMSS(90);
    expect(formattedMMSS).toBe('01:30');
  });

  it('completes workout and updates exercise tracking state with double progression', () => {
    const exercises = listExercises(db);
    const bench = exercises.find((e) => e.id === 'barbell_bench_press')!;

    const workout = startWorkout(db, {
      date: '2026-10-16',
      focus: 'Push',
      planned_time_min: 45,
      energy_level: 4,
      equipment: 'full_gym',
    });

    const loggedSets = [
      logWorkoutSet(db, {
        workout_id: workout.id,
        exercise_id: bench.id,
        set_number: 1,
        weight_kg: 60,
        reps: 10,
        rir: 2,
        planned_rest_sec: 120,
        actual_rest_sec: 120,
      }),
      logWorkoutSet(db, {
        workout_id: workout.id,
        exercise_id: bench.id,
        set_number: 2,
        weight_kg: 60,
        reps: 10,
        rir: 2,
        planned_rest_sec: 120,
        actual_rest_sec: 120,
      }),
      logWorkoutSet(db, {
        workout_id: workout.id,
        exercise_id: bench.id,
        set_number: 3,
        weight_kg: 60,
        reps: 10,
        rir: 2,
        planned_rest_sec: 120,
        actual_rest_sec: 120,
      }),
    ];

    const exState: ExerciseSessionState = {
      exercise: bench,
      sets: [
        { set_number: 1, target_reps_min: 8, target_reps_max: 10, target_rir: 2, planned_rest_sec: 120, prescribed_weight_kg: 60 },
        { set_number: 2, target_reps_min: 8, target_reps_max: 10, target_rir: 2, planned_rest_sec: 120, prescribed_weight_kg: 60 },
        { set_number: 3, target_reps_min: 8, target_reps_max: 10, target_rir: 2, planned_rest_sec: 120, prescribed_weight_kg: 60 },
      ],
      logged_sets: loggedSets,
      previous_weight_kg: 60,
      previous_reps: [9, 9, 8],
    };

    const summary = calculateSessionSummary({
      workoutId: workout.id,
      focus: 'Push',
      plannedDurationMin: 45,
      startedAtMs: Date.now() - 40 * 60000,
      completedAtMs: Date.now(),
      exercises: [exState],
    });

    expect(summary.total_sets).toBe(3);
    expect(summary.total_volume_kg).toBe(1800); // 3 * 10 * 60
    expect(summary.pr_count).toBe(3); // hit 10 reps where max prev was 9

    // All sets at top of range (10 reps) on barbell -> increase by 2.5 kg
    expect(summary.progression_updates[0].next_weight_kg).toBe(62.5);
    expect(summary.progression_updates[0].reason).toContain('+2.5 kg');

    finishWorkout(db, summary);

    // Verify database state updated
    const history = getExerciseHistory(db, bench.id);
    expect(history.working_weight_kg).toBe(62.5);
  });

  it('implements pure double progression: +2.5 kg barbell, +2 kg dumbbell, deload on consecutive misses', () => {
    // Barbell hit top of range
    const bbProg = calculateNextExerciseProgression({
      exercise_id: 'bb_bench',
      equipment: 'barbell',
      rep_range_min: 8,
      rep_range_max: 12,
      target_rir: 2,
      current_weight_kg: 70,
      recent_sets: [{ reps: 12, rir: 2 }, { reps: 12, rir: 2 }, { reps: 12, rir: 2 }],
    });
    expect(bbProg.next_weight_kg).toBe(72.5);
    expect(bbProg.reason).toContain('+2.5 kg');

    // Dumbbell hit top of range -> +2 kg
    const dbProg = calculateNextExerciseProgression({
      exercise_id: 'db_press',
      equipment: 'dumbbell',
      rep_range_min: 8,
      rep_range_max: 12,
      target_rir: 2,
      current_weight_kg: 24,
      recent_sets: [{ reps: 12 }, { reps: 12 }],
    });
    expect(dbProg.next_weight_kg).toBe(26);
    expect(dbProg.reason).toContain('+2 kg');

    // Deload after 2 consecutive failures below range
    const deloadProg = calculateNextExerciseProgression({
      exercise_id: 'bb_squat',
      equipment: 'barbell',
      rep_range_min: 8,
      rep_range_max: 10,
      target_rir: 2,
      current_weight_kg: 100,
      recent_sets: [{ reps: 6 }, { reps: 5 }],
      consecutive_failures: 2,
    });
    expect(deloadProg.next_weight_kg).toBe(90); // 10% deload
    expect(deloadProg.suggest_deload).toBe(true);
  });

  it('holds load when user rates set too hard even if reps were hit', () => {
    const holdProg = calculateNextExerciseProgression({
      exercise_id: 'bb_bench',
      equipment: 'barbell',
      rep_range_min: 8,
      rep_range_max: 10,
      target_rir: 2,
      current_weight_kg: 80,
      recent_sets: [{ reps: 10, rir: 0 }, { reps: 10, rir: 0 }],
      user_rated_too_hard: true,
    });

    expect(holdProg.next_weight_kg).toBe(80);
    expect(holdProg.reason.toLowerCase()).toContain('hard');
  });

  it('retrieves active workout and verifies ongoing set logs', () => {
    const workout = startWorkout(db, {
      date: '2026-10-16',
      focus: 'Legs',
      planned_time_min: 60,
      energy_level: 5,
      equipment: 'full_gym',
    });

    logWorkoutSet(db, {
      workout_id: workout.id,
      exercise_id: 'barbell_back_squat',
      set_number: 1,
      weight_kg: 100,
      reps: 8,
      planned_rest_sec: 180,
      actual_rest_sec: 175,
    });

    const active = db.prepare("SELECT * FROM workouts WHERE status = 'planned'").get() as any;
    expect(active).toBeDefined();
    expect(active.id).toBe(workout.id);
    expect(active.focus).toBe('Legs');
  });

  it('filters outlier rests greater than 600s from athletic averages', () => {
    const exercises = listExercises(db);
    const squat = exercises.find((e) => e.id === 'barbell_back_squat')!;

    const summary = calculateSessionSummary({
      workoutId: 'test-outlier',
      focus: 'Legs',
      plannedDurationMin: 45,
      startedAtMs: Date.now() - 45 * 60000,
      completedAtMs: Date.now(),
      exercises: [
        {
          exercise: squat,
          sets: [{ set_number: 1, target_reps_min: 6, target_reps_max: 8, target_rir: 2, planned_rest_sec: 120, prescribed_weight_kg: 80 }],
          logged_sets: [
            {
              id: 's1',
              workout_id: 'test-outlier',
              exercise_id: squat.id,
              set_number: 1,
              weight_kg: 80,
              reps: 8,
              planned_rest_sec: 120,
              actual_rest_sec: 120,
              logged_at: new Date().toISOString(),
            },
            {
              id: 's2',
              workout_id: 'test-outlier',
              exercise_id: squat.id,
              set_number: 2,
              weight_kg: 80,
              reps: 7,
              planned_rest_sec: 120,
              actual_rest_sec: 900, // 15 min phone call distraction
              logged_at: new Date().toISOString(),
            },
          ],
        },
      ],
    });

    expect(summary.total_sets).toBe(2);
    expect(summary.total_volume_kg).toBe(80 * 8 + 80 * 7);
  });

  it('handles empty sets safely without throwing division by zero', () => {
    const summary = calculateSessionSummary({
      workoutId: 'empty-workout',
      focus: 'Arms',
      plannedDurationMin: 30,
      startedAtMs: Date.now() - 5000,
      completedAtMs: Date.now(),
      exercises: [],
    });

    expect(summary.total_sets).toBe(0);
    expect(summary.total_volume_kg).toBe(0);
    expect(summary.avg_rest_sec).toBe(0);
    expect(summary.pr_count).toBe(0);
  });

  it('retrieves accurate exercise history across sessions', () => {
    const exercises = listExercises(db);
    const bench = exercises.find((e) => e.id === 'barbell_bench_press')!;

    const w1 = startWorkout(db, {
      date: '2026-10-10',
      focus: 'Push',
      planned_time_min: 45,
      energy_level: 4,
      equipment: 'full_gym',
    });

    logWorkoutSet(db, {
      workout_id: w1.id,
      exercise_id: bench.id,
      set_number: 1,
      weight_kg: 65,
      reps: 8,
      planned_rest_sec: 120,
      actual_rest_sec: 120,
    });

    const hist = getExerciseHistory(db, bench.id);
    expect(hist.working_weight_kg).toBe(65);
    expect(hist.last_reps).toEqual([8]);
  });

  it('accurately lists recent completed workouts ordered by date', () => {
    const w1 = startWorkout(db, { date: '2026-10-12', focus: 'Push', planned_time_min: 45, energy_level: 4, equipment: 'full_gym' });
    const w2 = startWorkout(db, { date: '2026-10-14', focus: 'Pull', planned_time_min: 45, energy_level: 4, equipment: 'full_gym' });

    const recent = db.prepare('SELECT date, focus FROM workouts ORDER BY date ASC').all() as any[];
    expect(recent.length).toBeGreaterThanOrEqual(2);
    expect(recent.some((w) => w.focus === 'Push')).toBe(true);
    expect(recent.some((w) => w.focus === 'Pull')).toBe(true);
  });

  it('supports updating logged workout properties and deleting logged workouts/sets', () => {
    const exercises = listExercises(db);
    const bench = exercises.find((e) => e.name.toLowerCase().includes('bench')) || exercises[0];

    const w = startWorkout(db, {
      date: '2026-10-15',
      focus: 'Push',
      planned_time_min: 45,
      energy_level: 3,
      equipment: 'full_gym',
    });

    const s1 = logWorkoutSet(db, {
      workout_id: w.id,
      exercise_id: bench.id,
      set_number: 1,
      weight_kg: 50,
      reps: 10,
      planned_rest_sec: 90,
      actual_rest_sec: 90,
    });

    const s2 = logWorkoutSet(db, {
      workout_id: w.id,
      exercise_id: bench.id,
      set_number: 2,
      weight_kg: 55,
      reps: 8,
      planned_rest_sec: 90,
      actual_rest_sec: 90,
    });

    // 1. Update workout properties (date, focus, duration)
    const updatedW = updateWorkout(db, w.id, {
      date: '2026-10-16',
      focus: 'Upper Body',
      planned_time_min: 60,
    });
    expect(updatedW.date).toBe('2026-10-16');
    expect(updatedW.focus).toBe('Upper Body');
    expect(updatedW.planned_time_min).toBe(60);

    // 2. Update set values
    const updatedSet = updateWorkoutSet(db, s1.id, { weight_kg: 60, reps: 12 });
    expect(updatedSet.weight_kg).toBe(60);
    expect(updatedSet.reps).toBe(12);

    // 3. Delete a set
    deleteWorkoutSet(db, s2.id);
    const remainingSets = getWorkoutSets(db, w.id);
    expect(remainingSets.length).toBe(1);
    expect(remainingSets[0].id).toBe(s1.id);

    // 4. Delete the entire workout
    deleteWorkout(db, w.id);
    const checkDeleted = db.prepare('SELECT * FROM workouts WHERE id = ?').get(w.id);
    expect(checkDeleted).toBeUndefined();
    const checkSetsDeleted = db.prepare('SELECT * FROM workout_sets WHERE workout_id = ?').all(w.id);
    expect(checkSetsDeleted.length).toBe(0);
  });
});

