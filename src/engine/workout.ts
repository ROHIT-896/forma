import type {
  ExerciseDefinition,
  GeneratedWorkout,
  PlannedExercise,
  PlannedSet,
  EquipmentType,
  Muscle,
} from './types';

// ============================================================================
// PROGRAMMING PRINCIPLES CONSTANTS (Tuneable, commented)
// ============================================================================

/** Average seconds taken per repetition during working sets (~3.0-3.5 seconds) */
export const SECONDS_PER_REP = 3.2;

/** Default compound movement rep ranges and rest periods */
export const COMPOUND_REPS_MIN = 6;
export const COMPOUND_REPS_MAX = 10;
export const COMPOUND_REST_SEC = 150; // 2.5 minutes between heavy compound sets

/** Default isolation movement rep ranges and rest periods */
export const ISOLATION_REPS_MIN = 10;
export const ISOLATION_REPS_MAX = 15;
export const ISOLATION_REST_SEC = 75; // 1.25 minutes between isolation sets

/** Auto warm-up duration allocation for the primary compound pattern */
export const WARMUP_DURATION_MIN = 4;

/** Allowed time-fitting tolerance in minutes (+/- 3 minutes) */
export const TIME_FITTING_TOLERANCE_MIN = 3.5;

/**
 * Filters the exercise database strictly by user's available equipment.
 * - full_gym: all exercises allowed
 * - dumbbells_only: dumbbell + bodyweight allowed
 * - bodyweight_only: bodyweight allowed only
 */
export function filterExercisesByEquipment(
  exercises: ExerciseDefinition[],
  equipment: EquipmentType
): ExerciseDefinition[] {
  return exercises.filter((ex) => {
    if (equipment === 'bodyweight_only') {
      return ex.equipment === 'bodyweight';
    }
    if (equipment === 'dumbbells_only') {
      return ex.equipment === 'dumbbell' || ex.equipment === 'bodyweight';
    }
    // full_gym allows barbell, dumbbell, cable, machine, bodyweight
    return true;
  });
}

/**
 * Filters exercises by focus area / movement pattern / muscle.
 */
export function filterExercisesByFocus(
  exercises: ExerciseDefinition[],
  focus: string
): ExerciseDefinition[] {
  const normFocus = focus.toLowerCase();

  return exercises.filter((ex) => {
    if (normFocus.includes('push')) {
      return (
        ex.primary_muscles.includes('chest') ||
        ex.primary_muscles.includes('shoulders') ||
        ex.primary_muscles.includes('triceps')
      );
    }
    if (normFocus.includes('pull')) {
      return (
        ex.primary_muscles.includes('back') ||
        ex.primary_muscles.includes('biceps') ||
        (ex.primary_muscles.includes('shoulders') && ex.movement_pattern === 'isolation')
      );
    }
    if (normFocus.includes('leg') || normFocus.includes('lower')) {
      return (
        ex.primary_muscles.includes('quads') ||
        ex.primary_muscles.includes('hamstrings') ||
        ex.primary_muscles.includes('glutes') ||
        ex.primary_muscles.includes('calves')
      );
    }
    if (normFocus.includes('upper')) {
      return (
        ex.primary_muscles.includes('chest') ||
        ex.primary_muscles.includes('back') ||
        ex.primary_muscles.includes('shoulders') ||
        ex.primary_muscles.includes('biceps') ||
        ex.primary_muscles.includes('triceps')
      );
    }
    if (normFocus.includes('full body') || normFocus.includes('full')) {
      return true;
    }

    // Direct muscle focus (e.g. "chest", "back", "arms")
    return ex.primary_muscles.some((m) => normFocus.includes(m));
  });
}

/**
 * Calculates estimated duration of a set in minutes (work time + rest time).
 */
export function estimateSetDurationMinutes(
  repsAvg: number,
  restSec: number,
  inSuperset: boolean = false
): number {
  const workSec = repsAvg * SECONDS_PER_REP;
  // If superset, rest is shared/cut between paired movements
  const effectiveRestSec = inSuperset ? restSec * 0.5 : restSec;
  return (workSec + effectiveRestSec) / 60;
}

