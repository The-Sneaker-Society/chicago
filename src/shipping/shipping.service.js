import dotenv from "dotenv";
import { Shippo } from "shippo";
import { stripe } from "../stripe/config.js";
import redis from "../config/redis.js";
import { contractErrors } from "../contracts/contract.constants.js";
import { memberRepository } from "../members/member.repository.js";
import { userRepository } from "../users/user.repository.js";
import {
  shippingPreset,
  shippingSpeed,
  parcelPresets,
  shippingFees,
  insuranceConfig,
  signatureConfig,
  insuranceMaxAmount,
  insuranceContent,
  trackingState,
} from "./shipping.constants.js";

dotenv.config({ path: "config.env" });

// Short-lived server-side record of quoted round-trip options, keyed by
// contract. Checkout matches the client's chosen rate ids against THIS —
// never a fresh re-quote, because Shippo mints new rate ids per shipment
// and a re-quote could never match. Redis first, in-memory fallback.
const QUOTE_TTL_SECONDS = 1800;
const memoryQuoteCache = new Map();

const quoteCacheKey = (contractId) => `shipquote:${String(contractId)}`;

async function cacheQuote(contractId, payload) {
  const raw = JSON.stringify({ ...payload, quotedAt: Date.now() });
  try {
    await redis.setex(quoteCacheKey(contractId), QUOTE_TTL_SECONDS, raw);
  } catch {
    memoryQuoteCache.set(quoteCacheKey(contractId), raw);
  }
}

async function readCachedQuote(contractId) {
  try {
    const raw = await redis.get(quoteCacheKey(contractId));
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to memory
  }
  const raw = memoryQuoteCache.get(quoteCacheKey(contractId));
  return raw ? JSON.parse(raw) : null;
}

const shippoClient = () => {
  if (!process.env.SHIPPO_API_KEY) {
    throw new Error(contractErrors.SHIPPO_NOT_CONFIGURED);
  }
  return new Shippo({ apiKeyHeader: process.env.SHIPPO_API_KEY });
};

const displayName = (doc, fallback) => {
  const full = [doc?.firstName, doc?.lastName].filter(Boolean).join(" ").trim();
  return full || doc?.email || fallback;
};

const toShippoAddress = (doc, fallbackName) => ({
  name: displayName(doc, fallbackName),
  street1: doc?.addressLineOne || "",
  street2: doc?.addressLineTwo || "",
  city: doc?.city || "",
  state: doc?.state || "",
  zip: doc?.zipcode || "",
  country: doc?.country || "US",
  phone: doc?.phoneNumber || "",
  email: doc?.email || "",
});

const isAddressComplete = (addr) => Boolean(addr.city && addr.zip && addr.street1);

export const servicePriceOf = (contract) =>
  contract?.price ?? contract?.proposedPrice ?? contract?.selectedServiceMenuItem?.price ?? null;

