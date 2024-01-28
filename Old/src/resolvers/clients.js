import { UserInputError } from 'apollo-server-core';
import MemberModel from '../models/Member.model';
import ClientModel from '../models/Client.model';
import ContractModel from '../models/Contract.model';
import EmailModel from '../models/Email.model';

const Query = {
  async clients() {
    try {
      const clients = await ClientModel.find();
      return clients;
    } catch (e) {
      throw new Error(e);
    }
  },
  async clientByEmail(parent, args, ctx, info) {
    try {
      const client = await ClientModel.findOne({ email: args.email });
      if (!client) {
        throw new Error('Client Not Found');
      }

      return client;
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Mutation = {
  // createEmail: async (parent, args, ctx, info) => {
  //   try {
  //     const { email, firstName, lastName } = args.data;
  //     if (email) {
  //       const newEmailAddition = new EmailModel({
  //         firstName,
  //         lastName,
  //         email: email,
  //       });

  //       const res = await newEmailAddition.save();

  //       return { ...res._doc, id: res._id };
  //     }
  //   } catch (e) {
  //     if (e.code === 11000) {
  //       throw Error('Email already exist, check you email!');
  //     } else {
  //       throw new Error(e);
  //     }
  //   }
  // },
  createClient: async (parent, args, ctx, info) => {
    try {
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
      } = args.data;

      // Find if member exists
      const member = await MemberModel.findById(memberId);

      // If member exists
      if (member) {
        // Create client
        const client = new ClientModel({
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

        const res = await client.save();

        // Add Client to member
        member.clients.push(res._id);

        // Update member
        await member.save();

        // Return the created client with all fields
        return res;
      } else {
        throw new UserInputError('Member does not exist.');
      }
    } catch (e) {
      throw new Error(e);
    }
  },
  updateClient: async (parent, args, ctx, info) => {
    try {
      const { id, ...updateData } = args.data;

      // Find the client to update
      const client = await ClientModel.findById(id);

      // If the client does not exist, throw an error
      if (!client) {
        throw new UserInputError('Client not found.');
      }

      // Update the client with the provided data
      Object.assign(client, updateData);

      // Save the updated client
      await client.save();

      // Return a response indicating the update was successful
      return true;
    } catch (e) {
      // Handle any errors and return a response indicating the update was not successful
      throw e;
    }
  },
};

const Client = {
  async members(parent, args, ctx, ifo) {
    try {
      const members = await MemberModel.find();

      return members.filter((member) => {
        return member.clients.includes(parent.id);
      });
    } catch (e) {
      throw new Error(e);
    }
  },
  async contracts(parent, args, ctx, info) {
    try {
      const contracts = await ContractModel.find();
      return contracts.filter(
        (contract) => contract.client.toString() === parent.id
      );
      // return contracts;
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Query, Mutation, Client };
