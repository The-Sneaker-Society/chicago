/**
 * Single source of truth for shipping vocabularies (Shippo provider).
 * Persisted values (preset/speed keys) must never change without a migration.
 * See plan-shipping.md §2.1 (canonical).
 */

export const shippingPreset = Object.freeze({
  single: "single",
  multi: "multi",
});

export const shippingSpeed = Object.freeze({
  standard: "standard",
  expedited: "expedited",
});

// Shippo parcels take lb / in. SDK v2 uses camelCase keys (docs:
// ParcelCreateRequest { length, width, height, distanceUnit, weight,
// massUnit }) — snake_case is silently dropped and the parcel 400s.
export const parcelPresets = Object.freeze({
  single: {
    weight: "4",
    length: "13",
    width: "8",
    height: "5",
    distanceUnit: "in",
    massUnit: "lb",
  },
  multi: {
    weight: "8",
    length: "15",
    width: "10",
    height: "6",
    distanceUnit: "in",
    massUnit: "lb",
  },
});

// MVP hardcoded client-facing fees; live Shippo rate-shopping is a later PR.
export const shippingFees = Object.freeze({
  standard: 30,
  expedited: 60,
});

export const insuranceConfig = Object.freeze({
  threshold: Number(process.env.INSURANCE_THRESHOLD) || 300,
  rate: Number(process.env.INSURANCE_RATE) || 0.02,
});

// Signature confirmation (STANDARD): auto-required at/over threshold,
// opt-in below. Pass-through at cost (~$4.15 USPS), embedded in rates.
export const signatureConfig = Object.freeze({
  threshold: Number(process.env.SIGNATURE_THRESHOLD) || 300,
  type: "STANDARD",
});

// XCover caps single-package coverage at $10,000 — above that needs manual handling.
export const insuranceMaxAmount = 10000;

// Content label required by XCover on every insured shipment.
export const insuranceContent = "sneakers";

// Normalized tracking states used by the webhook matrix (plan-shipping.md §2.7).
export const trackingState = Object.freeze({
  delivered: "delivered",
  inTransit: "in_transit",
  preTransit: "pre_transit",
  failed: "failed",
  unknown: "unknown",
});
