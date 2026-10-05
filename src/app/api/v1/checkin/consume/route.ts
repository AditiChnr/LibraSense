import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { StudySession, Reservation } from '@/types';
import {
  verifyCheckinChallenge,
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
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required for check-in.' }, { status: 401 });
    }

    const body = await request.json();
    const { challengeId, challengeToken, optionalCoords } = body;

    if (!challengeId || !challengeToken) {
      return NextResponse.json({ error: 'MISSING_FIELDS', message: 'challengeId and challengeToken are required.' }, { status: 400 });
    }

    // Execute Authoritative Check-in Consumption Transaction
    const result = await adminDb.runTransaction(async (transaction) => {
      // 1. Fetch Challenge Record
      const challengeRef = adminDb.collection('checkinChallenges').doc(challengeId);
      const challengeDoc = await transaction.get(challengeRef);

      if (!challengeDoc.exists) {
        throw new Error('CHALLENGE_NOT_FOUND: Check-in challenge does not exist.');
      }

      const challengeData = challengeDoc.data()!;

      // 2. Prevent Challenge Replay
      if (challengeData.consumed) {
        throw new Error('CHALLENGE_ALREADY_CONSUMED: This check-in token has already been used.');
      }

      // 3. Verify Authenticated User Match
      if (challengeData.userId !== userId) {
        throw new Error('FORBIDDEN: Challenge was issued to a different user account.');
      }

      // 4. Verify Cryptographic Signature & 60s Expiration
      const challengePayload: CheckinChallengePayload = {
        challengeId,
        userId: challengeData.userId,
        reservationId: challengeData.reservationId,
        seatId: challengeData.seatId,
        expiresAt: challengeData.expiresAt,
      };

      const verification = verifyCheckinChallenge(challengePayload, challengeToken);
      if (!verification.valid) {
        throw new Error(`${verification.errorCode}: ${verification.errorMessage}`);
      }

      // 5. Fetch and Validate Reservation
      const resRef = adminDb.collection('reservations').doc(challengeData.reservationId);
      const resDoc = await transaction.get(resRef);

      if (!resDoc.exists) {
        throw new Error('RESERVATION_NOT_FOUND: Associated reservation no longer exists.');
      }

      const resData = resDoc.data() as Reservation;
      if (resData.status !== 'active') {
        throw new Error(`INVALID_RESERVATION_STATUS: Reservation status is '${resData.status}'. Only active bookings can be checked in.`);
      }

      // 6. Atomically Consume Challenge
      transaction.update(challengeRef, {
        consumed: true,
        consumedAt: new Date().toISOString(),
        optionalCoords: optionalCoords || null,
      });

      // 7. Update Reservation Status
      const checkinTimeIso = new Date().toISOString();
      transaction.update(resRef, {
        status: 'checked_in',
        checkedInAt: checkinTimeIso,
      });

      // 8. Initialize Authoritative Study Session Document
      const sessionRef = adminDb.collection('sessions').doc();
      const sessionId = sessionRef.id;

      const newSession: StudySession = {
        id: sessionId,
        userId,
        reservationId: challengeData.reservationId,
        seatId: challengeData.seatId,
        startTime: checkinTimeIso, // Authoritative server timestamp
        endTime: null,
        status: 'active',
        studyDurationSeconds: 0,
        breakDurationSeconds: 0,
        pomodoroCyclesCompleted: 0,
      };

      transaction.set(sessionRef, newSession);

      // 9. Dispatch In-App Notification
      const notificationRef = adminDb.collection('notifications').doc();
      transaction.set(notificationRef, {
        userId,
        title: 'Check-In Confirmed',
        message: `You are checked in at Desk ${challengeData.seatId.replace('seat_', '')}. Study session timer started.`,
        type: 'system',
        read: false,
        createdAt: checkinTimeIso,
      });

      return {
        sessionId,
        seatId: challengeData.seatId,
        reservationId: challengeData.reservationId,
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Check-in confirmed and study session started.',
      data: result,
    });
  } catch (err: unknown) {
    console.error('Check-in consume API Error:', err);
    const message = err instanceof Error ? err.message : 'Check-in failed';

    if (message.includes('CHALLENGE_ALREADY_CONSUMED')) {
      return NextResponse.json({ error: 'TOKEN_REUSED', message }, { status: 409 });
    }
    if (message.includes('CHALLENGE_EXPIRED') || message.includes('INVALID_SIGNATURE')) {
      return NextResponse.json({ error: 'INVALID_TOKEN', message }, { status: 422 });
    }

    return NextResponse.json({ error: 'CHECKIN_FAILED', message }, { status: 500 });
  }
}