/**
 * Generates an automated warm-up block for the primary movement pattern.
 */
export function generateWarmupBlock(primaryExercise: ExerciseDefinition): PlannedSet[] {
  return [
    {
      set_number: 1,
      target_reps_min: 8,
      target_reps_max: 10,
      target_rir: 4,
      planned_rest_sec: 60,
      prescribed_weight_kg: 0, // Light dynamic / bodyweight warm-up
      is_warmup: true,
    },
    {
      set_number: 2,
      target_reps_min: 5,
      target_reps_max: 6,
      target_rir: 3,
      planned_rest_sec: 90,
      prescribed_weight_kg: 0, // ~60-70% working weight primer
      is_warmup: true,
    },
  ];
}

/**
 * Core workout generation engine.
 * Fits exercises, sets, rest, and energy scaling into available time.
 */
export function generateWorkoutSession(params: {
  time_available_min: number; // 20, 30, 45, 60, 90
  energy_today: number; // 1 to 5
  focus: string; // "Push", "Pull", "Legs", "Upper", "Lower", "Full Body"
  equipment: EquipmentType;
  exerciseCatalog: ExerciseDefinition[];
  userExperience?: 'beginner' | 'intermediate' | 'advanced';
}): GeneratedWorkout {
  const { time_available_min, energy_today, focus, equipment, exerciseCatalog } = params;

  // 1. Filter exercises by equipment and focus
  const validForEquipment = filterExercisesByEquipment(exerciseCatalog, equipment);
  const candidateExercises = filterExercisesByFocus(validForEquipment, focus);

  // If focus pool is small (e.g. in bodyweight-only), fallback gracefully to valid exercises
  const pool = candidateExercises.length >= 3 ? candidateExercises : validForEquipment;

  // Sort pool: compounds first, then isolations
  const sortedPool = [...pool].sort((a, b) => {
    if (a.compound_or_isolation === 'compound' && b.compound_or_isolation === 'isolation') return -1;
    if (a.compound_or_isolation === 'isolation' && b.compound_or_isolation === 'compound') return 1;
    return 0;
  });

  const adaptationNotes: string[] = [];

  // 2. Energy Scaling
  // Energy 1-2: Minimum-effective dose. Keep main compound, drop accessories, higher RIR (RIR 3-4).
  // Energy 3: Standard session.
  // Energy 4-5: Full session, optional extra set or accessory.
  let targetRIR = 2;
  let compoundSetCount = 3;
  let isolationSetCount = 3;

  if (energy_today <= 2) {
    targetRIR = 3; // Keep 3-4 reps in reserve (higher RIR, less CNS fatigue)
    compoundSetCount = 2; // Reduced volume
    isolationSetCount = 2;
    adaptationNotes.push(
      `Energy level ${energy_today}/5: Auto-scaled to minimum-effective volume (2 sets/lift, RIR 3-4). ` +
      `Progression will hold steady today without counting as a failed session.`
    );
  } else if (energy_today >= 4) {
    targetRIR = energy_today === 5 ? 1 : 2;
    compoundSetCount = 3;
    isolationSetCount = 3;
    adaptationNotes.push(
      `High energy day (${energy_today}/5): Standard hard sets with optional top-set intensity.`
    );
  } else {
    adaptationNotes.push('Standard energy (3/5): Regular baseline hypertrophy volume.');
  }

  // 3. Time Fitting Algorithm
  // Available budget = time_available_min
  // Budget includes ~3 min warm-up
  const plannedExercises: PlannedExercise[] = [];
  let currentDurationMin = WARMUP_DURATION_MIN;
  const useSupersets = time_available_min <= 30; // Pair accessories for 20-30 min workouts

  // Ensure at least 1-2 compounds and 1-2 accessories if budget allows
  const compounds = sortedPool.filter((e) => e.compound_or_isolation === 'compound');
  const isolations = sortedPool.filter((e) => e.compound_or_isolation === 'isolation');

  // Select primary compound
  if (compounds.length > 0) {
    const mainLift = compounds[0];
    const isHeavy = mainLift.equipment === 'barbell' || mainLift.equipment === 'machine';
    const repsMin = isHeavy ? COMPOUND_REPS_MIN : 8;
    const repsMax = isHeavy ? COMPOUND_REPS_MAX : 12;
    const restSec = COMPOUND_REST_SEC;

    const sets: PlannedSet[] = [];
    for (let i = 1; i <= compoundSetCount; i++) {
      sets.push({
        set_number: i,
        target_reps_min: repsMin,
        target_reps_max: repsMax,
        target_rir: targetRIR,
        planned_rest_sec: restSec,
        prescribed_weight_kg: 0,
      });
    }

    const setDur = estimateSetDurationMinutes((repsMin + repsMax) / 2, restSec);
    currentDurationMin += sets.length * setDur;

    plannedExercises.push({
      exercise: mainLift,
      sets,
      warmup_note: `Auto warm-up: 2 ramp-up sets before your working sets.`,
    });
  }

  // Next candidate list
  const remainingCandidates = [
    ...compounds.slice(1),
    ...isolations,
  ];

  let candidateIdx = 0;
  while (candidateIdx < remainingCandidates.length) {
    const candidate = remainingCandidates[candidateIdx];
    const isCompound = candidate.compound_or_isolation === 'compound';

    // In low energy (1-2): keep main compound(s) at reduced volume, drop optional accessories, shorter session
    if (energy_today <= 2) {
      const maxLowEnergyExercises = time_available_min <= 30 ? 2 : 3;
      if (plannedExercises.length >= maxLowEnergyExercises) {
        break;
      }
      if (!isCompound && plannedExercises.length >= 2) {
        // Drop optional isolation accessories
        break;
      }
    }

    const repsMin = isCompound ? 8 : ISOLATION_REPS_MIN;
    const repsMax = isCompound ? 12 : ISOLATION_REPS_MAX;
    const restSec = isCompound ? 120 : ISOLATION_REST_SEC;
    const setCount = isCompound ? compoundSetCount : isolationSetCount;

    const liftSetDur = estimateSetDurationMinutes(
      (repsMin + repsMax) / 2,
      restSec,
      useSupersets && !isCompound
    );
    const totalAdditionMin = setCount * liftSetDur;

    // Check if adding this fits within target time + tolerance
    if (currentDurationMin + totalAdditionMin <= time_available_min + TIME_FITTING_TOLERANCE_MIN) {
      const sets: PlannedSet[] = [];
      for (let s = 1; s <= setCount; s++) {
        sets.push({
          set_number: s,
          target_reps_min: repsMin,
          target_reps_max: repsMax,
          target_rir: targetRIR,
          planned_rest_sec: useSupersets && !isCompound ? Math.round(restSec * 0.5) : restSec,
          prescribed_weight_kg: 0,
        });
      }

      plannedExercises.push({
        exercise: candidate,
        sets,
        superset_with: useSupersets && !isCompound ? 'Paired Superset' : undefined,
      });

      currentDurationMin += totalAdditionMin;
    } else {
      // If we cannot add a full 3-set exercise, try adding 2 sets if significant time remains (> 4 min)
      if (time_available_min - currentDurationMin >= 4 && setCount > 2) {
        const reducedSetCount = 2;
        const reducedAdditionMin = reducedSetCount * liftSetDur;
        if (currentDurationMin + reducedAdditionMin <= time_available_min + TIME_FITTING_TOLERANCE_MIN) {
          const sets: PlannedSet[] = [];
          for (let s = 1; s <= reducedSetCount; s++) {
            sets.push({
              set_number: s,
              target_reps_min: repsMin,
              target_reps_max: repsMax,
              target_rir: targetRIR,
              planned_rest_sec: restSec,
              prescribed_weight_kg: 0,
            });
          }
          plannedExercises.push({
            exercise: candidate,
            sets,
          });
          currentDurationMin += reducedAdditionMin;
        }
      }
      break; // Time budget saturated
    }

    candidateIdx++;
  }

  // Guarantee at least 1 exercise even for 20 min + energy 1
  if (plannedExercises.length === 0 && sortedPool.length > 0) {
    const fallbackEx = sortedPool[0];
    plannedExercises.push({
      exercise: fallbackEx,
      sets: [
        {
          set_number: 1,
          target_reps_min: 8,
          target_reps_max: 12,
          target_rir: 3,
          planned_rest_sec: 90,
          prescribed_weight_kg: 0,
        },
        {
          set_number: 2,
          target_reps_min: 8,
          target_reps_max: 12,
          target_rir: 3,
          planned_rest_sec: 90,
          prescribed_weight_kg: 0,
        },
      ],
    });
    currentDurationMin = 15;
  }

  const roundedDuration = Math.round(currentDurationMin);

  return {
    focus,
    energy_level: energy_today,
    time_available_min,
    estimated_duration_min: roundedDuration,
    exercises: plannedExercises,
    adaptation_notes: adaptationNotes,
  };
}

