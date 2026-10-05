'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Info,
} from 'lucide-react';
import { DayStudyTrend } from '@/lib/services/analyticsService';

interface DailyStudyChartProps {
  trends7Days: DayStudyTrend[];
  trends14Days: DayStudyTrend[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const studyMin = payload.find((p) => p.name === 'Study Minutes')?.value || 0;
    const breakMin = payload.find((p) => p.name === 'Break Minutes')?.value || 0;

    return (
      <div className="bg-[#151D2B] border border-[#263244] p-3 rounded-xl shadow-xl text-xs space-y-1.5">
        <p className="font-semibold text-white">{label}</p>
        <div className="flex items-center gap-2 text-[#4F8CFF]">
          <span className="w-2 h-2 rounded-full bg-[#4F8CFF]" />
          <span>Focus Time: {studyMin} min ({((studyMin as number) / 60).toFixed(1)}h)</span>
        </div>
        {breakMin > 0 && (
          <div className="flex items-center gap-2 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Breaks: {breakMin} min</span>
          </div>
        )}
      </div>
    );
  }
  return null;
}

export default function DailyStudyChart({
  trends7Days,
  trends14Days,
}: DailyStudyChartProps) {
  const [timeRange, setTimeRange] = useState<'7' | '14'>('7');

  const currentData = timeRange === '7' ? trends7Days : trends14Days;
  const hasAnyActivity = currentData.some((d) => d.studyMinutes > 0);

  return (
    <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Daily Focus & Study Velocity</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#151D2B] border border-[#263244] text-slate-400">
              Last {timeRange} Days
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified study session duration aggregated from server-authoritative timestamps
          </p>
        </div>

        {/* Range Switcher */}
        <div className="flex items-center bg-[#151D2B] p-1 rounded-xl border border-[#263244] self-start">
          <button
            onClick={() => setTimeRange('7')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              timeRange === '7'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange('14')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              timeRange === '14'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            14 Days
          </button>
        </div>
      </div>

      {/* Chart Canvas or Empty State */}
      {!hasAnyActivity ? (
        <div className="py-16 text-center text-slate-500 border border-[#263244] border-dashed rounded-xl bg-[#151D2B]/30 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#151D2B] border border-[#263244] flex items-center justify-center text-slate-400 mx-auto">
            <BarChart3 className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-300">No study sessions recorded in this period</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Check in to a reserved desk via QR code and run the Pomodoro timer to start tracking your daily study metrics.
          </p>
        </div>
      ) : (
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#263244" vertical={false} />
              <XAxis
                dataKey="dayLabel"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#263244' }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#263244' }}
                unit="m"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
              />
              <Bar
                name="Study Minutes"
                dataKey="studyMinutes"
                fill="#4F8CFF"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
              <Bar
                name="Break Minutes"
                dataKey="breakMinutes"
                fill="#F5B942"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insufficient Data Notice */}
      <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-[#151D2B] p-2.5 rounded-xl border border-[#263244]">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>
          Zero-minute days denote inactive days. Historical data is grounded strictly in completed sessions without extrapolation.
        </span>
      </div>
    </div>
  );
}
