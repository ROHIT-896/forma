export type Sex = 'male' | 'female';
export type Goal = 'gain_muscle' | 'lose_fat' | 'maintain';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type EquipmentType = 'full_gym' | 'dumbbells_only' | 'bodyweight_only';
export type DietaryType = 'veg' | 'non_veg' | 'eggetarian';
export type Muscle =
  | 'chest'
  | 'back'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'calves'
  | 'abs'
  | 'forearms';

export type MovementPattern =
  | 'horizontal_push'
  | 'horizontal_pull'
  | 'vertical_push'
  | 'vertical_pull'
  | 'squat'
  | 'hip_hinge'
  | 'lunge'
  | 'isolation'
  | 'carry'
  | 'core';

export interface ExerciseDefinition {
  id: string;
  name: string;
  primary_muscles: Muscle[];
  secondary_muscles: Muscle[];
  equipment: 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight';
  movement_pattern: MovementPattern;
  compound_or_isolation: 'compound' | 'isolation';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  beginner_safe: boolean;
  short_form_cue: string;
  substitution_ids: string[];
}

export type PortionUnit = 'roti' | 'katori' | 'bowl' | 'piece' | 'glass' | 'spoon' | 'scoop' | 'serving' | 'plate' | 'slice' | 'grams' | 'ml' | (string & {});

export interface FoodDefinition {
  id: string;
  name: string;
  category: string;
  dietary_type: DietaryType;
  default_portion_unit: PortionUnit;
  portion_description: string;
  estimated_calories: number;
  estimated_protein: number;
  is_mess_item: boolean;
  mess_serving_definition: string;
  assumption_note: string;
  quick_protein_chip: boolean;
}

export interface UserProfileInput {
  height_cm: number;
  weight_kg: number;
  age: number;
  sex: Sex;
  goal: Goal;
  experience: Experience;
  days_per_week: number;
  equipment: EquipmentType;
  dietary_type: DietaryType;
}

export interface DietPlan {
  bmr: number;
  maintenance_calories: number;
  calorie_target: number;
  protein_target_g: number;
  weekly_weight_change_kg: number;
  formula_breakdown: string;
  meal_level_guidance: string[];
}

export interface WorkoutSplitPlan {
  split_type: 'Full Body' | 'Upper / Lower' | 'Push / Pull / Legs';
  days_per_week: number;
  weekly_schedule: Array<{ day: number; day_name: string; focus: string; is_rest: boolean }>;
  weekly_muscle_targets: Record<Muscle, number>; // Target hard sets per week
  starting_load_guidance: string;
  why: string;
}

export interface PlannedSet {
  set_number: number;
  target_reps_min: number;
  target_reps_max: number;
  target_rir: number;
  planned_rest_sec: number;
  prescribed_weight_kg: number;
  is_warmup?: boolean;
}

export interface PlannedExercise {
  exercise: ExerciseDefinition;
  sets: PlannedSet[];
  superset_with?: string; // ID of paired exercise for short sessions
  warmup_note?: string;
}

export interface GeneratedWorkout {
  focus: string;
  energy_level: number;
  time_available_min: number;
  estimated_duration_min: number;
  exercises: PlannedExercise[];
  adaptation_notes: string[];
}

export interface ProgressionInput {
  exercise_id: string;
  equipment: 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight';
  rep_range_min: number;
  rep_range_max: number;
  target_rir: number;
  current_weight_kg: number;
  recent_sets: Array<{ reps: number; rir?: number }>;
  consecutive_failures?: number;
  consecutive_stalls?: number;
  user_rated_too_hard?: boolean;
}

export interface ProgressionResult {
  next_weight_kg: number;
  target_reps_min: number;
  target_reps_max: number;
  reason: string;
  consecutive_failures: number;
  consecutive_stalls: number;
  suggest_substitute: boolean;
  suggest_deload: boolean;
}

export type MealType = 'breakfast' | 'lunch' | 'snacks' | 'dinner' | 'extra';

export interface ProteinPlanItem {
  meal_type: MealType;
  food_id: string;
  food_name: string;
  portion_qty: number;
  portion_unit: string;
  protein_g: number;
  calories: number;
  is_mess_item: boolean;
  mess_serving_definition?: string;
  note?: string;
}

export interface PlanOverrides {
  calorie_target?: number;
  protein_target_g?: number;
}

export interface YourPlan {
  profile: UserProfileInput;
  diet: DietPlan & {
    effective_calorie_target: number;
    effective_protein_target_g: number;
    overrides?: PlanOverrides | null;
    protein_plan: ProteinPlanItem[];
    total_planned_protein_g: number;
    total_planned_calories: number;
  };
  workout: WorkoutSplitPlan;
  created_at: string;
  updated_at: string;
}

export interface PlanDiffItem {
  category: 'diet' | 'workout';
  field: string;
  label: string;
  from: string;
  to: string;
  reason: string;
}

export interface TodaysPlannedSession {
  focus: string | null;
  is_rest_day: boolean;
  day_name: string;
  message: string;
  suggested_focus: string;
}

export interface LoggedSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  rir?: number;
  planned_rest_sec: number;
  actual_rest_sec: number;
  logged_at: string;
}

export interface ExerciseSessionState {
  exercise: ExerciseDefinition;
  sets: PlannedSet[];
  logged_sets: LoggedSet[];
  previous_weight_kg?: number;
  previous_reps?: number[];
  warmup_note?: string;
}

export interface WorkoutSummary {
  workout_id: string;
  focus: string;
  total_volume_kg: number;
  total_sets: number;
  completed_duration_min: number;
  planned_duration_min: number;
  avg_rest_sec: number;
  planned_rest_sec: number;
  pr_count: number;
  rest_insights: string[];
  progression_updates: Array<{
    exercise_id: string;
    exercise_name: string;
    previous_weight_kg: number;
    next_weight_kg: number;
    reason: string;
  }>;
}

