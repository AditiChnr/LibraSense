'use client';

import React from 'react';
import Link from 'next/link';
import { OccupancyStats } from '@/lib/services/seatService';
import { ArrowRight, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';

interface OccupancyGaugeProps {
  stats: OccupancyStats | null;
  loading: boolean;
}

export default function OccupancyGauge({ stats, loading }: OccupancyGaugeProps) {
  if (loading || !stats) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-pulse space-y-4">
        <div className="h-4 bg-slate-800 rounded w-1/3"></div>
        <div className="h-10 bg-slate-800 rounded w-1/2"></div>
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="h-12 bg-slate-800 rounded"></div>
          <div className="h-12 bg-slate-800 rounded"></div>
          <div className="h-12 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  const { totalSeats, availableSeats, occupiedSeats, reservedSeats, occupancyPercentage } = stats;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 relative overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
            Real-Time Occupancy
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight mt-2">Central Library Capacity</h2>
          <p className="text-xs text-slate-400 mt-0.5">Live hardware & reservation telemetry</p>
        </div>

        {/* Main CTA */}
        <Link
          href="/map"
          className="inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20 text-sm shrink-0"
        >
          <span>Find a Seat</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Progress Bar & Percentage Gauge */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300 font-medium">{availableSeats} Seats Available Right Now</span>
          <span className="font-bold text-white">{occupancyPercentage}% Occupied</span>
        </div>
        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 flex">
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${(availableSeats / totalSeats) * 100}%` }}
            title={`Available: ${availableSeats}`}
          ></div>
          <div
            className="bg-amber-400 transition-all duration-500"
            style={{ width: `${(reservedSeats / totalSeats) * 100}%` }}
            title={`Reserved: ${reservedSeats}`}
          ></div>
          <div
            className="bg-rose-500 transition-all duration-500"
            style={{ width: `${(occupiedSeats / totalSeats) * 100}%` }}
            title={`Occupied: ${occupiedSeats}`}
          ></div>
        </div>
      </div>

      {/* Detailed Stat Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
          <div className="flex items-center space-x-1.5 text-xs text-emerald-400 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-semibold">Available</span>
          </div>
          <p className="text-lg font-bold text-white">{availableSeats}</p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
          <div className="flex items-center space-x-1.5 text-xs text-rose-400 mb-1">
            <UserCheck className="w-3.5 h-3.5" />
            <span className="font-semibold">Occupied</span>
          </div>
          <p className="text-lg font-bold text-white">{occupiedSeats}</p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
          <div className="flex items-center space-x-1.5 text-xs text-amber-400 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-semibold">Reserved</span>
          </div>
          <p className="text-lg font-bold text-white">{reservedSeats}</p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
            <span className="font-semibold">Total Capacity</span>
          </div>
          <p className="text-lg font-bold text-white">{totalSeats}</p>
        </div>
      </div>
    </div>
  );
}
