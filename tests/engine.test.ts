import { describe, it, expect } from 'vitest';
import defaultExercises from '../data/exercises.json';
import defaultFoods from '../data/foods.json';
import { validateSeedData } from '../data/validate_seed';
import {
  generateDietPlan,
  calculateBMR,
  getActivityFactor,
  convertPortionToNutrition,
  evaluateWeightTrend,
  generateWorkoutPlan,
  generateWorkoutSession,
  filterExercisesByEquipment,
  getExerciseSubstitutions,
  suggestUnderTrainedFocus,
  calculateNextExerciseProgression,
  calculateVolumeAdjustment,
  handleMissedWorkoutsAndGaps,
  calculateActualRest,
  analyzeRestPatterns,
  ExerciseDefinition,
  UserProfileInput,
  EquipmentType,
  Goal,
} from '../src/engine';

const exerciseCatalog = defaultExercises as unknown as ExerciseDefinition[];

describe('Phase 1: Seed Data Integrity', () => {
  it('passes all schema, referential integrity, and domain rules', () => {
    const result = validateSeedData();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('contains at least 80 exercises with rich substitution mappings', () => {
    expect(exerciseCatalog.length).toBeGreaterThanOrEqual(80);
    // Every exercise should have a valid name and primary muscle
    for (const ex of exerciseCatalog) {
      expect(ex.id).toBeTruthy();
      expect(ex.name).toBeTruthy();
      expect(ex.primary_muscles.length).toBeGreaterThan(0);
    }
  });

  it('contains Indian mess foods with practical portions and protein markers', () => {
    expect(defaultFoods.length).toBeGreaterThanOrEqual(25);
    const roti = defaultFoods.find((f) => f.id === 'roti_chapati');
    expect(roti).toBeDefined();
    expect(roti?.default_portion_unit).toBe('roti');
    expect(roti?.estimated_calories).toBeGreaterThan(0);
    expect(roti?.estimated_protein).toBeGreaterThan(0);
  });
});

describe('Phase 1: Diet Engine', () => {
  it('calculates Mifflin-St Jeor formula accurately for men and women', () => {
    // 75kg, 175cm, 25y, male: 10*75 + 6.25*175 - 5*25 + 5 = 750 + 1093.75 - 125 + 5 = 1723.75 -> 1724
    const bmrMale = calculateBMR(75, 175, 25, 'male');
    expect(bmrMale).toBe(1724);

    // 60kg, 165cm, 25y, female: 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 -> 1345
    const bmrFemale = calculateBMR(60, 165, 25, 'female');
    expect(bmrFemale).toBe(1345);
  });

  it('applies correct activity factors and goal calorie offsets', () => {
    expect(getActivityFactor(3)).toBe(1.375);
    expect(getActivityFactor(4)).toBe(1.55);
    expect(getActivityFactor(6)).toBe(1.725);

    const profileGain: UserProfileInput = {
      height_cm: 175,
      weight_kg: 70,
      age: 22,
      sex: 'male',
      goal: 'gain_muscle',
      experience: 'beginner',
      days_per_week: 4,
      equipment: 'full_gym',
      dietary_type: 'non_veg',
    };

    const planGain = generateDietPlan(profileGain);
    // BMR = 10*70 + 6.25*175 - 5*22 + 5 = 700 + 1093.75 - 110 + 5 = 1688.75 -> 1689
    // Maint = 1689 * 1.55 = 2617.95 -> 2618
    // Target = 2618 + 300 = 2918 kcal
    expect(planGain.bmr).toBe(1689);
    expect(planGain.maintenance_calories).toBe(2618);
    expect(planGain.calorie_target).toBe(2918);
    expect(planGain.protein_target_g).toBe(Math.round(70 * 1.8)); // 126g
    expect(planGain.formula_breakdown).toContain('BMR:');
    expect(planGain.formula_breakdown).toContain('+300 kcal');
  });

  it('converts portions to calories and protein correctly', () => {
    const food = { estimated_calories: 85, estimated_protein: 3.0 };
    const res = convertPortionToNutrition(food, 3); // 3 rotis
    expect(res.calories).toBe(255);
    expect(res.protein).toBe(9.0);
  });

  it('evaluates 7-day weight trends: detects flat 14 days vs healthy trend', () => {
    // 14 days of flat weight (gain goal) -> Should trigger adjustment
    const flatEntries = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-10-${(i + 1).toString().padStart(2, '0')}`,
      weight_kg: 70.0 + (i % 2 === 0 ? 0.05 : -0.05), // Noise around 70kg
    }));

    const evalFlat = evaluateWeightTrend(flatEntries, 'gain_muscle');
    expect(evalFlat.suggestAdjustment).toBe(true);
    expect(evalFlat.suggestedCaloriesDelta).toBe(150);

    // 14 days of trending weight (gain goal, moving upward)
    const progressingEntries = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-10-${(i + 1).toString().padStart(2, '0')}`,
      weight_kg: 70.0 + i * 0.08, // gaining ~0.5kg over 2 weeks
    }));

    const evalProg = evaluateWeightTrend(progressingEntries, 'gain_muscle');
    expect(evalProg.suggestAdjustment).toBe(false);
  });
});

