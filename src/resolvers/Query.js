import { UserInputError } from "apollo-server-core";
import MemberModel from "../models/Member.model";
import ClientModel from "../models/Client.model";

const Query = {
    hello: () => {
        return "Hello world";
      },
      async members() {
        try {
          const members = await MemberModel.find();
          return members;
        } catch (e) {
          throw new Error(e);
        }
      },
      async clients() {
        try {
          const clients = await ClientModel.find();
          return clients;
        } catch (e) {
          throw new Error(e);
        }
      },
};

export { Query as default };
