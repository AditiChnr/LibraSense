import { resolveSeatState } from '../../src/lib/services/seatStateResolver';
import { Seat, HardwareState, Reservation, StudySession } from '../../src/types';

const baseSeat: Seat = {
  id: 'seat_A01',
  seatNumber: 'A01',
  floorId: 'floor_1',
  coordinates: { x: 100, y: 100, width: 90, height: 70, rotation: 0 },
  zone: 'Quiet Zone',
  features: ['Power Outlet', 'Monitor'],
  isMaintenance: false,
  isHardwareMonitored: true,
  qrPublicId: 'SEAT_FL1_A01',
};

const now = new Date('2026-10-05T10:00:00Z').toISOString();

export function runSeatStateResolverTests() {
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

  // 1. Maintenance Test
  const maintenanceSeat: Seat = { ...baseSeat, isMaintenance: true };
  const res1 = resolveSeatState(maintenanceSeat, null, null, null, now);
  assert('Rule 1: isMaintenance == true -> MAINTENANCE', res1 === 'MAINTENANCE');

  // 2. Occupied Valid Test
  const activeSession: StudySession = {
    id: 'sess_123',
    userId: 'user_student',
    reservationId: 'res_123',
    seatId: 'seat_A01',
    startTime: '2026-10-05T09:30:00Z',
    status: 'active',
    studyDurationSeconds: 1800,
    breakDurationSeconds: 0,
    pomodoroCyclesCompleted: 1,
  };
  const res2 = resolveSeatState(baseSeat, null, null, activeSession, now);
  assert('Rule 2: Active session -> OCCUPIED_VALID', res2 === 'OCCUPIED_VALID');

  // 3. Occupied Unauthorized Test
  const hwOccupied: HardwareState = {
    seatId: 'seat_A01',
    occupied: true,
    rawConfidence: 0.9,
    smoothedConfidence: 0.88,
    lastUpdate: now,
    consecutiveFrameCount: 5,
  };
  const res3 = resolveSeatState(baseSeat, hwOccupied, null, null, now);
  assert('Rule 3: Hardware occupied without session -> OCCUPIED_UNAUTHORIZED', res3 === 'OCCUPIED_UNAUTHORIZED');

  // 4. No-Show Pending Test
  const expiredRes: Reservation = {
    id: 'res_exp',
    userId: 'user_student',
    seatId: 'seat_A01',
    date: '2026-10-05',
    startTime: '2026-10-05T09:00:00Z', // Started at 9:00, grace expired at 9:15
    endTime: '2026-10-05T11:00:00Z',
    gracePeriodMinutes: 15,
    status: 'active',
    createdAt: '2026-10-05T08:00:00Z',
    checkedInAt: null,
  };
  const res4 = resolveSeatState(baseSeat, null, expiredRes, null, now); // now is 10:00
  assert('Rule 4: Expired grace period without check-in -> NO_SHOW_PENDING', res4 === 'NO_SHOW_PENDING');

  // 5. Reserved Test
  const upcomingRes: Reservation = {
    id: 'res_up',
    userId: 'user_student',
    seatId: 'seat_A01',
    date: '2026-10-05',
    startTime: '2026-10-05T10:05:00Z', // Starts in 5 mins
    endTime: '2026-10-05T12:00:00Z',
    gracePeriodMinutes: 15,
    status: 'active',
    createdAt: '2026-10-05T08:00:00Z',
    checkedInAt: null,
  };
  const res5 = resolveSeatState(baseSeat, null, upcomingRes, null, now);
  assert('Rule 5: Valid upcoming reservation -> RESERVED', res5 === 'RESERVED');

  // 6. Available Test
  const res6 = resolveSeatState(baseSeat, null, null, null, now);
  assert('Rule 6: No active flags -> AVAILABLE', res6 === 'AVAILABLE');

  console.log(`\nSeatStateResolver Tests Summary: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSeatStateResolverTests();
}
