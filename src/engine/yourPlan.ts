import type {
  UserProfileInput,
  YourPlan,
  PlanOverrides,
  PlanDiffItem,
  ProteinPlanItem,
  TodaysPlannedSession,
  MissedWorkoutAdaptation,
  MealType,
  DietaryType,
} from './types';
import { generateDietPlan } from './diet';
import { generateWorkoutPlan } from './plan';
import { handleMissedWorkoutsAndGaps } from './adaptation';

/**
 * Builds meal-by-meal protein guidance using Indian mess / student staples.
 * Strictly respects dietary type:
 * - 'veg': No chicken, no eggs.
 * - 'eggetarian': Eggs allowed, NO chicken/meat.
 * - 'non_veg': Chicken, eggs, and veg staples allowed.
 */
export function buildProteinPlan(
  targetProteinG: number,
  dietaryType: DietaryType
): ProteinPlanItem[] {
  const items: ProteinPlanItem[] = [];

  if (dietaryType === 'non_veg') {
    items.push({
      meal_type: 'breakfast',
      food_id: 'boiled_eggs',
      food_name: 'Boiled Eggs (2 pcs)',
      portion_qty: 2,
      portion_unit: 'piece',
      protein_g: 12,
      calories: 140,
      is_mess_item: true,
      mess_serving_definition: '2 whole eggs boiled',
      note: 'Hostel mess breakfast staple',
    });
    items.push({
      meal_type: 'lunch',
      food_id: 'chicken_curry',
      food_name: 'Chicken Curry (Mess bowl)',
      portion_qty: 1,
      portion_unit: 'bowl',
      protein_g: 28,
      calories: 280,
      is_mess_item: true,
      mess_serving_definition: '1 medium katori chicken curry',
    });
    items.push({
      meal_type: 'snacks',
      food_id: 'curd_dahi',
      food_name: 'Curd / Dahi (1 katori)',
      portion_qty: 1,
      portion_unit: 'katori',
      protein_g: 6,
      calories: 90,
      is_mess_item: true,
      mess_serving_definition: '1 katori fresh dahi',
    });
    items.push({
      meal_type: 'dinner',
      food_id: 'paneer_bhurji',
      food_name: 'Paneer Bhurji / Curry (100g)',
      portion_qty: 1,
      portion_unit: 'bowl',
      protein_g: 18,
      calories: 260,
      is_mess_item: true,
      mess_serving_definition: '1 deep katori paneer sabzi',
    });
  } else if (dietaryType === 'eggetarian') {
    items.push({
      meal_type: 'breakfast',
      food_id: 'boiled_eggs',
      food_name: 'Boiled Eggs (2 pcs)',
      portion_qty: 2,
      portion_unit: 'piece',
      protein_g: 12,
      calories: 140,
      is_mess_item: true,
      mess_serving_definition: '2 whole eggs boiled',
      note: 'Quick morning protein',
    });
    items.push({
      meal_type: 'lunch',
      food_id: 'paneer_curry',
      food_name: 'Paneer Curry (100g)',
      portion_qty: 1,
      portion_unit: 'bowl',
      protein_g: 18,
      calories: 260,
      is_mess_item: true,
      mess_serving_definition: '1 katori mess paneer sabzi',
    });
    items.push({
      meal_type: 'snacks',
      food_id: 'boiled_eggs_evening',
      food_name: 'Boiled Eggs (2 pcs)',
      portion_qty: 2,
      portion_unit: 'piece',
      protein_g: 12,
      calories: 140,
      is_mess_item: true,
      mess_serving_definition: '2 boiled eggs from mess/canteen',
    });
    items.push({
      meal_type: 'dinner',
      food_id: 'soya_chunks_curry',
      food_name: 'Soya Chunks Curry (Nutrela)',
      portion_qty: 1,
      portion_unit: 'bowl',
      protein_g: 22,
      calories: 180,
      is_mess_item: true,
      mess_serving_definition: '1 bowl soya chunks curry',
    });
  } else {
    // Pure veg
    items.push({
      meal_type: 'breakfast',
      food_id: 'sprouted_moong',
      food_name: 'Sprouted Moong Salad',
      portion_qty: 1,
      portion_unit: 'bowl',
      protein_g: 8,
      calories: 120,
      is_mess_item: false,
      mess_serving_definition: '1 medium bowl boiled/steamed sprouts',
    });
    items.push({
      meal_type: 'lunch',
      food_id: 'paneer_curry',
      food_name: 'Paneer Curry (100g)',
      portion_qty: 1,
      portion_unit: 'bowl',
      protein_g: 18,
      calories: 260,
      is_mess_item: true,
      mess_serving_definition: '1 katori mess paneer sabzi',
    });
    items.push({
      meal_type: 'snacks',
      food_id: 'curd_dahi',
      food_name: 'Curd / Dahi (1 katori)',
      portion_qty: 1,
      portion_unit: 'katori',
      protein_g: 6,
      calories: 90,
      is_mess_item: true,
      mess_serving_definition: '1 katori fresh dahi',
    });
    items.push({
      meal_type: 'dinner',
      food_id: 'soya_chunks_curry',
      food_name: 'Soya Chunks Curry (Nutrela)',
      portion_qty: 1,
      portion_unit: 'bowl',
      protein_g: 25,
      calories: 200,
      is_mess_item: true,
      mess_serving_definition: '1 bowl soya chunks curry',
    });
  }

  // If protein target exceeds items, supplement with whey or milk
  let currentProtein = items.reduce((sum, item) => sum + item.protein_g, 0);
  if (currentProtein < targetProteinG) {
    items.push({
      meal_type: 'extra',
      food_id: 'whey_protein',
      food_name: 'Whey Protein (1 scoop)',
      portion_qty: 1,
      portion_unit: 'scoop',
      protein_g: 24,
      calories: 120,
      is_mess_item: false,
      mess_serving_definition: '1 standard 30g scoop with water',
      note: 'Hostel protein insurance',
    });
    currentProtein += 24;
  }

  return items;
}

