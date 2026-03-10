Overview

e-Spark is a platform designed to measure, verify, and orchestrate energy performance for EV charging infrastructure and other energy assets.

The platform ingests operational energy data, validates it against metering evidence, and prepares regulatory or market-based claims such as:

REDIII / RTFO renewable electricity compliance

Guarantees of Origin (GO)

Voluntary carbon market (VCM) credits

The system follows a Measurement-Reporting-Verification (MRV) architecture where energy performance is validated before claims are generated.

Platform Architecture

The platform is structured around a data-driven energy verification pipeline.

Energy Assets (EV chargers, batteries, meters)
                 │
                 ▼
            Data Ingestion
                 │
                 ▼
          Energy Verification
                 │
                 ▼
        Meter / Usage Validation
                 │
                 ▼
          Performance Reporting
                 │
                 ▼
        Claims Preparation
                 │
                 ▼
  REDIII / GO / Carbon Market Outputs

This architecture ensures that energy claims are backed by verifiable data sources.

Repository Structure
apps/
   frontend/        → User interface
   backend/         → Data ingestion, verification, and reporting

The frontend provides dashboards and management interfaces, while the backend implements the MRV logic.

Frontend Application

Location:

apps/frontend

The frontend allows operators to:

onboard projects

register assets

monitor energy performance

validate reporting periods

generate compliance claims.

Frontend Key Components
Claims Pages
EpClaimsRedPage.jsx

Handles REDIII / RTFO compliance claims.

Functions:

display eligible renewable energy

generate compliance reporting data

prepare regulator-ready claim packages.

EpClaimsGoPage.jsx

Handles Guarantee of Origin claims.

Functions:

display renewable generation evidence

prepare GO documentation.

EpClaimsVcmPage.jsx

Handles voluntary carbon credit preparation.

Functions:

estimate emissions reductions

generate VCM documentation.

Energy Data Inputs
EmissionFactors.jsx

Manages emission factor datasets.

Functions:

load grid carbon intensity

manage PPA emission factors

support emissions calculations.

UsageMeter.jsx

Displays certified electricity meter readings.

Functions:

validate meter evidence

show authoritative energy measurements.

MonthlyPack.jsx

Aggregates energy data into reporting periods.

Functions:

consolidate meter and operational data

prepare monthly reporting packages.

Project Management
EpCreatePage.jsx

Creates a new project and registers assets.

EpManagePage.jsx

Project management dashboard.

Displays project status and configuration.

EpProjectDetail.jsx

Detailed project overview.

Includes energy data, assets, and reporting periods.

EpUpdatePage.jsx

Updates project metadata and configuration.

AuditProject.jsx

Displays verification records and audit evidence.

lib/redTracks.ts

Implements RED compliance logic used by the frontend.

Backend Application

Location:

apps/backend

The backend implements the MRV engine responsible for:

energy ingestion

asset onboarding

meter validation

operational energy processing

verification

audit logging

reporting preparation.

Backend Architecture

The backend follows a layered architecture:

Routes (API Endpoints)
        │
        ▼
Services (Business Logic)
        │
        ▼
Data Models / Storage

Routes expose APIs used by the frontend, while services implement core processing logic.

Backend Core Routes

These files represent the main system workflow.

ingest.ts

Handles asset onboarding and energy ingestion.

Responsibilities:

register energy assets

receive operational energy data

trigger validation workflows.

meter.ts

Handles ingestion of meter stream data.

Responsibilities:

load certified meter readings

validate meter structure

store authoritative energy measurements.

usage.ts

Processes operational energy usage data.

Responsibilities:

ingest EV charging sessions

aggregate asset-level energy consumption.

verification.ts

Performs data verification and eligibility checks.

Responsibilities:

verify asset configuration

confirm meter availability

validate claim eligibility.

audit.ts

Records audit evidence and verification logs.

Responsibilities:

track validation steps

store audit history.

projects.ts

Manages project lifecycle.

Responsibilities:

create projects

link assets and energy data

manage project configuration.

Backend Supporting Files

These files provide supporting logic for the MRV engine.

reportingPeriods.ts

Manages reporting period lifecycle.

Responsibilities:

define reporting windows

aggregate energy data by period.

projectStats.ts

Generates project performance metrics.

Responsibilities:

compute aggregated energy statistics

support reporting dashboards.

firebase.ts

Handles database connectivity.

Responsibilities:

persist energy data

store verification records.

models.ts

Defines shared backend data models.

Includes definitions for:

projects

assets

energy records

claims.

Energy Verification Model

The platform validates energy claims by comparing two evidence sources:

Meter data — authoritative energy measurements

Operational usage data — asset-level energy consumption

Both sources are reconciled to ensure consistency before claims are generated.

Key Platform Capabilities

The system provides:

energy asset onboarding

EV charging session ingestion

meter evidence validation

reporting period aggregation

regulatory claim preparation

audit-ready evidence storage.

Hackathon Backend Showcase

For the hackathon demonstration, the most relevant backend files are:

src/routes/ingest.ts
src/routes/meter.ts
src/routes/usage.ts
src/routes/verification.ts
src/routes/audit.ts
src/routes/projects.ts

These files demonstrate the core MRV pipeline used by the platform.

Infra files:

src/services/reportingPeriods.ts
src/services/projectStats.ts
src/utils/firebase.ts
src/models.ts

Summary

The e-Spark platform provides a complete energy performance verification pipeline that enables infrastructure operators to:

validate energy performance

generate compliance claims

prepare regulatory submissions

support energy-based carbon markets.

The architecture ensures that all claims are backed by verifiable energy data and traceable audit records.