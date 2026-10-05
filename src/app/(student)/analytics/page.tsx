'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fsLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import {
  Clock,
  Compass,
  Activity,
  CheckCircle2,
  Loader2,
  Timer,
} from 'lucide-react';
import {
  StudySession,
  Reservation,
  Seat,
} from '@/types';
import {
  computePersonalStudyStats,
  computeDailyStudyTrend,
  computeHourlyOccupancyTrends,
  computeSeatUtilizationStats,
  computeReservationMetrics,
  generateExplainableInsights,
} from '@/lib/services/analyticsService';

import PersonalStudyStatsCards from '@/components/analytics/PersonalStudyStatsCards';
import DailyStudyChart from '@/components/analytics/DailyStudyChart';
import LibraryUtilizationSection from '@/components/analytics/LibraryUtilizationSection';
import LibraryInsightsSection from '@/components/analytics/LibraryInsightsSection';

type AnalyticsTab = 'personal' | 'library' | 'insights';

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('personal');

  // Real-time Firestore Data
  const [userSessions, setUserSessions] = useState<StudySession[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [allSessions, setAllSessions] = useState<StudySession[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) return;

    let loadedParts = 0;
    const checkLoaded = () => {
      loadedParts++;
      if (loadedParts >= 3) setLoading(false);
    };

    // 1. User's Personal Sessions
    const userSessionsQuery = query(
      collection(db, 'sessions'),
      where('userId', '==', user.uid),
      orderBy('startTime', 'desc'),
      fsLimit(100)
    );
    const unsubUserSessions = onSnapshot(
      userSessionsQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudySession));
        setUserSessions(list);
        checkLoaded();
      },
      () => checkLoaded()
    );

    // 2. All Seats
    const unsubSeats = onSnapshot(
      collection(db, 'seats'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Seat));
        setSeats(list);
        checkLoaded();
      },
      () => checkLoaded()
    );

    // 3. All Reservations
    const resQuery = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'), fsLimit(150));
    const unsubReservations = onSnapshot(
      resQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation));
        setAllReservations(list);
        checkLoaded();
      },
      () => checkLoaded()
    );

    // 4. All Sessions (for library-wide analytics)
    const allSessionsQuery = query(collection(db, 'sessions'), orderBy('startTime', 'desc'), fsLimit(150));
    const unsubAllSessions = onSnapshot(
      allSessionsQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudySession));
        setAllSessions(list);
      },
      () => {}
    );

    return () => {
      unsubUserSessions();
      unsubSeats();
      unsubReservations();
      unsubAllSessions();
    };
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#4F8CFF]" />
          <span className="text-xs font-medium tracking-wide">Loading student analytics...</span>
        </div>
      </div>
    );
  }

  // 1. Personal Calculations
  const personalStats = computePersonalStudyStats(userSessions);
  const trends7Days = computeDailyStudyTrend(userSessions, 7);
  const trends14Days = computeDailyStudyTrend(userSessions, 14);

  // 2. Library-wide Calculations
  const hourlyTrends = computeHourlyOccupancyTrends(allReservations, allSessions);
  const seatUtilization = computeSeatUtilizationStats(seats, allReservations, allSessions);
  const reservationMetrics = computeReservationMetrics(allReservations);
  const explainableInsights = generateExplainableInsights(
    hourlyTrends,
    seatUtilization.zoneBreakdown,
    reservationMetrics
  );

  const navTabs: { id: AnalyticsTab; label: string; icon: React.ElementType }[] = [
    { id: 'personal', label: 'My Study Analytics', icon: Clock },
    { id: 'library', label: 'Library Floor Utilization', icon: Activity },
    { id: 'insights', label: 'Operational Insights', icon: Compass },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#263244] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Productivity & Library Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#4F8CFF]/15 border border-[#4F8CFF]/30 text-[#4F8CFF] text-xs font-semibold">
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative focus metrics, study velocity trends, and explainable seat utilization patterns
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-[#101621] px-3.5 py-1.5 rounded-xl border border-[#263244]">
          <span className="w-2 h-2 rounded-full bg-[#38D9C5] animate-pulse" />
          <span>Server-Authoritative Metrics</span>
        </div>
      </div>

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
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#4F8CFF]" />
          <span className="text-xs font-medium">Computing analytics from database records...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tab 1: Personal Analytics */}
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <PersonalStudyStatsCards stats={personalStats} />

              <DailyStudyChart
                trends7Days={trends7Days}
                trends14Days={trends14Days}
              />

              {/* Personal Session History Table */}
              <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                      <Timer className="w-4 h-4 text-[#4F8CFF]" />
                      <span>Recent Study Sessions</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Log of verified desk check-in sessions with Pomodoro tracking
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 px-2.5 py-1 bg-[#151D2B] rounded-lg border border-[#263244]">
                    {userSessions.length} total sessions
                  </span>
                </div>

                {userSessions.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 border border-[#263244] border-dashed rounded-xl bg-[#151D2B]/30">
                    <p className="text-sm font-semibold text-slate-300">No session history yet</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Check in to a reserved desk via QR code and run the Pomodoro timer to see your history.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#263244]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#151D2B] text-slate-400 uppercase font-semibold text-[11px] border-b border-[#263244]">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Desk</th>
                          <th className="px-4 py-3">Study Duration</th>
                          <th className="px-4 py-3">Break Time</th>
                          <th className="px-4 py-3">Pomodoro Cycles</th>
                          <th className="px-4 py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#263244]/60 bg-[#101621]">
                        {userSessions.slice(0, 10).map((sess) => {
                          const studyMins = Math.round((sess.studyDurationSeconds || 0) / 60);
                          const breakMins = Math.round((sess.breakDurationSeconds || 0) / 60);
                          const dateFormatted = new Date(sess.startTime).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });

                          return (
                            <tr key={sess.id} className="hover:bg-[#151D2B]/50 transition">
                              <td className="px-4 py-3 font-medium text-white">{dateFormatted}</td>
                              <td className="px-4 py-3 font-semibold text-slate-200">
                                {sess.seatId.replace('seat_', 'Desk ')}
                              </td>
                              <td className="px-4 py-3 text-[#4F8CFF] font-semibold">
                                {studyMins >= 60 ? `${(studyMins / 60).toFixed(1)}h (${studyMins}m)` : `${studyMins}m`}
                              </td>
                              <td className="px-4 py-3 text-amber-400">
                                {breakMins}m
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                {sess.pomodoroCyclesCompleted || 0} cycles
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  sess.status === 'ended'
                                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 animate-pulse'
                                }`}>
                                  <CheckCircle2 className="w-3 h-3" />
                                  {sess.status === 'ended' ? 'Completed' : 'Active'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Library Utilization */}
          {activeTab === 'library' && (
            <LibraryUtilizationSection
              hourlyTrends={hourlyTrends}
              zoneBreakdown={seatUtilization.zoneBreakdown}
              mostUtilizedSeats={seatUtilization.mostUtilizedSeats}
              leastUtilizedSeats={seatUtilization.leastUtilizedSeats}
              reservationMetrics={reservationMetrics}
            />
          )}

          {/* Tab 3: Operational Insights */}
          {activeTab === 'insights' && (
            <LibraryInsightsSection insights={explainableInsights} />
          )}
        </div>
      )}
    </div>
  );
}
