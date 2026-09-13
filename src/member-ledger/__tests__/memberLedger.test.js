import { contractService } from "../../contracts/contract.service.js";
import { contractRepository } from "../../contracts/contract.repository.js";
import { memberRepository } from "../../members/member.repository.js";
import { memberLedgerRepository } from "../member-ledger.repository.js";
import {
  contractStatus,
  contractEvent,
  payoutStatus,
} from "../../contracts/contract.constants.js";
import { ledgerErrors } from "../member-ledger.constants.js";
import * as stripeService from "../../stripe/stripe.service.js";

jest.mock("../../contracts/contract.repository.js");
jest.mock("../../models/Contract.model.js", () => ({
  __esModule: true,
  default: { find: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn() },
}));
jest.mock("../../members/member.repository.js");
jest.mock("../../users/user.repository.js", () => ({ userRepository: { findById: jest.fn() } }));
jest.mock("../../chat/chat.repository.js", () => ({
  chatRepository: { findPendingProposals: jest.fn(), saveMessage: jest.fn() },
}));
jest.mock("../../member-ledger/member-ledger.repository.js");
jest.mock("../../stripe/stripe.service.js", () => ({
  createPaymentIntent: jest.fn(),
  expireCheckoutSession: jest.fn(),
  releasePayoutToMember: jest.fn(),
  refundContractPayment: jest.fn(),
  getPaymentIntentDetails: jest.fn(),
}));
jest.mock("../../shipping/shipping.service.js", () => ({
  shippingService: {
    normalizeTrackingStatus: jest.fn(),
    verifyShippoEvent: jest.fn(),
    quoteRoundTrip: jest.fn(),
  },
}));

const MEMBER = "m1";
const baseContract = (overrides = {}) => ({
  _id: "c1",
  clientId: "u1",
  memberId: MEMBER,
  orderRef: "SS-TEST01",
  status: contractStatus.deliveredToUser,
  payoutStatus: payoutStatus.pending,
  payoutAmount: 200,
  timeline: [],
  ...overrides,
});

const ledgerEntry = (overrides = {}) => ({
  _id: "e1",
  memberId: MEMBER,
  contractId: "c0",
  orderRef: "SS-OLD01",
  type: "RETURN_LABEL",
  amountCents: 5000,
  settledCents: 0,
  status: "OUTSTANDING",
  ...overrides,
});

