import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { StudySession, SessionBreakRecord, BookedSlot } from '@/types';
import {
  isValidSessionTransition,
  calculateTotalBreakSeconds,
  calculateAuthoritativeStudyDuration,
  SessionActionType,
} from '@/lib/services/sessionTiming';

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
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required for session actions.' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, action } = body as { sessionId: string; action: SessionActionType };

    if (!sessionId || !action) {
      return NextResponse.json({ error: 'MISSING_FIELDS', message: 'sessionId and action are required.' }, { status: 400 });
    }

    // Execute Authoritative Session Mutation Transaction
    const updatedSession = await adminDb.runTransaction(async (transaction) => {
      const sessionRef = adminDb.collection('sessions').doc(sessionId);
      const sessionDoc = await transaction.get(sessionRef);

      if (!sessionDoc.exists) {
        throw new Error('SESSION_NOT_FOUND: Active study session not found.');
      }

      const session = sessionDoc.data() as StudySession;

      // Verify Session Ownership
      if (session.userId !== userId) {
        throw new Error('FORBIDDEN: You do not have permission to control this study session.');
      }

      // Verify State Transition
      if (!isValidSessionTransition(session.status, action)) {
        throw new Error(`INVALID_TRANSITION: Action '${action}' is not allowed from status '${session.status}'.`);
      }

      const serverNow = new Date().toISOString();
      const currentBreaks: SessionBreakRecord[] = session.breaks || [];

      if (action === 'START_BREAK') {
        const newBreak: SessionBreakRecord = {
          startTime: serverNow,
          endTime: null,
          durationSeconds: 0,
        };

        transaction.update(sessionRef, {
          status: 'break',
          breaks: [...currentBreaks, newBreak],
        });

        return { ...session, status: 'break', breaks: [...currentBreaks, newBreak] };
      }

      if (action === 'END_BREAK') {
        let addedBreakSeconds = 0;
        const updatedBreaks = currentBreaks.map((b) => {
          if (!b.endTime) {
            const breakSec = Math.max(0, Math.floor((new Date(serverNow).getTime() - new Date(b.startTime).getTime()) / 1000));
            addedBreakSeconds += breakSec;
            return {
              ...b,
              endTime: serverNow,
              durationSeconds: breakSec,
            };
          }
          return b;
        });

        const newTotalBreak = (session.breakDurationSeconds || 0) + addedBreakSeconds;

        transaction.update(sessionRef, {
          status: 'active',
          breakDurationSeconds: newTotalBreak,
          breaks: updatedBreaks,
        });

        return {
          ...session,
          status: 'active',
          breakDurationSeconds: newTotalBreak,
          breaks: updatedBreaks,
        };
      }

      if (action === 'CYCLE_COMPLETE') {
        const newCycles = (session.pomodoroCyclesCompleted || 0) + 1;
        transaction.update(sessionRef, {
          pomodoroCyclesCompleted: newCycles,
        });

        return { ...session, pomodoroCyclesCompleted: newCycles };
      }

      if (action === 'END_SESSION') {
        // Close any currently active break
        const finalBreaks = currentBreaks.map((b) => {
          if (!b.endTime) {
            const breakSec = Math.max(0, Math.floor((new Date(serverNow).getTime() - new Date(b.startTime).getTime()) / 1000));
            return { ...b, endTime: serverNow, durationSeconds: breakSec };
          }
          return b;
        });

        const totalBreakSec = calculateTotalBreakSeconds(finalBreaks, serverNow);
        const { totalElapsedSeconds, studyDurationSeconds } = calculateAuthoritativeStudyDuration(
          session.startTime,
          serverNow,
          totalBreakSec
        );

        // 1. Update Session Document
        transaction.update(sessionRef, {
          status: 'ended',
          endTime: serverNow,
          studyDurationSeconds,
          breakDurationSeconds: totalBreakSec,
          breaks: finalBreaks,
        });

        // 2. Mark Reservation Completed
        if (session.reservationId) {
          const resRef = adminDb.collection('reservations').doc(session.reservationId);
          const resDoc = await transaction.get(resRef);
          if (resDoc.exists) {
            const resData = resDoc.data()!;
            transaction.update(resRef, {
              status: 'completed',
            });

            // 3. Release Slot Lock
            if (resData.date && resData.seatId) {
              const slotDocRef = adminDb
                .collection('seats')
                .doc(resData.seatId)
                .collection('slots')
                .doc(resData.date);

              const slotDoc = await transaction.get(slotDocRef);
              if (slotDoc.exists) {
                const existingSlots: BookedSlot[] = slotDoc.data()?.bookedSlots || [];
                const updatedSlots = existingSlots.filter((s) => s.reservationId !== session.reservationId);
                transaction.update(slotDocRef, {
                  bookedSlots: updatedSlots,
                  lastUpdated: serverNow,
                });
              }
            }
          }
        }

        // 4. Update User Aggregate Stats
        const userRef = adminDb.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists) {
          const uData = userDoc.data()!;
          const currentTotalStudy = uData.totalStudySeconds || 0;
          const currentSessions = uData.completedSessionsCount || 0;

          transaction.update(userRef, {
            totalStudySeconds: currentTotalStudy + studyDurationSeconds,
            completedSessionsCount: currentSessions + 1,
          });
        }

        // 5. Create Notification
        const notificationRef = adminDb.collection('notifications').doc();
        transaction.set(notificationRef, {
          userId,
          title: 'Study Session Completed',
          message: `You focused for ${Math.floor(studyDurationSeconds / 60)} minutes and completed ${session.pomodoroCyclesCompleted} Pomodoro cycles.`,
          type: 'system',
          read: false,
          createdAt: serverNow,
        });

        return {
          ...session,
          status: 'ended',
          endTime: serverNow,
          studyDurationSeconds,
          breakDurationSeconds: totalBreakSec,
          totalElapsedSeconds,
        };
      }

      return session;
    });

    return NextResponse.json({
      success: true,
      data: updatedSession,
    });
  } catch (err: unknown) {
    console.error('Session Action API Error:', err);
    const message = err instanceof Error ? err.message : 'Session action failed';
    return NextResponse.json({ error: 'ACTION_FAILED', message }, { status: 500 });
  }
}
