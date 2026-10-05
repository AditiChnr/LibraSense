import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Reservation, SystemConfig, BookedSlot } from '@/types';
import {
  calculateSlotRange,
  hasSlotOverlap,
  validateReservationRules,
} from '@/lib/services/reservationValidation';

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
    const { seatId, date, startTimeIso, endTimeIso } = body;

    if (!seatId || !date || !startTimeIso || !endTimeIso) {
      return NextResponse.json({ error: 'MISSING_FIELDS', message: 'seatId, date, startTimeIso, and endTimeIso are required.' }, { status: 400 });
    }

    // Execute Authoritative Server Transaction
    const newReservation = await adminDb.runTransaction(async (transaction) => {
      // 1. Fetch System Config
      const configDoc = await transaction.get(adminDb.collection('systemSettings').doc('config'));
      const config = (configDoc.data() as SystemConfig) || {
        maxActiveReservations: 2,
        maxFutureReservations: 5,
        maxDurationMinutes: 240,
        minBookingLeadMinutes: 15,
        maxBookingLeadDays: 7,
        defaultGracePeriodMinutes: 15,
        minCancellationNoticeMinutes: 30,
        hardwareModeEnabled: true,
        simulationActive: false,
      };

      // 2. Fetch Target Seat
      const seatRef = adminDb.collection('seats').doc(seatId);
      const seatDoc = await transaction.get(seatRef);
      if (!seatDoc.exists) {
        throw new Error('SEAT_NOT_FOUND: Target seat does not exist.');
      }
      const seatData = seatDoc.data()!;
      if (seatData.isMaintenance) {
        throw new Error('SEAT_IN_MAINTENANCE: This seat is currently under maintenance.');
      }

      // 3. Fetch User's Active Reservations Count
      const activeResQuery = await adminDb
        .collection('reservations')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .get();

      const activeCount = activeResQuery.size;

      // 4. Validate Business Rules
      const ruleValidation = validateReservationRules(
        { userId, seatId, date, startTimeIso, endTimeIso },
        config,
        activeCount
      );

      if (!ruleValidation.valid) {
        throw new Error(`${ruleValidation.errorCode}: ${ruleValidation.errorMessage}`);
      }

      // 5. Fetch Daily Slot Lock Document
      const slotDocRef = adminDb.collection('seats').doc(seatId).collection('slots').doc(date);
      const slotDoc = await transaction.get(slotDocRef);

      const existingSlots: BookedSlot[] = slotDoc.exists ? slotDoc.data()?.bookedSlots || [] : [];
      const requestedRange = calculateSlotRange(startTimeIso, endTimeIso);

      // 6. Check for Slot Overlaps
      if (hasSlotOverlap(requestedRange, existingSlots)) {
        throw new Error('RESERVATION_CONFLICT: The selected seat is already reserved for this time slot.');
      }

      // 7. Generate Reservation Record
      const reservationRef = adminDb.collection('reservations').doc();
      const reservationId = reservationRef.id;

      const reservationData: Reservation = {
        id: reservationId,
        userId,
        seatId,
        date,
        startTime: startTimeIso,
        endTime: endTimeIso,
        gracePeriodMinutes: config.defaultGracePeriodMinutes,
        status: 'active',
        createdAt: new Date().toISOString(),
        checkedInAt: null,
        cancelledAt: null,
      };

      // 8. Construct Updated Booked Slots
      const newBookedSlot: BookedSlot = {
        slotIndex: requestedRange.startSlot,
        lengthSlots: requestedRange.lengthSlots,
        reservationId,
        startTimeIso,
        endTimeIso,
      };

      const updatedSlots = [...existingSlots, newBookedSlot];

      // 9. Atomic Transaction Commit
      transaction.set(slotDocRef, {
        seatId,
        date,
        bookedSlots: updatedSlots,
        lastUpdated: new Date().toISOString(),
      });

      transaction.set(reservationRef, reservationData);

      // 10. Atomic Notification Dispatch
      const notificationRef = adminDb.collection('notifications').doc();
      transaction.set(notificationRef, {
        userId,
        title: 'Reservation Confirmed',
        message: `Your booking for Seat ${seatData.seatNumber} on ${date} is confirmed.`,
        type: 'reservation_confirmed',
        read: false,
        createdAt: new Date().toISOString(),
      });

      return reservationData;
    });

    return NextResponse.json({ success: true, reservation: newReservation });
  } catch (err: unknown) {
    console.error('Reservation API Transaction Error:', err);
    const message = err instanceof Error ? err.message : 'Reservation failed';

    if (message.includes('RESERVATION_CONFLICT')) {
      return NextResponse.json({ error: 'RESERVATION_CONFLICT', message }, { status: 409 });
    }
    if (message.includes('MAX_ACTIVE_RESERVATIONS_EXCEEDED') || message.includes('SEAT_IN_MAINTENANCE')) {
      return NextResponse.json({ error: 'RULE_VIOLATION', message }, { status: 422 });
    }

    return NextResponse.json({ error: 'RESERVATION_FAILED', message }, { status: 500 });
  }
}

export async function GET(request: Request) {
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

    const snapshot = await adminDb
      .collection('reservations')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const reservations: Reservation[] = [];
    snapshot.forEach((doc) => {
      reservations.push({ id: doc.id, ...doc.data() } as Reservation);
    });

    return NextResponse.json({ success: true, reservations });
  } catch (err: unknown) {
    console.error('Fetch Reservations Error:', err);
    return NextResponse.json({ error: 'FETCH_FAILED', message: 'Failed to fetch reservations.' }, { status: 500 });
  }
}
