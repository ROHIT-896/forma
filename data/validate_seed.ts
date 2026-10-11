import fs from 'fs';
import path from 'path';

interface Exercise {
  id: string;
  name: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight';
  movement_pattern: string;
  compound_or_isolation: 'compound' | 'isolation';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  beginner_safe: boolean;
  short_form_cue: string;
  substitution_ids: string[];
}

interface Food {
  id: string;
  name: string;
  category: string;
  dietary_type: 'veg' | 'non-veg' | 'eggetarian';
  default_portion_unit: string;
  portion_description: string;
  estimated_calories: number;
  estimated_protein: number;
  is_mess_item: boolean;
  mess_serving_definition: string;
  assumption_note: string;
  quick_protein_chip: boolean;
}

const VALID_MUSCLES = new Set([
  'chest', 'back', 'quads', 'hamstrings', 'glutes',
  'shoulders', 'biceps', 'triceps', 'calves', 'abs', 'forearms'
]);

const VALID_EQUIPMENT = new Set(['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight']);
const VALID_DIETARY_TYPES = new Set(['veg', 'non-veg', 'eggetarian']);
const VALID_UNITS = new Set(['roti', 'katori', 'bowl', 'piece', 'glass', 'spoon', 'scoop']);

export function validateSeedData(baseDir = __dirname): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const exercisesPath = path.join(baseDir, 'exercises.json');
  const foodsPath = path.join(baseDir, 'foods.json');

  if (!fs.existsSync(exercisesPath)) {
    errors.push(`Missing exercises.json at ${exercisesPath}`);
    return { valid: false, errors };
  }
  if (!fs.existsSync(foodsPath)) {
    errors.push(`Missing foods.json at ${foodsPath}`);
    return { valid: false, errors };
  }

  const exercises: Exercise[] = JSON.parse(fs.readFileSync(exercisesPath, 'utf-8'));
  const foods: Food[] = JSON.parse(fs.readFileSync(foodsPath, 'utf-8'));

  // 1. Validate Exercises
  if (exercises.length < 80) {
    errors.push(`Expected >= 80 exercises, found ${exercises.length}`);
  }

  const exerciseIds = new Set<string>();
  for (const ex of exercises) {
    if (!ex.id || typeof ex.id !== 'string') {
      errors.push(`Exercise missing valid id: ${JSON.stringify(ex)}`);
      continue;
    }
    if (exerciseIds.has(ex.id)) {
      errors.push(`Duplicate exercise id found: ${ex.id}`);
    }
    exerciseIds.add(ex.id);

    if (!ex.name || ex.name.trim().length === 0) {
      errors.push(`Exercise ${ex.id} missing name`);
    }

    if (!VALID_EQUIPMENT.has(ex.equipment)) {
      errors.push(`Exercise ${ex.id} has invalid equipment: ${ex.equipment}`);
    }

    if (!Array.isArray(ex.primary_muscles) || ex.primary_muscles.length === 0) {
      errors.push(`Exercise ${ex.id} must have at least one primary muscle`);
    } else {
      for (const m of ex.primary_muscles) {
        if (!VALID_MUSCLES.has(m)) {
          errors.push(`Exercise ${ex.id} has invalid primary muscle: ${m}`);
        }
      }
    }

    for (const m of ex.secondary_muscles) {
      if (!VALID_MUSCLES.has(m)) {
        errors.push(`Exercise ${ex.id} has invalid secondary muscle: ${m}`);
      }
    }

    if (ex.compound_or_isolation !== 'compound' && ex.compound_or_isolation !== 'isolation') {
      errors.push(`Exercise ${ex.id} has invalid compound_or_isolation: ${ex.compound_or_isolation}`);
    }

    if (typeof ex.beginner_safe !== 'boolean') {
      errors.push(`Exercise ${ex.id} beginner_safe must be boolean`);
    }

    if (!ex.short_form_cue || ex.short_form_cue.trim().length === 0) {
      errors.push(`Exercise ${ex.id} missing short form cue`);
    }
  }

  // Check substitution referential integrity
  for (const ex of exercises) {
    for (const subId of ex.substitution_ids) {
      if (subId === ex.id) {
        errors.push(`Exercise ${ex.id} cannot list itself as a substitution`);
      }
      if (!exerciseIds.has(subId)) {
        errors.push(`Exercise ${ex.id} has non-existent substitution id: ${subId}`);
      }
    }
  }

  // 2. Validate Foods
  if (foods.length < 20) {
    errors.push(`Expected >= 20 food items, found ${foods.length}`);
  }

  const foodIds = new Set<string>();
  for (const food of foods) {
    if (!food.id || typeof food.id !== 'string') {
      errors.push(`Food missing valid id: ${JSON.stringify(food)}`);
      continue;
    }
    if (foodIds.has(food.id)) {
      errors.push(`Duplicate food id: ${food.id}`);
    }
    foodIds.add(food.id);

    if (!VALID_DIETARY_TYPES.has(food.dietary_type)) {
      errors.push(`Food ${food.id} has invalid dietary_type: ${food.dietary_type}`);
    }

    if (!VALID_UNITS.has(food.default_portion_unit)) {
      errors.push(`Food ${food.id} has invalid portion unit: ${food.default_portion_unit}`);
    }

    if (typeof food.estimated_calories !== 'number' || food.estimated_calories <= 0) {
      errors.push(`Food ${food.id} estimated_calories must be > 0`);
    }

    if (typeof food.estimated_protein !== 'number' || food.estimated_protein < 0) {
      errors.push(`Food ${food.id} estimated_protein must be >= 0`);
    }

    if (!food.portion_description || food.portion_description.trim().length === 0) {
      errors.push(`Food ${food.id} missing portion_description`);
    }

    if (!food.assumption_note || food.assumption_note.trim().length === 0) {
      errors.push(`Food ${food.id} missing assumption_note`);
    }
  }

  // Ensure key staples exist
  const requiredStapleIds = ['roti_chapati', 'steamed_white_rice', 'yellow_dal_tadka', 'chicken_curry_mess', 'egg_boiled_whole', 'paneer_curry_mess', 'milk_toned', 'whey_protein_scoop'];
  for (const req of requiredStapleIds) {
    if (!foodIds.has(req)) {
      errors.push(`Essential staple food missing from DB: ${req}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

if (require.main === module) {
  const result = validateSeedData();
  if (result.valid) {
    console.log('✅ Seed data validation passed successfully! All exercises and foods are valid.');
    process.exit(0);
  } else {
    console.error(`❌ Seed data validation failed with ${result.errors.length} errors:`);
    result.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}
