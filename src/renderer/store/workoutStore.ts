import { create } from 'zustand';
import type {
  GeneratedWorkout,
  ExerciseSessionState,
  LoggedSet,
  WorkoutSummary,
  ExerciseDefinition,
} from '../../engine/types';
import type { WorkoutRow } from '../../main/workoutRepo';
import { generateWorkoutSession, getExerciseSubstitutions } from '../../engine/workout';
import { calculateSessionSummary, formatTimerMMSS } from '../../engine/session';

interface WorkoutState {
  // Generator UI state
  timeAvailableMin: number;
  energyToday: number;
  selectedFocus: string;
  isGenerating: boolean;

  // Active workout state
  activeWorkout: WorkoutRow | null;
  generatedSession: GeneratedWorkout | null;
  exerciseStates: ExerciseSessionState[];
  currentExerciseIndex: number;
  currentSetNumber: number;

  // Active set input buffers
  inputWeightKg: number;
  inputReps: number;
  inputRir: number;

  // Pure timestamp-based rest timer
  isResting: boolean;
  restStartedAtMs: number | null;
  plannedRestSec: number;
  restSecondsRemaining: number;

  // Summary state
  completedSummary: WorkoutSummary | null;

  // Actions
  setTimeAvailableMin: (mins: number) => void;
  setEnergyToday: (energy: number) => void;
  setSelectedFocus: (focus: string) => void;
  generateWorkout: () => Promise<void>;
  startWorkout: () => Promise<void>;
  setInputWeightKg: (w: number) => void;
  setInputReps: (r: number) => void;
  setInputRir: (rir: number) => void;
  logCurrentSet: () => Promise<void>;
  undoLastSet: () => Promise<void>;
  skipRestTimer: () => Promise<void>;
  updateRestTick: () => Promise<void>;
  swapExercise: (oldExerciseId: string, newExercise: ExerciseDefinition) => void;
  setCurrentExerciseIndex: (idx: number) => void;
  finishCurrentWorkout: () => Promise<WorkoutSummary | null>;
  cancelCurrentWorkout: () => Promise<void>;
  resetWorkoutState: () => void;
  checkForActiveSession: () => Promise<void>;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  timeAvailableMin: 45,
  energyToday: 4,
  selectedFocus: 'Push',
  isGenerating: false,

  activeWorkout: null,
  generatedSession: null,
  exerciseStates: [],
  currentExerciseIndex: 0,
  currentSetNumber: 1,

  inputWeightKg: 60,
  inputReps: 10,
  inputRir: 2,

  isResting: false,
  restStartedAtMs: null,
  plannedRestSec: 90,
  restSecondsRemaining: 0,

  completedSummary: null,

  setTimeAvailableMin: (mins) => set({ timeAvailableMin: mins }),
  setEnergyToday: (energy) => set({ energyToday: energy }),
  setSelectedFocus: (focus) => set({ selectedFocus: focus }),

  checkForActiveSession: async () => {
    if (!window.formaAPI) return;
    try {
      const active = await window.formaAPI.getActiveWorkout();
      if (active) {
        set({ activeWorkout: active.workout });
      }
    } catch (err) {
      console.error('Failed to check active workout:', err);
    }
  },

  generateWorkout: async () => {
    if (!window.formaAPI) return;
    set({ isGenerating: true });
    try {
      const exercises = await window.formaAPI.listExercises();
      const { timeAvailableMin, energyToday, selectedFocus } = get();

      const session = generateWorkoutSession({
        time_available_min: timeAvailableMin,
        energy_today: energyToday,
        focus: selectedFocus,
        equipment: 'full_gym',
        exerciseCatalog: exercises,
      });

      // Prepare exercise states with history
      const states: ExerciseSessionState[] = await Promise.all(
        session.exercises.map(async (pe) => {
          const hist = await window.formaAPI.getExerciseHistory(pe.exercise.id);
          const initialWeight = hist.working_weight_kg > 0 ? hist.working_weight_kg : pe.sets[0]?.prescribed_weight_kg || 20;

          return {
            exercise: pe.exercise,
            sets: pe.sets.map((s) => ({ ...s, prescribed_weight_kg: initialWeight })),
            logged_sets: [],
            previous_weight_kg: hist.working_weight_kg,
            previous_reps: hist.last_reps,
            warmup_note: pe.warmup_note,
          };
        })
      );

      const firstExWeight = states[0]?.sets[0]?.prescribed_weight_kg || 40;
      const firstExReps = states[0]?.sets[0]?.target_reps_max || 10;
      const firstExRir = states[0]?.sets[0]?.target_rir || 2;

      set({
        generatedSession: session,
        exerciseStates: states,
        currentExerciseIndex: 0,
        currentSetNumber: 1,
        inputWeightKg: firstExWeight,
        inputReps: firstExReps,
        inputRir: firstExRir,
        isGenerating: false,
      });
    } catch (err) {
      console.error('Failed to generate workout session:', err);
      set({ isGenerating: false });
    }
  },

