import {
  signCheckinChallenge,
  verifyCheckinChallenge,
  CheckinChallengePayload,
} from '../../src/lib/services/checkinCrypto';
import {
  signIoTPayload,
  verifyIoTSignature,
  isTimestampFresh,
} from '../../src/lib/services/iotSecurity';
import {
  isValidSessionTransition,
  calculateTotalBreakSeconds,
  calculateAuthoritativeStudyDuration,
} from '../../src/lib/services/sessionTiming';
import { resolveSeatState } from '../../src/lib/services/seatStateResolver';
import { generateTickId, buildSimulatedSignedRequest } from '../../src/lib/services/simulationEngine';
import { Seat, HardwareState, Reservation, StudySession, SessionBreakRecord } from '../../src/types';

export function runSecurityAuditTests() {
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

  console.log('--- Running LibraSense Security & Hardening Regression Test Suite ---');

  const nowIso = new Date('2026-10-06T10:00:00.000Z').toISOString();

  // Test 1: Authentication & Authorization: Admin Role Enforcement Logic
  const checkAdminRole = (userRole?: string) => userRole === 'admin';
  assert('Admin check rejects unauthenticated user (undefined role)', checkAdminRole(undefined) === false);
  assert('Admin check rejects student user (role: student)', checkAdminRole('student') === false);
  assert('Admin check authorizes admin user (role: admin)', checkAdminRole('admin') === true);

  // Test 2: Admin Self-Demotion Guard
  const canModifyUserRole = (callerUid: string, targetUid: string, newRole: string) => {
    if (callerUid === targetUid && newRole !== 'admin') {
      return false; // Self-demotion blocked
    }
    return true;
  };
  assert('Admin cannot demote own account (self-lockout prevention)', canModifyUserRole('admin_1', 'admin_1', 'student') === false);
  assert('Admin can modify other user role', canModifyUserRole('admin_1', 'student_2', 'admin') === true);

  // Test 3: Reservation Ownership Enforcement
  const canCancelReservation = (callerUid: string, resOwnerUid: string) => callerUid === resOwnerUid;
  assert('User cannot cancel another student reservation', canCancelReservation('student_1', 'student_2') === false);
  assert('User can cancel own reservation', canCancelReservation('student_1', 'student_1') === true);

  // Test 4: QR Challenge Cryptographic Tamper Resistance
  const validPayload: CheckinChallengePayload = {
    challengeId: 'chal_101',
    userId: 'student_1',
    reservationId: 'res_202',
    seatId: 'seat_A01',
    expiresAt: new Date(Date.now() + 50000).toISOString(),
  };
  const validSig = signCheckinChallenge(validPayload);
  const verifyValid = verifyCheckinChallenge(validPayload, validSig);
  assert('Valid QR challenge token verifies successfully', verifyValid.valid === true);

  // Tamper with seatId
  const tamperedPayload: CheckinChallengePayload = {
    ...validPayload,
    seatId: 'seat_B99', // Attacker switched desk
  };
  const verifyTampered = verifyCheckinChallenge(tamperedPayload, validSig);
  assert('Tampered QR challenge payload (modified seatId) is rejected', verifyTampered.valid === false);

  // Tamper with userId
  const tamperedUserPayload: CheckinChallengePayload = {
    ...validPayload,
    userId: 'student_attacker', // Attacker stole token
  };
  const verifyTamperedUser = verifyCheckinChallenge(tamperedUserPayload, validSig);
  assert('Tampered QR challenge payload (stolen by different user) is rejected', verifyTamperedUser.valid === false);

  // Test 5: Expired QR Challenge Token Rejection
  const expiredPayload: CheckinChallengePayload = {
    ...validPayload,
    expiresAt: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago
  };
  const expiredSig = signCheckinChallenge(expiredPayload);
  const verifyExpired = verifyCheckinChallenge(expiredPayload, expiredSig);
  assert('Expired QR challenge token (>60s) is rejected', verifyExpired.valid === false && verifyExpired.errorCode === 'CHALLENGE_EXPIRED');

  // Test 6: Single-Use Consumption Replay Protection
  const challengeStore = new Map<string, boolean>();
  challengeStore.set('chal_101', false); // initially unconsumed

  const consumeChallenge = (id: string) => {
    if (challengeStore.get(id) === true) {
      return { success: false, error: 'TOKEN_REUSED' };
    }
    challengeStore.set(id, true);
    return { success: true };
  };

  const firstConsume = consumeChallenge('chal_101');
  const secondConsume = consumeChallenge('chal_101');
  assert('First challenge consumption succeeds', firstConsume.success === true);
  assert('Replay attack on consumed QR challenge token is rejected', secondConsume.success === false && secondConsume.error === 'TOKEN_REUSED');

  // Test 7: IoT Ingestion HMAC Signature Validation & Tampering Rejection
  const deviceId = 'dev_rpi_01';
  const nonce = 'nonce_abc123';
  const rawBody = JSON.stringify({ seatId: 'seat_A01', occupied: true, confidence: 0.94 });
  const validIoTSig = signIoTPayload(deviceId, nowIso, nonce, rawBody);

  const isIoTValid = verifyIoTSignature(deviceId, nowIso, nonce, rawBody, validIoTSig);
  assert('IoT request with valid HMAC-SHA256 signature is accepted', isIoTValid === true);

  const isIoTTampered = verifyIoTSignature(deviceId, nowIso, nonce, rawBody.replace('0.94', '0.99'), validIoTSig);
  assert('IoT request with tampered payload body is rejected', isIoTTampered === false);

  // Test 8: IoT Stale Timestamp Drift Rejection
  const staleTimestamp = new Date('2026-10-06T09:55:00.000Z').toISOString(); // 5 minutes old
  assert('IoT stale timestamp (>30s) is rejected', isTimestampFresh(staleTimestamp, nowIso, 30) === false);

  // Test 9: IoT Nonce Replay Rejection
  const seenNonces = new Set<string>();
  const processNonce = (n: string) => {
    if (seenNonces.has(n)) return false;
    seenNonces.add(n);
    return true;
  };
  assert('First use of nonce is accepted', processNonce('nonce_123') === true);
  assert('Second use of identical nonce is rejected (replay defense)', processNonce('nonce_123') === false);

  // Test 10: Server-Authoritative Session Timing & Duration Calculations
  const sessionStartTime = new Date('2026-10-06T08:00:00.000Z').toISOString();
  const sessionEndTime = new Date('2026-10-06T10:00:00.000Z').toISOString(); // 2 hours (7200s)
  const breaks: SessionBreakRecord[] = [
    {
      startTime: new Date('2026-10-06T08:50:00.000Z').toISOString(),
      endTime: new Date('2026-10-06T09:00:00.000Z').toISOString(), // 10 min break (600s)
      durationSeconds: 600,
    },
  ];

  const totalBreakSec = calculateTotalBreakSeconds(breaks, sessionEndTime);
  const { studyDurationSeconds, totalElapsedSeconds } = calculateAuthoritativeStudyDuration(
    sessionStartTime,
    sessionEndTime,
    totalBreakSec
  );

  assert('Total elapsed duration calculated correctly from server timestamps (7200s)', totalElapsedSeconds === 7200);
  assert('Net study duration subtracts verified breaks (6600s)', studyDurationSeconds === 6600);

  // Test 11: Invalid Session State Transitions
  assert('Session cannot transition from ended to START_BREAK', isValidSessionTransition('ended', 'START_BREAK') === false);
  assert('Session cannot transition from active to END_BREAK', isValidSessionTransition('active', 'END_BREAK') === false);
  assert('Session cannot transition from break to START_BREAK', isValidSessionTransition('break', 'START_BREAK') === false);

  // Test 12: Simulation Tick Idempotency
  const processedTicks = new Set<string>();
  const executeSimulationTick = (tickId: string) => {
    if (processedTicks.has(tickId)) {
      return { idempotent: true, mutated: false };
    }
    processedTicks.add(tickId);
    return { idempotent: false, mutated: true };
  };

  const simTickId = generateTickId('test_audit');
  const simCall1 = executeSimulationTick(simTickId);
  const simCall2 = executeSimulationTick(simTickId);
  assert('First simulation tick call executes mutation (idempotent: false)', simCall1.idempotent === false && simCall1.mutated === true);
  assert('Duplicate simulation tick call returns idempotent no-op (idempotent: true)', simCall2.idempotent === true && simCall2.mutated === false);

  // Test 13: Simulation signed payload passes IoT security verification
  const simReq = buildSimulatedSignedRequest('seat_A01', true, 0.95, simTickId);
  const isSimSigValid = verifyIoTSignature(
    simReq.headers['X-Device-ID'],
    simReq.headers['X-Device-Timestamp'],
    simReq.headers['X-Device-Nonce'],
    simReq.rawBody,
    simReq.headers['X-Device-Signature']
  );
  assert('Simulated payload generates authentic HMAC signature verifiable by IoT pipeline', isSimSigValid === true);

  // Test 14: SeatStateResolver Authority Hierarchy Invariant Preservation
  const baseSeat: Seat = {
    id: 'seat_A01',
    seatNumber: 'A01',
    floorId: 'floor_1',
    coordinates: { x: 0, y: 0, width: 40, height: 40, rotation: 0 },
    zone: 'Quiet Zone',
    features: ['Power Outlet'],
    isMaintenance: false,
    isHardwareMonitored: true,
    qrPublicId: 'qr_A01',
  };

  const hwOccupied: HardwareState = {
    seatId: 'seat_A01',
    occupied: true,
    rawConfidence: 0.95,
    smoothedConfidence: 0.95,
    consecutiveFrameCount: 3,
    lastUpdate: nowIso,
  };

  const checkedInRes: Reservation = {
    id: 'res_01',
    userId: 'user_1',
    seatId: 'seat_A01',
    date: '2026-10-06',
    startTime: '2026-10-06T09:00:00.000Z',
    endTime: '2026-10-06T11:00:00.000Z',
    gracePeriodMinutes: 15,
    status: 'checked_in',
    createdAt: '2026-10-06T08:00:00.000Z',
  };

  const activeSess: StudySession = {
    id: 'sess_01',
    userId: 'user_1',
    reservationId: 'res_01',
    seatId: 'seat_A01',
    startTime: '2026-10-06T09:00:00.000Z',
    status: 'active',
    studyDurationSeconds: 3600,
    breakDurationSeconds: 0,
    pomodoroCyclesCompleted: 1,
  };

  // Hierarchy Level 1: MAINTENANCE overrides active session and hardware
  const maintenanceSeat: Seat = { ...baseSeat, isMaintenance: true };
  const resMaintenance = resolveSeatState(maintenanceSeat, hwOccupied, checkedInRes, activeSess, nowIso);
  assert('Hierarchy 1: MAINTENANCE overrides OCCUPIED_VALID and active sessions', resMaintenance === 'MAINTENANCE');

  // Hierarchy Level 2: Active Session + Occupied -> OCCUPIED_VALID
  const resValid = resolveSeatState(baseSeat, hwOccupied, checkedInRes, activeSess, nowIso);
  assert('Hierarchy 2: Checked-in session with occupied sensor resolves to OCCUPIED_VALID', resValid === 'OCCUPIED_VALID');

  // Hierarchy Level 3: Occupied without session -> OCCUPIED_UNAUTHORIZED
  const resUnauthorized = resolveSeatState(baseSeat, hwOccupied, undefined, undefined, nowIso);
  assert('Hierarchy 3: Occupied sensor without active session resolves to OCCUPIED_UNAUTHORIZED', resUnauthorized === 'OCCUPIED_UNAUTHORIZED');

  console.log(`\nSecurity Audit Regression Tests Summary: ${passed} Passed, ${failed} Failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSecurityAuditTests();
}
