'use client';

import React from 'react';
import Link from 'next/link';
import { StudySession } from '@/types';
import { CheckCircle2, Award, Clock, Coffee, LayoutDashboard } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

interface SessionSummaryModalProps {
  session: StudySession | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function SessionSummaryModal({ session, isOpen, onClose }: SessionSummaryModalProps) {
  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#101621] border border-[#263244] rounded-2xl w-full max-w-md shadow-2xl p-8 text-center space-y-6 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-3xl bg-[#38D9C5]/10 text-[#38D9C5] border border-[#38D9C5]/30 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[#F5F7FA]">Study Session Completed</h2>
          <p className="text-xs text-[#9AA7B8]">
            Your session metrics have been securely recorded to your student profile.
          </p>
        </div>

        {/* Breakdown Stats */}
        <div className="grid grid-cols-3 gap-3 bg-[#151D2B] border border-[#263244] p-4 rounded-xl">
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center text-[#38D9C5]">
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-base font-bold text-[#F5F7FA]">
              {formatDuration(session.studyDurationSeconds || 0)}
            </p>
            <p className="text-[10px] text-[#9AA7B8]">Focus Time</p>
          </div>

          <div className="text-center space-y-1 border-x border-[#263244]">
            <div className="flex items-center justify-center text-[#F5B942]">
              <Coffee className="w-4 h-4" />
            </div>
            <p className="text-base font-bold text-[#F5F7FA]">
              {formatDuration(session.breakDurationSeconds || 0)}
            </p>
            <p className="text-[10px] text-[#9AA7B8]">Break Time</p>
          </div>

          <div className="text-center space-y-1">
            <div className="flex items-center justify-center text-[#4F8CFF]">
              <Award className="w-4 h-4" />
            </div>
            <p className="text-base font-bold text-[#F5F7FA]">
              {session.pomodoroCyclesCompleted || 0}
            </p>
            <p className="text-[10px] text-[#9AA7B8]">Cycles</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-2">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="w-full bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 text-[#F5F7FA] font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-[#4F8CFF]/20 text-xs"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
