import { contractService } from "../contract.service.js";
import { contractRepository } from "../contract.repository.js";
import { memberRepository } from "../../members/member.repository.js";
import {
  contractStatus,
  contractEvent,
  contractErrors,
  payoutStatus,
  UNBOXING_MIN_PHOTOS,
} from "../contract.constants.js";
import * as stripeService from "../../stripe/stripe.service.js";
import { handleShippoWebhook } from "../../shipping/shipping.webhook.js";
import { shippingService } from "../../shipping/shipping.service.js";
import { shippingRepository } from "../../shipping/shipping.repository.js";

jest.mock("../contract.repository.js");
jest.mock("../../models/Contract.model.js", () => ({
  __esModule: true,
  default: { find: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn() },
}));
jest.mock("../../members/member.repository.js");
jest.mock("../../users/user.repository.js", () => ({ userRepository: { findById: jest.fn() } }));
jest.mock("../../chat/chat.repository.js", () => ({
  chatRepository: { findPendingProposals: jest.fn(), saveMessage: jest.fn() },
}));
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
jest.mock("../../shipping/shipping.repository.js", () => ({
  shippingRepository: {
    findByShippoId: jest.fn(),
    findByTrackingNumber: jest.fn(),
    saveLabels: jest.fn(),
    pushTimeline: jest.fn(),
  },
}));

const MEMBER = "m1";
const CLIENT = "u1";

const baseContract = (overrides = {}) => ({
  _id: "c1",
  clientId: CLIENT,
  memberId: MEMBER,
  status: contractStatus.arrivedAtMember,
  payoutStatus: payoutStatus.pending,
  unboxingPhotos: [],
  packagingPhotos: [],
  payoutAmount: 170,
  payoutEligibleAt: null,
  ...overrides,
});

