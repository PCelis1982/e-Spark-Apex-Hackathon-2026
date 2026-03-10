// src/routes/usage.ts
import { Router, type Request, type Response } from "express";
import { db } from "../utils/firebase.js";
import { updateProjectStats } from "../services/projectStats.js";

export const usage = Router();

/**
 * Ingest usage batch (sessions) for a project.
 * Body: { source:'api'|'csv', from?:string, to?:string, entries:[{site_id,charger_id,started_at,ended_at,energy_kwh}] }
 */
usage.post("/projects/:projectId/usage-batches", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { source, from, to, entries } = req.body || {};

  if (!projectId || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "projectId and entries[] required" });
  }

  const batchDoc = {
    project_id: projectId,
    source: source || "api",
    from: from || null,
    to: to || null,
    count: entries.length,
    status: "Imported",
    created_at: new Date().toISOString(),
  };

  const batchRef = await db.collection("usage_batches").add(batchDoc);

  const b = db.batch();
  const sessions = db.collection("sessions");

  for (const s of entries) {
    b.set(sessions.doc(), {
      project_id: projectId,
      site_id: s.site_id,
      charger_id: s.charger_id,
      started_at: new Date(s.started_at).toISOString(),
      ended_at: new Date(s.ended_at).toISOString(),
      energy_kwh: Number(s.energy_kwh),
      batch_id: batchRef.id,
    });
  }

  await b.commit();

  try {
    await updateProjectStats(projectId);
  } catch (err) {
    console.error("[usage-batches] updateProjectStats failed for", projectId, err);
  }

  return res.json({ ok: true, batch_id: batchRef.id, inserted: entries.length });
});

/**
 * List latest sessions for a project (newest first)
 * GET /api/projects/:projectId/sessions?limit=50
 */
usage.get("/projects/:projectId/sessions", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(Number(req.query.limit || 50), 200);

    const snap = await db
      .collection("sessions")
      .where("project_id", "==", projectId)
      .orderBy("started_at", "desc")
      .limit(limit)
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return res.json({ ok: true, project_id: projectId, count: items.length, items });
  } catch (err: any) {
    console.error("[usage] list sessions error", err);
    return res.status(500).json({ error: "internal_error", detail: String(err?.message || err) });
  }
});
