import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Reservation } from '@/types';

/**
 * Listens to active/upcoming reservations for a specific student.
 */
export function subscribeToUserActiveReservation(
  userId: string,
  callback: (reservation: Reservation | null) => void
) {
  if (!userId) return () => {};

  const reservationsRef = collection(db, 'reservations');
  const q = query(
    reservationsRef,
    where('userId', '==', userId),
    where('status', 'in', ['active', 'checked_in']),
    orderBy('startTime', 'asc'),
    limit(1)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0]!;
        callback({ id: docSnap.id, ...docSnap.data() } as Reservation);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.error('Error subscribing to active reservation:', err);
      callback(null);
    }
  );
}
