'use client';

import React, { useState } from 'react';
import { Seat } from '@/types';
import { X, Calendar, MapPin, AlertCircle, ShieldCheck } from 'lucide-react';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  seats: Seat[];
  preselectedSeatId?: string | null;
  onSuccess: () => void;
}

export default function ReservationModal({
  isOpen,
  onClose,
  seats,
  preselectedSeatId,
  onSuccess,
}: ReservationModalProps) {
  const [seatId, setSeatId] = useState<string>(() => preselectedSeatId || (seats[0]?.id ?? ''));
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]!);
  const [startTime, setStartTime] = useState<string>('10:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(120); // 2 hours default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate End Time
  const [startH, startM] = startTime.split(':').map(Number);
  const totalStartMinutes = (startH || 0) * 60 + (startM || 0);
  const totalEndMinutes = totalStartMinutes + durationMinutes;
  const endH = Math.floor(totalEndMinutes / 60) % 24;
  const endM = totalEndMinutes % 60;
  const endTimeFormatted = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

  const currentSeatId = seatId || preselectedSeatId || (seats[0]?.id ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const startTimeIso = `${date}T${startTime}:00.000Z`;
      const endTimeIso = `${date}T${endTimeFormatted}:00.000Z`;

      const res = await fetch('/api/v1/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId: currentSeatId,
          date,
          startTimeIso,
          endTimeIso,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create reservation.');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Create reservation error:', err);
      const msg = err instanceof Error ? err.message : 'Reservation failed';
      setError(msg);
      setLoading(false);
    }
  };

  const selectedSeatObj = seats.find((s) => s.id === currentSeatId);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#101621] border border-[#263244] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-[#263244] flex items-center justify-between bg-[#151D2B]/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#4F8CFF]/10 text-[#4F8CFF] border border-[#4F8CFF]/20 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#F5F7FA]">Reserve Study Seat</h3>
              <p className="text-xs text-[#9AA7B8]">Atomic slot-locking transaction guaranteed</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#9AA7B8] hover:text-[#F5F7FA] hover:bg-[#151D2B] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Seat Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#9AA7B8] uppercase tracking-wider mb-1.5">
              Select Study Desk
            </label>
            <select
              value={currentSeatId}
              onChange={(e) => setSeatId(e.target.value)}
              required
              className="w-full bg-[#151D2B] border border-[#263244] rounded-xl px-4 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#4F8CFF]"
            >
              {seats.map((s) => (
                <option key={s.id} value={s.id} disabled={s.isMaintenance}>
                  Desk {s.seatNumber} — {s.zone} ({s.features.join(', ')}) {s.isMaintenance ? '[Maintenance]' : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedSeatObj && (
            <div className="p-3 bg-[#151D2B]/60 border border-[#263244] rounded-xl text-xs text-[#9AA7B8] flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#38D9C5]" />
                <span className="text-[#F5F7FA] font-medium">{selectedSeatObj.zone}</span>
              </span>
              <span className="text-[11px] text-[#4F8CFF]">
                {selectedSeatObj.isHardwareMonitored ? 'Camera Sensor Active' : 'Standard Desk'}
              </span>
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-[#9AA7B8] uppercase tracking-wider mb-1.5">
              Reservation Date
            </label>
            <input
              type="date"
              required
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#151D2B] border border-[#263244] rounded-xl px-4 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#4F8CFF]"
            />
          </div>

          {/* Start Time & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#9AA7B8] uppercase tracking-wider mb-1.5">
                Start Time
              </label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-[#151D2B] border border-[#263244] rounded-xl px-4 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#4F8CFF]"
              >
                {Array.from({ length: 24 }).map((_, i) => {
                  const hour = (8 + Math.floor(i / 2)).toString().padStart(2, '0');
                  const min = i % 2 === 0 ? '00' : '30';
                  if (parseInt(hour, 10) > 21) return null;
                  const timeVal = `${hour}:${min}`;
                  return (
                    <option key={timeVal} value={timeVal}>
                      {timeVal}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9AA7B8] uppercase tracking-wider mb-1.5">
                Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full bg-[#151D2B] border border-[#263244] rounded-xl px-4 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#4F8CFF]"
              >
                <option value={30}>30 Minutes</option>
                <option value={60}>1 Hour</option>
                <option value={90}>1.5 Hours</option>
                <option value={120}>2 Hours</option>
                <option value={180}>3 Hours</option>
                <option value={240}>4 Hours (Max)</option>
              </select>
            </div>
          </div>

          {/* Booking Summary Box */}
          <div className="p-3.5 bg-[#080B12] border border-[#263244] rounded-xl text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#9AA7B8]">Calculated Window:</span>
              <span className="text-[#38D9C5] font-semibold">
                {startTime} – {endTimeFormatted} ({durationMinutes / 60}h)
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#9AA7B8]">
              <span>Check-in Grace Period:</span>
              <span className="text-[#F5B942]">15 Minutes from Start</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 disabled:bg-[#151D2B] text-[#F5F7FA] font-semibold py-3 rounded-xl transition shadow-lg shadow-[#4F8CFF]/20 text-xs flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span>Executing Server Transaction...</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm & Lock Reservation</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
