'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { subscribeToActiveSession } from '@/lib/services/sessionService';
import { StudySession } from '@/types';
import PomodoroWidget from '@/components/pomodoro/PomodoroWidget';
import SessionSummaryModal from '@/components/pomodoro/SessionSummaryModal';
import { Timer, MapPin, QrCode, Calendar, RefreshCw, Sparkles } from 'lucide-react';

export default function SessionPage() {
  const { user } = useAuth();
  const [session, setSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(true);

  const [completedSession, setCompletedSession] = useState<StudySession | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const unsub = subscribeToActiveSession(user.uid, (activeSess) => {
      setSession(activeSess);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  const handleSessionEnded = (finalSession: StudySession) => {
    setCompletedSession(finalSession);
    setIsSummaryOpen(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#263244] pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-[#4F8CFF] font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-[#38D9C5]" />
            <span>Authoritative Study & Focus Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-[#F5F7FA] tracking-tight">Active Study Session</h1>
          <p className="text-xs text-[#9AA7B8] mt-1">Pomodoro cycle tracking and server-verified focus metrics</p>
        </div>

        {session && (
          <div className="bg-[#101621] border border-[#263244] px-4 py-2 rounded-xl flex items-center space-x-3 text-xs">
            <span className="flex items-center space-x-1.5 text-[#38D9C5] font-semibold">
              <MapPin className="w-4 h-4 text-[#4F8CFF]" />
              <span>Desk {session.seatId.replace('seat_', '')}</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-[#9AA7B8]">
              Started {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="bg-[#101621] border border-[#263244] rounded-2xl p-16 text-center text-[#9AA7B8] flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#4F8CFF]" />
          <p className="text-xs">Loading active session telemetry...</p>
        </div>
      ) : session && session.status !== 'ended' ? (
        <PomodoroWidget session={session} onSessionEnded={handleSessionEnded} />
      ) : (
        /* Empty State */
        <div className="bg-[#101621] border border-[#263244] rounded-2xl p-16 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-[#151D2B] text-[#9AA7B8] flex items-center justify-center mx-auto">
            <Timer className="w-8 h-8" />
          </div>

          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-[#F5F7FA]">No Active Study Session</h2>
            <p className="text-xs text-[#9AA7B8] leading-relaxed">
              Study sessions begin automatically when you arrive at your reserved desk and scan the physical QR code.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/scan"
              className="w-full sm:w-auto bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 text-[#F5F7FA] font-semibold text-xs px-6 py-3 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-[#4F8CFF]/20"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan Seat QR Code</span>
            </Link>

            <Link
              href="/map"
              className="w-full sm:w-auto bg-[#151D2B] hover:bg-[#151D2B]/80 text-[#F5F7FA] border border-[#263244] font-medium text-xs px-6 py-3 rounded-xl transition flex items-center justify-center space-x-2"
            >
              <Calendar className="w-4 h-4 text-[#38D9C5]" />
              <span>Find & Reserve a Desk</span>
            </Link>
          </div>
        </div>
      )}

      {/* Session Completed Summary Modal */}
      <SessionSummaryModal
        session={completedSession}
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
      />
    </div>
  );
}
