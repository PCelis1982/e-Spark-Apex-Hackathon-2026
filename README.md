# e-Spark
### Digital Infrastructure for Energy Compliance & e-Credits
*"Igniting the future of electrification"*

e-Spark is a Web3 platform that measures, verifies, and tokenizes renewable electricity used in EV charging.

The solution ingests charging-session data and hourly grid or PPA energy intensity, applies compliance-grade methodologies, and anchors verified clean-energy claims on Hedera using native tokens.

By preventing double counting and enabling transparent certification, e-Spark unlocks new revenue streams for EV operators while increasing trust, auditability, and scalability for clean-energy markets.

The MVP demonstrates real-world energy data flowing into Hedera as verifiable on-chain sustainability assets.

---

# Hackathon Track
Hedera Apex Hackathon 2026

Sustainability & Real World Asset Tokenization

---

# Project Scope — Hackathon Focus

e-Performance supports multiple regime modules:

• REDIII / RTFO compliance reporting  
• Guarantees of Origin validation  
• Voluntary Carbon Credit preparation  

⚠️ **Hackathon Focus**

For the Hedera Apex Hackathon 2026, the active implementation scope is:

**REDIII energy-based reporting (Ireland – RTFO/NORA)**

Carbon and GO modules are architecturally supported but not implemented in this MVP.

---

# Architecture Overview

The platform is built around an **energy-first MRV architecture**.

Energy assets and meters feed two independent data streams:

Operational stream (charging sessions)  
Meter stream (regulatory energy measurements)

These streams are reconciled in the **e-Performance MRV engine**.

Verified energy then flows into the **claims orchestration layer**, which prepares compliance artefacts for regulators and registry systems.

Hedera provides the trust infrastructure for anchoring compliance artefacts and issuing tokenised certificates.

---

# Business Model

The platform monetizes compliance infrastructure through:

• SaaS platform for Charge Point Operators  
• Fee per issued compliance certificate  
• Future marketplace fee for digital e-Credit certificates  

---

# Why Ireland First

Ireland provides the ideal entry market because:

• The REDIII framework is currently being implemented  
• The EV charging market is highly concentrated (4 operators ≈ 80%)  
• Compliance requirements are simpler than Germany, Austria, or the Netherlands  
• A smaller market allows a regulatory sandbox before EU expansion  
• Operational advantage from local presence

---

# Tech Stack

• Node.js / TypeScript backend  
• Firestore data layer  
• Hedera Hashgraph  
• Hedera Token Service (HTS)  
• Hedera Consensus Service (HCS)  
• Guardian-compatible architecture  

---

# Demo Video

https://vimeo.com/1172153034/cceda5374b?fl=tl&fe=ec

---

# Submission Presentation

/submission/e-Spark_Apex_Hackathon_Deck.pdf

---

# Repository Structure

readme.md
License.md
submission/: e-Spark_Apex_Hackathon_Deck
docs/ Architecture Design files
code/ Front-end & Back-end applications code
   
