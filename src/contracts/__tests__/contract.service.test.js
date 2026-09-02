jest.mock("../contract.repository.js", () => ({
  contractRepository: {
    findById: jest.fn(),
    updateById: jest.fn(),
    findAll: jest.fn(),
    findByIdForParty: jest.fn(),
  },
}));
jest.mock("../../members/member.repository.js", () => ({ memberRepository: { findById: jest.fn() } }));
jest.mock("../../users/user.repository.js", () => ({ userRepository: { findById: jest.fn(), pushContractToUser: jest.fn() } }));
jest.mock("../../chat/chat.repository.js", () => ({ chatRepository: { findChatById: jest.fn(), createChat: jest.fn() } }));
jest.mock("../../stripe/stripe.service", () => ({
  createPaymentIntent: jest.fn(),
  releasePayoutToMember: jest.fn(),
}));

import { contractRepository } from "../contract.repository.js";
import { createPaymentIntent } from "../../stripe/stripe.service";
import { contractService } from "../contract.service.js";
import { contractStatus } from "../contract.constants.js";

describe("contractService.proposePrice", () => {
  beforeEach(() => jest.clearAllMocks());

  it("stores platformFee and payoutAmount with 15% calc", async () => {
    contractRepository.findById.mockResolvedValue({ _id: "cid1", shoeDetails: { brand: "Nike", model: "Air" } });
    createPaymentIntent.mockResolvedValue({ url: "https://checkout/session" });
    contractRepository.updateById.mockResolvedValue({});

    const url = await contractService.proposePrice("acct_123", "cid1", 200);
    expect(url).toBe("https://checkout/session");
    expect(createPaymentIntent).toHaveBeenCalledWith("acct_123", 200, "cid1", expect.any(String));
    const updateArg = contractRepository.updateById.mock.calls[0][1];
    expect(updateArg.platformFee).toBe(30);
    expect(updateArg.payoutAmount).toBe(170);
    expect(updateArg.status).toBe(contractStatus.priceProposed);
    expect(updateArg.proposedPrice).toBe(200);
  });

  it("rounding case $33.33", async () => {
    contractRepository.findById.mockResolvedValue({ shoeDetails: {} });
    createPaymentIntent.mockResolvedValue({ url: "u" });
    await contractService.proposePrice("acct", "cid2", 33.33);
    const arg = contractRepository.updateById.mock.calls[0][1];
    expect(arg.platformFee).toBe(5);
    expect(arg.payoutAmount).toBe(28.33);
  });

  it("throws CONTRACT_NOT_FOUND when contract missing", async () => {
    contractRepository.findById.mockResolvedValue(null);
    await expect(contractService.proposePrice("acct", "bad", 100)).rejects.toThrow("CONTRACT_NOT_FOUND");
  });
});
