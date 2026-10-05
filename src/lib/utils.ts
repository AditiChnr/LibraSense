import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export function getSlotIndexFromTimeString(timeStr: string): number {
  // timeStr e.g. "10:30"
  const [h, m] = timeStr.split(':').map(Number);
  return h * 4 + Math.floor(m / 15);
}

export function getTimeStringFromSlotIndex(slotIndex: number): string {
  const h = Math.floor(slotIndex / 4);
  const m = (slotIndex % 4) * 15;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
