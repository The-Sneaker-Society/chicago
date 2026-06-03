import mongoose from "mongoose";
import connectDb from "../config/db";
import ContractModel from "../models/Contract.model";
import UserModel from "../models/User.model";
import MemberModel from "../models/Member.model";

const MEMBER_ID = process.argv[2];
const USER_ID = process.argv[3];

if (!MEMBER_ID || !USER_ID) {
  console.error("Usage: babel-node src/scripts/seedFakeContract.js <memberId> <userId>");
  process.exit(1);
}

async function seedFakeContract() {
  try {
    await connectDb();

    const member = await MemberModel.findById(MEMBER_ID);
    if (!member) {
      console.error(`Member not found: ${MEMBER_ID}`);
      process.exit(1);
    }

    const user = await UserModel.findById(USER_ID);
    if (!user) {
      console.error(`User not found: ${USER_ID}`);
      process.exit(1);
    }

    const contract = new ContractModel({
      clientId: USER_ID,
      memberId: MEMBER_ID,
      chatId: null,
      declaredMarketValue: 2900,
      boxIncluded: true,
      shoeDetails: {
        brand: "nike",
        model: "Air Force 1",
        color: "White",
        size: "10.5",
        soleCondition: "light wear",
        material: "Leather",
        year: "2022",
        returnTimeframe: "standard",
        odorLevel: "none",
        previousRepairs: false,
        previousRepairsNotes: "",
        photos: {
          leftSide: [{ url: "https://placehold.co/600x400?text=Left+Side", note: "" }],
          rightSide: [{ url: "https://placehold.co/600x400?text=Right+Side", note: "" }],
          topView: [{ url: "https://placehold.co/600x400?text=Top+View", note: "" }],
          bottomView: [{ url: "https://placehold.co/600x400?text=Bottom+View", note: "" }],
          frontView: [{ url: "https://placehold.co/600x400?text=Front+View", note: "" }],
          backView: [{ url: "https://placehold.co/600x400?text=Back+View", note: "" }],
          inside: [{ url: "https://placehold.co/600x400?text=Inside", note: "" }],
          tongue: [{ url: "https://placehold.co/600x400?text=Tongue", note: "" }],
          box: [{ url: "https://placehold.co/600x400?text=Box+Condition", note: "Original box, minor wear" }],
          other: [],
        },
      },
      repairDetails: {
        clientNotes: "Deep clean and restore original white finish. Light yellowing on soles, minor creasing on toe box. Please also condition the leather.",
        memberNotes: "",
      },
      proposedPrice: null,
      price: null,
      status: "PENDING_REVIEW",
      inboundTracking: { trackingNumber: null, carrier: null },
      outboundTracking: { trackingNumber: null, carrier: null },
      unboxingPhotos: [],
      completionPhotos: [],
      afterFormNotes: null,
      paymentStatus: null,
      stripePaymentIntentId: null,
      stripeTransferId: null,
      payoutStatus: "pending",
      payoutAmount: null,
      platformFee: null,
      payoutEligibleAt: null,
      paidAt: null,
      timeline: [
        {
          event: "CONTRACT_CREATED",
          date: Date.now(),
        },
      ],
    });

    const savedContract = await contract.save();

    await UserModel.findByIdAndUpdate(USER_ID, {
      $push: { contracts: savedContract._id },
      $addToSet: { members: MEMBER_ID },
    });

    await MemberModel.findByIdAndUpdate(MEMBER_ID, {
      $push: { contracts: savedContract._id },
      $addToSet: { clients: USER_ID },
    });

    console.log(`Fake contract created successfully!`);
    console.log(`Contract ID: ${savedContract._id}`);
    console.log(`Member: ${member.email || member.firstName}`);
    console.log(`User: ${user.email || user.firstName}`);
    console.log(`\nIt should now appear on the member dashboard and contracts list.`);
  } catch (error) {
    console.error("Error seeding fake contract:", error);
  } finally {
    mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

seedFakeContract();
