import { StudySession, Reservation, Seat, SeatZone } from '@/types';

export interface PersonalStudyStats {
  totalStudySeconds: number;
  totalStudyHoursFormatted: string;
  completedSessionsCount: number;
  averageSessionDurationMinutes: number;
  totalBreakSeconds: number;
  totalPomodoroCycles: number;
  todayStudySeconds: number;
  thisWeekStudySeconds: number;
  thisMonthStudySeconds: number;
}

export interface DayStudyTrend {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Mon, Oct 5"
  studyMinutes: number;
  breakMinutes: number;
  sessionCount: number;
  pomodoroCycles: number;
  hasData: boolean;
}

export interface HourlyCongestion {
  hour: number; // 8..21 (8 AM to 9 PM)
  hourLabel: string; // "08:00", "09:00", etc.
  bookingCount: number;
  occupancyScore: number; // 0..100 relative index
}

export interface ZoneUtilization {
  zone: SeatZone;
  seatCount: number;
  activeBookingCount: number;
  utilizationPercentage: number;
}

export interface SeatUtilizationMetric {
  seatId: string;
  seatNumber: string;
  zone: SeatZone;
  totalBookings: number;
  totalStudyMinutes: number;
}

export interface ReservationMetrics {
  total: number;
  active: number;
  checkedIn: number;
  completed: number;
  noShow: number;
  cancelled: number;
  checkInRatePercentage: number;
  noShowRatePercentage: number;
  cancellationRatePercentage: number;
}

export interface ExplainableInsight {
  id: string;
  category: 'peak_hours' | 'best_time' | 'zone_preference' | 'reliability';
  title: string;
  description: string;
  recommendation: string;
}

/**
 * Computes comprehensive personal study statistics from authoritative session records.
 */
export function computePersonalStudyStats(sessions: StudySession[]): PersonalStudyStats {
  const completedSessions = sessions.filter((s) => s.status === 'ended' || s.studyDurationSeconds > 0);
  
  const totalStudySeconds = completedSessions.reduce((acc, s) => acc + (s.studyDurationSeconds || 0), 0);
  const totalBreakSeconds = completedSessions.reduce((acc, s) => acc + (s.breakDurationSeconds || 0), 0);
  const totalPomodoroCycles = completedSessions.reduce((acc, s) => acc + (s.pomodoroCyclesCompleted || 0), 0);
  const completedSessionsCount = completedSessions.length;

  const averageSessionDurationMinutes = completedSessionsCount > 0
    ? Math.round(totalStudySeconds / completedSessionsCount / 60)
    : 0;

  const hours = (totalStudySeconds / 3600).toFixed(1);

  // Time boundaries in UTC/Local agnostic format
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]!;

  const oneWeekAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgoMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  let todayStudySeconds = 0;
  let thisWeekStudySeconds = 0;
  let thisMonthStudySeconds = 0;

  completedSessions.forEach((s) => {
    const sessionTimeMs = new Date(s.startTime).getTime();
    const sessionDateStr = s.startTime.split('T')[0]!;

    if (sessionDateStr === todayStr) {
      todayStudySeconds += s.studyDurationSeconds || 0;
    }
    if (sessionTimeMs >= oneWeekAgoMs) {
      thisWeekStudySeconds += s.studyDurationSeconds || 0;
    }
    if (sessionTimeMs >= oneMonthAgoMs) {
      thisMonthStudySeconds += s.studyDurationSeconds || 0;
    }
  });

  return {
    totalStudySeconds,
    totalStudyHoursFormatted: `${hours}h`,
    completedSessionsCount,
    averageSessionDurationMinutes,
    totalBreakSeconds,
    totalPomodoroCycles,
    todayStudySeconds,
    thisWeekStudySeconds,
    thisMonthStudySeconds,
  };
}

/**
 * Computes daily study trends over a requested number of days (default: 7).
 * Ensures zero-fill for days without activity and flags hasData.
 */
export function computeDailyStudyTrend(
  sessions: StudySession[],
  daysCount: number = 7,
  referenceDate: Date = new Date()
): DayStudyTrend[] {
  const result: DayStudyTrend[] = [];
  const sessionMap = new Map<string, StudySession[]>();

  sessions.forEach((s) => {
    const dateStr = s.startTime.split('T')[0]!;
    const list = sessionMap.get(dateStr) || [];
    list.push(s);
    sessionMap.set(dateStr, list);
  });

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0]!;
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const daySessions = sessionMap.get(dateStr) || [];
    const studySeconds = daySessions.reduce((acc, s) => acc + (s.studyDurationSeconds || 0), 0);
    const breakSeconds = daySessions.reduce((acc, s) => acc + (s.breakDurationSeconds || 0), 0);
    const pomodoroCycles = daySessions.reduce((acc, s) => acc + (s.pomodoroCyclesCompleted || 0), 0);

    result.push({
      date: dateStr,
      dayLabel,
      studyMinutes: Math.round(studySeconds / 60),
      breakMinutes: Math.round(breakSeconds / 60),
      sessionCount: daySessions.length,
      pomodoroCycles,
      hasData: daySessions.length > 0,
    });
  }

  return result;
}

