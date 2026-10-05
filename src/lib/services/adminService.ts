import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit as fsLimit,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import {
  Seat,
  HardwareState,
  Reservation,
  StudySession,
  Device,
  AuditLog,
  UserProfile,
  SystemConfig,
} from '@/types';

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) return { 'Content-Type': 'application/json' };
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// 1. Real-time Firestore Subscriptions
export function subscribeToAllSeats(callback: (seats: Seat[]) => void): Unsubscribe {
  const q = collection(db, 'seats');
  return onSnapshot(
    q,
    (snap) => {
      const seats = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Seat));
      callback(seats);
    },
    (err) => console.warn('Seats subscription error:', err)
  );
}

export function subscribeToAllHardwareStates(callback: (states: Record<string, HardwareState>) => void): Unsubscribe {
  const q = collection(db, 'hardwareStates');
  return onSnapshot(
    q,
    (snap) => {
      const states: Record<string, HardwareState> = {};
      snap.docs.forEach((doc) => {
        states[doc.id] = doc.data() as HardwareState;
      });
      callback(states);
    },
    (err) => console.warn('Hardware states subscription error:', err)
  );
}

export function subscribeToAllReservations(callback: (reservations: Reservation[]) => void): Unsubscribe {
  const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'), fsLimit(50));
  return onSnapshot(
    q,
    (snap) => {
      const reservations = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Reservation));
      callback(reservations);
    },
    (err) => console.warn('Reservations subscription error:', err)
  );
}

export function subscribeToAllSessions(callback: (sessions: StudySession[]) => void): Unsubscribe {
  const q = collection(db, 'sessions');
  return onSnapshot(
    q,
    (snap) => {
      const sessions = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as StudySession));
      callback(sessions);
    },
    (err) => console.warn('Sessions subscription error:', err)
  );
}

export function subscribeToAllDevices(callback: (devices: Device[]) => void): Unsubscribe {
  const q = collection(db, 'devices');
  return onSnapshot(
    q,
    (snap) => {
      const devices = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Device));
      callback(devices);
    },
    (err) => console.warn('Devices subscription error:', err)
  );
}

export function subscribeToAuditLogs(callback: (logs: AuditLog[]) => void): Unsubscribe {
  const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), fsLimit(50));
  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AuditLog));
      callback(logs);
    },
    (err) => console.warn('Audit logs subscription error:', err)
  );
}

// 2. Admin API Action Callers
export async function toggleSeatMaintenance(
  seatId: string,
  isMaintenance: boolean,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/v1/admin/seats/maintenance', {
    method: 'POST',
    headers,
    body: JSON.stringify({ seatId, isMaintenance, reason }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update seat maintenance mode.');
  }
  return data;
}

export async function fetchAdminUsers(): Promise<UserProfile[]> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/v1/admin/users', { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to fetch users.');
  }
  return data.users || [];
}

export async function updateUserRole(targetUid: string, newRole: 'student' | 'admin'): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/v1/admin/users', {
    method: 'POST',
    headers,
    body: JSON.stringify({ targetUid, newRole }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update user role.');
  }
}

export async function adminCancelReservation(
  reservationId: string,
  action: 'cancel' | 'mark_noshow',
  reason?: string
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/v1/admin/reservations', {
    method: 'POST',
    headers,
    body: JSON.stringify({ reservationId, action, reason }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update reservation.');
  }
}

export async function fetchSystemConfig(): Promise<SystemConfig> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/v1/admin/config', { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to fetch configuration.');
  }
  return data.config;
}

export async function updateSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/v1/admin/config', {
    method: 'POST',
    headers,
    body: JSON.stringify(config),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to save configuration.');
  }
  return data.config;
}

// 3. Simulation Control Helpers
export interface SimulationTickPayload {
  seatId: string;
  occupied: boolean;
  confidence?: number;
  tickId?: string;
  scenario?: string;
  autoSmooth?: boolean;
}

export interface SimulationTickResponse {
  success: boolean;
  idempotent: boolean;
  tickId: string;
  seatId: string;
  occupied?: boolean;
  confidence?: number;
  message: string;
}

export async function triggerSimulationTick(
  payload: SimulationTickPayload
): Promise<SimulationTickResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/v1/admin/simulation/tick', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Simulation tick execution failed.');
  }
  return data;
}

export async function resetSimulationState(): Promise<{ success: boolean; resetCount: number; message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/v1/admin/simulation/reset', {
    method: 'POST',
    headers,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to reset simulation states.');
  }
  return data;
}

export async function fetchSimulationStatus(): Promise<{
  success: boolean;
  totalProcessedTicks: number;
  simulatedSeatsCount: number;
  occupiedSimulatedCount: number;
  ticks: Array<{
    tickId: string;
    seatId: string;
    occupied: boolean;
    confidence: number;
    scenario: string;
    timestamp: string;
  }>;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/v1/admin/simulation/status', { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to fetch simulation status.');
  }
  return data;
}

