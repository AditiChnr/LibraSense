import {
  generateTickId,
  buildSimulatedSignedRequest,
  getScenarioOccupancy,
} from '../../src/lib/services/simulationEngine';
import { verifyIoTSignature } from '../../src/lib/services/iotSecurity';
import { resolveSeatState } from '../../src/lib/services/seatStateResolver';
import { Seat, HardwareState, Reservation, StudySession } from '../../src/types';

export function runSimulationEngineTests() {
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

  const mockSeats: Seat[] = Array.from({ length: 20 }, (_, i) => ({
    id: `seat_${String(i + 1).padStart(2, '0')}`,
    seatNumber: `A${i + 1}`,
    floorId: 'floor_1',
    coordinates: { x: 10 + i * 20, y: 50, width: 40, height: 40, rotation: 0 },
    zone: 'Quiet Zone',
    features: ['Power Outlet'],
    isMaintenance: false,
    isHardwareMonitored: true,
    qrPublicId: `qr_seat_${i + 1}`,
  }));

  // Test 1: generateTickId format and uniqueness
  const tick1 = generateTickId();
  const tick2 = generateTickId();
  assert('generateTickId produces a non-empty string starting with sim_tick', tick1.startsWith('sim_tick_'));
  assert('generateTickId produces distinct unique values across successive calls', tick1 !== tick2);

  // Test 2: buildSimulatedSignedRequest structure & HMAC-SHA256 signature verification
  const testSeatId = 'seat_01';
  const customTick = generateTickId('test_tick');
  const signedReq = buildSimulatedSignedRequest(testSeatId, true, 0.94, customTick);

  assert('buildSimulatedSignedRequest attaches required headers', Boolean(
    signedReq.headers['X-Device-ID'] &&
    signedReq.headers['X-Device-Timestamp'] &&
    signedReq.headers['X-Device-Nonce'] &&
    signedReq.headers['X-Device-Signature'] &&
    signedReq.headers['X-Tick-ID']
  ));

  const isSigValid = verifyIoTSignature(
    signedReq.headers['X-Device-ID'],
    signedReq.headers['X-Device-Timestamp'],
    signedReq.headers['X-Device-Nonce'],
    signedReq.rawBody,
    signedReq.headers['X-Device-Signature']
  );
  assert('buildSimulatedSignedRequest generates valid HMAC-SHA256 signature verifiable by IoT security layer', isSigValid === true);
  assert('buildSimulatedSignedRequest marks source as simulation in payload', signedReq.bodyJson.source === 'simulation');

  // Test 3: Scenario distribution - PEAK_AFTERNOON (75-80% occupancy)
  const peakDist = getScenarioOccupancy('PEAK_AFTERNOON', mockSeats, 0);
  const peakOccupiedCount = Array.from(peakDist.values()).filter((v) => v.occupied).length;
  const peakRatio = peakOccupiedCount / mockSeats.length;
  assert('PEAK_AFTERNOON scenario produces 75% occupancy', peakRatio === 0.75);

  // Test 4: Scenario distribution - QUIET_MORNING (Low occupancy)
  const quietDist = getScenarioOccupancy('QUIET_MORNING', mockSeats, 0);
  const quietOccupiedCount = Array.from(quietDist.values()).filter((v) => v.occupied).length;
  assert('QUIET_MORNING scenario produces low occupancy (<= 25%)', quietOccupiedCount / mockSeats.length <= 0.25);

  // Test 5: Scenario distribution - EXAM_WEEK (90%+ occupancy)
  const examDist = getScenarioOccupancy('EXAM_WEEK', mockSeats, 0);
  const examOccupiedCount = Array.from(examDist.values()).filter((v) => v.occupied).length;
  assert('EXAM_WEEK scenario produces high occupancy (>= 90%)', examOccupiedCount / mockSeats.length >= 0.90);

  // Test 6: Scenario distribution - RANDOM_WALK determinism per tickIndex
  const rwDist1 = getScenarioOccupancy('RANDOM_WALK', mockSeats, 1);
  const rwDist2 = getScenarioOccupancy('RANDOM_WALK', mockSeats, 1);
  const rwDist3 = getScenarioOccupancy('RANDOM_WALK', mockSeats, 5);
  const match1and2 = Array.from(rwDist1.entries()).every(([k, v]) => rwDist2.get(k)?.occupied === v.occupied);
  assert('RANDOM_WALK scenario is deterministic for the same tickIndex', match1and2 === true);
  const diff1and3 = Array.from(rwDist1.entries()).some(([k, v]) => rwDist3.get(k)?.occupied !== v.occupied);
  assert('RANDOM_WALK scenario shifts distribution across distinct tick indices', diff1and3 === true);

  // Test 7: Simulated hardware state integration with SeatStateResolver (Unauthorized Occupancy)
  const nowIso = new Date('2026-10-05T12:00:00.000Z').toISOString();
  const simulatedHwOccupied: HardwareState = {
    seatId: 'seat_01',
    occupied: true,
    rawConfidence: 0.95,
    smoothedConfidence: 0.95,
    consecutiveFrameCount: 3,
    lastUpdate: nowIso,
    source: 'simulation',
    lastTickId: tick1,
  };

  const stateUnauthorized = resolveSeatState(
    mockSeats[0],
    simulatedHwOccupied,
    undefined,
    undefined,
    nowIso
  );
  assert('resolveSeatState derives OCCUPIED_UNAUTHORIZED when simulated desk is occupied without reservation', stateUnauthorized === 'OCCUPIED_UNAUTHORIZED');

  // Test 8: Simulated hardware state integration with SeatStateResolver (Valid Checked-in Occupancy)
  const activeRes: Reservation = {
    id: 'res_01',
    userId: 'user_123',
    seatId: 'seat_01',
    date: '2026-10-05',
    startTime: '2026-10-05T11:00:00.000Z',
    endTime: '2026-10-05T13:00:00.000Z',
    gracePeriodMinutes: 15,
    status: 'checked_in',
    createdAt: '2026-10-05T10:00:00.000Z',
  };
  const activeSession: StudySession = {
    id: 'sess_01',
    userId: 'user_123',
    reservationId: 'res_01',
    seatId: 'seat_01',
    startTime: '2026-10-05T11:00:00.000Z',
    status: 'active',
    studyDurationSeconds: 3600,
    breakDurationSeconds: 600,
    pomodoroCyclesCompleted: 2,
  };

  const stateValid = resolveSeatState(
    mockSeats[0],
    simulatedHwOccupied,
    activeRes,
    activeSession,
    nowIso
  );
  assert('resolveSeatState derives OCCUPIED_VALID when simulated desk is occupied with active session', stateValid === 'OCCUPIED_VALID');

  // Test 9: Maintenance override priority over simulated occupancy
  const maintenanceSeat: Seat = { ...mockSeats[0], isMaintenance: true };
  const stateMaintenance = resolveSeatState(
    maintenanceSeat,
    simulatedHwOccupied,
    activeRes,
    activeSession,
    nowIso
  );
  assert('resolveSeatState derives MAINTENANCE overriding simulated occupancy', stateMaintenance === 'MAINTENANCE');

  // Test 10: Simulated vacant state with checked-in reservation resolves to OCCUPIED_VALID / active session state
  const simulatedHwVacant: HardwareState = {
    seatId: 'seat_01',
    occupied: false,
    rawConfidence: 0.95,
    smoothedConfidence: 0.95,
    consecutiveFrameCount: 3,
    lastUpdate: nowIso,
    source: 'simulation',
  };
  const stateVacantWithSession = resolveSeatState(
    mockSeats[0],
    simulatedHwVacant,
    activeRes,
    activeSession,
    nowIso
  );
  assert('resolveSeatState maintains OCCUPIED_VALID during temporary student step-away with active session', stateVacantWithSession === 'OCCUPIED_VALID');

  console.log(`\nSimulationEngine Tests Summary: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSimulationEngineTests();
}
