// src/routes/ep/pages/EpUpdatePage.jsx  

import React from "react";
import { useNavigate } from "react-router-dom";
import { ccsGet } from "@/lib/ccsClient";
import StatusBadge from "@/components/StatusBadge";

const TRACK_LABEL = {
   VERRA_VCS: "VERRA VM0038",
  GO: "Guarantees of Origin",
  ENERGY: "Energy performance",
  EU_RED_AT: "REDIII (AT)",
  EU_RED_DE: "REDIII (DE)",
  EU_RED_IE: "REDIII / RTFO (IE)",

};

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

function ProjectCard({ p, onOpen }) {
  const policyTrack = p?.policy?.track || "";
  const policyCalc = p?.policy?.calc_version || "";
  const policy = policyTrack
    ? `${TRACK_LABEL[policyTrack] || policyTrack}${
        policyCalc ? ` · ${policyCalc}` : ""
      }`
    : "—";

  const country = COUNTRY_NAME[p?.country] || p?.country || "—";
  const org = p?.organization_id || "—";
  const id = p?.id || "—";

  return (
    <div className="rounded border border-cyan-700/40 bg-cyan-900/5 p-4 hover:bg-cyan-900/10 transition flex flex-col min-h-[220px]">
      {/* Title + status under it */}
      <div className="mb-1">
        <div className="text-lg font-semibold leading-tight break-words">
          {p?.name || "—"}
        </div>
        <div className="mt-1">
          <StatusBadge status={p?.status} />
        </div>
      </div>

      {/* Details */}
      <div className="text-sm text-cyan-300/90 mt-2 space-y-0.5 flex-1">
        <div>
          Organisation: <span className="text-cyan-100">{org}</span>
        </div>
        <div>
          Country: <span className="text-cyan-100">{country}</span>
        </div>
        <div>
          ProjectID: <span className="text-cyan-100">{id}</span>
        </div>
        <div>
          Policy: <span className="text-cyan-100">{policy}</span>
        </div>
      </div>

      {/* Footer with Open aligned bottom-right */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => onOpen(p)}
          className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500"
        >
          Open
        </button>
      </div>
    </div>
  );
}

export default function EpUpdatePage() {
  const nav = useNavigate();
  const [org, setOrg] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState([]);
  const [err, setErr] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const PAGE_SIZE = 8;
  const [page, setPage] = React.useState(1);

  function applyFilters(list) {
    return (list || []).filter((p) => {
      if (org && p.organization_id !== org) return false;
      if (country && p.country !== country) return false;
      if (q) {
        const s = `${p.name} ${p.id}`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }

  async function search() {
    setLoading(true);
    setErr("");
    setRows([]);
    setPage(1);

    try {
      const looksLikeId = q && /^[A-Za-z0-9_-]{12,}$/.test(q);
      if (looksLikeId) {
        try {
          const one = await ccsGet(`/projects/${q}`);
          setRows(one ? [one] : []);
          setLoading(false);
          return;
        } catch {
          // ignore and fall back to list search
        }
      }

      let url = `/projects/search?limit=200`;
      if (org) url += `&org=${encodeURIComponent(org)}`;
      if (country) url += `&country=${encodeURIComponent(country)}`;
      if (q) url += `&q=${encodeURIComponent(q)}`;

      let list = [];
      try {
        list = await ccsGet(url);
      } catch (e) {
        try {
          const all = await ccsGet(`/projects`);
          list = applyFilters(all);
        } catch (e2) {
          setErr(
            String(e2?.message || e?.message || "Search failed while loading projects.")
          );
        }
      }
      setRows(list || []);
    } finally {
      setLoading(false);
    }
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const current = rows.slice(start, start + PAGE_SIZE);

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-semibold mb-6">Project Updates</h1>

      {/* Search form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-sm text-cyan-300/70 mb-1">
            Organisation
          </label>
          <input
            className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
            placeholder="e.g. org_demo_001"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-cyan-300/70 mb-1">
            Country
          </label>
          <select
            className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            {COUNTRIES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-cyan-300/70 mb-1">
            Project Name or Project ID
          </label>
          <input
            className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
            placeholder="Type a name or paste an ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={search}
        className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500"
        disabled={loading}
      >
        {loading ? "Searching…" : "Search"}
      </button>

      {err && (
        <div className="mt-3 rounded border border-red-500/50 bg-red-900/20 p-3 text-red-200">
          {err}
        </div>
      )}

      {/* Cards grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {current.map((p) => (
          <ProjectCard
            key={p.id}
            p={p}
            onOpen={(proj) => nav(`/projects/ep/update/${proj.id}`)}
          />
        ))}
      </div>

      {!loading && rows.length === 0 && !err && (
        <div className="mt-6 text-cyan-300/70">No projects found.</div>
      )}

      {/* Pagination */}
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
