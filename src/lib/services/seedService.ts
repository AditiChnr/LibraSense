import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Seat, SeatZone, SeatFeature, Floor, SystemConfig, Device } from '@/types';

export async function seedDatabase() {
  console.log('Starting LibraSense database seed...');

  const studentEmail = process.env.DEMO_STUDENT_EMAIL || 'student@librasense.edu';
  const studentPassword = process.env.DEMO_STUDENT_PASSWORD;
  const studentId = process.env.DEMO_STUDENT_ID || '23CSE001';

  const adminEmail = process.env.DEMO_ADMIN_EMAIL || 'admin@librasense.edu';
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD;

  if (!studentPassword || !adminPassword) {
    throw new Error('DEMO_STUDENT_PASSWORD and DEMO_ADMIN_PASSWORD environment variables must be defined in .env.local before seeding.');
  }

  // 1. System Config
  const systemConfig: SystemConfig = {
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

  await adminDb.collection('systemSettings').doc('config').set(systemConfig);

  // 2. Library
  await adminDb.collection('libraries').doc('lib_central').set({
    name: 'Central Campus Library',
    code: 'CENTRAL_LIB',
    totalSeats: 30,
    openingHours: '08:00 - 22:00',
  });

  // 3. Floors with layoutData
  const floor1: Floor = {
    id: 'floor_1',
    libraryId: 'lib_central',
    floorNumber: 1,
    name: 'Floor 1 - Main Reading & Study Hall',
    layoutData: {
      viewBox: '0 0 1000 600',
      boundaryPolygon: '40,40 960,40 960,560 40,560',
      walkwayPaths: ['M 40 300 L 960 300', 'M 500 40 L 500 560'],
      zoneLabels: [
        { name: 'Quiet Zone', x: 250, y: 70 },
        { name: 'Collaborative Area', x: 750, y: 70 },
        { name: 'Window Workstations', x: 250, y: 540 },
        { name: 'Group Study', x: 750, y: 540 },
      ],
    },
  };

  const floor2: Floor = {
    id: 'floor_2',
    libraryId: 'lib_central',
    floorNumber: 2,
    name: 'Floor 2 - Silent & Tech Floor',
    layoutData: {
      viewBox: '0 0 1000 600',
      boundaryPolygon: '40,40 960,40 960,560 40,560',
      walkwayPaths: ['M 40 300 L 960 300'],
      zoneLabels: [
        { name: 'Silent Individual Pods', x: 300, y: 70 },
        { name: 'Dual Monitor Workstations', x: 700, y: 70 },
      ],
    },
  };

  await adminDb.collection('floors').doc('floor_1').set(floor1);
  await adminDb.collection('floors').doc('floor_2').set(floor2);

  // 4. Generate 30 Seats (15 on Floor 1, 15 on Floor 2)
  const batch = adminDb.batch();

  // Floor 1 Seats (A01 - A15)
  const zonesF1: SeatZone[] = ['Quiet Zone', 'Collaborative', 'Window', 'Group Study'];
  const featuresList: SeatFeature[][] = [
    ['Power Outlet', 'Ergonomic Chair'],
    ['Power Outlet', 'Monitor'],
    ['Power Outlet', 'Standing Desk'],
    ['Ergonomic Chair'],
  ];

  for (let i = 1; i <= 15; i++) {
    const seatNum = `A${i.toString().padStart(2, '0')}`;
    const seatId = `seat_${seatNum}`;
    
    // Spatial grid coordinates for SVG rendering
    const col = (i - 1) % 5;
    const row = Math.floor((i - 1) / 5);
    const x = 100 + col * 160;
    const y = 100 + row * 140;

    const seat: Seat = {
      id: seatId,
      seatNumber: seatNum,
      floorId: 'floor_1',
      coordinates: { x, y, width: 90, height: 70, rotation: 0 },
      zone: zonesF1[i % zonesF1.length]!,
      features: featuresList[i % featuresList.length]!,
      isMaintenance: false,
      isHardwareMonitored: i === 1, // Desk A01 monitored by hardware
      qrPublicId: `SEAT_FL1_${seatNum}`,
    };

    batch.set(adminDb.collection('seats').doc(seatId), seat);
  }

  // Floor 2 Seats (B01 - B15)
  for (let i = 1; i <= 15; i++) {
    const seatNum = `B${i.toString().padStart(2, '0')}`;
    const seatId = `seat_${seatNum}`;
    
    const col = (i - 1) % 5;
    const row = Math.floor((i - 1) / 5);
    const x = 100 + col * 160;
    const y = 100 + row * 140;

    const seat: Seat = {
      id: seatId,
      seatNumber: seatNum,
      floorId: 'floor_2',
      coordinates: { x, y, width: 90, height: 70, rotation: 0 },
      zone: i <= 8 ? 'Quiet Zone' : 'Collaborative',
      features: ['Power Outlet', 'Monitor', 'Ergonomic Chair'],
      isMaintenance: false,
      isHardwareMonitored: false,
      qrPublicId: `SEAT_FL2_${seatNum}`,
    };

    batch.set(adminDb.collection('seats').doc(seatId), seat);
  }

  // 5. Seed IoT Device
  const device: Device = {
    id: 'dev_rpi_01',
    assignedSeatId: 'seat_A01',
    name: 'Raspberry Pi 4 - Desk A01 Camera',
    status: 'ONLINE',
    ipAddress: '192.168.1.105',
    detectionConfidence: 0.94,
    lastHeartbeat: new Date().toISOString(),
  };
  batch.set(adminDb.collection('devices').doc('dev_rpi_01'), device);

  await batch.commit();

  // 6. Seed Demo Accounts
  // Student Account
  let studentUid = '';
  try {
    const existingStudent = await adminAuth.getUserByEmail(studentEmail);
    studentUid = existingStudent.uid;
    await adminAuth.updateUser(studentUid, { password: studentPassword });
  } catch {
    const newStudent = await adminAuth.createUser({
      email: studentEmail,
      password: studentPassword,
      displayName: 'Alex Rivers (Student)',
    });
    studentUid = newStudent.uid;
  }

  await adminAuth.setCustomUserClaims(studentUid, { role: 'student' });
  await adminDb.collection('users').doc(studentUid).set({
    uid: studentUid,
    email: studentEmail,
    displayName: 'Alex Rivers (Student)',
    role: 'student',
    studentId: studentId,
    createdAt: new Date().toISOString(),
  });
  await adminDb.collection('studentIds').doc(studentId).set({
    uid: studentUid,
    createdAt: new Date().toISOString(),
  });

  // Admin Account
  let adminUid = '';
  try {
    const existingAdmin = await adminAuth.getUserByEmail(adminEmail);
    adminUid = existingAdmin.uid;
    await adminAuth.updateUser(adminUid, { password: adminPassword });
  } catch {
    const newAdmin = await adminAuth.createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: 'Dr. Sarah Vance (Librarian)',
    });
    adminUid = newAdmin.uid;
  }

  await adminAuth.setCustomUserClaims(adminUid, { role: 'admin' });
  await adminDb.collection('users').doc(adminUid).set({
    uid: adminUid,
    email: adminEmail,
    displayName: 'Dr. Sarah Vance (Librarian)',
    role: 'admin',
    studentId: 'ADMIN001',
    createdAt: new Date().toISOString(),
  });

  console.log('LibraSense database seed completed successfully!');
  return {
    studentEmail,
    studentId,
    adminEmail,
    totalSeatsCreated: 30,
  };
}