/**
 * Aggregates library occupancy distribution by hour of day (08:00 to 21:00).
 */
export function computeHourlyOccupancyTrends(
  reservations: Reservation[],
  sessions: StudySession[]
): HourlyCongestion[] {
  const hourCounts: Record<number, number> = {};
  for (let h = 8; h <= 21; h++) {
    hourCounts[h] = 0;
  }

  const extractHour = (iso: string): number => {
    if (iso.includes('T')) {
      const timePart = iso.split('T')[1]!;
      const h = parseInt(timePart.split(':')[0]!, 10);
      if (!isNaN(h)) return h;
    }
    const d = new Date(iso);
    return isNaN(d.getTime()) ? 12 : d.getUTCHours();
  };

  // Count reservations spanning hours
  reservations.forEach((r) => {
    if (r.status === 'cancelled' || !r.startTime || !r.endTime) return;
    try {
      const startH = extractHour(r.startTime);
      const endH = extractHour(r.endTime);
      for (let h = Math.max(8, startH); h <= Math.min(21, endH); h++) {
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }
    } catch {
      // Ignore timestamp parsing errors
    }
  });

  // Count sessions
  sessions.forEach((s) => {
    if (!s.startTime) return;
    try {
      const startH = extractHour(s.startTime);
      const endH = s.endTime ? extractHour(s.endTime) : startH + 1;
      for (let h = Math.max(8, startH); h <= Math.min(21, endH); h++) {
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }
    } catch {
      // Ignore timestamp parsing errors
    }
  });

  const maxCount = Math.max(1, ...Object.values(hourCounts));

  const result: HourlyCongestion[] = [];
  for (let h = 8; h <= 21; h++) {
    const count = hourCounts[h] || 0;
    const hourPad = h.toString().padStart(2, '0');
    result.push({
      hour: h,
      hourLabel: `${hourPad}:00`,
      bookingCount: count,
      occupancyScore: Math.round((count / maxCount) * 100),
    });
  }

  return result;
}

/**
 * Computes seat utilization by zone and individual desk popularity.
 */
export function computeSeatUtilizationStats(
  seats: Seat[],
  reservations: Reservation[],
  sessions: StudySession[]
): {
  zoneBreakdown: ZoneUtilization[];
  mostUtilizedSeats: SeatUtilizationMetric[];
  leastUtilizedSeats: SeatUtilizationMetric[];
} {
  const zoneMap: Record<SeatZone, { seatCount: number; activeBookings: number }> = {
    'Quiet Zone': { seatCount: 0, activeBookings: 0 },
    'Collaborative': { seatCount: 0, activeBookings: 0 },
    'Window': { seatCount: 0, activeBookings: 0 },
    'Group Study': { seatCount: 0, activeBookings: 0 },
  };

  const seatMetricMap = new Map<string, { bookings: number; studyMinutes: number }>();

  seats.forEach((seat) => {
    if (zoneMap[seat.zone]) {
      zoneMap[seat.zone].seatCount++;
    }
    seatMetricMap.set(seat.id, { bookings: 0, studyMinutes: 0 });
  });

  reservations.forEach((r) => {
    if (r.status === 'cancelled') return;
    const metric = seatMetricMap.get(r.seatId);
    if (metric) {
      metric.bookings++;
    }
    const targetSeat = seats.find((s) => s.id === r.seatId);
    if (targetSeat && zoneMap[targetSeat.zone]) {
      zoneMap[targetSeat.zone].activeBookings++;
    }
  });

  sessions.forEach((s) => {
    const metric = seatMetricMap.get(s.seatId);
    if (metric) {
      metric.studyMinutes += Math.round((s.studyDurationSeconds || 0) / 60);
    }
  });

  const zoneBreakdown: ZoneUtilization[] = Object.entries(zoneMap).map(([zone, data]) => {
    const utilPct = data.seatCount > 0 ? Math.min(100, Math.round((data.activeBookings / (data.seatCount * 3)) * 100)) : 0;
    return {
      zone: zone as SeatZone,
      seatCount: data.seatCount,
      activeBookingCount: data.activeBookings,
      utilizationPercentage: utilPct,
    };
  });

  const allSeatMetrics: SeatUtilizationMetric[] = seats.map((seat) => {
    const data = seatMetricMap.get(seat.id) || { bookings: 0, studyMinutes: 0 };
    return {
      seatId: seat.id,
      seatNumber: seat.seatNumber,
      zone: seat.zone,
      totalBookings: data.bookings,
      totalStudyMinutes: data.studyMinutes,
    };
  });

  allSeatMetrics.sort((a, b) => b.totalBookings - a.totalBookings || b.totalStudyMinutes - a.totalStudyMinutes);

  const mostUtilizedSeats = allSeatMetrics.slice(0, 5);
  const leastUtilizedSeats = [...allSeatMetrics].reverse().slice(0, 5);

  return {
    zoneBreakdown,
    mostUtilizedSeats,
    leastUtilizedSeats,
  };
}

