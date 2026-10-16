import React, { useEffect, useState } from 'react';
import { Database, Info, Cpu, HardDrive, ShieldCheck, ExternalLink, Trash2 } from 'lucide-react';
import type { AppInfo, DBPingResult } from '../../shared/types';

interface SettingsRow {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
}

function Row({ label, value, icon, mono }: SettingsRow) {
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
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

export default function SettingsScreen() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [ping, setPing] = useState<DBPingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    (async () => {
      if (!window.formaAPI) return;
      try {
        const [info, pingResult] = await Promise.all([
          window.formaAPI.getAppInfo(),
          window.formaAPI.ping(),
        ]);
        setAppInfo(info);
        setPing(pingResult);
      } catch (e) {
        console.error('Settings load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleExportDB = async () => {
    if (!window.formaAPI) return;
    // Intentionally no-op until shell open is wired — opens Finder to DB location
    alert('DB is located at:\n~/Library/Application Support/forma/forma.sqlite');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-white">Settings</h2>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>
      ) : (
        <>
          <Section title="App Info">
            <Row label="App Version" value={appInfo?.version ?? '—'} icon={<Info />} />
            <Row label="Build" value={appInfo?.build_mode ?? '—'} icon={<Cpu />} mono />
            <Row label="Platform" value={`macOS ${appInfo?.platform ?? ''}`} icon={<ShieldCheck />} />
            <Row label="Architecture" value={appInfo?.arch ?? '—'} icon={<Cpu />} mono />
            <Row label="Node Version" value={appInfo?.node_version ?? '—'} icon={<Cpu />} mono />
            <Row label="Electron Version" value={appInfo?.electron_version ?? '—'} icon={<Cpu />} mono />
          </Section>

          <Section title="Database">
            <Row label="Status" value={ping?.ok ? '✓ Connected' : '✗ Error'} icon={<Database />} />
            <Row label="SQLite Engine" value={ping?.sqliteVersion ? `v${ping.sqliteVersion}` : '—'} icon={<Database />} mono />
            <Row label="Schema Migration" value={ping?.schemaVersion != null ? `v${ping.schemaVersion}` : '—'} icon={<HardDrive />} mono />
            <Row label="Catalog Items" value={ping ? `${ping.catalogCounts.exercises} exercises, ${ping.catalogCounts.foods} foods` : '—'} icon={<Database />} />
            <Row label="DB Path" value={ping?.dbPath ?? '~/Library/Application Support/forma'} mono />
          </Section>

          <Section title="Data">
            <div className="pt-2 space-y-3">
              <button
                onClick={handleExportDB}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#272B36] hover:bg-[#31363F] text-slate-300 text-sm font-medium transition cursor-pointer border border-[#3A3F4B]"
              >
                <ExternalLink className="w-4 h-4" />
                Open Database Location
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure? This will clear all onboarding data and re-open the setup wizard. Your workout history is preserved.')) {
                    window.formaAPI?.setOnboardingSkipped(false).then(() => window.location.reload());
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-950/40 hover:bg-red-900/40 text-red-400 text-sm font-medium transition cursor-pointer border border-red-900/40"
              >
                <Trash2 className="w-4 h-4" />
                Reset Onboarding
              </button>
            </div>
          </Section>

          <div className="text-center pt-2 pb-8">
            <p className="text-xs text-slate-600">FORMA · Local-First · All data stays on your Mac.</p>
          </div>
        </>
      )}
    </div>
  );
}
