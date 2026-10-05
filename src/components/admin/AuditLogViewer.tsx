'use client';

import React, { useState } from 'react';
import {
  Search,
  Clock,
  Shield,
  Activity,
  Wrench,
  Ban,
  Sliders,
} from 'lucide-react';
import { AuditLog } from '@/types';

interface AuditLogViewerProps {
  logs: AuditLog[];
}

export default function AuditLogViewer({ logs }: AuditLogViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.targetId.toLowerCase().includes(q) ||
        log.actorUid.toLowerCase().includes(q) ||
        JSON.stringify(log.details).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'SEAT_MAINTENANCE_TOGGLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Wrench className="w-3 h-3" />
            Maintenance Toggle
          </span>
        );
      case 'USER_ROLE_UPDATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            <Shield className="w-3 h-3" />
            Role Update
          </span>
        );
      case 'ADMIN_RESERVATION_CANCELLED':
      case 'ADMIN_MARKED_NO_SHOW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <Ban className="w-3 h-3" />
            Reservation Override
          </span>
        );
      case 'SYSTEM_CONFIG_UPDATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#38D9C5]/15 text-[#38D9C5] border border-[#38D9C5]/30">
            <Sliders className="w-3 h-3" />
            System Rules Config
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <Activity className="w-3 h-3" />
            {action}
          </span>
        );
    }
  };

  return (
    <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Security & Administrative Audit Logs</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#151D2B] border border-[#263244] text-slate-400">
              {filteredLogs.length} events
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable server audit trail of operations, state mutations, and policy changes
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit action, target..."
              className="bg-[#151D2B] border border-[#263244] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#4F8CFF] w-52"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            aria-label="Filter by Audit Action"
            className="bg-[#151D2B] border border-[#263244] rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#4F8CFF]"
          >
            <option value="all">All Actions</option>
            <option value="SEAT_MAINTENANCE_TOGGLED">Maintenance Toggle</option>
            <option value="USER_ROLE_UPDATED">Role Update</option>
            <option value="ADMIN_RESERVATION_CANCELLED">Reservation Cancelled</option>
            <option value="SYSTEM_CONFIG_UPDATED">System Config</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto rounded-xl border border-[#263244]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#151D2B] text-slate-400 uppercase font-semibold text-[11px] border-b border-[#263244]">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target ID</th>
              <th className="px-4 py-3">Actor UID</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#263244]/60 bg-[#101621]">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <p className="text-sm font-medium">No audit logs found</p>
                  <p className="text-xs text-slate-600 mt-1">Administrative actions will automatically generate logs here</p>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#151D2B]/50 transition">
                  {/* Timestamp */}
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">{getActionBadge(log.action)}</td>

                  {/* Target ID */}
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                    {log.targetId}
                  </td>

                  {/* Actor UID */}
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                    {log.actorUid.slice(0, 10)}...
                  </td>

                  {/* Details */}
                  <td className="px-4 py-3 text-slate-400 text-[11px] max-w-xs truncate">
                    {log.details ? (
                      <span title={JSON.stringify(log.details, null, 2)}>
                        {Object.entries(log.details)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ')}
                      </span>
                    ) : (
                      '--'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
