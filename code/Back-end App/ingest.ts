import { Router, type Request, type Response } from "express";
import { mockPullSessions } from "../connectors/sessionsMock.js";
import { mockIngestGridMix } from "../connectors/gridMixMock.js";

export const ingest = Router();

ingest.post("/mock/sessions/pull", async (req: Request, res: Response) => {
  try {
    const { project_id, site_id, from, to, per_hour } = req.body ?? {};
    if (!project_id || !site_id || !from || !to) {
      return res.status(400).json({ error: "project_id, site_id, from, to required" });
    }

    const perHourDefault =
      Number(process.env.MOCK_SESSIONS_PER_HOUR ?? "") ||
      Number(process.env.MOCK_DRIIVZ_SESSIONS_PER_HOUR ?? "") ||
      8;

    const perHourNum = Number(per_hour ?? perHourDefault);

    const out = await mockPullSessions(project_id, site_id, from, to, perHourNum);
    return res.json(out);
  } catch (err: any) {
    console.error("[ingest] sessions/pull error:", err);
    return res.status(500).json({ error: "internal_error", details: String(err?.message ?? err) });
  }
});

ingest.post("/mock/grid/pull", async (req: Request, res: Response) => {
  try {
    const { site_id, begins_at, ends_at, step_minutes } = req.body ?? {};
    if (!site_id || !begins_at || !ends_at) {
      return res.status(400).json({ error: "site_id, begins_at, ends_at required" });
    }
    const step = Number(step_minutes ?? 60);
    const out = await mockIngestGridMix(site_id, begins_at, ends_at, step);
    return res.json(out);
  } catch (err: any) {
    console.error("[ingest] grid/pull error:", err);
    return res.status(500).json({ error: "internal_error", details: String(err?.message ?? err) });
  }
});
