import React, { useEffect, useState, useRef } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import { useAppStore } from '../store/appStore';
import { formatTimerMMSS } from '../../engine/session';
import { getExerciseSubstitutions } from '../../engine/workout';
import type { ExerciseDefinition } from '../../engine/types';
import {
  Clock,
  Dumbbell,
  CheckCircle2,
  Undo2,
  SkipForward,
  RotateCw,
  AlertCircle,
  Flag,
  Coffee,
  X,
  ChevronLeft,
} from 'lucide-react';

export default function ActiveWorkoutScreen() {
  const { setCurrentTab } = useAppStore();
  const {
    activeWorkout,
    exerciseStates,
    currentExerciseIndex,
    currentSetNumber,
    inputWeightKg,
    setInputWeightKg,
    inputReps,
    setInputReps,
    inputRir,
    setInputRir,
    isResting,
    restSecondsRemaining,
    plannedRestSec,
    logCurrentSet,
    undoLastSet,
    skipRestTimer,
    updateRestTick,
    swapExercise,
    setCurrentExerciseIndex,
    finishCurrentWorkout,
    cancelCurrentWorkout,
    startWorkout,
  } = useWorkoutStore();

  const [allExercises, setAllExercises] = useState<ExerciseDefinition[]>([]);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTab, setSwapTab] = useState<'substitutions' | 'browse'>('substitutions');
  const [swapSearch, setSwapSearch] = useState('');
  const weightInputRef = useRef<HTMLInputElement>(null);

  // Interval for ticking wall-clock rest timer
  useEffect(() => {
    const interval = setInterval(() => {
      updateRestTick();
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Load all exercises catalog for swaps
  useEffect(() => {
    async function load() {
      if (window.formaAPI) {
        const exs = await window.formaAPI.listExercises();
        setAllExercises(exs);
      }
    }
    load();
  }, []);

  // Global keyboard shortcuts for workout screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Z: Undo last set
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoLastSet();
        return;
      }

      // Space: Skip active rest timer
      if (e.code === 'Space' && isResting) {
        e.preventDefault();
        skipRestTimer();
        return;
      }

      // Enter: Log set (if not inside another input that uses enter)
      if (e.key === 'Enter' && !isResting && activeWorkout) {
        e.preventDefault();
        logCurrentSet();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isResting, activeWorkout, logCurrentSet, undoLastSet, skipRestTimer]);

  if (!activeWorkout || exerciseStates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4 text-center">
        <div className="p-4 rounded-2xl bg-[#181B22] border border-[#272B36] text-slate-400">
          <Dumbbell className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          <h2 className="text-base font-bold text-white">No Workout in Progress</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Generate and start a workout from the Today tab, calibrated to your time and energy today.
          </p>
        </div>
        <button
          onClick={() => setCurrentTab('today')}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs rounded-xl transition cursor-pointer"
        >
          Go to Today Hub
        </button>
      </div>
    );
  }

  const currentExState = exerciseStates[currentExerciseIndex] || exerciseStates[0];
  const currentEx = currentExState.exercise;
  const currentPlannedSet = currentExState.sets[currentSetNumber - 1] || currentExState.sets[0];

  const handleFinish = async () => {
    const summary = await finishCurrentWorkout();
    if (summary) {
      setCurrentTab('workout'); // Will render Summary view
    }
  };

  const handleDiscard = async () => {
    const hasLoggedSets = exerciseStates.some((es) => es.logged_sets.length > 0);
    if (hasLoggedSets) {
      if (!window.confirm('Discard this workout session and all logged sets?')) {
        return;
      }
    }
    await cancelCurrentWorkout();
    setCurrentTab('today');
  };

  const handlePause = () => {
    setCurrentTab('today');
  };

  const substitutions = getExerciseSubstitutions(currentEx, allExercises);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-5xl mx-auto w-full pb-28 select-none">
      {/* Top Banner: Workout Info & Finish Button */}
      <div className="flex items-center justify-between bg-[#181B22] border border-[#272B36] rounded-2xl p-5">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-white">
                {activeWorkout.focus} Workout
              </h1>
              <span className="text-[10px] font-mono uppercase bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                Exercise {currentExerciseIndex + 1} of {exerciseStates.length}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Planned Duration: {activeWorkout.planned_time_min} min • Energy Level: {activeWorkout.energy_level}/5
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePause}
            className="flex items-center space-x-1.5 px-3 py-2 bg-[#20242D] hover:bg-[#282E3A] border border-[#303644] text-slate-300 text-xs font-medium rounded-xl transition cursor-pointer"
            title="Pause and view other tabs (resume anytime from Today)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Pause</span>
          </button>
          <button
            onClick={handleDiscard}
            className="flex items-center space-x-1 px-3 py-2 bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-red-300 text-xs font-medium rounded-xl transition cursor-pointer"
            title="Cancel & discard this workout"
          >
            <X className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>
          <button
            onClick={undoLastSet}
            className="flex items-center space-x-1.5 px-3 py-2 bg-[#20242D] hover:bg-[#282E3A] border border-[#303644] text-slate-300 text-xs font-medium rounded-xl transition cursor-pointer"
            title="Cmd + Z"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo <span className="font-mono text-[10px] text-slate-500">⌘Z</span></span>
          </button>
          <button
            onClick={handleFinish}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5 fill-black" />
            <span>Finish</span>
          </button>
        </div>
      </div>

      {/* Rest Countdown Bar (when active) */}
      {isResting && (
        <div className="bg-gradient-to-r from-emerald-950/90 to-[#14171E] border border-emerald-500/50 rounded-2xl p-5 flex items-center justify-between shadow-2xl animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-mono font-bold text-lg text-emerald-300">
              {formatTimerMMSS(restSecondsRemaining)}
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
                <span>Rest Interval Active</span>
                <span className="text-[10px] text-slate-400 font-normal">• Native Tray Synchronized</span>
              </div>
              <p className="text-sm font-medium text-slate-200 mt-0.5">
                Catch your breath before Set {currentSetNumber} of {currentEx.name}.
              </p>
            </div>
          </div>

          <button
            onClick={skipRestTimer}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs rounded-xl transition cursor-pointer"
            title="Press Spacebar to Skip"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Skip Rest <span className="font-mono text-[10px] text-emerald-400/70">Space</span></span>
          </button>
        </div>
      )}

      {/* Exercise Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {exerciseStates.map((es, idx) => {
          const isCurrent = idx === currentExerciseIndex;
          const isDone = es.logged_sets.length >= es.sets.length;
          return (
            <button
              key={`${es.exercise.id}-${idx}`}
              type="button"
              onClick={() => setCurrentExerciseIndex(idx)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-2 border ${
                isCurrent
                  ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-sm'
                  : isDone
                  ? 'bg-[#181B22] border-emerald-500/30 text-emerald-400/80 hover:bg-[#20242D]'
                  : 'bg-[#181B22] border-[#272B36] text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              <span>{idx + 1}. {es.exercise.name}</span>
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : es.logged_sets.length > 0 ? (
                <span className="text-[10px] text-amber-400 font-mono">({es.logged_sets.length}/{es.sets.length})</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Main Active Exercise Card */}
      <div className="bg-[#181B22] border border-[#272B36] rounded-2xl p-6 space-y-6">
        {/* Exercise Header & Swap Button */}
        <div className="flex items-start justify-between border-b border-[#272B36] pb-4">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {currentEx.name}
              </h2>
              <span className="text-xs font-mono capitalize px-2.5 py-0.5 rounded bg-[#101217] text-slate-400 border border-[#272B36]">
                {currentEx.equipment} • {currentEx.compound_or_isolation}
              </span>
            </div>
            <p className="text-xs text-emerald-400 mt-1 font-medium">
              Cue: {currentEx.short_form_cue}
            </p>
            {currentExState.warmup_note && (
              <p className="text-xs text-amber-300/80 mt-0.5 font-medium">
                Warmup: {currentExState.warmup_note}
              </p>
            )}
          </div>

          <button
            onClick={() => setShowSwapModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#14171E] hover:bg-[#20242D] border border-[#272B36] hover:border-slate-600 text-xs text-slate-300 rounded-xl transition cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Swap Exercise</span>
          </button>
        </div>

        {/* Previous Session History Banner */}
        <div className="flex items-center justify-between bg-[#14171E] border border-[#272B36] px-4 py-3 rounded-xl text-xs">
          <span className="text-slate-400 font-medium">Previous Session Performance:</span>
          <span className="font-mono text-emerald-400 font-semibold">
            {currentExState.previous_weight_kg && currentExState.previous_weight_kg > 0
              ? `${currentExState.previous_weight_kg} kg × ${currentExState.previous_reps?.join(', ') || 'reps'}`
              : 'First exposure (Starting baseline)'}
          </span>
        </div>

        {/* Set Log Input Form */}
        <div className="bg-[#14171E] border border-[#272B36] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Logging Set {currentSetNumber} of {currentExState.sets.length}</span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              Target: {currentPlannedSet?.target_reps_min}-{currentPlannedSet?.target_reps_max} reps • RIR {currentPlannedSet?.target_rir}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Weight Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Weight (kg)
              </label>
              <input
                ref={weightInputRef}
                type="number"
                step="0.5"
                value={inputWeightKg}
                onChange={(e) => setInputWeightKg(Number(e.target.value))}
                className="w-full bg-[#181B22] border border-[#272B36] rounded-xl px-4 py-2.5 text-base font-bold text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {/* Reps Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Reps Performed
              </label>
              <input
                type="number"
                value={inputReps}
                onChange={(e) => setInputReps(Number(e.target.value))}
                className="w-full bg-[#181B22] border border-[#272B36] rounded-xl px-4 py-2.5 text-base font-bold text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {/* 1-Tap RIR Chips */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Reps in Reserve (RIR)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 1, 2, 3].map((rir) => (
                  <button
                    key={rir}
                    type="button"
                    onClick={() => setInputRir(rir)}
                    className={`py-2.5 rounded-xl border text-xs font-bold font-mono transition cursor-pointer text-center ${
                      inputRir === rir
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-[#181B22] border-[#272B36] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {rir === 3 ? '3+' : rir}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Big Enter Log Set Button */}
          <div className="pt-2">
            <button
              onClick={logCurrentSet}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black font-extrabold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 cursor-pointer uppercase tracking-wider"
            >
              <CheckCircle2 className="w-4 h-4 fill-black text-emerald-500" />
              <span>Log Set & Start Rest Countdown <span className="font-mono text-[10px] text-black/70">Enter</span></span>
            </button>
          </div>
        </div>

        {/* Completed Sets Table */}
        {currentExState.logged_sets.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Completed Sets for {currentEx.name}
            </h3>
            <div className="bg-[#14171E] border border-[#272B36] rounded-xl overflow-hidden divide-y divide-[#20242D]">
              {currentExState.logged_sets.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-2.5 text-xs font-mono">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                      #{s.set_number}
                    </span>
                    <span className="font-bold text-white">{s.weight_kg} kg × {s.reps} reps</span>
                    <span className="text-slate-500">RIR: {s.rir ?? '—'}</span>
                  </div>
                  <span className="text-slate-400">
                    Rest: {s.actual_rest_sec > 0 ? `${s.actual_rest_sec}s` : 'Initial set'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Exercise Swap Modal */}
      {showSwapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#14171E] border border-[#272B36] rounded-2xl w-full max-w-lg p-6 shadow-2xl text-slate-100 space-y-4">
            <h3 className="text-base font-bold text-white">
              Substitute for {currentEx.name}
            </h3>

            {/* Tabs: Substitutions vs Browse All */}
            <div className="flex gap-1 bg-[#101217] p-1 rounded-xl">
              <button
                onClick={() => setSwapTab('substitutions')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  swapTab === 'substitutions'
                    ? 'bg-[#1A1D25] text-white shadow'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Substitutions ({substitutions.length})
              </button>
              <button
                onClick={() => setSwapTab('browse')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  swapTab === 'browse'
                    ? 'bg-[#1A1D25] text-white shadow'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Browse All
              </button>
            </div>

            {swapTab === 'substitutions' ? (
              <>
                <p className="text-xs text-slate-400">
                  Biomechanically equivalent exercises targeting the same movement pattern ({currentEx.movement_pattern}).
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {substitutions.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No direct substitutions available. Try Browse All.</p>
                  ) : (
                    substitutions.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          swapExercise(currentEx.id, sub);
                          setShowSwapModal(false);
                          setSwapTab('substitutions');
                          setSwapSearch('');
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-[#181B22] hover:bg-[#20242D] border border-[#272B36] hover:border-emerald-500/40 text-left transition cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{sub.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono capitalize">{sub.equipment} • {sub.difficulty}</div>
                        </div>
                        <span className="text-xs text-emerald-400 font-semibold">Select →</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <input
                    value={swapSearch}
                    onChange={(e) => setSwapSearch(e.target.value)}
                    placeholder="Search all exercises…"
                    className="w-full pl-3 pr-4 py-2 bg-[#181B22] border border-[#272B36] rounded-xl text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-500/50"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {allExercises
                    .filter((ex) =>
                      ex.id !== currentEx.id &&
                      ex.name.toLowerCase().includes(swapSearch.toLowerCase())
                    )
                    .slice(0, 30)
                    .map((ex) => (
                      <button
                        key={ex.id}
                        onClick={() => {
                          swapExercise(currentEx.id, ex);
                          setShowSwapModal(false);
                          setSwapTab('substitutions');
                          setSwapSearch('');
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-[#181B22] hover:bg-[#20242D] border border-[#272B36] hover:border-emerald-500/40 text-left transition cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{ex.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono capitalize">
                            {ex.equipment} • {ex.primary_muscles.join(', ')} • {ex.difficulty}
                          </div>
                        </div>
                        <span className="text-xs text-emerald-400 font-semibold">Select →</span>
                      </button>
                    ))}
                </div>
              </>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setShowSwapModal(false);
                  setSwapTab('substitutions');
                  setSwapSearch('');
                }}
                className="px-4 py-2 bg-[#20242D] text-xs text-slate-300 rounded-xl hover:bg-[#282D3A] transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
