// src/routes/audit.ts
import { Router, Request, Response } from 'express';
import { db } from '../utils/firebase.js';
import { requireAuth, requireProjectRole, isSuperAdmin } from '../middleware/authz.js';
import { writeAudit } from '../utils/audit.js';

export const audit = Router();

/* ----------------------------- helpers ----------------------------- */
function ts(v: any) {
  try {
    // Firestore Timestamp -> ISO
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return v?.toDate?.()
      ? v.toDate().toISOString()
      : (v instanceof Date ? v.toISOString() : (typeof v === 'string' ? v : null));
  } catch { return null; }
}

function isVerified(x: any): boolean {
  if (!x) return false;
  if (typeof x.verified === 'boolean') return x.verified;
  if (typeof x.status === 'string') return x.status.toLowerCase() === 'verified';
  return false;
}

/** role check: allow superadmin or auditor/e-admin */
async function isAuditor(uid: string): Promise<boolean> {
  if (await isSuperAdmin(uid)) return true;
  const snap = await db.collection('roles').doc(uid).get().catch(() => null);
  const data = (snap?.data() || {}) as any;

  // roles can be stored as array or a map of booleans; support both
  const arr = Array.isArray(data.roles)
    ? (data.roles as string[])
    : Object.keys(data).filter(k => data[k] === true);

  const roles = new Set(arr.map(r => String(r).toLowerCase()));
  return roles.has('auditor') || roles.has('e-admin');
}

async function requireAuditor(uid: string): Promise<boolean> {
  return (await isSuperAdmin(uid)) || (await isAuditor(uid));
}

/* ===================== EXISTING PROJECT AUDIT API ===================== */
/** CCM: mark reviewed (cannot approve) */
audit.post('/projects/:projectId/audit/review', requireAuth, requireProjectRole(['CCM']), async (req, res) => {
  const uid = (req as any).uid as string;
  const projectId = (req.params as any).projectId as string;
  const { notes } = (req.body || {}) as { notes?: string };

  const ref = db.collection('projects').doc(projectId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'not_found' });

  const before = snap.data();
  const patch = {
    'audit.review_status': 'reviewed',
    'audit.reviewed_by_uid': uid,
    'audit.review_notes': notes ?? null,
    updated_at: new Date().toISOString(),
  };
  await ref.update(patch);
  await writeAudit(uid, 'project.audit.review', { collection: 'projects', id: projectId }, before, patch);
  return res.json({ ok: true });
});

/** e-admin/superadmin: final approval */
audit.post('/projects/:projectId/audit/approve', requireAuth, async (req, res) => {
  const uid = (req as any).uid as string;
  const superAdmin = await isSuperAdmin(uid);
  if (!superAdmin) return res.status(403).json({ error: 'forbidden' });

  const projectId = (req.params as any).projectId as string;
  const ref = db.collection('projects').doc(projectId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'not_found' });

  const before = snap.data();
  const patch = {
    'audit.approved': true,
    'audit.approved_by_uid': uid,
    'audit.approved_at': new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await ref.update(patch);
  await writeAudit(uid, 'project.audit.approve', { collection: 'projects', id: projectId }, before, patch);
  return res.json({ ok: true });
});

/* =================== NEW: AUDIT QUEUE & VERIFICATION =================== */
/**
 * GET /api/audit/projects
 * List projects visible to auditor/superadmin with counts used by the Audit page
 * - includes ACTIVE and ONBOARDING (excludes DRAFT)
 */
audit.get('/audit/projects', requireAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string;
  if (!(await requireAuditor(uid))) return res.status(403).json({ error: 'forbidden' });

  const snap = await db.collection('projects')
    .where('status', 'in', ['ACTIVE', 'ONBOARDING'])
    .limit(500)
    .get()
    .catch(() => null);

  const rows = await Promise.all((snap?.docs || []).map(async (doc) => {
    const p = doc.data() as any;
    const [devs, sites] = await Promise.all([
      db.collection('devices').where('project_id', '==', doc.id).limit(2000).get().catch(() => null),
      db.collection('sites').where('project_id', '==', doc.id).limit(2000).get().catch(() => null),
    ]);

    const dAll = (devs?.docs || []).length;
    const dUnv = (devs?.docs || []).reduce((n, d) => n + (isVerified(d.data()) ? 0 : 1), 0);

    const sAll = (sites?.docs || []).length;
    const sUnv = (sites?.docs || []).reduce((n, s) => n + (isVerified(s.data()) ? 0 : 1), 0);

    return {
      id: doc.id,
      name: p.name || '',
      organization_id: p.organization_id || '',
      country: p.country || '',
      status: p.status || 'DRAFT',
      policy: p.policy || null,
      counts: {
        devices_total: dAll,
        devices_unverified: dUnv,
        stations_total: sAll,
        stations_unverified: sUnv,
      },
      created_at: ts(p.created_at),
      updated_at: ts(p.updated_at),
      needs_verification: (dUnv + sUnv) > 0,
    };
  }));

  res.json(rows);
});

