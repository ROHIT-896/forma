import type {
  ExerciseDefinition,
  FoodDefinition,
  UserProfileInput,
  YourPlan,
  PlanOverrides,
  PlanDiffItem,
  LoggedSet,
  WorkoutSummary,
  MealType,
  Goal,
} from '../engine/types';
import type { WorkoutRow } from '../main/workoutRepo';
import type { FoodLogRow, DayDietSummary, SavedMeal } from '../main/dietRepo';
import type { ProfileWithMeta } from '../main/planRepo';

export interface AppInfo {
  version: string;
  name: string;
  userDataPath: string;
  dbPath: string;
  sqliteVersion: string;
  platform: string;
  arch: string;
  build_mode: string;
  node_version: string;
  electron_version: string;
}

export interface DBPingResult {
  ok: boolean;
  timestamp: number;
  sqliteVersion: string;
  dbPath: string;
  backupCount: number;
  schemaVersion: number;
  catalogCounts: {
    exercises: number;
    foods: number;
  };
}

export interface FormaAPI {
  // System & Health
  ping: () => Promise<DBPingResult>;
  getAppInfo: () => Promise<AppInfo>;
  setPowerSaveBlocker: (enabled: boolean) => Promise<boolean>;
  updateTrayTimer: (text: string | null) => Promise<void>;
  notifyRestComplete: (title: string, body: string) => Promise<void>;

  // Profile & Plan
  getProfile: () => Promise<ProfileWithMeta | null>;
  saveProfile: (profile: UserProfileInput) => Promise<{ profile: ProfileWithMeta; planOutdated: boolean }>;
  getPlan: () => Promise<YourPlan | null>;
  previewPlanUpdate: () => Promise<{
    currentPlan: YourPlan | null;
    nextPlan: YourPlan;
    diffs: PlanDiffItem[];
    suggestedCaloriesDelta: number;
    weightTrendReason: string;
  }>;
  acceptPlanUpdate: (newPlan: YourPlan) => Promise<void>;
  setPlanOverrides: (overrides: PlanOverrides | null) => Promise<YourPlan>;
  getMessMode: () => Promise<boolean>;
  setMessMode: (enabled: boolean) => Promise<void>;
  getOnboardingSkipped: () => Promise<boolean>;
  setOnboardingSkipped: (skipped: boolean) => Promise<void>;

  // Workouts & Exercises
  listExercises: () => Promise<ExerciseDefinition[]>;
  startWorkout: (params: {
    date: string;
    focus: string;
    planned_time_min: number;
    energy_level: number;
    equipment: string;
  }) => Promise<WorkoutRow>;
  logWorkoutSet: (set: {
    workout_id: string;
    exercise_id: string;
    set_number: number;
    weight_kg: number;
    reps: number;
    rir?: number;
    planned_rest_sec: number;
    actual_rest_sec: number;
  }) => Promise<LoggedSet>;
  undoLastWorkoutSet: (workoutId: string) => Promise<LoggedSet | null>;
  getWorkoutSets: (workoutId: string) => Promise<LoggedSet[]>;
  finishWorkout: (summary: WorkoutSummary) => Promise<void>;
  getActiveWorkout: () => Promise<{ workout: WorkoutRow; sets: LoggedSet[] } | null>;
  getExerciseHistory: (exerciseId: string) => Promise<{
    working_weight_kg: number;
    last_reps: number[];
    last_session_date: string | null;
  }>;
  getRecentWorkouts: (limit?: number) => Promise<WorkoutRow[]>;

  // Diet & Tracking
  listFoods: () => Promise<FoodDefinition[]>;
  upsertFood: (food: Partial<FoodDefinition> & { name: string; estimated_calories: number; estimated_protein: number }) => Promise<FoodDefinition>;
  logFood: (entry: {
    date: string;
    meal_type: MealType;
    food_id: string;
    portion_quantity: number;
    portion_unit?: string;
  }) => Promise<FoodLogRow>;
  deleteFoodLog: (id: string) => Promise<boolean>;
  getDayDiet: (dateStr: string) => Promise<DayDietSummary>;
  repeatYesterdayMeal: (dateStr: string, mealType: MealType) => Promise<number>;
  saveMeal: (
    name: string,
    mealType: string,
    items: Array<{ food_id: string; portion_quantity: number; portion_unit?: string }>
  ) => Promise<SavedMeal>;
  listSavedMeals: () => Promise<SavedMeal[]>;
  logSavedMeal: (savedMealId: string, dateStr: string, mealType: MealType) => Promise<number>;
  deleteSavedMeal: (savedMealId: string) => Promise<boolean>;
  logQuickProtein: (foodId: string, dateStr: string, isMessMode?: boolean) => Promise<FoodLogRow>;
  addWater: (dateStr: string, amountMl?: number) => Promise<number>;
  undoLastWater: (dateStr: string) => Promise<number>;
  logWeight: (dateStr: string, weightKg: number) => Promise<void>;
  getWeightHistory: (limitDays?: number) => Promise<Array<{ date: string; weight_kg: number }>>;
  evaluateWeightTrend: (goal: Goal) => Promise<any>;
}

declare global {
  interface Window {
    formaAPI: FormaAPI;
  }
}
