import React, { useEffect, useState } from 'react';
import {
  Dumbbell, Clock, BarChart2, Scale, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import type { WorkoutRow } from '../../main/workoutRepo';

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

function WorkoutCard({ workout }: { workout: WorkoutRow }) {
  const date = new Date(workout.date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{date}</span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${focusClass(workout.focus)}`}>
          {workout.focus}
        </span>
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
        <div className="text-[11px] text-slate-600">
          Avg rest: {Math.round(workout.avg_rest_sec)}s
        </div>
      )}
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
        {/* First & last labels */}
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!window.formaAPI) return;
      const [ws, wh] = await Promise.all([
        window.formaAPI.getRecentWorkouts(30),
        window.formaAPI.getWeightHistory(60),
      ]);
      setWorkouts(ws);
      setWeightHistory(wh);
      setLoading(false);
    })();
  }, []);

  const completed = workouts.filter((w) => w.status === 'completed');

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-white">Progress</h2>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading history…</div>
      ) : (
        <>
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
                  <WorkoutCard key={w.id} workout={w} />
                ))}
              </div>
            )}
          </div>

          <div className="pb-6" />
        </>
      )}
    </div>
  );
}
