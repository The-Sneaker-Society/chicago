import { clientRepository } from "./client.repository.js";
import { memberRepository } from "../members/member.repository.js";
import { contractRepository } from "../contracts/contract.repository.js";

export const clientService = {
  async getClients() {
    return await clientRepository.findAll();
  },

  /**
   * Throws a plain domain error that the resolver translates.
   */
  async getClientByEmail(email) {
    const client = await clientRepository.findByEmail(email);
    if (!client) {
      throw new Error("CLIENT_NOT_FOUND");
    }
    return client;
  },

  /**
   * Creates a new client linked to an existing member.
   * - Verifies the member exists (domain error MEMBER_NOT_FOUND).
   * - Applies defaults (isActive: true, members: [memberId]).
   * - Appends the created client id to the member's clients array.
   */
  async createClient(input) {
    const {
      email,
      firstName,
      lastName,
      phoneNumber,
      addressLineOne,
      addressLineTwo,
      zipcode,
      state,
      memberId,
      firebaseId,
    } = input;

    const member = await memberRepository.findById(memberId);
    if (!member) {
      throw new Error("MEMBER_NOT_FOUND");
    }

    const created = await clientRepository.create({
      email,
      firstName,
      lastName,
      phoneNumber,
      addressLineOne,
      addressLineTwo,
      zipcode,
      state,
      isActive: true,
      members: [memberId],
      firebaseId,
    });

    member.clients.push(created._id);
    await memberRepository.save(member);

    return created;
  },

  /**
   * Updates a client by id. Throws a plain domain error that the
   * resolver translates.
   */
  async updateClient(id, updates) {
    const client = await clientRepository.findById(id);
    if (!client) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    Object.assign(client, updates);
    await clientRepository.save(client);
    return true;
  },

  /**
   * Members linked to the requester's client record. Takes the requester's
   * db user id from ctx (never raw parent data) so reads stay scoped to the
   * logged-in identity.
   */
  async getMembersForClient(requesterDbId) {
    return await memberRepository.findMembersByClientId(requesterDbId);
  },

  /**
   * Contracts where the requester is the client (scoped to ctx identity).
   */
  async getContractsForClient(requesterDbId) {
    return await contractRepository.findByClient(requesterDbId);
  },
};