/**
 * Generates the complete "Your Plan" object (Diet + Workout split + targets).
 */
export function generateYourPlan(
  profile: UserProfileInput,
  latestWeightKg?: number,
  weightTrendAdjustment?: number,
  overrides?: PlanOverrides | null
): YourPlan {
  const effectiveWeight = latestWeightKg ?? profile.weight_kg;
  const effectiveProfile = { ...profile, weight_kg: effectiveWeight };

  const dietPlan = generateDietPlan(effectiveProfile);
  const workoutPlan = generateWorkoutPlan(profile);

  // Apply weight trend adjustment if provided (e.g. 14-day flat detection suggestion)
  let calorieTarget = dietPlan.calorie_target;
  if (weightTrendAdjustment && typeof weightTrendAdjustment === 'number') {
    calorieTarget += weightTrendAdjustment;
  }

  const effectiveCalorieTarget = overrides?.calorie_target ?? calorieTarget;
  const effectiveProteinTarget = overrides?.protein_target_g ?? dietPlan.protein_target_g;

  const proteinPlan = buildProteinPlan(effectiveProteinTarget, profile.dietary_type);
  const totalPlannedProtein = proteinPlan.reduce((s, i) => s + i.protein_g, 0);
  const totalPlannedCalories = proteinPlan.reduce((s, i) => s + i.calories, 0);

  const now = new Date().toISOString();

  return {
    profile: effectiveProfile,
    diet: {
      ...dietPlan,
      calorie_target: calorieTarget,
      effective_calorie_target: effectiveCalorieTarget,
      effective_protein_target_g: effectiveProteinTarget,
      overrides: overrides ?? null,
      protein_plan: proteinPlan,
      total_planned_protein_g: totalPlannedProtein,
      total_planned_calories: totalPlannedCalories,
    },
    workout: workoutPlan,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Compares two YourPlan instances and outputs human-readable diff items.
 * If identical, returns an empty array.
 */
export function diffPlans(oldPlan: YourPlan, newPlan: YourPlan): PlanDiffItem[] {
  const diffs: PlanDiffItem[] = [];

  // Calorie target
  if (oldPlan.diet.calorie_target !== newPlan.diet.calorie_target) {
    diffs.push({
      category: 'diet',
      field: 'calorie_target',
      label: 'Daily Calories',
      from: `${oldPlan.diet.calorie_target} kcal`,
      to: `${newPlan.diet.calorie_target} kcal`,
      reason:
        newPlan.profile.weight_kg !== oldPlan.profile.weight_kg
          ? `Updated for bodyweight change (${oldPlan.profile.weight_kg} kg → ${newPlan.profile.weight_kg} kg)`
          : 'Goal/activity adjustment applied',
    });
  }

  // Protein target
  if (oldPlan.diet.protein_target_g !== newPlan.diet.protein_target_g) {
    diffs.push({
      category: 'diet',
      field: 'protein_target_g',
      label: 'Daily Protein',
      from: `${oldPlan.diet.protein_target_g} g`,
      to: `${newPlan.diet.protein_target_g} g`,
      reason: `Scaled to current bodyweight (${newPlan.profile.weight_kg} kg)`,
    });
  }

  // Workout split
  if (oldPlan.workout.split_type !== newPlan.workout.split_type) {
    diffs.push({
      category: 'workout',
      field: 'split_type',
      label: 'Workout Split',
      from: oldPlan.workout.split_type,
      to: newPlan.workout.split_type,
      reason: `Optimized for ${newPlan.profile.days_per_week} days/week training schedule`,
    });
  }

  // Days per week
  if (oldPlan.profile.days_per_week !== newPlan.profile.days_per_week) {
    diffs.push({
      category: 'workout',
      field: 'days_per_week',
      label: 'Training Days / Week',
      from: `${oldPlan.profile.days_per_week} days`,
      to: `${newPlan.profile.days_per_week} days`,
      reason: 'Schedule change in profile',
    });
  }

  return diffs;
}

/**
 * Resolves today's scheduled session based on the user's plan and completed sessions.
 * Implements:
 * - 1-missed roll-forward without back-to-back same muscle focus
 * - Rest day calm messaging
 */
export function resolveTodaysPlannedSession(
  plan: YourPlan,
  completedWorkouts: Array<{ date: string; focus: string; status: string }>,
  todayDateStr: string
): TodaysPlannedSession {
  const schedule = plan.workout.weekly_schedule;
  if (!schedule || schedule.length === 0) {
    return {
      focus: 'Full Body',
      is_rest_day: false,
      day_name: 'Today',
      message: "Ready for today's session: Full Body",
      suggested_focus: 'Full Body',
    };
  }

  // Date parsing to determine day index (Monday=1 ... Sunday=7 matching schedule)
  const dateObj = new Date(todayDateStr);
  const jsDay = dateObj.getDay(); // 0 is Sunday, 1 is Monday
  const dayIndex = jsDay === 0 ? 7 : jsDay;

  const scheduledToday = schedule.find((s) => s.day === dayIndex) || schedule[0];

  const sortedWorkouts = [...completedWorkouts]
    .filter((w) => w.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date));

  const lastCompleted = sortedWorkouts[0];

  // Calculate days since last completed workout
  let daysSinceLastWorkout = 0;
  if (lastCompleted) {
    const lastDate = new Date(lastCompleted.date);
    const diffMs = dateObj.getTime() - lastDate.getTime();
    daysSinceLastWorkout = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  // Detect missed workout sessions in the current week (from Monday up to yesterday)
  let missedSessionsThisWeek = 0;
  let mostRecentMissed: { day: number; day_name: string; focus: string; date: string } | null = null;

  const daysElapsedThisWeek = dayIndex - 1; // 0 on Monday, 1 on Tuesday, 2 on Wednesday, etc.
  for (let i = 1; i <= daysElapsedThisWeek; i++) {
    const checkDate = new Date(dateObj);
    checkDate.setDate(checkDate.getDate() - i);
    const checkDateStr = checkDate.toISOString().slice(0, 10);
    const checkJsDay = checkDate.getDay();
    const checkDayIndex = checkJsDay === 0 ? 7 : checkJsDay;
    const scheduledForDate = schedule.find((s) => s.day === checkDayIndex);

    if (scheduledForDate && !scheduledForDate.is_rest) {
      const hadWorkout = sortedWorkouts.some((w) => w.date === checkDateStr);
      if (!hadWorkout) {
        missedSessionsThisWeek++;
        if (!mostRecentMissed) {
          mostRecentMissed = {
            day: scheduledForDate.day,
            day_name: scheduledForDate.day_name,
            focus: scheduledForDate.focus,
            date: checkDateStr,
          };
        }
      }
    }
  }

  // If today is Monday, also check if Sunday was a scheduled session that was missed
  if (daysElapsedThisWeek === 0) {
    const yesterdayDate = new Date(dateObj);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayDateStr = yesterdayDate.toISOString().slice(0, 10);
    const scheduledSun = schedule.find((s) => s.day === 7);
    if (scheduledSun && !scheduledSun.is_rest) {
      const hadWorkout = sortedWorkouts.some((w) => w.date === yesterdayDateStr);
      if (!hadWorkout) {
        missedSessionsThisWeek = 1;
        mostRecentMissed = {
          day: scheduledSun.day,
          day_name: scheduledSun.day_name,
          focus: scheduledSun.focus,
          date: yesterdayDateStr,
        };
      }
    }
  }

  const targetFocus = scheduledToday.is_rest
    ? mostRecentMissed?.focus || 'Full Body'
    : scheduledToday.focus;

  const gapResult = handleMissedWorkoutsAndGaps({
    daysSinceLastWorkout,
    missedSessionsThisWeek,
    nextScheduledFocus: targetFocus,
    previousCompletedFocus: lastCompleted?.focus,
  });

  const adaptation: MissedWorkoutAdaptation | undefined =
    missedSessionsThisWeek > 0 || daysSinceLastWorkout >= 7
      ? {
          has_missed_workout: true,
          missed_day_name: mostRecentMissed?.day_name,
          missed_focus: mostRecentMissed?.focus,
          missed_date: mostRecentMissed?.date,
          action: gapResult.action,
          load_multiplier: gapResult.loadMultiplier,
          volume_multiplier: gapResult.volumeMultiplier,
          message: gapResult.message,
        }
      : undefined;

  // Case A: Today is scheduled as a rest day
  if (scheduledToday.is_rest) {
    if (mostRecentMissed && gapResult.action === 'roll_forward') {
      return {
        focus: mostRecentMissed.focus,
        is_rest_day: false,
        day_name: scheduledToday.day_name,
        message: `Rolled forward missed ${mostRecentMissed.focus} session from ${mostRecentMissed.day_name}`,
        suggested_focus: mostRecentMissed.focus,
        adaptation,
      };
    }

    return {
      focus: null,
      is_rest_day: true,
      day_name: scheduledToday.day_name,
      message: 'Rest day on your plan — a session is still fine if you feel like it.',
      suggested_focus: 'Full Body',
      adaptation,
    };
  }

  // Case B: Today is a scheduled workout day
  let finalFocus = scheduledToday.focus;
  // If user completed a workout yesterday with the same focus, avoid back-to-back same muscle fatigue
  const yesterdayStr = new Date(dateObj.getTime() - 86400000).toISOString().slice(0, 10);
  if (lastCompleted && lastCompleted.date === yesterdayStr && lastCompleted.focus === finalFocus) {
    const alt = schedule.find((s) => !s.is_rest && s.focus !== finalFocus);
    if (alt) finalFocus = alt.focus;
  }

  let message = `Today's scheduled session: ${finalFocus}`;
  if (gapResult.action === 'roll_forward' && mostRecentMissed && mostRecentMissed.focus !== finalFocus) {
    message = `Option to roll forward missed ${mostRecentMissed.focus} (${mostRecentMissed.day_name}), or proceed with ${finalFocus}.`;
  } else if (gapResult.action === 'minor_deload' || gapResult.action === 'reacclimation') {
    message = gapResult.message;
  }

  return {
    focus: finalFocus,
    is_rest_day: false,
    day_name: scheduledToday.day_name,
    message,
    suggested_focus:
      gapResult.action === 'roll_forward' && mostRecentMissed
        ? mostRecentMissed.focus
        : finalFocus,
    adaptation,
  };
}
