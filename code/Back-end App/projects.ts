// src/routes/projects.ts
import { Router } from 'express';
import { db } from '../utils/firebase.js';
import { requireAuth, requireProjectRole, isSuperAdmin } from '../middleware/authz.js';
import { writeAudit } from '../utils/audit.js';
import { generateInitialReportingPeriods } from '../services/reportingPeriods.js';
import { updateProjectStats } from '../services/projectStats.js';

export const projects = Router();

/** Allowed long-lived project statuses */
const VALID_STATUS = ["DRAFT", "ONBOARDING", "ACTIVE", "SUSPENDED", "OFFBOARDING", "ARCHIVED"] as const;
type ProjectStatus = typeof VALID_STATUS[number];

/** Normalize status input → ProjectStatus (UPPERCASE), default DRAFT */
function coerceStatus(s: any): ProjectStatus {
  const v = String(s ?? '').trim().toUpperCase();
  return (VALID_STATUS as readonly string[]).includes(v) ? (v as ProjectStatus) : "DRAFT";
}

/** EF mode at project/policy level */
type EfMode = 'STATIC' | 'DYNAMIC';

/** Normalise ef_mode values; default to STATIC if unknown */
function coerceEfMode(v: any): EfMode {
  const s = String(v ?? '').toUpperCase();
  return s === 'DYNAMIC' ? 'DYNAMIC' : 'STATIC';
}

/** Accept a nested policy object and normalize it or return null */
function safePolicy(input: any) {
  if (!input || typeof input !== 'object') return null;
  const { track, calc_version, tz, ef_mode, ef_profile } = input as any;
  if (!track || !calc_version) return null;

  const policy: any = {
    track: String(track),
    calc_version: String(calc_version),
    tz: tz ? String(tz) : null,
  };

  // Optional EF configuration at project level
  policy.ef_mode = coerceEfMode(ef_mode);

  // ef_profile is optional; allow null if not set
  if (ef_profile !== undefined && ef_profile !== null && ef_profile !== '') {
    policy.ef_profile = String(ef_profile);
  } else {
    policy.ef_profile = null;
  }

  return policy;
}

/* -------------------- helpers for list/search responses -------------------- */
function tsToIso(v: any) {
  try {
    if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
  } catch {}
  return typeof v === 'string' ? v : null;
}

function normalizeProject(doc: FirebaseFirestore.DocumentSnapshot) {
  const d = (doc.data() || {}) as any;
  return {
    id: doc.id,
    organization_id: d.organization_id || '',
    name: d.name || '',
    country: d.country || '',
    status: d.status || 'DRAFT', // ✅ consistent with VALID_STATUS
    policy: d.policy || undefined,
    created_by_uid: d.created_by_uid || '',
    created_at: tsToIso(d.created_at),
    updated_at: tsToIso(d.updated_at),
  };
}

/**
 * Lightweight view of aggregated stats for a project.
 * These docs live in the "project_stats" collection with doc id == project_id.
 */
interface ProjectStatsDoc {
  cp_count?: number;
  evc_count?: number;
  battery_count?: number;
  total_cc_tonnes?: number;
  last_period_end?: string;
  daily_cc_tonnes?: number;
  current_period_cc_tonnes?: number;
  next_closing_date?: string;
}

/**
 * Attach precomputed stats from "project_stats" side table
 * to the project rows returned by /projects & /projects/search.
 */
