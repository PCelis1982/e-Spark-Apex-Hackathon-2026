# ADR-001 — Energy as the Primary Claim Substrate

## Status
Accepted

## Date
2026-02-06

## Authors
- e-Spark Product & Architecture Team

---

## 1. Context

All regulatory and market-based claims relevant to e-Performance (REDIII, RTFO, Guarantees of Origin, and future carbon credit methodologies) ultimately depend on **energy delivered or consumed** over time.

While some regimes express outcomes in CO₂-equivalent terms (e.g. voluntary carbon markets), others are explicitly **energy-based** (e.g. REDIII / RTFO, GO schemes). Mixing these concepts too early in the data model introduces ambiguity, increases regulatory risk, and makes double counting harder to prevent.

The current implementation focus (Irish REDIII / RTFO) is strictly based on **energy output**, with certificates derived from verified energy volumes, not from avoided emissions.

A clear architectural decision is therefore required on what constitutes the **primary, irreducible unit of truth** within e-Performance.

---

## 2. Decision

### 2.1 Primary substrate

**Energy is the primary claim substrate in e-Performance.**

- Canonical internal representation: **kilowatt-hours (kWh)**
- Regulatory conversion unit: **megajoules (MJ)**
- Fixed conversion factor: **1 kWh = 3.6 MJ**

All performance records, reconciliations, and claims must be traceable back to an underlying quantity of energy.

---

### 2.2 Role of emissions and carbon

- CO₂, CO₂e, and emission reductions are **derived attributes**, not primary records.
- Carbon calculations may only be performed **on top of verified energy performance**.
- No claim may be generated directly from emissions data without a corresponding energy basis.

This applies to both compliance and voluntary market solutions.

---

### 2.3 Scope of application

This decision applies to:
- REDIII / RTFO modules
- Guarantee of Origin validation
- Future carbon credit methodologies
- Any future performance-based claim modules added to e-Performance

---

## 3. Alternatives Considered

### Alternative A — CO₂ as the primary substrate
- Use emissions or avoided emissions as the foundational unit.

**Rejected** because:
- REDIII and GO regimes are energy-based;
- emission factors change over time and by source;
- it obscures the audit trail back to physical reality;
- it increases the risk of regulatory non-compliance.

---

### Alternative B — Dual primary substrates (energy + CO₂)
- Treat energy and emissions as equal foundational records.

**Rejected** because:
- it creates ambiguity in reconciliation and locking;
- it complicates double-counting prevention;
- it makes cross-regime extensibility harder.

---

## 4. Consequences

### Positive
- Single, regulator-neutral source of truth.
- Clear auditability back to meters and sessions.
- Straightforward extension to GO and RED modules.
- Carbon logic becomes modular and replaceable.

### Trade-offs
- Requires explicit conversion steps for carbon markets.
- Forces discipline in calculator design.

---

## 5. Implications for Architecture & Data Model

- Core performance entities store energy in **kWh**.
- Aggregations (daily, monthly) operate on energy values.
- Claims reference energy snapshots, not raw emissions.
- Emission factors, grid intensity, and CO₂ outputs are stored as **derived artefacts**.

---

## 6. Implications for REDIII / RTFO

- Certificate calculations are based on verified energy volumes.
- Conversion to MJ is deterministic and auditable.
- No CO₂-based optimisation or substitution is permitted within REDIII modules.

---

## 7. Reversibility

- **Low**.

Changing the primary substrate would require:
- reworking the entire data model;
- invalidating reconciliation logic;
- reinterpreting regulatory narratives.

This decision is foundational.

---

## 8. Related ADRs

- ADR-000 — Product Identity & Scope (e-Performance)
- ADR-002 — Two-Stream MRV Model
- ADR-003 — Reconciliation & Tolerance Rules
- ADR-004 — Claim Isolation & Double-Counting Prevention

---

## 9. References

- REDIII / RTFO (NORA) methodology and guidance
- e-Spark MRV & Reconciliation specifications
- e-Spark CC Solution — Context Pack

