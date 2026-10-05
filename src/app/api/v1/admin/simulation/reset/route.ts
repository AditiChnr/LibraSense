import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdminRequest, logAuditEvent } from '@/lib/services/adminAuth';
import { HardwareState } from '@/types';

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: auth.error }, { status: auth.status });
  }

  try {
    const serverNowIso = new Date().toISOString();

    // Fetch all seats to reset their hardware states
    const seatsSnap = await adminDb.collection('seats').get();
    const batch = adminDb.batch();

    let resetCount = 0;
    seatsSnap.docs.forEach((doc) => {
      const seatId = doc.id;
      const hwRef = adminDb.collection('hardwareStates').doc(seatId);
      const resetHwState: HardwareState = {
        seatId,
        occupied: false,
        rawConfidence: 0.95,
        smoothedConfidence: 0.95,
        consecutiveFrameCount: 3,
        lastUpdate: serverNowIso,
        source: 'simulation',
        lastTickId: 'reset_sim_state',
      };
      batch.set(hwRef, resetHwState);
      resetCount++;
    });

    // Reset default simulated device
    const deviceRef = adminDb.collection('devices').doc('dev_rpi_01');
    batch.set(
      deviceRef,
      {
        id: 'dev_rpi_01',
        name: 'Simulated Edge Camera Daemon',
        status: 'ONLINE',
        detectionConfidence: 0.95,
        lastHeartbeat: serverNowIso,
        ipAddress: '127.0.0.1 (simulated)',
      },
      { merge: true }
    );

    await batch.commit();

    await logAuditEvent(
      auth.adminUid!,
      'SIMULATION_RESET',
      'all_seats',
      { resetCount, timestamp: serverNowIso }
    );

    return NextResponse.json({
      success: true,
      resetCount,
      message: `Successfully reset simulated hardware states for ${resetCount} seats to VACANT.`,
    });
  } catch (err: unknown) {
    console.error('Simulation Reset Error:', err);
    return NextResponse.json({ error: 'RESET_FAILED', message: 'Failed to reset simulation states.' }, { status: 500 });
  }
}
