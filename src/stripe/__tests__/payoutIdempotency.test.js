jest.mock("../config.js", () => ({
  stripe: {
    transfers: { create: jest.fn() },
  },
}));
jest.mock("../../models/Member.model", () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock("../../config/redis", () => ({ get: jest.fn() }));
jest.mock("../../utils/redis/stripeSubscritpitonCache", () => ({ syncStripeDataToKV: jest.fn() }));

import { stripe } from "../config.js";
import { releasePayoutToMember } from "../stripe.service.js";

describe("releasePayoutToMember transfer idempotency (plan-escrow-dispute.md §4)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("passes idempotencyKey payout-<contractId> so cron double-runs mint one transfer", async () => {
    stripe.transfers.create.mockResolvedValue({ id: "tr_1" });
    const transfer = await releasePayoutToMember("acct_1", 17000, "c1");
    expect(transfer.id).toBe("tr_1");
    expect(stripe.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 17000,
        currency: "usd",
        destination: "acct_1",
        metadata: { contractId: "c1" },
      }),
      expect.objectContaining({ idempotencyKey: "payout-c1" })
    );
  });
});
