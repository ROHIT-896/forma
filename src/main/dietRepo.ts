import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { FoodDefinition, MealType, Goal } from '../engine/types';
import { evaluateWeightTrend, convertPortionToNutrition } from '../engine/diet';

export interface FoodLogRow {
  id: string;
  date: string;
  meal_type: MealType;
  food_id: string;
  food_name: string;
  portion_quantity: number;
  portion_unit: string;
  calories: number;
  protein: number;
  logged_at: string;
  is_mess_item: boolean;
  mess_serving_definition?: string;
  assumption_note?: string;
}

export interface DayDietSummary {
  date: string;
  logs: FoodLogRow[];
  totals: {
    calories: number;
    protein: number;
  };
  mealTotals: Record<MealType, { calories: number; protein: number; itemsCount: number }>;
  water_ml: number;
}

export interface SavedMeal {
  id: string;
  name: string;
  meal_type: string;
  created_at: string;
  items: Array<{
    id: string;
    food_id: string;
    food_name: string;
    portion_quantity: number;
    portion_unit: string;
    calories: number;
    protein: number;
  }>;
}

export function listFoods(db: Database.Database): FoodDefinition[] {
  const rows = db.prepare('SELECT * FROM foods ORDER BY name ASC').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    dietary_type: r.dietary_type,
    default_portion_unit: r.default_portion_unit,
    portion_description: r.portion_description,
    estimated_calories: r.estimated_calories,
    estimated_protein: r.estimated_protein,
    is_mess_item: Boolean(r.is_mess_item),
    mess_serving_definition: r.mess_serving_definition,
    assumption_note: r.assumption_note,
    quick_protein_chip: Boolean(r.quick_protein_chip),
  }));
}

