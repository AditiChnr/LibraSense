import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Reservation, Seat } from '@/types';
import {
  signCheckinChallenge,
  isWithinCheckinWindow,
  CheckinChallengePayload,
} from '@/lib/services/checkinCrypto';

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
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required for seat check-in.' }, { status: 401 });
    }

    const body = await request.json();
    const { qrPublicId } = body;

    if (!qrPublicId) {
      return NextResponse.json({ error: 'MISSING_QR_ID', message: 'qrPublicId is required.' }, { status: 400 });
    }

    // Extract raw seat identifier from URL format if needed
    const normalizedQrId = String(qrPublicId).replace('librasense://seat/', '').trim();

    // 1. Resolve Seat in Database
    const seatQuery = await adminDb
      .collection('seats')
      .where('qrPublicId', '==', normalizedQrId)
      .limit(1)
      .get();

    if (seatQuery.empty) {
      // Fallback lookup by doc id
      const directSeat = await adminDb.collection('seats').doc(normalizedQrId).get();
      if (!directSeat.exists) {
        return NextResponse.json({ error: 'INVALID_SEAT_QR', message: 'Unrecognized seat QR code.' }, { status: 404 });
      }
    }

    const targetSeatDoc = !seatQuery.empty ? seatQuery.docs[0]! : await adminDb.collection('seats').doc(normalizedQrId).get();
    const seatData = { id: targetSeatDoc.id, ...targetSeatDoc.data() } as Seat;

    // 2. Lookup User's Active Reservation for This Seat
    const resQuery = await adminDb
      .collection('reservations')
      .where('userId', '==', userId)
      .where('seatId', '==', seatData.id)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (resQuery.empty) {
      return NextResponse.json(
        {
          error: 'NO_ACTIVE_RESERVATION',
          message: `You do not have an active reservation for Desk ${seatData.seatNumber}. Please book this desk first.`,
        },
        { status: 403 }
      );
    }

    const resDoc = resQuery.docs[0]!;
    const reservation = { id: resDoc.id, ...resDoc.data() } as Reservation;

    // 3. Validate Check-in Time Window
    const windowCheck = isWithinCheckinWindow(
      reservation.startTime,
      reservation.gracePeriodMinutes || 15
    );

    if (!windowCheck.valid) {
      return NextResponse.json(
        {
          error: 'INVALID_CHECKIN_WINDOW',
          message: windowCheck.reason || 'Check-in is not allowed outside the reservation window.',
        },
        { status: 422 }
      );
    }

    // 4. Generate Short-Lived (60s) HMAC Signed Challenge
    const challengeRef = adminDb.collection('checkinChallenges').doc();
    const challengeId = challengeRef.id;
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 60 seconds validity

    const challengePayload: CheckinChallengePayload = {
      challengeId,
      userId,
      reservationId: reservation.id,
      seatId: seatData.id,
      expiresAt,
    };

    const signature = signCheckinChallenge(challengePayload);

    // Save Challenge Document
    await challengeRef.set({
      ...challengePayload,
      signature,
      consumed: false,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      challengeId,
      challengeToken: signature,
      expiresAt,
      seatNumber: seatData.seatNumber,
      seatId: seatData.id,
      reservationId: reservation.id,
    });
  } catch (err: unknown) {
    console.error('Check-in challenge API Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate check-in challenge.';
    return NextResponse.json({ error: 'CHALLENGE_FAILED', message }, { status: 500 });
  }
}
