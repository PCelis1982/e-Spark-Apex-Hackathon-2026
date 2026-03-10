// src/routes/ep/pages/claims/EpClaimsGoPage.jsx

import React from "react";
import EpManagePage from "../EpManagePage";

export default function EpClaimsGoPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">
          Claims orchestration — Guarantees of Origin
        </h1>
      </div>

      <EpManagePage
        defaultClaim="GO"
        hideHeader
        projectFilter={(p) => {
          const t = p?.policy?.track || p?.policy_track || p?.track || "";
          const v = String(t).toUpperCase();
          return v.includes("GO") || v.includes("REGO") || v.includes("GUARANTEE");
        }}
      />
    </div>
  );
}
