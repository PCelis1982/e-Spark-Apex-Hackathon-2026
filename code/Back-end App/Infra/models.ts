// src/models.ts

export type ID = string;

/**
 * High-level entities
 */

export interface Organization {
  id: ID;
  name: string;
  /** HQ or default country; org itself can be multi-country */
  country: string;
  did?: string;
}

/**
 * Calculation scope / methodology family.
 * Added EU_RED_IE for Ireland (NORA-related).
 */
export type CalcScope =
  | 'VERRA_VCS'
  | 'EU_RED_DE'
  | 'EU_RED_AT'
  | 'EU_RED_NL'
  | 'EU_RED_IE'
  | 'OTHER';

/**
 * Project defines:
 *  - methodology (scope)
 *  - intended compliance country (if any)
 */
export interface Project {
  id: ID;
  organization_id: ID;
  name: string;
  description?: string;

  /** VM0038 / REDIII DE / etc. */
  standard_scope: CalcScope;

  /**
   * Jurisdiction for compliance:
   * e.g. 'DE', 'AT', 'NL', 'IE', 'FR'…
   * Optional so we can have global / voluntary-only projects.
   */
  compliance_country?: string;
}

/**
 * Physical location of demand and (sometimes) onsite production.
 * This is your “site” in the station/yard/parking sense.
 */
export interface Site {
  id: ID;
  organization_id: ID;
  project_id: ID;

  name: string;
  country_code: string;   // ISO 3166-1 alpha-2, e.g. 'DE'
  city?: string;
  address?: string;

  lat: number;
  lng: number;

  /**
   * Grid node / bidding zone / TSO area:
   * - ENTSO-E zone like 'DE-LU'
   * - Resurity node code
   * - TSO regional code
   */
  grid_region: string;

  /** IANA timezone, e.g. 'Europe/Berlin' */
  timezone: string;
}

/**
 * Optional layer between Site and assets – group of chargers/batteries.
 * For MVP you can ignore and keep everything at Site level.
 */
export interface Station {
  id: ID;
  site_id: ID;
  project_id: ID;
  name: string;
  external_ref?: string; // e.g. Driivz station ID
}

/**
 * Physical assets – usage side
 */

export interface Charger {
  id: ID;
  site_id: ID;
  project_id: ID;
  /** Optional, for when you enable the Station layer */
  station_id?: ID;

  name: string;
  /** Max AC/DC power in kW */
  power_kw: number;

  /** e.g. ['CCS', 'CHAdeMO'] */
  connector_types: string[];

  /** ISO date string */
  commissioning_date: string;
}

/** Optional for later, but useful to reserve the spot now */
export interface Battery {
  id: ID;
  site_id: ID;
  project_id: ID;
  station_id?: ID;

  name: string;
  capacity_kwh: number;
  max_charge_kw: number;
  max_discharge_kw: number;

  commissioning_date: string;
}

/**
 * Meters – ONE canonical meter entity, used both on
 * the usage side (import, EV-only submeter) and provision side (PV, export).
 */
export type MeterKind =
  | 'MAIN'
  | 'SUB'
  | 'EV_ONLY'
  | 'PV'
  | 'WIND'
  | 'OTHER';

export type MeterDirection =
  | 'IMPORT'
  | 'EXPORT'
  | 'BIDIRECTIONAL';

export interface Meter {
  id: ID;
  organization_id: ID;
  site_id: ID;

  /** Optional: meter is primarily attached to one project/station */
  project_id?: ID;
  station_id?: ID;

  kind: MeterKind;
  direction: MeterDirection;

  /** Utility / operator meter ID */
  external_ref?: string;
}

/**
 * PPA & allocation: PPAs can be shared across projects & sites.
 */

export type PPAEnergySource =
  | 'PV'
  | 'WIND'
  | 'HYDRO'
  | 'OTHER';

export interface PPA {
  id: ID;

  supplier: string;     // Utility or IPP name
  name?: string;        // Friendly name
  description?: string;

  /**
   * Average EF (gCO2/kWh) for the energy delivered under this PPA.
   * Hourly EF can override this if available.
   */
  emission_factor_g_per_kwh?: number;

  /** e.g. GO / REGOs / Guarantees of Origin IDs */
  go_cert_id?: string;

  source_type?: PPAEnergySource;

  /**
   * Legacy/backwards compatibility: some old data may still have PPA
   * tied to a single project. New data should use ProjectPPA / SitePPA.
   */
  project_id?: ID;
}

/** PPA allocations per project */
export interface ProjectPPA {
  id: ID;
  project_id: ID;
  ppa_id: ID;

