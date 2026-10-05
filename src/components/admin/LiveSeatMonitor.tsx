'use client';

import React, { useState } from 'react';
import {
  Search,
  Wrench,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { Seat, HardwareState, Reservation, StudySession } from '@/types';
import { resolveSeatState } from '@/lib/services/seatStateResolver';
import SeatStateBadge from '@/components/map/SeatStateBadge';
import MaintenanceModal from './MaintenanceModal';

interface LiveSeatMonitorProps {
  seats: Seat[];
  hardwareStates: Record<string, HardwareState>;
  reservations: Reservation[];
  sessions: StudySession[];
  onRefresh?: () => void;
}

export default function LiveSeatMonitor({
  seats,
  hardwareStates,
  reservations,
  sessions,
  onRefresh,
}: LiveSeatMonitorProps) {
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');

  const nowIso = new Date().toISOString();

  // Combine seats with derived states
  const enrichedSeats = seats.map((seat) => {
    const activeRes = reservations.find(
      (r) => r.seatId === seat.id && (r.status === 'active' || r.status === 'checked_in')
    );
    const activeSession = sessions.find((s) => s.seatId === seat.id);
    const hw = hardwareStates[seat.id];

    const derivedState = resolveSeatState(seat, hw, activeRes, activeSession, nowIso);

    return {
      seat,
      derivedState,
      hardware: hw,
      activeReservation: activeRes,
      activeSession,
    };
  });

  const filteredSeats = enrichedSeats.filter(({ seat, derivedState }) => {
    if (floorFilter !== 'all' && seat.floorId !== floorFilter) return false;
    if (stateFilter !== 'all' && derivedState !== stateFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        seat.seatNumber.toLowerCase().includes(q) ||
        seat.zone.toLowerCase().includes(q) ||
        derivedState.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-5">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Live Seat & IoT Hardware Monitor</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#151D2B] border border-[#263244] text-slate-400">
              {filteredSeats.length} / {seats.length} desks
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time multi-sensor occupancy state derived from pure SeatStateResolver
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search seat number, zone..."
              className="bg-[#151D2B] border border-[#263244] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#4F8CFF] w-48"
            />
          </div>

          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            aria-label="Filter by Floor"
            className="bg-[#151D2B] border border-[#263244] rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#4F8CFF]"
          >
            <option value="all">All Floors</option>
            <option value="floor_1">Floor 1 (Main Hall)</option>
            <option value="floor_2">Floor 2 (Tech & Silent)</option>
          </select>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            aria-label="Filter by Derived State"
            className="bg-[#151D2B] border border-[#263244] rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#4F8CFF]"
          >
            <option value="all">All States</option>
            <option value="AVAILABLE">Available</option>
            <option value="RESERVED">Reserved</option>
            <option value="OCCUPIED_VALID">Occupied (Valid)</option>
            <option value="OCCUPIED_UNAUTHORIZED">Occupied (Unauthorized)</option>
            <option value="NO_SHOW_PENDING">No-Show Pending</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>

          {onRefresh && (
            <button
              onClick={onRefresh}
              aria-label="Refresh Seats"
              className="p-1.5 bg-[#151D2B] border border-[#263244] rounded-xl text-slate-400 hover:text-white hover:bg-[#263244] transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Monitor Table */}
      <div className="overflow-x-auto rounded-xl border border-[#263244]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#151D2B] text-slate-400 uppercase font-semibold text-[11px] border-b border-[#263244]">
            <tr>
              <th className="px-4 py-3">Desk Number</th>
              <th className="px-4 py-3">Floor / Zone</th>
              <th className="px-4 py-3">Derived State</th>
              <th className="px-4 py-3">IoT Telemetry</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Active Session</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#263244]/60 bg-[#101621]">
            {filteredSeats.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  <p className="text-sm font-medium">No matching desks found</p>
                  <p className="text-xs text-slate-600 mt-1">Try adjusting your search or filter criteria</p>
                </td>
              </tr>
            ) : (
              filteredSeats.map(({ seat, derivedState, hardware, activeSession }) => {
                const isMonitored = seat.isHardwareMonitored;
                const isHwOccupied = hardware?.occupied;

                return (
                  <tr key={seat.id} className="hover:bg-[#151D2B]/50 transition">
                    {/* Desk Number */}
                    <td className="px-4 py-3 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span>Desk {seat.seatNumber}</span>
                        {isMonitored && (
                          <span className="p-0.5 rounded bg-[#4F8CFF]/15 text-[#4F8CFF]" title="IoT Camera Monitored">
                            <Cpu className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Floor & Zone */}
                    <td className="px-4 py-3 text-slate-300">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200">
                          {seat.floorId === 'floor_1' ? 'Floor 1' : 'Floor 2'}
                        </span>
                        <span className="text-[11px] text-slate-500">{seat.zone}</span>
                      </div>
                    </td>

                    {/* Derived State */}
                    <td className="px-4 py-3">
                      <SeatStateBadge state={derivedState} />
                    </td>

                    {/* Hardware Telemetry */}
                    <td className="px-4 py-3">
                      {isMonitored ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isHwOccupied ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                            }`}
                          />
                          <span className="text-slate-300 font-medium">
                            {isHwOccupied ? 'Person Present' : 'Desk Vacant'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Unmonitored Desk</span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="px-4 py-3 text-slate-400">
                      {isMonitored && hardware ? (
                        <span className="font-mono text-xs text-slate-300">
                          {Math.round((hardware.smoothedConfidence || 0) * 100)}%
                        </span>
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>

                    {/* Active Session */}
                    <td className="px-4 py-3 text-slate-300">
                      {activeSession ? (
                        <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-medium">
                          {activeSession.status.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-slate-600">None</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedSeat(seat);
                          setIsModalOpen(true);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition ${
                          seat.isMaintenance
                            ? 'bg-amber-600/15 border-amber-500/40 text-amber-300 hover:bg-amber-600/30'
                            : 'bg-[#151D2B] border-[#263244] text-slate-400 hover:text-white hover:bg-[#263244]'
                        }`}
                      >
                        <Wrench className="w-3 h-3" />
                        <span>{seat.isMaintenance ? 'In Maintenance' : 'Set Maintenance'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Maintenance Action Modal */}
      <MaintenanceModal
        seat={selectedSeat}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSeat(null);
        }}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}
