import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { UserProfileInput, Sex, Goal, Experience, EquipmentType, DietaryType } from '../../engine/types';
import { Sparkles, X } from 'lucide-react';

export default function OnboardingModal() {
  const { onboardingOpen, saveUserProfile, skipOnboarding, profile } = useAppStore();

  const [heightCm, setHeightCm] = useState(profile?.height_cm || 175);
  const [weightKg, setWeightKg] = useState(profile?.weight_kg || 70);
  const [age, setAge] = useState(profile?.age || 22);
  const [sex, setSex] = useState<Sex>(profile?.sex || 'male');
  const [goal, setGoal] = useState<Goal>(profile?.goal || 'gain_muscle');
  const [experience, setExperience] = useState<Experience>(profile?.experience || 'beginner');
  const [daysPerWeek, setDaysPerWeek] = useState(profile?.days_per_week || 4);
  const [equipment, setEquipment] = useState<EquipmentType>(profile?.equipment || 'full_gym');
  const [dietaryType, setDietaryType] = useState<DietaryType>(profile?.dietary_type || 'veg');

  if (!onboardingOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: UserProfileInput = {
      height_cm: Number(heightCm),
      weight_kg: Number(weightKg),
      age: Number(age),
      sex,
      goal,
      experience,
      days_per_week: Number(daysPerWeek),
      equipment,
      dietary_type: dietaryType,
    };
    await saveUserProfile(input);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#14171E] border border-[#272B36] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl text-slate-100 space-y-6">
        <div className="flex items-center justify-between border-b border-[#272B36] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {profile ? 'Edit Your Profile' : 'Set Up Your Profile & Plan'}
              </h2>
              <p className="text-xs text-slate-400">
                Scientifically calibrated to your body, hostel mess diet, and equipment.
              </p>
            </div>
          </div>
          <button
            onClick={skipOnboarding}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Physical Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Height (cm)</label>
              <input
                type="number"
                min="120"
                max="230"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full bg-[#181B22] border border-[#272B36] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="250"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full bg-[#181B22] border border-[#272B36] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Age</label>
              <input
                type="number"
                min="13"
                max="90"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full bg-[#181B22] border border-[#272B36] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Sex */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Sex (for Mifflin-St Jeor)</label>
            <div className="grid grid-cols-2 gap-2">
              {(['male', 'female'] as Sex[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSex(s)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium capitalize transition cursor-pointer ${
                    sex === s
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                      : 'bg-[#181B22] border-[#272B36] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Primary Fitness Goal</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'gain_muscle', label: 'Gain Muscle (+300 kcal)' },
                { id: 'lose_fat', label: 'Lose Fat (-450 kcal)' },
                { id: 'maintain', label: 'Maintain (Recomp)' },
              ].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoal(g.id as Goal)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition cursor-pointer text-center ${
                    goal === g.id
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                      : 'bg-[#181B22] border-[#272B36] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Training Days / Week */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Training Schedule (Days / Week)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[2, 3, 4, 5, 6].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setDaysPerWeek(days)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition cursor-pointer text-center ${
                    daysPerWeek === days
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                      : 'bg-[#181B22] border-[#272B36] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {days} Days {days === 3 ? '(Full Body)' : days === 4 ? '(Upper/Lower)' : '(PPL)'}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Available Equipment</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'full_gym', label: 'Full Gym' },
                { id: 'dumbbells_only', label: 'Dumbbells Only' },
                { id: 'bodyweight_only', label: 'Bodyweight Only' },
              ].map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => setEquipment(eq.id as EquipmentType)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition cursor-pointer text-center ${
                    equipment === eq.id
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                      : 'bg-[#181B22] border-[#272B36] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {eq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dietary Type */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Dietary Preference (Hostel / Mess Filter)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'veg', label: 'Vegetarian (Paneer/Soya/Sprouts)' },
                { id: 'eggetarian', label: 'Eggetarian (Eggs + Dairy)' },
                { id: 'non_veg', label: 'Non-Vegetarian (Chicken/Eggs)' },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDietaryType(d.id as DietaryType)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition cursor-pointer text-center ${
                    dietaryType === d.id
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                      : 'bg-[#181B22] border-[#272B36] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Footer CTA */}
          <div className="flex items-center justify-between pt-4 border-t border-[#272B36]">
            <button
              type="button"
              onClick={skipOnboarding}
              className="text-xs text-slate-400 hover:text-white px-4 py-2 rounded-xl transition cursor-pointer"
            >
              Skip for now
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs rounded-xl transition shadow-lg shadow-emerald-500/15 cursor-pointer"
            >
              Create My Custom Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
