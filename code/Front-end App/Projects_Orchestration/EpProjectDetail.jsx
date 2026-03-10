  //src/routes/ep/pages/EpProjectDetail.jsx

import React from "react";
import {
  useParams,
  useLocation,
  useNavigate,
  Outlet,
  useOutletContext,
} from "react-router-dom";
import { ccsGet, ccsPatch } from "@/lib/ccsClient";
import StatusBadge from "@/components/StatusBadge";

/** Track labels strictly for display */
const TRACK_LABEL = {
  VERRA_VCS: "VERRA VM0038",
  GO: "Guarantees of Origin",
  ENERGY: "Energy performance",
  EU_RED_AT: "REDIII (AT)",
  EU_RED_DE: "REDIII (DE)",
  EU_RED_IE: "REDIII / RTFO (IE)",
};

/** EU(+UK/CH/NO/IS/LI) — name shown, ISO-2 stored */
const COUNTRIES = [
  ["", "Any"],
  ["AT", "Austria"],
  ["BE", "Belgium"],
  ["BG", "Bulgaria"],
  ["HR", "Croatia"],
  ["CY", "Cyprus"],
  ["CZ", "Czechia"],
  ["DK", "Denmark"],
  ["EE", "Estonia"],
  ["FI", "Finland"],
  ["FR", "France"],
  ["DE", "Germany"],
  ["GR", "Greece"],
  ["HU", "Hungary"],
  ["IS", "Iceland"],
  ["IE", "Ireland"],
  ["IT", "Italy"],
  ["LV", "Latvia"],
  ["LI", "Liechtenstein"],
  ["LT", "Lithuania"],
  ["LU", "Luxembourg"],
  ["MT", "Malta"],
  ["NL", "Netherlands"],
  ["NO", "Norway"],
  ["PL", "Poland"],
  ["PT", "Portugal"],
  ["RO", "Romania"],
  ["SK", "Slovakia"],
  ["SI", "Slovenia"],
  ["ES", "Spain"],
  ["SE", "Sweden"],
  ["CH", "Switzerland"],
  ["GB", "United Kingdom"],
];

const COUNTRY_NAME = Object.fromEntries(
  COUNTRIES.filter(([c]) => c).map(([c, n]) => [c, n])
);

const VALID_STATUS = ["DRAFT", "ONBOARDING", "ACTIVE", "SUSPENDED", "OFFBOARDING", "ARCHIVED"];