async function attachStatsToProjects(rows: any[]) {
  if (!rows.length) return rows;

  const statsMap: Record<string, ProjectStatsDoc> = {};

  await Promise.all(
    rows.map(async (row) => {
      const projectId = row.id;
      try {
        const snap = await db.collection('project_stats').doc(projectId).get();
        if (snap.exists) {
          statsMap[projectId] = (snap.data() || {}) as ProjectStatsDoc;
        }
      } catch (e) {
        console.error('[project_stats] failed for project', projectId, e);
      }
    })
  );

  return rows.map((row) => {
    const s = statsMap[row.id] || {};
    const existing = row as any;

    const existingCp = Number.isFinite(existing.cp_count) ? existing.cp_count : undefined;
    const existingEvc = Number.isFinite(existing.evc_count) ? existing.evc_count : undefined;
    const existingBattery = Number.isFinite(existing.battery_count) ? existing.battery_count : undefined;
    const existingTotal = Number.isFinite(existing.total_cc_tonnes) ? existing.total_cc_tonnes : undefined;
    const existingDaily = Number.isFinite(existing.daily_cc_tonnes) ? existing.daily_cc_tonnes : undefined;
    const existingCurrent = Number.isFinite(existing.current_period_cc_tonnes)
      ? existing.current_period_cc_tonnes
      : undefined;

    const existingLastEnd = typeof existing.last_period_end === 'string' ? existing.last_period_end : undefined;
    const existingNextClosing =
      typeof existing.next_closing_date === 'string' ? existing.next_closing_date : undefined;

    return {
      ...row,
      cp_count: s.cp_count ?? existingCp ?? 0,
      evc_count: s.evc_count ?? existingEvc ?? 0,
      battery_count: s.battery_count ?? existingBattery ?? 0,
      total_cc_tonnes: s.total_cc_tonnes ?? existingTotal ?? 0,
      last_period_end: s.last_period_end || existingLastEnd || null,
      daily_cc_tonnes: s.daily_cc_tonnes ?? existingDaily ?? 0,
      current_period_cc_tonnes: s.current_period_cc_tonnes ?? existingCurrent ?? 0,
      next_closing_date: s.next_closing_date || existingNextClosing || null,
    };
  });
}

/* ----------------------------- CREATE ------------------------------------- */
// Create a project (e-admin or e-AM)
projects.post('/projects', requireAuth, async (req, res) => {
  const uid = (req as any).uid;
  const superAdmin = await isSuperAdmin(uid);
  const body = req.body || {};

  if (!body.name || !body.organization_id || !body.country) {
    return res.status(400).json({ error: 'name, organization_id, country required' });
  }

  // e-AM can create; e-admin can also create (optionally add org-level checks here)
  if (!superAdmin) {
    // currently allowing any authenticated user to create
  }

  const doc: any = {
    organization_id: String(body.organization_id),
    name: String(body.name),
    country: String(body.country).toUpperCase(),
    created_by_uid: uid,
    status: coerceStatus(body.status),
    policy: safePolicy(body.policy),
    audit: { review_status: 'pending', approved: false },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Optional period configuration
  if (body.period_length) {
    doc.period_length = String(body.period_length).toUpperCase();
  }
  if (body.first_closing_date) {
    doc.first_closing_date = String(body.first_closing_date);
  }

  const ref = await db.collection('projects').add(doc);

  // Generate initial reporting periods and initialise stats
  await generateInitialReportingPeriods(ref.id, 8);
  await updateProjectStats(ref.id);

  // Creator becomes e-AM member
  await db.collection('projects').doc(ref.id).collection('members').doc(uid).set({
    roles: ['e-AM'],
    disabled: false,
    created_by_uid: uid,
    created_at: new Date().toISOString(),
  });

  await writeAudit(uid, 'project.create', { collection: 'projects', id: ref.id }, null, doc);
  return res.json({ id: ref.id, ...doc });
});

/* ----------------------------- READ (single) ------------------------------- */
// Get a project (any member or e-admin)
projects.get('/projects/:projectId', requireAuth, requireProjectRole('ANY_MEMBER'), async (req, res) => {
  const projectId = (req as any).projectId;
  const snap = await db.collection('projects').doc(projectId).get();
  if (!snap.exists) return res.status(404).json({ error: 'not_found' });

  const base = { id: snap.id, ...(snap.data() || {}) };

  let stats: ProjectStatsDoc | null = null;
  try {
    const statsSnap = await db.collection('project_stats').doc(projectId).get();
    if (statsSnap.exists) stats = (statsSnap.data() || {}) as ProjectStatsDoc;
  } catch (e) {
    console.error('[GET /projects/:projectId] failed to load project_stats', projectId, e);
  }

  if (!stats) return res.json(base);

  return res.json({
    ...base,
    cp_count: stats.cp_count ?? 0,
    evc_count: stats.evc_count ?? 0,
    battery_count: stats.battery_count ?? 0,
    total_cc_tonnes: stats.total_cc_tonnes ?? 0,
    last_period_end: stats.last_period_end || null,
    daily_cc_tonnes: stats.daily_cc_tonnes ?? 0,
    current_period_cc_tonnes: stats.current_period_cc_tonnes ?? 0,
    next_closing_date: stats.next_closing_date || null,
  });
});

/* ----------------------------- READ (list) --------------------------------- */
projects.get('/projects', requireAuth, async (req, res) => {
  try {
    const uid = (req as any).uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'unauthorized' });

    const org = (req.query.org as string | undefined)?.trim();
    const country = (req.query.country as string | undefined)?.trim()?.toUpperCase();
    const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)));

    let q: FirebaseFirestore.Query = db.collection('projects').where('created_by_uid', '==', uid);
    if (org) q = q.where('organization_id', '==', org);
    if (country) q = q.where('country', '==', country);
    q = q.limit(limit);

    const snap = await q.get();
    let rows = snap.docs.map(normalizeProject);
    rows.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

    rows = await attachStatsToProjects(rows);
    return res.json(rows.slice(0, limit));
  } catch (e: any) {
    console.error('[GET /projects] failed', e);
    return res.status(500).json({ error: 'list-failed', detail: String(e?.message || e) });
  }
});