/**
 * Computes reservation conversion, cancellation, and no-show metrics.
 */
export function computeReservationMetrics(reservations: Reservation[]): ReservationMetrics {
  const total = reservations.length;
  let active = 0;
  let checkedIn = 0;
  let completed = 0;
  let noShow = 0;
  let cancelled = 0;

  reservations.forEach((r) => {
    switch (r.status) {
      case 'active':
        active++;
        break;
      case 'checked_in':
        checkedIn++;
        break;
      case 'completed':
        completed++;
        break;
      case 'no_show':
        noShow++;
        break;
      case 'cancelled':
        cancelled++;
        break;
    }
  });

  const checkInRatePercentage = total > 0 ? Math.round(((checkedIn + completed) / total) * 100) : 0;
  const noShowRatePercentage = total > 0 ? Math.round((noShow / total) * 100) : 0;
  const cancellationRatePercentage = total > 0 ? Math.round((cancelled / total) * 100) : 0;

  return {
    total,
    active,
    checkedIn,
    completed,
    noShow,
    cancelled,
    checkInRatePercentage,
    noShowRatePercentage,
    cancellationRatePercentage,
  };
}

/**
 * Generates rule-based, explainable library insights based on real data.
 */
export function generateExplainableInsights(
  hourlyTrends: HourlyCongestion[],
  zoneBreakdown: ZoneUtilization[],
  reservationMetrics: ReservationMetrics
): ExplainableInsight[] {
  const insights: ExplainableInsight[] = [];

  // 1. Peak & Quiet Hours Rule
  if (hourlyTrends.length > 0) {
    const sortedHours = [...hourlyTrends].sort((a, b) => b.bookingCount - a.bookingCount);
    const peakHour = sortedHours[0];
    const quietHour = [...hourlyTrends].filter((h) => h.hour <= 12).sort((a, b) => a.bookingCount - b.bookingCount)[0];

    if (peakHour && peakHour.bookingCount > 0) {
      insights.push({
        id: 'insight_peak_hour',
        category: 'peak_hours',
        title: `Peak Usage Period: ${peakHour.hourLabel} - ${(peakHour.hour + 1).toString().padStart(2, '0')}:00`,
        description: `Library capacity experiences maximum desk allocations around ${peakHour.hourLabel} with a relative congestion index of ${peakHour.occupancyScore}%.`,
        recommendation: `Reserve desks at least 2 hours in advance if planning to study during afternoon peak periods.`,
      });
    }

    if (quietHour) {
      insights.push({
        id: 'insight_quiet_hour',
        category: 'best_time',
        title: `Recommended Quiet Window: ${quietHour.hourLabel} - ${(quietHour.hour + 2).toString().padStart(2, '0')}:00`,
        description: `Early morning sessions have consistently lower reservation density and maximal desk availability across all floors.`,
        recommendation: `Optimal for uninterrupted deep focus sessions and immediate walk-in reservations.`,
      });
    }
  }

  // 2. Zone Availability Insight
  if (zoneBreakdown.length > 0) {
    const sortedZones = [...zoneBreakdown].sort((a, b) => b.utilizationPercentage - a.utilizationPercentage);
    const topZone = sortedZones[0];
    const availableZone = [...zoneBreakdown].sort((a, b) => a.utilizationPercentage - b.utilizationPercentage)[0];

    if (topZone && availableZone && topZone.zone !== availableZone.zone) {
      insights.push({
        id: 'insight_zone_utilization',
        category: 'zone_preference',
        title: `Zone Demand: ${topZone.zone} in Highest Demand`,
        description: `${topZone.zone} desks have ${topZone.utilizationPercentage}% relative utilization, while ${availableZone.zone} maintains highest desk availability (${availableZone.utilizationPercentage}% busy).`,
        recommendation: `If ${topZone.zone} desks are booked, consider reserving ${availableZone.zone} desks for comparable work environments.`,
      });
    }
  }

  // 3. Reliability & No-Show Pattern Insight
  if (reservationMetrics.total >= 5) {
    if (reservationMetrics.noShowRatePercentage > 15) {
      insights.push({
        id: 'insight_no_show_notice',
        category: 'reliability',
        title: `No-Show Release Rate: ${reservationMetrics.noShowRatePercentage}%`,
        description: `Approximately ${reservationMetrics.noShowRatePercentage}% of reservations are released back into the available pool after the 15-minute check-in grace period expires.`,
        recommendation: `Check the live seat map at 15 minutes past the hour to claim desks released from unclaimed reservations.`,
      });
    } else {
      insights.push({
        id: 'insight_high_checkin_rate',
        category: 'reliability',
        title: `High Reservation Adherence: ${reservationMetrics.checkInRatePercentage}% Check-in Rate`,
        description: `Students reliably check in to confirmed reservations on time, maintaining accurate floor map availability.`,
        recommendation: `Bookings remain firm; reserve early to guarantee your preferred seat.`,
      });
    }
  }

  return insights;
}