  /**
   * Optional fraction of PPA dedicated to this project
   * (0…1). If omitted, treat as “unbounded but preferred”.
   */
  share?: number;

  note?: string;
}

/** Optional extra granularity – PPA allocations per site */
export interface SitePPA {
  id: ID;
  site_id: ID;
  project_id: ID;
  ppa_id: ID;

  share?: number;
  note?: string;
}

/**
 * Usage events – demand side (EV sessions, etc.)
 */

export interface Session {
  id?: ID;
  site_id: ID;
  project_id: ID;
  charger_id: ID;
  /** Optional when sub-metering exists */
  meter_id?: ID;

  started_at: string;  // ISO date-time
  ended_at: string;    // ISO date-time
  energy_kwh: number;
}

/**
 * Provision side metering – raw energy readings, any direction.
 */
export type EnergySourceTag =
  | 'GRID'
  | 'PPA'
  | 'PV'
  | 'WIND'
  | 'BATTERY'
  | 'OTHER';

export interface MeterReading {
  id: ID;
  meter_id: ID;
  timestamp: string;    // ISO date-time (end of interval, e.g. hour)
  /** kWh in this interval; sign + direction must be consistent */
  energy_kwh: number;
  source: EnergySourceTag;
}

/**
 * Existing aggregated helpers – keep these for convenience.
 * They can be derived from Session + MeterReading in the future.
 */

export interface EnergyMixInterval {
  id?: ID;
  site_id: ID;
  project_id: ID;
  begin: string;   // ISO date-time
  end: string;     // ISO date-time
  renewable_kwh: number;
  fossil_kwh: number;
  scope2_grid_intensity_g_per_kwh?: number | null;
}

/**
 * Hourly intensity at a site / project / source.
 * Used as the core “supply-side” EF time series.
 */
export type IntensitySource = 'PPA' | 'GRID';

export interface CO2IntensityHour {
  id?: ID;
  site_id: ID;
  project_id: ID;

  /** For grid-linked intensity, this should match Site.grid_region */
  grid_region?: string;

  /** Optional if intensity is specific to one PPA */
  ppa_id?: ID;

  /** Hour boundary, ISO date-time (e.g. 2025-11-30T10:00:00Z) */
  hour: string;

  source: IntensitySource;
  g_per_kwh: number;
  /** 0…1, if you want to store renewable share explicitly */
  renewable_share?: number | null;
}

/**
 * Tokenization / minting status for a calc result.
 * Centralised here so MRV can import it.
 */
export type TokenizationStatus =
  | 'NOT_STARTED'
  | 'READY_FOR_MINTING'
  | 'MINTING'
  | 'MINTED'
  | 'FAILED';

/**
 * Calculation results – for VM0038, REDIII, etc.
 * Includes MRV-friendly fields so they’re consistent across the app.
 */
export interface CalcResult {
  id?: ID;
  site_id?: ID;        // optional: some calcs may be project-level only
  project_id: ID;

  /** Window of time the result covers */
  from?: string;
  to?: string;

  scope: CalcScope;

  /** Keep the country explicitly on the result row */
  compliance_country?: string;

  /** Identifier for the calculator / version, e.g. 'VM0038_v1' */
  methodology_id: string;

  /** Free-form (but serializable) input parameters */
  params: any;

  /** Calculator output; shape depends on methodology */
  result: any;

  created_at: string;

  // MRV-related links
  usage_file_id?: ID;

  tokenization_status?: TokenizationStatus;
  tokenization_error_message?: string;

  // Denormalized fields for easy UI / mint logic
  total_energy_kwh?: number;      // decimal kWh
  total_tonnes_co2e?: number;     // decimal tonnes for direct display/minting
}

/**
 * Two canonical “streams” your calculators work with.
 * Everything else (sessions, meters, PPAs, CO2IntensityHour) feeds into these.
 */

export interface UsageStreamPoint {
  project_id: ID;
  site_id: ID;
  station_id?: ID;
  charger_id?: ID;
  meter_id?: ID;

  /** Interval representative timestamp (e.g. hour end), ISO string */
  timestamp: string;

  /** kWh consumed in this interval */
  energy_kwh: number;
}

export interface ProvisionStreamPoint {
  project_id?: ID;
  site_id?: ID;
  grid_region?: string;

  ppa_id?: ID;
  meter_id?: ID;

  /** Interval representative timestamp (matching UsageStreamPoint) */
  timestamp: string;

  /** kWh provided / matched to demand in this interval */
  energy_kwh: number;

  /** Emission factor applied for this energy (gCO2/kWh) */
  ef_g_per_kwh: number;

  /** Supply source type for traceability */
  source: EnergySourceTag;
}
