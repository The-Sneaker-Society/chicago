import ClientModel from "../models/Client.model";

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
};
