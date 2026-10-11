import type { UserProfileInput, DietPlan, FoodDefinition } from './types';

/**
 * Calculates BMR using the Mifflin-St Jeor Equation.
 * Men: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age + 5
 * Women: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 161
 */
export function calculateBMR(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? Math.round(base + 5) : Math.round(base - 161);
}

/**
 * Resolves activity factor based on planned training days per week.
 */
export function getActivityFactor(daysPerWeek: number): number {
  if (daysPerWeek <= 3) return 1.375; // Lightly active (1-3 days exercise)
  if (daysPerWeek <= 5) return 1.55;  // Moderately active (3-5 days exercise)
  return 1.725;                      // Very active (6-7 days heavy exercise)
}

/**
 * Generates science-based daily calorie and protein targets with full formula breakdown.
 */
export function generateDietPlan(profile: UserProfileInput, foodCatalog?: FoodDefinition[]): DietPlan {
  const { weight_kg, height_cm, age, sex, goal, days_per_week, dietary_type } = profile;

  const bmr = calculateBMR(weight_kg, height_cm, age, sex);
  const activityFactor = getActivityFactor(days_per_week);
  const maintenanceCalories = Math.round(bmr * activityFactor);

  let calorieAdjustment = 0;
  let weeklyWeightChangeKg = 0;
  let goalExplanation = '';

  if (goal === 'gain_muscle') {
    calorieAdjustment = 300; // Controlled lean surplus
    weeklyWeightChangeKg = 0.25;
    goalExplanation = '+300 kcal lean surplus (~0.25 kg/week gain without excess fat)';
  } else if (goal === 'lose_fat') {
    calorieAdjustment = -450; // Moderate sustainable deficit
    weeklyWeightChangeKg = -0.45;
    goalExplanation = '-450 kcal deficit (~0.45 kg/week sustainable fat loss)';
  } else {
    calorieAdjustment = 0;
    weeklyWeightChangeKg = 0.0;
    goalExplanation = '0 kcal offset (body recomposition & weight maintenance)';
  }

  const calorieTarget = Math.max(1200, maintenanceCalories + calorieAdjustment);

  // Protein targets: 1.8g/kg for gain/maintain, 2.0g/kg for fat loss to preserve lean muscle
  const proteinMultiplier = goal === 'lose_fat' ? 2.0 : 1.8;
  const proteinTargetG = Math.round(weight_kg * proteinMultiplier);

  const formulaBreakdown =
    `BMR: 10×${weight_kg}kg + 6.25×${height_cm}cm - 5×${age}y ${sex === 'male' ? '+ 5' : '- 161'} = ${bmr} kcal. ` +
    `Maintenance: ${bmr} × ${activityFactor} (activity for ${days_per_week} days/wk) = ${maintenanceCalories} kcal. ` +
    `Target: ${maintenanceCalories} ${calorieAdjustment >= 0 ? '+' : ''}${calorieAdjustment} = ${calorieTarget} kcal (${goalExplanation}). ` +
    `Protein: ${weight_kg}kg × ${proteinMultiplier}g/kg = ${proteinTargetG}g.`;

  const mealLevelGuidance = generateMealGuidance(proteinTargetG, dietary_type, foodCatalog);

  return {
    bmr,
    maintenance_calories: maintenanceCalories,
    calorie_target: calorieTarget,
    protein_target_g: proteinTargetG,
    weekly_weight_change_kg: weeklyWeightChangeKg,
    formula_breakdown: formulaBreakdown,
    meal_level_guidance: mealLevelGuidance,
  };
}

/**
 * Translates the daily protein target into practical meal portions (eggs, chicken, milk, paneer, whey).
 */
export function generateMealGuidance(
  proteinTargetG: number,
  dietaryType: 'veg' | 'non_veg' | 'eggetarian',
  foodCatalog?: FoodDefinition[]
): string[] {
  const guidance: string[] = [];

  if (dietaryType === 'non_veg') {
    guidance.push(`Target ≈ ${proteinTargetG}g protein across meals:`);
    guidance.push(`• 1 mess serving chicken curry (3 pieces) ≈ 24g protein`);
    guidance.push(`• 2 boiled eggs / egg bhurji plate ≈ 13g protein`);
    guidance.push(`• 1 glass toned milk (250ml) ≈ 8g protein`);
    guidance.push(`• 1 katori dal or rajma / chole ≈ 7g protein`);
    guidance.push(`• Optional 1 scoop whey powder in water ≈ 24g protein`);
  } else if (dietaryType === 'eggetarian') {
    guidance.push(`Target ≈ ${proteinTargetG}g protein across meals:`);
    guidance.push(`• 3-4 whole boiled eggs / egg bhurji across the day ≈ 20-25g protein`);
    guidance.push(`• 1 katori paneer curry or raw paneer cubes ≈ 12-18g protein`);
    guidance.push(`• 1 glass toned milk (250ml) ≈ 8g protein`);
    guidance.push(`• 1 katori thick dal or chole/sprouts ≈ 7-8g protein`);
    guidance.push(`• 1 scoop whey protein ≈ 24g protein`);
  } else {
    // Pure veg
    guidance.push(`Target ≈ ${proteinTargetG}g protein across meals:`);
    guidance.push(`• 1 katori paneer curry (or 100g fresh paneer) ≈ 12-18g protein`);
    guidance.push(`• 1 katori soya chunks curry (high protein) ≈ 15g protein`);
    guidance.push(`• 1-2 glasses toned milk / curd bowl ≈ 13-16g protein`);
    guidance.push(`• 2 katoris dal / rajma / sattu drink across meals ≈ 15-20g protein`);
    guidance.push(`• 1 scoop whey protein (or plant protein) ≈ 24g protein`);
  }

  return guidance;
}

