import {
  timeToSlotIndex,
  calculateSlotRange,
  hasSlotOverlap,
  validateReservationRules,
} from '../../src/lib/services/reservationValidation';
import { BookedSlot, SystemConfig } from '../../src/types';

const mockConfig: SystemConfig = {
  maxActiveReservations: 2,
  maxFutureReservations: 5,
  maxDurationMinutes: 240, // 4 hours
  minBookingLeadMinutes: 15,
  maxBookingLeadDays: 7,
  defaultGracePeriodMinutes: 15,
  minCancellationNoticeMinutes: 30,
  hardwareModeEnabled: true,
  simulationActive: false,
};

export function runReservationRulesTests() {
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

  // Test 1: Slot Index Calculation
  const slot10am = timeToSlotIndex('2026-10-05T10:00:00Z'); // 10 * 4 = 40
  const slot1030am = timeToSlotIndex('2026-10-05T10:30:00Z'); // 10 * 4 + 2 = 42
  assert('timeToSlotIndex calculates 10:00 AM as slot 40', slot10am === 40);
  assert('timeToSlotIndex calculates 10:30 AM as slot 42', slot1030am === 42);

  // Test 2: Overlap Detection
  const existingSlots: BookedSlot[] = [
    {
      slotIndex: 40, // 10:00 AM
      lengthSlots: 8, // 2 hours (10:00 - 12:00) -> slots 40 to 48
      reservationId: 'res_1',
      startTimeIso: '2026-10-05T10:00:00Z',
      endTimeIso: '2026-10-05T12:00:00Z',
    },
  ];

  // Overlapping request: 11:00 AM to 1:00 PM (slots 44 to 52)
  const reqOverlapping = calculateSlotRange('2026-10-05T11:00:00Z', '2026-10-05T13:00:00Z');
  assert('hasSlotOverlap detects overlap for 11:00-13:00 against 10:00-12:00', hasSlotOverlap(reqOverlapping, existingSlots) === true);

  // Non-overlapping request: 12:00 PM to 2:00 PM (slots 48 to 56)
  const reqNonOverlapping = calculateSlotRange('2026-10-05T12:00:00Z', '2026-10-05T14:00:00Z');
  assert('hasSlotOverlap returns false for non-overlapping 12:00-14:00 slot', hasSlotOverlap(reqNonOverlapping, existingSlots) === false);

  // Test 3: Duration Limit Rule
  const reqTooLong = {
    userId: 'user_1',
    seatId: 'seat_A01',
    date: '2026-10-05',
    startTimeIso: '2026-10-05T10:00:00Z',
    endTimeIso: '2026-10-05T16:00:00Z', // 6 hours (exceeds 4h max)
  };
  const valDuration = validateReservationRules(reqTooLong, mockConfig, 0, '2026-10-05T09:00:00Z');
  assert('validateReservationRules rejects duration exceeding maxDurationMinutes', valDuration.valid === false && valDuration.errorCode === 'MAX_DURATION_EXCEEDED');

  // Test 4: Max Active Reservations Rule
  const reqMaxActive = {
    userId: 'user_1',
    seatId: 'seat_A01',
    date: '2026-10-05',
    startTimeIso: '2026-10-05T10:00:00Z',
    endTimeIso: '2026-10-05T12:00:00Z',
  };
  const valMaxActive = validateReservationRules(reqMaxActive, mockConfig, 2, '2026-10-05T09:00:00Z');
  assert('validateReservationRules rejects when max active reservations reached', valMaxActive.valid === false && valMaxActive.errorCode === 'MAX_ACTIVE_RESERVATIONS_EXCEEDED');

  console.log(`\nReservationRules Tests Summary: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runReservationRulesTests();
}