  startWorkout: async () => {
    if (!window.formaAPI) return;
    const { generatedSession, timeAvailableMin, energyToday, selectedFocus } = get();
    if (!generatedSession) {
      await get().generateWorkout();
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const workoutRow = await window.formaAPI.startWorkout({
      date: todayStr,
      focus: selectedFocus,
      planned_time_min: timeAvailableMin,
      energy_level: energyToday,
      equipment: 'full_gym',
    });

    // Engage macOS powerSaveBlocker to prevent Mac display sleep during workout
    await window.formaAPI.setPowerSaveBlocker(true);

    set({ activeWorkout: workoutRow, completedSummary: null });
  },

  setInputWeightKg: (w) => set({ inputWeightKg: w }),
  setInputReps: (r) => set({ inputReps: r }),
  setInputRir: (rir) => set({ inputRir: rir }),

  logCurrentSet: async () => {
    const {
      activeWorkout,
      exerciseStates,
      currentExerciseIndex,
      currentSetNumber,
      inputWeightKg,
      inputReps,
      inputRir,
      restStartedAtMs,
    } = get();

    if (!activeWorkout || !window.formaAPI) return;

    const currentEx = exerciseStates[currentExerciseIndex];
    if (!currentEx) return;

    const plannedSet = currentEx.sets[currentSetNumber - 1] || currentEx.sets[0];
    const plannedRest = plannedSet?.planned_rest_sec || 90;

    // Calculate actual rest from previous set if resting
    let actualRestSec = 0;
    if (restStartedAtMs) {
      actualRestSec = Math.round((Date.now() - restStartedAtMs) / 1000);
    }

    const loggedSet = await window.formaAPI.logWorkoutSet({
      workout_id: activeWorkout.id,
      exercise_id: currentEx.exercise.id,
      set_number: currentSetNumber,
      weight_kg: inputWeightKg,
      reps: inputReps,
      rir: inputRir,
      planned_rest_sec: plannedRest,
      actual_rest_sec: actualRestSec,
    });

    // Append to local exercise states
    const updatedStates = [...exerciseStates];
    updatedStates[currentExerciseIndex] = {
      ...currentEx,
      logged_sets: [...currentEx.logged_sets, loggedSet],
    };

    // Determine next set or next exercise
    let nextExIndex = currentExerciseIndex;
    let nextSetNum = currentSetNumber + 1;

    if (nextSetNum > currentEx.sets.length) {
      if (nextExIndex < exerciseStates.length - 1) {
        nextExIndex += 1;
        nextSetNum = 1;
      }
    }

    const nextEx = updatedStates[nextExIndex];
    const nextTargetWeight = nextEx?.sets[nextSetNum - 1]?.prescribed_weight_kg ?? inputWeightKg;
    const nextTargetReps = nextEx?.sets[nextSetNum - 1]?.target_reps_max ?? inputReps;
    const nextTargetRir = nextEx?.sets[nextSetNum - 1]?.target_rir ?? 2;

    // Start rest timer automatically using wall-clock timestamp Date.now()
    const nowMs = Date.now();
    set({
      exerciseStates: updatedStates,
      currentExerciseIndex: nextExIndex,
      currentSetNumber: nextSetNum,
      inputWeightKg: nextTargetWeight,
      inputReps: nextTargetReps,
      inputRir: nextTargetRir,
      isResting: true,
      restStartedAtMs: nowMs,
      plannedRestSec: plannedRest,
      restSecondsRemaining: plannedRest,
    });

    // Update menu bar tray countdown
    window.formaAPI.updateTrayTimer(formatTimerMMSS(plannedRest));
  },

  undoLastSet: async () => {
    const { activeWorkout, exerciseStates } = get();
    if (!activeWorkout || !window.formaAPI) return;

    const undone = await window.formaAPI.undoLastWorkoutSet(activeWorkout.id);
    if (!undone) return;

    // Remove from exercise states
    const updatedStates = exerciseStates.map((ex) => {
      if (ex.exercise.id === undone.exercise_id) {
        return {
          ...ex,
          logged_sets: ex.logged_sets.filter((s) => s.id !== undone.id),
        };
      }
      return ex;
    });

    // Reset rest timer if active
    if (get().isResting) {
      get().skipRestTimer();
    }

    set({ exerciseStates: updatedStates });
  },

  skipRestTimer: async () => {
    set({
      isResting: false,
      restStartedAtMs: null,
      restSecondsRemaining: 0,
    });
    if (window.formaAPI) {
      window.formaAPI.updateTrayTimer(null);
    }
  },

  updateRestTick: async () => {
    const { isResting, restStartedAtMs, plannedRestSec } = get();
    if (!isResting || !restStartedAtMs) return;

    // CRITICAL: Calculate wall-clock elapsed time (Date.now() - startTime)
    const elapsedSec = Math.floor((Date.now() - restStartedAtMs) / 1000);
    const remaining = Math.max(0, plannedRestSec - elapsedSec);

    set({ restSecondsRemaining: remaining });

    if (window.formaAPI) {
      if (remaining > 0) {
        window.formaAPI.updateTrayTimer(formatTimerMMSS(remaining));
      } else {
        // Rest complete!
        set({ isResting: false });
        window.formaAPI.updateTrayTimer(null);
        window.formaAPI.notifyRestComplete(
          'Rest Complete',
          'Time to start your next set! Good luck.'
        );
      }
    }
  },

  swapExercise: (oldExerciseId, newExercise) => {
    const { exerciseStates } = get();
    const updated = exerciseStates.map((es) => {
      if (es.exercise.id === oldExerciseId) {
        return {
          ...es,
          exercise: newExercise,
        };
      }
      return es;
    });
    set({ exerciseStates: updated });
  },

  setCurrentExerciseIndex: (idx: number) => {
    const { exerciseStates } = get();
    if (idx < 0 || idx >= exerciseStates.length) return;
    const targetEx = exerciseStates[idx];
    const nextSetNum = targetEx.logged_sets.length + 1;
    const targetSet = targetEx.sets[nextSetNum - 1] || targetEx.sets[0];
    set({
      currentExerciseIndex: idx,
      currentSetNumber: Math.min(nextSetNum, targetEx.sets.length),
      inputWeightKg: targetSet?.prescribed_weight_kg || targetEx.previous_weight_kg || 40,
      inputReps: targetSet?.target_reps_max || 10,
      inputRir: targetSet?.target_rir ?? 2,
    });
  },

  finishCurrentWorkout: async () => {
    const { activeWorkout, exerciseStates, timeAvailableMin, selectedFocus } = get();
    if (!activeWorkout || !window.formaAPI) return null;

    const startedAt = activeWorkout.started_at ? new Date(activeWorkout.started_at).getTime() : Date.now() - 40 * 60000;
    const completedAt = Date.now();

    const summary = calculateSessionSummary({
      workoutId: activeWorkout.id,
      focus: selectedFocus,
      plannedDurationMin: timeAvailableMin,
      startedAtMs: startedAt,
      completedAtMs: completedAt,
      exercises: exerciseStates,
    });

    await window.formaAPI.finishWorkout(summary);

    // Release power save blocker and clear menu bar tray
    await window.formaAPI.setPowerSaveBlocker(false);
    await window.formaAPI.updateTrayTimer(null);

    set({
      completedSummary: summary,
      activeWorkout: null,
      isResting: false,
      restStartedAtMs: null,
    });

    return summary;
  },

  cancelCurrentWorkout: async () => {
    const { activeWorkout } = get();
    if (activeWorkout && window.formaAPI) {
      try {
        await window.formaAPI.cancelWorkout(activeWorkout.id);
        await window.formaAPI.setPowerSaveBlocker(false);
        await window.formaAPI.updateTrayTimer(null);
      } catch (err) {
        console.error('Failed to cancel workout:', err);
      }
    }
    set({
      activeWorkout: null,
      generatedSession: null,
      exerciseStates: [],
      currentExerciseIndex: 0,
      currentSetNumber: 1,
      isResting: false,
      restStartedAtMs: null,
      completedSummary: null,
    });
  },

  resetWorkoutState: () => {
    set({
      activeWorkout: null,
      generatedSession: null,
      exerciseStates: [],
      currentExerciseIndex: 0,
      currentSetNumber: 1,
      isResting: false,
      restStartedAtMs: null,
      completedSummary: null,
    });
  },
}));
