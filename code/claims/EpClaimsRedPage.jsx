// src/routes/ep/pages/claims/EpClaimsRedPage.jsx

import React from "react";
import EpManagePage from "../EpManagePage";

export default function EpClaimsRedPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Claims orchestration — REDIII</h1>
      </div>

      <EpManagePage
        defaultClaim="EU_RED_IE"
        hideHeader
        projectFilter={(p) => {
          const t = p?.policy?.track || p?.policy_track || p?.track || "";
          return String(t).toUpperCase().startsWith("EU_RED_");
        }}
      />
    </div>
  );
}