export function upsertFood(
  db: Database.Database,
  food: Partial<FoodDefinition> & { name: string; estimated_calories: number; estimated_protein: number }
): FoodDefinition {
  const id = food.id || `custom_${randomUUID()}`;
  const isCustom = id.startsWith('custom_') ? 1 : 0;

  const existing = db.prepare('SELECT id FROM foods WHERE id = ?').get(id);

  if (existing) {
    db.prepare(`
      UPDATE foods
      SET name = ?, category = ?, dietary_type = ?, default_portion_unit = ?,
          portion_description = ?, estimated_calories = ?, estimated_protein = ?,
          is_mess_item = ?, mess_serving_definition = ?, assumption_note = ?,
          quick_protein_chip = ?
      WHERE id = ?
    `).run(
      food.name,
      food.category || 'Custom',
      food.dietary_type || 'veg',
      food.default_portion_unit || 'bowl',
      food.portion_description || '1 serving',
      food.estimated_calories,
      food.estimated_protein,
      food.is_mess_item ? 1 : 0,
      food.mess_serving_definition || '',
      food.assumption_note || '',
      food.quick_protein_chip ? 1 : 0,
      id
    );
  } else {
    db.prepare(`
      INSERT INTO foods (
        id, name, category, dietary_type, default_portion_unit, portion_description,
        estimated_calories, estimated_protein, is_mess_item, mess_serving_definition,
        assumption_note, quick_protein_chip, is_custom
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      food.name,
      food.category || 'Custom',
      food.dietary_type || 'veg',
      food.default_portion_unit || 'bowl',
      food.portion_description || '1 serving',
      food.estimated_calories,
      food.estimated_protein,
      food.is_mess_item ? 1 : 0,
      food.mess_serving_definition || '',
      food.assumption_note || '',
      food.quick_protein_chip ? 1 : 0,
      isCustom
    );
  }

  const row = db.prepare('SELECT * FROM foods WHERE id = ?').get(id) as any;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    dietary_type: row.dietary_type,
    default_portion_unit: row.default_portion_unit,
    portion_description: row.portion_description,
    estimated_calories: row.estimated_calories,
    estimated_protein: row.estimated_protein,
    is_mess_item: Boolean(row.is_mess_item),
    mess_serving_definition: row.mess_serving_definition,
    assumption_note: row.assumption_note,
    quick_protein_chip: Boolean(row.quick_protein_chip),
  };
}

export function logFood(
  db: Database.Database,
  entry: {
    date: string;
    meal_type: MealType;
    food_id: string;
    portion_quantity: number;
    portion_unit?: string;
  }
): FoodLogRow {
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(entry.food_id) as any;
  if (!food) {
    throw new Error(`Food not found with id: ${entry.food_id}`);
  }

  const unit = entry.portion_unit || food.default_portion_unit;
  const { calories, protein } = convertPortionToNutrition(food, entry.portion_quantity);
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO food_logs (
      id, date, meal_type, food_id, portion_quantity, portion_unit,
      calories, protein, logged_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    entry.date,
    entry.meal_type,
    entry.food_id,
    entry.portion_quantity,
    unit,
    calories,
    protein,
    now
  );

  return {
    id,
    date: entry.date,
    meal_type: entry.meal_type,
    food_id: entry.food_id,
    food_name: food.name,
    portion_quantity: entry.portion_quantity,
    portion_unit: unit,
    calories,
    protein,
    logged_at: now,
    is_mess_item: Boolean(food.is_mess_item),
    mess_serving_definition: food.mess_serving_definition,
    assumption_note: food.assumption_note,
  };
}

export function deleteFoodLog(db: Database.Database, id: string): boolean {
  const info = db.prepare('DELETE FROM food_logs WHERE id = ?').run(id);
  return info.changes > 0;
}

export function getDayDiet(db: Database.Database, dateStr: string): DayDietSummary {
  const rows = db
    .prepare(`
      SELECT fl.*, f.name as food_name, f.is_mess_item, f.mess_serving_definition, f.assumption_note
      FROM food_logs fl
      JOIN foods f ON fl.food_id = f.id
      WHERE fl.date = ?
      ORDER BY fl.logged_at ASC
    `)
    .all(dateStr) as any[];

  let totalCalories = 0;
  let totalProtein = 0;

  const mealTotals: Record<MealType, { calories: number; protein: number; itemsCount: number }> = {
    breakfast: { calories: 0, protein: 0, itemsCount: 0 },
    lunch: { calories: 0, protein: 0, itemsCount: 0 },
    snacks: { calories: 0, protein: 0, itemsCount: 0 },
    dinner: { calories: 0, protein: 0, itemsCount: 0 },
    extra: { calories: 0, protein: 0, itemsCount: 0 },
  };

  const logs: FoodLogRow[] = rows.map((r) => {
    totalCalories += r.calories;
    totalProtein += r.protein;

    const m = r.meal_type as MealType;
    if (mealTotals[m]) {
      mealTotals[m].calories += r.calories;
      mealTotals[m].protein += r.protein;
      mealTotals[m].itemsCount += 1;
    }

    return {
      id: r.id,
      date: r.date,
      meal_type: r.meal_type,
      food_id: r.food_id,
      food_name: r.food_name,
      portion_quantity: r.portion_quantity,
      portion_unit: r.portion_unit,
      calories: r.calories,
      protein: r.protein,
      logged_at: r.logged_at,
      is_mess_item: Boolean(r.is_mess_item),
      mess_serving_definition: r.mess_serving_definition,
      assumption_note: r.assumption_note,
    };
  });

  // Water logs sum
  const waterRow = db
    .prepare('SELECT SUM(amount_ml) as total_ml FROM water_logs WHERE date = ?')
    .get(dateStr) as { total_ml: number | null };

  return {
    date: dateStr,
    logs,
    totals: {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein * 10) / 10,
    },
    mealTotals,
    water_ml: waterRow?.total_ml ?? 0,
  };
}

export function repeatYesterdayMeal(
  db: Database.Database,
  dateStr: string,
  mealType: MealType
): number {
  const dateObj = new Date(dateStr);
  dateObj.setDate(dateObj.getDate() - 1);
  const yesterdayStr = dateObj.toISOString().slice(0, 10);

  const prevLogs = db
    .prepare('SELECT * FROM food_logs WHERE date = ? AND meal_type = ?')
    .all(yesterdayStr, mealType) as any[];

  if (prevLogs.length === 0) return 0;

  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO food_logs (
      id, date, meal_type, food_id, portion_quantity, portion_unit,
      calories, protein, logged_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const copyTx = db.transaction(() => {
    for (const log of prevLogs) {
      insertStmt.run(
        randomUUID(),
        dateStr,
        mealType,
        log.food_id,
        log.portion_quantity,
        log.portion_unit,
        log.calories,
        log.protein,
        now
      );
    }
  });

  copyTx();
  return prevLogs.length;
}

export function saveMeal(
  db: Database.Database,
  name: string,
  mealType: string,
  items: Array<{
    food_id: string;
    portion_quantity: number;
    portion_unit?: string;
  }>
): SavedMeal {
  const mealId = randomUUID();
  const now = new Date().toISOString();

  const insertMeal = db.prepare(
    'INSERT INTO saved_meals (id, name, meal_type, created_at) VALUES (?, ?, ?, ?)'
  );
  const insertItem = db.prepare(`
    INSERT INTO saved_meal_items (
      id, saved_meal_id, food_id, portion_quantity, portion_unit, calories, protein
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const savedItems: SavedMeal['items'] = [];

  const tx = db.transaction(() => {
    insertMeal.run(mealId, name, mealType, now);
    for (const item of items) {
      const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(item.food_id) as any;
      if (!food) continue;
      const unit = item.portion_unit || food.default_portion_unit;
      const { calories, protein } = convertPortionToNutrition(food, item.portion_quantity);
      const itemId = randomUUID();
      insertItem.run(itemId, mealId, item.food_id, item.portion_quantity, unit, calories, protein);
      savedItems.push({
        id: itemId,
        food_id: item.food_id,
        food_name: food.name,
        portion_quantity: item.portion_quantity,
        portion_unit: unit,
        calories,
        protein,
      });
    }
  });

  tx();
  return {
    id: mealId,
    name,
    meal_type: mealType,
    created_at: now,
    items: savedItems,
  };
}

export function listSavedMeals(db: Database.Database): SavedMeal[] {
  const meals = db.prepare('SELECT * FROM saved_meals ORDER BY created_at DESC').all() as any[];
  const itemStmt = db.prepare(`
    SELECT smi.*, f.name as food_name
    FROM saved_meal_items smi
    JOIN foods f ON smi.food_id = f.id
    WHERE smi.saved_meal_id = ?
  `);

  return meals.map((m) => {
    const items = itemStmt.all(m.id) as any[];
    return {
      id: m.id,
      name: m.name,
      meal_type: m.meal_type,
      created_at: m.created_at,
      items: items.map((i) => ({
        id: i.id,
        food_id: i.food_id,
        food_name: i.food_name,
        portion_quantity: i.portion_quantity,
        portion_unit: i.portion_unit,
        calories: i.calories,
        protein: i.protein,
      })),
    };
  });
}

export function logSavedMeal(
  db: Database.Database,
  savedMealId: string,
  dateStr: string,
  mealType: MealType
): number {
  const meal = db.prepare('SELECT * FROM saved_meals WHERE id = ?').get(savedMealId) as any;
  if (!meal) return 0;

  const items = db
    .prepare('SELECT * FROM saved_meal_items WHERE saved_meal_id = ?')
    .all(savedMealId) as any[];

  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO food_logs (
      id, date, meal_type, food_id, portion_quantity, portion_unit,
      calories, protein, logged_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const item of items) {
      insertStmt.run(
        randomUUID(),
        dateStr,
        mealType,
        item.food_id,
        item.portion_quantity,
        item.portion_unit,
        item.calories,
        item.protein,
        now
      );
    }
  });

  tx();
  return items.length;
}

export function deleteSavedMeal(db: Database.Database, savedMealId: string): boolean {
  const info = db.prepare('DELETE FROM saved_meals WHERE id = ?').run(savedMealId);
  return info.changes > 0;
}

export function logQuickProtein(
  db: Database.Database,
  foodId: string,
  dateStr: string,
  isMessMode = false
): FoodLogRow {
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId) as any;
  if (!food) {
    throw new Error(`Food not found with id: ${foodId}`);
  }

  const quantity = 1;
  return logFood(db, {
    date: dateStr,
    meal_type: 'extra',
    food_id: foodId,
    portion_quantity: quantity,
    portion_unit: food.default_portion_unit,
  });
}

