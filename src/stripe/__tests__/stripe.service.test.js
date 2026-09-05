import { platformFee } from "../../contracts/contract.constants.js";

jest.mock("../config.js", () => ({
  stripe: {
    checkout: { sessions: { create: jest.fn() } },
    accounts: { retrieve: jest.fn() },
    customers: { create: jest.fn(), list: jest.fn(), update: jest.fn() },
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

  it("uses orderRef in line names + metadata when provided", async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ url: "u", id: "cs_4", expires_at: 0 });
    await createPaymentIntent("acct", 200, "cid", "Sneaker Society - Nike Air", {
      shippingFee: 30,
      insuranceFee: 24,
      shippingSpeed: "standard",
      orderRef: "SS-ABC123",
    });
    const call = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(call.line_items).toHaveLength(3);
    for (const item of call.line_items) {
      expect(item.price_data.product_data.name).toContain("SS-ABC123");
      expect(item.price_data.product_data.name).not.toContain("cid");
    }
    expect(call.metadata.orderRef).toBe("SS-ABC123");
  });

  it("falls back to contractId suffix without orderRef", async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ url: "u", id: "cs_5", expires_at: 0 });
    await createPaymentIntent("acct", 200, "cid9", "prod");
    const call = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(call.line_items).toHaveLength(1);
    expect(call.line_items[0].price_data.product_data.name).toContain("cid9");
  });

  it("enables Stripe Tax with US shipping collection for tax calculation", async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ url: "u", id: "cs_tax", expires_at: 0 });
    await createPaymentIntent("acct", 100, "cid", "prod");
    const call = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(call.automatic_tax).toEqual({ enabled: true });
    // Guest checkout has no `customer`, and Stripe rejects `customer_update`
    // without one — tax is calculated from the collected address instead.
    expect(call.customer_update).toBeUndefined();
    expect(call.customer).toBeUndefined();
    expect(call.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
  });

  it("sends customer_update with a prefilled customer so Stripe Tax reads back edits", async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ url: "u", id: "cs_cust", expires_at: 0 });
    stripe.customers.list.mockResolvedValue({ data: [{ id: "cus_9" }] });
    await createPaymentIntent("acct", 100, "cid", "prod", {
      customerEmail: "t@e.com",
      customerShipping: { line1: "1 Main St", city: "Chicago", postal_code: "60601", country: "US" },
    });
    const call = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(call.customer).toBe("cus_9");
    expect(call.customer_update).toEqual({ shipping: "auto" });
  });

  it("assigns per-line tax codes (service/shipping/insurance)", async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ url: "u", id: "cs_tax2", expires_at: 0 });
    await createPaymentIntent("acct", 100, "cid", "prod", {
      shippingFee: 30,
      insuranceFee: 24,
      shippingSpeed: "standard",
      orderRef: "SS-TAX123",
    });
    const call = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(call.line_items).toHaveLength(3);
    expect(call.line_items[0].price_data.product_data.tax_code).toBe("txcd_20030000");
    expect(call.line_items[1].price_data.product_data.tax_code).toBe("txcd_92010001");
    expect(call.line_items[2].price_data.product_data.tax_code).toBe("txcd_10000000");
  });

  it("prefills a known customer address and falls back to guest on failure", async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ url: "u", id: "cs_pre", expires_at: 0 });
    stripe.customers.list.mockResolvedValue({ data: [{ id: "cus_1" }] });
    const ship = { name: "Test User", line1: "1 Main St", city: "Chicago", postal_code: "60601", country: "US" };
    await createPaymentIntent("acct", 100, "cid", "prod", {
      customerEmail: "t@e.com",
      customerShipping: ship,
    });
    expect(stripe.customers.update).toHaveBeenCalledWith("cus_1", expect.objectContaining({
      shipping: expect.objectContaining({ address: expect.objectContaining({ line1: "1 Main St" }) }),
    }));
    expect(stripe.checkout.sessions.create.mock.calls[0][0].customer).toBe("cus_1");

    stripe.customers.list.mockRejectedValueOnce(new Error("stripe down"));
    await createPaymentIntent("acct", 100, "cid", "prod", {
      customerEmail: "t@e.com",
      customerShipping: ship,
    });
    const fallback = stripe.checkout.sessions.create.mock.calls[1][0];
    expect(fallback.customer).toBeUndefined();
    expect(fallback.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
  });

  it("creates a metadata-tagged customer when no dbUserId match exists", async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ url: "u", id: "cs_new", expires_at: 0 });
    stripe.customers.list.mockResolvedValue({ data: [{ id: "cus_stranger", metadata: {} }] });
    stripe.customers.create.mockResolvedValue({ id: "cus_mine" });
    const ship = { line1: "1 Main St", city: "Chicago", postal_code: "60601", country: "US" };
    await createPaymentIntent("acct", 100, "cidX", "prod", {
      customerEmail: "t@e.com",
      customerShipping: ship,
      dbUserId: "dbU1",
    });
    expect(stripe.customers.create).toHaveBeenCalledWith(expect.objectContaining({
      email: "t@e.com",
      metadata: expect.objectContaining({ dbUserId: "dbU1", contractId: "cidX" }),
    }));
    expect(stripe.checkout.sessions.create.mock.calls[0][0].customer).toBe("cus_mine");
  });

  it("prefills email only for guest sessions without a shippable address", async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ url: "u", id: "cs_mail", expires_at: 0 });
    await createPaymentIntent("acct", 100, "cid", "prod", { customerEmail: "t@e.com" });
    const call = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(call.customer).toBeUndefined();
    expect(call.customer_email).toBe("t@e.com");
  });
});
