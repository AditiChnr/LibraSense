import { BookedSlot, SystemConfig } from '@/types';

export interface ReservationRequest {
  userId: string;
  seatId: string;
  date: string; // YYYY-MM-DD
  startTimeIso: string;
  endTimeIso: string;
}

export interface SlotRange {
  startSlot: number; // 0..95
  endSlot: number;   // 0..95
  lengthSlots: number;
}

/**
 * Converts ISO time string (or Date object) to a 15-minute slot index (0..95) in UTC time.
 */
export function timeToSlotIndex(dateOrIso: string | Date): number {
  if (typeof dateOrIso === 'string') {
    // Parse time directly from ISO string format "YYYY-MM-DDTHH:MM:SS"
    const match = dateOrIso.match(/T(\d{2}):(\d{2})/);
    if (match && match[1] !== undefined && match[2] !== undefined) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      return hours * 4 + Math.floor(minutes / 15);
    }
  }

  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  return hours * 4 + Math.floor(minutes / 15);
}

/**
 * Calculates slot range for start and end time.
 */
export function calculateSlotRange(startTimeIso: string, endTimeIso: string): SlotRange {
  const startSlot = timeToSlotIndex(startTimeIso);
  const endSlot = timeToSlotIndex(endTimeIso);
  const lengthSlots = endSlot - startSlot;

  return {
    startSlot,
    endSlot,
    lengthSlots,
  };
}

/**
 * Checks if a requested slot range [startSlot, endSlot) overlaps with any existing booked slot.
 */
export function hasSlotOverlap(requested: SlotRange, existingBookedSlots: BookedSlot[]): boolean {
  for (const slot of existingBookedSlots) {
    const existingStart = slot.slotIndex;
    const existingEnd = slot.slotIndex + slot.lengthSlots;

    // Overlap condition: requested.start < existingEnd AND requested.end > existingStart
    if (requested.startSlot < existingEnd && requested.endSlot > existingStart) {
      return true;
    }
  }
  return false;
}

/**
 * Validates reservation business rules against system configuration.
 */
export function validateReservationRules(
  req: ReservationRequest,
  config: SystemConfig,
  activeUserReservationsCount: number,
  nowIso: string = new Date().toISOString()
): { valid: boolean; errorCode?: string; errorMessage?: string } {
  const nowMs = new Date(nowIso).getTime();
  const startMs = new Date(req.startTimeIso).getTime();
  const endMs = new Date(req.endTimeIso).getTime();

  // 1. Time Sequence Check
  if (endMs <= startMs) {
    return { valid: false, errorCode: 'INVALID_TIME_RANGE', errorMessage: 'End time must be after start time.' };
  }

  // 2. Lead Time Check (Must be in future by at least minBookingLeadMinutes)
  if (startMs < nowMs - 60000) { // Allow 1 minute buffer for latency
    return { valid: false, errorCode: 'START_TIME_IN_PAST', errorMessage: 'Reservation start time cannot be in the past.' };
  }

  // 3. Max Booking Lead Days Check
  const maxLeadMs = config.maxBookingLeadDays * 24 * 60 * 60 * 1000;
  if (startMs > nowMs + maxLeadMs) {
    return { valid: false, errorCode: 'LEAD_TIME_EXCEEDED', errorMessage: `Reservations cannot be booked more than ${config.maxBookingLeadDays} days in advance.` };
  }

  // 4. Max Duration Check
  const durationMinutes = (endMs - startMs) / (60 * 1000);
  if (durationMinutes > config.maxDurationMinutes) {
    return { valid: false, errorCode: 'MAX_DURATION_EXCEEDED', errorMessage: `Maximum reservation duration is ${config.maxDurationMinutes / 60} hours.` };
  }

  // 5. Max Active Reservations Check
  if (activeUserReservationsCount >= config.maxActiveReservations) {
    return { valid: false, errorCode: 'MAX_ACTIVE_RESERVATIONS_EXCEEDED', errorMessage: `You have reached the maximum allowed active reservations (${config.maxActiveReservations}).` };
  }

  return { valid: true };
}
