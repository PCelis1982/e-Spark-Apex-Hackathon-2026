# ADR-000 — Product Identity & Scope (e-Performance)

## Status
Accepted

## Date
2026-02-06

## Authors
- e-Spark Product & Architecture Team

---

## 1. Context

The energy sector is governed by multiple regulatory and market regimes (e.g. REDIII/RTFO, national quota systems, voluntary carbon markets, Guarantees of Origin). These regimes differ in rules, units, certification bodies, and reporting formats, but they all depend on a common underlying reality: **measured and verifiable energy performance**.

Historically, solutions in this space are built vertically (one product per regulation), leading to:
- duplicated MRV logic,
- high risk of double counting,
- tight coupling between regulation and data models,
- difficulty expanding into adjacent regimes (carbon, GO, new countries).

To avoid these pitfalls, e-Spark is being developed as a **horizontal orchestration platform**, with a clear separation between:
- performance (what actually happened), and
- claims (what is asserted under a given regime).

At the same time, the platform requires a clear commercial identity that is:
- regulation-agnostic,
- credible to regulators and auditors,
- extensible to future solutions.

---

## 2. Decision

### 2.1 Product identity

- **e-Spark** is the company and core technology platform.
- **e-Performance** is the commercial product name.

> **e-Performance is the performance & claims orchestration layer for the energy sector.**

This definition is canonical and applies across all current and future solutions.

---

### 2.2 Scope of e-Performance

e-Performance:
- orchestrates measurement, reconciliation, and auditability of energy performance;
- derives regulatory or market claims from verified performance;
- integrates with external systems (OEMs, meters, grids, registries, verifiers);
- provides deterministic, auditable outputs suitable for third-party verification.

Explicitly, e-Performance **does not**:
- generate energy;
- issue regulatory certificates;
- act as a registry of record;
- monetise or trade certificates or credits by default.

---

### 2.3 Modular regulatory solutions

Regulatory and market regimes are implemented as **modules** on top of e-Performance, including (non-exhaustive):

- REDIII / RTFO (Ireland – NORA)
- RED compliance modules (DE, AT, NL, etc.)
- Voluntary carbon credit methodologies
- Guarantees of Origin validation

Each module:
- reuses the same underlying performance layer;
- applies regime-specific rules, calculations, and reporting formats;
- maintains isolation to prevent double counting across regimes.

---

### 2.4 Current focus

The current implementation focus is:

- **REDIII reporting**, based on **energy output**, not CO₂;
- Irish RTFO (NORA) methodology;
- a **two-stream MRV model** (regulatory meters + operational usage data).

The uploaded REDIII / RTFO documentation is the **source of truth for this specific solution**, but **not** for the entire e-Performance platform.

---

### 2.5 Decision governance

Any design, architectural, or methodological decision that:
- involves interpretation of regulation,
- introduces constraints affecting future regimes,
- fixes aggregation grain, units, tolerances, or attribution rules,

**must be documented as an Architecture Decision Record (ADR)**.

ADRs are mandatory artifacts and form part of the audit and governance trail of e-Performance.

---

## 3. Alternatives Considered

### Alternative A — Carbon-first product identity
- Position the product primarily as a carbon credit platform.

**Rejected** because:
- carbon is a derived claim, not the foundational truth;
- this would constrain REDIII and GO solutions;
- it increases regulatory and credibility risk.

---

### Alternative B — Regulation-specific products
- Build separate products for REDIII, carbon credits, GO, etc.

**Rejected** because:
- it duplicates MRV logic;
- increases double-counting risk;
- prevents a unified audit and verification layer.

---

## 4. Consequences

### Positive
- Clear and defensible product positioning.
- Single performance truth reused across regimes.
- Strong foundation for validator and verifier roles.
- Easier expansion to new regulations and markets.

### Trade-offs
- Requires stronger architectural discipline.
- Requires explicit ADR management.
- Slightly higher upfront design effort.

---

## 5. Implications for Architecture & Documentation

- Core data models must represent **performance**, not certificates.
- Claims calculators must be modular and regime-scoped.
- Documentation must clearly separate:
  - platform-level concepts, and
  - solution-specific rules.
- Repository structure must include a dedicated `/docs/adr/` directory.

---

## 6. Reversibility

- **Low**.

Changing the product identity or scope later would require:
- refactoring documentation,
- reinterpreting compliance boundaries,
- reworking audit narratives.

This decision is intentionally foundational.

---

## 7. Related ADRs (planned)

- ADR-001 — Energy as the Primary Claim Substrate
- ADR-002 — Two-Stream MRV Model
- ADR-003 — Reconciliation & Tolerance Rules
- ADR-004 — Claim Isolation & Double-Counting Prevention

---

## 8. References

- REDIII / RTFO (NORA) methodology and guidance
- e-Spark MRV & Reconciliation specifications
- e-Spark CC Solution — Context Pack

