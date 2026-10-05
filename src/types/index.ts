export type UserRole = 'student' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  studentId: string;
  avatarUrl?: string;
  totalStudySeconds?: number;
  completedSessionsCount?: number;
  createdAt: string; // ISO string or Timestamp
}

export type SeatZone = 'Quiet Zone' | 'Collaborative' | 'Window' | 'Group Study';

export type SeatFeature = 'Power Outlet' | 'Monitor' | 'Ergonomic Chair' | 'Standing Desk';

export interface SeatCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees 0-360
}

export interface Seat {
  id: string;
  seatNumber: string;
  floorId: string;
  coordinates: SeatCoordinates;
  zone: SeatZone;
  features: SeatFeature[];
  isMaintenance: boolean;
  isHardwareMonitored: boolean;
  qrPublicId: string;
}

export type DerivedSeatState =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'OCCUPIED_VALID'
  | 'OCCUPIED_UNAUTHORIZED'
  | 'NO_SHOW_PENDING'
  | 'MAINTENANCE';

export interface Floor {
  id: string;
  libraryId: string;
  floorNumber: number;
  name: string;
  layoutData: {
    viewBox: string; // e.g. "0 0 1000 600"
    boundaryPolygon: string; // SVG points
    walkwayPaths: string[]; // SVG path d attributes
    zoneLabels: { name: string; x: number; y: number }[];
  };
}

export type ReservationStatus =
  | 'active'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Reservation {
  id: string;
  userId: string;
  seatId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // ISO string
  endTime: string; // ISO string
  gracePeriodMinutes: number;
  status: ReservationStatus;
  createdAt: string;
  checkedInAt?: string | null;
  cancelledAt?: string | null;
}

export interface BookedSlot {
  slotIndex: number; // 0..95 for 15-minute increments in a 24h day
  lengthSlots: number;
  reservationId: string;
  startTimeIso: string;
  endTimeIso: string;
}

export interface SeatDaySlots {
  seatId: string;
  date: string; // YYYY-MM-DD
  bookedSlots: BookedSlot[];
  lastUpdated: string;
}

export type SessionStatus = 'active' | 'break' | 'paused' | 'ended';

export interface SessionBreakRecord {
  startTime: string; // ISO string
  endTime: string | null; // ISO string or null if currently active
  durationSeconds: number;
}

export interface StudySession {
  id: string;
  userId: string;
  reservationId: string;
  seatId: string;
  startTime: string; // Authoritative ISO string
  endTime?: string | null; // Authoritative ISO string
  status: SessionStatus;
  studyDurationSeconds: number;
  breakDurationSeconds: number;
  pomodoroCyclesCompleted: number;
  breaks?: SessionBreakRecord[];
}

export type NotificationType =
  | 'reservation_confirmed'
  | 'reminder'
  | 'no_show_warning'
  | 'cancellation'
  | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  action: string;
  targetId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  timestamp: string;
}

export type DeviceStatus = 'ONLINE' | 'WARNING' | 'OFFLINE';

export interface Device {
  id: string;
  assignedSeatId: string;
  name: string;
  status: DeviceStatus;
  ipAddress: string;
  detectionConfidence: number;
  lastHeartbeat: string;
}

export interface HardwareState {
  seatId: string;
  occupied: boolean;
  rawConfidence: number;
  smoothedConfidence: number;
  lastUpdate: string;
  consecutiveFrameCount: number;
}

export interface SystemConfig {
  maxActiveReservations: number;
  maxFutureReservations: number;
  maxDurationMinutes: number;
  minBookingLeadMinutes: number;
  maxBookingLeadDays: number;
  defaultGracePeriodMinutes: number;
  minCancellationNoticeMinutes: number;
  hardwareModeEnabled: boolean;
  simulationActive: boolean;
}

export interface SimulationState {
  activeScenario: 'PEAK_AFTERNOON' | 'QUIET_MORNING' | 'EXAM_WEEK';
  tickIntervalSeconds: number;
  lastTickTime: string;
  seedVersion: string;
}

export interface ChallengeTokenResponse {
  challengeToken: string;
  expiresAt: string;
  seatId: string;
  reservationId: string;
}
