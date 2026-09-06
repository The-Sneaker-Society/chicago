import mongoose from "mongoose";
import { createPaymentIntent, expireCheckoutSession, releasePayoutToMember, refundContractPayment, getPaymentIntentDetails } from "../stripe/stripe.service";
import { assertTransition } from "./contract.transitions.js";
import { contractRepository } from "./contract.repository.js";
import { memberRepository } from "../members/member.repository.js";
import { userRepository } from "../users/user.repository.js";
import { chatRepository } from "../chat/chat.repository.js";
import {
  shippingPreset,
  shippingSpeed,
  shippingFees,
  insuranceConfig,
} from "../shipping/shipping.constants.js";
// One-directional: shipping.service never imports contract.service (no
// cycle), mirroring the existing stripe.service import below.
import { shippingService } from "../shipping/shipping.service.js";
import {
  contractStatus,
  payoutStatus,
  contractEvent,
  timelineEvent,
  statusToKey,
  contractErrors,
  platformFee,
  UNBOXING_MIN_PHOTOS,
} from "./contract.constants.js";

// Mongo status value -> camelCase response key, derived so it can never
// drift out of sync with contractStatus.
const STAGE_MAP = statusToKey;

// Human order handle: SS- + 6 unambiguous chars (no 0/O/1/I).
// Retries on collision; unique index backs the guarantee.
const ORDER_REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ORDER_REF_PREFIX = "SS-";

const randomOrderRef = () => {
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += ORDER_REF_ALPHABET[Math.floor(Math.random() * ORDER_REF_ALPHABET.length)];
  }
  return `${ORDER_REF_PREFIX}${suffix}`;
};

export const generateOrderRef = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = randomOrderRef();
    const existing = await contractRepository.findByOrderRef(candidate);
    if (!existing) return candidate;
  }
  throw new Error(contractErrors.ORDER_REF_UNAVAILABLE);
};

const EMPTY_STATUS_COUNTS = Object.fromEntries(
  Object.keys(contractStatus).map((key) => [key, 0])
);

const buildShoeProductName = (shoeDetails) => {
  const brand = shoeDetails?.brand || "";
  const model = shoeDetails?.model || "";
  const shoeLabel = [brand, model].filter(Boolean).join(" ") || "Sneaker";
  return `Sneaker Society - ${shoeLabel}`;
};