/**
 * Exercise Swap: returns valid substitutes matching user's equipment.
 */
export function getExerciseSubstitutions(
  exercise: ExerciseDefinition,
  catalog: ExerciseDefinition[],
  userEquipment: EquipmentType = 'full_gym'
): ExerciseDefinition[] {
  const validForEquipment = filterExercisesByEquipment(catalog, userEquipment);
  const subIds = new Set(exercise.substitution_ids);

  // 1. Primary substitutes from exercise's substitution list
  const directSubs = validForEquipment.filter((e) => subIds.has(e.id) && e.id !== exercise.id);

  if (directSubs.length > 0) {
    return directSubs;
  }

  // 2. Fallback: match same movement pattern and primary muscle
  return validForEquipment.filter(
    (e) =>
      e.id !== exercise.id &&
      e.movement_pattern === exercise.movement_pattern &&
      e.primary_muscles.some((m) => exercise.primary_muscles.includes(m))
  );
}

/**
 * Smart Focus Pick: suggests the most under-trained muscle group
 * from the last 7-14 days of logged workouts.
 */
export function suggestUnderTrainedFocus(
  recentWorkouts: Array<{ date: string; focus: string; musclesTrained?: Muscle[] }>,
  weeklyTargets: Record<Muscle, number>
): string {
  if (recentWorkouts.length === 0) {
    return 'Full Body';
  }

  // Count occurrences per major muscle group in the last 7 days
  const muscleCounts: Partial<Record<Muscle, number>> = {};
  for (const w of recentWorkouts) {
    if (w.musclesTrained) {
      for (const m of w.musclesTrained) {
        muscleCounts[m] = (muscleCounts[m] || 0) + 1;
      }
    } else {
      const f = w.focus.toLowerCase();
      if (f.includes('push')) {
        muscleCounts.chest = (muscleCounts.chest || 0) + 1;
        muscleCounts.shoulders = (muscleCounts.shoulders || 0) + 1;
      } else if (f.includes('pull')) {
        muscleCounts.back = (muscleCounts.back || 0) + 1;
        muscleCounts.biceps = (muscleCounts.biceps || 0) + 1;
      } else if (f.includes('leg') || f.includes('lower')) {
        muscleCounts.quads = (muscleCounts.quads || 0) + 1;
        muscleCounts.hamstrings = (muscleCounts.hamstrings || 0) + 1;
      }
    }
  }

  // Compare against weekly targets
  let mostUnderTrained: Muscle = 'chest';
  let lowestRatio = Infinity;

  const priorityMuscles: Muscle[] = ['chest', 'back', 'quads', 'hamstrings', 'shoulders'];
  for (const m of priorityMuscles) {
    const done = muscleCounts[m] || 0;
    const target = weeklyTargets[m] || 10;
    const ratio = done / target;
    if (ratio < lowestRatio) {
      lowestRatio = ratio;
      mostUnderTrained = m;
    }
  }

  if (mostUnderTrained === 'chest' || mostUnderTrained === 'shoulders') return 'Push';
  if (mostUnderTrained === 'back') return 'Pull';
  if (mostUnderTrained === 'quads' || mostUnderTrained === 'hamstrings') return 'Legs';
  return 'Upper';
}
