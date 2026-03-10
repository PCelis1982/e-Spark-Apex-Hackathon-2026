// src/routes/ep/pages/EpManagePage.jsx
import React from "react";
import { useSearchParams } from "react-router-dom";
import { ccsGet } from "@/lib/ccsClient";

const CLAIM_META = {
  REDIII_IE: { product: "e-Performance", title: "REDIII / RTFO (IE)" },
  RED_EU: { product: "e-Performance", title: "RED (DE / AT / NL)" },
  VCM: { product: "e-Performance", title: "Carbon credits (VCM)" },
  GO: { product: "e-Performance", title: "Guarantees of Origin" },
  ENERGY: { product: "e-Performance", title: "Energy performance (core MRV)" },
};

const COUNTRIES = [
  ["", "Any"],
  ["AT", "Austria"], ["BE", "Belgium"], ["BG", "Bulgaria"], ["HR", "Croatia"], ["CY", "Cyprus"],
  ["CZ", "Czechia"], ["DK", "Denmark"], ["EE", "Estonia"], ["FI", "Finland"], ["FR", "France"],
  ["DE", "Germany"], ["GR", "Greece"], ["HU", "Hungary"], ["IS", "Iceland"], ["IE", "Ireland"],
  ["IT", "Italy"], ["LV", "Latvia"], ["LI", "Liechtenstein"], ["LT", "Lithuania"], ["LU", "Luxembourg"],
  ["MT", "Malta"], ["NL", "Netherlands"], ["NO", "Norway"], ["PL", "Poland"], ["PT", "Portugal"],
  ["RO", "Romania"], ["SK", "Slovakia"], ["SI", "Slovenia"], ["ES", "Spain"], ["SE", "Sweden"],
  ["CH", "Switzerland"], ["GB", "United Kingdom"],
];

const COUNTRY_NAME = Object.fromEntries(
  COUNTRIES.filter(([c]) => c).map(([c, n]) => [c, n])
);

// Helper: safe get number
const n = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : null);

// Fetch metrics for a project (project_stats-backed via /projects/:id)
async function fetchProjectMetrics(pid) {
  try {
    const p = await ccsGet(`/projects/${pid}`);
    return {
      evc: n(p?.evc_count) ?? 0,
      batteries: n(p?.battery_count) ?? 0,
      cp: n(p?.cp_count) ?? 0,

      totalCC: n(p?.total_cc_tonnes),
      periodCC: n(p?.current_period_cc_tonnes),
      dailyAvg: n(p?.daily_cc_tonnes),

      certDate: p?.next_closing_date || null,
    };
  } catch (err) {
    console.error("[EpManage] metrics hard-fail for", pid, err);
    return {
      evc: 0,
      batteries: 0,
      cp: 0,
      totalCC: null,
      periodCC: null,
      dailyAvg: null,
      certDate: null,
    };
  }
}

const PAGE_SIZE = 30;

