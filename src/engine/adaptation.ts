import type {
  ProgressionInput,
  ProgressionResult,
  Muscle,
} from './types';

/**
 * Standard minimum load increments per equipment type.
 */
export const LOAD_INCREMENTS: Record<string, number> = {
  barbell: 2.5,  // 2.5 kg smallest barbell jump (1.25 kg plates per side)
  dumbbell: 2.0, // 2.0 kg typical dumbbell increment (or 1 kg per bell)
  cable: 2.5,    // 2.5 kg weight stack plate
  machine: 5.0,  // 5.0 kg machine selector pin
  bodyweight: 0, // Bodyweight increases via reps / progression variations
};

/**
 * Double Progression Rule Engine (Section 7.A).
 * Deterministically adjusts load and reps based on performance in the previous session.
 */
export function calculateNextExerciseProgression(input: ProgressionInput): ProgressionResult {
  const {
    equipment,
    rep_range_min,
    rep_range_max,
    target_rir,
    current_weight_kg,
    recent_sets,
    consecutive_failures = 0,
    consecutive_stalls = 0,
    user_rated_too_hard = false,
  } = input;

  if (recent_sets.length === 0) {
    return {
      next_weight_kg: current_weight_kg,
      target_reps_min: rep_range_min,
      target_reps_max: rep_range_max,
      reason: 'First session with this lift. Aim for easy target RIR 2-3.',
      consecutive_failures: 0,
      consecutive_stalls: 0,
      suggest_substitute: false,
      suggest_deload: false,
    };
  }

  const allAtTop = recent_sets.every((s) => s.reps >= rep_range_max);
  const anyBelowBottom = recent_sets.some((s) => s.reps < rep_range_min);
  const increment = LOAD_INCREMENTS[equipment] || 2.5;

  // Case 5: User rated sets "much harder than planned"
  if (user_rated_too_hard) {
    return {
      next_weight_kg: current_weight_kg,
      target_reps_min: rep_range_min,
      target_reps_max: rep_range_max,
      reason: 'Hold load: You rated this session significantly harder than planned.',
      consecutive_failures: 0,
      consecutive_stalls: consecutive_stalls + 1,
      suggest_substitute: false,
      suggest_deload: false,
    };
  }

  // Case 1: All sets at top of rep range at target RIR or easier
  if (allAtTop) {
    const nextWeight = current_weight_kg + increment;
    return {
      next_weight_kg: nextWeight,
      target_reps_min: rep_range_min,
      target_reps_max: rep_range_max,
      reason: `+${increment} kg: You hit ${recent_sets.length}×${rep_range_max} reps last time! Load increased, reps reset to bottom of range.`,
      consecutive_failures: 0,
      consecutive_stalls: 0,
      suggest_substitute: false,
      suggest_deload: false,
    };
  }

  // Case 3: Any set below bottom of rep range
  if (anyBelowBottom) {
    const newFailures = consecutive_failures + 1;
    if (newFailures >= 2) {
      // 2 consecutive sessions below bottom of range -> Deload ~5-10% and rebuild
      const reducedWeight = Math.max(0, Math.round(current_weight_kg * 0.9 * 2) / 2); // ~10% deload rounded to 0.5kg
      return {
        next_weight_kg: reducedWeight,
        target_reps_min: rep_range_min,
        target_reps_max: rep_range_max,
        reason: `-10% load reset: Missed target rep range (${rep_range_min}-${rep_range_max}) in 2 consecutive sessions. Rebuilding clean form.`,
        consecutive_failures: 0,
        consecutive_stalls: 0,
        suggest_substitute: true,
        suggest_deload: true,
      };
    }

    // 1st time below range: keep load, give another chance
    return {
      next_weight_kg: current_weight_kg,
      target_reps_min: rep_range_min,
      target_reps_max: rep_range_max,
      reason: `Hold load (${current_weight_kg} kg): 1 set fell below ${rep_range_min} reps. Repeat this weight to build consistency.`,
      consecutive_failures: newFailures,
      consecutive_stalls: consecutive_stalls + 1,
      suggest_substitute: false,
      suggest_deload: false,
    };
  }

  // Case 4: Within range but not all at top (Normal progression step)
  const newStalls = consecutive_stalls + 1;
  if (newStalls >= 3) {
    // 3 consecutive sessions without hitting top of range
    return {
      next_weight_kg: current_weight_kg,
      target_reps_min: rep_range_min,
      target_reps_max: rep_range_max,
      reason: `Stall detected (3 exposures without rep increase): Consider a short deload or swapping to a substitute movement.`,
      consecutive_failures: 0,
      consecutive_stalls: newStalls,
      suggest_substitute: true,
      suggest_deload: true,
    };
  }

  // Aim for +1 rep on weakest sets
  return {
    next_weight_kg: current_weight_kg,
    target_reps_min: rep_range_min,
    target_reps_max: rep_range_max,
    reason: `Hold load (${current_weight_kg} kg): Aim for +1 rep on your final sets to hit top of range.`,
    consecutive_failures: 0,
    consecutive_stalls: newStalls,
    suggest_substitute: false,
    suggest_deload: false,
  };
}

