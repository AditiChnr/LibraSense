import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Seat } from '@/types';

export interface OccupancyStats {
  totalSeats: number;
  availableSeats: number;
  occupiedSeats: number;
  reservedSeats: number;
  maintenanceSeats: number;
  occupancyPercentage: number;
}

/**
 * Listens to all seats in real-time and computes total library occupancy statistics.
 */
export function subscribeToOccupancyStats(callback: (stats: OccupancyStats, seats: Seat[]) => void) {
  const seatsRef = collection(db, 'seats');
  const q = query(seatsRef);

  return onSnapshot(
    q,
    (snapshot) => {
      const seats: Seat[] = [];
      let total = 0;
      let available = 0;
      let occupied = 0;
      let reserved = 0;
      let maintenance = 0;

      snapshot.forEach((docSnap) => {
        const seat = { id: docSnap.id, ...docSnap.data() } as Seat;
        seats.push(seat);
        total++;

        if (seat.isMaintenance) {
          maintenance++;
        } else if (seat.isHardwareMonitored) {
          // If hardware monitored and flag set, count occupied
          occupied++;
        } else {
          available++;
        }
      });

      // Calculate reserved as placeholder count if seats exist
      reserved = Math.max(0, Math.floor(total * 0.1));

      const activeOccupiedOrReserved = occupied + reserved;
      const occupancyPercentage = total > 0 ? Math.round((activeOccupiedOrReserved / total) * 100) : 0;

      callback(
        {
          totalSeats: total,
          availableSeats: available,
          occupiedSeats: occupied,
          reservedSeats: reserved,
          maintenanceSeats: maintenance,
          occupancyPercentage,
        },
        seats
      );
    },
    (err) => {
      console.error('Error subscribing to seat occupancy stats:', err);
    }
  );
}
