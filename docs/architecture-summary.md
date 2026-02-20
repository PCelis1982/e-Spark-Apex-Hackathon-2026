***Architecture Summary — e-Performance***
**1. Design Philosophy**

e-Performance is a horizontal performance & claims orchestration layer designed to support multiple regulatory and market regimes without coupling the core performance model to any specific regulation.

The system is governed by formal Architecture Decision Records (ADRs), which define non-negotiable architectural constraints and compliance boundaries.

Foundational Decisions

ADR-001 — Energy as the Primary Claim Substrate

ADR-002 — Two-Stream MRV Model

ADR-003 — Reconciliation, Tolerances & Failure States

ADR-004 — Claim Isolation & Double-Counting Prevention

**2. Core Architectural Principles**
***2.1 Energy as the Primary Substrate***

Energy (kWh, with deterministic conversion to MJ) is the irreducible unit of truth within e-Performance.

Emissions are derived attributes.

Certificates are regime-level artefacts.

All claims must trace back to verified energy quantities.

See ADR-001.

***2.2 Two-Stream MRV Model***

All claims require the presence of two independent but linked streams:

Meter Stream — regulatory-grade energy measurements

Operational Stream — asset-level performance evidence

Neither stream is sufficient in isolation.

Claims cannot bypass reconciliation.

See ADR-002.

***2.3 Deterministic Reconciliation***

Before any claim is generated, reconciliation must classify the reporting period into one of:

PASS

CONDITIONAL_PASS

FAIL

Claims are blocked in a FAIL state.
Conditional passes require explicit annotation.

See ADR-003.

***2.4 Claim Isolation***

Energy allocated to one claim context cannot be reused in another regime.

Allocation results in deterministic locking at the reporting-period level, preventing double counting by architecture rather than policy.

See ADR-004.

**3. Multi-Regime Capability**

The canonical performance layer is regime-agnostic and supports multiple modules:

REDIII / RTFO compliance (energy-based)

Guarantees of Origin validation

Voluntary carbon methodologies

Each regime is implemented as a module on top of the same reconciled energy base and must respect reconciliation and claim isolation rules.

***4. Hackathon Scope — Hedera Apex 2026***

For the Hedera Apex Hackathon 2026, the active implementation focus is:

REDIII / RTFO (Ireland — NORA), energy-based reporting.

The MVP demonstrates:

Energy-first architecture

Two-stream reconciliation

Deterministic eligibility gating

Claim allocation readiness

*Guarantees of Origin and Carbon modules are architecturally supported but are not implemented in this MVP.*