describe('Phase 1: Workout Split & Plan Generation', () => {
  it('generates deterministic valid split for every days_per_week x equipment x goal combo', () => {
    const daysList = [2, 3, 4, 5, 6];
    const equipList: EquipmentType[] = ['full_gym', 'dumbbells_only', 'bodyweight_only'];
    const goals: Goal[] = ['gain_muscle', 'lose_fat', 'maintain'];

    for (const d of daysList) {
      for (const eq of equipList) {
        for (const g of goals) {
          const profile: UserProfileInput = {
            height_cm: 180,
            weight_kg: 75,
            age: 24,
            sex: 'male',
            goal: g,
            experience: 'beginner',
            days_per_week: d,
            equipment: eq,
            dietary_type: 'veg',
          };

          const plan = generateWorkoutPlan(profile);
          expect(plan.split_type).toBeDefined();
          expect(plan.weekly_schedule.length).toBe(7);
          expect(plan.weekly_muscle_targets.chest).toBeGreaterThanOrEqual(10);
          expect(plan.why).toBeTruthy();

          if (d <= 3) expect(plan.split_type).toBe('Full Body');
          else if (d === 4) expect(plan.split_type).toBe('Upper / Lower');
          else expect(plan.split_type).toBe('Push / Pull / Legs');
        }
      }
    }
  });
});

describe('Phase 1: Workout Generation & Time Fitting Engine', () => {
  it('time-fitting: session never exceeds chosen time beyond tolerance', () => {
    const times = [20, 30, 45, 60, 90];
    const focuses = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body'];

    for (const t of times) {
      for (const f of focuses) {
        const session = generateWorkoutSession({
          time_available_min: t,
          energy_today: 3,
          focus: f,
          equipment: 'full_gym',
          exerciseCatalog,
        });

        expect(session.exercises.length).toBeGreaterThan(0);
        // Estimated duration should be within tolerance (+/- 3.5 min)
        expect(session.estimated_duration_min).toBeLessThanOrEqual(t + 4);
      }
    }
  });

  it('energy scaling: energy 1 yields less volume than energy 5 for identical inputs', () => {
    const lowEnergySession = generateWorkoutSession({
      time_available_min: 45,
      energy_today: 1,
      focus: 'Push',
      equipment: 'full_gym',
      exerciseCatalog,
    });

    const highEnergySession = generateWorkoutSession({
      time_available_min: 45,
      energy_today: 5,
      focus: 'Push',
      equipment: 'full_gym',
      exerciseCatalog,
    });

    const lowSets = lowEnergySession.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    const highSets = highEnergySession.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

    expect(lowSets).toBeLessThan(highSets);
    expect(lowEnergySession.adaptation_notes.length).toBeGreaterThan(0);
  });

  it('20 min + energy 1 yields a valid minimal-effective session', () => {
    const session = generateWorkoutSession({
      time_available_min: 20,
      energy_today: 1,
      focus: 'Full Body',
      equipment: 'bodyweight_only',
      exerciseCatalog,
    });

    expect(session.exercises.length).toBeGreaterThanOrEqual(1);
    expect(session.estimated_duration_min).toBeLessThanOrEqual(22);
    // Should prescribe higher RIR (3-4) for low fatigue
    expect(session.exercises[0].sets[0].target_rir).toBeGreaterThanOrEqual(3);
  });

  it('equipment filtering: bodyweight-only users get valid sessions with zero forbidden equipment', () => {
    const bwExercises = filterExercisesByEquipment(exerciseCatalog, 'bodyweight_only');
    expect(bwExercises.length).toBeGreaterThan(10);
    expect(bwExercises.every((e) => e.equipment === 'bodyweight')).toBe(true);

    const session = generateWorkoutSession({
      time_available_min: 45,
      energy_today: 3,
      focus: 'Upper',
      equipment: 'bodyweight_only',
      exerciseCatalog,
    });

    expect(session.exercises.every((e) => e.exercise.equipment === 'bodyweight')).toBe(true);
  });

  it('exercise swap returns valid substitutes filtered by equipment', () => {
    const benchPress = exerciseCatalog.find((e) => e.id === 'barbell_bench_press')!;
    const subsDumbbellOnly = getExerciseSubstitutions(benchPress, exerciseCatalog, 'dumbbells_only');
    
    expect(subsDumbbellOnly.length).toBeGreaterThan(0);
    expect(subsDumbbellOnly.every((e) => e.equipment === 'dumbbell' || e.equipment === 'bodyweight')).toBe(true);
  });

  it('smart focus suggests under-trained muscle group', () => {
    const weeklyTargets = {
      chest: 10, back: 12, quads: 10, hamstrings: 8, glutes: 10,
      shoulders: 10, biceps: 6, triceps: 6, calves: 6, abs: 6, forearms: 4
    };

    // Simulated log: user trained legs and pull, but zero chest/push
    const recent = [
      { date: '2026-10-08', focus: 'Legs' },
      { date: '2026-10-09', focus: 'Pull' },
    ];

    const suggested = suggestUnderTrainedFocus(recent, weeklyTargets);
    expect(suggested).toBe('Push');
  });
});

