'use client';

import React from 'react';
import {
  Armchair,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Cpu,
  Activity,
  UserCheck,
} from 'lucide-react';
import { DerivedSeatState } from '@/types';

interface AdminOverviewCardsProps {
  totalSeats: number;
  occupancyPercentage: number;
  stateCounts: Record<DerivedSeatState, number>;
  activeReservationsCount: number;
  activeSessionsCount: number;
  devicesOnline: number;
  totalDevices: number;
}

export default function AdminOverviewCards({
  totalSeats,
  occupancyPercentage,
  stateCounts,
  activeReservationsCount,
  activeSessionsCount,
  devicesOnline,
  totalDevices,
}: AdminOverviewCardsProps) {
  const occupiedTotal = stateCounts.OCCUPIED_VALID + stateCounts.OCCUPIED_UNAUTHORIZED;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total & Live Occupancy */}
      <div className="bg-[#101621] border border-[#263244] rounded-2xl p-5 relative overflow-hidden shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Live Occupancy
          </span>
          <div className="w-8 h-8 rounded-xl bg-[#4F8CFF]/15 border border-[#4F8CFF]/30 flex items-center justify-center text-[#4F8CFF]">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-3xl font-bold text-white tracking-tight">
            {occupancyPercentage}%
          </div>
          <span className="text-xs text-slate-400">
            {occupiedTotal} / {totalSeats} seats active
          </span>
        </div>
        <div className="mt-3 w-full bg-[#151D2B] h-2 rounded-full overflow-hidden border border-[#263244]">
          <div
            className="h-full bg-gradient-to-r from-[#4F8CFF] to-[#38D9C5] transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* 2. Seat Availability Breakdown */}
      <div className="bg-[#101621] border border-[#263244] rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Available Desks
          </span>
          <div className="w-8 h-8 rounded-xl bg-[#38D9C5]/15 border border-[#38D9C5]/30 flex items-center justify-center text-[#38D9C5]">
            <Armchair className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-3xl font-bold text-[#38D9C5] tracking-tight">
            {stateCounts.AVAILABLE}
          </div>
          <span className="text-xs text-slate-400">
            {stateCounts.RESERVED} reserved
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#38D9C5]" />
            {stateCounts.AVAILABLE} open
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F5B942]" />
            {stateCounts.RESERVED} booked
          </span>
        </div>
      </div>

      {/* 3. Active Sessions & Reservations */}
      <div className="bg-[#101621] border border-[#263244] rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Active Study Sessions
          </span>
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-3xl font-bold text-white tracking-tight">
            {activeSessionsCount}
          </div>
          <span className="text-xs text-slate-400">
            {activeReservationsCount} active bookings
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-[#FF647C]" />
            {stateCounts.OCCUPIED_VALID} valid
          </span>
          {stateCounts.OCCUPIED_UNAUTHORIZED > 0 && (
            <span className="flex items-center gap-1.5 text-red-400 font-medium">
              <AlertCircle className="w-3 h-3" />
              {stateCounts.OCCUPIED_UNAUTHORIZED} unauth
            </span>
          )}
        </div>
      </div>

      {/* 4. IoT Hardware & Maintenance */}
      <div className="bg-[#101621] border border-[#263244] rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            IoT & Maintenance
          </span>
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-3xl font-bold text-white tracking-tight">
            {devicesOnline}/{totalDevices}
          </div>
          <span className="text-xs text-slate-400">
            {stateCounts.MAINTENANCE} in service
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-[#38D9C5]">
            <CheckCircle2 className="w-3 h-3" />
            IoT Operational
          </span>
          {stateCounts.MAINTENANCE > 0 && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <Wrench className="w-3 h-3 text-[#8B95A7]" />
              {stateCounts.MAINTENANCE} disabled
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
