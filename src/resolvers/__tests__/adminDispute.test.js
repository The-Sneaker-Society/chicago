import contractResolvers from "../contracts.js";
import { contractService } from "../../contracts/contract.service.js";
import { ForbiddenError } from "apollo-server-core";

jest.mock("../../contracts/contract.service.js");

describe("Admin Dispute Dashboard & P&L (Feature 11)", () => {
  const adminCtx = { role: "admin", userId: "admin_clerk_123" };
  const memberCtx = { role: "member", userId: "mem_clerk_456", dbUser: { _id: "mem_1" } };
  const clientCtx = { role: "client", userId: "user_clerk_789", dbUser: { _id: "cli_1" } };
  const unauthCtx = {};

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Access Control & Authorization Guards", () => {
    test("adminDisputeQueue: allows admin caller", async () => {
      contractService.getDisputeQueue.mockResolvedValue({ items: [], total: 0 });
      const result = await contractResolvers.Query.adminDisputeQueue(
        null,
        { limit: 10, offset: 0 },
        adminCtx
      );
      expect(result).toEqual({ items: [], total: 0 });
      expect(contractService.getDisputeQueue).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    });

    test("adminDisputeQueue: rejects non-admin caller with ForbiddenError", async () => {
      await expect(
        contractResolvers.Query.adminDisputeQueue(null, {}, memberCtx)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        contractResolvers.Query.adminDisputeQueue(null, {}, clientCtx)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        contractResolvers.Query.adminDisputeQueue(null, {}, unauthCtx)
      ).rejects.toThrow(ForbiddenError);
    });

    test("adminDisputeDetail: allows admin caller", async () => {
      const mockDetail = {
        contract: { id: "c1", orderRef: "SS-ABC123" },
        chatMessages: [],
        pnl: { grossCollected: 150 },
      };
      contractService.getDisputeDetail.mockResolvedValue(mockDetail);

      const result = await contractResolvers.Query.adminDisputeDetail(
        null,
        { orderRef: "SS-ABC123" },
        adminCtx
      );
      expect(result).toEqual(mockDetail);
      expect(contractService.getDisputeDetail).toHaveBeenCalledWith("SS-ABC123");
    });

    test("adminDisputeDetail: rejects non-admin caller", async () => {
      await expect(
        contractResolvers.Query.adminDisputeDetail(null, { orderRef: "SS-ABC123" }, memberCtx)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        contractResolvers.Query.adminDisputeDetail(null, { orderRef: "SS-ABC123" }, clientCtx)
      ).rejects.toThrow(ForbiddenError);
    });

    test("resolveDisputeForUser: requires admin", async () => {
      contractService.resolveDisputeForUser.mockResolvedValue(true);
      const result = await contractResolvers.Mutation.resolveDisputeForUser(
        null,
        { contractId: "c1", banMember: true, reason: "Fraud" },
        adminCtx
      );
      expect(result).toBe(true);
      expect(contractService.resolveDisputeForUser).toHaveBeenCalledWith("c1", {
        banMember: true,
        reason: "Fraud",
        adminActor: "admin:admin_clerk_123",
      });

      await expect(
        contractResolvers.Mutation.resolveDisputeForUser(null, { contractId: "c1" }, memberCtx)
      ).rejects.toThrow(ForbiddenError);
    });

    test("resolveDisputeForMember: requires admin", async () => {
      contractService.resolveDisputeForMember.mockResolvedValue(true);
      const result = await contractResolvers.Mutation.resolveDisputeForMember(
        null,
        { contractId: "c1", banUser: false, reason: "Customer damage" },
        adminCtx
      );
      expect(result).toBe(true);
      expect(contractService.resolveDisputeForMember).toHaveBeenCalledWith("c1", {
        banUser: false,
        reason: "Customer damage",
        adminActor: "admin:admin_clerk_123",
      });

      await expect(
        contractResolvers.Mutation.resolveDisputeForMember(null, { contractId: "c1" }, clientCtx)
      ).rejects.toThrow(ForbiddenError);
    });

    test("resolveDisputeInconclusive: requires admin", async () => {
      contractService.resolveDisputeInconclusive.mockResolvedValue(true);
      const result = await contractResolvers.Mutation.resolveDisputeInconclusive(
        null,
        { contractId: "c1", refundCents: 5000, payoutCents: 5000, banBoth: false, reason: "Lost in transit" },
        adminCtx
      );
      expect(result).toBe(true);
      expect(contractService.resolveDisputeInconclusive).toHaveBeenCalledWith("c1", {
        refundCents: 5000,
        payoutCents: 5000,
        banBoth: false,
        reason: "Lost in transit",
        adminActor: "admin:admin_clerk_123",
      });

      await expect(
        contractResolvers.Mutation.resolveDisputeInconclusive(
          null,
          { contractId: "c1", refundCents: 5000, payoutCents: 5000 },
          memberCtx
        )
      ).rejects.toThrow(ForbiddenError);
    });

    test("chargeMemberDebt: requires admin and passes actor through", async () => {
      contractService.chargeMemberDebt.mockResolvedValue("entry1");
      const result = await contractResolvers.Mutation.chargeMemberDebt(
        null,
        { memberId: "m1", contractId: "c1", type: "RETURN_LABEL", amountCents: 5400, reason: "Return label" },
        adminCtx
      );
      expect(result).toBe("entry1");
      expect(contractService.chargeMemberDebt).toHaveBeenCalledWith({
        memberId: "m1",
        contractId: "c1",
        type: "RETURN_LABEL",
        amountCents: 5400,
        reason: "Return label",
        adminActor: "admin:admin_clerk_123",
      });

      await expect(
        contractResolvers.Mutation.chargeMemberDebt(
          null,
          { memberId: "m1", contractId: "c1", amountCents: 100 },
          memberCtx
        )
      ).rejects.toThrow(ForbiddenError);
    });

    test("writeOffMemberDebt: requires admin", async () => {
      contractService.writeOffMemberDebt.mockResolvedValue(true);
      const result = await contractResolvers.Mutation.writeOffMemberDebt(
        null,
        { entryId: "e1", reason: "Uncollectible" },
        adminCtx
      );
      expect(result).toBe(true);
      expect(contractService.writeOffMemberDebt).toHaveBeenCalledWith("e1", {
        reason: "Uncollectible",
        adminActor: "admin:admin_clerk_123",
      });

      await expect(
        contractResolvers.Mutation.writeOffMemberDebt(null, { entryId: "e1" }, clientCtx)
      ).rejects.toThrow(ForbiddenError);
    });

    test("dismissDispute: requires admin and passes resume through", async () => {
      contractService.dismissDispute.mockResolvedValue(true);
      const result = await contractResolvers.Mutation.dismissDispute(
        null,
        { contractId: "c1", resumeStatus: "INBOUND_SHIPPED", reason: "No need" },
        adminCtx
      );
      expect(result).toBe(true);
      expect(contractService.dismissDispute).toHaveBeenCalledWith("c1", {
        resumeStatus: "INBOUND_SHIPPED",
        banUser: undefined,
        banMember: undefined,
        reason: "No need",
        adminActor: "admin:admin_clerk_123",
      });

      await expect(
        contractResolvers.Mutation.dismissDispute(null, { contractId: "c1" }, memberCtx)
      ).rejects.toThrow(ForbiddenError);
    });

    test("memberOutstandingDebt: requires admin and returns dollars", async () => {      contractService.memberOutstandingDebt.mockResolvedValue(5400);
      const result = await contractResolvers.Query.memberOutstandingDebt(
        null,
        { memberId: "m1" },
        adminCtx
      );
      expect(result).toBe(54);
      expect(contractService.memberOutstandingDebt).toHaveBeenCalledWith("m1");

      await expect(
        contractResolvers.Query.memberOutstandingDebt(null, { memberId: "m1" }, memberCtx)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Contract Unit Economics & P&L Calculations", () => {
    test("Contract.pnl field resolver calls computeContractPnL", () => {
      const mockContract = { id: "c1", price: 100 };
      const mockPnL = { grossCollected: 144.25, netPlatformProfit: 18.82 };
      contractService.computeContractPnL.mockReturnValue(mockPnL);

      const result = contractResolvers.Contract.pnl(mockContract);
      expect(result).toEqual(mockPnL);
      expect(contractService.computeContractPnL).toHaveBeenCalledWith(mockContract);
    });
  });
});

describe("computeContractPnL math logic", () => {
  const { computeContractPnL } = jest.requireActual("../../contracts/contract.service.js");

  test("calculates exact inflows, outflows, spreads, and margins", () => {
    const contract = {
      price: 100,
      shippingFee: 30,
      insuranceFee: 6,
      taxFee: 8.25,
      platformFee: 15,
      payoutAmount: 85,
      labelCostActual: 24.50,
      insurancePremiumActual: 3.20,
    };

    const pnl = computeContractPnL(contract);

    expect(pnl.grossCollected).toBe(144.25);
    expect(pnl.servicePrice).toBe(100);
    expect(pnl.shippingFee).toBe(30);
    expect(pnl.insuranceFee).toBe(6);
    expect(pnl.taxFee).toBe(8.25);
    expect(pnl.payoutAmount).toBe(85);
    expect(pnl.platformFee).toBe(15);
    expect(pnl.actualLabelCost).toBe(24.50);
    expect(pnl.actualInsurancePremium).toBe(3.20);
    // Stripe fee: 144.25 * 0.029 + 0.30 = 4.18325 + 0.30 = 4.48325 -> 4.48
    expect(pnl.estimatedStripeFee).toBe(4.48);
    expect(pnl.salesTaxRemittance).toBe(8.25);
    // Total outflows: 85 + 24.50 + 3.20 + 4.48 + 8.25 = 125.43
    expect(pnl.totalOutflows).toBe(125.43);
    // Net profit: 144.25 - 125.43 = 18.82
    expect(pnl.netPlatformProfit).toBe(18.82);
    // Net margin %: 18.82 / 144.25 = 13.046... -> 13.0%
    expect(pnl.netPlatformMarginPercent).toBe(13.0);
    // Spreads
    expect(pnl.shippingSpread).toBe(5.50);
    expect(pnl.insuranceSpread).toBe(2.80);
  });

  test("gracefully handles null or zero values", () => {
    const pnl = computeContractPnL({});
    expect(pnl.grossCollected).toBe(0);
    expect(pnl.netPlatformProfit).toBe(0);
    expect(pnl.netPlatformMarginPercent).toBe(0);
  });

  test("falls back to pass-through costs when labels exist or insurance was purchased without explicit actual costs", () => {
    const contract = {
      price: 189,
      shippingFee: 22.28,
      insuranceFee: 26.39,
      taxFee: 0,
      platformFee: 28.35,
      payoutAmount: 160.65,
      inboundLabelUrl: "https://deliver.goshippo.com/test.pdf",
    };

    const pnl = computeContractPnL(contract);

    expect(pnl.grossCollected).toBe(237.67);
    expect(pnl.actualLabelCost).toBe(22.28);
    expect(pnl.actualInsurancePremium).toBe(26.39);
    expect(pnl.shippingSpread).toBe(0);
    expect(pnl.insuranceSpread).toBe(0);
    // Outflows: 160.65 + 22.28 + 26.39 + 7.19 + 0 = 216.51
    expect(pnl.totalOutflows).toBe(216.51);
    // Net profit: 237.67 - 216.51 = 21.16
    expect(pnl.netPlatformProfit).toBe(21.16);
    expect(pnl.netPlatformMarginPercent).toBe(8.9);
  });
});
