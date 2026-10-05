'use client';

import React from 'react';
import {
  Clock,
  CheckCircle2,
  Timer,
  Calendar,
  Flame,
  Hourglass,
  TrendingUp,
} from 'lucide-react';
import { PersonalStudyStats } from '@/lib/services/analyticsService';

interface PersonalStudyStatsCardsProps {
  stats: PersonalStudyStats;
}

export default function PersonalStudyStatsCards({ stats }: PersonalStudyStatsCardsProps) {
  const formatMinutesToHours = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = (mins / 60).toFixed(1);
    return `${h}h`;
  };

  const todayMinutes = Math.round(stats.todayStudySeconds / 60);
  const weekMinutes = Math.round(stats.thisWeekStudySeconds / 60);
  const monthMinutes = Math.round(stats.thisMonthStudySeconds / 60);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Focus Time */}
      <div className="bg-[#101621] border border-[#263244] rounded-2xl p-5 relative overflow-hidden shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Study Time
          </span>
          <div className="w-8 h-8 rounded-xl bg-[#4F8CFF]/15 border border-[#4F8CFF]/30 flex items-center justify-center text-[#4F8CFF]">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-3xl font-bold text-white tracking-tight">
            {stats.totalStudyHoursFormatted}
          </div>
          <span className="text-xs text-slate-400">
            {stats.completedSessionsCount} sessions
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-[#38D9C5]">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{formatMinutesToHours(todayMinutes)} completed today</span>
        </div>
      </div>

      {/* 2. Average Session Duration */}
      <div className="bg-[#101621] border border-[#263244] rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Average Session
          </span>
          <div className="w-8 h-8 rounded-xl bg-[#38D9C5]/15 border border-[#38D9C5]/30 flex items-center justify-center text-[#38D9C5]">
            <Hourglass className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-3xl font-bold text-[#38D9C5] tracking-tight">
            {stats.averageSessionDurationMinutes}m
          </div>
          <span className="text-xs text-slate-400">
            per check-in
          </span>
        </div>
        <div className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Server-authoritative timer</span>
        </div>
      </div>

      {/* 3. Study Breakdown (Week & Month) */}
      <div className="bg-[#101621] border border-[#263244] rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Study Velocity
          </span>
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-3xl font-bold text-white tracking-tight">
            {formatMinutesToHours(weekMinutes)}
          </div>
          <span className="text-xs text-slate-400">
            this week
          </span>
        </div>
        <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
          <span>Last 30 Days:</span>
          <span className="font-semibold text-slate-200">{formatMinutesToHours(monthMinutes)}</span>
        </div>
      </div>

      {/* 4. Pomodoro Cycles Completed */}
      <div className="bg-[#101621] border border-[#263244] rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Pomodoro Focus
          </span>
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Timer className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-3xl font-bold text-white tracking-tight">
            {stats.totalPomodoroCycles}
          </div>
          <span className="text-xs text-slate-400">
            cycles completed
          </span>
        </div>
        <div className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span>{Math.round(stats.totalBreakSeconds / 60)}m break time taken</span>
        </div>
      </div>
    </div>
  );
}
