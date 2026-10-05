'use client';

import React, { useState } from 'react';
import { Wrench, X, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Seat } from '@/types';
import { toggleSeatMaintenance } from '@/lib/services/adminService';

interface MaintenanceModalProps {
  seat: Seat | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESET_REASONS = [
  'Power outlet / electrical fault',
  'Ergonomic chair repair / replacement',
  'Monitor / HDMI cable malfunction',
  'Scheduled deep sanitation & cleaning',
  'Hardware sensor calibration',
  'Noise / physical partition maintenance',
];

export default function MaintenanceModal({
  seat,
  isOpen,
  onClose,
  onSuccess,
}: MaintenanceModalProps) {
  const [isMaintenance, setIsMaintenance] = useState<boolean>(true);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !seat) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await toggleSeatMaintenance(
        seat.id,
        isMaintenance,
        isMaintenance ? (reason || 'Administrative maintenance') : undefined
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update maintenance state.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#101621] border border-[#263244] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#263244] bg-[#151D2B]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Desk Maintenance Control
              </h3>
              <p className="text-xs text-slate-400">
                Seat {seat.seatNumber} ({seat.zone})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#263244] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Desired Action
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsMaintenance(true)}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition ${
                  isMaintenance
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                    : 'bg-[#151D2B] border-[#263244] text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                Enable Maintenance
              </button>
              <button
                type="button"
                onClick={() => setIsMaintenance(false)}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition ${
                  !isMaintenance
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                    : 'bg-[#151D2B] border-[#263244] text-slate-400 hover:text-slate-200'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                Return to Service
              </button>
            </div>
          </div>

          {isMaintenance && (
            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Reason / Note
              </label>
              
              <div className="flex flex-wrap gap-1.5">
                {PRESET_REASONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#151D2B] hover:bg-[#263244] border border-[#263244] text-slate-300 hover:text-white transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter custom maintenance details..."
                rows={3}
                className="w-full bg-[#151D2B] border border-[#263244] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#4F8CFF] resize-none"
              />
            </div>
          )}

          <div className="pt-3 border-t border-[#263244] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-[#151D2B] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition disabled:opacity-50 ${
                isMaintenance
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Updating...
                </>
              ) : isMaintenance ? (
                'Place in Maintenance'
              ) : (
                'Activate Desk'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
