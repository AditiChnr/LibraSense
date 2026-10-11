import {
  validateRequestedInterval,
  intervalsOverlap,
  isSeatAvailableForInterval,
  computeSeatPreferenceScore,
  evaluateSeatsForInterval,
} from '../../src/lib/services/intervalAvailability';
import { Seat, Reservation, HardwareState } from '../../src/types';

export function runIntervalAvailabilityTests() {
  let passed = 0;
  let failed = 0;

  function assert(description: string, condition: boolean) {
    if (condition) {
      console.log(`✓ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`✕ [FAIL] ${description}`);
      failed++;
    }
  }

  console.log('--- Running Interval Availability & Preference Matching Unit Tests ---');

  const fixedNowIso = '2026-10-11T12:00:00.000Z'; // 12:00 UTC on 2026-10-11

  // Test 1: Date & Time Interval Validation
  const validRes = validateRequestedInterval('2026-10-11', '14:00', '16:00', { maxDurationMinutes: 240, maxBookingLeadDays: 7 }, fixedNowIso);
  assert('Accepts valid future interval on current day (14:00 - 16:00)', validRes.valid === true && validRes.interval?.durationMinutes === 120);

  const pastDateRes = validateRequestedInterval('2026-10-10', '14:00', '16:00', { maxDurationMinutes: 240, maxBookingLeadDays: 7 }, fixedNowIso);
  assert('Rejects past date (2026-10-10)', pastDateRes.valid === false && pastDateRes.errorCode === 'PAST_DATE');

  const pastTimeRes = validateRequestedInterval('2026-10-11', '10:00', '11:00', { maxDurationMinutes: 240, maxBookingLeadDays: 7 }, fixedNowIso);
  assert('Rejects past time on current day (10:00 < 12:00 current time)', pastTimeRes.valid === false && pastTimeRes.errorCode === 'START_TIME_IN_PAST');

  const invertedTimeRes = validateRequestedInterval('2026-10-12', '16:00', '14:00', { maxDurationMinutes: 240, maxBookingLeadDays: 7 }, fixedNowIso);
  assert('Rejects end time before start time (16:00 to 14:00)', invertedTimeRes.valid === false && invertedTimeRes.errorCode === 'INVALID_TIME_RANGE');

  const excessiveDurationRes = validateRequestedInterval('2026-10-12', '10:00', '16:00', { maxDurationMinutes: 240, maxBookingLeadDays: 7 }, fixedNowIso);
  assert('Rejects duration exceeding 240 minutes (6 hours requested)', excessiveDurationRes.valid === false && excessiveDurationRes.errorCode === 'MAX_DURATION_EXCEEDED');

  const leadDaysExceededRes = validateRequestedInterval('2026-10-25', '14:00', '16:00', { maxDurationMinutes: 240, maxBookingLeadDays: 7 }, fixedNowIso);
  assert('Rejects date beyond maxBookingLeadDays (14 days ahead)', leadDaysExceededRes.valid === false && leadDaysExceededRes.errorCode === 'LEAD_DAYS_EXCEEDED');

  // Test 2: Overlap & Slot Boundary Checks
  assert('Detects overlap when intervals intersect (14:00-16:00 overlaps with 15:00-17:00)', 
    intervalsOverlap('2026-10-11T14:00:00.000Z', '2026-10-11T16:00:00.000Z', '2026-10-11T15:00:00.000Z', '2026-10-11T17:00:00.000Z') === true);

  assert('Detects overlap when requested interval is fully inside booked interval', 
    intervalsOverlap('2026-10-11T14:30:00.000Z', '2026-10-11T15:30:00.000Z', '2026-10-11T14:00:00.000Z', '2026-10-11T16:00:00.000Z') === true);

  assert('Exact adjacent boundaries do NOT overlap (14:00-16:00 does not overlap with 16:00-18:00)', 
    intervalsOverlap('2026-10-11T14:00:00.000Z', '2026-10-11T16:00:00.000Z', '2026-10-11T16:00:00.000Z', '2026-10-11T18:00:00.000Z') === false);

  assert('Exact adjacent boundaries do NOT overlap in reverse (12:00-14:00 does not overlap with 14:00-16:00)', 
    intervalsOverlap('2026-10-11T12:00:00.000Z', '2026-10-11T14:00:00.000Z', '2026-10-11T14:00:00.000Z', '2026-10-11T16:00:00.000Z') === false);

  // Test 3: Seat Availability for Interval
  const mockSeatAvailable: Seat = {
    id: 'seat_A01',
    seatNumber: 'A01',
    floorId: 'floor_1',
    coordinates: { x: 100, y: 100, width: 90, height: 70, rotation: 0 },
    zone: 'Quiet Zone',
    features: ['Power Outlet', 'Ergonomic Chair'],
    isMaintenance: false,
    isHardwareMonitored: true,
    qrPublicId: 'SEAT_A01',
  };

  const mockSeatMaintenance: Seat = {
    ...mockSeatAvailable,
    id: 'seat_A02',
    isMaintenance: true,
  };

  const requestedInterval = validRes.interval!;

  const existingReservations: Reservation[] = [
    {
      id: 'res_1',
      userId: 'user_other',
      seatId: 'seat_A03',
      date: '2026-10-11',
      startTime: '2026-10-11T14:30:00.000Z',
      endTime: '2026-10-11T16:30:00.000Z',
      gracePeriodMinutes: 15,
      status: 'active',
      createdAt: '2026-10-11T08:00:00.000Z',
    },
  ];

  const availResult1 = isSeatAvailableForInterval(mockSeatAvailable, requestedInterval, existingReservations, undefined, fixedNowIso);
  assert('Unreserved, non-maintenance seat resolves as AVAILABLE', availResult1.isAvailable === true && availResult1.state === 'AVAILABLE');

  const maintResult = isSeatAvailableForInterval(mockSeatMaintenance, requestedInterval, existingReservations, undefined, fixedNowIso);
  assert('Maintenance seat resolves as MAINTENANCE (not available)', maintResult.isAvailable === false && maintResult.state === 'MAINTENANCE');

  const mockSeatReserved: Seat = { ...mockSeatAvailable, id: 'seat_A03' };
  const reservedResult = isSeatAvailableForInterval(mockSeatReserved, requestedInterval, existingReservations, undefined, fixedNowIso);
  assert('Overlapping active reservation resolves as RESERVED (not available)', reservedResult.isAvailable === false && reservedResult.state === 'RESERVED');

  // Test 4: Physical Occupancy for Immediate Interval
  const immediateInterval = validateRequestedInterval('2026-10-11', '12:00', '14:00', {}, fixedNowIso).interval!;
  const hardwareOccupiedState: HardwareState = {
    seatId: 'seat_A01',
    occupied: true,
    rawConfidence: 0.95,
    smoothedConfidence: 0.95,
    lastUpdate: fixedNowIso,
    consecutiveFrameCount: 5,
  };

  const immediateResult = isSeatAvailableForInterval(mockSeatAvailable, immediateInterval, [], hardwareOccupiedState, fixedNowIso);
  assert('Physical occupant detected during active interval resolves as OCCUPIED_UNAUTHORIZED', 
    immediateResult.isAvailable === false && immediateResult.state === 'OCCUPIED_UNAUTHORIZED');

  // Test 5: Preference Scoring & Ranking
  const scoreQuietPower = computeSeatPreferenceScore(mockSeatAvailable, true, {
    zone: 'Quiet Zone',
    requirePower: true,
    rankingMode: 'BEST_MATCH',
  });
  assert('Seat matching Quiet Zone and Power Outlet achieves high score (>= 80)', scoreQuietPower.score >= 80);

  const scoreWrongZone = computeSeatPreferenceScore(mockSeatAvailable, true, {
    zone: 'Collaborative',
    rankingMode: 'BEST_MATCH',
  });
  assert('Seat mismatching preferred zone receives lower score', scoreWrongZone.score < scoreQuietPower.score);

  // Test 6: Batch Evaluation & Ordering
  const allSeats = [mockSeatAvailable, mockSeatMaintenance, mockSeatReserved];
  const batchEval = evaluateSeatsForInterval(allSeats, requestedInterval, existingReservations, {}, { zone: 'Quiet Zone' }, fixedNowIso);
  assert('Batch evaluation counts exactly 1 available seat', batchEval.availableCount === 1);
  assert('Batch evaluation ranks AVAILABLE seat first in results list', batchEval.results[0]?.seatId === 'seat_A01' && batchEval.results[0]?.isAvailable === true);

  console.log(`\nIntervalAvailability Tests Summary: ${passed} Passed, ${failed} Failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runIntervalAvailabilityTests();
}
