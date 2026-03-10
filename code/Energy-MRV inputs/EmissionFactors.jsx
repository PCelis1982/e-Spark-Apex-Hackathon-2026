import React from "react";
import { useOutletContext } from "react-router-dom";
import { ccsGet, authHeaders } from "@/lib/ccsClient";

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
  if (!res.ok) throw new Error(text || `Upload failed: ${res.status}`);

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
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

export default function EmissionFactors() {
  const ctx = useOutletContext() || {};
  const project = ctx.project || null;
  const projectId = project?.id || ctx.projectId || null;

  if (!projectId) {
    return (
      <div className="text-sm text-red-300">
        EmissionFactors: no <code>projectId</code> in outlet context.
      </div>
    );
  }

  const projectActive =
    String(project?.status || ctx.projectStatus || "draft").toLowerCase() ===
    "active";

  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [nonce, setNonce] = React.useState(0);
  const refresh = () => setNonce((n) => n + 1);

  React.useEffect(() => {
    let on = true;

    (async () => {
      setLoading(true);
      setErr("");
      setRows([]);
      try {
        const list = await ccsGet(`/projects/${projectId}/usage`);
        if (!on) return;
        const all = Array.isArray(list) ? list : [];
        setRows(all.filter((r) => r.type === "ef"));
      } catch (e) {
        if (!on) return;
        setErr(String(e?.message || e));
      } finally {
        if (on) setLoading(false);
      }
    })();

    return () => {
      on = false;
    };
  }, [projectId, nonce]);

  async function pickEF(file) {
    if (!file) return;
    try {
      await uploadMultipart(`/projects/${projectId}/ef:upload`, file);
      refresh();
    } catch (e) {
      alert(String(e?.message || e));
    }
  }

  async function handleDelete(fileId) {
    if (!fileId) return;
    const ok = window.confirm("Delete this EF upload?");
    if (!ok) return;
    try {
      await deleteUpload(projectId, fileId);
      refresh();
    } catch (e) {
      alert(String(e?.message || e));
    }
  }

  return (
    <div className="rounded border border-cyan-700/40 bg-cyan-900/5 p-4">
      {!projectActive && (
        <div className="mb-3 text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded px-3 py-2">
          Uploads are disabled while the project is{" "}
          <b>{project?.status || ctx.projectStatus || "draft"}</b>.
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="text-cyan-200 font-medium">Emission Factors</div>
        <UploadBtn
          label="Upload Emission Factors"
          accept=".csv,.xlsx"
          onPick={pickEF}
          disabled={!projectActive}
        />
      </div>

      {loading && <div className="text-cyan-300/70">Loading…</div>}
      {err && <div className="text-red-300">{err}</div>}

      {!loading && !err && rows.length === 0 && (
        <div className="text-cyan-300/70">No Emission Factors uploads yet.</div>
      )}

      {!loading && !err && rows.length > 0 && (
        <Section title="EF files" rows={rows} onDelete={handleDelete} />
      )}

      <div className="text-xs text-cyan-300/60 mt-3">
        Project: {project?.name || "—"} ({projectId})
      </div>
    </div>
  );
}
