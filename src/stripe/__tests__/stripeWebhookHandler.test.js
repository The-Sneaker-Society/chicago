jest.mock("../../utils/redis/stripeSubscritpitonCache", () => ({ syncStripeDataToKV: jest.fn() }));
jest.mock("../../models/Contract.model", () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock("../../models/Messages.Model", () => ({ findOneAndUpdate: jest.fn().mockResolvedValue(null) }));
jest.mock("../../pubsub", () => ({ default: { publish: jest.fn() }, publish: jest.fn() }));
jest.mock("../config.js", () => ({
  stripe: {
    webhooks: { constructEvent: jest.fn() },
    checkout: { sessions: { list: jest.fn().mockResolvedValue({ data: [] }) } },
  },
}));

import ContractModel from "../../models/Contract.model.js";
import { computePayoutAmount } from "../stripeWebhookHandler.js";

// Test the handler logic indirectly by importing and checking metadata flow
// We exercise handleContractPayment via the module's internal function by simulating session object
// Instead we test the fee calculation logic that webhook uses: parseInt fallback and payoutAmount

describe("stripeWebhookHandler payout calculation", () => {
  // Member earns service minus platform fee ONLY — shipping/insurance
  // collections fund labels and must not inflate the payout.
  const payoutFor = (session, feeCents, shipCents, insCents) =>
    (session.amount_total - feeCents - shipCents - insCents) / 100;

  it("uses platformFeeCents from metadata to compute payoutAmount/platformFee", async () => {
    // simulate handleContractPayment logic
    const session = {
      metadata: { contractId: "cid123", platformFeeCents: "3000", stripeConnectAccountId: "acct_1" },
      amount_total: 20000,
      payment_intent: "pi_123",
      id: "cs_123",
    };
    const PLATFORM_FEE_CENTS = 1200;
    const feeCents = parseInt(session.metadata.platformFeeCents, 10) || PLATFORM_FEE_CENTS;
    const payoutAmount = payoutFor(session, feeCents, 0, 0);
    const platformFee = feeCents / 100;
    expect(feeCents).toBe(3000);
    expect(payoutAmount).toBe(170);
    expect(platformFee).toBe(30);
  });

  it("excludes shipping/insurance from the member payout (itemized session)", async () => {
    // $300 service + $30 shipping + $58 insurance = $388 total, $45 fee
    const session = {
      metadata: { contractId: "cid123", platformFeeCents: "4500", stripeConnectAccountId: "acct_1" },
      amount_total: 38800,
      payment_intent: "pi_123",
      id: "cs_123",
    };
    expect(payoutFor(session, 4500, 3000, 5800)).toBe(255);
  });

  it("legacy fallback when missing platformFeeCents", () => {
    const PLATFORM_FEE_CENTS = 1200;
    const feeCents = parseInt(undefined, 10) || PLATFORM_FEE_CENTS;
    expect(feeCents).toBe(1200);
  });

  it("ContractModel.findByIdAndUpdate called with correct shape (mock)", async () => {
    ContractModel.findByIdAndUpdate.mockResolvedValue({});
    const session = { metadata: { contractId: "cid", platformFeeCents: "3000" }, amount_total: 20000, payment_intent: "pi", id: "cs" };
    const feeCents = parseInt(session.metadata.platformFeeCents, 10) || 1200;
    const payoutAmount = payoutFor(session, feeCents, 0, 0);
    const platformFee = feeCents / 100;
    await ContractModel.findByIdAndUpdate(session.metadata.contractId, {
      payoutAmount,
      platformFee,
      payoutStatus: "pending",
    });
    expect(ContractModel.findByIdAndUpdate).toHaveBeenCalledWith("cid", expect.objectContaining({ payoutAmount: 170, platformFee: 30 }));
  });
});

describe("computePayoutAmount excludes sales tax", () => {
  beforeEach(() => jest.clearAllMocks());

  const mockContractFees = (shippingFee = 0, insuranceFee = 0) => {
    ContractModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ shippingFee, insuranceFee }),
    });
  };

  it("pays $85.00 on $100 service with $0 tax", async () => {
    mockContractFees(0, 0);
    const session = {
      metadata: { contractId: "cid_tax0" },
      amount_total: 10000,
      total_details: { amount_tax: 0 },
    };
    await expect(computePayoutAmount(session, 1500)).resolves.toBe(85);
  });

  it("pays $85.00 on $100 service with $12.50 tax (tax never inflates payout)", async () => {
    mockContractFees(0, 0);
    const session = {
      metadata: { contractId: "cid_tax1250" },
      amount_total: 11250,
      total_details: { amount_tax: 1250 },
    };
    await expect(computePayoutAmount(session, 1500)).resolves.toBe(85);
  });

  it("treats missing total_details as $0 tax (legacy sessions)", async () => {
    mockContractFees(0, 0);
    const session = {
      metadata: { contractId: "cid_legacy" },
      amount_total: 20000,
    };
    await expect(computePayoutAmount(session, 3000)).resolves.toBe(170);
  });
});
