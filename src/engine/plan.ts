import type { UserProfileInput, WorkoutSplitPlan, Muscle } from './types';

/**
 * Chooses the scientifically optimal workout split based on training days per week and experience.
 * 3 days -> Full Body
 * 4 days -> Upper / Lower
 * 5-6 days -> Push / Pull / Legs
 */
export function generateWorkoutPlan(profile: UserProfileInput): WorkoutSplitPlan {
  const { days_per_week, experience, equipment } = profile;

  let splitType: WorkoutSplitPlan['split_type'];
  let weeklySchedule: WorkoutSplitPlan['weekly_schedule'];
  let why = '';

  // 1. Determine Split Layout
  if (days_per_week <= 3) {
    splitType = 'Full Body';
    why = 'Full Body 3x/week maximizes frequency (~3x/muscle) with full 48h recovery between sessions.';
    weeklySchedule = [
      { day: 1, day_name: 'Monday', focus: 'Full Body A', is_rest: false },
      { day: 2, day_name: 'Tuesday', focus: 'Rest & Recovery', is_rest: true },
      { day: 3, day_name: 'Wednesday', focus: 'Full Body B', is_rest: false },
      { day: 4, day_name: 'Thursday', focus: 'Rest & Recovery', is_rest: true },
      { day: 5, day_name: 'Friday', focus: 'Full Body C', is_rest: false },
      { day: 6, day_name: 'Saturday', focus: 'Active Recovery', is_rest: true },
      { day: 7, day_name: 'Sunday', focus: 'Rest & Recovery', is_rest: true },
    ];
  } else if (days_per_week === 4) {
    splitType = 'Upper / Lower';
    why = 'Upper/Lower 4x/week trains each muscle group 2x/week with optimal volume-per-session distribution.';
    weeklySchedule = [
      { day: 1, day_name: 'Monday', focus: 'Upper Body A (Push Focus)', is_rest: false },
      { day: 2, day_name: 'Tuesday', focus: 'Lower Body A (Quad Focus)', is_rest: false },
      { day: 3, day_name: 'Wednesday', focus: 'Rest & Recovery', is_rest: true },
      { day: 4, day_name: 'Thursday', focus: 'Upper Body B (Pull Focus)', is_rest: false },
      { day: 5, day_name: 'Friday', focus: 'Lower Body B (Posterior Chain)', is_rest: false },
      { day: 6, day_name: 'Saturday', focus: 'Rest & Recovery', is_rest: true },
      { day: 7, day_name: 'Sunday', focus: 'Rest & Recovery', is_rest: true },
    ];
  } else {
    splitType = 'Push / Pull / Legs';
    why = 'Push/Pull/Legs isolates movement planes cleanly, preventing overlapping fatigue across consecutive days.';
    if (days_per_week === 5) {
      weeklySchedule = [
        { day: 1, day_name: 'Monday', focus: 'Push (Chest, Shoulders, Triceps)', is_rest: false },
        { day: 2, day_name: 'Tuesday', focus: 'Pull (Back, Rear Delts, Biceps)', is_rest: false },
        { day: 3, day_name: 'Wednesday', focus: 'Legs (Quads, Hamstrings, Calves)', is_rest: false },
        { day: 4, day_name: 'Thursday', focus: 'Upper Body (Hypertrophy)', is_rest: false },
        { day: 5, day_name: 'Friday', focus: 'Lower Body (Posterior Chain)', is_rest: false },
        { day: 6, day_name: 'Saturday', focus: 'Rest & Recovery', is_rest: true },
        { day: 7, day_name: 'Sunday', focus: 'Rest & Recovery', is_rest: true },
      ];
    } else {
      // 6 days
      weeklySchedule = [
        { day: 1, day_name: 'Monday', focus: 'Push A', is_rest: false },
        { day: 2, day_name: 'Tuesday', focus: 'Pull A', is_rest: false },
        { day: 3, day_name: 'Wednesday', focus: 'Legs A', is_rest: false },
        { day: 4, day_name: 'Thursday', focus: 'Push B', is_rest: false },
        { day: 5, day_name: 'Friday', focus: 'Pull B', is_rest: false },
        { day: 6, day_name: 'Saturday', focus: 'Legs B', is_rest: false },
        { day: 7, day_name: 'Sunday', focus: 'Rest & Recovery', is_rest: true },
      ];
    }
  }

  // 2. Set Weekly Hard Sets per Muscle Group (~10-20 sets/week)
  // Beginners start at ~10-12 sets (proven sweet spot for high stimulus with low fatigue)
  // Intermediate/Advanced receive 14-18 sets
  const baseTarget = experience === 'beginner' ? 10 : experience === 'intermediate' ? 14 : 18;

  const weeklyMuscleTargets: Record<Muscle, number> = {
    chest: baseTarget,
    back: baseTarget + 2, // Back accommodates slightly higher volume (vertical + horizontal)
    quads: baseTarget,
    hamstrings: Math.max(8, baseTarget - 2),
    glutes: baseTarget,
    shoulders: baseTarget,
    biceps: Math.max(6, baseTarget - 4), // Direct arm work supplemented by compounds
    triceps: Math.max(6, baseTarget - 4),
    calves: 6,
    abs: 6,
    forearms: 4,
  };

  const startingLoadGuidance =
    experience === 'beginner'
      ? 'Start with a load that feels easy (2-3 reps in reserve, RIR 2-3). The app will automatically adapt to your true working weight over the first 2-3 sessions.'
      : 'Select a working weight where the final rep of your set reaches target RIR (1-2 reps before failure).';

  return {
    split_type: splitType,
    days_per_week,
    weekly_schedule: weeklySchedule,
    weekly_muscle_targets: weeklyMuscleTargets,
    starting_load_guidance: startingLoadGuidance,
    why: `${why} Restricted strictly to ${equipment.replace('_', ' ')}.`,
  };
}
