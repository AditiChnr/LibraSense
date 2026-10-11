import { Seat, SeatZone, SeatFeature, Reservation, HardwareState, DerivedSeatState, SystemConfig } from '@/types';

export interface RequestedInterval {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  startTimeIso: string; // ISO string e.g. 2026-10-11T14:00:00.000Z
  endTimeIso: string; // ISO string e.g. 2026-10-11T16:00:00.000Z
  durationMinutes: number;
}

export interface IntervalValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
  interval?: RequestedInterval;
}

export interface ReservationPreferences {
  zone?: SeatZone | '';
  requirePower?: boolean;
  requireMonitor?: boolean;
  requireStandingDesk?: boolean;
  requireErgonomicChair?: boolean;
  rankingMode?: 'BEST_MATCH' | 'QUIETEST' | 'ANY';
}

export interface SeatAvailabilityResult {
  seatId: string;
  isAvailable: boolean;
  state: DerivedSeatState;
  reason?: string;
  matchScore: number;
  matchReasons: string[];
}

/**
 * Validates a user-selected reservation date and time interval.
 */
export function validateRequestedInterval(
  date: string,
  startTime: string,
  endTime: string,
  config?: Partial<SystemConfig>,
  nowIso: string = new Date().toISOString()
): IntervalValidationResult {
  const maxDurationMinutes = config?.maxDurationMinutes ?? 240; // Default 4 hours
  const maxBookingLeadDays = config?.maxBookingLeadDays ?? 7;

  // 1. Basic format checks
  if (!date || !startTime || !endTime) {
    return { valid: false, errorCode: 'MISSING_FIELDS', errorMessage: 'Date, start time, and end time are required.' };
  }

  const [startH, startM] = startTime.split(':').map((v) => parseInt(v, 10));
  const [endH, endM] = endTime.split(':').map((v) => parseInt(v, 10));

  if (isNaN(startH!) || isNaN(startM!) || isNaN(endH!) || isNaN(endM!)) {
    return { valid: false, errorCode: 'INVALID_TIME_FORMAT', errorMessage: 'Please specify times in valid HH:MM format.' };
  }

  const totalStartMinutes = startH! * 60 + startM!;
  const totalEndMinutes = endH! * 60 + endM!;
  const durationMinutes = totalEndMinutes - totalStartMinutes;

  if (durationMinutes <= 0) {
    return { valid: false, errorCode: 'INVALID_TIME_RANGE', errorMessage: 'End time must be later than start time.' };
  }

  if (durationMinutes > maxDurationMinutes) {
    return {
      valid: false,
      errorCode: 'MAX_DURATION_EXCEEDED',
      errorMessage: `Reservation duration cannot exceed ${Math.floor(maxDurationMinutes / 60)} hours (${maxDurationMinutes} minutes).`,
    };
  }

  // 2. Date checks against now
  const now = new Date(nowIso);
  const nowUtcYear = now.getUTCFullYear();
  const nowUtcMonth = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const nowUtcDate = now.getUTCDate().toString().padStart(2, '0');
  const todayDateStr = `${nowUtcYear}-${nowUtcMonth}-${nowUtcDate}`;

  // Reject past dates
  if (date < todayDateStr) {
    return { valid: false, errorCode: 'PAST_DATE', errorMessage: 'Reservation date cannot be in the past.' };
  }

  // Check max lead days
  const reqDateObj = new Date(`${date}T00:00:00.000Z`);
  const todayDateObj = new Date(`${todayDateStr}T00:00:00.000Z`);
  const diffDays = Math.round((reqDateObj.getTime() - todayDateObj.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays > maxBookingLeadDays) {
    return {
      valid: false,
      errorCode: 'LEAD_DAYS_EXCEEDED',
      errorMessage: `Reservations cannot be booked more than ${maxBookingLeadDays} days in advance.`,
    };
  }

  // Construct ISO strings
  const startTimeIso = `${date}T${startTime.padStart(5, '0')}:00.000Z`;
  const endTimeIso = `${date}T${endTime.padStart(5, '0')}:00.000Z`;

  const startMs = new Date(startTimeIso).getTime();
  const nowMs = now.getTime();

  // If booking for today, check that start time is not in past (with 1 minute leeway for submission)
  if (date === todayDateStr && startMs < nowMs - 60000) {
    return { valid: false, errorCode: 'START_TIME_IN_PAST', errorMessage: 'Reservation start time cannot be in the past.' };
  }

  return {
    valid: true,
    interval: {
      date,
      startTime,
      endTime,
      startTimeIso,
      endTimeIso,
      durationMinutes,
    },
  };
}

/**
 * Checks whether an interval [startA, endA) overlaps with [startB, endB).
 * Exact slot boundaries (e.g. 10:00-11:00 and 11:00-12:00) do NOT overlap.
 */
export function intervalsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();

  return aStart < bEnd && aEnd > bStart;
}

/**
 * Evaluates whether a specific seat is available for the requested time interval.
 */
