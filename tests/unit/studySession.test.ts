import {
  isValidSessionTransition,
  calculateTotalBreakSeconds,
  calculateAuthoritativeStudyDuration,
} from '../../src/lib/services/sessionTiming';
import { SessionBreakRecord } from '../../src/types';

export function runStudySessionTests() {
  let passed = 0;
  let failed = 0;

  function assert(description: string, condition: boolean) {
    if (condition) {
      console.log(`✓ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`✕ [FAIL] ${description}`);
      failed++;
    }
  }

  // Test 1: State Transitions
  assert('isValidSessionTransition: active -> START_BREAK is valid', isValidSessionTransition('active', 'START_BREAK') === true);
  assert('isValidSessionTransition: break -> END_BREAK is valid', isValidSessionTransition('break', 'END_BREAK') === true);
  assert('isValidSessionTransition: active -> END_BREAK is invalid', isValidSessionTransition('active', 'END_BREAK') === false);
  assert('isValidSessionTransition: break -> START_BREAK is invalid', isValidSessionTransition('break', 'START_BREAK') === false);
  assert('isValidSessionTransition: ended -> any action is rejected', isValidSessionTransition('ended', 'START_BREAK') === false);
  assert('isValidSessionTransition: active -> END_SESSION is valid', isValidSessionTransition('active', 'END_SESSION') === true);
  assert('isValidSessionTransition: break -> END_SESSION is valid', isValidSessionTransition('break', 'END_SESSION') === true);

  // Test 2: Break Accounting Calculation
  const mockBreaks: SessionBreakRecord[] = [
    {
      startTime: '2026-10-05T10:25:00.000Z',
      endTime: '2026-10-05T10:30:00.000Z', // 5 mins = 300 seconds
      durationSeconds: 300,
    },
    {
      startTime: '2026-10-05T10:55:00.000Z',
      endTime: '2026-10-05T11:05:00.000Z', // 10 mins = 600 seconds
      durationSeconds: 600,
    },
  ];

  const totalBreaks = calculateTotalBreakSeconds(mockBreaks, '2026-10-05T11:30:00.000Z');
  assert('calculateTotalBreakSeconds sums all closed breaks correctly (900s)', totalBreaks === 900);

  // Test 3: Active Ongoing Break Accounting
  const openBreaks: SessionBreakRecord[] = [
    ...mockBreaks,
    {
      startTime: '2026-10-05T11:25:00.000Z',
      endTime: null, // open break, 5 mins elapsed at 11:30
      durationSeconds: 0,
    },
  ];
  const totalWithOpen = calculateTotalBreakSeconds(openBreaks, '2026-10-05T11:30:00.000Z');
  assert('calculateTotalBreakSeconds accurately includes ongoing open break (1200s)', totalWithOpen === 1200);

  // Test 4: Authoritative Study Duration Calculation
  // 10:00:00 to 12:00:00 = 2 hours = 7200 seconds total elapsed
  // Break time = 900 seconds (15 mins)
  // Expected study duration = 7200 - 900 = 6300 seconds (1h 45m)
  const startTimeIso = '2026-10-05T10:00:00.000Z';
  const endTimeIso = '2026-10-05T12:00:00.000Z';
  const duration = calculateAuthoritativeStudyDuration(startTimeIso, endTimeIso, 900);

  assert('calculateAuthoritativeStudyDuration calculates total elapsed as 7200s', duration.totalElapsedSeconds === 7200);
  assert('calculateAuthoritativeStudyDuration subtracts breaks giving 6300s study time', duration.studyDurationSeconds === 6300);

  console.log(`\nStudySession Tests Summary: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runStudySessionTests();
}
