'use client';

import React from 'react';
import { Award, Target, Flame } from 'lucide-react';

export default function StudySummaryCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Today&apos;s Focus Summary</h3>
        <span className="text-[11px] text-indigo-400 font-medium bg-indigo-500/10 px-2 py-0.5 rounded">
          Personal Stats
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-center">
          <div className="w-7 h-7 mx-auto rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-1">
            <Target className="w-4 h-4" />
          </div>
          <p className="text-base font-bold text-white">2h 45m</p>
          <p className="text-[10px] text-slate-400">Total Study</p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-center">
          <div className="w-7 h-7 mx-auto rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1">
            <Award className="w-4 h-4" />
          </div>
          <p className="text-base font-bold text-white">5</p>
          <p className="text-[10px] text-slate-400">Pomodoros</p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-center">
          <div className="w-7 h-7 mx-auto rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-1">
            <Flame className="w-4 h-4" />
          </div>
          <p className="text-base font-bold text-white">4 Days</p>
          <p className="text-[10px] text-slate-400">Study Streak</p>
        </div>
      </div>
    </div>
  );
}