/**
 * GET /api/audit/projects/:pid/pending
 * Items in a project that are not verified (stations + devices)
 */
audit.get('/audit/projects/:pid/pending', requireAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string;
  if (!(await requireAuditor(uid))) return res.status(403).json({ error: 'forbidden' });

  const { pid } = req.params;

  const [devs, sites] = await Promise.all([
    db.collection('devices').where('project_id', '==', pid).limit(5000).get().catch(() => null),
    db.collection('sites').where('project_id', '==', pid).limit(5000).get().catch(() => null),
  ]);

  const devices = (devs?.docs || [])
    .map(d => {
      const x = d.data() as any;
      const name = x.serial || x.imei || x.model || d.id;
      return { id: d.id, type: 'device' as const, name, verified: !!x.verified };
    })
    .filter(d => !d.verified);

  const stations = (sites?.docs || [])
    .map(s => {
      const x = s.data() as any;
      const name = x.name || x.site_id || s.id;
      return { id: s.id, type: 'station' as const, name, verified: !!x.verified };
    })
    .filter(s => !s.verified);

  res.json({ devices, stations });
});

/**
 * POST /api/audit/projects/:pid/verify
 * Body: { item_id, coll: 'devices'|'sites', verified: boolean, comment?: string }
 */
audit.post('/audit/projects/:pid/verify', requireAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string;
  if (!(await requireAuditor(uid))) return res.status(403).json({ error: 'forbidden' });

  const { pid } = req.params;
  const { item_id, coll, verified, comment } = (req.body || {}) as {
    item_id?: string, coll?: 'devices' | 'sites', verified?: boolean, comment?: string
  };
  if (!item_id || (coll !== 'devices' && coll !== 'sites') || typeof verified !== 'boolean') {
    return res.status(400).json({ error: 'bad_request' });
  }

  const ref = db.collection(coll).doc(item_id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'not_found' });

  const before = snap.data() as any;

  // ✅ SECURITY GUARD: ensure the item belongs to this project
  if (String(before?.project_id || '') !== String(pid)) {
    return res.status(400).json({ error: 'item_not_in_project' });
  }

  const patch: any = {
    verified,
    status: verified ? 'verified' : 'unverified',
    verified_by_uid: uid,
    verified_at: new Date(),
  };
  if (comment != null) patch['audit_comment'] = String(comment).slice(0, 2000);

  await ref.update(patch);
  await writeAudit(uid, `audit.${coll}.verify`, { collection: coll, id: item_id, project_id: pid }, before, patch);

  return res.json({ ok: true });
});

/**
 * PATCH /api/audit/projects/:pid/status
 * Body: { status: 'ACTIVE'|'ONBOARDING' }
 * Only superadmin or auditor allowed (you can restrict further if you want).
 */
audit.patch('/audit/projects/:pid/status', requireAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string;
  if (!(await requireAuditor(uid))) return res.status(403).json({ error: 'forbidden' });

  const { pid } = req.params;
  const { status } = (req.body || {}) as { status?: 'ACTIVE'|'ONBOARDING' };
  if (status !== 'ACTIVE' && status !== 'ONBOARDING') return res.status(400).json({ error: 'bad_status' });

  const ref = db.collection('projects').doc(pid);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'not_found' });

  const before = snap.data() as any;
  const patch = { status, updated_at: new Date().toISOString() };

  await ref.update(patch);

  // ✅ CHANGED: write minimal before/after status audit entry
  await writeAudit(
    uid,
    'project.status_change',
    { collection: 'projects', id: pid },
    { status: before?.status },
    { status: patch.status }
  );

  res.json({ ok: true, status });
});
