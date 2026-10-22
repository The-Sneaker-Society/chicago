import { contractService } from "../contract.service.js";
import { contractRepository } from "../contract.repository.js";
import { memberRepository } from "../../members/member.repository.js";
import { userRepository } from "../../users/user.repository.js";
import { contractStatus } from "../contract.constants.js";

jest.mock("../contract.repository.js");
jest.mock("../../models/Contract.model.js", () => ({
  __esModule: true,
  default: { find: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn(), aggregate: jest.fn() },
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

const flagged = (overrides = {}) => ({
  _id: "c1",
  clientId: "u1",
  memberId: "m1",
  orderRef: "SS-A",
  status: contractStatus.underManualReview,
  price: 100,
  declaredMarketValue: 200,
  createdAt: new Date("2026-08-01"),
  timeline: [{ event: "DISPUTE_OPENED", date: new Date("2026-08-02"), actor: "client", reason: "Damaged" }],
  ...overrides,
});

describe("getDisputeQueue party history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    memberRepository.findById.mockImplementation(async (id) => ({ _id: id, businessName: `Shop ${id}` }));
    userRepository.findById.mockImplementation(async (id) => ({ _id: id, firstName: "Jane", lastName: `Doe ${id}`, email: `${id}@x.com` }));
  });

  test("attaches prior dispute counts excluding the current contract", async () => {
    contractRepository.findFlagged.mockResolvedValue([
      flagged({ _id: "c1", orderRef: "SS-A", clientId: "u1", memberId: "m1" }),
      flagged({ _id: "c2", orderRef: "SS-B", clientId: "u1", memberId: "m1" }),
    ]);
    contractRepository.countDisputedByClients.mockResolvedValue({ u1: 2 });
    contractRepository.countDisputedByMembers.mockResolvedValue({ m1: 2 });

    const { items } = await contractService.getDisputeQueue({});
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.clientPriorDisputes).toBe(1);
      expect(item.memberPriorDisputes).toBe(1);
    }
    // batched: one count call per party type, not per row
    expect(contractRepository.countDisputedByClients).toHaveBeenCalledTimes(1);
    expect(contractRepository.countDisputedByMembers).toHaveBeenCalledTimes(1);
  });

  test("first-time disputers show zero", async () => {
    contractRepository.findFlagged.mockResolvedValue([
      flagged({ _id: "c1", orderRef: "SS-A", clientId: "u9", memberId: "m9" }),
    ]);
    contractRepository.countDisputedByClients.mockResolvedValue({ u9: 1 });
    contractRepository.countDisputedByMembers.mockResolvedValue({ m9: 1 });

    const { items } = await contractService.getDisputeQueue({});
    expect(items[0].clientPriorDisputes).toBe(0);
    expect(items[0].memberPriorDisputes).toBe(0);
  });
});
