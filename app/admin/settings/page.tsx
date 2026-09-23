"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { AdminNav } from '@/components/navigation/AdminNav';
import { Button } from '@/components/ui/Button';
import { useVentura } from '@/lib/store';
import { useToast } from '@/components/feedback/Toast';
import { Save, ShieldCheck, Check, AlertCircle } from 'lucide-react';

interface StepperInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  helperText?: string;
}

function IntegerStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 10000,
  step = 10,
  error,
  helperText,
}: StepperInputProps) {
  const handleDecrement = () => {
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, value + step));
  };

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const num = raw === '' ? min : parseInt(raw, 10);
    onChange(num);
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
        {label}
      </label>
      <div className={`flex items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border transition-all ${
        error ? 'border-rose-400 focus-within:ring-2 focus-within:ring-rose-300' : 'border-slate-200 focus-within:ring-2 focus-within:ring-[#635BFF]'
      }`}>
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
          title={`Decrease by ${step}`}
        >
          -{step}
        </button>
        <input
          type="number"
          value={value}
          onChange={handleManualChange}
          min={min}
          max={max}
          required
          className="w-full text-center bg-transparent border-none text-base font-black text-slate-900 focus:outline-none tabular-nums"
        />
        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
          title={`Increase by ${step}`}
        >
          +{step}
        </button>
      </div>
      {error ? (
        <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <span className="text-[10px] text-slate-400 mt-1 block">{helperText}</span>
      ) : null}
    </div>
  );
}

export default function AdminSettingsPage() {
  const { eventConfig, updateEventConfig } = useVentura();
  const toast = useToast();

  const [minCoins, setMinCoins] = useState<number>(() => eventConfig.minPerIdea || 0);
  const [maxCoins, setMaxCoins] = useState<number>(() => eventConfig.maxPerIdea || 0);
  const [budget, setBudget] = useState<number>(() => eventConfig.totalBudget || 0);
  const [targetTeams, setTargetTeams] = useState<number>(() => eventConfig.targetTeamsCount || 0);
  const [eventStatus, setEventStatus] = useState<string>(eventConfig.status || 'DRAFT');

  const [settingsVersion, setSettingsVersion] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/event/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          setMinCoins(data.settings.minInvestment);
          setMaxCoins(data.settings.maxInvestment);
          setBudget(data.settings.totalCoins);
          setTargetTeams(data.settings.targetTeamsCount);
          setEventStatus(data.settings.status);
          setSettingsVersion(data.settings.settingsVersion || data.settings.version || 1);
        }
      }
    } catch (e) {
      console.error('Failed to load initial event settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load authoritative database values on mount & listen for realtime updates
  useEffect(() => {
    loadSettings();

    const evtSource = new EventSource('/api/realtime');
    evtSource.addEventListener('DEFAULT_SETTINGS_UPDATED', () => {
      toast.info('Settings Synced', 'Default settings were updated by another administrator.');
      loadSettings();
    });
    evtSource.addEventListener('EVENT_SETTINGS_UPDATED', () => {
      toast.info('Settings Synced', 'Event settings were updated by another administrator.');
      loadSettings();
    });

    return () => {
      evtSource.close();
    };
  }, []);

  // Real-time client-side validation
  const validation = useMemo(() => {
    let minError: string | undefined;
    let maxError: string | undefined;
    let budgetError: string | undefined;

    if (minCoins < 1) {
      minError = 'Minimum investment must be at least 1 coin.';
    }
    if (minCoins > maxCoins) {
      minError = 'Minimum investment cannot exceed maximum investment.';
    }
    if (maxCoins > budget) {
      maxError = 'Maximum investment cannot exceed total coins per user.';
    }
    if (budget < 1) {
      budgetError = 'Total coins must be at least 1 coin.';
    }

    const isValid = !minError && !maxError && !budgetError;
    return { isValid, minError, maxError, budgetError };
  }, [minCoins, maxCoins, budget]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validation.isValid) {
      toast.error(
        'Validation Error',
        validation.minError || validation.maxError || validation.budgetError || 'Invalid parameters.'
      );
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/admin/event/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalCoins: budget,
          minInvestment: minCoins,
          maxInvestment: maxCoins,
          targetTeamsCount: targetTeams,
          settingsVersion: settingsVersion ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.message || 'Unable to save investment settings.';
        if (data.code === 'SETTINGS_VERSION_CONFLICT') {
          toast.error('Version Conflict', msg);
          loadSettings();
        } else {
          toast.error('Save Failed', msg);
        }
        setServerError(msg);
        setIsSaving(false);
        return;
      }

      // Synchronize authoritative state from server response
      setMinCoins(data.settings.minInvestment);
      setMaxCoins(data.settings.maxInvestment);
      setBudget(data.settings.totalCoins);
      setSettingsVersion(data.settings.settingsVersion || data.settings.version || 1);

      // Update local store state
      updateEventConfig({
        minPerIdea: data.settings.minInvestment,
        maxPerIdea: data.settings.maxInvestment,
        totalBudget: data.settings.totalCoins,
        targetTeamsCount: data.settings.targetTeamsCount,
      });

      setSaveSuccess(true);
      toast.success(
        'Settings Saved & Broadcast',
        'Arena investment caps updated in the database and synchronized across all active participants.'
      );

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Failed to update event settings:', err);
      setServerError('A network error occurred while connecting to the server.');
      toast.error('Network Error', 'Unable to save investment settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <AdminNav />

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            CONFIGURATION
          </span>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
            Arena Parameters &amp; Caps
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Authoritatively tune financial constraints and governance limits for the active tournament.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
              Loading current database configuration...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {/* Event Status Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Tournament Status
                  </span>
                  <span className="font-display font-extrabold text-sm text-slate-900 mt-0.5 inline-block">
                    {eventStatus}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Manage phase lifecycle in <a href="/admin" className="text-[#635BFF] font-bold hover:underline">Control Center &rarr;</a>
                </span>
              </div>

              {serverError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs text-rose-800 font-semibold">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <IntegerStepper
                  label="Total Coins / User"
                  value={budget}
                  onChange={setBudget}
                  min={1}
                  max={5000}
                  step={10}
                  error={validation.budgetError}
                  helperText="Authoritative per-participant budget"
                />

                <IntegerStepper
                  label="Minimum Investment"
                  value={minCoins}
                  onChange={setMinCoins}
                  min={1}
                  max={500}
                  step={10}
                  error={validation.minError}
                  helperText="Minimum single idea allocation"
                />

                <IntegerStepper
                  label="Maximum Investment"
                  value={maxCoins}
                  onChange={setMaxCoins}
                  min={1}
                  max={1000}
                  step={10}
                  error={validation.maxError}
                  helperText="Maximum single idea allocation"
                />
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Target Teams Count
                </label>
                <input
                  type="number"
                  value={targetTeams}
                  onChange={(e) => setTargetTeams(Number(e.target.value))}
                  min={1}
                  max={200}
                  required
                  className="w-full sm:w-1/3 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF] transition-all"
                />
              </div>

              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#22C7A9]" />
                  Authoritative MySQL database constraints with real-time SSE broadcast
                </span>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  pill
                  disabled={isSaving || !validation.isValid}
                  icon={saveSuccess ? <Check className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
                >
                  {isSaving ? 'Saving...' : saveSuccess ? 'Saved & Broadcast' : 'Save Arena Parameters'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
