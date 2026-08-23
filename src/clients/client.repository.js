import ClientModel from "../models/Client.model";
import MemberModel from "../models/Member.model";
import ContractModel from "../models/Contract.model";

export const clientRepository = {
  async findAll() {
    return await ClientModel.find();
  },

  async findByEmail(email) {
    return await ClientModel.findOne({ email });
  },

  async findById(id) {
    return await ClientModel.findById(id);
  },

  async create(data) {
    return await ClientModel.create(data);
  },

  async save(doc) {
    return await doc.save();
  },

  async findMembersByClient(clientId) {
    return await MemberModel.find({ clients: clientId });
  },

  async findContractsByClient(clientId) {
    return await ContractModel.find({ clientId });
  },

  // TODO(cross-domain): move to memberRepository when members refactor lands
  async findMemberById(memberId) {
    return await MemberModel.findById(memberId);
  },
};
