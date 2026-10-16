import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase } from '../src/main/db';
import {
  saveProfile,
  getProfile,
  getPlan,
  previewPlanUpdate,
  acceptPlanUpdate,
  setPlanOverrides,
  getMessMode,
  setMessMode,
  updateSchedule,
} from '../src/main/planRepo';
import {
  listFoods,
  logFood,
  deleteFoodLog,
  getDayDiet,
  repeatYesterdayMeal,
  saveMeal,
  listSavedMeals,
  logSavedMeal,
  deleteSavedMeal,
  logQuickProtein,
  addWater,
  undoLastWater,
  logWeight,
  getWeightHistory,
  upsertFood,
} from '../src/main/dietRepo';
import {
  generateYourPlan,
  diffPlans,
  resolveTodaysPlannedSession,
  buildProteinPlan,
} from '../src/engine/yourPlan';
import { evaluateWeightTrend, convertPortionToNutrition } from '../src/engine/diet';
import type { UserProfileInput } from '../src/engine/types';

describe('Phase 3: Diet Logging, Your Plan, Onboarding & Adaptation', () => {
  let tempDir: string;
  let testDbPath: string;
  let db: Database.Database;

  const sampleProfile: UserProfileInput = {
    height_cm: 175,
    weight_kg: 70,
    age: 22,
    sex: 'male',
    goal: 'gain_muscle',
    experience: 'beginner',
    days_per_week: 4,
    equipment: 'full_gym',
    dietary_type: 'veg',
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-test-phase3-'));
    testDbPath = path.join(tempDir, 'forma-p3.sqlite');
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

  it('calculates Mifflin-St Jeor BMR, maintenance, and calorie target accurately', () => {
    const plan = generateYourPlan(sampleProfile);
    // BMR for male 70kg, 175cm, 22yo: 10*70 + 6.25*175 - 5*22 + 5 = 700 + 1093.75 - 110 + 5 = 1688.75 -> 1689
    expect(plan.diet.bmr).toBe(1689);
    // 4 days/wk activity factor 1.55: 1689 * 1.55 = 2617.95 -> 2618
    expect(plan.diet.maintenance_calories).toBe(2618);
    // gain_muscle: +300 lean surplus -> 2918
    expect(plan.diet.calorie_target).toBe(2918);
    // protein target: 70 * 1.8 = 126g
    expect(plan.diet.protein_target_g).toBe(126);
  });

  it('strictly respects dietary restrictions: veg never contains chicken/eggs, eggetarian never contains chicken', () => {
    // Veg plan
    const vegItems = buildProteinPlan(130, 'veg');
    for (const item of vegItems) {
      const lower = (item.food_name + ' ' + item.food_id).toLowerCase();
      expect(lower).not.toContain('chicken');
      expect(lower).not.toContain('egg');
    }

    // Eggetarian plan
    const eggItems = buildProteinPlan(130, 'eggetarian');
    for (const item of eggItems) {
      const lower = (item.food_name + ' ' + item.food_id).toLowerCase();
      expect(lower).not.toContain('chicken');
      expect(lower).not.toContain('meat');
    }
    expect(eggItems.some((i) => i.food_name.toLowerCase().includes('egg'))).toBe(true);

    // Non-veg plan can contain chicken
    const nonVegItems = buildProteinPlan(130, 'non_veg');
    expect(nonVegItems.some((i) => i.food_name.toLowerCase().includes('chicken'))).toBe(true);
  });

  it('guarantees deterministic plan generation', () => {
    const plan1 = generateYourPlan(sampleProfile);
    const plan2 = generateYourPlan(sampleProfile);

    expect(plan1.diet.calorie_target).toBe(plan2.diet.calorie_target);
    expect(plan1.diet.protein_target_g).toBe(plan2.diet.protein_target_g);
    expect(plan1.workout.split_type).toBe(plan2.workout.split_type);
  });

  it('detects plan diffs on weight/schedule updates and returns empty array for identical plans', () => {
    const basePlan = generateYourPlan(sampleProfile);
    const identicalPlan = generateYourPlan(sampleProfile);

    // Identical diffs
    const noDiffs = diffPlans(basePlan, identicalPlan);
    expect(noDiffs).toEqual([]);

    // Updated weight and split (from 4 days Upper/Lower to 6 days PPL)
    const updatedProfile: UserProfileInput = {
      ...sampleProfile,
      weight_kg: 75,
      days_per_week: 6,
    };
    const nextPlan = generateYourPlan(updatedProfile);
    const diffs = diffPlans(basePlan, nextPlan);

    expect(diffs.length).toBeGreaterThanOrEqual(3);
    expect(diffs.some((d) => d.field === 'calorie_target')).toBe(true);
    expect(diffs.some((d) => d.field === 'protein_target_g')).toBe(true);
    expect(diffs.some((d) => d.field === 'split_type')).toBe(true);
  });

  it('resolves scheduled session, 1-missed roll-forward, and calm rest day message', () => {
    const plan = generateYourPlan(sampleProfile);

    // Normal scheduled day
    const session = resolveTodaysPlannedSession(plan, [], '2026-10-12'); // Monday
    expect(session.is_rest_day).toBe(false);
    expect(session.focus).toBeTruthy();

    // Rest day on Sunday (2026-10-18 is Sunday)
    const restDaySession = resolveTodaysPlannedSession(plan, [], '2026-10-18');
    expect(restDaySession.is_rest_day).toBe(true);
    expect(restDaySession.message.toLowerCase()).toContain('rest day');
  });

  it('evaluates 14-day flat bodyweight trend and suggests caloric adjustment', () => {
    // 14 days of stalled weight on muscle gain
    const entries = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-10-${(i + 1).toString().padStart(2, '0')}`,
      weight_kg: 70.0, // perfectly flat
    }));

    const result = evaluateWeightTrend(entries, 'gain_muscle');
    expect(result.suggestAdjustment).toBe(true);
    expect(result.suggestedCaloriesDelta).toBe(150);
    expect(result.reason.toLowerCase()).toContain('flat');
  });

  it('logs foods with snapshot calories/protein and computes daily totals accurately', () => {
    const foods = listFoods(db);
    expect(foods.length).toBeGreaterThanOrEqual(25);

    const paneer = foods.find((f) => f.id === 'paneer_curry') || foods[0];

    // Log lunch item
    const log1 = logFood(db, {
      date: '2026-10-16',
      meal_type: 'lunch',
      food_id: paneer.id,
      portion_quantity: 1.5,
    });

    expect(log1.id).toBeDefined();
    expect(log1.portion_quantity).toBe(1.5);
    expect(log1.calories).toBe(Math.round(paneer.estimated_calories * 1.5));

    // Get day summary
    const day = getDayDiet(db, '2026-10-16');
    expect(day.logs.length).toBe(1);
    expect(day.totals.calories).toBe(log1.calories);
    expect(day.totals.protein).toBe(log1.protein);
    expect(day.mealTotals.lunch.itemsCount).toBe(1);

    // Delete food log
    const deleted = deleteFoodLog(db, log1.id);
    expect(deleted).toBe(true);
    const dayAfter = getDayDiet(db, '2026-10-16');
    expect(dayAfter.logs.length).toBe(0);
    expect(dayAfter.totals.calories).toBe(0);
  });

  it('supports "Repeat yesterday\'s meal" copying previous day logs to today', () => {
    const foods = listFoods(db);
    const curd = foods.find((f) => f.id === 'curd_dahi') || foods[0];

    // Log lunch on 2026-10-15
    logFood(db, {
      date: '2026-10-15',
      meal_type: 'lunch',
      food_id: curd.id,
      portion_quantity: 2,
    });

    // Repeat yesterday's lunch on 2026-10-16
    const copiedCount = repeatYesterdayMeal(db, '2026-10-16', 'lunch');
    expect(copiedCount).toBe(1);

    const todayLunch = getDayDiet(db, '2026-10-16');
    expect(todayLunch.mealTotals.lunch.itemsCount).toBe(1);
    expect(todayLunch.logs[0].portion_quantity).toBe(2);
  });

  it('handles saved meal round-trip: save, list, log saved meal, and delete', () => {
    const foods = listFoods(db);
    const item1 = foods[0];
    const item2 = foods[1];

    const saved = saveMeal(db, 'Hostel Mess Power Lunch', 'lunch', [
      { food_id: item1.id, portion_quantity: 2 },
      { food_id: item2.id, portion_quantity: 1 },
    ]);

    expect(saved.id).toBeDefined();
    expect(saved.items.length).toBe(2);

    const allSaved = listSavedMeals(db);
    expect(allSaved.some((m) => m.id === saved.id)).toBe(true);

    // Log this saved meal to 2026-10-16 dinner
    const loggedCount = logSavedMeal(db, saved.id, '2026-10-16', 'dinner');
    expect(loggedCount).toBe(2);

    const day = getDayDiet(db, '2026-10-16');
    expect(day.mealTotals.dinner.itemsCount).toBe(2);

    // Delete saved meal
    const deleted = deleteSavedMeal(db, saved.id);
    expect(deleted).toBe(true);
    const afterDelete = listSavedMeals(db);
    expect(afterDelete.some((m) => m.id === saved.id)).toBe(false);
  });

  it('supports 1-tap quick protein tally', () => {
    const foods = listFoods(db);
    const egg = foods.find((f) => f.id === 'boiled_eggs') || foods[0];

    const logged = logQuickProtein(db, egg.id, '2026-10-16');
    expect(logged.meal_type).toBe('extra');
    expect(logged.food_id).toBe(egg.id);

    const day = getDayDiet(db, '2026-10-16');
    expect(day.mealTotals.extra.itemsCount).toBe(1);
  });

  it('tracks water logging (+250 ml) and undo', () => {
    const total1 = addWater(db, '2026-10-16', 250);
    expect(total1).toBe(250);

    const total2 = addWater(db, '2026-10-16', 250);
    expect(total2).toBe(500);

    const totalAfterUndo = undoLastWater(db, '2026-10-16');
    expect(totalAfterUndo).toBe(250);
  });

  it('upserts bodyweight logs without duplicate dates', () => {
    logWeight(db, '2026-10-16', 70.5);
    logWeight(db, '2026-10-16', 70.2); // same day revision

    const history = getWeightHistory(db, 10);
    const dateEntries = history.filter((h) => h.date === '2026-10-16');
    expect(dateEntries.length).toBe(1);
    expect(dateEntries[0].weight_kg).toBe(70.2);
  });

  it('preserves manual plan overrides while keeping base calculations intact', () => {
    const profile = saveProfile(db, sampleProfile);
    const plan = getPlan(db);
    expect(plan).toBeDefined();

    // User overrides calories to 3100 and protein to 150g
    const updated = setPlanOverrides(db, {
      calorie_target: 3100,
      protein_target_g: 150,
    });

    expect(updated.diet.effective_calorie_target).toBe(3100);
    expect(updated.diet.effective_protein_target_g).toBe(150);
    // Base formula target is preserved
    expect(updated.diet.calorie_target).toBe(2918);

    // Reset overrides to null
    const reset = setPlanOverrides(db, null);
    expect(reset.diet.effective_calorie_target).toBe(2918);
    expect(reset.diet.effective_protein_target_g).toBe(126);
  });

  it('keeps current plan unchanged when updating profile and sets planOutdated flag', () => {
    // 1. Initial save creates plan
    saveProfile(db, sampleProfile);
    const initialPlan = getPlan(db)!;
    expect(initialPlan.profile.weight_kg).toBe(70);

    // 2. Updating profile later does NOT automatically mutate active plan
    const updateResult = saveProfile(db, { ...sampleProfile, weight_kg: 74 });
    expect(updateResult.planOutdated).toBe(true);

    const activePlan = getPlan(db)!;
    expect(activePlan.profile.weight_kg).toBe(70); // Unchanged until user taps "Update my plan"

    // 3. Preview update shows diffs
    const preview = previewPlanUpdate(db);
    expect(preview.diffs.length).toBeGreaterThan(0);

    // 4. Accept update applies next plan
    acceptPlanUpdate(db, preview.nextPlan);
    const newActivePlan = getPlan(db)!;
    expect(newActivePlan.profile.weight_kg).toBe(74);
  });

  it('persists Mess Mode toggle in app_meta', () => {
    setMessMode(db, false);
    expect(getMessMode(db)).toBe(false);

    setMessMode(db, true);
    expect(getMessMode(db)).toBe(true);
  });

  it('supports logging unexpected/outside meals with custom properties and nutrition', () => {
    // 1. Create a custom outside food (e.g. Swiggy Chicken Shawarma)
    const shawarma = upsertFood(db, {
      name: 'Chicken Shawarma Roll (Outside)',
      category: 'Outside / Custom',
      dietary_type: 'non_veg',
      default_portion_unit: 'serving',
      portion_description: '1 standard roll',
      estimated_calories: 420,
      estimated_protein: 26,
      is_mess_item: false,
      assumption_note: 'Ordered from outside restaurant',
    });

    expect(shawarma.id).toMatch(/^custom_/);
    expect(shawarma.is_mess_item).toBe(false);

    // 2. Log 1.5 portions for dinner
    const logged = logFood(db, {
      date: '2026-10-16',
      meal_type: 'dinner',
      food_id: shawarma.id,
      portion_quantity: 1.5,
      portion_unit: 'serving',
    });

    expect(logged.calories).toBe(630); // 420 * 1.5
    expect(logged.protein).toBe(39); // 26 * 1.5

    // 3. Check day diet totals includes the outside meal
    const day = getDayDiet(db, '2026-10-16');
    expect(day.totals.calories).toBe(630);
    expect(day.totals.protein).toBe(39);
    expect(day.logs.length).toBe(1);
    expect(day.logs[0].food_name).toBe('Chicken Shawarma Roll (Outside)');
    expect(day.logs[0].is_mess_item).toBe(false);

    // 4. Verify custom food appears in food listing
    const allFoods = listFoods(db);
    const found = allFoods.find((f) => f.name === 'Chicken Shawarma Roll (Outside)');
    expect(found).toBeDefined();
  });

  it('supports updating custom weekly schedule (swapping days and rest days)', () => {
    saveProfile(db, sampleProfile);
    const planBefore = getPlan(db)!;
    expect(planBefore).toBeDefined();

    // Custom new schedule: Mon=Legs, Tue=Rest, Wed=Push, Thu=Pull, Fri=Rest, Sat=Full Body, Sun=Rest
    const customSchedule = [
      { day: 1, day_name: 'Monday', focus: 'Legs', is_rest: false },
      { day: 2, day_name: 'Tuesday', focus: 'Rest', is_rest: true },
      { day: 3, day_name: 'Wednesday', focus: 'Push', is_rest: false },
      { day: 4, day_name: 'Thursday', focus: 'Pull', is_rest: false },
      { day: 5, day_name: 'Friday', focus: 'Rest', is_rest: true },
      { day: 6, day_name: 'Saturday', focus: 'Full Body', is_rest: false },
      { day: 7, day_name: 'Sunday', focus: 'Rest', is_rest: true },
    ];

    const updatedPlan = updateSchedule(db, customSchedule);
    expect(updatedPlan.workout.weekly_schedule).toEqual(customSchedule);

    // Persists across fresh queries
    const freshPlan = getPlan(db)!;
    expect(freshPlan.workout.weekly_schedule[0].focus).toBe('Legs');
    expect(freshPlan.workout.weekly_schedule[1].is_rest).toBe(true);
    expect(freshPlan.workout.weekly_schedule[5].focus).toBe('Full Body');
  });

  it('adapts when a workout day is missed by detecting the gap and rolling forward or recommending deload', () => {
    const plan = generateYourPlan(sampleProfile);
    // Upper / Lower split:
    // Mon (2026-10-12): Upper
    // Tue (2026-10-13): Lower
    // Wed (2026-10-14): Rest
    // Thu (2026-10-15): Upper
    // Fri (2026-10-16): Lower

    // 1. User worked out Monday (Upper), but missed Tuesday (Lower). Today is Wednesday (Rest).
    const workoutsWithMissedTue = [
      { date: '2026-10-12', focus: 'Upper', status: 'completed' },
    ];

    const tuesdayFocus = plan.workout.weekly_schedule[1].focus;
    const adaptedWed = resolveTodaysPlannedSession(plan, workoutsWithMissedTue, '2026-10-14');
    expect(adaptedWed.adaptation).toBeDefined();
    expect(adaptedWed.adaptation?.has_missed_workout).toBe(true);
    expect(adaptedWed.adaptation?.missed_focus).toBe(tuesdayFocus);
    // On rest day, rolls forward the missed session
    expect(adaptedWed.focus).toBe(tuesdayFocus);
    expect(adaptedWed.is_rest_day).toBe(false);

    // 2. Long gap detection: last workout was 14 days ago
    const workoutsLongAgo = [
      { date: '2026-10-02', focus: 'Upper', status: 'completed' },
    ];
    const adaptedLongGap = resolveTodaysPlannedSession(plan, workoutsLongAgo, '2026-10-16');
    expect(adaptedLongGap.adaptation?.has_missed_workout).toBe(true);
    expect(adaptedLongGap.adaptation?.action).toBe('reacclimation');
    expect(adaptedLongGap.adaptation?.load_multiplier).toBe(0.7);
    expect(adaptedLongGap.adaptation?.volume_multiplier).toBe(0.6);
  });
});
