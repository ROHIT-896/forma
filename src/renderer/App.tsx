import React, { useEffect, useRef } from 'react';
import {
  Sun, Dumbbell, UtensilsCrossed, LayoutList, TrendingUp, Settings,
} from 'lucide-react';
import { useAppStore, type NavTab } from './store/appStore';
import { useWorkoutStore } from './store/workoutStore';
import OnboardingModal from './screens/OnboardingModal';
import TodayScreen from './screens/TodayScreen';
import ActiveWorkoutScreen from './screens/ActiveWorkoutScreen';
import SummaryScreen from './screens/SummaryScreen';
import FoodScreen from './screens/FoodScreen';
import PlanScreen from './screens/PlanScreen';
import ProgressScreen from './screens/ProgressScreen';
import SettingsScreen from './screens/SettingsScreen';

// ─── Tab Config ───────────────────────────────────────────────────────────────
const TABS: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
  { id: 'today',    label: 'Today',    icon: <Sun className="w-5 h-5" /> },
  { id: 'workout',  label: 'Workout',  icon: <Dumbbell className="w-5 h-5" /> },
  { id: 'food',     label: 'Food',     icon: <UtensilsCrossed className="w-5 h-5" /> },
  { id: 'plan',     label: 'Plan',     icon: <LayoutList className="w-5 h-5" /> },
  { id: 'progress', label: 'Progress', icon: <TrendingUp className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

// ─── Bottom Tab Bar ───────────────────────────────────────────────────────────
function TabBar({ current, onChange }: { current: NavTab; onChange: (t: NavTab) => void }) {
  return (
    <div
      className="flex-shrink-0 flex items-stretch border-t border-[#272B36] bg-[#14171E]"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {TABS.map((tab) => {
        const active = current === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 cursor-pointer transition-colors
              ${active
                ? 'text-emerald-400'
                : 'text-slate-600 hover:text-slate-400'}`}
          >
            {tab.icon}
            <span className="text-[9px] font-semibold uppercase tracking-wider">{tab.label}</span>
            {active && (
              <span className="absolute bottom-0 w-6 h-0.5 bg-emerald-400 rounded-t-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { currentTab, setCurrentTab, onboardingOpen, isLoading, initApp } = useAppStore();
  const {
    activeWorkout,
    completedSummary,
    isResting,
    updateRestTick,
    resetWorkoutState,
    checkForActiveSession,
  } = useWorkoutStore();

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Boot: load profile/plan/diet from DB
  useEffect(() => {
    initApp();
    checkForActiveSession();
  }, []);

  // Rest timer tick — runs every second while resting, immune to App Nap
  useEffect(() => {
    if (isResting) {
      tickRef.current = setInterval(() => updateRestTick(), 1000);
    } else {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isResting]);

  // Decide what to show in the workout tab
  const showActiveWorkout = currentTab === 'workout' && activeWorkout;
  const showSummary = currentTab === 'workout' && !activeWorkout && completedSummary;

  const handleSummaryDone = () => {
    resetWorkoutState();
    setCurrentTab('today');
  };

  return (
    <div className="flex flex-col h-screen bg-[#0F1115] text-slate-100 select-none overflow-hidden">
      {/* ── Draggable macOS Title Bar ── */}
      <div
        className="flex-shrink-0 h-10 w-full flex items-center justify-between px-20 border-b border-[#272B36] bg-[#14171E]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-widest text-[11px] text-emerald-400 uppercase">FORMA</span>
          <span className="text-slate-600">•</span>
          <span className="text-[11px] text-slate-500 font-medium">Adaptive Fitness Tracker</span>
        </div>
        <div
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {activeWorkout && (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
              ● Live Workout
            </span>
          )}
          <span className="text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-full">
            arm64
          </span>
          <span className="text-[10px] font-mono bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded-full">
            v0.3.0
          </span>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-500">Loading FORMA…</p>
            </div>
          </div>
        ) : (
          <>
            {/* Workout tab: show active session or summary if applicable */}
            {showActiveWorkout ? (
              <ActiveWorkoutScreen />
            ) : showSummary ? (
              <SummaryScreen summary={completedSummary!} onDone={handleSummaryDone} />
            ) : (
              <>
                {currentTab === 'today'    && <TodayScreen />}
                {currentTab === 'workout'  && <TodayScreen />}
                {currentTab === 'food'     && <FoodScreen />}
                {currentTab === 'plan'     && <PlanScreen />}
                {currentTab === 'progress' && <ProgressScreen />}
                {currentTab === 'settings' && <SettingsScreen />}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Bottom Tab Bar (hidden during active workout) ── */}
      {!showActiveWorkout && (
        <TabBar current={currentTab} onChange={setCurrentTab} />
      )}

      {/* ── Onboarding Modal ── */}
      {onboardingOpen && <OnboardingModal />}
    </div>
  );
}
