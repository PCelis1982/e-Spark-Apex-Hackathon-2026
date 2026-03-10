// src/routes/ep/pages/lib/redTracks.ts

export const RED_COUNTRIES = [
  { code: "ie", label: "Ireland (IE)" },
  { code: "at", label: "Austria (AT)" },
  { code: "de", label: "Germany (DE)" },
];

export function countryToTrack(country: string) {
  const c = String(country || "").toLowerCase();
  if (c === "ie") return "EU_RED_IE";
  if (c === "at") return "EU_RED_AT";
  if (c === "de") return "EU_RED_DE";
  return "EU_RED_IE"; // default
}
