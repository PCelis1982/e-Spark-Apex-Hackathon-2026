// src/routes/ep/pages/EpCreatePage.jsx

import React from "react";
import { useNavigate } from "react-router-dom";
import { ccsGet, ccsPost } from "@/lib/ccsClient";
import { countryToTrack } from "./lib/redTracks";

/** EU(+UK/CH/NO/IS/LI) — name shown, ISO-2 stored */
const COUNTRIES = [
  ["AT","Austria"],["BE","Belgium"],["BG","Bulgaria"],["HR","Croatia"],["CY","Cyprus"],
  ["CZ","Czechia"],["DK","Denmark"],["EE","Estonia"],["FI","Finland"],["FR","France"],
  ["DE","Germany"],["GR","Greece"],["HU","Hungary"],["IS","Iceland"],["IE","Ireland"],
  ["IT","Italy"],["LV","Latvia"],["LI","Liechtenstein"],["LT","Lithuania"],["LU","Luxembourg"],
  ["MT","Malta"],["NL","Netherlands"],["NO","Norway"],["PL","Poland"],["PT","Portugal"],
  ["RO","Romania"],["SK","Slovakia"],["SI","Slovenia"],["ES","Spain"],["SE","Sweden"],
  ["CH","Switzerland"],["GB","United Kingdom"],
];
const CODE_TO_NAME = Object.fromEntries(COUNTRIES);

const DEFAULT_TZ = {
  AT:"Europe/Vienna", BE:"Europe/Brussels", BG:"Europe/Sofia", HR:"Europe/Zagreb",
  CY:"Asia/Nicosia", CZ:"Europe/Prague", DK:"Europe/Copenhagen", EE:"Europe/Tallinn",
  FI:"Europe/Helsinki", FR:"Europe/Paris", DE:"Europe/Berlin", GR:"Europe/Athens",
  HU:"Europe/Budapest", IS:"Atlantic/Reykjavik", IE:"Europe/Dublin", IT:"Europe/Rome",
  LV:"Europe/Riga", LI:"Europe/Vaduz", LT:"Europe/Vilnius", LU:"Europe/Luxembourg",
  MT:"Europe/Malta", NL:"Europe/Amsterdam", NO:"Europe/Oslo", PL:"Europe/Warsaw",
  PT:"Europe/Lisbon", RO:"Europe/Bucharest", SK:"Europe/Bratislava", SI:"Europe/Ljubljana",
  ES:"Europe/Madrid", SE:"Europe/Stockholm", CH:"Europe/Zurich", GB:"Europe/London",
};

const PERIOD_LENGTHS = [
  { id: "MONTHLY", label: "Monthly" },
  { id: "QUARTERLY", label: "Quarterly" },
  { id: "ANNUAL", label: "Annual" },
];

/**
 * ✅ Claim “families” (what user selects)
 * The real backend value goes in policy.track
 */
const CLAIM_FAMILIES = [
  { id: "REDIII", label: "REDIII (Transport / RTFO style)" },
  { id: "GO", label: "Guarantees of Origin" },
  { id: "VCM", label: "Carbon credits (VCM) — Verra VM0038" },
  { id: "ENERGY", label: "Energy performance (core MRV)" },
];

/**
 * ✅ Calc versions per family/track (keep these simple unless backend enforces)
 * - For REDIII we’ll use a generic version by default; you can refine later.
 */
const DEFAULT_CALC_VERSION = {
  REDIII: "REDIII_v1",
  GO: "GO_v1",
  VCM: "VM0038_v1",
  ENERGY: "ENERGY_v1",
};

const VERSIONS_BY_FAMILY = {
  REDIII: ["REDIII_v1"],
  GO: ["GO_v1"],
  VCM: ["VM0038_v1"],
  ENERGY: ["ENERGY_v1"],
};

function StatusBadge({ status }) {
  const map = {
    DRAFT: "bg-amber-900/40 text-amber-300",
    ONBOARDING: "bg-blue-900/40 text-blue-300",
    ACTIVE: "bg-emerald-900/30 text-emerald-300",
    SUSPENDED: "bg-red-900/40 text-red-300",
    OFFBOARDING: "bg-purple-950/40 text-purple-200",
    ARCHIVED: "bg-zinc-700/40 text-zinc-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${map[status] || "bg-zinc-700/40"}`}>
      {String(status || "").toUpperCase() || "UNKNOWN"}
    </span>
  );
}

function CreatedProjectCard({ p, onUpdate }) {
  const policyTrackId = p?.policy?.track;
  const calcVer = p?.policy?.calc_version || "—";
  const countryName = CODE_TO_NAME[p?.country] || p?.country || "—";

  return (
    <div className="rounded border border-cyan-700/40 bg-cyan-900/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-lg md:text-xl font-semibold">{p?.name || "—"}</div>
        <StatusBadge status={p?.status} />
      </div>

      <div className="text-sm text-cyan-300/80 mt-2 space-y-1">
        <div>Organisation: <span className="text-cyan-100">{p?.organization_id || "—"}</span></div>
        <div>Country: <span className="text-cyan-100">{countryName}</span></div>
        <div>Project name: <span className="text-cyan-100">{p?.name || "—"}</span></div>
        <div>ProjectID: <span className="text-cyan-100">{p?.id || "—"}</span></div>
        <div>Policy: <span className="text-cyan-100">{policyTrackId || "—"} · {calcVer}</span></div>
      </div>

      <div className="mt-4">
        <button onClick={onUpdate} className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500">
          Update Project
        </button>
      </div>
    </div>
  );
}

