// src/services/projectStats.ts
import { db } from "../utils/firebase.js";

/**
 * Status values for reporting periods.
 *
 * Flow:
 *   OPEN → READY_FOR_REVIEW → VERIFIED → CERTIFIED
 */
type PeriodStatus = "OPEN" | "READY_FOR_REVIEW" | "VERIFIED" | "CERTIFIED";

type PeriodType = "YEAR" | "QUARTER" | "MONTH";

interface ReportingPeriodSummary {
  project_id: string;
  site_id?: string;
  period_type: PeriodType;
  period_start: string; // ISO or 'YYYY-MM-DD'
  period_end: string;   // ISO or 'YYYY-MM-DD'
  status: PeriodStatus;
  total_tonnes_co2e?: number;
  next_closing_date?: string;
}

interface ProjectDailyCC {
  project_id: string;
  period_id?: string;
  site_id?: string;
  date: string;        // 'YYYY-MM-DD'
  tonnes_co2e: number;
}

/**
 * Project-level config we may use later for generating period patterns.
 * - period_length: MONTHLY / QUARTERLY / ANNUAL
 * - first_closing_date: first period closing date
 */
interface ProjectDoc {
  reporting_day_offset?: number; // legacy, may not be used now
  period_length?: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  first_closing_date?: string;
}

/**
 * Helper to parse a date string into a Date, being lenient with ISO vs 'YYYY-MM-DD'.
 */
function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Helper to format a Date as 'YYYY-MM-DD' (UTC).
 */
function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Inclusive number of days between two dates (e.g. 2025-01-01 to 2025-01-01 = 1).
 */
function inclusiveDaysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startUtc = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  );
  const endUtc = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate()
  );
  const diffDays = Math.floor((endUtc - startUtc) / msPerDay);
  return diffDays + 1;
}

/**
 * Computes and writes aggregated stats for a project into
 * project_stats/{projectId}.
 *
 * Call this whenever:
 *  - assets (sites/devices) change,
 *  - a reporting period is updated (status / totals),
 *  - daily CC is updated from new usage files.
 */
