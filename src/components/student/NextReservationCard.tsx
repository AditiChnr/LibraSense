'use client';

import React from 'react';
import Link from 'next/link';
import { Reservation } from '@/types';
import { Calendar, QrCode, ArrowRight, Clock, MapPin } from 'lucide-react';

interface NextReservationCardProps {
  reservation: Reservation | null;
  loading: boolean;
}

export default function NextReservationCard({ reservation, loading }: NextReservationCardProps) {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-pulse space-y-3">
        <div className="h-4 bg-slate-800 rounded w-1/3"></div>
        <div className="h-8 bg-slate-800 rounded w-2/3"></div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
        <div className="flex items-center space-x-3 text-slate-400">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">No Active Reservation</h3>
            <p className="text-xs text-slate-400">Reserve a study desk to secure your spot</p>
          </div>
        </div>

        <Link
          href="/map"
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 rounded-xl transition text-center text-xs flex items-center justify-center space-x-1"
        >
          <span>Browse Available Seats</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  const startTimeStr = new Date(reservation.startTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTimeStr = new Date(reservation.endTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
          Upcoming Booking
        </span>
        <span className="text-xs text-slate-400 flex items-center space-x-1">
          <Clock className="w-3.5 h-3.5" />
          <span>Grace period: {reservation.gracePeriodMinutes || 15}m</span>
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center space-x-2 text-white">
          <MapPin className="w-4 h-4 text-amber-400" />
          <h3 className="text-lg font-bold">Seat {reservation.seatId.replace('seat_', '')}</h3>
        </div>
        <p className="text-xs text-slate-300">
          Today: {startTimeStr} – {endTimeStr}
        </p>
      </div>

      <div className="pt-2 flex items-center space-x-2">
        <Link
          href="/scan"
          className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-2.5 px-4 rounded-xl transition text-center text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-amber-500/20"
        >
          <QrCode className="w-4 h-4" />
          <span>Scan Seat QR Code</span>
        </Link>

        <Link
          href="/reservations"
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl transition text-xs"
          title="View Details"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
