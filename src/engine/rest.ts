/**
 * Rest Timing Engine.
 * 
 * CRITICAL ARCHITECTURE REQUIREMENT:
 * Rest timing MUST use timestamps (startTime vs Date.now()), NEVER a setInterval accumulator.
 * On macOS, when the window is minimized or when the MacBook lid is closed (system sleep),
 * JavaScript setInterval timers are severely throttled or completely suspended by macOS App Nap.
 * By computing elapsed time as `Date.now() - startTimeMs`, the timer is always 100% mathematically
 * exact when awakened, refreshed, or rendered.
 */

export interface RestCalculationResult {
  actualRestSec: number;
  isOutlier: boolean;
  ignoredOutlier: boolean;
}

/**
 * Maximum threshold in seconds (e.g. 10 minutes = 600s) after which a rest interval
 * is considered an outlier caused by distraction / interruption rather than true athletic rest.
 */
export const OUTLIER_REST_THRESHOLD_SEC = 600;

/**
 * Calculates actual rest elapsed in seconds between the timestamp a set was logged
 * and the timestamp the next set commenced.
 */
export function calculateActualRest(
  setLoggedTimestampMs: number,
  nextSetStartedTimestampMs: number,
  ignoredByUser: boolean = false
): RestCalculationResult {
  if (nextSetStartedTimestampMs <= setLoggedTimestampMs) {
    return {
      actualRestSec: 0,
      isOutlier: false,
      ignoredOutlier: false,
    };
  }

  const elapsedMs = nextSetStartedTimestampMs - setLoggedTimestampMs;
  const actualRestSec = Math.round(elapsedMs / 1000);
  const isOutlier = actualRestSec >= OUTLIER_REST_THRESHOLD_SEC;

  return {
    actualRestSec,
    isOutlier,
    ignoredOutlier: ignoredByUser || isOutlier,
  };
}

/**
 * Analyzes rest patterns across sets to generate rest insights (Section 6).
 */
export function analyzeRestPatterns(sets: Array<{
  isCompound: boolean;
  plannedRestSec: number;
  actualRestSec: number;
  reps: number;
  setNumber: number;
}>): {
  averageRestSec: number;
  averagePlannedRestSec: number;
  flagRushedRest: boolean;
  insightMessage: string | null;
} {
  if (sets.length === 0) {
    return {
      averageRestSec: 0,
      averagePlannedRestSec: 0,
      flagRushedRest: false,
      insightMessage: null,
    };
  }

  const validSets = sets.filter((s) => s.actualRestSec > 0 && s.actualRestSec < OUTLIER_REST_THRESHOLD_SEC);
  if (validSets.length === 0) {
    return {
      averageRestSec: 0,
      averagePlannedRestSec: 0,
      flagRushedRest: false,
      insightMessage: null,
    };
  }

  const totalActual = validSets.reduce((sum, s) => sum + s.actualRestSec, 0);
  const totalPlanned = validSets.reduce((sum, s) => sum + s.plannedRestSec, 0);
  const avgActual = Math.round(totalActual / validSets.length);
  const avgPlanned = Math.round(totalPlanned / validSets.length);

  // Check if user rushed rest on compound lifts while reps dropped significantly
  const compoundSets = validSets.filter((s) => s.isCompound);
  let flagRushedRest = false;

  if (compoundSets.length >= 3) {
    const avgCompoundRest = compoundSets.reduce((sum, s) => sum + s.actualRestSec, 0) / compoundSets.length;
    const avgCompoundPlanned = compoundSets.reduce((sum, s) => sum + s.plannedRestSec, 0) / compoundSets.length;

    // Rest was < 70% of planned
    const rushed = avgCompoundRest < avgCompoundPlanned * 0.7;

    // Reps dropped by >= 3 reps between first and last set
    const repDrop = compoundSets[0].reps - compoundSets[compoundSets.length - 1].reps >= 3;

    if (rushed && repDrop) {
      flagRushedRest = true;
      return {
        averageRestSec: avgActual,
        averagePlannedRestSec: avgPlanned,
        flagRushedRest: true,
        insightMessage: 'Rest Insight: You rested significantly shorter than planned on heavy compound sets and reps dropped noticeably across sets. Consider taking the full 2-3 minutes of rest to maximize strength output.',
      };
    }
  }

  return {
    averageRestSec: avgActual,
    averagePlannedRestSec: avgPlanned,
    flagRushedRest,
    insightMessage: null,
  };
}

/**
 * Calculates elapsed rest seconds from a set logged timestamp to now.
 * Pure wall-clock timestamp calculation.
 */
export function calculateElapsedRestSec(setLoggedTimestampMs: number): number {
  return Math.max(0, Math.round((Date.now() - setLoggedTimestampMs) / 1000));
}

/**
 * Formats seconds into MM:SS.
 */
export function formatRestTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

