***Architecture Summary — e-Performance***

**1. Design Philosophy**

e-Performance is a horizontal performance & claims orchestration layer designed to support multiple regulatory and market regimes.

The system is governed by formal Architecture Decision Records (ADRs).

Core foundational decisions:

Energy as primary substrate (ADR-001)

Two-stream MRV model (ADR-002)

Deterministic reconciliation (ADR-003)

Claim isolation and double-counting prevention (ADR-004)


**2. Core Architecture Decisions**

*2.1 Energy as the Primary Substrate*

Energy (kWh → MJ) is the irreducible unit of truth.

Emissions and certificates are derived artefacts.

See: ADR-001


*2.2 Two-Stream MRV Model*

All claims require:

Meter Stream (regulatory-grade energy)

Operational Stream (asset-level evidence)

Claims cannot bypass reconciliation.

See: ADR-002


*2.3 Deterministic Reconciliation*

Reconciliation outcomes are explicitly classified:

PASS

CONDITIONAL_PASS

FAIL

Claims are blocked in FAIL state.

See: ADR-003


*2.4 Claim Isolation*

Energy allocated to one regime cannot be reused in another.

This prevents double counting by architecture.

See: ADR-004


**3. Multi-Regime Capability**

The same performance layer supports:

REDIII / RTFO compliance

Guarantees of Origin validation

Voluntary carbon methodologies

Each regime is implemented as a module on top of the same reconciled energy base.


**4. Hackathon Scope**

For the Hedera Apex Hackathon 2026:

Active module:
→ REDIII / RTFO (Ireland – NORA)

Not implemented in MVP:

GO module

Carbon module

However, the architecture supports them without modification to the performance layer.
