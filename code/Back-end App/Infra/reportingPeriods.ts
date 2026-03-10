// src/services/reportingPeriods.ts
import { db } from '../utils/firebase.js';

type PeriodStatus = 'OPEN' | 'READY_FOR_REVIEW' | 'VERIFIED' | 'CERTIFIED';

type PeriodType = 'YEAR' | 'QUARTER' | 'MONTH';

interface ProjectDoc {
  period_length?: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  first_closing_date?: string;   // ISO string
}

/**
 * Helper: parse ISO or 'YYYY-MM-DD' into Date.
 */
function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Helper: last day of given year & month (0-based month).
 */
function lastDayOfMonth(year: number, month0: number): Date {
  // month+1, day 0 gives last day of given month
  return new Date(Date.UTC(year, month0 + 1, 0, 23, 59, 59, 999));
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function toIso(d: Date): string {
  return d.toISOString();
}

/**
 * Convert project.period_length to internal PeriodType.
 */
function periodTypeFromLength(period_length?: string): PeriodType {
  switch ((period_length || '').toUpperCase()) {
    case 'MONTHLY':
      return 'MONTH';
    case 'ANNUAL':
      return 'YEAR';
    case 'QUARTERLY':
    default:
      return 'QUARTER';
  }
}

/**
 * Given a first closing date and a period type, find the calendar-aligned
 * period that contains that closing date.
 *
 * Examples:
 * - type MONTH  + 2026-03-15 -> 2026-03-01 .. 2026-03-31
 * - type QUARTER+ 2026-03-31 -> 2026-01-01 .. 2026-03-31
 * - type YEAR   + 2026-06-10 -> 2026-01-01 .. 2026-12-31
 */
function getFirstPeriodWindow(firstClosing: Date, type: PeriodType): { start: Date; end: Date; code: string } {
  const y = firstClosing.getUTCFullYear();
  const m = firstClosing.getUTCMonth(); // 0–11

  if (type === 'MONTH') {
    const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    const end = lastDayOfMonth(y, m);
    const code = `${y}-${String(m + 1).padStart(2, '0')}`;
    return { start, end, code };
  }

  if (type === 'QUARTER') {
    const quarterIndex = Math.floor(m / 3);        // 0..3
    const qStartMonth = quarterIndex * 3;          // 0,3,6,9
    const qEndMonth = qStartMonth + 2;
    const start = new Date(Date.UTC(y, qStartMonth, 1, 0, 0, 0, 0));
    const end = lastDayOfMonth(y, qEndMonth);
    const code = `${y}Q${quarterIndex + 1}`;
    return { start, end, code };
  }

  // YEAR
  const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
  const code = `${y}`;
  return { start, end, code };
}

/**
 * Get the next period window after a given one (calendar aligned).
 */
function nextPeriodWindow(prev: { start: Date; end: Date; code: string }, type: PeriodType): { start: Date; end: Date; code: string } {
  const prevStart = prev.start;
  const y = prevStart.getUTCFullYear();
  const m = prevStart.getUTCMonth();

  if (type === 'MONTH') {
    const nextMonth = m + 1;
    const year2 = y + Math.floor(nextMonth / 12);
    const month2 = nextMonth % 12;
    const start = new Date(Date.UTC(year2, month2, 1, 0, 0, 0, 0));
    const end = lastDayOfMonth(year2, month2);
    const code = `${year2}-${String(month2 + 1).padStart(2, '0')}`;
    return { start, end, code };
  }

  if (type === 'QUARTER') {
    const quarterIndex = Math.floor(m / 3); // 0..3
    const nextQuarterIndex = quarterIndex + 1;
    const year2 = y + Math.floor(nextQuarterIndex / 4);
    const qStartMonth = (nextQuarterIndex % 4) * 3;
    const qEndMonth = qStartMonth + 2;
    const start = new Date(Date.UTC(year2, qStartMonth, 1, 0, 0, 0, 0));
    const end = lastDayOfMonth(year2, qEndMonth);
    const code = `${year2}Q${(nextQuarterIndex % 4) + 1}`;
    return { start, end, code };
  }

  // YEAR
  const year2 = y + 1;
  const start = new Date(Date.UTC(year2, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year2, 11, 31, 23, 59, 59, 999));
  const code = `${year2}`;
  return { start, end, code };
}

/**
 * Initialise reporting periods for a project based on:
 *   - period_length: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
 *   - first_closing_date: first period closing date
 *
 * It will generate N future periods (default 8) and store them in
 * the "reporting_period_summaries" collection.
 */
export async function generateInitialReportingPeriods(projectId: string, numPeriods = 8): Promise<void> {
  const projectSnap = await db.collection('projects').doc(projectId).get();
  if (!projectSnap.exists) {
    throw new Error(`Project ${projectId} not found`);
  }

  const project = projectSnap.data() as ProjectDoc;

  const type = periodTypeFromLength(project.period_length);
  let firstClosing: Date | null = parseDate(project.first_closing_date);

  // Fallback: if first_closing_date is not set, use "today" to determine the current period
  if (!firstClosing) {
    firstClosing = new Date();
  }

  // Find first period window that contains firstClosing
  let window = getFirstPeriodWindow(firstClosing, type);

  const batch = db.batch();
  const now = new Date();

  for (let i = 0; i < numPeriods; i++) {
    const start = startOfDayUTC(window.start);
    const end = endOfDayUTC(window.end);

    const status: PeriodStatus =
      now < start ? 'OPEN' : // in the future – still open, no data yet
      now > end ? 'OPEN' :   // past periods will be updated to CLOSED/VERIFIED by MRV
      'OPEN';                // current period is also OPEN

    const docRef = db.collection('reporting_period_summaries').doc();

    batch.set(docRef, {
      project_id: projectId,
      site_id: null,
      period_type: type,
      period_start: toIso(start),
      period_end: toIso(end),
      period_code: window.code,
      status,
      total_energy_kwh: 0,
      total_tonnes_co2e: 0,
      usage_file_ids: [],
      calc_result_ids: [],
      next_closing_date: toIso(end), // for now closing date == period_end
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    // Move to next period window
    window = nextPeriodWindow(window, type);
  }

  await batch.commit();
}
