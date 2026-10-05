'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { StudySession } from '@/types';
import { Timer, ArrowRight, Play, Pause } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

interface ActiveSessionCardProps {
  session: StudySession | null;
  loading: boolean;
}

export default function ActiveSessionCard({ session, loading }: ActiveSessionCardProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!session || !session.startTime) return;

    const startMs = new Date(session.startTime).getTime();

    const interval = setInterval(() => {
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsed(diffSec);
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-pulse space-y-3">
        <div className="h-4 bg-slate-800 rounded w-1/3"></div>
        <div className="h-8 bg-slate-800 rounded w-2/3"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
        <div className="flex items-center space-x-3 text-slate-400">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">No Active Session</h3>
            <p className="text-xs text-slate-400">Check in at your reserved seat to begin</p>
          </div>
        </div>

        <Link
          href="/scan"
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 rounded-xl transition text-center text-xs flex items-center justify-center space-x-1"
        >
          <span>Open QR Scanner</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Study Session Active</span>
        </span>
        <span className="text-xs text-slate-400">Seat {session.seatId.replace('seat_', '')}</span>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-slate-400">Authoritative Elapsed Duration</p>
        <h3 className="text-2xl font-extrabold text-white tracking-tight font-mono">
          {formatDuration(elapsed)}
        </h3>
      </div>

      <div className="pt-2 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          {session.status === 'active' ? (
            <span className="text-emerald-400 flex items-center">
              <Play className="w-3 h-3 mr-1" /> Focusing
            </span>
          ) : (
            <span className="text-amber-400 flex items-center">
              <Pause className="w-3 h-3 mr-1" /> Paused
            </span>
          )}
        </div>

        <Link
          href="/session"
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2 px-4 rounded-xl transition text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20"
        >
          <span>Open Pomodoro Timer</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
