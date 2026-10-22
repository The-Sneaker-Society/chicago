import { contractService } from "../contract.service.js";
import { contractRepository } from "../contract.repository.js";
import { memberRepository } from "../../members/member.repository.js";
import { userRepository } from "../../users/user.repository.js";
import {
  contractStatus,
  contractEvent,
  contractErrors,
  payoutStatus,
} from "../contract.constants.js";

jest.mock("../contract.repository.js");
jest.mock("../../models/Contract.model.js", () => ({
  __esModule: true,
  default: { find: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn(), aggregate: jest.fn() },
}));
jest.mock("../../members/member.repository.js");
jest.mock("../../users/user.repository.js", () => ({
  userRepository: { findById: jest.fn(), updateUserById: jest.fn() },
}));
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

const flaggedContract = (overrides = {}) => ({
  _id: "c1",
  clientId: "u1",
  memberId: "m1",
  orderRef: "SS-A",
  status: contractStatus.underManualReview,
  payoutStatus: payoutStatus.frozen,
  preDisputeStatus: contractStatus.inboundShipped,
  preDisputePayoutStatus: payoutStatus.pending,
  timeline: [],
  ...overrides,
});

describe("dismissDispute (false alarm)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("restores stored status and payout, clears snapshot, notes timeline", async () => {
    contractRepository.findById.mockResolvedValue(flaggedContract());
    contractRepository.updateById.mockResolvedValue({});

    const result = await contractService.dismissDispute("c1", {
      reason: "No need — carrier scan shows delivered",
      adminActor: "admin:123",
    });

    expect(result).toBe(true);
    expect(contractRepository.updateById).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        status: contractStatus.inboundShipped,
        payoutStatus: payoutStatus.pending,
        preDisputeStatus: null,
        preDisputePayoutStatus: null,
      }),
      { new: true }
    );
    const updateArg = contractRepository.updateById.mock.calls[0][1];
    expect(updateArg.$push.timeline).toEqual(
      expect.objectContaining({
        event: contractEvent.disputeDismissed,
        actor: "admin:123",
      })
    );
  });

  test("explicit resumeStatus overrides a missing snapshot", async () => {
    contractRepository.findById.mockResolvedValue(
      flaggedContract({ preDisputeStatus: null, preDisputePayoutStatus: null })
    );
    contractRepository.updateById.mockResolvedValue({});

    await contractService.dismissDispute("c1", {
      resumeStatus: contractStatus.workInProgress,
      reason: "Resuming",
      adminActor: "admin:123",
    });

    expect(contractRepository.updateById).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        status: contractStatus.workInProgress,
        payoutStatus: payoutStatus.pending,
      }),
      { new: true }
    );
  });

  test("no snapshot and no override throws RESUME_STATUS_UNKNOWN", async () => {
    contractRepository.findById.mockResolvedValue(
      flaggedContract({ preDisputeStatus: null, preDisputePayoutStatus: null })
    );
    await expect(contractService.dismissDispute("c1", {})).rejects.toThrow(
      contractErrors.RESUME_STATUS_UNKNOWN
    );
  });

  test("rejects non-open and missing contracts", async () => {
    contractRepository.findById.mockResolvedValueOnce(null);
    await expect(contractService.dismissDispute("nope", {})).rejects.toThrow(
      contractErrors.CONTRACT_NOT_FOUND
    );
    contractRepository.findById.mockResolvedValueOnce(
      flaggedContract({ status: contractStatus.completed })
    );
    await expect(contractService.dismissDispute("c1", {})).rejects.toThrow(
      contractErrors.DISPUTE_NOT_OPEN
    );
  });

  test("applies per-party bans", async () => {
    contractRepository.findById.mockResolvedValue(flaggedContract());
    contractRepository.updateById.mockResolvedValue({});
    memberRepository.updateById.mockResolvedValue({});
    userRepository.updateUserById.mockResolvedValue({});

    await contractService.dismissDispute("c1", { banMember: true, banUser: true });
    expect(memberRepository.updateById).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ isActive: false })
    );
    expect(userRepository.updateUserById).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ isActive: false })
    );
  });

  test("flagContract snapshots pre-dispute state", async () => {
    const live = {
      _id: "c2",
      clientId: "u1",
      memberId: "m1",
      status: contractStatus.readyToShip,
      payoutStatus: payoutStatus.pending,
    };
    contractRepository.findByIdForParty.mockResolvedValue(live);
    contractRepository.findById.mockResolvedValue(live);
    contractRepository.updateById.mockResolvedValue({});

    await contractService.flagContract("c2", "u1", "Where are my shoes");
    expect(contractRepository.updateById).toHaveBeenCalledWith(
      "c2",
      expect.objectContaining({
        status: contractStatus.underManualReview,
        payoutStatus: payoutStatus.frozen,
        preDisputeStatus: contractStatus.readyToShip,
        preDisputePayoutStatus: payoutStatus.pending,
      }),
      { new: true }
    );
  });
});