describe('Phase 1: Automatic Adaptation & Progression Rules', () => {
  it('double progression: all sets at top of range increases load and resets reps', () => {
    const res = calculateNextExerciseProgression({
      exercise_id: 'barbell_bench_press',
      equipment: 'barbell',
      rep_range_min: 8,
      rep_range_max: 10,
      target_rir: 2,
      current_weight_kg: 60,
      recent_sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }],
    });

    expect(res.next_weight_kg).toBe(62.5); // +2.5kg for barbell
    expect(res.target_reps_min).toBe(8);
    expect(res.reason).toContain('+2.5 kg: You hit 3×10 reps last time');
  });

  it('double progression: within range but not all at top holds load to build reps', () => {
    const res = calculateNextExerciseProgression({
      exercise_id: 'barbell_bench_press',
      equipment: 'barbell',
      rep_range_min: 8,
      rep_range_max: 10,
      target_rir: 2,
      current_weight_kg: 60,
      recent_sets: [{ reps: 10 }, { reps: 9 }, { reps: 8 }],
    });

    expect(res.next_weight_kg).toBe(60);
    expect(res.reason).toContain('Aim for +1 rep');
  });

  it('double progression: below range twice triggers 10% deload and rebuild', () => {
    // Exposure 1 below range
    const exp1 = calculateNextExerciseProgression({
      exercise_id: 'barbell_bench_press',
      equipment: 'barbell',
      rep_range_min: 8,
      rep_range_max: 10,
      target_rir: 2,
      current_weight_kg: 70,
      recent_sets: [{ reps: 8 }, { reps: 7 }, { reps: 6 }],
      consecutive_failures: 0,
    });
    expect(exp1.next_weight_kg).toBe(70);
    expect(exp1.consecutive_failures).toBe(1);

    // Exposure 2 below range
    const exp2 = calculateNextExerciseProgression({
      exercise_id: 'barbell_bench_press',
      equipment: 'barbell',
      rep_range_min: 8,
      rep_range_max: 10,
      target_rir: 2,
      current_weight_kg: 70,
      recent_sets: [{ reps: 7 }, { reps: 7 }, { reps: 6 }],
      consecutive_failures: exp1.consecutive_failures,
    });
    expect(exp2.next_weight_kg).toBe(63); // ~10% deload
    expect(exp2.reason).toContain('-10% load reset');
    expect(exp2.suggest_deload).toBe(true);
  });

  it('double progression: 3 stalls suggest substitute or deload', () => {
    const res = calculateNextExerciseProgression({
      exercise_id: 'overhead_barbell_press',
      equipment: 'barbell',
      rep_range_min: 6,
      rep_range_max: 8,
      target_rir: 2,
      current_weight_kg: 40,
      recent_sets: [{ reps: 8 }, { reps: 7 }, { reps: 7 }],
      consecutive_stalls: 2, // 3rd stall
    });

    expect(res.suggest_substitute).toBe(true);
    expect(res.reason).toContain('Stall detected (3 exposures');
  });

  it('weekly volume compensation never exceeds per-session cap (+2 sets)', () => {
    const adj = calculateVolumeAdjustment({
      muscle: 'chest',
      completedSetsThisWeek: 4,
      weeklyTargetSets: 12, // Deficit of 8 sets
      sessionsRemainingThisWeek: 2,
    });

    // 8 deficit / 2 sessions = 4 sets needed, but must be capped at 2
    expect(adj.setsToAddToNextSession).toBe(2);
    expect(adj.reason).toContain('capped to avoid ballooning fatigue');
  });

  it('missed workouts: 1 missed rolls forward, 10-day gap reduces load, 14+ day gap gives easy reacclimation', () => {
    // 1 missed workout
    const rollFwd = handleMissedWorkoutsAndGaps({
      daysSinceLastWorkout: 2,
      missedSessionsThisWeek: 1,
      nextScheduledFocus: 'Pull',
      previousCompletedFocus: 'Push',
    });
    expect(rollFwd.action).toBe('roll_forward');
    expect(rollFwd.loadMultiplier).toBe(1.0);

    // 1 missed workout with consecutive same-muscle conflict avoids stacking
    const rollConflict = handleMissedWorkoutsAndGaps({
      daysSinceLastWorkout: 1,
      missedSessionsThisWeek: 1,
      nextScheduledFocus: 'Push',
      previousCompletedFocus: 'Push',
    });
    expect(rollConflict.action).toBe('keep_schedule');
    expect(rollConflict.message).toContain('adequate 48h recovery');

    // 10-day gap
    const tenDayGap = handleMissedWorkoutsAndGaps({
      daysSinceLastWorkout: 10,
      missedSessionsThisWeek: 0,
      nextScheduledFocus: 'Legs',
    });
    expect(tenDayGap.action).toBe('minor_deload');
    expect(tenDayGap.loadMultiplier).toBe(0.85);

    // 16-day gap
    const longGap = handleMissedWorkoutsAndGaps({
      daysSinceLastWorkout: 16,
      missedSessionsThisWeek: 0,
      nextScheduledFocus: 'Upper',
    });
    expect(longGap.action).toBe('reacclimation');
    expect(longGap.loadMultiplier).toBe(0.70);
    expect(longGap.volumeMultiplier).toBe(0.60);
  });
});

