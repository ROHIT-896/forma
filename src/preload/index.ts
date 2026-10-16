import { contextBridge, ipcRenderer } from 'electron';
import type { FormaAPI } from '../shared/types';

const api: FormaAPI = {
  // System & Health
  ping: () => ipcRenderer.invoke('db:ping'),
  getAppInfo: () => ipcRenderer.invoke('system:getAppInfo'),
  setPowerSaveBlocker: (enabled: boolean) => ipcRenderer.invoke('system:setPowerSaveBlocker', enabled),
  updateTrayTimer: (text: string | null) => ipcRenderer.invoke('tray:updateTimer', text),
  notifyRestComplete: (title: string, body: string) => ipcRenderer.invoke('notification:show', { title, body }),

  // Profile & Plan
  getProfile: () => ipcRenderer.invoke('plan:getProfile'),
  saveProfile: (profile) => ipcRenderer.invoke('plan:saveProfile', profile),
  getPlan: () => ipcRenderer.invoke('plan:getPlan'),
  previewPlanUpdate: () => ipcRenderer.invoke('plan:previewUpdate'),
  acceptPlanUpdate: (newPlan) => ipcRenderer.invoke('plan:acceptUpdate', newPlan),
  setPlanOverrides: (overrides) => ipcRenderer.invoke('plan:setOverrides', overrides),
  getMessMode: () => ipcRenderer.invoke('meta:getMessMode'),
  setMessMode: (enabled) => ipcRenderer.invoke('meta:setMessMode', enabled),
  getOnboardingSkipped: () => ipcRenderer.invoke('meta:getOnboardingSkipped'),
  setOnboardingSkipped: (skipped) => ipcRenderer.invoke('meta:setOnboardingSkipped', skipped),

  // Workouts & Exercises
  listExercises: () => ipcRenderer.invoke('workout:listExercises'),
  startWorkout: (params) => ipcRenderer.invoke('workout:start', params),
  logWorkoutSet: (set) => ipcRenderer.invoke('workout:logSet', set),
  undoLastWorkoutSet: (workoutId) => ipcRenderer.invoke('workout:undoSet', workoutId),
  getWorkoutSets: (workoutId) => ipcRenderer.invoke('workout:getSets', workoutId),
  finishWorkout: (summary) => ipcRenderer.invoke('workout:finish', summary),
  getActiveWorkout: () => ipcRenderer.invoke('workout:getActive'),
  getExerciseHistory: (exerciseId) => ipcRenderer.invoke('workout:getExerciseHistory', exerciseId),
  getRecentWorkouts: (limit) => ipcRenderer.invoke('workout:getRecent', limit),

  // Diet & Tracking
  listFoods: () => ipcRenderer.invoke('diet:listFoods'),
  upsertFood: (food) => ipcRenderer.invoke('diet:upsertFood', food),
  logFood: (entry) => ipcRenderer.invoke('diet:logFood', entry),
  deleteFoodLog: (id) => ipcRenderer.invoke('diet:deleteFoodLog', id),
  getDayDiet: (dateStr) => ipcRenderer.invoke('diet:getDayDiet', dateStr),
  repeatYesterdayMeal: (dateStr, mealType) => ipcRenderer.invoke('diet:repeatYesterdayMeal', dateStr, mealType),
  saveMeal: (name, mealType, items) => ipcRenderer.invoke('diet:saveMeal', name, mealType, items),
  listSavedMeals: () => ipcRenderer.invoke('diet:listSavedMeals'),
  logSavedMeal: (savedMealId, dateStr, mealType) => ipcRenderer.invoke('diet:logSavedMeal', savedMealId, dateStr, mealType),
  deleteSavedMeal: (savedMealId) => ipcRenderer.invoke('diet:deleteSavedMeal', savedMealId),
  logQuickProtein: (foodId, dateStr, isMessMode) => ipcRenderer.invoke('diet:logQuickProtein', foodId, dateStr, isMessMode),
  addWater: (dateStr, amountMl) => ipcRenderer.invoke('diet:addWater', dateStr, amountMl),
  undoLastWater: (dateStr) => ipcRenderer.invoke('diet:undoLastWater', dateStr),
  logWeight: (dateStr, weightKg) => ipcRenderer.invoke('diet:logWeight', dateStr, weightKg),
  getWeightHistory: (limitDays) => ipcRenderer.invoke('diet:getWeightHistory', limitDays),
  evaluateWeightTrend: (goal) => ipcRenderer.invoke('diet:evaluateWeightTrend', goal),

  // Phase 4
  getStreak: () => ipcRenderer.invoke('analytics:getStreak'),
  getWeeklyMuscleVolume: () => ipcRenderer.invoke('analytics:getWeeklyMuscleVolume'),
  getWeeklyReview: () => ipcRenderer.invoke('analytics:getWeeklyReview'),
  getExercisePRHistory: (exerciseId) => ipcRenderer.invoke('analytics:getExercisePRHistory', exerciseId),
  exportDataJson: () => ipcRenderer.invoke('data:exportJson'),
  importDataJson: (jsonString) => ipcRenderer.invoke('data:importJson', jsonString),
  getBackupsList: () => ipcRenderer.invoke('data:getBackupsList'),
  getSettings: () => ipcRenderer.invoke('settings:getSettings'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:saveSettings', settings),
};

// Expose safe, typed API to renderer window
contextBridge.exposeInMainWorld('formaAPI', api);
