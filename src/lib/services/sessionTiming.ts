import { SessionBreakRecord, SessionStatus } from '@/types';

export type SessionActionType = 'START_BREAK' | 'END_BREAK' | 'PAUSE' | 'RESUME' | 'CYCLE_COMPLETE' | 'END_SESSION';

/**
 * Validates whether a requested session lifecycle action is valid given the current status.
 */
export function isValidSessionTransition(currentStatus: SessionStatus, action: SessionActionType): boolean {
  if (currentStatus === 'ended') {
    return false; // Ended sessions cannot accept further mutations
  }

  switch (action) {
    case 'START_BREAK':
      return currentStatus === 'active';
    case 'END_BREAK':
      return currentStatus === 'break';
    case 'PAUSE':
      return currentStatus === 'active';
    case 'RESUME':
      return currentStatus === 'paused';
    case 'CYCLE_COMPLETE':
      return currentStatus === 'active';
    case 'END_SESSION':
      return currentStatus === 'active' || currentStatus === 'break' || currentStatus === 'paused';
    default:
      return false;
  }
}

/**
 * Computes the total verified break duration in seconds across all break records.
 */
export function calculateTotalBreakSeconds(
  breaks: SessionBreakRecord[] = [],
  nowIso: string = new Date().toISOString()
): number {
  const nowMs = new Date(nowIso).getTime();
  let totalBreakSeconds = 0;

  for (const b of breaks) {
    if (b.endTime) {
      totalBreakSeconds += b.durationSeconds || Math.max(0, Math.floor((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 1000));
    } else {
      // Currently active open break
      const startMs = new Date(b.startTime).getTime();
      const openDuration = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      totalBreakSeconds += openDuration;
    }
  }

  return totalBreakSeconds;
}

/**
 * Computes the server-authoritative study duration strictly from server timestamps:
 * studyDuration = (serverEndTime - serverStartTime) - sum(serverVerifiedBreakDurations)
 */
export function calculateAuthoritativeStudyDuration(
  startTimeIso: string,
  endTimeIso: string,
  totalBreakSeconds: number
): { totalElapsedSeconds: number; studyDurationSeconds: number } {
  const startMs = new Date(startTimeIso).getTime();
  const endMs = new Date(endTimeIso).getTime();

  const totalElapsedSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const studyDurationSeconds = Math.max(0, totalElapsedSeconds - totalBreakSeconds);

  return {
    totalElapsedSeconds,
    studyDurationSeconds,
  };
}
