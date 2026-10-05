import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { StudySession } from '@/types';

/**
 * Listens to active study session for a specific student.
 */
export function subscribeToActiveSession(
  userId: string,
  callback: (session: StudySession | null) => void
) {
  if (!userId) return () => {};

  const sessionsRef = collection(db, 'sessions');
  const q = query(
    sessionsRef,
    where('userId', '==', userId),
    where('status', 'in', ['active', 'paused']),
    limit(1)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0]!;
        callback({ id: docSnap.id, ...docSnap.data() } as StudySession);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.error('Error subscribing to active study session:', err);
      callback(null);
    }
  );
}
