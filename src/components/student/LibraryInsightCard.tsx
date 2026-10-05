'use client';

import React from 'react';
import { Lightbulb, TrendingUp, Sparkles } from 'lucide-react';

export default function LibraryInsightCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3 relative overflow-hidden">
      <div className="flex items-center space-x-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Data-Driven Library Insight</span>
      </div>

      <div className="flex items-start space-x-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-white">Optimal Study Window Detected</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Historical occupancy patterns show Central Library quietest between{' '}
            <strong className="text-indigo-400">4:00 PM and 7:00 PM</strong>. Floor 2 (Silent Pods) currently has the highest availability.
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center text-slate-400">
          <TrendingUp className="w-3.5 h-3.5 mr-1 text-emerald-400" />
          Peak hour today expected at 2:30 PM
        </span>
      </div>
    </div>
  );
}
