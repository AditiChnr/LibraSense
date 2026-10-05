import { Seat, SimulationScenario } from '@/types';
import { signIoTPayload, IoTTelemetryPayload } from '@/lib/services/iotSecurity';

export interface SimulatedSignedRequest {
  url: string;
  headers: Record<string, string>;
  bodyJson: IoTTelemetryPayload;
  rawBody: string;
  tickId: string;
  nonce: string;
  timestampIso: string;
}

/**
 * Generates a unique, deterministic-style tick identifier.
 */
export function generateTickId(prefix: string = 'sim_tick'): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Constructs a fully signed simulated IoT request matching Raspberry Pi edge specifications.
 */
export function buildSimulatedSignedRequest(
  seatId: string,
  occupied: boolean,
  confidence: number,
  tickId: string = generateTickId(),
  deviceId: string = 'dev_rpi_01',
  timestampIso: string = new Date().toISOString(),
  nonce: string = `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
): SimulatedSignedRequest {
  const payloadBodyObj: IoTTelemetryPayload = {
    seatId,
    occupied,
    confidence,
    tickId,
    source: 'simulation',
  };

  const rawBody = JSON.stringify(payloadBodyObj);
  const signature = signIoTPayload(deviceId, timestampIso, nonce, rawBody);

  return {
    url: '/api/v1/iot/occupancy',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-ID': deviceId,
      'X-Device-Timestamp': timestampIso,
      'X-Device-Nonce': nonce,
      'X-Device-Signature': signature,
      'X-Tick-ID': tickId,
    },
    bodyJson: payloadBodyObj,
    rawBody,
    tickId,
    nonce,
    timestampIso,
  };
}

/**
 * Generates deterministic occupancy state assignments per seat given a scenario.
 */
export function getScenarioOccupancy(
  scenario: SimulationScenario,
  seats: Seat[],
  tickIndex: number = 0
): Map<string, { occupied: boolean; confidence: number }> {
  const result = new Map<string, { occupied: boolean; confidence: number }>();

  seats.forEach((seat, idx) => {
    let occupied = false;
    let confidence = 0.92;

    switch (scenario) {
      case 'PEAK_AFTERNOON':
        // High occupancy (75-80% of desks occupied)
        occupied = (idx % 4) !== 0;
        confidence = 0.94;
        break;

      case 'QUIET_MORNING':
        // Low occupancy (20-25% of desks occupied)
        occupied = idx === 0 || idx === 4 || idx === 16;
        confidence = 0.95;
        break;

      case 'EXAM_WEEK':
        // Very high occupancy (90%+)
        occupied = (idx % 10) !== 0;
        confidence = 0.96;
        break;

      case 'RANDOM_WALK':
        // Pseudo-random state that shifts slightly per tickIndex
        const pseudoVal = Math.sin((idx + 1) * 17.5 + tickIndex * 1.3);
        occupied = pseudoVal > 0.1;
        confidence = 0.88 + Math.abs(pseudoVal) * 0.1;
        break;

      case 'MANUAL_INJECTION':
      default:
        occupied = false;
        confidence = 0.90;
        break;
    }

    result.set(seat.id, { occupied, confidence: Math.min(0.99, Number(confidence.toFixed(2))) });
  });

  return result;
}
