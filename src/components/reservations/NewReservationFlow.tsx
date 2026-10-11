'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Floor, Seat, Reservation, HardwareState, DerivedSeatState, SeatZone } from '@/types';
import {
  ReservationPreferences,
  validateRequestedInterval,
  evaluateSeatsForInterval,
  SeatAvailabilityResult,
} from '@/lib/services/intervalAvailability';
import FloorMapSvg from '@/components/map/FloorMapSvg';
import SeatStateBadge from '@/components/map/SeatStateBadge';
import {
  X,
  Calendar,
  Clock,
  Sparkles,
  MapPin,
  AlertCircle,
  ShieldCheck,
  Check,
  Zap,
  Monitor,
  ChevronRight,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';

interface NewReservationFlowProps {
  isOpen: boolean;
  onClose: () => void;
  seats: Seat[];
  preselectedSeatId?: string | null;
  onSuccess: () => void;
}

function getInitialTimeWindow(): { date: string; startTime: string; endTime: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const date = `${year}-${month}-${day}`;

  const currentHour = now.getHours();
  const nextHour = (currentHour + 1) % 24;
  const hourAfter = (nextHour + 2) % 24;

  const startTime = `${nextHour.toString().padStart(2, '0')}:00`;
  const endTime = `${hourAfter.toString().padStart(2, '0')}:00`;

  return { date, startTime, endTime };
}

export default function NewReservationFlow({
  isOpen,
  onClose,
  seats,
  preselectedSeatId,
  onSuccess,
}: NewReservationFlowProps) {
  // Step navigation: 1: Schedule & Preferences, 2: Map & Seat Selection
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Time & Date state initialized via helper
  const [initialTimes] = useState(getInitialTimeWindow);
  const todayStr = initialTimes.date;
  const [date, setDate] = useState<string>(initialTimes.date);
  const [startTime, setStartTime] = useState<string>(initialTimes.startTime);
  const [endTime, setEndTime] = useState<string>(initialTimes.endTime);

  // Preferences
  const [preferredZone, setPreferredZone] = useState<SeatZone | ''>('');
  const [requirePower, setRequirePower] = useState(false);
  const [requireMonitor, setRequireMonitor] = useState(false);
  const [requireStandingDesk, setRequireStandingDesk] = useState(false);
  const [requireErgonomicChair, setRequireErgonomicChair] = useState(false);
  const [rankingMode, setRankingMode] = useState<'BEST_MATCH' | 'QUIETEST' | 'ANY'>('BEST_MATCH');

  // Floor Selection
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>(() => {
    if (preselectedSeatId) {
      const s = seats.find((seat) => seat.id === preselectedSeatId);
      if (s?.floorId) return s.floorId;
    }
    return '';
  });

  // Selected Seat & Real-Time Telemetry
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(() => {
    if (preselectedSeatId) {
      return seats.find((s) => s.id === preselectedSeatId) || null;
    }
    return null;
  });
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [hardwareStates, setHardwareStates] = useState<Record<string, HardwareState>>({});

  // UI States
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Floors
  useEffect(() => {
    if (!isOpen) return;

    const unsubFloors = onSnapshot(
      collection(db, 'floors'),
      (snap) => {
        const list: Floor[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Floor));
        list.sort((a, b) => a.floorNumber - b.floorNumber);
        setFloors(list);
        if (list.length > 0 && !selectedFloorId) {
          setSelectedFloorId(list[0]!.id);
        }
      },
      (err) => console.error('Error fetching floors for reservation:', err)
    );
    return () => unsubFloors();
  }, [isOpen, selectedFloorId]);

  // Fetch Hardware States for interval checks
  useEffect(() => {
    if (!isOpen) return;

    const unsubHw = onSnapshot(
      collection(db, 'hardwareStates'),
      (snap) => {
        const map: Record<string, HardwareState> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as HardwareState;
        });
        setHardwareStates(map);
      },
      (err) => console.error('Error fetching hardware states for reservation:', err)
    );
    return () => unsubHw();
  }, [isOpen]);

  // Fetch Active and Checked-in Reservations for selected date
  useEffect(() => {
    if (!isOpen || !date) return;

    const q = query(
      collection(db, 'reservations'),
      where('date', '==', date)
    );

    const unsubRes = onSnapshot(
      q,
      (snap) => {
        const list: Reservation[] = [];
        snap.forEach((d) => {
          const r = { id: d.id, ...d.data() } as Reservation;
          if (r.status === 'active' || r.status === 'checked_in') {
            list.push(r);
          }
        });
        setAllReservations(list);
      },
      (err) => console.error('Error fetching interval reservations:', err)
    );

    return () => unsubRes();
  }, [isOpen, date]);

  // Quick Duration helper
  const setQuickDuration = (hours: number) => {
    const [startH, startM] = startTime.split(':').map(Number);
    if (isNaN(startH!) || isNaN(startM!)) return;
    const endMinutes = startH! * 60 + startM! + hours * 60;
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = endMinutes % 60;
    setEndTime(`${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`);
  };

  // Build validated interval
  const validatedIntervalResult = useMemo(() => {
    return validateRequestedInterval(date, startTime, endTime);
  }, [date, startTime, endTime]);

  // Active preferences
  const preferences: ReservationPreferences = useMemo(() => ({
    zone: preferredZone,
    requirePower,
    requireMonitor,
    requireStandingDesk,
    requireErgonomicChair,
    rankingMode,
  }), [preferredZone, requirePower, requireMonitor, requireStandingDesk, requireErgonomicChair, rankingMode]);

  // Evaluated seats
  const evaluatedData = useMemo(() => {
    if (!validatedIntervalResult.valid || !validatedIntervalResult.interval) {
      const derivedFallback: Record<string, DerivedSeatState> = {};
      seats.forEach((s) => {
        derivedFallback[s.id] = s.isMaintenance ? 'MAINTENANCE' : 'AVAILABLE';
      });
      return {
        results: [],
        derivedStates: derivedFallback,
        availableCount: 0,
      };
    }

    return evaluateSeatsForInterval(
      seats,
      validatedIntervalResult.interval,
      allReservations,
      hardwareStates,
      preferences
    );
  }, [seats, validatedIntervalResult, allReservations, hardwareStates, preferences]);

  // Filter seats for current floor
  const floorSeats = useMemo(() => {
    if (!selectedFloorId) return seats;
    return seats.filter((s) => s.floorId === selectedFloorId);
  }, [seats, selectedFloorId]);

  const activeFloor = useMemo(() => {
    return floors.find((f) => f.id === selectedFloorId) || floors[0];
  }, [floors, selectedFloorId]);

  // Highest recommended seats
  const topRecommendations = useMemo(() => {
    return evaluatedData.results
      .filter((r) => r.isAvailable)
      .slice(0, 3)
      .map((r) => {
        const seatObj = seats.find((s) => s.id === r.seatId);
        return {
          ...r,
          seat: seatObj,
        };
      })
      .filter((r): r is SeatAvailabilityResult & { seat: Seat } => Boolean(r.seat));
  }, [evaluatedData.results, seats]);

  // Validation before proceeding to Map
  const handleProceedToMap = () => {
    if (!validatedIntervalResult.valid) {
      setValidationError(validatedIntervalResult.errorMessage || 'Invalid time interval selected.');
      return;
    }
    setValidationError(null);
    setSubmissionError(null);
    setCurrentStep(2);
  };

  // Seat selection handler
  const handleSelectSeat = useCallback((seat: Seat) => {
    setSubmissionError(null);
    const seatEval = evaluatedData.results.find((r) => r.seatId === seat.id);

    if (seat.isMaintenance) {
      setSubmissionError(`Seat ${seat.seatNumber} is under maintenance and cannot be reserved.`);
      return;
    }

    if (seatEval && !seatEval.isAvailable) {
      setSubmissionError(`Seat ${seat.seatNumber} is not available: ${seatEval.reason || 'Already reserved for this time slot.'}`);
      return;
    }

    setSelectedSeat(seat);
  }, [evaluatedData.results]);

  // Submit reservation transaction to backend
  const handleConfirmReservation = async () => {
    if (!selectedSeat) {
      setSubmissionError('Please select an available desk from the map.');
      return;
    }

    if (!validatedIntervalResult.valid || !validatedIntervalResult.interval) {
      setSubmissionError('Invalid reservation interval.');
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);

    const { interval } = validatedIntervalResult;

    try {
      const res = await fetch('/api/v1/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId: selectedSeat.id,
          date: interval.date,
          startTimeIso: interval.startTimeIso,
          endTimeIso: interval.endTimeIso,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 || data.error === 'RESERVATION_CONFLICT' || data.error === 'SEAT_IN_MAINTENANCE') {
          throw new Error('This seat is no longer available for the selected time. Please choose another seat.');
        }
        throw new Error(data.message || 'Failed to confirm reservation.');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Reservation submission error:', err);
      const msg = err instanceof Error ? err.message : 'Reservation failed.';
      setSubmissionError(msg);
      setSelectedSeat(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedSeatEval = selectedSeat
    ? evaluatedData.results.find((r) => r.seatId === selectedSeat.id)
    : null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#101621] border border-[#263244] rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#263244] flex items-center justify-between bg-[#151D2B]/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#4F8CFF]/10 text-[#4F8CFF] border border-[#4F8CFF]/20 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-[#F5F7FA]">New Study Desk Reservation</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#151D2B] border border-[#263244] text-[#38D9C5]">
                  Step {currentStep} of 2
                </span>
              </div>
              <p className="text-xs text-[#9AA7B8]">
                {currentStep === 1
                  ? 'Define booking schedule, duration, and study preferences'
                  : 'Review interval availability on the interactive floor map and select desk'}
              </p>
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

        {/* Modal Main Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Global Alert Notification */}
          {submissionError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submissionError}</span>
            </div>
          )}

          {/* STEP 1: DATE, TIME & PREFERENCES */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {validationError && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3.5 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Section 1: Schedule Selection */}
              <div className="bg-[#151D2B]/50 border border-[#263244] p-5 rounded-2xl space-y-4">
                <div className="flex items-center space-x-2 text-xs font-semibold text-[#4F8CFF] uppercase tracking-wider">
                  <Clock className="w-4 h-4" />
                  <span>1. Schedule & Duration Window</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Date Input */}
                  <div>
                    <label className="block text-xs font-semibold text-[#9AA7B8] uppercase tracking-wider mb-1.5">
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      min={todayStr}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full bg-[#101621] border border-[#263244] rounded-xl px-4 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#4F8CFF]"
                    />
                  </div>

                  {/* Start Time */}
                  <div>
                    <label className="block text-xs font-semibold text-[#9AA7B8] uppercase tracking-wider mb-1.5">
                      From Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                      className="w-full bg-[#101621] border border-[#263244] rounded-xl px-4 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#4F8CFF]"
                    />
                  </div>

                  {/* End Time */}
                  <div>
                    <label className="block text-xs font-semibold text-[#9AA7B8] uppercase tracking-wider mb-1.5">
                      To Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      className="w-full bg-[#101621] border border-[#263244] rounded-xl px-4 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#4F8CFF]"
                    />
                  </div>
                </div>

                {/* Quick Duration Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-[#9AA7B8] mr-1">Quick Duration:</span>
                  {[
                    { label: '+1 Hour', hours: 1 },
                    { label: '+2 Hours', hours: 2 },
                    { label: '+3 Hours', hours: 3 },
                    { label: '+4 Hours (Max)', hours: 4 },
                  ].map((pill) => (
                    <button
                      key={pill.label}
                      type="button"
                      onClick={() => setQuickDuration(pill.hours)}
                      className="px-3 py-1 bg-[#101621] hover:bg-[#101621]/80 border border-[#263244] hover:border-[#4F8CFF]/50 text-[11px] text-[#F5F7FA] rounded-lg transition"
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {/* Duration Status Display */}
                {validatedIntervalResult.valid && validatedIntervalResult.interval && (
                  <div className="bg-[#080B12] border border-[#263244] p-3 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-[#9AA7B8]">Selected Window Duration:</span>
                    <span className="text-[#38D9C5] font-semibold">
                      {Math.floor(validatedIntervalResult.interval.durationMinutes / 60)}h{' '}
                      {validatedIntervalResult.interval.durationMinutes % 60 > 0
                        ? `${validatedIntervalResult.interval.durationMinutes % 60}m`
                        : ''}{' '}
                      ({validatedIntervalResult.interval.durationMinutes} minutes total)
                    </span>
                  </div>
                )}
              </div>

              {/* Section 2: Study Preferences */}
              <div className="bg-[#151D2B]/50 border border-[#263244] p-5 rounded-2xl space-y-4">
                <div className="flex items-center space-x-2 text-xs font-semibold text-[#4F8CFF] uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-[#38D9C5]" />
                  <span>2. Study Preferences & Amenities</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Preferred Zone */}
                  <div>
                    <label className="block text-xs font-semibold text-[#9AA7B8] uppercase tracking-wider mb-1.5">
                      Preferred Zone
                    </label>
                    <select
                      value={preferredZone}
                      onChange={(e) => setPreferredZone(e.target.value as SeatZone | '')}
                      className="w-full bg-[#101621] border border-[#263244] rounded-xl px-4 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#4F8CFF]"
                    >
                      <option value="">Any Zone (No preference)</option>
                      <option value="Quiet Zone">Quiet Zone (High Focus)</option>
                      <option value="Collaborative">Collaborative Zone</option>
                      <option value="Window">Window Workstations</option>
                      <option value="Group Study">Group Study Pods</option>
                    </select>
                  </div>

                  {/* Ranking Priority Mode */}
                  <div>
                    <label className="block text-xs font-semibold text-[#9AA7B8] uppercase tracking-wider mb-1.5">
                      Recommendation Mode
                    </label>
                    <select
                      value={rankingMode}
                      onChange={(e) => setRankingMode(e.target.value as 'BEST_MATCH' | 'QUIETEST' | 'ANY')}
                      className="w-full bg-[#101621] border border-[#263244] rounded-xl px-4 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#4F8CFF]"
                    >
                      <option value="BEST_MATCH">Best Overall Feature Match</option>
                      <option value="QUIETEST">Prioritize Quiet Zone First</option>
                      <option value="ANY">Any Available Desk</option>
                    </select>
                  </div>
                </div>

                {/* Amenities Toggles */}
                <div>
                  <label className="block text-xs font-semibold text-[#9AA7B8] uppercase tracking-wider mb-2">
                    Required Hardware & Amenities
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      {
                        label: 'Power Outlet',
                        checked: requirePower,
                        toggle: () => setRequirePower(!requirePower),
                        icon: Zap,
                      },
                      {
                        label: 'External Monitor',
                        checked: requireMonitor,
                        toggle: () => setRequireMonitor(!requireMonitor),
                        icon: Monitor,
                      },
                      {
                        label: 'Standing Desk',
                        checked: requireStandingDesk,
                        toggle: () => setRequireStandingDesk(!requireStandingDesk),
                        icon: ShieldCheck,
                      },
                      {
                        label: 'Ergonomic Chair',
                        checked: requireErgonomicChair,
                        toggle: () => setRequireErgonomicChair(!requireErgonomicChair),
                        icon: ShieldCheck,
                      },
                    ].map((amenity) => {
                      const Icon = amenity.icon;
                      return (
                        <button
                          key={amenity.label}
                          type="button"
                          onClick={amenity.toggle}
                          className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                            amenity.checked
                              ? 'bg-[#4F8CFF]/15 border-[#4F8CFF]/50 text-[#F5F7FA]'
                              : 'bg-[#101621] border-[#263244] text-[#9AA7B8] hover:text-[#F5F7FA]'
                          }`}
                        >
                          <span className="flex items-center space-x-1.5">
                            <Icon className={`w-3.5 h-3.5 ${amenity.checked ? 'text-[#38D9C5]' : 'text-[#9AA7B8]'}`} />
                            <span>{amenity.label}</span>
                          </span>
                          {amenity.checked && <Check className="w-3.5 h-3.5 text-[#38D9C5]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: LIVE FLOOR MAP & SEAT SELECTION */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Interval Summary Bar */}
              <div className="bg-[#151D2B] border border-[#263244] p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-[#38D9C5]/10 text-[#38D9C5] flex items-center justify-center font-bold text-xs">
                    {evaluatedData.availableCount}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#F5F7FA] flex items-center space-x-2">
                      <span>{date}</span>
                      <span>·</span>
                      <span className="text-[#38D9C5]">
                        {startTime} – {endTime}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9AA7B8]">
                      {evaluatedData.availableCount} of {seats.length} total seats available for this requested interval
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-3 py-1.5 bg-[#101621] hover:bg-[#101621]/80 border border-[#263244] text-[#9AA7B8] hover:text-[#F5F7FA] rounded-xl text-xs flex items-center space-x-1.5 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Change Interval</span>
                  </button>
                </div>
              </div>

              {/* Best Match Recommendations Banner */}
              {topRecommendations.length > 0 && (
                <div className="bg-[#101621] border border-[#263244] p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#4F8CFF] uppercase tracking-wider flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#38D9C5]" />
                      <span>Recommended Best Matches</span>
                    </span>
                    <span className="text-[11px] text-[#9AA7B8]">Click recommendation to select desk</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {topRecommendations.map((rec) => (
                      <button
                        key={rec.seatId}
                        type="button"
                        onClick={() => {
                          setSelectedFloorId(rec.seat.floorId);
                          handleSelectSeat(rec.seat);
                        }}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          selectedSeat?.id === rec.seatId
                            ? 'bg-[#4F8CFF]/15 border-[#4F8CFF] shadow-md shadow-[#4F8CFF]/10'
                            : 'bg-[#151D2B] border-[#263244] hover:border-[#4F8CFF]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-[#F5F7FA]">Desk {rec.seat.seatNumber}</span>
                          <span className="text-[10px] font-bold text-[#38D9C5] bg-[#38D9C5]/10 border border-[#38D9C5]/20 px-1.5 py-0.5 rounded">
                            {rec.matchScore}% Match
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9AA7B8]">
                          {rec.seat.zone} • {rec.seat.features.join(', ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Floor Switcher & Map Controls */}
              <div className="bg-[#101621] border border-[#263244] p-3 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-[#9AA7B8] font-medium mr-1">Floor:</span>
                  {floors.map((fl) => (
                    <button
                      key={fl.id}
                      type="button"
                      onClick={() => setSelectedFloorId(fl.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                        selectedFloorId === fl.id
                          ? 'bg-[#4F8CFF] text-[#F5F7FA] border-[#4F8CFF]'
                          : 'bg-[#151D2B] text-[#9AA7B8] border-[#263244] hover:text-[#F5F7FA]'
                      }`}
                    >
                      {fl.name}
                    </button>
                  ))}
                </div>

                {/* Map Legend */}
                <div className="hidden sm:flex items-center space-x-2 text-xs">
                  <SeatStateBadge state="AVAILABLE" />
                  <SeatStateBadge state="RESERVED" />
                  <SeatStateBadge state="MAINTENANCE" />
                </div>
              </div>

              {/* Interactive SVG Floor Map */}
              {activeFloor ? (
                <div className="relative">
                  <FloorMapSvg
                    floor={activeFloor}
                    seats={floorSeats}
                    derivedStates={evaluatedData.derivedStates}
                    selectedSeatId={selectedSeat?.id || null}
                    onSelectSeat={handleSelectSeat}
                  />
                  <div className="mt-2 text-[11px] text-[#9AA7B8] text-center">
                    Click any highlighted green desk on the spatial floor plan to inspect details and reserve.
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-[#9AA7B8] bg-[#101621] rounded-2xl border border-[#263244]">
                  No floor layout data available.
                </div>
              )}

              {/* Selected Desk Confirmation Box */}
              {selectedSeat && (
                <div className="bg-[#151D2B] border border-[#4F8CFF]/50 p-5 rounded-2xl space-y-3 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between border-b border-[#263244] pb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-[#4F8CFF]/20 text-[#4F8CFF] flex items-center justify-center font-bold text-xs">
                        {selectedSeat.seatNumber}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#F5F7FA]">Selected: Desk {selectedSeat.seatNumber}</h4>
                        <p className="text-xs text-[#9AA7B8] flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-[#38D9C5]" />
                          <span>{selectedSeat.zone}</span>
                        </p>
                      </div>
                    </div>

                    {selectedSeatEval && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#38D9C5]/10 text-[#38D9C5] border border-[#38D9C5]/20">
                        {selectedSeatEval.matchScore}% Match
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#9AA7B8]">
                    <div>
                      <span className="font-semibold text-[#F5F7FA]">Amenities: </span>
                      {selectedSeat.features.join(', ') || 'Standard Desk'}
                    </div>
                    <div>
                      <span className="font-semibold text-[#F5F7FA]">Occupancy Sensor: </span>
                      <span className={selectedSeat.isHardwareMonitored ? 'text-[#38D9C5]' : 'text-[#9AA7B8]'}>
                        {selectedSeat.isHardwareMonitored ? 'Camera Monitored (Active)' : 'Standard'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#080B12] border border-[#263244] rounded-xl flex items-center justify-between text-xs">
                    <span className="text-[#9AA7B8]">Final Booking Reservation Window:</span>
                    <span className="text-[#38D9C5] font-bold">
                      {date} · {startTime} – {endTime}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Navigation */}
        <div className="px-6 py-4 border-t border-[#263244] bg-[#151D2B]/80 flex items-center justify-between">
          {currentStep === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#263244] text-xs font-medium text-[#9AA7B8] hover:text-[#F5F7FA] transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleProceedToMap}
                className="bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 text-[#F5F7FA] font-semibold px-5 py-2.5 rounded-xl transition flex items-center space-x-2 text-xs shadow-lg shadow-[#4F8CFF]/20"
              >
                <span>Find Available Seats</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 rounded-xl border border-[#263244] text-xs font-medium text-[#9AA7B8] hover:text-[#F5F7FA] transition flex items-center space-x-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Time & Preferences</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmReservation}
                disabled={submitting || !selectedSeat}
                className="bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 disabled:bg-[#151D2B] disabled:text-[#9AA7B8] text-[#F5F7FA] font-semibold px-6 py-2.5 rounded-xl transition flex items-center space-x-2 text-xs shadow-lg shadow-[#4F8CFF]/20"
              >
                {submitting ? (
                  <span>Locking Slot on Server...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm & Lock Reservation</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
