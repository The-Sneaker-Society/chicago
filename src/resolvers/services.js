import { UserInputError } from "apollo-server-core";
import MemberModel from "../models/Member.model";
import ServiceModel from "../models/Service.model";

const Query = {
  async services(parent, args, ctx, info) {
    try {
      const services = await ServiceModel.find();
      return services;
    } catch (e) {
      throw e;
    }
  },
};

const Mutation = {
  async createService(parent, args, ctx, info) {
    try {
      const { name, price, description, photoUrl } = args.data;
      // Find member
      const newService = new ServiceModel({
        name,
        price,
        description,
        photoUrl,
      });
      const res = await newService.save();

      return res;
    } catch (e) {
      throw new Error(e);
    }
  },

  async updateService(parent, args, ctx, info) {
    try {
      const { id, name, price, description, photoUrl } = args.data;
      const service = await ServiceModel.findById(id);
      if (!service) {
        throw new UserInputError("service nor found");
      }
      service.name = name || service.name;
      service.price = price || service.price;
      service.description = description || service.description;
      service.photoUrl = photoUrl || service.photoUrl;
      const updatedService = await service.save();
      return updatedService;
    } catch (e) {
      throw new Error(e);
    }
  },

  async deleteService(parent, args, ctx, info) {
    try {
      const { id } = args;
      const service = await ServiceModel.findById(id);
      if (!service) {
        throw new UserInputError("Service not found");
      }
      await service.remove();
      return service;
    } catch (e) {
      throw new Error(e);
    }
  },
};
export default { Query, Mutation };