export function addWater(db: Database.Database, dateStr: string, amountMl = 250): number {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO water_logs (id, date, amount_ml, logged_at)
    VALUES (?, ?, ?, ?)
  `).run(id, dateStr, amountMl, now);

  const row = db
    .prepare('SELECT SUM(amount_ml) as total FROM water_logs WHERE date = ?')
    .get(dateStr) as { total: number };
  return row.total || 0;
}

export function undoLastWater(db: Database.Database, dateStr: string): number {
  const last = db
    .prepare('SELECT id FROM water_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1')
    .get(dateStr) as { id: string } | undefined;

  if (last) {
    db.prepare('DELETE FROM water_logs WHERE id = ?').run(last.id);
  }

  const row = db
    .prepare('SELECT SUM(amount_ml) as total FROM water_logs WHERE date = ?')
    .get(dateStr) as { total: number };
  return row?.total ?? 0;
}

export function logWeight(db: Database.Database, dateStr: string, weightKg: number): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO weight_logs (id, date, weight_kg, logged_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      weight_kg = excluded.weight_kg,
      logged_at = excluded.logged_at
  `).run(randomUUID(), dateStr, weightKg, now);
}

export function getWeightHistory(
  db: Database.Database,
  limitDays = 28
): Array<{ date: string; weight_kg: number }> {
  return db
    .prepare('SELECT date, weight_kg FROM weight_logs ORDER BY date ASC LIMIT ?')
    .all(limitDays) as Array<{ date: string; weight_kg: number }>;
}

export function evaluateWeightTrendForGoal(
  db: Database.Database,
  goal: Goal
): ReturnType<typeof evaluateWeightTrend> {
  const entries = getWeightHistory(db, 35);
  return evaluateWeightTrend(entries, goal);
}
