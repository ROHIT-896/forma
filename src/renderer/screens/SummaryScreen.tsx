import React from 'react';
import {
  Trophy, Dumbbell, Clock, Zap, TrendingUp, ChevronUp, ChevronDown,
  Minus, BarChart2, RotateCcw, Star,
} from 'lucide-react';
import type { WorkoutSummary } from '../../engine/types';

interface SummaryScreenProps {
  summary: WorkoutSummary;
  onDone: () => void;
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4 flex flex-col items-center justify-center gap-1 text-center">
      <div className="text-slate-400 mb-1">{icon}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function ProgressionCard({ item }: { item: WorkoutSummary['progression_updates'][number] }) {
  const diff = item.next_weight_kg - item.previous_weight_kg;
  const isUp = diff > 0;
  const isDown = diff < 0;

  return (
    <div className="flex items-start gap-3 bg-[#1A1D25] border border-[#272B36] rounded-xl p-4">
      <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
        ${isUp ? 'bg-emerald-500/15 text-emerald-400' : isDown ? 'bg-red-500/15 text-red-400' : 'bg-slate-700/50 text-slate-400'}`}>
        {isUp ? <ChevronUp className="w-4 h-4" /> : isDown ? <ChevronDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-sm text-white truncate">{item.exercise_name}</span>
          <span className={`text-sm font-bold flex-shrink-0
            ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-slate-400'}`}>
            {isUp ? '+' : ''}{diff.toFixed(1)} kg
          </span>
        </div>
        <div className="text-[12px] text-slate-500 mt-1">
          {item.previous_weight_kg}kg → {item.next_weight_kg}kg
        </div>
        <div className="text-[12px] text-slate-400 mt-1 leading-relaxed">{item.reason}</div>
      </div>
    </div>
  );
}

export default function SummaryScreen({ summary, onDone }: SummaryScreenProps) {
  const restEfficiency = summary.planned_rest_sec > 0
    ? Math.round((summary.avg_rest_sec / summary.planned_rest_sec) * 100)
    : 100;

  const restColor = restEfficiency <= 110
    ? 'text-emerald-400'
    : restEfficiency <= 130
    ? 'text-amber-400'
    : 'text-red-400';

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-emerald-950/60 to-[#14171E] border-b border-[#272B36] px-6 py-8 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-7 h-7 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">Workout Complete</h2>
        <p className="text-slate-400 text-sm mt-1">{summary.focus} Session</p>
        {summary.pr_count > 0 && (
          <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <Star className="w-3.5 h-3.5" />
            {summary.pr_count} Personal Record{summary.pr_count > 1 ? 's' : ''} Today!
          </div>
        )}
      </div>

      <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<BarChart2 className="w-5 h-5" />}
            label="Volume"
            value={`${Math.round(summary.total_volume_kg).toLocaleString()} kg`}
            sub="total load"
          />
          <StatCard
            icon={<Dumbbell className="w-5 h-5" />}
            label="Sets"
            value={`${summary.total_sets}`}
            sub="working sets"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Duration"
            value={`${summary.completed_duration_min}m`}
            sub={`planned ${summary.planned_duration_min}m`}
          />
          <StatCard
            icon={<Zap className="w-5 h-5" />}
            label="Avg Rest"
            value={`${Math.round(summary.avg_rest_sec)}s`}
            sub={<span className={restColor}>{restEfficiency}% of plan</span> as unknown as string}
          />
        </div>

        {/* Rest Insights */}
        {summary.rest_insights.length > 0 && (
          <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Rest Insights
            </h3>
            <ul className="space-y-2">
              {summary.rest_insights.map((insight, i) => (
                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Progression Cards */}
        {summary.progression_updates.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Next Session Targets
            </h3>
            <div className="space-y-3">
              {summary.progression_updates.map((item) => (
                <ProgressionCard key={item.exercise_id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-3 pt-2 pb-6">
          <button
            onClick={onDone}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black font-bold text-sm transition shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            Done
          </button>
          <button
            onClick={onDone}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#1A1D25] border border-[#272B36] hover:border-slate-600 text-slate-400 text-sm transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
