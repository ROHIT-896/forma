import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useWorkoutStore } from '../store/workoutStore';
import { resolveTodaysPlannedSession } from '../../engine/yourPlan';
import type { TodaysPlannedSession, FoodDefinition } from '../../engine/types';
import {
  Flame,
  Dumbbell,
  Droplets,
  Calendar,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  Clock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export default function TodayScreen() {
  const { plan, todayDiet, selectedDate, logQuickProtein, addWaterGlass, setCurrentTab } = useAppStore();
  const {
    timeAvailableMin,
    setTimeAvailableMin,
    energyToday,
    setEnergyToday,
    selectedFocus,
    setSelectedFocus,
    startWorkout,
    activeWorkout,
    isGenerating,
  } = useWorkoutStore();

  const [plannedSession, setPlannedSession] = useState<TodaysPlannedSession | null>(null);
  const [quickFoods, setQuickFoods] = useState<FoodDefinition[]>([]);

  useEffect(() => {
    async function loadData() {
      if (window.formaAPI) {
        const [foods, workouts] = await Promise.all([
          window.formaAPI.listFoods(),
          window.formaAPI.getRecentWorkouts(10),
        ]);

        // Filter foods that have quick_protein_chip = true and match user's dietary type
        const filtered = foods.filter((f) => f.quick_protein_chip);
        setQuickFoods(filtered.slice(0, 5));

        if (plan) {
          const res = resolveTodaysPlannedSession(
            plan,
            workouts.map((w) => ({ date: w.date, focus: w.focus, status: w.status })),
            selectedDate
          );
          setPlannedSession(res);
          if (res.focus) {
            setSelectedFocus(res.focus);
          }
        }
      }
    }
    loadData();
  }, [plan, selectedDate]);

  const caloriesConsumed = todayDiet?.totals.calories || 0;
  const proteinConsumed = todayDiet?.totals.protein || 0;
  const targetCalories = plan?.diet.effective_calorie_target || 2500;
  const targetProtein = plan?.diet.effective_protein_target_g || 130;

  const caloriesRemaining = Math.max(0, targetCalories - caloriesConsumed);
  const proteinRemaining = Math.max(0, targetProtein - proteinConsumed);

  const handleStartWorkout = async () => {
    await startWorkout();
    setCurrentTab('workout');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full pb-12">
      {/* Active Workout Resume Banner */}
      {activeWorkout && (
        <div className="bg-gradient-to-r from-emerald-950/80 to-[#14171E] border border-emerald-500/40 rounded-2xl p-5 flex items-center justify-between shadow-xl">
          <div className="flex items-center space-x-3.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
            <div>
              <div className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Active Workout Session: {activeWorkout.focus}</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  In Progress
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Sets logged so far: {activeWorkout.total_sets}. Tap to return to your session.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentTab('workout')}
            className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <span>Resume Workout</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Planned Session Header */}
      {plannedSession && (
        <div className="bg-[#181B22] border border-[#272B36] rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className={`p-2.5 rounded-xl border ${
              plannedSession.is_rest_day
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              {plannedSession.is_rest_day ? <Calendar className="w-5 h-5" /> : <Dumbbell className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 flex items-center space-x-2">
                <span>{plannedSession.day_name} on Your Plan</span>
                <span className="text-[10px] text-slate-500">•</span>
                <span className={plannedSession.is_rest_day ? 'text-blue-400' : 'text-emerald-400'}>
                  {plannedSession.is_rest_day ? 'Rest Day' : `Scheduled Focus: ${plannedSession.focus}`}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-200 mt-0.5">
                {plannedSession.message}
              </p>
            </div>
          </div>

          {!plannedSession.is_rest_day && !activeWorkout && (
            <button
              onClick={handleStartWorkout}
              className="flex items-center space-x-2 px-4 py-2 bg-[#20242E] hover:bg-[#282D3A] text-slate-200 text-xs font-semibold rounded-xl border border-[#303644] transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
              <span>Load Focus</span>
            </button>
          )}
        </div>
      )}

      {/* Daily Snapshot Cards: Calories, Protein, Water */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Calories Card */}
        <div className="bg-[#181B22] border border-[#272B36] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-slate-300">Calories Remaining</span>
            </span>
            <span className="font-mono text-slate-400">{caloriesConsumed} / {targetCalories} kcal</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
              {caloriesRemaining}
            </span>
            <span className="text-xs text-slate-500 uppercase font-mono">kcal left</span>
          </div>
          <div className="w-full bg-[#101217] h-2 rounded-full overflow-hidden border border-[#272B36]">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (caloriesConsumed / targetCalories) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Protein Card */}
        <div className="bg-[#181B22] border border-[#272B36] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-300">Protein Remaining</span>
            </span>
            <span className="font-mono text-slate-400">{proteinConsumed} / {targetProtein} g</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-emerald-400 tracking-tight font-mono">
              {proteinRemaining}
            </span>
            <span className="text-xs text-slate-500 uppercase font-mono">g left</span>
          </div>
          <div className="w-full bg-[#101217] h-2 rounded-full overflow-hidden border border-[#272B36]">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (proteinConsumed / targetProtein) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Water Card */}
        <div className="bg-[#181B22] border border-[#272B36] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-2">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-slate-300">Hydration Today</span>
            </span>
            <button
              onClick={() => addWaterGlass()}
              className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-[11px] font-medium transition cursor-pointer"
            >
              +250 ml Glass
            </button>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-cyan-400 tracking-tight font-mono">
              {todayDiet?.water_ml || 0}
            </span>
            <span className="text-xs text-slate-500 uppercase font-mono">ml logged</span>
          </div>
          <div className="w-full bg-[#101217] h-2 rounded-full overflow-hidden border border-[#272B36]">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, ((todayDiet?.water_ml || 0) / 3000) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 1-Tap Quick Protein Chips */}
      {quickFoods.length > 0 && (
        <div className="bg-[#181B22] border border-[#272B36] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>1-Tap Quick Protein Tally (Hostel & Mess Staples)</span>
            </div>
            <button
              onClick={() => setCurrentTab('food')}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition"
            >
              Open Food Tab →
            </button>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            {quickFoods.map((f) => (
              <button
                key={f.id}
                onClick={() => logQuickProtein(f.id)}
                className="flex items-center space-x-2.5 bg-[#14171E] hover:bg-[#20242D] border border-[#272B36] hover:border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs text-slate-200 transition cursor-pointer group"
              >
                <span className="font-medium group-hover:text-emerald-300">{f.name}</span>
                <span className="text-[10px] font-mono bg-emerald-950/60 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800/40">
                  +{f.estimated_protein}g
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Workout Generator Card */}
      <div className="bg-[#181B22] border border-[#272B36] rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#272B36] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Workout Session Generator</h2>
              <p className="text-xs text-slate-400">
                Calibrates volume, RIR, and rest periods to your exact time and daily energy.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-500 bg-[#101217] px-3 py-1 rounded-full border border-[#272B36]">
            Strict ±3.5 min Tolerance
          </span>
        </div>

        {/* Time Available Chips */}
        <div>
          <label className="flex items-center space-x-2 text-xs font-semibold text-slate-300 mb-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Time Available Today</span>
          </label>
          <div className="grid grid-cols-5 gap-2.5">
            {[20, 30, 45, 60, 90].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setTimeAvailableMin(mins)}
                className={`py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer text-center font-mono ${
                  timeAvailableMin === mins
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/10'
                    : 'bg-[#14171E] border-[#272B36] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {mins} min
              </button>
            ))}
          </div>
        </div>

        {/* Energy Today Chips */}
        <div>
          <label className="flex items-center space-x-2 text-xs font-semibold text-slate-300 mb-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Energy Level Today (1 to 5)</span>
          </label>
          <div className="grid grid-cols-5 gap-2.5">
            {[
              { level: 1, label: '1 • Exhausted' },
              { level: 2, label: '2 • Low' },
              { level: 3, label: '3 • Normal' },
              { level: 4, label: '4 • High' },
              { level: 5, label: '5 • Peak' },
            ].map(({ level, label }) => (
              <button
                key={level}
                type="button"
                onClick={() => setEnergyToday(level)}
                className={`py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer text-center ${
                  energyToday === level
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/10'
                    : 'bg-[#14171E] border-[#272B36] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Focus Area Picker */}
        <div>
          <label className="flex items-center space-x-2 text-xs font-semibold text-slate-300 mb-2">
            <Dumbbell className="w-3.5 h-3.5 text-slate-400" />
            <span>Focus Area</span>
          </label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFocus(f)}
                className={`py-2 rounded-xl border text-xs font-medium transition cursor-pointer text-center ${
                  selectedFocus === f
                    ? 'bg-purple-500/15 border-purple-500 text-purple-300'
                    : 'bg-[#14171E] border-[#272B36] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Start Workout Action Button */}
        <div className="pt-2">
          <button
            onClick={handleStartWorkout}
            disabled={isGenerating}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>{isGenerating ? 'Generating fitted workout...' : `Start ${timeAvailableMin}-Min ${selectedFocus} Workout`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
