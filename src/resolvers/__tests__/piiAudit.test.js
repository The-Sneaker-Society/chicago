import memberResolvers from "../members.resolver.js";
import contractResolvers from "../contracts.js";
import { memberService } from "../../members/member.service.js";
import { contractService } from "../../contracts/contract.service.js";
import { ForbiddenError } from "apollo-server-core";

jest.mock("../../members/member.service.js");
jest.mock("../../contracts/contract.service.js");

describe("PII Audit & Field-Level Scoping (plan-pii-audit.md)", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Finding 1: memberById vs publicMemberById", () => {
    const fullMember = {
      _id: "mem_123",
      id: "mem_123",
      firstName: "Sole",
      lastName: "Master",
      email: "sole@example.com",
      phoneNumber: "555-123-4567",
      addressLineOne: "123 Sneaker St",
      city: "Chicago",
      state: "IL",
      zipcode: "60601",
      stripeConnectAccountId: "acct_secret123",
      stripeCustomerId: "cus_secret456",
      contractsDisabled: false,
      serviceMenu: [],
    };

    test("memberById: allows admin to fetch full member", async () => {
      memberService.getMemberById.mockResolvedValue(fullMember);
      const ctx = { role: "admin", userId: "admin_1" };

      const result = await memberResolvers.Query.memberById(
        null,
        { id: "mem_123" },
        ctx
      );
      expect(result).toEqual(fullMember);
      expect(memberService.getMemberById).toHaveBeenCalledWith("mem_123");
    });

    test("memberById: allows member to fetch their own full record", async () => {
      memberService.getMemberById.mockResolvedValue(fullMember);
      const ctx = {
        role: "member",
        userId: "clerk_mem",
        dbUser: { _id: "mem_123" },
      };

      const result = await memberResolvers.Query.memberById(
        null,
        { id: "mem_123" },
        ctx
      );
      expect(result).toEqual(fullMember);
    });

    test("memberById: forbids non-self member from accessing full profile", async () => {
      const ctx = {
        role: "member",
        userId: "clerk_other",
        dbUser: { _id: "mem_other" },
      };

      await expect(
        memberResolvers.Query.memberById(null, { id: "mem_123" }, ctx)
      ).rejects.toThrow(ForbiddenError);
      expect(memberService.getMemberById).not.toHaveBeenCalled();
    });

    test("memberById: forbids client user from accessing full member profile", async () => {
      const ctx = {
        role: "client",
        userId: "clerk_client",
        dbUser: { _id: "client_999" },
      };

      await expect(
        memberResolvers.Query.memberById(null, { id: "mem_123" }, ctx)
      ).rejects.toThrow(ForbiddenError);
      expect(memberService.getMemberById).not.toHaveBeenCalled();
    });

    test("memberById: rejects unauthenticated caller", async () => {
      await expect(
        memberResolvers.Query.memberById(null, { id: "mem_123" }, {})
      ).rejects.toThrow(ForbiddenError);
    });

    test("publicMemberById: allows authenticated client to query public profile", async () => {
      memberService.getMemberById.mockResolvedValue(fullMember);
      const ctx = {
        role: "client",
        userId: "clerk_client",
        dbUser: { _id: "client_999" },
      };

      const result = await memberResolvers.Query.publicMemberById(
        null,
        { id: "mem_123" },
        ctx
      );
      expect(result).toEqual(fullMember);
      expect(memberService.getMemberById).toHaveBeenCalledWith("mem_123");
    });

    test("publicMemberById: rejects unauthenticated caller", async () => {
      await expect(
        memberResolvers.Query.publicMemberById(null, { id: "mem_123" }, {})
      ).rejects.toThrow(ForbiddenError);
    });

    test("PublicMember resolver: safely handles contractsDisabled default", () => {
      expect(
        memberResolvers.PublicMember.contractsDisabled({ contractsDisabled: true })
      ).toBe(true);
      expect(
        memberResolvers.PublicMember.contractsDisabled({ contractsDisabled: false })
      ).toBe(false);
      expect(
        memberResolvers.PublicMember.contractsDisabled({})
      ).toBe(false);
    });
  });

  describe("Finding 2: Contract.member and Contract.client party-level scoping", () => {
    const fullMember = {
      _id: "mem_123",
      id: "mem_123",
      firstName: "Sole",
      lastName: "Master",
      businessName: "Sole Restoration",
      email: "sole@example.com",
      phoneNumber: "555-123-4567",
      addressLineOne: "123 Sneaker St",
      city: "Chicago",
      state: "IL",
      zipcode: "60601",
      stripeConnectAccountId: "acct_secret123",
      stripeCustomerId: "cus_secret456",
    };

    const fullClient = {
      _id: "client_999",
      id: "client_999",
      firstName: "Jordan",
      lastName: "Fan",
      email: "client@example.com",
      phoneNumber: "555-987-6543",
      addressLineOne: "456 Customer Ave",
      addressLineTwo: "Apt 2B",
      city: "New York",
      state: "NY",
      zipcode: "10001",
      country: "US",
    };

    const contract = {
      id: "contract_001",
      memberId: "mem_123",
      clientId: "client_999",
    };

    test("Contract.member: returns full member for admin", async () => {
      contractService.getContractMember.mockResolvedValue(fullMember);
      const ctx = { role: "admin", userId: "admin_1" };

      const result = await contractResolvers.Contract.member(contract, null, ctx);
      expect(result).toEqual(fullMember);
    });

    test("Contract.member: returns full member for self member", async () => {
      contractService.getContractMember.mockResolvedValue(fullMember);
      const ctx = {
        role: "member",
        userId: "clerk_mem",
        dbUser: { _id: "mem_123" },
      };

      const result = await contractResolvers.Contract.member(contract, null, ctx);
      expect(result).toEqual(fullMember);
    });

    test("Contract.member: returns sanitized member for counterparty client", async () => {
      contractService.getContractMember.mockResolvedValue(fullMember);
      const ctx = {
        role: "client",
        userId: "clerk_client",
        dbUser: { _id: "client_999" },
      };

      const result = await contractResolvers.Contract.member(contract, null, ctx);
      expect(result.id).toBe("mem_123");
      expect(result.firstName).toBe("Sole");
      expect(result.lastName).toBe("Master");
      expect(result.businessName).toBe("Sole Restoration");
      // Sensitive fields must be nulled/empty
      expect(result.addressLineOne).toBeNull();
      expect(result.addressLineTwo).toBeNull();
      expect(result.city).toBeNull();
      expect(result.zipcode).toBeNull();
      expect(result.phoneNumber).toBeNull();
      expect(result.stripeCustomerId).toBeNull();
      expect(result.stripeConnectAccountId).toBe("");
    });

    test("Contract.member: throws ForbiddenError for non-party user", async () => {
      contractService.getContractMember.mockResolvedValue(fullMember);
      const ctx = {
        role: "client",
        userId: "clerk_other",
        dbUser: { _id: "client_stranger" },
      };

      await expect(
        contractResolvers.Contract.member(contract, null, ctx)
      ).rejects.toThrow(ForbiddenError);
    });

    test("Contract.client: returns full client for admin", async () => {
      contractService.getContractClient.mockResolvedValue(fullClient);
      const ctx = { role: "admin", userId: "admin_1" };

      const result = await contractResolvers.Contract.client(contract, null, ctx);
      expect(result).toEqual(fullClient);
    });

    test("Contract.client: returns full client for self client", async () => {
      contractService.getContractClient.mockResolvedValue(fullClient);
      const ctx = {
        role: "client",
        userId: "clerk_client",
        dbUser: { _id: "client_999" },
      };

      const result = await contractResolvers.Contract.client(contract, null, ctx);
      expect(result).toEqual(fullClient);
      expect(result.addressLineOne).toBe("456 Customer Ave");
    });

    test("Contract.client: returns sanitized client for counterparty member", async () => {
      contractService.getContractClient.mockResolvedValue(fullClient);
      const ctx = {
        role: "member",
        userId: "clerk_mem",
        dbUser: { _id: "mem_123" },
      };

      const result = await contractResolvers.Contract.client(contract, null, ctx);
      expect(result.id).toBe("client_999");
      expect(result.firstName).toBe("Jordan");
      expect(result.lastName).toBe("Fan");
      expect(result.email).toBe("client@example.com");
      // Physical address and phone are stripped
      expect(result.addressLineOne).toBeNull();
      expect(result.addressLineTwo).toBeNull();
      expect(result.city).toBeNull();
      expect(result.state).toBeNull();
      expect(result.country).toBeNull();
      expect(result.zipcode).toBeNull();
      expect(result.phoneNumber).toBeNull();
    });

    test("Contract.client: throws ForbiddenError for non-party user", async () => {
      contractService.getContractClient.mockResolvedValue(fullClient);
      const ctx = {
        role: "member",
        userId: "clerk_other_mem",
        dbUser: { _id: "mem_stranger" },
      };

      await expect(
        contractResolvers.Contract.client(contract, null, ctx)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Finding 3: getServiceMenu guard", () => {
    test("rejects unauthenticated requests", async () => {
      await expect(
        memberResolvers.Query.getServiceMenu(null, { memberId: "mem_123" }, {})
      ).rejects.toThrow(ForbiddenError);
      expect(memberService.getServiceMenu).not.toHaveBeenCalled();
    });

    test("allows authenticated requests", async () => {
      memberService.getServiceMenu.mockResolvedValue([
        { id: "item_1", name: "Clean", price: 50 },
      ]);
      const ctx = { role: "client", userId: "clerk_client" };

      const result = await memberResolvers.Query.getServiceMenu(
        null,
        { memberId: "mem_123" },
        ctx
      );
      expect(result).toHaveLength(1);
      expect(memberService.getServiceMenu).toHaveBeenCalledWith("mem_123");
    });
  });
});
