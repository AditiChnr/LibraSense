import crypto from 'crypto';
import { DeviceStatus, HardwareState } from '@/types';

const IOT_DEVICE_SECRET = process.env.IOT_DEVICE_SECRET_KEY || 'librasense_iot_hmac_secret_2026';

export interface IoTTelemetryPayload {
  seatId?: string; // Optional in payload, server derives from device registration
  occupied: boolean;
  confidence: number;
  rawFrameCount?: number;
  tickId?: string;
  source?: 'hardware' | 'simulation';
}

/**
 * Signs an IoT HTTP request payload using HMAC-SHA256.
 */
export function signIoTPayload(
  deviceId: string,
  timestampIso: string,
  nonce: string,
  payloadBody: string,
  secret: string = IOT_DEVICE_SECRET
): string {
  const data = `${deviceId}:${timestampIso}:${nonce}:${payloadBody}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Validates an IoT HMAC-SHA256 signature with constant-time equality.
 */
export function verifyIoTSignature(
  deviceId: string,
  timestampIso: string,
  nonce: string,
  payloadBody: string,
  providedSignature: string,
  secret: string = IOT_DEVICE_SECRET
): boolean {
  const expected = signIoTPayload(deviceId, timestampIso, nonce, payloadBody, secret);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Validates IoT timestamp freshness (must be within 30 seconds of server clock).
 */
export function isTimestampFresh(timestampIso: string, nowIso: string = new Date().toISOString(), maxDriftSeconds: number = 30): boolean {
  const nowMs = new Date(nowIso).getTime();
  const tsMs = new Date(timestampIso).getTime();
  const diffMs = Math.abs(nowMs - tsMs);
  return diffMs <= maxDriftSeconds * 1000;
}

/**
 * Resolves device heartbeat status based on last received timestamp:
 * - ONLINE: < 30 seconds ago
 * - WARNING: 30s to 180s (3m) ago
 * - OFFLINE: > 180s (3m) ago
 */
export function evaluateDeviceHeartbeat(lastHeartbeatIso: string, nowIso: string = new Date().toISOString()): DeviceStatus {
  const nowMs = new Date(nowIso).getTime();
  const lastMs = new Date(lastHeartbeatIso).getTime();
  const elapsedSec = Math.max(0, Math.floor((nowMs - lastMs) / 1000));

  if (elapsedSec <= 30) {
    return 'ONLINE';
  }
  if (elapsedSec <= 180) {
    return 'WARNING';
  }
  return 'OFFLINE';
}

/**
 * Applies temporal smoothing filter over consecutive camera frames.
 * Prevents a single noisy camera frame (e.g. someone walking by) from immediately flipping seat state.
 * Requires K=3 consecutive frames with smoothed confidence >= 0.70 to switch state.
 */
export function computeTemporalSmoothing(
  currentState: HardwareState | null | undefined,
  rawOccupied: boolean,
  rawConfidence: number,
  nowIso: string = new Date().toISOString(),
  thresholdFrames: number = 3
): HardwareState {
  if (!currentState) {
    // Initial hardware telemetry frame
    return {
      seatId: '',
      occupied: rawOccupied,
      rawConfidence,
      smoothedConfidence: rawConfidence,
      lastUpdate: nowIso,
      consecutiveFrameCount: 1,
    };
  }

  // Check if raw frame matches current filtered state
  if (rawOccupied === currentState.occupied) {
    // Frame agrees with current state: smooth confidence towards raw confidence
    const smoothedConfidence = Number((currentState.smoothedConfidence * 0.7 + rawConfidence * 0.3).toFixed(3));
    return {
      ...currentState,
      rawConfidence,
      smoothedConfidence,
      lastUpdate: nowIso,
      consecutiveFrameCount: Math.min(10, currentState.consecutiveFrameCount + 1),
    };
  }

  // Frame differs from current state: check if consecutive count exceeds threshold
  const newConsecutiveCount = currentState.consecutiveFrameCount + 1;
  const smoothedConfidence = Number((currentState.smoothedConfidence * 0.5 + rawConfidence * 0.5).toFixed(3));

  if (newConsecutiveCount >= thresholdFrames && smoothedConfidence >= 0.70) {
    // State transition approved after K consecutive frames
    return {
      ...currentState,
      occupied: rawOccupied,
      rawConfidence,
      smoothedConfidence,
      lastUpdate: nowIso,
      consecutiveFrameCount: 1,
    };
  }

  // Glitch protection: Keep previous occupied state, record divergence count
  return {
    ...currentState,
    rawConfidence,
    smoothedConfidence,
    lastUpdate: nowIso,
    consecutiveFrameCount: newConsecutiveCount,
  };
}
