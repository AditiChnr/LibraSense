'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Reservation } from '@/types';
import { Calendar, Clock, MapPin, QrCode, Trash2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface ReservationCardProps {
  reservation: Reservation;
  onCancelSuccess: () => void;
}

export default function ReservationCard({ reservation, onCancelSuccess }: ReservationCardProps) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this reservation? The slot lock will be released immediately.')) {
      return;
    }

    setCancelling(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/reservations/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: reservation.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to cancel reservation');
      }

      onCancelSuccess();
    } catch (err: unknown) {
      console.error('Cancel reservation error:', err);
      const msg = err instanceof Error ? err.message : 'Cancellation failed';
      setError(msg);
      setCancelling(false);
    }
  };

  const startTimeStr = new Date(reservation.startTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTimeStr = new Date(reservation.endTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const getStatusBadge = (status: Reservation['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-[#F5B942]/10 text-[#F5B942] border border-[#F5B942]/30">
            <Clock className="w-3.5 h-3.5" />
            <span>Active Booking</span>
          </span>
        );
      case 'checked_in':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-[#38D9C5]/10 text-[#38D9C5] border border-[#38D9C5]/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Checked In</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-[#8B95A7]/10 text-[#8B95A7] border border-[#8B95A7]/30">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        );
      case 'no_show':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-[#FF4D4D]/10 text-[#FF4D4D] border border-[#FF4D4D]/30">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>No Show</span>
          </span>
        );
      default:
        return null;
    }
  };

  const isActive = reservation.status === 'active';

  return (
    <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-4 hover:border-[#4F8CFF]/30 transition">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-[#4F8CFF]" />
          <h3 className="text-base font-bold text-[#F5F7FA]">Desk {reservation.seatId.replace('seat_', '')}</h3>
        </div>
        {getStatusBadge(reservation.status)}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 bg-[#151D2B] border border-[#263244] p-3.5 rounded-xl text-xs">
        <div>
          <span className="text-[#9AA7B8] block text-[11px]">Booking Date</span>
          <span className="text-[#F5F7FA] font-medium flex items-center space-x-1 mt-0.5">
            <Calendar className="w-3.5 h-3.5 text-[#4F8CFF]" />
            <span>{reservation.date}</span>
          </span>
        </div>

        <div>
          <span className="text-[#9AA7B8] block text-[11px]">Time Window</span>
          <span className="text-[#F5F7FA] font-medium flex items-center space-x-1 mt-0.5">
            <Clock className="w-3.5 h-3.5 text-[#38D9C5]" />
            <span>{startTimeStr} – {endTimeStr}</span>
          </span>
        </div>
      </div>

      {/* Footer Info & Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[#263244]">
        <div className="text-[11px] text-[#9AA7B8]">
          Grace Window: <span className="text-[#F5B942] font-semibold">{reservation.gracePeriodMinutes || 15} mins</span>
        </div>

        {isActive && (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs text-[#FF4D4D] hover:text-[#FF4D4D]/80 bg-[#FF4D4D]/10 hover:bg-[#FF4D4D]/20 border border-[#FF4D4D]/30 px-3 py-1.5 rounded-xl transition flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{cancelling ? 'Cancelling...' : 'Cancel'}</span>
            </button>

            <Link
              href="/scan"
              className="text-xs bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 text-[#F5F7FA] font-semibold px-3.5 py-1.5 rounded-xl transition flex items-center space-x-1 shadow-md shadow-[#4F8CFF]/20"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Check In</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
