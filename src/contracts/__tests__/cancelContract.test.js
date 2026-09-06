import { contractService } from "../contract.service.js";
import { contractRepository } from "../contract.repository.js";
import { chatRepository } from "../../chat/chat.repository.js";
import { contractStatus, contractEvent, contractErrors, payoutStatus } from "../contract.constants.js";
import { assertTransition, TRANSITIONS } from "../contract.transitions.js";
import * as stripeService from "../../stripe/stripe.service.js";

jest.mock("../contract.repository.js");
jest.mock("../../chat/chat.repository.js");
jest.mock("../../stripe/stripe.service.js");

describe("Contract Transitions & Cancellation Flow (Feature #10)", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("assertTransition", () => {
    test("allows valid negotiation transitions", () => {
      expect(() =>
        assertTransition(contractStatus.pendingReview, contractStatus.priceProposed)
      ).not.toThrow();
      expect(() =>
        assertTransition(contractStatus.pendingReview, contractStatus.canceled)
      ).not.toThrow();
      expect(() =>
        assertTransition(contractStatus.priceProposed, contractStatus.awaitingPayment)
      ).not.toThrow();
      expect(() =>
        assertTransition(contractStatus.priceProposed, contractStatus.priceProposed)
      ).not.toThrow();
      expect(() =>
        assertTransition(contractStatus.awaitingPayment, contractStatus.readyToShip)
      ).not.toThrow();
      expect(() =>
        assertTransition(contractStatus.readyToShip, contractStatus.inboundShipped)
      ).not.toThrow();
      expect(() =>
        assertTransition(contractStatus.readyToShip, contractStatus.canceled)
      ).not.toThrow();
    });

    test("disallows illegal transitions for normal users", () => {
      expect(() =>
        assertTransition(contractStatus.inboundShipped, contractStatus.canceled)
      ).toThrow();
      expect(() =>
        assertTransition(contractStatus.workInProgress, contractStatus.readyToShip)
      ).toThrow();
      expect(() =>
        assertTransition(contractStatus.canceled, contractStatus.pendingReview)
      ).toThrow();
    });

    test("admin can override transition to CANCELED from non-terminal states", () => {
      expect(() =>
        assertTransition(contractStatus.inboundShipped, contractStatus.canceled, true)
      ).not.toThrow();
      expect(() =>
        assertTransition(contractStatus.workInProgress, contractStatus.canceled, true)
      ).not.toThrow();
    });

    test("admin cannot cancel an already canceled or completed contract", () => {
      expect(() =>
        assertTransition(contractStatus.canceled, contractStatus.canceled, true)
      ).toThrow();
      expect(() =>
        assertTransition(contractStatus.completed, contractStatus.canceled, true)
      ).toThrow();
    });
  });

  describe("updateContract Denylist", () => {
    test("strips status, payoutStatus, and financial fields from input", async () => {
      const mockContract = {
        _id: "c1",
        memberId: "m1",
        status: contractStatus.pendingReview,
        payoutStatus: payoutStatus.pending,
        repairDetails: {},
        shoeDetails: {},
        inboundTracking: {},
        outboundTracking: {},
      };
      contractRepository.findById.mockResolvedValue(mockContract);
      contractRepository.save.mockResolvedValue(mockContract);

      await contractService.updateContract("m1", "c1", {
        status: contractStatus.completed,
        payoutStatus: payoutStatus.paid,
        stripePaymentIntentId: "pi_fake",
        taxFee: 999,
        platformFee: 999,
        payoutAmount: 999,
        afterFormNotes: "Legit update",
      });

      expect(mockContract.status).toBe(contractStatus.pendingReview);
      expect(mockContract.payoutStatus).toBe(payoutStatus.pending);
      expect(mockContract.stripePaymentIntentId).toBeUndefined();
      expect(mockContract.afterFormNotes).toBe("Legit update");
      expect(contractRepository.save).toHaveBeenCalledWith(mockContract);
    });
  });

  describe("cancelContract - Pre-payment (Stage A)", () => {
    test("cancels contract in PENDING_REVIEW, expires checkout, and updates chat proposals", async () => {
      const mockContract = {
        _id: "c100",
        clientId: "u1",
        memberId: "m1",
        chatId: "chat1",
        status: contractStatus.pendingReview,
      };

      contractRepository.findByIdForParty.mockResolvedValue(mockContract);
      contractRepository.findById.mockResolvedValue(mockContract);
      contractRepository.updateById.mockResolvedValue({ ...mockContract, status: contractStatus.canceled });

      const pendingProposal = {
        _id: "msg1",
        chatId: "chat1",
        type: "PRICE_PROPOSAL",
        metadata: {
          status: "pending",
          checkoutSessionId: "cs_123",
        },
      };
      chatRepository.findPendingProposals.mockResolvedValue([pendingProposal]);
      chatRepository.saveMessage.mockResolvedValue(true);
      stripeService.expireCheckoutSession.mockResolvedValue(true);

      const publish = jest.fn();
      const ctx = { role: "client", dbUser: { _id: "u1" } };

      const result = await contractService.cancelContract("c100", "Changed mind", ctx, publish);

      expect(result).toBe(true);
      expect(pendingProposal.metadata.status).toBe("canceled");
      expect(stripeService.expireCheckoutSession).toHaveBeenCalledWith("cs_123");
      expect(publish).toHaveBeenCalledWith(
        "MESSAGE_UPDATED chat1",
        expect.objectContaining({
          messageUpdated: expect.objectContaining({ id: "msg1" }),
        })
      );
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c100",
        expect.objectContaining({
          status: contractStatus.canceled,
          $push: {
            timeline: expect.objectContaining({ event: contractEvent.contractCanceled }),
          },
        }),
        expect.any(Object)
      );
      // No refund called for pre-payment stage
      expect(stripeService.refundContractPayment).not.toHaveBeenCalled();
    });
  });

  describe("cancelContract - Post-payment (Stage B - READY_TO_SHIP)", () => {
    test("refunds service fee + tax minus label costs and Stripe processing fee", async () => {
      const mockContract = {
        _id: "c200",
        clientId: "u1",
        memberId: "m1",
        status: contractStatus.readyToShip,
        stripePaymentIntentId: "pi_paid_123",
        proposedPrice: 200,
        shippingFee: 30,
        insuranceFee: 10,
        taxFee: 15,
        inboundShipmentId: "shp_inbound_1",
        outboundShipmentId: "shp_outbound_1",
      };

      contractRepository.findByIdForParty.mockResolvedValue(mockContract);
      contractRepository.findById.mockResolvedValue(mockContract);
      contractRepository.updateById.mockResolvedValue({ ...mockContract, status: contractStatus.canceled });
      chatRepository.findPendingProposals.mockResolvedValue([]);
      stripeService.getPaymentIntentDetails.mockResolvedValue({
        amountTotalCents: 25500,
        feeCents: 989,
      });
      stripeService.refundContractPayment.mockResolvedValue({ id: "re_123" });

      const ctx = { role: "client", dbUser: { _id: "u1" } };
      await contractService.cancelContract("c200", "No longer need service", ctx);

      // Total paid from Stripe = 25500 cents
      // Label cost = 30 + 10 = $40.00 (4000 cents)
      // Stripe fee = $9.89 (989 cents)
      // Refund = 25500 - 4000 - 989 = 20511 cents ($205.11)
      expect(stripeService.refundContractPayment).toHaveBeenCalledWith({
        paymentIntentId: "pi_paid_123",
        amountCents: 20511,
        reason: "requested_by_customer",
        contractId: "c200",
      });

      // Atomic update combining payoutStatus, status, and timeline with reason, actor, refundCents
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c200",
        expect.objectContaining({
          status: contractStatus.canceled,
          payoutStatus: payoutStatus.canceled,
          $push: {
            timeline: expect.objectContaining({
              event: contractEvent.contractCanceled,
              reason: "No longer need service",
              actor: "client",
              refundCents: 20511,
            }),
          },
        }),
        expect.any(Object)
      );
    });

    test("member cannot cancel at READY_TO_SHIP and receives CANCEL_NOT_ALLOWED", async () => {
      const mockContract = {
        _id: "c202",
        clientId: "u1",
        memberId: "m1",
        status: contractStatus.readyToShip,
      };

      contractRepository.findByIdForParty.mockResolvedValue(mockContract);
      const ctx = { role: "member", dbUser: { _id: "m1" } };

      await expect(
        contractService.cancelContract("c202", "Member wants to flake", ctx)
      ).rejects.toThrow(contractErrors.CANCEL_NOT_ALLOWED);
    });
  });

  describe("cancelContract - In-transit / Later Stages (Stage C+)", () => {
    test("throws CANCEL_NOT_ALLOWED for regular users in INBOUND_SHIPPED", async () => {
      const mockContract = {
        _id: "c300",
        clientId: "u1",
        memberId: "m1",
        status: contractStatus.inboundShipped,
      };

      contractRepository.findByIdForParty.mockResolvedValue(mockContract);
      const ctx = { role: "client", dbUser: { _id: "u1" } };

      await expect(
        contractService.cancelContract("c300", "Cancel mid-transit", ctx)
      ).rejects.toThrow(contractErrors.CANCEL_NOT_ALLOWED);
    });

    test("admin force-cancel from WORK_IN_PROGRESS does NOT auto-refund and cancels payout", async () => {
      const mockContract = {
        _id: "c302",
        clientId: "u1",
        memberId: "m1",
        status: contractStatus.workInProgress,
        stripePaymentIntentId: "pi_paid_456",
        proposedPrice: 300,
      };

      contractRepository.findById.mockResolvedValue(mockContract);
      contractRepository.updateById.mockResolvedValue({ ...mockContract, status: contractStatus.canceled });
      chatRepository.findPendingProposals.mockResolvedValue([]);

      const ctx = { role: "admin" };
      const result = await contractService.cancelContract("c302", "Admin mid-flight intervention", ctx);

      expect(result).toBe(true);
      // Blocker verification: auto-refund must NOT fire for post-shipment stages (manual review required)
      expect(stripeService.refundContractPayment).not.toHaveBeenCalled();
      // Payout is canceled atomically
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c302",
        expect.objectContaining({
          status: contractStatus.canceled,
          payoutStatus: payoutStatus.canceled,
          $push: {
            timeline: expect.objectContaining({
              event: contractEvent.contractCanceled,
              reason: "Admin mid-flight intervention",
              actor: "admin",
              refundCents: 0,
            }),
          },
        }),
        expect.any(Object)
      );
    });

    test("allows Admin force-cancel from INBOUND_SHIPPED", async () => {
      const mockContract = {
        _id: "c301",
        clientId: "u1",
        memberId: "m1",
        status: contractStatus.inboundShipped,
      };

      contractRepository.findById.mockResolvedValue(mockContract);
      contractRepository.updateById.mockResolvedValue({ ...mockContract, status: contractStatus.canceled });
      chatRepository.findPendingProposals.mockResolvedValue([]);

      const ctx = { role: "admin" };
      const result = await contractService.cancelContract("c301", "Admin intervention", ctx);

      expect(result).toBe(true);
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c301",
        expect.objectContaining({ status: contractStatus.canceled }),
        expect.any(Object)
      );
    });
  });

  describe("cancelContract - Auth & Validation Guardrails", () => {
    test("throws CONTRACT_NOT_FOUND when non-party attempts to cancel", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(null);
      const ctx = { role: "client", dbUser: { _id: "stranger" } };

      await expect(
        contractService.cancelContract("c999", "reason", ctx)
      ).rejects.toThrow(contractErrors.CONTRACT_NOT_FOUND);
    });

    test("throws ALREADY_CANCELED when canceling a terminal contract", async () => {
      const mockContract = {
        _id: "c400",
        clientId: "u1",
        status: contractStatus.canceled,
      };
      contractRepository.findByIdForParty.mockResolvedValue(mockContract);
      const ctx = { role: "client", dbUser: { _id: "u1" } };

      await expect(
        contractService.cancelContract("c400", "reason", ctx)
      ).rejects.toThrow(contractErrors.ALREADY_CANCELED);
    });
  });
});