export function isSeatAvailableForInterval(
  seat: Seat,
  interval: RequestedInterval,
  reservations: Reservation[],
  hardwareState?: HardwareState,
  nowIso: string = new Date().toISOString()
): { isAvailable: boolean; state: DerivedSeatState; reason?: string } {
  // 1. Maintenance Check
  if (seat.isMaintenance) {
    return { isAvailable: false, state: 'MAINTENANCE', reason: 'Seat is under maintenance' };
  }

  // 2. Overlap Check with Active or Checked-In Reservations
  const overlappingReservation = reservations.find((r) => {
    if (r.seatId !== seat.id) return false;
    if (r.status !== 'active' && r.status !== 'checked_in') return false;
    return intervalsOverlap(interval.startTimeIso, interval.endTimeIso, r.startTime, r.endTime);
  });

  if (overlappingReservation) {
    return {
      isAvailable: false,
      state: 'RESERVED',
      reason: `Already reserved from ${overlappingReservation.startTime.substring(11, 16)} to ${overlappingReservation.endTime.substring(11, 16)}`,
    };
  }

  // 3. Hardware State Check for Currently Active Intervals
  const nowMs = new Date(nowIso).getTime();
  const startMs = new Date(interval.startTimeIso).getTime();
  const endMs = new Date(interval.endTimeIso).getTime();

  // If interval encompasses current time, verify physical desk occupancy
  if (nowMs >= startMs && nowMs < endMs) {
    if (hardwareState?.occupied) {
      return {
        isAvailable: false,
        state: 'OCCUPIED_UNAUTHORIZED',
        reason: 'Desk is currently physically occupied',
      };
    }
  }

  return { isAvailable: true, state: 'AVAILABLE' };
}

/**
 * Computes deterministic match score (0..100) based on user preferences.
 */
export function computeSeatPreferenceScore(
  seat: Seat,
  isAvailable: boolean,
  prefs: ReservationPreferences
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (isAvailable) {
    score += 40;
    reasons.push('Available for requested interval');
  } else {
    reasons.push('Not available for interval');
    return { score: 0, reasons };
  }

  // Zone Matching
  const targetZone = prefs.rankingMode === 'QUIETEST' ? 'Quiet Zone' : prefs.zone;
  if (targetZone) {
    if (seat.zone === targetZone) {
      score += 30;
      reasons.push(`Matches ${targetZone}`);
    } else {
      reasons.push(`In ${seat.zone} (Preferred: ${targetZone})`);
    }
  } else {
    score += 15; // Neutral zone preference
  }

  // Amenities Matching
  const requestedFeatures: SeatFeature[] = [];
  if (prefs.requirePower) requestedFeatures.push('Power Outlet');
  if (prefs.requireMonitor) requestedFeatures.push('Monitor');
  if (prefs.requireStandingDesk) requestedFeatures.push('Standing Desk');
  if (prefs.requireErgonomicChair) requestedFeatures.push('Ergonomic Chair');

  if (requestedFeatures.length > 0) {
    let matchedCount = 0;
    requestedFeatures.forEach((feat) => {
      if (seat.features.includes(feat)) matchedCount++;
    });

    const weightPerFeature = 25 / requestedFeatures.length;
    score += matchedCount * weightPerFeature;

    if (matchedCount === requestedFeatures.length) {
      reasons.push(`Has all ${matchedCount} requested amenities`);
    } else if (matchedCount > 0) {
      reasons.push(`Has ${matchedCount}/${requestedFeatures.length} requested amenities`);
    }
  } else {
    score += 20; // Default feature points
  }

  // Monitored bonus
  if (seat.isHardwareMonitored) {
    score += 5;
    reasons.push('Camera sensor monitored');
  }

  return {
    score: Math.min(100, Math.round(score)),
    reasons,
  };
}

/**
 * Derives map states and preference scores for all seats for a given interval.
 */
export function evaluateSeatsForInterval(
  seats: Seat[],
  interval: RequestedInterval,
  reservations: Reservation[],
  hardwareStates: Record<string, HardwareState> = {},
  preferences: ReservationPreferences = {},
  nowIso: string = new Date().toISOString()
): {
  results: SeatAvailabilityResult[];
  derivedStates: Record<string, DerivedSeatState>;
  availableCount: number;
} {
  const derivedStates: Record<string, DerivedSeatState> = {};
  const results: SeatAvailabilityResult[] = [];
  let availableCount = 0;

  for (const seat of seats) {
    const hw = hardwareStates[seat.id];
    const avail = isSeatAvailableForInterval(seat, interval, reservations, hw, nowIso);
    derivedStates[seat.id] = avail.state;

    if (avail.isAvailable) {
      availableCount++;
    }

    const { score, reasons } = computeSeatPreferenceScore(seat, avail.isAvailable, preferences);

    results.push({
      seatId: seat.id,
      isAvailable: avail.isAvailable,
      state: avail.state,
      reason: avail.reason,
      matchScore: score,
      matchReasons: reasons,
    });
  }

  // Sort descending: available seats first, then highest preference score
  results.sort((a, b) => {
    if (a.isAvailable !== b.isAvailable) {
      return a.isAvailable ? -1 : 1;
    }
    return b.matchScore - a.matchScore;
  });

  return {
    results,
    derivedStates,
    availableCount,
  };
}