export default function EpManagePage({
  projectFilter,
  defaultClaim,
  hideHeader = false,
  lockedCountry,          // ✅ NEW (was referenced but missing)
  hideCountryFilter = false, // ✅ NEW (lets wrappers hide it if needed)
} = {}) {
  const [sp] = useSearchParams();
  const claim = sp.get("claim") || defaultClaim || "VCM";
  const claimMeta = CLAIM_META[claim] || CLAIM_META.ENERGY;

  // Filters
  const [org, setOrg] = React.useState("");
  const [country, setCountry] = React.useState(lockedCountry || "");
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    if (lockedCountry != null) setCountry(lockedCountry);
  }, [lockedCountry]);

  // Rows (projects)
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");

  // Pagination
  const [page, setPage] = React.useState(1);

  // Selection for dashboard focus
  const [selectedIds, setSelectedIds] = React.useState(() => new Set());
  const [useSelection, setUseSelection] = React.useState(false);

  // Metrics per project id
  const [metrics, setMetrics] = React.useState({});
  const [metricsBusy, setMetricsBusy] = React.useState(false);
  const METRIC_LIMIT = 25;

  // per-project site breakdown expansion
  const [expandedProjectId, setExpandedProjectId] = React.useState(null);
  const [siteBreakdown, setSiteBreakdown] = React.useState({});

  async function search() {
    setLoading(true);
    setErr("");
    setRows([]);
    setMetrics({});
    setPage(1);

    try {
      const looksLikeId = q && /^[A-Za-z0-9_-]{12,}$/.test(q);
      const countryParam = lockedCountry || country;

      if (looksLikeId) {
        try {
          const one = await ccsGet(`/projects/${q}`);
          const arr = one ? [one] : [];
          const filtered = projectFilter ? arr.filter(projectFilter) : arr;
          setRows(filtered);
          return;
        } catch {
          // fall through
        }
      }

      let url = `/projects?limit=${PAGE_SIZE}`;
      if (org) url += `&org=${encodeURIComponent(org)}`;
      if (countryParam) url += `&country=${encodeURIComponent(countryParam)}`;
      if (q) url += `&q=${encodeURIComponent(q)}`;

      let list = [];
      try {
        list = await ccsGet(url);
      } catch {
        const all = await ccsGet(`/projects`);
        list = (all || []).filter((p) => {
          if (org && p.organization_id !== org) return false;
          if (countryParam && p.country !== countryParam) return false;
          if (q) {
            const s = `${p.name} ${p.id}`.toLowerCase();
            if (!s.includes(q.toLowerCase())) return false;
          }
          return true;
        });
      }

      const filtered = projectFilter ? (list || []).filter(projectFilter) : (list || []);
      setRows(filtered);
      setPage(1);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Pagination
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentRows = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  // Dashboard feed ids (current page / selection only)
  const activeIds = React.useMemo(() => {
    if (!useSelection || selectedIds.size === 0) {
      return currentRows.map((r) => r.id);
    }
    return currentRows.map((r) => r.id).filter((id) => selectedIds.has(id));
  }, [currentRows, useSelection, selectedIds]);

  async function loadNextMetricsBatch() {
    if (metricsBusy) return;
    setMetricsBusy(true);
    try {
      const remaining = activeIds.filter((id) => !metrics[id]);
      const slice = remaining.slice(0, METRIC_LIMIT);
      if (!slice.length) return;

      const results = await Promise.all(slice.map((id) => fetchProjectMetrics(id)));
      const next = { ...metrics };
      slice.forEach((id, i) => { next[id] = results[i]; });
      setMetrics(next);
    } finally {
      setMetricsBusy(false);
    }
  }

  React.useEffect(() => {
    if (activeIds.length) loadNextMetricsBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIds.join("|")]);

  const canLoadMore = activeIds.some((id) => !metrics[id]);

  async function loadSiteBreakdown(projectId) {
    setSiteBreakdown((prev) => ({
      ...prev,
      [projectId]: { loading: true, rows: [], error: null },
    }));

    try {
      const res = await ccsGet(`/projects/${projectId}/cc/sites`);
      const rows = res?.site_totals || [];
      setSiteBreakdown((prev) => ({
        ...prev,
        [projectId]: { loading: false, rows, error: null },
      }));
    } catch (err) {
      console.error("[EpManage] loadSiteBreakdown failed", err);
      setSiteBreakdown((prev) => ({
        ...prev,
        [projectId]: { loading: false, rows: [], error: String(err?.message || err) },
      }));
    }
  }

  function toggleSites(projectId) {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      return;
    }
    setExpandedProjectId(projectId);
    if (!siteBreakdown[projectId]) loadSiteBreakdown(projectId);
  }

  const dash = React.useMemo(() => {
    const ids = activeIds;
    let evc = 0, batteries = 0, cp = 0;
    let totalCC = 0, haveTotalCC = false;
    let periodCC = 0, havePeriodCC = false;
    let dailyAgg = 0, dailyCount = 0;

    for (const id of ids) {
      const m = metrics[id];
      if (!m) continue;
      evc += m.evc || 0;
      batteries += m.batteries || 0;
      cp += m.cp || 0;

      if (m.totalCC != null) { totalCC += m.totalCC; haveTotalCC = true; }
      if (m.periodCC != null) { periodCC += m.periodCC; havePeriodCC = true; }
      if (m.dailyAvg != null) { dailyAgg += m.dailyAvg; dailyCount += 1; }
    }

    return {
      totalProjects: ids.length,
      evc,
      batteries,
      cp,
      totalCC: haveTotalCC ? totalCC : null,
      periodCC: havePeriodCC ? periodCC : null,
      dailyAvg: dailyCount ? dailyAgg / dailyCount : null,
    };
  }, [activeIds, metrics]);

  const TRACK_LABEL = {
    EU_RED_IE: "REDIII / RTFO (IE)",
    EU_RED_AT: "REDIII (AT)",
    EU_RED_DE: "REDIII (DE)",
    VCM: "Carbon credits (VCM)",
    GO: "Guarantees of Origin",
    ENERGY: "Energy performance",
  };

  function policyText(p) {
    const t = p?.policy?.track || p?.policy_track || p?.track || "";
    const key = String(t).toUpperCase();
    return TRACK_LABEL[key] || key || "—";
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-6xl">
      {/* ✅ Only render header/subtitle when NOT hidden */}
      {!hideHeader && (
        <>
          <h2 className="text-2xl mb-1">e-Performance — Claims orchestration</h2>
          <div className="text-cyan-300/80 mb-4">{claimMeta.title}</div>
        </>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-sm text-cyan-300/70 mb-1">Organisation</label>
          <input
            className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
            placeholder="e.g. org_demo_001"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
          />
        </div>

        {!hideCountryFilter && (
          <div>
            <label className="block text-sm text-cyan-300/70 mb-1">Country</label>
            <select
              className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm text-cyan-300/70 mb-1">Project Name or Project ID</label>
          <input
            className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
            placeholder="Type a name or paste an ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={search}
          className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500"
          disabled={loading}
        >
          {loading ? "Searching…" : "Search"}
        </button>

        <label className="flex items-center gap-2 text-sm text-cyan-200 select-none">
          <input
            type="checkbox"
            className="accent-cyan-500"
            checked={useSelection}
            onChange={(e) => setUseSelection(e.target.checked)}
          />
          Use selection in dashboard ({selectedIds.size})
        </label>

        {canLoadMore && (
          <button
            onClick={loadNextMetricsBatch}
            className="ml-auto px-3 py-1.5 rounded border border-cyan-700 hover:bg-cyan-900/20 disabled:opacity-50"
            disabled={metricsBusy}
          >
            {metricsBusy ? "Loading metrics…" : "Load more metrics"}
          </button>
        )}
      </div>

      {err && (
        <div className="mt-3 rounded border border-red-500/50 bg-red-900/20 p-3 text-red-200">
          {err}
        </div>
      )}

      {/* Dashboard */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <DashCard label="Projects (page/selection)" value={dash.totalProjects} />
        <DashCard label="EVCs" value={dash.evc} />
        <DashCard label="Batteries" value={dash.batteries} />
        <DashCard label="CP (points)" value={dash.cp} />
        <DashCard label="Total CC" value={dash.totalCC} fmt="cc" />
        <DashCard label="CC (this period)" value={dash.periodCC} fmt="cc" />
        <DashCard label="Daily CC avg" value={dash.dailyAvg} fmt="cc" className="sm:col-span-3 xl:col-span-2" />
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-cyan-300/70">
            <tr className="border-b border-cyan-800/40">
              <Th>Selected</Th>
              <Th>Project name</Th>
              <Th>Policy</Th>
              <Th numeric>EVC</Th>
              <Th numeric>Batteries</Th>
              <Th numeric>CP</Th>
              <Th numeric>Total CC</Th>
              <Th numeric>CC (period)</Th>
              <Th numeric>Daily CC avg</Th>
              <Th>Cert date</Th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map((p) => {
              const m = metrics[p.id] || {};
              const expanded = expandedProjectId === p.id;
              const state = siteBreakdown[p.id];

              return (
                <React.Fragment key={p.id}>
                  <tr className="border-b border-cyan-800/30 hover:bg-cyan-900/10">
                    <Td>
                      <input
                        type="checkbox"
                        className="accent-cyan-500"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                      />
                    </Td>
                    <Td>
                      <div className="text-cyan-100 font-medium break-words">{p.name || "—"}</div>
                      <div className="text-xs text-cyan-300/60">{COUNTRY_NAME[p.country] || p.country || "—"}</div>
                      <div className="text-[10px] text-cyan-300/40">{p.id}</div>
                      <button
                        type="button"
                        onClick={() => toggleSites(p.id)}
                        className="mt-1 text-[11px] text-cyan-300/80 underline hover:text-cyan-200"
                      >
                        {expanded ? "Hide sites" : "View sites"}
                      </button>
                    </Td>
                    <Td>{policyText(p)}</Td>
                    <Td numeric>{fmtNum(m.evc)}</Td>
                    <Td numeric>{fmtNum(m.batteries)}</Td>
                    <Td numeric>{fmtNum(m.cp)}</Td>
                    <Td numeric>{fmtCC(m.totalCC)}</Td>
                    <Td numeric>{fmtCC(m.periodCC)}</Td>
                    <Td numeric>{fmtCC(m.dailyAvg)}</Td>
                    <Td>{m.certDate ? fmtDate(m.certDate) : "—"}</Td>
                  </tr>

                  {expanded && (
                    <tr className="border-b border-cyan-800/30 bg-cyan-900/10">
                      <Td colSpan={10}>
                        {!state || state.loading ? (
                          <div className="py-2 text-xs text-cyan-200">Loading sites…</div>
                        ) : state.error ? (
                          <div className="py-2 text-xs text-red-300">Error loading sites: {state.error}</div>
                        ) : !state.rows.length ? (
                          <div className="py-2 text-xs text-cyan-300/80">
                            No site-level CC runs found for the open period.
                          </div>
                        ) : (
                          <table className="w-full text-xs border border-cyan-800/50 mt-1">
                            <thead className="bg-cyan-950/60">
                              <tr>
                                <th className="px-2 py-1 text-left text-cyan-200">Site ID</th>
                                <th className="px-2 py-1 text-right text-cyan-200">CC (current period, tCO₂e)</th>
                                <th className="px-2 py-1 text-left text-cyan-200">Last run</th>
                              </tr>
                            </thead>
                            <tbody>
                              {state.rows.map((row) => (
                                <tr key={row.site_id} className="border-t border-cyan-800/50">
                                  <td className="px-2 py-1 text-cyan-100">{row.site_id}</td>
                                  <td className="px-2 py-1 text-right text-cyan-100">
                                    {row.period_total_tonnes_co2e != null
                                      ? row.period_total_tonnes_co2e.toFixed(3)
                                      : "0.000"}
                                  </td>
                                  <td className="px-2 py-1 text-cyan-200">{row.last_run_at || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </Td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {currentRows.length === 0 && !loading && (
              <tr>
                <Td colSpan={10}>
                  <div className="py-6 text-cyan-300/70">No projects found.</div>
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            className="px-3 py-1 rounded border border-cyan-700 text-cyan-200 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </button>
          <div className="text-sm text-cyan-300/80">
            Page <span className="text-cyan-100">{page}</span> of{" "}
            <span className="text-cyan-100">{totalPages}</span>
          </div>
          <button
            className="px-3 py-1 rounded border border-cyan-700 text-cyan-200 disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- UI helpers ---------------- */

function DashCard({ label, value, fmt, className = "" }) {
  const display = fmt === "cc" ? fmtCC(value) : fmtNum(value);
  return (
    <div className={`rounded border border-cyan-700/40 bg-cyan-900/5 p-4 ${className}`}>
      <div className="text-xs text-cyan-300/70">{label}</div>
      <div className="text-2xl">{display}</div>
    </div>
  );
}

function Th({ children, numeric }) {
  return <th className={`text-left py-2 px-2 ${numeric ? "text-right" : ""}`}>{children}</th>;
}

function Td({ children, numeric, colSpan }) {
  return (
    <td className={`py-2 px-2 align-top ${numeric ? "text-right" : ""}`} colSpan={colSpan}>
      {children}
    </td>
  );
}

function fmtNum(v) {
  if (v == null) return "—";
  const x = Number(v);
  if (Number.isNaN(x)) return "—";
  return x.toLocaleString();
}

function fmtCC(v) {
  if (v == null) return "—";
  const x = Number(v);
  if (Number.isNaN(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtDate(v) {
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(v);
  }
}
