import ProductsModel from "../models/Products.model";

export const productRepository = {
  async findAll() {
    return await ProductsModel.find();
  },

  async findById(id) {
    return await ProductsModel.findById(id);
  },

  async findByMemberId(memberId) {
    return await ProductsModel.find({ member: memberId });
  },

  async create(data) {
    return await ProductsModel.create(data);
  },

  async deleteById(id) {
    return await ProductsModel.findOneAndDelete({ _id: id });
  },
};
