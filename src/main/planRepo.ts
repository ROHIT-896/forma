import Database from 'better-sqlite3';
import type {
  UserProfileInput,
  YourPlan,
  PlanOverrides,
  PlanDiffItem,
  Goal,
} from '../engine/types';
import { generateYourPlan, diffPlans } from '../engine/yourPlan';
import { evaluateWeightTrend } from '../engine/diet';
import { getWeightHistory } from './dietRepo';

export interface ProfileWithMeta extends UserProfileInput {
  accent_color?: string;
  created_at: string;
  updated_at: string;
}

export function validateProfile(input: UserProfileInput): void {
  if (input.height_cm < 120 || input.height_cm > 230) {
    throw new Error('Height must be between 120 cm and 230 cm.');
  }
  if (input.weight_kg < 30 || input.weight_kg > 250) {
    throw new Error('Weight must be between 30 kg and 250 kg.');
  }
  if (input.age < 13 || input.age > 90) {
    throw new Error('Age must be between 13 and 90 years.');
  }
  if (input.days_per_week < 2 || input.days_per_week > 7) {
    throw new Error('Training days must be between 2 and 7 days per week.');
  }
}

export function getProfile(db: Database.Database): ProfileWithMeta | null {
  const row = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any;
  if (!row) return null;

  return {
    height_cm: row.height_cm,
    weight_kg: row.weight_kg,
    age: row.age,
    sex: row.sex,
    goal: row.goal,
    experience: row.experience,
    days_per_week: row.days_per_week,
    equipment: row.equipment,
    dietary_type: row.dietary_type,
    accent_color: row.accent_color,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function deleteProfile(db: Database.Database): void {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_profile WHERE id = 1').run();
    db.prepare('DELETE FROM user_plan WHERE id = 1').run();
    db.prepare("INSERT INTO app_meta (key, value) VALUES ('onboarding_skipped', 'false') ON CONFLICT(key) DO UPDATE SET value = 'false'").run();
  });
  tx();
}

export function saveProfile(
  db: Database.Database,
  profile: UserProfileInput
): { profile: ProfileWithMeta; planOutdated: boolean } {
  validateProfile(profile);

  const existing = getProfile(db);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE user_profile
      SET height_cm = ?, weight_kg = ?, age = ?, sex = ?, goal = ?,
          experience = ?, days_per_week = ?, equipment = ?, dietary_type = ?,
          updated_at = ?
      WHERE id = 1
    `).run(
      profile.height_cm,
      profile.weight_kg,
      profile.age,
      profile.sex,
      profile.goal,
      profile.experience,
      profile.days_per_week,
      profile.equipment,
      profile.dietary_type,
      now
    );

    return {
      profile: { ...profile, created_at: existing.created_at, updated_at: now },
      planOutdated: true,
    };
  } else {
    db.prepare(`
      INSERT INTO user_profile (
        id, height_cm, weight_kg, age, sex, goal, experience,
        days_per_week, equipment, dietary_type, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profile.height_cm,
      profile.weight_kg,
      profile.age,
      profile.sex,
      profile.goal,
      profile.experience,
      profile.days_per_week,
      profile.equipment,
      profile.dietary_type,
      now,
      now
    );

    // Initial plan generation on first profile creation
    const initialPlan = generateYourPlan(profile);
    acceptPlanUpdate(db, initialPlan);

    return {
      profile: { ...profile, created_at: now, updated_at: now },
      planOutdated: false,
    };
  }
}