/**
 * Weekly Volume Adaptation Engine (Section 7.B).
 * Tracks completed hard sets vs weekly target per muscle and redistributes missing volume.
 * Hard cap: Maximum +2 sets per muscle added to any single session to prevent ballooning.
 */
export const MAX_COMPENSATING_SETS_PER_SESSION = 2;

export function calculateVolumeAdjustment(params: {
  muscle: Muscle;
  completedSetsThisWeek: number;
  weeklyTargetSets: number;
  sessionsRemainingThisWeek: number;
  goodPerformanceStreak?: boolean;
}): {
  setsToAddToNextSession: number;
  reason: string;
} {
  const { completedSetsThisWeek, weeklyTargetSets, sessionsRemainingThisWeek, goodPerformanceStreak } = params;

  const deficit = weeklyTargetSets - completedSetsThisWeek;

  if (deficit <= 0) {
    if (goodPerformanceStreak) {
      return {
        setsToAddToNextSession: 1,
        reason: 'Target weekly volume consistently mastered with high performance. +1 set progression awarded.',
      };
    }
    return {
      setsToAddToNextSession: 0,
      reason: 'Weekly volume target satisfied.',
    };
  }

  if (sessionsRemainingThisWeek <= 0) {
    return {
      setsToAddToNextSession: 0,
      reason: 'Week completed.',
    };
  }

  // Distribute deficit across remaining sessions, capped at MAX_COMPENSATING_SETS_PER_SESSION
  const neededPerSession = Math.ceil(deficit / sessionsRemainingThisWeek);
  const addedSets = Math.min(MAX_COMPENSATING_SETS_PER_SESSION, neededPerSession);

  return {
    setsToAddToNextSession: addedSets,
    reason: `+${addedSets} set(s) added: Compensating for missed volume earlier this week (capped to avoid ballooning fatigue).`,
  };
}

/**
 * Missed Workouts & Long Gap Handler (Section 7.C).
 * Handles missed days and gaps between sessions with zero guilt and science-based deloads.
 */
export function handleMissedWorkoutsAndGaps(params: {
  daysSinceLastWorkout: number;
  missedSessionsThisWeek: number;
  nextScheduledFocus: string;
  previousCompletedFocus?: string;
}): {
  action: 'proceed_normal' | 'roll_forward' | 'keep_schedule' | 'minor_deload' | 'reacclimation';
  loadMultiplier: number;
  volumeMultiplier: number;
  adjustedFocus: string;
  message: string;
} {
  const {
    daysSinceLastWorkout,
    missedSessionsThisWeek,
    nextScheduledFocus,
    previousCompletedFocus,
  } = params;

  // 1. Long gap check: 14+ days gap
  if (daysSinceLastWorkout >= 14) {
    return {
      action: 'reacclimation',
      loadMultiplier: 0.70, // 30% load reduction
      volumeMultiplier: 0.60, // ~2 easy acclimation sessions first
      adjustedFocus: nextScheduledFocus,
      message: `Welcome back! After a ${daysSinceLastWorkout}-day break, today is an easy reacclimation session (60% volume, comfortable weights) to avoid intense DOMS.`,
    };
  }

  // 2. Medium gap check: 7 to 13 days gap
  if (daysSinceLastWorkout >= 7) {
    return {
      action: 'minor_deload',
      loadMultiplier: 0.85, // 15% reduction
      volumeMultiplier: 0.80, // ~1 set less per exercise
      adjustedFocus: nextScheduledFocus,
      message: `Here's today's adjusted session: Modest ~15% load reduction to prime your joints and neuromuscular grooves after ${daysSinceLastWorkout} days away.`,
    };
  }

  // 3. 2+ missed workouts in a single week
  if (missedSessionsThisWeek >= 2) {
    return {
      action: 'keep_schedule',
      loadMultiplier: 1.0,
      volumeMultiplier: 1.0,
      adjustedFocus: nextScheduledFocus,
      message: `Staying on track: Remaining sessions continue as originally planned without piling on stressful extra volume.`,
    };
  }

  // 4. 1 missed workout: roll forward to next day unless back-to-back same muscle
  if (missedSessionsThisWeek === 1) {
    const isConsecutiveConflict =
      previousCompletedFocus &&
      previousCompletedFocus.toLowerCase() === nextScheduledFocus.toLowerCase();

    if (isConsecutiveConflict) {
      return {
        action: 'keep_schedule',
        loadMultiplier: 1.0,
        volumeMultiplier: 1.0,
        adjustedFocus: nextScheduledFocus,
        message: `Skipping directly to ${nextScheduledFocus} to give yesterday's muscles adequate 48h recovery. Missed volume will be naturally redistributed.`,
      };
    }

    return {
      action: 'roll_forward',
      loadMultiplier: 1.0,
      volumeMultiplier: 1.0,
      adjustedFocus: nextScheduledFocus,
      message: `Rolled forward your missed session to today. Ready when you are!`,
    };
  }

  // Normal flow
  return {
    action: 'proceed_normal',
    loadMultiplier: 1.0,
    volumeMultiplier: 1.0,
    adjustedFocus: nextScheduledFocus,
    message: `Session ready according to plan.`,
  };
}