/**
 * Converts practical portion logging into estimated calories and protein.
 */
export function convertPortionToNutrition(
  food: { estimated_calories: number; estimated_protein: number },
  quantity: number
): { calories: number; protein: number } {
  const calories = Math.round(food.estimated_calories * quantity);
  const protein = Math.round(food.estimated_protein * quantity * 10) / 10;
  return { calories, protein };
}

/**
 * Evaluates 7-day rolling weight average trend.
 * If weight has stalled (< 0.1 kg movement toward goal) over 14 consecutive days of logging,
 * returns a suggested caloric adjustment.
 */
export function evaluateWeightTrend(
  weightEntries: Array<{ date: string; weight_kg: number }>,
  goal: 'gain_muscle' | 'lose_fat' | 'maintain'
): {
  sevenDayAverage: number | null;
  trendSlopeKgPerWeek: number | null;
  suggestAdjustment: boolean;
  suggestedCaloriesDelta: number;
  reason: string;
} {
  if (weightEntries.length < 7) {
    return {
      sevenDayAverage: weightEntries.length > 0
        ? Math.round((weightEntries.reduce((acc, e) => acc + e.weight_kg, 0) / weightEntries.length) * 10) / 10
        : null,
      trendSlopeKgPerWeek: null,
      suggestAdjustment: false,
      suggestedCaloriesDelta: 0,
      reason: 'Need at least 7 days of logs to establish a reliable average trend.',
    };
  }

  // Sort by date ascending
  const sorted = [...weightEntries].sort((a, b) => a.date.localeCompare(b.date));

  // Current 7-day average (most recent 7 days)
  const recent7 = sorted.slice(-7);
  const currentAvg = recent7.reduce((sum, e) => sum + e.weight_kg, 0) / 7;

  if (sorted.length < 14) {
    return {
      sevenDayAverage: Math.round(currentAvg * 10) / 10,
      trendSlopeKgPerWeek: null,
      suggestAdjustment: false,
      suggestedCaloriesDelta: 0,
      reason: '7-day trend active. 14 days of data required before suggesting automatic dietary adjustments.',
    };
  }

  // Baseline 7-day average from 7 days prior (days -14 to -7)
  const previous7 = sorted.slice(-14, -7);
  const prevAvg = previous7.reduce((sum, e) => sum + e.weight_kg, 0) / 7;

  const deltaKg = currentAvg - prevAvg;
  const trendSlopeKgPerWeek = Math.round(deltaKg * 100) / 100;

  if (goal === 'gain_muscle') {
    // Should be gaining ~0.15 - 0.35 kg/week
    if (deltaKg < 0.1) {
      return {
        sevenDayAverage: Math.round(currentAvg * 10) / 10,
        trendSlopeKgPerWeek,
        suggestAdjustment: true,
        suggestedCaloriesDelta: 150,
        reason: '7-day average weight is flat over the last 2 weeks. Suggesting a small +150 kcal bump to stimulate muscle growth.',
      };
    }
  } else if (goal === 'lose_fat') {
    // Should be losing ~0.3 - 0.6 kg/week
    if (deltaKg > -0.1) {
      return {
        sevenDayAverage: Math.round(currentAvg * 10) / 10,
        trendSlopeKgPerWeek,
        suggestAdjustment: true,
        suggestedCaloriesDelta: -150,
        reason: '7-day average weight has not moved downwards over the last 2 weeks. Suggesting a modest -150 kcal adjustment.',
      };
    }
  }

  return {
    sevenDayAverage: Math.round(currentAvg * 10) / 10,
    trendSlopeKgPerWeek,
    suggestAdjustment: false,
    suggestedCaloriesDelta: 0,
    reason: 'Weight trend is on track toward your target.',
  };
}