export function getPlan(db: Database.Database): YourPlan | null {
  const row = db.prepare('SELECT * FROM user_plan WHERE id = 1').get() as any;
  if (!row) return null;

  const baseProfile = getProfile(db);
  if (!baseProfile) return null;

  let profile: ProfileWithMeta = baseProfile;
  // Check if plan has a saved profile snapshot from when it was generated
  const planMetaRow = db.prepare("SELECT value FROM app_meta WHERE key = 'plan_profile_json'").get() as any;
  if (planMetaRow && planMetaRow.value) {
    try {
      const parsed = JSON.parse(planMetaRow.value);
      profile = { ...profile, ...parsed };
    } catch {
      // fallback to current profile
    }
  }

  let overrides: PlanOverrides | null = null;
  if (row.overrides_json) {
    try {
      overrides = JSON.parse(row.overrides_json);
    } catch {
      // ignore
    }
  }

  // Parse weekly schedule and muscle targets
  const weeklySchedule = JSON.parse(row.weekly_schedule_json);
  const muscleTargets = JSON.parse(row.muscle_targets_json);
  const mealConversions = JSON.parse(row.meal_conversions_json);

  const effectiveCalorieTarget = overrides?.calorie_target ?? row.calorie_target;
  const effectiveProteinTarget = overrides?.protein_target_g ?? row.protein_target_g;

  return {
    profile: profile!,
    diet: {
      bmr: 0,
      maintenance_calories: row.calorie_target,
      calorie_target: row.calorie_target,
      protein_target_g: row.protein_target_g,
      effective_calorie_target: effectiveCalorieTarget,
      effective_protein_target_g: effectiveProteinTarget,
      weekly_weight_change_kg: row.weekly_weight_change_kg,
      formula_breakdown: row.formula_breakdown,
      meal_level_guidance: [],
      overrides,
      protein_plan: mealConversions,
      total_planned_protein_g: mealConversions.reduce((sum: number, i: any) => sum + i.protein_g, 0),
      total_planned_calories: mealConversions.reduce((sum: number, i: any) => sum + i.calories, 0),
    },
    workout: {
      split_type: row.split_type,
      days_per_week: profile.days_per_week,
      weekly_schedule: weeklySchedule,
      weekly_muscle_targets: muscleTargets,
      starting_load_guidance: '',
      why: '',
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function previewPlanUpdate(
  db: Database.Database
): {
  currentPlan: YourPlan | null;
  nextPlan: YourPlan;
  diffs: PlanDiffItem[];
  suggestedCaloriesDelta: number;
  weightTrendReason: string;
} {
  const profile = getProfile(db);
  if (!profile) {
    throw new Error('No user profile found. Please set up profile first.');
  }

  const currentPlan = getPlan(db);

  // Check 7-day weight average
  const weightEntries = getWeightHistory(db, 28);
  const trendResult = evaluateWeightTrend(weightEntries, profile.goal as Goal);

  const effectiveWeight = trendResult.sevenDayAverage ?? profile.weight_kg;
  const caloriesDelta = trendResult.suggestAdjustment ? trendResult.suggestedCaloriesDelta : 0;

  const nextPlan = generateYourPlan(
    profile,
    effectiveWeight,
    caloriesDelta,
    currentPlan?.diet.overrides
  );

  const diffs = currentPlan ? diffPlans(currentPlan, nextPlan) : [];

  return {
    currentPlan,
    nextPlan,
    diffs,
    suggestedCaloriesDelta: caloriesDelta,
    weightTrendReason: trendResult.reason,
  };
}

export function acceptPlanUpdate(db: Database.Database, newPlan: YourPlan): void {
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    // 1. Update user_plan
    db.prepare(`
      INSERT INTO user_plan (
        id, calorie_target, protein_target_g, weekly_weight_change_kg,
        split_type, weekly_schedule_json, muscle_targets_json,
        meal_conversions_json, formula_breakdown, is_active,
        overrides_json, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        calorie_target = excluded.calorie_target,
        protein_target_g = excluded.protein_target_g,
        weekly_weight_change_kg = excluded.weekly_weight_change_kg,
        split_type = excluded.split_type,
        weekly_schedule_json = excluded.weekly_schedule_json,
        muscle_targets_json = excluded.muscle_targets_json,
        meal_conversions_json = excluded.meal_conversions_json,
        formula_breakdown = excluded.formula_breakdown,
        overrides_json = excluded.overrides_json,
        updated_at = excluded.updated_at
    `).run(
      newPlan.diet.calorie_target,
      newPlan.diet.protein_target_g,
      newPlan.diet.weekly_weight_change_kg,
      newPlan.workout.split_type,
      JSON.stringify(newPlan.workout.weekly_schedule),
      JSON.stringify(newPlan.workout.weekly_muscle_targets),
      JSON.stringify(newPlan.diet.protein_plan),
      newPlan.diet.formula_breakdown,
      newPlan.diet.overrides ? JSON.stringify(newPlan.diet.overrides) : null,
      now,
      now
    );

    // 2. Sync profile weight to the weight used in newPlan
    if (newPlan.profile.weight_kg) {
      db.prepare('UPDATE user_profile SET weight_kg = ?, updated_at = ? WHERE id = 1').run(
        newPlan.profile.weight_kg,
        now
      );
    }

    // 3. Save profile snapshot for the plan
    db.prepare(`
      INSERT INTO app_meta (key, value, updated_at)
      VALUES ('plan_profile_json', ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(newPlan.profile), now);
  });

  tx();
}


export function setPlanOverrides(
  db: Database.Database,
  overrides: PlanOverrides | null
): YourPlan {
  const overridesJson = overrides ? JSON.stringify(overrides) : null;
  db.prepare('UPDATE user_plan SET overrides_json = ?, updated_at = ? WHERE id = 1').run(
    overridesJson,
    new Date().toISOString()
  );

  const updatedPlan = getPlan(db);
  if (!updatedPlan) {
    throw new Error('Failed to load plan after updating overrides.');
  }
  return updatedPlan;
}

export function getMessMode(db: Database.Database): boolean {
  const row = db.prepare("SELECT value FROM app_meta WHERE key = 'mess_mode'").get() as any;
  return row ? row.value === '1' || row.value === 'true' : true; // default true for Indian mess/hostel
}

export function setMessMode(db: Database.Database, enabled: boolean): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO app_meta (key, value, updated_at)
    VALUES ('mess_mode', ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(enabled ? '1' : '0', now);
}

export function getOnboardingSkipped(db: Database.Database): boolean {
  const row = db.prepare("SELECT value FROM app_meta WHERE key = 'onboarding_skipped'").get() as any;
  return row ? row.value === '1' || row.value === 'true' : false;
}

export function setOnboardingSkipped(db: Database.Database, skipped: boolean): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO app_meta (key, value, updated_at)
    VALUES ('onboarding_skipped', ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(skipped ? '1' : '0', now);
}