export const shippingService = {
  /**
   * MVP preview for the Review & Protect page. No live Shippo call —
   * live rate-shopping is a later PR.
   */
  getRates(preset = shippingPreset.single, speed = shippingSpeed.standard) {
    if (!parcelPresets[preset]) {
      throw new Error(contractErrors.INVALID_SHIPPING_PRESET);
    }
    if (shippingFees[speed] == null) {
      throw new Error(contractErrors.INVALID_SHIPPING_SPEED);
    }
    return { cost: shippingFees[speed], parcel: parcelPresets[preset] };
  },

  /**
   * Loads the client + member rows via their owning repositories and maps
   * them to Shippo address shapes. Throws MISSING_SHIPPING_ADDRESS when
   * either side lacks the required city/zip/street (see plan §0.3).
   */
  async buildAddresses(contract) {
    const [client, member] = await Promise.all([
      userRepository.findById(contract.clientId),
      memberRepository.findById(contract.memberId),
    ]);
    if (!client || !member) {
      throw new Error(contractErrors.MISSING_SHIPPING_ADDRESS);
    }
    const clientAddr = toShippoAddress(client, "Client");
    const memberAddr = toShippoAddress(member, "Member");
    if (!isAddressComplete(clientAddr) || !isAddressComplete(memberAddr)) {
      throw new Error(contractErrors.MISSING_SHIPPING_ADDRESS);
    }
    return { client: clientAddr, member: memberAddr };
  },

  /**
   * Whether XCover applies at all. Coverage is platform-funded on every
   * shipment (any declared value) — the $1000 threshold gates CHARGING the
   * user, never coverage. Only an explicit opt-out (waiver) removes it.
   */
  insuranceApplies(contract) {
    const declared = Number(contract?.declaredMarketValue) || 0;
    return !contract?.insuranceDeclined && declared > 0;
  },

  /**
   * Charge gate alone: the user sees an insurance line only at/over
   * threshold (unless declined). Below it the platform funds coverage
   * silently. Both preview and checkout resolve fees through the
   * threshold so the two can never disagree.
   */
  insuranceEligible(contract) {
    const declared = Number(contract?.declaredMarketValue) || 0;
    return declared >= insuranceConfig.threshold;
  },

  /**
   * XCover insurance descriptor for a leg, or null when it doesn't apply.
   * Outbound covers shoes + service payout (shrinkage protection).
   */
  insuranceAmountFor(contract, leg) {
    const declared = Number(contract?.declaredMarketValue) || 0;
    const servicePrice = Number(servicePriceOf(contract)) || 0;
    const amount =
      leg === "outbound" ? declared + servicePrice : declared;
    if (amount > insuranceMaxAmount) {
      throw new Error(contractErrors.INSURANCE_OVER_MAX);
    }
    return {
      amount: String(Math.round(amount * 100) / 100),
      currency: "USD",
      content: insuranceContent,
    };
  },

  insuranceFor(contract, leg) {
    if (!this.insuranceApplies(contract)) {
      return null;
    }
    return this.insuranceAmountFor(contract, leg);
  },

  /**
   * Platform fee preview math (mirrors stripe line_items): 2% of declared
   * value when over threshold, else 0. Persisted on the contract so Stripe
   * and the DB agree.
   */
  quoteFees(contract, preset, speed) {
    const { cost } = this.getRates(preset, speed);
    const declared = Number(contract?.declaredMarketValue) || 0;
    const insuranceFee =
      !contract?.insuranceDeclined && declared >= insuranceConfig.threshold
        ? Math.round(declared * insuranceConfig.rate * 100) / 100
        : 0;
    return { shippingFee: cost, insuranceFee };
  },

  async createInboundLabel(contract) {
    return this.createLabel(contract, "inbound");
  },

  async createOutboundLabel(contract) {
    return this.createLabel(contract, "outbound");
  },

  /**
   * Whether signature confirmation applies: explicit opt-in, or automatic
   * at/over threshold (porch-piracy + XCover claim-validity protection).
   */
  signatureApplies(contract, explicit) {
    if (explicit === true) return true;
    if (explicit === false) return false;
    // Only real persisted booleans override the threshold — null/undefined
    // (including an unset Mongoose default) fall through to it.
    if (contract?.shippingCarrier && contract?.signatureRequired != null) {
      return Boolean(contract.signatureRequired);
    }
    const declared = Number(contract?.declaredMarketValue) || 0;
    return declared >= signatureConfig.threshold;
  },

  signatureExtra(contract, explicit) {
    return this.signatureApplies(contract, explicit)
      ? { signatureConfirmation: signatureConfig.type }
      : null;
  },

  /**
   * Live round-trip rate shopping (no purchase). Creates both leg shipments
   * with their respective insurance amounts and pairs rates by
   * carrier+service so the checkout shows true round-trip totals.
   * Shipment creation is free — only label purchase costs money.
   */
  async quoteRoundTrip(contract, { preset, withInsurance, withSignature } = {}) {
    const client = shippoClient();
    const { client: clientAddr, member: memberAddr } =
      await this.buildAddresses(contract);
    const resolvedPreset = preset ?? contract.shippingPreset ?? shippingPreset.single;
    const parcel = parcelPresets[resolvedPreset];
    if (!parcel) {
      throw new Error(contractErrors.INVALID_SHIPPING_PRESET);
    }
    // Explicit choice wins; default is always-on coverage. The charge
    // threshold never gates coverage — only whether the user sees a line.
    const wantInsurance =
      withInsurance === false
        ? false
        : withInsurance === true
          ? true
          : this.insuranceApplies(contract);
    // Effective signature choice for THIS quote — cached alongside the
    // options so checkout can reject a flipped choice on the same rate ids.
    const wantSignature =
      withSignature ?? this.signatureApplies(contract, undefined);

    const legShipments = {
      inbound: { from: clientAddr, to: memberAddr, leg: "inbound" },
      outbound: { from: memberAddr, to: clientAddr, leg: "outbound" },
    };
    const [inboundShipment, outboundShipment] = await Promise.all(
      Object.values(legShipments).map(({ from, to, leg }) => {
        const insurance =
          wantInsurance && this.insuranceApplies(contract)
            ? this.insuranceAmountFor(contract, leg)
            : null;
        const signature = this.signatureExtra(contract, wantSignature);
        const extra = { ...(insurance ? { insurance } : {}), ...(signature ? signature : {}) };
        return client.shipments.create({
          addressFrom: from,
          addressTo: to,
          parcels: [parcel],
          extra: Object.keys(extra).length ? extra : undefined,
          async: false,
        });
      })
    );

    const keyOf = (r) => `${r.provider}::${r.servicelevel?.token || r.servicelevel?.name}`;
    const byKey = new Map();
    for (const r of inboundShipment.rates || []) {
      byKey.set(keyOf(r), { inbound: r });
    }
    const options = [];
    for (const r of outboundShipment.rates || []) {
      const entry = byKey.get(keyOf(r));
      if (!entry || entry.used) continue;
      entry.used = true;
      const inRate = entry.inbound;
      const inAmount = parseFloat(inRate.amount);
      const outAmount = parseFloat(r.amount);
      if (!Number.isFinite(inAmount) || !Number.isFinite(outAmount)) continue;
      const inIns = parseFloat(inRate.includedInsurancePrice ?? inRate.included_insurance_price) || 0;
      const outIns = parseFloat(r.includedInsurancePrice ?? r.included_insurance_price) || 0;
      options.push({
        carrier: r.provider,
        service: r.servicelevel?.name || r.servicelevel?.token || "Standard",
        serviceToken: r.servicelevel?.extended_token || r.servicelevel?.token || "",
        etaDays: r.estimated_days ?? inRate.estimated_days ?? null,
        inboundRateId: inRate.objectId || inRate.object_id,
        inboundAmount: inAmount,
        outboundRateId: r.objectId || r.object_id,
        outboundAmount: outAmount,
        roundTripTotal: Math.round((inAmount + outAmount) * 100) / 100,
        insuranceTotal:
          Math.round((inIns + outIns) * 100) / 100,
      });
    }
    options.sort((a, b) => a.roundTripTotal - b.roundTripTotal);
    if (!options.length) {
      throw new Error(contractErrors.SHIPPO_RATE_UNAVAILABLE);
    }
    const quoted = { options, withInsurance: wantInsurance, withSignature: wantSignature };
    await cacheQuote(contract._id, quoted);
    return quoted;
  },

  /**
   * Matches client-chosen rate ids against the CACHED quote for this
   * contract. Returns the matched option or null (expired/evicted quote —
   * the client must refresh options and pick again). When the caller passes
   * an expected signature choice, a quote made under the opposite choice is
   * also rejected — the rate ids embody quote-time extras and must not be
   * reused across a signature flip. Quotes cached before this binding
   * existed carry no withSignature and are allowed through.
   */
  async matchCachedChoice(contractId, inboundRateId, outboundRateId, expectedSignature) {
    if (!inboundRateId || !outboundRateId) return null;
    const cached = await readCachedQuote(contractId);
    if (!cached?.options) return null;
    const match =
      cached.options.find(
        (o) => o.inboundRateId === inboundRateId && o.outboundRateId === outboundRateId
      ) || null;
    if (
      match &&
      cached.withSignature !== undefined &&
      expectedSignature !== undefined &&
      cached.withSignature !== expectedSignature
    ) {
      return null;
    }
    return match;
  },

  /**
   * Express-flavored service tokens map to expedited; everything else is
   * standard. Keeps the legacy shippingSpeed field meaningful.
   */
  speedForServiceToken(token) {
    const t = String(token || "").toLowerCase();
    return /express|overnight|2nd_day|next_day|priority_mail_express|same_day/.test(t)
      ? shippingSpeed.expedited
      : shippingSpeed.standard;
  },

  async createLabel(contract, leg) {
    const storedRateId =
      leg === "inbound" ? contract.inboundRateId : contract.outboundRateId;
    if (storedRateId) {
      // Checkout-time choice: buy exactly what the client picked.
      try {
        return await this.purchaseRate(storedRateId, {
          fallbackCarrier: contract.shippingCarrier?.split(" ")?.[0] || null,
        });
      } catch (err) {
        console.log(
          `[SHIPPING_RATE_STALE] contract ${contract._id} leg ${leg}: ${err.message} — re-quoting same service`
        );
        return await this.rebuySameService(contract, leg);
      }
    }
    // Legacy path (no stored choice): cheapest rate, as before.
    const client = shippoClient();
    const { client: clientAddr, member: memberAddr } =
      await this.buildAddresses(contract);
    const from = leg === "inbound" ? clientAddr : memberAddr;
    const to = leg === "inbound" ? memberAddr : clientAddr;
    const parcel = parcelPresets[contract.shippingPreset ?? shippingPreset.single];
    if (!parcel) {
      throw new Error(contractErrors.INVALID_SHIPPING_PRESET);
    }
    const insurance = this.insuranceFor(contract, leg);
    const signature = this.signatureExtra(contract, undefined);
    const extra = { ...(insurance ? { insurance } : {}), ...(signature ? signature : {}) };

    const shipment = await client.shipments.create({
      addressFrom: from,
      addressTo: to,
      parcels: [parcel],
      extra: Object.keys(extra).length ? extra : undefined,
      async: false,
    });
    const rates = [...(shipment.rates || [])].sort(
      (a, b) => parseFloat(a.amount) - parseFloat(b.amount)
    );
    if (!rates.length) {
      throw new Error(contractErrors.SHIPPO_RATE_UNAVAILABLE);
    }
    return await this.purchaseRate(rates[0].objectId || rates[0].object_id, {
      fallbackCarrier: rates[0].provider,
      shipmentId: shipment.objectId || shipment.object_id,
    });
  },

  /**
   * Purchases a single Shippo rate id. Shared by checkout-choice buys and
   * the legacy cheapest-rate path.
   */
  async purchaseRate(rateId, { fallbackCarrier = null, shipmentId = null } = {}) {
    if (!rateId) {
      throw new Error(contractErrors.SHIPPO_RATE_UNAVAILABLE);
    }
    const client = shippoClient();
    const txn = await client.transactions.create({
      rate: rateId,
      labelFileType: "PDF",
      async: false,
    });
    if (txn.status !== "SUCCESS") {
      const detail = (txn.messages || []).map((m) => m.text).join("; ");
      throw new Error(
        `${contractErrors.SHIPPO_TRANSACTION_FAILED}${detail ? `: ${detail}` : ""}`
      );
    }
    return {
      shipmentId: shipmentId || txn.shipment || null,
      transactionId: txn.objectId || txn.object_id,
      trackingNumber: txn.trackingNumber || txn.tracking_number,
      carrier: txn.rate?.provider || txn.rate?.carrier || fallbackCarrier,
      labelUrl: txn.labelUrl || txn.label_url || null,
    };
  },

  /**
   * Fallback when a stored checkout rate has expired: re-quote and buy the
   * same carrier+service the client picked.
   */
  async rebuySameService(contract, leg) {
    const storedToken =
      leg === "inbound" ? contract.inboundServiceToken : contract.outboundServiceToken;
    const { options } = await this.quoteRoundTrip(contract, {
      preset: contract.shippingPreset,
      withInsurance: this.insuranceApplies(contract),
      withSignature: this.signatureApplies(contract, undefined),
    });
    const match =
      options.find((o) => o.serviceToken && o.serviceToken === storedToken) || options[0];
    if (!match) {
      throw new Error(contractErrors.SHIPPO_RATE_UNAVAILABLE);
    }
    const rateId = leg === "inbound" ? match.inboundRateId : match.outboundRateId;
    return await this.purchaseRate(rateId, { fallbackCarrier: match.carrier });
  },

  /**
   * Shippo sends no HMAC — route security is the unguessable URL.
   * This just validates the event envelope shape.
   */
  verifyShippoEvent(body) {
    const event = body?.event;
    const data = body?.data;
    if (!event || !data) {
      throw new Error(contractErrors.SHIPPO_BAD_WEBHOOK);
    }
    return { event, data };
  },

  /**
   * Normalizes Shippo `tracking_status` values to the webhook matrix states.
   */
  normalizeTrackingStatus(status) {
    const s = String(status || "").toUpperCase();
    if (s === "DELIVERED") return trackingState.delivered;
    if (s === "TRANSIT" || s === "IN_TRANSIT" || s === "OUT_FOR_DELIVERY")
      return trackingState.inTransit;
    if (s === "PRE_TRANSIT" || s === "ACCEPTED") return trackingState.preTransit;
    if (
      s === "FAILURE" ||
      s === "RETURNED" ||
      s === "RETURN_TO_SENDER" ||
      s === "CANCELLED"
    )
      return trackingState.failed;
    return trackingState.unknown;
  },

  /**
   * Best-effort address snapshot for the admin evidence viewer
   * (features.md:11). Never throws — callers log and continue.
   */
  async snapshotAddresses(contract) {
    const member = await memberRepository.findById(contract.memberId);
    let stripeCountry = null;
    let stripeZip = null;
    try {
      if (member?.stripeConnectAccountId) {
        const account = await stripe.accounts.retrieve(
          member.stripeConnectAccountId
        );
        const addr =
          account?.individual?.address ||
          account?.company?.address ||
          account?.business_profile?.support_address ||
          null;
        stripeCountry = addr?.country || account?.country || null;
        stripeZip = addr?.postal_code || null;
      }
    } catch (e) {
      console.log(`[SHIPPING_SNAPSHOT] stripe lookup failed: ${e.message}`);
    }
    const shipTo = member
      ? {
          street1: member.addressLineOne || null,
          street2: member.addressLineTwo || null,
          city: member.city || null,
          state: member.state || null,
          zip: member.zipcode || null,
          country: member.country || "US",
        }
      : null;
    const addressMismatch =
      shipTo && stripeCountry
        ? String(shipTo.country).toUpperCase() !== String(stripeCountry).toUpperCase() ||
          (stripeZip && shipTo.zip !== stripeZip)
        : null;
    return { snapshot: { shipTo, stripeCountry, stripeZip }, addressMismatch };
  },
};
