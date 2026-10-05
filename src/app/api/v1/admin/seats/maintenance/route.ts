import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdminRequest, logAuditEvent } from '@/lib/services/adminAuth';

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { seatId, isMaintenance, reason } = body;

    if (!seatId || typeof isMaintenance !== 'boolean') {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'seatId and isMaintenance (boolean) are required.' },
        { status: 400 }
      );
    }

    const seatRef = adminDb.collection('seats').doc(seatId);
    const seatDoc = await seatRef.get();
    if (!seatDoc.exists) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Seat does not exist.' }, { status: 404 });
    }

    const seatData = seatDoc.data()!;
    const previousState = seatData.isMaintenance;

    // Update seat maintenance status
    await seatRef.update({
      isMaintenance,
      maintenanceReason: isMaintenance ? (reason || 'Administrative maintenance') : null,
      maintenanceUpdatedAt: new Date().toISOString(),
      maintenanceUpdatedBy: auth.adminUid,
    });

    // Write audit record
    await logAuditEvent(
      auth.adminUid!,
      'SEAT_MAINTENANCE_TOGGLED',
      seatId,
      {
        seatNumber: seatData.seatNumber,
        previousState,
        newState: isMaintenance,
        reason: reason || null,
      }
    );

    return NextResponse.json({
      success: true,
      seatId,
      isMaintenance,
      seatNumber: seatData.seatNumber,
      message: `Seat ${seatData.seatNumber} maintenance status updated to ${isMaintenance ? 'ENABLED' : 'DISABLED'}.`,
    });
  } catch (err) {
    console.error('Admin Maintenance API Error:', err);
    return NextResponse.json({ error: 'SERVER_ERROR', message: 'Failed to update maintenance status.' }, { status: 500 });
  }
}
