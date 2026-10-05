'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToOccupancyStats, OccupancyStats } from '@/lib/services/seatService';
import { subscribeToUserActiveReservation } from '@/lib/services/reservationService';
import { subscribeToActiveSession } from '@/lib/services/sessionService';
import { Reservation, StudySession } from '@/types';
import OccupancyGauge from '@/components/student/OccupancyGauge';
import NextReservationCard from '@/components/student/NextReservationCard';
import ActiveSessionCard from '@/components/student/ActiveSessionCard';
import StudySummaryCard from '@/components/student/StudySummaryCard';
import LibraryInsightCard from '@/components/student/LibraryInsightCard';
import { Sparkles, Calendar, Clock } from 'lucide-react';

export default function StudentDashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [stats, setStats] = useState<OccupancyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [resLoading, setResLoading] = useState(true);

  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    // 1. Subscribe to live library occupancy
    const unsubStats = subscribeToOccupancyStats((newStats) => {
      setStats(newStats);
      setStatsLoading(false);
    });

    return () => unsubStats();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    // 2. Subscribe to user active reservation
    const unsubRes = subscribeToUserActiveReservation(user.uid, (res) => {
      setActiveReservation(res);
      setResLoading(false);
    });

    // 3. Subscribe to active study session
    const unsubSession = subscribeToActiveSession(user.uid, (sess) => {
      setActiveSession(sess);
      setSessionLoading(false);
    });

    return () => {
      unsubRes();
      unsubSession();
    };
  }, [user?.uid]);

  const todayDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-indigo-400 font-medium mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart Student Workspace</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Welcome back, {profile?.displayName || 'Student'}!
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Student ID: <span className="font-semibold text-slate-300">{profile?.studentId || '23CSE001'}</span>
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400 self-start md:self-auto bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span>{todayDateStr}</span>
          <span className="text-slate-600">•</span>
          <Clock className="w-4 h-4 text-emerald-400" />
          <span>Live Sync</span>
        </div>
      </div>

      {/* Main Occupancy Gauge Card */}
      <OccupancyGauge stats={stats} loading={statsLoading || authLoading} />

      {/* 2-Column Grid: Next Reservation & Active Session */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <NextReservationCard reservation={activeReservation} loading={resLoading || authLoading} />
        <ActiveSessionCard session={activeSession} loading={sessionLoading || authLoading} />
      </div>

      {/* 2-Column Grid: Personal Focus Summary & Data-driven Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StudySummaryCard />
        <LibraryInsightCard />
      </div>
    </div>
  );
}
