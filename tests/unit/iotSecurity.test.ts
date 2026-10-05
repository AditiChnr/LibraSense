import {
  signIoTPayload,
  verifyIoTSignature,
  isTimestampFresh,
  evaluateDeviceHeartbeat,
  computeTemporalSmoothing,
} from '../../src/lib/services/iotSecurity';
import { HardwareState } from '../../src/types';

export function runIoTSecurityTests() {
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

  const deviceId = 'dev_rpi_01';
  const now = new Date('2026-10-05T10:00:00.000Z');
  const nowIso = now.toISOString();
  const nonce = 'nonce_123456';
  const payloadBody = JSON.stringify({ occupied: true, confidence: 0.94 });
  const secretKey = 'test_secret_key_2026';

  // Test 1: HMAC Signature Generation & Verification
  const validSig = signIoTPayload(deviceId, nowIso, nonce, payloadBody, secretKey);
  const verifyValid = verifyIoTSignature(deviceId, nowIso, nonce, payloadBody, validSig, secretKey);
  assert('verifyIoTSignature accepts valid HMAC-SHA256 signature', verifyValid === true);

  // Test 2: Invalid / Tampered Signature Rejection
  const invalidSig = validSig.replace('a', 'f');
  const verifyInvalid = verifyIoTSignature(deviceId, nowIso, nonce, payloadBody, invalidSig, secretKey);
  assert('verifyIoTSignature rejects tampered signature', verifyInvalid === false);

  // Test 3: Timestamp Freshness Checks
  const freshTs = '2026-10-05T10:00:10.000Z'; // 10s difference
  const staleTs = '2026-10-05T09:58:00.000Z'; // 2 minutes (120s difference)
  assert('isTimestampFresh accepts timestamp within 30s window', isTimestampFresh(freshTs, nowIso, 30) === true);
  assert('isTimestampFresh rejects stale timestamp older than 30s', isTimestampFresh(staleTs, nowIso, 30) === false);

  // Test 4: Heartbeat Status Evaluation
  const heartbeatOnline = new Date(now.getTime() - 15 * 1000).toISOString(); // 15s ago
  const heartbeatWarning = new Date(now.getTime() - 60 * 1000).toISOString(); // 1m ago
  const heartbeatOffline = new Date(now.getTime() - 240 * 1000).toISOString(); // 4m ago

  assert('evaluateDeviceHeartbeat resolves ONLINE for heartbeat < 30s ago', evaluateDeviceHeartbeat(heartbeatOnline, nowIso) === 'ONLINE');
  assert('evaluateDeviceHeartbeat resolves WARNING for heartbeat 30s-180s ago', evaluateDeviceHeartbeat(heartbeatWarning, nowIso) === 'WARNING');
  assert('evaluateDeviceHeartbeat resolves OFFLINE for heartbeat > 180s ago', evaluateDeviceHeartbeat(heartbeatOffline, nowIso) === 'OFFLINE');

  // Test 5: Temporal Smoothing Glitch Protection (Single Noisy Frame Ignored)
  const initialAvailableState: HardwareState = {
    seatId: 'seat_A01',
    occupied: false,
    rawConfidence: 0.95,
    smoothedConfidence: 0.95,
    lastUpdate: nowIso,
    consecutiveFrameCount: 1,
  };

  // Frame 1: Glitch - camera detects false positive (occupied: true)
  const smoothed1 = computeTemporalSmoothing(initialAvailableState, true, 0.85, nowIso, 3);
  assert('computeTemporalSmoothing ignores isolated glitch frame (remains occupied: false)', smoothed1.occupied === false);
  assert('computeTemporalSmoothing increments divergence counter', smoothed1.consecutiveFrameCount === 2);

  // Frame 2: Glitch resolves - camera returns to unoccupied
  const smoothed2 = computeTemporalSmoothing(smoothed1, false, 0.95, nowIso, 3);
  assert('computeTemporalSmoothing remains occupied: false after glitch clears', smoothed2.occupied === false);

  // Test 6: Temporal Smoothing Genuine State Transition (3 Consistent Frames)
  let state = initialAvailableState;
  // Frame 1 of genuine person sitting down
  state = computeTemporalSmoothing(state, true, 0.92, nowIso, 3);
  // Frame 2 of genuine person sitting down
  state = computeTemporalSmoothing(state, true, 0.94, nowIso, 3);
  // Frame 3 of genuine person sitting down (threshold met)
  state = computeTemporalSmoothing(state, true, 0.93, nowIso, 3);

  assert('computeTemporalSmoothing transitions to occupied: true after 3 consecutive frames', state.occupied === true);

  console.log(`\nIoTSecurity Tests Summary: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runIoTSecurityTests();
}
