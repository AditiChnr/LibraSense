'use client';

import React, { useState, useEffect } from 'react';
import { StudySession } from '@/types';
import { formatDuration } from '@/lib/utils';
import {
  Play,
  Pause,
  Coffee,
  CheckCircle2,
  Square,
  Award,
  AlertCircle,
} from 'lucide-react';

interface PomodoroWidgetProps {
  session: StudySession;
  onSessionEnded: (finalSession: StudySession) => void;
}

export default function PomodoroWidget({ session, onSessionEnded }: PomodoroWidgetProps) {
  // Preset focus & break durations (in minutes)
  const [focusDurationMinutes, setFocusDurationMinutes] = useState<number>(25);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState<number>(5);

  const isBreak = session.status === 'break';
  const targetDurationSeconds = (isBreak ? breakDurationMinutes : focusDurationMinutes) * 60;

  // Local interval timer countdown
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => targetDurationSeconds);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);

  // Total session authoritative elapsed seconds
  const [totalElapsedSeconds, setTotalElapsedSeconds] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Live Authoritative Elapsed Time Counter
  useEffect(() => {
    if (!session.startTime || session.status === 'ended') return;

    const startMs = new Date(session.startTime).getTime();

    const interval = setInterval(() => {
      const nowMs = Date.now();
      const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setTotalElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [session.startTime, session.status]);

  // 2. Pomodoro Interval Countdown Timer
  useEffect(() => {
    if (isTimerPaused || session.status === 'ended') return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          return targetDurationSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerPaused, session.status, targetDurationSeconds]);

  const handleSelectPreset = (focusMins: number, breakMins: number) => {
    setFocusDurationMinutes(focusMins);
    setBreakDurationMinutes(breakMins);
    const newTarget = (isBreak ? breakMins : focusMins) * 60;
    setSecondsRemaining(newTarget);
  };

  const handleAction = async (action: 'START_BREAK' | 'END_BREAK' | 'CYCLE_COMPLETE' | 'END_SESSION') => {
    if (action === 'END_SESSION' && !confirm('Are you sure you want to end your study session and release your desk?')) {
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/sessions/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Action failed.');
      }

      if (action === 'START_BREAK') {
        setSecondsRemaining(breakDurationMinutes * 60);
      } else if (action === 'END_BREAK') {
        setSecondsRemaining(focusDurationMinutes * 60);
      }

      if (action === 'END_SESSION') {
        onSessionEnded(data.data as StudySession);
      }
    } catch (err: unknown) {
      console.error('Session action error:', err);
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const progressPercent = Math.min(100, Math.max(0, ((targetDurationSeconds - secondsRemaining) / targetDurationSeconds) * 100));
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeDisplay = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
      {/* Header Phase Status */}
      <div className="flex items-center justify-between border-b border-[#263244] pb-4">
        <div className="flex items-center space-x-2">
          {isBreak ? (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#F5B942]/10 text-[#F5B942] border border-[#F5B942]/30">
              <Coffee className="w-3.5 h-3.5" />
              <span>Rest & Break Phase</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#38D9C5]/10 text-[#38D9C5] border border-[#38D9C5]/30">
              <span className="w-2 h-2 rounded-full bg-[#38D9C5] animate-pulse"></span>
              <span>Deep Focus Phase</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs text-[#9AA7B8]">
          <Award className="w-4 h-4 text-[#4F8CFF]" />
          <span>{session.pomodoroCyclesCompleted || 0} Cycles Completed</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Circular Progress Timer Centerpiece */}
      <div className="flex flex-col items-center justify-center py-4 relative">
        <div className="relative w-64 h-64 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background Track Circle */}
            <circle
              cx="50"
              cy="50"
              r="44"
              className="stroke-[#151D2B]"
              strokeWidth="6"
              fill="transparent"
            />
            {/* Active Progress Circle */}
            <circle
              cx="50"
              cy="50"
              r="44"
              className={`transition-all duration-1000 ${
                isBreak ? 'stroke-[#F5B942]' : 'stroke-[#38D9C5]'
              }`}
              strokeWidth="6"
              strokeDasharray={276.46}
              strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Center Digital Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-4xl md:text-5xl font-extrabold text-[#F5F7FA] font-mono tracking-tight">
              {timeDisplay}
            </span>
            <span className="text-xs text-[#9AA7B8] uppercase tracking-wider mt-1 font-semibold">
              {isBreak ? 'Break Remaining' : 'Focus Interval'}
            </span>
          </div>
        </div>
      </div>

      {/* Interval Presets Selector */}
      <div className="flex items-center justify-center space-x-2">
        {[
          { focus: 25, rest: 5, label: '25 / 5' },
          { focus: 30, rest: 5, label: '30 / 5' },
          { focus: 50, rest: 10, label: '50 / 10' },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handleSelectPreset(preset.focus, preset.rest)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
              focusDurationMinutes === preset.focus
                ? 'bg-[#4F8CFF]/15 border-[#4F8CFF]/40 text-[#4F8CFF]'
                : 'bg-[#151D2B] border-[#263244] text-[#9AA7B8] hover:text-[#F5F7FA]'
            }`}
          >
            {preset.label} min
          </button>
        ))}
      </div>

      {/* Primary Action Controls */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        {/* Toggle Local Pause / Resume */}
        <button
          type="button"
          onClick={() => setIsTimerPaused(!isTimerPaused)}
          className="bg-[#151D2B] hover:bg-[#151D2B]/80 text-[#F5F7FA] border border-[#263244] p-3 rounded-xl transition text-xs font-semibold flex items-center justify-center space-x-1.5"
        >
          {isTimerPaused ? <Play className="w-4 h-4 text-[#38D9C5]" /> : <Pause className="w-4 h-4 text-[#F5B942]" />}
          <span>{isTimerPaused ? 'Resume' : 'Pause'}</span>
        </button>

        {/* Start / End Break */}
        {isBreak ? (
          <button
            type="button"
            onClick={() => handleAction('END_BREAK')}
            disabled={actionLoading}
            className="bg-[#38D9C5] hover:bg-[#38D9C5]/90 text-slate-950 p-3 rounded-xl transition text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-[#38D9C5]/20"
          >
            <Play className="w-4 h-4" />
            <span>End Break</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleAction('START_BREAK')}
            disabled={actionLoading}
            className="bg-[#151D2B] hover:bg-[#151D2B]/80 text-[#F5B942] border border-[#F5B942]/30 p-3 rounded-xl transition text-xs font-semibold flex items-center justify-center space-x-1.5"
          >
            <Coffee className="w-4 h-4" />
            <span>Take Break</span>
          </button>
        )}

        {/* Record Cycle Complete (+1) */}
        <button
          type="button"
          onClick={() => handleAction('CYCLE_COMPLETE')}
          disabled={actionLoading}
          className="bg-[#151D2B] hover:bg-[#151D2B]/80 text-[#4F8CFF] border border-[#4F8CFF]/30 p-3 rounded-xl transition text-xs font-semibold flex items-center justify-center space-x-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>+1 Cycle</span>
        </button>

        {/* Finish / End Session */}
        <button
          type="button"
          onClick={() => handleAction('END_SESSION')}
          disabled={actionLoading}
          className="bg-[#FF647C]/10 hover:bg-[#FF647C]/20 text-[#FF647C] border border-[#FF647C]/30 p-3 rounded-xl transition text-xs font-semibold flex items-center justify-center space-x-1.5"
        >
          <Square className="w-4 h-4" />
          <span>End Session</span>
        </button>
      </div>

      {/* Authoritative Elapsed Time Footer */}
      <div className="bg-[#151D2B]/60 border border-[#263244] p-4 rounded-xl flex items-center justify-between text-xs text-[#9AA7B8]">
        <span>Total Authoritative Elapsed Session Time:</span>
        <span className="font-mono font-bold text-[#F5F7FA]">
          {formatDuration(totalElapsedSeconds)}
        </span>
      </div>
    </div>
  );
}
