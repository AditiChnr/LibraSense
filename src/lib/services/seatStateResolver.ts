import { Seat, HardwareState, Reservation, StudySession, DerivedSeatState } from '@/types';

/**
 * Deterministically derives the effective state of a seat from separate sources of truth.
 *
 * Strict Priority Hierarchy:
 * MAINTENANCE > OCCUPIED_VALID > OCCUPIED_UNAUTHORIZED > NO_SHOW_PENDING > RESERVED > AVAILABLE
 */
export function resolveSeatState(
  seat: Seat,
  hardwareState?: HardwareState | null,
  activeReservation?: Reservation | null,
  activeSession?: StudySession | null,
  nowIso: string = new Date().toISOString()
): DerivedSeatState {
  const nowMs = new Date(nowIso).getTime();

  // 1. MAINTENANCE: Highest priority override
  if (seat.isMaintenance) {
    return 'MAINTENANCE';
  }

  // Check hardware occupancy state (requires smoothedConfidence > 0.6)
  const isHardwareOccupied = Boolean(
    hardwareState && hardwareState.occupied && hardwareState.smoothedConfidence >= 0.6
  );

  // Check active checked-in session
  const isCheckedInSessionActive = Boolean(
    activeSession && activeSession.status === 'active' && activeSession.seatId === seat.id
  );

  // Check active reservation window
  let isReservationWindowActive = false;
  let isNoShowExpired = false;

  if (activeReservation && activeReservation.seatId === seat.id && activeReservation.status === 'active') {
    const startTimeMs = new Date(activeReservation.startTime).getTime();
    const endTimeMs = new Date(activeReservation.endTime).getTime();
    const graceMinutes = activeReservation.gracePeriodMinutes || 15;
    const graceExpiryMs = startTimeMs + graceMinutes * 60 * 1000;

    // Reservation is active if current time is between 15 mins before start and endTime
    if (nowMs >= startTimeMs - 15 * 60 * 1000 && nowMs <= endTimeMs) {
      isReservationWindowActive = true;
    }

    // No-show expired if current time is past grace period and not checked in
    if (nowMs > graceExpiryMs && !activeReservation.checkedInAt) {
      isNoShowExpired = true;
    }
  }

  // 2. OCCUPIED_VALID: Checked in student actively using seat
  if (isCheckedInSessionActive) {
    return 'OCCUPIED_VALID';
  }

  // 3. OCCUPIED_UNAUTHORIZED: Hardware detects occupant without a checked-in session
  if (isHardwareOccupied && !isCheckedInSessionActive) {
    return 'OCCUPIED_UNAUTHORIZED';
  }

  // 4. NO_SHOW_PENDING: Reservation start + grace period expired without check-in
  if (isNoShowExpired) {
    return 'NO_SHOW_PENDING';
  }

  // 5. RESERVED: Valid upcoming reservation window open, awaiting arrival
  if (isReservationWindowActive) {
    return 'RESERVED';
  }

  // 6. AVAILABLE: Default free seat
  return 'AVAILABLE';
}
