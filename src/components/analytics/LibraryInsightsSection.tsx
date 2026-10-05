'use client';

import React from 'react';
import {
  Compass,
  Clock,
  Layers,
  ShieldCheck,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { ExplainableInsight } from '@/lib/services/analyticsService';

interface LibraryInsightsSectionProps {
  insights: ExplainableInsight[];
}

export default function LibraryInsightsSection({
  insights,
}: LibraryInsightsSectionProps) {
  const getCategoryIcon = (category: ExplainableInsight['category']) => {
    switch (category) {
      case 'best_time':
        return <Clock className="w-4 h-4 text-[#38D9C5]" />;
      case 'peak_hours':
        return <Compass className="w-4 h-4 text-[#4F8CFF]" />;
      case 'zone_preference':
        return <Layers className="w-4 h-4 text-purple-400" />;
      case 'reliability':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#263244] pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#4F8CFF]" />
            <span>Rule-Based Library Operational Insights</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic recommendations derived from real library reservation density and session duration data
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-[#151D2B] px-3 py-1 rounded-xl border border-[#263244]">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#38D9C5]" />
          <span>Explainable Model</span>
        </div>
      </div>

      {/* Insight Cards Grid */}
      {insights.length === 0 ? (
        <div className="py-12 text-center text-slate-500 bg-[#151D2B]/30 rounded-xl border border-[#263244]">
          <p className="text-sm font-medium">Accumulating library telemetry...</p>
          <p className="text-xs text-slate-600 mt-1">
            Operational recommendations will populate automatically as student reservations and check-in sessions are recorded.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="bg-[#151D2B] border border-[#263244] rounded-xl p-5 space-y-3 hover:border-slate-700 transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#101621] border border-[#263244] flex items-center justify-center">
                  {getCategoryIcon(insight.category)}
                </div>
                <h3 className="text-sm font-bold text-white">{insight.title}</h3>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {insight.description}
              </p>

              <div className="p-3 bg-[#101621] rounded-lg border border-[#263244] text-xs text-[#38D9C5] space-y-0.5">
                <span className="font-semibold text-slate-200 block text-[11px] uppercase tracking-wider">
                  Recommended Strategy:
                </span>
                <span>{insight.recommendation}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audit Footnote */}
      <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-[#151D2B] p-2.5 rounded-xl border border-[#263244]">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>
          All calculations are rule-based heuristics derived from verified check-ins and server duration timestamps. No artificial machine learning extrapolation is applied.
        </span>
      </div>
    </div>
  );
}
