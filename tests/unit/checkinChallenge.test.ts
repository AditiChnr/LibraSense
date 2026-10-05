import {
  signCheckinChallenge,
  verifyCheckinChallenge,
  isWithinCheckinWindow,
  CheckinChallengePayload,
} from '../../src/lib/services/checkinCrypto';

export function runCheckinChallengeTests() {
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

  const now = new Date('2026-10-05T10:00:00.000Z');
  const validExpiresAt = new Date('2026-10-05T10:01:00.000Z').toISOString(); // 60s in future
  const expiredExpiresAt = new Date('2026-10-05T09:59:00.000Z').toISOString(); // 60s in past

  const basePayload: CheckinChallengePayload = {
    challengeId: 'chal_abc123',
    userId: 'user_student_1',
    reservationId: 'res_999',
    seatId: 'seat_A01',
    expiresAt: validExpiresAt,
  };

  // Test 1: Valid Challenge Signature Generation & Verification
  const validSig = signCheckinChallenge(basePayload);
  const verifyValid = verifyCheckinChallenge(basePayload, validSig, now.toISOString());
  assert('verifyCheckinChallenge accepts valid signature within 60s window', verifyValid.valid === true);

  // Test 2: Expired Challenge Rejection
  const expiredPayload: CheckinChallengePayload = { ...basePayload, expiresAt: expiredExpiresAt };
  const expiredSig = signCheckinChallenge(expiredPayload);
  const verifyExpired = verifyCheckinChallenge(expiredPayload, expiredSig, now.toISOString());
  assert('verifyCheckinChallenge rejects expired challenge token', verifyExpired.valid === false && verifyExpired.errorCode === 'CHALLENGE_EXPIRED');

  // Test 3: Invalid / Tampered Signature Rejection
  const tamperedSig = validSig.replace('a', 'b');
  const verifyTampered = verifyCheckinChallenge(basePayload, tamperedSig, now.toISOString());
  assert('verifyCheckinChallenge rejects tampered/invalid signature', verifyTampered.valid === false && verifyTampered.errorCode === 'INVALID_SIGNATURE');

  // Test 4: Check-in Window Validation - On Time (Exact Start Time)
  const windowOnTime = isWithinCheckinWindow('2026-10-05T10:00:00.000Z', 15, now.toISOString());
  assert('isWithinCheckinWindow accepts on-time check-in at reservation start', windowOnTime.valid === true);

  // Test 5: Check-in Window Validation - Early Window (10 mins before start)
  const windowEarlyValid = isWithinCheckinWindow('2026-10-05T10:10:00.000Z', 15, now.toISOString());
  assert('isWithinCheckinWindow accepts early check-in 10 minutes before start', windowEarlyValid.valid === true);

  // Test 6: Check-in Window Validation - Too Early (30 mins before start)
  const windowTooEarly = isWithinCheckinWindow('2026-10-05T10:30:00.000Z', 15, now.toISOString());
  assert('isWithinCheckinWindow rejects check-in attempted 30 minutes before start', windowTooEarly.valid === false);

  // Test 7: Check-in Window Validation - Expired Grace Period (20 mins after start)
  const windowGraceExpired = isWithinCheckinWindow('2026-10-05T09:40:00.000Z', 15, now.toISOString());
  assert('isWithinCheckinWindow rejects check-in attempted after 15-minute grace period', windowGraceExpired.valid === false);

  console.log(`\nCheckinChallenge Tests Summary: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runCheckinChallengeTests();
}
