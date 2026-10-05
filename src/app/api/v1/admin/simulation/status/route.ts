import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdminRequest } from '@/lib/services/adminAuth';
import { ProcessedTickRecord } from '@/types';

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: auth.error }, { status: auth.status });
  }

  try {
    // Fetch last 25 processed ticks ordered by timestamp
    const ticksSnap = await adminDb
      .collection('processedTicks')
      .orderBy('timestamp', 'desc')
      .limit(25)
      .get();

    const ticks: ProcessedTickRecord[] = ticksSnap.docs.map((doc) => doc.data() as ProcessedTickRecord);

    // Fetch simulation hardware states
    const hwSnap = await adminDb
      .collection('hardwareStates')
      .where('source', '==', 'simulation')
      .get();

    const simulatedSeatsCount = hwSnap.docs.length;
    const occupiedSimulatedCount = hwSnap.docs.filter((d) => d.data().occupied === true).length;

    return NextResponse.json({
      success: true,
      totalProcessedTicks: ticks.length,
      simulatedSeatsCount,
      occupiedSimulatedCount,
      ticks,
    });
  } catch (err: unknown) {
    console.error('Simulation Status Error:', err);
    return NextResponse.json({ error: 'FETCH_ERROR', message: 'Failed to fetch simulation status.' }, { status: 500 });
  }
}
