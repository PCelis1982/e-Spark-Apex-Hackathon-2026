// src/routes/ep/pages/tabs/UsageMeter.jsx

import React from "react";
import { useOutletContext } from "react-router-dom";
import { ccsGet, authHeaders } from "@/lib/ccsClient";

/* ---------------- network helpers ---------------- */

async function uploadMultipart(url, file) {
  const form = new FormData();
  form.append("file", file);

  const headers = await authHeaders();
  if (headers["Content-Type"]) delete headers["Content-Type"];
  if (headers["content-type"]) delete headers["content-type"];

  const res = await fetch(`${import.meta.env.VITE_CCS_API_BASE}${url}`, {
    method: "POST",
    headers,
    body: form,
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    console.error("[uploadMultipart] failed", res.status, text);
    throw new Error(text || `Upload failed: ${res.status}`);
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function postJson(url, body) {
  const res = await fetch(`${import.meta.env.VITE_CCS_API_BASE}${url}`, {
    method: "POST",
    headers: {
      ...(await authHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(text || `POST failed: ${res.status}`);

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function downloadCsv(url, filename) {
  const res = await fetch(`${import.meta.env.VITE_CCS_API_BASE}${url}`, {
    method: "GET",
    headers: await authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Download failed: ${res.status}`);
  }

  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(link.href);
}

async function deleteUpload(projectId, fileId) {
  const res = await fetch(
    `${import.meta.env.VITE_CCS_API_BASE}/projects/${projectId}/usage/${fileId}`,
    { method: "DELETE", headers: await authHeaders() }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Delete failed: ${res.status}`);
  }
}

/* ---------------- UI helpers ---------------- */

function UploadBtn({ label, accept, onPick, disabled }) {
  const ref = React.useRef(null);
  return (
    <>
      <input
        ref={ref}
        hidden
        type="file"
        accept={accept}
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        disabled={disabled}
        className={`px-3 py-1 rounded border border-cyan-700/60 ${
          disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-cyan-900/20"
        }`}
        onClick={() => !disabled && ref.current?.click()}
      >
        {label}
      </button>
    </>
  );
}

function Section({ title, rows, onDelete }) {
  return (
    <div>
      <div className="text-cyan-200 font-medium mb-2">{title}</div>

      {!rows || rows.length === 0 ? (
        <div className="text-cyan-300/60 text-sm">No files.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-cyan-300/80">
              <tr className="border-b border-cyan-800/50">
                <th className="text-left py-2 pr-3">Type</th>
                <th className="text-left py-2 pr-3">File</th>
                <th className="text-left py-2 pr-3">Size</th>
                <th className="text-left py-2 pr-3">Uploaded</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2 pr-3">Action</th>
              </tr>
            </thead>

            <tbody className="text-cyan-100/90">
              {rows.map((r) => {
                const status =
                  r.status ||
                  (r.validation?.ok === true
                    ? "valid"
                    : r.validation?.ok === false
                    ? "invalid"
                    : "unknown");

                const firstErrors = Array.isArray(r.validation?.errors)
                  ? r.validation.errors.slice(0, 3)
                  : [];

                return (
                  <tr
                    key={r.id}
                    className="border-b border-cyan-800/30 hover:bg-cyan-900/10 align-top"
                  >
                    <td className="py-2 pr-3">
                      {r.type?.toUpperCase?.() || "—"}
                    </td>

                    <td className="py-2 pr-3">
                      <div>{r.file_name || "—"}</div>

                      {firstErrors.length > 0 && (
                        <div className="mt-1 text-xs text-amber-300/80">
                          {firstErrors.map((msg, i) => (
                            <div key={i}>• {msg}</div>
                          ))}
                          {Array.isArray(r.validation?.errors) &&
                            r.validation.errors.length > firstErrors.length && (
                              <div>… and more</div>
                            )}
                        </div>
                      )}
                    </td>

                    <td className="py-2 pr-3">{r.size ? `${r.size} B` : "—"}</td>
                    <td className="py-2 pr-3">{r.created_at || "—"}</td>

                    <td className="py-2 pr-3">
                      <span
                        className={
                          status === "valid"
                            ? "text-emerald-300"
                            : status === "invalid"
                            ? "text-red-300"
                            : "text-cyan-300/70"
                        }
                      >
                        {String(status).toUpperCase()}
                      </span>
                    </td>

                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => onDelete(r.id)}
                        className="px-2 py-1 rounded border border-red-600/70 text-red-200 hover:bg-red-900/30"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Pill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm border ${
        active
          ? "bg-cyan-700 text-white border-cyan-600"
          : "bg-cyan-900/20 text-cyan-200 border-cyan-700/50 hover:bg-cyan-900/30"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded border border-cyan-700/30 bg-black/20 px-3 py-2">
      <div className="text-[11px] text-cyan-300/70">{label}</div>
      <div className="text-cyan-100 font-semibold">{value}</div>
    </div>
  );
}

/* ---------------- main ---------------- */

export default function UsageMeter() {
  const ctx = useOutletContext() || {};
  const project = ctx.project || null;
  const projectId = project?.id || ctx.projectId || null;

  if (!projectId) {
    return (
      <div className="text-sm text-red-300">
        UsageMeter: no <code>projectId</code> in outlet context.
      </div>
    );
  }

  const projectActive =
    String(project?.status || ctx.projectStatus || "draft").toLowerCase() ===
    "active";

  // mode: second-level navigation
  const [mode, setMode] = React.useState("uploads"); // "uploads" | "recon"

  // uploads
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [nonce, setNonce] = React.useState(0);
  const refresh = () => setNonce((n) => n + 1);

  // reconciliation
  const [month, setMonth] = React.useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  const [reconBusy, setReconBusy] = React.useState(false);
  const [validations, setValidations] = React.useState([]);
  const [validLoading, setValidLoading] = React.useState(false);
  const [validErr, setValidErr] = React.useState("");
  const [lastReconSummary, setLastReconSummary] = React.useState(null); // badge in Uploads view

  // ✅ EXPAND / DRILLDOWN STATE (additions)
  const [expandedMprn, setExpandedMprn] = React.useState(null);
  const [cpDetailsByMprn, setCpDetailsByMprn] = React.useState({});
  const [cpLoadingByMprn, setCpLoadingByMprn] = React.useState({});
  const [cpErrByMprn, setCpErrByMprn] = React.useState({});

  // load uploads list
  React.useEffect(() => {
    let on = true;

    (async () => {
      setLoading(true);
      setErr("");
      setRows([]);
      try {
        const list = await ccsGet(`/projects/${projectId}/usage`);
        if (!on) return;
        setRows(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!on) return;
        console.error("[UsageMeter] load error", e);
        setErr(String(e?.message || e));
      } finally {
        if (on) setLoading(false);
      }
    })();

    return () => {
      on = false;
    };
  }, [projectId, nonce]);

  // ✅ clear drilldown cache when month changes (additions)
  React.useEffect(() => {
    setExpandedMprn(null);
    setCpDetailsByMprn({});
    setCpLoadingByMprn({});
    setCpErrByMprn({});
  }, [month]);

  // load validations for selected month (used in recon view, but also used to compute summary badge)
  async function loadValidations() {
    if (!month) return;
    setValidLoading(true);
    setValidErr("");
    try {
      const data = await ccsGet(
        `/projects/${projectId}/nora/validations?month=${encodeURIComponent(
          month
        )}&limit=500`
      );
      const items = Array.isArray(data?.items) ? data.items : [];
      setValidations(items);

      // summary for badge
      const counts = items.reduce(
        (acc, it) => {
          const s = String(it.status || "").toUpperCase();
          if (s === "PASS") acc.pass++;
          else if (s === "CONDITIONAL_PASS") acc.conditional++;
          else if (s === "FAIL") acc.fail++;
          return acc;
        },
        { pass: 0, conditional: 0, fail: 0 }
      );

      setLastReconSummary({
        month,
        total: items.length,
        ...counts,
        computed_at:
          items.length > 0
            ? items
                .map((x) => x.computed_at)
                .filter(Boolean)
                .sort()
                .slice(-1)[0]
            : null,
      });
    } catch (e) {
      setValidErr(String(e?.message || e));
      setValidations([]);
    } finally {
      setValidLoading(false);
    }
  }

  // ✅ load CP breakdown for one MPRN (additions)
  async function loadCpDetailsForMprn(mprn) {
    if (!mprn || !month) return;

    // cached?
    if (cpDetailsByMprn[mprn]) return;

    setCpLoadingByMprn((s) => ({ ...s, [mprn]: true }));
    setCpErrByMprn((s) => ({ ...s, [mprn]: "" }));

    try {
      const data = await ccsGet(
        `/projects/${projectId}/nora/cp-monthly-breakdown?month=${encodeURIComponent(
          month
        )}&mprn=${encodeURIComponent(mprn)}`
      );
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      setCpDetailsByMprn((prev) => ({ ...prev, [mprn]: rows }));
    } catch (e) {
      setCpErrByMprn((prev) => ({
        ...prev,
        [mprn]: String(e?.message || e),
      }));
    } finally {
      setCpLoadingByMprn((s) => ({ ...s, [mprn]: false }));
    }
  }

  // reload validations when month changes and we are in recon mode
  React.useEffect(() => {
    if (mode !== "recon") return;
    loadValidations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, month, projectId]);

  /* ---------------- uploads actions ---------------- */

  async function pickUsage(file) {
    if (!file) return;
    try {
      await uploadMultipart(`/projects/${projectId}/usage:upload`, file);
      refresh();
    } catch (e) {
      alert(String(e?.message || e));
    }
  }

  async function pickMeter(file) {
    if (!file) return;
    try {
      await uploadMultipart(`/projects/${projectId}/meter:upload`, file);
      refresh();
    } catch (e) {
      alert(String(e?.message || e));
    }
  }

  async function handleDelete(fileId) {
    if (!fileId) return;
    const ok = window.confirm("Delete this upload?");
    if (!ok) return;
    try {
      await deleteUpload(projectId, fileId);
      refresh();
    } catch (e) {
      alert(String(e?.message || e));
    }
  }

  /* ---------------- reconciliation actions ---------------- */

  function yyyymmToYearMonth(yyyymm) {
    const m = String(yyyymm || "").trim();
    const mm = m.match(/^(\d{4})-(\d{2})$/);
    if (!mm) return null;
    return { year: Number(mm[1]), month: Number(mm[2]) };
  }

  async function runCpMonthlyBuild() {
    const ym = yyyymmToYearMonth(month);
    if (!ym) return alert("Pick a month (YYYY-MM).");
    setReconBusy(true);
    try {
      await postJson(`/projects/${projectId}/nora/cp-monthly:build`, ym);
      alert(`cp_monthly built for ${month}`);
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setReconBusy(false);
    }
  }

  async function runMeterMonthlyBuild() {
    if (!month) return alert("Pick a month (YYYY-MM).");
    setReconBusy(true);
    try {
      await postJson(`/projects/${projectId}/mrv/meter-monthly:build`, { month });
      alert(`meter_monthly built for ${month}`);
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setReconBusy(false);
    }
  }

  async function runMonthlyValidate() {
    const ym = yyyymmToYearMonth(month);
    if (!ym) return alert("Pick a month (YYYY-MM).");
    setReconBusy(true);
    try {
      await postJson(`/projects/${projectId}/nora/monthly-validate:run`, ym);
      await loadValidations();
      alert(`Monthly validation completed for ${month}`);
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setReconBusy(false);
    }
  }

  async function runAll() {
    const ym = yyyymmToYearMonth(month);
    if (!ym) return alert("Pick a month (YYYY-MM).");
    setReconBusy(true);
    try {
      await postJson(`/projects/${projectId}/nora/cp-monthly:build`, ym);
      await postJson(`/projects/${projectId}/mrv/meter-monthly:build`, { month });
      await postJson(`/projects/${projectId}/nora/monthly-validate:run`, ym);
      await loadValidations();
      alert(`Run all completed for ${month}`);
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setReconBusy(false);
    }
  }

  async function downloadStatementOfSupply() {
    if (!month) return alert("Pick a month (YYYY-MM).");
    setReconBusy(true);
    try {
      await downloadCsv(
        `/projects/${projectId}/nora/statement-of-supply.csv?month=${encodeURIComponent(
          month
        )}`,
        `statement_of_supply_${projectId}_${month}.csv`
      );
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setReconBusy(false);
    }
  }

  /* ---------------- derived ---------------- */

  const usageRows = rows.filter((r) => r.type === "usage");
  const meterRows = rows.filter((r) => r.type === "meter");

  const counts = validations.reduce(
    (acc, it) => {
      const s = String(it.status || "").toUpperCase();
      if (s === "PASS") acc.pass++;
      else if (s === "CONDITIONAL_PASS") acc.conditional++;
      else if (s === "FAIL") acc.fail++;
      return acc;
    },
    { pass: 0, conditional: 0, fail: 0 }
  );

  /* ---------------- render ---------------- */

  return (
    <div className="rounded border border-cyan-700/40 bg-cyan-900/5 p-4">
      {!projectActive && (
        <div className="mb-3 text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded px-3 py-2">
          Uploads & reconciliation are disabled while the project is{" "}
          <b>{project?.status || ctx.projectStatus || "draft"}</b>. Complete
          assets verification and activate the project to proceed.
        </div>
      )}

      {/* Second level navigation */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="text-cyan-200 font-medium">Usage / Meter</div>
        <div className="flex gap-2">
          <Pill active={mode === "uploads"} onClick={() => setMode("uploads")}>
            Uploads
          </Pill>
          <Pill active={mode === "recon"} onClick={() => setMode("recon")}>
            Reconciliation
          </Pill>
        </div>
      </div>

      {/* UPLOADS VIEW */}
      {mode === "uploads" && (
        <>
          {/* Summary badge only (no build buttons here) */}
          <div className="mb-4 rounded border border-cyan-700/30 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-cyan-200 font-medium">
                  Latest reconciliation (badge)
                </div>
                <div className="text-xs text-cyan-300/70">
                  This is a quick health indicator. Full details are in{" "}
                  <b>Reconciliation</b>.
                </div>
              </div>

              <button
                type="button"
                className="px-3 py-1 rounded border border-cyan-700/60 hover:bg-cyan-900/20"
                onClick={() => {
                  setMode("recon");
                }}
              >
                Go to reconciliation
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-cyan-900/30 border border-cyan-700/40 text-cyan-200">
                Month: {month}
              </span>
              {lastReconSummary ? (
                <>
                  <span className="px-2 py-1 rounded bg-emerald-900/20 border border-emerald-700/30 text-emerald-200">
                    PASS: {lastReconSummary.pass}
                  </span>
                  <span className="px-2 py-1 rounded bg-amber-900/20 border border-amber-700/30 text-amber-200">
                    CONDITIONAL: {lastReconSummary.conditional}
                  </span>
                  <span className="px-2 py-1 rounded bg-red-900/20 border border-red-700/30 text-red-200">
                    FAIL: {lastReconSummary.fail}
                  </span>
                  <span className="px-2 py-1 rounded bg-cyan-900/20 border border-cyan-700/30 text-cyan-200">
                    Total: {lastReconSummary.total}
                  </span>
                </>
              ) : (
                <span className="px-2 py-1 rounded bg-cyan-900/20 border border-cyan-700/30 text-cyan-300/80">
                  No reconciliation loaded yet (open Reconciliation tab to load).
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-cyan-200 font-medium">Uploads</div>
            <div className="flex gap-2">
              <UploadBtn
                label="Upload EVC usage"
                accept=".csv,.xlsx"
                onPick={pickUsage}
                disabled={!projectActive}
              />
              <UploadBtn
                label="Upload meter readings"
                accept=".csv"
                onPick={pickMeter}
                disabled={!projectActive}
              />
            </div>
          </div>

          {loading && <div className="text-cyan-300/70">Loading…</div>}
          {err && <div className="text-red-300">{err}</div>}

          {!loading && !err && rows.length === 0 && (
            <div className="text-cyan-300/70">No uploads yet.</div>
          )}

          {!loading && !err && rows.length > 0 && (
            <div className="space-y-6">
              <Section
                title="Usage files (EVC)"
                rows={usageRows}
                onDelete={handleDelete}
              />
              <Section
                title="Meter readings (ESB)"
                rows={meterRows}
                onDelete={handleDelete}
              />
            </div>
          )}
        </>
      )}

      {/* RECONCILIATION VIEW */}
      {mode === "recon" && (
        <>
          <div className="rounded border border-cyan-700/40 bg-cyan-950/20 p-3">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-cyan-300/80">Month</span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="bg-black/20 border border-cyan-700/40 rounded px-2 py-1 text-cyan-100"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!projectActive || reconBusy}
                  onClick={runCpMonthlyBuild}
                  className={`px-3 py-1 rounded border border-cyan-700/60 ${
                    !projectActive || reconBusy
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-cyan-900/20"
                  }`}
                >
                  Build CP monthly
                </button>

                <button
                  type="button"
                  disabled={!projectActive || reconBusy}
                  onClick={runMeterMonthlyBuild}
                  className={`px-3 py-1 rounded border border-cyan-700/60 ${
                    !projectActive || reconBusy
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-cyan-900/20"
                  }`}
                >
                  Build meter monthly
                </button>

                <button
                  type="button"
                  disabled={!projectActive || reconBusy}
                  onClick={runMonthlyValidate}
                  className={`px-3 py-1 rounded border border-cyan-700/60 ${
                    !projectActive || reconBusy
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-cyan-900/20"
                  }`}
                >
                  Run validate
                </button>

                <button
                  type="button"
                  disabled={!projectActive || reconBusy}
                  onClick={downloadStatementOfSupply}
                  className={`px-3 py-1 rounded border border-cyan-700/60 ${
                    !projectActive || reconBusy
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-cyan-900/20"
                  }`}
                >
                  Download SoS CSV
                </button>

                <button
                  type="button"
                  disabled={!projectActive || reconBusy}
                  onClick={runAll}
                  className={`px-3 py-1 rounded bg-cyan-600 ${
                    !projectActive || reconBusy
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-cyan-500"
                  }`}
                  title="Build CP monthly, build meter monthly, run validation, refresh results"
                >
                  Run all
                </button>
              </div>
            </div>

            <div className="mt-2 text-xs text-cyan-300/60">
              Validation rule: PASS if variance &lt;= X. CONDITIONAL PASS if X &lt; variance &lt;= Y. FAIL if variance &gt; Y, where variance = |meter - CP| / meter.
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="PASS" value={counts.pass} />
            <Stat label="CONDITIONAL" value={counts.conditional} />
            <Stat label="FAIL" value={counts.fail} />
            <Stat label="TOTAL" value={validations.length} />
          </div>

          {validLoading && (
            <div className="mt-4 text-cyan-300/70">Loading results…</div>
          )}
          {validErr && <div className="mt-4 text-red-300">{validErr}</div>}

          {/* Results table */}
          {!validLoading && !validErr && (
            <div className="mt-4 overflow-x-auto rounded border border-cyan-700/30">
              <table className="w-full text-sm">
                <thead className="text-cyan-300/80 bg-black/20">
                  <tr className="border-b border-cyan-800/50">
                    <th className="text-left py-2 px-3">MPRN</th>
                    <th className="text-right py-2 px-3">Meter kWh</th>
                    <th className="text-right py-2 px-3">CP kWh</th>
                    <th className="text-right py-2 px-3">Variance kWh</th>
                    <th className="text-right py-2 px-3">Variance %</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Reason</th>
                    <th className="text-right py-2 px-3">CP rows</th>
                    {/* ✅ new column */}
                    <th className="text-left py-2 px-3">Details</th>
                  </tr>
                </thead>

                <tbody className="text-cyan-100/90">
                  {validations.length === 0 ? (
                    <tr>
                      <td className="py-3 px-3 text-cyan-300/70" colSpan={9}>
                        No validations for this month yet. Click <b>Run all</b>.
                      </td>
                    </tr>
                  ) : (
                    validations.map((v) => {
                      const status = String(v.status || "").toUpperCase();
                      const cls =
                        status === "PASS"
                          ? "text-emerald-300"
                          : status ===  "CONDITIONAL_PASS"
                          ? "text-amber-300"
                          : "text-red-300";

                      const mprn = v.mprn || "";
                      const isOpen = expandedMprn === mprn;

                      const loadingCp = !!cpLoadingByMprn[mprn];
                      const cpErr = cpErrByMprn[mprn] || "";
                      const cpRows = Array.isArray(cpDetailsByMprn[mprn])
                        ? cpDetailsByMprn[mprn]
                        : [];

                      const totalSessions = cpRows.reduce(
                        (a, r) => a + (Number(r.sessions) || 0),
                        0
                      );
                      const totalKwh = cpRows.reduce(
                        (a, r) => a + (Number(r.kwh) || 0),
                        0
                      );

                      return (
                        <React.Fragment key={v.id}>
                          <tr className="border-b border-cyan-800/30 hover:bg-cyan-900/10">
                            <td className="py-2 px-3">{mprn || "—"}</td>
                            <td className="py-2 px-3 text-right">
                              {Number.isFinite(Number(v.meter_kwh))
                                ? Number(v.meter_kwh).toFixed(2)
                                : "—"}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {Number.isFinite(Number(v.cp_kwh))
                                ? Number(v.cp_kwh).toFixed(2)
                                : "—"}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {Number.isFinite(Number(v.variance_kwh))
                                ? Number(v.variance_kwh).toFixed(2)
                                : "—"}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {Number.isFinite(Number(v.variance_pct))
                                ? `${(Number(v.variance_pct) * 100).toFixed(
                                    2
                                  )}%`
                                : "—"}
                            </td>
                            <td className={`py-2 px-3 font-semibold ${cls}`}>
                              {status || "—"}
                            </td>
                            <td className="py-2 px-3">
                              {v.failure_reason || "—"}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {v?.evidence?.cp_monthly_count ?? 0}
                            </td>

                            {/* ✅ expand button */}
                            <td className="py-2 px-3">
                              <button
                                type="button"
                                className="px-2 py-1 rounded border border-cyan-700/60 hover:bg-cyan-900/20 text-xs"
                                onClick={async () => {
                                  if (!mprn) return;
                                  const next = isOpen ? null : mprn;
                                  setExpandedMprn(next);
                                  if (next) await loadCpDetailsForMprn(mprn);
                                }}
                              >
                                {isOpen ? "Hide" : "Expand"}
                              </button>
                            </td>
                          </tr>

                          {/* ✅ expanded nested view */}
                          {isOpen && (
                            <tr className="border-b border-cyan-800/30">
                              <td colSpan={9} className="px-3 py-3 bg-black/10">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <div className="text-cyan-200 font-medium text-sm">
                                    Charge points under MPRN {mprn}
                                  </div>

                                  <div className="flex gap-2 text-xs">
                                    <span className="px-2 py-1 rounded bg-cyan-900/20 border border-cyan-700/30 text-cyan-200">
                                      CPs: {cpRows.length}
                                    </span>
                                    <span className="px-2 py-1 rounded bg-cyan-900/20 border border-cyan-700/30 text-cyan-200">
                                      Sessions: {totalSessions}
                                    </span>
                                    <span className="px-2 py-1 rounded bg-cyan-900/20 border border-cyan-700/30 text-cyan-200">
                                      kWh: {Number(totalKwh).toFixed(3)}
                                    </span>
                                  </div>
                                </div>

                                {loadingCp && (
                                  <div className="text-cyan-300/70 text-sm">
                                    Loading…
                                  </div>
                                )}
                                {cpErr && (
                                  <div className="text-red-300 text-sm">
                                    {cpErr}
                                  </div>
                                )}

                                {!loadingCp && !cpErr && cpRows.length === 0 && (
                                  <div className="text-cyan-300/70 text-sm">
                                    No CP rollups found for this MPRN/month.
                                  </div>
                                )}

                                {!loadingCp && !cpErr && cpRows.length > 0 && (
                                  <div className="overflow-x-auto rounded border border-cyan-700/30">
                                    <table className="w-full text-sm">
                                      <thead className="text-cyan-300/80 bg-black/20">
                                        <tr className="border-b border-cyan-800/50">
                                          <th className="text-left py-2 px-3">
                                            CP Ref
                                          </th>
                                          <th className="text-right py-2 px-3">
                                            kWh (month)
                                          </th>
                                          <th className="text-right py-2 px-3">
                                            Sessions
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="text-cyan-100/90">
                                        {cpRows.map((r) => (
                                          <tr
                                            key={`${r.mprn}::${r.cp_ref}`}
                                            className="border-b border-cyan-800/30"
                                          >
                                            <td className="py-2 px-3">
                                              {r.cp_ref || "—"}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                              {Number(r.kwh || 0).toFixed(3)}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                              {Number(r.sessions || 0)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="text-xs text-cyan-300/60 mt-4">
        Project: {project?.name || "—"} ({projectId})
      </div>
    </div>
  );
}
