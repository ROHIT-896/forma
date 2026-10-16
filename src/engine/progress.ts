import type { Muscle, ExerciseDefinition, Goal } from './types';

export interface StreakResult {
  current_streak: number;
  best_streak: number;
}

export interface ExercisePRHistory {
  exercise_id: string;
  exercise_name: string;
  best_weight_kg: number;
  best_reps: number;
  estimated_1rm_kg: number;
  history: Array<{
    date: string;
    weight_kg: number;
    reps: number;
    estimated_1rm_kg: number;
  }>;
}

export interface WeeklyVolumeSummary {
  muscle: Muscle;
  completed_sets: number;
  target_sets: number;
}

export interface AdherenceDay {
  date: string;
  calories: number;
  protein: number;
  calorie_target: number;
  protein_target: number;
  hit_protein: boolean;
  hit_calories: boolean;
}

export interface WeeklyReview {
  period_label: string;
  workouts_completed: number;
  workouts_planned: number;
  days_hit_protein: number;
  weight_change_kg: number;
  highlights: string[];
  suggested_adjustment: string;
}

/**
 * Calculates estimated 1 Rep Max (1RM) using Epley formula:
 * 1RM = Weight * (1 + Reps / 30)
 * For 1 rep, 1RM = Weight.
 */
export function calculateEstimated1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  const epley = weightKg * (1 + reps / 30);
  return Math.round(epley * 10) / 10;
}

/**
 * Calculates streak of planned workout days hit.
 * Tolerant of rest days (rest days do not break a streak).
 * Only missed planned workout days break the streak.
 */
export function calculateWorkoutStreak(params: {
  completedWorkoutDates: string[]; // ['2026-10-15', '2026-10-14', ...]
  weeklySchedule: Array<{ day: number; is_rest: boolean }>; // 0=Sun, 1=Mon, ..., 6=Sat
  todayStr: string; // YYYY-MM-DD
}): StreakResult {
  const { completedWorkoutDates, weeklySchedule, todayStr } = params;
  const completedSet = new Set(completedWorkoutDates);

  const isRestDaySchedule = (dayIndex: number): boolean => {
    const match = weeklySchedule.find((s) => s.day === dayIndex);
    return match ? match.is_rest : false;
  };

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  // Walk backwards day-by-day starting from today up to 365 days
  const today = new Date(todayStr + 'T12:00:00Z');
  let isCurrentStreakActive = true;

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getUTCDay(); // 0 = Sun ... 6 = Sat
    const isRest = isRestDaySchedule(dayOfWeek);
    const didWorkout = completedSet.has(dateStr);

    if (didWorkout) {
      tempStreak += 1;
      if (isCurrentStreakActive) {
        currentStreak += 1;
      }
    } else if (isRest) {
      // Rest day: does not break streak, but also doesn't increment count
      continue;
    } else {
      // It was a planned workout day, but no workout completed!
      if (i === 0) {
        // Today is planned but not completed yet: doesn't break yesterday's streak yet
        continue;
      }
      isCurrentStreakActive = false;
      if (tempStreak > bestStreak) {
        bestStreak = tempStreak;
      }
      tempStreak = 0;
    }

    if (tempStreak > bestStreak) {
      bestStreak = tempStreak;
    }
  }

  bestStreak = Math.max(bestStreak, currentStreak);

  return {
    current_streak: currentStreak,
    best_streak: bestStreak,
  };
}

/**
 * Aggregates completed hard sets per muscle group over a 7-day period.
 */
