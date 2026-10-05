import { signIoTPayload } from '../src/lib/services/iotSecurity';

const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:3000/api/v1/iot/occupancy';
const DEVICE_ID = 'dev_rpi_01';
const SECRET_KEY = process.env.IOT_DEVICE_SECRET_KEY || 'librasense_iot_hmac_secret_2026';

export interface SimulationStepResult {
  step: string;
  statusCode: number;
  response: Record<string, unknown>;
  passed: boolean;
}

export async function sendSimulatedFrame(
  occupied: boolean,
  confidence: number,
  overrideTimestamp?: string,
  overrideNonce?: string,
  overrideSignature?: string
): Promise<{ status: number; data: Record<string, unknown> }> {
  const timestampIso = overrideTimestamp || new Date().toISOString();
  const nonce = overrideNonce || `sim_nonce_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const payloadBody = JSON.stringify({ occupied, confidence });
  const signature = overrideSignature || signIoTPayload(DEVICE_ID, timestampIso, nonce, payloadBody, SECRET_KEY);

  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-ID': DEVICE_ID,
      'X-Device-Timestamp': timestampIso,
      'X-Device-Nonce': nonce,
      'X-Device-Signature': signature,
    },
    body: payloadBody,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export async function runHardwareSimulatorScenarios() {
  console.log('Starting LibraSense Hardware Device Simulator Scenarios...\n');
  const results: SimulationStepResult[] = [];

  // Scenario 1: Valid Device Telemetry (Unoccupied)
  const res1 = await sendSimulatedFrame(false, 0.95);
  results.push({
    step: '1. Valid Unoccupied Telemetry',
    statusCode: res1.status,
    response: res1.data,
    passed: res1.status === 200 && res1.data?.data !== undefined,
  });

  // Scenario 2: Person Sits Down (3 Consecutive Frames for Temporal Smoothing)
  await sendSimulatedFrame(true, 0.92);
  await sendSimulatedFrame(true, 0.94);
  const res2c = await sendSimulatedFrame(true, 0.93);
  results.push({
    step: '2. Person Sits Down (3 Frames -> State Transitions to Occupied)',
    statusCode: res2c.status,
    response: res2c.data,
    passed: res2c.status === 200,
  });

  // Scenario 3: Invalid HMAC Signature Security Test
  const res3 = await sendSimulatedFrame(true, 0.90, undefined, undefined, 'invalid_tampered_signature_hash');
  results.push({
    step: '3. Security: Invalid Signature Rejection (Expected 401)',
    statusCode: res3.status,
    response: res3.data,
    passed: res3.status === 401,
  });

  // Scenario 4: Stale Timestamp Security Test (5 mins in past)
  const staleTimestamp = new Date(Date.now() - 300 * 1000).toISOString();
  const res4 = await sendSimulatedFrame(true, 0.90, staleTimestamp);
  results.push({
    step: '4. Security: Stale Timestamp Rejection (Expected 403)',
    statusCode: res4.status,
    response: res4.data,
    passed: res4.status === 403,
  });

  // Scenario 5: Replayed Nonce Attack Test
  const fixedNonce = `replayed_nonce_${Date.now()}`;
  await sendSimulatedFrame(true, 0.90, undefined, fixedNonce);
  const res5b = await sendSimulatedFrame(true, 0.90, undefined, fixedNonce);
  results.push({
    step: '5. Security: Replayed Nonce Rejection (Expected 409)',
    statusCode: res5b.status,
    response: res5b.data,
    passed: res5b.status === 409,
  });

  console.log('--- Simulation Scenario Results ---');
  results.forEach((r) => {
    const mark = r.passed ? '✓ [PASS]' : '✕ [FAIL]';
    console.log(`${mark} ${r.step} -> HTTP ${r.statusCode}`);
  });

  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`\nSimulator Finished: ${results.length - failedCount} Passed, ${failedCount} Failed.`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runHardwareSimulatorScenarios();
}
