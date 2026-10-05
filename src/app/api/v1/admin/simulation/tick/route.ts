import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdminRequest, logAuditEvent } from '@/lib/services/adminAuth';
import { buildSimulatedSignedRequest, generateTickId } from '@/lib/services/simulationEngine';
import { computeTemporalSmoothing } from '@/lib/services/iotSecurity';
import { HardwareState, Device } from '@/types';

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { seatId, occupied, confidence, tickId = generateTickId(), scenario, autoSmooth = true } = body;

    if (!seatId || typeof occupied !== 'boolean') {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'seatId and occupied (boolean) are required.' },
        { status: 400 }
      );
    }

    const confVal = typeof confidence === 'number' ? Math.max(0.5, Math.min(1.0, confidence)) : 0.94;
    const serverNowIso = new Date().toISOString();

    // 1. Check if tick has already been processed (Idempotency Check)
    const tickRef = adminDb.collection('processedTicks').doc(tickId);
    const tickDoc = await tickRef.get();
    if (tickDoc.exists) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        tickId,
        seatId,
        message: `Simulation tick '${tickId}' has already been executed (idempotent no-op).`,
      });
    }

    // 2. Fetch Seat & Bound Device
    const seatDoc = await adminDb.collection('seats').doc(seatId).get();
    if (!seatDoc.exists) {
      return NextResponse.json({ error: 'SEAT_NOT_FOUND', message: `Seat '${seatId}' does not exist.` }, { status: 404 });
    }

    const deviceId = 'dev_rpi_01'; // Default simulation device
    const deviceRef = adminDb.collection('devices').doc(deviceId);
    const deviceDoc = await deviceRef.get();
    if (!deviceDoc.exists) {
      // Ensure simulated device document exists
      const newDev: Device = {
        id: deviceId,
        assignedSeatId: seatId,
        name: 'Simulated Edge Camera Daemon',
        status: 'ONLINE',
        ipAddress: '127.0.0.1 (simulated)',
        detectionConfidence: confVal,
        lastHeartbeat: serverNowIso,
      };
      await deviceRef.set(newDev);
    }

    // 3. Construct Signed Simulation Payload
    const signedReq = buildSimulatedSignedRequest(seatId, occupied, confVal, tickId, deviceId, serverNowIso);

    // 4. Execute Server-Authoritative State Mutation with Idempotency Lock
    const result = await adminDb.runTransaction(async (transaction) => {
      // Record Processed Tick in transaction
      transaction.set(tickRef, {
        tickId,
        deviceId,
        seatId,
        occupied,
        confidence: confVal,
        scenario: scenario || 'MANUAL_INJECTION',
        timestamp: serverNowIso,
        processedAt: serverNowIso,
        actorUid: auth.adminUid,
      });

      // Fetch Hardware State
      const hwStateRef = adminDb.collection('hardwareStates').doc(seatId);
      const hwDoc = await transaction.get(hwStateRef);
      const currentHwState: HardwareState | null = hwDoc.exists ? (hwDoc.data() as HardwareState) : null;

      // When autoSmooth is true, simulate 3 consecutive agreeing frames to achieve immediate state transition
      let finalState: HardwareState;
      if (autoSmooth) {
        let state = currentHwState;
        for (let i = 0; i < 3; i++) {
          state = computeTemporalSmoothing(state, occupied, confVal, serverNowIso, 3);
        }
        finalState = state!;
      } else {
        finalState = computeTemporalSmoothing(currentHwState, occupied, confVal, serverNowIso, 3);
      }

      finalState.seatId = seatId;
      finalState.source = 'simulation';
      finalState.lastTickId = tickId;

      transaction.set(hwStateRef, finalState);

      // Update Device Heartbeat
      transaction.update(deviceRef, {
        assignedSeatId: seatId,
        status: 'ONLINE',
        detectionConfidence: finalState.smoothedConfidence,
        lastHeartbeat: serverNowIso,
      });

      // Record Occupancy Telemetry Log
      const logRef = adminDb.collection('occupancyLogs').doc();
      transaction.set(logRef, {
        deviceId,
        seatId,
        rawOccupied: occupied,
        smoothedOccupied: finalState.occupied,
        confidence: finalState.smoothedConfidence,
        timestamp: serverNowIso,
        source: 'simulation',
        tickId,
      });

      return finalState;
    });

    // 5. Emit Audit Log
    await logAuditEvent(
      auth.adminUid!,
      'SIMULATION_TICK_EXECUTED',
      seatId,
      {
        tickId,
        occupied,
        confidence: confVal,
        scenario: scenario || 'MANUAL_INJECTION',
        signature: signedReq.headers['X-Device-Signature'],
      }
    );

    return NextResponse.json({
      success: true,
      idempotent: false,
      tickId,
      seatId,
      occupied: result.occupied,
      confidence: result.smoothedConfidence,
      message: `Signed simulation frame dispatched. Desk ${seatId} transitioned to ${result.occupied ? 'OCCUPIED' : 'VACANT'}.`,
    });
  } catch (err: unknown) {
    console.error('Admin Simulation Tick API Error:', err);
    return NextResponse.json({ error: 'SIMULATION_ERROR', message: 'Failed to process simulation tick.' }, { status: 500 });
  }
}
