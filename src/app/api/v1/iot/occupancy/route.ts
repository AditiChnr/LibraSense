import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Device, HardwareState } from '@/types';
import {
  verifyIoTSignature,
  isTimestampFresh,
  computeTemporalSmoothing,
  IoTTelemetryPayload,
} from '@/lib/services/iotSecurity';

export async function POST(request: Request) {
  try {
    const deviceId = request.headers.get('X-Device-ID');
    const timestampIso = request.headers.get('X-Device-Timestamp');
    const nonce = request.headers.get('X-Device-Nonce');
    const signature = request.headers.get('X-Device-Signature');

    // 1. Validate Header Completeness
    if (!deviceId || !timestampIso || !nonce || !signature) {
      return NextResponse.json(
        { error: 'MISSING_HEADERS', message: 'X-Device-ID, X-Device-Timestamp, X-Device-Nonce, and X-Device-Signature headers are required.' },
        { status: 400 }
      );
    }

    const rawBodyText = await request.text();
    let body: IoTTelemetryPayload;

    try {
      body = JSON.parse(rawBodyText);
    } catch {
      return NextResponse.json({ error: 'INVALID_JSON', message: 'Request body must be valid JSON.' }, { status: 400 });
    }

    const { occupied, confidence } = body;

    // 2. Validate Confidence Range (0.0 to 1.0)
    if (typeof occupied !== 'boolean' || typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      return NextResponse.json(
        { error: 'INVALID_PAYLOAD', message: 'occupied (boolean) and confidence (0.0 - 1.0) are required.' },
        { status: 400 }
      );
    }

    // 3. Validate Timestamp Freshness (Max 30s drift)
    const serverNowIso = new Date().toISOString();
    if (!isTimestampFresh(timestampIso, serverNowIso, 30)) {
      return NextResponse.json(
        { error: 'STALE_TIMESTAMP', message: 'Request timestamp is older than 30 seconds or from the future.' },
        { status: 403 }
      );
    }

    // 4. Verify Registered Device & Secret Key
    const deviceRef = adminDb.collection('devices').doc(deviceId);
    const deviceDoc = await deviceRef.get();

    if (!deviceDoc.exists) {
      return NextResponse.json({ error: 'UNREGISTERED_DEVICE', message: `Device '${deviceId}' is not registered.` }, { status: 403 });
    }

    const deviceData = deviceDoc.data() as Device;
    const assignedSeatId = deviceData.assignedSeatId;

    if (!assignedSeatId) {
      return NextResponse.json({ error: 'UNASSIGNED_DEVICE', message: `Device '${deviceId}' is not bound to a seat.` }, { status: 422 });
    }

    // 5. Verify Cryptographic HMAC Signature
    const isSignatureValid = verifyIoTSignature(deviceId, timestampIso, nonce, rawBodyText, signature);
    if (!isSignatureValid) {
      return NextResponse.json({ error: 'INVALID_SIGNATURE', message: 'HMAC signature verification failed.' }, { status: 401 });
    }

    const tickId = request.headers.get('X-Tick-ID') || body.tickId;
    const source = body.source || 'hardware';

    // 6. Execute Transactional Temporal Smoothing & State Update with Idempotency
    const result = await adminDb.runTransaction(async (transaction) => {
      // Idempotency: Check Processed Ticks Collection
      if (tickId) {
        const tickRef = adminDb.collection('processedTicks').doc(tickId);
        const tickDoc = await transaction.get(tickRef);
        if (tickDoc.exists) {
          return {
            idempotent: true,
            tickId,
            seatId: assignedSeatId,
            message: `Tick '${tickId}' has already been processed (idempotent no-op).`,
          };
        }
        transaction.set(tickRef, {
          tickId,
          deviceId,
          seatId: assignedSeatId,
          occupied,
          confidence,
          source,
          timestamp: timestampIso,
          processedAt: serverNowIso,
        });
      }

      // Replay Defense: Check Nonce Cache
      const nonceRef = adminDb.collection('seenNonces').doc(nonce);
      const nonceDoc = await transaction.get(nonceRef);
      if (nonceDoc.exists) {
        throw new Error('NONCE_REPLAYED: This request nonce has already been processed.');
      }
      transaction.set(nonceRef, { deviceId, processedAt: serverNowIso });

      // Fetch Current Hardware State
      const hwStateRef = adminDb.collection('hardwareStates').doc(assignedSeatId);
      const hwDoc = await transaction.get(hwStateRef);
      const currentHwState: HardwareState | null = hwDoc.exists ? (hwDoc.data() as HardwareState) : null;

      // Apply Temporal Smoothing moving average
      const smoothedState = computeTemporalSmoothing(currentHwState, occupied, confidence, serverNowIso, 3);
      smoothedState.seatId = assignedSeatId;
      smoothedState.source = source;
      if (tickId) smoothedState.lastTickId = tickId;

      // Update Hardware State Document
      transaction.set(hwStateRef, smoothedState);

      // Update Device Heartbeat and Status
      transaction.update(deviceRef, {
        status: 'ONLINE',
        detectionConfidence: smoothedState.smoothedConfidence,
        lastHeartbeat: serverNowIso,
      });

      // Record Telemetry Audit Log
      const logRef = adminDb.collection('occupancyLogs').doc();
      transaction.set(logRef, {
        deviceId,
        seatId: assignedSeatId,
        rawOccupied: occupied,
        smoothedOccupied: smoothedState.occupied,
        confidence: smoothedState.smoothedConfidence,
        timestamp: serverNowIso,
        source,
        tickId: tickId || null,
      });

      return {
        seatId: assignedSeatId,
        occupied: smoothedState.occupied,
        confidence: smoothedState.smoothedConfidence,
        consecutiveFrames: smoothedState.consecutiveFrameCount,
        lastUpdate: serverNowIso,
        source,
        tickId: tickId || null,
        idempotent: false,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.idempotent ? 'Idempotent tick acknowledged without duplicate mutation.' : 'Telemetry ingested and state updated.',
      data: result,
    });
  } catch (err: unknown) {
    console.error('IoT Ingestion API Error:', err);
    const message = err instanceof Error ? err.message : 'Telemetry ingestion failed';

    if (message.includes('NONCE_REPLAYED')) {
      return NextResponse.json({ error: 'REPLAY_ATTACK', message }, { status: 409 });
    }

    return NextResponse.json({ error: 'INGESTION_FAILED', message }, { status: 500 });
  }
}
