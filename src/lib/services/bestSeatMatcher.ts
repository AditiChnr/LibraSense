import { Seat, SeatZone, SeatFeature, DerivedSeatState } from '@/types';

export interface SeatMatchCriteria {
  preferredZone?: SeatZone | '';
  requiredFeatures?: SeatFeature[];
  preferHardwareMonitored?: boolean;
}

export interface MatchedSeatResult {
  seat: Seat;
  derivedState: DerivedSeatState;
  matchScore: number; // 0 to 100
  matchReasons: string[];
  isReservable: boolean;
}

/**
 * Rule-based Smart Seat Matcher algorithm.
 * Evaluates and ranks seats based on user preferences and current availability.
 * Non-AI, deterministic, and fully explainable scoring.
 */
export function findBestSeats(
  seats: Seat[],
  seatStates: Record<string, DerivedSeatState>,
  criteria: SeatMatchCriteria
): MatchedSeatResult[] {
  const { preferredZone, requiredFeatures = [], preferHardwareMonitored } = criteria;

  const results: MatchedSeatResult[] = seats.map((seat) => {
    const derivedState = seatStates[seat.id] || (seat.isMaintenance ? 'MAINTENANCE' : 'AVAILABLE');
    const isReservable = derivedState === 'AVAILABLE';

    let score = 0;
    const matchReasons: string[] = [];

    // Base availability check (only available seats can achieve > 50 score)
    if (isReservable) {
      score += 40;
      matchReasons.push('Currently Available');
    } else {
      matchReasons.push(`Status: ${derivedState.replace('_', ' ')}`);
    }

    // Zone Matching (Weight: 35 points)
    if (preferredZone && seat.zone === preferredZone) {
      score += 35;
      matchReasons.push(`Matches preferred ${preferredZone}`);
    } else if (preferredZone) {
      matchReasons.push(`In ${seat.zone} (Preferred: ${preferredZone})`);
    }

    // Feature Matching (Weight: 20 points split evenly across requested features)
    if (requiredFeatures.length > 0) {
      let matchedFeatureCount = 0;
      requiredFeatures.forEach((feat) => {
        if (seat.features.includes(feat)) {
          matchedFeatureCount++;
        }
      });

      const featureWeightPerItem = 20 / requiredFeatures.length;
      const featureScore = matchedFeatureCount * featureWeightPerItem;
      score += featureScore;

      if (matchedFeatureCount === requiredFeatures.length) {
        matchReasons.push(`Includes all ${matchedFeatureCount} requested features`);
      } else if (matchedFeatureCount > 0) {
        matchReasons.push(`Includes ${matchedFeatureCount}/${requiredFeatures.length} requested features`);
      }
    } else {
      score += 15; // Bonus if user didn't specify features
    }

    // Hardware Monitoring Fit (Weight: 5 points)
    if (preferHardwareMonitored && seat.isHardwareMonitored) {
      score += 5;
      matchReasons.push('Real-time camera monitored');
    }

    const finalScore = Math.min(100, Math.round(score));

    return {
      seat,
      derivedState,
      matchScore: finalScore,
      matchReasons,
      isReservable,
    };
  });

  // Sort descending by matchScore, prioritizing reservable seats
  return results.sort((a, b) => {
    if (a.isReservable !== b.isReservable) {
      return a.isReservable ? -1 : 1;
    }
    return b.matchScore - a.matchScore;
  });
}
