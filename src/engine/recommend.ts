import { RiskSignal } from './types';

export function recommend(signal: RiskSignal): string {
  switch (signal.type) {
    case 'GHOST_RESERVATION':
      return signal.score > 0.7
        ? `Critical: nearly every booking on ${signal.resourceName} goes unused. Consider requiring confirmation 24h before use or auto-releasing the slot.`
        : `Add a "confirm attendance" step for ${signal.resourceName} bookings to cut no-shows.`;
    case 'HOARDING':
      return `${signal.resourceName} is booked far longer than it's used. Consider capping booking duration or auto-releasing unused time after a grace window.`;
    case 'SINGLE_POINT_OF_FAILURE':
      return `${signal.resourceName} carries most of its pool's load. Add a backup resource or redistribute bookings — if this fails, there's no fallback.`;
    default:
      return 'Review this resource manually.';
  }
}