export function calculateWeeklyMuscleVolume(params: {
  sets: Array<{ exercise_id: string; set_number: number; logged_at: string }>;
  exercises: ExerciseDefinition[];
  weeklyMuscleTargets?: Record<Muscle, number>;
  startDateStr: string;
  endDateStr: string;
}): WeeklyVolumeSummary[] {
  const { sets, exercises, weeklyMuscleTargets, startDateStr, endDateStr } = params;
  const exMap = new Map<string, ExerciseDefinition>(exercises.map((e) => [e.id, e]));

  const volumeMap: Record<Muscle, number> = {
    chest: 0,
    back: 0,
    quads: 0,
    hamstrings: 0,
    glutes: 0,
    shoulders: 0,
    biceps: 0,
    triceps: 0,
    calves: 0,
    abs: 0,
    forearms: 0,
  };

  for (const s of sets) {
    const setDate = s.logged_at.slice(0, 10);
    if (setDate >= startDateStr && setDate <= endDateStr) {
      const ex = exMap.get(s.exercise_id);
      if (ex) {
        for (const m of ex.primary_muscles) {
          if (volumeMap[m] !== undefined) {
            volumeMap[m] += 1;
          }
        }
        // Secondary muscles get fractional 0.5 set
        for (const m of ex.secondary_muscles) {
          if (volumeMap[m] !== undefined) {
            volumeMap[m] += 0.5;
          }
        }
      }
    }
  }

  const allMuscles: Muscle[] = [
    'chest',
    'back',
    'quads',
    'hamstrings',
    'glutes',
    'shoulders',
    'biceps',
    'triceps',
    'abs',
  ];

  return allMuscles.map((m) => ({
    muscle: m,
    completed_sets: Math.round(volumeMap[m] * 10) / 10,
    target_sets: weeklyMuscleTargets?.[m] ?? 12,
  }));
}

/**
 * Generates a calm, gentle weekly review with actionable advice.
 */
export function generateWeeklyReview(params: {
  workoutsCompleted: number;
  workoutsPlanned: number;
  daysHitProtein: number;
  weightChangeKg: number;
  goal: Goal;
}): WeeklyReview {
  const { workoutsCompleted, workoutsPlanned, daysHitProtein, weightChangeKg, goal } = params;

  const highlights: string[] = [];
  if (workoutsCompleted >= workoutsPlanned) {
    highlights.push(`Hit ${workoutsCompleted}/${workoutsPlanned} planned workout sessions.`);
  } else {
    highlights.push(`Completed ${workoutsCompleted} of ${workoutsPlanned} scheduled sessions.`);
  }

  if (daysHitProtein >= 5) {
    highlights.push(`Excellent protein consistency: hit targets on ${daysHitProtein}/7 days.`);
  } else {
    highlights.push(`Hit protein target on ${daysHitProtein} days this week.`);
  }

  const sign = weightChangeKg > 0 ? '+' : '';
  highlights.push(`Bodyweight moved ${sign}${weightChangeKg.toFixed(1)} kg over 7 days.`);

  let suggestion = 'Maintain current workout load and diet targets for another week.';
  if (goal === 'gain_muscle') {
    if (weightChangeKg < 0) {
      suggestion = 'Weight dipped slightly. Consider adding 1 extra portion of carbs or a protein snack.';
    } else if (weightChangeKg > 0.6) {
      suggestion = 'Weight gained quickly. Keep protein high and watch surplus to minimize fat gain.';
    } else {
      suggestion = 'Great mass-building pace (+0.1 to +0.4 kg/wk). Keep progressing your lifts!';
    }
  } else if (goal === 'lose_fat') {
    if (weightChangeKg > 0) {
      suggestion = 'Weight was up slightly (often water retention from training). Focus on clean portions.';
    } else if (weightChangeKg < -1.0) {
      suggestion = 'Losing weight very fast. Ensure you hit daily protein to preserve lean muscle.';
    } else {
      suggestion = 'Consistent fat loss pace. Keep hitting your daily protein and water goals.';
    }
  }

  return {
    period_label: 'Past 7 Days',
    workouts_completed: workoutsCompleted,
    workouts_planned: workoutsPlanned,
    days_hit_protein: daysHitProtein,
    weight_change_kg: Math.round(weightChangeKg * 10) / 10,
    highlights,
    suggested_adjustment: suggestion,
  };
}