describe("Escrow & Dispute (plan-escrow-dispute.md §1–4, §6)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("unboxing gate: startWork", () => {
    test("throws UNBOXING_PHOTOS_REQUIRED with zero photos", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(baseContract());
      await expect(contractService.startWork("c1", MEMBER)).rejects.toThrow(
        contractErrors.UNBOXING_PHOTOS_REQUIRED
      );
      expect(UNBOXING_MIN_PHOTOS).toBe(3);
    });

    test("passes after upload: ARRIVED_AT_MEMBER + 3 photos → WORK_IN_PROGRESS + WORK_STARTED", async () => {
      const contract = baseContract({ unboxingPhotos: ["k1", "k2", "k3"] });
      contractRepository.findByIdForParty.mockResolvedValue(contract);
      contractRepository.findById.mockResolvedValue(contract);
      contractRepository.updateById.mockResolvedValue({
        ...contract,
        status: contractStatus.workInProgress,
      });
      await contractService.startWork("c1", MEMBER);
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          status: contractStatus.workInProgress,
          $push: {
            timeline: expect.objectContaining({ event: contractEvent.workStarted }),
          },
        }),
        expect.any(Object)
      );
    });

    test("wrong member → UNAUTHORIZED", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(
        baseContract({ unboxingPhotos: ["k1", "k2", "k3"] })
      );
      await expect(contractService.startWork("c1", "m2")).rejects.toThrow(
        contractErrors.UNAUTHORIZED
      );
    });

    test("wrong status → BAD_TRANSITION", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(
        baseContract({
          status: contractStatus.workInProgress,
          unboxingPhotos: ["k1", "k2", "k3"],
        })
      );
      await expect(contractService.startWork("c1", MEMBER)).rejects.toThrow(
        contractErrors.BAD_TRANSITION
      );
    });

    test("non-party → CONTRACT_NOT_FOUND", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(null);
      await expect(contractService.startWork("c1", "stranger")).rejects.toThrow(
        contractErrors.CONTRACT_NOT_FOUND
      );
    });
  });

  describe("uploadUnboxingPhotos", () => {
    test("member-owner $push keys + UNBOXING_PHOTOS_UPLOADED event", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(baseContract());
      const ok = await contractService.uploadUnboxingPhotos("c1", MEMBER, [
        "k1",
        "k2",
        "k3",
      ]);
      expect(ok).toBe(true);
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          $push: expect.objectContaining({
            unboxingPhotos: { $each: ["k1", "k2", "k3"] },
            timeline: expect.objectContaining({
              event: contractEvent.unboxingPhotosUploaded,
            }),
          }),
        })
      );
    });

    test("stays open after Start Work (WORK_IN_PROGRESS)", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(
        baseContract({
          status: contractStatus.workInProgress,
          unboxingPhotos: ["k1", "k2", "k3"],
        })
      );
      const ok = await contractService.uploadUnboxingPhotos("c1", MEMBER, ["k4"]);
      expect(ok).toBe(true);
      expect(contractRepository.updateById).toHaveBeenCalled();
    });

    test("soft max 12: at-cap upload is a no-op success", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(
        baseContract({ unboxingPhotos: Array.from({ length: 12 }, (_, i) => `k${i}`) })
      );
      const ok = await contractService.uploadUnboxingPhotos("c1", MEMBER, ["extra"]);
      expect(ok).toBe(true);
      expect(contractRepository.updateById).not.toHaveBeenCalled();
    });

    test("non-owner member → UNAUTHORIZED", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(baseContract());
      await expect(
        contractService.uploadUnboxingPhotos("c1", "m2", ["k1"])
      ).rejects.toThrow(contractErrors.UNAUTHORIZED);
    });
  });

  describe("uploadPackagingPhotos (§1b)", () => {
    test("client-owner in READY_TO_SHIP pushes keys + PACKAGING_PHOTOS_UPLOADED", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(
        baseContract({ status: contractStatus.readyToShip })
      );
      const ok = await contractService.uploadPackagingPhotos("c1", CLIENT, [
        "p1",
        "p2",
      ]);
      expect(ok).toBe(true);
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          $push: expect.objectContaining({
            packagingPhotos: { $each: ["p1", "p2"] },
            timeline: expect.objectContaining({
              event: contractEvent.packagingPhotosUploaded,
            }),
          }),
        })
      );
    });

    test("post-dropoff status → BAD_TRANSITION", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(
        baseContract({ status: contractStatus.inboundShipped })
      );
      await expect(
        contractService.uploadPackagingPhotos("c1", CLIENT, ["p1"])
      ).rejects.toThrow(contractErrors.BAD_TRANSITION);
    });

    test("member calling client path → UNAUTHORIZED", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(
        baseContract({ status: contractStatus.readyToShip })
      );
      await expect(
        contractService.uploadPackagingPhotos("c1", MEMBER, ["p1"])
      ).rejects.toThrow(contractErrors.UNAUTHORIZED);
    });
  });

  describe("flag → freeze (§2)", () => {
    test("flag from ARRIVED_AT_MEMBER sets UNDER_MANUAL_REVIEW + frozen with actor/reason", async () => {
      const contract = baseContract();
      contractRepository.findByIdForParty.mockResolvedValue(contract);
      contractRepository.findById.mockResolvedValue(contract);
      contractRepository.updateById.mockResolvedValue({
        ...contract,
        status: contractStatus.underManualReview,
      });
      await contractService.flagContract("c1", MEMBER, "rocks in box");
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          status: contractStatus.underManualReview,
          payoutStatus: payoutStatus.frozen,
          $push: {
            timeline: expect.objectContaining({
              event: contractEvent.disputeOpened,
              actor: "member",
              reason: "rocks in box",
            }),
          },
        }),
        expect.any(Object)
      );
    });

    test("flag from DELIVERED_TO_USER (client) also freezes", async () => {
      const contract = baseContract({ status: contractStatus.deliveredToUser });
      contractRepository.findByIdForParty.mockResolvedValue(contract);
      contractRepository.findById.mockResolvedValue(contract);
      contractRepository.updateById.mockResolvedValue({
        ...contract,
        status: contractStatus.underManualReview,
      });
      await contractService.flagContract("c1", CLIENT, "ruined shoes");
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          status: contractStatus.underManualReview,
          payoutStatus: payoutStatus.frozen,
        }),
        expect.any(Object)
      );
    });

    test("releasePayout after freeze throws NO_PENDING_PAYOUT and creates no transfer", async () => {
      contractRepository.findById.mockResolvedValue(
        baseContract({
          status: contractStatus.underManualReview,
          payoutStatus: payoutStatus.frozen,
        })
      );
      await expect(contractService.releasePayout("c1")).rejects.toThrow(
        contractErrors.NO_PENDING_PAYOUT
      );
      expect(stripeService.releasePayoutToMember).not.toHaveBeenCalled();
    });

    test("non-party flagging → CONTRACT_NOT_FOUND", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(null);
      await expect(
        contractService.flagContract("c1", "stranger", "x")
      ).rejects.toThrow(contractErrors.CONTRACT_NOT_FOUND);
    });

    test("findFlagged queries UNDER_MANUAL_REVIEW (real predicate)", async () => {
      const ContractModel = (await import("../../models/Contract.model.js")).default;
      ContractModel.find.mockResolvedValue([{ _id: "c1" }]);
      const realRepo = jest.requireActual("../contract.repository.js").contractRepository;
      const flagged = await realRepo.findFlagged();
      expect(ContractModel.find).toHaveBeenCalledWith({ status: "UNDER_MANUAL_REVIEW" });
      expect(flagged).toHaveLength(1);
    });
  });

  describe("72h auto-payout cron (§4)", () => {
    const past = new Date(Date.now() - 1000);

    test("due contract releases with payout-<contractId> idempotency key", async () => {
      const due = baseContract({
        status: contractStatus.deliveredToUser,
        payoutEligibleAt: past,
      });
      contractRepository.findPayoutDue.mockResolvedValue([due]);
      contractRepository.findById.mockResolvedValue(due);
      memberRepository.findById.mockResolvedValue({
        _id: MEMBER,
        stripeConnectAccountId: "acct_1",
      });
      stripeService.releasePayoutToMember.mockResolvedValue({ id: "tr_1" });
      contractRepository.updateById.mockResolvedValue({});

      const result = await contractService.autoReleasePayouts(new Date());
      expect(result).toEqual({ checked: 1, released: 1, failed: [] });
      expect(stripeService.releasePayoutToMember).toHaveBeenCalledWith(
        "acct_1",
        17000,
        "c1"
      );
      const transferCall = stripeService.releasePayoutToMember.mock.calls[0];
      expect(transferCall).toBeDefined();
    });

    test("flagged at hour 71 and undated rows are excluded", async () => {
      const valid = baseContract({
        _id: "due-ok",
        status: contractStatus.deliveredToUser,
        payoutEligibleAt: past,
      });
      const flagged = {
        _id: "flagged-71",
        status: contractStatus.underManualReview,
        payoutStatus: payoutStatus.frozen,
        payoutEligibleAt: new Date(Date.now() - 71 * 60 * 60 * 1000),
      };
      const undated = baseContract({
        _id: "no-date",
        status: contractStatus.deliveredToUser,
        payoutEligibleAt: null,
      });
      contractRepository.findPayoutDue.mockResolvedValue([valid, flagged, undated]);
      contractRepository.findById.mockImplementation(async (id) =>
        [valid, flagged, undated].find((c) => c._id === id)
      );
      memberRepository.findById.mockResolvedValue({
        _id: MEMBER,
        stripeConnectAccountId: "acct_1",
      });
      stripeService.releasePayoutToMember.mockResolvedValue({ id: "tr_2" });
      contractRepository.updateById.mockResolvedValue({});

      const result = await contractService.autoReleasePayouts(new Date());
      expect(result.checked).toBe(3);
      expect(result.released).toBe(1);
      expect(stripeService.releasePayoutToMember).toHaveBeenCalledTimes(1);
      expect(stripeService.releasePayoutToMember).toHaveBeenCalledWith(
        "acct_1",
        17000,
        "due-ok"
      );
    });

    test("double-run safe: second run creates no second transfer", async () => {
      const due = baseContract({
        status: contractStatus.deliveredToUser,
        payoutEligibleAt: past,
      });
      contractRepository.findPayoutDue.mockResolvedValue([due]);
      contractRepository.findById.mockResolvedValue(due);
      memberRepository.findById.mockResolvedValue({
        _id: MEMBER,
        stripeConnectAccountId: "acct_1",
      });
      stripeService.releasePayoutToMember.mockResolvedValue({ id: "tr_1" });
      contractRepository.updateById.mockResolvedValue({});

      await contractService.autoReleasePayouts(new Date());

      // Second run sees the paid row (stale candidate re-check skips it)
      contractRepository.findById.mockResolvedValue({
        ...due,
        payoutStatus: payoutStatus.paid,
        stripeTransferId: "tr_1",
        status: contractStatus.completed,
      });
      const second = await contractService.autoReleasePayouts(new Date());
      expect(second.released).toBe(0);
      expect(stripeService.releasePayoutToMember).toHaveBeenCalledTimes(1);
    });

    test("confirmReceipt (client-only) clears the wait and funnels into releasePayout", async () => {
      const delivered = baseContract({
        status: contractStatus.deliveredToUser,
        payoutEligibleAt: new Date(Date.now() + 70 * 60 * 60 * 1000),
      });
      contractRepository.findByIdForParty.mockResolvedValue(delivered);
      contractRepository.findById.mockResolvedValue(delivered);
      memberRepository.findById.mockResolvedValue({
        _id: MEMBER,
        stripeConnectAccountId: "acct_1",
      });
      stripeService.releasePayoutToMember.mockResolvedValue({ id: "tr_9" });
      contractRepository.updateById.mockResolvedValue({});

      const ok = await contractService.confirmReceipt("c1", CLIENT);
      expect(ok).toBe(true);
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({ payoutEligibleAt: expect.any(Date) })
      );
      expect(stripeService.releasePayoutToMember).toHaveBeenCalledTimes(1);
    });

    test("confirmReceipt by non-client member → UNAUTHORIZED", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(
        baseContract({ status: contractStatus.deliveredToUser })
      );
      await expect(contractService.confirmReceipt("c1", MEMBER)).rejects.toThrow(
        contractErrors.UNAUTHORIZED
      );
    });
  });

  describe("Shippo webhook hardening (§3)", () => {
    let res;
    beforeEach(() => {
      res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        sendStatus: jest.fn(),
      };
    });

    test("first outbound delivery sets payoutEligibleAt + REVIEW_WINDOW_OPENED", async () => {
      shippingService.verifyShippoEvent.mockReturnValue({
        event: "track_updated",
        data: {
          tracking_number: "TRK1",
          tracking_status: { status: "DELIVERED" },
        },
      });
      shippingRepository.findByTrackingNumber.mockResolvedValue({
        contract: baseContract({ status: contractStatus.returnShipped }),
        leg: "outbound",
      });
      shippingService.normalizeTrackingStatus.mockReturnValue("delivered");

      await handleShippoWebhook({ body: {} }, res);

      expect(res.sendStatus).toHaveBeenCalledWith(200);
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          status: contractStatus.deliveredToUser,
          payoutEligibleAt: expect.any(Date),
          $push: {
            timeline: {
              $each: expect.arrayContaining([
                expect.objectContaining({ event: contractEvent.returnDelivered }),
                expect.objectContaining({ event: contractEvent.reviewWindowOpened }),
              ]),
            },
          },
        })
      );
    });

    test("outbound redelivery does not move payoutEligibleAt", async () => {
      const eligibleAt = new Date("2026-01-01T00:00:00Z");
      shippingService.verifyShippoEvent.mockReturnValue({
        event: "track_updated",
        data: {
          tracking_number: "TRK1",
          tracking_status: { status: "DELIVERED" },
        },
      });
      shippingRepository.findByTrackingNumber.mockResolvedValue({
        contract: baseContract({
          status: contractStatus.deliveredToUser,
          payoutEligibleAt: eligibleAt,
        }),
        leg: "outbound",
      });
      shippingService.normalizeTrackingStatus.mockReturnValue("delivered");

      await handleShippoWebhook({ body: {} }, res);

      expect(res.sendStatus).toHaveBeenCalledWith(200);
      expect(contractRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe("READY_FOR_RETURN: markWorkComplete → pack → markReturnShipped", () => {
    const wip = () => baseContract({ status: contractStatus.workInProgress });
    const ready = (overrides = {}) =>
      baseContract({ status: contractStatus.readyForReturn, ...overrides });

    test("markWorkComplete: WORK_IN_PROGRESS → READY_FOR_RETURN + event", async () => {
      const contract = wip();
      contractRepository.findByIdForParty.mockResolvedValue(contract);
      contractRepository.findById.mockResolvedValue(contract);
      contractRepository.updateById.mockResolvedValue({
        ...contract,
        status: contractStatus.readyForReturn,
      });
      await expect(contractService.markWorkComplete("c1", MEMBER)).resolves.toBe(true);
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          status: contractStatus.readyForReturn,
          $push: {
            timeline: expect.objectContaining({ event: contractEvent.readyForReturn }),
          },
        }),
        expect.any(Object)
      );
    });

    test("markWorkComplete: wrong status → BAD_TRANSITION", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(
        baseContract({ status: contractStatus.arrivedAtMember })
      );
      await expect(contractService.markWorkComplete("c1", MEMBER)).rejects.toThrow(
        contractErrors.BAD_TRANSITION
      );
    });

    test("markWorkComplete: wrong member → UNAUTHORIZED", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(wip());
      await expect(contractService.markWorkComplete("c1", "m2")).rejects.toThrow(
        contractErrors.UNAUTHORIZED
      );
    });

    test("markReturnShipped: READY_FOR_RETURN → RETURN_SHIPPED", async () => {
      const contract = ready();
      contractRepository.findByIdForParty.mockResolvedValue(contract);
      contractRepository.findById.mockResolvedValue(contract);
      contractRepository.updateById.mockResolvedValue({
        ...contract,
        status: contractStatus.returnShipped,
      });
      await expect(contractService.markReturnShipped("c1", MEMBER)).resolves.toBe(true);
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({ status: contractStatus.returnShipped }),
        expect.any(Object)
      );
    });

    test("markReturnShipped: already shipped → true, no write (webhook idempotency)", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(
        ready({ status: contractStatus.returnShipped })
      );
      await expect(contractService.markReturnShipped("c1", MEMBER)).resolves.toBe(true);
      expect(contractRepository.updateById).not.toHaveBeenCalled();
    });

    test("markReturnShipped: from WORK_IN_PROGRESS → BAD_TRANSITION", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(wip());
      await expect(contractService.markReturnShipped("c1", MEMBER)).rejects.toThrow(
        contractErrors.BAD_TRANSITION
      );
    });

    test("uploadReturnPackagingPhotos: adds keys + event, caps at 3", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(
        ready({ returnPackagingPhotos: ["k1", "k2"] })
      );
      await expect(
        contractService.uploadReturnPackagingPhotos("c1", MEMBER, ["k3", "k4", "k5"])
      ).resolves.toBe(true);
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          $push: expect.objectContaining({
            returnPackagingPhotos: { $each: ["k3"] },
          }),
        })
      );
    });

    test("uploadReturnPackagingPhotos: rejected outside READY_FOR_RETURN", async () => {
      contractRepository.findByIdForParty.mockResolvedValue(wip());
      await expect(
        contractService.uploadReturnPackagingPhotos("c1", MEMBER, ["k1"])
      ).rejects.toThrow(contractErrors.BAD_TRANSITION);
    });

    test("flagContract: works from READY_FOR_RETURN", async () => {
      const contract = ready();
      contractRepository.findByIdForParty.mockResolvedValue(contract);
      contractRepository.findById.mockResolvedValue(contract);
      contractRepository.updateById.mockResolvedValue({
        ...contract,
        status: contractStatus.underManualReview,
      });
      await expect(contractService.flagContract("c1", MEMBER, "box feels light")).resolves.toBe(true);
      expect(contractRepository.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          status: contractStatus.underManualReview,
          payoutStatus: payoutStatus.frozen,
        }),
        expect.any(Object)
      );
    });
  });
});