export default function EpProjectDetail() {
  const { pid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [project, setProject] = React.useState(null);
  const [status, setStatus] = React.useState("DRAFT");
  const [loading, setLoading] = React.useState(true);
  const [savingStatus, setSavingStatus] = React.useState(false);
  const [error, setError] = React.useState("");

  // --- load project -------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!pid) return;
      setLoading(true);
      setError("");
      try {
        const p = await ccsGet(`/projects/${pid}`);
        if (cancelled) return;
        setProject(p);
        setStatus((p.status || "draft").toLowerCase());
      } catch (e) {
        if (cancelled) return;
        console.error("[EpProjectDetail] failed to load project", e);
        setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [pid]);

  // --- status update ------------------------------------------------------
  async function handleStatusChange(e) {
    if (!project) return;
    const newStatus = e.target.value;
    setStatus(newStatus);
    setSavingStatus(true);
    setError("");

    try {
      const updated = await ccsPatch(`/projects/${project.id}`, {
        status: newStatus,
      });
      setProject(updated);
      setStatus((updated.status || newStatus).toLowerCase());
    } catch (err) {
      console.error("Failed to update project status", err);
      setError(String(err?.message || err));
      setStatus(project.status || "draft"); // revert
    } finally {
      setSavingStatus(false);
    }
  }

  // --- tab logic (URL-driven) --------------------------------------------
  const basePath = `/projects/ep/update/${pid}`;

  const segments = location.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];

  let activeTab = "stations";
  if (last === "evcs") activeTab = "evcs";
  else if (last === "usage") activeTab = "usage";
  else if (last === "ef") activeTab = "ef";
  // when URL is exactly /projects/ep/update/:pid, last === pid → default to "stations"

  const goTab = (tab) => {
    if (!pid) return;
    if (tab === "stations") navigate(`${basePath}/stations`);
    else if (tab === "evcs") navigate(`${basePath}/evcs`);
    else if (tab === "usage") navigate(`${basePath}/usage`);
    else if (tab === "ef") navigate(`${basePath}/ef`);
  };

  // --- loading / error shells --------------------------------------------
  if (loading && !project) {
    return (
      <div className="max-w-6xl">
        <h2 className="text-2xl mb-4">e-Performance - Project updates</h2>
        <div>Loading project…</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-6xl">
        <h2 className="text-2xl mb-4">e-Performance - Project updates</h2>
        {error ? (
          <div className="rounded border border-red-500/50 bg-red-900/20 p-3 text-red-200">
            {error}
          </div>
        ) : (
          <div>Project not found.</div>
        )}
      </div>
    );
  }

  // --- derived display fields --------------------------------------------
  const policyTrack = project?.policy?.track || "";
  const policyCalc = project?.policy?.calc_version || "";
  const policyLabel = policyTrack
    ? `${TRACK_LABEL[policyTrack] || policyTrack}${
        policyCalc ? ` · ${policyCalc}` : ""
      }`
    : "—";

  const countryLabel = COUNTRY_NAME[project.country] || project.country || "—";

  // --- layout -------------------------------------------------------------
  return (
    <div className="max-w-6xl space-y-6">
      <h2 className="text-2xl mb-2">e-Performance — Project updates</h2>

      {error && (
        <div className="rounded border border-red-500/50 bg-red-900/20 p-3 text-red-200">
          {error}
        </div>
      )}

      {/* Header card */}
      <div className="rounded border border-cyan-700/40 bg-cyan-900/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg md:text-xl font-semibold">
              {project.name || "—"}
            </div>
            <div className="mt-2 text-sm text-cyan-300/85 space-y-0.5">
              <div>
                Organisation:{" "}
                <span className="text-cyan-100">
                  {project.organization_id || "—"}
                </span>
              </div>
              <div>
                Country: <span className="text-cyan-100">{countryLabel}</span>
              </div>
              <div>
                Policy: <span className="text-cyan-100">{policyLabel}</span>
              </div>
              <div>
                ProjectID:{" "}
                <span className="text-cyan-100">{project.id || pid}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={project.status} />
            <select
              className="bg-black/40 border border-cyan-700 rounded px-2 py-1 text-sm"
              value={status}
              onChange={handleStatusChange}
              disabled={savingStatus}
            >
              {VALID_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {savingStatus && (
              <div className="text-[10px] text-cyan-300/70">Updating status…</div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => goTab("stations")}
            className={`px-3 py-1.5 rounded text-sm ${
              activeTab === "stations"
                ? "bg-cyan-700 text-white"
                : "bg-cyan-900/20 text-cyan-200 border border-cyan-700/50"
            }`}
          >
            Stations / PPAs
          </button>

          <button
            type="button"
            onClick={() => goTab("evcs")}
            className={`px-3 py-1.5 rounded text-sm ${
              activeTab === "evcs"
                ? "bg-cyan-700 text-white"
                : "bg-cyan-900/20 text-cyan-200 border border-cyan-700/50"
            }`}
          >
            EVCs / Batteries
          </button>

          <button
            type="button"
            onClick={() => goTab("usage")}
            className={`px-3 py-1.5 rounded text-sm ${
              activeTab === "usage"
                ? "bg-cyan-700 text-white"
                : "bg-cyan-900/20 text-cyan-200 border border-cyan-700/50"
            }`}
          >
            Usage / Meter
          </button>

          <button
            type="button"
            onClick={() => goTab("ef")}
            className={`px-3 py-1.5 rounded text-sm ${
              activeTab === "ef"
                ? "bg-cyan-700 text-white"
                : "bg-cyan-900/20 text-cyan-200 border border-cyan-700/50"
            }`}
          >
            Emission Factors
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="rounded border border-cyan-700/40 bg-cyan-900/5 p-4">
        <Outlet context={{ project, projectId: pid }} />
      </div>
    </div>
  );
}

export function useCcProject() {
  return useOutletContext();
}
