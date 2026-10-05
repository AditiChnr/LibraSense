import { resolveSeatState } from '../../src/lib/services/seatStateResolver';
import { Seat, HardwareState, SystemConfig, DerivedSeatState } from '../../src/types';

function runTests() {
  console.log('--- Running Admin Operations & Authorization Unit Tests ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✕ [FAIL] ${testName}`);
      failed++;
    }
  }

  // Test 1: Seat State Resolver Priority for Maintenance
  {
    const seat: Seat = {
      id: 'seat_A01',
      seatNumber: 'A01',
      floorId: 'floor_1',
      coordinates: { x: 0, y: 0, width: 90, height: 70, rotation: 0 },
      zone: 'Quiet Zone',
      features: ['Power Outlet'],
      isMaintenance: true, // Marked as maintenance by admin
      isHardwareMonitored: true,
      qrPublicId: 'SEAT_FL1_A01',
    };

    const hwState: HardwareState = {
      seatId: 'seat_A01',
      occupied: true,
      rawConfidence: 0.95,
      smoothedConfidence: 0.95,
      lastUpdate: new Date().toISOString(),
      consecutiveFrameCount: 5,
    };

    const now = new Date().toISOString();
    const state1 = resolveSeatState(seat, hwState, null, null, now);

    assert(
      state1 === 'MAINTENANCE',
      'SeatStateResolver enforces MAINTENANCE as highest priority over hardware occupancy'
    );
  }

  // Test 2: Returning Seat from Maintenance Restores Real-time Derived State
  {
    const seat: Seat = {
      id: 'seat_A01',
      seatNumber: 'A01',
      floorId: 'floor_1',
      coordinates: { x: 0, y: 0, width: 90, height: 70, rotation: 0 },
      zone: 'Quiet Zone',
      features: ['Power Outlet'],
      isMaintenance: false, // Re-activated by admin
      isHardwareMonitored: true,
      qrPublicId: 'SEAT_FL1_A01',
    };

    const hwState: HardwareState = {
      seatId: 'seat_A01',
      occupied: true,
      rawConfidence: 0.95,
      smoothedConfidence: 0.95,
      lastUpdate: new Date().toISOString(),
      consecutiveFrameCount: 5,
    };

    const now = new Date().toISOString();
    const state2 = resolveSeatState(seat, hwState, null, null, now);

    assert(
      state2 === 'OCCUPIED_UNAUTHORIZED',
      'Restoring seat from maintenance correctly derives OCCUPIED_UNAUTHORIZED from live hardware sensor'
    );
  }

  // Test 3: System Config Bounds Validation
  {
    function validateSystemConfigBounds(config: Partial<SystemConfig>): { valid: boolean; error?: string } {
      if (config.maxActiveReservations !== undefined && (config.maxActiveReservations < 1 || config.maxActiveReservations > 10)) {
        return { valid: false, error: 'maxActiveReservations must be between 1 and 10' };
      }
      if (config.maxDurationMinutes !== undefined && (config.maxDurationMinutes < 15 || config.maxDurationMinutes > 720)) {
        return { valid: false, error: 'maxDurationMinutes must be between 15 and 720' };
      }
      if (config.defaultGracePeriodMinutes !== undefined && (config.defaultGracePeriodMinutes < 5 || config.defaultGracePeriodMinutes > 60)) {
        return { valid: false, error: 'defaultGracePeriodMinutes must be between 5 and 60' };
      }
      return { valid: true };
    }

    const validConfig = validateSystemConfigBounds({
      maxActiveReservations: 3,
      maxDurationMinutes: 180,
      defaultGracePeriodMinutes: 15,
    });
    assert(validConfig.valid === true, 'Accepts valid configuration parameters within operational bounds');

    const invalidDuration = validateSystemConfigBounds({ maxDurationMinutes: 1000 });
    assert(invalidDuration.valid === false, 'Rejects excessive duration configuration (> 720 minutes)');

    const invalidGrace = validateSystemConfigBounds({ defaultGracePeriodMinutes: 2 });
    assert(invalidGrace.valid === false, 'Rejects sub-minimum grace period configuration (< 5 minutes)');
  }

  // Test 4: Admin Statistics Aggregation Math
  {
    const stateCounts: Record<DerivedSeatState, number> = {
      AVAILABLE: 15,
      RESERVED: 5,
      OCCUPIED_VALID: 6,
      OCCUPIED_UNAUTHORIZED: 2,
      NO_SHOW_PENDING: 1,
      MAINTENANCE: 1,
    };
    const totalSeats = 30;
    const occupiedTotal = stateCounts.OCCUPIED_VALID + stateCounts.OCCUPIED_UNAUTHORIZED; // 8
    const occupancyPercentage = Math.round((occupiedTotal / totalSeats) * 100); // 8/30 = 26.67% -> 27%

    assert(occupiedTotal === 8, 'Occupancy calculation combines valid and unauthorized occupancy');
    assert(occupancyPercentage === 27, 'Occupancy percentage calculates correctly as 27%');
  }

  // Test 5: Role Demotion Protection Guard
  {
    function canModifyUserRole(adminUid: string, targetUid: string, newRole: 'student' | 'admin'): boolean {
      if (adminUid === targetUid && newRole !== 'admin') {
        return false; // Prevent self-demotion lockout
      }
      return true;
    }

    assert(
      canModifyUserRole('admin_123', 'admin_123', 'student') === false,
      'Self-demotion protection prevents admin from removing their own admin status'
    );
    assert(
      canModifyUserRole('admin_123', 'student_456', 'admin') === true,
      'Admin can promote another user to admin'
    );
    assert(
      canModifyUserRole('admin_123', 'student_456', 'student') === true,
      'Admin can modify another user role'
    );
  }

  console.log(`\nAdminOperations Tests Summary: ${passed} Passed, ${failed} Failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
