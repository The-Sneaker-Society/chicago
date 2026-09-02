import { platformFee } from "../../contracts/contract.constants.js";

jest.mock("../config.js", () => ({
  stripe: {
    checkout: { sessions: { create: jest.fn() } },
    accounts: { retrieve: jest.fn() },
    customers: { create: jest.fn() },
    products: { create: jest.fn(), update: jest.fn() },
    subscriptions: { list: jest.fn(), create: jest.fn(), update: jest.fn() },
    payouts: { list: jest.fn() },
    balance: { retrieve: jest.fn() },
    transfers: { create: jest.fn() },
    accountLinks: { create: jest.fn() },
  },
}));
jest.mock("../../models/Member.model", () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock("../../config/redis", () => ({ get: jest.fn() }));
jest.mock("../../utils/redis/stripeSubscritpitonCache", () => ({ syncStripeDataToKV: jest.fn() }));

import { stripe } from "../config.js";
import { createPaymentIntent } from "../stripe.service.js";

describe("createPaymentIntent platformFee", () => {
  beforeEach(() => jest.clearAllMocks());

  it("writes dynamic 15% fee to both metadata fields", async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ url: "https://checkout", id: "cs_1", expires_at: Math.floor(Date.now()/1000)+86400 });
    await createPaymentIntent("acct_123", 200, "contractId1", "Sneaker Society - Nike Air");
    const call = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(call.metadata.platformFeeCents).toBe(String(Math.round(200 * 0.15 * 100)));
    expect(call.payment_intent_data.metadata.platformFeeCents).toBe(String(Math.round(200 * 0.15 * 100)));
    expect(call.metadata.contractId).toBe("contractId1");
    expect(call.metadata.stripeConnectAccountId).toBe("acct_123");
    expect(call.line_items[0].price_data.unit_amount).toBe(200 * 100);
  });

  it("rounding case $33.33 -> 500c", async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ url: "u", id: "cs_2", expires_at: 0 });
    await createPaymentIntent("acct", 33.33, "cid", "prod");
    const call = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(call.metadata.platformFeeCents).toBe("500");
  });

  it("imports platformFee from constants, not hardcoded", async () => {
    expect(platformFee.rate).toBe(0.15);
    stripe.checkout.sessions.create.mockResolvedValue({ url: "u", id: "cs_3", expires_at: 0 });
    await createPaymentIntent("acct", 75, "cid", "prod");
    const call = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(call.metadata.platformFeeCents).toBe("1125");
  });

  it("propagates Stripe error", async () => {
    stripe.checkout.sessions.create.mockRejectedValue(new Error("stripe down"));
    await expect(createPaymentIntent("acct", 100, "cid", "prod")).rejects.toThrow("stripe down");
  });
});