export const contractService = {
  async getContractsForContext(dbUser, role) {
    if (!dbUser) {
      return [];
    }

    const filter = {};
    if (role === "member") {
      filter.memberId = dbUser._id;
    } else if (role === "client") {
      filter.clientId = dbUser._id;
    }

    return await contractRepository.findAll(filter);
  },

  /**
   * Party-scoped read: a contract you're not a party to looks identical to
   * one that doesn't exist (NOT_FOUND-not-FORBIDDEN doctrine). Admins can
   * inspect any contract.
   */
  async getContractById(id, requesterDbId, isAdmin = false) {
    const contract = isAdmin
      ? await contractRepository.findById(id)
      : requesterDbId
      ? await contractRepository.findByIdForParty(id, requesterDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    return contract;
  },

  /**
   * Same scoping as getContractById, keyed by the human orderRef for
   * readable URLs (plan: order numbers). Unknown refs and non-parties
   * are indistinguishable (CONTRACT_NOT_FOUND). Admins can inspect any ref.
   */
  async getContractByOrderRef(orderRef, requesterDbId, isAdmin = false) {
    const contract = isAdmin
      ? await contractRepository.findByOrderRef(orderRef)
      : requesterDbId
      ? await contractRepository.findByOrderRefForParty(orderRef, requesterDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    return contract;
  },

  /**
   * Per-status contract counts for a member. The raw memberId string is
   * passed straight through — Mongo casts it, no ObjectId coercion needed.
   */
  async getMemberContractStatus(memberId) {
    const contractCounts = await contractRepository.aggregateByMemberStatus(
      memberId
    );

    const statusCounts = { ...EMPTY_STATUS_COUNTS };

    contractCounts.forEach((stage) => {
      const statusKey = STAGE_MAP[stage._id];
      if (statusKey) {
        statusCounts[statusKey] = stage.count;
      }
    });

    return statusCounts;
  },

  async getContractList(contractIds) {
    const contracts = await contractRepository.findByIds(contractIds);

    return contracts.map((contract) => ({
      id: contract._id,
      orderRef: contract.orderRef || null,
      name: `${contract.shoeDetails.brand} ${contract.shoeDetails.model}`,
      status: contract.status,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    }));
  },

  /**
   * Creates a contract with defaults and links it to both the client user
   * and the member. Client-only: the intake form lives on the user side
   * (user/new-contract/:memberId), so the requester's own id becomes the
   * clientId — it can never be spoofed via input. Throws UNAUTHORIZED for
   * non-clients and MEMBER_NOT_FOUND for unknown members.
   */
  async createContract(requester, input) {
    if (!requester?.dbId || requester.role !== "client") {
      throw new Error(contractErrors.UNAUTHORIZED);
    }
    const clientId = requester.dbId;
    const { memberId, shoeDetails, repairDetails, declaredMarketValue, boxIncluded, selectedServiceMenuItem } = input;

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      throw new Error(contractErrors.INVALID_MEMBER_ID);
    }

    const member = await memberRepository.findById(memberId);
    if (!member) {
      throw new Error(contractErrors.MEMBER_NOT_FOUND);
    }

    // Validate service-menu snapshot server-side: only trust canonical name/price
    let snapshot = null;
    if (selectedServiceMenuItem?.id) {
      const menu = member.serviceMenu || [];
      const canonical = menu.find((it) => String(it.id) === String(selectedServiceMenuItem.id));
      if (!canonical) {
        throw new Error(contractErrors.SERVICE_MENU_ITEM_NOT_FOUND);
      }
      if (canonical.isActive === false) {
        throw new Error(contractErrors.SERVICE_MENU_ITEM_INACTIVE);
      }
      snapshot = { id: String(canonical.id), name: canonical.name, price: canonical.price };
    }

    const savedContract = await contractRepository.create({
      clientId,
      memberId,
      orderRef: await generateOrderRef(),
      declaredMarketValue,
      boxIncluded,
      shoeDetails,
      repairDetails: {
        ...repairDetails,
        memberNotes: "",
      },
      proposedPrice: null,
      price: null,
      chatId: null,
      status: contractStatus.pendingReview,
      paymentStatus: null,
      selectedServiceMenuItem: snapshot,
      timeline: [
        {
          event: contractEvent.contractCreated,
          date: new Date(),
        },
      ],
    });

    await userRepository.pushContractToUser(clientId, savedContract._id, memberId);
    await memberRepository.pushContractToMember(memberId, savedContract._id, clientId);

    // Every contract gets its chat at creation so both parties can message
    // immediately — previously the chat only existed after the member
    // manually initiated it, leaving client intake with no chat at all.
    const chatName =
      `${shoeDetails?.brand || ""} ${shoeDetails?.model || ""}`.trim() ||
      "Contract Chat";
    const savedChat = await chatRepository.createChat({
      name: chatName,
      memberId,
      userId: clientId,
      contractId: savedContract._id,
    });

    savedContract.chatId = savedChat._id;
    savedContract.timeline.push({ event: contractEvent.chatInitiated, date: new Date() });
    await contractRepository.save(savedContract);

    return savedContract;
  },

  /**
   * Single shared path for proposing a price (used by both the direct
   * createContractPrice mutation and any in-chat flow): builds the Stripe
   * product name, creates the payment intent, and updates the contract with
   * a PRICE_PROPOSED timeline event so every proposal is recorded.
   */
  async proposePrice(stripeConnectAccountId, contractId, price) {
    const contract = await contractRepository.findById(contractId);
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }

    const productName = buildShoeProductName(contract.shoeDetails);

    const { url } = await createPaymentIntent(
      stripeConnectAccountId,
      price,
      contractId.toString(),
      productName
    );

    const platformFeeCents = Math.round(price * platformFee.rate * 100);
    const payoutAmountCents = price * 100 - platformFeeCents;

    await contractRepository.updateById(contractId, {
      proposedPrice: price,
      platformFee: platformFeeCents / 100,
      payoutAmount: payoutAmountCents / 100,
      status: contractStatus.priceProposed,
      $push: { timeline: { event: contractEvent.priceProposedByMember, date: new Date() } },
    });

    return url;
  },

  /**
   * Client-side Review & Protect path (plan-shipping.md §2.8): either party
   * on the contract may persist the chosen preset/speed. Fees are always
   * recomputed server-side so the client can never spoof the Stripe total.
   * Party-scoped read — a non-party sees CONTRACT_NOT_FOUND, not FORBIDDEN.
   */
  /**
   * Live rate options for Review & Protect. Party-scoped; the quote is
   * created fresh per call (Shippo shipment creation is free).
   */
  async quoteShipping(requesterDbId, orderRef, { preset, withInsurance, withSignature } = {}) {
    const contract = requesterDbId
      ? await contractRepository.findByOrderRefForParty(orderRef, requesterDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    const declined =
      withInsurance === undefined
        ? !!contract.insuranceDeclined
        : !withInsurance;
    return shippingService.quoteRoundTrip(contract, {
      preset: preset ?? undefined,
      withInsurance: !declined,
      withSignature,
    });
  },

  /**
   * Resolves client-chosen live rate ids against the CACHED quote for this
   * contract (never a fresh re-quote — Shippo mints new rate ids per
   * shipment, so re-quoting could never match). Returns the exact fees +
   * tokens to persist.
   */
  async resolveQuotedChoice(contract, preset, declined, inboundRateId, outboundRateId, signatureRequired) {
    const match = await shippingService.matchCachedChoice(
      contract._id,
      inboundRateId,
      outboundRateId,
      signatureRequired
    );
    if (!match) {
      throw new Error(contractErrors.INVALID_SHIPPING_RATE);
    }
    // Stored semantics: shippingFee is postage ONLY.
    // When declared >= threshold and not declined, insuranceFee is charged to user.
    // When declared < threshold, Sneaker Society covers insurance, so insuranceFee = 0.
    const insuranceEligible = shippingService.insuranceEligible(contract);
    const insuranceFee = declined || !insuranceEligible ? 0 : match.insuranceTotal;
    const shippingFee =
      Math.round((match.roundTripTotal - (match.insuranceTotal || 0)) * 100) / 100;
    return {
      shippingFee,
      insuranceFee,
      speed: shippingService.speedForServiceToken(match.serviceToken),
      inboundServiceToken: match.serviceToken,
      outboundServiceToken: match.serviceToken,
      carrier: match.carrier,
      service: match.service,
    };
  },

  /**
   * Client-side Review & Protect path (plan-shipping.md §2.8): either party
   * on the contract may persist the shipping choice. With live rate ids the
   * fees resolve authoritatively from a fresh quote; without them the legacy
   * flat schedule applies. Party-scoped read — a non-party sees
   * CONTRACT_NOT_FOUND, not FORBIDDEN.
   */
  async updateShipping(requesterDbId, id, data = {}) {
    const contract = requesterDbId
      ? await contractRepository.findByIdForParty(id, requesterDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }

    const preset = data.shippingPreset ?? contract.shippingPreset ?? shippingPreset.single;
    if (!Object.values(shippingPreset).includes(preset)) {
      throw new Error(contractErrors.INVALID_SHIPPING_PRESET);
    }
    const declined = data.insuranceDeclined ?? contract.insuranceDeclined ?? false;
    // Persisted choice only counts once a carrier has actually been chosen —
    // before that the field is just the Mongoose default (false), which must
    // not masquerade as an explicit opt-out and kill the threshold default.
    // Null is normalized to undefined so it also falls through to it.
    const persistedSignature =
      contract.shippingCarrier && contract.signatureRequired != null
        ? contract.signatureRequired
        : undefined;
    const signatureRequired = shippingService.signatureApplies(
      contract,
      data.signatureRequired ?? persistedSignature ?? undefined
    );

    const timelinePush = [{ event: contractEvent.shippingSelected, date: new Date() }];
    if (declined && !contract.insuranceDeclined) {
      timelinePush.push({ event: contractEvent.insuranceDeclined, date: new Date() });
    }

    if (data.inboundRateId && data.outboundRateId) {
      const resolved = await this.resolveQuotedChoice(
        contract,
        preset,
        declined,
        data.inboundRateId,
        data.outboundRateId,
        signatureRequired
      );
      await contractRepository.updateById(id, {
        shippingPreset: preset,
        shippingSpeed: resolved.speed,
        shippingFee: resolved.shippingFee,
        insuranceFee: resolved.insuranceFee,
        insuranceDeclined: declined,
        signatureRequired,
        shippingCarrier: `${resolved.carrier} ${resolved.service}`,
        inboundRateId: data.inboundRateId,
        outboundRateId: data.outboundRateId,
        inboundServiceToken: resolved.inboundServiceToken,
        outboundServiceToken: resolved.outboundServiceToken,
        $push: { timeline: { $each: timelinePush } },
      });
      return true;
    }

    const speed = data.shippingSpeed ?? contract.shippingSpeed ?? shippingSpeed.standard;
    if (!Object.values(shippingSpeed).includes(speed)) {
      throw new Error(contractErrors.INVALID_SHIPPING_SPEED);
    }

    const declared = Number(contract.declaredMarketValue) || 0;
    const shippingFee = shippingFees[speed];
    // Insurance auto-applies at/over threshold; the client may explicitly
    // decline it on the review page (waiver modal). Declined => fee 0 and
    // no XCover coverage on either label (see shipping.service).
    const insuranceFee =
      !declined && declared >= insuranceConfig.threshold
        ? Math.round(declared * insuranceConfig.rate * 100) / 100
        : 0;

    await contractRepository.updateById(id, {
      shippingPreset: preset,
      shippingSpeed: speed,
      shippingFee,
      insuranceFee,
      insuranceDeclined: declined,
      signatureRequired,
      $push: { timeline: { $each: timelinePush } },
    });

    return true;
  },

  /**
   * Issues the itemized Stripe session for Review & Protect "Continue to
   * Payment": Service + Shipping + Insurance line_items (plan §2.6).
   * Caller must be the paying client. Supersedes older pending proposal
   * sessions so only the itemized total can be paid. `publish` is the
   * injected pubsub callback (AGENTS.md: pubsub-via-injected-callback).
   */
  async createContractCheckout(requesterDbId, contractId, data = {}, publish = null) {
    const contract = requesterDbId
      ? await contractRepository.findByIdForParty(contractId, requesterDbId)
      : null;
    if (!contract || contract.clientId.toString() !== requesterDbId.toString()) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (
      contract.status !== contractStatus.priceProposed &&
      contract.status !== contractStatus.awaitingPayment
    ) {
      throw new Error(contractErrors.CHECKOUT_NOT_ALLOWED);
    }

    const servicePrice =
      contract.price ?? contract.proposedPrice ?? contract.selectedServiceMenuItem?.price ?? null;
    if (servicePrice == null) {
      throw new Error(contractErrors.CHECKOUT_NOT_ALLOWED);
    }

    const member = await memberRepository.findById(contract.memberId);
    if (!member?.stripeConnectAccountId) {
      throw new Error(contractErrors.MEMBER_STRIPE_NOT_CONNECTED);
    }

    // Prefill Stripe Checkout with the client's saved address when complete
    // enough (street/city/zip) — the buyer can still edit it, and Stripe Tax
    // calculates off whatever they confirm. Incomplete or unreadable =>
    // guest collection. Never blocks checkout on a DB failure here.
    let customerEmail = null;
    let customerShipping = null;
    let customerDbId = null;
    try {
      const client = await userRepository.findById(contract.clientId);
      customerEmail = client?.email || null;
      customerDbId = client?._id ? String(client._id) : null;
      customerShipping =
        client?.addressLineOne && client?.city && client?.zipcode
          ? {
              name: [client.firstName, client.lastName].filter(Boolean).join(" ") || undefined,
              line1: client.addressLineOne,
              line2: client.addressLineTwo || undefined,
              city: client.city,
              state: client.state || undefined,
              postal_code: client.zipcode,
              country: client.country || "US",
            }
          : null;
    } catch (e) {
      console.log(`[CHECKOUT_PREFILL_SKIP] contract ${contractId}: ${e.message}`);
    }

    await this.updateShipping(requesterDbId, contractId, data);
    const updated = await contractRepository.findById(contractId);

    // Receipt lines: stored shippingFee is already postage-only (live path
    // splits at persist; legacy path stores the flat postage), so both lines
    // sum to the exact total the client approved. The waiver opt-out flows
    // through updateShipping (insuranceFee 0, no coverage).
    const embeddedInsurance = updated.insuranceFee || 0;
    const postageOnly = updated.shippingFee || 0;
    const session = await createPaymentIntent(
      member.stripeConnectAccountId,
      servicePrice,
      contractId.toString(),
      buildShoeProductName(contract.shoeDetails),
      {
        shippingFee: postageOnly,
        insuranceFee: embeddedInsurance,
        shippingSpeed: updated.shippingSpeed,
        shippingName: updated.shippingCarrier || null,
        orderRef: updated.orderRef || contract.orderRef || null,
        customerEmail,
        customerShipping,
        dbUserId: customerDbId,
      }
    );

    // Supersede older pending proposal sessions so the itemized total is
    // the only payable link (same pattern as proposePriceInChat).
    if (contract.chatId) {
      const previousProposals = await chatRepository.findPendingProposals(contract.chatId);
      for (const prev of previousProposals) {
        if (prev.metadata?.checkoutSessionId === session.id) continue;
        prev.metadata.status = "superseded";
        await chatRepository.saveMessage(prev);
        if (prev.metadata?.checkoutSessionId) {
          try {
            await expireCheckoutSession(prev.metadata.checkoutSessionId);
          } catch (e) {
            // Session may already be expired or paid — that's fine
          }
        }
        if (publish) {
          publish(`MESSAGE_UPDATED ${contract.chatId}`, {
            messageUpdated: {
              id: prev._id,
              chatId: prev.chatId,
              senderId: prev.senderId,
              content: prev.content,
              senderType: prev.senderType,
              type: prev.type,
              metadata: prev.metadata,
              createdAt: prev.createdAt,
            },
          });
        }
      }
    }

    return session.url;
  },

  /**
   * Merges allowed fields onto an existing contract. Nested objects are
   * merged per-key instead of replaced. Throws UNAUTHORIZED when the
   * requester is not the owning member.
   */
  async updateContract(requesterMemberId, id, data) {
    const contract = await contractRepository.findById(id);
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (requesterMemberId && contract.memberId.toString() !== requesterMemberId) {
      throw new Error(contractErrors.UNAUTHORIZED);
    }

    const DENYLIST = [
      "status",
      "payoutStatus",
      "stripePaymentIntentId",
      "stripeTransferId",
      "paidAt",
      "payoutAmount",
      "platformFee",
      "taxFee",
    ];
    const cleanData = { ...data };
    for (const key of DENYLIST) {
      delete cleanData[key];
    }

    const nestedPaths = ["repairDetails", "shoeDetails", "inboundTracking", "outboundTracking"];
    Object.keys(cleanData).forEach((key) => {
      if (cleanData[key] === undefined) return;
      if (nestedPaths.includes(key) && typeof cleanData[key] === "object" && !Array.isArray(cleanData[key])) {
        Object.keys(cleanData[key]).forEach((subKey) => {
          if (cleanData[key][subKey] !== undefined) {
            contract[key][subKey] = cleanData[key][subKey];
          }
        });
      } else {
        contract[key] = cleanData[key];
      }
    });

    await contractRepository.save(contract);
    return true;
  },

  /**
   * Reuses the contract's existing chat or creates one, then records a
   * CHAT_INITIATED timeline event. Throws UNAUTHORIZED for non-owning members.
   */
  async initiateContractChat(memberId, contractId) {
    const contract = await contractRepository.findById(contractId);
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (!memberId || contract.memberId.toString() !== memberId.toString()) {
      throw new Error(contractErrors.UNAUTHORIZED);
    }

    if (contract.chatId) {
      const existingChat = await chatRepository.findChatById(contract.chatId);
      if (existingChat) {
        return existingChat;
      }
    }

    const name =
      `${contract.shoeDetails?.brand || ""} ${contract.shoeDetails?.model || ""}`.trim() ||
      "Contract Chat";

    const savedChat = await chatRepository.createChat({
      name,
      memberId,
      userId: contract.clientId,
      contractId: contract._id,
    });

    contract.chatId = savedChat._id;
    contract.timeline.push({ event: contractEvent.chatInitiated, date: new Date() });
    await contractRepository.save(contract);

    return savedChat;
  },

  /**
   * Releases a pending payout to the owning member via Stripe and marks the
   * contract paid with a PAYOUT_RELEASED timeline event.
   */
  async releasePayout(contractId) {
    const contract = await contractRepository.findById(contractId);
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (contract.payoutStatus !== payoutStatus.pending) {
      throw new Error(contractErrors.NO_PENDING_PAYOUT);
    }

    const member = await memberRepository.findById(contract.memberId);
    if (!member?.stripeConnectAccountId) {
      throw new Error(contractErrors.MEMBER_STRIPE_NOT_CONNECTED);
    }

    const amountCents = Math.round(contract.payoutAmount * 100);
    const transfer = await releasePayoutToMember(
      member.stripeConnectAccountId,
      amountCents,
      contractId
    );

    await contractRepository.updateById(contractId, {
      payoutStatus: payoutStatus.paid,
      stripeTransferId: transfer.id,
      paidAt: new Date(),
      status: contractStatus.completed,
      $push: { timeline: { event: contractEvent.payoutReleased, date: new Date() } },
    });

    return true;
  },

  /**
   * Unboxing gate (plan-escrow-dispute.md §1): the owning member may start
   * work only from ARRIVED_AT_MEMBER with >= UNBOXING_MIN_PHOTOS evidence
   * shots. Wrong status → BAD_TRANSITION, too few photos →
   * UNBOXING_PHOTOS_REQUIRED. Non-parties see CONTRACT_NOT_FOUND.
   */
  async startWork(contractId, memberDbId) {
    const contract = memberDbId
      ? await contractRepository.findByIdForParty(contractId, memberDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (contract.memberId.toString() !== memberDbId.toString()) {
      throw new Error(contractErrors.UNAUTHORIZED);
    }
    if (contract.status !== contractStatus.arrivedAtMember) {
      throw new Error(contractErrors.BAD_TRANSITION);
    }
    if ((contract.unboxingPhotos || []).length < UNBOXING_MIN_PHOTOS) {
      throw new Error(contractErrors.UNBOXING_PHOTOS_REQUIRED);
    }
    // transitionTo returns the updated doc — resolvers expose Boolean!,
    // so await for effect and return true (reaching here means success).
    await this.transitionTo(contractId, contractStatus.workInProgress, {
      timelinePayload: { event: contractEvent.workStarted },
    });
    return true;
  },

  /**
   * Appends member unboxing evidence keys (mock ticket flow — keys only, no
   * Image docs). Open during ARRIVED_AT_MEMBER and stays open after Start
   * Work (WORK_IN_PROGRESS) for extra condition close-ups, capped at a
   * soft max of 12 total — beyond that the call is a no-op success.
   */
  async uploadUnboxingPhotos(contractId, memberDbId, keys = []) {
    const contract = memberDbId
      ? await contractRepository.findByIdForParty(contractId, memberDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (contract.memberId.toString() !== memberDbId.toString()) {
      throw new Error(contractErrors.UNAUTHORIZED);
    }
    if (
      contract.status !== contractStatus.arrivedAtMember &&
      contract.status !== contractStatus.workInProgress
    ) {
      throw new Error(contractErrors.BAD_TRANSITION);
    }
    const UNBOXING_SOFT_MAX = 12;
    const room = Math.max(0, UNBOXING_SOFT_MAX - (contract.unboxingPhotos || []).length);
    const toAdd = (keys || []).slice(0, room);
    if (toAdd.length === 0) {
      return true;
    }
    await contractRepository.updateById(contractId, {
      $push: {
        unboxingPhotos: { $each: toAdd },
        timeline: { event: contractEvent.unboxingPhotosUploaded, date: new Date() },
      },
    });
    return true;
  },

  /**
   * Appends client packaging evidence keys (plan-escrow-dispute.md §1b).
   * Prompted, never blocking: allowed only while READY_TO_SHIP
   * (post-dropoff photos prove nothing), soft max 3.
   */
  async uploadPackagingPhotos(contractId, clientDbId, keys = []) {
    const contract = clientDbId
      ? await contractRepository.findByIdForParty(contractId, clientDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (contract.clientId.toString() !== clientDbId.toString()) {
      throw new Error(contractErrors.UNAUTHORIZED);
    }
    if (contract.status !== contractStatus.readyToShip) {
      throw new Error(contractErrors.BAD_TRANSITION);
    }
    const PACKAGING_SOFT_MAX = 3;
    const room = Math.max(0, PACKAGING_SOFT_MAX - (contract.packagingPhotos || []).length);
    const toAdd = (keys || []).slice(0, room);
    if (toAdd.length === 0) {
      return true;
    }
    await contractRepository.updateById(contractId, {
      $push: {
        packagingPhotos: { $each: toAdd },
        timeline: { event: contractEvent.packagingPhotosUploaded, date: new Date() },
      },
    });
    return true;
  },

  /**
   * Flag → freeze (plan-escrow-dispute.md §2, no-transfer-yet design).
   * Either party may flag from any post-payment status; the payout freezes
   * (payoutStatus:frozen so releasePayout/cron skip it) and the contract
   * moves to UNDER_MANUAL_REVIEW with a DISPUTE_OPENED entry carrying
   * actor + reason. No Stripe reversal at flag time — admin resolution
   * (#11) reuses refundContractPayment.
   */
  async flagContract(contractId, partyDbId, reason = "") {
    const contract = partyDbId
      ? await contractRepository.findByIdForParty(contractId, partyDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    const flaggable = [
      contractStatus.readyToShip,
      contractStatus.inboundShipped,
      contractStatus.arrivedAtMember,
      contractStatus.workInProgress,
      contractStatus.readyForReturn,
      contractStatus.returnShipped,
      contractStatus.deliveredToUser,
    ];
    if (!flaggable.includes(contract.status)) {
      throw new Error(contractErrors.BAD_TRANSITION);
    }
    const actor =
      contract.clientId.toString() === partyDbId.toString() ? "client" : "member";
    // transitionTo returns the updated doc — resolvers expose Boolean!,
    // so await for effect and return true (reaching here means success).
    await this.transitionTo(contractId, contractStatus.underManualReview, {
      timelinePayload: { event: contractEvent.disputeOpened, reason, actor },
      extraUpdates: { payoutStatus: payoutStatus.frozen },
    });
    return true;
  },

  /**
   * 72h auto-payout funnel (plan-escrow-dispute.md §4), called hourly by
   * src/cron-jobs/payout.cron.js. Re-reads and re-checks every candidate
   * (another run/webhook may have moved it), funnels into the existing
   * releasePayout, catches per-contract and continues. Failures stay
   * pending + eligible and are retried next hour.
   */
  async autoReleasePayouts(now = new Date()) {
    const due = await contractRepository.findPayoutDue(now);
    let released = 0;
    const failed = [];
    for (const candidate of due || []) {
      try {
        const fresh = await contractRepository.findById(candidate._id);
        if (!fresh) continue;
        if (fresh.status !== contractStatus.deliveredToUser) continue;
        if (fresh.payoutStatus !== payoutStatus.pending) continue;
        if (!fresh.payoutEligibleAt || new Date(fresh.payoutEligibleAt) > new Date(now)) continue;
        await this.releasePayout(fresh._id);
        released += 1;
      } catch (e) {
        console.log(`[PAYOUT_CRON] contract ${candidate._id} failed: ${e.message}`);
        failed.push(String(candidate._id));
      }
    }
    return { checked: (due || []).length, released, failed };
  },

  /**
   * Manual "Accept work" path (plan-escrow-dispute.md §4): the owning
   * client clears the 72h wait and funnels into the same releasePayout as
   * the cron. Non-parties see CONTRACT_NOT_FOUND.
   */
  async confirmReceipt(contractId, clientDbId) {
    const contract = clientDbId
      ? await contractRepository.findByIdForParty(contractId, clientDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (contract.clientId.toString() !== clientDbId.toString()) {
      throw new Error(contractErrors.UNAUTHORIZED);
    }
    // Idempotent accept: a retried/double-clicked confirm after success is
    // already paid — return true instead of erroring (releasePayout's
    // pending guard would block a double transfer regardless).
    if (
      contract.status === contractStatus.completed &&
      contract.payoutStatus === payoutStatus.paid
    ) {
      return true;
    }
    if (contract.status !== contractStatus.deliveredToUser) {
      throw new Error(contractErrors.BAD_TRANSITION);
    }
    await contractRepository.updateById(contractId, { payoutEligibleAt: new Date() });
    return await this.releasePayout(contractId);
  },

  /**
   * Member marks restoration work done — shoes stay in member custody,
   * awaiting batch dropoff (READY_FOR_RETURN). The return-label + packing
   * photo + ship flow lives on that state; payout/cancel/cron are untouched.
   */
  async markWorkComplete(contractId, memberDbId) {
    const contract = memberDbId
      ? await contractRepository.findByIdForParty(contractId, memberDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (contract.memberId.toString() !== memberDbId.toString()) {
      throw new Error(contractErrors.UNAUTHORIZED);
    }
    if (contract.status !== contractStatus.workInProgress) {
      throw new Error(contractErrors.BAD_TRANSITION);
    }
    // transitionTo returns the updated doc — resolvers expose Boolean!.
    await this.transitionTo(contractId, contractStatus.readyForReturn, {
      timelinePayload: { event: contractEvent.readyForReturn },
    });
    return true;
  },

  /**
   * Member confirms the return box is with the carrier. Idempotent with the
   * Shippo scan webhook (transition() no-ops when already RETURN_SHIPPED),
   * so the button and a later carrier scan can never double-advance.
   */
  async markReturnShipped(contractId, memberDbId) {
    const contract = memberDbId
      ? await contractRepository.findByIdForParty(contractId, memberDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (contract.memberId.toString() !== memberDbId.toString()) {
      throw new Error(contractErrors.UNAUTHORIZED);
    }
    if (contract.status === contractStatus.returnShipped) {
      return true;
    }
    if (contract.status !== contractStatus.readyForReturn) {
      throw new Error(contractErrors.BAD_TRANSITION);
    }
    // transitionTo returns the updated doc — resolvers expose Boolean!.
    await this.transitionTo(contractId, contractStatus.returnShipped, {
      timelinePayload: { event: contractEvent.returnShipped },
    });
    return true;
  },

  /**
   * Member-snapped packed-box evidence for the return leg (mirrors the
   * client §1b flow). Optional, never a gate — taken in the return-label
   * modal after printing, capped at a soft max of 3.
   */
  async uploadReturnPackagingPhotos(contractId, memberDbId, keys = []) {
    const contract = memberDbId
      ? await contractRepository.findByIdForParty(contractId, memberDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (contract.memberId.toString() !== memberDbId.toString()) {
      throw new Error(contractErrors.UNAUTHORIZED);
    }
    if (contract.status !== contractStatus.readyForReturn) {
      throw new Error(contractErrors.BAD_TRANSITION);
    }
    const RETURN_PACKAGING_SOFT_MAX = 3;
    const room = Math.max(0, RETURN_PACKAGING_SOFT_MAX - (contract.returnPackagingPhotos || []).length);
    const toAdd = (keys || []).slice(0, room);
    if (toAdd.length === 0) {
      return true;
    }
    await contractRepository.updateById(contractId, {
      $push: {
        returnPackagingPhotos: { $each: toAdd },
        timeline: { event: contractEvent.returnPackagingPhotosUploaded, date: new Date() },
      },
    });
    return true;
  },

  /**
   * Central state machine transition method.
   * Validates allowed transitions via assertTransition.
   */
  async transitionTo(contractId, toStatus, { isAdmin = false, timelinePayload = {}, extraUpdates = {} } = {}) {
    const contract = await contractRepository.findById(contractId);
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    assertTransition(contract.status, toStatus, isAdmin);

    const update = { status: toStatus, ...extraUpdates };
    if (timelinePayload.event) {
      update.$push = {
        timeline: {
          event: timelinePayload.event,
          date: new Date(),
          ...(timelinePayload.reason !== undefined ? { reason: timelinePayload.reason } : {}),
          ...(timelinePayload.actor !== undefined ? { actor: timelinePayload.actor } : {}),
          ...(typeof timelinePayload.refundCents === "number" ? { refundCents: timelinePayload.refundCents } : {}),
        },
      };
    }
    return await contractRepository.updateById(contractId, update, { new: true });
  },

  /**
   * Cancels a contract and performs stage-appropriate teardown:
   * - Stage A (Pre-payment): expires pending checkout sessions & cancels chat proposals
   * - Stage B (READY_TO_SHIP): refunds client minus non-recoverable label fees (shipping + insurance) and processing fees
   * - Stage C+ (INBOUND_SHIPPED onward): throws CANCEL_NOT_ALLOWED for clients/members. Admin force-cancel
   *   supported without auto-refund (goes to manual/prorated review per mid-flight policy).
   */
  async cancelContract(contractId, reason = "", ctx = {}, publish = null) {
    const isAdmin = ctx?.role === "admin";
    let contract;
    if (isAdmin) {
      contract = await contractRepository.findById(contractId);
    } else {
      const requesterDbId = ctx?.dbUser?._id;
      if (!requesterDbId) {
        throw new Error(contractErrors.UNAUTHORIZED);
      }
      contract = await contractRepository.findByIdForParty(contractId, requesterDbId);
    }

    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }

    if (contract.status === contractStatus.canceled || contract.status === contractStatus.completed) {
      throw new Error(contractErrors.ALREADY_CANCELED);
    }

    // Members can only cancel pre-payment; once paid (READY_TO_SHIP), only client or admin can cancel
    const cancellableStatuses =
      ctx?.role === "member"
        ? [
            contractStatus.pendingReview,
            contractStatus.priceProposed,
            contractStatus.awaitingPayment,
          ]
        : [
            contractStatus.pendingReview,
            contractStatus.priceProposed,
            contractStatus.awaitingPayment,
            contractStatus.readyToShip,
          ];

    if (!isAdmin && !cancellableStatuses.includes(contract.status)) {
      throw new Error(contractErrors.CANCEL_NOT_ALLOWED);
    }

    // Stage A: Pre-payment cancellation — expire active checkout sessions & cancel chat proposals
    if (contract.chatId) {
      const pendingProposals = await chatRepository.findPendingProposals(contract.chatId);
      for (const proposal of pendingProposals) {
        proposal.metadata = proposal.metadata || {};
        proposal.metadata.status = "canceled";
        await chatRepository.saveMessage(proposal);
        if (proposal.metadata?.checkoutSessionId) {
          try {
            await expireCheckoutSession(proposal.metadata.checkoutSessionId);
          } catch (e) {
            // Session may already be expired or paid
          }
        }
        if (publish) {
          publish(`MESSAGE_UPDATED ${contract.chatId}`, {
            messageUpdated: {
              id: proposal._id,
              chatId: proposal.chatId,
              senderId: proposal.senderId,
              content: proposal.content,
              senderType: proposal.senderType,
              type: proposal.type,
              metadata: proposal.metadata,
              createdAt: proposal.createdAt,
            },
          });
        }
      }
    }

    const actor = ctx?.role || "client";
    let refundCents = 0;

    // Stage B: Post-payment cancellation — gate auto-refund strictly to READY_TO_SHIP.
    // Post-shipment admin cancels (INBOUND_SHIPPED, WORK_IN_PROGRESS, etc.) do NOT auto-refund
    // service-minus-labels because member labor/materials must be reviewed manually per mid-flight policy.
    if (contract.status === contractStatus.readyToShip && contract.stripePaymentIntentId) {
      const hasLabels = Boolean(
        contract.inboundShipmentId ||
        contract.inboundTransactionId ||
        contract.outboundShipmentId ||
        contract.outboundTransactionId
      );
      const labelCost = hasLabels
        ? (contract.shippingFee || 0) + (contract.insuranceFee || 0)
        : 0;
      const labelCostCents = Math.round(labelCost * 100);

      let details = null;
      try {
        details = await getPaymentIntentDetails(contract.stripePaymentIntentId);
      } catch (err) {
        console.error("Failed to retrieve payment intent details:", err);
      }

      const totalPaidDollars =
        (contract.proposedPrice ?? contract.price ?? 0) +
        (contract.shippingFee || 0) +
        (contract.insuranceFee || 0) +
        (contract.taxFee || 0);
      const totalPaidCents = details?.amountTotalCents ?? Math.round(totalPaidDollars * 100);
      const stripeFeeCents = details?.feeCents ?? Math.round(totalPaidCents * 0.029 + 30);

      refundCents = Math.max(0, totalPaidCents - labelCostCents - stripeFeeCents);

      if (refundCents > 0) {
        await refundContractPayment({
          paymentIntentId: contract.stripePaymentIntentId,
          amountCents: refundCents,
          reason: "requested_by_customer",
          contractId: contract._id,
        });
      }
    }

    const extraUpdates = {};
    if (contract.stripePaymentIntentId) {
      extraUpdates.payoutStatus = payoutStatus.canceled;
    }

    await this.transitionTo(contract._id, contractStatus.canceled, {
      isAdmin,
      timelinePayload: {
        event: contractEvent.contractCanceled,
        reason,
        actor,
        refundCents,
      },
      extraUpdates,
    });

    return true;
  },

  async getContractMember(memberId) {
    return await memberRepository.findById(memberId);
  },

  async getContractClient(clientId) {
    return await userRepository.findById(clientId);
  },
};
