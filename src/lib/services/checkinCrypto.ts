import crypto from 'crypto';

const CHECKIN_SECRET = process.env.CHECKIN_SECRET || process.env.IOT_DEVICE_SECRET_KEY || 'librasense_default_checkin_secret_2026';

export interface CheckinChallengePayload {
  challengeId: string;
  userId: string;
  reservationId: string;
  seatId: string;
  expiresAt: string; // ISO String
}

/**
 * Signs a check-in challenge payload using HMAC-SHA256.
 */
export function signCheckinChallenge(payload: CheckinChallengePayload): string {
  const data = `${payload.challengeId}:${payload.userId}:${payload.reservationId}:${payload.seatId}:${payload.expiresAt}`;
  return crypto.createHmac('sha256', CHECKIN_SECRET).update(data).digest('hex');
}

/**
 * Verifies the HMAC-SHA256 signature and expiration of a check-in challenge.
 */
export function verifyCheckinChallenge(
  payload: CheckinChallengePayload,
  providedSignature: string,
  nowIso: string = new Date().toISOString()
): { valid: boolean; errorCode?: string; errorMessage?: string } {
  const expectedSignature = signCheckinChallenge(payload);

  // Constant-time signature comparison to prevent timing attacks
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { valid: false, errorCode: 'INVALID_SIGNATURE', errorMessage: 'Challenge token signature is invalid or tampered with.' };
  }

  const nowMs = new Date(nowIso).getTime();
  const expiresMs = new Date(payload.expiresAt).getTime();

  if (nowMs > expiresMs) {
    return { valid: false, errorCode: 'CHALLENGE_EXPIRED', errorMessage: 'Check-in challenge token has expired (60s limit exceeded).' };
  }

  return { valid: true };
}

/**
 * Validates if the current time is within the allowed check-in window for a reservation.
 * Allowed window: 15 minutes before startTime up to startTime + gracePeriodMinutes.
 */
export function isWithinCheckinWindow(
  startTimeIso: string,
  gracePeriodMinutes: number = 15,
  nowIso: string = new Date().toISOString()
): { valid: boolean; reason?: string } {
  const nowMs = new Date(nowIso).getTime();
  const startMs = new Date(startTimeIso).getTime();
  const earlyWindowMs = startMs - 15 * 60 * 1000; // 15 mins before start
  const lateGraceMs = startMs + gracePeriodMinutes * 60 * 1000; // start + grace period

  if (nowMs < earlyWindowMs) {
    const minsUntilStart = Math.ceil((startMs - nowMs) / (60 * 1000));
    return { valid: false, reason: `Check-in opens 15 minutes before reservation start (in ${minsUntilStart} mins).` };
  }

  if (nowMs > lateGraceMs) {
    return { valid: false, reason: 'Check-in grace period has expired. This reservation is subject to automatic cancellation.' };
  }

  return { valid: true };
}
