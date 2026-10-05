'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  ShieldAlert,
  LayoutDashboard,
  Calendar,
  Users,
  Cpu,
  FileText,
  Sliders,
  Loader2,
} from 'lucide-react';
import {
  Seat,
  HardwareState,
  Reservation,
  StudySession,
  Device,
  AuditLog,
  DerivedSeatState,
} from '@/types';
import {
  subscribeToAllSeats,
  subscribeToAllHardwareStates,
  subscribeToAllReservations,
  subscribeToAllSessions,
  subscribeToAllDevices,
  subscribeToAuditLogs,
} from '@/lib/services/adminService';
import { resolveSeatState } from '@/lib/services/seatStateResolver';
import { evaluateDeviceHeartbeat } from '@/lib/services/iotSecurity';

import AdminOverviewCards from '@/components/admin/AdminOverviewCards';
import LiveSeatMonitor from '@/components/admin/LiveSeatMonitor';
import AdminReservationMonitor from '@/components/admin/AdminReservationMonitor';
import StudentUserManagement from '@/components/admin/StudentUserManagement';
import IoTDeviceMonitor from '@/components/admin/IoTDeviceMonitor';
import AuditLogViewer from '@/components/admin/AuditLogViewer';
import SystemConfigEditor from '@/components/admin/SystemConfigEditor';

type AdminTab = 'overview' | 'reservations' | 'users' | 'iot' | 'audit' | 'settings';

export default function AdminDashboardPage() {
  const { profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Real-time Firestore Data
  const [seats, setSeats] = useState<Seat[]>([]);
  const [hardwareStates, setHardwareStates] = useState<Record<string, HardwareState>>({});
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;

    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 3) setDataLoading(false);
    };

    const unsubSeats = subscribeToAllSeats((data) => {
      setSeats(data);
      checkLoaded();
    });

    const unsubHw = subscribeToAllHardwareStates((data) => {
      setHardwareStates(data);
      checkLoaded();
    });

    const unsubRes = subscribeToAllReservations((data) => {
      setReservations(data);
      checkLoaded();
    });

    const unsubSessions = subscribeToAllSessions((data) => {
      setSessions(data);
    });

    const unsubDevices = subscribeToAllDevices((data) => {
      setDevices(data);
    });

    const unsubAudit = subscribeToAuditLogs((data) => {
      setAuditLogs(data);
    });

    return () => {
      unsubSeats();
      unsubHw();
      unsubRes();
      unsubSessions();
      unsubDevices();
      unsubAudit();
    };
  }, [profile]);

  // Handle Unauthorized / Student User
  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#4F8CFF]" />
          <span className="text-xs font-medium tracking-wide">Verifying administrator authorization...</span>
        </div>
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-16 bg-[#101621] border border-rose-900/50 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white tracking-tight">Access Restricted</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          The LibraSense Admin Operations Console is restricted to authorized library personnel. Your current profile does not have administrative privileges.
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg transition"
          >
            Return to Student Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Derive Live Statistics
  const nowIso = new Date().toISOString();
  const stateCounts: Record<DerivedSeatState, number> = {
    AVAILABLE: 0,
    RESERVED: 0,
    OCCUPIED_VALID: 0,
    OCCUPIED_UNAUTHORIZED: 0,
    NO_SHOW_PENDING: 0,
    MAINTENANCE: 0,
  };

  seats.forEach((seat) => {
    const activeRes = reservations.find(
      (r) => r.seatId === seat.id && (r.status === 'active' || r.status === 'checked_in')
    );
    const activeSession = sessions.find((s) => s.seatId === seat.id);
    const hw = hardwareStates[seat.id];

    const state = resolveSeatState(seat, hw, activeRes, activeSession, nowIso);

    stateCounts[state]++;
  });

  const totalSeats = seats.length;
  const occupiedTotal = stateCounts.OCCUPIED_VALID + stateCounts.OCCUPIED_UNAUTHORIZED;
  const occupancyPercentage = totalSeats > 0 ? Math.round((occupiedTotal / totalSeats) * 100) : 0;
  const activeReservationsCount = reservations.filter((r) => r.status === 'active').length;
  const activeSessionsCount = sessions.filter((s) => s.status === 'active' || s.status === 'break').length;

  let devicesOnline = 0;
  devices.forEach((dev) => {
    if (evaluateDeviceHeartbeat(dev.lastHeartbeat) === 'ONLINE') devicesOnline++;
  });

  const navTabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview & Seats', icon: LayoutDashboard },
    { id: 'reservations', label: 'Reservations', icon: Calendar },
    { id: 'users', label: 'User Directory', icon: Users },
    { id: 'iot', label: 'IoT & Telemetry', icon: Cpu },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
    { id: 'settings', label: 'System Rules', icon: Sliders },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#263244] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Library Operations & Admin Console
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              Live Operations
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative seat inventory, multi-sensor occupancy telemetry, and policy management
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-[#101621] px-3.5 py-1.5 rounded-xl border border-[#263244]">
          <span className="w-2 h-2 rounded-full bg-[#38D9C5] animate-pulse" />
          <span>Real-time Firestore Engine</span>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <AdminOverviewCards
        totalSeats={totalSeats}
        occupancyPercentage={occupancyPercentage}
        stateCounts={stateCounts}
        activeReservationsCount={activeReservationsCount}
        activeSessionsCount={activeSessionsCount}
        devicesOnline={devicesOnline}
        totalDevices={devices.length}
      />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#263244]">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151D2B]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {dataLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#4F8CFF]" />
          <span className="text-xs font-medium">Synchronizing live operational data...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <LiveSeatMonitor
              seats={seats}
              hardwareStates={hardwareStates}
              reservations={reservations}
              sessions={sessions}
            />
          )}

          {activeTab === 'reservations' && (
            <AdminReservationMonitor reservations={reservations} seats={seats} />
          )}

          {activeTab === 'users' && (
            <StudentUserManagement currentAdminUid={profile.uid} />
          )}

          {activeTab === 'iot' && (
            <IoTDeviceMonitor devices={devices} seats={seats} />
          )}

          {activeTab === 'audit' && (
            <AuditLogViewer logs={auditLogs} />
          )}

          {activeTab === 'settings' && (
            <SystemConfigEditor />
          )}
        </div>
      )}
    </div>
  );
}
