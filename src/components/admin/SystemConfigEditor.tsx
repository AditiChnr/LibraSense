'use client';

import React, { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Cpu,
  Clock,
  Calendar,
} from 'lucide-react';
import { fetchSystemConfig, updateSystemConfig } from '@/lib/services/adminService';

export default function SystemConfigEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable Form State
  const [maxActive, setMaxActive] = useState<number>(2);
  const [maxFuture, setMaxFuture] = useState<number>(5);
  const [maxDurationMinutes, setMaxDurationMinutes] = useState<number>(240);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState<number>(15);
  const [leadMinutes, setLeadMinutes] = useState<number>(15);
  const [maxLeadDays, setMaxLeadDays] = useState<number>(7);
  const [hardwareMode, setHardwareMode] = useState<boolean>(true);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSystemConfig();
      setMaxActive(data.maxActiveReservations ?? 2);
      setMaxFuture(data.maxFutureReservations ?? 5);
      setMaxDurationMinutes(data.maxDurationMinutes ?? 240);
      setGracePeriodMinutes(data.defaultGracePeriodMinutes ?? 15);
      setLeadMinutes(data.minBookingLeadMinutes ?? 15);
      setMaxLeadDays(data.maxBookingLeadDays ?? 7);
      setHardwareMode(data.hardwareModeEnabled ?? true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load system config.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchSystemConfig()
      .then((data) => {
        if (active) {
          setMaxActive(data.maxActiveReservations ?? 2);
          setMaxFuture(data.maxFutureReservations ?? 5);
          setMaxDurationMinutes(data.maxDurationMinutes ?? 240);
          setGracePeriodMinutes(data.defaultGracePeriodMinutes ?? 15);
          setLeadMinutes(data.minBookingLeadMinutes ?? 15);
          setMaxLeadDays(data.maxBookingLeadDays ?? 7);
          setHardwareMode(data.hardwareModeEnabled ?? true);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Failed to load system config.';
          setError(msg);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await updateSystemConfig({
        maxActiveReservations: Number(maxActive),
        maxFutureReservations: Number(maxFuture),
        maxDurationMinutes: Number(maxDurationMinutes),
        defaultGracePeriodMinutes: Number(gracePeriodMinutes),
        minBookingLeadMinutes: Number(leadMinutes),
        maxBookingLeadDays: Number(maxLeadDays),
        hardwareModeEnabled: Boolean(hardwareMode),
      });
      setSuccessMsg('System configuration rules successfully saved and active across all nodes.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#263244] pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Library Policy & Operational Rule Config</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Global constraints for slot allocations, grace periods, and hardware occupancy modes
          </p>
        </div>

        <button
          onClick={loadConfig}
          aria-label="Refresh Configuration"
          className="p-2 bg-[#151D2B] border border-[#263244] rounded-xl text-slate-400 hover:text-white hover:bg-[#263244] transition self-start"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-[#4F8CFF]" />
          <span className="text-xs font-medium">Loading system settings...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Max Active Reservations */}
            <div className="bg-[#151D2B] border border-[#263244] rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#4F8CFF]" />
                Max Active Bookings / Student
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxActive}
                onChange={(e) => setMaxActive(parseInt(e.target.value, 10))}
                className="w-full bg-[#101621] border border-[#263244] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#4F8CFF]"
              />
              <p className="text-[11px] text-slate-500">
                Limit on simultaneous active reservations a student can hold (default: 2)
              </p>
            </div>

            {/* 2. Max Duration */}
            <div className="bg-[#151D2B] border border-[#263244] rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#38D9C5]" />
                Max Session Duration (Minutes)
              </label>
              <input
                type="number"
                min={30}
                max={720}
                step={30}
                value={maxDurationMinutes}
                onChange={(e) => setMaxDurationMinutes(parseInt(e.target.value, 10))}
                className="w-full bg-[#101621] border border-[#263244] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#4F8CFF]"
              />
              <p className="text-[11px] text-slate-500">
                Maximum booking length permitted in a single slot (240 min = 4 hours)
              </p>
            </div>

            {/* 3. Grace Period */}
            <div className="bg-[#151D2B] border border-[#263244] rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                No-Show Grace Period (Minutes)
              </label>
              <input
                type="number"
                min={5}
                max={60}
                value={gracePeriodMinutes}
                onChange={(e) => setGracePeriodMinutes(parseInt(e.target.value, 10))}
                className="w-full bg-[#101621] border border-[#263244] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#4F8CFF]"
              />
              <p className="text-[11px] text-slate-500">
                Time after slot start before unverified booking is flagged NO_SHOW (default: 15)
              </p>
            </div>

            {/* 4. Min Booking Lead Time */}
            <div className="bg-[#151D2B] border border-[#263244] rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Min Lead Time (Minutes)
              </label>
              <input
                type="number"
                min={0}
                max={120}
                value={leadMinutes}
                onChange={(e) => setLeadMinutes(parseInt(e.target.value, 10))}
                className="w-full bg-[#101621] border border-[#263244] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#4F8CFF]"
              />
              <p className="text-[11px] text-slate-500">
                Lead notice before a requested start time (default: 15 min)
              </p>
            </div>

            {/* 5. Max Booking Advance Days */}
            <div className="bg-[#151D2B] border border-[#263244] rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                Max Booking Advance (Days)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={maxLeadDays}
                onChange={(e) => setMaxLeadDays(parseInt(e.target.value, 10))}
                className="w-full bg-[#101621] border border-[#263244] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#4F8CFF]"
              />
              <p className="text-[11px] text-slate-500">
                How far in advance students may book seats (default: 7 days)
              </p>
            </div>

            {/* 6. Hardware Monitored Mode */}
            <div className="bg-[#151D2B] border border-[#263244] rounded-xl p-4 space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#38D9C5]" />
                IoT Camera Detection Engine
              </label>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-300">
                  {hardwareMode ? 'Hardware Mode Enabled' : 'Hardware Mode Paused'}
                </span>
                <button
                  type="button"
                  onClick={() => setHardwareMode(!hardwareMode)}
                  className={`w-11 h-6 rounded-full transition relative ${
                    hardwareMode ? 'bg-[#38D9C5]' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition absolute top-1 ${
                      hardwareMode ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Integrates live OpenCV edge telemetry into SeatStateResolver
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#263244] flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Rules...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save System Rules
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