/* ----------------------------- READ (search) ------------------------------- */
projects.get('/projects/search', requireAuth, async (req, res) => {
  try {
    const uid = (req as any).uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'unauthorized' });

    const org = (req.query.org as string | undefined)?.trim();
    const country = (req.query.country as string | undefined)?.trim()?.toUpperCase();
    const qText = (req.query.q as string | undefined)?.trim() || '';
    const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 100)));

    let q: FirebaseFirestore.Query = db.collection('projects').where('created_by_uid', '==', uid);
    if (org) q = q.where('organization_id', '==', org);
    if (country) q = q.where('country', '==', country);
    q = q.limit(limit);

    const snap = await q.get();
    let rows = snap.docs.map(normalizeProject);
    rows.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

    if (qText) {
      const s = qText.toLowerCase();
      rows = rows.filter(
        (r) => (r.name || '').toLowerCase().includes(s) || (r.id || '').toLowerCase().includes(s)
      );
    }

    rows = await attachStatsToProjects(rows);
    return res.json(rows.slice(0, limit));
  } catch (e: any) {
    console.error('[GET /projects/search] failed', e);
    return res.status(500).json({ error: 'search-failed', detail: String(e?.message || e) });
  }
});

/* ----------------------------- UPDATE ------------------------------------- */
projects.patch(
  '/projects/:projectId',
  requireAuth,
  requireProjectRole(['e-AM', 'CPO-AM']),
  async (req, res) => {
    const projectId = (req as any).projectId;
    const uid = (req as any).uid;

    const ref = db.collection('projects').doc(projectId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'not_found' });

    const data = snap.data() as any;
    const superAdmin = await isSuperAdmin(uid);

    const isCreator = data.created_by_uid === uid;
    const allowedByRole = superAdmin || isCreator || (req as any).member?.roles?.includes('CPO-AM');
    if (!allowedByRole) return res.status(403).json({ error: 'forbidden' });

    const allowedOpsFields = ['status', 'grid_region', 'timezone', 'policy'];

    const patch = req.body || {};
    const update: Record<string, any> = {};

    if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
      if (superAdmin || isCreator || allowedOpsFields.includes('status')) {
        update.status = coerceStatus(patch.status);
      }
    }

    for (const [k, v] of Object.entries(patch)) {
      if (k === 'status' || k === 'policy') continue;
      if (superAdmin || isCreator || allowedOpsFields.includes(k)) {
        update[k] = v;
      }
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'policy')) {
      if (superAdmin || isCreator || allowedOpsFields.includes('policy')) {
        const pol = safePolicy(patch.policy);
        if (pol === null) {
          update['policy'] = null;
        } else {
          update['policy.track'] = pol.track;
          update['policy.calc_version'] = pol.calc_version;
          update['policy.tz'] = pol.tz;

          // EF config
          if (pol.ef_mode) update['policy.ef_mode'] = pol.ef_mode;
          if ('ef_profile' in pol) update['policy.ef_profile'] = pol.ef_profile;
        }
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'no_allowed_fields' });
    }

    const before = data;
    update.updated_at = new Date().toISOString();
    await ref.update(update);

    await writeAudit(uid, 'project.update', { collection: 'projects', id: projectId }, before, update);
    return res.json({ id: projectId, ...before, ...update });
  }
);

