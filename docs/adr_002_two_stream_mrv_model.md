# ADR-002 — Two-Stream MRV Model

## Status
Accepted

## Date
2026-02-06

## Authors
- e-Spark Product & Architecture Team

---

## 1. Context

Energy-sector claims (REDIII, RTFO, Guarantees of Origin, future carbon methodologies) require a level of assurance that cannot be met by a single data source alone.

In practice, two distinct but complementary sources of truth exist:

1. **Regulatory-grade metering data** (e.g. DSO/TSO meters, ESB, certified submeters)
2. **Operational performance data** (e.g. EV charging sessions, asset telemetry, EMS outputs)

Each stream has different strengths and weaknesses:

- Meter data is authoritative for settlement and regulation, but:
  - is often delayed;
  - lacks operational context;
  - may not align perfectly with asset-level usage.

- Operational data is granular and timely, but:
  - is not always regulator-certified;
  - may contain gaps or noise;
  - cannot alone support statutory claims.

A single-stream approach creates unacceptable risk, either:
- regulatory risk (if relying only on operational data), or
- performance opacity (if relying only on meters).

---

## 2. Decision

### 2.1 Two-stream MRV model

e-Performance shall implement a **Two-Stream MRV (Measurement, Reporting, Verification) model**, consisting of:

- **Meter Stream (Regulatory Stream)**
  - Certified electricity meters
  - Grid or supplier-grade readings
  - Regulatory anchor for energy quantities

- **Operational Stream (Performance Stream)**
  - Asset-level usage data (e.g. EV charging sessions)
  - High-frequency, high-context telemetry
  - Operational evidence of energy use

Neither stream is sufficient on its own. Claims require both.

---

### 2.2 Roles of each stream

- The **Meter Stream** defines the *maximum energy available* for claims within a reporting period.
- The **Operational Stream** explains *how and where* that energy was used.

Claims may only be generated when:
- both streams are present;
- both streams are internally consistent;
- reconciliation rules are satisfied.

---

### 2.3 Temporal alignment

- Meter data and operational data must be aligned to a common reporting period (e.g. calendar month for REDIII).
- Ingestion may occur at different times, but reconciliation is performed only once both streams are complete for the period.

---

### 2.4 Reconciliation gate

A **reconciliation gate** is mandatory before any claim is produced:

- Energy quantities from both streams are compared;
- Differences are evaluated against defined tolerances;
- Outcomes are explicitly classified (pass, conditional pass, fail).

No downstream claim logic may bypass this gate.

---

## 3. Alternatives Considered

### Alternative A — Meter-only model
- Use regulatory meters as the sole source of truth.

**Rejected** because:
- it provides no asset-level attribution;
- it obscures operational anomalies;
- it limits future extension to carbon and GO use cases.

---

### Alternative B — Operational-only model
- Use sessions or telemetry as the sole source of truth.

**Rejected** because:
- it is not regulator-grade;
- it fails statutory audit requirements;
- it weakens trust with verifiers.

---

## 4. Consequences

### Positive
- Strong regulatory defensibility.
- Clear audit narrative (meter → operations → claim).
- Early detection of data issues and losses.
- Reusable across REDIII, GO, and carbon modules.

### Trade-offs
- Increased system complexity.
- Requires reconciliation logic and failure handling.
- Requires disciplined data governance.

---

## 5. Implications for Architecture & Data Model

- Separate ingestion pipelines for meter data and operational data.
- Explicit linkage between streams via site, asset, and period identifiers.
- Reconciliation artefacts stored as first-class entities.
- Claims reference reconciliation results, not raw data.

---

## 6. Implications for REDIII / RTFO

- Meter data is the statutory anchor for energy volumes.
- Operational data provides supporting evidence and attribution.
- Monthly reconciliation is mandatory before RTFO reporting.

---

## 7. Reversibility

- **Medium to Low**.

While individual reconciliation rules may evolve, abandoning the two-stream model would:
- reduce regulatory credibility;
- weaken auditability;
- constrain future modules.

---

## 8. Related ADRs

- ADR-000 — Product Identity & Scope (e-Performance)
- ADR-001 — Energy as the Primary Claim Substrate
- ADR-003 — Reconciliation & Tolerance Rules
- ADR-004 — Claim Isolation & Double-Counting Prevention

---

## 9. References

- REDIII / RTFO (NORA) methodology and guidance
- e-Spark MRV & Reconciliation specifications
- e-Spark CC Solution — Context Pack

