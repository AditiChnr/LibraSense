'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Activity,
  Layers,
  CheckCircle2,
  Armchair,
} from 'lucide-react';
import {
  HourlyCongestion,
  ZoneUtilization,
  SeatUtilizationMetric,
  ReservationMetrics,
} from '@/lib/services/analyticsService';

interface LibraryUtilizationSectionProps {
  hourlyTrends: HourlyCongestion[];
  zoneBreakdown: ZoneUtilization[];
  mostUtilizedSeats: SeatUtilizationMetric[];
  leastUtilizedSeats: SeatUtilizationMetric[];
  reservationMetrics: ReservationMetrics;
}

interface CongestionTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}

function CongestionTooltip({ active, payload, label }: CongestionTooltipProps) {
  if (active && payload && payload.length) {
    const bookings = payload.find((p) => p.name === 'Active Bookings')?.value || 0;
    return (
      <div className="bg-[#151D2B] border border-[#263244] p-2.5 rounded-xl shadow-xl text-xs space-y-1">
        <p className="font-semibold text-white">Time Window: {label}</p>
        <p className="text-[#38D9C5] font-medium">
          Active Allocations: {bookings}
        </p>
      </div>
    );
  }
  return null;
}

export default function LibraryUtilizationSection({
  hourlyTrends,
  zoneBreakdown,
  mostUtilizedSeats,
  leastUtilizedSeats,
  reservationMetrics,
}: LibraryUtilizationSectionProps) {
  return (
    <div className="space-y-6">
      {/* 1. Peak Hours & Hourly Distribution */}
      <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#38D9C5]" />
              <span>Hourly Library Congestion Index</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical desk reservation and session distribution between 08:00 and 22:00
            </p>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#263244" vertical={false} />
              <XAxis
                dataKey="hourLabel"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#263244' }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#263244' }}
              />
              <Tooltip content={<CongestionTooltip />} />
              <Bar
                name="Active Bookings"
                dataKey="bookingCount"
                fill="#38D9C5"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Zone Breakdown & Reservation Reliability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Zone Utilization */}
        <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-5">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#4F8CFF]" />
              <span>Utilization by Study Zone</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparative desk density across functional zones
            </p>
          </div>

          <div className="space-y-4 pt-1">
            {zoneBreakdown.map((z) => (
              <div key={z.zone} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{z.zone}</span>
                  <span className="text-slate-400">
                    {z.activeBookingCount} bookings ({z.seatCount} desks)
                  </span>
                </div>
                <div className="w-full bg-[#151D2B] h-2.5 rounded-full overflow-hidden border border-[#263244]">
                  <div
                    className="h-full bg-gradient-to-r from-[#4F8CFF] to-[#38D9C5] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(8, z.utilizationPercentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reservation Reliability */}
        <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-5">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Reservation Adherence & Reliability</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Aggregated conversion metrics for confirmed library bookings
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {/* Check-In Rate */}
            <div className="bg-[#151D2B] border border-[#263244] rounded-xl p-4 text-center space-y-1">
              <div className="text-2xl font-bold text-emerald-400">
                {reservationMetrics.checkInRatePercentage}%
              </div>
              <span className="text-[11px] font-semibold text-slate-300 block">
                Checked In
              </span>
              <span className="text-[10px] text-slate-500 block">
                {reservationMetrics.checkedIn + reservationMetrics.completed} of {reservationMetrics.total}
              </span>
            </div>

            {/* No-Show Rate */}
            <div className="bg-[#151D2B] border border-[#263244] rounded-xl p-4 text-center space-y-1">
              <div className="text-2xl font-bold text-rose-400">
                {reservationMetrics.noShowRatePercentage}%
              </div>
              <span className="text-[11px] font-semibold text-slate-300 block">
                No-Show
              </span>
              <span className="text-[10px] text-slate-500 block">
                {reservationMetrics.noShow} expired
              </span>
            </div>

            {/* Cancellation Rate */}
            <div className="bg-[#151D2B] border border-[#263244] rounded-xl p-4 text-center space-y-1">
              <div className="text-2xl font-bold text-slate-400">
                {reservationMetrics.cancellationRatePercentage}%
              </div>
              <span className="text-[11px] font-semibold text-slate-300 block">
                Cancelled
              </span>
              <span className="text-[10px] text-slate-500 block">
                {reservationMetrics.cancelled} releases
              </span>
            </div>
          </div>

          <div className="p-3 bg-[#151D2B] rounded-xl border border-[#263244] text-[11px] text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38D9C5]" />
            <span>
              Reservations that pass the 15-minute grace period without QR check-in are released automatically.
            </span>
          </div>
        </div>
      </div>

      {/* 3. Desk Utilization Comparison */}
      <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-5">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Armchair className="w-4 h-4 text-[#4F8CFF]" />
            <span>Individual Desk Utilization Ranking</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Most requested desks versus highest availability pods
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Most Utilized */}
          <div className="bg-[#151D2B] border border-[#263244] rounded-xl p-4 space-y-3">
            <span className="text-xs font-semibold text-[#38D9C5] uppercase tracking-wider block">
              Most Booked Workstations
            </span>
            <div className="space-y-2">
              {mostUtilizedSeats.map((seat, index) => (
                <div
                  key={seat.seatId}
                  className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[#101621] border border-[#263244]/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 font-mono font-bold text-slate-500">#{index + 1}</span>
                    <span className="font-semibold text-white">Desk {seat.seatNumber}</span>
                    <span className="text-[11px] text-slate-500">({seat.zone})</span>
                  </div>
                  <span className="text-slate-300 font-mono text-[11px]">
                    {seat.totalBookings} bookings
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Highest Availability */}
          <div className="bg-[#151D2B] border border-[#263244] rounded-xl p-4 space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Highest Availability Desks
            </span>
            <div className="space-y-2">
              {leastUtilizedSeats.map((seat, index) => (
                <div
                  key={seat.seatId}
                  className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[#101621] border border-[#263244]/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 font-mono font-bold text-slate-500">#{index + 1}</span>
                    <span className="font-semibold text-white">Desk {seat.seatNumber}</span>
                    <span className="text-[11px] text-slate-500">({seat.zone})</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {seat.totalBookings} bookings
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
