import React, { useEffect, useState, useRef } from 'react';
import {
  Database, Info, Cpu, HardDrive, ShieldCheck, Download, Upload,
  Bell, Palette, RefreshCw, Trash2, CheckCircle2, Clock, AlertCircle,
  Moon, Sun, Sparkles, RotateCcw, Sliders,
} from 'lucide-react';
import type { AppInfo, DBPingResult } from '../../shared/types';
import { useAppStore, type ThemeMode } from '../store/appStore';

const ACCENT_COLORS = [
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500', hex: '#10b981' },
  { id: 'sky', label: 'Sky Blue', bg: 'bg-sky-500', hex: '#0284c7' },
  { id: 'violet', label: 'Violet', bg: 'bg-violet-500', hex: '#8b5cf6' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500', hex: '#f59e0b' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500', hex: '#f43f5e' },
];

function Row({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1F222B] last:border-0">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        {icon && <span className="w-4 h-4 text-slate-500">{icon}</span>}
        {label}
      </div>
      <span className={`text-sm ${mono ? 'font-mono' : 'font-medium'} text-slate-200`}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1A1D25] border border-[#272B36] rounded-xl p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

export default function SettingsScreen() {
  const {
    setAccentColor: storeSetAccentColor,
    themeMode,
    setThemeMode,
    resetOnboarding,
    setOnboardingOpen,
  } = useAppStore();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [ping, setPing] = useState<DBPingResult | null>(null);
  const [backups, setBackups] = useState<Array<{ fileName: string; sizeBytes: number; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Settings State
  const [accentColor, setAccentColor] = useState('emerald');
  const [notifs, setNotifs] = useState({
    workoutReminder: false,
    workoutTime: '18:00',
    mealReminder: false,
    mealTime: '13:00',
  });
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      if (!window.formaAPI) return;
      try {
        const [info, pingResult, settings, backupList] = await Promise.all([
          window.formaAPI.getAppInfo(),
          window.formaAPI.ping(),
          window.formaAPI.getSettings(),
          window.formaAPI.getBackupsList(),
        ]);
        setAppInfo(info);
        setPing(pingResult);
        if (settings) {
          setAccentColor(settings.accentColor || 'emerald');
          if (settings.notifications) {
            setNotifs(settings.notifications);
          }
        }
        setBackups(backupList || []);
      } catch (e) {
        console.error('Settings load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAccentChange = async (colorId: string) => {
    setAccentColor(colorId);
    await storeSetAccentColor(colorId); // applies CSS vars + persists
    setSaveStatus('Accent color updated');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleSaveNotifications = async (updated: typeof notifs) => {
    setNotifs(updated);
    if (!window.formaAPI) return;
    await window.formaAPI.saveSettings({ notifications: updated });
    setSaveStatus('Notification preferences saved');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleExportJSON = async () => {
    if (!window.formaAPI) return;
    try {
      const jsonStr = await window.formaAPI.exportDataJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forma-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSaveStatus('Backup exported successfully');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data.');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !window.formaAPI) return;

    if (!window.confirm('Importing this file will overwrite your current logs with the backup data. Continue?')) {
      return;
    }

    try {
      const text = await file.text();
      const res = await window.formaAPI.importDataJson(text);
      if (res.success) {
        setImportStatus(`Restored successfully! (${Object.values(res.counts).reduce((a, b) => a + b, 0)} items)`);
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      console.error('Import error:', err);
      alert('Failed to import backup file. Ensure it is a valid FORMA export.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Settings</h2>
        {saveStatus && (
          <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" /> {saveStatus}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading settings…</div>
      ) : (
        <>
          {/* Appearance & Accent Color */}
          <Section title="Appearance">
            <div className="py-2 space-y-4">
              {/* Theme Mode */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 flex items-center gap-2">
                    <Moon className="w-4 h-4 text-slate-500" /> Theme Mode
                  </span>
                  <span className="text-xs text-slate-500 font-mono capitalize">{themeMode} Mode</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'dark' as ThemeMode, label: 'Dark', icon: <Moon className="w-3.5 h-3.5" />, desc: 'Charcoal & Slate' },
                    { id: 'light' as ThemeMode, label: 'Light', icon: <Sun className="w-3.5 h-3.5" />, desc: 'Crisp Day' },
                    { id: 'midnight' as ThemeMode, label: 'Midnight', icon: <Sparkles className="w-3.5 h-3.5" />, desc: 'Pure OLED Black' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={async () => {
                        await setThemeMode(t.id);
                        setSaveStatus(`${t.label} theme activated`);
                        setTimeout(() => setSaveStatus(null), 2500);
                      }}
                      className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-lg border text-xs font-medium cursor-pointer transition ${
                        themeMode === t.id
                          ? 'border-[var(--accent-primary)] text-white bg-slate-800/80 shadow-sm'
                          : 'border-[#272B36] text-slate-400 hover:border-slate-600 bg-[#14171E]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        {t.icon}
                        <span>{t.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div className="pt-2 border-t border-[#1F222B] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-slate-500" /> Accent Color
                  </span>
                  <span className="text-xs text-slate-500 font-mono capitalize">{accentColor}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleAccentChange(c.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
                        accentColor === c.id
                          ? 'border-white text-white bg-slate-800'
                          : 'border-[#272B36] text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${c.bg}`} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Configurable Notifications */}
          <Section title="Notifications">
            <div className="space-y-3 py-1">
              {/* Workout Reminder */}
              <div className="flex items-center justify-between py-2 border-b border-[#1F222B]">
                <div>
                  <div className="text-sm font-medium text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-slate-500" /> Workout Reminder
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Alert before your scheduled training time</div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={notifs.workoutTime}
                    disabled={!notifs.workoutReminder}
                    onChange={(e) =>
                      handleSaveNotifications({ ...notifs, workoutTime: e.target.value })
                    }
                    className="bg-[#14171E] border border-[#272B36] rounded px-2 py-1 text-xs text-slate-200 outline-none disabled:opacity-40"
                  />
                  <input
                    type="checkbox"
                    checked={notifs.workoutReminder}
                    onChange={(e) =>
                      handleSaveNotifications({ ...notifs, workoutReminder: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Meal Reminder */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" /> Meal Log Reminder
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Gentle nudge to log your lunch/dinner portions</div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={notifs.mealTime}
                    disabled={!notifs.mealReminder}
                    onChange={(e) =>
                      handleSaveNotifications({ ...notifs, mealTime: e.target.value })
                    }
                    className="bg-[#14171E] border border-[#272B36] rounded px-2 py-1 text-xs text-slate-200 outline-none disabled:opacity-40"
                  />
                  <input
                    type="checkbox"
                    checked={notifs.mealReminder}
                    onChange={(e) =>
                      handleSaveNotifications({ ...notifs, mealReminder: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Backup & Portability */}
          <Section title="Data Backup & Portability">
            <div className="py-2 space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                FORMA is 100% offline and local-first. You can export a full snapshot of your profile, plans, workout history, and diet logs at any time.
              </p>

              {importStatus && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
                  {importStatus}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleExportJSON}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#272B36] hover:bg-[#31363F] text-slate-200 text-xs font-semibold transition border border-[#3A3F4B] cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-400" /> Export JSON
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#272B36] hover:bg-[#31363F] text-slate-200 text-xs font-semibold transition border border-[#3A3F4B] cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-blue-400" /> Restore from JSON
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>

              {/* Automatic Launch Backups */}
              {backups.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Recent Automatic Backups on Launch ({backups.length}/5)
                  </div>
                  <div className="bg-[#14171E] rounded-lg border border-[#272B36] divide-y divide-[#1F222B]">
                    {backups.slice(0, 5).map((b, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                        <span className="font-mono text-slate-300 truncate">{b.fileName}</span>
                        <div className="flex items-center gap-3 text-slate-500 flex-shrink-0">
                          <span>{Math.round(b.sizeBytes / 1024)} KB</span>
                          <span>{b.createdAt.slice(0, 10)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Database Diagnostics */}
          <Section title="Database & Storage">
            <Row label="Status" value={ping?.ok ? '✓ Connected' : '✗ Error'} icon={<Database />} />
            <Row label="SQLite Engine" value={ping?.sqliteVersion ? `v${ping.sqliteVersion}` : '—'} icon={<Database />} mono />
            <Row label="Schema Migration" value={ping?.schemaVersion != null ? `v${ping.schemaVersion}` : '—'} icon={<HardDrive />} mono />
            <Row label="Catalog Items" value={ping ? `${ping.catalogCounts.exercises} exercises, ${ping.catalogCounts.foods} foods` : '—'} icon={<Database />} />
            <Row label="DB Path" value={ping?.dbPath ?? '~/Library/Application Support/forma'} mono />
          </Section>

          {/* App Info */}
          <Section title="System Diagnostics">
            <Row label="App Version" value={appInfo?.version ?? '0.1.0'} icon={<Info />} mono />
            <Row label="Architecture" value={appInfo?.arch ?? 'arm64'} icon={<Cpu />} mono />
            <Row label="Platform" value={`macOS ${appInfo?.platform ?? 'darwin'}`} icon={<ShieldCheck />} />
            <Row label="Node Version" value={appInfo?.node_version ?? '—'} icon={<Cpu />} mono />
            <Row label="Electron Version" value={appInfo?.electron_version ?? '—'} icon={<Cpu />} mono />
          </Section>

          {/* Onboarding & Profile Wizard */}
          <Section title="Profile & Setup">
            <div className="py-2 space-y-3">
              <p className="text-xs text-slate-400">
                You can re-run the interactive onboarding wizard anytime to adjust your biometric targets, training split, or dietary parameters.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setOnboardingOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--accent-primary)] hover:opacity-90 text-white text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  <Sliders className="w-4 h-4" /> Open Setup Wizard
                </button>
                <button
                  onClick={async () => {
                    if (window.confirm('Reset onboarding profile? Your workout and diet logs will be kept, but your profile and plan parameters will be cleared so you can start the wizard fresh.')) {
                      await resetOnboarding();
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 text-red-400 text-xs font-semibold transition border border-red-900/40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Reset Profile
                </button>
              </div>
            </div>
          </Section>

          <div className="text-center pt-2 pb-8">
            <p className="text-xs text-slate-600">FORMA · Version 0.1.0 · Apple Silicon Native</p>
          </div>
        </>
      )}
    </div>
  );
}
