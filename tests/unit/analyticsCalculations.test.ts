import {
  computePersonalStudyStats,
  computeDailyStudyTrend,
  computeHourlyOccupancyTrends,
  computeSeatUtilizationStats,
  computeReservationMetrics,
  generateExplainableInsights,
} from '../../src/lib/services/analyticsService';
import { StudySession, Reservation, Seat } from '../../src/types';

function runTests() {
  console.log('--- Running Study & Library Analytics Unit Tests ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✕ [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Personal Study Duration & Average Calculations
  {
    const sessions: StudySession[] = [
      {
        id: 's1',
        userId: 'student_1',
        reservationId: 'r1',
        seatId: 'seat_A01',
        startTime: '2026-10-05T09:00:00Z',
        endTime: '2026-10-05T10:30:00Z',
        status: 'ended',
        studyDurationSeconds: 5400, // 90 min = 1.5h
        breakDurationSeconds: 600,  // 10 min
        pomodoroCyclesCompleted: 2,
      },
      {
        id: 's2',
        userId: 'student_1',
        reservationId: 'r2',
        seatId: 'seat_A02',
        startTime: '2026-10-05T14:00:00Z',
        endTime: '2026-10-05T15:00:00Z',
        status: 'ended',
        studyDurationSeconds: 3600, // 60 min = 1.0h
        breakDurationSeconds: 300,  // 5 min
        pomodoroCyclesCompleted: 1,
      },
    ];

    const stats = computePersonalStudyStats(sessions);

    assert(stats.totalStudySeconds === 9000, 'Sum of studyDurationSeconds equals 9000s');
    assert(stats.totalStudyHoursFormatted === '2.5h', 'Formatted study hours calculates as 2.5h');
    assert(stats.completedSessionsCount === 2, 'Completed sessions count is 2');
    assert(stats.averageSessionDurationMinutes === 75, 'Average session duration is (90+60)/2 = 75 min');
    assert(stats.totalPomodoroCycles === 3, 'Total Pomodoro cycles sums to 3');
    assert(stats.totalBreakSeconds === 900, 'Total break time sums to 900s (15 min)');
  }

  // 2. Empty Session Data Handling
  {
    const emptyStats = computePersonalStudyStats([]);
    assert(emptyStats.totalStudySeconds === 0, 'Empty sessions returns 0 total study seconds');
    assert(emptyStats.averageSessionDurationMinutes === 0, 'Empty sessions returns 0 average duration without NaN/division by zero');
    assert(emptyStats.completedSessionsCount === 0, 'Empty sessions returns 0 completed count');
  }

  // 3. Daily Study Trends Aggregation
  {
    const today = new Date('2026-10-05T12:00:00Z');
    const sessions: StudySession[] = [
      {
        id: 's1',
        userId: 'student_1',
        reservationId: 'r1',
        seatId: 'seat_A01',
        startTime: '2026-10-05T09:00:00Z',
        endTime: '2026-10-05T10:00:00Z',
        status: 'ended',
        studyDurationSeconds: 3600, // 60 min
        breakDurationSeconds: 300,
        pomodoroCyclesCompleted: 1,
      },
      {
        id: 's2',
        userId: 'student_1',
        reservationId: 'r2',
        seatId: 'seat_A01',
        startTime: '2026-10-03T09:00:00Z',
        endTime: '2026-10-03T10:30:00Z',
        status: 'ended',
        studyDurationSeconds: 5400, // 90 min
        breakDurationSeconds: 600,
        pomodoroCyclesCompleted: 2,
      },
    ];

    const trend = computeDailyStudyTrend(sessions, 7, today);

    assert(trend.length === 7, 'Generates 7 daily buckets for 7-day trend');
    const todayBucket = trend[trend.length - 1];
    assert(todayBucket?.date === '2026-10-05', 'Final bucket corresponds to today 2026-10-05');
    assert(todayBucket?.studyMinutes === 60, 'Today bucket has 60 study minutes');
    assert(todayBucket?.hasData === true, 'Today bucket flagged with hasData: true');

    const emptyDayBucket = trend.find((d) => d.date === '2026-10-04');
    assert(emptyDayBucket?.studyMinutes === 0, 'Empty day bucket has 0 study minutes');
    assert(emptyDayBucket?.hasData === false, 'Empty day bucket flagged with hasData: false');
  }

  // 4. Hourly Congestion & Peak Hours Detection
  {
    const reservations: Reservation[] = [
      {
        id: 'r1',
        userId: 'u1',
        seatId: 's1',
        date: '2026-10-05',
        startTime: '2026-10-05T14:00:00Z',
        endTime: '2026-10-05T16:00:00Z', // spans 14, 15, 16
        gracePeriodMinutes: 15,
        status: 'checked_in',
        createdAt: '2026-10-05T10:00:00Z',
      },
      {
        id: 'r2',
        userId: 'u2',
        seatId: 's2',
        date: '2026-10-05',
        startTime: '2026-10-05T14:00:00Z',
        endTime: '2026-10-05T15:00:00Z', // spans 14, 15
        gracePeriodMinutes: 15,
        status: 'checked_in',
        createdAt: '2026-10-05T10:00:00Z',
      },
    ];

    const hourly = computeHourlyOccupancyTrends(reservations, []);

    assert(hourly.length === 14, 'Covers all 14 library operational hours (08:00 to 21:00)');
    const hour14 = hourly.find((h) => h.hour === 14);
    assert((hour14?.bookingCount || 0) === 2, 'Hour 14:00 has 2 active bookings');
    assert(hour14?.occupancyScore === 100, 'Hour 14:00 has maximum relative score of 100%');
  }

  // 5. Zone Utilization and Desk Rankings
  {
    const seats: Seat[] = [
      {
        id: 'seat_A01',
        seatNumber: 'A01',
        floorId: 'floor_1',
        coordinates: { x: 0, y: 0, width: 90, height: 70, rotation: 0 },
        zone: 'Quiet Zone',
        features: ['Power Outlet'],
        isMaintenance: false,
        isHardwareMonitored: true,
        qrPublicId: 'SEAT_FL1_A01',
      },
      {
        id: 'seat_A02',
        seatNumber: 'A02',
        floorId: 'floor_1',
        coordinates: { x: 100, y: 0, width: 90, height: 70, rotation: 0 },
        zone: 'Collaborative',
        features: ['Monitor'],
        isMaintenance: false,
        isHardwareMonitored: false,
        qrPublicId: 'SEAT_FL1_A02',
      },
    ];

    const reservations: Reservation[] = [
      {
        id: 'r1',
        userId: 'u1',
        seatId: 'seat_A01',
        date: '2026-10-05',
        startTime: '2026-10-05T10:00:00Z',
        endTime: '2026-10-05T12:00:00Z',
        gracePeriodMinutes: 15,
        status: 'checked_in',
        createdAt: '2026-10-05T09:00:00Z',
      },
    ];

    const stats = computeSeatUtilizationStats(seats, reservations, []);

    const quietZone = stats.zoneBreakdown.find((z) => z.zone === 'Quiet Zone');
    assert(quietZone?.activeBookingCount === 1, 'Quiet Zone registers 1 active booking');
    assert(stats.mostUtilizedSeats[0]?.seatId === 'seat_A01', 'Desk A01 is correctly ranked as #1 most utilized desk');
  }

  // 6. Reservation Reliability Metrics
  {
    const reservations: Reservation[] = [
      { id: '1', userId: 'u', seatId: 's', date: '2026-10-05', startTime: '', endTime: '', gracePeriodMinutes: 15, status: 'checked_in', createdAt: '' },
      { id: '2', userId: 'u', seatId: 's', date: '2026-10-05', startTime: '', endTime: '', gracePeriodMinutes: 15, status: 'completed', createdAt: '' },
      { id: '3', userId: 'u', seatId: 's', date: '2026-10-05', startTime: '', endTime: '', gracePeriodMinutes: 15, status: 'no_show', createdAt: '' },
      { id: '4', userId: 'u', seatId: 's', date: '2026-10-05', startTime: '', endTime: '', gracePeriodMinutes: 15, status: 'cancelled', createdAt: '' },
    ];

    const metrics = computeReservationMetrics(reservations);

    assert(metrics.total === 4, 'Total reservations is 4');
    assert(metrics.checkInRatePercentage === 50, 'Check-in rate is (1+1)/4 = 50%');
    assert(metrics.noShowRatePercentage === 25, 'No-show rate is 1/4 = 25%');
    assert(metrics.cancellationRatePercentage === 25, 'Cancellation rate is 1/4 = 25%');
  }

  // 7. Explainable Insights Generation
  {
    const hourly = [
      { hour: 8, hourLabel: '08:00', bookingCount: 0, occupancyScore: 0 },
      { hour: 14, hourLabel: '14:00', bookingCount: 8, occupancyScore: 100 },
    ];
    const zones = [
      { zone: 'Quiet Zone' as const, seatCount: 15, activeBookingCount: 10, utilizationPercentage: 67 },
      { zone: 'Collaborative' as const, seatCount: 15, activeBookingCount: 2, utilizationPercentage: 13 },
    ];
    const resMetrics = {
      total: 10,
      active: 2,
      checkedIn: 6,
      completed: 1,
      noShow: 2,
      cancelled: 1,
      checkInRatePercentage: 70,
      noShowRatePercentage: 20,
      cancellationRatePercentage: 10,
    };

    const insights = generateExplainableInsights(hourly, zones, resMetrics);

    assert(insights.length >= 2, 'Generates multiple explainable insight cards');
    assert(insights.some((i) => i.category === 'peak_hours'), 'Generates peak hours insight');
    assert(insights.some((i) => i.category === 'best_time'), 'Generates best quiet time insight');
    assert(insights.some((i) => i.category === 'zone_preference'), 'Generates zone preference insight');
  }

  console.log(`\nAnalyticsCalculations Tests Summary: ${passed} Passed, ${failed} Failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
