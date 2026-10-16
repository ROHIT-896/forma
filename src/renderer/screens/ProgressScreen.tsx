import React, { useEffect, useState, useCallback } from 'react';
import {
  Dumbbell, Clock, BarChart2, Scale, TrendingUp, TrendingDown, Minus,
  Flame, Sparkles, Trophy, ChevronRight, Activity, CheckCircle2,
  Edit3, Trash2, X, Save,
} from 'lucide-react';
import type { WorkoutRow } from '../../main/workoutRepo';
import type { ExerciseDefinition, LoggedSet } from '../../engine/types';

const FOCUS_COLORS: Record<string, string> = {
  Push: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  Pull: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  Legs: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  'Full Body': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  'Upper Body': 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  'Lower Body': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
};

function focusClass(focus: string) {
  return FOCUS_COLORS[focus] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/30';
}

function EditWorkoutModal({
  workout,
  exercises,
  onClose,
  onUpdated,
}: {
  workout: WorkoutRow;
  exercises: ExerciseDefinition[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [date, setDate] = useState(workout.date.slice(0, 10));
  const [focus, setFocus] = useState(workout.focus);
  const [plannedTime, setPlannedTime] = useState(workout.planned_time_min);
  const [sets, setSets] = useState<LoggedSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!window.formaAPI) return;
    window.formaAPI.getWorkoutSets(workout.id).then((s) => {
      setSets(s);
      setLoadingSets(false);
    });
  }, [workout.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.formaAPI) return;
    setSaving(true);
    try {
      await window.formaAPI.updateWorkout(workout.id, {
        date,
        focus,
        planned_time_min: Number(plannedTime),
      });
      onUpdated();
      onClose();
    } catch (err) {
      console.error('Failed to update workout:', err);
      alert('Failed to save workout updates.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkout = async () => {
    if (!window.formaAPI) return;
    if (window.confirm('Delete this workout from history? All logged sets for this session will also be removed.')) {
      setSaving(true);
      try {
        await window.formaAPI.deleteWorkout(workout.id);
        onUpdated();
        onClose();
      } catch (err) {
        console.error('Failed to delete workout:', err);
        alert('Failed to delete workout.');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDeleteSet = async (setId: string) => {
    if (!window.formaAPI) return;
    try {
      await window.formaAPI.deleteWorkoutSet(setId);
      setSets((prev) => prev.filter((s) => s.id !== setId));
      onUpdated();
    } catch (err) {
      console.error('Failed to delete set:', err);
    }
  };

  const handleUpdateSet = async (setId: string, weightKg: number, reps: number) => {
    if (!window.formaAPI) return;
    try {
      const updated = await window.formaAPI.updateWorkoutSet(setId, { weight_kg: weightKg, reps });
      setSets((prev) => prev.map((s) => (s.id === setId ? updated : s)));
      onUpdated();
    } catch (err) {
      console.error('Failed to update set:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#14171E] border border-[#272B36] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl text-slate-100 space-y-5">
        <div className="flex items-center justify-between border-b border-[#272B36] pb-3">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[var(--accent-primary)]" />
            <h3 className="text-sm font-bold text-white">Edit Workout Properties</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Workout Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#1A1D25] border border-[#272B36] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[var(--accent-primary)]"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Split Focus
              </label>
              <select
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                className="w-full bg-[#1A1D25] border border-[#272B36] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[var(--accent-primary)]"
              >
                {['Push', 'Pull', 'Legs', 'Full Body', 'Upper Body', 'Lower Body'].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Planned Duration (Minutes)
            </label>
            <input
              type="number"
              min={10}
              max={180}
              value={plannedTime}
              onChange={(e) => setPlannedTime(Number(e.target.value))}
              className="w-full bg-[#1A1D25] border border-[#272B36] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          {/* Logged Sets List */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Logged Sets ({sets.length})</span>
              {loadingSets && <span className="text-[10px] text-slate-500">Loading sets…</span>}
            </div>

            {sets.length === 0 ? (
              <div className="bg-[#1A1D25] border border-[#272B36] rounded-lg p-3 text-center text-xs text-slate-500">
                No sets recorded for this session.
              </div>
            ) : (
              <div className="bg-[#1A1D25] border border-[#272B36] rounded-lg divide-y divide-[#272B36] max-h-48 overflow-y-auto">
                {sets.map((s) => {
                  const exName = exercises.find((e) => e.id === s.exercise_id)?.name || s.exercise_id;
                  return (
                    <div key={s.id} className="flex items-center justify-between p-2.5 text-xs">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-semibold text-white truncate">{exName}</div>
                        <div className="text-[10px] text-slate-500">Set #{s.set_number}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-[#14171E] border border-[#272B36] rounded px-1.5 py-1">
                          <input
                            type="number"
                            step="0.5"
                            value={s.weight_kg}
                            onChange={(e) => handleUpdateSet(s.id, Number(e.target.value), s.reps)}
                            className="w-12 bg-transparent text-right font-mono text-white text-xs outline-none"
                          />
                          <span className="text-[10px] text-slate-500">kg</span>
                        </div>
                        <div className="flex items-center gap-1 bg-[#14171E] border border-[#272B36] rounded px-1.5 py-1">
                          <input
                            type="number"
                            value={s.reps}
                            onChange={(e) => handleUpdateSet(s.id, s.weight_kg, Number(e.target.value))}
                            className="w-8 bg-transparent text-right font-mono text-white text-xs outline-none"
                          />
                          <span className="text-[10px] text-slate-500">reps</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSet(s.id)}
                          className="p-1.5 rounded hover:bg-red-950/50 text-red-400 transition cursor-pointer"
                          title="Delete set"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#272B36]">
            <button
              type="button"
              onClick={handleDeleteWorkout}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-900/40 text-xs font-semibold transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Workout
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-lg bg-[#272B36] hover:bg-[#31363F] text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:opacity-90 text-white text-xs font-semibold transition cursor-pointer shadow-sm"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function WorkoutCard({
  workout,
  onEdit,
}: {
  workout: WorkoutRow;
  onEdit: (workout: WorkoutRow) => void;
}) {
  const date = new Date(workout.date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div
      onClick={() => onEdit(workout)}
      className="bg-[#1A1D25] border border-[#272B36] hover:border-slate-500 rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{date}</span>
          <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
            <Edit3 className="w-3 h-3" /> Edit
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${focusClass(workout.focus)}`}>
            {workout.focus}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(workout);
            }}
            className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-[#272B36] transition"
            title="Edit workout"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-[#14171E] rounded-lg p-2">
          <div className="text-sm font-bold text-white flex items-center justify-center gap-1">
            <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
            {Math.round(workout.total_volume).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">kg vol</div>
        </div>
        <div className="bg-[#14171E] rounded-lg p-2">
          <div className="text-sm font-bold text-white flex items-center justify-center gap-1">
            <Dumbbell className="w-3.5 h-3.5 text-slate-500" />
            {workout.total_sets}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">sets</div>
        </div>
        <div className="bg-[#14171E] rounded-lg p-2">
          <div className="text-sm font-bold text-white flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            {workout.planned_time_min}m
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">planned</div>
        </div>
      </div>
      {workout.avg_rest_sec > 0 && (
        <div className="text-[11px] text-slate-500">
          Avg rest: {Math.round(workout.avg_rest_sec)}s
        </div>
      )}
    </div>
  );
}


// ── Streak Banner ─────────────────────────────────────────────────────────────
function StreakBanner({ current, best }: { current: number; best: number }) {
  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-[#1A1D25] to-[#1A1D25] border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Flame className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{current}</span>
            <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
              Day Streak
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Planned workout days hit · Rest days protected
          </p>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-slate-300">{best} days</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Best Streak</div>
      </div>
    </div>
  );
}

// ── Gentle Weekly Review Card ──────────────────────────────────────────────────
function WeeklyReviewCard({
  review,
}: {
  review: {
    period_label: string;
    workouts_completed: number;
    workouts_planned: number;
    days_hit_protein: number;
    weight_change_kg: number;
    highlights: string[];
    suggested_adjustment: string;
  };
}) {
  return (
    <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            Weekly Review ({review.period_label})
          </h3>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
          {review.workouts_completed}/{review.workouts_planned} sessions
        </span>
      </div>

      <div className="space-y-1.5">
        {review.highlights.map((h, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>{h}</span>
          </div>
        ))}
      </div>

      <div className="bg-[#14171E] border border-[#272B36] rounded-lg p-3 text-xs text-slate-400 leading-relaxed">
        <span className="font-semibold text-emerald-400 block mb-0.5">Recommendation:</span>
        {review.suggested_adjustment}
      </div>
    </div>
  );
}

// ── Exercise 1RM Tracker ───────────────────────────────────────────────────────
function ExercisePRTracker({
  exercises,
}: {
  exercises: ExerciseDefinition[];
}) {
  const [selectedExId, setSelectedExId] = useState<string>(exercises[0]?.id || 'barbell_bench_press');
  const [prData, setPrData] = useState<{
    exercise_name: string;
    best_weight_kg: number;
    best_reps: number;
    estimated_1rm_kg: number;
    history: Array<{ date: string; weight_kg: number; reps: number; estimated_1rm_kg: number }>;
  } | null>(null);

  useEffect(() => {
    if (!selectedExId || !window.formaAPI) return;
    window.formaAPI.getExercisePRHistory(selectedExId).then(setPrData);
  }, [selectedExId]);

  return (
    <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Trophy className="w-3.5 h-3.5 text-amber-400" /> Strength & 1RM Progression
        </div>
        <select
          value={selectedExId}
          onChange={(e) => setSelectedExId(e.target.value)}
          className="bg-[#14171E] border border-[#272B36] text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-500/50"
        >
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {prData && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="bg-[#14171E] rounded-lg p-2.5">
              <div className="text-base font-bold text-white">{prData.best_weight_kg} kg</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Heaviest Load</div>
            </div>
            <div className="bg-[#14171E] rounded-lg p-2.5">
              <div className="text-base font-bold text-white">{prData.best_reps}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Most Reps</div>
            </div>
            <div className="bg-[#14171E] rounded-lg p-2.5">
              <div className="text-base font-bold text-amber-400">{prData.estimated_1rm_kg} kg</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Est. 1RM (Epley)</div>
            </div>
          </div>

          {prData.history.length >= 2 ? (
            <div className="pt-2">
              <div className="text-[11px] text-slate-500 mb-1">1RM History Trend:</div>
              <div className="flex items-end gap-1.5 h-14 bg-[#14171E] rounded-lg p-2">
                {prData.history.slice(-10).map((h, i) => {
                  const max = Math.max(...prData.history.map((x) => x.estimated_1rm_kg), 1);
                  const hPct = Math.max(15, (h.estimated_1rm_kg / max) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full bg-amber-500/30 group-hover:bg-amber-400 rounded-sm transition"
                        style={{ height: `${hPct}%` }}
                      />
                      <span className="text-[9px] text-slate-500">{h.estimated_1rm_kg}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-2 text-slate-600 text-xs">
              Log sets across multiple sessions to see your strength curve.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Weekly Muscle Volume Bars ──────────────────────────────────────────────────
function MuscleVolumeSection({
  volumes,
}: {
  volumes: Array<{ muscle: string; completed_sets: number; target_sets: number }>;
}) {
  if (volumes.length === 0) return null;

  return (
    <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-blue-400" /> Weekly Sets Per Muscle Group
        </h3>
        <span className="text-[11px] text-slate-500">Target hard sets/wk</span>
      </div>
      <div className="space-y-2">
        {volumes.map((v) => {
          const pct = Math.min(100, Math.round((v.completed_sets / Math.max(v.target_sets, 1)) * 100));
          const isComplete = v.completed_sets >= v.target_sets;
          return (
            <div key={v.muscle} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 capitalize font-medium">{v.muscle}</span>
                <span className={isComplete ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                  {v.completed_sets} / {v.target_sets} sets ({pct}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#14171E] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isComplete ? 'bg-emerald-400' : 'bg-blue-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Weight Sparkline ──────────────────────────────────────────────────────────
function WeightChart({ data }: { data: Array<{ date: string; weight_kg: number }> }) {
  if (data.length < 2) {
    return (
      <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-6 text-center text-slate-600 text-sm">
        Log at least 2 weigh-ins to see your trend.
      </div>
    );
  }

  const vals = data.map((d) => d.weight_kg);
  const min = Math.min(...vals) - 1;
  const max = Math.max(...vals) + 1;
  const W = 400;
  const H = 80;

  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.weight_kg - min) / (max - min)) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const first = data[0];
  const last = data[data.length - 1];
  const delta = last.weight_kg - first.weight_kg;
  const isUp = delta > 0.1;
  const isDown = delta < -0.1;

  return (
    <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Scale className="w-3.5 h-3.5" /> Weight History
        </h3>
        <div className={`flex items-center gap-1 text-sm font-bold
          ${isUp ? 'text-red-400' : isDown ? 'text-emerald-400' : 'text-slate-400'}`}>
          {isUp ? <TrendingUp className="w-4 h-4" /> : isDown ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
          {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
        <polyline
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pts.join(' ')}
        />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * W;
          const y = H - ((d.weight_kg - min) / (max - min)) * H;
          return <circle key={i} cx={x} cy={y} r="3" fill="#10b981" />;
        })}
        <text x="4" y={H - ((first.weight_kg - min) / (max - min)) * H - 8}
          fill="#6b7280" fontSize="10">{first.weight_kg}kg</text>
        <text x={W - 4} y={H - ((last.weight_kg - min) / (max - min)) * H - 8}
          fill="#d1fae5" fontSize="10" textAnchor="end">{last.weight_kg}kg</text>
      </svg>
      <div className="flex justify-between text-[10px] text-slate-600 mt-1">
        <span>{first.date}</span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}

// ── Volume Chart ──────────────────────────────────────────────────────────────
function VolumeChart({ workouts }: { workouts: WorkoutRow[] }) {
  if (workouts.length < 2) return null;

  const data = [...workouts].reverse().slice(-12);
  const maxVol = Math.max(...data.map((w) => w.total_volume), 1);
  const W = 400;
  const H = 60;

  return (
    <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <BarChart2 className="w-3.5 h-3.5" /> Volume Trend (last {data.length} sessions)
      </h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
        {data.map((w, i) => {
          const barW = (W / data.length) - 4;
          const x = i * (W / data.length) + 2;
          const barH = (w.total_volume / maxVol) * H;
          const y = H - barH;
          const cls = FOCUS_COLORS[w.focus]?.split(' ')[0] ?? 'text-slate-400';
          const fill = cls.includes('blue') ? '#3b82f6'
            : cls.includes('purple') ? '#a855f7'
            : cls.includes('emerald') ? '#10b981'
            : cls.includes('amber') ? '#f59e0b'
            : '#64748b';
          return (
            <rect
              key={w.id}
              x={x} y={y}
              width={barW} height={barH}
              fill={fill}
              opacity="0.7"
              rx="2"
            />
          );
        })}
      </svg>
    </div>
  );
}

// ── Main ProgressScreen ───────────────────────────────────────────────────────
export default function ProgressScreen() {
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [weightHistory, setWeightHistory] = useState<Array<{ date: string; weight_kg: number }>>([]);
  const [exercises, setExercises] = useState<ExerciseDefinition[]>([]);
  const [streak, setStreak] = useState<{ current_streak: number; best_streak: number }>({ current_streak: 0, best_streak: 0 });
  const [weeklyReview, setWeeklyReview] = useState<any | null>(null);
  const [volumes, setVolumes] = useState<Array<{ muscle: string; completed_sets: number; target_sets: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutRow | null>(null);

  const loadData = useCallback(async () => {
    if (!window.formaAPI) return;
    try {
      const [ws, wh, ex, strk, review, vol] = await Promise.all([
        window.formaAPI.getRecentWorkouts(30),
        window.formaAPI.getWeightHistory(60),
        window.formaAPI.listExercises(),
        window.formaAPI.getStreak(),
        window.formaAPI.getWeeklyReview(),
        window.formaAPI.getWeeklyMuscleVolume(),
      ]);
      setWorkouts(ws);
      setWeightHistory(wh);
      setExercises(ex);
      setStreak(strk);
      setWeeklyReview(review);
      setVolumes(vol);
    } catch (err) {
      console.error('Failed to load progress data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const completed = workouts.filter((w) => w.status === 'completed');

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Progress & Analytics</h2>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading analytics…</div>
      ) : (
        <>
          {/* Streak Banner */}
          <StreakBanner current={streak.current_streak} best={streak.best_streak} />

          {/* Gentle Weekly Review */}
          {weeklyReview && <WeeklyReviewCard review={weeklyReview} />}

          {/* Summary Stats */}
          {completed.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Sessions', value: `${completed.length}` },
                {
                  label: 'Avg Volume',
                  value: `${Math.round(
                    completed.reduce((s, w) => s + w.total_volume, 0) / completed.length
                  ).toLocaleString()} kg`,
                },
                {
                  label: 'Avg Sets',
                  value: `${Math.round(
                    completed.reduce((s, w) => s + w.total_sets, 0) / completed.length
                  )}`,
                },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{value}</div>
                  <div className="text-[11px] text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Strength & 1RM Progression Tracker */}
          {exercises.length > 0 && <ExercisePRTracker exercises={exercises} />}

          {/* Weekly Sets Per Muscle Group */}
          <MuscleVolumeSection volumes={volumes} />

          {/* Volume Chart */}
          <VolumeChart workouts={completed} />

          {/* Weight Chart */}
          <WeightChart data={weightHistory} />

          {/* Workout History */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Workout History ({completed.length})
            </h3>
            {completed.length === 0 ? (
              <div className="text-center py-12 text-slate-600 text-sm">
                No completed workouts yet. Start your first session!
              </div>
            ) : (
              <div className="space-y-3">
                {completed.map((w) => (
                  <WorkoutCard key={w.id} workout={w} onEdit={(wk) => setEditingWorkout(wk)} />
                ))}
              </div>
            )}
          </div>

          <div className="pb-6" />

          {/* Edit Workout Modal */}
          {editingWorkout && (
            <EditWorkoutModal
              workout={editingWorkout}
              exercises={exercises}
              onClose={() => setEditingWorkout(null)}
              onUpdated={loadData}
            />
          )}
        </>
      )}
    </div>
  );
}

