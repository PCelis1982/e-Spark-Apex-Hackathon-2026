// src/routes/verification.ts
import { Router } from "express";
const r = Router();

r.post("/verification/:projectId/batches", async (req, res) => {
  // TODO: create VerificationBatch doc
  return res.json({ ok: true, batchId: "vb_xxx" });
});

r.post("/verification/:batchId/nora:export", async (req, res) => {
  // TODO: aggregate rows, call buildNoraCsv(), return CSV (and/or store CID)
  return res.header("Content-Type","text/csv").send("Meter Point Reference Number,...");
});

r.post("/verification/:batchId/sign", async (req, res) => {
  // TODO: attach verifierDID + report CID to batch
  return res.json({ ok: true });
});

export default r;
