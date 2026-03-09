# ADR-004 — Claim Isolation & Double-Counting Prevention

## Status
Accepted

## Date
2026-02-06

## Authors
- e-Spark Product & Architecture Team

---

## 1. Context

The same unit of energy (kWh) may be eligible for different types of claims across regulatory and market regimes, including:

- REDIII / RTFO compliance claims
- Guarantees of Origin (GO)
- Voluntary carbon credit claims
- Future national or sectoral schemes

If not explicitly controlled, a single unit of energy could be:
- claimed under multiple regimes;
- monetised more than once;
- represented inconsistently across registries.

This constitutes **double counting**, which is explicitly prohibited by regulators, registries, and auditors, and represents a critical compliance and reputational risk.

Because e-Performance is designed as a **claims orchestration layer**, it must prevent double counting **by architecture**, not by policy alone.

---

## 2. Decision

### 2.1 Claim isolation principle

Each unit of verified energy within e-Performance **may be allocated to at most one active claim context** at any given time.

A claim context is defined by:
- regime (e.g. REDIII, GO, Carbon);
- jurisdiction (e.g. IE, DE, EU);
- reporting period;
- claim purpose.

Once energy is allocated to a claim context, it is **logically locked**.

---

### 2.2 Energy locking model

- Energy is locked at the **reporting-period level** (e.g. monthly), not at raw ingestion.
- Locking occurs **after successful reconciliation** (ADR-003).
- Locked energy may not be reused by another claim context unless explicitly released.

Locking is enforced by the platform and cannot be bypassed by individual modules.

---

### 2.3 Claim lifecycle

Claims in e-Performance follow a defined lifecycle:

1. **Eligible** — reconciled energy available, not yet allocated
2. **Allocated** — energy assigned to a specific claim context
3. **Issued / Submitted** — claim prepared for external registry or authority
4. **Finalised** — claim accepted, retired, or otherwise closed

Energy remains locked from allocation through finalisation.

---

### 2.4 Cross-regime rules

- Energy allocated to a **REDIII / RTFO** claim may not be reused for:
  - voluntary carbon credits;
  - Guarantees of Origin;
  - other compliance schemes.

- Energy allocated to **GO validation** may not be reused for REDIII or carbon claims unless explicitly permitted by regulation and supported by an ADR.

- Any future exception requires:
  - explicit regulatory allowance;
  - a dedicated ADR documenting the rationale and safeguards.

---

### 2.5 Auditability

- All allocations and locks are recorded as immutable events.
- Each claim references the specific energy volume and period it consumes.
- Audit trails must allow reconstruction of:
  - which energy was used;
  - for which claim;
  - under which rules;
  - at what time.

---

## 3. Alternatives Considered

### Alternative A — Policy-only prevention
- Rely on operational procedures and user discipline.

**Rejected** because:
- it is error-prone;
- it does not scale;
- it fails regulatory expectations.

---

### Alternative B — Post-hoc detection
- Allow claims freely and detect overlaps later.

**Rejected** because:
- damage occurs before detection;
- remediation may be impossible;
- it undermines trust.

---

## 4. Consequences

### Positive
- Strong regulator and auditor confidence.
- Clear separation between regimes.
- Safe extensibility to future modules.
- Enables validator and verifier roles.

### Trade-offs
- Reduced flexibility in monetisation strategies.
- Requires careful claim orchestration design.

---

## 5. Implications for Architecture & Data Model

- Claim context is a first-class entity.
- Energy snapshots track allocation state.
- Platform enforces exclusive locks.
- Modules cannot override allocation rules.

---

## 6. Implications for REDIII / RTFO

- Energy used for RTFO certificates is permanently locked for that period.
- Double claiming across schemes is structurally prevented.
- Audit evidence is deterministic and reproducible.

---

## 7. Reversibility

- **Very Low**.

Relaxing claim isolation would:
- invalidate audit narratives;
- undermine compliance credibility;
- expose the platform to regulatory risk.

This decision is intentionally strict.

---

## 8. Related ADRs

- ADR-000 — Product Identity & Scope (e-Performance)
- ADR-001 — Energy as the Primary Claim Substrate
- ADR-002 — Two-Stream MRV Model
- ADR-003 — Reconciliation, Tolerances & Failure States

---

## 9. References

- REDIII / RTFO (NORA) methodology and guidance
- e-Spark MRV & Reconciliation specifications
- e-Spark CC Solution — Context Pack

