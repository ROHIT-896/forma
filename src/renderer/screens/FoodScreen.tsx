import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, X, Repeat2, ChevronDown, ChevronUp,
  Droplets, DropletIcon, Scale, Check, Trash2, BookmarkCheck,
  Utensils, Sparkles, Flame,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { FoodDefinition, MealType, DietaryType } from '../../engine/types';
import type { FoodLogRow } from '../../main/dietRepo';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
  extra: 'Extra',
};

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snacks', 'dinner', 'extra'];

// ─── Macro Ring SVG ────────────────────────────────────────────────────────────
function Ring({
  value,
  max,
  color,
  label,
  sublabel,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  sublabel: string;
}) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / Math.max(max, 1), 1);
  const dashOffset = circ * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r={r} fill="none" stroke="#1F222B" strokeWidth="8" />
          <circle
            cx="45" cy="45" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-white leading-none">{Math.round(value)}</span>
          <span className="text-[10px] text-slate-500 leading-none mt-0.5">/ {Math.round(max)}</span>
        </div>
      </div>
      <div className="text-xs font-semibold text-white">{label}</div>
      <div className="text-[11px] text-slate-500">{sublabel}</div>
    </div>
  );
}

// ─── Add Food Modal ─────────────────────────────────────────────────────────────
function AddFoodModal({
  onClose,
  defaultMealType,
  initialTab = 'catalog',
}: {
  onClose: () => void;
  defaultMealType: MealType;
  initialTab?: 'catalog' | 'custom';
}) {
  const { refreshTodayDiet, selectedDate } = useAppStore();
  const [tab, setTab] = useState<'catalog' | 'custom'>(initialTab);
  const [foods, setFoods] = useState<FoodDefinition[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoodDefinition | null>(null);
  const [mealType, setMealType] = useState<MealType>(defaultMealType);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  // Custom / Outside Food State
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState<number>(1);
  const [customUnit, setCustomUnit] = useState('serving');
  const [customCals, setCustomCals] = useState<number>(350);
  const [customProtein, setCustomProtein] = useState<number>(18);
  const [customDietary, setCustomDietary] = useState<DietaryType>('non_veg');
  const [saveToLibrary, setSaveToLibrary] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.formaAPI?.listFoods().then(setFoods);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const filtered = foods.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 35);

  const handleAddCatalog = async () => {
    if (!selected || !window.formaAPI) return;
    setAdding(true);
    const dateStr = selectedDate || new Date().toISOString().slice(0, 10);
    try {
      await window.formaAPI.logFood({
        date: dateStr,
        meal_type: mealType,
        food_id: selected.id,
        portion_quantity: qty,
      });
      await refreshTodayDiet();
      onClose();
    } catch (e) {
      console.error('logFood error:', e);
    } finally {
      setAdding(false);
    }
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !window.formaAPI) return;
    setAdding(true);
    const dateStr = selectedDate || new Date().toISOString().slice(0, 10);
    const safeQty = Math.max(0.1, Number(customQty) || 1);
    const safeCals = Math.max(0, Number(customCals) || 0);
    const safePro = Math.max(0, Number(customProtein) || 0);

    try {
      // Upsert into foods so it's queryable and logged with full nutrition
      const newFood = await window.formaAPI.upsertFood({
        name: customName.trim(),
        category: 'Outside / Custom',
        dietary_type: customDietary,
        default_portion_unit: customUnit,
        portion_description: `${safeQty} ${customUnit}`,
        estimated_calories: safeCals / safeQty,
        estimated_protein: safePro / safeQty,
        is_mess_item: false,
        assumption_note: 'User-entered outside/custom meal.',
      });

      // Log this food entry
      await window.formaAPI.logFood({
        date: dateStr,
        meal_type: mealType,
        food_id: newFood.id,
        portion_quantity: safeQty,
        portion_unit: customUnit,
      });

      await refreshTodayDiet();
      onClose();
    } catch (err) {
      console.error('Failed to log outside food:', err);
      alert('Failed to log custom meal. Please check inputs.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#14171E] border border-[#272B36] rounded-2xl p-5 space-y-4 max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Mode Tabs */}
        <div className="flex items-center justify-between border-b border-[#272B36] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('catalog')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                tab === 'catalog'
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                  : 'bg-[#1A1D25] text-slate-400 hover:text-white border border-[#272B36]'
              }`}
            >
              Mess & Catalog Foods
            </button>
            <button
              onClick={() => setTab('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                tab === 'custom'
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                  : 'bg-[#1A1D25] text-slate-400 hover:text-white border border-[#272B36]'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" /> Outside / Custom Meal
            </button>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meal Slot Picker (applies to both modes) */}
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
            Log to Meal Slot
          </label>
          <div className="flex gap-2 flex-wrap">
            {MEAL_ORDER.map((mt) => (
              <button
                key={mt}
                type="button"
                onClick={() => setMealType(mt)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer
                  ${mealType === mt
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[#1A1D25] border border-[#272B36] text-slate-400 hover:bg-[#272B36]'}`}
              >
                {MEAL_LABELS[mt]}
              </button>
            ))}
          </div>
        </div>

        {tab === 'catalog' ? (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 130+ mess foods & saved items…"
                className="w-full pl-9 pr-4 py-2 bg-[#1A1D25] border border-[#272B36] rounded-xl text-xs text-white placeholder-slate-600 outline-none focus:border-[var(--accent-primary)] transition"
              />
            </div>

            {/* Food List */}
            <div className="flex-1 overflow-y-auto space-y-1 min-h-[200px] max-h-[300px]">
              {filtered.length === 0 ? (
                <div className="text-center py-6 px-4 space-y-3">
                  <div className="text-xs text-slate-500">No matching food found in mess catalog.</div>
                  <button
                    onClick={() => {
                      setCustomName(query);
                      setTab('custom');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent-bg)] border border-[var(--accent-border)] text-xs text-[var(--accent-primary)] font-semibold transition hover:opacity-90 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log &ldquo;{query || 'Outside Meal'}&rdquo; as Custom Food
                  </button>
                </div>
              ) : (
                <>
                  {filtered.map((food) => (
                    <button
                      key={food.id}
                      onClick={() => setSelected(food === selected ? null : food)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition cursor-pointer
                        ${selected?.id === food.id
                          ? 'bg-[var(--accent-bg)] border border-[var(--accent-border)]'
                          : 'hover:bg-[#1F222B] border border-transparent'}`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                          {food.name}
                          {food.is_mess_item && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              Mess
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {food.portion_description} · {food.estimated_calories} kcal · {food.estimated_protein}g protein
                        </div>
                      </div>
                      {selected?.id === food.id && <Check className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0 ml-2" />}
                    </button>
                  ))}

                  {/* Option to type custom at bottom of search list */}
                  <div className="pt-2 text-center">
                    <button
                      onClick={() => {
                        setCustomName(query);
                        setTab('custom');
                      }}
                      className="text-[11px] text-slate-400 hover:text-[var(--accent-primary)] transition cursor-pointer flex items-center justify-center gap-1 mx-auto py-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Can&apos;t find it? Type outside meal with custom grams & macros
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Quantity + Add */}
            {selected && (
              <div className="flex items-center gap-3 pt-3 border-t border-[#272B36]">
                <div className="flex items-center gap-2 bg-[#1A1D25] border border-[#272B36] rounded-xl px-2.5 py-1.5">
                  <button onClick={() => setQty(Math.max(0.5, qty - 0.5))} className="text-slate-400 hover:text-white cursor-pointer px-1">−</button>
                  <span className="text-xs font-medium text-white w-6 text-center">{qty}</span>
                  <button onClick={() => setQty(qty + 0.5)} className="text-slate-400 hover:text-white cursor-pointer px-1">+</button>
                </div>
                <span className="text-xs text-slate-400 flex-1 truncate">
                  {selected.portion_description} × {qty} = ~{Math.round(selected.estimated_calories * qty)} kcal ({Math.round(selected.estimated_protein * qty)}g pro)
                </span>
                <button
                  onClick={handleAddCatalog}
                  disabled={adding}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 active:scale-95 text-white font-bold text-xs transition cursor-pointer disabled:opacity-60 shadow-sm"
                >
                  {adding ? '…' : <><Plus className="w-4 h-4" /> Add Food</>}
                </button>
              </div>
            )}
          </>
        ) : (
          /* Custom / Outside Food Form */
          <form onSubmit={handleAddCustom} className="space-y-3.5 overflow-y-auto pr-1">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Meal / Food Name
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., Chicken Shawarma, Zomato Biryani, Pizza, Subway"
                className="w-full px-3 py-2 bg-[#1A1D25] border border-[#272B36] rounded-xl text-xs text-white placeholder-slate-600 outline-none focus:border-[var(--accent-primary)]"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Portion Quantity
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={customQty}
                  onChange={(e) => setCustomQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#1A1D25] border border-[#272B36] rounded-xl text-xs text-white outline-none focus:border-[var(--accent-primary)]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Portion Unit
                </label>
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1A1D25] border border-[#272B36] rounded-xl text-xs text-white outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="grams (g)">grams (g)</option>
                  <option value="serving">serving</option>
                  <option value="plate">plate</option>
                  <option value="piece">piece</option>
                  <option value="bowl">bowl</option>
                  <option value="ml">ml</option>
                  <option value="slice">slice</option>
                  <option value="roll">roll</option>
                  <option value="scoop">scoop</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Calories (kcal)
                </label>
                <input
                  type="number"
                  min="0"
                  value={customCals}
                  onChange={(e) => setCustomCals(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#1A1D25] border border-[#272B36] rounded-xl text-xs text-white outline-none focus:border-[var(--accent-primary)]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Protein (grams)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={customProtein}
                  onChange={(e) => setCustomProtein(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#1A1D25] border border-[#272B36] rounded-xl text-xs text-white outline-none focus:border-[var(--accent-primary)]"
                  required
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[var(--accent-primary)]" /> Quick Realistic Presets
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setCustomCals(420);
                    setCustomProtein(28);
                    setCustomDietary('non_veg');
                  }}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-[#1A1D25] hover:bg-[#222631] border border-[#272B36] text-slate-300"
                >
                  🍗 High Protein Meal <span className="text-[10px] text-slate-500 block">420 kcal · 28g pro</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomCals(580);
                    setCustomProtein(18);
                    setCustomDietary('veg');
                  }}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-[#1A1D25] hover:bg-[#222631] border border-[#272B36] text-slate-300"
                >
                  🍕 Fast Food / Cheat <span className="text-[10px] text-slate-500 block">580 kcal · 18g pro</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomCals(220);
                    setCustomProtein(8);
                    setCustomDietary('veg');
                  }}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-[#1A1D25] hover:bg-[#222631] border border-[#272B36] text-slate-300"
                >
                  🥪 Light Snack / Roll <span className="text-[10px] text-slate-500 block">220 kcal · 8g pro</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomCals(180);
                    setCustomProtein(25);
                    setCustomDietary('veg');
                  }}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-[#1A1D25] hover:bg-[#222631] border border-[#272B36] text-slate-300"
                >
                  🥤 Shake / Protein Drink <span className="text-[10px] text-slate-500 block">180 kcal · 25g pro</span>
                </button>
              </div>
            </div>

            {/* Dietary Type */}
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Dietary Type
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'veg' as DietaryType, label: 'Vegetarian' },
                  { id: 'egg' as DietaryType, label: 'Egg' },
                  { id: 'non_veg' as DietaryType, label: 'Non-Veg' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setCustomDietary(d.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      customDietary === d.id
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-bg)] text-white'
                        : 'border-[#272B36] bg-[#1A1D25] text-slate-400 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[#272B36] flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToLibrary}
                  onChange={(e) => setSaveToLibrary(e.target.checked)}
                  className="rounded accent-[var(--accent-primary)]"
                />
                Save to My Foods list
              </label>

              <button
                type="submit"
                disabled={adding || !customName.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 active:scale-95 text-white font-bold text-xs transition cursor-pointer disabled:opacity-60 shadow-sm"
              >
                {adding ? 'Logging…' : <><Plus className="w-4 h-4" /> Log Outside Meal</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Meal Section ───────────────────────────────────────────────────────────────
function MealSection({
  mealType,
  items,
  onAddFood,
  onAddCustomFood,
  onRepeatYesterday,
  onDelete,
}: {
  mealType: MealType;
  items: FoodLogRow[];
  onAddFood: (meal: MealType) => void;
  onAddCustomFood: (meal: MealType) => void;
  onRepeatYesterday: (meal: MealType) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(mealType === 'breakfast' || mealType === 'lunch');
  const totalCal = items.reduce((s, i) => s + i.calories, 0);
  const totalPro = items.reduce((s, i) => s + i.protein, 0);

  return (
    <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">{MEAL_LABELS[mealType]}</span>
          {items.length > 0 && (
            <span className="text-xs text-slate-500">{Math.round(totalCal)} kcal · {Math.round(totalPro)}g pro</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <button
            onClick={(e) => { e.stopPropagation(); onRepeatYesterday(mealType); }}
            className="p-1 rounded hover:text-emerald-400 transition cursor-pointer"
            title="Repeat yesterday's meal"
          >
            <Repeat2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAddCustomFood(mealType); }}
            className="p-1 rounded hover:text-amber-400 transition cursor-pointer"
            title="Log outside / custom food"
          >
            <Utensils className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAddFood(mealType); }}
            className="p-1 rounded hover:text-emerald-400 transition cursor-pointer"
            title="Add from mess food catalog"
          >
            <Plus className="w-4 h-4" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#272B36]">
          {items.length === 0 ? (
            <div className="flex divide-x divide-[#272B36]">
              <button
                onClick={() => onAddFood(mealType)}
                className="flex-1 py-3.5 text-center text-xs text-slate-500 hover:text-emerald-400 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Mess Catalog
              </button>
              <button
                onClick={() => onAddCustomFood(mealType)}
                className="flex-1 py-3.5 text-center text-xs text-slate-500 hover:text-amber-400 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Utensils className="w-3.5 h-3.5" /> Outside / Custom
              </button>
            </div>
          ) : (
            <div>
              <div className="divide-y divide-[#272B36]">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0 pr-2">
                      <div className="text-sm text-white truncate flex items-center gap-1.5">
                        {item.food_name}
                        {item.is_mess_item ? (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            Mess
                          </span>
                        ) : (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Outside
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.portion_quantity} {item.portion_unit} · {Math.round(item.calories)} kcal · {Math.round(item.protein)}g
                      </div>
                      {item.assumption_note && (
                        <div className="text-[10px] text-amber-600/80 mt-0.5">{item.assumption_note}</div>
                      )}
                    </div>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="ml-3 p-1 text-slate-600 hover:text-red-400 transition cursor-pointer flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex divide-x divide-[#272B36] border-t border-[#272B36] bg-[#14171E]/30">
                <button
                  onClick={() => onAddFood(mealType)}
                  className="flex-1 py-2 text-center text-[11px] text-slate-500 hover:text-white transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Mess Food
                </button>
                <button
                  onClick={() => onAddCustomFood(mealType)}
                  className="flex-1 py-2 text-center text-[11px] text-slate-500 hover:text-white transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Utensils className="w-3 h-3" /> Log Outside Meal
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Weight Sparkline ───────────────────────────────────────────────────────────
function WeightSparkline({ data }: { data: Array<{ date: string; weight_kg: number }> }) {
  if (data.length < 2) return null;
  const vals = data.map((d) => d.weight_kg);
  const min = Math.min(...vals) - 1;
  const max = Math.max(...vals) + 1;
  const W = 300;
  const H = 60;

  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.weight_kg - min) / (max - min)) * H;
    return `${x},${y}`;
  });

  const latest = data[data.length - 1];

  return (
    <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Scale className="w-3.5 h-3.5" /> Weight Trend
        </div>
        <span className="text-sm font-bold text-white">{latest.weight_kg} kg</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
        <polyline
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pts.join(' ')}
        />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * W;
          const y = H - ((d.weight_kg - min) / (max - min)) * H;
          return <circle key={i} cx={x} cy={y} r="2.5" fill="#10b981" />;
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-600 mt-1">
        <span>{data[0].date}</span>
        <span>{latest.date}</span>
      </div>
    </div>
  );
}

// ─── Main FoodScreen ────────────────────────────────────────────────────────────
export default function FoodScreen() {
  const { plan, todayDiet, messMode, refreshTodayDiet, toggleMessMode, logQuickProtein } = useAppStore();
  const [addFoodModal, setAddFoodModal] = useState<{ meal: MealType; tab: 'catalog' | 'custom' } | null>(null);
  const [weightHistory, setWeightHistory] = useState<Array<{ date: string; weight_kg: number }>>([]);
  const [weightInput, setWeightInput] = useState('');
  const [loggingWeight, setLoggingWeight] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    window.formaAPI?.getWeightHistory(28).then(setWeightHistory);
  }, []);

  const handleRepeatYesterday = async (mealType: MealType) => {
    if (!window.formaAPI) return;
    const count = await window.formaAPI.repeatYesterdayMeal(today, mealType);
    if (count > 0) await refreshTodayDiet();
    else alert('No items for that meal yesterday.');
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.formaAPI) return;
    await window.formaAPI.deleteFoodLog(id);
    await refreshTodayDiet();
  };

  const handleLogWeight = async () => {
    const w = parseFloat(weightInput);
    if (isNaN(w) || w < 30 || w > 250) return;
    setLoggingWeight(true);
    await window.formaAPI?.logWeight(today, w);
    setWeightInput('');
    setLoggingWeight(false);
    const hist = await window.formaAPI?.getWeightHistory(28);
    setWeightHistory(hist ?? []);
  };

  const calTarget = plan?.diet.effective_calorie_target ?? 2000;
  const proTarget = plan?.diet.effective_protein_target_g ?? 150;
  const calActual = todayDiet?.totals.calories ?? 0;
  const proActual = todayDiet?.totals.protein ?? 0;
  const waterGlasses = Math.round((todayDiet?.water_ml ?? 0) / 250);
  const waterTarget = 8;

  // Quick protein chips from plan
  const quickChips = (plan?.diet.protein_plan ?? []).filter((pp) => {
    const chipFoods = ['paneer_cottage_cheese', 'egg_boiled', 'chicken_breast_grilled',
      'whey_protein_scoop', 'dal_cooked', 'greek_yogurt', 'curd_dahi'];
    return chipFoods.includes(pp.food_id);
  }).slice(0, 5);

  // Group logs by meal
  const byMeal: Record<MealType, FoodLogRow[]> = {
    breakfast: [],
    lunch: [],
    snacks: [],
    dinner: [],
    extra: [],
  };
  (todayDiet?.logs ?? []).forEach((log) => {
    byMeal[log.meal_type]?.push(log);
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-[#14171E] border-b border-[#272B36] px-5 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h2 className="font-bold text-white">Food Log</h2>
            <p className="text-xs text-slate-500">{today}</p>
          </div>
          {/* Mess Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Mess Mode</span>
            <button
              onClick={toggleMessMode}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer focus:outline-none
                ${messMode ? 'bg-emerald-500' : 'bg-[#272B36]'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                  ${messMode ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto">
        {/* Macro Rings */}
        <div className="flex justify-around">
          <Ring value={calActual} max={calTarget} color="#10b981" label="Calories" sublabel="kcal" />
          <Ring value={proActual} max={proTarget} color="#3b82f6" label="Protein" sublabel="grams" />
          <div className="flex flex-col items-center gap-1">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{waterGlasses}</div>
                <div className="text-[11px] text-slate-500">/ {waterTarget}</div>
              </div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: waterTarget }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-4 rounded-sm ${i < waterGlasses ? 'bg-sky-400' : 'bg-[#272B36]'}`}
                />
              ))}
            </div>
            <div className="text-xs font-semibold text-white">Water</div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => window.formaAPI?.addWater(today, 250).then(() => refreshTodayDiet())}
                className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/15 text-sky-400 border border-sky-500/30 hover:bg-sky-500/25 cursor-pointer"
              >
                + glass
              </button>
              <button
                onClick={() => window.formaAPI?.undoLastWater(today).then(() => refreshTodayDiet())}
                className="px-2 py-0.5 rounded-full text-[10px] bg-[#272B36] text-slate-400 hover:bg-[#31363F] cursor-pointer"
              >
                undo
              </button>
            </div>
          </div>
        </div>

        {/* Quick Protein Chips */}
        {quickChips.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Quick Log</p>
            <div className="flex gap-2 flex-wrap">
              {quickChips.map((chip) => (
                <button
                  key={chip.food_id}
                  onClick={() => logQuickProtein(chip.food_id).then(() => refreshTodayDiet())}
                  className="px-3 py-1.5 rounded-full bg-[#1A1D25] border border-[#272B36] hover:border-emerald-500/50 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                >
                  +{chip.protein_g}g {chip.food_name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Meal Sections */}
        {MEAL_ORDER.map((mt) => (
          <MealSection
            key={mt}
            mealType={mt}
            items={byMeal[mt]}
            onAddFood={(meal) => setAddFoodModal({ meal, tab: 'catalog' })}
            onAddCustomFood={(meal) => setAddFoodModal({ meal, tab: 'custom' })}
            onRepeatYesterday={handleRepeatYesterday}
            onDelete={handleDeleteLog}
          />
        ))}

        {/* Weight Logger */}
        <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Scale className="w-3.5 h-3.5" /> Log Weight
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogWeight()}
              placeholder="e.g. 72.5"
              className="flex-1 px-3 py-2 bg-[#14171E] border border-[#272B36] rounded-lg text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500/50"
            />
            <span className="self-center text-slate-500 text-sm">kg</span>
            <button
              onClick={handleLogWeight}
              disabled={loggingWeight}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm cursor-pointer disabled:opacity-60"
            >
              {loggingWeight ? '…' : 'Log'}
            </button>
          </div>
        </div>

        {/* Weight Sparkline */}
        {weightHistory.length >= 2 && <WeightSparkline data={weightHistory} />}

        <div className="pb-6" />
      </div>

      {/* Add Food Modal */}
      {addFoodModal && (
        <AddFoodModal
          defaultMealType={addFoodModal.meal}
          initialTab={addFoodModal.tab}
          onClose={() => setAddFoodModal(null)}
        />
      )}
    </div>
  );
}
