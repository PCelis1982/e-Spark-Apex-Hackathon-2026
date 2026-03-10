// src/routes/ep/pages/claims/EpClaimsVcmPage.jsx

import React from "react";
import EpManagePage from "../EpManagePage";

export default function EpClaimsVcmPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">
          Claims orchestration — Carbon credits (VCM)
        </h1>
      </div>

      <EpManagePage
        defaultClaim="VCM"
        hideHeader
        projectFilter={(p) => {
          const t = p?.policy?.track || p?.policy_track || p?.track || "";
          const v = String(t).toUpperCase();
          return v.includes("VCM") || v.includes("CARBON") || v === "CC";
        }}
      />
    </div>
  );
}