export default function EpCreatePage() {
  const navigate = useNavigate();

  const [form, setForm] = React.useState({
    organization_id: "org_demo_002",
    name: "",
    country: "IE",

    // user-facing claim family
    claim_family: "REDIII",

    // persisted policy fields
    policy_track: countryToTrack("IE"),         // e.g. EU_RED_IE
    calc_version: DEFAULT_CALC_VERSION.REDIII,  // e.g. REDIII_v1

    tz: DEFAULT_TZ["IE"],
    period_length: "QUARTERLY",
    first_closing_date: "",
  });

  const [submitting, setSubmitting] = React.useState(false);
  const [created, setCreated] = React.useState(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => { (async () => { try { await ccsGet("/debug/whoami"); } catch {} })(); }, []);

  function change(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setFamily(family) {
    // update track + calc defaults when user changes claim family
    if (family === "REDIII") {
      change("claim_family", family);
      change("policy_track", countryToTrack(form.country));
      change("calc_version", DEFAULT_CALC_VERSION.REDIII);
      return;
    }
    if (family === "GO") {
      change("claim_family", family);
      change("policy_track", "GO");
      change("calc_version", DEFAULT_CALC_VERSION.GO);
      return;
    }
    if (family === "VCM") {
      change("claim_family", family);
      change("policy_track", "VCM");
      change("calc_version", DEFAULT_CALC_VERSION.VCM);
      return;
    }
    // ENERGY
    change("claim_family", family);
    change("policy_track", "ENERGY");
    change("calc_version", DEFAULT_CALC_VERSION.ENERGY);
  }

  function onCountryChange(code) {
    change("country", code);
    change("tz", DEFAULT_TZ[code] || "UTC");

    // if current family is REDIII, track should follow the country
    if (form.claim_family === "REDIII") {
      change("policy_track", countryToTrack(code));
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setCreated(null);

    try {
      const body = {
        organization_id: form.organization_id.trim(),
        name: form.name.trim(),
        country: form.country.trim().toUpperCase(),
        status: "draft",
        policy: {
          track: form.policy_track,
          calc_version: form.calc_version,
          tz: form.tz,
        },
        period_length: form.period_length,
        first_closing_date: form.first_closing_date || undefined,
      };

      const proj = await ccsPost("/projects", body);

      let latest = proj;
      try { latest = await ccsGet(`/projects/${proj?.id}`); } catch {}
      setCreated(latest || proj);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setSubmitting(false);
    }
  }

  const versions = VERSIONS_BY_FAMILY[form.claim_family] || [];

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-3xl font-semibold mb-6">Create Project</h1>

      {error && (
        <div className="rounded border border-red-500/50 bg-red-900/20 p-3 text-red-200">
          {error}
        </div>
      )}

      {created && (
        <CreatedProjectCard
          p={created}
          onUpdate={() => navigate(`/projects/ep/update/${created.id}`)}
        />
      )}

      {!created && (
        <form className="grid grid-cols-1 gap-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm text-cyan-300 mb-1">Organization ID</label>
            <input
              className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
              value={form.organization_id}
              onChange={(e) => change("organization_id", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-cyan-300 mb-1">Project Name</label>
              <input
                className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
                value={form.name}
                onChange={(e) => change("name", e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-cyan-300 mb-1">Country</label>
              <select
                className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
                value={form.country}
                onChange={(e) => onCountryChange(e.target.value)}
              >
                {COUNTRIES.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ✅ NEW: Claim family selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-cyan-300 mb-1">Claim type</label>
              <select
                className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
                value={form.claim_family}
                onChange={(e) => setFamily(e.target.value)}
              >
                {CLAIM_FAMILIES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-cyan-300 mb-1">Policy track (stored)</label>
              <input
                className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
                value={form.policy_track}
                onChange={(e) => change("policy_track", e.target.value)}
              />
              <div className="text-[11px] text-cyan-300/60 mt-1">
                For REDIII this follows the country automatically.
              </div>
            </div>

            <div>
              <label className="block text-sm text-cyan-300 mb-1">Calc Version</label>
              <select
                className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
                value={form.calc_version}
                onChange={(e) => change("calc_version", e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-cyan-300 mb-1">Time Zone</label>
              <input
                className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
                value={form.tz}
                onChange={(e) => change("tz", e.target.value)}
                placeholder="e.g. Europe/Dublin"
              />
            </div>

            <div>
              <label className="block text-sm text-cyan-300 mb-1">Period length</label>
              <select
                className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
                value={form.period_length}
                onChange={(e) => change("period_length", e.target.value)}
              >
                {PERIOD_LENGTHS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-cyan-300 mb-1">First closing date</label>
              <input
                type="date"
                className="w-full bg-black/40 border border-cyan-700 rounded px-3 py-2"
                value={form.first_closing_date}
                onChange={(e) => change("first_closing_date", e.target.value)}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              disabled={submitting}
              className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create Project"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
