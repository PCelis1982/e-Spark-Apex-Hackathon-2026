// src/routes/ep/pages/tabs/MonthlyPack.jsx

import React from "react";
import { useOutletContext } from "react-router-dom";

export default function MonthlyPack() {
  const ctx = useOutletContext() || {};
  const project = ctx.project || null;
  const projectId = project?.id || ctx.projectId || "—";

  return (
    <div className="rounded border border-cyan-700/40 bg-cyan-900/5 p-4">
      <div className="text-cyan-200 font-medium">Monthly pack</div>

      <div className="mt-2 text-sm text-cyan-300/70">
        Project: <span className="text-cyan-100">{project?.name || "—"}</span>{" "}
        (<span className="text-cyan-100">{projectId}</span>)
      </div>

      <div className="mt-4 text-sm text-cyan-300/70">
        Next: validations + issues list + “Close month” flow.
      </div>
    </div>
  );
}