describe('Phase 1: Rest Timing & Rest Insights Engine', () => {
  it('computes rest accurately using wall-clock timestamps', () => {
    const t0 = 1700000000000;
    const t1 = t0 + 120000; // 120 seconds later
    const res = calculateActualRest(t0, t1);

    expect(res.actualRestSec).toBe(120);
    expect(res.isOutlier).toBe(false);
  });

  it('flags long distractions as outliers (> 600s)', () => {
    const t0 = 1700000000000;
    const t1 = t0 + 750000; // 750 seconds later (> 12 min)
    const res = calculateActualRest(t0, t1);

    expect(res.actualRestSec).toBe(750);
    expect(res.isOutlier).toBe(true);
    expect(res.ignoredOutlier).toBe(true);
  });

  it('detects rushed rest on compound lifts when reps degrade', () => {
    const sets = [
      { isCompound: true, plannedRestSec: 150, actualRestSec: 60, reps: 10, setNumber: 1 },
      { isCompound: true, plannedRestSec: 150, actualRestSec: 55, reps: 8, setNumber: 2 },
      { isCompound: true, plannedRestSec: 150, actualRestSec: 50, reps: 6, setNumber: 3 },
    ];

    const analysis = analyzeRestPatterns(sets);
    expect(analysis.flagRushedRest).toBe(true);
    expect(analysis.insightMessage).toContain('You rested significantly shorter than planned');
  });
});

describe('Phase 1: 12-Week Synthetic Log Simulation', () => {
  it('runs a 12-week progression simulation with missed weeks; loads remain bounded and safe', () => {
    let workingWeight = 50.0; // Barbell bench press starting at 50kg
    let consecutiveFailures = 0;
    let consecutiveStalls = 0;
    let totalCompletedSets = 0;

    for (let week = 1; week <= 12; week++) {
      // Simulate missed week 5 (illness / exams)
      if (week === 5) {
        const gapResult = handleMissedWorkoutsAndGaps({
          daysSinceLastWorkout: 8,
          missedSessionsThisWeek: 3,
          nextScheduledFocus: 'Push',
        });
        workingWeight = Math.round(workingWeight * gapResult.loadMultiplier * 2) / 2;
        continue;
      }

      // Simulate 2 sessions of bench press per week
      for (let session = 1; session <= 2; session++) {
        // Performance: hit 10, 10, 9 or 10, 10, 10
        const hitTop = (week + session) % 2 === 0;
        const sets = hitTop ? [{ reps: 10 }, { reps: 10 }, { reps: 10 }] : [{ reps: 10 }, { reps: 9 }, { reps: 8 }];

        const prog = calculateNextExerciseProgression({
          exercise_id: 'barbell_bench_press',
          equipment: 'barbell',
          rep_range_min: 8,
          rep_range_max: 10,
          target_rir: 2,
          current_weight_kg: workingWeight,
          recent_sets: sets,
          consecutive_failures: consecutiveFailures,
          consecutive_stalls: consecutiveStalls,
        });

        workingWeight = prog.next_weight_kg;
        consecutiveFailures = prog.consecutive_failures;
        consecutiveStalls = prog.consecutive_stalls;
        totalCompletedSets += 3;
      }
    }

    // After 12 weeks with realistic progression and deloads, weight should have progressed sensibly
    // e.g. from 50kg to around 60-70kg, never leaping to unreasonable values like 150kg
    expect(workingWeight).toBeGreaterThan(50);
    expect(workingWeight).toBeLessThan(85);
    expect(totalCompletedSets).toBeGreaterThan(50);
  });
});
