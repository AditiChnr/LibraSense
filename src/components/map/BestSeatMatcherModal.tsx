'use client';

import React, { useState } from 'react';
import { Seat, SeatZone, SeatFeature, DerivedSeatState } from '@/types';
import { findBestSeats, MatchedSeatResult } from '@/lib/services/bestSeatMatcher';
import SeatStateBadge from './SeatStateBadge';
import { X, Sparkles, SlidersHorizontal, Check, ArrowRight } from 'lucide-react';

interface BestSeatMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  seats: Seat[];
  derivedStates: Record<string, DerivedSeatState>;
  onSelectMatchedSeat: (seat: Seat) => void;
}

export default function BestSeatMatcherModal({
  isOpen,
  onClose,
  seats,
  derivedStates,
  onSelectMatchedSeat,
}: BestSeatMatcherModalProps) {
  const [zone, setZone] = useState<SeatZone | ''>('Quiet Zone');
  const [features, setFeatures] = useState<SeatFeature[]>(['Power Outlet']);
  const [preferHardware, setPreferHardware] = useState(false);

  if (!isOpen) return null;

  const availableZones: SeatZone[] = ['Quiet Zone', 'Collaborative', 'Window', 'Group Study'];
  const availableFeatures: SeatFeature[] = ['Power Outlet', 'Monitor', 'Standing Desk', 'Ergonomic Chair'];

  const toggleFeature = (feat: SeatFeature) => {
    if (features.includes(feat)) {
      setFeatures(features.filter((f) => f !== feat));
    } else {
      setFeatures([...features, feat]);
    }
  };

  const results: MatchedSeatResult[] = findBestSeats(seats, derivedStates, {
    preferredZone: zone,
    requiredFeatures: features,
    preferHardwareMonitored: preferHardware,
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#101621] border border-[#263244] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-[#263244] flex items-center justify-between bg-[#151D2B]/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#4F8CFF]/10 text-[#4F8CFF] border border-[#4F8CFF]/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#F5F7FA]">Smart Seat Matcher</h3>
              <p className="text-xs text-[#9AA7B8]">Rule-based recommendation engine for optimal seat selection</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#9AA7B8] hover:text-[#F5F7FA] hover:bg-[#151D2B] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Selection Panel */}
        <div className="p-6 border-b border-[#263244] space-y-4 bg-[#080B12]/40">
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#4F8CFF] uppercase tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Set Preference Criteria</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Preferred Zone */}
            <div>
              <label className="block text-xs text-[#9AA7B8] font-medium mb-1.5">Preferred Study Zone</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value as SeatZone | '')}
                className="w-full bg-[#151D2B] border border-[#263244] rounded-xl px-3 py-2 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#4F8CFF]"
              >
                <option value="">Any Zone</option>
                {availableZones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            {/* Hardware Preference */}
            <div>
              <label className="block text-xs text-[#9AA7B8] font-medium mb-1.5">IoT Telemetry Preference</label>
              <button
                type="button"
                onClick={() => setPreferHardware(!preferHardware)}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                  preferHardware
                    ? 'bg-[#38D9C5]/10 border-[#38D9C5]/40 text-[#38D9C5]'
                    : 'bg-[#151D2B] border-[#263244] text-[#9AA7B8]'
                }`}
              >
                <span>Prefer Camera Monitored Desk</span>
                {preferHardware && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Desired Features */}
          <div>
            <label className="block text-xs text-[#9AA7B8] font-medium mb-1.5">Required Desk Amenities</label>
            <div className="flex flex-wrap gap-2">
              {availableFeatures.map((feat) => {
                const isSelected = features.includes(feat);
                return (
                  <button
                    key={feat}
                    type="button"
                    onClick={() => toggleFeature(feat)}
                    className={`px-3 py-1.5 rounded-lg border text-xs transition ${
                      isSelected
                        ? 'bg-[#4F8CFF]/15 border-[#4F8CFF]/40 text-[#4F8CFF] font-semibold'
                        : 'bg-[#151D2B] border-[#263244] text-[#9AA7B8]'
                    }`}
                  >
                    {feat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ranked Results List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          <h4 className="text-xs font-semibold text-[#9AA7B8] uppercase tracking-wider">
            Ranked Recommendations ({results.length})
          </h4>

          {results.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#9AA7B8]">No matching seats found.</div>
          ) : (
            results.slice(0, 5).map((item) => (
              <div
                key={item.seat.id}
                className="bg-[#151D2B] border border-[#263244] p-4 rounded-xl flex items-center justify-between gap-4 hover:border-[#4F8CFF]/40 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-[#F5F7FA]">Desk {item.seat.seatNumber}</span>
                    <span className="text-xs font-semibold text-[#38D9C5] bg-[#38D9C5]/10 border border-[#38D9C5]/20 px-2 py-0.5 rounded">
                      {item.matchScore}% Match
                    </span>
                    <SeatStateBadge state={item.derivedState} showIcon={false} />
                  </div>
                  <p className="text-xs text-[#9AA7B8]">
                    {item.seat.zone} • {item.seat.features.join(', ')}
                  </p>
                  <p className="text-[11px] text-[#4F8CFF]">
                    {item.matchReasons.join(' • ')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectMatchedSeat(item.seat);
                    onClose();
                  }}
                  className="bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 text-[#F5F7FA] font-medium text-xs px-4 py-2.5 rounded-xl shrink-0 flex items-center space-x-1 transition shadow-md shadow-[#4F8CFF]/10"
                >
                  <span>View Seat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
