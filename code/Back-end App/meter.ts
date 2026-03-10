// src/routes/meter.ts
import { Router } from "express";
import { db } from "../utils/firebase.js";

export const meter = Router();

type IngestArgs = {
  projectId: string;
  source?: string;
  mprn: string;
  meterSerial: string;
  entries: Array<{
    read_end: string;        // ISO string
    register_kwh: number;    // cumulative register
    read_type: string;       // must be "24 Hr Active Import Register (kWh)"
  }>;
};

export async function ingestMeterReadingsBatch(args: IngestArgs): Promise<{
  batch_id: string;
  inserted: number;
  rejected: number;
}> {
  const { projectId, source = "esb_csv", mprn, meterSerial, entries } = args;

  if (!projectId || !mprn || !meterSerial || !entries?.length) {
    throw new Error("projectId, mprn, meterSerial, entries[] required");
  }

  // Create batch doc (audit)
  const nowIso = new Date().toISOString();
  const batchRef = await db.collection("meter_batches").add({
    project_id: projectId,
    source,
    mprn,
    meter_serial: meterSerial,
    count: entries.length,
    status: "Imported",
    created_at: nowIso,
  });

  // Write raw daily reads (cumulative register)
  const b = db.batch();
  const readsCol = db.collection("meter_reads_daily");

  let accepted = 0;
  let rejected = 0;

  for (const r of entries) {
    const readType = String(r.read_type || "");
    if (readType !== "24 Hr Active Import Register (kWh)") {
      rejected++;
      continue;
    }

    const register = Number(r.register_kwh);
    if (!Number.isFinite(register) || register < 0) {
      rejected++;
      continue;
    }

    const readEndIso = new Date(r.read_end).toISOString();

    // canonical doc id to avoid duplicates (per day)
    const docId = `${projectId}_${mprn}_${readEndIso.substring(0, 10)}`;

    b.set(
      readsCol.doc(docId),
      {
        project_id: projectId,
        mprn,
        meter_serial: meterSerial,
        read_end: readEndIso,
        read_type: readType,
        register_kwh: register,
        batch_id: batchRef.id,
        updated_at: nowIso,
      },
      { merge: true }
    );
    accepted++;
  }

  await b.commit();

  return { batch_id: batchRef.id, inserted: accepted, rejected };
}

/**
 * Ingest ESB daily register readings for a project (Stream A).
 *
 * Body:
 * {
 *   source: 'esb_csv'|'api',
 *   mprn: '10015764968',
 *   meter_serial: 'ESB123456',
 *   entries: [
 *     { read_end: '2026-01-17T00:00:00Z', register_kwh: 123456.78, read_type: '24 Hr Active Import Register (kWh)' }
 *   ]
 * }
 */
meter.post("/projects/:projectId/meter-readings/batches", async (req, res) => {
  try {
    const { projectId } = req.params;
    const body = req.body || {};
    const source = body.source || "esb_csv";
    const mprn: string | undefined = body.mprn;
    const meterSerial: string | undefined = body.meter_serial;
    const entries: Array<any> = Array.isArray(body.entries) ? body.entries : [];

    if (!projectId || !mprn || !meterSerial || entries.length === 0) {
      return res.status(400).json({
        error: "projectId, mprn, meter_serial, entries[] required",
      });
    }

    const result = await ingestMeterReadingsBatch({
      projectId,
      source,
      mprn,
      meterSerial,
      entries,
    });

    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[meter-readings] error", err);
    return res.status(500).json({
      error: "internal_error",
      detail: String(err?.message || err),
    });
  }
});
