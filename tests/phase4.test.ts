import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
  calculateWorkoutStreak,
  calculateEstimated1RM,
  calculateWeeklyMuscleVolume,
  generateWeeklyReview,
} from '../src/engine/progress';
import { exportAllData, importAllData } from '../src/main/backupRepo';
import os from 'os';
import { initDatabase } from '../src/main/db';
import type { ExerciseDefinition, Muscle } from '../src/engine/types';

describe('Phase 4: Progress Analytics, 1RM, Weekly Review & Data Backup', () => {
  let db: Database.Database;
  let tempDir: string;
  let testDbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-test-phase4-'));
    testDbPath = path.join(tempDir, 'forma-p4.sqlite');
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

  describe('1. Estimated 1RM (Epley Formula)', () => {
    it('returns exact weight for 1 rep', () => {
      expect(calculateEstimated1RM(100, 1)).toBe(100);
      expect(calculateEstimated1RM(62.5, 1)).toBe(62.5);
    });

    it('calculates Epley 1RM accurately: Weight * (1 + Reps / 30)', () => {
      // 100 kg x 10 reps = 100 * (1 + 10/30) = 133.33 -> 133.3
      const rm = calculateEstimated1RM(100, 10);
      expect(rm).toBe(133.3);

      // 60 kg x 5 reps = 60 * (1 + 5/30) = 70.0
      expect(calculateEstimated1RM(60, 5)).toBe(70);
    });

    it('handles zero or negative inputs safely', () => {
      expect(calculateEstimated1RM(0, 10)).toBe(0);
      expect(calculateEstimated1RM(100, 0)).toBe(0);
    });
  });

  describe('2. Workout Streak Calculation', () => {
    const weeklySchedule = [
      { day: 0, is_rest: true },  // Sun: Rest
      { day: 1, is_rest: false }, // Mon: Workout
      { day: 2, is_rest: false }, // Tue: Workout
      { day: 3, is_rest: true },  // Wed: Rest
      { day: 4, is_rest: false }, // Thu: Workout
      { day: 5, is_rest: false }, // Fri: Workout
      { day: 6, is_rest: true },  // Sat: Rest
    ];

    it('tolerates rest days and maintains streak across rest days', () => {
      // Suppose Mon (2026-10-12), Tue (2026-10-13) completed.
      // Wed (2026-10-14) was a rest day.
      // Thu (2026-10-15) completed.
      // Today is Thu (2026-10-15).
      const completed = ['2026-10-12', '2026-10-13', '2026-10-15'];
      const res = calculateWorkoutStreak({
        completedWorkoutDates: completed,
        weeklySchedule,
        todayStr: '2026-10-15',
      });

      expect(res.current_streak).toBe(3);
      expect(res.best_streak).toBe(3);
    });

    it('breaks streak when a planned workout day was skipped', () => {
      // Mon (2026-10-12) done.
      // Tue (2026-10-13) skipped!
      // Wed (2026-10-14) rest day.
      // Thu (2026-10-15) done.
      const completed = ['2026-10-12', '2026-10-15'];
      const res = calculateWorkoutStreak({
        completedWorkoutDates: completed,
        weeklySchedule,
        todayStr: '2026-10-15',
      });

      // Today Thu is 1 day streak
      expect(res.current_streak).toBe(1);
    });
  });

  describe('3. Weekly Muscle Volume Aggregation', () => {
    it('aggregates primary (1.0) and secondary (0.5) volume per muscle', () => {
      const benchPress: ExerciseDefinition = {
        id: 'barbell_bench_press',
        name: 'Barbell Bench Press',
        primary_muscles: ['chest'],
        secondary_muscles: ['triceps', 'shoulders'],
        equipment: 'barbell',
        movement_pattern: 'horizontal_push',
        compound_or_isolation: 'compound',
        difficulty: 'intermediate',
        beginner_safe: true,
        short_form_cue: 'Retract scapula',
        substitution_ids: [],
      };

      const sets = [
        { exercise_id: 'barbell_bench_press', set_number: 1, logged_at: '2026-10-15T10:00:00Z' },
        { exercise_id: 'barbell_bench_press', set_number: 2, logged_at: '2026-10-15T10:03:00Z' },
        { exercise_id: 'barbell_bench_press', set_number: 3, logged_at: '2026-10-15T10:06:00Z' },
      ];

      const targets: Record<Muscle, number> = {
        chest: 12,
        back: 12,
        quads: 12,
        hamstrings: 10,
        glutes: 8,
        shoulders: 10,
        biceps: 8,
        triceps: 8,
        calves: 6,
        abs: 6,
        forearms: 4,
      };

      const summary = calculateWeeklyMuscleVolume({
        sets,
        exercises: [benchPress],
        weeklyMuscleTargets: targets,
        startDateStr: '2026-10-10',
        endDateStr: '2026-10-16',
      });

      const chest = summary.find((s) => s.muscle === 'chest');
      const triceps = summary.find((s) => s.muscle === 'triceps');

      expect(chest?.completed_sets).toBe(3);
      expect(chest?.target_sets).toBe(12);
      expect(triceps?.completed_sets).toBe(1.5); // 3 * 0.5
    });
  });

  describe('4. Gentle Weekly Review', () => {
    it('generates encouraging highlights and actionable adjustment for muscle gain', () => {
      const review = generateWeeklyReview({
        workoutsCompleted: 4,
        workoutsPlanned: 4,
        daysHitProtein: 6,
        weightChangeKg: 0.2,
        goal: 'gain_muscle',
      });

      expect(review.workouts_completed).toBe(4);
      expect(review.days_hit_protein).toBe(6);
      expect(review.highlights.length).toBeGreaterThanOrEqual(3);
      expect(review.suggested_adjustment).toContain('mass-building pace');
    });

    it('generates gentle fat loss guidance if weight stalls', () => {
      const review = generateWeeklyReview({
        workoutsCompleted: 3,
        workoutsPlanned: 4,
        daysHitProtein: 4,
        weightChangeKg: 0.3,
        goal: 'lose_fat',
      });

      expect(review.suggested_adjustment).toContain('water retention');
    });
  });

  describe('5. Full JSON Database Export & Import Round-Trip', () => {
    it('exports all user tables to JSON and restores them cleanly', () => {
      // 1. Seed some user data
      db.prepare(`
        INSERT INTO user_profile (id, height_cm, weight_kg, age, sex, goal, experience, days_per_week, equipment, dietary_type, created_at, updated_at)
        VALUES (1, 178, 74.5, 23, 'male', 'gain_muscle', 'intermediate', 4, 'full_gym', 'veg', datetime('now'), datetime('now'))
      `).run();

      db.prepare(`
        INSERT INTO workouts (id, date, focus, planned_time_min, energy_level, equipment, status, total_volume, total_sets, avg_rest_sec)
        VALUES ('w-123', '2026-10-15', 'Push', 45, 4, 'full_gym', 'completed', 3450, 9, 88)
      `).run();

      db.prepare(`
        INSERT INTO workout_sets (id, workout_id, exercise_id, set_number, weight_kg, reps, rir, planned_rest_sec, actual_rest_sec, logged_at)
        VALUES ('s-1', 'w-123', 'barbell_bench_press', 1, 70, 10, 2, 90, 85, '2026-10-15T10:00:00Z')
      `).run();

      db.prepare(`
        INSERT INTO food_logs (id, date, meal_type, food_id, portion_quantity, portion_unit, calories, protein, logged_at)
        VALUES ('fl-1', '2026-10-15', 'lunch', 'paneer_curry_mess', 1, 'katori', 240, 11.5, '2026-10-15T13:00:00Z')
      `).run();

      db.prepare(`
        INSERT INTO weight_logs (id, date, weight_kg, logged_at)
        VALUES ('wl-1', '2026-10-15', 74.5, datetime('now'))
      `).run();

      // 2. Export
      const exported = exportAllData(db);
      expect(exported.version).toBe(1);
      expect(exported.tables.user_profile.length).toBe(1);
      expect(exported.tables.workouts.length).toBe(1);
      expect(exported.tables.workout_sets.length).toBe(1);
      expect(exported.tables.food_logs.length).toBe(1);
      expect(exported.tables.weight_logs.length).toBe(1);

      // 3. Clear database tables
      db.prepare('DELETE FROM workout_sets').run();
      db.prepare('DELETE FROM workouts').run();
      db.prepare('DELETE FROM food_logs').run();
      db.prepare('DELETE FROM user_profile').run();
      db.prepare('DELETE FROM weight_logs').run();

      expect(db.prepare('SELECT COUNT(*) as cnt FROM workouts').get()).toEqual({ cnt: 0 });

      // 4. Import & Restore
      const result = importAllData(db, exported);
      expect(result.success).toBe(true);
      expect(result.counts.workouts).toBe(1);
      expect(result.counts.workout_sets).toBe(1);
      expect(result.counts.food_logs).toBe(1);

      // Verify restored content
      const restoredWorkout = db.prepare('SELECT * FROM workouts WHERE id = ?').get('w-123') as any;
      expect(restoredWorkout.focus).toBe('Push');
      expect(restoredWorkout.total_volume).toBe(3450);

      const restoredProfile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any;
      expect(restoredProfile.height_cm).toBe(178);
      expect(restoredProfile.weight_kg).toBe(74.5);
    });
  });
});
