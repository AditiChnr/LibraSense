import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { BookedSlot } from '@/types';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const sessionCookie = request.headers.get('cookie')?.split('librasense_session=')[1]?.split(';')[0];

    let userId = '';
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await adminAuth.verifyIdToken(token!);
      userId = decoded.uid;
    } else if (sessionCookie) {
      userId = sessionCookie;
    }

    if (!userId) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required.' }, { status: 401 });
    }

    const body = await request.json();
    const { reservationId } = body;

    if (!reservationId) {
      return NextResponse.json({ error: 'MISSING_FIELDS', message: 'reservationId is required.' }, { status: 400 });
    }

    // Execute Atomic Cancellation Transaction
    await adminDb.runTransaction(async (transaction) => {
      const resRef = adminDb.collection('reservations').doc(reservationId);
      const resDoc = await transaction.get(resRef);

      if (!resDoc.exists) {
        throw new Error('RESERVATION_NOT_FOUND: Reservation does not exist.');
      }

      const resData = resDoc.data()!;
      if (resData.userId !== userId) {
        throw new Error('FORBIDDEN: You do not own this reservation.');
      }

      if (resData.status !== 'active') {
        throw new Error('INVALID_STATUS: Only active reservations can be cancelled.');
      }

      // 1. Mark reservation as cancelled
      transaction.update(resRef, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
      });

      // 2. Remove slot lock from /seats/{seatId}/slots/{date}
      const slotDocRef = adminDb
        .collection('seats')
        .doc(resData.seatId)
        .collection('slots')
        .doc(resData.date);

      const slotDoc = await transaction.get(slotDocRef);
      if (slotDoc.exists) {
        const existingSlots: BookedSlot[] = slotDoc.data()?.bookedSlots || [];
        const updatedSlots = existingSlots.filter((slot) => slot.reservationId !== reservationId);

        transaction.update(slotDocRef, {
          bookedSlots: updatedSlots,
          lastUpdated: new Date().toISOString(),
        });
      }

      // 3. Create Notification
      const notificationRef = adminDb.collection('notifications').doc();
      transaction.set(notificationRef, {
        userId,
        title: 'Reservation Cancelled',
        message: `Your booking for Seat ${resData.seatId.replace('seat_', '')} on ${resData.date} was cancelled.`,
        type: 'cancellation',
        read: false,
        createdAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ success: true, message: 'Reservation cancelled successfully.' });
  } catch (err: unknown) {
    console.error('Cancellation API Error:', err);
    const message = err instanceof Error ? err.message : 'Cancellation failed';
    return NextResponse.json({ error: 'CANCELLATION_FAILED', message }, { status: 500 });
  }
}
