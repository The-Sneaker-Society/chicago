import { UserInputError } from 'apollo-server-core';
import MemberModel from '../models/Member.model';
import ClientModel from '../models/Client.model';
import ContractModel from '../models/Contract.model';
import ProductsModel from '../models/Products.model';
import { createAccountLink, createExpressaccount } from '../stripe/stripeUtils';

//  test url https://docs.stripe.com/connect/testing

const Query = {
  async members(parent, args, ctx, info) {
    try {
      const members = await MemberModel.find();
      console.log('gello');
      return members;
    } catch (e) {
      throw new Error(e);
    }
  },
  async memberById(parent, args, ctx, info) {
    try {
      const member = await MemberModel.find({ firebaseId: args.id });
      if (!member) {
        throw new Error('Member not found');
      }

      return member[0];
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createMember(parent, args, ctx, info) {
    try {
      console.log(args);
      const {
        email,
        firstName,
        lastName,
        firebaseId,
        phoneNumber,
        zipcode,
        addressLineOne,
        addressLineTwo,
        state,
      } = args.data;

      const member = await MemberModel.findOne({ email: email });
      // console.log(member);

      if (member) {
        throw new UserInputError(
          'Email is taken. If this is wrong please contact support',
          {
            errors: {
              email: 'This email is taken.',
            },
          }
        );
      }

      const newMember = new MemberModel({
        email,
        firstName,
        lastName,
        firebaseId,
        phoneNumber,
        zipcode,
        addressLineOne,
        addressLineTwo,
        state,
        isActive: true,
      });

      const res = await newMember.save();

      return { ...res._doc, id: res._id };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  async updateMember(parent, args, ctx, info) {
    try {
      await MemberModel.findByIdAndUpdate(
        ctx.id,
        { ...args.data },
        { new: true }
      );
      return true;
    } catch (error) {
      throw error;
    }
  },
  async deleteMember(parent, args, ctx, info) {
    try {
      await MemberModel.findByIdAndUpdate(
        ctx.id,
        { deletedAt: Date.now() },
        { new: true }
      );
      return true;
    } catch (e) {
      throw new Error(e);
    }
  },
  async onboardMemberToStripe(parent, args, ctx, info) {
    try {
      const createdStripeAccountId = await createExpressaccount();
      const member = await MemberModel.findByIdAndUpdate(
        ctx.id,
        { stripeConnectAccountId: createdStripeAccountId.id },
        { new: true }
      );

      console.log(member);

      const { url } = await createAccountLink(member.stripeConnectAccountId);

      return url;
    } catch (error) {
      throw new Error(error);
    }
  },
  async resumeAccountOnboarding(parent, args, ctx, info) {
    try {
      const member = await MemberModel.findById(ctx.id);

      console.log(member);

      const { url } = await createAccountLink(member.stripeConnectAccountId);

      return url;
    } catch (error) {
      throw new Error(error);
    }
  },
};

const Member = {
  async clients(parent, args, ctx, info) {
    try {
      const clients = await ClientModel.find();

      return clients.filter((client) => client.members.includes(parent.id));
    } catch (e) {
      throw new Error(e);
    }
  },

  async contracts(parent, args, ctx, info) {
    try {
      const contracts = await ContractModel.find();
      return contracts.filter(
        (contract) => contract.member.toString() === parent.id
      );
    } catch (e) {
      throw new Error(e);
    }
  },

  async products(parent, args, ctx, info) {
    try {
      const products = await ProductsModel.find({
        member: parent._id,
      });
      return products;
    } catch (e) {
      throw new Error(e);
    }
  },
};
export default { Query, Mutation, Member };
