# ADR-003 — Reconciliation, Tolerances & Failure States

## Status
Accepted

## Date
2026-02-06

## Authors
- e-Spark Product & Architecture Team

---

## 1. Context

Under the Two-Stream MRV model (ADR-002), e-Performance ingests:
- a **Meter Stream** (regulatory-grade energy measurements), and
- an **Operational Stream** (asset-level usage and telemetry).

In real-world energy systems, these streams will **never perfectly match** due to:
- measurement resolution differences;
- transmission and conversion losses;
- clock drift and time-bucketing effects;
- delayed or missing readings;
- data corrections by DSOs or operators.

Without explicit reconciliation rules, discrepancies lead to:
- inconsistent claims;
- manual, ad-hoc decision making;
- audit risk and loss of regulator trust.

A deterministic reconciliation framework is therefore required to:
- decide when streams are "close enough";
- define acceptable tolerances;
- classify outcomes in a machine-verifiable way;
- prevent downstream claims when reconciliation fails.

---

## 2. Decision

### 2.1 Mandatory reconciliation

All claims produced by e-Performance **must pass through a reconciliation step**.

Reconciliation compares, per reporting period:
- total energy from the Meter Stream; and
- total energy from the Operational Stream.

No claim may be generated unless reconciliation has been evaluated and classified.

---

### 2.2 Canonical reconciliation metric

Reconciliation is evaluated using **relative variance**, defined as:

```
variance = |E_meter − E_operational| / E_meter
```

Where:
- `E_meter` is the reconciled energy total from regulatory meters;
- `E_operational` is the reconciled energy total from operational data.

The Meter Stream is the reference baseline.

---

### 2.3 Tolerance bands

Reconciliation outcomes are classified into three bands:

| Outcome | Condition | Meaning |
|-------|-----------|---------|
| **PASS** | variance ≤ X% | Streams are consistent; claims may proceed |
| **CONDITIONAL PASS** | X% < variance ≤ Y% | Claims may proceed with flags and justification |
| **FAIL** | variance > Y% | Claims are blocked |

Where:
- **X** and **Y** are tolerance thresholds defined per regulatory module.
- Default thresholds must be conservative and regulator-aligned.

Exact values for X and Y are defined in module-specific ADRs or configuration, not hard-coded.

---

### 2.4 Failure states

A reconciliation **FAIL** may occur due to:

- variance exceeding tolerance;
- missing meter data for the period;
- missing operational data for the period;
- inconsistent asset or site mappings;
- unresolved data integrity errors.

In a FAIL state:
- no claims may be generated;
- the period is explicitly marked as non-claimable;
- remediation is required before re-evaluation.

---

### 2.5 Conditional passes

A **CONDITIONAL PASS**:
- allows claim generation;
- requires explicit annotation of the discrepancy;
- must be visible to auditors and verifiers;
- may trigger enhanced review depending on regime.

Conditional passes are first-class outcomes, not silent tolerances.

---

## 3. Alternatives Considered

### Alternative A — Hard equality requirement
- Require meter and operational totals to match exactly.

**Rejected** because:
- it is unrealistic in physical systems;
- it would block valid claims;
- it incentivises data manipulation.

---

### Alternative B — No explicit tolerances
- Allow human judgement on discrepancies.

**Rejected** because:
- it is non-deterministic;
- it weakens auditability;
- it does not scale.

---

## 4. Consequences

### Positive
- Deterministic and auditable claim eligibility.
- Transparent handling of real-world imperfections.
- Clear operational remediation paths.
- Consistent behaviour across modules.

### Trade-offs
- Requires careful selection of tolerance thresholds.
- Introduces additional system states to manage.

---

## 5. Implications for Architecture & Data Model

- Reconciliation results are stored as immutable artefacts.
- Each reporting period has a single reconciliation outcome.
- Claims reference reconciliation IDs, not raw data.
- Variance metrics and classifications are persisted for audit.

---

## 6. Implications for REDIII / RTFO

- Monthly reconciliation is mandatory.
- Tolerance thresholds must align with NORA expectations.
- Conditional passes must be defensible to auditors.

---

## 7. Reversibility

- **Medium**.

Tolerance values may evolve, but the existence of:
- reconciliation gates,
- explicit failure states,
- deterministic outcomes

is foundational and not expected to change.

---

## 8. Related ADRs

- ADR-000 — Product Identity & Scope (e-Performance)
- ADR-001 — Energy as the Primary Claim Substrate
- ADR-002 — Two-Stream MRV Model
- ADR-004 — Claim Isolation & Double-Counting Prevention

---

## 9. References

- REDIII / RTFO (NORA) methodology and guidance
- e-Spark MRV & Reconciliation specifications
- e-Spark CC Solution — Context Pack