describe("Member debt ledger (Option B)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    memberRepository.findById.mockResolvedValue({
      _id: MEMBER,
      stripeConnectAccountId: "acct_1",
    });
  });

  describe("chargeMemberDebt", () => {
    test("creates entry and timeline event", async () => {
      contractRepository.findById.mockResolvedValue(baseContract());
      memberLedgerRepository.create.mockResolvedValue({ _id: "entry1" });
      contractRepository.updateById.mockResolvedValue({});

      const id = await contractService.chargeMemberDebt({
        memberId: MEMBER,
        contractId: "c1",
        type: "RETURN_LABEL",
        amountCents: 5400,
        reason: "Return label + outbound",
        adminActor: "admin:123",
      });

      expect(id).toBe("entry1");
      expect(memberLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 5400,
          settledCents: 0,
          status: "OUTSTANDING",
          createdBy: "admin:123",
        })
      );
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          $push: expect.objectContaining({
            timeline: expect.objectContaining({
              event: contractEvent.returnShipmentChargedToMember,
              actor: "admin:123",
            }),
          }),
        })
      );
    });

    test("rejects bad member, contract, and amounts", async () => {
      memberRepository.findById.mockResolvedValueOnce(null);
      await expect(
        contractService.chargeMemberDebt({ memberId: "nope", contractId: "c1", amountCents: 100 })
      ).rejects.toThrow(ledgerErrors.MEMBER_NOT_FOUND);

      memberRepository.findById.mockResolvedValue({ _id: MEMBER });
      contractRepository.findById.mockResolvedValue(null);
      await expect(
        contractService.chargeMemberDebt({ memberId: MEMBER, contractId: "nope", amountCents: 100 })
      ).rejects.toThrow(ledgerErrors.CONTRACT_NOT_FOUND);

      contractRepository.findById.mockResolvedValue(baseContract());
      for (const bad of [0, -100, 10.5, NaN]) {
        await expect(
          contractService.chargeMemberDebt({ memberId: MEMBER, contractId: "c1", amountCents: bad })
        ).rejects.toThrow(ledgerErrors.INVALID_AMOUNT);
      }
    });
  });

  describe("planDebtNetting", () => {
    test("settles FIFO and floors at zero", async () => {
      memberLedgerRepository.findOutstandingByMember.mockResolvedValue([
        ledgerEntry({ _id: "e1", amountCents: 5000, settledCents: 0 }),
        ledgerEntry({ _id: "e2", amountCents: 3000, settledCents: 0 }),
      ]);

      const { netCents, plan } = await contractService.planDebtNetting(MEMBER, 9000);
      expect(netCents).toBe(1000);
      expect(plan).toEqual([
        expect.objectContaining({ entryId: "e1", takeCents: 5000 }),
        expect.objectContaining({ entryId: "e2", takeCents: 3000 }),
      ]);
      // read-only: nothing persisted by planning
      expect(memberLedgerRepository.markSettled).not.toHaveBeenCalled();
      expect(memberLedgerRepository.applyPartial).not.toHaveBeenCalled();
    });

    test("fully consumed payout nets to zero and carries remainder", async () => {
      memberLedgerRepository.findOutstandingByMember.mockResolvedValue([
        ledgerEntry({ _id: "e1", amountCents: 5000, settledCents: 0 }),
      ]);
      const { netCents, plan } = await contractService.planDebtNetting(MEMBER, 2000);
      expect(netCents).toBe(0);
      expect(plan[0].takeCents).toBe(2000);
      expect(plan[0].willSettle).toBe(false);
    });

    test("no debts passes gross through untouched", async () => {
      memberLedgerRepository.findOutstandingByMember.mockResolvedValue([]);
      const { netCents, plan } = await contractService.planDebtNetting(MEMBER, 20000);
      expect(netCents).toBe(20000);
      expect(plan).toEqual([]);
    });
  });

  describe("commitDebtSettlement", () => {
    test("marks full takes settled and partials partial", async () => {
      await contractService.commitDebtSettlement([
        { entryId: "e1", orderRef: "SS-A", takeCents: 5000, newSettledCents: 5000, willSettle: true },
        { entryId: "e2", orderRef: "SS-B", takeCents: 1000, newSettledCents: 1000, willSettle: false },
      ]);
      expect(memberLedgerRepository.markSettled).toHaveBeenCalledWith("e1", 5000);
      expect(memberLedgerRepository.applyPartial).toHaveBeenCalledWith("e2", 1000);
    });
  });

  describe("releasePayout with debts", () => {
    test("nets transfer, commits settlement, notes withholding", async () => {
      contractRepository.findById.mockResolvedValue(baseContract());
      memberLedgerRepository.findOutstandingByMember.mockResolvedValue([
        ledgerEntry({ _id: "e1", amountCents: 5400, settledCents: 0 }),
      ]);
      stripeService.releasePayoutToMember.mockResolvedValue({ id: "tr_1" });
      contractRepository.updateById.mockResolvedValue({});
      contractRepository.findByOrderRef.mockResolvedValue(null);

      const result = await contractService.releasePayout("c1");
      expect(result).toBe(true);
      // $200 payout − $54 debt = $146 transfer
      expect(stripeService.releasePayoutToMember).toHaveBeenCalledWith("acct_1", 14600, "c1");
      expect(memberLedgerRepository.markSettled).toHaveBeenCalledWith("e1", 5400);
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          payoutStatus: payoutStatus.paid,
          stripeTransferId: "tr_1",
        })
      );
      const updateArg = contractRepository.updateById.mock.calls[0][1];
      const events = updateArg.$push.timeline.$each;
      expect(events.map((e) => e.event)).toContain(contractEvent.payoutWithheldForDebt);
    });

    test("no debts transfers gross with no withholding event", async () => {
      contractRepository.findById.mockResolvedValue(baseContract());
      memberLedgerRepository.findOutstandingByMember.mockResolvedValue([]);
      stripeService.releasePayoutToMember.mockResolvedValue({ id: "tr_2" });
      contractRepository.updateById.mockResolvedValue({});

      await contractService.releasePayout("c1");
      expect(stripeService.releasePayoutToMember).toHaveBeenCalledWith("acct_1", 20000, "c1");
      const updateArg = contractRepository.updateById.mock.calls[0][1];
      const events = updateArg.$push.timeline.$each;
      expect(events.map((e) => e.event)).not.toContain(contractEvent.payoutWithheldForDebt);
    });

    test("fully consumed payout skips Stripe and still marks paid", async () => {
      contractRepository.findById.mockResolvedValue(baseContract({ payoutAmount: 20 }));
      memberLedgerRepository.findOutstandingByMember.mockResolvedValue([
        ledgerEntry({ _id: "e1", amountCents: 5400, settledCents: 0 }),
      ]);
      contractRepository.updateById.mockResolvedValue({});
      contractRepository.findByOrderRef.mockResolvedValue(null);

      await contractService.releasePayout("c1");
      expect(stripeService.releasePayoutToMember).not.toHaveBeenCalled();
      expect(memberLedgerRepository.applyPartial).toHaveBeenCalledWith("e1", 2000);
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({ payoutStatus: payoutStatus.paid })
      );
    });
  });
});