export async function updateProjectStats(projectId: string): Promise<void> {
  // 1) Count assets:
  //    - CP (Charging Points) = number of sites with this project_id
  //    - EVCs = devices where kind == 'EVC'
  //    - Batteries = devices where kind == 'BATTERY'
  const [sitesSnap, evcSnap, batterySnap] = await Promise.all([
    db.collection("sites").where("project_id", "==", projectId).get(),
    db
      .collection("devices")
      .where("project_id", "==", projectId)
      .where("kind", "==", "evc")
      .get(),
    db
      .collection("devices")
      .where("project_id", "==", projectId)
      .where("kind", "==", "battery")
      .get(),
  ]);

  const cp_count = sitesSnap.size; // CPs = Sites
  const evc_count = evcSnap.size; // EVCs = devices(kind='EVC')
  const battery_count = batterySnap.size; // Batteries = devices(kind='BATTERY')

  // 2) Reporting periods & daily CC
  const periodsSnap = await db
    .collection("reporting_period_summaries")
    .where("project_id", "==", projectId)
    .get();

  const periods: (ReportingPeriodSummary & { id?: string })[] = [];
  periodsSnap.forEach((doc) => {
    const data = doc.data() as any;
    periods.push({
      id: doc.id,
      project_id: data.project_id,
      site_id: data.site_id,
      period_type: data.period_type,
      period_start: data.period_start,
      period_end: data.period_end,
      status: data.status,
      total_tonnes_co2e: data.total_tonnes_co2e,
      next_closing_date: data.next_closing_date,
    });
  });

  // 2.1) CERTIFIED periods → Total CC + Daily CC
  const certifiedStatuses: PeriodStatus[] = ["CERTIFIED"];
  const certifiedPeriods = periods.filter((p) =>
    certifiedStatuses.includes(p.status)
  );

  let total_cc_tonnes = 0;
  let last_period_end: string | null = null;
  let daily_cc_tonnes = 0;

  if (certifiedPeriods.length > 0) {
    // Total across ALL certified periods
    total_cc_tonnes = certifiedPeriods.reduce(
      (sum, p) => sum + (p.total_tonnes_co2e || 0),
      0
    );

    // Last certified period by period_end
    certifiedPeriods.sort((a, b) => {
      const aEnd = a.period_end || "";
      const bEnd = b.period_end || "";
      return aEnd.localeCompare(bEnd);
    });
    const last = certifiedPeriods[certifiedPeriods.length - 1];

    const startDate = parseDate(last.period_start);
    const endDate = parseDate(last.period_end);

    if (startDate && endDate) {
      const days = inclusiveDaysBetween(startDate, endDate);
      const lastTotal = last.total_tonnes_co2e || 0;
      daily_cc_tonnes = days > 0 ? lastTotal / days : 0;
      last_period_end = endDate.toISOString();
    }
  }

  // 2.2) OPEN period → CC (period) + next closing date
  //
  // Business rule:
  // - Only the OPEN period is considered “current” for CC (period) column.
  // - Once it moves to READY_FOR_REVIEW / VERIFIED / CERTIFIED,
  //   CC is tracked on the Audit page, not here.
  const currentPeriods = periods.filter((p) => p.status === "OPEN");

  let current_period_cc_tonnes = 0;
  let next_closing_date: string | null = null;

  if (currentPeriods.length > 0) {
    // Pick earliest OPEN period by start date
    currentPeriods.sort((a, b) =>
      (a.period_start || "").localeCompare(b.period_start || "")
    );
    const current = currentPeriods[0];

    const startDate = parseDate(current.period_start);
    const endDate = parseDate(current.period_end);

    if (startDate && endDate) {
      const today = new Date();
      const todayStr = formatDateOnly(today);
      const startStr = formatDateOnly(startDate);
      const endStr = formatDateOnly(endDate);

      const maxDate = todayStr <= endStr ? todayStr : endStr;

      // Query daily CC docs for this project; filter by date in memory
      // to avoid needing a composite index on (project_id, date).
      const dailySnap = await db
        .collection("project_daily_cc")
        .where("project_id", "==", projectId)
        .get();

      let sumCurrent = 0;
      dailySnap.forEach((doc) => {
        const d = doc.data() as any as ProjectDailyCC;
        const dDate = d.date;
        if (
          typeof dDate === "string" &&
          dDate >= startStr &&
          dDate <= maxDate
        ) {
          sumCurrent += d.tonnes_co2e || 0;
        }
      });
      current_period_cc_tonnes = sumCurrent;

      // Next CLOSING date:
      //  - Prefer explicit next_closing_date on the period (if set),
      //  - Otherwise, use period_end.
      if (current.next_closing_date) {
        next_closing_date = current.next_closing_date;
      } else {
        const endForClosing = parseDate(current.period_end);
        if (endForClosing) {
          next_closing_date = endForClosing.toISOString();
        }
      }
    }
  }

  // 2.3) Derive first_period_start_date from earliest usage_uploads date
  //
  // We look at the earliest usage_uploads.created_at for this project
  // and keep only the date component as 'YYYY-MM-DD'.
  let first_period_start_date: string | null = null;
  try {
    const uploadsSnap = await db
      .collection("usage_uploads")
      .where("project_id", "==", projectId)
      .orderBy("created_at", "asc")
      .limit(1)
      .get();

    if (!uploadsSnap.empty) {
      const u = uploadsSnap.docs[0].data() as any;
      const created = u.created_at
        ? u.created_at.toDate
          ? u.created_at.toDate()
          : new Date(u.created_at)
        : null;
      if (created && !Number.isNaN(created.getTime())) {
        first_period_start_date = formatDateOnly(created);
      }
    }
  } catch (err) {
    console.error(
      "[updateProjectStats] failed to derive first_period_start_date for project",
      projectId,
      err
    );
  }

  // 3) Write all aggregated stats into project_stats/{projectId}
  const updated_at = new Date().toISOString();

  const statsDoc = {
    cp_count,
    evc_count,
    battery_count,
    total_cc_tonnes,
    last_period_end,
    daily_cc_tonnes,
    current_period_cc_tonnes,
    next_closing_date,
    first_period_start_date,
    updated_at,
  };

  // 3a) Write aggregated stats into project_stats/{projectId}
  await db
    .collection("project_stats")
    .doc(projectId)
    .set(statsDoc, { merge: true });

  // 3b) Mirror the key fields onto projects/{projectId}
  await db.collection("projects").doc(projectId).set(
    {
      cp_count,
      evc_count,
      battery_count,
      total_cc_tonnes,
      daily_cc_tonnes,
      current_period_cc_tonnes,
      next_closing_date,
      first_period_start_date,
      stats_updated_at: updated_at,
    },
    { merge: true }
  );
}
