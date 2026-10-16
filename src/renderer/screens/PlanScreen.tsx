import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  RefreshCw, Check, AlertCircle, Scale, Dumbbell, Leaf, Egg, Drumstick,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { YourPlan, PlanDiffItem, ProteinPlanItem, MealType } from '../../engine/types';

const GOAL_LABEL: Record<string, string> = {
  gain_muscle: 'Build Muscle',
  lose_fat: 'Lose Fat',
  maintain: 'Maintain',
};
const DIET_LABEL: Record<string, string> = {
  veg: 'Vegetarian',
  eggetarian: 'Eggetarian',
  non_veg: 'Non-Veg',
};
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
  extra: 'Extra',
};
const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snacks', 'dinner', 'extra'];

function DietIcon({ type }: { type: string }) {
  if (type === 'veg') return <Leaf className="w-3.5 h-3.5 text-emerald-400" />;
  if (type === 'eggetarian') return <Egg className="w-3.5 h-3.5 text-amber-400" />;
  return <Drumstick className="w-3.5 h-3.5 text-orange-400" />;
}

// ─── Plan Update Preview Modal ───────────────────────────────────────────────
function PlanUpdateModal({
  onClose,
  onAccept,
}: {
  onClose: () => void;
  onAccept: (plan: YourPlan) => void;
}) {
  const [preview, setPreview] = useState<{
    currentPlan: YourPlan | null;
    nextPlan: YourPlan;
    diffs: PlanDiffItem[];
    suggestedCaloriesDelta: number;
    weightTrendReason: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    window.formaAPI?.previewPlanUpdate().then((result) => {
      setPreview(result);
      setLoading(false);
    }).catch((e) => {
      console.error('previewPlanUpdate failed:', e);
      setLoading(false);
    });
  }, []);

  const handleAccept = async () => {
    if (!preview) return;
    setAccepting(true);
    try {
      await window.formaAPI?.acceptPlanUpdate(preview.nextPlan);
      onAccept(preview.nextPlan);
    } catch (e) {
      console.error('acceptPlanUpdate failed:', e);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#14171E] border border-[#272B36] rounded-2xl p-5 space-y-4 max-h-[80vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white">Plan Update Preview</h3>
        </div>

        {loading && <div className="text-center py-8 text-slate-500 text-sm">Analysing your progress…</div>}

        {!loading && preview && (
          <>
            <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-3 text-sm text-slate-400">
              {preview.weightTrendReason}
              {preview.suggestedCaloriesDelta !== 0 && (
                <span className={`ml-2 font-semibold ${preview.suggestedCaloriesDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ({preview.suggestedCaloriesDelta > 0 ? '+' : ''}{preview.suggestedCaloriesDelta} kcal/day)
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {preview.diffs.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  Your plan is already optimized!
                </div>
              ) : (
                preview.diffs.map((d, i) => (
                  <div key={i} className="bg-[#1A1D25] border border-[#272B36] rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-medium text-slate-300">{d.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                        ${d.category === 'diet' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                        {d.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-500 line-through">{d.from}</span>
                      <span className="text-slate-600">→</span>
                      <span className="text-white font-medium">{d.to}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{d.reason}</div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-3 pt-2 border-t border-[#272B36]">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-[#272B36] text-slate-400 text-sm font-medium cursor-pointer hover:bg-[#31363F] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm cursor-pointer transition disabled:opacity-60"
              >
                {accepting ? 'Applying…' : 'Accept Update'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Protein Plan Row ────────────────────────────────────────────────────────
function ProteinRow({ item }: { item: ProteinPlanItem }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-[#1F222B] last:border-0">
      <div className="min-w-0">
        <div className="text-sm text-white">{item.food_name}</div>
        <div className="text-[11px] text-slate-500">
          {item.portion_qty} {item.portion_unit}
          {item.note && ` · ${item.note}`}
        </div>
        {item.is_mess_item && item.mess_serving_definition && (
          <div className="text-[10px] text-slate-600 mt-0.5">{item.mess_serving_definition}</div>
        )}
      </div>
      <div className="text-right ml-3 flex-shrink-0">
        <div className="text-sm font-semibold text-white">{item.protein_g}g</div>
        <div className="text-[11px] text-slate-500">{item.calories} kcal</div>
      </div>
    </div>
  );
}

// ─── Override Inputs ─────────────────────────────────────────────────────────
function OverridesSection({ plan }: { plan: YourPlan }) {
  const [calOverride, setCalOverride] = useState(
    plan.diet.overrides?.calorie_target?.toString() ?? ''
  );
  const [proOverride, setProOverride] = useState(
    plan.diet.overrides?.protein_target_g?.toString() ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!window.formaAPI) return;
    setSaving(true);
    const overrides = {
      calorie_target: calOverride ? parseInt(calOverride) : undefined,
      protein_target_g: proOverride ? parseInt(proOverride) : undefined,
    };
    const hasOverrides = overrides.calorie_target || overrides.protein_target_g;
    await window.formaAPI.setPlanOverrides(hasOverrides ? overrides : null);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    if (!window.formaAPI) return;
    setCalOverride('');
    setProOverride('');
    await window.formaAPI.setPlanOverrides(null);
  };

  return (
    <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5" /> Manual Overrides
      </h3>
      <p className="text-xs text-slate-500 mb-4">Override computed targets (leave blank to use plan defaults).</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-[11px] text-slate-500 mb-1.5">Calories (kcal)</label>
          <input
            type="number"
            value={calOverride}
            onChange={(e) => setCalOverride(e.target.value)}
            placeholder={`${plan.diet.calorie_target}`}
            className="w-full px-3 py-2 bg-[#14171E] border border-[#272B36] rounded-lg text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500/50"
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1.5">Protein (g)</label>
          <input
            type="number"
            value={proOverride}
            onChange={(e) => setProOverride(e.target.value)}
            placeholder={`${plan.diet.protein_target_g}`}
            className="w-full px-3 py-2 bg-[#14171E] border border-[#272B36] rounded-lg text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm cursor-pointer transition disabled:opacity-60"
        >
          {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? 'Saving…' : 'Apply Overrides'}
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-2 rounded-lg bg-[#272B36] text-slate-400 hover:bg-[#31363F] text-sm cursor-pointer transition"
          title="Reset to computed defaults"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main PlanScreen ──────────────────────────────────────────────────────────
export default function PlanScreen() {
  const { plan, planOutdated, refreshPlan } = useAppStore();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [expandProtein, setExpandProtein] = useState(false);

  if (!plan) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6">
        <div>
          <Scale className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No plan yet. Complete onboarding to generate your plan.</p>
        </div>
      </div>
    );
  }

  const { diet, workout, profile } = plan;

  // Group protein plan by meal
  const byMeal: Record<MealType, ProteinPlanItem[]> = {
    breakfast: [], lunch: [], snacks: [], dinner: [], extra: [],
  };
  diet.protein_plan.forEach((item) => {
    byMeal[item.meal_type]?.push(item);
  });

  const handleAccept = async (newPlan: YourPlan) => {
    setShowUpdateModal(false);
    await refreshPlan();
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Plan Outdated Banner */}
      {planOutdated && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Your profile changed. Review updated plan targets.</span>
          </div>
          <button
            onClick={() => setShowUpdateModal(true)}
            className="text-xs font-bold text-amber-400 border border-amber-500/40 px-3 py-1 rounded-full hover:bg-amber-500/15 cursor-pointer transition"
          >
            Review
          </button>
        </div>
      )}

      <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto">
        {/* Profile Summary */}
        <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Profile</h3>
            <span className="text-[11px] text-slate-600">Updated {plan.updated_at?.slice(0, 10)}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-white">{profile.weight_kg}kg</div>
              <div className="text-[11px] text-slate-500">Weight</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">{GOAL_LABEL[profile.goal]}</div>
              <div className="text-[11px] text-slate-500">Goal</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-white">
                <DietIcon type={profile.dietary_type} />
                {DIET_LABEL[profile.dietary_type]}
              </div>
              <div className="text-[11px] text-slate-500">Diet</div>
            </div>
          </div>
        </div>

        {/* Diet Targets */}
        <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Diet Targets</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { label: 'Calories', value: `${diet.effective_calorie_target} kcal`, sub: diet.overrides?.calorie_target ? 'overridden' : 'computed' },
              { label: 'Protein', value: `${diet.effective_protein_target_g}g`, sub: diet.overrides?.protein_target_g ? 'overridden' : 'computed' },
              { label: 'BMR', value: `${Math.round(diet.bmr)} kcal` },
              { label: 'Maintenance', value: `${Math.round(diet.maintenance_calories)} kcal` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-[#14171E] rounded-lg p-3">
                <div className="text-sm font-bold text-white">{value}</div>
                <div className="text-[11px] text-slate-500">{label}{sub ? ` · ${sub}` : ''}</div>
              </div>
            ))}
          </div>
          {diet.formula_breakdown && (
            <p className="text-[11px] text-slate-600 bg-[#14171E] rounded-lg p-2">{diet.formula_breakdown}</p>
          )}
        </div>

        {/* Protein Meal Plan */}
        <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandProtein(!expandProtein)}
            className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Protein Plan</span>
              <span className="text-xs text-slate-500">
                {Math.round(diet.total_planned_protein_g)}g · {Math.round(diet.total_planned_calories)} kcal
              </span>
            </div>
            {expandProtein ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {expandProtein && (
            <div className="border-t border-[#272B36] px-4">
              {MEAL_ORDER.map((mt) =>
                byMeal[mt].length > 0 ? (
                  <div key={mt} className="py-2">
                    <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">{MEAL_LABELS[mt]}</p>
                    {byMeal[mt].map((item, i) => <ProteinRow key={i} item={item} />)}
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>

        {/* Workout Split */}
        <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {workout.split_type} · {workout.days_per_week}×/week
            </h3>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-3">
            {workout.weekly_schedule.map((day) => (
              <div
                key={day.day}
                className={`flex flex-col items-center p-1.5 rounded-lg text-center
                  ${day.is_rest ? 'bg-[#14171E] text-slate-600' : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'}`}
              >
                <div className="text-[10px] font-bold">{day.day_name.slice(0, 1)}</div>
                <div className="text-[9px] mt-0.5 truncate w-full text-center">{day.is_rest ? 'Rest' : day.focus.split(' ')[0]}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">{workout.why}</p>
        </div>

        {/* Manual Overrides */}
        <OverridesSection plan={plan} />

        {/* Update Plan CTA */}
        <button
          onClick={() => setShowUpdateModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A1D25] border border-[#272B36] hover:border-emerald-500/40 text-sm text-slate-300 font-medium cursor-pointer transition"
        >
          <RefreshCw className="w-4 h-4" />
          Preview Plan Update
        </button>

        <div className="pb-6" />
      </div>

      {showUpdateModal && (
        <PlanUpdateModal
          onClose={() => setShowUpdateModal(false)}
          onAccept={handleAccept}
        />
      )}
    </div>
  );
}
