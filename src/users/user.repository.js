import UserModel from "../models/User.model";
import ContractModel from "../models/Contract.model";
import ChatModel from "../models/Chat.model";

export const userRepository = {
  async findAll() {
    return await UserModel.find();
  },

  async findByEmail(email) {
    return await UserModel.findOne({ email });
  },

  async findByClerkId(clerkId) {
    return await UserModel.findOne({ clerkId });
  },

  async findById(id) {
    return await UserModel.findById(id);
  },

  async createUser(data) {
    return await UserModel.create(data);
  },

  async updateUserById(id, updates = {}) {
    return await UserModel.findByIdAndUpdate(id, updates, { new: true });
  },

  async findContractsByClient(clientId) {
    return await ContractModel.find({ clientId });
  },

  async findChatsByUserId(userId) {
    return await ChatModel.find({ userId });
  },
};