/* ---------------------- UTIL: RECOMPUTE STATS ------------------------------ */
projects.post(
  '/projects/:projectId/recompute-stats',
  requireAuth,
  requireProjectRole(['e-AM', 'CPO-AM']),
  async (req, res) => {
    const projectId = (req as any).projectId;
    const uid = (req as any).uid;

    try {
      const ref = db.collection('projects').doc(projectId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'not_found' });

      await updateProjectStats(projectId);

      const statsSnap = await db.collection('project_stats').doc(projectId).get();
      const stats = statsSnap.exists ? statsSnap.data() : null;

      await writeAudit(uid, 'project.recompute_stats', { collection: 'projects', id: projectId }, null, { stats });

      return res.json({ ok: true, project_id: projectId, stats });
    } catch (e: any) {
      console.error('[POST /projects/:projectId/recompute-stats] failed', e);
      return res.status(500).json({ error: 'recompute_failed', detail: String(e?.message || e) });
    }
  }
);

/* -------------------- READ: per-site CC breakdown -------------------- */
projects.get(
  '/projects/:projectId/cc/sites',
  requireAuth,
  requireProjectRole('ANY_MEMBER'),
  async (req, res) => {
    try {
      const projectId = (req as any).projectId;

      const periodsSnap = await db
        .collection('reporting_period_summaries')
        .where('project_id', '==', projectId)
        .get();

      const periods = periodsSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((p) => p.status === 'OPEN');

      if (!periods.length) {
        return res.json({
          project_id: projectId,
          period: null,
          site_totals: [],
          message: 'no_open_period',
        });
      }

      const period = periods[0];
      const periodId = period.id;

      const runsSnap = await db.collection('calc_runs').where('project_id', '==', projectId).get();

      type SiteRow = {
        site_id: string;
        period_total_tonnes_co2e: number;
        last_run_at: string | null;
        calc_run_id: string | null;
      };

      const bySite: Record<string, SiteRow> = {};

      runsSnap.forEach((doc) => {
        const data = doc.data() as any;

        if (!data) return;
        if (data.period_id !== periodId) return;
        if (data.scope !== 'EU_RED_IE') return;

        const siteId = data.site_id || 'UNKNOWN_SITE';

        const total =
          typeof data.period_total_tonnes_co2e === 'number'
            ? data.period_total_tonnes_co2e
            : typeof data.result?.period_total_tonnes_co2e === 'number'
            ? data.result.period_total_tonnes_co2e
            : 0;

        const createdAt =
          typeof data.created_at === 'string'
            ? data.created_at
            : data.created_at?.toDate?.()?.toISOString?.() ?? null;

        const existing = bySite[siteId];

        if (!existing) {
          bySite[siteId] = {
            site_id: siteId,
            period_total_tonnes_co2e: total,
            last_run_at: createdAt,
            calc_run_id: doc.id,
          };
        } else {
          const prevTs = existing.last_run_at ? Date.parse(existing.last_run_at) : 0;
          const curTs = createdAt ? Date.parse(createdAt) : 0;
          if (curTs >= prevTs) {
            bySite[siteId] = {
              site_id: siteId,
              period_total_tonnes_co2e: total,
              last_run_at: createdAt,
              calc_run_id: doc.id,
            };
          }
        }
      });

      const site_totals = Object.values(bySite).sort((a, b) => a.site_id.localeCompare(b.site_id));

      return res.json({
        project_id: projectId,
        period: {
          id: periodId,
          status: period.status,
          period_type: period.period_type,
          period_start: period.period_start,
          period_end: period.period_end,
          next_closing_date: period.next_closing_date ?? null,
        },
        site_totals,
      });
    } catch (e: any) {
      console.error('[GET /projects/:projectId/cc/sites] failed', e);
      return res.status(500).json({
        error: 'sites_breakdown_failed',
        detail: String(e?.message || e),
      });
    }
  }
);

/* ----------------------------- DELETE ------------------------------------- */
projects.delete(
  '/projects/:projectId',
  requireAuth,
  requireProjectRole(['e-AM']),
  async (req, res) => {
    const projectId = (req as any).projectId;
    const uid = (req as any).uid;
    const superAdmin = await isSuperAdmin(uid);

    const ref = db.collection('projects').doc(projectId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'not_found' });

    const data = snap.data() as any;
    if (!superAdmin && data.created_by_uid !== uid) {
      return res.status(403).json({ error: 'forbidden' });
    }

    await ref.delete();
    await writeAudit(uid, 'project.delete', { collection: 'projects', id: projectId }, data, null);
    return res.json({ ok: true });
  }
);
