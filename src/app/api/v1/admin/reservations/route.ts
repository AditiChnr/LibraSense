import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdminRequest, logAuditEvent } from '@/lib/services/adminAuth';
import { Reservation, BookedSlot } from '@/types';

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const dateFilter = searchParams.get('date');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    let query: FirebaseFirestore.Query = adminDb.collection('reservations');

    if (statusFilter && statusFilter !== 'all') {
      query = query.where('status', '==', statusFilter);
    }
    if (dateFilter) {
      query = query.where('date', '==', dateFilter);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get();
    const reservations: Reservation[] = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Reservation)
    );

    return NextResponse.json({ success: true, reservations });
  } catch (err) {
    console.error('Admin Reservations GET Error:', err);
    return NextResponse.json({ error: 'SERVER_ERROR', message: 'Failed to fetch reservations.' }, { status: 500 });
  }
}

/**
 * Admin cancellation endpoint to release slots if student no-showed or for operational reasons.
 */
export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { reservationId, action, reason } = body as {
      reservationId: string;
      action: 'cancel' | 'mark_noshow';
      reason?: string;
    };

    if (!reservationId || !['cancel', 'mark_noshow'].includes(action)) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'reservationId and valid action (cancel | mark_noshow) required.' },
        { status: 400 }
      );
    }

    const updatedReservation = await adminDb.runTransaction(async (transaction) => {
      const resRef = adminDb.collection('reservations').doc(reservationId);
      const resDoc = await transaction.get(resRef);
      if (!resDoc.exists) {
        throw new Error('RESERVATION_NOT_FOUND: Reservation does not exist.');
      }

      const resData = resDoc.data() as Reservation;
      const targetStatus = action === 'cancel' ? 'cancelled' : 'no_show';

      // Release slot lock from /seats/{seatId}/slots/{date}
      const slotDocRef = adminDb.collection('seats').doc(resData.seatId).collection('slots').doc(resData.date);
      const slotDoc = await transaction.get(slotDocRef);

      if (slotDoc.exists) {
        const currentSlots: BookedSlot[] = slotDoc.data()?.bookedSlots || [];
        const filteredSlots = currentSlots.filter((slot) => slot.reservationId !== reservationId);
        transaction.update(slotDocRef, {
          bookedSlots: filteredSlots,
          lastUpdated: new Date().toISOString(),
        });
      }

      // Update reservation record
      transaction.update(resRef, {
        status: targetStatus,
        cancelledAt: new Date().toISOString(),
        adminActionReason: reason || `Action performed by administrator (${auth.adminEmail})`,
      });

      return { ...resData, status: targetStatus };
    });

    // Write audit event
    await logAuditEvent(
      auth.adminUid!,
      action === 'cancel' ? 'ADMIN_RESERVATION_CANCELLED' : 'ADMIN_MARKED_NO_SHOW',
      reservationId,
      {
        seatId: updatedReservation.seatId,
        studentUid: updatedReservation.userId,
        reason: reason || null,
      }
    );

    return NextResponse.json({
      success: true,
      reservationId,
      status: updatedReservation.status,
      message: `Reservation ${reservationId} successfully updated to ${updatedReservation.status}.`,
    });
  } catch (err: unknown) {
    console.error('Admin Reservation Action Error:', err);
    const message = err instanceof Error ? err.message : 'Reservation update failed.';
    return NextResponse.json({ error: 'TRANSACTION_ERROR', message }, { status: 500 });
  }
}
