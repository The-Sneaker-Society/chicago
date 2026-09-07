import { memberService } from "../member.service.js";
import { contractRepository } from "../../contracts/contract.repository.js";
import * as stripeService from "../../stripe/stripe.service.js";

jest.mock("../../contracts/contract.repository.js");
jest.mock("../../stripe/stripe.service.js");

describe("memberService.getStripeWidgetData", () => {
  const dbUser = {
    _id: "member123",
    stripeConnectAccountId: "acct_123",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    stripeService.getAccountStatus = jest.fn().mockResolvedValue("active");
  });

  it("returns percentChange = 0 when pendingAmount is 0 and previous payout exists", async () => {
    contractRepository.findPendingPayoutsByMember.mockResolvedValue([
      { total: 0, count: 0, totalFees: 0, totalGross: 0 },
    ]);
    const paidAtDate = new Date("2026-09-07T00:00:00.000Z");
    contractRepository.findLatestPaidByMember.mockResolvedValue({
      payoutAmount: 150,
      paidAt: paidAtDate,
    });

    const result = await memberService.getStripeWidgetData(dbUser);

    expect(result.percentChange).toBe(0);
    expect(result.payoutAmount).toBe("$0.00");
    expect(result.previousPayoutAmount).toBe("$150.00");
    expect(result.lastPayoutDate).toBe(paidAtDate.toISOString());
    expect(result.pendingCount).toBe(0);
  });

  it("calculates positive percentChange when pendingAmount > previous payout", async () => {
    contractRepository.findPendingPayoutsByMember.mockResolvedValue([
      { total: 200, count: 2, totalFees: 10, totalGross: 210 },
    ]);
    contractRepository.findLatestPaidByMember.mockResolvedValue({
      payoutAmount: 100,
      paidAt: new Date("2026-09-01T00:00:00.000Z"),
    });

    const result = await memberService.getStripeWidgetData(dbUser);

    expect(result.percentChange).toBe(100);
    expect(result.payoutAmount).toBe("$200.00");
    expect(result.pendingCount).toBe(2);
  });

  it("returns null for lastPayoutDate when no previous payout exists", async () => {
    contractRepository.findPendingPayoutsByMember.mockResolvedValue([]);
    contractRepository.findLatestPaidByMember.mockResolvedValue(null);

    const result = await memberService.getStripeWidgetData(dbUser);

    expect(result.percentChange).toBe(0);
    expect(result.lastPayoutDate).toBeNull();
    expect(result.previousPayoutAmount).toBeNull();
  });
});
