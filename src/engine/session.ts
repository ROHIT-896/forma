import type {
  GeneratedWorkout,
  LoggedSet,
  WorkoutSummary,
  ExerciseSessionState,
  ProgressionInput,
} from './types';
import { calculateNextExerciseProgression } from './adaptation';
import { analyzeRestPatterns } from './rest';

/**
 * Pure session state calculations for active workouts.
 * Zero UI / Electron / Node dependencies.
 */

export interface ActiveSessionConfig {
  workoutId: string;
  workout: GeneratedWorkout;
  startedAtMs: number;
}

/**
 * Calculates a summary of the completed workout session including volume,
 * average rest, PR flags, and double-progression adaptations.
 */
export function calculateSessionSummary(params: {
  workoutId: string;
  focus: string;
  plannedDurationMin: number;
  startedAtMs: number;
  completedAtMs: number;
  exercises: ExerciseSessionState[];
}): WorkoutSummary {
  const { workoutId, focus, plannedDurationMin, startedAtMs, completedAtMs, exercises } = params;

  let totalVolume = 0;
  let totalSets = 0;
  let totalActualRestSec = 0;
  let restSetCount = 0;
  let plannedRestSecSum = 0;
  let prCount = 0;

  const progressionUpdates: WorkoutSummary['progression_updates'] = [];
  const allLoggedSetsForInsights: Array<{
    exercise_id: string;
    compound: boolean;
    actual_rest_sec: number;
    planned_rest_sec: number;
    reps: number;
  }> = [];

  for (const exState of exercises) {
    const { exercise, sets, logged_sets, previous_weight_kg = 0, previous_reps = [] } = exState;
    const maxPrevReps = previous_reps.length > 0 ? Math.max(...previous_reps) : 0;

    for (const s of logged_sets) {
      totalVolume += s.weight_kg * s.reps;
      totalSets += 1;

      if (s.actual_rest_sec > 0) {
        totalActualRestSec += s.actual_rest_sec;
        restSetCount += 1;
      }
      plannedRestSecSum += s.planned_rest_sec;

      // PR detection
      if (previous_weight_kg > 0) {
        if (s.weight_kg > previous_weight_kg) {
          prCount += 1;
        } else if (s.weight_kg === previous_weight_kg && s.reps > maxPrevReps && maxPrevReps > 0) {
          prCount += 1;
        }
      }

      allLoggedSetsForInsights.push({
        exercise_id: exercise.id,
        compound: exercise.compound_or_isolation === 'compound',
        actual_rest_sec: s.actual_rest_sec,
        planned_rest_sec: s.planned_rest_sec,
        reps: s.reps,
      });
    }

    // Determine progression if sets were logged
    if (logged_sets.length > 0) {
      const repMin = sets[0]?.target_reps_min ?? 8;
      const repMax = sets[0]?.target_reps_max ?? 12;
      const targetRir = sets[0]?.target_rir ?? 2;
      const currentWeight = logged_sets[0].weight_kg;

      const progressionInput: ProgressionInput = {
        exercise_id: exercise.id,
        equipment: exercise.equipment,
        rep_range_min: repMin,
        rep_range_max: repMax,
        target_rir: targetRir,
        current_weight_kg: currentWeight,
        recent_sets: logged_sets.map((ls) => ({ reps: ls.reps, rir: ls.rir })),
      };

      const progressionResult = calculateNextExerciseProgression(progressionInput);

      progressionUpdates.push({
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        previous_weight_kg: currentWeight,
        next_weight_kg: progressionResult.next_weight_kg,
        reason: progressionResult.reason,
      });
    }
  }

  const durationMin = Math.max(1, Math.round((completedAtMs - startedAtMs) / 60000));
  const avgRestSec = restSetCount > 0 ? Math.round(totalActualRestSec / restSetCount) : 0;
  const avgPlannedRest = totalSets > 0 ? Math.round(plannedRestSecSum / totalSets) : 90;

  // Rest insights analysis
  const restResult = analyzeRestPatterns(
    allLoggedSetsForInsights.map((s, idx) => ({
      isCompound: s.compound,
      plannedRestSec: s.planned_rest_sec,
      actualRestSec: s.actual_rest_sec,
      reps: s.reps,
      setNumber: idx + 1,
    }))
  );
  const restInsights = restResult.insightMessage ? [restResult.insightMessage] : [];

  return {
    workout_id: workoutId,
    focus,
    total_volume_kg: Math.round(totalVolume * 10) / 10,
    total_sets: totalSets,
    completed_duration_min: durationMin,
    planned_duration_min: plannedDurationMin,
    avg_rest_sec: avgRestSec,
    planned_rest_sec: avgPlannedRest,
    pr_count: prCount,
    rest_insights: restInsights,
    progression_updates: progressionUpdates,
  };
}


/**
 * Formats seconds into MM:SS for countdown display in UI and Menu Bar.
 */
export function formatTimerMMSS(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
