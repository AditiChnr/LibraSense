import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdminRequest } from '@/lib/services/adminAuth';
import { resolveSeatState } from '@/lib/services/seatStateResolver';
import { evaluateDeviceHeartbeat } from '@/lib/services/iotSecurity';
import { Seat, Reservation, StudySession, HardwareState, Device, DerivedSeatState } from '@/types';

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: auth.error }, { status: auth.status });
  }

  try {
    // 1. Fetch Seats
    const seatsSnap = await adminDb.collection('seats').get();
    const seats: Seat[] = seatsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Seat));

    // 2. Fetch Active/Recent Reservations
    const todayStr = new Date().toISOString().split('T')[0];
    const reservationsSnap = await adminDb
      .collection('reservations')
      .where('date', '>=', todayStr)
      .get();
    const reservations: Reservation[] = reservationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Reservation));

    // 3. Fetch Active Sessions
    const sessionsSnap = await adminDb
      .collection('sessions')
      .where('status', 'in', ['active', 'break'])
      .get();
    const sessions: StudySession[] = sessionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as StudySession));

    // 4. Fetch Hardware States
    const hwSnap = await adminDb.collection('hardwareStates').get();
    const hwStates = new Map<string, HardwareState>();
    hwSnap.forEach((doc) => {
      hwStates.set(doc.id, doc.data() as HardwareState);
    });

    // 5. Fetch Devices
    const devicesSnap = await adminDb.collection('devices').get();
    const devices: Device[] = devicesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Device));

    // 6. Compute Derived Seat States using pure SeatStateResolver
    const nowIso = new Date().toISOString();
    const stateCounts: Record<DerivedSeatState, number> = {
      AVAILABLE: 0,
      RESERVED: 0,
      OCCUPIED_VALID: 0,
      OCCUPIED_UNAUTHORIZED: 0,
      NO_SHOW_PENDING: 0,
      MAINTENANCE: 0,
    };

    seats.forEach((seat) => {
      const activeRes = reservations.find(
        (r) => r.seatId === seat.id && (r.status === 'active' || r.status === 'checked_in')
      );
      const activeSession = sessions.find((s) => s.seatId === seat.id);
      const hw = hwStates.get(seat.id);

      const derivedState = resolveSeatState(seat, hw, activeRes, activeSession, nowIso);

      stateCounts[derivedState]++;
    });

    const totalSeats = seats.length;
    const occupiedCount = stateCounts.OCCUPIED_VALID + stateCounts.OCCUPIED_UNAUTHORIZED;
    const occupancyPercentage = totalSeats > 0 ? Math.round((occupiedCount / totalSeats) * 100) : 0;

    // 7. Device Health Breakdown
    let devicesOnline = 0;
    let devicesWarning = 0;
    let devicesOffline = 0;

    devices.forEach((dev) => {
      const status = evaluateDeviceHeartbeat(dev.lastHeartbeat);
      if (status === 'ONLINE') devicesOnline++;
      else if (status === 'WARNING') devicesWarning++;
      else devicesOffline++;
    });

    // 8. Reservation Breakdown
    const activeReservationsCount = reservations.filter((r) => r.status === 'active').length;
    const checkedInCount = reservations.filter((r) => r.status === 'checked_in').length;
    const noShowCount = reservations.filter((r) => r.status === 'no_show').length;
    const cancelledCount = reservations.filter((r) => r.status === 'cancelled').length;

    return NextResponse.json({
      success: true,
      stats: {
        totalSeats,
        occupancyPercentage,
        stateCounts,
        activeReservationsCount,
        checkedInCount,
        noShowCount,
        cancelledCount,
        activeSessionsCount: sessions.length,
        devicesHealth: {
          total: devices.length,
          online: devicesOnline,
          warning: devicesWarning,
          offline: devicesOffline,
        },
      },
    });
  } catch (err) {
    console.error('Admin Stats API Error:', err);
    return NextResponse.json({ error: 'SERVER_ERROR', message: 'Failed to compute admin statistics.' }, { status: 500 });
  }
}
