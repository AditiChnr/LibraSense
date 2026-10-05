'use client';

import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Ban,
  Loader2,
} from 'lucide-react';
import { Reservation, Seat } from '@/types';
import { adminCancelReservation } from '@/lib/services/adminService';

interface AdminReservationMonitorProps {
  reservations: Reservation[];
  seats: Seat[];
  onRefresh?: () => void;
}

export default function AdminReservationMonitor({
  reservations,
  seats,
  onRefresh,
}: AdminReservationMonitorProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seatMap = new Map(seats.map((s) => [s.id, s]));

  const filteredReservations = reservations.filter((res) => {
    if (statusFilter !== 'all' && res.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const seat = seatMap.get(res.seatId);
      return (
        res.id.toLowerCase().includes(q) ||
        res.userId.toLowerCase().includes(q) ||
        seat?.seatNumber.toLowerCase().includes(q) ||
        res.date.includes(q)
      );
    }
    return true;
  });

  const handleAction = async (reservationId: string, action: 'cancel' | 'mark_noshow') => {
    setActingId(reservationId);
    setError(null);
    try {
      await adminCancelReservation(reservationId, action, 'Administrative intervention');
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed.';
      setError(msg);
    } finally {
      setActingId(null);
    }
  };

  const getStatusBadge = (status: Reservation['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
            <Clock className="w-3 h-3" />
            Active (Awaiting Check-in)
          </span>
        );
      case 'checked_in':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#38D9C5]/15 text-[#38D9C5] border border-[#38D9C5]/30">
            <CheckCircle2 className="w-3 h-3" />
            Checked In
          </span>
        );
      case 'no_show':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" />
            No Show
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Reservation Monitoring</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#151D2B] border border-[#263244] text-slate-400">
              {filteredReservations.length} records
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time authoritative bookings, check-ins, and slot allocations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, desk, date..."
              className="bg-[#151D2B] border border-[#263244] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#4F8CFF] w-48"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by Status"
            className="bg-[#151D2B] border border-[#263244] rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#4F8CFF]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Bookings</option>
            <option value="checked_in">Checked In</option>
            <option value="no_show">No Shows</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#263244]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#151D2B] text-slate-400 uppercase font-semibold text-[11px] border-b border-[#263244]">
            <tr>
              <th className="px-4 py-3">Reservation ID</th>
              <th className="px-4 py-3">Desk Number</th>
              <th className="px-4 py-3">Student UID</th>
              <th className="px-4 py-3">Date & Time Window</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Check-In Time</th>
              <th className="px-4 py-3 text-right">Admin Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#263244]/60 bg-[#101621]">
            {filteredReservations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  <p className="text-sm font-medium">No reservations match the query</p>
                </td>
              </tr>
            ) : (
              filteredReservations.map((res) => {
                const seat = seatMap.get(res.seatId);
                const isActing = actingId === res.id;
                const startTimeFormatted = new Date(res.startTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const endTimeFormatted = new Date(res.endTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={res.id} className="hover:bg-[#151D2B]/50 transition">
                    {/* ID */}
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {res.id.slice(0, 8)}...
                    </td>

                    {/* Desk */}
                    <td className="px-4 py-3 font-semibold text-white">
                      {seat ? `Desk ${seat.seatNumber}` : res.seatId}
                    </td>

                    {/* Student */}
                    <td className="px-4 py-3 text-slate-300 font-mono text-[11px]">
                      {res.userId.slice(0, 10)}...
                    </td>

                    {/* Time Window */}
                    <td className="px-4 py-3 text-slate-300">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200">{res.date}</span>
                        <span className="text-[11px] text-slate-400">
                          {startTimeFormatted} - {endTimeFormatted}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">{getStatusBadge(res.status)}</td>

                    {/* Checked In */}
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {res.checkedInAt ? (
                        new Date(res.checkedInAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>

                    {/* Admin Actions */}
                    <td className="px-4 py-3 text-right">
                      {res.status === 'active' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAction(res.id, 'cancel')}
                            disabled={isActing}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-950/40 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60 transition disabled:opacity-50"
                          >
                            {isActing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Ban className="w-3 h-3" />
                            )}
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
