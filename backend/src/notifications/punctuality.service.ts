/**
 * Punctuality & Philippine Standard Time Formatting Service.
 *
 * Rules:
 * - If no cutoff time is configured: returns null (never invent an arbitrary "On Time" or "Late").
 * - If cutoff time is configured (e.g. "07:15"): parses and evaluates strictly against Asia/Manila (UTC+8).
 * - Formats timestamps to standard Philippine representations (e.g., "November 9, 2026", "7:15 AM").
 */

export function evaluatePunctuality(
  scanTime: Date,
  cutoffTimeStr?: string | null
): 'On Time' | 'Late' | null {
  if (!cutoffTimeStr || !cutoffTimeStr.trim()) {
    return null; // Authoritative rule: without approved cutoff, do NOT invent determination
  }

  const parts = cutoffTimeStr.trim().split(':');
  if (parts.length < 2) return null;

  const cutoffHour = parseInt(parts[0], 10);
  const cutoffMinute = parseInt(parts[1], 10);
  if (isNaN(cutoffHour) || isNaN(cutoffMinute)) return null;

  // Convert scanTime to Philippine Standard Time (UTC+8)
  const phtParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(scanTime);

  let scanHour = 0;
  let scanMinute = 0;
  for (const p of phtParts) {
    if (p.type === 'hour') scanHour = parseInt(p.value, 10);
    if (p.type === 'minute') scanMinute = parseInt(p.value, 10);
  }

  const scanMinutesTotal = scanHour * 60 + scanMinute;
  const cutoffMinutesTotal = cutoffHour * 60 + cutoffMinute;

  return scanMinutesTotal <= cutoffMinutesTotal ? 'On Time' : 'Late';
}

export function formatPhilippineDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatPhilippineTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

