import { create } from 'zustand';
import type {
  YourPlan,
  MealType,
  UserProfileInput,
} from '../../engine/types';
import type { ProfileWithMeta } from '../../main/planRepo';
import type { DayDietSummary, SavedMeal } from '../../main/dietRepo';

export type NavTab = 'today' | 'workout' | 'food' | 'plan' | 'progress' | 'settings';

interface AppState {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;

  profile: ProfileWithMeta | null;
  plan: YourPlan | null;
  planOutdated: boolean;
  messMode: boolean;
  onboardingOpen: boolean;

  todayDiet: DayDietSummary | null;
  selectedDate: string; // YYYY-MM-DD
  savedMeals: SavedMeal[];

  isLoading: boolean;

  // Actions
  initApp: () => Promise<void>;
  setSelectedDate: (date: string) => Promise<void>;
  toggleMessMode: () => Promise<void>;
  saveUserProfile: (profile: UserProfileInput) => Promise<void>;
  setOnboardingOpen: (open: boolean) => void;
  skipOnboarding: () => Promise<void>;
  refreshPlan: () => Promise<void>;
  refreshTodayDiet: () => Promise<void>;
  logQuickProtein: (foodId: string) => Promise<void>;
  addWaterGlass: () => Promise<void>;
  undoWater: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTab: 'today',
  setCurrentTab: (tab) => set({ currentTab: tab }),

  profile: null,
  plan: null,
  planOutdated: false,
  messMode: true,
  onboardingOpen: false,

  todayDiet: null,
  selectedDate: new Date().toISOString().slice(0, 10),
  savedMeals: [],
  isLoading: true,

  initApp: async () => {
    set({ isLoading: true });
    try {
      if (!window.formaAPI) return;

      const [profile, plan, messMode, skipped] = await Promise.all([
        window.formaAPI.getProfile(),
        window.formaAPI.getPlan(),
        window.formaAPI.getMessMode(),
        window.formaAPI.getOnboardingSkipped(),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const diet = await window.formaAPI.getDayDiet(today);
      const saved = await window.formaAPI.listSavedMeals();

      set({
        profile,
        plan,
        messMode,
        todayDiet: diet,
        savedMeals: saved,
        onboardingOpen: !profile && !skipped,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to initialize app state:', err);
      set({ isLoading: false });
    }
  },

  setSelectedDate: async (date) => {
    set({ selectedDate: date });
    if (!window.formaAPI) return;
    try {
      const diet = await window.formaAPI.getDayDiet(date);
      set({ todayDiet: diet });
    } catch (err) {
      console.error('Failed to load diet for date:', date, err);
    }
  },

  toggleMessMode: async () => {
    const next = !get().messMode;
    set({ messMode: next });
    if (window.formaAPI) {
      await window.formaAPI.setMessMode(next);
    }
  },

  saveUserProfile: async (input) => {
    if (!window.formaAPI) return;
    const res = await window.formaAPI.saveProfile(input);
    const plan = await window.formaAPI.getPlan();
    set({
      profile: res.profile,
      plan,
      planOutdated: res.planOutdated,
      onboardingOpen: false,
    });
  },

  setOnboardingOpen: (open) => set({ onboardingOpen: open }),

  skipOnboarding: async () => {
    set({ onboardingOpen: false });
    if (window.formaAPI) {
      await window.formaAPI.setOnboardingSkipped(true);
    }
  },

  refreshPlan: async () => {
    if (!window.formaAPI) return;
    const plan = await window.formaAPI.getPlan();
    set({ plan, planOutdated: false });
  },

  refreshTodayDiet: async () => {
    if (!window.formaAPI) return;
    const diet = await window.formaAPI.getDayDiet(get().selectedDate);
    const saved = await window.formaAPI.listSavedMeals();
    set({ todayDiet: diet, savedMeals: saved });
  },

  logQuickProtein: async (foodId) => {
    if (!window.formaAPI) return;
    const { selectedDate, messMode } = get();
    await window.formaAPI.logQuickProtein(foodId, selectedDate, messMode);
    await get().refreshTodayDiet();
  },

  addWaterGlass: async () => {
    if (!window.formaAPI) return;
    await window.formaAPI.addWater(get().selectedDate, 250);
    await get().refreshTodayDiet();
  },

  undoWater: async () => {
    if (!window.formaAPI) return;
    await window.formaAPI.undoLastWater(get().selectedDate);
    await get().refreshTodayDiet();
  },
}));
